// @ts-check
// The preload script (CommonJS, because the renderer is sandboxed). It gives
// the page a small API and no Node.js access.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('game', {
  config: () => ipcRenderer.invoke('game:config'),
  /** @param {string} anonymousId */
  setAnonymousId: anonymousId => ipcRenderer.invoke('game:anonymous-id', anonymousId),
  simulateCrash: () => ipcRenderer.invoke('game:simulate-crash'),
});
