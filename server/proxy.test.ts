import http from 'node:http'
import type { AddressInfo } from 'node:net'
import zlib from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Hermes } from './hermes.ts'
import { createProxy } from './proxy.ts'

describe('Hermes’s JSON on its way to the browser', () => {
  const messages = JSON.stringify({ messages: Array.from({ length: 400 }, (_, i) => ({ id: i, text: 'Checked the inbox.' })) })
  // A stand-in Hermes: a chat's messages, a tiny reply, and a stream.
  const hermes = http.createServer((req, res) => {
    if (req.url?.startsWith('/api/small')) return void res.writeHead(200, { 'content-type': 'application/json', 'content-length': 11 }).end('{"ok":true}')
    if (req.url?.startsWith('/api/stream')) return void res.writeHead(200, { 'content-type': 'text/event-stream' }).end('data: x\n\n'.repeat(300))
    res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(messages) }).end(messages)
  })
  let murmur: http.Server
  let port = 0

  beforeAll(async () => {
    await new Promise<void>((done) => hermes.listen(0, '127.0.0.1', done))
    const target = new URL(`http://127.0.0.1:${(hermes.address() as AddressInfo).port}`)
    const proxy = createProxy(() => ({ url: target, prefix: '', restAuth: async () => ({ headers: {}, credential: '' }) }) as unknown as Hermes)
    murmur = http.createServer((req, res) => void proxy.proxyHttp(req, res, new URL(req.url ?? '', 'http://m')))
    await new Promise<void>((done) => murmur.listen(0, '127.0.0.1', done))
    port = (murmur.address() as AddressInfo).port
  })
  afterAll(() => {
    hermes.close()
    murmur.close()
  })

  // Raw bytes, as they cross the network (fetch would undo the compression).
  const get = (path: string, acceptEncoding?: string) =>
    new Promise<{ headers: http.IncomingHttpHeaders; body: Buffer }>((done, fail) => {
      const headers = acceptEncoding ? { 'accept-encoding': acceptEncoding } : {}
      http
        .get({ port, path, headers }, (res) => {
          const chunks: Buffer[] = []
          res.on('data', (c) => chunks.push(c)).on('end', () => done({ headers: res.headers, body: Buffer.concat(chunks) }))
        })
        .on('error', fail)
    })

  it('goes brotli when the browser takes it, a fraction of the size', async () => {
    const { headers, body } = await get('/hermes/api/sessions/1/messages', 'gzip, deflate, br')
    expect(headers['content-encoding']).toBe('br')
    expect(headers['content-length']).toBeUndefined()
    expect(headers.vary).toContain('Accept-Encoding')
    expect(body.length).toBeLessThan(messages.length / 5)
    expect(zlib.brotliDecompressSync(body).toString()).toBe(messages)
  })

  it('goes gzip to a browser without brotli', async () => {
    const { headers, body } = await get('/hermes/api/sessions/1/messages', 'gzip')
    expect(headers['content-encoding']).toBe('gzip')
    expect(zlib.gunzipSync(body).toString()).toBe(messages)
  })

  it('goes as it is when the browser takes neither, when it’s tiny, and when it’s a stream', async () => {
    for (const [path, encoding] of [
      ['/hermes/api/sessions/1/messages', undefined],
      ['/hermes/api/small', 'br'],
      ['/hermes/api/stream', 'br'],
    ] as const) {
      const { headers } = await get(path, encoding)
      expect(headers['content-encoding']).toBeUndefined()
    }
  })
})
