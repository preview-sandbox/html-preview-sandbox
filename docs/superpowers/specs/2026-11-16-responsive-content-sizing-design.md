# v0.4 Responsive Content Sizing Design

## Intent

`html-preview-sandbox` currently gives every preview iframe `width: 100%` and
`height: 100%`. That is a good default for desktop panes, playgrounds, and
full-screen viewers, but it requires hosts to provide a definite container
height. Inline previews in paste pages, AI reports, documentation, feeds, and
collaboration products need the iframe to follow the rendered document height.

`v0.4.0` adds opt-in content-height sizing without weakening the opaque-origin
sandbox or changing the default layout behavior.

## Goals

- Keep the current fill-container behavior as the default.
- Add an opt-in content-height mode for the browser renderer and React wrapper.
- Provide one tested `postMessage` sizing path on Chromium, Firefox, and WebKit.
- Keep the internal boundary ready for the emerging native responsive-iframe
  standard after it becomes stable and testable across browser engines.
- Bound untrusted height reports and retain iframe scrolling when content is
  taller than the configured maximum.
- Support dynamic growth and shrink after scripts, images, fonts, or DOM changes.
- Make applied iframe size observable to host applications.
- Add no runtime dependency and keep the project a single npm package.

## Non-goals

- Automatically enable content sizing for existing users.
- Make arbitrary viewport-dependent documents perfectly self-sizing. Documents
  built around `100vh`, fixed positioning, or height media queries can create
  circular layout dependencies and should use fill mode.
- Prevent CPU-heavy scripts, infinite DOM mutation, or other sandbox-local
  resource exhaustion. This remains outside the threat model.
- Resize iframe width to match content.
- Add Vue, Angular, or additional framework packages in this release.
- Adopt a third-party iframe-resizer runtime.

## Approaches Considered

### Simple `ResizeObserver` patch

Inject an observer, post `documentElement.scrollHeight`, and set iframe height.
This is small, but `documentElement.scrollHeight` is at least the current iframe
viewport height in Chromium, Firefox, and WebKit, so an iframe can grow but fail
to shrink. It also leaves clamping, cleanup, multi-instance isolation, and
runtime option changes underspecified.

### Third-party iframe resizer

`iframe-resizer` is mature but v5 is GPLv3/commercial and is not suitable for
embedding in this MIT-distributed library without licensing consequences.
`open-iframe-resizer` is MIT, but it would duplicate the bridge, lifecycle, and
React integration that this package already owns.

### Native-first with an internal fallback

Use `frame-sizing: content-height`,
`<meta name="responsive-embedded-sizing">`, and `window.requestResize()` where
supported, then fall back to a package-owned observer and message protocol. This
is not selected for `v0.4`: as of the design date the feature is experimental,
available only in recent Chromium, and absent from Firefox and Safari. Making it
the preferred path would create a release-critical branch that the current CI
matrix cannot exercise consistently.

### Bridge-first with a native-ready boundary

Use one package-owned observer and message protocol in every supported browser.
Keep sizing isolated behind `src/sizing.ts` and a private document marker so a
future release can adopt the native standard without changing the public API.
This is the selected `v0.4` approach.

## Public API

Add the following types:

```ts
export type PreviewSizingOptions =
  | { mode?: 'fill'; minHeight?: never; maxHeight?: never }
  | { mode: 'content'; minHeight?: number; maxHeight?: number };

export interface PreviewFrameSize {
  width: number;
  height: number;
}
```

Extend `PreviewOptions`:

```ts
export interface PreviewOptions {
  // Existing options stay unchanged.
  sizing?: PreviewSizingOptions;
  onFrameResize?: (size: PreviewFrameSize) => void;
}
```

Usage:

```ts
const preview = createPreview(container, {
  sizing: {
    mode: 'content',
    minHeight: 150,
    maxHeight: 10_000,
  },
  onFrameResize({ height }) {
    console.info(`Preview height: ${height}px`);
  },
});
```

The React wrapper inherits both additions because `SafeHtmlPreviewProps`
extends `PreviewOptions`.

## Defaults And Validation

- Missing `sizing`, or `sizing.mode === 'fill'`, preserves `height: 100%`.
- `minHeight` and `maxHeight` are valid only with `mode: 'content'`; the
  discriminated union catches this in TypeScript and runtime validation rejects
  it in JavaScript.
- Content mode defaults to `minHeight: 150` and `maxHeight: 10_000` CSS pixels.
- Applied heights are rounded up to whole CSS pixels.
- `minHeight` must be a safe integer and at least `0`.
- `maxHeight` must be a safe integer and greater than `0`.
- `maxHeight` must be greater than or equal to `minHeight`.
- Invalid initial options throw `TypeError` synchronously from `createPreview`.
- Invalid `updateOptions()` sizing throws synchronously and leaves the previous
  options unchanged.
- `createHtmlDocument()` validates the same sizing contract before assembly.
- Content mode requires an effective `allow-scripts` sandbox token because the
  opaque-origin parent cannot measure the child DOM directly. An explicit token
  set without `allow-scripts` is rejected rather than silently leaving the
  iframe at its minimum height.
- Content mode also requires the effective CSP to allow the package's injected
  inline bridge. A custom `script-src` that blocks it is rejected synchronously
  instead of silently leaving the iframe at its minimum height. Presets continue
  to permit the bridge. To preserve the oldest supported engines, validate the
  fallback directive as well as any `script-src-elem` override. Policy inherited
  from the host is outside this static validation.
- Sizing changes made with `updateOptions()` apply fully on the next `render()`;
  the React wrapper automatically re-renders its current source when `sizing`
  changes, matching its existing CSP and sanitizer-option behavior.

## Document Instrumentation

Content mode marks the generated bridge script with the private
`data-html-preview-sandbox-sizing="content"` attribute. The bridge reads it
from its own script element before starting measurement. This keeps the public
`injectBridgeScript(html)` signature unchanged. Fill mode does not start sizing
observers or emit sizing messages.

The child bridge:

1. Starts after `DOMContentLoaded` so `document.body` exists.
2. Observes body border-box changes with `ResizeObserver`.
3. Coalesces mutation, captured resource-load, `document.fonts` loading, and
   resize changes with one `requestAnimationFrame` callback.
4. Emits the content-size message to the host.
5. Suppresses duplicate measured heights in the child.
6. Disconnects observers and listeners when the document unloads.

Measurement combines root and body geometry so collapsed document margins are
included without treating the viewport's minimum scroll extent as content.
When previously measured overflow fits the viewport exactly, the bridge checks
positioned descendants and skips collapsed details. A fallback timer allows a
zero-height frame to remeasure when animation frames are throttled. Repeated
viewport-driven reversals settle at a recent larger measurement and resume
measurement after content, resource, or width changes. This is a stability
guard, not a promise to fit arbitrary fixed-position or viewport-dependent CSS.

The package's injected scrollbar style has separate fill and content variants.
Fill mode retains the existing `html, body { min-height: 100% }` behavior.
Content mode omits that rule because tying the body minimum to the current iframe
viewport would make a frame grow but prevent it from shrinking. Growth and
shrink tests run with scrollbar injection enabled, which is the public default.

## Host Behavior

For content mode the renderer:

- starts at the configured `minHeight`; the default `150` avoids a zero-height
  flash while an explicit `0` remains available;
- sets CSS `min-height` and `max-height` from normalized options;
- applies validated bridge height messages;
- verifies `event.source === iframe.contentWindow` before handling a message;
- treats the reported height as untrusted, requiring a finite non-negative
  number so an explicit zero minimum can represent an empty document;
- clamps every applied value to the configured range;
- coalesces host updates to one per animation frame and ignores duplicates;
- does not disable iframe scrolling when the maximum is reached; author CSS can
  still intentionally suppress scrolling;
- cancels pending animation frames and disconnects observers on remount or
  `destroy()`.

`onFrameResize` reports the applied iframe border-box size from a host-side
`ResizeObserver`. Implementations use `borderBoxSize` where supported and
`iframe.getBoundingClientRect()` as the compatibility fallback. Duplicate
width/height pairs are suppressed. It works in both fill and content modes when
supplied, and does not expose untrusted raw child measurements. Adding,
replacing, or removing this callback through `updateOptions()` immediately
reconciles the observer without remounting the iframe; removing it disconnects
the observer.

## Security Model

The iframe content is allowed to run scripts by design, so a child can create a
tall element or send a forged message. Content sizing therefore cannot treat
the reported number as authoritative. Source-window verification prevents
cross-preview and unrelated-window messages; finite-number validation and the
hard maximum prevent unbounded host-page expansion.

Content sizing does not add `allow-same-origin`, relax CSP, expose host data, or
change external navigation policy. The new residual risk is host-page layout
jank within the configured height bound. The threat model and security model
must state this explicitly.

## Compatibility

The bridge implementation must pass the existing Playwright matrix on Chromium,
Firefox, and WebKit, so the documented browser floors remain unchanged. Native
responsive iframe sizing remains experimental and is deliberately deferred
until more than one browser engine supports it and the native branch can be
exercised in CI.

References:

- [MDN: `frame-sizing`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/frame-sizing)
- [MDN: `Window.requestResize()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestResize)
- [CSS Box Sizing Level 4](https://drafts.csswg.org/css-sizing-4/#responsive-iframes)

## Product Surface

- Add a focused `examples/content-sizing/` example with fill/content switching,
  dynamic growth and shrink, and a visible applied-height readout.
- Add Playground sizing controls and an applied-size inspector row.
- Document vanilla and React usage in English and Chinese.
- Keep the existing examples and default screenshots/layouts in fill mode.

## Release Boundary

`v0.3.2` security and dependency maintenance is a release precondition for this
work. `v0.4.0` contains responsive content sizing, its frame observability callback,
examples, tests, security documentation, and release metadata. Unrelated work
such as optional `jsdom`, Vue integration, new policy presets, or broad
dependency-major upgrades remains outside this version unless required by a
security advisory or build failure.
