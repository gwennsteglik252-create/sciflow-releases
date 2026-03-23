
import React from 'react';
import { useTranslation } from '../../locales/useTranslation';

interface ProjectMediaItem {
  name: string;
  url: string;
  description?: string;
  refId?: string;
}

interface ImageViewerProps {
  selectedMedia: ProjectMediaItem | null;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ selectedMedia }) => {
  const { t } = useTranslation();
  return (
    <div className="flex-1 bg-slate-100/50 flex flex-col items-center justify-center p-8 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #64748b 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

      {selectedMedia ? (
        <div className="relative max-w-full max-h-full shadow-xl rounded-xl overflow-hidden border-4 border-white bg-white group">
          <img src={selectedMedia.url} className="max-w-full max-h-[70vh] object-contain block" />
          <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md p-4 translate-y-full group-hover:translate-y-0 transition-transform border-t border-slate-100">
            <p className="text-xs font-black text-slate-800 truncate">{selectedMedia.name}</p>
            <p className="text-[10px] text-slate-500 truncate mt-1">
              {selectedMedia.description ? (selectedMedia.description.split('\n\n')[0]) : "未添加图注"}
            </p>
          </div>
        </div>
      ) : (
        <div className="text-slate-300 flex flex-col items-center">
          <i className="fa-solid fa-image text-5xl mb-4"></i>
          <p className="text-xs font-black uppercase tracking-[0.3rem]">{t('figureStudio.noSelection')}</p>
        </div>
      )}
    </div>
  );
};
