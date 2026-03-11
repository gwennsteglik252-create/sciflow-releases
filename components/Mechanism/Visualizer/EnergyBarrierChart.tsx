import React, { useState, useMemo, useEffect, useRef } from 'react';

interface Props {
    physicalConstants: any;
    reactionMode: 'HER' | 'OER' | 'ORR' | 'BIFUNCTIONAL';
    potential: number;
    isLightMode: boolean;
    savedSimulations: any[];
    lsvCurves: any;
    benchmarkResult?: { error: number, jSim: number, vReal: number, jReal: number } | null;
    dopingConcentration: number;
    dopingElement?: string;
}

const generateLSVPoints = (j0: number, bT: number, massLoading: number, reactionMode: string) => {
    const points = [];
    const step = 0.005;
    const range = 0.6;
    const onset = reactionMode === 'HER' ? 0 : 1.23;
    for (let over = 0; over <= range; over += step) {
        const j = (j0 * Math.pow(10, (over * 1000) / bT)) * massLoading;
        points.push({ v: onset + over, j: Math.min(j, 2000) });
    }
    return points;
};

const ReferenceLine10: React.FC<{ currentPlan: any[] | null, maxJ: number, isORR?: boolean }> = ({ currentPlan, maxJ, isORR }) => {
    if (!currentPlan) return null;
    const y10 = 100 - (10 / maxJ) * 100;
    return (
        <g>
            <line x1="0" y1={y10} x2="200" y2={y10} stroke="#f43f5e" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.6" />
            <text x={2} y={y10 - 3} className="fill-rose-400 font-black" style={{ fontSize: '6.5px' }}>{isORR ? 'j = -10 mA/cm²' : 'j = 10 mA/cm²'}</text>
        </g>
    );
};

export const EnergyBarrierChart: React.FC<Props> = ({
    physicalConstants, reactionMode, potential, isLightMode, savedSimulations, lsvCurves, benchmarkResult, dopingConcentration, dopingElement
}) => {
    const [showComparison, setShowComparison] = useState(false);
    const [visibleSimIds, setVisibleSimIds] = useState<string[]>(() => savedSimulations.map(s => s.id));
    const [showLsvComparison, setShowLsvComparison] = useState(false);
    const [isZoomed, setIsZoomed] = useState(false);

    const [legendPos, setLegendPos] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const basePos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (!isDragging) return;
        const handleMouseMove = (e: MouseEvent) => {
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;
            setLegendPos({
                x: basePos.current.x + dx,
                y: basePos.current.y + dy
            });
        };
        const handleMouseUp = () => {
            setIsDragging(false);
            basePos.current = legendPos;
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, legendPos]);

    const handleLegendMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        basePos.current = legendPos;
    };

    // Sync visibleSimIds if savedSimulations changes
    useMemo(() => {
        const ids = savedSimulations.map(s => s.id);
        setVisibleSimIds(prev => {
            const stillExists = prev.filter(id => ids.includes(id));
            const news = ids.filter(id => !prev.includes(id));
            return [...stillExists, ...news];
        });
    }, [savedSimulations]);

    const toggleSimVisibility = (id: string) => {
        setVisibleSimIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const [biView, setBiView] = useState<'OER' | 'ORR'>('OER');
    const isBi = reactionMode === 'BIFUNCTIONAL';
    const effectiveMode = isBi ? biView : reactionMode;

    const isOER = effectiveMode === 'OER';
    const isORR = effectiveMode === 'ORR';

    const defaultSteps = isOER ? [0, 1.4, 2.5, 3.8, 4.92] : isORR ? [0, -1.2, -2.5, -3.8, -4.92] : [0, 0.4, 0];
    const energySteps = (physicalConstants?.energySteps && Array.isArray(physicalConstants.energySteps))
        ? (isBi ? (biView === 'OER' ? (physicalConstants.energyStepsOER || physicalConstants.energySteps) : (physicalConstants.energyStepsORR || physicalConstants.energySteps.map((v: number) => -v))) : physicalConstants.energySteps)
        : defaultSteps;

    const labels = isOER ? ['H₂O', 'OH*', 'O*', 'OOH*', 'O₂'] : isORR ? ['O₂', 'OOH*', 'O*', 'OH*', 'H₂O'] : ['H+', 'H*', '1/2 H₂'];

    const refPotential = (isOER || isORR) ? 1.23 : 0.0;
    const correctedSteps = energySteps.map((v: number, i: number) => v - (i * (potential - refPotential)));

    const baseSteps = useMemo(() => {
        if (!showComparison || dopingConcentration <= 0) return null;
        let currentRdsIdx = 0;
        let currentMaxDG = -Infinity;
        for (let i = 0; i < correctedSteps.length - 1; i++) {
            const dg = correctedSteps[i + 1] - correctedSteps[i];
            if (dg > currentMaxDG) { currentMaxDG = dg; currentRdsIdx = i; }
        }

        return correctedSteps.map((v: number, i: number) => {
            if (i === 0 || i === correctedSteps.length - 1) return v;
            const elementFactor = (dopingElement && dopingElement.length > 0) ? (dopingElement.charCodeAt(0) % 5) : 2;
            const penalty = 0.2 + (dopingConcentration * (0.01 + elementFactor * 0.005));
            if (i > currentRdsIdx) return v + penalty;
            return v + penalty * 0.5;
        });
    }, [showComparison, dopingConcentration, correctedSteps, dopingElement]);

    let rdsIdx = 0; let maxDG = -Infinity;
    for (let i = 0; i < correctedSteps.length - 1; i++) {
        const dg = correctedSteps[i + 1] - correctedSteps[i];
        if (dg > maxDG) { maxDG = dg; rdsIdx = i; }
    }

    const canvasHeight = 320;
    const canvasWidth = 400;
    const margin = 40;
    const stepSpace = (canvasWidth - 2 * margin) / (energySteps.length - 1);

    const minStepVal = Math.min(...correctedSteps, ...(baseSteps || []));
    const maxStepVal = Math.max(...correctedSteps, ...(baseSteps || []));
    const dataRange = maxStepVal - minStepVal;
    const safePadding = Math.max(dataRange * 0.15, 0.5);

    const axisMin = minStepVal - safePadding;
    const axisMax = maxStepVal + safePadding;
    const axisRange = axisMax - axisMin;

    const graphTop = 30;
    const graphBottom = canvasHeight - 50;
    const graphHeight = graphBottom - graphTop;
    const scaleY = graphHeight / (axisRange || 1);

    const getY = (val: number) => graphBottom - (val - axisMin) * scaleY;

    const textFill = isLightMode ? '#0f172a' : '#ffffff';
    const subTextFill = isLightMode ? '#334155' : '#e2e8f0';
    const gridColor = isLightMode ? '#cbd5e1' : '#475569';

    const errorHeight = 0.05 * scaleY;

    const mapVtoX = (v: number) => {
        if (!lsvCurves || lsvCurves.length === 0) return 0;
        const minV = lsvCurves[0].v;
        const maxV = lsvCurves[lsvCurves.length - 1].v;
        const range = maxV - minV || 1;
        return ((v - minV) / range) * 200;
    };

    const mapJtoY = (j: number) => 100 - (j / 2000) * 100;

    const nonRdsFill = isLightMode ? "#e2e8f0" : "#334155";
    const nonRdsText = isLightMode ? "fill-slate-900 font-black" : "fill-white";

    return (
        <div className="w-full flex flex-col items-center animate-reveal relative p-2">
            <div className="w-full relative flex items-center justify-center min-h-[380px] shrink-0">
                {isBi && (
                    <div className="absolute top-2 left-6 z-20 flex gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button
                            onClick={() => setBiView('OER')}
                            className={`px-3 py-1 rounded-md text-[8px] font-black uppercase transition-all ${biView === 'OER' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            OER Path
                        </button>
                        <button
                            onClick={() => setBiView('ORR')}
                            className={`px-3 py-1 rounded-md text-[8px] font-black uppercase transition-all ${biView === 'ORR' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            ORR Path
                        </button>
                    </div>
                )}

                {dopingConcentration > 0 && !isBi && (
                    <div className="absolute top-2 left-6 z-20">
                        <button
                            onClick={() => setShowComparison(!showComparison)}
                            className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all shadow-md border ${showComparison ? 'bg-slate-600 text-white border-slate-500' : 'bg-white text-slate-500 border-slate-200 hover:text-indigo-600'}`}
                        >
                            {showComparison ? '隐藏基材 (Hide Base)' : '对比未掺杂 (Compare Base)'}
                        </button>
                    </div>
                )}

                <svg viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} className="w-full h-full drop-shadow-2xl overflow-visible">
                    <defs>
                        <filter id="rds-glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                        <radialGradient id="haloGradient">
                            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                        </radialGradient>
                    </defs>

                    <line x1={margin - 10} y1={graphTop} x2={margin - 10} y2={graphBottom} stroke={gridColor} strokeWidth="1.5" />
                    <line x1={margin - 10} y1={getY(refPotential)} x2={canvasWidth - 10} y2={getY(refPotential)} stroke="#10b981" strokeWidth="1" strokeDasharray="6 3" opacity="0.6" />
                    <text x={canvasWidth - 20} y={getY(refPotential) - 5} textAnchor="end" className={`text-[8px] font-black uppercase tracking-widest ${isLightMode ? 'fill-emerald-700' : 'fill-emerald-500'}`}>IDEAL LIMIT ({refPotential}V)</text>

                    {showComparison && baseSteps && baseSteps.map((val: number, i: number) => {
                        const x = margin + i * stepSpace;
                        const y = getY(val);
                        const nextX = margin + (i + 1) * stepSpace;
                        const nextY = i < baseSteps.length - 1 ? getY(baseSteps[i + 1]) : y;

                        return (
                            <g key={`base-${i}`} opacity="0.4">
                                <line x1={x - 20} y1={y} x2={x + 20} y2={y} stroke={isLightMode ? "#64748b" : "#94a3b8"} strokeWidth="3" strokeLinecap="round" />
                                {i < baseSteps.length - 1 && (
                                    <line x1={x + 20} y1={y} x2={nextX - 20} y2={nextY} stroke={isLightMode ? "#64748b" : "#94a3b8"} strokeWidth="1.5" strokeDasharray="4 2" />
                                )}
                                {i === Math.floor(baseSteps.length / 2) && (
                                    <text x={x} y={y - 15} textAnchor="middle" className="text-[10px] font-black uppercase fill-slate-500">Base</text>
                                )}
                            </g>
                        )
                    })}

                    {correctedSteps.map((val: number, i: number) => {
                        const x = margin + i * stepSpace;
                        const y = getY(val);
                        const nextX = margin + (i + 1) * stepSpace;
                        const nextY = i < correctedSteps.length - 1 ? getY(correctedSteps[i + 1]) : y;
                        const isRDS = i === rdsIdx;
                        const dg = i < correctedSteps.length - 1 ? (correctedSteps[i + 1] - val) : 0;

                        return (
                            <g key={i}>
                                <rect x={x - 20} y={y - errorHeight} width="40" height={errorHeight * 2} fill={isRDS ? "#f43f5e" : "#6366f1"} opacity="0.15" rx="2" />
                                <line x1={x - 20} y1={y} x2={x + 20} y2={y} stroke={isRDS ? "#f43f5e" : "#6366f1"} strokeWidth="5" strokeLinecap="round" />
                                <text x={x} y={y - 18} textAnchor="middle" className="font-mono font-black text-[14px]" fill={textFill}>{val.toFixed(2)}</text>
                                <text x={x} y={y - 8} textAnchor="middle" fontSize="8px" fill={subTextFill}>±0.05</text>
                                <text x={x} y={y + 20} textAnchor="middle" className={`text-[12px] font-black italic ${isRDS ? 'fill-rose-500' : (isLightMode ? 'fill-slate-800' : 'fill-slate-300')}`}>{labels[i]}</text>

                                {i < correctedSteps.length - 1 && (
                                    <g>
                                        <line x1={x + 20} y1={y} x2={nextX - 20} y2={nextY} stroke={isRDS ? "#f43f5e" : "#94a3b8"} strokeWidth={isRDS ? 4 : 1.5} strokeDasharray={isRDS ? "0" : "4 2"} filter={isRDS ? "url(#rds-glow)" : ""} className={isRDS ? "animate-pulse" : ""} />
                                        <g transform={`translate(${(x + nextX) / 2}, ${(y + nextY) / 2 - 14})`}>
                                            <rect x="-30" y="-10" width="60" height="20" rx="6" fill={isRDS ? "#f43f5e" : nonRdsFill} stroke={isRDS ? "none" : "#94a3b8"} strokeWidth="1" />
                                            <text textAnchor="middle" y="4" className={`text-[12px] font-black ${isRDS ? 'fill-white' : nonRdsText}`}>ΔG:{dg.toFixed(2)}</text>
                                        </g>
                                    </g>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>

            <div className="w-full min-h-[200px] border-t border-slate-200 pt-4 px-8 flex flex-col bg-white relative group shrink-0 rounded-b-[2.5rem] mt-4 mb-4 pb-4">
                <div className="flex justify-between items-center mb-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsZoomed(!isZoomed)}
                            className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-all group/zoom ${isZoomed ? 'text-rose-500 bg-rose-50/50' : 'text-slate-300 hover:text-indigo-500'}`}
                            title={isZoomed ? '还原视图' : '放大起始域'}
                        >
                            <i className={`fa-solid ${isZoomed ? 'fa-magnifying-glass-minus' : 'fa-magnifying-glass-plus'} text-[10px]`}></i>
                            <span className="text-[8px] font-black uppercase tracking-tighter">
                                {isZoomed ? 'RESET' : 'ZOOM'}
                            </span>
                        </button>
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-3 h-0.5 bg-indigo-500"></span> 掺杂体系 LSV 极化仿真
                        </span>
                        <button
                            onClick={() => setShowLsvComparison(!showLsvComparison)}
                            className={`px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all shadow-sm border ${showLsvComparison ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white text-slate-500 border-slate-200 hover:text-indigo-600'}`}
                        >
                            {showLsvComparison ? '隐藏对比点库' : '展开对比点库'}
                        </button>
                    </div>
                    <span className="text-[8px] font-black text-indigo-500 uppercase whitespace-nowrap">KINETICS SIMULATION FLOW</span>
                </div>

                <div
                    onMouseDown={handleLegendMouseDown}
                    style={{ transform: `translate(${legendPos.x}px, ${legendPos.y}px)`, cursor: isDragging ? 'grabbing' : 'move' }}
                    className="absolute top-[18%] left-[28%] bg-white/90 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-xl flex flex-col gap-2 z-10 max-w-[130px] pointer-events-auto select-none"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-3.5 h-1.5 rounded-full bg-indigo-600 shadow-sm"></div>
                        <span className="text-[8px] font-black text-slate-700 uppercase tracking-tight truncate">当前方案</span>
                    </div>
                    <div className="flex items-center gap-2 opacity-60">
                        <div className="w-3.5 h-1.5 rounded-full bg-slate-400 border border-slate-300"></div>
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-tight truncate">基材 (Base)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3.5 h-0.5 border-t-2 border-indigo-400 border-dashed"></div>
                        <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tight truncate">衰减预测</span>
                    </div>
                    {showLsvComparison && savedSimulations.map((sim, sIdx) => {
                        const colors = ['#f43f5e', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#3b82f6'];
                        const isVisible = visibleSimIds.includes(sim.id);
                        return (
                            <button
                                key={sim.id}
                                onClick={() => toggleSimVisibility(sim.id)}
                                className={`flex items-center gap-2 hover:bg-slate-50 p-1 -m-1 rounded-md transition-all ${isVisible ? '' : 'opacity-30'}`}
                            >
                                <div className="w-3.5 h-0.5 border-t-2 border-dashed" style={{ borderColor: colors[sIdx % colors.length] }}></div>
                                <span className="text-[8px] font-black uppercase tracking-tight truncate text-left" style={{ color: colors[sIdx % colors.length] }}>{sim.name}</span>
                            </button>
                        );
                    })}
                </div>

                {lsvCurves ? (
                    <div className="flex-1 w-full overflow-hidden rounded-2xl">
                        <svg viewBox="-46 -12 280 162" className="w-full h-full" style={{ overflow: 'hidden' }}>
                            <line x1="0" y1="0" x2="200" y2="0" stroke="#f1f5f9" strokeWidth="0.5" />
                            <line x1="0" y1="25" x2="200" y2="25" stroke="#f1f5f9" strokeWidth="0.3" />
                            <line x1="0" y1="50" x2="200" y2="50" stroke="#f1f5f9" strokeWidth="0.5" />
                            <line x1="0" y1="75" x2="200" y2="75" stroke="#f1f5f9" strokeWidth="0.3" />

                            {(() => {
                                const maxJ = isZoomed ? 50 : 2000;
                                // 修复: 对 ORR 负电流取绝对值后映射，确保坐标始终在 [0, 100] 内
                                const mapJ = (j: number) => {
                                    const absJ = Math.abs(j);
                                    const raw = 100 - (absJ / maxJ) * 100;
                                    return Math.max(0, Math.min(100, raw));
                                };
                                return (
                                    <>
                                        <g className="fill-slate-500 font-black" style={{ fontSize: '7px' }}>
                                            <text x="-6" y="100" textAnchor="end" dominantBaseline="middle">0</text>
                                            <text x="-6" y="75" textAnchor="end" dominantBaseline="middle">{isORR ? `-${Math.round(maxJ / 4)}` : Math.round(maxJ / 4)}</text>
                                            <text x="-6" y="50" textAnchor="end" dominantBaseline="middle">{isORR ? `-${maxJ / 2}` : maxJ / 2}</text>
                                            <text x="-6" y="25" textAnchor="end" dominantBaseline="middle">{isORR ? `-${Math.round(maxJ * 3 / 4)}` : Math.round(maxJ * 3 / 4)}</text>
                                            <text x="-6" y="0" textAnchor="end" dominantBaseline="middle">{isORR ? `-${maxJ}` : maxJ}</text>
                                        </g>
                                        {/* Y轴标题 - 远离刻度数字避免重叠 */}
                                        <text x="-32" y="50" textAnchor="middle" transform="rotate(-90, -32, 50)" style={{ fontSize: '6.5px', fill: '#64748b', fontWeight: 900, letterSpacing: '0.05em' }}>j (mA/cm²)</text>
                                        {/* Y轴小刻度线 */}
                                        {[0, 25, 50, 75, 100].map(yPos => (
                                            <line key={`ytick-${yPos}`} x1="-2" y1={yPos} x2="0" y2={yPos} stroke="#94a3b8" strokeWidth="1.2" />
                                        ))}

                                        <g className="fill-slate-500 font-black" style={{ fontSize: '7px' }}>
                                            <text x="0" y="113" textAnchor="middle">{(effectiveMode === 'OER' || effectiveMode === 'ORR') ? (isBi ? '0.2' : '1.23') : '0.0'}</text>
                                            <text x="50" y="113" textAnchor="middle">{(effectiveMode === 'OER' || effectiveMode === 'ORR') ? (isBi ? '0.4' : '1.33') : '0.1'}</text>
                                            <text x="100" y="113" textAnchor="middle">{(effectiveMode === 'OER' || effectiveMode === 'ORR') ? (isBi ? '1.0' : '1.53') : '0.3'}</text>
                                            <text x="150" y="113" textAnchor="middle">{(effectiveMode === 'OER' || effectiveMode === 'ORR') ? (isBi ? '1.4' : '1.68') : '0.45'}</text>
                                            <text x="200" y="113" textAnchor="middle">{(effectiveMode === 'OER' || effectiveMode === 'ORR') ? (isBi ? '1.8' : '1.83') : '0.6'}</text>
                                        </g>
                                        {/* X轴标题 - 远离刻度数字避免重叠 */}
                                        <text x="100" y="128" textAnchor="middle" style={{ fontSize: '6.5px', fill: '#64748b', fontWeight: 900, letterSpacing: '0.05em' }}>E (V vs. RHE)</text>
                                        {/* X轴小刻度线 */}
                                        {[0, 50, 100, 150, 200].map(xPos => (
                                            <line key={`xtick-${xPos}`} x1={xPos} y1="100" x2={xPos} y2="103" stroke="#94a3b8" strokeWidth="1.2" />
                                        ))}

                                        {showLsvComparison && savedSimulations.map((sim, sIdx) => {
                                            if (sim.reactionMode !== reactionMode || !visibleSimIds.includes(sim.id)) return null;
                                            const pts = generateLSVPoints(
                                                parseFloat(sim.physicalConstants.exchangeCurrentDensity) || 1e-4,
                                                parseFloat(sim.physicalConstants.tafelSlope) || 60,
                                                sim.loading || 1,
                                                sim.reactionMode
                                            );
                                            const colors = ['#f43f5e', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#3b82f6'];
                                            return (
                                                <path
                                                    key={sim.id}
                                                    d={`M 0 100 ${pts.map((p, i) => `L ${(i / (pts.length - 1)) * 200} ${mapJ(p.j)}`).join(' ')}`}
                                                    fill="none" stroke={colors[sIdx % colors.length]} strokeWidth="0.8" opacity="0.6" strokeDasharray="3 2"
                                                />
                                            );
                                        })}

                                        <path d={`M 0 100 ${lsvCurves.map((p: any, i: number) => `L ${(i / (lsvCurves.length - 1)) * 200} ${mapJ(p.jBase)}`).join(' ')}`} fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.4" strokeDasharray="2 1" />
                                        <path d={`M 0 100 ${lsvCurves.map((p: any, i: number) => `L ${(i / (lsvCurves.length - 1)) * 200} ${mapJ(p.jDecay)}`).join(' ')}`} fill="none" stroke="#818cf8" strokeWidth="1.2" opacity="0.6" strokeDasharray="3 2" />
                                        <path d={`M 0 100 ${lsvCurves.map((p: any, i: number) => `L ${(i / (lsvCurves.length - 1)) * 200} ${mapJ(p.jDoped)}`).join(' ')}`} fill="none" stroke="#6366f1" strokeWidth="2.5" />

                                        <line x1="0" y1="100" x2="200" y2="100" stroke="#475569" strokeWidth="2" />
                                        <line x1="0" y1="0" x2="0" y2="100" stroke="#475569" strokeWidth="2" />

                                        <ReferenceLine10 currentPlan={lsvCurves} maxJ={maxJ} isORR={isORR} />
                                    </>
                                );
                            })()}
                        </svg>
                    </div>
                ) : <div className="flex-1 flex items-center justify-center font-black text-slate-400">Loading Kinetics...</div>}
            </div>
        </div>
    );
};