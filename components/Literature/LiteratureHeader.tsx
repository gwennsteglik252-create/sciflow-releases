import React, { RefObject, useState } from 'react';
import { useTranslation } from '../../locales/useTranslation';
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
    viewMode: 'list' | 'reports' | 'proposals' | 'benchmarking' | 'graph' | 'knowledgePool';
    setViewMode: (mode: 'list' | 'reports' | 'proposals' | 'benchmarking' | 'graph' | 'knowledgePool') => void;
    handleCompareAnalysis: () => void;
    isSummarizing: boolean;
    canSummarize: boolean;
    isReturnMode?: boolean;
    returnType?: 'writing' | 'project' | 'matrix' | 'brain';
    searchFilters: SearchFilters;
    onUpdateFilters: (filters: SearchFilters) => void;

    searchField: SearchField;
    onSearchFieldChange: (field: SearchField) => void;
    hasLastSearchResults?: boolean;
    onReopenSearch?: () => void;
    // NEW: Subscription
    unreadFeedCount?: number;
    onOpenSubscription?: () => void;
    // NEW: PDF Settings
    onOpenPdfSettings?: () => void;
    // NEW: Quick Capture
    onOpenQuickCapture?: () => void;
    // NEW: EPO Settings
    onOpenEpoSettings?: () => void;
}

const LiteratureHeader: React.FC<LiteratureHeaderProps> = ({
    isLightMode, onBackToProjects, projectTitle, aiSearchKeywords, setAiSearchKeywords,
    handleSearchAndAdd, isGlobalSearching, fileInputRef, handleManualUpload, viewMode, setViewMode,
    onUploadArchivesClick,
    handleCompareAnalysis, isSummarizing, canSummarize, isReturnMode, returnType,
    searchFilters, onUpdateFilters, searchField, onSearchFieldChange,
    hasLastSearchResults, onReopenSearch,
    unreadFeedCount, onOpenSubscription,
    onOpenPdfSettings,
    onOpenQuickCapture,
    onOpenEpoSettings,
}) => {
    const { t } = useTranslation();
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
                            <span className="text-[11px] font-black uppercase">{t(`literatureModule.header.backTo${returnType?.charAt(0).toUpperCase()}${returnType?.slice(1)}` as any, { defaultValue: t('literatureModule.header.backToProject') })}</span>
                        </button>
                    ) : (
                        <button onClick={onBackToProjects} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-90 shadow-md ${isLightMode ? 'text-slate-400 bg-slate-100 border-slate-200 hover:text-indigo-600' : 'text-slate-400 bg-white/5 border-white/10 hover:text-indigo-600'}`}>
                            <i className="fa-solid fa-chevron-left"></i>
                        </button>
                    )}


                </div>

                {/* Center: Search Area with Advanced Toggle */}
                <div className={`flex-1 flex items-center gap-2 p-1.5 rounded-2xl border shadow-inner w-full max-w-3xl ${isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'}`}>
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`ml-2 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${showAdvanced ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-indigo-600'}`}
                        title={t('literatureModule.header.advancedOptions')}
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
                                        : searchField === 'patent'
                                            ? 'bg-cyan-600 text-white border-cyan-600'
                                            : 'bg-amber-500 text-white border-amber-500'
                                }`}
                            title={t('literatureModule.header.searchField')}
                        >
                            <option value="topic">{t('literatureModule.header.fields.topic')}</option>
                            <option value="title">{t('literatureModule.header.fields.title')}</option>
                            <option value="author">{t('literatureModule.header.fields.author')}</option>
                            <option value="doi">{t('literatureModule.header.fields.doi')}</option>
                            <option value="patent">专利</option>
                        </select>
                        <i className="fa-solid fa-chevron-down text-white text-[7px] absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>

                    <input
                        className={`flex-1 bg-transparent px-3 py-2.5 text-sm font-bold outline-none italic ${isLightMode ? 'text-slate-700 placeholder:text-slate-300' : 'text-white placeholder:text-slate-500'}`}
                        placeholder={{
                            topic: t('literatureModule.header.placeholders.topic'),
                            title: t('literatureModule.header.placeholders.title'),
                            author: t('literatureModule.header.placeholders.author'),
                            doi: t('literatureModule.header.placeholders.doi'),
                            patent: '输入技术关键词/专利号检索全球专利...',
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
                        {t('literatureModule.header.globalSearch')}
                    </button>
                    {hasLastSearchResults && (
                        <button
                            onClick={onReopenSearch}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm border ${isLightMode ? 'bg-violet-50 text-violet-600 border-violet-100 hover:bg-violet-600 hover:text-white' : 'bg-white/10 text-violet-300 border-white/10 hover:bg-violet-600 hover:text-white'}`}
                            title={t('literatureModule.header.lastResults')}
                        >
                            <i className="fa-solid fa-clock-rotate-left text-xs"></i>
                        </button>
                    )}
                    {searchField === 'patent' && (
                        <button
                            onClick={onOpenEpoSettings}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-sm border bg-cyan-50 text-cyan-600 border-cyan-100 hover:bg-cyan-600 hover:text-white`}
                            title="EPO 专利数据源配置"
                        >
                            <i className="fa-solid fa-database text-xs"></i>
                        </button>
                    )}
                </div>

                {/* Right: Actions & Switcher */}
                <div className="flex items-center gap-3 shrink-0">
                    {/* Subscription Button with Badge */}
                    <button
                        onClick={onOpenSubscription}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95 shadow-sm border relative ${isLightMode ? 'bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-600 hover:text-white' : 'bg-white/10 text-purple-300 border-white/10 hover:bg-purple-600 hover:text-white'}`}
                        title="文献订阅"
                    >
                        <i className="fa-solid fa-satellite-dish text-xs"></i>
                        {(unreadFeedCount ?? 0) > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-rose-500 text-white rounded-full text-[8px] font-black flex items-center justify-center animate-pulse">
                                {unreadFeedCount}
                            </span>
                        )}
                    </button>

                    {/* PDF Settings */}
                    <button
                        onClick={onOpenPdfSettings}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95 shadow-sm border ${isLightMode ? 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-600 hover:text-white' : 'bg-white/10 text-rose-300 border-white/10 hover:bg-rose-600 hover:text-white'}`}
                        title="全文下载设置"
                    >
                        <i className="fa-solid fa-file-pdf text-xs"></i>
                    </button>

                    {/* Quick Capture */}
                    <button
                        onClick={onOpenQuickCapture}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95 shadow-sm border ${isLightMode ? 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-600 hover:text-white' : 'bg-white/10 text-amber-300 border-white/10 hover:bg-amber-600 hover:text-white'}`}
                        title="快速抓取 (DOI/URL/标题)"
                    >
                        <i className="fa-solid fa-bolt text-xs"></i>
                    </button>



                    <button
                        onClick={() => onUploadArchivesClick ? onUploadArchivesClick() : fileInputRef.current?.click()}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all active:scale-95 shadow-sm border ${isLightMode ? 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-600 hover:text-white' : 'bg-white/10 text-slate-300 border-white/10 hover:bg-white hover:text-slate-900'}`}
                        title={t('literatureModule.header.uploadLocal')}
                    >
                        <i className="fa-solid fa-file-upload text-xs"></i>
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleManualUpload} accept=".pdf,.doc,.docx,.txt" />

                    <div className={`flex bg-slate-100 p-1.5 rounded-xl shadow-inner border border-slate-200 ${isLightMode ? '' : 'bg-white/5 border-white/10'}`}>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {t('literatureModule.header.tabs.archive')}
                        </button>
                        <button
                            onClick={() => setViewMode('knowledgePool')}
                            className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 ${viewMode === 'knowledgePool' ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-database text-[8px]"></i>
                            知识沉淀
                        </button>
                        <button
                            onClick={() => setViewMode('reports')}
                            className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'reports' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {t('literatureModule.header.tabs.reports')}
                        </button>
                        <button
                            onClick={() => setViewMode('proposals')}
                            className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'proposals' ? 'bg-indigo-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {t('literatureModule.header.tabs.proposals')}
                        </button>
                        <button
                            onClick={() => setViewMode('graph')}
                            className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 ${viewMode === 'graph' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-diagram-project text-[8px]"></i>
                            {t('literatureModule.header.tabs.graph')}
                        </button>
                    </div>

                    <button
                        onClick={handleCompareAnalysis}
                        disabled={isSummarizing || !canSummarize}
                        className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[11px] uppercase shadow-lg active:scale-95 disabled:opacity-30 hover:bg-black transition-all whitespace-nowrap"
                    >
                        {isSummarizing ? <i className="fa-solid fa-spinner animate-spin"></i> : t('literatureModule.header.matrixDiagnosis')}
                    </button>
                </div>
            </header>

            {/* Advanced Filters Panel - Animated Slide Down */}
            {showAdvanced && (
                <div className={`p-4 rounded-[2rem] border animate-reveal shadow-xl flex flex-wrap items-center gap-6 z-40 transition-all ${isLightMode ? 'bg-white/95 border-slate-200' : 'bg-slate-900/95 border-white/10'}`}>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{t('literatureModule.header.docType')}</label>
                        <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                            {(['All', 'Article', 'Review', 'Patent', 'Conference'] as const).map(docTypeKey => (
                                <button
                                    key={docTypeKey}
                                    onClick={() => updateFilter('docType', docTypeKey)}
                                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${searchFilters.docType === docTypeKey ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {t(`literatureModule.header.docTypes.${docTypeKey.toLowerCase()}` as any, { defaultValue: docTypeKey })}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{t('literatureModule.header.timeRange')}</label>
                        <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                            {(['all', '1y', '3y', '5y'] as const).map(range => (
                                <button
                                    key={range}
                                    onClick={() => updateFilter('timeRange', range)}
                                    className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${searchFilters.timeRange === range ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    {range === 'all' ? t('literatureModule.header.timeRanges.all') : t('literatureModule.header.timeRanges.year' + range.replace('y', ''), { defaultValue: `Last ${range.replace('y', '')} years` })}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">{t('literatureModule.header.qualityControl')}</label>
                        <button
                            onClick={() => updateFilter('highImpactOnly', !searchFilters.highImpactOnly)}
                            className={`h-9 px-5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 border shadow-sm active:scale-95 ${searchFilters.highImpactOnly ? 'bg-amber-100 border-amber-300 text-amber-700 shadow-inner' : 'bg-white border-slate-200 text-slate-400'}`}
                        >
                            <i className={`fa-solid ${searchFilters.highImpactOnly ? 'fa-award text-amber-500' : 'fa-globe'}`}></i>
                            {searchFilters.highImpactOnly ? t('literatureModule.header.highImpactOnly') : t('literatureModule.header.globalSearchMode')}
                        </button>
                    </div>

                    <div className="ml-auto text-right">
                        <p className="text-[8px] text-slate-300 font-bold uppercase italic">{t('literatureModule.header.wosNote')}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiteratureHeader;
