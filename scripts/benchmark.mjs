import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { setImmediate as yieldToEventLoop } from 'node:timers/promises';
import { gzipSync } from 'node:zlib';
import { createHtmlDocument, normalizeInput, sanitizeHtml } from '../dist/index.js';

const CASES = [
  { name: '100 KiB', bytes: 100 * 1024, iterations: 12 },
  { name: '1 MiB', bytes: 1024 * 1024, iterations: 4 },
];

function createReport(targetBytes) {
  const row =
    '<tr><td>Quarterly report</td><td>42</td><td><button onclick="this.textContent=\'Done\'">Run</button></td></tr>';
  const prefix = '<!doctype html><html><head><title>Benchmark</title></head><body><table><tbody>';
  const suffix = '</tbody></table></body></html>';
  const rows = row.repeat(Math.ceil((targetBytes - prefix.length - suffix.length) / row.length));
  return `${prefix}${rows}${suffix}`;
}

function percentile(sorted, ratio) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

async function measure(name, iterations, operation) {
  await operation();
  const samples = [];
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    await operation();
    samples.push(performance.now() - started);
    // jsdom releases closed Window state after the current event-loop turn.
    await yieldToEventLoop();
  }
  samples.sort((left, right) => left - right);
  return {
    operation: name,
    iterations,
    'median (ms)': percentile(samples, 0.5).toFixed(2),
    'p95 (ms)': percentile(samples, 0.95).toFixed(2),
  };
}

async function benchmarkPipeline() {
  const rows = [];
  for (const benchmarkCase of CASES) {
    const html = createReport(benchmarkCase.bytes);
    rows.push(
      await measure(`normalize ${benchmarkCase.name}`, benchmarkCase.iterations, () =>
        normalizeInput(html, { maxBytes: benchmarkCase.bytes + 1024 }),
      ),
      await measure(`sanitize ${benchmarkCase.name}`, benchmarkCase.iterations, () => sanitizeHtml(html)),
      await measure(`document ${benchmarkCase.name}`, benchmarkCase.iterations, () =>
        createHtmlDocument(html, { maxBytes: benchmarkCase.bytes + 1024 }),
      ),
    );
  }
  console.log('\nPipeline timings (machine-dependent; lower is better)');
  console.table(rows);
}

async function benchmarkBundles() {
  const files = ['dist/index.js', 'dist/index.browser.js', 'dist/react.js'];
  const rows = [];
  for (const file of files) {
    const content = await readFile(new URL(`../${file}`, import.meta.url));
    rows.push({
      file,
      'raw (KiB)': (content.byteLength / 1024).toFixed(2),
      'gzip (KiB)': (gzipSync(content).byteLength / 1024).toFixed(2),
    });
  }
  console.log('\nBuilt bundle sizes');
  console.table(rows);
}

await benchmarkPipeline();
await benchmarkBundles();
