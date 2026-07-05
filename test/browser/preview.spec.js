import { expect, test } from '@playwright/test';

test('web example renders an opaque-origin sandboxed iframe', async ({ page }) => {
  await page.goto('/examples/web/');

  const iframe = page.locator('iframe[title="HTML preview sandbox"]');
  await expect(iframe).toHaveCount(1);

  const sandbox = await iframe.getAttribute('sandbox');
  expect(sandbox).toContain('allow-scripts');
  expect(sandbox).not.toContain('allow-same-origin');
});

test('external links are bridged to the host callback', async ({ page }) => {
  await page.goto('/examples/web/');

  await page.frameLocator('iframe[title="HTML preview sandbox"]').getByText('External link').click();
  await expect.poll(() => page.evaluate(() => window.externalEvents)).toEqual([
    { url: 'https://example.com/', source: 'link' },
  ]);
});

test('external link policy blocks disallowed protocols and custom URL decisions', async ({ page }) => {
  await page.goto('/examples/web/');

  await page.evaluate(async () => {
    window.externalEvents = [];
    window.preview.updateOptions({ externalProtocols: ['https'] });
    await window.preview.render('<a href="mailto:hello@example.com">Mail link</a>');
  });
  await page.frameLocator('iframe[title="HTML preview sandbox"]').getByText('Mail link').click();
  await expect.poll(() => page.evaluate(() => window.externalEvents)).toEqual([]);

  await page.evaluate(async () => {
    window.preview.updateOptions({
      externalProtocols: ['https:'],
      allowExternalUrl: (url) => new URL(url).hostname === 'allowed.example',
    });
    await window.preview.render('<a href="https://blocked.example/path">Blocked link</a>');
  });
  await page.frameLocator('iframe[title="HTML preview sandbox"]').getByText('Blocked link').click();
  await expect.poll(() => page.evaluate(() => window.externalEvents)).toEqual([]);

  await page.evaluate(async () => {
    await window.preview.render('<a href="https://allowed.example/path">Allowed link</a>');
  });
  await page.frameLocator('iframe[title="HTML preview sandbox"]').getByText('Allowed link').click();
  await expect.poll(() => page.evaluate(() => window.externalEvents)).toEqual([
    { url: 'https://allowed.example/path', source: 'link' },
  ]);
});

test('host navigation attempts remount the last trusted srcdoc', async ({ page }) => {
  await page.goto('/examples/web/');
  await expect(page.locator('iframe[title="HTML preview sandbox"]')).toHaveCount(1);

  await page.evaluate(() => window.preview.notifyNavigationAttempt('https://example.com/nav'));
  await expect.poll(() => page.evaluate(() => window.externalEvents)).toEqual([
    { url: 'https://example.com/nav', source: 'navigation' },
  ]);

  await expect(page.frameLocator('iframe[title="HTML preview sandbox"]').getByText('Hello from the sandbox')).toBeVisible();
});
