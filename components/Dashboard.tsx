import React, { useMemo, useState, useEffect } from 'react';
import { ResearchProject, Literature, AppView } from '../types';
import { useProjectContext } from '../context/ProjectContext';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip, PolarRadiusAxis } from 'recharts';
import { useTranslation } from '../locales/useTranslation';

// Sub-components
import StatsCards from './Dashboard/StatsCards';
import ProjectProgressChart from './Dashboard/ProjectProgressChart';
import ProjectInsights from './Dashboard/ProjectInsights';
import IndustrializationChart from './Dashboard/IndustrializationChart';
import MetricsRadar from './Dashboard/MetricsRadar';
import ActivityFeed, { ActivityItem } from './Dashboard/ActivityFeed';
import HealthScoreCard from './Dashboard/HealthScoreCard';
import MilestoneTimeline from './Dashboard/MilestoneTimeline';

interface DashboardProps {
  projects: ResearchProject[];
  resources: Literature[];
  navigate: (view: AppView, projectId?: string, subView?: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ projects = [], resources = [], navigate }) => {
  const { activeTheme, inventory, teamMembers } = useProjectContext();
  const { t } = useTranslation();
  const isLight = activeTheme.type === 'light';

  const [selectedRadarProjectId, setSelectedRadarProjectId] = useState<string>(projects[0]?.id || '');
  const [selectedInsightProjectId, setSelectedInsightProjectId] = useState<string>(projects[0]?.id || '');

  useEffect(() => {
    if (!selectedInsightProjectId && projects.length > 0) {
      setSelectedInsightProjectId(projects[0].id);
    }
    if (!selectedRadarProjectId && projects.length > 0) {
      setSelectedRadarProjectId(projects[0].id);
    }
  }, [projects, selectedInsightProjectId, selectedRadarProjectId]);

  const activeProjects = useMemo(() => (projects || []).filter(p => p.status === 'In Progress' || p.status === 'Planning'), [projects]);
  const totalMembers = (teamMembers || []).length;
  const lowStockCount = useMemo(() => (inventory || []).filter(i => i.category !== 'Hardware' && i.quantity <= i.threshold).length, [inventory]);

  const teamAggregatedExpertise = useMemo(() => {
    const dimensions = [
      t('dashboard.expertise.synthesis'),
      t('dashboard.expertise.characterization'),
      t('dashboard.expertise.theory'),
      t('dashboard.expertise.engineering'),
      t('dashboard.expertise.dataMining')
    ];
    return dimensions.map(dim => {
      const avg = (teamMembers || []).reduce((acc, m) => {
        const score = m.expertiseMetrics?.find(em => em.subject === dim)?.A || 0;
        return acc + score;
      }, 0) / (teamMembers?.length || 1);
      return { subject: dim, A: Math.round(avg), fullMark: 100 };
    });
  }, [teamMembers, t]);

  const industrializationData = useMemo(() => {
    const labels = {
      basic: t('dashboard.industrializationStages.basic') + ' (TRL 1-3)',
      validation: t('dashboard.industrializationStages.validation') + ' (TRL 4-6)',
      demo: t('dashboard.industrializationStages.demo') + ' (TRL 7-8)',
      industry: t('dashboard.industrializationStages.industry') + ' (TRL 9)'
    };
    
    const trlLevels = { [labels.basic]: 0, [labels.validation]: 0, [labels.demo]: 0, [labels.industry]: 0 };
    (projects || []).forEach(p => {
      if (p.trl <= 3) trlLevels[labels.basic]++;
      else if (p.trl <= 6) trlLevels[labels.validation]++;
      else if (p.trl <= 8) trlLevels[labels.demo]++;
      else trlLevels[labels.industry]++;
    });
    return [
      { name: t('dashboard.industrializationStages.basic'), value: trlLevels[labels.basic], color: '#6366f1' },
      { name: t('dashboard.industrializationStages.validation'), value: trlLevels[labels.validation], color: '#8b5cf6' },
      { name: t('dashboard.industrializationStages.demo'), value: trlLevels[labels.demo], color: '#10b981' },
      { name: t('dashboard.industrializationStages.industry'), value: trlLevels[labels.industry], color: '#f59e0b' }
    ].filter(d => d.value > 0);
  }, [projects, t]);

  const resourceCount = (resources || []).length;
  const stats = [
    { label: t('dashboard.activeProjects'), value: activeProjects.length.toString(), trend: activeProjects.length > 0 ? `${activeProjects.length}` : '—', color: 'indigo' },
    { label: t('dashboard.totalLiterature'), value: resourceCount.toString(), trend: resourceCount > 0 ? `+${resourceCount}` : '—', color: 'emerald' },
    { label: t('dashboard.teamMembers'), value: totalMembers.toString(), trend: totalMembers > 0 ? `${totalMembers}` : '—', color: 'amber' },
    { label: t('dashboard.tasksCompleted'), value: lowStockCount.toString(), trend: lowStockCount > 0 ? 'Urgent' : 'Safe', color: lowStockCount > 0 ? 'rose' : 'emerald' },
  ];

  const chartData = useMemo(() => (projects || []).map(p => ({
    id: p.id,
    name: (p.title || "").substring(0, 5) + '..',
    progress: p.progress
  })), [projects]);

  const activeRadarProject = useMemo(() => (projects || []).find(p => p.id === selectedRadarProjectId) || projects[0], [projects, selectedRadarProjectId]);

  const metricData = useMemo(() => {
    if (!activeRadarProject) return [];
    const targets = activeRadarProject.targetMetrics || [];
    let latestData: Record<string, number> = {};
    const milestones = activeRadarProject.milestones || [];
    const sortedMilestones = [...milestones].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
    for (const m of sortedMilestones) {
      const sortedLogs = [...(m.logs || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      for (const l of sortedLogs) {
        if (l.scientificData) {
          latestData = { ...l.scientificData, ...latestData };
        }
      }
    }

    if (targets.length === 0) {
      return [
        { subject: 'Overpotential', A: 81, actual: '310', target: '250', unit: 'mV' },
        { subject: 'Tafel Slope', A: 72, actual: '55.2', target: '40', unit: 'mV/dec' },
        { subject: 'ECSA', A: 56, actual: '45', target: '80', unit: 'cm²' },
        { subject: 'Mass Activity', A: 90, actual: '1200', target: '1000', unit: 'A/g' },
        { subject: 'Stability', A: 95, actual: '500', target: '480', unit: 'h' },
      ];
    }

    return targets.map(t => {
      const actualVal = latestData[t.label] || 0;
      const targetNum = parseFloat(t.value);
      let score = 50;
      if (targetNum) {
        if (t.isHigherBetter !== false) score = Math.min((actualVal / targetNum) * 100, 100);
        else score = Math.min((targetNum / (actualVal || targetNum * 2)) * 100, 100);
      }
      return {
        subject: t.label,
        A: score,
        actual: actualVal ? actualVal.toString() : '-',
        target: t.value,
        unit: t.unit || ''
      };
    });
  }, [activeRadarProject]);

  const globalInsight = useMemo(() => {
    const activeProject = (projects || []).find(p => p.id === selectedInsightProjectId) || activeProjects[0] || projects[0];
    if (!activeProject) return null;

    const activeWeek = (activeProject.weeklyPlans || []).find(w => w.status === 'in-progress');
    const milestones = activeProject.milestones || [];
    const activeNode = milestones.find(m => m.status === 'in-progress') || milestones[0];
    const allLogs = milestones.flatMap(m => m.logs || []);
    const latestLog = allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    const today = new Date();
    let todayIdx = -1;
    if (activeWeek) {
      const start = new Date(activeWeek.startDate);
      const end = new Date(activeWeek.endDate);
      const d_today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      if (d_today >= start && d_today <= end) {
        todayIdx = (today.getDay() + 6) % 7;
      }
    }

    return {
      projectTitle: activeProject.title,
      projectId: activeProject.id,
      weekProgress: activeWeek?.completionRate || 0,
      nodeTitle: activeNode?.title || t('dashboard.unnamedNode'),
      nodeHypothesis: activeNode?.hypothesis || t('dashboard.waitingHypothesis'),
      taskCount: (activeWeek?.tasks || []).length,
      pendingTasks: (activeWeek?.tasks || [])?.filter(t => t.status === 'pending').map(t => t.title) || [],
      todayTasks: (activeWeek?.tasks || [])?.filter(t => t.assignedDay === todayIdx && t.status === 'pending') || [],
      latestLog
    };
  }, [projects, selectedInsightProjectId, activeProjects, t]);

  const activities = useMemo((): ActivityItem[] => {
    const now = new Date();
    const relTime = (ts: string): string => {
      const diff = Math.max(0, now.getTime() - new Date(ts).getTime());
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return t('activities.justNow');
      if (mins < 60) return `${mins}${t('activities.minutes')}`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}${t('activities.hours')}`;
      return `${Math.floor(hrs / 24)}${t('activities.days')}`;
    };

    type RawEntry = { ts: number; item: ActivityItem };
    const raw: RawEntry[] = [];

    (projects || []).forEach(proj => {
      const projectLabel = (proj.title || '').substring(0, 12);
      (proj.milestones || []).forEach(ms => {
        (ms.logs || []).forEach(log => {
          const icon =
            log.linkedAnalysis ? 'fa-chart-bar' :
              log.result === 'success' ? 'fa-circle-check' :
                log.result === 'failure' ? 'fa-circle-xmark' :
                  'fa-flask';
          const action =
            log.result === 'success' ? `${t('activities.completedExperiment')}「${(log.content || '').substring(0, 14)}」` :
              log.result === 'failure' ? `${t('activities.recordedAnomaly')}「${(log.content || '').substring(0, 14)}」` :
                log.result === 'observation' ? `${t('activities.observed')}「${(log.content || '').substring(0, 16)}」` :
                  `${t('activities.recordedData')}「${(log.content || '').substring(0, 10)}」`;
          raw.push({
            ts: new Date(log.timestamp).getTime(),
            item: {
              user: projectLabel,
              action,
              text: relTime(log.timestamp),
              color: log.result === 'success' ? 'emerald' : log.result === 'failure' ? 'rose' : 'amber',
              icon,
              result: log.result,
              projectId: proj.id,
            }
          });
        });
      });
      // AI 报告
      (proj.weeklyReports || []).forEach(rep => {
        raw.push({
          ts: new Date(rep.timestamp).getTime(),
          item: {
            user: 'AI Assistant',
            action: `${t('activities.generatedReport')}「${(rep.title || '').substring(0, 18)}」`,
            text: relTime(rep.timestamp),
            color: 'indigo',
            icon: 'fa-robot',
            result: 'info',
            projectId: proj.id,
          }
        });
      });
    });

    if (raw.length === 0) {
      return [
        { user: 'Dr. Elena Vance', action: t('activities.demo.action1'), text: '1H', color: 'indigo', icon: 'fa-flask', result: 'success' },
        { user: 'Sarah Chen', action: t('activities.demo.action2'), text: '3H', color: 'emerald', icon: 'fa-chart-line', result: 'info' },
        { user: 'Dr. Marcus Miller', action: t('activities.demo.action3'), text: '5H', color: 'amber', icon: 'fa-shield-halved', result: 'neutral' },
        { user: 'AI Assistant', action: t('activities.demo.action4'), text: '1D', color: 'rose', icon: 'fa-robot', result: 'info' },
        { user: 'Elena Vance', action: t('activities.demo.action5'), text: '2D', color: 'indigo', icon: 'fa-book-open', result: 'info' },
      ];
    }

    return raw
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 12)
      .map(r => r.item);
  }, [projects, t]);

  return (
    <div className="h-full flex flex-col gap-4 animate-reveal overflow-y-auto lg:overflow-hidden px-2 custom-scrollbar">



      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0 items-stretch">
        <div className="lg:col-span-2">
          <MilestoneTimeline projects={projects || []} isLight={isLight} navigate={navigate} />
        </div>
        <div className="lg:col-span-1 grid grid-cols-2 gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className={`p-3.5 rounded-xl border transition-all hover:-translate-y-0.5 ${isLight ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-800/80 border-white/5 shadow-lg'}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-slate-50'}`}>{stat.label}</p>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${isLight ? `bg-${stat.color}-50 text-${stat.color}-600` : `bg-${stat.color}-900/40 text-${stat.color}-300`}`}>{stat.trend}</span>
                </div>
                <h3 className={`text-2xl font-black tracking-tighter ${isLight ? 'text-slate-800' : 'text-white'}`}>{stat.value}</h3>
              </div>
            ))}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
          <div className={`flex-[1.5] p-6 rounded-[2.5rem] flex flex-col min-h-0 border ${isLight ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-800/80 border-white/5 shadow-xl'}`}>
            <h4 className={`text-xs font-black mb-4 flex items-center justify-between shrink-0 ${isLight ? 'text-slate-800' : 'text-white'}`}>
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-flask-vial text-indigo-600"></i>
                {t('dashboard.researchProgress')}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('dashboard.weeklyOverview')}</span>
                <div className="relative group z-20">
                  <select
                    className="bg-transparent border-b border-dashed border-slate-300 text-[9px] font-black uppercase outline-none cursor-pointer transition-all pr-6 py-0.5 max-w-[150px] truncate"
                    value={selectedInsightProjectId}
                    onChange={(e) => setSelectedInsightProjectId(e.target.value)}
                  >
                    {(projects || []).map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  <i className="fa-solid fa-chevron-down text-[8px] absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                </div>
              </div>
            </h4>
            <div className="flex-1 flex flex-col lg:flex-row gap-8 min-h-0 overflow-hidden">
              <ProjectProgressChart data={chartData} isLight={isLight} navigate={navigate} />
              <ProjectInsights insight={globalInsight} navigate={navigate} />
            </div>
          </div>

          <div className="h-72 flex flex-col lg:flex-row gap-4 shrink-0 min-h-0">
            <IndustrializationChart data={industrializationData} totalProjects={projects?.length || 0} isLight={isLight} />
            <MetricsRadar
              projects={projects || []}
              selectedProjectId={selectedRadarProjectId}
              onProjectChange={setSelectedRadarProjectId}
              activeProject={activeRadarProject}
              metricData={metricData}
              isLight={isLight}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 min-h-0">
          <div className="flex-1 min-h-0 overflow-hidden">
            <ActivityFeed activities={activities} isLight={isLight} navigate={navigate} />
          </div>
          <div className="h-72 shrink-0">
            <HealthScoreCard
              projects={projects || []}
              resources={resources || []}
              isLight={isLight}
              navigate={navigate}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;