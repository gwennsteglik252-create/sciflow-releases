/**
 * NoteStatsView — 研究进度看板
 * 活跃度热力图 + 类型分布环形图 + 课题/文献关联排行
 */
import React, { useMemo } from 'react';
import { NotebookNote, NoteType } from '../../types/notebook';

const TYPE_META: Record<NoteType, { label: string; color: string; icon: string }> = {
  thought: { label: '灵感', color: '#a855f7', icon: 'fa-lightbulb' },
  meeting: { label: '会议', color: '#f59e0b', icon: 'fa-users' },
  reading: { label: '阅读', color: '#22c55e', icon: 'fa-book' },
  experiment: { label: '实验', color: '#3b82f6', icon: 'fa-flask' },
  idea: { label: '想法', color: '#ec4899', icon: 'fa-rocket' },
};

interface NoteStatsViewProps {
  notes: NotebookNote[];
  isLight: boolean;
  projects: { id: string; title: string }[];
}

const NoteStatsView: React.FC<NoteStatsViewProps> = ({ notes, isLight, projects }) => {

  // ═══ 热力图数据（最近 12 周，按天） ═══
  const heatmapData = useMemo(() => {
    const weeks = 12;
    const cells: { date: string; count: number; dayOfWeek: number; weekIdx: number }[] = [];
    const today = new Date();
    const startOfGrid = new Date(today);
    startOfGrid.setDate(today.getDate() - today.getDay() - (weeks - 1) * 7);

    // Count notes per day
    const countMap = new Map<string, number>();
    notes.forEach(n => {
      const d = n.updatedAt.slice(0, 10);
      countMap.set(d, (countMap.get(d) || 0) + 1);
    });

    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(startOfGrid);
        date.setDate(startOfGrid.getDate() + w * 7 + d);
        const dateStr = date.toISOString().slice(0, 10);
        if (date > today) continue;
        cells.push({
          date: dateStr,
          count: countMap.get(dateStr) || 0,
          dayOfWeek: d,
          weekIdx: w,
        });
      }
    }
    const maxCount = Math.max(...cells.map(c => c.count), 1);
    return { cells, maxCount };
  }, [notes]);

  // ═══ 类型分布 ═══
  const typeDistribution = useMemo(() => {
    const counts: Record<NoteType, number> = { thought: 0, meeting: 0, reading: 0, experiment: 0, idea: 0 };
    notes.forEach(n => { counts[n.type] = (counts[n.type] || 0) + 1; });
    const total = notes.length || 1;
    return Object.entries(counts).map(([type, count]) => ({
      type: type as NoteType,
      count,
      percentage: Math.round((count / total) * 100),
    }));
  }, [notes]);

  // ═══ 课题关联排行 ═══
  const projectRanking = useMemo(() => {
    const countMap = new Map<string, number>();
    notes.forEach(n => {
      n.linkedProjectIds.forEach(pid => {
        countMap.set(pid, (countMap.get(pid) || 0) + 1);
      });
    });
    return Array.from(countMap.entries())
      .map(([pid, count]) => ({
        id: pid,
        title: projects.find(p => p.id === pid)?.title || '未知课题',
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [notes, projects]);

  // ═══ 基础统计 ═══
  const stats = useMemo(() => {
    const totalWords = notes.reduce((sum, n) => sum + n.content.length, 0);
    const withAttachments = notes.filter(n => (n.attachments || []).length > 0).length;
    const withLinks = notes.filter(n => n.linkedNoteIds.length > 0).length;
    const withSummary = notes.filter(n => !!n.aiSummary).length;
    return { totalWords, withAttachments, withLinks, withSummary };
  }, [notes]);

  // ═══ SVG 环形图 ═══
  const renderDonutChart = () => {
    const size = 140;
    const strokeWidth = 20;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    let cumOffset = 0;

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {typeDistribution.map(d => {
          const segLen = (d.count / (notes.length || 1)) * circumference;
          const offset = cumOffset;
          cumOffset += segLen;
          if (d.count === 0) return null;
          return (
            <circle
              key={d.type}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={TYPE_META[d.type].color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segLen} ${circumference - segLen}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              style={{ transition: 'all 0.5s ease' }}
            />
          );
        })}
        {/* Center text */}
        <text
          x={size / 2}
          y={size / 2 - 5}
          textAnchor="middle"
          className={`text-2xl font-black ${isLight ? 'fill-slate-800' : 'fill-white'}`}
          style={{ fontSize: 24, fontWeight: 900 }}
        >
          {notes.length}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 12}
          textAnchor="middle"
          className={`text-[8px] font-bold uppercase ${isLight ? 'fill-slate-400' : 'fill-slate-500'}`}
          style={{ fontSize: 8, fontWeight: 700 }}
        >
          总笔记
        </text>
      </svg>
    );
  };

  // ═══ 热力图颜色 ═══
  const getHeatColor = (count: number, max: number) => {
    if (count === 0) return isLight ? '#f1f5f9' : 'rgba(255,255,255,0.03)';
    const intensity = count / max;
    if (intensity < 0.25) return isLight ? '#c7d2fe' : 'rgba(99,102,241,0.2)';
    if (intensity < 0.5) return isLight ? '#818cf8' : 'rgba(99,102,241,0.4)';
    if (intensity < 0.75) return isLight ? '#6366f1' : 'rgba(99,102,241,0.65)';
    return isLight ? '#4338ca' : 'rgba(99,102,241,0.9)';
  };

  if (notes.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-20 rounded-3xl border ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.05]'}`}>
        <i className={`fa-solid fa-chart-pie text-3xl mb-4 ${isLight ? 'text-slate-300' : 'text-slate-600'}`} />
        <p className={`text-xs font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>暂无数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── 顶部统计卡片 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '总字数', value: stats.totalWords.toLocaleString(), icon: 'fa-keyboard', color: 'from-indigo-500 to-violet-500' },
          { label: '含附件', value: stats.withAttachments, icon: 'fa-paperclip', color: 'from-cyan-500 to-blue-500' },
          { label: '有链接', value: stats.withLinks, icon: 'fa-link', color: 'from-violet-500 to-purple-500' },
          { label: 'AI 摘要', value: stats.withSummary, icon: 'fa-bolt', color: 'from-amber-500 to-orange-500' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border p-4 ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.05]'}`}>
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-2`}>
              <i className={`fa-solid ${s.icon} text-white text-[10px]`} />
            </div>
            <div className={`text-lg font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>{s.value}</div>
            <div className={`text-[8px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── 活跃度热力图 ── */}
        <div className={`rounded-2xl border p-5 ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.05]'}`}>
          <div className="flex items-center gap-2 mb-4">
            <i className={`fa-solid fa-fire text-[10px] ${isLight ? 'text-indigo-500' : 'text-indigo-400'}`} />
            <span className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              研究活跃度（最近 12 周）
            </span>
          </div>
          <div className="flex gap-[3px]">
            {Array.from({ length: 12 }).map((_, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }).map((_, dayIdx) => {
                  const cell = heatmapData.cells.find(c => c.weekIdx === weekIdx && c.dayOfWeek === dayIdx);
                  return (
                    <div
                      key={dayIdx}
                      className="w-[14px] h-[14px] rounded-[3px] transition-all hover:scale-125"
                      style={{ backgroundColor: cell ? getHeatColor(cell.count, heatmapData.maxCount) : (isLight ? '#f8fafc' : 'rgba(255,255,255,0.015)') }}
                      title={cell ? `${cell.date}: ${cell.count} 条笔记` : ''}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 mt-3 justify-end">
            <span className={`text-[7px] font-bold ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>少</span>
            {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
              <div key={i} className="w-[10px] h-[10px] rounded-[2px]" style={{ backgroundColor: getHeatColor(v * heatmapData.maxCount || (i === 0 ? 0 : 1), heatmapData.maxCount) }} />
            ))}
            <span className={`text-[7px] font-bold ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>多</span>
          </div>
        </div>

        {/* ── 类型分布 ── */}
        <div className={`rounded-2xl border p-5 ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.05]'}`}>
          <div className="flex items-center gap-2 mb-4">
            <i className={`fa-solid fa-chart-pie text-[10px] ${isLight ? 'text-violet-500' : 'text-violet-400'}`} />
            <span className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              类型分布
            </span>
          </div>
          <div className="flex items-center gap-6">
            {renderDonutChart()}
            <div className="flex-1 space-y-2">
              {typeDistribution.map(d => (
                <div key={d.type} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: TYPE_META[d.type].color }} />
                  <span className={`text-[9px] font-bold flex-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    {TYPE_META[d.type].label}
                  </span>
                  <span className={`text-[9px] font-black ${isLight ? 'text-slate-800' : 'text-white'}`}>{d.count}</span>
                  <span className={`text-[8px] font-bold ${isLight ? 'text-slate-300' : 'text-slate-600'}`}>{d.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── 课题关联排行 ── */}
      {projectRanking.length > 0 && (
        <div className={`rounded-2xl border p-5 ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.02] border-white/[0.05]'}`}>
          <div className="flex items-center gap-2 mb-4">
            <i className={`fa-solid fa-ranking-star text-[10px] ${isLight ? 'text-amber-500' : 'text-amber-400'}`} />
            <span className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              课题关联排行
            </span>
          </div>
          <div className="space-y-2">
            {projectRanking.map((p, i) => {
              const maxBarCount = projectRanking[0]?.count || 1;
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <span className={`text-[10px] font-black w-5 text-right ${i < 3 ? (isLight ? 'text-amber-500' : 'text-amber-400') : (isLight ? 'text-slate-300' : 'text-slate-600')}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-[10px] font-bold truncate ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        {p.title}
                      </span>
                      <span className={`text-[9px] font-black shrink-0 ml-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {p.count}
                      </span>
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                        style={{ width: `${(p.count / maxBarCount) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteStatsView;
