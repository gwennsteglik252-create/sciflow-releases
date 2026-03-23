/**
 * licenseService.ts — 前端授权状态管理
 *
 * 与 Electron 主进程通信获取/更新授权状态。
 * 在 Web 环境（开发模式无 Electron）中默认放行。
 */

export interface LicenseState {
    status: 'trial' | 'activated' | 'expired';
    trialStartDate?: string;
    trialDaysRemaining?: number;
    activationCode?: string;
    activatedAt?: string;
    machineId?: string;
}

const electron = (window as any).electron;

/** 是否运行在 Electron 环境中 */
export const isElectronEnv = (): boolean => {
    return !!electron?.getLicenseState;
};

/** 获取当前授权状态 */
export const getLicenseState = async (): Promise<LicenseState> => {
    if (!isElectronEnv()) {
        // Web 开发模式下，默认给予激活状态
        return { status: 'activated', machineId: 'web-dev' };
    }
    try {
        return await electron.getLicenseState();
    } catch {
        return { status: 'trial', trialDaysRemaining: 14 };
    }
};

/** 激活许可证 */
export const activateLicense = async (code: string): Promise<{ success: boolean; error?: string }> => {
    if (!isElectronEnv()) {
        return { success: true };
    }
    try {
        return await electron.activateLicense(code);
    } catch (err: any) {
        return { success: false, error: err?.message || '激活失败' };
    }
};

/** 重置试用期（仅开发模式） */
export const resetTrial = async (): Promise<{ success: boolean }> => {
    if (!isElectronEnv()) return { success: true };
    try {
        return await electron.resetTrial();
    } catch {
        return { success: false };
    }
};
