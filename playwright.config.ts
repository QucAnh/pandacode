import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Every spec under tests/ runs; only this one is excluded on purpose. Keep it a
  // glob so a new spec file needs no edit here (and upstream syncs stop conflicting).
  testMatch: '**/*.spec.ts',
  testIgnore: '**/approval-modes.spec.ts',
  fullyParallel: true,
  workers: Number(process.env.PW_WORKERS ?? 4),
  timeout: 20_000,
  expect: { timeout: 5_000 },
  reporter: 'list',
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:1420',
    viewport: { width: 1440, height: 940 },
    headless: true,
    launchOptions: {
      // Playwright creates disposable browser contexts; never use a personal profile.
      executablePath: process.env.PANDACODE_TEST_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:1420',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
