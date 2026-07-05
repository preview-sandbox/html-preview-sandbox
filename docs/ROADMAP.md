# Roadmap

This document tracks what remains before the project is ready for a stronger public v0.1 release.

## Current State

Implemented:

- single-package TypeScript source;
- generated ESM Node/default build;
- generated ESM browser build;
- generated TypeScript declarations;
- DOMPurify-backed sanitizer in browser and Node;
- CSP presets;
- sandboxed iframe renderer;
- injected bridge for link, `window.open`, and CSP violation events;
- external protocol and custom URL policy;
- high-risk sandbox token filtering;
- local Playground inspection workbench;
- Node tests, Playwright tests, CI, audit script, and pack dry-run.

## Priority 0

These should be handled before calling the package release-ready.

1. **Tighten TypeScript strictness**

   The source is now TypeScript, but `strict` is still disabled while the migration settles. Move toward `strict: true` in small steps:

   - add precise DOMPurify hook types where practical;
   - replace the local `jsdom` shim with real types or a small explicit adapter type;
   - reduce remaining `any` usage in sanitizer internals;
   - keep generated `dist/index.d.ts` stable.

2. **Expand security fixture coverage**

   Added so far: `base` tag injection, SVG animation targeting URL attributes,
   mXSS mutation vectors, GBK/non-UTF-8 decoding, empty and malformed HTML.

   Still to add:

   - CSS `url()` edge cases;
   - `formaction` and related submit attributes;
   - `iframe`, `srcdoc`, and nested browsing content;
   - mixed `srcset` with unusual whitespace and descriptors;
   - encoded or control-character protocol attempts.

3. **Document browser compatibility**

   Define the supported browser baseline for:

   - sandboxed `srcdoc` iframe;
   - `securitypolicyviolation`;
   - `TextDecoder`;
   - Blob/File input handling.

## Priority 1

These improve adoption and maintainability.

1. **Add framework examples**

   Keep the package single-package, but add repository examples for:

   - React;
   - vanilla Web component wrapper;
   - Electron host navigation interception.

2. **Improve CI signal**

   Add:

   - dependency review or Dependabot;
   - CodeQL or equivalent static analysis;
   - a release dry-run job;
   - browser matrix expansion if the compatibility target requires it.

3. **Package release workflow**

   Decide and document:

   - npm provenance;
   - changesets or release-please;
   - versioning policy before `1.0`;
   - whether examples should be published only in the repository or also as a demo site.

## Priority 2

These are useful but not release blockers.

1. **Playground polish**

   Potential additions:

   - file upload and drag-and-drop;
   - side-by-side sanitized HTML output;
   - copyable reports;
   - saved sample presets;
   - visual diff for removed tags and attributes.

2. **Policy presets**

   Consider whether `strict`, `balanced`, and `offline` need aliases or additional presets for:

   - AI-generated reports;
   - fully offline attachments;
   - internal trusted dashboards;
   - teaching/demo mode.

3. **Performance and size profiling**

   Add benchmarks for:

   - large HTML input normalization;
   - sanitizer runtime;
   - iframe render time;
   - bundle size and dependency impact.

4. **`jsdom` dependency footprint**

   `jsdom` is currently a hard dependency so the Node sanitizer path works out of
   the box. It is not bundled into the browser build, but it still lands in the
   dependency tree for browser-only consumers. Consider moving it to an optional
   peer dependency or a dynamic import in the Node entrypoint, with a clear error
   when a Node caller has not installed it.

## Open Questions

- Should the package expose a lower-level policy builder for hosts that already own iframe rendering?
- Should the Playground become a hosted demo, or stay repository-only?
- Should Node sanitization remain a first-class path, or only support tests and document generation?

## Resolved

- **Should `strict` allow remote images by default?** No. Presets are layered by
  exfiltration capability: `strict` keeps `img-src`/`media-src` at `blob: data:`
  (an image URL is an attacker-readable exfiltration channel). Remote `https:`
  images/media live in `balanced` only. `offline` has no network at all.
- **Renderer duplication.** The Node and browser renderers now share
  `renderer-core.ts` via a factory; the entrypoints only inject their
  `createHtmlDocument` implementation.
