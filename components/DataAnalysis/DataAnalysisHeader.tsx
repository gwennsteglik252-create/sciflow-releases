
import React from 'react';
import { ChartTemplate, ACADEMIC_TEMPLATES } from '../../hooks/useDataAnalysisLogic';

interface DataAnalysisHeaderProps {
  activeTab: 'chart' | 'mimic';
  onTabChange: (tab: 'chart' | 'mimic') => void;
  onOpenEcoEngine: () => void;
  onOpenAssociate: () => void;
  onOpenChartLibrary: () => void;
  onExport: () => void;
  isExporting: boolean;
  isLightMode: boolean;
}

const DataAnalysisHeader: React.FC<DataAnalysisHeaderProps> = ({
  activeTab, onTabChange, onOpenEcoEngine, onOpenAssociate, onOpenChartLibrary, onExport, isExporting, isLightMode
}) => {
  return (
    <header className="lab-header flex flex-row justify-between items-center shrink-0 p-5 bg-slate-900/80 rounded-[2.5rem] border border-white/10 mb-2 gap-4 shadow-xl">
      <div className="flex flex-row items-center gap-6 flex-1 min-w-0">
        <h2 className="lab-title text-2xl font-black text-white tracking-tight italic uppercase leading-none border-l-4 border-indigo-500 pl-4 shrink-0">实验数据分析室</h2>
        <div className="lab-tabs flex bg-black/40 border border-white/5 p-1 rounded-xl w-fit shrink-0 ml-4 shadow-inner">
          <button
            onClick={() => onTabChange('chart')}
            className={`lab-tab-btn px-6 py-2.5 rounded-lg text-[11px] font-black uppercase transition-all ${activeTab === 'chart'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
          >
            数字图表编辑
          </button>

          <button
            onClick={() => onTabChange('mimic')}
            className={`lab-tab-btn px-6 py-2.5 rounded-lg text-[11px] font-black uppercase transition-all ${activeTab === 'mimic'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
          >
            AI 风格复刻
          </button>
        </div>
      </div>

      <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 items-center gap-1 shadow-inner">
        <button onClick={onOpenChartLibrary} className="px-5 py-2.5 bg-white/10 text-indigo-200 border border-white/5 rounded-xl text-[10px] font-black uppercase hover:bg-white/20 hover:text-white transition-all flex items-center gap-2 active:scale-95">
          <i className="fa-solid fa-layer-group"></i> 历史存档
        </button>

        <button onClick={onOpenEcoEngine} className="px-5 py-2.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all flex items-center gap-2 active:scale-95" title="启动电化学解析引擎">
          <i className="fa-solid fa-bolt"></i> 解析引擎
        </button>

        <button onClick={onOpenAssociate} className="px-5 py-2.5 bg-white/10 text-indigo-200 border border-white/5 rounded-xl text-[10px] font-black uppercase hover:bg-white/20 hover:text-white transition-all flex items-center gap-2 active:scale-95">
          <i className="fa-solid fa-link"></i> 关联记录
        </button>

        <button onClick={onExport} disabled={isExporting} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-500 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50">
          {isExporting ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-file-export"></i>} {isExporting ? '生成中...' : '超高清导出'}
        </button>
      </div>
    </header>
  );
};

export default DataAnalysisHeader;
