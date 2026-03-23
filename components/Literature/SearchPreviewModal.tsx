import React, { useState } from 'react';
import { Literature } from '../../types';
import { cleanAcademicTitle } from '../../utils/cleanTitle';

interface SearchPreviewModalProps {
    results: Literature[];
    isLoading: boolean;
    searchField: string;
    searchKeyword: string;
    groundingSources: { title: string; uri: string }[];
    onImport: (selected: Literature[]) => void;
    onClose: () => void;
}

const SearchPreviewModal: React.FC<SearchPreviewModalProps> = ({
    results,
    isLoading,
    searchField,
    searchKeyword,
    groundingSources,
    onImport,
    onClose
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleOne = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedIds.size === results.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(results.map(r => r.id)));
        }
    };

    const handleImport = () => {
        const toImport = results.filter(r => selectedIds.has(r.id));
        onImport(toImport);
    };

    const fieldLabel: Record<string, string> = {
        topic: '主题 (Topic)',
        title: '标题 (Title)',
        author: '作者 (Author)',
        doi: 'DOI',
    };

    const allSelected = results.length > 0 && selectedIds.size === results.length;
    const someSelected = selectedIds.size > 0 && !allSelected;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            <div
                className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-950 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
                    <div>
                        <h3 className="text-white font-black text-sm uppercase tracking-wider flex items-center gap-2">
                            <i className="fa-solid fa-database text-indigo-400 text-xs" />
                            检索结果预览
                        </h3>
                        <p className="text-slate-400 text-[10px] font-bold mt-0.5">
                            字段：<span className="text-indigo-300">{fieldLabel[searchField] || searchField}</span>
                            关键词：<span className="text-amber-300 italic">"{searchKeyword}"</span>
                            命中 <span className="text-emerald-400 font-black">{results.length}</span> 条
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <i className="fa-solid fa-xmark" />
                    </button>
                </div>

                {/* Loading State */}
                {isLoading && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16">
                        <div className="relative w-16 h-16">
                            <div className="absolute inset-0 rounded-full border-4 border-indigo-600/30 border-t-indigo-500 animate-spin" />
                            <div className="absolute inset-2 rounded-full border-4 border-violet-600/20 border-b-violet-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
                        </div>
                        <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest animate-pulse">
                            正在模拟 WoS 检索并翻译情报...
                        </p>
                    </div>
                )}

                {/* Results List */}
                {!isLoading && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {/* Select All Bar */}
                        {results.length > 0 && (
                            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-slate-900/90 backdrop-blur-sm border-b border-white/5">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div
                                        onClick={toggleAll}
                                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${allSelected
                                            ? 'bg-indigo-600 border-indigo-600'
                                            : someSelected
                                                ? 'bg-indigo-600/40 border-indigo-500'
                                                : 'border-white/20 hover:border-indigo-400'
                                            }`}
                                    >
                                        {(allSelected || someSelected) && (
                                            <i className={`fa-solid ${someSelected && !allSelected ? 'fa-minus' : 'fa-check'} text-white text-[9px]`} />
                                        )}
                                    </div>
                                    <span className="text-slate-300 text-[10px] font-black uppercase">
                                        {allSelected ? '取消全选' : `全选 (${results.length})`}
                                    </span>
                                </label>
                                <span className="text-slate-500 text-[9px] font-bold">
                                    已选 <span className="text-indigo-400 font-black">{selectedIds.size}</span> / {results.length}
                                </span>
                            </div>
                        )}

                        {/* Empty State */}
                        {results.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <i className="fa-solid fa-magnifying-glass text-3xl text-slate-600" />
                                <p className="text-slate-500 text-[11px] font-bold uppercase">未检索到相关结果，请调整关键词后重试</p>
                            </div>
                        )}

                        {/* Cards */}
                        <div className="p-4 space-y-2">
                            {results.map((item, idx) => {
                                const checked = selectedIds.has(item.id);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => toggleOne(item.id)}
                                        className={`flex gap-3 p-4 rounded-2xl border cursor-pointer transition-all group ${checked
                                            ? 'bg-indigo-600/20 border-indigo-500/60 shadow-md shadow-indigo-900/30'
                                            : 'bg-white/3 border-white/5 hover:bg-white/5 hover:border-white/10'
                                            }`}
                                    >
                                        {/* Checkbox */}
                                        <div className="shrink-0 mt-0.5">
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${checked ? 'bg-indigo-600 border-indigo-600' : 'border-white/20 group-hover:border-indigo-400'}`}>
                                                {checked && <i className="fa-solid fa-check text-white text-[9px]" />}
                                            </div>
                                        </div>

                                        {/* Index */}
                                        <div className="shrink-0 w-6 text-center">
                                            <span className="text-slate-600 text-[9px] font-black">{idx + 1}</span>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    {/* Chinese Title */}
                                                    <h4 className={`font-black text-[11px] leading-snug mb-0.5 ${checked ? 'text-indigo-200' : 'text-slate-200'}`}>
                                                        {item.title}
                                                    </h4>
                                                    {/* English Title */}
                                                    {(item as any).englishTitle && (
                                                        <p className="text-slate-500 text-[9px] italic line-clamp-1 mb-1.5">
                                                            {cleanAcademicTitle((item as any).englishTitle)}
                                                        </p>
                                                    )}
                                                </div>
                                                {(item as any).isTopTier && (
                                                    <span className="shrink-0 text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center gap-1">
                                                        <i className="fa-solid fa-award" /> TOP
                                                    </span>
                                                )}
                                            </div>

                                            {/* Meta Row */}
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className="text-slate-500 text-[9px] font-bold">
                                                    {item.authors?.slice(0, 2).join(', ')}{(item.authors?.length || 0) > 2 ? ' et al.' : ''}
                                                </span>
                                                <span className="text-slate-600 text-[8px]">·</span>
                                                <span className={`text-[9px] font-bold italic ${checked ? 'text-indigo-300' : 'text-slate-400'}`}>
                                                    {item.source?.substring(0, 30)}
                                                </span>
                                                <span className="text-slate-600 text-[8px]">·</span>
                                                <span className="text-slate-500 text-[9px] font-black">{item.year}</span>
                                                {item.doi && (
                                                    <>
                                                        <span className="text-slate-600 text-[8px]">·</span>
                                                        <a
                                                            href={item.url || `https://doi.org/${item.doi}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={e => e.stopPropagation()}
                                                            className="text-emerald-500/70 text-[8px] font-mono hover:text-emerald-400 hover:underline transition-colors flex items-center gap-1"
                                                        >
                                                            DOI: {item.doi.substring(0, 20)}...
                                                            <span className="bg-emerald-500 text-white px-1.5 py-0.5 rounded ml-1 font-sans text-[7px] font-black uppercase shadow-sm">
                                                                直达原文
                                                            </span>
                                                        </a>
                                                    </>
                                                )}
                                                {/* CrossRef 验证状态 */}
                                                {item.tags?.includes('CrossRef 已验证') && (
                                                    <>
                                                        <span className="text-slate-600 text-[8px]">·</span>
                                                        <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-0.5">
                                                            <i className="fa-solid fa-circle-check" /> CrossRef 已验证
                                                        </span>
                                                    </>
                                                )}
                                                {item.tags?.includes('待验证') && !item.doi && (
                                                    <>
                                                        <span className="text-slate-600 text-[8px]">·</span>
                                                        <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center gap-0.5">
                                                            <i className="fa-solid fa-triangle-exclamation" /> DOI 待验证
                                                        </span>
                                                    </>
                                                )}
                                            </div>

                                            {/* Abstract Preview */}
                                            {item.abstract && (
                                                <p className="text-slate-500 text-[9px] leading-relaxed mt-1.5 line-clamp-2">
                                                    {item.abstract}
                                                </p>
                                            )}

                                            {/* Performance Tags */}
                                            {item.performance && item.performance.length > 0 && (
                                                <div className="flex gap-1.5 mt-2 flex-wrap">
                                                    {item.performance.slice(0, 3).map((p, pi) => (
                                                        <span key={pi} className="text-[8px] font-black px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-500/20 text-violet-300">
                                                            {p.label}: {p.value}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Grounding Sources */}
                        {groundingSources.length > 0 && (
                            <div className="px-6 pb-4">
                                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                                    <i className="fa-solid fa-shield-halved text-emerald-600" /> 数据溯源验证
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {groundingSources.slice(0, 6).map((s, i) => (
                                        <a
                                            key={i}
                                            href={s.uri}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={e => e.stopPropagation()}
                                            className="text-[8px] font-bold text-slate-500 hover:text-indigo-400 underline truncate max-w-[200px] transition-colors"
                                        >
                                            {s.title}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer Actions */}
                {!isLoading && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-slate-900/80 shrink-0">
                        <p className="text-slate-500 text-[9px] font-bold">
                            {selectedIds.size > 0
                                ? `将导入 ${selectedIds.size} 篇文献至情报档案`
                                : '请勾选要导入的文献'}
                        </p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClose}
                                className="px-5 py-2 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={selectedIds.size === 0}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all flex items-center gap-2"
                            >
                                <i className="fa-solid fa-file-import text-indigo-200 text-[9px]" />
                                导入选中文献
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchPreviewModal;
