
import React, { useState, useMemo } from 'react';
import { Milestone, MatrixReport } from '../../../types';
import SafeModal, { SafeModalConfig } from '../../SafeModal';
import { useTranslation } from '../../../locales/useTranslation';

interface MilestoneDocsViewProps {
  milestone?: Milestone;
  onUpdateMilestone: (milestone: Milestone) => void;
  updateAi: (updates: any) => void;
  toggleModal: (key: any, value: any) => void;
  onBackToWorkflow: () => void;
  onTraceLog?: (logId: string) => void;
}

const MilestoneDocsView: React.FC<MilestoneDocsViewProps> = ({
  milestone,
  onUpdateMilestone,
  updateAi,
  toggleModal,
  onBackToWorkflow,
  onTraceLog
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmModal, setConfirmModal] = useState<SafeModalConfig | null>(null);

  const filteredDocs = useMemo(() => {
    if (!milestone?.savedDocuments) return [];
    const q = searchQuery.toLowerCase().trim();
    return milestone.savedDocuments.filter(doc =>
      doc.title.toLowerCase().includes(q) || (doc.content || '').toLowerCase().includes(q)
    );
  }, [milestone?.savedDocuments, searchQuery]);

  const handleDeleteDoc = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!milestone) return;
    setConfirmModal({
      show: true,
      title: t('projectDetailModule.milestoneDocs.deleteTitle'),
      desc: t('projectDetailModule.milestoneDocs.deleteDesc'),
      onConfirm: () => {
        const updatedDocs = (milestone.savedDocuments || []).filter(d => d.id !== id);
        onUpdateMilestone({ ...milestone, savedDocuments: updatedDocs });
        setConfirmModal(null);
      }
    });
  };

  const handleRenameDoc = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!milestone) return;
    const doc = milestone.savedDocuments?.find(d => d.id === id);
    if (!doc) return;
    const newTitle = window.prompt(t('projectDetailModule.milestoneDocs.renamePrompt'), doc.title);
    if (newTitle && newTitle.trim()) {
      const updatedDocs = milestone.savedDocuments?.map(d => d.id === id ? { ...d, title: newTitle } : d);
      onUpdateMilestone({ ...milestone, savedDocuments: updatedDocs });
    }
  };

  if (!milestone) return null;

  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 lg:p-6 overflow-hidden bg-slate-50/20">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBackToWorkflow} className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 flex items-center justify-center transition-all shadow-sm"><i className="fa-solid fa-arrow-left"></i></button>
          <div>
            <h3 className="text-lg lg:text-2xl font-black text-slate-800 uppercase tracking-tight italic mb-0">{t('projectDetailModule.milestoneDocs.title')}</h3>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">{milestone.title}</p>
          </div>
        </div>
        <div className="relative flex-1 sm:w-64 max-w-xs">
          <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input
            type="text"
            placeholder={t('projectDetailModule.milestoneDocs.searchPlaceholder')}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-[10px] font-bold outline-none focus:border-indigo-300 transition-all shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        {filteredDocs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 pb-6">
            {filteredDocs.map(doc => {
              const typeMatch = doc.title?.match(/^\[(.*?)\]/);
              const typeLabelRaw = typeMatch ? typeMatch[1] : null;
              
              // 映射翻译
              let typeLabel = typeLabelRaw;
              if (typeLabelRaw === '总结') typeLabel = t('projectDetailModule.milestoneDocs.types.summary');
              else if (typeLabelRaw === 'AI审计') typeLabel = t('projectDetailModule.milestoneDocs.types.audit');
              else if (typeLabelRaw === '机理') typeLabel = t('projectDetailModule.milestoneDocs.types.mechanism');
              else if (typeLabelRaw === '内参') typeLabel = t('projectDetailModule.milestoneDocs.types.standard');

              const typeColor = typeLabelRaw === '总结' ? 'bg-violet-100 text-violet-600' : typeLabelRaw === 'AI审计' ? 'bg-rose-100 text-rose-600' : typeLabelRaw === '机理' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600';
              return (
                <div key={doc.id} onClick={() => { updateAi({ currentReport: { id: doc.id, title: doc.title, content: doc.content || '', sourceLogIds: doc.sourceLogIds } }); toggleModal('weekly', true); }} className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer relative group">
                  <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                    <button onClick={(e) => handleRenameDoc(doc.id, e)} className="w-6 h-6 bg-indigo-50 text-indigo-500 rounded-md flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all"><i className="fa-solid fa-pen text-[8px]"></i></button>
                    <button onClick={(e) => handleDeleteDoc(doc.id, e)} className="w-6 h-6 bg-rose-50 text-rose-400 rounded-md flex items-center justify-center hover:bg-rose-600 hover:text-white transition-all"><i className="fa-solid fa-trash-can text-[8px]"></i></button>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    {typeLabel && <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md ${typeColor}`}>{typeLabel}</span>}
                    <span className="text-[7px] font-bold text-slate-300">{doc.timestamp}</span>
                  </div>
                  <h4 className="text-[11px] font-black text-slate-800 uppercase italic line-clamp-1 leading-tight mb-1.5 pr-8">{doc.title?.replace(/^\[.*?\]\s*/, '')}</h4>
                  <p className="text-[9px] text-slate-400 italic line-clamp-2 leading-relaxed mb-2">{doc.content}</p>
                  {doc.sourceLogContent && (
                    <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-50">
                      <i className="fa-solid fa-flask text-[7px] text-indigo-400"></i>
                      <span
                        onClick={(e) => { e.stopPropagation(); if (doc.sourceLogId && onTraceLog) onTraceLog(doc.sourceLogId); }}
                        className={`text-[7px] font-bold truncate ${doc.sourceLogId && onTraceLog ? 'text-indigo-500 hover:text-indigo-700 cursor-pointer hover:underline' : 'text-indigo-400'}`}
                      >
                        {t('projectDetailModule.milestoneDocs.sourcePrefix')} {doc.sourceLogContent}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4">
            <i className="fa-solid fa-box-open text-5xl text-slate-300"></i>
            <p className="text-[11px] font-black uppercase tracking-[0.4rem] italic">{t('projectDetailModule.milestoneDocs.emptyState')}</p>
          </div>
        )}
      </div>
      <SafeModal config={confirmModal} onClose={() => setConfirmModal(null)} />
    </div>
  );
};

export default MilestoneDocsView;
