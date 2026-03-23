import React, { useMemo, useState, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label } from 'recharts';
import { getMaterialDos, hasMPApiKey, setMPApiKey, MPDosResult, MPDosOrbitalData, DopingInfo } from '../../../services/materialsProject';
import { useTranslation } from '../../../locales/useTranslation';

interface DosChartProps {
  material: string;
  dopingElement: string;
  dopingConcentration: number;
  coDopingElement?: string;
  coDopingConcentration?: number;
  additionalDopants?: Array<{ element: string; concentration: number }>;
  isLightMode: boolean;
}

const ELECTRONEGATIVITY: Record<string, number> = {
  'Ag': 1.93, 'Pt': 2.28, 'Pd': 2.20, 'Fe': 1.83, 'Ni': 1.91, 'Ce': 1.12,
  'S': 2.58, 'P': 2.19,
  'Co': 1.88, 'Cu': 1.90, 'Au': 2.54, 'Ru': 2.20, 'Ir': 2.20, 'W': 2.36, 'Mo': 2.16, 'V': 1.63, 'NiFe-LDH': 1.95,
  'ZIF-67 (MOF)': 1.85, 'MIL-101 (MOF)': 1.90, 'MOF-74': 1.92,
  'Fe-N-C (SAC)': 1.83, 'FeNC@NiFe-LDH (Heterostructure)': 1.89
};

// 6 种投影 DOS 的颜色方案
const DFT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

type DataSource = 'semi-empirical' | 'dft';

const DosChart: React.FC<DosChartProps> = ({ material, dopingElement, dopingConcentration, coDopingElement, coDopingConcentration, additionalDopants, isLightMode }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const isMOF = material.includes('MOF');

  // === DFT 数据源状态 ===
  const [dataSource, setDataSource] = useState<DataSource>('semi-empirical');
  const [dftData, setDftData] = useState<MPDosResult | null>(null);
  const [dftLoading, setDftLoading] = useState(false);
  const [dftError, setDftError] = useState<string | null>(null);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const metalLabel = (() => {
    const base = material.includes('@') ? material.split('@')[1] : material;
    return base.split(/[-\s(]/)[0] || material;
  })();

  // === 获取 DFT 数据 ===
  const fetchDftData = useCallback(async () => {
    if (!hasMPApiKey()) {
      setShowApiKeyInput(true);
      return;
    }
    setDftLoading(true);
    setDftError(null);
    try {
      const doping = dopingElement && dopingConcentration > 0
        ? { element: dopingElement, concentration: dopingConcentration }
        : undefined;
      const coDoping = coDopingElement && (coDopingConcentration || 0) > 0
        ? { element: coDopingElement, concentration: coDopingConcentration || 0 }
        : undefined;
      const extraDopants = (additionalDopants || []).filter(d => d.element && d.concentration > 0);
      const result = await getMaterialDos(material, doping, coDoping, extraDopants.length > 0 ? extraDopants : undefined);
      if (result) {
        setDftData(result);
        setDataSource('dft');
        setDftError(null);
      } else {
        setDftError(t('mechanism.visualizer.dosNotFound', { material }));
        setDataSource('semi-empirical');
      }
    } catch (err: any) {
      setDftError(err.message || t('mechanism.visualizer.dosFetchFailed'));
      setDataSource('semi-empirical');
    } finally {
      setDftLoading(false);
    }
  }, [material, dopingElement, dopingConcentration, coDopingElement, coDopingConcentration, additionalDopants]);

  const handleSaveApiKey = useCallback(() => {
    if (apiKeyInput.trim().length > 10) {
      setMPApiKey(apiKeyInput.trim());
      setShowApiKeyInput(false);
      setApiKeyInput('');
      // 保存后自动获取
      setTimeout(() => fetchDftData(), 100);
    }
  }, [apiKeyInput, fetchDftData]);

  // === 半经验模型数据 (保持原逻辑) ===
  const semiEmpiricalData = useMemo(() => {
    const points = [];
    const enBase = ELECTRONEGATIVITY[material] || 2.0;
    const enDopant = ELECTRONEGATIVITY[dopingElement] || 2.0;
    const enCoDopant = (coDopingElement && coDopingElement !== 'None') ? (ELECTRONEGATIVITY[coDopingElement] || 2.0) : enBase;
    const totalDoping = dopingConcentration + (coDopingConcentration || 0);
    const weight1 = totalDoping > 0 ? (dopingConcentration / totalDoping) : 1;
    const weight2 = totalDoping > 0 ? ((coDopingConcentration || 0) / totalDoping) : 0;
    const enDiff1 = enDopant - enBase;
    const enDiff2 = enCoDopant - enBase;
    const effectiveEnDiff = (enDiff1 * weight1) + (enDiff2 * weight2);
    const V2_sd = 1.5;
    const eps_s = -7.0;
    const ligandEffect = isMOF ? -0.8 : 0;
    const dCenterPure = -2.5 + ligandEffect;
    const hybridization = effectiveEnDiff * V2_sd / Math.abs(dCenterPure - eps_s);
    const concFactor = 1 - Math.exp(-totalDoping / 15);
    const dCenter = dCenterPure - hybridization * concFactor * 2.0;
    const oCenter = isMOF ? -3.8 : -4.2;
    const baseSigmaD = isMOF ? 0.9 : 0.7;
    const sigmaD = baseSigmaD * (1 + Math.abs(effectiveEnDiff) * 0.15);
    const sigmaO = 1.1;

    for (let e = -6; e <= 2; e += 0.04) {
      const m3d = Math.exp(-Math.pow(e - dCenter, 2) / (2 * Math.pow(sigmaD, 2))) * 3.0;
      const o2p = Math.exp(-Math.pow(e - oCenter, 2) / (2 * Math.pow(sigmaO, 2))) * 2.0;
      const impurityCenter1 = 0.15 - effectiveEnDiff * 0.3;
      const impurity1 = Math.exp(-Math.pow(e - impurityCenter1, 2) / (2 * Math.pow(0.2, 2))) * (dopingConcentration / 8);
      const impurityCenter2 = 0.15 - enDiff2 * 0.5;
      const impurity2 = Math.exp(-Math.pow(e - impurityCenter2, 2) / (2 * Math.pow(0.2, 2))) * ((coDopingConcentration || 0) / 8);
      const impurity = impurity1 + impurity2;
      const bg = 0.15 + (e > 0 ? 0.05 : 0);
      const total = m3d + o2p + impurity + bg;
      const m3dPure = Math.exp(-Math.pow(e - dCenterPure, 2) / (2 * Math.pow(baseSigmaD, 2))) * 3.0;
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

  // === DFT 图表数据 ===
  const dftChartData = useMemo(() => {
    if (!dftData || !dftData.orbitals.length) return null;

    const firstOrbital = dftData.orbitals[0];
    const points = firstOrbital.energies.map((e, i) => {
      const point: Record<string, number> = { energy: e };
      let total = 0;
      dftData.orbitals.forEach((orb, orbIdx) => {
        const key = `orb_${orbIdx}`;
        const val = orb.densities[i] || 0;
        point[key] = parseFloat(val.toFixed(4));
        if (orb.label !== 'Total DOS') total += val;
      });
      // 如果无 Total DOS 轨道，计算总和
      if (!dftData.orbitals.find(o => o.label === 'Total DOS')) {
        point['total_sum'] = parseFloat(total.toFixed(4));
      }
      return point;
    });
    return points;
  }, [dftData]);

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

  const isDftMode = dataSource === 'dft' && dftData && dftChartData;

  return (
    <div className="w-full flex flex-col items-center animate-reveal p-1">
      {/* === 标题栏 === */}
      <div className="w-full mb-5 px-3">
        {/* 第一行：标题 + d-band center */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex flex-col">
            <h4 className="text-xl font-black text-slate-800 italic uppercase tracking-tighter leading-none">
              {t('mechanism.visualizer.dosTitle')}
            </h4>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-indigo-600 font-mono text-[9px] font-black bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">PDOS v2.1</span>
              {isDftMode ? (
                <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-wide">
                  DFT ({dftData!.runType}) — {dftData!.materialId}
                </span>
              ) : (
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">{t('mechanism.visualizer.dosSemiEmpirical')}</span>
              )}
            </div>
          </div>

          {/* d-band center 卡片 — 独立右上角 */}
          {!isDftMode && !isComparing && (
            <div className="bg-gradient-to-br from-slate-50 to-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm text-right shrink-0">
              <span className="text-[7px] font-black text-slate-400 uppercase block tracking-widest leading-none">d-band center</span>
              <span className="text-lg font-black text-slate-800 italic leading-tight">{semiEmpiricalData.dCenter.toFixed(2)}</span>
              <span className="text-[10px] font-bold text-slate-500 ml-0.5">eV</span>
            </div>
          )}
        </div>

        {/* 第二行：操作按钮组 */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* DFT 获取按钮 */}
          <button
            onClick={fetchDftData}
            disabled={dftLoading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all border
              ${isDftMode
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
              }
              ${dftLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:shadow-md'}
            `}
          >
            {dftLoading ? (
              <><i className="fa-solid fa-spinner fa-spin text-[8px]"></i> {t('mechanism.visualizer.dosFetching')}</>
            ) : isDftMode ? (
              <><i className="fa-solid fa-check-circle text-[8px]"></i> {t('mechanism.visualizer.dosDftLoaded')}</>
            ) : (
              <><i className="fa-solid fa-database text-[8px]"></i> {t('mechanism.visualizer.dosFetchDft')}</>
            )}
          </button>

          {/* 数据源切换 */}
          {dftData && (
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setDataSource('dft')}
                className={`px-2 py-1 rounded-md text-[8px] font-black transition-all ${dataSource === 'dft' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >DFT</button>
              <button
                onClick={() => setDataSource('semi-empirical')}
                className={`px-2 py-1 rounded-md text-[8px] font-black transition-all ${dataSource === 'semi-empirical' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >Semi-Empirical</button>
            </div>
          )}

          {/* 分隔线 */}
          {!isDftMode && <div className="w-px h-5 bg-slate-200"></div>}

          {/* 对比模式 */}
          {!isDftMode && (
            <button
              onClick={() => setIsComparing(!isComparing)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all border
                ${isComparing
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }
              `}
            >
              <div className={`w-7 h-3.5 rounded-full transition-colors relative ${isComparing ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                <div className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform shadow-sm ${isComparing ? 'translate-x-3.5' : ''}`}></div>
              </div>
              {t('mechanism.visualizer.dosCompareMode')}
            </button>
          )}
        </div>
      </div>

      {/* === API Key 输入浮层 === */}
      {showApiKeyInput && (
        <div className="w-full mb-4 px-2">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-key text-amber-500 text-sm"></i>
              <span className="text-xs font-bold text-amber-700">{t('mechanism.visualizer.dosApiKeyRequired')}</span>
            </div>
            <p className="text-[10px] text-amber-600">
              {t('mechanism.visualizer.dosApiKeyDesc', { link: '' })}<a href="https://materialsproject.org" target="_blank" rel="noreferrer" className="underline font-bold">materialsproject.org</a>
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                placeholder={t('mechanism.visualizer.dosApiKeyPlaceholder')}
                className="flex-1 px-3 py-1.5 rounded-lg border border-amber-300 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={handleSaveApiKey}
                disabled={apiKeyInput.trim().length < 10}
                className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 disabled:opacity-40 transition-colors"
              >{t('mechanism.visualizer.dosApiKeySave')}</button>
              <button
                onClick={() => setShowApiKeyInput(false)}
                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
              >{t('mechanism.visualizer.dosApiKeyCancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* === 错误提示 === */}
      {dftError && (
        <div className="w-full mb-3 px-2">
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <i className="fa-solid fa-exclamation-triangle text-red-400 text-[10px]"></i>
            <span className="text-[10px] font-bold text-red-600">{dftError}</span>
          </div>
        </div>
      )}

      {/* === 图表区域 === */}
      <div className="w-full min-h-[400px] bg-white rounded-[2rem] border border-slate-200 p-2 shadow-xl relative overflow-hidden">
        {/* 图例 */}
        <div className="absolute top-4 right-6 flex flex-col gap-2.5 z-20 bg-white/85 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-xl">
          {isDftMode ? (
            // DFT 模式图例
            <>
              {dftData!.orbitals.map((orb, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="w-4 h-1.5 rounded-full" style={{ backgroundColor: DFT_COLORS[i % DFT_COLORS.length] }}></span>
                  <span className="text-[9px] font-black uppercase tracking-tight" style={{ color: DFT_COLORS[i % DFT_COLORS.length] }}>
                    {orb.label}
                  </span>
                </div>
              ))}
            </>
          ) : isComparing ? (
            <>
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-1.5 rounded-full bg-indigo-600"></span>
                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tight">{t('mechanism.visualizer.dosLegendHybridized')}</span>
              </div>
              <div className="flex items-center gap-2.5 opacity-60">
                <span className="w-4 h-0.5 border-t-2 border-slate-400 border-dashed"></span>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">{t('mechanism.visualizer.dosLegendPureState')}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-1.5 rounded-full bg-indigo-600"></span>
                <span className="text-[9px] font-black text-slate-800 uppercase tracking-tight">{t('mechanism.visualizer.dosLegendTotal')}</span>
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
                    {dopingElement || 'Dopant'}{t('mechanism.visualizer.dosLegendStates', { percent: String(dopingConcentration) })}
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
          {isDftMode ? (
            /* === DFT 渲染模式 === */
            <AreaChart data={dftChartData!} margin={{ top: 40, right: 10, left: 0, bottom: 20 }}>
              <defs>
                {dftData!.orbitals.map((_, i) => (
                  <linearGradient key={i} id={`gradDft${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={DFT_COLORS[i % DFT_COLORS.length]} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={DFT_COLORS[i % DFT_COLORS.length]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} opacity={0.6} />
              <XAxis dataKey="energy" type="number" domain={[-8, 4]} tick={{ fill: chartTheme.text, fontSize: 10, fontWeight: 'bold' }} axisLine={{ stroke: chartTheme.grid }}>
                <Label value={t('mechanism.visualizer.dosAxisEnergy')} offset={-10} position="insideBottom" style={{ fill: '#64748b', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }} />
              </XAxis>
              <YAxis
                width={40}
                domain={[0, (dataMax: number) => Math.ceil(dataMax + 0.5)]}
                tick={{ fill: chartTheme.text, fontSize: 10, fontWeight: 'bold' }}
                axisLine={{ stroke: chartTheme.grid }}
              >
                <Label value={t('mechanism.visualizer.dosAxisDOSStates')} angle={-90} position="insideLeft" style={{ fill: '#64748b', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', textAnchor: 'middle' }} />
              </YAxis>
              <Tooltip
                contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '10px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                labelFormatter={(v: number) => `E = ${v.toFixed(2)} eV`}
              />
              {dftData!.orbitals.map((orb, i) => (
                <Area
                  key={i}
                  type="monotone"
                  dataKey={`orb_${i}`}
                  name={orb.label}
                  stroke={DFT_COLORS[i % DFT_COLORS.length]}
                  strokeWidth={orb.label === 'Total DOS' ? 2.5 : 1.5}
                  fillOpacity={1}
                  fill={orb.label === 'Total DOS' ? 'transparent' : `url(#gradDft${i})`}
                  isAnimationActive={false}
                />
              ))}
              <ReferenceLine x={0} stroke={chartTheme.fermi} strokeWidth={2} strokeDasharray="6 4" opacity={0.6}>
                <Label value="EF" position="top" fill={chartTheme.fermi} fontSize={10} fontWeight="900" dy={-10} />
              </ReferenceLine>
            </AreaChart>
          ) : (
            /* === 半经验模型渲染模式 === */
            <AreaChart data={semiEmpiricalData.points} margin={{ top: 40, right: 10, left: 0, bottom: 20 }}>
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
                <Label value={t('mechanism.visualizer.dosAxisEnergy')} offset={-10} position="insideBottom" style={{ fill: '#64748b', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }} />
              </XAxis>
              <YAxis
                width={40}
                domain={[0, (dataMax: number) => Math.ceil(dataMax + 0.5)]}
                tick={{ fill: chartTheme.text, fontSize: 10, fontWeight: 'bold' }}
                axisLine={{ stroke: chartTheme.grid }}
              >
                <Label value={t('mechanism.visualizer.dosAxisDOS')} angle={-90} position="insideLeft" style={{ fill: '#64748b', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', textAnchor: 'middle' }} />
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
                  name={`${dopingElement || 'Dopant'}${t('mechanism.visualizer.dosLegendStates', { percent: String(dopingConcentration) })}${coDopingElement && coDopingElement !== 'None' && coDopingConcentration && coDopingConcentration > 0 ? ` + ${coDopingElement}` : ''}`}
                />
              )}
              {isComparing && (
                <Area type="monotone" dataKey="totalPure" stroke={chartTheme.totalPure} fill="url(#gradPure)" strokeWidth={1.5} strokeDasharray="4 4" animationDuration={1500} name="totalPure" />
              )}
              <Area type="monotone" dataKey="total" stroke={chartTheme.total} fill="transparent" strokeWidth={2.5} animationDuration={1500} name="total" />
              <ReferenceLine x={0} stroke={chartTheme.fermi} strokeWidth={2} strokeDasharray="6 4" opacity={0.6}>
                <Label value="EF" position="top" fill={chartTheme.fermi} fontSize={10} fontWeight="900" dy={-10} />
              </ReferenceLine>
              <ReferenceLine x={semiEmpiricalData.dCenter} stroke={chartTheme.accent} strokeWidth={2} strokeDasharray="4 4">
                <Label value={`d-band center (ε_d)`} position="top" fill={chartTheme.accent} fontSize={9} fontWeight="black" dy={-35} />
              </ReferenceLine>
            </AreaChart>
          )}
        </ResponsiveContainer>

        {/* DFT 数据引用标签 */}
        {isDftMode && (
          <div className="absolute bottom-3 left-4 right-4 flex justify-between items-end">
            <div className="text-[7px] text-slate-400 italic">
              Data: A. Jain et al., APL Materials 1, 011002 (2013) — materialsproject.org
            </div>
            <div className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <span className="text-[7px] font-bold text-emerald-600">{dftData!.formulaPretty} · Band gap: {dftData!.bandGap.toFixed(2)} eV</span>
            </div>
          </div>
        )}
      </div>

      {/* === PDOS分析面板 === */}
      <div className="w-full mt-6 flex flex-col px-2">
        <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2rem] mb-4 hover:text-indigo-600 transition-colors group/toggle w-fit">
          <i className={`fa-solid ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-[8px] transition-transform`}></i>
          <span>{t('mechanism.visualizer.dosPdosInsights')}</span>
        </button>
        {isExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-reveal">
            <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl flex items-start gap-4 group hover:bg-emerald-50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-500 shrink-0 shadow-sm"><i className="fa-solid fa-link"></i></div>
              <div className="min-w-0">
                <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">{isMOF ? t('mechanism.visualizer.dosHybridizationMOF') : t('mechanism.visualizer.dosHybridizationGeneral')}</h5>
                <p className="text-[11px] text-slate-600 leading-relaxed italic">
                  {isDftMode
                    ? t('mechanism.visualizer.dosDFTProjectedDesc', { id: dftData!.materialId })
                    : isMOF ? t('mechanism.visualizer.dosHybridizationMOFDesc') : t('mechanism.visualizer.dosHybridizationGeneralDesc')
                  }
                </p>
              </div>
            </div>
            <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl flex items-start gap-4 group hover:bg-indigo-50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-500 shrink-0 shadow-sm"><i className="fa-solid fa-chart-line"></i></div>
              <div className="min-w-0">
                <h5 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">{t('mechanism.visualizer.dosDBandOccupancy')}</h5>
                <p className="text-[11px] text-slate-600 leading-relaxed italic">
                  {isDftMode
                    ? t('mechanism.visualizer.dosDFTBandDesc', { formula: dftData!.formulaPretty, bandGap: dftData!.bandGap.toFixed(2), type: dftData!.bandGap < 0.1 ? t('mechanism.visualizer.dosBandGapMetal') : dftData!.bandGap < 2 ? t('mechanism.visualizer.dosBandGapNarrow') : t('mechanism.visualizer.dosBandGapWide') })
                    : t('mechanism.visualizer.dosFermiDesc')
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DosChart;