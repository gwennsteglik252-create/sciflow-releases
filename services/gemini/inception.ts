
import { Type } from "@google/genai";
import { callGeminiWithRetry, extractJson, FAST_MODEL, PRO_MODEL, GROUNDING_MODEL, SPEED_CONFIG } from "./core";
import { getAppSettings } from "./core/constants";
import { LabInfo, PatentRisk, Landscape, ResearchGap } from "../../types";

/**
 * Read aiOutputLanguage from user settings and return language instructions for prompts.
 * 'auto' follows UI language (uiLanguage), defaults to Chinese.
 */
const getInceptionLang = () => {
    const settings = getAppSettings();
    let lang: 'zh' | 'en' = 'zh';
    if (settings.aiOutputLanguage === 'en') {
        lang = 'en';
    } else if (settings.aiOutputLanguage === 'auto') {
        lang = settings.uiLanguage === 'en' ? 'en' : 'zh';
    }
    const isEn = lang === 'en';
    return {
        lang,
        isEn,
        langRule: isEn
            ? 'LANGUAGE REQUIREMENT: ALL output text fields MUST be written in professional academic English.'
            : 'LANGUAGE REQUIREMENT: ALL output text fields MUST be written in Chinese.',
        descSuffix: isEn ? ', must be in English' : ', must be in Chinese',
        contentLang: isEn ? 'All content must be in English.' : 'All content must be in Chinese.',
    };
};

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

    // -- Phase 1: googleSearch grounding --
    let rawIntelligence = '';
    let groundingChunks: any[] = [];
    const L = getInceptionLang();

    try {
        const groundingResult = await callGeminiWithRetry(async (ai) => {
            const groundingPrompt = L.isEn
                ? `Current date: ${currentDate}. Search and compile the latest global academic intelligence on "${title}" (prioritizing ${currentYear}). ${L.contentLang}
Requirements:
1. Top 10 globally active research labs/groups with institution, lab name, PI, and specific contributions.
2. Source URLs must point to specific research output pages, NOT generic homepages.
3. Recent patent landscape, barriers, and risks with source links (5+ items).
4. ${topicType === 'frontier' ? '3-5 key under-explored research gaps.' : '3-5 core industrial barriers and improvement opportunities.'}
5. Commercialization status (${currentYear}), market forecasts with authoritative sources.
Please use Google Search to retrieve real-time web information.`
                : `当前日期：${currentDate}。请搜索并整理关于课题 "${title}" 的全球最新学术情报（优先 ${currentYear} 年），并标注信息来源。${L.contentLang}
要求：
1. **重点聚焦国内动态**：中国研究实验室/研究组必须占绝大多数（约 70-80%），仅包含少量具有全球影响力的顶级国外课题组。
2. 全球活跃的前 10 个研究实验室/研究组，必须明确：机构名（中国机构优先）、实验室名称、负责人 PI、具体突破性贡献。
3. **链接精确性要求**：sourceUrl 必须指向该研究组针对本课题的具体研究成果页面，严禁仅提供大学主页链接。
4. 近两年相关专利布局、技术陷阱、潜在壁垒风险及来源链接（至少 5 项，重点关注中国专利）。
5. ${topicType === 'frontier' ? '该领域目前尚未被充分研究的 3-5 个核心空白方向。' : '该领域 3-5 个核心技术壁垒与工艺改进空间。'}
6. 商业化/产业化现状（${currentYear}年）、市场规模预测及权威报道来源。
请务必利用 Google Search 插件获取实时的网络信息。`;

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

        const newDimsPrompt = L.isEn
            ? `\n8. keyPublications: 5-8 landmark or highly-cited papers. Include title, first/corresponding authors, journal, year, citation count, significance description, and whether it is a landmark paper (isLandmark).\n9. fundingLandscape: Global funding overview with totalGlobalFunding estimate, 3-5 topAgencies (name, country, recentProjects count, avgGrantSize, focusAreas), and fundingTrend (increasing/stable/declining).\n10. trlTimeline: 4-6 chronological milestones showing the technology readiness evolution. Each with year, trlLevel (1-9), milestone description, and actor (institution/person).\n11. geographicDistribution: 4-6 countries/regions. Each with country, labCount, publishedPapers (last 3 years), strength (dominant/strong/emerging/niche), keyInstitutions (2-3 names).\n12. translationReadiness: Object with marketSize estimate, cagr percentage, 3-5 keyPlayers (company, product, stage: R&D/Pilot/Commercial), policySupport description, and bottleneck.\n13. methodologyGaps: 3-5 methodology-level gaps. Each with gap description, impact (critical/moderate), and potentialApproach.\n14. interdisciplinaryLinks: 3-5 cross-disciplinary connections. Each with field (e.g. "Machine Learning", "Synthetic Biology"), connection description, maturity (emerging/growing/established), and optionally representativePaper.`
            : `\n8. keyPublications: 5-8 篇里程碑或高被引论文。须含 title、authors、journal、year、citations、significance、isLandmark。\n9. fundingLandscape: 全球资金版图概览，含 totalGlobalFunding、3-5 个 topAgencies、fundingTrend。\n10. trlTimeline: 4-6 个 TRL 里程碑。每个含 year、trlLevel(1-9)、milestone、actor。\n11. geographicDistribution: 4-6 个国家/地区竞争力分布。含 country、labCount、publishedPapers、strength、keyInstitutions。\n12. translationReadiness: 产业转化路径，含 marketSize、cagr、keyPlayers、policySupport、bottleneck。\n13. methodologyGaps: 3-5 个方法学缺口。含 gap、impact(critical/moderate)、potentialApproach。\n14. interdisciplinaryLinks: 3-5 个跨学科关联。每个含 field（如“机器学习”“合成生物学”）、connection 交叉点描述、maturity(emerging/growing/established)、可选 representativePaper。`;

        const extractionPrompt = rawIntelligence.length > 100
            ? (L.isEn
                ? `You are an academic intelligence extraction engine. Extract structured JSON from the raw text.\nRules:\n1. Output only JSON, no conversation.\n2. ${L.contentLang}\n3. Extract at least 8 research groups with PI and contributions.\n4. sourceUrl must link to specific research outputs, NOT generic homepages.\n5. 5 patent risks, ${topicType === 'frontier' ? '3-5 deep research gaps' : '3-5 industrial gaps'}, 12 trend data points.\n6. Each description must be detailed (50+ words). Use [ID i] URLs from Source List.\n7. Ensure valid JSON.${newDimsPrompt}\n\nSource List:\n${sourceContext}\n\nRaw Intelligence (${currentDate}):\n${rawIntelligence.substring(0, 4000)}`
                : `You are an academic intelligence extraction engine. Extract data in Chinese.\nRules:\n1. Output only JSON.\n2. ${L.contentLang}\n3. **Chinese groups priority**: 8+ groups, 6+ from China. Include PI and contributions.\n4. sourceUrl must link to specific research outputs. No generic homepages.\n5. 5 patent risks, ${topicType === 'frontier' ? '3-5 deep research gaps' : '3-5 industrial gaps'}, 12 trend points.\n6. Each description 50+ chars. Map sourceUrl to [ID i] from Source List.\n7. Valid JSON only.${newDimsPrompt}\n\nSource List:\n${sourceContext}\n\nRaw Intelligence (${currentDate}):\n${rawIntelligence.substring(0, 4000)}`)
            : (L.isEn
                ? `Current date: ${currentDate}. For topic "${title}", generate a comprehensive landscape JSON. ${L.contentLang} 8+ groups with PI, 5+ risks, 3-5 gaps, 12 trend points, 5-8 key publications, funding landscape, TRL timeline, geographic distribution, translation readiness, and methodology gaps.`
                : `Current date: ${currentDate}. For topic "${title}", generate landscape JSON. ${L.contentLang} Chinese groups 70%+. 8+ groups with PI, 5+ risks, 3-5 gaps, 12 trend points, 5-8 key publications, funding landscape, TRL timeline, geographic distribution, translation readiness, methodology gaps.`);

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
                        },
                        keyPublications: {
                            type: Type.ARRAY,
                            description: "5-8 landmark or highly-cited papers in this field",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING, description: "Paper title" },
                                    authors: { type: Type.STRING, description: "First/corresponding author(s)" },
                                    journal: { type: Type.STRING, description: "Journal name" },
                                    year: { type: Type.NUMBER },
                                    citations: { type: Type.NUMBER, description: "Approximate citation count" },
                                    significance: { type: Type.STRING, description: "Why this paper matters" },
                                    doi: { type: Type.STRING },
                                    isLandmark: { type: Type.BOOLEAN, description: "True if this is a paradigm-shifting paper" }
                                },
                                required: ["title", "authors", "journal", "year", "citations", "significance", "isLandmark"]
                            }
                        },
                        fundingLandscape: {
                            type: Type.OBJECT,
                            description: "Global funding overview for this research field",
                            properties: {
                                totalGlobalFunding: { type: Type.STRING, description: "Estimated total global investment" },
                                topAgencies: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            name: { type: Type.STRING },
                                            country: { type: Type.STRING },
                                            recentProjects: { type: Type.NUMBER, description: "Number of projects funded in past 3 years" },
                                            avgGrantSize: { type: Type.STRING },
                                            focusAreas: { type: Type.ARRAY, items: { type: Type.STRING } }
                                        },
                                        required: ["name", "country", "recentProjects", "avgGrantSize", "focusAreas"]
                                    }
                                },
                                fundingTrend: { type: Type.STRING, enum: ["increasing", "stable", "declining"] },
                                sourceUrl: { type: Type.STRING }
                            },
                            required: ["totalGlobalFunding", "topAgencies", "fundingTrend"]
                        },
                        trlTimeline: {
                            type: Type.ARRAY,
                            description: "4-6 chronological TRL milestones showing technology evolution",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    year: { type: Type.NUMBER },
                                    trlLevel: { type: Type.NUMBER, description: "TRL 1-9" },
                                    milestone: { type: Type.STRING, description: "What happened at this stage" },
                                    actor: { type: Type.STRING, description: "Institution or person who drove this" }
                                },
                                required: ["year", "trlLevel", "milestone", "actor"]
                            }
                        },
                        geographicDistribution: {
                            type: Type.ARRAY,
                            description: "4-6 countries/regions competitive landscape",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    country: { type: Type.STRING },
                                    labCount: { type: Type.NUMBER, description: "Number of active labs" },
                                    publishedPapers: { type: Type.NUMBER, description: "Papers published in last 3 years" },
                                    strength: { type: Type.STRING, enum: ["dominant", "strong", "emerging", "niche"] },
                                    keyInstitutions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 representative institutions" }
                                },
                                required: ["country", "labCount", "publishedPapers", "strength", "keyInstitutions"]
                            }
                        },
                        translationReadiness: {
                            type: Type.OBJECT,
                            description: "Industry translation and commercialization readiness",
                            properties: {
                                marketSize: { type: Type.STRING, description: "Estimated market size" },
                                cagr: { type: Type.STRING, description: "CAGR percentage" },
                                keyPlayers: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            company: { type: Type.STRING },
                                            product: { type: Type.STRING },
                                            stage: { type: Type.STRING, enum: ["R&D", "Pilot", "Commercial"] }
                                        },
                                        required: ["company", "product", "stage"]
                                    }
                                },
                                policySupport: { type: Type.STRING, description: "Government or policy support status" },
                                bottleneck: { type: Type.STRING, description: "Core commercialization bottleneck" }
                            },
                            required: ["marketSize", "cagr", "keyPlayers", "policySupport", "bottleneck"]
                        },
                        methodologyGaps: {
                            type: Type.ARRAY,
                            description: "3-5 methodology-level research gaps",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    gap: { type: Type.STRING, description: "Methodology gap description" },
                                    impact: { type: Type.STRING, enum: ["critical", "moderate"] },
                                    potentialApproach: { type: Type.STRING, description: "Potential solution or approach" }
                                },
                                required: ["gap", "impact", "potentialApproach"]
                            }
                        },
                        interdisciplinaryLinks: {
                            type: Type.ARRAY,
                            description: "3-5 cross-disciplinary connections relevant to this field",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    field: { type: Type.STRING, description: "Cross-discipline name, e.g. Machine Learning, Synthetic Biology" },
                                    connection: { type: Type.STRING, description: "How the disciplines intersect" },
                                    maturity: { type: Type.STRING, enum: ["emerging", "growing", "established"] },
                                    representativePaper: { type: Type.STRING, description: "A representative paper title at the intersection" }
                                },
                                required: ["field", "connection", "maturity"]
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
            // 优先解析 [ID X] 引用标记（AI 可能混在 http URL 中返回）
            const match = url.match(/\[ID\s*(\d+)\]/i);
            if (match) {
                const idx = parseInt(match[1]);
                return groundingChunks[idx]?.web?.uri;
            }
            if (url.startsWith('http')) return url;
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
            hotnessData: result.hotnessData.length,
            keyPublications: result.keyPublications?.length ?? 0,
            fundingLandscape: result.fundingLandscape ? 'present' : 'absent',
            trlTimeline: result.trlTimeline?.length ?? 0,
            geographicDistribution: result.geographicDistribution?.length ?? 0,
            translationReadiness: result.translationReadiness ? 'present' : 'absent',
            methodologyGaps: result.methodologyGaps?.length ?? 0,
            interdisciplinaryLinks: result.interdisciplinaryLinks?.length ?? 0,
        });

        // 附加 grounding 来源链接
        if (groundingChunks.length > 0) {
            result.sources = groundingChunks
                .map((c: any) => c.web?.uri).filter(Boolean).slice(0, 10);
        }
        return result;
    } catch (e) {
        console.error('[Inception] Phase 2 parse error:', e, extractionResult.text);
        return { activeLabs: [], commercialStatus: '解析异常，请重试', patentRisks: [], researchGaps: [], hotnessData: [], keyPublications: [], fundingLandscape: undefined, trlTimeline: [], geographicDistribution: [], translationReadiness: undefined, methodologyGaps: [], interdisciplinaryLinks: [] };
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
        const L = getInceptionLang();
        const prompt = L.isEn
            ? `Current date: ${currentDate}.\nBased on ${currentYear} academic trends, propose 8 research topics with top-journal potential for "${domain}".\n\n${L.langRule}\n\nRequirements:\n1. Include 4 Frontier (type="frontier", TRL 1-2) and 4 Industrial Mature (type="mature", TRL 3+).\n2. Focus on ${currentYear} core bottlenecks and emerging opportunities.\n3. Topics should be diverse, covering different angles and sub-directions.\n4. Fields:\n   - title: descriptive topic title\n   - type: "frontier" or "mature"\n   - hypothesis: core scientific hypothesis (50+ words)\n   - painPoint: key technical pain point\n   - evolution: evolution trajectory\n   - impact: expected academic impact\n   - estimatedTrl: TRL level 1-5\n   - feasibility: 1-5 rating (5=highly feasible with current tech)\n   - novelty: 1-5 rating (5=paradigm-shifting originality)\n   - fundingPotential: recommended funding sources (e.g. "NSF CAREER, DOE")\n   - expectedPublications: expected publication outcomes (e.g. "1-2 Nature sub-journals, 3-4 Q1")\n   - timeToResult: time to first milestone result (e.g. "6-12 months")\n   - relatedFields: 2-3 cross-disciplinary tags\n   - riskWarning: main risk in 1 sentence\nOutput JSON array only.`
            : `Current date: ${currentDate}.\nBased on ${currentYear} trends, for "${domain}" propose 8 topics.\n\n${L.langRule}\n\nRequirements:\n1. 4 Frontier (type="frontier", TRL 1-2) + 4 Mature (type="mature", TRL 3+).\n2. Core bottlenecks and emerging opportunities of ${currentYear}.\n3. Topics should be diverse, covering different sub-directions.\n4. Fields:\n   - title: 课题名称\n   - type: "frontier" 或 "mature"\n   - hypothesis: 核心科学假设（不少于50字）\n   - painPoint: 关键技术痛点\n   - evolution: 演进轨迹\n   - impact: 预期学术贡献\n   - estimatedTrl: TRL等级 1-5\n   - feasibility: 可行性评级 1-5（5=当前技术条件下高度可行）\n   - novelty: 创新性评级 1-5（5=范式级创新）\n   - fundingPotential: 推荐申报基金（如"国自然面上/青基、重点研发"）\n   - expectedPublications: 预期论文产出（如"1-2篇Nature子刊，3-4篇一区"）\n   - timeToResult: 首个阶段性成果周期（如"6-12个月"）\n   - relatedFields: 2-3个交叉学科标签\n   - riskWarning: 主要风险一句话说明\nJSON array only.`;
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                thinkingConfig: { thinkingBudget: 2048 },
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING, description: `Topic title${L.descSuffix}` },
                            type: { type: Type.STRING, enum: ["frontier", "mature"] },
                            hypothesis: { type: Type.STRING, description: `Core hypothesis${L.descSuffix}` },
                            painPoint: { type: Type.STRING, description: `Core pain point${L.descSuffix}` },
                            evolution: { type: Type.STRING, description: `Evolution trajectory${L.descSuffix}` },
                            impact: { type: Type.STRING, description: `Expected impact${L.descSuffix}` },
                            estimatedTrl: { type: Type.NUMBER, description: "TRL level 1-5" },
                            feasibility: { type: Type.NUMBER, description: "Feasibility rating 1-5 (5=highly feasible)" },
                            novelty: { type: Type.NUMBER, description: "Novelty/originality rating 1-5 (5=paradigm-shifting)" },
                            fundingPotential: { type: Type.STRING, description: `Recommended funding sources${L.descSuffix}` },
                            expectedPublications: { type: Type.STRING, description: `Expected publication outcomes${L.descSuffix}` },
                            timeToResult: { type: Type.STRING, description: `Time to first milestone result${L.descSuffix}` },
                            relatedFields: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2-3 cross-disciplinary tags" },
                            riskWarning: { type: Type.STRING, description: `Main risk in 1 sentence${L.descSuffix}` },
                        },
                        required: ['title', 'type', 'hypothesis', 'painPoint', 'evolution', 'impact', 'estimatedTrl', 'feasibility', 'novelty', 'fundingPotential', 'expectedPublications', 'timeToResult', 'relatedFields', 'riskWarning']
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
        const gaps = landscape?.researchGaps?.slice(0, 3).map((g: any) => (typeof g === 'string' ? g : g?.content)).join('; ') || '';
        const topLabs = landscape?.activeLabs?.slice(0, 3).map((l: any) => l?.name).join(', ') || '';
        const L = getInceptionLang();

        const promptHeader = L.isEn
            ? `Current date: ${currentDate}. You are a senior research planning expert. Generate a detailed research blueprint.\n\n${L.langRule}\n\nTopic: ${topic?.title}\nType: ${topicType === 'frontier' ? 'Frontier Exploration' : 'Industrial Mature'}\nHypothesis: ${topic?.hypothesis}\nPain Point: ${topic?.painPoint}\nImpact: ${topic?.impact}\nGaps: ${gaps}\nCompeting Groups: ${topLabs}\n\nFrom a Research Director perspective, generate a complete JSON blueprint. All text fields must be detailed (50+ words):`
            : `当前日期：${currentDate}。你是一名资深研究规划专家，请为以下课题生成一份极其详尽、专业的研究蓝图规划方案。\n\n${L.langRule}\n\n课题名称：${topic?.title}\n课题类型：${topicType === 'frontier' ? '前沿探索' : '产业化成熟'}\n核心科学假设：${topic?.hypothesis}\n攻关痛点：${topic?.painPoint}\n预期贡献：${topic?.impact}\n已识别研究缺口：${gaps}\n主要竞争课题组：${topLabs}\n\n请从研究总监视角, 生成一份包含以下所有维度的完整 JSON 蓝图，所有字段必须用中文填写，且每个字段不少于 50 字描述：`;

        const prompt = `${promptHeader}

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

${L.isEn ? 'Requirements: Valid JSON, field names must match schema, all text detailed and specific, no empty fields.' : '要求：必须输出合法 JSON，字段名必须完全匹配上述 schema，所有文本字段详尽具体，不得有空字段或过于简短的描述。'}`;

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
        const gaps = landscape?.researchGaps?.slice(0, 3).map((g: any) => (typeof g === 'string' ? g : g?.content)).join('; ') || '';
        const topLabs = landscape?.activeLabs?.slice(0, 5).map((l: any) => `${l?.name}(PI: ${l?.leader})`).join(', ') || '';
        const risks = landscape?.patentRisks?.slice(0, 3).map((r: any) => (typeof r === 'string' ? r : r?.description)).join('; ') || '';
        const L = getInceptionLang();

        const reviewFocusRigorous = topicType === 'frontier'
            ? (L.isEn ? 'Review scientific rigor: hypothesis logic, variable control, statistical power, reproducibility, data integrity.' : '请从科学严谨性角度审视：科学假设的逻辑闭合性、实验设计的变量控制、统计学效力、可重复性、数据完整性。')
            : (L.isEn ? 'Review process validation: parameter accuracy, scale-up prediction, GMP compliance, quality control, batch consistency.' : '请从工艺验证角度审视：工艺参数的精确度、放大效应的预判、GMP合规性、质量控制体系、批次一致性。');
        const reviewFocusNova = topicType === 'frontier'
            ? (L.isEn ? 'Review innovation: interdisciplinary depth, paradigm shift potential, novelty, theoretical originality, disruptive impact.' : '请从创新突破角度审视：跨学科融合深度、范式转移潜力、概念新颖度、理论框架原创性、潜在的颠覆性影响。')
            : (L.isEn ? 'Review market innovation: barrier construction, cost disruption, business model innovation, supply chain, differentiation.' : '请从市场创新角度审视：技术壁垒构建、成本颠覆潜力、商业模式创新、供应链优化、差异化竞争力。');
        const reviewFocusForge = topicType === 'frontier'
            ? (L.isEn ? 'Review engineering feasibility: experimental conditions, equipment accessibility, material supply chain, timeline, budget.' : '请从工程可行性角度审视：实验条件的现实可达性、仪器设备可及性、材料供应链稳定性、时间线合理性、预算充足度。')
            : (L.isEn ? 'Review industrial deployment: pilot-to-mass path, equipment ROI, material cost control, production line compatibility, environmental compliance.' : '请从产业落地角度审视：试产到量产的路径、设备投资回报率、物料成本控制、产线兼容性、环保合规性。');

        const prompt = L.isEn
            ? `Current date: ${currentDate}. Role-play as a virtual academic review committee of 3 senior experts conducting multi-round deep review.

${L.langRule}

=== Topic Info ===
Title: ${topic?.title}
Type: ${topicType === 'frontier' ? 'Frontier Exploration' : 'Industrial Mature'}
Hypothesis: ${topic?.hypothesis}
Pain Point: ${topic?.painPoint}
Impact: ${topic?.impact}
Gaps: ${gaps}
Competing Groups: ${topLabs}
Known Risks: ${risks}

=== Committee ===
1. Dr. Rigor - strictest methodology reviewer. ${reviewFocusRigorous}
2. Dr. Nova - interdisciplinary innovation hunter. ${reviewFocusNova}
3. Dr. Forge - lab-to-production pragmatist. ${reviewFocusForge}

=== Requirements ===
Generate comprehensive review JSON:
1. expertPanels (3 experts): expertId, expertName, expertRole, overallScore(0-100), verdict, dimensions(4), strengths(3-4), weaknesses(2-3), criticalQuestions(2-3), suggestions(2-3), detailedReview(200+ words).
2. crossExamination (3-4 rounds): round, questioner, questionerName, question, responder, responderName, response, followUp.
3. overallAssessment: overallScore, decision, decisionRationale, scoreDimensions(6: Academic Novelty, Technical Feasibility, Impact Potential, Resource Fitness, Competitive Edge, Risk Manageability), conditionalRequirements, summary(200+ words), executiveBrief(50 words max).

All reviews must be detailed, professional, and in-depth. Each expert must have a distinctly different style.`
            : `当前日期：${currentDate}。你将扮演一个由三位资深专家组成的虚拟学术评审委员会，对以下课题进行多轮深度评审。

${L.langRule}

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
1. 严谨派专家 Dr. Rigor — 学术界最严苛的方法论审查官。${reviewFocusRigorous}
2. 创新派专家 Dr. Nova — 跨学科创新猎手。${reviewFocusNova}
3. 工程派专家 Dr. Forge — 从实验室到产线的实战专家。${reviewFocusForge}

=== 评审要求 ===
请生成一份极其详尽、专业的多维度评审报告 JSON：

1. **expertPanels**（3位专家独立评审）：expertId, expertName, expertRole, overallScore(0-100), verdict, dimensions(4个,含name/score/comment), strengths(3-4), weaknesses(2-3), criticalQuestions(2-3), suggestions(2-3,40字+), detailedReview(200字+)

2. **crossExamination**（3-4轮交叉质询）：round, questioner, questionerName, question, responder, responderName, response, followUp

3. **overallAssessment**（综合评估）：overallScore(0-100), decision, decisionRationale(100字+), scoreDimensions(6个维度), conditionalRequirements, summary(200字+), executiveBrief(50字内)

所有评审意见必须详尽、专业、有深度。每位专家风格必须有明显差异化。`;

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
        const L = getInceptionLang();
        const prompt = L.isEn
            ? `You are a patent law expert and academic risk assessor for top research institutions.
Conduct comprehensive patent infringement risk and academic compliance analysis.

Target Node: ${nodeLabel}
Context: ${context}

Requirements:
1. riskLevel: Risk level (Low, Medium, High, Critical).
2. similarPatent: Identify similar existing patents with likely holders.
3. blockageDesc: Describe potential patent walls or traps.
4. advice: 3-5 actionable avoidance or patent positioning recommendations.

${L.langRule}
Output JSON.`
            : `你是一名为顶级科研机构服务的专利法专家和学术风险评估师。
请针对特定技术节点进行全方位的专利侵权风险与学术合规性分析。

【分析目标节点】：${nodeLabel}
【相关上下文】：${context}

【分析要求】：
1. **风险评级 (riskLevel)**：评估风险等级（Low, Medium, High, Critical）。
2. **类似专利识别 (similarPatent)**：推测类似现有专利，标注持有机构。
3. **技术壁垒说明 (blockageDesc)**：详述可能遇到的“专利墙”或研究陷阱。
4. **合规建议 (advice)**：3-5 条可操作的规避或专利布局建议。

${L.langRule}
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
                        similarPatent: { type: Type.STRING, description: `Similar patents${L.descSuffix}` },
                        blockageDesc: { type: Type.STRING, description: `Technical barriers${L.descSuffix}` },
                        advice: { type: Type.STRING, description: `Compliance advice${L.descSuffix}` }
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
        const L = getInceptionLang();
        const prompt = L.isEn
            ? `You are a senior scientific analyst providing decision support for national laboratories.
Generate a detailed "Research Pathway Traceability & Reliability Audit Report" based on the pathway node data.

Pathway Node Data:
${JSON.stringify(nodes)}

Report Requirements:
1. Academic Background Review: Analyze the scientific starting point and evolutionary logic.
2. Evidence Strength Audit: Assess reliability based on evidenceWeight and trlLevel.
3. Key Bottleneck Identification: Identify 3 core technical blockers.
4. Optimization Recommendations: Pathway optimization based on global competitive landscape.

${L.langRule}
Use Markdown with clear headings (# ## ###). Output Markdown text directly.`
            : `你是一名为国家实验室提供决策支持的资深科学分析师。
请基于以下技术路径的节点数据，生成一份极其详尽、具备前瞻性的“研究路径溯源与可靠性审计报告”。

【路径节点数据】：
${JSON.stringify(nodes)}

【报告生成要求】：
1. **学术背景综述**：分析该路径的科学出发点与演进逻辑。
2. **证据强度审计**：基于 evidenceWeight 和 trlLevel，评估科学可靠性。
3. **关键瓶颈识别**：指出 3 个核心技术卡点。
4. **优化建议**：提供基于全球竞争格局的优化路径建议。

${L.langRule}
要求：使用 Markdown 语法输出，包含清晰的层级标题（# ## ###）。

输出：直接返回 Markdown 文本。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
            }
        });
        return response.text || (L.isEn ? 'Report generation failed, please check AI service status.' : '报告生成异常，请检查 AI 服务状态。');
    });
};
