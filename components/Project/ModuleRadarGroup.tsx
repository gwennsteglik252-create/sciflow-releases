import React, { useMemo, useState, useEffect } from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, XAxis, Tooltip, LabelList } from 'recharts';
import { getMetricDisplay, formatMetricNumber } from '../../utils/metricDisplay';

export interface SyncedModuleItem {
  moduleId: string;
  moduleLabel: string;
  mode?: string;
  summary?: string;
  aiDeepAnalysis?: string;
  thumbnailUrl?: string;
  sourceAnalysisId?: string;
  sourceAnalysisType?: string;
  sourceAnalysisTitle?: string;
  generatedAt?: string;
  metrics: Record<string, number>;
}

interface ModuleRadarGroupProps {
  modules: SyncedModuleItem[];
  mainMetricKeys?: string[];
  onPromote: (module: SyncedModuleItem, picked: Record<string, number>, pickedKeys: string[]) => void;
  onWithdrawModule: (module: SyncedModuleItem) => void;
  onTraceModule?: (module: SyncedModuleItem) => void;
  onDeleteModule?: (module: SyncedModuleItem) => void;
  expandOnMount?: boolean;
  title?: string;
  hidePromoteButtons?: boolean;
  groupStyle?: boolean;
}

// 分模块颜色调色板 —— 每个模块分配不同颜色
const MODULE_COLORS = [
  { stroke: '#4f46e5', fill: '#6366f1', text: '#4f46e5', bg: 'bg-indigo-50', border: 'border-indigo-200', label: 'text-indigo-600' },   // 靛蓝
  { stroke: '#0891b2', fill: '#06b6d4', text: '#0891b2', bg: 'bg-cyan-50', border: 'border-cyan-200', label: 'text-cyan-600' },          // 青色
  { stroke: '#059669', fill: '#10b981', text: '#059669', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'text-emerald-600' }, // 翠绿
  { stroke: '#d97706', fill: '#f59e0b', text: '#d97706', bg: 'bg-amber-50', border: 'border-amber-200', label: 'text-amber-600' },      // 琥珀
  { stroke: '#dc2626', fill: '#ef4444', text: '#dc2626', bg: 'bg-red-50', border: 'border-red-200', label: 'text-red-600' },             // 红色
  { stroke: '#7c3aed', fill: '#8b5cf6', text: '#7c3aed', bg: 'bg-violet-50', border: 'border-violet-200', label: 'text-violet-600' },    // 紫罗兰
  { stroke: '#db2777', fill: '#ec4899', text: '#db2777', bg: 'bg-pink-50', border: 'border-pink-200', label: 'text-pink-600' },          // 粉红
  { stroke: '#2563eb', fill: '#3b82f6', text: '#2563eb', bg: 'bg-blue-50', border: 'border-blue-200', label: 'text-blue-600' },          // 蓝色
  { stroke: '#ca8a04', fill: '#eab308', text: '#ca8a04', bg: 'bg-yellow-50', border: 'border-yellow-200', label: 'text-yellow-600' },    // 黄色
  { stroke: '#0d9488', fill: '#14b8a6', text: '#0d9488', bg: 'bg-teal-50', border: 'border-teal-200', label: 'text-teal-600' },          // 蓝绿
];

const ModuleRadarGroup: React.FC<ModuleRadarGroupProps> = ({ modules, mainMetricKeys = [], onPromote, onWithdrawModule, onTraceModule, onDeleteModule, expandOnMount = false, title, hidePromoteButtons = false, groupStyle = false }) => {
  const [selectedMap, setSelectedMap] = useState<Record<string, string[]>>({});
  const [metricEdits, setMetricEdits] = useState<Record<string, Record<string, number>>>({});
  const [moduleEditingMap, setModuleEditingMap] = useState<Record<string, boolean>>({});
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [summaryExpandedMap, setSummaryExpandedMap] = useState<Record<string, boolean>>({});
  const [aiDeepExpandedMap, setAiDeepExpandedMap] = useState<Record<string, boolean>>({});
  const [cardCollapsedMap, setCardCollapsedMap] = useState<Record<string, boolean>>({});
  const [thumbnailHiddenMap, setThumbnailHiddenMap] = useState<Record<string, boolean>>({});
  const sanitizeLatexArtifacts = (text: string): string => {
    if (!text) return text;
    const cmdMap: Record<string, string> = {
      approx: '≈',
      cdot: '·',
      times: '×',
      mu: 'μ',
      alpha: 'α',
      beta: 'β',
      gamma: 'γ',
      delta: 'δ',
      theta: 'θ',
      lambda: 'λ',
      pm: '±',
      leq: '≤',
      geq: '≥'
    };
    const normalizeMath = (input: string) => {
      let s = input;
      s = s.replace(/\\text\{([^}]*)\}/g, '$1');
      s = s.replace(/\\mathrm\{([^}]*)\}/g, '$1');
      s = s.replace(/_\\?\{([^}]*)\}/g, '$1');
      s = s.replace(/\^\\?\{([^}]*)\}/g, '$1');
      s = s.replace(/_([A-Za-z0-9]+)/g, '$1');
      s = s.replace(/\^([A-Za-z0-9]+)/g, '$1');
      s = s.replace(/\\([A-Za-z]+)/g, (_, cmd: string) => cmdMap[cmd] ?? cmd);
      s = s.replace(/[{}]/g, '');
      return s;
    };
    let cleaned = text.replace(/\$([^$]+)\$/g, (_, inner: string) => normalizeMath(inner));
    cleaned = cleaned.replace(/\\text\{([^}]*)\}/g, '$1');
    cleaned = cleaned.replace(/\\mathrm\{([^}]*)\}/g, '$1');
    cleaned = cleaned.replace(/\\([A-Za-z]+)/g, (_, cmd: string) => cmdMap[cmd] ?? `\\${cmd}`);
    cleaned = cleaned
      .replace(/^\s{0,3}#{1,6}\s*/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return cleaned;
  };

  const formatMetricKey = (key: string): string => {
    return getMetricDisplay(key).label;
  };

  const recommendKeys = (m: SyncedModuleItem) => {
    const keys = Object.keys(m.metrics || {});
    const mode = String(m.mode || '').toUpperCase();
    const patterns = mode.includes('SEM')
      ? ['平均等效粒径', '最大粒径', '最小粒径', '标准偏差', 'PDI']
      : mode.includes('TEM')
        ? ['d', '晶格', '粒径']
        : mode.includes('XRD')
          ? ['2θ', '晶粒', '峰', '强度']
          : mode.includes('XPS')
            ? ['binding', 'shift', 'dBand', '结合能']
            : mode.includes('POROSITY')
              ? ['ssa', 'pore', '孔']
              : mode.includes('CONTACT')
                ? ['contact', 'through', 'in-plane', 'resistance']
                : ['Half Wave', 'Tafel', 'Limiting', 'ECSA'];
    const picked: string[] = [];
    patterns.forEach(p => {
      const found = keys.find(k => k.toLowerCase().includes(p.toLowerCase()));
      if (found && !picked.includes(found) && picked.length < 12) picked.push(found);
    });
    keys.forEach(k => {
      if (picked.length < 12 && !picked.includes(k)) picked.push(k);
    });
    return picked;
  };

  const inferUnit = (key: string): string => getMetricDisplay(key).unit;

  const formatRadarMetric = (key: string, value: number) => {
    const display = getMetricDisplay(key);
    const label = display.shortLabel;
    const unit = display.unit;
    const num = formatMetricNumber(value);
    return {
      label,
      valueDisplay: `${num}${unit ? ` ${unit}` : ''}`
    };
  };

  const toggleKey = (moduleId: string, key: string, checked: boolean, fallback: string[]) => {
    setSelectedMap(prev => {
      const cur = prev[moduleId] || fallback;
      const next = checked ? [...cur, key] : cur.filter(k => k !== key);
      return { ...prev, [moduleId]: Array.from(new Set(next)) };
    });
  };

  const getCurrentMetricValue = (moduleId: string, key: string, fallback: number): number => {
    const edited = metricEdits[moduleId]?.[key];
    return Number.isFinite(edited) ? Number(edited) : Number(fallback);
  };

  const setCurrentMetricValue = (moduleId: string, key: string, valueText: string) => {
    const next = Number(valueText);
    setMetricEdits(prev => ({
      ...prev,
      [moduleId]: {
        ...(prev[moduleId] || {}),
        [key]: Number.isFinite(next) ? next : 0
      }
    }));
  };

  const pushEditedValuesToMainRadar = (module: SyncedModuleItem, keys: string[]) => {
    if (keys.length === 0) return;
    const payload: Record<string, number> = {};
    keys.forEach(k => {
      payload[k] = getCurrentMetricValue(module.moduleId, k, Number(module.metrics[k]));
    });
    onPromote(module, payload, keys);
  };

  useEffect(() => {
    if (expandOnMount) setCollapsed(false);
  }, [expandOnMount]);

  return (
    <div className={`space-y-2 ${groupStyle ? 'px-2 pt-1 pb-2' : ''}`}>
      {groupStyle ? (
        <button
          onClick={() => setCollapsed(v => !v)}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-500/90 to-indigo-600/80 hover:from-indigo-600 hover:to-indigo-700 transition-all shadow-sm group"
        >
          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-microscope text-[11px] text-white/90"></i>
          </div>
          <span className="text-[11px] font-black text-white/90 uppercase tracking-widest flex-1 text-left">{title || '同步模块性能雷达（分模块）'}</span>
          <span className="text-[9px] font-black text-white bg-white/20 px-2 py-0.5 rounded-full border border-white/10">{modules.length} 个模块</span>
          <i className={`fa-solid fa-chevron-${collapsed ? 'down' : 'up'} text-[10px] text-white/70 group-hover:text-white transition-colors`}></i>
        </button>
      ) : (
        <button
          onClick={() => setCollapsed(v => !v)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="text-[11px] font-black text-slate-500 tracking-widest">{title || '同步模块性能雷达（分模块）'}</div>
          <i className={`fa-solid fa-chevron-${collapsed ? 'down' : 'up'} text-[10px] text-slate-400`}></i>
        </button>
      )}
      {collapsed ? (
        groupStyle ? (
          <div
            onClick={() => setCollapsed(false)}
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-indigo-200/60 bg-indigo-50/50 cursor-pointer hover:bg-indigo-100/60 hover:border-indigo-300 transition-all"
          >
            <i className="fa-solid fa-layer-group text-[11px] text-indigo-400"></i>
            <span className="text-[11px] font-bold text-indigo-600/80">点击展开查看{title ? title : '分模块性能雷达'}（共 {modules.length} 个模块）</span>
            <i className="fa-solid fa-chevron-down text-[9px] text-indigo-300 ml-auto"></i>
          </div>
        ) : (
          <div className="pl-1 text-[11px] text-slate-400 font-bold">
            点击展开查看{title ? title : '分模块性能雷达'}（共 {modules.length} 个模块）
          </div>
        )
      ) : modules.map((m, moduleIndex) => {
        const color = MODULE_COLORS[moduleIndex % MODULE_COLORS.length];
        const isCardCollapsed = cardCollapsedMap[m.moduleId] ?? true;
        const entries = Object.entries(m.metrics || {})
          .map(([k, v]) => [k, getCurrentMetricValue(m.moduleId, k, Number(v))] as [string, number])
          .filter(([, v]) => Number.isFinite(Number(v)));
        const safeSummary = m.summary ? sanitizeLatexArtifacts(m.summary) : '';
        const safeAiDeep = m.aiDeepAnalysis ? sanitizeLatexArtifacts(m.aiDeepAnalysis) : '';
        const defaultKeys = recommendKeys(m).slice(0, 3);
        const selectedKeys = selectedMap[m.moduleId] || defaultKeys;
        const pickedForChart = entries;
        const chartData = (() => {
          if (pickedForChart.length === 0) return [];
          const values = pickedForChart.map(([, v]) => Number(v));
          const min = Math.min(...values);
          const max = Math.max(...values);
          const span = Math.max(1e-9, max - min);
          return pickedForChart.map(([k, v]) => {
            const fm = formatRadarMetric(k, Number(v));
            return {
              metricKey: k,
              subject: fm.label,
              valueDisplay: fm.valueDisplay,
              raw: Number(v),
              value: max === min ? 60 : Math.max(10, Math.min(100, ((Number(v) - min) / span) * 100))
            };
          });
        })();

        return (
          <div key={m.moduleId} className="border border-slate-200 rounded-xl p-2.5" style={{ backgroundColor: `${color.fill}08`, borderLeftWidth: 3, borderLeftColor: color.stroke }}>
            <div className="flex items-center justify-between mb-1.5">
              <div
                onClick={() => setCardCollapsedMap(prev => ({ ...prev, [m.moduleId]: !isCardCollapsed }))}
                className="flex items-center gap-1.5 flex-1 min-w-0 text-left rounded-md px-1 py-0.5 hover:bg-slate-100/70 transition-colors cursor-pointer"
                title={isCardCollapsed ? '展开卡片' : '折叠卡片'}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setCardCollapsedMap(prev => ({ ...prev, [m.moduleId]: !isCardCollapsed }));
                  }
                }}
              >
                <span
                  className="w-5 h-5 rounded border border-slate-200 bg-white text-slate-500 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <i className={`fa-solid fa-chevron-${isCardCollapsed ? 'down' : 'up'} text-[10px]`}></i>
                </span>
                <span className={`text-[12px] font-black ${color.label}`}>{m.moduleLabel}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-black" style={{ backgroundColor: `${color.fill}18`, color: color.stroke }}>{m.mode || '模块'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-bold">{entries.length}项指标</span>
                {!!(m.sourceAnalysisId && m.sourceAnalysisType && onTraceModule) && (
                  <button
                    onClick={() => onTraceModule?.(m)}
                    className="px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-600 hover:text-rose-700 hover:border-rose-300 text-[10px] font-black flex items-center gap-1"
                    title={m.sourceAnalysisTitle ? `溯源至表征中心：${m.sourceAnalysisTitle}` : '溯源至表征中心对应分析'}
                  >
                    <i className="fa-solid fa-location-crosshairs text-[10px]"></i>
                    溯源
                  </button>
                )}
                <button
                  onClick={() => {
                    const isEditing = Boolean(moduleEditingMap[m.moduleId]);
                    if (isEditing) {
                      const moduleKeys = Object.keys(m.metrics || {});
                      const pushedKeys = moduleKeys.filter(k => mainMetricKeys.includes(k));
                      pushEditedValuesToMainRadar(m, pushedKeys);
                    }
                    setModuleEditingMap(prev => ({ ...prev, [m.moduleId]: !prev[m.moduleId] }));
                  }}
                  className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-200 text-[10px] font-black flex items-center gap-1"
                  title={moduleEditingMap[m.moduleId] ? '完成编辑' : '编辑数值'}
                >
                  <i className={`fa-solid ${moduleEditingMap[m.moduleId] ? 'fa-check' : 'fa-pen'} text-[10px]`}></i>
                  {moduleEditingMap[m.moduleId] ? '完成' : '编辑'}
                </button>
                <button
                  onClick={() => onDeleteModule?.(m)}
                  className="px-2 py-1 rounded border border-rose-200 bg-white text-rose-500 hover:text-rose-600 hover:border-rose-300 text-[10px] font-black flex items-center gap-1"
                  title="删除该模块卡片"
                >
                  <i className="fa-solid fa-trash text-[10px]"></i>
                  删除
                </button>
              </div>
            </div>
            {isCardCollapsed ? (
              <div className="text-[11px] text-slate-400 font-bold px-1 py-1">
                已折叠，点击左上角箭头展开详情
              </div>
            ) : (
              <>
                {safeSummary && (
                  <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50/40 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-amber-700 tracking-wide">分析结果</span>
                      {safeSummary.length > 300 && (
                        <button
                          onClick={() => setSummaryExpandedMap(prev => ({ ...prev, [m.moduleId]: !prev[m.moduleId] }))}
                          className="text-[11px] font-black text-amber-700/80 hover:text-amber-800"
                        >
                          {summaryExpandedMap[m.moduleId] ? '收起' : '展开'}
                        </button>
                      )}
                    </div>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-slate-700 font-black whitespace-pre-wrap">
                      {summaryExpandedMap[m.moduleId] || safeSummary.length <= 300 ? safeSummary : `${safeSummary.slice(0, 300)}...`}
                    </p>
                  </div>
                )}
                {safeAiDeep && (
                  <div className="mb-2">
                    {(() => {
                      const isAiDeepExpanded = aiDeepExpandedMap[m.moduleId] ?? false;
                      return (
                        <>
                          <button
                            onClick={() => setAiDeepExpandedMap(prev => ({ ...prev, [m.moduleId]: !isAiDeepExpanded }))}
                            className="w-full flex items-center justify-between gap-2 text-left rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2"
                          >
                            <span className="text-[11px] font-black text-violet-700 tracking-wide">AI 深度关联分析</span>
                            <i className={`fa-solid fa-chevron-${isAiDeepExpanded ? 'up' : 'down'} text-[11px] text-violet-500`}></i>
                          </button>
                          {isAiDeepExpanded && (
                            <div className="mt-1.5 rounded-xl border border-violet-100 bg-white overflow-y-auto" style={{ maxHeight: '720px' }}>
                              {/* 缩略图固定在顶部 sticky，可手动隐藏 */}
                              {m.thumbnailUrl && (
                                <div className="sticky top-0 z-10 bg-white border-b border-violet-100 shadow-sm">
                                  <div className="flex items-center gap-2 px-3 py-1.5">
                                    <i className="fa-solid fa-image text-[10px] text-violet-400"></i>
                                    <span className="text-[9px] font-black text-violet-500 uppercase tracking-widest">分析缩略图</span>
                                    <div className="ml-auto flex items-center gap-2">
                                      <button
                                        onClick={() => setPreviewImageUrl(m.thumbnailUrl || null)}
                                        className="text-[9px] font-black text-violet-500 hover:text-violet-700 flex items-center gap-1"
                                        title="全屏放大"
                                      >
                                        <i className="fa-solid fa-expand text-[9px]"></i> 全屏
                                      </button>
                                      <button
                                        onClick={() => setThumbnailHiddenMap(prev => ({ ...prev, [m.moduleId]: !prev[m.moduleId] }))}
                                        className="text-[9px] font-black text-slate-400 hover:text-slate-600 flex items-center gap-1"
                                        title={thumbnailHiddenMap[m.moduleId] ? '显示图片' : '隐藏图片'}
                                      >
                                        <i className={`fa-solid ${thumbnailHiddenMap[m.moduleId] ? 'fa-eye' : 'fa-eye-slash'} text-[9px]`}></i>
                                        {thumbnailHiddenMap[m.moduleId] ? '显示' : '隐藏'}
                                      </button>
                                    </div>
                                  </div>
                                  {!thumbnailHiddenMap[m.moduleId] && (
                                    <img
                                      src={m.thumbnailUrl}
                                      alt={`${m.moduleLabel}-thumbnail`}
                                      className="w-full object-contain bg-slate-50 cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => setPreviewImageUrl(m.thumbnailUrl || null)}
                                      title="点击全屏预览"
                                    />
                                  )}
                                </div>
                              )}
                              {/* 可滚动的 AI 分析文字 */}
                              <div className="px-3 py-2.5">
                                <p className="text-[15px] leading-relaxed text-slate-700 font-bold whitespace-pre-wrap">
                                  {safeAiDeep}
                                </p>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {entries.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-[11px] text-slate-400 font-bold">
                    当前模块暂无可用性能指标（你刚删除的只是指标，不会再删除模块卡片）
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-stretch">
                    <div className="h-44 rounded-lg border border-slate-100 bg-white p-1">
                      {chartData.length >= 3 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={chartData} margin={{ top: 22, right: 28, bottom: 22, left: 28 }} outerRadius="68%">
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis
                              dataKey="subject"
                              tick={(props: any) => {
                                const { x, y, payload, textAnchor } = props;
                                const axisText = String(payload?.value || '');
                                const valueDisplay = chartData.find((it) => it.subject === axisText)?.valueDisplay || '';
                                return (
                                  <g transform={`translate(${x},${y})`}>
                                    <text textAnchor={textAnchor} className="fill-slate-500" style={{ fontSize: 10, fontWeight: 800 }}>
                                      {axisText}
                                    </text>
                                    <text y={12} textAnchor={textAnchor} style={{ fontSize: 10, fontWeight: 900, fill: color.stroke }}>
                                      {valueDisplay}
                                    </text>
                                  </g>
                                );
                              }}
                            />
                            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar dataKey="value" stroke={color.stroke} fill={color.fill} fillOpacity={0.35} />
                          </RadarChart>
                        </ResponsiveContainer>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <XAxis dataKey="subject" tick={{ fontSize: 8, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Bar dataKey="raw" fill={color.fill} radius={[4, 4, 0, 0]}>
                              <LabelList dataKey="raw" position="top" fill={color.stroke} fontSize={8} fontWeight="bold" />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                    <div className="h-56 rounded-lg border border-slate-100 bg-slate-50 overflow-hidden">
                      {m.thumbnailUrl ? (
                        <button
                          onClick={() => setPreviewImageUrl(m.thumbnailUrl || null)}
                          className="w-full h-full block group relative"
                          title="点击放大预览"
                        >
                          <img src={m.thumbnailUrl} alt={`${m.moduleLabel}-thumbnail`} className="w-full h-full object-contain bg-white group-hover:scale-[1.01] transition-transform" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <i className="fa-solid fa-magnifying-glass-plus text-white opacity-0 group-hover:opacity-100 transition-opacity text-lg"></i>
                          </div>
                        </button>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1">
                          <i className="fa-solid fa-image text-lg"></i>
                          <span className="text-[11px] font-black">暂无同步缩略图</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {entries.length > 0 && (
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-28 overflow-y-auto pr-1">
                    {entries.map(([k, v]) => {
                      const checked = selectedKeys.includes(k);
                      const inMain = mainMetricKeys.includes(k);
                      const isEditing = Boolean(moduleEditingMap[m.moduleId]);
                      const unit = inferUnit(k);
                      return (
                        <div key={k} className="flex items-center gap-1.5 px-2 py-1 rounded border border-slate-200 bg-slate-50 text-[11px]">
                          <input type="checkbox" checked={checked} onChange={(e) => toggleKey(m.moduleId, k, e.target.checked, defaultKeys)} />
                          <span className="truncate font-bold text-slate-700 flex-1 min-w-0">{formatMetricKey(k)}</span>
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1 w-32">
                              <input
                                type="number"
                                step="0.001"
                                value={Number(v).toFixed(3)}
                                onChange={(e) => setCurrentMetricValue(m.moduleId, k, e.target.value)}
                                className="w-20 px-1 py-0.5 rounded border border-indigo-200 bg-white text-indigo-600 font-mono text-right outline-none"
                              />
                              {unit && <span className="text-[9px] font-bold text-slate-400">{unit}</span>}
                            </div>
                          ) : (
                            <span className="w-32 font-mono text-right tabular-nums" style={{ color: color.text }}>
                              {formatMetricNumber(Number(v))}
                              {unit ? <span className="ml-1 text-[10px] text-slate-400 font-bold">{unit}</span> : null}
                            </span>
                          )}
                          {inMain && <span className="ml-1 text-[9px] font-black text-emerald-600 shrink-0">主雷达</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!hidePromoteButtons && (
                  <div className="mt-2 flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => {
                        const keys = recommendKeys(m).slice(0, 12);
                        const payload: Record<string, number> = {};
                        keys.forEach(k => { payload[k] = getCurrentMetricValue(m.moduleId, k, Number(m.metrics[k])); });
                        onPromote(m, payload, keys);
                        setSelectedMap(prev => ({ ...prev, [m.moduleId]: keys }));
                      }}
                      className="px-3 py-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-black"
                      disabled={entries.length === 0}
                    >
                      自动推主雷达
                    </button>
                    <button
                      onClick={() => {
                        const fallback = recommendKeys(m).slice(0, 12);
                        const selected = (selectedMap[m.moduleId] || []).slice(0, 12);
                        const keys = selected.length > 0 ? selected : fallback;
                        const payload: Record<string, number> = {};
                        keys.forEach(k => { payload[k] = getCurrentMetricValue(m.moduleId, k, Number(m.metrics[k])); });
                        onPromote(m, payload, keys);
                      }}
                      className="px-3 py-1.5 rounded bg-indigo-600 text-white text-[10px] font-black"
                      disabled={entries.length === 0}
                    >
                      手动推主雷达
                    </button>
                    <button
                      onClick={() => onWithdrawModule(m)}
                      className="px-2 py-1 rounded bg-rose-50 border border-rose-200 text-rose-600 text-[8px] font-black"
                    >
                      取消本模块推送
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-[4000] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img src={previewImageUrl} alt="module-thumbnail-preview" className="max-w-full max-h-[88vh] rounded-2xl shadow-2xl border border-white/20" />
            <button
              onClick={(e) => { e.stopPropagation(); setPreviewImageUrl(null); }}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              title="关闭预览"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModuleRadarGroup;
