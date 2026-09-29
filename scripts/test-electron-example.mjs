import assert from 'node:assert/strict';
import { _electron as electron } from '@playwright/test';

const injection = '<img id="electron-log-injection" src="invalid:">';
let app;

try {
  app = await electron.launch({ args: ['examples/electron/main.cjs'] });
  await app.evaluate(({ shell }) => {
    globalThis.__electronSmokeOpenedUrls = [];
    shell.openExternal = async (url) => {
      globalThis.__electronSmokeOpenedUrls.push(url);
    };
  });
  const page = await app.firstWindow();

  assert.equal(await page.title(), 'html-preview-sandbox — Electron example');

  const previewFrame = page.locator('iframe').contentFrame();
  await previewFrame.getByText('Interactive report').waitFor({ timeout: 15_000 });

  await app.evaluate(({ BrowserWindow }, payload) => {
    BrowserWindow.getAllWindows()[0].webContents.send('preview:navigation-attempt', payload);
  }, injection);

  await page.locator('#log code').first().waitFor({ timeout: 5_000 });
  assert.equal(await page.locator('#log code').first().textContent(), injection);
  assert.equal(await page.locator('#electron-log-injection').count(), 0);

  const navigationUrl = 'https://evil.example/phishing';
  await previewFrame.getByRole('button', { name: 'Hijack the preview' }).click();
  await page.locator('.entry.block code').filter({ hasText: navigationUrl }).first().waitFor({ timeout: 5_000 });
  await page.waitForTimeout(300);

  assert.equal(await page.locator('.entry.block code').filter({ hasText: navigationUrl }).count(), 1);
  assert.equal(await page.locator('.entry.ext code').filter({ hasText: navigationUrl }).count(), 1);
  assert.deepEqual(await app.evaluate(() => globalThis.__electronSmokeOpenedUrls), [navigationUrl]);
  await previewFrame.getByText('Interactive report').waitFor({ timeout: 5_000 });

  console.log('Electron example smoke test passed.');
} finally {
  if (app) await app.close();
}
