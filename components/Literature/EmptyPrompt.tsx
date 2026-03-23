
import React from 'react';

interface EmptyPromptProps {
  icon: string;
  text: string;
}

const EmptyPrompt: React.FC<EmptyPromptProps> = ({ icon, text }) => (
    <div className="h-full flex flex-col items-center justify-center text-slate-300 bg-slate-50/30 gap-6">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
            <i className={`fa-solid ${icon} text-3xl opacity-10`}></i>
        </div>
        <p className="text-[11px] font-black uppercase tracking-[0.4rem] opacity-30 italic">{text}</p>
    </div>
);

export default EmptyPrompt;
