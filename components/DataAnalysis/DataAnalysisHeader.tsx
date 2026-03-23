
import React from 'react';

interface DataAnalysisHeaderProps {
  activeTab: 'chart' | 'mimic' | 'data';
  onTabChange: (tab: 'chart' | 'mimic' | 'data') => void;
  onOpenEcoEngine: () => void;
  onOpenAssociate: () => void;
  onOpenChartLibrary: () => void;
  onSaveWorkspace: () => void;
  onSaveAs: () => void;
  onExport: () => void;
  isExporting: boolean;
  isLightMode: boolean;
  currentSavedChartId?: string;
  currentSavedChartName?: string;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

const DataAnalysisHeader: React.FC<DataAnalysisHeaderProps> = ({
  activeTab, onTabChange, onOpenEcoEngine, onOpenAssociate, onOpenChartLibrary, onSaveWorkspace, onSaveAs, onExport, isExporting, isLightMode, currentSavedChartId, currentSavedChartName,
  canUndo, canRedo, onUndo, onRedo
}) => {
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  const modLabel = isMac ? '⌘' : 'Ctrl+';

  return (
    <header className="lab-header flex flex-row justify-between items-center shrink-0 px-5 py-3 bg-slate-900/80 rounded-xl border border-white/10 mb-1 gap-4 shadow-xl">
      <div className="flex flex-row items-center gap-4 flex-1 min-w-0">
        <h2 className="lab-title text-lg font-black text-white tracking-tight italic uppercase leading-none border-l-4 border-indigo-500 pl-3 shrink-0">实验数据分析室</h2>

        {/* AI 风格复刻 — 独立模式入口 */}
        <button
          onClick={() => onTabChange(activeTab === 'mimic' ? 'chart' : 'mimic')}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${
            activeTab === 'mimic'
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
              : 'bg-white/10 text-slate-300 border border-white/5 hover:bg-white/20 hover:text-white'
          }`}
        >
          <i className="fa-solid fa-wand-magic-sparkles text-[9px]" /> AI 风格复刻
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        {/* ── 撤销 / 重做 ── */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="px-3 py-2 bg-white/10 text-slate-300 border border-white/5 rounded-lg text-[10px] font-black uppercase hover:bg-white/20 hover:text-white transition-all flex items-center gap-1 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
          title={`撤销 (${modLabel}Z)`}
        >
          <i className="fa-solid fa-rotate-left text-[10px]" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="px-3 py-2 bg-white/10 text-slate-300 border border-white/5 rounded-lg text-[10px] font-black uppercase hover:bg-white/20 hover:text-white transition-all flex items-center gap-1 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
          title={`重做 (${modLabel}⇧Z)`}
        >
          <i className="fa-solid fa-rotate-right text-[10px]" />
        </button>

        <div className="w-px h-5 bg-white/10 mx-1" />

        <button onClick={onSaveWorkspace} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center gap-1.5 active:scale-95" title={currentSavedChartId ? `覆盖保存: ${currentSavedChartName} (${modLabel}S)` : `保存至新存档 (${modLabel}S)`}>
          <i className={`fa-solid ${currentSavedChartId ? 'fa-floppy-disk' : 'fa-floppy-disk'}`} /> {currentSavedChartId ? '保存' : '保存'}
        </button>

        <button onClick={onSaveAs} className="px-4 py-2 bg-white/10 text-emerald-200 border border-white/5 rounded-lg text-[10px] font-black uppercase hover:bg-white/20 hover:text-white transition-all flex items-center gap-1.5 active:scale-95" title={`另存为 (${modLabel}⇧S)`}>
          <i className="fa-solid fa-copy" /> 另存为
        </button>

        <button onClick={onOpenChartLibrary} className="px-4 py-2 bg-white/10 text-indigo-200 border border-white/5 rounded-lg text-[10px] font-black uppercase hover:bg-white/20 hover:text-white transition-all flex items-center gap-1.5 active:scale-95">
          <i className="fa-solid fa-layer-group" /> 工作区存档
        </button>

        <button onClick={onOpenEcoEngine} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all flex items-center gap-1.5 active:scale-95" title="启动电化学解析引擎">
          <i className="fa-solid fa-bolt" /> 解析引擎
        </button>

        <button onClick={onOpenAssociate} className="px-4 py-2 bg-white/10 text-indigo-200 border border-white/5 rounded-lg text-[10px] font-black uppercase hover:bg-white/20 hover:text-white transition-all flex items-center gap-1.5 active:scale-95">
          <i className="fa-solid fa-link" /> 关联记录
        </button>

        <button onClick={onExport} disabled={isExporting} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase shadow-lg hover:bg-indigo-500 transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50" title={`超高清导出 (${modLabel}E)`}>
          {isExporting ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-file-export" />} {isExporting ? '生成中...' : '超高清导出'}
        </button>
      </div>
    </header>
  );
};

export default DataAnalysisHeader;
