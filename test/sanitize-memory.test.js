import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('repeated Node sanitization releases closed jsdom documents', { timeout: 30_000 }, () => {
  const script = `
    import { setImmediate as yieldToEventLoop } from 'node:timers/promises';
    import { sanitizeHtml } from './dist/index.js';

    const row = '<div><span>x</span><button onclick="void 0">go</button></div>';
    const html = '<html><body>' + row.repeat(Math.ceil(512 * 1024 / row.length)) + '</body></html>';
    const heapSamples = [];

    for (let index = 0; index < 12; index += 1) {
      sanitizeHtml(html);
      await yieldToEventLoop();
      global.gc();
      heapSamples.push(Math.round(process.memoryUsage().heapUsed / 1024 / 1024));
    }

    const finalHeapMiB = heapSamples.at(-1);
    console.log(JSON.stringify({ heapSamples, finalHeapMiB }));
    if (finalHeapMiB > 220) process.exit(1);
  `;

  const result = spawnSync(
    process.execPath,
    ['--expose-gc', '--max-old-space-size=384', '--input-type=module', '--eval', script],
    {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
      timeout: 30_000,
    },
  );

  assert.equal(result.status, 0, `memory stress process failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
});
