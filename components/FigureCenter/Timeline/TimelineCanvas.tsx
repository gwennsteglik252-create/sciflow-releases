import React, { useState, useRef, useMemo, useCallback } from 'react';
import { TimelineData, TimelineEvent, TimelineCrossLink } from '../../../types/visuals';
import { TimelineNode } from './TimelineNode';
import { TimelinePath } from './Sub/TimelinePath';
import { calculateEventPositions, getPathD, PathConfig } from './timelineUtils';

interface TimelineCanvasProps {
    data: TimelineData | null;
    activeEventId: string | null;
    setActiveEventId: (id: string | null) => void;
    onUpdateEvent: (id: string, updates: Partial<TimelineEvent>) => void;
    onDeleteEvent?: (id: string) => void;
    zoom: number;
    setZoom: (v: number | ((p: number) => number)) => void;
    containerRef?: React.RefObject<HTMLDivElement>;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
}

export const TimelineCanvas: React.FC<TimelineCanvasProps> = ({
    data, activeEventId, setActiveEventId, onUpdateEvent, onDeleteEvent,
    zoom, setZoom, containerRef,
    onUndo, onRedo, canUndo, canRedo
}) => {
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    // 常量坐标系（SVG 内部始终 1000x400）
    const SVG_W = 1000;
    const SVG_H = 400;
    const MID_Y = SVG_H / 2;
    // 主轴长度：通过物理容器宽度缩放实现
    const axisScale = (data?.axisLength ?? 1000) / 1000;

    const pathConfig: PathConfig = useMemo(() => ({
        waveCurvature: data?.waveCurvature ?? 280,
        straightTilt: data?.straightTilt ?? 0,
        steppedCount: data?.steppedCount ?? 3,
        steppedHeight: data?.steppedHeight ?? 80,
        scurveSteepness: data?.scurveSteepness ?? 10,
        scurveAmplitude: data?.scurveAmplitude ?? 120,
        zigzagAmplitude: data?.zigzagAmplitude ?? 80,
        zigzagCount: data?.zigzagCount ?? 2,
    }), [data?.waveCurvature, data?.straightTilt, data?.steppedCount, data?.steppedHeight, data?.scurveSteepness, data?.scurveAmplitude, data?.zigzagAmplitude, data?.zigzagCount]);

    const nodesWithPositions = useMemo(() => {
        if (!data) return [];
        return calculateEventPositions(data.events, data.pathType, MID_Y, data.distributionMode || 'proportional', pathConfig);
    }, [data?.events, data?.pathType, data?.distributionMode, pathConfig]);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const zoomFactor = 0.1;
            const direction = e.deltaY > 0 ? -1 : 1;
            setZoom((prev: number) => Math.min(3, Math.max(0.2, prev + direction * zoomFactor)));
        } else {
            // 普通滚轮平移
            setPan(prev => ({
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY
            }));
        }
    }, [setZoom]);

    if (!data) {
        return (
            <div className="flex-1 bg-slate-50/50 rounded-[3rem] border border-slate-200 border-dashed flex flex-col items-center justify-center opacity-40 gap-6">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl">
                    <i className="fa-solid fa-timeline text-5xl text-indigo-600"></i>
                </div>
                <div className="text-center">
                    <p className="text-xl font-black uppercase tracking-[0.5rem] italic text-slate-800">启动科研演进建模</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Evolutionary Path Synthesis Pending</p>
                </div>
            </div>
        );
    }

    const pathD = getPathD(data.pathType, SVG_W, MID_Y, pathConfig);

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.timeline-node-item')) return;
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPan({ x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y });
    };

    // 构建节点位置映射 (用于 CrossLink 绘制)
    const nodePositionMap = useMemo(() => {
        const map: Record<string, { percent: number; y: number; side: string; computedLineLength: number }> = {};
        nodesWithPositions.forEach(ev => {
            map[ev.id] = {
                percent: ev.percent,
                y: ev.y,
                side: ev.side || 'top',
                computedLineLength: ev.computedLineLength || 40
            };
        });
        return map;
    }, [nodesWithPositions]);

    // 计算 CrossLink SVG 路径
    const renderCrossLinks = () => {
        if (!data.crossLinks || data.crossLinks.length === 0) return null;

        return (
            <svg
                className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-[15]"
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                preserveAspectRatio="none"
            >
                <defs>
                    <marker id="crosslink-arrow" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 3 L 0 6 Z" fill="currentColor" />
                    </marker>
                </defs>
                {data.crossLinks.map(link => {
                    const from = nodePositionMap[link.fromId];
                    const to = nodePositionMap[link.toId];
                    if (!from || !to) return null;

                    const x1 = (from.percent / 100) * SVG_W;
                    const x2 = (to.percent / 100) * SVG_W;
                    // 气泡顶端/底端的 Y 坐标
                    const bubbleOffset = 60; // 气泡大致半高
                    const y1 = from.side === 'top'
                        ? from.y - (from.computedLineLength) - bubbleOffset
                        : from.y + (from.computedLineLength) + bubbleOffset;
                    const y2 = to.side === 'top'
                        ? to.y - (to.computedLineLength) - bubbleOffset
                        : to.y + (to.computedLineLength) + bubbleOffset;

                    // 贝塞尔控制点：弧形连线
                    const midX = (x1 + x2) / 2;
                    const curveY = Math.min(y1, y2) - 60; // 弧线向上弯曲
                    const pathD = `M ${x1} ${y1} Q ${midX} ${curveY} ${x2} ${y2}`;

                    const linkColor = link.color || '#6366f1';
                    const strokeDash = link.style === 'dashed' ? '8,4' : link.style === 'dotted' ? '3,3' : 'none';

                    return (
                        <g key={link.id}>
                            {/* 光晕底层 */}
                            <path
                                d={pathD}
                                fill="none"
                                stroke={linkColor}
                                strokeWidth={(link.width || 1.5) + 2}
                                strokeDasharray={strokeDash}
                                opacity={0.1}
                                strokeLinecap="round"
                            />
                            {/* 主路径 */}
                            <path
                                d={pathD}
                                fill="none"
                                stroke={linkColor}
                                strokeWidth={link.width || 1.5}
                                strokeDasharray={strokeDash}
                                strokeLinecap="round"
                                markerEnd="url(#crosslink-arrow)"
                                style={{ color: linkColor }}
                                opacity={0.7}
                            />
                            {/* 标签 */}
                            {link.label && (
                                <text
                                    x={midX}
                                    y={curveY - 6}
                                    textAnchor="middle"
                                    fill={linkColor}
                                    fontSize="9"
                                    fontWeight="800"
                                    className="uppercase"
                                    opacity={0.8}
                                >
                                    {link.label}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>
        );
    };

    return (
        <div
            className={`flex-1 bg-white rounded-[3rem] border border-slate-200 shadow-inner relative overflow-hidden flex items-center justify-center select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
            onWheel={handleWheel}
            onClick={() => setActiveEventId(null)}
        >
            <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle at 1.5px 1.5px, #6366f1 1.5px, transparent 0)', backgroundSize: '48px 48px' }}></div>

            <div
                ref={containerRef}
                className="transition-transform duration-75 ease-out flex items-center justify-center origin-center"
                style={{
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) scaleX(${axisScale})`,
                    width: `${SVG_W}px`,
                    height: `${SVG_H}px`
                }}
            >
                <div className="relative w-full h-full">
                    <TimelinePath
                        d={pathD}
                        width={SVG_W}
                        height={SVG_H}
                        strokeWidth={data.axisWidth}
                        arrowWidth={data.arrowWidth}
                        glowIntensity={data.glowIntensity}
                        axisColor={data.axisColor}
                        gradientPreset={data.gradientPreset}
                        arrowStyle={data.arrowStyle}
                        showArrow={true}
                        isHollow={data.isHollow}
                    />

                    {/* CrossLinks 跨节点关联弧线层 */}
                    {renderCrossLinks()}

                    {/* 层级 1：底层绘制所有连接线 (Lines Layer) */}
                    <div className="absolute inset-0 z-10 pointer-events-none">
                        {nodesWithPositions.map((event) => (
                            <div
                                key={`line-${event.id}`}
                                className="absolute"
                                style={{
                                    left: `${event.percent}%`,
                                    top: `${event.y}px`,
                                    transform: `scaleX(${1 / axisScale})`
                                }}
                            >
                                <TimelineNode
                                    event={event as any}
                                    part="line"
                                    isActive={activeEventId === event.id}
                                    onClick={() => { }}
                                    onUpdate={() => { }}
                                    onDelete={() => { }}
                                />
                            </div>
                        ))}
                    </div>

                    {/* 层级 2：顶层绘制所有内容气泡与锚点 (Body Layer) */}
                    <div className="absolute inset-0 z-20 pointer-events-none">
                        {nodesWithPositions.map((event) => (
                            <div
                                key={`body-${event.id}`}
                                id={`node-${event.id}`}
                                className="absolute timeline-node-item pointer-events-auto"
                                style={{
                                    left: `${event.percent}%`,
                                    top: `${event.y}px`,
                                    transform: `scaleX(${1 / axisScale})`
                                }}
                            >
                                <TimelineNode
                                    event={event as any}
                                    part="body"
                                    isActive={activeEventId === event.id}
                                    onClick={() => setActiveEventId(event.id)}
                                    onUpdate={(u) => onUpdateEvent(event.id, u)}
                                    onDelete={() => onDeleteEvent?.(event.id)}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 操作控件：左上角 撤回/重做，右上角 缩放 */}

            {/* 撤回/重做 - 左上角浮动 */}
            <div className="absolute top-8 left-8 z-50 flex items-center gap-2 no-print">
                <div className="flex bg-white/90 backdrop-blur-md rounded-2xl shadow-xl px-2 py-1 border border-slate-200 items-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); onUndo?.(); }}
                        disabled={!canUndo}
                        className="w-10 h-10 flex flex-col items-center justify-center text-slate-400 hover:text-amber-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                        title="撤回 (Ctrl+Z)"
                    >
                        <i className="fa-solid fa-rotate-left text-xs mb-0.5"></i>
                        <span className="text-[7px] font-black uppercase">Undo</span>
                    </button>
                    <div className="w-px h-6 bg-slate-100 mx-1"></div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onRedo?.(); }}
                        disabled={!canRedo}
                        className="w-10 h-10 flex flex-col items-center justify-center text-slate-400 hover:text-amber-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                        title="重做 (Ctrl+Shift+Z)"
                    >
                        <i className="fa-solid fa-rotate-right text-xs mb-0.5"></i>
                        <span className="text-[7px] font-black uppercase">Redo</span>
                    </button>
                </div>
            </div>

            {/* 缩放 - 右上角浮动 */}
            <div className="absolute top-8 right-8 flex gap-2 z-50 no-print">
                <div className="flex bg-white/90 backdrop-blur-md rounded-2xl shadow-xl px-2 py-1 border border-slate-200 items-center">
                    <button
                        onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.max(0.2, prev - 0.1)); }}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                        <i className="fa-solid fa-minus text-[10px]"></i>
                    </button>
                    <div className="w-px h-4 bg-slate-100 mx-1"></div>
                    <span className="text-[11px] font-black text-slate-800 w-14 text-center font-mono">{Math.round(zoom * 100)}%</span>
                    <div className="w-px h-4 bg-slate-100 mx-1"></div>
                    <button
                        onClick={(e) => { e.stopPropagation(); setZoom(prev => Math.min(3, prev + 0.1)); }}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                        <i className="fa-solid fa-plus text-[10px]"></i>
                    </button>
                </div>

                <button
                    onClick={(e) => { e.stopPropagation(); setPan({ x: 0, y: 0 }); setZoom(1); }}
                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 shadow-lg flex items-center justify-center transition-all active:scale-90"
                    title="复位视图"
                >
                    <i className="fa-solid fa-compress"></i>
                </button>
            </div>

            <div className="absolute bottom-10 left-10 right-10 flex justify-between items-center no-print pointer-events-none">
                <div className="bg-slate-900/95 text-white px-8 py-3 rounded-full shadow-2xl border border-white/10 backdrop-blur-md pointer-events-auto flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_#6366f1]"></div>
                    <h4 className="text-sm font-black uppercase italic tracking-widest leading-none">
                        {data.title}
                        <span className="ml-3 opacity-40 font-mono text-[10px] normal-case tracking-normal">Adaptive Trajectory</span>
                    </h4>
                </div>
            </div>
        </div>
    );
};