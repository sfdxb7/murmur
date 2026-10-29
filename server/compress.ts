// Dynamic responses (the Hermes proxy) pick an encoding per request. Static
// files are compressed once at build time instead (vite.config.ts). Brotli
// quality stays modest: quality 11, which the build uses, would spend longer
// compressing a transcript than the phone spends downloading the smaller one.

import { brotliCompressSync, createBrotliCompress, createGzip, constants, gzipSync } from 'node:zlib'

/** Below this, the framing costs more than the bytes saved. */
export const MIN_COMPRESS = 1024

const BROTLI = { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }

/** The encodings an Accept-Encoding header allows (a q of 0 refuses one; `*` allows any not named). */
export function acceptsEncoding(header: string | string[] | undefined) {
  const allowed = new Set<string>()
  const refused = new Set<string>()
  for (const part of String(header ?? '').toLowerCase().split(',')) {
    const [name, ...params] = part.trim().split(';')
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
    if (q && Number(q.slice(2)) === 0) refused.add(name.trim())
    else allowed.add(name.trim())
  }
  return (encoding: string) => !refused.has(encoding) && (allowed.has(encoding) || allowed.has('*'))
}

/** Best encoding for a dynamic JSON body, or null to send it as Hermes wrote it. */
export function preferredEncoding(header: string | string[] | undefined): 'br' | 'gzip' | null {
  const takes = acceptsEncoding(header)
  if (takes('br')) return 'br'
  if (takes('gzip')) return 'gzip'
  return null
}

export function isEventStream(type: string) {
  return /text\/event-stream/i.test(type)
}

/** JSON and other text. Never an event stream: compressing one buffers its tokens. */
export function isCompressibleType(type: string) {
  if (!type || isEventStream(type)) return false
  return /json|javascript|xml|svg|text\//i.test(type)
}

/** Compressed bytes when they are actually smaller, else null (send the original). */
export function encodeBuffer(body: Buffer, encoding: 'br' | 'gzip'): Buffer<ArrayBuffer> | null {
  if (body.length < MIN_COMPRESS) return null
  const src = encoding === 'br' ? brotliCompressSync(body, BROTLI) : gzipSync(body, { level: 6 })
  if (src.length >= body.length) return null
  const out = Buffer.allocUnsafe(src.length)
  out.set(src)
  return out
}

export function encodeStream(encoding: 'br' | 'gzip') {
  return encoding === 'br' ? createBrotliCompress(BROTLI) : createGzip({ level: 6 })
}
