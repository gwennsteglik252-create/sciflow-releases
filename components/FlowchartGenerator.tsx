
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { parseLiteratureForProcess, splitFlowchartStep } from '../services/gemini/flowchart';
import { SavedFlowchart, FlowchartStep, ResearchProject, AppView, SavedDOE, TransformationProposal, AiTask } from '../types';
import * as htmlToImage from 'html-to-image';
import { useProjectContext } from '../context/ProjectContext';
import { exportToWord } from '../utils/documentExport';
import saveAs from 'file-saver';
import { printElement } from '../utils/printUtility';

import { FlowchartInput } from './Flowchart/FlowchartInput';
import { FlowchartVisualizer } from './Flowchart/FlowchartVisualizer';
import { IndustrialAssessment } from './Flowchart/IndustrialAssessment';
import { SafetyDashboard } from './Flowchart/SafetyDashboard';

export const FlowchartGenerator: React.FC<{
  projects: ResearchProject[];
  onUpdateProject: (updated: ResearchProject) => void;
  navigate: (view: AppView, projectId?: string, subView?: string) => void;
}> = ({ projects = [], onUpdateProject, navigate }) => {
  const { flowchartSession, updateFlowchartSession, runFlowchartModeling, setAiStatus, showToast, startGlobalTask, activeTasks } = useProjectContext();

  const [isSplittingStepId, setIsSplittingStepId] = useState<string | null>(null);

  const {
    description, currentFlowchart, scaleFactor, targetTrl,
    productionValue, unitLabel, includeMaterialCost, includeOperationCost,
    activeStepId
  } = flowchartSession;

  const isGenerating = useMemo(() => activeTasks.some(t => t.id === 'flowchart_modeling'), [activeTasks]);
  const isUploading = useMemo(() => activeTasks.some(t => t.id === 'lit_parse'), [activeTasks]);

  const flowchartRef = useRef<HTMLDivElement>(null);

  const [savedFlowcharts, setSavedFlowcharts] = useState<SavedFlowchart[]>(() => {
    const saved = localStorage.getItem('sciflow_saved_flowcharts');
    return saved ? JSON.parse(saved) : [];
  });

  const [showLibrary, setShowLibrary] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showSaveNamingModal, setShowSaveNamingModal] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [targetProjectId, setTargetProjectId] = useState('');

  const handleGenerate = async () => {
    if (!description.trim() || isGenerating) return;
    setAiStatus?.('🧪 正在解析工艺逻辑并计算物料流...');
    try {
      await runFlowchartModeling();
      showToast?.({ message: '工艺数字化建模成功', type: 'success' });
    } catch (err) {
      showToast?.({ message: '模型解算异常', type: 'error' });
    } finally { setAiStatus?.(null); }
  };

  const handleUploadLiterature = async (file: File) => {
    await startGlobalTask({ id: 'lit_parse', type: 'writing_assist', status: 'running', title: '正在解析文献工艺路线...' }, async () => {
      try {
        setAiStatus?.('🧠 正在从文献中提取详细工艺参数与步骤...');
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        const base64Data = await base64Promise;
        const extractedDesc = await parseLiteratureForProcess(base64Data, file.type);
        if (extractedDesc) {
          updateFlowchartSession({ description: extractedDesc });
          showToast?.({ message: '文献工艺提取成功', type: 'success' });
        }
      } finally { setAiStatus?.(null); }
    });
  };

  const handleExportPDF = async () => {
    if (!flowchartRef.current || !currentFlowchart) return;
    setShowExportMenu(false);
    if (showToast) showToast({ message: '正在生成矢量级工艺档案 PDF...', type: 'info' });
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
    const updatedFlowchart = { ...currentFlowchart, title: saveTitle, timestamp: new Date().toLocaleString() };
    const newList = [updatedFlowchart, ...savedFlowcharts.filter(f => f.id !== updatedFlowchart.id)];
    setSavedFlowcharts(newList);
    localStorage.setItem('sciflow_saved_flowcharts', JSON.stringify(newList));
    updateFlowchartSession({ currentFlowchart: updatedFlowchart });
    setShowSaveNamingModal(false);
    showToast?.({ message: '已保存至工艺库', type: 'success' });
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
    setAiStatus?.('🧠 AI 正在深度拆分工艺步骤...');
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
          showToast?.({ message: '工艺步骤已智能拆分', type: 'success' });
        }
      }
    } catch (err) {
      showToast?.({ message: '拆分操作异常', type: 'error' });
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
      const src = `来源：${stepLabel}`;

      // ① 反应温度（支持范围写法）
      const tempMatch = description.match(/(?:温度|反应温度|Temp|temperature)[\s：:]*([–\-~～]?[\d.]+\s*(?:–|-|~|～)\s*[\d.]+\s*°C|[\d.]+\s*°C)/i);
      if (tempMatch) extracted.push({ key: '反应温度', value: tempMatch[1].trim(), reason: `关键热力学参数，控制反应速率与副反应抑制。${src}` });

      // ② 反应时间（支持 h/min/小时/分钟）
      const timeMatch = description.match(/(?:时间|反应时间|保温|Time|duration)[\s：:]*([–\-~～]?[\d.]+\s*(?:–|-|~|～)?\s*[\d.]*\s*(?:min|h|小时|分钟|分|hr))/i);
      if (timeMatch) extracted.push({ key: '反应时间', value: timeMatch[1].trim(), reason: `控制转化率与产物结晶度的核心时间窗口。${src}` });

      // ③ 浓度/摩尔比（mol/L, M, mmol, molar）
      const concMatch = description.match(/(?:浓度|摩尔浓度|Conc|concentration)[\s：:]*([–\-~]?[\d.]+\s*(?:mol\/L|mmol\/L|M|mM))/i);
      if (concMatch) extracted.push({ key: '反应物浓度', value: concMatch[1].trim(), reason: `影响反应动力学与选择性的关键浓度参数。${src}` });

      // ④ 体积/用量（mL, L）
      const volMatch = description.match(/(?:体积|加入|用量|Volume|Vol)[\s：:]*([–\-~]?[\d.]+\s*(?:mL|L|μL|µL))/i);
      if (volMatch) extracted.push({ key: '溶剂/试剂用量', value: volMatch[1].trim(), reason: `决定反应物总量与混合均匀度。${src}` });

      // ⑤ 质量/加料量（g, mg, kg）
      const massMatch = description.match(/(?:质量|加料|投料|mass|amount)[\s：:]*([–\-~]?[\d.]+\s*(?:kg|g|mg|μg))/i);
      if (massMatch) extracted.push({ key: '物料投量', value: massMatch[1].trim(), reason: `规模化放大的关键基准投料量。${src}` });

      // ⑥ pH 值
      const phMatch = description.match(/(?:pH|酸碱度|pH值)[\s：:≈≈]*([–\-~]?[\d.]+\s*(?:–|-|~|～)?\s*[\d.]*)/i);
      if (phMatch) extracted.push({ key: 'pH 值', value: phMatch[1].trim(), reason: `影响催化活性与产物稳定性的关键酸碱环境参数。${src}` });

      // ⑦ 压力（atm, MPa, bar, kPa）
      const pressMatch = description.match(/(?:压力|pressure|分压|Pressure)[\s：:]*([–\-~]?[\d.]+\s*(?:MPa|kPa|atm|bar|Pa))/i);
      if (pressMatch) extracted.push({ key: '操作压力', value: pressMatch[1].trim(), reason: `高压/低压环境对相平衡及气体溶解度的关键控制参数。${src}` });

      // ⑧ 搅拌速度（rpm, r/min）
      const rpmMatch = description.match(/(?:搅拌|转速|rpm|r\/min|agitation)[\s：:]*([–\-~]?[\d.]+\s*(?:rpm|r\/min|r\/s))/i);
      if (rpmMatch) extracted.push({ key: '搅拌转速', value: rpmMatch[1].trim(), reason: `影响传质效率与颗粒均匀度的关键混合参数。${src}` });

      // ⑨ 煅烧/干燥温度（通常高于400°C）
      const calcMatch = description.match(/(?:煅烧|焙烧|干燥|退火|热处理|calcin|anneal|sinter)[\s：:]*(?:在\s*)?([–\-~]?[\d.]+\s*°C)/i);
      if (calcMatch) extracted.push({ key: '煅烧/干燥温度', value: calcMatch[1].trim(), reason: `决定产物晶相转变、比表面积与骨架稳定性的热处理核心参数。${src}` });

      // ⑩ 升温速率 (°C/min)
      const rampMatch = description.match(/(?:升温速率|升温|ramp|heating rate)[\s：:]*([–\-~]?[\d.]+\s*°C\/min)/i);
      if (rampMatch) extracted.push({ key: '升温速率', value: rampMatch[1].trim(), reason: `控制结晶与相变晶粒生长均匀性的程序升温关键参数。${src}` });

      // ⑪ 收率/产率（优化目标参数）
      const yieldMatch = description.match(/(?:收率|产率|Yield|效率)[\s：:]*([–\-~]?[\d.]+\s*%)/i);
      if (yieldMatch && !description.match(/wt%/i)) extracted.push({ key: '预期收率', value: yieldMatch[1].trim(), reason: `表征合成效率的核心性能指标基准值。${src}` });

      // ⑫ 纯度（优化目标参数）
      const purityMatch = description.match(/(?:纯度|纯化|Purity|purity)[\s：:]*([–\-~]?[\d.]+\s*%)/i);
      if (purityMatch) extracted.push({ key: '产品纯度', value: purityMatch[1].trim(), reason: `产品品质的核心品控指标，影响下游应用性能。${src}` });

      // ⑬ 摩尔比 / 化学计量比
      const ratioMatch = description.match(/(?:摩尔比|物料比|n\(|ratio|stoichiometry)[\s：:]*([^\s,，。]+:[\d.:]+)/i);
      if (ratioMatch) extracted.push({ key: '摩尔投料比', value: ratioMatch[1].trim(), reason: `决定转化率与选择性的关键化学计量参数。${src}` });

      return extracted;
    };

    // 从所有步骤中批量提取，携带步骤序号标签
    const stepParams = currentFlowchart.steps.flatMap((s, idx) =>
      extractStructuredParams(s.description, `步骤${idx + 1}「${s.text}」`)
    );

    // 优化目标参数关键词集合
    const OPTIMIZED_KEYS = new Set(['预期收率', '产品纯度', '转化率', '选择性', '比表面积', '孔体积', '粒径分布']);
    const isOptimizedParam = (key: string) => OPTIMIZED_KEYS.has(key) || key.includes('收率') || key.includes('纯度') || key.includes('效率');

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
      reason: p.reason || '基于全局工艺模型优化预测'
    }));
    const aiControl = (currentFlowchart.controlParameters || []).map(p => ({
      ...p,
      reason: p.reason || '基于全局工艺约束分析推荐'
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
      literatureTitle: '数字化工艺预演',
      timestamp: new Date().toLocaleString(),
      title: currentFlowchart.title,
      status: 'main',
      processChanges: currentFlowchart.originalDescription,
      newFlowchart: currentFlowchart.steps.map(s => ({ step: s.text, action: s.description })),
      optimizedParameters: mergedOptimizedParams,
      controlParameters: mergedControlParams,
      scientificHypothesis: '基于数字化预演生成的工艺路线'
    };
    onUpdateProject({ ...project, proposals: [newProposal, ...(project.proposals || [])] });
    setShowSyncModal(false);
    navigate('project_detail', targetProjectId, 'process');
  };

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-white text-slate-800">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 no-print px-8 py-6">
        <div>
          <h2 className="text-4xl font-black text-slate-800 italic uppercase leading-tight tracking-tighter">工业工艺实验室 <span className="text-indigo-600 font-mono text-sm ml-2">v2.5</span></h2>
          <p className="text-slate-500 font-bold mt-1 text-xs uppercase tracking-widest opacity-60">Digital Scale-up & BOM Engine</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} disabled={!currentFlowchart} className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-[13px] font-black uppercase shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-2">
              <i className="fa-solid fa-file-export"></i> 导出 <i className={`fa-solid fa-chevron-down transition-transform ${showExportMenu ? 'rotate-180' : ''}`}></i>
            </button>
            {showExportMenu && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-[200] animate-reveal">
                <button onClick={handleExportImage} className="w-full text-left px-5 py-4 hover:bg-slate-50 text-[10px] font-black uppercase text-slate-700 flex items-center gap-3 border-b border-slate-50"><i className="fa-solid fa-image text-rose-500"></i> 导出高清图片</button>
                <button onClick={handleExportPDF} className="w-full text-left px-5 py-4 hover:bg-slate-50 text-[10px] font-black uppercase text-slate-700 flex items-center gap-3"><i className="fa-solid fa-file-pdf text-rose-600"></i> 下载 PDF 档案</button>
              </div>
            )}
          </div>
          <button onClick={() => {
            let autoTitle = currentFlowchart?.title;
            if (!autoTitle || autoTitle === '数字化工艺预演方案' || autoTitle === '提取的未命名方案' || autoTitle === '未命名流程图') {
              const firstLine = description?.split('\n').map(l => l.trim()).find(l => l.length > 3);
              if (firstLine) autoTitle = firstLine.replace(/^['"【\[#*]+|['"】\]#*]+$/g, '').substring(0, 20);
            }
            setSaveTitle(autoTitle || '提取的工艺方案');
            setShowSaveNamingModal(true);
          }} disabled={!currentFlowchart} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[13px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all active:scale-95 flex items-center gap-2 shadow-sm">
            <i className="fa-solid fa-floppy-disk"></i> 保存到库
          </button>
          <button onClick={() => setShowLibrary(true)} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[13px] font-black uppercase hover:bg-slate-50 transition-all active:scale-95 shadow-sm">工艺库</button>
          <button onClick={() => setShowSyncModal(true)} disabled={!currentFlowchart} className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[13px] font-black uppercase shadow-lg active:scale-95 disabled:opacity-50">推送拓扑</button>
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

      {showLibrary && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[80vh]">
            <h3 className="text-xl font-black text-slate-800 mb-6 uppercase italic border-l-4 border-indigo-600 pl-4">工艺方案库</h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
              {savedFlowcharts.map(f => (
                <div key={f.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group hover:border-indigo-300 transition-all cursor-pointer" onClick={() => { updateFlowchartSession({ currentFlowchart: f, description: f.originalDescription }); setShowLibrary(false); }}>
                  <div className="flex-1">
                    <p className="text-[11px] font-black text-slate-800 uppercase">{f.title}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">{f.timestamp} · TRL {f.trlLevel}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setSavedFlowcharts(savedFlowcharts.filter(item => item.id !== f.id)); }} className="w-8 h-8 rounded-lg bg-white text-rose-300 hover:text-rose-500"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                </div>
              ))}
            </div>
            <button onClick={() => setShowLibrary(false)} className="mt-6 w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase">关闭</button>
          </div>
        </div>
      )}

      {showSaveNamingModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 animate-reveal shadow-2xl border-4 border-white">
            <h3 className="text-sm font-black text-slate-800 mb-4 uppercase italic border-l-4 border-indigo-600 pl-3">保存工艺方案</h3>
            <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none mb-4 focus:border-indigo-300" value={saveTitle} onChange={e => setSaveTitle(e.target.value)} placeholder="方案名称..." autoFocus />
            <div className="flex gap-3">
              <button onClick={() => setShowSaveNamingModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[11px] font-black uppercase">取消</button>
              <button onClick={handleSaveToLibrary} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase shadow-xl">保存</button>
            </div>
          </div>
        </div>
      )}

      {showSyncModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[3000] flex items-center justify-center p-4 no-print">
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 animate-reveal shadow-2xl border-4 border-white">
            <h3 className="text-sm font-black text-slate-800 mb-4 uppercase italic border-l-4 border-indigo-600 pl-3">同步路线至课题</h3>
            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold outline-none mb-4 appearance-none cursor-pointer" value={targetProjectId} onChange={e => setTargetProjectId(e.target.value)}>
              <option value="">点击选择关联项目...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowSyncModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase">取消</button>
              <button onClick={handleSyncToProject} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl">确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
