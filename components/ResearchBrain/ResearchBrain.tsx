import React, { useRef, useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { useRagEngine } from '../../hooks/useRagEngine';
import { useProjectContext } from '../../context/ProjectContext';
import { useTranslation } from '../../locales/useTranslation';
import { GraphNode, GraphEdge, GraphInsight } from '../../types';
import { findUpstreamPath, calculatePathCost } from '../../services/graphService';
import { generateGraphInsights, INSIGHT_CONFIG } from '../../services/graphIntelligence';
import { buildProjectGraph } from '../../services/graphBuilder';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { motion, AnimatePresence } from 'framer-motion';

const StarfieldGraph = lazy(() => import('./StarfieldGraph'));

// ─── 3D 星空加载占位 ─────────────────────────────────────────────
function StarfieldFallback() {
    const { t } = useTranslation();
    return (
        <div className="w-full h-full flex items-center justify-center bg-[#020817]" style={{ borderRadius: '2rem' }}>
            <div className="flex flex-col items-center gap-4">
                <div className="relative w-20 h-20">
                    <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 animate-ping" />
                    <div className="absolute inset-2 rounded-full border-2 border-indigo-400/50 animate-pulse" />
                    <div className="absolute inset-4 rounded-full bg-indigo-600/20 flex items-center justify-center">
                        <i className="fa-solid fa-atom text-indigo-400 text-xl animate-spin" style={{ animationDuration: '3s' }} />
                    </div>
                </div>
                <span className="text-[10px] font-black text-indigo-300/60 uppercase tracking-[0.3em]">
                    {t('researchBrain.starfield.loading')}
                </span>
            </div>
        </div>
    );
}

// ─── 节点颜色映射 ─────────────────────────────────────────────────
const getNodeColor = (type: string) => {
    switch (type) {
        case 'Project': return '#6366f1';
        case 'Literature': return '#10b981';
        case 'Characterization': return '#f43f5e';
        default: return '#f59e0b';
    }
};

const getNodeIcon = (type: string) => {
    switch (type) {
        case 'Project': return 'fa-vial';
        case 'Literature': return 'fa-book';
        case 'Characterization': return 'fa-microscope';
        case 'TRL_Milestone': return 'fa-flag';
        default: return 'fa-circle';
    }
};

// ─── 图例 Badge ──────────────────────────────────────────────────
function LegendBadge({ color, label }: { color: string; label: string }) {
    return (
        <div className="flex items-center gap-1.5">
            <div
                className="w-2 h-2 rounded-full"
                style={{
                    backgroundColor: color,
                    boxShadow: `0 0 6px ${color}`,
                }}
            />
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                {label}
            </span>
        </div>
    );
}

// ─── 主组件 ──────────────────────────────────────────────────────
const ResearchBrain: React.FC = () => {
    const {
        projects, resources, activeTheme, showToast, navigate, setReturnPath
    } = useProjectContext();

    const { t } = useTranslation();

    const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '');

    const {
        isIndexing, indexProgress, query, setQuery,
        chatHistory, isLoading, handleSearch, startIndexing
    } = useRagEngine(selectedProjectId);

    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

    // 图谱状态
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [showSuccessPath, setShowSuccessPath] = useState(false);
    const [highlightedPath, setHighlightedPath] = useState<Set<string>>(new Set());
    const [pathCost, setPathCost] = useState<{ total: number, currency: string } | null>(null);

    // ★ Phase 3: 图谱洞察
    const [insights, setInsights] = useState<GraphInsight[]>([]);
    const [showInsightPanel, setShowInsightPanel] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);

    const activeProject = useMemo(() =>
        projects.find(p => p.id === selectedProjectId) || projects[0],
        [projects, selectedProjectId]);

    const handleNodeClick = (node: GraphNode) => {
        setSelectedNode(node);

        if (showSuccessPath) {
            const path = findUpstreamPath(node.id, edges);
            setHighlightedPath(path);
            const cost = calculatePathCost(node.id, nodes, edges);
            setPathCost({ total: cost.total, currency: cost.currency });
        } else {
            setHighlightedPath(new Set([node.id]));
            setPathCost(null);
        }

        // 联动提问建议
        if (node.type === 'Literature') {
            setQuery(t('researchBrain.chat.suggestions.literature', { title: node.label }));
        } else if (node.type === 'Characterization') {
            setQuery(t('researchBrain.chat.suggestions.characterization', { title: node.label }));
        }
    };

    // --- 动态图谱构建（使用独立 graphBuilder 服务） ---
    useEffect(() => {
        if (!activeProject) return;
        const { nodes: builtNodes, edges: builtEdges } = buildProjectGraph(activeProject, resources);
        setNodes(builtNodes);
        setEdges(builtEdges);
    }, [activeProject, resources]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [chatHistory, isLoading]);

    const handleTraceSource = () => {
        if (!selectedNode || !activeProject) return;

        setReturnPath('research_brain');

        if (selectedNode.type === 'Characterization' && selectedNode.meta?.milestoneId) {
            navigate('project_detail', activeProject.id, `logs:${selectedNode.meta.milestoneId}`);
            showToast({ message: t('researchBrain.nodePanel.toasts.tracing'), type: 'info' });
        } else if (selectedNode.type === 'TRL_Milestone') {
            navigate('project_detail', activeProject.id, `logs:${selectedNode.meta.realId}`);
            showToast({ message: t('researchBrain.nodePanel.toasts.locating'), type: 'info' });
        } else if (selectedNode.type === 'Literature') {
            const resId = selectedNode.id.replace('lit_', '');
            navigate('literature', activeProject.id, `${resId}_rb`);
            showToast({ message: t('researchBrain.nodePanel.toasts.opening'), type: 'info' });
        } else if (selectedNode.type === 'Project') {
            navigate('project_detail', activeProject.id, 'logs');
            showToast({ message: t('researchBrain.nodePanel.toasts.jumping'), type: 'info' });
        } else {
            showToast({ message: t('researchBrain.nodePanel.toasts.noSource'), type: 'info' });
        }
    };

    // 节点统计
    const stats = useMemo(() => ({
        total: nodes.length,
        literature: nodes.filter(n => n.type === 'Literature').length,
        milestones: nodes.filter(n => n.type === 'TRL_Milestone').length,
        experiments: nodes.filter(n => n.type === 'Characterization').length,
        connections: edges.length,
    }), [nodes, edges]);

    // ★ Phase 3: 自动生成图谱洞察
    useEffect(() => {
        if (nodes.length >= 3) {
            const newInsights = generateGraphInsights(nodes, edges);
            setInsights(newInsights);
        } else {
            setInsights([]);
        }
    }, [nodes, edges]);

    return (
        <div className="h-full flex flex-col gap-3 animate-reveal overflow-hidden px-4 py-2">
            {/* ── 顶部 Header ── */}
            <header className="flex justify-between items-center px-6 py-3 rounded-[2rem] border border-white/5 shrink-0 shadow-2xl z-20"
                style={{
                    background: 'linear-gradient(135deg, rgba(6,8,25,0.95), rgba(15,23,42,0.95))',
                    backdropFilter: 'blur(20px)',
                }}
            >
                <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-[1.2rem] flex items-center justify-center text-white shadow-xl relative overflow-hidden"
                        style={{
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)',
                        }}
                    >
                        <i className="fa-solid fa-brain text-xl relative z-10" />
                        <div className="absolute inset-0 bg-white/10 animate-pulse" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white tracking-tight leading-none flex items-center gap-2">
                            {t('researchBrain.title')}
                            <span className="text-[8px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-widest">
                                3D
                            </span>
                        </h2>
                        <div className="flex items-center gap-4 mt-1.5">
                            <select
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                                className="bg-transparent text-indigo-300 text-[11px] font-bold outline-none cursor-pointer border-b border-white/20 pb-0.5"
                            >
                                {projects.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.title}</option>)}
                            </select>
                            {pathCost && showSuccessPath && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg animate-reveal">
                                    <span className="text-[8px] font-black text-emerald-400 uppercase">{t('researchBrain.header.totalPathCost')}</span>
                                    <span className="text-[11px] font-black text-white font-mono">{pathCost.currency} {pathCost.total}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* 节点统计 */}
                    <div className="hidden lg:flex items-center gap-3 px-4 py-1.5 bg-white/[0.03] rounded-xl border border-white/5">
                        <div className="text-center">
                            <div className="text-[13px] font-black text-white font-mono">{stats.total}</div>
                            <div className="text-[7px] font-bold text-slate-500 uppercase">{t('researchBrain.header.nodes')}</div>
                        </div>
                        <div className="w-px h-6 bg-white/10" />
                        <div className="text-center">
                            <div className="text-[13px] font-black text-emerald-400 font-mono">{stats.connections}</div>
                            <div className="text-[7px] font-bold text-slate-500 uppercase">{t('researchBrain.header.connections')}</div>
                        </div>
                    </div>

                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 gap-1">
                        <button
                            onClick={() => {
                                setShowSuccessPath(!showSuccessPath);
                                if (!showSuccessPath && selectedNode) {
                                    const path = findUpstreamPath(selectedNode.id, edges);
                                    setHighlightedPath(path);
                                }
                            }}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-colors flex items-center gap-2 ${showSuccessPath ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <i className="fa-solid fa-code-branch" /> {t('researchBrain.header.successPath')}
                        </button>
                        {/* ★ Phase 3: 洞察按钮 */}
                        <button
                            onClick={() => setShowInsightPanel(!showInsightPanel)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-colors flex items-center gap-2 relative ${
                                showInsightPanel ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <i className="fa-solid fa-bolt" /> 洞察
                            {insights.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center animate-pulse">
                                    {insights.length}
                                </span>
                            )}
                        </button>
                    </div>

                    <div className="w-px h-8 bg-white/10 mx-1" />

                    {isIndexing ? (
                        <div className="flex flex-col items-end gap-1.5">
                            <span className="text-[9px] font-black text-indigo-400 uppercase animate-pulse">{t('researchBrain.header.indexing')}</span>
                            <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${indexProgress}%` }} />
                            </div>
                        </div>
                    ) : (
                        <button onClick={startIndexing} className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all flex items-center gap-2 shadow-lg">
                            <i className="fa-solid fa-database" /> {t('researchBrain.header.train')}
                        </button>
                    )}
                </div>
            </header>

            {/* ── 主体区域 ── */}
            <div className="flex-1 flex flex-row gap-3 min-h-0 overflow-hidden">

                {/* ━━ 左侧: 3D 星空图谱 ━━ */}
                <div
                    className="flex-[1.8] relative overflow-hidden group"
                    style={{
                        borderRadius: '2rem',
                        border: '1px solid rgba(99,102,241,0.15)',
                        boxShadow: 'inset 0 0 80px rgba(99,102,241,0.03), 0 0 40px rgba(0,0,0,0.4)',
                    }}
                >
                    <Suspense fallback={<StarfieldFallback />}>
                        <StarfieldGraph
                            nodes={nodes}
                            edges={edges}
                            selectedNode={selectedNode}
                            highlightedPath={highlightedPath}
                            onSelectNode={handleNodeClick}
                        />
                    </Suspense>

                    {/* 暗角蒙版 */}
                    <div
                        className="absolute inset-0 pointer-events-none z-20"
                        style={{
                            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(2,5,16,0.4) 70%, rgba(2,5,16,0.8) 100%)',
                            borderRadius: '2rem',
                        }}
                    />

                    {/* 图例 */}
                    <div className="absolute bottom-5 left-5 flex items-center gap-4 px-4 py-2 bg-slate-900/70 backdrop-blur-xl rounded-xl border border-white/5 z-30">
                        <LegendBadge color="#6366f1" label={t('researchBrain.starfield.legend.project')} />
                        <LegendBadge color="#10b981" label={t('researchBrain.starfield.legend.literature')} />
                        <LegendBadge color="#f43f5e" label={t('researchBrain.starfield.legend.experiment')} />
                        <LegendBadge color="#f59e0b" label={t('researchBrain.starfield.legend.milestone')} />
                    </div>

                    {/* ★ Phase 3: 洞察面板（浮动在 3D 图谱右下方） */}
                    <AnimatePresence>
                        {showInsightPanel && insights.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                className="absolute bottom-5 right-5 w-80 max-h-[55%] z-40 overflow-hidden flex flex-col"
                                style={{
                                    background: 'linear-gradient(145deg, rgba(6,8,25,0.94), rgba(15,23,42,0.94))',
                                    backdropFilter: 'blur(24px)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '1.5rem',
                                    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                                }}
                            >
                                <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-2">
                                        <i className="fa-solid fa-bolt text-amber-400 text-xs" />
                                        <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest">智能洞察</span>
                                        <span className="text-[9px] font-bold text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{insights.length}</span>
                                    </div>
                                    <button
                                        onClick={() => setShowInsightPanel(false)}
                                        className="w-5 h-5 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all"
                                    >
                                        <i className="fa-solid fa-times text-[9px]" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                                    {insights.map((insight, idx) => {
                                        const config = INSIGHT_CONFIG[insight.type] || INSIGHT_CONFIG.cluster;
                                        return (
                                            <motion.div
                                                key={insight.id}
                                                initial={{ opacity: 0, x: 10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.05 }}
                                                className="p-3 rounded-xl cursor-pointer hover:brightness-125 transition-all"
                                                style={{
                                                    background: config.bgColor,
                                                    border: `1px solid ${config.borderColor}`,
                                                }}
                                                onClick={() => {
                                                    // 点击洞察 → 高亮相关节点
                                                    setHighlightedPath(new Set(insight.involvedNodes));
                                                    const firstNode = nodes.find(n => insight.involvedNodes.includes(n.id));
                                                    if (firstNode) setSelectedNode(firstNode);
                                                }}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                                        style={{ backgroundColor: `${config.color}20` }}
                                                    >
                                                        <i className={`${config.icon} text-[10px]`} style={{ color: config.color }} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[10px] font-black text-white truncate">{insight.title}</span>
                                                            {insight.severity === 'high' && (
                                                                <span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase shrink-0">高</span>
                                                            )}
                                                        </div>
                                                        <p className="text-[9px] text-slate-400 leading-relaxed line-clamp-3">{insight.description}</p>
                                                        {insight.suggestedAction && (
                                                            <div className="mt-2 flex items-center gap-1.5">
                                                                <i className="fa-solid fa-wand-magic-sparkles text-[8px]" style={{ color: config.color }} />
                                                                <span className="text-[8px] font-bold" style={{ color: config.color }}>{insight.suggestedAction}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* 操作提示 */}
                    <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-30">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/70 backdrop-blur-xl rounded-lg border border-white/5">
                            <i className="fa-solid fa-hand text-slate-500 text-[10px]" />
                            <span className="text-[9px] font-bold text-slate-500">{t('researchBrain.starfield.controls')}</span>
                        </div>
                    </div>

                    {/* ── 节点属性浮动卡片 ── */}
                    <AnimatePresence>
                        {selectedNode && (
                            <motion.div
                                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="absolute top-6 left-6 w-72 z-50 overflow-hidden"
                                style={{
                                    background: 'linear-gradient(145deg, rgba(6,8,25,0.92), rgba(15,23,42,0.92))',
                                    backdropFilter: 'blur(24px)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '1.5rem',
                                    boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 30px rgba(99,102,241,0.08)',
                                }}
                            >
                                {/* 顶部发光条 */}
                                <div
                                    className="h-0.5 w-full"
                                    style={{
                                        background: `linear-gradient(90deg, transparent, ${getNodeColor(selectedNode.type)}, transparent)`,
                                    }}
                                />

                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-9 h-9 rounded-xl flex items-center justify-center text-white relative overflow-hidden"
                                                style={{
                                                    backgroundColor: getNodeColor(selectedNode.type),
                                                    boxShadow: `0 0 20px ${getNodeColor(selectedNode.type)}40`,
                                                }}
                                            >
                                                <i className={`fa-solid ${getNodeIcon(selectedNode.type)} text-sm relative z-10`} />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">{selectedNode.type}</span>
                                                <h4 className="text-[13px] font-black text-white mt-0.5 truncate">{selectedNode.label}</h4>
                                            </div>
                                        </div>
                                        <button onClick={() => setSelectedNode(null)} className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                                            <i className="fa-solid fa-times text-[10px]" />
                                        </button>
                                    </div>

                                    <div className="space-y-3 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                                        {selectedNode.meta && Object.entries(selectedNode.meta).map(([k, v]: [string, any]) => {
                                            if (k === 'realId' || k === 'milestoneId') return null;
                                            return (
                                                <div key={k} className="flex flex-col gap-0.5 border-b border-white/5 pb-2 last:border-0">
                                                    <span className="text-[8px] font-black text-indigo-400/70 uppercase tracking-wider">{k}</span>
                                                    <span className="text-[11px] font-medium text-slate-300 leading-snug">{String(v)}</span>
                                                </div>
                                            );
                                        })}
                                        {selectedNode.charData && (
                                            <div className="p-3 bg-white/[0.03] rounded-xl border border-indigo-500/15 text-[11px] text-indigo-100/70 leading-relaxed italic">
                                                " {selectedNode.charData.analysisText} "
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4 flex flex-col gap-2">
                                        <button
                                            onClick={handleTraceSource}
                                            className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg hover:brightness-110 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-white"
                                            style={{
                                                background: `linear-gradient(135deg, ${getNodeColor(selectedNode.type)}, ${getNodeColor(selectedNode.type)}cc)`,
                                            }}
                                        >
                                            <i className="fa-solid fa-arrow-right-long" /> {t('researchBrain.nodePanel.originalSource')}
                                        </button>
                                        <button
                                            onClick={() => setQuery(t('researchBrain.chat.suggestions.deepInsight', { title: selectedNode.label }))}
                                            className="w-full py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-[9px] font-black uppercase hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                        >
                                            <i className="fa-solid fa-wand-magic-sparkles text-amber-400" /> {t('researchBrain.nodePanel.askAi')}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ━━ 右侧: 语义问答 ━━ */}
                <div className="flex-1 overflow-hidden flex flex-col min-w-0"
                    style={{
                        borderRadius: '2rem',
                        background: 'linear-gradient(180deg, #ffffff, #f8fafc)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)',
                    }}
                >
                    <header className="px-6 py-3 border-b border-slate-100 shrink-0 bg-white/80 backdrop-blur-sm" style={{ borderTopLeftRadius: '2rem', borderTopRightRadius: '2rem' }}>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <i className="fa-solid fa-comments text-indigo-600" /> {t('researchBrain.chat.title')}
                        </h4>
                    </header>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        {chatHistory.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-6">
                                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center shadow-inner">
                                    <i className="fa-solid fa-microchip text-3xl" />
                                </div>
                                <div>
                                    <h4 className="text-xl font-black text-slate-800 uppercase italic mb-2">{t('researchBrain.chat.welcome.title')}</h4>
                                    <p className="text-[11px] text-slate-500 font-medium italic leading-relaxed">
                                        {t('researchBrain.chat.welcome.subtitle')}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            chatHistory.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-reveal`}>
                                    <div className={`max-w-[90%] p-5 rounded-[1.5rem] shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none border-l-4 border-l-indigo-500'}`}>
                                        <div className="markdown-body text-[12.5px] leading-relaxed">
                                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.text}</ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                        {isLoading && (
                            <div className="flex justify-start animate-pulse">
                                <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
                                    <i className="fa-solid fa-spinner animate-spin text-indigo-600" />
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('researchBrain.chat.searching')}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <footer className="p-4 bg-white border-t border-slate-100 shrink-0" style={{ borderBottomLeftRadius: '2rem', borderBottomRightRadius: '2rem' }}>
                        <div className="flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-[1.5rem] p-2 focus-within:ring-4 focus-within:ring-indigo-100 transition-all">
                            <textarea
                                className="flex-1 bg-transparent border-none p-3 text-sm font-bold text-slate-700 outline-none resize-none h-12 max-h-32 italic"
                                placeholder={t('researchBrain.chat.placeholder')}
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSearch())}
                            />
                            <button
                                onClick={handleSearch}
                                disabled={isLoading || !query.trim()}
                                className="w-11 h-11 bg-indigo-600 text-white rounded-2xl shadow-xl hover:bg-black transition-all active:scale-90 disabled:opacity-30 flex items-center justify-center shrink-0"
                            >
                                <i className="fa-solid fa-paper-plane text-base" />
                            </button>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    );
};

export default ResearchBrain;
