import { expect, test } from '@playwright/test';

test('playground toggles to the sanitized HTML view of the pipeline output', async ({ page }) => {
  await page.goto('/playground/');
  // The report sample auto-renders on load.
  await expect(page.locator('#run-state')).toHaveText('rendered');

  await page.locator('input[name="view"][value="html"]').check({ force: true });

  const view = page.locator('#sanitized-view');
  await expect(view).toBeVisible();
  await expect(page.locator('#preview')).toBeHidden();
  // The sanitized view shows the exact document the pipeline produced.
  await expect(view.locator('code')).toContainText('Content-Security-Policy');
  await expect(view.locator('code')).toContainText('html-preview-sandbox:openExternal');
});

test('playground Share encodes input + preset into a restorable URL', async ({ page }) => {
  await page.goto('/playground/');

  await page.locator('#source').fill('<h1>Shared repro</h1>');
  await page.locator('input[name="preset"][value="balanced"]').check({ force: true });
  await page.locator('#share').click();

  await expect(page).toHaveURL(/#s=/);

  // A recipient opening the link (a reload keeps the hash) gets the same state.
  await page.reload();
  await expect(page.locator('#source')).toHaveValue('<h1>Shared repro</h1>');
  await expect(page.locator('input[name="preset"][value="balanced"]')).toBeChecked();
});

test('playground loads a dropped HTML file into the editor and renders it', async ({ page }) => {
  await page.goto('/playground/');

  // Simulate dropping a file: the custom handler reads dataTransfer.files.
  await page.evaluate(() => {
    const panel = document.querySelector('.editor-panel');
    const file = new File(['<h1>Dropped content</h1>'], 'dropped.html', { type: 'text/html' });
    const dt = new DataTransfer();
    dt.items.add(file);
    panel.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }));
  });

  await expect(page.locator('#source')).toHaveValue(/Dropped content/);
  await expect(page.locator('#run-state')).toHaveText('rendered');
});
