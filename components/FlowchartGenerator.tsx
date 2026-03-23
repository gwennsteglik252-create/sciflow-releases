
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { parseLiteratureForProcess, splitFlowchartStep } from '../services/gemini/flowchart';
import { SavedFlowchart, FlowchartStep, ResearchProject, AppView, SavedDOE, TransformationProposal, AiTask } from '../types';
import * as htmlToImage from 'html-to-image';
import { useProjectContext } from '../context/ProjectContext';
import { exportToWord } from '../utils/documentExport';
import saveAs from 'file-saver';
import { printElement } from '../utils/printUtility';
import { useTranslation } from '../locales';

import { FlowchartInput } from './Flowchart/FlowchartInput';
import { FlowchartVisualizer } from './Flowchart/FlowchartVisualizer';
import { IndustrialAssessment } from './Flowchart/IndustrialAssessment';
import { SafetyDashboard } from './Flowchart/SafetyDashboard';
import { SchemeLibraryModal } from './FigureCenter/SchemeLibraryModal';

export const FlowchartGenerator: React.FC<{
  projects: ResearchProject[];
  onUpdateProject: (updated: ResearchProject) => void;
  navigate: (view: AppView, projectId?: string, subView?: string) => void;
}> = ({ projects = [], onUpdateProject, navigate }) => {
  const { flowchartSession, updateFlowchartSession, runFlowchartModeling, runFlowchartBOM, setAiStatus, showToast, startGlobalTask, activeTasks } = useProjectContext();
  const { t } = useTranslation();

  const [isSplittingStepId, setIsSplittingStepId] = useState<string | null>(null);

  const {
    description, currentFlowchart, scaleFactor, targetTrl,
    productionValue, unitLabel, includeMaterialCost, includeOperationCost,
    activeStepId
  } = flowchartSession;

  const isGenerating = useMemo(() => activeTasks.some(t => t.id === 'flowchart_modeling'), [activeTasks]);
  const isGeneratingBOM = useMemo(() => activeTasks.some(t => t.id === 'flowchart_bom'), [activeTasks]);
  const isUploading = useMemo(() => activeTasks.some(t => t.id === 'lit_parse'), [activeTasks]);

  const flowchartRef = useRef<HTMLDivElement>(null);

  const [savedFlowcharts, setSavedFlowcharts] = useState<SavedFlowchart[]>(() => {
    const saved = localStorage.getItem('sciflow_saved_flowcharts');
    return saved ? JSON.parse(saved) : [];
  });

  // 自动持久化
  useEffect(() => {
    localStorage.setItem('sciflow_saved_flowcharts', JSON.stringify(savedFlowcharts));
  }, [savedFlowcharts]);

  const [showLibrary, setShowLibrary] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showSaveNamingModal, setShowSaveNamingModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [targetProjectId, setTargetProjectId] = useState('');

  // ── 库操作回调 ──
  const handleLoadSaved = useCallback((item: SavedFlowchart) => {
    const restoreSession: Partial<typeof flowchartSession> = { currentFlowchart: item, description: item.originalDescription };
    if (item.sessionData) Object.assign(restoreSession, item.sessionData);
    updateFlowchartSession(restoreSession);
  }, [flowchartSession, updateFlowchartSession]);

  const handleDeleteSaved = useCallback((id: string) => {
    setSavedFlowcharts(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleRenameSaved = useCallback((id: string, newTitle: string) => {
    setSavedFlowcharts(prev => prev.map(f => f.id === id ? { ...f, title: newTitle } : f));
  }, []);

  const handleCategoryChange = useCallback((id: string, newCategory: string) => {
    setSavedFlowcharts(prev => prev.map(f => f.id === id ? { ...f, category: newCategory } : f));
  }, []);

  const handleGenerate = async () => {
    if (!description.trim() || isGenerating) return;
    setAiStatus?.(t('flowchart.analyzingProcess'));
    try {
      console.log('[Flowchart] 开始 AI 工艺建模...', { descLength: description.length, scaleFactor, targetTrl: flowchartSession.targetTrl, detailLevel: flowchartSession.detailLevel });
      await runFlowchartModeling();
      console.log('[Flowchart] AI 建模完成，currentFlowchart 已更新');
      showToast?.({ message: t('flowchart.modelingSuccess'), type: 'success' });
    } catch (err: any) {
      console.error('[Flowchart] AI 建模失败:', err);
      showToast?.({ message: `工艺建模失败: ${err?.message || '请检查 API 密钥和网络连接'}`, type: 'error' });
    } finally { setAiStatus?.(null); }
  };

  const handleGenerateBOM = async () => {
    if (!currentFlowchart?.steps?.length || isGeneratingBOM) return;
    setAiStatus?.('正在生成物料清单（BOM）...');
    try {
      await runFlowchartBOM();
      showToast?.({ message: 'BOM 物料清单生成成功', type: 'success' });
    } catch (err: any) {
      showToast?.({ message: `BOM 生成失败: ${err?.message || '请重试'}`, type: 'error' });
    } finally { setAiStatus?.(null); }
  };

  const handleUploadLiterature = async (file: File) => {
    await startGlobalTask({ id: 'lit_parse', type: 'writing_assist', status: 'running', title: t('flowchart.parsingLiterature') }, async () => {
      try {
        setAiStatus?.(t('flowchart.extractingParams'));
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        const base64Data = await base64Promise;
        const extractedDesc = await parseLiteratureForProcess(base64Data, file.type);
        if (extractedDesc) {
          updateFlowchartSession({ description: extractedDesc });
          showToast?.({ message: t('flowchart.literatureExtractSuccess'), type: 'success' });
        }
      } finally { setAiStatus?.(null); }
    });
  };

  const handleExportPDF = async () => {
    if (!flowchartRef.current || !currentFlowchart) return;
    setShowExportMenu(false);
    if (showToast) showToast({ message: t('flowchart.generatingPDF'), type: 'info' });
    await printElement(flowchartRef.current, `${currentFlowchart.title}_Digital_Archive`);
  };

  const handleExportImage = async () => {
    if (!flowchartRef.current) return;
    try {
      const dataUrl = await htmlToImage.toPng(flowchartRef.current, { backgroundColor: '#ffffff', pixelRatio: 3, cacheBust: true });
      saveAs(dataUrl, `Flowchart_${Date.now()}.png`);
    } catch (e) { console.error(e); }
    setShowExportMenu(false);
  };

  const handleSaveToLibrary = () => {
    if (!currentFlowchart || !saveTitle.trim()) return;
    // 构建 session 快照（排除 currentFlowchart 避免循环引用）
    const { currentFlowchart: _omit, ...sessionRest } = flowchartSession;
    const updatedFlowchart: SavedFlowchart = {
      ...currentFlowchart,
      title: saveTitle,
      timestamp: new Date().toLocaleString(),
      sessionData: sessionRest
    };
    const newList = [updatedFlowchart, ...savedFlowcharts.filter(f => f.id !== updatedFlowchart.id)];
    setSavedFlowcharts(newList);
    localStorage.setItem('sciflow_saved_flowcharts', JSON.stringify(newList));
    updateFlowchartSession({ currentFlowchart: updatedFlowchart });
    setShowSaveNamingModal(false);
    showToast?.({ message: t('flowchart.savedToLibrary'), type: 'success' });
  };

  const handleBOMEdit = (materialId: string, field: 'name' | 'amount' | 'price' | 'unit', value: string) => {
    if (!currentFlowchart) return;
    const updatedSteps = currentFlowchart.steps.map(step => ({
      ...step,
      bomItems: step.bomItems?.map(item => {
        if (item.name !== materialId) return item;
        if (field === 'price') return { ...item, estimatedCost: parseFloat(value) || 0 };
        if (field === 'amount') return { ...item, amount: value };
        if (field === 'unit') return { ...item, unit: value };
        return { ...item, [field]: value };
      })
    }));
    updateFlowchartSession({ currentFlowchart: { ...currentFlowchart, steps: updatedSteps } });
  };

  const handleStepEdit = (stepId: string, updates: Partial<FlowchartStep>, index?: number) => {
    if (!currentFlowchart) return;
    const updatedSteps = currentFlowchart.steps.map((step, idx) =>
      (step.id === stepId || (idx === index && !step.id)) ? { ...step, ...updates } : step
    );
    updateFlowchartSession({ currentFlowchart: { ...currentFlowchart, steps: updatedSteps } });
  };

  const handleStepSplit = async (step: FlowchartStep) => {
    if (!currentFlowchart || isSplittingStepId) return;
    setIsSplittingStepId(step.id);
    setAiStatus?.(t('flowchart.splittingStep'));
    try {
      const res = await splitFlowchartStep(step, scaleFactor, flowchartSession.detailLevel);
      if (res?.steps) {
        const stepIndex = currentFlowchart.steps.findIndex(s => s.id === step.id);
        if (stepIndex !== -1) {
          const newSteps = [...currentFlowchart.steps];
          const splitSteps = res.steps.map((s: any, i: number) => ({
            ...s,
            id: s.id || `split_${step.id}_${i}_${Date.now()}`
          }));
          newSteps.splice(stepIndex, 1, ...splitSteps);
          updateFlowchartSession({ currentFlowchart: { ...currentFlowchart, steps: newSteps } });
          showToast?.({ message: t('flowchart.splitSuccess'), type: 'success' });
        }
      }
    } catch (err) {
      showToast?.({ message: t('flowchart.splitError'), type: 'error' });
    } finally {
      setIsSplittingStepId(null);
      setAiStatus?.(null);
    }
  };

  const handleSyncToProject = () => {
    if (!currentFlowchart || !targetProjectId) return;
    const project = projects.find(p => p.id === targetProjectId);
    if (!project) return;

    // ─────────────────────────────────────────────────────────────────
    // 全面的关键工艺参数提取器（精确标注来源步骤）
    // ─────────────────────────────────────────────────────────────────
    const extractStructuredParams = (
      description: string | undefined | null,
      stepLabel: string
    ): { key: string; value: string; reason: string }[] => {
      if (!description) return [];
      const extracted: { key: string; value: string; reason: string }[] = [];
      const src = `${t('flowchart.sourcePrefix')}${stepLabel}`;

      // ① 反应温度（支持范围写法）
      const tempMatch = description.match(/(?:温度|反应温度|Temp|temperature)[\s：:]*([–\-~～]?[\d.]+\s*(?:–|-|~|～)\s*[\d.]+\s*°C|[\d.]+\s*°C)/i);
      if (tempMatch) extracted.push({ key: t('flowchart.params.reactionTemp'), value: tempMatch[1].trim(), reason: `${t('flowchart.params.reactionTempReason')}${src}` });

      // ② 反应时间（支持 h/min/小时/分钟）
      const timeMatch = description.match(/(?:时间|反应时间|保温|Time|duration)[\s：:]*([–\-~～]?[\d.]+\s*(?:–|-|~|～)?\s*[\d.]*\s*(?:min|h|小时|分钟|分|hr))/i);
      if (timeMatch) extracted.push({ key: t('flowchart.params.reactionTime'), value: timeMatch[1].trim(), reason: `${t('flowchart.params.reactionTimeReason')}${src}` });

      // ③ 浓度/摩尔比（mol/L, M, mmol, molar）
      const concMatch = description.match(/(?:浓度|摩尔浓度|Conc|concentration)[\s：:]*([–\-~]?[\d.]+\s*(?:mol\/L|mmol\/L|M|mM))/i);
      if (concMatch) extracted.push({ key: t('flowchart.params.concentration'), value: concMatch[1].trim(), reason: `${t('flowchart.params.concentrationReason')}${src}` });

      // ④ 体积/用量（mL, L）
      const volMatch = description.match(/(?:体积|加入|用量|Volume|Vol)[\s：:]*([–\-~]?[\d.]+\s*(?:mL|L|μL|µL))/i);
      if (volMatch) extracted.push({ key: t('flowchart.params.volume'), value: volMatch[1].trim(), reason: `${t('flowchart.params.volumeReason')}${src}` });

      // ⑤ 质量/加料量（g, mg, kg）
      const massMatch = description.match(/(?:质量|加料|投料|mass|amount)[\s：:]*([–\-~]?[\d.]+\s*(?:kg|g|mg|μg))/i);
      if (massMatch) extracted.push({ key: t('flowchart.params.mass'), value: massMatch[1].trim(), reason: `${t('flowchart.params.massReason')}${src}` });

      // ⑥ pH 值
      const phMatch = description.match(/(?:pH|酸碱度|pH值)[\s：:≈≈]*([–\-~]?[\d.]+\s*(?:–|-|~|～)?\s*[\d.]*)/i);
      if (phMatch) extracted.push({ key: t('flowchart.params.ph'), value: phMatch[1].trim(), reason: `${t('flowchart.params.phReason')}${src}` });

      // ⑦ 压力（atm, MPa, bar, kPa）
      const pressMatch = description.match(/(?:压力|pressure|分压|Pressure)[\s：:]*([–\-~]?[\d.]+\s*(?:MPa|kPa|atm|bar|Pa))/i);
      if (pressMatch) extracted.push({ key: t('flowchart.params.pressure'), value: pressMatch[1].trim(), reason: `${t('flowchart.params.pressureReason')}${src}` });

      // ⑧ 搅拌速度（rpm, r/min）
      const rpmMatch = description.match(/(?:搅拌|转速|rpm|r\/min|agitation)[\s：:]*([–\-~]?[\d.]+\s*(?:rpm|r\/min|r\/s))/i);
      if (rpmMatch) extracted.push({ key: t('flowchart.params.rpm'), value: rpmMatch[1].trim(), reason: `${t('flowchart.params.rpmReason')}${src}` });

      // ⑨ 煅烧/干燥温度（通常高于400°C）
      const calcMatch = description.match(/(?:煅烧|焙烧|干燥|退火|热处理|calcin|anneal|sinter)[\s：:]*(?:在\s*)?([–\-~]?[\d.]+\s*°C)/i);
      if (calcMatch) extracted.push({ key: t('flowchart.params.calcination'), value: calcMatch[1].trim(), reason: `${t('flowchart.params.calcinationReason')}${src}` });

      // ⑩ 升温速率 (°C/min)
      const rampMatch = description.match(/(?:升温速率|升温|ramp|heating rate)[\s：:]*([–\-~]?[\d.]+\s*°C\/min)/i);
      if (rampMatch) extracted.push({ key: t('flowchart.params.rampRate'), value: rampMatch[1].trim(), reason: `${t('flowchart.params.rampRateReason')}${src}` });

      // ⑪ 收率/产率（优化目标参数）
      const yieldMatch = description.match(/(?:收率|产率|Yield|效率)[\s：:]*([–\-~]?[\d.]+\s*%)/i);
      if (yieldMatch && !description.match(/wt%/i)) extracted.push({ key: t('flowchart.params.yield'), value: yieldMatch[1].trim(), reason: `${t('flowchart.params.yieldReason')}${src}` });

      // ⑫ 纯度（优化目标参数）
      const purityMatch = description.match(/(?:纯度|纯化|Purity|purity)[\s：:]*([–\-~]?[\d.]+\s*%)/i);
      if (purityMatch) extracted.push({ key: t('flowchart.params.purity'), value: purityMatch[1].trim(), reason: `${t('flowchart.params.purityReason')}${src}` });

      // ⑬ 摩尔比 / 化学计量比
      const ratioMatch = description.match(/(?:摩尔比|物料比|n\(|ratio|stoichiometry)[\s：:]*([^\s,，。]+:[\d.:]+)/i);
      if (ratioMatch) extracted.push({ key: t('flowchart.params.molarRatio'), value: ratioMatch[1].trim(), reason: `${t('flowchart.params.molarRatioReason')}${src}` });

      // ⑭ 电流密度 (mA/cm², A/m²)
      const currentMatch = description.match(/(?:电流密度|current density|电流)[\s：:]*([–\-~]?[\d.]+\s*(?:mA\/cm²|A\/m²|A\/cm²|mA\/g))/i);
      if (currentMatch) extracted.push({ key: '电流密度 (Current Density)', value: currentMatch[1].trim(), reason: `电化学关键操作参数 — ${src}` });

      // ⑮ 比表面积 (m²/g)
      const ssaMatch = description.match(/(?:比表面积|BET|surface area|SSA)[\s：:]*([–\-~]?[\d.]+\s*(?:m²\/g|cm²\/g))/i);
      if (ssaMatch) extracted.push({ key: '比表面积 (BET)', value: ssaMatch[1].trim(), reason: `材料物理性质关键指标 — ${src}` });

      // ⑯ 粒径 (nm, μm)
      const sizeMatch = description.match(/(?:粒径|粒度|particle size|D50|直径|diameter)[\s：:]*([–\-~]?[\d.]+\s*(?:nm|μm|µm|mm))/i);
      if (sizeMatch) extracted.push({ key: '粒径/尺寸 (Particle Size)', value: sizeMatch[1].trim(), reason: `形貌结构关键参数 — ${src}` });

      // ⑰ 催化剂负载量 (wt%, mg/cm²)
      const loadingMatch = description.match(/(?:负载量|loading|担载|wt)[\s：:]*([–\-~]?[\d.]+\s*(?:wt%|mg\/cm²|%|mg))/i);
      if (loadingMatch) extracted.push({ key: '催化剂负载量 (Loading)', value: loadingMatch[1].trim(), reason: `催化剂制备核心参数 — ${src}` });

      // ⑱ 气氛/保护气
      const atmoMatch = description.match(/(?:气氛|atmosphere|保护气|通气|气体环境)[\s：:]*((?:N2|Ar|H2|O2|Air|空气|氮气|氩气|氢气|混合气体)[^\s,。，]*)(?:\s|,|。|，|$)/i);
      if (atmoMatch) extracted.push({ key: '反应气氛 (Atmosphere)', value: atmoMatch[1].trim(), reason: `环境控制参数 — ${src}` });

      // ⑲ 转速/离心 (rpm, g)
      const centMatch = description.match(/(?:离心|centrifug)[\s：:]*([–\-~]?[\d.]+\s*(?:rpm|×g|g|r\/min))/i);
      if (centMatch) extracted.push({ key: '离心转速 (Centrifuge)', value: centMatch[1].trim(), reason: `分离纯化操作参数 — ${src}` });

      // ⑳ 膜厚/涂层厚度 (nm, μm)
      const thickMatch = description.match(/(?:膜厚|厚度|thickness|film thickness|涂层)[\s：:]*([–\-~]?[\d.]+\s*(?:nm|μm|µm|mm))/i);
      if (thickMatch) extracted.push({ key: '膜厚/涂层 (Thickness)', value: thickMatch[1].trim(), reason: `薄膜/涂层工艺参数 — ${src}` });

      return extracted;
    };

    // 从所有步骤中批量提取，携带步骤序号标签
    const stepParams = currentFlowchart.steps.flatMap((s, idx) =>
      extractStructuredParams(s.description, t('flowchart.stepLabel', { idx: idx + 1, name: s.text }))
    );

    // 优化目标参数关键词集合
    const OPTIMIZED_KEYS = new Set([t('flowchart.params.yield'), t('flowchart.params.purity'), 'Conversion Rate', 'Selectivity', 'Surface Area', 'Pore Volume', 'Particle Size', '转化率', '选择性', '比表面积', '孔体积', '粒径分布']);
    const isOptimizedParam = (key: string) => OPTIMIZED_KEYS.has(key) || key.includes('收率') || key.includes('纯度') || key.includes('效率') || key.includes('Yield') || key.includes('Purity');

    // Helper：按 key+value 去重
    const deduplicate = (params: { key: string; value: string; reason: string }[]) => {
      const seen = new Set<string>();
      return params.filter(p => {
        const id = `${p.key}_${p.value}`;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    };

    // AI 直接生成的参数优先（权重最高），再合并步骤提取参数
    const aiOptimized = (currentFlowchart.optimizedParameters || []).map(p => ({
      ...p,
      reason: p.reason || t('flowchart.aiGlobalOptimization')
    }));
    const aiControl = (currentFlowchart.controlParameters || []).map(p => ({
      ...p,
      reason: p.reason || t('flowchart.aiGlobalConstraint')
    }));

    const allOptimized = deduplicate([
      ...aiOptimized,
      ...stepParams.filter(p => isOptimizedParam(p.key))
    ]);
    const allControl = deduplicate([
      ...aiControl,
      ...stepParams.filter(p => !isOptimizedParam(p.key))
    ]);

    // 按详情模式决定参数输出上限
    const limit = flowchartSession.detailLevel === 'detailed' ? 14 : 9;
    const mergedOptimizedParams = allOptimized.slice(0, limit);
    const mergedControlParams = allControl.slice(0, limit);

    const newProposal: TransformationProposal = {
      id: Date.now().toString(),
      literatureId: 'FLOW_GEN',
      literatureTitle: t('flowchart.digitalPreview'),
      timestamp: new Date().toLocaleString(),
      title: currentFlowchart.title,
      status: 'main',
      processChanges: currentFlowchart.originalDescription,
      newFlowchart: currentFlowchart.steps.map(s => ({ step: s.text, action: s.description })),
      optimizedParameters: mergedOptimizedParams,
      controlParameters: mergedControlParams,
      scientificHypothesis: t('flowchart.digitalPreviewHypothesis')
    };
    onUpdateProject({ ...project, proposals: [newProposal, ...(project.proposals || [])] });
    setShowSyncModal(false);
    navigate('project_detail', targetProjectId, 'process');
  };

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-white text-slate-800">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 no-print px-8 py-6">
        <div>
          <h2 className="text-4xl font-black text-slate-800 italic uppercase leading-tight tracking-tighter">{t('flowchart.title')} <span className="text-indigo-600 font-mono text-sm ml-2">v2.5</span></h2>
          <p className="text-slate-500 font-bold mt-1 text-xs uppercase tracking-widest opacity-60">Digital Scale-up & BOM Engine</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} disabled={!currentFlowchart} className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-[13px] font-black uppercase shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-2">
              <i className="fa-solid fa-file-export"></i> {t('flowchart.export')} <i className={`fa-solid fa-chevron-down transition-transform ${showExportMenu ? 'rotate-180' : ''}`}></i>
            </button>
            {showExportMenu && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-[200] animate-reveal">
                <button onClick={handleExportImage} className="w-full text-left px-5 py-4 hover:bg-slate-50 text-[10px] font-black uppercase text-slate-700 flex items-center gap-3 border-b border-slate-50"><i className="fa-solid fa-image text-rose-500"></i> {t('flowchart.exportImage')}</button>
                <button onClick={handleExportPDF} className="w-full text-left px-5 py-4 hover:bg-slate-50 text-[10px] font-black uppercase text-slate-700 flex items-center gap-3"><i className="fa-solid fa-file-pdf text-rose-600"></i> {t('flowchart.exportPDF')}</button>
              </div>
            )}
          </div>
          <button onClick={() => {
            let autoTitle = currentFlowchart?.title;
            if (!autoTitle || autoTitle === t('flowchart.digitalPreview') || autoTitle === '提取的未命名方案' || autoTitle === '未命名流程图' || autoTitle === 'Extracted Process Scheme' || autoTitle === 'Digital Process Preview' || autoTitle === '数字化工艺预演方案') {
              const firstLine = description?.split('\n').map(l => l.trim()).find(l => l.length > 3);
              if (firstLine) autoTitle = firstLine.replace(/^['"【\[#*]+|['"】\]#*]+$/g, '').substring(0, 20);
            }
            setSaveTitle(autoTitle || t('flowchart.defaultSaveTitle'));
            setShowSaveNamingModal(true);
          }} disabled={!currentFlowchart} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[13px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all active:scale-95 flex items-center gap-2 shadow-sm">
            <i className="fa-solid fa-floppy-disk"></i> {t('flowchart.saveToLibrary')}
          </button>
          <button onClick={() => setShowLibrary(true)} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[13px] font-black uppercase hover:bg-slate-50 transition-all active:scale-95 shadow-sm">{t('flowchart.processLibrary')}</button>
          <button onClick={() => setShowSyncModal(true)} disabled={!currentFlowchart} className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[13px] font-black uppercase shadow-lg active:scale-95 disabled:opacity-50">{t('flowchart.pushTopology')}</button>
        </div>
      </header>

      <div className="flex-1 flex flex-row gap-4 px-6 pb-4 overflow-hidden min-h-0">
        <FlowchartInput
          description={description}
          setDescription={(v) => updateFlowchartSession({ description: v })}
          scaleFactor={scaleFactor}
          setScaleFactor={(v) => updateFlowchartSession({ scaleFactor: v })}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
          onUploadLiterature={handleUploadLiterature}
          isUploading={isUploading}
          detailLevel={flowchartSession.detailLevel || 'concise'}
          setDetailLevel={(v) => updateFlowchartSession({ detailLevel: v })}
        />
        <FlowchartVisualizer
          flowchart={currentFlowchart}
          activeStepId={activeStepId}
          setActiveStepId={(v) => updateFlowchartSession({ activeStepId: v })}
          onContextMenu={() => { }}
          doeArchives={[]}
          containerRef={flowchartRef as React.RefObject<HTMLDivElement>}
          onStepEdit={handleStepEdit}
          onStepSplit={handleStepSplit}
          isSplittingStepId={isSplittingStepId}
          onGenerateBOM={handleGenerateBOM}
          isGeneratingBOM={isGeneratingBOM}
        />
        <IndustrialAssessment
          flowchart={currentFlowchart}
          onBOMEdit={handleBOMEdit}
          productionValue={productionValue}
          setProductionValue={(v) => updateFlowchartSession({ productionValue: v })}
          unitLabel={unitLabel as any}
          setUnitLabel={(v) => updateFlowchartSession({ unitLabel: v as any })}
          includeMaterialCost={includeMaterialCost}
          setIncludeMaterialCost={(v) => updateFlowchartSession({ includeMaterialCost: v })}
          includeOperationCost={includeOperationCost}
          setIncludeOperationCost={(v) => updateFlowchartSession({ includeOperationCost: v })}
        />
      </div>

      <SafetyDashboard description={description} />

      <SchemeLibraryModal<SavedFlowchart>
        show={showLibrary}
        onClose={() => setShowLibrary(false)}
        items={savedFlowcharts}
        onLoad={handleLoadSaved}
        onDelete={(id) => handleDeleteSaved(id)}
        onRename={handleRenameSaved}
        onCategoryChange={handleCategoryChange}
        moduleIcon="fa-route"
        moduleLabel="实验路线"
        renderExtra={(item) => (
          <span className="text-[8px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-full">
            TRL {item.trlLevel} · {item.steps?.length || 0} 步骤
          </span>
        )}
      />

      {showSaveNamingModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xs rounded-xl p-6 animate-reveal shadow-2xl border-4 border-white">
            <h3 className="text-sm font-black text-slate-800 mb-4 uppercase italic border-l-4 border-indigo-600 pl-3">{t('flowchart.saveScheme')}</h3>
            <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none mb-4 focus:border-indigo-300" value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder={t('flowchart.schemePlaceholder')} autoFocus />
            <div className="flex gap-3">
              <button onClick={() => setShowSaveNamingModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[11px] font-black uppercase">{t('flowchart.cancel')}</button>
              <button onClick={handleSaveToLibrary} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase shadow-xl">{t('flowchart.save')}</button>
            </div>
          </div>
        </div>
      )}

      {showSyncModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[3000] flex items-center justify-center p-4 no-print">
          <div className="bg-white w-full max-w-xs rounded-xl p-6 animate-reveal shadow-2xl border-4 border-white">
            <h3 className="text-sm font-black text-slate-800 mb-4 uppercase italic border-l-4 border-indigo-600 pl-3">{t('flowchart.syncToProject')}</h3>
            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none mb-4 appearance-none cursor-pointer" value={targetProjectId} onChange={e => setTargetProjectId(e.target.value)}>
              <option value="">{t('flowchart.selectProjectPlaceholder')}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowSyncModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase">{t('flowchart.cancel')}</button>
              <button onClick={handleSyncToProject} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl">{t('flowchart.confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
