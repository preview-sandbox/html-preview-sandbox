# Project Structure

This repository is a single-package TypeScript project. The package publishes a Node/default build and a browser build from the same core pipeline.

## Top-Level Layout

```text
html-preview-sandbox/
  src/                 TypeScript source for the package
  dist/                Generated build output, ignored by git
  playground/          Local inspection workbench
  examples/            Minimal host integration examples
  fixtures/            Benign, malicious, and edge HTML inputs
  test/                Node and browser regression tests
  docs/                Architecture, security, and integration notes
  .github/workflows/   CI checks
```

## Source Modules

```text
src/index.ts           Node/default package entry
src/index.browser.ts   Browser package entry
src/types.ts           Public API types
src/decode.ts          Input normalization and charset handling
src/sanitize.ts        Node DOMPurify + jsdom sanitizer entry
src/sanitize.browser.ts Browser DOMPurify sanitizer entry
src/sanitize-core.ts   Shared sanitizer policy and reporting hooks
src/policy.ts          CSP, sandbox, and external URL policies
src/bridge.ts          Injected iframe bridge script
src/document.ts        Node document assembly pipeline
src/document.browser.ts Browser document assembly pipeline
src/renderer-core.ts   Shared renderer factory (iframe lifecycle, bridge, nav)
src/renderer.ts        Default renderer export (injects Node document pipeline)
src/renderer.browser.ts Browser renderer export (injects browser document pipeline)
src/scrollbar.ts       Optional scrollbar style injection
src/errors.ts          Error codes and PreviewError
```

The public package surface is exported through `src/index.ts` and `src/index.browser.ts`. Keep new public APIs in `src/types.ts` and export them from both entrypoints when they apply to both runtimes.

## Runtime Flow

```text
PreviewInput
  -> normalizeInput()
  -> sanitizeHtml()
  -> buildCsp()
  -> injectCspMeta()
  -> injectBridgeScript()
  -> injectScrollbarStyle()
  -> iframe.srcdoc
```

Browser hosts usually call `createPreview()`. Node usage should call `createHtmlDocument()` or lower-level helpers.

## Build Outputs

`npm run build` runs two steps: `tsup` bundles the ESM JavaScript, then `tsc`
emits the type declarations (tsup's dts pass is disabled because it injects a
deprecated `baseUrl` that TypeScript 6 rejects). It generates:

```text
dist/index.js            (tsup, Node/default)
dist/index.browser.js    (tsup, browser)
dist/*.d.ts              (tsc, per-module declarations; index.d.ts is the public entry)
dist/*.map
```

Consumers reach the API through the `.` and `./browser` export conditions; the
per-module `.d.ts` files support the type graph but are not deep-importable by
package name.

Tests and local examples intentionally run against `dist` after build. This keeps development checks close to the published package behavior.

## Test Layers

- `test/*.test.js`: Node tests for decoding, CSP, sanitizer behavior, package metadata, and document assembly.
- `test/browser/*.spec.js`: Playwright tests for browser iframe behavior, bridge forwarding, host navigation handling, external URL policy, and the example/Playground UIs (file upload, Web Component, sanitized-HTML view, shareable URL, drag-and-drop).
- `fixtures/`: stable inputs for benign, malicious, and edge cases.

## Local Workbench

The Playground is a repository tool, not a published runtime API. It runs against `dist/index.browser.js` and exposes:

- sample payloads;
- drag-and-drop of a local HTML file into the editor;
- CSP preset switching;
- external protocol controls;
- host suffix URL filtering;
- sanitizer removal reports;
- CSP violation reports;
- external request reports;
- current policy summary;
- a "sanitized HTML" view of the exact pipeline output;
- a shareable URL that encodes the input + preset.

Run it with:

```bash
npm run build
npm run serve
```

Then open `http://localhost:4173/playground/`.

## Publishing Shape

The npm package is intentionally small:

```text
dist/
docs/
README.md
LICENSE
THREAT_MODEL.md
SECURITY.md
CHANGELOG.md
```

Examples, fixtures, tests, and Playground stay in the repository for development and review, but they are not included in the package tarball.
