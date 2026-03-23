/**
 * Knowledge Pool AI Service — 知识沉淀池 AI 聚合引擎
 * 负责：参数归一化、跨文献聚合、差距分析
 */
import { Type } from "@google/genai";
import { Literature, BenchmarkEntry, BenchmarkDataPoint, MaterialSystemRow, GapAnalysisItem, KnowledgePool, NormalizationMapping } from "../../types";
import { callGeminiWithRetry, extractJson, FAST_MODEL, PRO_MODEL, SPEED_CONFIG } from "./core";

/**
 * Step 1: AI 参数归一化 — 将多篇文献的 performance 指标统一归类
 * 解决 "半波电位" vs "E₁/₂" vs "Half-wave Potential" 的同义指标问题
 */
export const normalizeMetricLabels = async (
  allMetrics: { literatureId: string; label: string; value: string }[]
): Promise<NormalizationMapping[]> => {
  return callGeminiWithRetry(async (ai) => {
    const uniqueLabels = [...new Set(allMetrics.map(m => m.label))];

    const prompt = `你是一名资深科研数据标准化专家。请对以下${uniqueLabels.length}个来自不同文献的性能指标标签进行归一化处理。

【原始标签列表】：
${uniqueLabels.map((l, i) => `${i + 1}. "${l}"`).join('\n')}

【任务要求】：
1. **同义指标识别**：将含义相同但表述不同的指标归为同一个 normalizedLabel。
   - 例如："半波电位"、"E₁/₂"、"Half-wave potential"、"半波电位 (E₁/₂)" → "half_wave_potential"
   - 例如："Onset Potential"、"起始电位" → "onset_potential"
   - 例如："最大功率密度"、"Peak Power Density"、"Pmax" → "max_power_density"
2. **统一单位提取**：从标签含义推断标准单位。
3. **生成友好显示名**：生成中文+英文的显示名称。
4. **置信度评估**：你对此归一化映射的确信程度 (0-1)。

输出 JSON 数组。`;

    const response = await ai.models.generateContent({
      model: FAST_MODEL,
      contents: prompt,
      config: {
        ...SPEED_CONFIG,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              originalLabel: { type: Type.STRING },
              normalizedLabel: { type: Type.STRING },
              displayLabel: { type: Type.STRING },
              unit: { type: Type.STRING },
              confidence: { type: Type.NUMBER }
            },
            required: ["originalLabel", "normalizedLabel", "displayLabel", "unit", "confidence"]
          }
        }
      }
    });

    return JSON.parse(extractJson(response.text || '[]'));
  });
};

/**
 * Step 2: 聚合知识沉淀池 — 从文献列表中构建完整的对比矩阵数据
 */
export const aggregateKnowledgePool = async (
  projectId: string,
  projectTitle: string,
  resources: Literature[],
  targetMetrics?: { label: string; value: string; unit?: string }[]
): Promise<KnowledgePool> => {
  // 1. 收集所有文献中的 performance 指标
  const allMetrics: { literatureId: string; literatureTitle: string; label: string; value: string; year: number; authors?: string[] }[] = [];

  resources.forEach(r => {
    if (r.performance && r.performance.length > 0) {
      r.performance.forEach(p => {
        allMetrics.push({
          literatureId: r.id,
          literatureTitle: r.title,
          label: p.label,
          value: p.value,
          year: r.year,
          authors: r.authors
        });
      });
    }
  });

  if (allMetrics.length === 0) {
    return {
      projectId,
      lastUpdated: new Date().toISOString(),
      totalLiteratureSources: resources.length,
      benchmarks: [],
      materialSystems: []
    };
  }

  // 2. AI 归一化标签
  let mappings: NormalizationMapping[] = [];
  try {
    mappings = await normalizeMetricLabels(allMetrics);
  } catch (e) {
    console.warn('[KnowledgePool] 归一化失败，使用原始标签:', e);
  }

  // 3. AI 构建完整的对比矩阵
  return callGeminiWithRetry(async (ai) => {
    const prompt = `你是一名顶级材料科学对标分析专家。请分析以下文献性能数据，构建一个结构化的跨文献对比矩阵。

【项目背景】：${projectTitle}
${targetMetrics && targetMetrics.length > 0 ? `【本项目目标指标】：\n${targetMetrics.map(m => `- ${m.label}: ${m.value} ${m.unit || ''}`).join('\n')}` : ''}

【已收集的文献性能数据】(共 ${resources.length} 篇文献, ${allMetrics.length} 个原始指标)：
${JSON.stringify(allMetrics.slice(0, 200), null, 0)}

${mappings.length > 0 ? `【AI 归一化映射】：\n${JSON.stringify(mappings, null, 0)}` : ''}

【任务要求】：
1. **构建 benchmarks 数组**：
   - 每个 benchmark 代表一个标准化的性能指标（如"半波电位"）
   - 聚合来自多篇文献的同类数据
   - 每个 dataPoint 要包含：来源文献、材料体系名称、数值、原始字符串
   - 数值 (value) 必须是 **纯数字**，从原始字符串中解析
   - 设置 isHigherBetter：性能值越高越好的为 true
   - 设置 category：electrochemical / structural / stability / cost

2. **构建 materialSystems 数组**：
   - 提取所有出现的材料体系名称（如 Fe-SA/PNC, EFE-N3/PCF）
   - 标注其来源文献

3. **生成 aiSummary**：一段 100 字的中文总结，概述当前技术竞争格局

输出 JSON 格式。`;

    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      contents: prompt,
      config: {
        ...SPEED_CONFIG,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            benchmarks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  metricId: { type: Type.STRING },
                  normalizedName: { type: Type.STRING },
                  displayName: { type: Type.STRING },
                  unit: { type: Type.STRING },
                  condition: { type: Type.STRING },
                  category: { type: Type.STRING },
                  isHigherBetter: { type: Type.BOOLEAN },
                  dataPoints: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        literatureId: { type: Type.STRING },
                        literatureTitle: { type: Type.STRING },
                        materialSystem: { type: Type.STRING },
                        value: { type: Type.NUMBER },
                        rawValue: { type: Type.STRING },
                        year: { type: Type.NUMBER },
                        confidence: { type: Type.NUMBER }
                      },
                      required: ["literatureId", "literatureTitle", "materialSystem", "value", "rawValue", "year", "confidence"]
                    }
                  }
                },
                required: ["metricId", "normalizedName", "displayName", "unit", "category", "isHigherBetter", "dataPoints"]
              }
            },
            materialSystems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  literatureId: { type: Type.STRING },
                  isOurs: { type: Type.BOOLEAN },
                  year: { type: Type.NUMBER },
                  source: { type: Type.STRING }
                },
                required: ["id", "name", "isOurs"]
              }
            },
            aiSummary: { type: Type.STRING }
          },
          required: ["benchmarks", "materialSystems", "aiSummary"]
        }
      }
    });

    const result = JSON.parse(extractJson(response.text || '{}'));

    return {
      projectId,
      lastUpdated: new Date().toISOString(),
      totalLiteratureSources: resources.length,
      benchmarks: result.benchmarks || [],
      materialSystems: result.materialSystems || [],
      aiSummary: result.aiSummary
    } as KnowledgePool;
  });
};

/**
 * Step 3: 竞品差距分析 — 分析本项目相对于文献基准的优劣势
 */
export const generateGapAnalysis = async (
  pool: KnowledgePool,
  targetMetrics?: { label: string; value: string; unit?: string }[]
): Promise<GapAnalysisItem[]> => {
  if (!targetMetrics || targetMetrics.length === 0) return [];
  if (pool.benchmarks.length === 0) return [];

  return callGeminiWithRetry(async (ai) => {
    const prompt = `你是一名科研竞争力分析师。请分析本项目目标指标与文献 benchmark 之间的差距。

【本项目目标指标】：
${targetMetrics.map(m => `- ${m.label}: ${m.value} ${m.unit || ''}`).join('\n')}

【文献 Benchmark 数据】：
${JSON.stringify(pool.benchmarks.map(b => ({
  name: b.displayName,
  unit: b.unit,
  isHigherBetter: b.isHigherBetter,
  best: Math.max(...b.dataPoints.map(d => d.value)),
  worst: Math.min(...b.dataPoints.map(d => d.value)),
  avg: b.dataPoints.reduce((s, d) => s + d.value, 0) / b.dataPoints.length,
  bestMaterial: b.dataPoints.reduce((best, d) => d.value > best.value ? d : best, b.dataPoints[0])
})))}

【任务要求】：
为每个本项目指标生成差距分析：
1. 与文献最佳值的差距百分比
2. 在所有文献中的百分位排名
3. 状态判定：leading(领先) / competitive(竞争力强) / lagging(落后) / no_data(无对标数据)
4. 针对性建议（30字以内）

输出 JSON 数组。`;

    const response = await ai.models.generateContent({
      model: FAST_MODEL,
      contents: prompt,
      config: {
        ...SPEED_CONFIG,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              metricName: { type: Type.STRING },
              ourValue: { type: Type.NUMBER },
              ourUnit: { type: Type.STRING },
              bestValue: { type: Type.NUMBER },
              bestMaterial: { type: Type.STRING },
              bestLiterature: { type: Type.STRING },
              percentile: { type: Type.NUMBER },
              gap: { type: Type.NUMBER },
              status: { type: Type.STRING },
              suggestion: { type: Type.STRING }
            },
            required: ["metricName", "bestValue", "bestMaterial", "bestLiterature", "percentile", "gap", "status"]
          }
        }
      }
    });

    return JSON.parse(extractJson(response.text || '[]'));
  });
};
