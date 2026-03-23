import React from 'react';
import { SavedCircularSummary } from '../../../types';
import { SchemeLibraryModal } from '../SchemeLibraryModal';

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
    onCategoryChange: (id: string, newCategory: string) => void;

    showSave: boolean;
    setShowSave: (v: boolean) => void;
    saveTitle: string;
    setSaveTitle: (v: string) => void;
    onSaveConfirm: () => void;
}

export const SummaryModals: React.FC<SummaryModalsProps> = ({
    showAddLayer, setShowAddLayer, newLayerName, setNewLayerName, onConfirmAddLayer,
    showRenameLayer, setShowRenameLayer, tempLayerName, setTempLayerName, onConfirmRenameLayer,
    showLibrary, setShowLibrary, savedSummaries, onLoadSaved, onDeleteSaved, onRenameSaved, onCategoryChange,
    showSave, setShowSave, saveTitle, setSaveTitle, onSaveConfirm
}) => {
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

            <SchemeLibraryModal
                show={showLibrary}
                onClose={() => setShowLibrary(false)}
                items={savedSummaries}
                onLoad={onLoadSaved}
                onDelete={onDeleteSaved}
                onRename={onRenameSaved}
                onCategoryChange={onCategoryChange}
                moduleIcon="fa-circle-nodes"
                moduleLabel="综述圆环"
            />

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