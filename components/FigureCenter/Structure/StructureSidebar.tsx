import React from 'react';
import { DiagramTemplate, DiagramNode, DiagramGroup, Connection } from './types';
import { ScientificTheme } from '../../../ScientificThemes';
import { ACADEMIC_PALETTES } from './constants';
import { NodeEditor, GroupEditor, ConnectionEditor } from './Sub/PropertyEditors';

interface StructureSidebarProps {
    template: DiagramTemplate;
    onTemplateChange: (tpl: DiagramTemplate) => void;
    userPrompt: string;
    onUserPromptChange: (val: string) => void;
    isGenerating: boolean;
    onAiGenerate: () => void;
    isIterationMode: boolean;
    setIsIterationMode: (val: boolean) => void;
    aiLanguage: 'zh' | 'en';
    onAiLanguageChange: (val: 'zh' | 'en') => void;
    onAddGroup: () => void;
    onAddNode: (targetGroupId?: string) => void;
    isConnectMode: boolean;
    setIsConnectMode: (val: boolean) => void;
    connectSourceId: string | null;
    setConnectSourceId: (val: string | null) => void;
    onAutoLayout: () => void;
    onExportPng: () => void;
    onExportSvg: () => void;
    activeTheme: ScientificTheme;
    onThemeChange: (theme: ScientificTheme) => void;
    onApplyGlobalPalette: (colors: string[]) => void;

    // Selection & Editing Props
    editingId: string | null;
    setEditingId: (id: string | null) => void;
    editingGroupId: string | null;
    setEditingGroupId: (id: string | null) => void;
    editingConnectionIndex: number | null;
    setEditingConnectionIndex: (idx: number | null) => void;
    data: { groups: DiagramGroup[], connections: Connection[] };
    onNodeUpdate: (id: string, updates: Partial<DiagramNode>) => void;
    onNodeDelete: (id: string) => void;
    onGroupUpdate: (id: string, updates: Partial<DiagramGroup>) => void;
    onGroupDelete: (id: string) => void;
    onConnectionUpdate: (idx: number, updates: Partial<Connection>) => void;
    onConnectionDelete: (idx: number) => void;
    onSyncNodeToGroup: (sourceNode: DiagramNode) => void;
    onSyncTypographyGlobal: (sourceNode: DiagramNode) => void;
    onSyncGroupConfig: (sourceGroup: DiagramGroup) => void;
    editingGroupConfigId?: string | null;
    setEditingGroupConfigId?: (id: string | null) => void;
    onMoveNode: (groupId: string, nodeId: string, direction: 'up' | 'down') => void;
    onMoveGroup: (groupId: string, direction: 'up' | 'down') => void;
    spacingConfig: { nodeGap: number; groupPaddingX: number };
    onSpacingChange: (key: 'nodeGap' | 'groupPaddingX', value: number) => void;
    onSmartLabelLayout?: () => void;
}

export const StructureSidebar: React.FC<StructureSidebarProps> = ({
    template, onTemplateChange,
    userPrompt, onUserPromptChange, isGenerating, onAiGenerate,
    isIterationMode, setIsIterationMode,
    aiLanguage, onAiLanguageChange,
    onAddGroup, onAddNode, isConnectMode, setIsConnectMode, connectSourceId, setConnectSourceId,
    onAutoLayout,
    onExportPng, onExportSvg, activeTheme, onThemeChange,
    onApplyGlobalPalette,

    editingId, setEditingId,
    editingGroupId, setEditingGroupId,
    editingConnectionIndex, setEditingConnectionIndex,
    editingGroupConfigId, setEditingGroupConfigId,
    data,
    onNodeUpdate, onNodeDelete,
    onGroupUpdate, onGroupDelete,
    onConnectionUpdate, onConnectionDelete,
    onSyncNodeToGroup, onSyncTypographyGlobal, onSyncGroupConfig,
    onMoveNode, onMoveGroup,
    spacingConfig, onSpacingChange,
    onSmartLabelLayout
}) => {
    const [showPalettes, setShowPalettes] = React.useState(false);
    const [showUtility, setShowUtility] = React.useState(false);
    const [showAi, setShowAi] = React.useState(false);

    const documentColors = React.useMemo(() => {
        const colors = new Set<string>();
        data.groups.forEach(g => {
            if (g.colorTheme?.startsWith('#')) colors.add(g.colorTheme.toLowerCase());
            g.nodes.forEach(n => {
                if (n.customColor?.startsWith('#')) {
                    colors.add(n.customColor.toLowerCase());
                }
            });
        });
        return Array.from(colors);
    }, [data]);

    const editingNode = React.useMemo(() => {
        if (!editingId) return null;
        for (const g of data.groups) {
            const n = g.nodes.find(node => node.id === editingId);
            if (n) return n;
        }
        return null;
    }, [editingId, data]);

    const editingGroup = React.useMemo(() => {
        if (!editingGroupId) return null;
        return data.groups.find(g => g.id === editingGroupId) || null;
    }, [editingGroupId, data]);

    const editingConnection = React.useMemo(() => {
        if (editingConnectionIndex === null) return null;
        return data.connections[editingConnectionIndex] || null;
    }, [editingConnectionIndex, data]);

    if (editingNode) {
        return (
            <div className="w-full lg:w-80 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col gap-6 overflow-y-auto custom-scrollbar shrink-0 z-20">
                <NodeEditor
                    node={editingNode}
                    connections={data.connections}
                    onUpdate={(updates) => onNodeUpdate(editingNode.id, updates)}
                    onSyncToGroup={() => onSyncNodeToGroup(editingNode)}
                    onSyncTypographyGlobal={() => onSyncTypographyGlobal(editingNode)}
                    onDelete={() => onNodeDelete(editingNode.id)}
                    onBack={() => setEditingId(null)}
                    onConnectionUpdate={onConnectionUpdate}
                    onDeleteConnection={onConnectionDelete}
                    documentColors={documentColors}
                />
            </div>
        );
    }

    if (editingGroupConfigId) {
        const group = data.groups.find(g => g.id === editingGroupConfigId);
        if (group) {
            return (
                <div className="w-full lg:w-80 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xl flex flex-col gap-6 overflow-y-auto custom-scrollbar shrink-0 z-20">
                    <GroupEditor
                        group={group}
                        onUpdate={(updates) => onGroupUpdate(group.id, updates)}
                        onDelete={() => { onGroupDelete(group.id); setEditingGroupConfigId?.(null); }}
                        onBack={() => setEditingGroupConfigId?.(null)}
                        onSync={() => onSyncGroupConfig(group)}
                        documentColors={documentColors}
                    />
                </div>
            );
        }
    }

    if (editingGroup) {
        return (
            <div className="w-full lg:w-80 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col gap-6 overflow-y-auto custom-scrollbar shrink-0 z-20">
                <GroupEditor
                    group={editingGroup}
                    onUpdate={(updates) => onGroupUpdate(editingGroup.id, updates)}
                    onDelete={() => onGroupDelete(editingGroup.id)}
                    onBack={() => setEditingGroupId(null)}
                    onSync={() => onSyncGroupConfig(editingGroup)}
                    documentColors={documentColors}
                />
            </div>
        );
    }

    if (editingConnection) {
        return (
            <div className="w-full lg:w-80 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col gap-6 overflow-y-auto custom-scrollbar shrink-0 z-20">
                <ConnectionEditor
                    connection={editingConnection}
                    onUpdate={(updates) => onConnectionUpdate(editingConnectionIndex!, updates)}
                    onDelete={() => onConnectionDelete(editingConnectionIndex!)}
                    onBack={() => setEditingConnectionIndex(null)}
                    documentColors={documentColors}
                />
            </div>
        );
    }

    return (
        <div className="w-full lg:w-80 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col gap-6 overflow-y-auto custom-scrollbar shrink-0 z-20" >
            <div className="flex items-center gap-4 mb-2 px-1">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md"><i className="fa-solid fa-compass-drafting text-xl"></i></div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic leading-none">结构化制图</h3>
            </div>

            {/* Global Academic Palettes (Collapsible) */}
            <div className="pt-4 border-t border-slate-100" >
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setShowPalettes(!showPalettes)}
                        className="flex-1 flex items-center justify-between group/title transition-colors py-1"
                    >
                        <label className="text-[11px] font-black text-slate-400 group-hover:text-indigo-600 uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-colors">
                            <i className={`fa-solid fa-palette ${showPalettes ? 'text-indigo-600' : 'text-slate-300'}`}></i> 全局学术配色
                        </label>
                        <i className={`fa-solid fa-chevron-down text-[10px] text-slate-300 transition-transform duration-300 ${showPalettes ? 'rotate-180 text-indigo-400' : ''}`}></i>
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const generateAcademicPalette = (): string[] => {
                                const VIVID_ANCHORS: [number, number, number][] = [
                                    [0, 72, 48], [12, 78, 52], [25, 82, 55], [38, 70, 62], [48, 62, 65],
                                    [85, 55, 48], [145, 60, 42], [165, 65, 42], [180, 62, 45], [200, 70, 52],
                                    [215, 75, 55], [230, 65, 48], [255, 55, 48], [270, 58, 48], [285, 55, 42],
                                    [310, 55, 48], [325, 62, 50], [345, 68, 45], [190, 58, 40], [155, 55, 38],
                                    [18, 72, 48], [55, 55, 52], [240, 50, 42], [355, 70, 46],
                                ];
                                const hslToHex = (h: number, s: number, l: number): string => {
                                    s /= 100; l /= 100;
                                    const a = s * Math.min(l, 1 - l);
                                    const f = (n: number) => {
                                        const k = (n + h / 30) % 12;
                                        const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
                                        return Math.max(0, Math.min(255, Math.round(255 * c))).toString(16).padStart(2, '0');
                                    };
                                    return `#${f(0)}${f(8)}${f(4)}`;
                                };
                                const shuffled = [...VIVID_ANCHORS];
                                for (let i = shuffled.length - 1; i > 0; i--) {
                                    const j = Math.floor(Math.random() * (i + 1));
                                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                                }
                                return shuffled.slice(0, 5).map(([h, s, l]) => {
                                    const jH = (h + Math.round((Math.random() - 0.5) * 16) + 360) % 360;
                                    const jS = Math.min(88, Math.max(45, s + Math.round((Math.random() - 0.5) * 10)));
                                    const jL = Math.min(68, Math.max(38, l + Math.round((Math.random() - 0.5) * 10)));
                                    return hslToHex(jH, jS, jL);
                                });
                            };
                            onApplyGlobalPalette(generateAcademicPalette());
                        }}
                        className="ml-3 px-2 py-1 rounded bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95 flex items-center gap-1 border border-indigo-100"
                        title="生成随机学术配色方案"
                    >
                        <i className="fa-solid fa-dice"></i>
                        随机
                    </button>
                </div>

                <div className={`space-y-2 overflow-hidden transition-all duration-300 ${showPalettes ? 'max-h-[500px] mt-3 opacity-100' : 'max-h-0 opacity-0'}`}>
                    {ACADEMIC_PALETTES.map((p, i) => (
                        <button
                            key={i}
                            onClick={() => onApplyGlobalPalette(p.colors)}
                            className="w-full group/palette bg-slate-50 hover:bg-white border border-slate-100 hover:border-indigo-200 rounded-xl p-2.5 transition-all text-left flex flex-col gap-1.5 shadow-sm hover:shadow-md"
                        >
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-extrabold text-slate-700 group-hover/palette:text-indigo-600 transition-colors uppercase tracking-tight">{p.name}</span>
                                <div className="flex -space-x-1.5">
                                    {p.colors.map((c, ci) => (
                                        <div key={ci} className="w-4 h-4 rounded-full border border-white shadow-sm ring-1 ring-black/5" style={{ backgroundColor: c }}></div>
                                    ))}
                                </div>
                            </div>
                            <p className="text-[8px] text-slate-400 font-medium leading-normal lowercase">{p.desc}</p>
                        </button>
                    ))}
                </div>
            </div >

            {/* AI & Templates Section (Combined Collapsible) */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
                <button
                    onClick={() => setShowAi(!showAi)}
                    className="w-full flex items-center justify-between group/title transition-colors"
                >
                    <label className="text-[11px] font-black text-slate-400 group-hover:text-indigo-600 uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-colors">
                        <i className={`fa-solid fa-wand-magic-sparkles ${showAi ? 'text-indigo-600' : 'text-slate-300'}`}></i> AI 智能与模板 (AI & TPL)
                    </label>
                    <i className={`fa-solid fa-chevron-down text-[10px] text-slate-300 transition-transform duration-300 ${showAi ? 'rotate-180 text-indigo-400' : ''}`}></i>
                </button>

                <div className={`space-y-6 overflow-hidden transition-all duration-300 ${showAi ? 'max-h-[800px] mt-2 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="space-y-3">
                        <label className="text-[11px] font-black text-slate-400 uppercase">布局模板</label>
                        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                            <button
                                onClick={() => onTemplateChange('omics')}
                                className={`flex-1 py-2.5 px-2 rounded-lg text-[10px] font-black uppercase transition-all flex flex-col items-center justify-center gap-0.5 ${template === 'omics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <span>Omics</span>
                            </button>
                            <button
                                onClick={() => onTemplateChange('framework')}
                                className={`flex-1 py-2.5 px-2 rounded-lg text-[10px] font-black uppercase transition-all flex flex-col items-center justify-center gap-0.5 ${template === 'framework' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <span>Framework</span>
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-100/50">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[11px] font-black text-slate-400 uppercase flex items-center gap-1">
                                AI 智能构建
                            </label>
                            <div className="flex items-center gap-3">
                                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                    <button
                                        onClick={() => onAiLanguageChange('zh')}
                                        className={`px-2 py-1 rounded-md text-[7px] font-black uppercase transition-all ${aiLanguage === 'zh' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >中文</button>
                                    <button
                                        onClick={() => onAiLanguageChange('en')}
                                        className={`px-2 py-1 rounded-md text-[7px] font-black uppercase transition-all ${aiLanguage === 'en' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >EN</button>
                                </div>
                                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                    <button
                                        onClick={() => setIsIterationMode(false)}
                                        className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase transition-all ${!isIterationMode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >新建</button>
                                    <button
                                        onClick={() => setIsIterationMode(true)}
                                        className={`px-2 py-1.5 rounded-md text-[8px] font-black uppercase transition-all ${isIterationMode ? 'bg-amber-100 text-amber-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >迭代</button>
                                </div>
                            </div>
                        </div>

                        <textarea
                            className={`w-full h-24 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-[11px] font-bold outline-none resize-none focus:ring-2 ${isIterationMode ? 'focus:ring-amber-200' : 'focus:ring-indigo-200'}`}
                            placeholder={isIterationMode ? "输入修改指令 (e.g. 增加一个质控环节...)" : "描述实验逻辑 (e.g. 从样本采集到测序...)"}
                            value={userPrompt}
                            onChange={(e) => onUserPromptChange(e.target.value)}
                        />

                        <button
                            onClick={onAiGenerate}
                            disabled={isGenerating || !userPrompt.trim()}
                            className={`w-full py-3.5 text-white rounded-2xl text-[11px] font-black uppercase shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 ${isIterationMode ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-900 hover:bg-indigo-600'}`}
                        >
                            {isGenerating ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-bolt"></i>}
                            {isGenerating ? 'AI 处理中...' : (isIterationMode ? '执行迭代' : '生成结构')}
                        </button>
                    </div>
                </div>
            </div>

            {/* 层级拓扑管理层级 */}
            <div className="space-y-4 pt-4 border-t border-slate-100 flex-1 overflow-y-auto custom-scrollbar pr-1">
                <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">层级拓扑管理</label>
                    <button
                        onClick={onAddGroup}
                        className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg text-[10px] font-black hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95"
                    >+ 层级</button>
                </div>

                <div className="space-y-2">
                    {data.groups.map((group, gIdx) => {
                        const isHex = group.colorTheme?.startsWith('#');
                        const cardBg = isHex ? `${group.colorTheme}18` : undefined;
                        const cardBorder = isHex ? `${group.colorTheme}60` : undefined;
                        const dotColor = isHex ? group.colorTheme : undefined;
                        const titleColor = isHex ? group.colorTheme : undefined;
                        const arrowHoverStyle = isHex ? { color: group.colorTheme } : {};
                        return (
                            <div
                                key={group.id}
                                className="p-3 rounded-2xl border"
                                style={{
                                    backgroundColor: cardBg || '#f8fafc',
                                    borderColor: cardBorder || '#f1f5f9',
                                }}
                            >
                                <div className="flex items-center justify-between mb-2.5 px-1 gap-2">
                                    {/* Group reorder arrows */}
                                    <div className="flex flex-col gap-0.5 shrink-0">
                                        <button
                                            onClick={() => onMoveGroup(group.id, 'up')}
                                            disabled={gIdx === 0}
                                            className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:bg-black/5 transition-all disabled:opacity-20"
                                            style={gIdx > 0 ? arrowHoverStyle : {}}
                                            title="组分左移"
                                        >
                                            <i className="fa-solid fa-chevron-up text-[8px]"></i>
                                        </button>
                                        <button
                                            onClick={() => onMoveGroup(group.id, 'down')}
                                            disabled={gIdx === data.groups.length - 1}
                                            className="w-5 h-5 flex items-center justify-center rounded text-slate-300 hover:bg-black/5 transition-all disabled:opacity-20"
                                            style={gIdx < data.groups.length - 1 ? arrowHoverStyle : {}}
                                            title="组分右移"
                                        >
                                            <i className="fa-solid fa-chevron-down text-[8px]"></i>
                                        </button>
                                    </div>

                                    {/* Color swatch + title */}
                                    <div className="flex items-center gap-2 flex-1 min-w-0 px-1">
                                        {isHex && (
                                            <div
                                                className="w-3 h-3 rounded-full shrink-0 shadow-sm ring-1 ring-black/10"
                                                style={{ backgroundColor: group.colorTheme }}
                                            />
                                        )}
                                        <p
                                            className="text-[9px] font-black uppercase tracking-tighter truncate"
                                            style={{ color: titleColor || '#94a3b8' }}
                                        >
                                            {group.title}
                                        </p>
                                    </div>

                                    <div className="flex gap-1 items-center shrink-0">
                                        <button
                                            onClick={() => setEditingGroupConfigId?.(group.id)}
                                            className="h-7 px-2.5 text-white rounded text-[9px] font-black hover:opacity-80 transition-all shadow-md flex items-center gap-1.5 active:scale-95 border whitespace-nowrap"
                                            style={{
                                                backgroundColor: isHex ? group.colorTheme : '#4f46e5',
                                                borderColor: isHex ? `${group.colorTheme}80` : '#4338ca',
                                            }}
                                            title="层级全局配置"
                                        >
                                            <i className="fa-solid fa-sliders text-[9px]"></i>
                                            层级配置
                                        </button>
                                        <button
                                            onClick={() => onAddNode(group.id)}
                                            className="h-7 px-2.5 bg-white rounded text-[9px] font-black transition-all shadow-sm active:scale-95 flex items-center gap-1.5 whitespace-nowrap border"
                                            style={{
                                                color: isHex ? group.colorTheme : '#4f46e5',
                                                borderColor: isHex ? `${group.colorTheme}60` : '#c7d2fe',
                                            }}
                                            title="在该组添加新节点"
                                        >
                                            <i className="fa-solid fa-plus text-[9px]"></i>
                                            节点
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    {group.nodes.map((node, nIdx) => (
                                        <div
                                            key={node.id}
                                            className="text-[10px] font-bold text-slate-700 flex items-center gap-1.5 p-1.5 pl-2 bg-white/80 rounded-xl border border-white hover:border-opacity-100 transition-all group/node shadow-sm cursor-pointer"
                                            style={{ borderColor: isHex ? `${group.colorTheme}40` : '#f1f5f9' }}
                                            onClick={() => setEditingId(node.id)}
                                        >
                                            {/* Node reorder arrows */}
                                            <div className="flex flex-col gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => onMoveNode(group.id, node.id, 'up')}
                                                    disabled={nIdx === 0}
                                                    className="w-4 h-4 flex items-center justify-center rounded hover:bg-black/5 transition-all disabled:opacity-20"
                                                    style={{ color: dotColor || '#94a3b8' }}
                                                    title="节点上移"
                                                >
                                                    <i className="fa-solid fa-chevron-up text-[7px]"></i>
                                                </button>
                                                <button
                                                    onClick={() => onMoveNode(group.id, node.id, 'down')}
                                                    disabled={nIdx === group.nodes.length - 1}
                                                    className="w-4 h-4 flex items-center justify-center rounded hover:bg-black/5 transition-all disabled:opacity-20"
                                                    style={{ color: dotColor || '#94a3b8' }}
                                                    title="节点下移"
                                                >
                                                    <i className="fa-solid fa-chevron-down text-[7px]"></i>
                                                </button>
                                            </div>
                                            <div
                                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                                style={{ backgroundColor: dotColor || '#818cf8' }}
                                            ></div>
                                            <span className="truncate flex-1">{node.text}</span>
                                            <i className="fa-solid fa-chevron-right text-[7px] text-slate-200 group-hover/node:text-opacity-80 transition-all"
                                                style={{ color: isHex ? `${group.colorTheme}80` : undefined }}
                                            ></i>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Utility & Export Tools */}
            <div className="space-y-4 pt-4 border-t border-slate-100 shrink-0">
                <button
                    onClick={() => setShowUtility(!showUtility)}
                    className="w-full flex items-center justify-between group/title transition-colors"
                >
                    <label className="text-[11px] font-black text-slate-400 group-hover:text-indigo-600 uppercase tracking-widest flex items-center gap-2 cursor-pointer transition-colors">
                        <i className={`fa-solid fa-toolbox ${showUtility ? 'text-indigo-600' : 'text-slate-300'}`}></i> 辅助与导出 (UTILS)
                    </label>
                    <i className={`fa-solid fa-chevron-down text-[10px] text-slate-300 transition-transform duration-300 ${showUtility ? 'rotate-180 text-indigo-400' : ''}`}></i>
                </button>

                <div className={`space-y-4 overflow-hidden transition-all duration-300 ${showUtility ? 'max-h-[500px] mt-2 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <button
                        onClick={() => { setIsConnectMode(!isConnectMode); setConnectSourceId(null); }}
                        className={`w-full py-3.5 rounded-2xl text-[11px] font-extrabold transition-all shadow-sm flex items-center justify-center gap-2 border ${isConnectMode ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white hover:text-indigo-600 hover:border-indigo-200'}`}
                    >
                        <i className={`fa-solid ${isConnectMode ? 'fa-link-slash' : 'fa-link'} text-sm`}></i>
                        {isConnectMode ? (connectSourceId ? '请选择目标节点...' : '点击节点开始') : '连线模式 (Connect)'}
                    </button>

                    <button onClick={onAutoLayout} className="w-full py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-bold text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all shadow-sm">
                        <i className="fa-solid fa-wand-sparkles mr-1"></i> 自动布局 (Reset)
                    </button>

                    <button
                        onClick={onSmartLabelLayout}
                        className="w-full py-3 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl text-[10px] font-bold text-indigo-600 hover:from-indigo-600 hover:to-violet-600 hover:text-white hover:border-indigo-600 transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                        <i className="fa-solid fa-wand-magic-sparkles"></i> 线段文本智能排版
                    </button>

                    {/* 间距调整控件 */}
                    <div className="space-y-3 pt-3 border-t border-slate-100/50">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <i className="fa-solid fa-arrows-up-down text-[9px] text-slate-300"></i> 间距调整
                        </label>
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-slate-500 w-16 shrink-0">节点间距</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="150"
                                    step="2"
                                    value={spacingConfig.nodeGap}
                                    onChange={(e) => onSpacingChange('nodeGap', Number(e.target.value))}
                                    className="flex-1 h-1.5 accent-indigo-500 cursor-pointer"
                                />
                                <span className="text-[9px] font-mono font-bold text-indigo-600 w-8 text-right">{spacingConfig.nodeGap}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-slate-500 w-16 shrink-0">组分间距</span>
                                <input
                                    type="range"
                                    min="200"
                                    max="800"
                                    step="5"
                                    value={spacingConfig.groupPaddingX}
                                    onChange={(e) => onSpacingChange('groupPaddingX', Number(e.target.value))}
                                    className="flex-1 h-1.5 accent-indigo-500 cursor-pointer"
                                />
                                <span className="text-[9px] font-mono font-bold text-indigo-600 w-8 text-right">{spacingConfig.groupPaddingX}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-1 pt-4 border-t border-slate-100">
                        <button onClick={onExportPng} className="py-2.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl text-[9px] font-bold hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
                            <i className="fa-solid fa-image mr-1"></i> PNG
                        </button>
                        <button onClick={onExportSvg} className="py-2.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-[9px] font-bold hover:bg-rose-600 hover:text-white transition-all shadow-sm">
                            <i className="fa-solid fa-vector-square mr-1"></i> Vector SVG
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
