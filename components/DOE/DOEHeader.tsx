import React, { useState, useMemo } from 'react';
import { SavedDOE } from '../../types';
import { useProjectContext } from '../../context/ProjectContext';
import { useTranslation } from '../../locales';
import { SchemeLibraryModal } from '../FigureCenter/SchemeLibraryModal';

interface DOEHeaderProps {
  savedResults: SavedDOE[];
  showArchiveDropdown: boolean;
  setShowArchiveDropdown: (show: boolean) => void;
  loadArchive: (archive: SavedDOE) => void;
  handleDeleteArchive: (id: string, e: React.MouseEvent) => void;
  handleRenameArchive: (id: string, newTitle: string) => void;
  handleCategoryChange?: (id: string, newCategory: string) => void;
  setIntensityMode: (mode: 'screening' | 'standard' | 'ai_inspired') => void;
  setShowOEDModal: (show: boolean) => void;
  setShowConfigModal: (show: boolean) => void;
  handleReset: () => void;
  onSaveTrigger: () => void;
  isSaveDisabled: boolean;
  onLoadPreset?: () => void;
}

export const DOEHeader: React.FC<DOEHeaderProps> = ({
  savedResults,
  showArchiveDropdown,
  setShowArchiveDropdown,
  loadArchive,
  handleDeleteArchive,
  handleRenameArchive,
  handleCategoryChange,
  setIntensityMode,
  setShowOEDModal,
  setShowConfigModal,
  handleReset,
  onSaveTrigger,
  isSaveDisabled,
  onLoadPreset
}) => {
  const { t } = useTranslation();
  const [showModeMenu, setShowModeMenu] = useState(false);
  const { returnPath, setReturnPath } = useProjectContext();

  const handleReturn = () => {
    if (returnPath) {
      const path = returnPath;
      setReturnPath(null);
      if (path.startsWith('#')) {
        window.location.hash = path;
      } else {
        window.location.hash = `#${path}`;
      }
    }
  };

  const returnLabel = useMemo(() => {
    if (!returnPath) return t('doeAssistant.returnLabels.default');
    if (returnPath.includes('plan_board')) return t('doeAssistant.returnLabels.planBoard');
    if (returnPath.includes('plan')) return t('doeAssistant.returnLabels.plan');
    if (returnPath.includes('project/')) return t('doeAssistant.returnLabels.detail');
    return t('doeAssistant.returnLabels.default');
  }, [returnPath, t]);

  return (
    <header className="flex flex-col sm:flex-row justify-between items-center shrink-0 p-5 bg-slate-900/80 backdrop-blur-md rounded-xl border border-white/10 mb-2 gap-4 shadow-2xl relative z-[200]">
      <div className="flex items-center gap-4 shrink-0">
        {returnPath && (
          <button
            onClick={handleReturn}
            className="px-6 py-3 bg-amber-500 text-white rounded-lg text-[11px] font-black uppercase hover:bg-black transition-all flex items-center gap-3 shadow-lg shadow-amber-200/50 animate-bounce-subtle shrink-0 border-2 border-white/20"
          >
            <i className="fa-solid fa-arrow-left-long text-base"></i> {returnLabel}
          </button>
        )}
        <h2 className="text-2xl font-black text-white tracking-tighter italic uppercase shrink-0 border-l-4 border-indigo-500 pl-4 leading-none">{t('doeAssistant.headerTitle')}</h2>
        {onLoadPreset && (
          <button
            onClick={onLoadPreset}
            className="px-4 py-2 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-lg text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all active:scale-95 shadow-lg flex items-center gap-2"
          >
            <i className="fa-solid fa-wand-magic-sparkles text-[11px]"></i> {t('doeAssistant.presetSample')}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2.5 ml-auto">
        {/* 方案库 —— 使用统一的 SchemeLibraryModal */}
        <button onClick={() => setShowArchiveDropdown(true)} className="px-5 py-2.5 bg-white/10 text-slate-100 border border-white/10 rounded-lg text-[10px] font-black uppercase hover:bg-white/20 transition-all active:scale-95 shadow-xl flex items-center gap-2">
          <i className="fa-solid fa-box-archive text-[11px]"></i> {t('doeAssistant.archiveLibrary')} ({savedResults.length})
        </button>

        <SchemeLibraryModal<SavedDOE>
          show={showArchiveDropdown}
          onClose={() => setShowArchiveDropdown(false)}
          items={savedResults}
          onLoad={loadArchive}
          onDelete={(id, e) => handleDeleteArchive(id, e)}
          onRename={handleRenameArchive}
          onCategoryChange={handleCategoryChange || (() => {})}
          moduleIcon="fa-flask-vial"
          moduleLabel="DOE实验"
          renderExtra={(item) => (
            <div className="flex items-center gap-1.5 flex-wrap">
              {item.projectTitle && (
                <span className="text-[7px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">
                  <i className="fa-solid fa-bookmark text-[6px] mr-0.5" />{item.projectTitle}
                </span>
              )}
              {item.milestoneTitle && (
                <span className="text-[7px] font-black bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">
                  <i className="fa-solid fa-flag text-[6px] mr-0.5" />{item.milestoneTitle}
                </span>
              )}
              {item.factors && (
                <span className="text-[7px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                  {item.factors.length} 因子
                </span>
              )}
            </div>
          )}
        />

        <div className="relative z-[100]">
          <button
            onClick={() => setShowModeMenu(!showModeMenu)}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 active:scale-95 border border-emerald-500/50"
          >
            <i className="fa-solid fa-vial text-[11px]"></i> {t('doeAssistant.orthoDesign')} <i className={`fa-solid fa-chevron-down text-[10px] ml-1 transition-transform ${showModeMenu ? 'rotate-180' : ''}`}></i>
          </button>
          {showModeMenu && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-2xl p-1 overflow-hidden animate-reveal z-[220]">
              <div className="p-2 border-b border-slate-100 bg-slate-50">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-2">{t('doeAssistant.selectExpMode')}</span>
              </div>
              <button onClick={() => { setIntensityMode('screening'); setShowOEDModal(true); setShowModeMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 rounded-lg transition-all flex items-center gap-2 group">
                <i className="fa-solid fa-filter text-emerald-500"></i>
                <span className="text-[9px] font-black text-slate-700 uppercase group-hover:text-emerald-600">{t('doeAssistant.modeScreening')}</span>
              </button>
              <button onClick={() => { setIntensityMode('standard'); setShowOEDModal(true); setShowModeMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-indigo-50 rounded-lg transition-all flex items-center gap-2 group">
                <i className="fa-solid fa-table-cells text-indigo-500"></i>
                <span className="text-[9px] font-black text-slate-700 uppercase group-hover:text-indigo-600">{t('doeAssistant.modeStandard')}</span>
              </button>
              <button onClick={() => { setIntensityMode('ai_inspired'); setShowOEDModal(true); setShowModeMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-amber-50 rounded-lg transition-all flex items-center gap-2 group">
                <i className="fa-solid fa-wand-magic-sparkles text-amber-500"></i>
                <span className="text-[9px] font-black text-slate-700 uppercase group-hover:text-amber-600">{t('doeAssistant.modeAiHybrid')}</span>
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onSaveTrigger}
          disabled={isSaveDisabled}
          className="px-5 py-2.5 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase shadow-xl hover:bg-amber-600 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-30 disabled:grayscale"
        >
          <i className="fa-solid fa-floppy-disk text-[11px]"></i> {t('doeAssistant.saveDeduction')}
        </button>

        <button onClick={() => setShowConfigModal(true)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase shadow-xl hover:bg-indigo-700 transition-all flex items-center gap-2 active:scale-95">
          <i className="fa-solid fa-sliders text-[11px]"></i> {t('doeAssistant.configVariables')}
        </button>

        <button onClick={handleReset} className="w-10 h-10 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-lg active:scale-95" title={t('doeAssistant.resetWorkspace')}>
          <i className="fa-solid fa-rotate-right text-[12px]"></i>
        </button>
      </div>
      <style>{`
        @keyframes bounce-subtle {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(-8px); }
        }
        .animate-bounce-subtle { animation: bounce-subtle 1.5s ease-in-out infinite; }
      `}
      </style>
    </header>
  );
};
