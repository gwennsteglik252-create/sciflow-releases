import React from 'react';
import { useTranslation } from '../../../locales/useTranslation';
import type { SettingsState } from '../useSettingsState';

interface Props {
  system: SettingsState['system'];
  network: SettingsState['network'];
  license: SettingsState['license'];
  update: SettingsState['update'];
  cloud: SettingsState['cloud'];
  actions: SettingsState['actions'];
  context: SettingsState['context'];
}

const SystemSettingsPanel: React.FC<Props> = ({ system, network, license, update, cloud, actions, context }) => {
  const { t } = useTranslation();
  const { appSettings, setAppSettings } = context;
  const {
    localPath, setLocalPath, startupPage, setStartupPage,
    chatHistoryRetentionDays, setChatHistoryRetentionDays, autoClearChat, setAutoClearChat,
    restoreWindowPosition, setRestoreWindowPosition, rememberLastPage, setRememberLastPage,
    gpuAcceleration, setGpuAcceleration, cacheMaxSizeMB, setCacheMaxSizeMB,
    autoBackupInterval, setAutoBackupInterval, defaultTablePageSize, setDefaultTablePageSize,
    customShortcuts, setCustomShortcuts, editingShortcut, setEditingShortcut,
  } = system;
  const { proxyEnabled, setProxyEnabled, proxyUrl, setProxyUrl,
    aiRequestTimeout, setAiRequestTimeout, confirmBeforeAISend, setConfirmBeforeAISend } = network;
  const { licenseState, licenseCode, setLicenseCode, licenseLoading,
    licenseError, setLicenseError, licenseSuccess, setLicenseSuccess, handleActivateLicense } = license;
  const { updateStatus, updateVersion, updateProgress, updateError, appVersion,
    handleCheckUpdate, handleDownloadUpdate, handleInstallUpdate } = update;
  const { handleClearCache, handleExportSettings, handleImportSettings, handleBrowseLocalPath } = actions;
  const { cloudUser, cloudStatus, cloudLoginEmail, setCloudLoginEmail,
    cloudLoginPassword, setCloudLoginPassword, cloudLoginLoading, cloudLoginError,
    handleCloudLogin, handleCloudLogout, handleCloudSyncNow } = cloud;

  return (<>
    {/* License Status */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-shield-halved text-emerald-500"></i> {t('settings.system.license')} (LICENSE)
      </h4>
      <div className={`p-6 rounded-[2rem] border space-y-4 ${licenseState?.status === 'activated' ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100' : licenseState?.status === 'trial' ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100' : 'bg-gradient-to-br from-rose-50 to-pink-50 border-rose-100'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${licenseState?.status === 'activated' ? 'bg-emerald-500 shadow-emerald-200' : licenseState?.status === 'trial' ? 'bg-amber-500 shadow-amber-200' : 'bg-rose-500 shadow-rose-200'}`}>
              <i className={`fa-solid ${licenseState?.status === 'activated' ? 'fa-crown' : licenseState?.status === 'trial' ? 'fa-hourglass-half' : 'fa-lock'} text-white`}></i>
            </div>
            <div>
              <p className="text-lg font-black text-slate-800 tracking-tight">
                {licenseState?.status === 'activated' ? t('settings.system.activated') : licenseState?.status === 'trial' ? t('settings.system.trial') : t('settings.system.expired')}
              </p>
              <p className="text-[9px] font-bold text-slate-500 uppercase">
                {licenseState?.status === 'activated' ? `${t('settings.system.permanentLicense')} · ${t('settings.system.activatedAt')} ${licenseState.activatedAt ? new Date(licenseState.activatedAt).toLocaleDateString() : '—'}` : licenseState?.status === 'trial' ? t('settings.system.trialDaysRemaining', { days: licenseState.trialDaysRemaining || 0 }) : t('settings.system.enterActivationCode')}
              </p>
            </div>
          </div>
          {licenseState?.status === 'activated' && (<span className="text-[8px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full">PRO</span>)}
        </div>
        {licenseState?.status !== 'activated' && (
          <div className="bg-white/60 rounded-xl p-4 space-y-3">
            <label className="text-[9px] font-black text-slate-400 uppercase block">{t('settings.system.enterActivationCode')}</label>
            <div className="flex gap-2">
              <input type="text" value={licenseCode} onChange={e => { setLicenseCode(e.target.value.toUpperCase()); setLicenseError(''); setLicenseSuccess(false); }} placeholder="SCIFLOW-XXXX-XXXX-XXXX-XXXX" className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-center tracking-wider outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" onKeyDown={e => e.key === 'Enter' && handleActivateLicense()} />
              <button onClick={handleActivateLicense} disabled={licenseLoading || !licenseCode.trim()} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 disabled:opacity-40 transition-all active:scale-95 shadow-md whitespace-nowrap">
                {licenseLoading ? <i className="fa-solid fa-spinner fa-spin" /> : t('settings.system.activate')}
              </button>
            </div>
            {licenseError && (<p className="text-[9px] text-rose-600 font-bold flex items-center gap-1"><i className="fa-solid fa-circle-xmark"></i> {licenseError}</p>)}
            {licenseSuccess && (<p className="text-[9px] text-emerald-600 font-bold flex items-center gap-1"><i className="fa-solid fa-circle-check"></i> {t('settings.system.activationSuccess')}</p>)}
            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => window.open('https://github.com/gwennsteglik252-create/sciflow-releases/issues/new?labels=license&title=申请获取授权码', '_blank')} className="text-[9px] font-bold text-indigo-600 hover:underline cursor-pointer bg-transparent border-none p-0">
                <i className="fa-solid fa-envelope mr-1"></i>{t('settings.system.getActivationCode')}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>

    {/* Cloud Sync */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-cloud text-sky-500"></i> {t('settings.system.cloudSync')} (CLOUD SYNC)
      </h4>
      {cloudStatus === 'unconfigured' ? (
        <div className="bg-gradient-to-br from-slate-50 to-sky-50 p-6 rounded-[2rem] border border-slate-100 text-center space-y-3">
          <div className="w-12 h-12 bg-slate-200 rounded-2xl flex items-center justify-center mx-auto">
            <i className="fa-solid fa-cloud-slash text-slate-400 text-xl"></i>
          </div>
          <p className="text-[11px] font-black text-slate-600 uppercase">{t('settings.system.cloudNotConfigured')}</p>
          <p className="text-[8px] text-slate-400 font-medium leading-relaxed">{t('settings.system.cloudNotConfiguredDesc')}</p>
          <button onClick={() => window.open('https://supabase.com/dashboard', '_blank')} className="text-[9px] font-bold text-indigo-600 hover:underline cursor-pointer bg-transparent border-none p-0">
            <i className="fa-solid fa-arrow-up-right-from-square mr-1"></i>{t('settings.system.cloudSetupGuide')}
          </button>
        </div>
      ) : cloudStatus === 'logged-out' ? (
        <div className="bg-gradient-to-br from-sky-50 to-indigo-50 p-6 rounded-[2rem] border border-sky-100 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-200">
              <i className="fa-solid fa-right-to-bracket text-white"></i>
            </div>
            <div>
              <p className="text-[11px] font-black text-slate-800 uppercase">{t('settings.system.cloudLogin')}</p>
              <p className="text-[8px] text-slate-400 font-bold">{t('settings.system.cloudLoginDesc')}</p>
            </div>
          </div>
          <div className="space-y-2">
            <input type="email" value={cloudLoginEmail} onChange={e => setCloudLoginEmail(e.target.value)} placeholder={t('settings.system.cloudEmail')} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-400 transition-colors shadow-sm" />
            <input type="password" value={cloudLoginPassword} onChange={e => setCloudLoginPassword(e.target.value)} placeholder={t('settings.system.cloudPassword')} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold outline-none focus:border-indigo-400 transition-colors shadow-sm" onKeyDown={e => e.key === 'Enter' && handleCloudLogin()} />
          </div>
          {cloudLoginError && <p className="text-[9px] text-rose-600 font-bold flex items-center gap-1"><i className="fa-solid fa-circle-xmark"></i> {cloudLoginError}</p>}
          <button onClick={handleCloudLogin} disabled={cloudLoginLoading || !cloudLoginEmail || !cloudLoginPassword} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 disabled:opacity-40 transition-all active:scale-95 shadow-md">
            {cloudLoginLoading ? <><i className="fa-solid fa-spinner fa-spin mr-1"></i>{t('settings.system.cloudLoggingIn')}</> : <><i className="fa-solid fa-right-to-bracket mr-1"></i>{t('settings.system.cloudLogin')}</>}
          </button>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-[2rem] border border-emerald-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
                <i className="fa-solid fa-cloud-check text-white"></i>
              </div>
              <div>
                <p className="text-[11px] font-black text-slate-800 uppercase">{t('settings.system.cloudConnected')}</p>
                <p className="text-[8px] text-emerald-600 font-bold">{cloudUser?.email}</p>
              </div>
            </div>
            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${cloudStatus === 'syncing' ? 'bg-amber-100 text-amber-600 animate-pulse' : cloudStatus === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {cloudStatus === 'syncing' ? t('settings.system.cloudSyncing') : cloudStatus === 'error' ? t('settings.system.cloudError') : t('settings.system.cloudSynced')}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCloudSyncNow} disabled={cloudStatus === 'syncing'} className="flex-1 py-2.5 bg-white border border-emerald-200 rounded-xl text-[10px] font-black text-emerald-700 uppercase hover:bg-emerald-600 hover:text-white transition-all active:scale-95 shadow-sm disabled:opacity-50">
              <i className={`fa-solid fa-arrows-rotate mr-1 ${cloudStatus === 'syncing' ? 'fa-spin' : ''}`}></i>{t('settings.system.cloudSyncNow')}
            </button>
            <button onClick={handleCloudLogout} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all active:scale-95 shadow-sm">
              <i className="fa-solid fa-right-from-bracket mr-1"></i>{t('settings.system.cloudLogout')}
            </button>
          </div>
        </div>
      )}
    </section>

    {/* Interaction & Behavior */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('settings.system.interaction')} (INTERACTION)</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between hover:border-emerald-200 transition-all">
          <div><p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.enableNotifications')}</p><p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.notificationsDesc')}</p></div>
          <button onClick={() => setAppSettings({ enableNotifications: !appSettings.enableNotifications })} className={`w-12 h-7 rounded-full p-1 transition-all duration-300 ${appSettings.enableNotifications ? 'bg-emerald-500' : 'bg-slate-200'}`}>
            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${appSettings.enableNotifications ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
        <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex items-center justify-between hover:border-emerald-200 transition-all">
          <div><p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.autoSave')}</p><p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.autoSave')}</p></div>
          <select className="bg-white border border-slate-200 text-[10px] font-bold text-slate-700 py-1 px-2 rounded-lg outline-none cursor-pointer" value={appSettings.autoSaveInterval || 5} onChange={(e) => setAppSettings({ autoSaveInterval: parseInt(e.target.value) })}>
            <option value={1}>{t('settings.system.autoSaveRealtime')}</option><option value={5}>{t('settings.system.autoSaveStandard')}</option><option value={15}>{t('settings.system.autoSaveLow')}</option><option value={0}>{t('settings.system.autoSaveOff')}</option>
          </select>
        </div>
      </div>
    </section>

    {/* Network & Proxy */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-tower-broadcast text-teal-500"></i> {t('settings.system.networkProxy')} (NETWORK & PROXY)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
        <div className="flex items-center justify-between">
          <div><p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.enableProxy')}</p><p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.proxyDesc')}</p></div>
          <button onClick={() => setProxyEnabled(!proxyEnabled)} className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${proxyEnabled ? 'bg-indigo-600' : 'bg-slate-200'}`}>
            <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${proxyEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
        {proxyEnabled && (
          <div className="animate-reveal">
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.system.proxyAddress')}</label>
            <input type="text" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono outline-none focus:border-indigo-400 transition-colors shadow-sm" value={proxyUrl} onChange={e => setProxyUrl(e.target.value)} placeholder="http://127.0.0.1:7890" />
          </div>
        )}
        <div className="w-full h-px bg-slate-200"></div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.aiTimeout')}</p><p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.aiTimeout')}: {aiRequestTimeout}s</p></div>
          <select className="bg-white border border-slate-200 text-[10px] font-bold text-slate-700 py-2 px-3 rounded-xl outline-none cursor-pointer shadow-sm hover:border-indigo-300 transition-colors" value={aiRequestTimeout} onChange={e => setAiRequestTimeout(Number(e.target.value))}>
            <option value={30}>30 秒</option><option value={60}>60 秒 (默认)</option><option value={120}>120 秒</option><option value={300}>300 秒</option>
          </select>
        </div>
      </div>
    </section>

    {/* Privacy & Security */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-shield-halved text-emerald-500"></i> {t('settings.system.privacySecurity')} (PRIVACY & SECURITY)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
        <div className="flex items-center justify-between">
          <div className="pr-4">
            <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.confirmBeforeAI')}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.confirmBeforeAI')}</p>
            <p className="text-[8px] text-slate-400 italic mt-1">{t('settings.system.confirmBeforeAIDesc')}</p>
          </div>
          <button onClick={() => setConfirmBeforeAISend(!confirmBeforeAISend)} className={`w-14 h-8 rounded-full p-1 transition-all duration-300 shrink-0 ${confirmBeforeAISend ? 'bg-indigo-600' : 'bg-slate-200'}`}>
            <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${confirmBeforeAISend ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
    </section>

    {/* Backup & Restore */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-cloud-arrow-down text-blue-500"></i> {t('settings.system.backupRestore')} (BACKUP & RESTORE)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={handleExportSettings} className="flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-dashed border-slate-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-all group">
            <i className="fa-solid fa-file-export text-indigo-500 group-hover:scale-110 transition-transform"></i>
            <div className="text-left"><p className="text-[11px] font-black text-slate-800 uppercase">{t('settings.system.exportSettings')}</p><p className="text-[8px] text-slate-400 font-bold uppercase">Export as JSON</p></div>
          </button>
          <button onClick={handleImportSettings} className="flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-dashed border-slate-200 rounded-2xl hover:border-amber-400 hover:bg-amber-50 transition-all group">
            <i className="fa-solid fa-file-import text-amber-500 group-hover:scale-110 transition-transform"></i>
            <div className="text-left"><p className="text-[11px] font-black text-slate-800 uppercase">{t('settings.system.importSettings')}</p><p className="text-[8px] text-slate-400 font-bold uppercase">Restore from JSON</p></div>
          </button>
        </div>
        <p className="text-[7px] text-slate-400 mt-3 font-bold uppercase tracking-widest italic px-1"><i className="fa-solid fa-circle-info mr-1 text-blue-400"></i>{t('settings.system.exportHint')}</p>
      </div>
    </section>

    {/* Keyboard Shortcuts */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-keyboard text-orange-500"></i> {t('settings.system.shortcuts')} (KEYBOARD SHORTCUTS)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {[
            { key: 'search', label: t('settings.system.shortcutSearch'), defaultKeys: '⌘ / Ctrl + K' },
            { key: 'aiCli', label: t('settings.system.shortcutAiCli'), defaultKeys: '⌘ / Ctrl + J' },
            { key: 'save', label: t('settings.system.shortcutSave'), defaultKeys: '⌘ / Ctrl + S' },
            { key: 'undo', label: t('settings.system.shortcutUndo'), defaultKeys: '⌘ / Ctrl + Z' },
            { key: 'redo', label: t('settings.system.shortcutRedo'), defaultKeys: '⌘ / Ctrl + Shift + Z' },
            { key: 'screenshot', label: t('settings.system.shortcutScreenshot'), defaultKeys: '⌘ / Ctrl + Shift + S' },
            { key: 'searchInChat', label: t('settings.system.shortcutSearchInChat'), defaultKeys: '⌘ / Ctrl + F' },
            { key: 'closeModal', label: t('settings.system.shortcutCloseModal'), defaultKeys: 'Escape' },
          ].map(s => (
            <div key={s.key} className="flex items-center justify-between py-2 px-3 bg-white rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-600">{s.label}</span>
              <button
                className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-lg cursor-pointer transition-all ${editingShortcut === s.key ? 'bg-red-100 text-red-600 animate-pulse' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}
                onClick={() => setEditingShortcut(editingShortcut === s.key ? null : s.key)}
                onKeyDown={e => {
                  if (editingShortcut === s.key && e.key !== 'Escape') {
                    e.preventDefault();
                    const parts: string[] = [];
                    if (e.metaKey || e.ctrlKey) parts.push(navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
                    if (e.shiftKey) parts.push('Shift');
                    if (e.altKey) parts.push('Alt');
                    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) parts.push(e.key.toUpperCase());
                    if (parts.length > 1) { setCustomShortcuts({ ...customShortcuts, [s.key]: parts.join(' + ') }); setEditingShortcut(null); }
                  } else if (e.key === 'Escape') { setEditingShortcut(null); }
                }}
              >
                {editingShortcut === s.key ? t('settings.system.shortcutRecording') : (customShortcuts[s.key] || s.defaultKeys)}
              </button>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest italic px-1"><i className="fa-solid fa-circle-info mr-1 text-orange-400"></i>{t('settings.system.shortcutsHint')}</p>
          {Object.keys(customShortcuts).length > 0 && (
            <button onClick={() => setCustomShortcuts({})} className="text-[9px] font-bold text-rose-500 hover:text-rose-700 transition-colors">{t('settings.system.shortcutReset')}</button>
          )}
        </div>
      </div>
    </section>

    {/* Storage Management */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('settings.system.storage')} (STORAGE)</h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
        <label className="block text-[9px] font-black text-slate-500 uppercase mb-3 px-1">{t('settings.system.localLibraryPath')}</label>
        <div className="flex gap-2">
          <input type="text" className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-indigo-500 transition-all shadow-sm" value={localPath} onChange={(e) => setLocalPath(e.target.value)} />
          <button onClick={handleBrowseLocalPath} className="px-4 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-md active:scale-95 transition-all">{t('common.browse')}</button>
        </div>
        <p className="text-[7px] text-slate-400 mt-2 font-bold uppercase tracking-widest italic px-1">{t('settings.system.storageHint')}</p>
      </div>
    </section>

    {/* AI Conversation Management */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-comments text-purple-500"></i> {t('settings.system.chatManagement')} (CHAT MANAGEMENT)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.chatRetention')}</p><p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.chatRetention')}</p></div>
          <select className="bg-white border border-slate-200 text-[10px] font-bold text-slate-700 py-2 px-3 rounded-xl outline-none cursor-pointer shadow-sm hover:border-indigo-300 transition-colors" value={chatHistoryRetentionDays} onChange={e => setChatHistoryRetentionDays(Number(e.target.value))}>
            <option value={7}>{t('settings.system.chatRetention7')}</option><option value={30}>{t('settings.system.chatRetention30')}</option><option value={90}>{t('settings.system.chatRetention90')}</option><option value={365}>{t('settings.system.chatRetentionForever')}</option>
          </select>
        </div>
        <div className="w-full h-px bg-slate-200"></div>
        <div className="flex items-center justify-between">
          <div><p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.autoClearChat')}</p><p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.autoClearChat')}</p></div>
          <button onClick={() => setAutoClearChat(!autoClearChat)} className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${autoClearChat ? 'bg-indigo-600' : 'bg-slate-200'}`}>
            <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${autoClearChat ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
    </section>

    {/* Window Behavior */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-window-restore text-sky-500"></i> {t('settings.system.windowBehavior')} (WINDOW BEHAVIOR)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
        <div className="flex items-center justify-between">
          <div><p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.restorePosition')}</p><p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.restorePosition')}</p></div>
          <button onClick={() => setRestoreWindowPosition(!restoreWindowPosition)} className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${restoreWindowPosition ? 'bg-indigo-600' : 'bg-slate-200'}`}>
            <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${restoreWindowPosition ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
        <div className="w-full h-px bg-slate-200"></div>
        <div className="flex items-center justify-between">
          <div><p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.rememberLastPage')}</p><p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.rememberLastPage')}</p></div>
          <button onClick={() => setRememberLastPage(!rememberLastPage)} className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${rememberLastPage ? 'bg-indigo-600' : 'bg-slate-200'}`}>
            <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${rememberLastPage ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
    </section>

    {/* Startup Page */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-house-chimney text-teal-500"></i> {t('settings.system.startupPage')} (STARTUP)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.startupPage')}</p><p className="text-[8px] text-slate-400 font-bold uppercase">DEFAULT PAGE ON LAUNCH</p></div>
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            {(['dashboard', 'lastProject', 'blank'] as const).map(page => (
              <button key={page} onClick={() => setStartupPage(page)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${startupPage === page ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                {page === 'dashboard' ? t('settings.system.startupDashboard') : page === 'lastProject' ? t('settings.system.startupLastProject') : t('settings.system.startupBlank')}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* Auto Backup & Table Page Size */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-cloud-arrow-up text-sky-500"></i> {t('settings.system.autoBackup')} (BACKUP & DATA)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.system.autoBackupInterval')}</label>
            <div className="relative">
              <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm" value={autoBackupInterval} onChange={e => setAutoBackupInterval(Number(e.target.value))}>
                <option value={0}>{t('settings.system.autoBackupOff')}</option><option value={30}>{t('settings.system.autoBackup30')}</option><option value={60}>{t('settings.system.autoBackup60')}</option><option value={120}>{t('settings.system.autoBackup120')}</option><option value={360}>{t('settings.system.autoBackup360')}</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
            <p className="text-[7px] text-slate-400 mt-1 px-1">{t('settings.system.autoBackupDesc')}</p>
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.system.tablePageSize')}</label>
            <div className="relative">
              <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm" value={defaultTablePageSize} onChange={e => setDefaultTablePageSize(Number(e.target.value))}>
                <option value={10}>10 行/页</option><option value={25}>25 行/页</option><option value={50}>50 行/页</option><option value={100}>100 行/页</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
            <p className="text-[7px] text-slate-400 mt-1 px-1">{t('settings.system.tablePageSizeDesc')}</p>
          </div>
        </div>
      </div>
    </section>

    {/* Performance */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-bolt text-amber-500"></i> {t('settings.system.performance')} (PERFORMANCE)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
        <div className="flex items-center justify-between">
          <div><p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.gpuAcceleration')}</p><p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.gpuAcceleration')}</p></div>
          <button onClick={() => setGpuAcceleration(!gpuAcceleration)} className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${gpuAcceleration ? 'bg-indigo-600' : 'bg-slate-200'}`}>
            <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${gpuAcceleration ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
        <div className="w-full h-px bg-slate-200"></div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.system.cacheMaxSize')}</p><p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.system.cacheMaxSize')}: {cacheMaxSizeMB} MB</p></div>
          <select className="bg-white border border-slate-200 text-[10px] font-bold text-slate-700 py-2 px-3 rounded-xl outline-none cursor-pointer shadow-sm hover:border-indigo-300 transition-colors" value={cacheMaxSizeMB} onChange={e => setCacheMaxSizeMB(Number(e.target.value))}>
            <option value={256}>256 MB</option><option value={512}>512 MB (默认)</option><option value={1024}>1 GB</option><option value={2048}>2 GB</option>
          </select>
        </div>
      </div>
    </section>

    {/* About & Update */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-circle-info text-indigo-500"></i> {t('settings.system.aboutUpdate')} (ABOUT & UPDATE)
      </h4>
      <div className="bg-gradient-to-br from-indigo-50 to-violet-50 p-6 rounded-[2rem] border border-indigo-100">
        <div className="flex items-center justify-between mb-4">
          <div><p className="text-lg font-black text-slate-800 tracking-tight">SciFlow Pro</p><p className="text-[10px] font-bold text-indigo-600 uppercase">v{appVersion}</p></div>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200"><i className="fa-solid fa-flask text-white"></i></div>
        </div>
        <div className="bg-white/60 rounded-xl p-3 mb-4">
          {updateStatus === 'idle' && (<p className="text-[10px] text-slate-500 font-bold">{t('settings.system.updateNotAvailableHint')}</p>)}
          {updateStatus === 'checking' && (<div className="flex items-center gap-2"><i className="fa-solid fa-spinner fa-spin text-indigo-500 text-xs"></i><p className="text-[10px] text-indigo-600 font-bold">{t('settings.system.checking')}</p></div>)}
          {updateStatus === 'not-available' && (<div className="flex items-center gap-2"><i className="fa-solid fa-circle-check text-emerald-500 text-xs"></i><p className="text-[10px] text-emerald-600 font-bold">{t('settings.system.latestVersion')}</p></div>)}
          {updateStatus === 'available' && (<div><div className="flex items-center gap-2 mb-1"><i className="fa-solid fa-gift text-amber-500 text-xs"></i><p className="text-[10px] text-amber-700 font-black">{t('settings.system.newVersionFound', { version: updateVersion })}</p></div><p className="text-[9px] text-slate-400">点击下方按钮开始下载更新</p></div>)}
          {updateStatus === 'downloading' && (<div><div className="flex items-center justify-between mb-1.5"><div className="flex items-center gap-2"><i className="fa-solid fa-cloud-arrow-down text-blue-500 text-xs animate-bounce"></i><p className="text-[10px] text-blue-600 font-bold">{t('settings.system.downloading')}</p></div><span className="text-[10px] font-black text-blue-700">{updateProgress}%</span></div><div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300" style={{ width: `${updateProgress}%` }}></div></div></div>)}
          {updateStatus === 'downloaded' && (<div className="flex items-center gap-2"><i className="fa-solid fa-rocket text-violet-500 text-xs"></i><p className="text-[10px] text-violet-700 font-black">{t('settings.system.downloaded')}</p></div>)}
          {updateStatus === 'error' && (<div className="flex items-center gap-2"><i className="fa-solid fa-triangle-exclamation text-rose-500 text-xs"></i><p className="text-[10px] text-rose-600 font-bold">{updateError}</p></div>)}
        </div>
        {updateStatus === 'available' ? (
          <button onClick={handleDownloadUpdate} className="w-full py-3 bg-amber-500 rounded-xl text-[10px] font-black text-white uppercase hover:bg-amber-600 transition-all active:scale-95 shadow-sm"><i className="fa-solid fa-cloud-arrow-down mr-1.5"></i> {t('settings.system.downloadUpdate')} v{updateVersion}</button>
        ) : updateStatus === 'downloaded' ? (
          <button onClick={handleInstallUpdate} className="w-full py-3 bg-violet-600 rounded-xl text-[10px] font-black text-white uppercase hover:bg-violet-700 transition-all active:scale-95 shadow-sm"><i className="fa-solid fa-rocket mr-1.5"></i> {t('settings.system.installRestart')}</button>
        ) : updateStatus === 'downloading' ? (
          <button disabled className="w-full py-3 bg-slate-200 rounded-xl text-[10px] font-black text-slate-400 uppercase cursor-not-allowed"><i className="fa-solid fa-spinner fa-spin mr-1.5"></i> {t('settings.system.downloading')} {updateProgress}%</button>
        ) : (
          <button onClick={handleCheckUpdate} disabled={updateStatus === 'checking'} className={`w-full py-3 bg-white border border-indigo-200 rounded-xl text-[10px] font-black text-indigo-700 uppercase hover:bg-indigo-600 hover:text-white transition-all active:scale-95 shadow-sm ${updateStatus === 'checking' ? 'opacity-60 cursor-not-allowed' : ''}`}>
            <i className={`fa-solid fa-arrows-rotate mr-1.5 ${updateStatus === 'checking' ? 'fa-spin' : ''}`}></i>
            {updateStatus === 'checking' ? t('settings.system.checking') : t('settings.system.checkUpdate')}
          </button>
        )}
      </div>
    </section>

    {/* Danger Zone */}
    <section className="pt-6 border-t border-slate-100">
      <div className="bg-rose-50 p-8 rounded-[2.5rem] border border-rose-100 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-rose-500 shadow-sm shrink-0"><i className="fa-solid fa-trash-can text-xl"></i></div>
          <div><h5 className="text-xs font-black text-rose-900 uppercase">{t('settings.system.dangerZone')} (DANGER ZONE)</h5><p className="text-[10px] text-rose-700 font-medium leading-relaxed italic">{t('settings.system.dangerZoneDesc')}</p></div>
        </div>
        <button onClick={handleClearCache} className="px-8 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-rose-200 hover:bg-black transition-all active:scale-95 whitespace-nowrap">{t('settings.system.clearAllCache')}</button>
      </div>
    </section>
  </>);
};

export default SystemSettingsPanel;
