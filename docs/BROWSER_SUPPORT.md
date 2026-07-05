# Browser Support

`html-preview-sandbox` targets modern evergreen browsers and recent Electron. There is no polyfill layer; the library relies directly on the platform features listed below.

## Supported Baseline

| Environment | Minimum |
|-------------|---------|
| Chrome / Edge | 90+ |
| Firefox | 90+ |
| Safari | 14+ |
| Electron | 12+ (Chromium 89+) |
| Node (for the jsdom-backed sanitizer path and tests) | 18+ |

The binding constraint is `Blob.prototype.arrayBuffer()` (Safari 14, 2020). Everything else the library uses is available earlier.

## Platform Features Used

Host side (`createPreview` / renderer):

- **Sandboxed `<iframe>` with `srcdoc`** — the core isolation primitive. The default sandbox omits `allow-same-origin`, giving the document an opaque origin.
- **`postMessage` / `message` events** — the bridge channel between the sandboxed document and the host.
- **`TextDecoder`** — charset decoding in `decode` (UTF-8, UTF-16, and declared legacy charsets such as GBK).
- **`Blob.prototype.arrayBuffer()`** — reading `Blob`/`File` inputs.
- **`URL`** — external-link protocol parsing and validation.

Injected bridge (runs inside the sandboxed document):

- **`securitypolicyviolation` event** — CSP violation reporting, since `report-uri`/`report-to` are ignored under a `<meta>` CSP.
- **`CSS.escape`** — safe fragment lookup for in-page anchor scrolling.
- Modern syntax (arrow functions, `const`/`let`, template literals, `Set`) — the bridge is injected as ES2020-level source and runs in the target browser.

Sanitizer:

- **Browser entrypoint**: DOMPurify against the real `window`.
- **Node entrypoint**: DOMPurify against a jsdom `window`.

## Notes

- CSP is delivered as a `<meta http-equiv="Content-Security-Policy">` tag. All supported browsers honor meta CSP for the directives this library uses; `report-uri`/`report-to` are intentionally not used (they are ignored in meta CSP), which is why violation reporting goes through the `securitypolicyviolation` event and the bridge instead.
- The `strict`/`balanced`/`offline` presets rely only on CSP directives that are broadly supported across the baseline. `upgrade-insecure-requests` and `block-all-mixed-content` degrade gracefully where unsupported.
- Older browsers are not tested and not supported. If a wider baseline is required, that would be a deliberate future scope decision (see `ROADMAP.md`).
