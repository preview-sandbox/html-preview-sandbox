# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). During the `0.x`
phase the public API may change between minor versions.

## [Unreleased]

### Changed

- Empty or fully stripped input now has an explicit contract: the pipeline
  returns a safe blank document and reports `sanitizeReport.strippedAll = true`.
  The legacy `EMPTY_AFTER_SANITIZE` error code remains type-compatible but is not
  emitted by the current document pipeline.
- Formatting is now enforced by the local and CI quality gates.
- Node sanitization now scopes and closes its jsdom Window per call, preventing
  parsed documents from accumulating across repeated large inputs.
- The default `maxBytes` limit is reduced from 100 MiB to 10 MiB. Hosts can lower
  it for public uploads or opt into larger inputs after profiling their content.
- The Node/default entrypoint now declares Node 20.19+, 22.13+, or 24+ to match
  jsdom's supported runtime range.
- DOMPurify is updated to 3.4.16 and the lockfile resolves undici 7.30.0 to
  incorporate current security fixes.
- CI now verifies the Node test suite on the minimum supported Node 20 and 22
  releases plus Node 24.

### Added

- `npm run benchmark` for repeatable input-normalization, sanitization, document
  assembly, and built-entry size measurements.
- A bounded-heap Node regression test for repeated jsdom sanitization.
- Structured input-size metadata: `RenderResult.size`, plus `actualBytes` and
  `maxBytes` on `OVERSIZED` errors.
- A packed-tarball consumer smoke test for the Node, browser, and React exports,
  included in local and release quality gates.
- Playground input-size visibility, copyable JSON reports, and an
  original/sanitized comparison with removed tokens highlighted.
- A v0.2-to-v0.3 migration guide.

### Fixed

- Concurrent preview renders now use latest-call-wins semantics, preventing a
  slower earlier input or stale policy result from replacing the newest iframe.
- The React wrapper now follows forwarded-ref identity changes without recreating
  the preview and routes runtime warnings through the latest `logger` prop.
- Playground inspector values are rendered as text nodes, preventing untrusted
  report fields or user-entered policy values from becoming host-page markup.

## [0.2.0] - 2026-07-20

### Added

- React wrapper: `html-preview-sandbox/react` exports a `<SafeHtmlPreview>`
  component (all `PreviewOptions` as props, forwarded ref exposing the
  `PreviewHandle`). `react` is an optional peer dependency. Ships with an
  example page (`examples/react/`) covered by the browser suite on all
  three engines.

### Fixed

- The browser entry (`/browser`, and `/react` which inlines it) no longer
  touches `window` at import time — the sanitizer is created on first call,
  so both entries are safe to import during SSR.

## [0.1.0] - 2026-07-06

Initial release.

### Added

- Defense-in-depth preview pipeline for untrusted HTML: `decode → sanitize → CSP
  policy → bridge → sandboxed iframe`.
- `createPreview(container, options)` renderer with an opaque-origin sandboxed
  iframe (no `allow-same-origin`), plus lower-level `createHtmlDocument`,
  `sanitizeHtml`, and `buildCsp` helpers.
- Three CSP presets layered by exfiltration capability:
  - `offline` — no network at all.
  - `strict` (default) — blocks attacker-readable exfiltration channels
    (`connect-src 'none'`, `form-action 'none'`, no wildcard `img-src`/`media-src`)
    while allowing inline script, `unsafe-eval`, and fixed CDN/font hosts.
  - `balanced` — opens `https:` images/media and `connect-src https:` for
    semi-trusted content.
- DOMPurify-backed sanitizer with project hooks for URL-scheme filtering, meta
  refresh / user CSP removal, base-tag removal, URL-targeting SVG animation removal,
  and connection/prefetch resource-hint `<link>` removal
  (`preconnect`/`dns-prefetch`/`prefetch`/`prerender`), plus a removal report
  surfaced through `onSanitize`.
- Injected iframe bridge forwarding link clicks, `window.open`, and
  `securitypolicyviolation` reports to the host.
- Fail-closed external URL handling: protocol allowlist plus optional
  `allowExternalUrl` callback; high-risk sandbox tokens filtered unless explicitly
  opted in.
- Optional host navigation hook (`notifyNavigationAttempt`) that re-mounts the last
  trusted document and routes the URL through the external-link allowlist.
- Separate Node (jsdom) and browser build entrypoints.
- Node and Playwright test suites, security regression fixtures, threat model,
  security policy, and contributor documentation.

[Unreleased]: https://github.com/preview-sandbox/html-preview-sandbox/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/preview-sandbox/html-preview-sandbox/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/preview-sandbox/html-preview-sandbox/releases/tag/v0.1.0
