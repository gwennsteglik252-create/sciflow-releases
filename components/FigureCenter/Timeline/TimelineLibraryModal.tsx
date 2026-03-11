import React from 'react';
import { SavedTimeline } from '../../../types/visuals';


interface TimelineLibraryModalProps {
    show: boolean;
    onClose: () => void;
    savedTimelines: SavedTimeline[];
    onLoad: (item: SavedTimeline) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    onRename: (id: string, newTitle: string) => void;

    showSaveModal: boolean;
    setShowSaveModal: (val: boolean) => void;
    saveTitle: string;
    setSaveTitle: (val: string) => void;
    onSave: () => void;
}

export const TimelineLibraryModal: React.FC<TimelineLibraryModalProps> = ({
    show, onClose, savedTimelines, onLoad, onDelete, onRename,
    showSaveModal, setShowSaveModal, saveTitle, setSaveTitle, onSave
}) => {
    const [renamingId, setRenamingId] = React.useState<string | null>(null);
    const [tempTitle, setTempTitle] = React.useState('');

    return (
        <>
            {show && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4 no-print">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[80vh]">
                        <h3 className="text-xl font-black text-slate-800 mb-6 uppercase italic border-l-4 border-indigo-600 pl-4">演进方案库</h3>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                            {savedTimelines.length > 0 ? (
                                savedTimelines.map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => { if (renamingId !== item.id) onLoad(item); }}
                                        className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group hover:border-indigo-300 transition-all cursor-pointer shadow-sm"
                                    >
                                        <div className="flex-1 min-w-0 pr-4">
                                            {renamingId === item.id ? (
                                                <input
                                                    className="w-full bg-white border border-indigo-300 rounded-lg px-2 py-1 text-[11px] font-black outline-none"
                                                    value={tempTitle}
                                                    onChange={e => setTempTitle(e.target.value)}
                                                    onBlur={() => {
                                                        if (tempTitle.trim() && tempTitle !== item.title) {
                                                            onRename(item.id, tempTitle);
                                                        }
                                                        setRenamingId(null);
                                                    }}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            if (tempTitle.trim() && tempTitle !== item.title) {
                                                                onRename(item.id, tempTitle);
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
                                                        <p className="text-[11px] font-black text-slate-800 uppercase truncate italic">{item.title}</p>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setRenamingId(item.id);
                                                                setTempTitle(item.title);
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-all"
                                                        >
                                                            <i className="fa-solid fa-pen-to-square text-[9px]"></i>
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">{item.timestamp}</span>
                                                        <span className="text-[7px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded uppercase">
                                                            {item.data.events.length} 节点
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => onDelete(item.id, e)}
                                            className="w-9 h-9 rounded-xl bg-white text-rose-300 hover:text-rose-500 hover:shadow-md transition-all flex items-center justify-center active:scale-90"
                                            title="删除存档"
                                        >
                                            <i className="fa-solid fa-trash-can text-[11px]"></i>
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 opacity-30 gap-3">
                                    <i className="fa-solid fa-folder-open text-4xl text-slate-300"></i>
                                    <p className="text-sm font-black uppercase tracking-widest text-slate-400 italic">暂无保存方案</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex flex-col gap-2 shrink-0">
                            <p className="text-[8px] text-slate-400 font-bold uppercase italic text-center mb-1">* 方案保存在本地浏览器缓存中</p>
                            <button
                                onClick={onClose}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-indigo-600 transition-all active:scale-95"
                            >
                                返回设计器
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSaveModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-slate-800 uppercase italic pl-2">保存演进路线</h3>
                            {saveTitle.includes('正在 AI') && (
                                <div className="flex items-center gap-2 text-indigo-600 animate-pulse">
                                    <i className="fa-solid fa-sparkles text-xs"></i>
                                    <span className="text-[9px] font-black uppercase">AI Naming...</span>
                                </div>
                            )}
                        </div>
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none mb-6 focus:border-indigo-300" value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder="名称..." autoFocus />
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