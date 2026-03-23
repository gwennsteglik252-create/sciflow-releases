import { GoogleGenAI } from "@google/genai";
import { callGeminiWithRetry, PRO_MODEL, FAST_MODEL, SPEED_CONFIG } from "./core";

/**
 * Generate semantic embeddings for a text string using Gemini Embedding API.
 */
export const generateEmbeddings = async (text: string) => {
  return callGeminiWithRetry(async (ai) => {
    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: text
    });
    return response.embeddings[0].values;
  });
};

/**
 * Perform Cosine Similarity locally for RAG retrieval.
 */
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Final Answer Synthesis using Retrieved Context.
 * ★ 支持传入对话历史，实现追问式深入对话。
 */
export const synthesizeRagAnswer = async (
  query: string,
  contextChunks: string[],
  conversationHistory?: { role: 'user' | 'model', text: string }[]
) => {
  return callGeminiWithRetry(async (ai) => {
    const contextStr = contextChunks.join('\n\n---\n\n');

    // ★ 构建对话历史上下文段（智能截断：用户消息保留完整，AI 回复压缩）
    let historyBlock = '';
    if (conversationHistory && conversationHistory.length > 0) {
      const HISTORY_BUDGET = 2000; // 总历史上下文字符预算
      let budget = HISTORY_BUDGET;
      const formattedMsgs: string[] = [];

      // 从最近的消息向前处理，优先保留最近的对话
      for (let i = conversationHistory.length - 1; i >= 0 && budget > 0; i--) {
        const msg = conversationHistory[i];
        const prefix = msg.role === 'user' ? '用户' : 'AI';
        // 用户消息保留完整（但限制 500 字），AI 回复压缩到 300 字
        const maxLen = msg.role === 'user' ? 500 : 300;
        const text = msg.text.length > maxLen ? msg.text.substring(0, maxLen) + '…' : msg.text;
        const entry = `${prefix}：${text}`;
        if (entry.length <= budget) {
          formattedMsgs.unshift(entry);
          budget -= entry.length;
        } else {
          break;
        }
      }

      if (formattedMsgs.length > 0) {
        historyBlock = `\n\n【对话历史】（请基于此理解用户的追问意图）：\n` +
          formattedMsgs.join('\n') + '\n';
      }
    }

    const prompt = `你是一个博学、严谨的科研大脑。请基于以下提供的【本地知识库】回答科研人员的问题。
知识库中的数据来源包括：发表文献、实验记录 AI 洞察、研究假设、实验矩阵方案等多种类型。

【规则】：
1. 答案必须且只能源于提供的【本地知识库】。如果库中没有相关信息，请诚实回答"库内暂无相关数据支撑"。
2. 如果不同来源之间存在结论冲突，请对比指出并分析原因。
3. 当实验数据与文献理论不一致时，优先呈现两者对比，而非只引用一方。
4. 请使用极其专业的学术中文，适当使用 LaTeX 公式。
5. 尽量提取定量数值（如 pH 值范围、过电位、产率等）。
6. 引用数据时请注明来源类型（如：「据文献[xxx]」或「据实验记录[xxx]」）。
${historyBlock}
【本地知识库】：
${contextStr}

【科研问题】：
${query}`;

    const response = await ai.models.generateContent({
      model: PRO_MODEL,
      contents: prompt,
      config: {
        ...SPEED_CONFIG,
        thinkingConfig: { thinkingBudget: 4096 }
      }
    });

    return response.text || "无法合成有效回答。";
  });
};