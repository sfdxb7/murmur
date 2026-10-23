import { mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { agentName, createDevices, firstLine, isQuiet, moments } from './push.ts'

const live = (entries: [string, string][]) => new Map(entries)

describe('what’s worth a notification, between two looks at Hermes', () => {
  it('nothing on the first look, whatever is busy', () => {
    expect(moments(null, live([['a', 'working'], ['b', 'waiting']]))).toEqual([])
  })

  it('a chat that was busy and isn’t has finished', () => {
    expect(moments(live([['a', 'working']]), live([]))).toEqual([{ kind: 'finished', id: 'a' }])
  })

  it('one that starts waiting needs the person, once', () => {
    expect(moments(live([['a', 'working']]), live([['a', 'waiting']]))).toEqual([{ kind: 'needs-you', id: 'a' }])
    expect(moments(live([['a', 'waiting']]), live([['a', 'waiting']]))).toEqual([])
  })

  it('a chat still at work says nothing', () => {
    expect(moments(live([['a', 'working']]), live([['a', 'working'], ['b', 'working']]))).toEqual([])
  })
})

describe('the words on it', () => {
  it('a reply’s first line, as plain words', () => {
    expect(firstLine('## **Three** emails need you\n\n- [Anastasia](mailto:a@b.c) asked')).toBe('Three emails need you')
    expect(firstLine('```js\ncode\n```\n\nDone.')).toBe('Done.')
  })

  it('a routine with nothing to report stays quiet', () => {
    expect(isQuiet('[SILENT]')).toBe(true)
    expect(isQuiet('Checked the inbox.\n\n*NO_REPLY*')).toBe(true)
    expect(isQuiet('Nothing urgent, but NO_REPLY from Jack yet.')).toBe(false)
  })

  it('an agent goes by the name Murmur shows', () => {
    expect(agentName({ name: 'work-assistant' })).toBe('Work Assistant')
    expect(agentName({ name: 'default', is_default: true })).toBe('Hermes')
    expect(agentName({ name: 'default', is_default: true, ui_meta: { 'hermes-bots': { title: 'Boss' } } })).toBe('Boss')
  })
})

describe('the devices that get them', () => {
  it('keeps one entry per device, and the server’s key, in a file only the server reads', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'murmur-push-')), 'push.json')
    const devices = createDevices(() => file)
    const key = devices.vapid().publicKey
    const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'p', auth: 'a' } }
    devices.add({ ...sub, hermes: 'env', at: 1 })
    devices.add({ ...sub, hermes: 'env', at: 2 })
    expect(devices.list('env')).toHaveLength(1)
    expect(createDevices(() => file).vapid().publicKey).toBe(key)
    expect(statSync(file).mode & 0o777).toBe(0o600)
    devices.remove(sub.endpoint)
    expect(JSON.parse(readFileSync(file, 'utf8')).devices).toEqual([])
  })
})
