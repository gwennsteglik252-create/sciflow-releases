import React, { useEffect, useRef } from 'react';
import { ResearchProject, AppView } from '../types';
import { useTranslation } from '../locales';
import { useDOEManager } from '../hooks/useDOEManager';
import OEDModal from './DOE/OEDModal';
import DOEConfigModal from './DOE/DOEConfigModal';
import SafeModal from './SafeModal';
import { useProjectContext } from '../context/ProjectContext';
import { printElement } from '../utils/printUtility';
import { flattenMilestonesTree, getAutoSelections } from './Characterization/AnalysisSyncModal';

// Import sub-components from DOE directory
import { DOEHeader } from './DOE/DOEHeader';
import ObservationsPanel from './DOE/ObservationsPanel';
import SuggestionPanel from './DOE/SuggestionPanel';
import BulkAddModal from './DOE/BulkAddModal';

interface DOEAssistantProps {
  projects: ResearchProject[];
  onUpdateProject: (updated: ResearchProject) => void;
  navigate: (view: AppView, projectId?: string, subView?: string) => void;
  initialArchiveId?: string | null;
}

const DOEAssistant: React.FC<DOEAssistantProps> = (props) => {
  const { state, actions, computed } = useDOEManager(props);
  const { showToast } = useProjectContext();
  const { t } = useTranslation();
  const exportAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (props.initialArchiveId && state.savedResults.length > 0) {
      const targetArchive = state.savedResults.find(r => r.id === props.initialArchiveId);
      if (targetArchive) {
        actions.loadArchive(targetArchive);
      }
    }
  }, [props.initialArchiveId, state.savedResults.length]);

  // 同步弹窗打开时自动选中最新记录
  useEffect(() => {
    if (state.showSyncModal) {
      const a = getAutoSelections(props.projects);
      if (!state.targetProjectId) actions.setTargetProjectId(a.projectId);
      if (!state.targetMilestoneId) {
        const b = getAutoSelections(props.projects, state.targetProjectId || a.projectId);
        actions.setTargetMilestoneId(b.milestoneId);
      }
    }
  }, [state.showSyncModal]);

  const handleExportPDF = async () => {
    if (!state.suggestion || !exportAreaRef.current) {
      showToast({ message: t('doeAssistant.generateFirst'), type: 'info' });
      return;
    }
    showToast({ message: t('doeAssistant.buildingVectorLayer'), type: 'info' });
    await printElement(exportAreaRef.current, `${state.saveTitle || 'DOE_Archive'}_Full_Report`);
  };

  const handleBulkSubmit = (validEntries: any[]) => {
    actions.setHistory(validEntries);
    actions.setShowAddHistory(false);
    if (showToast) showToast({ message: t('doeAssistant.datasetSynced', { count: validEntries.length }), type: 'success' });
  };

  return (
    <div className="h-full flex flex-col gap-4 animate-reveal overflow-hidden px-4 py-2 relative">
      {/* 提高了 Header 的 Z-Index 确保下拉菜单不被下方的 Sticky 元素覆盖 */}
      <div className="relative z-[100]">
        <DOEHeader
          savedResults={state.savedResults}
          showArchiveDropdown={state.showArchiveDropdown}
          setShowArchiveDropdown={actions.setShowArchiveDropdown}
          loadArchive={actions.loadArchive}
          handleDeleteArchive={actions.handleDeleteArchive}
          handleRenameArchive={actions.handleRenameArchive}
          handleCategoryChange={actions.handleCategoryChange}
          setIntensityMode={actions.setIntensityMode}
          setShowOEDModal={actions.setShowOEDModal}
          setShowConfigModal={actions.setShowConfigModal}
          handleReset={actions.handleReset}
          onSaveTrigger={() => actions.setShowSaveModal(true)}
          isSaveDisabled={!state.suggestion}
          onLoadPreset={actions.handleLoadSampleCase}
        />
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden relative">
        <ObservationsPanel
          projects={props.projects}
          processDescription={state.processDescription}
          setProcessDescription={actions.setProcessDescription}
          handleSelectSourceNode={() => { }}
          history={state.history}
          setShowAddHistory={actions.setShowAddHistory}
          isCalculating={state.isCalculating}
          handleCalculate={actions.handleCalculate}
          setConfirmModal={actions.setConfirmModal}
          setHistory={actions.setHistory}
          onDiagnoseSynergy={actions.handleSynergyDiagnosis}
          isDiagnosingId={state.isDiagnosingId}
        />

        <div ref={exportAreaRef} className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar relative pr-1 pb-10 bg-white rounded-lg border border-slate-100 z-10">
          {/* 移除了此处的冗余 PDF 导出按钮，统一使用头部的导出逻辑 */}
          <SuggestionPanel
            suggestion={state.suggestion}
            factors={state.factors}
            setSuggestion={actions.setSuggestion}
            setLoadedArchiveId={actions.setLoadedArchiveId}
            setShowSaveModal={actions.setShowSaveModal}
            setShowSyncModal={actions.setShowSyncModal}
            setIsBatchSync={actions.setIsBatchSync}
            loadedArchiveId={state.loadedArchiveId}
            selectedIdx={state.selectedRecommendationIdx}
            onSelectRecommendation={actions.setSelectedRecommendationIdx}
            projects={props.projects}
            onTracePlan={(projectId, subView) => props.navigate('project_detail', projectId, subView)}
          />
        </div>
      </div>

      {state.diagnosisResult && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-lg p-8 lg:p-10 animate-reveal shadow-2xl relative border-4 border-white flex flex-col overflow-hidden">
            <button onClick={() => actions.setDiagnosisResult(null)} className="absolute top-6 right-6 text-slate-400 hover:text-rose-500 transition-all"><i className="fa-solid fa-times text-xl"></i></button>
            <div className="flex items-center gap-4 mb-8 shrink-0">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl text-white shadow-lg ${state.diagnosisResult.diagnosis === 'Synergy' ? 'bg-indigo-600' : 'bg-rose-600'}`}>
                <i className={`fa-solid ${state.diagnosisResult.diagnosis === 'Synergy' ? 'fa-wand-magic-sparkles' : 'fa-circle-exclamation'}`}></i>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800 uppercase italic">{t('doeAssistant.outlierDiagnosis')}</h3>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-6">
              <div className="bg-slate-50 p-6 rounded-lg border border-slate-100 shadow-inner relative">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">{t('doeAssistant.expertReasoning')}</p>
                <p className="text-[12px] font-medium text-slate-700 italic leading-relaxed text-justify">“ {state.diagnosisResult.explanation} ”</p>
              </div>
            </div>

            <button
              onClick={() => actions.setDiagnosisResult(null)}
              className="mt-8 w-full py-4 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase shadow-xl hover:bg-indigo-600 transition-all active:scale-95"
            >
              {t('doeAssistant.diagnosisAcknowledged')}
            </button>
          </div>
        </div>
      )}

      <OEDModal
        show={state.showOEDModal}
        onClose={() => actions.setShowOEDModal(false)}
        intensityMode={state.intensityMode}
        setIntensityMode={actions.setIntensityMode}
        currentMatrix={computed.currentMatrix}
        activeFactors={computed.activeFactors}
        responses={state.responses}
        oedResults={state.oedResults}
        setOedResults={actions.setOedResults}
        oedFactorOverrides={state.oedFactorOverrides}
        setOedFactorOverrides={actions.setOedFactorOverrides}
        getFactorDisplayValue={actions.getFactorDisplayValue}
        rangeAnalysis={computed.rangeAnalysis}
        paretoAnalysis={computed.paretoAnalysis}
        surfacePrediction={computed.surfacePrediction}
        syncOEDToHistory={actions.syncOEDToHistory}
      />

      <DOEConfigModal
        show={state.showConfigModal}
        onClose={() => actions.setShowConfigModal(false)}
        factors={state.factors}
        setFactors={actions.setFactors}
        responses={state.responses}
        setResponses={actions.setResponses}
        customTemplates={state.customTemplates}
        loadTemplate={actions.loadTemplate}
        showSaveTemplateModal={state.showSaveTemplateModal}
        setShowSaveTemplateModal={actions.setShowSaveTemplateModal}
        handleSaveAsTemplate={actions.handleSaveAsTemplate}
        handleReset={actions.handleReset}
        newTemplateTitle={state.newTemplateTitle}
        setNewTemplateTitle={actions.setNewTemplateTitle}
        deleteTemplate={actions.deleteTemplate}
      />

      <BulkAddModal
        show={state.showAddHistory}
        onClose={() => actions.setShowAddHistory(false)}
        factors={state.factors}
        responses={state.responses}
        onSubmit={handleBulkSubmit}
        initialData={state.history}
      />

      {state.showSaveModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-lg p-8 animate-reveal shadow-2xl border-4 border-white text-center">
            <h3 className="text-xl font-black text-slate-800 mb-4 uppercase italic tracking-tighter">{t('doeAssistant.saveToArchive')}</h3>
            <input
              autoFocus
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm font-black outline-none shadow-inner mb-6 text-center focus:border-indigo-400 transition-all"
              placeholder={t('doeAssistant.archiveNamePlaceholder')}
              value={state.saveTitle}
              onChange={e => actions.setSaveTitle(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => actions.setShowSaveModal(false)} className="flex-1 py-3.5 bg-slate-100 text-slate-500 rounded-lg text-[11px] font-black uppercase hover:bg-slate-200 transition-all active:scale-95">{t('doeAssistant.cancel')}</button>
              <button onClick={actions.handleSaveResult} disabled={!state.saveTitle.trim()} className="flex-[2] py-3.5 bg-indigo-600 text-white rounded-lg text-[11px] font-black uppercase shadow-xl disabled:opacity-30 hover:bg-black transition-colors">{t('doeAssistant.confirmSave')}</button>
            </div>
          </div>
        </div>
      )}

      {state.showSyncModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[1200] flex items-center justify-center p-4 no-print">
          <div className="bg-white w-full max-w-sm rounded-lg p-8 animate-reveal shadow-2xl border-4 border-white flex flex-col">
            <h3 className="text-lg font-black text-slate-800 mb-6 uppercase italic border-l-8 border-indigo-600 pl-4">{t('doeAssistant.syncToProject')}</h3>
            <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block px-1">{t('doeAssistant.linkedProject')}</label>
                <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs font-bold text-slate-800 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-inner" value={state.targetProjectId} onChange={e => { actions.setTargetProjectId(e.target.value); const a = getAutoSelections(props.projects, e.target.value); actions.setTargetMilestoneId(a.milestoneId); }}>
                  <option value="">{t('doeAssistant.selectProjectPlaceholder')}</option>
                  {props.projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              {state.targetProjectId && (
                <div className="animate-reveal">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-1.5 block px-1">{t('doeAssistant.targetMilestone')}</label>
                  <select className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs font-bold text-slate-800 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-inner" value={state.targetMilestoneId} onChange={e => actions.setTargetMilestoneId(e.target.value)}>
                    <option value="">{t('doeAssistant.selectMilestonePlaceholder')}</option>
                    {flattenMilestonesTree(props.projects.find(p => p.id === state.targetProjectId)?.milestones || []).map(({ milestone: m, depth, label }) => <option key={m.id} value={m.id}>{'　'.repeat(depth)}{label}  {m.title}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-6 shrink-0 border-t border-slate-50 mt-4">
              <button onClick={() => actions.setShowSyncModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase hover:bg-slate-200 transition-all">{t('doeAssistant.cancel')}</button>
              <button onClick={actions.handleSyncToProject} disabled={!state.targetProjectId || !state.targetMilestoneId} className={`flex-1 py-3 text-white rounded-lg text-[10px] font-black uppercase shadow-xl active:scale-95 transition-all bg-indigo-600 hover:bg-black`}>
                {t('doeAssistant.confirmSync')}
              </button>
            </div>
          </div>
        </div>
      )}

      <SafeModal config={state.confirmModal} onClose={() => actions.setConfirmModal(null)} />
    </div>
  );
};

export default DOEAssistant;
