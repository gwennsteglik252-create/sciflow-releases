/**
 * KnowledgePoolPanel — 项目知识沉淀池
 * Aggregated Knowledge Benchmarking
 *
 * 功能模块：
 *  - 跨文献参数矩阵热力图
 *  - 结构化表格源流面板
 *  - AI 竞品差距分析
 *  - 雷达图 / 条形图 可视化对比
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Literature, KnowledgePool, BenchmarkEntry, BenchmarkDataPoint, GapAnalysisItem, MaterialSystemRow, ExtractedTable } from '../../types';
import { aggregateKnowledgePool, generateGapAnalysis } from '../../services/gemini/knowledgePool';
import { useProjectContext } from '../../context/ProjectContext';

interface KnowledgePoolPanelProps {
  projectId: string;
  projectTitle: string;
  resources: Literature[];
  knowledgePool?: KnowledgePool;
  targetMetrics?: { label: string; value: string; unit?: string; weight?: number; isHigherBetter?: boolean }[];
  onUpdatePool: (pool: KnowledgePool) => void;
  onNavigateToLiterature?: (id: string) => void;
}

type ViewMode = 'matrix' | 'radar' | 'bar' | 'gap';
type MetricFilter = 'all' | 'electrochemical' | 'structural' | 'stability' | 'cost';

const KnowledgePoolPanel: React.FC<KnowledgePoolPanelProps> = ({
  projectId,
  projectTitle,
  resources,
  knowledgePool,
  targetMetrics,
  onUpdatePool,
  onNavigateToLiterature
}) => {
  const { showToast } = useProjectContext();

  const [isAggregating, setIsAggregating] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');
  const [metricFilter, setMetricFilter] = useState<MetricFilter>('all');
  const [selectedMetric, setSelectedMetric] = useState<BenchmarkEntry | null>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysisItem[]>(knowledgePool?.gapAnalysis || []);
  const [selectedTable, setSelectedTable] = useState<ExtractedTable | null>(null);

  // The sinked resources count
  const sinkedCount = resources.filter(r => r.knowledgeSinked || (r.performance && r.performance.length > 0)).length;

  // Filter benchmarks by category + enrich legacy data
  const filteredBenchmarks = useMemo(() => {
    if (!knowledgePool?.benchmarks) return [];
    const base = metricFilter === 'all' ? knowledgePool.benchmarks : knowledgePool.benchmarks.filter(b => b.category === metricFilter);
    
    // Compatibility: enrich dataPoints that have empty materialSystem/rawValue (legacy data)
    return base.map(bm => ({
      ...bm,
      dataPoints: (bm.dataPoints || []).map(dp => ({
        ...dp,
        materialSystem: dp.materialSystem || extractMaterialName(dp.literatureTitle) || `来源 ${dp.year || ''}`,
        rawValue: dp.rawValue || `${dp.value}${bm.unit ? ' ' + bm.unit : ''}`,
        confidence: dp.confidence ?? 0.5,
      }))
    }));
  }, [knowledgePool?.benchmarks, metricFilter]);

  // Helper: extract a plausible material name from literature title
  function extractMaterialName(title: string): string {
    if (!title) return '';
    // Try to find catalytic/material patterns like "Fe-Co/NC", "N-doped Carbon", etc.
    const patterns = [
      /([A-Z][a-z]?(?:[-–][A-Z][a-z]?)*(?:\/[A-Z][A-Za-z0-9]*)?(?:@[A-Z][A-Za-z0-9]*)?)/,  // Fe-Co/NC, Ni@C
      /((?:[A-Z][a-z]?[-–]?)+(?:doped|modified|derived|based)\s+[A-Za-z]+)/i,  // N-doped Carbon
      /([A-Z][a-z]?\d?[A-Z][a-z]?\d?(?:\/[A-Za-z]+)?)/,  // CoN4/C
    ];
    for (const pat of patterns) {
      const m = title.match(pat);
      if (m && m[1].length >= 3 && m[1].length <= 30) return m[1];
    }
    // Fallback: first meaningful segment of the title
    return title.length > 25 ? title.substring(0, 22) + '...' : title;
  }

  // Aggregate knowledge pool from all literature
  const handleAggregate = useCallback(async () => {
    if (sinkedCount === 0) {
      showToast({ message: '暂无已沉淀的文献数据，请先对文献执行"知识沉淀"', type: 'warning' });
      return;
    }
    setIsAggregating(true);
    try {
      const pool = await aggregateKnowledgePool(
        projectId,
        projectTitle,
        resources.filter(r => r.performance && r.performance.length > 0),
        targetMetrics
      );
      onUpdatePool(pool);

      // Generate gap analysis if target metrics exist
      if (targetMetrics && targetMetrics.length > 0) {
        try {
          const gaps = await generateGapAnalysis(pool, targetMetrics);
          setGapAnalysis(gaps);
          onUpdatePool({ ...pool, gapAnalysis: gaps });
        } catch (e) {
          console.warn('Gap analysis failed:', e);
        }
      }

      showToast({ message: `知识沉淀池已更新：${pool.benchmarks.length} 个指标, ${pool.materialSystems.length} 个材料体系`, type: 'success' });
    } catch (e) {
      console.error(e);
      showToast({ message: '知识沉淀池聚合失败', type: 'error' });
    } finally {
      setIsAggregating(false);
    }
  }, [projectId, projectTitle, resources, targetMetrics, sinkedCount]);

  // Get cell color based on value ranking
  const getCellColor = (entry: BenchmarkEntry, value: number) => {
    const values = entry.dataPoints.map(d => d.value).sort((a, b) => a - b);
    const rank = values.indexOf(value);
    const pct = values.length > 1 ? rank / (values.length - 1) : 0.5;
    const adjusted = entry.isHigherBetter ? pct : 1 - pct;

    if (adjusted >= 0.8) return { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' };
    if (adjusted >= 0.6) return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-100' };
    if (adjusted >= 0.4) return { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-100' };
    if (adjusted >= 0.2) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' };
    return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100' };
  };

  // Gap status badge
  const getGapBadge = (status: string) => {
    switch (status) {
      case 'leading': return { icon: 'fa-crown', color: 'text-emerald-600 bg-emerald-50', label: '领先' };
      case 'competitive': return { icon: 'fa-check-circle', color: 'text-sky-600 bg-sky-50', label: '有竞争力' };
      case 'lagging': return { icon: 'fa-exclamation-triangle', color: 'text-amber-600 bg-amber-50', label: '待提升' };
      default: return { icon: 'fa-question-circle', color: 'text-slate-400 bg-slate-50', label: '无数据' };
    }
  };

  // ══════════════════════════════════════════════════════
  // EMPTY STATE — No knowledge pool generated yet
  // ══════════════════════════════════════════════════════
  if (!knowledgePool || !knowledgePool.benchmarks || knowledgePool.benchmarks.length === 0) {
    return (
      <div className="h-full flex flex-col animate-reveal">
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <i className="fa-solid fa-database text-sm"></i>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 italic">项目知识沉淀池</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em]">Aggregated Knowledge Benchmarking</p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-xl">
            {/* Animated icon with progress ring */}
            <div className="relative w-28 h-28 mx-auto mb-8">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="url(#pool-grad)" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${(sinkedCount / Math.max(resources.length, 1)) * 264} 264`}
                  className="transition-all duration-1000"
                />
                <defs><linearGradient id="pool-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6366f1"/><stop offset="100%" stopColor="#8b5cf6"/></linearGradient></defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-indigo-600 italic leading-none">{sinkedCount}</span>
                <span className="text-[7px] font-bold text-slate-400 uppercase mt-0.5">/ {resources.length} 篇已沉淀</span>
              </div>
            </div>

            <h3 className="text-xl font-black text-slate-800 mb-2 italic">启动跨文献对标分析</h3>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-6 max-w-sm mx-auto">
              AI 将从已沉淀文献中提取核心性能参数，自动归一化同义指标，并构建全景竞品对标矩阵。
            </p>

            {sinkedCount === 0 && (
              <div className="mb-6 px-4 py-2.5 bg-amber-50 border border-amber-100 rounded-xl inline-flex items-center gap-2">
                <i className="fa-solid fa-exclamation-circle text-amber-500 text-[10px]"></i>
                <span className="text-[10px] text-amber-700 font-bold">暂无已沉淀的文献，请先选择文献执行"知识沉淀"</span>
              </div>
            )}

            <div className="mb-8">
              <button
                onClick={handleAggregate}
                disabled={isAggregating || sinkedCount === 0}
                className="px-10 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-wider shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all active:scale-95"
              >
                {isAggregating ? (
                  <><i className="fa-solid fa-spinner fa-spin mr-2"></i>正在聚合分析...</>
                ) : (
                  <><i className="fa-solid fa-wand-magic-sparkles mr-2"></i>一键生成沉淀池</>
                )}
              </button>
            </div>

            {/* Feature cards */}
            <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto">
              {[
                { icon: 'fa-arrows-rotate', color: 'from-indigo-500 to-blue-500', title: '智能归一化', desc: '自动识别同义指标并统一命名' },
                { icon: 'fa-table-cells', color: 'from-violet-500 to-purple-500', title: '参数矩阵', desc: '跨文献性能参数热力对比' },
                { icon: 'fa-crosshairs', color: 'from-rose-500 to-pink-500', title: '差距分析', desc: '竞品差距量化与排名' },
              ].map((f, i) => (
                <div key={i} className="p-3.5 bg-white rounded-xl border border-slate-100 text-left hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${f.color} flex items-center justify-center mb-2.5`}>
                    <i className={`fa-solid ${f.icon} text-white text-[10px]`}></i>
                  </div>
                  <h5 className="text-[10px] font-black text-slate-800 mb-0.5">{f.title}</h5>
                  <p className="text-[8px] text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════
  // MAIN VIEW — Knowledge Pool with data
  // ══════════════════════════════════════════════════════
  return (
    <div className="h-full flex flex-col animate-reveal overflow-hidden">
      {/* ── Header ── */}
      <div className="px-8 pt-6 pb-4 bg-white border-b border-slate-100 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <i className="fa-solid fa-database text-sm"></i>
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 italic leading-tight">项目知识沉淀池</h2>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.25em]">Aggregated Knowledge Benchmarking</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Stats */}
            <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 mr-2">
              <div className="text-center">
                <div className="text-lg font-black text-indigo-600 leading-none">{filteredBenchmarks.length}</div>
                <div className="text-[7px] font-bold text-slate-400 uppercase">Metrics</div>
              </div>
              <div className="w-px h-6 bg-slate-200"></div>
              <div className="text-center">
                <div className="text-lg font-black text-violet-600 leading-none">{(knowledgePool.materialSystems || []).length}</div>
                <div className="text-[7px] font-bold text-slate-400 uppercase">Materials</div>
              </div>
              <div className="w-px h-6 bg-slate-200"></div>
              <div className="text-center">
                <div className="text-lg font-black text-emerald-600 leading-none">{knowledgePool.totalLiteratureSources}</div>
                <div className="text-[7px] font-bold text-slate-400 uppercase">Papers</div>
              </div>
            </div>

            {/* Refresh */}
            <button
              onClick={handleAggregate}
              disabled={isAggregating}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase shadow-md hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95"
            >
              {isAggregating ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-rotate"></i>}
              <span className="ml-1.5">{isAggregating ? '聚合中...' : '更新'}</span>
            </button>
          </div>
        </div>

        {/* View mode switcher + Category filter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 p-1 bg-slate-50 rounded-xl border border-slate-100">
            {([
              { key: 'matrix', icon: 'fa-table-cells', label: '参数矩阵' },
              { key: 'bar', icon: 'fa-chart-bar', label: '排名对比' },
              { key: 'radar', icon: 'fa-chart-pie', label: '雷达对比' },
              { key: 'gap', icon: 'fa-crosshairs', label: '差距分析' }
            ] as { key: ViewMode; icon: string; label: string }[]).map(v => (
              <button
                key={v.key}
                onClick={() => setViewMode(v.key)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all ${
                  viewMode === v.key
                    ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <i className={`fa-solid ${v.icon} mr-1`}></i>{v.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {([
              { key: 'all', label: '全部' },
              { key: 'electrochemical', label: '电化学' },
              { key: 'structural', label: '结构' },
              { key: 'stability', label: '稳定性' },
              { key: 'cost', label: '成本' }
            ] as { key: MetricFilter; label: string }[]).map(f => (
              <button
                key={f.key}
                onClick={() => setMetricFilter(f.key)}
                className={`px-2.5 py-1 rounded-lg text-[8px] font-bold transition-all ${
                  metricFilter === f.key
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content Area ── */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: Main View */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {/* AI Summary Banner */}
          {knowledgePool.aiSummary && (
            <div className="mb-6 px-5 py-4 bg-gradient-to-r from-indigo-50 to-violet-50 rounded-2xl border border-indigo-100">
              <div className="flex items-start gap-3">
                <i className="fa-solid fa-brain text-indigo-400 mt-0.5 text-sm"></i>
                <div>
                  <h4 className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1">AI 竞争格局概览</h4>
                  <p className="text-[11px] text-slate-700 leading-relaxed">{knowledgePool.aiSummary}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Matrix View ── */}
          {viewMode === 'matrix' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                  <i className="fa-solid fa-table-cells text-[9px]"></i>
                  跨文献核心参数矩阵 (Parameter Heatmap)
                </h3>
                <span className="text-[8px] font-bold text-slate-400 uppercase">
                  AI extracted from {knowledgePool.totalLiteratureSources} papers
                </span>
              </div>

              {filteredBenchmarks.map((bm, idx) => {
                const sorted = [...bm.dataPoints].sort((a, b) => bm.isHigherBetter ? b.value - a.value : a.value - b.value);
                const maxVal = Math.max(...sorted.map(d => d.value));
                const minVal = Math.min(...sorted.map(d => d.value));
                return (
                <div
                  key={bm.metricId || idx}
                  onClick={() => {
                    const isSame = selectedMetric?.metricId === bm.metricId && selectedMetric?.displayName === bm.displayName;
                    setSelectedMetric(isSame ? null : bm);
                  }}
                  className={`bg-white rounded-2xl border p-5 cursor-pointer transition-all hover:shadow-lg active:scale-[0.99] group ${
                    selectedMetric?.metricId === bm.metricId && selectedMetric?.displayName === bm.displayName
                      ? 'border-indigo-300 shadow-lg ring-2 ring-indigo-100'
                      : 'border-slate-100 hover:border-indigo-200'
                  }`}
                >
                  {/* Metric Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-6 rounded-full ${bm.category === 'electrochemical' ? 'bg-indigo-500' : bm.category === 'structural' ? 'bg-violet-500' : bm.category === 'stability' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                      <h4 className="text-[13px] font-black text-slate-800">{bm.displayName}</h4>
                      {bm.condition && (
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md text-[8px] font-bold text-slate-500">
                          {bm.condition}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] font-bold text-slate-400">{bm.unit}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase ${
                        bm.isHigherBetter ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {bm.isHigherBetter ? '↑ Higher Better' : '↓ Lower Better'}
                      </span>
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[7px] font-bold">
                        {(bm.dataPoints || []).length}组对比
                      </span>
                    </div>
                  </div>

                  {/* Data Points Grid — with rank badges */}
                  <div className="flex flex-wrap gap-2">
                    {sorted.map((dp, i) => {
                        const colors = getCellColor(bm, dp.value);
                        const barPct = maxVal > minVal ? ((dp.value - minVal) / (maxVal - minVal)) * 100 : 50;
                        return (
                          <div
                            key={i}
                            onClick={(e) => {
                              if (dp.literatureId && onNavigateToLiterature) {
                                e.stopPropagation();
                                onNavigateToLiterature(dp.literatureId);
                              }
                            }}
                            className={`relative px-3.5 py-3 rounded-xl border ${colors.bg} ${colors.border} transition-all ${onNavigateToLiterature && dp.literatureId ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'group-hover:shadow-sm'} min-w-[140px] ${dp.isOurs ? 'ring-2 ring-indigo-300 ring-offset-1' : ''}`}
                            title={onNavigateToLiterature && dp.literatureId ? '点击查看来源文献详情' : undefined}
                          >
                            {/* Rank badge */}
                            <div className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-black shadow-sm ${
                              i === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-400 text-white' : 'bg-white border border-slate-200 text-slate-500'
                            }`}>
                              {i === 0 ? '👑' : `#${i + 1}`}
                            </div>
                            {dp.isOurs && (
                              <span className="absolute -top-1.5 -left-1.5 px-1.5 py-0.5 bg-indigo-600 text-white rounded-md text-[6px] font-black uppercase shadow-sm">Ours</span>
                            )}
                            <div className={`text-[16px] font-black ${colors.text} italic leading-none mb-2`}>
                              {dp.rawValue || '—'}
                            </div>
                            <div className="text-[10px] font-bold text-slate-700 truncate max-w-[150px]" title={dp.materialSystem}>
                              {dp.materialSystem || '未知材料'}
                            </div>
                            {/* Mini progress bar */}
                            <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-500 ${i === 0 ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-slate-300'}`} style={{ width: `${barPct}%` }}></div>
                            </div>
                            <div className="text-[9px] text-slate-500 font-medium mt-1">{dp.year || ''}</div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              );})}
            </div>
          )}

          {/* ── Bar Chart View ── */}
          {viewMode === 'bar' && (
            <div className="space-y-6">
              <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-chart-bar text-[9px]"></i>
                性能指标排名对比
              </h3>
              {filteredBenchmarks.map(bm => {
                const sorted = [...bm.dataPoints].sort((a, b) =>
                  bm.isHigherBetter ? b.value - a.value : a.value - b.value
                );
                const maxVal = Math.max(...sorted.map(d => d.value));
                return (
                  <div key={bm.metricId} className="bg-white rounded-2xl border border-slate-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[12px] font-black text-slate-800">{bm.displayName}</h4>
                      <span className="text-[8px] font-bold text-slate-400">{bm.unit}</span>
                    </div>
                    <div className="space-y-2.5">
                      {sorted.map((dp, i) => {
                        const pct = maxVal > 0 ? (dp.value / maxVal) * 100 : 0;
                        const isFirst = i === 0;
                        return (
                          <div 
                            key={i} 
                            onClick={(e) => {
                              if (dp.literatureId && onNavigateToLiterature) {
                                e.stopPropagation();
                                onNavigateToLiterature(dp.literatureId);
                              }
                            }}
                            className={`flex items-center gap-3 group/row p-1.5 -mx-1.5 rounded-xl transition-all ${onNavigateToLiterature && dp.literatureId ? 'cursor-pointer hover:bg-slate-50' : ''} ${dp.isOurs ? 'bg-indigo-50/50' : ''}`}
                            title={onNavigateToLiterature && dp.literatureId ? '点击查看来源文献详情' : undefined}
                          >
                            <div className="w-6 text-right shrink-0">
                              <span className={`text-[10px] font-black ${isFirst ? 'text-amber-500' : 'text-slate-400'}`}>
                                {isFirst ? '🏆' : `#${i + 1}`}
                              </span>
                            </div>
                            <div className="w-36 truncate shrink-0 flex items-center gap-1.5">
                              {dp.isOurs && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>}
                              <span className={`text-[11px] font-bold ${dp.isOurs ? 'text-indigo-700' : 'text-slate-800'}`} title={dp.materialSystem}>
                                {dp.materialSystem || '未知'}
                              </span>
                            </div>
                            <div className="flex-1 h-7 bg-slate-100 rounded-lg overflow-hidden">
                              <div
                                className={`h-full rounded-lg transition-all duration-700 ${
                                  isFirst
                                    ? 'bg-gradient-to-r from-indigo-500 to-violet-500'
                                    : dp.isOurs
                                      ? 'bg-gradient-to-r from-emerald-400 to-cyan-400'
                                      : 'bg-gradient-to-r from-slate-300 to-slate-400'
                                }`}
                                style={{ width: `${pct}%`, minWidth: '2rem' }}
                              ></div>
                            </div>
                            <span className="text-[11px] font-black text-slate-800 w-24 text-right shrink-0">{dp.rawValue || '—'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Radar View ── */}
          {viewMode === 'radar' && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-violet-600 uppercase tracking-widest flex items-center gap-2 mb-2">
                <i className="fa-solid fa-chart-pie text-[9px]"></i>
                多维性能雷达对比
              </h3>

              {/* Material selection */}
              <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-2">选择材料体系对比 (2-5个)</p>
                <div className="flex flex-wrap gap-1.5">
                  {(knowledgePool.materialSystems || []).map(ms => (
                    <button
                      key={ms.id}
                      onClick={() => {
                        setSelectedMaterials(prev => {
                          const next = new Set(prev);
                          if (next.has(ms.name)) next.delete(ms.name);
                          else if (next.size < 5) next.add(ms.name);
                          return next;
                        });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all border ${
                        selectedMaterials.has(ms.name)
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                      }`}
                    >
                      {ms.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Simple Radar Chart using SVG */}
              {selectedMaterials.size >= 2 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
                  <RadarChart
                    benchmarks={filteredBenchmarks}
                    materials={[...selectedMaterials]}
                  />
                </div>
              )}

              {selectedMaterials.size < 2 && (
                <div className="bg-slate-50 rounded-2xl border border-slate-100 p-12 text-center">
                  <i className="fa-solid fa-chart-pie text-3xl text-slate-300 mb-3"></i>
                  <p className="text-[11px] text-slate-500 font-medium">请至少选择 2 个材料体系进行对比</p>
                </div>
              )}
            </div>
          )}

          {/* ── Gap Analysis View ── */}
          {viewMode === 'gap' && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-2 mb-2">
                <i className="fa-solid fa-crosshairs text-[9px]"></i>
                竞品差距分析报告
              </h3>

              {gapAnalysis.length === 0 ? (
                <div className="bg-slate-50 rounded-2xl border border-slate-100 p-12 text-center">
                  <i className="fa-solid fa-crosshairs text-3xl text-slate-300 mb-3"></i>
                  <p className="text-[11px] text-slate-500 font-medium mb-4">
                    {targetMetrics && targetMetrics.length > 0
                      ? '点击上方"更新"按钮生成差距分析'
                      : '需要在项目中设置目标指标 (targetMetrics) 后才能生成差距分析'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {gapAnalysis.map((gap, i) => {
                    const badge = getGapBadge(gap.status);
                    return (
                      <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-lg transition-all relative overflow-hidden">
                        {/* Left color indicator */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${gap.status === 'leading' ? 'bg-emerald-500' : gap.status === 'competitive' ? 'bg-sky-500' : 'bg-amber-500'}`}></div>
                        
                        <div className="flex items-center justify-between mb-4 pl-3">
                          <h4 className="text-[13px] font-black text-slate-800">{gap.metricName}</h4>
                          <span className={`px-3 py-1.5 rounded-xl text-[8px] font-black ${badge.color} flex items-center gap-1.5 shadow-sm`}>
                            <i className={`fa-solid ${badge.icon} text-[8px]`}></i>
                            {badge.label}
                          </span>
                        </div>

                        {/* VS Comparison */}
                        <div className="grid grid-cols-2 gap-0 mb-4 pl-3">
                          <div className="pr-4 border-r border-slate-100">
                            <div className="text-[7px] font-black text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>本项目
                            </div>
                            <div className="text-[18px] font-black text-indigo-600 italic leading-none">
                              {gap.ourValue ?? '—'}
                              <span className="text-[9px] font-bold text-indigo-400 ml-1 not-italic">{gap.ourUnit || ''}</span>
                            </div>
                          </div>
                          <div className="pl-4">
                            <div className="text-[7px] font-black text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>文献最佳
                            </div>
                            <div className="text-[18px] font-black text-emerald-600 italic leading-none">
                              {gap.bestValue}
                              <span className="text-[9px] font-bold text-emerald-400 ml-1 not-italic">{gap.ourUnit || ''}</span>
                            </div>
                          </div>
                        </div>

                        {/* Gap + Percentile row */}
                        <div className="flex items-center gap-4 mb-3 pl-3">
                          <div className={`px-3 py-1.5 rounded-lg text-[11px] font-black italic ${(gap.gap ?? 0) > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {(gap.gap ?? 0) > 0 ? `+${(gap.gap ?? 0).toFixed(1)}` : (gap.gap ?? 0).toFixed(1)}%
                          </div>
                          <div className="px-3 py-1.5 bg-violet-50 text-violet-600 rounded-lg text-[11px] font-black italic">
                            Top {100 - (gap.percentile ?? 0)}%
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] text-slate-400 ml-auto">
                            <i className="fa-solid fa-trophy text-[7px]"></i>
                            <span className="font-bold text-slate-600">{gap.bestMaterial}</span>
                          </div>
                        </div>

                        {/* Suggestion */}
                        {gap.suggestion && (
                          <div className="ml-3 px-3 py-2 bg-indigo-50/50 rounded-lg border border-indigo-100/50">
                            <span className="text-[9px] text-indigo-600 font-medium italic">💡 {gap.suggestion}</span>
                          </div>
                        )}

                        {/* Progress bar showing percentile */}
                        <div className="mt-3 ml-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${
                              (gap.percentile ?? 0) >= 80 ? 'from-emerald-400 to-cyan-400' :
                              (gap.percentile ?? 0) >= 50 ? 'from-indigo-400 to-violet-400' :
                              (gap.percentile ?? 0) >= 25 ? 'from-amber-400 to-orange-400' :
                              'from-rose-400 to-pink-400'
                            }`}
                            style={{ width: `${gap.percentile ?? 0}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right Panel: Source Flow / Detail ── */}
        <div className="w-80 border-l border-slate-100 bg-slate-50/50 flex flex-col shrink-0 overflow-hidden">
          {selectedMetric ? (
            /* Detail Panel for selected metric */
            <div className="flex flex-col h-full">
              <div className="px-5 pt-5 pb-3 border-b border-slate-100 bg-white shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
                    <i className="fa-solid fa-table-list text-[8px]"></i>
                    结构化表格源流
                  </h4>
                  <button
                    onClick={() => setSelectedMetric(null)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all text-[10px]"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <h3 className="text-[13px] font-black text-slate-800 leading-tight">{selectedMetric.displayName}</h3>
                <p className="text-[9px] text-slate-500 mt-1">{selectedMetric.unit} · {selectedMetric.condition || '标准条件'}</p>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                {selectedMetric.dataPoints
                  .sort((a, b) => selectedMetric.isHigherBetter ? b.value - a.value : a.value - b.value)
                  .map((dp, i) => {
                    const colors = getCellColor(selectedMetric, dp.value);
                    return (
                      <div 
                        key={i} 
                        onClick={(e) => {
                          if (dp.literatureId && onNavigateToLiterature) {
                            e.stopPropagation();
                            onNavigateToLiterature(dp.literatureId);
                          }
                        }}
                        className={`p-4 rounded-xl border ${colors.border} ${colors.bg} transition-all ${onNavigateToLiterature && dp.literatureId ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'hover:shadow-sm'} relative ${dp.isOurs ? 'ring-2 ring-indigo-200' : ''}`}
                        title={onNavigateToLiterature && dp.literatureId ? '点击查看来源文献详情' : undefined}
                      >
                        {/* Rank medal */}
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-black shadow-sm ${
                              i === 0 ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-white' :
                              i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' :
                              i === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-500 text-white' :
                              'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}>
                              {i < 3 ? ['🥇','🥈','🥉'][i] : `${i+1}`}
                            </div>
                            <span className={`text-[17px] font-black ${colors.text} italic`}>{dp.rawValue}</span>
                          </div>
                          {dp.isOurs && <span className="px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[6px] font-black uppercase">Ours</span>}
                        </div>
                        <div className="space-y-2 pl-8">
                          <div className="flex items-start gap-1.5">
                            <i className="fa-solid fa-flask text-[7px] text-slate-400 mt-1 shrink-0"></i>
                            <span className="text-[9px] font-bold text-slate-700">{dp.materialSystem}</span>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <i className="fa-solid fa-book text-[7px] text-slate-400 mt-1 shrink-0"></i>
                            <span className="text-[9px] text-slate-500 leading-tight" title={dp.literatureTitle}>
                              {(dp.literatureTitle || '').length > 50 ? (dp.literatureTitle || '').substring(0, 50) + '...' : (dp.literatureTitle || '未知来源')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-[8px] text-slate-400">
                                <i className="fa-solid fa-calendar text-[6px] mr-1"></i>{dp.year}
                              </span>
                            </div>
                            {/* Confidence bar */}
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${(dp.confidence ?? 0) >= 0.8 ? 'bg-emerald-400' : (dp.confidence ?? 0) >= 0.5 ? 'bg-amber-400' : 'bg-rose-400'}`} style={{ width: `${(dp.confidence ?? 0) * 100}%` }}></div>
                              </div>
                              <span className="text-[7px] font-bold text-slate-400">{((dp.confidence ?? 0) * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            /* Default: Overview */
            <div className="flex flex-col h-full">
              <div className="px-5 pt-5 pb-3 border-b border-slate-100 bg-white shrink-0">
                <h4 className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
                  <i className="fa-solid fa-table-list text-[8px]"></i>
                  结构化表格源流
                </h4>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                    <i className="fa-solid fa-arrow-pointer text-white text-lg"></i>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">点击左侧参数卡片</p>
                  <p className="text-[10px] text-slate-400">查看数据血缘与来源详情</p>
                </div>

                {/* Material Systems List */}
                <div className="mt-4">
                  <h5 className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">材料体系清单</h5>
                  <div className="space-y-1.5">
                    {(knowledgePool.materialSystems || []).map(ms => (
                      <div key={ms.id} className="px-3 py-2 bg-white rounded-lg border border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${ms.isOurs ? 'bg-emerald-500' : 'bg-indigo-400'}`}></div>
                          <span className="text-[10px] font-bold text-slate-700">{ms.name}</span>
                        </div>
                        <span className="text-[8px] text-slate-400">{ms.year || ''}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Extracted Tables (merged from BenchmarkingView) */}
                {(() => {
                  const allTables = resources.flatMap(r => r.extractedTables || []);
                  if (allTables.length === 0) return null;
                  return (
                    <div className="mt-4">
                      <h5 className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <i className="fa-solid fa-table text-[7px]"></i>
                        提取表格 ({allTables.length})
                      </h5>
                      <div className="space-y-1.5">
                        {allTables.map(table => (
                          <div
                            key={table.id}
                            onClick={() => setSelectedTable(table)}
                            className="px-3 py-2.5 bg-white rounded-lg border border-slate-100 cursor-pointer hover:border-indigo-200 hover:shadow-sm transition-all group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-bold text-slate-700 line-clamp-1">{table.title}</span>
                              <i className="fa-solid fa-expand text-[7px] text-slate-300 group-hover:text-indigo-400 transition-colors"></i>
                            </div>
                            <div className="flex gap-2 mt-1">
                              <span className="text-[7px] font-bold text-slate-400">{table.rows.length} 行</span>
                              <span className="text-[7px] font-bold text-slate-400">{table.headers.length} 列</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Last updated */}
                <div className="pt-4 mt-4 border-t border-slate-100">
                  <p className="text-[8px] text-slate-400 text-center">
                    最近更新: {new Date(knowledgePool.lastUpdated).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table Preview Modal */}
      {selectedTable && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[6000] flex items-center justify-center p-6" onClick={() => setSelectedTable(null)}>
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh] animate-reveal" onClick={e => e.stopPropagation()}>
            <header className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center">
                  <i className="fa-solid fa-table text-sm"></i>
                </div>
                <div>
                  <h3 className="text-sm font-black italic">{selectedTable.title}</h3>
                  <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5">Extracted Data Block</p>
                </div>
              </div>
              <button onClick={() => setSelectedTable(null)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-rose-500 transition-all flex items-center justify-center">
                <i className="fa-solid fa-times text-sm"></i>
              </button>
            </header>
            <div className="flex-1 overflow-auto p-6 bg-slate-50">
              <table className="w-full text-left border-collapse bg-white rounded-xl overflow-hidden shadow-sm">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-slate-200">
                    {selectedTable.headers.map((h, i) => (
                      <th key={i} className="px-4 py-3 text-[10px] font-black uppercase text-slate-700 tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedTable.rows.map((row, ri) => (
                    <tr key={ri} className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-4 py-3 text-[10px] font-bold text-slate-600 leading-relaxed">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// Radar Chart Sub-Component (Pure SVG)
// ═══════════════════════════════════════════════════════
const RadarChart: React.FC<{
  benchmarks: BenchmarkEntry[];
  materials: string[];
}> = ({ benchmarks, materials }) => {
  const cx = 200, cy = 200, radius = 150;
  const axes = benchmarks.slice(0, 8); // Max 8 axes
  const angleStep = (2 * Math.PI) / axes.length;

  const colors = [
    { stroke: '#6366f1', fill: 'rgba(99,102,241,0.15)' },
    { stroke: '#10b981', fill: 'rgba(16,185,129,0.15)' },
    { stroke: '#f59e0b', fill: 'rgba(245,158,11,0.15)' },
    { stroke: '#ef4444', fill: 'rgba(239,68,68,0.15)' },
    { stroke: '#8b5cf6', fill: 'rgba(139,92,246,0.15)' }
  ];

  // Compute normalized values per material per axis
  const getPolygonPoints = (material: string) => {
    return axes.map((axis, i) => {
      // Try exact match first, then safer fuzzy match (ignoring empty/short cases)
      let dp = axis.dataPoints.find(d => {
        if (!material) return false;
        if (d.materialSystem === material) return true;
        const m1 = d.materialSystem?.toLowerCase() || '';
        const m2 = material.toLowerCase();
        if (m1 && m1.length > 2 && m2.length > 2 && (m1.includes(m2) || m2.includes(m1))) return true;
        const t = d.literatureTitle?.toLowerCase() || '';
        if (t && m2.length > 2 && t.includes(m2)) return true;
        return false;
      });
      if (!dp) return { x: cx, y: cy, value: null as number | null };

      // Guard against missing/NaN values by parsing rawValue as fallback
      const parseNum = (d: any) => {
        if (d.value != null && !isNaN(d.value)) return d.value;
        const parsed = parseFloat(String(d.rawValue || '').replace(/[^\d.-]/g, ''));
        return isNaN(parsed) ? null : parsed;
      };

      const dpVal = parseNum(dp);
      const allValues = axis.dataPoints.map(parseNum).filter(v => v !== null) as number[];

      if (allValues.length === 0 || dpVal === null) return { x: cx, y: cy, value: dpVal };

      const min = Math.min(...allValues);
      const max = Math.max(...allValues);
      let normalized = max > min ? (dpVal - min) / (max - min) : 0.5;
      if (!axis.isHigherBetter) normalized = 1 - normalized;
      const r = normalized * radius * 0.85 + radius * 0.15;
      const angle = i * angleStep - Math.PI / 2;
      return {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        value: dpVal
      };
    });
  };

  return (
    <svg viewBox="0 0 400 420" className="w-full max-w-md mx-auto">
      {/* Grid rings */}
      {[0.25, 0.5, 0.75, 1].map(pct => (
        <polygon
          key={pct}
          points={axes.map((_, i) => {
            const r = radius * pct;
            const angle = i * angleStep - Math.PI / 2;
            return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
          }).join(' ')}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={pct === 1 ? 1.5 : 0.5}
        />
      ))}

      {/* Axis lines */}
      {axes.map((_, i) => {
        const angle = i * angleStep - Math.PI / 2;
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={cx + radius * Math.cos(angle)}
            y2={cy + radius * Math.sin(angle)}
            stroke="#e2e8f0"
            strokeWidth={0.5}
          />
        );
      })}

      {/* Data polygons */}
      {materials.map((mat, mi) => {
        const pts = getPolygonPoints(mat);
        const pointsStr = pts.map(p => `${p.x},${p.y}`).join(' ');
        const color = colors[mi % colors.length];
        return (
          <g key={mat}>
            <polygon points={pointsStr} fill={color.fill} stroke={color.stroke} strokeWidth={2} />
            {pts.map((p, pi) => (
              <g key={pi}>
                <circle cx={p.x} cy={p.y} r={3} fill={color.stroke} />
                {p.value != null && (
                  <text
                    x={p.x + (p.x > cx ? 6 : -6)}
                    y={p.y - 6}
                    textAnchor={p.x > cx ? 'start' : 'end'}
                    className="fill-slate-500 text-[6px] font-bold"
                  >
                    {typeof p.value === 'number' ? (p.value % 1 === 0 ? p.value : p.value.toFixed(2)) : p.value}
                  </text>
                )}
              </g>
            ))}
          </g>
        );
      })}

      {/* Axis labels */}
      {axes.map((axis, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const labelR = radius + 20;
        const x = cx + labelR * Math.cos(angle);
        const y = cy + labelR * Math.sin(angle);
        return (
          <text
            key={i}
            x={x} y={y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-slate-600 text-[8px] font-bold"
          >
            {axis.displayName.length > 8 ? axis.displayName.substring(0, 8) + '..' : axis.displayName}
          </text>
        );
      })}

      {/* Legend */}
      {materials.map((mat, mi) => {
        const color = colors[mi % colors.length];
        return (
          <g key={mat} transform={`translate(${20 + mi * 100}, 395)`}>
            <rect x={0} y={0} width={10} height={10} rx={2} fill={color.stroke} />
            <text x={14} y={9} className="fill-slate-600 text-[8px] font-bold">{mat}</text>
          </g>
        );
      })}
    </svg>
  );
};

export default KnowledgePoolPanel;
