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
    await page.goto('/studio/');
    await expect(page).toHaveURL(/\/studio\/unauthorized/);
    await expect(page.getByRole('heading', { name: 'Unauthorized' })).toBeVisible();
  });
});
