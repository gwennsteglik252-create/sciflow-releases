import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useRagEngine } from '../../hooks/useRagEngine';
import { useProjectContext } from '../../context/ProjectContext';
import { GraphNode, GraphEdge } from '../../types';
import { findUpstreamPath, calculatePathCost } from '../../services/graphService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { motion, AnimatePresence } from 'framer-motion';

const ResearchBrain: React.FC = () => {
    const {
        projects, resources, activeTheme, showToast, navigate, setReturnPath
    } = useProjectContext();

    const {
        isIndexing, indexProgress, query, setQuery,
        chatHistory, isLoading, handleSearch, startIndexing
    } = useRagEngine();

    const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || '');
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

    // 图谱状态
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [showSuccessPath, setShowSuccessPath] = useState(false);
    const [highlightedPath, setHighlightedPath] = useState<Set<string>>(new Set());
    const [pathCost, setPathCost] = useState<{ total: number, currency: string } | null>(null);

    const svgRef = useRef<SVGSVGElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    // 触摸手势追踪
    const lastTouchesRef = useRef<React.Touch[]>([]);
    const lastTouchDistRef = useRef<number | null>(null);

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
            setQuery(`请深度分析这篇文献《${node.label}》的核心创新点和实验参数。`);
        } else if (node.type === 'Characterization') {
            setQuery(`针对这次实验记录“${node.label}”，请从物理机理角度分析其结果的合理性。`);
        }
    };

    // --- 动态图谱构建 ---
    useEffect(() => {
        if (!activeProject) return;
        const nodesList: GraphNode[] = [];
        const edgesList: GraphEdge[] = [];
        const projectNodeId = `proj_${activeProject.id}`;

        nodesList.push({
            id: projectNodeId, label: activeProject.title.substring(0, 12) + '...', type: 'Project',
            x: 400, y: 300, status: 'active', meta: { description: activeProject.description }
        });

        activeProject.milestones.forEach((ms, i) => {
            const msId = `ms_${ms.id}`;
            nodesList.push({
                id: msId, label: ms.title, type: 'TRL_Milestone',
                x: 200 + (i * 180) % 400, y: 450 + Math.floor(i / 3) * 120,
                status: ms.status === 'completed' ? 'success' : 'active',
                meta: { hypothesis: ms.hypothesis, dueDate: ms.dueDate, realId: ms.id }
            });
            edgesList.push({ source: projectNodeId, target: msId, type: 'relates_to' });

            ms.logs.forEach((log, j) => {
                const logId = `log_${log.id}`;
                nodesList.push({
                    id: logId, label: log.content.substring(0, 10), type: 'Characterization',
                    x: (nodesList[nodesList.length - 1].x) + (j % 2 === 0 ? 60 : -60),
                    y: (nodesList[nodesList.length - 1].y) + 80,
                    charData: { linkedLogId: log.id, analysisText: log.summaryInsight || log.description },
                    meta: { timestamp: log.timestamp, status: log.status, milestoneId: ms.id } // 注入所属里程碑ID
                });
                edgesList.push({ source: msId, target: logId, type: 'proves' });
            });
        });

        resources.filter(r => r.projectId === activeProject.id).forEach((res, i) => {
            const litId = `lit_${res.id}`;
            nodesList.push({
                id: litId, label: res.title.substring(0, 15) + '...', type: 'Literature',
                x: 100 + (i * 150) % 600, y: 120 + Math.floor(i / 4) * 80,
                meta: { source: res.source, year: res.year, authors: res.authors?.join(', ') }
            });
            edgesList.push({ source: litId, target: projectNodeId, type: 'derived_from' });
        });

        setNodes(nodesList);
        setEdges(edgesList);
    }, [activeProject, resources]);

    // ---- 触摸 & 滚轮手势（使用原生事件以支持 passive:false） ----
    const getTouchDist = (t1: Touch, t2: Touch) => {
        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    useEffect(() => {
        const el = canvasRef.current;
        if (!el) return;

        // --- 滚轮/触摸板手势 ---
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                // Ctrl/Cmd+滚轮 或 macOS 触摸板捏合缩放（自动带 ctrlKey）
                const direction = e.deltaY > 0 ? -1 : 1;
                setScale(prev => Math.min(Math.max(prev + direction * 0.1, 0.4), 3));
            } else {
                // 双指滑动 → 平移视野
                setOffset(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
            }
        };

        // --- 触摸屏手势 ---
        const onTouchStart = (e: TouchEvent) => {
            const touches = Array.from(e.touches);
            lastTouchesRef.current = touches as any;
            if (touches.length === 2) {
                e.preventDefault();
                lastTouchDistRef.current = getTouchDist(touches[0], touches[1]);
            } else {
                lastTouchDistRef.current = null;
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            const touches = Array.from(e.touches);
            const prev = lastTouchesRef.current;
            if (prev.length === 0) return;

            if (touches.length === 2 && prev.length === 2) {
                e.preventDefault();

                const currCX = (touches[0].clientX + touches[1].clientX) / 2;
                const currCY = (touches[0].clientY + touches[1].clientY) / 2;
                const prevCX = ((prev[0] as any).clientX + (prev[1] as any).clientX) / 2;
                const prevCY = ((prev[0] as any).clientY + (prev[1] as any).clientY) / 2;
                setOffset(o => ({ x: o.x + currCX - prevCX, y: o.y + currCY - prevCY }));

                const currDist = getTouchDist(touches[0], touches[1]);
                if (lastTouchDistRef.current !== null && lastTouchDistRef.current > 0) {
                    const ratio = currDist / lastTouchDistRef.current;
                    setScale(s => Math.min(Math.max(s * ratio, 0.4), 3));
                }
                lastTouchDistRef.current = currDist;
            }

            lastTouchesRef.current = touches as any;
        };

        const onTouchEnd = (e: TouchEvent) => {
            const touches = Array.from(e.touches);
            lastTouchesRef.current = touches as any;
            if (touches.length < 2) lastTouchDistRef.current = null;
        };

        // 使用 { passive: false } 确保 preventDefault() 可以生效
        el.addEventListener('wheel', onWheel, { passive: false });
        el.addEventListener('touchstart', onTouchStart, { passive: false });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd, { passive: false });

        return () => {
            el.removeEventListener('wheel', onWheel);
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
        };
    }, []);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [chatHistory, isLoading]);

    const getNodeColor = (type: string) => {
        switch (type) {
            case 'Project': return '#6366f1';
            case 'Literature': return '#10b981';
            case 'Characterization': return '#f43f5e';
            default: return '#f59e0b';
        }
    };

    const handleTraceSource = () => {
        if (!selectedNode || !activeProject) return;

        setReturnPath('research_brain'); // 标记返回路径

        if (selectedNode.type === 'Characterization' && selectedNode.meta?.milestoneId) {
            // 跳转到详情页，并指定显示 logs 视图，且选中对应的里程碑
            navigate('project_detail', activeProject.id, `logs:${selectedNode.meta.milestoneId}`);
            showToast({ message: "正在回溯原始实验记录...", type: 'info' });
        } else if (selectedNode.type === 'TRL_Milestone') {
            // 直接回溯研究节点
            navigate('project_detail', activeProject.id, `logs:${selectedNode.meta.realId}`);
            showToast({ message: "正在定位研究节点...", type: 'info' });
        } else if (selectedNode.type === 'Literature') {
            const resId = selectedNode.id.replace('lit_', '');
            navigate('literature', activeProject.id, `${resId}_rw`);
            showToast({ message: "正在打开文献详情...", type: 'info' });
        } else if (selectedNode.type === 'Project') {
            navigate('project_detail', activeProject.id, 'logs');
            showToast({ message: "正在跳转至课题大厅...", type: 'info' });
        } else {
            showToast({ message: "该节点暂无关联的原始数据源", type: 'info' });
        }
    };

    return (
        <div className="h-full flex flex-col gap-4 animate-reveal overflow-hidden px-4 py-2">
            <header className="flex justify-between items-center bg-slate-900 px-6 py-4 rounded-[2rem] border border-white/5 shrink-0 shadow-2xl z-20">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 via-purple-600 to-fuchsia-600 rounded-[1.2rem] flex items-center justify-center text-white shadow-xl ring-4 ring-indigo-500/20">
                        <i className="fa-solid fa-brain text-2xl"></i>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">智能科研决策中心</h2>
                        <div className="flex items-center gap-4 mt-2">
                            <select
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                                className="bg-transparent text-indigo-300 text-[11px] font-bold outline-none cursor-pointer border-b border-white/20 pb-0.5"
                            >
                                {projects.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.title}</option>)}
                            </select>
                            {pathCost && showSuccessPath && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg animate-reveal">
                                    <span className="text-[8px] font-black text-emerald-400 uppercase">路径总成本:</span>
                                    <span className="text-[11px] font-black text-white font-mono">{pathCost.currency} {pathCost.total}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
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
                            <i className="fa-solid fa-code-branch"></i> 成功路径追踪
                        </button>
                    </div>

                    <div className="w-px h-8 bg-white/10 mx-2"></div>

                    {isIndexing ? (
                        <div className="flex flex-col items-end gap-1.5">
                            <span className="text-[9px] font-black text-indigo-400 uppercase animate-pulse">建立语义索引...</span>
                            <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${indexProgress}%` }}></div>
                            </div>
                        </div>
                    ) : (
                        <button onClick={startIndexing} className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all flex items-center gap-2 shadow-lg">
                            <i className="fa-solid fa-database"></i> 训练大脑
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-1 flex flex-row gap-4 min-h-0 overflow-hidden">
                {/* 左侧：全链路交互图谱 */}
                <div
                    ref={canvasRef}
                    className="flex-[1.8] bg-slate-950 rounded-[3rem] border border-slate-800 relative overflow-hidden group shadow-inner"
                    onMouseDown={(e) => e.button === 0 && setIsPanning(true)}
                    onMouseMove={(e) => isPanning && setOffset(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }))}
                    onMouseUp={() => setIsPanning(false)}
                    onMouseLeave={() => setIsPanning(false)}
                    style={{ touchAction: 'none' }}
                >
                    <svg
                        ref={svgRef}
                        className="w-full h-full cursor-grab active:cursor-grabbing"
                        style={{ contain: 'layout paint size', shapeRendering: 'geometricPrecision' }}
                    >
                        <pattern id="grid-dots" width="40" height="40" patternUnits="userSpaceOnUse">
                            <circle cx="2" cy="2" r="1" fill="#1e293b" />
                        </pattern>
                        <rect width="100%" height="100%" fill="url(#grid-dots)" />

                        <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`} style={{ transformOrigin: '0 0' }}>
                            {edges.map((e, i) => {
                                const s = nodes.find(n => n.id === e.source);
                                const t = nodes.find(n => n.id === e.target);
                                if (!s || !t) return null;
                                const isHighlighted = highlightedPath.has(s.id) && highlightedPath.has(t.id);
                                return (
                                    <line
                                        key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                                        stroke={isHighlighted ? "#10b981" : "#1e293b"}
                                        strokeWidth={isHighlighted ? "3" : "1"}
                                        strokeDasharray={e.type === 'derived_from' ? '4 2' : '0'}
                                        vectorEffect="non-scaling-stroke"
                                        className="transition-[stroke] duration-300"
                                    />
                                );
                            })}
                            {nodes.map(n => {
                                const isSelected = selectedNode?.id === n.id;
                                const isHighlighted = highlightedPath.has(n.id);
                                const color = getNodeColor(n.type);
                                return (
                                    <g
                                        key={n.id}
                                        onClick={(e) => { e.stopPropagation(); handleNodeClick(n); }}
                                        className="cursor-pointer group/node"
                                    >
                                        {(isSelected || isHighlighted) && (
                                            <circle cx={n.x} cy={n.y} r="32" fill="none" stroke={isHighlighted ? "#10b981" : color} strokeWidth="2" vectorEffect="non-scaling-stroke" className="animate-pulse" />
                                        )}
                                        <circle
                                            cx={n.x} cy={n.y} r={n.type === 'Project' ? 18 : 12}
                                            fill="#0f172a" stroke={isHighlighted ? "#10b981" : color}
                                            strokeWidth="2"
                                            vectorEffect="non-scaling-stroke"
                                            className="transition-[stroke] duration-300"
                                        />
                                        <circle cx={n.x} cy={n.y} r={4} fill={isHighlighted ? "#10b981" : color} vectorEffect="non-scaling-stroke" />
                                        <text
                                            x={n.x} y={n.y + 30}
                                            textAnchor="middle"
                                            fill={isHighlighted ? "#fff" : "#94a3b8"}
                                            className="text-[9px] font-black uppercase pointer-events-none select-none transition-colors duration-300"
                                            style={{ transform: `scale(${1 / scale})`, transformOrigin: `${n.x}px ${n.y + 30}px` }}
                                        >
                                            {n.label}
                                        </text>
                                    </g>
                                );
                            })}
                        </g>
                    </svg>

                    {/* 节点属性浮动卡片 */}
                    <AnimatePresence>
                        {selectedNode && (
                            <motion.div
                                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="absolute top-8 left-8 w-80 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-2xl p-6 flex flex-col z-50 overflow-hidden"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: getNodeColor(selectedNode.type) }}>
                                            <i className={`fa-solid ${selectedNode.type === 'Project' ? 'fa-vial' : selectedNode.type === 'Literature' ? 'fa-book' : 'fa-microscope'} text-sm`}></i>
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{selectedNode.type} 节点</span>
                                            <h4 className="text-sm font-black text-white uppercase mt-0.5 truncate italic">{selectedNode.label}</h4>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedNode(null)} className="text-slate-500 hover:text-rose-500 transition-colors"><i className="fa-solid fa-times"></i></button>
                                </div>

                                <div className="space-y-4 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                                    {selectedNode.meta && Object.entries(selectedNode.meta).map(([k, v]: [string, any]) => {
                                        if (k === 'realId' || k === 'milestoneId') return null; // 隐藏内部定位ID
                                        return (
                                            <div key={k} className="flex flex-col gap-1 border-b border-white/5 pb-2 last:border-0">
                                                <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">{k}</span>
                                                <span className="text-[11px] font-medium text-slate-300 leading-snug">{String(v)}</span>
                                            </div>
                                        );
                                    })}
                                    {selectedNode.charData && (
                                        <div className="p-4 bg-white/5 rounded-2xl border border-indigo-500/20 italic text-[11px] text-indigo-100/80 leading-relaxed shadow-inner">
                                            “ {selectedNode.charData.analysisText} ”
                                        </div>
                                    )}
                                </div>

                                <div className="mt-6 flex flex-col gap-2">
                                    <button
                                        onClick={handleTraceSource}
                                        className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-500 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <i className="fa-solid fa-arrow-right-long"></i> 查看原始数据源
                                    </button>
                                    <button
                                        onClick={() => setQuery(`关于节点“${selectedNode.label}”，请提供更深入的科学见解。`)}
                                        className="w-full py-2.5 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-[9px] font-black uppercase hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                    >
                                        <i className="fa-solid fa-wand-magic-sparkles text-amber-400"></i> 提问 AI
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* 图谱浮动控制 */}
                    <div className="absolute bottom-8 right-8 flex flex-col gap-2">
                        <button onClick={() => setScale(prev => Math.min(3, prev + 0.2))} className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl text-white hover:bg-indigo-600 transition-all border border-white/10 shadow-xl"><i className="fa-solid fa-plus"></i></button>
                        <button onClick={() => setScale(prev => Math.max(0.4, prev - 0.2))} className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl text-white hover:bg-indigo-600 transition-all border border-white/10 shadow-xl"><i className="fa-solid fa-minus"></i></button>
                        <button onClick={() => { setOffset({ x: 0, y: 0 }); setScale(1); }} className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl text-white hover:bg-indigo-600 transition-all border border-white/10 shadow-xl"><i className="fa-solid fa-compress"></i></button>
                    </div>
                </div>

                {/* 右侧：语义问答 - 现在是全屏高度 */}
                <div className="flex-1 bg-white rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col min-w-0">
                    <header className="px-6 py-4 bg-slate-50 border-b border-slate-100 shrink-0">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <i className="fa-solid fa-comments text-indigo-600"></i> 跨维度证据链合成 (RAG)
                        </h4>
                    </header>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-slate-50/20">
                        {chatHistory.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-6">
                                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center shadow-inner">
                                    <i className="fa-solid fa-microchip text-3xl"></i>
                                </div>
                                <div>
                                    <h4 className="text-xl font-black text-slate-800 uppercase italic mb-2">交互式提问</h4>
                                    <p className="text-[11px] text-slate-500 font-medium italic leading-relaxed">
                                        AI 将基于本地全量文献和实验数据为您合成证据链。
                                    </p>
                                </div>
                            </div>
                        ) : (
                            chatHistory.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-reveal`}>
                                    <div className={`max-w-[90%] p-5 rounded-[2rem] shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none border-l-4 border-l-indigo-500'}`}>
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
                                    <i className="fa-solid fa-spinner animate-spin text-indigo-600"></i>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">检索向量空间...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <footer className="p-5 bg-white border-t border-slate-100 shrink-0">
                        <div className="flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-[2rem] p-2 focus-within:ring-4 focus-within:ring-indigo-100 transition-all">
                            <textarea
                                className="flex-1 bg-transparent border-none p-3 text-sm font-bold text-slate-700 outline-none resize-none h-12 max-h-32 italic"
                                placeholder="输入您对当前课题或具体节点的科学疑问..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSearch())}
                            />
                            <button
                                onClick={handleSearch}
                                disabled={isLoading || !query.trim()}
                                className="w-11 h-11 bg-indigo-600 text-white rounded-2xl shadow-xl hover:bg-black transition-all active:scale-90 disabled:opacity-30 flex items-center justify-center shrink-0"
                            >
                                <i className="fa-solid fa-paper-plane text-base"></i>
                            </button>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    );
};

export default ResearchBrain;
