
import React, { useState, useRef, useEffect } from 'react';
import { TransformationProposal, RouteCategory } from '../../../types';

interface RouteActionsProps {
    prop: TransformationProposal;
    hasAudit: boolean;
    isAuditing: boolean;
    getOverallStatus: () => string | null;
    isExpanded: boolean;
    isCurrentlyEditing: boolean;
    onRunAudit: () => void;
    onToggleAudit: () => void;
    onToggleExpansion: () => void;
    onSourceLink: () => void;
    onAddSub: () => void;
    onStartEdit: () => void;
    onSaveEdit: () => void;
    onDelete: () => void;
    score: number;
    badgeColor: string;
    onLinkPlan?: () => void;
    onPushToLab?: () => void;
    onSaveAsTemplate?: (prop: TransformationProposal) => void;
    onOpenDebate?: () => void;
    hasDebate?: boolean;
    onMenuOpenChange?: (open: boolean) => void;
    availableCategories?: RouteCategory[];
    onChangeCategory?: (categoryId: string | undefined) => void;
    onAddToCollector?: () => void;
}

export const RouteActions: React.FC<RouteActionsProps> = ({
    prop, hasAudit, isAuditing, getOverallStatus, isExpanded, isCurrentlyEditing,
    onRunAudit, onToggleAudit, onToggleExpansion, onSourceLink, onAddSub, onStartEdit, onSaveEdit, onDelete,
    score, onLinkPlan, onPushToLab, onSaveAsTemplate, onOpenDebate, hasDebate, onMenuOpenChange,
    availableCategories, onChangeCategory, onAddToCollector
}) => {
    const [exportCopied, setExportCopied] = useState(false);
    const [templateSaved, setTemplateSaved] = useState(false);
    const [showPushMenu, setShowPushMenu] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const pushRef = useRef<HTMLDivElement>(null);
    const moreRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭菜单
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (pushRef.current && !pushRef.current.contains(e.target as Node)) setShowPushMenu(false);
            if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMoreMenu(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 通知父组件菜单开关状态
    useEffect(() => {
        onMenuOpenChange?.(showPushMenu || showMoreMenu);
    }, [showPushMenu, showMoreMenu]);

    const localBadgeColor = score >= 80 ? 'bg-emerald-500'
        : score >= 50 ? 'bg-amber-500'
            : 'bg-rose-500';

    const localBadgeBorder = score >= 80 ? 'ring-emerald-500/20'
        : score >= 50 ? 'ring-amber-500/20'
            : 'ring-rose-500/20';

    // ═══ 导出实验方案为结构化文本 ═══
    const handleExport = (e: React.MouseEvent) => {
        e.stopPropagation();
        const steps = (prop.newFlowchart || []).map((s, i) => `  ${i + 1}. ${s.step}\n     操作: ${s.action}`).join('\n');
        const allParams = [...(prop.optimizedParameters || []), ...(prop.controlParameters || [])];
        const paramsText = allParams.map(p => `  • ${p.key}: ${p.value} (${p.reason})`).join('\n');

        const processText = `${prop.processChanges || ''} ${(prop.newFlowchart || []).map(s => s.action).join(' ')}`;
        const HIGH_RISK = ['高压', '氢气', '剧毒', '浓硝酸', '浓硫酸', 'HF', '氢氟酸'];
        const MED_RISK = ['高温', '还原剂', '有机溶剂', '纳米', '强碱'];
        const detectedHigh = HIGH_RISK.filter(kw => processText.includes(kw));
        const detectedMed = MED_RISK.filter(kw => processText.includes(kw));
        const safetySection = detectedHigh.length > 0 || detectedMed.length > 0
            ? `\n\n⚠ 安全须知\n${detectedHigh.map(kw => `  🔴 [CRITICAL] ${kw} — 需特殊防护`).join('\n')}${detectedMed.length > 0 ? '\n' + detectedMed.map(kw => `  🟡 [WARNING] ${kw} — 标准防护`).join('\n') : ''}`
            : '\n\n✅ 安全须知: 未检测到高危因子';

        const exportText = `═══════════════════════════════════
  实验方案导出 — ${prop.title}
═══════════════════════════════════

📋 基本信息
  方案名称: ${prop.title}
  创建时间: ${prop.timestamp}
  来源文献: ${prop.literatureTitle}
  可行性评分: ${score}/100

🔬 科学假设
  ${prop.scientificHypothesis || '未设定'}

🔄 工艺变更
  ${prop.processChanges || '未描述'}

📝 实验步骤
${steps || '  (无步骤)'}

📊 关键参数
${paramsText || '  (无参数)'}${safetySection}

───────────────────────────────────
  导出时间: ${new Date().toLocaleString()}
  SciFlow Pro — 智能科研管理平台
`;
        navigator.clipboard.writeText(exportText).then(() => {
            setExportCopied(true);
            setTimeout(() => setExportCopied(false), 2000);
        });
        setShowMoreMenu(false);
    };

    const handleSaveTemplate = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSaveAsTemplate?.(prop);
        setTemplateSaved(true);
        setTimeout(() => setTemplateSaved(false), 2000);
        setShowMoreMenu(false);
    };

    // ═══ 菜单项组件 ═══
    const MenuItem = ({ icon, label, onClick, color = 'text-slate-600', danger = false }: {
        icon: string; label: string; onClick: (e: React.MouseEvent) => void; color?: string; danger?: boolean;
    }) => (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left text-[11px] font-bold transition-all rounded-lg ${
                danger
                    ? 'text-rose-500 hover:bg-rose-50 hover:text-rose-600'
                    : `${color} hover:bg-slate-50 hover:text-slate-900`
            }`}
        >
            <i className={`fa-solid ${icon} text-[10px] w-4 text-center opacity-70`}></i>
            {label}
        </button>
    );

    return (
        <div className="flex items-center gap-1.5 relative z-30 shrink-0">
            {/* ── 1. 精简可行性评分色块 ── */}
            <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-sm ring-2 ${localBadgeColor} ${localBadgeBorder}`}
                title={`可行性评分: ${score}/100`}
            >
                {score}
            </div>

            {/* ── 2. 资源对标 ── */}
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); hasAudit ? onToggleAudit() : onRunAudit(); }}
                className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center relative ${
                    hasAudit
                        ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                        : 'text-slate-300 hover:text-indigo-500 hover:bg-slate-50'
                }`}
                title="资源供应对标审计"
            >
                {isAuditing ? <i className="fa-solid fa-spinner animate-spin text-xs"></i> : <i className="fa-solid fa-warehouse text-xs"></i>}
                {hasAudit && (
                    <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${getOverallStatus()}`}></span>
                )}
            </button>

            {/* ── 3. 方案辩论 ── */}
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenDebate?.(); }}
                className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center relative ${
                    hasDebate
                        ? 'bg-violet-50 text-violet-600 hover:bg-violet-100'
                        : 'text-slate-300 hover:text-violet-500 hover:bg-slate-50'
                }`}
                title="AI 专家方案辩论"
            >
                <i className="fa-solid fa-comments text-xs"></i>
                {hasDebate && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-violet-400 animate-pulse"></span>
                )}
            </button>

            {/* ── 4. 推送下拉按钮 ── */}
            <div ref={pushRef} className="relative">
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowPushMenu(!showPushMenu); setShowMoreMenu(false); }}
                    className="h-8 px-3 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase shadow-sm hover:bg-indigo-700 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                    title="推送方案"
                >
                    <i className="fa-solid fa-paper-plane text-[9px]"></i>
                    推送
                    <i className={`fa-solid fa-chevron-down text-[7px] ml-0.5 transition-transform ${showPushMenu ? 'rotate-180' : ''}`}></i>
                </button>
                {showPushMenu && (
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-50 animate-reveal">
                        <MenuItem
                            icon="fa-table-cells"
                            label="推送到实验矩阵"
                            color="text-indigo-600"
                            onClick={(e) => { e.stopPropagation(); onLinkPlan?.(); setShowPushMenu(false); }}
                        />
                        <MenuItem
                            icon="fa-flask-vial"
                            label="推送到实验室预演"
                            color="text-emerald-600"
                            onClick={(e) => { e.stopPropagation(); onPushToLab?.(); setShowPushMenu(false); }}
                        />
                        <div className="my-1 mx-2 border-t border-slate-100"></div>
                        {onAddToCollector && (
                            <MenuItem
                                icon="fa-basket-shopping"
                                label="添加到实验计划"
                                color="text-teal-600"
                                onClick={(e) => { e.stopPropagation(); onAddToCollector(); setShowPushMenu(false); }}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* ── 5. 三点溢出菜单 ── */}
            <div ref={moreRef} className="relative">
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowMoreMenu(!showMoreMenu); setShowPushMenu(false); }}
                    className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center ${
                        showMoreMenu ? 'bg-slate-100 text-slate-700' : 'text-slate-300 hover:text-slate-600 hover:bg-slate-50'
                    }`}
                    title="更多操作"
                >
                    <i className="fa-solid fa-ellipsis-vertical text-sm"></i>
                </button>
                {showMoreMenu && (
                    <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-50 animate-reveal">
                        {prop.literatureId && !['FLOW_GEN', 'MANUAL'].includes(prop.literatureId) && (
                            <MenuItem
                                icon="fa-book-open"
                                label="溯源至情报档案"
                                color="text-amber-600"
                                onClick={(e) => { e.stopPropagation(); onSourceLink(); setShowMoreMenu(false); }}
                            />
                        )}
                        <MenuItem
                            icon="fa-code-branch"
                            label="新建分支路线"
                            color="text-emerald-600"
                            onClick={(e) => { e.stopPropagation(); onAddSub(); setShowMoreMenu(false); }}
                        />
                        <MenuItem
                            icon={exportCopied ? 'fa-check' : 'fa-file-export'}
                            label={exportCopied ? '已复制到剪贴板' : '导出实验方案'}
                            color="text-violet-600"
                            onClick={handleExport}
                        />
                        <MenuItem
                            icon={templateSaved ? 'fa-check' : 'fa-bookmark'}
                            label={templateSaved ? '已保存为模板' : '保存为模板'}
                            color="text-sky-600"
                            onClick={handleSaveTemplate}
                        />

                        {/* ── 分类管理 ── */}
                        {availableCategories && availableCategories.length > 0 && (
                            <>
                                <div className="my-1 mx-2 border-t border-slate-100"></div>
                                <div className="px-3.5 py-1.5">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">更改分类</span>
                                </div>
                                {availableCategories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={(e) => { e.stopPropagation(); onChangeCategory?.(cat.id); setShowMoreMenu(false); }}
                                        className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[11px] font-bold transition-all rounded-lg hover:bg-slate-50 ${
                                            prop.category === cat.id ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'
                                        }`}
                                    >
                                        <i className={`fa-solid ${cat.icon} text-[9px] w-3.5 text-center`}></i>
                                        {cat.name}
                                        {prop.category === cat.id && <i className="fa-solid fa-check text-[8px] ml-auto text-indigo-500"></i>}
                                    </button>
                                ))}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onChangeCategory?.(undefined); setShowMoreMenu(false); }}
                                    className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-[11px] font-bold transition-all rounded-lg hover:bg-slate-50 ${
                                        !prop.category ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-400'
                                    }`}
                                >
                                    <i className="fa-solid fa-folder-open text-[9px] w-3.5 text-center"></i>
                                    未分类
                                    {!prop.category && <i className="fa-solid fa-check text-[8px] ml-auto text-indigo-500"></i>}
                                </button>
                            </>
                        )}

                        <div className="my-1 mx-2 border-t border-slate-100"></div>

                        {isCurrentlyEditing ? (
                            <MenuItem
                                icon="fa-check"
                                label="完成编辑"
                                color="text-emerald-600"
                                onClick={(e) => { e.stopPropagation(); onSaveEdit(); setShowMoreMenu(false); }}
                            />
                        ) : (
                            <MenuItem
                                icon="fa-pen-nib"
                                label="编辑路线内容"
                                color="text-indigo-600"
                                onClick={(e) => { e.stopPropagation(); onStartEdit(); setShowMoreMenu(false); }}
                            />
                        )}

                        <div className="my-1 mx-2 border-t border-slate-100"></div>

                        <MenuItem
                            icon="fa-trash-can"
                            label="删除此路线"
                            danger
                            onClick={(e) => { e.stopPropagation(); onDelete(); setShowMoreMenu(false); }}
                        />
                    </div>
                )}
            </div>

            {/* ── 6. 展开/收起箭头 ── */}
            <div className="w-7 flex justify-center cursor-pointer group/arrow" onClick={(e) => { e.stopPropagation(); onToggleExpansion(); }}>
                <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-slate-300 group-hover/arrow:text-indigo-500 transition-all text-xs`}></i>
            </div>
        </div>
    );
};
