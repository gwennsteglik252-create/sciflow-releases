import React from 'react';
import { CircularSummaryData } from '../../../../types';
import { ColorPickerWithPresets } from '../../../DataAnalysis/Chart/ColorPickerWithPresets';

const FONT_FAMILIES = [
  { name: 'Sans (Modern)', value: 'Arial, sans-serif' },
  { name: 'Serif (Academic)', value: '"Times New Roman", Times, serif' },
  { name: 'Mono (Technical)', value: '"Courier New", Courier, monospace' },
  { name: 'Impact (Bold)', value: 'Impact, sans-serif' }
];

interface CoreEditorProps {
    data: CircularSummaryData;
    onUpdate: (updates: Partial<CircularSummaryData>) => void;
    onBack: () => void;
    onGenerateThumbnail?: () => void;
    isGenerating: boolean;
    fileInputRef?: React.RefObject<HTMLInputElement>;
    onUploadImage?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    documentColors: string[];
    onRemoveBgManual?: (base64: string) => void; 
}

export const CoreEditor: React.FC<CoreEditorProps> = (props) => {
    const { data, onUpdate, onBack, onGenerateThumbnail, isGenerating, fileInputRef, onUploadImage, documentColors, onRemoveBgManual } = props;

    return (
        <div className="flex flex-col h-full animate-reveal overflow-hidden">
            <header className="flex items-center gap-3 shrink-0 pb-3 border-b border-slate-100 mb-4">
                <button onClick={onBack} className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-black transition-all shadow-md active:scale-95"><i className="fa-solid fa-chevron-left text-xs"></i></button>
                <div className="min-w-0">
                    <h5 className="text-[13px] font-black text-slate-800 uppercase italic tracking-tighter leading-none">核心区域编辑</h5>
                    <p className="text-[7px] font-bold text-slate-400 uppercase mt-1">Properties Editor</p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-5 pr-1">
                <section className="space-y-3">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">基础内容 (CONTENT)</p>
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2.5 shadow-inner">
                        <input className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-[11px] font-black text-slate-800 outline-none focus:border-indigo-500 shadow-sm" value={data.title} onChange={e => onUpdate({ title: e.target.value })} placeholder="核心标题..." />
                        
                        <div className="pt-2 border-t border-slate-200/50">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[7px] font-black text-indigo-500 uppercase">核心视觉插图</label>
                                <div className="flex gap-1.5">
                                    <button onClick={() => fileInputRef?.current?.click()} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[8px] font-black flex items-center gap-1"><i className="fa-solid fa-upload"></i> 上传</button>
                                    <button onClick={onGenerateThumbnail} disabled={isGenerating} className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-md text-[8px] font-black flex items-center gap-1"><i className="fa-solid fa-wand-magic-sparkles"></i> AI 渲染</button>
                                </div>
                            </div>
                            
                            {data.coreThumbnailUrl && (
                                <div className="space-y-3">
                                    <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white flex items-center justify-center">
                                        <img src={data.coreThumbnailUrl} className="max-w-full max-h-full object-contain" />
                                        <div className="absolute top-1 right-1 flex gap-1">
                                            <button 
                                                onClick={() => onRemoveBgManual?.(data.coreThumbnailUrl!)}
                                                disabled={isGenerating}
                                                className="w-6 h-6 bg-amber-500/80 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-amber-600 transition-all"
                                                title="AI 智能抠图"
                                            >
                                                {isGenerating ? <i className="fa-solid fa-circle-notch animate-spin text-[10px]"></i> : <i className="fa-solid fa-magic text-[10px]"></i>}
                                            </button>
                                            <button onClick={() => onUpdate({ coreThumbnailUrl: undefined })} className="w-6 h-6 bg-rose-500/80 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-rose-600 transition-all"><i className="fa-solid fa-times text-[10px]"></i></button>
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[7px] font-bold text-slate-500 uppercase">缩放比例</label>
                                            <span className="text-[9px] font-mono font-black text-indigo-600">{Math.round((data.coreImageScale || 1) * 100)}%</span>
                                        </div>
                                        <input type="range" min="0.5" max="3" step="0.05" className="w-full accent-indigo-600 h-1" value={data.coreImageScale || 1} onChange={e => onUpdate({ coreImageScale: parseFloat(e.target.value) })} />
                                    </div>
                                </div>
                            )}
                            <textarea className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-[9px] font-mono outline-none h-16 resize-none mt-2" value={data.coreImagePrompt || ''} onChange={e => onUpdate({ coreImagePrompt: e.target.value })} placeholder="渲染提示词..." />
                        </div>
                    </div>
                </section>

                <section className="space-y-3">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">视觉样式 (STYLES)</p>
                    <div className="grid grid-cols-3 gap-2">
                        <ColorPickerWithPresets label="背景色" color={data.coreColor || '#0f172a'} documentColors={documentColors} onChange={(c) => onUpdate({ coreColor: c })} size="sm" />
                        <ColorPickerWithPresets label="标题色" color={data.coreTitleColor || '#ffffff'} documentColors={documentColors} onChange={(c) => onUpdate({ coreTitleColor: c })} size="sm" />
                        <ColorPickerWithPresets label="图标色" color={data.coreIconColor || '#818cf8'} documentColors={documentColors} onChange={(c) => onUpdate({ coreIconColor: c })} size="sm" />
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[8px] font-black text-slate-400 uppercase">字号设定</label>
                                <span className="text-[10px] font-mono font-black text-indigo-600">{data.coreFontSize || 18}PT</span>
                            </div>
                            <input type="range" min="10" max="40" step="1" className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer" value={data.coreFontSize || 18} onChange={e => onUpdate({ coreFontSize: parseInt(e.target.value) })} />
                        </div>
                        <select className="w-full bg-slate-50 border border-slate-100 rounded-lg p-1.5 text-[9px] font-bold outline-none" value={data.coreFontFamily || 'inherit'} onChange={(e) => onUpdate({ coreFontFamily: e.target.value })}>{FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}</select>
                    </div>
                </section>
            </div>
            <button onClick={onBack} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-indigo-600 transition-all shrink-0 mt-4 mb-2">保存核心设定</button>
        </div>
    );
};