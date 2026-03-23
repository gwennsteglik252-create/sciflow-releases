
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ResearchProject, MatrixReport } from '../../../types';

interface ProjectReportsViewProps {
  project: ResearchProject;
  updateAi: (updates: any) => void;
  toggleModal: (key: any, value: any) => void;
  onDeleteReport: (id: string, e: React.MouseEvent) => void;
  onRenameReport?: (id: string) => void;
  onStartWeeklyReport: (type?: 'weekly' | 'monthly' | 'annual' | 'manual', startDate?: string, endDate?: string) => void;
  isGenerating?: boolean;
  onViewGeneratedFlows?: () => void;
  onViewExperimentPlan?: () => void;
  onUpdateProject?: (updated: ResearchProject) => void;
  onAddToCollector?: (tasks: string[], sourceLabel: string) => void;
}

type FilterType = 'all' | 'Weekly' | 'Monthly' | 'Annual' | 'Manual';
type SortOrder = 'desc' | 'asc';

const FILTER_TABS: { key: FilterType; label: string; icon: string; color: string }[] = [
  { key: 'all', label: '全部', icon: 'fa-layer-group', color: 'slate' },
  { key: 'Weekly', label: '周报', icon: 'fa-calendar-week', color: 'indigo' },
  { key: 'Monthly', label: '月报', icon: 'fa-calendar-days', color: 'violet' },
  { key: 'Annual', label: '年报', icon: 'fa-calendar', color: 'amber' },
  { key: 'Manual', label: '手动', icon: 'fa-pen-to-square', color: 'emerald' },
];

/** 从内容中正则提取关键科研数值 (百分比、温度、mV、mA 等) */
const extractKeyMetrics = (content: string): string[] => {
  if (!content) return [];
  const patterns = [
    /\d+\.?\d*\s*%/g,
    /\d+\.?\d*\s*°C/g,
    /\d+\.?\d*\s*m[AV]/g,
    /\d+\.?\d*\s*(?:mol\/L|M)\b/g,
    /\d+\.?\d*\s*(?:nm|μm|mm)\b/g,
    /\d+\.?\d*\s*(?:h|min|s)\b/g,
    /\d+\.?\d*\s*(?:rpm|kPa|MPa|bar)\b/g,
  ];
  const found: string[] = [];
  const text = content.slice(0, 600);
  for (const pat of patterns) {
    const matches = text.match(pat);
    if (matches) found.push(...matches.slice(0, 2));
    if (found.length >= 4) break;
  }
  return [...new Set(found)].slice(0, 4);
};

/** 估算阅读时长 */
const estimateReadTime = (content: string): string => {
  if (!content) return '';
  const charCount = content.length;
  const mins = Math.max(1, Math.round(charCount / 400));
  return `${mins} min`;
};

/** 按月分组键 */
const getMonthGroupKey = (timestamp: string): string => {
  try {
    const dateStr = timestamp.split(' ')[0].replace(/-/g, '/');
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '未知时间';
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  } catch {
    return '未知时间';
  }
};

/** 时间戳 → 排序用数值 */
const parseTimestampToNum = (ts: string): number => {
  try {
    const normalized = ts.replace(/-/g, '/').replace(/\//g, '-');
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  } catch {
    return 0;
  }
};

/** 判断是否本月 */
const isCurrentMonth = (ts: string): boolean => {
  try {
    const dateStr = ts.split(' ')[0].replace(/-/g, '/');
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  } catch { return false; }
};

const ProjectReportsView: React.FC<ProjectReportsViewProps> = ({
  project,
  updateAi,
  toggleModal,
  onDeleteReport,
  onRenameReport,
  onStartWeeklyReport,
  isGenerating = false,
  onViewGeneratedFlows,
  onViewExperimentPlan,
  onUpdateProject,
  onAddToCollector
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [expandedVersionGroups, setExpandedVersionGroups] = useState<Set<string>>(new Set());
  // 批量操作
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);

  // ── 日期范围选择器状态 ──
  const [pendingReportType, setPendingReportType] = useState<'weekly' | 'monthly' | 'annual' | null>(null);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const getDefaultDateRange = (type: 'weekly' | 'monthly' | 'annual') => {
    const now = new Date();
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const end = fmt(now);
    let start: string;
    if (type === 'weekly') {
      const dayOfWeek = now.getDay();
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const mon = new Date(now);
      mon.setDate(now.getDate() + diffToMon);
      start = fmt(mon);
    } else if (type === 'monthly') {
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    } else {
      start = `${now.getFullYear()}-01-01`;
    }
    return { start, end };
  };

  const openDatePicker = (type: 'weekly' | 'monthly' | 'annual') => {
    const { start, end } = getDefaultDateRange(type);
    setDateStart(start);
    setDateEnd(end);
    setPendingReportType(type);
    setShowCreateMenu(false);
  };

  const confirmDateRange = () => {
    if (pendingReportType && dateStart && dateEnd) {
      onStartWeeklyReport(pendingReportType, dateStart, dateEnd);
      setPendingReportType(null);
    }
  };

  const cancelDatePicker = () => {
    setPendingReportType(null);
  };

  // Handle click outside to close the menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowCreateMenu(false);
      }
    };
    if (showCreateMenu) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showCreateMenu]);

  const getWeeklyReportDisplayName = (timestamp: string, originalTitle: string, type?: string) => {
    if (type !== 'Weekly') return originalTitle;
    try {
      const dateStr = timestamp.split(' ')[0].replace(/-/g, '/');
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return originalTitle;
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const weekNum = Math.ceil(day / 7);
      return `${month}月第${weekNum}周的周报告`;
    } catch (e) { return originalTitle; }
  };

  const toggleSortOrder = () => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  const toggleVersionGroup = (groupKey: string) => {
    setExpandedVersionGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  // ── 批量操作方法 ──
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const exitBatchMode = () => { setBatchMode(false); setSelectedIds(new Set()); };
  const handleBatchDelete = useCallback(() => {
    if (!onUpdateProject || selectedIds.size === 0) return;
    const nextReports = (project.weeklyReports || []).filter(r => !selectedIds.has(r.id));
    onUpdateProject({ ...project, weeklyReports: nextReports });
    exitBatchMode();
  }, [onUpdateProject, project, selectedIds]);

  // ── 置顶/收藏 ──
  const handleTogglePin = useCallback((reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateProject) return;
    const nextReports = (project.weeklyReports || []).map(r =>
      r.id === reportId ? { ...r, pinned: !r.pinned } : r
    );
    onUpdateProject({ ...project, weeklyReports: nextReports });
  }, [onUpdateProject, project]);

  const allReports = project.weeklyReports || [];

  /** 统计数据 */
  const stats = useMemo(() => {
    const total = allReports.length;
    const thisMonth = allReports.filter(r => isCurrentMonth(r.timestamp)).length;
    const pinnedCount = allReports.filter(r => r.pinned).length;
    const typeBreakdown: Record<string, number> = {};
    for (const rep of allReports) {
      const t = rep.reportType || 'Manual';
      typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
    }
    return { total, thisMonth, pinnedCount, typeBreakdown };
  }, [allReports]);

  /** 各类型计数 */
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allReports.length };
    for (const rep of allReports) {
      const t = rep.reportType || 'Manual';
      counts[t] = (counts[t] || 0) + 1;
    }
    return counts;
  }, [allReports]);

  /** 筛选 + 搜索 + 排序（置顶优先） */
  const filteredReports = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = allReports.filter(rep => {
      if (activeFilter !== 'all') {
        const rType = rep.reportType || 'Manual';
        if (rType !== activeFilter) return false;
      }
      if (q) {
        return (
          (rep.title || '').toLowerCase().includes(q) ||
          (rep.content || '').toLowerCase().includes(q) ||
          (rep.timestamp || '').includes(q)
        );
      }
      return true;
    });
    // 排序：置顶优先，然后按时间
    filtered.sort((a, b) => {
      // 置顶始终最前
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const tA = parseTimestampToNum(a.timestamp);
      const tB = parseTimestampToNum(b.timestamp);
      return sortOrder === 'desc' ? tB - tA : tA - tB;
    });
    return filtered;
  }, [allReports, searchQuery, activeFilter, sortOrder]);

  // 延迟初始化 selectAll 以引用稳定的 filteredReports
  const handleSelectAll = () => {
    setSelectedIds(new Set(filteredReports.map(r => r.id)));
  };

  /** 版本标注 */
  const versionMap = useMemo(() => {
    const nameCountMap = new Map<string, { id: string; ts: number }[]>();
    for (const rep of filteredReports) {
      const dn = getWeeklyReportDisplayName(rep.timestamp, rep.title, rep.reportType);
      if (!nameCountMap.has(dn)) nameCountMap.set(dn, []);
      nameCountMap.get(dn)!.push({ id: rep.id, ts: parseTimestampToNum(rep.timestamp) });
    }
    const result = new Map<string, { version: string; total: number; isLatest: boolean; groupKey: string }>();
    nameCountMap.forEach((entries, dn) => {
      if (entries.length <= 1) return;
      const sorted = [...entries].sort((a, b) => a.ts - b.ts);
      sorted.forEach((entry, idx) => {
        result.set(entry.id, {
          version: `v${idx + 1}`,
          total: sorted.length,
          isLatest: idx === sorted.length - 1,
          groupKey: dn,
        });
      });
    });
    return result;
  }, [filteredReports]);

  /** 按月分组 */
  const groupedReports = useMemo(() => {
    const visibleReports = filteredReports.filter(rep => {
      const vi = versionMap.get(rep.id);
      if (!vi) return true;
      if (vi.isLatest) return true;
      return expandedVersionGroups.has(vi.groupKey);
    });
    const groups: { month: string; items: typeof filteredReports }[] = [];
    const map = new Map<string, typeof filteredReports>();
    for (const rep of visibleReports) {
      const key = getMonthGroupKey(rep.timestamp);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(rep);
    }
    map.forEach((items, month) => groups.push({ month, items }));
    return groups;
  }, [filteredReports, versionMap, expandedVersionGroups]);

  const getTabClasses = (key: FilterType, color: string) => {
    const isActive = activeFilter === key;
    if (isActive) {
      const colorMap: Record<string, string> = {
        slate: 'bg-slate-800 text-white border-slate-700 shadow-lg shadow-slate-200',
        indigo: 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-200',
        violet: 'bg-violet-600 text-white border-violet-500 shadow-lg shadow-violet-200',
        amber: 'bg-amber-500 text-white border-amber-400 shadow-lg shadow-amber-200',
        emerald: 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-200',
      };
      return colorMap[color] || colorMap.slate;
    }
    return 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700';
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 lg:p-8 overflow-hidden bg-slate-50/20">
      {/* ── 顶部标题 & 操作栏 ── */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-4 shrink-0 relative z-30">
        <h3 className="text-xl lg:text-3xl font-black text-slate-800 uppercase tracking-tight italic mb-0">研报/诊断 历史归档</h3>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              placeholder="搜索历史报告..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-[10px] font-bold outline-none focus:border-indigo-300 transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowCreateMenu(!showCreateMenu); }}
              disabled={isGenerating}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg transition-all flex items-center gap-2 active:scale-95 whitespace-nowrap border-2 ${isGenerating ? 'bg-indigo-700 text-white border-indigo-500 ring-4 ring-indigo-100' : (showCreateMenu ? 'bg-indigo-700 text-white border-indigo-500 ring-4 ring-indigo-100' : 'bg-indigo-600 text-white border-indigo-400 hover:bg-indigo-700')}`}
            >
              {isGenerating ? (
                <i className="fa-solid fa-spinner animate-spin"></i>
              ) : (
                <i className={`fa-solid ${showCreateMenu ? 'fa-chevron-up' : 'fa-plus'}`}></i>
              )}
              {isGenerating ? '正在智能生成...' : '新建研报'}
            </button>
            {showCreateMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-[100] animate-reveal">
                <button onClick={() => { onStartWeeklyReport('manual'); setShowCreateMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-indigo-50 text-[10px] font-bold text-indigo-600 border-b border-slate-50 flex items-center gap-2 transition-colors">
                  <i className="fa-solid fa-pen-to-square"></i> 空白研报 (白板)
                </button>
                <button onClick={() => openDatePicker('weekly')} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-[10px] font-bold text-slate-700 border-b border-slate-50 flex items-center gap-2 transition-colors">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> 周报智能生成
                </button>
                <button onClick={() => openDatePicker('monthly')} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-[10px] font-bold text-slate-700 border-b border-slate-50 flex items-center gap-2 transition-colors">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-500"></span> 月报智能生成
                </button>
                <button onClick={() => openDatePicker('annual')} className="w-full text-left px-4 py-3 hover:bg-slate-50 text-[10px] font-bold text-slate-700 flex items-center gap-2 transition-colors">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> 年报智能生成
                </button>
              </div>
            )}
          </div>

          {/* ── 日期范围选择面板 ── */}
          {pendingReportType && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[100] animate-reveal p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2.5 h-2.5 rounded-full ${pendingReportType === 'weekly' ? 'bg-indigo-500' : pendingReportType === 'monthly' ? 'bg-violet-500' : 'bg-amber-500'}`}></span>
                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                  {pendingReportType === 'weekly' ? '周报' : pendingReportType === 'monthly' ? '月报' : '年报'} — 选择时间范围
                </span>
              </div>
              <div className="space-y-2.5 mb-4">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">起始日期</label>
                  <input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">结束日期</label>
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-50 transition-all"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={cancelDatePicker}
                  className="flex-1 px-3 py-2 bg-white border border-slate-200 text-slate-500 rounded-lg text-[10px] font-black uppercase hover:bg-slate-50 transition-all active:scale-95"
                >
                  取消
                </button>
                <button
                  onClick={confirmDateRange}
                  disabled={!dateStart || !dateEnd || dateStart > dateEnd}
                  className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase shadow-sm hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-wand-magic-sparkles text-[9px]"></i>
                  确认生成
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 统计仪表盘 ── */}
      {allReports.length > 0 && (
        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="flex items-center gap-4 bg-white px-5 py-2 rounded-xl border border-slate-100 shadow-sm flex-1">
            <div className="flex items-center gap-1.5">
              <i className="fa-solid fa-archive text-slate-400 text-[9px]"></i>
              <span className="text-[9px] font-bold text-slate-400 uppercase">总计</span>
              <span className="text-[13px] font-black text-slate-800">{stats.total}</span>
            </div>
            <div className="w-px h-4 bg-slate-100"></div>
            <div className="flex items-center gap-1.5">
              <i className="fa-solid fa-calendar-plus text-indigo-400 text-[9px]"></i>
              <span className="text-[9px] font-bold text-slate-400 uppercase">本月</span>
              <span className="text-[13px] font-black text-indigo-600">+{stats.thisMonth}</span>
            </div>
            {stats.pinnedCount > 0 && (
              <>
                <div className="w-px h-4 bg-slate-100"></div>
                <div className="flex items-center gap-1.5">
                  <i className="fa-solid fa-star text-amber-400 text-[9px]"></i>
                  <span className="text-[9px] font-bold text-slate-400 uppercase">收藏</span>
                  <span className="text-[13px] font-black text-amber-600">{stats.pinnedCount}</span>
                </div>
              </>
            )}
            <div className="w-px h-4 bg-slate-100"></div>
            {/* 迷你类型分布 */}
            <div className="flex items-center gap-1">
              {Object.entries(stats.typeBreakdown).map(([type, count]) => {
                const colorDots: Record<string, string> = {
                  Weekly: 'bg-indigo-500', Monthly: 'bg-violet-500', Annual: 'bg-amber-500',
                  Manual: 'bg-emerald-500', Diagnostic: 'bg-rose-500',
                };
                return (
                  <div key={type} className="flex items-center gap-0.5" title={`${type}: ${count}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${colorDots[type] || 'bg-slate-400'}`}></span>
                    <span className="text-[7px] font-bold text-slate-400">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* 批量模式切换 */}
          <button
            onClick={() => batchMode ? exitBatchMode() : setBatchMode(true)}
            className={`shrink-0 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all active:scale-95 whitespace-nowrap ${
              batchMode
                ? 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-200'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <i className={`fa-solid ${batchMode ? 'fa-xmark' : 'fa-check-double'} text-[9px] mr-1`}></i>
            {batchMode ? '退出' : '批量'}
          </button>
        </div>
      )}

      {/* ── 批量操作工具栏 ── */}
      {batchMode && (
        <div className="flex items-center gap-3 mb-4 shrink-0 bg-rose-50 border border-rose-200 rounded-xl px-5 py-2.5 animate-reveal">
          <span className="text-[10px] font-black text-rose-600 uppercase">
            已选 {selectedIds.size} / {filteredReports.length}
          </span>
          <button
            onClick={handleSelectAll}
            className="px-3 py-1 bg-white text-rose-600 rounded-lg text-[9px] font-black uppercase border border-rose-200 hover:bg-rose-100 transition-all active:scale-95"
          >
            全选
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1 bg-white text-slate-500 rounded-lg text-[9px] font-black uppercase border border-slate-200 hover:bg-slate-100 transition-all active:scale-95"
          >
            清空
          </button>
          <div className="flex-1"></div>
          <button
            onClick={handleBatchDelete}
            disabled={selectedIds.size === 0}
            className="px-4 py-1.5 bg-rose-600 text-white rounded-lg text-[9px] font-black uppercase shadow-sm hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <i className="fa-solid fa-trash-can text-[8px]"></i>
            批量删除 ({selectedIds.size})
          </button>
        </div>
      )}

      {/* ── 分类筛选 Tab 栏 + 排序 ── */}
      <div className="flex items-center gap-2 mb-4 shrink-0 overflow-x-auto pb-1 relative z-20">
        {FILTER_TABS.map(tab => {
          const count = typeCounts[tab.key] || 0;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all active:scale-95 whitespace-nowrap ${getTabClasses(tab.key, tab.color)}`}
            >
              <i className={`fa-solid ${tab.icon} text-[9px]`}></i>
              {tab.label}
              <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[7px] font-black ${activeFilter === tab.key ? 'bg-white/20 text-inherit' : 'bg-slate-100 text-slate-400'}`}>
                {count}
              </span>
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleSortOrder}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-all active:scale-95 whitespace-nowrap"
            title={sortOrder === 'desc' ? '当前: 最新优先' : '当前: 最早优先'}
          >
            <i className={`fa-solid ${sortOrder === 'desc' ? 'fa-arrow-down-wide-short' : 'fa-arrow-up-short-wide'} text-[9px]`}></i>
            {sortOrder === 'desc' ? '最新' : '最早'}
          </button>
          {activeFilter !== 'all' && (
            <span className="text-[8px] font-bold text-slate-400 italic whitespace-nowrap">
              筛选结果: {filteredReports.length} 份
            </span>
          )}
        </div>
      </div>

      {/* ── 内容区域 ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative z-10">
        {/* 生成中的视觉占位符 */}
        {isGenerating && (
          <div className="bg-white p-6 rounded-xl border-2 border-dashed border-indigo-200 shadow-sm animate-pulse relative overflow-hidden flex flex-col justify-center min-h-[140px] mb-4">
            <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-500/20">
              <div className="h-full bg-indigo-600 w-1/3 animate-[loading_1.5s_infinite]"></div>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                <i className="fa-solid fa-wand-magic-sparkles text-indigo-500 animate-bounce"></i>
              </div>
              <div>
                <div className="h-3 w-32 bg-slate-100 rounded mb-1.5"></div>
                <div className="h-2 w-20 bg-slate-50 rounded"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-2 w-full bg-slate-50 rounded"></div>
              <div className="h-2 w-2/3 bg-slate-50 rounded"></div>
            </div>
            <p className="mt-4 text-[9px] font-black text-indigo-400 uppercase tracking-widest text-center">AI 正在深度解算并同步实验数据...</p>
          </div>
        )}

        {/* 按月份分组渲染 */}
        {groupedReports.map(group => (
          <div key={group.month} className="mb-6">
            {groupedReports.length > 1 && (
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                  <i className="fa-regular fa-calendar text-indigo-400 text-[9px]"></i>
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">{group.month}</span>
                  <span className="text-[8px] font-bold text-slate-300">({group.items.length})</span>
                </div>
                <div className="flex-1 h-px bg-slate-100"></div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {group.items.map(rep => {
                const displayName = getWeeklyReportDisplayName(rep.timestamp, rep.title, rep.reportType);
                const sourceCount = rep.sourceLogIds?.length || 0;
                const keyMetrics = extractKeyMetrics(rep.content);
                const readTime = estimateReadTime(rep.content);
                const versionInfo = versionMap.get(rep.id);
                const isGroupExpanded = versionInfo ? expandedVersionGroups.has(versionInfo.groupKey) : false;
                const firstInsight = rep.insights?.[0];
                const isSelected = selectedIds.has(rep.id);
                const isPinned = rep.pinned;

                const typeColorMap: Record<string, string> = {
                  Weekly: 'bg-indigo-50 text-indigo-600 border-indigo-100',
                  Monthly: 'bg-violet-50 text-violet-600 border-violet-100',
                  Annual: 'bg-amber-50 text-amber-600 border-amber-100',
                  Manual: 'bg-emerald-50 text-emerald-600 border-emerald-100',
                  Diagnostic: 'bg-rose-50 text-rose-600 border-rose-100',
                };
                const typeColor = typeColorMap[rep.reportType] || 'bg-slate-50 text-slate-600 border-slate-100';

                return (
                  <div
                    key={rep.id}
                    className={`bg-white p-5 rounded-xl border shadow-sm transition-all cursor-pointer relative group/rep ${
                      isSelected
                        ? 'border-rose-300 ring-2 ring-rose-100 shadow-rose-100'
                        : isPinned
                          ? 'border-amber-200 shadow-amber-50'
                          : 'border-slate-100 hover:border-indigo-200 hover:shadow-md'
                    }`}
                    onClick={() => {
                      if (batchMode) {
                        toggleSelect(rep.id);
                      } else {
                        updateAi({ currentReport: { id: rep.id, title: displayName, content: rep.content, sourceLogIds: rep.sourceLogIds } });
                        toggleModal('weekly', true);
                      }
                    }}
                  >
                    {/* 置顶标记 */}
                    {isPinned && !batchMode && (
                      <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shadow-sm border-2 border-white z-10">
                        <i className="fa-solid fa-star text-white text-[7px]"></i>
                      </div>
                    )}

                    {/* 批量勾选框 */}
                    {batchMode && (
                      <div className="absolute top-3 left-3 z-20">
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-rose-500 border-rose-500' : 'bg-white border-slate-300 hover:border-rose-400'
                        }`}>
                          {isSelected && <i className="fa-solid fa-check text-white text-[8px]"></i>}
                        </div>
                      </div>
                    )}

                    {/* 悬浮操作按钮 */}
                    {!batchMode && (
                      <div className="absolute top-4 right-4 flex gap-1.5 sm:opacity-0 group-hover/rep:opacity-100 transition-all z-20">
                        {onUpdateProject && (
                          <button
                            onClick={(e) => handleTogglePin(rep.id, e)}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shadow-sm active:scale-90 border ${
                              isPinned
                                ? 'bg-amber-400 text-white border-amber-300 hover:bg-amber-500'
                                : 'bg-amber-50 text-amber-400 border-amber-100 hover:bg-amber-400 hover:text-white'
                            }`}
                            title={isPinned ? '取消置顶' : '置顶收藏'}
                          >
                            <i className={`fa-${isPinned ? 'solid' : 'regular'} fa-star text-[9px]`}></i>
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); onRenameReport?.(rep.id); }}
                          className="w-7 h-7 bg-indigo-50 text-indigo-500 border border-indigo-100 rounded-lg flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-90"
                          title="重命名"
                        >
                          <i className="fa-solid fa-pen text-[9px]"></i>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteReport(rep.id, e); }}
                          className="w-7 h-7 bg-rose-50 text-rose-400 border border-rose-100 rounded-lg flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-90"
                          title="删除归档"
                        >
                          <i className="fa-solid fa-trash-can text-[9px]"></i>
                        </button>
                      </div>
                    )}

                    {/* 第一行: 类型标签 + 元信息 */}
                    <div className={`flex items-center gap-2 mb-2.5 ${batchMode ? 'ml-7' : ''}`}>
                      <span className={`px-2.5 py-0.5 rounded-lg text-[7px] font-black uppercase border ${typeColor}`}>
                        {rep.reportType || 'Record'}
                      </span>
                      {sourceCount > 0 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-500 text-[7px] font-bold border border-blue-100">
                          <i className="fa-solid fa-database text-[6px]"></i>
                          {sourceCount} 条记录
                        </span>
                      )}
                      {readTime && (
                        <span className="flex items-center gap-1 text-[7px] font-bold text-slate-300">
                          <i className="fa-regular fa-clock text-[6px]"></i>
                          {readTime}
                        </span>
                      )}
                      <span className={`ml-auto text-[8px] font-black text-slate-300 uppercase ${!batchMode ? 'mr-0 sm:group-hover/rep:mr-20' : ''} transition-all`}>{rep.timestamp}</span>
                    </div>

                    {/* 标题 + 版本标注 */}
                    <div className={`flex items-center gap-2 mb-1.5 ${batchMode ? 'ml-7 pr-4' : 'pr-12'}`}>
                      <h4 className="text-[11px] font-black text-slate-800 uppercase truncate">
                        {displayName}
                      </h4>
                      {versionInfo && (
                        <>
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[7px] font-black uppercase border ${
                            versionInfo.isLatest
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              : 'bg-slate-50 text-slate-400 border-slate-200'
                          }`}>
                            {versionInfo.version}
                            {versionInfo.isLatest && ' ★'}
                          </span>
                          {versionInfo.isLatest && (
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleVersionGroup(versionInfo.groupKey); }}
                              className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[7px] font-bold text-indigo-500 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all active:scale-95"
                              title={isGroupExpanded ? '收起历史版本' : `展开 ${versionInfo.total} 个版本`}
                            >
                              <i className={`fa-solid ${isGroupExpanded ? 'fa-chevron-up' : 'fa-code-branch'} text-[6px]`}></i>
                              {isGroupExpanded ? '收起' : `${versionInfo.total} 版本`}
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {/* 内容预览 */}
                    <p className={`text-[9.5px] text-slate-400 line-clamp-2 italic leading-relaxed mb-2 ${batchMode ? 'ml-7' : ''}`}>{rep.content}</p>

                    {/* 关键指标标签 */}
                    {keyMetrics.length > 0 && (
                      <div className={`flex flex-wrap gap-1.5 mb-2 ${batchMode ? 'ml-7' : ''}`}>
                        {keyMetrics.map((metric, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-slate-50 to-slate-100 text-[8px] font-bold text-slate-600 border border-slate-100"
                          >
                            <i className="fa-solid fa-chart-simple text-[6px] text-indigo-400"></i>
                            {metric.trim()}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Insight 预览 */}
                    {firstInsight && (
                      <div className={`flex items-start gap-1.5 px-2.5 py-1.5 bg-amber-50/50 rounded-lg border border-amber-100/50 mb-2 ${batchMode ? 'ml-7' : ''}`}>
                        <i className="fa-solid fa-lightbulb text-amber-400 text-[8px] mt-0.5 shrink-0"></i>
                        <p className="text-[8px] font-bold text-amber-700/70 line-clamp-1 italic">{firstInsight}</p>
                      </div>
                    )}

                    {/* 快捷按钮 */}
                    {!batchMode && (onViewGeneratedFlows || onViewExperimentPlan) && (
                      <div className="flex gap-2 mt-2 pt-2 border-t border-slate-50">
                        {onViewGeneratedFlows && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onViewGeneratedFlows(); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-600 rounded-xl text-[8px] font-black uppercase hover:bg-violet-100 transition-all active:scale-95 border border-violet-100"
                          >
                            <i className="fa-solid fa-flask-vial text-[9px]"></i>
                            查看实验流
                          </button>
                        )}
                        {onViewExperimentPlan && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onViewExperimentPlan(); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[8px] font-black uppercase hover:bg-emerald-100 transition-all active:scale-95 border border-emerald-100"
                          >
                            <i className="fa-solid fa-clipboard-list text-[9px]"></i>
                            查看实验计划
                          </button>
                        )}
                        {onAddToCollector && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const content = rep.content || '';
                              const sectionMatch = content.match(/##\s*下[周月年][^\n]*\n([\s\S]*?)(?=\n##|$)/i);
                              if (!sectionMatch) {
                                onAddToCollector([`基于以下研究报告生成实验计划：\n${content.slice(0, 2000)}`], rep.title || '归档报告');
                                return;
                              }
                              const items = sectionMatch[1]
                                .split('\n')
                                .map(line => line.replace(/^[\s\-\*\d\.]+/, '').trim())
                                .filter(line => line.length > 4 && !line.startsWith('#'));
                              if (items.length === 0) {
                                onAddToCollector([`基于以下研究报告生成实验计划：\n${content.slice(0, 2000)}`], rep.title || '归档报告');
                                return;
                              }
                              onAddToCollector(items, rep.title || '归档报告');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 text-teal-600 rounded-xl text-[8px] font-black uppercase hover:from-emerald-100 hover:to-teal-100 transition-all active:scale-95 border border-teal-100"
                          >
                            <i className="fa-solid fa-basket-shopping text-[9px]"></i>
                            添加到实验计划
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* 空态 */}
        {filteredReports.length === 0 && !isGenerating && (
          <div className="h-full flex flex-col items-center justify-center py-20 opacity-20 gap-4">
            <i className="fa-solid fa-file-circle-exclamation text-6xl text-slate-300"></i>
            <p className="text-sm font-black uppercase tracking-[0.4rem]">
              {activeFilter !== 'all' ? `暂无${FILTER_TABS.find(t => t.key === activeFilter)?.label || ''}归档` : '暂无研报归档'}
            </p>
          </div>
        )}
      </div>
      <style>{`
           @keyframes loading {
               0% { transform: translateX(-100%); }
               100% { transform: translateX(200%); }
           }
       `}</style>
    </div>
  );
};

export default ProjectReportsView;
