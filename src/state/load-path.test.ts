import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile } from './agents'
import type { RoutineRun } from './routines'

const store = new Map<string, string>()
const g = globalThis as { document?: { cookie: string }; localStorage?: Storage; sessionStorage?: Storage }
g.document = { cookie: '' }
const memoryStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value)
  },
  removeItem: (key: string) => {
    store.delete(key)
  },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage
g.localStorage = memoryStorage
g.sessionStorage = memoryStorage

const rpc = vi.fn()
const get = vi.fn()
vi.mock('@/hermes/gateway', () => ({
  rpc: (...args: unknown[]) => rpc(...args),
  gateway: { onEvent: () => () => {}, onRequest: () => () => {}, onState: () => () => {} },
}))
vi.mock('@/hermes/rest', () => ({
  api: { get: (...args: unknown[]) => get(...args) },
  HermesError: class HermesError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  },
}))

const { afterRosterPaint, fetchAgentChats, placeLastChats, ROSTER_PREVIEW_DELAY } = await import('./agents')
const { scanRoutineResults } = await import('./routines')
const { loadOlder, openChat, useChats } = await import('./chats')

const run = (id: string, routineId: string, at: number): RoutineRun => ({
  id,
  routineId,
  routineName: routineId,
  at,
  lastAt: at,
  finished: true,
  messageCount: 2,
})

beforeEach(() => {
  rpc.mockReset()
  get.mockReset()
  useChats.setState({ chats: {} })
})

describe('fetchAgentChats', () => {
  it('asks for the hidden list once, and skips the title lookup when Bot Chat is in it', async () => {
    rpc.mockImplementation(async (_method: string, params: { include_hidden?: boolean }) => {
      if (params.include_hidden) {
        return {
          sessions: [
            { id: 'a', title: 'Trip', message_count: 2, preview: 'pack', started_at: 3, source: 'desktop' },
            { id: 'bot', title: 'Bot Chat', message_count: 2, preview: 'hi', started_at: 2 },
          ],
        }
      }
      return { sessions: [{ id: 'a', title: 'Trip', message_count: 2, preview: 'pack', started_at: 3, source: 'desktop' }] }
    })
    const chats = await fetchAgentChats('atlas')
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(chats.map((c) => c.title)).toEqual(['Trip', 'Main chat'])
  })

  it('looks Bot Chat up by title only when the window missed it', async () => {
    rpc.mockImplementation(async (_method: string, params: { include_hidden?: boolean; title?: string }) => {
      if (params.title) return { sessions: [{ id: 'bot', title: 'Bot Chat', message_count: 2, preview: 'hi', started_at: 1 }] }
      if (params.include_hidden) return { sessions: [{ id: 'a', title: 'Trip', message_count: 2, preview: 'pack', started_at: 3, source: 'desktop' }] }
      return { sessions: [{ id: 'a', title: 'Trip', message_count: 2, preview: 'pack', started_at: 3, source: 'desktop' }] }
    })
    const chats = await fetchAgentChats('atlas')
    expect(rpc).toHaveBeenCalledTimes(3)
    expect(chats.some((c) => c.main)).toBe(true)
  })
})

describe('scanRoutineResults', () => {
  it('stops a routine at its first result and still reads the others', async () => {
    const calls: string[] = []
    const found = await scanRoutineResults(
      [run('a1', 'a', 3), run('a2', 'a', 2), run('a3', 'a', 1), run('b1', 'b', 4)],
      async (next) => {
        calls.push(next.id)
        if (next.id === 'a1' || next.id === 'b1') return { text: '', quiet: true, replied: false }
        return { text: `said ${next.id}`, quiet: false, replied: false }
      },
    )
    expect(calls.filter((id) => id.startsWith('a'))).toEqual(['a1', 'a2'])
    expect(calls).toContain('b1')
    expect(found.get('a2')?.text).toBe('said a2')
    expect(found.has('a3')).toBe(false)
  })
})

const history = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    role: i % 2 ? 'assistant' : 'user',
    content: `message ${i + 1}`,
    timestamp: i,
  }))

/** `order=latest`: skip `offset` newest rows, then take `limit`, newest first. */
function pageOf(rows: { id: number }[], path: string) {
  const url = new URL(path, 'http://murmur')
  const limit = Number(url.searchParams.get('limit'))
  const offset = Number(url.searchParams.get('offset') ?? 0)
  return { limit, offset, messages: [...rows].reverse().slice(offset, offset + limit) }
}

describe('placeLastChats', () => {
  it('reads one agent at a time, where eight used to be in flight together', async () => {
    let inflight = 0
    let peak = 0
    get.mockImplementation(async () => {
      inflight += 1
      peak = Math.max(peak, inflight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inflight -= 1
      return { source: 'desktop' }
    })
    const profiles = Array.from({ length: 8 }, (_, i) => ({
      name: `agent-${i}`,
      is_default: i === 0,
      last_session: { id: `s${i}`, preview: 'hello', last_active: 1 },
    }))
    await placeLastChats(profiles as Profile[])
    expect(peak).toBe(1)
    expect(get).toHaveBeenCalledTimes(8)
  })

  it('gives the roster 800ms before a routine preview can start', async () => {
    vi.useFakeTimers()
    try {
      const pending = afterRosterPaint()
      let done = false
      pending.then(() => {
        done = true
      })
      await vi.advanceTimersByTimeAsync(ROSTER_PREVIEW_DELAY - 1)
      expect(done).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await pending
      expect(done).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('still prefers a chat that said something over a quiet routine', async () => {
    get.mockImplementation(async (path: string) => {
      if (path.includes('/messages')) return { messages: [] }
      if (path.includes('/api/sessions?')) {
        return {
          sessions: [
            { id: 'cron-1', source: 'cron', preview: '[IMPORTANT: brief', last_active: 2 },
            { id: 'talk', source: 'desktop', preview: 'see you there', last_active: 1 },
          ],
        }
      }
      return { source: 'cron' }
    })
    const [placed] = await placeLastChats([
      { name: 'ada', is_default: true, last_session: { id: 'cron-0', preview: '[IMPORTANT: brief', last_active: 3 } },
    ] as Profile[])
    expect(placed.last_session).toMatchObject({ id: 'talk', source: 'desktop' })
  })
})

describe('openChat', () => {
  it('paints the newest page and loads older ones only when asked', async () => {
    const rows = history(200)
    const calls: { limit: number; offset: number }[] = []
    get.mockImplementation(async (path: string) => {
      const page = pageOf(rows, path)
      calls.push({ limit: page.limit, offset: page.offset })
      return { messages: page.messages }
    })
    rpc.mockImplementation(async (method: string) => (method === 'session.resume' ? { session_id: 'runtime' } : {}))
    const counts: number[] = []
    const unsub = useChats.subscribe((s) => {
      const chat = s.chats['chat-1']
      if (chat?.ready) counts.push(chat.items.length)
    })
    await openChat('chat-1', 'default')
    unsub()
    // Was limit 60 followed at once by limit 500. Resume patches the same page again.
    expect(calls).toEqual([{ limit: 60, offset: 0 }])
    expect(counts[0]).toBe(60)
    expect(counts.every((n) => n === 60)).toBe(true)
    const first = useChats.getState().chats['chat-1'].items
    expect(first[0]).toMatchObject({ text: 'message 141' })
    expect(first.at(-1)).toMatchObject({ text: 'message 200' })

    expect(await loadOlder('chat-1')).toBe(true)
    expect(calls[1]).toEqual({ limit: 60, offset: 60 })
    expect(useChats.getState().chats['chat-1'].items[0]).toMatchObject({ text: 'message 81' })
    expect(await loadOlder('chat-1')).toBe(true)
    expect(await loadOlder('chat-1')).toBe(false)
    const all = useChats.getState().chats['chat-1'].items
    expect(all).toHaveLength(200)
    expect(all[0]).toMatchObject({ text: 'message 1' })
    expect(calls.map((call) => call.limit)).not.toContain(500)
    const before = calls.length
    expect(await loadOlder('chat-1')).toBe(false)
    expect(calls).toHaveLength(before)
  })

  it('stops at the same 500-row window a full page used to load', async () => {
    const rows = history(600)
    const calls: { limit: number; offset: number }[] = []
    get.mockImplementation(async (path: string) => {
      const page = pageOf(rows, path)
      calls.push({ limit: page.limit, offset: page.offset })
      return { messages: page.messages }
    })
    rpc.mockResolvedValue({ session_id: 'runtime-long' })
    await openChat('chat-long', 'default')
    let more = true
    while (more) more = await loadOlder('chat-long')
    const items = useChats.getState().chats['chat-long'].items
    expect(items).toHaveLength(500)
    expect(items[0]).toMatchObject({ text: 'message 101' })
    expect(items.at(-1)).toMatchObject({ text: 'message 600' })
    expect(calls.every((call) => call.limit <= 60)).toBe(true)
    expect(calls.at(-1)).toEqual({ limit: 20, offset: 480 })
  })

  it('joins a tool call above the first page to its result once that page loads', async () => {
    const rows: {
      id: number
      role: string
      content?: string
      timestamp: number
      tool_calls?: { id: string; function: { name: string; arguments: string } }[]
      tool_call_id?: string
    }[] = history(70)
    rows[9] = {
      id: 10,
      role: 'assistant',
      content: '',
      timestamp: 9,
      tool_calls: [{ id: 'c1', function: { name: 'terminal', arguments: '{}' } }],
    }
    rows[10] = { id: 11, role: 'tool', tool_call_id: 'c1', content: '{"output":"ok","exit_code":0}', timestamp: 10 }
    get.mockImplementation(async (path: string) => ({ messages: pageOf(rows, path).messages }))
    rpc.mockResolvedValue({ session_id: 'runtime-tool' })
    await openChat('chat-tool', 'default')
    expect(useChats.getState().chats['chat-tool'].items.some((item) => item.kind === 'tool')).toBe(false)
    await loadOlder('chat-tool')
    const tool = useChats.getState().chats['chat-tool'].items.find((item) => item.kind === 'tool')
    expect(tool).toMatchObject({ status: 'done', name: 'terminal' })
  })
})
