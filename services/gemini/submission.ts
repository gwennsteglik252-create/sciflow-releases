// ═══ SciFlow Pro — 投稿管理与期刊匹配 AI 服务 ═══

import { Type } from "@google/genai";
import { callGeminiWithRetry, safeJsonParse, FAST_MODEL, PRO_MODEL, SPEED_CONFIG } from "./core";
import { JournalMatch, ReviewerComment } from "../../types";

type Language = 'zh' | 'en';

/**
 * AI 期刊推荐引擎：根据论文摘要和关键词，匹配最适合的目标期刊
 */
export const recommendJournals = async (
    title: string,
    abstract: string,
    keywords: string[],
    lang: Language = 'zh'
): Promise<JournalMatch[]> => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名资深学术期刊编辑和科研出版顾问。请根据以下论文信息，推荐 6-8 本最适合投稿的学术期刊。

论文标题: ${title}
摘要: ${abstract || '（未提供摘要，请根据标题和关键词推荐）'}
关键词: ${keywords.join(', ') || '无'}

你必须返回一个 JSON 数组，每个元素包含以下字段：
- name: 期刊全名（英文）
- impactFactor: 最新影响因子（数字，精确到一位小数）
- acceptRate: 录用率估算（如 "15-20%"）
- reviewCycle: 平均审稿周期（如 "4-6 周"）
- matchScore: 与该论文的匹配度（0-100）
- matchReason: ${lang === 'zh' ? '用中文解释为什么适合该论文（1-2句话）' : 'Explain why this journal is a good fit (1-2 sentences)'}
- websiteUrl: 投稿系统网址
- category: 期刊分区（如 "Q1 化学" 或 "Q1 Chemistry"）

要求：
1. 按匹配度从高到低排序
2. 混合推荐不同档次的期刊（2-3本顶刊、2-3本中等、1-2本保底）
3. 影响因子和审稿周期数据要尽量准确
4. matchReason 需要具体说明该期刊的研究范围如何与论文内容契合`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            impactFactor: { type: Type.NUMBER },
                            acceptRate: { type: Type.STRING },
                            reviewCycle: { type: Type.STRING },
                            matchScore: { type: Type.NUMBER },
                            matchReason: { type: Type.STRING },
                            websiteUrl: { type: Type.STRING },
                            category: { type: Type.STRING }
                        },
                        required: ["name", "impactFactor", "matchScore", "matchReason"]
                    }
                },
                thinkingConfig: { thinkingBudget: 2048 }
            }
        });
        const result = safeJsonParse(response.text || '[]', []);
        return Array.isArray(result) ? result : [];
    });
};

/**
 * 解析编辑决定信，自动拆分为结构化的审稿人意见列表
 */
export const parseDecisionLetter = async (
    decisionLetter: string,
    lang: Language = 'zh'
): Promise<ReviewerComment[]> => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名学术出版专家。请解析以下编辑决定信（或审稿意见），将其拆分为结构化的审稿人意见列表。

决定信原文：
---
${decisionLetter.substring(0, 8000)}
---

请将每条审稿意见拆分为独立条目，返回 JSON 数组，每个元素包含：
- id: 唯一标识（格式：r1c1, r1c2, r2c1...，r表示审稿人编号，c表示意见编号）
- reviewerLabel: 审稿人标签（如 "Reviewer #1", "Reviewer #2", "Editor"）
- content: 该条意见的原文内容
- type: 意见类型，"major"（重大修改）、"minor"（小修）、"positive"（积极评价）

要求：
1. 准确识别不同审稿人的意见
2. 每条意见应该是一个独立的、可单独回复的问题或建议
3. 如果是表扬性质的评语，标记为 "positive"
4. 保持原文内容不做修改`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: {
                ...SPEED_CONFIG,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            reviewerLabel: { type: Type.STRING },
                            content: { type: Type.STRING },
                            type: { type: Type.STRING }
                        },
                        required: ["id", "reviewerLabel", "content", "type"]
                    }
                },
                thinkingConfig: { thinkingBudget: 2048 }
            }
        });
        const result = safeJsonParse(response.text || '[]', []);
        return (Array.isArray(result) ? result : []).map((c: any) => ({
            ...c,
            status: 'pending' as const
        }));
    });
};

/**
 * AI 生成 Response Letter：基于审稿人意见和论文内容生成逐条回复
 */
export const generateResponseLetter = async (
    comments: ReviewerComment[],
    paperTitle: string,
    sectionsContent: string,
    lang: Language = 'zh'
): Promise<string> => {
    return callGeminiWithRetry(async (ai) => {
        const commentsText = comments.map(c =>
            `[${c.reviewerLabel} | ${c.type}] ${c.content}\n已有回复草稿: ${c.response || '（空）'}`
        ).join('\n\n');

        const prompt = `你是一名资深科研人员，正在为论文「${paperTitle}」撰写审稿回复信（Response to Reviewers / Rebuttal Letter）。

审稿意见列表：
${commentsText}

论文主要内容（摘要）：
${sectionsContent.substring(0, 3000)}

请生成一封完整的、专业的 Response Letter。要求：
1. 格式规范：开头致谢编辑和审稿人，然后逐条回复
2. 每条回复格式：
   - 先引用审稿人原文（用斜体标记）
   - 然后给出详细、有理有据的回复
   - 如果有修改，明确说明修改位置和内容
3. Major 意见需要特别详细的回复，包含具体的实验/数据/文献支持
4. Minor 意见简洁回复即可
5. Positive 评价礼貌致谢
6. 如果已有回复草稿，将其融入并专业化润色
7. ${lang === 'zh' ? '使用学术中文撰写（专业术语可使用英文）' : '使用严谨的学术英文撰写'}
8. 使用 Markdown 格式`;

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

/**
 * AI 针对单条审稿意见生成精准回复
 */
export const generateSingleReply = async (
    comment: ReviewerComment,
    paperTitle: string,
    sectionsContent: string,
    lang: Language = 'zh'
): Promise<string> => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名资深科研人员，正在为论文「${paperTitle}」回复审稿人意见。

审稿人意见（${comment.type === 'major' ? '重大修改' : comment.type === 'minor' ? '小修' : '积极评价'}）：
"${comment.content}"

论文相关内容：
${sectionsContent.substring(0, 2000)}

请生成一段专业、详细的回复。要求：
1. ${comment.type === 'major' ? '提供详细的技术论证，引用具体实验数据或文献支持' : comment.type === 'minor' ? '简洁明了地回复，说明已修改或解释原因' : '礼貌致谢，简要回应'}
2. 如果涉及修改，说明具体修改内容和位置
3. ${lang === 'zh' ? '使用学术中文' : '使用学术英文'}
4. 不要包含开头称呼和结尾签名，只需要正文内容
5. 控制在 100-300 字`;

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

