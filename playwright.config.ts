import { defineConfig, devices } from '@playwright/test';

// AI-generated specs are quarantined: they run on a separate cadence (see
// .github/workflows/ai-quarantine.yml) and never gate PRs. Locally, opt in via
// `RUN_AI_GENERATED=1 npm test` or `npm run test:ai-generated`.
const RUN_AI_GENERATED = !!process.env.RUN_AI_GENERATED;

// The toolkit ships with example suites under tests/examples/. Set
// SKIP_EXAMPLES=1 to run only tests/toolkit/ — useful for offline CI.
const SKIP_EXAMPLES = !!process.env.SKIP_EXAMPLES;

const QUARANTINE_GLOB = '**/ai-generated.spec.ts';

export default defineConfig({
  testDir: './tests',
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
    // Toolkit-level checks: CLI/MCP smoke. Run with no network and no API keys.
    {
      name: 'toolkit',
      testDir: './tests/toolkit',
      use: { ...devices['Desktop Chrome'] },
      retries: 0,
    },
    // Example suites — exercised against a live demo target (cal.com by default).
    // Skipped entirely when SKIP_EXAMPLES=1.
    {
      name: 'examples-chromium',
      testDir: './tests/examples',
      testIgnore: SKIP_EXAMPLES ? ['**/*.spec.ts'] : [QUARANTINE_GLOB],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'examples-firefox',
      testDir: './tests/examples',
      testIgnore: SKIP_EXAMPLES ? ['**/*.spec.ts'] : [QUARANTINE_GLOB],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'examples-webkit',
      testDir: './tests/examples',
      testIgnore: SKIP_EXAMPLES ? ['**/*.spec.ts'] : [QUARANTINE_GLOB],
      use: { ...devices['Desktop Safari'] },
    },
    // Dedicated quarantine project — generous retries and visually distinct.
    {
      name: 'ai-quarantine',
      testDir: './tests',
      testMatch: [QUARANTINE_GLOB],
      testIgnore: RUN_AI_GENERATED ? [] : ['**/*.spec.ts'],
      retries: 3,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Optional: spin up a local fork (or any web app under test) before
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
