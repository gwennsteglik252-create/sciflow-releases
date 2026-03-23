import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DOEFactor, DOEResponse, SavedDOE, ResearchProject, PlannedExperiment, AppView, DoeSession } from '../../types';
import { L9_MATRIX, L4_MATRIX, ANCHOR_MATRIX, IntensityMode } from './constants';
import { useProjectContext } from '../../context/ProjectContext';
import { useTranslation } from '../../locales';

interface UseDOEManagerProps {
  projects: ResearchProject[];
  onUpdateProject: (updated: ResearchProject) => void;
  navigate: (view: AppView, projectId?: string, subView?: string) => void;
}

export const useDOEManager = ({ projects, onUpdateProject, navigate }: UseDOEManagerProps) => {
  const { t } = useTranslation();
  const { doeSession, updateDoeSession, runDoeInference, activeTasks, showToast } = useProjectContext();
  const { factors, responses, processDescription, history, isCalculating, suggestion, loadedArchiveId } = doeSession;

  // Local UI-only state
  const [savedResults, setSavedResults] = useState<SavedDOE[]>([]);
  const [customTemplates, setCustomTemplates] = useState<any[]>(() => {
    try {
        const saved = localStorage.getItem('sciflow_doe_user_templates');
        return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  });

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAddHistory, setShowAddHistory] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  // Add missing isBatchSync state
  const [isBatchSync, setIsBatchSync] = useState(false); 
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showArchiveDropdown, setShowArchiveDropdown] = useState(false);
  const [showOEDModal, setShowOEDModal] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ show: boolean, title: string, desc: string, onConfirm: () => void } | null>(null);

  const [intensityMode, setIntensityMode] = useState<IntensityMode>('standard');
  const [oedResults, setOedResults] = useState<Record<number, string>>({});
  const [oedFactorOverrides, setOedFactorOverrides] = useState<Record<string, string>>({});
  const [newTemplateTitle, setNewTemplateTitle] = useState(t('doeAssistant.manager.defaultTemplateName'));
  const [targetProjectId, setTargetProjectId] = useState('');
  const [targetMilestoneId, setTargetMilestoneId] = useState('');
  const [saveTitle, setSaveTitle] = useState('');
  const [newRunFactors, setNewRunFactors] = useState<Record<string, number>>({});
  const [newRunResponses, setNewRunResponses] = useState<Record<string, number>>({});
  
  // Fix: Add missing selectedRecommendationIdx state to track multi-recommendation selection in UI
  const [selectedRecommendationIdx, setSelectedRecommendationIdx] = useState<number>(0);

  useEffect(() => {
    try {
      const local = localStorage.getItem('sciflow_doe_v2_archives');
      if (local) setSavedResults(JSON.parse(local));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('sciflow_doe_user_templates', JSON.stringify(customTemplates));
    } catch (e) { console.error(e); }
  }, [customTemplates]);

  const handleCalculate = async () => {
    await runDoeInference();
  };

  const handleLoadSampleCase = () => {
    // Fix: Updated sample data to include multiple recommendations to match UI expectation
    const sampleData = {
        factors: [
            { name: '反应温度', unit: '°C', min: 120, max: 180 },
            { name: '前驱体浓度', unit: 'mM', min: 10, max: 50 },
            { name: 'PVP添加量', unit: 'mg', min: 5, max: 20 }
        ],
        responses: [
            { name: '合成收率', unit: '%', goal: 'maximize' as const, weight: 8 }
        ],
        processDescription: '针对 Ag 纳米线的多元醇法合成工艺优化。',
        history: [
            { factors: { [t('doeAssistant.manager.sample.temp')]: 120, [t('doeAssistant.manager.sample.conc')]: 10, [t('doeAssistant.manager.sample.pvp')]: 5 }, responses: { [t('doeAssistant.manager.sample.yield')]: 42.5 } },
            { factors: { [t('doeAssistant.manager.sample.temp')]: 120, [t('doeAssistant.manager.sample.conc')]: 50, [t('doeAssistant.manager.sample.pvp')]: 20 }, responses: { [t('doeAssistant.manager.sample.yield')]: 38.2 } },
            { factors: { [t('doeAssistant.manager.sample.temp')]: 180, [t('doeAssistant.manager.sample.conc')]: 10, [t('doeAssistant.manager.sample.pvp')]: 20 }, responses: { [t('doeAssistant.manager.sample.yield')]: 85.6 } },
            { factors: { [t('doeAssistant.manager.sample.temp')]: 180, [t('doeAssistant.manager.sample.conc')]: 50, [t('doeAssistant.manager.sample.pvp')]: 5 }, responses: { [t('doeAssistant.manager.sample.yield')]: 72.1 } }
        ],
        suggestion: {
            recommendations: [
                { 
                    label: t('doeAssistant.suggestionPanel.labels.aggressive'), 
                    params: { [t('doeAssistant.manager.sample.temp')]: 185, [t('doeAssistant.manager.sample.conc')]: 5, [t('doeAssistant.manager.sample.pvp')]: 25 },
                    expectedOutcome: t('doeAssistant.manager.sample.aggressiveOutcome'),
                    confidenceScore: 78,
                    predictedValue: 92.4,
                    ciLower: 89.0,
                    ciUpper: 95.8
                },
                { 
                    label: t('doeAssistant.suggestionPanel.labels.robust'), 
                    params: { [t('doeAssistant.manager.sample.temp')]: 175, [t('doeAssistant.manager.sample.conc')]: 12, [t('doeAssistant.manager.sample.pvp')]: 18 },
                    expectedOutcome: t('doeAssistant.manager.sample.robustOutcome'),
                    confidenceScore: 92,
                    predictedValue: 85.2,
                    ciLower: 83.1,
                    ciUpper: 87.3
                },
                { 
                    label: t('doeAssistant.suggestionPanel.labels.explorer'), 
                    params: { [t('doeAssistant.manager.sample.temp')]: 140, [t('doeAssistant.manager.sample.conc')]: 30, [t('doeAssistant.manager.sample.pvp')]: 12 },
                    expectedOutcome: t('doeAssistant.manager.sample.explorerOutcome'),
                    confidenceScore: 65,
                    predictedValue: 55.0,
                    ciLower: 45.0,
                    ciUpper: 65.0
                }
            ],
            reasoning: t('doeAssistant.manager.sample.reasoning'),
            report: {
                analysisSummary: t('doeAssistant.manager.sample.summary'),
                factorSensitivity: [
                    {
                        factor: t('doeAssistant.manager.sample.temp'),
                        importance: "high" as const,
                        effect: t('doeAssistant.suggestionPanel.effect.positive'),
                        description: t('doeAssistant.manager.sample.tempDesc'),
                        optimalRange: "170-190°C",
                        currentCoverage: 75
                    },
                    {
                        factor: t('doeAssistant.manager.sample.conc'),
                        importance: "medium" as const,
                        effect: t('doeAssistant.suggestionPanel.effect.negative'),
                        description: t('doeAssistant.manager.sample.concDesc'),
                        optimalRange: "5-15 mM",
                        currentCoverage: 60
                    },
                    {
                        factor: t('doeAssistant.manager.sample.pvp'),
                        importance: "medium" as const,
                        effect: t('doeAssistant.suggestionPanel.effect.positive'),
                        description: t('doeAssistant.manager.sample.pvpDesc'),
                        optimalRange: "15-25 mg",
                        currentCoverage: 55
                    }
                ],
                interactions: [
                    {
                        factors: [t('doeAssistant.manager.sample.temp'), t('doeAssistant.manager.sample.pvp')],
                        type: t('doeAssistant.suggestionPanel.interactionType.synergy'),
                        strength: "strong" as const,
                        description: t('doeAssistant.manager.sample.intTV')
                    },
                    {
                        factors: [t('doeAssistant.manager.sample.temp'), t('doeAssistant.manager.sample.conc')],
                        type: t('doeAssistant.suggestionPanel.interactionType.antagonism'),
                        strength: "moderate" as const,
                        description: t('doeAssistant.manager.sample.intTC')
                    },
                    {
                        factors: [t('doeAssistant.manager.sample.conc'), t('doeAssistant.manager.sample.pvp')],
                        type: t('doeAssistant.suggestionPanel.interactionType.neutral'),
                        strength: "weak" as const,
                        description: t('doeAssistant.manager.sample.intCP')
                    }
                ],
                optimizationInsights: [
                    t('doeAssistant.manager.sample.insight1'),
                    t('doeAssistant.manager.sample.insight2'),
                    t('doeAssistant.manager.sample.insight3'),
                    t('doeAssistant.manager.sample.insight4')
                ],
                processWindow: {
                    feasibilityScore: 72,
                    description: t('doeAssistant.manager.sample.pwDesc'),
                    constraints: [
                        t('doeAssistant.manager.sample.constr1'),
                        t('doeAssistant.manager.sample.constr2'),
                        t('doeAssistant.manager.sample.constr3')
                    ]
                },
                riskWarnings: [
                    {
                        level: "medium" as const,
                        title: t('doeAssistant.manager.sample.risk1Title'),
                        description: t('doeAssistant.manager.sample.risk1Desc')
                    },
                    {
                        level: "low" as const,
                        title: t('doeAssistant.manager.sample.risk2Title'),
                        description: t('doeAssistant.manager.sample.risk2Desc')
                    },
                    {
                        level: "high" as const,
                        title: t('doeAssistant.manager.sample.risk3Title'),
                        description: t('doeAssistant.manager.sample.risk3Desc')
                    }
                ],
                nextSteps: [
                    t('doeAssistant.manager.sample.step1'),
                    t('doeAssistant.manager.sample.step2'),
                    t('doeAssistant.manager.sample.step3'),
                    t('doeAssistant.manager.sample.step4')
                ],
                dataQuality: {
                    totalExperiments: 4,
                    coverageScore: 45,
                    balanceScore: 60,
                    suggestion: t('doeAssistant.manager.sample.dqSug')
                }
            },
            diagnostics: []
        }
    };
    updateDoeSession(sampleData);
    showToast({ message: t('doeAssistant.manager.toast.loadSampleSuccess'), type: 'info' });
  };

  // --- 核心：智能命名工具函数 ---
  const generateIntelligentTitle = useCallback((baseLabel: string) => {
    const dateStr = new Date().toLocaleDateString();
    
    let coreSubject = "";
    const subjectMatch = processDescription.match(/(?:针对|关于|优化|研究|制备|Targeting|Concerning|Optimizing|Study|Research|Preparing)\s*([A-Za-z0-9\u4e00-\u9fa5]+)/i);
    // Fix: Fixed typo where subjectSubject was used instead of subjectMatch[1]
    if (subjectMatch && subjectMatch[1]) {
        coreSubject = subjectMatch[1].substring(0, 10);
    }

    let factorContext = "";
    const validFactors = factors.filter(f => f.name && f.name.trim() !== "");
    if (validFactors.length > 0) {
        factorContext = validFactors
          .slice(0, 2)
          .map(f => f.name)
          .join('/');
    }

    let finalPrefix = "";
    if (coreSubject && factorContext) {
        finalPrefix = `[${coreSubject}/${factorContext}] `;
    } else if (coreSubject || factorContext) {
        finalPrefix = `[${coreSubject || factorContext}] `;
    }

    return finalPrefix 
        ? `${finalPrefix}${baseLabel}_${dateStr}` 
        : `${t('doeAssistant.manager.defaultBaseLabel')}${baseLabel}_${dateStr}`;
  }, [processDescription, factors, t]);

  const handleSaveAsTemplate = () => {
    if (!newTemplateTitle.trim()) return;
    const newTemplate = { id: Date.now().toString(), title: newTemplateTitle, factors: [...factors], responses: [...responses], processDescription };
    setCustomTemplates(prev => [...prev, newTemplate]);
    setShowSaveTemplateModal(false);
    setNewTemplateTitle(t('doeAssistant.manager.defaultTemplateName'));
  };

  const loadTemplate = (tpl: any) => {
    updateDoeSession({ factors: tpl.factors || [], responses: tpl.responses || [], processDescription: tpl.processDescription || '' });
  };

  const deleteTemplate = (id: string) => {
    setConfirmModal({
        show: true,
        title: t('doeAssistant.manager.confirm.deleteTemplateTitle'),
        desc: t('doeAssistant.manager.confirm.deleteTemplateDesc'),
        onConfirm: () => {
            setCustomTemplates(prev => prev.filter(t => t.id !== id));
            setConfirmModal(null);
        }
    });
  };

  const handleSaveResult = () => {
    if (!suggestion || !saveTitle.trim()) return null;
    const doeSessionSnapshot: any = { factors: [...factors], responses: [...responses], history: [...history], processDescription, suggestion, loadedArchiveId: null };
    const newArchive: SavedDOE = {
      id: Date.now().toString(), title: saveTitle, timestamp: new Date().toLocaleString(),
      sessionData: doeSessionSnapshot
    };
    const updated = [newArchive, ...savedResults];
    setSavedResults(updated);
    localStorage.setItem('sciflow_doe_v2_archives', JSON.stringify(updated));
    updateDoeSession({ loadedArchiveId: newArchive.id });
    setShowSaveModal(false);
    setSaveTitle('');
    return newArchive;
  };

  const loadArchive = (archive: SavedDOE) => {
    const sd = archive.sessionData;
    if (sd) {
      updateDoeSession({ ...sd, loadedArchiveId: archive.id });
    } else {
      // 向后兼容旧格式
      updateDoeSession({
        factors: archive.factors || [],
        responses: archive.responses || [],
        history: archive.history || [],
        processDescription: archive.processDescription || '',
        suggestion: archive.suggestion || null,
        loadedArchiveId: archive.id
      });
    }
    setShowArchiveDropdown(false);
  };

  const handleDeleteArchive = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setConfirmModal({
        show: true,
        title: t('doeAssistant.manager.confirm.deleteArchiveTitle'),
        desc: t('doeAssistant.manager.confirm.deleteArchiveDesc'),
        onConfirm: () => {
            const updated = savedResults.filter(r => r.id !== id);
            setSavedResults(updated);
            localStorage.setItem('sciflow_doe_v2_archives', JSON.stringify(updated));
            if (loadedArchiveId === id) updateDoeSession({ suggestion: null, loadedArchiveId: null });
            setConfirmModal(null);
        }
    });
  };

  const handleSyncToProject = () => {
    if (!targetProjectId || !targetMilestoneId || !suggestion) return;
    const project = projects.find(p => p.id === targetProjectId);
    if (!project) return;
    
    // Fix: Updated handleSyncToProject to support both single recommendation and batch sync modes
    const recs = suggestion.recommendations || [];
    
    if (isBatchSync) {
        let currentArchiveId = loadedArchiveId;
        let archiveTitle = savedResults.find(r => r.id === loadedArchiveId)?.title;

        if (!currentArchiveId) {
            const autoTitle = generateIntelligentTitle("批量方案推演");
            const doeSnap: any = { factors: [...factors], responses: [...responses], history: [...history], processDescription, suggestion, loadedArchiveId: null };
            const newArchive: SavedDOE = {
                id: Date.now().toString(), 
                title: autoTitle, 
                timestamp: new Date().toLocaleString(),
                sessionData: doeSnap
            };
            const updatedArchives = [newArchive, ...savedResults];
            setSavedResults(updatedArchives);
            localStorage.setItem('sciflow_doe_v2_archives', JSON.stringify(updatedArchives));
            currentArchiveId = newArchive.id;
            archiveTitle = autoTitle;
            updateDoeSession({ loadedArchiveId: currentArchiveId });
        }

        const newPlans: PlannedExperiment[] = recs.map((rec: any, rIdx: number) => {
            const paramSummary = Object.entries(rec.params)
                .map(([k, v]) => `${k}:${v}${factors.find(f => f.name === k)?.unit || ''}`)
                .join(', ');

            return {
                id: (Date.now() + rIdx).toString(),
                title: `[${rec.label}] ${archiveTitle} (${paramSummary})`,
                status: 'planned',
                notes: `[DOE 方案类型]: ${rec.label}\n[预期目标]: ${rec.expectedOutcome || '验证物理模型'}\n[结论摘要]: ${suggestion.reasoning.substring(0, 150)}...`,
                parameters: {},
                matrix: Object.entries(rec.params).map(([k, v]) => {
                    const matchedFactor = factors.find(f => f.name === k);
                    return { name: k, range: String(v), target: matchedFactor?.unit || '' };
                }),
                sourceType: 'doe_ai',
                sourceProposalId: currentArchiveId || undefined
            };
        });

        const updatedMilestones = project.milestones.map(m => 
            m.id === targetMilestoneId ? { ...m, experimentalPlan: [...(m.experimentalPlan || []), ...newPlans] } : m
        );
        onUpdateProject({ ...project, milestones: updatedMilestones });
        showToast({ message: t('doeAssistant.manager.toast.batchSyncSuccess', { project: project.title }), type: 'success' });
    } else {
        const targetRec = recs[selectedRecommendationIdx] || (suggestion.nextExperiment ? { label: '推演方案', params: suggestion.nextExperiment } : null);
        if (!targetRec) {
            showToast({ message: "同步失败：未找到有效方案数据", type: 'error' });
            return;
        }

        let archiveId = loadedArchiveId;
        let archiveTitle = savedResults.find(r => r.id === loadedArchiveId)?.title;

        if (!archiveId) {
            const autoTitle = generateIntelligentTitle("推演方案");
            const doeSnap2: any = { factors: [...factors], responses: [...responses], history: [...history], processDescription, suggestion, loadedArchiveId: null };
            const newArchive: SavedDOE = {
                id: Date.now().toString(), 
                title: autoTitle, 
                timestamp: new Date().toLocaleString(),
                sessionData: doeSnap2
            };
            const updatedArchives = [newArchive, ...savedResults];
            setSavedResults(updatedArchives);
            localStorage.setItem('sciflow_doe_v2_archives', JSON.stringify(updatedArchives));
            archiveId = newArchive.id;
            archiveTitle = autoTitle;
            updateDoeSession({ loadedArchiveId: archiveId });
        }

        const paramSummary = Object.entries(targetRec.params)
            .map(([k, v]) => `${k}:${v}${factors.find(f => f.name === k)?.unit || ''}`)
            .join(', ');

        const finalDisplayTitle = `[${targetRec.label}] ${archiveTitle} (${paramSummary})`;
        
        const newPlan: PlannedExperiment = {
          id: Date.now().toString(), 
          title: finalDisplayTitle,
          status: 'planned', 
          notes: `[DOE 方案类型]: ${targetRec.label}\n[预期目标]: ${targetRec.expectedOutcome || '验证物理模型'}\n[结论摘要]: ${suggestion.reasoning.substring(0, 150)}...`, 
          parameters: {}, 
          matrix: Object.entries(targetRec.params).map(([k, v]) => {
              const matchedFactor = factors.find(f => f.name === k);
              return { 
                  name: k, 
                  range: String(v), 
                  target: matchedFactor?.unit || '' 
              };
          }),
          sourceType: 'doe_ai',
          sourceProposalId: archiveId || undefined
        };

        const updatedMilestones = project.milestones.map(m => m.id === targetMilestoneId ? { ...m, experimentalPlan: [...(m.experimentalPlan || []), newPlan] } : m);
        onUpdateProject({ ...project, milestones: updatedMilestones });
        showToast({ message: t('doeAssistant.manager.toast.singleSyncSuccess'), type: 'success' });
    }

    setShowSyncModal(false);
    setIsBatchSync(false);
    navigate('project_detail', targetProjectId, 'plan');
  };

  const handleReset = () => {
    setConfirmModal({
        show: true,
        title: t('doeAssistant.manager.confirm.resetTitle'),
        desc: t('doeAssistant.manager.confirm.resetDesc'),
        onConfirm: () => {
            updateDoeSession({
                factors: [{ name: '', unit: '', min: 0, max: 100 }],
                responses: [{ name: '', unit: '', goal: 'maximize', weight: 1 }],
                history: [],
                processDescription: '',
                suggestion: null
            });
            setConfirmModal(null);
        }
    });
  };

  const currentMatrix = useMemo(() => {
      if (intensityMode === 'screening') return L4_MATRIX;
      if (intensityMode === 'ai_inspired') return ANCHOR_MATRIX;
      return L9_MATRIX;
  }, [intensityMode]);

  const activeFactors = useMemo(() => factors.slice(0, intensityMode === 'screening' ? 3 : 4), [factors, intensityMode]);
  
  const getPhysicalValue = (factor: DOEFactor, level: number) => {
      if (intensityMode === 'screening') return level === 1 ? factor.min : factor.max;
      if (level === 1) return factor.min;
      if (level === 3) return factor.max;
      return parseFloat(((factor.min + factor.max) / 2).toFixed(2));
  };

  const getFactorDisplayValue = (rIdx: number, fIdx: number, factor: DOEFactor, level: number) => {
      const override = oedFactorOverrides[`${rIdx}-${fIdx}`];
      if (override !== undefined) return override;
      return getPhysicalValue(factor, level).toString();
  };

  const rangeAnalysis = useMemo(() => {
      if (intensityMode !== 'standard' || activeFactors.length === 0) return null;
      const kValues: Record<string, { k1: number, k2: number, k3: number, r: number }> = {};
      let totalR = 0;
      activeFactors.forEach((f, fIdx) => {
          let sum1 = 0, sum2 = 0, sum3 = 0, count = 0;
          currentMatrix.forEach((row, rIdx) => {
              const val = parseFloat(String(oedResults[rIdx] || '0'));
              const level = row[fIdx];
              if (level === 1) sum1 += val;
              if (level === 2) sum2 += val;
              if (level === 3) sum3 += val;
              count++;
          });
          const k1 = sum1 / 3; const k2 = sum2 / 3; const k3 = sum3 / 3;
          const r = Math.max(k1, k2, k3) - Math.min(k1, k2, k3);
          if (count > 0) { kValues[f.name] = { k1, k2, k3, r }; totalR += r; }
      });
      return { kValues, totalR };
  }, [oedResults, activeFactors, intensityMode, currentMatrix]);

  const paretoAnalysis = useMemo(() => {
      if (intensityMode === 'screening' || activeFactors.length === 0) return null;
      let filledCount = 0;
      Object.values(oedResults).forEach((v) => { if (v && !isNaN(parseFloat(v as string))) filledCount++; });
      const data = activeFactors.map((f, fIdx) => {
          let sum1 = 0, count1 = 0, sum2 = 0, count2 = 0;
          currentMatrix.forEach((row, rIdx) => {
              const val = parseFloat(String(oedResults[rIdx] || '0'));
              const level = row[fIdx];
              if (level === 1) { sum1 += val; count1++; }
              if (level === 2) { sum2 += val; count2++; }
          });
          const avg1 = count1 > 0 ? sum1 / count1 : 0;
          const avg2 = count2 > 0 ? sum2 / count2 : 0;
          return { name: f.name, focus: Math.abs(avg2 - avg1) };
      }).sort((a, b) => (b.focus || 0) - (a.focus || 0));
      const totalEffect = data.reduce((sum, item) => sum + (item.focus || 0), 0);
      return { chartData: data.map(item => ({ ...item, effect: item.focus || 0, percentage: totalEffect > 0 ? ((item.focus || 0) / totalEffect) * 100 : 0 })), totalEffect, progress: (filledCount / currentMatrix.length) * 100 };
  }, [oedResults, activeFactors, intensityMode, currentMatrix]);

  const surfacePrediction = useMemo(() => {
      if (intensityMode !== 'ai_inspired' || activeFactors.length < 2) return null;

      // E: 从正交矩阵结果提取已测量点（X轴=因子0，Y轴=因子1，均归一化到[0,1]）
      const points = currentMatrix.map((row, rIdx) => {
          const val = parseFloat(String(oedResults[rIdx] || ''));
          if (isNaN(val) || !oedResults[rIdx]) return null;
          // 归一化：level 1→0, level 2→0.5, level 3→1
          const xNorm = (row[0] - 1) / 2;
          const yNorm = activeFactors.length >= 2 ? (row[1] - 1) / 2 : (row[0] - 1) / 2;
          return { x: xNorm, y: yNorm, z: val };
      }).filter(Boolean) as { x: number; y: number; z: number }[];

      // E: IDW（反距离权重）插值生成 10×10 预测网格
      const GRID = 10;
      const gridData: { x: number; y: number; z: number }[] = [];

      if (points.length >= 2) {
          for (let iy = 0; iy < GRID; iy++) {
              for (let ix = 0; ix < GRID; ix++) {
                  const gx = ix / (GRID - 1);
                  const gy = iy / (GRID - 1);

                  let weightSum = 0;
                  let valueSum = 0;
                  let exactMatch = false;
                  let exactVal = 0;

                  points.forEach(pt => {
                      const dist = Math.sqrt(Math.pow(gx - pt.x, 2) + Math.pow(gy - pt.y, 2));
                      if (dist < 0.001) {
                          exactMatch = true;
                          exactVal = pt.z;
                      } else {
                          const w = 1 / Math.pow(dist, 2); // IDW power=2
                          weightSum += w;
                          valueSum += w * pt.z;
                      }
                  });

                  const predicted = exactMatch ? exactVal : (weightSum > 0 ? valueSum / weightSum : 0);
                  gridData.push({ x: gx, y: gy, z: predicted });
              }
          }
      }

      return { gridData, points, progress: (points.length / currentMatrix.length) * 100 };
  }, [oedResults, intensityMode, currentMatrix, activeFactors]);

  const syncOEDToHistory = () => {
      const newRuns = currentMatrix.map((row, rIdx) => {
          const val = parseFloat(String(oedResults[rIdx] || '0'));
          if (isNaN(val)) return null;
          const rFactors: Record<string, number> = {};
          activeFactors.forEach((f, fIdx) => {
              const valStr = oedFactorOverrides[`${rIdx}-${fIdx}`];
              rFactors[f.name] = (typeof valStr === 'string' && valStr !== '') ? parseFloat(valStr) : getPhysicalValue(f, row[fIdx]);
          });
          return { factors: rFactors, responses: { [responses[0]?.name || 'Result']: val } };
      }).filter(Boolean) as any[];
      if (newRuns.length < currentMatrix.length) return alert(`请先完成数据录入。`);
      updateDoeSession({ history: [...history, ...newRuns] });
      setShowOEDModal(false);
      setOedResults({});
      setOedFactorOverrides({});
  };

  const isAddHistoryValid = factors.every(f => newRunFactors[f.name] !== undefined && !isNaN(newRunFactors[f.name])) &&
                            responses.every(r => newRunResponses[r.name] !== undefined && !isNaN(newRunResponses[r.name]));

  const addNewRun = () => {
      updateDoeSession({ history: [...history, { factors: { ...newRunFactors }, responses: { ...newRunResponses } }] });
      setNewRunFactors({});
      setNewRunResponses({});
      setShowAddHistory(false);
  };

  return {
    state: {
        factors, responses, processDescription, history, savedResults, customTemplates,
        loadedArchiveId, isCalculating, suggestion,
        showConfigModal, showAddHistory, showSyncModal, isBatchSync, showSaveModal, showArchiveDropdown,
        showOEDModal, showSaveTemplateModal, confirmModal,
        intensityMode, oedResults, oedFactorOverrides, newTemplateTitle,
        targetProjectId, targetMilestoneId, saveTitle, newRunFactors, newRunResponses,
        selectedRecommendationIdx // Fix: Export selected index state
    },
    actions: {
        setFactors: (val: any) => updateDoeSession({ factors: val }),
        setResponses: (val: any) => updateDoeSession({ responses: val }),
        setProcessDescription: (val: any) => updateDoeSession({ processDescription: val }),
        setHistory: (val: any) => updateDoeSession({ history: val }),
        setShowConfigModal, setShowAddHistory, setShowSyncModal, setIsBatchSync, setShowSaveModal, setShowArchiveDropdown,
        setShowOEDModal, setShowSaveTemplateModal, setConfirmModal,
        setIntensityMode, setOedResults, setOedFactorOverrides, setNewTemplateTitle,
        setTargetProjectId, setTargetMilestoneId, setSaveTitle, setNewRunFactors, setNewRunResponses,
        setSuggestion: (val: any) => updateDoeSession({ suggestion: val }),
        setLoadedArchiveId: (val: any) => updateDoeSession({ loadedArchiveId: val }),
        setSelectedRecommendationIdx, // Fix: Export selected index action
        handleCalculate, handleSaveAsTemplate, loadTemplate, deleteTemplate,
        handleSaveResult, loadArchive, handleDeleteArchive, handleSyncToProject, handleReset,
        getFactorDisplayValue, syncOEDToHistory, addNewRun, handleLoadSampleCase, generateIntelligentTitle
    },
    computed: {
        currentMatrix, activeFactors, rangeAnalysis, paretoAnalysis, surfacePrediction, isAddHistoryValid
    }
  };
};
