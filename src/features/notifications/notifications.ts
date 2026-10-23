// System notifications for agents that finish or need you while you're
// elsewhere, through the web's own Notification API: the desktop app hands
// them to the OS, and so do desktop browsers on localhost or HTTPS. Murmur
// asks once, in its own words (prompt.tsx), before the browser ever does, and
// Settings can turn them off. The choice is this device's, for every Hermes.
//
// Where the browser has a push service, turning them on also subscribes this
// device to Murmur's server (server/push.ts), which tells it while Murmur is
// closed: that's what makes them work on phones, through the service worker
// (public/sw.js). The desktop app has no push service and keeps to the page's.

import { create } from 'zustand'
import { desktop, focusWindow } from '@/lib/desktop'
import { hermesHeaders } from '@/hermes/rest'
import type { Note } from './compose'

const KEY = 'murmur:notifications'

type Choice = 'on' | 'off'
type Permission = NotificationPermission | 'unsupported'

/**
 * Secure pages with the API: on computers, and on phones whose browser can
 * push (phones only show notifications through a service worker, and pushed
 * ones are the only kind that reach a phone with Murmur in the background).
 */
export function notificationsSupported() {
  if (typeof window === 'undefined' || !window.isSecureContext || !('Notification' in window)) return false
  return pushSupported() || !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/** A browser with a push service (iPhones: once Murmur is on the home screen). Not the desktop app's Electron. */
export function pushSupported() {
  return typeof window !== 'undefined' && window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && !desktop
}

const permissionNow = (): Permission => (notificationsSupported() ? Notification.permission : 'unsupported')

function readChoice(): Choice | undefined {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'on' || value === 'off' ? value : undefined
  } catch {
    return undefined
  }
}

function saveChoice(choice: Choice) {
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    // Private mode: the choice lasts the visit.
  }
  useNotifications.setState({ choice })
}

export const useNotifications = create<{ choice?: Choice; permission: Permission }>(() => ({
  choice: readChoice(),
  permission: permissionNow(),
}))

/**
 * Notifications go out: allowed by the system, and turned on here. Where the
 * system already allows them without being asked (the desktop app), they're on
 * until turned off.
 */
export function isOn({ choice, permission } = useNotifications.getState()) {
  return permission === 'granted' && choice !== 'off'
}

/** Whether to offer them: never chosen, and the browser would still ask. */
export function shouldOffer({ choice, permission } = useNotifications.getState()) {
  return choice === undefined && permission === 'default'
}

/** Turn them on (asking the system, when it hasn't been) or off. Resolves whether they're on. */
export async function setNotifications(on: boolean) {
  if (!on) {
    saveChoice('off')
    void syncPush(false)
    return false
  }
  if (!notificationsSupported()) return false
  let permission = Notification.permission
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission()
    } catch {
      permission = Notification.permission
    }
  }
  useNotifications.setState({ permission })
  // Blocked: remembered as off, so Murmur doesn't offer again.
  saveChoice(permission === 'granted' ? 'on' : 'off')
  if (permission === 'granted') void syncPush(true)
  return permission === 'granted'
}

// ── Push ────────────────────────────────────────────────────────────────────

const b64u = (key: ArrayBuffer | null) =>
  key ? btoa(String.fromCharCode(...new Uint8Array(key))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : ''

const post = (path: string, body: unknown) =>
  fetch(path, { method: 'POST', headers: hermesHeaders({ 'content-type': 'application/json' }), body: JSON.stringify(body) })

/**
 * Keeps this device's push subscription in step with the choice: subscribed
 * while on, and Murmur's server told on every start (so it has the device even
 * after losing its data, or for a Hermes switched to); unsubscribed when off.
 */
async function syncPush(on: boolean) {
  if (!pushSupported()) return
  try {
    const registration = await navigator.serviceWorker.register('/sw.js')
    let current = await registration.pushManager.getSubscription()
    if (!on) {
      if (current) await Promise.all([post('/murmur/push/unsubscribe', { endpoint: current.endpoint }), current.unsubscribe()])
      return
    }
    const res = await fetch('/murmur/push', { headers: hermesHeaders() })
    if (!res.ok) return // A Murmur from before push: the page's own notifications still work.
    const { key } = (await res.json()) as { key: string }
    // Made for another key (this Murmur's data was reset): its pushes would be refused.
    if (current && b64u(current.options.applicationServerKey) !== key) {
      await current.unsubscribe()
      current = null
    }
    const sub = current ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }))
    await post('/murmur/push/subscribe', sub.toJSON())
  } catch {
    // No push here after all (a browser without a push service, or offline): the page's own still work.
  }
}

let watching = false

/** Follow the permission when it's changed in the browser's or system's settings. */
export function watchPermission() {
  if (watching || !notificationsSupported()) return
  watching = true
  if (isOn()) void syncPush(true)
  const sync = () => {
    const permission = permissionNow()
    if (permission !== useNotifications.getState().permission) useNotifications.setState({ permission })
  }
  document.addEventListener('visibilitychange', sync)
  navigator.permissions
    ?.query({ name: 'notifications' })
    .then((status) => status.addEventListener('change', sync))
    .catch(() => {})
}

/** Shows a note, if notifications are on. Clicking it brings Murmur forward and opens `href`. */
export function showNote(note: Note, open: (href: string) => void) {
  if (!isOn()) return
  try {
    const n = new Notification(note.title, { body: note.body, tag: note.tag, icon: '/icon-192.png' })
    n.onclick = () => {
      focusWindow()
      open(note.href)
      n.close()
    }
  } catch {
    // Some browsers only allow notifications from a service worker.
  }
}
