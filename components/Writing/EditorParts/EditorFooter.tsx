import React from 'react';
import { useTranslation } from '../../../locales/useTranslation';

interface EditorFooterProps {
  saveStatus: 'saved' | 'saving' | 'unsaved';
  lastSavedTime: string;
  charCount: number;
  onManualSave: () => void;
}

export const EditorFooter: React.FC<EditorFooterProps> = ({ saveStatus, lastSavedTime, charCount, onManualSave }) => {
  const { t } = useTranslation();
  return (
    <div className="p-3 border-t border-slate-100 text-right text-[10px] text-slate-400 font-mono px-4 sm:px-6 flex justify-between items-center bg-white shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${saveStatus === 'saved' ? 'bg-emerald-400' : saveStatus === 'saving' ? 'bg-amber-400 animate-pulse' : 'bg-slate-300'}`}></div>
          <span className="uppercase font-bold">{saveStatus === 'saved' ? `${t('writing.footer.saved')} (${lastSavedTime})` : saveStatus === 'saving' ? t('writing.footer.saving') : t('writing.footer.unsaved')}</span>
        </div>

        <button
          onClick={onManualSave}
          className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-2 active:scale-95 border ${saveStatus === 'unsaved' ? 'bg-amber-600 text-white border-amber-500 shadow-md' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600'}`}
          title={t('writing.footer.manualSave')}
        >
          <i className={`fa-solid ${saveStatus === 'saving' ? 'fa-circle-notch animate-spin' : 'fa-floppy-disk'}`}></i>
          {saveStatus === 'unsaved' ? t('writing.footer.saveNow') : t('writing.footer.alreadySaved')}
        </button>
      </div>
      <span className="font-black tracking-widest uppercase opacity-60">
        {t('writing.footer.charCount', { count: charCount })}
      </span>
    </div>
  );
};
