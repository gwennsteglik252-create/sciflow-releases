
import React from 'react';
import { DOEFactor, DOEResponse } from '../../types';
import { DEFAULT_DOE_PRESETS } from './constants';

import { useTranslation } from '../../locales';

interface DOEConfigModalProps {
  show: boolean;
  onClose: () => void;
  factors: DOEFactor[];
  setFactors: (val: DOEFactor[]) => void;
  responses: DOEResponse[];
  setResponses: (val: DOEResponse[]) => void;
  
  // Template Management
  customTemplates: any[];
  loadTemplate: (tpl: any) => void;
  showSaveTemplateModal: boolean;
  setShowSaveTemplateModal: (show: boolean) => void;
  handleSaveAsTemplate: () => void;
  handleReset: () => void;
  newTemplateTitle: string;
  setNewTemplateTitle: (val: string) => void;
  deleteTemplate: (id: string) => void;
}

const DOEConfigModal: React.FC<DOEConfigModalProps> = ({
  show, onClose, factors, setFactors, responses, setResponses,
  customTemplates, loadTemplate, showSaveTemplateModal, setShowSaveTemplateModal,
  handleSaveAsTemplate, handleReset, newTemplateTitle, setNewTemplateTitle, deleteTemplate
}) => {
  const { t } = useTranslation();
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1300] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-xl p-8 lg:p-12 animate-reveal shadow-2xl relative border-4 border-white max-h-[90vh] flex flex-col">
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-all"><i className="fa-solid fa-times text-xl"></i></button>
        <h3 className="text-xl font-black text-slate-800 mb-8 uppercase italic border-l-8 border-indigo-600 pl-6">{t('doeAssistant.configModal.title')}</h3>
        
        {/* Template & Preset Management Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 mb-6 gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-indigo-500 shadow-sm border border-indigo-50 shrink-0">
                    <i className="fa-solid fa-layer-group"></i>
                </div>
                <select 
                    className="bg-transparent text-xs font-bold text-slate-600 outline-none w-full sm:w-48 cursor-pointer hover:text-indigo-600 transition-colors"
                    onChange={(e) => {
                        const val = e.target.value;
                        const preset = DEFAULT_DOE_PRESETS.find(p => p.id === val);
                        if (preset) {
                            loadTemplate(preset);
                        } else {
                            const custom = customTemplates.find(t => t.id === val);
                            if (custom) loadTemplate(custom);
                        }
                    }}
                    value=""
                >
                    <option value="" disabled>{t('doeAssistant.configModal.preset.placeholder')}</option>
                    <optgroup label={t('doeAssistant.configModal.preset.systemGroup')}>
                        {DEFAULT_DOE_PRESETS.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </optgroup>
                    <optgroup label={t('doeAssistant.configModal.preset.customGroup')}>
                        {customTemplates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        {customTemplates.length === 0 && <option disabled>{t('doeAssistant.configModal.preset.noSaved')}</option>}
                    </optgroup>
                </select>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={() => setShowSaveTemplateModal(true)} className="flex-1 sm:flex-none text-[10px] font-black text-indigo-600 bg-white px-4 py-2 rounded-xl border border-indigo-100 shadow-sm hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 active:scale-95">
                    <i className="fa-solid fa-floppy-disk"></i> {t('doeAssistant.configModal.preset.saveCurrent')}
                </button>
                <button onClick={handleReset} className="flex-1 sm:flex-none text-[10px] font-black text-rose-500 bg-white px-4 py-2 rounded-xl border border-rose-100 shadow-sm hover:bg-rose-50 transition-all flex items-center justify-center gap-2 active:scale-95">
                    <i className="fa-solid fa-rotate-left"></i> {t('doeAssistant.configModal.preset.reset')}
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
           <div className="space-y-8">
             <section>
                <div className="flex justify-between items-center mb-4"><h4 className="text-[10px] font-black text-slate-950 uppercase tracking-widest">{t('doeAssistant.configModal.factors.title')}</h4><button onClick={() => setFactors([...factors, { name: '', unit: '', min: 0, max: 100 }])} className="text-[9px] font-black text-indigo-600">{t('doeAssistant.configModal.factors.add')}</button></div>
                <div className="grid grid-cols-4 gap-2 px-3 mb-2 text-[8px] font-black text-slate-400 uppercase tracking-widest"><span>{t('doeAssistant.configModal.factors.colName')}</span><span>{t('doeAssistant.configModal.factors.colUnit')}</span><span>{t('doeAssistant.configModal.factors.colMin')}</span><span>{t('doeAssistant.configModal.factors.colMax')}</span></div>
                {factors.map((f, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 mb-2 p-3 bg-slate-50 rounded-xl border border-slate-100 relative group transition-all hover:bg-white hover:shadow-md hover:border-indigo-100">
                    <input className="bg-white rounded-xl p-2 text-[10px] font-bold outline-none shadow-sm focus:ring-1 focus:ring-indigo-200" placeholder={t('doeAssistant.configModal.factors.placeholderName')} value={f.name} onChange={e => {const n=[...factors]; n[i].name=e.target.value; setFactors(n);}} />
                    <input className="bg-white rounded-xl p-2 text-[10px] font-bold outline-none shadow-sm focus:ring-1 focus:ring-indigo-200" placeholder={t('doeAssistant.configModal.factors.placeholderUnit')} value={f.unit} onChange={e => {const n=[...factors]; n[i].unit=e.target.value; setFactors(n);}} />
                    <input type="number" className="bg-white rounded-xl p-2 text-[10px] font-bold outline-none shadow-sm focus:ring-1 focus:ring-indigo-200" placeholder="Min" value={f.min} onChange={e => {const n=[...factors]; n[i].min=parseFloat(e.target.value); setFactors(n);}} />
                    <input type="number" className="bg-white rounded-xl p-2 text-[10px] font-bold outline-none shadow-sm focus:ring-1 focus:ring-indigo-200" placeholder="Max" value={f.max} onChange={e => {const n=[...factors]; n[i].max=parseFloat(e.target.value); setFactors(n);}} />
                    <button onClick={() => setFactors(factors.filter((_, idx)=>idx!==i))} className="absolute -right-2 -top-2 w-6 h-6 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-md flex items-center justify-center active:scale-90"><i className="fa-solid fa-times text-[10px]"></i></button>
                  </div>
                ))}
             </section>
             <section>
                <div className="flex justify-between items-center mb-4"><h4 className="text-[10px] font-black text-slate-950 uppercase tracking-widest">{t('doeAssistant.configModal.responses.title')}</h4><button onClick={() => setResponses([...responses, { name: '', unit: '', goal: 'maximize', weight: 1 }])} className="text-[9px] font-black text-indigo-600">{t('doeAssistant.configModal.responses.add')}</button></div>
                <div className="grid grid-cols-4 gap-2 px-3 mb-2 text-[8px] font-black text-slate-400 uppercase tracking-widest"><span>{t('doeAssistant.configModal.responses.colName')}</span><span>{t('doeAssistant.configModal.responses.colUnit')}</span><span>{t('doeAssistant.configModal.responses.colStrategy')}</span><span>{t('doeAssistant.configModal.responses.colWeight')}</span></div>
                {responses.map((r, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 mb-2 p-3 bg-slate-50 rounded-xl border border-slate-100 relative group transition-all hover:bg-white hover:shadow-md hover:border-emerald-100">
                    <input className="bg-white rounded-xl p-2 text-[10px] font-bold outline-none shadow-sm focus:ring-1 focus:ring-emerald-200" placeholder={t('doeAssistant.configModal.responses.placeholderName')} value={r.name} onChange={e => {const n=[...responses]; n[i].name=e.target.value; setResponses(n);}} />
                    <input className="bg-white rounded-xl p-2 text-[10px] font-bold outline-none shadow-sm focus:ring-1 focus:ring-emerald-200" placeholder={t('doeAssistant.configModal.responses.placeholderUnit')} value={r.unit} onChange={e => {const n=[...responses]; n[i].unit=e.target.value; setResponses(n);}} />
                    <select className="bg-white rounded-xl p-2 text-[10px] font-bold outline-none shadow-sm cursor-pointer" value={r.goal} onChange={e => {const n=[...responses]; n[i].goal=e.target.value as any; setResponses(n);}}>
                       <option value="maximize">{t('doeAssistant.configModal.responses.goals.maximize')}</option>
                       <option value="minimize">{t('doeAssistant.configModal.responses.goals.minimize')}</option>
                       <option value="target">{t('doeAssistant.configModal.responses.goals.target')}</option>
                    </select>
                    <input type="number" className="bg-white rounded-xl p-2 text-[10px] font-bold outline-none shadow-sm focus:ring-1 focus:ring-emerald-200" placeholder={t('doeAssistant.configModal.responses.placeholderWeight')} value={r.weight} onChange={e => {const n=[...responses]; n[i].weight=parseFloat(e.target.value); setResponses(n);}} />
                    <button onClick={() => setResponses(responses.filter((_, idx)=>idx!==i))} className="absolute -right-2 -top-2 w-6 h-6 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-md flex items-center justify-center active:scale-90"><i className="fa-solid fa-times text-[10px]"></i></button>
                  </div>
                ))}
             </section>
             
             {/* Template List Mini-View */}
             {customTemplates.length > 0 && (
                 <section className="pt-6 border-t border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <i className="fa-solid fa-box-archive"></i> {t('doeAssistant.configModal.templates.archived')}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                        {customTemplates.map(tpl => (
                            <div key={tpl.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100 group hover:border-indigo-200 hover:bg-white transition-all">
                                <span className="text-[10px] font-bold text-slate-600 truncate flex-1 pr-2">{tpl.title}</span>
                                <button onClick={() => deleteTemplate(tpl.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-1">
                                    <i className="fa-solid fa-trash-can text-[10px]"></i>
                                </button>
                            </div>
                        ))}
                    </div>
                 </section>
             )}
           </div>
        </div>
        <div className="mt-8 flex gap-4 shrink-0">
           <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl text-[11px] font-black uppercase hover:bg-slate-200 transition-all active:scale-95">{t('doeAssistant.configModal.templates.cancel')}</button>
           <button onClick={onClose} className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase shadow-xl hover:bg-black transition-all active:scale-95">{t('doeAssistant.configModal.templates.confirmApply')}</button>
        </div>
      </div>

      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1400] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-xl p-10 animate-reveal shadow-2xl border-4 border-white text-center">
             <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center mx-auto mb-6 text-2xl shadow-inner">
                <i className="fa-solid fa-floppy-disk"></i>
             </div>
             <h3 className="text-xl font-black text-slate-800 mb-6 uppercase italic tracking-tighter">{t('doeAssistant.configModal.templates.saveTitle')}</h3>
             <input autoFocus className="w-full bg-slate-50 border-none rounded-xl p-5 text-sm font-bold outline-none shadow-inner mb-8 text-center" placeholder={t('doeAssistant.configModal.templates.namePlaceholder')} value={newTemplateTitle} onChange={e => setNewTemplateTitle(e.target.value)} />
             <div className="flex gap-4">
                <button onClick={() => setShowSaveTemplateModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl text-[11px] font-black uppercase hover:bg-slate-200 transition-all active:scale-95">{t('doeAssistant.configModal.templates.cancel')}</button>
                <button onClick={handleSaveAsTemplate} disabled={!newTemplateTitle.trim()} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl text-[11px] font-black uppercase shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-50">{t('doeAssistant.configModal.templates.confirmSave')}</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DOEConfigModal;
