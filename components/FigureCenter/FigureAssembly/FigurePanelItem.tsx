import React, { useState, useEffect } from 'react';
import { FigurePanel, FigureText, FigureShape } from '../../../types';
import { PanelControls } from './PanelControls';
import { TextOverlay } from './TextOverlay';
import { ShapeOverlay } from './ShapeOverlay';
import { CropOverlay } from './CropOverlay';
import { ScaleBarOverlay, DEFAULT_SCALE_BAR } from './ScaleBarOverlay';

interface FigurePanelItemProps {
    panel: FigurePanel;
    isActive: boolean;
    imageFit: 'contain' | 'cover';
    selectedText: { panelId: string, textId: string } | null;
    selectedShape: { panelId: string, shapeId: string } | null;
    editingText: { panelId: string, textId: string } | null;
    onMouseDown: (e: React.MouseEvent) => void;
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
    onUpdatePanel?: (id: string, updates: Partial<FigurePanel>) => void;
    onResizeStart?: (e: React.MouseEvent, panelId: string, mode: string) => void;
    onActivate: () => void;
    onDeactivate?: () => void;
    FONT_FAMILIES: { name: string, value: string }[];
}

export const FigurePanelItem: React.FC<FigurePanelItemProps> = ({
    panel, isActive, imageFit, selectedText, selectedShape, editingText,
    onMouseDown, onToggleSpan, onAddText, onAddTextAt, onAddShape, onDeletePanel,
    onTextMouseDown, onTextDoubleClick, onTextUpdate, onTextDelete,
    onShapeMouseDown, onShapeUpdate, onShapeDelete, onUpdatePanel, onResizeStart, onActivate, onDeactivate,
    FONT_FAMILIES
}) => {
    const [showLabelTools, setShowLabelTools] = useState(false);
    const [imgError, setImgError] = useState(false);
    const [isCropping, setIsCropping] = useState(false);
    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const [showBorderPanel, setShowBorderPanel] = useState(false);
    const [localLabelSize, setLocalLabelSize] = useState<string | number>(panel.labelFontSize || 40);
    const [localLabelPadding, setLocalLabelPadding] = useState<string | number>(panel.labelPadding ?? 0);

    useEffect(() => {
        setLocalLabelSize(panel.labelFontSize || 40);
    }, [panel.labelFontSize]);

    useEffect(() => {
        setLocalLabelPadding(panel.labelPadding ?? 0);
    }, [panel.labelPadding]);

    const handleLabelSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalLabelSize(val);
        const parsed = parseInt(val);
        if (!isNaN(parsed)) {
            onUpdatePanel?.(panel.id, { labelFontSize: parsed });
        }
    };

    const handleLabelPaddingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalLabelPadding(val);
        const parsed = parseInt(val);
        if (!isNaN(parsed)) {
            onUpdatePanel?.(panel.id, { labelPadding: parsed });
        }
    };

    return (
        <div
            className={`absolute group transition-colors duration-200 bg-gray-50/20 ${isActive ? 'z-30 shadow-2xl' : 'hover:border-indigo-300 z-10'} ${panel.locked ? 'cursor-not-allowed' : ''}`}
            style={{
                left: panel.x, top: panel.y, width: panel.w, height: panel.h,
                cursor: panel.locked ? 'not-allowed' : 'move',
                opacity: panel.opacity ?? 1,
                zIndex: panel.zIndex ?? 10,
                // 功能11: 边框控制
                border: panel.border
                    ? `${panel.border.width}px solid ${panel.border.color}`
                    : isActive ? '2px solid #6366f1' : '2px solid transparent',
                borderRadius: panel.border ? panel.border.radius : 0,
                // 功能12: 旋转翻转
                transform: [
                    panel.rotation ? `rotate(${panel.rotation}deg)` : '',
                    panel.flipH ? 'scaleX(-1)' : '',
                    panel.flipV ? 'scaleY(-1)' : '',
                ].filter(Boolean).join(' ') || undefined,
            }}
            onMouseDown={onMouseDown}
            onContextMenu={(e) => { e.preventDefault(); onAddTextAt(e, panel.id); }}
        >
            {/* Lock indicator overlay */}
            {panel.locked && (
                <div className="absolute inset-0 flex items-start justify-end p-1.5 pointer-events-none z-[200]">
                    <span className="bg-amber-400/90 text-amber-900 rounded-full w-5 h-5 flex items-center justify-center shadow-sm text-[9px]">🔒</span>
                </div>
            )}

            {/* Main Image — apply crop via overflow hidden + scaled image */}
            {(() => {
                // 功能10: 图片滤镜 CSS filter
                const f = panel.filters;
                const filterCSS = f ? `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) hue-rotate(${f.hueRotate}deg)` : undefined;
                return imgError ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 gap-2">
                        <i className="fa-regular fa-image text-3xl opacity-50"></i>
                        <span className="text-[8px] font-bold uppercase">图片加载失败</span>
                    </div>
                ) : panel.crop ? (
                    <div className="w-full h-full overflow-hidden relative">
                        <img
                            src={panel.imgUrl}
                            className="w-full h-full object-cover pointer-events-none"
                            alt="panel"
                            onError={() => setImgError(true)}
                            style={{
                                transformOrigin: '0 0',
                                transform: `translate(${-panel.crop.x / panel.crop.w * 100}%, ${-panel.crop.y / panel.crop.h * 100}%) scale(${1 / panel.crop.w}, ${1 / panel.crop.h})`,
                                filter: filterCSS,
                            }}
                        />
                        {panel.pseudoColor && <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: panel.pseudoColor, mixBlendMode: 'color', opacity: 0.7 }} />}
                    </div>
                ) : (
                    <div className="w-full h-full relative">
                        <img
                            src={panel.imgUrl}
                            className={`w-full h-full object-${imageFit} pointer-events-none bg-transparent rounded-sm`}
                            alt="panel"
                            onError={() => setImgError(true)}
                            style={{ filter: filterCSS }}
                        />
                        {panel.pseudoColor && <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: panel.pseudoColor, mixBlendMode: 'color', opacity: 0.7 }} />}
                    </div>
                );
            })()}

            {/* Scale Bar (功能3) */}
            {panel.scaleBar && (
                <ScaleBarOverlay
                    config={panel.scaleBar}
                    isActive={isActive}
                    onUpdate={updates => onUpdatePanel?.(panel.id, { scaleBar: { ...panel.scaleBar!, ...updates } })}
                    onDelete={() => onUpdatePanel?.(panel.id, { scaleBar: undefined } as any)}
                />
            )}

            {/* Crop Mode Overlay */}
            {isCropping && (
                <CropOverlay
                    panelW={panel.w}
                    panelH={panel.h}
                    imgUrl={panel.imgUrl}
                    initialCrop={panel.crop}
                    onConfirm={(crop) => {
                        onUpdatePanel?.(panel.id, { crop });
                        setIsCropping(false);
                    }}
                    onCancel={() => setIsCropping(false)}
                    onReset={() => {
                        onUpdatePanel?.(panel.id, { crop: undefined } as any);
                        setIsCropping(false);
                    }}
                />
            )}

            {/* Complete Button */}
            {isActive && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDeactivate?.(); }}
                    className="absolute -top-4 -right-4 w-10 h-10 bg-emerald-500 text-white rounded-full flex flex-col items-center justify-center shadow-xl z-[100] hover:bg-emerald-600 transition-all active:scale-95 no-export border-2 border-white"
                    title="完成编辑"
                >
                    <i className="fa-solid fa-check text-sm leading-none"></i>
                    <span className="text-[7px] font-black uppercase leading-none mt-0.5">完成</span>
                </button>
            )}

            {/* Label Badge with Dynamic Padding */}
            <div
                className="absolute top-0 z-[60]"
                style={{
                    right: '100%',
                    marginRight: `${panel.labelPadding ?? 0}px`
                }}
                onMouseDown={(e) => { e.stopPropagation(); onActivate(); }}
                onDoubleClick={(e) => { e.stopPropagation(); setShowLabelTools(true); }}
            >
                <div
                    onClick={(e) => { e.stopPropagation(); setShowLabelTools(true); }}
                    className={`cursor-pointer px-2 py-0.5 rounded transition-all hover:bg-slate-100 ${showLabelTools ? 'ring-2 ring-indigo-400 bg-white shadow-lg' : ''}`}
                >
                    <span style={{
                        fontFamily: panel.labelFontFamily || 'Arial, sans-serif',
                        fontSize: panel.labelFontSize || 40,
                        fontWeight: panel.labelFontWeight || 'bold',
                        fontStyle: panel.labelFontStyle || 'normal',
                        lineHeight: 1
                    }} className="text-slate-900 select-none whitespace-nowrap">
                        {panel.label}
                    </span>
                </div>

                {/* Label Editing Toolbar */}
                {showLabelTools && isActive && (
                    <div className="absolute top-0 right-full mr-4 bg-white text-slate-800 rounded-lg shadow-2xl p-4 flex flex-col gap-3 z-[70] animate-reveal border border-slate-200 w-64 origin-top-right no-export transform translate-y-0">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-1">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-10px font-black uppercase text-slate-500 tracking-widest leading-none">Label Style</span>
                                    <i className="fa-solid fa-link text-indigo-400 text-[8px]" title="联动模式：更改将应用到所有序号"></i>
                                </div>
                                <span className="text-[6px] font-black text-indigo-400 uppercase tracking-tighter mt-1 opacity-60">默认设定</span>
                            </div>
                            <button onClick={() => setShowLabelTools(false)} className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-colors shadow-sm"><i className="fa-solid fa-times text-[9px]"></i></button>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Font Family</label>
                            <select
                                className="w-full bg-slate-50 text-xs font-bold rounded-xl px-2 py-2 outline-none border border-slate-200 cursor-pointer hover:border-indigo-400 transition-colors text-slate-700 shadow-inner"
                                value={panel.labelFontFamily || 'Arial, sans-serif'}
                                onChange={(e) => onUpdatePanel?.(panel.id, { labelFontFamily: e.target.value })}
                            >
                                {FONT_FAMILIES.map(f => <option key={f.name} value={f.value}>{f.name}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Size (px)</label>
                                <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 p-0.5 shadow-inner">
                                    <button onClick={() => onUpdatePanel?.(panel.id, { labelFontSize: Math.max(8, (panel.labelFontSize || 40) - 1) })} className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-lg transition-colors text-slate-500 hover:text-indigo-600 shadow-sm"><i className="fa-solid fa-minus text-[8px]"></i></button>
                                    <input
                                        type="number"
                                        step="1"
                                        className="flex-1 min-w-0 bg-transparent text-center text-[11px] font-black text-slate-700 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        value={localLabelSize === 0 ? '' : localLabelSize}
                                        onChange={handleLabelSizeChange}
                                        onClick={(e) => (e.target as HTMLInputElement).select()}
                                    />
                                    <button onClick={() => onUpdatePanel?.(panel.id, { labelFontSize: Math.min(200, (panel.labelFontSize || 40) + 1) })} className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-lg transition-colors text-slate-500 hover:text-indigo-600 shadow-sm"><i className="fa-solid fa-plus text-[8px]"></i></button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Style</label>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => onUpdatePanel?.(panel.id, { labelFontWeight: panel.labelFontWeight === 'bold' ? 'normal' : 'bold' })}
                                        className={`flex-1 h-[30px] flex items-center justify-center rounded-xl border transition-all shadow-sm ${panel.labelFontWeight === 'bold' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-white hover:border-indigo-300'}`}
                                        title="Toggle Bold"
                                    >
                                        <i className="fa-solid fa-bold text-[10px]"></i>
                                    </button>
                                    <button
                                        onClick={() => onUpdatePanel?.(panel.id, { labelFontStyle: panel.labelFontStyle === 'italic' ? 'normal' : 'italic' })}
                                        className={`flex-1 h-[30px] flex items-center justify-center rounded-xl border transition-all shadow-sm ${panel.labelFontStyle === 'italic' ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-white hover:border-indigo-300'}`}
                                        title="Toggle Italic"
                                    >
                                        <i className="fa-solid fa-italic text-[10px]"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1 border-t border-slate-100 pt-2">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Distance (px)</label>
                            <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 p-0.5 shadow-inner w-1/2">
                                <button onClick={() => onUpdatePanel?.(panel.id, { labelPadding: Math.max(0, (panel.labelPadding ?? 0) - 1) })} className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-lg transition-colors text-slate-500 hover:text-indigo-600 shadow-sm"><i className="fa-solid fa-minus text-[8px]"></i></button>
                                <input
                                    type="number"
                                    step="1"
                                    className="flex-1 min-w-0 bg-transparent text-center text-[11px] font-black text-slate-700 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    value={localLabelPadding === 0 ? '' : localLabelPadding}
                                    onChange={handleLabelPaddingChange}
                                    onClick={(e) => (e.target as HTMLInputElement).select()}
                                />
                                <button onClick={() => onUpdatePanel?.(panel.id, { labelPadding: (panel.labelPadding ?? 0) + 1 })} className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-lg transition-colors text-slate-500 hover:text-indigo-600 shadow-sm"><i className="fa-solid fa-plus text-[8px]"></i></button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls - Only visible when active and NOT cropping */}
            {isActive && !isCropping && (
                <>
                    <PanelControls
                        spanCols={panel.spanCols || 1}
                        spanRows={panel.spanRows || 1}
                        hasCrop={!!panel.crop}
                        onToggleSpan={(type) => onToggleSpan(panel.id, type)}
                        onAddText={(e) => onAddText(e, panel.id)}
                        onAddShape={(type, e) => onAddShape(e, panel.id, type)}
                        onCrop={(e) => { e.stopPropagation(); setIsCropping(true); }}
                        onDelete={(e) => onDeletePanel(e, panel.id)}
                    />
                    {/* Scale Bar toggle (功能3) */}
                    <button
                        className="absolute -top-9 right-24 no-export bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 text-[8px] font-black text-teal-600 hover:bg-teal-50 border border-slate-200 shadow-sm uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1 z-[201]"
                        onClick={e => {
                            e.stopPropagation();
                            if (panel.scaleBar) {
                                onUpdatePanel?.(panel.id, { scaleBar: undefined } as any);
                            } else {
                                onUpdatePanel?.(panel.id, { scaleBar: { ...DEFAULT_SCALE_BAR } });
                            }
                        }}
                        title={panel.scaleBar ? '移除比例尺' : '添加比例尺'}
                    >
                        <i className={`fa-solid ${panel.scaleBar ? 'fa-ruler-horizontal text-teal-500' : 'fa-ruler'}`} />
                        {panel.scaleBar ? 'Scale ✓' : 'Scale'}
                    </button>

                    {/* ── 底部浮动工具栏 (功能10/11/12) ── */}
                    <div className="absolute -bottom-11 left-1/2 -translate-x-1/2 no-export z-[201] flex items-center gap-0.5 bg-white/95 backdrop-blur-md rounded-xl shadow-xl border border-slate-200 px-1.5 py-1" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                        {/* 边框 (功能11) */}
                        <button
                            className={`w-7 h-7 flex items-center justify-center rounded-lg text-[10px] transition-all ${showBorderPanel ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                            onClick={() => { setShowBorderPanel(!showBorderPanel); setShowFilterPanel(false); }}
                            title="边框设置"
                        >
                            <i className="fa-solid fa-border-all" />
                        </button>
                        {/* 旋转 (功能12) */}
                        <button
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[10px] text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                            onClick={() => onUpdatePanel?.(panel.id, { rotation: ((panel.rotation || 0) - 15 + 360) % 360 })}
                            title="逆时针旋转15°"
                        >
                            <i className="fa-solid fa-rotate-left" />
                        </button>
                        <button
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[10px] text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                            onClick={() => onUpdatePanel?.(panel.id, { rotation: ((panel.rotation || 0) + 15) % 360 })}
                            title="顺时针旋转15°"
                        >
                            <i className="fa-solid fa-rotate-right" />
                        </button>
                        <div className="w-px h-5 bg-slate-200" />
                        {/* 翻转 (功能12) */}
                        <button
                            className={`w-7 h-7 flex items-center justify-center rounded-lg text-[10px] transition-all ${panel.flipH ? 'bg-amber-100 text-amber-600' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}
                            onClick={() => onUpdatePanel?.(panel.id, { flipH: !panel.flipH })}
                            title="水平翻转"
                        >
                            <i className="fa-solid fa-arrows-left-right" />
                        </button>
                        <button
                            className={`w-7 h-7 flex items-center justify-center rounded-lg text-[10px] transition-all ${panel.flipV ? 'bg-amber-100 text-amber-600' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}
                            onClick={() => onUpdatePanel?.(panel.id, { flipV: !panel.flipV })}
                            title="垂直翻转"
                        >
                            <i className="fa-solid fa-arrows-up-down" />
                        </button>
                        <div className="w-px h-5 bg-slate-200" />
                        {/* 滤镜 (功能10) */}
                        <button
                            className={`w-7 h-7 flex items-center justify-center rounded-lg text-[10px] transition-all ${showFilterPanel ? 'bg-purple-100 text-purple-600' : 'text-slate-400 hover:text-purple-600 hover:bg-purple-50'}`}
                            onClick={() => { setShowFilterPanel(!showFilterPanel); setShowBorderPanel(false); }}
                            title="图片滤镜"
                        >
                            <i className="fa-solid fa-sliders" />
                        </button>
                    </div>

                    {/* 边框设置弹出面板 (功能11) */}
                    {showBorderPanel && (
                        <div className="absolute -bottom-[130px] left-1/2 -translate-x-1/2 no-export z-[202] bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200 p-3 w-56" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">边框设置</div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="relative w-7 h-7 rounded-lg overflow-hidden border border-slate-200 cursor-pointer shrink-0">
                                    <input type="color" className="absolute -top-1 -left-1 w-10 h-10 p-0 border-none cursor-pointer" value={panel.border?.color || '#000000'} onChange={e => onUpdatePanel?.(panel.id, { border: { ...(panel.border || { width: 2, radius: 0, color: '#000000' }), color: e.target.value } })} />
                                </div>
                                <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-200 px-1">
                                    <span className="text-[7px] font-black text-slate-400 px-1">粗细</span>
                                    <input type="number" min={0} max={20} className="w-full bg-transparent text-[10px] font-black text-center outline-none" value={panel.border?.width ?? 0} onChange={e => onUpdatePanel?.(panel.id, { border: { ...(panel.border || { color: '#000000', radius: 0, width: 0 }), width: Math.max(0, parseInt(e.target.value) || 0) } })} />
                                </div>
                                <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-200 px-1">
                                    <span className="text-[7px] font-black text-slate-400 px-1">圆角</span>
                                    <input type="number" min={0} max={50} className="w-full bg-transparent text-[10px] font-black text-center outline-none" value={panel.border?.radius ?? 0} onChange={e => onUpdatePanel?.(panel.id, { border: { ...(panel.border || { color: '#000000', width: 2, radius: 0 }), radius: Math.max(0, parseInt(e.target.value) || 0) } })} />
                                </div>
                            </div>
                            <button className="text-[8px] text-rose-400 hover:text-rose-600 font-bold" onClick={() => { onUpdatePanel?.(panel.id, { border: undefined } as any); setShowBorderPanel(false); }}>清除边框</button>
                        </div>
                    )}

                    {/* 滤镜设置弹出面板 (功能10) */}
                    {showFilterPanel && (
                        <div className="absolute -bottom-[200px] left-1/2 -translate-x-1/2 no-export z-[202] bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200 p-3 w-60" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">图片调整</div>
                            {([
                                { key: 'brightness', label: '亮度', min: 0, max: 300, def: 100 },
                                { key: 'contrast', label: '对比度', min: 0, max: 300, def: 100 },
                                { key: 'saturate', label: '饱和度', min: 0, max: 300, def: 100 },
                                { key: 'hueRotate', label: '色相', min: 0, max: 360, def: 0 },
                            ] as const).map(item => (
                                <div key={item.key} className="flex items-center gap-2 mb-1.5">
                                    <span className="text-[8px] font-bold text-slate-500 w-10 shrink-0">{item.label}</span>
                                    <input
                                        type="range" min={item.min} max={item.max}
                                        className="flex-1 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:shadow"
                                        value={panel.filters?.[item.key] ?? item.def}
                                        onChange={e => onUpdatePanel?.(panel.id, { filters: { brightness: 100, contrast: 100, saturate: 100, hueRotate: 0, ...(panel.filters || {}), [item.key]: parseInt(e.target.value) } })}
                                    />
                                    <span className="text-[9px] font-black text-slate-600 w-8 text-right">{panel.filters?.[item.key] ?? item.def}</span>
                                </div>
                            ))}
                            <div className="border-t border-slate-100 pt-2 mt-1">
                                <div className="text-[8px] font-bold text-slate-400 uppercase mb-1.5">伪彩色</div>
                                <div className="flex gap-1.5 flex-wrap">
                                    {[
                                        { name: '无', color: '' },
                                        { name: '热力红', color: '#ff4444' },
                                        { name: '冷蓝', color: '#4488ff' },
                                        { name: '翠绿', color: '#44cc44' },
                                        { name: '金黄', color: '#ffaa00' },
                                        { name: '品红', color: '#ff44ff' },
                                        { name: '青色', color: '#00cccc' },
                                    ].map(pc => (
                                        <button
                                            key={pc.name}
                                            className={`px-1.5 py-0.5 rounded text-[7px] font-bold border transition-all ${panel.pseudoColor === pc.color ? 'border-indigo-400 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                                            onClick={() => onUpdatePanel?.(panel.id, { pseudoColor: pc.color || undefined } as any)}
                                        >
                                            {pc.color && <span className="inline-block w-2 h-2 rounded-sm mr-0.5" style={{ backgroundColor: pc.color }} />}
                                            {pc.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button className="mt-2 text-[8px] text-rose-400 hover:text-rose-600 font-bold" onClick={() => { onUpdatePanel?.(panel.id, { filters: undefined, pseudoColor: undefined } as any); }}>重置滤镜</button>
                        </div>
                    )}

                    {/* 8-way Resize Handles (功能1: 面板自由缩放) */}
                    {!panel.locked && (
                        <>
                            {/* Corner handles */}
                            {(['nw','ne','sw','se'] as const).map(dir => {
                                const style: React.CSSProperties = {
                                    position: 'absolute', width: 10, height: 10, zIndex: 200,
                                    background: 'white', border: '2px solid #6366f1', borderRadius: 2,
                                    cursor: dir === 'nw' || dir === 'se' ? 'nwse-resize' : 'nesw-resize',
                                    ...(dir.includes('n') ? { top: -5 } : { bottom: -5 }),
                                    ...(dir.includes('w') ? { left: -5 } : { right: -5 }),
                                };
                                return <div key={dir} className="no-export" style={style} onMouseDown={e => { e.stopPropagation(); onResizeStart?.(e, panel.id, dir); }} />;
                            })}
                            {/* Edge handles */}
                            {(['n','s','e','w'] as const).map(dir => {
                                const isVert = dir === 'n' || dir === 's';
                                const style: React.CSSProperties = {
                                    position: 'absolute', zIndex: 200,
                                    background: 'white', border: '2px solid #6366f1', borderRadius: 1,
                                    ...(isVert ? { width: 20, height: 6, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } : { width: 6, height: 20, top: '50%', transform: 'translateY(-50%)', cursor: 'ew-resize' }),
                                    ...(dir === 'n' ? { top: -3 } : dir === 's' ? { bottom: -3 } : dir === 'w' ? { left: -3 } : { right: -3 }),
                                };
                                return <div key={dir} className="no-export" style={style} onMouseDown={e => { e.stopPropagation(); onResizeStart?.(e, panel.id, dir); }} />;
                            })}
                        </>
                    )}
                </>
            )}

            {/* Embedded Texts */}
            {panel.texts?.map(text => {
                const isTextSelected = selectedText?.textId === text.id && selectedText?.panelId === panel.id;
                const isTextEditing = editingText?.textId === text.id && editingText?.panelId === panel.id;

                return (
                    <TextOverlay
                        key={text.id}
                        text={text}
                        panelId={panel.id}
                        isSelected={isTextSelected}
                        isEditing={isTextEditing}
                        scale={1}
                        onMouseDown={(e) => onTextMouseDown(e, panel.id, text.id)}
                        onDoubleClick={(e) => onTextDoubleClick(panel.id, text.id)}
                        onUpdate={(updates, isBatch) => onTextUpdate(panel.id, text.id, updates, isBatch)}
                        onDelete={() => onTextDelete(panel.id, text.id)}
                        FONT_FAMILIES={FONT_FAMILIES}
                    />
                );
            })}

            {/* Embedded Shapes */}
            {panel.shapes?.map(shape => {
                const isShapeSelected = selectedShape?.shapeId === shape.id && selectedShape?.panelId === panel.id;
                return (
                    <ShapeOverlay
                        key={shape.id}
                        shape={shape}
                        isSelected={isShapeSelected}
                        onMouseDown={(mode, e) => onShapeMouseDown(e, panel.id, shape.id, mode)}
                        onUpdate={(updates, isBatch) => onShapeUpdate(panel.id, shape.id, updates, isBatch)}
                        onDelete={() => onShapeDelete(panel.id, shape.id)}
                    />
                );
            })}
        </div>
    );
};