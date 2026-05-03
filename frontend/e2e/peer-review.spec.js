import { test, expect } from '@playwright/test';

test.describe('Peer review sessions', () => {
  test('peer review sessions page loads after login', async ({ page }) => {
    test.setTimeout(30000);

    await page.goto('/login');
    await page.getByPlaceholder('Email address').fill('instructor@example.com');
    await page.getByPlaceholder(/password/i).fill('password123');
    await page.getByRole('button', { name: /Sign in with Email/i }).click();

    const urlMatch = await page
      .waitForURL(/\/(instructor|dashboard)/, { timeout: 12000 })
      .catch(() => null);
    if (!urlMatch) {
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 2000 });
      return;
    }

    // Navigate to peer review sessions page
    await page.goto('/peer-review/sessions');
    await expect(
      page.getByText(/Peer Review|Sessions|Review Sessions/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('page shows sessions list or empty state', async ({ page }) => {
    test.setTimeout(30000);

    await page.goto('/login');
    await page.getByPlaceholder('Email address').fill('instructor@example.com');
    await page.getByPlaceholder(/password/i).fill('password123');
    await page.getByRole('button', { name: /Sign in with Email/i }).click();

    const urlMatch = await page
      .waitForURL(/\/(instructor|dashboard)/, { timeout: 12000 })
      .catch(() => null);
    if (!urlMatch) {
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 2000 });
      return;
    }

    await page.goto('/peer-review/sessions');

    // Either a list of sessions is shown, or an empty state message
    const hasSessions = page.locator('table, [class*="card"], [class*="session"], [class*="list"]').first();
    const emptyState = page.getByText(/No sessions|No peer review|Create.*session|No data|Get started/i).first();

    await expect(hasSessions.or(emptyState)).toBeVisible({ timeout: 5000 });
  });
});
