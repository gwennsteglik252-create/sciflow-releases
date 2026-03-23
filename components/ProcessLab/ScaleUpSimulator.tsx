/**
 * ScaleUpSimulator.tsx — 中试放大模拟器
 * 实验室→中试→量产 参数换算、三级对比、风险评级矩阵
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Formulation, ProcessFlow, ProcessStep } from '../../types';
import { DEMO_SCALEUP_RECORDS } from './demoData';

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

type ScaleLevel = 'lab' | 'pilot' | 'production';
const SCALE_INFO: Record<ScaleLevel, { label: string; icon: string; color: string; bg: string; factor: string }> = {
  lab:        { label: '实验室级', icon: 'fa-flask',     color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200',   factor: '×1' },
  pilot:      { label: '中试级',   icon: 'fa-vials',     color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200', factor: '×10-100' },
  production: { label: '量产级',   icon: 'fa-industry',  color: 'text-emerald-600',bg: 'bg-emerald-50 border-emerald-200', factor:'×100-1000' },
};

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; icon: string }> = {
  low:      { label: '低风险', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: 'fa-circle-check' },
  medium:   { label: '中风险', color: 'text-amber-600',   bg: 'bg-amber-50',   icon: 'fa-triangle-exclamation' },
  high:     { label: '高风险', color: 'text-orange-600',  bg: 'bg-orange-50',  icon: 'fa-circle-exclamation' },
  critical: { label: '极高',   color: 'text-rose-600',    bg: 'bg-rose-50',    icon: 'fa-skull-crossbones' },
};

interface ScaleParam {
  key: string;
  labValue: string;
  pilotValue: string;
  prodValue: string;
  unit: string;
  risk: RiskLevel;
  notes: string;
}

interface ScaleUpRecord {
  id: string;
  name: string;
  formulationId?: string;
  formulationName?: string;
  flowId?: string;
  labBatchSize: string;
  pilotBatchSize: string;
  prodBatchSize: string;
  batchUnit: string;
  params: ScaleParam[];
  createdAt: string;
}

interface Props {
  formulations: Formulation[];
  flows: { id: string; name: string }[];
  showToast: (t: { message: string; type: 'error' | 'success' | 'info' | 'warning' }) => void;
}

const ScaleUpSimulator: React.FC<Props> = ({ formulations, flows, showToast }) => {
  const [records, setRecords] = useState<ScaleUpRecord[]>(() => {
    const saved = localStorage.getItem('sciflow_scaleup_records');
    if (saved) { try { const parsed = JSON.parse(saved); if (parsed.length > 0) return parsed; } catch {} }
    return DEMO_SCALEUP_RECORDS;
  });
  React.useEffect(() => { localStorage.setItem('sciflow_scaleup_records', JSON.stringify(records)); }, [records]);

  const [editing, setEditing] = useState<ScaleUpRecord | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleNew = useCallback(() => {
    setEditing({
      id: genId(), name: '', labBatchSize: '', pilotBatchSize: '', prodBatchSize: '', batchUnit: 'g',
      params: [
        { key: '搅拌速度', labValue: '', pilotValue: '', prodValue: '', unit: 'rpm', risk: 'low', notes: '' },
        { key: '反应温度', labValue: '', pilotValue: '', prodValue: '', unit: '°C', risk: 'low', notes: '' },
        { key: '反应时间', labValue: '', pilotValue: '', prodValue: '', unit: 'min', risk: 'low', notes: '' },
      ],
      createdAt: new Date().toISOString().slice(0, 10),
    });
    setShowModal(true);
  }, []);

  const handleEdit = useCallback((r: ScaleUpRecord) => {
    setEditing({ ...r, params: r.params.map(p => ({ ...p })) });
    setShowModal(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!editing) return;
    if (!editing.name.trim()) { showToast({ message: '请输入模拟名称', type: 'error' }); return; }
    if (editing.formulationId) {
      const f = formulations.find(x => x.id === editing.formulationId);
      if (f) editing.formulationName = `${f.name} (${f.version})`;
    }
    setRecords(prev => {
      const idx = prev.findIndex(r => r.id === editing.id);
      return idx >= 0 ? prev.map(r => r.id === editing.id ? editing : r) : [editing, ...prev];
    });
    setShowModal(false); setEditing(null);
    showToast({ message: '放大模拟已保存', type: 'success' });
  }, [editing, formulations, showToast]);

  const handleDelete = useCallback((id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
    showToast({ message: '已删除', type: 'info' });
  }, [showToast]);

  const updateParam = useCallback((idx: number, patch: Partial<ScaleParam>) => {
    setEditing(prev => {
      if (!prev) return prev;
      const params = [...prev.params];
      params[idx] = { ...params[idx], ...patch };
      return { ...prev, params };
    });
  }, []);

  const riskSummary = useCallback((params: ScaleParam[]) => {
    const counts = { low: 0, medium: 0, high: 0, critical: 0 };
    params.forEach(p => counts[p.risk]++);
    return counts;
  }, []);

  return (
    <div className="space-y-5 pb-12">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">共 {records.length} 条放大模拟记录</p>
        <button onClick={handleNew} className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-teal-700 transition-all active:scale-95 flex items-center gap-2">
          <i className="fa-solid fa-plus"></i>新建放大模拟
        </button>
      </div>

      {/* 记录列表 */}
      {records.length > 0 ? (
        <div className="space-y-4">
          {records.map(r => {
            const risks = riskSummary(r.params);
            const highestRisk: RiskLevel = risks.critical > 0 ? 'critical' : risks.high > 0 ? 'high' : risks.medium > 0 ? 'medium' : 'low';
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 ${RISK_CONFIG[highestRisk].bg} border-current`}>
                      <i className={`fa-solid ${RISK_CONFIG[highestRisk].icon} ${RISK_CONFIG[highestRisk].color}`}></i>
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800 uppercase">{r.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        {r.formulationName && <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">{r.formulationName}</span>}
                        <span className="text-[8px] font-bold text-slate-400">{r.params.length} 参数</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* 风险分布胶囊 */}
                    <div className="flex gap-1">
                      {risks.critical > 0 && <span className="text-[7px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full">极高{risks.critical}</span>}
                      {risks.high > 0 && <span className="text-[7px] font-black text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">高{risks.high}</span>}
                      {risks.medium > 0 && <span className="text-[7px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">中{risks.medium}</span>}
                      {risks.low > 0 && <span className="text-[7px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">低{risks.low}</span>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(r)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:text-teal-600 hover:bg-teal-50 flex items-center justify-center transition-all"><i className="fa-solid fa-pen text-[10px]"></i></button>
                      <button onClick={() => handleDelete(r.id)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all"><i className="fa-solid fa-trash text-[10px]"></i></button>
                    </div>
                  </div>
                </div>

                {/* 三级对比视图 */}
                <div className="px-6 py-4">
                  {/* 批次量 */}
                  <div className="flex items-stretch gap-3 mb-4">
                    {(['lab', 'pilot', 'production'] as ScaleLevel[]).map(level => {
                      const info = SCALE_INFO[level];
                      const val = level === 'lab' ? r.labBatchSize : level === 'pilot' ? r.pilotBatchSize : r.prodBatchSize;
                      return (
                        <div key={level} className={`flex-1 rounded-xl border-2 p-3 ${info.bg} text-center`}>
                          <div className="flex items-center justify-center gap-1.5 mb-1"><i className={`fa-solid ${info.icon} text-[10px] ${info.color}`}></i><span className="text-[8px] font-black uppercase">{info.label}</span></div>
                          <p className={`text-lg font-black ${info.color}`}>{val || '—'}<span className="text-[9px] ml-0.5">{r.batchUnit}</span></p>
                        </div>
                      );
                    })}
                  </div>

                  {/* 参数对比表 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left font-black text-slate-400 uppercase py-2 px-1 w-24">参数</th>
                          <th className="text-center font-black text-blue-500 uppercase py-2 px-1">实验室</th>
                          <th className="text-center font-black text-amber-500 uppercase py-2 px-1">中试</th>
                          <th className="text-center font-black text-emerald-500 uppercase py-2 px-1">量产</th>
                          <th className="text-center font-black text-slate-400 uppercase py-2 px-1 w-12">单位</th>
                          <th className="text-center font-black text-slate-400 uppercase py-2 px-1 w-16">风险</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.params.map((p, i) => {
                          const rc = RISK_CONFIG[p.risk];
                          return (
                            <tr key={i} className="border-b border-slate-50">
                              <td className="py-2 px-1 font-black text-slate-700">{p.key}</td>
                              <td className="py-2 px-1 text-center font-bold text-blue-600">{p.labValue || '—'}</td>
                              <td className="py-2 px-1 text-center font-bold text-amber-600">{p.pilotValue || '—'}</td>
                              <td className="py-2 px-1 text-center font-bold text-emerald-600">{p.prodValue || '—'}</td>
                              <td className="py-2 px-1 text-center text-slate-400">{p.unit}</td>
                              <td className="py-2 px-1 text-center">
                                <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full ${rc.bg} ${rc.color}`}>{rc.label}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 gap-5 opacity-40">
          <div className="w-20 h-20 rounded-full bg-teal-50 border-2 border-teal-100 flex items-center justify-center"><i className="fa-solid fa-expand text-teal-300 text-3xl"></i></div>
          <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3rem]">暂无放大模拟记录</p>
        </div>
      )}

      {/* ═══ 编辑弹窗 ═══ */}
      {showModal && editing && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl animate-reveal flex flex-col max-h-[92vh] overflow-hidden border-2 border-teal-100">
            <header className="px-8 py-5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><i className="fa-solid fa-expand text-lg"></i></div>
                <div>
                  <h3 className="text-lg font-black uppercase italic tracking-tight">中试放大模拟</h3>
                  <p className="text-[9px] font-bold text-teal-200 uppercase tracking-widest">SCALE-UP SIMULATOR</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleSave} className="px-6 py-2.5 bg-white text-teal-700 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-teal-50 transition-all active:scale-95 flex items-center gap-2"><i className="fa-solid fa-check"></i>保存</button>
                <button onClick={() => { setShowModal(false); setEditing(null); }} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-rose-500 transition-all flex items-center justify-center"><i className="fa-solid fa-times text-lg"></i></button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
              {/* 基本信息 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5">模拟名称</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-teal-400 transition-all"
                    placeholder="例：NiFe-LDH 放大模拟" value={editing.name} onChange={e => setEditing(p => p ? { ...p, name: e.target.value } : p)} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5">关联配方</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                    value={editing.formulationId || ''} onChange={e => setEditing(p => p ? { ...p, formulationId: e.target.value || undefined } : p)}>
                    <option value="">未关联</option>
                    {formulations.map(f => <option key={f.id} value={f.id}>{f.name} ({f.version})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5">批量单位</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                    value={editing.batchUnit} onChange={e => setEditing(p => p ? { ...p, batchUnit: e.target.value } : p)}>
                    <option>g</option><option>kg</option><option>L</option><option>mL</option><option>ton</option>
                  </select>
                </div>
              </div>

              {/* 三级批量 */}
              <div className="grid grid-cols-3 gap-4">
                {(['lab', 'pilot', 'production'] as ScaleLevel[]).map(level => {
                  const info = SCALE_INFO[level];
                  const field = level === 'lab' ? 'labBatchSize' : level === 'pilot' ? 'pilotBatchSize' : 'prodBatchSize';
                  return (
                    <div key={level} className={`rounded-xl border-2 p-4 ${info.bg}`}>
                      <div className="flex items-center gap-2 mb-2"><i className={`fa-solid ${info.icon} text-[11px] ${info.color}`}></i><span className="text-[9px] font-black uppercase">{info.label}</span><span className="text-[7px] font-bold text-slate-400 ml-auto">{info.factor}</span></div>
                      <input type="text" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none text-center"
                        placeholder={`批量 (${editing.batchUnit})`} value={(editing as any)[field]} onChange={e => setEditing(p => p ? { ...p, [field]: e.target.value } : p)} />
                    </div>
                  );
                })}
              </div>

              {/* 参数对比编辑 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-2"><i className="fa-solid fa-sliders text-teal-500"></i>放大参数对比</h4>
                  <button onClick={() => setEditing(p => p ? { ...p, params: [...p.params, { key: '', labValue: '', pilotValue: '', prodValue: '', unit: '', risk: 'low', notes: '' }] } : p)}
                    className="text-[9px] font-black text-teal-600 hover:text-teal-800 flex items-center gap-1"><i className="fa-solid fa-plus"></i>添加参数</button>
                </div>
                <div className="space-y-2">
                  {editing.params.map((p, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
                      <div className="flex items-center gap-2">
                        <input className="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none" placeholder="参数名"
                          value={p.key} onChange={e => updateParam(i, { key: e.target.value })} />
                        <div className="flex-1 grid grid-cols-3 gap-1.5">
                          <input className="bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-blue-700 outline-none text-center" placeholder="实验室"
                            value={p.labValue} onChange={e => updateParam(i, { labValue: e.target.value })} />
                          <input className="bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-amber-700 outline-none text-center" placeholder="中试"
                            value={p.pilotValue} onChange={e => updateParam(i, { pilotValue: e.target.value })} />
                          <input className="bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-emerald-700 outline-none text-center" placeholder="量产"
                            value={p.prodValue} onChange={e => updateParam(i, { prodValue: e.target.value })} />
                        </div>
                        <input className="w-12 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none text-center" placeholder="单位"
                          value={p.unit} onChange={e => updateParam(i, { unit: e.target.value })} />
                        <select className="w-16 bg-white border border-slate-200 rounded-lg px-1 py-1.5 text-[9px] font-bold outline-none cursor-pointer"
                          value={p.risk} onChange={e => updateParam(i, { risk: e.target.value as RiskLevel })}>
                          {Object.entries(RISK_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <button onClick={() => setEditing(prev => prev ? { ...prev, params: prev.params.filter((_, j) => j !== i) } : prev)}
                          className="w-6 h-6 rounded text-slate-300 hover:text-rose-500 flex items-center justify-center shrink-0"><i className="fa-solid fa-xmark text-[9px]"></i></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScaleUpSimulator;
