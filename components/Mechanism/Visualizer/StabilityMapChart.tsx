import React, { useMemo, useState } from 'react';

interface Props {
    potential: number;
    pH: number;
    dopingConcentration: number;
    dopingElement?: string;
    coDopingConcentration?: number;
}

export const StabilityMapChart: React.FC<Props> = ({ potential, pH, dopingConcentration, dopingElement, coDopingConcentration }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isLegendExpanded, setIsLegendExpanded] = useState(false);

    // 模拟晶格应力对化学势的影响：掺杂会略微收缩或扩大材料的钝化稳定窗口
    const elementalShift = (dopingElement === 'Mo' || dopingElement === 'W' || dopingElement === 'V') ? 0.08 : (dopingElement === 'S' || dopingElement === 'P') ? -0.05 : 0;
    const totalDoping = dopingConcentration + (coDopingConcentration || 0);
    const chemicalPotentialShift = totalDoping * 0.015 + elementalShift;

    // --- 严谨物理区域判定 (逻辑必须与下方的 SVG 多边形顶点一致) ---
    const regionInfo = useMemo(() => {
        // 定义材料本征的免疫线 (Immunity boundary, 随 pH 偏移)
        const immunityE = 0.3 - (0.0591 * pH) - chemicalPotentialShift;

        // 定义过钝化/碱性溶解线 (Transpassive boundary)
        const transpassiveE = 1.9 - (0.04 * (pH - 10));

        if (potential < immunityE) return {
            id: 'immunity', name: '热力学免疫区', color: 'bg-emerald-600', border: 'border-emerald-400'
        };

        if (pH < 4.0) return {
            id: 'acidic', name: '酸性腐蚀溶解', color: 'bg-rose-600', border: 'border-rose-400'
        };

        if (pH > 12.5 || (pH > 9.5 && potential > transpassiveE)) return {
            id: 'alkaline', name: '强碱/过钝化腐蚀', color: 'bg-amber-600', border: 'border-amber-400'
        };

        return {
            id: 'passivation', name: '钝化膜保护区', color: 'bg-indigo-600', border: 'border-indigo-400'
        };
    }, [pH, potential, chemicalPotentialShift]);

    // 坐标映射逻辑 (电位量程 0-2.2V, pH量程 0-14)
    const xPos = useMemo(() => Math.min(98, Math.max(2, (pH / 14) * 100)), [pH]);
    const yPos = useMemo(() => Math.min(98, Math.max(2, (1 - (potential / 2.2)) * 100)), [potential]);

    return (
        <div className="w-full h-full flex flex-col animate-reveal p-6 select-none min-h-[550px] overflow-hidden antialiased">
            {/* 顶部标题与状态 */}
            <header className="w-full flex justify-between items-start mb-8 shrink-0 relative z-20">
                <div className="flex flex-col">
                    <h5 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic leading-none">电化学服役寿命图谱</h5>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-2 tracking-[0.2rem] flex items-center gap-2">
                        <span className="w-6 h-px bg-indigo-500"></span>
                        热力学相行为模拟 (POURBAIX MODELLING)
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className={`px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase shadow-xl border-2 flex items-center gap-3 transition-all duration-700 ${regionInfo.color} text-white ${regionInfo.border}`}>
                        <i className="fa-solid fa-shield-halved animate-pulse"></i>
                        {regionInfo.name}
                    </div>
                    <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">能斯特斜率: -59.1 mV/pH</span>
                </div>
            </header>

            {/* 绘图主核心 */}
            <div className="flex-1 w-full flex items-center justify-center min-h-0 py-2">
                <div className="w-full h-full max-w-[850px] aspect-[1.5/1] grid grid-cols-[70px_1fr] grid-rows-[1fr_60px] gap-0 relative bg-white">

                    {/* Y 轴: 电位 */}
                    <div className="flex flex-col justify-between items-end pr-5 py-4 border-r-2 border-slate-300 text-[11px] font-black text-slate-500 font-mono italic">
                        <span>2.2 V</span>
                        <span>1.6 V</span>
                        <span>1.1 V</span>
                        <span>0.5 V</span>
                        <span className="translate-y-3">0.0 V</span>
                    </div>

                    {/* 绘图区 */}
                    <div className="relative border-t-2 border-slate-300 bg-white shadow-inner overflow-hidden">

                        {/* SVG 物理分界图层：所有点均基于 2.2V & 14pH 线性映射 */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                            {/* 1. 热力学免疫区 (Emerald) - 底部多边形，考虑能斯特斜率 */}
                            <polygon points="0,86 100,78 100,100 0,100" fill="#10b981" fillOpacity="0.12" />

                            {/* 2. 酸性腐蚀溶解区 (Rose) - 左侧 pH < 4 区块 */}
                            <polygon points="0,0 28.5,0 28.5,83.5 0,86" fill="#f43f5e" fillOpacity="0.12" />

                            {/* 3. 钝化膜保护区 (Indigo) - 核心稳定窗格 */}
                            <polygon points="28.5,0 75,0 92,20 92,75 28.5,83.5" fill="#6366f1" fillOpacity="0.08" />

                            {/* 4. 强碱/过钝化腐蚀区 (Amber) - 右侧高电位和强碱区 */}
                            <polygon points="75,0 100,0 100,80 92,75 92,20" fill="#f59e0b" fillOpacity="0.15" />

                            {/* --- 水分解平衡基准线 --- */}
                            <line x1="0" y1="100" x2="100" y2="62" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="3 2" opacity="0.4" />
                            <line x1="0" y1="44" x2="100" y2="81" stroke="#f43f5e" strokeWidth="0.5" strokeDasharray="3 2" opacity="0.4" />

                            <polyline points="28.5,0 28.5,83.5" fill="none" stroke="black" strokeWidth="0.1" opacity="0.1" />
                            <polyline points="0,86 28.5,83.5 92,75 100,78" fill="none" stroke="black" strokeWidth="0.1" opacity="0.1" />
                        </svg>

                        {/* 辅助背景网格 */}
                        <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.03] grid grid-cols-7 grid-rows-10">
                            {Array.from({ length: 70 }).map((_, i) => <div key={i} className="border border-slate-900"></div>)}
                        </div>

                        {/* 区域文字标识 */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute bottom-[4%] left-[45%] text-[10px] font-black text-emerald-800/40 uppercase tracking-[0.4rem]">热力学免疫区</div>
                            <div className="absolute top-[45%] left-[48%] text-[10px] font-black text-indigo-800/30 uppercase tracking-[0.5rem]">钝化膜稳定区</div>
                            <div className="absolute top-[35%] left-[6%] -rotate-90 text-[9px] font-black text-rose-800/40 uppercase tracking-[0.2rem]">阳极腐蚀 (酸性)</div>
                            <div className="absolute top-[18%] right-[3%] text-[9px] font-black text-amber-800/50 uppercase tracking-[0.1rem] text-right">过钝化<br />阴离子溶解</div>

                            <div className="absolute top-[38%] left-[5%] text-[7px] font-bold text-rose-400 rotate-[20deg] opacity-60">析氧平衡 (b线)</div>
                            <div className="absolute top-[82%] left-[5%] text-[7px] font-bold text-blue-400 rotate-[20deg] opacity-60">析氢平衡 (a线)</div>
                        </div>

                        {/* 实时工况点 */}
                        <div
                            className="absolute w-0 h-0 transform -translate-x-1/2 -translate-y-1/2 z-40 transition-all duration-1000 cubic-bezier(0.34, 1.56, 0.64, 1)"
                            style={{ left: `${xPos}%`, top: `${yPos}%` }}
                        >
                            <div
                                className="relative flex items-center justify-center cursor-crosshair group/point"
                                onMouseEnter={() => setIsHovered(true)}
                                onMouseLeave={() => setIsHovered(false)}
                            >
                                <div className={`absolute w-16 h-16 rounded-full animate-ping opacity-25 ${regionInfo.color}`}></div>
                                <div className={`w-7 h-7 rounded-full border-[5px] shadow-2xl z-50 flex items-center justify-center bg-white ${regionInfo.border} group-hover/point:scale-125 transition-transform`}>
                                    <div className={`w-2 h-2 rounded-full ${regionInfo.color}`}></div>
                                </div>

                                {/* 悬浮标签 - 仅在 hover 时显示 */}
                                <div className={`absolute bottom-full mb-6 z-[60] whitespace-nowrap transition-all duration-300 pointer-events-none ${isHovered ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'} ${xPos > 70 ? 'right-0' : xPos < 30 ? 'left-0' : 'left-1/2 -translate-x-1/2'}`}>
                                    <div className={`px-5 py-2.5 rounded-[1.5rem] shadow-2xl border-2 flex flex-col items-center gap-0.5 text-white ${regionInfo.color} ${regionInfo.border}`}>
                                        <span className="text-[12px] font-black font-mono tracking-tighter">
                                            {potential.toFixed(3)}V / pH {pH.toFixed(1)}
                                        </span>
                                        <span className="text-[7px] font-black opacity-80 uppercase tracking-widest leading-none">实时服役工况点</span>
                                    </div>
                                    <div className={`w-4 h-4 transform rotate-45 mt-[-8px] mx-auto border-r-2 border-b-2 ${regionInfo.color.replace('bg-', 'bg-')} ${regionInfo.border.replace('border-', 'border-')}`}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 底部 X 轴: pH */}
                    <div className="col-start-2 flex justify-between items-start px-0 pt-5 text-[11px] font-black text-slate-500 border-t-2 border-slate-300">
                        {['0', '2', '4', '6', '8', '10', '12', '14'].map(val => (
                            <span key={val} className="w-0 overflow-visible text-center">{val}</span>
                        ))}
                    </div>

                    <div className="absolute bottom-[-22px] left-[50%] -translate-x-1/2 text-[9px] font-black text-slate-300 uppercase tracking-[0.8rem] italic whitespace-nowrap">氢离子浓度标度 (pH Scale)</div>
                </div>
            </div>

            {/* 底部图例 - Added collapsible functionality as requested */}
            <div className="mt-8 shrink-0 px-2 no-print">
                <button
                    onClick={() => setIsLegendExpanded(!isLegendExpanded)}
                    className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2rem] mb-4 hover:text-indigo-600 transition-colors group"
                >
                    <i className={`fa-solid ${isLegendExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} transition-transform`}></i>
                    <span>图例与热力学说明 (LEGEND & NOTES)</span>
                    {!isLegendExpanded && <span className="ml-2 px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded text-[7px] border border-indigo-100">点击展开详细说明</span>}
                </button>

                {isLegendExpanded && (
                    <footer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-reveal">
                        {[
                            {
                                key: 'immunity',
                                label: '热力学免疫区',
                                desc: '金属态在热力学上处于绝对稳定状态',
                                color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                                dot: 'bg-emerald-500'
                            },
                            {
                                key: 'passivation',
                                label: '钝化膜保护区',
                                desc: '表面形成致密氧化膜，有效抑制腐蚀',
                                color: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                                dot: 'bg-indigo-500'
                            },
                            {
                                key: 'acidic',
                                label: '阳极酸性腐蚀',
                                desc: '在酸性环境下以阳离子形式连续流失',
                                color: 'bg-rose-50 text-rose-800 border-rose-200',
                                dot: 'bg-rose-500'
                            },
                            {
                                key: 'alkaline',
                                label: '碱性/过钝化溶解',
                                desc: '极高电位或强碱下生成可溶性含氧酸根',
                                color: 'bg-amber-50 text-amber-800 border-amber-200',
                                dot: 'bg-amber-500'
                            }
                        ].map(item => (
                            <div
                                key={item.key}
                                className={`p-5 rounded-[2rem] border-2 flex flex-col gap-3 transition-all hover:-translate-y-1 hover:shadow-lg cursor-help min-h-[110px] ${item.color}`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <span className={`w-3 h-3 rounded-full shadow-inner border border-white/50 ${item.dot}`}></span>
                                    <p className="text-[11px] font-black uppercase tracking-tight leading-none">{item.label}</p>
                                </div>
                                <p className="text-[10px] font-bold opacity-75 leading-relaxed italic text-justify border-t border-black/5 pt-2">
                                    {item.desc}
                                </p>
                            </div>
                        ))}
                    </footer>
                )}
            </div>
        </div>
    );
};
