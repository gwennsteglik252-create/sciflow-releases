import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label } from 'recharts';

interface DosChartProps {
  material: string;
  dopingElement: string;
  dopingConcentration: number;
  coDopingElement?: string;
  coDopingConcentration?: number;
  isLightMode: boolean;
}

const ELECTRONEGATIVITY: Record<string, number> = {
  'Ag': 1.93, 'Pt': 2.28, 'Pd': 2.20, 'Fe': 1.83, 'Ni': 1.91, 'Ce': 1.12,
  'S': 2.58, 'P': 2.19,
  'Co': 1.88, 'Cu': 1.90, 'Au': 2.54, 'Ru': 2.20, 'Ir': 2.20, 'W': 2.36, 'Mo': 2.16, 'V': 1.63, 'NiFe-LDH': 1.95,
  'ZIF-67 (MOF)': 1.85, 'MIL-101 (MOF)': 1.90, 'MOF-74': 1.92,
  'Fe-N-C (SAC)': 1.83, 'FeNC@NiFe-LDH (Heterostructure)': 1.89
};

const DosChart: React.FC<DosChartProps> = ({ material, dopingElement, dopingConcentration, coDopingElement, coDopingConcentration, isLightMode }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const isMOF = material.includes('MOF');

  // 从 material 字符串中提取金属标识（用于图例显示）
  // 例如: 'NiFe-LDH' → 'NiFe', 'Fe-N-C (SAC)' → 'Fe', 'FeNC@NiFe-LDH' → 'FeNC'
  const metalLabel = (() => {
    // 先取 @ 后面的部分（如果有）
    const base = material.includes('@') ? material.split('@')[1] : material;
    // 再取第一个 - 或空格前的部分
    return base.split(/[-\s(]/)[0] || material;
  })();

  const data = useMemo(() => {
    const points = [];
    const enBase = ELECTRONEGATIVITY[material] || 2.0;
    const enDopant = ELECTRONEGATIVITY[dopingElement] || 2.0;
    const enCoDopant = (coDopingElement && coDopingElement !== 'None') ? (ELECTRONEGATIVITY[coDopingElement] || 2.0) : enBase;

    // Weighted electronegativity difference including co-dopant
    const totalDoping = dopingConcentration + (coDopingConcentration || 0);
    const weight1 = totalDoping > 0 ? (dopingConcentration / totalDoping) : 1;
    const weight2 = totalDoping > 0 ? ((coDopingConcentration || 0) / totalDoping) : 0;

    const enDiff1 = enDopant - enBase;
    const enDiff2 = enCoDopant - enBase;
    const effectiveEnDiff = (enDiff1 * weight1) + (enDiff2 * weight2);

    const ligandEffect = isMOF ? -0.8 : 0;
    const dCenter = -2.5 - (effectiveEnDiff * 1.5) + ligandEffect;
    const dCenterPure = -2.5 + ligandEffect;

    const oCenter = isMOF ? -3.8 : -4.2; // Ligand p-orbitals are higher
    const sigmaD = isMOF ? 0.9 : 0.7; // MOFs have broader bands due to multiple sites
    const sigmaO = 1.1;

    for (let e = -6; e <= 2; e += 0.04) {
      const m3d = Math.exp(-Math.pow(e - dCenter, 2) / (2 * Math.pow(sigmaD, 2))) * 3.0;
      const o2p = Math.exp(-Math.pow(e - oCenter, 2) / (2 * Math.pow(sigmaO, 2))) * 2.0;
      const impurity1 = Math.exp(-Math.pow(e - 0.15, 2) / (2 * Math.pow(0.2, 2))) * (dopingConcentration / 8);
      const impurity2 = Math.exp(-Math.pow(e - (0.15 - enDiff2 * 0.5), 2) / (2 * Math.pow(0.2, 2))) * ((coDopingConcentration || 0) / 8);
      const impurity = impurity1 + impurity2;
      const bg = 0.15 + (e > 0 ? 0.05 : 0);
      const total = m3d + o2p + impurity + bg;
      const m3dPure = Math.exp(-Math.pow(e - dCenterPure, 2) / (2 * Math.pow(sigmaD, 2))) * 3.0;
      const o2pPure = Math.exp(-Math.pow(e - oCenter, 2) / (2 * Math.pow(sigmaO, 2))) * 2.0;
      const totalPure = m3dPure + o2pPure + bg;

      points.push({
        energy: parseFloat(e.toFixed(2)),
        m3d: parseFloat(m3d.toFixed(3)),
        o2p: parseFloat(o2p.toFixed(3)),
        impurity: parseFloat(impurity.toFixed(3)),
        total: parseFloat(total.toFixed(3)),
        totalPure: parseFloat(totalPure.toFixed(3))
      });
    }
    return { points, dCenter, dCenterPure };
  }, [material, dopingElement, dopingConcentration, coDopingElement, coDopingConcentration, isMOF]);

  const chartTheme = {
    text: '#475569',
    grid: '#e2e8f0',
    total: '#6366f1',
    totalPure: '#94a3b8',
    m3d: '#818cf8',
    o2p: '#10b981',
    impurity: '#f59e0b',
    accent: '#f43f5e',
    fermi: '#0f172a'
  };

  return (
    <div className="w-full flex flex-col items-center animate-reveal p-1">
      <div className="w-full flex justify-between items-end mb-4 px-2">
        <div className="flex flex-col">
          <h4 className="text-lg font-black text-slate-800 italic uppercase tracking-tighter leading-none">
            电子态密度分布 <span className="text-indigo-600 font-mono text-[10px] ml-2">PDOS v2.0</span>
          </h4>
          <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest mt-1">Orbit-Projected Density of States (DFT)</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            <span className="text-[8px] font-bold text-slate-500 px-1">对比模式</span>
            <button
              onClick={() => setIsComparing(!isComparing)}
              className={`w-8 h-4 rounded-full transition-colors relative ${isComparing ? 'bg-indigo-600' : 'bg-slate-300'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isComparing ? 'translate-x-4' : ''}`}></div>
            </button>
          </div>

          {!isComparing && (
            <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm flex gap-4 ml-2">
              <div>
                <span className="text-[6px] font-black text-slate-400 uppercase block tracking-tighter">d-band center</span>
                <span className="text-base font-black text-slate-800 italic leading-none">{data.dCenter.toFixed(2)} eV</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full min-h-[400px] bg-white rounded-[2rem] border border-slate-200 p-2 shadow-xl relative overflow-hidden">
        {/* 优化后的专业图例 (Scientific Inset Legend) */}
        <div className="absolute top-4 right-6 flex flex-col gap-2.5 z-20 bg-white/85 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-xl">
          {isComparing ? (
            <>
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-1.5 rounded-full bg-indigo-600"></span>
                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tight">Hybridized (Curr)</span>
              </div>
              <div className="flex items-center gap-2.5 opacity-60">
                <span className="w-4 h-0.5 border-t-2 border-slate-400 border-dashed"></span>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">Pure State (Ref)</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-1.5 rounded-full bg-indigo-600"></span>
                <span className="text-[9px] font-black text-slate-800 uppercase tracking-tight">Total DOS</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-1.5 rounded-full bg-indigo-400 opacity-60"></span>
                <span className="text-[9px] font-black text-indigo-500 normal-case tracking-tight">{metalLabel}-3d</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-1.5 rounded-full bg-emerald-400 opacity-60"></span>
                <span className="text-[9px] font-black text-emerald-600 normal-case tracking-tight">O-2p</span>
              </div>
              {dopingConcentration > 0 && (
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-1.5 rounded-full bg-amber-400 opacity-70"></span>
                  <span className="text-[9px] font-black text-amber-600 normal-case tracking-tight">
                    {dopingElement || 'Dopant'}-States ({dopingConcentration}%)
                    {coDopingElement && coDopingElement !== 'None' && coDopingConcentration && coDopingConcentration > 0
                      ? ` + ${coDopingElement}`
                      : ''}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        <ResponsiveContainer width="100%" height={380}>
          <AreaChart data={data.points} margin={{ top: 40, right: 10, left: 0, bottom: 20 }}>
            <defs>
              <linearGradient id="gradM3d" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartTheme.m3d} stopOpacity={0.5} />
                <stop offset="95%" stopColor={chartTheme.m3d} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradO2p" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartTheme.o2p} stopOpacity={0.5} />
                <stop offset="95%" stopColor={chartTheme.o2p} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradPure" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartTheme.totalPure} stopOpacity={0.3} />
                <stop offset="95%" stopColor={chartTheme.totalPure} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradImpurity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartTheme.impurity} stopOpacity={0.6} />
                <stop offset="95%" stopColor={chartTheme.impurity} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} opacity={0.6} />
            <XAxis dataKey="energy" type="number" domain={[-6, 2]} tick={{ fill: chartTheme.text, fontSize: 10, fontWeight: 'bold' }} axisLine={{ stroke: chartTheme.grid }}>
              <Label value="Energy - EF (eV)" offset={-10} position="insideBottom" style={{ fill: '#64748b', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }} />
            </XAxis>
            <YAxis
              width={40}
              domain={[0, (dataMax: number) => Math.ceil(dataMax + 0.5)]}
              tick={{ fill: chartTheme.text, fontSize: 10, fontWeight: 'bold' }}
              axisLine={{ stroke: chartTheme.grid }}
            >
              <Label value="DOS" angle={-90} position="insideLeft" style={{ fill: '#64748b', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', textAnchor: 'middle' }} />
            </YAxis>
            <Tooltip
              contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '10px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
              itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
              labelStyle={{ color: '#64748b', marginBottom: '4px' }}
            />
            {!isComparing && (
              <Area type="monotone" dataKey="o2p" stroke={chartTheme.o2p} strokeWidth={1} fillOpacity={1} fill="url(#gradO2p)" isAnimationActive={false} />
            )}
            {!isComparing && (
              <Area type="monotone" dataKey="m3d" stroke={chartTheme.m3d} strokeWidth={1} fillOpacity={1} fill="url(#gradM3d)" isAnimationActive={false} />
            )}
            {!isComparing && dopingConcentration > 0 && (
              <Area type="monotone" dataKey="impurity" stroke={chartTheme.impurity} strokeWidth={1.5} fillOpacity={1} fill="url(#gradImpurity)" isAnimationActive={false}
                name={`${dopingElement || 'Dopant'}-States (${dopingConcentration}%)${coDopingElement && coDopingElement !== 'None' && coDopingConcentration && coDopingConcentration > 0 ? ` + ${coDopingElement}` : ''}`}
              />
            )}
            {isComparing && (
              <Area type="monotone" dataKey="totalPure" stroke={chartTheme.totalPure} fill="url(#gradPure)" strokeWidth={1.5} strokeDasharray="4 4" animationDuration={1500} name="totalPure" />
            )}
            <Area type="monotone" dataKey="total" stroke={chartTheme.total} fill="transparent" strokeWidth={2.5} animationDuration={1500} name="total" />
            <ReferenceLine x={0} stroke={chartTheme.fermi} strokeWidth={2} strokeDasharray="6 4" opacity={0.6}>
              <Label value="EF" position="top" fill={chartTheme.fermi} fontSize={10} fontWeight="900" dy={-10} />
            </ReferenceLine>
            <ReferenceLine x={data.dCenter} stroke={chartTheme.accent} strokeWidth={2} strokeDasharray="4 4">
              <Label value={`d-band center (ε_d)`} position="top" fill={chartTheme.accent} fontSize={9} fontWeight="black" dy={-35} />
            </ReferenceLine>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="w-full mt-6 flex flex-col px-2">
        <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2rem] mb-4 hover:text-indigo-600 transition-colors group/toggle w-fit">
          <i className={`fa-solid ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-[8px] transition-transform`}></i>
          <span>分轨道能带动力学洞察 (PDOS Insights)</span>
        </button>
        {isExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-reveal">
            <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl flex items-start gap-4 group hover:bg-emerald-50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-500 shrink-0 shadow-sm"><i className="fa-solid fa-link"></i></div>
              <div className="min-w-0">
                <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">{isMOF ? '金属-配体轨道杂化 (M-L Hybridization)' : 'p-d 轨道杂化强度 (Hybridization)'}</h5>
                <p className="text-[11px] text-slate-600 leading-relaxed italic">{isMOF ? '在费米能级深处观察到有机配体 π* 轨道与中心金属 d 轨道的高频耦合。这种离域效应有助于降低电荷转移电阻。' : '在 -4.0 eV 附近观察到 O-2p 与 M-3d 轨道的显著能级重叠。这种杂化强度的增加通常与更强的 M-O 键合相关。'}</p>
              </div>
            </div>
            <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl flex items-start gap-4 group hover:bg-indigo-50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-500 shrink-0 shadow-sm"><i className="fa-solid fa-chart-line"></i></div>
              <div className="min-w-0">
                <h5 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">d-band 填充分数 (Occupancy)</h5>
                <p className="text-[11px] text-slate-600 leading-relaxed italic">费米面 (EF) 附近的态密度主要由金属 d 轨道贡献。较高的 DOS 值预示着良好的电学传导特性。</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DosChart;