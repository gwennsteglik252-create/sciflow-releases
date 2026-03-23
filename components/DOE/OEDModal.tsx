import React, { useState } from 'react';
import { DOEFactor, DOEResponse } from '../../types';
import { IntensityMode } from './constants';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine } from 'recharts';
import { useProjectContext } from '../../context/ProjectContext';
import { useTranslation } from '../../locales';

interface OEDModalProps {
  show: boolean;
  onClose: () => void;
  intensityMode: IntensityMode;
  setIntensityMode: (mode: IntensityMode) => void;
  currentMatrix: number[][];
  activeFactors: DOEFactor[];
  responses: DOEResponse[];
  oedResults: Record<number, string>;
  setOedResults: (val: Record<number, string>) => void;
  oedFactorOverrides: Record<string, string>;
  setOedFactorOverrides: (val: Record<string, string>) => void;
  getFactorDisplayValue: (rIdx: number, fIdx: number, factor: DOEFactor, level: number) => string;
  rangeAnalysis: { kValues: Record<string, { k1: number, k2: number, k3: number, r: number }>, totalR: number } | null;
  paretoAnalysis: { chartData: { name: string, effect: number, percentage: number }[], totalEffect: number, progress: number } | null;
  surfacePrediction: { gridData: { x: number, y: number, z: number }[], points: any[], progress: number } | null;
  syncOEDToHistory: () => void;
}

const OEDModal: React.FC<OEDModalProps> = ({
  show, onClose, intensityMode, setIntensityMode, currentMatrix, activeFactors, responses,
  oedResults, setOedResults, oedFactorOverrides, setOedFactorOverrides,
  getFactorDisplayValue, rangeAnalysis, paretoAnalysis, surfacePrediction, syncOEDToHistory
}) => {
  const { t } = useTranslation();
  const { activeTheme } = useProjectContext();
  const isLightMode = activeTheme.type === 'light';
  const [showInterpretation, setShowInterpretation] = useState(false);

  if (!show) return null;

  const modeLabel = intensityMode === 'screening' ? t('doeAssistant.oedModal.modes.screening') : 
                   intensityMode === 'standard' ? t('doeAssistant.oedModal.modes.standard') : 
                   t('doeAssistant.oedModal.modes.aiInspired');

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[3000] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl rounded-lg p-8 lg:p-10 animate-reveal shadow-2xl relative border-4 border-white h-[90vh] flex flex-col overflow-hidden">
         <button onClick={onClose} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-all"><i className="fa-solid fa-times text-2xl"></i></button>
         
         <header className="mb-8 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="flex items-center gap-4">
             <div className={`w-12 h-12 text-white rounded-lg flex items-center justify-center text-xl shadow-lg ${intensityMode === 'screening' ? 'bg-emerald-600' : intensityMode === 'standard' ? 'bg-indigo-600' : 'bg-amber-600'}`}>
                 <i className={`fa-solid ${intensityMode === 'screening' ? 'fa-filter' : intensityMode === 'standard' ? 'fa-table-list' : 'fa-wand-magic-sparkles'}`}></i>
             </div>
             <div>
               <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">{t('doeAssistant.oedModal.title', { mode: modeLabel })}</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  {intensityMode === 'screening' ? t('doeAssistant.oedModal.designTypes.screening') : intensityMode === 'ai_inspired' ? t('doeAssistant.oedModal.designTypes.aiInspired') : t('doeAssistant.oedModal.designTypes.standard')}
               </p>
             </div>
           </div>

           {/* Mode Switcher Buttons */}
           <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-inner shrink-0">
              <button 
                onClick={() => setIntensityMode('screening')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${intensityMode === 'screening' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <i className="fa-solid fa-filter text-[10px]"></i>
                {t('doeAssistant.oedModal.modes.screening')}
              </button>
              <button 
                onClick={() => setIntensityMode('standard')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${intensityMode === 'standard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <i className="fa-solid fa-table-list text-[10px]"></i>
                {t('doeAssistant.oedModal.modes.standard')}
              </button>
              <button 
                onClick={() => setIntensityMode('ai_inspired')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${intensityMode === 'ai_inspired' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <i className="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
                {t('doeAssistant.oedModal.modes.aiInspired')}
              </button>
           </div>
         </header>

         <div className="flex-1 grid grid-cols-12 gap-8 overflow-hidden">
            {/* Left: Design Matrix */}
            <div className="col-span-8 flex flex-col overflow-hidden bg-slate-50 rounded-lg border border-slate-200 shadow-inner">
               <div className={`p-5 border-b border-slate-200 flex justify-between items-center ${isLightMode ? 'bg-slate-100' : 'bg-white/50'}`}>
                  <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{t('doeAssistant.oedModal.matrixTitle')}</h4>
                  <span className={`text-[9px] font-bold px-2 py-1 rounded-xl ${intensityMode === 'screening' ? 'text-emerald-600 bg-emerald-50' : intensityMode === 'standard' ? 'text-indigo-600 bg-indigo-50' : 'text-amber-600 bg-amber-50'}`}>
                      {currentMatrix.length} {t('doeAssistant.oedModal.runs')}
                  </span>
               </div>
               <div className="flex-1 overflow-auto custom-scrollbar p-2">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="border-b border-slate-200">
                           <th className="p-4 text-[9px] font-black text-slate-400 uppercase text-center w-16">{t('doeAssistant.oedModal.columnRun')}</th>
                           {activeFactors.map((f, i) => (
                             <th key={i} className="p-4 text-[9px] font-black text-slate-600 uppercase border-r border-slate-100 last:border-0 text-center">
                                <div className="flex items-center justify-center gap-2">
                                    <span className="text-[8px] text-indigo-300 font-mono bg-indigo-50/50 px-1.5 py-0.5 rounded border border-indigo-100/30 shrink-0">
                                        {f.min} — {f.max}
                                    </span>
                                    <span className="whitespace-nowrap">{f.name} <span className="text-slate-400 opacity-50">({f.unit})</span></span>
                                </div>
                             </th>
                           ))}
                           <th className="p-4 text-[9px] font-black text-emerald-600 uppercase text-right w-32">{t('doeAssistant.oedModal.columnResponse', { name: responses[0]?.name || t('doeAssistant.oedModal.fallbackResult') })}</th>
                        </tr>
                     </thead>
                     <tbody>
                        {currentMatrix.map((row, rIdx) => (
                           <tr key={rIdx} className="border-b border-slate-100 hover:bg-white transition-colors">
                              <td className="p-4 text-center font-black text-slate-300 text-xs">{rIdx + 1}</td>
                              {activeFactors.map((f, fIdx) => (
                                 <td key={fIdx} className="p-4 border-r border-slate-100 last:border-0">
                                    <input 
                                        className="w-full bg-transparent text-[10px] font-bold text-slate-700 font-mono outline-none border-b border-transparent hover:border-indigo-200 focus:border-indigo-500 transition-colors text-center"
                                        value={getFactorDisplayValue(rIdx, fIdx, f, row[fIdx])}
                                        onChange={(e) => setOedFactorOverrides({...oedFactorOverrides, [`${rIdx}-${fIdx}`]: e.target.value})}
                                    />
                                 </td>
                              ))}
                              <td className="p-4 text-right">
                                 <input 
                                   className="w-24 bg-white border border-slate-200 rounded-xl p-2 text-right text-xs font-black outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
                                   placeholder={t('doeAssistant.oedModal.placeholderEnter')}
                                   type="number"
                                   value={oedResults[rIdx] || ''}
                                   onChange={(e) => setOedResults({...oedResults, [rIdx]: e.target.value})}
                                 />
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>

            {/* Right: Analysis Dashboard - Dynamic Content */}
            <div className="col-span-4 flex flex-col gap-4 overflow-hidden">
               <div className="flex-1 bg-slate-900 rounded-lg p-6 text-white flex flex-col shadow-xl border border-slate-800 overflow-hidden">
                  
                  {/* Dynamic Header with Help Button */}
                  <div className="flex justify-between items-center mb-6">
                    <h4 className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${intensityMode === 'screening' ? 'text-emerald-400' : intensityMode === 'ai_inspired' ? 'text-amber-400' : 'text-indigo-400'}`}>
                      <i className={`fa-solid ${intensityMode === 'screening' ? 'fa-chart-bar' : intensityMode === 'ai_inspired' ? 'fa-map' : 'fa-chart-simple'}`}></i>
                      {intensityMode === 'screening' ? t('doeAssistant.oedModal.analysis.pareto') : intensityMode === 'ai_inspired' ? t('doeAssistant.oedModal.analysis.surface') : t('doeAssistant.oedModal.analysis.range')}
                    </h4>
                    <button 
                      onClick={() => setShowInterpretation(!showInterpretation)}
                      className={`w-6 h-6 rounded-full transition-all flex items-center justify-center border ${showInterpretation ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg' : 'bg-white/10 text-white/40 border-white/10 hover:bg-white/20'}`}
                      title={t('doeAssistant.oedModal.interpretation.helpTitle')}
                    >
                      <i className="fa-solid fa-question text-[10px]"></i>
                    </button>
                  </div>

                  {/* Interpretation Box */}
                  {showInterpretation && (
                    <div className="mb-6 p-4 bg-white/5 rounded-lg border border-white/10 animate-reveal">
                      <p className="text-[9px] text-slate-400 leading-relaxed italic">
                        {intensityMode === 'screening' ? t('doeAssistant.oedModal.interpretation.screening') : 
                        intensityMode === 'ai_inspired' ? t('doeAssistant.oedModal.interpretation.aiInspired') : 
                        t('doeAssistant.oedModal.interpretation.standard')}
                      </p>
                    </div>
                  )}
                  
                  {/* Mode 1: Screening (Pareto) */}
                  {intensityMode === 'screening' && paretoAnalysis && (
                      <div className="flex-1 flex flex-col min-h-0">
                          {paretoAnalysis.progress < 100 ? (
                              <div className="flex flex-col items-center justify-center flex-1 opacity-50">
                                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-4">
                                      <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${paretoAnalysis.progress}%` }}></div>
                                  </div>
                                  <p className="text-[10px] font-black uppercase text-center">{t('doeAssistant.oedModal.status.dataCollection', { progress: Math.round(paretoAnalysis.progress) })}</p>
                                  <p className="text-[8px] text-slate-500 mt-1">{t('doeAssistant.oedModal.status.completeRuns')}</p>
                              </div>
                          ) : (
                              <div className="flex-1 w-full min-h-0">
                                  <ResponsiveContainer width="100%" height="100%">
                                      <BarChart data={paretoAnalysis.chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                                          <XAxis type="number" hide />
                                          <YAxis dataKey="name" type="category" width={80} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                                          <Tooltip cursor={{fill: '#ffffff10'}} contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '10px'}} />
                                          <Bar dataKey="effect" barSize={20} radius={[0, 4, 4, 0]}>
                                              {paretoAnalysis.chartData.map((entry, index) => (
                                                  <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#334155'} />
                                              ))}
                                          </Bar>
                                      </BarChart>
                                  </ResponsiveContainer>
                              </div>
                          )}
                          <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-white/5">
                              <p className="text-[9px] text-slate-400 leading-relaxed italic">
                                  {t('doeAssistant.oedModal.status.topFactor')} <span className="text-emerald-400 font-bold">{paretoAnalysis.chartData[0]?.name || 'N/A'}</span> ({t('doeAssistant.oedModal.status.impact')} {paretoAnalysis.chartData[0]?.percentage.toFixed(1)}%)
                              </p>
                          </div>
                      </div>
                  )}

                  {/* Mode 2: AI Inspired (Response Surface) */}
                  {intensityMode === 'ai_inspired' && surfacePrediction && (
                      <div className="flex-1 flex flex-col min-h-0">
                          {surfacePrediction.points.length < 2 ? (
                              <div className="flex flex-col items-center justify-center flex-1 opacity-50">
                                  <i className="fa-solid fa-wand-magic-sparkles text-3xl mb-4 text-amber-500/50"></i>
                                  <p className="text-[10px] font-black uppercase text-center">{t('doeAssistant.oedModal.status.aiSurfaceGenerating')}</p>
                                  <p className="text-[8px] text-slate-500 mt-2">录入 ≥ 2 组数据后自动生成响应曲面</p>
                                  <p className="text-[8px] text-slate-500 mt-1">{t('doeAssistant.oedModal.status.needAnchorPoints', { progress: Math.round(surfacePrediction.progress) })}</p>
                              </div>
                          ) : (
                              <div className="flex flex-col flex-1 min-h-0 gap-2">
                                  {/* E: 坐标轴标签 */}
                                  <div className="flex justify-between items-center text-[8px] text-amber-400 font-black uppercase tracking-widest px-1">
                                      <span>{activeFactors[0]?.name || 'Factor A'}</span>
                                      <span className="opacity-50">→</span>
                                      <span>{activeFactors[1]?.name || 'Factor B'} ↑</span>
                                  </div>
                              <div className="flex-1 relative rounded-lg overflow-hidden border border-white/10 bg-black/20">
                                  {/* E: IDW 热图网格 */}
                                  <div className="absolute inset-0 grid grid-cols-10 grid-rows-10">
                                      {surfacePrediction.gridData.map((pt, idx) => {
                                          const allZ = surfacePrediction.gridData.map(p => p.z);
                                          const zMin = Math.min(...allZ);
                                          const zMax = Math.max(...allZ);
                                          const intensity = zMax > zMin ? (pt.z - zMin) / (zMax - zMin) : 0.5;
                                          const hue = (1 - intensity) * 240;
                                          return (
                                              <div 
                                                  key={idx} 
                                                  style={{ backgroundColor: `hsla(${hue}, 80%, 55%, 0.85)` }}
                                                  className="w-full h-full transition-colors duration-300 hover:opacity-100 opacity-90"
                                                  title={`预测值: ${pt.z.toFixed(2)}`}
                                              ></div>
                                          );
                                      })}
                                  </div>
                                  {/* Overlay: 实测点 */}
                                  {surfacePrediction.points.map((p, idx) => (
                                      <div 
                                          key={idx}
                                          className="absolute w-4 h-4 bg-white rounded-full border-2 border-slate-900 shadow-lg transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-10 hover:scale-125 transition-transform"
                                          style={{ left: `${p.x * 100}%`, top: `${(1 - p.y) * 100}%` }}
                                          title={`实测值: ${p.z}`}
                                      >
                                          <div className="w-1.5 h-1.5 bg-slate-900 rounded-full"></div>
                                      </div>
                                  ))}
                                  {/* 已覆盖数量角标 */}
                                  <div className="absolute bottom-2 right-2 bg-black/60 text-amber-400 text-[8px] font-black px-2 py-0.5 rounded-xl backdrop-blur-sm">
                                      {surfacePrediction.points.length}/{currentMatrix.length} pts
                                  </div>
                              </div>
                              </div>
                          )}
                          <div className="mt-4 flex justify-between items-center text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                              <span>{t('doeAssistant.oedModal.status.lowPerf')}</span>
                              <div className="h-1 w-20 bg-gradient-to-r from-blue-600 via-green-500 to-red-500 rounded-full"></div>
                              <span>{t('doeAssistant.oedModal.status.highPerf')}</span>
                          </div>
                      </div>
                  )}

                  {/* Mode 3: Standard (Range Analysis) */}
                  {intensityMode === 'standard' && rangeAnalysis && (
                     <div className="space-y-6 overflow-y-auto custom-scrollbar flex-1">
                        {activeFactors.map((f) => {
                           const stats = rangeAnalysis.kValues[f.name];
                           if (!stats) return null;
                           
                           return (
                             <div key={f.name}>
                                <div className="flex justify-between items-end mb-2">
                                   <span className="text-[9px] font-bold text-slate-400 uppercase">{f.name}</span>
                                   <span className="text-[10px] font-black text-indigo-400">R = {stats.r.toFixed(2)}</span>
                                </div>
                                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
                                   <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${(stats.r / rangeAnalysis.totalR) * 100}%` }}></div>
                                </div>
                                <div className="grid grid-cols-3 gap-1 text-center">
                                   <div className="bg-white/5 rounded p-1"><p className="text-[7px] text-slate-500">K1</p><p className="text-[8px] font-bold">{stats.k1.toFixed(1)}</p></div>
                                   <div className="bg-white/5 rounded p-1"><p className="text-[7px] text-slate-500">K2</p><p className="text-[8px] font-bold">{stats.k2.toFixed(1)}</p></div>
                                   <div className="bg-white/5 rounded p-1"><p className="text-[7px] text-slate-500">K3</p><p className="text-[8px] font-bold">{stats.k3.toFixed(1)}</p></div>
                                </div>
                             </div>
                           );
                        })}
                     </div>
                  )}
                  
                  {/* Fallback Empty State for Standard Mode */}
                  {intensityMode === 'standard' && !rangeAnalysis && (
                     <div className="flex-1 flex flex-col items-center justify-center text-slate-700 opacity-50">
                        <i className="fa-solid fa-calculator text-4xl mb-3"></i>
                        <p className="text-[10px] font-black uppercase text-center whitespace-pre-line">
                            {t('doeAssistant.oedModal.status.autoCalculate')}
                        </p>
                     </div>
                  )}
               </div>

               <button 
                 onClick={syncOEDToHistory}
                 className="w-full py-5 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase shadow-xl hover:bg-emerald-500 transition-all active:scale-95 flex items-center justify-center gap-2"
               >
                 <i className="fa-solid fa-file-import"></i> {t('doeAssistant.oedModal.status.syncToHistory')}
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default OEDModal;
