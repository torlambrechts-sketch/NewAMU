import { defineConfig, devices } from '@playwright/test'

/* Playwright config for the Strategy v2 end-to-end smoke sweep.
   Auto-starts the Vite dev server (which reads .env.local for the Supabase
   connection) and runs the e2e specs headless against it. Credentials for the
   seeded demo admin come from E2E_EMAIL / E2E_PASSWORD (defaults below). */

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    headless: true,
    // The sandbox egresses via a MITM proxy whose CA Chromium's own store
    // doesn't trust — accept it so browser fetches to Supabase succeed.
    ignoreHTTPSErrors: true,
    launchOptions: { args: ['--no-sandbox', '--ignore-certificate-errors'] },
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: process.env.E2E_BASE_URL || 'http://localhost:5173',
    timeout: 120_000,
    reuseExistingServer: true,
  },
})
