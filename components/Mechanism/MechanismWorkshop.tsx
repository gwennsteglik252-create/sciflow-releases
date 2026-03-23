import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useProjectContext } from '../../context/ProjectContext';
import { TheoreticalDescriptors } from '../../services/gemini';
import MechanismHeader from './MechanismHeader';
import MechanismParameters from './MechanismParameters';
import MechanismVisualizer from './MechanismVisualizer';
import MechanismReport from './MechanismReport';
import ComparisonMatrixModal from './ComparisonMatrixModal';
import DebatePanel from './DebatePanel';
import TemplateLibrary from './TemplateLibrary';
import ArchiveLibraryModal from './ArchiveLibraryModal';
import { PromptModal } from './PromptModal';
import { analyzeComparisonMatrix, runMechanismDebate } from '../../services/gemini/analysis';
import { useTranslation } from '../../locales/useTranslation';
import { computeLsvCurves, computeBenchmark } from './physicsUtils';
import type { DebateEntry, MechanismTemplateParams, Simulation } from './types';

export type VisualizationMode = 'volcano_plot' | 'stability_map' | 'energy_barrier' | 'lattice_view' | 'dos_analysis' | 'synergy_coupling';
export type CatalystMaterial = keyof typeof TheoreticalDescriptors;

const MechanismWorkshop: React.FC = () => {
  const { showToast, activeTheme, mechanismSession, updateMechanismSession, runMechanismAnalysis, setAiStatus } = useProjectContext();
  const isLightMode = activeTheme.type === 'light';
  const { t } = useTranslation();

  const {
    pH, potential, reactionMode, material, unitCellType, dopingElement, dopingConcentration,
    coDopingElement, coDopingConcentration,
    massLoading, isProcessing, analysisResult, stabilityPrediction, physicalConstants, morphologyLink,
    isStableAnalysis
  } = mechanismSession;

  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>('energy_barrier');
  const [measuredPoint, setMeasuredPoint] = useState<{ v: string, j: string }>({ v: '', j: '' });

  const [isOperatingExpanded, setIsOperatingExpanded] = useState(false);
  const [isDopingExpanded, setIsDopingExpanded] = useState(false);
  const [isBenchmarkExpanded, setIsBenchmarkExpanded] = useState(false);

  const [showComparisonTable, setShowComparisonTable] = useState(false);
  const [isAnalyzingMatrix, setIsAnalyzingMatrix] = useState(false);
  const [aiMatrixAnalysisResult, setAiMatrixAnalysisResult] = useState<string | null>(null);

  // ── AI 辩论模式状态 ──
  const [showDebatePanel, setShowDebatePanel] = useState(false);
  const [debateEntries, setDebateEntries] = useState<DebateEntry[]>([]);
  const [debateConclusion, setDebateConclusion] = useState<string | null>(null);
  const [isDebating, setIsDebating] = useState(false);
  const [debateRound, setDebateRound] = useState(0);

  // ── 模板库状态 ──
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showArchiveLibrary, setShowArchiveLibrary] = useState(false);

  const [savedSimulations, setSavedSimulations] = useState<Simulation[]>(() => {
    try {
      const saved = localStorage.getItem('sciflow_saved_simulations_v7');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [analysisArchives, setAnalysisArchives] = useState<Simulation[]>(() => {
    try {
      const saved = localStorage.getItem('sciflow_analysis_archives_v1');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [matrixLibrary, setMatrixLibrary] = useState<{ id: string, name: string, simulations: any[], timestamp: string, aiInsight?: string }[]>(() => {
    try {
      const saved = localStorage.getItem('sciflow_matrix_library_v1');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [promptConfig, setPromptConfig] = useState<{
    isOpen: boolean;
    title: string;
    defaultValue: string;
    action: 'comparison' | 'archive' | 'rename' | null;
    targetId?: string;
  }>({ isOpen: false, title: '', defaultValue: '', action: null });

  useEffect(() => {
    localStorage.setItem('sciflow_saved_simulations_v7', JSON.stringify(savedSimulations));
  }, [savedSimulations]);

  useEffect(() => {
    localStorage.setItem('sciflow_analysis_archives_v1', JSON.stringify(analysisArchives));
  }, [analysisArchives]);

  useEffect(() => {
    localStorage.setItem('sciflow_matrix_library_v1', JSON.stringify(matrixLibrary));
  }, [matrixLibrary]);

  const handleRunAiMatrixAnalysis = async () => {
    if (savedSimulations.length < 2) {
      showToast({ message: t('mechanism.workshop.needTwoSchemes'), type: 'info' });
      return;
    }
    setIsAnalyzingMatrix(true);
    setAiStatus?.(t('mechanism.workshop.aiMatrixAnalyzing'));
    try {
      const result = await analyzeComparisonMatrix(savedSimulations);
      setAiMatrixAnalysisResult(result);
      showToast({ message: t('mechanism.workshop.aiMatrixDone'), type: 'success' });
    } catch (e) {
      showToast({ message: t('mechanism.workshop.aiServiceUnavailable'), type: 'error' });
    } finally {
      setIsAnalyzingMatrix(false);
      setAiStatus?.(null);
    }
  };

  const handleSaveToComparison = () => {
    if (!physicalConstants) {
      showToast({ message: t('mechanism.workshop.needPhysicsFirst'), type: 'info' });
      return;
    }
    const autoName = dopingElement ? `${material}-${dopingConcentration}%${dopingElement}` : material;
    setPromptConfig({
      isOpen: true,
      title: t('mechanism.workshop.nameComparisonItem'),
      defaultValue: autoName,
      action: 'comparison'
    });
  };

  const handleSaveToArchives = () => {
    if (!physicalConstants) {
      showToast({ message: t('mechanism.workshop.needPhysicsFirst'), type: 'info' });
      return;
    }
    const autoName = dopingElement ? `${material}-${dopingConcentration}%${dopingElement}` : material;
    setPromptConfig({
      isOpen: true,
      title: t('mechanism.workshop.nameArchiveItem'),
      defaultValue: autoName,
      action: 'archive'
    });
  };

  const executePromptAction = (value: string) => {
    const name = value.trim() || promptConfig.defaultValue;

    if (promptConfig.action === 'comparison') {
      const newSim = {
        id: Date.now().toString(),
        name,
        timestamp: new Date().toLocaleString(),
        material,
        doping: { element: dopingElement, concentration: dopingConcentration },
        coDoping: { element: coDopingElement, concentration: coDopingConcentration },
        unitCellType,
        loading: massLoading,
        reactionMode,
        pH,
        potential,
        physicalConstants,
        stabilityPrediction,
        analysisResult,
        morphologyLink: morphologyLink || undefined,
        debateEntries: debateEntries.length > 0 ? debateEntries : undefined,
        debateConclusion: debateConclusion || undefined,
      };
      setSavedSimulations(prev => [newSim, ...prev].slice(0, 15));
      showToast({ message: t('mechanism.workshop.addedToComparison'), type: 'success' });
    } else if (promptConfig.action === 'archive') {
      const newArchive = {
        id: Date.now().toString(),
        name,
        timestamp: new Date().toLocaleString(),
        material,
        doping: { element: dopingElement, concentration: dopingConcentration },
        coDoping: { element: coDopingElement, concentration: coDopingConcentration },
        unitCellType,
        loading: massLoading,
        reactionMode,
        pH,
        potential,
        physicalConstants,
        stabilityPrediction,
        analysisResult,
        morphologyLink: morphologyLink || undefined,
        debateEntries: debateEntries.length > 0 ? debateEntries : undefined,
        debateConclusion: debateConclusion || undefined,
      };
      setAnalysisArchives(prev => [newArchive, ...prev]);
      showToast({ message: t('mechanism.workshop.savedToArchive'), type: 'success' });
    } else if (promptConfig.action === 'rename' && promptConfig.targetId) {
      setAnalysisArchives(prev => prev.map(a => a.id === promptConfig.targetId ? { ...a, name } : a));
    }

    setPromptConfig({ isOpen: false, title: '', defaultValue: '', action: null });
  };

  const handleLoadSim = (sim: any) => {
    updateMechanismSession({
      material: sim.material,
      dopingElement: sim.doping?.element || '',
      dopingConcentration: sim.doping?.concentration || 0,
      coDopingElement: sim.coDoping?.element || 'None',
      coDopingConcentration: sim.coDoping?.concentration || 0,
      unitCellType: sim.unitCellType || undefined,
      massLoading: sim.loading,
      reactionMode: sim.reactionMode,
      pH: sim.pH,
      potential: sim.potential,
      physicalConstants: sim.physicalConstants,
      stabilityPrediction: sim.stabilityPrediction,
      analysisResult: sim.analysisResult,
      morphologyLink: sim.morphologyLink || null,
    });
    // 恢复辩论数据（如果有）
    if (sim.debateEntries?.length) {
      setDebateEntries(sim.debateEntries);
      setDebateConclusion(sim.debateConclusion || null);
      setDebateRound(Math.max(...sim.debateEntries.map((e: DebateEntry) => e.round)));
    }
    showToast({ message: t('mechanism.workshop.schemeLoaded'), type: 'info' });
  };

  const handleDeleteSim = (id: string) => {
    setSavedSimulations(prev => prev.filter(sim => sim.id !== id));
    showToast({ message: t('mechanism.workshop.removedFromComparison'), type: 'info' });
  };

  // Fix: Added missing handleUpdateSim function to update simulations in the comparison matrix
  const handleUpdateSim = (id: string, updates: any) => {
    setSavedSimulations(prev => prev.map(sim => sim.id === id ? { ...sim, ...updates } : sim));
  };

  // Fix: Added missing handleDeleteArchive function to remove archived simulations from the library
  const handleDeleteArchive = (id: string) => {
    setAnalysisArchives(prev => prev.filter(a => a.id !== id));
    showToast({ message: t('mechanism.workshop.archiveRemoved'), type: 'info' });
  };

  // Fix: Added missing handleRenameArchive function to rename archived simulations in the library
  const handleRenameArchive = (id: string, newName: string) => {
    setAnalysisArchives(prev => prev.map(a => a.id === id ? { ...a, name: newName } : a));
  };

  const handleRenameRequest = (id: string, currentName: string) => {
    setPromptConfig({
      isOpen: true,
      title: t('mechanism.workshop.renameArchiveTitle'),
      defaultValue: currentName,
      action: 'rename',
      targetId: id
    });
  };

  const handleDeleteMatrix = (id: string) => {
    setMatrixLibrary(prev => prev.filter(m => m.id !== id));
    showToast({ message: t('mechanism.workshop.matrixDeleted'), type: 'info' });
  };

  // ── AI 辩论处理 ──
  const handleStartDebate = useCallback(async () => {
    if (!analysisResult || !physicalConstants) return;
    setIsDebating(true);
    const nextRound = 1;
    try {
      const result = await runMechanismDebate({
        material, reactionMode, pH, potential, dopingElement, dopingConcentration,
        physicalConstants, stabilityPrediction, analysisResult,
        currentRound: nextRound,
      });
      setDebateEntries(result.entries);
      setDebateConclusion(result.conclusion);
      setDebateRound(nextRound);
    } catch (e: any) {
      showToast({ message: `辩论启动失败: ${e?.message || '未知错误'}`, type: 'error' });
    } finally {
      setIsDebating(false);
    }
  }, [material, reactionMode, pH, potential, dopingElement, dopingConcentration, physicalConstants, stabilityPrediction, analysisResult, showToast]);

  const handleContinueDebate = useCallback(async () => {
    if (!analysisResult || !physicalConstants) return;
    setIsDebating(true);
    const nextRound = debateRound + 1;
    const previousDebate = debateEntries.map(e => `[${e.expertId}] ${e.content}`).join('\n\n');
    try {
      const result = await runMechanismDebate({
        material, reactionMode, pH, potential, dopingElement, dopingConcentration,
        physicalConstants, stabilityPrediction, analysisResult,
        currentRound: nextRound,
        previousDebate,
      });
      setDebateEntries(prev => [...prev, ...result.entries]);
      setDebateConclusion(result.conclusion);
      setDebateRound(nextRound);
    } catch (e: any) {
      showToast({ message: `辩论失败: ${e?.message || '未知错误'}`, type: 'error' });
    } finally {
      setIsDebating(false);
    }
  }, [material, reactionMode, pH, potential, dopingElement, dopingConcentration, physicalConstants, stabilityPrediction, analysisResult, debateRound, debateEntries, showToast]);

  // ── 模板加载处理 ──
  const handleLoadTemplate = useCallback((params: MechanismTemplateParams) => {
    updateMechanismSession({
      material: params.material,
      reactionMode: params.reactionMode,
      pH: params.pH,
      potential: params.potential,
      dopingElement: params.dopingElement,
      dopingConcentration: params.dopingConcentration,
      coDopingElement: params.coDopingElement || 'None',
      coDopingConcentration: params.coDopingConcentration || 0,
      unitCellType: params.unitCellType,
      massLoading: params.massLoading || 0.28,
      // 重置结果
      physicalConstants: null, analysisResult: null, stabilityPrediction: null,
    });
  }, [updateMechanismSession]);

  // --- 严谨物理引擎：LSV 曲线生成 (委托 physicsUtils) ---
  const lsvCurves = useMemo(() => {
    if (!physicalConstants) return null;
    return computeLsvCurves({
      physicalConstants, massLoading, reactionMode,
      stabilityPrediction, morphologyLink
    });
  }, [physicalConstants, massLoading, reactionMode, stabilityPrediction, morphologyLink]);

  const benchmarkResult = useMemo(() => {
    if (!lsvCurves || !measuredPoint.v || !measuredPoint.j) return null;
    const vReal = parseFloat(measuredPoint.v);
    const jReal = parseFloat(measuredPoint.j);
    return computeBenchmark(lsvCurves, vReal, jReal);
  }, [lsvCurves, measuredPoint]);

  // --- 严谨物理引擎：火山图解算 (Sabatier Gaussian Volcano) ---
  const volcanoData = useMemo(() => {
    if (visualizationMode !== 'volcano_plot') return null;

    // 按反应类型定义火山曲线高斯参数 (峰值位置、峰高、宽度)
    const volcanoParams: Record<string, { peakX: number; peakY: number; sigma: number; label: string; xAxisLabel: string }> = {
      OER:          { peakX: 0.2,  peakY: 9.5, sigma: 0.55, label: 'OER Sabatier Optimum',  xAxisLabel: 'ΔG(O*) – ΔG(OH*) (eV)' },
      ORR:          { peakX: -0.1, peakY: 9.0, sigma: 0.50, label: 'ORR Sabatier Optimum',  xAxisLabel: 'ΔG(OH*) (eV)' },
      HER:          { peakX: 0.0,  peakY: 10.0, sigma: 0.40, label: 'HER Sabatier Optimum', xAxisLabel: 'ΔG(H*) (eV)' },
      BIFUNCTIONAL: { peakX: 0.1,  peakY: 9.2, sigma: 0.52, label: 'Bifunctional Optimum', xAxisLabel: 'ΔG(O*) – ΔG(OH*) (eV)' },
    };
    const params = volcanoParams[reactionMode] || volcanoParams.OER;

    // 高斯钟形火山曲线
    const gaussian = (x: number) => params.peakY * Math.exp(-((x - params.peakX) ** 2) / (2 * params.sigma ** 2));

    const volcanoPath = [];
    for (let x = -1.8; x <= 1.8; x += 0.03) {
      volcanoPath.push({ x, activity: gaussian(x) });
    }

    // 按反应类型提取物理描述符
    const calculatePoint = (sim: any) => {
      const steps = sim.physicalConstants?.energySteps;
      if (!steps || steps.length < 3) return null;

      const mode = sim.reactionMode || reactionMode;
      let descriptor: number;

      if (mode === 'OER' || mode === 'BIFUNCTIONAL') {
        // OER 描述符: ΔG(O*) - ΔG(OH*), 即 steps[2] - steps[1] 相对理想值 (1.23 eV) 的偏差
        const dG_O = steps[2] ?? steps[1];
        const dG_OH = steps[1] ?? steps[0];
        descriptor = (dG_O - dG_OH) - 1.23;
      } else if (mode === 'ORR') {
        // ORR 描述符: ΔG(OH*), 即 steps[steps.length-2] 相对理想值的偏差
        const dG_OH = steps[steps.length - 2] ?? steps[1];
        descriptor = Math.abs(dG_OH) - 1.23;
      } else {
        // HER 描述符: ΔG(H*), 即 steps[1] 相对理想值 (0) 的偏差
        descriptor = steps[1] ?? 0;
      }

      // 活性使用与曲线一致的高斯模型
      const activity = gaussian(descriptor);

      return { x: descriptor, y: activity };
    };

    const currentPt = calculatePoint({ physicalConstants, reactionMode });
    const currentPoint = currentPt ? { ...currentPt, name: t('mechanism.workshop.currentScheme'), isCurrent: true } : null;

    const baseDescriptor = TheoreticalDescriptors[material as CatalystMaterial]?.adsOH || 0;
    const basePoint = { name: t('mechanism.workshop.baselineScheme', { material }), x: baseDescriptor, y: gaussian(baseDescriptor) };

    const comparisonPoints = savedSimulations.map(sim => {
      const pt = calculatePoint(sim);
      return pt ? { ...pt, id: sim.id, name: sim.name, isCurrent: false } : null;
    }).filter(Boolean);

    return { volcanoPath, currentPoint, basePoint, comparisonPoints, volcanoParams: params };
  }, [physicalConstants, material, reactionMode, visualizationMode, savedSimulations]);

  return (
    <div className="h-full flex flex-col gap-3 animate-reveal overflow-hidden bg-slate-50/50 p-3 lg:p-4 min-h-0">
      <MechanismHeader
        analysisArchivesCount={analysisArchives.length}
        onOpenArchiveLibrary={() => setShowArchiveLibrary(true)}
        showComparisonTable={showComparisonTable}
        setShowComparisonTable={setShowComparisonTable}
        handleSaveToComparison={handleSaveToComparison}
        handleSaveToArchives={handleSaveToArchives}
        physicalConstants={physicalConstants}
        analysisResult={analysisResult}
        isProcessing={isProcessing}
        runMechanismAnalysis={runMechanismAnalysis}
        mechanismSession={mechanismSession}
        updateMechanismSession={updateMechanismSession}
        onOpenDebate={() => setShowDebatePanel(true)}
        onOpenTemplateLibrary={() => setShowTemplateLibrary(true)}
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 relative">
        <div className="lg:col-span-3 flex flex-col min-h-0">
          <MechanismParameters
            pH={pH}
            potential={potential}
            reactionMode={reactionMode}
            material={material}
            unitCellType={unitCellType}
            dopingElement={dopingElement}
            dopingConcentration={dopingConcentration}
            coDopingElement={coDopingElement}
            coDopingConcentration={coDopingConcentration}
            mechanismSession={mechanismSession}
            updateMechanismSession={updateMechanismSession}
            measuredPoint={measuredPoint}
            setMeasuredPoint={setMeasuredPoint}
            isOperatingExpanded={isOperatingExpanded}
            setIsOperatingExpanded={setIsOperatingExpanded}
            isDopingExpanded={isDopingExpanded}
            setIsDopingExpanded={setIsDopingExpanded}
            isBenchmarkExpanded={isBenchmarkExpanded}
            setIsBenchmarkExpanded={setIsBenchmarkExpanded}
            stabilityPrediction={stabilityPrediction}
            isStableAnalysis={isStableAnalysis}
          />
        </div>

        <div className="lg:col-span-5 flex flex-col min-h-0">
          <MechanismVisualizer
            visualizationMode={visualizationMode}
            setVisualizationMode={setVisualizationMode}
            physicalConstants={physicalConstants}
            reactionMode={reactionMode}
            potential={potential}
            isLightMode={isLightMode}
            savedSimulations={savedSimulations}
            lsvCurves={lsvCurves}
            benchmarkResult={benchmarkResult}
            volcanoData={volcanoData}
            pH={pH}
            material={material}
            dopingElement={dopingElement}
            dopingConcentration={dopingConcentration}
            coDopingElement={coDopingElement}
            coDopingConcentration={coDopingConcentration}
            additionalDopants={(mechanismSession as any)?.additionalDopants}
            unitCellType={unitCellType}
            onLoadSimulation={handleLoadSim}
          />
        </div>

        <div className="lg:col-span-4 flex flex-col min-h-0">
          <MechanismReport
            analysisResult={analysisResult}
            isProcessing={isProcessing}
            physicalConstants={physicalConstants}
          />
        </div>

        {showComparisonTable && (
          <ComparisonMatrixModal
            onClose={() => setShowComparisonTable(false)}
            savedSimulations={savedSimulations}
            handleLoadSim={handleLoadSim}
            onDeleteSim={handleDeleteSim}
            onUpdateSim={handleUpdateSim}
            onClearSimulations={() => setSavedSimulations([])}
            matrixLibrary={matrixLibrary}
            onSaveMatrix={(name, insight) => setMatrixLibrary(prev => [...prev, { id: Date.now().toString(), name, simulations: [...savedSimulations], timestamp: new Date().toLocaleString(), aiInsight: insight }])}
            onLoadMatrix={(m) => { setSavedSimulations([...m.simulations]); setAiMatrixAnalysisResult(m.aiInsight || null); }}
            onDeleteMatrix={(id) => setMatrixLibrary(prev => prev.filter(m => m.id !== id))}
            isAnalyzing={isAnalyzingMatrix}
            aiAnalysisResult={aiMatrixAnalysisResult}
            onRunAiAnalysis={handleRunAiMatrixAnalysis}
          />
        )}
      </div>

      <PromptModal
        isOpen={promptConfig.isOpen}
        title={promptConfig.title}
        defaultValue={promptConfig.defaultValue}
        onConfirm={executePromptAction}
        onCancel={() => setPromptConfig(prev => ({ ...prev, isOpen: false }))}
      />

      {showDebatePanel && (
        <DebatePanel
          onClose={() => setShowDebatePanel(false)}
          debateEntries={debateEntries}
          conclusion={debateConclusion}
          isDebating={isDebating}
          currentRound={debateRound}
          onStartDebate={handleStartDebate}
          onContinueDebate={handleContinueDebate}
          hasAnalysisResult={!!analysisResult && !!physicalConstants}
        />
      )}

      {showTemplateLibrary && (
        <TemplateLibrary
          onClose={() => setShowTemplateLibrary(false)}
          onLoadTemplate={handleLoadTemplate}
          currentParams={{
            material, reactionMode: reactionMode as any, pH, potential,
            dopingElement, dopingConcentration,
            coDopingElement: coDopingElement || undefined,
            coDopingConcentration: coDopingConcentration || undefined,
            unitCellType, massLoading,
          }}
          showToast={showToast}
        />
      )}

      {showArchiveLibrary && (
        <ArchiveLibraryModal
          archives={analysisArchives}
          onLoad={handleLoadSim}
          onDelete={handleDeleteArchive}
          onRenameRequest={handleRenameRequest}
          onClose={() => setShowArchiveLibrary(false)}
        />
      )}
    </div>
  );
};

export default MechanismWorkshop;