# Roadmap

`v0.1.0` is published to npm. This document tracks what's landed and what's still ahead.

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
- Node tests, Playwright tests, CI, audit script, and pack dry-run;
- Biome linting (gated in CI) and formatter config.

## Housekeeping

- **One-time Biome format pass.** The formatter is configured (`biome.json`) and
  available via `npm run format`, but existing files have not been reformatted, to
  keep substantive diffs clean. Apply `biome format --write` in a dedicated
  `chore: apply Biome formatting` commit (no logic changes). Only after that pass,
  (re)add a `format:check` script (`biome format .`) and gate it in CI — it is
  intentionally omitted now so no shipped script fails against the un-formatted tree.

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
   baseline (Chrome/Edge 90+, Firefox 90+, Safari 14+, Electron 12+, Node 18+) with the
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
   - Deferred: React/Vue examples (need a build step; Web Component already covers
     the framework-agnostic entry) and a multiple-previews-per-page snippet. Low
     priority — these are capability showcases, not core adoption entry points.

2. **Improve CI signal**

   Done: Dependabot (`.github/dependabot.yml`) and CodeQL static analysis
   (`.github/workflows/codeql.yml`). The main CI workflow already runs a
   `pack:dry` job.

   Still to add:

   - browser matrix expansion (Firefox/WebKit) once the compatibility target is
     confirmed and those engines are verified to pass.

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
   - shareable URL — the input + preset are encoded into the location hash and restored on load.

   Still potential:

   - copyable reports;
   - saved sample presets;
   - visual before/after diff for removed tags and attributes.

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

   Verified: `jsdom` is **not** referenced in the browser build (`dist/index.browser.js`,
   0 occurrences), so it never reaches the final app bundle — a bundler resolving the
   `browser` export condition never imports it. The only remaining cost is disk
   footprint in `node_modules` for browser-only consumers who install via npm.

   This is an install-hygiene improvement, not a runtime one. The candidate fix
   (move `jsdom` to an optional peer dependency + lazily initialize it in the Node
   entrypoint via `createRequire`, keeping the sync `sanitizeHtml` API and throwing a
   clear error when absent) changes install semantics and touches the security-critical
   sanitizer, so it should go through the normal review loop rather than a rushed change.

5. **`EMPTY_AFTER_SANITIZE` behavior needs a proper definition (do not rush)**

   DOMPurify's `WHOLE_DOCUMENT` mode wraps any input into an `html/head/body` shell,
   so `sanitized.html.trim()` in `document.ts` is never blank and the
   `EMPTY_AFTER_SANITIZE` error never fires. Content that sanitizes to nothing renders
   as a blank preview instead.

   The naive fix — `if (sanitized.report.strippedAll) throw ...` — is **wrong**, because
   `strippedAll` currently keys off text content and a small tag set, so it would
   misfire on content that is visually/interactively meaningful but text-free
   (e.g. only `<canvas>`, `<svg>`, `<img>`, or `<input>`). Before changing behavior,
   the "empty" concept must be split and each case decided explicitly:

   - empty input;
   - sanitized to no *visible* content;
   - sanitized to no *interactive* content;
   - only form/canvas/svg/media remain (no text).

   Then decide per case whether to throw `EMPTY_AFTER_SANITIZE` or simply signal the
   host via `sanitizeReport.strippedAll`. This is a dedicated design PR, not an inline fix.

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
