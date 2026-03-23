
import { Type } from "@google/genai";
import { callGeminiWithRetry, PRO_MODEL, SPEED_CONFIG } from "./core";

/** AI 实验顾问建议输出结构 */
export interface AdvisorSuggestion {
  type: 'parameter' | 'methodology' | 'control' | 'safety' | 'characterization';
  title: string;
  detail: string;
  evidence: string;
  priority: 'high' | 'medium' | 'low';
}

export interface DetailedStep {
  stepNumber: number;
  title: string;
  titleEn: string;
  content: string;
  notes: string;
}

export interface AdvisorDOE {
  title: string;
  notes: string;
  matrix: { name: string; target: string; range: string }[];
  runs: { idx: number; label: string; sampleId: string; params: Record<string, string>; fullParams: { key: string; value: string; unit: string }[]; description: string; detailedSteps: DetailedStep[] }[];
}

export interface AdvisorResult {
  feasibility: {
    score: number;
    risks: string[];
    strengths: string[];
    safetyWarnings: string[];
  };
  suggestions: AdvisorSuggestion[];
  recommendedDOE: AdvisorDOE | null;
  literatureComparison: {
    summary: string;
    gaps: string[];
    advantages: string[];
  };
  iterationNote: string;
}

export interface AdvisorInput {
  proposalText: string;
  proposalPdf?: { base64: string; mimeType: string };
  literatureContext: { title: string; abstract: string; year?: number }[];
  milestoneContext: {
    title: string;
    hypothesis: string;
    logs: { content: string; parameters: string; scientificData?: Record<string, number> }[];
  } | null;
  projectTitle: string;
  previousAdvice?: string;
  userFeedback?: string;
}

/**
 * AI 实验顾问：综合分析实验方案 + 关联文献 + 节点上下文，生成结构化实验建议
 */
export const generateExperimentAdvice = async (input: AdvisorInput): Promise<AdvisorResult> => {
  return callGeminiWithRetry(async (ai) => {
    // ── 构建上下文块 ──
    const sections: string[] = [];

    sections.push(`【项目名称】${input.projectTitle}`);

    // 里程碑上下文
    if (input.milestoneContext) {
      const mc = input.milestoneContext;
      sections.push(`【当前研究节点】${mc.title}`);
      if (mc.hypothesis) sections.push(`【核心假设】${mc.hypothesis}`);
      if (mc.logs.length > 0) {
        const logSummary = mc.logs.slice(-5).map((l, i) =>
          `  ${i + 1}. ${l.content} | 参数: ${l.parameters || '无'}${l.scientificData ? ' | 数据: ' + Object.entries(l.scientificData).map(([k, v]) => `${k}=${v}`).join(', ') : ''}`
        ).join('\n');
        sections.push(`【近期实验记录 (${mc.logs.length} 条)】\n${logSummary}`);
      }
    }

    // 实验方案
    sections.push(`【用户实验方案】\n${input.proposalText}`);

    // 关联文献
    if (input.literatureContext.length > 0) {
      const litText = input.literatureContext.map((l, i) =>
        `  ${i + 1}. ${l.title}${l.year ? ` (${l.year})` : ''}\n     摘要: ${l.abstract.substring(0, 500)}`
      ).join('\n');
      sections.push(`【关联文献 (${input.literatureContext.length} 篇)】\n${litText}`);
    }

    // 多轮迭代上下文
    if (input.previousAdvice) {
      sections.push(`【上一轮 AI 建议摘要】\n${input.previousAdvice}`);
    }
    if (input.userFeedback) {
      sections.push(`【用户反馈】\n${input.userFeedback}`);
    }

    const contextBlock = sections.join('\n\n');

    const isIteration = !!(input.previousAdvice || input.userFeedback);

    const prompt = `你是一名经验丰富的科研实验顾问，同时掌握化学、材料科学、电化学等多学科知识。请综合分析以下实验方案、关联文献和项目上下文，给出专业、合乎逻辑的实验建议。

${contextBlock}

${isIteration ? '注意：这是多轮迭代优化。请重点关注用户反馈中提到的问题，在上一轮建议的基础上进行改进。' : ''}

你的任务：
1. **可行性评估 (feasibility)**：对实验方案进行 0-100 分评估，识别风险因素和优势。
2. **改进建议 (suggestions)**：提供 3-6 条具体、可操作的改进建议，每条建议需标明类型（parameter/methodology/control/safety/characterization）、优先级和文献依据。
3. **推荐实验设计 (recommendedDOE)**：基于方案和文献，设计一套优化的正交实验方案（3-6 个 run），包含关键因子、水平范围和每个 run 的详细信息。

   ⚠️ 【核心要求 — 详细实验操作协议】⚠️
   每个 run 必须生成真正可以直接交给实验员执行的**详细操作协议**，要求如下：

   A) **description** 字段：完整的实验操作流程（至少 400 字），必须像实验手册一样写出每一步的**精确参数**：
      - 所有试剂必须写明**精确质量**（如 1.587 g Zn(NO₃)₂·6H₂O）或**精确体积**（如 40 ml 无水乙醇）
      - 试剂用量必须基于**摩尔比和分子量严格计算**，不能模糊写"适量"或"少量"
      - 设备参数必须具体化：离心转速（如 10000 rpm）、搅拌时间（如 15 min）、干燥温度（如 80 ℃）、升温速率（如 5 ℃/min）
      - 后处理步骤必须写明洗涤次数、酸洗浓度、干燥方式和时间

   B) **detailedSteps** 数组：将 description 拆分为结构化步骤，每步包含：
      - stepNumber: 步骤序号
      - title: 中文步骤标题（如"乙醇基前驱体配制"）
      - titleEn: 英文步骤标题（如"Precursor Preparation"）
      - content: 该步骤的详细操作（含所有精确参数，如"将 1.587 g Zn(NO₃)₂·6H₂O、0.083 g FeCl₃·6H₂O 和 0.089 g Co(NO₃)₂·6H₂O 溶于 40 ml 无水乙醇中。加入 0.05 g 柠檬酸，剧烈搅拌 15 分钟使其充分螯合。"）
      - notes: 注意事项或科学原理说明（如"柠檬酸作为螯合剂防止 Fe³⁺ 在乙醇中提前析出"）

   C) **fullParams** 数组（至少 8 个参数）：列出所有关键实验参数，分类覆盖：
      - 试剂用量类（如 Zn(NO₃)₂·6H₂O 用量: 1.587 g）
      - 溶剂类（如 乙醇用量: 40 ml）
      - 反应条件类（如 反应温度: 25 ℃、反应时间: 24 h）
      - 后处理类（如 酸洗浓度: 0.5 M、干燥温度: 80 ℃）
      - 热处理类（如 煅烧温度: 800 ℃、升温速率: 5 ℃/min）

   📌 **精确计算示例**：
   若用户方案中 Fe/Co 摩尔比为 1:1，则需根据分子量（FeCl₃·6H₂O = 270.3 g/mol, Co(NO₃)₂·6H₂O = 291.0 g/mol）计算出精确的称量值。
   若 Zn(NO₃)₂·6H₂O 为 1.587 g（即 5.33 mmol），且方案要求 Fe 占 Zn 的某一比例，则 Fe 和 Co 的用量应基于该摩尔比精确推算。

4. **文献对照分析 (literatureComparison)**：将用户方案与关联文献进行对比，指出未覆盖的关键因素和创新之处。
${isIteration ? '5. **迭代总结 (iterationNote)**：总结本轮相比上一轮的主要改进。' : ''}

请严格按照以下 JSON 格式返回：
{
  "feasibility": {
    "score": <0-100>,
    "risks": ["风险1", "风险2"],
    "strengths": ["优势1"],
    "safetyWarnings": ["安全提示"]
  },
  "suggestions": [
    {
      "type": "parameter|methodology|control|safety|characterization",
      "title": "建议标题",
      "detail": "详细分析和推理",
      "evidence": "文献依据或科学原理",
      "priority": "high|medium|low"
    }
  ],
  "recommendedDOE": {
    "title": "推荐实验方案名称",
    "notes": "方案设计说明",
    "matrix": [{"name": "因子名", "target": "单位", "range": "范围"}],
    "runs": [
      {
        "idx": 1,
        "label": "Run 标签 (例如: FeCo-800-U2)",
        "sampleId": "样品ID (例如: S001)",
        "params": {"因子1": "值1"},
        "fullParams": [
          {"key": "Zn(NO₃)₂·6H₂O", "value": "1.587", "unit": "g"},
          {"key": "FeCl₃·6H₂O", "value": "0.083", "unit": "g"},
          {"key": "Co(NO₃)₂·6H₂O", "value": "0.089", "unit": "g"},
          {"key": "2-甲基咪唑", "value": "1.75", "unit": "g"},
          {"key": "无水乙醇(金属盐)", "value": "40", "unit": "ml"},
          {"key": "无水乙醇(配体)", "value": "20", "unit": "ml"},
          {"key": "柠檬酸", "value": "0.05", "unit": "g"},
          {"key": "尿素/ZIF质量比", "value": "2:1", "unit": ""},
          {"key": "煅烧温度", "value": "800", "unit": "℃"},
          {"key": "煅烧时间", "value": "3", "unit": "h"},
          {"key": "升温速率", "value": "5", "unit": "℃/min"},
          {"key": "酸洗H₂SO₄浓度", "value": "0.5", "unit": "M"}
        ],
        "detailedSteps": [
          {
            "stepNumber": 1,
            "title": "乙醇基前驱体配制",
            "titleEn": "Precursor Preparation",
            "content": "将 1.587 g Zn(NO₃)₂·6H₂O、0.083 g FeCl₃·6H₂O 和 0.089 g Co(NO₃)₂·6H₂O 溶于 40 ml 无水乙醇中。加入 0.05 g 柠檬酸，剧烈搅拌 15 分钟使其充分螯合。",
            "notes": "柠檬酸作为螯合剂防止 Fe³⁺ 在乙醇中提前析出"
          },
          {
            "stepNumber": 2,
            "title": "沉淀反应",
            "titleEn": "Ethanol-based Synthesis",
            "content": "称取 1.75 g 2-甲基咪唑溶于 20 ml 无水乙醇中。在剧烈搅拌下将配体溶液倒入金属盐溶液中，室温(25℃)密闭搅拌 24 小时。",
            "notes": "乙醇中成核稍慢，建议保证 16 小时以上的反应时间以确保产率"
          }
        ],
        "description": "步骤 1：乙醇基前驱体配制 (Precursor Preparation)\\n将 1.587 g Zn(NO₃)₂·6H₂O..."
      }
    ]
  },
  "literatureComparison": {
    "summary": "对比分析总结",
    "gaps": ["未覆盖的关键点"],
    "advantages": ["方案创新点"]
  },
  "iterationNote": "${isIteration ? '本轮调整总结' : ''}"
}`;

    // 构建请求 parts
    const parts: any[] = [];

    // 如果有 PDF 附件
    if (input.proposalPdf) {
      parts.push({
        inlineData: {
          mimeType: input.proposalPdf.mimeType,
          data: input.proposalPdf.base64
        }
      });
    }

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        ...SPEED_CONFIG,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            feasibility: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                risks: { type: Type.ARRAY, items: { type: Type.STRING } },
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                safetyWarnings: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ['score', 'risks', 'strengths', 'safetyWarnings']
            },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  title: { type: Type.STRING },
                  detail: { type: Type.STRING },
                  evidence: { type: Type.STRING },
                  priority: { type: Type.STRING }
                },
                required: ['type', 'title', 'detail', 'evidence', 'priority']
              }
            },
            recommendedDOE: {
              type: Type.OBJECT,
              nullable: true,
              properties: {
                title: { type: Type.STRING },
                notes: { type: Type.STRING },
                matrix: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      target: { type: Type.STRING },
                      range: { type: Type.STRING }
                    },
                    required: ['name', 'target', 'range']
                  }
                },
                runs: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      idx: { type: Type.NUMBER },
                      label: { type: Type.STRING },
                      sampleId: { type: Type.STRING },
                      params: { type: Type.OBJECT, properties: {} },
                      fullParams: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            key: { type: Type.STRING },
                            value: { type: Type.STRING },
                            unit: { type: Type.STRING }
                          },
                          required: ['key', 'value', 'unit']
                        }
                      },
                      detailedSteps: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            stepNumber: { type: Type.NUMBER },
                            title: { type: Type.STRING },
                            titleEn: { type: Type.STRING },
                            content: { type: Type.STRING },
                            notes: { type: Type.STRING }
                          },
                          required: ['stepNumber', 'title', 'titleEn', 'content', 'notes']
                        }
                      },
                      description: { type: Type.STRING }
                    },
                    required: ['idx', 'label', 'description', 'fullParams', 'detailedSteps']
                  }
                }
              },
              required: ['title', 'notes', 'matrix', 'runs']
            },
            literatureComparison: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
                advantages: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ['summary', 'gaps', 'advantages']
            },
            iterationNote: { type: Type.STRING }
          },
          required: ['feasibility', 'suggestions', 'literatureComparison', 'iterationNote']
        }
      }
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text) as AdvisorResult;

    // 确保字段完整
    return {
      feasibility: {
        score: parsed.feasibility?.score ?? 50,
        risks: parsed.feasibility?.risks || [],
        strengths: parsed.feasibility?.strengths || [],
        safetyWarnings: parsed.feasibility?.safetyWarnings || []
      },
      suggestions: (parsed.suggestions || []).map(s => ({
        type: s.type as any || 'methodology',
        title: s.title || '',
        detail: s.detail || '',
        evidence: s.evidence || '',
        priority: s.priority as any || 'medium'
      })),
      recommendedDOE: parsed.recommendedDOE || null,
      literatureComparison: {
        summary: parsed.literatureComparison?.summary || '',
        gaps: parsed.literatureComparison?.gaps || [],
        advantages: parsed.literatureComparison?.advantages || []
      },
      iterationNote: parsed.iterationNote || ''
    };
  });
};
