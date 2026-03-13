"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_electron4 = require("electron");
var import_path3 = __toESM(require("path"), 1);
var import_fs3 = __toESM(require("fs"), 1);
var import_http = __toESM(require("http"), 1);
var import_os = __toESM(require("os"), 1);
var import_crypto2 = __toESM(require("crypto"), 1);
var import_url = require("url");
var import_node_process = __toESM(require("node:process"), 1);

// electron/license.ts
var import_electron = require("electron");
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var LICENSE_SECRET = "SciFlowPro2026-LXJ-SecretKey-HMAC";
var TRIAL_DAYS = 14;
function getLicenseFilePath() {
  const userDataPath = import_electron.app.getPath("userData");
  return import_path.default.join(userDataPath, "license.json");
}
function getMachineId() {
  const raw = `${process.platform}-${require("os").hostname()}-${require("os").userInfo().username}-SciFlowPro`;
  return import_crypto.default.createHash("sha256").update(raw).digest("hex").substring(0, 16);
}
function readLicenseData() {
  const filePath = getLicenseFilePath();
  try {
    if (import_fs.default.existsSync(filePath)) {
      return JSON.parse(import_fs.default.readFileSync(filePath, "utf-8"));
    }
  } catch {
  }
  return null;
}
function writeLicenseData(data) {
  const filePath = getLicenseFilePath();
  import_fs.default.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}
function verifyActivationCode(code) {
  const cleaned = code.trim().toUpperCase();
  if (!/^SCIFLOW-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleaned)) {
    return false;
  }
  const parts = cleaned.replace("SCIFLOW-", "").split("-");
  const dataPart = parts.slice(0, 3).join("");
  const checkPart = parts[3];
  const hmac = import_crypto.default.createHmac("sha256", LICENSE_SECRET).update(dataPart).digest("hex").toUpperCase();
  const expectedCheck = hmac.substring(0, 4);
  return checkPart === expectedCheck;
}
function getLicenseState() {
  const machineId = getMachineId();
  const data = readLicenseData();
  if (data?.status === "activated" && data?.activationCode) {
    return {
      status: "activated",
      activationCode: data.activationCode,
      activatedAt: data.activatedAt,
      machineId
    };
  }
  let trialStartDate = data?.trialStartDate;
  if (!trialStartDate) {
    trialStartDate = (/* @__PURE__ */ new Date()).toISOString();
    writeLicenseData({ status: "trial", trialStartDate, machineId });
  }
  const startDate = new Date(trialStartDate);
  const now = /* @__PURE__ */ new Date();
  const diffMs = now.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / (1e3 * 60 * 60 * 24));
  const remaining = Math.max(0, TRIAL_DAYS - diffDays);
  if (remaining <= 0) {
    return { status: "expired", trialStartDate, trialDaysRemaining: 0, machineId };
  }
  return { status: "trial", trialStartDate, trialDaysRemaining: remaining, machineId };
}

// electron/updater.ts
var import_electron2 = require("electron");
var GITHUB_REPO = "gwennsteglik252-create/sciflow-releases";
var RELEASE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;
var sendUpdateStatus = (data) => {
  const wins = import_electron2.BrowserWindow.getAllWindows();
  wins.forEach((w) => w.webContents.send("update-status", data));
};
function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}
async function checkForUpdateViaGitHub() {
  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { "Accept": "application/vnd.github.v3+json" }
    });
    if (!response.ok) throw new Error(`GitHub API \u8FD4\u56DE ${response.status}`);
    const release = await response.json();
    const latestVersion = release.tag_name?.replace(/^v/, "") || "";
    const currentVersion = import_electron2.app.getVersion();
    const isNewer = compareVersions(latestVersion, currentVersion) > 0;
    return {
      hasUpdate: isNewer,
      version: latestVersion,
      releaseDate: release.published_at,
      releaseNotes: release.body || ""
    };
  } catch (err) {
    console.error("[Update] GitHub API \u68C0\u67E5\u5931\u8D25:", err.message);
    throw err;
  }
}
function registerUpdaterIpc() {
  import_electron2.ipcMain.handle("check-for-updates", async () => {
    try {
      sendUpdateStatus({ status: "checking" });
      const result = await checkForUpdateViaGitHub();
      if (result.hasUpdate) {
        sendUpdateStatus({
          status: "available",
          version: result.version,
          releaseDate: result.releaseDate,
          releaseNotes: result.releaseNotes
        });
        return { success: true, version: result.version };
      } else {
        sendUpdateStatus({
          status: "not-available",
          version: result.version
        });
        return { success: true, version: result.version, upToDate: true };
      }
    } catch (err) {
      sendUpdateStatus({
        status: "error",
        message: err?.message || "\u68C0\u67E5\u66F4\u65B0\u5931\u8D25"
      });
      return { success: false, message: err?.message || "\u68C0\u67E5\u66F4\u65B0\u5931\u8D25" };
    }
  });
  import_electron2.ipcMain.handle("download-update", async () => {
    try {
      import_electron2.shell.openExternal(RELEASE_URL);
      return { success: true };
    } catch (err) {
      return { success: false, message: err?.message || "\u6253\u5F00\u4E0B\u8F7D\u9875\u9762\u5931\u8D25" };
    }
  });
  import_electron2.ipcMain.handle("install-update", () => {
    import_electron2.shell.openExternal(RELEASE_URL);
  });
  import_electron2.ipcMain.handle("get-app-version", () => {
    return import_electron2.app.getVersion();
  });
}
function initAutoUpdateCheck() {
  const isDev = process.env.NODE_ENV === "development" || !import_electron2.app.isPackaged;
  if (!isDev) {
    setTimeout(() => {
      checkForUpdateViaGitHub().then((result) => {
        if (result.hasUpdate) {
          sendUpdateStatus({
            status: "available",
            version: result.version,
            releaseDate: result.releaseDate,
            releaseNotes: result.releaseNotes
          });
        }
      }).catch(() => {
      });
    }, 5e3);
  }
}

// electron/ipcHandlers.ts
var import_electron3 = require("electron");
var import_path2 = __toESM(require("path"), 1);
var import_fs2 = __toESM(require("fs"), 1);
function registerPopoutWindow(_dirname2) {
  import_electron3.ipcMain.handle("open-popout-window", async (_event, payload) => {
    const { viewId, title } = payload;
    const popout = new import_electron3.BrowserWindow({
      width: 1e3,
      height: 700,
      title: title || "SciFlow Pro",
      titleBarStyle: "hiddenInset",
      webPreferences: {
        preload: import_path2.default.join(_dirname2, "preload.cjs"),
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false
      }
    });
    const isDev = process.env.NODE_ENV === "development" || !require("electron").app.isPackaged;
    if (isDev) {
      popout.loadURL(`http://localhost:5173?popout=${encodeURIComponent(viewId)}`);
    } else {
      popout.loadFile(import_path2.default.join(_dirname2, "../dist/index.html"), {
        query: { popout: viewId }
      });
    }
    return { success: true };
  });
}
function registerIpcHandlers(_dirname2) {
  import_electron3.ipcMain.handle("get-license-state", () => {
    return getLicenseState();
  });
  import_electron3.ipcMain.handle("activate-license", async (_event, code) => {
    if (!verifyActivationCode(code)) {
      return { success: false, error: "\u6FC0\u6D3B\u7801\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u540E\u91CD\u8BD5" };
    }
    const machineId = getMachineId();
    writeLicenseData({
      status: "activated",
      activationCode: code.trim().toUpperCase(),
      activatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      machineId
    });
    return { success: true };
  });
  import_electron3.ipcMain.handle("reset-trial", () => {
    const isDev = process.env.NODE_ENV === "development" || !require("electron").app.isPackaged;
    if (!isDev) return { success: false, error: "\u4EC5\u5F00\u53D1\u73AF\u5883\u53EF\u7528" };
    writeLicenseData({
      status: "trial",
      trialStartDate: (/* @__PURE__ */ new Date()).toISOString(),
      machineId: getMachineId()
    });
    return { success: true };
  });
  import_electron3.ipcMain.handle("capture-page", async (_event, rect) => {
    const win = import_electron3.BrowserWindow.getFocusedWindow();
    if (!win) return null;
    try {
      let image;
      if (rect) {
        image = await win.webContents.capturePage(rect);
      } else {
        image = await win.webContents.capturePage();
      }
      return image.toPNG().toString("base64");
    } catch (err) {
      console.error("capturePage failed:", err);
      return null;
    }
  });
  const lastUsedPaths = {};
  import_electron3.ipcMain.handle("select-local-file", async (_event, arg) => {
    const contextKey = typeof arg === "string" ? arg : arg?.contextKey;
    const multiple = typeof arg === "object" ? !!arg?.multiple : false;
    const win = import_electron3.BrowserWindow.getFocusedWindow();
    const defaultPath = contextKey && lastUsedPaths[contextKey] ? lastUsedPaths[contextKey] : void 0;
    const result = await import_electron3.dialog.showOpenDialog(win, {
      properties: multiple ? ["openFile", "multiSelections"] : ["openFile"],
      defaultPath,
      filters: [
        { name: "All Supported Files", extensions: ["jpg", "jpeg", "png", "gif", "webp", "svg", "pdf", "docx", "doc", "txt", "csv", "xy", "md", "json", "xlsx", "xls", "h5", "ipynb", "mp4", "mov", "avi", "mp3", "wav", "py", "r", "js", "ts", "cpp", "h", "pptx", "ppt", "rtf"] },
        { name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp", "svg"] },
        { name: "Scientific Documents", extensions: ["pdf", "docx", "doc", "txt", "csv", "xy", "md", "json"] },
        { name: "Research Data", extensions: ["csv", "xlsx", "xls", "json", "h5", "ipynb"] },
        { name: "Media", extensions: ["mp4", "mov", "avi", "mp3", "wav"] },
        { name: "Source Code", extensions: ["py", "r", "js", "ts", "cpp", "h"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    if (contextKey) {
      lastUsedPaths[contextKey] = import_path2.default.dirname(filePath);
    }
    if (multiple) {
      return result.filePaths.map((p) => ({
        name: import_path2.default.basename(p),
        path: p
      }));
    }
    return { name: import_path2.default.basename(filePath), path: filePath };
  });
  import_electron3.ipcMain.handle("select-directory", async () => {
    const win = import_electron3.BrowserWindow.getFocusedWindow();
    const result = await import_electron3.dialog.showOpenDialog(win, {
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
  import_electron3.ipcMain.handle("open-path", async (_event, targetPath) => {
    if (import_fs2.default.existsSync(targetPath)) {
      return await import_electron3.shell.openPath(targetPath);
    }
    return "File not found";
  });
  import_electron3.ipcMain.handle("save-file", async (_event, opts) => {
    const result = await import_electron3.dialog.showSaveDialog({
      defaultPath: opts.defaultPath ? import_path2.default.join(opts.defaultPath, opts.name) : opts.name,
      filters: [{ name: "All Files", extensions: ["*"] }]
    });
    if (result.canceled || !result.filePath) return { success: false };
    try {
      import_fs2.default.writeFileSync(result.filePath, opts.content);
      return { success: true, filePath: result.filePath };
    } catch (err) {
      console.error("Failed to save file:", err);
      return { success: false };
    }
  });
  import_electron3.ipcMain.handle("read-file", async (_event, targetPath) => {
    if (!import_fs2.default.existsSync(targetPath)) return null;
    try {
      const ext = import_path2.default.extname(targetPath).toLowerCase();
      if (ext === ".pdf") {
        const data = await import_fs2.default.promises.readFile(targetPath, { encoding: "base64" });
        return { mimeType: "application/pdf", data };
      } else if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
        const data = await import_fs2.default.promises.readFile(targetPath, { encoding: "base64" });
        return { mimeType: `image/${ext.replace(".", "")}`, data };
      } else {
        const data = await import_fs2.default.promises.readFile(targetPath, "utf-8");
        return { mimeType: "text/plain", data };
      }
    } catch (e) {
      console.error("Read file error:", e);
      return null;
    }
  });
  import_electron3.ipcMain.handle("show-item-in-folder", async (_event, targetPath) => {
    if (import_fs2.default.existsSync(targetPath)) {
      import_electron3.shell.showItemInFolder(targetPath);
    }
  });
  const watchers = /* @__PURE__ */ new Map();
  import_electron3.ipcMain.handle("watch-directory", async (event, targetPath) => {
    if (!import_fs2.default.existsSync(targetPath)) return { success: false, error: "Directory not found" };
    const stats = import_fs2.default.statSync(targetPath);
    if (!stats.isDirectory()) return { success: false, error: "Path is not a directory" };
    if (watchers.has(targetPath)) return { success: true, message: "Already watching" };
    try {
      const watcher = import_fs2.default.watch(targetPath, (eventType, filename) => {
        if (filename && eventType === "rename") {
          const fullPath = import_path2.default.join(targetPath, filename);
          if (import_fs2.default.existsSync(fullPath)) {
            event.sender.send("fs-notification", {
              type: "added",
              path: fullPath,
              name: filename,
              ext: import_path2.default.extname(filename),
              parentDir: targetPath
            });
          }
        }
      });
      watchers.set(targetPath, watcher);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  import_electron3.ipcMain.handle("list-directory", async (_event, targetPath) => {
    if (!import_fs2.default.existsSync(targetPath)) return [];
    try {
      const files = import_fs2.default.readdirSync(targetPath);
      return files.map((file) => {
        const fullPath = import_path2.default.join(targetPath, file);
        const stats = import_fs2.default.statSync(fullPath);
        return {
          name: file,
          path: fullPath,
          isDirectory: stats.isDirectory(),
          ext: import_path2.default.extname(file),
          size: stats.size,
          lastModified: stats.mtime
        };
      });
    } catch (err) {
      console.error("List directory error:", err);
      return [];
    }
  });
  import_electron3.ipcMain.handle("unwatch-directory", async (_event, targetPath) => {
    const watcher = watchers.get(targetPath);
    if (watcher) {
      watcher.close();
      watchers.delete(targetPath);
      return { success: true };
    }
    return { success: false, error: "Not watching this path" };
  });
  import_electron3.ipcMain.handle("http-request", async (_event, payload) => {
    try {
      if (!payload?.url || !/^https?:\/\//i.test(payload.url)) {
        return { ok: false, status: 400, statusText: "Bad Request", headers: {}, body: "Invalid URL" };
      }
      const response = await fetch(payload.url, {
        method: payload.method || "GET",
        headers: payload.headers || {},
        body: payload.body
      });
      const headerObj = {};
      response.headers.forEach((value, key) => {
        headerObj[key] = value;
      });
      const text = await response.text();
      return { ok: response.ok, status: response.status, statusText: response.statusText, headers: headerObj, body: text };
    } catch (error) {
      return { ok: false, status: 0, statusText: "Network Error", headers: {}, body: error?.message || "Unknown error" };
    }
  });
  import_electron3.ipcMain.handle("open-external-url", async (_event, url) => {
    if (url && (url.startsWith("http:") || url.startsWith("https:"))) {
      await import_electron3.shell.openExternal(url);
      return { success: true };
    }
    return { success: false, error: "Invalid URL" };
  });
  registerPopoutWindow(_dirname2);
}

// electron/main.ts
var import_meta = {};
var _filename = typeof __filename !== "undefined" ? __filename : (0, import_url.fileURLToPath)(import_meta.url);
var _dirname = typeof __dirname !== "undefined" ? __dirname : import_path3.default.dirname(_filename);
import_electron4.app.commandLine.appendSwitch("disable-renderer-backgrounding");
import_electron4.app.commandLine.appendSwitch("disable-background-timer-throttling");
function createWindow() {
  const win = new import_electron4.BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: import_path3.default.join(_dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  });
  const isDev = import_node_process.default.env.NODE_ENV === "development" || !import_electron4.app.isPackaged;
  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(import_path3.default.join(_dirname, "../dist/index.html"));
  }
}
import_electron4.app.whenReady().then(() => {
  import_electron4.powerSaveBlocker.start("prevent-app-suspension");
  const { session } = require("electron");
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ["https://*/*"] },
    (details, callback) => {
      delete details.requestHeaders["Origin"];
      callback({ requestHeaders: details.requestHeaders });
    }
  );
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["https://*/*"] },
    (details, callback) => {
      const headers = details.responseHeaders || {};
      headers["access-control-allow-origin"] = ["*"];
      headers["access-control-allow-methods"] = ["GET, POST, PUT, DELETE, OPTIONS"];
      headers["access-control-allow-headers"] = ["*"];
      callback({ responseHeaders: headers });
    }
  );
  createWindow();
  registerIpcHandlers(_dirname);
  registerUpdaterIpc();
  initAutoUpdateCheck();
  const API_PORT = 17930;
  const queryRenderer = async (channel, ...args) => {
    const wins = import_electron4.BrowserWindow.getAllWindows();
    if (wins.length === 0) return null;
    try {
      return await wins[0].webContents.executeJavaScript(
        `window.__sciflowAPI__?.${channel}?.(${args.map((a) => JSON.stringify(a)).join(",")})`
      );
    } catch (e) {
      console.error(`[API Server] queryRenderer(${channel}) failed:`, e);
      return null;
    }
  };
  const readBody = (req) => new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
  const setHeaders = (res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-Powered-By", "SciFlow Pro API Server");
  };
  const jsonRes = (res, status, data) => {
    res.writeHead(status);
    res.end(JSON.stringify(data, null, 2));
  };
  const verifyToken = (req) => {
    const tokenFilePath = import_path3.default.join(import_electron4.app.getPath("userData"), "api_token.txt");
    let storedToken = "";
    try {
      if (import_fs3.default.existsSync(tokenFilePath)) {
        storedToken = import_fs3.default.readFileSync(tokenFilePath, "utf-8").trim();
      }
    } catch {
    }
    if (!storedToken) return true;
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    return token === storedToken;
  };
  const generateApiToken = () => {
    const token = import_crypto2.default.randomBytes(32).toString("hex");
    const tokenFilePath = import_path3.default.join(import_electron4.app.getPath("userData"), "api_token.txt");
    import_fs3.default.writeFileSync(tokenFilePath, token, "utf-8");
    return token;
  };
  const watchers = /* @__PURE__ */ new Map();
  const routeHandlers = {
    // ── 系统 ──
    "GET /api/v1/status": {
      handler: async (_req, res) => {
        const licState = getLicenseState();
        jsonRes(res, 200, {
          ok: true,
          app: "SciFlow Pro",
          version: import_electron4.app.getVersion(),
          platform: import_node_process.default.platform,
          arch: import_node_process.default.arch,
          hostname: import_os.default.hostname(),
          uptime: import_node_process.default.uptime(),
          license: licState.status,
          pid: import_node_process.default.pid
        });
      }
    },
    "GET /api/v1/openapi": {
      handler: async (_req, res) => {
        jsonRes(res, 200, {
          openapi: "3.0.3",
          info: { title: "SciFlow Pro Local API", version: import_electron4.app.getVersion(), description: "RESTful API for external AI agents" },
          servers: [{ url: `http://127.0.0.1:${API_PORT}`, description: "Local SciFlow Pro Instance" }],
          paths: {
            "/api/v1/status": { get: { summary: "\u83B7\u53D6\u7CFB\u7EDF\u72B6\u6001", tags: ["System"] } },
            "/api/v1/settings": { get: { summary: "\u8BFB\u53D6\u6240\u6709\u8BBE\u7F6E" }, put: { summary: "\u66F4\u65B0\u8BBE\u7F6E" } },
            "/api/v1/settings/{key}": { get: { summary: "\u8BFB\u53D6\u7279\u5B9A\u8BBE\u7F6E\u9879" } },
            "/api/v1/token": { post: { summary: "\u751F\u6210\u65B0\u7684 API Token" } },
            "/api/v1/projects": { get: { summary: "\u83B7\u53D6\u9879\u76EE\u5217\u8868", tags: ["Data"] } },
            "/api/v1/resources": { get: { summary: "\u83B7\u53D6\u60C5\u62A5\u6863\u6848", tags: ["Data"] } },
            "/api/v1/ai/chat": { post: { summary: "\u8C03\u7528 AI \u5BF9\u8BDD", tags: ["AI"] } },
            "/api/v1/ai/metrics": { get: { summary: "\u83B7\u53D6 AI \u4F7F\u7528\u6307\u6807", tags: ["AI"] } },
            "/api/v1/files/read": { post: { summary: "\u8BFB\u53D6\u6587\u4EF6\u5185\u5BB9", tags: ["Files"] } },
            "/api/v1/files/write": { post: { summary: "\u5199\u5165\u6587\u4EF6", tags: ["Files"] } },
            "/api/v1/files/list": { post: { summary: "\u5217\u51FA\u76EE\u5F55\u5185\u5BB9", tags: ["Files"] } },
            "/api/v1/workflow/rules": { get: { summary: "\u83B7\u53D6\u5DE5\u4F5C\u6D41\u89C4\u5219" }, post: { summary: "\u521B\u5EFA\u5DE5\u4F5C\u6D41\u89C4\u5219" } },
            "/api/v1/broadcast": { post: { summary: "\u5411\u6E32\u67D3\u8FDB\u7A0B\u5E7F\u64AD\u81EA\u5B9A\u4E49\u4E8B\u4EF6" } }
          }
        });
      }
    },
    "POST /api/v1/token": {
      handler: async (_req, res) => {
        const token = generateApiToken();
        jsonRes(res, 200, {
          ok: true,
          token,
          message: "New API token generated.",
          usage: `curl -H "Authorization: Bearer ${token}" http://127.0.0.1:${API_PORT}/api/v1/status`
        });
      }
    },
    // ── 设置 ──
    "GET /api/v1/settings": {
      handler: async (_req, res) => {
        const settings = await queryRenderer("getSettings");
        jsonRes(res, 200, { ok: true, settings: settings || {} });
      }
    },
    "PUT /api/v1/settings": {
      handler: async (req, res) => {
        const body = await readBody(req);
        let updates;
        try {
          updates = JSON.parse(body);
        } catch {
          return jsonRes(res, 400, { ok: false, error: "Invalid JSON body" });
        }
        await queryRenderer("updateSettings", updates);
        jsonRes(res, 200, { ok: true, message: "Settings updated" });
      }
    },
    // ── 项目/文献 ──
    "GET /api/v1/projects": {
      handler: async (_req, res) => {
        const projects = await queryRenderer("getProjects");
        jsonRes(res, 200, { ok: true, projects: projects || [] });
      }
    },
    "GET /api/v1/resources": {
      handler: async (_req, res) => {
        const resources = await queryRenderer("getResources");
        jsonRes(res, 200, { ok: true, resources: resources || [] });
      }
    },
    // ── AI 代理 ──
    "POST /api/v1/ai/chat": {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          return jsonRes(res, 400, { ok: false, error: "Invalid JSON body" });
        }
        if (!payload.prompt) return jsonRes(res, 400, { ok: false, error: 'Missing "prompt" field' });
        const result = await queryRenderer("aiChat", payload.prompt, payload.model || "");
        if (result === null) return jsonRes(res, 503, { ok: false, error: "Renderer not ready" });
        jsonRes(res, 200, { ok: true, response: result });
      }
    },
    "GET /api/v1/ai/metrics": {
      handler: async (_req, res) => {
        const metrics = await queryRenderer("getAiMetrics");
        jsonRes(res, 200, { ok: true, metrics: metrics || {} });
      }
    },
    // ── 文件操作 ──
    "POST /api/v1/files/read": {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          return jsonRes(res, 400, { ok: false, error: "Invalid JSON body" });
        }
        if (!payload.path) return jsonRes(res, 400, { ok: false, error: 'Missing "path" field' });
        if (!import_fs3.default.existsSync(payload.path)) return jsonRes(res, 404, { ok: false, error: "File not found" });
        try {
          const ext = import_path3.default.extname(payload.path).toLowerCase();
          const isBinary = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf"].includes(ext);
          if (isBinary) {
            const data = await import_fs3.default.promises.readFile(payload.path, { encoding: "base64" });
            jsonRes(res, 200, { ok: true, data, encoding: "base64", mimeType: ext === ".pdf" ? "application/pdf" : `image/${ext.replace(".", "")}` });
          } else {
            const data = await import_fs3.default.promises.readFile(payload.path, "utf-8");
            jsonRes(res, 200, { ok: true, data, encoding: "utf-8", mimeType: "text/plain" });
          }
        } catch (e) {
          jsonRes(res, 500, { ok: false, error: e.message });
        }
      }
    },
    "POST /api/v1/files/write": {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          return jsonRes(res, 400, { ok: false, error: "Invalid JSON body" });
        }
        if (!payload.path || payload.content === void 0) return jsonRes(res, 400, { ok: false, error: 'Missing "path" or "content"' });
        try {
          const dir = import_path3.default.dirname(payload.path);
          if (!import_fs3.default.existsSync(dir)) import_fs3.default.mkdirSync(dir, { recursive: true });
          const encoding = payload.encoding === "base64" ? "base64" : "utf-8";
          import_fs3.default.writeFileSync(payload.path, payload.content, { encoding });
          jsonRes(res, 200, { ok: true, message: "File written", path: payload.path });
        } catch (e) {
          jsonRes(res, 500, { ok: false, error: e.message });
        }
      }
    },
    "POST /api/v1/files/list": {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          return jsonRes(res, 400, { ok: false, error: "Invalid JSON body" });
        }
        if (!payload.path) return jsonRes(res, 400, { ok: false, error: 'Missing "path"' });
        if (!import_fs3.default.existsSync(payload.path)) return jsonRes(res, 404, { ok: false, error: "Directory not found" });
        try {
          const files = import_fs3.default.readdirSync(payload.path);
          const items = files.map((file) => {
            const fullPath = import_path3.default.join(payload.path, file);
            const stats = import_fs3.default.statSync(fullPath);
            return { name: file, path: fullPath, isDirectory: stats.isDirectory(), ext: import_path3.default.extname(file), size: stats.size, lastModified: stats.mtime.toISOString() };
          });
          jsonRes(res, 200, { ok: true, items });
        } catch (e) {
          jsonRes(res, 500, { ok: false, error: e.message });
        }
      }
    },
    // ── 工作流 ──
    "GET /api/v1/workflow/rules": {
      handler: async (_req, res) => {
        const rules = await queryRenderer("getWorkflowRules");
        jsonRes(res, 200, { ok: true, rules: rules || [] });
      }
    },
    "POST /api/v1/workflow/rules": {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          return jsonRes(res, 400, { ok: false, error: "Invalid JSON body" });
        }
        const result = await queryRenderer("addWorkflowRule", payload);
        jsonRes(res, 201, { ok: true, rule: result });
      }
    },
    "POST /api/v1/broadcast": {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          return jsonRes(res, 400, { ok: false, error: "Invalid JSON body" });
        }
        if (!payload.event) return jsonRes(res, 400, { ok: false, error: 'Missing "event"' });
        await queryRenderer("broadcastEvent", payload.event, payload.detail || {});
        jsonRes(res, 200, { ok: true, message: `Event "${payload.event}" broadcasted` });
      }
    },
    // ── Pipeline ──
    "POST /api/v1/pipeline/setup": {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          return jsonRes(res, 400, { ok: false, error: "Invalid JSON body" });
        }
        if (!payload.basePath) return jsonRes(res, 400, { ok: false, error: 'Missing "basePath"' });
        if (!import_fs3.default.existsSync(payload.basePath)) {
          try {
            import_fs3.default.mkdirSync(payload.basePath, { recursive: true });
          } catch (e) {
            return jsonRes(res, 500, { ok: false, error: `Cannot create directory: ${e.message}` });
          }
        }
        const watchResult = await new Promise((resolve) => {
          const stats = import_fs3.default.statSync(payload.basePath);
          if (!stats.isDirectory()) {
            resolve({ success: false, error: "Not a directory" });
            return;
          }
          if (watchers.has(payload.basePath)) {
            resolve({ success: true, message: "Already watching" });
            return;
          }
          const watcher = import_fs3.default.watch(payload.basePath, (eventType, filename) => {
            if (filename && eventType === "rename") {
              const fullPath = import_path3.default.join(payload.basePath, filename);
              if (import_fs3.default.existsSync(fullPath)) {
                import_electron4.BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("fs-notification", {
                  type: "added",
                  path: fullPath,
                  name: filename,
                  ext: import_path3.default.extname(filename),
                  parentDir: payload.basePath
                }));
              }
            }
          });
          watchers.set(payload.basePath, watcher);
          resolve({ success: true });
        });
        const rules = await queryRenderer("setupPipeline", payload.basePath, payload.types || null);
        jsonRes(res, 201, {
          ok: true,
          message: "Pipeline configured",
          basePath: payload.basePath,
          watching: watchResult.success,
          rulesCreated: rules?.length || 0,
          rules: rules || []
        });
      }
    },
    "POST /api/v1/pipeline/ingest": {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          return jsonRes(res, 400, { ok: false, error: "Invalid JSON body" });
        }
        if (!payload.files || !Array.isArray(payload.files)) return jsonRes(res, 400, { ok: false, error: 'Missing "files" array' });
        await queryRenderer("broadcastEvent", "sciflow-pipeline-ingest", { files: payload.files });
        jsonRes(res, 200, { ok: true, message: `${payload.files.length} files submitted` });
      }
    },
    "POST /api/v1/workflow/trigger": {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          return jsonRes(res, 400, { ok: false, error: "Invalid JSON body" });
        }
        if (!payload.ruleId) return jsonRes(res, 400, { ok: false, error: 'Missing "ruleId"' });
        const result = await queryRenderer("triggerWorkflow", payload.ruleId, payload.fileContext || null);
        if (!result) return jsonRes(res, 404, { ok: false, error: `Rule not found: ${payload.ruleId}` });
        jsonRes(res, 200, { ok: true, log: result });
      }
    },
    "GET /api/v1/workflow/logs": {
      handler: async (_req, res) => {
        const logs = await queryRenderer("getWorkflowLogs");
        jsonRes(res, 200, { ok: true, logs: logs || [], count: logs?.length || 0 });
      }
    },
    "DELETE /api/v1/workflow/rules": {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          return jsonRes(res, 400, { ok: false, error: "Invalid JSON body" });
        }
        if (!payload.ruleId) return jsonRes(res, 400, { ok: false, error: 'Missing "ruleId"' });
        const result = await queryRenderer("deleteWorkflowRule", payload.ruleId);
        jsonRes(res, 200, { ok: true, deleted: result });
      }
    },
    "POST /api/v1/resources": {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          return jsonRes(res, 400, { ok: false, error: "Invalid JSON body" });
        }
        if (!payload.title) return jsonRes(res, 400, { ok: false, error: 'Missing "title"' });
        const resource = { ...payload, id: payload.id || `res_api_${Date.now()}`, importedAt: (/* @__PURE__ */ new Date()).toISOString(), importedBy: "api" };
        const result = await queryRenderer("addResource", resource);
        jsonRes(res, 201, { ok: true, resource: result });
      }
    },
    // ── 事件系统 ──
    "GET /api/v1/events": {
      handler: async (req, res, urlObj) => {
        if (!urlObj) return jsonRes(res, 500, { ok: false, error: "URL object required" });
        const since = urlObj.searchParams.get("since") || void 0;
        const limit = parseInt(urlObj.searchParams.get("limit") || "50");
        const events = await queryRenderer("getEvents", since || "", limit);
        jsonRes(res, 200, { ok: true, events: events || [], count: events?.length || 0, serverTime: (/* @__PURE__ */ new Date()).toISOString() });
      }
    },
    "GET /api/v1/events/stream": {
      handler: async (_req, res) => {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "Access-Control-Allow-Origin": "*" });
        res.write(`data: ${JSON.stringify({ type: "connected", timestamp: (/* @__PURE__ */ new Date()).toISOString() })}

`);
        let lastEventCount = 0;
        const interval = setInterval(async () => {
          try {
            const count = await queryRenderer("getEventCount");
            if (count > lastEventCount) {
              const newEvents = await queryRenderer("getEvents", "", count - lastEventCount);
              if (newEvents?.length > 0) {
                for (const evt of newEvents) {
                  res.write(`id: ${evt.id}
event: ${evt.type}
data: ${JSON.stringify(evt)}

`);
                }
              }
              lastEventCount = count;
            }
            res.write(`: heartbeat ${(/* @__PURE__ */ new Date()).toISOString()}

`);
          } catch {
          }
        }, 2e3);
        _req.on("close", () => clearInterval(interval));
      }
    },
    "GET /api/v1/internal/state": {
      handler: async (_req, res) => {
        const state = await queryRenderer("getInternalState");
        jsonRes(res, 200, { ok: true, state: state || {} });
      }
    },
    // ── XRD API ──
    "POST /api/v1/characterization/xrd/analyze": {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          return jsonRes(res, 400, { ok: false, error: "Invalid JSON body" });
        }
        let rawDataText = payload.data;
        if (!rawDataText && payload.filePath) {
          try {
            rawDataText = import_fs3.default.readFileSync(payload.filePath, "utf-8");
          } catch (e) {
            return jsonRes(res, 400, { ok: false, error: `Cannot read file: ${e.message}` });
          }
        }
        if (!rawDataText) return jsonRes(res, 400, { ok: false, error: 'Missing "data" or "filePath"' });
        const result = await queryRenderer("analyzeXrd", rawDataText, payload.options || {});
        if (result?.error) return jsonRes(res, 400, { ok: false, error: result.error });
        jsonRes(res, 200, { ok: true, analysis: result });
      }
    },
    "POST /api/v1/characterization/xrd/interpret": {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          return jsonRes(res, 400, { ok: false, error: "Invalid JSON body" });
        }
        let rawDataText = payload.data;
        if (!rawDataText && payload.filePath) {
          try {
            rawDataText = import_fs3.default.readFileSync(payload.filePath, "utf-8");
          } catch (e) {
            return jsonRes(res, 400, { ok: false, error: `Cannot read file: ${e.message}` });
          }
        }
        if (!rawDataText) return jsonRes(res, 400, { ok: false, error: 'Missing "data" or "filePath"' });
        const xrdResult = await queryRenderer("analyzeXrd", rawDataText, payload.options || {});
        if (xrdResult?.error) return jsonRes(res, 400, { ok: false, error: xrdResult.error });
        const peakTable = (xrdResult.peaks || []).map(
          (p, i) => `#${i + 1}: 2\u03B8=${p.twoTheta}\xB0, d=${p.dSpacing_angstrom}\xC5, FWHM=${p.fwhm}\xB0, \u6676\u7C92=${p.grainSize_nm}nm, \u76F8\u5BF9\u5F3A\u5EA6=${p.relativeIntensity}%`
        ).join("\n");
        const aiPrompt = `\u4F60\u662FXRD\u884D\u5C04\u6570\u636E\u5206\u6790\u4E13\u5BB6\u3002\u4EE5\u4E0B\u662FXRD\u5206\u6790\u7ED3\u679C\uFF0C\u8BF7\u7ED9\u51FA\u5B66\u672F\u7EA7\u7684\u89E3\u8BFB\u62A5\u544A\u3002

## \u6570\u636E\u6982\u51B5
- \u6570\u636E\u70B9: ${xrdResult.dataPoints}
- 2\u03B8\u8303\u56F4: ${xrdResult.twoThetaRange?.min}\xB0 - ${xrdResult.twoThetaRange?.max}\xB0
- \u5C04\u7EBF\u6E90: ${xrdResult.wavelength?.source} (\u03BB=${xrdResult.wavelength?.value}nm)

## \u68C0\u6D4B\u5230\u7684\u884D\u5C04\u5CF0 (${xrdResult.peaks?.length || 0} \u4E2A)
${peakTable || "\u65E0\u5CF0\u68C0\u6D4B\u5230"}

${payload.sampleInfo ? `## \u6837\u54C1\u4FE1\u606F
${payload.sampleInfo}` : ""}
${payload.question ? `## \u7528\u6237\u7279\u5B9A\u95EE\u9898
${payload.question}` : ""}

\u8BF7\u8F93\u51FA:
1. **\u7269\u76F8\u63A8\u6D4B**: \u6839\u636E\u5CF0\u4F4D\u548Cd\u503C\u63A8\u6D4B\u53EF\u80FD\u7684\u7269\u76F8
2. **\u7ED3\u6676\u6027\u8BC4\u4F30**: \u8BC4\u4F30\u6837\u54C1\u7684\u7ED3\u6676\u7A0B\u5EA6\u548C\u6676\u7C92\u8D28\u91CF
3. **\u5F02\u5E38\u8BCA\u65AD**: \u6307\u51FA\u4E0D\u5BFB\u5E38\u7684\u5CF0\u6216\u6570\u636E\u7279\u5F81
4. **\u5B9E\u9A8C\u5EFA\u8BAE**: \u4E0B\u4E00\u6B65\u8868\u5F81\u5EFA\u8BAE`;
        const aiResult = await queryRenderer("aiChat", aiPrompt, payload.model || null);
        jsonRes(res, 200, { ok: true, analysis: xrdResult, interpretation: { text: aiResult?.text || "", model: aiResult?.model || "auto" } });
      }
    },
    "GET /api/v1/characterization/xrd/sources": {
      handler: async (_req, res) => {
        const sources = await queryRenderer("getXrdSources");
        jsonRes(res, 200, { ok: true, sources: sources || {} });
      }
    },
    // ── 项目上下文 AI ──
    "POST /api/v1/projects/context": {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          return jsonRes(res, 400, { ok: false, error: "Invalid JSON body" });
        }
        if (!payload.projectId) return jsonRes(res, 400, { ok: false, error: 'Missing "projectId"' });
        const context = await queryRenderer("getProjectContext", payload.projectId);
        if (context?.error) return jsonRes(res, 404, { ok: false, error: context.error });
        jsonRes(res, 200, { ok: true, context });
      }
    },
    "POST /api/v1/ai/chat/contextual": {
      handler: async (req, res) => {
        const body = await readBody(req);
        let payload;
        try {
          payload = JSON.parse(body);
        } catch {
          return jsonRes(res, 400, { ok: false, error: "Invalid JSON body" });
        }
        if (!payload.projectId || !payload.prompt) return jsonRes(res, 400, { ok: false, error: 'Missing "projectId" and/or "prompt"' });
        const result = await queryRenderer("contextualAiChat", payload.projectId, payload.prompt, { model: payload.model || null });
        if (result?.error && !result?.text) return jsonRes(res, 500, { ok: false, error: result.error });
        jsonRes(res, 200, { ok: true, ...result });
      }
    }
  };
  const apiServer = import_http.default.createServer(async (req, res) => {
    setHeaders(res);
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (!verifyToken(req)) return jsonRes(res, 401, { ok: false, error: "Unauthorized" });
    const urlObj = new URL(req.url || "/", `http://127.0.0.1:${API_PORT}`);
    const routeKey = `${req.method} ${urlObj.pathname}`;
    const route = routeHandlers[routeKey];
    if (route) {
      try {
        await route.handler(req, res, urlObj);
      } catch (e) {
        console.error(`[API Server] Error ${routeKey}:`, e);
        jsonRes(res, 500, { ok: false, error: e.message });
      }
      return;
    }
    if (req.method === "GET" && urlObj.pathname.startsWith("/api/v1/settings/")) {
      const key = urlObj.pathname.replace("/api/v1/settings/", "");
      const settings = await queryRenderer("getSettings");
      jsonRes(res, 200, { ok: true, key, value: settings?.[key] ?? null });
      return;
    }
    if (urlObj.pathname === "/" || urlObj.pathname === "") {
      jsonRes(res, 200, { ok: true, message: "\u{1F9EA} SciFlow Pro API Server is running!", version: import_electron4.app.getVersion(), docs: `http://127.0.0.1:${API_PORT}/api/v1/openapi`, endpoints: Object.keys(routeHandlers) });
      return;
    }
    jsonRes(res, 404, { ok: false, error: `Route not found: ${req.method} ${urlObj.pathname}` });
  });
  apiServer.listen(API_PORT, "127.0.0.1", () => {
    console.log(`
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`);
    console.log(`  \u{1F9EA} SciFlow Pro API Server`);
    console.log(`  \u{1F4E1} http://127.0.0.1:${API_PORT}`);
    console.log(`  \u{1F4C4} API Docs: http://127.0.0.1:${API_PORT}/api/v1/openapi`);
    console.log(`\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
`);
  });
  apiServer.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[API Server] Port ${API_PORT} already in use.`);
    } else {
      console.error("[API Server] Failed:", err);
    }
  });
  import_electron4.app.on("activate", () => {
    if (import_electron4.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
import_electron4.app.on("web-contents-created", (_event, contents) => {
  contents.on("will-navigate", (event, url) => {
    const isExternal = url.startsWith("http:") || url.startsWith("https:");
    const isLocalhost = url.includes("localhost:") || url.includes("127.0.0.1:");
    if (isExternal && !isLocalhost) {
      event.preventDefault();
      import_electron4.shell.openExternal(url);
    }
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      import_electron4.shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
});
import_electron4.app.on("window-all-closed", () => {
  if (import_node_process.default.platform !== "darwin") import_electron4.app.quit();
});
