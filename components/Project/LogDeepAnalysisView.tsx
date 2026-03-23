
import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, Tooltip, XAxis, YAxis, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, LabelList } from 'recharts';

interface LogDeepAnalysisViewProps {
  data: any;
  mainMetrics?: Record<string, number>;
  onPromoteMetrics?: (metrics: Record<string, number>) => void;
}

const LogDeepAnalysisView: React.FC<LogDeepAnalysisViewProps> = ({ data, mainMetrics = {}, onPromoteMetrics }) => {
  if (!data) return null;
  const [expanded, setExpanded] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showFullText, setShowFullText] = useState(false);
  const [selectedMetricKeys, setSelectedMetricKeys] = useState<string[]>([]);
  const [metricSearch, setMetricSearch] = useState('');
  const [pinnedCount, setPinnedCount] = useState(5);
  const [showAllPinned, setShowAllPinned] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    '形貌': false,
    '结构': true,
    '电化学': true,
    '传输/阻抗': true,
    '其他': true
  });

  const chartData = data.chartData || (data.halfWavePotential ? [
    { x: 0, y: 0 }, { x: 0.2, y: 0.05 }, { x: 0.4, y: 0.15 },
    { x: 0.6, y: 0.6 }, { x: 0.8, y: 0.9 }, { x: 1.0, y: 0.95 }
  ] : []);

  const formatValue = (key: string, val: any): string => {
    if (typeof val === 'number') return val.toFixed(3);
    if (typeof val === 'object' && val !== null) {
      if (val.v !== undefined) return `${val.v}V / ${val.j}mA`;
      return JSON.stringify(val);
    }
    return String(val);
  };

  const formatKey = (key: string): string => {
    const keysMap: Record<string, string> = {
      'halfWavePotential': '半波电位',
      'tafelSlope': '塔菲尔斜率',
      'limitingCurrent': '极限电流',
      'mode': '模式',
      'timestamp': '时间戳',
      'matrixSync': '矩阵同步',
      'peakAnodic': '阳极峰',
      'peakCathodic': '阴极峰',
      'cdl': '双层电容',
      'ecsa': '活性面积',
      'roughnessFactor': '粗糙度因子',
      'electronTransferNum': '电子转移数',
      'kineticCurrent': '动力学电流',
      'rs': '溶液电阻',
      'rct': '电荷转移电阻',
      'cpe': '恒相位元件',
      'peak580Intensity': '580峰强',
      'peak820Intensity': '820峰强',
      'peakRatio580to820': '峰比(580/820)',
      'bindingEnergy': '结合能',
      'shift': '位移',
      'dBandCenter': 'd带中心',
      'contactResistance': '接触电阻',
      'throughPlaneResistance': '穿透电阻',
      'inPlaneResistance': '面内电阻',
      'compressionPressure': '加载压力',
      'strongestPeak2Theta': '主峰2θ',
      'strongestPeakIntensity': '主峰强度',
      'peakCount': '峰数量',
      'ssa': '比表面积',
      'poreVolume': '孔容',
      'avgPoreSize': '平均孔径',
      'psdPeakNm': '孔径分布峰值',
      'rSquared': '拟合R2',
      'klR2': 'K-L 拟合R2',
      'klSlope': 'K-L 斜率',
      'klIntercept': 'K-L 截距',
      'onsetPotential': '起始电位',
      'oerOverpotential': 'OER 过电位',
      'oerOnsetPotential': 'OER 起始电位',
      'oerTafelSlope': 'OER 塔菲尔斜率',
      'oerMassActivity': 'OER 质量活性',
      'massActivity': '质量活性'
    };
    if (keysMap[key]) return keysMap[key];
    if (/[\u4e00-\u9fa5]/.test(key)) return key;
    const tokens = key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const tokenMap: Record<string, string> = {
      peak: '峰', count: '数量', strongest: '最强', intensity: '强度', theta: 'θ',
      crystallite: '晶粒', size: '尺寸', matched: '匹配', phase: '物相',
      half: '半', wave: '波', potential: '电位', tafel: '塔菲尔', slope: '斜率',
      limiting: '极限', current: '电流', kinetic: '动力学', electron: '电子', transfer: '转移', num: '数',
      roughness: '粗糙度', factor: '因子',
      onset: '起始', mass: '质量', activity: '活性', overpotential: '过电位',
      contact: '接触', resistance: '电阻', through: '穿透', in: '面内', plane: '',
      compression: '加载', pressure: '压力',
      binding: '结合', energy: '能', shift: '位移', band: '带', center: '中心',
      pore: '孔', volume: '体积', avg: '平均', average: '平均', porosity: '孔隙',
      ssa: '比表面积', cdl: '双层电容', ecsa: '活性面积', cpe: '恒相位元件', squared: '平方', r2: 'R2'
    };
    const converted = tokens.map(t => tokenMap[t] ?? t).filter(Boolean).join('');
    return converted || key;
  };

  const aiConclusion = data.aiConclusion || data.summary || '';
  const displayMetrics = Object.entries(data).filter(([k]) => 
    ![
      'chartData',
      'raw',
      'rawReport',
      'aiConclusion',
      'timestamp',
      'mode',
      'matrixSync',
      'summary',
      'thumbnailUrl',
      'syncedModules',
      'lastSyncedModuleId',
      'generatedAt',
      'linkedAnalysisMeta'
    ].includes(k)
  );
  const numericMetrics = displayMetrics
    .map(([k, v]) => ({ key: k, value: typeof v === 'number' ? v : Number.NaN }))
    .filter(item => Number.isFinite(item.value));

  const inferMetricGroup = (metricKey: string): '形貌' | '结构' | '电化学' | '传输/阻抗' | '其他' => {
    const raw = `${metricKey} ${formatKey(metricKey)}`.toLowerCase();
    if (/(粒径|nm|size|diameter|pdi|std|颗粒|形貌|surface morphology)/.test(raw)) return '形貌';
    if (/(xrd|xps|拉曼|raman|binding|2θ|峰|phase|晶格|孔|ssa|pore|结构|d带)/.test(raw)) return '结构';
    if (/(tafel|electro|电位|电流|ecsa|cdl|动力学|kinetic|onset|half wave|electron)/.test(raw)) return '电化学';
    if (/(阻抗|resistance|rct|rs|传输|扩散|contact|through|inplane|compression|阻力)/.test(raw)) return '传输/阻抗';
    return '其他';
  };

  const filteredNumericMetrics = useMemo(() => {
    const q = metricSearch.trim().toLowerCase();
    if (!q) return numericMetrics;
    return numericMetrics.filter(m => `${m.key} ${formatKey(m.key)}`.toLowerCase().includes(q));
  }, [numericMetrics, metricSearch]);

  const groupedMetrics = useMemo(() => {
    const groups: Record<string, Array<{ key: string; value: number }>> = {
      '形貌': [],
      '结构': [],
      '电化学': [],
      '传输/阻抗': [],
      '其他': []
    };
    filteredNumericMetrics.forEach(item => {
      groups[inferMetricGroup(item.key)].push(item);
    });
    return groups;
  }, [filteredNumericMetrics]);

  const recommendedKeys = useMemo(() => {
    const mode = String(data.mode || '').toUpperCase();
    const preferredPatterns = mode.includes('VISION-SEM')
      ? ['平均等效粒径', '最大粒径', '最小粒径', '标准偏差', 'PDI']
      : mode.includes('POROSITY')
        ? ['ssa', '比表面积', 'pore', '孔容', '孔径']
        : mode.includes('XPS')
          ? ['bindingEnergy', 'shift', 'dBandCenter']
          : mode.includes('CONTACT')
            ? ['contactResistance', 'throughPlaneResistance', 'inPlaneResistance']
            : ['halfWavePotential', 'tafelSlope', 'limitingCurrent'];

    const picks: string[] = [];
    preferredPatterns.forEach(p => {
      const found = numericMetrics.find(m => `${m.key} ${formatKey(m.key)}`.toLowerCase().includes(p.toLowerCase()));
      if (found && !picks.includes(found.key) && picks.length < 6) picks.push(found.key);
    });
    numericMetrics.forEach(m => {
      if (picks.length < 6 && !picks.includes(m.key)) picks.push(m.key);
    });
    return picks;
  }, [numericMetrics, data.mode]);

  useEffect(() => {
    const defaults = recommendedKeys.slice(0, 3);
    setSelectedMetricKeys(defaults);
  }, [data, recommendedKeys]);
  const fullReportText = (typeof data.rawReport === 'string' && data.rawReport.trim())
    ? data.rawReport.trim()
    : aiConclusion;
  const previewText = fullReportText.length > 260 && !showFullText ? `${fullReportText.slice(0, 260)}...` : fullReportText;

  const syncChartData = useMemo(() => {
    const numeric = numericMetrics;
    if (numeric.length < 1) return [];

    const priority = [
      '平均等效粒径 (nm)', '最大粒径 (nm)', '最小粒径 (nm)', '标准偏差 (nm)', 'PDI',
      'ssa', 'poreVolume', 'avgPoreSize', 'halfWavePotential', 'tafelSlope', 'contactResistance'
    ];
    const pick: Array<{ key: string; value: number }> = [];
    priority.forEach(k => {
      const found = numeric.find(n => n.key === k);
      if (found && pick.length < 6) pick.push(found);
    });
    numeric.forEach(n => {
      if (pick.length >= 6) return;
      if (!pick.some(p => p.key === n.key)) pick.push(n);
    });
    if (pick.length < 1) return [];

    const values = pick.map(p => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1e-9, max - min);
    return pick.map(p => ({
      subject: formatKey(p.key).slice(0, 8),
      value: max === min ? 60 : Math.max(10, Math.min(100, ((p.value - min) / span) * 100)),
      raw: p.value
    }));
  }, [numericMetrics]);

  const contentTypeLabel = useMemo(() => {
    const mode = String(data.mode || '').toUpperCase();
    if (mode.includes('VISION-SEM')) return 'SEM图像';
    if (mode.includes('VISION-TEM')) return 'TEM图像';
    if (mode.includes('VISION-XRD')) return 'XRD图谱';
    if (mode.includes('XPS')) return 'XPS谱图';
    if (mode.includes('POROSITY')) return 'BET/BJH结果';
    if (mode.includes('SPECTROSCOPY')) return '原位光谱';
    if (mode.includes('CONTACT')) return '接触电阻图';
    return '分析缩略图';
  }, [data.mode]);

  const pinnedMetrics = showAllPinned ? displayMetrics : displayMetrics.slice(0, pinnedCount);

  return (
    <div className="mt-2 p-3 bg-indigo-50/20 rounded-xl border border-indigo-100/50 flex flex-col gap-3 animate-reveal group hover:bg-indigo-50/40 transition-colors relative overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2 text-indigo-500">
          <i className="fa-solid fa-microscope text-[10px]"></i>
          <span className="text-[8px] font-black tracking-widest">深度分析审计</span>
        </div>
        <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'} text-[9px] text-indigo-300`}></i>
      </button>

      {expanded && (
        <>
          <div className="flex gap-3">
            <div className="w-28 h-20 shrink-0 relative bg-white rounded-lg border border-indigo-50 shadow-sm overflow-hidden">
            {data.thumbnailUrl ? (
              <button
                onClick={() => setShowPreview(true)}
                className="w-full h-full block"
                title="点击放大缩略图"
              >
                <img src={data.thumbnailUrl} alt="analysis-thumbnail" className="w-full h-full object-cover" />
              </button>
            ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                    <Line type="monotone" dataKey="y" stroke="#6366f1" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    <XAxis dataKey="x" hide />
                    <YAxis hide />
                    <Tooltip contentStyle={{ fontSize: '8px', padding: '2px' }} />
                    </LineChart>
                </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-indigo-300">
                <i className="fa-solid fa-chart-line text-xl"></i>
              </div>
            )}
            </div>
            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-slate-900/75 text-white text-[7px] font-black uppercase tracking-wide">
              {contentTypeLabel}
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {data.mode && (
                        <div className="flex items-center bg-indigo-600 text-white px-1.5 py-0.5 rounded text-[7px] font-black uppercase shadow-sm gap-1">
                            <span>模式</span>
                            <span className="opacity-80">{data.mode}</span>
                        </div>
                    )}
                    <div className="flex items-center bg-white px-1.5 py-0.5 rounded border border-slate-100 shadow-xs gap-1">
                        <span className="text-[7px] font-bold text-slate-300">同步</span>
                        <span className={`text-[7px] font-black ${data.matrixSync ? 'text-emerald-500' : 'text-slate-300'}`}>
                            {data.matrixSync ? '已同步' : '未同步'}
                        </span>
                    </div>
                </div>
                
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[8px] text-slate-400 font-black uppercase tracking-widest">核心指标（前N固定）</div>
                  <div className="flex items-center gap-1">
                    <select
                      value={pinnedCount}
                      onChange={(e) => setPinnedCount(Number(e.target.value))}
                      className="text-[8px] px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-600 font-black"
                    >
                      <option value={3}>前3</option>
                      <option value={5}>前5</option>
                      <option value={8}>前8</option>
                    </select>
                    <button
                      onClick={() => setShowAllPinned(v => !v)}
                      className="text-[8px] px-1.5 py-0.5 rounded border border-indigo-200 text-indigo-600 bg-indigo-50 font-black"
                    >
                      {showAllPinned ? '收起' : '更多'}
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {pinnedMetrics.map(([key, value]) => (
                    <div key={key} className="flex items-center bg-white/80 px-2 py-1 rounded-lg border border-indigo-50 shadow-xs gap-1.5 hover:border-indigo-200 transition-all">
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">{formatKey(key)}</span>
                        <span className="text-[10px] font-black text-indigo-600 font-mono">{formatValue(key, value)}</span>
                    </div>
                    ))}
                </div>
            </div>
          </div>
          {syncChartData.length > 0 && (
            <div className="bg-white/70 border border-indigo-100 rounded-xl p-2.5">
              <div className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-1">同步专用雷达</div>
              <div className="h-32">
                {syncChartData.length >= 3 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={syncChartData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8, fill: '#64748b', fontWeight: 700 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar dataKey="value" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.35} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={syncChartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <XAxis dataKey="subject" tick={{ fontSize: 8, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="raw" fill="#6366f1" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="raw" position="top" fill="#4f46e5" fontSize={8} fontWeight="bold" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="mt-1 text-[8px] text-slate-500 font-bold">
                内容类型: {contentTypeLabel} · 性能指标: {numericMetrics.length} 项
              </div>
              {numericMetrics.length > 0 && (
                <div className="mt-2 border-t border-indigo-100 pt-2">
                  <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">指标投送到主雷达（分组/搜索）</div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <input
                      value={metricSearch}
                      onChange={(e) => setMetricSearch(e.target.value)}
                      placeholder="搜索指标名"
                      className="flex-1 min-w-[120px] px-2 py-1 rounded border border-slate-200 text-[9px] font-bold text-slate-600 bg-white"
                    />
                    <button
                      onClick={() => setSelectedMetricKeys(recommendedKeys)}
                      className="px-2 py-1 rounded bg-indigo-50 border border-indigo-200 text-indigo-600 text-[8px] font-black"
                    >
                      一键推荐核心指标
                    </button>
                    <button
                      onClick={() => setSelectedMetricKeys([])}
                      className="px-2 py-1 rounded bg-slate-50 border border-slate-200 text-slate-500 text-[8px] font-black"
                    >
                      清空选择
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {Object.entries(groupedMetrics).map(([groupName, items]) => {
                      if (items.length === 0) return null;
                      const collapsed = collapsedGroups[groupName];
                      return (
                        <div key={groupName} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/70">
                          <button
                            onClick={() => setCollapsedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }))}
                            className="w-full flex items-center justify-between px-2 py-1.5 bg-white/80"
                          >
                            <span className="text-[9px] font-black text-slate-600">{groupName}（{items.length}）</span>
                            <i className={`fa-solid fa-chevron-${collapsed ? 'down' : 'up'} text-[8px] text-slate-400`}></i>
                          </button>
                          {!collapsed && (
                            <div className="p-1.5 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                              {items.map(item => {
                                const checked = selectedMetricKeys.includes(item.key);
                                const existed = Object.prototype.hasOwnProperty.call(mainMetrics, item.key);
                                return (
                                  <label key={item.key} className="flex items-center gap-1.5 text-[9px] bg-white border border-slate-200 rounded-lg px-2 py-1">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        setSelectedMetricKeys(prev => e.target.checked ? [...prev, item.key] : prev.filter(k => k !== item.key));
                                      }}
                                    />
                                    <span className="font-bold text-slate-600 truncate">{formatKey(item.key)}</span>
                                    <span className="text-indigo-600 font-mono text-[8px]">{Number(item.value).toFixed(3)}</span>
                                    {existed && <span className="ml-auto text-[7px] font-black text-emerald-600">已在主雷达</span>}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => {
                        const payload: Record<string, number> = {};
                        numericMetrics.forEach(m => {
                          if (selectedMetricKeys.includes(m.key)) payload[m.key] = Number(m.value);
                        });
                        onPromoteMetrics?.(payload);
                      }}
                      disabled={selectedMetricKeys.length === 0 || !onPromoteMetrics}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[9px] font-black uppercase disabled:opacity-40 hover:bg-indigo-700"
                    >
                      加入主雷达
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {fullReportText && (
            <div className="flex gap-2 bg-white/60 p-2.5 rounded-lg border border-amber-100/50 shadow-sm transition-all">
              <p className="text-[10px] text-slate-600 font-bold leading-relaxed italic text-justify">
                <i className="fa-solid fa-robot text-[8px] text-amber-500 mr-1.5"></i>
                {previewText}
              </p>
              {fullReportText.length > 260 && (
                <button
                  onClick={() => setShowFullText(v => !v)}
                  className="shrink-0 self-end px-2 py-1 rounded-md bg-amber-50 text-amber-700 text-[8px] font-black uppercase border border-amber-200 hover:bg-amber-100"
                >
                  {showFullText ? '收起' : '展开'}
                </button>
              )}
            </div>
          )}
        </>
      )}
      {!expanded && (
        <div className="pl-1 flex flex-wrap items-center gap-2 text-[9px]">
          <span className="text-slate-400 font-bold">点击展开查看缩略图、关键指标与分析内容</span>
          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-black">{contentTypeLabel}</span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-black">{numericMetrics.length}项性能</span>
        </div>
      )}
      {showPreview && data.thumbnailUrl && (
        <div
          className="fixed inset-0 z-[4000] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setShowPreview(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <img src={data.thumbnailUrl} alt="analysis-preview" className="max-w-full max-h-[88vh] rounded-2xl shadow-2xl border border-white/20" />
            <button
              onClick={(e) => { e.stopPropagation(); setShowPreview(false); }}
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

export default LogDeepAnalysisView;
