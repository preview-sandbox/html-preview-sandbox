import { expect, test } from '@playwright/test';

// Defense-in-depth: even isolated from the sanitizer and CSP (which normally strip
// javascript: first), the bridge itself must preventDefault so a javascript: link
// click cannot execute its payload.
test('bridge blocks javascript: link execution via preventDefault', async ({ page }) => {
  await page.goto('/test/browser/bridge-harness.html');

  // Record whether the javascript: payload managed to postMessage the parent.
  await page.evaluate(() => {
    window.__jsRan = false;
    window.addEventListener('message', (e) => {
      if (e.data === 'JS_RAN') window.__jsRan = true;
    });
    window.mountJavascriptLink();
  });

  await page.frameLocator('iframe[title="bridge harness frame"]').locator('#js-link').click();

  // Give any (incorrectly) triggered navigation/script time to fire.
  await page.waitForTimeout(300);

  expect(await page.evaluate(() => window.__jsRan)).toBe(false);
});
