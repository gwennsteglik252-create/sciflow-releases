import React from 'react';
import { MatrixDataset } from '../../types';
import { useTranslation } from '../../locales/useTranslation';

interface LogMatrixSyncProps {
  pushToMatrix: boolean;
  setPushToMatrix: (val: boolean) => void;
  projectMatrices: MatrixDataset[];
  selectedMatrixId: string;
  setSelectedMatrixId: (val: string) => void;
  matrixSampleId: string;
  setMatrixSampleId: (val: string) => void;
  matrixProcessParams: {key: string, value: string, unit: string}[];
  setMatrixProcessParams: (val: {key: string, value: string, unit: string}[]) => void;
  matrixResults: {key: string, value: string, unit: string}[];
  setMatrixResults: (val: {key: string, value: string, unit: string}[]) => void;
}

export const LogMatrixSync: React.FC<LogMatrixSyncProps> = ({
  pushToMatrix, setPushToMatrix, projectMatrices, selectedMatrixId, setSelectedMatrixId,
  matrixSampleId, setMatrixSampleId, matrixProcessParams, setMatrixProcessParams, matrixResults, setMatrixResults
}) => {
  const { t } = useTranslation();
  return (
    <div className="bg-indigo-50/50 rounded-2xl p-3 mb-4 border border-indigo-100 shrink-0">
        <div className="flex justify-between items-center cursor-pointer" onClick={() => setPushToMatrix(!pushToMatrix)}>
            <div className="flex items-center gap-2">
                <i className="fa-solid fa-table-cells text-indigo-600 text-xs"></i>
                <span className="text-[9px] font-black text-indigo-800 uppercase tracking-widest">{t('logModal.matrixSync.title')}</span>
            </div>
            <div className={`w-8 h-5 rounded-full p-0.5 transition-colors duration-300 ${pushToMatrix ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${pushToMatrix ? 'translate-x-3' : ''}`}></div>
            </div>
        </div>
        
        {pushToMatrix && (
            <div className="mt-3 animate-reveal">
                {projectMatrices.length > 0 ? (
                    <div className="bg-white p-2.5 rounded-xl border border-indigo-100 mb-2">
                        <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">{t('logModal.matrixSync.targetMatrix')}</label>
                        <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none text-slate-700 cursor-pointer hover:border-indigo-300 transition-colors"
                            value={selectedMatrixId}
                            onChange={(e) => setSelectedMatrixId(e.target.value)}
                        >
                            {projectMatrices.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                        </select>
                    </div>
                ) : (
                    <div className="text-[8px] text-amber-500 italic mb-2">{t('logModal.matrixSync.defaultMatrix')}</div>
                )}

                <div className="flex items-center gap-2 mb-2">
                    <span className="text-[8px] font-black text-slate-500 uppercase">{t('logModal.matrixSync.sampleId')}</span>
                    <input className="bg-white border border-indigo-100 rounded-lg px-2 py-1 text-[9px] font-bold outline-none text-indigo-700 w-24" value={matrixSampleId} onChange={e => setMatrixSampleId(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100 relative group/box">
                        <div className="flex justify-between items-center mb-1.5">
                            <p className="text-[8px] font-black text-slate-400 uppercase">{t('logModal.matrixSync.processParams')}</p>
                            <button type="button" onClick={(e) => {e.preventDefault(); setMatrixProcessParams([...matrixProcessParams, {key: '', value: '', unit: ''}]);}} className="text-indigo-500 hover:text-indigo-700"><i className="fa-solid fa-plus-circle text-[10px]"></i></button>
                        </div>
                        <div className="max-h-24 overflow-y-auto custom-scrollbar">
                            {matrixProcessParams.map((p, i) => (
                                <div key={i} className="flex gap-1 mb-1 items-center group/row">
                                    <input className="flex-[2.5] min-w-0 bg-slate-50 rounded px-1.5 py-0.5 text-[8px] border-none outline-none" value={p.key} onChange={e => {const n=[...matrixProcessParams]; n[i].key=e.target.value; setMatrixProcessParams(n)}} placeholder={t('logModal.matrixSync.name')} />
                                    <input className="flex-[1.2] min-w-0 bg-slate-50 rounded px-1.5 py-0.5 text-[8px] border-none outline-none text-right" value={p.value} onChange={e => {const n=[...matrixProcessParams]; n[i].value=e.target.value; setMatrixProcessParams(n)}} placeholder={t('logModal.matrixSync.val')} />
                                    <input className="flex-1 min-w-0 bg-slate-50 rounded px-1.5 py-0.5 text-[8px] border-none outline-none text-center" value={p.unit} onChange={e => {const n=[...matrixProcessParams]; n[i].unit=e.target.value; setMatrixProcessParams(n)}} placeholder={t('logModal.matrixSync.unit')} />
                                    <button type="button" onClick={(e) => {e.preventDefault(); setMatrixProcessParams(matrixProcessParams.filter((_, idx) => idx !== i));}} className="text-rose-300 hover:text-rose-500 opacity-0 group-hover/row:opacity-100 transition-opacity w-4 flex justify-center"><i className="fa-solid fa-times text-[9px]"></i></button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-slate-100 relative group/box">
                        <div className="flex justify-between items-center mb-1.5">
                            <p className="text-[8px] font-black text-slate-400 uppercase">{t('logModal.matrixSync.results')}</p>
                            <button type="button" onClick={(e) => {e.preventDefault(); setMatrixResults([...matrixResults, {key: '', value: '', unit: ''}]);}} className="text-emerald-500 hover:text-emerald-700"><i className="fa-solid fa-plus-circle text-[10px]"></i></button>
                        </div>
                        <div className="max-h-24 overflow-y-auto custom-scrollbar">
                            {matrixResults.map((r, i) => (
                                <div key={i} className="flex gap-1 mb-1 items-center group/row">
                                    <input className="flex-[2.5] min-w-0 bg-slate-900 rounded px-1.5 py-0.5 text-[8px] text-white border-none outline-none" value={r.key} onChange={e => {const n=[...matrixResults]; n[i].key=e.target.value; setMatrixResults(n)}} placeholder={t('logModal.matrixSync.metric')} />
                                    <input className="flex-[1.2] min-w-0 bg-slate-900 rounded px-1.5 py-0.5 text-[8px] text-emerald-400 border-none outline-none text-right font-bold" value={r.value} onChange={e => {const n=[...matrixResults]; n[i].value=e.target.value; setMatrixResults(n)}} placeholder={t('logModal.matrixSync.val')} />
                                    <input className="flex-1 min-w-0 bg-slate-900 rounded px-1.5 py-0.5 text-[8px] text-slate-400 border-none outline-none text-center" value={r.unit} onChange={e => {const n=[...matrixResults]; n[i].unit=e.target.value; setMatrixResults(n)}} placeholder={t('logModal.matrixSync.unit')} />
                                    <button type="button" onClick={(e) => {e.preventDefault(); setMatrixResults(matrixResults.filter((_, idx) => idx !== i));}} className="text-rose-300 hover:text-rose-500 opacity-0 group-hover/row:opacity-100 transition-opacity w-4 flex justify-center ml-0.5"><i className="fa-solid fa-times text-[9px]"></i></button>
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
