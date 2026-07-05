import test from 'node:test';
import assert from 'node:assert/strict';
import { createHtmlDocument } from '../dist/index.js';

test('createHtmlDocument returns final HTML with CSP and bridge', async () => {
  const result = await createHtmlDocument('<h1>Hello</h1>');
  assert.match(result.html, /Content-Security-Policy/);
  assert.match(result.html, /html-preview-sandbox:openExternal/);
  assert.equal(result.encoding, 'utf-8');
});
