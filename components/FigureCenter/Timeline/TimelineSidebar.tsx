import React, { useMemo, useState, useRef, useEffect } from 'react';
import { TimelineData, TimelineEvent, TimelineEventType, TimelineArrowStyle, TimelineCrossLink, SavedTimeline } from '../../../types/visuals';
import { DateNavigator } from './Sub/DateNavigator';
import { EventList } from './Sub/EventList';
import { ColorPickerWithPresets } from '../../DataAnalysis/Chart/ColorPickerWithPresets';
import { TimelineLibraryModal } from './TimelineLibraryModal';

interface TimelineSidebarProps {
    userPrompt: string;
    onUserPromptChange: (val: string) => void;
    isGenerating: boolean;
    onGenerate: () => void;
    onAddEvent: () => void;
    onDeleteEvent: (id: string) => void;
    onCreateEmpty: () => void;
    data: TimelineData | null;
    setData: (data: TimelineData) => void;
    onSaveToLibrary: () => void;
    activeEventId: string | null;
    setActiveEventId: (id: string | null) => void;

    // Library Props
    showLibrary: boolean;
    setShowLibrary: (v: boolean) => void;
    savedTimelines: SavedTimeline[];
    onLoadSaved: (item: SavedTimeline) => void;
    onDeleteSaved: (id: string, e: React.MouseEvent) => void;
    onRenameSaved: (id: string, newTitle: string) => void;
    onCategoryChange: (id: string, newCategory: string) => void;

    showSaveModal: boolean;
    setShowSaveModal: (val: boolean) => void;
    saveTitle: string;
    setSaveTitle: (val: string) => void;
    onConfirmSave: () => void;

    aiLanguage: 'zh' | 'en';
    onAiLanguageChange: (val: 'zh' | 'en') => void;
    onExportPng?: () => void;

    // 撤回/重做
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
}

const TYPE_LABELS: Record<TimelineEventType, string> = {
    breakthrough: '科学突破',
    milestone: '重要里程碑',
    publication: '论文发表',
    industrial: '产业化应用',
    failed_attempt: '实验回溯'
};

const GRADIENT_PRESETS = [
    { id: 'rainbow', name: '五彩霓虹', colors: ['#6366f1', '#a855f7', '#ec4899', '#f43f5e'], preview: 'from-indigo-500 via-purple-500 via-pink-500 to-rose-500' },
    { id: 'ocean', name: '深海极光', colors: ['#06b6d4', '#3b82f6', '#4338ca'], preview: 'from-cyan-500 via-blue-500 to-indigo-700' },
    { id: 'forest', name: '翡翠森林', colors: ['#84cc16', '#10b981', '#0d9488'], preview: 'from-lime-500 via-emerald-500 to-teal-700' },
    { id: 'sunset', name: '暖阳逻辑', colors: ['#facc15', '#f97316', '#dc2626'], preview: 'from-yellow-400 via-orange-500 to-red-600' },
    { id: 'cyber', name: '赛博矩阵', colors: ['#ec4899', '#8b5cf6', '#06b6d4'], preview: 'from-pink-500 via-violet-500 to-cyan-500' }
];

const ACADEMIC_COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#000000'];

export const TimelineSidebar: React.FC<TimelineSidebarProps> = (props) => {
    const { data, setData, activeEventId, onAddEvent, onDeleteEvent, showLibrary, setShowLibrary, savedTimelines, onLoadSaved, onDeleteSaved } = props;
    const [isAIPanelCollapsed, setIsAIPanelCollapsed] = useState(true);
    const [isVisualPanelCollapsed, setIsVisualPanelCollapsed] = useState(false);
    const [typoTarget, setTypoTarget] = useState<'title' | 'desc' | 'date'>('title');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ====== 撤回/重做全局快捷键 ======
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMac = navigator.platform.toUpperCase().includes('MAC');
            const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
            if (!ctrlOrCmd) return;
            // 避免在 input/textarea 中触发
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (e.key === 'z' || e.key === 'Z') {
                if (e.shiftKey) {
                    e.preventDefault();
                    props.onRedo?.();
                } else {
                    e.preventDefault();
                    props.onUndo?.();
                }
            } else if (e.key === 'y' || e.key === 'Y') {
                e.preventDefault();
                props.onRedo?.();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [props.onUndo, props.onRedo]);

    const activeEvent = useMemo(() =>
        data?.events.find(e => e.id === activeEventId),
        [data, activeEventId]);

    const isGradientMode = data?.axisColor === 'gradient';

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && activeEventId) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const url = event.target?.result as string;
                props.setData({
                    ...data!,
                    events: data!.events.map(ev => ev.id === activeEventId ? { ...ev, mediaUrl: url } : ev)
                });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <aside className="w-full lg:w-80 bg-white rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col shrink-0 z-20 relative overflow-hidden">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-5">
                {/* Header */}
                <div className="flex items-center px-1">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                            <i className="fa-solid fa-timeline text-sm"></i>
                        </div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter italic">演进设计师</h3>
                    </div>
                </div>

                {/* AI 生成面板 - Combined and cleaner */}
                <section className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 transition-all">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <i className="fa-solid fa-wand-magic-sparkles text-indigo-400"></i> AI 智能生成
                        </label>
                        <div className="flex bg-white p-0.5 rounded-md border border-slate-200 shadow-sm">
                            {(['zh', 'en'] as const).map(lang => (
                                <button
                                    key={lang}
                                    onClick={() => props.onAiLanguageChange(lang)}
                                    className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase transition-all ${props.aiLanguage === lang ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {lang === 'zh' ? '中' : 'EN'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div
                        className="flex justify-between items-center cursor-pointer group px-1 select-none"
                        onClick={() => setIsAIPanelCollapsed(!isAIPanelCollapsed)}
                    >
                        <p className="text-[9px] font-bold text-slate-500">{isAIPanelCollapsed ? '展开演进指令' : '收起指令面板'}</p>
                        <i className={`fa-solid ${isAIPanelCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'} text-[7px] text-slate-300 group-hover:text-indigo-400 transition-all`}></i>
                    </div>

                    {!isAIPanelCollapsed && (
                        <div className="space-y-3 pt-2 animate-reveal">
                            <textarea
                                className="w-full h-20 bg-white border border-slate-200 rounded-xl p-2.5 text-[10px] font-bold text-slate-700 outline-none shadow-sm resize-none focus:ring-2 focus:ring-indigo-100 transition-all"
                                placeholder="描述该领域的演进过程..."
                                value={props.userPrompt}
                                onChange={e => props.onUserPromptChange(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={props.onGenerate}
                                    disabled={props.isGenerating || !props.userPrompt.trim()}
                                    className="flex-1 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase shadow-sm hover:bg-indigo-600 transition-all disabled:opacity-30 flex items-center justify-center gap-1.5"
                                >
                                    {props.isGenerating ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-satellite-dish"></i>}
                                    {props.isGenerating ? '生成中...' : 'AI 生成'}
                                </button>
                                {!data && (
                                    <button onClick={props.onCreateEmpty} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase hover:bg-slate-50 transition-all">空白开始</button>
                                )}
                            </div>
                        </div>
                    )}
                </section>

                {data && (
                    <div className="space-y-5 animate-reveal">
                        {/* 全局视觉配置面板 - Tightened grid */}
                        <section className="bg-white border border-slate-200 rounded-[2rem] shadow-sm relative overflow-hidden transition-all duration-300">
                            <div
                                className="flex items-center justify-between p-4 cursor-pointer group/header select-none bg-slate-50/50 border-b border-slate-100"
                                onClick={() => setIsVisualPanelCollapsed(!isVisualPanelCollapsed)}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-orange-50 flex items-center justify-center">
                                        <i className="fa-solid fa-palette text-[10px] text-orange-500"></i>
                                    </div>
                                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest pointer-events-none">全局视觉 (VISUAL)</label>
                                </div>
                                <div className={`w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center transition-transform duration-300 ${isVisualPanelCollapsed ? '' : 'rotate-180'}`}>
                                    <i className="fa-solid fa-chevron-down text-[7px] text-slate-400"></i>
                                </div>
                            </div>

                            {!isVisualPanelCollapsed && (
                                <div className="p-3 space-y-6 animate-reveal">
                                    {/* 1. 主轴路径风格 - Card Based */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 px-1">
                                            <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">主轴路径架构</p>
                                        </div>
                                        <div className="grid grid-cols-5 gap-1.5">
                                            {[
                                                { id: 'straight', label: '直线', icon: (color: string) => <line x1="2" y1="6" x2="38" y2="6" stroke={color} strokeWidth="5" strokeLinecap="round" /> },
                                                { id: 'wave', label: '波浪', icon: (color: string) => <path d="M 2 6 Q 11 0 20 6 Q 29 12 38 6" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" /> },
                                                { id: 'stepped', label: '阶梯', icon: (color: string) => <path d="M 2 10 L 14 10 L 14 6 L 26 6 L 26 2 L 38 2" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" /> },
                                                { id: 'scurve', label: 'S型', icon: (color: string) => <path d="M 2 10 C 12 10 28 2 38 2" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" /> },
                                                { id: 'zigzag', label: '锯齿', icon: (color: string) => <path d="M 2 6 L 10 2 L 20 10 L 30 2 L 38 6" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /> }
                                            ].map(type => (
                                                <button
                                                    key={type.id}
                                                    onClick={() => setData({ ...data, pathType: type.id as any })}
                                                    className={`group relative py-2 rounded-xl transition-all flex flex-col items-center justify-center gap-1 border-2 ${data.pathType === type.id
                                                        ? 'bg-white border-slate-900 shadow-lg scale-[1.05] z-10'
                                                        : 'bg-slate-50 border-transparent text-slate-400 hover:bg-white hover:border-slate-100'
                                                        }`}
                                                >
                                                    <svg viewBox="0 0 40 12" className="w-8 h-2.5 transition-colors">
                                                        {type.icon(data.pathType === type.id ? '#1e293b' : '#cbd5e1')}
                                                    </svg>
                                                    <span className={`block text-[7px] font-black uppercase tracking-tighter leading-none ${data.pathType === type.id ? 'text-slate-900' : 'text-slate-400'}`}>{type.label}</span>
                                                </button>
                                            ))}
                                        </div>

                                        {/* 路径参数调节 - 按类型动态显示 */}
                                        {data.pathType === 'straight' && (
                                            <div className="mt-2 space-y-1.5 animate-reveal">
                                                <div className="flex items-center bg-slate-50/80 rounded-xl border border-slate-200 px-3 h-9 shadow-sm">
                                                    <span className="text-[6px] font-black text-slate-400 uppercase tracking-tighter mr-2 shrink-0 w-8">倾斜</span>
                                                    <button onClick={() => setData({ ...data, straightTilt: Math.max(-200, (data.straightTilt ?? 0) - 20) })}
                                                        className="w-5 h-5 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-slate-50 shadow-sm transition-all"
                                                    ><i className="fa-solid fa-minus text-[6px]"></i></button>
                                                    <input type="range" min="-200" max="200" step="10" className="flex-1 mx-2 accent-slate-500 h-1 min-w-0"
                                                        value={data.straightTilt ?? 0}
                                                        onChange={e => setData({ ...data, straightTilt: parseInt(e.target.value) })} />
                                                    <button onClick={() => setData({ ...data, straightTilt: Math.min(200, (data.straightTilt ?? 0) + 20) })}
                                                        className="w-5 h-5 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-slate-50 shadow-sm transition-all"
                                                    ><i className="fa-solid fa-plus text-[6px]"></i></button>
                                                    <span className="w-7 text-center text-[9px] font-black text-slate-600 ml-1 shrink-0">{data.straightTilt ?? 0}</span>
                                                </div>
                                            </div>
                                        )}

                                        {data.pathType === 'wave' && (
                                            <div className="mt-2 space-y-1.5 animate-reveal">
                                                <div className="flex items-center bg-blue-50/60 rounded-xl border border-blue-100 px-3 h-9 shadow-sm">
                                                    <span className="text-[6px] font-black text-blue-400 uppercase tracking-tighter mr-2 shrink-0 w-8">曲率</span>
                                                    <button onClick={() => setData({ ...data, waveCurvature: Math.max(50, (data.waveCurvature ?? 280) - 30) })}
                                                        className="w-5 h-5 rounded-lg bg-white border border-blue-200 text-blue-400 flex items-center justify-center hover:bg-blue-50 shadow-sm transition-all"
                                                    ><i className="fa-solid fa-minus text-[6px]"></i></button>
                                                    <input type="range" min="50" max="500" step="10" className="flex-1 mx-2 accent-blue-500 h-1 min-w-0"
                                                        value={data.waveCurvature ?? 280}
                                                        onChange={e => setData({ ...data, waveCurvature: parseInt(e.target.value) })} />
                                                    <button onClick={() => setData({ ...data, waveCurvature: Math.min(500, (data.waveCurvature ?? 280) + 30) })}
                                                        className="w-5 h-5 rounded-lg bg-white border border-blue-200 text-blue-400 flex items-center justify-center hover:bg-blue-50 shadow-sm transition-all"
                                                    ><i className="fa-solid fa-plus text-[6px]"></i></button>
                                                    <span className="w-7 text-center text-[9px] font-black text-blue-600 ml-1 shrink-0">{data.waveCurvature ?? 280}</span>
                                                </div>
                                            </div>
                                        )}

                                        {data.pathType === 'stepped' && (
                                            <div className="mt-2 space-y-1.5 animate-reveal">
                                                <div className="flex items-center bg-emerald-50/60 rounded-xl border border-emerald-100 px-3 h-9 shadow-sm">
                                                    <span className="text-[6px] font-black text-emerald-400 uppercase tracking-tighter mr-2 shrink-0 w-8">阶数</span>
                                                    <button onClick={() => setData({ ...data, steppedCount: Math.max(2, (data.steppedCount ?? 3) - 1) })}
                                                        className="w-5 h-5 rounded-lg bg-white border border-emerald-200 text-emerald-400 flex items-center justify-center hover:bg-emerald-50 shadow-sm transition-all"
                                                    ><i className="fa-solid fa-minus text-[6px]"></i></button>
                                                    <input type="range" min="2" max="6" step="1" className="flex-1 mx-2 accent-emerald-500 h-1 min-w-0"
                                                        value={data.steppedCount ?? 3}
                                                        onChange={e => setData({ ...data, steppedCount: parseInt(e.target.value) })} />
                                                    <button onClick={() => setData({ ...data, steppedCount: Math.min(6, (data.steppedCount ?? 3) + 1) })}
                                                        className="w-5 h-5 rounded-lg bg-white border border-emerald-200 text-emerald-400 flex items-center justify-center hover:bg-emerald-50 shadow-sm transition-all"
                                                    ><i className="fa-solid fa-plus text-[6px]"></i></button>
                                                    <span className="w-7 text-center text-[9px] font-black text-emerald-600 ml-1 shrink-0">{data.steppedCount ?? 3}</span>
                                                </div>
                                                <div className="flex items-center bg-emerald-50/60 rounded-xl border border-emerald-100 px-3 h-9 shadow-sm">
                                                    <span className="text-[6px] font-black text-emerald-400 uppercase tracking-tighter mr-2 shrink-0 w-8">阶高</span>
                                                    <button onClick={() => setData({ ...data, steppedHeight: Math.max(30, (data.steppedHeight ?? 80) - 10) })}
                                                        className="w-5 h-5 rounded-lg bg-white border border-emerald-200 text-emerald-400 flex items-center justify-center hover:bg-emerald-50 shadow-sm transition-all"
                                                    ><i className="fa-solid fa-minus text-[6px]"></i></button>
                                                    <input type="range" min="30" max="160" step="10" className="flex-1 mx-2 accent-emerald-500 h-1 min-w-0"
                                                        value={data.steppedHeight ?? 80}
                                                        onChange={e => setData({ ...data, steppedHeight: parseInt(e.target.value) })} />
                                                    <button onClick={() => setData({ ...data, steppedHeight: Math.min(160, (data.steppedHeight ?? 80) + 10) })}
                                                        className="w-5 h-5 rounded-lg bg-white border border-emerald-200 text-emerald-400 flex items-center justify-center hover:bg-emerald-50 shadow-sm transition-all"
                                                    ><i className="fa-solid fa-plus text-[6px]"></i></button>
                                                    <span className="w-7 text-center text-[9px] font-black text-emerald-600 ml-1 shrink-0">{data.steppedHeight ?? 80}</span>
                                                </div>
                                            </div>
                                        )}

                                        {data.pathType === 'scurve' && (
                                            <div className="mt-2 space-y-1.5 animate-reveal">
                                                <div className="flex items-center bg-violet-50/60 rounded-xl border border-violet-100 px-3 h-9 shadow-sm">
                                                    <span className="text-[6px] font-black text-violet-400 uppercase tracking-tighter mr-2 shrink-0 w-8">陡峭</span>
                                                    <button onClick={() => setData({ ...data, scurveSteepness: Math.max(4, (data.scurveSteepness ?? 10) - 1) })}
                                                        className="w-5 h-5 rounded-lg bg-white border border-violet-200 text-violet-400 flex items-center justify-center hover:bg-violet-50 shadow-sm transition-all"
                                                    ><i className="fa-solid fa-minus text-[6px]"></i></button>
                                                    <input type="range" min="4" max="20" step="1" className="flex-1 mx-2 accent-violet-500 h-1 min-w-0"
                                                        value={data.scurveSteepness ?? 10}
                                                        onChange={e => setData({ ...data, scurveSteepness: parseInt(e.target.value) })} />
                                                    <button onClick={() => setData({ ...data, scurveSteepness: Math.min(20, (data.scurveSteepness ?? 10) + 1) })}
                                                        className="w-5 h-5 rounded-lg bg-white border border-violet-200 text-violet-400 flex items-center justify-center hover:bg-violet-50 shadow-sm transition-all"
                                                    ><i className="fa-solid fa-plus text-[6px]"></i></button>
                                                    <span className="w-7 text-center text-[9px] font-black text-violet-600 ml-1 shrink-0">{data.scurveSteepness ?? 10}</span>
                                                </div>
                                                <div className="flex items-center bg-violet-50/60 rounded-xl border border-violet-100 px-3 h-9 shadow-sm">
                                                    <span className="text-[6px] font-black text-violet-400 uppercase tracking-tighter mr-2 shrink-0 w-8">振幅</span>
                                                    <button onClick={() => setData({ ...data, scurveAmplitude: Math.max(60, (data.scurveAmplitude ?? 120) - 10) })}
                                                        className="w-5 h-5 rounded-lg bg-white border border-violet-200 text-violet-400 flex items-center justify-center hover:bg-violet-50 shadow-sm transition-all"
                                                    ><i className="fa-solid fa-minus text-[6px]"></i></button>
                                                    <input type="range" min="60" max="300" step="10" className="flex-1 mx-2 accent-violet-500 h-1 min-w-0"
                                                        value={data.scurveAmplitude ?? 120}
                                                        onChange={e => setData({ ...data, scurveAmplitude: parseInt(e.target.value) })} />
                                                    <button onClick={() => setData({ ...data, scurveAmplitude: Math.min(300, (data.scurveAmplitude ?? 120) + 10) })}
                                                        className="w-5 h-5 rounded-lg bg-white border border-violet-200 text-violet-400 flex items-center justify-center hover:bg-violet-50 shadow-sm transition-all"
                                                    ><i className="fa-solid fa-plus text-[6px]"></i></button>
                                                    <span className="w-7 text-center text-[9px] font-black text-violet-600 ml-1 shrink-0">{data.scurveAmplitude ?? 120}</span>
                                                </div>
                                            </div>
                                        )}

                                        {data.pathType === 'zigzag' && (
                                            <div className="mt-2 space-y-1.5 animate-reveal">
                                                <div className="flex items-center bg-amber-50/60 rounded-xl border border-amber-100 px-3 h-9 shadow-sm">
                                                    <span className="text-[6px] font-black text-amber-500 uppercase tracking-tighter mr-2 shrink-0 w-8">振幅</span>
                                                    <button onClick={() => setData({ ...data, zigzagAmplitude: Math.max(30, (data.zigzagAmplitude ?? 80) - 10) })}
                                                        className="w-5 h-5 rounded-lg bg-white border border-amber-200 text-amber-500 flex items-center justify-center hover:bg-amber-50 shadow-sm transition-all"
                                                    ><i className="fa-solid fa-minus text-[6px]"></i></button>
                                                    <input type="range" min="30" max="200" step="10" className="flex-1 mx-2 accent-amber-500 h-1 min-w-0"
                                                        value={data.zigzagAmplitude ?? 80}
                                                        onChange={e => setData({ ...data, zigzagAmplitude: parseInt(e.target.value) })} />
                                                    <button onClick={() => setData({ ...data, zigzagAmplitude: Math.min(200, (data.zigzagAmplitude ?? 80) + 10) })}
                                                        className="w-5 h-5 rounded-lg bg-white border border-amber-200 text-amber-500 flex items-center justify-center hover:bg-amber-50 shadow-sm transition-all"
                                                    ><i className="fa-solid fa-plus text-[6px]"></i></button>
                                                    <span className="w-7 text-center text-[9px] font-black text-amber-600 ml-1 shrink-0">{data.zigzagAmplitude ?? 80}</span>
                                                </div>
                                                <div className="flex items-center bg-amber-50/60 rounded-xl border border-amber-100 px-3 h-9 shadow-sm">
                                                    <span className="text-[6px] font-black text-amber-500 uppercase tracking-tighter mr-2 shrink-0 w-8">齿数</span>
                                                    <button onClick={() => setData({ ...data, zigzagCount: Math.max(1, (data.zigzagCount ?? 2) - 1) })}
                                                        className="w-5 h-5 rounded-lg bg-white border border-amber-200 text-amber-500 flex items-center justify-center hover:bg-amber-50 shadow-sm transition-all"
                                                    ><i className="fa-solid fa-minus text-[6px]"></i></button>
                                                    <input type="range" min="1" max="5" step="1" className="flex-1 mx-2 accent-amber-500 h-1 min-w-0"
                                                        value={data.zigzagCount ?? 2}
                                                        onChange={e => setData({ ...data, zigzagCount: parseInt(e.target.value) })} />
                                                    <button onClick={() => setData({ ...data, zigzagCount: Math.min(5, (data.zigzagCount ?? 2) + 1) })}
                                                        className="w-5 h-5 rounded-lg bg-white border border-amber-200 text-amber-500 flex items-center justify-center hover:bg-amber-50 shadow-sm transition-all"
                                                    ><i className="fa-solid fa-plus text-[6px]"></i></button>
                                                    <span className="w-7 text-center text-[9px] font-black text-amber-600 ml-1 shrink-0">{data.zigzagCount ?? 2}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. 轴体细节配置 */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest px-1">轴体填充</p>
                                            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                                                {([true, false] as const).map(v => (
                                                    <button
                                                        key={v ? 'h' : 's'}
                                                        onClick={() => setData({ ...data, isHollow: v })}
                                                        className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${data.isHollow === v ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                                                    >{v ? '空心' : '实心'}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[7px] font-black text-slate-300 uppercase tracking-widest px-1">演进分布</p>
                                            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                                                {(['proportional', 'equal'] as const).map(mode => (
                                                    <button
                                                        key={mode}
                                                        onClick={() => setData({ ...data, distributionMode: mode })}
                                                        className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${(!data.distributionMode || data.distributionMode === mode) || (data.distributionMode === mode) ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                                                    >{mode === 'proportional' ? '时间' : '等距'}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. 箭头样式 */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 px-1">
                                            <div className="w-1 h-3 bg-amber-500 rounded-full"></div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">轴末端箭头 (TERMINATOR)</p>
                                        </div>
                                        <div className="grid grid-cols-4 bg-slate-50 p-1.5 rounded-[1.25rem] border border-slate-100 gap-1.5">
                                            {[
                                                { id: 'classic', icon: 'fa-caret-right', label: 'Classic' },
                                                { id: 'stealth', icon: 'fa-location-arrow', label: 'Stealth' },
                                                { id: 'diamond', icon: 'fa-diamond', label: 'Diamond' },
                                                { id: 'none', icon: 'fa-ban', label: 'None' }
                                            ].map(style => (
                                                <button
                                                    key={style.id}
                                                    onClick={() => setData({ ...data, arrowStyle: style.id as any })}
                                                    className={`group relative py-2.5 rounded-xl transition-all flex flex-col items-center justify-center gap-1 border ${data.arrowStyle === style.id
                                                        ? 'bg-white text-indigo-600 border-white shadow-md'
                                                        : 'bg-transparent border-transparent text-slate-400 hover:text-slate-500 hover:bg-slate-100/50'
                                                        }`}
                                                >
                                                    <i className={`fa-solid ${style.icon} text-xs ${style.id === 'stealth' ? 'rotate-45' : ''}`}></i>
                                                    <span className="text-[6px] font-bold uppercase tracking-tighter opacity-70">{style.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 4. 数值细调 */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { label: '主轴长度', attr: 'axisLength', unit: 'px', step: 100, icon: 'fa-left-right', defaultVal: 1000 },
                                            { label: '主轴宽度', attr: 'axisWidth', unit: 'pt', step: 0.5, icon: 'fa-arrows-left-right', defaultVal: 4 },
                                            { label: '箭头规模', attr: 'arrowWidth', unit: 'x', step: 0.1, icon: 'fa-expand', defaultVal: 4 },
                                            { label: '霓虹辉光', attr: 'glowIntensity', unit: 'px', step: 1, icon: 'fa-sun', defaultVal: 5 }
                                        ].map(m => (
                                            <div key={m.attr} className="flex flex-col items-center bg-slate-50/50 p-2 rounded-2xl border border-slate-100 hover:bg-white hover:border-slate-200 transition-all shadow-sm group">
                                                <div className="flex items-center gap-1 mb-1.5">
                                                    <i className={`fa-solid ${m.icon} text-[6px] text-slate-400 group-hover:text-indigo-500 transition-colors`}></i>
                                                    <span className="text-[6px] font-black text-slate-400 uppercase tracking-tighter">{m.label}</span>
                                                </div>
                                                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-inner w-full justify-center">
                                                    <button
                                                        onClick={() => setData({ ...data, [m.attr]: Math.max(m.attr === 'axisLength' ? 200 : 0, ((data as any)[m.attr] ?? m.defaultVal) - m.step) })}
                                                        className="w-4 h-4 rounded flex items-center justify-center text-slate-300 hover:text-indigo-500 transition-colors"
                                                    ><i className="fa-solid fa-minus text-[6px]"></i></button>
                                                    <input
                                                        type="number"
                                                        step={m.step}
                                                        className="w-10 bg-transparent text-[10px] font-black text-slate-700 outline-none text-center"
                                                        value={(data as any)[m.attr] ?? m.defaultVal}
                                                        onChange={e => setData({ ...data, [m.attr]: parseFloat(e.target.value) || m.defaultVal })}
                                                    />
                                                    <button
                                                        onClick={() => setData({ ...data, [m.attr]: Math.min(m.attr === 'axisLength' ? 10000 : 999, ((data as any)[m.attr] ?? m.defaultVal) + m.step) })}
                                                        className="w-4 h-4 rounded flex items-center justify-center text-slate-300 hover:text-indigo-500 transition-colors"
                                                    ><i className="fa-solid fa-plus text-[6px]"></i></button>
                                                </div>
                                                <span className="text-[6px] text-slate-300 font-bold mt-0.5">{m.unit}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* 5. 色彩控制 */}
                                    <div className="pt-4 border-t border-slate-100">
                                        <div className="flex justify-between items-center mb-3 px-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1 h-3 bg-violet-500 rounded-full"></div>
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">轴体色彩方案</p>
                                            </div>
                                            <button
                                                onClick={() => setData({ ...data, axisColor: isGradientMode ? '#6366f1' : 'gradient' })}
                                                className={`px-3 py-1 rounded-full text-[7px] font-black uppercase transition-all border-2 ${isGradientMode
                                                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent shadow-lg shadow-indigo-100'
                                                    : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'
                                                    }`}
                                            >
                                                {isGradientMode ? '霓虹渐变 · ON' : '无渐变模式'}
                                            </button>
                                        </div>

                                        {!isGradientMode ? (
                                            <div className="animate-reveal py-1">
                                                <ColorPickerWithPresets
                                                    label="学术配色方案"
                                                    color={data.axisColor || '#6366f1'}
                                                    documentColors={ACADEMIC_COLORS}
                                                    onChange={(c) => setData({ ...data, axisColor: c })}
                                                />
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-5 gap-3 px-1 pt-1">
                                                {GRADIENT_PRESETS.map(preset => (
                                                    <button
                                                        key={preset.id}
                                                        onClick={() => setData({ ...data, gradientPreset: preset.id })}
                                                        title={preset.name}
                                                        className={`group relative w-full aspect-square rounded-2xl bg-gradient-to-tr ${preset.preview} border-4 transition-all active:scale-90 ${data.gradientPreset === preset.id
                                                            ? 'border-white shadow-xl scale-110 ring-4 ring-indigo-50 z-10'
                                                            : 'border-white hover:border-slate-50 shadow-md hover:scale-105'
                                                            }`}
                                                    >
                                                        {data.gradientPreset === preset.id && (
                                                            <div className="absolute inset-0 flex items-center justify-center">
                                                                <i className="fa-solid fa-check text-white text-[8px] drop-shadow-md"></i>
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* 6. 连接线与锚点 (CONNECTOR) */}
                                    <div className="space-y-4 pt-4 border-t border-slate-100">
                                        <div className="flex items-center gap-2 px-1">
                                            <div className="w-1 h-3 bg-emerald-500 rounded-full"></div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">连接线与锚点架构</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 space-y-2">
                                                <span className="block text-[7px] font-black text-slate-400 uppercase tracking-tighter px-1">锚点连通性</span>
                                                <div className="flex bg-white p-1 rounded-xl border border-slate-100 shadow-sm">
                                                    {(['solid', 'dashed', 'dotted'] as const).map(ls => (
                                                        <button key={ls}
                                                            onClick={() => setData({ ...data, events: data.events.map(ev => ({ ...ev, lineStyle: ls })) })}
                                                            className={`flex-1 py-1.5 rounded-lg text-[6px] font-black uppercase transition-all ${(data.events[0]?.lineStyle || 'dashed') === ls
                                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                                : 'text-slate-400 hover:text-slate-600'
                                                                }`}
                                                        >{ls === 'solid' ? '实线' : ls === 'dashed' ? '虚线' : '点线'}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100 space-y-2">
                                                <span className="block text-[7px] font-black text-slate-400 uppercase tracking-tighter px-1">锚点几何形状</span>
                                                <div className="flex bg-white p-1 rounded-xl border border-slate-100 shadow-sm">
                                                    {(['circle', 'diamond', 'square'] as const).map(shape => (
                                                        <button key={shape}
                                                            onClick={() => setData({ ...data, events: data.events.map(ev => ({ ...ev, dotShape: shape })) })}
                                                            className={`flex-1 py-1 rounded-lg transition-all flex items-center justify-center ${(data.events[0]?.dotShape || 'circle') === shape
                                                                ? 'bg-slate-900 text-white shadow-sm'
                                                                : 'text-slate-300 hover:text-slate-500'
                                                                }`}
                                                        >
                                                            {shape === 'circle'
                                                                ? <div className="w-2.5 h-2.5 rounded-full border-2 border-current"></div>
                                                                : shape === 'diamond'
                                                                    ? <div className="w-2 h-2 border-2 border-current rotate-45 rounded-[1px]"></div>
                                                                    : <div className="w-2.5 h-2.5 border-2 border-current rounded-[2px]"></div>
                                                            }
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { label: '线宽 (WIDTH)', val: data.events[0]?.lineStrokeWidth || 2.5, min: 0.5, step: 0.5, attr: 'lineStrokeWidth' },
                                                { label: '锚点 (SIZE)', val: data.events[0]?.dotSize || 16, min: 8, step: 2, attr: 'dotSize' }
                                            ].map(m => (
                                                <div key={m.label} className="flex items-center justify-between bg-slate-50/50 rounded-2xl border border-slate-100 px-3 h-10">
                                                    <span className="text-[6px] font-black text-slate-400 uppercase">{m.label}</span>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setData({ ...data, events: data.events.map(ev => ({ ...ev, [m.attr]: Math.max(m.min, (ev[m.attr as keyof TimelineEvent] as number || m.val) - m.step) })) })}
                                                            className="w-5 h-5 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-slate-50 shadow-sm transition-all"
                                                        ><i className="fa-solid fa-minus text-[6px]"></i></button>
                                                        <span className="w-6 text-center text-[10px] font-black text-slate-700">{(m.val as number).toFixed(m.step < 1 ? 1 : 0)}</span>
                                                        <button
                                                            onClick={() => setData({ ...data, events: data.events.map(ev => ({ ...ev, [m.attr]: (ev[m.attr as keyof TimelineEvent] as number || m.val) + m.step })) })}
                                                            className="w-5 h-5 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-slate-50 shadow-sm transition-all"
                                                        ><i className="fa-solid fa-plus text-[6px]"></i></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 7. 气泡与排版 (BUBBLE & TYPO) */}
                                    <div className="space-y-4 pt-4 border-t border-slate-100">
                                        <div className="flex items-center justify-between px-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1 h-3 bg-indigo-500 rounded-full"></div>
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">气泡渲染与排版 (TYPO)</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const cur = data.events[0]?.bubbleConfig?.glassEffect;
                                                    setData({ ...data, events: data.events.map(ev => ({ ...ev, bubbleConfig: { ...ev.bubbleConfig, glassEffect: !cur } })) });
                                                }}
                                                className={`px-2.5 py-1 rounded-full text-[6px] font-black uppercase transition-all border ${data.events[0]?.bubbleConfig?.glassEffect
                                                    ? 'bg-indigo-600 text-white border-transparent shadow-lg shadow-indigo-100'
                                                    : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50 shadow-sm'
                                                    }`}
                                            >
                                                <i className="fa-solid fa-wand-magic-sparkles mr-1"></i> GLASS MISM
                                            </button>
                                        </div>

                                        <div className="flex bg-slate-100/50 p-1 rounded-2xl border border-slate-200/50">
                                            {([
                                                { key: 'title' as const, label: 'TIT' },
                                                { key: 'desc' as const, label: 'DSC' },
                                                { key: 'date' as const, label: 'DAT' },
                                            ]).map(tab => (
                                                <button
                                                    key={tab.key}
                                                    onClick={() => setTypoTarget(tab.key)}
                                                    className={`flex-1 py-1.5 rounded-xl text-[8px] font-black uppercase transition-all ${typoTarget === tab.key
                                                        ? 'bg-white text-indigo-600 shadow-md border border-slate-100'
                                                        : 'text-slate-400 hover:text-slate-600'
                                                        }`}
                                                >{tab.label}</button>
                                            ))}
                                        </div>

                                        {/* 动态排版面板 */}
                                        {(() => {
                                            const sizeAttr = typoTarget === 'title' ? 'titleFontSize' : typoTarget === 'desc' ? 'descFontSize' : 'dateFontSize';
                                            const weightAttr = typoTarget === 'title' ? 'titleFontWeight' : typoTarget === 'desc' ? 'descFontWeight' : 'dateFontWeight';
                                            const styleAttr = typoTarget === 'title' ? 'titleFontStyle' : typoTarget === 'desc' ? 'descFontStyle' : 'dateFontStyle';
                                            const colorAttr = typoTarget === 'title' ? 'titleColor' : typoTarget === 'desc' ? 'descColor' : 'dateColor';
                                            const fontAttr = typoTarget === 'title' ? 'titleFontFamily' : typoTarget === 'desc' ? 'descFontFamily' : 'dateFontFamily';
                                            const alignAttr = typoTarget === 'title' ? 'titleTextAlign' : typoTarget === 'desc' ? 'descTextAlign' : 'dateTextAlign';
                                            const defSize = typoTarget === 'title' ? 11 : typoTarget === 'desc' ? 9 : 10;
                                            const defColor = typoTarget === 'title' ? '#1e293b' : typoTarget === 'desc' ? '#64748b' : '#4f46e5';
                                            const curWeight = (data.events[0]?.bubbleConfig as any)?.[weightAttr];
                                            const curStyle = (data.events[0]?.bubbleConfig as any)?.[styleAttr];
                                            const curSize = (data.events[0]?.bubbleConfig as any)?.[sizeAttr] || defSize;
                                            const curColor = (data.events[0]?.bubbleConfig as any)?.[colorAttr] || defColor;
                                            const curFont = (data.events[0]?.bubbleConfig as any)?.[fontAttr] || data.events[0]?.bubbleConfig?.fontFamily || '';
                                            const curAlign = (data.events[0]?.bubbleConfig as any)?.[alignAttr] || data.events[0]?.bubbleConfig?.textAlign || 'left';

                                            return (
                                                <div className="space-y-3 animate-reveal-fast" key={typoTarget}>
                                                    <select
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[9px] font-bold outline-none shadow-sm cursor-pointer hover:border-indigo-300 transition-colors"
                                                        value={curFont}
                                                        onChange={e => setData({ ...data, events: data.events.map(ev => ({ ...ev, bubbleConfig: { ...ev.bubbleConfig, [fontAttr]: e.target.value || undefined } })) })}
                                                    >
                                                        <option value="">学术黑体</option>
                                                        <option value="'Times New Roman', serif">Times New Roman</option>
                                                        <option value="'Inter', sans-serif">Inter</option>
                                                        <option value="'SimSun', serif">宋体 (Academic)</option>
                                                    </select>

                                                    <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 items-center h-10 w-full">
                                                        <div className="flex-1 flex gap-0.5 mr-2 pr-2 border-r border-slate-200">
                                                            {(['left', 'center', 'right'] as const).map(align => (
                                                                <button
                                                                    key={align}
                                                                    onClick={() => setData({ ...data, events: data.events.map(ev => ({ ...ev, bubbleConfig: { ...ev.bubbleConfig, [alignAttr]: align } })) })}
                                                                    className={`flex-1 h-7 rounded-lg text-[8px] transition-all flex items-center justify-center ${curAlign === align ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                                                                >
                                                                    <i className={`fa-solid ${align === 'left' ? 'fa-align-left' : align === 'center' ? 'fa-align-center' : 'fa-align-right'}`}></i>
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <div className="flex gap-1 pr-2 border-r border-slate-200 mr-2">
                                                            <button
                                                                onClick={() => {
                                                                    const next = curWeight === 'bold' || curWeight === '900' ? 'normal' : 'bold';
                                                                    setData({ ...data, events: data.events.map(ev => ({ ...ev, bubbleConfig: { ...ev.bubbleConfig, [weightAttr]: next } })) });
                                                                }}
                                                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${curWeight === 'bold' || curWeight === '900' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}`}
                                                            >
                                                                <i className="fa-solid fa-bold text-[8px]"></i>
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const next = curStyle === 'italic' ? 'normal' : 'italic';
                                                                    setData({ ...data, events: data.events.map(ev => ({ ...ev, bubbleConfig: { ...ev.bubbleConfig, [styleAttr]: next } })) });
                                                                }}
                                                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${curStyle === 'italic' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-100'}`}
                                                            >
                                                                <i className="fa-solid fa-italic text-[8px]"></i>
                                                            </button>
                                                        </div>
                                                        <div className="shrink-0 flex items-center">
                                                            <ColorPickerWithPresets
                                                                color={curColor}
                                                                documentColors={ACADEMIC_COLORS}
                                                                onChange={(c) => setData({ ...data, events: data.events.map(ev => ({ ...ev, bubbleConfig: { ...ev.bubbleConfig, [colorAttr]: c } })) })}
                                                                size="sm"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center bg-slate-50 rounded-xl border border-slate-100 px-3 h-10 shadow-inner">
                                                        <span className="text-[6px] font-black text-slate-400 uppercase mr-3 shrink-0">字号</span>
                                                        <input
                                                            type="range" min="6" max="24" step="1"
                                                            className="flex-1 accent-indigo-600 h-1 min-w-0"
                                                            value={curSize}
                                                            onChange={e => { const v = parseInt(e.target.value); setData({ ...data, events: data.events.map(ev => ({ ...ev, bubbleConfig: { ...ev.bubbleConfig, [sizeAttr]: v } })) }); }}
                                                        />
                                                        <span className="w-5 text-center text-[10px] font-black text-slate-700 ml-2 shrink-0">{curSize}</span>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* 当前节点配置: Refined and dense */}
                        {activeEvent && (
                            <section className="p-3 bg-indigo-50/40 rounded-2xl border border-indigo-100 shadow-sm animate-reveal relative overflow-hidden">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">节点编辑 (ACTIVE)</label>
                                    <span className="text-[7px] font-mono font-bold text-indigo-300 opacity-60 italic">#{activeEvent.id.slice(-4)}</span>
                                </div>

                                <div className="space-y-3 px-0.5">
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <label className="text-[7px] font-black text-slate-300 uppercase ml-1">分布方向</label>
                                            <div className="flex bg-white/60 p-0.5 rounded-lg border border-indigo-100 shadow-sm pointer-events-auto overflow-hidden">
                                                {(['top', 'bottom'] as const).map(side => (
                                                    <button
                                                        key={side}
                                                        onClick={() => setData({ ...data, events: data.events.map(ev => ev.id === activeEventId ? { ...ev, side } : ev) })}
                                                        className={`flex-1 py-1 rounded text-[7px] font-black uppercase transition-all ${activeEvent.side === side ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white hover:text-slate-600'}`}
                                                    >{side === 'top' ? '上方' : '下方'}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[7px] font-black text-slate-300 uppercase ml-1">节点语义</label>
                                            <select
                                                className="w-full bg-white/60 border border-indigo-100 rounded-lg p-1 text-[8px] font-black uppercase outline-none shadow-sm cursor-pointer hover:bg-white transition-colors"
                                                value={activeEvent.type}
                                                onChange={e => setData({ ...data, events: data.events.map(ev => ev.id === activeEventId ? { ...ev, type: e.target.value as any } : ev) })}
                                            >
                                                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                                                    <option key={val} value={val}>{label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* 连接线长度 — 仅此节点 */}
                                    <div className="flex items-center bg-white/70 rounded-lg border border-indigo-100/50 px-2 h-8 shadow-sm">
                                        <span className="text-[6px] font-black text-slate-400 uppercase mr-1.5 shrink-0">连接线长度</span>
                                        <button
                                            onClick={() => setData({ ...data, events: data.events.map(ev => ev.id === activeEventId ? { ...ev, lineLength: Math.max(10, (ev.lineLength || 40) - 5) } : ev) })}
                                            className="w-4 h-5 rounded hover:bg-indigo-50 text-slate-400 flex items-center justify-center transition-colors"
                                        ><i className="fa-solid fa-minus text-[6px]"></i></button>
                                        <input
                                            type="number"
                                            className="flex-1 min-w-0 bg-transparent text-[9px] font-black text-indigo-600 outline-none text-center"
                                            value={activeEvent.lineLength || 40}
                                            onChange={e => setData({ ...data, events: data.events.map(ev => ev.id === activeEventId ? { ...ev, lineLength: Math.max(10, +e.target.value || 40) } : ev) })}
                                        />
                                        <button
                                            onClick={() => setData({ ...data, events: data.events.map(ev => ev.id === activeEventId ? { ...ev, lineLength: (ev.lineLength || 40) + 5 } : ev) })}
                                            className="w-4 h-5 rounded hover:bg-indigo-50 text-slate-400 flex items-center justify-center transition-colors"
                                        ><i className="fa-solid fa-plus text-[6px]"></i></button>
                                        <span className="text-[6px] text-slate-300 font-bold ml-0.5">px</span>
                                    </div>

                                    {/* 图片上传: Compact preview */}
                                    <div className="space-y-1">
                                        <label className="text-[7px] font-black text-slate-300 uppercase ml-1">示意图上传 (IMAGE)</label>
                                        {activeEvent.mediaUrl ? (
                                            <div className="relative group rounded-xl overflow-hidden border-2 border-white shadow-sm bg-slate-50 aspect-[16/6] transition-all hover:ring-2 hover:ring-indigo-200">
                                                <img src={activeEvent.mediaUrl} className="w-full h-full object-cover" alt="preview" />
                                                <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-[1px]">
                                                    <button onClick={() => fileInputRef.current?.click()} className="w-7 h-7 rounded-lg bg-white text-indigo-600 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all"><i className="fa-solid fa-sync text-[10px]"></i></button>
                                                    <button onClick={() => props.setData({ ...data!, events: data!.events.map(ev => ev.id === activeEventId ? { ...ev, mediaUrl: undefined } : ev) })} className="w-7 h-7 rounded-lg bg-white text-rose-500 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all"><i className="fa-solid fa-trash text-[10px]"></i></button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-full py-2.5 border border-dashed border-indigo-200 rounded-xl flex items-center justify-center gap-2 text-indigo-400 hover:border-indigo-400 hover:bg-white transition-all bg-white/40 shadow-sm"
                                            >
                                                <i className="fa-solid fa-cloud-arrow-up text-xs opacity-60"></i>
                                                <span className="text-[8px] font-black uppercase">上传示意图 (PNG/JPG)</span>
                                            </button>
                                        )}
                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                                    </div>

                                    <DateNavigator
                                        activeEvent={activeEvent}
                                        onDateChange={(date) => setData({ ...data, events: data.events.map(ev => ev.id === activeEventId ? { ...ev, date } : ev) })}
                                    />
                                </div>
                            </section>
                        )}

                        {/* 跨节点关联连线 (CROSS-LINKS) */}
                        <section className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <i className="fa-solid fa-bezier-curve text-violet-400 text-[9px]"></i> 因果关联线 (LINKS)
                                </label>
                                <button
                                    onClick={() => {
                                        if (data.events.length < 2) return;
                                        const newLink: TimelineCrossLink = {
                                            id: `cl_${Date.now()}`,
                                            fromId: data.events[0].id,
                                            toId: data.events[data.events.length > 1 ? 1 : 0].id,
                                            label: '影响',
                                            color: '#8b5cf6',
                                            style: 'dashed',
                                            width: 1.5
                                        };
                                        setData({ ...data, crossLinks: [...(data.crossLinks || []), newLink] });
                                    }}
                                    disabled={data.events.length < 2}
                                    className="px-2 py-0.5 bg-violet-50 text-violet-600 rounded-md text-[7px] font-black uppercase hover:bg-violet-600 hover:text-white transition-all disabled:opacity-30"
                                >
                                    <i className="fa-solid fa-plus mr-0.5"></i> 新建
                                </button>
                            </div>

                            {(!data.crossLinks || data.crossLinks.length === 0) ? (
                                <p className="text-[8px] text-slate-300 italic text-center py-2">暂无关联线，点击"新建"添加</p>
                            ) : (
                                <div className="space-y-2">
                                    {data.crossLinks.map((link, idx) => {
                                        const fromEv = data.events.find(e => e.id === link.fromId);
                                        const toEv = data.events.find(e => e.id === link.toId);
                                        return (
                                            <div key={link.id} className="bg-violet-50/50 rounded-xl border border-violet-100 p-2 space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[7px] font-black text-violet-600 uppercase">Link #{idx + 1}</span>
                                                    <button
                                                        onClick={() => setData({ ...data, crossLinks: data.crossLinks!.filter(l => l.id !== link.id) })}
                                                        className="w-5 h-5 rounded bg-white text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all shadow-sm"
                                                    >
                                                        <i className="fa-solid fa-trash-can text-[7px]"></i>
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-1">
                                                    <select
                                                        className="bg-white border border-violet-100 rounded-lg p-1 text-[7px] font-bold outline-none"
                                                        value={link.fromId}
                                                        onChange={e => {
                                                            const updated = data.crossLinks!.map(l => l.id === link.id ? { ...l, fromId: e.target.value } : l);
                                                            setData({ ...data, crossLinks: updated });
                                                        }}
                                                    >
                                                        {data.events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                                                    </select>
                                                    <select
                                                        className="bg-white border border-violet-100 rounded-lg p-1 text-[7px] font-bold outline-none"
                                                        value={link.toId}
                                                        onChange={e => {
                                                            const updated = data.crossLinks!.map(l => l.id === link.id ? { ...l, toId: e.target.value } : l);
                                                            setData({ ...data, crossLinks: updated });
                                                        }}
                                                    >
                                                        {data.events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex gap-1 items-center">
                                                    <input
                                                        className="flex-1 bg-white border border-violet-100 rounded-lg px-1.5 py-0.5 text-[8px] font-bold outline-none"
                                                        value={link.label || ''}
                                                        placeholder="标签..."
                                                        onChange={e => {
                                                            const updated = data.crossLinks!.map(l => l.id === link.id ? { ...l, label: e.target.value } : l);
                                                            setData({ ...data, crossLinks: updated });
                                                        }}
                                                    />
                                                    <div className="flex bg-white p-0.5 rounded-md border border-violet-100">
                                                        {(['solid', 'dashed', 'dotted'] as const).map(s => (
                                                            <button
                                                                key={s}
                                                                onClick={() => {
                                                                    const updated = data.crossLinks!.map(l => l.id === link.id ? { ...l, style: s } : l);
                                                                    setData({ ...data, crossLinks: updated });
                                                                }}
                                                                className={`px-1 py-0.5 rounded text-[6px] font-black uppercase transition-all ${link.style === s ? 'bg-violet-600 text-white' : 'text-slate-400'}`}
                                                            >
                                                                {s === 'solid' ? '━' : s === 'dashed' ? '┅' : '┈'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <ColorPickerWithPresets
                                                        color={link.color || '#8b5cf6'}
                                                        documentColors={['#8b5cf6', '#6366f1', '#ec4899', '#10b981', '#f59e0b']}
                                                        onChange={(c) => {
                                                            const updated = data.crossLinks!.map(l => l.id === link.id ? { ...l, color: c } : l);
                                                            setData({ ...data, crossLinks: updated });
                                                        }}
                                                        size="xs"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {/* 列表管理: With reorder */}
                        <section className="space-y-3 pt-1 border-t border-slate-50">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                                    <i className="fa-solid fa-layer-group text-slate-300"></i> 研究节点列表
                                </label>
                                <button onClick={onAddEvent} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[7px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">
                                    <i className="fa-solid fa-plus-circle mr-1"></i> 新增节点
                                </button>
                            </div>
                            <div className="bg-slate-50/50 rounded-2xl p-0.5 border border-slate-100">
                                {/* Enhanced Event List with reorder */}
                                <div className="space-y-1.5 mt-2">
                                    {data.events.map((ev, idx) => (
                                        <div
                                            key={ev.id}
                                            onClick={() => {
                                                const el = document.getElementById(`node-${ev.id}`);
                                                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                props.setActiveEventId(ev.id);
                                            }}
                                            className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group cursor-pointer ${activeEventId === ev.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-600 hover:bg-white hover:border-slate-200'}`}
                                        >
                                            {/* Reorder buttons */}
                                            <div className="flex flex-col gap-0.5 mr-2 shrink-0" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => {
                                                        if (idx === 0) return;
                                                        const newEvents = [...data.events];
                                                        [newEvents[idx], newEvents[idx - 1]] = [newEvents[idx - 1], newEvents[idx]];
                                                        setData({ ...data, events: newEvents });
                                                    }}
                                                    disabled={idx === 0}
                                                    className={`w-4 h-4 flex items-center justify-center rounded transition-all disabled:opacity-20 ${activeEventId === ev.id ? 'text-white/60 hover:text-white' : 'text-slate-300 hover:text-indigo-500'}`}
                                                >
                                                    <i className="fa-solid fa-chevron-up text-[6px]"></i>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (idx === data.events.length - 1) return;
                                                        const newEvents = [...data.events];
                                                        [newEvents[idx], newEvents[idx + 1]] = [newEvents[idx + 1], newEvents[idx]];
                                                        setData({ ...data, events: newEvents });
                                                    }}
                                                    disabled={idx === data.events.length - 1}
                                                    className={`w-4 h-4 flex items-center justify-center rounded transition-all disabled:opacity-20 ${activeEventId === ev.id ? 'text-white/60 hover:text-white' : 'text-slate-300 hover:text-indigo-500'}`}
                                                >
                                                    <i className="fa-solid fa-chevron-down text-[6px]"></i>
                                                </button>
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <p className="text-[10px] font-black uppercase truncate">{ev.title}</p>
                                                <p className={`text-[7px] font-bold ${activeEventId === ev.id ? 'text-indigo-200' : 'text-slate-400'}`}>{ev.date}</p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onDeleteEvent(ev.id); }}
                                                    className={`w-7 h-7 rounded-lg transition-all flex items-center justify-center opacity-0 group-hover:opacity-100 ${activeEventId === ev.id ? 'bg-white/10 text-white hover:bg-rose-500' : 'bg-white text-rose-400 border border-slate-100 hover:bg-rose-500 hover:text-white'}`}
                                                    title="删除节点"
                                                >
                                                    <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                </button>
                                                <i className={`fa-solid fa-chevron-right text-[8px] opacity-40 group-hover:opacity-0 ${activeEventId === ev.id ? 'hidden' : ''}`}></i>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>
                )}
            </div>

            {/* 辅助工具: 导出 - Added */}
            {data && (
                <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex gap-2 no-print">
                    <button
                        onClick={props.onExportPng}
                        className="flex-1 py-2.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95"
                    >
                        <i className="fa-solid fa-file-image"></i>
                        导出 PNG 图片
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="w-10 h-10 bg-white text-slate-400 border border-slate-200 rounded-xl flex items-center justify-center hover:text-indigo-600 transition-all shadow-sm active:scale-95"
                        title="打印"
                    >
                        <i className="fa-solid fa-print"></i>
                    </button>
                </div>
            )}

            <TimelineLibraryModal
                show={showLibrary}
                onClose={() => setShowLibrary(false)}
                savedTimelines={savedTimelines}
                onLoad={onLoadSaved}
                onDelete={onDeleteSaved}
                onRename={props.onRenameSaved}
                onCategoryChange={props.onCategoryChange}
                showSaveModal={props.showSaveModal}
                setShowSaveModal={props.setShowSaveModal}
                saveTitle={props.saveTitle}
                setSaveTitle={props.setSaveTitle}
                onSave={props.onConfirmSave}
            />
        </aside>
    );
};