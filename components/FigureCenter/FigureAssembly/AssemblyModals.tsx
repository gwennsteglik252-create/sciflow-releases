
import React from 'react';
import { SavedFigureAssembly } from '../../../types';


interface AssemblyModalsProps {
    showLibrary: boolean;
    setShowLibrary: (v: boolean) => void;
    savedAssemblies: SavedFigureAssembly[];
    handleLoadSaved: (item: SavedFigureAssembly) => void;
    handleDeleteSaved: (id: string, e: React.MouseEvent) => void;
    handleRenameSaved: (id: string, newTitle: string) => void;
    showSaveModal: boolean;
    setShowSaveModal: (v: boolean) => void;
    saveTitle: string;
    setSaveTitle: (v: string) => void;
    handleSaveConfirm: () => void;
}

export const AssemblyModals: React.FC<AssemblyModalsProps> = ({
    showLibrary, setShowLibrary, savedAssemblies, handleLoadSaved, handleDeleteSaved, handleRenameSaved,
    showSaveModal, setShowSaveModal, saveTitle, setSaveTitle, handleSaveConfirm
}) => {
    const [renamingId, setRenamingId] = React.useState<string | null>(null);
    const [tempTitle, setTempTitle] = React.useState('');

    return (
        <>
            {showLibrary && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[80vh]">
                        <h3 className="text-xl font-black text-slate-800 mb-6 uppercase italic border-l-4 border-indigo-600 pl-4">拼版方案库</h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                            {savedAssemblies.map(s => (
                                <div key={s.id} onClick={() => { if (renamingId !== s.id) handleLoadSaved(s); }} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group hover:border-indigo-300 transition-all cursor-pointer">
                                    <div className="flex-1 mr-4">
                                        {renamingId === s.id ? (
                                            <input
                                                className="w-full bg-white border border-indigo-300 rounded-lg px-2 py-1 text-[11px] font-black outline-none"
                                                value={tempTitle}
                                                onChange={e => setTempTitle(e.target.value)}
                                                onBlur={() => {
                                                    if (tempTitle.trim() && tempTitle !== s.title) {
                                                        handleRenameSaved(s.id, tempTitle);
                                                    }
                                                    setRenamingId(null);
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        if (tempTitle.trim() && tempTitle !== s.title) {
                                                            handleRenameSaved(s.id, tempTitle);
                                                        }
                                                        setRenamingId(null);
                                                    }
                                                }}
                                                autoFocus
                                                onClick={e => e.stopPropagation()}
                                            />
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[11px] font-black text-slate-800 uppercase">{s.title}</p>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setRenamingId(s.id);
                                                            setTempTitle(s.title);
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-all"
                                                    >
                                                        <i className="fa-solid fa-pen-to-square text-[9px]"></i>
                                                    </button>
                                                </div>
                                                <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">{s.timestamp}</p>
                                            </>
                                        )}
                                    </div>
                                    <button onClick={(e) => handleDeleteSaved(s.id, e)} className="w-8 h-8 rounded-lg bg-white text-rose-300 hover:text-rose-500 hover:shadow-sm"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                                </div>
                            ))}
                            {savedAssemblies.length === 0 && <p className="text-center py-10 text-[10px] text-slate-400 italic">暂无保存的拼版方案</p>}
                        </div>
                        <button onClick={() => setShowLibrary(false)} className="mt-6 w-full py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200">关闭</button>
                    </div>
                </div>
            )}

            {showSaveModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-slate-800 uppercase italic pl-2">保存当前拼版</h3>
                            {saveTitle.includes('正在 AI') && (
                                <div className="flex items-center gap-2 text-indigo-600 animate-pulse">
                                    <i className="fa-solid fa-sparkles text-xs"></i>
                                    <span className="text-[9px] font-black uppercase">AI Naming...</span>
                                </div>
                            )}
                        </div>
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none mb-6 focus:border-indigo-300" value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder="方案名称..." autoFocus />
                        <div className="flex gap-3">
                            <button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase">取消</button>
                            <button onClick={handleSaveConfirm} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl transition-all active:scale-95">确认保存</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
