import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const temporaryRoot = await mkdtemp(join(tmpdir(), 'html-preview-sandbox-package-'));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

try {
  const packOutput = run('npm', ['pack', '--json', '--pack-destination', temporaryRoot], {
    env: {
      ...process.env,
      npm_config_cache: join(root, '.npm-cache'),
      npm_config_logs_dir: join(root, '.npm-cache', '_logs'),
    },
  });
  const [{ filename }] = JSON.parse(packOutput);
  const tarball = join(temporaryRoot, basename(filename));
  const unpacked = join(temporaryRoot, 'unpacked');
  const consumer = join(temporaryRoot, 'consumer');
  const consumerModules = join(consumer, 'node_modules');

  await mkdir(unpacked);
  run('tar', ['-xzf', tarball, '-C', unpacked]);
  await mkdir(consumerModules, { recursive: true });
  await cp(join(unpacked, 'package'), join(consumerModules, 'html-preview-sandbox'), { recursive: true });

  for (const dependency of ['dompurify', 'jsdom', 'react']) {
    await symlink(join(root, 'node_modules', dependency), join(consumerModules, dependency), 'dir');
  }

  const consumerScript = join(consumer, 'consumer.mjs');
  await writeFile(
    consumerScript,
    `
      import assert from 'node:assert/strict';
      import * as core from 'html-preview-sandbox';
      import * as browser from 'html-preview-sandbox/browser';
      import { SafeHtmlPreview } from 'html-preview-sandbox/react';

      assert.equal(typeof core.createPreview, 'function');
      assert.equal(typeof core.createHtmlDocument, 'function');
      assert.equal(typeof browser.createPreview, 'function');
      assert.equal(typeof browser.sanitizeHtml, 'function');
      assert.equal(typeof SafeHtmlPreview, 'object');

      const source = '<h1>packed consumer</h1>';
      const result = await core.createHtmlDocument(source);
      assert.equal(result.size, new TextEncoder().encode(source).byteLength);
      assert.match(result.html, /Content-Security-Policy/);
    `,
  );

  run(process.execPath, [consumerScript], { cwd: consumer });

  const packedPackage = JSON.parse(
    await readFile(join(consumerModules, 'html-preview-sandbox', 'package.json'), 'utf8'),
  );
  assert.equal(packedPackage.name, 'html-preview-sandbox');
  assert.ok(packedPackage.exports['.']);
  assert.ok(packedPackage.exports['./browser']);
  assert.ok(packedPackage.exports['./react']);

  console.log(`Packed consumer smoke test passed for ${packedPackage.name}@${packedPackage.version}.`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
