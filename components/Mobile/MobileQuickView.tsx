/**
 * MobileQuickView.tsx — 移动端快速查阅仪表板
 *
 * 移动端首页，提供文献速览、实验参数查阅、计划概览三合一。
 * 集成拍照卡片与语音助手入口。
 */
import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ResearchProject, ExperimentFile, ExperimentLog } from '../../types';
import { StructuredExperimentFromVoice } from '../../services/gemini/voiceTranscription';
import ExperimentCaptureCard from './ExperimentCaptureCard';
import VoiceLabAssistant from './VoiceLabAssistant';

interface MobileQuickViewProps {
  project: ResearchProject | null;
  literatures: any[];
  isLightMode: boolean;
  onUpdateProject: (project: ResearchProject) => void;
}

type QuickTab = 'tools' | 'literature' | 'experiments' | 'plans';

const MobileQuickView: React.FC<MobileQuickViewProps> = ({
  project, literatures, isLightMode, onUpdateProject
}) => {
  const [activeTab, setActiveTab] = useState<QuickTab>('tools');

  const bg = isLightMode ? 'bg-white' : 'bg-slate-950';
  const cardBg = isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-white/10';
  const textPrimary = isLightMode ? 'text-slate-800' : 'text-white';
  const textSecondary = isLightMode ? 'text-slate-500' : 'text-slate-400';

  // 最近实验日志
  const recentLogs = useMemo(() => {
    if (!project?.milestones) return [];
    return project.milestones
      .flatMap(m => m.logs.map(l => ({ ...l, milestoneName: m.title, milestoneId: m.id })))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }, [project]);

  // 当前周计划
  const currentPlan = useMemo(() => {
    if (!project?.weeklyPlans) return null;
    return project.weeklyPlans.find(p => p.status === 'in-progress') || project.weeklyPlans[0] || null;
  }, [project]);

  // 保存拍照到实验日志
  const handleSaveCapture = useCallback((photo: ExperimentFile, description: string) => {
    if (!project?.milestones?.length) return;
    const updated = { ...project };
    const latestMilestone = updated.milestones[updated.milestones.length - 1];
    const newLog: ExperimentLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      content: '📷 移动端实验拍照',
      description: description || '实验现场拍照记录',
      parameters: '',
      samplePhoto: photo,
      result: 'observation',
      status: 'Pending',
    };
    latestMilestone.logs = [...latestMilestone.logs, newLog];
    onUpdateProject(updated);
  }, [project, onUpdateProject]);

  // 保存语音日志
  const handleSaveVoiceLog = useCallback((data: StructuredExperimentFromVoice) => {
    if (!project?.milestones?.length) return;
    const updated = { ...project };
    const latestMilestone = updated.milestones[updated.milestones.length - 1];
    const newLog: ExperimentLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      content: data.content,
      description: data.description,
      parameters: data.parameters,
      parameterList: data.parameterList,
      result: data.result,
      status: 'Pending',
      aiInsight: data.observations,
    };
    latestMilestone.logs = [...latestMilestone.logs, newLog];
    onUpdateProject(updated);
  }, [project, onUpdateProject]);

  const tabs: { id: QuickTab; label: string; icon: string }[] = [
    { id: 'tools', label: '工具', icon: 'fa-toolbox' },
    { id: 'literature', label: '文献', icon: 'fa-book-open' },
    { id: 'experiments', label: '实验', icon: 'fa-flask' },
    { id: 'plans', label: '计划', icon: 'fa-calendar-check' },
  ];

  const getResultColor = (result: string) => {
    switch (result) {
      case 'success': return 'text-emerald-400 bg-emerald-500/10';
      case 'failure': return 'text-rose-400 bg-rose-500/10';
      case 'observation': return 'text-amber-400 bg-amber-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getResultLabel = (result: string) => {
    switch (result) {
      case 'success': return '成功';
      case 'failure': return '失败';
      case 'observation': return '观察';
      default: return '中性';
    }
  };

  return (
    <div className={`${bg} min-h-screen pb-24`}>
      {/* ─── 顶部标题 ─── */}
      <div className="px-5 pt-6 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.5rem)' }}>
        <h1 className={`text-xl font-black ${textPrimary}`}>
          {project?.title || 'SciFlow Pro'}
        </h1>
        <p className={`text-[10px] mt-1 ${textSecondary}`}>
          移动伴侣 · 实验助手
        </p>
      </div>

      {/* ─── Tab 切换 ─── */}
      <div className="px-5 mb-4">
        <div className={`flex rounded-2xl p-1 border ${isLightMode ? 'bg-slate-100 border-slate-200' : 'bg-white/5 border-white/10'}`}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg'
                  : isLightMode ? 'text-slate-500 hover:text-slate-700' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <i className={`fa-solid ${tab.icon} text-[9px]`} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 space-y-4">
        {/* ═══ 工具 Tab ═══ */}
        {activeTab === 'tools' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <ExperimentCaptureCard
              isLightMode={isLightMode}
              onSaveCapture={handleSaveCapture}
            />

            {/* 快速操作 */}
            <div className={`rounded-3xl border ${cardBg} p-5`}>
              <h3 className={`text-xs font-bold mb-3 ${textPrimary}`}>快速操作</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: 'fa-microphone', label: '语音记录', color: 'from-violet-500 to-indigo-600', desc: '底部按钮唤起' },
                  { icon: 'fa-clock-rotate-left', label: '最近日志', color: 'from-cyan-500 to-blue-600', desc: `${recentLogs.length} 条记录` },
                  { icon: 'fa-list-check', label: '今日任务', color: 'from-amber-500 to-orange-600', desc: `${currentPlan?.tasks?.filter(t => t.status === 'pending').length || 0} 项待完成` },
                  { icon: 'fa-chart-simple', label: '项目进度', color: 'from-emerald-500 to-teal-600', desc: `${project?.progress || 0}%` },
                ].map(item => (
                  <div
                    key={item.label}
                    className={`rounded-2xl p-4 border ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}
                  >
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-2 shadow-lg`}>
                      <i className={`fa-solid ${item.icon} text-white text-xs`} />
                    </div>
                    <p className={`text-[10px] font-bold ${textPrimary}`}>{item.label}</p>
                    <p className={`text-[9px] ${textSecondary}`}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ 文献 Tab ═══ */}
        {activeTab === 'literature' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {literatures.length === 0 ? (
              <div className="text-center py-12">
                <i className={`fa-solid fa-book-open text-3xl ${textSecondary} mb-3 block`} />
                <p className={`text-xs ${textSecondary}`}>暂无关联文献</p>
              </div>
            ) : (
              literatures.slice(0, 20).map((lit: any) => (
                <div key={lit.id} className={`rounded-2xl border p-4 ${cardBg}`}>
                  <h4 className={`text-xs font-bold leading-snug mb-1.5 line-clamp-2 ${textPrimary}`}>{lit.title}</h4>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[9px] ${textSecondary}`}>{lit.authors?.[0]|| 'Unknown'}</span>
                    {lit.year && <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isLightMode ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/10 text-indigo-400'}`}>{lit.year}</span>}
                    {lit.source && <span className={`text-[9px] ${textSecondary}`}>{lit.source}</span>}
                  </div>
                  {lit.abstract && (
                    <p className={`text-[10px] leading-relaxed line-clamp-3 ${textSecondary}`}>{lit.abstract}</p>
                  )}
                </div>
              ))
            )}
          </motion.div>
        )}

        {/* ═══ 实验 Tab ═══ */}
        {activeTab === 'experiments' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {recentLogs.length === 0 ? (
              <div className="text-center py-12">
                <i className={`fa-solid fa-flask text-3xl ${textSecondary} mb-3 block`} />
                <p className={`text-xs ${textSecondary}`}>暂无实验日志</p>
              </div>
            ) : (
              recentLogs.map((log: any) => (
                <div key={log.id} className={`rounded-2xl border p-4 ${cardBg}`}>
                  <div className="flex items-start justify-between mb-2">
                    <h4 className={`text-xs font-bold flex-1 ${textPrimary}`}>{log.content}</h4>
                    <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold shrink-0 ml-2 ${getResultColor(log.result)}`}>
                      {getResultLabel(log.result)}
                    </span>
                  </div>
                  <p className={`text-[10px] ${textSecondary} mb-2 line-clamp-2`}>{log.description}</p>
                  {/* 参数标签 */}
                  {log.parameterList?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {log.parameterList.slice(0, 4).map((p: any, i: number) => (
                        <span key={i} className={`text-[8px] px-2 py-0.5 rounded-full font-mono ${isLightMode ? 'bg-white border border-slate-200 text-slate-700' : 'bg-white/5 border border-white/10 text-slate-400'}`}>
                          {p.key}: {p.value}{p.unit}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <span className={`text-[9px] ${textSecondary}`}>
                      <i className="fa-solid fa-code-branch mr-1" />{log.milestoneName}
                    </span>
                    <span className={`text-[9px] ${textSecondary}`}>
                      {new Date(log.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}

        {/* ═══ 计划 Tab ═══ */}
        {activeTab === 'plans' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {!currentPlan ? (
              <div className="text-center py-12">
                <i className={`fa-solid fa-calendar text-3xl ${textSecondary} mb-3 block`} />
                <p className={`text-xs ${textSecondary}`}>暂无进行中的计划</p>
              </div>
            ) : (
              <>
                {/* 计划概览 */}
                <div className={`rounded-3xl border p-5 ${cardBg}`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-xs font-bold ${textPrimary}`}>当前计划</h3>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold">
                      {currentPlan.type === 'weekly' ? '周计划' : currentPlan.type === 'monthly' ? '月计划' : '年计划'}
                    </span>
                  </div>

                  {/* 进度条 */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-[9px] font-bold ${textSecondary}`}>完成进度</span>
                      <span className={`text-xs font-black ${textPrimary}`}>{currentPlan.completionRate}%</span>
                    </div>
                    <div className={`h-2 rounded-full overflow-hidden ${isLightMode ? 'bg-slate-200' : 'bg-white/10'}`}>
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                        style={{ width: `${currentPlan.completionRate}%` }}
                      />
                    </div>
                  </div>

                  {/* 目标列表 */}
                  {currentPlan.goals?.length > 0 && (
                    <div className="space-y-2">
                      <p className={`text-[9px] font-bold uppercase tracking-wider ${textSecondary}`}>目标</p>
                      {currentPlan.goals.map(goal => (
                        <div key={goal.id} className="flex items-center gap-2">
                          <i className={`fa-solid ${goal.completed ? 'fa-circle-check text-emerald-400' : 'fa-circle text-slate-500'} text-[10px]`} />
                          <span className={`text-[10px] ${goal.completed ? textSecondary + ' line-through' : textPrimary}`}>{goal.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 任务列表 */}
                <div className={`rounded-3xl border p-5 ${cardBg}`}>
                  <h3 className={`text-xs font-bold mb-3 ${textPrimary}`}>
                    任务 ({currentPlan.tasks?.filter(t => t.status === 'completed').length || 0}/{currentPlan.tasks?.length || 0})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {currentPlan.tasks?.map(task => (
                      <div key={task.id} className={`flex items-center gap-2.5 py-1.5 ${task.status === 'completed' ? 'opacity-50' : ''}`}>
                        <i className={`fa-solid ${task.status === 'completed' ? 'fa-circle-check text-emerald-400' : 'fa-circle text-slate-600'} text-xs`} />
                        <span className={`text-[10px] ${task.status === 'completed' ? textSecondary + ' line-through' : textPrimary}`}>{task.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* 语音助手 FAB */}
      <VoiceLabAssistant
        isLightMode={isLightMode}
        onSaveLog={handleSaveVoiceLog}
      />
    </div>
  );
};

export default React.memo(MobileQuickView);
