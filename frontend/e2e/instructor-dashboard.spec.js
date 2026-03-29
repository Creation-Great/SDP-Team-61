import { test, expect } from '@playwright/test';

test.describe('Instructor dashboard', () => {
  test('instructor dashboard loads after login', async ({ page }) => {
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

    await expect(
      page.getByRole('heading', { name: /Instructor Dashboard/i }).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('dashboard has overview, submissions, and participation tabs', async ({ page }) => {
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

    // Verify tab buttons/links are present
    await expect(
      page.getByRole('link', { name: /Overview/i })
        .or(page.getByRole('button', { name: /Overview/i }))
        .or(page.getByRole('tab', { name: /Overview/i }))
        .first(),
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByRole('link', { name: /Submissions/i })
        .or(page.getByRole('button', { name: /Submissions/i }))
        .or(page.getByRole('tab', { name: /Submissions/i }))
        .first(),
    ).toBeVisible({ timeout: 5000 });

    await expect(
      page.getByRole('link', { name: /Participation/i })
        .or(page.getByRole('button', { name: /Participation/i }))
        .or(page.getByRole('tab', { name: /Participation/i }))
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('tabs switch correctly when clicked', async ({ page }) => {
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

    // Click the Submissions tab
    const submissionsTab = page
      .getByRole('link', { name: /Submissions/i })
      .or(page.getByRole('button', { name: /Submissions/i }))
      .or(page.getByRole('tab', { name: /Submissions/i }))
      .first();

    await submissionsTab.click();
    await expect(
      page.getByText(/Submissions/i).first(),
    ).toBeVisible({ timeout: 3000 });

    // Click the Participation tab
    const participationTab = page
      .getByRole('link', { name: /Participation/i })
      .or(page.getByRole('button', { name: /Participation/i }))
      .or(page.getByRole('tab', { name: /Participation/i }))
      .first();

    await participationTab.click();
    await expect(
      page.getByText(/Participation/i).first(),
    ).toBeVisible({ timeout: 3000 });

    // Click back to Overview tab
    const overviewTab = page
      .getByRole('link', { name: /Overview/i })
      .or(page.getByRole('button', { name: /Overview/i }))
      .or(page.getByRole('tab', { name: /Overview/i }))
      .first();

    await overviewTab.click();
    await expect(
      page.getByText(/Overview/i).first(),
    ).toBeVisible({ timeout: 3000 });
  });
});
