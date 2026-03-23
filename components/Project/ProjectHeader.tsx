
import React, { useState, useMemo } from 'react';
import { ResearchProject } from '../../types';
import { useProjectContext } from '../../context/ProjectContext';
import { useTranslation } from '../../locales/useTranslation';
import AudioOverviewModal from './AudioOverviewModal';
import { OnlineUser } from '../../hooks/useRealtimePresence';

interface ProjectHeaderProps {
  project: ResearchProject;
  onBack: () => void;
  activeView: string;
  onTabChange: (view: any) => void;
  onEditProject: () => void;
  isGeneratingWeekly: boolean;
  onStartWeeklyReport: (type: any) => void;
  onOpenMembers?: () => void;
  onlineUsers?: OnlineUser[];
}

const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  project, onBack, activeView, onTabChange, onEditProject, isGeneratingWeekly, onStartWeeklyReport, onOpenMembers, onlineUsers
}) => {
  const { inventory, showToast, returnPath } = useProjectContext();
  const { t } = useTranslation();
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [showReadinessPanel, setShowReadinessPanel] = useState(false);

  const reportMenuItems = [
    { id: 'manual', label: t('projectHeader.reportMenu.manual'), color: 'bg-indigo-600' },
    { id: 'weekly', label: t('projectHeader.reportMenu.weekly'), color: 'bg-indigo-50' },
    { id: 'monthly', label: t('projectHeader.reportMenu.monthly'), color: 'bg-violet-50' },
    { id: 'annual', label: t('projectHeader.reportMenu.annual'), color: 'bg-amber-50' }
  ];

  const getTabColor = (id: string) => {
    const colors: Record<string, string> = {
      overview: 'bg-slate-700',
      logs: 'bg-indigo-600',
      process: 'bg-violet-600',
      plan: 'bg-emerald-600',
      sample_matrix: 'bg-cyan-600',
      plan_board: 'bg-amber-600',
      reports: 'bg-fuchsia-600',
      presentation: 'bg-rose-600',
      advisor: 'bg-teal-600'
    };
    return colors[id] || 'bg-indigo-600';
  };

  const readinessData = useMemo(() => {
    if (!project.requiredMaterials || project.requiredMaterials.length === 0) return null;

    const checkResults = project.requiredMaterials.map(req => {
      const inStock = inventory.find(inv =>
        inv.name.toLowerCase().includes(req.name.toLowerCase()) ||
        inv.formula?.toLowerCase().includes(req.name.toLowerCase()) ||
        req.name.toLowerCase().includes(inv.name.toLowerCase())
      );

      let status: 'ready' | 'low' | 'missing' | 'purchasing' = 'missing';
      if (inStock) {
        if (inStock.status === 'Purchasing') {
          status = 'purchasing';
        } else {
          status = inStock.quantity <= inStock.threshold ? 'low' : 'ready';
        }
      }

      return { name: req.name, status, stock: inStock };
    });

    const missing = checkResults.filter(r => r.status === 'missing').length;
    const low = checkResults.filter(r => r.status === 'low').length;
    const purchasing = checkResults.filter(r => r.status === 'purchasing').length;

    let overallStatus: 'ok' | 'warn' | 'crit' = 'ok';
    if (missing > 0) overallStatus = 'crit';
    else if (low > 0 || purchasing > 0) overallStatus = 'warn';

    const hasIssues = missing > 0 || low > 0;

    return { checkResults, overallStatus, missing, low, purchasing, hasIssues };
  }, [project.requiredMaterials, inventory]);

  const handleBatchPurchase = () => {
    if (!readinessData) return;
    const toPurchase = readinessData.checkResults.filter(r => r.status === 'missing' || r.status === 'low');
    if (toPurchase.length === 0) return;

    const { addTaskToActivePlan } = (window as any).ProjectContextValue || {};
    if (!addTaskToActivePlan) {
      showToast({ message: t('projectHeader.cannotCallPurchase'), type: 'error' });
      return;
    }

    toPurchase.forEach(res => {
      addTaskToActivePlan(project.id, `${t('projectHeader.batchPurchaseLabel')}: ${res.name}`, {
        urgency: res.status === 'missing' ? 'Critical' : 'Urgent',
        quantity: 1,
        unit: res.stock?.unit || t('projectDetailModule.unitFallback'),
        deadline: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
        inventoryId: res.stock?.id,
        inventoryName: res.name
      });
    });

    showToast({ message: t('projectHeader.batchPurchaseInitiated', { count: String(toPurchase.length) }), type: 'success' });
    setShowReadinessPanel(false);
  };

  const displayTitle = project.title.length > 7
    ? project.title.substring(0, 7) + '...'
    : project.title;

  // Optimization: Use fuzzy match to determine if the node is from the virtual lab (contains "simulation")
  const isFromVirtualLab = returnPath?.includes('simulation');

  return (
    <>
      <header className="flex flex-row items-center gap-4 mb-3 bg-slate-900/80 p-3.5 rounded-2xl border border-white/10 shrink-0 shadow-xl backdrop-blur-xl z-50 relative">
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onBack}
            className={`w-12 h-12 flex flex-col items-center justify-center rounded-lg transition-all active:scale-90 shadow-md shrink-0 ${isFromVirtualLab ? 'bg-amber-500 text-white border-2 border-white/20' : 'bg-white/10 text-white hover:bg-indigo-600'}`}
          >
            <i className={`fa-solid ${isFromVirtualLab ? 'fa-arrow-left-long' : 'fa-arrow-left'} ${isFromVirtualLab ? 'text-lg' : 'text-base'}`}></i>
            {isFromVirtualLab && <span className="text-[6px] font-black uppercase mt-0.5">{t('projectHeader.backToLab')}</span>}
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white truncate tracking-tight uppercase leading-none max-w-[12rem] md:max-w-xs cursor-pointer hover:text-indigo-400" title={project.title} onClick={onBack}>
                {displayTitle}
              </h2>
              <button onClick={onEditProject} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/10 text-slate-400 hover:text-white transition-all shrink-0" title={t('projectHeader.editProject')}><i className="fa-solid fa-pen text-[9px]"></i></button>
            </div>
            {isFromVirtualLab && (
              <p className="text-[7px] font-black text-amber-400 uppercase tracking-widest leading-none mt-1 animate-pulse">{t('projectHeader.fromVirtualLab')}</p>
            )}
          </div>
        </div>

        <div className="flex flex-row gap-4 flex-1 items-center justify-between min-w-0">
          <div className="flex bg-slate-800/60 p-1.5 rounded-xl overflow-x-auto no-scrollbar">
            {[
              { id: 'overview', label: t('projectHeader.tabs.overview') },
              { id: 'logs', label: t('projectHeader.tabs.logs') },
              { id: 'process', label: t('projectHeader.tabs.process') },
              { id: 'plan', label: t('projectHeader.tabs.plan') },
              { id: 'sample_matrix', label: t('projectHeader.tabs.sampleMatrix') },
              { id: 'plan_board', label: t('projectHeader.tabs.planBoard') },
              { id: 'advisor', label: t('projectHeader.tabs.advisor') },
              { id: 'reports', label: t('projectHeader.tabs.reports') },
              { id: 'presentation', label: t('projectHeader.tabs.presentation') }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-6 py-3 rounded-lg text-[13px] font-black uppercase transition-all whitespace-nowrap ${activeView === tab.id ? `${getTabColor(tab.id)} text-white shadow-lg` : 'text-slate-400 hover:text-slate-200'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 shrink-0 items-center">
            {readinessData && (
              <div className="relative">
                {readinessData.hasIssues && (
                  <button
                    onClick={() => setShowReadinessPanel(!showReadinessPanel)}
                    className={`h-12 px-5 rounded-xl text-[11px] font-black uppercase transition-all flex items-center gap-2 shadow-lg border active:scale-95 ${readinessData.overallStatus === 'crit' ? 'bg-rose-600 text-white border-rose-500 animate-pulse' :
                      readinessData.overallStatus === 'warn' ? 'bg-amber-500 text-white border-amber-400' :
                        'bg-emerald-600 text-white border-emerald-500'
                      }`}
                  >
                    <i className={`fa-solid ${readinessData.overallStatus === 'crit' ? 'fa-triangle-exclamation' : 'fa-clipboard-check'}`}></i>
                    <span>{t('projectHeader.readiness')}: {readinessData.overallStatus === 'ok' ? t('projectHeader.readinessReady') : readinessData.overallStatus === 'warn' ? t('projectHeader.readinessLow') : t('projectHeader.readinessMissing')}</span>
                    <i className={`fa-solid fa-chevron-down text-[10px] transition-transform ${showReadinessPanel ? 'rotate-180' : ''}`}></i>
                  </button>
                )}

                {showReadinessPanel && (
                  <div className="absolute top-full right-0 mt-3 w-80 bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 overflow-hidden animate-reveal z-[100] text-slate-800">
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 flex justify-between">
                      <span>{t('projectHeader.supplyAudit')}</span>
                      <span className="text-indigo-600">{readinessData.checkResults.length} {t('projectHeader.items')}</span>
                    </h4>
                    <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                      {readinessData.checkResults.map((res, i) => (
                        <div key={i} className={`p-3 rounded-2xl border flex justify-between items-center ${res.status === 'missing' ? 'bg-rose-50 border-rose-100' : res.status === 'low' ? 'bg-amber-50 border-amber-100' : res.status === 'purchasing' ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-black truncate">{res.name}</p>
                            <p className="text-[8px] font-bold text-slate-400 mt-0.5">
                              {res.status === 'missing' ? t('projectHeader.missingMsg') : res.status === 'purchasing' ? t('projectHeader.purchasingMsg') : t('projectHeader.stockMsg', { location: res.stock?.location || '--', quantity: String(res.stock?.quantity || ''), unit: res.stock?.unit || '' })}
                            </p>
                          </div>
                          {(res.status === 'missing' || res.status === 'low') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const { addTaskToActivePlan } = (window as any).ProjectContextValue || {};
                                if (addTaskToActivePlan) {
                                  addTaskToActivePlan(project.id, `${t('projectHeader.purchaseMaterial')}: ${res.name}`, {
                                    urgency: res.status === 'missing' ? 'Critical' : 'Urgent',
                                    quantity: 1,
                                    unit: res.stock?.unit || t('projectDetailModule.unitFallback'),
                                    deadline: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
                                    inventoryId: res.stock?.id,
                                    inventoryName: res.name
                                  });
                                }
                              }}
                              className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all shadow-sm ${res.status === 'missing' ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'}`}
                            >
                              {t('projectHeader.purchase')}
                            </button>
                          )}
                          {res.status === 'purchasing' && (
                            <div className="px-3 py-1.5 bg-indigo-100 text-indigo-600 rounded-lg text-[8px] font-black uppercase shadow-sm">
                              {t('projectHeader.syncing')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-3">
                      {(readinessData.missing > 0 || readinessData.low > 0) && (
                        <button
                          onClick={handleBatchPurchase}
                          className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all active:scale-95"
                        >
                          {t('projectHeader.batchPurchase')}
                        </button>
                      )}
                      <p className="text-[8px] text-slate-400 font-bold italic text-center">{t('projectHeader.autoCompareNote')}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {onOpenMembers && (
              <button
                onClick={onOpenMembers}
                className="w-12 h-12 rounded-lg bg-white/10 text-white flex items-center justify-center shadow-lg hover:bg-indigo-600 transition-all active:scale-95 border border-white/10 group"
                title={t('projectHeader.memberManage')}
              >
                <i className="fa-solid fa-users text-base group-hover:scale-110 transition-transform"></i>
              </button>
            )}

            {/* Online Collaborators Avatars */}
            {onlineUsers && onlineUsers.length > 0 && (
              <div className="flex items-center gap-2 ml-1">
                <div className="flex -space-x-2">
                  {onlineUsers.slice(0, 5).map(u => (
                    <div key={u.userId} className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 border-2 border-slate-800 text-white text-[9px] font-black flex items-center justify-center shadow-md" title={u.email}>
                      {u.email.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {onlineUsers.length > 5 && (
                    <div className="w-8 h-8 rounded-full bg-slate-600 border-2 border-slate-800 text-slate-300 text-[8px] font-black flex items-center justify-center">+{onlineUsers.length - 5}</div>
                  )}
                </div>
                <span className="text-[9px] font-bold text-slate-400">{t('projectHeader.onlineCollaborators')}</span>
              </div>
            )}

            <button
              onClick={() => setShowAudioModal(true)}
              className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all active:scale-95 border border-white/10 group"
              title={t('projectDetailModule.audioOverview')}
            >
              <i className="fa-solid fa-headphones text-base group-hover:animate-pulse"></i>
            </button>


          </div>
        </div>
      </header>

      <AudioOverviewModal show={showAudioModal} onClose={() => setShowAudioModal(false)} project={project} />
    </>
  );
};

export default ProjectHeader;
