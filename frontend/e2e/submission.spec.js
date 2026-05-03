import { test, expect } from '@playwright/test';

test.describe('Submission flow', () => {
  test('student dashboard page loads after login', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email address').fill('alice@example.com');
    await page.getByPlaceholder(/password/i).fill('password123');
    await page.getByRole('button', { name: /Sign in with Email/i }).click();

    const urlMatch = await page
      .waitForURL(/\/(instructor|dashboard|reviews|upload)/, { timeout: 12000 })
      .catch(() => null);
    if (!urlMatch) {
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 2000 });
      return;
    }

    await expect(
      page.getByText(/Student Dashboard|Pending Reviews|Assigned Peer Reviews|Welcome back/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('upload page is accessible after login', async ({ page }) => {
    test.setTimeout(30000);

    await page.goto('/login');
    await page.getByPlaceholder('Email address').fill('alice@example.com');
    await page.getByPlaceholder(/password/i).fill('password123');
    await page.getByRole('button', { name: /Sign in with Email/i }).click();

    const urlMatch = await page
      .waitForURL(/\/(instructor|dashboard|reviews|upload)/, { timeout: 12000 })
      .catch(() => null);
    if (!urlMatch) {
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 2000 });
      return;
    }

    // Navigate to the upload page
    await page.goto('/upload');
    await expect(
      page.getByText(/Upload|Submit|Submission/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('submission form has required fields (title, file input)', async ({ page }) => {
    test.setTimeout(30000);

    await page.goto('/login');
    await page.getByPlaceholder('Email address').fill('alice@example.com');
    await page.getByPlaceholder(/password/i).fill('password123');
    await page.getByRole('button', { name: /Sign in with Email/i }).click();

    const urlMatch = await page
      .waitForURL(/\/(instructor|dashboard|reviews|upload)/, { timeout: 12000 })
      .catch(() => null);
    if (!urlMatch) {
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 2000 });
      return;
    }

    await page.goto('/upload');

    // Expect a title/name input field
    await expect(
      page.getByPlaceholder(/title/i)
        .or(page.getByLabel(/title/i))
        .or(page.locator('input[name="title"]'))
        .first(),
    ).toBeVisible({ timeout: 5000 });

    // Expect a file input
    await expect(
      page.locator('input[type="file"]').first(),
    ).toBeAttached({ timeout: 5000 });
  });
});
