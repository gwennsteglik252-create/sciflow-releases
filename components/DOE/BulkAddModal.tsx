import React, { useState, useEffect } from 'react';
import { DOEFactor, DOEResponse } from '../../types';
import { useTranslation } from '../../locales';

interface BulkAddModalProps {
  show: boolean;
  onClose: () => void;
  factors: DOEFactor[];
  responses: DOEResponse[];
  onSubmit: (entries: any[]) => void;
  initialData?: any[];
}

const BulkAddModal: React.FC<BulkAddModalProps> = ({ show, onClose, factors, responses, onSubmit, initialData = [] }) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<{ factors: Record<string, string>, responses: Record<string, string> }[]>([]);

  useEffect(() => {
    if (show) {
      if (initialData && initialData.length > 0) {
         setEntries(initialData.map(d => ({
             factors: Object.entries(d.factors).reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {}),
             responses: Object.entries(d.responses).reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {})
         })));
      } else {
         setEntries([{
            factors: factors.reduce((acc, f) => ({ ...acc, [f.name]: '' }), {}),
            responses: responses.reduce((acc, r) => ({ ...acc, [r.name]: '' }), {})
         }]);
      }
    }
  }, [show, factors, responses, initialData]);

  const addRow = () => {
    setEntries([...entries, {
      factors: factors.reduce((acc, f) => ({ ...acc, [f.name]: '' }), {}),
      responses: responses.reduce((acc, r) => ({ ...acc, [r.name]: '' }), {})
    }]);
  };

  const updateValue = (idx: number, type: 'factors' | 'responses', key: string, value: string) => {
    const next = [...entries];
    next[idx][type] = { ...next[idx][type], [key]: value };
    setEntries(next);
  };

  const handleConfirm = () => {
    const valid = entries.map(entry => {
      const pFactors: Record<string, number> = {};
      const pResponses: Record<string, number> = {};
      let ok = true;
      factors.forEach(f => { const v = parseFloat(entry.factors[f.name]); if (isNaN(v)) ok = false; pFactors[f.name] = v; });
      responses.forEach(r => { const v = parseFloat(entry.responses[r.name]); if (isNaN(v)) ok = false; pResponses[r.name] = v; });
      return ok ? { factors: pFactors, responses: pResponses } : null;
    }).filter(Boolean);

    if (valid.length > 0) {
      onSubmit(valid);
    } else {
      alert(t('doeAssistant.bulkAddModal.invalidAlert'));
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1300] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-7xl rounded-xl p-8 lg:p-12 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[90vh]">
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-all"><i className="fa-solid fa-times text-2xl"></i></button>
        <h3 className="text-2xl font-black text-slate-800 mb-8 uppercase italic border-l-8 border-indigo-600 pl-6 shrink-0">{t('doeAssistant.bulkAddModal.title')}</h3>
        
        <div className="flex-1 overflow-auto custom-scrollbar mb-8 border border-slate-100 rounded-lg bg-slate-50/50">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="sticky top-0 bg-slate-700 text-white z-10">
              <tr>
                <th className="p-4 text-[10px] font-black uppercase text-center w-16 bg-slate-800">#</th>
                {factors.map(f => <th key={f.name} className="p-4 text-[10px] font-black uppercase border-r border-white/10">{f.name} <span className="text-indigo-300">({f.unit})</span></th>)}
                {responses.map(r => <th key={r.name} className="p-4 text-[10px] font-black uppercase border-r border-white/10">{r.name} <span className="text-emerald-400">({r.unit})</span></th>)}
                <th className="p-4 text-[10px] font-black uppercase w-24 text-center bg-slate-800">{t('doeAssistant.bulkAddModal.columnAction')}</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {entries.map((entry, idx) => (
                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                  <td className="p-4 text-center font-black text-slate-300 text-xs">{idx + 1}</td>
                  {factors.map(f => (
                    <td key={f.name} className="p-2 border-r border-slate-100">
                      <input type="number" className="w-full bg-transparent p-2 text-xs font-bold text-center outline-none" value={entry.factors[f.name]} onChange={e => updateValue(idx, 'factors', f.name, e.target.value)} placeholder={f.min + "~" + f.max} />
                    </td>
                  ))}
                  {responses.map(r => (
                    <td key={r.name} className="p-2 border-r border-slate-100">
                      <input type="number" className="w-full bg-transparent p-2 text-xs font-black text-center outline-none text-emerald-600" value={entry.responses[r.name]} onChange={e => updateValue(idx, 'responses', r.name, e.target.value)} placeholder={t('doeAssistant.bulkAddModal.placeholderValue')} />
                    </td>
                  ))}
                  <td className="p-2 text-center">
                    <button 
                      onClick={() => setEntries(entries.filter((_, i) => i !== idx))} 
                      disabled={entries.length === 1 && initialData.length === 0}
                      className="w-9 h-9 rounded-lg bg-rose-50 text-rose-400 transition-all hover:bg-rose-500 hover:text-white disabled:opacity-0 flex items-center justify-center mx-auto shadow-sm active:scale-90 border border-rose-100"
                    >
                      <i className="fa-solid fa-trash-can text-xs"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="flex justify-between items-center shrink-0 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                {t('doeAssistant.bulkAddModal.statusReady', { count: entries.length })}
             </div>
             <button onClick={addRow} className="px-5 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2 active:scale-95 shadow-sm">
                <i className="fa-solid fa-plus"></i> {t('doeAssistant.bulkAddModal.addNewRow')}
             </button>
          </div>
          <div className="flex gap-4">
            <button onClick={onClose} className="px-8 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">{t('doeAssistant.bulkAddModal.cancel')}</button>
            <button onClick={handleConfirm} className="px-10 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl hover:bg-black transition-all active:scale-95">{t('doeAssistant.bulkAddModal.confirm')}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkAddModal;