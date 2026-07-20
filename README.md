# html-preview-sandbox

[![npm](https://img.shields.io/npm/v/html-preview-sandbox.svg)](https://www.npmjs.com/package/html-preview-sandbox)
[![CI](https://github.com/preview-sandbox/html-preview-sandbox/actions/workflows/ci.yml/badge.svg)](https://github.com/preview-sandbox/html-preview-sandbox/actions/workflows/ci.yml)
[![provenance](https://img.shields.io/badge/provenance-signed-brightgreen)](https://www.npmjs.com/package/html-preview-sandbox#provenance)
[![license](https://img.shields.io/npm/l/html-preview-sandbox.svg)](LICENSE)

Safely preview untrusted, interactive HTML in a sandboxed iframe.

`html-preview-sandbox` helps applications render untrusted HTML files, user uploads, and AI-generated reports without giving them full browser power. It combines DOMPurify sanitization, CSP presets, opaque-origin sandboxed iframes, external-link mediation, and host callbacks.

**[Try it in the hosted Playground →](https://preview-sandbox.github.io/html-preview-sandbox/playground/)**

## Install

```bash
npm install html-preview-sandbox
```

## Quick Start

```js
import { createPreview } from 'html-preview-sandbox';

const preview = createPreview(document.querySelector('#preview'), {
  csp: 'strict',
  onOpenExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  },
  onCspViolation(report) {
    console.warn('CSP blocked:', report);
  },
  onSanitize(report) {
    console.info('Sanitize report:', report);
  },
});

await preview.render(fileOrHtmlString);
```

## Runtime Entrypoints

The package is **ESM-only** and requires Node 18+ for the Node/default entrypoint.
It exposes separate Node and browser builds through package export conditions:

- Node/default import: uses DOMPurify with jsdom.
- Browser import: uses DOMPurify with the real browser `window`.
- Explicit browser import: `html-preview-sandbox/browser`.

Most modern bundlers resolve the `browser` condition automatically. The example and Playground run against `dist/index.browser.js`, so build the package before opening them from the repository.

Use the explicit browser subpath when your runtime or bundler does not honor the `browser` condition:

```js
import { createPreview } from 'html-preview-sandbox/browser';
```

## React

```jsx
import { SafeHtmlPreview } from 'html-preview-sandbox/react';

function ReportViewer({ html }) {
  return (
    <SafeHtmlPreview
      source={html}
      csp="strict"
      onOpenExternal={(url) => window.open(url, '_blank', 'noopener,noreferrer')}
    />
  );
}
```

`source` accepts the same inputs as `render()` (string, `File`, `Blob`, bytes). All
`PreviewOptions` are props; the forwarded `ref` exposes the underlying
`PreviewHandle` for imperative use. `react` is an optional peer dependency —
nothing changes for non-React consumers. See `examples/react/`.

## Sanitizer Choice

This project currently uses **DOMPurify** for the sanitization layer.

- Browser runtime: DOMPurify runs against the real browser `window`.
- Node runtime: DOMPurify runs with jsdom.
- `sanitize-html` is not used in the current implementation.

DOMPurify is still only one layer. The preview also relies on CSP, a sandboxed iframe, bridge handling, external URL filtering, and optional host navigation interception.

## What It Is

- A client-side preview pipeline for untrusted HTML files and strings.
- A way to preserve useful interactivity while reducing host-app risk.
- A small core package with Web examples and a Playground.

## What It Is Not

- Not a browser: it does not browse URLs or support multi-page navigation.
- Not an attachment system: download, decrypt, cache, and permission checks belong to the host app.
- Not a DOMPurify replacement: sanitization is one layer in a defense-in-depth pipeline.
- Not a guarantee that all HTML is safe: see `THREAT_MODEL.md`.

## Pipeline

```text
input -> decode -> sanitize -> CSP policy -> bridge -> sandboxed iframe
```

The default sandbox intentionally omits `allow-same-origin`, giving the previewed document an opaque origin. External links and `window.open` calls are forwarded to the host through callbacks. In pure Web environments, JavaScript-driven `window.location` navigation cannot be fully intercepted; Electron or other hosts can add stronger navigation controls.

Host integrations that can observe iframe navigations may call `preview.notifyNavigationAttempt(url)`. The core renderer will restore the last trusted `srcdoc` and forward the URL through the same external-link allowlist.

The three CSP presets are layered by **exfiltration capability**, not by which resources they load:

- `offline`: no network at all. Only inline scripts/styles and `data:`/`blob:` resources.
- `strict` (default): blocks attacker-readable exfiltration channels — `connect-src 'none'`, `form-action 'none'`, and no wildcard `img-src`/`media-src`. Fixed static CDN/font hosts may be loaded, and inline script plus `unsafe-eval` are permitted, because they add no attacker capability beyond the already-permitted inline scripts and provide no attacker-readable exfiltration sink. This is not "zero network" — requests to whitelisted hosts still leave the machine (see the residual-risk note in `THREAT_MODEL.md`).
- `balanced`: opens `https:` images/media and `connect-src https:`. This is a general-purpose exfiltration surface, so use it only for semi-trusted content.

Custom sandbox tokens are filtered by default. High-risk tokens such as `allow-same-origin`, `allow-downloads`, and top-navigation permissions are ignored unless `allowUnsafeSandboxTokens` is set.

External links are also fail-closed. The default protocol allowlist is `http:`, `https:`, `mailto:`, and `tel:`. Hosts can narrow it with `externalProtocols` and add domain or product rules with `allowExternalUrl`.

## Documentation

- [Integration Guide](docs/INTEGRATION.md)
- [使用文档(中文)](docs/README.zh-CN.md)
- [Security Model](docs/SECURITY_MODEL.md)
- [Sanitizer Decision](docs/SANITIZER_DECISION.md)
- [Browser Support](docs/BROWSER_SUPPORT.md)
- [Project Structure](docs/PROJECT_STRUCTURE.md)
- [Branching & Releases](docs/BRANCHING.md)
- [Roadmap](docs/ROADMAP.md)
- [Threat Model](THREAT_MODEL.md)
- [Security Policy](SECURITY.md)

## Project Structure

The package source lives in `src/` and builds to `dist/`. Tests and local examples run against the built output so local checks match the package that consumers receive.

```text
src/          TypeScript package source
dist/         Generated ESM bundles and declarations
playground/   Local security inspection workbench
examples/     Minimal integration examples
fixtures/     HTML regression inputs
test/         Node and Playwright tests
docs/         Integration, architecture, and security notes
```

## Tests

```bash
npm run check:types
npm test
npm run test:browser
npm run build
```

The type check validates the TypeScript source and generated public API surface. The Node test suite covers decoding, CSP generation, injection order, protocol filtering, and sanitization reports. The Playwright suite verifies real browser iframe sandboxing and external-link bridging, plus the Web example, file-upload example, Web Component, and Playground behaviors.

In CI, install the Playwright browser before `npm run test:browser`:

```bash
npx playwright install --with-deps chromium firefox webkit
```

Run the default local quality gate before publishing changes:

```bash
npm run check
```

## Playground

Build the package, serve the repository root with any static file server, then open `/playground/`.

```bash
npm run build
npm run serve
```

Then visit `http://localhost:4173/playground/`.

The Playground is a three-panel workbench with HTML input, sandboxed preview, and an inspector for sanitizer removals, CSP violations, external requests, and current policy. It also includes sample payloads plus controls for CSP preset, external protocols, and host suffix filtering. You can drag an HTML file onto the editor, toggle a "sanitized HTML" view to inspect the exact document the pipeline produced, and use Share to encode the input + preset into a shareable URL.

### Hosted Playground

`.github/workflows/pages.yml` deploys the Playground to GitHub Pages on every push to `main`. The workflow builds the library and assembles a site that mirrors the Playground's relative imports, so no code changes are needed. One-time setup: in the repository, go to **Settings → Pages → Source** and select **GitHub Actions**. After the first successful run the Playground is available at `https://preview-sandbox.github.io/html-preview-sandbox/playground/`.

## Status

`v0.1.0` is published to npm with build provenance. This is an initial TypeScript implementation and the API is expected to evolve before 1.0.
