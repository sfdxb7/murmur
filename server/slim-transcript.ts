/**
 * Hermes's /messages rows carry fields Murmur never draws: Codex reasoning
 * dumps, API mirrors, unique ids of every tool hop. On a long chat that can
 * be half the payload (one measured chat was 597KB for 150 messages, 206KB
 * after Brotli, and 295KB / 48KB once these were dropped). The browser proxy
 * strips them so a phone does not download what it will throw away; the
 * client's `plain()` does the same for anything that didn't go through here.
 */

const KEEP = [
  'id',
  'role',
  'content',
  'pictures',
  'tool_calls',
  'tool_call_id',
  'tool_name',
  'reasoning',
  'display_kind',
  'display_metadata',
  'display_content',
  'timestamp',
] as const

function slimRow(row: unknown): unknown {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row
  const out: Record<string, unknown> = {}
  for (const key of KEEP) {
    const value = (row as Record<string, unknown>)[key]
    if (value !== undefined) out[key] = value
  }
  return out
}

function slimList(rows: unknown): unknown {
  return Array.isArray(rows) ? rows.map(slimRow) : rows
}

/** True for the Hermes transcript Murmur paints first when a chat opens. */
export function isSessionMessages(pathname: string) {
  return /\/hermes\/api\/sessions\/[^/]+\/messages\/?$/.test(pathname.replace(/\/{2,}/g, '/'))
}

/**
 * A `/messages` JSON body with only the fields Murmur reads. Anything this
 * cannot parse is returned as it arrived, so a surprising shape still reaches
 * the client rather than failing the open.
 */
export function slimTranscript(body: Buffer): Buffer {
  try {
    const json = JSON.parse(body.toString()) as { messages?: unknown; data?: unknown }
    if (!json || typeof json !== 'object' || Array.isArray(json)) return body
    const next = {
      ...json,
      ...(json.messages !== undefined ? { messages: slimList(json.messages) } : {}),
      ...(json.data !== undefined ? { data: slimList(json.data) } : {}),
    }
    return Buffer.from(JSON.stringify(next))
  } catch {
    return body
  }
}
