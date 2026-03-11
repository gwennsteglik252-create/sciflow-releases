
import React, { useState } from 'react';
import { EngineMode } from './types';

interface ElectroHeaderProps {
  activeMode: EngineMode;
  setActiveMode: (mode: EngineMode) => void;
  onClose: () => void;
  setAnalysisResult: (v: any) => void;
  setAiConclusion: (v: any) => void;
  onOpenBifunctionalExpert: () => void;
  isExpertModeActive: boolean;
  onClearWorkspace: () => void;
  isEmbedded?: boolean;
  showLibrary: boolean;
  onToggleLibrary: () => void;
  recordCount: number;
  // 入库同步 & 存入方案库 buttons
  analysisResult: any;
  saveStep: 'idle' | 'selecting';
  setSaveStep: (step: 'selecting') => void;
  setShowSaveModal: (v: boolean) => void;
  currentRecordId: string | null;
  handleQuickSave: () => void;
  handleSaveAs: () => void;
  onSyncToLog?: () => void;
}

const MODE_COLORS: Record<EngineMode, string> = {
  'LSV': 'bg-indigo-600 shadow-indigo-200',
  'OER': 'bg-orange-600 shadow-orange-200',
  'CV': 'bg-violet-600 shadow-violet-200',
  'ECSA': 'bg-emerald-600 shadow-emerald-200',
  'RDE': 'bg-sky-600 shadow-sky-200',
  'EIS': 'bg-rose-600 shadow-rose-200'
};

const MODE_ICONS: Record<EngineMode, string> = {
  'LSV': 'fa-bolt-lightning',
  'OER': 'fa-arrow-up-right-dots',
  'CV': 'fa-repeat',
  'ECSA': 'fa-layer-group',
  'RDE': 'fa-arrows-spin',
  'EIS': 'fa-chart-area'
};

const MODE_LABELS: Record<EngineMode, string> = {
  'LSV': 'LSV (ORR)',
  'OER': 'OER',
  'CV': 'CV',
  'ECSA': 'ECSA',
  'RDE': 'K-L (RDE)',
  'EIS': 'EIS'
};

export const ElectroHeader: React.FC<ElectroHeaderProps> = ({
  activeMode, setActiveMode, onClose, setAnalysisResult, setAiConclusion,
  onOpenBifunctionalExpert, isExpertModeActive, onClearWorkspace, isEmbedded,
  showLibrary, onToggleLibrary, recordCount,
  analysisResult, saveStep, setSaveStep, setShowSaveModal, currentRecordId,
  handleQuickSave, handleSaveAs, onSyncToLog
}) => {
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);
  return (
    <header className={`flex flex-col md:flex-row justify-between items-end shrink-0 gap-6 ${isEmbedded ? 'mb-4' : 'mb-8'}`}>
      <div className="flex items-center gap-5">
        <div className={`w-14 h-14 rounded-[1.2rem] flex items-center justify-center text-white shadow-2xl transition-all duration-500 ${MODE_COLORS[activeMode]}`}>
          <i className={`fa-solid text-xl ${MODE_ICONS[activeMode]}`}></i>
        </div>
        <div>
          <h2 className="text-2xl lg:text-3xl font-black text-slate-900 italic uppercase tracking-tighter leading-none">电化学深度解析</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2rem]">Kinetic Simulation Core v2.5</p>
          </div>
        </div>
      </div>

      <div className={`flex items-center p-1.5 rounded-[1.5rem] border border-slate-200 shadow-xl gap-2 ${isEmbedded ? 'bg-slate-50' : 'bg-white/50'}`}>
        {/* 入库同步 + 保存下拉 + 方案库 按钮（在模式标签左侧） */}
        <button
          onClick={onSyncToLog}
          className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider shadow-lg shadow-indigo-100 hover:bg-black transition-all flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
        >
          <i className="fa-solid fa-floppy-disk text-[10px]"></i> 入库同步
        </button>
        <div className="relative">
          <div className="flex items-stretch">
            <button
              onClick={handleQuickSave}
              className="px-4 py-2.5 bg-violet-50 text-violet-600 rounded-l-xl text-[9px] font-black uppercase border border-r-0 border-violet-100 hover:bg-violet-600 hover:text-white transition-all flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
            >
              <i className="fa-solid fa-floppy-disk text-[10px]"></i> 保存
            </button>
            <button
              onClick={() => setShowSaveDropdown(!showSaveDropdown)}
              className="px-1.5 py-2.5 bg-violet-50 text-violet-400 rounded-r-xl text-[9px] border border-violet-100 hover:bg-violet-600 hover:text-white transition-all active:scale-95"
            >
              <i className={`fa-solid fa-chevron-down text-[8px] transition-transform ${showSaveDropdown ? 'rotate-180' : ''}`}></i>
            </button>
          </div>
          {showSaveDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 min-w-[120px]">
              <button onClick={() => { handleQuickSave(); setShowSaveDropdown(false); }} className="w-full px-4 py-2 text-left text-[10px] font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center gap-2">
                <i className="fa-solid fa-floppy-disk text-[10px]"></i> 保存
              </button>
              <button onClick={() => { handleSaveAs(); setShowSaveDropdown(false); }} className="w-full px-4 py-2 text-left text-[10px] font-bold text-slate-600 hover:bg-violet-50 hover:text-violet-600 transition-all flex items-center gap-2">
                <i className="fa-solid fa-copy text-[10px]"></i> 另存为
              </button>
            </div>
          )}
        </div>
        <button
          onClick={onToggleLibrary}
          className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center border shadow-sm active:scale-90 relative shrink-0 ${showLibrary ? 'bg-amber-500 text-white border-amber-400' : 'bg-white text-amber-500 border-slate-200 hover:bg-amber-50'}`}
          title="方案库"
        >
          <i className="fa-solid fa-folder-open text-base"></i>
          {recordCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-indigo-600 text-white text-[7px] font-black rounded-full flex items-center justify-center">{recordCount}</span>
          )}
        </button>
        <button
          onClick={onSyncToLog}
          disabled={!currentRecordId}
          className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase shadow-md hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap"
          title={currentRecordId ? '关联课题记录' : '请先保存方案后再关联'}
        >
          <i className="fa-solid fa-link text-[10px]"></i> 关联课题
        </button>
        <div className="w-px h-8 bg-slate-200 mx-1"></div>
        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
          {(['LSV', 'OER', 'CV', 'ECSA', 'RDE', 'EIS'] as EngineMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => { setActiveMode(mode); setAnalysisResult(null); setAiConclusion(null); }}
              className={`px-4 py-2.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap flex items-center gap-2 ${activeMode === mode ? 'bg-slate-900 text-white shadow-lg scale-105' : 'text-slate-400 hover:text-slate-700'}`}
            >
              <i className={`fa-solid ${MODE_ICONS[mode]} ${activeMode === mode ? 'text-indigo-400' : 'text-slate-300'}`}></i>
              {MODE_LABELS[mode]}
            </button>
          ))}
          <div className="w-px h-8 bg-slate-200 mx-1"></div>
          <button
            onClick={onOpenBifunctionalExpert}
            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border ${isExpertModeActive ? 'bg-indigo-600 text-white border-transparent shadow-lg' : 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50 shadow-sm'}`}
          >
            <i className="fa-solid fa-microscope text-[12px]"></i>
            深度诊断
          </button>
        </div>



        <button
          onClick={onClearWorkspace}
          className="w-12 h-12 rounded-xl bg-white text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center border border-slate-200 shadow-sm active:scale-90"
          title="清空工作间"
        >
          <i className="fa-solid fa-trash-can text-lg"></i>
        </button>

        {!isEmbedded && (
          <button onClick={onClose} className="w-12 h-12 rounded-xl bg-white text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center border border-slate-200 shadow-sm active:scale-90">
            <i className="fa-solid fa-times text-xl"></i>
          </button>
        )}
      </div>
    </header>
  );
};
