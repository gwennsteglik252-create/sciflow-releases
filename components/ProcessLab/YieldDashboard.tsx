/**
 * YieldDashboard.tsx — 良率看板 & SPC 控制图
 * 批次良率趋势、Cpk分布、QC通过率、状态分布 可视化仪表盘
 */
import React, { useMemo } from 'react';
import { ProcessBatch, Formulation } from '../../types';

interface Props {
  batches: ProcessBatch[];
  formulations: Formulation[];
}

// ─── 简易 SVG 折线图 ───
const MiniLineChart: React.FC<{ data: number[]; color: string; height?: number; threshold?: number }> = ({ data, color, height = 120, threshold }) => {
  if (data.length === 0) return <div className="flex items-center justify-center h-full text-[9px] text-slate-300 font-bold italic uppercase">NO DATA</div>;
  const max = Math.max(...data, threshold || 0) * 1.1 || 100;
  const min = Math.min(...data, threshold || Infinity) * 0.9;
  const range = max - min || 1;
  const w = 100 / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => `${i * w},${100 - ((v - min) / range) * 100}`).join(' ');
  const areaPoints = `0,100 ${points} ${(data.length - 1) * w},100`;
  const thresholdY = threshold !== undefined ? 100 - ((threshold - min) / range) * 100 : null;

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color})`} />
      {thresholdY !== null && <line x1="0" y1={thresholdY} x2="100" y2={thresholdY} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.5" />}
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {data.map((v, i) => (
        <circle key={i} cx={i * w} cy={100 - ((v - min) / range) * 100} r="2" fill="white" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
};

// ─── 环形进度图 ───
const DonutChart: React.FC<{ value: number; max: number; color: string; label: string; size?: number }> = ({ value, max, color, label, size = 80 }) => {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const r = 36; const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#f1f5f9" strokeWidth="6" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${pct * c} ${c}`} transform="rotate(-90 40 40)" className="transition-all duration-1000" />
        <text x="40" y="38" textAnchor="middle" className="text-[13px] font-black" fill="#1e293b">{Math.round(pct * 100)}%</text>
        <text x="40" y="50" textAnchor="middle" className="text-[7px] font-bold uppercase" fill="#94a3b8">{label}</text>
      </svg>
    </div>
  );
};

// ─── 横向柱状图 ───
const HBarChart: React.FC<{ items: { label: string; value: number; color: string }[] }> = ({ items }) => {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="text-[9px] font-black text-slate-500 w-16 text-right shrink-0 uppercase">{item.label}</span>
          <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden relative">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(item.value / max) * 100}%`, background: item.color }}></div>
          </div>
          <span className="text-[10px] font-black text-slate-700 w-8 shrink-0">{item.value}</span>
        </div>
      ))}
    </div>
  );
};

const YieldDashboard: React.FC<Props> = ({ batches, formulations }) => {
  const completed = useMemo(() => batches.filter(b => b.status === 'completed'), [batches]);
  const recent20 = useMemo(() => [...completed].reverse().slice(0, 20), [completed]);

  // 良率趋势数据
  const yieldTrend = useMemo(() => recent20.map(b => b.yield).reverse(), [recent20]);
  // Cpk趋势数据
  const cpkTrend = useMemo(() => recent20.filter(b => b.cpk !== undefined).map(b => b.cpk!).reverse(), [recent20]);

  // 统计
  const avgYield = useMemo(() => completed.length > 0 ? completed.reduce((s, b) => s + b.yield, 0) / completed.length : 0, [completed]);
  const avgCpk = useMemo(() => {
    const withCpk = completed.filter(b => b.cpk !== undefined);
    return withCpk.length > 0 ? withCpk.reduce((s, b) => s + (b.cpk || 0), 0) / withCpk.length : 0;
  }, [completed]);

  // 按配方分组良率
  const yieldByFormulation = useMemo(() => {
    const map: Record<string, { name: string; yields: number[]; count: number }> = {};
    completed.forEach(b => {
      const key = b.formulationId || 'unknown';
      if (!map[key]) {
        const f = formulations.find(f => f.id === key);
        map[key] = { name: b.formulationName || f?.name || '未关联', yields: [], count: 0 };
      }
      map[key].yields.push(b.yield);
      map[key].count++;
    });
    return Object.entries(map).map(([id, data]) => ({
      id, name: data.name, avg: data.yields.reduce((s, v) => s + v, 0) / data.yields.length, count: data.count,
    })).sort((a, b) => b.avg - a.avg);
  }, [completed, formulations]);

  // 状态分布
  const statusDist = useMemo(() => {
    const counts = { preparing: 0, in_progress: 0, completed: 0, rejected: 0, reworked: 0 };
    batches.forEach(b => { if (counts[b.status] !== undefined) counts[b.status]++; });
    return counts;
  }, [batches]);

  // QC 综合通过率
  const qcStats = useMemo(() => {
    let total = 0, passed = 0;
    completed.forEach(b => { b.qualityChecks.forEach(q => { total++; if (q.passed) passed++; }); });
    return { total, passed, rate: total > 0 ? (passed / total) * 100 : 0 };
  }, [completed]);

  // 良率等级分布
  const yieldBuckets = useMemo(() => {
    const buckets = { excellent: 0, good: 0, attention: 0, critical: 0 };
    completed.forEach(b => {
      if (b.yield >= 98) buckets.excellent++;
      else if (b.yield >= 95) buckets.good++;
      else if (b.yield >= 85) buckets.attention++;
      else buckets.critical++;
    });
    return buckets;
  }, [completed]);

  return (
    <div className="space-y-5 pb-12">
      {/* ─── KPI 概览行 ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '平均良率', value: `${avgYield.toFixed(1)}%`, sub: `${completed.length} 批次`, color: avgYield >= 95 ? 'text-emerald-600' : avgYield >= 85 ? 'text-amber-600' : 'text-rose-600', icon: 'fa-chart-pie', bg: 'bg-emerald-50' },
          { label: '平均 Cpk', value: avgCpk.toFixed(2), sub: avgCpk >= 1.33 ? '工艺能力充分' : avgCpk >= 1.0 ? '工艺能力一般' : '工艺能力不足', color: avgCpk >= 1.33 ? 'text-emerald-600' : avgCpk >= 1.0 ? 'text-amber-600' : 'text-rose-600', icon: 'fa-gauge-high', bg: 'bg-blue-50' },
          { label: 'QC 通过率', value: `${qcStats.rate.toFixed(1)}%`, sub: `${qcStats.passed}/${qcStats.total} 项`, color: qcStats.rate >= 95 ? 'text-emerald-600' : 'text-amber-600', icon: 'fa-clipboard-check', bg: 'bg-violet-50' },
          { label: '不合格批次', value: `${statusDist.rejected}`, sub: `返工 ${statusDist.reworked} 批`, color: statusDist.rejected > 0 ? 'text-rose-600' : 'text-emerald-600', icon: 'fa-triangle-exclamation', bg: 'bg-rose-50' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center`}><i className={`fa-solid ${kpi.icon} text-[11px] ${kpi.color}`}></i></div>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</span>
            </div>
            <p className={`text-3xl font-black ${kpi.color} leading-none mb-1`}>{kpi.value}</p>
            <p className="text-[9px] font-bold text-slate-400">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* ─── 良率趋势 + Cpk 趋势 ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-2"><i className="fa-solid fa-chart-line text-emerald-500"></i>良率趋势 (近 20 批)</h4>
            <span className="text-[8px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">阈值 90%</span>
          </div>
          <MiniLineChart data={yieldTrend} color="#10b981" height={140} threshold={90} />
          {yieldTrend.length > 0 && (
            <div className="flex gap-4 mt-3">
              <span className="text-[8px] font-bold text-slate-400">最高: <span className="text-emerald-600 font-black">{Math.max(...yieldTrend).toFixed(1)}%</span></span>
              <span className="text-[8px] font-bold text-slate-400">最低: <span className="text-rose-500 font-black">{Math.min(...yieldTrend).toFixed(1)}%</span></span>
              <span className="text-[8px] font-bold text-slate-400">标准差: <span className="text-indigo-600 font-black">{(Math.sqrt(yieldTrend.reduce((s, v) => s + Math.pow(v - avgYield, 2), 0) / yieldTrend.length) || 0).toFixed(2)}</span></span>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-2"><i className="fa-solid fa-gauge-high text-blue-500"></i>Cpk 趋势</h4>
            <span className="text-[8px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">阈值 1.33</span>
          </div>
          <MiniLineChart data={cpkTrend} color="#3b82f6" height={140} threshold={1.33} />
        </div>
      </div>

      {/* ─── 良率等级分布 + 按配方分组 ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 良率等级环形图 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-5"><i className="fa-solid fa-bullseye text-amber-500"></i>良率等级分布</h4>
          <div className="flex justify-around flex-wrap gap-3">
            <DonutChart value={yieldBuckets.excellent} max={completed.length || 1} color="#10b981" label="≥98%" />
            <DonutChart value={yieldBuckets.good} max={completed.length || 1} color="#3b82f6" label="95-98%" />
            <DonutChart value={yieldBuckets.attention} max={completed.length || 1} color="#f59e0b" label="85-95%" />
            <DonutChart value={yieldBuckets.critical} max={completed.length || 1} color="#ef4444" label="<85%" />
          </div>
        </div>

        {/* 批次状态分布 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-5"><i className="fa-solid fa-chart-bar text-indigo-500"></i>批次状态分布</h4>
          <HBarChart items={[
            { label: '已完成', value: statusDist.completed, color: '#10b981' },
            { label: '生产中', value: statusDist.in_progress, color: '#3b82f6' },
            { label: '准备中', value: statusDist.preparing, color: '#94a3b8' },
            { label: '已返工', value: statusDist.reworked, color: '#f59e0b' },
            { label: '已拒收', value: statusDist.rejected, color: '#ef4444' },
          ]} />
        </div>

        {/* 按配方分组良率排名 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-5"><i className="fa-solid fa-ranking-star text-amber-500"></i>配方良率排名</h4>
          {yieldByFormulation.length > 0 ? (
            <div className="space-y-2.5">
              {yieldByFormulation.slice(0, 6).map((f, i) => (
                <div key={f.id} className="flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-400'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-700 truncate">{f.name}</p>
                    <p className="text-[8px] font-bold text-slate-400">{f.count} 批次</p>
                  </div>
                  <span className={`text-sm font-black ${f.avg >= 95 ? 'text-emerald-600' : f.avg >= 85 ? 'text-amber-600' : 'text-rose-600'}`}>{f.avg.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] font-bold text-slate-400 text-center py-8 italic">暂无已完成批次数据</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default YieldDashboard;
