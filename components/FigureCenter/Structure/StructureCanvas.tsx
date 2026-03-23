import React from 'react';
import { DiagramGroup, NodePosition, DiagramNode, Connection } from './types';
import { StepEdgeLayer } from './StepEdgeLayer';
import { StructuralNode } from './StructuralNode';
import { ScientificTheme } from '../../../ScientificThemes';
import { GuideLine } from '../../../hooks/useStructuralDesigner';
import { ColorPickerWithPresets } from '../../DataAnalysis/Chart/ColorPickerWithPresets';
import { LAYOUT_CONSTANTS, getLayoutConstants, getNodeHeight } from './utils';

interface StructureCanvasProps {
    data: { groups: DiagramGroup[], connections: Connection[] };
    positions: Record<string, NodePosition>;
    scale: number;
    setScale: React.Dispatch<React.SetStateAction<number>>;
    pan: { x: number; y: number };
    setPan: React.Dispatch<React.SetStateAction<{ x: number, y: number }>>;
    containerRef: React.RefObject<HTMLDivElement>;
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    onWheel: (e: React.WheelEvent) => void;
    onBackgroundClick: () => void;
    onCanvasMouseDown: (e: React.MouseEvent) => void;
    editingGroupId: string | null;
    setEditingGroupId: (id: string | null) => void;
    onGroupTitleUpdate: (id: string, title: string) => void;
    handleGroupUpdate: (id: string, updates: Partial<DiagramGroup>) => void;
    handleGroupDelete: (id: string) => void;
    editingConnectionIndex: number | null;
    setEditingConnectionIndex: (idx: number | null) => void;
    onConnectionLabelUpdate: (idx: number, label: string) => void;
    onConnectionUpdate: (idx: number, updates: Partial<Connection>) => void;
    onConnectionDelete: (idx: number) => void;
    dragNodeId: string | null;
    editingId: string | null;
    connectSourceId: string | null;
    onNodeMouseDown: (e: React.MouseEvent, nodeId: string) => void;
    onNodeClick: (e: React.MouseEvent, nodeId: string) => void;
    setEditingId: (id: string | null) => void;
    onNodeUpdate: (id: string, updates: Partial<DiagramNode>) => void;
    onNodeDelete: (id: string) => void;
    onAddNode: (groupId?: string) => void;
    activeTheme: ScientificTheme;
    guides?: GuideLine[];
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
}

const COLOR_OPTIONS = [
    { value: 'slate', bg: 'bg-slate-50', border: 'border-slate-200' },
    { value: 'indigo', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    { value: 'emerald', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { value: 'amber', bg: 'bg-amber-50', border: 'border-amber-200' },
    { value: 'rose', bg: 'bg-rose-50', border: 'border-rose-200' },
];

export const StructureCanvas: React.FC<StructureCanvasProps> = ({
    data, positions, scale, setScale, pan, setPan,
    containerRef, scrollContainerRef, onWheel, onBackgroundClick, onCanvasMouseDown,
    editingGroupId, setEditingGroupId, handleGroupUpdate, handleGroupDelete,
    editingConnectionIndex, setEditingConnectionIndex, onConnectionLabelUpdate, onConnectionUpdate, onConnectionDelete,
    dragNodeId, editingId, connectSourceId,
    onNodeMouseDown, onNodeClick, setEditingId, onNodeUpdate, onNodeDelete, onAddNode, activeTheme,
    guides = [],
    onUndo, onRedo, canUndo, canRedo
}) => {
    const documentColors = React.useMemo(() => {
        const colors = new Set<string>();
        data.groups.forEach(g => {
            g.nodes.forEach(n => {
                if (n.customColor && n.customColor.startsWith('#')) {
                    colors.add(n.customColor.toLowerCase());
                }
            });
        });
        return Array.from(colors);
    }, [data]);

    const handleZoomIn = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale(prev => Math.min(3, prev + 0.1));
    };

    const handleZoomOut = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale(prev => Math.max(0.2, prev - 0.1));
    };

    const handleResetZoom = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale(1.0);
        setPan({ x: 0, y: 0 });
    };

    return (
        <div className="flex-1 bg-transparent relative flex flex-col overflow-hidden group">
            {/* Floating Undo/Redo Controls - Moved to Top Left */}
            <div className="absolute top-6 left-6 z-[100] flex items-center gap-2 no-print">
                <div className="flex bg-white/90 backdrop-blur-md rounded-2xl shadow-xl px-2 py-1 border border-slate-200 items-center">
                    <button
                        onClick={onUndo}
                        disabled={!canUndo}
                        className="w-10 h-10 flex flex-col items-center justify-center text-slate-400 hover:text-amber-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                        title="撤销 (Ctrl+Z)"
                    >
                        <i className="fa-solid fa-rotate-left text-xs mb-0.5"></i>
                        <span className="text-[7px] font-black uppercase">Undo</span>
                    </button>
                    <div className="w-px h-6 bg-slate-100 mx-1"></div>
                    <button
                        onClick={onRedo}
                        disabled={!canRedo}
                        className="w-10 h-10 flex flex-col items-center justify-center text-slate-400 hover:text-amber-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                        title="重做 (Ctrl+Y)"
                    >
                        <i className="fa-solid fa-rotate-right text-xs mb-0.5"></i>
                        <span className="text-[7px] font-black uppercase">Redo</span>
                    </button>
                </div>
            </div>

            {/* Floating Zoom Controls */}
            <div className="absolute top-6 right-6 z-[100] flex items-center gap-2 no-print opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex bg-white/90 backdrop-blur-md rounded-2xl shadow-xl px-2 py-1 border border-slate-200 items-center">
                    <button
                        onClick={handleZoomOut}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors active:scale-90"
                        title="缩小"
                    >
                        <i className="fa-solid fa-minus text-[10px]"></i>
                    </button>
                    <div className="w-px h-4 bg-slate-100 mx-1"></div>
                    <button
                        onClick={handleResetZoom}
                        className="flex flex-col items-center justify-center hover:bg-indigo-50 px-2 py-1 rounded-lg transition-all active:scale-95"
                        title="复位视图"
                    >
                        <span className="text-[11px] font-black text-slate-800 font-mono leading-none">{Math.round(scale * 100)}%</span>
                        <i className="fa-solid fa-compress text-[8px] text-indigo-400 mt-0.5"></i>
                    </button>
                    <div className="w-px h-4 bg-slate-100 mx-1"></div>
                    <button
                        onClick={handleZoomIn}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors active:scale-90"
                        title="放大"
                    >
                        <i className="fa-solid fa-plus text-[10px]"></i>
                    </button>
                </div>
            </div>

            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-hidden p-10 cursor-grab active:cursor-grabbing relative"
                onWheel={onWheel}
                onMouseDown={onCanvasMouseDown}
                onClick={onBackgroundClick}
            >
                <div className="min-w-full min-h-full flex items-center justify-center">
                    <div
                        ref={containerRef}
                        className="min-w-[1400px] min-h-[900px] relative origin-center"
                        style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`, fontFamily: activeTheme.chartConfig.fontFamily, willChange: 'transform' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Background Grid */}
                        <div className="absolute inset-0 pointer-events-none opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #6366f1 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>

                        {/* Alignment Guides Layer */}
                        {guides.map((g, i) => (
                            <div
                                key={i}
                                className="absolute bg-cyan-400 z-50 pointer-events-none shadow-[0_0_4px_rgba(34,211,238,0.8)]"
                                style={{
                                    left: g.type === 'vertical' ? g.pos : 0,
                                    top: g.type === 'horizontal' ? g.pos : 0,
                                    width: g.type === 'vertical' ? '1px' : '100%',
                                    height: g.type === 'horizontal' ? '1px' : '100%',
                                }}
                            ></div>
                        ))}

                        {/* Group Containers (Background Layers) */}
                        {data.groups.map((group, idx) => {
                            const lc = getLayoutConstants();
                            const startX = lc.startX + idx * lc.groupPaddingX;
                            const startY = lc.startY;
                            const width = lc.groupWidth;
                            // Edge-aware symmetry calculation:
                            // The margin between the container's inner edges and the nodes is controlled by innerPaddingY.
                            const nodesInGroup = group.nodes;
                            const { headerOffset, innerPaddingY, nodeGap, bottomSafeMargin = 12 } = lc;

                            // 严格对称的容器高度计算：
                            // 容器总高度 = 顶部标题区域 + 顶部留白 + (所有节点高度之和) + (所有中间缝隙之和) + 底部留白 + 安全余量
                            // 独立计算内容区的总高度，不依赖外部 positions 状态以保证稳定性
                            const contentHeight = nodesInGroup.reduce((sum, n, i) => {
                                const h = getNodeHeight(n);
                                const gap = (i < nodesInGroup.length - 1) ? nodeGap : 0;
                                return sum + h + gap;
                            }, 0);

                            const height = nodesInGroup.length > 0
                                ? (headerOffset + innerPaddingY + contentHeight + innerPaddingY + bottomSafeMargin)
                                : (headerOffset + 60);

                            let groupClasses = '';
                            let groupStyle: React.CSSProperties = { left: startX, top: startY, width, height };

                            const isHex = group.colorTheme?.startsWith('#');

                            if (group.colorTheme) {
                                if (isHex) {
                                    groupStyle.borderColor = `${group.colorTheme}80`;
                                    groupClasses = 'border-2 border-dashed';
                                } else {
                                    const theme = COLOR_OPTIONS.find(c => c.value === group.colorTheme);
                                    if (theme) groupClasses = `border-2 border-dashed ${theme.bg.replace('/50', '/80')} ${theme.border.replace('/200', '/500')}`;
                                }
                            } else {
                                const colors = [
                                    'bg-indigo-50/70 border-indigo-200/70',
                                    'bg-emerald-50/70 border-emerald-200/70',
                                    'bg-amber-50/70 border-amber-200/70'
                                ];
                                groupClasses = `border-2 border-dashed ${colors[idx % colors.length]}`;
                            }

                            // Apply custom fill color with opacity (overrides theme bg)
                            if (group.config?.backgroundColor) {
                                const opacity = group.config?.fillOpacity ?? 0.25;
                                groupStyle.backgroundColor = `${group.config.backgroundColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
                            } else if (group.colorTheme && isHex) {
                                groupStyle.backgroundColor = `${group.colorTheme}40`;
                            }

                            if (group.config?.borderWidth !== undefined) {
                                groupStyle.borderWidth = `${group.config.borderWidth}px`;
                            }

                            return (
                                <div
                                    key={`group-${group.id}`}
                                    className={`absolute rounded-2xl ${groupClasses}`}
                                    style={groupStyle}
                                >
                                    <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group/grouptop ${editingGroupId === group.id ? 'z-[110]' : 'z-10'}`}>
                                        <div className="flex items-center gap-2 group/title relative">
                                            <div
                                                className={`bg-white border rounded-lg shadow-sm text-sm uppercase text-slate-800 tracking-wider cursor-pointer hover:text-indigo-600 hover:border-indigo-300 transition-all whitespace-nowrap flex items-center justify-center leading-none ${editingGroupId === group.id ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-md' : 'border-slate-200'}`}
                                                style={{
                                                    paddingLeft: group.config?.titlePaddingX !== undefined ? `${group.config.titlePaddingX}px` : '24px',
                                                    paddingRight: group.config?.titlePaddingX !== undefined ? `${group.config.titlePaddingX}px` : '24px',
                                                    paddingTop: group.config?.titlePaddingY !== undefined ? `${group.config.titlePaddingY}px` : '10px',
                                                    paddingBottom: group.config?.titlePaddingY !== undefined ? `${group.config.titlePaddingY}px` : '10px',
                                                    fontFamily: group.config?.titleFontFamily && group.config.titleFontFamily !== 'inherit' ? group.config.titleFontFamily : undefined,
                                                    fontSize: group.config?.titleSize ? `${group.config.titleSize}pt` : undefined,
                                                    fontWeight: group.config?.titleFontWeight || '900',
                                                    fontStyle: group.config?.titleFontStyle || 'normal',
                                                    backgroundColor: group.config?.titleBgColor || undefined,
                                                    color: group.config?.titleTextColor || undefined,
                                                }}
                                                onDoubleClick={() => setEditingGroupId(group.id)}
                                                onClick={(e) => { e.stopPropagation(); setEditingGroupId(group.id); }}
                                                title="双击或点击编辑组标题"
                                            >
                                                {group.title}
                                            </div>
                                            <div className="absolute left-full ml-2 flex gap-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setEditingGroupId(group.id); }}
                                                    className={`w-7 h-7 rounded-full bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 flex items-center justify-center transition-all shadow-sm ${editingGroupId === group.id ? 'opacity-100 border-indigo-200 text-indigo-600' : 'opacity-0 group-hover/title:opacity-100'}`}
                                                >
                                                    <i className="fa-solid fa-pen text-[10px]"></i>
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleGroupDelete(group.id); }}
                                                    className="w-7 h-7 rounded-full bg-white border border-slate-100 text-rose-400 hover:text-rose-600 flex items-center justify-center opacity-0 group-hover/title:opacity-100 transition-all shadow-sm"
                                                    title="删除分组"
                                                >
                                                    <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="absolute -top-4 right-6 z-10">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onAddNode(group.id); }}
                                            className={`w-8 h-8 rounded-full bg-white border border-indigo-200 text-indigo-500 shadow-md flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all active:scale-95 ${editingGroupId === group.id ? 'scale-100 opacity-100' : 'scale-0 opacity-0 group-hover/grouptop:scale-100 group-hover/grouptop:opacity-100'}`}
                                            title="Add Node to Group"
                                        >
                                            <i className="fa-solid fa-plus text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Composite Nodes */}
                        {data.groups.map((group) => (
                            <React.Fragment key={group.id}>
                                {group.nodes.map(node => {
                                    const pos = positions[node.id] || { x: 0, y: 0 };
                                    return (
                                        <StructuralNode
                                            key={node.id}
                                            node={node}
                                            position={pos}
                                            isDragging={dragNodeId === node.id}
                                            isEditing={editingId === node.id}
                                            isConnectingSource={connectSourceId === node.id}
                                            onMouseDown={onNodeMouseDown}
                                            onClick={(e) => onNodeClick(e, node.id)}
                                            setEditingId={setEditingId}
                                            onUpdateNode={onNodeUpdate}
                                            onDeleteNode={onNodeDelete}
                                            activeTheme={activeTheme}
                                            documentColors={documentColors}
                                        />
                                    );
                                })}
                            </React.Fragment>
                        ))}

                        <StepEdgeLayer
                            connections={data.connections}
                            nodePositions={positions}
                            containerRef={containerRef}
                            scale={scale}
                            editingConnectionIndex={editingConnectionIndex}
                            setEditingConnectionIndex={setEditingConnectionIndex}
                            onConnectionLabelUpdate={onConnectionLabelUpdate}
                            onConnectionUpdate={onConnectionUpdate}
                            onDeleteConnection={onConnectionDelete}
                            documentColors={documentColors}
                        />
                    </div>
                </div>
            </div>

            {/* Navigation Info HUD */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 no-print pointer-events-none">
                <div className="bg-slate-900/80 backdrop-blur-md px-6 py-2.5 rounded-full flex items-center gap-3 shadow-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <i className="fa-solid fa-mouse-pointer text-indigo-400 text-xs"></i>
                    <span className="text-[10px] font-black text-slate-100 uppercase tracking-widest">
                        Alt + 左键平移 | Ctrl + 滚轮缩放 | 双击修改
                    </span>
                </div>
            </div>
        </div>
    );
};
