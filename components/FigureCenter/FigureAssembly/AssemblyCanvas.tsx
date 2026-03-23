import React from 'react';
import { FigurePanelItem } from './FigurePanelItem';
import { FigurePanel, FigureText, FigureShape } from '../../../types';

interface AssemblyCanvasProps {
    containerRef: React.RefObject<HTMLDivElement | null>;
    canvasRef: React.RefObject<HTMLDivElement | null>;
    canvasWidth: number;
    canvasHeight: number;
    pan: { x: number, y: number };
    canvasScale: number;
    showGrid: boolean;
    gridSize: number;
    panels: FigurePanel[];
    activePanelId: string | null;
    imageFit: 'contain' | 'cover';
    selectedText: { panelId: string, textId: string } | null;
    selectedShape: { panelId: string, shapeId: string } | null;
    editingText: { panelId: string, textId: string } | null;
    FONT_FAMILIES: { name: string, value: string }[];
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onMouseDown: (e: React.MouseEvent, id: string) => void;
    onToggleSpan: (id: string, type: 'col' | 'row') => void;
    onAddText: (e: React.MouseEvent, panelId: string) => void;
    onAddTextAt: (e: React.MouseEvent, panelId: string) => void;
    onAddShape: (e: React.MouseEvent, panelId: string, type: 'arrow' | 'line' | 'rect' | 'circle' | 'bezier' | 'polygon' | 'freehand' | 'callout') => void;
    onDeletePanel: (e: React.MouseEvent, id: string) => void;
    onTextMouseDown: (e: React.MouseEvent, panelId: string, textId: string) => void;
    onTextDoubleClick: (panelId: string, textId: string) => void;
    onTextUpdate: (panelId: string, textId: string, updates: Partial<FigureText>, isBatch?: boolean) => void;
    onTextDelete: (panelId: string, textId: string) => void;
    onShapeMouseDown: (e: React.MouseEvent, panelId: string, shapeId: string, mode: 'move' | 'p1' | 'p2') => void;
    onShapeUpdate: (panelId: string, shapeId: string, updates: Partial<FigureShape>, isBatch?: boolean) => void;
    onShapeDelete: (panelId: string, shapeId: string) => void;
    onUpdatePanel: (id: string, updates: Partial<FigurePanel>) => void;
    onResizeStart?: (e: React.MouseEvent, panelId: string, mode: string) => void;
    onActivatePanel: (id: string | null) => void;
    onContainerMouseDown: (e: React.MouseEvent) => void;
    onWheel: (e: React.WheelEvent) => void;
    setCanvasScale: (v: number) => void;
    setPan: (v: { x: number, y: number }) => void;
    onBackgroundClick?: () => void;
    alignToolbar?: React.ReactNode;
    smartGuidesNode?: React.ReactNode;
    // 功能17: 拖拽外部文件
    onDrop?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    // 功能19: 多选+框选
    selectedPanelIds?: Set<string>;
    marquee?: { startX: number; startY: number; currentX: number; currentY: number } | null;
}

export const AssemblyCanvas: React.FC<AssemblyCanvasProps> = ({
    containerRef, canvasRef, canvasWidth, canvasHeight, pan, canvasScale, showGrid, gridSize, panels,
    activePanelId, imageFit, selectedText, selectedShape, editingText, FONT_FAMILIES,
    onUndo, onRedo, canUndo, canRedo,
    onMouseDown, onToggleSpan, onAddText, onAddTextAt, onAddShape, onDeletePanel, onTextMouseDown, onTextDoubleClick,
    onTextUpdate, onTextDelete, onShapeMouseDown, onShapeUpdate, onShapeDelete, onUpdatePanel, onResizeStart, onActivatePanel, onContainerMouseDown, onWheel,
    setCanvasScale, setPan, onBackgroundClick, alignToolbar, smartGuidesNode,
    onDrop, onDragOver, selectedPanelIds, marquee
}) => {
    return (
        <div className="flex-1 bg-slate-100 rounded-xl border border-slate-200 relative overflow-hidden flex flex-col shadow-inner group"
            onDrop={onDrop} onDragOver={onDragOver}
        >

            {/* Floating Undo/Redo Controls — Top Left (same as StructureCanvas) */}
            <div className="absolute top-6 left-6 z-40 flex items-center gap-2 no-print">
                <div className="flex bg-white/90 backdrop-blur-md rounded-lg shadow-xl px-2 py-1 border border-slate-200 items-center">
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

            {/* Align Toolbar (功能2) */}
            {alignToolbar}

            {/* Floating Zoom Controls — Top Right (same as StructureCanvas, hover visible) */}
            <div className="absolute top-6 right-6 z-40 flex items-center gap-2 no-print opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex bg-white/90 backdrop-blur-md rounded-lg shadow-xl px-2 py-1 border border-slate-200 items-center">
                    <button
                        onClick={() => setCanvasScale(Math.max(0.2, canvasScale - 0.1))}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors active:scale-90"
                        title="缩小"
                    >
                        <i className="fa-solid fa-minus text-[10px]"></i>
                    </button>
                    <div className="w-px h-4 bg-slate-100 mx-1"></div>
                    <button
                        onClick={() => { setPan({ x: 0, y: 0 }); setCanvasScale(1); }}
                        className="flex flex-col items-center justify-center hover:bg-indigo-50 px-2 py-1 rounded-lg transition-all active:scale-95"
                        title="复位视图"
                    >
                        <span className="text-[11px] font-black text-slate-800 font-mono leading-none">{Math.round(canvasScale * 100)}%</span>
                        <i className="fa-solid fa-compress text-[8px] text-indigo-400 mt-0.5"></i>
                    </button>
                    <div className="w-px h-4 bg-slate-100 mx-1"></div>
                    <button
                        onClick={() => setCanvasScale(Math.min(3, canvasScale + 0.1))}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors active:scale-90"
                        title="放大"
                    >
                        <i className="fa-solid fa-plus text-[10px]"></i>
                    </button>
                </div>
            </div>

            <div
                ref={containerRef}
                className="flex-1 overflow-hidden relative flex items-center justify-center cursor-grab active:cursor-grabbing"
                onMouseDown={onContainerMouseDown}
                onWheel={onWheel}
                onClick={onBackgroundClick}
            >
                <div
                    ref={canvasRef}
                    className="bg-white shadow-2xl relative origin-center"
                    style={{
                        width: canvasWidth,
                        height: canvasHeight,
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${canvasScale})`,
                        willChange: 'transform'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {showGrid && (
                        <div
                            className="absolute inset-0 pointer-events-none z-0 no-export grid-layer"
                            style={{
                                backgroundImage: 'radial-gradient(circle at 1px 1px, #cbd5e1 1px, transparent 0)',
                                backgroundSize: `${gridSize}px ${gridSize}px`
                            }}
                        />
                    )}

                    {/* Render panels sorted by zIndex (lower zIndex = rendered first = visually behind) */}
                    {[...panels]
                        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
                        .filter(panel => panel.visible !== false)
                        .map(panel => (
                            <FigurePanelItem
                                key={panel.id}
                                panel={panel}
                                isActive={activePanelId === panel.id}
                                imageFit={imageFit}
                                selectedText={selectedText}
                                selectedShape={selectedShape}
                                editingText={editingText}
                                onMouseDown={(e) => onMouseDown(e, panel.id)}
                                onToggleSpan={onToggleSpan}
                                onAddText={onAddText}
                                onAddTextAt={onAddTextAt}
                                onAddShape={onAddShape}
                                onDeletePanel={onDeletePanel}
                                onTextMouseDown={onTextMouseDown}
                                onTextDoubleClick={onTextDoubleClick}
                                onTextUpdate={onTextUpdate}
                                onTextDelete={onTextDelete}
                                onShapeMouseDown={onShapeMouseDown}
                                onShapeUpdate={onShapeUpdate}
                                onShapeDelete={onShapeDelete}
                                onUpdatePanel={onUpdatePanel}
                                onResizeStart={onResizeStart}
                                onActivate={() => onActivatePanel(panel.id)}
                                onDeactivate={() => onActivatePanel(null)}
                                FONT_FAMILIES={FONT_FAMILIES}
                            />
                        ))}
                    {panels.length === 0 && <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 pointer-events-none opacity-40"><i className="fa-solid fa-table-cells text-6xl mb-4"></i><p className="text-xl font-black uppercase tracking-[0.5rem]">拼版画布</p></div>}

                    {/* 智能参考线 (功能9) */}
                    {smartGuidesNode}

                    {/* 功能19: 多选面板高亮边框 */}
                    {selectedPanelIds && selectedPanelIds.size > 1 && panels.filter(p => selectedPanelIds.has(p.id) && p.id !== activePanelId).map(p => (
                        <div key={`sel-${p.id}`} className="absolute pointer-events-none z-[90] border-2 border-dashed border-amber-400 rounded" style={{ left: p.x, top: p.y, width: p.w, height: p.h }} />
                    ))}

                    {/* 功能19: 框选矩形 */}
                    {marquee && (() => {
                        const mx = Math.min(marquee.startX, marquee.currentX);
                        const my = Math.min(marquee.startY, marquee.currentY);
                        const mw = Math.abs(marquee.currentX - marquee.startX);
                        const mh = Math.abs(marquee.currentY - marquee.startY);
                        return <div className="absolute pointer-events-none z-[100] border-2 border-dashed border-indigo-500 bg-indigo-500/10 rounded" style={{ left: mx, top: my, width: mw, height: mh }} />;
                    })()}

                </div>
            </div>
        </div>
    );
};