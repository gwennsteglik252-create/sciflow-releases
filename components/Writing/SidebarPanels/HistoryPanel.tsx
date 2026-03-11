import React, { useState } from 'react';
import { WritingSnapshot } from '../../../types';

interface HistoryPanelProps {
  snapshots: WritingSnapshot[];
  onCreateSnapshot: (name: string) => void;
  onRestoreSnapshot: (snapshot: WritingSnapshot) => void;
  onDeleteSnapshot: (id: string) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ 
  snapshots, onCreateSnapshot, onRestoreSnapshot, onDeleteSnapshot 
}) => {
  const [newName, setNewName] = useState('');

  return (
    <div className="flex flex-col gap-4 animate-reveal h-full">
       <div className="bg-indigo-50/50 p-5 rounded-[2rem] border border-indigo-100 shrink-0">
          <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-2">
             <i className="fa-solid fa-camera-retro"></i> 创建全量工作区快照
          </p>
          <div className="flex gap-2">
             <input 
               className="flex-1 bg-white border border-indigo-200 rounded-xl px-3 py-2 text-[10px] font-bold outline-none text-slate-700 shadow-sm focus:ring-2 focus:ring-indigo-100 transition-all"
               placeholder="例如: 初稿完成, 投稿前备份..."
               value={newName}
               onChange={e => setNewName(e.target.value)}
               onKeyDown={e => { if(e.key === 'Enter' && newName.trim()) { onCreateSnapshot(newName); setNewName(''); }}}
             />
             <button 
               onClick={() => { if(newName.trim()) { onCreateSnapshot(newName); setNewName(''); }}}
               className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-50 transition-all hover:bg-black"
               disabled={!newName.trim()}
             >
               <i className="fa-solid fa-plus text-xs"></i>
             </button>
          </div>
          <p className="text-[7px] text-slate-400 mt-2 italic px-1">注：快照将冻结当前文字、图片引用、表格及作者配置。</p>
       </div>

       <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">历史存盘记录</p>
          {snapshots.map((snap) => (
             <div key={snap.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                <div className="flex justify-between items-start mb-2">
                   <h5 className="text-[11px] font-black text-slate-800 line-clamp-1 italic pr-8">{snap.title}</h5>
                   <div className="flex items-center gap-1.5">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                   </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                        <span className="text-[7px] text-slate-400 uppercase block font-black">时间戳</span>
                        <span className="text-[8px] font-mono text-slate-600 font-bold">{snap.timestamp}</span>
                    </div>
                    <div className="bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                        <span className="text-[7px] text-slate-400 uppercase block font-black">资产概览</span>
                        <div className="flex gap-2 mt-0.5">
                            <span className="text-[8px] font-black text-indigo-500" title="章节数"><i className="fa-solid fa-file-lines mr-1"></i>{snap.paperSections.length}</span>
                            <span className="text-[8px] font-black text-emerald-500" title="引用文献数"><i className="fa-solid fa-quote-right mr-1"></i>{snap.citedLiteratureIds?.length || 0}</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex gap-2 mt-2 pt-2 border-t border-slate-50 opacity-100 sm:opacity-40 sm:group-hover:opacity-100 transition-opacity">
                   <button 
                     onClick={() => onRestoreSnapshot(snap)}
                     className="flex-1 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-1.5 active:scale-95"
                   >
                     <i className="fa-solid fa-clock-rotate-left"></i> 完整恢复
                   </button>
                   <button 
                     onClick={() => onDeleteSnapshot(snap.id)}
                     className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center active:scale-95 shadow-sm"
                     title="删除快照"
                   >
                     <i className="fa-solid fa-trash-can text-[10px]"></i>
                   </button>
                </div>
             </div>
          ))}
          {snapshots.length === 0 && (
             <div className="text-center py-20 opacity-30 flex flex-col items-center gap-3">
                <i className="fa-solid fa-box-archive text-4xl text-slate-300"></i>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">暂无快照记录</p>
             </div>
          )}
       </div>
    </div>
  );
};

export default HistoryPanel;