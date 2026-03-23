import React from 'react';
import { TrendItem } from '../../types';
import { getCategoryColor, getCategoryGradient, getCategoryIcon, getCategoryLabel } from './trendUtils';

interface TrendCardProps {
    trend: TrendItem;
    isSelected: boolean;
    isShowingOriginal: boolean;
    isProcessing: boolean;
    onToggleSelection: () => void;
    onToggleOriginal: () => void;
    onGenerateSummary: () => void;
}

const TrendCard: React.FC<TrendCardProps> = ({
    trend,
    isSelected,
    isShowingOriginal,
    isProcessing,
    onToggleSelection,
    onToggleOriginal,
    onGenerateSummary,
}) => {
    const hasSummary = !!trend.summary;

    return (
        <div className={`bg-white rounded-[2rem] border-2 transition-all duration-300 shadow-sm hover:shadow-xl flex flex-col group relative overflow-hidden ${isSelected ? 'border-indigo-600 ring-4 ring-indigo-50 shadow-indigo-100' : 'border-slate-100 hover:border-slate-200'}`}>
            {/* Category gradient band */}
            <div
                className="h-1.5 w-full shrink-0"
                style={{ background: getCategoryGradient(trend.category) }}
            />

            <div className="p-6 flex flex-col flex-1">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={onToggleSelection}
                            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                        />
                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase border flex items-center gap-1.5 shadow-sm ${getCategoryColor(trend.category)}`}>
                            <i className={`fa-solid ${getCategoryIcon(trend.category)}`} />
                            {getCategoryLabel(trend.category)}
                        </span>
                    </div>
                    {/* Signal strength bars (instead of stars) */}
                    <div className="flex items-end gap-[3px] h-[18px]" title={`影响力: ${trend.impactScore}/5`}>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div
                                key={i}
                                className={`w-[4px] rounded-full transition-all duration-500 ${i < trend.impactScore ? 'bg-amber-400' : 'bg-slate-200'
                                    }`}
                                style={{ height: `${6 + i * 3}px` }}
                            />
                        ))}
                    </div>
                </div>

                {/* Title */}
                <h4 className="text-sm font-black text-slate-800 leading-tight mb-3 group-hover:text-indigo-600 transition-colors">
                    {trend.title}
                </h4>

                {/* Metadata bar */}
                <div className="flex items-center gap-3 mb-4 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                    <div className="flex flex-col">
                        <span className="text-[7px] font-black text-slate-300 uppercase">情报源</span>
                        <span className="text-[9px] font-bold text-indigo-700 truncate max-w-[120px] uppercase tracking-tighter">{trend.source}</span>
                    </div>
                    <div className="w-px h-5 bg-slate-200" />
                    <div className="flex flex-col">
                        <span className="text-[7px] font-black text-slate-300 uppercase">探测时间</span>
                        <span className="text-[9px] font-black text-indigo-600 font-mono">{trend.detectedAt || '—'}</span>
                    </div>
                    <div className="w-px h-5 bg-slate-200" />
                    <div className="flex flex-col">
                        <span className="text-[7px] font-black text-slate-300 uppercase">来源日期</span>
                        <span className="text-[9px] font-black text-slate-500 font-mono">{trend.timestamp}</span>
                    </div>
                    {trend.url && (
                        <a href={trend.url} target="_blank" rel="noopener noreferrer" className="ml-auto w-7 h-7 bg-white rounded-lg border border-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-400 transition-all shadow-sm">
                            <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
                        </a>
                    )}
                </div>

                {/* Content area */}
                <div className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 mb-4 max-h-[280px] flex flex-col relative shadow-inner flex-1">
                    {hasSummary && !isShowingOriginal ? (
                        <div className="animate-reveal flex flex-col gap-3 h-full min-h-0 overflow-hidden">
                            <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                                <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-wand-magic-sparkles text-indigo-500 text-[10px]" />
                                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.08rem] leading-none">AI 内参摘要</span>
                                </div>
                                <button
                                    onClick={onToggleOriginal}
                                    className="text-[8px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-tighter transition-colors"
                                >
                                    查看原文
                                </button>
                            </div>
                            <p className="text-[11px] font-bold text-slate-800 leading-relaxed text-justify flex-1 overflow-y-auto custom-scrollbar pr-1">
                                {trend.summary}
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3 h-full min-h-0 overflow-hidden">
                            {hasSummary && (
                                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">原文摘要</span>
                                    <button
                                        onClick={onToggleOriginal}
                                        className="text-[8px] font-black text-indigo-600 hover:text-black uppercase tracking-tighter transition-colors"
                                    >
                                        返回内参
                                    </button>
                                </div>
                            )}
                            <p className="text-[11px] font-medium text-slate-500 leading-relaxed text-justify flex-1 overflow-y-auto custom-scrollbar pr-1">
                                {trend.content}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
                    <div className="flex items-center gap-2">
                        {!trend.summary ? (
                            <button
                                onClick={onGenerateSummary}
                                disabled={isProcessing}
                                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase hover:bg-indigo-600 transition-all active:scale-95 shadow-md flex items-center gap-2"
                            >
                                {isProcessing ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-bolt" />}
                                解析内参
                            </button>
                        ) : (
                            <span className="text-[9px] font-black text-emerald-600 flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 shadow-sm">
                                <i className="fa-solid fa-check-circle" />
                                内参就绪
                            </span>
                        )}
                    </div>
                    <span className="text-[9px] font-black text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        ID: {trend.id.slice(-4).toUpperCase()}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default TrendCard;
