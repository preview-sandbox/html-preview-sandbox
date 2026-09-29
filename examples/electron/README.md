# Electron integration example

Reference code showing the one defense a pure Web host cannot provide: intercepting
JavaScript-driven `window.location` navigation out of the sandboxed iframe.

## How it works

```
sandboxed iframe                 main process                     renderer
  window.location = "..."  ──►  will-frame-navigate       ──►  preview.notifyNavigationAttempt(url)
                                preventDefault()                  │
                                                                  ├─ re-mounts last trusted document
                                                                  └─ routes url through the allowlist
                                                                        └─ onOpenExternal → shell.openExternal
```

- [`main.cjs`](main.cjs) — observes iframe navigations and forwards the URL over IPC; opens approved external URLs with `shell.openExternal`.
- [`preload.cjs`](preload.cjs) — exposes the navigation signal and the open-external request to the renderer under `contextIsolation`.

> The main and preload scripts use the `.cjs` extension so they are CommonJS even though the repository's `package.json` sets `"type": "module"` (a plain `.js` here would be treated as ESM, where `require` is unavailable).
- [`renderer.html`](renderer.html) — calls `createPreview` and wires `notifyNavigationAttempt` / `onOpenExternal`.

## Running

This example needs Electron and the package build. Electron is a repository
development dependency, not a runtime dependency of the published package. Do not
rely on `npx` to fetch it on the fly; install the repository dependencies first.
The navigation-interception code requires Electron 25 or newer because it uses
the cancellable `will-frame-navigate` event.

From the repository root:

```bash
npm ci                          # root dependencies, including development Electron
npm run build                   # the example imports ../../dist
npx electron examples/electron/main.cjs
```

For an automated smoke test, run `npm run test:electron`. The test launches the
real Electron application, waits for the sandboxed preview, exercises the
main/preload/renderer IPC path, and verifies that untrusted navigation URLs are
rendered as text rather than host-page markup. It also verifies that one navigation
attempt is cancelled and forwarded exactly once.

## Why this matters

In a pure Web page, a sandboxed iframe can still assign `window.location` to navigate
itself away, and the host cannot reliably intercept it (`Location` is `[Unforgeable]`).
Electron's main process sees every frame navigation, so it can catch the attempt, tell
the renderer to restore the original document, and send the URL to the system browser
instead. See [`../../THREAT_MODEL.md`](../../THREAT_MODEL.md) for the Web-vs-host capability difference.
