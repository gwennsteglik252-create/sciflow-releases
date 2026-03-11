import React, { useState, useEffect } from 'react';
import { FigurePanel, FigureText, FigureShape } from '../../../types';
import { PanelControls } from './PanelControls';
import { TextOverlay } from './TextOverlay';
import { ShapeOverlay } from './ShapeOverlay';
import { CropOverlay } from './CropOverlay';

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
    onAddShape: (e: React.MouseEvent, panelId: string, type: 'arrow' | 'line' | 'rect' | 'circle') => void;
    onDeletePanel: (e: React.MouseEvent, id: string) => void;
    onTextMouseDown: (e: React.MouseEvent, panelId: string, textId: string) => void;
    onTextDoubleClick: (panelId: string, textId: string) => void;
    onTextUpdate: (panelId: string, textId: string, updates: Partial<FigureText>, isBatch?: boolean) => void;
    onTextDelete: (panelId: string, textId: string) => void;
    onShapeMouseDown: (e: React.MouseEvent, panelId: string, shapeId: string, mode: 'move' | 'p1' | 'p2') => void;
    onShapeUpdate: (panelId: string, shapeId: string, updates: Partial<FigureShape>, isBatch?: boolean) => void;
    onShapeDelete: (panelId: string, shapeId: string) => void;
    onUpdatePanel?: (id: string, updates: Partial<FigurePanel>) => void;
    onActivate: () => void;
    onDeactivate?: () => void;
    FONT_FAMILIES: { name: string, value: string }[];
}

export const FigurePanelItem: React.FC<FigurePanelItemProps> = ({
    panel, isActive, imageFit, selectedText, selectedShape, editingText,
    onMouseDown, onToggleSpan, onAddText, onAddTextAt, onAddShape, onDeletePanel,
    onTextMouseDown, onTextDoubleClick, onTextUpdate, onTextDelete,
    onShapeMouseDown, onShapeUpdate, onShapeDelete, onUpdatePanel, onActivate, onDeactivate,
    FONT_FAMILIES
}) => {
    const [showLabelTools, setShowLabelTools] = useState(false);
    const [imgError, setImgError] = useState(false);
    const [isCropping, setIsCropping] = useState(false);
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
            className={`absolute group border-2 transition-colors duration-200 bg-gray-50/20 ${isActive ? 'border-indigo-500 z-30 shadow-2xl' : 'border-transparent hover:border-indigo-300 z-10'} ${panel.locked ? 'cursor-not-allowed' : ''}`}
            style={{
                left: panel.x, top: panel.y, width: panel.w, height: panel.h,
                cursor: panel.locked ? 'not-allowed' : 'move',
                opacity: panel.opacity ?? 1,
                zIndex: panel.zIndex ?? 10,
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
            {imgError ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 gap-2">
                    <i className="fa-regular fa-image text-3xl opacity-50"></i>
                    <span className="text-[8px] font-bold uppercase">Image Load Failed</span>
                </div>
            ) : panel.crop ? (
                <div className="w-full h-full overflow-hidden">
                    <img
                        src={panel.imgUrl}
                        className="w-full h-full object-cover pointer-events-none"
                        alt="panel"
                        onError={() => setImgError(true)}
                        style={{
                            transformOrigin: '0 0',
                            transform: `translate(${-panel.crop.x / panel.crop.w * 100}%, ${-panel.crop.y / panel.crop.h * 100}%) scale(${1 / panel.crop.w}, ${1 / panel.crop.h})`,
                        }}
                    />
                </div>
            ) : (
                <img
                    src={panel.imgUrl}
                    className={`w-full h-full object-${imageFit} pointer-events-none bg-transparent rounded-sm`}
                    alt="panel"
                    onError={() => setImgError(true)}
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
                    <div className="absolute top-0 right-full mr-4 bg-white text-slate-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 z-[70] animate-reveal border border-slate-200 w-64 origin-top-right no-export transform translate-y-0">
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