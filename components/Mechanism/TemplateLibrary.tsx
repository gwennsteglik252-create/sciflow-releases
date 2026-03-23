import React, { useState, useMemo } from 'react';
import { BUILTIN_TEMPLATES, loadCustomTemplates, saveCustomTemplates, CUSTOM_TEMPLATES_KEY } from './mechanismTemplates';
import type { MechanismTemplate, MechanismTemplateParams } from './types';
import { useTranslation } from '../../locales/useTranslation';

interface TemplateLibraryProps {
  onClose: () => void;
  onLoadTemplate: (params: MechanismTemplateParams) => void;
  currentParams: MechanismTemplateParams;
  showToast: (config: { message: string; type: 'success' | 'info' | 'error' | 'warning' }) => void;
}

const TemplateLibrary: React.FC<TemplateLibraryProps> = ({ onClose, onLoadTemplate, currentParams, showToast }) => {
  const { t } = useTranslation();
  const [customTemplates, setCustomTemplates] = useState<MechanismTemplate[]>(loadCustomTemplates);
  const [saveName, setSaveName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const allTemplates = useMemo(() => [...BUILTIN_TEMPLATES, ...customTemplates], [customTemplates]);

  const categories = useMemo(() => {
    const cats = new Set(allTemplates.map(t => t.category));
    return ['all', ...Array.from(cats)];
  }, [allTemplates]);

  const filtered = useMemo(() =>
    filterCategory === 'all' ? allTemplates : allTemplates.filter(t => t.category === filterCategory),
    [allTemplates, filterCategory]
  );

  const handleLoad = (tpl: MechanismTemplate) => {
    onLoadTemplate(tpl.params);
    showToast({ message: t('mechanism.template.loaded', { name: tpl.name }), type: 'success' });
    onClose();
  };

  const handleSaveCustom = () => {
    if (!saveName.trim()) return;
    const newTpl: MechanismTemplate = {
      id: `custom_${Date.now()}`,
      name: saveName.trim(),
      icon: 'fa-solid fa-bookmark',
      color: 'slate',
      description: `${currentParams.material} | ${currentParams.reactionMode} | pH ${currentParams.pH}`,
      category: '自定义',
      params: { ...currentParams },
      isCustom: true,
    };
    const updated = [newTpl, ...customTemplates];
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    setSaveName('');
    setShowSaveForm(false);
    showToast({ message: t('mechanism.template.saved'), type: 'success' });
  };

  const handleDeleteCustom = (id: string) => {
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    saveCustomTemplates(updated);
    showToast({ message: t('mechanism.template.deleted'), type: 'info' });
  };

  const colorMap: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
    indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-700',  iconBg: 'bg-indigo-100' },
    cyan:    { bg: 'bg-cyan-50',    border: 'border-cyan-200',    text: 'text-cyan-700',    iconBg: 'bg-cyan-100' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', iconBg: 'bg-emerald-100' },
    violet:  { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700',  iconBg: 'bg-violet-100' },
    amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   iconBg: 'bg-amber-100' },
    rose:    { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700',    iconBg: 'bg-rose-100' },
    slate:   { bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-700',   iconBg: 'bg-slate-100' },
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-reveal" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-[720px] max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
              <i className="fa-solid fa-flask-vial text-sm"></i>
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">{t('mechanism.template.title')}</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{t('mechanism.template.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSaveForm(!showSaveForm)}
              className="h-9 px-4 rounded-xl text-[10px] font-black uppercase bg-amber-500/10 text-amber-600 border border-amber-200 hover:bg-amber-500 hover:text-white transition-all flex items-center gap-2"
            >
              <i className="fa-solid fa-plus"></i>
              {t('mechanism.template.saveCurrent')}
            </button>
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 flex items-center justify-center transition-colors">
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>
        </div>

        {/* Save form */}
        {showSaveForm && (
          <div className="px-6 py-3 bg-amber-50/50 border-b border-amber-100 flex items-center gap-3 animate-reveal shrink-0">
            <input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder={t('mechanism.template.nameInputPlaceholder')}
              className="flex-1 bg-white rounded-xl px-4 py-2.5 text-[11px] font-bold outline-none border border-amber-200 focus:border-amber-400"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSaveCustom()}
            />
            <button onClick={handleSaveCustom} disabled={!saveName.trim()} className="h-9 px-4 rounded-xl text-[10px] font-black uppercase bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-all">
              {t('mechanism.template.confirmSave')}
            </button>
          </div>
        )}

        {/* Category filters */}
        <div className="px-6 pt-4 pb-2 flex items-center gap-2 flex-wrap shrink-0">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${filterCategory === cat ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              {cat === 'all' ? t('mechanism.template.filterAll') : cat}
            </button>
          ))}
        </div>

        {/* Template Grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 grid grid-cols-2 gap-3">
          {filtered.map(tpl => {
            const c = colorMap[tpl.color] || colorMap.slate;
            return (
              <div
                key={tpl.id}
                onClick={() => handleLoad(tpl)}
                className={`${c.bg} border ${c.border} rounded-2xl p-4 cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all group relative`}
              >
                {tpl.isCustom && (
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteCustom(tpl.id); }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white transition-all"
                    title={t('mechanism.template.deleteCustom')}
                  >
                    <i className="fa-solid fa-trash-can text-[8px]"></i>
                  </button>
                )}
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-9 h-9 rounded-xl ${c.iconBg} ${c.text} flex items-center justify-center shadow-sm`}>
                    <i className={`${tpl.icon} text-sm`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`text-[11px] font-black ${c.text} uppercase truncate`}>{tpl.name}</h4>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{tpl.category}</p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-600 leading-relaxed line-clamp-2">{tpl.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-white/80 text-[8px] font-black text-slate-500">{tpl.params.material}</span>
                  <span className="px-2 py-0.5 rounded bg-white/80 text-[8px] font-black text-slate-500">{tpl.params.reactionMode}</span>
                  <span className="px-2 py-0.5 rounded bg-white/80 text-[8px] font-black text-slate-500">pH {tpl.params.pH}</span>
                  <span className="px-2 py-0.5 rounded bg-white/80 text-[8px] font-black text-slate-500">{tpl.params.potential}V</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TemplateLibrary;
