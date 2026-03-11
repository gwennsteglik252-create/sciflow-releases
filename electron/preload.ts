import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  selectLocalFile: (arg?: string | { contextKey?: string; multiple?: boolean }) =>
    ipcRenderer.invoke('select-local-file', arg),
  openPath: (path: string) => ipcRenderer.invoke('open-path', path),
  openFile: (path: string) => ipcRenderer.invoke('open-path', path), // Alias for openPath
  saveFile: (opts: { name: string; content: string; defaultPath?: string }) =>
    ipcRenderer.invoke('save-file', opts),
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
  showItemInFolder: (path: string) => ipcRenderer.invoke('show-item-in-folder', path),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  listDirectory: (path: string) => ipcRenderer.invoke('list-directory', path),
  watchDirectory: (path: string) => ipcRenderer.invoke('watch-directory', path),
  unwatchDirectory: (path: string) => ipcRenderer.invoke('unwatch-directory', path),
  capturePage: (rect?: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke('capture-page', rect),
  httpRequest: (payload: { url: string; method?: string; headers?: Record<string, string>; body?: string }) =>
    ipcRenderer.invoke('http-request', payload),
  onFileSystemEvent: (callback: (event: any) => void) => {
    const subscription = (_event: any, value: any) => callback(value);
    ipcRenderer.on('fs-notification', subscription);
    return () => ipcRenderer.removeListener('fs-notification', subscription);
  },
  openPopoutWindow: (viewId: string, title: string) =>
    ipcRenderer.invoke('open-popout-window', { viewId, title }),

  // ═══ 自动更新 API ═══
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  onUpdateStatus: (callback: (data: any) => void) => {
    const subscription = (_event: any, value: any) => callback(value);
    ipcRenderer.on('update-status', subscription);
    return () => ipcRenderer.removeListener('update-status', subscription);
  },

  // ═══ 授权系统 API ═══
  getLicenseState: () => ipcRenderer.invoke('get-license-state'),
  activateLicense: (code: string) => ipcRenderer.invoke('activate-license', code),
  resetTrial: () => ipcRenderer.invoke('reset-trial'),
});

contextBridge.exposeInMainWorld('electronAPI', {
  getApiKey: () => Promise.resolve(process.env.API_KEY || ''),
});
