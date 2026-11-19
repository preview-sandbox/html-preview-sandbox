# Roadmap

`v0.3.2` is the current npm release. This document tracks what's landed and
what's still ahead.

## v0.3.1 Release Closure

Closed on 2026-09-29:

- npm `latest` pointed to `0.3.1` at release; the public tarball exposes 38 expected files
  (170.1 kB compressed) with npm provenance and registry integrity metadata;
- a clean public-registry install successfully imported the Node and browser
  entrypoints;
- GitHub tag and Release `v0.3.1` point to release commit `b593e89`;
- release CI and the hosted Playground deployment completed successfully;
- The post-release CI commit `a13fb57` aligned the toolchain with Electron 43's
  Node requirement; that change shipped with `v0.3.2`.

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

## v0.3.2 Release Closure: Security And Dependency Maintenance

Published on 2026-11-19 before starting `v0.4.0`. The patch does not contain
responsive-sizing API work.

Implemented:

- raised the minimum DOMPurify version to 3.4.18;
- updated the lockfile to `source-map-js` 1.2.2 and `undici` 7.30.2 while
  retaining the documented Node 20.19+ runtime floor;
- updated Electron to 43.8.10 for the repository example and smoke test,
  instead of taking the unrelated Electron 44 major upgrade;
- kept internal responsive-sizing planning artifacts out of the npm tarball;
- added release notes that tell existing lockfile users to refresh
  transitive dependencies.

`jsdom` 30 remains deferred because its Node engine requirement is incompatible
with the current Node 20.19+ support contract. General tooling updates that are
not needed for the security gate belong in a separate maintenance change.

Release verification:

- [PR #40](https://github.com/preview-sandbox/html-preview-sandbox/pull/40)
  and its merge commit passed CI. Tag `v0.3.2` points to `955ce4e`.
- The first npm publish attempt was rejected. After rotating the registry
  credential, the [second attempt](https://github.com/preview-sandbox/html-preview-sandbox/actions/runs/44469432480/attempts/2)
  passed 53 Node tests, 78 Playwright tests across three engines, the Electron
  and packed-consumer smoke tests, and publication using the same tag.
- The npm tarball contained 38 files (164.9 kB compressed), excluded
  `docs/superpowers/`, and has registry integrity and provenance metadata.
- Once npm `latest` pointed to `0.3.2`, a clean public-registry install
  imported the Node, browser, and React entrypoints and generated an HTML
  document with CSP through the Node API. The production audit reported zero
  known findings at verification time.
- [PR #41](https://github.com/preview-sandbox/html-preview-sandbox/pull/41)
  consolidated the remaining routine dependency updates after the release tag.

## v0.4.0 In Development: Responsive Content Sizing

The next minor release focuses on opt-in iframe content-height sizing for inline
previews. The current fill-container behavior remains the default, so existing
integrations do not change layout after upgrading.

Planned scope:

- `sizing.mode: 'fill' | 'content'`, with bounded content-mode minimum and
  maximum heights;
- a Chromium/Firefox/WebKit-compatible bridge fallback with growth, shrink,
  validation, clamping, update coalescing, and lifecycle cleanup;
- content-mode scrollbar styling that does not impose the fill-mode
  `html, body { min-height: 100% }` rule or prevent shrinking;
- finite, non-negative child height validation so an explicit `minHeight: 0`
  can shrink back to an empty document;
- fail-fast validation when sandbox or CSP settings would block the sizing
  bridge;
- `onFrameResize` observability through the vanilla and React APIs;
- immediate observer reconciliation when `onFrameResize` is added, replaced,
  or removed with `updateOptions()`;
- a dedicated content-sizing example plus Playground controls;
- cross-instance, stale-frame, hostile-message, React, and three-engine browser
  regression coverage;
- synchronized integration, compatibility, migration, threat-model, and security
  documentation.

Out of scope for this release: a Vue package, optional `jsdom` installation,
new CSP presets, width-to-content sizing, and unrelated dependency-major work.
The experimental `frame-sizing` / `requestResize()` standard remains a future
progressive enhancement after it is stable in more than one browser engine and
can be exercised in CI.

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
   baseline (Chrome/Edge 90+, Firefox 90+, Safari 14+, Electron core renderer
   API 12+, Electron navigation example 25+, and jsdom's Node range: 20.19+,
   22.13+, or 24+) with the binding constraint (`Blob.arrayBuffer`) and the full
   list of platform features used.

## Priority 1

These improve adoption and maintainability.

1. **Integration examples**

   Keep the package single-package, with repository examples:

   - Done: string input (`examples/web/`).
   - Done: File/Blob input via `<input type=file>` + drag & drop, with encoding /
     sanitize-report / `OVERSIZED` error display (`examples/file-upload/`, covered by
     Playwright smoke tests). Covers the attachment / upload / netdisk shape.
   - Done: vanilla Web Component wrapper (`examples/web-component/`, smoke-tested).
   - Done: Electron host navigation interception (`examples/electron/`, covered by
     a real-process smoke test in `npm run test:electron`).
   - Done: Node `createHtmlDocument` (full pipeline, no iframe) for self-managed
     webviews / SSR / CLI (`examples/node-create-document/`).
   - Done: React wrapper (`html-preview-sandbox/react`) with its example page
     (`examples/react/`, bundled by tsup, covered by the browser suite).
   - Deferred: a Vue example (the Web Component covers the framework-agnostic
     entry) and a multiple-previews-per-page snippet.

2. **Improve CI signal**

   Done: Dependabot (`.github/dependabot.yml`); the main CI workflow runs
   lint, type check, Node tests on Node 20.19, 22.13, and 24, the Playwright
   suite on all three bundled engines (Chromium/Firefox/WebKit), a real Electron
   example smoke test, a build, `pack:dry`, and a consumer smoke test against the
   actual packed Node, browser, and React exports.
   (A CodeQL workflow existed briefly but was removed — code scanning
   isn't enabled for this repo.)

   Latest full verification snapshot (2026-09-29):

   - 53 Node tests and the packed-tarball consumer test passed;
   - 78 Playwright tests passed across Chromium, Firefox, and WebKit;
   - the real Electron process test passed locally on macOS and in Linux/Xvfb CI;
   - Node 20.19, 22.13, and 24 jobs passed;
   - npm audit reported zero known vulnerabilities in the audited dependency graph;
   - the final `v0.3.1` package contained 38 expected files (170.1 kB compressed);
     the Node example and performance/size benchmark also completed successfully.

   Known coverage boundaries (not release blockers for the current version):

   - minimum documented browser versions are compatibility floors, not a
     historical-browser CI matrix;
   - Electron is not yet exercised natively on Windows or across every supported
     Electron major;
   - the package consumer smoke test checks exports directly, but does not yet run
     dedicated Vite, Webpack, Rollup, Next.js, and Vue fixture projects;
   - malicious fixtures and regression vectors are extensive but finite; there is
     no continuous coverage-guided HTML fuzzing service;
   - performance measurements are recorded locally without shared-runner pass/fail
     thresholds.

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
