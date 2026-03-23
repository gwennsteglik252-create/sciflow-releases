/**
 * CitationGraphView — 引用关系图谱
 * 
 * 功能：
 * 1. 力导向图可视化文献间的引用关系
 * 2. 基于 AI 分析自动提取/推断引用链
 * 3. 节点大小 = 被引次数（影响力）
 * 4. 交互：点击节点查看文献详情、拖动布局
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Literature } from '../../types';

interface CitationGraphViewProps {
  resources: Literature[];
  onSelectResource?: (id: string) => void;
  onAnalyzeRelations?: () => void;
  isAnalyzing?: boolean;
}

interface GraphNode {
  id: string;
  title: string;
  year: number;
  authors: string[];
  category: string;
  citations: number; // incoming citation count
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number; // fixed x (when dragging)
  fy?: number; // fixed y
  radius: number;
}

interface GraphLink {
  source: string;
  target: string;
  type: 'cites' | 'cited_by';
  confidence: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  '核心理论': '#6366f1', // indigo
  '工艺标准': '#10b981', // emerald
  '性能标杆': '#f59e0b', // amber
  '专利检索': '#ec4899', // pink
  '文献': '#6366f1',
  '专利': '#10b981',
  '商业竞品': '#f59e0b',
};

const DEFAULT_COLOR = '#64748b';

const CitationGraphView: React.FC<CitationGraphViewProps> = ({
  resources,
  onSelectResource,
  onAnalyzeRelations,
  isAnalyzing,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragNodeRef = useRef<string | null>(null);

  // ─── Build Graph Data ───────────────────────────────
  const { nodes, links } = useMemo(() => {
    const graphNodes: GraphNode[] = [];
    const graphLinks: GraphLink[] = [];

    // Build citation count map
    const citationCounts = new Map<string, number>();
    resources.forEach(r => {
      r.citationLinks?.forEach(link => {
        if (link.type === 'cites') {
          // Target is cited by this item → increment target's count
          const targetId = link.targetId || link.targetTitle;
          citationCounts.set(targetId, (citationCounts.get(targetId) || 0) + 1);
        }
      });
    });

    // Create nodes
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    
    resources.forEach((r, idx) => {
      const angle = (idx / resources.length) * Math.PI * 2;
      const radiusSpread = Math.min(dimensions.width, dimensions.height) * 0.3;
      const citations = citationCounts.get(r.id) || 0;
      
      graphNodes.push({
        id: r.id,
        title: r.title,
        year: r.year || new Date().getFullYear(),
        authors: r.authors || [],
        category: r.categories?.[0] || r.category || r.type || '文献',
        citations,
        x: cx + Math.cos(angle) * radiusSpread + (Math.random() - 0.5) * 50,
        y: cy + Math.sin(angle) * radiusSpread + (Math.random() - 0.5) * 50,
        vx: 0,
        vy: 0,
        radius: Math.max(12, Math.min(30, 12 + citations * 4)),
      });
    });

    // Create links from citationLinks
    resources.forEach(r => {
      r.citationLinks?.forEach(link => {
        if (link.targetId) {
          // Check if target exists in our resources
          const exists = resources.some(res => res.id === link.targetId);
          if (exists) {
            graphLinks.push({
              source: r.id,
              target: link.targetId,
              type: link.type,
              confidence: link.confidence,
            });
          }
        }
      });
    });

    return { nodes: graphNodes, links: graphLinks };
  }, [resources, dimensions]);

  // ─── Resize Observer ───────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // ─── Force Simulation ───────────────────────────────
  useEffect(() => {
    if (nodes.length === 0) return;

    const alpha = { value: 1.0 };
    const alphaDecay = 0.02;
    const alphaMin = 0.01;
    
    const tick = () => {
      if (alpha.value < alphaMin) return;
      alpha.value *= (1 - alphaDecay);

      // Force: Center attraction
      const cx = dimensions.width / 2;
      const cy = dimensions.height / 2;
      nodes.forEach(n => {
        if (n.fx !== undefined) { n.x = n.fx; n.y = n.fy!; return; }
        n.vx += (cx - n.x) * 0.001 * alpha.value;
        n.vy += (cy - n.y) * 0.001 * alpha.value;
      });

      // Force: Node repulsion (charge)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = nodes[i].radius + nodes[j].radius + 40;
          if (dist < minDist * 3) {
            const force = (200 / (dist * dist)) * alpha.value;
            const fx = dx / dist * force;
            const fy = dy / dist * force;
            if (nodes[i].fx === undefined) { nodes[i].vx -= fx; nodes[i].vy -= fy; }
            if (nodes[j].fx === undefined) { nodes[j].vx += fx; nodes[j].vy += fy; }
          }
        }
      }

      // Force: Link attraction
      links.forEach(link => {
        const source = nodes.find(n => n.id === link.source);
        const target = nodes.find(n => n.id === link.target);
        if (!source || !target) return;
        
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const idealDist = 150;
        const force = (dist - idealDist) * 0.005 * alpha.value;
        const fx = dx / dist * force;
        const fy = dy / dist * force;
        if (source.fx === undefined) { source.vx += fx; source.vy += fy; }
        if (target.fx === undefined) { target.vx -= fx; target.vy -= fy; }
      });

      // Apply velocity with damping
      nodes.forEach(n => {
        if (n.fx !== undefined) return;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
        
        // Boundary constraints
        const margin = n.radius + 10;
        n.x = Math.max(margin, Math.min(dimensions.width - margin, n.x));
        n.y = Math.max(margin, Math.min(dimensions.height - margin, n.y));
      });

      animationRef.current = requestAnimationFrame(tick);
    };

    // Reset alpha when nodes change
    alpha.value = 1.0;
    animationRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationRef.current);
  }, [nodes.length, links.length, dimensions]);

  // Force re-render loop
  const [, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame(f => f + 1), 32); // ~30fps
    return () => clearInterval(id);
  }, []);

  // ─── Drag Handlers ───────────────────────────────
  const handleMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    dragNodeRef.current = nodeId;
    setIsDragging(true);
    node.fx = node.x;
    node.fy = node.y;
  }, [nodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragNodeRef.current || !svgRef.current) return;
    
    const svgRect = svgRef.current.getBoundingClientRect();
    const node = nodes.find(n => n.id === dragNodeRef.current);
    if (!node) return;
    
    node.fx = e.clientX - svgRect.left;
    node.fy = e.clientY - svgRect.top;
  }, [isDragging, nodes]);

  const handleMouseUp = useCallback(() => {
    if (dragNodeRef.current) {
      const node = nodes.find(n => n.id === dragNodeRef.current);
      if (node) {
        node.fx = undefined;
        node.fy = undefined;
      }
    }
    dragNodeRef.current = null;
    setIsDragging(false);
  }, [nodes]);

  // ─── Get color for category ───────────────────────
  const getNodeColor = (cat: string) => CATEGORY_COLORS[cat] || DEFAULT_COLOR;

  // ─── Stats ───────────────────────────────────────
  const totalLinks = links.length;
  const avgCitations = nodes.length > 0
    ? (nodes.reduce((sum, n) => sum + n.citations, 0) / nodes.length).toFixed(1)
    : '0';
  const hasAnyLinks = resources.some(r => r.citationLinks && r.citationLinks.length > 0);

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/30">
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between shrink-0">
        <div>
          <h3 className="text-3xl font-black text-slate-800 uppercase italic tracking-tighter flex items-center gap-4 leading-none">
            <i className="fa-solid fa-diagram-project text-indigo-600 text-2xl"></i>
            引用关系图谱
          </h3>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.3rem] pl-12 mt-1">
            CITATION NETWORK GRAPH · {resources.length} 节点 · {totalLinks} 引用链
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Stats badges */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase border border-indigo-100">
              <i className="fa-solid fa-circle-nodes mr-1"></i> {resources.length} 文献
            </span>
            <span className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase border border-emerald-100">
              <i className="fa-solid fa-link mr-1"></i> {totalLinks} 引用
            </span>
            <span className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase border border-amber-100">
              <i className="fa-solid fa-chart-bar mr-1"></i> 均引 {avgCitations}
            </span>
          </div>
          
          {/* AI Analyze Button */}
          {onAnalyzeRelations && (
            <button
              onClick={onAnalyzeRelations}
              disabled={isAnalyzing || resources.length < 2}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase shadow-lg active:scale-95 transition-all disabled:opacity-30 hover:bg-black flex items-center gap-2"
            >
              {isAnalyzing ? (
                <i className="fa-solid fa-spinner animate-spin"></i>
              ) : (
                <i className="fa-solid fa-wand-magic-sparkles text-indigo-200"></i>
              )}
              {isAnalyzing ? 'AI 分析中...' : 'AI 分析引用关系'}
            </button>
          )}
        </div>
      </header>

      {/* Graph Canvas */}
      <div
        ref={containerRef}
        className="flex-1 mx-6 mb-6 rounded-[2rem] bg-white border border-slate-200 shadow-xl overflow-hidden relative"
      >
        {resources.length < 2 ? (
          /* Empty state */
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-4">
            <i className="fa-solid fa-diagram-project text-6xl opacity-20"></i>
            <p className="text-sm font-black uppercase tracking-widest">需要至少 2 篇文献才能生成图谱</p>
            <p className="text-[10px] font-bold text-slate-400">请先在档案库中添加文献</p>
          </div>
        ) : !hasAnyLinks ? (
          /* No links yet */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            {/* Show a preview graph even without links */}
            <svg
              ref={svgRef}
              width={dimensions.width}
              height={dimensions.height}
              className="absolute inset-0"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Background grid */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f1f5f9" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              
              {/* Unlinked nodes */}
              {nodes.map(node => {
                const isHovered = hoveredNode === node.id;
                const isSelected = selectedNode === node.id;
                const color = getNodeColor(node.category);
                
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onMouseDown={(e) => handleMouseDown(node.id, e)}
                    onClick={() => {
                      setSelectedNode(node.id === selectedNode ? null : node.id);
                      onSelectResource?.(node.id);
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Pulse ring for selected */}
                    {isSelected && (
                      <circle r={node.radius + 8} fill="none" stroke={color} strokeWidth="2" opacity="0.3">
                        <animate attributeName="r" from={node.radius + 4} to={node.radius + 16} dur="1.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite" />
                      </circle>
                    )}
                    
                    {/* Main circle */}
                    <circle
                      r={isHovered ? node.radius + 3 : node.radius}
                      fill={color}
                      opacity={isHovered || isSelected ? 1 : 0.7}
                      stroke="white"
                      strokeWidth={isSelected ? 3 : 2}
                      style={{ transition: 'r 0.2s, opacity 0.2s' }}
                    />
                    
                    {/* Year label inside */}
                    <text
                      textAnchor="middle"
                      dy="0.35em"
                      fontSize="8"
                      fontWeight="900"
                      fill="white"
                      style={{ pointerEvents: 'none' }}
                    >
                      {node.year}
                    </text>
                    
                    {/* Title label */}
                    {(isHovered || isSelected) && (
                      <foreignObject x={-100} y={node.radius + 6} width={200} height={60}>
                        <div className="text-center">
                          <p className="text-[9px] font-black text-slate-800 leading-tight line-clamp-2 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 shadow-lg border border-slate-100 inline-block">
                            {node.title.length > 50 ? node.title.substring(0, 50) + '...' : node.title}
                          </p>
                        </div>
                      </foreignObject>
                    )}
                  </g>
                );
              })}
            </svg>
            
            {/* Overlay prompt */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-reveal z-10">
              <i className="fa-solid fa-wand-magic-sparkles text-indigo-400"></i>
              <div>
                <p className="text-[11px] font-black uppercase">尚未分析引用关系</p>
                <p className="text-[9px] text-slate-400 font-medium">点击「AI 分析引用关系」按钮，自动识别文献间的引用链</p>
              </div>
            </div>
          </div>
        ) : (
          /* Full graph with links */
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="absolute inset-0"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Background grid */}
            <defs>
              <pattern id="grid2" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f1f5f9" strokeWidth="1" />
              </pattern>
              <marker id="arrowhead" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="6" markerHeight="5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
              </marker>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid2)" />

            {/* Links */}
            {links.map((link, idx) => {
              const source = nodes.find(n => n.id === link.source);
              const target = nodes.find(n => n.id === link.target);
              if (!source || !target) return null;
              
              const isRelated = hoveredNode === source.id || hoveredNode === target.id;
              
              // Calculate arrow endpoint accounting for node radius
              const dx = target.x - source.x;
              const dy = target.y - source.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const offsetX = (dx / dist) * target.radius;
              const offsetY = (dy / dist) * target.radius;
              
              return (
                <line
                  key={`link-${idx}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x - offsetX}
                  y2={target.y - offsetY}
                  stroke={isRelated ? '#6366f1' : '#cbd5e1'}
                  strokeWidth={isRelated ? 2 : 1}
                  strokeOpacity={link.confidence * (isRelated ? 1 : 0.6)}
                  markerEnd="url(#arrowhead)"
                  style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map(node => {
              const isHovered = hoveredNode === node.id;
              const isSelected = selectedNode === node.id;
              const isConnected = links.some(l => l.source === node.id || l.target === node.id);
              const color = getNodeColor(node.category);
              
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onMouseDown={(e) => handleMouseDown(node.id, e)}
                  onClick={() => {
                    setSelectedNode(node.id === selectedNode ? null : node.id);
                    onSelectResource?.(node.id);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {isSelected && (
                    <circle r={node.radius + 8} fill="none" stroke={color} strokeWidth="2" opacity="0.3">
                      <animate attributeName="r" from={node.radius + 4} to={node.radius + 16} dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  )}
                  
                  <circle
                    r={isHovered ? node.radius + 3 : node.radius}
                    fill={color}
                    opacity={isHovered || isSelected ? 1 : isConnected ? 0.85 : 0.5}
                    stroke="white"
                    strokeWidth={isSelected ? 3 : 2}
                    style={{ transition: 'r 0.2s, opacity 0.2s' }}
                  />
                  
                  {/* Citation count badge */}
                  {node.citations > 0 && (
                    <>
                      <circle cx={node.radius * 0.7} cy={-node.radius * 0.7} r="7" fill="#ef4444" stroke="white" strokeWidth="1.5" />
                      <text x={node.radius * 0.7} y={-node.radius * 0.7} textAnchor="middle" dy="0.35em" fontSize="7" fontWeight="900" fill="white" style={{ pointerEvents: 'none' }}>
                        {node.citations}
                      </text>
                    </>
                  )}
                  
                  <text textAnchor="middle" dy="0.35em" fontSize="8" fontWeight="900" fill="white" style={{ pointerEvents: 'none' }}>
                    {node.year}
                  </text>
                  
                  {(isHovered || isSelected) && (
                    <foreignObject x={-120} y={node.radius + 6} width={240} height={80}>
                      <div className="text-center">
                        <div className="bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 shadow-2xl border border-slate-100 inline-block text-left max-w-[230px]">
                          <p className="text-[9px] font-black text-slate-800 leading-tight line-clamp-2 italic">
                            {node.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[7px] font-bold text-slate-400">{node.authors[0] || 'Unknown'}</span>
                            <span className="text-[7px] font-black px-1.5 py-0.5 rounded" style={{ backgroundColor: color + '20', color }}>{node.category}</span>
                          </div>
                        </div>
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl p-3 border border-slate-100 shadow-md">
          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-2">图例</p>
          <div className="flex flex-col gap-1.5">
            {Object.entries(CATEGORY_COLORS).slice(0, 4).map(([cat, color]) => (
              <div key={cat} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                <span className="text-[8px] font-bold text-slate-600">{cat}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-100">
              <div className="w-6 h-0 border-t-2 border-slate-300"></div>
              <span className="text-[8px] font-bold text-slate-500">→ 引用关系</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500 flex items-center justify-center">
                <span className="text-[5px] text-white font-black">n</span>
              </div>
              <span className="text-[8px] font-bold text-slate-500">被引次数</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CitationGraphView;
