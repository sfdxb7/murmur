import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'test/browser',
  testMatch: '**/*.browser.ts',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5179',
    viewport: { width: 390, height: 700 },
  },
  webServer: {
    command: 'npx vite --port 5179 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:5179/test/browser/harness.html',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
