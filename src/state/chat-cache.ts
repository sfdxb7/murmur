// A bound, on-device cache of recent chats' messages, so a cold open (a new
// tab, a PWA that was closed, the Mac app after quit) can paint what it already
// has, then refresh from Hermes in the background.
//
// IndexedDB, not localStorage: transcripts are larger than a few megabytes,
// and the origin already keeps one store per site (and per Electron app).
// Messages only — no session cookies, tokens, vault prompts, or card details.
// If IndexedDB is missing or blocked (some private windows), every call here
// is a no-op and the chat still loads from the network as it always did.

import { scoped } from '@/hermes/instance'
import type { ChatItem, Speaker, UserAttachment } from '@/features/chat/types'

/** How many chats this device will keep. The least recently opened drop first. */
export const MAX_CHATS = 20

/** Soft cap on what we store. A single chat that would go over is trimmed first. */
export const MAX_BYTES = 8 * 1024 * 1024

/** Same window as a first history read in state/chats.ts. */
export const CACHED_PAGE = 150

export const SCHEMA = 1

const DB_NAME = 'murmur-chat-cache'
const STORE = 'chats'

export type CachedChat = {
  key: string
  id: string
  profile: string
  items: ChatItem[]
  title?: string
  older?: boolean
  named?: boolean
  speaker?: Speaker
  savedAt: number
  lastAccess: number
  bytes: number
}

export type ChatSnapshot = {
  id: string
  profile: string
  items: ChatItem[]
  title?: string
  older?: boolean
  named?: boolean
  speaker?: Speaker
}

/** A stand-in for IndexedDB, so tests can run without a browser, and so a
 *  private window that refuses IndexedDB can still no-op cleanly. */
export type ChatCacheDriver = {
  all(): Promise<CachedChat[]>
  put(entry: CachedChat): Promise<void>
  remove(key: string): Promise<void>
  clear(): Promise<void>
}

const closed: ChatCacheDriver = {
  async all() {
    return []
  },
  async put() {},
  async remove() {},
  async clear() {},
}

let driver: ChatCacheDriver | undefined
let custom = false

export function cacheKey(profile: string, id: string) {
  return `${scoped('murmur:chats')}:${profile}:${id}`
}

/** Tests (and a failed open) can replace IndexedDB. */
export function useChatCacheDriver(next?: ChatCacheDriver | null) {
  custom = next != null
  driver = next ?? undefined
}

export function resetChatCacheForTests() {
  useChatCacheDriver(null)
}

function isCachedChat(value: unknown): value is CachedChat {
  if (!value || typeof value !== 'object') return false
  const v = value as CachedChat
  return typeof v.key === 'string' && typeof v.id === 'string' && typeof v.profile === 'string' && Array.isArray(v.items)
}

async function store(): Promise<ChatCacheDriver> {
  if (driver) return driver
  if (custom) return closed
  driver = await openIdb().catch(() => closed)
  return driver
}

function openIdb(): Promise<ChatCacheDriver> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('no indexedDB'))
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB_NAME, SCHEMA)
    } catch (e) {
      reject(e)
      return
    }
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'))
    req.onupgradeneeded = () => {
      const db = req.result
      // A schema bump starts clean: old entries may not be safe to read.
      if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE)
      db.createObjectStore(STORE, { keyPath: 'key' })
    }
    req.onsuccess = () => {
      const db = req.result
      const tx = (mode: IDBTransactionMode) => {
        const t = db.transaction(STORE, mode)
        return t.objectStore(STORE)
      }
      const ask = <T>(r: IDBRequest<T>) =>
        new Promise<T>((ok, err) => {
          r.onsuccess = () => ok(r.result)
          r.onerror = () => err(r.error ?? new Error('indexedDB request failed'))
        })
      resolve({
        all: async () => (await ask(tx('readonly').getAll())).filter(isCachedChat),
        put: (entry) => ask(tx('readwrite').put(entry)).then(() => {}),
        remove: (key) => ask(tx('readwrite').delete(key)).then(() => {}),
        clear: () => ask(tx('readwrite').clear()).then(() => {}),
      })
    }
  })
}

const isDataUrl = (s: string) => s.startsWith('data:')

function slimUrls(urls?: string[]) {
  const kept = (urls ?? []).filter((u) => typeof u === 'string' && u && !isDataUrl(u))
  return kept.length ? kept : undefined
}

function slimAttachment(a: UserAttachment): UserAttachment | null {
  if (a.kind === 'image') {
    const url = a.url && !isDataUrl(a.url) ? a.url : undefined
    if (!a.path && !url) return null
    return { kind: 'image', name: a.name, path: a.path, ...(url ? { url } : {}) }
  }
  return { kind: 'file', name: a.name, path: a.path, size: a.size }
}

/** Messages we can safely keep on the device: no vault prompts, no card details,
 *  no in-flight asks, no pending unsent lines, no inlined data: URLs. */
export function slimItems(items: ChatItem[]): ChatItem[] {
  const out: ChatItem[] = []
  for (const item of items) {
    const slim = slimItem(item)
    if (slim) out.push(slim)
  }
  // Keep the newest page if a long scroll brought more in; older pages stay on the server.
  return out.length > CACHED_PAGE ? out.slice(out.length - CACHED_PAGE) : out
}

function slimItem(item: ChatItem): ChatItem | null {
  switch (item.kind) {
    case 'secret':
      return null
    case 'user': {
      if (item.pending) return null
      const attachments = item.attachments?.map(slimAttachment).filter((a): a is UserAttachment => a != null)
      return {
        kind: 'user',
        id: item.id,
        text: item.text,
        at: item.at,
        rowId: item.rowId,
        was: item.was,
        reactions: item.reactions,
        images: slimUrls(item.images),
        attachments: attachments?.length ? attachments : undefined,
      }
    }
    case 'assistant':
      return {
        kind: 'assistant',
        id: item.id,
        text: item.text,
        streaming: false,
        at: item.at,
        speaker: item.speaker,
        rowId: item.rowId,
        reactions: item.reactions,
      }
    case 'thinking':
      return {
        kind: 'thinking',
        id: item.id,
        text: item.text,
        streaming: false,
        startedAt: item.startedAt,
        endedAt: item.endedAt,
        speaker: item.speaker,
      }
    case 'tool':
      return {
        kind: 'tool',
        id: item.id,
        name: item.name,
        label: item.label,
        detail: item.detail,
        status: item.status === 'running' ? 'done' : item.status,
        startedAt: item.startedAt,
        endedAt: item.endedAt ?? item.startedAt,
        speaker: item.speaker,
        media: slimUrls(item.media),
        found: item.found,
        shot: item.shot,
        callId: item.callId,
        app: item.app,
        took: item.took,
        routineId: item.routineId,
      }
    case 'approval':
      if (item.status === 'pending') return null
      return {
        kind: 'approval',
        id: item.id,
        requestId: '',
        approvalId: item.approvalId,
        title: item.title,
        prose: item.prose,
        tool: item.tool,
        choices: [],
        status: item.status,
        choice: item.choice,
        speaker: item.speaker,
      }
    case 'clarify':
      if (item.status === 'pending') return null
      return {
        kind: 'clarify',
        id: item.id,
        requestId: '',
        questions: item.questions,
        status: item.status,
        speaker: item.speaker,
      }
    case 'compaction':
      return {
        kind: 'compaction',
        id: item.id,
        status: item.status === 'running' ? 'done' : item.status,
        startedAt: item.startedAt,
        endedAt: item.endedAt,
        speaker: item.speaker,
      }
    case 'error':
      return { kind: 'error', id: item.id, message: item.message, retryable: item.retryable }
    case 'notice':
      return { kind: 'notice', id: item.id, text: item.text }
    case 'wake':
      return {
        kind: 'wake',
        id: item.id,
        reason: item.reason,
        at: item.at,
        rowId: item.rowId,
        delegationId: item.delegationId,
        helpers: item.helpers,
        failed: item.failed,
        took: item.took,
        subagentIds: item.subagentIds,
      }
    case 'finding':
      return {
        kind: 'finding',
        id: item.id,
        routineId: item.routineId,
        routine: item.routine,
        template: item.template,
        at: item.at,
        text: item.text,
        failed: item.failed,
      }
    case 'command':
      return {
        kind: 'command',
        id: item.id,
        command: item.command,
        output: item.output,
        status: item.status === 'running' ? 'done' : item.status,
      }
    case 'aside':
      return {
        kind: 'aside',
        id: item.id,
        taskId: item.taskId,
        question: item.question,
        answer: item.answer,
        status: item.status === 'pending' ? 'done' : item.status,
      }
    case 'plan':
      return { kind: 'plan', id: item.id, todos: item.todos, revision: item.revision }
    case 'helper':
      return {
        kind: 'helper',
        id: item.id,
        subagentId: item.subagentId,
        goal: item.goal,
        status: item.status === 'running' ? 'back' : item.status,
        line: item.line,
        tools: item.tools,
        startedAt: item.startedAt,
        endedAt: item.endedAt,
        summary: item.summary,
        delegationId: item.delegationId,
        background: item.background,
      }
  }
}

export function measure(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).length
}

/** Drop oldest entries until the set fits the caps. The most recently used stay. */
export function prune(entries: CachedChat[]): CachedChat[] {
  const ranked = [...entries].sort((a, b) => b.lastAccess - a.lastAccess || b.savedAt - a.savedAt)
  const kept: CachedChat[] = []
  let bytes = 0
  for (const entry of ranked) {
    if (kept.length >= MAX_CHATS) break
    if (kept.length > 0 && bytes + entry.bytes > MAX_BYTES) continue
    if (entry.bytes > MAX_BYTES) continue
    kept.push(entry)
    bytes += entry.bytes
  }
  return kept
}

export function snapshotOf(chat: ChatSnapshot, at = Date.now()): CachedChat | null {
  const items = slimItems(chat.items)
  if (!items.length) return null
  // A page we trimmed to CACHED_PAGE still has earlier history on the server.
  const trimmed = chat.items.length > CACHED_PAGE && items.length === CACHED_PAGE
  const entry: CachedChat = {
    key: cacheKey(chat.profile, chat.id),
    id: chat.id,
    profile: chat.profile,
    items,
    title: chat.title,
    older: chat.older || trimmed,
    named: chat.named,
    speaker: chat.speaker,
    savedAt: at,
    lastAccess: at,
    bytes: 0,
  }
  entry.bytes = measure({ ...entry, bytes: 0 })
  if (entry.bytes > MAX_BYTES) return null
  return entry
}

export async function writeSnapshot(chat: ChatSnapshot, at?: number) {
  try {
    const entry = snapshotOf(chat, at)
    const key = cacheKey(chat.profile, chat.id)
    const db = await store()
    if (!entry) {
      await db.remove(key).catch(() => {})
      return
    }
    const all = await db.all().catch(() => [])
    const existing = all.find((e) => e.key === key)
    // Keep this chat's place in the LRU unless the caller is saying it was just opened.
    if (existing && at == null) entry.lastAccess = existing.lastAccess
    const others = all.filter((e) => e.key !== key)
    const kept = prune([...others, entry])
    if (!kept.some((e) => e.key === entry.key)) return
    await db.put(entry)
    const keep = new Set(kept.map((e) => e.key))
    for (const e of others) if (!keep.has(e.key)) await db.remove(e.key).catch(() => {})
  } catch {
    // Private mode, or a driver that refuses to write: the chat still loads from the network.
  }
}

export async function touchSnapshot(profile: string, id: string, at = Date.now()) {
  const db = await store()
  const key = cacheKey(profile, id)
  const entry = (await db.all().catch(() => [])).find((e) => e.key === key)
  if (!entry) return
  await db.put({ ...entry, lastAccess: at })
}

export async function readSnapshots(): Promise<CachedChat[]> {
  return (await store()).all().catch(() => [])
}

export async function clearAllSnapshots() {
  await (await store()).clear().catch(() => {})
}

/** A Hermes this browser no longer uses: drop only that Hermes's cached chats. */
export async function forgetSnapshotsForHermes(id: string) {
  const filed = new RegExp(`^murmur@${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:chats:`)
  const db = await store()
  const entries = await db.all().catch(() => [])
  for (const e of entries) if (filed.test(e.key)) await db.remove(e.key).catch(() => {})
}

export function memoryChatCache(): ChatCacheDriver & { records: Map<string, CachedChat> } {
  const records = new Map<string, CachedChat>()
  return {
    records,
    async all() {
      return [...records.values()]
    },
    async put(entry) {
      records.set(entry.key, entry)
    },
    async remove(key) {
      records.delete(key)
    },
    async clear() {
      records.clear()
    },
  }
}
