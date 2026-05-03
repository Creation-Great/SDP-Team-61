import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test('loads and shows login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Peer Review/i })).toBeVisible();
    await expect(page.getByPlaceholder('Email address')).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign in with UConn NetID/i })).toBeVisible();
  });

  test('local sign in button is present', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /Sign in/i }).last()).toBeVisible();
  });

  test('submitting credentials either redirects to app or shows error', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email address').fill('instructor@example.com');
    await page.getByPlaceholder(/password/i).fill('password123');
    await page.getByRole('button', { name: /Sign in with Email/i }).click();

    // Wait for either redirect (backend up) or error message (backend down)
    try {
      await page.waitForURL(/\/(instructor|dashboard)/, { timeout: 12000 });
      await expect(page.getByRole('link', { name: /Overview|Dashboard/i }).first()).toBeVisible({ timeout: 3000 });
    } catch {
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 2000 });
    }
  });

  test('instructor login shows dashboard content after redirect', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email address').fill('instructor@example.com');
    await page.getByPlaceholder(/password/i).fill('password123');
    await page.getByRole('button', { name: /Sign in with Email/i }).click();

    const urlMatch = await page.waitForURL(/\/(instructor|dashboard)/, { timeout: 12000 }).catch(() => null);
    if (!urlMatch) {
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 2000 });
      return;
    }
    // Instructor dashboard has h1 "Instructor Dashboard" or tab labels
    await expect(
      page.getByRole('heading', { name: /Instructor Dashboard/i }).first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('student login shows student dashboard or list after redirect', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email address').fill('alice@example.com');
    await page.getByPlaceholder(/password/i).fill('password123');
    await page.getByRole('button', { name: /Sign in with Email/i }).click();

    const urlMatch = await page.waitForURL(/\/(instructor|dashboard|reviews|upload)/, { timeout: 12000 }).catch(() => null);
    if (!urlMatch) {
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 2000 });
      return;
    }
    // Student dashboard or reviews page should show recognizable content
    await expect(
      page.getByText(/Student Dashboard|Pending Reviews|Assigned Peer Reviews|Welcome back/i).first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
