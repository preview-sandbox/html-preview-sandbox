import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCsp,
  getSandboxAttribute,
  injectBridgeScript,
  injectCspMeta,
  injectScrollbarStyle,
  isAllowedExternalUrl,
} from '../dist/index.js';

test('buildCsp strict blocks attacker-readable exfiltration channels by default', () => {
  const csp = buildCsp();
  assert.match(csp, /default-src 'none'/);
  // No general-purpose exfiltration surface: no connect, no form-action target,
  // no wildcard img/media hosts.
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.doesNotMatch(csp, /img-src[^;]*https:/);
  assert.doesNotMatch(csp, /media-src[^;]*https:/);
  // Fixed CDN/font hosts and eval are allowed (no attacker capability beyond inline script).
  assert.match(csp, /script-src[^;]*'unsafe-inline'/);
  assert.match(csp, /script-src[^;]*'unsafe-eval'/);
  assert.match(csp, /script-src[^;]*cdnjs\.cloudflare\.com/);
  assert.match(csp, /font-src[^;]*fonts\.gstatic\.com/);
});

test('buildCsp balanced opens https images/media and connect', () => {
  const csp = buildCsp('balanced');
  assert.match(csp, /connect-src https:/);
  assert.match(csp, /img-src[^;]*https:/);
  assert.match(csp, /media-src[^;]*https:/);
  assert.match(csp, /unsafe-eval/);
  assert.match(csp, /unpkg\.com/);
});

test('buildCsp offline keeps all network directives local', () => {
  const csp = buildCsp('offline');
  assert.match(csp, /script-src 'unsafe-inline'/);
  assert.match(csp, /img-src blob: data:/);
  assert.match(csp, /connect-src 'none'/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.doesNotMatch(csp, /https:/);
});

test('buildCsp strict appends imgHosts without opening the wildcard', () => {
  const csp = buildCsp({ preset: 'strict', imgHosts: ['https://cdn.example.com'] });
  assert.match(csp, /img-src[^;]*https:\/\/cdn\.example\.com/);
  assert.doesNotMatch(csp, /img-src blob: data: https:(?!\/\/)/);
});

test('injectCspMeta inserts meta into head first', () => {
  const html = '<html><head><title>x</title></head><body></body></html>';
  const output = injectCspMeta(html, "default-src 'none'");
  assert.match(output, /<head><meta http-equiv="Content-Security-Policy"/);
});

test('injectBridgeScript follows CSP meta', () => {
  const html = injectCspMeta('<html><head></head><body></body></html>', "default-src 'none'");
  const output = injectBridgeScript(html);
  assert.match(output, /Content-Security-Policy[^>]*><script>/);
});

test('sandbox omits allow-same-origin by default', () => {
  const sandbox = getSandboxAttribute();
  assert.match(sandbox, /allow-scripts/);
  assert.doesNotMatch(sandbox, /allow-same-origin/);
});

test('sandbox filters unsafe override tokens unless explicitly allowed', () => {
  const sandbox = getSandboxAttribute(['allow-scripts', 'allow-same-origin', 'allow-downloads']);
  assert.equal(sandbox, 'allow-scripts');

  const unsafeSandbox = getSandboxAttribute(['allow-scripts', 'allow-same-origin'], { allowUnsafeTokens: true });
  assert.equal(unsafeSandbox, 'allow-scripts allow-same-origin');
});

test('external URL protocol allowlist rejects javascript and file', () => {
  assert.equal(isAllowedExternalUrl('https://example.com'), true);
  assert.equal(isAllowedExternalUrl('mailto:hello@example.com'), true);
  assert.equal(isAllowedExternalUrl('https://example.com', ['https']), true);
  assert.equal(isAllowedExternalUrl('javascript:alert(1)'), false);
  assert.equal(isAllowedExternalUrl('file:///etc/passwd'), false);
});

test('scrollbar style injection respects author styles', () => {
  const html = '<html><head><style>*::-webkit-scrollbar{width:2px}</style></head><body></body></html>';
  const output = injectScrollbarStyle(html);
  assert.equal(output, html);
});
