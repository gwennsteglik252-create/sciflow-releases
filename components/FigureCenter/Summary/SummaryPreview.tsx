import React from 'react';
import CircularCanvas from './CircularCanvas';
import { CircularSummaryData, SummarySegment } from '../../../types';

interface SummaryPreviewProps {
    data: CircularSummaryData | null;
    isGenerating: boolean;
    zoom: number;
    setZoom: React.Dispatch<React.SetStateAction<number>>;
    pan: { x: number, y: number };
    setPan: React.Dispatch<React.SetStateAction<{ x: number, y: number }>>;
    isPanning: boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: () => void;
    onWheel: (e: React.WheelEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onSegmentClick: (layerId: string, segment: SummarySegment) => void;
    onCoreClick: () => void;
    containerRef: React.RefObject<HTMLDivElement | null>;
    canUndo?: boolean;
    canRedo?: boolean;
    onUndo?: () => void;
    onRedo?: () => void;
}

export const SummaryPreview: React.FC<SummaryPreviewProps> = ({
    data, isGenerating, zoom, setZoom, pan, setPan, isPanning,
    onMouseDown, onMouseMove, onMouseUp, onWheel, onTouchStart, onTouchMove, onSegmentClick, onCoreClick, containerRef,
    canUndo, canRedo, onUndo, onRedo
}) => {

    const handleZoomIn = (e: React.MouseEvent) => {
        e.stopPropagation();
        setZoom(prev => Math.min(3, prev + 0.15));
    };

    const handleZoomOut = (e: React.MouseEvent) => {
        e.stopPropagation();
        setZoom(prev => Math.max(0.2, prev - 0.15));
    };

    const handleResetView = (e: React.MouseEvent) => {
        e.stopPropagation();
        setZoom(0.7);
        setPan({ x: 0, y: 0 });
    };

    return (
        <main
            className={`flex-1 bg-transparent relative overflow-hidden flex flex-col items-center justify-center group ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
        >
            {/* 抓取平移层 */}
            <div className="absolute inset-0 z-0 pointer-events-auto" onMouseDown={onMouseDown}></div>

            {/* Floating Undo/Redo Controls - Top Left */}
            <div className="absolute top-6 left-6 z-[100] flex items-center gap-2 no-print pointer-events-auto">
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
                        title="重做 (Ctrl+Shift+Z)"
                    >
                        <i className="fa-solid fa-rotate-right text-xs mb-0.5"></i>
                        <span className="text-[7px] font-black uppercase">Redo</span>
                    </button>
                </div>
            </div>

            {/* Floating Zoom Controls - Top Right */}
            <div className="absolute top-6 right-6 z-[100] flex items-center gap-2 no-print pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
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
                        onClick={handleResetView}
                        className="flex flex-col items-center justify-center hover:bg-indigo-50 px-2 py-1 rounded-lg transition-all active:scale-95"
                        title="复位视图"
                    >
                        <span className="text-[11px] font-black text-slate-800 font-mono leading-none">{Math.round(zoom * 100)}%</span>
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

            {/* 核心画布容器：通过 absolute inset-0 和 flex 居中，确保完全上下左右对齐 */}
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none z-10">
                <div
                    ref={containerRef}
                    className="relative origin-center pointer-events-auto shrink-0"
                    style={{
                        transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                        willChange: 'transform'
                    }}
                >
                    {data ? (
                        <div className="overflow-visible shrink-0 p-12">
                            <CircularCanvas data={data} setZoom={setZoom} onSegmentClick={onSegmentClick} onCoreClick={onCoreClick} />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center opacity-30 gap-6 p-12 aspect-square h-[70vmin] min-h-[500px] max-h-[950px]">
                            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg border border-slate-100">
                                {isGenerating ? <i className="fa-solid fa-circle-notch animate-spin text-5xl text-indigo-600"></i> : (
                                    <div className="relative">
                                        <i className="fa-solid fa-circle-nodes text-5xl text-slate-300"></i>
                                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/20 to-transparent rounded-full animate-pulse"></div>
                                    </div>
                                )}
                            </div>
                            <div className="text-center">
                                <p className="text-lg font-black uppercase tracking-[0.5rem] italic text-slate-800">等待视觉逻辑建模</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Awaiting Visualization Synthesis</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="absolute bottom-10 right-10 flex gap-4 no-print opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-white/80 backdrop-blur-md border border-slate-200 px-4 py-2 rounded-2xl flex items-center gap-2 shadow-xl">
                    <i className="fa-solid fa-mouse text-indigo-600"></i>
                    <span className="text-[10px] font-black text-slate-500 uppercase">左键拖拽平移 | Ctrl + 滚轮缩放</span>
                </div>
            </div>
        </main>
    );
};