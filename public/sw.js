// Murmur's service worker: it shows notifications, and keeps the app's shell
// so Murmur still opens with no network. Pages and their files always come
// from the network first; the saved copy is only for when that fails, so an
// online load is never an old build. Nothing else (Hermes, /murmur/) is touched.
//
// Murmur's server sends each note as a push (server/notifications.ts), in
// the declarative form Safari 18.4 and later shows by itself; other browsers
// hand it here to show. Every push is shown: browsers stop delivering to a
// worker that receives pushes and shows nothing.

// Bump to drop every copy an older worker kept.
const VERSION = 'v1'
const SHELL = `murmur-shell-${VERSION}`
const ASSETS = `murmur-assets-${VERSION}`

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name !== SHELL && name !== ASSETS) await caches.delete(name)
      await self.clients.claim()
    })(),
  ),
)

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || request.headers.has('range')) return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname === '/hermes' || url.pathname.startsWith('/hermes/') || url.pathname.startsWith('/murmur/')) return
  if (request.mode === 'navigate') event.respondWith(page(request))
  else if (url.pathname.startsWith('/assets/')) event.respondWith(asset(request))
})

/** Every page is the app: the network's, kept as the one copy; the copy only when the network fails. */
async function page(request) {
  const shell = await caches.open(SHELL)
  try {
    const res = await fetch(request)
    if (res.ok && (res.headers.get('content-type') ?? '').includes('text/html')) {
      // A new build's files replace the last one's.
      const html = await res.clone().text()
      const kept = await shell.match('/')
      if (kept && (await kept.text()) !== html) await caches.delete(ASSETS)
      await shell.put('/', new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }))
    }
    return res
  } catch (error) {
    const kept = await shell.match('/')
    if (kept) return kept
    throw error
  }
}

/** Built files are named by their contents; a copy is kept as each one loads, for opening offline. */
async function asset(request) {
  try {
    const res = await fetch(request)
    if (res.ok) {
      const copy = res.clone()
      caches.open(ASSETS).then((cache) => cache.put(request, copy))
    }
    return res
  } catch (error) {
    const kept = await caches.match(request, { cacheName: ASSETS })
    if (kept) return kept
    throw error
  }
}

self.addEventListener('push', (event) => {
  let note = {}
  try {
    note = event.data?.json().notification ?? {}
  } catch {
    // Not one of Murmur's: still shown, as Murmur.
  }
  const { title = 'Murmur', navigate, data, ...options } = note
  event.waitUntil(self.registration.showNotification(title, { ...options, data: { ...data, navigate } }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(open(event.notification.data ?? {}))
})

/** Opens what a note is about: in a Murmur window already open (which knows its Hermes), or a new one at the note's link. */
async function open({ href, hermes, navigate }) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const client = windows.find((w) => w.focused) ?? windows.find((w) => w.visibilityState === 'visible') ?? windows[0]
  if (client && href) {
    client.postMessage({ type: 'murmur:open', href, hermes })
    return client.focus()
  }
  return self.clients.openWindow(navigate ?? href ?? '/')
}

// The push service replaced this browser's subscription: hand Murmur the new
// one in place of the old, and tell open pages which device they are now.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      let subscription = event.newSubscription
      if (!subscription) {
        const { key } = await (await fetch('/murmur/notifications', { cache: 'no-store' })).json()
        const applicationServerKey = Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
        subscription = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
      }
      const res = await fetch('/murmur/notifications/devices', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON(), previous: event.oldSubscription?.endpoint }),
      })
      const { device } = await res.json()
      for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) {
        client.postMessage({ type: 'murmur:device', device })
      }
    })(),
  )
})
