/**
 * CostAnalysisEngine.tsx — 成本分析引擎
 * BOM 成本分解、多方案对比、敏感性分析、利润率模拟
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Formulation } from '../../types';
import { DEMO_MATERIAL_PRICES } from './demoData';

interface Props {
  formulations: Formulation[];
}

/** 物料价格记录 */
interface MaterialPrice {
  materialName: string;
  unitPrice: number;   // 元/单位
  unit: string;        // g, kg ...
  supplier?: string;
}

const CostAnalysisEngine: React.FC<Props> = ({ formulations }) => {
  // ─── 物料价格表 ───
  const [prices, setPrices] = useState<MaterialPrice[]>(() => {
    const saved = localStorage.getItem('sciflow_material_prices');
    if (saved) { try { const parsed = JSON.parse(saved); if (parsed.length > 0) return parsed; } catch {} }
    return DEMO_MATERIAL_PRICES;
  });
  React.useEffect(() => { localStorage.setItem('sciflow_material_prices', JSON.stringify(prices)); }, [prices]);

  // ─── 选中对比的配方 ───
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // ─── 敏感性分析参数 ───
  const [sensitivityMaterial, setSensitivityMaterial] = useState('');
  const [sensitivityRange, setSensitivityRange] = useState(20); // ±%
  // ─── 利润率模拟 ───
  const [sellingPrice, setSellingPrice] = useState(0);
  // ─── 价格编辑 ───
  const [showPriceModal, setShowPriceModal] = useState(false);

  // 获取物料单价
  const getPrice = useCallback((name: string): number => {
    const p = prices.find(p => p.materialName === name);
    return p ? p.unitPrice : 0;
  }, [prices]);

  // 计算单个配方成本
  const calcFormulationCost = useCallback((f: Formulation) => {
    const items = f.components.map(c => {
      const unitPrice = getPrice(c.materialName);
      const cost = c.amount * unitPrice;
      return { name: c.materialName, role: c.role, amount: c.amount, unit: c.unit, unitPrice, cost, percentage: c.percentage };
    });
    const totalCost = items.reduce((s, i) => s + i.cost, 0);
    return { items, totalCost, totalWeight: f.totalWeight || f.components.reduce((s, c) => s + c.amount, 0) };
  }, [getPrice]);

  // 所有涉及的物料名
  const allMaterials = useMemo(() => {
    const names = new Set<string>();
    formulations.forEach(f => f.components.forEach(c => { if (c.materialName) names.add(c.materialName); }));
    return [...names];
  }, [formulations]);

  // 确保价格表包含所有物料
  React.useEffect(() => {
    const missing = allMaterials.filter(n => !prices.find(p => p.materialName === n));
    if (missing.length > 0) {
      setPrices(prev => [...prev, ...missing.map(n => ({ materialName: n, unitPrice: 0, unit: 'g' }))]);
    }
  }, [allMaterials]);

  // 选中配方的成本计算
  const comparisonData = useMemo(() => {
    return selectedIds.map(id => {
      const f = formulations.find(x => x.id === id);
      if (!f) return null;
      return { formulation: f, ...calcFormulationCost(f) };
    }).filter(Boolean) as { formulation: Formulation; items: any[]; totalCost: number; totalWeight: number }[];
  }, [selectedIds, formulations, calcFormulationCost]);

  // 敏感性分析数据
  const sensitivityData = useMemo(() => {
    if (!sensitivityMaterial || selectedIds.length === 0) return [];
    const steps = [-sensitivityRange, -sensitivityRange / 2, 0, sensitivityRange / 2, sensitivityRange];
    return steps.map(pctChange => {
      return {
        pctChange,
        costs: selectedIds.map(id => {
          const f = formulations.find(x => x.id === id);
          if (!f) return { name: '?', cost: 0 };
          let total = 0;
          f.components.forEach(c => {
            let up = getPrice(c.materialName);
            if (c.materialName === sensitivityMaterial) up *= (1 + pctChange / 100);
            total += c.amount * up;
          });
          return { name: `${f.name} (${f.version})`, cost: total };
        }),
      };
    });
  }, [sensitivityMaterial, sensitivityRange, selectedIds, formulations, getPrice]);

  // 最大成本（用于柱状图比例）
  const maxCost = useMemo(() => Math.max(...comparisonData.map(d => d.totalCost), 1), [comparisonData]);
  const BAR_COLORS = ['#f59e0b', '#6366f1', '#10b981', '#ec4899', '#06b6d4', '#8b5cf6'];

  return (
    <div className="space-y-5 pb-12">
      {/* ─── 物料价格管理入口 ─── */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">已录入 {prices.filter(p => p.unitPrice > 0).length}/{allMaterials.length} 物料价格</p>
        <button onClick={() => setShowPriceModal(true)} className="px-5 py-2.5 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-amber-700 transition-all active:scale-95 flex items-center gap-2">
          <i className="fa-solid fa-coins"></i>管理物料价格
        </button>
      </div>

      {/* ─── 配方选择 ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4"><i className="fa-solid fa-scale-balanced text-amber-500"></i>选择对比配方（最多 4 个）</h4>
        <div className="flex flex-wrap gap-2">
          {formulations.filter(f => f.status !== 'archived').map(f => {
            const sel = selectedIds.includes(f.id);
            return (
              <button key={f.id} onClick={() => {
                setSelectedIds(prev => sel ? prev.filter(x => x !== f.id) : prev.length < 4 ? [...prev, f.id] : prev);
              }} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border-2 flex items-center gap-1.5 ${sel ? 'border-amber-400 bg-amber-50 text-amber-700 shadow-sm' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-amber-200'}`}>
                <i className={`fa-solid ${sel ? 'fa-circle-check' : 'fa-circle'} text-[8px]`}></i>
                {f.name} <span className="text-[8px] opacity-60">{f.version}</span>
              </button>
            );
          })}
        </div>
      </div>

      {comparisonData.length > 0 && (
        <>
          {/* ─── BOM 成本分解 + 对比柱状图 ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 柱状图对比 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-5"><i className="fa-solid fa-chart-column text-indigo-500"></i>总成本对比</h4>
              <div className="space-y-4">
                {comparisonData.map((d, i) => {
                  const pct = (d.totalCost / maxCost) * 100;
                  const unitCost = d.totalWeight > 0 ? d.totalCost / d.totalWeight : 0;
                  return (
                    <div key={d.formulation.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black text-slate-700">{d.formulation.name} <span className="text-[8px] text-slate-400">{d.formulation.version}</span></span>
                        <span className="text-sm font-black" style={{ color: BAR_COLORS[i % BAR_COLORS.length] }}>¥{d.totalCost.toFixed(2)}</span>
                      </div>
                      <div className="h-7 bg-slate-100 rounded-full overflow-hidden relative">
                        <div className="h-full rounded-full transition-all duration-700 flex items-center px-3" style={{ width: `${Math.max(pct, 8)}%`, background: `linear-gradient(90deg, ${BAR_COLORS[i % BAR_COLORS.length]}cc, ${BAR_COLORS[i % BAR_COLORS.length]})` }}>
                          <span className="text-[8px] font-black text-white whitespace-nowrap">¥{unitCost.toFixed(2)}/{d.formulation.totalWeightUnit || 'g'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* BOM 成本明细 */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm overflow-x-auto">
              <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4"><i className="fa-solid fa-receipt text-emerald-500"></i>BOM 成本明细</h4>
              {comparisonData.map((d, i) => (
                <div key={d.formulation.id} className="mb-4 last:mb-0">
                  <p className="text-[9px] font-black uppercase mb-2 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: BAR_COLORS[i % BAR_COLORS.length] }}></span>
                    {d.formulation.name} ({d.formulation.version})
                  </p>
                  <div className="space-y-1">
                    {d.items.map((item: any, j: number) => (
                      <div key={j} className="flex items-center gap-2 text-[9px]">
                        <span className="w-14 font-black text-slate-400 uppercase shrink-0">{item.role}</span>
                        <span className="flex-1 font-bold text-slate-600 truncate">{item.name || '—'}</span>
                        <span className="font-bold text-slate-500 w-16 text-right">{item.amount}{item.unit}</span>
                        <span className="font-bold text-slate-400 w-16 text-right">@¥{item.unitPrice}</span>
                        <span className="font-black text-amber-600 w-16 text-right">¥{item.cost.toFixed(2)}</span>
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden shrink-0">
                          <div className="h-full rounded-full" style={{ width: `${d.totalCost > 0 ? (item.cost / d.totalCost) * 100 : 0}%`, background: BAR_COLORS[i % BAR_COLORS.length] }}></div>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                      <span className="text-[9px] font-black text-slate-500">合计</span>
                      <span className="text-sm font-black text-amber-700">¥{d.totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── 利润率模拟 ─── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4"><i className="fa-solid fa-hand-holding-dollar text-emerald-500"></i>利润率模拟</h4>
            <div className="flex items-center gap-4 mb-4">
              <label className="text-[9px] font-black text-slate-400 uppercase">产品售价 (¥)</label>
              <input type="number" className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-emerald-400 transition-all"
                value={sellingPrice || ''} onChange={e => setSellingPrice(parseFloat(e.target.value) || 0)} placeholder="0.00" />
              <span className="text-[9px] font-bold text-slate-400">/ {comparisonData[0]?.formulation.totalWeightUnit || 'g'}</span>
            </div>
            {sellingPrice > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {comparisonData.map((d, i) => {
                  const unitCost = d.totalWeight > 0 ? d.totalCost / d.totalWeight : 0;
                  const margin = sellingPrice > 0 ? ((sellingPrice - unitCost) / sellingPrice) * 100 : 0;
                  const profit = sellingPrice - unitCost;
                  return (
                    <div key={d.formulation.id} className={`rounded-xl border-2 p-4 text-center ${margin >= 30 ? 'border-emerald-200 bg-emerald-50' : margin >= 10 ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'}`}>
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">{d.formulation.name}</p>
                      <p className={`text-2xl font-black ${margin >= 30 ? 'text-emerald-600' : margin >= 10 ? 'text-amber-600' : 'text-rose-600'}`}>{margin.toFixed(1)}%</p>
                      <p className="text-[9px] font-bold text-slate-500 mt-1">毛利 ¥{profit.toFixed(2)}</p>
                      <p className="text-[8px] font-bold text-slate-400">成本 ¥{unitCost.toFixed(2)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── 敏感性分析 ─── */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4"><i className="fa-solid fa-arrows-up-down text-rose-500"></i>原料价格敏感性分析</h4>
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">选择物料</label>
                <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-bold text-slate-700 outline-none cursor-pointer"
                  value={sensitivityMaterial} onChange={e => setSensitivityMaterial(e.target.value)}>
                  <option value="">选择...</option>
                  {allMaterials.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase block mb-1">波动范围</label>
                <select className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-bold text-slate-700 outline-none cursor-pointer"
                  value={sensitivityRange} onChange={e => setSensitivityRange(parseInt(e.target.value))}>
                  <option value={10}>±10%</option><option value={20}>±20%</option><option value={30}>±30%</option><option value={50}>±50%</option>
                </select>
              </div>
            </div>
            {sensitivityData.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left font-black text-slate-400 uppercase py-2 px-2">价格变化</th>
                      {sensitivityData[0].costs.map((c: any, i: number) => (
                        <th key={i} className="text-right font-black text-slate-400 uppercase py-2 px-2">{c.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivityData.map((row, ri) => (
                      <tr key={ri} className={`border-b border-slate-50 ${row.pctChange === 0 ? 'bg-amber-50/50 font-black' : ''}`}>
                        <td className={`py-2 px-2 font-black ${row.pctChange > 0 ? 'text-rose-500' : row.pctChange < 0 ? 'text-emerald-500' : 'text-slate-700'}`}>
                          {row.pctChange > 0 ? '+' : ''}{row.pctChange}%
                        </td>
                        {row.costs.map((c: any, ci: number) => (
                          <td key={ci} className="text-right py-2 px-2 font-bold text-slate-700">¥{c.cost.toFixed(2)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {comparisonData.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-5 opacity-40">
          <div className="w-20 h-20 rounded-full bg-amber-50 border-2 border-amber-100 flex items-center justify-center"><i className="fa-solid fa-coins text-amber-300 text-3xl"></i></div>
          <div className="text-center">
            <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3rem] mb-2">选择配方开始分析</p>
            <p className="text-[11px] text-slate-400 max-w-xs">请先在上方选择至少一个配方进行成本计算</p>
          </div>
        </div>
      )}

      {/* ═══ 物料价格编辑弹窗 ═══ */}
      {showPriceModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl animate-reveal flex flex-col max-h-[85vh] overflow-hidden border-2 border-amber-100">
            <header className="px-8 py-5 bg-gradient-to-r from-amber-500 to-orange-500 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><i className="fa-solid fa-coins text-lg"></i></div>
                <div>
                  <h3 className="text-lg font-black uppercase italic tracking-tight">物料价格表</h3>
                  <p className="text-[9px] font-bold text-amber-100 uppercase tracking-widest">MATERIAL PRICE TABLE</p>
                </div>
              </div>
              <button onClick={() => setShowPriceModal(false)} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-rose-500 transition-all flex items-center justify-center"><i className="fa-solid fa-times text-lg"></i></button>
            </header>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              <div className="space-y-2">
                {prices.map((p, i) => (
                  <div key={p.materialName} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="flex-1 text-[11px] font-black text-slate-700 truncate">{p.materialName}</span>
                    <span className="text-[9px] font-bold text-slate-400 shrink-0">¥</span>
                    <input type="number" step="0.01" className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-700 outline-none text-right focus:border-amber-400 transition-all"
                      value={p.unitPrice || ''} onChange={e => { const np = [...prices]; np[i] = { ...np[i], unitPrice: parseFloat(e.target.value) || 0 }; setPrices(np); }} placeholder="0.00" />
                    <select className="w-12 bg-white border border-slate-200 rounded-lg px-1 py-1.5 text-[10px] font-bold text-slate-600 outline-none shrink-0 cursor-pointer"
                      value={p.unit} onChange={e => { const np = [...prices]; np[i] = { ...np[i], unit: e.target.value }; setPrices(np); }}>
                      <option>/g</option><option>/kg</option><option>/mL</option><option>/L</option>
                    </select>
                  </div>
                ))}
              </div>
              {prices.length === 0 && <p className="text-center text-[11px] text-slate-400 py-8 italic">请先在配方中添加物料组分</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostAnalysisEngine;
