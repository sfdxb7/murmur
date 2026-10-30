import { defineConfig, devices } from '@playwright/test'

// Text selection in the chat playground, on a phone-sized touch screen.
export default defineConfig({
  testDir: 'test/selection',
  testMatch: '**/*.browser.ts',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  workers: 1,
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://127.0.0.1:5181',
  },
  webServer: {
    command: 'npx vite --port 5181 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:5181/playground.html',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
