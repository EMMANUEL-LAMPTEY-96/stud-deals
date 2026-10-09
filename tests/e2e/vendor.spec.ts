import { test, expect, loginAsDemo } from './fixtures';

// Read-only: only opens pages.
test('demo vendor: dashboard, analytics, billing', async ({ page }) => {
  await loginAsDemo(page, 'vendor');
  await expect(page.getByRole('heading', { name: 'Loyalty Programs' })).toBeVisible();

  await page.goto('/vendor/analytics');
  await expect(page.getByRole('heading', { name: 'Analytics', level: 1 })).toBeVisible();

  await page.goto('/vendor/billing');
  await expect(page.getByRole('heading', { name: 'Billing', level: 1 })).toBeVisible();
  await expect(page.getByText('Demo — payments disabled.')).toBeVisible();
});
