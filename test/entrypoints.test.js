import assert from 'node:assert/strict';
import test from 'node:test';

// SSR safety: importing the browser-targeted entries in plain Node (no DOM)
// must not throw. Only *calling* into the sandbox pipeline needs a window.

test('browser entry is importable without a DOM', async () => {
  const mod = await import('../dist/index.browser.js');
  assert.equal(typeof mod.createPreview, 'function');
  assert.equal(typeof mod.sanitizeHtml, 'function');
  assert.equal(typeof mod.buildCsp, 'function');
});

test('react entry is importable without a DOM', async () => {
  const mod = await import('../dist/react.js');
  assert.ok(mod.SafeHtmlPreview, 'SafeHtmlPreview export missing');
});

test('browser sanitizeHtml fails at call time, not import time, without a window', async () => {
  const { sanitizeHtml } = await import('../dist/index.browser.js');
  assert.throws(() => sanitizeHtml('<p>x</p>'), /window is not defined/);
});
