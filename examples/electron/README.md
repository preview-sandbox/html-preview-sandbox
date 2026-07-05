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

- [`main.js`](main.js) — observes iframe navigations and forwards the URL over IPC; opens approved external URLs with `shell.openExternal`.
- [`preload.js`](preload.js) — exposes the navigation signal and the open-external request to the renderer under `contextIsolation`.
- [`renderer.html`](renderer.html) — calls `createPreview` and wires `notifyNavigationAttempt` / `onOpenExternal`.

## Running

This example needs Electron and the package build. From the repository root:

```bash
npm install
npm run build
npx electron examples/electron/main.js
```

`electron` is not a dependency of this package; install it separately to run this example.

## Why this matters

In a pure Web page, a sandboxed iframe can still assign `window.location` to navigate
itself away, and the host cannot reliably intercept it (`Location` is `[Unforgeable]`).
Electron's main process sees every frame navigation, so it can catch the attempt, tell
the renderer to restore the original document, and send the URL to the system browser
instead. See [`../../THREAT_MODEL.md`](../../THREAT_MODEL.md) for the Web-vs-host capability difference.
