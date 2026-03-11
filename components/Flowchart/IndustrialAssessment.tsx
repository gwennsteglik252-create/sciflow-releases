
import React, { useMemo, useState } from 'react';
import { SavedFlowchart } from '../../types';
import { useProjectContext } from '../../context/ProjectContext';

interface IndustrialAssessmentProps {
  flowchart: SavedFlowchart | null;
  onBOMEdit: (materialId: string, field: 'name' | 'amount' | 'price' | 'unit', value: string) => void;
  onAddMaterial?: () => void;
  onDeleteMaterial?: (materialName: string) => void;
  // Financial state uplifted from parent for export support
  productionValue: number;
  setProductionValue: (val: number) => void;
  unitLabel: '克' | '批次';
  setUnitLabel: (val: '克' | '批次') => void;
  includeMaterialCost: boolean;
  setIncludeMaterialCost: (val: boolean) => void;
  includeOperationCost: boolean;
  setIncludeOperationCost: (val: boolean) => void;
}

export const IndustrialAssessment: React.FC<IndustrialAssessmentProps> = ({
  flowchart, onBOMEdit, onAddMaterial, onDeleteMaterial,
  productionValue, setProductionValue, unitLabel, setUnitLabel,
  includeMaterialCost, setIncludeMaterialCost, includeOperationCost, setIncludeOperationCost
}) => {
  const { activeTheme } = useProjectContext();
  const isLight = activeTheme.type === 'light';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);

  const aggregatedData = useMemo(() => {
    if (!flowchart || !Array.isArray(flowchart.steps)) return { materials: [], operations: [] };

    const matMap: Record<string, any> = {};
    const opMap: Record<string, any> = {};

    flowchart.steps.forEach(step => {
      if (step.bomItems && Array.isArray(step.bomItems)) {
        step.bomItems.forEach(item => {
          if (!item.name) return;
          const key = item.name.trim();
          const amountStr = String(item.amount || '0').replace(/[^0-9.]/g, '');
          const numericAmount = parseFloat(amountStr) || 0;
          const parsedCost = parseFloat(item.estimatedCost as any);
          const unitPrice = !isNaN(parsedCost) ? parsedCost : 0;
          const totalItemCost = numericAmount * unitPrice;

          const isOperationalSymbol = /机|泵|炉|仪|反应釜|离心|超声|天平|烘箱|搅拌|干燥箱|烧杯|量筒|烧瓶|试管|皿|瓶|漏斗|移液|磁子|陶瓷舟|坩埚|电|水费|气|燃料|能耗|能源|负载|显微镜|电化学工作站/.test(key);
          const isChemical = /硝酸|硫酸|盐|水|溶液|试剂|金属|粉|膜|纸|塞|药品|乙醇|催化剂|载体/.test(key);
          const finalIsOp = isOperationalSymbol && !isChemical;

          const targetMap = finalIsOp ? opMap : matMap;

          if (targetMap[key]) {
            targetMap[key].amount += numericAmount;
            targetMap[key].cost += totalItemCost;
          } else {
            targetMap[key] = {
              name: key,
              unit: (item.unit || '').trim(),
              amount: numericAmount,
              price: unitPrice,
              cost: totalItemCost,
              isOp: finalIsOp
            };
          }
        });
      }
    });
    return {
      materials: Object.values(matMap),
      operations: Object.values(opMap)
    };
  }, [flowchart]);

  const matTotalBase = useMemo(() => aggregatedData.materials.reduce((acc, item) => acc + (item.cost || 0), 0), [aggregatedData]);
  const opTotalBase = useMemo(() => aggregatedData.operations.reduce((acc, item) => acc + (item.cost || 0), 0), [aggregatedData]);

  const scaleDiscount = useMemo(() => {
    if (productionValue <= 1) return 1.0;
    const discount = 1 - (Math.log10(productionValue) * 0.15);
    return Math.max(0.5, discount);
  }, [productionValue]);

  // Conditional calculation based on toggle state
  const totalMaterialCost = includeMaterialCost ? matTotalBase * scaleDiscount * productionValue : 0;
  const totalOperationCost = includeOperationCost ? opTotalBase * productionValue : 0;
  const totalScaledCost = totalMaterialCost + totalOperationCost;

  const costPerUnit = totalScaledCost / (productionValue || 1);

  const allItems = [...aggregatedData.materials, ...aggregatedData.operations];

  return (
    <div className="w-64 lg:w-72 shrink-0 flex flex-col h-full no-print">
      <div className={`flex-1 rounded-[2rem] p-4 flex flex-col shadow-2xl overflow-hidden transition-colors duration-300 ${isLight ? 'bg-white/95 border border-slate-200 text-slate-800' : 'bg-slate-900 border border-white/5 text-white'}`}>
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <i className="fa-solid fa-industry text-[10px]"></i>
          </div>
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-widest leading-none">工业成本评估库</h4>
            <p className={`text-[6px] font-bold uppercase mt-0.5 tracking-tighter ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Scale-up & Economy of Scale</p>
          </div>
        </div>

        <div className="space-y-3 flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar pr-1">
          {/* Production Cost Dashboard with Toggles */}
          <section className="bg-indigo-600/90 rounded-2xl p-3.5 shadow-xl relative overflow-hidden shrink-0 border border-white/10 text-white">
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-2.5">
                <p className="text-[10px] font-black text-white/70 uppercase tracking-tighter">成本预测 ({productionValue} {unitLabel})</p>
                <div className="flex items-center gap-1 bg-black/20 p-0.5 rounded-lg">
                  <input
                    type="number"
                    min="1"
                    className="bg-transparent border-none outline-none text-[11px] font-black text-white w-10 text-center"
                    value={productionValue}
                    onChange={(e) => setProductionValue(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <button
                    onClick={() => setUnitLabel(unitLabel === '批次' ? '克' : '批次')}
                    className="text-[6px] font-black bg-white/10 px-1 py-0.5 rounded text-indigo-100 hover:bg-white/20 transition-all mr-0.5"
                  >
                    {unitLabel}
                  </button>
                </div>
              </div>

              <div className="space-y-2 border-t border-white/10 pt-2.5">
                <div className={`flex justify-between items-end transition-opacity duration-300 ${includeMaterialCost ? 'opacity-100' : 'opacity-30'}`}>
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setIncludeMaterialCost(!includeMaterialCost)}
                        className={`w-5 h-3 rounded-full relative transition-colors duration-300 ${includeMaterialCost ? 'bg-indigo-400' : 'bg-slate-600'}`}
                      >
                        <div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-transform duration-300 ${includeMaterialCost ? 'left-2.5' : 'left-0.5'}`} />
                      </button>
                      <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">化学物料</span>
                    </div>
                    <span className={`text-[8px] font-bold px-1 rounded inline-block mt-0.5 w-fit ${scaleDiscount < 1 && includeMaterialCost ? 'bg-emerald-400 text-slate-900' : 'text-indigo-300'}`}>
                      {includeMaterialCost ? (scaleDiscount < 1 ? `折扣: ${((1 - scaleDiscount) * 100).toFixed(1)}% OFF` : '原价') : '不计入'}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold">¥{totalMaterialCost.toFixed(2)}</p>
                </div>

                <div className={`flex justify-between items-end transition-opacity duration-300 ${includeOperationCost ? 'opacity-100' : 'opacity-30'}`}>
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setIncludeOperationCost(!includeOperationCost)}
                        className={`w-5 h-3 rounded-full relative transition-colors duration-300 ${includeOperationCost ? 'bg-amber-400' : 'bg-slate-600'}`}
                      >
                        <div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-transform duration-300 ${includeOperationCost ? 'left-2.5' : 'left-0.5'}`} />
                      </button>
                      <span className="text-[10px] font-black text-amber-300 uppercase tracking-widest">运营/能源/折旧</span>
                    </div>
                    <span className="text-[8px] text-amber-400 italic mt-0.5">{includeOperationCost ? '线性叠加' : '不计入'}</span>
                  </div>
                  <p className="text-[11px] font-bold">¥{totalOperationCost.toFixed(2)}</p>
                </div>

                <div className="flex justify-between items-end pt-1.5 border-t border-white/5 mt-1">
                  <p className="text-[10px] font-black text-white uppercase italic">预估总投入 (TOTAL)</p>
                  <p className="text-lg font-black text-emerald-400 italic">¥{totalScaledCost.toFixed(1)}</p>
                </div>
              </div>

              <div className="mt-2.5 flex justify-between items-center bg-black/20 p-2 rounded-xl border border-white/5">
                <p className="text-[9px] font-bold text-indigo-100 opacity-60 uppercase">单位成本 (每{unitLabel})</p>
                <p className="text-[12px] font-black text-white font-mono">¥{costPerUnit.toFixed(2)}</p>
              </div>
            </div>
          </section>

          {/* BOM Breakdown */}
          <section className="flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-1.5 px-1">
              <p className={`text-[7px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}>
                <i className="fa-solid fa-list-check"></i> 物料清单明细
              </p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setIsModalOpen(true)} className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] hover:bg-indigo-600 hover:text-white transition-all shadow-sm ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-white'}`}><i className="fa-solid fa-pen"></i></button>
                <button onClick={onAddMaterial} className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-[8px] hover:bg-white hover:text-indigo-600 transition-all shadow-lg text-white"><i className="fa-solid fa-plus"></i></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
              {flowchart && allItems.length > 0 ? allItems.map((item, idx) => {
                const currentEffectivePrice = item.isOp ? item.price : (item.price * scaleDiscount);
                const currentTotal = currentEffectivePrice * item.amount * productionValue;
                const isDisabled = (item.isOp && !includeOperationCost) || (!item.isOp && !includeMaterialCost);

                return (
                  <div key={idx} className={`p-2.5 rounded-xl border transition-all group relative overflow-hidden ${isDisabled ? 'opacity-25 grayscale' : ''} ${item.isOp ? (isLight ? 'bg-amber-50 border-amber-200' : 'border-amber-500/20 bg-amber-500/5') : (isLight ? 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-sm' : 'border-white/5 bg-white/5 hover:bg-white/10')}`}>
                    {item.isOp && <div className="absolute -left-1 top-0 bottom-0 w-1 bg-amber-500 opacity-60"></div>}
                    <button onClick={() => onDeleteMaterial?.(item.name)} className="absolute -right-2 -top-2 w-5 h-5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-md flex items-center justify-center active:scale-90 z-20"><i className="fa-solid fa-times text-[8px]"></i></button>
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex flex-col flex-1 min-w-0">
                        <input className={`bg-transparent border-none text-[8px] font-black outline-none w-full italic focus:text-current ${item.isOp ? (isLight ? 'text-amber-700' : 'text-amber-200') : (isLight ? 'text-slate-700' : 'text-slate-300')}`} value={item.name} onChange={(e) => onBOMEdit(item.name, 'name', e.target.value)} />
                        <span className={`text-[5px] font-black uppercase tracking-tighter mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          {item.isOp ? '运营分摊' : '物料消耗'}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <span className={`text-[6px] font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>¥</span>
                        <input type="number" step="0.01" className={`w-16 rounded-lg px-1 py-0.5 text-[8px] font-black text-emerald-400 font-mono outline-none border border-transparent ${isLight ? 'bg-white border-slate-100 text-emerald-600' : 'bg-slate-800/50'}`} value={currentEffectivePrice.toFixed(4)} onChange={(e) => onBOMEdit(item.name, 'price', (parseFloat(e.target.value) / (item.isOp ? 1 : scaleDiscount)).toString())} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className={`flex items-center gap-1 text-[6px] font-bold uppercase ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        <span>用量:</span>
                        <p className={`text-[8px] font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{(item.amount * productionValue).toFixed(2)}</p>
                        <span>{item.unit}</span>
                      </div>
                      <p className={`text-[8px] font-black opacity-60 group-hover:opacity-100 transition-opacity ${item.isOp ? (isLight ? 'text-amber-600' : 'text-amber-400') : (isLight ? 'text-indigo-600' : 'text-indigo-300')}`}>¥{currentTotal.toFixed(2)}</p>
                    </div>
                  </div>
                );
              }) : (
                <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-10"><i className="fa-solid fa-industry text-2xl"></i></div>
              )}
            </div>
          </section>

          <div className={`mt-auto pt-1.5 border-t px-1 space-y-1 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
            <div
              className="flex justify-between items-center cursor-pointer group/note"
              onClick={() => setIsNoteExpanded(!isNoteExpanded)}
            >
              <p className={`text-[8px] font-black uppercase tracking-widest italic leading-relaxed transition-colors ${isLight ? 'text-slate-400 group-hover/note:text-indigo-500' : 'text-slate-400 group-hover/note:text-indigo-400'}`}>* 规模效应审计准则 (含大宗折扣)</p>
              <i className={`fa-solid ${isNoteExpanded ? 'fa-chevron-down' : 'fa-chevron-up'} text-[5px] transition-transform duration-300 ${isLight ? 'text-slate-400' : 'text-slate-600'}`}></i>
            </div>

            {isNoteExpanded && (
              <div className="animate-reveal space-y-1 mt-0.5">
                <p className={`text-[8px] italic leading-tight ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>1. 【物料降本】：自动模拟大宗采购。产量每提升一个量级，物料单价下降约 15%。</p>
                <p className={`text-[8px] italic leading-tight ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>2. 【固定资产】：设备与能耗归为运营成本，不计入大宗折扣。</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl h-[80vh] rounded-[3rem] p-10 animate-reveal shadow-2xl relative border-4 border-white flex flex-col text-slate-800">
            <header className="flex justify-between items-center mb-8 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl"><i className="fa-solid fa-table-list text-xl"></i></div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">BOM 全球审计编辑器</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">内置物料规模降本系数引擎 v3.5</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"><i className="fa-solid fa-times"></i></button>
            </header>

            <div className="flex-1 overflow-auto custom-scrollbar border border-slate-100 rounded-[2rem] bg-slate-50/30">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-900 text-white z-10">
                  <tr>
                    <th className="p-5 text-[10px] font-black uppercase tracking-widest border-r border-white/10">科目名称 (物料分类)</th>
                    <th className="p-5 text-[10px] font-black uppercase tracking-widest border-r border-white/10 w-24">单位</th>
                    <th className="p-5 text-[10px] font-black uppercase tracking-widest border-r border-white/10 w-48">基准单价 (¥)</th>
                    <th className="p-5 text-[10px] font-black uppercase tracking-widest border-r border-white/10 w-48">单批用量 (Base)</th>
                    <th className="p-5 text-[10px] font-black uppercase tracking-widest w-24 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {allItems.map((item, idx) => (
                    <tr key={idx} className={`border-b border-slate-100 group transition-colors ${item.isOp ? 'bg-amber-50/10 hover:bg-amber-50/30' : 'hover:bg-indigo-50/30'}`}>
                      <td className="p-4 border-r border-slate-100">
                        <div className="flex flex-col">
                          <input className={`w-full bg-transparent border-none text-[12px] font-black outline-none italic ${item.isOp ? 'text-amber-700' : 'text-slate-800'}`} value={item.name} onChange={(e) => onBOMEdit(item.name, 'name', e.target.value)} />
                          <span className={`text-[7px] font-black uppercase tracking-widest mt-1 ${item.isOp ? 'text-amber-600' : 'text-indigo-400'}`}>
                            {item.isOp ? <><i className="fa-solid fa-bolt-lightning mr-1"></i> 固定运营分摊</> : <><i className="fa-solid fa-box mr-1"></i> 享受大宗折扣</>}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 border-r border-slate-100"><input className="w-full bg-transparent border-none text-[12px] font-black text-slate-400 outline-none text-center" value={item.unit} onChange={(e) => onBOMEdit(item.name, 'unit', e.target.value)} /></td>
                      <td className="p-4 border-r border-slate-100"><div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100"><span className="text-[10px] font-black text-slate-300">¥</span><input type="number" step="0.01" className="w-full bg-transparent border-none text-[13px] font-black text-emerald-600 font-mono outline-none" value={item.price} onChange={(e) => onBOMEdit(item.name, 'price', e.target.value)} /></div></td>
                      <td className="p-4 border-r border-slate-100"><div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100"><input type="number" step="0.01" className="w-full bg-transparent border-none text-[13px] font-black text-indigo-600 font-mono outline-none" value={item.amount} onChange={(e) => onBOMEdit(item.name, 'amount', e.target.value)} /><span className="text-[10px] font-black text-slate-300">{item.unit}</span></div></td>
                      <td className="p-4 text-center"><button onClick={() => onDeleteMaterial?.(item.name)} className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center active:scale-90"><i className="fa-solid fa-trash-can text-sm"></i></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className="mt-8 shrink-0 flex justify-between items-center">
              <p className="text-[10px] font-black text-slate-400 uppercase italic">* 系统将根据您主界面设定的规模 {productionValue}x 自动计算阶梯折扣并展示最终单价。</p>
              <div className="flex gap-4">
                <button onClick={onAddMaterial} className="px-8 py-3 bg-white text-indigo-600 border-2 border-indigo-600 rounded-2xl text-[10px] font-black uppercase hover:bg-indigo-50 flex items-center gap-2"><i className="fa-solid fa-plus"></i> 添加新科目</button>
                <button onClick={() => setIsModalOpen(false)} className="px-10 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-indigo-600 transition-all active:scale-95">确认审计变更</button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};
