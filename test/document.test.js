import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHtmlDocument, sanitizeHtml, buildCsp } from '../dist/index.js';

function fixture(path) {
  return readFileSync(new URL(`../fixtures/${path}`, import.meta.url), 'utf8');
}

test('createHtmlDocument returns final HTML with CSP and bridge', async () => {
  const result = await createHtmlDocument('<h1>Hello</h1>');
  assert.match(result.html, /Content-Security-Policy/);
  assert.match(result.html, /html-preview-sandbox:openExternal/);
  assert.equal(result.encoding, 'utf-8');
});

test('createHtmlDocument injects a head and CSP when the input has no head', async () => {
  const result = await createHtmlDocument(fixture('edge/no-head.html'));
  // injectCspMeta must still place the CSP meta even without an author <head>.
  assert.match(result.html, /<head>[\s\S]*Content-Security-Policy/);
});

test('empty input sanitizes to an empty document flagged strippedAll', () => {
  // DOMPurify WHOLE_DOCUMENT wraps empty input into a bare html/head/body shell,
  // so the string is not blank; the report's strippedAll flag is the real signal
  // that there was no renderable content.
  const result = sanitizeHtml(fixture('edge/empty.html'));
  assert.equal(result.report.strippedAll, true);
});

test('createHtmlDocument tolerates malformed nesting without throwing', async () => {
  const result = await createHtmlDocument(fixture('edge/malformed-nesting.html'));
  assert.match(result.html, /Content-Security-Policy/);
  assert.match(result.html, /item without closing list/);
});

test('strict preset preserves whitelisted CDN scripts in a benign report', async () => {
  const result = await createHtmlDocument(fixture('benign/cdn-chart-report.html'), { csp: 'strict' });
  // The chart report loads jsdelivr + tailwind, which strict allows.
  assert.match(result.html, /cdn\.jsdelivr\.net/);
  assert.match(result.html, /cdn\.tailwindcss\.com/);
  assert.match(buildCsp('strict'), /script-src[^;]*cdn\.jsdelivr\.net/);
});

test('benign interactive content survives sanitization with its click handler', () => {
  const result = sanitizeHtml(fixture('benign/interactive-report.html'));
  assert.match(result.html, /onclick/i);
  assert.equal(result.report.strippedAll, false);
});
