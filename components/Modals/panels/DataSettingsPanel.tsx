import React from 'react';
import { useTranslation } from '../../../locales/useTranslation';
import type { SettingsState } from '../useSettingsState';

interface Props { data: SettingsState['data']; }

const DataSettingsPanel: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();
  const { defaultExportFormat, setDefaultExportFormat, defaultExportDPI, setDefaultExportDPI,
    defaultChartFont, setDefaultChartFont, defaultColorPalette, setDefaultColorPalette,
    defaultChartWidth, setDefaultChartWidth, defaultChartHeight, setDefaultChartHeight,
    chartAnimation, setChartAnimation } = data;

  return (<>
    {/* Data & Visualization */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-chart-pie text-cyan-500"></i> {t('settings.data.title')} (DATA & VISUALIZATION)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.data.defaultExportFormat')}</label>
            <div className="relative">
              <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm" value={defaultExportFormat} onChange={e => setDefaultExportFormat(e.target.value as any)}>
                <option value="SVG">SVG (矢量)</option><option value="PNG">PNG (位图)</option><option value="PDF">PDF (文档)</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.data.defaultExportDPI')}</label>
            <div className="relative">
              <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm" value={defaultExportDPI} onChange={e => setDefaultExportDPI(Number(e.target.value) as any)}>
                <option value={300}>300 DPI ({t('settings.data.dpiStandard')})</option>
                <option value={600}>600 DPI ({t('settings.data.dpiHD')})</option>
                <option value={1200}>1200 DPI ({t('settings.data.dpiPublication')})</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
          </div>
        </div>
        <div className="w-full h-px bg-slate-200"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.data.chartFont')}</label>
            <div className="relative">
              <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm" value={defaultChartFont} onChange={e => setDefaultChartFont(e.target.value)}>
                <option value="Arial">Arial</option><option value="Helvetica">Helvetica</option><option value="Times New Roman">Times New Roman</option><option value="Calibri">Calibri</option><option value="Roboto">Roboto</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.data.colorPalette')}</label>
            <div className="relative">
              <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm" value={defaultColorPalette} onChange={e => setDefaultColorPalette(e.target.value)}>
                <option value="Nature">Nature 色板</option><option value="Science">Science 色板</option><option value="JACS">JACS 色板</option><option value="ACS Nano">ACS Nano 色板</option><option value="Pastel">柔和色板</option><option value="Vibrant">鲜明色板</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* Chart Size & Animation */}
    <section className="space-y-4">
      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
        <i className="fa-solid fa-expand text-violet-500"></i> {t('settings.data.chartSize')} (CHART SIZE)
      </h4>
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.data.chartWidth')}</label>
            <div className="relative">
              <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm" value={defaultChartWidth} onChange={e => setDefaultChartWidth(Number(e.target.value))}>
                <option value={400}>{t('settings.data.chartSizeSingleCol')}</option>
                <option value={800}>{t('settings.data.chartSizeDoubleCol')}</option>
                <option value={1200}>{t('settings.data.chartSizePresentation')}</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase mb-1.5">{t('settings.data.chartHeight')}</label>
            <div className="relative">
              <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-sm" value={defaultChartHeight} onChange={e => setDefaultChartHeight(Number(e.target.value))}>
                <option value={400}>{t('settings.data.chartHeightSmall')}</option>
                <option value={600}>{t('settings.data.chartHeightStandard')}</option>
                <option value={800}>{t('settings.data.chartHeightTall')}</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none"></i>
            </div>
          </div>
        </div>
        <div className="w-full h-px bg-slate-200"></div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{t('settings.data.chartAnimation')}</p>
            <p className="text-[8px] text-slate-400 font-bold uppercase">{t('settings.data.chartAnimationDesc')}</p>
          </div>
          <button onClick={() => setChartAnimation(!chartAnimation)} className={`w-14 h-8 rounded-full p-1 transition-all duration-300 ${chartAnimation ? 'bg-indigo-600' : 'bg-slate-200'}`}>
            <div className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${chartAnimation ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
    </section>
  </>);
};

export default DataSettingsPanel;
