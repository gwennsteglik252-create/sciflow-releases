
import React from 'react';
import { useGenerativeDesigner } from '../../../hooks/useGenerativeDesigner';
import { useTranslation } from '../../../locales/useTranslation';

interface GenerativeLibraryModalProps {
    logic: ReturnType<typeof useGenerativeDesigner>;
}

export const GenerativeLibraryModal: React.FC<GenerativeLibraryModalProps> = ({ logic }) => {
    const { showLibraryModal, setShowLibraryModal, savedLibrary, deleteFromLibrary, handleDownload, handleSelectForIteration } = logic;
    const { t } = useTranslation();

    if (!showLibraryModal) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-5xl h-[85vh] rounded-[3rem] p-8 animate-reveal shadow-2xl relative border-4 border-white flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                            <i className="fa-solid fa-cloud text-2xl"></i>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">{t('figureCenter.generative.cloudGallery')}</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Stored Assets & Scientific Visuals</p>
                        </div>
                    </div>
                    <button onClick={() => setShowLibraryModal(false)} className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"><i className="fa-solid fa-times text-xl"></i></button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {savedLibrary.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {savedLibrary.map((item, idx) => (
                                <div key={idx} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 group relative hover:shadow-lg transition-all">
                                    <div className="aspect-square bg-white rounded-xl overflow-hidden relative mb-3">
                                        <img src={item.url} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button onClick={() => handleDownload(item.url)} className="w-10 h-10 bg-white rounded-full text-indigo-600 flex items-center justify-center hover:scale-110 transition-transform shadow-lg" title={t('figureCenter.generative.downloadBtn')}><i className="fa-solid fa-download"></i></button>
                                            <button onClick={() => { handleSelectForIteration(item); setShowLibraryModal(false); }} className="w-10 h-10 bg-white rounded-full text-amber-500 flex items-center justify-center hover:scale-110 transition-transform shadow-lg" title={t('figureCenter.generative.iterateBtn')}><i className="fa-solid fa-pen-to-square"></i></button>
                                            <button onClick={() => deleteFromLibrary(idx)} className="w-10 h-10 bg-white rounded-full text-rose-500 flex items-center justify-center hover:scale-110 transition-transform shadow-lg" title={t('figureCenter.generative.deleteBtn')}><i className="fa-solid fa-trash"></i></button>
                                        </div>
                                    </div>
                                    <div className="px-1">
                                        <p className="text-[9px] font-black text-slate-700 truncate" title={item.prompt}>{item.prompt}</p>
                                        <div className="flex justify-between items-center mt-1">
                                            <span className="text-[8px] font-bold text-slate-400">{item.timestamp}</span>
                                            <span className="text-[7px] font-black bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">{item.style.split(' ')[0]}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4">
                            <i className="fa-solid fa-images text-6xl text-slate-300"></i>
                            <p className="text-sm font-black uppercase tracking-widest text-slate-400">{t('figureCenter.generative.noContent')}</p>
                        </div>
                    )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Images are stored locally in your browser cache</p>
                </div>
            </div>
        </div>
    );
};
