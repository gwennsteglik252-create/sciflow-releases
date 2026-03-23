import React, { useState, useEffect } from 'react';
import { DiagramNode, NodeType, DiagramGroup, Connection } from '../types';
import { ColorPickerWithPresets } from '../../../DataAnalysis/Chart/ColorPickerWithPresets';

interface NodeEditorProps {
    node: DiagramNode;
    connections: Connection[];
    onUpdate: (updates: Partial<DiagramNode>) => void;
    onSyncToGroup: () => void;
    onSyncTypographyGlobal: () => void;
    onDelete: () => void;
    onBack: () => void;
    onConnectionUpdate: (idx: number, updates: Partial<Connection>) => void;
    onDeleteConnection: (idx: number) => void;
    documentColors: string[];
}

const FONT_FAMILIES = [
    { name: 'Sans (Modern)', value: 'Arial, "Helvetica Neue", Helvetica, sans-serif' },
    { name: 'Serif (Academic)', value: '"Times New Roman", Times, serif' },
    { name: 'Mono (Technical)', value: '"Courier New", Courier, monospace' },
    { name: 'Impact (Bold)', value: 'Impact, sans-serif' }
];

// Reusable Section Component for consistency
const EditorSection: React.FC<{ label: string; icon?: string; children: React.ReactNode; action?: React.ReactNode }> = ({ label, icon, children, action }) => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2.5 space-y-1.5 transition-all hover:shadow-md">
        <div className="flex justify-between items-center mb-0.5">
            <div className="flex items-center gap-1.5 px-0.5">
                {icon && <i className={`fa-solid ${icon} text-[9px] text-indigo-400`}></i>}
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
            </div>
            {action}
        </div>
        <div className="px-0.5">{children}</div>
    </div>
);

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

    return (
        <input
            type="number"
            className={className}
            value={localVal}
            onChange={handleChange}
            placeholder={placeholder}
            step="1"
        />
    );
};

const TextConfigEditor = ({ label, config, onUpdate, documentColors }: { label: string; config?: any; onUpdate: (updates: any) => void; documentColors: string[] }) => {
    return (
        <div className="space-y-1.5 p-2 bg-slate-50/50 rounded-xl border border-slate-100 transition-all hover:bg-white hover:border-indigo-100">
            <div className="flex items-center gap-1.5">
                <div className="w-0.5 h-2.5 bg-indigo-200 rounded-full"></div>
                <label className="text-[8px] font-black text-slate-500 uppercase tracking-tight">{label}</label>
            </div>

            <div className="grid grid-cols-12 gap-1.5 items-center">
                {/* Font Size */}
                <div className="col-span-4 flex items-center bg-white rounded-lg border border-slate-200 px-2 h-8 focus-within:border-indigo-300 transition-all shadow-sm">
                    <i className="fa-solid fa-text-height text-[9px] text-slate-300 mr-1"></i>
                    <BufferedNumberInput
                        className="w-full bg-transparent text-[10px] font-black text-slate-800 outline-none"
                        value={config?.fontSize || 12}
                        onUpdate={val => onUpdate({ ...config, fontSize: val })}
                    />
                    <span className="text-[7px] font-black text-slate-300 ml-0.5">PT</span>
                </div>

                {/* Text Alignment */}
                <div className="col-span-5 flex bg-white p-0.5 rounded-lg border border-slate-200 shadow-sm h-8">
                    {[
                        { val: 'left', icon: 'fa-align-left' },
                        { val: 'center', icon: 'fa-align-center' },
                        { val: 'right', icon: 'fa-align-right' },
                    ].map(a => (
                        <button
                            key={a.val}
                            onClick={() => onUpdate({ ...config, textAlign: a.val })}
                            className={`flex-1 rounded-md flex items-center justify-center text-[8px] transition-all ${config?.textAlign === a.val ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}
                        >
                            <i className={`fa-solid ${a.icon}`}></i>
                        </button>
                    ))}
                </div>

                {/* Bold/Italic */}
                <div className="col-span-3 flex bg-white p-0.5 rounded-lg border border-slate-200 shadow-sm h-8">
                    <button
                        onClick={() => onUpdate({ ...config, fontWeight: config?.fontWeight === 'bold' ? 'normal' : 'bold' })}
                        className={`flex-1 rounded-md flex items-center justify-center text-[9px] font-black transition-all ${config?.fontWeight === 'bold' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}
                    >B</button>
                    <button
                        onClick={() => onUpdate({ ...config, fontStyle: config?.fontStyle === 'italic' ? 'normal' : 'italic' })}
                        className={`flex-1 rounded-md flex items-center justify-center text-[9px] font-serif italic transition-all ${config?.fontStyle === 'italic' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'}`}
                    >I</button>
                </div>
            </div>

            <div className="flex items-center gap-1.5">
                {/* Font Family Selection */}
                <div className="flex-1 relative group/select">
                    <select
                        className="w-full bg-white border border-slate-200 rounded-lg pl-2 pr-6 py-1.5 text-[9px] font-bold outline-none cursor-pointer appearance-none text-slate-600 focus:border-indigo-400 transition-all shadow-sm"
                        value={config?.fontFamily || 'inherit'}
                        onChange={(e) => onUpdate({ ...config, fontFamily: e.target.value })}
                    >
                        <option value="inherit">默认系统</option>
                        {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                    </select>
                    <i className="fa-solid fa-chevron-down absolute right-2 top-1/2 -translate-y-1/2 text-[7px] text-slate-300 pointer-events-none"></i>
                </div>

                {/* Color Picker */}
                <div className="w-8 h-8 flex items-center justify-center bg-white rounded-lg border border-slate-200 shadow-sm shrink-0">
                    <ColorPickerWithPresets
                        color={config?.color || '#000000'}
                        documentColors={documentColors}
                        onChange={(c) => onUpdate({ ...config, color: c })}
                        size="xs"
                    />
                </div>
            </div>
        </div>
    );
};

const BoxConfigEditor = ({ label, config, onUpdate, documentColors }: { label: string; config?: any; onUpdate: (updates: any) => void; documentColors: string[] }) => {
    return (
        <div className="space-y-1.5 p-2 bg-slate-50/50 rounded-xl border border-slate-100 transition-all hover:bg-white hover:border-indigo-100">
            <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5">
                    <div className="w-0.5 h-2.5 bg-indigo-200 rounded-full"></div>
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-tight">{label}</label>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onUpdate({ ...config, borderWidth: (config?.borderWidth ?? 1) === 0 ? 1 : 0 })}
                        className={`px-1.5 py-0.5 rounded text-[6px] font-black uppercase transition-all ${(config?.borderWidth ?? 1) === 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-400 hover:bg-slate-300'}`}
                    >
                        {(config?.borderWidth ?? 1) === 0 ? '无边框' : '有边框'}
                    </button>
                    <button
                        onClick={() => onUpdate({ ...config, backgroundColor: config?.backgroundColor === 'transparent' ? '#ffffff' : 'transparent' })}
                        className={`px-1.5 py-0.5 rounded text-[6px] font-black uppercase transition-all ${config?.backgroundColor === 'transparent' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-400 hover:bg-slate-300'}`}
                    >
                        {config?.backgroundColor === 'transparent' ? '无背景' : '有背景'}
                    </button>
                </div>
            </div>

            <div className="flex gap-2 items-end">
                {/* Fill Background */}
                <div className="flex-1 flex flex-col gap-1">
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest pl-0.5">背景填充</span>
                    <div className={`h-8 flex items-center justify-center bg-white rounded-lg border border-slate-200 px-1.5 shadow-sm transition-all ${config?.backgroundColor === 'transparent' ? 'opacity-30 grayscale' : ''}`}>
                        <div className="w-3.5 h-3.5 rounded-sm border border-slate-100 shadow-inner mr-1.5 shrink-0" style={{ backgroundColor: config?.backgroundColor === 'transparent' ? 'transparent' : (config?.backgroundColor || '#ffffff') }}></div>
                        <ColorPickerWithPresets
                            color={config?.backgroundColor === 'transparent' ? '#ffffff' : (config?.backgroundColor || '#ffffff')}
                            documentColors={documentColors}
                            onChange={(c) => onUpdate({ ...config, backgroundColor: c })}
                            size="xs"
                        />
                    </div>
                </div>

                {/* Border Width */}
                <div className="w-16 flex flex-col gap-1 text-center">
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">边框厚度</span>
                    <div className="h-8 flex items-center bg-white rounded-lg border border-slate-200 px-0.5 shadow-sm">
                        <BufferedNumberInput
                            className="flex-1 min-w-0 bg-transparent text-[10px] font-black text-slate-800 text-center outline-none"
                            value={config?.borderWidth ?? 1}
                            onUpdate={val => onUpdate({ ...config, borderWidth: val })}
                        />
                    </div>
                </div>

                {/* Border Color */}
                <div className="w-10 flex flex-col gap-1 text-right">
                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest pr-0.5">色</span>
                    <div className="h-8 flex items-center justify-center bg-white rounded-lg border border-slate-200 px-1 shadow-sm">
                        <ColorPickerWithPresets
                            color={config?.borderColor || '#cbd5e1'}
                            documentColors={documentColors}
                            onChange={(c) => onUpdate({ ...config, borderColor: c })}
                            size="xs"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export const NodeEditor: React.FC<NodeEditorProps> = ({
    node, connections, onUpdate, onSyncToGroup, onSyncTypographyGlobal, onDelete, onBack,
    onConnectionUpdate, onDeleteConnection, documentColors
}) => {
    const handleParamChange = (idx: number, val: string) => {
        const newParams = [...(node.params || [])];
        newParams[idx] = val;
        onUpdate({ params: newParams });
    };

    const [activeStyleTab, setActiveStyleTab] = useState<'title' | 'sub' | 'params'>('title');

    const outgoingConnections = connections
        .map((c, i) => ({ ...c, originalIdx: i }))
        .filter(c => c.from === node.id);

    const [isIconSelectorOpen, setIsIconSelectorOpen] = useState(false);

    return (
        <div className="flex flex-col h-full gap-3 overflow-y-auto custom-scrollbar pr-1.5 pb-24 relative">
            {/* 1. Integrated Header (Sticky) */}
            <div className="flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-30 pb-2 border-b border-slate-50">
                <div className="flex items-center gap-2.5">
                    <button onClick={onBack} className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all shadow-sm border border-slate-100">
                        <i className="fa-solid fa-chevron-left text-[9px]"></i>
                    </button>
                    <div className="flex flex-col">
                        <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-tight leading-none">节点属性配置</h3>
                        <p className="text-[6px] text-slate-400 font-bold mt-0.5 uppercase tracking-widest">Node Properties</p>
                    </div>
                </div>
                <button onClick={onDelete} className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm border border-rose-100">
                    <i className="fa-solid fa-trash-can text-[9px]"></i>
                </button>
            </div>

            {/* 2. Base Info Card (Removing overflow-hidden to fix popup clipping) */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50 relative z-10">
                {/* Title & Color Row */}
                <div className="p-2.5 bg-slate-50/30 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-500 shadow-inner relative group/icon">
                        <i className={`fa-solid ${node.icon || 'fa-square'} text-[11px]`}></i>
                        <input
                            className="absolute inset-0 opacity-0 cursor-text"
                            value={node.icon || ''}
                            onChange={(e) => onUpdate({ icon: e.target.value })}
                        />
                    </div>
                    <div className="flex-1 flex flex-col gap-1 py-1">
                        <input
                            className="w-full bg-transparent text-[10px] font-black text-slate-800 outline-none placeholder:text-slate-300"
                            value={node.text}
                            onChange={(e) => onUpdate({ text: e.target.value })}
                            placeholder="节点主标题..."
                        />
                        <textarea
                            className="w-full h-8 bg-slate-50/50 border border-slate-100 rounded-lg px-2 py-1 text-[8px] font-medium outline-none resize-none focus:border-indigo-300 transition-all placeholder:text-slate-300 text-slate-600"
                            value={node.subText || ''}
                            onChange={(e) => onUpdate({ subText: e.target.value })}
                            placeholder="详细描述..."
                        />
                    </div>
                    <div className="shrink-0 border-l border-slate-200 pl-2 ml-1">
                        <ColorPickerWithPresets
                            color={node.customColor?.startsWith('#') ? node.customColor : '#4f46e5'}
                            documentColors={documentColors}
                            onChange={(c) => onUpdate({ customColor: c })}
                            size="xs"
                        />
                    </div>
                </div>

                {/* Type & Icon Selector Section */}
                <div className="p-2.5 space-y-2">
                    {/* Node Type: Compact Chips & Input */}
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg px-2 h-7 focus-within:border-indigo-300 transition-all">
                            <i className="fa-solid fa-tag text-[8px] text-indigo-400 shrink-0"></i>
                            <input
                                className="w-full bg-transparent text-[8px] font-black outline-none text-slate-800 placeholder:text-slate-300 uppercase"
                                value={node.type || ''}
                                placeholder="输入/选择类别..."
                                onChange={(e) => onUpdate({ type: e.target.value })}
                            />
                        </div>
                        <div className="flex flex-wrap gap-1 px-0.5">
                            {[
                                { val: 'process', label: '处理', icon: 'fa-flask' },
                                { val: 'input', label: '输入', icon: 'fa-arrow-right-to-bracket' },
                                { val: 'output', label: '输出', icon: 'fa-arrow-right-from-bracket' },
                                { val: 'decision', label: '决策', icon: 'fa-diamond' },
                            ].map(t => (
                                <button
                                    key={t.val}
                                    onClick={() => onUpdate({ type: t.val })}
                                    className={`px-1.5 py-0.5 rounded text-[6px] font-black uppercase transition-all flex items-center gap-1 border ${node.type === t.val
                                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                                        : 'bg-white border-slate-100 text-slate-400 hover:text-indigo-600'
                                        }`}
                                >
                                    <i className={`fa-solid ${t.icon} text-[7px]`}></i>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Icon Selection Trigger */}
                    <div className="relative">
                        <div
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsIconSelectorOpen(prev => !prev);
                            }}
                            className={`flex items-center justify-between border-2 rounded-lg px-3 py-1.5 transition-all cursor-pointer select-none group/icon-trigger z-[40] relative ${isIconSelectorOpen
                                ? 'bg-indigo-600 border-indigo-400 shadow-md scale-[1.01]'
                                : 'bg-blue-50 border-blue-200 hover:bg-white hover:border-blue-400'
                                }`}
                        >
                            <div className="flex items-center gap-2.5 pointer-events-none">
                                <div className={`w-6 h-6 rounded flex items-center justify-center transition-all ${isIconSelectorOpen ? 'bg-white text-indigo-600' : 'bg-white text-blue-600 shadow-sm'}`}>
                                    <i className={`fa-solid ${node.icon || 'fa-icons'} text-[10px]`}></i>
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-tight ${isIconSelectorOpen ? 'text-white' : 'text-blue-700'}`}>
                                    {isIconSelectorOpen ? '请从库中选择...' : '点击这里图标选择库'}
                                </span>
                            </div>
                            <i className={`fa-solid fa-chevron-down text-[8px] transition-all duration-300 ${isIconSelectorOpen ? 'rotate-180 text-white' : 'text-blue-300 group-hover/icon-trigger:text-blue-500'}`}></i>
                        </div>

                        {/* Absolute Icon Library Panel */}
                        {isIconSelectorOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1.5 p-2 bg-white rounded-xl border-2 border-indigo-100 shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center justify-between mb-1.5 px-1 pb-1 border-b border-slate-50">
                                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <i className="fa-solid fa-microscope text-indigo-400"></i>
                                        学术 / 工业 图标库
                                    </p>
                                    <button onClick={(e) => { e.stopPropagation(); setIsIconSelectorOpen(false); }} className="text-slate-300 hover:text-rose-500">
                                        <i className="fa-solid fa-circle-xmark text-xs"></i>
                                    </button>
                                </div>
                                <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto custom-scrollbar p-0.5">
                                    {[
                                        'fa-flask', 'fa-vial', 'fa-vials', 'fa-mortar-pestle', 'fa-microscope', 'fa-dna', 'fa-atom', 'fa-bacteria', 'fa-virus', 'fa-leaf',
                                        'fa-bolt', 'fa-fire', 'fa-droplet', 'fa-temperature-high', 'fa-gauge-high', 'fa-magnet',
                                        'fa-database', 'fa-server', 'fa-microchip', 'fa-calculator', 'fa-brain', 'fa-network-wired', 'fa-code',
                                        'fa-chart-bar', 'fa-chart-line', 'fa-chart-pie', 'fa-chart-area', 'fa-file-lines', 'fa-file-medical', 'fa-file-export',
                                        'fa-gear', 'fa-wrench', 'fa-filter', 'fa-magnifying-glass', 'fa-eye', 'fa-star', 'fa-circle-check', 'fa-circle-exclamation', 'fa-shield-halved', 'fa-lock'
                                    ].map(ic => (
                                        <button
                                            key={ic}
                                            onClick={(e) => { e.stopPropagation(); onUpdate({ icon: ic }); }}
                                            className={`aspect-square rounded flex items-center justify-center transition-all border text-[10px] ${node.icon === ic
                                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm scale-105 z-10'
                                                : 'bg-slate-50 border-transparent text-slate-400 hover:bg-white hover:border-indigo-200 hover:text-indigo-600'
                                                }`}
                                        >
                                            <i className={`fa-solid ${ic}`}></i>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. Sync Control & Description Area (Dark Mode Panel) */}
            <div className="bg-slate-900 rounded-2xl p-3 shadow-md space-y-3">
                <div className="flex items-center justify-between px-0.5">
                    <div className="flex items-center gap-1.5">
                        <i className="fa-solid fa-sync text-indigo-400 text-[9px]"></i>
                        <span className="text-[9px] font-black text-white uppercase tracking-wider">同步机制控制</span>
                    </div>
                    <div className="flex gap-1.5">
                        <button
                            onClick={onSyncToGroup}
                            className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded text-[7px] font-black uppercase hover:bg-indigo-500/40 transition-all"
                        >同组应用</button>
                        <button
                            onClick={onSyncTypographyGlobal}
                            className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded text-[7px] font-black uppercase hover:bg-amber-500/40 transition-all"
                        >全图应用</button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div
                        onClick={() => onUpdate({ autoSync: !node.autoSync })}
                        className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition-all border ${node.autoSync ? 'bg-white/10 border-indigo-500/30' : 'bg-white/5 border-transparent'}`}
                    >
                        <span className={`text-[8px] font-bold ${node.autoSync ? 'text-indigo-200' : 'text-slate-400'}`}>组内同步</span>
                        <div className={`w-6 h-3.5 rounded-full relative ${node.autoSync ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                            <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${node.autoSync ? 'right-0.5' : 'left-0.5'}`} />
                        </div>
                    </div>
                    <div
                        onClick={() => onUpdate({ typographyGlobalSync: !node.typographyGlobalSync })}
                        className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition-all border ${node.typographyGlobalSync ? 'bg-white/10 border-amber-500/30' : 'bg-white/5 border-transparent'}`}
                    >
                        <span className={`text-[8px] font-bold ${node.typographyGlobalSync ? 'text-amber-200' : 'text-slate-400'}`}>排版同步</span>
                        <div className={`w-6 h-3.5 rounded-full relative ${node.typographyGlobalSync ? 'bg-amber-500' : 'bg-slate-700'}`}>
                            <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${node.typographyGlobalSync ? 'right-0.5' : 'left-0.5'}`} />
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Scholarly Styling Section */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 relative">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                        <i className="fa-solid fa-palette text-indigo-500 text-[10px]"></i>
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider">学术排版细节</span>
                    </div>
                    <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-100">
                        {['title', 'sub', 'params'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveStyleTab(tab as any)}
                                className={`px-2.5 py-1 rounded-md text-[8px] font-black uppercase transition-all ${activeStyleTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {tab === 'title' ? '标题' : tab === 'sub' ? '副标题' : '参数'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
                    <TextConfigEditor
                        label={activeStyleTab === 'title' ? '标题精细设置' : activeStyleTab === 'sub' ? '描述精细设置' : '列表项精细设置'}
                        config={activeStyleTab === 'title' ? node.textConfig : activeStyleTab === 'sub' ? node.subTextConfig : node.paramsConfig}
                        onUpdate={(cfg) => onUpdate({ [activeStyleTab === 'title' ? 'textConfig' : activeStyleTab === 'sub' ? 'subTextConfig' : 'paramsConfig']: cfg })}
                        documentColors={documentColors}
                    />
                </div>
            </div>

            {/* 5. Parameters & Connections */}
            <div className="space-y-3">
                <EditorSection label="参数列表项" icon="fa-list-check" action={
                    <button
                        onClick={() => onUpdate({ params: [...(node.params || []), '新参数'] })}
                        className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all border border-indigo-100"
                    >
                        <i className="fa-solid fa-plus text-[9px]"></i>
                    </button>
                }>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                        {(node.params || []).length === 0 && <p className="text-center py-4 text-[9px] text-slate-300 font-medium italic">— 暂无参数项 —</p>}
                        {(node.params || []).map((p, i) => (
                            <div key={i} className="flex gap-2 items-center bg-slate-50/50 p-1.5 rounded-xl border border-slate-50 group hover:border-indigo-100 transition-all">
                                <div className="w-1 h-3 rounded-full bg-slate-200 group-hover:bg-indigo-400 transition-colors ml-0.5"></div>
                                <input
                                    className="flex-1 bg-transparent text-[10px] font-bold outline-none text-slate-600"
                                    value={p}
                                    onChange={(e) => handleParamChange(i, e.target.value)}
                                />
                                <button
                                    onClick={() => onUpdate({ params: node.params!.filter((_, idx) => idx !== i) })}
                                    className="w-5 h-5 flex items-center justify-center text-slate-200 hover:text-rose-500 transition-all"
                                >
                                    <i className="fa-solid fa-xmark text-[8px]"></i>
                                </button>
                            </div>
                        ))}
                    </div>
                </EditorSection>

                {outgoingConnections.length > 0 && (
                    <EditorSection label="外向关联路径 (OUT)" icon="fa-route">
                        <div className="space-y-2">
                            {outgoingConnections.map((conn) => (
                                <div key={conn.originalIdx} className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100 space-y-2.5 hover:bg-white hover:border-indigo-100 transition-all group/conn">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-400 flex items-center justify-center shrink-0">
                                            <i className="fa-solid fa-arrow-turn-down text-[9px] rotate-[270deg]"></i>
                                        </div>
                                        <input
                                            className="flex-1 bg-transparent text-[10px] font-black text-slate-800 outline-none border-b border-transparent focus:border-indigo-200 py-0.5"
                                            value={conn.label || ''}
                                            onChange={(e) => onConnectionUpdate(conn.originalIdx, { label: e.target.value })}
                                            placeholder="路径说明..."
                                        />
                                        <button onClick={() => onDeleteConnection(conn.originalIdx)} className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors rounded hover:bg-rose-50">
                                            <i className="fa-solid fa-trash-can text-[9px]"></i>
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100/50">
                                        <div className="flex items-center gap-2">
                                            <ColorPickerWithPresets
                                                color={conn.color || '#94a3b8'}
                                                documentColors={documentColors}
                                                onChange={(c) => onConnectionUpdate(conn.originalIdx, { color: c })}
                                                size="xs"
                                            />
                                            {/* Arrow Shape Compact Picker */}
                                            <div className="flex bg-white rounded-lg border border-slate-200 p-0.5 shadow-sm gap-0.5">
                                                {[
                                                    { val: 'arrow', icon: 'fa-location-arrow' },
                                                    { val: 'dot', icon: 'fa-circle' },
                                                    { val: 'diamond', icon: 'fa-diamond' },
                                                    { val: 'bar', icon: 'fa-minus-vertical' },
                                                ].map(s => (
                                                    <button key={s.val} onClick={() => onConnectionUpdate(conn.originalIdx, { arrowShape: s.val as any })}
                                                        className={`w-6 h-6 flex items-center justify-center rounded transition-all ${(conn.arrowShape || 'arrow') === s.val ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:text-indigo-400 hover:bg-slate-50'}`}>
                                                        <i className={`fa-solid ${s.icon} text-[7px]`}></i>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex bg-white rounded-lg border border-slate-200 p-0.5 shadow-sm gap-0.5">
                                            {[
                                                { val: 'solid', icon: 'fa-minus' },
                                                { val: 'dashed', icon: 'fa-ellipsis' },
                                            ].map(s => (
                                                <button
                                                    key={s.val}
                                                    onClick={() => onConnectionUpdate(conn.originalIdx, { style: s.val as any })}
                                                    className={`w-8 h-6 flex items-center justify-center rounded transition-all ${(conn.style || 'solid') === s.val ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-300 hover:text-slate-600 hover:bg-slate-50'}`}
                                                >
                                                    <i className={`fa-solid ${s.icon} text-[8px]`}></i>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </EditorSection>
                )}
            </div>

            <button onClick={onBack} className="mt-2 w-full py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-slate-200 hover:bg-indigo-600 hover:shadow-indigo-100 transition-all active:scale-[0.98]">
                保存并退出编辑
            </button>
        </div>
    );
};

interface GroupEditorProps {
    group: DiagramGroup;
    onUpdate: (updates: Partial<DiagramGroup>) => void;
    onDelete: () => void;
    onBack: () => void;
    onSync?: () => void;
    documentColors: string[];
}

export const GroupEditor: React.FC<GroupEditorProps> = ({ group, onUpdate, onDelete, onBack, onSync, documentColors }) => {
    return (
        <div className="flex flex-col h-full gap-5 overflow-y-auto custom-scrollbar pr-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                        <i className="fa-solid fa-arrow-left text-[10px]"></i>
                    </button>
                    <div className="flex flex-col">
                        <h3 className="text-xs font-black text-slate-800 uppercase italic tracking-tighter leading-none">组分层级配置</h3>
                        <p className="text-[8px] text-slate-400 font-bold mt-0.5">GROUP SETTINGS</p>
                    </div>
                </div>
                <button onClick={onDelete} className="w-8 h-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                    <i className="fa-solid fa-trash-can text-xs"></i>
                </button>
            </div>

            <div className={`p-3 rounded-2xl border flex flex-col gap-2 transition-all ${group.autoSync ? 'bg-indigo-600 border-indigo-400 shadow-md' : 'bg-slate-900 border-slate-800'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${group.autoSync ? 'bg-white/20 text-white' : 'bg-white/5 text-indigo-400'}`}>
                            <i className={`fa-solid fa-object-group text-[10px] ${group.autoSync ? 'animate-spin-slow' : ''}`}></i>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-white leading-tight uppercase">全局组分同步</span>
                            <span className={`text-[7px] font-bold ${group.autoSync ? 'text-indigo-200' : 'text-slate-500'}`}>
                                {group.autoSync ? "层级框实时对齐" : "仅限当前层级"}
                            </span>
                        </div>
                    </div>
                    <div
                        onClick={() => onUpdate({ autoSync: !group.autoSync })}
                        className={`w-9 h-5 rounded-full relative transition-all cursor-pointer ${group.autoSync ? 'bg-emerald-500' : 'bg-slate-700'}`}
                    >
                        <div className={`absolute top-0.5 bottom-0.5 w-3.5 bg-white rounded-full transition-all duration-300 ${group.autoSync ? 'right-0.5' : 'left-0.5'}`}></div>
                    </div>
                </div>
                {onSync && (
                    <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSync(); }}
                        className={`w-full py-1.5 rounded-lg text-[8px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${group.autoSync ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                    >
                        <i className="fa-solid fa-expand text-[7px]"></i>
                        应用至所有层级
                    </button>
                )}
            </div>

            <EditorSection label="层级概览" icon="fa-font">
                <input
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[11px] font-black outline-none focus:ring-1 focus:ring-indigo-200 transition-all placeholder:text-slate-300 font-mono"
                    value={group.title}
                    onChange={(e) => onUpdate({ title: e.target.value })}
                    placeholder="输入层级标题..."
                />
            </EditorSection>

            <EditorSection label="视觉方案 (VISUALS)" icon="fa-swatchbook">
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white hover:border-indigo-100 transition-all">
                        <div className="flex items-center justify-between">
                            <p className="text-[9px] font-black text-slate-700 uppercase">边框配色</p>
                            <ColorPickerWithPresets
                                color={group.colorTheme?.startsWith('#') ? group.colorTheme : '#4f46e5'}
                                documentColors={documentColors}
                                onChange={(c) => onUpdate({ colorTheme: c })}
                                size="xs"
                            />
                        </div>
                        <button className="text-[7px] text-slate-400 hover:text-indigo-600 text-left uppercase font-bold" onClick={() => onUpdate({ colorTheme: undefined })}>RESET</button>
                    </div>
                    <div className="flex flex-col gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white hover:border-indigo-100 transition-all">
                        <div className="flex items-center justify-between">
                            <p className="text-[9px] font-black text-slate-700 uppercase">背景填充</p>
                            <ColorPickerWithPresets
                                color={group.config?.backgroundColor || '#6366f1'}
                                documentColors={documentColors}
                                onChange={(c) => onUpdate({ config: { ...group.config, backgroundColor: c } })}
                                size="xs"
                            />
                        </div>
                        <button className="text-[7px] text-slate-400 hover:text-rose-600 text-left uppercase font-bold" onClick={() => onUpdate({ config: { ...group.config, backgroundColor: undefined, fillOpacity: undefined } })}>CLEAR</button>
                    </div>
                    <div className="flex flex-col gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white hover:border-indigo-100 transition-all">
                        <div className="flex items-center justify-between">
                            <p className="text-[9px] font-black text-slate-700 uppercase">标头底色</p>
                            <ColorPickerWithPresets
                                color={group.config?.titleBgColor || '#ffffff'}
                                documentColors={documentColors}
                                onChange={(c) => onUpdate({ config: { ...group.config, titleBgColor: c } })}
                                size="xs"
                            />
                        </div>
                        <button className="text-[7px] text-slate-400 hover:text-indigo-600 text-left uppercase font-bold" onClick={() => onUpdate({ config: { ...group.config, titleBgColor: undefined } })}>DEFAULT</button>
                    </div>
                    <div className="flex flex-col gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white hover:border-indigo-100 transition-all">
                        <div className="flex items-center justify-between">
                            <p className="text-[9px] font-black text-slate-700 uppercase">标题文本</p>
                            <ColorPickerWithPresets
                                color={group.config?.titleTextColor || '#1e293b'}
                                documentColors={documentColors}
                                onChange={(c) => onUpdate({ config: { ...group.config, titleTextColor: c } })}
                                size="xs"
                            />
                        </div>
                        <button className="text-[7px] text-slate-400 hover:text-indigo-600 text-left uppercase font-bold" onClick={() => onUpdate({ config: { ...group.config, titleTextColor: undefined } })}>DEFAULT</button>
                    </div>
                </div>
                {group.config?.backgroundColor && (
                    <div className="p-2 bg-slate-900 rounded-xl mt-1.5 space-y-1.5 shadow-inner">
                        <div className="flex justify-between items-center">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-0.5">填充透明度 (OPACITY)</span>
                            <span className="text-[9px] font-black text-indigo-400 font-mono italic">{Math.round((group.config?.fillOpacity ?? 0.25) * 100)}%</span>
                        </div>
                        <input
                            type="range" min="0" max="1" step="0.05"
                            value={group.config?.fillOpacity ?? 0.25}
                            onChange={(e) => onUpdate({ config: { ...group.config, fillOpacity: parseFloat(e.target.value) } })}
                            className="w-full h-1 accent-indigo-500 bg-white/10 rounded-full appearance-none cursor-pointer"
                        />
                    </div>
                )}
            </EditorSection>

            <details className="group/details">
                <summary className="list-none cursor-pointer p-2.5 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between hover:bg-white transition-all shadow-sm">
                    <div className="flex items-center gap-2">
                        <i className="fa-solid fa-sliders text-indigo-500 text-[10px]"></i>
                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">标注排版高级设置</span>
                    </div>
                    <i className="fa-solid fa-chevron-down text-slate-300 text-[10px] group-open/details:rotate-180 transition-transform"></i>
                </summary>

                <div className="mt-2.5 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <EditorSection label="标题排版" icon="fa-text-width">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-200 px-2.5 h-8 shadow-inner group/in focus-within:border-indigo-300 transition-all">
                                <i className="fa-solid fa-text-height text-[9px] text-slate-300 group-focus-within/in:text-indigo-500 mr-1.5"></i>
                                <BufferedNumberInput className="w-full bg-transparent text-[10px] font-black text-slate-800 outline-none" value={group.config?.titleSize || 14} onUpdate={val => onUpdate({ config: { ...group.config, titleSize: val } })} />
                                <span className="text-[8px] font-black text-slate-300 ml-1 shrink-0">PT</span>
                            </div>
                            <div className="flex bg-slate-50 p-0.5 rounded-lg border border-slate-200 shadow-inner">
                                <button onClick={() => onUpdate({ config: { ...group.config, titleFontWeight: group.config?.titleFontWeight === 'bold' ? 'normal' : 'bold' } })} className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-black transition-all ${group.config?.titleFontWeight === 'bold' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>B</button>
                                <button onClick={() => onUpdate({ config: { ...group.config, titleFontStyle: group.config?.titleFontStyle === 'italic' ? 'normal' : 'italic' } })} className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-serif italic transition-all ${group.config?.titleFontStyle === 'italic' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}>I</button>
                            </div>
                        </div>
                        <div className="relative">
                            <select className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-[10px] font-bold outline-none cursor-pointer appearance-none text-slate-600 focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner" value={group.config?.titleFontFamily || 'inherit'} onChange={(e) => onUpdate({ config: { ...group.config, titleFontFamily: e.target.value } })}>
                                <option value="inherit">默认系统字体</option>
                                {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                            </select>
                            <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-300 pointer-events-none"></i>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                            <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 px-1.5 h-8 shadow-inner focus-within:border-indigo-300 transition-all overflow-visible">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-tight mr-1 shrink-0">Y</span>
                                <button onClick={() => onUpdate({ config: { ...group.config, titlePaddingY: Math.max(0, (group.config?.titlePaddingY ?? 10) - 1) } })} className="w-5 h-5 rounded shrink-0 hover:bg-white text-slate-400 flex items-center justify-center"><i className="fa-solid fa-minus text-[6px]"></i></button>
                                <BufferedNumberInput
                                    className="flex-1 min-w-0 bg-transparent text-[10px] font-black text-slate-800 text-center outline-none"
                                    value={group.config?.titlePaddingY ?? 10}
                                    onUpdate={val => onUpdate({ config: { ...group.config, titlePaddingY: val } })}
                                />
                                <button onClick={() => onUpdate({ config: { ...group.config, titlePaddingY: (group.config?.titlePaddingY ?? 10) + 1 } })} className="w-5 h-5 rounded shrink-0 hover:bg-white text-slate-400 flex items-center justify-center"><i className="fa-solid fa-plus text-[6px]"></i></button>
                            </div>
                            <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 px-1.5 h-8 shadow-inner focus-within:border-indigo-300 transition-all overflow-visible">
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-tight mr-1 shrink-0">X</span>
                                <button onClick={() => onUpdate({ config: { ...group.config, titlePaddingX: Math.max(0, (group.config?.titlePaddingX ?? 24) - 2) } })} className="w-5 h-5 rounded shrink-0 hover:bg-white text-slate-400 flex items-center justify-center"><i className="fa-solid fa-minus text-[6px]"></i></button>
                                <BufferedNumberInput
                                    className="flex-1 min-w-0 bg-transparent text-[10px] font-black text-slate-800 text-center outline-none"
                                    value={group.config?.titlePaddingX ?? 24}
                                    onUpdate={val => onUpdate({ config: { ...group.config, titlePaddingX: val } })}
                                />
                                <button onClick={() => onUpdate({ config: { ...group.config, titlePaddingX: (group.config?.titlePaddingX ?? 24) + 2 } })} className="w-5 h-5 rounded shrink-0 hover:bg-white text-slate-400 flex items-center justify-center"><i className="fa-solid fa-plus text-[6px]"></i></button>
                            </div>
                        </div>
                    </EditorSection>

                    <EditorSection label="边框厚度" icon="fa-border-style">
                        <div className="flex items-center gap-2 bg-slate-900 rounded-xl p-1 shadow-lg">
                            <button onClick={() => onUpdate({ config: { ...group.config, borderWidth: Math.max(0, (group.config?.borderWidth ?? 2) - 1) } })} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all flex items-center justify-center shrink-0"><i className="fa-solid fa-minus text-[10px]"></i></button>
                            <div className="flex-1 text-center">
                                <p className="text-[10px] font-black text-indigo-400 font-mono tracking-widest leading-none">{group.config?.borderWidth ?? 2}PX</p>
                                <p className="text-[6px] text-white/40 font-bold uppercase mt-0.5">Thickness</p>
                            </div>
                            <button onClick={() => onUpdate({ config: { ...group.config, borderWidth: Math.min(10, (group.config?.borderWidth ?? 2) + 1) } })} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all flex items-center justify-center shrink-0"><i className="fa-solid fa-plus text-[10px]"></i></button>
                        </div>
                    </EditorSection>
                </div>
            </details>

            <button onClick={onBack} className="mt-4 mb-2 w-full py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase shadow-lg hover:bg-indigo-600 transition-all active:scale-[0.98]">
                完成并应用设置
            </button>
        </div>
    );
};

interface ConnectionEditorProps {
    connection: Connection;
    onUpdate: (updates: Partial<Connection>) => void;
    onDelete: () => void;
    onBack: () => void;
    onSync?: () => void;
    documentColors: string[];
}

export const ConnectionEditor: React.FC<ConnectionEditorProps> = ({ connection, onUpdate, onDelete, onBack, onSync, documentColors }) => {
    return (
        <div className="flex flex-col h-full gap-3 overflow-y-auto custom-scrollbar pr-1.5 pb-20">
            {/* 1. Header Area: More Compact */}
            <div className="flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10 py-1.5 border-b border-slate-50 mb-1">
                <div className="flex items-center gap-2.5">
                    <button onClick={onBack} className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all shadow-sm border border-slate-100">
                        <i className="fa-solid fa-chevron-left text-[9px]"></i>
                    </button>
                    <div className="flex flex-col">
                        <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-tight leading-none">逻辑连线编辑</h3>
                        <p className="text-[6px] text-slate-400 font-bold mt-0.5 uppercase tracking-widest">Logic Connection</p>
                    </div>
                </div>
                <button onClick={onDelete} className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm border border-rose-100">
                    <i className="fa-solid fa-trash-can text-[9px]"></i>
                </button>
            </div>

            {/* 2. Global Sync: Sleeker Toggle Card - Clickable card */}
            <div
                onClick={() => onUpdate({ autoSync: !connection.autoSync })}
                className={`p-2.5 rounded-2xl border flex items-center justify-between transition-all cursor-pointer group/sync-card ${connection.autoSync ? 'bg-indigo-600 border-indigo-500 shadow-md shadow-indigo-100' : 'bg-slate-900 border-slate-800 shadow-lg hover:bg-slate-800'}`}
            >
                <div className="flex items-center gap-2.5 pointer-events-none">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${connection.autoSync ? 'bg-white/20 text-white' : 'bg-white/10 text-indigo-400'}`}>
                        <i className={`fa-solid fa-arrows-spin text-[9px] ${connection.autoSync ? 'animate-spin-slow' : ''}`}></i>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-white leading-none uppercase tracking-wide">全局连线同步</span>
                        <span className={`text-[7px] font-bold ${connection.autoSync ? 'text-indigo-200' : 'text-slate-500'} mt-0.5`}>
                            {connection.autoSync ? "样式全网对齐" : "单路径独立配置"}
                        </span>
                    </div>
                </div>
                <div className={`w-8 h-4.5 rounded-full relative transition-all ${connection.autoSync ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                    <div className={`absolute top-0.5 bottom-0.5 w-3.5 bg-white rounded-full transition-all duration-300 ${connection.autoSync ? 'right-0.5' : 'left-0.5'}`}></div>
                </div>
            </div>

            {/* 3. Basic Identity & Text Styling */}
            <div className="space-y-3">
                <EditorSection label="路径标识文本" icon="fa-id-card">
                    <input
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1.5 text-[10px] font-black outline-none focus:border-indigo-300 transition-all placeholder:text-slate-300 shadow-inner font-mono"
                        value={connection.label || ''}
                        onChange={(e) => onUpdate({ label: e.target.value })}
                        placeholder="输入路径标识文字..."
                    />
                </EditorSection>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2.5">
                    <div className="flex items-center gap-1.5 mb-2">
                        <i className="fa-solid fa-palette text-indigo-500 text-[10px]"></i>
                        <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider">连线标签细节美化 (AESTHETICS)</span>
                    </div>
                    <div className="space-y-2.5">
                        <TextConfigEditor
                            label="文字排版属性"
                            config={connection.labelConfig}
                            onUpdate={(cfg) => onUpdate({ labelConfig: cfg })}
                            documentColors={documentColors}
                        />
                        <BoxConfigEditor
                            label="容器边框属性"
                            config={connection.boxConfig}
                            onUpdate={(cfg) => onUpdate({ boxConfig: cfg })}
                            documentColors={documentColors}
                        />
                    </div>
                </div>

                <div className="px-1 flex items-center justify-between bg-slate-50 p-1.5 rounded-xl border border-slate-100 h-9">
                    <span className="text-[8px] font-black text-slate-400 uppercase ml-1">路径描边配色 (COLOR)</span>
                    <ColorPickerWithPresets
                        color={connection.color || '#94a3b8'}
                        documentColors={documentColors}
                        onChange={(c) => onUpdate({ color: c })}
                        size="xs"
                    />
                </div>

                <div className="bg-slate-900 rounded-2xl p-2.5 space-y-2 mb-1">
                    <div className="flex items-center gap-1.5 mb-1">
                        <i className="fa-solid fa-arrows-to-circle text-indigo-400 text-[8px]"></i>
                        <span className="text-[8px] font-black text-white/50 uppercase tracking-widest">标签相对位置 (POSITION)</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                        {[
                            { val: 'above', icon: 'fa-arrow-up', label: '上' },
                            { val: 'below', icon: 'fa-arrow-down', label: '下' },
                            { val: 'left', icon: 'fa-arrow-left', label: '左' },
                            { val: 'right', icon: 'fa-arrow-right', label: '右' },
                            { val: 'on-line', icon: 'fa-minus', label: '中' },
                        ].map(pos => (
                            <button
                                key={pos.val}
                                onClick={() => onUpdate({ labelPosition: pos.val as any })}
                                className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-lg border transition-all ${(connection.labelPosition || 'on-line') === pos.val
                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                                        : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10 hover:text-indigo-400'
                                    }`}
                            >
                                <i className={`fa-solid ${pos.icon} text-[8px]`}></i>
                                <span className="text-[7px] font-black uppercase">{pos.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 4. Physical Geometry: Width, Size and Stroke Type */}
            <EditorSection label="物理几何属性" icon="fa-ruler-combined">
                <div className="space-y-2.5">
                    {/* Width and Arrow Size Sliders */}
                    <div className="bg-slate-900 rounded-xl p-2.5 space-y-2.5 shadow-md">
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center px-0.5">
                                <div className="flex items-center gap-1.5">
                                    <i className="fa-solid fa-minus text-[8px] text-indigo-400"></i>
                                    <label className="text-[8px] font-black text-white/50 uppercase tracking-widest">物理宽度</label>
                                </div>
                                <span className="text-[9px] font-black text-indigo-400 font-mono">{connection.width || 2}PX</span>
                            </div>
                            <div className="flex items-center gap-1 bg-white/5 rounded-lg border border-white/5 p-0.5 h-8">
                                <button onClick={() => onUpdate({ width: Math.max(1, (connection.width || 2) - 1) })} className="w-7 h-7 rounded hover:bg-white/10 text-white transition-all"><i className="fa-solid fa-minus text-[8px]"></i></button>
                                <input type="range" min="1" max="15" step="1" className="flex-1 h-1 accent-indigo-500 bg-white/10 rounded-full appearance-none cursor-pointer mx-1" value={connection.width || 2} onChange={(e) => onUpdate({ width: parseInt(e.target.value) })} />
                                <button onClick={() => onUpdate({ width: Math.min(15, (connection.width || 2) + 1) })} className="w-7 h-7 rounded hover:bg-white/10 text-white transition-all"><i className="fa-solid fa-plus text-[8px]"></i></button>
                            </div>
                        </div>

                        <div className="space-y-1.5 pt-1 border-t border-white/5">
                            <div className="flex justify-between items-center px-0.5">
                                <div className="flex items-center gap-1.5">
                                    <i className="fa-solid fa-location-arrow text-[8px] text-indigo-400"></i>
                                    <label className="text-[8px] font-black text-white/50 uppercase tracking-widest">箭头尺寸</label>
                                </div>
                                <span className="text-[9px] font-black text-indigo-400 font-mono">{connection.arrowSize || 10}PT</span>
                            </div>
                            <div className="flex items-center gap-1 bg-white/5 rounded-lg border border-white/5 p-0.5 h-8">
                                <button onClick={() => onUpdate({ arrowSize: Math.max(5, (connection.arrowSize || 10) - 1) })} className="w-7 h-7 rounded hover:bg-white/10 text-white transition-all"><i className="fa-solid fa-minus text-[8px]"></i></button>
                                <input type="range" min="5" max="30" step="1" className="flex-1 h-1 accent-indigo-500 bg-white/10 rounded-full appearance-none cursor-pointer mx-1" value={connection.arrowSize || 10} onChange={(e) => onUpdate({ arrowSize: parseInt(e.target.value) })} />
                                <button onClick={() => onUpdate({ arrowSize: Math.min(30, (connection.arrowSize || 10) + 1) })} className="w-7 h-7 rounded hover:bg-white/10 text-white transition-all"><i className="fa-solid fa-plus text-[8px]"></i></button>
                            </div>
                        </div>
                    </div>

                    {/* Stroke Pattern Picker */}
                    <div className="flex bg-slate-50 rounded-xl border border-slate-100 p-1 gap-1 h-9 shadow-inner">
                        {[
                            { val: 'solid', label: '实线', icon: 'fa-minus' },
                            { val: 'dashed', label: '虚线', icon: 'fa-ellipsis' },
                            { val: 'dotted', label: '点线', icon: 'fa-ellipsis-vertical' },
                        ].map(s => (
                            <button key={s.val} onClick={() => onUpdate({ style: s.val as any })}
                                className={`flex-1 rounded-lg transition-all flex items-center justify-center gap-1.5 ${(connection.style || 'solid') === s.val ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-indigo-600'}`}>
                                <i className={`fa-solid ${s.icon} text-[9px]`}></i>
                                <span className="text-[8px] font-black uppercase tracking-tight">{s.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </EditorSection>

            {/* 5. Terminal Configurations: Direction & Shape */}
            <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1.5">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                        <i className="fa-solid fa-location-arrow text-[7px]"></i> 方向
                    </label>
                    <div className="grid grid-cols-2 bg-white rounded-2xl border border-slate-100 p-1 gap-1 shadow-sm h-14">
                        {[
                            { val: 'forward', label: '单向', icon: '→' },
                            { val: 'bidirectional', label: '双向', icon: '↔' },
                            { val: 'none', label: '无', icon: '—' },
                            { val: 'backward', label: '反向', icon: '←' },
                        ].map(a => (
                            <button key={a.val} onClick={() => onUpdate({ arrowType: a.val as any })}
                                className={`rounded-lg border text-[8px] font-black transition-all flex items-center justify-center -space-y-0.5 gap-1 ${(connection.arrowType || 'forward') === a.val ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'border-transparent text-slate-400 hover:bg-slate-50'}`}>
                                <span className="text-[10px] leading-tight font-black">{a.icon}</span>
                                <span className="scale-90">{a.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                        <i className="fa-solid fa-shapes text-[7px]"></i> 形状
                    </label>
                    <div className="grid grid-cols-2 bg-white rounded-2xl border border-slate-100 p-1 gap-1 shadow-sm h-14">
                        {[
                            { val: 'arrow', label: '经典', icon: 'fa-location-arrow' },
                            { val: 'dot', label: '圆形', icon: 'fa-circle' },
                            { val: 'diamond', label: '菱形', icon: 'fa-diamond' },
                            { val: 'bar', label: '端点', icon: 'fa-minus-vertical' },
                        ].map(s => (
                            <button key={s.val} onClick={() => onUpdate({ arrowShape: s.val as any })}
                                className={`rounded-lg border text-[8px] font-black uppercase transition-all flex items-center justify-center gap-1 ${(connection.arrowShape || 'arrow') === s.val ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'border-transparent text-slate-400 hover:bg-slate-50'}`}>
                                <i className={`fa-solid ${s.icon} text-[8px]`}></i>
                                <span className="scale-90">{s.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <button onClick={onBack} className="mt-2 w-full py-2.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-600 transition-all active:scale-[0.98] border border-white/10">
                完成路径更新
            </button>
        </div>
    );
};


