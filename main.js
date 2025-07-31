// preload.js - Electron secure bridge
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    query: (sql, params) => ipcRenderer.invoke('db-query', sql, params),
    getAppInfo: () => ipcRenderer.invoke('get-app-info'),
    platform: process.platform
});

contextBridge.exposeInMainWorld('logger', {
    info: (...args) => console.log('[RENDERER]', ...args),
    error: (...args) => console.error('[RENDERER]', ...args),
    warn: (...args) => console.warn('[RENDERER]', ...args)
});