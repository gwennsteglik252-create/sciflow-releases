import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GraphNode, GraphEdge, ResearchProject, Literature } from '../types';
import { triggerNodeRiskAnalysis, calculatePathCost, findUpstreamPath, exportPathReport } from '../services/graphService';
import { useProjectContext } from '../context/ProjectContext';
import saveAs from 'file-saver';

interface KnowledgeGraphProps {
  projects: ResearchProject[];
  resources: Literature[];
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ projects, resources }) => {
  const { activeTheme, showToast } = useProjectContext();
  
  // --- 新增：项目切换的选择状态 ---
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightedPath, setHighlightedPath] = useState<Set<string>>(new Set());
  const [showSuccessPath, setShowSuccessPath] = useState(false);
  const [patentRiskLoading, setPatentRiskLoading] = useState(false);
  const [pathCost, setPathCost] = useState<{total: number, currency: string} | null>(null);

  // 平移与缩放状态
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const isLightMode = activeTheme.type === 'light';

  // 根据选择派生的当前活跃项目
  const activeProject = useMemo(() => 
    projects.find(p => p.id === selectedProjectId) || projects[0],
  [projects, selectedProjectId]);

  // --- 缩放与平移处理 ---
  const handleWheel = (e: React.WheelEvent) => {
    const zoomFactor = 0.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    const newScale = Math.min(Math.max(scale + direction * zoomFactor, 0.4), 4);
    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { setIsPanning(true); }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setOffset(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleNodeClick = async (node: GraphNode) => {
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

    if (node.type === 'Patent' && node.patentData && !node.patentData.blockageDesc) {
        setPatentRiskLoading(true);
        try {
            const result = await triggerNodeRiskAnalysis(node, edges, nodes);
            if (result) {
                setNodes(prev => prev.map(n => n.id === node.id ? { 
                    ...n, 
                    patentData: { 
                        ...n.patentData!, 
                        riskLevel: (result.riskLevel as any) || n.patentData?.riskLevel, 
                        blockageDesc: result.blockageDesc || n.patentData?.blockageDesc 
                    },
                    meta: { ...n.meta, aiAnalysis: result }
                } : n));
            }
        } catch (error) {
            console.error("Patent risk analysis failed:", error);
        } finally {
            setPatentRiskLoading(false);
        }
    }
  };

  const handleGenerateReport = async () => {
    const targetId = selectedNode?.id || Array.from(highlightedPath)[0];
    if (!targetId) {
        if (showToast) showToast({ message: '请选择一个节点以生成溯源路径', type: 'info' });
        return;
    }

    const pathIds = highlightedPath.size > 0 ? highlightedPath : findUpstreamPath(targetId, edges);
    if (showToast) showToast({ message: '正在生成深度溯源报告...', type: 'info' });
    try {
        const report = await exportPathReport(pathIds, nodes);
        const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
        saveAs(blob, `SciFlow_Traceability_${activeProject?.title}_${Date.now()}.md`);
        if (showToast) showToast({ message: '溯源报告已导出', type: 'success' });
    } catch (error) {
        if (showToast) showToast({ message: '报告生成失败', type: 'error' });
    }
  };

  const handleTraceLogClick = (logId: string | undefined) => {
    if (!logId) return;
    const project = projects.find(p => p.milestones.some(m => m.logs.some(l => l.id === logId)));
    if (project) {
        window.location.hash = `project/${project.id}/logs`;
    } else {
        if (showToast) showToast({ message: '未找到关联项目', type: 'error' });
    }
  };

  // --- 动态图谱数据生成：现在依赖于 activeProject ---
  useEffect(() => {
    const nodesList: GraphNode[] = [];
    const edgesList: GraphEdge[] = [];

    if (!activeProject) return;

    // 切换项目时重置视觉状态
    setSelectedNode(null);
    setHighlightedPath(new Set());
    setPathCost(null);

    // 1. 项目根节点
    const projectNodeId = `proj_${activeProject.id}`;
    nodesList.push({ 
        id: projectNodeId, 
        label: activeProject.title.substring(0, 10) + (activeProject.title.length > 10 ? '...' : ''), 
        type: 'Project', 
        x: 450, y: 300, 
        trlLevel: activeProject.trl, 
        status: 'active',
        meta: { description: activeProject.description, members: activeProject.members }
    });

    // 2. 里程碑
    activeProject.milestones.forEach((ms, i) => {
        const msId = `ms_${ms.id}`;
        nodesList.push({
            id: msId,
            label: ms.title.substring(0, 10) + (ms.title.length > 10 ? '...' : ''),
            type: 'TRL_Milestone',
            x: 200 + (i * 150) % 600,
            y: 450 + Math.floor(i / 4) * 100,
            trlLevel: activeProject.trl,
            status: ms.status === 'completed' ? 'success' : 'active',
            meta: { hypothesis: ms.hypothesis, dueDate: ms.dueDate }
        });
        edgesList.push({ source: projectNodeId, target: msId, type: 'relates_to' });

        // 2.1. 实验实录
        ms.logs.forEach((log, j) => {
            const logId = `log_${log.id}`;
            let evidenceWeight = 0;
            if (log.files && log.files.length > 0) evidenceWeight += log.files.length * 0.5;
            if (log.scientificData && Object.keys(log.scientificData).length > 0) evidenceWeight += 1;
            if (log.deepAnalysis) evidenceWeight += 2;
            if (log.status === 'Verified') evidenceWeight += 1;

            nodesList.push({
                id: logId,
                label: `实录: ${log.content.substring(0, 8)}`,
                type: 'Characterization',
                x: (nodesList[nodesList.length -1].x || 0) + (j % 2 === 0 ? 50 : -50),
                y: (nodesList[nodesList.length -1].y || 0) + 70 + (j * 10),
                evidenceWeight: evidenceWeight,
                meta: { content: log.content, timestamp: log.timestamp, status: log.status },
                charData: { linkedLogId: log.id, analysisText: log.aiInsight || '无 AI 分析' }
            });
            edgesList.push({ source: msId, target: logId, type: 'proves', weight: evidenceWeight });
        });
    });

    // 3. 文献资源
    resources.filter(r => r.projectId === activeProject.id).forEach((res, i) => {
        const litId = `lit_${res.id}`;
        nodesList.push({
            id: litId,
            label: res.title.substring(0, 10) + (res.title.length > 10 ? '...' : ''),
            type: 'Literature',
            x: 100 + (i * 120) % 500,
            y: 100 + Math.floor(i / 4) * 60,
            meta: { title: res.title, authors: res.authors, year: res.year, url: res.url }
        });
        edgesList.push({ source: litId, target: projectNodeId, type: 'derived_from' });
    });

    // 4. 矩阵/成本/指标
    (activeProject.matrices || []).forEach((matrix, mIdx) => {
        matrix.data.forEach((sample, sIdx) => {
            const sampleNodeId = `sample_${sample.id}`;
            const isHighCost = (sample.results['Cost'] && parseFloat(String(sample.results['Cost'])) > 1000);
            
            nodesList.push({
                id: sampleNodeId,
                label: sample.sampleId,
                type: isHighCost ? 'Cost' : 'Metric',
                x: 600 + (mIdx * 50) + (sIdx * 20),
                y: 150 + (mIdx * 80) + (sIdx * 10),
                meta: { processParams: sample.processParams, results: sample.results },
                costData: isHighCost ? { value: parseFloat(String(sample.results['Cost'])), currency: 'USD', unit: 'batch' } : undefined
            });
            edgesList.push({ source: projectNodeId, target: sampleNodeId, type: 'relates_to' });
        });
    });

    setNodes(nodesList);
    setEdges(edgesList);
  }, [activeProject, resources]);

  const getNodeColor = (type: string, risk?: string, status?: string) => {
      if (status === 'failed') return '#f43f5e';
      if (type === 'Patent') return risk === 'High' ? '#f43f5e' : '#f59e0b';
      if (type === 'Cost') return '#ef4444';
      if (type === 'Metric') return '#3b82f6';
      if (type === 'Project') return '#6366f1';
      if (type === 'Characterization') return '#8b5cf6';
      if (type === 'TRL_Milestone') return '#10b981';
      if (type === 'Literature') return '#64748b';
      return '#64748b';
  };

  const getTypeDisplay = (type: string) => {
      switch(type) {
          case 'Project': return '课题核心';
          case 'Literature': return '理论源';
          case 'Patent': return '专利壁垒';
          case 'Characterization': return '实验证据';
          case 'Cost': return '成本因子';
          case 'TRL_Milestone': return 'TRL 节点';
          case 'Metric': return '性能指标';
          default: return type;
      }
  };

  return (
    <div className={`h-full flex flex-col animate-reveal rounded-[2.5rem] overflow-hidden relative border transition-colors duration-500 ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-[#0f172a] border-slate-800'}`}>
      
      {/* 页眉工具栏 - 布局调整，将项目选择器移动到右侧 */}
      <header className="absolute top-0 left-0 right-0 p-6 flex flex-col md:flex-row justify-between items-start z-10 pointer-events-none gap-4">
         <div className="pointer-events-auto flex flex-col">
            <div className="flex flex-col">
                <h2 className={`text-2xl font-black italic uppercase tracking-tighter mb-1 border-l-4 border-indigo-500 pl-4 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>全链路决策图谱</h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3rem]">Decision Support & Traceability</p>
            </div>
         </div>

         <div className="flex gap-3 pointer-events-auto items-start">
            {/* --- 项目上下文选择器：已从左侧移动至此 --- */}
            <div className={`p-1.5 h-12 rounded-2xl border flex items-center gap-3 backdrop-blur-md shadow-lg ${isLightMode ? 'bg-white/80 border-slate-200' : 'bg-slate-900/80 border-white/10'}`}>
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-indigo-200 shadow-lg">
                    <i className="fa-solid fa-folder-tree text-xs"></i>
                </div>
                <div className="flex flex-col min-w-0 pr-4">
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">当前课题模型切换</span>
                    <div className="relative group/select">
                        <select 
                            className={`bg-transparent text-[11px] font-black uppercase italic outline-none cursor-pointer pr-6 appearance-none truncate max-w-[240px] ${isLightMode ? 'text-slate-700' : 'text-indigo-200'}`}
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                        >
                            {projects.map(p => (
                                <option key={p.id} value={p.id} className={isLightMode ? 'text-slate-800' : 'bg-slate-900 text-white'}>
                                    {p.title}
                                </option>
                            ))}
                        </select>
                        <i className="fa-solid fa-chevron-down absolute right-0 top-1/2 -translate-y-1/2 text-[8px] text-slate-400 pointer-events-none transition-transform group-hover/select:translate-y-[-40%]"></i>
                    </div>
                </div>
                {activeProject && (
                    <div className="flex items-center gap-2 border-l border-slate-200/50 pl-3 mr-2">
                        <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase text-white bg-emerald-600 shadow-sm`}>TRL {activeProject.trl}</span>
                        <span className={`w-2 h-2 rounded-full ${activeProject.status === 'In Progress' ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`}></span>
                    </div>
                )}
            </div>

            {pathCost && showSuccessPath && (
                <div className={`px-4 py-2 h-12 rounded-xl backdrop-blur-md border animate-reveal flex flex-col justify-center ${isLightMode ? 'bg-emerald-50/80 border-emerald-200' : 'bg-emerald-900/50 border-emerald-500/30'}`}>
                    <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">累计路径成本</p>
                    <p className={`text-sm font-black ${isLightMode ? 'text-slate-800' : 'text-white'} leading-none`}>{pathCost.currency} {pathCost.total}</p>
                </div>
            )}
            <button 
                onClick={() => setShowSuccessPath(!showSuccessPath)}
                className={`px-4 py-2.5 h-12 rounded-xl text-[10px] font-black uppercase transition-all shadow-lg border active:scale-95 ${showSuccessPath ? 'bg-emerald-600 border-emerald-500 text-white' : isLightMode ? 'bg-white border-slate-200 text-slate-600' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
            >
                <i className="fa-solid fa-code-branch mr-2"></i> 成功路径追踪
            </button>
            <button 
                onClick={handleGenerateReport}
                className="px-6 py-2.5 h-12 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all active:scale-95 border border-indigo-50/50"
            >
                <i className="fa-solid fa-file-export mr-2"></i> 导出溯源报告
            </button>
         </div>
      </header>

      {/* 可视化主区域 */}
      <div 
        className={`flex-1 w-full h-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
         <svg ref={svgRef} className={`w-full h-full ${isLightMode ? 'bg-slate-50' : 'bg-slate-950'}`}>
            <defs>
                <marker id="arrow" markerWidth="10" markerHeight="10" refX="20" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L9,3 z" fill={isLightMode ? "#94a3b8" : "#475569"} />
                </marker>
                <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                {isLightMode && (
                    <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                        <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#e2e8f0" strokeWidth="1"/>
                    </pattern>
                )}
            </defs>
            {isLightMode && <rect width="100%" height="100%" fill="url(#grid)" />}

            <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
                {edges.map((e, i) => {
                    const s = nodes.find(n => n.id === e.source);
                    const t = nodes.find(n => n.id === e.target);
                    if (!s || !t) return null;
                    const isHighlighted = highlightedPath.has(s.id) && highlightedPath.has(t.id);
                    return (
                        <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} 
                            stroke={isHighlighted ? '#10b981' : isLightMode ? '#cbd5e1' : '#334155'} 
                            strokeWidth={isHighlighted ? 3 : 1.5}
                            markerEnd="url(#arrow)"
                            strokeDasharray={e.type === 'contradicts' ? '5,5' : '0'}
                            className="transition-all duration-500"
                        />
                    );
                })}

                {nodes.map(n => {
                    const isSelected = selectedNode?.id === n.id;
                    const isHighlighted = highlightedPath.has(n.id);
                    const color = getNodeColor(n.type, n.patentData?.riskLevel, n.status);
                    
                    return (
                        <g key={n.id} onClick={(e) => { e.stopPropagation(); handleNodeClick(n); }} className="cursor-pointer group transition-all duration-300">
                            {(isSelected || isHighlighted) && (
                                <circle cx={n.x} cy={n.y} r="28" fill="none" stroke={color} strokeWidth="1" opacity="0.5" className="animate-pulse" />
                            )}
                            {n.trlLevel && (
                                <circle cx={n.x} cy={n.y} r={24} fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray={`${(n.trlLevel/9)*150} 150`} transform={`rotate(-90 ${n.x} ${n.y})`} />
                            )}
                            <circle cx={n.x} cy={n.y} r={n.type === 'Project' ? 18 : 14} 
                                fill={n.status === 'failed' ? 'transparent' : isLightMode ? '#ffffff' : '#1e293b'}
                                stroke={color} strokeWidth={n.status === 'failed' ? 2 : 2}
                                strokeDasharray={n.status === 'failed' ? '4 2' : '0'}
                                filter={isSelected ? 'url(#glow)' : ''}
                            />
                            <circle cx={n.x} cy={n.y} r={6} fill={color} />
                            <text x={n.x} y={n.y + 28} textAnchor="middle" className={`text-[8px] font-black uppercase pointer-events-none select-none ${isLightMode ? 'fill-slate-600' : 'fill-slate-400'}`}>{n.label}</text>
                            <text x={n.x} y={n.y - 22} textAnchor="middle" className="fill-slate-500 text-[6px] font-black uppercase pointer-events-none tracking-widest">{getTypeDisplay(n.type)}</text>
                        </g>
                    );
                })}
            </g>
         </svg>
      </div>

      {/* 侧边信息面板 */}
      {selectedNode && (
          <div className={`absolute right-6 top-24 bottom-6 w-80 backdrop-blur-xl border rounded-[2.5rem] shadow-2xl p-6 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 ${isLightMode ? 'bg-white/90 border-slate-200' : 'bg-slate-900/90 border-white/10'}`}>
              <div className="flex justify-between items-start mb-6">
                  <div>
                      <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getNodeColor(selectedNode.type) }}></span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{getTypeDisplay(selectedNode.type)} 节点</span>
                      </div>
                      <h3 className={`text-xl font-black italic leading-tight ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{selectedNode.label}</h3>
                  </div>
                  <button onClick={() => setSelectedNode(null)} className="text-slate-500 hover:text-rose-500"><i className="fa-solid fa-times"></i></button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1">
                  {selectedNode.meta && (
                      <div className={`p-4 rounded-2xl ${isLightMode ? 'bg-slate-50' : 'bg-white/5'} border border-white/10`}>
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-widest border-b border-white/5 pb-1">节点元数据 (ATTRIBUTES)</p>
                          <div className="space-y-4">
                              {Object.entries(selectedNode.meta).map(([key, value]) => (
                                  <div key={key} className="flex flex-col">
                                      <span className="text-[8px] font-black text-indigo-400/80 uppercase tracking-wider mb-1">{key}</span>
                                      <div className={`text-[11px] font-medium leading-relaxed ${isLightMode ? 'text-slate-700' : 'text-slate-200'}`}>
                                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}

                  {selectedNode.type === 'Characterization' && selectedNode.charData && (
                      <div className="space-y-3">
                          <div className={`p-4 rounded-2xl ${isLightMode ? 'bg-slate-50' : 'bg-slate-800'} border border-indigo-100/30`}>
                              <p className="text-[9px] text-slate-400 uppercase mb-2 font-black tracking-widest">AI 深度分析结论</p>
                              <p className="text-[12px] text-indigo-600 font-bold italic leading-relaxed">{selectedNode.charData.analysisText}</p>
                          </div>
                          {selectedNode.charData.linkedLogId && (
                              <button 
                                  onClick={() => handleTraceLogClick(selectedNode.charData?.linkedLogId)}
                                  className={`w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all`}
                              >
                                  <i className="fa-solid fa-eye mr-2"></i> 查看原始实验记录
                              </button>
                          )}
                      </div>
                  )}

                  {selectedNode.type === 'Cost' && selectedNode.costData && (
                      <div className={`border p-6 rounded-[2rem] text-center ${isLightMode ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-900/20 border-emerald-500/30'}`}>
                          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3">单位成本影响评估</p>
                          <p className={`text-4xl font-black ${isLightMode ? 'text-slate-800' : 'text-white'} italic font-mono`}>{selectedNode.costData.currency} {selectedNode.costData.value}</p>
                          <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase">PER {selectedNode.costData.unit}</p>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default KnowledgeGraph;