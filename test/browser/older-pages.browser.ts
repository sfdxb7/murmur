import { expect, test, type Page, type Route } from '@playwright/test'

/** One page is slow enough that a follow-up can overlap it, and several fit in a few seconds. */
const LATENCY_MS = 300
const MESSAGES = 600

type Hit = { offset: number; limit: number }

async function installHermes(page: Page, hits: Hit[]) {
  const rows = Array.from({ length: MESSAGES }, (_, i) => {
    const id = i + 1
    return {
      id,
      role: id % 2 === 0 ? 'assistant' : 'user',
      content: `message ${id}\n${'a line of the transcript so the page is taller than the screen. '.repeat(3)}`,
      timestamp: id,
    }
  })
  await page.route('**/hermes/api/sessions/**/messages**', async (route: Route) => {
    const q = new URL(route.request().url()).searchParams
    const limit = Number(q.get('limit') ?? 60)
    const offset = Number(q.get('offset') ?? 0)
    hits.push({ offset, limit })
    const end = MESSAGES - offset
    const start = Math.max(0, end - limit)
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: rows.slice(start, end).reverse() }),
    })
  })
  await page.route('**/hermes/api/ws**', (route) => route.abort())
}

function log(page: Page) {
  return page.locator('[role=log]')
}

async function openThread(page: Page) {
  await page.goto('/test/browser/harness.html')
  const scroller = log(page)
  await expect.poll(() => scroller.count()).toBe(1)
  await expect.poll(() => page.getByText(/message 600\b/).count()).toBeGreaterThan(0)
  // Opening jumps to the newest line. A scroll-to-top before that settles is a different race.
  await expect
    .poll(() =>
      scroller.evaluate((el) => {
        const gap = el.scrollHeight - el.clientHeight - el.scrollTop
        return el.scrollHeight > el.clientHeight + 200 && gap < 4
      }),
    )
    .toBe(true)
  await page.waitForTimeout(400)
}

/** The message line nearest the middle of the viewport, and where it sits. */
async function markerAt(page: Page) {
  return log(page).evaluate((el) => {
    const view = el.getBoundingClientRect()
    const y = view.top + view.height / 2
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let text = ''
    let top = 0
    let best = Number.POSITIVE_INFINITY
    while (walker.nextNode()) {
      const found = walker.currentNode.textContent?.match(/message \d+/)
      if (!found) continue
      const range = document.createRange()
      range.selectNodeContents(walker.currentNode)
      const box = range.getBoundingClientRect()
      if (box.height <= 0) continue
      const dist = Math.abs(box.top + box.height / 2 - y)
      if (dist < best) {
        best = dist
        text = found[0]
        top = box.top
      }
    }
    return { text, top, scrollTop: el.scrollTop }
  })
}

async function placeOf(page: Page, text: string) {
  return log(page).evaluate((el, text) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent?.includes(text)) continue
      const range = document.createRange()
      range.selectNodeContents(walker.currentNode)
      return { top: range.getBoundingClientRect().top, scrollTop: el.scrollTop }
    }
    return { top: -1, scrollTop: el.scrollTop }
  }, text)
}

test('a reader parked at the top keeps loading older pages', async ({ page }) => {
  const hits: Hit[] = []
  await installHermes(page, hits)
  await openThread(page)
  await log(page).evaluate((el) => {
    el.scrollTop = 0
  })
  let maxTop = 0
  await expect
    .poll(
      async () => {
        maxTop = Math.max(maxTop, await log(page).evaluate((el) => el.scrollTop))
        return hits.some((hit) => hit.offset === 480)
      },
      { timeout: 8_000 },
    )
    .toBe(true)
  // The whole climb stays pinned. The bug stopped after the first offset page (120 rows).
  expect(maxTop).toBeLessThan(48)
  expect(hits.map((hit) => hit.offset)).toEqual(expect.arrayContaining([60, 120, 180, 480]))
  const after = hits.length
  await page.waitForTimeout(LATENCY_MS + 400)
  expect(hits).toHaveLength(after)
})

test('the top of a chat past the 500-message window says older ones are not loaded', async ({ page }) => {
  const hits: Hit[] = []
  await installHermes(page, hits)
  await openThread(page)
  const note = page.getByText('Showing the latest 500 messages')
  await expect(note).toHaveCount(0)
  await log(page).evaluate((el) => {
    el.scrollTop = 0
  })
  await expect(note).toBeVisible({ timeout: 10_000 })
  // It sits above the oldest message loaded.
  const [noteTop, firstTop] = await Promise.all([
    note.evaluate((el) => el.getBoundingClientRect().top),
    page.getByText(/^message 101\b/).first().evaluate((el) => el.getBoundingClientRect().top),
  ])
  expect(noteTop).toBeLessThan(firstTop)
})

test('wheeling to the top keeps loading older pages', async ({ page }) => {
  const hits: Hit[] = []
  await installHermes(page, hits)
  await openThread(page)
  const scroller = log(page)
  const box = await scroller.boundingBox()
  if (!box) throw new Error('message log has no box')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  let top = await scroller.evaluate((el) => el.scrollTop)
  for (let i = 0; i < 80 && top >= 48; i++) {
    await page.mouse.wheel(0, -1200)
    top = await scroller.evaluate((el) => el.scrollTop)
  }
  expect(top).toBeLessThan(48)
  await expect.poll(() => hits.some((hit) => hit.offset >= 180), { timeout: 8_000 }).toBe(true)
  expect(await scroller.evaluate((el) => el.scrollTop)).toBeLessThan(48)
})

test('a page that lands mid-thread leaves the reader where they were', async ({ page }) => {
  const hits: Hit[] = []
  await installHermes(page, hits)
  await openThread(page)
  const scroller = log(page)
  // Reach the top so a page starts, then move back down before it arrives.
  await scroller.evaluate((el) => {
    el.scrollTop = 0
  })
  await scroller.evaluate((el) => {
    el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * 0.45)
  })
  const before = await markerAt(page)
  expect(before.text).toMatch(/message \d+/)
  expect(before.scrollTop).toBeGreaterThan(48)
  await expect.poll(() => page.getByText(/message 500\b/).count()).toBeGreaterThan(0)
  const after = await placeOf(page, before.text)
  expect(Math.abs(after.top - before.top)).toBeLessThan(12)
  expect(after.scrollTop).toBeGreaterThan(before.scrollTop)
  await page.waitForTimeout(LATENCY_MS + 500)
  expect(hits.filter((hit) => hit.offset > 0).map((hit) => hit.offset)).toEqual([60])
})

test('a chat opens already at the bottom and does not move after its first paint', async ({ page }) => {
  // Every frame from the first one with messages in it: how far the newest line is from the bottom.
  await page.addInitScript(() => {
    const w = window as unknown as { __frames: { gap: number; top: number }[] }
    w.__frames = []
    // Read just after each frame is painted (a task queued from the frame runs after paint).
    const read = () => {
      const el = document.querySelector('[role=log]')
      const line = [...(el?.querySelectorAll('p') ?? [])].findLast((p) => /message 600\b/.test(p.textContent ?? ''))
      if (el && line && el.scrollHeight > el.clientHeight + 200)
        w.__frames.push({ gap: Math.round(el.scrollHeight - el.clientHeight - el.scrollTop), top: Math.round(line.getBoundingClientRect().top) })
    }
    const tick = () => {
      setTimeout(read, 0)
      if (w.__frames.length < 90) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await installHermes(page, [])
  await page.goto('/test/browser/harness.html')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __frames: unknown[] }).__frames.length), { timeout: 10_000 }).toBeGreaterThanOrEqual(90)
  const frames = await page.evaluate(() => (window as unknown as { __frames: { gap: number; top: number }[] }).__frames)
  // The bug: the first frame sat a screen or more above the end, then the thread slid down to it.
  expect(frames.map((f) => f.gap).filter((gap) => gap > 4)).toEqual([])
  // (The newest turn's own markdown filling in can nudge its first line by a few pixels.)
  expect(Math.max(...frames.map((f) => f.top)) - Math.min(...frames.map((f) => f.top))).toBeLessThan(12)
})

test('a chat opened from a search pages back to the message that matched and lights it', async ({ page }) => {
  const hits: Hit[] = []
  await installHermes(page, hits)
  await page.goto('/test/browser/harness.html?find=message%20503')
  const row = page.locator('[data-row]', { hasText: /message 503\b/ })
  await expect(row).toHaveAttribute('data-found', '', { timeout: 10_000 })
  await expect(row).toBeInViewport()
  // It took one older page, not the whole window.
  expect(hits.map((h) => h.offset)).toEqual([0, 60])
  await page.waitForTimeout(600)
  await expect(row).toBeInViewport()
  await expect(row).not.toHaveAttribute('data-found', { timeout: 4_000 })
})
