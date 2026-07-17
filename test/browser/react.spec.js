import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/examples/react/');
});

test('React wrapper renders an opaque-origin sandboxed iframe', async ({ page }) => {
  const iframe = page.locator('#preview-root iframe');
  await expect(iframe).toBeVisible();
  const sandbox = await iframe.getAttribute('sandbox');
  expect(sandbox).toContain('allow-scripts');
  expect(sandbox).not.toContain('allow-same-origin');
  await expect(page.frameLocator('#preview-root iframe').locator('h1')).toHaveText('Hello from React');
});

test('updating the source prop re-renders the document', async ({ page }) => {
  await page.click('#btn-swap');
  await expect(page.frameLocator('#preview-root iframe').locator('h1')).toHaveText('Second document');
});

test('external links are surfaced through onOpenExternal', async ({ page }) => {
  await page.frameLocator('#preview-root iframe').locator('a').click();
  await expect.poll(() => page.evaluate(() => window.__events)).toContain('https://example.com/');
});

test('unmounting the component removes the iframe', async ({ page }) => {
  await page.click('#btn-unmount');
  await expect(page.locator('#preview-root iframe')).toHaveCount(0);
});

test('the forwarded ref exposes the PreviewHandle', async ({ page }) => {
  await page.click('#btn-ref-render');
  await expect(page.frameLocator('#preview-root iframe').locator('h1')).toHaveText('Rendered via ref');
});
