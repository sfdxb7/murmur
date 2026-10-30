// Thin fetch helpers for the Hermes dashboard REST API, reached through the
// Murmur server at /hermes (which attaches the session token).

import { redialNow } from './gateway'
import { HERMES_GONE, HERMES_HEADER, tabHermes } from './instance'

export class HermesError extends Error {
  status: number
  detail: unknown
  constructor(status: number, message: string, detail?: unknown) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

/** Fired when Murmur may have signed this browser out (an expired cookie), so the sign-in gate looks again. */
export const SESSION_CHECK = 'murmur:check-session'

/** Headers naming the Hermes this tab is for, so a switch in another tab never crosses its wires. */
export function hermesHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const id = tabHermes()
  return id ? { ...headers, [HERMES_HEADER]: id } : headers
}

/**
 * Background upkeep reads each agent's config once per job (timezone, toolsets,
 * Umbrel). Those reads are the same document and they run one after another, so
 * an in-flight share is not enough: keep a short copy and drop it on any write.
 */
const CONFIG_TTL = 60_000
type ConfigHit = { at: number; epoch: number; data: unknown }
const configCache = new Map<string, ConfigHit>()
const configEpoch = new Map<string, number>()
const configInflight = new Map<string, Promise<unknown>>()

/** `/api/config` for one profile, or the defaults document. Anything else is not cached. */
function configScope(path: string): string | null {
  if (!path.startsWith('/api/config')) return null
  const q = path.indexOf('?')
  const pathname = q >= 0 ? path.slice(0, q) : path
  if (pathname === '/api/config/defaults') return '\0defaults'
  if (pathname !== '/api/config') return null
  return new URLSearchParams(q >= 0 ? path.slice(q + 1) : '').get('profile') ?? ''
}

function forgetConfig(scope: string) {
  for (const key of configCache.keys()) if (configScope(key) === scope) configCache.delete(key)
}

async function request<T>(method: string, path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const scope = configScope(path)
  // A caller with its own abort keeps its own request. Sharing one would let that abort fail the others.
  if (method === 'GET' && scope !== null && !init?.signal) return readConfig<T>(scope, path, init)
  if (scope !== null && (method === 'PUT' || method === 'PATCH' || method === 'DELETE')) return writeConfig<T>(scope, method, path, body, init)
  return send<T>(method, path, body, init)
}

function readConfig<T>(scope: string, path: string, init?: RequestInit): Promise<T> {
  const epoch = configEpoch.get(scope) ?? 0
  const hit = configCache.get(path)
  if (hit && hit.epoch === epoch && Date.now() - hit.at < CONFIG_TTL) return Promise.resolve(hit.data as T)
  const pending = configInflight.get(path) as Promise<T> | undefined
  if (pending) return pending
  const run = send<T>('GET', path, undefined, init)
    .then((data) => {
      // A write that started while this was in flight has moved the epoch, so this copy is already old.
      if ((configEpoch.get(scope) ?? 0) === epoch) configCache.set(path, { at: Date.now(), data, epoch })
      return data
    })
    .finally(() => {
      if (configInflight.get(path) === run) configInflight.delete(path)
    })
  configInflight.set(path, run)
  return run
}

/** Bump before and after the write, so a read that overlaps it cannot refill the cache with the old document. */
async function writeConfig<T>(scope: string, method: string, path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const epoch = (configEpoch.get(scope) ?? 0) + 1
  configEpoch.set(scope, epoch)
  forgetConfig(scope)
  try {
    return await send<T>(method, path, body, init)
  } finally {
    configEpoch.set(scope, epoch + 1)
    forgetConfig(scope)
  }
}

async function send<T>(method: string, path: string, body?: unknown, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/hermes${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      ...init,
      headers: hermesHeaders({
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(init?.headers as Record<string, string> | undefined),
      }),
    })
  } catch {
    throw new HermesError(0, 'Can’t reach Hermes. Check that it’s running.')
  }
  const text = await res.text()
  const data = text ? safeJson(text) : null
  if (!res.ok) {
    const signedOut = res.status === 401 && (data as { error?: unknown } | null)?.error === 'signed_out'
    if (signedOut) window.dispatchEvent(new Event(SESSION_CHECK))
    if (res.status === 409 && (data as { error?: unknown } | null)?.error === 'hermes_gone') window.dispatchEvent(new Event(HERMES_GONE))
    const detail = (data as { detail?: unknown; error?: unknown } | null)?.detail ?? data
    throw new HermesError(res.status, messageFrom(detail) ?? `Hermes returned ${res.status}`, detail)
  }
  // Hermes answered, so if the socket is waiting out a retry, it needn't.
  redialNow()
  return data as T
}

function safeJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function messageFrom(detail: unknown): string | null {
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') {
    const d = detail as Record<string, unknown>
    if (typeof d.message === 'string') return d.message
    if (typeof d.error === 'string') return d.error
    if (typeof d.detail === 'string') return d.detail
  }
  return null
}

/** Gives up on a request after `ms` (it fails as unreachable), for callers that must never hang. */
export const within = (ms: number): RequestInit => ({ signal: AbortSignal.timeout(ms) })

export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>('GET', path, undefined, init),
  post: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>('POST', path, body ?? {}, init),
  put: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>('PUT', path, body ?? {}, init),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>('PATCH', path, body ?? {}, init),
  delete: <T>(path: string, body?: unknown, init?: RequestInit) => request<T>('DELETE', path, body, init),
}
