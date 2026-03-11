
import React from 'react';
import { TheoreticalDescriptors } from '../../services/gemini';

interface MechanismParametersProps {
    pH: number;
    potential: number;
    reactionMode: 'HER' | 'OER' | 'ORR' | 'BIFUNCTIONAL';
    material: string;
    unitCellType: string;
    dopingElement: string;
    dopingConcentration: number;
    coDopingElement?: string;
    coDopingConcentration?: number;
    updateMechanismSession: (updates: any) => void;
    measuredPoint: { v: string, j: string };
    setMeasuredPoint: (pt: { v: string, j: string }) => void;
    isOperatingExpanded: boolean;
    setIsOperatingExpanded: (exp: boolean) => void;
    isDopingExpanded: boolean;
    setIsDopingExpanded: (exp: boolean) => void;
    isBenchmarkExpanded: boolean;
    setIsBenchmarkExpanded: (exp: boolean) => void;
    stabilityPrediction: any;
    morphologyLink: any;
    isStableAnalysis: boolean;
}

const MechanismParameters: React.FC<MechanismParametersProps> = ({
    pH, potential, reactionMode,
    material, unitCellType, dopingElement, dopingConcentration, coDopingElement, coDopingConcentration, updateMechanismSession,
    measuredPoint, setMeasuredPoint,
    isOperatingExpanded, setIsOperatingExpanded,
    isDopingExpanded, setIsDopingExpanded,
    isBenchmarkExpanded, setIsBenchmarkExpanded,
    stabilityPrediction, morphologyLink,
    isStableAnalysis
}) => {
    return (
        <div className="h-full flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1 min-h-0">

            {morphologyLink && (
                <div className="p-4 rounded-[2rem] shadow-sm shrink-0 border border-indigo-200/50 bg-indigo-50/50 animate-reveal">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0">
                            <i className={`fa-solid ${morphologyLink.type === 'sheet' ? 'fa-layer-group' : morphologyLink.type === 'defect' ? 'fa-virus' : 'fa-braille'} text-xs`}></i>
                        </div>
                        <div>
                            <h5 className="text-[10px] font-black text-indigo-800 uppercase tracking-widest leading-none">Vision Linked</h5>
                            <p className="text-[9px] text-indigo-500 font-medium">Synced from Data Laboratory</p>
                        </div>
                    </div>
                    <div className="flex justify-between items-center bg-white/60 p-2 rounded-xl border border-indigo-100">
                        <span className="text-[9px] font-bold text-slate-500 uppercase">
                            {morphologyLink.type === 'sheet' ? 'Porosity' : morphologyLink.type === 'defect' ? 'Defect Density' : 'Diameter'}
                        </span>
                        <span className="text-[12px] font-black text-indigo-600 font-mono">
                            {morphologyLink.value.toFixed(1)} {morphologyLink.type === 'sheet' || morphologyLink.type === 'defect' ? '%' : 'nm'}
                        </span>
                    </div>
                </div>
            )}

            {/* Operating Conditions Section */}
            <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm space-y-4 shrink-0 transition-all duration-300">
                <div className="flex justify-between items-center cursor-pointer group" onClick={() => setIsOperatingExpanded(!isOperatingExpanded)}>
                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-sliders text-indigo-500"></i> 工况设置 (OPERATING)
                    </h4>
                    <i className={`fa-solid ${isOperatingExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-slate-400 text-xs transition-transform duration-300`}></i>
                </div>
                {isOperatingExpanded && (
                    <div className="space-y-4 animate-reveal">
                        <div>
                            <label className="block text-[8px] font-black text-slate-500 uppercase mb-1.5 px-1">反应模式 (REACTION)</label>
                            <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
                                <button onClick={() => updateMechanismSession({ reactionMode: 'OER' })} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${reactionMode === 'OER' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>OER</button>
                                <button onClick={() => updateMechanismSession({ reactionMode: 'HER' })} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${reactionMode === 'HER' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>HER</button>
                                <button onClick={() => updateMechanismSession({ reactionMode: 'ORR' })} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${reactionMode === 'ORR' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>ORR</button>
                                <button onClick={() => updateMechanismSession({ reactionMode: 'BIFUNCTIONAL' })} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${reactionMode === 'BIFUNCTIONAL' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>Bi-Fun</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[8px] font-black text-slate-500 uppercase mb-1.5 px-1">环境 pH 值</label>
                                <input type="number" step="0.1" value={pH} onChange={e => updateMechanismSession({ pH: parseFloat(e.target.value) })} className="w-full bg-slate-50 rounded-xl p-3 text-[11px] font-bold outline-none border border-slate-100 focus:border-indigo-300 transition-colors h-10" />
                            </div>
                            <div>
                                <label className="block text-[8px] font-black text-slate-500 uppercase mb-1.5 px-1">外加电势 (V)</label>
                                <input type="number" step="0.01" value={potential} onChange={e => updateMechanismSession({ potential: parseFloat(e.target.value) })} className="w-full bg-slate-50 rounded-xl p-3 text-[11px] font-bold outline-none border border-slate-100 focus:border-indigo-300 transition-colors h-10" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Material Engineering Section */}
            <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm space-y-5 shrink-0 transition-all duration-300">
                <div className="flex justify-between items-center cursor-pointer group" onClick={() => setIsDopingExpanded(!isDopingExpanded)}>
                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><i className="fa-solid fa-vial-circle-check text-violet-600"></i> 材料工程 (DOPING)</h4>
                    <i className={`fa-solid ${isDopingExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-slate-400 text-xs transition-transform duration-300`}></i>
                </div>
                {isDopingExpanded && (
                    <div className="space-y-4 animate-reveal">
                        <div>
                            <label className="block text-[8px] font-black text-slate-500 uppercase mb-1.5 px-1">基座材料 Substrate</label>
                            <select
                                className="w-full bg-slate-100 rounded-xl px-3 text-[11px] font-bold outline-none cursor-pointer h-10"
                                value={material}
                                onChange={e => {
                                    const newMat = e.target.value;
                                    const config = (TheoreticalDescriptors as any)[newMat];
                                    const updates: any = { material: newMat };
                                    if (config?.defaultUnitCell) {
                                        updates.unitCellType = config.defaultUnitCell;
                                    }
                                    updateMechanismSession(updates);
                                }}
                            >
                                {Array.from(new Set(Object.values(TheoreticalDescriptors).map(d => (d as any).category))).map(cat => (
                                    <optgroup key={cat as string} label={cat as string}>
                                        {Object.entries(TheoreticalDescriptors)
                                            .filter(([_, d]) => (d as any).category === cat)
                                            .map(([name, _]) => <option key={name} value={name}>{name}</option>)}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[8px] font-black text-indigo-500 uppercase mb-1.5 px-1 flex justify-between">
                                <span>晶胞类型 (UNIT CELL)</span>
                                <span className="text-[6px] text-emerald-500 lowercase italic">Auto-matched to material</span>
                            </label>
                            <select className="w-full bg-indigo-50/50 border border-indigo-100 rounded-xl px-3 text-[11px] font-bold outline-none cursor-pointer h-10" value={unitCellType} onChange={e => updateMechanismSession({ unitCellType: e.target.value })}>
                                <option value="Layered (LDH)">LDH 层状结构 (2D)</option>
                                <option value="MOF (Porous Framework)">MOF (多孔框架)</option>
                                <option value="SAC (Carbon Framework)">SAC (多孔碳骨架)</option>
                                <option value="Simple Cubic">Simple Cubic</option>
                                <option value="BCC (体心立方)">BCC (体心立方)</option>
                                <option value="FCC (面心立方)">FCC (面心立方)</option>
                                <option value="Rutile">金红石 (Rutile)</option>
                                <option value="Perovskite">钙钛矿 (Perovskite)</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[8px] font-black text-indigo-500 uppercase mb-1.5 px-1">掺杂元素 1</label>
                                <select className="w-full bg-indigo-50 rounded-xl px-3 text-[11px] font-bold outline-none cursor-pointer h-10" value={dopingElement} onChange={e => updateMechanismSession({ dopingElement: e.target.value })}>
                                    {['Ag', 'Pt', 'Pd', 'Cu', 'Au', 'Fe', 'Ni', 'Co', 'V', 'W', 'Mo', 'Ru', 'Ir', 'Ce', 'S', 'P'].map(el => <option key={el} value={el}>{el}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[8px] font-black text-indigo-500 uppercase mb-1.5 px-1">浓度 1 (%)</label>
                                <input type="number" step="0.5" value={dopingConcentration} onChange={e => updateMechanismSession({ dopingConcentration: parseFloat(e.target.value) })} className="w-full bg-indigo-50 rounded-xl px-3 text-[11px] font-bold outline-none h-10" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[8px] font-black text-indigo-500 uppercase mb-1.5 px-1">掺杂元素 2 (可选)</label>
                                <select className="w-full bg-indigo-50 rounded-xl px-3 text-[11px] font-bold outline-none cursor-pointer h-10" value={coDopingElement || 'None'} onChange={e => updateMechanismSession({ coDopingElement: e.target.value })}>
                                    <option value="None">无 (None)</option>
                                    {['Ag', 'Pt', 'Pd', 'Cu', 'Au', 'Fe', 'Ni', 'Co', 'V', 'W', 'Mo', 'Ru', 'Ir', 'Ce', 'S', 'P'].map(el => <option key={el} value={el}>{el}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[8px] font-black text-indigo-500 uppercase mb-1.5 px-1">浓度 2 (%)</label>
                                <input type="number" step="0.5" min="0" disabled={!coDopingElement || coDopingElement === 'None'} value={coDopingConcentration || 0} onChange={e => updateMechanismSession({ coDopingConcentration: parseFloat(e.target.value) })} className="w-full bg-indigo-50 rounded-xl px-3 text-[11px] font-bold outline-none h-10 disabled:opacity-50" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Benchmark Section */}
            <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm space-y-4 shrink-0 transition-all duration-300 relative">
                <div className="flex justify-between items-center cursor-pointer group" onClick={() => setIsBenchmarkExpanded(!isBenchmarkExpanded)}>
                    <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><i className="fa-solid fa-crosshairs text-rose-500"></i> LSV 实测对标 (BENCHMARK)</h4>
                    <i className={`fa-solid ${isBenchmarkExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-slate-400 text-xs transition-transform duration-300`}></i>
                </div>
                {isBenchmarkExpanded && (
                    <div className="animate-reveal space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-[8px] font-black text-slate-500 uppercase mb-1.5 px-1">电压 (V)</label><input className="w-full bg-slate-100 rounded-xl p-3 text-[11px] font-bold outline-none text-rose-600 h-10" placeholder="e.g. 1.6" value={measuredPoint.v} onChange={e => setMeasuredPoint({ ...measuredPoint, v: e.target.value })} /></div>
                            <div><label className="block text-[8px] font-black text-slate-500 uppercase mb-1.5 px-1">实测电流 (mA)</label><input className="w-full bg-slate-100 rounded-xl p-3 text-[11px] font-bold outline-none text-rose-600 h-10" placeholder="e.g. 500" value={measuredPoint.j} onChange={e => setMeasuredPoint({ ...measuredPoint, j: e.target.value })} /></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Stability Prediction Section - 精准化升级 */}
            <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm space-y-4 shrink-0 mb-4">
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><i className="fa-solid fa-shield-halved text-emerald-600"></i> 电化学稳定性解算</h4>
                {stabilityPrediction ? (
                    <div className="animate-reveal space-y-3">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <span className={`text-2xl font-black leading-none ${stabilityPrediction.safetyIndex >= 8 ? 'text-emerald-500' : stabilityPrediction.safetyIndex >= 5 ? 'text-amber-500' : 'text-rose-500'}`}>
                                    {stabilityPrediction.safetyIndex.toFixed(2)} <span className="text-[10px] text-slate-400 font-bold">/ 10.0</span>
                                </span>
                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1">SAFETY INDEX</span>
                            </div>
                            <div className="flex-1 flex flex-col gap-1.5">
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50 relative shadow-inner">
                                    <div
                                        className={`h-full transition-all duration-1000 shadow-lg ${stabilityPrediction.safetyIndex >= 8 ? 'bg-emerald-500' : stabilityPrediction.safetyIndex >= 5 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                        style={{ width: `${(stabilityPrediction.safetyIndex / 10) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between items-center px-1">
                                    <span className={`text-[8px] font-black uppercase ${stabilityPrediction.status === 'Excellent' ? 'text-emerald-500' : 'text-amber-500'}`}>{stabilityPrediction.status}</span>
                                    <span className="text-[6px] font-black text-slate-300 uppercase tracking-tighter">THERMODYNAMIC AUDIT</span>
                                </div>
                            </div>
                        </div>

                        {/* 新增：热力学风险细分 */}
                        {stabilityPrediction.thermodynamicRisk && (
                            <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 flex gap-2 items-start">
                                <i className="fa-solid fa-triangle-exclamation text-rose-500 text-[10px] mt-1"></i>
                                <div>
                                    <p className="text-[8px] font-black text-rose-600 uppercase mb-0.5">Pourbaix 风险识别</p>
                                    <p className="text-[10px] font-bold text-rose-800 leading-tight italic">{stabilityPrediction.thermodynamicRisk}</p>
                                </div>
                            </div>
                        )}

                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-[11px] italic leading-relaxed text-slate-600 font-medium shadow-inner">{stabilityPrediction.desc}</div>
                    </div>
                ) : (
                    <div className="py-8 text-center text-slate-300 italic text-[10px] font-black uppercase tracking-widest">等待仿真引擎启动热力学审计...</div>
                )}
            </div>
        </div>
    );
};

export default MechanismParameters;
