# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). During the `0.x`
phase the public API may change between minor versions.

## [Unreleased]

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
