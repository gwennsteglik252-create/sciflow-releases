
import React from 'react';
import { SavedDiagram } from './types';
import { SchemeLibraryModal } from '../SchemeLibraryModal';


interface StructureModalsProps {
    showLibrary: boolean;
    setShowLibrary: (val: boolean) => void;
    savedDiagrams: SavedDiagram[];
    onLoad: (diagram: SavedDiagram) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onRename: (id: string, newTitle: string) => void;
    onCategoryChange: (id: string, newCategory: string) => void;

    showSaveModal: boolean;
    setShowSaveModal: (val: boolean) => void;
    saveTitle: string;
    setSaveTitle: (val: string) => void;
    onSave: () => void;
}

export const StructureModals: React.FC<StructureModalsProps> = ({
    showLibrary, setShowLibrary, savedDiagrams, onLoad, onDelete, onRename, onCategoryChange,
    showSaveModal, setShowSaveModal, saveTitle, setSaveTitle, onSave
}) => {
    return (
        <>
            <SchemeLibraryModal<SavedDiagram>
                show={showLibrary}
                onClose={() => setShowLibrary(false)}
                items={savedDiagrams}
                onLoad={onLoad}
                onDelete={onDelete}
                onRename={onRename}
                onCategoryChange={onCategoryChange}
                moduleIcon="fa-project-diagram"
                moduleLabel="结构图"
            />

            {showSaveModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-slate-800 uppercase italic pl-2">保存结构图</h3>
                            {saveTitle.includes('正在 AI') && (
                                <div className="flex items-center gap-2 text-indigo-600 animate-pulse">
                                    <i className="fa-solid fa-sparkles text-xs"></i>
                                    <span className="text-[9px] font-black uppercase">AI Naming...</span>
                                </div>
                            )}
                        </div>
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none mb-6 focus:border-indigo-300" value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder="输入图表标题..." autoFocus />
                        <div className="flex gap-3">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase">取消</button>
                            <button onClick={onSave} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl transition-all active:scale-95">确认保存</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
