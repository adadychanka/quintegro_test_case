import { defineConfig, devices } from '@playwright/test'

// The stack runs with the 1.5 s delay and injected 500s on: timeouts are generous.
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080/runtime/',
    trace: 'retain-on-failure',
    actionTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
