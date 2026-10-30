import { expect, test } from '@playwright/test'

// use-draft.ts writes a draft a beat after typing stops. Leaving sooner keeps it too.

test('a draft typed just before switching chats is still there coming back', async ({ page }) => {
  await page.goto('/test/browser/draft.html')
  const box = page.getByLabel('Message')
  await box.fill('half a thought')
  await page.getByRole('button', { name: 'Switch' }).click()
  await expect(page.getByText('chat b')).toBeVisible()
  await expect(box).toHaveValue('')
  await page.getByRole('button', { name: 'Switch' }).click()
  await expect(box).toHaveValue('half a thought')
})

test('a draft typed just before the page goes away is there after a reload', async ({ page }) => {
  await page.goto('/test/browser/draft.html')
  const box = page.getByLabel('Message')
  await box.fill('typed then gone')
  await page.reload()
  await expect(box).toHaveValue('typed then gone')
})
