// ═══ SciFlow Pro — i18n Translation Hook ═══

import { useCallback } from 'react';
import { useProjectContext } from '../context/ProjectContext';
import zh from './zh';
import en from './en';
import type { TranslationKeys } from './zh';

const locales: Record<string, TranslationKeys> = { zh, en };

/**
 * 按点分路径深度访问嵌套对象
 * 例如 getByPath(obj, 'settings.ai.hybridEngine') → obj.settings.ai.hybridEngine
 */
function getByPath(obj: any, path: string): string {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current === undefined || current === null) return path;
        current = current[key];
    }
    return typeof current === 'string' ? current : path;
}

/**
 * useTranslation — 一个轻量级的 i18n hook
 * 
 * 用法:
 *   const { t, lang } = useTranslation();
 *   t('sidebar.dashboard')        // → '研究看板' (zh) / 'Dashboard' (en)
 *   t('settings.system.trialDaysRemaining', { days: 10 })  // → '剩余 10 天 · 14天免费试用'
 */
export function useTranslation() {
    const { appSettings } = useProjectContext();
    const lang = appSettings.uiLanguage || 'zh';
    const dictionary = locales[lang] || locales.zh;

    const t = useCallback((key: string, params?: Record<string, string | number>): string => {
        let value = getByPath(dictionary, key);

        // 参数插值: {days} → 实际值
        if (params) {
            Object.entries(params).forEach(([k, v]) => {
                value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
            });
        }

        return value;
    }, [dictionary]);

    return { t, lang };
}

export default useTranslation;
