// ═══ electron/ipcHandlers.ts — IPC 事件处理器 ═══

import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { getMachineId, getLicenseState, verifyActivationCode, writeLicenseData } from './license';

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

    // 弹出独立窗口
    registerPopoutWindow(_dirname);
}
