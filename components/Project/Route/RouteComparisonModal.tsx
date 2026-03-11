import React from 'react';
import { TransformationProposal } from '../../../types';

interface RouteComparisonModalProps {
    onClose: () => void;
    comparedProposals: TransformationProposal[];
    comparisonData: { key: string; val1: string; val2: string; isDiff: boolean }[] | null;
}

export const RouteComparisonModal: React.FC<RouteComparisonModalProps> = ({ 
    onClose, comparedProposals, comparisonData 
}) => {
    if (!comparisonData || comparedProposals.length !== 2) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-[3rem] p-8 animate-reveal shadow-2xl relative border-4 border-white overflow-hidden flex flex-col max-h-[85vh]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter border-l-4 border-amber-500 pl-4">工艺路线深度对比</h3>
                    <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><i className="fa-solid fa-times"></i></button>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-4 border-b border-slate-100 pb-4">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center self-end">Key Parameter</div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                        <p className="text-[9px] font-black text-indigo-600 truncate">{comparedProposals[0].title}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                        <p className="text-[9px] font-black text-violet-600 truncate">{comparedProposals[1].title}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    {comparisonData.map((row, idx) => (
                        <div key={idx} className={`grid grid-cols-3 gap-4 p-3 rounded-xl items-center ${row.isDiff ? 'bg-amber-50/50 border border-amber-100' : 'border-b border-slate-50'}`}>
                            <div className="text-[10px] font-bold text-slate-600 text-center normal-case">{row.key}</div>
                            <div className={`text-[11px] font-black text-center ${row.isDiff ? 'text-amber-700' : 'text-slate-400'}`}>{row.val1}</div>
                            <div className={`text-[11px] font-black text-center ${row.isDiff ? 'text-amber-700' : 'text-slate-400'}`}>{row.val2}</div>
                        </div>
                    ))}
                </div>
                
                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                    <button onClick={onClose} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase">Close Comparison</button>
                </div>
            </div>
        </div>
    );
};