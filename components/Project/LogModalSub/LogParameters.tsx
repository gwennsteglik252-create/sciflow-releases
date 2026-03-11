
import React from 'react';

interface LogParametersProps {
  paramList: {key: string, value: string, unit: string}[];
  setParamList: (params: {key: string, value: string, unit: string}[]) => void;
  planSnapshot?: Record<string, string>; // 计划阶段的参数快照，用于对标
}

const QUICK_CONDITIONS = [
    { label: '加热', key: '加热' },
    { label: '搅拌', key: '搅拌' },
    { label: '避光', key: '避光环境' },
    { label: '超声', key: '超声分散' },
    { label: '惰性气氛', key: '气氛保护' },
    { label: '离心', key: '离心分离' },
    { label: '洗涤', key: '产物洗涤' },
];

export const LogParameters: React.FC<LogParametersProps> = ({ paramList, setParamList, planSnapshot }) => {
  const updateParam = (idx: number, field: 'key' | 'value' | 'unit', val: string) => {
      const newList = [...paramList];
      newList[idx][field] = val;
      setParamList(newList);
  };

  const addParamRow = (key = '', value = '', unit = '') => {
      const filtered = paramList.filter(p => p.key.trim() !== '' || p.value.trim() !== '');
      setParamList([...filtered, { key, value, unit }]);
  };
  
  const removeParamRow = (idx: number) => {
      if (paramList.length > 1) setParamList(paramList.filter((_, i) => i !== idx));
      else setParamList([{key: '', value: '', unit: ''}]);
  };

  const handleQuickAdd = (key: string) => {
      if (paramList.some(p => p.key === key)) return;
      addParamRow(key, '是');
  };

  // --- 实时偏差审计逻辑 (Deviation Audit) ---
  const checkDeviation = (key: string, value: string) => {
    if (!planSnapshot) return null;
    const target = planSnapshot[key];
    if (!target) return null;
    
    // 提取数字进行对比
    const numTarget = parseFloat(target.replace(/[^0-9.]/g, ''));
    const numValue = parseFloat(value.replace(/[^0-9.]/g, ''));
    
    if (isNaN(numTarget) || isNaN(numValue)) {
        return target !== value ? { type: 'diff', target } : null;
    }
    
    // 偏离 5% 触发警告
    const diffPercent = Math.abs((numValue - numTarget) / numTarget);
    if (diffPercent > 0.05) {
        return { type: 'alert', target, percent: Math.round(diffPercent * 100) };
    }
    return { type: 'match', target };
  };

  return (
    <div>
        <div className="flex justify-between items-center mb-2.5 px-1">
            <label className="text-xs font-black text-slate-950 uppercase block italic">关键参数与计划对标 (BENCHMARKING)</label>
            {planSnapshot && <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 flex items-center gap-1"><i className="fa-solid fa-link-slash"></i> 对标引擎已开启</span>}
        </div>
        
        <div className="flex flex-wrap gap-1.5 mb-3 px-1">
            {QUICK_CONDITIONS.map(cond => (
                <button key={cond.key} onClick={() => handleQuickAdd(cond.key)} className="px-2.5 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95">+ {cond.label}</button>
            ))}
        </div>

        <div className="bg-slate-50 rounded-[2.5rem] p-4 border border-slate-200 shadow-inner max-h-[340px] overflow-y-auto custom-scrollbar">
            <div className="space-y-2.5">
                {paramList.map((param, idx) => {
                    const dev = checkDeviation(param.key, param.value);
                    return (
                    <div key={idx} className="flex gap-2 items-start group animate-reveal relative">
                        <div className="flex-1 min-w-0">
                            <input 
                                className="w-full bg-white rounded-xl px-3 py-2.5 text-xs font-bold outline-none border border-slate-100 focus:border-indigo-400 h-10 shadow-sm" 
                                placeholder="变量名" 
                                value={param.key}
                                onChange={e => updateParam(idx, 'key', e.target.value)}
                            />
                        </div>
                        <div className="flex-1 min-w-0 relative">
                            <input 
                                className={`w-full rounded-xl px-2 py-2.5 text-xs font-black outline-none text-center h-10 shadow-sm transition-all ${
                                    dev?.type === 'alert' ? 'bg-rose-50 border-rose-400 text-rose-700 ring-2 ring-rose-100' : 'bg-white border-slate-100 text-indigo-700 focus:border-indigo-400'
                                }`}
                                placeholder="值" 
                                value={param.value}
                                onChange={e => updateParam(idx, 'value', e.target.value)}
                            />
                            {/* Deviation HUD */}
                            {dev && (
                                <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full z-[100] whitespace-nowrap px-2 py-0.5 rounded-lg text-[7px] font-black uppercase shadow-xl border ${
                                    dev.type === 'alert' ? 'bg-rose-600 border-rose-500 text-white animate-bounce' : 'bg-indigo-600 border-indigo-500 text-white'
                                }`}>
                                    {dev.type === 'alert' ? `预期: ${dev.target} (偏离 ${dev.percent}%)` : `预期: ${dev.target}`}
                                </div>
                            )}
                        </div>
                        <div className="w-16 shrink-0">
                            <input className="w-full bg-white rounded-xl px-2 py-2.5 text-[10px] font-black outline-none border border-slate-100 h-10 text-slate-400 shadow-sm text-center" placeholder="单位" value={param.unit} onChange={e => updateParam(idx, 'unit', e.target.value)} />
                        </div>
                        <button onClick={() => removeParamRow(idx)} className="text-rose-300 hover:text-rose-500 transition-colors pt-2.5"><i className="fa-solid fa-times-circle"></i></button>
                    </div>
                )})}
            </div>
            <button onClick={() => addParamRow()} className="w-full mt-6 py-3 text-[10px] font-black text-indigo-600 border-2 border-dashed border-indigo-200 rounded-2xl hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"><i className="fa-solid fa-plus-circle"></i> 自定义实验参数行</button>
        </div>
    </div>
  );
};
