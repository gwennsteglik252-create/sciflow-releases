// ═══ electron/updater.ts — 自动更新系统（GitHub API 版本检测） ═══

import { app, BrowserWindow, shell, ipcMain } from 'electron';

const GITHUB_REPO = 'gwennsteglik252-create/sciflow-releases';
const RELEASE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;

const sendUpdateStatus = (data: any) => {
    const wins = BrowserWindow.getAllWindows();
    wins.forEach(w => w.webContents.send('update-status', data));
};

/** 语义化版本比较: 返回 1 (a > b), -1 (a < b), 0 (a == b) */
function compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}

/**
 * 通过 GitHub API 检测是否有新版本
 */
export async function checkForUpdateViaGitHub(): Promise<{ hasUpdate: boolean; version?: string; releaseDate?: string; releaseNotes?: string }> {
    try {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
            headers: { 'Accept': 'application/vnd.github.v3+json' },
        });
        if (!response.ok) throw new Error(`GitHub API 返回 ${response.status}`);

        const release = await response.json() as any;
        const latestVersion = release.tag_name?.replace(/^v/, '') || '';
        const currentVersion = app.getVersion();
        const isNewer = compareVersions(latestVersion, currentVersion) > 0;

        return {
            hasUpdate: isNewer,
            version: latestVersion,
            releaseDate: release.published_at,
            releaseNotes: release.body || '',
        };
    } catch (err: any) {
        console.error('[Update] GitHub API 检查失败:', err.message);
        throw err;
    }
}

/** 注册自动更新相关的 IPC 处理器 */
export function registerUpdaterIpc(): void {
    ipcMain.handle('check-for-updates', async () => {
        try {
            sendUpdateStatus({ status: 'checking' });
            const result = await checkForUpdateViaGitHub();

            if (result.hasUpdate) {
                sendUpdateStatus({
                    status: 'available',
                    version: result.version,
                    releaseDate: result.releaseDate,
                    releaseNotes: result.releaseNotes,
                });
                return { success: true, version: result.version };
            } else {
                sendUpdateStatus({
                    status: 'not-available',
                    version: result.version,
                });
                return { success: true, version: result.version, upToDate: true };
            }
        } catch (err: any) {
            sendUpdateStatus({
                status: 'error',
                message: err?.message || '检查更新失败',
            });
            return { success: false, message: err?.message || '检查更新失败' };
        }
    });

    ipcMain.handle('download-update', async () => {
        try {
            shell.openExternal(RELEASE_URL);
            return { success: true };
        } catch (err: any) {
            return { success: false, message: err?.message || '打开下载页面失败' };
        }
    });

    ipcMain.handle('install-update', () => {
        shell.openExternal(RELEASE_URL);
    });

    ipcMain.handle('get-app-version', () => {
        return app.getVersion();
    });
}

/** 初始化自动更新检查（生产环境启动 5 秒后） */
export function initAutoUpdateCheck(): void {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    if (!isDev) {
        setTimeout(() => {
            checkForUpdateViaGitHub()
                .then(result => {
                    if (result.hasUpdate) {
                        sendUpdateStatus({
                            status: 'available',
                            version: result.version,
                            releaseDate: result.releaseDate,
                            releaseNotes: result.releaseNotes,
                        });
                    }
                })
                .catch(() => { });
        }, 5000);
    }
}
