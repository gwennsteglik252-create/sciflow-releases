
import React from 'react';

interface AddNodeModalProps {
  show: boolean;
  onClose: () => void;
  data: { title: string; hypothesis: string; date: string; parentId?: string };
  setData: (data: any) => void;
  onSave: () => void;
}

export const AddNodeModal: React.FC<AddNodeModalProps> = ({ show, onClose, data, setData, onSave }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1300] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 animate-reveal shadow-2xl relative border-4 border-white">
        <h3 className="text-xl font-black text-slate-800 mb-8 uppercase italic border-l-8 border-indigo-600 pl-6">
          {data.parentId ? '创建拓扑分支' : '创建新研究节点'}
        </h3>
        <div className="space-y-4">
          <input 
            className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold outline-none border border-transparent focus:border-indigo-100" 
            placeholder="节点标题..." 
            value={data.title} 
            onChange={e => setData({...data, title: e.target.value})} 
          />
          <textarea 
            className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold outline-none h-24 border border-transparent focus:border-indigo-100 resize-none" 
            placeholder="核心假设 (Hypothesis)..." 
            value={data.hypothesis} 
            onChange={e => setData({...data, hypothesis: e.target.value})} 
          />
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase">取消</button>
            <button onClick={onSave} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl">确认创建</button>
          </div>
        </div>
      </div>
    </div>
  );
};
