
import React from 'react';
import { useTranslation } from '../../locales/useTranslation';

interface ProjectMediaItem {
  name: string;
  url: string;
  description?: string;
  logTimestamp?: string;
  refId?: string;
  logId: string;
  fileIndex: number;
}

interface MediaGalleryProps {
  projectMedia: ProjectMediaItem[];
  selectedMedia: ProjectMediaItem | null;
  onSelect: (media: ProjectMediaItem) => void;
  onEdit: (media: ProjectMediaItem, e: React.MouseEvent) => void;
  getFigureNumber: (refId: string) => number;
}

export const MediaGallery: React.FC<MediaGalleryProps> = ({
  projectMedia, selectedMedia, onSelect, onEdit, getFigureNumber
}) => {
  const { t } = useTranslation();
  return (
    <div className="w-72 bg-slate-50 border-r border-slate-200 flex flex-col p-5 shrink-0">
      <div className="flex items-center gap-3 mb-6 px-1">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-200">
          <i className="fa-solid fa-images"></i>
        </div>
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">{t('figureStudio.projectMedia')}</h3>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
        {projectMedia.map((media, idx) => {
          const figNum = getFigureNumber(media.refId || '');
          return (
            <div
              key={idx}
              onClick={() => onSelect(media)}
              className={`p-3 rounded-xl cursor-pointer transition-all border group relative flex items-start gap-3 ${selectedMedia === media ? 'bg-white border-indigo-500 shadow-md ring-1 ring-indigo-100' : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm'}`}
            >
              <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-100 relative">
                <img src={media.url} className="w-full h-full object-cover" />
                {figNum > 0 && (
                  <div className="absolute top-0 left-0 bg-indigo-600 text-white text-[7px] px-1 font-black rounded-br-md shadow-sm">
                    F.{figNum}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[11px] font-bold truncate ${selectedMedia === media ? 'text-indigo-700' : 'text-slate-700'}`}>{media.name}</p>
                <p className="text-[9px] text-slate-400 truncate mt-0.5">
                  {media.description ? (media.description.includes('[Analysis]') ? t('figureStudio.containsAnalysis') : media.description) : t('figureStudio.noCaption')}
                </p>
                <p className="text-[8px] text-slate-300 font-mono mt-1">{media.logTimestamp?.split(' ')[0]}</p>
              </div>

              <button
                onClick={(e) => onEdit(media, e)}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:bg-indigo-600 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md"
                title={t('figureStudio.editNameInfo')}
              >
                <i className="fa-solid fa-pen text-xs"></i>
              </button>
            </div>
          );
        })}
        {projectMedia.length === 0 && <p className="text-slate-400 text-[10px] text-center italic py-10">{t('figureStudio.noMedia')}</p>}
      </div>
    </div>
  );
};
