import React, { useState } from 'react';
import { useTranslation } from '../../../locales/useTranslation';
import { LogTemplate } from '../../../hooks/useLogModalLogic';

interface LogHeaderProps {
    onClose: () => void;
    templates: LogTemplate[];
    onTriggerNaming: () => void;
    onLoadTemplate: (tpl: LogTemplate) => void;
    onDeleteTemplate: (id: string) => void;
    isScanning: boolean;
    onScanClick: () => void;
    notebookInputRef: React.RefObject<HTMLInputElement | null>;
    handleNotebookScan: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const LogHeader: React.FC<LogHeaderProps> = ({
    onClose, templates, onTriggerNaming, onLoadTemplate, onDeleteTemplate,
    isScanning, onScanClick, notebookInputRef, handleNotebookScan
}) => {
    const [showTemplateMenu, setShowTemplateMenu] = useState(false);
    const { t } = useTranslation();

    return (
        <div className="shrink-0 relative">
            <button onClick={onClose} className="absolute top-2 -right-2 w-10 h-10 rounded-full bg-slate-100 text-slate-400 hover:bg-rose-500 hover:text-white transition-all active:scale-90 z-20 shadow-sm border border-slate-200">
                <i className="fa-solid fa-times text-lg"></i>
            </button>

            <header className="mb-6 shrink-0 pt-1 flex flex-col md:flex-row items-center justify-between pr-10">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                    <div className="w-1.5 h-8 bg-indigo-600 rounded-full"></div>
                    <h3 className="text-xl lg:text-2xl font-black text-slate-800 uppercase italic leading-none">{t('logModal.header.title')}</h3>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner">
                    <div className="relative">
                        <button
                            onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                            className={`h-9 px-5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all border ${showTemplateMenu ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-500 border-slate-200 hover:text-indigo-600 hover:border-indigo-100 shadow-sm'}`}
                        >
                            <i className="fa-solid fa-layer-group text-[12px]"></i> {t('logModal.header.templatePreset')}
                            <i className={`fa-solid fa-chevron-down text-[8px] transition-transform ${showTemplateMenu ? 'rotate-180' : ''}`}></i>
                        </button>

                        {showTemplateMenu && (
                            <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-reveal">
                                <div className="p-2 border-b border-slate-100 bg-slate-50">
                                    <button
                                        onClick={() => { onTriggerNaming(); setShowTemplateMenu(false); }}
                                        className="w-full text-center py-2.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase shadow-md hover:bg-black transition-all"
                                    >
                                        <i className="fa-solid fa-plus-circle mr-1.5"></i> {t('logModal.header.saveAsNewTemplate')}
                                    </button>
                                </div>
                                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                    {templates.map(tpl => (
                                        <div key={tpl.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-indigo-50 group border-b border-slate-50 last:border-0 cursor-pointer" onClick={() => { onLoadTemplate(tpl); setShowTemplateMenu(false); }}>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[11px] font-bold text-slate-700 truncate uppercase tracking-tight">{tpl.name}</span>
                                                <span className="text-[8px] text-slate-400 font-black uppercase mt-0.5">{tpl.parameters?.length || 0} PARAMS</span>
                                            </div>
                                            <button onClick={(e) => { e.stopPropagation(); onDeleteTemplate(tpl.id); }} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                                <i className="fa-solid fa-trash-can text-[10px]"></i>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="w-px h-5 bg-slate-300/50 mx-1"></div>

                    <input type="file" ref={notebookInputRef} className="hidden" accept="image/*" onChange={handleNotebookScan} />
                    <button
                        onClick={onScanClick}
                        disabled={isScanning}
                        className={`h-9 px-6 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-xl transition-all active:scale-95 border border-transparent ${isScanning ? 'bg-slate-200 text-slate-400' : 'bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:shadow-orange-200 hover:brightness-105 border-orange-300/30'}`}
                    >
                        {isScanning ? <i className="fa-solid fa-spinner animate-spin text-[12px]"></i> : <i className="fa-solid fa-camera-retro text-[12px]"></i>}
                        {isScanning ? t('logModal.header.isScanning') : t('logModal.header.scanNotebook')}
                    </button>
                </div>
            </header>
        </div>
    );
};
