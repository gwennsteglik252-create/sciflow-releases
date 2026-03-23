
import React, { useState } from 'react';
import { exportToWord } from '../../utils/documentExport';
import { useTranslation } from '../../locales/useTranslation';

interface MechanismHeaderProps {
  analysisArchivesCount: number;
  onOpenArchiveLibrary: () => void;
  showComparisonTable: boolean;
  setShowComparisonTable: (show: boolean) => void;
  handleSaveToComparison: () => void;
  handleSaveToArchives: () => void;
  physicalConstants: any;
  analysisResult: string | null;
  isProcessing: boolean;
  runMechanismAnalysis: () => void;
  mechanismSession: any;
  updateMechanismSession: (updates: any) => void;
  onOpenDebate: () => void;
  onOpenTemplateLibrary: () => void;
}

const MechanismHeader: React.FC<MechanismHeaderProps> = ({
  analysisArchivesCount,
  onOpenArchiveLibrary,
  showComparisonTable,
  setShowComparisonTable,
  handleSaveToComparison,
  handleSaveToArchives,
  physicalConstants,
  analysisResult,
  isProcessing,
  runMechanismAnalysis,
  mechanismSession,
  updateMechanismSession,
  onOpenDebate,
  onOpenTemplateLibrary
}) => {
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const { t } = useTranslation();

  const { isStableAnalysis } = mechanismSession;

  const handleExportReport = () => {
    if (!analysisResult) return;
    const { material, dopingElement, dopingConcentration, reactionMode, pH, potential, stabilityPrediction } = mechanismSession;
    const title = `${t('mechanism.header.reportTitle')}_${material}_${dopingElement}`;

    // Calculate RDS barrier for report
    let rdsBarrier = '--';
    if (physicalConstants?.energySteps && Array.isArray(physicalConstants.energySteps)) {
      const steps = physicalConstants.energySteps;
      let maxDiff = -Infinity;
      for (let i = 0; i < steps.length - 1; i++) {
        const diff = Math.abs(steps[i + 1] - steps[i]);
        if (diff > maxDiff) maxDiff = diff;
      }
      if (maxDiff > -Infinity) rdsBarrier = `${maxDiff.toFixed(2)} eV`;
    }

    // Beautiful, detailed HTML content for Word export
    const content = `
      <h1 style="text-align: center; color: #1e1b4b; font-family: Arial, sans-serif;">${title}</h1>
      <p style="text-align: right; color: #64748b; font-size: 10pt; font-family: Arial, sans-serif;">${t('mechanism.header.reportDate')}: ${new Date().toLocaleString()}</p>
      
      <div style="background-color: #f8fafc; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #e2e8f0; font-family: Arial, sans-serif;">
        <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 5px; font-family: Arial, sans-serif;">${t('mechanism.header.sectionEnvironment')}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; font-weight: bold; width: 25%; color: #475569;">${t('mechanism.header.labelReactionMode')}</td>
            <td style="padding: 8px;">${reactionMode}</td>
            <td style="padding: 8px; font-weight: bold; width: 25%; color: #475569;">${t('mechanism.header.labelPH')}</td>
            <td style="padding: 8px;">${pH}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #475569;">${t('mechanism.header.labelSubstrate')}</td>
            <td style="padding: 8px;">${material}</td>
            <td style="padding: 8px; font-weight: bold; color: #475569;">${t('mechanism.header.labelPotential')}</td>
            <td style="padding: 8px;">${potential} V</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #475569;">${t('mechanism.header.labelDopingElement')}</td>
            <td style="padding: 8px;">${dopingElement}</td>
            <td style="padding: 8px; font-weight: bold; color: #475569;">${t('mechanism.header.labelDopingConcentration')}</td>
            <td style="padding: 8px;">${dopingConcentration}%</td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom: 20px; font-family: Arial, sans-serif;">
        <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 5px; font-family: Arial, sans-serif;">${t('mechanism.header.sectionKinetics')}</h2>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0;">
          <tr style="background-color: #f1f5f9;">
            <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; color: #1e293b;">${t('mechanism.header.colMetricName')}</th>
            <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; color: #1e293b;">${t('mechanism.header.colValue')}</th>
            <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; color: #1e293b;">${t('mechanism.header.colUnit')}</th>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">${t('mechanism.header.tafelRow')}</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px; font-weight: bold; color: #4f46e5;">${physicalConstants?.tafelSlope || '--'}</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">mV/dec</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">${t('mechanism.header.j0Row')}</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px; font-weight: bold; color: #4f46e5;">${physicalConstants?.exchangeCurrentDensity || '--'}</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">A/cm²</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">${t('mechanism.header.etaRow')}</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px; font-weight: bold; color: #4f46e5;">${physicalConstants?.eta10 || '--'} V</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">vs. RHE</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">${t('mechanism.header.rdsRow')}</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px; font-weight: bold; color: #f43f5e;">${rdsBarrier}</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">${t('mechanism.header.rdsDesc')}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">${t('mechanism.header.stabilityRow')}</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px; font-weight: bold; color: #10b981;">${stabilityPrediction?.safetyIndex?.toFixed(2) || '--'}</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">Scale 0.00-10.00</td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom: 20px; font-family: Arial, sans-serif;">
        <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 5px; font-family: Arial, sans-serif;">${t('mechanism.header.sectionMechanism')}</h2>
        <div style="padding: 20px; background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 6px solid #f59e0b; border-radius: 4px; line-height: 1.8;">
          ${analysisResult.replace(/\\n/g, '<br/>')}
        </div>
      </div>
      
      <p style="text-align: center; color: #94a3b8; font-size: 8pt; margin-top: 60px; border-top: 1px dashed #e2e8f0; padding-top: 10px;">
        © 2026 SciFlow Pro | ${t('mechanism.header.footer')} | ${t('mechanism.header.footerClassification')}
      </p>
    `;
    exportToWord(title, content, { pH, potential });
    setShowSaveMenu(false);
  };

  const onSaveClick = (type: 'comparison' | 'archive') => {
    if (type === 'comparison') {
      handleSaveToComparison();
    } else {
      handleSaveToArchives();
    }
    setShowSaveMenu(false);
  };

  return (
    <header className="flex flex-row justify-between items-center shrink-0 px-6 py-4 bg-slate-900 rounded-2xl border border-white/10 gap-4 shadow-2xl overflow-visible z-50 relative">
      <div className="flex items-center gap-4 shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shrink-0">
          <i className="fa-solid fa-industry text-sm"></i>
        </div>
        <div className="flex flex-col">
          <h2 className="text-lg font-black text-white tracking-tighter italic uppercase leading-none">{t('mechanism.header.engineTitle')}</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t('mechanism.header.engineSubtitle')}</p>
        </div>
      </div>

      <div className="flex-1"></div>

      {/* 按钮组 — 三组语义分组，清晰的视觉层级 */}
      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">

        {/* ── 第一组：辅助工具（模式切换 + 模板 + AI辩论）── */}
        <div className="flex items-center gap-1.5 bg-black/20 p-1 rounded-xl border border-white/5 shadow-inner">
          {/* Stable Mode Toggle */}
          <button
            onClick={() => updateMechanismSession({ isStableAnalysis: !isStableAnalysis })}
            className={`h-8 px-2.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 border active:scale-95 group whitespace-nowrap ${isStableAnalysis ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50' : 'bg-white/5 text-slate-500 border-white/10 hover:bg-white/10 hover:text-slate-300'}`}
            title={isStableAnalysis ? t('mechanism.header.stableMode') : t('mechanism.header.heuristicMode')}
          >
            <div className={`w-1.5 h-1.5 rounded-full shadow-sm transition-all ${isStableAnalysis ? 'bg-indigo-400 shadow-[0_0_6px_#818cf8] animate-pulse' : 'bg-slate-600'}`}></div>
            <span>{isStableAnalysis ? 'Stable' : 'AI-Gen'}</span>
          </button>

          {/* Template Library */}
          <button
            onClick={onOpenTemplateLibrary}
            className="h-8 px-2.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 border active:scale-95 whitespace-nowrap bg-white/5 text-slate-300 border-white/10 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/30"
            title={t('mechanism.template.title')}
          >
            <i className="fa-solid fa-flask-vial text-[10px]"></i>
            <span>{t('mechanism.template.buttonLabel')}</span>
          </button>

          {/* AI Debate Mode */}
          <button
            onClick={onOpenDebate}
            disabled={!analysisResult || !physicalConstants}
            className="h-8 px-2.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 border active:scale-95 disabled:opacity-30 disabled:grayscale whitespace-nowrap bg-white/5 text-violet-300 border-violet-500/20 hover:bg-violet-500/20 hover:text-violet-200 hover:border-violet-500/40"
            title={t('mechanism.debate.title')}
          >
            <i className="fa-solid fa-comments text-[10px]"></i>
            <span>{t('mechanism.debate.buttonLabel')}</span>
          </button>
        </div>

        {/* ── 第二组：数据管理（方案库 + 对比矩阵）── */}
        <div className="flex items-center gap-1.5 bg-black/20 p-1 rounded-xl border border-white/5 shadow-inner">
          {/* Analysis Library — 触发大弹窗 */}
          <button
            onClick={onOpenArchiveLibrary}
            className="h-8 px-2.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 border active:scale-95 whitespace-nowrap bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white"
          >
            <i className="fa-solid fa-box-archive text-[10px]"></i>
            <span>{t('mechanism.header.archiveLibrary')} ({analysisArchivesCount})</span>
          </button>

          {/* Comparison Matrix Button */}
          <button
            onClick={() => setShowComparisonTable(true)}
            className={`h-8 px-2.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 border active:scale-95 whitespace-nowrap ${showComparisonTable ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/20'}`}
          >
            <i className="fa-solid fa-list-check text-[10px]"></i>
            <span>{t('mechanism.header.comparisonMatrix')}</span>
          </button>
        </div>

        {/* ── 第三组：主操作（保存/归档 + 启动解算）── */}
        <div className="flex items-center gap-1.5 bg-black/20 p-1 rounded-xl border border-white/5 shadow-inner">
          {/* Save / Archive Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setShowSaveMenu(!showSaveMenu)}
              disabled={!physicalConstants}
              className={`h-8 px-2.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 border active:scale-95 disabled:opacity-30 disabled:grayscale whitespace-nowrap ${showSaveMenu ? 'bg-amber-600 text-white border-amber-500' : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500 hover:text-white hover:border-amber-500'}`}
            >
              <i className="fa-solid fa-floppy-disk text-[10px]"></i>
              <span>{t('mechanism.header.saveArchive')}</span>
              <i className={`fa-solid fa-chevron-down text-[8px] transition-transform ${showSaveMenu ? 'rotate-180' : ''}`}></i>
            </button>

            {showSaveMenu && (
              <div className="absolute top-full right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-reveal z-[100] flex flex-col p-1.5">
                <button onClick={() => onSaveClick('comparison')} className="px-4 py-3 hover:bg-indigo-50 rounded-xl text-[10px] font-bold text-slate-700 text-left flex items-center gap-3 transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm"><i className="fa-solid fa-table-columns text-[10px]"></i></div>
                  <span>{t('mechanism.header.addToComparison')}</span>
                </button>
                <button onClick={() => onSaveClick('archive')} className="px-4 py-3 hover:bg-emerald-50 rounded-xl text-[10px] font-bold text-slate-700 text-left flex items-center gap-3 transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm"><i className="fa-solid fa-box-archive text-[10px]"></i></div>
                  <span>{t('mechanism.header.saveToLibrary')}</span>
                </button>
                <div className="my-1.5 border-t border-slate-50"></div>
                <button onClick={handleExportReport} disabled={!analysisResult} className="px-4 py-3 hover:bg-indigo-50 rounded-xl text-[10px] font-bold text-slate-700 text-left flex items-center gap-3 transition-colors disabled:opacity-50">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm"><i className="fa-solid fa-file-word text-[10px]"></i></div>
                  <span>{t('mechanism.header.exportWordReport')}</span>
                </button>
              </div>
            )}
          </div>

          {/* Start Simulation Button */}
          <button
            type="button"
            onClick={runMechanismAnalysis}
            disabled={isProcessing}
            className="h-8 px-4 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase shadow-[0_3px_12px_rgba(99,102,241,0.4)] hover:bg-indigo-500 hover:shadow-indigo-500/50 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 group relative overflow-hidden whitespace-nowrap"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            {isProcessing ? <i className="fa-solid fa-circle-notch animate-spin text-[10px]"></i> : <i className="fa-solid fa-microchip group-hover:rotate-12 transition-transform text-[10px]"></i>}
            <span>{t('mechanism.header.startSimulation')}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default MechanismHeader;
