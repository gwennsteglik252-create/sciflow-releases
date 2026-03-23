/**
 * SankeySidebar.tsx
 * ─────────────────────────────────────────────────────────────────
 * 桑基图专用配置中心 (学术白风格版)
 * 极致模仿结构图与分类树的视觉规范，实现全站 UI 统一
 */

import React, { useState, useMemo } from 'react';
import { SchemeLibraryModal } from '../SchemeLibraryModal';
import {
    SankeyData,
    SankeyAlignment,
    SankeyCurveType,
    SavedSankey,
    SankeyNode
} from '../../../types/visuals';
import { ACADEMIC_PALETTES } from '../Structure/constants';
import { ColorPickerWithPresets } from '../../DataAnalysis/Chart/ColorPickerWithPresets';
import { computeNodeColumns } from './sankeyLayout';

interface SankeySidebarProps {
    userPrompt: string;
    onUserPromptChange: (v: string) => void;
    isGenerating: boolean;
    onGenerate: () => void;
    onCreateEmpty: () => void;
    data: SankeyData | null;
    setData: (d: SankeyData | null) => void;
    selectedNodeId: string | null;
    setSelectedNodeId: (id: string | null) => void;

    // Logic Operations
    updateNode: (id: string, updates: Partial<SankeyNode>) => void;
    deleteNode: (id: string) => void;
    addNode: () => void;
    updateLink: (id: string, updates: any) => void;
    deleteLink: (id: string) => void;
    addLink: (s: string, t: string, v: number) => void;
    updateGlobal: (updates: Partial<SankeyData>) => void;

    // Tools
    aiLanguage: 'zh' | 'en';
    onAiLanguageChange: (l: 'zh' | 'en') => void;
    aiComplexity: 'simple' | 'moderate' | 'complex';
    onAiComplexityChange: (c: 'simple' | 'moderate' | 'complex') => void;
    onExportPng: () => void;
    onUndo: () => void;
    onRedo: () => void;
    canUndo: boolean;
    canRedo: boolean;

    // Library
    savedSankeys: SavedSankey[];
    showLibrary: boolean;
    setShowLibrary: (v: boolean) => void;
    onLoadSaved: (item: SavedSankey) => void;
    onDeleteSaved: (id: string, e: React.MouseEvent) => void;
    onRenameSaved: (id: string, name: string) => void;
    onCategoryChange: (id: string, newCategory: string) => void;

    // Save Modal
    showSaveModal: boolean;
    setShowSaveModal: (v: boolean) => void;
    saveTitle: string;
    setSaveTitle: (v: string) => void;
    onConfirmSave: (asNew?: boolean) => void;
    onSaveToLibrary: () => void;
    editingTitle?: boolean;
    setEditingTitle?: (v: boolean) => void;
}

const ALIGN_OPTIONS: { value: SankeyAlignment; label: string; icon: string }[] = [
    { value: 'justify', label: '两端', icon: 'fa-solid fa-align-justify' },
    { value: 'left', label: '居左', icon: 'fa-solid fa-align-left' },
    { value: 'right', label: '居右', icon: 'fa-solid fa-align-right' },
    { value: 'center', label: '中心', icon: 'fa-solid fa-align-center' },
];

const CURVE_OPTIONS: { value: SankeyCurveType; label: string; icon: string }[] = [
    { value: 'bezier', label: '贝塞尔', icon: 'fa-solid fa-wave-square' },
    { value: 'linear', label: '折线', icon: 'fa-solid fa-lines-leaning' },
    { value: 'step', label: '阶梯', icon: 'fa-solid fa-stairs' },
];

const ICON_OPTIONS = [
    'fa-solid fa-tag', 'fa-solid fa-bookmark', 'fa-solid fa-star', 'fa-solid fa-lightbulb',
    'fa-solid fa-gear', 'fa-solid fa-atom', 'fa-solid fa-microscope', 'fa-solid fa-flask',
    'fa-solid fa-dna', 'fa-solid fa-chart-line', 'fa-solid fa-database', 'fa-solid fa-server',
    'fa-solid fa-code', 'fa-solid fa-brain', 'fa-solid fa-network-wired', 'fa-solid fa-globe',
    'fa-solid fa-bolt', 'fa-solid fa-shield-halved', 'fa-solid fa-user-graduate', 'fa-solid fa-building-columns'
];

const LAYOUT_MODE_OPTIONS: { value: 'linear' | 'chord'; icon: string; label: string; desc: string }[] = [
    { value: 'linear', icon: 'fa-solid fa-arrows-left-right', label: '线性流向', desc: '由左至右的传统桑基布局' },
    { value: 'chord', icon: 'fa-solid fa-circle-nodes', label: '环形流向', desc: '基于弦图的循环数据可视化' },
];

export const SankeySidebar: React.FC<SankeySidebarProps> = (props) => {
    const {
        userPrompt, onUserPromptChange, isGenerating, onGenerate, onCreateEmpty,
        data, setData, selectedNodeId, setSelectedNodeId,
        updateNode, deleteNode, addNode,
        updateLink, deleteLink, addLink,
        updateGlobal,
        aiLanguage, onAiLanguageChange, aiComplexity, onAiComplexityChange, onExportPng,
        onUndo, onRedo, canUndo, canRedo,
        savedSankeys, showLibrary, setShowLibrary, onLoadSaved, onDeleteSaved,
        onRenameSaved, onCategoryChange, onSaveToLibrary,
        showSaveModal, setShowSaveModal, saveTitle, setSaveTitle, onConfirmSave,
        editingTitle, setEditingTitle
    } = props;

    const [showAi, setShowAi] = useState(false);
    const [showStyle, setShowStyle] = useState(true);
    const [showTopo, setShowTopo] = useState(true);

    const [addLinkSource, setAddLinkSource] = useState<string | null>(null);
    const [addLinkValue, setAddLinkValue] = useState(10);


    const selectedNode = data?.nodes.find(n => n.id === selectedNodeId);

    // 拓扑列计算（轻量级，不含坐标布局）
    const topoColumns = useMemo(() => {
        if (!data) return [];
        return computeNodeColumns(data);
    }, [data]);

    // 连线快速查找
    const linksByNode = useMemo(() => {
        const map = new Map<string, { out: { id: string; source: string; target: string; value: number }[]; in: { id: string; source: string; target: string; value: number }[] }>();
        if (!data) return map;
        data.nodes.forEach(n => map.set(n.id, { out: [], in: [] }));
        data.links.forEach(l => {
            map.get(l.source)?.out.push(l);
            map.get(l.target)?.in.push(l);
        });
        return map;
    }, [data]);

    // 配色方案应用助手
    const applyPalette = (colors: string[]) => {
        if (!data) return;
        const newNodes = data.nodes.map((n, i) => ({
            ...n,
            color: colors[i % colors.length]
        }));
        updateGlobal({ colorPalette: [...colors], nodes: newNodes });
    };

    const onSyncStyleToAll = (node: SankeyNode) => {
        if (!data) return;
        // Only sync layout/typography, NOT colors
        const { color: _textColor, ...styleToSync } = (node.style || {}) as any;
        const newNodes = data.nodes.map(n => {
            if (n.id === node.id) return n;
            const { color: existingTextColor, ...existingStyle } = (n.style || {}) as any;
            return {
                ...n,
                style: {
                    ...existingStyle,
                    ...styleToSync,
                    // Preserve each node's own colors
                    ...(existingTextColor ? { color: existingTextColor } : {}),
                },
            };
        });
        setData({ ...data, nodes: newNodes });
    };

    // ─── Render Title Editor View ───
    if (editingTitle && data) {
        return (
            <div className="w-full lg:w-80 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-2xl flex flex-col gap-5 overflow-y-auto custom-scrollbar shrink-0 z-20 animate-reveal">
                {/* Back Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setEditingTitle?.(false)}
                        className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-lg hover:border-indigo-200 transition-all active:scale-95 text-[12px]"
                    >
                        <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-tighter italic leading-none">编辑标题</h3>
                        <p className="text-[10px] text-slate-400 font-bold mt-1.5 uppercase tracking-widest">Layout Title Editor</p>
                    </div>
                </div>

                <div className="space-y-2">
                    {/* 显示/隐藏 */}
                    <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-400 uppercase">显示标题</span>
                        <button
                            onClick={() => updateGlobal({ titleStyle: { ...data.titleStyle, hidden: !data.titleStyle?.hidden } })}
                            className={`w-9 h-5 rounded-full flex items-center transition-all duration-300 ${!data.titleStyle?.hidden ? 'bg-indigo-600 justify-end' : 'bg-slate-200 justify-start'}`}
                        >
                            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-md mx-0.5 transition-all"></div>
                        </button>
                    </div>

                    {/* 标题文本 */}
                    <input
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all placeholder:text-slate-300"
                        value={data.title ?? ''}
                        placeholder="输入标题..."
                        onChange={(e) => updateGlobal({ title: e.target.value })}
                        autoFocus
                    />

                    {/* 字体 */}
                    <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-400 uppercase">字体</span>
                    </div>
                    <select
                        value={data.titleStyle?.fontFamily || 'Inter, sans-serif'}
                        onChange={(e) => updateGlobal({ titleStyle: { ...data.titleStyle, fontFamily: e.target.value } })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all cursor-pointer appearance-none"
                        style={{ fontFamily: data.titleStyle?.fontFamily || 'Inter, sans-serif' }}
                    >
                        {[
                            { value: 'Inter, sans-serif', label: 'Inter' },
                            { value: 'Roboto, sans-serif', label: 'Roboto' },
                            { value: 'Outfit, sans-serif', label: 'Outfit' },
                            { value: "'Noto Sans SC', sans-serif", label: 'Noto Sans SC' },
                            { value: "'Noto Serif SC', serif", label: 'Noto Serif SC' },
                            { value: "Georgia, serif", label: 'Georgia' },
                            { value: "'Times New Roman', serif", label: 'Times New Roman' },
                            { value: "system-ui, sans-serif", label: '系统默认' },
                            { value: "'Courier New', monospace", label: 'Courier New' },
                            { value: "'SF Mono', monospace", label: 'SF Mono' },
                            { value: "Menlo, monospace", label: 'Menlo' },
                            { value: "'PingFang SC', sans-serif", label: '苹方' },
                        ].map(f => (
                            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                                {f.label}
                            </option>
                        ))}
                    </select>

                    {/* 字号 */}
                    <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-400 uppercase">字号</span>
                        <span className="text-[8px] font-black text-indigo-600 font-mono">{data.titleStyle?.fontSize ?? 13}px</span>
                    </div>
                    <input type="range" min={8} max={28} value={data.titleStyle?.fontSize ?? 13}
                        onChange={(e) => updateGlobal({ titleStyle: { ...data.titleStyle, fontSize: Number(e.target.value) } })}
                        className="w-full h-1 accent-indigo-500 bg-slate-200 rounded-full appearance-none cursor-pointer"
                    />

                    {/* B / I / U / 颜色 */}
                    <div className="flex items-center gap-1">
                        <button onClick={() => updateGlobal({ titleStyle: { ...data.titleStyle, fontWeight: (data.titleStyle?.fontWeight === '700' || data.titleStyle?.fontWeight === 'bold') ? '400' : '700' } })}
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center text-[11px] font-black transition-all ${(data.titleStyle?.fontWeight === '700' || data.titleStyle?.fontWeight === 'bold') ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300'}`}
                        >B</button>
                        <button onClick={() => updateGlobal({ titleStyle: { ...data.titleStyle, fontStyle: data.titleStyle?.fontStyle === 'italic' ? 'normal' : 'italic' } })}
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center text-[11px] italic font-bold transition-all ${data.titleStyle?.fontStyle === 'italic' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300'}`}
                        >I</button>
                        <button onClick={() => updateGlobal({ titleStyle: { ...data.titleStyle, textDecoration: data.titleStyle?.textDecoration === 'underline' ? 'none' : 'underline' } })}
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center text-[11px] font-bold underline transition-all ${data.titleStyle?.textDecoration === 'underline' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300'}`}
                        >U</button>
                        <div
                            className="w-7 h-7 rounded-lg border border-slate-200 cursor-pointer shadow-inner shrink-0"
                            style={{ backgroundColor: data.titleStyle?.color || '#64748b' }}
                            onClick={() => {
                                const inp = document.createElement('input');
                                inp.type = 'color';
                                inp.value = data.titleStyle?.color || '#64748b';
                                inp.onchange = (e) => updateGlobal({ titleStyle: { ...data.titleStyle, color: (e.target as HTMLInputElement).value } });
                                inp.click();
                            }}
                        ></div>
                        <div className="flex-1"></div>
                        <button onClick={() => updateGlobal({ titleStyle: undefined })} className="text-[8px] font-black text-slate-300 hover:text-rose-500 transition-colors" title="重置标题样式">
                            <i className="fa-solid fa-rotate-left"></i>
                        </button>
                    </div>

                    {/* 字间距 */}
                    <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-400 uppercase">字间距</span>
                        <span className="text-[8px] font-black text-indigo-600 font-mono">{data.titleStyle?.letterSpacing ?? 0}px</span>
                    </div>
                    <input type="range" min={0} max={8} step={0.5} value={data.titleStyle?.letterSpacing ?? 0}
                        onChange={(e) => updateGlobal({ titleStyle: { ...data.titleStyle, letterSpacing: Number(e.target.value) } })}
                        className="w-full h-1 accent-indigo-500 bg-slate-200 rounded-full appearance-none cursor-pointer"
                    />

                    {/* 垂直偏移 */}
                    <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-400 uppercase">垂直偏移</span>
                        <span className="text-[8px] font-black text-indigo-600 font-mono">{data.titleStyle?.offsetY ?? 0}px</span>
                    </div>
                    <input type="range" min={-20} max={20} value={data.titleStyle?.offsetY ?? 0}
                        onChange={(e) => updateGlobal({ titleStyle: { ...data.titleStyle, offsetY: Number(e.target.value) } })}
                        className="w-full h-1 accent-indigo-500 bg-slate-200 rounded-full appearance-none cursor-pointer"
                    />

                    {/* 透明度 */}
                    <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black text-slate-400 uppercase">透明度</span>
                        <span className="text-[8px] font-black text-indigo-600 font-mono">{Math.round((data.titleStyle?.opacity ?? 1) * 100)}%</span>
                    </div>
                    <input type="range" min={0} max={100} value={Math.round((data.titleStyle?.opacity ?? 1) * 100)}
                        onChange={(e) => updateGlobal({ titleStyle: { ...data.titleStyle, opacity: Number(e.target.value) / 100 } })}
                        className="w-full h-1 accent-indigo-500 bg-slate-200 rounded-full appearance-none cursor-pointer"
                    />
                </div>

                {/* Bottom */}
                <div className="mt-auto pt-2 border-t border-slate-100">
                    <button onClick={() => setEditingTitle?.(false)} className="w-full py-2.5 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">完成退出</button>
                </div>
            </div>
        );
    }

    // ─── Render Node Editor View ───
    if (selectedNode) {
        return (
            <div className="w-full lg:w-80 bg-white p-3 rounded-[1.5rem] border border-slate-200 shadow-2xl flex flex-col gap-3 overflow-y-auto custom-scrollbar shrink-0 z-20 animate-reveal">
                {/* Back Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setSelectedNodeId(null)}
                        className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-lg hover:border-indigo-200 transition-all active:scale-95 text-[10px]"
                    >
                        <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-tighter italic leading-none">编辑节点 Edit Node</h3>
                        <p className="text-[10px] text-slate-400 font-bold mt-1.5 uppercase tracking-widest">Node Attributes</p>
                    </div>
                    <button
                        onClick={() => {
                            deleteNode(selectedNode.id);
                            setSelectedNodeId(null);
                        }}
                        className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center text-[10px] shadow-sm hover:shadow-rose-300"
                        title="删除此节点"
                    >
                        <i className="fa-solid fa-trash-can"></i>
                    </button>
                </div>

                {/* Node Preview — compact */}
                <div className="px-3 py-2.5 bg-slate-50 rounded-[1.25rem] flex items-center gap-3 border border-slate-100 overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="w-10 h-10 rounded-xl bg-white text-indigo-500 flex items-center justify-center text-sm border border-slate-200 shadow-sm shrink-0 z-10 transition-transform group-hover:scale-110">
                        <i className={selectedNode.icon || 'fa-solid fa-tag'}></i>
                    </div>
                    <div className="flex-1 min-w-0 z-10">
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] block leading-none italic">Active Selection</span>
                        <h4 className="text-[13px] font-black text-slate-800 truncate italic mt-1.5">{selectedNode.label}</h4>
                    </div>
                </div>

                {/* 节点标签 */}
                <div className="space-y-1">
                    <span className="text-[8px] font-black text-slate-400 uppercase ml-0.5">节点标签 Label Name</span>
                    <input
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1 text-[10px] font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all shadow-sm"
                        value={selectedNode.label}
                        onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                    />
                </div>

                {/* 文字与外观 */}
                <div className="space-y-2 p-2.5 bg-slate-50 rounded-[1.25rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none">样式与外观 Styling</label>
                    </div>

                    {/* 格式按钮行 */}
                    <div className="flex gap-1.5">
                        <button
                            onClick={() => updateNode(selectedNode.id, { style: { ...selectedNode.style, fontWeight: selectedNode.style?.fontWeight === 'bold' ? 'normal' : 'bold' } })}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-[10px] ${selectedNode.style?.fontWeight === 'bold' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 shadow-sm'}`}
                        >
                            <i className="fa-solid fa-bold"></i>
                        </button>
                        <button
                            onClick={() => updateNode(selectedNode.id, { style: { ...selectedNode.style, fontStyle: selectedNode.style?.fontStyle === 'italic' ? 'normal' : 'italic' } })}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-[10px] ${selectedNode.style?.fontStyle === 'italic' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 shadow-sm'}`}
                        >
                            <i className="fa-solid fa-italic"></i>
                        </button>
                        <div className="flex-1 h-8 bg-white border border-slate-200 rounded-lg flex items-center px-1 shadow-sm overflow-hidden">
                            {['left', 'center', 'right'].map(align => (
                                <button
                                    key={align}
                                    onClick={() => updateNode(selectedNode.id, { style: { ...selectedNode.style, textAlign: align as any } })}
                                    className={`flex-1 h-7 rounded-lg flex items-center justify-center transition-all ${selectedNode.style?.textAlign === align ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-indigo-400'}`}
                                >
                                    <i className={`fa-solid fa-align-${align} text-[10px]`}></i>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 字体选择 Row */}
                    <select
                        value={selectedNode.style?.fontFamily || 'Inter, sans-serif'}
                        onChange={(e) => updateNode(selectedNode.id, { style: { ...selectedNode.style, fontFamily: e.target.value } })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black text-slate-700 outline-none focus:border-indigo-400 transition-all cursor-pointer shadow-sm"
                        style={{ fontFamily: selectedNode.style?.fontFamily || 'Inter, sans-serif' }}
                    >
                        {[
                            { value: 'Inter, sans-serif', label: 'Inter' },
                            { value: 'Roboto, sans-serif', label: 'Roboto' },
                            { value: 'Outfit, sans-serif', label: 'Outfit' },
                            { value: "'Noto Sans SC', sans-serif", label: 'Noto Sans SC' },
                            { value: "'Noto Serif SC', serif", label: 'Noto Serif SC' },
                            { value: "Georgia, serif", label: 'Georgia' },
                            { value: "'Times New Roman', serif", label: 'Times New Roman' },
                            { value: "system-ui, sans-serif", label: '系统默认' },
                            { value: "'Courier New', monospace", label: 'Courier New' },
                            { value: "'SF Mono', monospace", label: 'SF Mono' },
                            { value: "Menlo, monospace", label: 'Menlo' },
                            { value: "'PingFang SC', sans-serif", label: '苹方' },
                        ].map(f => (
                            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                                {f.label}
                            </option>
                        ))}
                    </select>

                    {/* Word Size + Colors + Icon */}
                    <div className="grid grid-cols-4 gap-2">
                        <div className="space-y-1">
                            <span className="text-[7px] font-black text-slate-400 uppercase ml-0.5">字号</span>
                            <input
                                type="number" min={8} max={72}
                                value={selectedNode.style?.fontSize || 12}
                                onChange={(e) => updateNode(selectedNode.id, { style: { ...selectedNode.style, fontSize: Number(e.target.value) } })}
                                className="w-full bg-white h-7 rounded-lg border border-slate-200 px-1 text-[10px] font-black text-indigo-600 outline-none focus:border-indigo-400 text-center shadow-inner"
                            />
                        </div>
                        <div className="space-y-1 text-center">
                            <span className="text-[7px] font-black text-slate-400 uppercase">文字色</span>
                            <div className="h-7 flex items-center justify-center bg-white rounded-lg border border-slate-200 shadow-sm">
                                <ColorPickerWithPresets
                                    color={selectedNode.style?.color || '#334155'}
                                    documentColors={[]}
                                    onChange={(c) => updateNode(selectedNode.id, { style: { ...selectedNode.style, color: c } })}
                                    size="sm"
                                />
                            </div>
                        </div>
                        <div className="space-y-1 text-center">
                            <span className="text-[7px] font-black text-slate-400 uppercase">节点色</span>
                            <div className="h-7 flex items-center justify-center bg-white rounded-lg border border-slate-200 shadow-sm">
                                <ColorPickerWithPresets
                                    color={selectedNode.color || '#475569'}
                                    documentColors={[]}
                                    onChange={(c) => updateNode(selectedNode.id, { color: c })}
                                    size="sm"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[7px] font-black text-slate-400 uppercase ml-0.5">图标</span>
                            <div className="h-7 flex items-center bg-white rounded-lg border border-slate-200 px-1.5 shadow-sm">
                                <select
                                    className="w-full bg-transparent text-[8px] font-black text-slate-600 outline-none cursor-pointer"
                                    value={selectedNode.icon || 'fa-solid fa-tag'}
                                    onChange={(e) => updateNode(selectedNode.id, { icon: e.target.value })}
                                >
                                    {ICON_OPTIONS.map(icon => (
                                        <option key={icon} value={icon}>{icon.split('fa-').pop()}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => onSyncStyleToAll(selectedNode)}
                        className="w-full py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-[9px] font-black uppercase text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <i className="fa-solid fa-arrows-spin"></i> 同步至全局 Apply to All Nodes
                    </button>
                </div>

                {/* 节点描述 */}
                <div className="space-y-1">
                    <span className="text-[8px] font-black text-slate-400 uppercase ml-0.5">节点简介 Info <span className="text-slate-300 normal-case">(hover Tooltip)</span></span>
                    <textarea
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-medium text-slate-700 outline-none focus:border-indigo-400 transition-all resize-none shadow-sm"
                        rows={1}
                        placeholder="鼠标悬停时显示..."
                        value={selectedNode.description ?? ''}
                        onChange={(e) => updateNode(selectedNode.id, { description: e.target.value })}
                    />
                </div>

                {/* 标签控制 与 连线编辑 */}
                <div className="space-y-2.5 p-3 bg-slate-50 rounded-[1.25rem] border border-slate-100 shadow-sm animate-reveal delay-75">
                    <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest leading-none">高级控制 Advanced</label>
                    </div>

                    <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">隐藏标签 Hide Label</span>
                        <button
                            onClick={() => updateNode(selectedNode.id, { hideLabel: !selectedNode.hideLabel })}
                            className={`w-10 h-6 rounded-full flex items-center transition-all duration-300 ${selectedNode.hideLabel ? 'bg-indigo-600 justify-end' : 'bg-slate-200 justify-start'}`}
                        >
                            <div className="w-4 h-4 rounded-full bg-white shadow-md mx-1 transition-all"></div>
                        </button>
                    </div>

                    <div className="flex items-center justify-between gap-3 p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                        <span className="text-[10px] font-black text-slate-500 uppercase shrink-0 tracking-tight">标签位置 Side</span>
                        <div className="flex gap-1 bg-slate-50 border border-slate-100 rounded-xl p-1 shadow-inner">
                            {([['auto', '自动'], ['left', '左'], ['right', '右']] as const).map(([val, lbl]) => (
                                <button
                                    key={val}
                                    onClick={() => updateNode(selectedNode.id, { labelSide: val })}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${(selectedNode.labelSide ?? 'auto') === val
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'text-slate-400 hover:text-indigo-500'
                                        }`}
                                >
                                    {lbl}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 连线编辑嵌套在高级面板中 */}
                    {data && (() => {
                        const inLinks = data.links.filter(l => l.target === selectedNode.id);
                        const outLinks = data.links.filter(l => l.source === selectedNode.id);
                        const hasLinks = inLinks.length > 0 || outLinks.length > 0;
                        return (
                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase italic">流量关联 Connections</span>
                                    <span className="text-[8px] font-black text-indigo-400">{inLinks.length + outLinks.length} Links</span>
                                </div>

                                {inLinks.length > 0 && (
                                    <div className="space-y-1.5">
                                        <p className="text-[7px] font-black text-emerald-500 uppercase flex items-center gap-1 px-1">↓ 流入 Inflow</p>
                                        {inLinks.map(link => {
                                            const srcNode = data.nodes.find(n => n.id === link.source);
                                            return (
                                                <div key={link.id} className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100 group shadow-sm">
                                                    <span className="text-[10px] font-black text-slate-600 truncate flex-1">{srcNode?.label || '?'}</span>
                                                    <input
                                                        type="number" min={0}
                                                        value={link.value}
                                                        onChange={(e) => updateLink(link.id, { value: Math.max(0, Number(e.target.value)) })}
                                                        className="w-14 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 text-[10px] font-black text-indigo-600 outline-none focus:border-emerald-400 focus:bg-white text-right shadow-inner"
                                                    />
                                                    <button onClick={() => deleteLink(link.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"><i className="fa-solid fa-trash-can text-[9px]"></i></button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {outLinks.length > 0 && (
                                    <div className="space-y-1.5">
                                        <p className="text-[7px] font-black text-blue-500 uppercase flex items-center gap-1 px-1 mt-1">↑ 流出 Outflow</p>
                                        {outLinks.map(link => {
                                            const tgtNode = data.nodes.find(n => n.id === link.target);
                                            return (
                                                <div key={link.id} className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-slate-100 group shadow-sm">
                                                    <span className="text-[10px] font-black text-slate-600 truncate flex-1">{tgtNode?.label || '?'}</span>
                                                    <input
                                                        type="number" min={0}
                                                        value={link.value}
                                                        onChange={(e) => updateLink(link.id, { value: Math.max(0, Number(e.target.value)) })}
                                                        className="w-14 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 text-[10px] font-black text-indigo-600 outline-none focus:border-blue-400 focus:bg-white text-right shadow-inner"
                                                    />
                                                    <button onClick={() => deleteLink(link.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"><i className="fa-solid fa-trash-can text-[9px]"></i></button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>

                {/* Bottom Actions */}
                <div className="mt-auto pt-4">
                    <button onClick={() => setSelectedNodeId(null)} className="w-full py-3 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase hover:bg-indigo-600 shadow-2xl shadow-indigo-100/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <i className="fa-solid fa-check"></i> 完成并退出 EXIT EDITOR
                    </button>
                </div>
            </div>
        );
    }

    // ─── Render Main Dashboard View ───
    return (
        <div className="w-full lg:w-80 bg-white p-2 rounded-xl border border-slate-200 shadow-2xl flex flex-col gap-2 overflow-y-auto custom-scrollbar shrink-0 z-20">

            {/* ─── Header: 标题与撤销重做 ─── */}
            <div className="flex items-center gap-4 px-1">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center text-white shadow-lg shadow-indigo-200 transition-transform hover:scale-105 active:scale-95 cursor-pointer">
                    <i className="fa-solid fa-bars-staggered text-base"></i>
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter italic leading-none">桑基图设计</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                            {data ? "流量排版与属性编辑" : "AI 驱动的流转生成"}
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-2.5">
                {/* Section: AI Generation */}
                <div className={`pt-2 border-l-2 pl-2 rounded-r-xl transition-all duration-300 ${showAi ? 'bg-violet-50/50 border-violet-400 shadow-sm' : 'border-transparent'}`}>
                    <button
                        onClick={() => setShowAi(!showAi)}
                        className="w-full flex items-center justify-between group/title px-1 pb-1.5"
                    >
                        <label className={`text-[13px] font-black group-hover:text-violet-600 uppercase tracking-widest flex items-center gap-2.5 cursor-pointer transition-colors ${showAi ? 'text-violet-600' : 'text-slate-500'}`}>
                            <i className={`fa-solid fa-wand-magic-sparkles transition-colors ${showAi ? 'text-violet-600' : 'text-slate-300'}`}></i> AI 智能生成
                        </label>
                        <i className={`fa-solid fa-chevron-down text-[11px] text-slate-300 transition-transform duration-300 ${showAi ? 'rotate-180 text-violet-400' : ''}`}></i>
                    </button>

                    <div className={`space-y-3 overflow-hidden transition-all duration-500 ease-in-out ${showAi ? 'max-h-[600px] mt-2 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">生成语言</span>
                            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-100 shadow-inner">
                                <button
                                    onClick={() => onAiLanguageChange('zh')}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${aiLanguage === 'zh' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >中文</button>
                                <button
                                    onClick={() => onAiLanguageChange('en')}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${aiLanguage === 'en' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >EN</button>
                            </div>
                        </div>

                        <div className="space-y-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 shadow-sm transition-all hover:bg-white hover:shadow-md">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">图表复杂度 Model Complexity</span>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {([
                                    { value: 'simple' as const, icon: 'fa-solid fa-seedling', label: '简洁', desc: '4-8 节点' },
                                    { value: 'moderate' as const, icon: 'fa-solid fa-diagram-project', label: '标准', desc: '8-14 节点' },
                                    { value: 'complex' as const, icon: 'fa-solid fa-sitemap', label: '深度', desc: '14-24 节点' },
                                ]).map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => onAiComplexityChange(opt.value)}
                                        className={`p-2 rounded-xl flex flex-col items-center gap-0.5 transition-all border ${aiComplexity === opt.value
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 translate-y-[-1px]'
                                            : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200 hover:text-indigo-500'
                                            }`}
                                    >
                                        <i className={`${opt.icon} text-xs mb-0.5`}></i>
                                        <div className="text-[9px] font-black uppercase tracking-tighter">{opt.label}</div>
                                        <div className={`text-[7px] font-bold ${aiComplexity === opt.value ? 'text-indigo-200' : 'text-slate-300'
                                            }`}>{opt.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <textarea
                            className="w-full h-10 bg-slate-50 border border-slate-100 rounded-lg p-2 text-[10px] font-bold outline-none resize-none focus:ring-2 focus:ring-indigo-50/50 focus:border-indigo-200 transition-all text-slate-700 leading-tight placeholder:text-slate-300 shadow-inner"
                            placeholder="描述你想生成的流转关系，如：锂电池回收路径、能源转换流程..."
                            value={userPrompt}
                            onChange={(e) => onUserPromptChange(e.target.value)}
                        />

                        <div className="flex gap-2">
                            <button
                                onClick={onGenerate}
                                disabled={isGenerating || !userPrompt.trim()}
                                className="flex-1 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-600 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isGenerating ? <i className="fa-solid fa-spinner animate-spin text-[10px]"></i> : <i className="fa-solid fa-bolt text-[10px]"></i>}
                                {isGenerating ? "正在生成..." : "立即建模"}
                            </button>
                            {!data && (
                                <button
                                    onClick={onCreateEmpty}
                                    className="px-4 py-2 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-50 hover:border-indigo-200 transition-all shadow-sm active:scale-95"
                                >
                                    <i className="fa-solid fa-plus"></i>
                                </button>
                            )}
                        </div>
                        <div className="flex gap-1.5 mt-[-0.5rem]">
                            <button onClick={() => setShowLibrary(true)} className="flex-1 py-1.5 bg-indigo-50/50 text-indigo-600 border border-indigo-100/50 rounded-lg text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all flex items-center justify-center gap-1.5 active:scale-95">
                                <i className="fa-solid fa-box-archive"></i> 方案库
                            </button>
                            <button onClick={onExportPng} className="flex-1 py-1.5 bg-indigo-50/50 text-indigo-600 border border-indigo-100/50 rounded-lg text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all flex items-center justify-center gap-1.5 active:scale-95">
                                <i className="fa-solid fa-download"></i> 导图
                            </button>
                        </div>
                    </div>
                </div>

                {/* Section: Layout and Style */}
                {data && (
                    <div className={`pt-3 border-l-2 pl-2 rounded-r-xl transition-all duration-300 ${showStyle ? 'bg-sky-50/50 border-sky-400 shadow-sm' : 'border-transparent'}`}>
                        <button
                            onClick={() => setShowStyle(!showStyle)}
                            className="w-full flex items-center justify-between group/title px-1 pb-1.5"
                        >
                            <label className={`text-[13px] font-black group-hover:text-sky-600 uppercase tracking-widest flex items-center gap-2.5 cursor-pointer transition-colors ${showStyle ? 'text-sky-600' : 'text-slate-500'}`}>
                                <i className={`fa-solid fa-palette transition-colors ${showStyle ? 'text-sky-600' : 'text-slate-300'}`}></i> 排版与可视化
                            </label>
                            <i className={`fa-solid fa-chevron-down text-[11px] text-slate-300 transition-transform duration-300 ${showStyle ? 'rotate-180 text-sky-400' : ''}`}></i>
                        </button>

                        <div className={`space-y-4 overflow-hidden transition-all duration-500 ease-in-out ${showStyle ? 'max-h-[1200px] mt-3 opacity-100' : 'max-h-0 opacity-0'}`}>
                            {/* Layout Group */}
                            <div className="space-y-3 p-3.5 bg-slate-50 rounded-[1.5rem] border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-1">
                                    <div className="w-1 h-2.5 bg-indigo-500 rounded-full"></div>
                                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">布局模式与几何</label>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    {LAYOUT_MODE_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => updateGlobal({ layoutMode: opt.value })}
                                            className={`p-2 rounded-xl flex flex-col items-center gap-1 transition-all border ${data.layoutMode === opt.value
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 translate-y-[-1px]'
                                                : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200 hover:text-indigo-500'
                                                }`}
                                        >
                                            <i className={`${opt.icon} text-xs`}></i>
                                            <div className="text-[9px] font-black uppercase tracking-tighter">{opt.label}</div>
                                        </button>
                                    ))}
                                </div>

                                {data.layoutMode !== 'chord' ? (
                                    <>
                                        {/* ── 线性模式专属控件 ── */}
                                        <div className="grid grid-cols-4 gap-1.5 pt-1">
                                            {ALIGN_OPTIONS.map(opt => (
                                                <button
                                                    key={opt.value}
                                                    onClick={() => updateGlobal({ alignment: opt.value })}
                                                    className={`py-2 rounded-xl text-[9px] font-black uppercase flex flex-col items-center gap-1 transition-all border ${data.alignment === opt.value
                                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 translate-y-[-0.5px]'
                                                        : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200 hover:text-indigo-500'
                                                        }`}
                                                >
                                                    <i className={`${opt.icon} text-[10px]`}></i>
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="space-y-1 pt-0.5">
                                            {/* Merged Layout & Appearance controls without nested cards */}
                                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 px-0.5">
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[7.5px] font-black text-slate-400 uppercase">垂直间距</span>
                                                        <span className="text-[7.5px] font-black text-indigo-600 font-mono">{data.nodePadding || 12}</span>
                                                    </div>
                                                    <input
                                                        type="range" min={0} max={60} value={data.nodePadding || 12}
                                                        onChange={(e) => updateGlobal({ nodePadding: Number(e.target.value) })}
                                                        className="w-full h-0.5 accent-indigo-600 bg-slate-100 rounded-full appearance-none cursor-pointer"
                                                    />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[7.5px] font-black text-slate-400 uppercase">节点宽度</span>
                                                        <span className="text-[7.5px] font-black text-indigo-600 font-mono">{data.nodeWidth || 16}</span>
                                                    </div>
                                                    <input
                                                        type="range" min={4} max={40} value={data.nodeWidth || 16}
                                                        onChange={(e) => updateGlobal({ nodeWidth: Number(e.target.value) })}
                                                        className="w-full h-0.5 accent-indigo-600 bg-slate-100 rounded-full appearance-none cursor-pointer"
                                                    />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[7.5px] font-black text-slate-400 uppercase">节点圆角</span>
                                                        <span className="text-[7.5px] font-black text-indigo-600 font-mono">{data.nodeCornerRadius ?? 3}</span>
                                                    </div>
                                                    <input
                                                        type="range" min={0} max={20} value={data.nodeCornerRadius ?? 3}
                                                        onChange={(e) => updateGlobal({ nodeCornerRadius: Number(e.target.value) })}
                                                        className="w-full h-0.5 accent-indigo-600 bg-slate-100 rounded-full appearance-none cursor-pointer"
                                                    />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[7.5px] font-black text-slate-400 uppercase">连线透明</span>
                                                        <span className="text-[7.5px] font-black text-indigo-600 font-mono">{Math.round((data.linkOpacity ?? 0.4) * 100)}%</span>
                                                    </div>
                                                    <input
                                                        type="range" min={5} max={100} value={Math.round((data.linkOpacity ?? 0.4) * 100)}
                                                        onChange={(e) => updateGlobal({ linkOpacity: Number(e.target.value) / 100 })}
                                                        className="w-full h-0.5 accent-indigo-600 bg-slate-100 rounded-full appearance-none cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* ── 环形模式专属控件 ── */}
                                        <div className="space-y-1 pt-0.5">
                                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 px-0.5">
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[7.5px] font-black text-slate-400 uppercase">环形半径</span>
                                                        <span className="text-[7.5px] font-black text-indigo-600 font-mono">{Math.round((data.chordRadius ?? 0.35) * 100)}%</span>
                                                    </div>
                                                    <input
                                                        type="range" min={10} max={50} value={Math.round((data.chordRadius ?? 0.35) * 100)}
                                                        onChange={(e) => updateGlobal({ chordRadius: Number(e.target.value) / 100 })}
                                                        className="w-full h-0.5 accent-indigo-600 bg-slate-100 rounded-full appearance-none cursor-pointer"
                                                    />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[7.5px] font-black text-slate-400 uppercase">弧段宽度</span>
                                                        <span className="text-[7.5px] font-black text-indigo-600 font-mono">{data.chordArcWidth ?? 12}px</span>
                                                    </div>
                                                    <input
                                                        type="range" min={4} max={36} value={data.chordArcWidth ?? 12}
                                                        onChange={(e) => updateGlobal({ chordArcWidth: Number(e.target.value) })}
                                                        className="w-full h-0.5 accent-indigo-600 bg-slate-100 rounded-full appearance-none cursor-pointer"
                                                    />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[7.5px] font-black text-slate-400 uppercase">流量距离</span>
                                                        <span className="text-[7.5px] font-black text-indigo-600 font-mono">{data.chordInnerOffset ?? Math.round((data.chordArcWidth ?? 12) / 2)}px</span>
                                                    </div>
                                                    <input
                                                        type="range" min={0} max={40} value={data.chordInnerOffset ?? Math.round((data.chordArcWidth ?? 12) / 2)}
                                                        onChange={(e) => updateGlobal({ chordInnerOffset: Number(e.target.value) })}
                                                        className="w-full h-0.5 accent-indigo-600 bg-slate-100 rounded-full appearance-none cursor-pointer"
                                                    />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[7.5px] font-black text-slate-400 uppercase">节点间隙</span>
                                                        <span className="text-[7.5px] font-black text-indigo-600 font-mono">{Math.round((data.chordGapRatio ?? 0.1) * 100)}%</span>
                                                    </div>
                                                    <input
                                                        type="range" min={0} max={30} value={Math.round((data.chordGapRatio ?? 0.1) * 100)}
                                                        onChange={(e) => updateGlobal({ chordGapRatio: Number(e.target.value) / 100 })}
                                                        className="w-full h-0.5 accent-indigo-600 bg-slate-100 rounded-full appearance-none cursor-pointer"
                                                    />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[7.5px] font-black text-slate-400 uppercase">起始角度</span>
                                                        <span className="text-[7.5px] font-black text-indigo-600 font-mono">{data.chordStartAngle ?? 0}°</span>
                                                    </div>
                                                    <input
                                                        type="range" min={0} max={360} value={data.chordStartAngle ?? 0}
                                                        onChange={(e) => updateGlobal({ chordStartAngle: Number(e.target.value) })}
                                                        className="w-full h-0.5 accent-indigo-600 bg-slate-100 rounded-full appearance-none cursor-pointer"
                                                    />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[7.5px] font-black text-slate-400 uppercase">连线透明</span>
                                                        <span className="text-[7.5px] font-black text-indigo-600 font-mono">{Math.round((data.chordLinkOpacity ?? 0.25) * 100)}%</span>
                                                    </div>
                                                    <input
                                                        type="range" min={5} max={80} value={Math.round((data.chordLinkOpacity ?? 0.25) * 100)}
                                                        onChange={(e) => updateGlobal({ chordLinkOpacity: Number(e.target.value) / 100 })}
                                                        className="w-full h-0.5 accent-indigo-600 bg-slate-100 rounded-full appearance-none cursor-pointer"
                                                    />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[7.5px] font-black text-slate-400 uppercase">标签偏移</span>
                                                        <span className="text-[7.5px] font-black text-indigo-600 font-mono">{data.chordLabelOffset ?? 25}px</span>
                                                    </div>
                                                    <input
                                                        type="range" min={10} max={60} value={data.chordLabelOffset ?? 25}
                                                        onChange={(e) => updateGlobal({ chordLabelOffset: Number(e.target.value) })}
                                                        className="w-full h-0.5 accent-indigo-600 bg-slate-100 rounded-full appearance-none cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Curve Group — 仅线性模式显示 */}
                            {data.layoutMode !== 'chord' && (
                                <div className="space-y-4 p-4 bg-slate-50 rounded-[1.75rem] border border-slate-100 shadow-sm transition-all hover:bg-white hover:shadow-md">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
                                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">流体形态 Curve Geometry</label>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3">
                                        {CURVE_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => updateGlobal({ curveType: opt.value })}
                                                className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all border ${data.curveType === opt.value
                                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100 translate-y-[-2px]'
                                                    : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200 hover:text-indigo-500'
                                                    }`}
                                            >
                                                <i className={`${opt.icon} text-sm`}></i>
                                                <div className="text-[10px] font-black uppercase tracking-tighter">{opt.label}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Sub-card: Display & Annotation */}
                            <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-1 mb-0.5">
                                    <div className="w-1 h-2.5 bg-indigo-500 rounded-full"></div>
                                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">显示与标注 Display</label>
                                </div>

                                {/* Flow Values */}
                                <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[8px] font-black text-slate-500 uppercase flex items-center gap-1">
                                            <i className="fa-solid fa-hashtag text-indigo-400"></i> 流数值 Flow Values
                                        </span>
                                        <button
                                            onClick={() => updateGlobal({ showValues: !(data.showValues ?? true) })}
                                            className={`w-6 h-3.5 rounded-full flex items-center transition-all duration-300 ${(data.showValues ?? true) ? 'bg-indigo-600 justify-end' : 'bg-slate-200 justify-start'}`}
                                        >
                                            <div className="w-2.5 h-2.5 rounded-full bg-white shadow-md mx-0.5"></div>
                                        </button>
                                    </div>

                                    {(data.showValues ?? true) && (
                                        <div className="space-y-1.5 animate-reveal">
                                            <div className="grid grid-cols-2 gap-2">
                                                <input
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-1.5 py-1 text-[9px] font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner"
                                                    placeholder="单位 Unit"
                                                    value={data.valueUnit ?? ''}
                                                    onChange={(e) => updateGlobal({ valueUnit: e.target.value })}
                                                />
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase">Size</span>
                                                    <input type="range" min={7} max={18} value={data.valueStyle?.fontSize ?? 10}
                                                        onChange={(e) => updateGlobal({ valueStyle: { ...data.valueStyle, fontSize: Number(e.target.value) } })}
                                                        className="flex-1 h-0.5 accent-indigo-600 bg-slate-100 rounded-full appearance-none cursor-pointer"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={data.valueStyle?.fontFamily || 'Inter, sans-serif'}
                                                    onChange={(e) => updateGlobal({ valueStyle: { ...data.valueStyle, fontFamily: e.target.value } })}
                                                    className="flex-1 bg-white border border-slate-200 rounded-md px-1 py-0.5 text-[8px] font-bold text-slate-700 outline-none focus:border-indigo-400 cursor-pointer appearance-none"
                                                >
                                                    {[
                                                        { value: 'Inter, sans-serif', label: 'Inter' },
                                                        { value: 'Roboto, sans-serif', label: 'Roboto' },
                                                        { value: "'Noto Sans SC', sans-serif", label: 'Noto SC' },
                                                        { value: "system-ui, sans-serif", label: 'System' },
                                                        { value: "'SF Mono', monospace", label: 'SF Mono' },
                                                    ].map(f => (
                                                        <option key={f.value} value={f.value}>{f.label}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => updateGlobal({ valueStyle: { ...data.valueStyle, fontWeight: data.valueStyle?.fontWeight === '700' ? '400' : '700' } })}
                                                    className={`w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-black transition-all border ${data.valueStyle?.fontWeight === '700' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'}`}
                                                >B</button>
                                                <div
                                                    className="w-5 h-5 rounded-md border border-slate-200 cursor-pointer shadow-sm shrink-0"
                                                    style={{ backgroundColor: data.valueStyle?.color || '#94a3b8' }}
                                                    onClick={() => {
                                                        const inp = document.createElement('input');
                                                        inp.type = 'color';
                                                        inp.value = data.valueStyle?.color || '#94a3b8';
                                                        inp.onchange = (e) => updateGlobal({ valueStyle: { ...data.valueStyle, color: (e.target as HTMLInputElement).value } });
                                                        inp.click();
                                                    }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Label Styling */}
                                <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm flex items-center justify-between">
                                    <span className="text-[8px] font-black text-slate-500 uppercase flex items-center gap-1.5">
                                        <i className="fa-solid fa-font text-indigo-400"></i> 标签属性 Label
                                    </span>
                                    <div className="flex items-center gap-2 flex-1 max-w-[120px] ml-4">
                                        <input
                                            type="range" min={8} max={20} value={data.labelStyle?.fontSize ?? 12}
                                            onChange={(e) => updateGlobal({ labelStyle: { ...data.labelStyle, fontSize: Number(e.target.value) } })}
                                            className="flex-1 h-0.5 accent-indigo-600 bg-slate-100 rounded-full appearance-none cursor-pointer"
                                        />
                                        <span className="text-[8px] font-black text-indigo-600 font-mono w-6 text-right">{data.labelStyle?.fontSize ?? 12}</span>
                                    </div>
                                </div>

                                {/* Canvas Background */}
                                <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm flex items-center justify-between gap-1.5">
                                    <span className="text-[8px] font-black text-slate-500 uppercase flex items-center gap-1.5">
                                        <i className="fa-solid fa-fill-drip text-indigo-400"></i> 画布背景 BG
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-5 h-5 rounded-md border border-slate-200 shadow-sm cursor-pointer"
                                            style={{ backgroundColor: data.backgroundColor ?? '#ffffff' }}
                                            onClick={() => {
                                                const input = document.createElement('input');
                                                input.type = 'color';
                                                input.value = data.backgroundColor ?? '#ffffff';
                                                input.onchange = (e) => updateGlobal({ backgroundColor: (e.target as HTMLInputElement).value });
                                                input.click();
                                            }}
                                        ></div>
                                        {data.backgroundColor && data.backgroundColor !== '#ffffff' && (
                                            <button
                                                onClick={() => updateGlobal({ backgroundColor: '#ffffff' })}
                                                className="text-[10px] text-slate-300 hover:text-rose-500 transition-all"
                                                title="Reset"
                                            >
                                                <i className="fa-solid fa-rotate-left"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Academic Palettes */}
                            <div className="space-y-3 px-0.5">
                                <div className="flex items-center justify-between mb-0.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic flex items-center gap-1.5">
                                        <div className="w-1 h-2.5 bg-emerald-500 rounded-full"></div>
                                        学术配色 Palettes
                                    </label>
                                    <button className="text-[8px] font-black text-indigo-600 hover:text-indigo-700 uppercase bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100" onClick={() => {
                                        const p = ACADEMIC_PALETTES[Math.floor(Math.random() * ACADEMIC_PALETTES.length)];
                                        applyPalette(p.colors);
                                    }}>随机 Random</button>
                                </div>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                    {ACADEMIC_PALETTES.map(p => (
                                        <button
                                            key={p.name}
                                            onClick={() => applyPalette(p.colors)}
                                            className="w-full flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100 hover:border-indigo-400 transition-all text-left hover:scale-[1.01] active:scale-99"
                                        >
                                            <span className="text-[10px] font-black text-slate-600 font-serif italic">{p.name}</span>
                                            <div className="flex gap-0.5">
                                                {p.colors.slice(0, 5).map((c, i) => (
                                                    <div key={i} className="w-3 h-3 rounded-full border border-black/5" style={{ backgroundColor: c }}></div>
                                                ))}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Section: Topology Management */}
                {data && (
                    <div className={`pt-2 border-l-2 pl-2 rounded-r-xl transition-all duration-300 ${showTopo ? 'bg-emerald-50/50 border-emerald-400 shadow-sm' : 'border-transparent'}`}>
                        <button
                            onClick={() => setShowTopo(!showTopo)}
                            className="w-full flex items-center justify-between group/title px-1 pb-1.5"
                        >
                            <label className={`text-[13px] font-black group-hover:text-emerald-600 uppercase tracking-widest flex items-center gap-2.5 cursor-pointer transition-colors ${showTopo ? 'text-emerald-600' : 'text-slate-500'}`}>
                                <i className={`fa-solid fa-sitemap transition-colors ${showTopo ? 'text-emerald-600' : 'text-slate-300'}`}></i> 拓扑架构管理
                            </label>
                            <i className={`fa-solid fa-chevron-down text-[11px] text-slate-300 transition-transform duration-300 ${showTopo ? 'rotate-180 text-emerald-400' : ''}`}></i>
                        </button>

                        <div className={`space-y-3 overflow-hidden transition-all duration-300 ${showTopo ? 'max-h-[2000px] mt-2 opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="flex justify-between items-center mb-0.5 px-1">
                                <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest">
                                    <i className="fa-solid fa-cubes-stacked mr-1"></i>
                                    {data.nodes.length} N · {data.links.length} L
                                </span>
                                <button
                                    onClick={addNode}
                                    className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-md text-[9px] font-black hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
                                >+ 节点</button>
                            </div>

                            <div className="space-y-4">
                                {topoColumns.map((col, cIdx) => {
                                    const colColor = data.colorPalette?.[cIdx % (data.colorPalette?.length || 1)] || '#6366f1';
                                    return (
                                        <div
                                            key={col.column}
                                            className="p-2 bg-slate-50/50 rounded-xl border border-slate-100 shadow-sm"
                                        >
                                            {/* Column Header */}
                                            <div className="flex items-center justify-between mb-1.5 px-0.5 gap-1.5 border-b border-indigo-100/30 pb-1">
                                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                    <div className="w-2.5 h-2.5 rounded shrink-0 shadow-sm ring-1 ring-white" style={{ backgroundColor: colColor }} />
                                                    <p className="text-[10px] font-black uppercase tracking-tighter truncate" style={{ color: colColor }}>
                                                        Col {col.column + 1} · {col.nodeIds.length} Nodes
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Nodes in this column */}
                                            <div className="space-y-1.5">
                                                {col.nodeIds.map((nodeId, nIdx) => {
                                                    const node = data.nodes.find(n => n.id === nodeId);
                                                    if (!node) return null;
                                                    const nodeColor = node.color || colColor;
                                                    const nodeLinks = linksByNode.get(nodeId);
                                                    const outCount = nodeLinks?.out.length || 0;
                                                    const inCount = nodeLinks?.in.length || 0;
                                                    return (
                                                        <div
                                                            key={nodeId}
                                                            className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-transparent shadow-sm hover:border-indigo-200 hover:shadow-md cursor-pointer group/node transition-all active:scale-[0.99]"
                                                            onClick={() => setSelectedNodeId(nodeId)}
                                                        >
                                                            {/* Sort arrows on hover */}
                                                            <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover/node:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                                <button
                                                                    onClick={() => {
                                                                        const newNodes = [...data.nodes];
                                                                        const idx = newNodes.findIndex(n => n.id === nodeId);
                                                                        const prevNodeId = col.nodeIds[nIdx - 1];
                                                                        const prevIdx = newNodes.findIndex(n => n.id === prevNodeId);
                                                                        if (idx >= 0 && prevIdx >= 0) {
                                                                            [newNodes[idx], newNodes[prevIdx]] = [newNodes[prevIdx], newNodes[idx]];
                                                                            updateGlobal({ nodes: newNodes });
                                                                        }
                                                                    }}
                                                                    disabled={nIdx === 0}
                                                                    className="w-5 h-5 flex items-center justify-center rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors disabled:opacity-10"
                                                                >
                                                                    <i className="fa-solid fa-chevron-up text-[7px]"></i>
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        const newNodes = [...data.nodes];
                                                                        const idx = newNodes.findIndex(n => n.id === nodeId);
                                                                        const nextNodeId = col.nodeIds[nIdx + 1];
                                                                        const nextIdx = newNodes.findIndex(n => n.id === nextNodeId);
                                                                        if (idx >= 0 && nextIdx >= 0) {
                                                                            [newNodes[idx], newNodes[nextIdx]] = [newNodes[nextIdx], newNodes[idx]];
                                                                            updateGlobal({ nodes: newNodes });
                                                                        }
                                                                    }}
                                                                    disabled={nIdx === col.nodeIds.length - 1}
                                                                    className="w-5 h-5 flex items-center justify-center rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors disabled:opacity-10"
                                                                >
                                                                    <i className="fa-solid fa-chevron-down text-[7px]"></i>
                                                                </button>
                                                            </div>

                                                            <div className="w-1.5 h-1.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: nodeColor }} />
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-[10px] font-black text-slate-700 truncate block leading-none">{node.label}</span>
                                                                <div className="flex gap-2 mt-1">
                                                                    {inCount > 0 && <span className="bg-emerald-50 text-emerald-600 px-1.5 rounded-md text-[7px] font-black border border-emerald-100/50 flex items-center gap-0.5"><i className="fa-solid fa-arrow-down scale-75"></i>{inCount}</span>}
                                                                    {outCount > 0 && <span className="bg-blue-50 text-blue-600 px-1.5 rounded-md text-[7px] font-black border border-blue-100/50 flex items-center gap-0.5"><i className="fa-solid fa-arrow-up scale-75"></i>{outCount}</span>}
                                                                </div>
                                                            </div>
                                                            <i className="fa-solid fa-pen-nib text-[10px] text-slate-200 group-hover/node:text-indigo-400 transition-colors"></i>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Link Management Area */}
                            <div className="space-y-3 pt-2 mt-1">
                                <div className="flex items-center gap-1 px-1">
                                    <div className="w-1 h-2.5 bg-indigo-500 rounded-full"></div>
                                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">流量连线控制</label>
                                </div>

                                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 shadow-sm space-y-1.5">
                                    <div className="flex flex-col gap-1.5">
                                        <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-1.5">
                                            <div className="relative">
                                                <select
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[9px] font-bold text-slate-700 outline-none focus:border-indigo-400 shadow-sm appearance-none cursor-pointer"
                                                    value={addLinkSource || ''}
                                                    onChange={(e) => setAddLinkSource(e.target.value || null)}
                                                >
                                                    <option value="">源...</option>
                                                    {data.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                                                </select>
                                                <i className="fa-solid fa-chevron-down absolute right-1.5 top-1/2 -translate-y-1/2 text-[7px] text-slate-300 pointer-events-none"></i>
                                            </div>
                                            <i className="fa-solid fa-arrow-right text-indigo-400 text-[9px]"></i>
                                            <div className="relative">
                                                <select
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-[9px] font-bold text-slate-700 outline-none focus:border-indigo-400 shadow-sm appearance-none cursor-pointer"
                                                    id="sankey-link-target"
                                                    defaultValue=""
                                                >
                                                    <option value="">目...</option>
                                                    {data.nodes.filter(n => n.id !== addLinkSource).map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                                                </select>
                                                <i className="fa-solid fa-chevron-down absolute right-1.5 top-1/2 -translate-y-1/2 text-[7px] text-slate-300 pointer-events-none"></i>
                                            </div>
                                        </div>
                                        <div className="flex gap-1.5">
                                            <div className="flex-1 bg-white rounded-lg border border-slate-200 px-2 h-7 flex items-center justify-between shadow-sm">
                                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">数值</span>
                                                <input
                                                    type="number" min={1}
                                                    value={addLinkValue}
                                                    onChange={(e) => setAddLinkValue(Math.max(1, Number(e.target.value)))}
                                                    className="w-8 bg-transparent text-right text-[9px] font-black text-indigo-600 outline-none"
                                                />
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const target = (document.getElementById('sankey-link-target') as HTMLSelectElement)?.value;
                                                    if (addLinkSource && target) {
                                                        addLink(addLinkSource, target, addLinkValue);
                                                        setAddLinkSource(null);
                                                    }
                                                }}
                                                className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[9px] font-black hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                                            >添加</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Link List */}
                                <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar px-1">
                                    {data.links.map(link => {
                                        const src = data.nodes.find(n => n.id === link.source);
                                        const tgt = data.nodes.find(n => n.id === link.target);
                                        return (
                                            <div key={link.id} className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-100 hover:border-indigo-200 transition-all group/link shadow-sm">
                                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-slate-700 truncate">{src?.label}</span>
                                                    <i className="fa-solid fa-arrow-right-long text-[8px] text-slate-300"></i>
                                                    <span className="text-[10px] font-black text-slate-700 truncate">{tgt?.label}</span>
                                                </div>
                                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{link.value}</span>
                                                <button
                                                    onClick={() => deleteLink(link.id)}
                                                    className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover/link:opacity-100"
                                                >
                                                    <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Actions */}
            {data && (
                <div className="mt-auto pt-2 border-t border-slate-100 flex gap-1.5">
                    <button
                        onClick={onUndo}
                        disabled={!canUndo}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center justify-center disabled:opacity-30 active:scale-95 shadow-sm"
                        title="撤销 (Ctrl+Z)"
                    >
                        <i className="fa-solid fa-rotate-left text-xs"></i>
                    </button>
                    <button
                        onClick={onSaveToLibrary}
                        className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] transition-all flex items-center justify-center gap-1.5 active:scale-95"
                    >
                        <i className="fa-solid fa-floppy-disk"></i>
                        保存
                    </button>
                    <button
                        onClick={onRedo}
                        disabled={!canRedo}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center justify-center disabled:opacity-30 active:scale-95 shadow-sm"
                        title="重做 (Ctrl+Y)"
                    >
                        <i className="fa-solid fa-rotate-right text-xs"></i>
                    </button>
                </div>
            )}

            {/* Library Modal */}
            <SchemeLibraryModal
                show={showLibrary}
                onClose={() => setShowLibrary(false)}
                items={savedSankeys}
                onLoad={onLoadSaved}
                onDelete={onDeleteSaved}
                onRename={onRenameSaved}
                onCategoryChange={onCategoryChange}
                moduleIcon="fa-bars-staggered"
                moduleLabel="桑基图"
            />

            {/* Save Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[999] flex items-center justify-center p-6 animate-fade-in" onClick={() => setShowSaveModal(false)}>
                    <div className="bg-white w-[450px] rounded-[3rem] shadow-2xl p-10 animate-scale-up" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 shadow-sm">
                            <i className="fa-solid fa-floppy-disk text-2xl"></i>
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2 italic uppercase tracking-tighter">保存方案</h3>
                        <p className="text-[11px] font-bold text-slate-400 mb-8 leading-relaxed uppercase tracking-widest">Archive current model to cloud library</p>

                        <div className="space-y-3 mb-10">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">命名您的学术方案 Scheme Title</label>
                            <input
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 text-base text-slate-800 font-black outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner placeholder:text-slate-200"
                                value={saveTitle}
                                onChange={(e) => setSaveTitle(e.target.value)}
                                placeholder="例如：锂电池衰减机制模型..."
                                autoFocus
                            />
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-4.5 rounded-2xl border border-slate-100 text-[11px] font-black text-slate-400 hover:bg-slate-50 uppercase transition-all tracking-widest active:scale-95">取消</button>
                            <button
                                onClick={() => onConfirmSave()}
                                disabled={!saveTitle.trim()}
                                className="flex-1 py-4.5 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] transition-all disabled:opacity-50 tracking-widest active:scale-95"
                            >
                                确认保存 Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SankeySidebar;
