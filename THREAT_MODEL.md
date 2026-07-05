# Threat Model

`html-preview-sandbox` is designed for apps that need to preview untrusted HTML files or strings while preserving useful interactivity.

## Trust Boundaries

- Host app: trusted application code, storage, cookies, and user context.
- Preview iframe: untrusted HTML running in a sandboxed `srcdoc` iframe.
- External browser/system handler: destination for host-approved external links.

## Defense Goals

- Reduce access from previewed HTML to host app DOM, storage, cookies, and APIs.
- Block common dangerous tags, attributes, protocols, and auto-triggering handlers.
- Limit data exfiltration through CSP presets.
- Prevent external links and popups from silently taking over the preview iframe.
- Surface sanitizer changes and CSP violations to the host app.

## Non Goals

- It does not stop CPU-heavy scripts, infinite loops, or resource exhaustion inside the sandbox.
- It does not detect phishing content or misleading text rendered inside HTML.
- It does not protect against browser or runtime sandbox vulnerabilities.
- It does not make dangerous custom policies safe.
- It does not fully intercept `window.location` navigation in pure Web hosts.

## Residual Risk: Low-Bandwidth Side Channels (strict preset)

The `strict` preset blocks general-purpose, attacker-readable exfiltration channels, but it is not "zero network". Because it permits loading from fixed static CDN and font hosts, some low-bandwidth information leakage remains possible and is **out of scope**:

- Request patterns to whitelisted hosts (for example, encoding data into a path served by a CDN whose access logs the attacker can observe indirectly).
- DNS resolution of whitelisted hostnames.
- Request timing and ordering.

These channels are narrow, aggregated, and high-latency compared to `connect-src`/image-URL exfiltration, which `strict` does block. Integrations that must eliminate even these should use the `offline` preset (no network at all).

## Web vs Host Adapters

Pure Web integrations can intercept link clicks and `window.open` through the bridge script, but cannot reliably intercept all JavaScript-driven `window.location` navigation. Desktop hosts such as Electron can add navigation interception outside the iframe and re-render the original content.

## Default Position

The default `strict` preset fails closed for attacker-readable exfiltration: `connect-src 'none'`, `form-action 'none'`, no wildcard `img-src`/`media-src`, and no external link opening when `onOpenExternal` is not provided. It permits inline script, `unsafe-eval`, and fixed static CDN/font hosts, none of which add attacker capability beyond the already-permitted inline scripts (see the residual-risk note above for the narrow side channels that remain).

Custom sandbox tokens are also fail-closed for high-risk permissions. `allow-same-origin`, download, and top-navigation permissions are filtered unless the host explicitly opts into unsafe sandbox tokens.

External URL handling is fail-closed in two stages: the protocol must pass the configured allowlist, then `allowExternalUrl` must return `true` when that callback is provided.

## Sanitizer Position

The project uses DOMPurify for sanitization. DOMPurify reduces common HTML/script injection risk, but this project does not treat sanitization as sufficient by itself. CSP, iframe sandboxing, URL filtering, and host integration remain required parts of the design.
