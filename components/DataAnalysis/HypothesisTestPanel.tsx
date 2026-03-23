import React, { useState, useCallback } from 'react';
import FixedPortal from './FixedPortal';
import { DataSeries, ChartAnnotation } from '../../types';
import {
  independentTTest, pairedTTest, oneWayANOVA, mannWhitneyU,
  chiSquaredTest, kolmogorovSmirnovTest, wilcoxonSignedRank,
  TestResult,
} from '../../utils/statisticalTests';

interface HypothesisTestPanelProps {
  seriesList: DataSeries[];
  onAddAnnotation?: (annotation: ChartAnnotation) => void;
}

type TestType = 'welch_t' | 'paired_t' | 'mann_whitney' | 'anova' | 'chi_squared' | 'ks_test' | 'wilcoxon';

const TEST_INFO: Record<TestType, { label: string; desc: string; minGroups: number; category: string }> = {
  welch_t:      { label: "Welch's t 检验", desc: '两组独立样本均值差异', minGroups: 2, category: '参数检验' },
  paired_t:     { label: '配对 t 检验',     desc: '两组配对样本均值差异', minGroups: 2, category: '参数检验' },
  anova:        { label: '单因素 ANOVA',    desc: '多组独立样本均值差异', minGroups: 2, category: '参数检验' },
  chi_squared:  { label: '卡方拟合优度',    desc: '观测 vs 期望频率', minGroups: 2, category: '参数检验' },
  mann_whitney: { label: 'Mann-Whitney U',  desc: '两组独立样本非参数检验', minGroups: 2, category: '非参数检验' },
  ks_test:      { label: 'Kolmogorov-Smirnov', desc: '双样本分布一致性检验', minGroups: 2, category: '非参数检验' },
  wilcoxon:     { label: 'Wilcoxon 符号秩', desc: '配对样本非参数检验', minGroups: 2, category: '非参数检验' },
};

/** p 值星号标记 */
const pValueStars = (p: number): string => {
  if (p < 0.001) return '***';
  if (p < 0.01) return '**';
  if (p < 0.05) return '*';
  return 'ns';
};

const formatPValue = (p: number): string => {
  if (p < 0.001) return p.toExponential(3);
  return p.toFixed(4);
};

const HypothesisTestPanel: React.FC<HypothesisTestPanelProps> = ({ seriesList, onAddAnnotation }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [testType, setTestType] = useState<TestType>('welch_t');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [alpha, setAlpha] = useState(0.05);
  const [result, setResult] = useState<TestResult | null>(null);

  const toggleId = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const executeTest = useCallback(() => {
    const groups = selectedIds
      .map(id => seriesList.find(s => s.id === id))
      .filter(Boolean)
      .map(s => s!.data.map(d => d.value).filter(v => !isNaN(v)));

    if (groups.length < 2) return;

    let res: TestResult;
    switch (testType) {
      case 'welch_t':      res = independentTTest(groups[0], groups[1], alpha); break;
      case 'paired_t':     res = pairedTTest(groups[0], groups[1], alpha); break;
      case 'mann_whitney': res = mannWhitneyU(groups[0], groups[1], alpha); break;
      case 'anova':        res = oneWayANOVA(groups, alpha); break;
      case 'chi_squared':  res = chiSquaredTest(groups[0], groups[1], alpha); break;
      case 'ks_test':      res = kolmogorovSmirnovTest(groups[0], groups[1], alpha); break;
      case 'wilcoxon':     res = wilcoxonSignedRank(groups[0], groups[1], alpha); break;
    }
    setResult(res);
  }, [selectedIds, seriesList, testType, alpha]);

  /** 将 p 值标注到图表 */
  const handleAnnotateToChart = useCallback(() => {
    if (!result || !onAddAnnotation) return;
    const stars = pValueStars(result.pValue);
    const text = `p = ${formatPValue(result.pValue)} ${stars}`;
    const annotation: ChartAnnotation = {
      id: `pval_${Date.now()}`,
      type: 'text',
      x1: 0.5,  // 图表中心偏上
      y1: 0.9,
      x2: 0.5,
      y2: 0.9,
      color: result.significant ? '#dc2626' : '#16a34a',
      strokeWidth: 1,
      fontSize: 14,
      fontWeight: '800',
      fontFamily: 'monospace',
      text,
    };
    onAddAnnotation(annotation);
  }, [result, onAddAnnotation]);

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border bg-white text-amber-600 border-amber-200 hover:bg-amber-600 hover:text-white active:scale-95 flex items-center gap-1.5 shadow-sm"
      >
        <i className="fa-solid fa-scale-unbalanced text-[10px]" /> 假设检验
      </button>
    );
  }

  // 按类别分组
  const parametric = (Object.entries(TEST_INFO) as [TestType, typeof TEST_INFO[TestType]][]).filter(([, v]) => v.category === '参数检验');
  const nonParametric = (Object.entries(TEST_INFO) as [TestType, typeof TEST_INFO[TestType]][]).filter(([, v]) => v.category === '非参数检验');

  return (
    <FixedPortal onClose={() => setIsExpanded(false)}>
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-white rounded-2xl shadow-2xl border border-slate-200 w-[400px] p-5 animate-reveal max-h-[80vh] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-slate-800 uppercase italic flex items-center gap-2">
          <i className="fa-solid fa-scale-unbalanced text-amber-500" /> 假设检验
        </h3>
        <button onClick={() => setIsExpanded(false)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </div>

      {/* 检验类型 — 参数检验 */}
      <div className="mb-1">
        <div className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-1 px-1">参数检验</div>
        <div className="space-y-1">
          {parametric.map(([key, info]) => (
            <button
              key={key}
              onClick={() => setTestType(key)}
              className={`w-full text-left px-3 py-2 rounded-xl border transition-all ${testType === key ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-slate-100 text-slate-600 hover:border-slate-200'}`}
            >
              <div className="text-[10px] font-bold">{info.label}</div>
              <div className="text-[8px] text-slate-400">{info.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 检验类型 — 非参数检验 */}
      <div className="mb-3">
        <div className="text-[7px] font-black text-slate-300 uppercase tracking-widest mb-1 px-1 mt-2">非参数检验</div>
        <div className="space-y-1">
          {nonParametric.map(([key, info]) => (
            <button
              key={key}
              onClick={() => setTestType(key)}
              className={`w-full text-left px-3 py-2 rounded-xl border transition-all ${testType === key ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-slate-100 text-slate-600 hover:border-slate-200'}`}
            >
              <div className="text-[10px] font-bold">{info.label}</div>
              <div className="text-[8px] text-slate-400">{info.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 选择系列 */}
      <div className="mb-3">
        <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block">
          {testType === 'chi_squared' ? '选择数据组 (第1组=观测值, 第2组=期望值)' : '选择数据组'}
        </label>
        <div className="space-y-1 max-h-[100px] overflow-y-auto custom-scrollbar">
          {seriesList.map(s => (
            <label key={s.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-[10px] font-bold ${selectedIds.includes(s.id) ? 'bg-amber-50 border-amber-200' : 'border-slate-100'}`}>
              <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleId(s.id)} className="accent-amber-600" />
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name} ({s.data.length}点)
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <label className="text-[8px] font-black text-slate-400 uppercase">显著性水平 α</label>
        <select value={alpha} onChange={e => setAlpha(parseFloat(e.target.value))} className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold bg-white outline-none">
          <option value={0.01}>0.01</option>
          <option value={0.05}>0.05</option>
          <option value={0.1}>0.10</option>
        </select>
      </div>

      <button
        onClick={executeTest}
        disabled={selectedIds.length < 2}
        className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-xs font-black uppercase shadow-lg active:scale-95 transition-all disabled:opacity-50 mb-3"
      >
        <i className="fa-solid fa-flask mr-1.5" /> 执行检验
      </button>

      {result && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 animate-reveal">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-slate-600">{result.testName}</span>
            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${result.significant ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {result.significant ? '显著差异 ✗' : '无显著差异 ✓'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
              <div className="text-[8px] font-black text-slate-400">统计量</div>
              <div className="text-sm font-black font-mono text-indigo-600">{result.statistic.toFixed(4)}</div>
            </div>
            <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
              <div className="text-[8px] font-black text-slate-400">p 值</div>
              <div className={`text-sm font-black font-mono ${result.pValue < alpha ? 'text-red-600' : 'text-emerald-600'}`}>
                {formatPValue(result.pValue)}
              </div>
            </div>
            <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
              <div className="text-[8px] font-black text-slate-400">显著性</div>
              <div className={`text-lg font-black font-mono ${result.significant ? 'text-red-600' : 'text-emerald-600'}`}>
                {pValueStars(result.pValue)}
              </div>
            </div>
          </div>

          <div className="space-y-0.5 mb-3">
            {Object.entries(result.details).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[9px]">
                <span className="text-slate-500">{k}</span>
                <span className="font-mono font-bold text-slate-700">{typeof v === 'number' ? v.toFixed(4) : v}</span>
              </div>
            ))}
          </div>

          {/* 标注到图表按钮 */}
          {onAddAnnotation && (
            <button
              onClick={handleAnnotateToChart}
              className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase border border-indigo-200 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-1.5 mt-1"
            >
              <i className="fa-solid fa-stamp text-[9px]" /> 标注 p 值到图表
            </button>
          )}
        </div>
      )}
    </div>
    </FixedPortal>
  );
};

export default HypothesisTestPanel;
