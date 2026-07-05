# Security Model

`html-preview-sandbox` uses defense in depth. No single layer is treated as sufficient.

## Layers

1. **Sanitization**
   DOMPurify-backed sanitization removes blocked tags, attributes, protocols, meta refresh, and user-provided CSP.
   The Node entrypoint runs DOMPurify with jsdom; the browser entrypoint runs DOMPurify against the real browser `window`.

2. **CSP**
   A generated meta CSP limits network access, object embedding, form submission, and resource loading.

3. **Sandboxed iframe**
   The preview iframe uses `sandbox` without `allow-same-origin`, creating an opaque origin.

4. **Bridge**
   A small injected script forwards link clicks, `window.open`, and CSP violation reports to the host.

5. **Host adapter**
   Hosts may add stronger capabilities such as Electron navigation interception.

## Default Sandbox

```text
allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals
```

`allow-same-origin` and `allow-downloads` are intentionally omitted.

If callers provide custom sandbox tokens, the renderer filters high-risk tokens by default:

```text
allow-same-origin allow-top-navigation allow-top-navigation-by-user-activation allow-downloads
```

These tokens are preserved only when `allowUnsafeSandboxTokens` is explicitly enabled.

## CSP Presets

The presets are layered by **exfiltration capability (egress)**, not by which resources they load (ingress). The core threat is not whether untrusted HTML can load a resource, but whether it can send data to a location the attacker can read.

- `offline`: no network at all. Inline scripts/styles and local `data:`/`blob:` resources only. Nothing enters or leaves.
- `strict`: default. Blocks attacker-readable exfiltration channels — `connect-src 'none'`, `form-action 'none'`, and no wildcard `img-src`/`media-src` (`blob: data:` only). It permits inline script, `unsafe-eval`, and fixed static CDN/font hosts, because in the presence of already-permitted inline scripts these add no attacker capability and provide no attacker-readable exfiltration sink. This is not zero network: requests to whitelisted hosts still leave the machine, leaving narrow low-bandwidth side channels (see `THREAT_MODEL.md` → Residual Risk).
- `balanced`: opens `https:` images/media and `connect-src https:`, which is a general-purpose exfiltration surface. For semi-trusted content only.

## Default External Protocols

```text
http: https: mailto: tel:
```

Other protocols are blocked before reaching `onOpenExternal`.

Hosts can narrow this list with `externalProtocols`. They can also provide `allowExternalUrl(url, context)` for domain-level or product-level decisions. The custom callback is evaluated only after the protocol allowlist passes, and it must return `true` to allow the URL.

## Important Limits

- Scripts are allowed by design, because the project exists to preserve useful HTML interactivity.
- `unsafe-inline` is allowed in CSP presets because the injected bridge and many self-contained reports rely on inline scripts.
- `unsafe-eval` is allowed in `strict` and `balanced` (not `offline`). Since inline script is already permitted, `unsafe-eval` adds no attacker capability; blocking it would only break chart libraries and similar generated reports without a security gain.
- `connect-src` is `none` in `strict` and `offline`, blocking the primary data-exfiltration channel despite script execution. `strict` additionally keeps `img-src`/`media-src` at `blob: data:` (no wildcard host) and `form-action 'none'` so there is no attacker-readable exfiltration sink.
- `allowExternalUrl` is fail-closed when provided: thrown errors and non-`true` results block the URL.
- Pure Web hosts cannot fully stop `window.location` navigation; stronger host adapters are required for that layer.

## Why DOMPurify Is Not Enough

DOMPurify is a sanitizer. This project uses it as one layer, then adds CSP, sandboxing, link handling, and host integration. Users should not extract the sanitizer configuration and treat it as the whole security story.

## Playground Coverage

The Playground is an inspection surface for this model. It renders through the built browser bundle and exposes sanitizer removals, CSP violations, external request forwarding, CSP presets, protocol filtering, and host suffix URL policy in one place.

## DOMPurify vs sanitize-html

The current implementation uses **DOMPurify**.

`sanitize-html` was considered, but the package currently favors DOMPurify because browser-side DOM parsing and mXSS hardening are important for this project. Node usage is supported by running DOMPurify with jsdom.

This choice can be revisited if future requirements prioritize a Node-only policy engine, but the v0.1 implementation and tests are DOMPurify-based.

See [Sanitizer Decision](SANITIZER_DECISION.md) for the detailed criteria and trade-offs.
