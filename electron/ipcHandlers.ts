// ═══ electron/ipcHandlers.ts — IPC 事件处理器 ═══

import { BrowserWindow, dialog, ipcMain, shell, session, net } from 'electron';
import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { app } from 'electron';
import { getMachineId, getLicenseState, verifyActivationCode, writeLicenseData } from './license';
import url from 'url';

/**
 * 带 Cookie 的 HTTP GET 请求（用于 wytsg.com 图书馆通道）
 * 跟踪最多 5 次重定向，返回最终页面 HTML
 */
function fetchWithCookie(targetUrl: string, cookie: string, maxRedirects = 5): Promise<string | null> {
    return new Promise((resolve) => {
        const doRequest = (reqUrl: string, redirects: number) => {
            if (redirects <= 0) { resolve(null); return; }
            const parsed = new URL(reqUrl);
            const mod = parsed.protocol === 'https:' ? https : http;
            const req = mod.get(reqUrl, {
                headers: {
                    'Cookie': cookie,
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) SciFlow/1.0',
                    'Accept': 'text/html,application/xhtml+xml',
                },
                timeout: 15000,
            }, (res) => {
                // 跟踪重定向
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const next = res.headers.location.startsWith('http')
                        ? res.headers.location
                        : url.resolve(reqUrl, res.headers.location);
                    doRequest(next, redirects - 1);
                    return;
                }
                let body = '';
                res.setEncoding('utf-8');
                res.on('data', (chunk: string) => { body += chunk; });
                res.on('end', () => resolve(body));
                res.on('error', () => resolve(null));
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
        };
        doRequest(targetUrl, maxRedirects);
    });
}

// ═══ 弹出独立窗口（Tab Tear-Off） ═══
export function registerPopoutWindow(_dirname: string): void {
    ipcMain.handle('open-popout-window', async (_event, payload: { viewId: string; title: string }) => {
        const { viewId, title } = payload;

        const popout = new BrowserWindow({
            width: 1000,
            height: 700,
            title: title || 'SciFlow Pro',
            titleBarStyle: 'hiddenInset',
            webPreferences: {
                preload: path.join(_dirname, 'preload.cjs'),
                nodeIntegration: false,
                contextIsolation: true,
                backgroundThrottling: false,
            },
        });

        const isDev = process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged;
        if (isDev) {
            popout.loadURL(`http://localhost:5173?popout=${encodeURIComponent(viewId)}`);
        } else {
            popout.loadFile(path.join(_dirname, '../dist/index.html'), {
                query: { popout: viewId },
            });
        }

        return { success: true };
    });
}

/** 注册所有 IPC 处理器 */
export function registerIpcHandlers(_dirname: string): void {

    // ═══ 授权系统 IPC ═══
    ipcMain.handle('get-license-state', () => {
        return getLicenseState();
    });

    ipcMain.handle('activate-license', async (_event, code: string) => {
        if (!verifyActivationCode(code)) {
            return { success: false, error: '激活码无效，请检查后重试' };
        }
        const machineId = getMachineId();
        writeLicenseData({
            status: 'activated',
            activationCode: code.trim().toUpperCase(),
            activatedAt: new Date().toISOString(),
            machineId,
        });
        return { success: true };
    });

    ipcMain.handle('reset-trial', () => {
        const isDev = process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged;
        if (!isDev) return { success: false, error: '仅开发环境可用' };
        writeLicenseData({
            status: 'trial',
            trialStartDate: new Date().toISOString(),
            machineId: getMachineId(),
        });
        return { success: true };
    });

    // ═══ 原生截屏 API ═══
    ipcMain.handle('capture-page', async (_event, rect?: { x: number; y: number; width: number; height: number }) => {
        const win = BrowserWindow.getFocusedWindow();
        if (!win) return null;
        try {
            let image;
            if (rect) {
                image = await win.webContents.capturePage(rect);
            } else {
                image = await win.webContents.capturePage();
            }
            return image.toPNG().toString('base64');
        } catch (err) {
            console.error('capturePage failed:', err);
            return null;
        }
    });

    // ═══ 文件对话框 ═══
    const lastUsedPaths: Record<string, string> = {};

    ipcMain.handle('select-local-file', async (_event, arg?: string | { contextKey?: string; multiple?: boolean }) => {
        const contextKey = typeof arg === 'string' ? arg : arg?.contextKey;
        const multiple = typeof arg === 'object' ? !!arg?.multiple : false;
        const win = BrowserWindow.getFocusedWindow();
        const defaultPath = contextKey && lastUsedPaths[contextKey] ? lastUsedPaths[contextKey] : undefined;
        const result = await dialog.showOpenDialog(win!, {
            properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
            defaultPath,
            filters: [
                { name: 'All Supported Files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'pdf', 'docx', 'doc', 'txt', 'csv', 'xy', 'md', 'json', 'xlsx', 'xls', 'h5', 'ipynb', 'mp4', 'mov', 'avi', 'mp3', 'wav', 'py', 'r', 'js', 'ts', 'cpp', 'h', 'pptx', 'ppt', 'rtf'] },
                { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] },
                { name: 'Scientific Documents', extensions: ['pdf', 'docx', 'doc', 'txt', 'csv', 'xy', 'md', 'json'] },
                { name: 'Research Data', extensions: ['csv', 'xlsx', 'xls', 'json', 'h5', 'ipynb'] },
                { name: 'Media', extensions: ['mp4', 'mov', 'avi', 'mp3', 'wav'] },
                { name: 'Source Code', extensions: ['py', 'r', 'js', 'ts', 'cpp', 'h'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });

        if (result.canceled || result.filePaths.length === 0) return null;

        const filePath = result.filePaths[0];
        if (contextKey) {
            lastUsedPaths[contextKey] = path.dirname(filePath);
        }

        if (multiple) {
            return result.filePaths.map((p) => ({
                name: path.basename(p),
                path: p
            }));
        }
        return { name: path.basename(filePath), path: filePath };
    });

    ipcMain.handle('select-directory', async () => {
        const win = BrowserWindow.getFocusedWindow();
        const result = await dialog.showOpenDialog(win!, {
            properties: ['openDirectory', 'createDirectory']
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        return result.filePaths[0];
    });

    ipcMain.handle('open-path', async (_event, targetPath: string) => {
        if (fs.existsSync(targetPath)) {
            return await shell.openPath(targetPath);
        }
        return 'File not found';
    });

    ipcMain.handle('save-file', async (_event, opts: { name: string; content: string; defaultPath?: string }) => {
        const result = await dialog.showSaveDialog({
            defaultPath: opts.defaultPath ? path.join(opts.defaultPath, opts.name) : opts.name,
            filters: [{ name: 'All Files', extensions: ['*'] }]
        });
        if (result.canceled || !result.filePath) return { success: false };
        try {
            fs.writeFileSync(result.filePath, opts.content);
            return { success: true, filePath: result.filePath };
        } catch (err) {
            console.error('Failed to save file:', err);
            return { success: false };
        }
    });

    // ═══ Word 模式：打开 .docx 文件对话框 ═══
    ipcMain.handle('open-docx-dialog', async () => {
        const win = BrowserWindow.getFocusedWindow();
        const result = await dialog.showOpenDialog(win!, {
            properties: ['openFile'],
            filters: [
                { name: 'Word 文档', extensions: ['docx'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        const filePath = result.filePaths[0];
        try {
            const data = await fs.promises.readFile(filePath);
            return {
                name: path.basename(filePath),
                path: filePath,
                data: data.toString('base64'),
            };
        } catch (err: any) {
            console.error('Failed to read docx:', err);
            return null;
        }
    });

    // ═══ Word 模式：保存 .docx 文件 ═══
    ipcMain.handle('save-docx', async (_event, opts: {
        data: string; // base64 编码
        filePath?: string; // 如果已有路径则直接保存，否则弹出"另存为"
        defaultName?: string;
    }) => {
        let targetPath = opts.filePath;
        if (!targetPath) {
            const result = await dialog.showSaveDialog({
                defaultPath: opts.defaultName || 'document.docx',
                filters: [{ name: 'Word 文档', extensions: ['docx'] }]
            });
            if (result.canceled || !result.filePath) return { success: false };
            targetPath = result.filePath;
        }
        try {
            const buffer = Buffer.from(opts.data, 'base64');
            await fs.promises.writeFile(targetPath, buffer);
            return { success: true, filePath: targetPath, name: path.basename(targetPath) };
        } catch (err: any) {
            console.error('Failed to save docx:', err);
            return { success: false, error: err.message };
        }
    });

    // ═══ 本地 Word 联动：选择文件并用 Word 打开 ═══
    ipcMain.handle('open-in-word', async () => {
        const win = BrowserWindow.getFocusedWindow();
        const result = await dialog.showOpenDialog(win!, {
            properties: ['openFile'],
            filters: [
                { name: 'Word 文档', extensions: ['docx', 'doc'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        const filePath = result.filePaths[0];
        const errMsg = await shell.openPath(filePath);
        if (errMsg) {
            console.error('Failed to open in Word:', errMsg);
            return { success: false, error: errMsg };
        }
        return { success: true, filePath, name: path.basename(filePath) };
    });

    // ═══ 本地 Word 联动：创建空白 .docx 并用 Word 打开 ═══
    ipcMain.handle('create-new-docx', async () => {
        const win = BrowserWindow.getFocusedWindow();
        const result = await dialog.showSaveDialog(win!, {
            defaultPath: '未命名文档.docx',
            filters: [{ name: 'Word 文档', extensions: ['docx'] }]
        });
        if (result.canceled || !result.filePath) return null;
        const filePath = result.filePath;
        try {
            // 写入一个最小的合法 .docx (空白文档 — 实际上让 Word 自己创建)
            // 先创建空文件，Word 会自动处理
            if (!fs.existsSync(filePath)) {
                await fs.promises.writeFile(filePath, '');
            }
            const errMsg = await shell.openPath(filePath);
            if (errMsg) return { success: false, error: errMsg };
            return { success: true, filePath, name: path.basename(filePath) };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('read-file', async (_event, targetPath: string) => {
        if (!fs.existsSync(targetPath)) return null;
        try {
            const ext = path.extname(targetPath).toLowerCase();
            if (ext === '.pdf') {
                const data = await fs.promises.readFile(targetPath, { encoding: 'base64' });
                return { mimeType: 'application/pdf', data };
            } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
                const data = await fs.promises.readFile(targetPath, { encoding: 'base64' });
                return { mimeType: `image/${ext.replace('.', '')}`, data };
            } else {
                const data = await fs.promises.readFile(targetPath, 'utf-8');
                return { mimeType: 'text/plain', data };
            }
        } catch (e) {
            console.error("Read file error:", e);
            return null;
        }
    });

    ipcMain.handle('show-item-in-folder', async (_event, targetPath: string) => {
        if (fs.existsSync(targetPath)) {
            shell.showItemInFolder(targetPath);
        }
    });

    // ═══ 目录监控 ═══
    const watchers = new Map<string, fs.FSWatcher>();

    ipcMain.handle('watch-directory', async (event, targetPath: string) => {
        if (!fs.existsSync(targetPath)) return { success: false, error: 'Directory not found' };
        const stats = fs.statSync(targetPath);
        if (!stats.isDirectory()) return { success: false, error: 'Path is not a directory' };
        if (watchers.has(targetPath)) return { success: true, message: 'Already watching' };

        try {
            const watcher = fs.watch(targetPath, (eventType, filename) => {
                if (filename && eventType === 'rename') {
                    const fullPath = path.join(targetPath, filename);
                    if (fs.existsSync(fullPath)) {
                        event.sender.send('fs-notification', {
                            type: 'added', path: fullPath, name: filename,
                            ext: path.extname(filename), parentDir: targetPath
                        });
                    }
                }
            });
            watchers.set(targetPath, watcher);
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('list-directory', async (_event, targetPath: string) => {
        if (!fs.existsSync(targetPath)) return [];
        try {
            const files = fs.readdirSync(targetPath);
            return files.map(file => {
                const fullPath = path.join(targetPath, file);
                const stats = fs.statSync(fullPath);
                return {
                    name: file, path: fullPath, isDirectory: stats.isDirectory(),
                    ext: path.extname(file), size: stats.size, lastModified: stats.mtime
                };
            });
        } catch (err) {
            console.error('List directory error:', err);
            return [];
        }
    });

    ipcMain.handle('unwatch-directory', async (_event, targetPath: string) => {
        const watcher = watchers.get(targetPath);
        if (watcher) {
            watcher.close();
            watchers.delete(targetPath);
            return { success: true };
        }
        return { success: false, error: 'Not watching this path' };
    });

    // ═══ HTTP 代理请求 ═══
    ipcMain.handle('http-request', async (_event, payload: {
        url: string; method?: string; headers?: Record<string, string>; body?: string;
    }) => {
        try {
            if (!payload?.url || !/^https?:\/\//i.test(payload.url)) {
                return { ok: false, status: 400, statusText: 'Bad Request', headers: {}, body: 'Invalid URL' };
            }
            const response = await fetch(payload.url, {
                method: payload.method || 'GET',
                headers: payload.headers || {},
                body: payload.body
            });
            const headerObj: Record<string, string> = {};
            response.headers.forEach((value, key) => { headerObj[key] = value; });
            const text = await response.text();
            return { ok: response.ok, status: response.status, statusText: response.statusText, headers: headerObj, body: text };
        } catch (error: any) {
            return { ok: false, status: 0, statusText: 'Network Error', headers: {}, body: error?.message || 'Unknown error' };
        }
    });

    // ═══ 外部链接 ═══
    ipcMain.handle('open-external-url', async (_event, url: string) => {
        if (url && (url.startsWith('http:') || url.startsWith('https:'))) {
            await shell.openExternal(url);
            return { success: true };
        }
        return { success: false, error: 'Invalid URL' };
    });

    // ═══ PDF 内搜索（批注定位） ═══
    ipcMain.handle('find-in-page', async (_event, text: string) => {
        const win = BrowserWindow.getFocusedWindow();
        if (!win || !text) return { found: false };
        try {
            const requestId = win.webContents.findInPage(text, { findNext: false });
            return { found: true, requestId };
        } catch (err) {
            console.error('findInPage error:', err);
            return { found: false };
        }
    });

    ipcMain.handle('stop-find-in-page', async () => {
        const win = BrowserWindow.getFocusedWindow();
        if (!win) return;
        try {
            win.webContents.stopFindInPage('clearSelection');
        } catch {}
    });

    // ═══ PDF 文件下载 ═══
    const DEFAULT_PDF_DIR = path.join(app.getPath('documents'), 'SciFlow-PDFs');
    const PDF_DIR_KEY = 'sciflow_pdf_download_dir';

    // 获取下载目录
    ipcMain.handle('get-pdf-download-dir', () => {
        // 从简单的 JSON 配置文件中读取
        const configPath = path.join(app.getPath('userData'), 'pdf-config.json');
        try {
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                if (config.downloadDir && fs.existsSync(config.downloadDir)) {
                    return config.downloadDir;
                }
            }
        } catch { }
        return DEFAULT_PDF_DIR;
    });

    // 设置下载目录
    ipcMain.handle('set-pdf-download-dir', (_event, dir: string) => {
        const configPath = path.join(app.getPath('userData'), 'pdf-config.json');
        try {
            let config: any = {};
            if (fs.existsSync(configPath)) {
                config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            }
            config.downloadDir = dir;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    // 下载 PDF 文件到本地目录
    ipcMain.handle('download-pdf', async (_event, payload: { url: string; filename: string }) => {
        const { url, filename } = payload;
        if (!url || !filename) return { success: false, error: '缺少 URL 或文件名' };

        // 获取下载目录
        const configPath = path.join(app.getPath('userData'), 'pdf-config.json');
        let downloadDir = DEFAULT_PDF_DIR;
        try {
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                if (config.downloadDir) downloadDir = config.downloadDir;
            }
        } catch { }

        // 确保目录存在
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        const filePath = path.join(downloadDir, filename);

        // 如果已下载，直接返回
        if (fs.existsSync(filePath)) {
            return { success: true, filePath };
        }

        // ── 第一步：快速尝试 net.request（适用于无保护的直接 PDF 链接）──
        const quickResult = await new Promise<{ success: boolean; filePath?: string; error?: string }>((resolve) => {
            const request = net.request({ url, method: 'GET', redirect: 'follow' });
            request.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            request.setHeader('Accept', 'application/pdf,*/*');

            let resolved = false;
            const done = (r: any) => { if (!resolved) { resolved = true; resolve(r); } };

            request.on('response', (response) => {
                if (response.statusCode !== 200) { done({ success: false, error: `HTTP ${response.statusCode}` }); return; }
                const ct = (response.headers['content-type'] as string || '').toLowerCase();
                if (ct.includes('text/html')) { done({ success: false, error: 'HTML' }); return; }

                const chunks: Buffer[] = [];
                response.on('data', (chunk: Buffer) => chunks.push(chunk));
                response.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    if (buffer.length < 10240 || buffer.slice(0, 5).toString('ascii') !== '%PDF-') {
                        done({ success: false, error: '不是有效 PDF' });
                        return;
                    }
                    fs.writeFileSync(filePath, buffer);
                    done({ success: true, filePath });
                });
                response.on('error', (err: Error) => done({ success: false, error: err.message }));
            });
            request.on('error', (err: Error) => done({ success: false, error: err.message }));
            setTimeout(() => { request.abort(); done({ success: false, error: 'timeout' }); }, 15000);
            request.end();
        });

        if (quickResult.success) return quickResult;
        console.log(`[download-pdf] Quick download failed (${quickResult.error}), trying BrowserWindow...`);

        // ── 第二步：BrowserWindow + CDP Fetch（通过 Cloudflare / 反爬保护）──
        return new Promise((resolve) => {
            let resolved = false;
            const done = (r: any) => {
                if (resolved) return;
                resolved = true;
                try { if (downloadWin && !downloadWin.isDestroyed()) downloadWin.close(); } catch {}
                resolve(r);
            };

            const downloadWin = new BrowserWindow({
                show: false,
                width: 1024,
                height: 768,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    plugins: false, // 禁用 PDF 插件，确保 PDF 不被内置 viewer 吞噬
                },
            });

            // ★ 阻止所有弹窗（ACS/Cloudflare 可能触发 window.open）
            downloadWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

            // 用 CDP Fetch domain 在请求层面截获 PDF 响应
            try {
                downloadWin.webContents.debugger.attach('1.3');
            } catch (err: any) {
                console.log(`[download-pdf] Debugger attach failed: ${err.message}`);
                done({ success: false, error: `Debugger attach failed: ${err.message}` });
                return;
            }

            // 启用 Fetch 拦截：只拦截 response 阶段的 PDF 类型
            downloadWin.webContents.debugger.sendCommand('Fetch.enable', {
                patterns: [
                    { resourceType: 'Document', requestStage: 'Response' },
                    { resourceType: 'Other', requestStage: 'Response' },
                ],
            });

            downloadWin.webContents.debugger.on('message', async (_event: any, method: string, params: any) => {
                if (resolved) return;

                if (method === 'Fetch.requestPaused') {
                    const { requestId, responseStatusCode, responseHeaders } = params;
                    const ct = (responseHeaders || []).find(
                        (h: any) => h.name.toLowerCase() === 'content-type'
                    )?.value?.toLowerCase() || '';

                    console.log(`[download-pdf] Fetch.requestPaused: status=${responseStatusCode}, ct=${ct}, url=${params.request?.url?.substring(0, 80)}`);

                    // 检查是否是 PDF 响应
                    if (responseStatusCode === 200 && (ct.includes('application/pdf') || ct.includes('application/octet-stream'))) {
                        try {
                            const body = await downloadWin.webContents.debugger.sendCommand(
                                'Fetch.getResponseBody', { requestId }
                            );
                            const buf = body.base64Encoded
                                ? Buffer.from(body.body, 'base64')
                                : Buffer.from(body.body);

                            console.log(`[download-pdf] Got PDF body: ${buf.length} bytes, magic: ${buf.slice(0, 5).toString('ascii')}`);

                            if (buf.length >= 10240 && buf.slice(0, 5).toString('ascii') === '%PDF-') {
                                fs.writeFileSync(filePath, buf);
                                console.log(`[download-pdf] ✅ Saved PDF: ${buf.length} bytes → ${filePath}`);
                                // 不需要继续加载了，直接完成
                                try { downloadWin.webContents.debugger.sendCommand('Fetch.failRequest', { requestId, reason: 'Aborted' }); } catch {}
                                done({ success: true, filePath });
                                return;
                            }
                        } catch (e: any) {
                            console.log(`[download-pdf] Fetch.getResponseBody error: ${e.message}`);
                        }
                    }

                    // 非 PDF 响应或 PDF 太小：放行让页面继续加载
                    try {
                        await downloadWin.webContents.debugger.sendCommand('Fetch.continueRequest', { requestId });
                    } catch {}
                }
            });

            console.log(`[download-pdf] Loading URL in BrowserWindow: ${url}`);
            downloadWin.loadURL(url).catch((e: any) => {
                console.log(`[download-pdf] loadURL error: ${e.message}`);
            });

            // 超时：45 秒
            setTimeout(() => {
                console.log(`[download-pdf] ⏰ BrowserWindow timeout`);
                done({ success: false, error: '浏览器下载超时 (45s)' });
            }, 45000);
        });
    });

    // ═══ wytsg.com 图书馆 WebView 登录（持久化 session） ═══
    const wytsgSession = session.fromPartition('persist:wytsg');

    /**
     * 使用持久化 session 发送 HTTP 请求（自动携带 Cookie）
     * 返回最终响应的 HTML 内容
     */
    function fetchWithWytsgSession(targetUrl: string, maxRedirects = 5): Promise<string | null> {
        return new Promise((resolve) => {
            const doRequest = (reqUrl: string, redirects: number) => {
                if (redirects <= 0) { resolve(null); return; }
                const req = net.request({
                    url: reqUrl,
                    session: wytsgSession,
                    redirect: 'manual',
                });
                req.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) SciFlow/1.0');
                req.setHeader('Accept', 'text/html,application/xhtml+xml');
                req.on('response', (res) => {
                    // 跟踪重定向
                    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        const location = Array.isArray(res.headers.location) ? res.headers.location[0] : res.headers.location;
                        const next = location.startsWith('http') ? location : url.resolve(reqUrl, location);
                        doRequest(next, redirects - 1);
                        return;
                    }
                    let body = '';
                    res.on('data', (chunk: Buffer) => { body += chunk.toString('utf-8'); });
                    res.on('end', () => resolve(body));
                    res.on('error', () => resolve(null));
                });
                req.on('error', () => resolve(null));
                req.end();
            };
            doRequest(targetUrl, maxRedirects);
        });
    }

    ipcMain.handle('open-wytsg-login', async () => {
        return new Promise((resolve) => {
            const loginUrl = 'http://www.wytsg.com/e/member/login/';
            const loginWin = new BrowserWindow({
                width: 900,
                height: 700,
                title: '图书馆登录 - wytsg.com',
                autoHideMenuBar: true,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    session: wytsgSession, // 使用持久化 session
                },
            });
            loginWin.loadURL(loginUrl);

            let resolved = false;

            // 监听导航：如果 URL 不再是 login 页面，说明登录成功
            loginWin.webContents.on('did-navigate', async (_e, navUrl) => {
                if (resolved) return;
                // 登录成功后通常跳转到首页或用户中心（/e/member/cp/）
                if (!navUrl.includes('/login') && navUrl.includes('wytsg.com')) {
                    resolved = true;
                    // Cookie 已由 persist:wytsg session 自动持久化，无需手动保存
                    loginWin.close();
                    resolve({ success: true, message: '登录成功' });
                }
            });

            // 用户手动关闭窗口
            loginWin.on('closed', () => {
                if (!resolved) {
                    resolved = true;
                    resolve({ success: false, error: '用户取消登录' });
                }
            });
        });
    });

    ipcMain.handle('get-wytsg-cookies', async () => {
        try {
            // 检查持久化 session 中是否有 wytsg.com 的 Cookie
            const cookies = await wytsgSession.cookies.get({ domain: '.wytsg.com' });
            if (!cookies || cookies.length === 0) {
                // 也尝试不带前缀点的域名
                const cookies2 = await wytsgSession.cookies.get({ url: 'http://www.wytsg.com' });
                if (!cookies2 || cookies2.length === 0) {
                    return { loggedIn: false, cookies: null };
                }
            }

            // 有 Cookie，主动验证是否仍有效：访问用户中心页面
            const checkHtml = await fetchWithWytsgSession('http://www.wytsg.com/e/member/cp/');
            if (!checkHtml || checkHtml.includes('/login') || checkHtml.includes('login/index.php')) {
                // 被重定向到登录页 → Cookie 已失效
                return { loggedIn: false, expired: true, cookies: null };
            }

            // Cookie 有效
            return { loggedIn: true, expired: false, cookies: cookies.map(c => ({ name: c.name, value: c.value })) };
        } catch {
            return { loggedIn: false, cookies: null };
        }
    });

    ipcMain.handle('wytsg-download-pdf', async (_event, doi: string) => {
        try {
            // 检查是否有 Cookie
            const cookies = await wytsgSession.cookies.get({ url: 'http://www.wytsg.com' });
            if (!cookies || cookies.length === 0) {
                return { success: false, error: '未登录图书馆' };
            }

            const cleanDoi = doi.replace('https://doi.org/', '').trim();

            // 第一步：通过持久化 session 访问 wytsg.com 外文数据库入口
            const entryUrl = 'http://www.wytsg.com/e/action/ShowInfo.php?classid=200&id=3457';
            const entryHtml = await fetchWithWytsgSession(entryUrl);

            // 提取 Sci-Hub 镜像地址
            let mirrorUrl = 'https://www.tesble.com'; // 默认
            if (entryHtml) {
                const mirrorMatch = entryHtml.match(/href=["'](https?:\/\/[^"']*(?:sci-hub|tesble|sci\.hub)[^"']*)/i)
                    || entryHtml.match(/href=["'](https?:\/\/(?:www\.)?[a-z0-9.-]+\.[a-z]{2,})/gi);
                if (mirrorMatch) {
                    mirrorUrl = (mirrorMatch[1] || mirrorMatch[0].replace(/^href=["']/, '')).replace(/\/+$/, '');
                }
            }

            // 第二步：访问镜像页面获取真实 PDF URL
            const mirrorPageUrl = `${mirrorUrl}/${cleanDoi}`;
            const pageHtml = await fetchWithCookie(mirrorPageUrl, ''); // 镜像不需要 Cookie

            if (!pageHtml) {
                return { success: false, error: '无法访问镜像页面' };
            }

            // 提取真实 PDF URL
            const pdfPatterns = [
                /<(?:iframe|embed)[^>]+src=["']([^"']*\.pdf[^"']*)/i,
                /<(?:iframe|embed)[^>]+src=["']([^"']+#[^"']*)/i,
                /location\.href\s*=\s*["']([^"']*\.pdf[^"']*)/i,
                /href=["'](https?:\/\/[^"']*\.pdf[^"']*)/i,
            ];

            for (const pat of pdfPatterns) {
                const match = pageHtml.match(pat);
                if (match?.[1]) {
                    let pdfUrl = match[1].split('#')[0];
                    if (pdfUrl.startsWith('//')) pdfUrl = 'https:' + pdfUrl;
                    else if (pdfUrl.startsWith('/')) pdfUrl = mirrorUrl + pdfUrl;
                    else if (!pdfUrl.startsWith('http')) pdfUrl = mirrorUrl + '/' + pdfUrl;
                    return { success: true, pdfUrl };
                }
            }

            return { success: false, error: '镜像页面中未找到 PDF 链接' };
        } catch (err: any) {
            return { success: false, error: err.message || '图书馆通道下载失败' };
        }
    });

    // ═══ wytsg.com 凭据保存与自动登录 ═══
    const wytsgCredPath = path.join(app.getPath('userData'), 'wytsg-cred.json');

    ipcMain.handle('save-wytsg-credentials', async (_event, payload: { username: string; password: string }) => {
        try {
            const data = {
                u: Buffer.from(payload.username).toString('base64'),
                p: Buffer.from(payload.password).toString('base64'),
            };
            fs.writeFileSync(wytsgCredPath, JSON.stringify(data));
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('get-wytsg-credentials', async () => {
        try {
            if (!fs.existsSync(wytsgCredPath)) return { saved: false };
            const data = JSON.parse(fs.readFileSync(wytsgCredPath, 'utf-8'));
            return {
                saved: true,
                username: Buffer.from(data.u, 'base64').toString('utf-8'),
                password: Buffer.from(data.p, 'base64').toString('utf-8'),
            };
        } catch {
            return { saved: false };
        }
    });

    // 第一步：获取验证码图片
    ipcMain.handle('auto-wytsg-login-captcha', async () => {
        try {
            // 先访问登录页面让 session 获取初始 cookie
            await fetchWithWytsgSession('http://www.wytsg.com/e/member/login/');

            // 获取验证码图片
            return new Promise((resolve) => {
                const req = net.request({
                    url: 'http://www.wytsg.com/e/ShowKey/?v=login',
                    session: wytsgSession,
                });
                req.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) SciFlow/1.0');
                req.setHeader('Referer', 'http://www.wytsg.com/e/member/login/');
                req.on('response', (res) => {
                    const chunks: Buffer[] = [];
                    res.on('data', (chunk: Buffer) => chunks.push(chunk));
                    res.on('end', () => {
                        const buf = Buffer.concat(chunks);
                        const base64 = buf.toString('base64');
                        const contentType = (Array.isArray(res.headers['content-type'])
                            ? res.headers['content-type'][0]
                            : res.headers['content-type']) || 'image/png';
                        resolve({ success: true, captchaBase64: base64, mimeType: contentType });
                    });
                    res.on('error', () => resolve({ success: false, error: '验证码下载失败' }));
                });
                req.on('error', () => resolve({ success: false, error: '验证码请求失败' }));
                req.end();
            });
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    // 第二步：提交登录（渲染进程 AI 识别验证码后调用）
    ipcMain.handle('auto-wytsg-login-submit', async (_event, payload: {
        username: string; password: string; captcha: string;
    }) => {
        try {
            const formBody = new URLSearchParams({
                enews: 'login',
                fmdo: 'login',
                dopost: 'login_old',
                tobind: '0',
                ecmsfrom: '/e/action/ListInfo/?classid=62',
                username: payload.username,
                password: payload.password,
                key: payload.captcha,
                ok: '登 录',
            }).toString();

            return new Promise((resolve) => {
                const req = net.request({
                    url: 'http://www.wytsg.com/e/member/doaction.php',
                    method: 'POST',
                    session: wytsgSession,
                    redirect: 'manual',
                });
                req.setHeader('Content-Type', 'application/x-www-form-urlencoded');
                req.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) SciFlow/1.0');
                req.setHeader('Referer', 'http://www.wytsg.com/e/member/login/');

                req.on('response', (res) => {
                    const chunks: Buffer[] = [];
                    res.on('data', (chunk: Buffer) => { chunks.push(chunk); });
                    res.on('end', () => {
                        const rawBuf = Buffer.concat(chunks);
                        // 用 ASCII 部分做字符串匹配（GBK 和 UTF-8 中 ASCII 编码相同）
                        const asciiBody = rawBuf.toString('latin1');
                        const asciiLower = asciiBody.toLowerCase();

                        // GBK 字节级别匹配中文关键词
                        const gbkContains = (gbkHex: string): boolean => {
                            const needle = Buffer.from(gbkHex.replace(/\s+/g, ''), 'hex');
                            return rawBuf.includes(needle);
                        };

                        // 常用关键词的 GBK 编码字节序列
                        const has验证码   = gbkContains('D1E9 D6A4 C2EB');
                        const has不正确   = gbkContains('B2BB D5FD C8B7');
                        const has错误     = gbkContains('B4ED CEF3');
                        const has有误     = gbkContains('D3D0 CEF3');
                        const has密码     = gbkContains('C3DC C2EB');
                        const has登录成功 = gbkContains('B5C7 C2BC B3C9 B9A6');
                        const has正在加载 = gbkContains('D5FD D4DA BCD3 D4D8');

                        // 调试日志
                        console.log('[wytsg-auto-login] Status:', res.statusCode);
                        console.log('[wytsg-auto-login] GBK Match: 验证码=', has验证码, '不正确=', has不正确, '错误=', has错误, '密码=', has密码, '登录成功=', has登录成功);
                        console.log('[wytsg-auto-login] ASCII body (first 300):', asciiBody.substring(0, 300));

                        const isRedirect = res.statusCode >= 300 && res.statusCode < 400;
                        const location = Array.isArray(res.headers.location) ? res.headers.location[0] : res.headers.location;
                        const redirectToLogin = location?.includes('/login');

                        if (isRedirect && !redirectToLogin) {
                            resolve({ success: true, message: '自动登录成功' });
                        } else if (has登录成功 || has正在加载) {
                            resolve({ success: true, message: '自动登录成功' });
                        } else if (has验证码 && (has不正确 || has错误 || has有误)) {
                            resolve({ success: false, error: '验证码识别错误，请重试', retryable: true });
                        } else if (has密码 && (has不正确 || has错误 || has有误)) {
                            resolve({ success: false, error: '用户名或密码错误' });
                        } else if (asciiLower.includes('history.back') || asciiLower.includes('history.go(')) {
                            // 帝国CMS错误页面，但无法精确匹配中文错误
                            resolve({ success: false, error: '登录失败，验证码可能不正确', retryable: true });
                        } else {
                            // ASCII 检测 JS 跳转
                            const hasJsRedirect = asciiLower.includes('self.location')
                                || asciiLower.includes('location.href')
                                || asciiLower.includes('window.location')
                                || asciiLower.includes('location.replace');
                            if (hasJsRedirect && !asciiLower.includes('login')) {
                                resolve({ success: true, message: '自动登录成功' });
                            } else if (asciiLower.includes('cp/')) {
                                resolve({ success: true, message: '自动登录成功' });
                            } else {
                                resolve({ success: false, error: `登录结果未知` });
                            }
                        }
                    });
                    res.on('error', () => resolve({ success: false, error: '请求失败' }));
                });
                req.on('error', (err) => resolve({ success: false, error: err.message }));
                req.write(formBody);
                req.end();
            });
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    // 弹出独立窗口
    registerPopoutWindow(_dirname);
}
