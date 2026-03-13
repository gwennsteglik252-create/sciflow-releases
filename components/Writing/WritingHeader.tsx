
import React from 'react';
import { ResearchProject } from '../../types';
import { DocType } from './WritingConfig';
import { useTranslation } from '../../locales/useTranslation';

interface WritingHeaderProps {
  selectedProject: ResearchProject | undefined;
  projects: ResearchProject[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  docType: DocType;
  onDocTypeChange: (type: DocType) => void;
  onSectionSwitch: (id: string) => void;
  isLightMode: boolean;
  onManualSave: () => void;
  language: 'zh' | 'en';
  setLanguage: (lang: 'zh' | 'en') => void;
  viewMode: 'standard' | 'dual' | 'triple';
  setViewMode: (mode: 'standard' | 'dual' | 'triple') => void;
  isFocusMode: boolean;
  setIsFocusMode: (v: boolean) => void;
  onOpenSettings: () => void;
}

const WritingHeader: React.FC<WritingHeaderProps> = ({
  selectedProject,
  isLightMode,
  onManualSave,
  viewMode,
  setViewMode,
  isFocusMode,
  setIsFocusMode,
  onOpenSettings
}) => {
  const { t } = useTranslation();
  const displayTitle = selectedProject?.title && selectedProject.title.length > 25
    ? selectedProject.title.substring(0, 25) + '...'
    : selectedProject?.title || t('writing.noProject');

  return (
    <header className="flex flex-col sm:flex-row items-center shrink-0 py-4 px-2 gap-4 lg:gap-8 bg-transparent">
      <div className="flex items-center gap-6 w-full sm:w-auto">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-[1.2rem] bg-indigo-600 flex items-center justify-center text-white shadow-[0_8px_16px_-4px_rgba(99,102,241,0.5)] shrink-0 transition-transform hover:scale-105">
            <i className="fa-solid fa-pen-nib text-xl"></i>
          </div>
          <div className="min-w-0">
            <h2 className={`text-xl sm:text-2xl font-black tracking-tighter italic uppercase truncate ${isLightMode ? 'text-slate-900' : 'text-white'}`}>{t('writing.academicWriting')}</h2>
            <p className={`text-[10px] font-bold truncate flex items-center gap-2 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`} title={selectedProject?.title}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLightMode ? 'bg-indigo-500' : 'bg-indigo-400'} animate-pulse`}></span>
              Context: {displayTitle}
            </p>
          </div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-4">
        {/* Focus Mode Toggle - Enhanced visibility in multi-column modes */}
        <button
          onClick={() => setIsFocusMode(!isFocusMode)}
          className={`h-11 px-5 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center gap-2 shadow-sm border active:scale-95 ${isFocusMode ? 'bg-indigo-600 text-white border-indigo-400 animate-pulse' : isLightMode ? 'bg-white text-indigo-500 border-indigo-100 hover:bg-indigo-50' : 'bg-slate-800 text-slate-400 border-white/10 hover:bg-slate-700'}`}
          title={t('writing.header.focusModeTitle')}
        >
          <i className={`fa-solid ${isFocusMode ? 'fa-bullseye text-indigo-200' : 'fa-crosshairs'}`}></i>
          {t('writing.header.focusMode')}
        </button>

        {/* View Mode Switcher - Styled to match screenshot request */}
        <div className={`flex items-center p-1.5 rounded-2xl border shadow-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10'}`}>
          <button
            onClick={() => setViewMode('standard')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${viewMode === 'standard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50'}`}
          >
            <i className="fa-solid fa-columns"></i> {t('writing.header.standard')}
          </button>
          <button
            onClick={() => setViewMode('dual')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${viewMode === 'dual' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50'}`}
          >
            <i className="fa-solid fa-table-columns"></i> {t('writing.header.dual')}
          </button>
          <button
            onClick={() => setViewMode('triple')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${viewMode === 'triple' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/50'}`}
          >
            <i className="fa-solid fa-table-list"></i> {t('writing.header.triple')}
          </button>
        </div>

        <div className={`w-px h-8 ${isLightMode ? 'bg-slate-200' : 'bg-white/10'} mx-1`}></div>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className={`h-11 px-5 rounded-2xl flex items-center justify-center border transition-all active:scale-95 shadow-sm gap-2.5 ${isLightMode ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-indigo-300' : 'bg-slate-800 border-white/10 text-slate-300 hover:bg-slate-700'}`}
          title={t('writing.header.settingsTitle')}
        >
          <i className="fa-solid fa-cog text-sm"></i>
          <span className="text-[11px] font-black uppercase whitespace-nowrap">{t('writing.header.settings')}</span>
        </button>

        {/* Large Primary Save Button */}
        <button
          onClick={onManualSave}
          className="h-11 px-8 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-[0_8px_20px_-4px_rgba(16,185,129,0.5)] hover:bg-emerald-700 hover:shadow-[0_12px_24px_-4px_rgba(16,185,129,0.6)] transition-all flex items-center gap-3 active:scale-95"
        >
          <i className="fa-solid fa-floppy-disk text-sm"></i>
          <span>{t('writing.header.saveDraft')}</span>
        </button>
      </div>
    </header>
  );
};

export default WritingHeader;
