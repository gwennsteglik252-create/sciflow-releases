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
 * Final Answer Synthesis using Retrieved Context
 */
export const synthesizeRagAnswer = async (query: string, contextChunks: string[]) => {
  return callGeminiWithRetry(async (ai) => {
    const contextStr = contextChunks.join('\n\n---\n\n');
    const prompt = `你是一个博学、严谨的科研大脑。请基于以下提供的【本地文献片段】库，回答科研人员的问题。
        
        【规则】：
        1. 答案必须且只能源于提供的【本地文献片段】。如果文献中没有相关信息，请诚实回答“库内暂无相关数据支撑”。
        2. 如果不同文献之间存在结论冲突，请对比指出。
        3. 请使用极其专业的学术中文，适当使用 LaTeX 公式。
        4. 尽量提取定量数值（如 pH 值范围、过电位、产率等）。

        【本地文献片段】：
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