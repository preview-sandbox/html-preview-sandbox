import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('package exposes an explicit browser subpath', () => {
  assert.equal(packageJson.exports['./browser'].import, './dist/index.browser.js');
  assert.equal(packageJson.exports['./browser'].types, './dist/index.d.ts');
});
