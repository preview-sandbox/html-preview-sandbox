import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('package exposes an explicit browser subpath', () => {
  assert.equal(packageJson.exports['./browser'].import, './dist/index.browser.js');
  assert.equal(packageJson.exports['./browser'].types, './dist/index.d.ts');
});

test('package declares the Node runtime range supported by jsdom', () => {
  assert.equal(packageJson.engines.node, '^20.19.0 || ^22.13.0 || >=24.0.0');
});
