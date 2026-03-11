import React, { useLayoutEffect, useState } from 'react';
import { Connection, NodePosition } from './types';
import { ColorPickerWithPresets } from '../../DataAnalysis/Chart/ColorPickerWithPresets';

interface StepEdgeLayerProps {
    connections: Connection[];
    nodePositions: Record<string, NodePosition>;
    containerRef: React.RefObject<HTMLDivElement>;
    scale: number;
    editingConnectionIndex: number | null;
    setEditingConnectionIndex: (idx: number | null) => void;
    onConnectionLabelUpdate: (idx: number, label: string) => void;
    onConnectionUpdate?: (idx: number, updates: Partial<Connection>) => void;
    onDeleteConnection?: (idx: number) => void;
    documentColors: string[];
}

interface RenderableConnection {
    id: string;
    d: string;
    labelX: number;
    labelY: number;
    idx: number;
    label: string;
    isEditing: boolean;
    color: string;
    style?: 'solid' | 'dashed' | 'dotted';
    offset?: { x: number; y: number };
    isHorizontal: boolean;
    width?: number;
    arrowSize?: number;
    arrowType?: 'forward' | 'backward' | 'bidirectional' | 'none';
    arrowShape?: 'arrow' | 'dot' | 'diamond';
    labelFontSize?: number;
    labelConfig?: any;
    boxConfig?: any;
    labelPosition?: 'on-line' | 'above' | 'below' | 'left' | 'right';
}

const LINE_COLORS = [
    { value: '#94a3b8', label: 'Slate' },
    { value: '#6366f1', label: 'Indigo' },
    { value: '#10b981', label: 'Emerald' },
    { value: '#f59e0b', label: 'Amber' },
    { value: '#ef4444', label: 'Rose' },
    { value: '#3b82f6', label: 'Blue' },
];

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
    id?: string;
}

interface Point {
    x: number;
    y: number;
}

export const StepEdgeLayer: React.FC<StepEdgeLayerProps> = ({
    connections, nodePositions, containerRef, scale,
    editingConnectionIndex, setEditingConnectionIndex, onConnectionLabelUpdate, onConnectionUpdate, onDeleteConnection,
    documentColors
}) => {
    const [renderables, setRenderables] = useState<RenderableConnection[]>([]);
    const [dragInfo, setDragInfo] = useState<{ idx: number, startMousePos: Point, startOffset: Point, isVerticalAxis: boolean, moved: boolean, isFree?: boolean } | null>(null);

    useLayoutEffect(() => {
        const frame = requestAnimationFrame(() => {
            if (!containerRef.current) return;

            // 1. Snapshot all node geometries
            const nodes: Rect[] = Object.entries(nodePositions).map(([id, pos]) => {
                const el = containerRef.current?.querySelector(`[data-node-id="${id}"]`) as HTMLElement;
                const p = pos as NodePosition;
                return {
                    id,
                    x: p.x,
                    y: p.y,
                    w: el?.offsetWidth || 240,
                    h: el?.offsetHeight || 100
                };
            });

            // Calculate Orthogonal Route with Smart Port Selection & Overlap Avoidance
            const calculateRoute = (src: Rect, tgt: Rect, allNodes: Rect[], offset: number = 0): Point[] => {
                const cxSrc = src.x + src.w / 2;
                const cySrc = src.y + src.h / 2;
                const cxTgt = tgt.x + tgt.w / 2;
                const cyTgt = tgt.y + tgt.h / 2;

                const dx = cxTgt - cxSrc;
                const dy = cyTgt - cySrc;

                // Determine if src and tgt are in the same column (same group) or different columns
                const isSameColumn = Math.abs(cxSrc - cxTgt) < 50;
                const MARGIN = 20; // Clearance around nodes

                if (isSameColumn) {
                    // --- VERTICAL (Same Group) Routing ---
                    // Connect bottom of src to top of tgt (or vice versa)
                    const goDown = dy > 0;
                    // Use unified X (average) to guarantee a perfectly straight vertical line
                    const unifiedX = (cxSrc + cxTgt) / 2;
                    const startY = goDown ? src.y + src.h : src.y;
                    const endY = goDown ? tgt.y : tgt.y + tgt.h;

                    // If X positions are close enough, draw a simple 2-point straight vertical line
                    if (Math.abs(cxSrc - cxTgt) < 30) {
                        return [
                            { x: unifiedX, y: startY },
                            { x: unifiedX, y: endY }
                        ];
                    }

                    // Otherwise, use a 4-point stepped vertical line
                    const midY = (startY + endY) / 2 + offset;
                    return [
                        { x: cxSrc, y: startY },
                        { x: cxSrc, y: midY },
                        { x: cxTgt, y: midY },
                        { x: cxTgt, y: endY }
                    ];
                } else {
                    // --- HORIZONTAL (Cross-Group) Routing ---
                    // Smart port selection: exit from the side closest to the target
                    const goRight = dx > 0;
                    const startX = goRight ? src.x + src.w : src.x;
                    const endX = goRight ? tgt.x : tgt.x + tgt.w;
                    const startY = cySrc;
                    const endY = cyTgt;

                    // If Y positions are nearly identical, draw a simple straight horizontal line
                    if (Math.abs(startY - endY) < 5) {
                        const unifiedY = (startY + endY) / 2;
                        return [
                            { x: startX, y: unifiedY },
                            { x: endX, y: unifiedY }
                        ];
                    }

                    // Calculate midpoint X with node avoidance
                    let midX = (startX + endX) / 2 + offset;

                    // Check if any intermediate node would be crossed by the vertical segment
                    const minMidY = Math.min(startY, endY) - MARGIN;
                    const maxMidY = Math.max(startY, endY) + MARGIN;

                    for (const node of allNodes) {
                        if (node.id === src.id || node.id === tgt.id) continue;
                        // Check if the vertical segment at midX would cross this node
                        if (midX > node.x - MARGIN && midX < node.x + node.w + MARGIN &&
                            node.y < maxMidY && node.y + node.h > minMidY) {
                            // Shift midX to avoid the node
                            if (midX < node.x + node.w / 2) {
                                midX = node.x - MARGIN;
                            } else {
                                midX = node.x + node.w + MARGIN;
                            }
                        }
                    }

                    return [
                        { x: startX, y: startY },
                        { x: midX, y: startY },
                        { x: midX, y: endY },
                        { x: endX, y: endY }
                    ];
                }
            };

            // Build a registry to detect overlapping connections and offset them
            const overlapRegistry: Record<string, number> = {};
            const getOverlapKey = (fromId: string, toId: string, isH: boolean): string => {
                // Group connections that share the same direction between node pairs/groups
                const ids = [fromId, toId].sort();
                return `${ids[0]}_${ids[1]}_${isH ? 'h' : 'v'}`;
            };

            const newRenderables: RenderableConnection[] = connections.map((conn, idx) => {
                const src = nodes.find(n => n.id === conn.from);
                const tgt = nodes.find(n => n.id === conn.to);

                if (!src || !tgt) {
                    if (!src) console.warn(`[StepEdgeLayer] Source node not found: ${conn.from}`);
                    if (!tgt) console.warn(`[StepEdgeLayer] Target node not found: ${conn.to}`);
                    return null;
                }

                const cxSrc = src.x + src.w / 2;
                const cxTgt = tgt.x + tgt.w / 2;
                const isSameColumn = Math.abs(cxSrc - cxTgt) < 50;
                const isHorizontal = !isSameColumn;

                // Smart overlap offset: spread parallel connections apart
                const overlapKey = getOverlapKey(conn.from, conn.to, isHorizontal);
                const overlapCount = overlapRegistry[overlapKey] || 0;
                overlapRegistry[overlapKey] = overlapCount + 1;
                const smartOffset = (overlapCount - 0) * 20; // 0, 20, 40, ...

                const points = calculateRoute(src, tgt, nodes, smartOffset);

                // --- Path Shortening Logic for Arrows/Markers ---
                // We physically shorten the path ends so the square line-cap doesn't poke through the narrow tip.
                // The marker's refX is adjusted to compensate, keeping the tip aligned.
                const SHORTEN_PX = 4;
                const finalPoints = points.map(p => ({ ...p }));

                if (finalPoints.length >= 2) {
                    const arrowType = conn.arrowType || 'forward';
                    const showEnd = arrowType === 'forward' || arrowType === 'bidirectional';
                    const showStart = arrowType === 'backward' || arrowType === 'bidirectional';

                    if (showEnd) {
                        const last = finalPoints[finalPoints.length - 1];
                        const prev = finalPoints[finalPoints.length - 2];
                        const dx = last.x - prev.x;
                        const dy = last.y - prev.y;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        if (len > SHORTEN_PX * 2) {
                            finalPoints[finalPoints.length - 1].x = last.x - (dx / len) * SHORTEN_PX;
                            finalPoints[finalPoints.length - 1].y = last.y - (dy / len) * SHORTEN_PX;
                        }
                    }

                    if (showStart) {
                        const first = finalPoints[0];
                        const next = finalPoints[1];
                        const dx = next.x - first.x;
                        const dy = next.y - first.y;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        if (len > SHORTEN_PX * 2) {
                            finalPoints[0].x = first.x + (dx / len) * SHORTEN_PX;
                            finalPoints[0].y = first.y + (dy / len) * SHORTEN_PX;
                        }
                    }
                }

                const d = `M ${finalPoints.map(p => `${p.x} ${p.y}`).join(' L ')}`;

                // Find longest segment for label placement
                // Usually the middle segment is best for orthogonal lines
                let labelPos = { x: 0, y: 0 };

                // For 4-point orthogonal path (Start -> Mid1 -> Mid2 -> End)
                // Mid1 -> Mid2 is usually the bridge
                if (finalPoints.length === 4) {
                    labelPos = {
                        x: (finalPoints[1].x + finalPoints[2].x) / 2,
                        y: (finalPoints[1].y + finalPoints[2].y) / 2
                    };
                } else {
                    labelPos = {
                        x: (finalPoints[0].x + finalPoints[finalPoints.length - 1].x) / 2,
                        y: (finalPoints[0].y + finalPoints[finalPoints.length - 1].y) / 2
                    };
                }

                const isEditing = editingConnectionIndex === idx;

                return {
                    id: `${conn.from}-${conn.to}-${idx}`,
                    d,
                    labelX: labelPos.x,
                    labelY: labelPos.y,
                    idx,
                    label: conn.label || '',
                    isEditing,
                    color: conn.color || (isEditing ? "#6366f1" : "#94a3b8"),
                    style: conn.style || 'solid',
                    offset: conn.offset || { x: 0, y: 0 },
                    isHorizontal,
                    width: conn.width || 2,
                    arrowSize: conn.arrowSize || 10,
                    arrowType: conn.arrowType || 'forward',
                    arrowShape: conn.arrowShape || 'arrow',
                    labelFontSize: conn.labelFontSize || 12,
                    labelConfig: conn.labelConfig,
                    boxConfig: conn.boxConfig,
                    labelPosition: conn.labelPosition || 'on-line'
                } as RenderableConnection;
            }).filter(Boolean) as RenderableConnection[];

            setRenderables(newRenderables);
        });

        return () => cancelAnimationFrame(frame);
    }, [connections, nodePositions, containerRef, editingConnectionIndex]);

    // Drag-and-drop logic for labels
    const onLabelMouseDown = (e: React.MouseEvent, idx: number, currentOffset: Point, isVerticalAxis: boolean, isFree: boolean = false) => {
        // 允许在没有编辑任何内容，或者正在编辑当前选中的连线，或者点击的是自由移动手柄时进行拖拽
        if (editingConnectionIndex !== null && editingConnectionIndex !== idx && !isFree) return;
        e.preventDefault();
        e.stopPropagation();
        setDragInfo({
            idx,
            startMousePos: { x: e.clientX, y: e.clientY },
            startOffset: { ...currentOffset },
            isVerticalAxis,
            moved: false,
            isFree
        });
    };

    React.useEffect(() => {
        if (!dragInfo) return;

        const onMouseMove = (e: MouseEvent) => {
            const dx = (e.clientX - dragInfo.startMousePos.x) / scale;
            const dy = (e.clientY - dragInfo.startMousePos.y) / scale;

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                if (!dragInfo.moved) {
                    setDragInfo(prev => prev ? { ...prev, moved: true } : null);
                }
            }

            if (dragInfo.isFree) {
                onConnectionUpdate?.(dragInfo.idx, {
                    offset: {
                        x: dragInfo.startOffset.x + dx,
                        y: dragInfo.startOffset.y + dy
                    }
                });
            } else {
                // Lock axis...
                onConnectionUpdate?.(dragInfo.idx, {
                    offset: {
                        x: dragInfo.isVerticalAxis ? dragInfo.startOffset.x : dragInfo.startOffset.x + dx,
                        y: dragInfo.isVerticalAxis ? dragInfo.startOffset.y + dy : dragInfo.startOffset.y
                    }
                });
            }
        };

        const onMouseUp = (e: MouseEvent) => {
            // Delay clearing dragInfo slightly so the click handler can still check 'moved'
            setTimeout(() => {
                setDragInfo(null);
            }, 50);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [dragInfo, scale, onConnectionUpdate]);

    return (
        <>
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-[60]">
                <defs>
                    {Array.from(new Set(renderables.map(r => `${r.color}|${r.arrowSize || 10}|${r.arrowShape || 'arrow'}`))).map(key => {
                        const [color, sizeStr, shape] = key.split('|');
                        const size = parseInt(sizeStr);
                        const safeColor = color.replace(/[^a-zA-Z0-9]/g, '');
                        const markerId = `m-${safeColor}-${size}-${shape}`;

                        // Fix: Shorten the path slightly to avoid "line poking through triangle tip"
                        // The path is shortened in the render loop by 4 units.
                        // We must offset the marker's refX to compensate, so the tip stays at the target.
                        const SHORTEN_PX = 4;

                        let markerContent = null;
                        let refX = (size * 0.9) - SHORTEN_PX;
                        let refY = size / 2;

                        if (shape === 'dot') {
                            markerContent = <circle cx={size / 2} cy={size / 2} r={size / 2.5} fill={color} />;
                            refX = (size / 2) - SHORTEN_PX;
                            refY = size / 2;
                        } else if (shape === 'diamond') {
                            markerContent = <path d={`M ${size / 2} 0 L ${size} ${size / 2} L ${size / 2} ${size} L 0 ${size / 2} Z`} fill={color} />;
                            refX = (size / 2) - SHORTEN_PX;
                            refY = size / 2;
                        } else {
                            // default arrow
                            markerContent = <path d={`M0,0 L0,${size} L${size * 0.9},${size / 2} z`} fill={color} />;
                        }

                        return (
                            <marker
                                key={markerId}
                                id={markerId}
                                markerWidth={size}
                                markerHeight={size}
                                refX={refX}
                                refY={refY}
                                orient="auto-start-reverse"
                                markerUnits="userSpaceOnUse"
                            >
                                {markerContent}
                            </marker>
                        );
                    })}
                </defs>

                {/* Layer 0: Halos removed as it creates a white border */}

                {renderables.map((item) => {
                    const safeColor = item.color.replace(/[^a-zA-Z0-9]/g, '');
                    const arrowType = item.arrowType || 'forward';
                    const arrowShape = item.arrowShape || 'arrow';
                    const lineWidth = item.width || (item.isEditing ? 3 : 2);
                    // Scale dash pattern with line width so dashed/dotted lines remain visible
                    const dashing = item.style === 'dashed' ? `${Math.max(8, lineWidth * 3)},${Math.max(5, lineWidth * 2)}` : item.style === 'dotted' ? `${Math.max(2, lineWidth)},${Math.max(4, lineWidth * 2)}` : 'none';
                    const arrowSize = item.arrowSize || 10;
                    const markerId = `m-${safeColor}-${arrowSize}-${arrowShape}`;

                    const showEnd = arrowType === 'forward' || arrowType === 'bidirectional';
                    const showStart = arrowType === 'backward' || arrowType === 'bidirectional';

                    return (
                        <path
                            key={`path-${item.id}`}
                            d={item.d}
                            stroke={item.color}
                            strokeWidth={lineWidth}
                            fill="none"
                            markerEnd={showEnd ? `url(#${markerId})` : undefined}
                            markerStart={showStart ? `url(#${markerId})` : undefined}
                            strokeDasharray={dashing}
                            strokeLinecap="butt"
                            strokeLinejoin="round"
                            className="transition-all duration-300"
                        />
                    );
                })}
            </svg>

            {/* Layer 2: Interactive Labels (HTML Overlay for Better Interaction) */}
            <div className="absolute inset-0 pointer-events-none z-[1000] overflow-visible">
                {renderables.map((item) => (
                    <div
                        key={`label-html-${item.id}`}
                        className="absolute flex items-center justify-center pointer-events-none"
                        style={{
                            left: item.labelX + (item.offset?.x || 0),
                            top: item.labelY + (item.offset?.y || 0),
                            width: 1,
                            height: 1,
                            overflow: 'visible',
                            transform: (() => {
                                const pos = item.labelPosition || 'on-line';
                                if (pos === 'on-line') return 'none';

                                // Calculate perpendicular offset
                                // item.isHorizontal refers to whether the nodes are horizontally separated 
                                // (meaning the main connector segment is horizontal)
                                const isH = item.isHorizontal;
                                if (pos === 'above') return isH ? 'translateY(-35px)' : 'translateX(-60px)';
                                if (pos === 'below') return isH ? 'translateY(35px)' : 'translateX(60px)';
                                if (pos === 'left') return isH ? 'translateX(-70px)' : 'translateX(-70px)';
                                if (pos === 'right') return isH ? 'translateX(70px)' : 'translateX(70px)';
                                return 'none';
                            })()
                        }}
                    >
                        <div className={`relative flex items-center justify-center pointer-events-auto group/label ${item.isEditing ? 'z-50' : 'z-10'}`}>
                            <span
                                onMouseDown={(e) => onLabelMouseDown(e, item.idx, item.offset || { x: 0, y: 0 }, item.isHorizontal, false)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!dragInfo?.moved) {
                                        setEditingConnectionIndex(item.idx);
                                    }
                                }}
                                className={`px-3 py-1.5 rounded-md truncate max-w-[180px] cursor-move transition-all select-none block ${item.boxConfig?.backgroundColor === 'transparent' ? '' : 'shadow-md'} ${item.isEditing ? 'ring-4 ring-indigo-500/30 shadow-lg scale-110' : 'hover:scale-105'}`}
                                style={{
                                    fontFamily: item.labelConfig?.fontFamily && item.labelConfig.fontFamily !== 'inherit' ? item.labelConfig.fontFamily : undefined,
                                    fontSize: item.labelConfig?.fontSize ? `${item.labelConfig.fontSize}pt` : item.labelFontSize ? `${item.labelFontSize}px` : '12px',
                                    fontWeight: item.labelConfig?.fontWeight || '900',
                                    fontStyle: item.labelConfig?.fontStyle || 'normal',
                                    color: item.labelConfig?.color || '#1e293b',
                                    textAlign: item.labelConfig?.textAlign || 'center',
                                    backgroundColor: item.boxConfig?.backgroundColor || '#ffffff',
                                    borderWidth: item.boxConfig?.borderWidth !== undefined ? `${item.boxConfig.borderWidth}px` : (item.boxConfig?.backgroundColor === 'transparent' ? '0px' : (item.isEditing ? '2px' : '1px')),
                                    borderColor: item.boxConfig?.borderColor || (item.isEditing ? '#6366f1' : '#cbd5e1'),
                                    borderStyle: 'solid'
                                }}
                            >
                                {item.label || (item.isEditing ? '连线参数' : '')}
                            </span>
                            {/* Free drag handle */}
                            <div
                                onMouseDown={(e) => onLabelMouseDown(e, item.idx, item.offset || { x: 0, y: 0 }, item.isHorizontal, true)}
                                className={`absolute -right-8 transition-all w-6 h-6 rounded-lg bg-indigo-50 text-indigo-400 flex items-center justify-center cursor-move hover:bg-indigo-600 hover:text-white shadow-sm ${item.isEditing ? 'opacity-100 animate-pulse' : 'opacity-0 group-hover/label:opacity-100'}`}
                                title="自由拖拽标签位置"
                            >
                                <i className="fa-solid fa-up-down-left-right text-[10px]"></i>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};
