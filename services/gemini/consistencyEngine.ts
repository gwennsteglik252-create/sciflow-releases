
import { Literature, ReviewConfig, ConsistencyIssue, ConsistencyReport, ReviewOutlineNode } from "../../types";
import { callGeminiWithRetry, extractJson, safeJsonParse, PRO_MODEL, SPEED_CONFIG } from "./core";

// ═══════════════════════════════════════════════════════════════════
// 扫描 1: 术语一致性
// ═══════════════════════════════════════════════════════════════════

export const scanTerminologyConsistency = async (
    fullContent: string,
    config: ReviewConfig
): Promise<ConsistencyIssue[]> => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一位顶刊综述的 **术语一致性审核专家**。

请扫描以下综述全文，检测术语使用不一致的问题。

## 检测规则

### 1. 同义混用
- 同一概念在不同章节使用了不同术语（如 "析氧反应" vs "氧析出反应" vs "OER"）
- 对每组混用，选择最标准/最常用的表述作为统一标准

### 2. 缩写规范
- 首次出现的缩写是否有全称定义？格式应为 "全称 (缩写)"
- 后续使用是否统一使用缩写？

### 3. 符号统一
- 化学式写法是否统一（如 H2O vs H₂O）
- 单位写法是否统一（如 mA/cm² vs mA cm⁻²）
- 数字格式是否统一（如小数点 vs 逗号）

---

【综述主题】: ${config.topic}
【全文内容】:
${fullContent.substring(0, 25000)}

---

输出 JSON 数组，每项：
{
  "type": "terminology",
  "severity": "auto_fixed",
  "sectionTitle": "发现问题的章节标题",
  "original": "不一致的表述",
  "fixed": "统一后的表述",
  "description": "说明为何这样统一"
}

只检测真实存在的问题。如果全文术语完全一致，返回空数组 []。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 2048 }
            }
        });

        const raw = safeJsonParse(response.text || '[]', []);
        return (Array.isArray(raw) ? raw : []).map((i: any) => ({
            type: 'terminology' as const,
            severity: 'auto_fixed' as const,
            sectionTitle: i.sectionTitle || '',
            original: i.original || '',
            fixed: i.fixed || '',
            description: i.description || ''
        })).filter((i: ConsistencyIssue) => i.original && i.fixed);
    });
};


// ═══════════════════════════════════════════════════════════════════
// 扫描 2: 引用一致性
// ═══════════════════════════════════════════════════════════════════

export const scanCitationConsistency = async (
    fullContent: string,
    literatures: Literature[]
): Promise<ConsistencyIssue[]> => {
    return callGeminiWithRetry(async (ai) => {
        const validIds = literatures.map(l => l.id);
        const litMap = literatures.slice(0, 40).map(l =>
            `[Ref:${l.id}] ${l.title} (${l.authors?.[0] || ''}, ${l.year})`
        ).join('\n');

        const prompt = `你是一位 **引用格式审核专家**。

请检查以下综述全文中的引用问题。

## 检测规则

### 1. 无效引用标签
- [Ref:xxx] 标签中的 xxx 是否存在于下方的有效文献列表中？
- 如果不存在，标记为 needs_review

### 2. 无引用关键声称
- 包含 "研究表明"、"已证实"、"据报道"、"被广泛应用" 等措辞的句子是否有引用？
- 包含具体数据（如 "效率达到 95%"）但没有 [Ref:] 的句子

### 3. 引用格式不一致
- [Ref:xxx] 标签是否格式统一？
- 是否存在同一来源的重复引用？

---

【全文内容】:
${fullContent.substring(0, 20000)}

【有效文献列表】:
${litMap}

---

输出 JSON 数组，每项：
{
  "type": "citation",
  "severity": "auto_fixed" | "needs_review",
  "sectionTitle": "章节标题",
  "original": "有问题的句子或引用",
  "fixed": "修复后的文本 (如果是 auto_fixed)",
  "description": "问题说明"
}

仅报告确实存在的问题。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 2048 }
            }
        });

        const raw = safeJsonParse(response.text || '[]', []);
        return (Array.isArray(raw) ? raw : []).map((i: any) => ({
            type: 'citation' as const,
            severity: (['auto_fixed', 'needs_review'].includes(i.severity) ? i.severity : 'needs_review') as 'auto_fixed' | 'needs_review',
            sectionTitle: i.sectionTitle || '',
            original: i.original || '',
            fixed: i.fixed || undefined,
            description: i.description || ''
        })).filter((i: ConsistencyIssue) => i.original);
    });
};


// ═══════════════════════════════════════════════════════════════════
// 扫描 3: 冗余检测
// ═══════════════════════════════════════════════════════════════════

export const scanRedundancy = async (
    fullContent: string,
    config: ReviewConfig
): Promise<ConsistencyIssue[]> => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一位 **学术写作精炼专家**。

请检查以下综述全文是否存在冗余问题。

## 检测规则

### 1. 跨章节重复
- 不同章节中是否存在几乎相同的句子或段落？（语义相似度 ≥80%）
- 报告两个章节及重复内容

### 2. 过度重复论述
- 同一观点是否被反复表述？（换个说法但核心意思完全一样）
- 特别关注引言和结论中的冗余重复

### 3. 内容偏题
- 是否有段落的内容与其所在章节标题明显不符？
- 应该归入其他章节的内容

---

【综述主题】: ${config.topic}
【全文内容】:
${fullContent.substring(0, 25000)}

---

输出 JSON 数组，每项：
{
  "type": "redundancy",
  "severity": "needs_review",
  "sectionTitle": "发现问题的章节",
  "original": "冗余的原始内容（截取关键句）",
  "description": "冗余说明：与哪个章节重复 / 为什么是冗余 / 建议删除还是合并"
}

只报告真正影响阅读体验的冗余。轻微的主题呼应不算冗余，返回空数组 []。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 2048 }
            }
        });

        const raw = safeJsonParse(response.text || '[]', []);
        return (Array.isArray(raw) ? raw : []).map((i: any) => ({
            type: 'redundancy' as const,
            severity: 'needs_review' as const,
            sectionTitle: i.sectionTitle || '',
            original: i.original || '',
            description: i.description || ''
        })).filter((i: ConsistencyIssue) => i.original);
    });
};


// ═══════════════════════════════════════════════════════════════════
// 自动修复应用器
// ═══════════════════════════════════════════════════════════════════

export const applyConsistencyFixes = (
    sections: Record<string, string>,
    fixes: ConsistencyIssue[]
): Record<string, string> => {
    const autoFixes = fixes.filter(f => f.severity === 'auto_fixed' && f.original && f.fixed);
    if (autoFixes.length === 0) return sections;

    const updated = { ...sections };
    for (const sectionId of Object.keys(updated)) {
        let content = updated[sectionId];
        for (const fix of autoFixes) {
            // 全局替换（只替换精确匹配）
            if (content.includes(fix.original)) {
                content = content.split(fix.original).join(fix.fixed!);
            }
        }
        updated[sectionId] = content;
    }
    return updated;
};


// ═══════════════════════════════════════════════════════════════════
// 总调度器: 一致性引擎完整扫描
// ═══════════════════════════════════════════════════════════════════

export const runFullConsistencyScan = async (
    fullContent: string,
    config: ReviewConfig,
    literatures: Literature[],
    onProgress?: (msg: string, progress: number) => void
): Promise<{ report: ConsistencyReport; fixes: ConsistencyIssue[] }> => {

    const allIssues: ConsistencyIssue[] = [];

    // 1. 术语扫描
    onProgress?.('术语一致性扫描中...', 10);
    try {
        const termIssues = await scanTerminologyConsistency(fullContent, config);
        allIssues.push(...termIssues);
    } catch (err) {
        console.warn('[ConsistencyEngine] 术语扫描失败:', err);
    }

    // 2. 引用扫描
    onProgress?.('引用一致性扫描中...', 40);
    try {
        const citIssues = await scanCitationConsistency(fullContent, literatures);
        allIssues.push(...citIssues);
    } catch (err) {
        console.warn('[ConsistencyEngine] 引用扫描失败:', err);
    }

    // 3. 冗余扫描
    onProgress?.('冗余检测扫描中...', 70);
    try {
        const redIssues = await scanRedundancy(fullContent, config);
        allIssues.push(...redIssues);
    } catch (err) {
        console.warn('[ConsistencyEngine] 冗余扫描失败:', err);
    }

    const report: ConsistencyReport = {
        terminologyFixes: allIssues.filter(i => i.type === 'terminology').length,
        citationFixes: allIssues.filter(i => i.type === 'citation').length,
        redundancyFlags: allIssues.filter(i => i.type === 'redundancy').length,
        issues: allIssues,
        timestamp: new Date().toISOString()
    };

    return { report, fixes: allIssues.filter(i => i.severity === 'auto_fixed') };
};
