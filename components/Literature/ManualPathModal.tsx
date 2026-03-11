
import React from 'react';

interface ManualPathModalProps {
  manualPathInput: string;
  setManualPathInput: (val: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

const ManualPathModal: React.FC<ManualPathModalProps> = ({ 
  manualPathInput, setManualPathInput, onCancel, onConfirm 
}) => (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 animate-reveal shadow-2xl border-4 border-white text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl shadow-inner bg-indigo-50 text-indigo-500">
                <i className="fa-solid fa-folder-open"></i>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-6 uppercase italic">关联本地路径</h3>
            <input 
                className="w-full bg-slate-50 border-none rounded-xl p-4 text-[11px] font-bold outline-none shadow-inner text-slate-700 mb-6" 
                value={manualPathInput} 
                onChange={e => setManualPathInput(e.target.value)} 
            />
            <div className="flex gap-4">
                <button onClick={onCancel} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase">取消</button>
                <button onClick={onConfirm} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase shadow-xl">确认关联</button>
            </div>
        </div>
    </div>
);

export default ManualPathModal;
