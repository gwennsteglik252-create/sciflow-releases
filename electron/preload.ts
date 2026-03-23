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
  // ═══ Word 模式 ═══
  openDocxDialog: () => ipcRenderer.invoke('open-docx-dialog'),
  saveDocx: (opts: { data: string; filePath?: string; defaultName?: string }) =>
    ipcRenderer.invoke('save-docx', opts),
  // ═══ 本地 Word 联动 ═══
  openInWord: () => ipcRenderer.invoke('open-in-word'),
  createNewDocx: () => ipcRenderer.invoke('create-new-docx'),
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

  // ═══ 系统工具 ═══
  openExternal: (url: string) => ipcRenderer.invoke('open-external-url', url),

  // ═══ PDF 内搜索（批注定位） ═══
  findInPage: (text: string) => ipcRenderer.invoke('find-in-page', text),
  stopFindInPage: () => ipcRenderer.invoke('stop-find-in-page'),

  // ═══ PDF 文件下载 ═══
  downloadFile: (url: string, filename: string) =>
    ipcRenderer.invoke('download-pdf', { url, filename }),
  getPdfDownloadDir: () => ipcRenderer.invoke('get-pdf-download-dir'),
  setPdfDownloadDir: (dir: string) => ipcRenderer.invoke('set-pdf-download-dir', dir),
  selectPdfDownloadDir: () => ipcRenderer.invoke('select-directory'),

  // ═══ wytsg.com 图书馆 WebView 登录 ═══
  openWytsgLogin: () => ipcRenderer.invoke('open-wytsg-login'),
  getWytsgCookies: () => ipcRenderer.invoke('get-wytsg-cookies'),
  wytsgDownloadPdf: (doi: string) => ipcRenderer.invoke('wytsg-download-pdf', doi),
  // ═══ wytsg.com 自动登录（验证码 AI 识别） ═══
  saveWytsgCredentials: (payload: { username: string; password: string }) =>
    ipcRenderer.invoke('save-wytsg-credentials', payload),
  getWytsgCredentials: () => ipcRenderer.invoke('get-wytsg-credentials'),
  wytsgGetCaptcha: () => ipcRenderer.invoke('auto-wytsg-login-captcha'),
  wytsgAutoLoginSubmit: (payload: { username: string; password: string; captcha: string }) =>
    ipcRenderer.invoke('auto-wytsg-login-submit', payload),
});

contextBridge.exposeInMainWorld('electronAPI', {
  getApiKey: () => Promise.resolve(process.env.API_KEY || ''),
});
