import React, { useMemo } from 'react';

interface BimetallicSynergyChartProps {
    material: string;
    dopingElement: string;
    dopingConcentration: number;
    coDopingElement?: string;
    coDopingConcentration?: number;
    reactionMode: 'HER' | 'OER' | 'ORR' | 'BIFUNCTIONAL';
    physicalConstants: any;
    potential: number;
    isLightMode: boolean;
}

const ELECTRONEGATIVITY: Record<string, number> = {
    'Ag': 1.93, 'Pt': 2.28, 'Pd': 2.20, 'Fe': 1.83, 'Ni': 1.91, 'Ce': 1.12,
    'Co': 1.88, 'Cu': 1.90, 'Au': 2.54, 'Ru': 2.20, 'Ir': 2.20, 'W': 2.36, 'Mo': 2.16, 'V': 1.63,
    'NiFe-LDH': 1.95, 'ZIF-67 (MOF)': 1.85, 'MIL-101 (MOF)': 1.90, 'MOF-74': 1.92,
    'Fe-N-C (SAC)': 1.83, 'FeNC@NiFe-LDH (Heterostructure)': 1.89
};

const BimetallicSynergyChart: React.FC<BimetallicSynergyChartProps> = ({
    material, dopingElement, dopingConcentration, coDopingElement, coDopingConcentration,
    reactionMode, physicalConstants, potential, isLightMode
}) => {
    const isOER = reactionMode === 'OER' || (reactionMode === 'BIFUNCTIONAL');
    const labels = isOER ? ['H₂O', '*OH', '*O', '*OOH', 'O₂'] : ['O₂', '*OOH', '*O', '*OH', 'H₂O'];

    const m1 = dopingElement || 'M1';
    const m2 = coDopingElement || 'M2';
    const en1 = ELECTRONEGATIVITY[m1] || 2.0;
    const en2 = ELECTRONEGATIVITY[m2] || 2.0;
    const enDiff = Math.abs(en1 - en2);

    const synergyData = useMemo(() => {
        const baseSteps = (physicalConstants?.energySteps && Array.isArray(physicalConstants.energySteps))
            ? physicalConstants.energySteps
            : (isOER ? [0, 1.5, 2.8, 4.2, 4.92] : [0, -1.5, -2.8, -4.2, -4.92]);

        const refPotential = 1.23;
        const correctedSteps = baseSteps.map((v: number, i: number) => v - (i * (potential - refPotential)));

        // 模拟单金属路径
        const m1Steps = correctedSteps.map((v: number, i: number) => i === 0 || i === 4 ? v : v + 0.3 + (en1 - 1.8) * 0.2);
        const m2Steps = correctedSteps.map((v: number, i: number) => i === 0 || i === 4 ? v : v + 0.4 + (en2 - 1.8) * 0.2);

        // 协同路径 (更优)
        const synergySteps = correctedSteps.map((v: number, i: number) => i === 0 || i === 4 ? v : v - (enDiff * 0.15));

        // 计算 Bader 电荷变化 (根据电负性差异动态生成)
        const baderM1 = [0, 0.15 * enDiff, 0.3 * enDiff, 0.1 * enDiff, 0];
        const baderM2 = [0, -0.15 * enDiff, -0.3 * enDiff, -0.1 * enDiff, 0];

        return { m1Steps, m2Steps, synergySteps, baderM1, baderM2 };
    }, [physicalConstants, potential, en1, en2, enDiff, isOER]);

    const canvasWidth = 500;
    const canvasHeight = 300;
    const margin = 50;
    const stepSpace = (canvasWidth - 2 * margin) / 4;

    const allVals = [...synergyData.m1Steps, ...synergyData.m2Steps, ...synergyData.synergySteps];
    const minVal = Math.min(...allVals);
    const maxVal = Math.max(...allVals);
    const range = maxVal - minVal || 1;
    const getY = (val: number) => canvasHeight - margin - ((val - minVal) / range) * (canvasHeight - 2 * margin);

    return (
        <div className="w-full flex flex-col gap-6 animate-reveal">
            {/* 协同演化拓扑图 */}
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                        双金属协同演化拓扑 <span className="text-indigo-600 ml-2">SYNERGY TOPOLOGY</span>
                    </h4>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-0.5 bg-slate-300 border-dashed border-t-2"></div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase">单金属位点 (参考)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-1 bg-indigo-600 rounded-full"></div>
                            <span className="text-[9px] font-bold text-indigo-600 uppercase">双金属协同耦合</span>
                        </div>
                    </div>
                </div>

                <svg viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} className="w-full h-auto overflow-visible">
                    <defs>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* 网格线 */}
                    {[0, 1, 2, 3, 4].map(i => (
                        <line key={i} x1={margin + i * stepSpace} y1={margin} x2={margin + i * stepSpace} y2={canvasHeight - margin} stroke="#f1f5f9" strokeWidth="1" />
                    ))}

                    {/* M1 路径 */}
                    <path d={synergyData.m1Steps.map((v: number, i: number) => `${i === 0 ? 'M' : 'L'} ${margin + i * stepSpace} ${getY(v)}`).join(' ')}
                        fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />

                    {/* M2 路径 */}
                    <path d={synergyData.m2Steps.map((v: number, i: number) => `${i === 0 ? 'M' : 'L'} ${margin + i * stepSpace} ${getY(v)}`).join(' ')}
                        fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" />

                    {/* 协同路径 */}
                    <path d={synergyData.synergySteps.map((v: number, i: number) => `${i === 0 ? 'M' : 'L'} ${margin + i * stepSpace} ${getY(v)}`).join(' ')}
                        fill="none" stroke="#6366f1" strokeWidth="3" filter="url(#glow)" className="animate-pulse" />

                    {/* 步骤节点与标注 */}
                    {synergyData.synergySteps.map((v: number, i: number) => {
                        const x = margin + i * stepSpace;
                        const y = getY(v);
                        return (
                            <g key={i}>
                                <circle cx={x} cy={y} r="4" fill="#6366f1" />
                                <text x={x} y={y - 12} textAnchor="middle" className="text-[10px] font-black fill-slate-800 tracking-tighter">{v.toFixed(2)} eV</text>
                                <text x={x} y={canvasHeight - margin + 15} textAnchor="middle" className="text-[9px] font-bold fill-slate-400 uppercase tracking-widest">{labels[i]}</text>

                                {/* 电子转移动画箭头 */}
                                {i < 4 && (
                                    <g transform={`translate(${x + stepSpace / 2}, ${getY((v + synergyData.synergySteps[i + 1]) / 2) - 15})`}>
                                        <path d="M -10 0 Q 0 -10 10 0" fill="none" stroke="#f43f5e" strokeWidth="1.2" strokeDasharray="3 2" className="animate-bounce" />
                                        <text x="0" y="-12" textAnchor="middle" className="text-[8px] font-black fill-rose-500">电子耦合协同 (e⁻ coupling)</text>
                                    </g>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* Bader 电荷与指标面板 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-xl">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2rem] mb-6">Bader 电荷转移平衡动力学 (CHARGING DYNAMICS)</h4>
                    <div className="h-40 w-full relative">
                        <svg viewBox="0 0 200 100" className="w-full h-full">
                            <line x1="0" y1="50" x2="200" y2="50" stroke="#f1f5f9" strokeWidth="1" />
                            {/* M1 电荷变化 */}
                            <path d={`M 0 50 ${synergyData.baderM1.map((v: number, i: number) => `L ${i * 50} ${50 - v * 40}`).join(' ')}`}
                                fill="none" stroke="#6366f1" strokeWidth="2" />
                            {/* M2 电荷变化 (镜像) */}
                            <path d={`M 0 50 ${synergyData.baderM2.map((v: number, i: number) => `L ${i * 50} ${50 - v * 40}`).join(' ')}`}
                                fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="2 2" />

                            <text x="5" y="15" className="text-[6px] font-black fill-indigo-600">Δq {m1} (+)</text>
                            <text x="5" y="95" className="text-[6px] font-black fill-emerald-600">Δq {m2} (-)</text>
                        </svg>
                    </div>
                    <p className="text-[9px] text-slate-500 italic mt-4 leading-relaxed">
                        电子倾向于从低电负性的 <span className="font-bold text-indigo-600">{en1 < en2 ? m1 : m2}</span>
                        向高电负性的 <span className="font-bold text-emerald-600">{en1 < en2 ? m2 : m1}</span> 中心偏移，
                        在中间体吸附阶段电荷极化达到峰值。
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-3xl flex flex-col justify-center items-center text-center">
                        <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">金属间耦合强度</span>
                        <span className="text-2xl font-black text-indigo-700 italic">{(enDiff * 0.85).toFixed(2)}</span>
                        <span className="text-[7px] font-bold text-indigo-400 uppercase mt-1">eV⁻¹ · Å (Coupling)</span>
                    </div>
                    <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-3xl flex flex-col justify-center items-center text-center">
                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">协同催化增益</span>
                        <span className="text-2xl font-black text-emerald-700 italic">+{(enDiff * 12).toFixed(1)}%</span>
                        <span className="text-[7px] font-bold text-emerald-400 uppercase mt-1">活性提升比 (Activity)</span>
                    </div>
                    <div className="bg-slate-100/50 border border-slate-200 p-4 rounded-3xl col-span-2 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm">
                            <i className="fa-solid fa-bolt-lightning"></i>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-800 uppercase tracking-tighter">电子桥连效应 (ELECTRON BRIDGE)</span>
                            <span className="text-[10px] text-slate-500 leading-tight">
                                {enDiff > 0.3 ? '显著的能级劈裂诱导了高效的跨金属电荷泵浦效应。' : '弱耦合机制，主要通过局域轨道杂化优化吸附能。'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BimetallicSynergyChart;
