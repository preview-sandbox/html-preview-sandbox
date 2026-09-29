# Examples

Runnable integration examples for `html-preview-sandbox`. Each shows a different
real-world entry point. All examples import the built library from `../../dist`,
so **build first**:

```bash
npm run build
```

The browser examples also resolve `dompurify` from `../../node_modules`, so run
them from the repository (after `npm install`), not from a copied folder.

| Example | Entry point it demonstrates | Runtime | Auto-tested |
|---------|-----------------------------|---------|-------------|
| [`web/`](web/) | String input | Browser | `test/browser/preview.spec.js` |
| [`file-upload/`](file-upload/) | `File`/`Blob` input, drag & drop, error states | Browser | `test/browser/file-upload.spec.js` |
| [`web-component/`](web-component/) | `<safe-html-preview>` custom element | Browser | `test/browser/web-component.spec.js` |
| [`react/`](react/) | `<SafeHtmlPreview>` React component | Browser (needs `npm run build`) | `test/browser/react.spec.js` |
| [`electron/`](electron/) | Desktop host + main-process navigation interception | Electron 25+ | `npm run test:electron` |
| [`node-create-document/`](node-create-document/) | `createHtmlDocument` (pipeline, no iframe) | Node | verify by output |

## Browser examples (web, file-upload, web-component)

**Run** — serve the repository root and open the example path:

```bash
npm run build
npm run serve
# then open:
#   http://localhost:4173/examples/web/
#   http://localhost:4173/examples/file-upload/
#   http://localhost:4173/examples/web-component/
```

**Verify manually** — the preview renders inside a sandboxed iframe, scripts run,
external links go through the host callback, and (file-upload) the info panel shows
the detected encoding, sanitizer removals, and the `OVERSIZED` error state when you
lower `maxBytes` and upload a bigger file.

**Verify automatically** — these three are covered by the Playwright suite:

```bash
npm run test:browser
```

(First time: `npx playwright install --with-deps chrome`.)

## Electron example

Electron is a repository development dependency, not a runtime dependency of the
published package. Install the repository dependencies before running it:

```bash
npm ci
npm run build
npx electron examples/electron/main.cjs
```

Run the automated Electron smoke test with `npm run test:electron`. It verifies
the sandboxed preview, preload/main-process bridge, and text-only rendering of
untrusted navigation URLs. The navigation interception requires Electron 25 or
newer and verifies that each attempt is cancelled and forwarded exactly once.

**Verify** — the window renders the sandboxed preview; clicking the external link
opens the system browser (via `shell.openExternal`); clicking "Try to navigate away"
triggers the main-process interception, which re-mounts the original document instead
of letting the iframe navigate off. See [`electron/README.md`](electron/README.md).

## Node example

A short script; no browser or server needed.

```bash
npm run build
node examples/node-create-document/convert.mjs
```

**Verify** — the console prints the detected encoding, the sanitizer report (the
`onerror` handler and `javascript:` href are removed), the safe document length, and
`has CSP meta: true`. See [`node-create-document/README.md`](node-create-document/README.md).
