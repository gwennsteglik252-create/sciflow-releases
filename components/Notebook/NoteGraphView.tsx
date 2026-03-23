/**
 * NoteGraphView — 知识图谱视图
 * 基于 Canvas 的力导向布局，可视化笔记之间的 linkedNoteIds 关系
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { NotebookNote, NoteType } from '../../types/notebook';

const TYPE_COLORS: Record<NoteType, string> = {
  thought: '#a855f7',
  meeting: '#f59e0b',
  reading: '#22c55e',
  experiment: '#3b82f6',
  idea: '#ec4899',
};

interface GraphNode {
  id: string;
  title: string;
  type: NoteType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  linkCount: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

interface NoteGraphViewProps {
  notes: NotebookNote[];
  isLight: boolean;
  onSelectNote: (note: NotebookNote) => void;
}

const NoteGraphView: React.FC<NoteGraphViewProps> = ({ notes, isLight, onSelectNote }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ w: 800, h: 500 });

  // Build graph data
  useEffect(() => {
    const cx = dimensions.w / 2;
    const cy = dimensions.h / 2;

    const nodes: GraphNode[] = notes.map((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(notes.length, 1);
      const radius = Math.min(dimensions.w, dimensions.h) * 0.3;
      return {
        id: n.id,
        title: n.title,
        type: n.type,
        x: cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 40,
        y: cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        linkCount: n.linkedNoteIds.length,
      };
    });

    const edges: GraphEdge[] = [];
    const edgeSet = new Set<string>();
    notes.forEach(n => {
      n.linkedNoteIds.forEach(lid => {
        const key = [n.id, lid].sort().join('::');
        if (!edgeSet.has(key) && nodes.find(nd => nd.id === lid)) {
          edgeSet.add(key);
          edges.push({ source: n.id, target: lid });
        }
      });
    });

    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [notes, dimensions]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Physics simulation + render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.w * dpr;
    canvas.height = dimensions.h * dpr;
    ctx.scale(dpr, dpr);

    let running = true;
    const cx = dimensions.w / 2;
    const cy = dimensions.h / 2;

    const tick = () => {
      if (!running) return;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;

      // === Force simulation ===
      // Repulsion (nodes push each other away)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          let dx = nodes[j].x - nodes[i].x;
          let dy = nodes[j].y - nodes[i].y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const repulse = 2000 / (dist * dist);
          const fx = (dx / dist) * repulse;
          const fy = (dy / dist) * repulse;
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }

      // Attraction (edges pull connected nodes together)
      edges.forEach(e => {
        const s = nodes.find(n => n.id === e.source);
        const t = nodes.find(n => n.id === e.target);
        if (!s || !t) return;
        let dx = t.x - s.x;
        let dy = t.y - s.y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const attract = (dist - 120) * 0.005;
        const fx = (dx / dist) * attract;
        const fy = (dy / dist) * attract;
        s.vx += fx;
        s.vy += fy;
        t.vx -= fx;
        t.vy -= fy;
      });

      // Center gravity
      nodes.forEach(n => {
        n.vx += (cx - n.x) * 0.001;
        n.vy += (cy - n.y) * 0.001;
        // Damping
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
        // Bounds
        n.x = Math.max(30, Math.min(dimensions.w - 30, n.x));
        n.y = Math.max(30, Math.min(dimensions.h - 30, n.y));
      });

      // === Render ===
      ctx.clearRect(0, 0, dimensions.w, dimensions.h);

      // Draw edges
      edges.forEach(e => {
        const s = nodes.find(n => n.id === e.source);
        const t = nodes.find(n => n.id === e.target);
        if (!s || !t) return;
        const isHighlighted = hoveredId && (s.id === hoveredId || t.id === hoveredId);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = isHighlighted
          ? (isLight ? 'rgba(99,102,241,0.6)' : 'rgba(129,140,248,0.6)')
          : (isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)');
        ctx.lineWidth = isHighlighted ? 2 : 1;
        ctx.stroke();
      });

      // Draw nodes
      nodes.forEach(n => {
        const isHovered = n.id === hoveredId;
        const isConnected = hoveredId && edges.some(e =>
          (e.source === hoveredId && e.target === n.id) ||
          (e.target === hoveredId && e.source === n.id)
        );
        const baseRadius = 8 + Math.min(n.linkCount * 3, 15);
        const radius = isHovered ? baseRadius + 4 : baseRadius;
        const color = TYPE_COLORS[n.type] || '#6366f1';

        // Glow
        if (isHovered || isConnected) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, radius + 6, 0, Math.PI * 2);
          ctx.fillStyle = color + '30';
          ctx.fill();
        }

        // Circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        const dimmed = hoveredId && !isHovered && !isConnected;
        ctx.fillStyle = dimmed ? (color + '40') : color;
        ctx.fill();

        // Border
        ctx.strokeStyle = isHovered ? '#fff' : (isLight ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)');
        ctx.lineWidth = isHovered ? 2.5 : 1;
        ctx.stroke();

        // Label
        const label = n.title.length > 12 ? n.title.slice(0, 12) + '…' : n.title;
        ctx.font = `${isHovered ? 'bold ' : ''}10px -apple-system, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = dimmed
          ? (isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)')
          : (isLight ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)');
        ctx.fillText(label, n.x, n.y + radius + 14);
      });

      animRef.current = requestAnimationFrame(tick);
    };

    tick();
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [dimensions, hoveredId, isLight]);

  // Mouse interaction
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const found = nodesRef.current.find(n => {
      const r = 8 + Math.min(n.linkCount * 3, 15);
      return (mx - n.x) ** 2 + (my - n.y) ** 2 < (r + 8) ** 2;
    });

    setHoveredId(found?.id || null);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = found ? 'pointer' : 'default';
    }
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const found = nodesRef.current.find(n => {
      const r = 8 + Math.min(n.linkCount * 3, 15);
      return (mx - n.x) ** 2 + (my - n.y) ** 2 < (r + 8) ** 2;
    });

    if (found) {
      const note = notes.find(n => n.id === found.id);
      if (note) onSelectNote(note);
    }
  }, [notes, onSelectNote]);

  // Empty state
  if (notes.length === 0 || edgesRef.current.length === 0 && notes.every(n => n.linkedNoteIds.length === 0)) {
    return (
      <div className={`flex flex-col items-center justify-center py-20 rounded-3xl border ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.05]'}`}>
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-500/20 to-indigo-500/10 flex items-center justify-center mb-4">
          <i className={`fa-solid fa-diagram-project text-2xl ${isLight ? 'text-violet-400' : 'text-violet-500/60'}`} />
        </div>
        <h3 className={`text-sm font-black uppercase tracking-widest mb-2 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
          暂无链接关系
        </h3>
        <p className={`text-[10px] font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
          在编辑笔记时，通过「双向链接」功能关联其他笔记，图谱将自动生成
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative w-full rounded-3xl border overflow-hidden ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.05]'}`} style={{ height: '65vh', minHeight: 400 }}>
      {/* Legend */}
      <div className={`absolute top-4 left-4 z-10 flex flex-wrap gap-2 ${isLight ? '' : ''}`}>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className={`text-[8px] font-bold uppercase ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              {type === 'thought' ? '灵感' : type === 'meeting' ? '会议' : type === 'reading' ? '阅读' : type === 'experiment' ? '实验' : '想法'}
            </span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className={`absolute top-4 right-4 z-10 text-[8px] font-bold ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>
        {notes.length} 节点 · {edgesRef.current.length} 连接
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ width: dimensions.w, height: dimensions.h }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredId(null)}
        onClick={handleClick}
      />
    </div>
  );
};

export default NoteGraphView;
