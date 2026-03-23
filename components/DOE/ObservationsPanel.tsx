
import React, { useRef } from 'react';
import { ResearchProject } from '../../types';
import * as XLSX from 'xlsx';
import { useProjectContext } from '../../context/ProjectContext';
import { useTranslation } from '../../locales';
import { flattenMilestonesTree } from '../Characterization/AnalysisSyncModal';

interface ObservationsPanelProps {
  projects: ResearchProject[];
  processDescription: string;
  setProcessDescription: (val: string) => void;
  handleSelectSourceNode: (nodeId: string) => void;
  history: any[];
  setShowAddHistory: (show: boolean) => void;
  isCalculating: boolean;
  handleCalculate: () => void;
  setConfirmModal: (config: any) => void;
  setHistory: (history: any[]) => void;
  onDiagnoseSynergy?: (runIdx: number) => void;
  isDiagnosingId?: number | null;
}

const ObservationsPanel: React.FC<ObservationsPanelProps> = ({
  projects, processDescription, setProcessDescription, handleSelectSourceNode,
  history, setShowAddHistory, isCalculating, handleCalculate, setConfirmModal, setHistory,
  onDiagnoseSynergy, isDiagnosingId
}) => {
  const { showToast, startGlobalTask, doeSession, updateDoeSession } = useProjectContext();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const linkedProjectId = doeSession.linkedProjectId || '';
  const linkedMilestoneId = doeSession.linkedMilestoneId || '';
  const selectedProject = projects.find(p => p.id === linkedProjectId);

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await startGlobalTask({ id: 'doe_import', type: 'transformation', status: 'running', title: t('doeAssistant.observationsPanel.importing') }, async () => {
      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        // 简单的结构转换逻辑：假设首列为 ID，之后是 Factor，最后是 Response
        const newEntries = jsonData.map(row => {
          const f: Record<string, number> = {};
          const r: Record<string, number> = {};

          Object.entries(row).forEach(([key, val]) => {
            const numVal = parseFloat(String(val));
            if (isNaN(numVal)) return;

            if (doeSession.factors.some(fac => fac.name === key)) f[key] = numVal;
            else if (doeSession.responses.some(res => res.name === key)) r[key] = numVal;
          });

          return { factors: f, responses: r };
        }).filter(entry => Object.keys(entry.factors).length > 0);

        setHistory([...newEntries, ...history]);
        showToast({ message: t('doeAssistant.observationsPanel.importSuccess', { count: newEntries.length }), type: 'success' });
      } catch (error) {
        showToast({ message: t('doeAssistant.observationsPanel.importFailed'), type: 'error' });
      }
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getDeviationColor = (val: number) => {
    if (val > 80) return 'text-rose-500 bg-rose-50 border-rose-100';
    if (val > 30) return 'text-amber-500 bg-amber-50 border-amber-100';
    return 'text-emerald-500 bg-emerald-50 border-emerald-100';
  };

  return (
    <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col gap-4 shrink-0 h-full overflow-hidden">
      <div className="bg-white p-5 rounded-lg border border-slate-200 flex flex-col h-[220px] shadow-sm shrink-0">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 italic shrink-0"><i className="fa-solid fa-flask text-indigo-600"></i> {t('doeAssistant.observationsPanel.title')}</h4>
          <div className="flex items-center gap-1.5 min-w-0">
            <select
              value={linkedProjectId}
              onChange={(e) => {
                const projId = e.target.value;
                updateDoeSession({ linkedProjectId: projId, linkedMilestoneId: '' });
                // 选择课题时自动填充课题级别的背景信息
                if (projId) {
                  const proj = projects.find(p => p.id === projId);
                  if (proj) {
                    const desc = `${t('doeAssistant.observationsPanel.contextLabels.project')}${proj.title}\n${t('doeAssistant.observationsPanel.contextLabels.background')}${proj.description || ''}`;
                    setProcessDescription(desc);
                  }
                }
              }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-[9px] font-black uppercase outline-none cursor-pointer max-w-[110px] truncate"
            >
              <option value="">{t('doeAssistant.observationsPanel.selectProject')}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            {linkedProjectId && selectedProject && (
              <select
                value={linkedMilestoneId}
                onChange={(e) => {
                  const msId = e.target.value;
                  updateDoeSession({ linkedMilestoneId: msId });
                  // 选择里程碑节点后自动填充完整的实验体系背景
                  if (msId && selectedProject) {
                    const ms = selectedProject.milestones.find(m => m.id === msId);
                    if (ms) {
                      const parts = [
                        `${t('doeAssistant.observationsPanel.contextLabels.project')}${selectedProject.title}`,
                        `${t('doeAssistant.observationsPanel.contextLabels.node')}${ms.title}`,
                        ms.hypothesis ? `${t('doeAssistant.observationsPanel.contextLabels.hypothesis')}${ms.hypothesis}` : '',
                        selectedProject.description ? `${t('doeAssistant.observationsPanel.contextLabels.background')}${selectedProject.description}` : '',
                      ].filter(Boolean);
                      setProcessDescription(parts.join('\n'));
                    }
                  }
                }}
                className="bg-indigo-50 border border-indigo-200 rounded-xl px-2 py-1 text-[9px] font-black uppercase outline-none cursor-pointer max-w-[110px] truncate text-indigo-700 animate-reveal"
              >
                <option value="">{t('doeAssistant.observationsPanel.selectNode')}</option>
                {flattenMilestonesTree(selectedProject.milestones).map(({ milestone: m, depth, label }) => <option key={m.id} value={m.id}>{'　'.repeat(depth)}{label}  {m.title}</option>)}
              </select>
            )}
          </div>
        </div>
        <div className="flex-1 bg-slate-50 rounded-lg p-4 border border-slate-100 shadow-inner overflow-hidden">
          <textarea
            className="w-full h-full bg-transparent text-[12px] font-medium text-slate-600 outline-none resize-none custom-scrollbar leading-relaxed"
            value={processDescription}
            onChange={e => setProcessDescription(e.target.value)}
            placeholder={t('doeAssistant.observationsPanel.placeholder')}
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-slate-200 flex flex-col flex-1 overflow-hidden min-h-0 shadow-lg relative pb-28">
        <div className="flex justify-between items-center mb-4 px-1 shrink-0">
          <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 italic"><i className="fa-solid fa-database text-indigo-600"></i> {t('doeAssistant.observationsPanel.datasetTitle')} ({history.length})</h4>
          <div className="flex gap-2">
            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.csv" onChange={handleImportData} />
            <button onClick={() => fileInputRef.current?.click()} className="text-[9px] font-black text-emerald-600 uppercase hover:text-emerald-700 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">{t('doeAssistant.observationsPanel.import')}</button>
            <button onClick={() => setShowAddHistory(true)} className="text-[9px] font-black text-indigo-600 uppercase hover:text-indigo-800 px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100">{t('doeAssistant.observationsPanel.addEntry')}</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
          {history.map((h, i) => {
            const hasAudit = !!h.outlierAudit;
            const mockDev = i === 0 && history.length > 3 ? 42 : 5;
            return (
              <div key={i} className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-3 shadow-sm group hover:border-indigo-300 transition-all hover:bg-white relative">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">RUN #{i + 1}</p>
                      {hasAudit && <span className="text-[7px] font-black bg-indigo-600 text-white px-1.5 py-0.5 rounded-lg shadow-sm">{t('doeAssistant.observationsPanel.audited')}</span>}
                    </div>
                    <p className="text-[9px] text-slate-500 font-bold mt-1 italic">
                      {Object.entries(h.factors as Record<string, any>).map(([k, v]) => `${k}:${v}`).join(' · ')}
                    </p>
                  </div>
                  <div className={`px-2 py-1 rounded-xl border text-[8px] font-black uppercase ${getDeviationColor(mockDev)}`}>{t('doeAssistant.observationsPanel.deviation')}: {mockDev}%</div>
                </div>
                <div className="flex justify-between items-center bg-white/50 p-2 rounded-lg border border-slate-100 shadow-inner">
                  <div className="flex items-center gap-2">
                    {Object.entries(h.responses as Record<string, any>).map(([k, v]) => (
                      <p key={k} className="text-[12px] font-black text-emerald-700 font-mono">{v}</p>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); onDiagnoseSynergy?.(i); }} className="text-[8px] font-black uppercase px-2 py-1 rounded-lg border bg-indigo-50 text-indigo-600 border-indigo-200">{t('doeAssistant.observationsPanel.diagnose')}</button>
                    <button onClick={() => { setConfirmModal({ show: true, title: t('doeAssistant.observationsPanel.removeDataTitle'), desc: t('doeAssistant.observationsPanel.removeDataDesc'), onConfirm: () => { setHistory(history.filter((_, idx) => idx !== i)); setConfirmModal(null); } }); }} className="w-7 h-7 rounded-xl bg-white text-rose-300 hover:text-rose-500 transition-all flex items-center justify-center shadow-sm"><i className="fa-solid fa-trash-can text-[9px]"></i></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="absolute bottom-6 left-6 right-6">
          <button
            onClick={handleCalculate}
            disabled={isCalculating || history.length < 2}
            className={`w-full py-4 bg-indigo-600 text-white rounded-lg text-[12px] font-black shadow-2xl uppercase tracking-[0.2rem] flex items-center justify-center gap-3 hover:bg-black transition-all ${isCalculating ? 'animate-pulse' : ''}`}
          >
            {isCalculating ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
            {t('doeAssistant.observationsPanel.startOptimization')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ObservationsPanel;
