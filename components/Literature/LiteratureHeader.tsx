import React, { RefObject, useState } from 'react';
import { SearchFilters } from '../../services/gemini/resource';
import { SearchField } from '../../services/gemini/resource';

interface LiteratureHeaderProps {
    isLightMode: boolean;
    onBackToProjects: () => void;
    projectTitle?: string;
    aiSearchKeywords: string;
    setAiSearchKeywords: (val: string) => void;
    handleSearchAndAdd: () => void;
    isGlobalSearching: boolean;
    fileInputRef: RefObject<HTMLInputElement>;
    handleManualUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onUploadArchivesClick?: () => void;
    viewMode: 'list' | 'reports' | 'proposals' | 'benchmarking';
    setViewMode: (mode: 'list' | 'reports' | 'proposals' | 'benchmarking') => void;
    handleCompareAnalysis: () => void;
    isSummarizing: boolean;
    canSummarize: boolean;
    isReturnMode?: boolean;
    returnType?: 'writing' | 'project' | 'matrix' | 'brain';
    searchFilters: SearchFilters;
    onUpdateFilters: (filters: SearchFilters) => void;
    onOpenBibTeX: () => void;
    searchField: SearchField;
    onSearchFieldChange: (field: SearchField) => void;
    hasLastSearchResults?: boolean;
    onReopenSearch?: () => void;
}

const LiteratureHeader: React.FC<LiteratureHeaderProps> = ({
    isLightMode, onBackToProjects, projectTitle, aiSearchKeywords, setAiSearchKeywords,
    handleSearchAndAdd, isGlobalSearching, fileInputRef, handleManualUpload, viewMode, setViewMode,
    onUploadArchivesClick,
    handleCompareAnalysis, isSummarizing, canSummarize, isReturnMode, returnType,
    searchFilters, onUpdateFilters, onOpenBibTeX, searchField, onSearchFieldChange,
    hasLastSearchResults, onReopenSearch
}) => {
    const [showAdvanced, setShowAdvanced] = useState(false);

    const updateFilter = (key: keyof SearchFilters, val: any) => {
        onUpdateFilters({ ...searchFilters, [key]: val });
    };

    return (
        <div className="flex flex-col gap-2 shrink-0">
            <header className={`flex flex-col lg:flex-row items-center justify-between gap-4 p-3 lg:p-4 rounded-[2rem] border no-print ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/10 border-white/10'}`}>
                {/* Left: Navigation & Title */}
                <div className="flex items-center gap-3 shrink-0">
                    {isReturnMode ? (
                        <button onClick={onBackToProjects} className={`px-6 py-3 rounded-2xl flex items-center justify-center transition-all active:scale-95 shadow-md ${returnType === 'writing' ? 'bg-indigo-600 hover:bg-indigo-700' : returnType === 'brain' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-violet-600 hover:bg-violet-700'} text-white gap-2`}>
                            <i className={`fa-solid ${returnType === 'writing' ? 'fa-pen-nib' : returnType === 'brain' ? 'fa-brain' : returnType === 'project' ? 'fa-vials' : 'fa-flask'} text-xs`}></i>
                            <span className="text-[11px] font-black uppercase">返回{returnType === 'writing' ? '写作' : returnType === 'brain' ? '中心大脑' : returnType === 'project' ? '课题' : '矩阵'}</span>
                        </button>
                    ) : (
                        <button onClick={onBackToProjects} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-90 shadow-md ${isLightMode ? 'text-slate-400 bg-slate-100 border-slate-200 hover:text-indigo-600' : 'text-slate-400 bg-white/5 border-white/10 hover:text-indigo-600'}`}>
                            <i className="fa-solid fa-chevron-left"></i>
                        </button>
                    )}

                    <div className="min-w-0 max-w-[220px]">
                        <h2 className={`text-xs font-black italic truncate uppercase tracking-tighter ${isLightMode ? 'text-slate-800' : 'text-white'}`} title={projectTitle}>{projectTitle}</h2>
                    </div>
                </div>

                {/* Center: Search Area with Advanced Toggle */}
                <div className={`flex-1 flex items-center gap-2 p-1 rounded-2xl border shadow-inner w-full max-w-xl ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'}`}>
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`ml-2 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${showAdvanced ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-indigo-600'}`}
                        title="高级检索选项"
                    >
                        <i className="fa-solid fa-sliders text-xs"></i>
                    </button>

                    {/* Field Selector */}
                    <div className="relative shrink-0">
                        <select
                            value={searchField}
                            onChange={e => onSearchFieldChange(e.target.value as SearchField)}
                            className={`appearance-none h-8 pl-2 pr-6 rounded-lg text-[9px] font-black uppercase cursor-pointer outline-none border transition-all ${searchField === 'topic'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : searchField === 'title'
                                    ? 'bg-violet-600 text-white border-violet-600'
                                    : searchField === 'author'
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-amber-500 text-white border-amber-500'
                                }`}
                            title="检索字段"
                        >
                            <option value="topic">TS= 主题</option>
                            <option value="title">TI= 标题</option>
                            <option value="author">AU= 作者</option>
                            <option value="doi">DO= DOI</option>
                        </select>
                        <i className="fa-solid fa-chevron-down text-white text-[7px] absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    <input
                        className={`flex-1 bg-transparent px-2 py-2 text-[11px] font-bold outline-none italic ${isLightMode ? 'text-slate-700 placeholder:text-slate-300' : 'text-white placeholder:text-slate-500'}`}
                        placeholder={{
                            topic: '主题检索 (如: NiFe LDH stability oxygen evolution)...',
                            title: '标题精确检索 (如: Hierarchical NiFe layered double hydroxide)...',
                            author: '作者精确检索 (如: Zhang Wei, Li Hua)...',
                            doi: 'DOI 精确检索 (如: 10.1021/jacs.xxxxx)...',
                        }[searchField]}
                        value={aiSearchKeywords}
                        onChange={e => setAiSearchKeywords(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearchAndAdd()}
                    />
                    <button
                        onClick={handleSearchAndAdd}
                        disabled={isGlobalSearching}
                        className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase shadow-lg disabled:opacity-30 active:scale-95 transition-all hover:bg-black whitespace-nowrap flex items-center gap-2"
                    >
                        {isGlobalSearching ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-magnifying-glass text-[9px] text-indigo-200"></i>}
                        全网搜索
                    </button>
                    {hasLastSearchResults && (
                        <button
                            onClick={onReopenSearch}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm border ${isLightMode ? 'bg-violet-50 text-violet-600 border-violet-100 hover:bg-violet-600 hover:text-white' : 'bg-white/10 text-violet-300 border-white/10 hover:bg-violet-600 hover:text-white'}`}
                            title="查看上次检索结果"
                        >
                            <i className="fa-solid fa-clock-rotate-left text-xs"></i>
                        </button>
                    )}
                </div>

                {/* Right: Actions & Switcher */}
                <div className="flex items-center gap-3 shrink-0">
                    <button
                        onClick={onOpenBibTeX}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm border ${isLightMode ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white' : 'bg-white/10 text-emerald-300 border-white/10 hover:bg-white hover:text-slate-900'}`}
                        title="导入 BibTeX / EndNote"
                    >
                        <i className="fa-solid fa-book-bookmark text-xs"></i>
                    </button>

                    <button
                        onClick={() => onUploadArchivesClick ? onUploadArchivesClick() : fileInputRef.current?.click()}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm border ${isLightMode ? 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-600 hover:text-white' : 'bg-white/10 text-slate-300 border-white/10 hover:bg-white hover:text-slate-900'}`}
                        title="上传本地档案解析"
                    >
                        <i className="fa-solid fa-file-upload text-xs"></i>
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleManualUpload} accept=".pdf,.doc,.docx,.txt" />

                    <div className={`flex bg-slate-100 p-1.5 rounded-xl shadow-inner border border-slate-200 ${isLightMode ? '' : 'bg-white/5 border-white/10'}`}>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            档案库
                        </button>
                        <button
                            onClick={() => setViewMode('benchmarking')}
                            className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'benchmarking' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            知识沉淀
                        </button>
                        <button
                            onClick={() => setViewMode('reports')}
                            className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'reports' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            分析库
                        </button>
                        <button
                            onClick={() => setViewMode('proposals')}
                            className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'proposals' ? 'bg-indigo-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            建议库
                        </button>
                    </div>

                    <button
                        onClick={handleCompareAnalysis}
                        disabled={isSummarizing || !canSummarize}
                        className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[11px] uppercase shadow-lg active:scale-95 disabled:opacity-30 hover:bg-black transition-all whitespace-nowrap"
                    >
                        {isSummarizing ? <i className="fa-solid fa-spinner animate-spin"></i> : '矩阵诊断'}
                    </button>
                </div>
            </header>

            {/* Advanced Filters Panel - Animated Slide Down */}
            {showAdvanced && (
                <div className={`p-4 rounded-[2rem] border animate-reveal shadow-xl flex flex-wrap items-center gap-6 z-40 transition-all ${isLightMode ? 'bg-white/95 border-slate-200' : 'bg-slate-900/95 border-white/10'}`}>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">文献类型 (Type)</label>
                        <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                            {(['All', 'Article', 'Review', 'Patent', 'Conference'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => updateFilter('docType', t)}
                                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${searchFilters.docType === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {t === 'All' ? '全部' : t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">时间范围 (Date Range)</label>
                        <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                            {(['all', '1y', '3y', '5y'] as const).map(range => (
                                <button
                                    key={range}
                                    onClick={() => updateFilter('timeRange', range)}
                                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${searchFilters.timeRange === range ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {range === 'all' ? '不限' : `近${range.replace('y', '')}年`}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">质量控制 (Quality)</label>
                        <button
                            onClick={() => updateFilter('highImpactOnly', !searchFilters.highImpactOnly)}
                            className={`h-9 px-5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 border shadow-sm active:scale-95 ${searchFilters.highImpactOnly ? 'bg-amber-100 border-amber-300 text-amber-700 shadow-inner' : 'bg-white border-slate-200 text-slate-400'}`}
                        >
                            <i className={`fa-solid ${searchFilters.highImpactOnly ? 'fa-award text-amber-500' : 'fa-globe'}`}></i>
                            {searchFilters.highImpactOnly ? '顶刊优先策略 ON' : '全网检索模式'}
                        </button>
                    </div>

                    <div className="ml-auto text-right">
                        <p className="text-[8px] text-slate-300 font-bold uppercase italic">* 智能模拟 Web of Science 核心合集检索逻辑</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiteratureHeader;
