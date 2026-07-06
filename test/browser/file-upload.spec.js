import { expect, test } from '@playwright/test';

const HTML = `<!doctype html><html><body>
  <h1>Uploaded report</h1>
  <img src="x" onerror="alert('xss')">
</body></html>`;

test('renders an uploaded HTML file and reports encoding + sanitizer removals', async ({ page }) => {
  await page.goto('/examples/file-upload/');

  await page.locator('#file').setInputFiles({
    name: 'report.html',
    mimeType: 'text/html',
    buffer: Buffer.from(HTML, 'utf-8'),
  });

  // The file is decoded and rendered in the sandboxed iframe.
  await expect(
    page.frameLocator('iframe[title="HTML preview sandbox"]').getByText('Uploaded report'),
  ).toBeVisible();

  await expect(page.locator('#encoding')).toHaveText('utf-8');
  // The onerror handler must have been stripped and reported.
  await expect(page.locator('#removed')).not.toHaveText('0 (clean)');
  await expect(page.locator('#error')).not.toBeVisible();
});

test('shows the OVERSIZED error state when a file exceeds maxBytes', async ({ page }) => {
  await page.goto('/examples/file-upload/');

  await page.locator('#maxbytes').fill('10');
  await page.locator('#file').setInputFiles({
    name: 'big.html',
    mimeType: 'text/html',
    buffer: Buffer.from(HTML, 'utf-8'), // well over 10 bytes
  });

  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#error')).toContainText('OVERSIZED');
});
