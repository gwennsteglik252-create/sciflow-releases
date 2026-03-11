import React from 'react';

export interface SafeModalConfig {
  show: boolean;
  title: string;
  desc: string;
  onConfirm?: () => void;
  isAlert?: boolean;
}

interface SafeModalProps {
  config: SafeModalConfig | null;
  onClose: () => void;
}

const SafeModal: React.FC<SafeModalProps> = ({ config, onClose }) => {
  if (!config || !config.show) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 animate-reveal shadow-2xl border-4 border-white text-center">
         <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl shadow-inner ${config.isAlert ? 'bg-indigo-50 text-indigo-500' : 'bg-rose-50 text-rose-500'}`}>
            <i className={`fa-solid ${config.isAlert ? 'fa-info-circle' : 'fa-triangle-exclamation'}`}></i>
         </div>
         <h3 className="text-xl font-black text-slate-800 mb-2 uppercase italic tracking-tighter">{config.title}</h3>
         <p className={`text-[11px] text-slate-500 font-medium leading-relaxed mb-8 italic`}>{config.desc}</p>
         <div className="flex gap-4">
            {!config.isAlert && (
                <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase">取消</button>
            )}
            <button onClick={config.onConfirm || onClose} className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase shadow-xl transition-all ${config.isAlert ? 'bg-indigo-600 text-white hover:bg-black' : 'bg-rose-500 text-white shadow-rose-100 active:scale-95'}`}>
                {config.isAlert ? '知道了' : '确定执行'}
            </button>
         </div>
      </div>
    </div>
  );
};

export default SafeModal;