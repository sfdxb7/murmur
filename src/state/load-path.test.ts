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
const socket = { state: 'open' }
const get = vi.fn()
const stateListeners: ((state: string) => void)[] = []
vi.mock('@/hermes/gateway', () => ({
  rpc: (...args: unknown[]) => rpc(...args),
  gateway: {
    get connectionState() {
      return socket.state
    },
    onEvent: () => () => {},
    onRequest: () => () => {},
    onState: (fn: (state: string) => void) => {
      stateListeners.push(fn)
      return () => {}
    },
  },
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
const { loadOlder, openChat, regenerate, retry, send, unsentText, useChats, wireChats } = await import('./chats')
const { HermesError } = await import('@/hermes/rest')

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
    expect(useChats.getState().chats['chat-1'].olderHidden).toBeUndefined()
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
    expect(calls.at(-2)).toEqual({ limit: 20, offset: 480 })
    // One row past the window, to know there's more above it.
    expect(calls.at(-1)).toEqual({ limit: 1, offset: 500 })
    // The thread says so at the top, rather than passing message 101 off as the beginning.
    expect(useChats.getState().chats['chat-long'].olderHidden).toBe(true)
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

describe('a reply that finished while the connection was down', () => {
  it('shows once the socket is back, without a reload', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] })
    // The reconnect waits on the page's own timer.
    vi.stubGlobal('window', globalThis)
    try {
      wireChats()
      let rows = history(4)
      get.mockImplementation(async (path: string) => ({ messages: pageOf(rows, path).messages }))
      rpc.mockImplementation(async (method: string) => {
        if (method === 'session.resume') return { session_id: 'runtime-2', running: false, status: 'idle' }
        if (method === 'prompt.submit') return { user_row_id: 5 }
        return {}
      })
      await openChat('chat-2', 'default')
      await send('chat-2', 'Reply with the single word: pong')
      // The socket drops before any of the turn's events arrive, the run
      // finishes and is saved, and the replay can't bring it back.
      rows = [...rows, { id: 5, role: 'user', content: 'Reply with the single word: pong', timestamp: 5 }, { id: 6, role: 'assistant', content: 'pong', timestamp: 6 }]
      await vi.advanceTimersByTimeAsync(5000)
      for (const fn of stateListeners) fn('open')
      await vi.advanceTimersByTimeAsync(2000)
      const chat = useChats.getState().chats['chat-2']
      expect(chat.status).toBe('idle')
      const items = chat.items.filter((i) => i.kind === 'user' || i.kind === 'assistant')
      expect(items.map((i) => ('text' in i ? i.text : ''))).toEqual([
        'message 1',
        'message 2',
        'message 3',
        'message 4',
        'Reply with the single word: pong',
        'pong',
      ])
    } finally {
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })
})

describe('a chat of exactly 500 messages', () => {
  it('reaches its first message without saying older ones are hidden', async () => {
    const rows = history(500)
    get.mockImplementation(async (path: string) => ({ messages: pageOf(rows, path).messages }))
    rpc.mockResolvedValue({ session_id: 'runtime-500' })
    await openChat('chat-500', 'default')
    let more = true
    while (more) more = await loadOlder('chat-500')
    const chat = useChats.getState().chats['chat-500']
    expect(chat.items[0]).toMatchObject({ text: 'message 1' })
    expect(chat.olderHidden).toBeUndefined()
  })
})

describe('Try again after a send failed', () => {
  const finish = (id: string) =>
    useChats.setState((s) => ({ chats: { ...s.chats, [id]: { ...s.chats[id], status: 'idle' } } }))

  it('remembers the saved message, so the next Try again replaces the reply instead of asking twice', async () => {
    get.mockImplementation(async (path: string) => ({ messages: pageOf(history(2), path).messages }))
    let submits = 0
    rpc.mockImplementation(async (method: string) => {
      if (method === 'session.resume') return { session_id: 'runtime-r' }
      if (method === 'prompt.submit' && ++submits === 1) throw new Error('socket closed')
      if (method === 'prompt.submit') return { user_row_id: 3 }
      return {}
    })
    await openChat('chat-r', 'default')
    await send('chat-r', 'hello')
    expect(useChats.getState().chats['chat-r'].items.at(-1)).toMatchObject({ kind: 'error', retryable: true })
    await retry('chat-r')
    finish('chat-r')
    await regenerate('chat-r')
    const submitted = rpc.mock.calls.filter(([method]) => method === 'prompt.submit').map(([, params]) => params)
    expect(submitted).toHaveLength(3)
    expect(submitted[2]).toMatchObject({ text: 'hello', truncate_before_row_id: 3 })
  })

  it('sends the files again when they never got there', async () => {
    vi.stubGlobal(
      'FileReader',
      class {
        result = ''
        onload: (() => void) | null = null
        readAsDataURL() {
          this.result = 'data:text/plain;base64,aGk='
          queueMicrotask(() => this.onload?.())
        }
      },
    )
    try {
      get.mockImplementation(async (path: string) => ({ messages: pageOf(history(2), path).messages }))
      let attaches = 0
      rpc.mockImplementation(async (method: string) => {
        if (method === 'session.resume') return { session_id: 'runtime-f' }
        if (method === 'file.attach' && ++attaches === 1) throw new Error('upload failed')
        if (method === 'file.attach') return { ref_text: '@file:notes.txt' }
        if (method === 'prompt.submit') return { user_row_id: 3 }
        return {}
      })
      await openChat('chat-f', 'default')
      await send('chat-f', 'read this', [new File(['hi'], 'notes.txt', { type: 'text/plain' })])
      await retry('chat-f')
      const submitted = rpc.mock.calls.filter(([method]) => method === 'prompt.submit').map(([, params]) => params)
      expect(attaches).toBe(2)
      expect(submitted).toEqual([expect.objectContaining({ text: '@file:notes.txt\n\nread this' })])
      expect(useChats.getState().chats['chat-f'].items.some((item) => item.kind === 'error')).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('a chat whose history could not be read', () => {
  it('is not shown as empty, and loads once the connection is back', async () => {
    wireChats()
    let offline = true
    get.mockImplementation(async (path: string) => {
      if (offline) throw new HermesError(0, 'Can’t reach Hermes. Check that it’s running.')
      return { messages: pageOf(history(3), path).messages }
    })
    rpc.mockImplementation(async (method: string) => (method === 'session.resume' ? { session_id: 'runtime-o' } : {}))
    await openChat('chat-o', 'default')
    expect(useChats.getState().chats['chat-o']).toMatchObject({ ready: false, loadFailed: true, items: [] })
    offline = false
    for (const fn of stateListeners) fn('open')
    await vi.waitFor(() => expect(useChats.getState().chats['chat-o'].ready).toBe(true))
    const chat = useChats.getState().chats['chat-o']
    expect(chat.loadFailed).toBeUndefined()
    expect(chat.items.map((i) => ('text' in i ? i.text : ''))).toEqual(['message 1', 'message 2', 'message 3'])
  })

  it('still opens a chat Hermes has not saved yet as empty', async () => {
    get.mockRejectedValue(new HermesError(404, 'Not found'))
    rpc.mockImplementation(async (method: string) => (method === 'session.resume' ? { session_id: 'runtime-n' } : {}))
    await openChat('chat-n', 'default')
    expect(useChats.getState().chats['chat-n']).toMatchObject({ ready: true, items: [] })
  })
})

describe('a message sent with the connection down', () => {
  it('says it is waiting, and keeps its words until Hermes has them', async () => {
    get.mockImplementation(async (path: string) => ({ messages: pageOf(history(2), path).messages }))
    let submitted!: (value: { user_row_id: number }) => void
    rpc.mockImplementation((method: string) => {
      if (method === 'prompt.submit') return new Promise((resolve) => (submitted = resolve))
      return Promise.resolve(method === 'session.resume' ? { session_id: 'runtime-w' } : {})
    })
    await openChat('chat-w', 'default')
    socket.state = 'closed'
    try {
      const sending = send('chat-w', 'see you at 7')
      await vi.waitFor(() => expect(submitted).toBeTypeOf('function'))
      expect(useChats.getState().chats['chat-w'].items.at(-1)).toMatchObject({ kind: 'user', text: 'see you at 7', pending: true })
      // While its bubble is on screen the box doesn't take the words back; after a reload it does.
      expect(unsentText('chat-w')).toBe('')
      const shown = useChats.getState().chats
      useChats.setState({ chats: {} })
      expect(unsentText('chat-w')).toBe('see you at 7')
      useChats.setState({ chats: shown })
      socket.state = 'open'
      submitted({ user_row_id: 3 })
      await sending
      expect(useChats.getState().chats['chat-w'].items.at(-1)).toMatchObject({ text: 'see you at 7', rowId: 3 })
      expect(useChats.getState().chats['chat-w'].items.at(-1)).not.toHaveProperty('pending', true)
      useChats.setState({ chats: {} })
      expect(unsentText('chat-w')).toBe('')
    } finally {
      socket.state = 'open'
    }
  })
})
