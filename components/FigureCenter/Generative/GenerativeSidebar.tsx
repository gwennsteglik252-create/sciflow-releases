import React, { RefObject, useRef } from 'react';
import { useGenerativeDesigner } from '../../../hooks/useGenerativeDesigner';
import { useTranslation } from '../../../locales/useTranslation';

interface GenerativeSidebarProps {
  logic: ReturnType<typeof useGenerativeDesigner>;
  inputRef: RefObject<HTMLDivElement>;
}

export const GenerativeSidebar: React.FC<GenerativeSidebarProps> = ({ logic, inputRef }) => {
  const { t } = useTranslation();
  const {
    figureStyle, setFigureStyle, isGenerating, aspectRatio, setAspectRatio,
    chemContext, setChemContext, bioContext, setBioContext, mechContext, setMechContext, styleContext, setStyleContext,
    userPrompt, setUserPrompt, handleGenerate, handleEnhancePrompt, isEnhancing, results,
    baseImage, regions, activeRegionId, updateRegionInstruction, setActiveRegionId, deleteRegion,
    handleExitIteration, handleUploadBaseImage,
    aiLanguage, setAiLanguage
  } = logic;

  const [isStyleCollapsed, setIsStyleCollapsed] = React.useState(true);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadBaseImage(file);
    }
    // Reset to allow re-uploading same file
    if (uploadInputRef.current) uploadInputRef.current.value = '';
  };

  return (
    <aside className="col-span-12 lg:col-span-4 xl:col-span-3 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1 min-h-0">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-6">

        {/* --- Section 1: Settings --- */}
        <section className="space-y-4">
          <div className="flex justify-between items-end mb-2">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <i className="fa-solid fa-palette text-orange-500"></i> {t('figureCenter.generative.visualConfig')}
            </h4>
            <span className="text-[7px] font-bold text-slate-300 uppercase tracking-tighter bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">Preserving Academic Integrity</span>
          </div>

          <div className="space-y-4">
            <div>
              <div
                className="flex items-center justify-between mb-2 px-1 cursor-pointer group/header select-none"
                onClick={() => setIsStyleCollapsed(!isStyleCollapsed)}
              >
                <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider group-hover/header:text-slate-600 transition-colors">{t('figureCenter.generative.globalStyle')}</label>
                <div className={`w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center transition-transform duration-300 ${isStyleCollapsed ? '' : 'rotate-180'}`}>
                  <i className="fa-solid fa-chevron-down text-[6px] text-slate-400"></i>
                </div>
              </div>

              {!isStyleCollapsed && (
                <div className="grid grid-cols-1 gap-2 animate-reveal-fast">
                  {[
                    {
                      id: '极简学术示意图 (Scheme)',
                      name: t('figureCenter.generative.styleScheme'),
                      detail: 'Minimalist Scheme',
                      icon: 'fa-project-diagram',
                      color: 'from-blue-500 to-indigo-500',
                      desc: t('figureCenter.generative.styleSchemeDesc')
                    },
                    {
                      id: '扁平化工业流程图 (Flowchart)',
                      name: t('figureCenter.generative.styleFlowchart'),
                      detail: 'Technical Flowchart',
                      icon: 'fa-microchip',
                      color: 'from-emerald-500 to-teal-600',
                      desc: t('figureCenter.generative.styleFlowchartDesc')
                    },
                    {
                      id: '顶级期刊 3D 机理图 (High-End 3D Abstract)',
                      name: t('figureCenter.generative.style3d'),
                      detail: 'High-End 3D Abstract',
                      icon: 'fa-cube',
                      color: 'from-indigo-600 to-violet-700',
                      desc: t('figureCenter.generative.style3dDesc')
                    }
                  ].map(style => (
                    <button
                      key={style.id}
                      onClick={() => setFigureStyle(style.id as any)}
                      disabled={isGenerating}
                      className={`group relative flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left overflow-hidden ${figureStyle === style.id
                        ? 'bg-white border-slate-900 shadow-xl scale-[1.02] z-10'
                        : 'bg-slate-50 border-transparent hover:border-slate-200 hover:bg-white'
                        }`}
                    >
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${style.color} flex items-center justify-center text-white shadow-lg shrink-0 transition-transform group-hover:scale-110`}>
                        <i className={`fa-solid ${style.icon} text-sm`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[10px] font-black uppercase tracking-tight truncate ${figureStyle === style.id ? 'text-slate-900' : 'text-slate-600'}`}>{style.name}</p>
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest truncate">{style.detail}</p>
                      </div>
                      {figureStyle === style.id && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-900">
                          <i className="fa-solid fa-circle-check text-xs"></i>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {isStyleCollapsed && (
                <div
                  className="p-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex items-center gap-3 cursor-pointer hover:bg-slate-100/50 transition-colors"
                  onClick={() => setIsStyleCollapsed(false)}
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${figureStyle === '极简学术示意图 (Scheme)' ? 'from-blue-500 to-indigo-500' :
                    figureStyle === '扁平化工业流程图 (Flowchart)' ? 'from-emerald-500 to-teal-600' :
                      'from-indigo-600 to-violet-700'
                    } flex items-center justify-center text-white shadow-sm shrink-0`}>
                    <i className={`fa-solid ${figureStyle === '极简学术示意图 (Scheme)' ? 'fa-project-diagram' :
                      figureStyle === '扁平化工业流程图 (Flowchart)' ? 'fa-microchip' :
                        'fa-cube'
                      } text-xs`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black text-slate-600 uppercase tracking-tight truncate">
                      {figureStyle.split(' ')[0]}
                    </p>
                    <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">{t('figureCenter.generative.selectedStyle')}</p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[8px] font-black text-slate-400 uppercase mb-2 px-1">{t('figureCenter.generative.aspectRatio')}</label>
              <div className="flex flex-wrap gap-1.5 p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
                {(['1:1', '4:3', '3:4', '16:9', '9:16'] as const).map(ratio => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    disabled={isGenerating}
                    className={`flex-1 py-1.5 rounded-xl text-[8px] font-black transition-all border ${aspectRatio === ratio
                      ? 'bg-white text-indigo-600 border-white shadow-md'
                      : 'text-slate-400 border-transparent hover:text-slate-600'
                      } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* --- Section 2: Generation Inputs --- */}
        <section ref={inputRef} className={`space-y-4 ${baseImage ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="flex justify-between items-center mb-1 px-1">
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <i className="fa-solid fa-wand-magic-sparkles text-rose-500"></i> {t('figureCenter.generative.modeling')}
            </h4>
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setAiLanguage('zh')}
                className={`px-3 py-1 rounded-lg text-[7px] font-black uppercase transition-all ${aiLanguage === 'zh' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                ZH
              </button>
              <button
                onClick={() => setAiLanguage('en')}
                className={`px-3 py-1 rounded-lg text-[7px] font-black uppercase transition-all ${aiLanguage === 'en' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                EN
              </button>
            </div>
          </div>

          <div className="space-y-2.5 animate-reveal">
            {[
              { label: t('figureCenter.generative.labelSubject'), val: chemContext, set: setChemContext, color: 'indigo', icon: 'fa-vial', placeholder: 'e.g. Pt nanoparticles with core-shell structure...' },
              { label: t('figureCenter.generative.labelContext'), val: bioContext, set: setBioContext, color: 'emerald', icon: 'fa-leaf', placeholder: 'e.g. In-vivo tumor cell targeting...' },
              { label: t('figureCenter.generative.labelMechanism'), val: mechContext, set: setMechContext, color: 'amber', icon: 'fa-route', placeholder: 'e.g. Charge transfer process via ligand...' },
              { label: t('figureCenter.generative.labelVisual'), val: styleContext, set: setStyleContext, color: 'violet', icon: 'fa-eye', placeholder: 'e.g. Volumetric lighting, macro focus...' },
              { label: t('figureCenter.generative.labelAdditional'), val: userPrompt, set: setUserPrompt, color: 'rose', icon: 'fa-plus', placeholder: 'e.g. Blue gradient background, 4K render...' },
            ].map((item, i) => (
              <div key={i} className="group">
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <div className={`w-3 h-3 rounded-full bg-${item.color}-50 flex items-center justify-center`}>
                    <i className={`fa-solid ${item.icon} text-[6px] text-${item.color}-500`}></i>
                  </div>
                  <label className="text-[7px] font-black text-slate-400 uppercase tracking-wider">{item.label}</label>
                </div>
                <textarea
                  className={`w-full h-12 bg-slate-50 border-2 border-transparent rounded-xl p-3 text-[10px] font-medium text-slate-700 outline-none shadow-inner resize-none leading-relaxed transition-all focus:bg-white focus:border-${item.color}-100 focus:ring-4 focus:ring-${item.color}-50/50 placeholder:text-slate-300`}
                  placeholder={item.placeholder}
                  value={item.val}
                  onChange={e => item.set(e.target.value)}
                  disabled={!!baseImage}
                />
              </div>
            ))}
          </div>
        </section>

        {/* --- AI 智能增强按钮 --- */}
        {!baseImage && (
          <button
            onClick={handleEnhancePrompt}
            disabled={isEnhancing || isGenerating}
            className={`w-full py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 border-2 ${isEnhancing
              ? 'bg-amber-50 border-amber-200 text-amber-600'
              : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-100 text-amber-700 hover:border-amber-300 hover:shadow-lg hover:shadow-amber-100/50 hover:-translate-y-0.5'
              }`}
          >
            {isEnhancing ? (
              <i className="fa-solid fa-spinner animate-spin text-sm"></i>
            ) : (
              <i className="fa-solid fa-wand-magic-sparkles text-sm"></i>
            )}
            {isEnhancing ? t('figureCenter.generative.enhancing') : t('figureCenter.generative.enhance')}
          </button>
        )}

        {/* --- Section 3: Iteration / Action --- */}
        {baseImage ? (
          <div className="mt-4 pt-6 border-t-2 border-dashed border-indigo-100 animate-reveal">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-pen-to-square"></i> {t('figureCenter.generative.iteration')}
              </h4>
              <button
                onClick={handleExitIteration}
                className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-sm"
                title={t('figureCenter.generative.cancelIteration')}
              >
                <i className="fa-solid fa-times text-[9px]"></i>
              </button>
            </div>

            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 mb-4">
              <p className="text-[9px] font-bold text-amber-700 uppercase mb-2">{t('figureCenter.generative.regionConfig')}</p>
              {regions.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                  {regions.map((r, i) => (
                    <div key={r.id} className={`p-2 bg-white rounded-lg border transition-all ${activeRegionId === r.id ? 'border-indigo-400 ring-1 ring-indigo-200' : 'border-amber-100'}`} onClick={() => setActiveRegionId(r.id)}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase">Region #{i + 1}</span>
                        <button onClick={(e) => { e.stopPropagation(); deleteRegion(r.id); }} className="text-rose-400 hover:text-rose-600"><i className="fa-solid fa-trash-can text-[9px]"></i></button>
                      </div>
                      <textarea
                        className="w-full bg-slate-50 border-none rounded-lg p-2 text-[10px] font-medium outline-none resize-none focus:bg-white transition-colors"
                        rows={2}
                        placeholder={t('figureCenter.generative.regionPlaceholder').replace('{n}', String(i + 1))}
                        value={r.instruction}
                        onChange={(e) => updateRegionInstruction(r.id, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-amber-400 italic text-[9px]">
                  <i className="fa-solid fa-vector-square text-lg mb-1 block"></i>
                  {t('figureCenter.generative.drawRegionHint')}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[8px] font-black text-slate-400 uppercase mb-1 block px-1">{t('figureCenter.generative.globalAdjust')}</label>
                <textarea
                  className="w-full h-16 bg-slate-50 border-none rounded-xl p-3 text-[10px] font-medium text-slate-700 outline-none shadow-inner resize-none focus:ring-2 focus:ring-indigo-100"
                  placeholder={t('figureCenter.generative.globalAdjustPlaceholder')}
                  value={userPrompt}
                  onChange={e => setUserPrompt(e.target.value)}
                />
              </div>
              <button
                onClick={() => handleGenerate('iterate')}
                disabled={isGenerating}
                className="w-full py-3 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-amber-600 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGenerating ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic"></i>}
                {regions.length > 0 ? t('figureCenter.generative.executeRegions').replace('{n}', String(regions.length)) : t('figureCenter.generative.executeGlobal')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={() => handleGenerate('create')}
              disabled={isGenerating}
              className={`w-full py-4 mt-6 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 ${results.length > 0
                ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white hover:shadow-2xl hover:-translate-y-0.5'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:shadow-indigo-200/50 hover:shadow-2xl hover:-translate-y-0.5'
                }`}
            >
              {isGenerating ? (
                <i className="fa-solid fa-spinner animate-spin text-sm"></i>
              ) : (
                <i className={`fa-solid ${results.length > 0 ? 'fa-arrows-rotate' : 'fa-bolt-lightning'} text-sm`}></i>
              )}
              {isGenerating ? t('figureCenter.generative.generating') : (results.length > 0 ? t('figureCenter.generative.regenerate') : t('figureCenter.generative.startGenerate'))}
            </button>

            {/* --- Section 4: External Upload (New Feature) --- */}
            <section className="pt-6 mt-2 border-t-2 border-dashed border-slate-100 animate-reveal">
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
                <i className="fa-solid fa-cloud-arrow-up text-indigo-500"></i> {t('figureCenter.generative.uploadSection')}
              </h4>
              <div
                onClick={() => uploadInputRef.current?.click()}
                className="group border-2 border-dashed border-slate-200 rounded-xl p-5 bg-slate-50/50 hover:bg-white hover:border-indigo-400 hover:shadow-xl transition-all cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                  <i className="fa-solid fa-image text-xl"></i>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-black text-slate-700 uppercase tracking-tight">{t('figureCenter.generative.uploadHint')}</p>
                  <p className="text-[7px] font-bold text-slate-400 uppercase mt-0.5 tracking-tighter">Support Image-to-Image / Local File</p>
                </div>
                <input
                  type="file"
                  ref={uploadInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>
            </section>
          </>
        )}
      </div>
    </aside>
  );
};