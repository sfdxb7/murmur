import { expect, test, type Locator, type Page } from '@playwright/test'

async function open(page: Page) {
  await page.goto('/playground.html?scene=solo&bare')
  const log = page.locator('[role=log]')
  await expect.poll(() => log.locator('article p').count()).toBeGreaterThan(0)
  return log
}

/** The first settled reply paragraph with a few words in it. */
function replyWords(log: Locator) {
  return log
    .locator('article:not([aria-busy=true]) p')
    .filter({ hasText: /\w+ \w+ \w+/ })
    .first()
}

const selectable = (el: Locator) =>
  el.evaluate((node) => {
    const style = getComputedStyle(node)
    return { userSelect: style.userSelect, callout: style.getPropertyValue('-webkit-touch-callout') || 'default' }
  })

test('a reply can be selected on a phone, partly, with the system menu', async ({ page }) => {
  const log = await open(page)
  const words = replyWords(log)
  const style = await selectable(words)
  expect(style.userSelect).not.toBe('none')
  expect(style.callout).not.toBe('none')
  // Select a few words in the middle, the way the handles would.
  const picked = await words.evaluate((p) => {
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT)
    const node = walker.nextNode() as Text
    const range = document.createRange()
    range.setStart(node, 2)
    range.setEnd(node, Math.min(node.length, 14))
    const sel = window.getSelection()!
    sel.removeAllRanges()
    sel.addRange(range)
    return sel.toString()
  })
  expect(picked.length).toBeGreaterThan(0)
  expect(picked).toBe(await page.evaluate(() => window.getSelection()!.toString()))
})

test('your own message can be selected too', async ({ page }) => {
  const log = await open(page)
  const bubble = log.locator('.group\\/user > div.relative > div > span').filter({ hasText: /\w/ }).first()
  expect((await selectable(bubble)).userSelect).not.toBe('none')
  expect(
    await bubble.evaluate((span) => {
      window.getSelection()!.selectAllChildren(span)
      return window.getSelection()!.toString()
    }),
  ).not.toBe('')
})

test('holding a reply leaves the selection to the system: no copy, no toast', async ({ page }) => {
  const log = await open(page)
  const words = replyWords(log)
  const box = (await words.boundingBox())!
  const at = { x: box.x + 20, y: box.y + box.height / 2 }
  // A touch hold: pointer down, a long wait, then the contextmenu a long-press raises.
  const prevented = await words.evaluate(async (p, at) => {
    const init = {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      clientX: at.x,
      clientY: at.y,
      isPrimary: true,
    }
    p.dispatchEvent(new PointerEvent('pointerdown', init))
    await new Promise((r) => setTimeout(r, 900))
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: at.x, clientY: at.y })
    p.dispatchEvent(menu)
    p.dispatchEvent(new PointerEvent('pointerup', init))
    return menu.defaultPrevented
  }, at)
  expect(prevented).toBe(false)
  await page.waitForTimeout(400)
  await expect(page.getByText('Copied')).toHaveCount(0)
  await expect(page.getByRole('menu')).toHaveCount(0)
})

test('links in a reply still open on a tap', async ({ page }) => {
  await page.goto('/playground.html?scene=live&bare')
  const link = page.locator('[role=log] article a[href*="docs.rs"]').first()
  await expect(link).toBeVisible({ timeout: 30_000 })
  const prevented = await link.evaluate((a) => {
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    let seen = false
    // Catch the tap at the window, after the app had its turn, and stop the navigation there.
    window.addEventListener(
      'click',
      (e) => {
        seen = !e.defaultPrevented
        e.preventDefault()
      },
      { once: true },
    )
    a.dispatchEvent(click)
    return !seen
  })
  expect(prevented).toBe(false)
})
