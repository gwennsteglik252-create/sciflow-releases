import React, { useState, useEffect } from 'react';

interface RenameModalProps {
  show: boolean;
  title: string;
  initialValue: string;
  onClose: () => void;
  onConfirm: (val: string) => void;
}

const RenameModal: React.FC<RenameModalProps> = ({ show, title, initialValue, onClose, onConfirm }) => {
  const [val, setVal] = useState(initialValue);
  useEffect(() => { if (show) setVal(initialValue); }, [show, initialValue]);
  
  if (!show) return null;
  
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white">
        <h3 className="text-xl font-black text-slate-800 mb-6 uppercase italic border-l-4 border-indigo-600 pl-4">{title}</h3>
        <input 
          autoFocus
          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none mb-6" 
          value={val} 
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onConfirm(val)}
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase">取消</button>
          <button onClick={() => onConfirm(val)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl">确认重命名</button>
        </div>
      </div>
    </div>
  );
};

export default RenameModal;