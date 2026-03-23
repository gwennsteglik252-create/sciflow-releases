
import React from 'react';
import { useTranslation } from '../../locales/useTranslation';

interface AssetEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  editName: string;
  setEditName: (val: string) => void;
  editDescription: string;
  setEditDescription: (val: string) => void;
  onSave: () => void;
}

export const AssetEditModal: React.FC<AssetEditModalProps> = ({
  isOpen, onClose, editName, setEditName, editDescription, setEditDescription, onSave
}) => {
  if (!isOpen) return null;
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-[2rem] p-8 shadow-2xl animate-reveal relative">
        <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
          <i className="fa-solid fa-pen-to-square text-indigo-600"></i> {t('figureStudio.editAssetInfo')}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">{t('figureStudio.imageName')}</label>
            <input
              autoFocus
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder={t('figureStudio.imageNamePlaceholder')}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">{t('figureStudio.captionWithAnalysis')}</label>
            <textarea
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all h-48 resize-none leading-relaxed custom-scrollbar"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder={t('figureStudio.captionDescPlaceholder')}
            />
            <p className="text-[8px] text-slate-400 mt-1 italic">{t('figureStudio.captionNote')}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all">{t('common.cancel')}</button>
          <button onClick={onSave} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-lg transition-all">{t('figureStudio.confirmEdit')}</button>
        </div>
      </div>
    </div>
  );
};
