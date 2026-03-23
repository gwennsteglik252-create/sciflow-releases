import React, { useState, useEffect } from 'react';

interface TemplateSaveModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  defaultName?: string;
}

const TemplateSaveModal: React.FC<TemplateSaveModalProps> = ({ show, onClose, onSave, defaultName = '' }) => {
  const [newTemplateName, setNewTemplateName] = useState(defaultName);

  useEffect(() => {
    if (show) {
      setNewTemplateName(defaultName);
    }
  }, [show, defaultName]);

  if (!show) return null;

  return (
    <div className="lab-modal-overlay fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
      <div className="lab-modal-content bg-white w-full max-w-sm rounded-[3rem] p-10 animate-reveal shadow-2xl border-4 border-white">
         <h3 className="lab-modal-title text-xl font-black text-slate-800 mb-6 uppercase italic tracking-tighter border-l-4 border-indigo-600 pl-4">保存图表模板</h3>
         <div className="lab-modal-body space-y-4">
            <label className="lab-label text-[10px] font-black text-slate-400 uppercase block px-1">模板名称</label>
            <input 
                autoFocus 
                className="lab-input w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold outline-none shadow-inner" 
                placeholder="如: 学术风格 V1..." 
                value={newTemplateName} 
                onChange={e => setNewTemplateName(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && newTemplateName.trim() && onSave(newTemplateName)}
            />
         </div>
         <div className="lab-modal-actions flex gap-4 mt-8">
            <button onClick={onClose} className="lab-btn flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase">取消</button>
            <button onClick={() => onSave(newTemplateName)} disabled={!newTemplateName.trim()} className="lab-btn flex-1 py-4 bg-indigo-600 text-white rounded-2xl lg:rounded-2xl text-[11px] font-black uppercase shadow-xl active:scale-95 disabled:opacity-50">确认保存</button>
         </div>
      </div>
    </div>
  );
};

export default TemplateSaveModal;