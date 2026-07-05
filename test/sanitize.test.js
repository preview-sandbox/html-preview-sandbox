import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanitizeHtml } from '../dist/index.js';

function fixture(path) {
  return readFileSync(new URL(`../fixtures/${path}`, import.meta.url), 'utf8');
}

test('sanitizeHtml removes meta refresh', () => {
  const result = sanitizeHtml('<meta http-equiv="refresh" content="0; url=https://evil.test"><p>ok</p>');
  assert.doesNotMatch(result.html, /http-equiv="refresh"/i);
  assert.equal(result.report.removedAttributes.some((item) => item.tag === 'meta'), true);
});

test('sanitizeHtml removes dangerous URL schemes in fallback mode', () => {
  const result = sanitizeHtml('<a href="javascript:alert(1)">bad</a>');
  assert.doesNotMatch(result.html, /javascript:/i);
  assert.equal(result.report.removedSchemes.some((item) => item.scheme === 'javascript:'), true);
});

test('sanitizeHtml can remove scripts when configured', () => {
  const result = sanitizeHtml('<script>alert(1)</script><p>ok</p>', { allowScripts: false });
  assert.doesNotMatch(result.html, /<script/i);
});

test('sanitizeHtml strips automatic event handlers but keeps active click handlers', () => {
  const result = sanitizeHtml(fixture('malicious/auto-event.html'));
  assert.doesNotMatch(result.html, /onload/i);
  assert.doesNotMatch(result.html, /onerror/i);
  assert.match(result.html, /onclick/i);
});

test('sanitizeHtml strips data:text/html links', () => {
  const result = sanitizeHtml(fixture('malicious/data-html-link.html'));
  assert.doesNotMatch(result.html, /data:text\/html/i);
  assert.equal(result.report.removedSchemes.some((item) => item.scheme === 'data:'), true);
});

test('sanitizeHtml strips form action targets', () => {
  const result = sanitizeHtml(fixture('malicious/form-action.html'));
  assert.doesNotMatch(result.html, /action=/i);
});

test('sanitizeHtml strips javascript srcset values', () => {
  const result = sanitizeHtml(fixture('malicious/srcset-javascript.html'));
  assert.doesNotMatch(result.html, /javascript:/i);
});

test('sanitizeHtml strips mixed srcset values with a dangerous candidate', () => {
  const result = sanitizeHtml('<img srcset="https://safe.test/a.png 1x, javascript:alert(1) 2x">');
  assert.doesNotMatch(result.html, /srcset=/i);
  assert.equal(result.report.removedSchemes.some((item) => item.scheme === 'javascript:'), true);
});

test('sanitizeHtml strips SVG javascript xlink href', () => {
  const result = sanitizeHtml(fixture('malicious/svg-xlink.html'));
  assert.doesNotMatch(result.html, /javascript:/i);
});

test('sanitizeHtml removes base tags that hijack relative URLs', () => {
  const result = sanitizeHtml(fixture('malicious/base-injection.html'));
  assert.doesNotMatch(result.html, /<base/i);
  assert.doesNotMatch(result.html, /attacker\.example/i);
});

test('sanitizeHtml removes SVG animation elements targeting URL attributes', () => {
  const result = sanitizeHtml(fixture('malicious/svg-animate-href.html'));
  assert.doesNotMatch(result.html, /javascript:/i);
  assert.doesNotMatch(result.html, /<animate\b/i);
});

test('sanitizeHtml neutralizes mXSS mutation vectors', () => {
  const result = sanitizeHtml(fixture('malicious/mxss-mutation.html'));
  assert.doesNotMatch(result.html, /onerror/i);
  assert.doesNotMatch(result.html, /<img[^>]+src=x/i);
});
