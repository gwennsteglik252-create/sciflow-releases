import React, { useState, useMemo, useEffect } from 'react';
import { useProjectContext } from '../../context/ProjectContext';
import { TheoreticalDescriptors } from '../../services/gemini';
import MechanismHeader from './MechanismHeader';
import MechanismParameters from './MechanismParameters';
import MechanismVisualizer from './MechanismVisualizer';
import MechanismReport from './MechanismReport';
import ComparisonMatrixModal from './ComparisonMatrixModal';
import { PromptModal } from './PromptModal';
import { analyzeComparisonMatrix } from '../../services/gemini/analysis';

export type VisualizationMode = 'volcano_plot' | 'stability_map' | 'energy_barrier' | 'lattice_view' | 'dos_analysis' | 'synergy_coupling';
export type CatalystMaterial = keyof typeof TheoreticalDescriptors;

const MechanismWorkshop: React.FC = () => {
  const { showToast, activeTheme, mechanismSession, updateMechanismSession, runMechanismAnalysis, setAiStatus } = useProjectContext();
  const isLightMode = activeTheme.type === 'light';

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

  const [savedSimulations, setSavedSimulations] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('sciflow_saved_simulations_v7');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [analysisArchives, setAnalysisArchives] = useState<any[]>(() => {
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
      showToast({ message: "请至少添加两组方案以进行 AI 横向对比分析", type: 'info' });
      return;
    }
    setIsAnalyzingMatrix(true);
    setAiStatus?.('🧬 正在执行 AI 深度矩阵对比解算...');
    try {
      const result = await analyzeComparisonMatrix(savedSimulations);
      setAiMatrixAnalysisResult(result);
      showToast({ message: "AI 矩阵对比分析已完成", type: 'success' });
    } catch (e) {
      showToast({ message: "AI 分析服务暂不可用", type: 'error' });
    } finally {
      setIsAnalyzingMatrix(false);
      setAiStatus?.(null);
    }
  };

  const handleSaveToComparison = () => {
    if (!physicalConstants) {
      showToast({ message: '请先运行性能解算以获得物理常数', type: 'info' });
      return;
    }
    const autoName = dopingElement ? `${material}-${dopingConcentration}%${dopingElement}` : material;
    setPromptConfig({
      isOpen: true,
      title: '为该对比项命名:',
      defaultValue: autoName,
      action: 'comparison'
    });
  };

  const handleSaveToArchives = () => {
    if (!physicalConstants) {
      showToast({ message: '请先运行性能解算以获得物理常数', type: 'info' });
      return;
    }
    const autoName = dopingElement ? `${material}-${dopingConcentration}%${dopingElement}` : material;
    setPromptConfig({
      isOpen: true,
      title: '为分析方案存档命名:',
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
        loading: massLoading,
        reactionMode,
        pH,
        potential,
        physicalConstants,
        stabilityPrediction,
        analysisResult
      };
      setSavedSimulations(prev => [newSim, ...prev].slice(0, 15));
      showToast({ message: '方案已加入对比矩阵', type: 'success' });
    } else if (promptConfig.action === 'archive') {
      const newArchive = {
        id: Date.now().toString(),
        name,
        timestamp: new Date().toLocaleString(),
        material,
        doping: { element: dopingElement, concentration: dopingConcentration },
        loading: massLoading,
        reactionMode,
        pH,
        potential,
        physicalConstants,
        stabilityPrediction,
        analysisResult
      };
      setAnalysisArchives(prev => [newArchive, ...prev]);
      showToast({ message: '分析方案已存入本地文库', type: 'success' });
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
      massLoading: sim.loading,
      reactionMode: sim.reactionMode,
      pH: sim.pH,
      potential: sim.potential,
      physicalConstants: sim.physicalConstants,
      stabilityPrediction: sim.stabilityPrediction,
      analysisResult: sim.analysisResult
    });
    showToast({ message: '方案数据已加载', type: 'info' });
  };

  const handleDeleteSim = (id: string) => {
    setSavedSimulations(prev => prev.filter(sim => sim.id !== id));
    showToast({ message: '项已从对比矩阵移除', type: 'info' });
  };

  // Fix: Added missing handleUpdateSim function to update simulations in the comparison matrix
  const handleUpdateSim = (id: string, updates: any) => {
    setSavedSimulations(prev => prev.map(sim => sim.id === id ? { ...sim, ...updates } : sim));
  };

  // Fix: Added missing handleDeleteArchive function to remove archived simulations from the library
  const handleDeleteArchive = (id: string) => {
    setAnalysisArchives(prev => prev.filter(a => a.id !== id));
    showToast({ message: '分析方案已从库中移除', type: 'info' });
  };

  // Fix: Added missing handleRenameArchive function to rename archived simulations in the library
  const handleRenameArchive = (id: string, newName: string) => {
    setAnalysisArchives(prev => prev.map(a => a.id === id ? { ...a, name: newName } : a));
  };

  const handleRenameRequest = (id: string, currentName: string) => {
    setPromptConfig({
      isOpen: true,
      title: '重命名方案存档:',
      defaultValue: currentName,
      action: 'rename',
      targetId: id
    });
  };

  const handleDeleteMatrix = (id: string) => {
    setMatrixLibrary(prev => prev.filter(m => m.id !== id));
    showToast({ message: '矩阵存档已删除', type: 'info' });
  };

  // --- 严谨物理引擎：LSV 曲线生成 (Butler-Volmer + Mass Transport) ---
  const lsvCurves = useMemo(() => {
    if (!physicalConstants) return null;

    // 物理参数提取
    let j0 = parseFloat(physicalConstants.exchangeCurrentDensity) || 1e-6;
    const bT = parseFloat(physicalConstants.tafelSlope) || 60;

    // 传质极限解算
    let jLim = 5000;
    if (morphologyLink?.type === 'sheet' && morphologyLink.value < 30) {
      jLim = 100 + (morphologyLink.value / 30) * 1900;
    } else if (morphologyLink?.type === 'defect' && morphologyLink.defectDensity) {
      const boostFactor = 1 + (morphologyLink.defectDensity / 10) * 2;
      j0 *= boostFactor;
    }

    const points = [];

    if (reactionMode === 'BIFUNCTIONAL') {
      // 双功能全扫描模式: 0.2V to 1.83V (Covering ORR and OER)
      const onsetORR = 1.0; // Assume ORR onset
      const onsetOER = 1.45; // Assume OER onset
      const j0_ORR = j0 * 0.8; // Assume slightly different activity

      for (let v = 0.2; v <= 1.83; v += 0.01) {
        // ORR branch (Reduction current)
        const overORR = Math.max(0, 1.23 - v);
        const jKinORR = (j0_ORR * Math.pow(10, (overORR * 1000) / (bT * 1.2))) * massLoading;
        const jORR = - (jKinORR * 50) / (jKinORR + 50); // ORR diffusion limit is much lower

        // OER branch (Oxidation current)
        const overOER = Math.max(0, v - 1.23);
        const jKinOER = (j0 * Math.pow(10, (overOER * 1000) / bT)) * massLoading;
        const jOER = (jKinOER * jLim) / (jKinOER + jLim);

        points.push({
          v,
          jDoped: jOER + jORR,
          jBase: (jOER + jORR) * 0.4, // Simplified base for comparison
          jDecay: (jOER + jORR) * 0.7
        });
      }
    } else {
      const onset = reactionMode === 'OER' ? 1.23 : reactionMode === 'ORR' ? 1.23 : 0;
      const range = 0.6;
      const j0_base = j0 * 0.1;
      const bT_base = bT * 1.5;

      for (let over = 0; over <= range; over += 0.005) {
        const jKin = (j0 * Math.pow(10, (over * 1000) / bT)) * massLoading;
        const jDoped = (jKin * jLim) / (jKin + jLim);
        const jBaseKin = (j0_base * Math.pow(10, (over * 1000) / bT_base)) * massLoading;
        const jBase = (jBaseKin * jLim) / (jBaseKin + jLim);
        const decayFactor = Math.max(0.2, (stabilityPrediction?.safetyIndex || 8) / 10);

        points.push({
          v: reactionMode === 'ORR' ? onset - over : onset + over,
          jDoped: reactionMode === 'ORR' ? -jDoped : jDoped,
          jBase: reactionMode === 'ORR' ? -jBase : jBase,
          jDecay: reactionMode === 'ORR' ? -(jDoped * decayFactor) : (jDoped * decayFactor)
        });
      }
    }
    return points;
  }, [physicalConstants, massLoading, reactionMode, stabilityPrediction, morphologyLink]);

  const benchmarkResult = useMemo(() => {
    if (!lsvCurves || !measuredPoint.v || !measuredPoint.j) return null;
    const vReal = parseFloat(measuredPoint.v);
    const jReal = parseFloat(measuredPoint.j);
    if (isNaN(vReal) || isNaN(jReal)) return null;
    const closest = lsvCurves.reduce((prev: any, curr: any) => Math.abs(curr.v - vReal) < Math.abs(prev.v - vReal) ? curr : prev);
    return { error: ((closest.jDoped - jReal) / jReal) * 100, jSim: closest.jDoped, vReal, jReal };
  }, [lsvCurves, measuredPoint]);

  // --- 严谨物理引擎：火山图解算 (基于自由能台阶) ---
  const volcanoData = useMemo(() => {
    if (visualizationMode !== 'volcano_plot') return null;

    const volcanoPath = [];
    for (let x = -1.5; x <= 1.5; x += 0.05) {
      volcanoPath.push({ x, activity: 10 - 6.5 * Math.abs(x) }); // 理想火山形态
    }

    const calculatePoint = (sim: any) => {
      const steps = sim.physicalConstants?.energySteps;
      if (!steps || steps.length < 3) return null;

      // 核心：从能级台阶中提取描述符 (以 OER 为例，通常为 ΔG_O - ΔG_OH)
      // 这里我们进行通用化处理：取决速步前后的差值位移作为 X 轴描述符
      let maxDG = -Infinity;
      let rdsIdx = 0;
      for (let i = 0; i < steps.length - 1; i++) {
        const dg = steps[i + 1] - steps[i];
        if (dg > maxDG) { maxDG = dg; rdsIdx = i; }
      }

      // 描述符定义：理论理想值 maxDG = 1.23eV。偏离 1.23 的程度决定 X 轴坐标。
      const descriptor = maxDG - (sim.reactionMode === 'OER' || sim.reactionMode === 'BIFUNCTIONAL' ? 1.23 : sim.reactionMode === 'ORR' ? 1.23 : 0.4);
      // 活性定义：1/过电位
      const activity = 10 - 6.5 * Math.abs(descriptor);

      return { x: descriptor, y: activity };
    };

    const currentPt = calculatePoint({ physicalConstants, reactionMode });
    const currentPoint = currentPt ? { ...currentPt, name: '当前解算方案', isCurrent: true } : null;

    const baseDescriptor = TheoreticalDescriptors[material as CatalystMaterial]?.adsOH || 0;
    const basePoint = { name: `纯 ${material} 基准`, x: baseDescriptor, y: 10 - 6.5 * Math.abs(baseDescriptor) };

    const comparisonPoints = savedSimulations.map(sim => {
      const pt = calculatePoint(sim);
      return pt ? { ...pt, id: sim.id, name: sim.name, isCurrent: false } : null;
    }).filter(Boolean);

    return { volcanoPath, currentPoint, basePoint, comparisonPoints };
  }, [physicalConstants, material, reactionMode, visualizationMode, savedSimulations]);

  return (
    <div className="h-full flex flex-col gap-3 animate-reveal overflow-hidden bg-slate-50/50 p-3 lg:p-4 min-h-0">
      <MechanismHeader
        analysisArchives={analysisArchives}
        onLoadArchive={handleLoadSim}
        onDeleteArchive={handleDeleteArchive}
        onRenameArchive={handleRenameArchive}
        onRenameRequest={handleRenameRequest}
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
            morphologyLink={morphologyLink}
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
            unitCellType={unitCellType}
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
    </div>
  );
};

export default MechanismWorkshop;