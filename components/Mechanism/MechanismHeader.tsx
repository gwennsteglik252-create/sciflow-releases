
import React, { useState } from 'react';
import { exportToWord } from '../../utils/documentExport';

interface MechanismHeaderProps {
  analysisArchives: any[];
  onLoadArchive: (sim: any) => void;
  onDeleteArchive: (id: string) => void;
  onRenameArchive: (id: string, newName: string) => void;
  onRenameRequest: (id: string, currentName: string) => void;
  showComparisonTable: boolean;
  setShowComparisonTable: (show: boolean) => void;
  handleSaveToComparison: () => void;
  handleSaveToArchives: () => void;
  physicalConstants: any;
  analysisResult: string | null;
  isProcessing: boolean;
  runMechanismAnalysis: () => void;
  mechanismSession: any;
  updateMechanismSession: (updates: any) => void;
}

const MechanismHeader: React.FC<MechanismHeaderProps> = ({
  analysisArchives,
  onLoadArchive,
  onDeleteArchive,
  onRenameArchive,
  onRenameRequest,
  showComparisonTable,
  setShowComparisonTable,
  handleSaveToComparison,
  handleSaveToArchives,
  physicalConstants,
  analysisResult,
  isProcessing,
  runMechanismAnalysis,
  mechanismSession,
  updateMechanismSession
}) => {
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [showArchivesList, setShowArchivesList] = useState(false);

  const { isStableAnalysis } = mechanismSession;

  const handleExportReport = () => {
    if (!analysisResult) return;
    const { material, dopingElement, dopingConcentration, reactionMode, pH, potential, stabilityPrediction } = mechanismSession;
    const title = `工业性能仿真报告_${material}_${dopingElement}`;

    // Calculate RDS barrier for report
    let rdsBarrier = '--';
    if (physicalConstants?.energySteps && Array.isArray(physicalConstants.energySteps)) {
      const steps = physicalConstants.energySteps;
      let maxDiff = -Infinity;
      for (let i = 0; i < steps.length - 1; i++) {
        const diff = Math.abs(steps[i + 1] - steps[i]); // OCR/OER/HER RDS is max absolute DG diff
        if (diff > maxDiff) maxDiff = diff;
      }
      if (maxDiff > -Infinity) rdsBarrier = `${maxDiff.toFixed(2)} eV`;
    }

    // Beautiful, detailed HTML content for Word export
    const content = `
      <h1 style="text-align: center; color: #1e1b4b; font-family: Arial, sans-serif;">${title}</h1>
      <p style="text-align: right; color: #64748b; font-size: 10pt; font-family: Arial, sans-serif;">生成日期: ${new Date().toLocaleString()}</p>
      
      <div style="background-color: #f8fafc; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #e2e8f0; font-family: Arial, sans-serif;">
        <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 5px; font-family: Arial, sans-serif;">一、 仿真工况环境 (Operating Environment)</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; font-weight: bold; width: 25%; color: #475569;">反应模式:</td>
            <td style="padding: 8px;">${reactionMode}</td>
            <td style="padding: 8px; font-weight: bold; width: 25%; color: #475569;">环境 pH 值:</td>
            <td style="padding: 8px;">${pH}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #475569;">基座材料:</td>
            <td style="padding: 8px;">${material}</td>
            <td style="padding: 8px; font-weight: bold; color: #475569;">外加电势:</td>
            <td style="padding: 8px;">${potential} V</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #475569;">掺杂元素:</td>
            <td style="padding: 8px;">${dopingElement}</td>
            <td style="padding: 8px; font-weight: bold; color: #475569;">掺杂浓度:</td>
            <td style="padding: 8px;">${dopingConcentration}%</td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom: 20px; font-family: Arial, sans-serif;">
        <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 5px; font-family: Arial, sans-serif;">二、 动力学与物理常数解算 (Kinetic Constants)</h2>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0;">
          <tr style="background-color: #f1f5f9;">
            <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; color: #1e293b;">核心指标名称</th>
            <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; color: #1e293b;">解算数值</th>
            <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: left; color: #1e293b;">单位 / 说明</th>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">Tafel 斜率 (bT)</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px; font-weight: bold; color: #4f46e5;">${physicalConstants?.tafelSlope || '--'}</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">mV/dec</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">交换电流密度 (j0)</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px; font-weight: bold; color: #4f46e5;">${physicalConstants?.exchangeCurrentDensity || '--'}</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">A/cm²</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">过电位 (η10)</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px; font-weight: bold; color: #4f46e5;">${physicalConstants?.eta10 || '--'} V</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">vs. RHE</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">RDS 能垒 (ΔG)</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px; font-weight: bold; color: #f43f5e;">${rdsBarrier}</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">决速步自由能变</td>
          </tr>
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">稳定性安全指数</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px; font-weight: bold; color: #10b981;">${stabilityPrediction?.safetyIndex?.toFixed(2) || '--'}</td>
            <td style="border: 1px solid #e2e8f0; padding: 10px;">Scale 0.00-10.00</td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom: 20px; font-family: Arial, sans-serif;">
        <h2 style="color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 5px; font-family: Arial, sans-serif;">三、 深度机理推演结论 (Mechanism Analysis)</h2>
        <div style="padding: 20px; background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 6px solid #f59e0b; border-radius: 4px; line-height: 1.8;">
          ${analysisResult.replace(/\n/g, '<br/>')}
        </div>
      </div>
      
      <p style="text-align: center; color: #94a3b8; font-size: 8pt; margin-top: 60px; border-top: 1px dashed #e2e8f0; padding-top: 10px;">
        © 2026 SciFlow Pro | 智能动力学仿真审计系统自动生成 | 密级: 内部公开
      </p>
    `;
    exportToWord(title, content, { pH, potential });
    setShowSaveMenu(false);
  };

  const onSaveClick = (type: 'comparison' | 'archive') => {
    if (type === 'comparison') {
      handleSaveToComparison();
    } else {
      handleSaveToArchives();
    }
    setShowSaveMenu(false);
  };

  return (
    <header className="flex flex-row justify-between items-center shrink-0 px-6 py-4 bg-slate-900 rounded-[2.5rem] border border-white/10 gap-6 shadow-2xl overflow-visible z-50 relative">
      <div className="flex items-center gap-4 shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shrink-0">
          <i className="fa-solid fa-industry text-sm"></i>
        </div>
        <div className="flex flex-col">
          <h2 className="text-lg font-black text-white tracking-tighter italic uppercase leading-none">工业性能模拟器</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Kinetics Simulation Core</p>
        </div>
      </div>

      <div className="flex-1"></div>

      <div className="flex items-center gap-3 shrink-0 bg-black/20 p-1.5 rounded-2xl border border-white/5 shadow-inner">

        {/* Stable Mode Toggle (Moved Here) */}
        <button
          onClick={() => updateMechanismSession({ isStableAnalysis: !isStableAnalysis })}
          className={`h-10 px-4 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border active:scale-95 group ${isStableAnalysis ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50' : 'bg-white/5 text-slate-500 border-white/10 hover:bg-white/10 hover:text-slate-300'}`}
          title={isStableAnalysis ? "确定性模式 (Stable): 结果可复现" : "启发式模式 (Heuristic): 探索性分析"}
        >
          <div className={`w-2 h-2 rounded-full shadow-sm transition-all ${isStableAnalysis ? 'bg-indigo-400 shadow-[0_0_8px_#818cf8] animate-pulse' : 'bg-slate-600'}`}></div>
          <span>{isStableAnalysis ? 'Stable' : 'AI-Gen'}</span>
        </button>

        <div className="w-px h-6 bg-white/10 mx-1"></div>

        {/* 1. Analysis Library Dropdown Button */}
        <div className="relative">
          <button
            onClick={() => setShowArchivesList(!showArchivesList)}
            className={`h-10 px-4 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border active:scale-95 ${showArchivesList ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'}`}
          >
            <i className="fa-solid fa-box-archive text-[11px]"></i>
            <span>分析方案库 ({analysisArchives.length})</span>
            <i className={`fa-solid fa-chevron-down text-[8px] transition-transform ${showArchivesList ? 'rotate-180' : ''}`}></i>
          </button>

          {showArchivesList && (
            <div className="absolute top-full right-0 mt-3 w-80 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl p-2 overflow-hidden animate-reveal z-[200]">
              <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">已存档分析方案</h4>
                <button onClick={() => setShowArchivesList(false)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400"><i className="fa-solid fa-times text-[10px]"></i></button>
              </div>
              <div className="max-h-80 overflow-y-auto custom-scrollbar">
                {analysisArchives.map(archive => (
                  <div key={archive.id} className="p-3 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer group flex justify-between items-center border-b border-slate-50 last:border-0" onClick={() => { onLoadArchive(archive); setShowArchivesList(false); }}>
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="text-[11px] font-bold text-slate-800 truncate uppercase">{archive.name}</p>
                      <p className="text-[8px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">{archive.timestamp}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRenameRequest(archive.id, archive.name);
                        }}
                        className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-indigo-500 hover:text-white transition-all shadow-sm"
                      >
                        <i className="fa-solid fa-pen text-[9px]"></i>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteArchive(archive.id); }}
                        className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                      >
                        <i className="fa-solid fa-trash-can text-[9px]"></i>
                      </button>
                    </div>
                  </div>
                ))}
                {analysisArchives.length === 0 && (
                  <div className="p-10 text-center text-slate-300 italic">
                    <i className="fa-solid fa-box-open text-3xl mb-3 block opacity-20"></i>
                    <p className="text-[10px] font-black uppercase tracking-[0.2rem]">分析库暂无存档</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 2. Comparison Matrix Button */}
        <button
          onClick={() => setShowComparisonTable(true)}
          className={`h-10 px-4 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 border active:scale-95 ${showComparisonTable ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40' : 'bg-white/5 text-slate-400 border-white/5 hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/20'}`}
        >
          <i className="fa-solid fa-list-check"></i>
          <span>对比矩阵</span>
        </button>

        {/* 3. Save / Archive Dropdown Button */}
        <div className="relative">
          <button
            onClick={() => setShowSaveMenu(!showSaveMenu)}
            disabled={!physicalConstants}
            className={`h-10 px-4 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 border active:scale-95 disabled:opacity-30 disabled:grayscale ${showSaveMenu ? 'bg-amber-600 text-white border-amber-500' : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500 hover:text-white hover:border-amber-500'}`}
          >
            <i className="fa-solid fa-floppy-disk"></i>
            <span>保存 / 归档</span>
            <i className={`fa-solid fa-chevron-down text-[8px] transition-transform ${showSaveMenu ? 'rotate-180' : ''}`}></i>
          </button>

          {showSaveMenu && (
            <div className="absolute top-full right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-reveal z-[100] flex flex-col p-1.5">
              <button onClick={() => onSaveClick('comparison')} className="px-4 py-3 hover:bg-indigo-50 rounded-xl text-[10px] font-bold text-slate-700 text-left flex items-center gap-3 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm"><i className="fa-solid fa-table-columns text-[10px]"></i></div>
                <span>加入对比矩阵</span>
              </button>
              <button onClick={() => onSaveClick('archive')} className="px-4 py-3 hover:bg-emerald-50 rounded-xl text-[10px] font-bold text-slate-700 text-left flex items-center gap-3 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm"><i className="fa-solid fa-box-archive text-[10px]"></i></div>
                <span>存入分析方案库</span>
              </button>
              <div className="my-1.5 border-t border-slate-50"></div>
              <button onClick={handleExportReport} disabled={!analysisResult} className="px-4 py-3 hover:bg-indigo-50 rounded-xl text-[10px] font-bold text-slate-700 text-left flex items-center gap-3 transition-colors disabled:opacity-50">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm"><i className="fa-solid fa-file-word text-[10px]"></i></div>
                <span>导出 Word 报告</span>
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-white/10 mx-1"></div>

        {/* 4. Start Simulation Button */}
        <button
          type="button"
          onClick={runMechanismAnalysis}
          disabled={isProcessing}
          className="h-10 px-6 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-[0_4px_15px_rgba(99,102,241,0.4)] hover:bg-indigo-500 hover:shadow-indigo-500/50 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-3 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
          {isProcessing ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-microchip group-hover:rotate-12 transition-transform"></i>}
          <span>启动性能解算</span>
        </button>
      </div>
    </header>
  );
};

export default MechanismHeader;
