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
  resetTrial: () => import_electron.ipcRenderer.invoke("reset-trial")
});
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  getApiKey: () => Promise.resolve(process.env.API_KEY || "")
});
