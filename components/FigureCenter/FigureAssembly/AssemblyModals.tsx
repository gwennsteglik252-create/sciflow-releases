
import React from 'react';
import { SavedFigureAssembly } from '../../../types';
import { useTranslation } from '../../../locales/useTranslation';
import { SchemeLibraryModal } from '../SchemeLibraryModal';


interface AssemblyModalsProps {
    showLibrary: boolean;
    setShowLibrary: (v: boolean) => void;
    savedAssemblies: SavedFigureAssembly[];
    handleLoadSaved: (item: SavedFigureAssembly) => void;
    handleDeleteSaved: (id: string, e: React.MouseEvent) => void;
    handleRenameSaved: (id: string, newTitle: string) => void;
    onCategoryChange: (id: string, newCategory: string) => void;
    showSaveModal: boolean;
    setShowSaveModal: (v: boolean) => void;
    saveTitle: string;
    setSaveTitle: (v: string) => void;
    handleSaveConfirm: () => void;
}

export const AssemblyModals: React.FC<AssemblyModalsProps> = ({
    showLibrary, setShowLibrary, savedAssemblies, handleLoadSaved, handleDeleteSaved, handleRenameSaved, onCategoryChange,
    showSaveModal, setShowSaveModal, saveTitle, setSaveTitle, handleSaveConfirm
}) => {
    const { t } = useTranslation();

    return (
        <>
            <SchemeLibraryModal<SavedFigureAssembly>
                show={showLibrary}
                onClose={() => setShowLibrary(false)}
                items={savedAssemblies}
                onLoad={handleLoadSaved}
                onDelete={handleDeleteSaved}
                onRename={handleRenameSaved}
                onCategoryChange={onCategoryChange}
                moduleIcon="fa-table-cells"
                moduleLabel="拼版"
            />

            {showSaveModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-slate-800 uppercase italic pl-2">{t('figureCenter.assembly.saveTitle')}</h3>
                            {saveTitle.includes('正在 AI') && (
                                <div className="flex items-center gap-2 text-indigo-600 animate-pulse">
                                    <i className="fa-solid fa-sparkles text-xs"></i>
                                    <span className="text-[9px] font-black uppercase">AI Naming...</span>
                                </div>
                            )}
                        </div>
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none mb-6 focus:border-indigo-300" value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder={t('figureCenter.assembly.schemeName')} autoFocus />
                        <div className="flex gap-3">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase">{t('figureCenter.assembly.cancel')}</button>
                            <button onClick={handleSaveConfirm} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl transition-all active:scale-95">{t('figureCenter.assembly.confirmSave')}</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
