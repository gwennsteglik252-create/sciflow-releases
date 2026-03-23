
import React, { useState, useEffect } from 'react';
import { PaperSection } from '../../types';
import { useTranslation } from '../../locales/useTranslation';

interface ManageSectionsModalProps {
  show: boolean;
  onClose: () => void;
  sections: PaperSection[];
  onSave: (updatedSections: PaperSection[]) => void;
}

const ManageSectionsModal: React.FC<ManageSectionsModalProps> = ({ show, onClose, sections, onSave }) => {
  const [localSections, setLocalSections] = useState<PaperSection[]>([]);
  const { t } = useTranslation();

  useEffect(() => {
    if (show) {
      setLocalSections(JSON.parse(JSON.stringify(sections)));
    }
  }, [show, sections]);

  if (!show) return null;

  const handleUpdateTitle = (id: string, newTitle: string) => {
    setLocalSections(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  };

  const handleUpdateProp = (id: string, field: keyof PaperSection, value: any) => {
    setLocalSections(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleDelete = (id: string) => {
    if (window.confirm(t('writing.manageSections.confirmDelete'))) {
      setLocalSections(prev => prev.filter(s => s.id !== id));
    }
  };

  const handleAddSection = () => {
    const newSection: PaperSection = {
      id: `section_${Date.now()}`,
      title: t('writing.manageSections.newSectionTitle'),
      content: '',
      fontSize: 12,
      sectionType: 'Standard',
      fontFamilyEn: 'Times New Roman',
      fontFamilyZh: 'SimSun'
    };
    setLocalSections(prev => [...prev, newSection]);
  };

  const handleConfirm = () => {
    onSave(localSections);
    onClose();
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const next = [...localSections];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setLocalSections(next);
  };

  const handleApplyToAll = (sourceId: string) => {
    const source = localSections.find(s => s.id === sourceId);
    if (!source) return;

    const { fontSize, fontFamilyEn, fontFamilyZh } = source;

    setLocalSections(prev => prev.map(s => ({
      ...s,
      fontSize: fontSize || 12,
      fontFamilyEn: fontFamilyEn || 'Times New Roman',
      fontFamilyZh: fontFamilyZh || 'SimSun'
    })));
    alert(t('writing.manageSections.appliedToAll'));
  };

  const enFonts = [
    { name: 'Times New Roman', value: 'Times New Roman' },
    { name: 'Arial', value: 'Arial' },
    { name: 'Calibri', value: 'Calibri' },
    { name: 'Helvetica', value: 'Helvetica' }
  ];

  const zhFonts = [
    { name: '宋体 (SimSun)', value: 'SimSun' },
    { name: '黑体 (SimHei)', value: 'SimHei' },
    { name: '楷体 (KaiTi)', value: 'KaiTi' },
    { name: '仿宋 (FangSong)', value: 'FangSong' }
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
      <div className="bg-white/90 backdrop-blur-2xl w-full max-w-3xl rounded-[3rem] p-8 lg:p-12 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[90vh]">
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-all active:scale-90">
          <i className="fa-solid fa-times text-2xl"></i>
        </button>

        <header className="mb-8 shrink-0">
          <h3 className="text-2xl font-black text-slate-800 uppercase italic border-l-8 border-indigo-600 pl-6 tracking-tighter">
            {t('writing.manageSections.title')}
          </h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 ml-8">{t('writing.manageSections.subtitle')}</p>
        </header>

        {/* Section List Container with Dashed Border as shown in the screenshot overlay */}
        <div className="flex-1 overflow-hidden flex flex-col border-2 border-dashed border-indigo-200 rounded-[2.5rem] p-6 bg-slate-50/50 mb-6">
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
            {localSections.length > 0 ? (
              localSections.map((section, index) => (
                <div
                  key={section.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className="flex flex-col gap-2 p-3 bg-white rounded-2xl border border-slate-100 group hover:border-indigo-300 transition-all cursor-move shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 text-slate-300 flex items-center justify-center text-[11px] font-black shrink-0 shadow-sm group-hover:text-indigo-400 transition-colors">
                      <i className="fa-solid fa-grip-vertical"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <input
                        className="w-full bg-transparent border-none text-sm font-bold text-slate-800 outline-none focus:bg-slate-50 rounded px-2 py-1 transition-all"
                        value={section.title}
                        onChange={(e) => handleUpdateTitle(section.id, e.target.value)}
                        placeholder={t('writing.manageSections.sectionPlaceholder')}
                      />
                    </div>
                    <button
                      onClick={() => handleDelete(section.id)}
                      className="w-9 h-9 rounded-xl bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center active:scale-90 shrink-0"
                      title={t('writing.manageSections.deleteSection')}
                    >
                      <i className="fa-solid fa-trash-can text-sm"></i>
                    </button>
                  </div>

                  {/* Additional Properties Row (Split Font Config) */}
                  <div className="flex flex-wrap gap-2 pl-11 pr-2 items-center">
                    <div className="flex items-center gap-1 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 shadow-sm min-w-[80px]">
                      <i className="fa-solid fa-text-height text-slate-400 text-[9px]"></i>
                      <input
                        type="number"
                        className="w-8 bg-transparent text-[9px] font-bold text-slate-600 outline-none text-center"
                        value={section.fontSize || 12}
                        onChange={(e) => handleUpdateProp(section.id, 'fontSize', parseInt(e.target.value) || 12)}
                        placeholder="12"
                      />
                      <span className="text-[8px] text-slate-400 font-bold">px</span>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 shadow-sm flex-1 min-w-[100px]">
                      <span className="text-[8px] text-indigo-400 font-bold uppercase">En</span>
                      <select
                        className="w-full bg-transparent text-[9px] font-bold text-slate-600 outline-none appearance-none cursor-pointer"
                        value={section.fontFamilyEn || 'Times New Roman'}
                        onChange={(e) => handleUpdateProp(section.id, 'fontFamilyEn', e.target.value)}
                      >
                        {enFonts.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                      </select>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 shadow-sm flex-1 min-w-[100px]">
                      <span className="text-[8px] text-emerald-500 font-bold uppercase">{t('writing.manageSections.zhLabel')}</span>
                      <select
                        className="w-full bg-transparent text-[9px] font-bold text-slate-600 outline-none appearance-none cursor-pointer"
                        value={section.fontFamilyZh || 'SimSun'}
                        onChange={(e) => handleUpdateProp(section.id, 'fontFamilyZh', e.target.value)}
                      >
                        {zhFonts.map(f => <option key={f.value} value={f.value}>{f.name}</option>)}
                      </select>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100 shadow-sm min-w-[100px]">
                      <i className="fa-solid fa-tag text-slate-400 text-[10px]"></i>
                      <select
                        className="w-full bg-transparent text-[9px] font-bold text-slate-600 outline-none appearance-none cursor-pointer"
                        value={section.sectionType || 'Standard'}
                        onChange={(e) => handleUpdateProp(section.id, 'sectionType', e.target.value)}
                      >
                        <option value="Standard">{t('writing.manageSections.standard')}</option>
                        <option value="Appendix">{t('writing.manageSections.appendix')}</option>
                        <option value="Supplementary">{t('writing.manageSections.supplementary')}</option>
                      </select>
                    </div>

                    <button
                      onClick={() => handleApplyToAll(section.id)}
                      className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-500 hover:bg-indigo-500 hover:text-white flex items-center justify-center transition-all shadow-sm ml-auto"
                      title={t('writing.manageSections.applyToAll')}
                    >
                      <i className="fa-solid fa-clone text-[10px]"></i>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-40 gap-4 py-20">
                <i className="fa-solid fa-list-ul text-5xl text-slate-300"></i>
                <p className="text-xs font-black uppercase tracking-[0.2rem] text-slate-500">{t('writing.manageSections.noSections')}</p>
              </div>
            )}
          </div>
        </div>

        <footer className="shrink-0 flex gap-4 border-t border-slate-100 pt-6">
          <button
            onClick={handleAddSection}
            className="flex-1 py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black text-[11px] uppercase transition-all hover:bg-indigo-50 active:scale-95 flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-plus"></i> {t('writing.manageSections.addSection')}
          </button>
          <button
            onClick={handleConfirm}
            className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase shadow-xl shadow-indigo-100 transition-all hover:bg-black active:scale-95"
          >
            {t('writing.manageSections.confirmApply')}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ManageSectionsModal;
