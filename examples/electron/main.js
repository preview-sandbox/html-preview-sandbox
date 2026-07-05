'use strict';

// Electron integration example (reference code — requires `electron` to run).
//
// This demonstrates the one defense a pure Web host cannot provide: intercepting
// JavaScript-driven `window.location` navigation out of the sandboxed iframe.
//
// The main process observes iframe navigations via `did-start-navigation` /
// `will-frame-navigate`, forwards the URL to the renderer over IPC, and the
// renderer calls `preview.notifyNavigationAttempt(url)`. The core library then
// re-mounts the last trusted document and routes the URL through the external-link
// allowlist (where the host opens it with `shell.openExternal`).

const path = require('node:path');
const { app, BrowserWindow, ipcMain, shell, webFrameMain } = require('electron');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const previewFrame = () => win.webContents.mainFrame.frames[0];

  // Only care about the preview iframe (a direct child of the main frame),
  // not nested sub-frames loading their own resources.
  const isPreviewFrame = (frame) => frame && frame.parent === win.webContents.mainFrame;

  const forward = (url, frame) => {
    if (!url || url === 'about:srcdoc' || url === 'about:blank' || url.startsWith('blob:')) return;
    if (!isPreviewFrame(frame)) return;
    win.webContents.send('preview:navigation-attempt', url);
  };

  win.webContents.on('did-start-navigation', (event, url, isInPlace, isMainFrame, processId, routingId) => {
    if (isMainFrame || isInPlace) return;
    let frame = null;
    try { frame = webFrameMain.fromId(processId, routingId); } catch (_) { /* ignore */ }
    forward(url, frame);
  });

  win.webContents.on('will-frame-navigate', (details) => {
    if (details.isMainFrame) return;
    forward(details.url, details.frame);
  });

  // The renderer asks the host to open an approved external URL.
  ipcMain.on('preview:open-external', (_event, url) => {
    if (/^(https?|mailto|tel):/i.test(url)) {
      shell.openExternal(url);
    }
  });

  win.loadFile(path.join(__dirname, 'renderer.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
