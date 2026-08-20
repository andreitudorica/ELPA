import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Bare end-to-end smoke test (ADR 0017): asserts the Recommendation Product
 * landing renders and passes an axe accessibility sweep (WCAG 2.0/2.1 A+AA).
 * Feature-specific specs land alongside the features they cover.
 */
test.describe('smoke', () => {
  test('Recommendation Product landing renders and is accessible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const serious = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    );
    expect(serious.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
  });

  test('Data Studio without identity redirects to /studio/unauthorized', async ({ page }) => {
    // Bypass the MSW service worker for this test: the SW is racy on a fresh
    // browser context (it may not control the page in time to intercept the
    // first `/api/me`), so we disable it and stub the endpoint at Playwright's
    // network layer instead. `addInitScript` runs before any page script, so
    // `main.tsx` sees the flag and skips `worker.start()`.
    await page.addInitScript(() => {
      (window as unknown as { __ELPA_E2E_DISABLE_MOCKS__: boolean }).__ELPA_E2E_DISABLE_MOCKS__ =
        true;
    });
    await page.route('**/api/me', (route) => route.fulfill({ status: 401 }));
    await page.goto('/studio/');
    await expect(page).toHaveURL(/\/studio\/unauthorized/);
    await expect(page.getByRole('heading', { name: 'Unauthorized' })).toBeVisible();
  });
});
