import React, { useState, useMemo } from 'react';
import FixedPortal from './FixedPortal';
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Tooltip, Legend,
} from 'recharts';
import { DataSeries } from '../../types';

interface PolarChartPanelProps {
  seriesList: DataSeries[];
}

/**
 * 极坐标图面板 — 将数据系列渲染为雷达图/极坐标图
 * 适合阻抗谱 (Nyquist)、性能对比雷达图等
 */
const PolarChartPanel: React.FC<PolarChartPanelProps> = ({ seriesList }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'radar' | 'nyquist'>('radar');

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const radarData = useMemo(() => {
    if (mode !== 'radar' || selectedIds.size === 0) return [];

    const selected = seriesList.filter(s => selectedIds.has(s.id));
    if (selected.length === 0) return [];

    // 使用第一个系列的 X 值作为维度名
    const dimensions = selected[0].data.map(d => d.name);

    return dimensions.map((dim, i) => {
      const entry: Record<string, any> = { dimension: dim };
      selected.forEach(s => {
        entry[s.name] = s.data[i]?.value ?? 0;
      });
      return entry;
    });
  }, [seriesList, selectedIds, mode]);

  const nyquistData = useMemo(() => {
    if (mode !== 'nyquist' || selectedIds.size === 0) return [];

    const selected = seriesList.filter(s => selectedIds.has(s.id));
    // Nyquist: X=实部, Y=虚部 (取第一个系列)
    return selected.flatMap(s =>
      s.data.map(d => ({
        x: parseFloat(d.name),
        y: d.value,
        name: s.name,
      })).filter(d => !isNaN(d.x) && !isNaN(d.y))
    );
  }, [seriesList, selectedIds, mode]);

  const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-600 hover:text-white active:scale-95 flex items-center gap-1.5 shadow-sm"
      >
        <i className="fa-solid fa-compass-drafting text-[10px]" /> 极坐标
      </button>
    );
  }

  return (
    <FixedPortal onClose={() => setIsExpanded(false)}>
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-white rounded-2xl shadow-2xl border border-slate-200 w-[420px] p-5 animate-reveal max-h-[80vh] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-slate-800 uppercase italic flex items-center gap-2">
          <i className="fa-solid fa-compass-drafting text-emerald-500" /> 极坐标图
        </h3>
        <button onClick={() => setIsExpanded(false)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </div>

      {/* 模式切换 */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-3">
        <button
          onClick={() => setMode('radar')}
          className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${mode === 'radar' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
        >
          雷达图
        </button>
        <button
          onClick={() => setMode('nyquist')}
          className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${mode === 'nyquist' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
        >
          Nyquist 图
        </button>
      </div>

      {/* 系列选择 */}
      <div className="space-y-1 mb-3 max-h-[100px] overflow-y-auto custom-scrollbar">
        {seriesList.map((s, i) => (
          <label key={s.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-[10px] font-bold transition-all ${selectedIds.has(s.id) ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-100 text-slate-500'}`}>
            <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleId(s.id)} className="accent-emerald-600" />
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color || COLORS[i % COLORS.length] }} />
            {s.name}
          </label>
        ))}
      </div>

      {/* 图表渲染 */}
      {selectedIds.size > 0 && (
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
          {mode === 'radar' && radarData.length > 0 && (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} />
                <PolarRadiusAxis tick={{ fontSize: 8, fill: '#94a3b8' }} />
                {seriesList.filter(s => selectedIds.has(s.id)).map((s, i) => (
                  <Radar
                    key={s.id}
                    name={s.name}
                    dataKey={s.name}
                    stroke={s.color || COLORS[i % COLORS.length]}
                    fill={s.color || COLORS[i % COLORS.length]}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700 }} />
                <Tooltip contentStyle={{ fontSize: 10, borderRadius: 12, border: '1px solid #e2e8f0' }} />
              </RadarChart>
            </ResponsiveContainer>
          )}

          {mode === 'nyquist' && nyquistData.length > 0 && (
            <div className="text-center">
              <svg viewBox={`0 0 360 280`} className="w-full">
                {(() => {
                  const xs = nyquistData.map(d => d.x);
                  const ys = nyquistData.map(d => d.y);
                  const xMin = Math.min(...xs), xMax = Math.max(...xs);
                  const yMin = Math.min(...ys), yMax = Math.max(...ys);
                  const xRange = xMax - xMin || 1;
                  const yRange = yMax - yMin || 1;
                  const pad = 40;
                  const w = 360 - 2 * pad, h = 280 - 2 * pad;

                  const toX = (v: number) => pad + ((v - xMin) / xRange) * w;
                  const toY = (v: number) => pad + h - ((v - yMin) / yRange) * h;

                  // 按系列分组
                  const grouped: Record<string, typeof nyquistData> = {};
                  nyquistData.forEach(d => {
                    if (!grouped[d.name]) grouped[d.name] = [];
                    grouped[d.name].push(d);
                  });

                  return (
                    <g>
                      {/* 网格 */}
                      {[0, 0.25, 0.5, 0.75, 1].map(t => (
                        <g key={t}>
                          <line x1={pad} y1={toY(yMin + t * yRange)} x2={pad + w} y2={toY(yMin + t * yRange)} stroke="#e2e8f0" strokeDasharray="3 3" />
                          <line x1={toX(xMin + t * xRange)} y1={pad} x2={toX(xMin + t * xRange)} y2={pad + h} stroke="#e2e8f0" strokeDasharray="3 3" />
                          <text x={pad - 5} y={toY(yMin + t * yRange) + 3} textAnchor="end" fontSize={8} fill="#94a3b8">{(yMin + t * yRange).toFixed(1)}</text>
                          <text x={toX(xMin + t * xRange)} y={pad + h + 14} textAnchor="middle" fontSize={8} fill="#94a3b8">{(xMin + t * xRange).toFixed(1)}</text>
                        </g>
                      ))}
                      {/* 轴标签 */}
                      <text x={pad + w / 2} y={pad + h + 30} textAnchor="middle" fontSize={10} fontWeight={700} fill="#475569">Z' (Ω)</text>
                      <text x={8} y={pad + h / 2} textAnchor="middle" fontSize={10} fontWeight={700} fill="#475569" transform={`rotate(-90, 8, ${pad + h / 2})`}>-Z'' (Ω)</text>
                      {/* 数据点 */}
                      {Object.entries(grouped).map(([name, pts], gi) => {
                        const series = seriesList.find(s => s.name === name);
                        const col = series?.color || COLORS[gi % COLORS.length];
                        return (
                          <g key={name}>
                            {pts.map((d, i) => (
                              <circle key={i} cx={toX(d.x)} cy={toY(d.y)} r={3} fill={col} opacity={0.8} />
                            ))}
                          </g>
                        );
                      })}
                    </g>
                  );
                })()}
              </svg>
            </div>
          )}
        </div>
      )}

      {selectedIds.size === 0 && (
        <div className="text-center py-8 text-xs text-slate-400">请选择至少一个数据系列</div>
      )}
    </div>
    </FixedPortal>
  );
};

export default PolarChartPanel;
