import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  outputDir: process.env.MB_REPORT_DIR ? `${process.env.MB_REPORT_DIR}/test-artifacts` : 'test-results',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: process.env.MB_REPORT_DIR
          ? `${process.env.MB_REPORT_DIR}/browser`
          : 'playwright-report',
        open: 'never',
      },
    ],
  ],
  use: {
    baseURL: process.env.MB_TEST_URL || 'http://127.0.0.1:17872',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
});
