import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // ai-generated.spec.ts is produced by `npm run generate-tests` — run it explicitly with `npm run test:ai-generated`
  testIgnore: process.env.RUN_AI_GENERATED ? [] : ['**/ai-generated.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'https://cal.com',
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Optional: spin up a local Cal.com fork (or any web app under test) before
  // the suite runs. Uncomment and adjust the `command` and `url` for your
  // self-hosted setup. With this enabled, set BASE_URL=http://localhost:3000
  // when invoking Playwright so `use.baseURL` above points at your dev server.
  //
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   timeout: 120_000,
  //   reuseExistingServer: !process.env.CI,
  // },
});
