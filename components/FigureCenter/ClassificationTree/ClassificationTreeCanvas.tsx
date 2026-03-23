import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ClassificationTreeData, ClassificationTreeNode, TreeLayoutDirection } from '../../../types/visuals';

// ============================================
// 分类树画布 - 整体渲染 + 交互
// ============================================

interface TreeCanvasProps {
    data: ClassificationTreeData | null;
    selectedNodeId: string | null;
    setSelectedNodeId: (id: string | null) => void;
    onUpdateNode: (id: string, updates: Partial<ClassificationTreeNode>) => void;
    onDeleteNode: (id: string) => void;
    onAddChild: (parentId: string) => void;
    onToggleCollapse: (id: string) => void;
    zoom: number;
    setZoom: (z: number) => void;
    pan: { x: number; y: number };
    setPan: (p: { x: number; y: number }) => void;
    containerRef: React.RefObject<HTMLDivElement>;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
}

const NODE_W = 160;
const NODE_H = 56;

// ============================================================
// 全新布局引擎
// ============================================================

interface FlatNode {
    id: string;
    absX: number;
    absY: number;
    depth: number;
    collapsed: boolean;
    node: ClassificationTreeNode;
    radialAngle?: number;
}

interface FlatConnection {
    from: { x: number; y: number };
    to: { x: number; y: number };
    fromId: string;
    toId: string;
}

/**
 * 通用树布局算法，支持 TB / BT / LR / RL 四个方向。
 *
 * 思路：
 * 1. 先以 TB（上→下）的"规范坐标"计算每个节点的：
 *    spread  = 垂直于生长方向的最终定位（leaf 按序依次排开，内部节点居中）
 *    depthLevel = 生长方向的层数
 * 2. 再依据实际方向用 depthLevel 和 spread 换算到屏幕绝对 (absX, absY)
 * 3. BT / RL 在深度轴上镜像翻转
 */
function computeTreeLayout(
    root: ClassificationTreeNode,
    layout: TreeLayoutDirection,
    hSpacing: number,
    vSpacing: number
): { nodes: FlatNode[]; connections: FlatConnection[] } {
    const isHorizontal = layout === 'LR' || layout === 'RL';

    // 垂直于生长方向的节点尺寸和间距
    const nodeSpreadSize = isHorizontal ? NODE_H : NODE_W;
    const nodeDepthSize = isHorizontal ? NODE_W : NODE_H;
    const spreadSpacing = isHorizontal ? vSpacing : hSpacing;
    const depthSpacing = isHorizontal ? hSpacing : vSpacing;

    // ---- Step 1: 计算规范坐标 ----
    type CanonPos = { spread: number; depthLevel: number };
    const canonMap = new Map<string, CanonPos>();
    const counter = { val: 0 };

    function computeCanonical(node: ClassificationTreeNode, depth: number) {
        const kids = node.collapsed ? [] : (node.children || []);
        if (kids.length === 0) {
            canonMap.set(node.id, {
                spread: counter.val * (nodeSpreadSize + spreadSpacing),
                depthLevel: depth,
            });
            counter.val++;
        } else {
            for (const k of kids) computeCanonical(k, depth + 1);
            const spreads = kids.map(k => canonMap.get(k.id)!.spread);
            canonMap.set(node.id, {
                spread: (Math.min(...spreads) + Math.max(...spreads)) / 2,
                depthLevel: depth,
            });
        }
    }

    computeCanonical(root, 0);

    // ---- Step 2: 映射到 (absX, absY) ----
    const flatNodes: FlatNode[] = [];

    function buildNodes(node: ClassificationTreeNode, depth: number) {
        const pos = canonMap.get(node.id);
        if (!pos) return;

        const depthPx = pos.depthLevel * (nodeDepthSize + depthSpacing);
        const spreadPx = pos.spread;

        let absX: number, absY: number;
        if (layout === 'TB' || layout === 'BT') {
            absX = spreadPx;
            absY = depthPx;           // BT 后面会翻转
        } else {
            absX = depthPx;           // RL 后面会翻转
            absY = spreadPx;
        }

        flatNodes.push({ id: node.id, absX, absY, depth, collapsed: !!node.collapsed, node });

        for (const k of (node.collapsed ? [] : (node.children || []))) {
            buildNodes(k, depth + 1);
        }
    }

    buildNodes(root, 0);

    // ---- Step 3: 镜像 BT / RL ----
    if (layout === 'BT' || layout === 'RL') {
        const maxDepth = Math.max(...flatNodes.map(n => n.depth));
        const maxPx = maxDepth * (nodeDepthSize + depthSpacing);
        for (const n of flatNodes) {
            if (layout === 'BT') n.absY = maxPx - n.absY;
            else n.absX = maxPx - n.absX;
        }
    }

    // ---- Step 4: 构建连线 ----
    const nodeMap = new Map(flatNodes.map(n => [n.id, n]));
    const connections: FlatConnection[] = [];

    function buildConns(node: ClassificationTreeNode) {
        const p = nodeMap.get(node.id);
        if (!p) return;
        for (const child of (node.collapsed ? [] : (node.children || []))) {
            const c = nodeMap.get(child.id);
            if (!c) continue;

            let fromX = 0, fromY = 0, toX = 0, toY = 0;
            if (layout === 'TB') {
                fromX = p.absX + NODE_W / 2; fromY = p.absY + NODE_H;
                toX = c.absX + NODE_W / 2; toY = c.absY;
            } else if (layout === 'BT') {
                fromX = p.absX + NODE_W / 2; fromY = p.absY;
                toX = c.absX + NODE_W / 2; toY = c.absY + NODE_H;
            } else if (layout === 'LR') {
                fromX = p.absX + NODE_W; fromY = p.absY + NODE_H / 2;
                toX = c.absX; toY = c.absY + NODE_H / 2;
            } else { // RL
                fromX = p.absX; fromY = p.absY + NODE_H / 2;
                toX = c.absX + NODE_W; toY = c.absY + NODE_H / 2;
            }
            connections.push({ from: { x: fromX, y: fromY }, to: { x: toX, y: toY }, fromId: node.id, toId: child.id });
            buildConns(child);
        }
    }

    buildConns(root);
    return { nodes: flatNodes, connections };
}

// ============================================================
// 放射状/扇形布局引擎 (Radial / Fan Layout)
// ============================================================

function computeRadialLayout(
    root: ClassificationTreeNode,
    hSpacing: number,
    vSpacing: number,
): { nodes: FlatNode[]; connections: FlatConnection[]; radialPaths: string[]; cx: number; cy: number; depthRadii: number[] } {
    const radiusStep = Math.max(vSpacing, 80) + NODE_H;
    const sweepAngle = Math.PI * 5 / 3; // 300° fan
    const centerAngle = -Math.PI / 2;   // pointing upward
    const angleStart = centerAngle - sweepAngle / 2;

    function countLeaves(node: ClassificationTreeNode): number {
        const kids = node.collapsed ? [] : (node.children || []);
        if (kids.length === 0) return 1;
        return kids.reduce((s, k) => s + countLeaves(k), 0);
    }
    const totalLeaves = countLeaves(root);
    const anglePerLeaf = totalLeaves > 1 ? sweepAngle / (totalLeaves - 1) : 0;

    const angleMap = new Map<string, number>();
    let leafIdx = 0;
    function assignAngles(node: ClassificationTreeNode) {
        const kids = node.collapsed ? [] : (node.children || []);
        if (kids.length === 0) {
            angleMap.set(node.id, totalLeaves === 1 ? centerAngle : angleStart + leafIdx * anglePerLeaf);
            leafIdx++;
        } else {
            for (const k of kids) assignAngles(k);
            const ca = kids.map(k => angleMap.get(k.id)!);
            angleMap.set(node.id, (Math.min(...ca) + Math.max(...ca)) / 2);
        }
    }
    assignAngles(root);

    function getMaxDepth(node: ClassificationTreeNode, d: number): number {
        const kids = node.collapsed ? [] : (node.children || []);
        if (kids.length === 0) return d;
        return Math.max(...kids.map(k => getMaxDepth(k, d + 1)));
    }
    const maxD = getMaxDepth(root, 0);
    const depthRadii = Array.from({ length: maxD + 1 }, (_, i) => i * radiusStep);
    const pad = 300;
    const cx = maxD * radiusStep + pad;
    const cy = maxD * radiusStep + pad;

    const flatNodes: FlatNode[] = [];
    function buildNodes(node: ClassificationTreeNode, depth: number) {
        const angle = angleMap.get(node.id)!;
        const radius = depthRadii[depth];
        flatNodes.push({
            id: node.id,
            absX: cx + radius * Math.cos(angle) - NODE_W / 2,
            absY: cy + radius * Math.sin(angle) - NODE_H / 2,
            depth, collapsed: !!node.collapsed, node, radialAngle: angle,
        });
        for (const k of (node.collapsed ? [] : (node.children || []))) buildNodes(k, depth + 1);
    }
    buildNodes(root, 0);

    const radialPaths: string[] = [];
    const connections: FlatConnection[] = [];
    function buildPaths(node: ClassificationTreeNode, depth: number) {
        const kids = node.collapsed ? [] : (node.children || []);
        if (kids.length === 0) return;
        const pAngle = angleMap.get(node.id)!;
        const pR = depthRadii[depth];
        const cR = depthRadii[depth + 1];
        const midR = (pR + cR) / 2;
        const pX = cx + pR * Math.cos(pAngle), pY = cy + pR * Math.sin(pAngle);
        const pMidX = cx + midR * Math.cos(pAngle), pMidY = cy + midR * Math.sin(pAngle);
        radialPaths.push(`M${pX},${pY} L${pMidX},${pMidY}`);
        const childAngles = kids.map(k => angleMap.get(k.id)!);
        if (kids.length > 1) {
            const minA = Math.min(...childAngles), maxA = Math.max(...childAngles);
            const asx = cx + midR * Math.cos(minA), asy = cy + midR * Math.sin(minA);
            const aex = cx + midR * Math.cos(maxA), aey = cy + midR * Math.sin(maxA);
            radialPaths.push(`M${asx},${asy} A${midR},${midR} 0 ${(maxA - minA) > Math.PI ? 1 : 0},1 ${aex},${aey}`);
        }
        for (const child of kids) {
            const cAngle = angleMap.get(child.id)!;
            const cMidX = cx + midR * Math.cos(cAngle), cMidY = cy + midR * Math.sin(cAngle);
            const cX = cx + cR * Math.cos(cAngle), cY = cy + cR * Math.sin(cAngle);
            radialPaths.push(`M${cMidX},${cMidY} L${cX},${cY}`);
            connections.push({ from: { x: pX, y: pY }, to: { x: cX, y: cY }, fromId: node.id, toId: child.id });
            buildPaths(child, depth + 1);
        }
    }
    buildPaths(root, 0);
    return { nodes: flatNodes, connections, radialPaths, cx, cy, depthRadii };
}

// ============================================================
// 画布组件
// ============================================================

export const ClassificationTreeCanvas: React.FC<TreeCanvasProps> = ({
    data, selectedNodeId, setSelectedNodeId, onUpdateNode, onDeleteNode,
    onAddChild, onToggleCollapse, zoom, setZoom, pan, setPan,
    containerRef, onUndo, onRedo, canUndo, canRedo
}) => {
    const [isPanning, setIsPanning] = useState(false);
    const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
            const delta = e.deltaY > 0 ? -0.05 : 0.05;
            setZoom(Math.max(0.2, Math.min(3, zoom + delta)));
        } else {
            setPan({
                x: pan.x - e.deltaX,
                y: pan.y - e.deltaY,
            });
        }
    }, [zoom, setZoom, pan, setPan]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            setIsPanning(true);
            panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
        }
    }, [pan]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning) return;
        setPan({
            x: panStart.current.panX + (e.clientX - panStart.current.x),
            y: panStart.current.panY + (e.clientY - panStart.current.y),
        });
    }, [isPanning, setPan]);

    const handleMouseUp = useCallback(() => setIsPanning(false), []);

    const layoutResult = useMemo(() => {
        if (!data) return null;
        if (data.layout === 'radial') {
            return computeRadialLayout(data.rootNode, data.horizontalSpacing || 60, data.verticalSpacing || 100);
        }
        return computeTreeLayout(data.rootNode, data.layout, data.horizontalSpacing || 60, data.verticalSpacing || 100);
    }, [data]);

    const positions = layoutResult?.nodes ?? [];
    const connections = layoutResult?.connections ?? [];
    const radialPaths = (layoutResult as any)?.radialPaths as string[] | undefined;
    const radialCx = (layoutResult as any)?.cx as number | undefined;
    const radialCy = (layoutResult as any)?.cy as number | undefined;
    const depthRadii = (layoutResult as any)?.depthRadii as number[] | undefined;

    // Canvas bounds
    const bounds = useMemo(() => {
        if (positions.length === 0) return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of positions) {
            minX = Math.min(minX, p.absX);
            minY = Math.min(minY, p.absY);
            maxX = Math.max(maxX, p.absX + NODE_W);
            maxY = Math.max(maxY, p.absY + NODE_H);
        }
        return { minX: minX - 80, minY: minY - 80, maxX: maxX + 80, maxY: maxY + 80 };
    }, [positions]);

    const levelColors = data?.levelColors || ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'];
    const isRadial = data?.layout === 'radial';
    const isHorizontal = !isRadial && data ? (data.layout === 'LR' || data.layout === 'RL') : false;

    if (!data) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-[2.5rem]">
                <div className="text-center space-y-6 max-w-md">
                    <div className="w-28 h-28 mx-auto bg-gradient-to-br from-teal-50 to-indigo-50 rounded-[2rem] flex items-center justify-center border border-teal-100 shadow-sm relative">
                        <i className="fa-solid fa-sitemap text-5xl text-teal-400"></i>
                        <div className="absolute top-0 right-0 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md translate-x-2 -translate-y-2">
                            <i className="fa-solid fa-wand-magic-sparkles text-amber-400 text-sm"></i>
                        </div>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 italic uppercase tracking-widest">分类树 / 层级图</h3>
                    <p className="text-slate-500 text-sm leading-relaxed font-bold">
                        使用 AI 智能生成或手动创建分类树。适用于综述中的<span className="text-teal-600 font-black">研究方向分类</span>、<span className="text-indigo-600 font-black">材料分类</span>、<span className="text-rose-500 font-black">策略分类</span>等。
                    </p>
                </div>
            </div>
        );
    }

    const svgW = bounds.maxX - bounds.minX;
    const svgH = bounds.maxY - bounds.minY;

    return (
        <div className="flex-1 relative overflow-hidden rounded-[2.5rem] bg-white border border-slate-200 shadow-inner">
            {/* Grid Background */}
            <div className="absolute inset-0 pointer-events-none z-0" style={{
                backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                opacity: 0.6
            }}></div>

            {/* Undo/Redo — Top Left */}
            <div className="absolute top-6 left-6 z-30 flex items-center gap-2 no-print">
                <div className="flex bg-white/90 backdrop-blur-md rounded-2xl shadow-xl px-2 py-1 border border-slate-200 items-center">
                    <button onClick={onUndo} disabled={!canUndo}
                        className="w-10 h-10 flex flex-col items-center justify-center text-slate-400 hover:text-teal-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                        title="撤销 (Cmd+Z)">
                        <i className="fa-solid fa-rotate-left text-xs mb-0.5"></i>
                        <span className="text-[7px] font-black uppercase">Undo</span>
                    </button>
                    <div className="w-px h-6 bg-slate-100 mx-1"></div>
                    <button onClick={onRedo} disabled={!canRedo}
                        className="w-10 h-10 flex flex-col items-center justify-center text-slate-400 hover:text-teal-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                        title="重做 (Cmd+Shift+Z)">
                        <i className="fa-solid fa-rotate-right text-xs mb-0.5"></i>
                        <span className="text-[7px] font-black uppercase">Redo</span>
                    </button>
                </div>
            </div>

            {/* Zoom Controls — Top Right */}
            <div className="absolute top-6 right-6 z-30 flex items-center gap-2 no-print">
                <div className="flex bg-white/90 backdrop-blur-md rounded-2xl shadow-xl px-2 py-1 border border-slate-200 items-center">
                    <button
                        onClick={() => setZoom(Math.max(0.2, zoom - 0.1))}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-teal-600 transition-colors active:scale-90"
                        title="缩小"
                    >
                        <i className="fa-solid fa-minus text-[10px]"></i>
                    </button>
                    <div className="w-px h-4 bg-slate-100 mx-1"></div>
                    <button
                        onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                        className="flex flex-col items-center justify-center hover:bg-teal-50 px-2 py-1 rounded-lg transition-all active:scale-95"
                        title="复位视图"
                    >
                        <span className="text-[11px] font-black text-slate-800 font-mono leading-none">{Math.round(zoom * 100)}%</span>
                        <i className="fa-solid fa-compress text-[8px] text-teal-400 mt-0.5"></i>
                    </button>
                    <div className="w-px h-4 bg-slate-100 mx-1"></div>
                    <button
                        onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-teal-600 transition-colors active:scale-90"
                        title="放大"
                    >
                        <i className="fa-solid fa-plus text-[10px]"></i>
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div
                ref={containerRef}
                className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={(e) => {
                    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'svg') {
                        setSelectedNodeId(null);
                        setEditingNodeId(null);
                    }
                }}
            >
                <div style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    width: svgW + 200,
                    height: svgH + 200,
                    position: 'relative',
                    margin: '60px auto'
                }}>
                    {/* Flow animation keyframes */}
                    <style>{`
                        @keyframes flowDash {
                            to { stroke-dashoffset: -18; }
                        }
                    `}</style>
                    {/* SVG connections */}
                    <svg
                        width={svgW + 200}
                        height={svgH + 200}
                        className="absolute inset-0 pointer-events-none"
                        style={{ overflow: 'visible' }}
                    >
                        <defs>
                            <filter id="glow">
                                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                <feMerge>
                                    <feMergeNode in="coloredBlur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                        {/* Radial: depth rings */}
                        {isRadial && depthRadii && radialCx != null && radialCy != null && depthRadii.map((r, i) => (
                            r > 0 ? <circle key={`ring-${i}`} cx={radialCx - bounds.minX + 100} cy={radialCy - bounds.minY + 100} r={r} fill="none" stroke={levelColors[i % levelColors.length]} strokeWidth={1} strokeDasharray="6,4" opacity={0.18} /> : null
                        ))}
                        {/* Radial: cladogram paths */}
                        {isRadial && radialPaths && radialPaths.map((pathD, idx) => {
                            const sc = data.connectionStyle?.color || '#94a3b8';
                            const sw = data.connectionStyle?.width || 2;
                            return (
                                <g key={`rp-${idx}`} transform={`translate(${-bounds.minX + 100},${-bounds.minY + 100})`}>
                                    <path d={pathD} fill="none" stroke={sc} strokeWidth={sw + 2} opacity={0.08} filter="url(#glow)" />
                                    <path d={pathD} fill="none" stroke={sc} strokeWidth={sw} strokeLinecap="round" opacity={0.55} />
                                </g>
                            );
                        })}
                        {!isRadial && connections.map((conn, idx) => {
                            const x1 = conn.from.x - bounds.minX + 100;
                            const y1 = conn.from.y - bounds.minY + 100;
                            const x2 = conn.to.x - bounds.minX + 100;
                            const y2 = conn.to.y - bounds.minY + 100;

                            const curveType = data.connectionStyle?.curveType || 'bezier';
                            let d = '';
                            if (curveType === 'bezier') {
                                if (isHorizontal) {
                                    const mx = (x1 + x2) / 2;
                                    d = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
                                } else {
                                    const my = (y1 + y2) / 2;
                                    d = `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
                                }
                            } else if (curveType === 'step' || curveType === 'elbow') {
                                if (isHorizontal) {
                                    const mx = (x1 + x2) / 2;
                                    d = `M${x1},${y1} L${mx},${y1} L${mx},${y2} L${x2},${y2}`;
                                } else {
                                    const my = (y1 + y2) / 2;
                                    d = `M${x1},${y1} L${x1},${my} L${x2},${my} L${x2},${y2}`;
                                }
                            } else {
                                d = `M${x1},${y1} L${x2},${y2}`;
                            }

                            const strokeStyle = data.connectionStyle?.style || 'solid';
                            const dashArray = strokeStyle === 'dashed' ? '8,4' : strokeStyle === 'dotted' ? '3,3' : undefined;
                            const isAnimated = data.connectionStyle?.animate;
                            const animDash = isAnimated && !dashArray ? '12,6' : dashArray;

                            return (
                                <g key={idx}>
                                    <path
                                        d={d}
                                        fill="none"
                                        stroke={data.connectionStyle?.color || '#94a3b8'}
                                        strokeWidth={(data.connectionStyle?.width || 2) + 2}
                                        strokeDasharray={dashArray}
                                        opacity={0.12}
                                        filter="url(#glow)"
                                    />
                                    <path
                                        d={d}
                                        fill="none"
                                        stroke={data.connectionStyle?.color || '#94a3b8'}
                                        strokeWidth={data.connectionStyle?.width || 2}
                                        strokeDasharray={isAnimated ? animDash : dashArray}
                                        strokeLinecap="round"
                                        opacity={0.6}
                                        style={isAnimated ? {
                                            animation: 'flowDash 1s linear infinite',
                                        } : undefined}
                                    />
                                    <circle
                                        cx={x2}
                                        cy={y2}
                                        r={3}
                                        fill={data.connectionStyle?.color || '#94a3b8'}
                                        opacity={0.7}
                                    />
                                </g>
                            );
                        })}
                    </svg>

                    {/* Render nodes */}
                    {positions.map(pos => {
                        const nodeStyle = pos.node.style || {};
                        const levelColor = levelColors[pos.depth % levelColors.length];
                        const borderColor = nodeStyle.borderColor || levelColor;
                        const isRoot = pos.depth === 0;
                        const bgColor = nodeStyle.backgroundColor || nodeStyle.bgColor || (isRoot ? '#1e293b' : '#ffffff');
                        // Auto-detect text color based on background luminance
                        const autoTextColor = (() => {
                            const hex = bgColor.replace('#', '');
                            if (hex.length < 6) return '#1e293b';
                            const r = parseInt(hex.substring(0, 2), 16);
                            const g = parseInt(hex.substring(2, 4), 16);
                            const b = parseInt(hex.substring(4, 6), 16);
                            const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                            return lum > 0.6 ? '#1e293b' : '#ffffff';
                        })();
                        const textColor = nodeStyle.color || nodeStyle.textColor || autoTextColor;
                        const nodeW = nodeStyle.width || NODE_W;
                        const bw = nodeStyle.borderWidth ?? 2;
                        const br = nodeStyle.borderRadius ?? 20;
                        const nodeOpacity = nodeStyle.opacity ?? 1;

                        const isSelected = selectedNodeId === pos.id;
                        const hasChildren = pos.node.children && pos.node.children.length > 0;
                        const isEditing = editingNodeId === pos.id;

                        // Build shadow string
                        const shadowBlur = nodeStyle.shadowBlur ?? 0;
                        const shadowColor = nodeStyle.shadowColor || '#00000030';
                        const customShadow = shadowBlur > 0 ? `0 4px ${shadowBlur}px ${shadowColor}` : undefined;
                        const selectedShadow = isSelected ? `0 20px 25px -5px rgba(0,0,0,0.08), 0 10px 10px -5px rgba(0,0,0,0.04)` : undefined;
                        const combinedShadow = [selectedShadow, customShadow].filter(Boolean).join(', ') || undefined;

                        return (
                            <div
                                key={pos.id}
                                className={`absolute group transition-all duration-200 ${isSelected ? 'z-20' : 'z-10'}`}
                                style={{
                                    left: pos.absX - bounds.minX + 100,
                                    top: pos.absY - bounds.minY + 100,
                                    width: nodeW,
                                    minHeight: NODE_H,
                                    opacity: nodeOpacity,
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedNodeId(pos.id);
                                }}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setEditingNodeId(pos.id);
                                }}
                            >
                                <div
                                    className={`w-full min-h-full flex items-center gap-2.5 py-2 transition-all duration-300 cursor-pointer shadow-sm
                                        ${isSelected
                                            ? 'shadow-2xl scale-[1.05] z-20 ring-4 ring-black/5'
                                            : 'hover:scale-[1.02] hover:shadow-lg hover:z-10'
                                        }
                                    `}
                                    style={{
                                        borderWidth: `${bw}px`,
                                        borderStyle: 'solid',
                                        borderColor: borderColor,
                                        borderRadius: `${br}px`,
                                        backgroundColor: bgColor,
                                        boxShadow: combinedShadow,
                                        paddingLeft: `${nodeStyle.paddingX ?? 12}px`,
                                        paddingRight: `${nodeStyle.paddingX ?? 12}px`,
                                    }}
                                >
                                    <div
                                        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-inner overflow-hidden relative"
                                        style={{
                                            background: isRoot && !nodeStyle.backgroundColor ? borderColor : undefined,
                                            backgroundColor: !(isRoot && !nodeStyle.backgroundColor) ? undefined : undefined,
                                        }}
                                    >
                                        <div className="w-full h-full flex items-center justify-center" style={{
                                            backgroundColor: isRoot && !nodeStyle.backgroundColor ? undefined : borderColor,
                                            opacity: isRoot && !nodeStyle.backgroundColor ? 1 : 0.12,
                                            position: 'absolute', inset: 0, borderRadius: 'inherit'
                                        }}></div>
                                        <i className={`${pos.node.icon || 'fa-solid fa-tag'} text-xs relative z-10`}
                                            style={{ color: isRoot && !nodeStyle.backgroundColor ? '#fff' : borderColor }} />
                                    </div>

                                    {/* Label */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center translate-y-px"
                                        style={{ textAlign: nodeStyle.textAlign || 'left' }}>
                                        {isEditing ? (
                                            <input
                                                autoFocus
                                                className="w-full bg-slate-50 border border-slate-200 outline-none text-[11px] font-black uppercase tracking-tight text-slate-800 rounded px-1.5 py-0.5"
                                                defaultValue={pos.node.label}
                                                onBlur={(e) => {
                                                    onUpdateNode(pos.id, { label: e.target.value });
                                                    setEditingNodeId(null);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        onUpdateNode(pos.id, { label: (e.target as HTMLInputElement).value });
                                                        setEditingNodeId(null);
                                                    }
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span
                                                className="uppercase tracking-tight truncate block leading-tight"
                                                style={{
                                                    fontSize: nodeStyle.fontSize ? `${nodeStyle.fontSize}px` : '11px',
                                                    fontWeight: nodeStyle.fontWeight || (isSelected ? '900' : '700'),
                                                    fontStyle: nodeStyle.fontStyle || 'normal',
                                                    color: textColor
                                                }}
                                                title={pos.node.label}
                                            >
                                                {pos.node.label}
                                            </span>
                                        )}
                                        {pos.node.description && !isEditing && (
                                            <span
                                                className="block mt-0.5 leading-snug uppercase break-words whitespace-normal"
                                                style={{
                                                    fontSize: nodeStyle.descFontSize ? `${nodeStyle.descFontSize}px` : '8px',
                                                    fontWeight: nodeStyle.descFontWeight || 'bold',
                                                    fontStyle: nodeStyle.descFontStyle || 'normal',
                                                    color: nodeStyle.descColor || '#94a3b8',
                                                    textAlign: nodeStyle.descTextAlign || (nodeStyle.textAlign || 'left'),
                                                    wordBreak: 'break-word',
                                                }}
                                            >{pos.node.description}</span>
                                        )}
                                    </div>

                                    {/* Collapse toggle */}
                                    {hasChildren && (
                                        <button
                                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-slate-100 hover:bg-teal-50 hover:text-teal-600 text-slate-400 transition-all border border-slate-200"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onToggleCollapse(pos.id);
                                            }}
                                        >
                                            <i className={`fa-solid ${pos.collapsed ? 'fa-plus' : 'fa-minus'} text-[7px]`}></i>
                                        </button>
                                    )}
                                </div>

                                {/* Hover actions */}
                                <div className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-30">
                                    <button
                                        className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                                        onClick={(e) => { e.stopPropagation(); onAddChild(pos.id); }}
                                        title="添加子节点"
                                    >
                                        <i className="fa-solid fa-plus text-[8px]"></i>
                                    </button>
                                    {!isRoot && (
                                        <button
                                            className="w-6 h-6 rounded-full bg-rose-50 border border-rose-200 text-rose-500 flex items-center justify-center shadow-lg hover:bg-rose-500 hover:text-white hover:scale-110 transition-all"
                                            onClick={(e) => { e.stopPropagation(); onDeleteNode(pos.id); }}
                                            title="删除节点"
                                        >
                                            <i className="fa-solid fa-xmark text-[8px]"></i>
                                        </button>
                                    )}
                                </div>

                                {/* Depth indicator */}
                                {data?.showDepthIndicator && (
                                    <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400 bg-white/80 px-1 py-0.5 rounded shadow-sm border border-slate-100">
                                        L{pos.depth}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
