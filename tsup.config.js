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
  {
    entry: {
      react: 'src/react.tsx',
    },
    format: ['esm'],
    platform: 'browser',
    target: 'es2020',
    sourcemap: true,
    clean: false,
    dts: false,
    // react stays external (peer dep); the browser core is intentionally
    // inlined — consumers of /react don't need the "." entry at all.
    external: ['react', 'react/jsx-runtime'],
    noExternal: ['dompurify'],
  },
  {
    // Test/example harness: a self-contained React app bundle (not shipped —
    // examples/ isn't in the npm files list; app.js is gitignored).
    entry: {
      app: 'examples/react/app.jsx',
    },
    outDir: 'examples/react',
    format: ['esm'],
    platform: 'browser',
    target: 'es2020',
    sourcemap: false,
    clean: false,
    dts: false,
    noExternal: [/.*/],
    define: { 'process.env.NODE_ENV': '"production"' },
  },
]);
