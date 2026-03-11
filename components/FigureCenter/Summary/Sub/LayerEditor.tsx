import React, { useState, useEffect } from 'react';
import { SummaryLayer, LayerConfig } from '../../../../types';
import { ColorPickerWithPresets } from '../../../DataAnalysis/Chart/ColorPickerWithPresets';

interface LayerEditorProps {
    layer: SummaryLayer;
    onUpdate: (updates: Partial<SummaryLayer>) => void;
    onBack: () => void;
    documentColors: string[];
    onSyncAllLayers?: (config: LayerConfig) => void;
    isSyncEnabled?: boolean;
    onSyncToggle?: (v: boolean) => void;
}

const FONT_FAMILIES = [
    { name: 'Sans (Modern)', value: 'Arial, sans-serif' },
    { name: 'Serif (Academic)', value: '"Times New Roman", Times, serif' },
    { name: 'Mono (Technical)', value: '"Courier New", Courier, monospace' },
    { name: 'Impact (Bold)', value: 'Impact, sans-serif' }
];

// Helper for smooth number input (handles decimals, empty states, and scroll wheel)
const BufferedNumberInput = ({ value, onUpdate, className, placeholder }: { value: number; onUpdate: (val: number) => void; className?: string; placeholder?: string }) => {
    const [localVal, setLocalVal] = useState(value === 0 ? '' : value.toString());

    useEffect(() => {
        const numLocal = parseFloat(localVal);
        if (numLocal !== value && !(localVal === '' && value === 0)) {
            setLocalVal(value === 0 ? '' : value.toString());
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        setLocalVal(newVal);
        const parsed = parseFloat(newVal);
        if (!isNaN(parsed)) {
            onUpdate(parsed);
        } else if (newVal === '') {
            onUpdate(0);
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (document.activeElement === e.currentTarget) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -1 : 1;
            onUpdate(Math.round(value + delta));
        }
    };

    return (
        <input
            type="number"
            className={className}
            value={localVal}
            onChange={handleChange}
            onWheel={handleWheel}
            placeholder={placeholder}
            step="1"
        />
    );
};

export const LayerEditor: React.FC<LayerEditorProps> = ({ layer, onUpdate, onBack, documentColors, onSyncAllLayers, isSyncEnabled, onSyncToggle }) => {
    const defaultConfig: LayerConfig = {
        uniformImageCount: 0,
        titleSize: 22,
        contentSize: 14,
        titleContentGap: 24,
        titleOffset: 18,
        titleFontFamily: 'inherit',
        contentFontFamily: 'inherit',
        titleFontWeight: 'black',
        contentFontWeight: 'bold',
        titleFontStyle: 'italic',
        contentFontStyle: 'italic'
    };

    const config = { ...defaultConfig, ...layer.config };

    const updateConfig = (updates: Partial<LayerConfig>) => {
        onUpdate({ config: { ...config, ...updates } });
    };

    const isBold = config.titleFontWeight === 'bold' || config.titleFontWeight === 'black' || config.titleFontWeight === '900';
    const isItalic = config.titleFontStyle === 'italic';

    const isContentBold = config.contentFontWeight === 'bold' || config.contentFontWeight === 'black' || config.contentFontWeight === '900';
    const isContentItalic = config.contentFontStyle === 'italic';

    return (
        <div className="flex flex-col h-full animate-reveal overflow-hidden">
            <header className="flex items-center gap-3 shrink-0 pb-3 border-b border-slate-100 mb-4">
                <button onClick={onBack} className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-black transition-all shadow-md active:scale-95"><i className="fa-solid fa-chevron-left text-xs"></i></button>
                <div className="min-w-0">
                    <h5 className="text-[13px] font-black text-slate-800 uppercase italic leading-none truncate">层级全局配置</h5>
                    <p className="text-[7px] font-bold text-slate-400 uppercase mt-1">{layer.name}</p>
                </div>
                <div className="ml-auto">
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                            <span className={`text-[8px] font-black uppercase tracking-tighter transition-colors ${isSyncEnabled ? 'text-amber-600' : 'text-slate-400'}`}>
                                {isSyncEnabled ? '同步模式已开启' : '关闭同步'}
                            </span>
                            <button
                                onClick={() => onSyncToggle?.(!isSyncEnabled)}
                                className={`w-10 h-5 rounded-full p-0.5 transition-all duration-300 shadow-inner relative group/sync-toggle ${isSyncEnabled ? 'bg-gradient-to-r from-amber-500 to-orange-500 ring-2 ring-amber-200' : 'bg-slate-300'}`}
                                title={isSyncEnabled ? "实时同步已开启：对当前层的修改将广播至全层" : "点击开启实时同步：将当前配置应用并锁定至全层"}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow-lg transform transition-transform duration-300 flex items-center justify-center ${isSyncEnabled ? 'translate-x-5' : 'translate-x-0'}`}>
                                    <i className={`fa-solid fa-sync text-[8px] transition-colors ${isSyncEnabled ? 'text-amber-600 animate-spin-slow' : 'text-slate-300'}`}></i>
                                </div>
                                {isSyncEnabled && (
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-ping"></div>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1">
                <section className="space-y-3">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">基本信息 (BASIC)</p>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-inner">
                        <label className="text-[9px] font-black text-slate-500 uppercase mb-1.5 block">层级名称</label>
                        <input
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 text-[12px] font-black text-slate-800 outline-none focus:border-indigo-500 shadow-sm transition-all"
                            value={layer.name}
                            onChange={e => onUpdate({ name: e.target.value })}
                            placeholder="输入层级名称..."
                        />
                    </div>
                </section>

                <section className="space-y-4">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">布局微调 (LAYOUT)</p>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-5">
                        {/* 数量类 - 增加滑轮/滑动调节 */}
                        <div>
                            <div className="flex justify-between items-center mb-1 px-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase">统一图片显示上限</label>
                                <span className="text-[10px] font-mono font-black text-indigo-600">{config.uniformImageCount || 0} 张</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <input
                                    type="range" min="0" max="10" step="1"
                                    className="w-full accent-indigo-600 h-1.5 bg-white rounded-lg appearance-none cursor-pointer"
                                    value={config.uniformImageCount || 0}
                                    onChange={e => updateConfig({ uniformImageCount: parseInt(e.target.value) })}
                                />
                                <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                                    <button onClick={() => updateConfig({ uniformImageCount: Math.max(0, (config.uniformImageCount || 0) - 1) })} className="w-8 h-8 rounded-lg hover:bg-slate-50 text-slate-400"><i className="fa-solid fa-minus text-[10px]"></i></button>
                                    <BufferedNumberInput
                                        className="flex-1 bg-transparent text-center text-[11px] font-black text-indigo-600 outline-none"
                                        value={config.uniformImageCount || 0}
                                        onUpdate={val => updateConfig({ uniformImageCount: Math.round(val) })}
                                    />
                                    <button onClick={() => updateConfig({ uniformImageCount: Math.min(10, (config.uniformImageCount || 0) + 1) })} className="w-8 h-8 rounded-lg hover:bg-slate-50 text-slate-400"><i className="fa-solid fa-plus text-[10px]"></i></button>
                                </div>
                            </div>
                        </div>

                        {/* 间距类 */}
                        <div>
                            <div className="flex justify-between items-center mb-1 px-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase">标题与内文径向间距 (PX)</label>
                                <span className="text-[10px] font-mono font-black text-indigo-600">{config.titleContentGap}PX</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <input
                                    type="range" min="0" max="100" step="1"
                                    className="w-full accent-indigo-600 h-1.5 bg-white rounded-lg appearance-none cursor-pointer"
                                    value={config.titleContentGap || 0}
                                    onChange={e => updateConfig({ titleContentGap: parseInt(e.target.value) })}
                                />
                                <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                                    <button onClick={() => updateConfig({ titleContentGap: Math.max(0, (config.titleContentGap || 0) - 1) })} className="w-8 h-8 rounded-lg hover:bg-slate-50 text-slate-400"><i className="fa-solid fa-minus text-[10px]"></i></button>
                                    <BufferedNumberInput
                                        className="flex-1 bg-transparent text-center text-[11px] font-black text-indigo-600 outline-none"
                                        value={config.titleContentGap || 0}
                                        onUpdate={val => updateConfig({ titleContentGap: Math.round(val) })}
                                    />
                                    <button onClick={() => updateConfig({ titleContentGap: Math.min(100, (config.titleContentGap || 0) + 1) })} className="w-8 h-8 rounded-lg hover:bg-slate-50 text-slate-400"><i className="fa-solid fa-plus text-[10px]"></i></button>
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1 px-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase">标题边缘偏移 (PX)</label>
                                <span className="text-[10px] font-mono font-black text-indigo-600">{config.titleOffset}PX</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <input
                                    type="range" min="0" max="100" step="1"
                                    className="w-full accent-indigo-600 h-1.5 bg-white rounded-lg appearance-none cursor-pointer"
                                    value={config.titleOffset || 0}
                                    onChange={e => updateConfig({ titleOffset: parseInt(e.target.value) })}
                                />
                                <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                                    <button onClick={() => updateConfig({ titleOffset: Math.max(0, (config.titleOffset || 0) - 1) })} className="w-8 h-8 rounded-lg hover:bg-slate-50 text-slate-400"><i className="fa-solid fa-minus text-[10px]"></i></button>
                                    <BufferedNumberInput
                                        className="flex-1 bg-transparent text-center text-[11px] font-black text-indigo-600 outline-none"
                                        value={config.titleOffset || 0}
                                        onUpdate={val => updateConfig({ titleOffset: Math.round(val) })}
                                    />
                                    <button onClick={() => updateConfig({ titleOffset: Math.min(100, (config.titleOffset || 0) + 1) })} className="w-8 h-8 rounded-lg hover:bg-slate-50 text-slate-400"><i className="fa-solid fa-plus text-[10px]"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="space-y-4">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">字体排版 (TYPOGRAPHY)</p>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4 shadow-inner">
                        {/* 标题字体设置 */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[9px] font-black text-indigo-600 uppercase">标题文字 (Title)</label>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => updateConfig({ titleFontWeight: isBold ? 'normal' : 'black' })}
                                        className={`w-6 h-6 rounded flex items-center justify-center text-[10px] border transition-all ${isBold ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'}`}
                                    >B</button>
                                    <button
                                        onClick={() => updateConfig({ titleFontStyle: isItalic ? 'normal' : 'italic' })}
                                        className={`w-6 h-6 rounded flex items-center justify-center text-[10px] border transition-all ${isItalic ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300'}`}
                                    >I</button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                                <span className="pl-2 text-[8px] font-black text-slate-300 uppercase">Size</span>
                                <BufferedNumberInput
                                    className="flex-1 bg-transparent text-center text-[11px] font-black text-slate-800 outline-none"
                                    value={config.titleSize || 0}
                                    onUpdate={val => updateConfig({ titleSize: val })}
                                />
                                <span className="pr-2 text-[8px] font-black text-slate-300 uppercase">PT</span>
                            </div>
                            <select className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold outline-none shadow-sm" value={config.titleFontFamily || 'inherit'} onChange={(e) => updateConfig({ titleFontFamily: e.target.value })}>
                                {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                            </select>
                            <div className="pt-1">
                                <ColorPickerWithPresets
                                    label="标题文字颜色"
                                    color={config.titleColor || '#0f172a'}
                                    documentColors={documentColors}
                                    onChange={(c: string) => updateConfig({ titleColor: c })}
                                    size="sm"
                                />
                            </div>
                        </div>

                        {/* 内文字体设置 */}
                        <div className="space-y-2 pt-2 border-t border-slate-200/50">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[9px] font-black text-emerald-600 uppercase">内容文字 (Content)</label>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => updateConfig({ contentFontWeight: isContentBold ? 'normal' : 'bold' })}
                                        className={`w-6 h-6 rounded flex items-center justify-center text-[10px] border transition-all ${isContentBold ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-emerald-300'}`}
                                    >B</button>
                                    <button
                                        onClick={() => updateConfig({ contentFontStyle: isContentItalic ? 'normal' : 'italic' })}
                                        className={`w-6 h-6 rounded flex items-center justify-center text-[10px] border transition-all ${isContentItalic ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-400 border-slate-200'}`}
                                    >I</button>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                                <span className="pl-2 text-[8px] font-black text-slate-300 uppercase">Size</span>
                                <BufferedNumberInput
                                    className="flex-1 bg-transparent text-center text-[11px] font-black text-slate-800 outline-none"
                                    value={config.contentSize || 0}
                                    onUpdate={val => updateConfig({ contentSize: val })}
                                />
                                <span className="pr-2 text-[8px] font-black text-slate-300 uppercase">PT</span>
                            </div>
                            <select className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold outline-none shadow-sm" value={config.contentFontFamily || 'inherit'} onChange={(e) => updateConfig({ contentFontFamily: e.target.value })}>
                                {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                            </select>
                            <div className="pt-1">
                                <ColorPickerWithPresets
                                    label="内容文字颜色"
                                    color={config.contentColor || '#334155'}
                                    documentColors={documentColors}
                                    onChange={(c: string) => updateConfig({ contentColor: c })}
                                    size="sm"
                                />
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <div className="mt-4 shrink-0">
                <button onClick={onBack} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-indigo-600 transition-all mb-2">保存层级设定</button>
            </div>
        </div>
    );
};
