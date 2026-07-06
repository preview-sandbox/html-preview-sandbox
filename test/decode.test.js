import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeHtmlBytes, normalizeInput } from '../dist/index.js';

function fixtureBytes(path) {
  return new Uint8Array(readFileSync(new URL(`../fixtures/${path}`, import.meta.url)));
}

test('decodeHtmlBytes detects UTF-8 BOM', () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x3c, 0x68, 0x31, 0x3e]);
  const result = decodeHtmlBytes(bytes);
  assert.equal(result.html, '<h1>');
  assert.equal(result.encoding, 'utf-8');
  assert.equal(result.usedBom, true);
});

test('normalizeInput accepts strings', async () => {
  const result = await normalizeInput('<p>Hello</p>');
  assert.equal(result.html, '<p>Hello</p>');
  assert.equal(result.encoding, 'utf-8');
});

test('normalizeInput rejects oversized strings', async () => {
  await assert.rejects(() => normalizeInput('abcdef', { maxBytes: 3 }), /exceeds/);
});

test('normalizeInput rejects an oversized Blob without reading it into memory', async () => {
  // A Blob whose .size exceeds maxBytes must be rejected before arrayBuffer().
  let read = false;
  const blob = new Blob(['abcdef']); // size 6
  Object.defineProperty(blob, 'arrayBuffer', {
    configurable: true,
    value() {
      read = true;
      return Blob.prototype.arrayBuffer.call(this);
    },
  });
  await assert.rejects(() => normalizeInput(blob, { maxBytes: 3 }), /exceeds/);
  assert.equal(read, false, 'arrayBuffer() must not be called for an oversized Blob');
});

test('decodeHtmlBytes falls back to declared charset for non-UTF-8 bytes', () => {
  const bytes = fixtureBytes('edge/gbk-encoded.html');
  const result = decodeHtmlBytes(bytes);
  // GBK bytes are not valid UTF-8, so the declared <meta charset="gbk"> path must run.
  assert.equal(result.encoding, 'gbk');
  assert.match(result.html, /中文/); // 中文
  assert.match(result.html, /你好/); // 你好
});

test('decodeHtmlBytes handles empty input without throwing', () => {
  const result = decodeHtmlBytes(new Uint8Array([]));
  assert.equal(result.html, '');
  assert.equal(result.size, 0);
});
