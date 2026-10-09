import { test, expect } from './fixtures';

test.describe('logged out', () => {
  test('/ redirects to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('/dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/);
  });

  test('public vendor page /vendor/demo-cafe is reachable', async ({ page }) => {
    await page.goto('/vendor/demo-cafe');
    await expect(page).toHaveURL(/\/vendor\/demo-cafe$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Demo Caf/i);
  });
});
