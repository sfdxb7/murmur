import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import type { Agent } from './agents'

vi.mock('@/hermes/rest', () => ({ api: { delete: vi.fn(async () => ({})) } }))
vi.mock('@/hermes/compat', () => ({ listProfiles: vi.fn(), listProfileNames: vi.fn() }))
vi.mock('@/hermes/gateway', () => ({ rpc: vi.fn(), gateway: {} }))
vi.mock('@/hermes/instance', () => ({ scoped: (key: string) => key }))
vi.mock('./timezone', () => ({ ensureAgentTimezone: vi.fn(async () => '') }))
vi.mock('./toolsets', () => ({ hideDesktopToolsets: vi.fn(async () => {}) }))
vi.mock('./umbrel-context', () => ({ ensureUmbrelContext: vi.fn(async () => {}) }))
vi.mock('./umbrel-mcp', () => ({ ensureUmbrelMcp: vi.fn(async () => {}) }))
vi.mock('./mail', () => ({ forgetInheritedMail: vi.fn(async () => {}) }))

const { agentsKey, asTheyAre, deleteAgent, dropKeptChat, fetchAgentChats, keepChats, keptChats, createAgent, revealAgent, rosterQuery, saysGone, setAgentHidden, toAgent, visibleAgents, soloOf } = await import('./agents')
const { rpc } = (await import('@/hermes/gateway')) as unknown as { rpc: ReturnType<typeof vi.fn> }
const { listProfiles } = (await import('@/hermes/compat')) as unknown as { listProfiles: ReturnType<typeof vi.fn> }

const agent = (id: string, more: Partial<Agent> = {}): Agent => ({ id, name: id, hue: 0, role: '', isDefault: false, hidden: false, ...more })

/** The roster as it was when the sheet opened: Hermes and Zed. */
function roster() {
  const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
  qc.setQueryData<Agent[]>(agentsKey, [agent('default', { name: 'Hermes', isDefault: true }), agent('zed', { name: 'Zed' })])
  return qc
}

const names = (qc: QueryClient) => qc.getQueryData<Agent[]>(agentsKey)?.map((a) => a.name)

const make = () =>
  createAgent({ name: 'Coder', hue: 30, role: 'Writes code ', soul: '# Coder\n', template: 'coder' })

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ ok: true, applied: { ui_meta: true } })
  listProfiles.mockReset().mockResolvedValue([
    { name: 'default', is_default: true, model: 'gpt-5.5', provider: 'openai-codex' },
    { name: 'zed', is_default: false, model: 'qwen3', provider: 'ollama' },
  ])
})

describe('a new agent', () => {
  it('joins the roster the moment it is let in, as it was made, without waiting for Hermes to be read again', async () => {
    const qc = roster()
    // The roster on screen, and reading every agent from Hermes takes as long as Hermes likes.
    const read = vi.fn(() => new Promise<Agent[]>(() => {}))
    const off = new QueryObserver(qc, { queryKey: agentsKey, queryFn: read, staleTime: Infinity }).subscribe(() => {})
    const id = await make()
    expect(names(qc)).toEqual(['Hermes', 'Zed'])

    await revealAgent(qc, id)
    expect(names(qc)).toEqual(['Hermes', 'Coder', 'Zed'])
    // Hermes is still read again, to settle it as Hermes has it.
    expect(read).toHaveBeenCalledTimes(1)
    expect(qc.getQueryData<Agent[]>(agentsKey)?.find((a) => a.id === id)).toMatchObject({
      id: 'coder',
      name: 'Coder',
      hue: 30,
      role: 'Writes code',
      isDefault: false,
      template: 'coder',
      // Hermes gives a new agent the main agent's model.
      model: 'gpt-5.5',
      provider: 'openai-codex',
    })
    off()
  })

  it('is not taken out again by a read that began while it was being made', async () => {
    const qc = roster()
    const id = await make()
    // A read from before it existed, still on its way.
    let land!: (list: Agent[]) => void
    const before = qc
      .fetchQuery({ queryKey: agentsKey, queryFn: () => new Promise<Agent[]>((r) => (land = r)), staleTime: 0 })
      .catch(() => {})
    await revealAgent(qc, id)
    land([agent('default', { name: 'Hermes', isDefault: true }), agent('zed', { name: 'Zed' })])
    await before
    expect(names(qc)).toEqual(['Hermes', 'Coder', 'Zed'])
  })

  it('is let in once, however many times it is revealed', async () => {
    const qc = roster()
    const id = await make()
    await revealAgent(qc, id)
    await revealAgent(qc, id)
    expect(names(qc)).toEqual(['Hermes', 'Coder', 'Zed'])
  })

  it('stays out of the roster when Hermes could not make it', async () => {
    const qc = roster()
    rpc.mockImplementation(async (method: string) => {
      if (method === 'profiles.create') throw new Error('Hermes said no')
      return { ok: true }
    })
    await expect(make()).rejects.toThrow('Hermes said no')
    await revealAgent(qc, 'coder')
    expect(names(qc)).toEqual(['Hermes', 'Zed'])
  })
})

describe('the roster kept on this device', () => {
  let kept: Map<string, string>
  const KEY = 'murmur:roster'
  const keep = (...agents: Agent[]) => kept.set(KEY, JSON.stringify({ version: __MURMUR_VERSION__, agents }))
  const keptIds = () => (JSON.parse(kept.get(KEY)!) as { agents: Agent[] }).agents.map((a) => a.id)
  const open = () => new QueryObserver(new QueryClient(), rosterQuery)
  const hermes = agent('default', { name: 'Hermes', isDefault: true })

  beforeEach(() => {
    kept = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => kept.get(key) ?? null,
      setItem: (key: string, value: string) => void kept.set(key, value),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is shown at once on a later open, and Hermes is read all the same', async () => {
    keep(hermes)
    const observer = open()
    expect(observer.getCurrentResult()).toMatchObject({ isPending: false, data: [{ id: 'default' }] })

    const off = observer.subscribe(() => {})
    await vi.waitFor(() => expect(observer.getCurrentResult().data?.map((a) => a.id)).toEqual(['default', 'zed']))
    expect(listProfiles).toHaveBeenCalled()
    expect(keptIds()).toEqual(['default', 'zed'])
    off()
  })

  it('leaves a first open waiting for Hermes, with nothing to show yet', () => {
    expect(open().getCurrentResult()).toMatchObject({ isPending: true, data: undefined })
  })

  it('is ignored when it can’t be read, or is empty', () => {
    kept.set(KEY, 'not json')
    expect(open().getCurrentResult().isPending).toBe(true)
    keep()
    expect(open().getCurrentResult().isPending).toBe(true)
  })

  it('is ignored when another version of Murmur kept it, as its agents may lack what this one needs', () => {
    kept.set(KEY, JSON.stringify({ version: '0.0.1', agents: [hermes] }))
    expect(open().getCurrentResult().isPending).toBe(true)
    // As the first kept rosters were, with no version at all.
    kept.set(KEY, JSON.stringify([hermes]))
    expect(open().getCurrentResult().isPending).toBe(true)
  })

  it('says no agent is gone, and names none to write to, till Hermes has answered', async () => {
    // Kept before Zed was made, and while Old was still there.
    keep(hermes, agent('old'))
    const observer = open()
    const before = observer.getCurrentResult()
    expect(saysGone(before, 'zed')).toBe(false)
    expect(asTheyAre(before)).toBeUndefined()

    const off = observer.subscribe(() => {})
    await vi.waitFor(() => expect(asTheyAre(observer.getCurrentResult())?.map((a) => a.id)).toEqual(['default', 'zed']))
    const after = observer.getCurrentResult()
    expect(saysGone(after, 'zed')).toBe(false)
    expect(saysGone(after, 'old')).toBe(true)
    off()
  })

  it('names the agents to write to once Hermes has answered, on a first open too', async () => {
    const observer = open()
    expect(asTheyAre(observer.getCurrentResult())).toBeUndefined()
    expect(saysGone(observer.getCurrentResult(), 'zed')).toBe(false)
    const off = observer.subscribe(() => {})
    await vi.waitFor(() => expect(asTheyAre(observer.getCurrentResult())?.map((a) => a.id)).toEqual(['default', 'zed']))
    off()
  })

  it('takes a change made before Hermes answers, so it still shows and lands (state/records.ts)', () => {
    keep(hermes, agent('zed', { name: 'Zed' }))
    const qc = new QueryClient()
    const observer = new QueryObserver(qc, rosterQuery)
    const off = observer.subscribe(() => {})
    qc.setQueryData<Agent[]>(agentsKey, (list) => list?.map((a) => (a.id === 'zed' ? { ...a, name: 'Zed 2' } : a)))
    expect(observer.getCurrentResult().data?.map((a) => a.name)).toEqual(['Hermes', 'Zed 2'])
    off()
  })
})

describe('hidden agents', () => {
  const flagged = (hidden: unknown) => toAgent({ name: 'zed', is_default: false, ui_meta: { 'hermes-bots': { hidden } } }, {}, {})

  it('are the ones flagged in the hermes-bots record, and no others', () => {
    expect(flagged(true).hidden).toBe(true)
    for (const v of [false, 'true', 1, null, undefined]) expect(flagged(v).hidden).toBe(false)
    expect(toAgent({ name: 'zed', is_default: false }, {}, {}).hidden).toBe(false)
  })

  it('are left out of the lists, the rest keeping their order', () => {
    const all = [agent('a'), agent('b', { hidden: true }), agent('c')]
    expect(visibleAgents(all).map((a) => a.id)).toEqual(['a', 'c'])
    expect(visibleAgents([agent('b', { hidden: true })])).toEqual([])
  })

  it('leave one visible agent alone in the roster, and none when all are hidden or all shown', () => {
    expect(soloOf([agent('a'), agent('b', { hidden: true })])?.id).toBe('a')
    expect(soloOf([agent('a'), agent('b')])).toBeUndefined()
    expect(soloOf([agent('a', { hidden: true }), agent('b', { hidden: true })])).toBeUndefined()
    expect(soloOf(undefined)).toBeUndefined()
  })

  it('stay in the roster itself, so chats, groups and mentions still find them', async () => {
    listProfiles.mockResolvedValue([
      { name: 'default', is_default: true },
      { name: 'zed', is_default: false, ui_meta: { 'hermes-bots': { hidden: true } } },
    ])
    const data = await new QueryClient().fetchQuery({ ...rosterQuery, staleTime: 0 })
    expect(data.map((a) => [a.id, a.hidden])).toEqual([
      ['default', false],
      ['zed', true],
    ])
  })
})

describe('hiding an agent', () => {
  const bots = { title: 'Zed', color: '#4f8', sectionId: 'work' }
  const zed = (more: Partial<Agent> = {}) => agent('zed', { botMeta: bots, metaRevisions: { 'hermes-bots': 4 }, ...more })
  const held = (qc: QueryClient) => qc.getQueryData<Agent[]>(agentsKey)!.find((a) => a.id === 'zed')!
  const setup = (z: Agent) => {
    const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
    qc.setQueryData<Agent[]>(agentsKey, [agent('default', { isDefault: true }), z])
    return qc
  }

  it('writes hidden into the hermes-bots record and keeps the rest of it', async () => {
    const qc = setup(zed())
    rpc.mockResolvedValue({ ok: true, applied: { ui_meta: true, ui_meta_revisions: { 'hermes-bots': 5 } } })
    await setAgentHidden(qc, 'zed', true)
    expect(rpc).toHaveBeenCalledExactlyOnceWith('profiles.configure', {
      name: 'zed',
      ui_meta: { 'hermes-bots': { ...bots, hidden: true } },
      ui_meta_expected_revisions: { 'hermes-bots': 4 },
    })
    expect(held(qc)).toMatchObject({ hidden: true, botMeta: { ...bots, hidden: true }, metaRevisions: { 'hermes-bots': 5 } })
  })

  it('unhides the same way', async () => {
    const qc = setup(zed({ hidden: true, botMeta: { ...bots, hidden: true } }))
    await setAgentHidden(qc, 'zed', false)
    expect(rpc.mock.calls[0][1].ui_meta).toEqual({ 'hermes-bots': { ...bots, hidden: false } })
    expect(held(qc).hidden).toBe(false)
  })

  it('on a conflict reads the record again and writes on top of it, not over it', async () => {
    const qc = setup(zed())
    listProfiles.mockResolvedValue([
      { name: 'zed', is_default: false, ui_meta: { 'hermes-bots': { ...bots, color: '#111', pinned: true } }, ui_meta_revisions: { 'hermes-bots': 5 } },
    ])
    rpc
      .mockResolvedValueOnce({ ok: true, applied: { ui_meta: false, ui_meta_conflicts: { 'hermes-bots': { expected: 4, actual: 5 } } } })
      .mockResolvedValueOnce({ ok: true, applied: { ui_meta: true, ui_meta_revisions: { 'hermes-bots': 6 } } })
    await setAgentHidden(qc, 'zed', true)
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc.mock.calls[1][1]).toEqual({
      name: 'zed',
      ui_meta: { 'hermes-bots': { ...bots, color: '#111', pinned: true, hidden: true } },
      ui_meta_expected_revisions: { 'hermes-bots': 5 },
    })
    expect(held(qc).hidden).toBe(true)
  })
})

describe('opening the chats of an agent', () => {
  const row = (id: string, more: object = {}) => ({ id, title: id, message_count: 2, started_at: 1, source: 'tui', ...more })
  const bot = (more: object = {}) => row('m', { title: 'Bot Chat', ...more })
  type P = { title?: string; include_hidden?: boolean }
  const lists = (shown: object[], all: object[], main: object[] = []) =>
    rpc.mockImplementation(async (_m: string, p: P) => ({ sessions: p.title ? main : p.include_hidden ? all : shown }))
  const ids = async () => (await fetchAgentChats('zed')).map((c) => c.id)

  it('makes exactly three session.list calls with these params', async () => {
    lists([row('a')], [row('a')])
    await fetchAgentChats('zed')
    expect(rpc.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ['session.list', { profile: 'zed', limit: 60 }],
      ['session.list', { profile: 'zed', limit: 60, include_hidden: true }],
      ['session.list', { profile: 'zed', title: 'Bot Chat', include_hidden: true }],
    ])
  })

  it('puts the main chat first when it is newer than everything', async () => {
    lists([row('a'), row('b')], [bot(), row('a'), row('b')], [bot()])
    expect(await ids()).toEqual(['m', 'a', 'b'])
  })

  it('puts it in the middle where activity order says', async () => {
    lists([row('a'), row('b')], [row('a'), bot(), row('b')], [bot()])
    const out = await fetchAgentChats('zed')
    expect(out.map((c) => c.id)).toEqual(['a', 'm', 'b'])
    expect(out[1]).toMatchObject({ main: true, title: 'Main chat' })
  })

  it('puts it last when it is older than the window', async () => {
    lists([row('a'), row('b')], [row('a'), row('b')], [bot()])
    expect(await ids()).toEqual(['a', 'b', 'm'])
  })

  it('keeps other hidden chats out', async () => {
    lists([row('a')], [row('a'), row('h')])
    expect(await ids()).toEqual(['a'])
  })

  it('uses resolved_id for the main chat and does not list it twice', async () => {
    lists([row('a'), row('r')], [row('a'), bot({ id: 'old', resolved_id: 'r' })], [bot({ id: 'old', resolved_id: 'r' })])
    const out = await fetchAgentChats('zed')
    expect(out.map((c) => c.id)).toEqual(['a', 'r'])
    expect(out[1].main).toBe(true)
  })

  it('when the include_hidden call fails, still finds the main chat and puts it last', async () => {
    rpc.mockImplementation(async (_m: string, p: P) => {
      if (p.include_hidden && !p.title) throw new Error('boom')
      return { sessions: p.title ? [bot()] : [row('a')] }
    })
    expect(await ids()).toEqual(['a', 'm'])
  })

  it('when the title lookup fails, lists the chats without a main one', async () => {
    rpc.mockImplementation(async (_m: string, p: P) => {
      if (p.title) throw new Error('boom')
      return { sessions: [row('a')] }
    })
    expect(await ids()).toEqual(['a'])
  })

  it('when the plain listing fails, fails', async () => {
    rpc.mockImplementation(async (_m: string, p: P) => {
      if (!p.include_hidden) throw new Error('boom')
      return { sessions: [] }
    })
    await expect(fetchAgentChats('zed')).rejects.toThrow('boom')
  })
})

describe('the chats kept on this device', () => {
  let kept: Map<string, string>
  const KEY = 'murmur:chats'
  const chat = (id: string, more: object = {}) => ({
    id,
    title: id,
    preview: '',
    startedAt: 0,
    messageCount: 0,
    source: '',
    at: 5,
    ...more,
  })

  beforeEach(() => {
    kept = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => kept.get(key) ?? null,
      setItem: (key: string, value: string) => void kept.set(key, value),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('is not what other readers of an agent’s chats start from', () => {
    keepChats('zed', [chat('a')])
    expect(new QueryClient().getQueryData(['chats', 'zed'])).toBeUndefined()
  })

  it('lets go of one chat the person archived or deleted, so it does not come back on the next open', () => {
    keepChats('zed', [chat('a'), chat('b')])
    dropKeptChat('zed', 'a')
    expect(keptChats('zed')?.map((c) => c.id)).toEqual(['b'])
    dropKeptChat('zed', 'b')
    expect(keptChats('zed')).toBeUndefined()
  })

  it('keeps what the row shows, a routine’s line too, and no more', () => {
    keepChats('zed', [
      chat('m', { main: true, preview: 'hello', pinned: true, latest: true, busy: 'working', messageCount: 9 }),
      chat('r', { routine: true, result: true, preview: 'found it', source: 'routine' }),
      chat('b', { preview: 'secret words' }),
    ])
    const out = keptChats('zed')!
    expect(out.map((c) => [c.id, c.preview, c.routine, c.main, c.pinned, c.latest, c.at])).toEqual([
      ['m', 'hello', undefined, true, true, true, 5],
      ['r', 'found it', true, undefined, undefined, undefined, 5],
      ['b', '', undefined, undefined, undefined, undefined, 5],
    ])
    expect(JSON.stringify([...kept.values()])).not.toMatch(/secret|busy/)
  })

  it('keeps at most 60 rows an agent', () => {
    keepChats(
      'zed',
      Array.from({ length: 80 }, (_, i) => chat(`c${i}`)),
    )
    expect(keptChats('zed')).toHaveLength(60)
  })

  it('is forgotten with its agent, and only its agent', async () => {
    keepChats('zed', [chat('a')])
    keepChats('old', [chat('b')])
    await deleteAgent(agent('old'))
    expect(keptChats('old')).toBeUndefined()
    expect(keptChats('zed')).toHaveLength(1)
  })

  it('is ignored when unreadable, of another version, or empty', () => {
    kept.set(KEY, 'not json')
    expect(keptChats('zed')).toBeUndefined()
    kept.set(KEY, JSON.stringify({ version: '0.0.1', chats: { zed: [chat('a')] } }))
    expect(keptChats('zed')).toBeUndefined()
    kept.set(KEY, JSON.stringify({ version: __MURMUR_VERSION__, chats: { zed: 'x' } }))
    expect(keptChats('zed')).toBeUndefined()
    keepChats('zed', [])
    expect(keptChats('zed')).toBeUndefined()
  })

  it('does not throw when the browser won’t keep it', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      },
    })
    expect(() => keepChats('zed', [chat('a')])).not.toThrow()
  })
})
