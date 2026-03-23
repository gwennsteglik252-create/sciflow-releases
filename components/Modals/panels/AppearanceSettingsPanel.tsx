import React from 'react';
import { useTranslation } from '../../../locales/useTranslation';
import type { SettingsState } from '../useSettingsState';

interface Props {
  appearance: SettingsState['appearance'];
  context: SettingsState['context'];
}

const AppearanceSettingsPanel: React.FC<Props> = ({ appearance, context }) => {
  const { t } = useTranslation();
  const { appSettings, setAppSettings } = context;
  const { themeMode, setThemeMode, uiScale, setUiScale, editorFontSize, setEditorFontSize,
    uiLanguage, setUiLanguage, dateFormat, setDateFormat,
    aiOutputLanguage, setAiOutputLanguage, soundFeedback, setSoundFeedback } = appearance;

  return (<>
    {/* Appearance & Theme */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-palette text-pink-500"></i> {t('settings.appearance.title')} (APPEARANCE)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.appearance.themeMode')}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.appearance.themeMode')}</p>
          </div>
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            {(['light', 'dark', 'system'] as const).map(mode => (
              <button key={mode} onClick={() => setThemeMode(mode)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${themeMode === mode ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                {mode === 'light' ? t('settings.appearance.light') : mode === 'dark' ? t('settings.appearance.dark') : t('settings.appearance.system')}
              </button>
            ))}
          </div>
        </div>
        <div className="w-full h-px bg-slate-200"></div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.appearance.uiScale')}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.appearance.uiScale')}: {uiScale}%</p>
          </div>
          <div className="flex items-center gap-3 min-w-[200px]">
            <span className="text-[9px] font-bold text-slate-400">80%</span>
            <input type="range" min={80} max={120} step={10} value={uiScale} onChange={e => setUiScale(Number(e.target.value) as any)} className="flex-1 accent-indigo-600 h-1.5 cursor-pointer" />
            <span className="text-[9px] font-bold text-slate-400">120%</span>
          </div>
        </div>
        <div className="w-full h-px bg-slate-200"></div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.appearance.editorFontSize')}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.appearance.editorFontSize')}: {editorFontSize}px</p>
          </div>
          <div className="flex items-center gap-3 min-w-[200px]">
            <span className="text-[9px] font-bold text-slate-400">12</span>
            <input type="range" min={12} max={24} step={1} value={editorFontSize} onChange={e => setEditorFontSize(Number(e.target.value))} className="flex-1 accent-indigo-600 h-1.5 cursor-pointer" />
            <span className="text-[9px] font-bold text-slate-400">24</span>
          </div>
        </div>
      </div>
    </section>

    {/* Navigation Module Visibility */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-bars-staggered text-indigo-500"></i> {t('settings.appearance.navModuleVisibility')} (NAV MODULES)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] text-slate-400 font-bold">{t('settings.appearance.navModuleVisibilityDesc')}</p>
          <div className="flex gap-2">
            <button onClick={() => setAppSettings({ hiddenNavModules: [] })} className="px-3 py-1 rounded-lg text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-all">
              {t('settings.appearance.navModuleShowAll')}
            </button>
            <button
              onClick={() => {
                const allIds = ['inception', 'industry_trends', 'market_analysis', 'projects', 'team', 'notebook', 'research_brain', 'literature', 'mechanism', 'characterization_hub', 'inventory', 'doe', 'flowchart', 'data', 'process_lab', 'figure_center', 'video_lab', 'writing'];
                setAppSettings({ hiddenNavModules: allIds });
              }}
              className="px-3 py-1 rounded-lg text-[9px] font-black uppercase bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-all"
            >
              {t('settings.appearance.navModuleHideAll')}
            </button>
            {appSettings.navModuleOrder && appSettings.navModuleOrder.length > 0 && (
              <button onClick={() => setAppSettings({ navModuleOrder: undefined as any })} className="px-3 py-1 rounded-lg text-[9px] font-black uppercase bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-all">
                <i className="fa-solid fa-arrow-rotate-left mr-1 text-[8px]"></i>
                {t('settings.appearance.navModuleResetOrder')}
              </button>
            )}
          </div>
        </div>

        {/* Module groups — drag-to-reorder */}
        {(() => {
          const hidden = appSettings.hiddenNavModules || [];
          const toggleModule = (id: string) => {
            const next = hidden.includes(id) ? hidden.filter(m => m !== id) : [...hidden, id];
            setAppSettings({ hiddenNavModules: next });
          };

          const allModules = [
            { group: null, items: [
              { id: 'inception', icon: 'fa-compass', color: 'text-emerald-400' },
              { id: 'industry_trends', icon: 'fa-tower-broadcast', color: 'text-rose-400' },
              { id: 'market_analysis', icon: 'fa-chart-pie', color: 'text-teal-400' },
            ]},
            { group: 1, items: [
              { id: 'dashboard', icon: 'fa-house-chimney', color: 'text-blue-400', required: true },
              { id: 'projects', icon: 'fa-vials', color: 'text-indigo-400' },
              { id: 'team', icon: 'fa-id-card-clip', color: 'text-emerald-400' },
              { id: 'notebook', icon: 'fa-book-open', color: 'text-amber-400' },
            ]},
            { group: 2, items: [
              { id: 'research_brain', icon: 'fa-brain', color: 'text-purple-400' },
              { id: 'literature', icon: 'fa-book-atlas', color: 'text-emerald-400' },
              { id: 'mechanism', icon: 'fa-atom', color: 'text-amber-400' },
              { id: 'characterization_hub', icon: 'fa-microscope', color: 'text-rose-400' },
            ]},
            { group: 3, items: [
              { id: 'inventory', icon: 'fa-box-archive', color: 'text-emerald-500' },
              { id: 'doe', icon: 'fa-puzzle-piece', color: 'text-amber-400' },
              { id: 'flowchart', icon: 'fa-bezier-curve', color: 'text-cyan-400' },
              { id: 'data', icon: 'fa-chart-line', color: 'text-violet-400' },
              { id: 'process_lab', icon: 'fa-industry', color: 'text-amber-500' },
            ]},
            { group: 4, items: [
              { id: 'figure_center', icon: 'fa-palette', color: 'text-orange-400' },
              { id: 'video_lab', icon: 'fa-film', color: 'text-rose-400' },
              { id: 'writing', icon: 'fa-pen-nib', color: 'text-rose-400' },
            ]},
          ];

          const itemLookup: Record<string, { icon: string; color: string; required?: boolean }> = {};
          allModules.forEach(s => s.items.forEach(it => { itemLookup[it.id] = it; }));

          const defaultOrder = allModules.flatMap((s, si) => [
            ...(si > 0 ? ['__sep__' + si] : []),
            ...s.items.map(it => it.id),
          ]);
          const currentOrder = (() => {
            if (appSettings.navModuleOrder && appSettings.navModuleOrder.length > 0) {
              const savedIds = new Set(appSettings.navModuleOrder.filter(e => !e.startsWith('__sep__')));
              const allDefIds = defaultOrder.filter(e => !e.startsWith('__sep__'));
              const missing = allDefIds.filter(id => !savedIds.has(id));
              return missing.length > 0 ? [...appSettings.navModuleOrder, ...missing] : appSettings.navModuleOrder;
            }
            return defaultOrder;
          })();

          const sidebarLabels: Record<string, string> = {
            inception: t('sidebar.inception'), industry_trends: t('sidebar.industryTrends'),
            market_analysis: t('sidebar.marketAnalysis'), dashboard: t('sidebar.dashboard'),
            projects: t('sidebar.projects'), team: t('sidebar.team'), notebook: t('sidebar.notebook'),
            research_brain: t('sidebar.researchBrain'), literature: t('sidebar.literature'),
            mechanism: t('sidebar.mechanism'), characterization_hub: t('sidebar.characterizationHub'),
            inventory: t('sidebar.inventory'), doe: t('sidebar.doe'), flowchart: t('sidebar.flowchart'),
            data: t('sidebar.data'), process_lab: t('sidebar.processLab'),
            figure_center: t('sidebar.figureCenter'), video_lab: t('sidebar.videoLab'),
            writing: t('sidebar.writing'),
          };

          return currentOrder.map((entry, idx) => {
            if (entry.startsWith('__sep__')) {
              return <div key={entry} className="h-px bg-slate-200 my-1" />;
            }
            const item = itemLookup[entry];
            if (!item) return null;
            const isRequired = !!(item as any).required;
            const isVisible = isRequired || !hidden.includes(entry);

            return (
              <div
                key={entry}
                draggable
                onDragStart={e => { e.dataTransfer.setData('text/plain', String(idx)); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const fromIdx = Number(e.dataTransfer.getData('text/plain'));
                  if (fromIdx === idx || isNaN(fromIdx)) return;
                  const arr = [...currentOrder];
                  const [moved] = arr.splice(fromIdx, 1);
                  arr.splice(idx, 0, moved);
                  setAppSettings({ navModuleOrder: arr } as any);
                }}
                className={`flex items-center justify-between py-2 px-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${isVisible ? 'bg-white border-slate-100 hover:border-indigo-200' : 'bg-slate-100 border-slate-100 opacity-50'}`}
              >
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-grip-vertical text-[10px] text-slate-300 hover:text-slate-500 transition-colors cursor-grab"></i>
                  <i className={`fa-solid ${item.icon} text-sm w-5 text-center ${item.color}`}></i>
                  <span className="text-[11px] font-black text-slate-700 uppercase">{sidebarLabels[entry] || entry}</span>
                  {isRequired && (
                    <span className="text-[7px] font-black bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full uppercase">{t('settings.appearance.navModuleRequired')}</span>
                  )}
                </div>
                <button
                  onClick={() => !isRequired && toggleModule(entry)}
                  disabled={isRequired}
                  className={`w-10 h-6 rounded-full p-0.5 transition-all duration-300 ${isRequired ? 'bg-indigo-400 opacity-60 cursor-not-allowed' : isVisible ? 'bg-indigo-600' : 'bg-slate-200'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${isVisible ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            );
          });
        })()}
      </div>
    </section>

    {/* Language & Locale */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-globe text-sky-500"></i> {t('settings.appearance.languageLocale')} (LANGUAGE & LOCALE)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.appearance.uiLanguage')}</label>
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
              <button onClick={() => setUiLanguage('zh')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${uiLanguage === 'zh' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>中文</button>
              <button onClick={() => setUiLanguage('en')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${uiLanguage === 'en' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>English</button>
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.appearance.dateFormat')}</label>
            <div className="relative">
              <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm" value={dateFormat} onChange={e => setDateFormat(e.target.value as any)}>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option><option value="MM/DD/YYYY">MM/DD/YYYY (US)</option><option value="DD/MM/YYYY">DD/MM/YYYY (EU)</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
          </div>
        </div>
        <div className="w-full h-px bg-slate-200"></div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.appearance.aiOutputLanguage')}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.appearance.aiOutputLanguage')}</p>
          </div>
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            {(['auto', 'zh', 'en'] as const).map(lang => (
              <button key={lang} onClick={() => setAiOutputLanguage(lang)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${aiOutputLanguage === lang ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                {lang === 'auto' ? t('settings.appearance.autoLanguage') : lang === 'zh' ? '中文' : 'EN'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* Sound Feedback */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-volume-high text-amber-500"></i> {t('settings.appearance.soundFeedback')} (SOUND)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.appearance.soundFeedback')}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.appearance.soundFeedbackDesc')}</p>
          </div>
          <button onClick={() => setSoundFeedback(!soundFeedback)} className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${soundFeedback ? 'bg-indigo-600' : 'bg-slate-200'}`}>
            <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${soundFeedback ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
    </section>
  </>);
};

export default AppearanceSettingsPanel;
