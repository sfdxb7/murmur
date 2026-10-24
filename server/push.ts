// Push notifications, sent by Murmur's server so they reach a device that's
// asleep, with Murmur closed. The page's own notifications (src/features/
// notifications) only work while it's open, and a phone freezes a page in the
// background within seconds; so here the server watches Hermes and pushes.
//
//   GET  /murmur/push              → {key}: this server's public key, for PushManager.subscribe
//                                    (or the Android app's UnifiedPush registration)
//   POST /murmur/push/subscribe    {endpoint, keys: {p256dh, auth}} → {ok}: this device is
//                                  told about this Hermes's agents; a first note says it worked
//   POST /murmur/push/unsubscribe  {endpoint} → {ok}
//
// Devices and the server's VAPID key pair live in DATA_DIR/push.json. Each
// Hermes with at least one device gets a watcher: one socket of its own to
// Hermes, which only asks (it never says it answers approvals, so Hermes
// never routes one here). Like the page (src/state/status.ts), it reads
// Hermes's live sessions whenever Hermes says they changed: a chat that was
// busy and isn't has finished a reply, one that starts waiting needs the
// person. A routine's run that finishes with something to say is told with
// the routine's name; one with nothing to report isn't. Notes carry the same
// tag as the page's own, so a page that's open and tells first is replaced,
// not doubled. Sending is webpush.ts.

import type http from 'node:http'
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { dataDir } from './config.ts'
import { hermesById, requestTarget } from './connection.ts'
import type { Hermes } from './hermes.ts'
import { readJson, sendJson } from './http.ts'
import { newVapid, sendPush, type Subscription, type Vapid } from './webpush.ts'

/** What a device shows (the service worker and the Android app read the same shape). */
export type Note = { title: string; body: string; tag: string; href: string }

type Device = Subscription & { hermes: string; at: number }
type Saved = { vapid?: Vapid; devices?: Device[] }

// ── Devices ─────────────────────────────────────────────────────────────────

export function createDevices(file: () => string) {
  let saved: Saved | null = null

  function load(): Saved {
    if (saved) return saved
    try {
      saved = JSON.parse(readFileSync(file(), 'utf8')) as Saved
    } catch {
      saved = {} // None yet.
    }
    return saved
  }

  function save() {
    const path = file()
    try {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
      const tmp = `${path}.${process.pid}.tmp`
      writeFileSync(tmp, JSON.stringify(saved, null, 2) + '\n', { mode: 0o600 })
      chmodSync(tmp, 0o600)
      renameSync(tmp, path)
    } catch (error) {
      console.warn(`Murmur: couldn’t save push devices to ${path} (${(error as Error).message}).`)
    }
  }

  /** This server's key pair, made the first time it's needed. */
  function vapid(): Vapid {
    const s = load()
    if (!s.vapid) {
      s.vapid = newVapid()
      save()
    }
    return s.vapid
  }

  const list = (hermes?: string) => (load().devices ?? []).filter((d) => !hermes || d.hermes === hermes)

  function add(device: Device) {
    const s = load()
    s.devices = [...(s.devices ?? []).filter((d) => d.endpoint !== device.endpoint), device]
    save()
  }

  function remove(endpoint: string) {
    const s = load()
    const before = s.devices?.length ?? 0
    s.devices = (s.devices ?? []).filter((d) => d.endpoint !== endpoint)
    if (s.devices.length !== before) save()
  }

  return { vapid, list, add, remove }
}

// ── What Hermes says, in words ──────────────────────────────────────────────
// Copies of the page's own helpers: the image ships only server/, not src/.

const LIMIT = 140
const clip = (text: string) => (text.length > LIMIT ? `${text.slice(0, LIMIT - 1).trimEnd()}…` : text)

/** A reply's first line, as plain words (src/features/notifications/compose.ts firstLine, without its media parsing). */
export function firstLine(markdown: string) {
  const prose = markdown
    .replace(/```[\s\S]*?(?:```|$)/g, '\n')
    .replace(/^MEDIA:.*$/gm, '')
  for (const raw of prose.split('\n')) {
    const line = raw
      .replace(/^\s*(?:#{1,6}\s+|>\s?|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/, '')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\*\*|__|~~|`/g, '')
      .replace(/\|/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (line && !/^[-*_=:\s]+$/.test(line)) return clip(line)
  }
  return ''
}

// src/features/routines/runs.ts isQuiet: Hermes's own test for a run with nothing to report.
const MARKERS = new Set(['[SILENT]', 'SILENT', 'NO_REPLY', 'NO REPLY', '[静默]', '静默', '[沉默]', '沉默'])
const BRACKETED = [...MARKERS].filter((m) => m.startsWith('['))
const canonical = (text: string) => text.trim().toUpperCase().split(/\s+/).join(' ')
const edge = (ch: string) => ch !== '[' && ch !== ']' && /\p{P}/u.test(ch)
function isMarker(text: string | undefined) {
  const stripped = text?.trim() ?? ''
  if (!stripped || [...stripped].length > 64) return false
  const chars = [...stripped]
  let start = 0
  let end = chars.length
  while (start < end && edge(chars[start])) start++
  while (end > start && edge(chars[end - 1])) end--
  const bare = chars.slice(start, end).join('').trim()
  return [stripped, bare].some((form) => MARKERS.has(canonical(form)))
}
export function isQuiet(answer: string) {
  const text = answer.trim()
  if (!text) return false
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  return BRACKETED.some((m) => text.toUpperCase().startsWith(m)) || [text, lines[0], lines.at(-1)].some(isMarker)
}

/** src/state/agents.ts toAgent's name: the Bot Mode title, the display name, or the profile's. */
type Profile = { name: string; is_default?: boolean; display_name?: string; bot_title?: string; ui_meta?: Record<string, unknown> }
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
export function agentName(p: Profile) {
  const bots = p.ui_meta?.['hermes-bots'] as { title?: unknown } | undefined
  return text(bots?.title) || text(p.bot_title) || text(p.display_name) || (p.is_default ? 'Hermes' : p.name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
}

/** Hermes titles a run "<routine> · Oct 19 08:00" (src/features/routines/runs.ts runTitle). */
const runTitle = (title: string) => title.replace(/\s+·\s+[A-Z][a-z]{2} \d{1,2} \d{1,2}:\d{2}(?:\s+#\d+)?$/, '').trim()
const RUN_ID = /^cron_[0-9a-z]+_\d{8}_\d{6}$/i

const chatHref = (profile: string, id: string) => `/chat/${encodeURIComponent(profile)}/${encodeURIComponent(id)}`

// ── Watching one Hermes ─────────────────────────────────────────────────────

type LiveRow = { session_key: string; status: string; title?: string; message_count?: number; last_active?: number }
type Owner = { profile: string; run: boolean; title: string }
type Moment = { kind: 'finished' | 'needs-you'; id: string }
/** A live session as one look saw it. `at` is Hermes's last_active (seconds). */
export type Seen = { status: 'working' | 'waiting' | 'idle'; count: number; at: number }

const BUSY = new Set(['working', 'waiting', 'starting'])

export const seenOf = (r: LiveRow): Seen => ({
  status: r.status === 'waiting' ? 'waiting' : BUSY.has(r.status) ? 'working' : 'idle',
  count: r.message_count ?? 0,
  at: r.last_active ?? 0,
})

/**
 * Which live sessions just finished or started waiting, between two looks.
 * A reply can start and finish between them (a quick one, or events missed),
 * so an idle session also counts as finished when it has more messages than
 * last time, or when it's new to the list and moved since the last look
 * (`since`, seconds); one that's only just been opened hasn't moved. Pure;
 * see push.test.ts.
 */
export function moments(before: Map<string, Seen> | null, now: Map<string, Seen>, since = 0): Moment[] {
  if (!before) return [] // The first look only remembers.
  const out: Moment[] = []
  for (const [id, was] of before) {
    const is = now.get(id)
    if (was.status !== 'idle' && (!is || is.status === 'idle')) out.push({ kind: 'finished', id })
    else if (was.status === 'idle' && is?.status === 'idle' && is.count > was.count) out.push({ kind: 'finished', id })
  }
  for (const [id, is] of now) {
    if (!before.has(id) && is.status === 'idle' && is.count > 0 && is.at > since) out.push({ kind: 'finished', id })
    if (is.status === 'waiting' && before.get(id)?.status !== 'waiting') out.push({ kind: 'needs-you', id })
  }
  return out
}

export function createWatcher(hermes: Hermes, tell: (note: Note) => void) {
  let socket: WebSocket | null = null
  let stopped = false
  let attempt = 0
  let next = 0
  let live: Map<string, Seen> | null = null
  let lookedAt = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let debounce: ReturnType<typeof setTimeout> | undefined
  const waiting = new Map<string, { done: (result: unknown) => void; fail: (error: Error) => void }>()
  let owners = new Map<string, Owner>()
  let names = new Map<string, string>()
  let ownersAt = 0

  function rpc<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return new Promise((done, fail) => {
      if (socket?.readyState !== WebSocket.OPEN) return fail(new Error('not connected'))
      const id = `push${++next}`
      const timeout = setTimeout(() => (waiting.delete(id), fail(new Error(`${method} timed out`))), 15_000)
      waiting.set(id, {
        done: (result) => (clearTimeout(timeout), done(result as T)),
        fail: (error) => (clearTimeout(timeout), fail(error)),
      })
      socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
    })
  }

  async function connect() {
    if (stopped) return
    try {
      const { param } = await hermes.socketAuth()
      const url = new URL(hermes.prefix + '/api/ws', hermes.url)
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
      url.searchParams.set(...param)
      const ws = new WebSocket(url)
      socket = ws
      ws.onopen = () => {
        attempt = 0
        void look()
      }
      ws.onmessage = (e) => {
        let frame: { id?: string; method?: string; params?: { type?: string }; result?: unknown; error?: { message?: string } }
        try {
          frame = JSON.parse(String(e.data))
        } catch {
          return
        }
        if (frame.method === 'event') {
          if (frame.params?.type === 'sessions.changed') {
            clearTimeout(debounce)
            debounce = setTimeout(() => void look(), 500)
          }
          return
        }
        // Hermes's own requests (approvals, questions) are for the apps that answer them; this one only listens.
        const call = frame.id ? waiting.get(frame.id) : undefined
        if (!call) return
        waiting.delete(frame.id!)
        if (frame.error) call.fail(new Error(frame.error.message ?? 'Hermes said no'))
        else call.done(frame.result)
      }
      ws.onclose = () => {
        for (const call of waiting.values()) call.fail(new Error('closed'))
        waiting.clear()
        if (socket === ws) socket = null
        redial()
      }
      ws.onerror = () => {} // onclose follows.
    } catch {
      redial()
    }
  }

  function redial() {
    if (stopped) return
    clearTimeout(timer)
    timer = setTimeout(() => void connect(), Math.min(60_000, 1000 * 2 ** attempt++))
  }

  /** Hermes's live sessions, against the last look. Again in a few seconds while any are busy (events can be missed). */
  async function look() {
    if (stopped || socket?.readyState !== WebSocket.OPEN) return
    clearTimeout(timer)
    try {
      const startedAt = Date.now() / 1000
      const { sessions } = await rpc<{ sessions: LiveRow[] }>('session.active_list')
      const now = new Map(sessions.map((r) => [r.session_key, seenOf(r)]))
      // Hermes's clock is this server's on one host; a couple of seconds' slack covers the rest.
      const found = moments(live, now, lookedAt - 2)
      live = now
      lookedAt = startedAt
      for (const moment of found) void noteFor(moment).then((note) => note && tell(note), () => {})
      const busy = [...now.values()].some((s) => s.status !== 'idle')
      timer = setTimeout(() => void look(), busy ? 3_000 : 30_000)
    } catch {
      timer = setTimeout(() => void look(), 30_000)
    }
  }

  /** Every agent's recent chats, for whose a live session is (Hermes's live list doesn't say). */
  async function ownerOf(id: string): Promise<Owner | undefined> {
    if (!owners.has(id) && Date.now() - ownersAt > 10_000) {
      ownersAt = Date.now()
      const { profiles } = await rpc<{ profiles: Profile[] }>('profiles.list')
      const found = new Map<string, Owner>()
      const named = new Map<string, string>()
      await Promise.all(
        profiles.map(async (p) => {
          named.set(p.name, agentName(p))
          const { body } = await hermes.send<{ sessions?: { id: string; source?: string; title?: string }[] }>(
            'GET',
            `/api/sessions?profile=${encodeURIComponent(p.name)}&limit=60&order=recent`,
          )
          for (const s of body?.sessions ?? []) {
            found.set(s.id, { profile: p.name, run: s.source === 'cron' || RUN_ID.test(s.id), title: s.title ?? '' })
          }
        }),
      )
      owners = found
      names = named
    }
    return owners.get(id)
  }

  async function noteFor({ kind, id }: Moment): Promise<Note | null> {
    // Not among any agent's chats: one Murmur doesn't list (a group's, a hidden one).
    const owner = await ownerOf(id)
    if (!owner) return null
    const name = names.get(owner.profile) ?? owner.profile
    const href = chatHref(owner.profile, id)
    if (kind === 'needs-you') return { title: name, body: 'Needs your OK', tag: `murmur:chat:${id}`, href }
    // The last few messages, put in order as the page does (src/state/routines.ts fetchRunResult).
    type Row = { id?: number; timestamp?: number; role?: string; content?: string | null }
    const { body } = await hermes.send<{ messages?: Row[] }>(
      'GET',
      `/api/sessions/${encodeURIComponent(id)}/messages?profile=${encodeURIComponent(owner.profile)}&order=latest&limit=8`,
    )
    const rows = (body?.messages ?? []).sort((a, b) => (a.timestamp ?? a.id ?? 0) - (b.timestamp ?? b.id ?? 0))
    const reply = rows.findLast((m) => m.role === 'assistant' && m.content?.trim())?.content?.trim() ?? ''
    if (owner.run) {
      // A routine with nothing to report stays quiet, as Hermes keeps it from Telegram.
      if (!reply || isQuiet(reply)) return null
      return { title: runTitle(owner.title) || name, body: firstLine(reply) || 'Found something', tag: `murmur:run:${id}`, href }
    }
    return { title: name, body: firstLine(reply) || 'Finished', tag: `murmur:chat:${id}`, href }
  }

  void connect()
  return {
    stop() {
      stopped = true
      clearTimeout(timer)
      clearTimeout(debounce)
      socket?.close()
    },
  }
}

// ── The server's side ───────────────────────────────────────────────────────

let devices: ReturnType<typeof createDevices> | null = null
const watchers = new Map<string, { hermes: Hermes; stop: () => void }>()

const store = () => (devices ??= createDevices(() => join(dataDir(), 'push.json')))

/** Tells every device on this Hermes; forgets the ones their push service says are gone. */
async function deliver(hermesId: string, note: Note) {
  const { vapid, list, remove } = store()
  await Promise.all(
    list(hermesId).map(async (device) => {
      try {
        const { status, reason } = await sendPush(device, note, vapid(), { topic: note.tag })
        if (status === 404 || status === 410) {
          remove(device.endpoint)
          console.warn(`Murmur: a push service says a device is gone (${status} ${reason}); it's dropped until it subscribes again.`)
        } else if (status >= 400) console.warn(`Murmur: a push service turned a note away (${status} ${reason}).`)
      } catch (error) {
        console.warn(`Murmur: couldn’t reach a push service (${(error as Error).message}).`)
      }
    }),
  )
}

/** A watcher for every Hermes that has a device, and none for one that hasn't. */
function syncWatchers() {
  const wanted = new Set(store().list().map((d) => d.hermes))
  for (const [id, w] of watchers) {
    if (!wanted.has(id) || hermesById(id) !== w.hermes) {
      w.stop()
      watchers.delete(id)
    }
  }
  for (const id of wanted) {
    if (watchers.has(id)) continue
    const hermes = hermesById(id)
    if (!hermes) continue
    watchers.set(id, { hermes, stop: createWatcher(hermes, (note) => void deliver(id, note)).stop })
  }
}

/** Called once the server's settings are known: watches for the devices already there. */
export function startPush() {
  syncWatchers()
}

export function stopPush() {
  for (const w of watchers.values()) w.stop()
  watchers.clear()
}

const B64U = /^[A-Za-z0-9_-]+$/
/** A subscription as a browser or the app sends it; push services are only ever reached over https. */
function subscriptionOf(body: unknown): Subscription | null {
  const { endpoint, keys } = (body ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }
  if (typeof endpoint !== 'string' || endpoint.length > 2048 || !URL.canParse(endpoint) || new URL(endpoint).protocol !== 'https:') return null
  const { p256dh, auth } = keys ?? {}
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || !B64U.test(p256dh) || !B64U.test(auth)) return null
  if (Buffer.from(p256dh, 'base64url').length !== 65 || Buffer.from(auth, 'base64url').length !== 16) return null
  return { endpoint, keys: { p256dh, auth } }
}

const reply = (res: http.ServerResponse, status: number, body: unknown) => (sendJson(res, status, body), true)

export async function handlePush(req: http.IncomingMessage, res: http.ServerResponse, path: string) {
  if (path !== '/murmur/push' && !path.startsWith('/murmur/push/')) return false
  const { vapid, add, remove } = store()
  if (path === '/murmur/push' && req.method === 'GET') return reply(res, 200, { key: vapid().publicKey })
  if (req.method !== 'POST') return false
  const body = await readJson(req).catch(() => ({}))

  if (path === '/murmur/push/subscribe') {
    const target = requestTarget(req)
    if (!target) return reply(res, 409, { error: 'hermes_gone' })
    const sub = subscriptionOf(body)
    if (!sub) return reply(res, 422, { error: 'Not a push subscription.' })
    // Pages send theirs on every start, so the server has it even after losing its data.
    const known = store().list().some((d) => d.endpoint === sub.endpoint)
    add({ ...sub, hermes: target.id, at: Date.now() })
    syncWatchers()
    if (known) return reply(res, 200, { ok: true })
    // A new device: say it worked, on the device itself, the first proof that push reaches it.
    const welcome = { title: 'Murmur', body: 'Notifications are on.', tag: 'murmur:push', href: '/' } satisfies Note
    const { status, reason } = await sendPush(sub, welcome, vapid()).catch((error: Error) => ({ status: 0, reason: error.message }))
    if (status < 200 || status >= 300) {
      remove(sub.endpoint)
      syncWatchers()
      return reply(res, 502, { error: `The push service didn’t take it (${status || 'unreachable'}${reason ? `: ${reason}` : ''}).` })
    }
    return reply(res, 200, { ok: true })
  }
  if (path === '/murmur/push/unsubscribe') {
    const endpoint = (body as { endpoint?: unknown }).endpoint
    if (typeof endpoint === 'string') remove(endpoint)
    syncWatchers()
    return reply(res, 200, { ok: true })
  }
  return false
}
