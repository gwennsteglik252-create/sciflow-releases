
import React, { useState, useCallback, useRef } from 'react';
import { useProjectContext } from '../context/ProjectContext';
import { generateEmbeddings, cosineSimilarity, synthesizeRagAnswer } from '../services/gemini/rag';
import { vault } from '../services/persistence';
import {
    chunkText, hashContent, extractKeywords,
    bm25ScoreWithIdf, reciprocalRankFusion,
    computeDocFrequencies
} from '../utils/ragChunker';

// ─── 索引 Chunk 数据结构（★ Phase 1: 新增 contentHash / version / chunkIndex） ─

export interface IndexedChunk {
    id: string;
    /** 原始数据源 ID（文献 ID / 实验记录 ID / 里程碑 ID） */
    sourceId: string;
    /** 数据源类型 */
    sourceType: 'literature' | 'experiment_log' | 'milestone' | 'experiment_plan';
    /** 用于展示的来源标签 */
    sourceLabel: string;
    text: string;
    embedding: number[];
    /** 索引时间戳，用于增量索引 */
    indexedAt: number;
    // ★ Phase 1 新增字段
    /** 内容哈希 — 用于检测数据变更 */
    contentHash: string;
    /** 分块序号（同一 sourceId 可能有多个 chunk） */
    chunkIndex: number;
    /** 数据版本号 */
    version: number;
    // 兼容旧字段
    literatureId?: string;
}

// ─── 内部类型 ─────────────────────────────────────────────────────

interface CollectedItem {
    id: string;
    sourceId: string;
    sourceType: IndexedChunk['sourceType'];
    sourceLabel: string;
    text: string;
}

// ─── 对话会话管理已内联，按 projectId 隔离 ─────────────────

// ─── 主 Hook ──────────────────────────────────────────────────────

export const useRagEngine = (projectId?: string) => {
    const { showToast, resources, projects, setAiStatus } = useProjectContext();
    const [isIndexing, setIsIndexing] = useState(false);
    const [indexProgress, setIndexProgress] = useState(0);
    const [query, setQuery] = useState('');
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', text: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    /** 索引统计（最近一次训练结果） */
    const [indexStats, setIndexStats] = useState<{
        literature: number; logs: number; milestones: number; plans: number;
        skipped: number; updated: number; orphansRemoved: number; totalChunks: number;
    } | null>(null);

    // ★ 项目切换时清空对话历史（会话隔离）
    const prevProjectRef = useRef<string>(projectId || '');
    React.useEffect(() => {
        if (projectId && projectId !== prevProjectRef.current) {
            setChatHistory([]);
            prevProjectRef.current = projectId;
        }
    }, [projectId]);

    // ─── 收集所有可索引数据源 ──────────────────────────────────────
    const collectIndexableItems = useCallback(() => {
        const items: CollectedItem[] = [];

        // ① 文献摘要（原有逻辑）
        for (const r of resources) {
            if (r.abstract && r.abstract.length > 50) {
                items.push({
                    id: `lit_${r.id}`,
                    sourceId: r.id,
                    sourceType: 'literature',
                    sourceLabel: `文献: ${r.title}`,
                    text: r.abstract
                });
            }
        }

        // ② 实验记录的 AI 洞察
        for (const project of projects) {
            for (const ms of project.milestones) {
                // 里程碑假设
                if (ms.hypothesis && ms.hypothesis.length > 20) {
                    items.push({
                        id: `ms_${ms.id}`,
                        sourceId: ms.id,
                        sourceType: 'milestone',
                        sourceLabel: `研究假设[${ms.title}]`,
                        text: `研究假设: ${ms.hypothesis}`
                    });
                }

                for (const log of ms.logs) {
                    // AI 总结
                    if (log.summaryInsight && log.summaryInsight.length > 30) {
                        items.push({
                            id: `log_summary_${log.id}`,
                            sourceId: log.id,
                            sourceType: 'experiment_log',
                            sourceLabel: `实验总结[${log.content}]@${ms.title}`,
                            text: `实验: ${log.content}\n参数: ${log.parameters || '无'}\n总结: ${log.summaryInsight}`
                        });
                    }
                    // 机理分析
                    if (log.mechanismInsight && log.mechanismInsight.length > 30) {
                        items.push({
                            id: `log_mechanism_${log.id}`,
                            sourceId: log.id,
                            sourceType: 'experiment_log',
                            sourceLabel: `机理分析[${log.content}]@${ms.title}`,
                            text: `实验: ${log.content}\n机理分析: ${log.mechanismInsight}`
                        });
                    }
                    // 合规审计
                    if (log.complianceInsight && log.complianceInsight.length > 30) {
                        items.push({
                            id: `log_audit_${log.id}`,
                            sourceId: log.id,
                            sourceType: 'experiment_log',
                            sourceLabel: `合规审计[${log.content}]@${ms.title}`,
                            text: `实验: ${log.content}\n审计: ${log.complianceInsight}`
                        });
                    }
                    // 如果没有 AI 洞察但有详细描述，也索引
                    if (!log.summaryInsight && !log.mechanismInsight && log.description && log.description.length > 50) {
                        items.push({
                            id: `log_desc_${log.id}`,
                            sourceId: log.id,
                            sourceType: 'experiment_log',
                            sourceLabel: `实验记录[${log.content}]@${ms.title}`,
                            text: `实验: ${log.content}\n状态: ${log.status} | 结果: ${log.result}\n描述: ${log.description}\n参数: ${log.parameters || '无'}`
                        });
                    }
                }

                // ③ 实验矩阵方案
                for (const plan of (ms.experimentalPlan || [])) {
                    if (plan.notes && plan.notes.length > 20) {
                        const matrixStr = plan.matrix?.map(m => `${m.name}: ${m.target || ''} (${m.range || ''})`).join(', ') || '';
                        items.push({
                            id: `plan_${plan.id}`,
                            sourceId: plan.id,
                            sourceType: 'experiment_plan',
                            sourceLabel: `实验方案[${plan.title}]@${ms.title}`,
                            text: `方案: ${plan.title}\n说明: ${plan.notes}\n变量矩阵: ${matrixStr}`
                        });
                    }
                }
            }
        }

        return items;
    }, [resources, projects]);

    // ─── ★ Phase 1: 孤立索引清理 ──────────────────────────────────
    const pruneOrphanedChunks = useCallback(async (
        validItemIds: Set<string>,
        existingChunks: IndexedChunk[]
    ): Promise<number> => {
        let removed = 0;
        for (const chunk of existingChunks) {
            // 从 chunk.id 中提取原始 item ID（去掉 _chunk_N 后缀）
            const baseId = chunk.id.replace(/_chunk_\d+$/, '');
            if (!validItemIds.has(baseId)) {
                await vault.delete('document_embeddings', chunk.id);
                removed++;
            }
        }
        return removed;
    }, []);

    // ─── ★ Phase 1+2: 增量 + 分块 + 变更检测 索引 ─────────────────
    const startIndexing = useCallback(async () => {
        const allItems = collectIndexableItems();
        if (allItems.length === 0) {
            showToast({ message: "没有足够的数据可供索引（请先添加文献或产生实验 AI 洞察）", type: 'info' });
            return;
        }

        setIsIndexing(true);
        setAiStatus?.('🧠 正在构建全维度科研知识网...');

        try {
            // ★ 获取已索引的 chunks
            const existingChunks = await vault.getAll<IndexedChunk>('document_embeddings');
            const existingMap = new Map<string, IndexedChunk>();
            for (const chunk of existingChunks) {
                existingMap.set(chunk.id, chunk);
            }

            // ★ Phase 1: 清理孤立索引（数据源已删除但 embedding 残留）
            const validItemIds = new Set(allItems.map(item => item.id));
            const orphansRemoved = await pruneOrphanedChunks(validItemIds, existingChunks);
            if (orphansRemoved > 0) {
                console.log(`[RAG] 清理了 ${orphansRemoved} 条孤立索引`);
            }

            // ★ Phase 1: 对每个 item 进行分块 + 变更检测
            interface ChunkTask {
                chunkId: string;
                item: CollectedItem;
                text: string;
                chunkIndex: number;
                contentHash: string;
                action: 'skip' | 'create' | 'update';
            }

            const tasks: ChunkTask[] = [];
            let skippedCount = 0;
            let updatedCount = 0;

            for (const item of allItems) {
                // ★ 智能分块（替代旧的暴力截断）
                const chunks = chunkText(item.text, {
                    maxChunkSize: 500,
                    overlapSize: 80,
                    minSplitThreshold: 600,
                });

                for (const chunk of chunks) {
                    const chunkId = chunks.length === 1
                        ? item.id   // 单 chunk 保持原 ID 兼容性
                        : `${item.id}_chunk_${chunk.chunkIndex}`;

                    const contentHash = hashContent(chunk.text);
                    const existing = existingMap.get(chunkId);

                    if (existing) {
                        if (existing.contentHash === contentHash) {
                            // ★ 内容未变更 → 跳过
                            skippedCount++;
                            tasks.push({
                                chunkId, item, text: chunk.text,
                                chunkIndex: chunk.chunkIndex, contentHash,
                                action: 'skip'
                            });
                        } else {
                            // ★ 内容有变更 → 需要重新索引
                            updatedCount++;
                            tasks.push({
                                chunkId, item, text: chunk.text,
                                chunkIndex: chunk.chunkIndex, contentHash,
                                action: 'update'
                            });
                        }
                    } else {
                        // 新数据
                        tasks.push({
                            chunkId, item, text: chunk.text,
                            chunkIndex: chunk.chunkIndex, contentHash,
                            action: 'create'
                        });
                    }

                    // 清理：如果原来有多个 chunk 但现在只有一个了（内容缩短）
                    // 需要删除多余的旧 chunk
                    if (chunks.length === 1) {
                        for (let oldIdx = 1; oldIdx < 20; oldIdx++) {
                            const oldChunkId = `${item.id}_chunk_${oldIdx}`;
                            if (existingMap.has(oldChunkId)) {
                                await vault.delete('document_embeddings', oldChunkId);
                            }
                        }
                    }
                }
            }

            // 过滤出需要处理的任务
            const activeTasks = tasks.filter(t => t.action !== 'skip');

            if (activeTasks.length === 0) {
                showToast({
                    message: `所有 ${allItems.length} 条数据（${tasks.length} 个分块）已索引且无变更` +
                        (orphansRemoved > 0 ? `，清理了 ${orphansRemoved} 条过期索引` : ''),
                    type: 'info'
                });
                setIsIndexing(false);
                setAiStatus?.(null);
                return;
            }

            const stats = {
                literature: 0, logs: 0, milestones: 0, plans: 0,
                skipped: skippedCount, updated: updatedCount,
                orphansRemoved, totalChunks: tasks.length,
            };
            let completed = 0;
            let retryDelay = 500; // ★ 自适应速率：起始 500ms

            for (const task of activeTasks) {
                // ★ 自适应速率控制：正常 500ms，429 时指数退避
                if (completed > 0) {
                    await new Promise(r => setTimeout(r, retryDelay));
                }

                let vector: number[];
                try {
                    vector = await generateEmbeddings(task.text);
                    // 成功 → 逐步恢复速率
                    if (retryDelay > 500) retryDelay = Math.max(500, Math.floor(retryDelay / 2));
                } catch (embErr: any) {
                    if (embErr?.status === 429 || embErr?.message?.includes('429') || embErr?.message?.includes('rate')) {
                        // ★ 429 → 指数退避（上限 15s）
                        retryDelay = Math.min(15000, retryDelay * 2);
                        console.warn(`[RAG] 速率限制，退避 ${retryDelay}ms`);
                        await new Promise(r => setTimeout(r, retryDelay));
                        vector = await generateEmbeddings(task.text); // 重试一次
                    } else {
                        throw embErr;
                    }
                }
                const indexedChunk: IndexedChunk = {
                    id: task.chunkId,
                    sourceId: task.item.sourceId,
                    sourceType: task.item.sourceType,
                    sourceLabel: task.item.sourceLabel,
                    text: task.text,
                    embedding: vector,
                    indexedAt: Date.now(),
                    // ★ Phase 1 新字段
                    contentHash: task.contentHash,
                    chunkIndex: task.chunkIndex,
                    version: (existingMap.get(task.chunkId)?.version || 0) + 1,
                    // 兼容旧字段
                    literatureId: task.item.sourceType === 'literature' ? task.item.sourceId : undefined
                };
                await vault.putOne('document_embeddings', indexedChunk);

                // 统计（只对新创建的计数，避免 update 重复统计）
                if (task.action === 'create') {
                    if (task.item.sourceType === 'literature') stats.literature++;
                    else if (task.item.sourceType === 'experiment_log') stats.logs++;
                    else if (task.item.sourceType === 'milestone') stats.milestones++;
                    else if (task.item.sourceType === 'experiment_plan') stats.plans++;
                }

                completed++;
                setIndexProgress(Math.round((completed / activeTasks.length) * 100));
                setAiStatus?.(`🧠 知识索引 ${completed}/${activeTasks.length}...`);
            }

            setIndexStats(stats);
            const parts: string[] = [];
            if (stats.literature > 0) parts.push(`${stats.literature} 篇文献`);
            if (stats.logs > 0) parts.push(`${stats.logs} 条实验洞察`);
            if (stats.milestones > 0) parts.push(`${stats.milestones} 个研究假设`);
            if (stats.plans > 0) parts.push(`${stats.plans} 个实验方案`);
            if (stats.updated > 0) parts.push(`更新 ${stats.updated} 条变更`);
            if (stats.skipped > 0) parts.push(`跳过 ${stats.skipped} 条已有`);
            if (stats.orphansRemoved > 0) parts.push(`清理 ${stats.orphansRemoved} 条过期`);
            parts.push(`总计 ${stats.totalChunks} 个知识分块`);
            showToast({ message: `科研大脑训练完成：${parts.join('、')}`, type: 'success' });

        } catch (e) {
            console.error("Indexing error", e);
            showToast({ message: "索引构建中断，已保存部分进度", type: 'error' });
        } finally {
            setIsIndexing(false);
            setIndexProgress(0);
            setAiStatus?.(null);
        }
    }, [collectIndexableItems, pruneOrphanedChunks, setAiStatus, showToast]);

    // ─── ★ Phase 2: 混合检索（向量 + BM25 + RRF 融合） ─────────────
    const handleSearch = async () => {
        if (!query.trim() || isLoading) return;

        setIsLoading(true);
        const userMsg = query;
        setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
        setQuery('');

        try {
            const allEmbeddings = await vault.getAll<IndexedChunk>('document_embeddings');

            if (allEmbeddings.length === 0) {
                setChatHistory(prev => [...prev, {
                    role: 'model',
                    text: '知识库为空，请先点击「训练大脑」索引当前数据。'
                }]);
                return;
            }

            // ★ 路径 A: 向量语义检索
            const queryVector = await generateEmbeddings(userMsg);
            const vectorRanked = allEmbeddings
                .map(chunk => ({
                    ...chunk,
                    vectorScore: cosineSimilarity(queryVector, chunk.embedding)
                }))
                .filter(c => c.vectorScore > 0.30)
                .sort((a, b) => b.vectorScore - a.vectorScore)
                .slice(0, 12);

            // ★ 路径 B: BM25 + IDF 关键词检索
            const keywords = extractKeywords(userMsg);
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
            const mergedResults = reciprocalRankFusion<IndexedChunk>(
                [vectorRanked, bm25Ranked],
                60,
                (item) => item.id
            ).slice(0, 8);

            if (mergedResults.length === 0) {
                setChatHistory(prev => [...prev, {
                    role: 'model',
                    text: '在本地知识库中未找到直接相关的证据。建议：\n1. 先点击\"训练大脑\"索引当前数据\n2. 导入更多相关文献\n3. 对实验记录执行 AI 分析后再训练'
                }]);
                return;
            }

            // ★ 使用增强的 sourceLabel 构建上下文
            const contextTexts = mergedResults.map(c => {
                // 兼容旧的索引数据
                if (!c.sourceLabel && c.literatureId) {
                    const lit = resources.find(r => r.id === c.literatureId);
                    return `【文献: ${lit?.title || 'Unknown'}】: ${c.text}`;
                }
                // ★ 新增：标注分块信息
                const chunkInfo = c.chunkIndex > 0 ? `[片段${c.chunkIndex + 1}]` : '';
                return `【${c.sourceLabel || '未知来源'}${chunkInfo}】: ${c.text}`;
            });

            // ★ Phase 2: 传递对话历史上下文，支持追问式深入对话
            const recentHistory = chatHistory.slice(-6);
            const answer = await synthesizeRagAnswer(userMsg, contextTexts, recentHistory);
            setChatHistory(prev => [...prev, { role: 'model', text: answer }]);
        } catch (e) {
            console.error('[RAG] 搜索异常:', e);
            setChatHistory(prev => [...prev, { role: 'model', text: '科研大脑响应异常，请稍后重试。' }]);
            showToast({ message: "科研大脑响应异常", type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return {
        isIndexing, indexProgress, query, setQuery,
        chatHistory, isLoading, handleSearch, startIndexing,
        indexStats
    };
};
