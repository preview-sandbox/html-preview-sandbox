# Migrating to v0.3

This guide covers the behavior changes in `v0.3.0`. Use it when upgrading from
`v0.2.x`.

## Runtime Baseline

The Node/default entry follows jsdom's supported runtime range: Node 20.19+,
22.13+, or 24+. Browser-only consumers continue to use the browser export and do
not bundle jsdom.

## Input Limit

The default `maxBytes` limit is reduced from 100 MiB to 10 MiB for
`normalizeInput`, `createHtmlDocument`, and `createPreview().render()`.

If larger inputs are an intentional, profiled requirement, opt in explicitly:

```js
const preview = createPreview(container, {
  maxBytes: 25 * 1024 * 1024,
});
```

The direct `sanitizeHtml(rawHtml)` helper still accepts an already-decoded
string and does not enforce `maxBytes`. Direct callers must apply their own
pre-parse input limit.

## Size Metadata

Successful full-pipeline results now include the original input byte length:

```js
const result = await preview.render(input);
console.log(result.size);
```

`OVERSIZED` errors now expose structured numeric fields:

```js
try {
  await preview.render(input);
} catch (error) {
  if (error?.code === 'OVERSIZED') {
    console.log(error.actualBytes, error.maxBytes);
  }
}
```

Existing code that only checks `error.code` remains compatible.

## Concurrent Renders

Concurrent `render()` calls now use latest-call-wins semantics for the mounted
iframe. Every call still resolves with its own result, but an older slow render
cannot overwrite a newer preview.

## Empty Output

Empty or fully removed content remains a successful blank document. Check
`result.sanitizeReport.strippedAll` to show a host empty state. The legacy
`EMPTY_AFTER_SANITIZE` code remains in the type surface but is not emitted by
the current document pipeline.

## Upgrade Checklist

1. Run the application on a supported Node version.
2. Decide whether 10 MiB is appropriate for each trust boundary.
3. Handle `OVERSIZED` with the structured byte fields when presenting errors.
4. Use `RenderResult.size` instead of recomputing the original byte length.
5. Re-test any UI that intentionally starts overlapping render calls.
