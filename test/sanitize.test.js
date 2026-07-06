import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanitizeHtml, buildCsp } from '../dist/index.js';

function fixture(path) {
  return readFileSync(new URL(`../fixtures/${path}`, import.meta.url), 'utf8');
}

test('sanitizeHtml removes meta refresh', () => {
  const result = sanitizeHtml(fixture('malicious/meta-refresh.html'));
  assert.doesNotMatch(result.html, /http-equiv="refresh"/i);
  assert.doesNotMatch(result.html, /attacker\.example/i);
  assert.equal(result.report.removedAttributes.some((item) => item.tag === 'meta'), true);
});

test('sanitizeHtml removes dangerous URL schemes in fallback mode', () => {
  const result = sanitizeHtml(fixture('malicious/javascript-url.html'));
  assert.doesNotMatch(result.html, /javascript:/i);
  assert.equal(result.report.removedSchemes.some((item) => item.scheme === 'javascript:'), true);
});

test('sanitizeHtml neutralizes namespace-confusion mXSS vectors', () => {
  const result = sanitizeHtml(fixture('malicious/mxss-namespace.html'));
  assert.doesNotMatch(result.html, /onerror/i);
  assert.doesNotMatch(result.html, /<img[^>]+src=x/i);
});

test('sanitizeHtml drops connection/prefetch resource-hint links but keeps CSP-governed ones', () => {
  const result = sanitizeHtml(fixture('malicious/link-resource-hints.html'));
  // Connection/prefetch hints removed regardless of CSP.
  assert.doesNotMatch(result.html, /rel="?preconnect/i);
  assert.doesNotMatch(result.html, /rel="?dns-prefetch/i);
  assert.doesNotMatch(result.html, /rel="?prefetch/i);
  assert.doesNotMatch(result.html, /rel="?prerender/i);
  assert.doesNotMatch(result.html, /attacker\.example/i);
  // Legitimate, CSP-governed links survive.
  assert.match(result.html, /rel="?stylesheet/i);
  assert.match(result.html, /rel="?preload/i);
  assert.match(result.html, /rel="?icon/i);
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

test('sanitizeHtml removes formaction override targets', () => {
  const result = sanitizeHtml(fixture('malicious/formaction-override.html'));
  assert.doesNotMatch(result.html, /formaction/i);
  assert.doesNotMatch(result.html, /attacker\.example/i);
});

test('sanitizeHtml removes nested iframes and their srcdoc payloads', () => {
  const result = sanitizeHtml(fixture('malicious/nested-iframe.html'));
  assert.doesNotMatch(result.html, /<iframe/i);
  assert.doesNotMatch(result.html, /attacker\.example/i);
});

test('sanitizeHtml strips obfuscated javascript: schemes (entities, whitespace, case)', () => {
  const result = sanitizeHtml(fixture('malicious/encoded-protocol.html'));
  // No decoded javascript: scheme should survive on any href
  assert.doesNotMatch(result.html, /href\s*=\s*["'][^"']*javascript:/i);
  assert.doesNotMatch(result.html, /alert\(/i);
});

test('sanitizeHtml strips srcset candidates with irregular whitespace and descriptors', () => {
  const result = sanitizeHtml('<img srcset="  https://safe.test/a.png   1x ,\tjavascript:alert(1)\n2x ">');
  assert.doesNotMatch(result.html, /javascript:/i);
  assert.doesNotMatch(result.html, /srcset=/i);
});

test('CSS url() exfiltration: sanitizer preserves styling, strict CSP blocks the host', () => {
  // Layering check: the sanitizer keeps the style (legitimate interactivity),
  // and the strict CSP is what actually blocks the exfiltration request.
  const result = sanitizeHtml(fixture('malicious/css-url-exfil.html'));
  assert.match(result.html, /background/i); // style preserved
  const csp = buildCsp('strict');
  // img-src (which governs CSS url() image loads) has no wildcard host under strict
  assert.doesNotMatch(csp, /img-src[^;]*https:/);
});
