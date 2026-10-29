// The messages route is the raw session table. Hermes sends every column,
// including model-only sidecars the thread never reads (Codex encrypted
// reasoning, the injected api_content), the full tool stdout, and file bytes
// inlined into user turns. On a phone those dominate the download, so they're
// dropped here before the body is forwarded. Assistant prose is left as written.

const DROP = new Set([
  'api_content',
  'codex_message_items',
  'codex_reasoning_items',
  'reasoning_content',
  'reasoning_details',
  'encrypted_content',
  'finish_reason',
])

// Injected prompt tails. The thread shows the person's words and the attachment
// markers; the inlined file bytes and runtime context are not rendered.
const CONTEXT_WARNINGS = /(?:^|\n)--- Context Warnings ---[\s\S]*$/
const ATTACHED_CONTEXT = /(?:^|\n)--- Attached Context ---\s*\n[\s\S]*$/
const RUNTIME_CONTEXT = /\n*Umbrel Runtime Context:[\s\S]*$/
const REF = /@(?:file|image):(?:`[^`\n]+`|"[^"\n]+"|'[^'\n]+'|\S+)/g
const IMAGE_ATTACHED = /\[Image attached at: [^\]\n]+\]/g

/** A tool result the thread never shows in full: labels, errors, image paths and mail subjects are short. */
const TOOL_TEXT = 2_048

function capText(text: string) {
  if (text.length <= TOOL_TEXT) return text
  const head = 1_400
  const tail = 400
  return `${text.slice(0, head)}\n…\n${text.slice(-tail)}`
}

/** Keep attachment markers that lived only inside a block that is about to be dropped. */
function retainMarkers(kept: string, dropped: string) {
  const have = new Set(kept.match(REF) ?? [])
  const refs = (dropped.match(REF) ?? []).filter((ref) => !have.has(ref))
  const images = (dropped.match(IMAGE_ATTACHED) ?? []).filter((mark) => !kept.includes(mark))
  const extra = [...images, ...refs]
  return extra.length ? `${kept}\n${extra.join('\n')}` : kept
}

function slimUserContent(content: string) {
  const dropped = [content.match(CONTEXT_WARNINGS)?.[0], content.match(ATTACHED_CONTEXT)?.[0], content.match(RUNTIME_CONTEXT)?.[0]]
    .filter((part): part is string => Boolean(part))
    .join('\n')
  if (!dropped) return content
  const kept = content.replace(CONTEXT_WARNINGS, '').replace(ATTACHED_CONTEXT, '').replace(RUNTIME_CONTEXT, '').trimEnd()
  return retainMarkers(kept, dropped)
}

function slimJson(value: unknown): { value: unknown; changed: boolean } {
  if (typeof value === 'string') {
    const next = capText(value)
    return { value: next, changed: next !== value }
  }
  if (Array.isArray(value)) {
    let changed = false
    const next = value.map((item) => {
      const slimmed = slimJson(item)
      changed ||= slimmed.changed
      return slimmed.value
    })
    return { value: changed ? next : value, changed }
  }
  if (value && typeof value === 'object') {
    let changed = false
    const next: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const slimmed = slimJson(item)
      changed ||= slimmed.changed
      next[key] = slimmed.value
    }
    return { value: changed ? next : value, changed }
  }
  return { value, changed: false }
}

function slimToolContent(content: string) {
  const trimmed = content.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const slimmed = slimJson(JSON.parse(content) as unknown)
      return slimmed.changed ? JSON.stringify(slimmed.value) : content
    } catch {
      // Plain text that only looked like JSON.
    }
  }
  return capText(content)
}

/** Compact JSON of a messages payload with the columns the thread doesn't read removed. Null when it isn't one. */
export function slimMessages(text: string): string | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const body = data as Record<string, unknown>
  const key = Array.isArray(body.messages) ? 'messages' : Array.isArray(body.data) ? 'data' : null
  if (!key) return null
  body[key] = (body[key] as unknown[]).map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row
    const src = row as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [field, value] of Object.entries(src)) {
      if (!DROP.has(field)) out[field] = value
    }
    // The list and the thread render assistant prose as written. Tool rows and
    // the injected tail of a user turn are what make a long history huge.
    if (src.role === 'user' && typeof out.content === 'string') out.content = slimUserContent(out.content)
    if (src.role === 'tool' && typeof out.content === 'string') out.content = slimToolContent(out.content)
    return out
  })
  return JSON.stringify(body)
}
