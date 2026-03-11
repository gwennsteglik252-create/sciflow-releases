
import React from 'react';

interface MirrorPanelProps {
  onRunMirrorAnalysis: () => void;
  isProcessing: boolean;
  mirrorInsight: {
    planIntent: string;
    experimentalFact: string;
    synthesisConclusion: string;
  } | null;
  onInsertText: (text: string) => void;
}

const MirrorPanel: React.FC<MirrorPanelProps> = ({
  onRunMirrorAnalysis, isProcessing, mirrorInsight, onInsertText
}) => {
  return (
    <div className="space-y-6 animate-reveal">
      <div className="p-4 border-2 border-dashed border-indigo-200 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group bg-slate-50/50 cursor-pointer" onClick={onRunMirrorAnalysis}>
         <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
           <i className="fa-solid fa-clone"></i>
         </div>
         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">
          {isProcessing ? '正在对标数据...' : '执行“预期 vs 现实”镜像对标'}
         </p>
      </div>

      {mirrorInsight ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
             <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl relative overflow-hidden">
                <h5 className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-2">计划初衷 (INTENT)</h5>
                <p className="text-[10px] font-bold text-slate-700 leading-relaxed italic">{mirrorInsight.planIntent}</p>
             </div>
             <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl relative overflow-hidden">
                <h5 className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-2">实验证据 (EVIDENCE)</h5>
                <p className="text-[10px] font-bold text-slate-700 leading-relaxed italic">{mirrorInsight.experimentalFact}</p>
             </div>
          </div>
          <div className="p-5 bg-slate-900 rounded-[2rem] border border-white/5 shadow-xl relative group">
             <div className="flex justify-between items-center mb-3">
                <h5 className="text-[9px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2"><i className="fa-solid fa-wand-magic-sparkles text-amber-300"></i> 响应式结论</h5>
                <button onClick={() => onInsertText(mirrorInsight.synthesisConclusion)} className="text-[8px] font-black text-white px-2 py-1 bg-white/10 rounded-lg hover:bg-indigo-600 transition-all">插入正文</button>
             </div>
             <p className="text-[11px] font-medium text-indigo-50/90 leading-[1.8] text-justify italic">{mirrorInsight.synthesisConclusion}</p>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 opacity-30 flex flex-col items-center gap-4">
           <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center"><i className="fa-solid fa-columns text-2xl"></i></div>
           <p className="text-[10px] font-black uppercase tracking-widest">请启动对标引擎</p>
        </div>
      )}
    </div>
  );
};

export default MirrorPanel;
