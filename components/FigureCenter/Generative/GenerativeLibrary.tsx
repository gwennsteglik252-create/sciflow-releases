
import React, { RefObject, useRef, useState, useEffect } from 'react';
import { useGenerativeDesigner } from '../../../hooks/useGenerativeDesigner';
import { useProjectContext } from '../../../context/ProjectContext';
import { useTranslation } from '../../../locales/useTranslation';

interface GenerativeLibraryProps {
    logic: ReturnType<typeof useGenerativeDesigner>;
    libraryRef: RefObject<HTMLDivElement>;
}

export const GenerativeLibrary: React.FC<GenerativeLibraryProps> = ({ logic, libraryRef }) => {
    const {
        results, handleDownload, handleSelectForIteration,
        baseImage, regions, addRegion, setActiveRegionId, activeRegionId, deleteRegion,
        history, historyIndex, handleUndoHistory, handleRedoHistory, handleExitIteration
    } = logic;
    const { activeTheme } = useProjectContext();
    const { t } = useTranslation();
    const isLightMode = activeTheme.type === 'light';

    // Drawing State
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [currentDragRect, setCurrentDragRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

    // Pan & Zoom State
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    // Reset zoom on image change
    useEffect(() => {
        setScale(1);
        setPan({ x: 0, y: 0 });
    }, [baseImage]);

    const handleWheel = (e: React.WheelEvent) => {
        // Ctrl/Meta + Wheel to Zoom
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const zoomFactor = 0.1;
            const direction = e.deltaY > 0 ? -1 : 1;
            const newScale = Math.min(Math.max(scale + direction * zoomFactor, 0.5), 5);
            setScale(newScale);
        } else {
            // Standard Wheel to Pan
            e.preventDefault(); // Fix: Prevent native browser scrolling to avoid jitter/lag
            // Damping factor to reduce sensitivity
            const damping = 0.5;
            const newX = pan.x - e.deltaX * damping;
            const newY = pan.y - e.deltaY * damping;

            // Tight bounds to prevent getting lost (e.g. 2000px range)
            const limit = 2000;

            setPan({
                x: Math.max(-limit, Math.min(limit, newX)),
                y: Math.max(-limit, Math.min(limit, newY))
            });
        }
    };

    const handleContainerMouseDown = (e: React.MouseEvent) => {
        // Middle click (button 1) or Space + Left Click for panning
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            e.preventDefault();
            setIsPanning(true);
            setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        }
    };

    const handleContainerMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setPan({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            });
        }
    };

    const handleContainerMouseUp = () => {
        setIsPanning(false);
    };

    // Coordinate Normalization (0-1000)
    const getNormalizedCoords = (e: React.MouseEvent) => {
        if (!imgRef.current) return { x: 0, y: 0 };

        const rect = imgRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

        const normX = (x / rect.width) * 1000;
        const normY = (y / rect.height) * 1000;
        return { x: normX, y: normY };
    };

    const handleImgMouseDown = (e: React.MouseEvent) => {
        if (!baseImage || isPanning) return;
        if (e.button !== 0 || e.altKey) return;

        if ((e.target as HTMLElement).closest('.region-delete-btn')) return;

        e.preventDefault();
        e.stopPropagation();

        setIsDrawing(true);
        const pos = getNormalizedCoords(e);
        setStartPos(pos);
        setCurrentDragRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
        setActiveRegionId(null);
    };

    const handleImgMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing || !baseImage || !currentDragRect) return;
        const current = getNormalizedCoords(e);

        const x = Math.min(startPos.x, current.x);
        const y = Math.min(startPos.y, current.y);
        const w = Math.abs(current.x - startPos.x);
        const h = Math.abs(current.y - startPos.y);

        setCurrentDragRect({ x, y, w, h });
    };

    const handleImgMouseUp = () => {
        if (isDrawing && currentDragRect && currentDragRect.w > 10 && currentDragRect.h > 10) {
            addRegion(currentDragRect.x, currentDragRect.y, currentDragRect.w, currentDragRect.h);
        }
        setIsDrawing(false);
        setCurrentDragRect(null);
    };

    // Render Iteration Mode (Annotation View)
    if (baseImage) {
        return (
            <main className="col-span-12 lg:col-span-8 xl:col-span-9 flex flex-col min-h-0 overflow-hidden relative">
                <div className={`flex-1 bg-slate-900/5 backdrop-blur-sm rounded-[3rem] border border-white/10 shadow-inner p-6 flex flex-col relative`}>

                    <div className="flex justify-between items-center mb-4 shrink-0 px-2">
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter flex items-center gap-2">
                                <i className="fa-solid fa-crop-simple text-amber-500"></i>
                                {t('figureCenter.generative.multiRegion')}
                            </h3>
                            <div className="flex bg-white/60 rounded-xl p-1 border border-slate-200 shadow-sm items-center">
                                <button
                                    onClick={handleUndoHistory}
                                    disabled={historyIndex <= 0}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all text-slate-600"
                                    title={t('figureCenter.generative.undo')}
                                >
                                    <i className="fa-solid fa-rotate-left"></i>
                                </button>
                                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                                <button
                                    onClick={handleRedoHistory}
                                    disabled={historyIndex >= history.length - 1}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all text-slate-600"
                                    title={t('figureCenter.generative.redo')}
                                >
                                    <i className="fa-solid fa-rotate-right"></i>
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-amber-100 flex items-center gap-2">
                                <i className="fa-solid fa-layer-group"></i>
                                {regions.length > 0 ? t('figureCenter.generative.selectedRegions').replace('{n}', String(regions.length)) : t('figureCenter.generative.dragHint')}
                            </div>
                            <button
                                onClick={handleExitIteration}
                                className="px-4 py-2 bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-95"
                            >
                                {t('figureCenter.generative.exit')}
                            </button>
                        </div>
                    </div>

                    <div
                        ref={containerRef}
                        className={`flex-1 relative flex items-center justify-center bg-slate-200/50 rounded-3xl overflow-hidden border-2 border-dashed border-slate-300 select-none group ${isPanning ? 'cursor-grabbing' : 'cursor-crosshair'}`}
                        onMouseDown={handleContainerMouseDown}
                        onMouseMove={handleContainerMouseMove}
                        onMouseUp={handleContainerMouseUp}
                        onMouseLeave={handleContainerMouseUp}
                        onWheel={handleWheel}
                    >
                        <div
                            className="relative shadow-2xl origin-center"
                            style={{
                                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                                willChange: 'transform' // Fix: Optimize rendering performance
                            }}
                        >
                            <img
                                ref={imgRef}
                                src={baseImage}
                                alt="Iteration Base"
                                className="max-w-[80vw] max-h-[70vh] object-contain block pointer-events-none"
                                style={{ userSelect: 'none' }}
                            />

                            {/* Interactive Overlay Layer */}
                            <div
                                className="absolute inset-0 z-10"
                                onMouseDown={handleImgMouseDown}
                                onMouseMove={handleImgMouseMove}
                                onMouseUp={handleImgMouseUp}
                            />

                            {/* Existing Regions */}
                            {regions.map((r, idx) => (
                                <div
                                    key={r.id}
                                    className={`absolute border-2 z-20 transition-all cursor-pointer group/region ${activeRegionId === r.id ? 'border-indigo-500 bg-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'border-amber-400 bg-amber-400/10 hover:bg-amber-400/20'}`}
                                    style={{
                                        left: `${r.x / 10}%`,
                                        top: `${r.y / 10}%`,
                                        width: `${r.w / 10}%`,
                                        height: `${r.h / 10}%`
                                    }}
                                    onClick={(e) => { e.stopPropagation(); setActiveRegionId(r.id); }}
                                >
                                    <div
                                        className={`absolute -top-4 left-0 px-1.5 py-0.5 rounded text-[8px] font-black uppercase shadow-sm whitespace-nowrap flex items-center gap-1 origin-bottom-left ${activeRegionId === r.id ? 'bg-indigo-600 text-white' : 'bg-amber-400 text-white'}`}
                                        style={{ transform: `scale(${1 / (scale || 1)})` }}
                                    >
                                        #{idx + 1}
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteRegion(r.id); }}
                                        className="region-delete-btn absolute -top-4 -right-4 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/region:opacity-100 transition-opacity hover:scale-110 shadow-sm z-30"
                                        style={{ transform: `scale(${Math.max(0.5, 1 / (scale || 1))})` }}
                                    >
                                        <i className="fa-solid fa-times text-[10px]"></i>
                                    </button>
                                </div>
                            ))}

                            {/* Current Dragging Rect */}
                            {isDrawing && currentDragRect && (
                                <div
                                    className="absolute border-2 border-slate-900 bg-slate-900/10 z-30 pointer-events-none border-dashed"
                                    style={{
                                        left: `${currentDragRect.x / 10}%`,
                                        top: `${currentDragRect.y / 10}%`,
                                        width: `${currentDragRect.w / 10}%`,
                                        height: `${currentDragRect.h / 10}%`
                                    }}
                                />
                            )}
                        </div>

                        {regions.length === 0 && !isDrawing && !isPanning && (
                            <div className="absolute bottom-6 bg-black/70 text-white px-4 py-2 rounded-full text-xs font-bold backdrop-blur-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity animate-bounce z-50">
                                {t('figureCenter.generative.dragToSelect')}
                            </div>
                        )}
                    </div>

                    <div className="mt-4 text-center flex justify-center gap-4">
                        <p className="text-[10px] text-slate-400 font-mono">
                            {regions.length > 0
                                ? `${regions.length} active regions. Configure instructions in sidebar.`
                                : 'Global Context Mode (No specific regions)'} | Scale: {scale.toFixed(1)}x
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    // Render Gallery Mode (Default)
    return (
        <main className="col-span-12 lg:col-span-8 xl:col-span-9 flex flex-col min-h-0 overflow-hidden relative">
            <div ref={libraryRef} className={`flex-1 bg-white/40 backdrop-blur-sm rounded-[3rem] border ${isLightMode ? 'border-slate-200' : 'border-white/10'} shadow-inner p-6 pb-20 overflow-y-auto custom-scrollbar flex flex-col gap-6 items-center`}>
                {results.length > 0 ? (
                    results.map((res, idx) => (
                        <div key={idx} className="w-full max-w-4xl bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden animate-reveal group shrink-0">
                            <div className="relative aspect-auto bg-slate-50 flex items-center justify-center min-h-[300px] p-4">
                                <img src={res.url} alt="Scientific Figure" className="w-full h-auto rounded-xl shadow-sm" />
                            </div>
                            <div className="px-6 py-4 bg-white border-t border-slate-50 flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${res.style.includes('Iterated') ? 'bg-amber-100 text-amber-700' : 'bg-slate-900 text-white'}`}>{res.style}</span>
                                        <button
                                            onClick={() => handleSelectForIteration(res)}
                                            className="text-amber-500 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 border border-transparent hover:border-amber-100 group/edit"
                                            title={t('figureCenter.generative.iterateOn')}
                                        >
                                            <i className="fa-solid fa-pen-to-square text-[10px]"></i>
                                            <span className="text-[9px] font-bold group-hover/edit:underline">{t('figureCenter.generative.enterIteration')}</span>
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleDownload(res.url)}
                                            className="text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 border border-transparent hover:border-indigo-100"
                                        >
                                            <i className="fa-solid fa-download text-[10px]"></i>
                                            <span className="text-[9px] font-bold">{t('figureCenter.generative.download')}</span>
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[8px] font-bold text-slate-400 truncate w-full" title={res.prompt}>
                                    <i className="fa-solid fa-quote-left mr-1 opacity-50"></i> {res.prompt}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 gap-4 py-10">
                        <i className="fa-solid fa-image text-4xl text-slate-300"></i>
                        <h4 className="text-xl font-black text-slate-800 uppercase tracking-[0.4rem] italic">{t('figureCenter.generative.emptyGallery')}</h4>
                    </div>
                )}
            </div>
        </main>
    );
};
