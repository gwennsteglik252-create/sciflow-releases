import { callGeminiWithRetry, FAST_MODEL, PRO_MODEL, SPEED_CONFIG, extractJson } from "./core";
import { Type } from "@google/genai";

// Helper to append sources from grounding metadata
const appendGroundingSources = (text: string, response: any) => {
    if (!response.candidates?.[0]?.groundingMetadata?.groundingChunks) return text;

    const chunks = response.candidates[0].groundingMetadata.groundingChunks;
    const sources = chunks
        .map((c: any) => c.web?.uri ? `[${c.web.title || 'Source'}](${c.web.uri})` : null)
        .filter((s: any) => s); // Filter nulls

    // Deduplicate sources
    const uniqueSources = Array.from(new Set(sources));

    if (uniqueSources.length > 0) {
        return text + "\n\n---\n**参考来源 (Grounding Sources):**\n" + uniqueSources.map((s: any) => `- ${s}`).join("\n");
    }
    return text;
};

export const chatWithAssistant = async (history: any[], message: string, images?: string[], useSearch: boolean = false) => {
    return callGeminiWithRetry(async (ai) => {
        const parts: any[] = [{ text: message + " (请使用专业的科研视角，全程以中文回答。如果用户上传了图片，请优先分析图片特征)" }];

        if (images && images.length > 0) {
            images.forEach(img => {
                parts.push({
                    inlineData: {
                        mimeType: 'image/png',
                        data: img.split(',')[1]
                    }
                });
            });
        }

        // 仅保留最近 10 轮对话历史，避免 token 过长影响速度
        const trimmedHistory = history.length > 20 ? history.slice(-20) : history;
        const contents = [...trimmedHistory, { role: 'user', parts }];

        const config: any = { ...SPEED_CONFIG };
        if (useSearch) {
            config.tools = [{ googleSearch: {} }];
        }

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents,
            config
        });

        const text = response.text || "";
        return useSearch ? appendGroundingSources(text, response) : text;
    });
};

/**
 * NEW: Multi-Agent Scientific Debate Engine
 * Orchestrates a debate between different scientific personas
 */
export const runExpertDebate = async (
    proposition: string,
    context: string,
    agentPersona: any,
    previousTurns: string = ""
) => {
    return callGeminiWithRetry(async (ai) => {
        const systemPrompt = `你现在是 "${agentPersona.name}" (${agentPersona.title})。
        你的研究偏好是：${agentPersona.focus}。
        你的性格特征是：${agentPersona.description}。
        
        目前正在进行一场【学术辩论会】。
        【辩论主题】：${proposition}
        【项目上下文】：${context}
        
        【辩论进展记录】：
        ${previousTurns || "辩论刚刚开始。"}
        
        【任务要求】：
        1. 请基于你的立场，对主题或前人的观点发表评论。
        2. 你的发言必须体现你的专业深度（例如涉及具体的热力学平衡、动力学常数、或者产业化瓶颈）。
        3. 如果前面的专家有逻辑漏洞，请毫不留情地指出（如果是 ${agentPersona.id === 'rigor' ? 'Dr. Nova' : 'Dr. Rigor'} 的观点）。
        4. 语言：严谨的学术中文。
        5. 篇幅：控制在 150-200 字左右，保持节奏。
        
        直接输出你的发言内容，不要有任何开场白。`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: systemPrompt,
            config: {
                ...SPEED_CONFIG,
                temperature: 0.8, // Higher temperature for more "conflict" and creative debating
                thinkingConfig: { thinkingBudget: 2048 }
            }
        });

        return response.text || "";
    });
};

/**
 * NEW: Synthesize the final consensus after the debate
 */
export const synthesizeDebateConsensus = async (proposition: string, transcript: string) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `你是一名学术委员会主席。请总结以下专家辩论的内容，并给出最终的“立项/执行建议”。
        
        【原始提议】：${proposition}
        【辩论实录】：
        ${transcript}
        
        要求输出 JSON 格式：
        {
          "summary": "对辩论核心冲突点的精炼总结",
          "verdict": "综合评估结论（支持/修正后支持/反对）",
          "actionItems": ["具体改进建议1", "具体改进建议2"]
        }
        语言：学术中文。`;

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
                        verdict: { type: Type.STRING },
                        actionItems: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["summary", "verdict", "actionItems"]
                }
            }
        });

        return JSON.parse(extractJson(response.text || '{}'));
    });
};

export const chatWithMilestoneAI = async (history: any[], message: string, context: string, images?: string[]) => {
    return callGeminiWithRetry(async (ai) => {
        const userParts: any[] = [{ text: message }];

        // 注入图片附件（与 chatWithAssistant 保持一致）
        if (images && images.length > 0) {
            images.forEach(img => {
                userParts.push({
                    inlineData: {
                        mimeType: 'image/png',
                        data: img.split(',')[1]
                    }
                });
            });
        }

        const contents = [
            { role: 'user', parts: [{ text: `你现在是一名深度集成在科研管理系统中的专家助手。背景上下文: ${context} (请全程使用专业的学术中文交流。如果用户上传了图片，请优先分析图片内容)` }] },
            ...history,
            { role: 'user', parts: userParts }
        ];

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents,
            config: {
                ...SPEED_CONFIG,
                tools: [{ googleSearch: {} }]
            }
        });
        return appendGroundingSources(response.text || "", response);
    });
};

export const chatWithLiterature = async (history: any[], message: string, item: any, filePayload?: any) => {
    return callGeminiWithRetry(async (ai) => {
        const isMultimodal = filePayload && filePayload.mimeType;
        const isTextFile = isMultimodal && filePayload.mimeType === 'text/plain';
        const isFirstTurn = !history || history.length === 0;

        // Build the system context
        // KEY OPTIMIZATION: Only send the full PDF on the FIRST turn.
        // Follow-up turns use a lightweight text-only system prompt.
        const systemParts: any[] = [];

        if (isFirstTurn && isMultimodal && !isTextFile) {
            // First turn: send the full PDF as inlineData
            systemParts.push({ inlineData: { mimeType: filePayload.mimeType, data: filePayload.data } });
            systemParts.push({
                text: `你现在是《${item.title}》这篇文献的智能导读助手。上方已提供文献的完整文件内容。请根据该文献的完整正文内容（而非元数据）来回答用户问题。

【重要格式要求】：
1. 请全程使用专业的学术中文回答。
2. 每次回答结束后，必须附上"📍 原文依据"部分，引用文献中支持你回答的 1-3 段原文（逐字引用，用引号包裹），并标注其大致位置（如"摘要"、"引言"、"方法部分"、"结论"、"第X节"等）。
3. 格式示例：
📍 **原文依据：**
- 摘要："原文引用内容..."
- 第3节："原文引用内容..."` });
        } else if (!isFirstTurn && isMultimodal && !isTextFile) {
            // Follow-up turns with PDF: do NOT re-upload the file
            // The model already has the document context from the first turn in conversation history
            systemParts.push({ text: `你是《${item.title}》的智能导读助手，你已在本次会话中阅读了该文献的完整内容。请继续基于该文献的正文回答用户的新问题，并在每次回答后附上"📍 原文依据"（引用原文 1-2 段，注明位置）。请全程使用专业的学术中文。` });
        } else if (isTextFile) {
            // Text file: only send on first turn (30k char limit)
            const textContent = isFirstTurn ? filePayload.data.substring(0, 30000) : '';
            const prompt = isFirstTurn
                ? `你现在是《${item.title}》这篇文献的智能导读助手。\n\n【文献全文内容】:\n${textContent}\n\n请根据以上文献完整内容回答用户问题。请全程使用专业的学术中文回答。\n\n【重要格式要求】：每次回答结束后，必须附上"📍 原文依据"部分，引用文献中支持你回答的 1-3 段原文，并标注位置。`
                : `你是《${item.title}》的智能导读助手，你已阅读了该文献全文。请继续回答并附"📍 原文依据"。请全程使用专业的学术中文。`;
            systemParts.push({ text: prompt });
        } else {
            // Fallback: only abstract available
            systemParts.push({ text: `你现在是《${item.title}》这篇文献的智能导读助手。\n\n【文献摘要】:\n${item.abstract}\n\n请根据以上信息回答用户问题。请全程使用专业的学术中文回答。` });
        }

        const contents = [
            { role: 'user', parts: systemParts },
            { role: 'model', parts: [{ text: `好的，我已经阅读了《${item.title}》的${isMultimodal ? '完整内容' : '摘要信息'}，请问您想了解什么？` }] },
            ...history,
            { role: 'user', parts: [{ text: message }] }
        ];

        const response = await ai.models.generateContent({
            model: FAST_MODEL,
            contents,
            config: {
                ...SPEED_CONFIG,
                tools: [{ googleSearch: {} }]
            }
        });
        return appendGroundingSources(response.text || "", response);
    });
};