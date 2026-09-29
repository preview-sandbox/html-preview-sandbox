# Roadmap

`v0.2.0` is published to npm. It adds the React entrypoint and SSR-safe browser
imports on top of the `v0.1.0` core. This document tracks what's landed and
what's still ahead.

## Current State

Implemented:

- single-package TypeScript source;
- generated ESM Node/default build;
- generated ESM browser build;
- generated ESM React wrapper with an optional React peer dependency;
- generated TypeScript declarations;
- DOMPurify-backed sanitizer in browser and Node;
- CSP presets;
- sandboxed iframe renderer;
- injected bridge for link, `window.open`, and CSP violation events;
- external protocol and custom URL policy;
- high-risk sandbox token filtering;
- local and hosted Playground inspection workbench;
- Node tests and Playwright coverage on Chromium, Firefox, and WebKit;
- CI, audit script, pack dry-run, and a machine-local performance benchmark;
- Biome linting and formatting, both gated in CI.

## Housekeeping

- **Biome formatting** — Done. The one-time format pass is complete;
  `npm run format:check` is part of the local `check` command and both CI and
  release workflows.

## Priority 0

All three P0 items are done. The package is TypeScript-strict, has broad security
fixture coverage, and documents its browser baseline.

1. **Tighten TypeScript strictness** — Done. `strict: true` in both `tsconfig.json`
   and `tsconfig.check.json`; DOMPurify hook parameters are typed, caught errors are
   normalized to `PreviewErrorShape`, and the suite passes under strict. The `jsdom`
   module shim and the `any`-typed DOMPurify factory remain as small, deliberate
   boundaries; replacing them with precise upstream types is a follow-up nicety, not
   a blocker.

2. **Expand security fixture coverage** — Done. Fixtures + regression tests now cover:
   `base` tag injection, URL-targeting SVG animation, mXSS mutation vectors,
   `formaction` override, nested `iframe`/`srcdoc`, obfuscated (entity/whitespace/case)
   `javascript:` schemes, irregular `srcset` whitespace/descriptors, CSS `url()`
   exfiltration (layered sanitize + CSP assertion), plus GBK/non-UTF-8 decoding, empty,
   and malformed HTML edge cases.

3. **Document browser compatibility** — Done. See [BROWSER_SUPPORT.md](BROWSER_SUPPORT.md):
   baseline (Chrome/Edge 90+, Firefox 90+, Safari 14+, Electron 12+, and
   jsdom's Node range: 20.19+, 22.13+, or 24+) with the
   binding constraint (`Blob.arrayBuffer`) and the full list of platform features used.

## Priority 1

These improve adoption and maintainability.

1. **Integration examples**

   Keep the package single-package, with repository examples:

   - Done: string input (`examples/web/`).
   - Done: File/Blob input via `<input type=file>` + drag & drop, with encoding /
     sanitize-report / `OVERSIZED` error display (`examples/file-upload/`, covered by
     Playwright smoke tests). Covers the attachment / upload / netdisk shape.
   - Done: vanilla Web Component wrapper (`examples/web-component/`, smoke-tested).
   - Done: Electron host navigation interception (`examples/electron/`, reference
     code — runs with a separately installed `electron`).
   - Done: Node `createHtmlDocument` (full pipeline, no iframe) for self-managed
     webviews / SSR / CLI (`examples/node-create-document/`).
   - Done: React wrapper (`html-preview-sandbox/react`) with its example page
     (`examples/react/`, bundled by tsup, covered by the browser suite).
   - Deferred: a Vue example (the Web Component covers the framework-agnostic
     entry) and a multiple-previews-per-page snippet.

2. **Improve CI signal**

   Done: Dependabot (`.github/dependabot.yml`); the main CI workflow runs
   lint, type check, Node tests on Node 20.19, 22.13, and 24, the Playwright
   suite on all three bundled engines (Chromium/Firefox/WebKit), a build,
   `pack:dry`, and a consumer smoke test against the actual packed Node, browser,
   and React exports.
   (A CodeQL workflow existed briefly but was removed — code scanning
   isn't enabled for this repo.)

3. **Package release workflow**

   Done: tag-triggered publish workflow with npm provenance and a tag/version
   consistency check (`.github/workflows/release.yml`); `CHANGELOG.md` in
   Keep a Changelog format.

   Still to decide:

   - whether to adopt changesets/release-please for automated version bumps, or
     keep manual CHANGELOG + tag (manual is fine while single-maintainer).

## Priority 2

These are useful but not release blockers.

1. **Playground polish**

   Done:

   - drag-and-drop an HTML file into the editor;
   - "sanitized HTML" view — toggle to inspect the exact document the pipeline produced;
   - original/sanitized comparison with removed tokens highlighted;
   - input size versus the 10 MiB limit;
   - copyable JSON inspection reports;
   - shareable URL — the input + preset are encoded into the location hash and restored on load.

   Still potential:

   - saved sample presets;

2. **Policy presets**

   Consider whether `strict`, `balanced`, and `offline` need aliases or additional presets for:

   - AI-generated reports;
   - fully offline attachments;
   - internal trusted dashboards;
   - teaching/demo mode.

3. **Performance and size profiling**

   Done: `npm run benchmark` builds the package and reports repeatable,
   machine-local measurements for:

   - large HTML input normalization;
   - sanitizer runtime;
   - complete document assembly;
   - raw and gzip sizes of the Node, browser, and React entries.

   Still potential: add a browser-only iframe render benchmark and begin tracking
   release-to-release baselines after enough data exists. CI does not enforce
   timing thresholds because shared-runner performance is noisy.

   Resolved from the first baseline: the untrusted-input default was reduced from
   100 MiB to 10 MiB after a node-dense 1 MiB fixture demonstrated that DOM memory
   cost can be hundreds of times larger than source size. Public-upload hosts can
   lower the limit to 1–2 MiB; larger limits remain an explicit host decision.

   The 10 MiB limit applies to `normalizeInput` and the complete preview/document
   pipeline. Direct `sanitizeHtml(rawHtml)` callers own their input-size limit;
   this boundary is documented in the README, integration guide, API types, and
   threat model.

4. **`jsdom` dependency footprint**

   Verified: `jsdom` is **not** referenced in the browser build (`dist/index.browser.js`,
   0 occurrences), so it never reaches the final app bundle — a bundler resolving the
   `browser` export condition never imports it. The only remaining cost is disk
   footprint in `node_modules` for browser-only consumers who install via npm.

   This is an install-hygiene improvement, not a runtime one. The candidate fix
   (move `jsdom` to an optional peer dependency + lazily initialize it in the Node
   entrypoint via `createRequire`, keeping the sync `sanitizeHtml` API and throwing a
   clear error when absent) changes install semantics and touches the security-critical
   sanitizer, so it should go through the normal review loop rather than a rushed change.

   Done: Node sanitization no longer keeps one persistent jsdom Window. Each
   synchronous call owns and closes its Window, allowing DOMPurify's parsed
   documents to be reclaimed between event-loop turns during repeated large-input
   workloads. A bounded-heap child-process regression test reproduces the old OOM
   behavior and protects the lifecycle fix.

5. **Empty output behavior**

   Resolved for the current API: empty or fully stripped input returns a safe blank
   document and reports `sanitizeReport.strippedAll = true`; it does not throw.
   `strippedAll` is now literal: it is false when body text/elements or head runtime
   resources (`script`, `style`, or `link`) remain, so text-free controls, canvas,
   SVG, media, and styled elements are not misclassified.

   The legacy `EMPTY_AFTER_SANITIZE` error code remains in the type surface for
   compatibility but is not emitted by the current document pipeline. A future
   major API may replace `strippedAll` with richer content-state metadata if hosts
   need to distinguish empty input from content removed by policy.

## Open Questions

- Should the package expose a lower-level policy builder for hosts that already own iframe rendering?
- Should Node sanitization remain a first-class path, or only support tests and document generation?

## Resolved

- **Should `strict` allow remote images by default?** No. Presets are layered by
  exfiltration capability: `strict` keeps `img-src`/`media-src` at `blob: data:`
  (an image URL is an attacker-readable exfiltration channel). Remote `https:`
  images/media live in `balanced` only. `offline` has no network at all.
- **Should the Playground become a hosted demo?** Yes. `.github/workflows/pages.yml`
  deploys it to GitHub Pages on every push to `main` (assembling a site that mirrors
  the Playground's relative imports). Requires enabling Pages (Source = GitHub Actions).
- **Renderer duplication.** The Node and browser renderers now share
  `renderer-core.ts` via a factory; the entrypoints only inject their
  `createHtmlDocument` implementation.
