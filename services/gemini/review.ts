
import { Literature, ReviewConfig, ReviewSubQuestion, ReviewOutlineNode, ScreenedLiterature } from "../../types";
import { callGeminiWithRetry, extractJson, safeJsonParse, FAST_MODEL, PRO_MODEL, SPEED_CONFIG } from "./core";

type Language = 'zh' | 'en';

// ═══════════════════════════════════════════════════════════════════
// 阶段 1: 主题分解 — 拆解子研究问题 + 生成检索关键词矩阵
// ═══════════════════════════════════════════════════════════════════

export const decomposeReviewTopic = async (
    config: ReviewConfig
): Promise<{ subQuestions: ReviewSubQuestion[]; suggestedTitle: string }> => {
    return callGeminiWithRetry(async (ai) => {
        const langInstr = config.language === 'en'
            ? 'Output MUST be in Academic English.'
            : '输出必须使用学术中文，但检索关键词必须为英文。';

        const prompt = `你是一名 Nature Reviews / Chemical Society Reviews 级别的综述策划编辑。

请对以下综述主题进行深度分解，设计出完整的综述研究框架。

【综述主题】: ${config.topic}
【研究范围】: ${config.scope || '不限'}
【目标语言】: ${config.language === 'en' ? 'English' : '中文'}
【文献年份范围】: ${config.yearRange[0]}-${config.yearRange[1]}

${langInstr}

请执行以下任务:

1. **建议综述标题** (suggestedTitle): 一个专业的综述论文标题

2. **子研究问题分解** (subQuestions): 将综述主题拆解为 4-7 个子研究问题，每个问题应对应综述的一个主要章节。

对每个子问题提供:
- id: 形如 "sq_1", "sq_2" 的唯一标识
- question: 子研究问题（完整的学术问题陈述）
- keywords: 2-4 个用于学术数据库检索的英文关键词组合
- description: 该子问题涵盖的内容范围描述

示例:
{
  "suggestedTitle": "Single-Atom Catalysts for Electrochemical Hydrogen Evolution: Advances, Mechanisms, and Future Perspectives",
  "subQuestions": [
    {
      "id": "sq_1",
      "question": "单原子催化剂在析氢反应中的活性位点结构与电子调控机制",
      "keywords": ["single atom catalyst HER active site", "electronic structure modulation SAC"],
      "description": "综述不同金属中心（Pt, Ir, Ru, Fe, Co, Ni 等）作为 SAC 活性位点时的 d-band 电子结构、配位环境对 HER 活性的影响机理"
    }
  ]
}

要求:
- 子问题之间不重叠但共同覆盖综述主题的全部核心方面
- 关键词必须是英文，适合在 OpenAlex/Web of Science 中检索
- 包含一个"引言/背景"方向和一个"挑战与展望"方向`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 2048 }
            }
        });

        const parsed = safeJsonParse(response.text || '{}', {
            suggestedTitle: config.topic,
            subQuestions: []
        });

        return {
            suggestedTitle: parsed.suggestedTitle || config.topic,
            subQuestions: Array.isArray(parsed.subQuestions) ? parsed.subQuestions.map((sq: any, i: number) => ({
                id: sq.id || `sq_${i + 1}`,
                question: sq.question || '',
                keywords: Array.isArray(sq.keywords) ? sq.keywords : [],
                description: sq.description || ''
            })) : []
        };
    });
};


// ═══════════════════════════════════════════════════════════════════
// 阶段 3: 文献筛选与分级
// ═══════════════════════════════════════════════════════════════════

export const screenLiterature = async (
    topic: string,
    subQuestions: ReviewSubQuestion[],
    literatures: Literature[],
    language: Language = 'zh'
): Promise<ScreenedLiterature[]> => {
    return callGeminiWithRetry(async (ai) => {
        // 限制输入规模，避免 Token 超限
        const litSummaries = literatures.slice(0, 50).map(lit => ({
            id: lit.id,
            title: lit.title,
            englishTitle: (lit as any).englishTitle || '',
            year: lit.year,
            source: lit.source,
            abstract: (lit.abstract || '').substring(0, 200),
            authors: lit.authors?.slice(0, 3)?.join(', ') || ''
        }));

        const sqSummaries = subQuestions.map(sq => ({
            id: sq.id,
            question: sq.question
        }));

        const prompt = `你是一名资深综述期刊编辑。请对以下候选文献进行严格的学术筛选和分级。

【综述主题】: ${topic}
【子研究问题】: ${JSON.stringify(sqSummaries)}
【候选文献列表】: ${JSON.stringify(litSummaries)}

请对每篇文献进行评估，输出 JSON 数组，每项包含:
- literatureId: 文献 ID
- tier: "core" (核心必引) | "supporting" (支撑论据) | "reference" (一般参考) | "excluded" (不相关排除)
- relevanceScore: 0-100 相关性评分
- assignedSubtopics: 该文献最关联的子问题 ID 数组
- reason: 一句话说明分级理由

分级标准:
- core (70-100分): 直接回答某子研究问题的开创性/高引用/近期重要研究
- supporting (40-69分): 提供补充证据或方法论参考
- reference (20-39分): 仅用于背景介绍或边缘引用
- excluded (<20分): 与主题不相关

请严格筛选，核心文献应控制在总数的 30-40%。`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 1024 }
            }
        });

        const results = safeJsonParse(response.text || '[]', []);
        return Array.isArray(results) ? results.map((r: any) => ({
            literatureId: r.literatureId || '',
            tier: ['core', 'supporting', 'reference', 'excluded'].includes(r.tier) ? r.tier : 'reference',
            relevanceScore: Number(r.relevanceScore) || 0,
            assignedSubtopics: Array.isArray(r.assignedSubtopics) ? r.assignedSubtopics : [],
            reason: r.reason || ''
        })) : [];
    });
};


// ═══════════════════════════════════════════════════════════════════
// 阶段 5: 综述大纲生成
// ═══════════════════════════════════════════════════════════════════

export const generateReviewOutline = async (
    config: ReviewConfig,
    subQuestions: ReviewSubQuestion[],
    screenedLit: ScreenedLiterature[],
    literatures: Literature[]
): Promise<ReviewOutlineNode[]> => {
    return callGeminiWithRetry(async (ai) => {
        const langInstr = config.language === 'en'
            ? 'All titles and descriptions in Academic English.'
            : '标题和描述使用学术中文。';

        // 构建文献摘要（只含核心和支撑级）
        const relevantLit = screenedLit
            .filter(s => s.tier === 'core' || s.tier === 'supporting')
            .map(s => {
                const lit = literatures.find(l => l.id === s.literatureId);
                return lit ? {
                    id: lit.id,
                    title: lit.title,
                    year: lit.year,
                    subtopics: s.assignedSubtopics,
                    tier: s.tier
                } : null;
            })
            .filter(Boolean);

        const prompt = `你是 Chemical Society Reviews / Nature Reviews Chemistry 级别的综述策划编辑。

基于已完成的文献筛选结果，生成一份专业的综述论文大纲。

【综述主题】: ${config.topic}
【目标字数】: ${config.targetWordCount}
【子研究问题】: ${JSON.stringify(subQuestions.map(sq => ({ id: sq.id, question: sq.question })))}
【已筛选文献】: ${JSON.stringify(relevantLit)}
${langInstr}

请生成 JSON 数组，表示综述的章节结构。每个节点包含:
- id: 唯一标识（如 "sec_1", "sec_1_1"）
- title: 章节标题
- description: 该章节应讨论的核心内容（2-3句话）
- level: 层级（1=主章节, 2=子章节）
- literatureIds: 该章节应引用的文献 ID 数组
- suggestedFigure: (可选) 建议的图表 { type: "comparison_table"|"trend_chart"|"mechanism_diagram"|"distribution"|"sankey", description: "图表描述" }
- targetWords: 该章节的目标字数
- children: 子章节数组（可为空）

大纲要求:
1. 必须包含: 引言(Introduction)、各主体章节、结论与展望(Conclusion & Outlook)
2. 主体章节对应子研究问题，但可以合并或拆分以保证逻辑流畅
3. 目标字数分配应合理（引言和结论各约 10-15%，主体章节共占 70-80%）
4. 建议图表应具有学术价值（如性能对比表、研究趋势图、机理示意图）
5. 每个章节至少关联 2 篇文献`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 2048 }
            }
        });

        const parseNode = (node: any): ReviewOutlineNode => ({
            id: node.id || `sec_${Math.random().toString(36).slice(2, 6)}`,
            title: node.title || '',
            description: node.description || '',
            level: Number(node.level) || 1,
            literatureIds: Array.isArray(node.literatureIds) ? node.literatureIds : [],
            suggestedFigure: node.suggestedFigure || undefined,
            targetWords: Number(node.targetWords) || 500,
            status: 'pending',
            children: Array.isArray(node.children) ? node.children.map(parseNode) : []
        });

        const results = safeJsonParse(response.text || '[]', []);
        return Array.isArray(results) ? results.map(parseNode) : [];
    });
};


// ═══════════════════════════════════════════════════════════════════
// 阶段 6: 逐节内容生成（核心）
// ═══════════════════════════════════════════════════════════════════

export const generateReviewSection = async (
    config: ReviewConfig,
    section: ReviewOutlineNode,
    relevantKnowledge: string,
    previousSummary: string,
    allLiteratures: Literature[]
): Promise<string> => {
    return callGeminiWithRetry(async (ai) => {
        const langInstr = config.language === 'en'
            ? 'Write in rigorous Academic English suitable for top-tier journals (Nature Reviews, Chem. Soc. Rev.).'
            : '使用严谨的学术中文撰写，专业术语和化学式可保留英文/符号。对标 Chemical Society Reviews 级别。';

        // 构建该章节关联文献的引用映射
        const litMap = section.literatureIds
            .map(id => allLiteratures.find(l => l.id === id))
            .filter(Boolean)
            .map((lit, idx) => `[Ref:${lit!.id}] = ${lit!.title} (${lit!.authors?.[0] || 'Unknown'}, ${lit!.year})`)
            .join('\n');

        const prompt = `你是 Nature Reviews / Chemical Society Reviews 级别的综述撰稿专家。

当前正在撰写综述论文「${config.topic}」的章节:
- 章节标题: ${section.title}
- 章节描述: ${section.description}
- 层级: ${section.level === 1 ? '主章节' : '子章节'}
- 目标字数: ${section.targetWords}

${previousSummary ? `【已完成前文概要】:\n${previousSummary}\n` : ''}

【本章节可引用的文献及其关键发现】:
${relevantKnowledge}

【引用映射表】:
${litMap}

${langInstr}

【顶刊级写作规范】:
1. 以批判性分析视角撰写，不是简单罗列文献——要建立文献之间的因果关系、对比逻辑和发展脉络
2. 使用 [Ref:paper_id] 格式标注引用（如 [Ref:search_xxx_0]），确保每处引用可溯源
3. 每段至少引用 1-2 处文献支撑论点
4. 主动指出研究空白、方法论局限和学术争议
5. 段落之间需有逻辑过渡，保持严密的学术逻辑链
6. 禁止使用感性语言、口语化表达
7. 如果存在已完成前文，需与前文衔接，避免重复论述
8. 引用语料必须基于提供的文献，禁止虚构
${config.customInstructions ? `\n【用户自定义指令】: ${config.customInstructions}` : ''}

请直接输出该章节的学术内容（纯文本/Markdown），不要输出 JSON 包装。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                thinkingConfig: { thinkingBudget: 4096 }
            }
        });
        return response.text || '';
    });
};


// ═══════════════════════════════════════════════════════════════════
// 阶段 6b: 逐节内容生成 — 流式版本
// ═══════════════════════════════════════════════════════════════════

export const generateReviewSectionStream = async (
    config: ReviewConfig,
    section: ReviewOutlineNode,
    relevantKnowledge: string,
    previousSummary: string,
    allLiteratures: Literature[],
    onChunk: (aggregatedText: string) => void
): Promise<string> => {
    const { UniversalAIAdapter } = await import('./core/adapter');

    const langInstr = config.language === 'en'
        ? 'Write in rigorous Academic English suitable for top-tier journals (Nature Reviews, Chem. Soc. Rev.).'
        : '使用严谨的学术中文撰写，专业术语和化学式可保留英文/符号。对标 Chemical Society Reviews 级别。';

    const litMap = section.literatureIds
        .map(id => allLiteratures.find(l => l.id === id))
        .filter(Boolean)
        .map((lit, idx) => `[Ref:${lit!.id}] = ${lit!.title} (${lit!.authors?.[0] || 'Unknown'}, ${lit!.year})`)
        .join('\n');

    const prompt = `你是 Nature Reviews / Chemical Society Reviews 级别的综述撰稿专家。

当前正在撰写综述论文「${config.topic}」的章节:
- 章节标题: ${section.title}
- 章节描述: ${section.description}
- 层级: ${section.level === 1 ? '主章节' : '子章节'}
- 目标字数: ${section.targetWords}

${previousSummary ? `【已完成前文概要】:\n${previousSummary}\n` : ''}

【本章节可引用的文献及其关键发现】:
${relevantKnowledge}

【引用映射表】:
${litMap}

${langInstr}

【顶刊级写作规范】:
1. 以批判性分析视角撰写，不是简单罗列文献——要建立文献之间的因果关系、对比逻辑和发展脉络
2. 使用 [Ref:paper_id] 格式标注引用（如 [Ref:search_xxx_0]），确保每处引用可溯源
3. 每段至少引用 1-2 处文献支撑论点
4. 主动指出研究空白、方法论局限和学术争议
5. 段落之间需有逻辑过渡，保持严密的学术逻辑链
6. 禁止使用感性语言、口语化表达
7. 如果存在已完成前文，需与前文衔接，避免重复论述
8. 引用语料必须基于提供的文献，禁止虚构
${config.customInstructions ? `\n【用户自定义指令】: ${config.customInstructions}` : ''}

请直接输出该章节的学术内容（纯文本/Markdown），不要输出 JSON 包装。`;

    const ai = new UniversalAIAdapter();
    let aggregatedText = '';

    try {
        const streamResp: any = await ai.models.generateContentStream({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                thinkingConfig: { thinkingBudget: 4096 }
            }
        });

        for await (const chunk of streamResp) {
            if (typeof chunk?.text === 'string') {
                aggregatedText += chunk.text;
                onChunk(aggregatedText);
            }
        }
    } catch (streamErr) {
        // 流式失败降级到非流式
        console.warn('[ReviewStream] 流式生成失败，降级到非流式', streamErr);
        const result = await generateReviewSection(config, section, relevantKnowledge, previousSummary, allLiteratures);
        aggregatedText = result;
        onChunk(aggregatedText);
    }

    return aggregatedText;
};


// ═══════════════════════════════════════════════════════════════════
// 阶段 8: 全文交叉审计
// ═══════════════════════════════════════════════════════════════════

export const auditReviewCrossRef = async (
    fullContent: string,
    literatures: Literature[],
    language: Language = 'zh'
): Promise<string> => {
    return callGeminiWithRetry(async (ai) => {
        const litIds = literatures.map(l => l.id);

        const prompt = `你是一名极其严苛的顶刊审稿人。请对以下综述全文进行交叉审计。

【综述全文】（可能较长，请逐段检查）:
${fullContent.substring(0, 30000)}

【参考文献 ID 列表】: ${JSON.stringify(litIds.slice(0, 50))}

请执行以下 4 项审计，并生成 Markdown 格式的审计报告:

## 1. 引用一致性审计
- 检查所有 [Ref:xxx] 标签是否在参考文献列表中有对应
- 标注未被引用但已纳入的文献
- 检查引用是否均匀分布（避免某篇文献被过度引用或完全遗漏）

## 2. 逻辑连贯性审计
- 检查相邻章节之间是否有逻辑过渡
- 标出前后矛盾或重复论述的段落
- 评估结论是否有前文充分支撑

## 3. 术语一致性审计
- 检查同一概念在全文中是否使用统一术语
- 缩写是否在首次出现时有全称

## 4. 覆盖度审计
- 评估各子主题是否被充分讨论
- 指出可能遗漏的重要方面

对每项问题，请给出:
- 🔴 严重问题（必须修改）
- 🟡 中等问题（建议修改）
- 🟢 轻微问题（可选改善）

最后给出总体评分 (0-100) 和修改优先级列表。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                thinkingConfig: { thinkingBudget: 4096 }
            }
        });
        return response.text || '';
    });
};


// ═══════════════════════════════════════════════════════════════════
// 阶段 8b: 结构化审计（Agent Loop 使用）
// ═══════════════════════════════════════════════════════════════════

export interface AuditIssue {
    severity: 'critical' | 'moderate' | 'minor';
    category: 'citation' | 'logic' | 'terminology' | 'coverage';
    sectionTitle: string;
    description: string;
    suggestion: string;
}

export interface StructuredAuditResult {
    score: number;
    issues: AuditIssue[];
    summary: string;
}

export const auditReviewStructured = async (
    fullContent: string,
    literatures: Literature[],
    language: Language = 'zh'
): Promise<StructuredAuditResult> => {
    return callGeminiWithRetry(async (ai) => {
        const litIds = literatures.map(l => l.id);

        const prompt = `你是一名极其严苛的顶刊审稿人。请对以下综述全文进行结构化审计。

【综述全文】（可能较长，请逐段检查）:
${fullContent.substring(0, 30000)}

【参考文献 ID 列表】: ${JSON.stringify(litIds.slice(0, 50))}

请执行以下 4 类审计:
1. 引用一致性 (citation): 引用标签缺失/错误/分布不均
2. 逻辑连贯性 (logic): 章节过渡、前后矛盾、重复论述
3. 术语一致性 (terminology): 术语不统一、缩写无全称
4. 覆盖度 (coverage): 子主题讨论不充分、遗漏重要方面

输出严格 JSON:
{
  "score": 0-100 的总体评分,
  "issues": [
    {
      "severity": "critical" | "moderate" | "minor",
      "category": "citation" | "logic" | "terminology" | "coverage",
      "sectionTitle": "问题所在章节标题（必须精确匹配综述中的章节标题）",
      "description": "问题描述",
      "suggestion": "修改建议"
    }
  ],
  "summary": "一段话总结审计结论"
}

评分标准:
- 90-100: 无 critical 问题，极少 moderate
- 70-89: 有少量 critical 或多处 moderate
- 50-69: 有多处 critical 问题
- <50: 严重质量问题

请严格输出 JSON，不要包含其他文本。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 4096 }
            }
        });

        return safeJsonParse(response.text || '{}', {
            score: 50,
            issues: [],
            summary: '审计解析失败'
        });
    });
};


// ═══════════════════════════════════════════════════════════════════
// 阶段 8c: 定向章节修订（根据审计反馈）
// ═══════════════════════════════════════════════════════════════════

export const reviseReviewSection = async (
    config: ReviewConfig,
    sectionTitle: string,
    originalContent: string,
    issues: AuditIssue[],
    allLiteratures: Literature[]
): Promise<string> => {
    return callGeminiWithRetry(async (ai) => {
        const langInstr = config.language === 'en'
            ? 'Write in rigorous Academic English. Maintain the original writing style.'
            : '使用严谨的学术中文，保持原文行文风格不变。';

        const issueList = issues.map((iss, i) =>
            `${i + 1}. [${iss.severity.toUpperCase()}][${iss.category}] ${iss.description}\n   建议修改: ${iss.suggestion}`
        ).join('\n\n');

        const litMap = allLiteratures.slice(0, 30).map(lit =>
            `[Ref:${lit.id}] = ${lit.title} (${lit.authors?.[0] || ''}, ${lit.year})`
        ).join('\n');

        const prompt = `你是一名 Nature Reviews 级别的综述修订专家。

当前任务：根据审稿人的审计反馈，对综述的特定章节进行**精准定向修订**。

【综述主题】: ${config.topic}
【待修订章节标题】: ${sectionTitle}

【原始章节内容】:
${originalContent}

【审稿人指出的问题】:
${issueList}

【可用引用映射表】:
${litMap}

${langInstr}

【修订规范】:
1. **只修复审稿人指出的问题**，不做无关改动
2. 保持原文的段落结构和论证逻辑框架
3. 如需增补引用，使用 [Ref:paper_id] 格式
4. 修复术语不一致时，选择首次出现的术语为标准
5. 修复逻辑断裂时，添加过渡句而非大幅重写
6. 修复覆盖度不足时，基于已有文献补充 1-2 句关键论述
7. 禁止虚构引用或数据

请输出修订后的完整章节内容（纯文本/Markdown），不要输出 JSON 包装。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                thinkingConfig: { thinkingBudget: 4096 }
            }
        });
        return response.text || originalContent;
    });
};


// ═══════════════════════════════════════════════════════════════════
// 阶段 9: 摘要与关键词生成
// ═══════════════════════════════════════════════════════════════════

export const generateReviewAbstract = async (
    fullContent: string,
    config: ReviewConfig
): Promise<{ abstract: string; keywords: string[]; highlights: string[] }> => {
    return callGeminiWithRetry(async (ai) => {
        const langInstr = config.language === 'en'
            ? 'Write in Academic English.'
            : '使用学术中文，关键词可中英混用。';

        const prompt = `基于以下综述全文，生成:
1. 结构化摘要 (abstract): 200-300词，包含 Background, Scope, Key Findings, Conclusions 四部分
2. 关键词 (keywords): 5-8 个学术关键词
3. 研究亮点 (highlights): 3-5 条，每条一句话

综述主题: ${config.topic}
${langInstr}

综述内容概要:
${fullContent.substring(0, 15000)}

输出 JSON:
{
  "abstract": "...",
  "keywords": ["keyword1", "keyword2"],
  "highlights": ["highlight1", "highlight2"]
}`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 2048 }
            }
        });

        return safeJsonParse(response.text || '{}', {
            abstract: '',
            keywords: [],
            highlights: []
        });
    });
};


// ═══════════════════════════════════════════════════════════════════
// 阶段 7: 图表数据生成
// ═══════════════════════════════════════════════════════════════════

export const generateComparisonTableData = async (
    literatures: Literature[],
    topic: string,
    language: Language = 'zh'
): Promise<{ headers: string[]; rows: string[][] }> => {
    return callGeminiWithRetry(async (ai) => {
        const litData = literatures.slice(0, 20).map(l => ({
            title: l.title,
            year: l.year,
            performance: (l as any).performance || [],
            source: l.source
        }));

        const prompt = `基于以下文献的性能数据，生成一个学术级性能对比表格。

综述主题: ${topic}
文献数据: ${JSON.stringify(litData)}

要求:
1. 表头应包含: 材料/催化剂名称、关键性能参数（从文献 performance 中提取共性指标）、实验条件、参考文献
2. 每行对应一篇文献
3. 数值必须忠实于原始数据
4. ${language === 'en' ? 'Headers and content in English' : '表头用中文，数值和单位保留英文'}

输出 JSON: { "headers": [...], "rows": [[...], [...]] }`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 1024 }
            }
        });

        return safeJsonParse(response.text || '{}', { headers: [], rows: [] });
    });
};

export const generateTrendAnalysis = async (
    literatures: Literature[],
    topic: string,
    language: Language = 'zh'
): Promise<{ yearDistribution: Record<string, number>; topJournals: { name: string; count: number }[]; summary: string }> => {
    return callGeminiWithRetry(async (ai) => {
        const litData = literatures.map(l => ({
            year: l.year,
            source: l.source,
            title: l.title
        }));

        const prompt = `分析以下文献集合的研究趋势:

主题: ${topic}
文献数据: ${JSON.stringify(litData)}

输出 JSON:
{
  "yearDistribution": {"2020": 3, "2021": 5, ...},
  "topJournals": [{"name": "Nat. Catal.", "count": 4}, ...],
  "summary": "趋势分析总结（2-3句话）"
}`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 512 }
            }
        });

        return safeJsonParse(response.text || '{}', {
            yearDistribution: {},
            topJournals: [],
            summary: ''
        });
    });
};


// ═══════════════════════════════════════════════════════════════════
// 阶段 7c: 图表描述生成（机理图/分布图/桑基图等非表格类型）
// ═══════════════════════════════════════════════════════════════════

export const generateFigureDescription = async (
    topic: string,
    sectionTitle: string,
    figureType: string,
    figureDescription: string,
    relevantLiteratures: Literature[],
    language: Language = 'zh'
): Promise<string> => {
    return callGeminiWithRetry(async (ai) => {
        const langInstr = language === 'en'
            ? 'Write in Academic English.'
            : '使用学术中文输出，专业术语可保留英文。';

        const litContext = relevantLiteratures.slice(0, 10).map(l =>
            `- ${l.title} (${l.authors?.[0] || ''}, ${l.year}): ${(l.abstract || '').substring(0, 150)}`
        ).join('\n');

        const prompt = `你是一位顶刊级别的科研可视化专家。请为以下综述章节设计一张学术图表。

【综述主题】: ${topic}
【章节标题】: ${sectionTitle}
【图表类型】: ${figureType}
【图表描述需求】: ${figureDescription}
【相关文献】:
${litContext}

${langInstr}

请生成该图表的详细 Markdown 描述，包括：
1. **图表标题**（Figure X: ...）
2. **数据结构**：列出图表中应展示的所有数据点/节点/流向
3. **关键发现**：该图表要传达的核心信息（2-3句）
4. **图注说明**（figure caption）：符合顶刊规范的图注

格式要求：输出纯 Markdown 文本，适合嵌入综述论文。`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                thinkingConfig: { thinkingBudget: 1024 }
            }
        });
        return response.text || '';
    });
};


// ═══════════════════════════════════════════════════════════════════
// 组图学术图注 AI 生成
// ═══════════════════════════════════════════════════════════════════

export interface CompositePanelInfo {
    label: string;          // "(a)", "(b)"
    sourceTitle?: string;   // 来源文献标题
    sourcePage?: number;    // 来源页码
    sourceType?: string;    // 'literature' | 'local' | 'generated'
}

export const generateCompositeFigureCaption = async (
    panels: CompositePanelInfo[],
    sectionTitle: string,
    reviewTopic: string,
    language: Language = 'zh'
): Promise<string> => {
    return callGeminiWithRetry(async (ai) => {
        const langInstr = language === 'en'
            ? 'Output MUST be in Academic English.'
            : '输出必须使用学术中文。';

        const panelList = panels.map(p => {
            const parts = [p.label];
            if (p.sourceTitle) parts.push(`来源: ${p.sourceTitle}`);
            if (p.sourcePage) parts.push(`页码: P.${p.sourcePage}`);
            return parts.join(' | ');
        }).join('\n');

        const prompt = `你是 Nature Reviews / Chemical Society Reviews 级别的学术综述作者。
请为以下综述组图撰写专业的学术图注 (Figure Caption)。

【综述主题】: ${reviewTopic}
【所属章节】: ${sectionTitle}
【组图面板信息】:
${panelList}

${langInstr}

要求:
1. 先写总标题，概括整张组图的核心内容（一句话）
2. 然后依次描述每个面板：${panels.map(p => p.label).join('、')}
3. 每个面板描述应包含：展示内容、关键观察点
4. 若有来源文献，在面板描述末尾用 (reproduced from Author et al., Year) 或 (引自 XXX) 标注
5. 使用适合 Science/Nature Reviews 级别顶刊的学术语气
6. 总字数控制在 80-200 字

仅输出图注文本本身（不包含 "Figure X." 编号前缀），直接以总标题开始。`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                thinkingConfig: { thinkingBudget: 1024 }
            }
        });
        return (response.text || '').trim();
    });
};


// ═══════════════════════════════════════════════════════════════════
// 用户介入式交互编辑
// ═══════════════════════════════════════════════════════════════════

export type EditAction = 'rewrite' | 'expand' | 'compress' | 'add_citations' | 'custom';

/**
 * 对章节中的选中文本执行 AI 局部编辑操作
 * 返回替换 selectedText 的新文本
 */
export const interactiveEditSection = async (
    config: ReviewConfig,
    sectionTitle: string,
    fullSectionContent: string,
    selectedText: string,
    action: EditAction,
    customInstruction?: string,
    literatures?: Literature[]
): Promise<string> => {
    return callGeminiWithRetry(async (ai) => {
        const langInstr = config.language === 'en'
            ? 'Write in rigorous Academic English. Match the surrounding writing style.'
            : '使用严谨的学术中文，匹配上下文行文风格。';

        const actionPrompts: Record<EditAction, string> = {
            rewrite: '对选中文本进行**同义改写**。保持原有信息量不变，改善行文流畅度和学术表达。不增加也不删除实质内容。',
            expand: '对选中文本进行**扩写**。在原文基础上深化分析、补充论据、丰富论述层次。扩展后的文本长度约为原文的 1.5-2 倍。',
            compress: '对选中文本进行**精简压缩**。删除冗余表述、合并重复论点、精炼语言。压缩后保留核心论述，长度约为原文的 50-70%。',
            add_citations: '在选中文本中**补充文献引用**。为关键论断和数据找到合适的引用位置，使用 [Ref:paper_id] 格式插入引用标记。不改变原文逻辑与结构。',
            custom: customInstruction
                ? `根据用户指令修改选中文本：「${customInstruction}」`
                : '根据学术写作规范改善选中文本。'
        };

        const litMap = (literatures || []).slice(0, 30).map(lit =>
            `[Ref:${lit.id}] = ${lit.title} (${lit.authors?.[0] || ''}, ${lit.year})`
        ).join('\n');

        const prompt = `你是一名 Nature Reviews 级别的综述写作顾问。

【综述主题】: ${config.topic}
【章节标题】: ${sectionTitle}

【章节完整内容】(提供上下文):
${fullSectionContent.substring(0, 8000)}

【用户选中的文本】:
───
${selectedText}
───

【操作要求】:
${actionPrompts[action]}

${litMap ? `【可用引用映射表】:\n${litMap}\n` : ''}
${langInstr}

【输出规范】:
- **只输出替换选中文本的新内容**，不要输出完整章节
- 不要添加任何前缀说明文字
- 保持与上下文的语气和风格一致
- 禁止虚构数据或引用`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                thinkingConfig: { thinkingBudget: 4096 }
            }
        });
        return (response.text || selectedText).trim();
    });
};


// ═══════════════════════════════════════════════════════════════════
// 自动文献截图组图 — AI 智能匹配 Figure 到章节
// ═══════════════════════════════════════════════════════════════════

export interface FigureMatchInput {
    id: string;
    label: string;          // "Figure 1", "Fig. 2a"
    description: string;    // AI 提取的图片描述
    sourceLitId: string;
    sourceLitTitle: string;
}

/**
 * AI 智能匹配：将提取的 Figure 分配到最相关的大纲章节
 *
 * @param sections - 大纲章节节点数组（已展平）
 * @param figures  - 从文献 PDF 中提取的 Figure 列表
 * @param topic    - 综述主题
 * @param language - 语言
 * @returns Record<sectionId, figureId[]> — 每个章节匹配到的 Figure ID
 */
export const matchFiguresToSections = async (
    sections: ReviewOutlineNode[],
    figures: FigureMatchInput[],
    topic: string,
    language: Language = 'zh'
): Promise<Record<string, string[]>> => {
    if (figures.length === 0 || sections.length === 0) return {};

    return callGeminiWithRetry(async (ai) => {
        const sectionList = sections.map(s => ({
            id: s.id,
            title: s.title,
            description: s.description,
            literatureIds: s.literatureIds
        }));

        const figureList = figures.map(f => ({
            id: f.id,
            label: f.label,
            description: f.description,
            sourceLitId: f.sourceLitId,
            sourceLitTitle: f.sourceLitTitle
        }));

        const prompt = `你是学术综述图表编排专家。

综述主题: ${topic}

以下是综述的章节大纲:
${JSON.stringify(sectionList, null, 2)}

以下是从文献 PDF 中提取的 Figure 图片:
${JSON.stringify(figureList, null, 2)}

请将 Figure 分配到最相关的章节中。分配原则:
1. **优先匹配来源文献**：如果 Figure 的 sourceLitId 出现在某章节的 literatureIds 中，优先分配到该章节
2. **内容相关性**：Figure 的 description 与章节 title/description 的语义相关性
3. **适度分配**：每个章节最多分配 4 张 Figure，避免过度堆砌
4. **引言和结论不分配**：Introduction 和 Conclusion 章节通常不需要文献 Figure
5. **允许不匹配**：如果某 Figure 与所有章节都不相关，可以不分配

输出严格 JSON:
{
  "matches": {
    "sec_1_1": ["fig_xxx_p2_Figure_1", "fig_yyy_p3_Fig_2"],
    "sec_2": ["fig_zzz_p5_Figure_3"]
  }
}

只输出 matches 字段，key 是 sectionId，value 是 figureId 数组。`;

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                thinkingConfig: { thinkingBudget: 1024 }
            }
        });

        const parsed = safeJsonParse(response.text || '{}', { matches: {} });
        return parsed.matches || {};
    });
};


// ═══════════════════════════════════════════════════════════════════
// 图文交叉引用注入 — 将 Figure 引用自然嵌入正文
// ═══════════════════════════════════════════════════════════════════

export interface FigureRefForInjection {
    /** 组图在综述中的编号 (如 "Figure 1") */
    figureNumber: string;
    /** 组图面板信息 */
    panels: Array<{
        label: string;          // "(a)", "(b)"
        figureLabel: string;    // "Figure 2" (原文献中的标签)
        description: string;    // 图片内容描述
        sourceLitTitle: string; // 来源文献标题
    }>;
    /** AI 图注 */
    caption: string;
}

/**
 * 在已生成的章节正文中注入 Figure 交叉引用
 *
 * 模仿 Nature Reviews / Chem. Soc. Rev. 的写作风格，
 * 在段落中自然地插入引用（如 "如 Figure 1a 所示，该催化剂展现了..."）。
 *
 * @param sectionContent  - 已生成的章节正文
 * @param sectionTitle    - 章节标题
 * @param figureRef       - 要注入引用的组图信息
 * @param topic           - 综述主题
 * @param language        - 语言
 * @returns 注入引用后的新正文
 */
export const injectFigureReferences = async (
    sectionContent: string,
    sectionTitle: string,
    figureRef: FigureRefForInjection,
    topic: string,
    language: Language = 'zh'
): Promise<string> => {
    return callGeminiWithRetry(async (ai) => {
        const langInstr = language === 'en'
            ? 'Write in rigorous Academic English. Match the existing writing style.'
            : '使用严谨的学术中文，匹配原文行文风格。';

        const panelDescriptions = figureRef.panels.map(p =>
            `${p.label} ${p.figureLabel} — ${p.description} (来自: ${p.sourceLitTitle})`
        ).join('\n');

        const prompt = `你是 Nature Reviews / Chemical Society Reviews 级别的综述撰稿专家。

当前任务：在已写好的综述章节正文中，**自然地**插入对组图 ${figureRef.figureNumber} 的交叉引用和描述语句。

【综述主题】: ${topic}
【章节标题】: ${sectionTitle}

【已生成的章节正文】:
───
${sectionContent}
───

【需要引用的组图信息】:
- 编号: ${figureRef.figureNumber}
- 图注: ${figureRef.caption}
- 面板信息:
${panelDescriptions}

${langInstr}

【顶刊图文引用写作规范】:
1. **自然嵌入**：在最相关的段落中插入 1-3 句对该图的引用描述，不要生硬地开头或结尾添加
2. **引用格式**：使用 "${figureRef.figureNumber}a" "${figureRef.figureNumber}b" 等格式引用特定面板
3. **描述丰富**：不仅仅说"如 Figure X 所示"，还要简要描述图中展示的关键发现或现象
4. **学术语气**：如顶刊综述中的典型表述：
   - 中文示例："如${figureRef.figureNumber}a 所示，Zhang 等人通过...合成了...催化剂，其形貌特征清晰可见"
   - 英文示例："As illustrated in ${figureRef.figureNumber}b, the morphological characterization reveals..."
5. **保持原文完整**：不要删除或大幅修改原文内容，只在合适位置添加引用语句
6. **逻辑流畅**：添加的引用描述需与前后段落衔接自然

请输出修改后的**完整章节正文**（包含已插入的图引用）。不要输出 JSON 包装。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                thinkingConfig: { thinkingBudget: 4096 }
            }
        });
        return (response.text || sectionContent).trim();
    });
};

