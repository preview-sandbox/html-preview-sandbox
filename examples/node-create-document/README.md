# Node `createHtmlDocument` example

Demonstrates the "full pipeline, no iframe" path: `createHtmlDocument` runs
decode → sanitize → CSP injection → bridge injection and returns a complete,
self-contained safe HTML **string**. It does not create an iframe.

Useful when the host already owns the rendering surface or runs server-side:

- self-managed webviews (Electron `webview`, native WKWebView/WebView2);
- SSR / server pre-processing of untrusted HTML;
- CLI tools that convert untrusted HTML into a safe document.

## Run

```bash
npm run build            # from the repo root
node examples/node-create-document/convert.mjs
```

The Node entry uses DOMPurify with jsdom, so no browser is required.

## Important

`createHtmlDocument` performs the **pipeline**, not the **isolation**. The returned
string still contains inline scripts (by design — interactivity is preserved). The
host must render it inside a sandboxed context (an iframe or webview **without**
`allow-same-origin`). See [../../THREAT_MODEL.md](../../THREAT_MODEL.md).
