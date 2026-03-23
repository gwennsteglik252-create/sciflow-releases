/**
 * ProcessLabView.tsx — 工业工艺实验室 主入口
 * P0：配方工作台 + 批次追踪
 * P1：工艺流程编辑器 + 良率看板
 * P2：成本分析引擎 + 中试放大模拟器
 * P3：AI 配方优化 + 报告与导出
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from '../../locales/useTranslation';
import { Formulation, FormulationComponent, TargetProperty, ProcessBatch, ProcessFlow, BatchStatus, ProcessParameterRecord, QualityCheckResult, FormulationStatus } from '../../types';
import { useProjectContext } from '../../context/ProjectContext';
import ProcessFlowDesigner from './ProcessFlowDesigner';
import YieldDashboard from './YieldDashboard';
import CostAnalysisEngine from './CostAnalysisEngine';
import ScaleUpSimulator from './ScaleUpSimulator';
import AIFormulaOptimizer from './AIFormulaOptimizer';
import ReportsExport from './ReportsExport';
import { DEMO_FORMULATIONS, DEMO_BATCHES, DEMO_FLOWS } from './demoData';

// ═══ 常量 ═══
// 这些常量现在将在函数内部使用 t() 来获取
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => new Date().toISOString().slice(0, 10);

// ═══ 主组件 ═══
const ProcessLabView: React.FC = () => {
  const { t } = useTranslation();
  const { showToast, projects, inventory } = useProjectContext();

  const COMPONENT_ROLES = [
    t('processLab.common.roles.precursor'),
    t('processLab.common.roles.solvent'),
    t('processLab.common.roles.additive'),
    t('processLab.common.roles.catalyst'),
    t('processLab.common.roles.substrate'),
    t('processLab.common.roles.binder'),
    t('processLab.common.roles.dispersant'),
    t('processLab.common.roles.other')
  ];

  const SCALE_LABELS: Record<string, string> = { 
    lab: t('processLab.common.lab'), 
    pilot: t('processLab.common.pilot'), 
    production: t('processLab.common.production') 
  };

  const STATUS_LABELS: Record<FormulationStatus, { label: string; color: string }> = {
    draft: { label: t('processLab.common.status.draft'), color: 'bg-slate-100 text-slate-600' },
    testing: { label: t('processLab.common.status.testing'), color: 'bg-amber-100 text-amber-700' },
    validated: { label: t('processLab.common.status.validated'), color: 'bg-emerald-100 text-emerald-700' },
    production: { label: t('processLab.common.status.production'), color: 'bg-indigo-100 text-indigo-700' },
    archived: { label: t('processLab.common.status.archived'), color: 'bg-slate-100 text-slate-500' },
  };

  const BATCH_STATUS_LABELS: Record<BatchStatus, { label: string; color: string; icon: string }> = {
    preparing: { label: t('processLab.common.status.preparing'), color: 'bg-slate-100 text-slate-600', icon: 'fa-hourglass-start' },
    in_progress: { label: t('processLab.common.status.in_progress'), color: 'bg-blue-100 text-blue-700', icon: 'fa-gears' },
    completed: { label: t('processLab.common.status.completed'), color: 'bg-emerald-100 text-emerald-700', icon: 'fa-circle-check' },
    rejected: { label: t('processLab.common.status.rejected'), color: 'bg-rose-100 text-rose-700', icon: 'fa-circle-xmark' },
    reworked: { label: t('processLab.common.status.reworked'), color: 'bg-amber-100 text-amber-700', icon: 'fa-rotate' },
  };

  // ─── Tab 切换 ───
  const [activeTab, setActiveTab] = useState<'formulation' | 'batch' | 'flow' | 'yield_dashboard' | 'cost' | 'scaleup' | 'ai' | 'reports'>('formulation');

  // ─── 配方数据 ───
  const [formulations, setFormulations] = useState<Formulation[]>(() => {
    const saved = localStorage.getItem('sciflow_formulations');
    if (saved) { try { const parsed = JSON.parse(saved); if (parsed.length > 0) return parsed; } catch {} }
    return DEMO_FORMULATIONS;
  });
  useEffect(() => { localStorage.setItem('sciflow_formulations', JSON.stringify(formulations)); }, [formulations]);

  // ─── 批次数据 ───
  const [batches, setBatches] = useState<ProcessBatch[]>(() => {
    const saved = localStorage.getItem('sciflow_batches');
    if (saved) { try { const parsed = JSON.parse(saved); if (parsed.length > 0) return parsed; } catch {} }
    return DEMO_BATCHES;
  });
  useEffect(() => { localStorage.setItem('sciflow_batches', JSON.stringify(batches)); }, [batches]);

  // ─── 工艺流程数据 (P1) ───
  const [flows, setFlows] = useState<ProcessFlow[]>(() => {
    const saved = localStorage.getItem('sciflow_process_flows');
    if (saved) { try { const parsed = JSON.parse(saved); if (parsed.length > 0) return parsed; } catch {} }
    return DEMO_FLOWS;
  });
  useEffect(() => { localStorage.setItem('sciflow_process_flows', JSON.stringify(flows)); }, [flows]);

  // ─── 配方编辑状态 ───
  const [editingFormulation, setEditingFormulation] = useState<Formulation | null>(null);
  const [showFormulaModal, setShowFormulaModal] = useState(false);

  // ─── 批次编辑状态 ───
  const [editingBatch, setEditingBatch] = useState<ProcessBatch | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedFormulationId, setSelectedFormulationId] = useState('');

  // ─── 搜索 ───
  const [search, setSearch] = useState('');

  // ═══ 统计 ═══
  const stats = useMemo(() => {
    const completedBatches = batches.filter(b => b.status === 'completed');
    const avgYield = completedBatches.length > 0
      ? completedBatches.reduce((s, b) => s + b.yield, 0) / completedBatches.length : 0;
    const avgCpk = completedBatches.filter(b => b.cpk).length > 0
      ? completedBatches.filter(b => b.cpk).reduce((s, b) => s + (b.cpk || 0), 0) / completedBatches.filter(b => b.cpk).length : 0;
    return {
      totalFormulations: formulations.length,
      activeFormulations: formulations.filter(f => f.status !== 'archived').length,
      totalBatches: batches.length,
      completedBatches: completedBatches.length,
      avgYield: Math.round(avgYield * 10) / 10,
      avgCpk: Math.round(avgCpk * 100) / 100,
      passRate: completedBatches.length > 0
        ? Math.round((completedBatches.filter(b => b.yield >= 90).length / completedBatches.length) * 100) : 0,
    };
  }, [formulations, batches]);

  // ═══ 配方 CRUD ═══
  const handleNewFormulation = useCallback(() => {
    const f: Formulation = {
      id: genId(), name: '', version: 'v1.0', status: 'draft',
      components: [{ id: genId(), materialName: '', percentage: 0, amount: 0, unit: 'g', role: '前驱体' }],
      targetProperties: [], scaleLevel: 'lab', createdAt: today(), updatedAt: today(), tags: [],
    };
    setEditingFormulation(f);
    setShowFormulaModal(true);
  }, []);

  const handleEditFormulation = useCallback((f: Formulation) => {
    setEditingFormulation({ ...f, components: (f.components || []).map(c => ({ ...c })), targetProperties: (f.targetProperties || []).map(t => ({ ...t })) });
    setShowFormulaModal(true);
  }, []);

  const handleSaveFormulation = useCallback(() => {
    if (!editingFormulation) return;
    if (!editingFormulation.name.trim()) { showToast({ message: '请输入配方名称', type: 'error' }); return; }
    const updated = { ...editingFormulation, updatedAt: today() };
    setFormulations(prev => {
      const idx = prev.findIndex(f => f.id === updated.id);
      return idx >= 0 ? prev.map(f => f.id === updated.id ? updated : f) : [updated, ...prev];
    });
    setShowFormulaModal(false);
    setEditingFormulation(null);
    showToast({ message: t('processLab.formulation.saved'), type: 'success' });
  }, [editingFormulation, showToast, t]);

  const handleDeleteFormulation = useCallback((id: string) => {
    setFormulations(prev => prev.filter(f => f.id !== id));
    showToast({ message: t('processLab.formulation.deleted'), type: 'info' });
  }, [showToast, t]);

  const handleDuplicateFormulation = useCallback((f: Formulation) => {
    const vNum = parseInt(f.version.replace(/[^\d]/g, '') || '1');
    const dup: Formulation = {
      ...f, id: genId(), version: `v${vNum + 1}.0`, parentId: f.id, status: 'draft',
      components: (f.components || []).map(c => ({ ...c, id: genId() })),
      targetProperties: (f.targetProperties || []).map(t => ({ ...t })),
      createdAt: today(), updatedAt: today(),
    };
    setFormulations(prev => [dup, ...prev]);
    showToast({ message: t('processLab.formulation.versionCreated', { version: dup.version }), type: 'success' });
  }, [showToast, t]);

  // ═══ 批次 CRUD ═══
  const handleNewBatch = useCallback(() => {
    const nextNum = `B-${new Date().getFullYear()}-${String(batches.length + 1).padStart(4, '0')}`;
    const b: ProcessBatch = {
      id: genId(), batchNumber: nextNum, formulationId: selectedFormulationId || '',
      parameters: [], qualityChecks: [], yield: 0, operator: '', status: 'preparing',
      startTime: today(), tags: [],
    };
    if (selectedFormulationId) {
      const f = formulations.find(x => x.id === selectedFormulationId);
      if (f) { b.formulationName = f.name; b.formulationVersion = f.version; }
    }
    setEditingBatch(b);
    setShowBatchModal(true);
  }, [batches.length, selectedFormulationId, formulations]);

  const handleEditBatch = useCallback((b: ProcessBatch) => {
    setEditingBatch({ ...b, parameters: (b.parameters || []).map(p => ({ ...p })), qualityChecks: (b.qualityChecks || []).map(q => ({ ...q })) });
    setShowBatchModal(true);
  }, []);

  const handleSaveBatch = useCallback(() => {
    if (!editingBatch) return;
    if (!editingBatch.batchNumber.trim()) { showToast({ message: '请输入批次号', type: 'error' }); return; }
    const updated = { ...editingBatch };
    // 自动填入配方名称
    if (updated.formulationId) {
      const f = formulations.find(x => x.id === updated.formulationId);
      if (f) { updated.formulationName = f.name; updated.formulationVersion = f.version; }
    }
    setBatches(prev => {
      const idx = prev.findIndex(b => b.id === updated.id);
      return idx >= 0 ? prev.map(b => b.id === updated.id ? updated : b) : [updated, ...prev];
    });
    setShowBatchModal(false);
    setEditingBatch(null);
    showToast({ message: t('processLab.batch.saved'), type: 'success' });
  }, [editingBatch, formulations, showToast, t]);

  const handleDeleteBatch = useCallback((id: string) => {
    setBatches(prev => prev.filter(b => b.id !== id));
    showToast({ message: t('processLab.batch.deleted'), type: 'info' });
  }, [showToast, t]);

  // ═══ 过滤 ═══
  const filteredFormulations = useMemo(() => {
    const s = search.toLowerCase();
    return formulations.filter(f => !s || f.name.toLowerCase().includes(s) || f.version.toLowerCase().includes(s) || f.tags?.some(t => t.toLowerCase().includes(s)));
  }, [formulations, search]);

  const filteredBatches = useMemo(() => {
    const s = search.toLowerCase();
    return batches.filter(b => !s || b.batchNumber.toLowerCase().includes(s) || b.formulationName?.toLowerCase().includes(s) || b.operator?.toLowerCase().includes(s));
  }, [batches, search]);

  // ═══ 渲染 ═══
  return (
    <div className="h-full flex flex-col gap-5 animate-reveal p-6 bg-slate-50/50 overflow-hidden">
      {/* ─── Header ─── */}
      <header className="flex flex-col gap-4 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="shrink-0 flex flex-col">
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic flex items-center gap-3">
              <i className="fa-solid fa-industry text-amber-600"></i> {t('processLab.view.title')}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 pl-10">PROCESS LAB · FORMULATION & BATCH MANAGEMENT</p>
          </div>
          {/* 统计卡片 */}
          <div className="flex gap-3 flex-wrap">
            {[
              { label: t('processLab.view.stats.totalFormulations'), value: stats.totalFormulations, icon: 'fa-flask', color: 'text-amber-600 bg-amber-50' },
              { label: t('processLab.view.stats.totalBatches'), value: stats.totalBatches, icon: 'fa-boxes-stacked', color: 'text-indigo-600 bg-indigo-50' },
              { label: t('processLab.view.stats.avgYield'), value: `${stats.avgYield}%`, icon: 'fa-chart-pie', color: 'text-emerald-600 bg-emerald-50' },
              { label: t('processLab.view.stats.passRate'), value: `${stats.passRate}%`, icon: 'fa-circle-check', color: 'text-blue-600 bg-blue-50' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm min-w-[130px]">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}><i className={`fa-solid ${s.icon} text-sm`}></i></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p><p className="text-lg font-black text-slate-800 leading-none mt-0.5">{s.value}</p></div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab 切换 + 搜索 + 新建按钮 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-200/50 p-1 rounded-xl flex gap-1 shadow-inner shrink-0 flex-wrap">
            <button onClick={() => setActiveTab('formulation')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${activeTab === 'formulation' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <i className="fa-solid fa-flask text-[9px]"></i>{t('processLab.view.tabs.formulation')}
            </button>
            <button onClick={() => setActiveTab('batch')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${activeTab === 'batch' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <i className="fa-solid fa-boxes-stacked text-[9px]"></i>{t('processLab.view.tabs.batch')}
            </button>
            <button onClick={() => setActiveTab('flow')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${activeTab === 'flow' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <i className="fa-solid fa-diagram-project text-[9px]"></i>{t('processLab.view.tabs.flow')}
            </button>
            <button onClick={() => setActiveTab('yield_dashboard')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${activeTab === 'yield_dashboard' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <i className="fa-solid fa-chart-pie text-[9px]"></i>{t('processLab.view.tabs.yield')}
            </button>
            <button onClick={() => setActiveTab('cost')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${activeTab === 'cost' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <i className="fa-solid fa-coins text-[9px]"></i>{t('processLab.view.tabs.cost')}
            </button>
            <button onClick={() => setActiveTab('scaleup')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${activeTab === 'scaleup' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <i className="fa-solid fa-expand text-[9px]"></i>{t('processLab.view.tabs.scaleup')}
            </button>
            <button onClick={() => setActiveTab('ai')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${activeTab === 'ai' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <i className="fa-solid fa-wand-magic-sparkles text-[9px]"></i>{t('processLab.view.tabs.ai')}
            </button>
            <button onClick={() => setActiveTab('reports')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${activeTab === 'reports' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <i className="fa-solid fa-file-lines text-[9px]"></i>{t('processLab.view.tabs.reports')}
            </button>
          </div>

          <div className="flex-1 flex items-center gap-2 bg-white rounded-xl px-4 py-2.5 border border-slate-200 shadow-sm focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100/50 transition-all min-w-[200px]">
            <i className="fa-solid fa-magnifying-glass text-slate-300 text-[10px]"></i>
            <input className="flex-1 bg-transparent border-none outline-none text-[11px] font-bold text-slate-600 placeholder:text-slate-400 placeholder:italic"
              placeholder={activeTab === 'formulation' ? t('processLab.view.searchFormulation') : activeTab === 'batch' ? t('processLab.view.searchBatch') : t('processLab.view.searchPlaceholder')}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {(activeTab === 'formulation' || activeTab === 'batch') && (
            <button onClick={activeTab === 'formulation' ? handleNewFormulation : handleNewBatch}
              className="px-5 py-2.5 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-amber-700 transition-all active:scale-95 flex items-center gap-2 shrink-0">
              <i className="fa-solid fa-plus"></i> {activeTab === 'formulation' ? t('processLab.view.newFormulation') : t('processLab.view.newBatch')}
            </button>
          )}
        </div>
      </header>

      {/* ─── 内容区 ─── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        {activeTab === 'formulation' ? (
          /* ═══ 配方列表 ═══ */
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 pb-12 content-start">
            {filteredFormulations.length > 0 ? filteredFormulations.map(f => (
              <div key={f.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all group flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${STATUS_LABELS[f.status].color}`}>{STATUS_LABELS[f.status].label}</span>
                      <span className="text-[8px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md uppercase">{f.version}</span>
                      <span className="text-[8px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md uppercase">{SCALE_LABELS[f.scaleLevel]}</span>
                    </div>
                    <h4 className="text-sm font-black text-slate-800 truncate uppercase">{f.name || '未命名配方'}</h4>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleDuplicateFormulation(f)} className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition-all" title={t('processLab.formulation.edit')}><i className="fa-solid fa-code-branch text-[10px]"></i></button>
                    <button onClick={() => handleEditFormulation(f)} className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 hover:text-amber-600 hover:bg-amber-50 flex items-center justify-center transition-all" title={t('processLab.formulation.edit')}><i className="fa-solid fa-pen text-[10px]"></i></button>
                    <button onClick={() => handleDeleteFormulation(f.id)} className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all" title={t('processLab.formulation.deleted')}><i className="fa-solid fa-trash text-[10px]"></i></button>
                  </div>
                </div>

                {/* 组分列表 */}
                <div className="space-y-1">
                  {(f.components || []).slice(0, 4).map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-[10px]">
                      <span className="w-14 text-[8px] font-black text-slate-400 uppercase shrink-0">{c.role}</span>
                      <div className="flex-1 h-4 bg-slate-50 rounded-full overflow-hidden relative">
                        <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(c.percentage, 100)}%` }}></div>
                        <span className="absolute inset-0 flex items-center px-2 text-[9px] font-bold text-slate-700">{c.materialName || '—'}</span>
                      </div>
                      <span className="text-[9px] font-black text-amber-600 w-10 text-right shrink-0">{c.percentage}%</span>
                    </div>
                  ))}
                  {(f.components || []).length > 4 && <p className="text-[8px] text-slate-400 font-bold italic pl-16">+{t('processLab.common.more', { count: (f.components || []).length - 4 })}</p>}
                </div>

                {/* 底部信息 */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-auto">
                  <span className="text-[8px] font-bold text-slate-400">{(f.components || []).length} 组分 · {(f.targetProperties || []).length} 指标</span>
                  <span className="text-[8px] font-bold text-slate-400">{f.updatedAt}</span>
                </div>

                {f.tags && f.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {f.tags.map(t => <span key={t} className="text-[7px] font-black text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full uppercase">{t}</span>)}
                  </div>
                )}
              </div>
            )) : (
              <div className="col-span-full flex flex-col items-center justify-center py-24 gap-5 opacity-40">
                <div className="w-20 h-20 rounded-full bg-amber-50 border-2 border-amber-100 flex items-center justify-center"><i className="fa-solid fa-flask text-amber-300 text-3xl"></i></div>
                <div className="text-center">
                  <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3rem] mb-2">{t('processLab.formulation.noData')}</p>
                  <p className="text-[11px] text-slate-400 max-w-xs">{t('processLab.formulation.clickToCreate')}</p>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'batch' ? (
          /* ═══ 批次追踪表格 ═══ */
          <div className="space-y-4 pb-12">
            {/* 关联配方筛选 */}
            {formulations.length > 0 && (
              <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 border border-slate-200 shadow-sm w-fit">
                <i className="fa-solid fa-filter text-slate-300 text-[10px]"></i>
                <select
                  value={selectedFormulationId} onChange={e => setSelectedFormulationId(e.target.value)}
                  className="bg-transparent border-none outline-none text-[11px] font-bold text-slate-600 cursor-pointer"
                >
                  <option value="">{t('processLab.batch.allFormulations')}</option>
                  {formulations.map(f => <option key={f.id} value={f.id}>{f.name} ({f.version})</option>)}
                </select>
              </div>
            )}

            {/* 批次卡片列表 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 content-start">
              {(selectedFormulationId ? filteredBatches.filter(b => b.formulationId === selectedFormulationId) : filteredBatches).map(b => {
                const bs = BATCH_STATUS_LABELS[b.status];
                return (
                  <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all group flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 ${bs.color}`}><i className={`fa-solid ${bs.icon} text-[7px]`}></i>{bs.label}</span>
                        </div>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{b.batchNumber}</h4>
                        {b.formulationName && <p className="text-[9px] font-bold text-amber-600 mt-0.5">{b.formulationName} · {b.formulationVersion}</p>}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEditBatch(b)} className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition-all"><i className="fa-solid fa-pen text-[10px]"></i></button>
                        <button onClick={() => handleDeleteBatch(b.id)} className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all"><i className="fa-solid fa-trash text-[10px]"></i></button>
                      </div>
                    </div>

                    {/* 良率 & Cpk */}
                    <div className="flex gap-3">
                      <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">{t('processLab.batch.yield')}</p>
                        <p className={`text-xl font-black ${b.yield >= 95 ? 'text-emerald-600' : b.yield >= 85 ? 'text-amber-600' : 'text-rose-600'}`}>{b.yield}<span className="text-[10px]">%</span></p>
                      </div>
                      {b.cpk !== undefined && (
                        <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Cpk</p>
                          <p className={`text-xl font-black ${(b.cpk ?? 0) >= 1.33 ? 'text-emerald-600' : (b.cpk ?? 0) >= 1.0 ? 'text-amber-600' : 'text-rose-600'}`}>{b.cpk}</p>
                        </div>
                      )}
                      <div className="flex-1 bg-slate-50 rounded-xl p-3 text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">QC</p>
                        <p className="text-xl font-black text-indigo-600">{(b.qualityChecks || []).filter(q => q.passed).length}<span className="text-[10px] text-slate-400">/{(b.qualityChecks || []).length}</span></p>
                      </div>
                    </div>

                    {/* 底部信息 */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-auto">
                      <span className="text-[8px] font-bold text-slate-400"><i className="fa-solid fa-user-gear mr-1"></i>{b.operator || t('processLab.batch.unassigned')}</span>
                      <span className="text-[8px] font-bold text-slate-400">{b.startTime}</span>
                    </div>
                  </div>
                );
              })}

              {filteredBatches.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-24 gap-5 opacity-40">
                  <div className="w-20 h-20 rounded-full bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center"><i className="fa-solid fa-boxes-stacked text-indigo-300 text-3xl"></i></div>
                  <div className="text-center">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3rem] mb-2">{t('processLab.batch.noData')}</p>
                    <p className="text-[11px] text-slate-400 max-w-xs">{t('processLab.batch.clickToCreate')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'flow' ? (
          /* ═══ P1: 工艺流程编辑器 ═══ */
          <ProcessFlowDesigner flows={flows} setFlows={setFlows} formulations={formulations} showToast={showToast} />
        ) : activeTab === 'yield_dashboard' ? (
          /* ═══ P1: 良率看板 ═══ */
          <YieldDashboard batches={batches} formulations={formulations} />
        ) : activeTab === 'cost' ? (
          /* ═══ P2: 成本分析引擎 ═══ */
          <CostAnalysisEngine formulations={formulations} />
        ) : activeTab === 'scaleup' ? (
          /* ═══ P2: 中试放大模拟器 ═══ */
          <ScaleUpSimulator formulations={formulations} flows={flows} showToast={showToast} />
        ) : activeTab === 'ai' ? (
          /* ═══ P3: AI 配方优化 ═══ */
          <AIFormulaOptimizer formulations={formulations} batches={batches} showToast={showToast} />
        ) : (
          /* ═══ P3: 报告与导出 ═══ */
          <ReportsExport formulations={formulations} batches={batches} showToast={showToast} />
        )}
      </div>

      {/* ═══ 配方编辑弹窗 ═══ */}
      {showFormulaModal && editingFormulation && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl animate-reveal flex flex-col max-h-[90vh] overflow-hidden border-2 border-amber-100">
            <header className="px-8 py-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><i className="fa-solid fa-flask text-lg"></i></div>
                <div>
                  <h3 className="text-lg font-black uppercase italic tracking-tight">{editingFormulation.id && formulations.find(f => f.id === editingFormulation.id) ? t('processLab.formulation.edit') : t('processLab.formulation.new')}</h3>
                  <p className="text-[9px] font-bold text-amber-200 uppercase tracking-widest">FORMULATION EDITOR</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleSaveFormulation} className="px-6 py-2.5 bg-white text-amber-700 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-amber-50 transition-all active:scale-95 flex items-center gap-2"><i className="fa-solid fa-check"></i>{t('processLab.formulation.saved')}</button>
                <button onClick={() => { setShowFormulaModal(false); setEditingFormulation(null); }} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-rose-500 transition-all flex items-center justify-center"><i className="fa-solid fa-times text-lg"></i></button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
              {/* 基本信息 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">{t('processLab.formulation.name')}</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                    placeholder={t('processLab.formulation.namePlaceholder')} value={editingFormulation.name} onChange={e => setEditingFormulation(prev => prev ? { ...prev, name: e.target.value } : prev)} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">{t('processLab.formulation.version')}</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-amber-400 transition-all"
                    value={editingFormulation.version} onChange={e => setEditingFormulation(prev => prev ? { ...prev, version: e.target.value } : prev)} />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">{t('processLab.formulation.status')}</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                    value={editingFormulation.status} onChange={e => setEditingFormulation(prev => prev ? { ...prev, status: e.target.value as FormulationStatus } : prev)}>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">{t('processLab.formulation.scale')}</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                    value={editingFormulation.scaleLevel} onChange={e => setEditingFormulation(prev => prev ? { ...prev, scaleLevel: e.target.value as any } : prev)}>
                    {Object.entries(SCALE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">{t('processLab.formulation.totalWeight')}</label>
                  <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-amber-400 transition-all"
                    value={editingFormulation.totalWeight || ''} onChange={e => setEditingFormulation(prev => prev ? { ...prev, totalWeight: parseFloat(e.target.value) || 0 } : prev)} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">{t('processLab.formulation.unit')}</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                    value={editingFormulation.totalWeightUnit || 'g'} onChange={e => setEditingFormulation(prev => prev ? { ...prev, totalWeightUnit: e.target.value } : prev)}>
                    <option value="g">g</option><option value="kg">kg</option><option value="ton">ton</option>
                  </select>
                </div>
              </div>

              {/* 组分编辑 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-2"><i className="fa-solid fa-list-check text-amber-500"></i>{t('processLab.formulation.materialBOM')}</h4>
                  <button onClick={() => setEditingFormulation(prev => prev ? { ...prev, components: [...prev.components, { id: genId(), materialName: '', percentage: 0, amount: 0, unit: 'g', role: t('processLab.common.roles.other') }] } : prev)}
                    className="text-[9px] font-black text-amber-600 hover:text-amber-800 flex items-center gap-1"><i className="fa-solid fa-plus"></i>{t('processLab.formulation.addMaterial')}</button>
                </div>
                <div className="space-y-2">
                  {editingFormulation.components.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <select className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-600 outline-none shrink-0"
                        value={c.role} onChange={e => { const comps = [...editingFormulation.components]; comps[i] = { ...comps[i], role: e.target.value }; setEditingFormulation(prev => prev ? { ...prev, components: comps } : prev); }}>
                        {COMPONENT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <input className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-700 outline-none min-w-[100px]" placeholder={t('processLab.formulation.materialPlaceholder')}
                        value={c.materialName} onChange={e => { const comps = [...editingFormulation.components]; comps[i] = { ...comps[i], materialName: e.target.value }; setEditingFormulation(prev => prev ? { ...prev, components: comps } : prev); }} />
                      <input type="number" className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 outline-none text-center" placeholder="%"
                        value={c.percentage || ''} onChange={e => { const comps = [...editingFormulation.components]; comps[i] = { ...comps[i], percentage: parseFloat(e.target.value) || 0 }; setEditingFormulation(prev => prev ? { ...prev, components: comps } : prev); }} />
                      <span className="text-[9px] font-bold text-slate-400 shrink-0">%</span>
                      <input type="number" className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-700 outline-none text-center" placeholder={t('processLab.formulation.amount')}
                        value={c.amount || ''} onChange={e => { const comps = [...editingFormulation.components]; comps[i] = { ...comps[i], amount: parseFloat(e.target.value) || 0 }; setEditingFormulation(prev => prev ? { ...prev, components: comps } : prev); }} />
                      <select className="w-12 bg-white border border-slate-200 rounded-lg px-1 py-1.5 text-[10px] font-bold text-slate-600 outline-none shrink-0"
                        value={c.unit} onChange={e => { const comps = [...editingFormulation.components]; comps[i] = { ...comps[i], unit: e.target.value }; setEditingFormulation(prev => prev ? { ...prev, components: comps } : prev); }}>
                        <option>g</option><option>mg</option><option>kg</option><option>mL</option><option>L</option>
                      </select>
                      <button onClick={() => { const comps = editingFormulation.components.filter((_, j) => j !== i); setEditingFormulation(prev => prev ? { ...prev, components: comps } : prev); }}
                        className="w-7 h-7 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all shrink-0"><i className="fa-solid fa-xmark text-[10px]"></i></button>
                    </div>
                  ))}
                </div>
                {/* 百分比合计 */}
                {editingFormulation.components.length > 0 && (() => {
                  const total = editingFormulation.components.reduce((s, c) => s + (c.percentage || 0), 0);
                  return <p className={`text-[10px] font-black mt-2 px-1 ${Math.abs(total - 100) < 0.1 ? 'text-emerald-600' : 'text-rose-500'}`}>{t('processLab.formulation.totalSum')}: {total.toFixed(1)}% {Math.abs(total - 100) < 0.1 ? '✓' : `(${t('processLab.formulation.deviation')} ${(total - 100).toFixed(1)}%)`}</p>;
                })()}
              </div>

              {/* 备注 */}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">{t('processLab.formulation.notes')}</label>
                <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-medium text-slate-700 outline-none focus:border-amber-400 transition-all resize-none" rows={2}
                  placeholder={t('processLab.formulation.notesPlaceholder')} value={editingFormulation.notes || ''} onChange={e => setEditingFormulation(prev => prev ? { ...prev, notes: e.target.value } : prev)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 批次编辑弹窗 ═══ */}
      {showBatchModal && editingBatch && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl animate-reveal flex flex-col max-h-[90vh] overflow-hidden border-2 border-indigo-100">
            <header className="px-8 py-5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><i className="fa-solid fa-boxes-stacked text-lg"></i></div>
                <div>
                  <h3 className="text-lg font-black uppercase italic tracking-tight">{batches.find(b => b.id === editingBatch.id) ? t('processLab.batch.edit') : t('processLab.batch.new')}</h3>
                  <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest">BATCH RECORD</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleSaveBatch} className="px-6 py-2.5 bg-white text-indigo-700 rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-50 transition-all active:scale-95 flex items-center gap-2"><i className="fa-solid fa-check"></i>{t('processLab.batch.saved')}</button>
                <button onClick={() => { setShowBatchModal(false); setEditingBatch(null); }} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-rose-500 transition-all flex items-center justify-center"><i className="fa-solid fa-times text-lg"></i></button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">{t('processLab.batch.number')}</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all"
                    value={editingBatch.batchNumber} onChange={e => setEditingBatch(prev => prev ? { ...prev, batchNumber: e.target.value } : prev)} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">{t('processLab.batch.formulation')}</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                    value={editingBatch.formulationId} onChange={e => setEditingBatch(prev => prev ? { ...prev, formulationId: e.target.value } : prev)}>
                    <option value="">{t('processLab.batch.selectFormulation')}</option>
                    {formulations.map(f => <option key={f.id} value={f.id}>{f.name} ({f.version})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">{t('processLab.batch.status')}</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                    value={editingBatch.status} onChange={e => setEditingBatch(prev => prev ? { ...prev, status: e.target.value as BatchStatus } : prev)}>
                    {Object.entries(BATCH_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">{t('processLab.batch.operator')}</label>
                  <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all" placeholder={t('processLab.batch.operatorPlaceholder')}
                    value={editingBatch.operator} onChange={e => setEditingBatch(prev => prev ? { ...prev, operator: e.target.value } : prev)} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">{t('processLab.batch.yield')}</label>
                  <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all"
                    value={editingBatch.yield || ''} onChange={e => setEditingBatch(prev => prev ? { ...prev, yield: parseFloat(e.target.value) || 0 } : prev)} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">{t('processLab.batch.cpk')}</label>
                  <input type="number" step="0.01" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 transition-all"
                    value={editingBatch.cpk ?? ''} onChange={e => setEditingBatch(prev => prev ? { ...prev, cpk: parseFloat(e.target.value) || undefined } : prev)} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">{t('processLab.batch.startTime')}</label>
                  <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                    value={editingBatch.startTime} onChange={e => setEditingBatch(prev => prev ? { ...prev, startTime: e.target.value } : prev)} />
                </div>
              </div>

              {/* QC 检测项 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-2"><i className="fa-solid fa-clipboard-check text-indigo-500"></i>{t('processLab.batch.qc')}</h4>
                  <button onClick={() => setEditingBatch(prev => prev ? { ...prev, qualityChecks: [...prev.qualityChecks, { id: genId(), checkName: '', standard: '', result: '', passed: false, timestamp: today() }] } : prev)}
                    className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><i className="fa-solid fa-plus"></i>{t('processLab.batch.addQc')}</button>
                </div>
                <div className="space-y-2">
                  {editingBatch.qualityChecks.map((q, i) => (
                    <div key={q.id} className="flex items-center gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <input className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-700 outline-none min-w-[80px]" placeholder={t('processLab.batch.qcName')}
                        value={q.checkName} onChange={e => { const qc = [...editingBatch.qualityChecks]; qc[i] = { ...qc[i], checkName: e.target.value }; setEditingBatch(prev => prev ? { ...prev, qualityChecks: qc } : prev); }} />
                      <input className="w-28 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-700 outline-none" placeholder={t('processLab.batch.standard')}
                        value={q.standard} onChange={e => { const qc = [...editingBatch.qualityChecks]; qc[i] = { ...qc[i], standard: e.target.value }; setEditingBatch(prev => prev ? { ...prev, qualityChecks: qc } : prev); }} />
                      <input className="w-28 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-700 outline-none" placeholder={t('processLab.batch.result')}
                        value={q.result} onChange={e => { const qc = [...editingBatch.qualityChecks]; qc[i] = { ...qc[i], result: e.target.value }; setEditingBatch(prev => prev ? { ...prev, qualityChecks: qc } : prev); }} />
                      <button onClick={() => { const qc = [...editingBatch.qualityChecks]; qc[i] = { ...qc[i], passed: !qc[i].passed }; setEditingBatch(prev => prev ? { ...prev, qualityChecks: qc } : prev); }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${q.passed ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-50 text-rose-400'}`}>
                        <i className={`fa-solid ${q.passed ? 'fa-check' : 'fa-xmark'} text-[10px]`}></i>
                      </button>
                      <button onClick={() => { const qc = editingBatch.qualityChecks.filter((_, j) => j !== i); setEditingBatch(prev => prev ? { ...prev, qualityChecks: qc } : prev); }}
                        className="w-7 h-7 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-all shrink-0"><i className="fa-solid fa-xmark text-[10px]"></i></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 备注 */}
              <div>
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">{t('processLab.batch.notes')}</label>
                <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-medium text-slate-700 outline-none focus:border-indigo-400 transition-all resize-none" rows={2}
                  placeholder={t('processLab.batch.notesPlaceholder')} value={editingBatch.notes || ''} onChange={e => setEditingBatch(prev => prev ? { ...prev, notes: e.target.value } : prev)} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessLabView;
