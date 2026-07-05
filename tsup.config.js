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
    dts: true,
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
