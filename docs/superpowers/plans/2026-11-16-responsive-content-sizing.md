# v0.4 Responsive Content Sizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship opt-in, bounded iframe content-height sizing through one cross-browser bridge path, with React support, examples, tests, and synchronized security documentation.

**Architecture:** Keep `fill` as the default. In `content` mode, document assembly adds a private marker that activates size observation in the existing bridge; the renderer applies only validated, clamped height messages. Host-side observation reports only the applied iframe size, and the sizing boundary remains isolated for future native-standard adoption.

**Tech Stack:** TypeScript, DOM APIs, `ResizeObserver`, `MutationObserver`, `postMessage`, React 17-19 peer integration, Node test runner, Playwright Chromium/Firefox/WebKit.

**Spec:** [`docs/superpowers/specs/2026-11-16-responsive-content-sizing-design.md`](../specs/2026-11-16-responsive-content-sizing-design.md)

## Global Constraints

- `v0.3.2` security maintenance must be released first: patched DOMPurify,
  `source-map-js`, `undici`, and Electron 43; zero known audit findings; no
  `jsdom` 30 or Electron 44 major upgrade.
- The package remains a single npm package with no new runtime dependency.
- Internal `docs/superpowers/` planning artifacts remain excluded from the npm
  tarball.
- Default behavior remains `fill` with iframe `height: 100%`.
- Content mode defaults are exactly `minHeight: 150` and `maxHeight: 10_000` CSS pixels.
- The sandbox must continue to omit `allow-same-origin`.
- Child size messages are untrusted and must pass source, type, finite-number, and configured-bound checks.
- Zero is a valid child height when the configured minimum is zero; negative
  values are always invalid.
- Chromium, Firefox, and WebKit must use and verify the same bridge sizing path.
- Node 20.19+, 22.13+, and 24+ support and the existing browser floors remain unchanged.
- Fill/content option changes take full effect on the next `render()`; the React wrapper re-renders automatically.

## Implementation Notes

- Only the internally generated bridge script carries the sizing marker, and
  fill-mode documents retain their original script and scrollbar output.
- Custom script policy checks are conservative across browser floors: both the
  effective script element directive and its legacy fallback must allow the
  injected bridge. The renderer does not infer or replace host CSP.
- Host navigation remounts keep the last displayed sizing but reapply the
  current sandbox settings, including any host tightening. Observer callbacks
  can change independently on the mounted frame.
- The feature branch does not bump versions or publish. Release-candidate work
  remains a separate step after implementation review.

## Review Focus

- A document that grows and later shrinks must reduce iframe height on all three Playwright engines; Task 5 owns this test.
- Forged negative, non-finite, and over-limit resize messages must not escape configured bounds; Task 3 owns this test.
- Two content-sized previews on one page must never resize one another; Task 5 owns this test.
- A stale iframe removed by a later render must not resize the current iframe; Task 3 owns this test.
- Viewport-dependent content that repeatedly changes height must be coalesced and deduplicated without an unbounded host update loop; Task 3 owns this test.
- Default scrollbar-style injection must not prevent a grown content-mode frame
  from shrinking; Task 2 owns this regression test.
- Adding, replacing, or removing `onFrameResize` through `updateOptions()` must
  not remount the iframe; Task 3 owns this test.

---

### Task 1: Public Sizing Contract And Normalization

**Files:**
- Create: `src/sizing.ts`
- Modify: `src/types.ts`
- Modify: `src/index.ts`
- Modify: `src/index.browser.ts`
- Modify: `src/react.tsx`
- Modify: `src/document.ts`
- Modify: `src/document.browser.ts`
- Modify: `tsconfig.check.json`
- Create: `test/types/sizing.test.ts`
- Test: `test/document.test.js`
- Test: `test/entrypoints.test.js`

**Interfaces:**
- Produces: discriminated-union `PreviewSizingOptions` and `PreviewFrameSize` public types.
- Produces: `normalizeSizingOptions(value?: PreviewSizingOptions): NormalizedSizingOptions` with `{ mode, minHeight, maxHeight }`.
- Produces: internal constants `DEFAULT_CONTENT_MIN_HEIGHT = 150` and `DEFAULT_CONTENT_MAX_HEIGHT = 10_000`.
- Consumes: existing `PreviewOptions` and entrypoint type exports.

- [ ] **Step 1: Write failing contract tests**

Add runtime tests asserting that `createHtmlDocument()` accepts `{ sizing: { mode: 'content' } }`, rejects unknown modes, bounds supplied with fill mode, non-finite and non-integer values, negative minimums, non-positive maximums, and `maxHeight < minHeight`. Add a compile-only test with valid fill/content examples and `@ts-expect-error` cases for bounds on fill mode. Include `test/types/**/*.ts` in `tsconfig.check.json` and verify that all three public entrypoints remain importable without a DOM.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm run build && node --test test/document.test.js test/entrypoints.test.js`

Expected: FAIL because `sizing` is not defined or validated.

- [ ] **Step 3: Add types and normalization**

Add the spec's exact public types to `src/types.ts`, add `sizing` and `onFrameResize` to `PreviewOptions`, and implement strict normalization in `src/sizing.ts`. Validation must happen before returning a new normalized object and must never mutate caller input. Call the normalizer at the start of both `createHtmlDocument()` implementations; Task 2 will use the returned value for instrumentation.

- [ ] **Step 4: Export public types from Node, browser, and React entries**

Export `PreviewSizingOptions` and `PreviewFrameSize` alongside the existing type surface. Do not export the internal normalizer.

- [ ] **Step 5: Run focused tests and type checks**

Run: `npm run check:types && npm run build && node --test test/document.test.js test/entrypoints.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sizing.ts src/types.ts src/index.ts src/index.browser.ts src/react.tsx src/document.ts src/document.browser.ts tsconfig.check.json test/types/sizing.test.ts test/document.test.js test/entrypoints.test.js
git commit -m "feat: define preview sizing contract"
```

### Task 2: Responsive Document Instrumentation

**Files:**
- Modify: `src/bridge.ts`
- Modify: `src/document.ts`
- Modify: `src/document.browser.ts`
- Modify: `src/sizing.ts`
- Modify: `src/scrollbar.ts`
- Test: `test/policy.test.js`
- Test: `test/document.test.js`
- Test: `test/scrollbar.test.js`
- Test: `test/browser/bridge-harness.html`
- Test: `test/browser/bridge.spec.js`

**Interfaces:**
- Consumes: `NormalizedSizingOptions` and `normalizeSizingOptions()` from Task 1.
- Produces: `BRIDGE_CONTENT_SIZE = 'html-preview-sandbox:contentSize'`.
- Produces: `injectContentSizingMarker(html: string): string` using the private `data-html-preview-sandbox-sizing="content"` marker.
- Preserves: public `injectBridgeScript(html: string): string` signature.
- Produces messages shaped as `{ type: BRIDGE_CONTENT_SIZE, height: number }`.

- [ ] **Step 1: Write failing document-injection tests**

Assert that content mode injects exactly one private sizing marker before the bridge, fill mode has no marker, repeated helper application does not duplicate the marker, and fill-mode bridge execution emits no size message. Assert that fill mode retains the existing root/body minimum-height style while content mode omits it.

- [ ] **Step 2: Write failing real-browser bridge tests**

Extend the bridge harness to capture size messages. Assert initial reporting, growth after appending normal-flow content, shrink after removing it, shrink to zero for an empty document with a zero minimum, and one logical report per animation frame for a burst of mutations. Run growth and shrink with the default scrollbar injection enabled.

- [ ] **Step 3: Run focused tests and verify failure**

Run: `npm run build && node --test test/policy.test.js test/document.test.js && npx playwright test test/browser/bridge.spec.js`

Expected: FAIL because sizing instrumentation does not exist.

- [ ] **Step 4: Implement responsive meta injection**

Add an idempotent helper that inserts the private sizing marker in `<head>` only for content mode, preserving CSP-first ordering and the existing bridge placement contract. The bridge activates sizing by querying this marker, so the exported helper signature does not change.

Add a content-mode scrollbar style variant that omits
`html, body { min-height: 100% }`; do not change fill-mode output.

- [ ] **Step 5: Implement the child measurement lifecycle**

When the private marker is present, start after `DOMContentLoaded`, bind `ResizeObserver` to `body`, bind a coalesced `MutationObserver` to the document, listen for captured resource `load` events and `document.fonts.loadingdone`, schedule measurements through one animation frame, account for body block margins, use root scroll height only when it exceeds root client height, suppress duplicate measurements, post the measured height, and disconnect every observer/listener on unload.

- [ ] **Step 6: Wire both document implementations**

Normalize sizing before document assembly. Content mode injects the responsive meta and enables bridge sizing; fill mode preserves the current generated document behavior.

- [ ] **Step 7: Run focused tests**

Run: `npm run build && node --test test/policy.test.js test/document.test.js && npx playwright test test/browser/bridge.spec.js`

Expected: PASS on Chromium, Firefox, and WebKit.

- [ ] **Step 8: Commit**

```bash
git add src/bridge.ts src/document.ts src/document.browser.ts src/sizing.ts src/scrollbar.ts test/policy.test.js test/document.test.js test/scrollbar.test.js test/browser/bridge-harness.html test/browser/bridge.spec.js
git commit -m "feat: report responsive document height"
```

### Task 3: Bounded Host-Side Content Sizing

**Files:**
- Modify: `src/renderer-core.ts`
- Modify: `src/sizing.ts`
- Test: `test/browser/preview.spec.js`

**Interfaces:**
- Consumes: normalized sizing and `BRIDGE_CONTENT_SIZE` from Tasks 1-2.
- Produces: validated bridge application clamped to `[minHeight, maxHeight]`.
- Produces: host-side `onFrameResize(size: PreviewFrameSize)` notifications.

- [ ] **Step 1: Write failing default-preservation tests**

Assert that missing sizing and explicit fill mode retain `width: 100%` and `height: 100%`.

- [ ] **Step 2: Write failing content-mode tests**

Assert initial minimum height, configured min/max CSS, bridge height application, integer rounding, max clamping without the library disabling scrolling, duplicate suppression, and `onFrameResize` receiving only applied frame dimensions.

- [ ] **Step 3: Write failing hostile-message and lifecycle tests**

Post negative, `NaN`-equivalent, string, infinity-like, zero, and over-limit payloads; only finite non-negative values may affect the frame, and zero clamps to the configured minimum. Replace the iframe with a later render and prove the old `contentWindow` cannot resize it. Destroy the preview and prove pending frame callbacks no longer run. Burst alternating heights and assert at most one host write per animation frame.

Also assert that content mode with explicit sandbox tokens lacking
`allow-scripts` fails synchronously and leaves previous options intact. Preserve
support for `sanitize.allowScripts: false`, because the injected bridge still
runs under the default sandbox and CSP.

Assert that content mode with an effective custom `script-src` that blocks the
inline bridge fails synchronously and leaves previous options intact.

- [ ] **Step 4: Run the focused browser suite and verify failure**

Run: `npm run build && npx playwright test test/browser/preview.spec.js`

Expected: FAIL because the renderer ignores content-size messages.

- [ ] **Step 5: Implement host sizing state**

Normalize initial options synchronously, reject invalid `updateOptions()` patches without replacing current options, reset sizing state on each iframe remount, and preserve the fill styles exactly.

- [ ] **Step 6: Implement validated bridge application**

Keep the latest valid child height, apply it once per animation frame, clamp to normalized bounds, and ignore duplicates. Never use message origin as the trust check because the sandbox has an opaque origin; use `event.source`.

- [ ] **Step 7: Implement applied-size observation and cleanup**

Create a host `ResizeObserver` only when `onFrameResize` is supplied. Read `borderBoxSize` when available and fall back to `iframe.getBoundingClientRect()` for the documented browser floor, report deduplicated width/height pairs, and disconnect it together with pending animation frames on remount and destroy. Reconcile observation immediately when `updateOptions()` adds, replaces, or removes the callback; callback-only updates must not remount the iframe.

- [ ] **Step 8: Run focused tests**

Run: `npm run build && npx playwright test test/browser/preview.spec.js`

Expected: PASS on Chromium, Firefox, and WebKit.

- [ ] **Step 9: Commit**

```bash
git add src/renderer-core.ts src/sizing.ts test/browser/preview.spec.js
git commit -m "feat: add bounded iframe content sizing"
```

### Task 4: React Sizing Integration

**Files:**
- Modify: `src/react.tsx`
- Modify: `examples/react/app.jsx`
- Test: `test/react.test.js`
- Test: `test/browser/react.spec.js`

**Interfaces:**
- Consumes: `PreviewOptions.sizing` and `onFrameResize` from Tasks 1 and 3.
- Produces: React prop updates that re-render the current source when sizing policy changes.
- Produces: latest-callback behavior for `onFrameResize` without preview recreation.

- [ ] **Step 1: Write failing React unit tests**

Assert that changing callback identity does not recreate the preview, the latest `onFrameResize` receives events, and sizing participates in the serialized policy key.

- [ ] **Step 2: Write failing React browser tests**

Assert content mode sizes to short content, grows and shrinks after source interaction, changing content bounds re-renders and reclamps the current source, and unmount removes all sizing activity.

- [ ] **Step 3: Run focused tests and verify failure**

Run: `npm run build && node --test test/react.test.js && npx playwright test test/browser/react.spec.js`

Expected: FAIL because sizing is not delegated or keyed.

- [ ] **Step 4: Wire stable callback delegation and sizing updates**

Add `onFrameResize` to the stable delegate object, add `sizing` to the policy key and `updateOptions()` patch, and keep callback-only changes from triggering document re-render.

- [ ] **Step 5: Add a content-sizing toggle to the React example**

Demonstrate the public prop only; do not add an example-only sizing implementation.

- [ ] **Step 6: Run focused tests**

Run: `npm run build && node --test test/react.test.js && npx playwright test test/browser/react.spec.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/react.tsx examples/react/app.jsx test/react.test.js test/browser/react.spec.js
git commit -m "feat: support responsive sizing in React"
```

### Task 5: Dedicated Example And Cross-Instance Coverage

**Files:**
- Create: `examples/content-sizing/index.html`
- Create: `examples/content-sizing/main.js`
- Create: `test/browser/content-sizing.spec.js`
- Modify: `examples/README.md`

**Interfaces:**
- Consumes: the public browser API only.
- Produces: a runnable example with fill/content switching, configurable min/max, dynamic add/remove controls inside the sandbox, and applied-height output.

- [ ] **Step 1: Write the failing browser specification**

Cover initial short content, growth, shrink, maximum clamping, fill-mode restoration, two independent previews, stale-frame isolation, and callback output through the public bridge-backed behavior.

- [ ] **Step 2: Run the spec and verify failure**

Run: `npm run build && npx playwright test test/browser/content-sizing.spec.js`

Expected: FAIL because the example does not exist.

- [ ] **Step 3: Build the focused example**

Use `createPreview()` from `dist/index.browser.js`; keep controls in the host page and content mutations inside the sandbox. The example must expose no private library hooks.

- [ ] **Step 4: Run the new spec on all engines**

Run: `npm run build && npx playwright test test/browser/content-sizing.spec.js`

Expected: PASS on Chromium, Firefox, and WebKit.

- [ ] **Step 5: Commit**

```bash
git add examples/content-sizing examples/README.md test/browser/content-sizing.spec.js
git commit -m "docs: add content sizing example"
```

### Task 6: Playground Sizing Workbench

**Files:**
- Modify: `playground/index.html`
- Modify: `playground/main.js`
- Modify: `playground/styles.css`
- Modify: `test/browser/playground.spec.js`

**Interfaces:**
- Consumes: public `sizing` and `onFrameResize` APIs.
- Produces: fill/content segmented control, min/max numeric controls shown only for content mode, and an applied-size inspector entry.

- [ ] **Step 1: Write failing Playground tests**

Assert default fill mode, switching to content mode, bounds reaching `updateOptions()` plus a re-render, dynamic sample growth updating the inspector, invalid min/max being rejected in the host UI, and share URLs restoring sizing mode and bounds.

- [ ] **Step 2: Run the focused spec and verify failure**

Run: `npm run build && npx playwright test test/browser/playground.spec.js`

Expected: FAIL because the controls do not exist.

- [ ] **Step 3: Implement controls and URL state**

Use native form controls, preserve the current three-panel workbench, serialize only validated values, and render all inspector values through text nodes.

- [ ] **Step 4: Run the focused spec**

Run: `npm run build && npx playwright test test/browser/playground.spec.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add playground/index.html playground/main.js playground/styles.css test/browser/playground.spec.js
git commit -m "feat: inspect content sizing in playground"
```

### Task 7: Documentation And Security Synchronization

**Files:**
- Modify: `README.md`
- Modify: `docs/README.zh-CN.md`
- Modify: `docs/INTEGRATION.md`
- Modify: `docs/BROWSER_SUPPORT.md`
- Modify: `docs/SECURITY_MODEL.md`
- Modify: `THREAT_MODEL.md`
- Modify: `docs/PROJECT_STRUCTURE.md`
- Modify: `docs/MIGRATION.md`
- Modify: `docs/ROADMAP.md`
- Modify: `CHANGELOG.md`
- Create: `scripts/check-doc-links.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: the final public contract and verified behavior from Tasks 1-6.
- Produces: one consistent description of defaults, bounds, compatibility, limitations, and examples.
- Produces: `npm run check:docs`, included in the repository `check` gate.

- [ ] **Step 1: Document vanilla and React usage**

Add the exact API examples, default values, next-render semantics for `updateOptions`, and the dedicated example link in English and Chinese.

- [ ] **Step 2: Document security and compatibility boundaries**

State that size messages are untrusted, host expansion is bounded, content sizing does not weaken sandbox/CSP, author CSS can suppress scrolling, resource exhaustion remains out of scope, the bridge path preserves the browser baseline, and native sizing is deliberately deferred while experimental.

- [ ] **Step 3: Update migration, structure, roadmap, and changelog**

Describe `v0.4.0` as additive with fill mode unchanged. Move the roadmap item from planned to implemented only after all feature tests pass. Keep unrelated deferred items deferred.

- [ ] **Step 4: Verify docs and formatting**

Create `scripts/check-doc-links.mjs` to scan repository Markdown files, ignore generated/vendor directories and external URLs, and fail when a relative link target does not exist. Add `check:docs` to `package.json` and include it in `check`.

Run: `npm run format:check && npm run check:docs && git diff --check`

Expected: PASS with no broken local Markdown links under the repository link-check command already used for release closure.

- [ ] **Step 5: Commit**

```bash
git add README.md docs THREAT_MODEL.md CHANGELOG.md scripts/check-doc-links.mjs package.json
git commit -m "docs: document responsive content sizing"
```

### Task 8: v0.4.0 Release Candidate Gate

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `CHANGELOG.md`
- Modify: `docs/ROADMAP.md`

**Interfaces:**
- Consumes: all completed feature tasks.
- Produces: a locally verified `0.4.0` release candidate; publishing and tag creation remain a separate explicit operation.

- [ ] **Step 1: Triage dependency state without broadening feature scope**

Confirm the earlier `v0.3.2` maintenance release resolved the known audit findings. Review any newly opened Dependabot PRs and merge or update only changes required for security, CI compatibility, or the release gate; record unrelated major upgrades as follow-ups.

- [ ] **Step 2: Run the complete functional gate before versioning**

Run: `npm run check && npm run test:browser && npm run test:electron && npm run audit && npm run benchmark`

Expected: all Node tests, packed-package consumer tests, 3-engine Playwright tests, Electron smoke, audit, and benchmark complete successfully.

- [ ] **Step 3: Inspect the packed artifact**

Run: `npm run pack:dry`

Expected: only intended package files are present; examples, Playground, fixtures, tests, and `docs/superpowers/` remain excluded; Node, browser, and React declarations include the new public types.

- [ ] **Step 4: Bump and finalize release metadata**

Set package and lockfile version to `0.4.0`, move the final entries from `Unreleased` to `[0.4.0]` with the release date, and add the changelog comparison link without creating a tag.

- [ ] **Step 5: Re-run the complete release gate after versioning**

Run: `npm run check && npm run test:browser && npm run test:electron && npm run audit && npm run pack:dry`

Expected: PASS with package metadata reporting `0.4.0`.

- [ ] **Step 6: Commit the release candidate**

```bash
git add package.json package-lock.json CHANGELOG.md docs/ROADMAP.md
git commit -m "chore: prepare v0.4.0"
```

- [ ] **Step 7: Request final review before publish**

Review the complete `v0.3.1...HEAD` diff with special attention to bridge input validation, shrink behavior, cleanup, cross-instance isolation, generated declarations, and documentation claims. Do not tag or publish until that review and GitHub CI pass.
