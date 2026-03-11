/**
 * SankeyCanvas.tsx
 * ─────────────────────────────────────────────────────────────────
 * 桑基图 SVG 渲染组件（纯展示层，无业务状态）
 *
 * 功能：
 *  - 调用 computeSankeyLayout 计算布局
 *  - 渲染节点矩形 + 标签
 *  - 渲染连线流带（bezier / linear / step）
 *  - 支持 hover 交互：高亮连线/节点
 *  - 支持 zoom & pan（双指/滚轮缩放、拖拽平移）
 *  - 通过 containerRef 挂载供导出 PNG 使用
 */

import React, {
    useRef, useState, useCallback, useEffect, useMemo,
} from 'react';
import { SankeyData } from '../../../types/visuals';
import {
    computeSankeyLayout,
    buildSankeyLinkPath,
    formatSankeyValue,
    ComputedSankeyNode,
    ComputedSankeyLink,
} from './sankeyLayout';

// ─── 画布内边距（px） ───────────────────────────────────────────────────────
const PAD = { top: 40, right: 120, bottom: 30, left: 120 };

// ─── Props ─────────────────────────────────────────────────────────────────
export interface SankeyCanvasProps {
    data: SankeyData | null;
    containerRef: React.RefObject<HTMLDivElement>;
    zoom: number;
    setZoom: (z: number) => void;
    /** 选中节点回调 */
    onSelectNode?: (nodeId: string | null) => void;
    selectedNodeId?: string | null;
    /** 撤销/重做 */
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    /** 双击标题回调 */
    onEditTitle?: () => void;
}

// ─── 环形布局辅助函数 ───
const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";
    return [
        "M", start.x, start.y,
        "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
};

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInRadians: number) => ({
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
});

const describeRibbon = (cx: number, cy: number, r: number, sStart: number, sEnd: number, tStart: number, tEnd: number) => {
    const p1 = polarToCartesian(cx, cy, r, sStart); // 源弧起点
    const p2 = polarToCartesian(cx, cy, r, sEnd);   // 源弧终点
    const p3 = polarToCartesian(cx, cy, r, tStart); // 目标弧起点
    const p4 = polarToCartesian(cx, cy, r, tEnd);   // 目标弧终点

    // large-arc 标志
    const sLargeArc = Math.abs(sEnd - sStart) > Math.PI ? 1 : 0;
    const tLargeArc = Math.abs(tEnd - tStart) > Math.PI ? 1 : 0;

    // 控制点向圆心收缩的比例（0=保持原位，1=在圆心）
    // 0.4 → 控制点在从端点到圆心 40% 处，曲线弯向中心但不穿越中心
    // 这避免了所有 ribbon 都汇聚到同一点造成 X 形交叉
    // 0.35 → 控制点在从端点到圆心 35% 处，曲线更柔和
    const tension = 0.35;

    // 曲线 1: p2(源弧终点) → p3(目标弧起点)
    const c1x = p2.x + (cx - p2.x) * tension;
    const c1y = p2.y + (cy - p2.y) * tension;
    const c2x = p3.x + (cx - p3.x) * tension;
    const c2y = p3.y + (cy - p3.y) * tension;

    // 曲线 2: p4(目标弧终点) → p1(源弧起点)
    const c3x = p4.x + (cx - p4.x) * tension;
    const c3y = p4.y + (cy - p4.y) * tension;
    const c4x = p1.x + (cx - p1.x) * tension;
    const c4y = p1.y + (cy - p1.y) * tension;

    return [
        `M ${p1.x} ${p1.y}`,
        `A ${r} ${r} 0 ${sLargeArc} 1 ${p2.x} ${p2.y}`,
        `C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p3.x} ${p3.y}`,
        `A ${r} ${r} 0 ${tLargeArc} 1 ${p4.x} ${p4.y}`,
        `C ${c3x} ${c3y}, ${c4x} ${c4y}, ${p1.x} ${p1.y}`,
        `Z`
    ].join(" ");
};

// ─── 组件 ──────────────────────────────────────────────────────────────────
export const SankeyCanvas: React.FC<SankeyCanvasProps> = ({
    data,
    containerRef,
    zoom,
    setZoom,
    onSelectNode,
    selectedNodeId,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    onEditTitle,
}) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const [wrapSize, setWrapSize] = useState({ w: 900, h: 520 });
    const panRef = useRef({ x: 0, y: 0 });
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);

    // 拖拽平移状态
    const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
    const rafRef = useRef<number>(0);

    // ── 直接更新 SVG transform（绕过 React 渲染） ──────────────────────────
    const applyTransform = useCallback(() => {
        if (!svgRef.current) return;
        const p = panRef.current;
        svgRef.current.style.transform = `translate(${p.x}px, ${p.y}px) scale(${zoom})`;
    }, [zoom]);

    // zoom 变化时同步 transform
    useEffect(() => { applyTransform(); }, [zoom, applyTransform]);

    // ── 响应容器尺寸变化 ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!wrapRef.current) return;
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setWrapSize({ w: Math.max(width, 400), h: Math.max(height, 300) });
            }
        });
        ro.observe(wrapRef.current);
        return () => ro.disconnect();
    }, []);

    // ── 计算布局 ──────────────────────────────────────────────────────────────
    const svgW = wrapSize.w;
    const svgH = wrapSize.h;
    const layoutW = svgW - PAD.left - PAD.right;
    const layoutH = svgH - PAD.top - PAD.bottom;

    const layout = useMemo(() => {
        if (!data || !data.nodes.length || !data.links.length) return null;
        return computeSankeyLayout(data, {
            width: layoutW,
            height: layoutH,
            nodeWidth: data.nodeWidth ?? 16,
            nodePadding: data.nodePadding ?? 12,
            alignment: data.alignment ?? 'justify',
        });
    }, [data, layoutW, layoutH]);

    // ── 滚轮：双指滑动→平移，Ctrl/Cmd+滚轮→缩放 ─────────────────────────────
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
            // 捏合缩放 或 Ctrl+滚轮 → 缩放
            const delta = e.deltaY > 0 ? 0.95 : 1.05;
            setZoom(Math.min(Math.max(zoom * delta, 0.3), 4));
        } else {
            // 双指滑动 → 直接操作 DOM，不触发 React 渲染
            panRef.current = {
                x: panRef.current.x - e.deltaX,
                y: panRef.current.y - e.deltaY,
            };
            cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(applyTransform);
        }
    }, [zoom, setZoom, applyTransform]);

    // ── 快捷键：Cmd+Z 撤销, Cmd+Shift+Z 重做 ────────────────────────────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!(e.metaKey || e.ctrlKey)) return;
            if (e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                onUndo?.();
            } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
                e.preventDefault();
                onRedo?.();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onUndo, onRedo]);

    // ── 拖拽平移（也使用 ref） ──────────────────────────────────────────────
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        dragRef.current = { startX: e.clientX, startY: e.clientY, panX: panRef.current.x, panY: panRef.current.y };
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!dragRef.current) return;
        panRef.current = {
            x: dragRef.current.panX + (e.clientX - dragRef.current.startX),
            y: dragRef.current.panY + (e.clientY - dragRef.current.startY),
        };
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(applyTransform);
    }, [applyTransform]);

    const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);

    // 高亮集合（节点 hover → 关联连线高亮）── 必须在 early return 之前
    const highlightedLinkIds = useMemo<Set<string>>(() => {
        const set = new Set<string>();
        if (!layout) return set;
        if (hoveredNodeId) {
            layout.links.forEach(l => {
                if (l.source.id === hoveredNodeId || l.target.id === hoveredNodeId) {
                    set.add(l.id);
                }
            });
        }
        if (hoveredLinkId) set.add(hoveredLinkId);
        return set;
    }, [hoveredNodeId, hoveredLinkId, layout]);

    const hasHighlight = highlightedLinkIds.size > 0;

    // ── 空状态 ────────────────────────────────────────────────────────────────
    if (!data || !layout) {
        return (
            <div
                ref={wrapRef}
                className="flex-1 flex flex-col items-center justify-center h-full rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400"
            >
                <div className="w-20 h-20 rounded-[2.5rem] bg-white shadow-sm flex items-center justify-center mb-6">
                    <i className="fa-solid fa-diagram-sankey text-3xl opacity-30" />
                </div>
                <p className="text-sm font-black uppercase tracking-widest">请在左侧输入主题并生成桑基图</p>
            </div>
        );
    }

    const curveType = data.curveType ?? 'bezier';
    const showValues = data.showValues ?? true;
    const unit = data.valueUnit ?? '';
    const bgColor = data.backgroundColor ?? '#ffffff';
    const labelStyle = data.labelStyle ?? {};

    return (
        <div
            ref={wrapRef}
            className="flex-1 relative overflow-hidden select-none group"
            style={{ background: bgColor, borderRadius: 16, boxShadow: '0 4px 32px rgba(0,0,0,0.12)' }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* ── Floating Undo/Redo Controls (左上角，参考结构图) ── */}
            <div className="absolute top-4 left-4 z-[100] flex items-center gap-2 no-print">
                <div className="flex bg-white/90 backdrop-blur-md rounded-2xl shadow-xl px-2 py-1 border border-slate-200 items-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); onUndo?.(); }}
                        disabled={!canUndo}
                        className="w-10 h-10 flex flex-col items-center justify-center text-slate-400 hover:text-amber-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                        title="撤销 (⌘Z)"
                    >
                        <i className="fa-solid fa-rotate-left text-xs mb-0.5"></i>
                        <span className="text-[7px] font-black uppercase">Undo</span>
                    </button>
                    <div className="w-px h-6 bg-slate-100 mx-1"></div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onRedo?.(); }}
                        disabled={!canRedo}
                        className="w-10 h-10 flex flex-col items-center justify-center text-slate-400 hover:text-amber-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                        title="重做 (⌘⇧Z)"
                    >
                        <i className="fa-solid fa-rotate-right text-xs mb-0.5"></i>
                        <span className="text-[7px] font-black uppercase">Redo</span>
                    </button>
                </div>
            </div>

            {/* ── Floating Zoom Controls (右上角，参考结构图) ── */}
            <div className="absolute top-4 right-4 z-[100] flex items-center gap-2 no-print opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex bg-white/90 backdrop-blur-md rounded-2xl shadow-xl px-2 py-1 border border-slate-200 items-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); setZoom(Math.max(0.3, zoom - 0.1)); }}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors active:scale-90"
                        title="缩小"
                    >
                        <i className="fa-solid fa-minus text-[10px]"></i>
                    </button>
                    <div className="w-px h-4 bg-slate-100 mx-1"></div>
                    <button
                        onClick={(e) => { e.stopPropagation(); setZoom(1); panRef.current = { x: 0, y: 0 }; applyTransform(); }}
                        className="flex flex-col items-center justify-center hover:bg-indigo-50 px-2 py-1 rounded-lg transition-all active:scale-95"
                        title="复位视图"
                    >
                        <span className="text-[11px] font-black text-slate-800 font-mono leading-none">{Math.round(zoom * 100)}%</span>
                        <i className="fa-solid fa-compress text-[8px] text-indigo-400 mt-0.5"></i>
                    </button>
                    <div className="w-px h-4 bg-slate-100 mx-1"></div>
                    <button
                        onClick={(e) => { e.stopPropagation(); setZoom(Math.min(4, zoom + 0.1)); }}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors active:scale-90"
                        title="放大"
                    >
                        <i className="fa-solid fa-plus text-[10px]"></i>
                    </button>
                </div>
            </div>

            {/* ─── 导出用容器（ref 挂这里，截图时包含 padding bg） ─── */}
            <div ref={containerRef} style={{ width: '100%', height: '100%', background: bgColor, overflow: 'visible' }}>
                <svg
                    ref={svgRef}
                    width={svgW}
                    height={svgH}
                    overflow="visible"
                    style={{
                        transform: `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                        cursor: 'grab',
                        willChange: 'transform',
                        display: 'block',
                    }}
                >
                    <defs>
                        {layout.links.map(l => (
                            <linearGradient
                                key={`grad_${l.id}`}
                                id={`grad_${l.id}`}
                                x1="0%" y1="0%" x2="100%" y2="0%"
                            >
                                <stop offset="0%" stopColor={l.source.color} stopOpacity={l.opacity} />
                                <stop offset="100%" stopColor={l.target.color} stopOpacity={l.opacity} />
                            </linearGradient>
                        ))}
                    </defs>

                    {data.layoutMode === 'chord' ? (() => {
                        const chordRadius = Math.min(svgW, svgH) * (data.chordRadius ?? 0.35);
                        const chordArcWidth = data.chordArcWidth ?? 12;
                        const chordInnerOffset = data.chordInnerOffset ?? (chordArcWidth / 2);
                        const chordLinkOpacity = data.chordLinkOpacity ?? 0.25;
                        const chordLabelOffset = data.chordLabelOffset ?? 25;
                        return (
                            <g transform={`translate(${svgW / 2}, ${svgH / 2})`}>
                                {/* ── 环形连线层 ── */}
                                {layout.links.map(link => {
                                    const isHl = highlightedLinkIds.has(link.id);
                                    const dimmed = hasHighlight && !isHl;
                                    const pathD = describeRibbon(0, 0, chordRadius - chordInnerOffset, link.sourceStartAngle!, link.sourceEndAngle!, link.targetStartAngle!, link.targetEndAngle!);
                                    return (
                                        <path
                                            key={link.id}
                                            d={pathD}
                                            fill={link.color}
                                            opacity={dimmed ? 0.05 : isHl ? 0.8 : chordLinkOpacity}
                                            style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                                            onMouseEnter={() => setHoveredLinkId(link.id)}
                                            onMouseLeave={() => setHoveredLinkId(null)}
                                        />
                                    );
                                })}

                                {/* ── 环形节点层 ── */}
                                {layout.nodes.map(node => {
                                    const isSelected = selectedNodeId === node.id;
                                    const isHovered = hoveredNodeId === node.id;
                                    const pathD = describeArc(0, 0, chordRadius, node.startAngle!, node.endAngle!);
                                    const labelAngle = (node.startAngle! + node.endAngle!) / 2;
                                    const labelPos = polarToCartesian(0, 0, chordRadius + chordLabelOffset, labelAngle);

                                    return (
                                        <g key={node.id}
                                            onClick={() => onSelectNode?.(isSelected ? null : node.id)}
                                            onMouseEnter={() => setHoveredNodeId(node.id)}
                                            onMouseLeave={() => setHoveredNodeId(null)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <path
                                                d={pathD}
                                                fill="none"
                                                stroke={node.color}
                                                strokeWidth={isSelected ? chordArcWidth + 4 : chordArcWidth}
                                                strokeOpacity={isHovered || isSelected ? 1 : 0.8}
                                                style={{ transition: 'all 0.3s' }}
                                            />
                                            <text
                                                x={labelPos.x}
                                                y={labelPos.y}
                                                textAnchor={labelPos.x > 0 ? 'start' : 'end'}
                                                dominantBaseline="middle"
                                                fontSize={node.raw.style?.fontSize || labelStyle.fontSize || 11}
                                                fontWeight={node.raw.style?.fontWeight || "600"}
                                                fontFamily={node.raw.style?.fontFamily || labelStyle.fontFamily || 'Inter, sans-serif'}
                                                fill={isSelected ? node.color : node.raw.style?.color || "#475569"}
                                                style={{
                                                    fontStyle: node.raw.style?.fontStyle || 'normal',
                                                }}
                                            >
                                                {node.label}
                                            </text>
                                            {/* 流量数值 */}
                                            {showValues && (
                                                <text
                                                    x={labelPos.x}
                                                    y={labelPos.y + (node.raw.style?.fontSize || labelStyle.fontSize || 11) + 2}
                                                    textAnchor={labelPos.x > 0 ? 'start' : 'end'}
                                                    dominantBaseline="middle"
                                                    fontSize={data.valueStyle?.fontSize ?? 10}
                                                    fontFamily={data.valueStyle?.fontFamily || labelStyle.fontFamily || 'Inter, sans-serif'}
                                                    fontWeight={data.valueStyle?.fontWeight || '400'}
                                                    fill={data.valueStyle?.color || '#94a3b8'}
                                                    opacity={data.valueStyle?.opacity ?? 1}
                                                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                                                >
                                                    {formatSankeyValue(Math.max(node.inFlow, node.outFlow), unit)}
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}
                            </g>
                        );
                    })() : (
                        <g transform={`translate(${PAD.left}, ${PAD.top})`}>
                            {/* ── 连线层 ── */}
                            {layout.links.map(link => {
                                const isHl = highlightedLinkIds.has(link.id);
                                const dimmed = hasHighlight && !isHl;
                                const pathD = buildSankeyLinkPath(link, curveType as any);
                                return (
                                    <g key={link.id}>
                                        <path
                                            d={pathD}
                                            fill={`url(#grad_${link.id})`}
                                            opacity={dimmed ? 0.08 : isHl ? 0.75 : link.opacity}
                                            stroke="none"
                                            style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                                            onMouseEnter={() => setHoveredLinkId(link.id)}
                                            onMouseLeave={() => setHoveredLinkId(null)}
                                        />
                                        {/* 连线中点标签（hover 时显示） */}
                                        {(isHl || link.highlight) && (
                                            <text
                                                x={(link.source.x + link.source.width + link.target.x) / 2}
                                                y={(link.sy0 + link.sy1 + link.ty0 + link.ty1) / 4}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fontSize={11}
                                                fontFamily={labelStyle.fontFamily || 'Inter, sans-serif'}
                                                fill={link.source.color}
                                                fontWeight="600"
                                                style={{ pointerEvents: 'none', userSelect: 'none' }}
                                            >
                                                {link.label
                                                    ? `${link.label}: ${formatSankeyValue(link.value, unit)}`
                                                    : formatSankeyValue(link.value, unit)}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}

                            {/* ── 节点层 ── */}
                            {layout.nodes.map(node => {
                                const isSelected = selectedNodeId === node.id;
                                const isHovered = hoveredNodeId === node.id;
                                const dimmed = hasHighlight && !highlightedLinkIds.has('') &&
                                    !layout.links.some(l =>
                                        highlightedLinkIds.has(l.id) &&
                                        (l.source.id === node.id || l.target.id === node.id)
                                    ) && hoveredNodeId !== null && hoveredNodeId !== node.id;

                                // 标签侧：最后一列 → 右侧标签；其他 → 左侧标签
                                const isLastCol = node.column === layout.columnCount - 1;
                                const rawLabelSide = node.raw.labelSide ?? 'auto';
                                const labelOnRight = rawLabelSide === 'right' ||
                                    (rawLabelSide === 'auto' && isLastCol);

                                return (
                                    <g
                                        key={node.id}
                                        style={{ cursor: 'pointer', transition: 'opacity 0.2s', opacity: dimmed ? 0.25 : 1 }}
                                        onMouseEnter={() => setHoveredNodeId(node.id)}
                                        onMouseLeave={() => setHoveredNodeId(null)}
                                        onClick={() => onSelectNode?.(isSelected ? null : node.id)}
                                    >
                                        {/* 节点矩形 */}
                                        <rect
                                            x={node.x}
                                            y={node.y}
                                            width={node.width}
                                            height={Math.max(node.height, 2)}
                                            rx={data.nodeCornerRadius ?? 3}
                                            fill={node.color}
                                            opacity={isHovered || isSelected ? 1 : 0.9}
                                            stroke={isSelected ? '#fff' : 'none'}
                                            strokeWidth={isSelected ? 2 : 0}
                                            className={isSelected ? 'selected-node' : ''}
                                            style={{ transition: 'opacity 0.15s' }}
                                        />
                                        <style>{`
                                        @keyframes pulse-select {
                                            0% { stroke-width: 2; opacity: 1; }
                                            50% { stroke-width: 4; opacity: 0.7; }
                                            100% { stroke-width: 2; opacity: 1; }
                                        }
                                        .selected-node {
                                            animation: pulse-select 2s infinite ease-in-out;
                                        }
                                    `}</style>

                                        {/* 节点标签 */}
                                        {!node.raw.hideLabel && (
                                            <text
                                                x={labelOnRight
                                                    ? node.x + node.width + 8
                                                    : node.x - 8}
                                                y={node.y + node.height / 2}
                                                textAnchor={labelOnRight ? 'start' : 'end'}
                                                dominantBaseline="middle"
                                                fontSize={node.raw.style?.fontSize || labelStyle.fontSize || 12}
                                                fontFamily={node.raw.style?.fontFamily || labelStyle.fontFamily || 'Inter, sans-serif'}
                                                fontWeight={isHovered || isSelected
                                                    ? '700'
                                                    : node.raw.style?.fontWeight || labelStyle.fontWeight || '500'}
                                                fill={node.raw.style?.color || labelStyle.color || '#1e293b'}
                                                style={{
                                                    pointerEvents: 'none',
                                                    userSelect: 'none',
                                                    fontStyle: node.raw.style?.fontStyle || 'normal',
                                                }}
                                            >
                                                {node.label}
                                            </text>
                                        )}

                                        {/* 节点图标 (如果存在) */}
                                        {node.raw.icon && (
                                            <foreignObject
                                                x={node.x + (node.width - 12) / 2}
                                                y={node.y + (node.height - 12) / 2}
                                                width={12}
                                                height={12}
                                                style={{ pointerEvents: 'none' }}
                                            >
                                                <div
                                                    // @ts-ignore
                                                    xmlns="http://www.w3.org/1999/xhtml"
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: '#fff',
                                                        fontSize: '8px',
                                                    }}
                                                >
                                                    <i className={node.raw.icon}></i>
                                                </div>
                                            </foreignObject>
                                        )}

                                        {/* 流量数值 */}
                                        {showValues && (
                                            <text
                                                x={labelOnRight
                                                    ? node.x + node.width + 8
                                                    : node.x - 8}
                                                y={node.y + node.height / 2 + 14}
                                                textAnchor={labelOnRight ? 'start' : 'end'}
                                                dominantBaseline="middle"
                                                fontSize={data.valueStyle?.fontSize ?? 10}
                                                fontFamily={data.valueStyle?.fontFamily || node.raw.style?.fontFamily || labelStyle.fontFamily || 'Inter, sans-serif'}
                                                fontWeight={data.valueStyle?.fontWeight || '400'}
                                                fill={data.valueStyle?.color || '#94a3b8'}
                                                opacity={data.valueStyle?.opacity ?? 1}
                                                style={{ pointerEvents: 'none', userSelect: 'none' }}
                                            >
                                                {formatSankeyValue(Math.max(node.inFlow, node.outFlow), unit)}
                                            </text>
                                        )}

                                        {/* Tooltip（hover 时显示 description） */}
                                        {isHovered && node.description && (
                                            <foreignObject
                                                x={labelOnRight ? node.x + node.width + 8 : node.x - 200}
                                                y={node.y + node.height + 6}
                                                width={190}
                                                height={60}
                                                style={{ pointerEvents: 'none' }}
                                            >
                                                <div
                                                    // @ts-ignore
                                                    xmlns="http://www.w3.org/1999/xhtml"
                                                    style={{
                                                        background: 'rgba(15,17,23,0.92)',
                                                        color: '#e2e8f0',
                                                        fontSize: 11,
                                                        borderRadius: 8,
                                                        padding: '6px 10px',
                                                        backdropFilter: 'blur(8px)',
                                                        lineHeight: 1.5,
                                                        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                                                        wordBreak: 'break-all',
                                                    }}
                                                >
                                                    {node.description}
                                                </div>
                                            </foreignObject>
                                        )}
                                    </g>
                                );
                            })}

                        </g>
                    )}

                    {/* ── 标题（居中显示在顶部） ── */}
                    {!data.titleStyle?.hidden && (
                        <text
                            x={svgW / 2}
                            y={(PAD.top - 10) + (data.titleStyle?.offsetY ?? 0)}
                            textAnchor="middle"
                            fontSize={data.titleStyle?.fontSize ?? 13}
                            fontFamily={data.titleStyle?.fontFamily || 'Inter, sans-serif'}
                            fontWeight={data.titleStyle?.fontWeight || '600'}
                            fill={data.titleStyle?.color || '#64748b'}
                            opacity={data.titleStyle?.opacity ?? 1}
                            letterSpacing={data.titleStyle?.letterSpacing ?? 0}
                            textDecoration={data.titleStyle?.textDecoration || 'none'}
                            style={{ userSelect: 'none', fontStyle: data.titleStyle?.fontStyle || 'normal', cursor: 'pointer' }}
                            onDoubleClick={(e) => { e.stopPropagation(); onEditTitle?.(); }}
                        >
                            {data.title}
                        </text>
                    )}
                </svg>
            </div>

        </div>
    );
};

export default SankeyCanvas;
