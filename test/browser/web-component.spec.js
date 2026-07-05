import { expect, test } from '@playwright/test';

test('<safe-html-preview> renders a sandboxed iframe from its source property', async ({ page }) => {
  await page.goto('/examples/web-component/');

  const iframe = page.locator('safe-html-preview iframe[title="HTML preview sandbox"]');
  await expect(iframe).toHaveCount(1);

  const sandbox = await iframe.getAttribute('sandbox');
  expect(sandbox).toContain('allow-scripts');
  expect(sandbox).not.toContain('allow-same-origin');

  await expect(
    page.frameLocator('safe-html-preview iframe[title="HTML preview sandbox"]').getByText('Hello from the sandbox'),
  ).toBeVisible();
});

test('<safe-html-preview> forwards external links as openexternal events', async ({ page }) => {
  await page.goto('/examples/web-component/');

  await page
    .frameLocator('safe-html-preview iframe[title="HTML preview sandbox"]')
    .getByText('External link')
    .click();

  await expect.poll(() => page.evaluate(() => window.externalEvents)).toEqual([
    { url: 'https://example.com/', source: 'link' },
  ]);
});
