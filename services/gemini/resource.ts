import { Type } from "@google/genai";
import { Literature, InventoryItem, ExtractedTable } from "../../types";
import { callGeminiWithRetry, extractJson, FAST_MODEL, PRO_MODEL, SPEED_CONFIG } from "./core";

export interface SearchFilters {
    docType: 'Article' | 'Review' | 'Patent' | 'Conference' | 'All';
    timeRange: '1y' | '3y' | '5y' | 'all';
    highImpactOnly: boolean;
}

/**
 * AI 生成 MSDS 报告
 */
export const generateMSDS = async (item: InventoryItem) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名资深的实验室安全主管和化学信息学专家。请为以下实验室物资生成一份极其专业的 MSDS（材料安全数据表）。
        
        【物资信息】：
        名称: ${item.name}
        CAS 号: ${item.casNo || '未知'}
        分子式: ${item.formula || '未知'}
        品牌: ${item.brand || '未知'}
        规格: ${item.purity || '未知'}
        安全等级 (初步): ${item.safetyLevel}
        
        【任务要求】：
        1. **真实性**：请基于全球公认的化学品安全数据库（如 Sigma-Aldrich, Thermo Fisher, PubChem）进行检索（如果可能）或模拟。
        2. **语言**：必须使用专业的学术中文。
        3. **格式**：使用标准的 Markdown 格式，包含清晰的章节（标识、危险性概述、成分、急救、消防、泄漏处理、操作处置、防护装备、理化特性等）。
        4. **深度**：内容需要包含具体的安全术语（如 H302, P280 等编码的含义描述）和具体的理化常数预测。
        
        请直接输出报告内容。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                tools: [{ googleSearch: {} }] // 允许搜索以提高真实性
            }
        });

        return response.text || "";
    });
};

/**
 * NEW: Parse raw BibTeX strings into structured Literature objects
 */
export const parseBibTeXAI = async (rawBib: string) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名学术引文专家。请解析以下 BibTeX 内容，并将其转换为结构化的科研数据。
        要求：
        1. 识别并提取 title, authors (数组), year, journal/source, doi, url。
        2. 自动生成一个简短的中文学术分类 (category)。
        3. 如果 BibTeX 包含 abstract，请保留。
        
        BibTeX 原文:
        ${rawBib}
        
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
                            title: { type: Type.STRING },
                            authors: { type: Type.ARRAY, items: { type: Type.STRING } },
                            year: { type: Type.NUMBER },
                            source: { type: Type.STRING },
                            doi: { type: Type.STRING },
                            url: { type: Type.STRING },
                            abstract: { type: Type.STRING },
                            category: { type: Type.STRING },
                            bibtex: { type: Type.STRING }
                        }
                    }
                }
            }
        });
        return JSON.parse(extractJson(response.text || '[]'));
    });
};

/**
 * 文献深度充实：导入后联网搜索补充 performance/synthesisSteps/完整摘要
 * 与 extractKnowledgeSinkAI 不同：使用 Google Search 联网获取文献详情
 */
export const enrichLiteratureFromSearch = async (literature: Literature) => {
    return callGeminiWithRetry(async (ai) => {
        const searchHint = literature.doi
            ? `DOI: ${literature.doi}`
            : `标题: "${(literature as any).englishTitle || literature.title}"`;

        const prompt = `你是一名资深科研数据提取专家。你的任务是通过联网搜索找到一篇学术文献的详细信息，并从中提取结构化的实验数据。

        【目标文献信息】：
        中文标题: ${literature.title}
        英文标题: ${(literature as any).englishTitle || ''}
        作者: ${literature.authors?.join(', ') || '未知'}
        期刊: ${literature.source || '未知'}
        年份: ${literature.year || '未知'}
        检索线索: ${searchHint}
        已有摘要片段: ${literature.abstract || '无'}

        【搜索策略】：
        请按以下优先级搜索：
        1. 先用英文标题或 DOI 搜索原文、出版商页面（Elsevier, ACS, RSC, Wiley, Springer, MDPI 等）
        2. 搜索 Google Scholar 引用信息
        3. 搜索相关综述文章中对该论文的引用描述
        4. 搜索 ResearchGate、Academia.edu 上的全文预印本

        【提取任务（必须完成，严禁留空）】：

        1. **完整学术摘要 (abstract)**：
           基于搜到的原文 Abstract，翻译为 200-300 字的高水准学术中文。必须包含研究目的、方法、关键实验结果和结论。

        2. **核心性能指标 (performance)**：
           从摘要、研究亮点(Highlights)、图文摘要(TOC)、或引用中提取所有可量化的关键性能参数。
           常见指标示例（根据文献领域选择）：
           - 催化/电化学：过电位(η)、Tafel斜率、电流密度、法拉第效率、稳定性时长、TOF
           - 材料学：BET比表面积、孔径、结晶度、带隙能、导电率
           - 电池：比容量、循环稳定性、库仑效率、功率密度、能量密度
           - 生物医学：IC50、细胞存活率、载药量、释放效率
           **即使只能从摘要中推断出 2-3 个指标，也必须提取。绝对不允许返回空数组。**

        3. **核心工艺/实验方法 (synthesisSteps)**：
           提取该研究的合成路线或实验方法论（METHODOLOGY），拆解为 3-8 个关键步骤。
           从摘要和搜索到的方法描述中提取，包括：
           - 原料与前驱体
           - 合成方法（水热法、溶胶-凝胶法、电沉积、CVD 等）
           - 关键工艺参数（温度、时间、气氛、压力等）
           - 后处理步骤（煅烧、酸洗、退火等）
           - 表征手段概述
           **即使摘要中只有粗略的方法描述，也必须基于搜索信息推导出合理的工艺步骤。不允许返回空数组。**

        4. **技术标签 (tags)**：3-5 个中文技术标签。

        5. **DOI 标识符 (doi)**：
           必须提取该文献的真实 DOI。从出版商页面、Google Scholar、CrossRef 等来源获取。
           格式示例："10.1021/jacs.5b13849"。如果确实无法找到，返回空字符串。

        【输出 JSON 格式】：
        {
          "abstract": "完整中文学术摘要 (200-300字)...",
          "doi": "10.1021/jacs.5b13849",
          "performance": [
            {"label": "过电位 (OER)", "value": "230 mV @ 10 mA/cm²"},
            {"label": "Tafel 斜率", "value": "45.2 mV/dec"}
          ],
          "synthesisSteps": [
            {"step": 1, "title": "前驱体制备", "content": "将 Ni(NO₃)₂·6H₂O 和 Fe(NO₃)₃·9H₂O 按摩尔比 3:1 溶解于去离子水中..."},
            {"step": 2, "title": "水热合成", "content": "将溶液转移至 100 mL 聚四氟乙烯衬里的高压反应釜中，120°C 反应 12h..."}
          ],
          "tags": ["层状双金属氢氧化物", "电催化", "析氧反应"]
        }`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                tools: [{ googleSearch: {} }],
            }
        });

        // 健壮的 JSON 解析：Google Search grounding 返回可能混入非 JSON 内容
        const rawText = response.text || '';
        let parsed: any = {};
        try {
            parsed = JSON.parse(extractJson(rawText));
        } catch (e1) {
            // 二次清洗：去除控制字符、移除可能混入的 grounding 标注
            try {
                let cleaned = rawText
                    .replace(/```json\s*/gi, '')
                    .replace(/```\s*/gi, '')
                    .replace(/[\x00-\x1F\x7F]/g, ' ') // 去除控制字符
                    .replace(/,\s*([\]}])/g, '$1'); // 去除尾部逗号

                // 提取 { } 之间的内容
                const firstBrace = cleaned.indexOf('{');
                const lastBrace = cleaned.lastIndexOf('}');
                if (firstBrace >= 0 && lastBrace > firstBrace) {
                    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
                }
                parsed = JSON.parse(cleaned);
            } catch (e2) {
                console.warn('enrichLiteratureFromSearch: JSON 解析失败，返回空结构', e2);
                parsed = { abstract: '', performance: [], synthesisSteps: [], tags: [] };
            }
        }
        return parsed;
    });
};

/**
 * NEW: Deep knowledge sink - extract tables and parameters from text/metadata
 */
export const extractKnowledgeSinkAI = async (literature: Literature, fullText?: string) => {
    return callGeminiWithRetry(async (ai) => {
        const context = fullText || literature.abstract;
        const prompt = `你是一名资深科研数据分析师。请对以下文献进行“知识沉淀”审计。
        
        【目标文献】：${literature.title}
        【内容】：${context.substring(0, 15000)}

        【任务要求】：
        1. **提取核心实验参数**：将其结构化为 performance 指标对。
        2. **提取数据表格**：识别文中描述的所有实验数据表，返回包含 headers 和 rows 的结构。
        3. **提取合成工艺**：细化为具体的步骤。
        
        输出 JSON。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        performance: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    label: { type: Type.STRING },
                                    value: { type: Type.STRING }
                                }
                            }
                        },
                        synthesisSteps: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    step: { type: Type.NUMBER },
                                    title: { type: Type.STRING },
                                    content: { type: Type.STRING }
                                }
                            }
                        },
                        extractedTables: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    title: { type: Type.STRING },
                                    headers: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } }
                                }
                            }
                        }
                    }
                }
            }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

/**
 * 从工艺描述中提取所需资源，并智能对标现有库存
 */
export const performSmartInventoryAudit = async (routeTitle: string, routeContent: string, inventory: InventoryItem[]) => {
    return callGeminiWithRetry(async (ai) => {
        const inventorySummary = inventory.map(i => ({
            id: i.id,
            name: i.name,
            formula: i.formula,
            category: i.category,
            quantity: i.quantity,
            unit: i.unit,
            threshold: i.threshold,
            location: i.location,
            brand: i.brand
        }));

        const prompt = `你是一名顶级实验室物资审计专家和资深化学工艺师。请深度执行以下【工艺路线】与【实时库存数据库】的语义化对标审计。

        【审计对象 - 工艺路线】：
        标题: ${routeTitle}
        内容: ${routeContent}

        【数据源 - 实验室实时库存库】：
        ${JSON.stringify(inventorySummary)}

        【核心任务指令】：
        1. **精准语义提取**：从工艺中提取所有必需的“化学试剂/前驱体/溶剂”和“实验设备”。
        2. **强制匹配关联**：
           - **已具备 (Ready)**：名称 or 分子式完全匹配且库存充足。必须返回对应的库存 id。
           - **智能替代 (Substitute)**：如果原始试剂缺失，搜索功能等效项（如不同水合程度的盐、极性接近的溶剂、浓度可折算的溶液）。必须返回匹配的库存项 id。
           - **库存不足 (Low)**：匹配成功但余量低于预警阈值。必须返回对应的库存 id。
           - **物资缺失 (Missing)**：库内完全无可用资源。
        3. **深度推理要求**：
           - 对于【智能替代】：在 'reasoning'字段中给出硬核的化学依据（例如：离子强度一致性、杂质干扰评估、溶剂化效应）。
           - 对于【物资缺失】：在 'reasoning' 字段分析该物资缺失对工艺的破坏性（如：反应无法启动、收率大幅降低）。
        
        【重要强制性要求】：所有输出文本，包括 'reasoning' 和 'name'字段，必须且只能使用专业的学术中文。严禁输出任何英文内容。
        
        【输出 JSON 格式】：
        {
          "reagents": [
            { 
              "name": "工艺要求的名称", 
              "status": "ready|substitute|low|missing", 
              "matchedInventoryId": "关联的库存条目ID (如果是 missing 则为空)", 
              "matchedName": "库存中的实际名称 (如果是 missing 则为空)", 
              "isAlternative": true/false, 
              "reasoning": "详细的替代科学依据 或 缺货影响分析（务必详尽）" 
            }
          ],
          "equipment": [...]
        }

        要求: 学术专业性极强，推理逻辑闭环。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        reagents: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    status: { type: Type.STRING, enum: ['ready', 'substitute', 'missing', 'low'] },
                                    matchedInventoryId: { type: Type.STRING },
                                    matchedName: { type: Type.STRING },
                                    isAlternative: { type: Type.BOOLEAN },
                                    reasoning: { type: Type.STRING }
                                },
                                required: ["name", "status", "reasoning"]
                            }
                        },
                        equipment: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    status: { type: Type.STRING, enum: ['ready', 'substitute', 'missing', 'low'] },
                                    matchedInventoryId: { type: Type.STRING },
                                    matchedName: { type: Type.STRING },
                                    isAlternative: { type: Type.BOOLEAN },
                                    reasoning: { type: Type.STRING }
                                },
                                required: ["name", "status", "reasoning"]
                            }
                        }
                    },
                    required: ["reagents", "equipment"]
                }
            }
        });
        return JSON.parse(extractJson(response.text || '{"reagents":[], "equipment":[]}'));
    });
};

export type SearchField = 'topic' | 'title' | 'author' | 'doi';

/**
 * 智能资源搜索：模拟 Web of Science 执行高精度学术情报检索
 * searchField: topic(主题) | title(标题) | author(作者) | doi(DOI)
 */
export const smartResourceSearch = async (keywords: string[], type: string, filters: SearchFilters, searchField: SearchField = 'topic') => {
    return callGeminiWithRetry(async (ai) => {
        const typeConstraint = filters.docType === 'All' ? "" : `类型限定为: ${filters.docType}`;
        const impactConstraint = filters.highImpactOnly ? "优先搜索并返回 Nature, Science, JACS, Angewandte, Advanced Materials, Cell 等顶级期刊的成果。" : "搜索全网学术数据库。";
        const timeConstraint = filters.timeRange === 'all' ? "" : `出版日期限定在最近 ${filters.timeRange.replace('y', '')} 年内。`;

        const fieldInstructions: Record<SearchField, string> = {
            topic: `使用 WoS 主题字段 (TS=) 检索——在标题、摘要、关键词中全范围匹配关键词 "${keywords.join(', ')}"，返回主题相关的最重要成果。`,
            title: `使用 WoS 标题字段 (TI=) 精确检索——仅返回【标题】中包含 "${keywords.join(', ')}" 的文献，要求标题精准匹配，严禁返回仅摘要相关的结果。`,
            author: `使用 WoS 作者字段 (AU=) 检索——仅返回【作者姓名】精确匹配 "${keywords.join(', ')}" 的文献。请真实搜索该作者在各大数据库的公开发表记录，列出其代表性著作。`,
            doi: `使用 WoS DOI 字段 (DO=) 精确检索——直接查找 DOI 为 "${keywords.join(', ')}" 的【唯一确定文献】，必须返回该 DOI 对应的真实文献信息，若无法确认则返回空数组。`,
        };

        // 轻量检索 Prompt：只返回基础书目信息，不提取性能指标和工艺步骤
        const prompt = `你是一名资深的学术情报专家，正在使用 Web of Science 进行高精度检索。
        
        【检索指令 (${searchField.toUpperCase()} 字段)】：${fieldInstructions[searchField]}
        【检索对象类型】：真实【${type}】
        
        【高级检索过滤器】：
        1. 文献类型: ${filters.docType}
        2. 质量权重: ${impactConstraint}
        3. 时间限制: ${timeConstraint}

        【核心要求 — 仅返回基础书目信息】：
        1. **真实性溯源**：严禁虚构。必须基于 Google Search 返回的真实学术记录。
        2. **双语标题映射**：每条结果必须包含专业的学术中文标题 (title) 和对应的原始英文标题 (englishTitle)。
        3. **基础元数据**：必须提取真实的出版年份 (year)、来源期刊 (source)、作者列表 (authors) 以及真实的 URL 和 DOI。
        4. **简短摘要**：摘要 (abstract) 翻译为 50-100 字的学术中文概要即可，无需详尽翻译。
        5. **学术分类**：生成一个简短中文分类标签 (category)。
        
        【注意】：本阶段仅做文献发现，无需提取性能指标或合成步骤。保持结果精简以提高检索速度。
        
        输出格式：返回一个 JSON 数组。`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL, // 使用 Flash 模型极速检索
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                tools: [{ googleSearch: {} }],
            }
        });

        let rawItems = [];
        try {
            rawItems = JSON.parse(extractJson(response.text || '[]'));
            if (!Array.isArray(rawItems)) rawItems = [];
        } catch (e) {
            console.warn("JSON Parse failed in smartResourceSearch", e);
        }

        const sessionPrefix = `search_${Date.now()}`;
        const items = rawItems.map((item: any, idx: number) => {
            return {
                ...item,
                id: `${sessionPrefix}_${idx}`,
                englishTitle: item.englishTitle || item.title_en || "",
                year: parseInt(String(item.year)) || new Date().getFullYear(),
                source: item.source || "Academic Database",
                authors: Array.isArray(item.authors) ? item.authors : (typeof item.authors === 'string' ? [item.authors] : []),
                abstract: item.abstract || "",
                category: item.category || type,
                performance: [], // 轻量检索阶段不提取
                synthesisSteps: [], // 轻量检索阶段不提取
                isTopTier: !!item.isTopTier
            };
        });

        const groundingSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
            ?.map((c: any) => ({
                title: c.web?.title || 'Verified Source',
                uri: c.web?.uri
            }))
            .filter((s: any) => s.uri) || [];

        return { items, groundingSources };
    });
};

/**
 * 解析资源 file
 */
/**
 * 解析本地资源文件 - 深度解析模式
 * 支持文本内容或 Base64 原始字节（用于 PDF/图片 多模态解析）
 */
export const parseResourceFile = async (payload: string | { mimeType: string, data: string }, type: string) => {
    return callGeminiWithRetry(async (ai) => {
        const isMultimodal = typeof payload === 'object';
        const contentPart = isMultimodal
            ? { inlineData: { mimeType: payload.mimeType, data: payload.data } }
            : { text: `文档片段: "${payload.substring(0, 15000)}"` };

        const prompt = `你是一名资深的全球科研情报专家和翻译官。请对上传的【${type}】原始文件执行深度语义解析。
        
        【解析目标】：
        1. **精准元数据提取**：识别原始论文/报告中的真实标题 (title)、原始英文标题 (englishTitle)、作者列表 (authors)、出版年份 (year)、发表刊物/来源 (source)、DOI (如果存在)。
        2. **高维度性能指标**：从实验数据部分提取所有关键的性能指标（指标名、数值、单位），结构化为 performance 数组。
        3. **全流程合成路线**：精准提取实验步骤或工艺流程，结构化为 synthesisSteps 数组。
        4. **学术摘要重构**：将背景和结论重新整理并翻译为不少于 300 字的高水准专业学术中文摘要 (abstract)。
        5. **深度标签系统**：基于文档内容自动生成 3-5 个专业技术标签 (tags)。
        
        【输出 JSON 结构要求】：
        {
            "title": "中文主标题",
            "englishTitle": "Original English Title",
            "authors": ["Author 1", "Author 2"],
            "year": 2026,
            "source": "Journal Name / Source",
            "doi": "10.xxxx/xxxx",
            "abstract": "深度学术摘要内容...",
            "category": "学术分类",
            "tags": ["标签1", "标签2"],
            "performance": [{"label": "指标名", "value": "数值及单位"}],
            "synthesisSteps": [{"step": 1, "title": "步骤名", "content": "详细操作描述"}]
        }
        
        请基于文档的【真实信息】进行提取，不要凭空捏造。如果没有找到某项信息，请保持为空。`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL, // 改为使用 Flash 模型，速度提升 5-10 倍且大幅减少限流概率
            contents: [
                { role: 'user', parts: [contentPart, { text: prompt }] }
            ],
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        englishTitle: { type: Type.STRING },
                        authors: { type: Type.ARRAY, items: { type: Type.STRING } },
                        year: { type: Type.NUMBER },
                        source: { type: Type.STRING },
                        doi: { type: Type.STRING },
                        abstract: { type: Type.STRING },
                        category: { type: Type.STRING },
                        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                        performance: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: { label: { type: Type.STRING }, value: { type: Type.STRING } }
                            }
                        },
                        synthesisSteps: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    step: { type: Type.NUMBER },
                                    title: { type: Type.STRING },
                                    content: { type: Type.STRING }
                                }
                            }
                        }
                    }
                }
            }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

/**
 * 深度文献分析 - 极速研读模式
 */
export const analyzeLiteratureDeeply = async (item: Literature, filePayload?: any) => {
    return callGeminiWithRetry(async (ai) => {
        const isMultimodal = filePayload && filePayload.mimeType;
        const contentPart = isMultimodal
            ? { inlineData: { mimeType: filePayload.mimeType, data: filePayload.data } }
            : { text: `摘要: ${item.abstract}\\n标题: ${item.title}` };

        const prompt = `你是一名科研研读助手。请基于提供的文献内容进行深度总结。
        
        【任务】：
        1. 生成 150 字左右的执行摘要 (executiveSummary)。
        2. 提取 3-5 个关键术语及其定义 (glossary)。
        3. 提出 3 个最值得探讨的学术问题 (keyQuestions)。
        4. 生成一个层级化的概念树 (conceptTree)，包含 4 个主分支：
           - "研究问题" (icon: "bullseye")：文献要解决的核心科学问题，2-4 个子项
           - "研究方法" (icon: "flask")：使用的关键方法/技术，2-4 个子项
           - "关键发现" (icon: "lightbulb")：最重要的实验结果/发现，2-4 个子项  
           - "局限与展望" (icon: "road")：研究的局限性和未来方向，2-3 个子项
           每个子项也是一个对象，包含 label（简短描述，15字以内）和 detail（详细说明，30字以内）。
        
        输出 JSON 格式。`;

        const conceptNodeSchema = {
            type: Type.OBJECT,
            properties: {
                label: { type: Type.STRING },
                detail: { type: Type.STRING }
            }
        };

        const conceptBranchSchema = {
            type: Type.OBJECT,
            properties: {
                label: { type: Type.STRING },
                icon: { type: Type.STRING },
                children: {
                    type: Type.ARRAY,
                    items: conceptNodeSchema
                }
            }
        };

        const response = await ai.models.generateContent({
            model: FAST_MODEL, // 使用 Flash 进行极速研读
            contents: [
                { role: 'user', parts: [contentPart, { text: prompt }] }
            ],
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        executiveSummary: { type: Type.STRING },
                        glossary: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    term: { type: Type.STRING },
                                    definition: { type: Type.STRING }
                                }
                            }
                        },
                        keyQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                        conceptTree: {
                            type: Type.ARRAY,
                            items: conceptBranchSchema
                        }
                    }
                }
            }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

/**
 * 资源摘要对比
 */
export const summarizeResourcesToTable = async (resources: Literature[], type: string) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名顶级科研情报分析师。请对比分析以下 ${resources.length} 篇【${type}】。
        
        【文献详细数据】：
        ${JSON.stringify(resources.map(r => ({ title: r.title, performance: r.performance, authors: r.authors, year: r.year })))}
        
        【核心任务】：
        1. **构建对比矩阵 (comparisonTable)**：
           - **headers**：第一列必须是“文献标题 (Project/Literature)”，后续列应提取关键性能指标、作者、年份等核心维度。
           - **rows**：每一行对应一篇文献，必须填写真实提取的数据。
        2. **提取 3 条对比见解 (insights)**：分析各文献间的优劣、协同效应或技术演进趋势。
        
        【强制要求】：必须返回完整的对比矩阵 JSON。如果某项指标缺失，请填写“/”。
        
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
                        comparisonTable: {
                            type: Type.OBJECT,
                            properties: {
                                headers: { type: Type.ARRAY, items: { type: Type.STRING } },
                                rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } }
                            },
                            required: ["headers", "rows"]
                        },
                        insights: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["comparisonTable", "insights"]
                }
            }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

/**
 * 基于文献生成转化方案
 */
export const generateProposalFromLiterature = async (projectTitle: string, contextData: string, filePayload?: any) => {
    return callGeminiWithRetry(async (ai) => {
        const fileContext = filePayload ? `文献全文: ${filePayload.data.substring(0, 10000)}` : "";
        const prompt = `你是一名资深催化工艺专家。请基于以下情报为项目 "${projectTitle}" 生成一份具体的工艺转化建议。
        
        情报内容:
        ${contextData}
        ${fileContext}
        
        【强制指令】：
        1. **工艺改良建议标题 (proposalTitle)**：提出一个具有学术深度的标题。
        2. **科学假设 (scientificHypothesis)**：基于文献情报，提出本次转化的科学前提或理论基础。
        3. **关键路径变更说明 (processChanges)**：对比原始工艺与改良后的工艺，详细说明核心变更点。**必须使用 Markdown 格式（如使用列表、加粗等）以保证排版美观清晰**。
        4. **性能指标矩阵 (optimizedParameters)**：预测改良后的关键性能指标（如收率、选择性等）。必须返回对象数组，格式为 [{"key": "指标名", "value": "预测值", "reason": "预估理由"}]。
        5. **关键工艺参数建议 (controlParameters)**：为了达到上述性能，建议在实验中控制的关键变量（如温度、压力、配比等）。必须返回对象数组，格式为 [{"key": "参数名", "value": "建议范围/值", "reason": "控制理由"}]。
        6. **建议优化工艺路线 (newFlowchart)**：提供完整的、可执行的工艺步骤。必须返回对象数组，格式为 [{"step": "操作阶段名称", "action": "具体操作动作描述"}]。
        
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
                        proposalTitle: { type: Type.STRING },
                        scientificHypothesis: { type: Type.STRING },
                        processChanges: { type: Type.STRING },
                        optimizedParameters: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    key: { type: Type.STRING },
                                    value: { type: Type.STRING },
                                    reason: { type: Type.STRING }
                                }
                            }
                        },
                        controlParameters: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    key: { type: Type.STRING },
                                    value: { type: Type.STRING },
                                    reason: { type: Type.STRING }
                                }
                            }
                        },
                        newFlowchart: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    step: { type: Type.STRING },
                                    action: { type: Type.STRING }
                                }
                            }
                        }
                    },
                    required: ["proposalTitle", "scientificHypothesis", "processChanges", "optimizedParameters", "controlParameters", "newFlowchart"]
                }
            }
        });

        const raw = JSON.parse(extractJson(response.text || '{}'));

        // 鲁棒性增强：对 AI 返回的字段名进行“归一化”处理，防止哪怕有 Schema 约束时 AI 依然幻觉出其他键名
        return {
            proposalTitle: raw.proposalTitle || raw.title || "学术转化建议",
            scientificHypothesis: raw.scientificHypothesis || raw.hypothesis || "基于文献情报的科学推演",
            processChanges: raw.processChanges || raw.changes || "",
            optimizedParameters: (raw.optimizedParameters || raw.performance || []).map((p: any) => ({
                key: p.key || p.label || p.name || "指标",
                value: String(p.value || ""),
                reason: p.reason || p.description || p.rationale || ""
            })),
            controlParameters: (raw.controlParameters || raw.parameters || []).map((p: any) => ({
                key: p.key || p.label || p.name || "参数",
                value: String(p.value || ""),
                reason: p.reason || p.description || p.rationale || ""
            })),
            newFlowchart: (raw.newFlowchart || raw.flowchart || raw.steps || raw.synthesisSteps || []).map((s: any, idx: number) => ({
                step: String(s.step || s.title || `步骤 ${idx + 1}`),
                action: s.action || s.content || s.description || (typeof s === 'string' ? s : "")
            }))
        };
    });
};