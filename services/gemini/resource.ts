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

export type SearchField = 'topic' | 'title' | 'author' | 'doi' | 'patent';

/**
 * 智能资源搜索：模拟 Web of Science 执行高精度学术情报检索
 * searchField: topic(主题) | title(标题) | author(作者) | doi(DOI)
 */
export const smartResourceSearch = async (keywords: string[], type: string, filters: SearchFilters, searchField: SearchField = 'topic') => {
    const { cleanAcademicTitle } = await import('../../utils/cleanTitle');

    // ─── Step 0: 中文关键词自动翻译 ─────────────────────────────
    // OpenAlex 是英文学术数据库，中文关键词需先翻译为英文
    const hasChinese = /[\u4e00-\u9fff]/.test(keywords.join(''));
    let searchQuery = keywords.join(' ');

    if (hasChinese && searchField !== 'doi') {
        try {
            const translated = await callGeminiWithRetry(async (ai) => {
                const response = await ai.models.generateContent({
                    model: FAST_MODEL,
                    contents: `将以下中文学术关键词翻译为对应的英文学术术语，用于学术数据库检索。
只返回翻译后的英文关键词，用空格分隔，不要加任何解释或标点符号。
已经是英文的词（如 ORR, OER, XRD）保持原样。

输入：${keywords.join(', ')}`,
                    config: { ...SPEED_CONFIG, temperature: 0 }
                });
                return response.text?.trim() || '';
            });
            if (translated) {
                // 彻底清理无用字符（如 Markdown 代码块符号、逗号、句号等），仅保留字母、数字、短横线和空格
                searchQuery = translated
                    .replace(/[`*\n,;:"'[\]{}()]/g, ' ') // 各种可疑符号换成空格
                    .replace(/\s+/g, ' ')                  // 合并多余连续空格
                    .trim();
                console.log(`[OpenAlex] 中文关键词翻译: "${keywords.join(', ')}" → "${searchQuery}"`);
            }
        } catch (e) {
            console.warn('[OpenAlex] 关键词翻译失败，使用原始关键词:', e);
        }
    }

    // ─── Step 1: 构建 OpenAlex API 查询 ──────────────────────────
    // OpenAlex 是全球最大的开放学术数据库（2.5亿+ 论文），数据 100% 真实
    // 对输入关键词进行相同清理，确保如果没有中文（或翻译失败）时也没有奇怪符号
    const cleanQuery = searchQuery.replace(/[`*\n,;:"'[\]{}()]/g, ' ').replace(/\s+/g, ' ').trim();
    const currentYear = new Date().getFullYear();
    let apiUrl = '';

    // 时间过滤
    const yearRange = filters.timeRange === 'all' ? '' : filters.timeRange.replace('y', '');
    const fromYear = yearRange ? currentYear - parseInt(yearRange) : 0;
    const yearFilter = fromYear ? `,publication_year:>${fromYear}` : '';

    switch (searchField) {
        case 'doi':
            // DOI 精确检索
            const doiQuery = encodeURIComponent(cleanQuery.replace('https://doi.org/', ''));
            apiUrl = `https://api.openalex.org/works/https://doi.org/${doiQuery}`;
            break;
        case 'author':
            apiUrl = `https://api.openalex.org/works?filter=authorships.author.display_name.search:${encodeURIComponent(cleanQuery)}${yearFilter}&sort=cited_by_count:desc&per_page=8`;
            break;
        case 'title':
            apiUrl = `https://api.openalex.org/works?filter=title.search:${encodeURIComponent(cleanQuery)}${yearFilter}&sort=cited_by_count:desc&per_page=8`;
            break;
        case 'topic':
        default:
            apiUrl = `https://api.openalex.org/works?search=${encodeURIComponent(cleanQuery)}&filter=type:article${yearFilter}&sort=relevance_score:desc&per_page=8`;
            break;
    }

    // 如果要高影响力，加引用数过滤
    if (filters.highImpactOnly && searchField !== 'doi') {
        if (apiUrl.includes('filter=')) {
            apiUrl = apiUrl.replace(/([?&]filter=[^&]+)(.*)$/, '$1,cited_by_count:>10$2');
        } else {
            apiUrl += apiUrl.includes('?') ? '&filter=cited_by_count:>10' : '?filter=cited_by_count:>10';
        }
    }

    // 添加 mailto 以获得更高速率限制（OpenAlex 礼貌池）
    apiUrl += (apiUrl.includes('?') ? '&' : '?') + 'mailto=sciflow@example.com';

    console.log('[OpenAlex] Searching URL:', apiUrl);

    // ─── Step 2: 调用 OpenAlex API ───────────────────────────────
    let openAlexWorks: any[] = [];
    try {
        const res = await fetch(apiUrl, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15000)
        });
        
        console.log('[OpenAlex] Response Status:', res.status, res.statusText);

        if (res.ok) {
            const data = await res.json();
            console.log('[OpenAlex] Response Data Results Count:', data?.results?.length || (data.id ? 1 : 0));
            // DOI 检索返回单个对象，其他返回 results 数组
            if (searchField === 'doi' && data.id) {
                openAlexWorks = [data];
            } else {
                openAlexWorks = data.results || [];
            }
        } else {
            const errText = await res.text();
            console.warn('[OpenAlex] API error response:', res.status, errText);
        }
    } catch (e) {
        console.error('[OpenAlex] Network fetch error:', e);
    }

    if (openAlexWorks.length === 0) {
        console.warn('[OpenAlex] 最终获取到的结果数量为 0。使用关键词:', cleanQuery);
        return { items: [], groundingSources: [] };
    }

    // ─── Step 3: 提取元数据（100% 真实数据）────────────────────────
    const realPapers = openAlexWorks.map((work: any) => {
        const doi = work.doi?.replace('https://doi.org/', '') || '';
        const title = cleanAcademicTitle(work.title || '');
        const authors = work.authorships?.map((a: any) => a.author?.display_name).filter(Boolean) || [];
        const year = work.publication_year || currentYear;
        const source = work.primary_location?.source?.display_name || work.host_venue?.display_name || '';
        const volume = work.biblio?.volume || '';
        const issue = work.biblio?.issue || '';
        const firstPage = work.biblio?.first_page || '';
        const lastPage = work.biblio?.last_page || '';
        const pages = firstPage && lastPage ? `${firstPage}-${lastPage}` : firstPage || '';
        const url = work.primary_location?.landing_page_url || (doi ? `https://doi.org/${doi}` : '');
        const oaUrl = work.open_access?.oa_url || '';
        // 提取英文摘要（OpenAlex 提供 abstract_inverted_index，需还原）
        let abstract = '';
        if (work.abstract_inverted_index) {
            const invertedIndex = work.abstract_inverted_index;
            const words: [string, number][] = [];
            for (const [word, positions] of Object.entries(invertedIndex)) {
                for (const pos of (positions as number[])) {
                    words.push([word, pos]);
                }
            }
            words.sort((a, b) => a[1] - b[1]);
            abstract = words.map(w => w[0]).join(' ');
        }

        return { englishTitle: title, authors, year, source, doi, url, volume, issue, pages, abstract, oaUrl };
    });

    // ─── Step 4: 用 AI 批量翻译标题和摘要为中文 ──────────────────
    let translatedItems = realPapers;
    try {
        const translationResult = await callGeminiWithRetry(async (ai) => {
            const toTranslate = realPapers.map((p, i) => ({
                idx: i,
                t: p.englishTitle,
                a: p.abstract.substring(0, 300) // 截断过长摘要
            }));

            const prompt = `请将以下学术论文标题和摘要翻译为中文。要求：
1. 标题翻译要专业、准确、符合学术中文表达习惯
2. 摘要翻译为 50-80 字的精炼概要
3. 为每篇论文生成一个简短的中文学术分类标签（如"电催化"、"纳米材料"等）

输入：
${JSON.stringify(toTranslate)}

输出 JSON 数组，每项包含：
- idx: 对应序号
- title: 中文标题
- abstract: 中文精炼概要（50-80字）
- category: 中文分类标签`;

            const response = await ai.models.generateContent({
                model: FAST_MODEL,
                contents: prompt,
                config: SPEED_CONFIG
            });

            return JSON.parse(extractJson(response.text || '[]'));
        });

        if (Array.isArray(translationResult)) {
            translatedItems = realPapers.map((paper, idx) => {
                const tr = translationResult.find((t: any) => t.idx === idx) || {};
                return {
                    ...paper,
                    title: tr.title || paper.englishTitle,
                    abstract: tr.abstract || paper.abstract,
                    category: tr.category || type
                };
            });
        }
    } catch (e) {
        console.warn('[Translation] AI translation failed, using English:', e);
        translatedItems = realPapers.map(p => ({
            ...p,
            title: p.englishTitle,
            category: type
        }));
    }

    // ─── Step 5: 构造最终结果 ────────────────────────────────────
    const sessionPrefix = `search_${Date.now()}`;
    const items = translatedItems.map((item: any, idx: number) => ({
        ...item,
        id: `${sessionPrefix}_${idx}`,
        englishTitle: item.englishTitle || '',
        year: parseInt(String(item.year)) || currentYear,
        source: item.source || 'Academic Database',
        authors: Array.isArray(item.authors) ? item.authors : [],
        abstract: item.abstract || '',
        category: item.category || type,
        volume: item.volume || '',
        issue: item.issue || '',
        pages: item.pages || '',
        performance: [],
        synthesisSteps: [],
        isTopTier: false,
        oaUrl: item.oaUrl || '',
        tags: ['OpenAlex 真实文献']
    }));

    // 构造溯源链接
    const groundingSources = openAlexWorks.slice(0, 6).map((w: any) => ({
        title: cleanAcademicTitle(w.title).substring(0, 60),
        uri: w.primary_location?.landing_page_url || w.doi || ''
    })).filter((s: any) => s.uri);

    return { items, groundingSources };
};

/**
 * 智能专利检索 — 混合模式
 * 
 * 1️⃣ 优先方案：EPO OPS API 真实数据 + Gemini 中文翻译/摘要增强
 * 2️⃣ 回退方案：纯 Gemini + Google Search Grounding（无 EPO Key 时）
 */
export const smartPatentSearch = async (keywords: string[], filters: SearchFilters) => {
    // 动态导入 EPO API 客户端
    const { isEpoConfigured, searchEpoPatents } = await import('../patentApi');

    // ─── 优先方案：EPO API + Gemini 翻译 ───────────────────────
    if (isEpoConfigured()) {
        try {
            const epoResults = await searchEpoPatents(keywords, 12);
            if (epoResults.length > 0) {
                return await enhanceEpoResultsWithAI(epoResults, keywords);
            }
        } catch (err) {
            console.warn('[Patent Hybrid] EPO 搜索失败，回退到 Gemini 方案:', err);
        }
    }

    // ─── 回退方案：纯 Gemini + Google Search ─────────────────────
    return smartPatentSearchGemini(keywords, filters);
};

/**
 * EPO 真实数据 + Gemini AI 翻译/摘要增强
 */
async function enhanceEpoResultsWithAI(
    epoResults: import('../patentApi').EpoPatentResult[],
    keywords: string[]
) {
    const sessionPrefix = `patent_${Date.now()}`;

    // 构造需要 AI 翻译/增强的批次数据
    const needsTranslation = epoResults.filter(p => !p.title || p.title === p.titleEn);
    
    let translatedMap: Record<string, { title: string; abstract: string; claims: string; status: string }> = {};
    
    if (needsTranslation.length > 0) {
        try {
            translatedMap = await callGeminiWithRetry(async (ai) => {
                const dataForAI = needsTranslation.map(p => ({
                    pn: p.patentNumber,
                    titleEn: p.titleEn || p.title,
                    abstractEn: p.abstractEn || p.abstract,
                    kind: p.kind,
                }));

                const response = await ai.models.generateContent({
                    model: PRO_MODEL,
                    contents: `你是专利翻译专家。将以下专利信息翻译为中文，并判断法律状态。

专利数据：
${JSON.stringify(dataForAI, null, 2)}

对每条专利返回：
- pn: 原专利号
- title: 中文标题
- abstract: 中文摘要概要（50-150字）
- claims: 核心权利要求概要（30-80字，如无信息则留空）
- status: 法律状态推断（基于 kind 代码判断："已授权"(B类)、"审查中"(A类)、"PCT国际申请"(WO)）`,
                    config: {
                        ...SPEED_CONFIG,
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                translations: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            pn: { type: Type.STRING },
                                            title: { type: Type.STRING },
                                            abstract: { type: Type.STRING },
                                            claims: { type: Type.STRING },
                                            status: { type: Type.STRING },
                                        },
                                        required: ['pn', 'title']
                                    }
                                }
                            },
                            required: ['translations']
                        }
                    }
                });

                const parsed = JSON.parse(extractJson(response.text || '{"translations":[]}'));
                const map: Record<string, any> = {};
                for (const t of (parsed.translations || [])) {
                    if (t.pn) map[t.pn] = t;
                }
                return map;
            });
        } catch (err) {
            console.warn('[Patent Hybrid] AI 翻译增强失败，使用原始数据:', err);
        }
    }

    // 合并 EPO 真实数据 + AI 翻译
    const items = epoResults.map((p, idx) => {
        const ai = translatedMap[p.patentNumber] || {};
        const title = ai.title || p.title || p.titleEn || '未知专利';
        const abstract = ai.abstract || p.abstract || p.abstractEn || '';
        const status = ai.status || inferStatus(p.kind);
        const claims = ai.claims || '';

        return {
            id: `${sessionPrefix}_${idx}`,
            title,
            englishTitle: p.titleEn || '',
            authors: p.inventors.length > 0 ? p.inventors : p.applicants,
            year: p.filingDate ? parseInt(p.filingDate.split('-')[0]) : new Date().getFullYear(),
            source: `${p.applicants[0] || ''} (${p.patentNumber})`,
            doi: '',
            url: p.sourceUrl,
            abstract,
            category: '专利',
            volume: '',
            issue: '',
            pages: '',
            performance: [
                { label: '专利号', value: p.patentNumber },
                { label: '法律状态', value: status },
                { label: 'IPC 分类', value: p.ipcCodes[0] || '' },
                { label: '申请人', value: p.applicants[0] || '' },
                ...(p.country ? [{ label: '所属地区', value: p.country }] : []),
            ].filter(m => m.value),
            synthesisSteps: claims ? [{ step: 1, title: '核心权利要求', content: claims }] : [],
            tags: ['专利检索', 'EPO 验证', p.country, status].filter(Boolean),
            isTopTier: false,
            _patentMeta: {
                patentNumber: p.patentNumber,
                applicant: p.applicants[0] || '',
                filingDate: p.filingDate,
                publicationDate: p.publicationDate,
                status,
                ipcCode: p.ipcCodes[0] || '',
                claims,
                country: p.country,
                patentType: inferPatentType(p.kind),
                familyId: p.familyId,
                verified: true, // 标记为 EPO 验证数据
            }
        };
    });

    const groundingSources = epoResults.slice(0, 6).map(p => ({
        title: `${p.patentNumber} - ${(p.title || p.titleEn || '').substring(0, 40)}`,
        uri: p.sourceUrl,
    }));

    return { items, groundingSources };
}

/** 根据 Kind 代码推断法律状态 */
function inferStatus(kind: string): string {
    if (!kind) return '未知';
    const k = kind.toUpperCase();
    if (k.startsWith('B')) return '已授权';
    if (k.startsWith('A')) return '审查中';
    if (k === 'U' || k === 'Y') return '实用新型';
    return '审查中';
}

/** 根据 Kind 代码推断专利类型 */
function inferPatentType(kind: string): string {
    if (!kind) return '发明';
    const k = kind.toUpperCase();
    if (k === 'U' || k === 'Y') return '实用新型';
    if (k === 'S') return '外观设计';
    return '发明';
}

/**
 * 纯 Gemini 回退方案（原始实现）
 */
const smartPatentSearchGemini = async (keywords: string[], filters: SearchFilters) => {
    return callGeminiWithRetry(async (ai) => {
        const currentDate = new Date().toISOString().split('T')[0];
        const yearRange = filters.timeRange === 'all' ? '' : filters.timeRange.replace('y', '');
        const fromYear = yearRange ? new Date().getFullYear() - parseInt(yearRange) : 0;
        const timeConstraint = fromYear ? `\n时间范围限制：仅搜索 ${fromYear} 年以后公开的专利。` : '';

        const prompt = `你是一名资深的全球专利检索分析师，精通中/美/欧/日/韩五大知识产权局的专利数据库。

【检索任务】：
基于以下关键词进行全球专利检索：
关键词：${keywords.join('、')}
当前日期：${currentDate}${timeConstraint}

【检索策略】：
1. 优先搜索 Google Patents (patents.google.com) 获取最全面的专利信息
2. 交叉验证 CNIPA (中国国家知识产权局)、USPTO (美国专利商标局)、Espacenet (欧洲专利局)
3. 覆盖发明专利、实用新型、外观设计三种类型
4. 优先返回与关键词高度相关的核心专利，而非边缘关联专利

【输出要求】：
返回 8-12 条最相关的专利，每条必须包含以下字段（全部使用中文，专利号除外）：

- patentNumber: 完整专利号（如 CN114123456A, US11234567B2, EP3456789A1）
- title: 专利中文标题（如果是外文专利，翻译为中文）
- englishTitle: 原始英文/外文标题（中国专利则为英文翻译）
- applicant: 申请人/专利权人（机构或个人名称）
- inventors: 发明人列表
- filingDate: 申请日（YYYY-MM-DD 格式）
- publicationDate: 公开/公告日（YYYY-MM-DD 格式）
- status: 法律状态（"已授权" | "审查中" | "已失效" | "已撤回" | "PCT国际申请"）
- ipcCode: IPC 分类号（如 H01M 10/0525）
- abstract: 中文摘要（100-200字，概括技术方案要点）
- claims: 核心权利要求概要（50-100字，只取独立权利要求的关键点）
- sourceUrl: 可访问的专利全文链接（优先 Google Patents 链接）
- country: 专利所属国家/地区代码（CN/US/EP/JP/KR/WO）
- patentType: 专利类型（"发明" | "实用新型" | "外观设计" | "PCT"）

【质量要求】：
- 专利号必须符合真实格式规范
- 每条专利的信息必须基于搜索到的真实数据
- 优先返回高被引专利和行业龙头企业的专利
- 确保覆盖中美欧至少两个地区的专利`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        patents: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    patentNumber: { type: Type.STRING },
                                    title: { type: Type.STRING },
                                    englishTitle: { type: Type.STRING },
                                    applicant: { type: Type.STRING },
                                    inventors: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    filingDate: { type: Type.STRING },
                                    publicationDate: { type: Type.STRING },
                                    status: { type: Type.STRING },
                                    ipcCode: { type: Type.STRING },
                                    abstract: { type: Type.STRING },
                                    claims: { type: Type.STRING },
                                    sourceUrl: { type: Type.STRING },
                                    country: { type: Type.STRING },
                                    patentType: { type: Type.STRING }
                                },
                                required: ['patentNumber', 'title', 'applicant', 'abstract', 'status']
                            }
                        }
                    },
                    required: ['patents']
                }
            }
        });

        const parsed = JSON.parse(extractJson(response.text || '{"patents":[]}'));
        const patents = parsed.patents || [];

        // 映射为 Literature 对象以复用持久化流程
        const sessionPrefix = `patent_${Date.now()}`;
        const items = patents.map((p: any, idx: number) => ({
            id: `${sessionPrefix}_${idx}`,
            title: p.title || '未知专利',
            englishTitle: p.englishTitle || '',
            authors: p.inventors || [p.applicant || '未知'],
            year: p.filingDate ? parseInt(p.filingDate.split('-')[0]) : new Date().getFullYear(),
            source: `${p.applicant || ''} (${p.patentNumber || ''})`,
            doi: '',
            url: p.sourceUrl || '',
            abstract: p.abstract || '',
            category: '专利',
            volume: '',
            issue: '',
            pages: '',
            performance: [
                { label: '专利号', value: p.patentNumber || '' },
                { label: '法律状态', value: p.status || '未知' },
                { label: 'IPC 分类', value: p.ipcCode || '' },
                { label: '申请人', value: p.applicant || '' },
                ...(p.patentType ? [{ label: '专利类型', value: p.patentType }] : []),
                ...(p.country ? [{ label: '所属地区', value: p.country }] : []),
            ].filter(m => m.value),
            synthesisSteps: p.claims ? [{ step: 1, title: '核心权利要求', content: p.claims }] : [],
            tags: ['专利检索', p.country || '', p.status || ''].filter(Boolean),
            isTopTier: false,
            _patentMeta: {
                patentNumber: p.patentNumber,
                applicant: p.applicant,
                filingDate: p.filingDate,
                publicationDate: p.publicationDate,
                status: p.status,
                ipcCode: p.ipcCode,
                claims: p.claims,
                country: p.country,
                patentType: p.patentType,
            }
        }));

        // 构造溯源
        const groundingSources = patents.slice(0, 6)
            .filter((p: any) => p.sourceUrl)
            .map((p: any) => ({
                title: `${p.patentNumber} - ${(p.title || '').substring(0, 40)}`,
                uri: p.sourceUrl
            }));

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

/**
 * AI 分析引用关系 — 推断项目内文献之间的引用/被引用关系
 */
export const analyzeCitationRelations = async (resources: Literature[]) => {
    return callGeminiWithRetry(async (ai) => {
        const summaries = resources.map(r => ({
            id: r.id,
            title: r.title,
            englishTitle: (r as any).englishTitle || '',
            authors: r.authors?.join(', ') || '',
            year: r.year || 0,
            source: r.source || '',
            doi: r.doi || '',
            abstract: (r.abstract || '').substring(0, 200),
        }));

        const prompt = `你是一名顶级学术情报分析师，精通引文分析和学术知识图谱构建。

【任务】：分析以下 ${resources.length} 篇文献之间的引用关系。

【文献清单】：
${JSON.stringify(summaries, null, 2)}

【分析要求】：
1. **基于学术常识推断引用关系**：
   - 如果一篇综述/Review 的发表年份晚于一篇实验研究论文，且主题高度相关，则综述很可能引用了该实验论文。
   - 如果两篇论文来自相同研究组（相同作者），后发表的论文通常会引用前一篇。
   - 如果论文 B 的方法论与论文 A 高度相关且 B 年份更晚，B 可能引用了 A。
   - 对于同一研究领域的开创性工作，后续论文很可能引用之。
   
2. **置信度评分 (confidence: 0-1)**：
   - 0.9-1.0: 几乎确定（同一研究组、明确的方法继承）
   - 0.7-0.8: 高置信度（同一领域、时间线合理、主题密切相关）
   - 0.5-0.6: 中等置信度（相关领域、可能的引用关系）
   - 0.3-0.4: 低置信度（仅基于主题推测）

3. **只返回 confidence >= 0.3 的引用对**。

【输出 JSON 格式】：
{
  "relations": [
    {
      "sourceId": "引用方的文献 ID",
      "targetId": "被引用方的文献 ID",
      "type": "cites",
      "confidence": 0.85,
      "reasoning": "论文 A (2024) 采用了论文 B (2022) 提出的 NiFe-LDH 合成方法"
    }
  ]
}`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        relations: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    sourceId: { type: Type.STRING },
                                    targetId: { type: Type.STRING },
                                    type: { type: Type.STRING },
                                    confidence: { type: Type.NUMBER },
                                    reasoning: { type: Type.STRING }
                                },
                                required: ["sourceId", "targetId", "type", "confidence"]
                            }
                        }
                    },
                    required: ["relations"]
                }
            }
        });

        const parsed = JSON.parse(extractJson(response.text || '{"relations":[]}'));
        
        // Validate that IDs exist in the resource list
        const validIds = new Set(resources.map(r => r.id));
        const validRelations = (parsed.relations || []).filter((rel: any) => 
            validIds.has(rel.sourceId) && validIds.has(rel.targetId) && rel.sourceId !== rel.targetId
        );

        return validRelations;
    });
};

// ═══════════════════════════════════════════════════════════════
// AI Inventory Intelligence — 智能入库 / 兼容性检查 / OCR 识别
// ═══════════════════════════════════════════════════════════════

/**
 * 智能入库补全：先查本地 chemicalDictionary，缺失项再调 AI 补全
 * 返回字段：formula, mw, casNo, safetyLevel, storageConditions, incompatibleWith, suggestedUnit, suggestedThreshold
 */
export const smartInventoryAutofill = async (name: string) => {
    // Step 1: 先用本地字典做瞬间匹配
    const { lookupChemical } = await import('../../utils/chemicalDictionary');
    const local = lookupChemical(name);

    // 如果本地字典命中且提供了公式和危险分类，构建初步结果
    const localResult = local ? {
        formula: local.formula,
        mw: local.mw,
        safetyLevel: local.hazard,
    } : null;

    // Step 2: 无论本地是否命中，都调 AI 补全更丰富的元数据
    return callGeminiWithRetry(async (ai) => {
        const localHint = localResult
            ? `\n本地数据库已知信息（高优先级，请验证并补充）：\n- 分子式: ${localResult.formula}\n- 分子量: ${localResult.mw}\n- 初步危险分类: ${localResult.safetyLevel}`
            : '\n本地数据库中未找到该化学品信息。';

        const prompt = `你是一名资深实验室化学品信息学专家和安全主管。请对以下化学品进行全面的元数据补全。

【化学品名称】: ${name}
${localHint}

【任务要求】：
1. **CAS 号**：提供准确的 CAS 注册号。如果有多个亚型（如无水/水合物），提供最常用的。
2. **分子式**：使用下标表示法（如 H₂SO₄）。
3. **分子量**：精确到小数点后两位。
4. **安全分类**：必须是以下之一：Safe, Toxic, Corrosive, Flammable, Explosive, Oxidizer
5. **GHS 危害声明**：提供 H 编码列表（如 H302, H318）。
6. **存储条件**：具体描述（温度、避光、防潮、通风等）。
7. **不兼容物质**：列出绝对不能一起存放的物质类别（如"强氧化剂"、"碱类"等）。
8. **建议单位和预警阈值**：根据该化学品常见的实验室使用场景推荐。
9. **简要说明**：20字以内的用途概述。

【强制要求】：所有输出内容使用中文。CAS 号、分子式等保持通用格式。`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        formula: { type: Type.STRING },
                        mw: { type: Type.NUMBER },
                        casNo: { type: Type.STRING },
                        safetyLevel: { type: Type.STRING },
                        ghsCodes: { type: Type.ARRAY, items: { type: Type.STRING } },
                        storageConditions: { type: Type.STRING },
                        incompatibleWith: { type: Type.ARRAY, items: { type: Type.STRING } },
                        suggestedUnit: { type: Type.STRING },
                        suggestedThreshold: { type: Type.NUMBER },
                        description: { type: Type.STRING }
                    }
                }
            }
        });
        const aiResult = JSON.parse(extractJson(response.text || '{}'));

        // 合并本地 + AI 结果（本地字典信息优先级更高）
        return {
            formula: localResult?.formula || aiResult.formula || '',
            mw: localResult?.mw || aiResult.mw || 0,
            casNo: aiResult.casNo || '',
            safetyLevel: localResult?.safetyLevel || aiResult.safetyLevel || 'Safe',
            ghsCodes: aiResult.ghsCodes || [],
            storageConditions: aiResult.storageConditions || '',
            incompatibleWith: aiResult.incompatibleWith || [],
            suggestedUnit: aiResult.suggestedUnit || 'g',
            suggestedThreshold: aiResult.suggestedThreshold || 10,
            description: aiResult.description || '',
            source: localResult ? 'local+ai' : 'ai'
        };
    });
};

/**
 * 试剂兼容性检查：分析同一存放位置的化学品兼容性
 * @param items 同一个位置的库存列表
 * @returns 冲突列表 + 总体风险评级 + 重新分配建议
 */
export const checkChemicalCompatibility = async (items: InventoryItem[]) => {
    if (items.length < 2) return { riskLevel: 'safe', conflicts: [], suggestions: [] };

    return callGeminiWithRetry(async (ai) => {
        const chemSummary = items.map(i => ({
            id: i.id,
            name: i.name,
            formula: i.formula || '',
            safetyLevel: i.safetyLevel,
            category: i.category
        }));

        const prompt = `你是一名资深实验室安全审计专家，专精化学品存储兼容性分析。请对以下【同一存放位置】的化学品进行严格的兼容性审计。

【待审计化学品清单】（位于同一存储区域）：
${JSON.stringify(chemSummary, null, 2)}

【审计标准】:
基于以下国际标准进行兼容性检查：
1. **NFPA 491M** — 化学品储存兼容矩阵
2. **UN GHS** — 全球统一分类系统
3. **GB/T 13690-2009** — 中国化学品分类
4. **核心禁忌规则**：
   - 强酸 ≠ 强碱
   - 氧化剂 ≠ 还原剂 / 易燃物
   - 有毒物质 ≠ 食品级试剂
   - 遇水分解 ≠ 含水/水合物
   - 自燃物 需隔离
   - 强腐蚀性 需专用柜

【任务】：
1. **冲突检测 (conflicts)**：列出所有不兼容的化学品配对，说明具体的危险后果和对应的安全标准依据。severity 取 'critical'(可能引起爆炸/火灾/毒气) / 'warning'(化学性质冲突但风险可控) / 'caution'(虽不推荐但可暂时共存)
2. **总体风险评级 (riskLevel)**：'critical'=严重危险需立即处理 / 'warning'=存在隐患需优化 / 'safe'=兼容性良好
3. **重新分配建议 (suggestions)**：给出具体的物资重新归位建议`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        riskLevel: { type: Type.STRING },
                        conflicts: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    itemAId: { type: Type.STRING },
                                    itemAName: { type: Type.STRING },
                                    itemBId: { type: Type.STRING },
                                    itemBName: { type: Type.STRING },
                                    severity: { type: Type.STRING },
                                    reason: { type: Type.STRING },
                                    consequence: { type: Type.STRING },
                                    standard: { type: Type.STRING }
                                },
                                required: ["itemAId", "itemBId", "severity", "reason"]
                            }
                        },
                        suggestions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    itemId: { type: Type.STRING },
                                    itemName: { type: Type.STRING },
                                    action: { type: Type.STRING },
                                    recommendedLocation: { type: Type.STRING }
                                }
                            }
                        }
                    },
                    required: ["riskLevel", "conflicts", "suggestions"]
                }
            }
        });
        return JSON.parse(extractJson(response.text || '{"riskLevel":"safe","conflicts":[],"suggestions":[]}'));
    });
};

/**
 * 拍照 OCR 识别：拍摄试剂瓶标签 → 多模态 AI 提取 → 返回结构化入库数据
 * @param imageBase64 图像的 base64 编码
 * @param mimeType 图像类型（如 image/jpeg, image/png）
 */
export const ocrLabelRecognize = async (imageBase64: string, mimeType: string) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名实验室物资管理 AI 助手，具有强大的 OCR 和化学品识别能力。请仔细分析这张试剂瓶/包装标签的照片，提取所有可见信息。

【任务要求】：
1. **品名识别**：识别试剂的中文名和/或英文名。如果标签上有多个名称（通用名、IUPAC 名），都尝试识别。
2. **CAS 号**：从标签上提取 CAS 注册号（格式如 7732-18-5）。
3. **分子式**：如果标签上有化学式则提取，否则根据品名推导。
4. **纯度/规格**：如 AR、GR、CP、99.5% 等。
5. **品牌**：识别制造商或供应商名称（如 Sigma-Aldrich, 国药, Alfa Aesar, TCI, Aladdin 等）。
6. **包装规格**：识别容量/重量（如 500g, 500mL, 25kg）。
7. **批次号（Lot/Batch No）**：如果可见。
8. **有效期**：如果标签上有标注。
9. **危险标识**：识别 GHS 危险标识符号、H/P 声明、信号词（危险/警告）。
10. **分类推断**：根据以上信息推断物資分类（Chemical / Precursor / Consumable / Hardware）。
11. **安全等级推断**：推断 safetyLevel（Safe / Toxic / Corrosive / Flammable / Explosive / Oxidizer）。
12. **置信度**：对整体识别结果给出置信度评分（0-1）。

【输出要求】：
- 所有文字字段使用中文（品名同时提供英文名）
- 如果某项信息在标签上不可见，返回空字符串
- quantity 和 unit 从包装规格中拆分
- 返回一个平坦的 JSON 对象`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: [
                {
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType, data: imageBase64 } },
                        { text: prompt }
                    ]
                }
            ],
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        englishName: { type: Type.STRING },
                        casNo: { type: Type.STRING },
                        formula: { type: Type.STRING },
                        mw: { type: Type.NUMBER },
                        purity: { type: Type.STRING },
                        brand: { type: Type.STRING },
                        quantity: { type: Type.NUMBER },
                        unit: { type: Type.STRING },
                        batchNo: { type: Type.STRING },
                        expiryDate: { type: Type.STRING },
                        category: { type: Type.STRING },
                        safetyLevel: { type: Type.STRING },
                        ghsSymbols: { type: Type.ARRAY, items: { type: Type.STRING } },
                        signalWord: { type: Type.STRING },
                        confidence: { type: Type.NUMBER }
                    }
                }
            }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};