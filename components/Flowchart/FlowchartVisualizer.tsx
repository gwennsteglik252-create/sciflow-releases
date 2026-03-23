
import React from 'react';
import { SavedFlowchart, FlowchartStep, SavedDOE } from '../../types';

interface FlowchartVisualizerProps {
  flowchart: SavedFlowchart | null;
  activeStepId: string | null;
  setActiveStepId: (id: string | null) => void;
  onContextMenu: (e: React.MouseEvent, step: FlowchartStep) => void;
  doeArchives: SavedDOE[];
  containerRef: React.RefObject<HTMLDivElement>;
  onStepEdit?: (stepId: string, updates: Partial<FlowchartStep>, index?: number) => void;
  onStepSplit?: (step: FlowchartStep) => void;
  isSplittingStepId?: string | null;
  onGenerateBOM?: () => void;
  isGeneratingBOM?: boolean;
}

export const FlowchartVisualizer: React.FC<FlowchartVisualizerProps> = ({
  flowchart, activeStepId, setActiveStepId, onContextMenu, doeArchives, containerRef,
  onStepEdit, onStepSplit, isSplittingStepId,
  onGenerateBOM, isGeneratingBOM
}) => {
  const getDoeValidation = (step: FlowchartStep) => {
    if (!step.doeAnchor) return null;
    return doeArchives.find(archive =>
      Object.keys(archive.suggestion?.nextExperiment || {}).some(k => step.text.includes(k) || step.doeAnchor?.includes(k))
    );
  };

  const getRiskStyle = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'high': return 'bg-rose-500/10 text-rose-600 border-rose-200';
      case 'medium': return 'bg-amber-500/10 text-amber-600 border-amber-200';
      case 'low': return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  const extractParameters = (description: string | undefined | null) => {
    if (!description) return null;
    const params: { value: string; icon: string }[] = [];
    
    // 温度
    const tempMatch = description.match(/(?:温度|Temp|temperature|煅烧|退火)[\s：:]*(?:在\s*)?([–\-~]?[\d.]+\s*(?:–|-|~|～)?\s*[\d.]*\s*°C)/i);
    if (tempMatch) params.push({ value: tempMatch[1], icon: '🌡' });
    
    // 时间
    const timeMatch = description.match(/(?:时间|Time|duration|保温)[\s：:]*([–\-~]?[\d.]+\s*(?:–|-|~)?\s*[\d.]*\s*(?:min|h|小时|分钟|分|hr|天|d))/i);
    if (timeMatch) params.push({ value: timeMatch[1], icon: '⏱' });
    
    // 浓度/体积
    const concMatch = description.match(/(?:体积|Volume|浓度|Conc|concentration|Vol)[\s：:]*([–\-~]?[\d.]+\s*(?:mL|L|mol\/L|M|mM|μL|wt%))/i);
    if (concMatch) params.push({ value: concMatch[1], icon: '🧪' });
    
    // pH
    const phMatch = description.match(/(?:pH|酸碱度)[\s：:≈]*([–\-~]?[\d.]+(?:\s*(?:–|-|~)\s*[\d.]+)?)/i);
    if (phMatch) params.push({ value: `pH ${phMatch[1]}`, icon: '📊' });
    
    // 压力
    const pressMatch = description.match(/(?:压力|pressure|分压)[\s：:]*([–\-~]?[\d.]+\s*(?:MPa|kPa|atm|bar))/i);
    if (pressMatch) params.push({ value: pressMatch[1], icon: '💨' });
    
    // 转速
    const rpmMatch = description.match(/(?:搅拌|转速|rpm|r\/min|离心)[\s：:]*([–\-~]?[\d.]+\s*(?:rpm|r\/min|×g))/i);
    if (rpmMatch) params.push({ value: rpmMatch[1], icon: '🔄' });
    
    // 质量
    const massMatch = description.match(/(?:质量|投料|加入|mass|amount)[\s：:]*([–\-~]?[\d.]+\s*(?:kg|g|mg|μg))/i);
    if (massMatch) params.push({ value: massMatch[1], icon: '⚖' });

    // 气氛
    const atmoMatch = description.match(/(?:气氛|atmosphere|保护气)[\s：:]*((?:N2|Ar|H2|O2|Air|氮气|氩气)[^\s,。]?)/i);
    if (atmoMatch) params.push({ value: atmoMatch[1], icon: '☁' });

    // 电流密度
    const currentMatch = description.match(/(?:电流密度|current density)[\s：:]*([–\-~]?[\d.]+\s*(?:mA\/cm²|A\/m²|mA\/g))/i);
    if (currentMatch) params.push({ value: currentMatch[1], icon: '⚡' });

    // 粒径
    const sizeMatch = description.match(/(?:粒径|particle size|D50)[\s：:]*([–\-~]?[\d.]+\s*(?:nm|μm|µm))/i);
    if (sizeMatch) params.push({ value: sizeMatch[1], icon: '🔬' });

    return params.length > 0 ? params : null;
  };

  return (
    <div className="flex-1 min-w-0 h-full bg-slate-50/50 rounded-xl border border-slate-200 shadow-inner overflow-y-auto custom-scrollbar">
      <div ref={containerRef} className="p-6 lg:p-10 pb-40 print:p-0">
        {flowchart ? (
          <div className="flex flex-col items-center gap-6 w-full max-w-4xl mx-auto">
            {/* BOM 状态条 */}
            {flowchart.steps.length > 0 && (() => {
              const hasBOM = flowchart.steps.some(s => s.bomItems && s.bomItems.length > 0);
              return (
                <div className="w-full flex items-center justify-between bg-white rounded-xl border border-slate-100 px-5 py-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${hasBOM ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-50 text-amber-500'}`}>
                      <i className={`fa-solid ${hasBOM ? 'fa-boxes-stacked' : 'fa-box-open'} text-[10px]`}></i>
                    </div>
                    <div>
                      <p className={`text-[9px] font-black uppercase tracking-widest ${hasBOM ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {hasBOM ? 'BOM 物料清单已生成' : 'BOM 物料清单未生成'}
                      </p>
                      <p className="text-[7px] text-slate-400 font-bold mt-0.5">
                        {hasBOM
                          ? `共 ${flowchart.steps.reduce((sum, s) => sum + (s.bomItems?.length || 0), 0)} 项物料`
                          : '点击右侧按钮生成工业成本物料清单'
                        }
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onGenerateBOM?.(); }}
                    disabled={isGeneratingBOM}
                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 shadow-lg transition-all active:scale-95
                      ${isGeneratingBOM
                        ? 'bg-slate-100 text-slate-400 cursor-wait'
                        : hasBOM
                          ? 'bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-600 hover:text-white'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/30'
                      }`}
                  >
                    {isGeneratingBOM
                      ? <><i className="fa-solid fa-spinner animate-spin"></i> 正在生成...</>
                      : hasBOM
                        ? <><i className="fa-solid fa-arrows-rotate"></i> 重新生成 BOM</>
                        : <><i className="fa-solid fa-industry"></i> 生成 BOM 物料清单</>
                    }
                  </button>
                </div>
              );
            })()}
            {flowchart.steps.map((step, idx) => {
              const isSelected = activeStepId === step.id;
              const validatedDoe = getDoeValidation(step);
              const params = extractParameters(step.description);
              const rStyle = getRiskStyle(step.riskLevel);
              const isSplitting = isSplittingStepId === step.id;

              return (
                <div key={step.id || idx} className="relative w-full group animate-reveal">
                  {idx > 0 && (
                    <div className="absolute left-10 -top-6 w-0.5 h-6 bg-indigo-100 z-0"></div>
                  )}

                  <div
                    onClick={() => setActiveStepId(isSelected ? null : step.id)}
                    onContextMenu={(e) => onContextMenu(e, step)}
                    className={`w-full p-6 rounded-xl border-2 transition-all bg-white shadow-sm hover:shadow-xl cursor-pointer relative z-10 ${isSelected ? 'border-indigo-500 shadow-indigo-100' : 'border-slate-100'}`}
                  >
                    {/* Action Buttons Overlay */}
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <button
                        onClick={(e) => { e.stopPropagation(); onStepSplit?.(step); }}
                        disabled={isSplitting}
                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 shadow-lg transition-all active:scale-95 ${isSplitting ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-indigo-600'}`}
                        title="AI 智能拆分步骤"
                      >
                        {isSplitting ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-scissors"></i>}
                        {isSplitting ? '正在拆分...' : '拆分'}
                      </button>
                    </div>

                    <div className="flex items-start gap-6">
                      {/* Step Number Badge */}
                      <div className="flex flex-col items-center shrink-0">
                        <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center shadow-lg transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white'}`}>
                          <span className="text-[7px] font-black opacity-60 leading-none">STEP</span>
                          <span className="text-lg font-black italic leading-none mt-1">{idx + 1}</span>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex flex-wrap gap-2">
                            <span className={`px-2 py-0.5 rounded-lg border text-[7px] font-black uppercase tracking-widest ${rStyle}`}>
                              <i className="fa-solid fa-shield-halved mr-1"></i> {step.riskLevel || 'Normal'} Risk
                            </span>
                            {validatedDoe && (
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-500 text-white text-[7px] font-black uppercase shadow-sm">
                                <i className="fa-solid fa-flask mr-1"></i> DOE 验证通过
                              </span>
                            )}
                            {step.doeAnchor && (
                              <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-500 border border-indigo-100 text-[7px] font-black uppercase">
                                <i className="fa-solid fa-sliders mr-1"></i> {step.doeAnchor}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className="text-[8px] font-mono text-slate-300 font-bold uppercase pr-8">ID: {step.id?.slice(0, 6) || 'NEW'}</span>
                            {/* Display Key Parameters - Style enhanced per mockup */}
                            {params && (
                              <div className="bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm animate-reveal">
                                <i className="fa-solid fa-microchip text-indigo-400 text-[10px]"></i>
                                <div className="flex gap-2 flex-wrap">
                                  {params.map((p, i) => (
                                    <span key={i} className="text-[9px] font-black text-indigo-700 font-mono whitespace-nowrap flex items-center gap-0.5">
                                      <span className="text-[8px]">{p.icon}</span>{p.value}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <input
                          className="w-full text-lg font-black text-slate-800 leading-tight mb-2 normal-case italic tracking-tighter bg-transparent border-none outline-none focus:bg-slate-50 focus:rounded-lg px-1 transition-colors"
                          value={step.text || ''}
                          placeholder="未命名实验步骤"
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => onStepEdit?.(step.id, { text: e.target.value }, idx)}
                        />

                        <div className="flex flex-col gap-4">
                          <textarea
                            className="w-full text-[11px] text-slate-700 font-bold leading-relaxed italic border-l-2 border-slate-200 pl-4 bg-transparent border-none outline-none focus:bg-slate-50 focus:rounded-r-lg min-h-[40px] resize-none overflow-hidden transition-colors"
                            value={step.description || ''}
                            placeholder="暂无详细操作描述..."
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              onStepEdit?.(step.id, { description: e.target.value }, idx);
                              e.target.style.height = 'inherit';
                              e.target.style.height = `${e.target.scrollHeight}px`;
                            }}
                            ref={(el) => {
                              if (el) {
                                el.style.height = 'inherit';
                                el.style.height = `${el.scrollHeight}px`;
                              }
                            }}
                          />

                          {/* Expanded Alerts/Insights */}
                          <div className="flex flex-col gap-3 mt-1">
                            {step.safetyAlert && (
                              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 w-full shadow-sm">
                                <i className="fa-solid fa-triangle-exclamation text-rose-500 mt-0.5 text-xs"></i>
                                <div className="min-w-0">
                                  <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1">EHS ALERT</p>
                                  <p className="text-[10px] font-bold text-rose-700 leading-snug">{step.safetyAlert}</p>
                                </div>
                              </div>
                            )}
                            {step.scalingInsight && (
                              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-start gap-3 shadow-lg w-full">
                                <i className="fa-solid fa-chart-line text-indigo-400 mt-0.5 text-xs"></i>
                                <div className="min-w-0">
                                  <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">SCALING LOGIC</p>
                                  <p className="text-[10px] font-bold text-slate-300 leading-snug">{step.scalingInsight}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center opacity-40 gap-6">
            <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center shadow-xl border border-slate-100"><i className="fa-solid fa-diagram-project text-3xl text-indigo-600"></i></div>
            <p className="text-[10px] font-black uppercase tracking-[0.4rem] text-slate-800">等待解析工艺流</p>
          </div>
        )}
      </div>
    </div>
  );
};
