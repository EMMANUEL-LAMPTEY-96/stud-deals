import { test as base, expect, type Page } from '@playwright/test';

// Shared fixtures for the smoke tests:
//  - pre-answers the cookie banner with "essential only", so it never covers the
//    page and test runs never initialise product analytics
//  - fails the test if any visited page throws an uncaught error
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(`${page.url()}: ${err.message}`));
      await use(errors);
      expect(errors, 'uncaught page errors').toEqual([]);
    },
    { auto: true },
  ],
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem(
          'studeals_consent_v2',
          JSON.stringify({ necessary: true, analytics: false, marketing: false, ts: Date.now() }),
        );
      } catch { /* storage unavailable */ }
    });
    await use(page);
  },
});

export { expect };

/** Signs in with one of the one-click demo accounts on /login. */
export async function loginAsDemo(page: Page, role: 'student' | 'vendor') {
  await page.goto('/login');
  await page.getByRole('button', { name: role === 'student' ? 'Try as Student' : 'Try as Vendor' }).click();
  await page.waitForURL(role === 'student' ? /\/dashboard/ : /\/vendor\/?$/, { timeout: 30_000 });
}
