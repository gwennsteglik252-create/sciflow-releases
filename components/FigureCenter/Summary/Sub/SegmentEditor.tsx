import React, { useState, useEffect } from 'react';
import { SummarySegment, SummaryImage } from '../../../../types';
import { ColorPickerWithPresets } from '../../../DataAnalysis/Chart/ColorPickerWithPresets';

interface SegmentEditorProps {
    layerId: string;
    segment: SummarySegment;
    onUpdate: (updates: Partial<SummarySegment>) => void;
    onBack: () => void;
    onGenerateThumbnail: () => void;
    isGenerating: boolean;
    fileInputRef: React.RefObject<HTMLInputElement>;
    onUploadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
    documentColors: string[];
    onRemoveBgManual?: (base64: string, id: string) => void;
}

export const SegmentEditor: React.FC<SegmentEditorProps> = (props) => {
    const { segment, onUpdate, onBack, onGenerateThumbnail, isGenerating, fileInputRef, onUploadImage, documentColors, onRemoveBgManual } = props;
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const [isScaleLinked, setIsScaleLinked] = useState(false);

    const activeImages = React.useMemo(() => {
        if (segment.images?.length) return segment.images;
        if (segment.thumbnailUrl) return [{ id: 'legacy', url: segment.thumbnailUrl, scale: segment.imageScale || 1, radialOffset: 0, angularOffset: 0 }];
        return [];
    }, [segment]);

    const activeImage = activeImages.find(img => img.id === selectedImageId) || null;
    const isAuto = segment.isAutoLayout !== false;

    useEffect(() => {
        if (activeImages.length > 0 && (!selectedImageId || !activeImages.find(i => i.id === selectedImageId))) {
            setSelectedImageId(activeImages[0].id);
        }
    }, [activeImages]);

    const handleImageUpdate = (updates: Partial<SummaryImage>) => {
        if (selectedImageId === 'legacy') {
            const segUpdates: any = {};
            if (updates.scale !== undefined) {
                segUpdates.imageScale = updates.scale;
            }
            if (updates.radialOffset !== undefined) segUpdates.imageRadialOffset = updates.radialOffset;
            if (updates.angularOffset !== undefined) segUpdates.imageAngularOffset = updates.angularOffset;
            onUpdate(segUpdates);
        } else {
            let newImages = (segment.images || []).map(img => img.id === selectedImageId ? { ...img, ...updates } : img);

            if (isScaleLinked && updates.scale !== undefined) {
                const newScale = updates.scale;
                newImages = newImages.map(img => ({ ...img, scale: newScale }));
            }

            onUpdate({ images: newImages });
        }
    };

    const handleDeleteImage = (imgId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (imgId === 'legacy') {
            onUpdate({ thumbnailUrl: undefined });
            if (selectedImageId === 'legacy') setSelectedImageId(null);
        } else {
            const filtered = (segment.images || []).filter(img => img.id !== imgId);
            onUpdate({ images: filtered });
            if (selectedImageId === imgId) {
                setSelectedImageId(filtered.length > 0 ? filtered[0].id : null);
            }
        }
    };

    return (
        <div className="flex flex-col h-full animate-reveal overflow-hidden">
            <header className="flex items-center gap-3 shrink-0 pb-4 border-b border-slate-100 mb-4 px-1">
                <button onClick={onBack} className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-black transition-all shadow-lg active:scale-95"><i className="fa-solid fa-chevron-left"></i></button>
                <div className="min-w-0">
                    <h5 className="text-[14px] font-black text-slate-800 uppercase italic leading-none truncate">区块深度定制</h5>
                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{segment.title || 'NEW SEGMENT'}</p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1 pb-4">
                <section className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <i className="fa-solid fa-align-left text-indigo-500"></i> 内容定义 (CONTENT)
                        </p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 space-y-3 shadow-inner">
                        <input
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-[12px] font-black text-slate-800 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 transition-all shadow-sm"
                            value={segment.title}
                            onChange={e => onUpdate({ title: e.target.value })}
                            placeholder="输入区块标题..."
                        />
                        <textarea
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-[11px] font-medium text-slate-600 outline-none h-24 resize-none leading-relaxed shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 transition-all custom-scrollbar"
                            value={segment.content}
                            onChange={e => onUpdate({ content: e.target.value })}
                            placeholder="输入描述内文..."
                        />
                    </div>
                </section>

                <section className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <i className="fa-solid fa-wand-magic-sparkles text-rose-500"></i> 视觉资产管理
                        </p>
                        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-sm">
                            <button
                                onClick={() => onUpdate({ isAutoLayout: true })}
                                className={`px-2.5 py-1 rounded-md text-[8px] font-black uppercase transition-all ${isAuto ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >自动</button>
                            <button
                                onClick={() => onUpdate({ isAutoLayout: false })}
                                className={`px-2.5 py-1 rounded-md text-[8px] font-black uppercase transition-all ${!isAuto ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >手动</button>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-[2rem] border border-slate-100 space-y-4 shadow-inner">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar py-1">
                                {activeImages.map(img => (
                                    <div
                                        key={img.id}
                                        onClick={() => setSelectedImageId(img.id)}
                                        className={`relative w-16 h-16 rounded-2xl overflow-hidden shrink-0 cursor-pointer border-2 transition-all hover:scale-105 group/img ${selectedImageId === img.id ? 'border-indigo-600 ring-4 ring-indigo-100 shadow-lg' : 'border-white shadow-sm'}`}
                                    >
                                        <img src={img.url} className="w-full h-full object-cover" alt="asset" />
                                        <button
                                            onClick={(e) => handleDeleteImage(img.id, e)}
                                            className="absolute top-1 right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity shadow-lg active:scale-90"
                                            title="删除图片"
                                        >
                                            <i className="fa-solid fa-times text-[10px]"></i>
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-16 h-16 rounded-2xl border-2 border-dashed border-indigo-200 bg-white text-indigo-400 flex items-center justify-center hover:bg-indigo-50 hover:border-indigo-400 transition-all shrink-0"
                                >
                                    <i className="fa-solid fa-plus"></i>
                                </button>
                            </div>
                        </div>

                        {activeImage && (
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4 animate-reveal">
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                        <p className="text-[10px] font-black text-slate-800 uppercase italic">当前图像微调</p>
                                    </div>
                                    <button
                                        onClick={() => onRemoveBgManual?.(activeImage.url, selectedImageId!)}
                                        disabled={isGenerating}
                                        className="px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl text-[9px] font-black hover:bg-amber-600 hover:text-white transition-all flex items-center gap-2 shadow-sm"
                                    >
                                        {isGenerating ? <i className="fa-solid fa-circle-notch animate-spin text-[10px]"></i> : <i className="fa-solid fa-magic text-[10px]"></i>}
                                        一键扣图
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase">缩放比例</label>
                                                <button
                                                    onClick={() => setIsScaleLinked(!isScaleLinked)}
                                                    className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${isScaleLinked ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400 hover:text-indigo-600'}`}
                                                    title={isScaleLinked ? "已开启全图缩放联动" : "开启全图缩放联动"}
                                                >
                                                    <i className={`fa-solid ${isScaleLinked ? 'fa-link' : 'fa-link-slash'} text-[8px]`}></i>
                                                </button>
                                            </div>
                                            <span className="text-[10px] font-mono font-black text-indigo-600">{Math.round((activeImage.scale || 0) * 100)}%</span>
                                        </div>
                                        <input type="range" min="0.3" max="2.5" step="0.05" className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer" value={activeImage.scale ?? 1} onChange={e => handleImageUpdate({ scale: parseFloat(e.target.value) })} />
                                    </div>

                                    {!isAuto && (
                                        <div className="grid grid-cols-2 gap-4 pt-2 animate-reveal">
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[8px] font-black text-slate-400 uppercase">径向偏移</label>
                                                    <span className="text-[9px] font-mono font-black text-indigo-600">{activeImage.radialOffset || 0}</span>
                                                </div>
                                                <input type="range" min="-150" max="150" step="1" className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer" value={activeImage.radialOffset || 0} onChange={e => handleImageUpdate({ radialOffset: parseInt(e.target.value) })} />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[8px] font-black text-slate-400 uppercase">角度偏移</label>
                                                    <span className="text-[9px] font-mono font-black text-indigo-600">{activeImage.angularOffset || 0}</span>
                                                </div>
                                                <input type="range" min="-60" max="60" step="1" className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer" value={activeImage.angularOffset || 0} onChange={e => handleImageUpdate({ angularOffset: parseInt(e.target.value) })} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase">3D 渲染提示词 (PROMPT)</label>
                                <button onClick={onGenerateThumbnail} disabled={isGenerating} className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 hover:bg-indigo-600 hover:text-white transition-all">生成同款素材</button>
                            </div>
                            <textarea
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-[10px] font-mono text-slate-600 outline-none h-20 resize-none shadow-sm focus:border-indigo-400"
                                value={segment.imagePrompt}
                                onChange={e => onUpdate({ imagePrompt: e.target.value })}
                                placeholder="描述渲染细节..."
                            />
                        </div>
                    </div>
                </section>

                <section className="space-y-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                        <i className="fa-solid fa-palette text-amber-500"></i> 视觉风格与配色
                    </p>
                    <div className="bg-white p-5 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <div className="grid grid-cols-3 gap-3">
                            <ColorPickerWithPresets label="背景" color={segment.color} documentColors={documentColors} onChange={(c) => onUpdate({ color: c })} size="sm" />
                            <ColorPickerWithPresets label="标题" color={segment.titleColor || '#0f172a'} documentColors={documentColors} onChange={(c) => onUpdate({ titleColor: c })} size="sm" />
                            <ColorPickerWithPresets label="内文" color={segment.contentColor || '#334155'} documentColors={documentColors} onChange={(c) => onUpdate({ contentColor: c })} size="sm" />
                        </div>
                    </div>
                </section>
            </div>

            <footer className="shrink-0 mt-auto pt-4 border-t border-slate-100 flex gap-2">
                <button
                    onClick={onBack}
                    className="flex-1 py-4 bg-slate-900 text-white rounded-[1.8rem] text-[11px] font-black uppercase shadow-xl hover:bg-indigo-600 transition-all active:scale-95"
                >
                    完成并退出
                </button>
            </footer>
        </div>
    );
};