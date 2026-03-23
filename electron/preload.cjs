"use strict";

// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electron", {
  selectLocalFile: (arg) => import_electron.ipcRenderer.invoke("select-local-file", arg),
  openPath: (path) => import_electron.ipcRenderer.invoke("open-path", path),
  openFile: (path) => import_electron.ipcRenderer.invoke("open-path", path),
  // Alias for openPath
  saveFile: (opts) => import_electron.ipcRenderer.invoke("save-file", opts),
  readFile: (path) => import_electron.ipcRenderer.invoke("read-file", path),
  showItemInFolder: (path) => import_electron.ipcRenderer.invoke("show-item-in-folder", path),
  // ═══ Word 模式 ═══
  openDocxDialog: () => import_electron.ipcRenderer.invoke("open-docx-dialog"),
  saveDocx: (opts) => import_electron.ipcRenderer.invoke("save-docx", opts),
  // ═══ 本地 Word 联动 ═══
  openInWord: () => import_electron.ipcRenderer.invoke("open-in-word"),
  createNewDocx: () => import_electron.ipcRenderer.invoke("create-new-docx"),
  selectDirectory: () => import_electron.ipcRenderer.invoke("select-directory"),
  listDirectory: (path) => import_electron.ipcRenderer.invoke("list-directory", path),
  watchDirectory: (path) => import_electron.ipcRenderer.invoke("watch-directory", path),
  unwatchDirectory: (path) => import_electron.ipcRenderer.invoke("unwatch-directory", path),
  capturePage: (rect) => import_electron.ipcRenderer.invoke("capture-page", rect),
  httpRequest: (payload) => import_electron.ipcRenderer.invoke("http-request", payload),
  onFileSystemEvent: (callback) => {
    const subscription = (_event, value) => callback(value);
    import_electron.ipcRenderer.on("fs-notification", subscription);
    return () => import_electron.ipcRenderer.removeListener("fs-notification", subscription);
  },
  openPopoutWindow: (viewId, title) => import_electron.ipcRenderer.invoke("open-popout-window", { viewId, title }),
  // ═══ 自动更新 API ═══
  checkForUpdates: () => import_electron.ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => import_electron.ipcRenderer.invoke("download-update"),
  installUpdate: () => import_electron.ipcRenderer.invoke("install-update"),
  getAppVersion: () => import_electron.ipcRenderer.invoke("get-app-version"),
  onUpdateStatus: (callback) => {
    const subscription = (_event, value) => callback(value);
    import_electron.ipcRenderer.on("update-status", subscription);
    return () => import_electron.ipcRenderer.removeListener("update-status", subscription);
  },
  // ═══ 授权系统 API ═══
  getLicenseState: () => import_electron.ipcRenderer.invoke("get-license-state"),
  activateLicense: (code) => import_electron.ipcRenderer.invoke("activate-license", code),
  resetTrial: () => import_electron.ipcRenderer.invoke("reset-trial"),
  // ═══ 系统工具 ═══
  openExternal: (url) => import_electron.ipcRenderer.invoke("open-external-url", url),
  // ═══ PDF 内搜索（批注定位） ═══
  findInPage: (text) => import_electron.ipcRenderer.invoke("find-in-page", text),
  stopFindInPage: () => import_electron.ipcRenderer.invoke("stop-find-in-page"),
  // ═══ PDF 文件下载 ═══
  downloadFile: (url, filename) => import_electron.ipcRenderer.invoke("download-pdf", { url, filename }),
  getPdfDownloadDir: () => import_electron.ipcRenderer.invoke("get-pdf-download-dir"),
  setPdfDownloadDir: (dir) => import_electron.ipcRenderer.invoke("set-pdf-download-dir", dir),
  selectPdfDownloadDir: () => import_electron.ipcRenderer.invoke("select-directory"),
  // ═══ wytsg.com 图书馆 WebView 登录 ═══
  openWytsgLogin: () => import_electron.ipcRenderer.invoke("open-wytsg-login"),
  getWytsgCookies: () => import_electron.ipcRenderer.invoke("get-wytsg-cookies"),
  wytsgDownloadPdf: (doi) => import_electron.ipcRenderer.invoke("wytsg-download-pdf", doi),
  // ═══ wytsg.com 自动登录（验证码 AI 识别） ═══
  saveWytsgCredentials: (payload) => import_electron.ipcRenderer.invoke("save-wytsg-credentials", payload),
  getWytsgCredentials: () => import_electron.ipcRenderer.invoke("get-wytsg-credentials"),
  wytsgGetCaptcha: () => import_electron.ipcRenderer.invoke("auto-wytsg-login-captcha"),
  wytsgAutoLoginSubmit: (payload) => import_electron.ipcRenderer.invoke("auto-wytsg-login-submit", payload)
});
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  getApiKey: () => Promise.resolve(process.env.API_KEY || "")
});
