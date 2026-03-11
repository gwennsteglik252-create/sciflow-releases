
import { Type } from "@google/genai";
import { callGeminiWithRetry, extractJson, FAST_MODEL, PRO_MODEL, GROUNDING_MODEL, SPEED_CONFIG } from "./core";
import { LabInfo, PatentRisk, Landscape, ResearchGap } from "../../types";

/**
 * Stage 2: Global Landscape Scanning
 *
 * ⚠️ Gemini API 硬性限制：googleSearch 工具 与 responseSchema/responseMimeType:"application/json" 互斥，
 *    必须分两次独立调用，不能合并在同一个请求里。
 *
 * Phase 1 (独立 callGeminiWithRetry)：仅使用 googleSearch 获取真实网络情报原文
 * Phase 2 (独立 callGeminiWithRetry)：仅使用 responseSchema 将原文提炼为结构化 JSON
 */
export const scanGlobalLandscape = async (title: string, keywords: string[], topicType: 'frontier' | 'mature' = 'frontier') => {
    const now = new Date();
    const currentDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    const currentYear = now.getFullYear();

    // ── Phase 1：独立调用，仅 googleSearch grounding，不加 responseSchema ──
    let rawIntelligence = '';
    let groundingChunks: any[] = [];

    try {
        const groundingResult = await callGeminiWithRetry(async (ai) => {
            const groundingPrompt = `当前日期：${currentDate}。请搜索并整理关于课题 "${title}" 的全球最新学术情报（优先 ${currentYear} 年），并标注信息来源。
要求：
1. **重点聚焦国内动态**：搜索结果中，中国的研究实验室/研究组必须占绝大多数（约 70-80%），仅包含少量（20-30%）具有全球影响力的顶级国外课题组。
2. 所有内容必须使用中文。
3. 全球活跃的前 10 个研究实验室/研究组，必须明确：机构名（中国机构优先）、实验室名称、负责人 PI、在该课题的具体突破性贡献。
4. **链接精确性要求**：对于每个研究组，源链接（sourceUrl）必须指向该研究组针对本课题的**具体研究成果、论文、新闻报道或实验室突破公告页面**。严禁仅提供大学或机构的官方主页链接。
5. 近两年相关专利布局、技术陷阱、潜在壁垒风险及其对应的来源链接（至少 5 项，重点关注中国专利）。
6. ${topicType === 'frontier' ? '该领域目前尚未被充分研究的 3-5 个核心空白方向（Research Gaps）。' : '该领域 3-5 个核心技术壁垒与工艺改进空间（Industrial Barriers）。'}
7. 商业化/产业化现状（${currentYear}年）、市场规模预测及其权威报道来源。
请务必利用 Google Search 插件获取实时的网络信息，生成的报告必须内容充实，避免空洞。`;

            return await ai.models.generateContent({
                model: GROUNDING_MODEL,
                contents: groundingPrompt,
                config: {
                    ...SPEED_CONFIG,
                    tools: [{ googleSearch: {} }],
                }
            });
        });

        rawIntelligence = groundingResult.text || '';
        groundingChunks = groundingResult.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        console.log('[Inception] Phase 1 grounding text length:', rawIntelligence.length);
        console.log('[Inception] Phase 1 grounding sources:', groundingChunks.length);
    } catch (e) {
        console.error('[Inception] Phase 1 googleSearch failed. Aborting to ensure source accuracy:', e);
        throw new Error('无法获取实时学术情报，请检查 API Key 权限或网络环境（已禁用非源数据退避以确保准确性）。');
    }

    // ── Phase 2：独立调用，仅 responseSchema 结构化，不加 googleSearch ──
    const extractionResult = await callGeminiWithRetry(async (ai) => {
        const sourceContext = groundingChunks.map((c, i) => `[ID ${i}] ${c.web?.title || 'Link'}: ${c.web?.uri}`).join('\n');

        const extractionPrompt = rawIntelligence.length > 100
            ? `你是一个学术情报提取引擎。任务是根据原文生成符合 JSON Schema 的情报。
规则：
1. 仅输出 JSON 字符串，禁止任何自然语言对话。
2. 所有提取的内容必须使用中文。
3. **中国课题组优先**：提取至少 8 个研究组，其中 6 个以上应为中国机构。必须含负责人 PI 及其具体贡献。
4. **源链接匹配规则**：activeLabs 的 sourceUrl 必须且只能指向该课题组在该课题的具体研究方案、成果或报道链接（即 Phase 1 中找到的特定页面）。**禁止使用通用的大学/机构主页（如 www.tsinghua.edu.cn）作为来源链接。**
5. 5 个专利风险点、${topicType === 'frontier' ? '3-5 个深度研究缺口' : '3-5 个工艺优化/产业缺口'}、12 个研究趋势点。
6. 每个描述字段必须详尽（50字以上），且在 sourceUrl 字段中填入最相关的 [ID i] 对应的完整 URL。
7. 确保 JSON 绝对合法，符合 schema。

Source List:
${sourceContext}

情报原文（来自网络搜索，${currentDate}）：
${rawIntelligence.substring(0, 4000)}`
            : `当前日期：${currentDate}。针对研究课题 "${title}"，基于你的训练数据生成一份详尽的科技版图 JSON 分析。
要求：必须使用中文。重点生成中国研究组（占比 70% 以上）。研究组链接必须指向其具体成果。8+ 研究组（带负责人及贡献）、5+ 风险点、3-5 个深层缺口、12 个热度方向点。`;

        return await ai.models.generateContent({
            model: PRO_MODEL,
            contents: extractionPrompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        activeLabs: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING, description: "Research group or lab name" },
                                    leader: { type: Type.STRING, description: "Principal Investigator or leader name" },
                                    contribution: { type: Type.STRING, description: "Specific research contribution or work content" },
                                    sourceUrl: { type: Type.STRING }
                                },
                                required: ["name", "leader", "contribution"]
                            }
                        },
                        commercialStatus: {
                            type: Type.OBJECT,
                            properties: {
                                content: { type: Type.STRING },
                                sourceUrl: { type: Type.STRING }
                            },
                            required: ["content"]
                        },
                        patentRisks: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    description: { type: Type.STRING },
                                    sourceUrl: { type: Type.STRING }
                                },
                                required: ["description"]
                            }
                        },
                        researchGaps: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    content: { type: Type.STRING },
                                    sourceUrl: { type: Type.STRING },
                                    urgency: { type: Type.STRING, enum: ["low", "medium", "high"] }
                                },
                                required: ["content"]
                            },
                            description: "List of 3-5 key scientific research gaps"
                        },
                        hotnessData: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    topic: { type: Type.STRING },
                                    x: { type: Type.NUMBER },
                                    y: { type: Type.NUMBER },
                                    val: { type: Type.NUMBER },
                                    isBlueOcean: { type: Type.BOOLEAN },
                                    sourceUrl: { type: Type.STRING }
                                },
                                required: ['topic', 'x', 'y', 'val', 'isBlueOcean']
                            }
                        }
                    },
                    required: ["activeLabs", "researchGaps", "hotnessData", "commercialStatus", "patentRisks"]
                }
            }
        });
    });

    try {
        const rawText = extractionResult.text || '{}';
        let result: any;

        try {
            // 尝试直接解析
            result = JSON.parse(rawText);
        } catch (parseErr) {
            console.warn('[Inception] Direct JSON parse failed, attempting fuzzy extraction...');
            const fuzzyText = extractJson(rawText);
            try {
                result = JSON.parse(fuzzyText);
            } catch (fuzzyErr) {
                console.error('[Inception] Phase 2 parse error:', fuzzyErr, rawText.substring(0, 500));
                // 强制通过错误向上抛出给 UI 处理，不再静默失败
                throw new Error('AI Output is invalid JSON: ' + String(fuzzyErr));
            }
        }
        console.log('[Inception] Phase 2 structured result:', result);

        // ── 字段名标准化：AI 可能忽略 schema 字段名，用描述性名称（如 top_active_labs_2026）存数据 ──
        // 从所有可能的字段名变体中提取真实数据
        // 将任意值转为可读字符串
        const toReadableString = (v: any, depth = 0): string => {
            if (!v) return '';
            if (typeof v === 'string') return v.trim();
            if (typeof v === 'number') return String(v);
            if (Array.isArray(v)) return v.map(x => toReadableString(x, depth + 1)).filter(Boolean).join('；');
            if (typeof v === 'object' && depth < 3) {
                const textFields = ['description', 'summary', 'content', 'text', 'details', 'status',
                    'gap', 'title', 'name', 'application', 'barrier', 'risk', 'trend_shift', 'institution'];
                for (const f of textFields) {
                    if (typeof v[f] === 'string' && v[f].trim()) return v[f].trim();
                }
                const parts = Object.values(v)
                    .map(x => toReadableString(x, depth + 1))
                    .filter(s => s.length > 2);
                if (parts.length > 0) return parts.join('，');
            }
            return '';
        };

        const allKeys = Object.keys(result);

        // 模糊关键词扫描：针对不同类型的数据采用不同的拾取逻辑
        const resolveSource = (url: string | undefined): string | undefined => {
            if (!url) return undefined;
            if (url.startsWith('http')) return url;
            const match = url.match(/\[ID\s*(\d+)\]/i);
            if (match) {
                const idx = parseInt(match[1]);
                return groundingChunks[idx]?.web?.uri;
            }
            return undefined;
        };

        const fuzzyPickLab = (keywords: string[]): LabInfo[] => {
            for (const k of allKeys) {
                if (!keywords.some(kw => k.toLowerCase().includes(kw.toLowerCase()))) continue;
                const v = result[k];
                if (Array.isArray(v)) {
                    return v.map((item: any) => {
                        if (typeof item === 'string') {
                            const match = item.match(/(.+)\s*[（(](.+)[）)]/);
                            return {
                                name: match ? match[1].trim() : item,
                                leader: match ? match[2].trim() : '未知负责人',
                                contribution: '见研究背景'
                            };
                        }
                        return {
                            name: item.name || item.institution || item.lab || toReadableString(item),
                            leader: item.leader || item.pi || item.head || '负责人见来源',
                            contribution: item.contribution || item.work || item.breakthrough || '见该实验室相关研报',
                            sourceUrl: resolveSource(item.sourceUrl || item.link || item.url)
                        };
                    }).filter(l => l.name);
                }
            }
            return [];
        };

        const fuzzyPickRisk = (keywords: string[]): PatentRisk[] => {
            for (const k of allKeys) {
                if (!keywords.some(kw => k.toLowerCase().includes(kw.toLowerCase()))) continue;
                const v = result[k];
                if (Array.isArray(v)) {
                    return v.map((item: any) => {
                        if (typeof item === 'string') return { description: item };
                        return {
                            description: item.description || item.risk || item.barrier || toReadableString(item),
                            sourceUrl: resolveSource(item.sourceUrl || item.link || item.url)
                        };
                    }).filter(r => r.description);
                }
            }
            return [];
        };

        const fuzzyPickObjectInfo = (keywords: string[], defaultProp: string): { content: string; sourceUrl?: string } => {
            for (const k of allKeys) {
                if (!keywords.some(kw => k.toLowerCase().includes(kw.toLowerCase()))) continue;
                const v = result[k];
                if (typeof v === 'string') return { content: v };
                if (v && typeof v === 'object') {
                    return {
                        content: v.content || v.description || v[defaultProp] || toReadableString(v) || '暂无描述',
                        sourceUrl: resolveSource(v.sourceUrl || v.link || v.url)
                    };
                }
            }
            return { content: '暂无数据' };
        };

        const fuzzyPickHotness = (keywords: string[]): any[] => {
            for (const k of allKeys) {
                if (!keywords.some(kw => k.toLowerCase().includes(kw.toLowerCase()))) continue;
                const v = result[k];
                if (!Array.isArray(v) || v.length === 0) continue;

                return v.slice(0, 12).map((item: any, idx: number) => {
                    const topic = typeof item === 'string' ? item :
                        (item?.topic || item?.name || item?.trend || item?.area || item?.theme || toReadableString(item));
                    return {
                        topic: topic || `研究方向 ${idx + 1}`,
                        x: item?.x ?? item?.innovation ?? (45 + idx * 8),
                        y: item?.y ?? item?.competition ?? (75 - idx * 8),
                        val: item?.val ?? item?.hotness ?? item?.score ?? (80 - idx * 5),
                        isBlueOcean: item?.isBlueOcean ?? item?.blue_ocean ?? idx >= 4,
                        sourceUrl: resolveSource(item?.sourceUrl || item?.link || item?.url)
                    };
                });
            }
            return [];
        };

        const fuzzyPickGaps = (keywords: string[]): ResearchGap[] => {
            for (const k of allKeys) {
                if (!keywords.some(kw => k.toLowerCase().includes(kw.toLowerCase()))) continue;
                const v = result[k];
                if (Array.isArray(v)) {
                    return v.map((item: any) => {
                        if (typeof item === 'string') return { content: item, urgency: 'medium' as const };
                        const urg = item.urgency;
                        return {
                            content: item.content || item.gap || item.description || toReadableString(item),
                            sourceUrl: resolveSource(item.sourceUrl || item.link || item.url),
                            urgency: (urg === 'high' || urg === 'low' || urg === 'medium' ? urg : 'medium') as any
                        };
                    }).filter(g => g.content);
                }
            }
            return [];
        };

        // 使用关键词模糊匹配：映射到标准化的 Landscape 字段
        result.activeLabs = fuzzyPickLab(['lab', 'entit', 'group', 'institut', 'researcher', 'active', 'research_org', 'top_research', '实验室', '研究组', '机构', '团队']);
        result.patentRisks = fuzzyPickRisk(['patent', 'risk', 'barrier', 'ip_', 'intellectual', 'prior_art', '专利', '风险', '壁垒', '技术陷阱']);
        result.commercialStatus = fuzzyPickObjectInfo(['commerci', 'market', 'industry', 'industry_status', 'application_status', '产业', '商业', '市场', '应用现状'], 'status');
        result.researchGaps = fuzzyPickGaps(['gap', 'unresolved', 'opportunity', 'missing', 'future', 'strategic', '缺口', '课题', '挑战', '空白']);
        result.hotnessData = fuzzyPickHotness(['topic', 'trend', 'hot', 'hotspot', 'research_area', 'direction', 'focus', '方向', '趋势', '热点', '点位']);

        // 降级策略：如果热力数据仍为空，扫全部数组字段，取最大的一个
        if (result.hotnessData.length === 0) {
            let bestArr: any[] = [];
            for (const k of allKeys) {
                const v = result[k];
                if (Array.isArray(v) && v.length > bestArr.length && k !== 'sources') {
                    bestArr = v;
                }
            }
            if (bestArr.length > 0) {
                result.hotnessData = bestArr.slice(0, 6).map((item: any, idx: number) => ({
                    topic: typeof item === 'string' ? item :
                        (item?.topic || item?.name || item?.trend || item?.area || item?.theme || item?.title || toReadableString(item) || `研究方向 ${idx + 1}`),
                    x: item?.x ?? item?.innovation ?? (45 + idx * 8),
                    y: item?.y ?? item?.competition ?? (75 - idx * 8),
                    val: item?.val ?? item?.hotness ?? item?.score ?? (80 - idx * 5),
                    isBlueOcean: item?.isBlueOcean ?? item?.blue_ocean ?? idx >= 4
                }));
            }
        }

        console.log('[Inception] Normalized fields:', {
            activeLabs: result.activeLabs.length,
            patentRisks: result.patentRisks.length,
            commercialStatus: result.commercialStatus?.content?.substring?.(0, 80),
            researchGaps: result.researchGaps.length,
            hotnessData: result.hotnessData.length
        });

        // 附加 grounding 来源链接
        if (groundingChunks.length > 0) {
            result.sources = groundingChunks
                .map((c: any) => c.web?.uri).filter(Boolean).slice(0, 10);
        }
        return result;
    } catch (e) {
        console.error('[Inception] Phase 2 parse error:', e, extractionResult.text);
        return { activeLabs: [], commercialStatus: '解析异常，请重试', patentRisks: [], researchGaps: [], hotnessData: [] };
    }
};

/**
 * Stage 1: Advanced Brainstorming
 */
export const brainstormTopicsEnhanced = async (domain: string) => {
    return callGeminiWithRetry(async (ai) => {
        const now = new Date();
        const currentDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
        const currentYear = now.getFullYear();
        const prompt = `当前日期：${currentDate}。
请基于 ${currentYear} 年最新学术动向，为研究领域 "${domain}" 策划 4 个具有顶刊发表潜力或重大产业影响力的课题。
要求：
1. 每个课题必须紧贴 ${currentYear} 年的研究热点。要求包含 2 个前沿探索类（Frontier Exploration，TRL 1-2）和 2 个产业化/商业化成熟类（Industrial/Commercial Mature，TRL 3+）。
2. 聚焦当前（${currentYear}年）领域内的核心痛点与技术瓶颈。
3. 每个课题需包含：title（课题名）、type（"frontier" 或 "mature"）、hypothesis（科学假设）、painPoint（当前核心痛点）、evolution（${currentYear}年前后的演进轨迹）、impact（预期学术贡献或产业价值）、estimatedTrl（技术成熟度 1-5）。
仅输出 JSON 数组。`;
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                thinkingConfig: { thinkingBudget: 1024 },
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            type: { type: Type.STRING, enum: ["frontier", "mature"] },
                            hypothesis: { type: Type.STRING },
                            painPoint: { type: Type.STRING },
                            evolution: { type: Type.STRING },
                            impact: { type: Type.STRING },
                            estimatedTrl: { type: Type.NUMBER },
                        },
                        required: ['title', 'type', 'hypothesis', 'painPoint', 'evolution', 'impact', 'estimatedTrl']
                    }
                }
            }
        });
        try {
            const raw = extractJson(response.text || '[]');
            const parsed = JSON.parse(raw);
            console.log('[Inception] brainstorm result:', parsed);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            const wrapper = parsed?.topics || parsed?.suggestions || parsed?.results || parsed?.data;
            if (Array.isArray(wrapper) && wrapper.length > 0) return wrapper;
            return [];
        } catch (e) {
            console.error('[Inception] brainstorm parse error', e, response.text);
            return [];
        }
    });
};

/**
 * Stage 2.5: Blueprint Planning - AI-generated Detailed Research Blueprint
 */
export const generateBlueprint = async (topic: any, landscape: any) => {
    return callGeminiWithRetry(async (ai) => {
        const now = new Date();
        const currentDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
        const currentYear = now.getFullYear();

        const topicType = topic?.type || 'frontier';
        const gaps = landscape?.researchGaps?.slice(0, 3).map((g: any) => (typeof g === 'string' ? g : g?.content)).join('；') || '';
        const topLabs = landscape?.activeLabs?.slice(0, 3).map((l: any) => l?.name).join('、') || '';

        const prompt = `当前日期：${currentDate}。你是一名资深研究规划专家，请为以下课题生成一份极其详尽、专业的研究蓝图规划方案。

课题名称：${topic?.title}
课题类型：${topicType === 'frontier' ? '前沿探索' : '产业化成熟'}
核心科学假设：${topic?.hypothesis}
攻关痛点：${topic?.painPoint}
预期贡献：${topic?.impact}
已识别研究缺口：${gaps}
主要竞争课题组：${topLabs}

请从研究总监视角, 生成一份包含以下所有维度的完整 JSON 蓝图，所有字段必须用中文填写，且每个字段不少于 50 字描述：

1. researchPhases: 4-5个研究阶段，每个阶段包含：
   - phaseId（如 P1, P2...）
   - title（阶段名称）
   - duration（预计时长，如 "第1-6月"）
   - objective（阶段目标，100字以上）
   - keyActivities（3-5项核心活动，每项含 name、detail 字段）
   - expectedOutputs（3-4项预期产出，每项含 type、description 字段，type 为 "paper"|"patent"|"data"|"prototype"|"report"）
   - successMetrics（2-3项量化成功指标）
   - weight（该阶段研究权重占比，如 25）

2. resourcePlan: 资源规划
   - humanResources: 人力资源列表（role、count、responsibilities、requirement）
   - equipment: 关键设备/仪器列表（name、purpose、availability："Available"|"Shared"|"Need_Apply"|"Outsource"、estimatedCost（元，数字））
   - materials: 关键耗材列表（name、specification、estimatedCost（元，数字））
   - totalBudgetEstimate: 总预算预估（字符串，如 "120-180万元"）
   - fundingStrategy: 推荐申请的基金类别（如 国家自然科学基金面上项目、重点研发计划等，给3-4个）

3. riskMatrix: 风险矩阵，5-7个风险项，每项包含：
   - riskId（如 R1...）
   - category（"technical"|"resource"|"competition"|"ethical"|"regulatory"）
   - description（风险描述，60字以上）
   - probability（"low"|"medium"|"high"）
   - impact（"low"|"medium"|"high"）
   - mitigation（具体应对策略，60字以上）

4. kpiDashboard: KPI 仪表盘
   - publications: 预计发表期刊数量（SCI收录，按级别分，如 {topJournal: 2, highImpact: 3, general: 2}）
   - patents: 预计申请专利数量（{invention: 2, utility: 1}）
   - totalDuration: 总研究周期（如 "3年"）
   - teamSize: 建议团队规模（数字）
   - innovationScore: 创新指数评估（1-100分，数字）
   - feasibilityScore: 可行性评估（1-100分，数字）
   - competitivenessScore: 竞争力评估（1-100分，数字）
   - summary: 项目总体评价（150字以上）

5. collaborationMap: 合作策略
   - internalCollaboration: 课题组内部协作建议（100字以上）
   - externalPartners: 建议合作的外部机构/企业列表（3-4个，含name、type、rationale 字段）
   - internationalCooperation: 国际合作建议（100字以上）

6. disseminationStrategy: 成果传播策略
   - targetJournals: 目标期刊列表（4-5个，含name, impactFactor字段）
   - conferencePlan: 参加会议计划（3-4个重要会议，含name、type："oral"|"poster"）
   - publicEngagement: 学术普及与影响力建设建议（80字以上）

要求：必须输出合法 JSON，字段名必须完全匹配上述 schema，所有文本字段必须为中文，且详尽具体，不得有空字段或过于简短的描述。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        researchPhases: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    phaseId: { type: Type.STRING },
                                    title: { type: Type.STRING },
                                    duration: { type: Type.STRING },
                                    objective: { type: Type.STRING },
                                    keyActivities: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                name: { type: Type.STRING },
                                                detail: { type: Type.STRING }
                                            },
                                            required: ['name', 'detail']
                                        }
                                    },
                                    expectedOutputs: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                type: { type: Type.STRING, enum: ['paper', 'patent', 'data', 'prototype', 'report'] },
                                                description: { type: Type.STRING }
                                            },
                                            required: ['type', 'description']
                                        }
                                    },
                                    successMetrics: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    weight: { type: Type.NUMBER }
                                },
                                required: ['phaseId', 'title', 'duration', 'objective', 'keyActivities', 'expectedOutputs', 'successMetrics', 'weight']
                            }
                        },
                        resourcePlan: {
                            type: Type.OBJECT,
                            properties: {
                                humanResources: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            role: { type: Type.STRING },
                                            count: { type: Type.NUMBER },
                                            responsibilities: { type: Type.STRING },
                                            requirement: { type: Type.STRING }
                                        },
                                        required: ['role', 'count', 'responsibilities']
                                    }
                                },
                                equipment: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            name: { type: Type.STRING },
                                            purpose: { type: Type.STRING },
                                            availability: { type: Type.STRING, enum: ['Available', 'Shared', 'Need_Apply', 'Outsource'] },
                                            estimatedCost: { type: Type.NUMBER }
                                        },
                                        required: ['name', 'purpose', 'availability']
                                    }
                                },
                                materials: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            name: { type: Type.STRING },
                                            specification: { type: Type.STRING },
                                            estimatedCost: { type: Type.NUMBER }
                                        },
                                        required: ['name', 'specification']
                                    }
                                },
                                totalBudgetEstimate: { type: Type.STRING },
                                fundingStrategy: { type: Type.ARRAY, items: { type: Type.STRING } }
                            },
                            required: ['humanResources', 'equipment', 'materials', 'totalBudgetEstimate', 'fundingStrategy']
                        },
                        riskMatrix: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    riskId: { type: Type.STRING },
                                    category: { type: Type.STRING, enum: ['technical', 'resource', 'competition', 'ethical', 'regulatory'] },
                                    description: { type: Type.STRING },
                                    probability: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
                                    impact: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
                                    mitigation: { type: Type.STRING }
                                },
                                required: ['riskId', 'category', 'description', 'probability', 'impact', 'mitigation']
                            }
                        },
                        kpiDashboard: {
                            type: Type.OBJECT,
                            properties: {
                                publications: {
                                    type: Type.OBJECT,
                                    properties: {
                                        topJournal: { type: Type.NUMBER },
                                        highImpact: { type: Type.NUMBER },
                                        general: { type: Type.NUMBER }
                                    }
                                },
                                patents: {
                                    type: Type.OBJECT,
                                    properties: {
                                        invention: { type: Type.NUMBER },
                                        utility: { type: Type.NUMBER }
                                    }
                                },
                                totalDuration: { type: Type.STRING },
                                teamSize: { type: Type.NUMBER },
                                innovationScore: { type: Type.NUMBER },
                                feasibilityScore: { type: Type.NUMBER },
                                competitivenessScore: { type: Type.NUMBER },
                                summary: { type: Type.STRING }
                            },
                            required: ['publications', 'patents', 'totalDuration', 'teamSize', 'innovationScore', 'feasibilityScore', 'competitivenessScore', 'summary']
                        },
                        collaborationMap: {
                            type: Type.OBJECT,
                            properties: {
                                internalCollaboration: { type: Type.STRING },
                                externalPartners: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            name: { type: Type.STRING },
                                            type: { type: Type.STRING },
                                            rationale: { type: Type.STRING }
                                        },
                                        required: ['name', 'type', 'rationale']
                                    }
                                },
                                internationalCooperation: { type: Type.STRING }
                            },
                            required: ['internalCollaboration', 'externalPartners', 'internationalCooperation']
                        },
                        disseminationStrategy: {
                            type: Type.OBJECT,
                            properties: {
                                targetJournals: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            name: { type: Type.STRING },
                                            impactFactor: { type: Type.NUMBER }
                                        },
                                        required: ['name', 'impactFactor']
                                    }
                                },
                                conferencePlan: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            name: { type: Type.STRING },
                                            type: { type: Type.STRING, enum: ['oral', 'poster'] }
                                        },
                                        required: ['name', 'type']
                                    }
                                },
                                publicEngagement: { type: Type.STRING }
                            },
                            required: ['targetJournals', 'conferencePlan', 'publicEngagement']
                        }
                    },
                    required: ['researchPhases', 'resourcePlan', 'riskMatrix', 'kpiDashboard', 'collaborationMap', 'disseminationStrategy']
                }
            }
        });

        try {
            const raw = extractJson(response.text || '{}');
            const parsed = JSON.parse(raw);
            console.log('[Inception] Blueprint generated:', {
                phases: parsed.researchPhases?.length,
                risks: parsed.riskMatrix?.length,
                kpi: parsed.kpiDashboard?.innovationScore
            });
            return parsed;
        } catch (e) {
            console.error('[Inception] Blueprint parse error:', e, response.text?.substring(0, 500));
            throw new Error('蓝图规划数据解析失败，请重试');
        }
    });
};

/**
 * Stage 3: Virtual Panel Review — Multi-Expert Deep Review System
 */
export const runVirtualReview = async (topic: any, landscape: any) => {
    return callGeminiWithRetry(async (ai) => {
        const now = new Date();
        const currentDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
        const currentYear = now.getFullYear();

        const topicType = topic?.type || 'frontier';
        const gaps = landscape?.researchGaps?.slice(0, 3).map((g: any) => (typeof g === 'string' ? g : g?.content)).join('；') || '';
        const topLabs = landscape?.activeLabs?.slice(0, 5).map((l: any) => `${l?.name}(PI: ${l?.leader})`).join('、') || '';
        const risks = landscape?.patentRisks?.slice(0, 3).map((r: any) => (typeof r === 'string' ? r : r?.description)).join('；') || '';

        const reviewFocusRigorous = topicType === 'frontier'
            ? '请从科学严谨性角度审视：科学假设的逻辑闭合性、实验设计的变量控制、统计学效力、可重复性、数据完整性。'
            : '请从工艺验证角度审视：工艺参数的精确度、放大效应的预判、GMP合规性、质量控制体系、批次一致性。';
        const reviewFocusNova = topicType === 'frontier'
            ? '请从创新突破角度审视：跨学科融合深度、范式转移潜力、概念新颖度、理论框架原创性、潜在的颠覆性影响。'
            : '请从市场创新角度审视：技术壁垒构建、成本颠覆潜力、商业模式创新、供应链优化、差异化竞争力。';
        const reviewFocusForge = topicType === 'frontier'
            ? '请从工程可行性角度审视：实验条件的现实可达性、仪器设备可及性、材料供应链稳定性、时间线合理性、预算充足度。'
            : '请从产业落地角度审视：试产到量产的路径、设备投资回报率、物料成本控制、产线兼容性、环保合规性。';

        const prompt = `当前日期：${currentDate}。你将扮演一个由三位资深专家组成的虚拟学术评审委员会，对以下课题进行多轮深度评审。

=== 课题信息 ===
课题名称：${topic?.title}
课题类别：${topicType === 'frontier' ? '前沿探索型' : '产业化成熟型'}
核心科学假设：${topic?.hypothesis}
攻关痛点：${topic?.painPoint}
预期学术贡献：${topic?.impact}
已识别研究缺口：${gaps}
主要竞争课题组：${topLabs}
已知技术/专利风险：${risks}

=== 评审委员会成员 ===
1. 严谨派专家 Dr. Rigor — 学术界最严苛的方法论审查官，关注科学假设逻辑、实验设计变量控制、数据完整性、统计效力。${reviewFocusRigorous}
2. 创新派专家 Dr. Nova — 跨学科创新猎手，关注研究的范式转移潜力、颠覆性创新度、跨领域连接深度。${reviewFocusNova}
3. 工程派专家 Dr. Forge — 从实验室到产线的实战专家，关注工程可行性、预算合理性、时间线可控性、资源可及性。${reviewFocusForge}

=== 评审要求 ===
请生成一份极其详尽、专业的多维度评审报告 JSON，要求如下：

1. **expertPanels**（3位专家各自的独立评审）：每位专家必须包含：
   - expertId: "rigor" | "nova" | "forge"
   - expertName: 专家代号 (Dr. Rigor / Dr. Nova / Dr. Forge)
   - expertRole: 角色描述
   - overallScore: 该专家给出的总分 (0-100)
   - verdict: "approve" | "conditional" | "revise" | "reject"
   - dimensions: 4个评分维度，每个含 name、score(0-100)、comment(50字以上)
   - strengths: 3-4个优势点 (每条30字以上)
   - weaknesses: 2-3个不足点 (每条30字以上)
   - criticalQuestions: 2-3个尖锐质询问题 (模拟真实答辩场景)
   - suggestions: 2-3条具体改进建议 (每条40字以上，需可操作)
   - detailedReview: 该专家的完整评审意见 (200字以上，必须体现该专家的专业视角和评审风格)

2. **crossExamination**（模拟多轮交叉质询对话）：3-4轮对话，每轮含：
   - round: 轮次编号
   - questioner: 提问专家代号
   - questionerName: 提问专家名称
   - question: 尖锐质询问题 (模拟学术答辩中的交锋)
   - responder: 回应者 (可以是课题负责人 "PI" 或另一位专家)
   - responderName: 回应者名称
   - response: 回应内容 (模拟课题负责人或专家的回应)
   - followUp: 追问或总结 (可选)

3. **overallAssessment**（综合评估）：
   - overallScore: 综合立项指数 (0-100)
   - decision: "强烈推荐立项" | "建议立项" | "有条件立项" | "建议修改后重审" | "不建议立项"
   - decisionRationale: 决策理由 (100字以上)
   - scoreDimensions: 6个维度评分对象数组，每个含 name 和 score(0-100)：
     学术新颖度(Academic Novelty)、技术可行性(Technical Feasibility)、影响因子潜力(Impact Potential)、资源匹配度(Resource Fitness)、竞争差异化(Competitive Edge)、风险可控度(Risk Manageability)
   - conditionalRequirements: 如果是有条件立项，列出2-3条必须满足的前置条件
   - summary: 综合评审总结 (200字以上)
   - executiveBrief: 一句话执行摘要 (50字以内)

所有文本必须使用中文，评审意见必须详尽、专业、有深度，模拟真实学术评审场景。每位专家的评审风格必须有明显差异化。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                thinkingConfig: { thinkingBudget: 2048 },
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        expertPanels: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    expertId: { type: Type.STRING, enum: ['rigor', 'nova', 'forge'] },
                                    expertName: { type: Type.STRING },
                                    expertRole: { type: Type.STRING },
                                    overallScore: { type: Type.NUMBER },
                                    verdict: { type: Type.STRING, enum: ['approve', 'conditional', 'revise', 'reject'] },
                                    dimensions: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                name: { type: Type.STRING },
                                                score: { type: Type.NUMBER },
                                                comment: { type: Type.STRING }
                                            },
                                            required: ['name', 'score', 'comment']
                                        }
                                    },
                                    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    criticalQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    detailedReview: { type: Type.STRING }
                                },
                                required: ['expertId', 'expertName', 'expertRole', 'overallScore', 'verdict', 'dimensions', 'strengths', 'weaknesses', 'criticalQuestions', 'suggestions', 'detailedReview']
                            }
                        },
                        crossExamination: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    round: { type: Type.NUMBER },
                                    questioner: { type: Type.STRING },
                                    questionerName: { type: Type.STRING },
                                    question: { type: Type.STRING },
                                    responder: { type: Type.STRING },
                                    responderName: { type: Type.STRING },
                                    response: { type: Type.STRING },
                                    followUp: { type: Type.STRING }
                                },
                                required: ['round', 'questioner', 'questionerName', 'question', 'responder', 'responderName', 'response']
                            }
                        },
                        overallAssessment: {
                            type: Type.OBJECT,
                            properties: {
                                overallScore: { type: Type.NUMBER },
                                decision: { type: Type.STRING },
                                decisionRationale: { type: Type.STRING },
                                scoreDimensions: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            name: { type: Type.STRING },
                                            score: { type: Type.NUMBER }
                                        },
                                        required: ['name', 'score']
                                    }
                                },
                                conditionalRequirements: { type: Type.ARRAY, items: { type: Type.STRING } },
                                summary: { type: Type.STRING },
                                executiveBrief: { type: Type.STRING }
                            },
                            required: ['overallScore', 'decision', 'decisionRationale', 'scoreDimensions', 'conditionalRequirements', 'summary', 'executiveBrief']
                        }
                    },
                    required: ['expertPanels', 'crossExamination', 'overallAssessment']
                }
            }
        });

        try {
            const raw = extractJson(response.text || '{}');
            const parsed = JSON.parse(raw);
            console.log('[Inception] Review generated:', {
                experts: parsed.expertPanels?.length,
                crossExam: parsed.crossExamination?.length,
                score: parsed.overallAssessment?.overallScore
            });
            return parsed;
        } catch (e) {
            console.error('[Inception] Review parse error:', e, response.text?.substring(0, 500));
            throw new Error('评审报告数据解析失败，请重试');
        }
    });
};

/**
 * AI 专利风险分析
 */
export const analyzePatentRisk = async (nodeLabel: string, context: string) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名为顶级科研机构服务的专利法专家和学术风险评估师。
请针对特定技术节点进行全方位的专利侵权风险与学术合规性分析。

【分析目标节点】：${nodeLabel}
【相关上下文】：${context}

【分析要求】：
1. **风险评级 (riskLevel)**：评估该节点在商业化或学术发布时的风险等级（Low, Medium, High, Critical）。
2. **类似专利识别 (similarPatent)**：推测并描述可能存在的类似现有专利或学术优先权申报，标注可能的持有机构（如 MIT, Tsinghua, Intel 等）。
3. **技术壁垒说明 (blockageDesc)**：详尽描述该节点可能遇到的“专利墙”或学术研究陷阱。
4. **专业合规建议 (advice)**：提供 3-5 条具体、可操作的学术规避或专利布局建议。

要求：使用高度专业的学术中文，分析需具备深度，严禁空洞。

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
                        riskLevel: { type: Type.STRING, enum: ["Low", "Medium", "High", "Critical"] },
                        similarPatent: { type: Type.STRING },
                        blockageDesc: { type: Type.STRING },
                        advice: { type: Type.STRING }
                    },
                    required: ["riskLevel", "similarPatent", "blockageDesc", "advice"]
                }
            }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

/**
 * 生成研究路径溯源报告
 */
export const generateTraceabilityReport = async (nodes: any[]) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名为国家实验室提供决策支持的资深科学分析师。
请基于以下技术路径的节点数据，生成一份极其详尽、具备前瞻性的“研究路径溯源与可靠性审计报告”。

【路径节点数据】：
${JSON.stringify(nodes)}

【报告生成要求】：
1. **学术背景综述**：分析该路径的科学出发点与演进逻辑。
2. **证据强度审计**：基于节点的 evidenceWeight 和 trlLevel，评估该路径的科学可靠性。
3. **关键瓶颈识别**：指出影响该路径成功的 3 个核心技术卡点。
4. **优化建议**：提供基于当前全球竞争格局的优化路径建议。

要求：使用 Markdown 语法输出，包含清晰的层级标题（# ## ###），文字风格要求严谨、权威、硬核。

输出：直接返回 Markdown 文本。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
            }
        });
        return response.text || "报告生成异常，请检查 AI 服务状态。";
    });
};
