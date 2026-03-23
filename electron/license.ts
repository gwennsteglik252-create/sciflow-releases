// ═══ electron/license.ts — 授权系统 ═══

import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const LICENSE_SECRET = 'SciFlowPro2026-LXJ-SecretKey-HMAC';
const TRIAL_DAYS = 14;

/** 获取授权数据文件路径 */
function getLicenseFilePath(): string {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'license.json');
}

/** 生成设备指纹（基于用户名+平台+应用路径的哈希） */
export function getMachineId(): string {
    const raw = `${process.platform}-${require('os').hostname()}-${require('os').userInfo().username}-SciFlowPro`;
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16);
}

/** 授权数据（持久化到磁盘的 JSON 结构） */
export interface LicenseData {
    status: 'trial' | 'activated' | 'expired';
    trialStartDate?: string;
    activationCode?: string;
    activatedAt?: string;
    machineId?: string;
}

/** 授权状态（运行时计算结果） */
export interface LicenseState {
    status: 'trial' | 'activated' | 'expired';
    trialStartDate?: string;
    trialDaysRemaining?: number;
    activationCode?: string;
    activatedAt?: string;
    machineId: string;
}

/** 读取授权文件 */
export function readLicenseData(): LicenseData | null {
    const filePath = getLicenseFilePath();
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
    } catch { /* ignore */ }
    return null;
}

/** 写入授权文件 */
export function writeLicenseData(data: LicenseData): void {
    const filePath = getLicenseFilePath();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/** 验证激活码（离线 HMAC-SHA256 校验） */
export function verifyActivationCode(code: string): boolean {
    const cleaned = code.trim().toUpperCase();
    if (!/^SCIFLOW-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleaned)) {
        return false;
    }
    const parts = cleaned.replace('SCIFLOW-', '').split('-');
    const dataPart = parts.slice(0, 3).join('');
    const checkPart = parts[3];
    const hmac = crypto.createHmac('sha256', LICENSE_SECRET).update(dataPart).digest('hex').toUpperCase();
    const expectedCheck = hmac.substring(0, 4);
    return checkPart === expectedCheck;
}

/** 获取完整的授权状态 */
export function getLicenseState(): LicenseState {
    const machineId = getMachineId();
    const data = readLicenseData();

    if (data?.status === 'activated' && data?.activationCode) {
        return {
            status: 'activated',
            activationCode: data.activationCode,
            activatedAt: data.activatedAt,
            machineId,
        };
    }

    let trialStartDate = data?.trialStartDate;
    if (!trialStartDate) {
        trialStartDate = new Date().toISOString();
        writeLicenseData({ status: 'trial', trialStartDate, machineId });
    }

    const startDate = new Date(trialStartDate);
    const now = new Date();
    const diffMs = now.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const remaining = Math.max(0, TRIAL_DAYS - diffDays);

    if (remaining <= 0) {
        return { status: 'expired', trialStartDate, trialDaysRemaining: 0, machineId };
    }

    return { status: 'trial', trialStartDate, trialDaysRemaining: remaining, machineId };
}
