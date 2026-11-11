import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChatItem } from '@/features/chat/types'

vi.stubGlobal('document', { cookie: '' })

const {
  CACHED_PAGE,
  MAX_BYTES,
  MAX_CHATS,
  clearAllSnapshots,
  forgetSnapshotsForHermes,
  measure,
  memoryChatCache,
  prune,
  readSnapshots,
  resetChatCacheForTests,
  slimItems,
  snapshotOf,
  useChatCacheDriver,
  writeSnapshot,
} = await import('./chat-cache')

const at = (n: number) => n

const user = (id: string, text: string, extra: Partial<Extract<ChatItem, { kind: 'user' }>> = {}): ChatItem => ({
  kind: 'user',
  id,
  text,
  at: 1,
  ...extra,
})

afterEach(() => {
  resetChatCacheForTests()
})

describe('what a cache may keep', () => {
  it('keeps ordinary messages and drops vault prompts, card details, and pending asks', () => {
    const items = slimItems([
      user('u1', 'Hello'),
      { kind: 'assistant', id: 'a1', text: 'Hi', streaming: true, at: 2 },
      {
        kind: 'secret',
        id: 's1',
        requestId: 'req-secret',
        ask: 'login',
        prompt: 'Password for github.com',
        status: 'pending',
      },
      {
        kind: 'approval',
        id: 'ap1',
        requestId: 'req-pay',
        title: 'Pay with a saved card',
        status: 'approved',
        choices: [],
        command: 'stripe pay --card tok_live_secret',
        payment: { card: 'Visa •••• 4242', host: 'shop.example' },
        email: { from: 'me@here', to: ['a@b.c'], cc: [], bcc: [], subject: 'Hi', body: 'secret invoice' },
      },
      {
        kind: 'approval',
        id: 'ap2',
        requestId: 'req-open',
        title: 'Run a command',
        status: 'pending',
        choices: [],
        command: 'rm -rf /',
      },
      {
        kind: 'clarify',
        id: 'c1',
        requestId: 'req-c',
        questions: [{ qid: 'q', question: 'Which one?' }],
        status: 'answered',
        answers: { q: 'the private one' },
      },
    ])
    expect(items.map((i) => `${i.kind}:${i.id}`)).toEqual(['user:u1', 'assistant:a1', 'approval:ap1', 'clarify:c1'])
    const assistant = items[1]
    expect(assistant.kind === 'assistant' && assistant.streaming).toBe(false)
    const approved = items[2]
    expect(approved.kind === 'approval' && approved.requestId).toBe('')
    expect(approved.kind === 'approval' && approved.command).toBeUndefined()
    expect(approved.kind === 'approval' && approved.payment).toBeUndefined()
    expect(approved.kind === 'approval' && approved.email).toBeUndefined()
    const clarify = items[3]
    expect(clarify.kind === 'clarify' && clarify.answers).toBeUndefined()
    expect(clarify.kind === 'clarify' && clarify.requestId).toBe('')
  })

  it('does not keep an unsent line, or a picture inlined as a data URL', () => {
    const items = slimItems([
      user('draft', 'Still typing', { pending: true }),
      user('pic', 'Look', {
        images: ['data:image/png;base64,AAAA', '/opt/data/images/kept.jpg'],
        attachments: [
          { kind: 'image', name: 'shot.png', url: 'data:image/png;base64,BBBB' },
          { kind: 'image', name: 'saved.jpg', path: '/opt/data/images/saved.jpg' },
        ],
      }),
    ])
    expect(items).toHaveLength(1)
    const pic = items[0]
    expect(pic.kind === 'user' && pic.images).toEqual(['/opt/data/images/kept.jpg'])
    expect(pic.kind === 'user' && pic.attachments).toEqual([{ kind: 'image', name: 'saved.jpg', path: '/opt/data/images/saved.jpg' }])
  })

  it('marks a running step as finished, so a reload does not leave it spinning', () => {
    const items = slimItems([
      {
        kind: 'tool',
        id: 't1',
        name: 'web_search',
        label: 'Searching the web',
        status: 'running',
        startedAt: 10,
      },
    ])
    expect(items[0]).toMatchObject({ kind: 'tool', status: 'done', endedAt: 10 })
  })

  it('keeps only the newest page when a chat was scrolled further back', () => {
    const many = Array.from({ length: CACHED_PAGE + 40 }, (_, i) => user(`u${i}`, `n${i}`))
    const items = slimItems(many)
    expect(items).toHaveLength(CACHED_PAGE)
    expect(items[0]).toMatchObject({ id: 'u40' })
    expect(items.at(-1)).toMatchObject({ id: `u${CACHED_PAGE + 39}` })
    const snap = snapshotOf({ id: 'long', profile: 'default', items: many, older: false })
    expect(snap?.older).toBe(true)
    expect(snap?.items).toHaveLength(CACHED_PAGE)
  })
})

describe('the size bound', () => {
  it('evicts the least recently opened chats first, and will not grow past the cap', () => {
    const entry = (id: string, access: number, bytes = 100): ReturnType<typeof snapshotOf> extends infer T ? NonNullable<T> : never =>
      ({
        key: `murmur:chats:default:${id}`,
        id,
        profile: 'default',
        items: [user(id, 'x')],
        savedAt: access,
        lastAccess: access,
        bytes,
      })
    const kept = prune([
      entry('old', 1),
      entry('mid', 2),
      entry('new', 3),
      ...Array.from({ length: MAX_CHATS }, (_, i) => entry(`keep-${i}`, 10 + i)),
    ])
    expect(kept).toHaveLength(MAX_CHATS)
    expect(kept.map((e) => e.id)).not.toContain('old')
    expect(kept.map((e) => e.id)).not.toContain('mid')
    expect(kept.some((e) => e.id === 'new' || e.id.startsWith('keep-'))).toBe(true)
  })

  it('drops a chat that would push the store over the byte cap, and refuses one that is already too large', () => {
    const small = {
      key: 'a',
      id: 'a',
      profile: 'default',
      items: [user('a', 'hi')],
      savedAt: 2,
      lastAccess: 2,
      bytes: 100,
    }
    const huge = { ...small, key: 'b', id: 'b', lastAccess: 1, savedAt: 1, bytes: MAX_BYTES }
    const over = { ...small, key: 'c', id: 'c', lastAccess: 3, savedAt: 3, bytes: MAX_BYTES + 1 }
    expect(prune([small, huge]).map((e) => e.id)).toEqual(['a'])
    expect(prune([over])).toEqual([])
  })
})

describe('writing and reading on a stand-in store', () => {
  it('round-trips a snapshot, then evicts the oldest once the count cap is reached', async () => {
    const mem = memoryChatCache()
    useChatCacheDriver(mem)
    for (let i = 0; i < MAX_CHATS + 3; i++) {
      await writeSnapshot(
        { id: `c${i}`, profile: 'default', items: [user(`u${i}`, `hello ${i}`)], named: true, title: `Chat ${i}` },
        at(i + 1),
      )
    }
    const all = await readSnapshots()
    expect(all).toHaveLength(MAX_CHATS)
    expect(all.map((e) => e.id)).not.toContain('c0')
    expect(all.map((e) => e.id)).toContain(`c${MAX_CHATS + 2}`)
    const one = all.find((e) => e.id === `c${MAX_CHATS + 2}`)
    expect(one?.title).toBe(`Chat ${MAX_CHATS + 2}`)
    expect(one?.items).toEqual([user(`u${MAX_CHATS + 2}`, `hello ${MAX_CHATS + 2}`)])
  })

  it('clears everything on sign-out, and only one Hermes when that Hermes is removed', async () => {
    const mem = memoryChatCache()
    useChatCacheDriver(mem)
    await writeSnapshot({ id: 'mine', profile: 'default', items: [user('u', 'hi')] }, 1)
    mem.records.set('murmur@other:chats:default:theirs', {
      key: 'murmur@other:chats:default:theirs',
      id: 'theirs',
      profile: 'default',
      items: [user('t', 'there')],
      savedAt: 1,
      lastAccess: 1,
      bytes: 10,
    })
    await forgetSnapshotsForHermes('other')
    expect((await readSnapshots()).map((e) => e.id)).toEqual(['mine'])
    await clearAllSnapshots()
    expect(await readSnapshots()).toEqual([])
  })

  it('is a no-op when storage is unavailable', async () => {
    useChatCacheDriver({
      all: async () => {
        throw new Error('private')
      },
      put: async () => {
        throw new Error('private')
      },
      remove: async () => {
        throw new Error('private')
      },
      clear: async () => {
        throw new Error('private')
      },
    })
    await expect(writeSnapshot({ id: 'x', profile: 'default', items: [user('u', 'hi')] })).resolves.toBeUndefined()
    await expect(readSnapshots()).resolves.toEqual([])
    await expect(clearAllSnapshots()).resolves.toBeUndefined()
  })
})

describe('cold-open cost', () => {
  it('hydrates a first page of messages in well under a frame, without secrets', () => {
    const items: ChatItem[] = []
    const turns = CACHED_PAGE / 2
    for (let i = 0; i < turns; i++) {
      items.push(user(`u${i}`, `A short message ${i}`))
      items.push({ kind: 'assistant', id: `a${i}`, text: `A short reply ${i}`, streaming: false, at: i })
      if (i % 5 === 0) {
        items.push({
          kind: 'secret',
          id: `s${i}`,
          requestId: 'secret',
          ask: 'login',
          status: 'pending',
        })
      }
    }
    const raw = snapshotOf({ id: 'builder', profile: 'default', items, title: 'Build the app' })
    expect(raw).toBeTruthy()
    expect(raw!.items.some((i) => i.kind === 'secret')).toBe(false)
    const t0 = performance.now()
    const parsed = JSON.parse(JSON.stringify(raw)) as NonNullable<typeof raw>
    const applied = parsed.items
    const ms = performance.now() - t0
    expect(applied).toHaveLength(raw!.items.length)
    expect(applied.filter((i) => i.kind === 'user' || i.kind === 'assistant').length).toBe(CACHED_PAGE)
    expect(ms).toBeLessThan(16)
    // eslint-disable-next-line no-console
    console.log(
      `chat-cache cold hydrate (JSON parse of ${CACHED_PAGE} messages, ${measure(raw)} bytes): ${ms.toFixed(2)}ms`,
    )
  })
})
