import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { takeTurn } from './turns'

const started = (p: Promise<() => void>) => {
  const box: { done?: () => void } = {}
  void p.then((done) => (box.done = done))
  return box
}
const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms)

describe('takeTurn', () => {
  beforeEach(() => void vi.useFakeTimers())
  afterEach(() => void vi.useRealTimers())

  it('lets panels go only a few at a time', async () => {
    const all = Array.from({ length: 5 }, () => started(takeTurn('GET', '/api/mcp/catalog')))
    await tick()
    expect(all.filter((a) => a.done)).toHaveLength(3)
    all[0].done!()
    await tick()
    expect(all.filter((a) => a.done)).toHaveLength(4)
    all[1].done!()
    await tick()
    for (const a of all.slice(2)) a.done!()
  })

  it('holds panels while chats load, and releases them when chats finish', async () => {
    const chats = await takeTurn('GET', '/api/sessions?profile=a&limit=60')
    const panel = started(takeTurn('GET', '/api/learning/graph'))
    await tick()
    expect(panel.done).toBeUndefined()
    chats()
    await tick()
    expect(panel.done).toBeDefined()
    panel.done!()
  })

  it('never holds a panel past the head start, however long chats take', async () => {
    const chats = await takeTurn('GET', '/api/sessions/abc/messages')
    const panel = started(takeTurn('GET', '/api/model/options'))
    await tick(1499)
    expect(panel.done).toBeUndefined()
    await tick(1)
    expect(panel.done).toBeDefined()
    panel.done!()
    chats()
  })

  it('holds low-priority session reads like panels, without counting them as chats', async () => {
    const all = Array.from({ length: 4 }, () => started(takeTurn('GET', '/api/sessions/cron_1/messages', { priority: 'low' })))
    await tick()
    expect(all.filter((a) => a.done)).toHaveLength(3)
    all[0].done!()
    await tick()
    expect(all.filter((a) => a.done)).toHaveLength(4)
    for (const a of all.slice(1)) a.done!()
    const panel = started(takeTurn('GET', '/api/env'))
    await tick()
    expect(panel.done).toBeDefined()
    panel.done!()
  })

  it('never holds writes, deadlines, or anything else', async () => {
    const chats = await takeTurn('GET', '/api/sessions')
    const signal = new AbortController().signal
    for (const p of [
      takeTurn('POST', '/api/mcp/servers'),
      takeTurn('GET', '/api/mcp/catalog', { signal }),
      takeTurn('GET', '/api/config'),
      takeTurn('POST', '/api/sessions'),
    ])
      expect(typeof (await p)).toBe('function')
    chats()
  })

  it('counts a finished write as no chat at all', async () => {
    const write = await takeTurn('POST', '/api/sessions')
    write()
    const panel = started(takeTurn('GET', '/api/env'))
    await tick()
    expect(panel.done).toBeDefined()
    panel.done!()
  })
})
