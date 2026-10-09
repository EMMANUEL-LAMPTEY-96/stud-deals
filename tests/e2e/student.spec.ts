import { test, expect, loginAsDemo } from './fixtures';

// Read-only: never claims, saves or stamps anything.
test('demo student: dashboard, offer, vouchers, loyalty', async ({ page }) => {
  await loginAsDemo(page, 'student');

  const offerLinks = page.locator('a[href^="/offer/"]');
  await expect(offerLinks.first()).toBeVisible();

  await offerLinks.first().click();
  await expect(page).toHaveURL(/\/offer\/[0-9a-f-]+/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.goto('/my-vouchers');
  await expect(page.getByRole('heading', { name: 'My Vouchers' })).toBeVisible();

  await page.goto('/my-loyalty');
  await expect(page.getByRole('heading', { name: 'My Loyalty Cards' })).toBeVisible();
});
