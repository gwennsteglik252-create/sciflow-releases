// ═══ SciFlow Pro — AI 分析: xrd ═══

import { Type } from "@google/genai";
import { callGeminiWithRetry, extractJson, FAST_MODEL, PRO_MODEL, SPEED_CONFIG } from "../core";

/**
 * AI 检索标准 XRD 物相数据 — COD 优先 + AI 回退
 *
 * 策略：
 * 1. 先用 AI 将用户输入格式化为 Hill Notation 化学式
 * 2. 查询 COD（Crystallography Open Database）真实数据库
 * 3. COD 无结果时回退到 AI 生成（temperature=0 确保一致性）
 */
export const searchXrdPhases = async (query: string) => {
    // ═══ Step 1: 尝试 COD 真实数据库 ═══
    try {
        const { searchCOD } = await import('../../cod');

        // 用 AI 快速格式化化学式为 Hill Notation（COD 要求）
        let hillFormula: string | undefined;
        try {
            const formatResult = await callGeminiWithRetry(async (ai) => {
                const resp = await ai.models.generateContent({
                    model: FAST_MODEL,
                    contents: `将以下材料名称/化学式转换为 Hill Notation 格式（碳优先，再氢，其余字母序，元素间用空格分隔）。
仅输出 Hill Notation 字符串，不要其他内容。如果无法识别，输出 "UNKNOWN"。

输入: "${query}"

示例:
- TiO2 → O2 Ti
- NaCl → Cl Na
- Fe2O3 → Fe2 O3
- 锐钛矿 → O2 Ti
- Anatase → O2 Ti`,
                    config: { temperature: 0, topK: 1, topP: 0.1 }
                });
                return (resp.text || '').trim();
            });
            if (formatResult && formatResult !== 'UNKNOWN' && formatResult.length < 50) {
                hillFormula = formatResult;
            }
        } catch (e) {
            console.warn('[XRD Search] Hill formula formatting failed, using text search only:', e);
        }

        const codResult = await searchCOD(query, hillFormula);

        if (codResult.phases && codResult.phases.length > 0) {
            console.log(`[XRD Search] COD returned ${codResult.phases.length} phases for "${query}"`);
            return codResult;
        }
    } catch (e) {
        console.warn('[XRD Search] COD search failed, falling back to AI:', e);
    }

    // ═══ Step 2: AI 回退（temperature=0 确保一致性）═══
    console.log(`[XRD Search] COD no results for "${query}", falling back to AI generation`);
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一台全球化学与物理材料数据库索引引擎。
目标材料/化学式: "${query}"

请根据该关键词检索最匹配的国际标准 XRD 物相数据（如 PDF 卡片数据）。
注意：同一种材料可能存在不同的晶体结构（多晶型/Polymorphs，如 TiO2 的锐钛矿和金红石），请尽可能提供所有常见结构的卡片。

输出严格的 JSON 格式:
{
  "phases": [
    {
      "name": "物相名称 (需包含晶型，例如: TiO2 - Anatase)",
      "card": "卡片号 (例如: PDF#21-1272)",
      "crystalSystem": "晶系 (例如: Tetragonal)",
      "spaceGroup": "空间群 (例如: I41/amd)",
      "latticeParams": "晶格参数简述 (例如: a=3.785, c=9.514 Å)",
      "source": "AI",
      "peaks": [
        { "twoTheta": number, "intensity": number, "dSpacing": number, "hkl": "(101)" }
      ]
    }
  ]
}

要求：
1. 提供该材料常见的所有晶体结构（最多 5 个）。
2. 每个物相提供 5-8 个特征衍射峰，必须使用真实已知的标准数据。
3. 强度 (intensity) 范围为 1-100。
4. dSpacing 以 nm 为单位 (基于 Cu Kα, λ=0.15406 nm)。
5. hkl 为密勒指数，用括号表示 (例如: "(101)")。
6. source 字段固定填 "AI"。
7. 卡片号请使用真实存在的 PDF/JCPDS 卡片号。`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: { temperature: 0, topK: 1, topP: 0.1, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{"phases":[]}'));
    });
};

/**
 * 根据实验记录上下文生成 XRD 深度分析与参考卡片建议
 */
export const generateContextualXrdAnalysis = async (
    projectTitle: string,
    logContext: {
        content: string;
        description?: string;
        parameters?: string;
        scientificData?: Record<string, number>;
    },
    xrdContext: {
        datasetName: string;
        peakSummary: Array<{ twoTheta: number; intensity: number; label?: string }>;
        matchedPhases?: string[];
    }
) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名材料表征专家，请基于实验记录上下文和 XRD 结果给出可执行分析。

项目：${projectTitle}

实验记录：
- 标题/内容：${logContext.content || 'N/A'}
- 说明：${logContext.description || 'N/A'}
- 参数：${logContext.parameters || 'N/A'}
- 关键指标：${JSON.stringify(logContext.scientificData || {})}

XRD 当前信息：
- 数据集：${xrdContext.datasetName}
- 峰摘要：${JSON.stringify(xrdContext.peakSummary || [])}
- 已匹配物相：${JSON.stringify(xrdContext.matchedPhases || [])}

请输出严格 JSON，字段含义如下：
- summary: 对当前样品物相状态的总判断（2-3 句）
- keyFindings: 3-5 条关键发现
- suggestedPhaseQueries: 3-5 个建议检索的物相关键词（用于继续搜 PDF 卡片）
- cardAdjustmentAdvice: 3-5 条“调卡片”建议（例如应关注的峰位窗口、可疑杂相、优先对比晶型）
- riskFlags: 2-4 条风险提醒（如峰重叠、择优取向、背景未扣净）
- nextActions: 2-4 条下一步实验建议（要具体，可执行）`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        keyFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
                        suggestedPhaseQueries: { type: Type.ARRAY, items: { type: Type.STRING } },
                        cardAdjustmentAdvice: { type: Type.ARRAY, items: { type: Type.STRING } },
                        riskFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
                        nextActions: { type: Type.ARRAY, items: { type: Type.STRING } },
                        anomalousPeaks: {
                            type: Type.ARRAY, items: {
                                type: Type.OBJECT,
                                properties: {
                                    twoTheta: { type: Type.NUMBER },
                                    diagnosis: { type: Type.STRING },
                                    explanation: { type: Type.STRING }
                                }
                            }
                        }
                    },
                    required: ['summary']
                }
            }
        });
        const parsed = JSON.parse(extractJson(response.text || '{}'));
        return {
            summary: parsed.summary || '',
            keyFindings: parsed.keyFindings || [],
            suggestedPhaseQueries: parsed.suggestedPhaseQueries || [],
            cardAdjustmentAdvice: parsed.cardAdjustmentAdvice || [],
            riskFlags: parsed.riskFlags || [],
            nextActions: parsed.nextActions || [],
            anomalousPeaks: parsed.anomalousPeaks || []
        };
    });
};

/**
 * 基于匹配卡片的 XRD 二次深度分析
 * 在用户匹配参考物相卡片后，结合实验峰数据+卡片数据+上下文进行更精准的分析
 */
export const generatePostMatchXrdAnalysis = async (
    projectTitle: string,
    logContext: {
        content: string;
        description?: string;
        parameters?: string;
    } | null,
    xrdContext: {
        datasetName: string;
        peaks: Array<{ twoTheta: number; intensity: number; d?: string; size?: string; label?: string }>;
    },
    matchedCards: Array<{
        groupName: string;
        phases: Array<{
            name: string;
            card: string;
            crystalSystem?: string;
            spaceGroup?: string;
            latticeParams?: string;
            peaks?: Array<{ twoTheta: number; intensity: number; hkl?: string }>;
        }>;
    }>
) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名资深 XRD 物相分析专家。用户已完成初步分析并匹配了参考物相 PDF 卡片。
请基于实验峰位数据和已匹配卡片进行深度对比分析。**所有回复内容必须使用中文。**

项目：${projectTitle}

${logContext ? `实验记录上下文：
- 内容：${logContext.content || 'N/A'}
- 说明：${logContext.description || 'N/A'}
- 参数：${logContext.parameters || 'N/A'}` : '（未关联实验记录）'}

XRD 实验数据：
- 数据集：${xrdContext.datasetName}
- 检测峰（2θ, I%）：${JSON.stringify(xrdContext.peaks.map(p => ({ '2θ': p.twoTheta, I: p.intensity, d: p.d, size: p.size, label: p.label })))}

已匹配参考卡片：
${matchedCards.map(g => `[${g.groupName}]
${g.phases.map(p => `  - ${p.name} (${p.card}) ${p.crystalSystem || ''} ${p.spaceGroup || ''}
    晶格参数: ${p.latticeParams || 'N/A'}
    参考峰: ${JSON.stringify((p.peaks || []).slice(0, 6).map(pk => ({ '2θ': pk.twoTheta, I: pk.intensity, hkl: pk.hkl })))}`).join('\n')}`).join('\n')}

请执行以下分析并输出 JSON（所有文本字段必须使用中文）：

1. **matchSummary**: 总体匹配质量评估（2-3句中文，说明物相鉴定是否可靠）
2. **phaseComposition**: 定性/半定量物相组成分析 [{ phaseName, estimatedFraction, confidence, evidence }]（中文描述）
3. **peakShiftAnalysis**: 峰位偏移分析 [{ experimentalTheta, referenceTheta, referenceName, shiftDeg, possibleCause }]（possibleCause 用中文，只列出偏移>0.1°的峰）
4. **unmatchedPeaks**: 未被任何卡片归属的实验峰 [{ twoTheta, intensity, possibleOrigin }]（possibleOrigin 用中文）
5. **crystallographicInsights**: 晶体学深度洞察（择优取向、晶粒效应、微应变等，中文）[string]
6. **synthesisAssessment**: 合成质量评估（目标相纯度、副产物评估、工艺优化方向，中文）
7. **publicationSentence**: 可直接用于论文中 XRD 结果与讨论部分的 1-2 句中文学术表述
8. **nextExperiments**: 基于匹配结果推荐的后续表征实验（中文）[string]`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        matchSummary: { type: Type.STRING },
                        phaseComposition: {
                            type: Type.ARRAY, items: {
                                type: Type.OBJECT,
                                properties: {
                                    phaseName: { type: Type.STRING },
                                    estimatedFraction: { type: Type.STRING },
                                    confidence: { type: Type.STRING },
                                    evidence: { type: Type.STRING },
                                }
                            }
                        },
                        peakShiftAnalysis: {
                            type: Type.ARRAY, items: {
                                type: Type.OBJECT,
                                properties: {
                                    experimentalTheta: { type: Type.NUMBER },
                                    referenceTheta: { type: Type.NUMBER },
                                    referenceName: { type: Type.STRING },
                                    shiftDeg: { type: Type.NUMBER },
                                    possibleCause: { type: Type.STRING },
                                }
                            }
                        },
                        unmatchedPeaks: {
                            type: Type.ARRAY, items: {
                                type: Type.OBJECT,
                                properties: {
                                    twoTheta: { type: Type.NUMBER },
                                    intensity: { type: Type.NUMBER },
                                    possibleOrigin: { type: Type.STRING },
                                }
                            }
                        },
                        crystallographicInsights: { type: Type.ARRAY, items: { type: Type.STRING } },
                        synthesisAssessment: { type: Type.STRING },
                        publicationSentence: { type: Type.STRING },
                        nextExperiments: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ['matchSummary']
                }
            }
        });
        const parsed = JSON.parse(extractJson(response.text || '{}'));
        return {
            matchSummary: parsed.matchSummary || '',
            phaseComposition: parsed.phaseComposition || [],
            peakShiftAnalysis: parsed.peakShiftAnalysis || [],
            unmatchedPeaks: parsed.unmatchedPeaks || [],
            crystallographicInsights: parsed.crystallographicInsights || [],
            synthesisAssessment: parsed.synthesisAssessment || '',
            publicationSentence: parsed.publicationSentence || '',
            nextExperiments: parsed.nextExperiments || [],
        };
    });
};

/**
 * 根据实验记录上下文生成 BET/BJH 深度分析
 */
export const generateContextualPorosityAnalysis = async (
    projectTitle: string,
    logContext: {
        content: string;
        description?: string;
        parameters?: string;
        scientificData?: Record<string, number>;
    },
    porosityContext: {
        sampleName: string;
        ssa: number;
        poreVolume: number;
        avgPoreSize: number;
        cConstant: number;
        r2: number;
        iupacType: string;
        hysteresisType: string;
        psdPeakNm?: number | null;
        fitRange: { min: number; max: number };
        bjhParams?: { thicknessModel: string; branchMode: string };
    }
) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名材料孔结构表征专家，请基于实验记录上下文和 BET/BJH 结果给出可执行分析。

项目：${projectTitle}

实验记录：
- 标题/内容：${logContext.content || 'N/A'}
- 说明：${logContext.description || 'N/A'}
- 参数：${logContext.parameters || 'N/A'}
- 关键指标：${JSON.stringify(logContext.scientificData || {})}

BET/BJH 当前信息：
- 样品：${porosityContext.sampleName}
- SSA：${porosityContext.ssa} m²/g
- 总孔容：${porosityContext.poreVolume} cm³/g
- 平均孔径：${porosityContext.avgPoreSize} nm
- C 常数：${porosityContext.cConstant}
- BET R²：${porosityContext.r2}
- IUPAC 类型：${porosityContext.iupacType}
- 回滞环类型：${porosityContext.hysteresisType}
- PSD 峰位：${porosityContext.psdPeakNm ?? 'N/A'} nm
- 拟合区间：${porosityContext.fitRange.min}-${porosityContext.fitRange.max}
- BJH 参数：${JSON.stringify(porosityContext.bjhParams || {})}

请输出严格 JSON：
- summary: 2-3 句总判断
- keyFindings: 3-5 条关键发现
- mechanismHints: 2-4 条机理关联线索（结合实验记录参数）
- riskFlags: 2-4 条风险提醒（如拟合区间偏置、孔径分布假峰、样品活化不足）
- nextActions: 2-4 条可执行建议（明确实验动作）
- publicationSentence: 1-2 句可直接用于论文结果讨论的表述`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING },
                        keyFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
                        mechanismHints: { type: Type.ARRAY, items: { type: Type.STRING } },
                        riskFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
                        nextActions: { type: Type.ARRAY, items: { type: Type.STRING } },
                        publicationSentence: { type: Type.STRING }
                    },
                    required: ['summary']
                }
            }
        });
        const parsed = JSON.parse(extractJson(response.text || '{}'));
        return {
            summary: parsed.summary || '',
            keyFindings: parsed.keyFindings || [],
            mechanismHints: parsed.mechanismHints || [],
            riskFlags: parsed.riskFlags || [],
            nextActions: parsed.nextActions || [],
            publicationSentence: parsed.publicationSentence || ''
        };
    });
};

/**
 * Phase 4.2: 生成发表级英文 XRD 图注
 */
export const generatePublicationCaption = async (
    context: {
        sampleName: string;
        peaks: Array<{ twoTheta: number; intensity: number; hkl?: string }>;
        matchedPhases: Array<{ name: string; card: string; crystalSystem?: string; spaceGroup?: string; latticeParams?: string }>;
        grainSize?: number;
        strain?: number;
        wavelength?: string;
    }
) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `You are an expert scientific writer. Generate a publication-quality figure caption for an XRD pattern.

Context:
- Sample: ${context.sampleName}
- Wavelength: ${context.wavelength || 'Cu Kα (λ=1.5406 Å)'}
- Number of peaks detected: ${context.peaks.length}
- Matched phases: ${JSON.stringify(context.matchedPhases.map(p => ({ name: p.name, card: p.card, crystal: p.crystalSystem, spaceGroup: p.spaceGroup, lattice: p.latticeParams })))}
${context.grainSize ? `- Average crystallite size (Scherrer/W-H): ${context.grainSize.toFixed(1)} nm` : ''}
${context.strain ? `- Microstrain (W-H): ${context.strain.toExponential(2)}` : ''}

Requirements:
1. Write in formal academic English suitable for a peer-reviewed journal.
2. Include the PDF card number(s), crystal system, space group, and lattice parameters if available.
3. Mention crystallite size and microstrain if provided.
4. Keep it to 2-3 sentences maximum.
5. Start with "Figure X." (leave X for the user to fill in).
6. Output ONLY the caption text, nothing else.`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } }
        });
        return response.text || '';
    });
};

/**
 * 物相演变追踪：分析多条实验记录中的物相变化趋势
 * 适用于系列实验（如不同温度/时间/掺杂比的 XRD 对比）
 */
export const analyzePhaseEvolution = async (
    context: {
        projectTitle: string;
        /** 各实验节点的数据（按条件排列） */
        dataPoints: Array<{
            label: string;           // 实验条件标签 (如 "500°C / 2h")
            logContent?: string;     // 实验记录内容
            peaks: Array<{ twoTheta: number; intensity: number; label?: string }>;
            matchedPhases?: string[];
        }>;
    }
) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名材料物相分析专家。现有一组实验序列的 XRD 数据，请分析物相演变规律。

项目：${context.projectTitle}

实验序列（共 ${context.dataPoints.length} 个条件）：
${context.dataPoints.map((dp, i) => `
--- 条件 ${i + 1}: ${dp.label} ---
实验记录: ${dp.logContent?.slice(0, 200) || 'N/A'}
检测到的峰 (2θ, I): ${JSON.stringify(dp.peaks.slice(0, 8).map(p => ({ '2θ': p.twoTheta, I: p.intensity })))}
已匹配物相: ${JSON.stringify(dp.matchedPhases || [])}
`).join('\n')}

请输出严格的 JSON，含以下字段：
- evolutionSummary: 总体物相演变趋势（2-4 句）
- phaseTransitions: 检测到的物相转变事件列表 [{ fromPhase, toPhase, condition, evidence }]
- trendAnalysis: 各物相含量随条件变化的定性趋势 [{ phaseName, trend: "increasing"|"decreasing"|"stable"|"appears"|"disappears", notes }]
- criticalPoints: 关键转折点 [{ condition, event, significance }]
- recommendations: 基于演变规律的下一步建议 [string]`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        evolutionSummary: { type: Type.STRING },
                        phaseTransitions: {
                            type: Type.ARRAY, items: {
                                type: Type.OBJECT,
                                properties: {
                                    fromPhase: { type: Type.STRING },
                                    toPhase: { type: Type.STRING },
                                    condition: { type: Type.STRING },
                                    evidence: { type: Type.STRING },
                                }
                            }
                        },
                        trendAnalysis: {
                            type: Type.ARRAY, items: {
                                type: Type.OBJECT,
                                properties: {
                                    phaseName: { type: Type.STRING },
                                    trend: { type: Type.STRING },
                                    notes: { type: Type.STRING },
                                }
                            }
                        },
                        criticalPoints: {
                            type: Type.ARRAY, items: {
                                type: Type.OBJECT,
                                properties: {
                                    condition: { type: Type.STRING },
                                    event: { type: Type.STRING },
                                    significance: { type: Type.STRING },
                                }
                            }
                        },
                        recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ['evolutionSummary']
                }
            }
        });

        const parsed = JSON.parse(extractJson(response.text || '{}'));
        return {
            evolutionSummary: parsed.evolutionSummary || '',
            phaseTransitions: parsed.phaseTransitions || [],
            trendAnalysis: parsed.trendAnalysis || [],
            criticalPoints: parsed.criticalPoints || [],
            recommendations: parsed.recommendations || [],
        };
    });
};

/**
 * 多数据组 XRD 综合对比分析
 * 关联各数据组的实验记录，结构化提取并对比实验参数差异，
 * 分析参数变化对物相组成、晶体结构的影响
 */
export const analyzeMultiDatasetXrd = async (
    projectTitle: string,
    datasets: Array<{
        datasetName: string;
        linkedLogTitle?: string;
        rawParameters?: Record<string, any> | string;
        content?: string;
        description?: string;
        peaks: Array<{ twoTheta: number; intensity: number; label?: string }>;
        matchedPhases?: string[];
    }>
) => {
    return callGeminiWithRetry(async (ai) => {
        // 构建参数差异矩阵
        const allParamKeys = new Set<string>();
        const paramMatrix: Array<Record<string, string>> = [];
        datasets.forEach(ds => {
            const params: Record<string, string> = {};
            if (ds.rawParameters && typeof ds.rawParameters === 'object') {
                Object.entries(ds.rawParameters).forEach(([k, v]) => {
                    if (v !== null && v !== undefined && v !== '') {
                        allParamKeys.add(k);
                        params[k] = String(v);
                    }
                });
            }
            paramMatrix.push(params);
        });

        // 找出在各组间有差异的参数
        const varyingParams: string[] = [];
        const constantParams: string[] = [];
        allParamKeys.forEach(key => {
            const values = paramMatrix.map(p => p[key] || '').filter(Boolean);
            const unique = new Set(values);
            if (unique.size > 1) {
                varyingParams.push(key);
            } else if (values.length > 0) {
                constantParams.push(key);
            }
        });

        const paramDiffSection = varyingParams.length > 0
            ? `\n【参数差异矩阵（以下参数在各组之间存在差异）】\n${varyingParams.map(key =>
                `- ${key}: ${datasets.map((ds, i) =>
                    `组${i + 1}(${ds.datasetName})=${paramMatrix[i][key] || 'N/A'}`
                ).join(' | ')}`
            ).join('\n')}\n\n${constantParams.length > 0 ? `【不变参数】\n${constantParams.map(key => `- ${key}: ${paramMatrix.find(p => p[key])?.[key] || ''}`).join('\n')}` : ''}`
            : '（未检测到结构化参数差异，请基于实验记录正文内容推断可能的差异）';

        const prompt = `你是一名材料结构-工艺参数关联分析专家。现有 ${datasets.length} 组 XRD 数据，它们来自同一课题的不同实验条件。
请分析各组之间的参数设定差异，以及这些差异如何影响 XRD 物相结果。

项目：${projectTitle}

${datasets.map((ds, i) => `
--- 数据组 ${i + 1}: ${ds.datasetName} ---
关联实验记录: ${ds.linkedLogTitle || '未关联'}
实验内容: ${(ds.content || '').slice(0, 300) || 'N/A'}
实验描述: ${(ds.description || '').slice(0, 200) || 'N/A'}
参数: ${ds.rawParameters ? (typeof ds.rawParameters === 'string' ? ds.rawParameters : JSON.stringify(ds.rawParameters)) : 'N/A'}
检测到的峰 (2θ, I): ${JSON.stringify(ds.peaks.slice(0, 8).map(p => ({ '2θ': p.twoTheta, I: p.intensity, label: p.label })))}
已匹配物相: ${JSON.stringify(ds.matchedPhases || [])}
`).join('\n')}

${paramDiffSection}

请执行以下分析并输出 JSON（所有文本必须使用中文）：

1. **comparativeSummary**: 跨组综合对比结论（3-5 句），必须明确指出关键参数变化与物相变化的对应关系
2. **parameterEffects**: 各关键参数变化对物相的影响 [{ parameter: 参数名, valueRange: 变化范围描述, observedEffect: 在XRD中的具体体现（峰位/峰强/新相出现等）, confidence: 高/中/低 }]
3. **keyDifferences**: 各组间最显著的 XRD 特征差异（3-5条），每条必须引用具体2θ值或物相名
4. **processingInsights**: 工艺参数与晶体结构的关联洞察（3-5条），联系材料科学原理
5. **recommendations**: 基于对比分析的下一步实验建议（2-4条），要具体可执行`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        comparativeSummary: { type: Type.STRING },
                        parameterEffects: {
                            type: Type.ARRAY, items: {
                                type: Type.OBJECT,
                                properties: {
                                    parameter: { type: Type.STRING },
                                    valueRange: { type: Type.STRING },
                                    observedEffect: { type: Type.STRING },
                                    confidence: { type: Type.STRING },
                                }
                            }
                        },
                        keyDifferences: { type: Type.ARRAY, items: { type: Type.STRING } },
                        processingInsights: { type: Type.ARRAY, items: { type: Type.STRING } },
                        recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ['comparativeSummary']
                }
            }
        });
        const parsed = JSON.parse(extractJson(response.text || '{}'));
        return {
            comparativeSummary: parsed.comparativeSummary || '',
            parameterEffects: parsed.parameterEffects || [],
            keyDifferences: parsed.keyDifferences || [],
            processingInsights: parsed.processingInsights || [],
            recommendations: parsed.recommendations || [],
        };
    });
};
