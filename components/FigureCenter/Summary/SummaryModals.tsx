import React from 'react';
import { SavedCircularSummary } from '../../../types';

interface SummaryModalsProps {
    showAddLayer: boolean;
    setShowAddLayer: (v: boolean) => void;
    newLayerName: string;
    setNewLayerName: (v: string) => void;
    onConfirmAddLayer: () => void;

    showRenameLayer: boolean;
    setShowRenameLayer: (v: boolean) => void;
    tempLayerName: string;
    setTempLayerName: (v: string) => void;
    onConfirmRenameLayer: () => void;

    showLibrary: boolean;
    setShowLibrary: (v: boolean) => void;
    savedSummaries: SavedCircularSummary[];
    onLoadSaved: (item: SavedCircularSummary) => void;
    onDeleteSaved: (id: string, e: React.MouseEvent) => void;
    onRenameSaved: (id: string, newTitle: string) => void;

    showSave: boolean;
    setShowSave: (v: boolean) => void;
    saveTitle: string;
    setSaveTitle: (v: string) => void;
    onSaveConfirm: () => void;
}

export const SummaryModals: React.FC<SummaryModalsProps> = ({
    showAddLayer, setShowAddLayer, newLayerName, setNewLayerName, onConfirmAddLayer,
    showRenameLayer, setShowRenameLayer, tempLayerName, setTempLayerName, onConfirmRenameLayer,
    showLibrary, setShowLibrary, savedSummaries, onLoadSaved, onDeleteSaved, onRenameSaved,
    showSave, setShowSave, saveTitle, setSaveTitle, onSaveConfirm
}) => {
    const [renamingId, setRenamingId] = React.useState<string | null>(null);
    const [tempTitle, setTempTitle] = React.useState('');

    return (
        <>
            {showAddLayer && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[4000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white">
                        <h3 className="text-lg font-black text-slate-800 mb-6 uppercase italic pl-2">新增层级拓扑</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block px-1">层级名称</label>
                                <input
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-indigo-400"
                                    value={newLayerName}
                                    onChange={e => setNewLayerName(e.target.value)}
                                    placeholder="如：工程应用层..."
                                    autoFocus
                                    onKeyDown={e => e.key === 'Enter' && onConfirmAddLayer()}
                                />
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowAddLayer(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase">取消</button>
                                <button onClick={onConfirmAddLayer} disabled={!newLayerName.trim()} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl">确定</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showRenameLayer && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[4000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white">
                        <h3 className="text-lg font-black text-slate-800 mb-6 uppercase italic pl-2">重命名层级</h3>
                        <div className="space-y-4">
                            <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none" value={tempLayerName} onChange={e => setTempLayerName(e.target.value)} autoFocus />
                            <div className="flex gap-3">
                                <button onClick={() => setShowRenameLayer(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase">取消</button>
                                <button onClick={onConfirmRenameLayer} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl">更新</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showLibrary && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4 no-print">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[80vh]">
                        <h3 className="text-xl font-black text-slate-800 mb-6 uppercase italic border-l-4 border-indigo-600 pl-4">综述方案库</h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                            {savedSummaries.map(s => (
                                <div key={s.id} onClick={() => { if (renamingId !== s.id) onLoadSaved(s); }} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group hover:border-indigo-300 transition-all cursor-pointer">
                                    <div className="flex-1 mr-4">
                                        {renamingId === s.id ? (
                                            <input
                                                className="w-full bg-white border border-indigo-300 rounded-lg px-2 py-1 text-[11px] font-black outline-none"
                                                value={tempTitle}
                                                onChange={e => setTempTitle(e.target.value)}
                                                onBlur={() => {
                                                    if (tempTitle.trim() && tempTitle !== s.title) {
                                                        onRenameSaved(s.id, tempTitle);
                                                    }
                                                    setRenamingId(null);
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        if (tempTitle.trim() && tempTitle !== s.title) {
                                                            onRenameSaved(s.id, tempTitle);
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
                                                    <p className="text-[11px] font-black text-slate-800 uppercase italic truncate">{s.title}</p>
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
                                    <button onClick={(e) => onDeleteSaved(s.id, e)} className="w-8 h-8 rounded-lg bg-white text-rose-300 hover:text-rose-500 shadow-sm transition-all active:scale-95"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                                </div>
                            ))}
                            {savedSummaries.length === 0 && <p className="text-center py-10 text-[10px] text-slate-400 italic">暂无保存方案</p>}
                        </div>
                        <button onClick={() => setShowLibrary(false)} className="mt-6 w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-slate-800 transition-all">关闭</button>
                    </div>
                </div>
            )}

            {showSave && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-slate-800 uppercase italic pl-2">保存综述方案</h3>
                            {saveTitle.includes('正在 AI') && (
                                <div className="flex items-center gap-2 text-indigo-600 animate-pulse">
                                    <i className="fa-solid fa-sparkles text-xs"></i>
                                    <span className="text-[9px] font-black uppercase">AI Naming...</span>
                                </div>
                            )}
                        </div>
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none mb-6 focus:border-indigo-400" value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder="方案名称..." autoFocus />
                        <div className="flex gap-3">
                            <button onClick={() => setShowSave(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase">取消</button>
                            <button onClick={onSaveConfirm} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl transition-all active:scale-95">确认保存</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};