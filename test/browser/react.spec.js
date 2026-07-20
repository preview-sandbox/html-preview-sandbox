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
  await expect(page.locator('#log .entry.external')).toContainText('https://example.com/');
});

test('unmounting the component removes the iframe', async ({ page }) => {
  await page.click('#btn-unmount');
  await expect(page.locator('#preview-root iframe')).toHaveCount(0);
});

test('remounting after unmount brings the preview back', async ({ page }) => {
  await page.click('#btn-unmount');
  await expect(page.locator('#preview-root iframe')).toHaveCount(0);
  await page.click('#btn-unmount');
  await expect(page.frameLocator('#preview-root iframe').locator('h1')).toHaveText('Hello from React');
});

test('the forwarded ref exposes the PreviewHandle', async ({ page }) => {
  await page.click('#btn-ref-render');
  await expect(page.frameLocator('#preview-root iframe').locator('h1')).toHaveText('Rendered via ref');
});

test('sanitizer reports are surfaced through onSanitize', async ({ page }) => {
  // The initial document carries an onerror attribute that the sanitizer strips.
  await expect(page.locator('#log .entry.sanitize').first()).toContainText('sanitize: removed');
});

test('switching the csp prop rewrites the CSP of the rendered document', async ({ page }) => {
  const meta = page.frameLocator('#preview-root iframe').locator('meta[http-equiv="Content-Security-Policy"]');
  await expect(meta).toHaveAttribute('content', /connect-src[^;]*'none'/);
  await page.selectOption('#csp-select', 'balanced');
  await expect(meta).toHaveAttribute('content', /connect-src[^;]*https:/);
});

test('an oversized Blob source surfaces OVERSIZED through onError', async ({ page }) => {
  await page.click('#btn-oversize');
  await expect(page.locator('#log .entry.error')).toContainText('OVERSIZED');
  // The previous trusted document stays in place after the failed render.
  await expect(page.frameLocator('#preview-root iframe').locator('h1')).toHaveText('Hello from React');
});
