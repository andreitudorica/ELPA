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
    // Dev-mode MSW stubs an Administrator for `/api/me` by default. The mock
    // handler reads this window flag to drop the identity so we can assert the
    // unauthorized redirect. `addInitScript` runs before any page script, so
    // the flag is set by the time MSW handlers execute (they run in the page
    // context via BroadcastChannel, so `window` is reachable). Playwright's
    // `page.route` cannot intercept because MSW handles the fetch inside the
    // page's service worker.
    await page.addInitScript(() => {
      (window as unknown as { __ELPA_E2E_NO_IDENTITY__: boolean }).__ELPA_E2E_NO_IDENTITY__ = true;
    });
    await page.goto('/studio/');
    await expect(page).toHaveURL(/\/studio\/unauthorized/);
    await expect(page.getByRole('heading', { name: 'Unauthorized' })).toBeVisible();
  });
});
