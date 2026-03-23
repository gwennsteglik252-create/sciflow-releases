
import React, { useMemo } from 'react';
import { ResearchProject } from '../../../types';
import { useProjectContext } from '../../../context/ProjectContext';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { tsToNum, isThisMonth, fmtDate, getWeekIndex, daysAgo } from '../../../utils/dateUtils';

interface ProjectOverviewViewProps {
  project: ResearchProject;
  onTabChange: (view: string) => void;
}


/** 进度环 SVG */
const ProgressRing: React.FC<{ value: number; max: number; color: string; label: string; icon: string }> = ({ value, max, color, label, icon }) => {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  const colorMap: Record<string, { stroke: string; bg: string; text: string }> = {
    indigo: { stroke: 'stroke-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-600' },
    violet: { stroke: 'stroke-violet-500', bg: 'bg-violet-50', text: 'text-violet-600' },
    emerald: { stroke: 'stroke-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-600' },
    amber: { stroke: 'stroke-amber-500', bg: 'bg-amber-50', text: 'text-amber-600' },
    rose: { stroke: 'stroke-rose-500', bg: 'bg-rose-50', text: 'text-rose-600' },
  };
  const c = colorMap[color] || colorMap.indigo;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-[68px] h-[68px]">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={r} fill="none" className="stroke-slate-100" strokeWidth="5" />
          <circle
            cx="32" cy="32" r={r} fill="none"
            className={c.stroke}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[15px] font-black text-slate-800 leading-none">{value}</span>
          <span className="text-[7px] font-bold text-slate-300 uppercase">/{max || '∞'}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <i className={`fa-solid ${icon} text-[8px] ${c.text}`}></i>
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
    </div>
  );
};

/** 自定义 Tooltip */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white px-3 py-2 rounded-xl shadow-xl border border-slate-700 text-[9px]">
      <p className="font-black text-slate-300 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-bold" style={{ color: p.color }}>
          {p.name}: {p.value}
          {p.dataKey === 'successRate' ? '%' : ''}
        </p>
      ))}
    </div>
  );
};

const ProjectOverviewView: React.FC<ProjectOverviewViewProps> = ({ project, onTabChange }) => {
  const { inventory } = useProjectContext();

  // ── 统计数据 ──
  const stats = useMemo(() => {
    const allLogs = project.milestones?.flatMap(m => m.logs || []) || [];
    const allReports = project.weeklyReports || [];
    const allPlans = project.milestones?.flatMap(m => m.experimentalPlan || []) || [];
    const totalLogs = allLogs.length;
    const successLogs = allLogs.filter(l => l.result === 'success').length;
    const anomalyLogs = allLogs.filter(l => l.status === 'Anomaly').length;
    const thisMonthLogs = allLogs.filter(l => isThisMonth(l.timestamp)).length;
    const totalReports = allReports.length;
    const thisMonthReports = allReports.filter(r => isThisMonth(r.timestamp)).length;
    const totalPlans = allPlans.length;
    const nodeCount = project.milestones?.length || 0;
    const pinnedReports = allReports.filter(r => r.pinned).length;

    return { totalLogs, successLogs, anomalyLogs, thisMonthLogs, totalReports, thisMonthReports, totalPlans, nodeCount, pinnedReports };
  }, [project]);

  // ── 近期活动时间线（合并日志 + 研报，按时间排序取最近 8 条） ──
  const recentActivities = useMemo(() => {
    const activities: { id: string; type: 'log' | 'report'; title: string; timestamp: string; ts: number; meta?: string }[] = [];

    const allLogs = project.milestones?.flatMap(m => m.logs || []) || [];
    for (const log of allLogs) {
      activities.push({
        id: log.id,
        type: 'log',
        title: log.content,
        timestamp: log.timestamp,
        ts: tsToNum(log.timestamp),
        meta: log.status === 'Anomaly' ? '⚠ 异常' : log.result === 'success' ? '✓ 成功' : undefined,
      });
    }

    for (const rep of (project.weeklyReports || [])) {
      activities.push({
        id: rep.id,
        type: 'report',
        title: rep.title,
        timestamp: rep.timestamp,
        ts: tsToNum(rep.timestamp),
        meta: rep.reportType,
      });
    }

    return activities.sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [project]);

  // ── 节点进度 ──
  const nodeProgress = useMemo(() => {
    return (project.milestones || []).map(m => {
      const logs = m.logs || [];
      const total = logs.length;
      const success = logs.filter(l => l.result === 'success').length;
      return { id: m.id, title: m.title, total, success, pct: total > 0 ? Math.round((success / total) * 100) : 0 };
    }).filter(n => n.total > 0);
  }, [project]);

  // ── 趋势图数据（近 4 周） ──
  const trendData = useMemo(() => {
    const allLogs = project.milestones?.flatMap(m => m.logs || []) || [];
    const weeks = [3, 2, 1, 0]; // 3 周前 → 本周
    const weekLabels = ['3周前', '2周前', '上周', '本周'];

    return weeks.map((weekIdx, i) => {
      const weekLogs = allLogs.filter(l => getWeekIndex(l.timestamp) === weekIdx);
      const total = weekLogs.length;
      const success = weekLogs.filter(l => l.result === 'success').length;
      const anomaly = weekLogs.filter(l => l.status === 'Anomaly').length;
      const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

      return {
        week: weekLabels[i],
        实验量: total,
        成功率: successRate,
        异常数: anomaly,
        successRate,
      };
    });
  }, [project]);

  // ── 风险预警 ──
  const riskAlerts = useMemo(() => {
    const alerts: { id: string; level: 'critical' | 'warning' | 'info'; icon: string; title: string; description: string; action?: { label: string; tab: string } }[] = [];

    const allLogs = project.milestones?.flatMap(m => m.logs || []) || [];

    // 1. 异常率预警
    if (stats.totalLogs > 3) {
      const anomalyRate = stats.anomalyLogs / stats.totalLogs;
      if (anomalyRate > 0.3) {
        alerts.push({
          id: 'anomaly_high',
          level: 'critical',
          icon: 'fa-triangle-exclamation',
          title: '异常率过高',
          description: `异常率 ${Math.round(anomalyRate * 100)}% 已超过 30% 阈值，建议排查近期实验参数偏差`,
          action: { label: '查看日志', tab: 'logs' },
        });
      } else if (anomalyRate > 0.15) {
        alerts.push({
          id: 'anomaly_moderate',
          level: 'warning',
          icon: 'fa-circle-exclamation',
          title: '异常率偏高',
          description: `异常率 ${Math.round(anomalyRate * 100)}%，高于 15% 关注线`,
          action: { label: '查看日志', tab: 'logs' },
        });
      }
    }

    // 2. 停滞预警
    if (allLogs.length > 0) {
      const latestLog = allLogs.reduce((latest, l) => {
        const t = tsToNum(l.timestamp);
        return t > latest.t ? { t, log: l } : latest;
      }, { t: 0, log: allLogs[0] });

      const daysSinceLastLog = Math.floor((Date.now() - latestLog.t) / (1000 * 60 * 60 * 24));
      if (daysSinceLastLog > 14) {
        alerts.push({
          id: 'stagnation_severe',
          level: 'critical',
          icon: 'fa-hourglass-half',
          title: '实验停滞',
          description: `已超过 ${daysSinceLastLog} 天无新实验记录，课题可能存在阻塞`,
          action: { label: '新增实验', tab: 'logs' },
        });
      } else if (daysSinceLastLog > 7) {
        alerts.push({
          id: 'stagnation_warn',
          level: 'warning',
          icon: 'fa-clock',
          title: '活跃度下降',
          description: `已 ${daysSinceLastLog} 天未录入新实验，建议保持实验节奏`,
          action: { label: '查看日志', tab: 'logs' },
        });
      }
    } else {
      alerts.push({
        id: 'no_experiments',
        level: 'info',
        icon: 'fa-flask-vial',
        title: '尚无实验数据',
        description: '开始录入您的第一条实验记录吧',
        action: { label: '开始实验', tab: 'logs' },
      });
    }

    // 3. 物料预警（检查课题关联物料的库存状态）
    if (project.requiredMaterials && project.requiredMaterials.length > 0 && inventory.length > 0) {
      const missingMaterials: string[] = [];
      const lowMaterials: string[] = [];

      for (const req of project.requiredMaterials) {
        const inStock = inventory.find(inv =>
          inv.name.toLowerCase().includes(req.name.toLowerCase()) ||
          inv.formula?.toLowerCase().includes(req.name.toLowerCase()) ||
          req.name.toLowerCase().includes(inv.name.toLowerCase())
        );
        if (!inStock) {
          missingMaterials.push(req.name);
        } else if (inStock.quantity <= inStock.threshold) {
          lowMaterials.push(req.name);
        }
      }

      if (missingMaterials.length > 0) {
        alerts.push({
          id: 'material_missing',
          level: 'critical',
          icon: 'fa-box-open',
          title: '物料缺失',
          description: `${missingMaterials.slice(0, 3).join('、')}${missingMaterials.length > 3 ? ` 等 ${missingMaterials.length} 项` : ''} 未在库存中找到`,
        });
      }
      if (lowMaterials.length > 0) {
        alerts.push({
          id: 'material_low',
          level: 'warning',
          icon: 'fa-battery-quarter',
          title: '物料库存不足',
          description: `${lowMaterials.slice(0, 3).join('、')} 已低于安全库存阈值`,
        });
      }
    }

    return alerts;
  }, [project, stats, inventory]);

  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 lg:p-8 overflow-hidden bg-slate-50/20">
      <div className="flex items-center gap-3 mb-6 shrink-0">
        <h3 className="text-xl lg:text-3xl font-black text-slate-800 uppercase tracking-tight italic">课题总览</h3>
        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-1">Dashboard</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-6">
        {/* ── 进度环 + 核心指标 ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 实验进度 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-5">
            <ProgressRing value={stats.successLogs} max={stats.totalLogs} color="emerald" label="实验成功率" icon="fa-flask-vial" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase">总实验</span>
                <span className="text-[14px] font-black text-slate-800">{stats.totalLogs}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase">本月新增</span>
                <span className="text-[14px] font-black text-indigo-600">+{stats.thisMonthLogs}</span>
              </div>
              {stats.anomalyLogs > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-rose-400 uppercase">异常</span>
                  <span className="text-[14px] font-black text-rose-600">{stats.anomalyLogs}</span>
                </div>
              )}
            </div>
          </div>

          {/* 研报归档 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-5">
            <ProgressRing value={stats.thisMonthReports} max={stats.totalReports || 1} color="violet" label="研报归档" icon="fa-file-lines" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase">总研报</span>
                <span className="text-[14px] font-black text-slate-800">{stats.totalReports}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase">本月新增</span>
                <span className="text-[14px] font-black text-violet-600">+{stats.thisMonthReports}</span>
              </div>
              {stats.pinnedReports > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-amber-400 uppercase">★ 收藏</span>
                  <span className="text-[14px] font-black text-amber-600">{stats.pinnedReports}</span>
                </div>
              )}
            </div>
          </div>

          {/* 拓扑节点 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-5">
            <ProgressRing value={nodeProgress.filter(n => n.pct >= 80).length} max={stats.nodeCount} color="indigo" label="节点覆盖" icon="fa-diagram-project" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase">拓扑节点</span>
                <span className="text-[14px] font-black text-slate-800">{stats.nodeCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-400 uppercase">实验计划</span>
                <span className="text-[14px] font-black text-indigo-600">{stats.totalPlans}</span>
              </div>
            </div>
          </div>

          {/* 快捷操作 */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 shadow-sm p-5 flex flex-col justify-center gap-3">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">快捷跳转</span>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => onTabChange('logs')} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-1.5">
                <i className="fa-solid fa-flask text-[8px]"></i> 实验日志
              </button>
              <button onClick={() => onTabChange('reports')} className="px-3 py-2 bg-violet-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-violet-700 transition-all active:scale-95 flex items-center gap-1.5">
                <i className="fa-solid fa-file-lines text-[8px]"></i> 研报归档
              </button>
              <button onClick={() => onTabChange('process')} className="px-3 py-2 bg-white/10 text-white rounded-xl text-[9px] font-black uppercase hover:bg-white/20 transition-all active:scale-95 flex items-center gap-1.5">
                <i className="fa-solid fa-route text-[8px]"></i> 实验路线
              </button>
              <button onClick={() => onTabChange('sample_matrix')} className="px-3 py-2 bg-white/10 text-white rounded-xl text-[9px] font-black uppercase hover:bg-white/20 transition-all active:scale-95 flex items-center gap-1.5">
                <i className="fa-solid fa-table-cells text-[8px]"></i> 样品矩阵
              </button>
            </div>
          </div>
        </div>

        {/* ── 趋势图区域 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 实验量趋势 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-chart-line text-indigo-400 text-[10px]"></i>
                实验活动趋势
              </h4>
              <span className="text-[8px] font-bold text-slate-300 uppercase">近 4 周</span>
            </div>
            {trendData.some(d => d['实验量'] > 0) ? (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradExperiments" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradSuccess" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="实验量"
                    name="实验量"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fill="url(#gradExperiments)"
                    dot={{ r: 4, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 6, stroke: '#6366f1', strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="异常数"
                    name="异常数"
                    stroke="#f43f5e"
                    strokeWidth={1.5}
                    fill="none"
                    strokeDasharray="4 2"
                    dot={{ r: 3, fill: '#f43f5e', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[160px] flex flex-col items-center justify-center opacity-25">
                <i className="fa-solid fa-chart-area text-4xl text-slate-300 mb-2"></i>
                <p className="text-[10px] font-black text-slate-400 uppercase">录入实验后显示趋势</p>
              </div>
            )}
          </div>

          {/* 成功率趋势 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-bullseye text-emerald-400 text-[10px]"></i>
                成功率变化
              </h4>
              <span className="text-[8px] font-bold text-slate-300 uppercase">近 4 周</span>
            </div>
            {trendData.some(d => d['实验量'] > 0) ? (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="成功率"
                    name="成功率"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#gradRate)"
                    dot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                    activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[160px] flex flex-col items-center justify-center opacity-25">
                <i className="fa-solid fa-percent text-4xl text-slate-300 mb-2"></i>
                <p className="text-[10px] font-black text-slate-400 uppercase">录入实验后显示趋势</p>
              </div>
            )}
          </div>
        </div>

        {/* ── KPI 目标达成雷达图 ── */}
        {project.targetMetrics && project.targetMetrics.length > 0 ? (() => {
          // 从实验日志 scientificData 中收集最新实际测量值
          let latestData: Record<string, number> = {};
          const milestones = project.milestones || [];
          const sortedMs = [...milestones].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
          for (const ms of sortedMs) {
            const sortedLogs = [...(ms.logs || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            for (const l of sortedLogs) {
              if (l.scientificData) {
                latestData = { ...l.scientificData, ...latestData };
              }
            }
          }

          // 计算每个指标的达成度
          const kpiData = project.targetMetrics!.map(m => {
            const targetNum = parseFloat(m.value) || 0;
            const actualVal = latestData[m.label] || 0;
            let score = 0;
            if (targetNum > 0 && actualVal > 0) {
              if (m.isHigherBetter !== false) {
                // 越高越好：实际值 / 目标值
                score = Math.min(120, (actualVal / targetNum) * 100);
              } else {
                // 越低越好：目标值 / 实际值
                score = Math.min(120, (targetNum / actualVal) * 100);
              }
            }
            return {
              metric: m.label,
              achievement: Math.round(score),
              fullMark: 120,
              actual: actualVal ? actualVal.toString() : '-',
              target: m.value,
              unit: m.unit || '',
              isHigherBetter: m.isHigherBetter,
            };
          });

          return (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
              <i className="fa-solid fa-bullseye text-indigo-400 text-[10px]"></i>
              KPI 目标达成度
            </h4>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={kpiData}>
                  <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                  <PolarRadiusAxis angle={90} domain={[0, 120]} tick={{ fontSize: 8 }} stroke="#cbd5e1" />
                  <Radar name="达成度" dataKey="achievement" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {kpiData.map((k, i) => (
                <div key={i} className={`px-2.5 py-1 rounded-lg text-[9px] font-bold ${k.achievement >= 100 ? 'bg-emerald-50 text-emerald-600' : k.achievement >= 70 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                  {k.metric}: {k.actual !== '-' ? `${k.actual}` : '待测'}{k.unit ? ` ${k.unit}` : ''} / 目标 {k.target}{k.unit ? ` ${k.unit}` : ''} ({k.achievement}%)
                </div>
              ))}
            </div>
          </div>);
        })() : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
              <i className="fa-solid fa-bullseye text-slate-300 text-[10px]"></i>
              KPI 目标达成度
            </h4>
            <div className="flex flex-col items-center justify-center py-8 opacity-30">
              <i className="fa-solid fa-crosshairs text-4xl text-slate-300 mb-2"></i>
              <p className="text-[10px] font-black text-slate-400 uppercase">在课题设置中定义目标指标后显示</p>
            </div>
          </div>
        )}

        {/* ── 风险预警 ── */}
        {riskAlerts.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-shield-halved text-amber-400 text-[10px]"></i>
                风险预警雷达
              </h4>
              <div className="flex items-center gap-1.5">
                {riskAlerts.some(a => a.level === 'critical') && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                )}
                <span className="text-[8px] font-bold text-slate-300 uppercase">
                  {riskAlerts.filter(a => a.level === 'critical').length} 紧急 · {riskAlerts.filter(a => a.level === 'warning').length} 关注
                </span>
              </div>
            </div>
            <div className="space-y-2.5">
              {riskAlerts.map(alert => {
                const levelStyles = {
                  critical: 'bg-rose-50 border-rose-200 text-rose-800',
                  warning: 'bg-amber-50 border-amber-200 text-amber-800',
                  info: 'bg-indigo-50 border-indigo-200 text-indigo-800',
                };
                const iconStyles = {
                  critical: 'text-rose-500',
                  warning: 'text-amber-500',
                  info: 'text-indigo-400',
                };
                const badgeStyles = {
                  critical: 'bg-rose-500 text-white',
                  warning: 'bg-amber-500 text-white',
                  info: 'bg-indigo-400 text-white',
                };
                const badgeLabels = {
                  critical: '紧急',
                  warning: '关注',
                  info: '提示',
                };

                return (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all hover:shadow-sm ${levelStyles[alert.level]}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${alert.level === 'critical' ? 'bg-rose-100' : alert.level === 'warning' ? 'bg-amber-100' : 'bg-indigo-100'}`}>
                      <i className={`fa-solid ${alert.icon} text-sm ${iconStyles[alert.level]}`}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${badgeStyles[alert.level]}`}>
                          {badgeLabels[alert.level]}
                        </span>
                        <span className="text-[11px] font-black">{alert.title}</span>
                      </div>
                      <p className="text-[9px] font-bold opacity-70 leading-relaxed">{alert.description}</p>
                    </div>
                    {alert.action && (
                      <button
                        onClick={() => onTabChange(alert.action!.tab)}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all active:scale-95 bg-white/80 border border-current/10 hover:bg-white shadow-sm"
                      >
                        {alert.action.label} →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 近期活动时间线 + 节点进度 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 近期活动 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-clock-rotate-left text-indigo-400 text-[10px]"></i>
                近期活动
              </h4>
              <span className="text-[8px] font-bold text-slate-300 uppercase">{recentActivities.length} 条</span>
            </div>
            <div className="space-y-0">
              {recentActivities.map((act, idx) => (
                <div key={act.id} className="flex items-start gap-3 relative group/act">
                  {/* 时间线 */}
                  <div className="flex flex-col items-center shrink-0 w-8">
                    <div className={`w-2.5 h-2.5 rounded-full border-2 z-10 ${
                      act.type === 'log'
                        ? 'bg-indigo-500 border-indigo-300'
                        : 'bg-violet-500 border-violet-300'
                    }`}></div>
                    {idx < recentActivities.length - 1 && (
                      <div className="w-px flex-1 bg-slate-100 min-h-[32px]"></div>
                    )}
                  </div>
                  {/* 内容 */}
                  <div className="flex-1 pb-4 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase border ${
                        act.type === 'log'
                          ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                          : 'bg-violet-50 text-violet-600 border-violet-100'
                      }`}>
                        {act.type === 'log' ? '实验' : '研报'}
                      </span>
                      <span className="text-[8px] font-bold text-slate-300">{fmtDate(act.timestamp)}</span>
                      {act.meta && (
                        <span className={`text-[7px] font-bold ${act.meta.includes('异常') ? 'text-rose-500' : act.meta.includes('成功') ? 'text-emerald-500' : 'text-slate-400'}`}>
                          {act.meta}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-slate-700 truncate">{act.title}</p>
                  </div>
                </div>
              ))}
              {recentActivities.length === 0 && (
                <div className="text-center py-8 opacity-30">
                  <i className="fa-solid fa-inbox text-3xl text-slate-300 mb-2"></i>
                  <p className="text-[10px] font-black text-slate-400 uppercase">暂无活动记录</p>
                </div>
              )}
            </div>
          </div>

          {/* 节点进度 */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-diagram-project text-indigo-400 text-[10px]"></i>
                节点实验进度
              </h4>
              <span className="text-[8px] font-bold text-slate-300 uppercase">{nodeProgress.length} 节点有数据</span>
            </div>
            <div className="space-y-3 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
              {nodeProgress.map(node => (
                <div key={node.id} className="flex items-center gap-3 group/node">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black text-slate-700 truncate max-w-[200px]">{node.title}</span>
                      <span className="text-[9px] font-bold text-slate-400 shrink-0">{node.success}/{node.total}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          node.pct >= 80 ? 'bg-emerald-500' : node.pct >= 50 ? 'bg-indigo-500' : node.pct >= 20 ? 'bg-amber-500' : 'bg-slate-300'
                        }`}
                        style={{ width: `${node.pct}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className={`text-[11px] font-black shrink-0 w-10 text-right ${
                    node.pct >= 80 ? 'text-emerald-600' : node.pct >= 50 ? 'text-indigo-600' : 'text-slate-400'
                  }`}>
                    {node.pct}%
                  </span>
                </div>
              ))}
              {nodeProgress.length === 0 && (
                <div className="text-center py-8 opacity-30">
                  <i className="fa-solid fa-flask-vial text-3xl text-slate-300 mb-2"></i>
                  <p className="text-[10px] font-black text-slate-400 uppercase">暂无实验数据</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectOverviewView;
