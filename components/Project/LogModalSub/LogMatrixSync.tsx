
import React from 'react';
import { MatrixDataset } from '../../../types';

interface LogMatrixSyncProps {
  pushToMatrix: boolean;
  setPushToMatrix: (val: boolean) => void;
  projectMatrices: MatrixDataset[];
  selectedMatrixId: string;
  setSelectedMatrixId: (val: string) => void;
  matrixSampleId: string;
  setMatrixSampleId: (val: string) => void;
  matrixNote: string;
  setMatrixNote: (val: string) => void;
  matrixProcessParams: {key: string, value: string, unit: string}[];
  setMatrixProcessParams: (val: {key: string, value: string, unit: string}[]) => void;
  matrixResults: {key: string, value: string, unit: string}[];
  setMatrixResults: (val: {key: string, value: string, unit: string}[]) => void;
}

export const LogMatrixSync: React.FC<LogMatrixSyncProps> = ({
  pushToMatrix, setPushToMatrix, projectMatrices, selectedMatrixId, setSelectedMatrixId,
  matrixSampleId, setMatrixSampleId, matrixNote, setMatrixNote, matrixProcessParams, setMatrixProcessParams, matrixResults, setMatrixResults
}) => {
  return (
    <div className="bg-indigo-50/50 rounded-3xl p-4 mb-4 border border-indigo-100 shrink-0 shadow-inner">
        <div className="flex justify-between items-center cursor-pointer" onClick={() => setPushToMatrix(!pushToMatrix)}>
            <div className="flex items-center gap-3">
                <i className="fa-solid fa-table-cells text-indigo-600 text-sm"></i>
                <span className="text-xs font-black text-indigo-800 uppercase tracking-widest">推送到项目性能矩阵</span>
            </div>
            <div className={`w-10 h-6 rounded-full p-1 transition-colors duration-300 ${pushToMatrix ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${pushToMatrix ? 'translate-x-4' : ''}`}></div>
            </div>
        </div>
        
        {pushToMatrix && (
            <div className="mt-4 animate-reveal">
                {projectMatrices.length > 0 ? (
                    <div className="bg-white p-4 rounded-2xl border border-indigo-100 mb-3 shadow-sm">
                        <label className="text-[10px] font-black text-slate-400 uppercase block mb-1.5">Target Matrix (目标矩阵)</label>
                        <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none text-slate-700 cursor-pointer hover:border-indigo-300 transition-colors"
                            value={selectedMatrixId}
                            onChange={(e) => setSelectedMatrixId(e.target.value)}
                        >
                            {projectMatrices.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                        </select>
                    </div>
                ) : (
                    <div className="text-[10px] text-amber-500 italic mb-3 text-center">System will create "Default Matrix"</div>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-4 mb-3">
                    <div className="flex-1 flex items-center gap-3 w-full">
                        <span className="text-[10px] font-black text-slate-500 uppercase shrink-0">Sample ID:</span>
                        <input className="flex-1 bg-white border border-indigo-100 rounded-xl px-3 py-2.5 text-xs font-black outline-none text-indigo-700 shadow-inner" value={matrixSampleId} onChange={e => setMatrixSampleId(e.target.value)} />
                    </div>
                    <div className="flex-[2] flex items-center gap-3 w-full">
                        <span className="text-[10px] font-black text-slate-500 uppercase shrink-0">Note:</span>
                        <input className="flex-1 bg-white border border-indigo-100 rounded-xl px-3 py-2.5 text-xs font-bold outline-none text-slate-700 shadow-inner" placeholder="添加实验备注..." value={matrixNote} onChange={e => setMatrixNote(e.target.value)} />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 relative group/box shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Process Params (X)</p>
                            <button type="button" onClick={(e) => {e.preventDefault(); setMatrixProcessParams([...matrixProcessParams, {key: '', value: '', unit: ''}]);}} className="text-indigo-500 hover:text-indigo-700"><i className="fa-solid fa-plus-circle text-xs"></i></button>
                        </div>
                        <div className="max-h-32 overflow-y-auto custom-scrollbar">
                            {matrixProcessParams.map((p, i) => (
                                <div key={i} className="flex gap-2 mb-1.5 items-center group/row">
                                    <input className="flex-[2.5] min-w-0 bg-slate-50 rounded-lg px-2 py-1.5 text-xs border-none outline-none font-bold" value={p.key} onChange={e => {const n=[...matrixProcessParams]; n[i].key=e.target.value; setMatrixProcessParams(n)}} placeholder="Name" />
                                    <input className="flex-[1.2] min-w-0 bg-slate-50 rounded-lg px-2 py-1.5 text-xs border-none outline-none text-right font-black text-indigo-600" value={p.value} onChange={e => {const n=[...matrixProcessParams]; n[i].value=e.target.value; setMatrixProcessParams(n)}} placeholder="Val" />
                                    <input className="flex-1 min-w-0 bg-slate-50 rounded-lg px-2 py-1.5 text-[10px] border-none outline-none text-center font-bold text-slate-400" value={p.unit} onChange={e => {const n=[...matrixProcessParams]; n[i].unit=e.target.value; setMatrixProcessParams(n)}} placeholder="Unit" />
                                    <button type="button" onClick={(e) => {e.preventDefault(); setMatrixProcessParams(matrixProcessParams.filter((_, idx) => idx !== i));}} className="text-rose-300 hover:text-rose-500 opacity-0 group-hover/row:opacity-100 transition-opacity w-6 flex justify-center"><i className="fa-solid fa-times text-xs"></i></button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 relative group/box shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Results (Y)</p>
                            <button type="button" onClick={(e) => {e.preventDefault(); setMatrixResults([...matrixResults, {key: '', value: '', unit: ''}]);}} className="text-emerald-500 hover:text-emerald-700"><i className="fa-solid fa-plus-circle text-xs"></i></button>
                        </div>
                        <div className="max-h-32 overflow-y-auto custom-scrollbar">
                            {matrixResults.map((r, i) => (
                                <div key={i} className="flex gap-2 mb-1.5 items-center group/row">
                                    <input className="flex-[2.5] min-w-0 bg-slate-900 rounded-lg px-2 py-1.5 text-xs text-white border-none outline-none font-bold" value={r.key} onChange={e => {const n=[...matrixResults]; n[i].key=e.target.value; setMatrixResults(n)}} placeholder="Metric" />
                                    <input className="flex-[1.2] min-w-0 bg-slate-900 rounded-lg px-2 py-1.5 text-xs text-emerald-400 border-none outline-none text-right font-black" value={r.value} onChange={e => {const n=[...matrixResults]; n[i].value=e.target.value; setMatrixResults(n)}} placeholder="Val" />
                                    <input className="flex-1 min-w-0 bg-slate-900 rounded-lg px-2 py-1.5 text-[10px] text-slate-400 border-none outline-none text-center font-bold" value={r.unit} onChange={e => {const n=[...matrixResults]; n[i].unit=e.target.value; setMatrixResults(n)}} placeholder="Unit" />
                                    <button type="button" onClick={(e) => {e.preventDefault(); setMatrixResults(matrixResults.filter((_, idx) => idx !== i));}} className="text-rose-300 hover:text-rose-500 opacity-0 group-hover/row:opacity-100 transition-opacity w-6 flex justify-center ml-0.5"><i className="fa-solid fa-times text-xs"></i></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
