
import React, { useState, useEffect } from 'react';
import { PlannedExperiment, MatrixParameter, MatrixRun } from '../../types';
import { generateDOEMatrix } from '../../services/gemini/experiment';
import { useProjectContext } from '../../context/ProjectContext';

interface PlanModalProps {
  show: boolean;
  onClose: () => void;
  onSave: (planData: {
    title: string;
    matrix: MatrixParameter[];
    runs: MatrixRun[];
    notes: string;
    parameters: Record<string, string>;
  }) => void;
  onUpdate?: (updatedPlan: PlannedExperiment) => void;
  editingPlan: PlannedExperiment | null;
  onBackToPlanBoard?: () => void;
}

export const PlanModal: React.FC<PlanModalProps> = ({ 
  show, onClose, onSave, onUpdate, editingPlan, onBackToPlanBoard 
}) => {
  const { setAiStatus, showToast } = useProjectContext();
  const [planTitle, setPlanTitle] = useState('');
  const [matrixParams, setMatrixParams] = useState<MatrixParameter[]>([{ name: '', target: '', range: '' }]);
  const [runs, setRuns] = useState<MatrixRun[]>([]);
  const [planNotes, setPlanNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationAlert, setValidationAlert] = useState<string | null>(null);

  useEffect(() => {
    if (show) {
      if (editingPlan) {
        setPlanTitle(editingPlan.title || '');
        setPlanNotes(editingPlan.notes || '');
        setMatrixParams(editingPlan.matrix?.length ? editingPlan.matrix : [{ name: '', target: '', range: '' }]);
        setRuns(editingPlan.runs || []);
        setValidationAlert(null);
      } else {
        setPlanTitle('');
        setPlanNotes('');
        setMatrixParams([
            { name: '反应温度', target: '℃', range: '120-180' }, 
            { name: '前驱体浓度', target: 'mM', range: '10-50' }
        ]);
        setRuns([]);
        setValidationAlert(null);
      }
    }
  }, [editingPlan, show]);

  const handleAiGenerate = async () => {
    if (!planNotes.trim() || isGenerating) return;
    setIsGenerating(true);
    setAiStatus?.("🧪 正在启动实验矩阵优化算法并进行科学性预审...");
    
    try {
        const result = await generateDOEMatrix(planNotes, matrixParams);
        if (result) {
            if (result.matrix) setMatrixParams(result.matrix);
            if (result.runs) {
                const processedRuns: MatrixRun[] = result.runs.map((r: any, idx: number) => ({
                    idx: r.idx || (idx + 1),
                    params: r.params || {},
                    status: 'pending'
                }));
                setRuns(processedRuns);
            }
            if (result.title) setPlanTitle(result.title);
            if (result.scientificValidation) setValidationAlert(result.scientificValidation);
            showToast({ message: "智能正交表已推演完成", type: 'success' });
        }
    } catch (e) {
        showToast({ message: "生成失败，请检查因子描述", type: 'error' });
    } finally {
        setIsGenerating(false);
        setAiStatus?.(null);
    }
  };

  const addMatrixRow = () => setMatrixParams([...matrixParams, { name: '', target: '', range: '' }]);
  const updateMatrixRow = (idx: number, field: keyof MatrixParameter, value: string) => {
    const newParams = [...matrixParams];
    newParams[idx] = { ...newParams[idx], [field]: value };
    setMatrixParams(newParams);
  };

  // --- 新增：手动管理 Runs 逻辑 ---
  const handleAddRun = () => {
      const nextIdx = runs.length + 1;
      const initialParams: Record<string, string> = {};
      matrixParams.forEach(p => {
          if (p.name) initialParams[p.name] = '';
      });
      setRuns([...runs, { idx: nextIdx, params: initialParams, status: 'pending' }]);
  };

  const handleUpdateRunParam = (runIdx: number, paramName: string, value: string) => {
      setRuns(prev => prev.map((run, i) => 
          i === runIdx ? { ...run, params: { ...run.params, [paramName]: value } } : run
      ));
  };

  const handleRemoveRun = (idx: number) => {
      setRuns(prev => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, idx: i + 1 })));
  };

  const handleConfirmSave = () => {
    onSave({
      title: planTitle,
      matrix: matrixParams.filter(p => p.name.trim() !== ''),
      runs,
      notes: planNotes,
      parameters: {} 
    });
  };

  const handleUpdateCurrent = () => {
      if (!editingPlan || !onUpdate) return;
      onUpdate({
          ...editingPlan,
          title: planTitle,
          matrix: matrixParams.filter(p => p.name.trim() !== ''),
          runs,
          notes: planNotes
      });
  };

  if (!show) return null;

  // 提取当前有效的参数名列表，用于渲染表头
  const activeParamNames = matrixParams.filter(p => p.name.trim() !== '').map(p => p.name);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1200] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl rounded-[2.5rem] p-6 lg:p-8 animate-reveal shadow-2xl relative border border-slate-200 max-h-[95vh] flex flex-col overflow-hidden">
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-rose-500 transition-all active:scale-90 z-10"><i className="fa-solid fa-times text-xl"></i></button>
        
        <header className="mb-6 shrink-0 flex flex-col md:flex-row justify-between items-center pr-10 gap-4">
          <div className="flex items-center gap-3">
            {onBackToPlanBoard && (
                <button 
                    onClick={onBackToPlanBoard}
                    className="mr-4 px-5 py-2.5 bg-amber-500 text-white rounded-xl text-[11px] font-black uppercase hover:bg-black transition-all flex items-center gap-2 shadow-lg shadow-amber-200/50 animate-bounce-subtle"
                >
                    <i className="fa-solid fa-arrow-left-long"></i> 返回周计划
                </button>
            )}
            <div className="w-1.5 h-6 bg-indigo-600 rounded-sm"></div>
            <h3 className="text-xl lg:text-2xl font-black text-slate-800 uppercase tracking-tighter italic leading-none">
                实验矩阵设计
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            {editingPlan && (
                <button 
                  onClick={handleUpdateCurrent}
                  className="px-6 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all active:scale-95 shadow-sm"
                >
                    更新修订
                </button>
            )}
            <button 
                onClick={handleAiGenerate}
                disabled={isGenerating || !planNotes.trim()}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-600 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
            >
                {isGenerating ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                AI 智能推演
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-1 space-y-6 mb-4 pr-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Column: Design Intent & Variables */}
            <div className="lg:col-span-5 space-y-6">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner group">
                    <div className="flex justify-between items-center mb-2.5 px-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block px-1">设计意图 (INTENT)</label>
                        <i className="fa-solid fa-brain text-indigo-200"></i>
                    </div>
                    <textarea 
                        className="w-full bg-white border border-slate-200 rounded-xl p-4 text-[12px] font-bold outline-none h-28 resize-none shadow-sm focus:border-indigo-400 transition-all italic leading-relaxed" 
                        placeholder="在此输入实验目标，例如：优化反应温度对产率的影响..." 
                        value={planNotes} 
                        onChange={e => setPlanNotes(e.target.value)} 
                    />
                </div>
                
                <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase mb-3 block px-1 tracking-widest italic">定义实验因子 (FACTORS)</label>
                    <div className="space-y-1.5">
                        {matrixParams.map((p, i) => (
                            <div key={i} className="flex gap-2 items-center bg-white p-2 rounded-xl border border-slate-100 group shadow-sm hover:border-indigo-300 transition-all">
                                <div className="flex-1 grid grid-cols-3 gap-2">
                                    <input className="bg-slate-50 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-700 outline-none border border-transparent focus:border-indigo-200 uppercase" placeholder="变量名" value={p.name} onChange={e => updateMatrixRow(i, 'name', e.target.value)} />
                                    <input className="bg-slate-50 rounded-lg px-3 py-1.5 text-[11px] font-black text-indigo-600 outline-none border border-transparent focus:border-indigo-200 text-center" placeholder="量程" value={p.range || ''} onChange={e => updateMatrixRow(i, 'range', e.target.value)} />
                                    <input className="bg-slate-50 rounded-lg px-3 py-1.5 text-[11px] font-black text-slate-400 outline-none border border-transparent focus:border-indigo-200 text-center" placeholder="单位" value={p.target || ''} onChange={e => updateMatrixRow(i, 'target', e.target.value)} />
                                </div>
                                <button onClick={() => setMatrixParams(matrixParams.filter((_, idx)=>idx!==i))} className="w-8 h-8 rounded-lg text-rose-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center shrink-0">
                                    <i className="fa-solid fa-trash-can text-sm"></i>
                                </button>
                            </div>
                        ))}
                        <button onClick={addMatrixRow} className="w-full py-2.5 border border-dashed border-slate-300 rounded-xl text-[10px] font-black text-slate-400 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                            <i className="fa-solid fa-plus"></i> 新增变量因子
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Column: Execution List (Matrix Runs) - Updated to Light Theme */}
            <div className="lg:col-span-7 flex flex-col bg-white rounded-[2rem] p-5 border border-slate-200 text-slate-800 relative overflow-hidden shadow-md min-h-[400px]">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none text-slate-800"><i className="fa-solid fa-table-cells text-7xl"></i></div>
                <div className="flex justify-between items-center mb-4 relative z-10">
                    <div className="flex flex-col">
                        <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest italic">矩阵运行清单 (RUN SHEETS)</h4>
                        <p className="text-[7px] text-slate-400 uppercase mt-0.5 font-bold">可手动录入多组对比参数数据</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {runs.length > 0 && <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-100">{runs.length} Runs</span>}
                        <button 
                            onClick={handleAddRun}
                            disabled={activeParamNames.length === 0}
                            className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-600 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1.5 disabled:opacity-30 shadow-sm"
                        >
                            <i className="fa-solid fa-plus-circle"></i> 新增实验行
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-auto custom-scrollbar relative z-10 pr-1 border border-slate-100 rounded-xl bg-slate-50 shadow-inner">
                    {runs.length > 0 ? (
                        <table className="w-full text-left text-[11px] border-collapse">
                            <thead className="sticky top-0 bg-slate-50 z-20">
                                <tr className="border-b border-slate-200 text-slate-400 uppercase font-black bg-slate-50">
                                    <th className="py-3 pr-2 w-10 text-center">#</th>
                                    {activeParamNames.map(name => (
                                        <th key={name} className="py-3 pr-2 text-center truncate max-w-[100px]">{name}</th>
                                    ))}
                                    <th className="py-3 pr-2 w-10 text-center"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {runs.map((run, rIdx) => (
                                    <tr key={rIdx} className="border-b border-slate-100 hover:bg-white transition-colors group/row">
                                        <td className="py-3 pr-2 font-mono opacity-40 text-center text-slate-600">{run.idx}</td>
                                        {activeParamNames.map((name) => (
                                            <td key={name} className="py-1 px-1">
                                                <input 
                                                    className="w-full bg-white border border-transparent focus:border-indigo-500 focus:bg-white focus:text-slate-900 rounded-lg py-2 px-1 text-center font-black text-indigo-600 font-mono transition-all outline-none italic shadow-sm"
                                                    value={run.params[name] || ''}
                                                    onChange={(e) => handleUpdateRunParam(rIdx, name, e.target.value)}
                                                    placeholder="--"
                                                />
                                            </td>
                                        ))}
                                        <td className="py-3 text-center">
                                            <button 
                                                onClick={() => handleRemoveRun(rIdx)}
                                                className="text-rose-500/30 hover:text-rose-500 opacity-0 group-hover/row:opacity-100 transition-all"
                                            >
                                                <i className="fa-solid fa-times"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center py-20 gap-4 text-slate-300">
                            <i className="fa-solid fa-calculator text-5xl animate-pulse"></i>
                            <p className="font-black uppercase tracking-widest text-sm">等待 AI 推演或手动录入数据</p>
                        </div>
                    )}
                </div>

                {validationAlert && (
                    <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 animate-reveal relative z-10 shadow-sm">
                        <i className="fa-solid fa-triangle-exclamation text-rose-500 mt-1"></i>
                        <div className="min-w-0">
                            <p className="text-[8px] font-black text-rose-500 uppercase mb-1 tracking-widest">安全审计预警</p>
                            <p className="text-[11px] font-bold text-rose-800 leading-relaxed italic text-justify">{validationAlert}</p>
                        </div>
                    </div>
                )}
            </div>
          </div>
          
          <div className="pt-2">
            <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block px-1 tracking-widest italic">矩阵正式标题 (PLAN TITLE)</label>
            <input className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-base font-black text-indigo-700 outline-none shadow-inner focus:border-indigo-400 transition-all uppercase italic" placeholder="例如：L9正交矩阵 - 活性位点优化..." value={planTitle} onChange={e => setPlanTitle(e.target.value)} />
          </div>
        </div>

        <footer className="shrink-0 flex gap-4 pt-4 border-t border-slate-100 bg-white z-20">
          <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase border border-slate-200 hover:bg-slate-100 transition-all">关闭</button>
          {!editingPlan && (
            <button onClick={handleConfirmSave} disabled={!planTitle.trim() || runs.length === 0} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-black transition-all disabled:opacity-30">
                发布实验矩阵并锁定执行
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};
