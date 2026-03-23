
import React from 'react';
import { TransformationProposal } from '../../types';

interface EditProposalContentModalProps {
  show: boolean;
  onClose: () => void;
  proposal: TransformationProposal | null;
  setProposal: (prop: TransformationProposal) => void;
  onSave: () => void;
}

const EditProposalContentModal: React.FC<EditProposalContentModalProps> = ({ show, onClose, proposal, setProposal, onSave }) => {
  if (!show || !proposal) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1300] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-[3rem] p-10 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[90vh]">
        <h3 className="text-xl font-black text-slate-800 mb-6 uppercase italic border-l-8 border-indigo-600 pl-6 shrink-0">修订工艺方案内容</h3>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
            <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block px-1">核心科学假设 (Scientific Hypothesis)</label>
                <textarea 
                    className="w-full bg-slate-50 rounded-2xl p-4 text-xs font-medium leading-relaxed outline-none border border-transparent focus:border-indigo-100 resize-none h-32" 
                    value={proposal.scientificHypothesis} 
                    onChange={e => setProposal({...proposal, scientificHypothesis: e.target.value})} 
                />
            </div>
            <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block px-1">关键工艺变更 (Process Changes)</label>
                <textarea 
                    className="w-full bg-slate-50 rounded-2xl p-4 text-xs font-medium leading-relaxed outline-none border border-transparent focus:border-indigo-100 resize-none h-48" 
                    value={proposal.processChanges} 
                    onChange={e => setProposal({...proposal, processChanges: e.target.value})} 
                />
            </div>
        </div>

        <div className="flex gap-4 pt-6 shrink-0">
          <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase">取消</button>
          <button onClick={onSave} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl">确认修订</button>
        </div>
      </div>
    </div>
  );
};

export default EditProposalContentModal;
