import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { brotliDecompressSync, gunzipSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Hermes } from './hermes.ts'
import { preferredEncoding } from './compress.ts'
import { createProxy } from './proxy.ts'

describe('preferredEncoding', () => {
  it('prefers brotli, then gzip, and honours a refusal', () => {
    expect(preferredEncoding('gzip, deflate, br')).toBe('br')
    expect(preferredEncoding('gzip')).toBe('gzip')
    expect(preferredEncoding('br;q=0, gzip')).toBe('gzip')
    expect(preferredEncoding('identity')).toBeNull()
  })
})

type Raw = { status: number; headers: http.IncomingHttpHeaders; body: Buffer }

function getRaw(url: string, headers: Record<string, string>, stopAt?: string): Promise<Raw> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      const chunks: Buffer[] = []
      const timer = setTimeout(() => {
        req.destroy()
        reject(new Error('response was buffered'))
      }, 400)
      const finish = () => {
        clearTimeout(timer)
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) })
      }
      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
        if (stopAt && Buffer.concat(chunks).toString('utf8').includes(stopAt)) {
          res.destroy()
          finish()
        }
      })
      res.on('end', finish)
      res.on('error', () => {})
    })
    req.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(error)
    })
  })
}

describe('proxied JSON and event streams', () => {
  let releaseSecond: () => void = () => {}
  const hermes = http.createServer((req, res) => {
    const url = req.url ?? ''
    if (url.includes('/messages')) {
      const output = 'line\n'.repeat(4_000)
      const body = JSON.stringify({
        messages: [
          {
            id: 1,
            role: 'assistant',
            content: 'Done.',
            api_content: 'Done.\n\nUmbrel Runtime Context:\n' + 'x'.repeat(8_000),
            codex_message_items: 'e'.repeat(20_000),
          },
          { id: 2, role: 'tool', tool_name: 'terminal', content: JSON.stringify({ output, exit_code: 0, error: null }) },
        ],
      })
      res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) })
      res.end(body)
      return
    }
    if (url.includes('/events')) {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
      res.write('data: token-1\n\n')
      void new Promise<void>((resolve) => {
        releaseSecond = resolve
      }).then(() => {
        if (res.destroyed) return
        res.write('data: token-2\n\n')
        res.end()
      })
      return
    }
    if (url.includes('/tiny')) {
      const body = JSON.stringify({ ok: true })
      res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) })
      res.end(body)
      return
    }
    const body = JSON.stringify({
      sessions: Array.from({ length: 40 }, (_, i) => ({ id: `s${i}`, title: 'Trip notes', preview: 'pack the bags' })),
    })
    res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) })
    res.end(body)
  })
  let murmur: http.Server
  let base = ''

  beforeAll(async () => {
    await new Promise<void>((done) => hermes.listen(0, '127.0.0.1', done))
    const target = new URL(`http://127.0.0.1:${(hermes.address() as AddressInfo).port}`)
    const proxy = createProxy(
      () =>
        ({
          url: target,
          prefix: '',
          restAuth: async () => ({ headers: { authorization: 'Bearer test' }, credential: 'test' }),
          reject() {},
        }) as unknown as Hermes,
    )
    murmur = http.createServer((req, res) => {
      void proxy.proxyHttp(req, res, new URL(req.url ?? '/', 'http://murmur'))
    })
    await new Promise<void>((done) => murmur.listen(0, '127.0.0.1', done))
    base = `http://127.0.0.1:${(murmur.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    releaseSecond()
    await new Promise<void>((done) => murmur.close(() => done()))
    await new Promise<void>((done) => hermes.close(() => done()))
  })

  it('slims a transcript and brotli-compresses it', async () => {
    const res = await getRaw(`${base}/hermes/api/sessions/chat-1/messages?profile=default&order=latest&limit=500`, {
      'accept-encoding': 'gzip, deflate, br',
    })
    expect(res.status).toBe(200)
    expect(res.headers['content-encoding']).toBe('br')
    expect(String(res.headers.vary)).toContain('Accept-Encoding')
    const body = JSON.parse(brotliDecompressSync(res.body).toString('utf8')) as { messages: Record<string, unknown>[] }
    expect(body.messages[0]).toEqual({ id: 1, role: 'assistant', content: 'Done.' })
    expect(JSON.parse(String(body.messages[1].content)).exit_code).toBe(0)
    expect(res.body.length).toBeLessThan(2_000)
  })

  it('gzip-compresses a JSON list when the client does not take brotli', async () => {
    const res = await getRaw(`${base}/hermes/api/sessions?limit=40`, { 'accept-encoding': 'gzip' })
    expect(res.headers['content-encoding']).toBe('gzip')
    const body = JSON.parse(gunzipSync(res.body).toString('utf8')) as { sessions: unknown[] }
    expect(body.sessions).toHaveLength(40)
  })

  it('leaves a short JSON body uncompressed', async () => {
    const res = await getRaw(`${base}/hermes/api/tiny`, { 'accept-encoding': 'br, gzip' })
    expect(res.headers['content-encoding']).toBeUndefined()
    expect(JSON.parse(res.body.toString('utf8'))).toEqual({ ok: true })
  })

  it('does not buffer or compress an event stream', async () => {
    const res = await getRaw(`${base}/hermes/api/events`, { 'accept-encoding': 'gzip, deflate, br' }, 'token-1')
    expect(res.headers['content-encoding']).toBeUndefined()
    expect(res.body.toString('utf8')).toContain('token-1')
    expect(res.body.toString('utf8')).not.toContain('token-2')
    releaseSecond()
  })
})
