# Electron integration example

Reference code showing the one defense a pure Web host cannot provide: intercepting
JavaScript-driven `window.location` navigation out of the sandboxed iframe.

## How it works

```
sandboxed iframe                 main process                     renderer
  window.location = "..."  ──►  did-start-navigation      ──►  preview.notifyNavigationAttempt(url)
                                will-frame-navigate               │
                                                                  ├─ re-mounts last trusted document
                                                                  └─ routes url through the allowlist
                                                                        └─ onOpenExternal → shell.openExternal
```

- [`main.cjs`](main.cjs) — observes iframe navigations and forwards the URL over IPC; opens approved external URLs with `shell.openExternal`.
- [`preload.cjs`](preload.cjs) — exposes the navigation signal and the open-external request to the renderer under `contextIsolation`.

> The main and preload scripts use the `.cjs` extension so they are CommonJS even though the repository's `package.json` sets `"type": "module"` (a plain `.js` here would be treated as ESM, where `require` is unavailable).
- [`renderer.html`](renderer.html) — calls `createPreview` and wires `notifyNavigationAttempt` / `onOpenExternal`.

## Running

This example needs Electron and the package build. `electron` is intentionally
**not** a dependency of this package, so install it explicitly first — do not rely
on `npx electron` to fetch it on the fly. The on-the-fly `npx` install often leaves
the ~100 MB Electron runtime binary unusable and the app exits immediately with no
window.

From the repository root:

```bash
npm install                     # root deps (dompurify, etc.)
npm run build                   # the example imports ../../dist
npm install --save-dev electron # install Electron properly (downloads its binary)
npx electron examples/electron/main.cjs
```

When you are done you can remove it again with `npm uninstall electron`.

## Why this matters

In a pure Web page, a sandboxed iframe can still assign `window.location` to navigate
itself away, and the host cannot reliably intercept it (`Location` is `[Unforgeable]`).
Electron's main process sees every frame navigation, so it can catch the attempt, tell
the renderer to restore the original document, and send the URL to the system browser
instead. See [`../../THREAT_MODEL.md`](../../THREAT_MODEL.md) for the Web-vs-host capability difference.
