
/**
 * 无状态 RAG 检索函数 — 供综述工坊等模块直接调用
 * 从 useRagEngine 中提取核心检索逻辑，脱离 React Hook 依赖
 */

import { generateEmbeddings, cosineSimilarity } from './rag';
import { vault } from '../persistence';
import {
    extractKeywords, bm25ScoreWithIdf,
    computeDocFrequencies, reciprocalRankFusion
} from '../../utils/ragChunker';
import type { IndexedChunk } from '../../hooks/useRagEngine';

/**
 * 查询本地知识库，返回格式化后的相关知识片段
 * @param query 查询文本（如章节标题 + 描述）
 * @param topK 返回的最大结果数（默认 6）
 * @returns 格式化后的上下文片段数组，为空则表示知识库无相关数据
 */
export async function queryRagContext(query: string, topK: number = 6): Promise<string[]> {
    try {
        const allEmbeddings = await vault.getAll<IndexedChunk>('document_embeddings');
        if (allEmbeddings.length === 0) return [];

        // ★ 路径 A: 向量语义检索
        const queryVector = await generateEmbeddings(query);
        const vectorRanked = allEmbeddings
            .map(chunk => ({
                ...chunk,
                vectorScore: cosineSimilarity(queryVector, chunk.embedding)
            }))
            .filter(c => c.vectorScore > 0.30)
            .sort((a, b) => b.vectorScore - a.vectorScore)
            .slice(0, 12);

        // ★ 路径 B: BM25 + IDF 关键词检索
        const keywords = extractKeywords(query);
        const avgDocLen = allEmbeddings.reduce((sum, c) => sum + c.text.length, 0) / allEmbeddings.length;
        const docFreqs = computeDocFrequencies(keywords, allEmbeddings.map(c => c.text));
        const bm25Ranked = allEmbeddings
            .map(chunk => ({
                ...chunk,
                bm25Score: bm25ScoreWithIdf(keywords, chunk.text, avgDocLen, allEmbeddings.length, docFreqs)
            }))
            .filter(c => c.bm25Score > 0)
            .sort((a, b) => b.bm25Score - a.bm25Score)
            .slice(0, 12);

        // ★ RRF 融合排序
        const merged = reciprocalRankFusion<IndexedChunk>(
            [vectorRanked, bm25Ranked],
            60,
            (item) => item.id
        ).slice(0, topK);

        if (merged.length === 0) return [];

        // 格式化为带来源标签的上下文片段
        return merged.map(c => {
            const chunkInfo = c.chunkIndex > 0 ? `[片段${c.chunkIndex + 1}]` : '';
            return `【${c.sourceLabel || '本地知识'}${chunkInfo}】: ${c.text}`;
        });
    } catch (err) {
        console.warn('[queryRagContext] RAG 检索失败，跳过本地知识增强', err);
        return [];
    }
}
