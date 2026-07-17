import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm'],
    platform: 'node',
    target: 'node18',
    sourcemap: true,
    clean: true,
    // Declarations are emitted by `tsc` (see the build script), not tsup: tsup's
    // dts pass injects a deprecated `baseUrl` that TypeScript 6 rejects. Using tsc
    // with our own tsconfig avoids it and keeps the config free of ignoreDeprecations.
    dts: false,
    external: ['dompurify', 'jsdom'],
  },
  {
    entry: {
      'index.browser': 'src/index.browser.ts',
    },
    format: ['esm'],
    platform: 'browser',
    target: 'es2020',
    sourcemap: true,
    clean: false,
    dts: false,
    external: ['dompurify'],
  },
]);
