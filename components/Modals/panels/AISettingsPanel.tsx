import React from 'react';
import { useTranslation } from '../../../locales/useTranslation';
import ProviderConfigCard from '../ProviderConfigCard';
import { PROVIDER_REGISTRY } from '../../../config/aiProviders';
import type { SettingsState } from '../useSettingsState';

interface Props {
  ai: SettingsState['ai'];
  providers: SettingsState['providers'];
  context: SettingsState['context'];
}

const AISettingsPanel: React.FC<Props> = ({ ai, providers, context }) => {
  const { t } = useTranslation();
  const { appSettings, setAppSettings } = context;
  const { activeProvider, setActiveProvider, routingPreference, setRoutingPreference,
    imageModelName, setImageModelName,
    aiTemperature, setAiTemperature, aiMaxTokens, setAiMaxTokens, aiContextLength, setAiContextLength,
    aiStreamOutput, setAiStreamOutput, aiDefaultPersona, setAiDefaultPersona, debateRounds, setDebateRounds,
    aiSpeedMode, setAiSpeedMode,
  } = ai;
  const { providerConfigs, updateProviderConfig, dynamicModels, isRefreshing,
    apiKeyCache, handleApiKeyCacheUpdate, handleSelectApiKey, handleRefreshModelsForProvider,
  } = providers;

  return (<>
    {/* ── 多模型混合引擎 (Hybrid AI Engine) ── */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-microchip text-violet-500"></i> {t('settings.ai.hybridEngine')} (HYBRID AI ENGINE)
      </h4>
      <div className="bg-violet-50/50 p-5 rounded-[2rem] border border-violet-100 space-y-4">
        {/* ── 引擎选择栏 ── */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <p className="text-[11px] font-black text-slate-800 uppercase">{t('settings.ai.preferredEngine')}</p>
            {activeProvider === 'auto' && (
              <span className="text-[8px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full animate-pulse">{t('settings.ai.routingActive')}</span>
            )}
          </div>
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar">
            {(['auto', 'gemini', 'openai', 'doubao', 'anthropic'] as const).map(provider => (
              <button
                key={provider}
                onClick={() => setActiveProvider(provider)}
                className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeProvider === provider ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {provider === 'auto' ? t('settings.ai.smartRouting') : provider === 'gemini' ? 'Gemini' : provider === 'openai' ? 'OpenAI' : provider === 'doubao' ? 'Doubao' : 'Anthropic'}
              </button>
            ))}
          </div>
        </div>

        {/* ── 智能路由策略面板 ── */}
        {activeProvider === 'auto' && (
          <div className="animate-reveal space-y-4 bg-indigo-900 text-white p-6 rounded-2xl border border-indigo-400 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><i className="fa-solid fa-compass text-6xl"></i></div>
            <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-2">{t('settings.ai.orchestration')} (ORCHESTRATION)</h5>
            <p className="text-[11px] font-medium leading-relaxed italic opacity-90">{t('settings.ai.orchestrationDesc')}</p>
            <div className="pt-4 border-t border-white/10 mt-2">
              <p className="text-[9px] font-black uppercase mb-3">{t('settings.ai.routingPreference')}</p>
              <div className="flex bg-white/10 p-1 rounded-xl">
                <button onClick={() => setRoutingPreference('cost')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${routingPreference === 'cost' ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 opacity-60'}`}>{t('settings.ai.costFirst')}</button>
                <button onClick={() => setRoutingPreference('quality')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${routingPreference === 'quality' ? 'bg-white text-indigo-900 shadow-md' : 'text-indigo-200 opacity-60'}`}>{t('settings.ai.qualityFirst')}</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Provider 配置卡片 (Accordion) ── */}
        <div className="space-y-2">
          {PROVIDER_REGISTRY
            .filter(p => activeProvider === 'auto' || activeProvider === p.id)
            .map(providerDef => (
              <ProviderConfigCard
                key={providerDef.id}
                provider={providerDef}
                config={providerConfigs[providerDef.id]}
                onConfigChange={(patch) => updateProviderConfig(providerDef.id, patch)}
                isActive={activeProvider === providerDef.id}
                isAutoMode={activeProvider === 'auto'}
                defaultExpanded={activeProvider !== 'auto'}
                dynamicModels={dynamicModels[providerConfigs[providerDef.id]?.baseUrl] || []}
                isRefreshing={isRefreshing[providerDef.id]}
                onRefreshModels={providerDef.supportsRefreshModels ? () => handleRefreshModelsForProvider(providerDef.id) : undefined}
                apiKeyCache={apiKeyCache}
                onApiKeyCacheUpdate={handleApiKeyCacheUpdate}
                isAiStudioAvailable={!!window.aistudio}
                onAiStudioSync={providerDef.isAiStudioSyncable ? handleSelectApiKey : undefined}
              />
            ))
          }
        </div>

        {/* ── 原生图像生成模型配置 ── */}
        <div className="mt-3 bg-gradient-to-r from-pink-50 to-violet-50 p-4 rounded-2xl border border-pink-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center shadow-sm">
              <i className="fa-solid fa-image text-white text-[10px]"></i>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-700 uppercase">画图专用模型 (IMAGE GENERATION)</p>
              <p className="text-[8px] text-slate-400 font-medium">带 imageConfig 的任务自动路由到此模型，不受上方文本模型影响</p>
            </div>
          </div>
          <input
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-violet-400 text-indigo-700 font-bold"
            value={imageModelName}
            onChange={e => setImageModelName(e.target.value)}
            placeholder="gemini-2.0-flash-preview-image-generation"
          />
          <p className="text-[7px] text-slate-400 mt-1.5 px-1">
            <i className="fa-solid fa-circle-info text-violet-400 mr-1"></i>
            常用选项：gemini-2.0-flash-preview-image-generation · gemini-2.0-flash-exp · imagen-3.0-generate-002
          </p>
        </div>
      </div>
    </section>

    {/* AI 配置面板 */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('settings.ai.automationStrategy')} (AUTOMATION)</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between hover:border-emerald-200 transition-all">
          <div className="min-w-0 pr-4">
            <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.ai.autoDiagnose')}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.ai.autoDiagnoseDesc')}</p>
          </div>
          <button
            onClick={() => setAppSettings({ aiAutoDiagnose: !appSettings.aiAutoDiagnose })}
            className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${appSettings.aiAutoDiagnose ? 'bg-indigo-600' : 'bg-slate-200'}`}
          >
            <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${appSettings.aiAutoDiagnose ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
        <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between hover:border-emerald-200 transition-all">
          <div className="min-w-0 pr-4">
            <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.ai.realtimePolish')}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.ai.realtimePolishDesc')}</p>
          </div>
          <button
            onClick={() => setAppSettings({ aiRealtimePolish: !appSettings.aiRealtimePolish })}
            className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${appSettings.aiRealtimePolish ? 'bg-indigo-600' : 'bg-slate-200'}`}
          >
            <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${appSettings.aiRealtimePolish ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
    </section>

    {/* AI Speed Mode */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-gauge-high text-amber-500"></i> {t('settings.ai.speedMode')} (SPEED MODE)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.ai.speedMode')}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.ai.speedModeDesc')}</p>
          </div>
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            {(['fast', 'balanced', 'quality'] as const).map(mode => (
              <button key={mode} onClick={() => setAiSpeedMode(mode)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap ${aiSpeedMode === mode ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                {mode === 'fast' ? `⚡ ${t('settings.ai.speedFast')}` : mode === 'balanced' ? `⚖️ ${t('settings.ai.speedBalanced')}` : `🎯 ${t('settings.ai.speedQuality')}`}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[7px] text-slate-400 mt-3 font-bold uppercase tracking-widest italic px-1">
          <i className="fa-solid fa-circle-info text-amber-400 mr-1"></i>
          {aiSpeedMode === 'fast' ? t('settings.ai.speedFastDesc') : aiSpeedMode === 'quality' ? t('settings.ai.speedQualityDesc') : t('settings.ai.speedBalancedDesc')}
        </p>
      </div>
    </section>

    {/* AI 参数微调 */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-sliders text-cyan-500"></i> {t('settings.ai.temperature')} (FINE-TUNING)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.ai.temperature')}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.ai.temperatureDesc')}: {aiTemperature.toFixed(1)}</p>
          </div>
          <div className="flex items-center gap-3 min-w-[200px]">
            <span className="text-[9px] font-bold text-blue-500">❄️ 0</span>
            <input type="range" min={0} max={2} step={0.1} value={aiTemperature} onChange={e => setAiTemperature(Number(e.target.value))} className="flex-1 accent-indigo-600 h-1.5 cursor-pointer" />
            <span className="text-[9px] font-bold text-orange-500">🔥 2</span>
          </div>
        </div>
        <div className="w-full h-px bg-slate-200"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.ai.maxTokens')}</label>
            <div className="relative">
              <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm" value={aiMaxTokens} onChange={e => setAiMaxTokens(Number(e.target.value))}>
                <option value={1024}>1024</option><option value={2048}>2048</option><option value={4096}>4096 (默认)</option><option value={8192}>8192</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
            <p className="text-[7px] text-slate-400 mt-1 px-1">{t('settings.ai.maxTokensDesc')}</p>
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.ai.contextLength')}</label>
            <div className="relative">
              <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm" value={aiContextLength} onChange={e => setAiContextLength(Number(e.target.value))}>
                <option value={3}>3 轮</option><option value={5}>5 轮</option><option value={10}>10 轮 (默认)</option><option value={20}>20 轮</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
            <p className="text-[7px] text-slate-400 mt-1 px-1">{t('settings.ai.contextLengthDesc')}</p>
          </div>
        </div>
      </div>
    </section>

    {/* AI Streaming / Persona / Debate */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-user-astronaut text-purple-500"></i> {t('settings.ai.defaultPersona')} (PERSONA & BEHAVIOR)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.ai.streamOutput')}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.ai.streamOutputDesc')}</p>
          </div>
          <button onClick={() => setAiStreamOutput(!aiStreamOutput)} className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${aiStreamOutput ? 'bg-indigo-600' : 'bg-slate-200'}`}>
            <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${aiStreamOutput ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
        <div className="w-full h-px bg-slate-200"></div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.ai.defaultPersona')}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.ai.defaultPersonaDesc')}</p>
          </div>
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            {(['rigorous', 'balanced', 'creative'] as const).map(p => (
              <button key={p} onClick={() => setAiDefaultPersona(p)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap ${aiDefaultPersona === p ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                {p === 'rigorous' ? t('settings.ai.personaRigorous') : p === 'creative' ? t('settings.ai.personaCreative') : t('settings.ai.personaBalanced')}
              </button>
            ))}
          </div>
        </div>
        <div className="w-full h-px bg-slate-200"></div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.ai.debateRounds')}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.ai.debateRoundsDesc')}</p>
          </div>
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            {[3, 5, 7].map(r => (
              <button key={r} onClick={() => setDebateRounds(r)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${debateRounds === r ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                {r} 轮
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  </>);
};

export default AISettingsPanel;
