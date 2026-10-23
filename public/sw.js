// Murmur's service worker, for push notifications only: it shows what
// Murmur's server pushes (server/push.ts) while no Murmur page is on screen,
// and a click brings Murmur forward on that chat. It handles no fetches, so it
// caches nothing and never stands between Murmur and the network.
//
// A note is {title, body, tag, href}. Its tag is the one the page gives the
// same note (src/features/notifications/compose.ts), so one tells, not both.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let note = {}
  try {
    note = event.data ? event.data.json() : {}
  } catch {
    // Not one of Murmur's: say something rather than nothing (browsers insist).
  }
  event.waitUntil(
    (async () => {
      const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // Someone's looking at Murmur: the page tells for itself, if at all.
      if (pages.some((page) => page.visibilityState === 'visible' && page.focused)) return
      await self.registration.showNotification(note.title || 'Murmur', {
        body: note.body || '',
        tag: note.tag,
        icon: '/icon-192.png',
        data: { href: note.href || '/' },
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href = event.notification.data?.href || '/'
  event.waitUntil(
    (async () => {
      const pages = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const page = pages.find((p) => p.visibilityState === 'visible') ?? pages[0]
      if (!page) return void (await self.clients.openWindow(href))
      await page.focus()
      // The open page goes there itself, without a reload (src/features/notifications/notify.tsx).
      page.postMessage({ type: 'murmur:open', href })
    })(),
  )
})
