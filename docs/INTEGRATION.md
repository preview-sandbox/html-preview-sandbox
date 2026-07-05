# Integration Guide

This guide describes how to embed `html-preview-sandbox` in a host application.

## Basic Web Integration

```js
import { createPreview } from 'html-preview-sandbox';

const preview = createPreview(document.querySelector('#preview'), {
  csp: 'strict',
  onOpenExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  },
  onSanitize(report) {
    console.info(report);
  },
  onCspViolation(report) {
    console.warn(report);
  },
});

await preview.render(fileOrHtmlString);
```

Modern bundlers should resolve the package `browser` export automatically. Repository examples run against `dist/index.browser.js`; run `npm run build` before opening them locally.

If your bundler or runtime does not honor the `browser` condition, import the explicit browser subpath:

```js
import { createPreview } from 'html-preview-sandbox/browser';
```

The sanitizer is DOMPurify in both runtimes. Browser integrations use the real browser `window`; Node integrations use jsdom.

The default iframe sandbox omits `allow-same-origin`. Previewed content receives an opaque origin and cannot read host cookies, storage, or DOM.

## External Links

Links and `window.open()` calls inside the sandbox are forwarded to `onOpenExternal`.

If `onOpenExternal` is not provided, external requests are discarded. This is intentional fail-closed behavior.

Always validate or route external URLs in the host application. The core package allows only `http:`, `https:`, `mailto:`, and `tel:` by default.

Use `externalProtocols` to narrow the default protocol allowlist:

```js
const preview = createPreview(container, {
  externalProtocols: ['https:'],
  onOpenExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  },
});
```

Use `allowExternalUrl` for host-specific policy. If this callback is provided, it must return `true` to allow the URL:

```js
const preview = createPreview(container, {
  externalProtocols: ['https:'],
  allowExternalUrl(url, context) {
    const parsed = new URL(url);
    return context.source === 'link' && parsed.hostname.endsWith('.example.com');
  },
  onOpenExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  },
});
```

The same external URL policy is used for bridge-forwarded links, `window.open`, and host-reported navigation attempts.

## Navigation Attempts

Pure Web pages cannot reliably intercept all `window.location` assignments from a sandboxed iframe. Hosts that can observe iframe navigation, such as Electron main-process code, should call:

```js
preview.notifyNavigationAttempt(url);
```

The preview will restore the last generated `srcdoc` and route the URL through the same external-link allowlist.

See [`examples/electron/`](../examples/electron/) for a complete main-process interception example (`did-start-navigation` / `will-frame-navigate` → IPC → `notifyNavigationAttempt`), and [`examples/web-component/`](../examples/web-component/) for a `<safe-html-preview>` custom-element wrapper.

## Presets

Presets are layered by exfiltration capability, not by which resources they load:

- `strict`: default. Blocks attacker-readable exfiltration (`connect-src 'none'`, `form-action 'none'`, no wildcard `img-src`/`media-src`). Allows inline script, `unsafe-eval`, and fixed static CDN/font hosts, so most self-contained reports render without opening a data-exit channel.
- `balanced`: opens HTTPS images/media and `connect-src https:` for semi-trusted reports that need remote resources or API calls. This is a general-purpose exfiltration surface.
- `offline`: no network at all — local `data:`/`blob:` resources only.

Use `strict` unless users explicitly expect remote images/media or API calls, in which case use `balanced`. See `../THREAT_MODEL.md` for the residual side channels that remain under `strict`.

## Sandbox Overrides

The default sandbox omits high-risk permissions. If you pass custom `sandboxTokens`, the package still filters these tokens by default:

```text
allow-same-origin allow-top-navigation allow-top-navigation-by-user-activation allow-downloads
```

Only enable `allowUnsafeSandboxTokens` for controlled, trusted content. For untrusted HTML previews, keeping an opaque origin is a core part of the security model.

## Large Files

The default input size limit is 100 MB. Override it with `maxBytes` only after testing performance in your host application.

## Type Safety

The package is implemented in TypeScript and publishes generated declarations. Public options such as `externalProtocols`, `allowExternalUrl`, and `allowUnsafeSandboxTokens` are covered by the same API surface used by TypeScript consumers.

Run this before changing public API behavior:

```bash
npm run check:types
```

## Playground

The repository Playground runs from the built browser bundle:

```bash
npm run build
npm run serve
```

Open `http://localhost:4173/playground/`. The workbench includes sample payloads, CSP preset switching, external protocol controls, host suffix filtering, and live inspector panels for sanitizer removals, CSP violations, external requests, and current policy.

## Recommended Host Behavior

- Show a clear empty/error state when sanitization removes all content.
- Route external links through a user-visible action.
- Keep `allow-same-origin` disabled unless you fully understand the risk.
- Prefer `strict` or `offline` for untrusted attachments.
- Add host-level navigation interception if your platform supports it.
