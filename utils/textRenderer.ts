
import katex from 'katex';

// 全局 Katex 渲染缓存，避免重复解析提升性能
const GLOBAL_KATEX_CACHE = new Map<string, string>();

/**
 * 科学文本渲染器 - 三段式 Stub 架构 (V12 标准)
 * 统一用于 预览页、编辑器预览 以及 表格设计工作台，确保显示效果高度一致。
 */
export const renderScientificText = (
    text: string,
    options: {
        activeTemplateId?: string;
        orderedCitations?: { map: Map<string, number> };
        cursorHtml?: string;
        getPureCiteKey?: (raw: string) => string;
        CITE_REGEX?: RegExp;
        figRefMap?: Map<string, number>;
    } = {}
) => {
    if (!text) return '';

    const {
        activeTemplateId = 'default',
        orderedCitations,
        cursorHtml = '',
        getPureCiteKey,
        CITE_REGEX,
        figRefMap
    } = options;

    // 1. 保护阶段 (Stubbing)
    const stubMap = new Map<string, string>();
    let stubIdx = 0;
    const addStub = (content: string) => {
        const placeholder = `@@STUB{${stubIdx++}}@@`;
        stubMap.set(placeholder, content);
        return placeholder;
    };

    // 识别复杂的 LaTeX 公式块
    let res = text.replace(/(\$\$[\s\S]*?\$$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g, addStub);

    // 保护：学术速记符 (如 $_{2}$, $^{2}$)，必须在通用公式逻辑前保护
    res = res
        .replace(/\$\s*\_\{?(.*?)\}?\s*\$/g, addStub)
        .replace(/\$\s*\^\{?(.*?)\}?\s*\$/g, addStub);

    // 现在保护剩下的行内公式 (如 $E=mc^2$)
    res = res.replace(/\$((?:[^$]|\\$)+?)\$/g, addStub);

    // 保护：引文标签 (如果有传入正则)
    if (CITE_REGEX) {
        res = res.replace(CITE_REGEX, addStub);
    }

    // 保护：图交叉引用标签 [FigRef:xxx] — 必须在化学式下标之前保护，否则 refId 中的大写字母+数字会被误匹配
    res = res.replace(/\[FigRef:[\w\d_-]+\]/gi, addStub);

    // 2. 转义处理 (安全网)
    res = res.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // 3. 增强型 Markdown 解析
    // data-md-extra 记录语法标记自身占用的原始字符数，供光标注入坐标映射使用
    res = res
        .replace(/\*\*\s*([\s\S]*?)\s*\*\*/g, '<strong data-md-extra="4">$1</strong>')
        .replace(/__\s*([\s\S]*?)\s*__/g, '<strong data-md-extra="4">$1</strong>')
        .replace(/\*\s*([\s\S]*?)\s*\*/g, '<em data-md-extra="2">$1</em>')
        .replace(/_\s*([\s\S]*?)\s*_/g, '<em data-md-extra="2">$1</em>');

    // 4. 化学式自动下标 (H2O)
    res = res.replace(/([A-Z\)])(\d+)/g, '$1<sub>$2</sub>');

    // 5. 还原与动态解析阶段
    res = res.replace(/@@STUB\{(\d+)\}@@/g, (_, id) => {
        const raw = stubMap.get(`@@STUB{${id}}@@`) || '';

        // 处理图交叉引用标签 [FigRef:xxx]
        const figRefMatch = raw.match(/^\[FigRef:([\w\d_-]+)\]$/i);
        if (figRefMatch && figRefMap && figRefMap.size > 0) {
            const num = figRefMap.get(figRefMatch[1]);
            // data-raw-len：原始标记长度，供光标注入时做坐标映射
            return num !== undefined
                ? `<span class="fig-ref" data-raw-len="${raw.length}">${num}</span>`
                : `<span class="fig-ref" data-raw-len="${raw.length}">?</span>`;
        }

        // 处理引文
        if (CITE_REGEX && raw.match(CITE_REGEX) && orderedCitations && getPureCiteKey) {
            const pure = getPureCiteKey(raw);
            const num = orderedCitations.map.get(pure);
            if (num !== undefined) {
                const isSuper = ['nature', 'science', 'jacs'].includes(activeTemplateId);
                const formatted = `[${num}]`;
                // data-raw-len：原始引用文本长度，供光标注入坐标映射
                return isSuper
                    ? `<sup class="cite-ref" data-raw-len="${raw.length}">${formatted}</sup>`
                    : `<span class="cite-ref-inline" data-raw-len="${raw.length}">${formatted}</span>`;
            }
            return raw;
        }

        // 处理学术速记符还原（$_{2}$ → <sub>，保留原始长度供光标映射）
        const subMatch = raw.match(/^\$\s*\_\{?(.*?)\}?\s*\$/);
        if (subMatch) return `<sub data-raw-len="${raw.length}">${subMatch[1]}</sub>`;
        const supMatch = raw.match(/^\$\s*\^\{?(.*?)\}?\s*\$/);
        if (supMatch) return `<sup data-raw-len="${raw.length}">${supMatch[1]}</sup>`;

        // 处理数学公式 (Katex)
        const cacheKey = `${activeTemplateId}_${raw}`;
        let rendered = GLOBAL_KATEX_CACHE.get(cacheKey);
        if (!rendered) {
            let tex = '', isBlock = false;
            if (raw.startsWith('$$')) { tex = raw.slice(2, -2); isBlock = true; }
            else if (raw.startsWith('\\[')) { tex = raw.slice(2, -2); isBlock = true; }
            else if (raw.startsWith('$')) { tex = raw.slice(1, -1); isBlock = false; }
            else if (raw.startsWith('\\(')) { tex = raw.slice(2, -2); isBlock = false; }

            if (!tex) return raw;

            try {
                rendered = katex.renderToString(tex, { displayMode: isBlock, throwOnError: false });
                GLOBAL_KATEX_CACHE.set(cacheKey, rendered);
            } catch (e) { rendered = tex; }
        }
        // data-raw-len：原始公式字符串长度，供光标注入坐标映射
        return (raw.startsWith('$$') || raw.startsWith('\\['))
            ? `<div class="math-block" data-raw-len="${raw.length}">${rendered}</div>`
            : `<span class="math-inline" data-raw-len="${raw.length}">${rendered}</span>`;
    });

    // 5.5 合并相邻引用序号：[1][2][3] → [1–3]，[1][3] → [1,3]
    if (CITE_REGEX && orderedCitations) {
        const mergeAdjacentCites = (tagName: string, className: string) => {
            // 匹配连续的 cite-ref 元素（中间可能有空白）
            const pattern = new RegExp(
                `(<${tagName} class="${className}">\\[(\\d+)\\]</${tagName}>)(\\s*<${tagName} class="${className}">\\[\\d+\\]</${tagName}>)+`,
                'g'
            );
            res = res.replace(pattern, (fullMatch) => {
                // 提取所有数字
                const numRegex = /\[(\d+)\]/g;
                const nums: number[] = [];
                let m;
                while ((m = numRegex.exec(fullMatch)) !== null) {
                    nums.push(parseInt(m[1]));
                }
                if (nums.length <= 1) return fullMatch;

                // 范围压缩：[1,2,3,5] → "1–3,5"
                const sorted = Array.from(new Set(nums)).sort((a, b) => a - b);
                const parts: string[] = [];
                let start = sorted[0], end = sorted[0];
                for (let i = 1; i <= sorted.length; i++) {
                    if (i < sorted.length && sorted[i] === end + 1) {
                        end = sorted[i];
                    } else {
                        if (end - start >= 2) parts.push(`${start}–${end}`);
                        else if (end - start === 1) parts.push(`${start},${end}`);
                        else parts.push(`${start}`);
                        if (i < sorted.length) { start = sorted[i]; end = sorted[i]; }
                    }
                }
                const merged = parts.join(',');
                return `<${tagName} class="${className}">[${merged}]</${tagName}>`;
            });
        };
        mergeAdjacentCites('sup', 'cite-ref');
        mergeAdjacentCites('span', 'cite-ref-inline');
    }

    // 6. 解析图交叉引用标签 [FigRef:xxx] -> 实际序号
    if (figRefMap && figRefMap.size > 0) {
        res = res.replace(/\[FigRef:([\w\d_-]+)\]/gi, (_, refId) => {
            const num = figRefMap.get(refId);
            return num !== undefined ? String(num) : '?';
        });
    }

    // 7. 最终清理与还原阶段
    // \n 对应原始文本中的1个字符，用 data-raw-len="1" 供光标注入正确计数
    return res
        .replace(/\n/g, '<br data-raw-len="1"/>')
        .replace(/@@SCIFLOW_CURSOR@@/g, cursorHtml);
};
