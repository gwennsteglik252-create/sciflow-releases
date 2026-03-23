import React from 'react';
import { useTranslation } from '../../locales/useTranslation';
import { useSettingsState } from './useSettingsState';
import AISettingsPanel from './panels/AISettingsPanel';
import AppearanceSettingsPanel from './panels/AppearanceSettingsPanel';
import ResearchSettingsPanel from './panels/ResearchSettingsPanel';
import DataSettingsPanel from './panels/DataSettingsPanel';
import SystemSettingsPanel from './panels/SystemSettingsPanel';

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
  onOpenConfirm: (config: any) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ show, onClose, onOpenConfirm }) => {
  const { t } = useTranslation();
  const state = useSettingsState(show, onClose, onOpenConfirm);
  const { tab, ai, providers, appearance, research, data, system, network, license, update, cloud, actions, context } = state;
  const { settingsTab, setSettingsTab } = tab;

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-[3rem] p-8 lg:p-12 animate-reveal shadow-2xl relative border-4 border-white overflow-hidden h-[85vh] flex flex-col">
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-all active:scale-90 z-10">
          <i className="fa-solid fa-times text-2xl"></i>
        </button>

        <header className="mb-6 shrink-0">
          <h3 className="text-2xl font-black text-slate-800 uppercase italic border-l-8 border-indigo-600 pl-6 tracking-tighter">{t('settings.title')}</h3>
        </header>

        <div className="flex bg-slate-100 p-1 rounded-2xl mb-6 shrink-0 overflow-x-auto no-scrollbar">
          {([
            { id: 'ai' as const, label: t('settings.tabs.ai'), icon: 'fa-microchip' },
            { id: 'appearance' as const, label: t('settings.tabs.appearance'), icon: 'fa-palette' },
            { id: 'research' as const, label: t('settings.tabs.research'), icon: 'fa-flask-vial' },
            { id: 'data' as const, label: t('settings.tabs.data'), icon: 'fa-chart-pie' },
            { id: 'system' as const, label: t('settings.tabs.system'), icon: 'fa-gear' },
          ]).map(tabDef => (
            <button
              key={tabDef.id}
              onClick={() => setSettingsTab(tabDef.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${settingsTab === tabDef.id
                ? 'bg-white text-indigo-700 shadow-md'
                : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              <i className={`fa-solid ${tabDef.icon} text-[10px]`}></i>
              {tabDef.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-8 pb-6">
          {settingsTab === 'ai' && <AISettingsPanel ai={ai} providers={providers} context={context} />}
          {settingsTab === 'appearance' && <AppearanceSettingsPanel appearance={appearance} context={context} />}
          {settingsTab === 'research' && <ResearchSettingsPanel research={research} context={context} />}
          {settingsTab === 'data' && <DataSettingsPanel data={data} />}
          {settingsTab === 'system' && <SystemSettingsPanel system={system} network={network} license={license} update={update} cloud={cloud} actions={actions} context={context} />}
        </div>

        <footer className="mt-8 shrink-0">
          <button onClick={actions.handleSave} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-600 transition-all active:scale-95">{t('settings.saveButton')}</button>
        </footer>
      </div>
    </div>
  );
};

export default SettingsModal;