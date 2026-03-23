// ═══ SciFlow Pro — AI 工具函数 ═══

export const stableStringify = (input: any): string => {
    const normalize = (value: any): any => {
        if (Array.isArray(value)) return value.map(normalize);
        if (value && typeof value === 'object') {
            return Object.keys(value).sort().reduce((acc: any, key) => {
                acc[key] = normalize(value[key]);
                return acc;
            }, {});
        }
        return value;
    };
    return JSON.stringify(normalize(input));
};

export const hashString = (str: string): string => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return (h >>> 0).toString(16);
};

export const extractJson = (text: string) => {
    if (!text) return "{}";
    try {
        let cleanText = text.trim();
        // 1. 清除 BOM 字符和 NUL 控制字符
        cleanText = cleanText.replace(/^\uFEFF/, '').replace(/\u0000/g, '');
        // 2. 清除可能的 <think>...</think> 思考标记
        cleanText = cleanText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        // 3. 剥除可能的 markdown 代码块标记
        cleanText = cleanText.replace(/^```(json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        // 4. 清除其他不可见控制字符 (保留换行和tab)
        cleanText = cleanText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

        // 查找第一个合法的 JSON 起始符
        const startBrace = cleanText.indexOf('{');
        const startBracket = cleanText.indexOf('[');

        let start = -1;
        let isArray = false;

        if (startBrace !== -1 && startBracket !== -1) {
            start = Math.min(startBrace, startBracket);
            isArray = start === startBracket;
        } else if (startBrace !== -1) {
            start = startBrace;
        } else if (startBracket !== -1) {
            start = startBracket;
            isArray = true;
        }

        if (start === -1) return "{}";

        // 从后往前找对应的结束符
        const endChar = isArray ? ']' : '}';
        const end = cleanText.lastIndexOf(endChar);

        if (end === -1 || end < start) return isArray ? "[]" : "{}";

        return cleanText.substring(start, end + 1);
    } catch (e) {
        console.error("JSON Extraction Failed", e);
        return "{}";
    }
};

/**
 * 安全的 JSON 解析：解析失败时返回默认值而不是抛出异常
 */
export const safeJsonParse = <T = any>(text: string, fallback: T): T => {
    try {
        const extracted = extractJson(text);
        return JSON.parse(extracted);
    } catch (e) {
        console.warn('[safeJsonParse] JSON 解析失败，使用默认值。原始文本前200字符:', text?.substring(0, 200));
        return fallback;
    }
};

/**
 * 全局 Gemini API Key 读取入口。
 * 只读取用户在设置页填写的 Key（存入 localStorage）。
 * 不再使用环境变量。
 */
export const getGeminiApiKey = (): string => {
    try {
        const raw = localStorage.getItem('sciflow_app_settings');
        const settings = raw ? JSON.parse(raw) : {};
        return settings?.geminiConfig?.apiKey?.trim() || '';
    } catch {
        return '';
    }
};
