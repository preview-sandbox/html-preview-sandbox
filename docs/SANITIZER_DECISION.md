# Sanitizer Decision

## Decision

`html-preview-sandbox` uses **DOMPurify** as the sanitizer for v0.1.

`sanitize-html` was considered, but is not used in the current implementation.

## Context

This project previews untrusted HTML inside a browser-like environment. The sanitizer must therefore match browser parsing behavior as closely as practical, support hostile HTML/SVG inputs, and work as one layer in a larger sandbox pipeline.

The pipeline is:

```text
input -> decode -> sanitize -> CSP policy -> bridge -> sandboxed iframe
```

The project is not a general CMS content cleaner and not a server-only HTML transformation library.

## Decision Criteria

The sanitizer choice was judged against these criteria:

- **Browser fidelity:** the preview is eventually rendered by a browser iframe, so browser DOM behavior matters.
- **XSS focus:** the default threat model is untrusted HTML with script, SVG, URL, parser, and mutation-style attack surfaces.
- **Client runtime:** the package must run naturally in browser applications without requiring a server.
- **Node support:** tests and server-side document generation still need a Node path.
- **Hooks and reports:** the project needs policy hooks and a removal report for the Playground and host callbacks.
- **Maintenance signal:** security-sensitive dependencies should have clear active maintenance and security posture.

## Why DOMPurify

DOMPurify is browser-first and DOM-based. Its public documentation describes it as an XSS sanitizer for HTML, MathML, and SVG, and explains that it uses browser-provided technologies as the basis of the filter. That matches this project's main runtime: previewing HTML that will be parsed and executed by a browser engine.

DOMPurify also supports Node when paired with jsdom. That lets the project use the same sanitizer family in both entrypoints:

- Browser entrypoint: DOMPurify with the real browser `window`.
- Node/default entrypoint: DOMPurify with jsdom.

This keeps policy behavior easier to reason about than maintaining unrelated sanitizers for browser and Node.

## Why Not sanitize-html for v0.1

`sanitize-html` is useful when the primary job is server-side cleanup of user-submitted HTML using explicit tag and attribute allowlists. Its public repository describes that model and notes that it is built on `htmlparser2`.

That is not the best fit for this project's first release because:

- The main rendering target is a sandboxed browser iframe, not a server-rendered CMS field.
- Browser DOM parsing behavior is central to the security model.
- The project needs a browser-native path without making the browser build feel like an adaptation of a server sanitizer.
- The previously used desktop implementation already demonstrated the `sanitize-html` route, but the open source project is intentionally a fresh, more general design.

As of July 5, 2026, the original `apostrophecms/sanitize-html` GitHub repository is archived and points to a monorepo. That does not make the package unusable by itself, but it weakens the maintenance signal for choosing it as the core of a new security-oriented package.

## Consequences

Choosing DOMPurify means:

- Node usage depends on keeping jsdom current.
- Sanitization must stay one layer only; CSP, sandboxing, bridge filtering, and host navigation interception remain required.
- Project hooks must preserve this package's stricter preview policy on top of DOMPurify defaults.
- Tests must cover browser behavior, not only string-level sanitization.

## Revisit Conditions

Revisit the sanitizer choice if:

- the package becomes primarily server-side;
- browser runtime support is no longer required;
- DOMPurify cannot support required policy hooks;
- jsdom becomes unsuitable for the Node entrypoint;
- a standardized browser Sanitizer API becomes mature enough for this project's compatibility target.

## References

- [DOMPurify](https://github.com/cure53/DOMPurify)
- [sanitize-html](https://github.com/apostrophecms/sanitize-html)
