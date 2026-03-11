
import React, { useMemo, useRef, useState } from 'react';
import { SUB_DIGITS, SUP_DIGITS, smartConvertChemistry } from '../../../utils/scientificText';
import { ExperimentFile } from '../../../types';

interface LogBasicInfoProps {
    logContent: string;
    setLogContent: (val: string) => void;
    logDescription: string;
    setLogDescription: (val: string) => void;
    isExtracting: boolean;
    handleAiExtract: () => void;
    samplePhoto?: ExperimentFile;
    samplePhotoInputRef: React.RefObject<HTMLInputElement | null>;
    handleSamplePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isAnalyzingSample: boolean;
    handleAnalyzeSampleAppearance: () => void;
    sampleAppearanceInsight: string;
    // 实验组分组
    groupId?: string;
    groupLabel?: string;
    onGroupChange: (groupId: string | undefined, groupLabel: string | undefined) => void;
    existingGroups: { id: string; label: string }[];
}

export const LogBasicInfo: React.FC<LogBasicInfoProps> = ({
    logContent, setLogContent, logDescription, setLogDescription, isExtracting, handleAiExtract,
    samplePhoto, samplePhotoInputRef, handleSamplePhotoUpload, isAnalyzingSample, handleAnalyzeSampleAppearance, sampleAppearanceInsight,
    groupId, groupLabel, onGroupChange, existingGroups
}) => {
    const [subMode, setSubMode] = useState(false);
    const [activeTarget, setActiveTarget] = useState<'title' | 'desc'>('title');
    const [panelOpen, setPanelOpen] = useState(false);
    const [sampleInsightOpen, setSampleInsightOpen] = useState(false);
    // 实验组新建模式
    const [creatingGroup, setCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');

    // --- 智能解析意图标签与配色 ---
    const intentInfo = useMemo(() => {
        if (!logContent) return null;
        const robustRegex = /Robust|稳健|验证/i;
        const aggressiveRegex = /Aggressive|激进|极端/i;
        const explorerRegex = /Explorer|探索|冷区/i;
        if (aggressiveRegex.test(logContent)) {
            return { label: '激进优化点 (Aggressive)', color: 'bg-rose-600 border-rose-500', icon: 'fa-bolt-lightning' };
        }
        if (robustRegex.test(logContent)) {
            return { label: '稳健验证点 (Robust)', color: 'bg-indigo-600 border-indigo-500', icon: 'fa-check-double' };
        }
        if (explorerRegex.test(logContent)) {
            return { label: '模型探索点 (Explorer)', color: 'bg-amber-500 border-amber-400', icon: 'fa-compass' };
        }
        return null;
    }, [logContent]);

    const contentInputRef = useRef<HTMLInputElement>(null);
    const descInputRef = useRef<HTMLTextAreaElement>(null);

    // 保存光标位置，防止按钮点击导致失焦后位置丢失
    const savedDescCursor = useRef<number | null>(null);
    const savedTitleCursor = useRef<number | null>(null);

    const saveTitleCursor = () => {
        savedTitleCursor.current = contentInputRef.current?.selectionStart ?? null;
    };
    const saveDescCursor = () => {
        savedDescCursor.current = descInputRef.current?.selectionStart ?? null;
    };

    // 通用：在当前活跃输入框的光标处插入字符
    const insertChar = (char: string) => {
        if (activeTarget === 'title') {
            const input = contentInputRef.current;
            const cursorPos = savedTitleCursor.current ?? logContent.length;
            const newText = logContent.substring(0, cursorPos) + char + logContent.substring(cursorPos);
            setLogContent(newText);
            const newCursorPos = cursorPos + char.length;
            savedTitleCursor.current = newCursorPos;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    input?.focus();
                    input?.setSelectionRange(newCursorPos, newCursorPos);
                });
            });
        } else {
            const input = descInputRef.current;
            const cursorPos = savedDescCursor.current ?? logDescription.length;
            const newText = logDescription.substring(0, cursorPos) + char + logDescription.substring(cursorPos);
            setLogDescription(newText);
            const newCursorPos = cursorPos + char.length;
            savedDescCursor.current = newCursorPos;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    input?.focus();
                    input?.setSelectionRange(newCursorPos, newCursorPos);
                });
            });
        }
    };

    // 一键智能转换
    const handleSmartConvert = () => {
        setLogContent(smartConvertChemistry(logContent));
        setLogDescription(smartConvertChemistry(logDescription));
    };

    // 下标/上标数字键盘
    const digitMap = subMode ? SUB_DIGITS : SUP_DIGITS;
    const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '-'];

    // 常用符号
    const symbols = [
        { label: '°C', char: '°C' },
        { label: 'α', char: 'α' },
        { label: 'β', char: 'β' },
        { label: 'γ', char: 'γ' },
        { label: 'δ', char: 'δ' },
        { label: 'μ', char: 'μ' },
        { label: 'Δ', char: 'Δ' },
        { label: '±', char: '±' },
        { label: '→', char: '→' },
        { label: '·', char: '·' },
    ];

    return (
        <div className="space-y-5">
            <div>
                <div className="flex justify-between items-end mb-2 px-1">
                    <label className="text-xs font-black text-slate-950 uppercase block italic tracking-tight">RUN 标识 / 实验名称</label>
                    {intentInfo && (
                        <div className={`flex items-center gap-1.5 ${intentInfo.color} text-white px-3 py-1 rounded-full shadow-lg animate-reveal border`}>
                            <i className={`fa-solid ${intentInfo.icon} text-[10px]`}></i>
                            <span className="text-[9px] font-black uppercase tracking-widest">{intentInfo.label}</span>
                        </div>
                    )}
                </div>
                <input
                    ref={contentInputRef}
                    autoFocus
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-lg font-black text-indigo-700 outline-none shadow-inner focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300"
                    placeholder="例: FeNi₂O₄-LDH 共沉淀法合成..."
                    value={logContent}
                    onChange={e => { setLogContent(e.target.value); savedTitleCursor.current = e.target.selectionStart; }}
                    onFocus={() => setActiveTarget('title')}
                    onBlur={saveTitleCursor}
                    onSelect={saveTitleCursor}
                />
            </div>

            {/* 实验组选择器 */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 shadow-inner">
                <div className="flex items-center gap-2 mb-2">
                    <i className="fa-solid fa-layer-group text-indigo-400 text-[10px]"></i>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">实验组 (EXPERIMENT GROUP)</span>
                    {groupId && (
                        <span className="ml-auto text-[7px] font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full uppercase">
                            已分组
                        </span>
                    )}
                </div>
                {!creatingGroup ? (
                    <div className="flex gap-2">
                        <select
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer"
                            value={groupId || ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                    onGroupChange(undefined, undefined);
                                } else {
                                    const found = existingGroups.find(g => g.id === val);
                                    onGroupChange(val, found?.label);
                                }
                            }}
                        >
                            <option value="">无分组（独立记录）</option>
                            {existingGroups.map(g => (
                                <option key={g.id} value={g.id}>{g.label}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => { setCreatingGroup(true); setNewGroupName(''); }}
                            className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all flex items-center gap-1.5 shrink-0"
                            title="新建实验组"
                        >
                            <i className="fa-solid fa-plus"></i> 新建
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2 animate-reveal">
                        <input
                            autoFocus
                            className="flex-1 bg-white border-2 border-indigo-300 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                            placeholder="输入实验组名，例如：碱液浓度梯度"
                            value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && newGroupName.trim()) {
                                    const id = `grp_${Date.now()}`;
                                    onGroupChange(id, newGroupName.trim());
                                    setCreatingGroup(false);
                                }
                                if (e.key === 'Escape') setCreatingGroup(false);
                            }}
                        />
                        <button
                            type="button"
                            disabled={!newGroupName.trim()}
                            onClick={() => {
                                const id = `grp_${Date.now()}`;
                                onGroupChange(id, newGroupName.trim());
                                setCreatingGroup(false);
                            }}
                            className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all disabled:opacity-40 shrink-0"
                        >
                            确认
                        </button>
                        <button
                            type="button"
                            onClick={() => setCreatingGroup(false)}
                            className="px-3 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all shrink-0"
                        >
                            取消
                        </button>
                    </div>
                )}
                {groupId && groupLabel && (
                    <div className="mt-2 flex items-center gap-1.5">
                        <i className="fa-solid fa-circle-check text-indigo-400 text-[9px]"></i>
                        <span className="text-[9px] font-bold text-indigo-600 truncate">当前组：{groupLabel}</span>
                        <button
                            type="button"
                            onClick={() => onGroupChange(undefined, undefined)}
                            className="ml-auto text-[8px] font-black text-slate-400 hover:text-rose-500 transition-all uppercase"
                        >
                            <i className="fa-solid fa-xmark"></i> 解除
                        </button>
                    </div>
                )}
            </div>
            <div>
                <div className="flex justify-between items-center mb-2 px-1">
                    <label className="text-xs font-black text-slate-950 uppercase block italic tracking-tight">实验记录描述 (OBSERVATION)</label>
                    {logDescription.includes('设计意图溯源') && (
                        <span className="text-[8px] font-black text-emerald-600 uppercase flex items-center gap-1">
                            <i className="fa-solid fa-link"></i> 意图已溯源
                        </span>
                    )}
                </div>
                <div className="relative group">
                    <textarea
                        ref={descInputRef}
                        className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-medium text-slate-700 outline-none h-48 shadow-inner resize-none leading-relaxed focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-200"
                        placeholder="详细记录实验过程、现象、操作细节及初步结论..."
                        value={logDescription}
                        onChange={e => { setLogDescription(e.target.value); savedDescCursor.current = e.target.selectionStart; }}
                        onFocus={() => setActiveTarget('desc')}
                        onBlur={saveDescCursor}
                        onSelect={saveDescCursor}
                    />
                    <div className="absolute top-4 right-4 opacity-[0.03] pointer-events-none group-focus-within:opacity-0 transition-opacity">
                        <i className="fa-solid fa-align-left text-5xl"></i>
                    </div>
                </div>
                <button onClick={handleAiExtract} disabled={isExtracting || !logDescription.trim()} className="mt-2 text-[10px] font-black text-indigo-700 uppercase flex items-center gap-2 hover:underline disabled:opacity-30 transition-all active:scale-95">
                    {isExtracting ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles text-sm"></i>}
                    AI 自动捕捉描述中的数值指标
                </button>
            </div>

            <div>
                <div className="flex justify-between items-center mb-2 px-1">
                    <label className="text-xs font-black text-slate-950 uppercase block italic tracking-tight">样品照片 (SAMPLE PHOTO)</label>
                    {samplePhoto && <span className="text-[8px] font-black text-emerald-600 uppercase">已上传</span>}
                </div>
                <input
                    ref={samplePhotoInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleSamplePhotoUpload}
                />

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 shadow-inner">
                    {samplePhoto?.url ? (
                        <div className="w-full h-36 rounded-xl overflow-hidden bg-slate-200 shadow-inner border border-slate-100">
                            <img src={samplePhoto.url} alt={samplePhoto.name || 'sample-photo'} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-full h-24 rounded-xl border border-dashed border-slate-300 bg-white/80 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            暂无样品照片
                        </div>
                    )}
                </div>

                {/* 按钮显式固定在样品照片卡片外层下方 */}
                <div className="mt-2 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-2">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => samplePhotoInputRef.current?.click()}
                            className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:border-indigo-300 hover:text-indigo-600 transition-all"
                        >
                            <i className="fa-solid fa-image mr-1.5"></i> 上传样品
                        </button>
                        <button
                            type="button"
                            onClick={handleAnalyzeSampleAppearance}
                            disabled={isAnalyzingSample || !samplePhoto}
                            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all disabled:opacity-40"
                        >
                            {isAnalyzingSample ? <i className="fa-solid fa-spinner animate-spin mr-1.5"></i> : <i className="fa-solid fa-microscope mr-1.5"></i>}
                            AI 表观分析
                        </button>
                    </div>
                </div>

                {sampleAppearanceInsight && (
                    <div className="mt-2 rounded-2xl border border-indigo-100 bg-white overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setSampleInsightOpen(v => !v)}
                            className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-indigo-50/40 transition-all"
                        >
                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
                                <i className="fa-solid fa-microscope"></i> 样品表观分析结果
                            </span>
                            <i className={`fa-solid ${sampleInsightOpen ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px] text-indigo-300`}></i>
                        </button>
                        {sampleInsightOpen && (
                            <div className="px-3 pb-3">
                                <div className="rounded-xl border border-indigo-50 bg-slate-50 p-3">
                                    <p className="text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap">{sampleAppearanceInsight}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 统一快捷输入面板 */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setPanelOpen(!panelOpen)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-100/50 transition-all rounded-2xl cursor-pointer"
                >
                    <div className="flex items-center gap-2">
                        <i className="fa-solid fa-keyboard text-indigo-400 text-[10px]"></i>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">科学符号面板</span>
                        <i className={`fa-solid fa-chevron-down text-[8px] text-slate-300 transition-transform ${panelOpen ? 'rotate-180' : ''}`}></i>
                    </div>
                    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <span className="text-[8px] font-bold text-slate-300 italic">
                            {activeTarget === 'title' ? '输入到 → 标题' : '输入到 → 描述'}
                        </span>
                        <button
                            type="button"
                            onClick={handleSmartConvert}
                            className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase shadow-md hover:bg-black transition-all active:scale-95"
                            title="自动识别化学式并转换上下标"
                        >
                            <i className="fa-solid fa-wand-magic-sparkles text-amber-300 text-[8px]"></i>
                            一键转换
                        </button>
                    </div>
                </div>

                {panelOpen && <div className="px-3 pb-3 space-y-2.5">

                    {/* 上下标数字键盘 */}
                    <div className="flex items-center gap-2">
                        <div className="flex bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm shrink-0">
                            <button
                                type="button"
                                onClick={() => setSubMode(true)}
                                className={`px-3 py-1.5 text-[10px] font-black transition-all ${subMode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}
                            >
                                A₂ 下标
                            </button>
                            <button
                                type="button"
                                onClick={() => setSubMode(false)}
                                className={`px-3 py-1.5 text-[10px] font-black transition-all ${!subMode ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}
                            >
                                A² 上标
                            </button>
                        </div>
                        <div className="flex gap-0.5 flex-wrap flex-1">
                            {digits.map(d => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => insertChar(digitMap[d] || d)}
                                    className={`w-7 h-7 rounded-lg text-[12px] font-black transition-all active:scale-90 shadow-sm border ${subMode
                                        ? 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50'
                                        : 'bg-white border-violet-200 text-violet-700 hover:bg-violet-50'
                                        }`}
                                >
                                    {digitMap[d] || d}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 常用符号 */}
                    <div className="flex items-center gap-1 flex-wrap">
                        {symbols.map((s, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => insertChar(s.char)}
                                className="h-7 min-w-[32px] px-2 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all active:scale-95 shadow-sm"
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>}
            </div>
        </div>
    );
};
