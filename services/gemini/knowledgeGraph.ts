
import { Literature, KnowledgeQuadruple, ReviewKnowledgeGraph } from "../../types";
import { callGeminiWithRetry, extractJson, PRO_MODEL, SPEED_CONFIG } from "./core";

// ═══════════════════════════════════════════════════════════════════
// 四元组提取：从单篇文献提取 <方法, 材料, 结果, 条件>
// ═══════════════════════════════════════════════════════════════════

export const extractQuadruplesFromLiterature = async (
    literature: Literature
): Promise<KnowledgeQuadruple[]> => {
    // 构建文献上下文
    const perfStr = (literature.performance || [])
        .map(p => `${p.label}: ${p.value}`)
        .join('\n');
    const stepsStr = (literature.synthesisSteps || [])
        .map(s => `Step ${s.step}: ${s.title} — ${s.content}`)
        .join('\n');

    const context = [
        `标题: ${literature.title}`,
        literature.englishTitle ? `英文标题: ${literature.englishTitle}` : '',
        `作者: ${literature.authors?.join(', ') || '未知'}`,
        `期刊: ${literature.source}`,
        `年份: ${literature.year}`,
        `摘要: ${literature.abstract || '无'}`,
        perfStr ? `\n性能指标:\n${perfStr}` : '',
        stepsStr ? `\n工艺步骤:\n${stepsStr}` : '',
    ].filter(Boolean).join('\n');

    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名资深的科研知识工程师，专门从学术文献中提取结构化的 **知识四元组**。

## 任务说明

从以下文献信息中提取所有可识别的 **<方法(Method), 材料(Material), 结果(Result), 条件(Condition)>** 四元组。

每个四元组代表一个独立的实验观察 / 测试结果 / 合成路线。

## 提取规则

1. **Method (方法)**：实验技术或合成方法名称
   - 示例: "水热法合成", "线性扫描伏安法 (LSV)", "XRD 表征", "密度泛函理论 (DFT) 计算"
   
2. **Material (材料)**：被研究的材料体系的精确化学组成或简称
   - 示例: "NiFe-LDH/NF", "Pt/C (20 wt%)", "g-C₃N₄", "MoS₂ 纳米片"
   
3. **Result (结果)**：量化的实验结果或性能指标，必须包含数值和单位
   - 示例: "过电位 230 mV @ 10 mA cm⁻²", "BET 比表面积 156.3 m² g⁻¹", "循环 1000 圈后容量保持率 95.2%"
   
4. **Condition (条件)**：实验条件和参数
   - 示例: "0.1 M KOH, 25°C, 扫描速率 5 mV/s", "N₂ 气氛, 800°C 煅烧 2h", "室温, 1 sun 光照"

## 质量要求

- 每个四元组的四个字段都必须填写，不允许留空
- Result 必须包含量化数据（数字 + 单位），不接受定性描述
- 宁可少提取几条高质量的，也不要凑数量出低质量的
- confidence 评分: 直接从原文数据提取 → 0.9+; 从摘要推断 → 0.7-0.9; 间接推理 → 0.5-0.7

## 文献信息

${context.substring(0, 12000)}

## 输出格式

输出 JSON 数组，每项包含:
{
  "method": "方法名称",
  "material": "材料体系",
  "result": "量化结果 (含数值和单位)",
  "condition": "实验条件",
  "confidence": 0.0-1.0,
  "category": "electrochemistry|catalysis|synthesis|characterization|computation|other"
}

如果文献信息不足以提取任何高质量四元组，返回空数组 []。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 2048 }
            }
        });

        const raw = JSON.parse(extractJson(response.text || '[]'));
        const arr = Array.isArray(raw) ? raw : [];

        return arr
            .filter((q: any) => q.method && q.material && q.result && q.condition)
            .map((q: any, idx: number) => ({
                id: `${literature.id}_q${idx}`,
                method: String(q.method || ''),
                material: String(q.material || ''),
                result: String(q.result || ''),
                condition: String(q.condition || ''),
                sourceLiteratureId: literature.id,
                sourceLiteratureTitle: literature.title,
                confidence: Math.min(1, Math.max(0, Number(q.confidence) || 0.7)),
                category: q.category || 'other'
            }));
    });
};


// ═══════════════════════════════════════════════════════════════════
// 批量提取 + 汇聚知识图谱
// ═══════════════════════════════════════════════════════════════════

export const buildKnowledgeGraphFromLiteratures = async (
    literatures: Literature[],
    onProgress?: (current: number, total: number, litTitle: string) => void,
    abortSignal?: { current: boolean }
): Promise<ReviewKnowledgeGraph> => {
    const allQuadruples: KnowledgeQuadruple[] = [];

    for (let i = 0; i < literatures.length; i++) {
        if (abortSignal?.current) break;

        const lit = literatures[i];
        onProgress?.(i + 1, literatures.length, lit.title);

        try {
            const quads = await extractQuadruplesFromLiterature(lit);
            allQuadruples.push(...quads);
        } catch (err) {
            console.warn(`[KnowledgeGraph] 四元组提取失败: ${lit.id}`, err);
        }
    }

    return {
        quadruples: allQuadruples,
        lastUpdated: new Date().toISOString(),
        totalSources: literatures.length
    };
};


// ═══════════════════════════════════════════════════════════════════
// 知识图谱查询工具
// ═══════════════════════════════════════════════════════════════════

export type QueryDimension = 'method' | 'material' | 'condition' | 'category';

export interface KnowledgeGraphQueryResult {
    matchedQuadruples: KnowledgeQuadruple[];
    uniqueMethods: string[];
    uniqueMaterials: string[];
    uniqueConditions: string[];
}

export const queryKnowledgeGraph = (
    graph: ReviewKnowledgeGraph,
    query: string,
    dimension?: QueryDimension
): KnowledgeGraphQueryResult => {
    const lowerQ = query.toLowerCase().trim();
    if (!lowerQ) {
        return {
            matchedQuadruples: graph.quadruples,
            uniqueMethods: [...new Set(graph.quadruples.map(q => q.method))],
            uniqueMaterials: [...new Set(graph.quadruples.map(q => q.material))],
            uniqueConditions: [...new Set(graph.quadruples.map(q => q.condition))]
        };
    }

    const matchField = (value: string) => value.toLowerCase().includes(lowerQ);

    const matched = graph.quadruples.filter(q => {
        if (dimension) {
            return matchField(q[dimension] || '');
        }
        // 全维度搜索
        return matchField(q.method) || matchField(q.material) ||
               matchField(q.result) || matchField(q.condition);
    });

    return {
        matchedQuadruples: matched,
        uniqueMethods: [...new Set(matched.map(q => q.method))],
        uniqueMaterials: [...new Set(matched.map(q => q.material))],
        uniqueConditions: [...new Set(matched.map(q => q.condition))]
    };
};
