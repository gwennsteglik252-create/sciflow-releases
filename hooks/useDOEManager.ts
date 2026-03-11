
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SavedDOE, ResearchProject, PlannedExperiment, AppView, DoeSession } from '../types';
import { useProjectContext } from '../context/ProjectContext';
import { useDOEState } from './doe/useDOEState';
import { useDOEOED } from './doe/useDOEOED';
import { useDOEPersistence } from './doe/useDOEPersistence';
import { diagnoseOutlierDeviation } from '../services/gemini/analysis';

interface UseDOEManagerProps {
    projects: ResearchProject[];
    onUpdateProject: (updated: ResearchProject) => void;
    navigate: (view: AppView, projectId?: string, subView?: string) => void;
}

export const useDOEManager = (props: UseDOEManagerProps) => {
    const { projects, onUpdateProject, navigate } = props;
    const { doeSession, updateDoeSession, runDoeInference, showToast, setAiStatus } = useProjectContext();
    const { factors, responses, processDescription, history, isCalculating, suggestion, loadedArchiveId } = doeSession;

    const { modals, sync, params } = useDOEState();
    const oed = useDOEOED(factors, responses, params.intensityMode);
    const persistence = useDOEPersistence(doeSession, updateDoeSession);

    const [isDiagnosingId, setIsDiagnosingId] = useState<number | null>(null);
    const [diagnosisResult, setDiagnosisResult] = useState<any | null>(null);

    const handleCalculate = async () => { await runDoeInference(); };

    const handleSynergyDiagnosis = async (runIdx: number) => {
        const run = history[runIdx];
        if (!run) return;

        // 如果已经有诊断结果，直接打开 Modal，不再重新请求 AI
        if (run.outlierAudit) {
            setDiagnosisResult(run.outlierAudit);
            return;
        }

        setIsDiagnosingId(runIdx);
        setAiStatus?.('🧬 正在交叉比对响应面趋势与物理极限...');

        try {
            // 模拟预测值：此处应根据当前响应面模型计算
            const avgResponse = history.reduce((acc, h) => acc + (Object.values(h.responses)[0] as number), 0) / history.length;
            const mockDevPercent = 42;

            const result = await diagnoseOutlierDeviation(
                { scientificData: run.responses },
                avgResponse,
                run.factors
            );

            // 注入偏差百分比并写回 history 状态
            const finalAudit = {
                ...result,
                deviationPercent: mockDevPercent
            };

            const nextHistory = [...history];
            nextHistory[runIdx] = { ...run, outlierAudit: finalAudit };
            updateDoeSession({ history: nextHistory });

            setDiagnosisResult(finalAudit);
            showToast({ message: "诊断结论已自动保存至该数据集", type: 'success' });
        } catch (e) {
            showToast({ message: "诊断服务暂不可用", type: 'error' });
        } finally {
            setIsDiagnosingId(null);
            setAiStatus?.(null);
        }
    };

    const handleLoadSampleCase = () => {
        const sampleData = {
            factors: [
                { name: '反应温度', unit: '°C', min: 120, max: 180 },
                { name: '前驱体浓度', unit: 'mM', min: 10, max: 50 },
                { name: 'PVP添加量', unit: 'mg', min: 5, max: 20 }
            ],
            responses: [{ name: '合成收率', unit: '%', goal: 'maximize' as const, weight: 8 }],
            processDescription: '针对 Ag 纳米线的多元醇法合成工艺优化。',
            history: [
                { factors: { '反应温度': 120, '前驱体浓度': 10, 'PVP添加量': 5 }, responses: { '合成收率': 42.5 } },
                { factors: { '反应温度': 120, '前驱体浓度': 50, 'PVP添加量': 20 }, responses: { '合成收率': 38.2 } },
                { factors: { '反应温度': 180, '前驱体浓度': 10, 'PVP添加量': 20 }, responses: { '合成收率': 85.6 } },
                { factors: { '反应温度': 180, '前驱体浓度': 50, 'PVP添加量': 5 }, responses: { '合成收率': 72.1 } }
            ],
            suggestion: {
                recommendations: [
                    { label: "激进优化点 (Aggressive)", params: { '反应温度': 185, '前驱体浓度': 5, 'PVP添加量': 25 }, expectedOutcome: "预计提升收率至 92% 以上", confidenceScore: 78, predictedValue: 92.4, ciLower: 88.5, ciUpper: 95.8 },
                    { label: "稳健验证点 (Robust)", params: { '反应温度': 175, '前驱体浓度': 12, 'PVP添加量': 18 }, expectedOutcome: "确保收率稳定在 85% 左右", confidenceScore: 92, predictedValue: 85.2, ciLower: 83.1, ciUpper: 87.3 },
                    { label: "模型冷区探索 (Explorer)", params: { '反应温度': 140, '前驱体浓度': 30, 'PVP添加量': 12 }, expectedOutcome: "用于校准低能耗区间的响应灵敏度", confidenceScore: 65, predictedValue: 55.0, ciLower: 45.0, ciUpper: 65.0 }
                ],
                reasoning: "通过对历史数据的响应面拟合发现，温度与 PVP 存在显著的正协同效应。建议在保持高温的同时大幅削减浓度以抑制二次成核。",
                diagnostics: []
            }
        };
        updateDoeSession(sampleData);
        showToast({ message: "已加载多方案演示案例", type: 'info' });
    };

    const handleSaveResult = () => {
        if (!suggestion || !params.saveTitle.trim()) return null;
        const linkedProject = doeSession.linkedProjectId ? projects.find(p => p.id === doeSession.linkedProjectId) : null;
        const linkedMilestone = linkedProject && doeSession.linkedMilestoneId ? linkedProject.milestones.find(m => m.id === doeSession.linkedMilestoneId) : null;
        const newArchive: SavedDOE = {
            id: Date.now().toString(), title: params.saveTitle, timestamp: new Date().toLocaleString(),
            factors: [...factors], responses: [...responses], history: [...history],
            processDescription, suggestion,
            projectId: linkedProject?.id,
            projectTitle: linkedProject?.title,
            milestoneId: linkedMilestone?.id,
            milestoneTitle: linkedMilestone?.title
        };
        const updated = [newArchive, ...persistence.savedResults];
        persistence.setSavedResults(updated);
        localStorage.setItem('sciflow_doe_v2_archives', JSON.stringify(updated));
        updateDoeSession({ loadedArchiveId: newArchive.id });
        modals.setShowSaveModal(false);
        params.setSaveTitle('');
        return newArchive;
    };

    const handleSyncToProject = () => {
        if (!sync.targetProjectId || !sync.targetMilestoneId || !suggestion) return;
        const project = projects.find(p => p.id === sync.targetProjectId);
        if (!project) return;

        const recs = suggestion.recommendations || [];
        let mainNewId = Date.now().toString();

        let currentArchiveId = loadedArchiveId;
        let archiveTitle = persistence.savedResults.find(r => r.id === loadedArchiveId)?.title;

        if (!currentArchiveId) {
            archiveTitle = persistence.generateIntelligentTitle(sync.isBatchSync ? "批量方案组" : "推演方案");
            const syncLinkedProject = doeSession.linkedProjectId ? projects.find(p => p.id === doeSession.linkedProjectId) : null;
            const syncLinkedMilestone = syncLinkedProject && doeSession.linkedMilestoneId ? syncLinkedProject.milestones.find(m => m.id === doeSession.linkedMilestoneId) : null;
            const newArchive: SavedDOE = {
                id: mainNewId, title: archiveTitle, timestamp: new Date().toLocaleString(),
                factors: [...factors], responses: [...responses], history: [...history],
                processDescription, suggestion,
                projectId: syncLinkedProject?.id,
                projectTitle: syncLinkedProject?.title,
                milestoneId: syncLinkedMilestone?.id,
                milestoneTitle: syncLinkedMilestone?.title
            };
            persistence.setSavedResults([newArchive, ...persistence.savedResults]);
            localStorage.setItem('sciflow_doe_v2_archives', JSON.stringify([newArchive, ...persistence.savedResults]));
            currentArchiveId = mainNewId;
            updateDoeSession({ loadedArchiveId: currentArchiveId });
        }

        if (sync.isBatchSync) {
            const newPlan: PlannedExperiment = {
                id: mainNewId,
                title: `[联合对标] ${archiveTitle}`,
                status: 'planned',
                notes: `包含 3 组方案对标。基于推演理由：${suggestion.reasoning.substring(0, 100)}...`,
                parameters: {},
                matrix: factors.map(f => ({ name: f.name, range: `${f.min}-${f.max}`, target: f.unit })),
                runs: recs.map((rec: any, rIdx: number) => ({
                    idx: rIdx + 1,
                    label: rec.label,
                    status: 'pending',
                    params: Object.entries(rec.params).reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {}),
                    prediction: rec.predictedValue ? { value: rec.predictedValue, lower: rec.ciLower, upper: rec.ciUpper, confidence: rec.confidenceScore } : undefined
                })),
                sourceType: 'doe_ai',
                sourceProposalId: currentArchiveId || undefined
            };
            const updatedMilestones = project.milestones.map(m => m.id === sync.targetMilestoneId ? { ...m, experimentalPlan: [newPlan, ...(m.experimentalPlan || [])] } : m);
            onUpdateProject({ ...project, milestones: updatedMilestones });
        } else {
            const targetRec = recs[sync.selectedRecommendationIdx] || (suggestion.nextExperiment ? { label: '推演方案', params: suggestion.nextExperiment } : null);
            if (!targetRec) return;
            const newPlan: PlannedExperiment = {
                id: mainNewId, title: `[${targetRec.label}] ${archiveTitle}`, status: 'planned',
                notes: `预期：${targetRec.expectedOutcome}`, parameters: {},
                matrix: Object.entries(targetRec.params).map(([k, v]) => ({ name: k, range: String(v), target: factors.find(f => f.name === k)?.unit || '' })),
                runs: [{
                    idx: 1, label: targetRec.label, status: 'pending',
                    params: Object.entries(targetRec.params).reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {}),
                    prediction: targetRec.predictedValue ? { value: targetRec.predictedValue, lower: targetRec.ciLower, upper: targetRec.ciUpper, confidence: targetRec.confidenceScore } : undefined
                }],
                sourceType: 'doe_ai', sourceProposalId: currentArchiveId || undefined
            };
            const updatedMilestones = project.milestones.map(m => m.id === sync.targetMilestoneId ? { ...m, experimentalPlan: [newPlan, ...(m.experimentalPlan || [])] } : m);
            onUpdateProject({ ...project, milestones: updatedMilestones });
        }

        sync.setShowSyncModal(false);
        showToast({ message: "方案已成功同步至实验矩阵", type: 'success' });
        navigate('project_detail', sync.targetProjectId, `plan:${mainNewId}`);
    };

    return {
        state: {
            factors, responses, processDescription, history, isCalculating, suggestion,
            loadedArchiveId,
            savedResults: persistence.savedResults,
            customTemplates: persistence.customTemplates,
            ...modals,
            ...sync,
            ...params,
            oedResults: oed.oedResults,
            oedFactorOverrides: oed.oedFactorOverrides,
            isDiagnosingId,
            diagnosisResult
        },
        actions: {
            setFactors: (val: any) => updateDoeSession({ factors: val }),
            setResponses: (val: any) => updateDoeSession({ responses: val }),
            setProcessDescription: (val: any) => updateDoeSession({ processDescription: val }),
            setHistory: (val: any) => updateDoeSession({ history: val }),
            setSuggestion: (val: any) => updateDoeSession({ suggestion: val }),
            setLoadedArchiveId: (val: any) => updateDoeSession({ loadedArchiveId: val }),
            ...modals,
            ...sync,
            ...params,
            setOedResults: oed.setOedResults,
            setOedFactorOverrides: oed.setOedFactorOverrides,
            setDiagnosisResult,
            handleCalculate, handleSaveResult, handleSyncToProject, handleLoadSampleCase,
            handleSynergyDiagnosis,
            loadArchive: persistence.loadArchive,
            generateIntelligentTitle: persistence.generateIntelligentTitle,
            handleDeleteArchive: persistence.handleDeleteArchive,
            handleRenameArchive: persistence.handleRenameArchive,
            handleSaveAsTemplate: () => persistence.handleSaveAsTemplate(params.newTemplateTitle),
            loadTemplate: persistence.loadTemplate,
            deleteTemplate: (id: string) => {
                modals.setConfirmModal({ show: true, title: '删除模板？', desc: '确定移除？', onConfirm: () => { persistence.setCustomTemplates(prev => prev.filter(t => t.id !== id)); modals.setConfirmModal(null); } });
            },
            handleReset: () => {
                modals.setConfirmModal({ show: true, title: '重置？', desc: '清空数据？', onConfirm: () => { updateDoeSession({ factors: [{ name: '', unit: '', min: 0, max: 100 }], responses: [{ name: '', unit: '', goal: 'maximize', weight: 1 }], history: [], processDescription: '', suggestion: null }); modals.setConfirmModal(null); } });
            },
            getFactorDisplayValue: oed.getFactorDisplayValue,
            syncOEDToHistory: () => oed.syncOEDToHistory(history, responses, updateDoeSession, modals.setShowOEDModal),
            addNewRun: () => { updateDoeSession({ history: [...history, { factors: { ...params.newRunFactors }, responses: { ...params.newRunResponses } }] }); params.setNewRunFactors({}); params.setNewRunResponses({}); modals.setShowAddHistory(false); }
        },
        computed: {
            ...oed,
            isAddHistoryValid: true
        }
    };
};
