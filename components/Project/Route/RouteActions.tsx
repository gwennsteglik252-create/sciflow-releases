
import React from 'react';
import { TransformationProposal } from '../../../types';

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
}

export const RouteActions: React.FC<RouteActionsProps> = ({
    prop, hasAudit, isAuditing, getOverallStatus, isExpanded, isCurrentlyEditing,
    onRunAudit, onToggleAudit, onToggleExpansion, onSourceLink, onAddSub, onStartEdit, onSaveEdit, onDelete,
    score, onLinkPlan, onPushToLab
}) => {
    const localBadgeColor = score >= 80 ? 'bg-emerald-600 border-emerald-500 text-white'
        : score >= 50 ? 'bg-amber-500 border-amber-400 text-white'
            : 'bg-rose-600 border-rose-500 text-white';

    return (
        <div className="flex items-center gap-2 relative z-30">
            {/* 1. 可行性评分 */}
            <div className={`mr-1 px-4 py-2 rounded-2xl border-2 flex items-center gap-3 shadow-md group-hover:scale-105 transition-transform ${localBadgeColor}`}>
                <span className="text-[8px] font-black text-white uppercase leading-none tracking-widest whitespace-nowrap">FEASIBILITY</span>
                <div className="flex items-baseline gap-0.5 border-l-2 border-white/20 pl-3">
                    <span className="text-sm font-black font-mono leading-none text-white">{score}</span>
                    <span className="text-white/60 text-[8px] font-bold">/100</span>
                </div>
            </div>

            {/* 2. 推送到矩阵 - 确保 onClick 逻辑稳健 */}
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onLinkPlan) onLinkPlan();
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all flex items-center gap-2 active:scale-95 border border-indigo-400/50 cursor-pointer"
                title="将当前方案的优化参数推送到实验设计矩阵模块"
            >
                <i className="fa-solid fa-table-cells"></i>
                推送到矩阵
            </button>

            {/* 2.5 实验室预演 */}
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (onPushToLab) onPushToLab();
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all flex items-center gap-2 active:scale-95 border border-emerald-400/50 cursor-pointer"
                title="推送到工业工艺实验室进行数字化预演与 BOM 核算"
            >
                <i className="fa-solid fa-flask-vial"></i>
                推送到实验室
            </button>

            {/* 3. 资源对标 */}
            <div className="relative">
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); hasAudit ? onToggleAudit() : onRunAudit(); }}
                    className={`w-9 h-9 rounded-xl transition-all flex items-center justify-center shadow-md relative border-2 ${hasAudit ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white text-slate-400 border-slate-200 hover:text-indigo-600 hover:border-indigo-400'}`}
                    title="资源供应对标审计"
                >
                    {isAuditing ? <i className="fa-solid fa-spinner animate-spin text-sm"></i> : <i className="fa-solid fa-warehouse text-sm"></i>}
                    {hasAudit && (
                        <span className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border-2 border-white animate-pulse ${getOverallStatus()}`}></span>
                    )}
                </button>
            </div>

            {/* 4. 辅助图标工具栏 */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                {prop.literatureId && !['FLOW_GEN', 'MANUAL'].includes(prop.literatureId) && (
                    <button onClick={(e) => { e.stopPropagation(); onSourceLink(); }} className="w-8 h-8 rounded-lg text-amber-600 hover:bg-white transition-all flex items-center justify-center" title="溯源至情报档案">
                        <i className="fa-solid fa-book-open text-xs"></i>
                    </button>
                )}

                <button onClick={(e) => { e.stopPropagation(); onAddSub(); }} className="w-8 h-8 rounded-lg text-emerald-600 hover:bg-white transition-all flex items-center justify-center" title="新建分支路线">
                    <i className="fa-solid fa-code-branch text-xs"></i>
                </button>

                {isCurrentlyEditing ? (
                    <button onClick={(e) => { e.stopPropagation(); onSaveEdit(); }} className="w-8 h-8 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all flex items-center justify-center shadow-sm" title="完成编辑">
                        <i className="fa-solid fa-check text-xs"></i>
                    </button>
                ) : (
                    <button onClick={(e) => { e.stopPropagation(); onStartEdit(); }} className="w-8 h-8 rounded-lg text-indigo-600 hover:bg-white transition-all flex items-center justify-center" title="编辑路线内容">
                        <i className="fa-solid fa-pen-nib text-xs"></i>
                    </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-8 h-8 rounded-lg text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center" title="删除">
                    <i className="fa-solid fa-trash-can text-xs"></i>
                </button>
            </div>

            <div className="w-8 flex justify-center cursor-pointer group/arrow" onClick={(e) => { e.stopPropagation(); onToggleExpansion(); }}>
                <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-slate-300 group-hover/arrow:text-indigo-500 transition-all text-sm`}></i>
            </div>
        </div>
    );
};
