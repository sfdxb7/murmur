import { beforeEach, describe, expect, it, vi } from 'vitest'
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

const { fetchAgentChats } = await import('./agents')
const { scanRoutineResults } = await import('./routines')
const { openChat, useChats } = await import('./chats')

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

describe('openChat', () => {
  it('paints the latest page before the rest of a long history arrives', async () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({
      id: i + 1,
      role: i % 2 ? 'assistant' : 'user',
      content: `message ${i + 1}`,
      timestamp: i,
    }))
    const limits: number[] = []
    get.mockImplementation(async (path: string) => {
      const limit = Number(new URL(path, 'http://murmur').searchParams.get('limit'))
      limits.push(limit)
      return { messages: [...rows].reverse().slice(0, limit) }
    })
    rpc.mockImplementation(async (method: string) => (method === 'session.resume' ? { session_id: 'runtime' } : {}))
    const counts: number[] = []
    const unsub = useChats.subscribe((s) => {
      const chat = s.chats['chat-1']
      if (chat?.ready) counts.push(chat.items.length)
    })
    await openChat('chat-1', 'default')
    unsub()
    expect(limits).toEqual([60, 500])
    expect(counts[0]).toBe(60)
    expect(counts.at(-1)).toBe(200)
  })
})
