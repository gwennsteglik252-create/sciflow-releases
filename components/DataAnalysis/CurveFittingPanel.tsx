import React, { useState, useCallback, useMemo } from 'react';
import FixedPortal from './FixedPortal';
import { DataSeries, ChartDataPoint } from '../../types';
import {
  BUILT_IN_MODELS, fitCurve, fitCustomFormula, fitPiecewise, fitGlobal,
  FitResult, FitModel, PiecewiseFitResult, GlobalFitResult,
  WeightScheme, generateWeights,
} from '../../utils/curveFitting';

interface CurveFittingPanelProps {
  seriesList: DataSeries[];
  onAddFittedSeries: (series: DataSeries) => void;
}

type FitMode = 'standard' | 'weighted' | 'piecewise' | 'global';

const CurveFittingPanel: React.FC<CurveFittingPanelProps> = ({
  seriesList, onAddFittedSeries,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>(BUILT_IN_MODELS[0].id);
  const [targetSeriesId, setTargetSeriesId] = useState<string | null>(null);
  const [fitResult, setFitResult] = useState<FitResult | null>(null);
  const [isFitting, setIsFitting] = useState(false);

  // 自定义公式
  const [isCustom, setIsCustom] = useState(false);
  const [customFormula, setCustomFormula] = useState('a * x + b');
  const [customParams, setCustomParams] = useState('a, b');
  const [customInitial, setCustomInitial] = useState('1, 0');

  // 参数约束
  const [constraints, setConstraints] = useState<Record<string, { lower: string; upper: string }>>({});

  // ── 高级拟合模式 ──
  const [fitMode, setFitMode] = useState<FitMode>('standard');

  // 加权拟合
  const [weightScheme, setWeightScheme] = useState<WeightScheme>('uniform');
  const [customWeightsStr, setCustomWeightsStr] = useState('');

  // 分段拟合
  const [breakpointsStr, setBreakpointsStr] = useState('');
  const [segmentModelIds, setSegmentModelIds] = useState<string[]>([]);
  const [piecewiseResult, setPiecewiseResult] = useState<PiecewiseFitResult | null>(null);

  // 全局拟合
  const [globalSeriesIds, setGlobalSeriesIds] = useState<string[]>([]);
  const [sharedParamStr, setSharedParamStr] = useState('');
  const [globalResult, setGlobalResult] = useState<GlobalFitResult | null>(null);

  const selectedModel = useMemo(() =>
    BUILT_IN_MODELS.find(m => m.id === selectedModelId) || BUILT_IN_MODELS[0]
  , [selectedModelId]);

  const updateConstraint = (paramName: string, field: 'lower' | 'upper', value: string) => {
    setConstraints(prev => ({
      ...prev,
      [paramName]: { ...prev[paramName], [field]: value }
    }));
  };

  // ── 提取系列数据 ──
  const extractData = (series: DataSeries) =>
    series.data
      .map(d => ({ x: parseFloat(d.name), y: d.value }))
      .filter(d => !isNaN(d.x) && !isNaN(d.y))
      .sort((a, b) => a.x - b.x);

  // ── 标准 / 加权拟合 ──
  const executeStandardFit = useCallback(() => {
    const targetSeries = seriesList.find(s => s.id === (targetSeriesId || seriesList[0]?.id));
    if (!targetSeries) return;
    setIsFitting(true);

    setTimeout(() => {
      const inputData = extractData(targetSeries);
      if (inputData.length < 2) { setIsFitting(false); return; }

      // 计算权重
      let weights: number[] | undefined;
      if (fitMode === 'weighted') {
        if (weightScheme === 'custom') {
          const cw = customWeightsStr.split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
          weights = generateWeights(inputData, 'custom', cw);
        } else {
          weights = generateWeights(inputData, weightScheme);
        }
      }

      let result: FitResult;
      if (isCustom) {
        const paramNames = customParams.split(',').map(s => s.trim()).filter(Boolean);
        const initial = customInitial.split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
        while (initial.length < paramNames.length) initial.push(1);
        result = fitCustomFormula(inputData, customFormula, paramNames, initial, 200, weights);
      } else {
        const paramNames = selectedModel.paramNames;
        const lower = paramNames.map(n => { const v = parseFloat(constraints[n]?.lower || ''); return isNaN(v) ? -Infinity : v; });
        const upper = paramNames.map(n => { const v = parseFloat(constraints[n]?.upper || ''); return isNaN(v) ? Infinity : v; });
        const hasBounds = lower.some(v => isFinite(v)) || upper.some(v => isFinite(v));
        result = fitCurve(inputData, selectedModel, 200, hasBounds ? { lower, upper } : undefined, weights);
      }

      setFitResult(result);
      setPiecewiseResult(null);
      setGlobalResult(null);

      if (result.fittedCurve.length > 0) {
        const fittedData: ChartDataPoint[] = result.fittedCurve.map(p => ({
          name: String(Math.round(p.x * 1e6) / 1e6),
          value: Math.round(p.y * 1e6) / 1e6,
        }));
        onAddFittedSeries({
          id: `fit_${Date.now()}`,
          name: `${targetSeries.name} — ${result.modelName} 拟合`,
          data: fittedData,
          color: '#dc2626', pointColor: '#dc2626',
          strokeWidth: 2, visible: true, pointShape: 'none', pointSize: 0,
        });
      }
      setIsFitting(false);
    }, 50);
  }, [seriesList, targetSeriesId, selectedModel, isCustom, customFormula, customParams, customInitial, onAddFittedSeries, constraints, fitMode, weightScheme, customWeightsStr]);

  // ── 分段拟合 ──
  const executePiecewiseFit = useCallback(() => {
    const targetSeries = seriesList.find(s => s.id === (targetSeriesId || seriesList[0]?.id));
    if (!targetSeries) return;
    setIsFitting(true);

    setTimeout(() => {
      const inputData = extractData(targetSeries);
      if (inputData.length < 2) { setIsFitting(false); return; }

      const bps = breakpointsStr.split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v)).sort((a, b) => a - b);
      const xMin = inputData[0].x;
      const xMax = inputData[inputData.length - 1].x;
      const boundaries = [xMin, ...bps, xMax];

      const segments = [];
      for (let i = 0; i < boundaries.length - 1; i++) {
        const modelId = segmentModelIds[i] || selectedModelId;
        const model = BUILT_IN_MODELS.find(m => m.id === modelId) || BUILT_IN_MODELS[0];
        segments.push({ xStart: boundaries[i], xEnd: boundaries[i + 1], model });
      }

      const result = fitPiecewise(inputData, segments);
      setPiecewiseResult(result);
      setFitResult(null);
      setGlobalResult(null);

      if (result.combinedCurve.length > 0) {
        const fittedData: ChartDataPoint[] = result.combinedCurve.map(p => ({
          name: String(Math.round(p.x * 1e6) / 1e6),
          value: Math.round(p.y * 1e6) / 1e6,
        }));
        onAddFittedSeries({
          id: `fit_pw_${Date.now()}`,
          name: `${targetSeries.name} — 分段拟合`,
          data: fittedData,
          color: '#7c3aed', pointColor: '#7c3aed',
          strokeWidth: 2, visible: true, pointShape: 'none', pointSize: 0,
        });
      }
      setIsFitting(false);
    }, 50);
  }, [seriesList, targetSeriesId, breakpointsStr, segmentModelIds, selectedModelId, onAddFittedSeries]);

  // ── 全局拟合 ──
  const executeGlobalFit = useCallback(() => {
    if (globalSeriesIds.length < 2) return;
    setIsFitting(true);

    setTimeout(() => {
      const datasets = globalSeriesIds.map(sid => {
        const s = seriesList.find(ss => ss.id === sid);
        return s ? extractData(s) : [];
      }).filter(d => d.length >= 2);

      if (datasets.length < 2) { setIsFitting(false); return; }

      const sharedIndices = sharedParamStr
        .split(',')
        .map(s => {
          const name = s.trim();
          return selectedModel.paramNames.indexOf(name);
        })
        .filter(i => i >= 0);

      if (sharedIndices.length === 0) {
        // 默认共享所有参数
        sharedIndices.push(...selectedModel.paramNames.map((_, i) => i));
      }

      const result = fitGlobal({ datasets, model: selectedModel, sharedParamIndices: sharedIndices });
      setGlobalResult(result);
      setFitResult(null);
      setPiecewiseResult(null);

      // 添加每个数据集的拟合曲线
      result.fittedCurves.forEach((curve, idx) => {
        if (curve.length > 0) {
          const fittedData: ChartDataPoint[] = curve.map(p => ({
            name: String(Math.round(p.x * 1e6) / 1e6),
            value: Math.round(p.y * 1e6) / 1e6,
          }));
          const srcName = seriesList.find(s => s.id === globalSeriesIds[idx])?.name || `数据集${idx + 1}`;
          onAddFittedSeries({
            id: `fit_global_${idx}_${Date.now()}`,
            name: `${srcName} — 全局拟合`,
            data: fittedData,
            color: ['#dc2626', '#2563eb', '#16a34a', '#d97706'][idx % 4],
            pointColor: ['#dc2626', '#2563eb', '#16a34a', '#d97706'][idx % 4],
            strokeWidth: 2, visible: true, pointShape: 'none', pointSize: 0,
          });
        }
      });
      setIsFitting(false);
    }, 50);
  }, [globalSeriesIds, seriesList, selectedModel, sharedParamStr, onAddFittedSeries]);

  // ── 执行按钮分发 ──
  const executeFit = useCallback(() => {
    if (fitMode === 'piecewise') executePiecewiseFit();
    else if (fitMode === 'global') executeGlobalFit();
    else executeStandardFit();
  }, [fitMode, executeStandardFit, executePiecewiseFit, executeGlobalFit]);

  if (!isExpanded) {
    return (
      <button
        onClick={() => { setIsExpanded(true); if (!targetSeriesId && seriesList.length > 0) setTargetSeriesId(seriesList[0].id); }}
        className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border bg-white text-rose-600 border-rose-200 hover:bg-rose-600 hover:text-white active:scale-95 flex items-center gap-1.5 shadow-sm"
      >
        <i className="fa-solid fa-chart-line text-[10px]" /> 曲线拟合
      </button>
    );
  }

  // ── 诊断图表 Tab ──
  type DiagTab = 'residual' | 'qq' | 'cooks';
  const [diagTab, setDiagTab] = useState<DiagTab>('residual');
  const [showDiag, setShowDiag] = useState(false);

  // ── 残差图渲染 ──
  const renderResidualChart = (residuals: { x: number; y: number }[]) => {
    if (residuals.length === 0) return null;
    const xMin = Math.min(...residuals.map(r => r.x));
    const xMax = Math.max(...residuals.map(r => r.x));
    const yMin = Math.min(...residuals.map(r => r.y));
    const yMax = Math.max(...residuals.map(r => r.y));
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    const w = 380, h = 120, padL = 30, padR = 10, padT = 10, padB = 18;
    const pw = w - padL - padR, ph = h - padT - padB;
    const toSvgX = (x: number) => padL + ((x - xMin) / xRange) * pw;
    const toSvgY = (y: number) => padT + ph - ((y - yMin) / yRange) * ph;
    const zeroY = toSvgY(0);

    return (
      <svg width={w} height={h} className="w-full" viewBox={`0 0 ${w} ${h}`}>
        <line x1={padL} y1={zeroY} x2={w - padR} y2={zeroY} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="4 2" />
        {residuals.map((r, i) => (
          <circle key={i} cx={toSvgX(r.x)} cy={toSvgY(r.y)} r={2.5} fill={r.y >= 0 ? '#3b82f6' : '#ef4444'} fillOpacity={0.7} />
        ))}
        <line x1={padL} y1={padT} x2={padL} y2={h - padB} stroke="#64748b" strokeWidth={0.8} />
        <line x1={padL} y1={h - padB} x2={w - padR} y2={h - padB} stroke="#64748b" strokeWidth={0.8} />
        <text x={(padL + w - padR) / 2} y={h - 2} textAnchor="middle" fontSize={7} fill="#94a3b8" fontWeight="bold">X</text>
        <text x={8} y={(padT + h - padB) / 2} transform={`rotate(-90, 8, ${(padT + h - padB) / 2})`} textAnchor="middle" fontSize={7} fill="#94a3b8" fontWeight="bold">残差</text>
      </svg>
    );
  };

  // ── QQ 图渲染 ──
  const renderQQPlot = (residuals: { x: number; y: number }[]) => {
    if (residuals.length < 3) return <div className="text-[9px] text-slate-400 text-center py-4">数据点不足</div>;

    const resVals = residuals.map(r => r.y).sort((a, b) => a - b);
    const n = resVals.length;
    // 标准正态分位数 (inverse CDF 近似)
    const normalQuantile = (p: number): number => {
      // Rational approximation (Abramowitz & Stegun 26.2.23)
      if (p <= 0) return -4;
      if (p >= 1) return 4;
      const t = p < 0.5 ? Math.sqrt(-2 * Math.log(p)) : Math.sqrt(-2 * Math.log(1 - p));
      const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
      const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
      const q = t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
      return p < 0.5 ? -q : q;
    };

    const qqPoints = resVals.map((v, i) => ({
      theoretical: normalQuantile((i + 0.5) / n),
      sample: v,
    }));

    const theoMin = qqPoints[0].theoretical;
    const theoMax = qqPoints[qqPoints.length - 1].theoretical;
    const sampMin = Math.min(...qqPoints.map(p => p.sample));
    const sampMax = Math.max(...qqPoints.map(p => p.sample));
    const theoRange = theoMax - theoMin || 1;
    const sampRange = sampMax - sampMin || 1;

    const w = 380, h = 140, padL = 30, padR = 10, padT = 10, padB = 18;
    const pw = w - padL - padR, ph = h - padT - padB;
    const toX = (v: number) => padL + ((v - theoMin) / theoRange) * pw;
    const toY = (v: number) => padT + ph - ((v - sampMin) / sampRange) * ph;

    // 参考线（如果残差近似正态，点应沿参考线分布）
    const refLineStart = { x: theoMin, y: sampMin + (theoMin - theoMin) * (sampRange / theoRange) };
    const resMean = resVals.reduce((s, v) => s + v, 0) / n;
    const resStd = Math.sqrt(resVals.reduce((s, v) => s + (v - resMean) ** 2, 0) / (n - 1)) || 1;

    return (
      <svg width={w} height={h} className="w-full" viewBox={`0 0 ${w} ${h}`}>
        {/* 参考对角线 */}
        <line
          x1={toX(theoMin)} y1={toY(resMean + resStd * theoMin)}
          x2={toX(theoMax)} y2={toY(resMean + resStd * theoMax)}
          stroke="#dc2626" strokeWidth={1} strokeDasharray="6 3"
        />
        {/* 散点 */}
        {qqPoints.map((p, i) => (
          <circle key={i} cx={toX(p.theoretical)} cy={toY(p.sample)} r={2.5} fill="#6366f1" fillOpacity={0.7} />
        ))}
        {/* 轴 */}
        <line x1={padL} y1={padT} x2={padL} y2={h - padB} stroke="#64748b" strokeWidth={0.8} />
        <line x1={padL} y1={h - padB} x2={w - padR} y2={h - padB} stroke="#64748b" strokeWidth={0.8} />
        <text x={(padL + w - padR) / 2} y={h - 2} textAnchor="middle" fontSize={7} fill="#94a3b8" fontWeight="bold">理论分位数</text>
        <text x={8} y={(padT + h - padB) / 2} transform={`rotate(-90, 8, ${(padT + h - padB) / 2})`} textAnchor="middle" fontSize={7} fill="#94a3b8" fontWeight="bold">样本分位数</text>
      </svg>
    );
  };

  // ── Cook's Distance 渲染 ──
  const renderCooksDistance = (result: FitResult) => {
    const residuals = result.residuals;
    const n = residuals.length;
    const p = result.params.length; // 参数数
    if (n < p + 2) return <div className="text-[9px] text-slate-400 text-center py-4">数据点不足</div>;

    // 计算 Cook's Distance
    const yValues = residuals.map(r => r.y); // 这实际上是残差值
    const mse = yValues.reduce((s, v) => s + v * v, 0) / (n - p);

    // 简化版: Cook's D ≈ (e_i^2 / (p * MSE)) * (h_ii / (1 - h_ii)^2)
    // 没有完整的 hat matrix，用简化近似: h_ii ≈ 1/n + (x_i - x̄)² / Σ(x_j - x̄)²
    const xValues = residuals.map(r => r.x);
    const xMean = xValues.reduce((s, v) => s + v, 0) / n;
    const xSS = xValues.reduce((s, v) => s + (v - xMean) ** 2, 0) || 1;

    const cooksD = residuals.map((r, i) => {
      const hii = 1 / n + (r.x - xMean) ** 2 / xSS;
      const di = (r.y * r.y) / (p * mse) * (hii / Math.max(0.001, (1 - hii) ** 2));
      return { x: i + 1, d: di };
    });

    const threshold = 4 / n;
    const dMax = Math.max(...cooksD.map(c => c.d), threshold * 1.5);

    const w = 380, h = 120, padL = 30, padR = 10, padT = 10, padB = 18;
    const pw = w - padL - padR, ph = h - padT - padB;
    const barW = Math.max(2, Math.min(10, pw / n - 1));

    return (
      <svg width={w} height={h} className="w-full" viewBox={`0 0 ${w} ${h}`}>
        {/* 阈值线 4/n */}
        <line
          x1={padL} y1={padT + ph - (threshold / dMax) * ph}
          x2={w - padR} y2={padT + ph - (threshold / dMax) * ph}
          stroke="#dc2626" strokeWidth={0.8} strokeDasharray="4 2"
        />
        <text
          x={w - padR - 2} y={padT + ph - (threshold / dMax) * ph - 3}
          textAnchor="end" fontSize={7} fill="#dc2626" fontWeight="bold"
        >4/n = {threshold.toFixed(3)}</text>

        {/* 柱 */}
        {cooksD.map((c, i) => {
          const barH = (c.d / dMax) * ph;
          const x = padL + (i / n) * pw + (pw / n - barW) / 2;
          const isHigh = c.d > threshold;
          return (
            <rect
              key={i}
              x={x} y={padT + ph - barH}
              width={barW} height={Math.max(0.5, barH)}
              fill={isHigh ? '#dc2626' : '#6366f1'}
              fillOpacity={isHigh ? 0.85 : 0.5}
              rx={1}
            />
          );
        })}
        {/* 轴 */}
        <line x1={padL} y1={padT} x2={padL} y2={h - padB} stroke="#64748b" strokeWidth={0.8} />
        <line x1={padL} y1={h - padB} x2={w - padR} y2={h - padB} stroke="#64748b" strokeWidth={0.8} />
        <text x={(padL + w - padR) / 2} y={h - 2} textAnchor="middle" fontSize={7} fill="#94a3b8" fontWeight="bold">观测序号</text>
        <text x={8} y={(padT + h - padB) / 2} transform={`rotate(-90, 8, ${(padT + h - padB) / 2})`} textAnchor="middle" fontSize={7} fill="#94a3b8" fontWeight="bold">Cook's D</text>
      </svg>
    );
  };

  // ── 诊断区完整渲染 ──
  const renderDiagnostics = (result: FitResult) => (
    <div className="mt-3 bg-white rounded-xl border border-slate-100 p-2">
      {/* 3-tab 切换 */}
      <div className="flex bg-slate-100 p-0.5 rounded-lg mb-2 gap-0.5">
        {([
          { id: 'residual' as DiagTab, label: '残差图', icon: 'fa-chart-column' },
          { id: 'qq' as DiagTab, label: 'QQ 图', icon: 'fa-arrow-up-right-dots' },
          { id: 'cooks' as DiagTab, label: "Cook's D", icon: 'fa-exclamation-triangle' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setDiagTab(tab.id)}
            className={`flex-1 py-1.5 rounded-md text-[8px] font-black uppercase transition-all flex items-center justify-center gap-1 ${
              diagTab === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <i className={`fa-solid ${tab.icon} text-[7px]`} />
            {tab.label}
          </button>
        ))}
      </div>
      {diagTab === 'residual' && renderResidualChart(result.residuals)}
      {diagTab === 'qq' && renderQQPlot(result.residuals)}
      {diagTab === 'cooks' && renderCooksDistance(result)}
    </div>
  );

  // ── 格式化数值 ──
  const fmtNum = (v: number) =>
    Math.abs(v) < 0.001 || Math.abs(v) > 1e5 ? v.toExponential(4) : v.toFixed(6);

  // ── 拟合结果展示区（标准/加权） ──
  const renderFitResult = (result: FitResult) => (
    <div className="mt-4 space-y-3 animate-reveal">
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[10px] font-black text-slate-500 uppercase">拟合结果</h4>
          <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${result.converged ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {result.converged ? '已收敛' : '未收敛'}
          </span>
        </div>

        {/* 统计量 — 第一行 */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
            <div className="text-[8px] font-black text-slate-400 uppercase">R²</div>
            <div className="text-sm font-black text-indigo-600 font-mono">{result.rSquared.toFixed(6)}</div>
          </div>
          <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
            <div className="text-[8px] font-black text-slate-400 uppercase">χ²</div>
            <div className="text-sm font-black text-amber-600 font-mono">{result.chiSquared.toExponential(3)}</div>
          </div>
          <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
            <div className="text-[8px] font-black text-slate-400 uppercase">RMSE</div>
            <div className="text-sm font-black text-rose-600 font-mono">{result.rmse.toExponential(3)}</div>
          </div>
        </div>
        {/* 统计量 — 第二行 (AIC/BIC/约化χ²/自由度) */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
            <div className="text-[7px] font-black text-slate-400 uppercase">AIC</div>
            <div className="text-[11px] font-black text-teal-600 font-mono">{isFinite(result.aic) ? result.aic.toFixed(2) : '—'}</div>
          </div>
          <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
            <div className="text-[7px] font-black text-slate-400 uppercase">BIC</div>
            <div className="text-[11px] font-black text-cyan-600 font-mono">{isFinite(result.bic) ? result.bic.toFixed(2) : '—'}</div>
          </div>
          <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
            <div className="text-[7px] font-black text-slate-400 uppercase">χ²/ν</div>
            <div className="text-[11px] font-black text-purple-600 font-mono">{result.reducedChiSquared.toExponential(2)}</div>
          </div>
          <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
            <div className="text-[7px] font-black text-slate-400 uppercase">ν (DOF)</div>
            <div className="text-[11px] font-black text-slate-600 font-mono">{result.degreesOfFreedom}</div>
          </div>
        </div>

        {/* 公式 */}
        <div className="bg-white rounded-lg p-2 border border-slate-100 mb-3">
          <div className="text-[8px] font-black text-slate-400 uppercase mb-1">模型公式</div>
          <div className="text-xs font-mono text-slate-700">{result.formulaText}</div>
        </div>

        {/* 参数表 — 含 SE 和 95% CI */}
        <div className="space-y-1">
          <div className="text-[8px] font-black text-slate-400 uppercase mb-1">拟合参数</div>
          <div className="grid grid-cols-[60px_1fr_1fr] gap-x-2 text-[7px] font-black text-slate-300 uppercase px-3 mb-0.5">
            <span>参数</span>
            <span>值 ± SE</span>
            <span>95% CI</span>
          </div>
          {result.params.map(p => (
            <div key={p.name} className="grid grid-cols-[60px_1fr_1fr] gap-x-2 items-center bg-white rounded-lg px-3 py-1.5 border border-slate-100">
              <span className="text-xs font-black text-slate-600">{p.name}</span>
              <span className="text-[10px] font-mono font-bold text-indigo-600">
                {fmtNum(p.value)}
                {p.error !== undefined && (
                  <span className="text-slate-400"> ± {p.error.toExponential(2)}</span>
                )}
              </span>
              <span className="text-[9px] font-mono text-slate-400">
                {p.confidenceLower !== undefined && p.confidenceUpper !== undefined
                  ? `[${fmtNum(p.confidenceLower)}, ${fmtNum(p.confidenceUpper)}]`
                  : '—'}
              </span>
            </div>
          ))}
        </div>

        <div className="text-[8px] text-slate-400 text-right mt-2">
          {result.iterations} 次迭代
        </div>

        {/* 诊断图表切换 */}
        <button
          onClick={() => setShowDiag(!showDiag)}
          className="mt-2 w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase border border-blue-200 hover:bg-blue-100 transition-all flex items-center justify-center gap-1.5"
        >
          <i className={`fa-solid ${showDiag ? 'fa-chevron-up' : 'fa-stethoscope'} text-[9px]`} />
          {showDiag ? '收起诊断图表' : '拟合诊断 (残差/QQ/Cook\'s D)'}
        </button>
        {showDiag && renderDiagnostics(result)}
      </div>
    </div>
  );

  // ── 分段拟合结果 ──
  const renderPiecewiseResult = (result: PiecewiseFitResult) => (
    <div className="mt-4 space-y-3 animate-reveal">
      <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
        <h4 className="text-[10px] font-black text-purple-600 uppercase mb-3 flex items-center gap-1.5">
          <i className="fa-solid fa-puzzle-piece text-[9px]" /> 分段拟合结果
        </h4>
        {result.breakpoints.length > 0 && (
          <div className="text-[8px] text-slate-400 mb-2">
            断点: {result.breakpoints.map(b => b.toFixed(2)).join(', ')}
          </div>
        )}
        {result.segmentResults.map((seg, idx) => (
          <div key={idx} className="bg-white rounded-lg p-3 border border-purple-100 mb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black text-purple-700">区段 {idx + 1}: {seg.modelName}</span>
              <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${seg.converged ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {seg.converged ? '收敛' : '未收敛'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-[8px] mb-2">
              <div className="text-center"><span className="text-slate-400">R²</span><br /><span className="font-mono font-bold text-indigo-600">{seg.rSquared.toFixed(4)}</span></div>
              <div className="text-center"><span className="text-slate-400">AIC</span><br /><span className="font-mono font-bold text-teal-600">{isFinite(seg.aic) ? seg.aic.toFixed(1) : '—'}</span></div>
              <div className="text-center"><span className="text-slate-400">BIC</span><br /><span className="font-mono font-bold text-cyan-600">{isFinite(seg.bic) ? seg.bic.toFixed(1) : '—'}</span></div>
              <div className="text-center"><span className="text-slate-400">RMSE</span><br /><span className="font-mono font-bold text-rose-600">{seg.rmse.toExponential(2)}</span></div>
            </div>
            <div className="flex flex-wrap gap-1">
              {seg.params.map(p => (
                <span key={p.name} className="bg-slate-50 rounded px-1.5 py-0.5 text-[8px] font-mono border border-slate-100">
                  {p.name}={fmtNum(p.value)}{p.error !== undefined && <span className="text-slate-400">±{p.error.toExponential(1)}</span>}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── 全局拟合结果 ──
  const renderGlobalResult = (result: GlobalFitResult) => (
    <div className="mt-4 space-y-3 animate-reveal">
      <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-1.5">
            <i className="fa-solid fa-globe text-[9px]" /> 全局拟合结果
          </h4>
          <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${result.converged ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {result.converged ? '已收敛' : '未收敛'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-white rounded-lg p-2 text-center border border-emerald-100">
            <div className="text-[7px] font-black text-slate-400 uppercase">全局 R²</div>
            <div className="text-sm font-black text-indigo-600 font-mono">{result.globalRSquared.toFixed(6)}</div>
          </div>
          <div className="bg-white rounded-lg p-2 text-center border border-emerald-100">
            <div className="text-[7px] font-black text-slate-400 uppercase">AIC</div>
            <div className="text-sm font-black text-teal-600 font-mono">{isFinite(result.globalAic) ? result.globalAic.toFixed(2) : '—'}</div>
          </div>
          <div className="bg-white rounded-lg p-2 text-center border border-emerald-100">
            <div className="text-[7px] font-black text-slate-400 uppercase">BIC</div>
            <div className="text-sm font-black text-cyan-600 font-mono">{isFinite(result.globalBic) ? result.globalBic.toFixed(2) : '—'}</div>
          </div>
        </div>
        {/* 共享参数 */}
        {result.sharedParams.length > 0 && (
          <div className="mb-3">
            <div className="text-[8px] font-black text-emerald-500 uppercase mb-1">共享参数</div>
            <div className="flex flex-wrap gap-1.5">
              {result.sharedParams.map(p => (
                <span key={p.name} className="bg-white rounded-lg px-2 py-1 text-[9px] font-mono font-bold border border-emerald-200 text-emerald-700">
                  {p.name} = {fmtNum(p.value)}
                </span>
              ))}
            </div>
          </div>
        )}
        {/* 各数据集独立参数 */}
        {result.datasetParams.map((dp, idx) => (
          dp.length > 0 && (
            <div key={idx} className="mb-2">
              <div className="text-[8px] font-black text-slate-400 uppercase mb-0.5">
                数据集 {idx + 1} 独立参数
              </div>
              <div className="flex flex-wrap gap-1">
                {dp.map(p => (
                  <span key={p.name} className="bg-white rounded px-1.5 py-0.5 text-[8px] font-mono border border-slate-100">
                    {p.name}={fmtNum(p.value)}
                  </span>
                ))}
              </div>
            </div>
          )
        ))}
        <div className="text-[8px] text-slate-400 text-right mt-1">
          {result.iterations} 次迭代
        </div>
      </div>
    </div>
  );

  // 计算分段数
  const breakpoints = breakpointsStr.split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v));
  const segCount = breakpoints.length + 1;

  return (
    <FixedPortal onClose={() => setIsExpanded(false)}>
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 w-[440px] p-5 animate-reveal max-h-[85vh] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black text-slate-800 uppercase italic tracking-tight flex items-center gap-2">
          <i className="fa-solid fa-chart-line text-rose-500" /> 曲线拟合引擎
        </h3>
        <button onClick={() => setIsExpanded(false)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-all">
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </div>

      {/* ── 拟合模式选择 ── */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-4 gap-0.5">
        {([
          { id: 'standard' as FitMode, label: '标准', icon: 'fa-chart-simple' },
          { id: 'weighted' as FitMode, label: '加权', icon: 'fa-weight-hanging' },
          { id: 'piecewise' as FitMode, label: '分段', icon: 'fa-puzzle-piece' },
          { id: 'global' as FitMode, label: '全局', icon: 'fa-globe' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setFitMode(tab.id)}
            className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1 ${
              fitMode === tab.id ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <i className={`fa-solid ${tab.icon} text-[8px]`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 目标系列（非全局模式） ── */}
      {fitMode !== 'global' && (
        <div className="mb-4">
          <label className="text-[8px] font-black text-slate-400 uppercase mb-1.5 block">目标数据系列</label>
          <select
            value={targetSeriesId || seriesList[0]?.id || ''}
            onChange={e => setTargetSeriesId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold bg-white outline-none focus:border-rose-400"
          >
            {seriesList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.data.length}点)</option>)}
          </select>
        </div>
      )}

      {/* ── 加权拟合选项 ── */}
      {fitMode === 'weighted' && (
        <div className="mb-4 bg-amber-50 rounded-xl p-3 border border-amber-100">
          <div className="text-[8px] font-black text-amber-600 uppercase mb-2 flex items-center gap-1.5">
            <i className="fa-solid fa-weight-hanging text-[8px]" /> 权重方案
          </div>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            {([
              { id: 'uniform' as WeightScheme, label: '均匀 (无权重)' },
              { id: 'inverse_y2' as WeightScheme, label: '1/y² (相对权重)' },
              { id: 'inverse_sigma2' as WeightScheme, label: '1/|y| (泊松统计)' },
              { id: 'custom' as WeightScheme, label: '自定义' },
            ]).map(ws => (
              <button
                key={ws.id}
                onClick={() => setWeightScheme(ws.id)}
                className={`py-1.5 rounded-lg text-[9px] font-bold transition-all border ${
                  weightScheme === ws.id
                    ? 'bg-white border-amber-300 text-amber-700 shadow-sm'
                    : 'border-amber-100 text-amber-500 hover:border-amber-200'
                }`}
              >
                {ws.label}
              </button>
            ))}
          </div>
          {weightScheme === 'custom' && (
            <div>
              <label className="text-[7px] font-black text-slate-400 uppercase mb-1 block">权重值 (逗号分隔，与数据点一一对应)</label>
              <input
                className="w-full px-3 py-1.5 rounded-lg border border-amber-200 text-[10px] font-mono bg-white outline-none focus:border-amber-400"
                placeholder="1.0, 0.5, 2.0, ..."
                value={customWeightsStr}
                onChange={e => setCustomWeightsStr(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {/* ── 分段拟合配置 ── */}
      {fitMode === 'piecewise' && (
        <div className="mb-4 bg-purple-50 rounded-xl p-3 border border-purple-100">
          <div className="text-[8px] font-black text-purple-600 uppercase mb-2 flex items-center gap-1.5">
            <i className="fa-solid fa-puzzle-piece text-[8px]" /> 分段配置
          </div>
          <div className="mb-2">
            <label className="text-[7px] font-black text-slate-400 uppercase mb-1 block">断点 X 值 (逗号分隔)</label>
            <input
              className="w-full px-3 py-1.5 rounded-lg border border-purple-200 text-[10px] font-mono bg-white outline-none focus:border-purple-400"
              placeholder="例: 50, 100"
              value={breakpointsStr}
              onChange={e => setBreakpointsStr(e.target.value)}
            />
          </div>
          <div className="text-[7px] text-slate-400 mb-2">共 {segCount} 个区段，每段可选不同模型</div>
          <div className="space-y-1.5">
            {Array.from({ length: segCount }, (_, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[9px] font-black text-purple-500 w-12 shrink-0">区段 {i + 1}</span>
                <select
                  value={segmentModelIds[i] || selectedModelId}
                  onChange={e => {
                    const newIds = [...segmentModelIds];
                    newIds[i] = e.target.value;
                    setSegmentModelIds(newIds);
                  }}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-purple-200 text-[10px] font-bold bg-white outline-none focus:border-purple-400"
                >
                  {BUILT_IN_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 全局拟合配置 ── */}
      {fitMode === 'global' && (
        <div className="mb-4 bg-emerald-50 rounded-xl p-3 border border-emerald-100">
          <div className="text-[8px] font-black text-emerald-600 uppercase mb-2 flex items-center gap-1.5">
            <i className="fa-solid fa-globe text-[8px]" /> 多数据集共享参数拟合
          </div>
          <div className="mb-2">
            <label className="text-[7px] font-black text-slate-400 uppercase mb-1 block">选择数据集 (至少2个)</label>
            <div className="space-y-1 max-h-[120px] overflow-y-auto custom-scrollbar">
              {seriesList.map(s => (
                <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-emerald-100 hover:border-emerald-200 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={globalSeriesIds.includes(s.id)}
                    onChange={e => {
                      if (e.target.checked) setGlobalSeriesIds(prev => [...prev, s.id]);
                      else setGlobalSeriesIds(prev => prev.filter(id => id !== s.id));
                    }}
                    className="rounded accent-emerald-600"
                  />
                  <span className="text-[10px] font-bold text-slate-600">{s.name}</span>
                  <span className="text-[8px] text-slate-400 ml-auto">{s.data.length}点</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[7px] font-black text-slate-400 uppercase mb-1 block">
              共享参数名 (逗号分隔，留空=全部共享)
            </label>
            <input
              className="w-full px-3 py-1.5 rounded-lg border border-emerald-200 text-[10px] font-mono bg-white outline-none focus:border-emerald-400"
              placeholder={`例: ${selectedModel.paramNames.slice(0, 2).join(', ')}`}
              value={sharedParamStr}
              onChange={e => setSharedParamStr(e.target.value)}
            />
            <div className="text-[7px] text-slate-400 mt-1">
              可用参数: {selectedModel.paramNames.join(', ')}
            </div>
          </div>
        </div>
      )}

      {/* ── 模型选择（标准/加权/全局模式） ── */}
      {fitMode !== 'piecewise' && (
        <>
          {/* 内置 vs 自定义 切换 */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
            <button onClick={() => setIsCustom(false)} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${!isCustom ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>
              内置模型
            </button>
            <button onClick={() => setIsCustom(true)} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${isCustom ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400'}`}>
              自定义公式
            </button>
          </div>

          {isCustom ? (
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">公式 (使用 x 和参数名)</label>
                <input className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono bg-white outline-none focus:border-purple-400" placeholder="a * exp(-x / tau) + c" value={customFormula} onChange={e => setCustomFormula(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">参数名 (逗号分隔)</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono bg-white outline-none focus:border-purple-400" placeholder="a, tau, c" value={customParams} onChange={e => setCustomParams(e.target.value)} />
                </div>
                <div>
                  <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">初始值 (逗号分隔)</label>
                  <input className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono bg-white outline-none focus:border-purple-400" placeholder="1, 1, 0" value={customInitial} onChange={e => setCustomInitial(e.target.value)} />
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* 内置模型列表 */}
              <div className="mb-4 space-y-1.5 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                {BUILT_IN_MODELS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedModelId(m.id); setConstraints({}); }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all border ${
                      selectedModelId === m.id
                        ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-sm'
                        : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                    }`}
                  >
                    <div className="text-xs font-bold">{m.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{m.formula}</div>
                  </button>
                ))}
              </div>

              {/* 参数约束 */}
              <div className="mb-4 bg-slate-50 rounded-xl p-3 border border-slate-100">
                <div className="text-[8px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                  <i className="fa-solid fa-lock text-[8px]" /> 参数约束 (可选)
                </div>
                <div className="space-y-1.5">
                  {selectedModel.paramNames.map(pName => (
                    <div key={pName} className="grid grid-cols-[50px_1fr_1fr] gap-2 items-center">
                      <span className="text-[10px] font-black text-slate-600">{pName}</span>
                      <input type="text" placeholder="下界" value={constraints[pName]?.lower || ''} onChange={e => updateConstraint(pName, 'lower', e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-200 text-[10px] font-mono bg-white outline-none focus:border-rose-400 text-center" />
                      <input type="text" placeholder="上界" value={constraints[pName]?.upper || ''} onChange={e => updateConstraint(pName, 'upper', e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-200 text-[10px] font-mono bg-white outline-none focus:border-rose-400 text-center" />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* 执行按钮 */}
      <button
        onClick={executeFit}
        disabled={isFitting || seriesList.length === 0 || (fitMode === 'global' && globalSeriesIds.length < 2)}
        className="w-full py-3 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-xl text-xs font-black uppercase shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isFitting ? (
          <><i className="fa-solid fa-spinner animate-spin" /> 拟合计算中...</>
        ) : (
          <><i className="fa-solid fa-play" /> 执行{fitMode === 'piecewise' ? '分段' : fitMode === 'global' ? '全局' : ''}拟合</>
        )}
      </button>

      {/* ── 结果渲染 ── */}
      {fitResult && renderFitResult(fitResult)}
      {piecewiseResult && renderPiecewiseResult(piecewiseResult)}
      {globalResult && renderGlobalResult(globalResult)}
    </div>
    </FixedPortal>
  );
};

export default CurveFittingPanel;
