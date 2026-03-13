
import React from 'react';
import { useTranslation } from '../../locales/useTranslation';

type DetailLevel = 'concise' | 'standard' | 'detailed';

interface AnalysisTabProps {
  analysisContext: string;
  setAnalysisContext: (val: string) => void;
  analysisText: string;
  setAnalysisText: (val: string) => void;
  isAnalyzing: boolean;
  onGenerate: (detailLevel: DetailLevel) => void;
  onInsert: (() => void) | undefined;
  onQuickSave: () => void;
  selectedMedia: any;
  onCopyToClipboard: () => void;
}

const DETAIL_OPTIONS: { value: DetailLevel; label: string; desc: string; labelKey: string; descKey: string }[] = [
  { value: 'concise', label: '精简', desc: '核心要点', labelKey: 'figureStudio.concise', descKey: 'figureStudio.conciseDesc' },
  { value: 'standard', label: '标准', desc: '均衡适中', labelKey: 'figureStudio.standard', descKey: 'figureStudio.standardDesc' },
  { value: 'detailed', label: '详细', desc: '全面深入', labelKey: 'figureStudio.detailed', descKey: 'figureStudio.detailedDesc' },
];

export const AnalysisTab: React.FC<AnalysisTabProps> = ({
  analysisContext, setAnalysisContext, analysisText, setAnalysisText,
  isAnalyzing, onGenerate, onInsert, onQuickSave, selectedMedia, onCopyToClipboard
}) => {
  const { t } = useTranslation();
  const [detailLevel, setDetailLevel] = React.useState<DetailLevel>('standard');

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden min-h-0 animate-reveal">
      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 shrink-0">
        <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">{t('figureStudio.contextLabel')}</label>
        <textarea
          className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-medium text-slate-700 outline-none resize-none h-16 focus:ring-1 focus:ring-indigo-200"
          placeholder={t('figureStudio.contextPlaceholder')}
          value={analysisContext}
          onChange={(e) => setAnalysisContext(e.target.value)}
        />

        {/* 详细度选择器 */}
        <div className="flex items-center gap-1 mt-2">
          <span className="text-[8px] font-black text-slate-400 uppercase shrink-0 mr-1">{t('figureStudio.detailLevel')}</span>
          {DETAIL_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDetailLevel(opt.value)}
              className={`flex-1 py-1 rounded-md text-[9px] font-black uppercase transition-all ${detailLevel === opt.value
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300'
                }`}
              title={opt.desc}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200 rounded-xl overflow-hidden relative shadow-inner">
        <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex justify-between items-center">
          <span className="text-[9px] font-black text-slate-500 uppercase">{t('figureStudio.aiResult')}</span>
          {analysisText && (
            <button
              onClick={onCopyToClipboard}
              className="text-[9px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-100 hover:bg-indigo-50"
            >
              {t('figureStudio.copyText')}
            </button>
          )}
        </div>
        <textarea
          className="flex-1 w-full bg-transparent p-3 text-[11px] leading-relaxed text-slate-700 outline-none resize-none custom-scrollbar font-medium text-justify"
          placeholder={t('figureStudio.resultPlaceholder')}
          value={analysisText}
          onChange={(e) => setAnalysisText(e.target.value)}
        />
        {isAnalyzing && (
          <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center backdrop-blur-[1px] z-10">
            <i className="fa-solid fa-spinner animate-spin text-indigo-500 text-2xl mb-2"></i>
            <p className="text-[9px] font-black uppercase text-indigo-400">{t('figureStudio.analyzing')}</p>
          </div>
        )}
      </div>

      <div className="mt-4 shrink-0 grid grid-cols-2 gap-2">
        <button
          onClick={() => onGenerate(detailLevel)}
          disabled={!selectedMedia || isAnalyzing}
          className="w-full py-3 bg-white text-indigo-600 border border-indigo-200 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-microscope"></i>
          {t('figureStudio.generateDescOnly')}
        </button>
        <button
          onClick={() => {
            onQuickSave();
            alert(t('figureStudio.savedSuccess'));
          }}
          disabled={!selectedMedia}
          className="w-full py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-floppy-disk"></i>
          {t('figureStudio.saveInfo')}
        </button>
      </div>
    </div>
  );
};
