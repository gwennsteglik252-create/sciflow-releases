import React, { useState } from 'react';
import { Literature } from '../../types';

interface PatentSearchModalProps {
    results: Literature[];
    isLoading: boolean;
    searchKeyword: string;
    groundingSources: { title: string; uri: string }[];
    onImport: (selected: Literature[]) => void;
    onClose: () => void;
}

/** 专利法律状态颜色映射 */
const statusStyle = (status: string) => {
    const s = status?.trim();
    if (s === '已授权') return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
    if (s === '审查中') return 'bg-amber-500/20 border-amber-500/40 text-amber-400';
    if (s === '已失效' || s === '已撤回') return 'bg-rose-500/20 border-rose-500/40 text-rose-400';
    if (s?.includes('PCT')) return 'bg-blue-500/20 border-blue-500/40 text-blue-400';
    return 'bg-slate-500/20 border-slate-500/40 text-slate-400';
};

/** 国家/地区旗帜 emoji 映射 */
const countryFlag = (c: string) => {
    const map: Record<string, string> = { CN: '🇨🇳', US: '🇺🇸', EP: '🇪🇺', JP: '🇯🇵', KR: '🇰🇷', WO: '🌐', DE: '🇩🇪', GB: '🇬🇧', FR: '🇫🇷' };
    return map[c?.toUpperCase()] || '📄';
};

const PatentSearchModal: React.FC<PatentSearchModalProps> = ({
    results, isLoading, searchKeyword, groundingSources, onImport, onClose
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleOne = (id: string) => {
        setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };

    const toggleAll = () => {
        setSelectedIds(prev => prev.size === results.length ? new Set() : new Set(results.map(r => r.id)));
    };

    const handleImport = () => {
        onImport(results.filter(r => selectedIds.has(r.id)));
    };

    const allSelected = results.length > 0 && selectedIds.size === results.length;
    const someSelected = selectedIds.size > 0 && !allSelected;

    /** 从 Literature 的扩展字段中读取专利元数据 */
    const getMeta = (item: Literature) => (item as any)._patentMeta || {};

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            <div
                className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-slate-950 border border-cyan-500/20 rounded-[2rem] shadow-2xl overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 bg-gradient-to-r from-cyan-950/60 to-slate-950">
                    <div>
                        <h3 className="text-white font-black text-sm uppercase tracking-wider flex items-center gap-2">
                            <i className="fa-solid fa-gavel text-cyan-400 text-xs" />
                            全球专利检索结果
                        </h3>
                        <p className="text-slate-400 text-[10px] font-bold mt-0.5">
                            关键词：<span className="text-cyan-300 italic">"{searchKeyword}"</span>
                            {' '}命中 <span className="text-emerald-400 font-black">{results.length}</span> 条专利
                            <span className="text-slate-600 ml-2">· Google Patents / CNIPA / USPTO / Espacenet</span>
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
                            <div className="absolute inset-0 rounded-full border-4 border-cyan-600/30 border-t-cyan-500 animate-spin" />
                            <div className="absolute inset-2 rounded-full border-4 border-blue-600/20 border-b-blue-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
                            <i className="fa-solid fa-gavel text-cyan-400 text-lg absolute inset-0 flex items-center justify-center" />
                        </div>
                        <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest animate-pulse">
                            正在检索全球专利数据库...
                        </p>
                        <p className="text-slate-600 text-[9px] max-w-sm text-center">
                            覆盖 Google Patents、中国国家知识产权局(CNIPA)、美国专利商标局(USPTO)、欧洲专利局(Espacenet)
                        </p>
                    </div>
                )}

                {/* Results */}
                {!isLoading && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {/* Select All Bar */}
                        {results.length > 0 && (
                            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-slate-900/90 backdrop-blur-sm border-b border-white/5">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div
                                        onClick={toggleAll}
                                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${allSelected
                                            ? 'bg-cyan-600 border-cyan-600'
                                            : someSelected
                                                ? 'bg-cyan-600/40 border-cyan-500'
                                                : 'border-white/20 hover:border-cyan-400'
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
                                    已选 <span className="text-cyan-400 font-black">{selectedIds.size}</span> / {results.length}
                                </span>
                            </div>
                        )}

                        {/* Empty State */}
                        {results.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <i className="fa-solid fa-gavel text-3xl text-slate-600" />
                                <p className="text-slate-500 text-[11px] font-bold uppercase">未检索到相关专利，请调整关键词后重试</p>
                            </div>
                        )}

                        {/* Patent Cards */}
                        <div className="p-4 space-y-2">
                            {results.map((item, idx) => {
                                const checked = selectedIds.has(item.id);
                                const meta = getMeta(item);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => toggleOne(item.id)}
                                        className={`flex gap-3 p-4 rounded-2xl border cursor-pointer transition-all group ${checked
                                            ? 'bg-cyan-600/15 border-cyan-500/50 shadow-md shadow-cyan-900/30'
                                            : 'bg-white/3 border-white/5 hover:bg-white/5 hover:border-white/10'
                                            }`}
                                    >
                                        {/* Checkbox */}
                                        <div className="shrink-0 mt-0.5">
                                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${checked ? 'bg-cyan-600 border-cyan-600' : 'border-white/20 group-hover:border-cyan-400'}`}>
                                                {checked && <i className="fa-solid fa-check text-white text-[9px]" />}
                                            </div>
                                        </div>

                                        {/* Index */}
                                        <div className="shrink-0 w-6 text-center">
                                            <span className="text-slate-600 text-[9px] font-black">{idx + 1}</span>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            {/* Title Row */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className={`font-black text-[11px] leading-snug mb-0.5 ${checked ? 'text-cyan-200' : 'text-slate-200'}`}>
                                                        {item.title}
                                                    </h4>
                                                    {item.englishTitle && (
                                                        <p className="text-slate-500 text-[9px] italic line-clamp-1 mb-1">
                                                            {item.englishTitle}
                                                        </p>
                                                    )}
                                                </div>
                                                {/* Status Badge */}
                                                {meta.status && (
                                                    <span className={`shrink-0 text-[7px] font-black uppercase px-2 py-0.5 rounded-md border flex items-center gap-1 ${statusStyle(meta.status)}`}>
                                                        <i className={`fa-solid ${meta.status === '已授权' ? 'fa-circle-check' : meta.status === '审查中' ? 'fa-hourglass-half' : 'fa-circle-xmark'} text-[7px]`} />
                                                        {meta.status}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Patent Number + Meta Row */}
                                            <div className="flex items-center gap-2 flex-wrap mt-1">
                                                {/* Patent Number Badge */}
                                                {meta.patentNumber && (
                                                    <span className="text-[8px] font-black font-mono px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center gap-1">
                                                        {countryFlag(meta.country)} {meta.patentNumber}
                                                    </span>
                                                )}
                                                {/* Patent Type */}
                                                {meta.patentType && (
                                                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-500/20 text-violet-300">
                                                        {meta.patentType}
                                                    </span>
                                                )}
                                                <span className="text-slate-600 text-[8px]">·</span>
                                                {/* Applicant */}
                                                <span className="text-slate-400 text-[9px] font-bold truncate max-w-[200px]">
                                                    {meta.applicant || item.authors?.join(', ')}
                                                </span>
                                                {/* Filing Date */}
                                                {meta.filingDate && (
                                                    <>
                                                        <span className="text-slate-600 text-[8px]">·</span>
                                                        <span className="text-slate-500 text-[9px] font-bold flex items-center gap-1">
                                                            <i className="fa-regular fa-calendar text-[7px]" />
                                                            申请: {meta.filingDate}
                                                        </span>
                                                    </>
                                                )}
                                                {/* IPC Code */}
                                                {meta.ipcCode && (
                                                    <>
                                                        <span className="text-slate-600 text-[8px]">·</span>
                                                        <span className="text-[8px] font-mono text-slate-500">
                                                            IPC: {meta.ipcCode}
                                                        </span>
                                                    </>
                                                )}
                                                {/* Source Link */}
                                                {item.url && (
                                                    <>
                                                        <span className="text-slate-600 text-[8px]">·</span>
                                                        <a
                                                            href={item.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={e => e.stopPropagation()}
                                                            className="text-cyan-500/70 text-[8px] font-bold hover:text-cyan-400 hover:underline transition-colors flex items-center gap-1"
                                                        >
                                                            <span className="bg-cyan-500 text-white px-1.5 py-0.5 rounded text-[7px] font-black uppercase shadow-sm">
                                                                查看全文
                                                            </span>
                                                        </a>
                                                    </>
                                                )}
                                            </div>

                                            {/* Abstract */}
                                            {item.abstract && (
                                                <p className="text-slate-500 text-[9px] leading-relaxed mt-1.5 line-clamp-2">
                                                    {item.abstract}
                                                </p>
                                            )}

                                            {/* Claims Preview */}
                                            {meta.claims && (
                                                <div className="mt-1.5 flex items-start gap-1.5">
                                                    <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                                                        权利要求
                                                    </span>
                                                    <p className="text-slate-600 text-[8px] leading-relaxed line-clamp-1 italic">
                                                        {meta.claims}
                                                    </p>
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
                                    <i className="fa-solid fa-shield-halved text-cyan-600" /> 数据溯源验证
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {groundingSources.slice(0, 6).map((s, i) => (
                                        <a
                                            key={i}
                                            href={s.uri}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={e => e.stopPropagation()}
                                            className="text-[8px] font-bold text-slate-500 hover:text-cyan-400 underline truncate max-w-[250px] transition-colors"
                                        >
                                            {s.title}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer */}
                {!isLoading && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-slate-900/80 shrink-0">
                        <p className="text-slate-500 text-[9px] font-bold">
                            {selectedIds.size > 0
                                ? `将导入 ${selectedIds.size} 条专利至情报档案`
                                : '请勾选要导入的专利'}
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
                                className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all flex items-center gap-2"
                            >
                                <i className="fa-solid fa-file-import text-cyan-200 text-[9px]" />
                                导入选中专利
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PatentSearchModal;
