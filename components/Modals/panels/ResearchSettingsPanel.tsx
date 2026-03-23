import React from 'react';
import { useTranslation } from '../../../locales/useTranslation';
import type { SettingsState } from '../useSettingsState';

interface Props {
  research: SettingsState['research'];
  context: SettingsState['context'];
}

const ResearchSettingsPanel: React.FC<Props> = ({ research, context }) => {
  const { t } = useTranslation();
  const { appSettings, setAppSettings } = context;
  const {
    aiPolishIntensity, setAiPolishIntensity,
    defaultWritingLanguage, setDefaultWritingLanguage, paragraphIndent, setParagraphIndent,
    defaultXrdRadiation, setDefaultXrdRadiation, defaultXpsReference, setDefaultXpsReference,
    defaultSemVoltage, setDefaultSemVoltage, defaultTemVoltage, setDefaultTemVoltage,
    defaultLiteratureSort, setDefaultLiteratureSort, defaultExperimentTemplate, setDefaultExperimentTemplate,
    spellCheck, setSpellCheck,
  } = research;

  return (<>
    {/* Scientific Standards */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-medal text-amber-500"></i> {t('settings.research.scientificStandards')} (SCIENTIFIC STANDARDS)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.research.defaultCitation')}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">Global Citation Style</p>
          </div>
          <div className="relative group min-w-[160px]">
            <select className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm" value={appSettings.defaultCitationStyle || 'Nature'} onChange={(e) => setAppSettings({ defaultCitationStyle: e.target.value as any })}>
              <option value="Nature">Nature (Superscript)</option>
              <option value="Science">Science (Numbered)</option>
              <option value="IEEE">IEEE (Bracketed)</option>
              <option value="APA">APA (Author-Date)</option>
              <option value="JACS">JACS (Journal of Am. Chem. Soc.)</option>
            </select>
            <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
          </div>
        </div>
        <div className="w-full h-px bg-slate-200"></div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.research.latexStyle')}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">Formula Font Family</p>
          </div>
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setAppSettings({ latexStyle: 'serif' })} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${appSettings.latexStyle === 'serif' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
              <span className="font-serif italic mr-1">f(x)</span> Serif
            </button>
            <button onClick={() => setAppSettings({ latexStyle: 'sans' })} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${appSettings.latexStyle === 'sans' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
              <span className="font-sans mr-1">f(x)</span> Sans
            </button>
          </div>
        </div>
      </div>
    </section>

    {/* Writing Preferences */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-pen-nib text-violet-500"></i> {t('settings.research.writingPreferences')} (WRITING PREFERENCES)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.research.polishIntensity')}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.research.polishIntensity')}</p>
          </div>
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            {(['light', 'moderate', 'deep'] as const).map(level => (
              <button key={level} onClick={() => setAiPolishIntensity(level)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${aiPolishIntensity === level ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                {level === 'light' ? t('settings.research.polishLight') : level === 'moderate' ? t('settings.research.polishModerate') : t('settings.research.polishDeep')}
              </button>
            ))}
          </div>
        </div>
        <div className="w-full h-px bg-slate-200"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.research.defaultWritingLang')}</label>
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
              <button onClick={() => setDefaultWritingLanguage('zh')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${defaultWritingLanguage === 'zh' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>中文</button>
              <button onClick={() => setDefaultWritingLanguage('en')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${defaultWritingLanguage === 'en' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>English</button>
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.research.paragraphIndent')}</label>
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
              <button onClick={() => setParagraphIndent('indent')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${paragraphIndent === 'indent' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>{t('settings.research.indentFirst')}</button>
              <button onClick={() => setParagraphIndent('no-indent')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${paragraphIndent === 'no-indent' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>{t('settings.research.noIndent')}</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* Experiment Defaults */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-flask-vial text-rose-500"></i> {t('settings.research.experimentDefaults')} (EXPERIMENT DEFAULTS)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.research.xrdRadiation')}</label>
            <div className="relative">
              <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm" value={defaultXrdRadiation} onChange={e => setDefaultXrdRadiation(e.target.value as any)}>
                <option value="Cu Kα">Cu Kα (λ=1.5406 Å)</option><option value="Mo Kα">Mo Kα (λ=0.7107 Å)</option><option value="Co Kα">Co Kα (λ=1.7889 Å)</option><option value="Ag Kα">Ag Kα (λ=0.5594 Å)</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.research.xpsReference')}</label>
            <input type="text" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 transition-colors shadow-sm" value={defaultXpsReference} onChange={e => setDefaultXpsReference(e.target.value)} placeholder="C 1s 284.8 eV" />
          </div>
        </div>
        <div className="w-full h-px bg-slate-200"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.research.semVoltage')} (kV)</label>
            <div className="relative">
              <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm" value={defaultSemVoltage} onChange={e => setDefaultSemVoltage(Number(e.target.value))}>
                <option value={1}>1 kV</option><option value={3}>3 kV</option><option value={5}>5 kV</option><option value={10}>10 kV</option><option value={15}>15 kV</option><option value={20}>20 kV</option><option value={30}>30 kV</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.research.temVoltage')} (kV)</label>
            <div className="relative">
              <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm" value={defaultTemVoltage} onChange={e => setDefaultTemVoltage(Number(e.target.value))}>
                <option value={80}>80 kV</option><option value={100}>100 kV</option><option value={120}>120 kV</option><option value={200}>200 kV</option><option value={300}>300 kV</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
          </div>
        </div>
        <p className="text-[7px] text-slate-400 mt-1 font-bold uppercase tracking-widest italic px-1">
          <i className="fa-solid fa-circle-info mr-1 text-rose-400"></i>
          {t('settings.research.experimentDefaultsHint')}
        </p>
      </div>
    </section>

    {/* Literature & Template */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-book-bookmark text-emerald-500"></i> {t('settings.research.literatureSort')} (WORKFLOW)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.research.literatureSort')}</label>
            <div className="relative">
              <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm" value={defaultLiteratureSort} onChange={e => setDefaultLiteratureSort(e.target.value as any)}>
                <option value="year">{t('settings.research.sortByYear')}</option><option value="author">{t('settings.research.sortByAuthor')}</option><option value="addedDate">{t('settings.research.sortByAdded')}</option><option value="citations">{t('settings.research.sortByCitations')}</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.research.experimentTemplate')}</label>
            <div className="relative">
              <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm" value={defaultExperimentTemplate} onChange={e => setDefaultExperimentTemplate(e.target.value as any)}>
                <option value="blank">{t('settings.research.templateBlank')}</option><option value="electrochemistry">{t('settings.research.templateElectrochemistry')}</option><option value="catalysis">{t('settings.research.templateCatalysis')}</option><option value="synthesis">{t('settings.research.templateSynthesis')}</option><option value="characterization">{t('settings.research.templateCharacterization')}</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
          </div>
        </div>
        <div className="w-full h-px bg-slate-200"></div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.research.spellCheck')}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.research.spellCheckDesc')}</p>
          </div>
          <button onClick={() => setSpellCheck(!spellCheck)} className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${spellCheck ? 'bg-indigo-600' : 'bg-slate-200'}`}>
            <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${spellCheck ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
    </section>
  </>);
};

export default ResearchSettingsPanel;
