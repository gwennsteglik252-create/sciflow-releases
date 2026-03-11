
import React from 'react';
import { ProposalStatus } from '../../types';

interface EditProposalModalProps {
  show: boolean;
  onClose: () => void;
  data: { title: string; status: ProposalStatus };
  setData: (data: any) => void;
  onSave: () => void;
}

const EditProposalModal: React.FC<EditProposalModalProps> = ({ show, onClose, data, setData, onSave }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1300] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 animate-reveal shadow-2xl relative border-4 border-white">
        <h3 className="text-xl font-black text-slate-800 mb-8 uppercase italic border-l-8 border-indigo-600 pl-6">编辑方案属性</h3>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block px-1">方案标题</label>
            <input 
              className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold outline-none border border-transparent focus:border-indigo-100" 
              placeholder="输入方案标题..." 
              value={data.title} 
              onChange={e => setData({...data, title: e.target.value})} 
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block px-1">路线类型</label>
            <select 
              className="w-full bg-slate-50 rounded-2xl p-4 text-xs font-bold outline-none cursor-pointer" 
              value={data.status} 
              onChange={e => setData({...data, status: e.target.value as any})}
            >
              <option value="main">Main Route (主路线)</option>
              <option value="sub">Sub Route (分支)</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase">取消</button>
            <button onClick={onSave} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl">保存修改</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProposalModal;
