
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useAsyncStorage } from './useAsyncStorage';
import {
    ReviewConfig, ReviewSession, ReviewPipelineStage, ReviewStageStatus,
    ReviewSubQuestion, ReviewOutlineNode, ScreenedLiterature, Literature,
    ReviewGeneratedFigure, RevisionRound, PaperSection,
    MultiAgentRevisionRound, AgentReport, ReviewAgentRole,
    KnowledgeQuadruple, ReviewKnowledgeGraph,
    ConsistencyReport, ConsistencyIssue, ContentSnapshot, StageTiming
} from '../types';
import {
    decomposeReviewTopic, screenLiterature, generateReviewOutline,
    generateReviewSection, generateReviewSectionStream,
    auditReviewCrossRef, generateReviewAbstract,
    polishTextEnhanced,
    generateComparisonTableData, generateTrendAnalysis, generateFigureDescription,
    auditReviewStructured, reviseReviewSection,
    AuditIssue, generateCompositeFigureCaption,
    interactiveEditSection, EditAction,
    matchFiguresToSections, FigureMatchInput,
    injectFigureReferences, FigureRefForInjection
} from '../services/gemini';
import { smartResourceSearch, enrichLiteratureFromSearch, extractKnowledgeSinkAI, SearchFilters } from '../services/gemini/resource';
import { extractTextFromPdfUrl, extractTextFromPdfBase64 } from '../utils/pdfTextExtractor';
import { queryRagContext } from '../services/gemini/ragQuery';
import { generateSankeyDataAI, generateTimelineDataAI, generateStructuralDiagram, generateSummaryInfographic } from '../services/gemini/flowchart';
import { SankeyData, SankeyNode, SankeyLink, SavedFigureAssembly, FigurePanel } from '../types/visuals';
import { DEFAULT_SANKEY_PALETTE } from '../components/FigureCenter/Sankey/sankeyLayout';
import { renderAssemblyToImage } from '../utils/renderAssemblyToImage';
import { orchestrateMultiAgentRevision } from '../services/gemini/reviewAgents';
import { extractQuadruplesFromLiterature } from '../services/gemini/knowledgeGraph';
import { runFullConsistencyScan, applyConsistencyFixes } from '../services/gemini/consistencyEngine';
import { batchExtractFigures, ExtractedFigure, LiteratureInfo } from '../utils/pdfFigureExtractor';
import { composeAndRender } from '../utils/autoFigureComposer';

// ═══════════════════════════════════════════════════════════════════
// 管线阶段定义
// ═══════════════════════════════════════════════════════════════════

const STAGE_ORDER: ReviewPipelineStage[] = [
    'idle', 'topic_decomposition', 'literature_search', 'literature_screening',
    'knowledge_extraction', 'outline_generation', 'section_generation',
    'figure_generation', 'cross_audit', 'polishing', 'writing_to_editor', 'completed'
];

const STAGE_LABELS: Record<ReviewPipelineStage, string> = {
    idle: '准备就绪',
    topic_decomposition: '主题分解',
    literature_search: '文献检索',
    literature_screening: '文献筛选',
    knowledge_extraction: '知识沉降',
    outline_generation: '大纲生成',
    section_generation: '逐节生成',
    figure_generation: '图表生成',
    cross_audit: '交叉审计',
    polishing: '学术润色',
    writing_to_editor: '写入编辑器',
    completed: '已完成'
};

const createInitialStages = (): ReviewStageStatus[] =>
    STAGE_ORDER.filter(s => s !== 'idle' && s !== 'completed').map(stage => ({
        stage,
        status: 'pending',
        progress: 0
    }));

/** 根据组图面板的 label + sourceRef 自动生成学术图注 */
const generateCompositeCaption = (panels: FigurePanel[]): string => {
    if (!panels || panels.length === 0) return 'Figure. 文献组图';
    const parts = panels.map(p => {
        const label = p.label || '';
        const src = p.sourceRef;
        if (src?.title) {
            const page = src.page ? `, P.${src.page}` : '';
            return `${label} ${src.title}${page}`;
        }
        return label;
    }).filter(Boolean);
    return `Figure. ${parts.join('; ')}`;
};

const createEmptySession = (): ReviewSession => ({
    id: `review_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    config: {
        topic: '',
        language: 'zh',
        scope: '',
        yearRange: [new Date().getFullYear() - 5, new Date().getFullYear()],
        maxPapers: 30,
        targetWordCount: 5000,
        citationStyle: 'numbered'
    },
    currentStage: 'idle',
    stages: createInitialStages(),
    subQuestions: [],
    literaturePool: [],
    screenedLiterature: [],
    outline: [],
    generatedSections: {},
    createdAt: new Date().toISOString()
});

// ═══════════════════════════════════════════════════════════════════
// Hook 主体
// ═══════════════════════════════════════════════════════════════════

export interface ReviewWorkshopBridge {
    /** 检索到文献后，注入项目 resources（topic 用于生成分组标签） */
    onLiteratureFound?: (newLiteratures: Literature[], topic: string) => void;
    /** 大纲生成后，同步到 paperSections */
    onOutlineGenerated?: (sections: PaperSection[]) => void;
    /** 逐节撰写时，实时更新章节内容 */
    onSectionContentUpdate?: (sectionId: string, title: string, content: string) => void;
    /** 审计报告完成后，推送到审阅面板 */
    onAuditComplete?: (report: string) => void;
    /** ★ 图表生成后，推送到科研绘图中心 */
    onFigureGenerated?: (figure: ReviewGeneratedFigure) => void;
}

export const useReviewWorkshop = (
    resources: Literature[],
    onInsertText?: (text: string) => void,
    onStageComplete?: (completedStage: string, nextStepIdx: number) => void,
    bridge?: ReviewWorkshopBridge
) => {
    // ─── 持久化存储 ───────────────────────────────────────────
    const [session, setSession, isSessionLoaded] = useAsyncStorage<ReviewSession>('review_workshop_session', createEmptySession(), 'kv');
    const [searchResults, setSearchResults, isSearchLoaded] = useAsyncStorage<Literature[]>('review_workshop_literature', [], 'kv');
    const [isRunning, setIsRunning] = useState(false);
    const [currentLog, setCurrentLog] = useState<string>('');
    const abortRef = useRef(false);
    const autoRunRef = useRef(false);

    // ─── 会话管理 ───────────────────────────────────────────────
    const updateConfig = useCallback((partial: Partial<ReviewConfig>) => {
        setSession(prev => ({ ...prev, config: { ...prev.config, ...partial } }));
    }, []);

    const resetSession = useCallback(() => {
        abortRef.current = true;
        autoRunRef.current = false;
        setIsRunning(false);
        setSession(createEmptySession());
        setSearchResults([]);
        setCurrentLog('');
    }, []);

    // ─── 文献池管理 ───────────────────────────────────────
    /** 批量添加文献到综述池（去重） */
    const addToPool = useCallback((literatureIds: string[]) => {
        setSession(prev => {
            const existing = new Set(prev.literaturePool);
            const newIds = literatureIds.filter(id => !existing.has(id));
            if (newIds.length === 0) return prev;
            return { ...prev, literaturePool: [...prev.literaturePool, ...newIds] };
        });
    }, []);

    /** 从综述池移除文献 */
    const removeFromPool = useCallback((literatureId: string) => {
        setSession(prev => ({
            ...prev,
            literaturePool: prev.literaturePool.filter(id => id !== literatureId)
        }));
    }, []);

    /** 清空综述池 */
    const clearPool = useCallback(() => {
        setSession(prev => ({ ...prev, literaturePool: [] }));
    }, []);

    // ─── 阶段状态更新 ──────────────────────────────────────────
    const updateStage = useCallback((stage: ReviewPipelineStage, update: Partial<ReviewStageStatus>) => {
        setSession(prev => ({
            ...prev,
            stages: prev.stages.map(s => s.stage === stage ? { ...s, ...update } : s)
        }));
    }, []);

    const log = useCallback((msg: string) => {
        setCurrentLog(msg);
        console.log(`[ReviewWorkshop] ${msg}`);
    }, []);

    // ═══════════════════════════════════════════════════════════════
    // 阶段 1: 主题分解
    // ═══════════════════════════════════════════════════════════════

    const runTopicDecomposition = useCallback(async () => {
        if (!session.config.topic.trim()) return;
        setIsRunning(true);
        abortRef.current = false;

        setSession(prev => ({ ...prev, currentStage: 'topic_decomposition' }));
        updateStage('topic_decomposition', { status: 'running', progress: 0, startedAt: new Date().toISOString() });
        log('正在分析综述主题，分解研究子问题...');

        try {
            const result = await decomposeReviewTopic(session.config);

            if (abortRef.current) return;

            setSession(prev => ({
                ...prev,
                subQuestions: result.subQuestions,
                currentStage: 'topic_decomposition'
            }));
            updateStage('topic_decomposition', { status: 'done', progress: 100, completedAt: new Date().toISOString(), message: `已分解为 ${result.subQuestions.length} 个子问题` });
            log(`主题分解完成：${result.subQuestions.length} 个子研究问题`);
            onStageComplete?.('topic_decomposition', 2);
        } catch (err: any) {
            updateStage('topic_decomposition', { status: 'error', error: err.message });
            log(`主题分解失败: ${err.message}`);
        } finally {
            setIsRunning(false);
        }
    }, [session.config, updateStage, log, onStageComplete]);


    // ═══════════════════════════════════════════════════════════════
    // 阶段 2: 多轮文献检索
    // ═══════════════════════════════════════════════════════════════

    const runLiteratureSearch = useCallback(async () => {
        setIsRunning(true);
        setSession(prev => ({ ...prev, currentStage: 'literature_search' }));
        updateStage('literature_search', { status: 'running', progress: 0, startedAt: new Date().toISOString() });

        const allResults: Literature[] = [];
        const seenDois = new Set<string>();
        const subQs = session.subQuestions;

        try {
            for (let i = 0; i < subQs.length; i++) {
                if (abortRef.current) break;

                const sq = subQs[i];
                const progress = Math.round(((i + 1) / subQs.length) * 100);
                log(`检索中 (${i + 1}/${subQs.length}): ${sq.keywords.join(', ')}`);
                updateStage('literature_search', { progress, message: `搜索关键词组 ${i + 1}/${subQs.length}` });

                const filters: SearchFilters = {
                    docType: 'All',
                    timeRange: '5y',
                    highImpactOnly: false
                };

                try {
                    const { items } = await smartResourceSearch(sq.keywords, 'Article', filters, 'topic');

                    for (const item of items) {
                        const doi = (item as any).doi;
                        if (doi && seenDois.has(doi)) continue;
                        if (doi) seenDois.add(doi);
                        allResults.push(item as Literature);
                    }
                } catch (searchErr) {
                    console.warn(`[ReviewWorkshop] 关键词组 ${i + 1} 搜索失败:`, searchErr);
                }
            }

            // 合并本地情报档案中相关的文献
            for (const res of resources) {
                const doi = (res as any).doi;
                if (doi && seenDois.has(doi)) continue;
                allResults.push(res);
            }

            if (abortRef.current) return;

            setSearchResults(allResults);

            // ★ 同步检索结果到综述文献池
            const allIds = allResults.map(r => r.id);
            addToPool(allIds);

            // ★ 桥接：将检索文献推送到项目 resources（带上综述主题）
            bridge?.onLiteratureFound?.(allResults, session.config.topic);

            updateStage('literature_search', {
                status: 'done', progress: 100,
                completedAt: new Date().toISOString(),
                message: `共检索到 ${allResults.length} 篇文献（外部 ${allResults.length - resources.length} + 本地 ${resources.length}）`
            });
            log(`文献检索完成：共 ${allResults.length} 篇`);
            onStageComplete?.('literature_search', 3);
        } catch (err: any) {
            updateStage('literature_search', { status: 'error', error: err.message });
            log(`文献检索失败: ${err.message}`);
        } finally {
            setIsRunning(false);
        }
    }, [session.subQuestions, resources, updateStage, log, onStageComplete]);


    // ═══════════════════════════════════════════════════════════════
    // 阶段 3: 文献筛选
    // ═══════════════════════════════════════════════════════════════

    const runLiteratureScreening = useCallback(async () => {
        setIsRunning(true);
        setSession(prev => ({ ...prev, currentStage: 'literature_screening' }));
        updateStage('literature_screening', { status: 'running', progress: 0, startedAt: new Date().toISOString() });
        log('AI 正在筛选和分级文献...');

        try {
            const screened = await screenLiterature(
                session.config.topic,
                session.subQuestions,
                searchResults,
                session.config.language
            );

            if (abortRef.current) return;

            setSession(prev => ({
                ...prev,
                screenedLiterature: screened,
                currentStage: 'literature_screening'
            }));

            const coreCount = screened.filter(s => s.tier === 'core').length;
            const supportCount = screened.filter(s => s.tier === 'supporting').length;
            updateStage('literature_screening', {
                status: 'done', progress: 100,
                completedAt: new Date().toISOString(),
                message: `核心 ${coreCount} 篇 | 支撑 ${supportCount} 篇`
            });
            log(`文献筛选完成: 核心 ${coreCount} + 支撑 ${supportCount} 篇`);
            onStageComplete?.('literature_screening', 4);
        } catch (err: any) {
            updateStage('literature_screening', { status: 'error', error: err.message });
            log(`文献筛选失败: ${err.message}`);
        } finally {
            setIsRunning(false);
        }
    }, [session.config, session.subQuestions, searchResults, updateStage, log, onStageComplete]);


    // ═══════════════════════════════════════════════════════════════
    // 阶段 4: 知识沉降
    // ═══════════════════════════════════════════════════════════════

    const runKnowledgeExtraction = useCallback(async () => {
        setIsRunning(true);
        setSession(prev => ({ ...prev, currentStage: 'knowledge_extraction' }));
        updateStage('knowledge_extraction', { status: 'running', progress: 0, startedAt: new Date().toISOString() });

        const coreLit = session.screenedLiterature
            .filter(s => s.tier === 'core' || s.tier === 'supporting')
            .map(s => searchResults.find(r => r.id === s.literatureId))
            .filter(Boolean) as Literature[];

        // 区分 core 和 supporting 用于全文获取优先级
        const coreIds = new Set(session.screenedLiterature.filter(s => s.tier === 'core').map(s => s.literatureId));
        let fullTextCount = 0;

        try {
            for (let i = 0; i < coreLit.length; i++) {
                if (abortRef.current) break;

                const lit = coreLit[i];
                const isCore = coreIds.has(lit.id);
                const progress = Math.round(((i + 1) / coreLit.length) * 70); // 前 70% 给充实 + 全文
                log(`知识沉降 (${i + 1}/${coreLit.length}): ${lit.title.substring(0, 30)}...`);
                updateStage('knowledge_extraction', { progress, message: `处理 ${i + 1}/${coreLit.length}` });

                // ─── 全文 PDF 获取（仅 core 文献） ───────────────
                let fullText: string | undefined;

                if (isCore && !lit.fullText) {
                    // 更新状态为 downloading
                    setSession(prev => ({
                        ...prev,
                        screenedLiterature: prev.screenedLiterature.map(s =>
                            s.literatureId === lit.id ? { ...s, fullTextStatus: 'downloading' as const } : s
                        )
                    }));

                    // 策略 1：尝试 OpenAlex OA URL
                    if ((lit as any).oaUrl) {
                        try {
                            log(`  📥 下载 OA PDF: ${(lit as any).oaUrl.substring(0, 50)}...`);
                            fullText = await extractTextFromPdfUrl((lit as any).oaUrl);
                            fullTextCount++;
                            log(`  ✅ 全文提取成功 (${fullText.length} 字符)`);
                        } catch (oaErr) {
                            console.warn(`[ReviewWorkshop] OA PDF 下载失败: ${lit.id}`, oaErr);
                        }
                    }

                    // 策略 2：尝试本地 PDF 文件
                    if (!fullText && lit.localPath && lit.localPath.endsWith('.pdf') && window.electron?.readFile) {
                        try {
                            log(`  📂 读取本地 PDF: ${lit.localPath}`);
                            const fileData = await window.electron.readFile(lit.localPath);
                            if (fileData?.data) {
                                fullText = await extractTextFromPdfBase64(fileData.data);
                                fullTextCount++;
                                log(`  ✅ 本地全文提取成功 (${fullText.length} 字符)`);
                            }
                        } catch (localErr) {
                            console.warn(`[ReviewWorkshop] 本地 PDF 读取失败: ${lit.id}`, localErr);
                        }
                    }

                    // 更新全文状态
                    const fullTextStatus = fullText ? 'ready' as const : 'needs_upload' as const;
                    const fullTextSource = fullText
                        ? ((lit as any).oaUrl ? 'oa_download' as const : 'local_pdf' as const)
                        : undefined;

                    setSession(prev => ({
                        ...prev,
                        screenedLiterature: prev.screenedLiterature.map(s =>
                            s.literatureId === lit.id ? { ...s, fullTextStatus } : s
                        )
                    }));

                    // 保存全文到 searchResults
                    if (fullText) {
                        setSearchResults(prev => prev.map(r =>
                            r.id === lit.id ? { ...r, fullText, fullTextSource } : r
                        ));
                    }
                } else if (isCore && lit.fullText) {
                    fullText = lit.fullText;
                    fullTextCount++;
                }

                // ─── 知识提取：全文模式 vs 摘要模式 ────────────────
                try {
                    if (fullText) {
                        // ★ 全文深度提取模式
                        log(`  🔬 全文深度提取中...`);
                        const deepResult = await extractKnowledgeSinkAI(lit, fullText);
                        setSearchResults(prev => prev.map(r =>
                            r.id === lit.id ? {
                                ...r,
                                performance: deepResult.performance || r.performance,
                                synthesisSteps: deepResult.synthesisSteps || r.synthesisSteps,
                                extractedTables: deepResult.extractedTables || r.extractedTables,
                                knowledgeSinked: true
                            } : r
                        ));
                    } else {
                        // 摘要模式（原有逻辑）
                        const enriched = await enrichLiteratureFromSearch(lit);
                        setSearchResults(prev => prev.map(r =>
                            r.id === lit.id ? { ...r, ...enriched, abstract: enriched.abstract || r.abstract } : r
                        ));
                    }
                } catch (enrichErr) {
                    console.warn(`[ReviewWorkshop] 文献充实失败: ${lit.id}`, enrichErr);
                }
            }

            if (abortRef.current) return;

            // ─── 四元组知识图谱提取 ─────────────────────────────
            log('📊 开始提取结构化知识四元组...');
            updateStage('knowledge_extraction', { progress: 80, message: '提取知识四元组...' });

            const allQuadruples: KnowledgeQuadruple[] = [];
            const enrichedLit = coreLit.map(orig => orig);

            for (let i = 0; i < enrichedLit.length; i++) {
                if (abortRef.current) break;
                try {
                    const quads = await extractQuadruplesFromLiterature(enrichedLit[i]);
                    allQuadruples.push(...quads);
                    log(`  四元组 (${i + 1}/${enrichedLit.length}): ${enrichedLit[i].title.substring(0, 25)}... → ${quads.length} 条`);
                } catch (qErr) {
                    console.warn(`[KnowledgeGraph] 四元组提取失败: ${enrichedLit[i].id}`, qErr);
                }
            }

            // 汇聚到 session
            const knowledgeGraph: ReviewKnowledgeGraph = {
                quadruples: allQuadruples,
                lastUpdated: new Date().toISOString(),
                totalSources: enrichedLit.length
            };
            setSession(prev => ({ ...prev, knowledgeGraph }));

            updateStage('knowledge_extraction', {
                status: 'done', progress: 100,
                completedAt: new Date().toISOString(),
                message: `已充实 ${coreLit.length} 篇 (全文 ${fullTextCount}) · 提取 ${allQuadruples.length} 条四元组`
            });
            log(`知识沉降完成: ${coreLit.length} 篇文献 (全文深度提取 ${fullTextCount} 篇), ${allQuadruples.length} 条四元组`);
            onStageComplete?.('knowledge_extraction', 5);
        } catch (err: any) {
            updateStage('knowledge_extraction', { status: 'error', error: err.message });
            log(`知识沉降失败: ${err.message}`);
        } finally {
            setIsRunning(false);
        }
    }, [session.screenedLiterature, searchResults, updateStage, log, onStageComplete]);


    // ═══════════════════════════════════════════════════════════════
    // 阶段 5: 大纲生成
    // ═══════════════════════════════════════════════════════════════

    const runOutlineGeneration = useCallback(async () => {
        setIsRunning(true);
        setSession(prev => ({ ...prev, currentStage: 'outline_generation' }));
        updateStage('outline_generation', { status: 'running', progress: 0, startedAt: new Date().toISOString() });
        log('AI 正在生成综述大纲...');

        try {
            const outline = await generateReviewOutline(
                session.config,
                session.subQuestions,
                session.screenedLiterature,
                searchResults
            );

            if (abortRef.current) return;

            setSession(prev => ({ ...prev, outline, currentStage: 'outline_generation' }));

            // ★ 桥接：将大纲同步到 paperSections
            const outlineToSections = (nodes: ReviewOutlineNode[]): PaperSection[] => {
                const sections: PaperSection[] = [];
                const flatten = (ns: ReviewOutlineNode[]) => {
                    for (const n of ns) {
                        sections.push({ id: n.id, title: n.title, content: '' });
                        if (n.children?.length) flatten(n.children);
                    }
                };
                flatten(nodes);
                return sections;
            };
            bridge?.onOutlineGenerated?.(outlineToSections(outline));

            updateStage('outline_generation', {
                status: 'done', progress: 100,
                completedAt: new Date().toISOString(),
                message: `生成 ${outline.length} 个主章节`
            });
            log(`大纲生成完成: ${outline.length} 个主章节`);
            onStageComplete?.('outline_generation', 6);
        } catch (err: any) {
            updateStage('outline_generation', { status: 'error', error: err.message });
            log(`大纲生成失败: ${err.message}`);
        } finally {
            setIsRunning(false);
        }
    }, [session.config, session.subQuestions, session.screenedLiterature, searchResults, updateStage, log, onStageComplete]);


    // ═══════════════════════════════════════════════════════════════
    // 阶段 6: 逐节内容生成
    // ═══════════════════════════════════════════════════════════════

    const flattenOutline = (nodes: ReviewOutlineNode[]): ReviewOutlineNode[] => {
        const flat: ReviewOutlineNode[] = [];
        for (const node of nodes) {
            flat.push(node);
            if (node.children?.length) flat.push(...flattenOutline(node.children));
        }
        return flat;
    };

    const runSectionGeneration = useCallback(async () => {
        setIsRunning(true);
        setSession(prev => ({ ...prev, currentStage: 'section_generation' }));
        updateStage('section_generation', { status: 'running', progress: 0, startedAt: new Date().toISOString() });

        const sections = flattenOutline(session.outline);
        let previousSummary = '';
        const generatedSections: Record<string, string> = {};

        try {
            for (let i = 0; i < sections.length; i++) {
                if (abortRef.current) break;

                const section = sections[i];
                const progress = Math.round(((i + 1) / sections.length) * 100);
                log(`生成章节 (${i + 1}/${sections.length}): ${section.title}`);
                updateStage('section_generation', { progress, message: `撰写: ${section.title}` });

                // 构建该章节的关联知识
                const relatedLits = section.literatureIds
                    .map(id => searchResults.find(r => r.id === id))
                    .filter(Boolean) as Literature[];

                const knowledge = relatedLits.map(lit => {
                    const perf = (lit as any).performance;
                    const perfStr = Array.isArray(perf) && perf.length > 0
                        ? `\n  性能: ${perf.map((p: any) => `${p.label}: ${p.value}`).join(', ')}`
                        : '';
                    return `- [${lit.id}] ${lit.title} (${lit.authors?.[0] || ''}, ${lit.year})\n  摘要: ${(lit.abstract || '').substring(0, 300)}${perfStr}`;
                }).join('\n\n');

                // ★ RAG 集成：检索本地知识库增强上下文
                let ragContext = '';
                try {
                    const ragChunks = await queryRagContext(`${section.title} ${section.description}`, 4);
                    if (ragChunks.length > 0) {
                        ragContext = '\n\n【本地知识库（实验数据/笔记）】:\n' + ragChunks.join('\n\n');
                        log(`  ↳ RAG 检索到 ${ragChunks.length} 条本地知识`);
                    }
                } catch (ragErr) {
                    console.warn('[ReviewWorkshop] RAG 检索失败，跳过', ragErr);
                }

                const enrichedKnowledge = knowledge + ragContext;

                try {
                    // ★ 流式生成：实时更新 UI
                    const content = await generateReviewSectionStream(
                        session.config,
                        section,
                        enrichedKnowledge,
                        previousSummary,
                        searchResults,
                        (streamText) => {
                            // 每个 chunk 实时更新 session
                            setSession(prev => ({
                                ...prev,
                                outline: prev.outline.map(function updateNode(n: ReviewOutlineNode): ReviewOutlineNode {
                                    if (n.id === section.id) return { ...n, status: 'writing' as any, content: streamText };
                                    if (n.children?.length) return { ...n, children: n.children.map(updateNode) };
                                    return n;
                                }),
                                generatedSections: { ...prev.generatedSections, [section.id]: streamText }
                            }));
                        }
                    );

                    generatedSections[section.id] = content;

                    // ★ 桥接：实时更新章节内容到编辑器
                    bridge?.onSectionContentUpdate?.(section.id, section.title, content);

                    // 标记完成
                    setSession(prev => ({
                        ...prev,
                        outline: prev.outline.map(function updateNode(n: ReviewOutlineNode): ReviewOutlineNode {
                            if (n.id === section.id) return { ...n, status: 'done', content };
                            if (n.children?.length) return { ...n, children: n.children.map(updateNode) };
                            return n;
                        }),
                        generatedSections: { ...prev.generatedSections, [section.id]: content }
                    }));

                    // 积累前文概要（取最后 500 字作为参考）
                    previousSummary += `\n\n### ${section.title}\n${content.substring(0, 500)}`;
                    if (previousSummary.length > 3000) {
                        previousSummary = previousSummary.substring(previousSummary.length - 3000);
                    }
                } catch (sectionErr: any) {
                    console.warn(`[ReviewWorkshop] 章节生成失败: ${section.title}`, sectionErr);
                    // 标记失败但继续
                    setSession(prev => ({
                        ...prev,
                        outline: prev.outline.map(function updateNode(n: ReviewOutlineNode): ReviewOutlineNode {
                            if (n.id === section.id) return { ...n, status: 'error' };
                            if (n.children?.length) return { ...n, children: n.children.map(updateNode) };
                            return n;
                        })
                    }));
                }
            }

            if (abortRef.current) return;

            updateStage('section_generation', {
                status: 'done', progress: 100,
                completedAt: new Date().toISOString(),
                message: `已生成 ${Object.keys(generatedSections).length}/${sections.length} 个章节`
            });
            log(`逐节生成完成: ${Object.keys(generatedSections).length} 个章节`);
            onStageComplete?.('section_generation', 7);
        } catch (err: any) {
            updateStage('section_generation', { status: 'error', error: err.message });
            log(`逐节生成失败: ${err.message}`);
        } finally {
            setIsRunning(false);
        }
    }, [session.outline, session.config, searchResults, updateStage, log, onStageComplete]);


    // ═══════════════════════════════════════════════════════════════
    // 阶段 7: 图表生成（跳过，后续可扩展）
    // ═══════════════════════════════════════════════════════════════

    const runFigureGeneration = useCallback(async () => {
        // 收集有 suggestedFigure 的大纲节点
        const allNodes = flattenOutline(session.outline);
        const figurableNodes = allNodes.filter(n => n.suggestedFigure);

        if (figurableNodes.length === 0) {
            updateStage('figure_generation', { status: 'skipped', progress: 100, message: '大纲中无图表建议，已跳过' });
            log('图表生成阶段已跳过（无图表建议）');
            return;
        }

        setIsRunning(true);
        setSession(prev => ({ ...prev, currentStage: 'figure_generation' }));
        updateStage('figure_generation', { status: 'running', progress: 0, startedAt: new Date().toISOString() });
        log(`开始生成 ${figurableNodes.length} 张图表...`);

        const figures: Record<string, ReviewGeneratedFigure> = {};

        try {
            for (let i = 0; i < figurableNodes.length; i++) {
                if (abortRef.current) break;

                const node = figurableNodes[i];
                const fig = node.suggestedFigure!;
                const progress = Math.round(((i + 1) / figurableNodes.length) * 100);
                log(`生成图表 (${i + 1}/${figurableNodes.length}): ${fig.type} — ${node.title}`);
                updateStage('figure_generation', { progress, message: `${fig.type}: ${node.title}` });

                // 收集关联文献
                const relatedLits = node.literatureIds
                    .map(id => searchResults.find(r => r.id === id))
                    .filter(Boolean) as Literature[];

                try {
                    if (fig.type === 'comparison_table') {
                        const tableData = await generateComparisonTableData(
                            relatedLits, session.config.topic, session.config.language
                        );
                        figures[node.id] = {
                            figureType: 'comparison_table',
                            sectionId: node.id,
                            sectionTitle: node.title,
                            description: fig.description,
                            headers: tableData.headers,
                            rows: tableData.rows
                        };
                    } else if (fig.type === 'trend_chart') {
                        const trendData = await generateTrendAnalysis(
                            relatedLits, session.config.topic, session.config.language
                        );
                        figures[node.id] = {
                            figureType: 'trend_chart',
                            sectionId: node.id,
                            sectionTitle: node.title,
                            description: fig.description,
                            yearDistribution: trendData.yearDistribution,
                            topJournals: trendData.topJournals,
                            summary: trendData.summary
                        };
                    } else if (fig.type === 'sankey') {
                        // ★ 集成：调用科研绘图中心的桑基图 AI 引擎
                        const prompt = `${session.config.topic} — ${node.title}: ${fig.description}`;
                        const result = await generateSankeyDataAI(prompt, session.config.language, 'moderate');
                        if (result && result.nodes.length > 0 && result.links.length > 0) {
                            const sankeyData: SankeyData = {
                                title: result.title || `${node.title} — 桑基图`,
                                nodeWidth: 16,
                                nodePadding: 12,
                                alignment: 'justify',
                                curveType: 'bezier',
                                showValues: true,
                                valueUnit: '',
                                colorPalette: [...DEFAULT_SANKEY_PALETTE],
                                theme: 'default',
                                backgroundColor: '#ffffff',
                                labelStyle: { fontSize: 12, fontFamily: 'Inter, sans-serif', fontWeight: '500', color: '#1e293b' },
                                nodes: result.nodes as SankeyNode[],
                                links: result.links.map((l: any, idx: number) => ({
                                    id: l.id || `link_${idx}`,
                                    source: l.source,
                                    target: l.target,
                                    value: l.value,
                                    label: l.label,
                                })) as SankeyLink[],
                            };
                            const figure: ReviewGeneratedFigure = {
                                figureType: 'sankey_chart',
                                sectionId: node.id,
                                sectionTitle: node.title,
                                description: fig.description,
                                sankeyData
                            };
                            figures[node.id] = figure;
                            bridge?.onFigureGenerated?.(figure);
                        }
                    } else if (fig.type === 'mechanism_diagram') {
                        // ★ 集成：调用科研绘图中心的结构设计器 AI 引擎
                        const prompt = `${session.config.topic} — ${node.title}: ${fig.description}`;
                        const structuralData = await generateStructuralDiagram(prompt, 'custom', session.config.language);
                        if (structuralData && structuralData.groups?.length > 0) {
                            const figure: ReviewGeneratedFigure = {
                                figureType: 'structural_diagram',
                                sectionId: node.id,
                                sectionTitle: node.title,
                                description: fig.description,
                                structuralData
                            };
                            figures[node.id] = figure;
                            bridge?.onFigureGenerated?.(figure);
                        }
                    } else if (fig.type === 'timeline') {
                        // ★ 集成：调用科研绘图中心的时间线 AI 引擎
                        const prompt = `${session.config.topic} — ${node.title}: ${fig.description}`;
                        const timelineResult = await generateTimelineDataAI(prompt, session.config.language);
                        if (timelineResult && timelineResult.events?.length > 0) {
                            const timelineData = {
                                ...timelineResult,
                                pathType: 'straight' as const,
                                theme: 'default' as const,
                                axisWidth: 4,
                                arrowWidth: 4,
                                glowIntensity: 5,
                                axisColor: '#6366f1',
                                gradientPreset: 'rainbow' as const,
                                arrowStyle: 'classic' as const,
                                showArrow: true,
                                isHollow: true,
                                distributionMode: 'proportional' as const
                            };
                            const figure: ReviewGeneratedFigure = {
                                figureType: 'timeline_chart',
                                sectionId: node.id,
                                sectionTitle: node.title,
                                description: fig.description,
                                timelineData
                            };
                            figures[node.id] = figure;
                            bridge?.onFigureGenerated?.(figure);
                        }
                    } else if (fig.type === 'summary_infographic') {
                        // ★ 集成：调用科研绘图中心的综述建模引擎（圆环信息图）
                        const prompt = `${session.config.topic} — ${node.title}: ${fig.description}`;
                        const infographicResult = await generateSummaryInfographic(prompt, session.config.language);
                        if (infographicResult && infographicResult.layers?.length > 0) {
                            const figure: ReviewGeneratedFigure = {
                                figureType: 'summary_infographic',
                                sectionId: node.id,
                                sectionTitle: node.title,
                                description: fig.description,
                                infographicData: infographicResult
                            };
                            figures[node.id] = figure;
                            bridge?.onFigureGenerated?.(figure);
                        }
                    } else {
                        // distribution 等其他类型 → 保留文字描述 fallback
                        const markdown = await generateFigureDescription(
                            session.config.topic,
                            node.title,
                            fig.type,
                            fig.description,
                            relatedLits,
                            session.config.language
                        );
                        figures[node.id] = {
                            figureType: 'description',
                            sectionId: node.id,
                            sectionTitle: node.title,
                            description: fig.description,
                            suggestedType: fig.type,
                            markdownContent: markdown
                        };
                    }
                } catch (figErr: any) {
                    console.warn(`[ReviewWorkshop] 图表生成失败: ${node.title}`, figErr);
                }
            }

            if (abortRef.current) return;

            // ─── 自动文献截图组图 ────────────────────────────
            try {
                // 1. 收集有 PDF 源的 core 文献
                const coreScreened = session.screenedLiterature.filter(s => s.tier === 'core');
                const litInfos: LiteratureInfo[] = coreScreened
                    .map(s => {
                        const lit = searchResults.find(r => r.id === s.literatureId);
                        if (!lit) return null;
                        return {
                            id: lit.id,
                            title: lit.title,
                            localPath: (lit as any).localPath,
                            oaUrl: (lit as any).oaUrl,
                        } as LiteratureInfo;
                    })
                    .filter(Boolean)
                    .filter(info => info!.localPath || info!.oaUrl) as LiteratureInfo[];

                if (litInfos.length > 0 && !abortRef.current) {
                    log(`📷 开始自动文献截图: 扫描 ${litInfos.length} 篇 core 文献 PDF...`);
                    updateStage('figure_generation', { message: `自动文献截图: 扫描 ${litInfos.length} 篇 PDF` });

                    // 2. 批量提取 Figure
                    const allExtracted = await batchExtractFigures(litInfos, (p, msg) => {
                        log(`  📷 ${msg}`);
                    });

                    if (allExtracted.length > 0 && !abortRef.current) {
                        log(`🎯 AI 匹配 ${allExtracted.length} 张 Figure 到章节...`);
                        updateStage('figure_generation', { message: `AI 匹配 ${allExtracted.length} 张 Figure` });

                        // 3. AI 智能匹配 Figure 到章节
                        const matchInput: FigureMatchInput[] = allExtracted.map(f => ({
                            id: f.id,
                            label: f.label,
                            description: f.description,
                            sourceLitId: f.sourceLitId,
                            sourceLitTitle: f.sourceLitTitle,
                        }));
                        const matchResult = await matchFiguresToSections(
                            allNodes, matchInput, session.config.topic, session.config.language
                        );

                        // 4. 对每个有匹配的章节自动组图
                        for (const [sectionId, figureIds] of Object.entries(matchResult)) {
                            if (abortRef.current) break;
                            if (!figureIds || figureIds.length === 0) continue;
                            // 如果该章节已有其他类型生成的图表，跳过
                            if (figures[sectionId]) continue;

                            const matchedFigures = figureIds
                                .map(fid => allExtracted.find(f => f.id === fid))
                                .filter(Boolean) as ExtractedFigure[];

                            if (matchedFigures.length === 0) continue;

                            const sectionNode = allNodes.find(n => n.id === sectionId);
                            const sectionTitle = sectionNode?.title || '';

                            log(`🖼️ 自动组图: ${sectionTitle} ← ${matchedFigures.length} 张 Figure`);
                            updateStage('figure_generation', { message: `自动组图: ${sectionTitle}` });

                            try {
                                const { renderedImage } = await composeAndRender(matchedFigures, sectionTitle);

                                // AI 生成学术图注
                                let caption = '';
                                try {
                                    const panelInfos = matchedFigures.map((f, idx) => ({
                                        label: `(${String.fromCharCode(97 + idx)})`,
                                        sourceTitle: f.sourceLitTitle,
                                        sourcePage: f.pageNum,
                                        sourceType: 'literature' as const,
                                    }));
                                    caption = await generateCompositeFigureCaption(
                                        panelInfos, sectionTitle, session.config.topic,
                                        session.config.language as 'zh' | 'en'
                                    );
                                } catch {
                                    caption = `文献组图: ${matchedFigures.map(f => f.label).join(', ')}`;
                                }

                                figures[sectionId] = {
                                    figureType: 'auto_literature_figure',
                                    sectionId,
                                    sectionTitle,
                                    description: `自动文献截图组图: ${matchedFigures.map(f => f.label).join(', ')}`,
                                    renderedImage,
                                    caption,
                                    sourceFigures: matchedFigures.map(f => ({
                                        litId: f.sourceLitId,
                                        litTitle: f.sourceLitTitle,
                                        figureLabel: f.label,
                                        pageNum: f.pageNum,
                                    })),
                                };

                                bridge?.onFigureGenerated?.(figures[sectionId]);
                            } catch (composeErr) {
                                console.warn(`[ReviewWorkshop] 自动组图失败: ${sectionTitle}`, composeErr);
                            }
                        }

                        log(`✅ 自动文献截图组图完成`);
                    } else {
                        log(`📷 未从 PDF 中提取到 Figure，跳过自动组图`);
                    }
                }
            } catch (autoFigErr) {
                console.warn('[ReviewWorkshop] 自动文献截图组图流程出错:', autoFigErr);
                log(`⚠️ 自动文献截图组图失败，不影响其他图表`);
            }

            if (abortRef.current) return;

            // ─── 处理用户手动挂载的组图 ───
            const attached = session.attachedAssemblies || {};
            const attachedEntries = Object.entries(attached);
            if (attachedEntries.length > 0) {
                log(`处理 ${attachedEntries.length} 个章节的已挂载组图...`);
                try {
                    const savedStr = localStorage.getItem('sciflow_figure_assemblies');
                    const savedAssemblies: SavedFigureAssembly[] = savedStr ? JSON.parse(savedStr) : [];
                    for (const [sectionId, infoList] of attachedEntries) {
                        // 每个章节可能有多个挂载组图，取第一个作为主图
                        for (const info of infoList) {
                            const assembly = savedAssemblies.find(a => a.id === info.assemblyId);
                            if (!assembly) continue;
                            const sectionNode = allNodes.find(n => n.id === sectionId);

                            // ★ AI 生成学术图注（若用户未自定义 caption）
                            let caption = info.caption;
                            if (!caption || caption.startsWith('Figure.')) {
                                try {
                                    const panelInfos = assembly.panels.map(p => ({
                                        label: p.label || '',
                                        sourceTitle: p.sourceRef?.title,
                                        sourcePage: p.sourceRef?.page,
                                        sourceType: p.sourceRef?.type
                                    }));
                                    caption = await generateCompositeFigureCaption(
                                        panelInfos,
                                        sectionNode?.title || '',
                                        session.config.topic,
                                        session.config.language as 'zh' | 'en'
                                    );
                                    log(`AI 已生成学术图注: ${caption.slice(0, 50)}...`);
                                } catch (captionErr) {
                                    caption = generateCompositeCaption(assembly.panels);
                                    console.warn('[ReviewWorkshop] AI 图注生成失败，使用 fallback', captionErr);
                                }
                            }
                            // ★ 离屏合成组图为 base64 图片
                            let renderedImage: string | undefined;
                            try {
                                renderedImage = await renderAssemblyToImage(assembly, 2);
                                log(`已渲染组图「${assembly.title}」为图片`);
                            } catch (renderErr) {
                                console.warn('[ReviewWorkshop] 组图渲染失败', renderErr);
                            }

                            // 用 sectionId + assemblyId 作为 key 避免覆盖
                            const figKey = infoList.length === 1 ? sectionId : `${sectionId}_${info.assemblyId}`;
                            figures[figKey] = {
                                figureType: 'composite_figure',
                                sectionId,
                                sectionTitle: sectionNode?.title || '',
                                description: `组图: ${assembly.title}`,
                                assemblyId: assembly.id,
                                assemblyTitle: assembly.title,
                                renderedImage,
                                caption
                            };
                        }
                    }
                } catch (e) {
                    console.warn('[ReviewWorkshop] 处理挂载组图失败', e);
                }
            }

            setSession(prev => ({ ...prev, generatedFigures: { ...(prev.generatedFigures || {}), ...figures } }));

            // ─── 图文交叉引用注入：将 Figure 引用自然嵌入正文 ───
            const autoLitFigures = Object.entries(figures)
                .filter(([, fig]) => fig.figureType === 'auto_literature_figure');

            if (autoLitFigures.length > 0 && !abortRef.current) {
                log(`📝 开始图文交叉引用注入: ${autoLitFigures.length} 张组图...`);
                updateStage('figure_generation', { progress: 95, message: '注入 Figure 引用到正文...' });

                let figCounter = 1;

                for (const [sectionId, fig] of autoLitFigures) {
                    if (abortRef.current) break;
                    if (fig.figureType !== 'auto_literature_figure') continue;

                    const sectionContent = session.generatedSections[sectionId];
                    if (!sectionContent) continue;

                    const figureNumber = `Figure ${figCounter}`;
                    figCounter++;

                    const figureRef: FigureRefForInjection = {
                        figureNumber,
                        panels: fig.sourceFigures.map((sf, idx) => ({
                            label: `(${String.fromCharCode(97 + idx)})`,
                            figureLabel: sf.figureLabel,
                            description: fig.description,
                            sourceLitTitle: sf.litTitle,
                        })),
                        caption: fig.caption,
                    };

                    try {
                        log(`  📝 注入引用: ${fig.sectionTitle} ← ${figureNumber}`);
                        const updatedContent = await injectFigureReferences(
                            sectionContent,
                            fig.sectionTitle,
                            figureRef,
                            session.config.topic,
                            session.config.language
                        );

                        // 更新 session 中的章节内容
                        setSession(prev => ({
                            ...prev,
                            generatedSections: { ...prev.generatedSections, [sectionId]: updatedContent }
                        }));
                        session.generatedSections[sectionId] = updatedContent;

                        // 桥接：同步更新到编辑器
                        bridge?.onSectionContentUpdate?.(sectionId, fig.sectionTitle, updatedContent);
                    } catch (injectErr) {
                        console.warn(`[ReviewWorkshop] 图引用注入失败: ${fig.sectionTitle}`, injectErr);
                    }
                }
                log(`✅ 图文交叉引用注入完成`);
            }

            updateStage('figure_generation', {
                status: 'done', progress: 100,
                completedAt: new Date().toISOString(),
                message: `已生成 ${Object.keys(figures).length}/${figurableNodes.length} 张图表`
            });
            log(`图表生成完成: ${Object.keys(figures).length} 张`);
            onStageComplete?.('figure_generation', 8);
        } catch (err: any) {
            updateStage('figure_generation', { status: 'error', error: err.message });
            log(`图表生成失败: ${err.message}`);
        } finally {
            setIsRunning(false);
        }
    }, [session.outline, session.config, searchResults, updateStage, log, onStageComplete]);


    // ═══════════════════════════════════════════════════════════════
    // 阶段 8: 全文交叉审计
    // ═══════════════════════════════════════════════════════════════

    const runCrossAudit = useCallback(async () => {
        setIsRunning(true);
        setSession(prev => ({ ...prev, currentStage: 'cross_audit' }));
        updateStage('cross_audit', { status: 'running', progress: 0, startedAt: new Date().toISOString() });
        log('AI 正在执行全文交叉审计...');

        try {
            const fullContent = flattenOutline(session.outline)
                .map(n => `## ${n.title}\n\n${session.generatedSections[n.id] || ''}`)
                .join('\n\n');

            const auditReport = await auditReviewCrossRef(fullContent, searchResults, session.config.language);

            if (abortRef.current) return;

            setSession(prev => ({ ...prev, auditReport }));

            // ★ 桥接：推送审计报告到审阅面板
            bridge?.onAuditComplete?.(auditReport);

            updateStage('cross_audit', {
                status: 'done', progress: 100,
                completedAt: new Date().toISOString(),
                message: '审计报告已生成'
            });
            log('交叉审计完成');
            onStageComplete?.('cross_audit', 9);
        } catch (err: any) {
            updateStage('cross_audit', { status: 'error', error: err.message });
            log(`交叉审计失败: ${err.message}`);
        } finally {
            setIsRunning(false);
        }
    }, [session.outline, session.generatedSections, session.config.language, searchResults, updateStage, log, onStageComplete]);


    // ═════════════════════════════════════════════════════════════════
    // 阶段 8+: 审计驱动自动修订（Agent Loop）
    // ═════════════════════════════════════════════════════════════════

    const MAX_REVISION_ROUNDS = 3;
    const PASS_SCORE = 80;

    const runAutoRevision = useCallback(async () => {
        setIsRunning(true);
        // ★ 快照: 修订前保存
        saveSnapshot('修订循环前', 'auto_revision');
        // 复用 cross_audit 阶段状态来显示修订进度
        updateStage('cross_audit', { status: 'running', progress: 0, message: '开始自动修订循环...' });
        log('🔄 启动审计驱动自动修订 (Agent Loop)...');

        const sections = flattenOutline(session.outline);
        const history: RevisionRound[] = [...(session.revisionHistory || [])];

        try {
            for (let round = 1; round <= MAX_REVISION_ROUNDS; round++) {
                if (abortRef.current) break;

                // ─── Step 1: 结构化审计 ───
                log(`🔎 第 ${round} 轮审计中...`);
                updateStage('cross_audit', {
                    progress: Math.round(((round - 1) / MAX_REVISION_ROUNDS) * 100),
                    message: `第 ${round}/${MAX_REVISION_ROUNDS} 轮: 结构化审计`
                });

                const fullContent = sections
                    .map(n => `## ${n.title}\n\n${session.generatedSections[n.id] || ''}`)
                    .join('\n\n');

                const auditResult = await auditReviewStructured(
                    fullContent, searchResults, session.config.language
                );

                if (abortRef.current) break;

                const criticalIssues = auditResult.issues.filter(i => i.severity === 'critical');
                const moderateIssues = auditResult.issues.filter(i => i.severity === 'moderate');

                log(`  审计评分: ${auditResult.score} | 🔴 ${criticalIssues.length} 严重 | 🟡 ${moderateIssues.length} 中等`);

                // ─── Step 2: 判断是否终止 ───
                if (auditResult.score >= PASS_SCORE && criticalIssues.length === 0) {
                    history.push({
                        round,
                        score: auditResult.score,
                        criticalCount: 0,
                        moderateCount: moderateIssues.length,
                        revisedSections: [],
                        summary: `✅ 评分 ${auditResult.score} ≥ ${PASS_SCORE}，无严重问题，修订循环终止`,
                        timestamp: new Date().toISOString()
                    });
                    setSession(prev => ({ ...prev, revisionHistory: history }));
                    log(`✅ 评分 ${auditResult.score} 达标，修订循环终止！`);
                    break;
                }

                // ─── Step 3: 按章节分组问题并定向修订 ───
                // 只修订有 critical 或 moderate 问题的章节
                const issuesBySectionTitle = new Map<string, AuditIssue[]>();
                for (const issue of [...criticalIssues, ...moderateIssues]) {
                    const existing = issuesBySectionTitle.get(issue.sectionTitle) || [];
                    existing.push(issue);
                    issuesBySectionTitle.set(issue.sectionTitle, existing);
                }

                const revisedSectionTitles: string[] = [];
                let reviseIdx = 0;
                const totalToRevise = issuesBySectionTitle.size;

                for (const [sectionTitle, sectionIssues] of issuesBySectionTitle) {
                    if (abortRef.current) break;

                    // 匹配大纲节点
                    const node = sections.find(n => n.title === sectionTitle);
                    if (!node) {
                        console.warn(`[AgentLoop] 无法匹配章节: "${sectionTitle}"`);
                        continue;
                    }

                    const originalContent = session.generatedSections[node.id];
                    if (!originalContent) continue;

                    reviseIdx++;
                    log(`  ✏️ 修订 (${reviseIdx}/${totalToRevise}): ${sectionTitle} [🔴${sectionIssues.filter(i => i.severity === 'critical').length} 🟡${sectionIssues.filter(i => i.severity === 'moderate').length}]`);
                    updateStage('cross_audit', {
                        message: `第 ${round} 轮修订: ${sectionTitle}`
                    });

                    try {
                        const revisedContent = await reviseReviewSection(
                            session.config,
                            sectionTitle,
                            originalContent,
                            sectionIssues,
                            searchResults
                        );

                        // 更新 session 中的章节内容
                        setSession(prev => ({
                            ...prev,
                            generatedSections: { ...prev.generatedSections, [node.id]: revisedContent }
                        }));
                        // 同步到局部变量以便下一轮审计能看到最新内容
                        session.generatedSections[node.id] = revisedContent;
                        revisedSectionTitles.push(sectionTitle);
                    } catch (reviseErr: any) {
                        console.warn(`[AgentLoop] 修订失败: ${sectionTitle}`, reviseErr);
                    }
                }

                history.push({
                    round,
                    score: auditResult.score,
                    criticalCount: criticalIssues.length,
                    moderateCount: moderateIssues.length,
                    revisedSections: revisedSectionTitles,
                    summary: auditResult.summary,
                    timestamp: new Date().toISOString()
                });
                setSession(prev => ({ ...prev, revisionHistory: history }));
            }

            if (abortRef.current) return;

            // ─── 最终: 生成可读的审计报告 ───
            log('📝 生成最终审计报告...');
            updateStage('cross_audit', { message: '生成最终审计报告' });

            const finalContent = sections
                .map(n => `## ${n.title}\n\n${session.generatedSections[n.id] || ''}`)
                .join('\n\n');
            const auditReport = await auditReviewCrossRef(finalContent, searchResults, session.config.language);

            setSession(prev => ({ ...prev, auditReport }));
            updateStage('cross_audit', {
                status: 'done', progress: 100,
                completedAt: new Date().toISOString(),
                message: `审计完成 | ${history.length} 轮修订 | 最终评分: ${history[history.length - 1]?.score ?? '-'}`
            });
            log(`🎉 自动修订完成: ${history.length} 轮迭代`);
            onStageComplete?.('cross_audit', 9); // Now cross_audit is stage 9
        } catch (err: any) {
            updateStage('cross_audit', { status: 'error', error: err.message });
            log(`自动修订失败: ${err.message}`);
        } finally {
            setIsRunning(false);
        }
    }, [session.outline, session.generatedSections, session.config, session.revisionHistory, searchResults, updateStage, log, onStageComplete]);


    // ═════════════════════════════════════════════════════════════════
    // 阶段 8++: 多 Agent 协作修订（Editor + Critic + Fact-Checker）
    // ═════════════════════════════════════════════════════════════════

    const runMultiAgentRevision = useCallback(async () => {
        setIsRunning(true);
        // ★ 快照: 多Agent修订前保存
        saveSnapshot('多Agent修订前', 'multi_agent');
        setSession(prev => ({ ...prev, currentStage: 'cross_audit' }));
        updateStage('cross_audit', { status: 'running', progress: 0, startedAt: new Date().toISOString(), message: '启动多 Agent 协作评审...' });
        log('🤖 启动多 Agent 协作修订 (Editor + Critic + Fact-Checker)...');

        try {
            const result = await orchestrateMultiAgentRevision(
                session.config,
                session.outline,
                session.generatedSections,
                searchResults,
                3,   // maxRounds
                80,  // passThreshold
                (msg, phase, round, agentRole) => {
                    log(msg);
                    const progressBase = Math.round(((round - 1) / 3) * 100);
                    const phaseOffset = phase === 'audit' ? 10 : 50;
                    updateStage('cross_audit', {
                        progress: Math.min(progressBase + phaseOffset, 95),
                        message: agentRole
                            ? `[${agentRole.toUpperCase()}] ${msg}`
                            : msg
                    });
                },
                abortRef
            );

            if (abortRef.current) return;

            // 更新 session：同步修订后的章节内容 + Agent 报告
            setSession(prev => ({
                ...prev,
                generatedSections: { ...prev.generatedSections, ...result.updatedSections },
                multiAgentHistory: result.history,
                agentReports: result.finalReports as Record<ReviewAgentRole, AgentReport>,
            }));

            // 生成最终的可读审计报告（合并三个 Agent 的摘要）
            const reportParts: string[] = [
                `# 多 Agent 协作审计报告\n`,
                `**最终共识评分: ${result.finalScore}/100** | 共 ${result.history.length} 轮迭代 | 共修订 ${result.totalRevisedSections.length} 个章节\n`,
            ];

            if (result.finalReports.editor) {
                reportParts.push(`## 📝 Editor Agent (全局叙事) — ${result.finalReports.editor.score}分`);
                reportParts.push(result.finalReports.editor.summary);
                const editorIssues = result.finalReports.editor.issues;
                if (editorIssues.length > 0) {
                    reportParts.push(`\n### 遗留问题 (${editorIssues.length})`);
                    editorIssues.forEach((iss, i) => {
                        const icon = iss.severity === 'critical' ? '🔴' : iss.severity === 'moderate' ? '🟡' : '🟢';
                        reportParts.push(`${i + 1}. ${icon} **[${iss.category}]** ${iss.sectionTitle}: ${iss.description}`);
                    });
                }
            }

            if (result.finalReports.critic) {
                reportParts.push(`\n## 🔍 Critic Agent (审稿人) — ${result.finalReports.critic.score}分`);
                reportParts.push(result.finalReports.critic.summary);
                const criticIssues = result.finalReports.critic.issues;
                if (criticIssues.length > 0) {
                    reportParts.push(`\n### 遗留问题 (${criticIssues.length})`);
                    criticIssues.forEach((iss, i) => {
                        const icon = iss.severity === 'critical' ? '🔴' : iss.severity === 'moderate' ? '🟡' : '🟢';
                        reportParts.push(`${i + 1}. ${icon} **[${iss.category}]** ${iss.sectionTitle}: ${iss.description}`);
                    });
                }
            }

            if (result.finalReports.fact_checker) {
                reportParts.push(`\n## ✅ Fact-Checker Agent (引文验核) — ${result.finalReports.fact_checker.score}分`);
                reportParts.push(result.finalReports.fact_checker.summary);
                const fcIssues = result.finalReports.fact_checker.issues;
                if (fcIssues.length > 0) {
                    reportParts.push(`\n### 遗留问题 (${fcIssues.length})`);
                    fcIssues.forEach((iss, i) => {
                        const icon = iss.severity === 'critical' ? '🔴' : iss.severity === 'moderate' ? '🟡' : '🟢';
                        reportParts.push(`${i + 1}. ${icon} **[${iss.category}]** ${iss.sectionTitle}: ${iss.description}`);
                        if (iss.evidence) reportParts.push(`   证据: ${iss.evidence}`);
                    });
                }
            }

            const auditReport = reportParts.join('\n');
            setSession(prev => ({ ...prev, auditReport }));
            bridge?.onAuditComplete?.(auditReport);

            updateStage('cross_audit', {
                status: 'done', progress: 100,
                completedAt: new Date().toISOString(),
                message: `多 Agent 审计完成 | ${result.history.length} 轮 | 共识分: ${result.finalScore}`
            });
            log(`🎉 多 Agent 协作修订完成: ${result.history.length} 轮迭代, 最终共识分 ${result.finalScore}`);
            onStageComplete?.('cross_audit', 9);
        } catch (err: any) {
            updateStage('cross_audit', { status: 'error', error: err.message });
            log(`多 Agent 修订失败: ${err.message}`);
        } finally {
            setIsRunning(false);
        }
    }, [session.outline, session.generatedSections, session.config, searchResults, updateStage, log, onStageComplete]);


    // ═════════════════════════════════════════════════════════════════
    // 阶段 8.5: 全局一致性引擎
    // ═══════════════════════════════════════════════════════════════

    const runConsistencyEngine = useCallback(async () => {
        setIsRunning(true);
        updateStage('polishing', { status: 'running', progress: 0, startedAt: new Date().toISOString(), message: '全局一致性扫描...' });

        try {
            const sections = flattenOutline(session.outline);
            const fullContent = sections
                .map(n => `## ${n.title}\n\n${session.generatedSections[n.id] || ''}`)
                .join('\n\n');

            const coreLit = session.screenedLiterature
                .filter(s => s.tier === 'core' || s.tier === 'supporting')
                .map(s => searchResults.find(r => r.id === s.literatureId))
                .filter(Boolean) as Literature[];

            log('🔍 启动全局一致性引擎...');

            const { report, fixes } = await runFullConsistencyScan(
                fullContent,
                session.config,
                coreLit,
                (msg, progress) => {
                    log(`  一致性: ${msg}`);
                    updateStage('polishing', { progress: Math.round(progress * 0.3), message: msg });
                }
            );

            // 自动应用术语修复
            if (fixes.length > 0) {
                log(`✅ 自动修复 ${fixes.length} 处术语不一致`);
                // ★ 快照: 一致性修复前保存
                saveSnapshot('一致性修复前', 'consistency');
                const fixedSections = applyConsistencyFixes(session.generatedSections, fixes);
                setSession(prev => ({
                    ...prev,
                    generatedSections: fixedSections,
                    consistencyReport: report
                }));
            } else {
                setSession(prev => ({ ...prev, consistencyReport: report }));
            }

            log(`📊 一致性扫描完成: 术语 ${report.terminologyFixes} | 引用 ${report.citationFixes} | 冗余 ${report.redundancyFlags}`);
        } catch (err: any) {
            log(`一致性扫描失败: ${err.message}`);
            console.warn('[ConsistencyEngine]', err);
        } finally {
            setIsRunning(false);
        }
    }, [session.outline, session.generatedSections, session.config, session.screenedLiterature, searchResults, updateStage, log]);


    // ═════════════════════════════════════════════════════════════════
    // 阶段 9: 学术润色 + 摘要/关键词
    // ═══════════════════════════════════════════════════════════════

    const runPolishing = useCallback(async () => {
        setIsRunning(true);
        // ★ 快照: 润色前保存
        saveSnapshot('润色前', 'polishing');
        setSession(prev => ({ ...prev, currentStage: 'polishing' }));
        updateStage('polishing', { status: 'running', progress: 0, startedAt: new Date().toISOString() });

        const sections = flattenOutline(session.outline);
        const lang = session.config.language;

        try {
            // 逐节润色
            for (let i = 0; i < sections.length; i++) {
                if (abortRef.current) break;

                const section = sections[i];
                const content = session.generatedSections[section.id];
                if (!content) continue;

                const progress = Math.round(((i + 1) / sections.length) * 90);
                log(`润色中 (${i + 1}/${sections.length}): ${section.title}`);
                updateStage('polishing', { progress, message: `润色: ${section.title}` });

                try {
                    const result = await polishTextEnhanced(content, 'academic', lang);
                    setSession(prev => ({
                        ...prev,
                        generatedSections: { ...prev.generatedSections, [section.id]: result.polishedText }
                    }));
                } catch (polishErr) {
                    console.warn(`[ReviewWorkshop] 润色失败: ${section.title}`, polishErr);
                }
            }

            // 生成摘要和关键词
            if (!abortRef.current) {
                log('生成摘要、关键词和亮点...');
                updateStage('polishing', { progress: 95, message: '生成摘要与关键词' });

                const fullContent = flattenOutline(session.outline)
                    .map(n => session.generatedSections[n.id] || '')
                    .join('\n\n');

                const { abstract, keywords, highlights } = await generateReviewAbstract(fullContent, session.config);

                setSession(prev => ({ ...prev, abstract, keywords, highlights }));
            }

            if (abortRef.current) return;

            updateStage('polishing', {
                status: 'done', progress: 100,
                completedAt: new Date().toISOString(),
                message: '润色完成，摘要已生成'
            });
            log('学术润色完成');
            onStageComplete?.('polishing', 10);
        } catch (err: any) {
            updateStage('polishing', { status: 'error', error: err.message });
            log(`润色失败: ${err.message}`);
        } finally {
            setIsRunning(false);
        }
    }, [session.outline, session.generatedSections, session.config, updateStage, log, onStageComplete]);


    // ═══════════════════════════════════════════════════════════════
    // 阶段 10: 写入编辑器
    // ═══════════════════════════════════════════════════════════════

    const runWriteToEditor = useCallback(async () => {
        if (!onInsertText) return;

        setSession(prev => ({ ...prev, currentStage: 'writing_to_editor' }));
        updateStage('writing_to_editor', { status: 'running', progress: 0, startedAt: new Date().toISOString() });
        log('正在写入编辑器...');

        try {
            const sections = flattenOutline(session.outline);
            const parts: string[] = [];

            // 构建完整文本
            if (session.abstract) {
                parts.push(`## 摘要\n\n${session.abstract}`);
            }
            if (session.keywords?.length) {
                parts.push(`**关键词**: ${session.keywords.join('; ')}`);
            }

            for (const section of sections) {
                const content = session.generatedSections[section.id];
                if (content) {
                    const prefix = section.level === 1 ? '## ' : '### ';
                    let sectionText = `${prefix}${section.title}\n\n${content}`;

                    // ─── 嵌入该章节的已生成图表 ───
                    const figure = session.generatedFigures?.[section.id];
                    if (figure) {
                        if (figure.figureType === 'comparison_table' && figure.headers.length > 0) {
                            const headerRow = `| ${figure.headers.join(' | ')} |`;
                            const divider = `| ${figure.headers.map(() => '---').join(' | ')} |`;
                            const dataRows = figure.rows.map(row => `| ${row.join(' | ')} |`).join('\n');
                            sectionText += `\n\n**${figure.description || '性能对比表'}**\n\n${headerRow}\n${divider}\n${dataRows}`;
                        } else if (figure.figureType === 'trend_chart') {
                            const yearEntries = Object.entries(figure.yearDistribution)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([year, count]) => `${year}: ${count} 篇`).join(', ');
                            const topJ = figure.topJournals.slice(0, 5)
                                .map(j => `${j.name} (${j.count})`).join(', ');
                            sectionText += `\n\n**研究趋势分析**\n\n年份分布: ${yearEntries}\n\n高频期刊: ${topJ}\n\n${figure.summary}`;
                        } else if (figure.figureType === 'description') {
                            sectionText += `\n\n${figure.markdownContent}`;
                        } else if (figure.figureType === 'composite_figure') {
                            if (figure.renderedImage) {
                                sectionText += `\n\n![${figure.caption}](${figure.renderedImage})`;
                            } else {
                                sectionText += `\n\n**${figure.caption}**\n\n*[组图: ${figure.assemblyTitle} — 请在科研绘图中心的组图画布中导出后手动插入]*`;
                            }
                        }
                    }

                    // ─── 嵌入已挂载的表格（多个） ───
                    const attachedTableList = session.attachedTables?.[section.id] || [];
                    for (const attachedTable of attachedTableList) {
                        const t = attachedTable.table;
                        const headerRow = `| ${t.headers.join(' | ')} |`;
                        const divider = `| ${t.headers.map(() => '---').join(' | ')} |`;
                        const dataRows = t.rows.map((row: string[]) => `| ${row.join(' | ')} |`).join('\n');
                        sectionText += `\n\n**${t.title || 'Table'}**\n\n${headerRow}\n${divider}\n${dataRows}`;
                        if (t.note) sectionText += `\n\n*${t.note}*`;
                    }

                    // ─── 嵌入已挂载的公式（多个） ───
                    const attachedFormulaList = session.attachedFormulas?.[section.id] || [];
                    for (const attachedFormula of attachedFormulaList) {
                        const f = attachedFormula.formula;
                        if (f.isBlock) {
                            sectionText += `\n\n$$\n${f.content}\n$$`;
                        } else {
                            sectionText += `\n\n$${f.content}$`;
                        }
                        if (f.title) sectionText += `\n\n*${f.title}*`;
                    }

                    parts.push(sectionText);
                }
            }

            // ─── 自动生成参考文献列表 ───
            const citedIds = new Set<string>();
            for (const section of sections) {
                section.literatureIds.forEach(id => citedIds.add(id));
            }
            if (citedIds.size > 0) {
                const refLines: string[] = [];
                let idx = 1;
                for (const id of citedIds) {
                    const lit = searchResults.find(r => r.id === id);
                    if (!lit) continue;
                    const authors = lit.authors?.join(', ') || 'Unknown';
                    const title = lit.title || '';
                    const year = lit.year || '';
                    const journal = (lit as any).journal || '';
                    const doi = (lit as any).doi || '';
                    refLines.push(`[${idx}] ${authors}. ${title}. ${journal}, ${year}.${doi ? ` DOI: ${doi}` : ''}`);
                    idx++;
                }
                if (refLines.length > 0) {
                    parts.push(`## 参考文献\n\n${refLines.join('\n\n')}`);
                }
            }

            const fullText = parts.join('\n\n---\n\n');
            onInsertText(fullText);

            updateStage('writing_to_editor', {
                status: 'done', progress: 100,
                completedAt: new Date().toISOString(),
                message: '已写入编辑器'
            });
            setSession(prev => ({ ...prev, currentStage: 'completed' }));
            log('综述已写入编辑器！');
        } catch (err: any) {
            updateStage('writing_to_editor', { status: 'error', error: err.message });
            log(`写入失败: ${err.message}`);
        }
    }, [session, onInsertText, updateStage, log]);

    // ─── 导出综述 ─────────────────────────────────────────────
    const exportReview = useCallback(async (format: 'docx' | 'latex' | 'pdf', options?: { citationStyle?: 'numbered' | 'apa' | 'gbt7714' | 'nature'; latexTemplate?: 'generic' | 'elsevier' | 'acs' | 'rsc' }) => {
        const { exportToDocx, exportToLatex, exportToPdf } = await import('../utils/reviewExport');
        const style = options?.citationStyle || 'numbered';
        try {
            log(`正在导出 ${format.toUpperCase()} 格式...`);
            switch (format) {
                case 'docx':
                    await exportToDocx(session, searchResults, style);
                    break;
                case 'latex':
                    exportToLatex(session, searchResults, options?.latexTemplate || 'generic', style);
                    break;
                case 'pdf':
                    exportToPdf(session, searchResults, style);
                    break;
            }
            log(`✅ ${format.toUpperCase()} 导出成功！`);
        } catch (err: any) {
            log(`导出失败: ${err.message}`);
        }
    }, [session, searchResults, log]);

    // ═══════════════════════════════════════════════════════════════
    // 重新生成单个章节
    // ═══════════════════════════════════════════════════════════════

    const regenerateSection = useCallback(async (sectionId: string) => {
        const sections = flattenOutline(session.outline);
        const section = sections.find(s => s.id === sectionId);
        if (!section) return;

        setIsRunning(true);
        // ★ 快照: 重生成前保存
        saveSnapshot(`重生成: ${section.title}`, 'regenerate');
        log(`重新生成章节: ${section.title}`);

        // 标记为生成中
        setSession(prev => ({
            ...prev,
            outline: prev.outline.map(function updateNode(n: ReviewOutlineNode): ReviewOutlineNode {
                if (n.id === sectionId) return { ...n, status: 'generating' };
                if (n.children?.length) return { ...n, children: n.children.map(updateNode) };
                return n;
            })
        }));

        try {
            const relatedLits = section.literatureIds
                .map(id => searchResults.find(r => r.id === id))
                .filter(Boolean) as Literature[];

            const knowledge = relatedLits.map(lit =>
                `- [${lit.id}] ${lit.title} (${lit.authors?.[0] || ''}, ${lit.year})\n  摘要: ${(lit.abstract || '').substring(0, 300)}`
            ).join('\n\n');

            // ★ RAG 增强
            let ragContext = '';
            try {
                const ragChunks = await queryRagContext(`${section.title} ${section.description}`, 4);
                if (ragChunks.length > 0) ragContext = '\n\n【本地知识库】:\n' + ragChunks.join('\n\n');
            } catch (_) { /* 静默降级 */ }

            const sectionIdx = sections.findIndex(s => s.id === sectionId);
            let previousSummary = '';
            for (let i = 0; i < sectionIdx; i++) {
                const prevContent = session.generatedSections[sections[i].id];
                if (prevContent) previousSummary += `### ${sections[i].title}\n${prevContent.substring(0, 300)}\n\n`;
            }

            // ★ 流式重新生成
            const content = await generateReviewSectionStream(
                session.config, section, knowledge + ragContext,
                previousSummary.substring(0, 2000), searchResults,
                (streamText) => {
                    setSession(prev => ({
                        ...prev,
                        outline: prev.outline.map(function updateNode(n: ReviewOutlineNode): ReviewOutlineNode {
                            if (n.id === sectionId) return { ...n, status: 'writing' as any, content: streamText };
                            if (n.children?.length) return { ...n, children: n.children.map(updateNode) };
                            return n;
                        }),
                        generatedSections: { ...prev.generatedSections, [sectionId]: streamText }
                    }));
                }
            );

            setSession(prev => ({
                ...prev,
                outline: prev.outline.map(function updateNode(n: ReviewOutlineNode): ReviewOutlineNode {
                    if (n.id === sectionId) return { ...n, status: 'done', content };
                    if (n.children?.length) return { ...n, children: n.children.map(updateNode) };
                    return n;
                }),
                generatedSections: { ...prev.generatedSections, [sectionId]: content }
            }));
            log(`章节重新生成完成: ${section.title}`);
        } catch (err: any) {
            setSession(prev => ({
                ...prev,
                outline: prev.outline.map(function updateNode(n: ReviewOutlineNode): ReviewOutlineNode {
                    if (n.id === sectionId) return { ...n, status: 'error' };
                    if (n.children?.length) return { ...n, children: n.children.map(updateNode) };
                    return n;
                })
            }));
            log(`章节重新生成失败: ${err.message}`);
        } finally {
            setIsRunning(false);
        }
    }, [session, searchResults, log]);


    // ─── 编辑子问题 ─────────────────────────────────────────────
    const updateSubQuestion = useCallback((id: string, update: Partial<ReviewSubQuestion>) => {
        setSession(prev => ({
            ...prev,
            subQuestions: prev.subQuestions.map(sq => sq.id === id ? { ...sq, ...update } : sq)
        }));
    }, []);

    const addSubQuestion = useCallback(() => {
        const newSq: ReviewSubQuestion = {
            id: `sq_${Date.now()}`,
            question: '',
            keywords: [],
            description: ''
        };
        setSession(prev => ({ ...prev, subQuestions: [...prev.subQuestions, newSq] }));
    }, []);

    const removeSubQuestion = useCallback((id: string) => {
        setSession(prev => ({
            ...prev,
            subQuestions: prev.subQuestions.filter(sq => sq.id !== id)
        }));
    }, []);

    // ─── 编辑文献分级 ──────────────────────────────────────────
    const updateLiteratureTier = useCallback((litId: string, tier: ScreenedLiterature['tier']) => {
        setSession(prev => ({
            ...prev,
            screenedLiterature: prev.screenedLiterature.map(s =>
                s.literatureId === litId ? { ...s, tier } : s
            )
        }));
    }, []);

    /** 手动追加文献到筛选列表 */
    const manualAddScreened = useCallback((litId: string, tier: ScreenedLiterature['tier']) => {
        setSession(prev => {
            // 已存在则跳过
            if (prev.screenedLiterature.some(s => s.literatureId === litId)) return prev;
            const newEntry: ScreenedLiterature = {
                literatureId: litId,
                tier,
                relevanceScore: 0,
                assignedSubtopics: [],
                reason: '用户手动追加'
            };
            return { ...prev, screenedLiterature: [...prev.screenedLiterature, newEntry] };
        });
    }, []);

    /** 更新文献的子问题关联 */
    const updateSubtopicAssignment = useCallback((litId: string, subtopicIds: string[]) => {
        setSession(prev => ({
            ...prev,
            screenedLiterature: prev.screenedLiterature.map(s =>
                s.literatureId === litId ? { ...s, assignedSubtopics: subtopicIds } : s
            )
        }));
    }, []);

    // ─── 版本快照与回滚 ───────────────────────────────────────
    const MAX_SNAPSHOTS = 20;

    /** 保存当前章节内容快照 */
    const saveSnapshot = useCallback((label: string, trigger: ContentSnapshot['trigger']) => {
        setSession(prev => {
            const snapshot: ContentSnapshot = {
                id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                label,
                trigger,
                sections: { ...prev.generatedSections },
                timestamp: new Date().toISOString()
            };
            const history = [...(prev.contentHistory || []), snapshot];
            // FIFO 淘汰
            while (history.length > MAX_SNAPSHOTS) history.shift();
            return { ...prev, contentHistory: history };
        });
    }, []);

    /** 回滚到指定快照（自动先保存当前状态） */
    const restoreSnapshot = useCallback((snapshotId: string) => {
        setSession(prev => {
            const target = prev.contentHistory?.find(s => s.id === snapshotId);
            if (!target) return prev;
            // 先保存当前状态为“回滚前”快照
            const rollbackSnapshot: ContentSnapshot = {
                id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                label: '回滚前',
                trigger: target.trigger,
                sections: { ...prev.generatedSections },
                timestamp: new Date().toISOString()
            };
            const history = [...(prev.contentHistory || []), rollbackSnapshot];
            while (history.length > MAX_SNAPSHOTS) history.shift();
            return {
                ...prev,
                generatedSections: { ...target.sections },
                contentHistory: history
            };
        });
    }, []);

    // ═══════════════════════════════════════════════════════════════
    // 用户介入式编辑
    // ═══════════════════════════════════════════════════════════════

    const [isAiEditing, setIsAiEditing] = useState(false);

    /** 直接更新章节内容（用户手动编辑） */
    const editSectionContent = useCallback((sectionId: string, newContent: string) => {
        saveSnapshot('手动编辑前', 'regenerate');
        setSession(prev => ({
            ...prev,
            generatedSections: { ...prev.generatedSections, [sectionId]: newContent }
        }));
    }, [saveSnapshot]);

    /** AI 局部编辑：替换选中文本 */
    const aiEditSelection = useCallback(async (
        sectionId: string,
        selectedText: string,
        action: EditAction,
        customInstruction?: string
    ) => {
        const sections = flattenOutline(session.outline);
        const section = sections.find(s => s.id === sectionId);
        if (!section) return;

        const fullContent = session.generatedSections[sectionId];
        if (!fullContent || !selectedText) return;

        setIsAiEditing(true);
        log(`🤖 AI 编辑 [${action}]: ${section.title}`);

        try {
            saveSnapshot(`AI ${action}: ${section.title}`, 'regenerate');

            const relatedLits = section.literatureIds
                .map(id => searchResults.find(r => r.id === id))
                .filter(Boolean) as Literature[];

            const replacement = await interactiveEditSection(
                session.config,
                section.title,
                fullContent,
                selectedText,
                action,
                customInstruction,
                relatedLits
            );

            const updatedContent = fullContent.replace(selectedText, replacement);
            setSession(prev => ({
                ...prev,
                generatedSections: { ...prev.generatedSections, [sectionId]: updatedContent }
            }));
            log(`✅ AI 编辑完成: ${section.title}`);
        } catch (err: any) {
            log(`AI 编辑失败: ${err.message}`);
            console.warn('[InteractiveEdit]', err);
        } finally {
            setIsAiEditing(false);
        }
    }, [session.outline, session.generatedSections, session.config, searchResults, saveSnapshot, log]);

    /** 增量审计：只审计指定章节 */
    const runIncrementalAudit = useCallback(async (sectionIds: string[]) => {
        const sections = flattenOutline(session.outline);
        const targeted = sections.filter(s => sectionIds.includes(s.id));
        if (targeted.length === 0) return;

        setIsRunning(true);
        log(`🔍 增量审计 ${targeted.length} 个章节...`);

        try {
            const partialContent = targeted
                .map(n => `## ${n.title}\n\n${session.generatedSections[n.id] || ''}`)
                .join('\n\n');

            const auditReport = await auditReviewCrossRef(partialContent, searchResults, session.config.language);
            setSession(prev => ({ ...prev, auditReport }));
            log(`✅ 增量审计完成`);
        } catch (err: any) {
            log(`增量审计失败: ${err.message}`);
        } finally {
            setIsRunning(false);
        }
    }, [session.outline, session.generatedSections, session.config.language, searchResults, log]);

    // ─── 编辑大纲 ────────────────────────────────────────────────
    const updateOutlineNode = useCallback((nodeId: string, update: Partial<ReviewOutlineNode>) => {
        setSession(prev => ({
            ...prev,
            outline: prev.outline.map(function updateNode(n: ReviewOutlineNode): ReviewOutlineNode {
                if (n.id === nodeId) return { ...n, ...update };
                if (n.children?.length) return { ...n, children: n.children.map(updateNode) };
                return n;
            })
        }));
    }, []);

    // ─── 大纲高级编辑操作 ──────────────────────────────────────

    /** 辅助: 在树中查找节点的父列表和索引 */
    const findNodeInTree = useCallback((
        nodes: ReviewOutlineNode[],
        targetId: string,
        parent?: ReviewOutlineNode
    ): { list: ReviewOutlineNode[]; index: number; parent?: ReviewOutlineNode } | null => {
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].id === targetId) return { list: nodes, index: i, parent };
            if (nodes[i].children?.length) {
                const found = findNodeInTree(nodes[i].children!, targetId, nodes[i]);
                if (found) return found;
            }
        }
        return null;
    }, []);

    /** 深拷贝大纲树 */
    const cloneOutline = useCallback((nodes: ReviewOutlineNode[]): ReviewOutlineNode[] =>
        nodes.map(n => ({ ...n, children: n.children ? cloneOutline(n.children) : undefined }))
    , []);

    /** 新增章节节点 */
    const addOutlineNode = useCallback((parentId?: string) => {
        setSession(prev => {
            const tree = cloneOutline(prev.outline);
            const newNode: ReviewOutlineNode = {
                id: `outline_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                title: '新章节',
                description: '',
                level: parentId ? 2 : 1,
                literatureIds: [],
                targetWords: 500,
                status: 'pending'
            };
            if (parentId) {
                const found = findNodeInTree(tree, parentId);
                if (found) {
                    const target = found.list[found.index];
                    if (!target.children) target.children = [];
                    target.children.push(newNode);
                }
            } else {
                tree.push(newNode);
            }
            return { ...prev, outline: tree };
        });
    }, [cloneOutline, findNodeInTree]);

    /** 删除章节节点（含子节点），同时清理生成内容 */
    const removeOutlineNode = useCallback((nodeId: string) => {
        setSession(prev => {
            // 收集要删除的所有 ID
            const idsToRemove = new Set<string>();
            const collectIds = (nodes: ReviewOutlineNode[]) => {
                for (const n of nodes) {
                    idsToRemove.add(n.id);
                    if (n.children?.length) collectIds(n.children);
                }
            };
            const findAndCollect = (nodes: ReviewOutlineNode[]) => {
                for (const n of nodes) {
                    if (n.id === nodeId) { idsToRemove.add(n.id); if (n.children) collectIds(n.children); return; }
                    if (n.children?.length) findAndCollect(n.children);
                }
            };
            findAndCollect(prev.outline);

            const removeFromTree = (nodes: ReviewOutlineNode[]): ReviewOutlineNode[] =>
                nodes.filter(n => n.id !== nodeId).map(n => ({
                    ...n,
                    children: n.children ? removeFromTree(n.children) : undefined
                }));

            const newSections = { ...prev.generatedSections };
            const newFigures = prev.generatedFigures ? { ...prev.generatedFigures } : undefined;
            idsToRemove.forEach(id => {
                delete newSections[id];
                if (newFigures) delete newFigures[id];
            });

            return { ...prev, outline: removeFromTree(prev.outline), generatedSections: newSections, generatedFigures: newFigures };
        });
    }, []);

    /** 同级上移/下移 */
    const moveOutlineNode = useCallback((nodeId: string, direction: 'up' | 'down') => {
        setSession(prev => {
            const tree = cloneOutline(prev.outline);
            const found = findNodeInTree(tree, nodeId);
            if (!found) return prev;
            const { list, index } = found;
            const swapIdx = direction === 'up' ? index - 1 : index + 1;
            if (swapIdx < 0 || swapIdx >= list.length) return prev;
            [list[index], list[swapIdx]] = [list[swapIdx], list[index]];
            return { ...prev, outline: tree };
        });
    }, [cloneOutline, findNodeInTree]);

    /** 提升层级: 从父节点的 children 中取出，变为父节点的同级 */
    const promoteOutlineNode = useCallback((nodeId: string) => {
        setSession(prev => {
            const tree = cloneOutline(prev.outline);
            const found = findNodeInTree(tree, nodeId);
            if (!found || !found.parent) return prev; // 已是顶级则不操作
            const node = found.list.splice(found.index, 1)[0];
            node.level = Math.max(1, node.level - 1);
            // 在父节点所在列表中紧跟父节点之后插入
            const parentFound = findNodeInTree(tree, found.parent.id);
            if (parentFound) {
                parentFound.list.splice(parentFound.index + 1, 0, node);
            }
            return { ...prev, outline: tree };
        });
    }, [cloneOutline, findNodeInTree]);

    /** 降低层级: 变为前一个同级节点的子节点 */
    const demoteOutlineNode = useCallback((nodeId: string) => {
        setSession(prev => {
            const tree = cloneOutline(prev.outline);
            const found = findNodeInTree(tree, nodeId);
            if (!found || found.index === 0) return prev; // 没有前一个同级则不操作
            const node = found.list.splice(found.index, 1)[0];
            node.level += 1;
            const prevSibling = found.list[found.index - 1];
            if (!prevSibling.children) prevSibling.children = [];
            prevSibling.children.push(node);
            return { ...prev, outline: tree };
        });
    }, [cloneOutline, findNodeInTree]);

    /** 合并两个同级节点: B 的文献和子节点追加到 A */
    const mergeOutlineNodes = useCallback((nodeIdA: string, nodeIdB: string) => {
        setSession(prev => {
            const tree = cloneOutline(prev.outline);
            const foundA = findNodeInTree(tree, nodeIdA);
            const foundB = findNodeInTree(tree, nodeIdB);
            if (!foundA || !foundB) return prev;
            const nodeA = foundA.list[foundA.index];
            const nodeB = foundB.list[foundB.index];
            // 合并文献 ID（去重）
            const mergedLits = [...new Set([...nodeA.literatureIds, ...nodeB.literatureIds])];
            nodeA.literatureIds = mergedLits;
            nodeA.targetWords += nodeB.targetWords;
            // 合并子节点
            if (nodeB.children?.length) {
                if (!nodeA.children) nodeA.children = [];
                nodeA.children.push(...nodeB.children);
            }
            // 合并已生成内容
            const newSections = { ...prev.generatedSections };
            if (newSections[nodeB.id]) {
                newSections[nodeA.id] = (newSections[nodeA.id] || '') + '\n\n' + newSections[nodeB.id];
                delete newSections[nodeB.id];
            }
            // 移除 B
            foundB.list.splice(foundB.index, 1);
            return { ...prev, outline: tree, generatedSections: newSections };
        });
    }, [cloneOutline, findNodeInTree]);

    /** 拆分节点: 按文献 ID 列表将一个节点一分为二 */
    const splitOutlineNode = useCallback((nodeId: string, newNodeLitIds: string[]) => {
        setSession(prev => {
            const tree = cloneOutline(prev.outline);
            const found = findNodeInTree(tree, nodeId);
            if (!found) return prev;
            const original = found.list[found.index];
            const remainingLits = original.literatureIds.filter(id => !newNodeLitIds.includes(id));
            // 更新原节点
            original.literatureIds = remainingLits;
            original.targetWords = Math.round(original.targetWords * (remainingLits.length / Math.max(remainingLits.length + newNodeLitIds.length, 1)));
            // 创建新节点
            const newNode: ReviewOutlineNode = {
                id: `outline_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                title: `${original.title} (续)`,
                description: original.description,
                level: original.level,
                literatureIds: newNodeLitIds,
                targetWords: original.targetWords > 0 ? original.targetWords : 500,
                status: 'pending'
            };
            // 在原节点之后插入
            found.list.splice(found.index + 1, 0, newNode);
            return { ...prev, outline: tree };
        });
    }, [cloneOutline, findNodeInTree]);

    /** 将一篇文献从一个章节移到另一个章节 */
    const reassignLiterature = useCallback((litId: string, fromNodeId: string, toNodeId: string) => {
        setSession(prev => ({
            ...prev,
            outline: prev.outline.map(function updateNode(n: ReviewOutlineNode): ReviewOutlineNode {
                let updated = n;
                if (n.id === fromNodeId) {
                    updated = { ...n, literatureIds: n.literatureIds.filter(id => id !== litId) };
                } else if (n.id === toNodeId) {
                    updated = { ...n, literatureIds: n.literatureIds.includes(litId) ? n.literatureIds : [...n.literatureIds, litId] };
                }
                if (updated.children?.length) {
                    return { ...updated, children: updated.children.map(updateNode) };
                }
                return updated;
            })
        }));
    }, []);

    // ─── 组图挂载/卸载 ──────────────────────────────────────────

    /** 将一个已保存的组图方案挂载到章节（追加到数组） */
    const attachAssemblyToSection = useCallback((sectionId: string, assemblyId: string, caption: string) => {
        setSession(prev => {
            const list = [...(prev.attachedAssemblies?.[sectionId] || [])];
            // 避免重复挂载同一组图
            if (!list.some(a => a.assemblyId === assemblyId)) {
                list.push({ assemblyId, caption });
            }
            return { ...prev, attachedAssemblies: { ...(prev.attachedAssemblies || {}), [sectionId]: list } };
        });
        log(`已挂载组图 → 章节 ${sectionId}`);
    }, [log]);

    /** 取消挂载（按 assemblyId 移除） */
    const detachAssemblyFromSection = useCallback((sectionId: string, assemblyId?: string) => {
        setSession(prev => {
            const list = prev.attachedAssemblies?.[sectionId] || [];
            if (assemblyId) {
                const filtered = list.filter(a => a.assemblyId !== assemblyId);
                const next = { ...(prev.attachedAssemblies || {}) };
                if (filtered.length === 0) delete next[sectionId]; else next[sectionId] = filtered;
                return { ...prev, attachedAssemblies: next };
            }
            // 不传 assemblyId → 清空该章节全部
            const next = { ...(prev.attachedAssemblies || {}) };
            delete next[sectionId];
            return { ...prev, attachedAssemblies: next };
        });
        log(`已取消挂载组图 ← 章节 ${sectionId}`);
    }, [log]);

    // ─── 表格挂载/卸载 ──────────────────────────────────────────

    const attachTableToSection = useCallback((sectionId: string, tableId: string, table: { title: string; headers: string[]; rows: string[][]; note?: string }) => {
        setSession(prev => {
            const list = [...(prev.attachedTables?.[sectionId] || [])];
            if (!list.some(t => t.tableId === tableId)) {
                list.push({ tableId, table });
            }
            return { ...prev, attachedTables: { ...(prev.attachedTables || {}), [sectionId]: list } };
        });
        log(`已挂载表格「${table.title}」→ 章节 ${sectionId}`);
    }, [log]);

    const detachTableFromSection = useCallback((sectionId: string, tableId?: string) => {
        setSession(prev => {
            const list = prev.attachedTables?.[sectionId] || [];
            if (tableId) {
                const filtered = list.filter(t => t.tableId !== tableId);
                const next = { ...(prev.attachedTables || {}) };
                if (filtered.length === 0) delete next[sectionId]; else next[sectionId] = filtered;
                return { ...prev, attachedTables: next };
            }
            const next = { ...(prev.attachedTables || {}) };
            delete next[sectionId];
            return { ...prev, attachedTables: next };
        });
        log(`已取消挂载表格 ← 章节 ${sectionId}`);
    }, [log]);

    // ─── 公式挂载/卸载 ──────────────────────────────────────────

    const attachFormulaToSection = useCallback((sectionId: string, formulaId: string, formula: { title: string; content: string; type: 'math' | 'chem'; isBlock?: boolean }) => {
        setSession(prev => {
            const list = [...(prev.attachedFormulas?.[sectionId] || [])];
            if (!list.some(f => f.formulaId === formulaId)) {
                list.push({ formulaId, formula });
            }
            return { ...prev, attachedFormulas: { ...(prev.attachedFormulas || {}), [sectionId]: list } };
        });
        log(`已挂载公式「${formula.title}」→ 章节 ${sectionId}`);
    }, [log]);

    const detachFormulaFromSection = useCallback((sectionId: string, formulaId?: string) => {
        setSession(prev => {
            const list = prev.attachedFormulas?.[sectionId] || [];
            if (formulaId) {
                const filtered = list.filter(f => f.formulaId !== formulaId);
                const next = { ...(prev.attachedFormulas || {}) };
                if (filtered.length === 0) delete next[sectionId]; else next[sectionId] = filtered;
                return { ...prev, attachedFormulas: next };
            }
            const next = { ...(prev.attachedFormulas || {}) };
            delete next[sectionId];
            return { ...prev, attachedFormulas: next };
        });
        log(`已取消挂载公式 ← 章节 ${sectionId}`);
    }, [log]);

    // ─── 手动上传 PDF 触发全文解析 ─────────────────────────────
    const uploadPdfForLiterature = useCallback(async (litId: string, base64Data: string) => {
        try {
            log(`📎 手动上传 PDF: ${litId}`);
            const fullText = await extractTextFromPdfBase64(base64Data);
            log(`✅ 全文提取成功 (${fullText.length} 字符)`);

            // 保存全文到 searchResults
            setSearchResults(prev => prev.map(r =>
                r.id === litId ? { ...r, fullText, fullTextSource: 'user_upload' as const } : r
            ));

            // 更新 screenedLiterature 状态
            setSession(prev => ({
                ...prev,
                screenedLiterature: prev.screenedLiterature.map(s =>
                    s.literatureId === litId ? { ...s, fullTextStatus: 'ready' as const } : s
                )
            }));

            // 立即用全文做深度知识提取
            const lit = searchResults.find(r => r.id === litId);
            if (lit) {
                log(`🔬 全文深度提取中...`);
                const deepResult = await extractKnowledgeSinkAI(lit, fullText);
                setSearchResults(prev => prev.map(r =>
                    r.id === litId ? {
                        ...r,
                        performance: deepResult.performance || r.performance,
                        synthesisSteps: deepResult.synthesisSteps || r.synthesisSteps,
                        extractedTables: deepResult.extractedTables || r.extractedTables,
                        knowledgeSinked: true
                    } : r
                ));
                log(`✅ 深度知识提取完成`);
            }
        } catch (err: any) {
            console.error(`[ReviewWorkshop] PDF 上传解析失败: ${litId}`, err);
            log(`❌ PDF 解析失败: ${err.message}`);
            setSession(prev => ({
                ...prev,
                screenedLiterature: prev.screenedLiterature.map(s =>
                    s.literatureId === litId ? { ...s, fullTextStatus: 'failed' as const } : s
                )
            }));
        }
    }, [searchResults, log]);

    // ─── 中止 ──────────────────────────────────────────────────
    const abort = useCallback(() => {
        abortRef.current = true;
        autoRunRef.current = false;
        setIsRunning(false);
        log('已中止当前操作');
    }, [log]);

    // ═══════════════════════════════════════════════════════════════
    // 一键全自动
    // ═══════════════════════════════════════════════════════════════

    const runAllSteps = useCallback(async () => {
        if (!session.config.topic.trim()) return;
        autoRunRef.current = true;
        abortRef.current = false;

        const stepEntries: { name: string; fn: () => Promise<void> }[] = [
            { name: 'topic_decomposition', fn: runTopicDecomposition },
            { name: 'literature_search', fn: runLiteratureSearch },
            { name: 'literature_screening', fn: runLiteratureScreening },
            { name: 'knowledge_extraction', fn: runKnowledgeExtraction },
            { name: 'outline_generation', fn: runOutlineGeneration },
            { name: 'section_generation', fn: runSectionGeneration },
            { name: 'figure_generation', fn: runFigureGeneration },
            { name: 'multi_agent_revision', fn: runMultiAgentRevision },
            { name: 'consistency_engine', fn: runConsistencyEngine },
            { name: 'polishing', fn: runPolishing },
            { name: 'writing_to_editor', fn: runWriteToEditor }
        ];

        const pipelineStart = Date.now();

        for (let i = 0; i < stepEntries.length; i++) {
            if (abortRef.current || !autoRunRef.current) {
                log('自动执行已停止');
                return;
            }
            const { name, fn } = stepEntries[i];
            const stepStart = Date.now();
            try {
                await fn();
            } catch (err: any) {
                log(`自动执行中断: ${err.message}`);
                autoRunRef.current = false;
                return;
            }
            const durationMs = Date.now() - stepStart;
            const timing: StageTiming = {
                stage: name,
                startedAt: new Date(stepStart).toISOString(),
                durationMs
            };
            setSession(prev => ({
                ...prev,
                stageTiming: [...(prev.stageTiming || []), timing]
            }));
        }

        const totalElapsed = Date.now() - pipelineStart;
        autoRunRef.current = false;
        log(`🎉 全自动综述生成完成！总耗时 ${Math.round(totalElapsed / 1000)}s`);

        // 桌面通知
        try {
            if ('Notification' in window) {
                if (Notification.permission === 'granted') {
                    new Notification('SciFlow 综述工坊', { body: `综述生成完成，总耗时 ${Math.round(totalElapsed / 1000)} 秒`, icon: '/icon.png' });
                } else if (Notification.permission !== 'denied') {
                    Notification.requestPermission();
                }
            }
        } catch (_) { /* 忽略通知权限错误 */ }
    }, [session.config, runTopicDecomposition, runLiteratureSearch, runLiteratureScreening,
        runKnowledgeExtraction, runOutlineGeneration, runSectionGeneration,
        runFigureGeneration, runCrossAudit, runAutoRevision, runConsistencyEngine, runPolishing, runWriteToEditor, log]);

    // ─── 管线进度计算 ────────────────────────────────────────
    const TOTAL_PIPELINE_STEPS = 11;
    const pipelineProgress = useMemo(() => {
        const timings = session.stageTiming || [];
        const completedSteps = timings.length;
        const elapsed = timings.reduce((sum, t) => sum + t.durationMs, 0);
        const avgPerStep = completedSteps > 0 ? elapsed / completedSteps : 0;
        const remainingSteps = Math.max(0, TOTAL_PIPELINE_STEPS - completedSteps);
        const estimatedRemaining = Math.round(avgPerStep * remainingSteps);
        const estimatedFinishTime = remainingSteps > 0
            ? new Date(Date.now() + estimatedRemaining).toLocaleTimeString()
            : null;
        const percent = Math.round((completedSteps / TOTAL_PIPELINE_STEPS) * 100);
        return { completedSteps, totalSteps: TOTAL_PIPELINE_STEPS, elapsed, estimatedRemaining, estimatedFinishTime, percent };
    }, [session.stageTiming]);

    return {
        session,
        searchResults,
        isRunning,
        currentLog,
        isLoaded: isSessionLoaded && isSearchLoaded,
        stageLabels: STAGE_LABELS,
        pipelineProgress,

        // 配置
        updateConfig,
        resetSession,

        // 管线阶段
        runTopicDecomposition,
        runLiteratureSearch,
        runLiteratureScreening,
        runKnowledgeExtraction,
        runOutlineGeneration,
        runSectionGeneration,
        runFigureGeneration,
        runCrossAudit,
        runPolishing,
        runWriteToEditor,

        // 自动化
        runAllSteps,
        runAutoRevision,
        runMultiAgentRevision,
        runConsistencyEngine,

        // 编辑
        regenerateSection,
        updateSubQuestion,
        addSubQuestion,
        removeSubQuestion,
        updateLiteratureTier,
        manualAddScreened,
        updateSubtopicAssignment,
        updateOutlineNode,
        addOutlineNode,
        removeOutlineNode,
        moveOutlineNode,
        promoteOutlineNode,
        demoteOutlineNode,
        mergeOutlineNodes,
        splitOutlineNode,
        reassignLiterature,

        // 组图挂载
        attachAssemblyToSection,
        detachAssemblyFromSection,
        // 版本历史
        restoreSnapshot,
        // 表格挂载
        attachTableToSection,
        detachTableFromSection,

        // 公式挂载
        attachFormulaToSection,
        detachFormulaFromSection,

        // 文献池管理
        addToPool,
        removeFromPool,
        clearPool,

        // 控制
        abort,
        // 导出
        exportReview,

        // 全文 PDF 管理
        uploadPdfForLiterature,

        // 用户介入式编辑
        editSectionContent,
        aiEditSelection,
        runIncrementalAudit,
        isAiEditing
    };
};
