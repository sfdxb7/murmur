// Web Push from Murmur's own server, with no dependencies and nobody else's keys.
//
// A message is encrypted for one device (RFC 8291, aes128gcm) and signed with
// this server's VAPID key (RFC 8292), then POSTed to the device's push
// service (RFC 8030). Every push service takes that same request: Chrome's,
// Firefox's and Safari's for web apps on the home screen or in a browser, and
// Google's FCM for the Android app, whose UnifiedPush embedded distributor
// asks FCM for an endpoint tied to this server's public key (mobile/). The
// key pair is made once per server and kept in DATA_DIR/push.json (push.ts),
// so a Murmur anyone runs pushes on its own: no account, relay or secret
// shipped in the image. The push service only sees an opaque blob.

import { createCipheriv, createECDH, createHash, createHmac, createPrivateKey, generateKeyPairSync, randomBytes, sign, type ECDH, type webcrypto } from 'node:crypto'

/** This server's VAPID key pair: the public key as browsers take it (base64url, uncompressed point), the private one as a JWK. */
export type Vapid = { publicKey: string; privateKey: webcrypto.JsonWebKey }

/** What a browser's PushSubscription.toJSON() gives (and what the Android app sends). */
export type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } }

/** Who runs this server, as push services like to be told (Apple's insists). */
const SUBJECT = 'https://github.com/getumbrel/murmur'

const b64u = (bytes: Buffer) => bytes.toString('base64url')
const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest()

export function newVapid(): Vapid {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const { x, y } = publicKey.export({ format: 'jwk' })
  const point = Buffer.concat([Buffer.from([4]), Buffer.from(x!, 'base64url'), Buffer.from(y!, 'base64url')])
  return { publicKey: b64u(point), privateKey: privateKey.export({ format: 'jwk' }) }
}

/**
 * RFC 8291: `payload` as only this device can read it. A fresh key pair and
 * salt every time (both injectable for the RFC's test vector).
 */
export function encrypt(payload: Buffer, sub: Subscription, salt = randomBytes(16), server: ECDH = freshKeys()) {
  const asPublic = server.getPublicKey()
  const uaPublic = Buffer.from(sub.keys.p256dh, 'base64url')
  const shared = server.computeSecret(uaPublic)
  // HKDF-SHA256 by hand: every output here is a single block.
  const ikm = hmac(hmac(Buffer.from(sub.keys.auth, 'base64url'), shared), Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]))
  const prk = hmac(salt, ikm)
  const key = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16)
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12)
  const cipher = createCipheriv('aes-128-gcm', key, nonce)
  // One record, so it's the last: the payload, then the 0x02 delimiter.
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()])
  const header = Buffer.alloc(21)
  salt.copy(header, 0)
  header.writeUInt32BE(4096, 16)
  header[20] = asPublic.length
  return Buffer.concat([header, asPublic, body])
}

function freshKeys() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  return ecdh
}

/** RFC 8292: a signed claim, good for 12 hours, that this server sent the push. */
export function vapidAuth(endpoint: string, vapid: Vapid, now = Date.now()) {
  const part = (value: object) => b64u(Buffer.from(JSON.stringify(value)))
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: SUBJECT })}`
  const signature = sign('sha256', Buffer.from(unsigned), { key: createPrivateKey({ key: vapid.privateKey, format: 'jwk' }), dsaEncoding: 'ieee-p1363' })
  return `vapid t=${unsigned}.${b64u(signature)}, k=${vapid.publicKey}`
}

/**
 * Sends one message. Resolves the push service's status (201 delivered or
 * queued, 404/410 the device is gone for good) and, when it refused, its
 * reason in its own words. Messages with the same
 * `topic` replace one another while undelivered (a phone that's off gets the
 * latest about a chat, not each one).
 */
export async function sendPush(sub: Subscription, message: object, vapid: Vapid, { topic, ttl = 24 * 3600 }: { topic?: string; ttl?: number } = {}) {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      authorization: vapidAuth(sub.endpoint, vapid),
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      ttl: String(ttl),
      urgency: 'high',
      // At most 32 URL-safe characters.
      ...(topic && { topic: createHash('sha256').update(topic).digest('base64url').slice(0, 32) }),
    },
    body: encrypt(Buffer.from(JSON.stringify(message)), sub),
    signal: AbortSignal.timeout(10_000),
  })
  const reason = res.ok ? '' : (await res.text().catch(() => '')).trim().slice(0, 300)
  if (res.ok) await res.body?.cancel().catch(() => {})
  return { status: res.status, reason }
}
