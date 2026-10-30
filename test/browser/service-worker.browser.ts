import { expect, test } from '@playwright/test'

// public/sw.js: pages come from the network while there is one, and the last
// page it saw opens when there isn't.

test('the app opens offline from its saved shell, and never from it while online', async ({ page, context }) => {
  await page.goto('/test/browser/sw-one.html')
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
    await navigator.serviceWorker.ready
  })
  // Controlled from the next load on; that load is the one it keeps.
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await page.reload()

  await context.setOffline(true)
  await page.goto('/test/browser/sw-one.html?offline')
  await expect(page.getByText('shell one')).toBeVisible()

  await context.setOffline(false)
  await page.goto('/test/browser/sw-two.html')
  await expect(page.getByText('shell two')).toBeVisible()

  // One versioned copy of each kind; Hermes and Murmur's own routes are never kept.
  const kept = await page.evaluate(async () => {
    const names = await caches.keys()
    const urls = []
    for (const name of names) for (const req of await (await caches.open(name)).keys()) urls.push(new URL(req.url).pathname)
    return { names, urls }
  })
  expect(kept.names).toEqual(['murmur-shell-v1'])
  expect(kept.urls).toEqual(['/'])
})

test('an older worker’s copies are dropped when this one starts', async ({ page }) => {
  await page.goto('/test/browser/sw-one.html')
  await page.evaluate(() => caches.open('murmur-shell-v0').then((c) => c.put('/', new Response('old'))))
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
    await navigator.serviceWorker.ready
  })
  await expect.poll(() => page.evaluate(() => caches.keys())).not.toContain('murmur-shell-v0')
})
