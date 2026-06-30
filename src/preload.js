// src/preload.js
// Secure IPC bridge between main and renderer (contextBridge)

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File dialogs
  openAPKDialog:  ()                      => ipcRenderer.invoke('dialog:openAPK'),
  saveFile:       (opts)                  => ipcRenderer.invoke('dialog:saveFile', opts),
  showInFinder:   (filePath)              => ipcRenderer.invoke('shell:showFile', filePath),
  openExternal:   (url)                   => ipcRenderer.invoke('shell:openExternal', url),

  // Analysis
  analyzeAPK:     (filePath, options)     => ipcRenderer.invoke('apk:analyze', { filePath, options }),
  
  // API Tester Request Proxy
  testRequest:    (reqOpts)               => ipcRenderer.invoke('api:testRequest', reqOpts),
  
  // DevTools toggle
  toggleDevTools: ()                      => ipcRenderer.invoke('dev:toggleTools'),

  // Progress listener
  onProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('analysis:progress', handler);
    return () => ipcRenderer.removeListener('analysis:progress', handler);
  },

  // Platform info
  platform: process.platform,
});
