import { defineConfig, devices } from '@playwright/test';

// E2E smoke tests. They only sign in to the public demo accounts and read pages,
// so they are safe to run repeatedly against the live demo.
//
//   npm run test:e2e                              # against https://studeals.vercel.app
//   BASE_URL=http://localhost:3000 npm run test:e2e
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.BASE_URL || 'https://studeals.vercel.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
