
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { ResearchProject, Milestone, PlannedExperiment, ExperimentLog, MatrixParameter, MatrixRun, AdvisorSession } from '../../../types';
import { Literature } from '../../../types/resources';
import { generateExperimentAdvice, AdvisorResult, AdvisorInput } from '../../../services/gemini/experimentAdvisor';
import { useProjectContext } from '../../../context/ProjectContext';
import { useTranslation } from '../../../locales/useTranslation';
import ScientificMarkdown from '../../Common/ScientificMarkdown';

/** 从 useProjectState 提升的工作状态类型 */
interface AdvisorWorkState {
  proposalText: string;
  uploadedPdf: { base64: string; mimeType: string; name: string } | null;
  selectedLitIds: string[];
  uploadedLitPdfs: { name: string; base64: string; mimeType: string }[];
  advisorResult: AdvisorResult | null;
  iterationHistory: { result: AdvisorResult; feedback?: string }[];
  userFeedback: string;
  isGenerating: boolean;
  activeSessionId: string | null;
}

interface ExperimentAdvisorViewProps {
  project: ResearchProject;
  selectedMilestone: Milestone | null;
  onUpdateProject: (updated: ResearchProject) => void;
  advisor: AdvisorWorkState;
  updateAdvisor: (updates: Partial<AdvisorWorkState>) => void;
  resetAdvisor: () => void;
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-rose-100', text: 'text-rose-700', label: '高' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-700', label: '中' },
  low: { bg: 'bg-slate-100', text: 'text-slate-600', label: '低' }
};

const TYPE_ICONS: Record<string, string> = {
  parameter: 'fa-sliders',
  methodology: 'fa-flask-vial',
  control: 'fa-gauge-high',
  safety: 'fa-shield-halved',
  characterization: 'fa-microscope'
};

const ExperimentAdvisorView: React.FC<ExperimentAdvisorViewProps> = ({
  project, selectedMilestone, onUpdateProject, advisor, updateAdvisor, resetAdvisor
}) => {
  const { t } = useTranslation();
  const { showToast, literatureItems = [] } = useProjectContext() as any;

  // ── 仅 UI 级的局部状态（无需持久化）──
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<number>>(new Set());
  const [showDoePreview, setShowDoePreview] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [litSearchQuery, setLitSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const litPdfInputRef = useRef<HTMLInputElement>(null);

  // ── 从提升的 state 解构 ──
  const {
    proposalText, uploadedPdf, selectedLitIds, uploadedLitPdfs,
    advisorResult, iterationHistory, userFeedback, isGenerating, activeSessionId
  } = advisor;

  // 项目文献
  const projectLiterature = useMemo(() => {
    const items: Literature[] = Array.isArray(literatureItems) ? literatureItems : [];
    return items.filter((l: Literature) => l.projectId === project.id);
  }, [literatureItems, project.id]);

  const filteredLiterature = useMemo(() => {
    if (!litSearchQuery.trim()) return projectLiterature;
    const q = litSearchQuery.toLowerCase();
    return projectLiterature.filter(l =>
      l.title.toLowerCase().includes(q) ||
      l.abstract?.toLowerCase().includes(q) ||
      l.authors?.some(a => a.toLowerCase().includes(q))
    );
  }, [projectLiterature, litSearchQuery]);

  // 存档列表
  const sessions = useMemo(() => project.advisorSessions || [], [project.advisorSessions]);

  // ── 文件上传处理 ──
  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.includes('pdf')) { showToast({ message: '仅支持 PDF 格式', type: 'error' }); return; }
    const reader = new FileReader();
    reader.onload = () => updateAdvisor({ uploadedPdf: { base64: (reader.result as string).split(',')[1], mimeType: file.type, name: file.name } });
    reader.readAsDataURL(file);
  };

  const handleLitPdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateAdvisor({ uploadedLitPdfs: [...uploadedLitPdfs, { name: file.name, base64: (reader.result as string).split(',')[1], mimeType: file.type }] });
    reader.readAsDataURL(file);
  };

  // ── AI 生成 ──
  const handleGenerate = useCallback(async () => {
    if (!proposalText.trim() && !uploadedPdf) { showToast({ message: '请输入实验方案或上传 PDF', type: 'error' }); return; }
    updateAdvisor({ isGenerating: true });
    try {
      const litContext = [
        ...selectedLitIds.map(id => { const lit = projectLiterature.find(l => l.id === id); return lit ? { title: lit.title, abstract: lit.abstract || '', year: lit.year } : null; }).filter(Boolean) as any[],
        ...uploadedLitPdfs.map(p => ({ title: p.name.replace('.pdf', ''), abstract: '[PDF 文件已上传]', year: new Date().getFullYear() }))
      ];
      const msCtx = selectedMilestone ? {
        title: selectedMilestone.title, hypothesis: selectedMilestone.hypothesis || '',
        logs: (selectedMilestone.logs || []).slice(-8).map(l => ({ content: l.content, parameters: l.parameters || '', scientificData: l.scientificData }))
      } : null;
      const prevAdvice = iterationHistory.length > 0
        ? `可行性: ${iterationHistory[iterationHistory.length - 1].result.feasibility.score}分\n建议: ${iterationHistory[iterationHistory.length - 1].result.suggestions.map((s: any) => s.title).join(', ')}`
        : undefined;

      const input: AdvisorInput = {
        proposalText: proposalText.trim(), proposalPdf: uploadedPdf || undefined,
        literatureContext: litContext, milestoneContext: msCtx, projectTitle: project.title,
        previousAdvice: prevAdvice, userFeedback: userFeedback.trim() || undefined
      };

      const result = await generateExperimentAdvice(input);
      const newHistory = iterationHistory.length > 0 || userFeedback.trim()
        ? [...iterationHistory, { result, feedback: userFeedback.trim() || undefined }]
        : [{ result }];
      updateAdvisor({ advisorResult: result, iterationHistory: newHistory, userFeedback: '', isGenerating: false });
      showToast({ message: `AI 分析完成！可行性评分: ${result.feasibility.score}/100`, type: 'success' });
    } catch (e: any) {
      updateAdvisor({ isGenerating: false });
      showToast({ message: `AI 分析失败: ${e?.message || '未知错误'}`, type: 'error' });
    }
  }, [proposalText, uploadedPdf, selectedLitIds, projectLiterature, selectedMilestone, project, iterationHistory, userFeedback, uploadedLitPdfs, showToast, updateAdvisor]);

  // ── 存档：保存当前会话 ──
  const handleSaveSession = useCallback(() => {
    if (!advisorResult) { showToast({ message: '请先生成 AI 建议后再存档', type: 'error' }); return; }
    const now = new Date().toISOString();
    const titleSnippet = proposalText.trim().substring(0, 30) || '未命名方案';

    if (activeSessionId) {
      // 更新已有存档
      const nextSessions = sessions.map(s => s.id === activeSessionId ? {
        ...s, updatedAt: now, proposalText, selectedLitIds,
        iterationCount: iterationHistory.length, lastResult: advisorResult, iterationHistory
      } : s);
      onUpdateProject({ ...project, advisorSessions: nextSessions });
      showToast({ message: '存档已更新', type: 'success' });
    } else {
      // 新建存档
      const newSession: AdvisorSession = {
        id: `adv_${Date.now()}`, title: titleSnippet, createdAt: now, updatedAt: now,
        proposalText, selectedLitIds, iterationCount: iterationHistory.length,
        lastResult: advisorResult, iterationHistory
      };
      onUpdateProject({ ...project, advisorSessions: [...sessions, newSession] });
      updateAdvisor({ activeSessionId: newSession.id });
      showToast({ message: '方案已存档', type: 'success' });
    }
  }, [advisorResult, proposalText, selectedLitIds, iterationHistory, activeSessionId, sessions, project, onUpdateProject, showToast, updateAdvisor]);

  // ── 存档：加载会话 ──
  const handleLoadSession = useCallback((session: AdvisorSession) => {
    updateAdvisor({
      proposalText: session.proposalText,
      selectedLitIds: session.selectedLitIds,
      advisorResult: session.lastResult,
      iterationHistory: session.iterationHistory,
      userFeedback: '',
      uploadedPdf: null,
      uploadedLitPdfs: [],
      isGenerating: false,
      activeSessionId: session.id
    });
    setShowLibrary(false);
    showToast({ message: `已加载「${session.title}」`, type: 'success' });
  }, [updateAdvisor, showToast]);

  // ── 存档：删除会话 ──
  const handleDeleteSession = useCallback((sessionId: string) => {
    const nextSessions = sessions.filter(s => s.id !== sessionId);
    onUpdateProject({ ...project, advisorSessions: nextSessions });
    if (activeSessionId === sessionId) updateAdvisor({ activeSessionId: null });
    showToast({ message: '存档已删除', type: 'success' });
  }, [sessions, project, onUpdateProject, activeSessionId, updateAdvisor, showToast]);

  // ── 新建空白会话 ──
  const handleNewSession = useCallback(() => {
    resetAdvisor();
    setShowLibrary(false);
  }, [resetAdvisor]);

  // ── 一键生成实验计划 ──
  const handleCreatePlans = useCallback(() => {
    if (!advisorResult?.recommendedDOE || !selectedMilestone) {
      showToast({ message: '请先生成 AI 建议并选择目标研究节点', type: 'error' }); return;
    }
    const doe = advisorResult.recommendedDOE;
    const planId = `plan_advisor_${Date.now()}`;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const baseTs = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const newPlan: PlannedExperiment = {
      id: planId, title: `[AI顾问] ${doe.title}`, status: 'planned', notes: doe.notes,
      parameters: {}, matrix: doe.matrix.map(m => ({ name: m.name, target: m.target, range: m.range })) as MatrixParameter[],
      runs: doe.runs.map(r => ({ idx: r.idx, label: r.label || `Run #${r.idx}`, params: r.params || {}, status: 'pending' as const })) as MatrixRun[],
      sourceType: 'doe_ai'
    };
    const groupId = `group_advisor_${Date.now()}`;
    const newLogs: ExperimentLog[] = doe.runs.map((run, idx) => {
      const parameterList = (run.fullParams || []).map(p => ({ key: p.key, value: p.value, unit: p.unit }));
      // ── 构建丰富的实验记录内容 ──
      const logTitle = `${run.sampleId ? `[${run.sampleId}] ` : ''}${run.label || `Run #${run.idx}`}`;

      // 详细描述：优先使用结构化步骤，否则回退到 description
      const steps = run.detailedSteps;
      let procedureSection = '';
      if (steps && steps.length > 0) {
        procedureSection = `📝 详细实验操作流程:\n\n${steps.map(s =>
          `**步骤 ${s.stepNumber}：${s.title} (${s.titleEn})**\n${s.content}${s.notes ? `\n> 💡 注：${s.notes}` : ''}`
        ).join('\n\n')}`;
      } else if (run.description) {
        procedureSection = `📝 详细实验操作流程:\n${run.description}`;
      }
      const paramSection = parameterList.length > 0
        ? `\n\n📋 关键参数快照 (PARAMS):\n${parameterList.map(p => `  • ${p.key}: ${p.value}${p.unit ? ' ' + p.unit : ''}`).join('\n')}`
        : '';
      const doeSection = `\n\n🔬 所属实验方案: ${doe.title}\n📊 方案设计说明: ${doe.notes}`;
      const fullDescription = `${procedureSection}${paramSection}${doeSection}`;

      // 格式化参数字符串（用于参数快照区展示）
      const paramString = parameterList.map(p => `${p.key}: ${p.value}${p.unit ? ' ' + p.unit : ''}`).join(' | ');

      return {
        id: `log_advisor_${Date.now()}_${idx}`, timestamp: `${baseTs}:${pad(idx)}`,
        content: logTitle, description: fullDescription,
        parameters: paramString || '参见详细描述',
        parameterList, scientificData: {}, files: [], result: 'neutral' as const, status: 'Pending' as const,
        sampleId: run.sampleId || '', groupId, groupLabel: doe.title,
        linkedPlanId: planId, linkedRunIdx: idx, planSnapshot: run.params || {}
      };
    });
    const nextMilestones = project.milestones.map(m =>
      m.id !== selectedMilestone.id ? m : { ...m, experimentalPlan: [newPlan, ...(m.experimentalPlan || [])], logs: [...(m.logs || []), ...newLogs] }
    );
    onUpdateProject({ ...project, milestones: nextMilestones });
    showToast({ message: `已生成 1 个实验计划 + ${newLogs.length} 条实验记录，挂载至「${selectedMilestone.title}」`, type: 'success' });
  }, [advisorResult, selectedMilestone, project, onUpdateProject, showToast]);

  const getScoreColor = (score: number) => {
    if (score >= 75) return { ring: 'stroke-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (score >= 50) return { ring: 'stroke-amber-500', text: 'text-amber-600', bg: 'bg-amber-50' };
    return { ring: 'stroke-rose-500', text: 'text-rose-600', bg: 'bg-rose-50' };
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden animate-reveal">
      {/* ═══ 标题栏 ═══ */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0">
        <div>
          <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
            <i className="fa-solid fa-wand-magic-sparkles text-teal-600"></i>
            AI 实验顾问
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 pl-10">
            EXPERIMENT ADVISOR · 智能实验设计优化
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 存档指示器 */}
          {activeSession && (
            <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200">
              <i className="fa-solid fa-bookmark text-indigo-500 text-[10px]"></i>
              <span className="text-[10px] font-bold text-indigo-700 max-w-[120px] truncate">{activeSession.title}</span>
            </div>
          )}
          {iterationHistory.length > 0 && (
            <div className="flex items-center gap-2 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200">
              <i className="fa-solid fa-arrows-spin text-teal-600 text-[10px]"></i>
              <span className="text-[10px] font-black text-teal-700">第 {iterationHistory.length} 轮</span>
            </div>
          )}
          {/* 存档操作按钮 */}
          {advisorResult && (
            <button onClick={handleSaveSession}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-1.5"
            >
              <i className="fa-solid fa-floppy-disk"></i>
              {activeSessionId ? '更新存档' : '保存存档'}
            </button>
          )}
          <button onClick={() => setShowLibrary(!showLibrary)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 border ${showLibrary ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-white border-slate-200 text-slate-600 hover:border-violet-300'}`}
          >
            <i className="fa-solid fa-folder-open"></i>
            存档库 {sessions.length > 0 && <span className="bg-violet-200 text-violet-700 px-1.5 rounded-full text-[8px] font-black">{sessions.length}</span>}
          </button>
          <button onClick={handleNewSession}
            className="px-3 py-1.5 bg-slate-100 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-lg text-[10px] font-bold text-slate-600 hover:text-teal-700 transition-all flex items-center gap-1.5"
          >
            <i className="fa-solid fa-plus"></i>新建
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0 px-6 pb-6 overflow-hidden">
        {/* ═══ 存档库侧边面板 ═══ */}
        {showLibrary && (
          <div className="w-[260px] shrink-0 bg-white rounded-2xl border-2 border-violet-100 p-4 shadow-sm flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-folder-open text-violet-500"></i>
                方案存档库
              </h4>
              <button onClick={() => setShowLibrary(false)} className="text-slate-400 hover:text-slate-600">
                <i className="fa-solid fa-times text-xs"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
              {sessions.length === 0 ? (
                <div className="text-center py-8">
                  <i className="fa-solid fa-inbox text-3xl text-slate-200 mb-3 block"></i>
                  <p className="text-[10px] text-slate-400">暂无存档方案</p>
                  <p className="text-[9px] text-slate-300 mt-1">生成 AI 建议后可保存存档</p>
                </div>
              ) : sessions.slice().reverse().map(session => (
                <div key={session.id}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all group ${session.id === activeSessionId ? 'bg-violet-50 border-violet-300 shadow-sm' : 'bg-white border-slate-100 hover:border-violet-200'}`}
                  onClick={() => handleLoadSession(session)}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <p className="text-[11px] font-bold text-slate-800 leading-snug line-clamp-2 flex-1 min-w-0">
                      {session.title}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all ml-2 shrink-0"
                    >
                      <i className="fa-solid fa-trash-can text-[9px]"></i>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {session.lastResult?.feasibility?.score != null && (
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${session.lastResult.feasibility.score >= 75 ? 'bg-emerald-100 text-emerald-600' : session.lastResult.feasibility.score >= 50 ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                        {session.lastResult.feasibility.score}分
                      </span>
                    )}
                    <span className="text-[8px] text-slate-400">{session.iterationCount} 轮迭代</span>
                  </div>
                  <p className="text-[8px] text-slate-300 mt-1.5">
                    {new Date(session.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ 左侧输入面板 ═══ */}
        <div className="w-[360px] shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
          {/* 方案输入 */}
          <div className="bg-white rounded-2xl border-2 border-slate-100 p-5 shadow-sm">
            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
              <i className="fa-solid fa-file-lines text-teal-500"></i>
              实验方案输入
            </h4>
            <textarea
              value={proposalText}
              onChange={e => updateAdvisor({ proposalText: e.target.value })}
              className="w-full h-40 bg-slate-50 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 resize-none focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
              placeholder="描述你的实验方案：目的、材料、初步设计思路……"
            />
            <div className="mt-3 flex items-center gap-3">
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl text-[10px] font-bold text-slate-600 hover:text-teal-700 transition-all"
              >
                <i className="fa-solid fa-file-pdf text-rose-400"></i>上传方案 PDF
              </button>
              {uploadedPdf && (
                <div className="flex items-center gap-2 bg-teal-50 px-3 py-1.5 rounded-lg flex-1 min-w-0">
                  <i className="fa-solid fa-check-circle text-teal-500 text-xs"></i>
                  <span className="text-[10px] font-bold text-teal-700 truncate">{uploadedPdf.name}</span>
                  <button onClick={() => updateAdvisor({ uploadedPdf: null })} className="ml-auto text-slate-400 hover:text-rose-500">
                    <i className="fa-solid fa-times text-[10px]"></i>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 文献选择器 */}
          <div className="bg-white rounded-2xl border-2 border-slate-100 p-5 shadow-sm">
            <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
              <i className="fa-solid fa-book-bookmark text-violet-500"></i>
              关联文献
              <span className="ml-auto text-[9px] font-bold text-slate-400">{selectedLitIds.length} 篇已选</span>
            </h4>
            <div className="flex gap-2 mb-3">
              <div className="flex-1 relative">
                <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                <input value={litSearchQuery} onChange={e => setLitSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium focus:outline-none focus:border-violet-300" placeholder="搜索项目文献..."
                />
              </div>
              <input ref={litPdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handleLitPdfUpload} />
              <button onClick={() => litPdfInputRef.current?.click()}
                className="px-3 py-2 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg text-[10px] font-bold text-violet-600 transition-all whitespace-nowrap"
              ><i className="fa-solid fa-plus mr-1"></i>新 PDF</button>
            </div>
            {uploadedLitPdfs.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {uploadedLitPdfs.map((pdf, i) => (
                  <div key={i} className="flex items-center gap-2 bg-violet-50 px-3 py-2 rounded-lg">
                    <i className="fa-solid fa-file-pdf text-violet-400 text-xs"></i>
                    <span className="text-[10px] font-bold text-violet-700 truncate flex-1">{pdf.name}</span>
                    <button onClick={() => updateAdvisor({ uploadedLitPdfs: uploadedLitPdfs.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-rose-500">
                      <i className="fa-solid fa-times text-[9px]"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
              {filteredLiterature.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic text-center py-4">
                  {projectLiterature.length === 0 ? '该课题暂无文献，可上传新 PDF' : '未找到匹配文献'}
                </p>
              ) : filteredLiterature.map(lit => {
                const isSelected = selectedLitIds.includes(lit.id);
                return (
                  <div key={lit.id}
                    onClick={() => updateAdvisor({ selectedLitIds: isSelected ? selectedLitIds.filter(id => id !== lit.id) : [...selectedLitIds, lit.id] })}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all border ${isSelected ? 'bg-violet-50 border-violet-300 shadow-sm' : 'bg-white border-slate-100 hover:border-violet-200'}`}
                  >
                    <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${isSelected ? 'bg-violet-600 border-violet-600' : 'border-slate-300'}`}>
                      {isSelected && <i className="fa-solid fa-check text-white text-[8px]"></i>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-slate-800 leading-snug line-clamp-2">{lit.title}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">{lit.authors?.slice(0, 2).join(', ') || ''} · {lit.year} · {lit.source}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 目标节点 */}
          {selectedMilestone && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">目标研究节点</p>
              <p className="text-sm font-bold text-slate-800">{selectedMilestone.title}</p>
              {selectedMilestone.hypothesis && <p className="text-[10px] text-slate-500 mt-1 italic line-clamp-2">{selectedMilestone.hypothesis}</p>}
              <p className="text-[9px] text-slate-400 mt-1">{selectedMilestone.logs?.length || 0} 条记录 · {selectedMilestone.experimentalPlan?.length || 0} 个计划</p>
            </div>
          )}

          {/* 生成按钮 */}
          <button onClick={handleGenerate}
            disabled={isGenerating || (!proposalText.trim() && !uploadedPdf)}
            className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${isGenerating ? 'bg-slate-300 text-slate-500 cursor-wait' : 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700'}`}
          >
            {isGenerating ? (<><i className="fa-solid fa-spinner fa-spin"></i>AI 深度分析中…</>) :
              iterationHistory.length > 0 ? (<><i className="fa-solid fa-arrows-spin"></i>重新评估</>) :
                (<><i className="fa-solid fa-wand-magic-sparkles"></i>生成 AI 实验建议</>)}
          </button>
        </div>

        {/* ═══ 右侧结果面板 ═══ */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
          {!advisorResult ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-teal-100 to-emerald-100 flex items-center justify-center">
                  <i className="fa-solid fa-flask-vial text-4xl text-teal-500"></i>
                </div>
                <h4 className="text-lg font-black text-slate-700 mb-2">智能实验顾问</h4>
                <p className="text-sm text-slate-500 leading-relaxed">
                  在左侧输入你的实验方案，选择相关文献，<br/>
                  AI 将综合分析并生成<strong>可行性评估</strong>、<strong>改进建议</strong>和<strong>推荐实验设计</strong>。
                </p>
                <div className="flex justify-center gap-4 mt-6">
                  {[{ icon: 'fa-chart-simple', label: '可行性评估' }, { icon: 'fa-lightbulb', label: '改进建议' }, { icon: 'fa-table-cells', label: '实验方案' }, { icon: 'fa-arrows-spin', label: '多轮迭代' }].map((f, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center"><i className={`fa-solid ${f.icon} text-teal-500`}></i></div>
                      <span className="text-[9px] font-bold text-slate-400">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* 可行性评分卡 */}
              <div className={`rounded-2xl border-2 p-6 shadow-sm ${getScoreColor(advisorResult.feasibility.score).bg} border-white`}>
                <div className="flex items-start gap-6">
                  <div className="relative w-24 h-24 shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none" className={getScoreColor(advisorResult.feasibility.score).ring} strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${(advisorResult.feasibility.score / 100) * 264} 264`} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-2xl font-black ${getScoreColor(advisorResult.feasibility.score).text}`}>{advisorResult.feasibility.score}</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase">SCORE</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-3">可行性评估</h4>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {advisorResult.feasibility.strengths.map((s: string, i: number) => (
                        <span key={i} className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg">✓ {s}</span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {advisorResult.feasibility.risks.map((r: string, i: number) => (
                        <span key={i} className="px-2.5 py-1 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-lg">⚠ {r}</span>
                      ))}
                    </div>
                    {advisorResult.feasibility.safetyWarnings.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {advisorResult.feasibility.safetyWarnings.map((w: string, i: number) => (
                          <span key={i} className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-lg">🛡 {w}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 改进建议列表 */}
              <div className="bg-white rounded-2xl border-2 border-slate-100 p-5 shadow-sm">
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-lightbulb text-amber-500"></i>改进建议
                  <span className="ml-auto text-[9px] font-bold text-slate-400">{advisorResult.suggestions.length} 条</span>
                </h4>
                <div className="space-y-3">
                  {advisorResult.suggestions
                    .sort((a: any, b: any) => ({ high: 0, medium: 1, low: 2 }[a.priority as string] || 1) - ({ high: 0, medium: 1, low: 2 }[b.priority as string] || 1))
                    .map((s: any, i: number) => {
                      const isExpanded = expandedSuggestions.has(i);
                      const pStyle = PRIORITY_STYLES[s.priority] || PRIORITY_STYLES.medium;
                      return (
                        <div key={i} className="border border-slate-100 rounded-xl overflow-hidden hover:border-slate-200 transition-all">
                          <div onClick={() => setExpandedSuggestions(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next; })}
                            className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-slate-50 transition-colors">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                              <i className={`fa-solid ${TYPE_ICONS[s.type] || 'fa-flask'} text-slate-500 text-xs`}></i>
                            </div>
                            <div className="flex-1 min-w-0"><p className="text-[12px] font-bold text-slate-800">{s.title}</p><p className="text-[9px] text-slate-400 mt-0.5">{s.type.toUpperCase()}</p></div>
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${pStyle.bg} ${pStyle.text}`}>{pStyle.label}</span>
                            <i className={`fa-solid fa-chevron-down text-slate-300 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
                          </div>
                          {isExpanded && (
                            <div className="px-4 pb-4 border-t border-slate-50">
                              <div className="mt-3 text-[11px] text-slate-700 leading-relaxed"><ScientificMarkdown content={s.detail} /></div>
                              {s.evidence && (
                                <div className="mt-3 p-2.5 bg-indigo-50 rounded-lg">
                                  <p className="text-[9px] font-black text-indigo-400 uppercase mb-1">文献依据</p>
                                  <p className="text-[10px] text-indigo-700 leading-relaxed">{s.evidence}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* 推荐实验方案 */}
              {advisorResult.recommendedDOE && (
                <div className="bg-white rounded-2xl border-2 border-teal-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <i className="fa-solid fa-table-cells text-teal-500"></i>推荐实验方案
                    </h4>
                    <div className="flex gap-2">
                      <button onClick={() => setShowDoePreview(!showDoePreview)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-600 transition-all">
                        <i className={`fa-solid ${showDoePreview ? 'fa-chevron-up' : 'fa-table'} mr-1`}></i>{showDoePreview ? '收起' : '展开'}
                      </button>
                      <button onClick={handleCreatePlans} disabled={!selectedMilestone}
                        className="px-4 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-lg text-[10px] font-black uppercase shadow-md hover:from-teal-700 hover:to-emerald-700 transition-all active:scale-95 disabled:opacity-50">
                        <i className="fa-solid fa-wand-magic-sparkles mr-1"></i>生成实验计划
                      </button>
                    </div>
                  </div>
                  <div className="bg-teal-50 rounded-xl p-3 mb-3">
                    <p className="text-sm font-bold text-slate-800">{advisorResult.recommendedDOE.title}</p>
                    <p className="text-[10px] text-slate-600 mt-1">{advisorResult.recommendedDOE.notes}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {advisorResult.recommendedDOE.matrix.map((m: any, i: number) => (
                      <div key={i} className="px-3 py-1.5 bg-white border border-teal-200 rounded-lg">
                        <span className="text-[10px] font-bold text-teal-700">{m.name}</span>
                        <span className="text-[9px] text-slate-400 ml-1.5">{m.range} {m.target}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] font-bold text-slate-500">共 {advisorResult.recommendedDOE.runs.length} 组 · {advisorResult.recommendedDOE.matrix.length} 个因子</p>
                  {showDoePreview && (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-[10px]">
                        <thead><tr className="bg-slate-100">
                          <th className="px-3 py-2 text-left font-black text-slate-600 uppercase">#</th>
                          <th className="px-3 py-2 text-left font-black text-slate-600 uppercase">标签</th>
                          {advisorResult.recommendedDOE.matrix.map((m: any, i: number) => (<th key={i} className="px-3 py-2 text-left font-black text-teal-600 uppercase">{m.name}</th>))}
                          <th className="px-3 py-2 text-left font-black text-slate-600 uppercase">操作说明</th>
                        </tr></thead>
                        <tbody>
                          {advisorResult.recommendedDOE.runs.map((run: any, i: number) => (
                            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                              <td className="px-3 py-2 font-mono font-bold text-slate-400">{run.idx}</td>
                              <td className="px-3 py-2 font-bold text-slate-700">{run.label}</td>
                              {advisorResult.recommendedDOE!.matrix.map((m: any, j: number) => (<td key={j} className="px-3 py-2 font-mono text-slate-600">{run.params?.[m.name] || '-'}</td>))}
                              <td className="px-3 py-2 text-slate-500 max-w-[200px] truncate" title={run.description}>{run.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 文献对照分析 */}
              <div className="bg-white rounded-2xl border-2 border-slate-100 p-5 shadow-sm">
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-book-open text-indigo-500"></i>文献对照分析
                </h4>
                <p className="text-[11px] text-slate-700 leading-relaxed mb-3">{advisorResult.literatureComparison.summary}</p>
                {advisorResult.literatureComparison.gaps.length > 0 && (
                  <div className="mb-3"><p className="text-[9px] font-black text-rose-500 uppercase mb-1.5">方案未覆盖</p>
                    <div className="flex flex-wrap gap-1.5">{advisorResult.literatureComparison.gaps.map((g: string, i: number) => (<span key={i} className="px-2.5 py-1 bg-rose-50 text-rose-600 text-[10px] font-bold rounded-lg border border-rose-100">{g}</span>))}</div>
                  </div>
                )}
                {advisorResult.literatureComparison.advantages.length > 0 && (
                  <div><p className="text-[9px] font-black text-emerald-500 uppercase mb-1.5">方案创新点</p>
                    <div className="flex flex-wrap gap-1.5">{advisorResult.literatureComparison.advantages.map((a: string, i: number) => (<span key={i} className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-lg border border-emerald-100">{a}</span>))}</div>
                  </div>
                )}
              </div>

              {/* 迭代优化区 */}
              <div className="bg-gradient-to-r from-slate-50 to-teal-50 rounded-2xl border-2 border-teal-100 p-5 shadow-sm">
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-arrows-spin text-teal-500"></i>多轮迭代优化
                </h4>
                {advisorResult.iterationNote && (
                  <div className="mb-3 p-3 bg-white rounded-xl border border-teal-200">
                    <p className="text-[9px] font-black text-teal-500 uppercase mb-1">本轮调整总结</p>
                    <p className="text-[10px] text-slate-700 leading-relaxed">{advisorResult.iterationNote}</p>
                  </div>
                )}
                <textarea value={userFeedback} onChange={e => updateAdvisor({ userFeedback: e.target.value })}
                  className="w-full h-24 bg-white rounded-xl border border-teal-200 p-3 text-sm text-slate-700 resize-none focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
                  placeholder="输入你的反馈或修改意见（例如：温度范围建议提高到 200-250°C、需要增加 N2 保护气氛……）"
                />
                <div className="flex justify-between items-center mt-3">
                  <p className="text-[9px] text-slate-400 italic">AI 会在上一轮建议基础上进行改进</p>
                  <button onClick={handleGenerate} disabled={isGenerating || !userFeedback.trim()}
                    className="px-5 py-2.5 bg-teal-600 text-white rounded-xl text-[11px] font-black uppercase shadow-md hover:bg-teal-700 transition-all active:scale-95 disabled:opacity-50">
                    <i className="fa-solid fa-paper-plane mr-1.5"></i>提交反馈并重新评估
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExperimentAdvisorView;
