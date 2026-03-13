import React from 'react';
import { useTranslation } from '../../../locales/useTranslation';

interface EditorHeaderProps {
    isRightSidebarVisible?: boolean;
    onToggleRightSidebar?: () => void;
    activeLabel: string;
    displayLabel: string;
    onSwitchToPublishing?: () => void;
    activeSectionId: string;
    isProcessing: boolean;
    onSmartWrite: () => void;
    onPolish: (mode: string) => void;

    // Bibliography Props
    showBibMenu: boolean;
    setShowBibMenu: (v: boolean) => void;
    styleSearch: string;
    setStyleSearch: (v: string) => void;
    filteredStyles: string[];
    onGenerateBib: (style: string) => void;
    handleAddCustomStyle: () => void;
    viewMode?: 'standard' | 'dual' | 'triple';
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
    isRightSidebarVisible,
    onToggleRightSidebar,
    activeLabel,
    displayLabel,
    onSwitchToPublishing,
    activeSectionId,
    isProcessing,
    onSmartWrite,
    onPolish,
    showBibMenu,
    setShowBibMenu,
    styleSearch,
    setStyleSearch,
    filteredStyles,
    onGenerateBib,
    handleAddCustomStyle,
    viewMode
}) => {
    const isTriple = viewMode === 'triple';
    const { t } = useTranslation();

    return (
        <div className="p-3 sm:p-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0 relative z-20">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {!isTriple && (
                    <button
                        onClick={onToggleRightSidebar}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 group ${!isRightSidebarVisible ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'text-slate-400 hover:text-indigo-600'}`}
                        title={isRightSidebarVisible ? t('writing.editorHeader.collapseSidebar') : t('writing.editorHeader.expandSidebar')}
                    >
                        <i className={`fa-solid ${!isRightSidebarVisible ? 'fa-indent' : 'fa-outdent'} group-hover:scale-110 transition-transform`}></i>
                    </button>
                )}
                <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase italic tracking-tighter truncate" title={activeLabel}>
                    <span className="text-indigo-600 mr-1.5 sm:mr-2">#</span>
                    {displayLabel}
                </h3>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {onSwitchToPublishing && (
                    <button
                        onClick={onSwitchToPublishing}
                        className="px-4 py-2 bg-sky-50 border border-sky-200 rounded-2xl text-[9px] font-black text-sky-600 uppercase hover:bg-sky-600 hover:text-white hover:border-sky-600 transition-all flex items-center gap-2 group/quick animate-reveal shadow-sm active:scale-95"
                    >
                        <i className="fa-solid fa-paper-plane group-hover/quick:translate-x-1 transition-transform"></i>
                        {!isTriple && t('writing.editorHeader.quickPublish')}
                    </button>
                )}

                {activeSectionId !== 'references' && (
                    <button
                        onClick={onSmartWrite}
                        disabled={isProcessing}
                        className="text-[9px] font-black uppercase tracking-widest bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-2xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                        title={t('writing.editorHeader.smartWrite')}
                    >
                        {isProcessing ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-robot"></i>}
                        {!isTriple && t('writing.editorHeader.smartWrite')}
                    </button>
                )}

                {activeSectionId === 'references' ? (
                    <div className="relative">
                        <button
                            onClick={() => { setShowBibMenu(!showBibMenu); setStyleSearch(''); }}
                            disabled={isProcessing}
                            className="text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 px-3 sm:px-4 py-2 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center gap-2 border border-emerald-100 active:scale-95"
                        >
                            {isProcessing ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-list-ol"></i>}
                            {!isTriple && t('writing.editorHeader.generateBib')}
                        </button>
                        {showBibMenu && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-reveal flex flex-col p-1.5">
                                <div className="p-2 border-b border-slate-100 mb-1">
                                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-1.5 border border-slate-200 focus-within:border-indigo-400 transition-all">
                                        <i className="fa-solid fa-magnifying-glass text-[10px] text-slate-400"></i>
                                        <input
                                            autoFocus
                                            className="bg-transparent border-none outline-none text-[10px] font-bold w-full text-slate-700"
                                            placeholder={t('writing.editorHeader.searchStyle')}
                                            value={styleSearch}
                                            onChange={e => setStyleSearch(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
                                    {filteredStyles.map((style, idx) => (
                                        <button
                                            key={style}
                                            onClick={() => { onGenerateBib(style); setShowBibMenu(false); }}
                                            className={`w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-[10px] font-black uppercase transition-colors flex items-center justify-between group ${idx !== filteredStyles.length - 1 ? 'border-b border-slate-50' : ''}`}
                                        >
                                            <span className="text-slate-700 group-hover:text-indigo-600">{style} Style</span>
                                            <i className="fa-solid fa-chevron-right text-[8px] opacity-0 group-hover:opacity-30"></i>
                                        </button>
                                    ))}
                                    {styleSearch && !filteredStyles.find(s => s.toLowerCase() === styleSearch.toLowerCase()) && (
                                        <button
                                            onClick={handleAddCustomStyle}
                                            className="w-full text-left px-4 py-3 bg-indigo-100 hover:bg-indigo-200 text-[10px] font-black uppercase text-indigo-600 flex items-center gap-2"
                                        >
                                            <i className="fa-solid fa-plus-circle"></i>
                                            {t('writing.editorHeader.addAndGenerate')} {styleSearch}
                                        </button>
                                    )}
                                </div>
                                <div className="p-2 border-t border-slate-100 mt-1">
                                    <p className="text-[8px] text-slate-400 font-bold text-center uppercase italic">{t('writing.editorHeader.addStyleHint')}</p>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={() => onPolish('academic')}
                        disabled={isProcessing}
                        className="text-[9px] font-black uppercase tracking-widest bg-violet-50 text-violet-600 border border-violet-200 px-3 sm:px-4 py-2 rounded-2xl hover:bg-violet-600 hover:text-white hover:border-violet-600 transition-all shadow-sm flex items-center gap-2 active:scale-95"
                        title={t('writing.editorHeader.academicPolish')}
                    >
                        <i className="fa-solid fa-wand-magic-sparkles"></i>
                        {!isTriple && 'Polish'}
                    </button>
                )}
            </div>
        </div>
    );
};
