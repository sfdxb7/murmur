import { createDecipheriv, createECDH, createHmac, createPublicKey, verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { encrypt, newVapid, vapidAuth } from './webpush.ts'

const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest()
const b = (s: string) => Buffer.from(s, 'base64url')

// RFC 8291 §5, the worked example.
const rfc = {
  plaintext: 'When I grow up, I want to be a watermelon',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  uaPrivate: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
}

/** What the device does: the receiving half of RFC 8291. */
function decrypt(body: Buffer, uaPrivate: string, auth: string) {
  const salt = body.subarray(0, 16)
  const idlen = body[20]
  const asPublic = body.subarray(21, 21 + idlen)
  const ua = createECDH('prime256v1')
  ua.setPrivateKey(b(uaPrivate))
  const ikm = hmac(hmac(b(auth), ua.computeSecret(asPublic)), Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), asPublic, Buffer.from([1])]))
  const prk = hmac(salt, ikm)
  const key = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16)
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12)
  const sealed = body.subarray(21 + idlen)
  const decipher = createDecipheriv('aes-128-gcm', key, nonce)
  decipher.setAuthTag(sealed.subarray(-16))
  const plain = Buffer.concat([decipher.update(sealed.subarray(0, -16)), decipher.final()])
  return plain.subarray(0, plain.lastIndexOf(2))
}

describe('a push message, encrypted for one device', () => {
  it('matches the RFC’s worked example byte for byte', () => {
    const server = createECDH('prime256v1')
    server.setPrivateKey(b(rfc.asPrivate))
    const body = encrypt(Buffer.from(rfc.plaintext), { endpoint: 'https://push.example.net', keys: { p256dh: rfc.uaPublic, auth: rfc.auth } }, b(rfc.salt), server)
    expect(body.toString('base64url')).toBe(rfc.body)
  })

  it('opens with the device’s key, and only with it', () => {
    const device = createECDH('prime256v1')
    device.generateKeys()
    const sub = { endpoint: 'https://push.example.net/x', keys: { p256dh: device.getPublicKey('base64url'), auth: rfc.auth } }
    const body = encrypt(Buffer.from('{"title":"Boss"}'), sub)
    expect(decrypt(body, device.getPrivateKey('base64url'), rfc.auth).toString()).toBe('{"title":"Boss"}')
    expect(() => decrypt(body, rfc.uaPrivate, rfc.auth)).toThrow()
  })
})

describe('the claim that this server sent it', () => {
  it('is signed by this server’s key, for the push service it goes to', () => {
    const vapid = newVapid()
    const header = vapidAuth('https://fcm.googleapis.com/fcm/send/abc', vapid, Date.UTC(2026, 9, 23))
    const [, token, key] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!
    expect(key).toBe(vapid.publicKey)
    const [head, claims, signature] = token.split('.')
    expect(JSON.parse(b(claims).toString())).toMatchObject({ aud: 'https://fcm.googleapis.com', exp: Date.UTC(2026, 9, 23) / 1000 + 12 * 3600 })
    const publicKey = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b(key).subarray(1, 33).toString('base64url'), y: b(key).subarray(33).toString('base64url') }, format: 'jwk' })
    expect(verify('sha256', Buffer.from(`${head}.${claims}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, b(signature))).toBe(true)
  })
})
