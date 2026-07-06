'use strict';

// Bridges main-process navigation signals and external-open requests to the
// renderer under contextIsolation. Uses .cjs so it is CommonJS regardless of the
// repository's "type": "module".
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('previewHost', {
  onNavigationAttempt: (handler) => {
    ipcRenderer.on('preview:navigation-attempt', (_event, url) => handler(url));
  },
  openExternal: (url) => {
    ipcRenderer.send('preview:open-external', url);
  },
});
