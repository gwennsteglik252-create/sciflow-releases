import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ResearchProject, TransformationProposal } from '../../types';
import { Literature } from '../../types/resources';

interface ProjectIntroductionProps {
  project: ResearchProject | undefined;
  resources: Literature[];
  proposals?: TransformationProposal[];
  onSelectResource?: (id: string) => void;
  onOpenBibTeX?: () => void;
  onSwitchToGraph?: () => void;
  onUploadClick?: () => void;
}

// ── Animated Counter Hook ──
const useCountUp = (end: number, duration = 800, trigger = true) => {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!trigger) { setValue(0); return; }
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(end * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [end, duration, trigger]);
  return value;
};

// ── Intersection Observer Hook ──
const useInView = (threshold = 0.2) => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
};

// ── Mini SVG Ring ──
const MiniRing: React.FC<{ pct: number; color: string; trackColor?: string; size?: number; label: string; inView?: boolean }> = ({ pct, color, trackColor = '#e2e8f0', size = 44, label, inView = true }) => {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={inView ? c - (pct / 100) * c : c}
          className="transition-all duration-1000 ease-out" />
      </svg>
      <span className="absolute text-[9px] font-black" style={{ color }}>{label}</span>
    </div>
  );
};

const ProjectIntroduction: React.FC<ProjectIntroductionProps> = ({
  project, resources, proposals = [], onSelectResource, onOpenBibTeX, onSwitchToGraph, onUploadClick
}) => {
  const [descExpanded, setDescExpanded] = useState(false);
  const DESC_LIMIT = 180;
  const descText = project?.description || '';
  const isDescLong = descText.length > DESC_LIMIT;

  const viewTrigger = useInView(0.15);
  const animTotal = useCountUp(resources.length, 900, viewTrigger.inView);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = resources.length;
    const papers = resources.filter(r => r.type === '文献').length;
    const patents = resources.filter(r => r.type === '专利').length;
    const competitors = resources.filter(r => r.type === '商业竞品').length;
    const sinked = resources.filter(r => r.knowledgeSinked).length;
    const sinkedRate = total > 0 ? Math.round((sinked / total) * 100) : 0;
    const withDoi = resources.filter(r => r.doi).length;
    const withLocalFile = resources.filter(r => r.localPath).length;
    const relevanceScore = total > 0 ? Math.round(((sinked + withDoi) / (total * 2)) * 100) : 0;
    const relevanceLevel = relevanceScore >= 60 ? 'HIGH' : relevanceScore >= 30 ? 'MID' : 'LOW';
    const patentRatio = total > 0 ? patents / total : 0;
    const patentLevel = patents === 0 ? 'NONE' : patentRatio >= 0.3 ? 'WALL' : patentRatio >= 0.15 ? 'CORE' : 'LOW';
    const totalCitations = resources.reduce((sum, r) => sum + (r.citationLinks?.length || 0), 0);
    const resourcesWithCitations = resources.filter(r => r.citationLinks && r.citationLinks.length > 0).length;
    const totalProposals = proposals.length;
    const adoptedProposals = proposals.filter(p => p.status === 'main').length;
    const conversionRate = totalProposals > 0 ? Math.round((adoptedProposals / totalProposals) * 100) : 0;
    const yearMap = new Map<number, number>();
    resources.forEach(r => { if (r.year) yearMap.set(r.year, (yearMap.get(r.year) || 0) + 1); });
    const years = Array.from(yearMap.entries()).sort((a, b) => a[0] - b[0]);
    const maxYearCount = Math.max(...years.map(y => y[1]), 1);
    const recent = [...resources].sort((a, b) => (b.year || 0) - (a.year || 0)).slice(0, 4);
    return { total, papers, patents, competitors, sinked, sinkedRate, withLocalFile, relevanceLevel, relevanceScore, patentLevel, totalCitations, resourcesWithCitations, totalProposals, adoptedProposals, conversionRate, years, maxYearCount, recent };
  }, [resources, proposals]);

  const relevanceColors: Record<string, string> = { HIGH: 'text-emerald-400', MID: 'text-amber-400', LOW: 'text-rose-400' };
  const patentColors: Record<string, string> = { WALL: 'text-rose-400', CORE: 'text-emerald-400', LOW: 'text-amber-400', NONE: 'text-slate-500' };
  const typeConfig: Record<string, { icon: string; color: string; bg: string }> = {
    '文献': { icon: 'fa-file-lines', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    '专利': { icon: 'fa-shield-halved', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    '商业竞品': { icon: 'fa-building', color: 'text-amber-600', bg: 'bg-amber-50' },
  };

  const progressPercent = project?.progress || 0;
  const getYearHeat = (c: number) => { const r = c / stats.maxYearCount; return r >= 0.8 ? 'bg-indigo-600' : r >= 0.5 ? 'bg-indigo-400' : 'bg-indigo-200'; };

  return (
    <div className="flex-1 flex flex-col p-4 lg:p-6 overflow-y-auto custom-scrollbar bg-slate-50/20">
      <div className="max-w-6xl mx-auto w-full space-y-5 animate-reveal" ref={viewTrigger.ref}>
        {/* ── Header ── */}
        <header className="text-left pb-4">
          <div className="flex items-center gap-3 mb-1.5">
            <span className="bg-indigo-600/80 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200">PROJECT INTEL</span>
            {project?.startDate && (
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                <i className="fa-regular fa-calendar mr-1" />{new Date(project.startDate).toLocaleDateString()} 起
              </span>
            )}
          </div>
          <h3 className="text-2xl lg:text-3xl font-black text-slate-800 italic uppercase tracking-tighter leading-tight mb-2">{project?.title}</h3>
          <div className="flex flex-wrap gap-1.5">
            {project?.keywords?.map((k, i) => (
              <span key={i} className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[8px] font-black text-slate-500 uppercase italic shadow-sm hover:border-indigo-400 hover:text-indigo-600 transition-all cursor-default">
                # {k}
              </span>
            ))}
          </div>
        </header>

        {/* ═══ ROW 1: Description + Stats Summary ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Description */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-100 shadow-md relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-40 pointer-events-none" />
            <h4 className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.15rem] mb-2 flex items-center gap-1.5">
              <i className="fa-solid fa-align-left text-[8px]" /> 课题背景与核心描述
            </h4>
            <p className="text-[13px] font-bold text-slate-700 leading-relaxed italic text-justify opacity-90 relative z-10">
              {isDescLong && !descExpanded ? descText.slice(0, DESC_LIMIT) + '...' : descText}
            </p>
            {isDescLong && (
              <button onClick={() => setDescExpanded(!descExpanded)} className="mt-1.5 text-[8px] font-black text-indigo-500 uppercase hover:text-indigo-700 transition-colors flex items-center gap-1 relative z-10">
                <i className={`fa-solid fa-chevron-${descExpanded ? 'up' : 'down'} text-[6px]`} />
                {descExpanded ? '收起' : '展开全文'}
              </button>
            )}
          </div>

          {/* Stats Summary — merged counter + distribution */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-md flex flex-col justify-between">
            <div className="text-center mb-3">
              <div className="text-4xl font-black text-indigo-600" style={{ fontVariantNumeric: 'tabular-nums' }}>{animTotal}</div>
              <p className="text-[7px] font-bold text-slate-400 uppercase mt-0.5">TOTAL INTELLIGENCE ASSETS</p>
            </div>
            <div className="space-y-2">
              {[
                { label: '文献', count: stats.papers, color: 'bg-indigo-500', track: 'bg-indigo-100' },
                { label: '专利', count: stats.patents, color: 'bg-emerald-500', track: 'bg-emerald-100' },
                { label: '竞品', count: stats.competitors, color: 'bg-amber-500', track: 'bg-amber-100' },
              ].map(item => {
                const pct = stats.total > 0 ? (item.count / stats.total) * 100 : 0;
                return (
                  <div key={item.label} className="flex items-center gap-2">
                    <span className="text-[8px] font-bold text-slate-500 w-6 shrink-0">{item.label}</span>
                    <div className={`flex-1 h-1.5 rounded-full ${item.track} overflow-hidden`}>
                      <div className={`h-full rounded-full ${item.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[9px] font-black text-slate-700 font-mono w-5 text-right">{item.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══ ROW 2: Assessment + Progress Rings ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Intelligence Depth Assessment — dark card */}
          <div className="lg:col-span-2 bg-slate-900 text-white p-5 rounded-2xl shadow-xl relative overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.12rem] italic border-l-2 border-indigo-500 pl-3">情报捕捉深度评估</h4>
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">AUTOMATED</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {/* Relevance */}
              <div className="text-center p-3 bg-white/5 rounded-xl">
                <p className="text-[6px] font-black text-slate-400 uppercase mb-1">文献关联度</p>
                <p className={`text-lg font-black italic ${relevanceColors[stats.relevanceLevel] || 'text-slate-500'}`}>{stats.relevanceLevel}</p>
                <p className="text-[7px] text-slate-500 font-mono">{stats.relevanceScore}%</p>
              </div>
              {/* Patent */}
              <div className="text-center p-3 bg-white/5 rounded-xl">
                <p className="text-[6px] font-black text-slate-400 uppercase mb-1">专利壁垒</p>
                <p className={`text-lg font-black italic ${patentColors[stats.patentLevel] || 'text-slate-500'}`}>{stats.patentLevel}</p>
                <p className="text-[7px] text-slate-500 font-mono">{stats.patents} 件</p>
              </div>
              {/* TRL */}
              <div className="text-center p-3 bg-white/5 rounded-xl">
                <p className="text-[6px] font-black text-slate-400 uppercase mb-1">TRL 成熟度</p>
                <p className="text-lg font-black italic text-amber-400">Lv.{project?.trl || 1}</p>
                <div className="flex justify-center gap-px mt-1">
                  {[1,2,3,4,5,6,7,8,9].map(lv => (
                    <div key={lv} className={`w-1.5 h-1 rounded-full ${lv <= (project?.trl || 1) ? 'bg-amber-400' : 'bg-white/10'}`} />
                  ))}
                </div>
              </div>
              {/* Completion */}
              <div className="flex flex-col items-center justify-center p-3 bg-white/5 rounded-xl">
                <p className="text-[6px] font-black text-slate-400 uppercase mb-1">完成率</p>
                <MiniRing
                  pct={progressPercent} size={42} label={`${progressPercent}%`}
                  color={progressPercent >= 70 ? '#34d399' : progressPercent >= 40 ? '#fbbf24' : '#f87171'}
                  trackColor="rgba(255,255,255,0.08)" inView={viewTrigger.inView}
                />
              </div>
            </div>
          </div>

          {/* Right side — Knowledge Sink + Transformation merged */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-md space-y-4">
            {/* Knowledge Sink */}
            <div className="flex items-center gap-3">
              <MiniRing pct={stats.sinkedRate} size={44} label={`${stats.sinkedRate}%`} color="#10b981" inView={viewTrigger.inView} />
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black text-slate-600 uppercase mb-0.5">知识沉淀</p>
                <p className="text-[7px] text-slate-400 font-bold">已沉淀 <span className="text-emerald-600">{stats.sinked}</span> / {stats.total} · 本地 <span className="text-sky-600">{stats.withLocalFile}</span></p>
              </div>
            </div>

            {/* Separator */}
            <div className="border-t border-slate-100" />

            {/* Transformation */}
            {stats.totalProposals > 0 ? (
              <div className="flex items-center gap-3">
                <MiniRing pct={stats.conversionRate} size={44} label={`${stats.conversionRate}%`} color="#f59e0b" trackColor="#fef3c7" inView={viewTrigger.inView} />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-slate-600 uppercase mb-0.5">情报转化</p>
                  <p className="text-[7px] text-slate-400 font-bold">建议 <span className="text-amber-600">{stats.totalProposals}</span> 条 · 已采纳 <span className="text-emerald-600">{stats.adoptedProposals}</span></p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-[44px] h-[44px] rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-bolt text-slate-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-slate-600 uppercase mb-0.5">情报转化</p>
                  <p className="text-[7px] text-slate-400 font-bold">暂无转化建议</p>
                </div>
              </div>
            )}

            {/* Citation Network Link */}
            {stats.totalCitations > 0 && (
              <>
                <div className="border-t border-slate-100" />
                <button onClick={onSwitchToGraph} className="w-full flex items-center gap-3 group/cite">
                  <div className="w-[44px] h-[44px] rounded-full bg-violet-50 flex items-center justify-center shrink-0 group-hover/cite:bg-violet-600 transition-colors">
                    <i className="fa-solid fa-diagram-project text-violet-500 group-hover/cite:text-white transition-colors text-xs" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[9px] font-black text-slate-600 uppercase mb-0.5">引用网络</p>
                    <p className="text-[7px] text-slate-400 font-bold"><span className="text-violet-600">{stats.totalCitations}</span> 条关系 · <span className="text-violet-500">{stats.resourcesWithCitations}</span> 节点</p>
                  </div>
                  <i className="fa-solid fa-chevron-right text-[8px] text-slate-300 group-hover/cite:text-violet-500 transition-colors" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ═══ ROW 3: Year Heatmap + Recent Items ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Year Heatmap */}
          {stats.years.length > 1 ? (
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-md">
              <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.12rem] mb-3 flex items-center gap-1.5">
                <i className="fa-solid fa-chart-bar text-indigo-400 text-[8px]" /> 年份分布
              </h4>
              <div className="flex items-end gap-1 h-14">
                {stats.years.map(([year, count]) => {
                  const height = Math.max((count / stats.maxYearCount) * 100, 15);
                  return (
                    <div key={year} className="flex-1 flex flex-col items-center gap-0.5 group/bar" title={`${year}: ${count} 篇`}>
                      <span className="text-[6px] font-black text-indigo-500 opacity-0 group-hover/bar:opacity-100 transition-opacity font-mono">{count}</span>
                      <div className={`w-full rounded-t ${getYearHeat(count)} transition-all duration-500 group-hover/bar:brightness-110`} style={{ height: `${height}%`, minHeight: '4px' }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[7px] text-slate-400 font-mono font-bold">{stats.years[0]?.[0]}</span>
                <span className="text-[7px] text-slate-400 font-mono font-bold">{stats.years[stats.years.length - 1]?.[0]}</span>
              </div>
            </div>
          ) : (
            /* Placeholder when no year data */
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-md flex flex-col items-center justify-center text-center">
              <i className="fa-solid fa-chart-bar text-2xl text-slate-200 mb-2" />
              <p className="text-[8px] text-slate-400 font-bold uppercase">年份数据不足</p>
            </div>
          )}

          {/* Recent Items — compact list */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.12rem] flex items-center gap-1.5">
                <i className="fa-solid fa-clock-rotate-left text-indigo-400 text-[8px]" /> 最新情报
              </h4>
              <span className="text-[8px] font-bold text-slate-400">{stats.recent.length} 条</span>
            </div>
            {stats.recent.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {stats.recent.map(item => {
                  const cfg = typeConfig[item.type] || typeConfig['文献'];
                  return (
                    <button key={item.id} onClick={() => onSelectResource?.(item.id)} className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-slate-50 transition-all group/item">
                      <div className={`w-6 h-6 rounded-md ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0`}>
                        <i className={`fa-solid ${cfg.icon} text-[8px]`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-slate-700 truncate group-hover/item:text-indigo-600 transition-colors">{item.title}</p>
                        <p className="text-[8px] text-slate-400 truncate">{Array.isArray(item.authors) ? item.authors.slice(0, 2).join(', ') : item.source}{item.year ? ` · ${item.year}` : ''}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.knowledgeSinked && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="已沉淀" />}
                        {item.doi && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" title="DOI" />}
                        <i className="fa-solid fa-chevron-right text-[7px] text-slate-200 group-hover/item:text-indigo-400 transition-colors" />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-[9px] text-slate-400 italic">暂无情报条目</p>
              </div>
            )}
          </div>
        </div>

        {/* ═══ ROW 4: CTA / Summary ═══ */}
        {stats.total === 0 ? (
          <div className="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl text-white shadow-xl flex items-center gap-6">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              <i className="fa-solid fa-magnifying-glass-plus text-xl" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest mb-0.5">开始捕捉情报</p>
              <p className="text-[8px] font-bold opacity-60">选择以下方式快速添加文献与专利到情报库</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={onOpenBibTeX} className="px-4 py-2.5 bg-white/15 hover:bg-white/25 rounded-xl text-[8px] font-black uppercase transition-all border border-white/10 flex items-center gap-1.5">
                <i className="fa-solid fa-bolt" /> 智能导入
              </button>
              <button onClick={onUploadClick} className="px-4 py-2.5 bg-white/15 hover:bg-white/25 rounded-xl text-[8px] font-black uppercase transition-all border border-white/10 flex items-center gap-1.5">
                <i className="fa-solid fa-file-arrow-up" /> 上传
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl text-white shadow-xl flex items-center gap-4">
            <div className="flex gap-3 flex-1">
              {[
                { n: stats.papers, l: '文献' },
                { n: stats.patents, l: '专利' },
                { n: stats.competitors, l: '竞品' },
                { n: stats.sinked, l: '已沉淀' },
              ].map(s => (
                <div key={s.l} className="bg-white/10 rounded-xl px-4 py-2.5 text-center flex-1">
                  <p className="text-lg font-black font-mono leading-none">{s.n}</p>
                  <p className="text-[7px] font-bold uppercase opacity-70 mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectIntroduction;