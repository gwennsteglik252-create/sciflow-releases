/**
 * FreeEnergyDiagramPanel.tsx
 * OER/ORR 四步自由能台阶图可视化（SVG 渲染）
 */
import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
    computeOERFreeEnergy, computeORRFreeEnergy, estimateSpectralModulation,
    FreeEnergyResult, FreeEnergyStep
} from './freeEnergyDiagram';
import { SpectrumDataPoint } from './spectroscopyAnalysis';

interface Props {
    dataset: SpectrumDataPoint[];
}

// ==================== SVG 阶梯图（不含标题） ====================
const StaircaseDiagram: React.FC<{ result: FreeEnergyResult; showIdeal: boolean }> = ({ result, showIdeal }) => {
    const W = 600, H = 320;
    const margin = { top: 20, right: 30, bottom: 50, left: 55 };
    const plotW = W - margin.left - margin.right;
    const plotH = H - margin.top - margin.bottom;

    // 计算累积能量范围
    const allG = [0, ...result.steps.map(s => s.cumulativeG)];
    if (showIdeal) allG.push(...result.idealSteps.map(s => s.cumulativeG));
    const minG = Math.min(...allG) - 0.3;
    const maxG = Math.max(...allG) + 0.3;
    const rangeG = maxG - minG || 1;

    const scaleX = (step: number) => margin.left + (step / (result.steps.length)) * plotW;
    const scaleY = (g: number) => margin.top + plotH - ((g - minG) / rangeG) * plotH;
    const stepW = plotW / (result.steps.length + 0.5);

    const steps = [{ cumulativeG: 0, species: result.mode === 'OER' ? 'H₂O' : 'O₂', label: '初始态', deltaG: 0, isPDS: false }, ...result.steps];
    const idealSteps = [{ cumulativeG: 0, species: '', label: '', deltaG: 0, isPDS: false }, ...result.idealSteps];

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {/* 网格 */}
            {Array.from({ length: 7 }).map((_, i) => {
                const g = minG + (rangeG * i) / 6;
                return (
                    <g key={i}>
                        <line x1={margin.left} y1={scaleY(g)} x2={W - margin.right} y2={scaleY(g)}
                            stroke="#f1f5f9" strokeWidth={1} />
                        <text x={margin.left - 6} y={scaleY(g) + 3} textAnchor="end" fontSize={8} fill="#94a3b8">
                            {g.toFixed(1)}
                        </text>
                    </g>
                );
            })}

            {/* 零线 */}
            <line x1={margin.left} y1={scaleY(0)} x2={W - margin.right} y2={scaleY(0)}
                stroke="#94a3b8" strokeWidth={1} strokeDasharray="6 3" />

            {/* 理想催化剂（灰色虚线） */}
            {showIdeal && idealSteps.map((s, i) => {
                if (i >= idealSteps.length) return null;
                const x1 = margin.left + i * stepW;
                const x2 = x1 + stepW * 0.75;
                const y = scaleY(s.cumulativeG);
                return (
                    <g key={`ideal-${i}`}>
                        <line x1={x1} y1={y} x2={x2} y2={y} stroke="#cbd5e1" strokeWidth={2} strokeDasharray="4 3" />
                        {i < idealSteps.length - 1 && (
                            <line x1={x2} y1={y} x2={margin.left + (i + 1) * stepW} y2={scaleY(idealSteps[i + 1].cumulativeG)}
                                stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" />
                        )}
                    </g>
                );
            })}

            {/* 实际催化剂能级 */}
            {steps.map((s, i) => {
                const x1 = margin.left + i * stepW;
                const x2 = x1 + stepW * 0.75;
                const y = scaleY(s.cumulativeG);
                const color = s.isPDS ? '#f43f5e' : '#6366f1';

                return (
                    <g key={`step-${i}`}>
                        {/* 能级台阶 */}
                        <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth={3} strokeLinecap="round" />

                        {/* 连接线（到下一步） */}
                        {i < steps.length - 1 && (
                            <line x1={x2} y1={y} x2={margin.left + (i + 1) * stepW} y2={scaleY(steps[i + 1].cumulativeG)}
                                stroke={color} strokeWidth={1.5} strokeDasharray="4 2" opacity={0.6} />
                        )}

                        {/* ΔG 标注 */}
                        {i > 0 && (
                            <text x={(x1 + x2) / 2} y={y - 12} textAnchor="middle" fontSize={8} fontWeight="bold"
                                fill={s.isPDS ? '#f43f5e' : '#6366f1'}>
                                ΔG={s.deltaG.toFixed(2)} eV
                            </text>
                        )}

                        {/* 物种名称 */}
                        <text x={(x1 + x2) / 2} y={y + 16} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#334155">
                            {s.species}
                        </text>

                        {/* PDS 标记 */}
                        {s.isPDS && (
                            <>
                                <rect x={(x1 + x2) / 2 - 15} y={y - 30} width={30} height={14} rx={4} fill="#f43f5e" />
                                <text x={(x1 + x2) / 2} y={y - 21} textAnchor="middle" fontSize={7} fontWeight="bold" fill="white">PDS</text>
                            </>
                        )}
                    </g>
                );
            })}

            {/* Y轴标签 */}
            <text x={12} y={margin.top + plotH / 2} textAnchor="middle" fontSize={10} fontWeight="bold"
                fill="#64748b" transform={`rotate(-90, 12, ${margin.top + plotH / 2})`}>
                ΔG (eV)
            </text>
        </svg>
    );
};

// ==================== 可拖拽标题组件 ====================
const DraggableTitle: React.FC<{ text: string }> = ({ text }) => {
    const titleRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number }>({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
    const [isCentered, setIsCentered] = useState(true);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);

        // 如果是初始居中状态，先计算当前实际位置
        if (isCentered && titleRef.current) {
            const el = titleRef.current;
            const parent = el.parentElement;
            if (parent) {
                const parentRect = parent.getBoundingClientRect();
                const elRect = el.getBoundingClientRect();
                const currentX = elRect.left - parentRect.left - (parentRect.width / 2 - elRect.width / 2);
                const currentY = 0;
                setPosition({ x: currentX, y: currentY });
                setIsCentered(false);
                dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, posX: currentX, posY: currentY };
            }
        } else {
            dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, posX: position.x, posY: position.y };
        }
    }, [position, isCentered]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const dx = e.clientX - dragStartRef.current.mouseX;
            const dy = e.clientY - dragStartRef.current.mouseY;
            setPosition({
                x: dragStartRef.current.posX + dx,
                y: dragStartRef.current.posY + dy,
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    return (
        <div
            ref={titleRef}
            onMouseDown={handleMouseDown}
            style={{
                position: 'absolute',
                top: 12,
                ...(isCentered
                    ? { left: '50%', transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)` }
                    : { left: '50%', transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)` }
                ),
                zIndex: 10,
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                padding: '4px 14px',
                borderRadius: 8,
                background: isDragging ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(4px)',
                boxShadow: isDragging
                    ? '0 4px 16px rgba(99,102,241,0.18), 0 0 0 2px rgba(99,102,241,0.15)'
                    : '0 1px 4px rgba(0,0,0,0.06)',
                transition: isDragging ? 'none' : 'box-shadow 0.2s, background 0.2s',
                fontSize: 15,
                fontWeight: 800,
                color: '#334155',
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
            }}
            title="拖拽移动标题"
        >
            <span style={{ marginRight: 6, opacity: 0.35, fontSize: 12 }}>⠿</span>
            {text}
        </div>
    );
};

// ==================== 主面板 ====================
const FreeEnergyDiagramPanel: React.FC<Props> = ({ dataset }) => {
    const [mode, setMode] = useState<'OER' | 'ORR'>('OER');
    const [potential, setPotential] = useState(0);
    const [catalystType, setCatalystType] = useState('default');
    const [showIdeal, setShowIdeal] = useState(true);
    const [useSpectralModulation, setUseSpectralModulation] = useState(true);

    // 光谱调制因子
    const spectralMod = useMemo(() => {
        if (!useSpectralModulation || dataset.length === 0) return undefined;
        return estimateSpectralModulation(dataset);
    }, [dataset, useSpectralModulation]);

    // 计算自由能
    const result = useMemo(() => {
        if (mode === 'OER') {
            return computeOERFreeEnergy(potential, catalystType, spectralMod);
        } else {
            return computeORRFreeEnergy(potential === 0 ? 1.23 : potential, catalystType, spectralMod);
        }
    }, [mode, potential, catalystType, spectralMod]);

    const titleText = `${result.mode} Free Energy Diagram (U = ${result.appliedPotential.toFixed(2)} V)`;

    const catalystOptions = [
        { value: 'default', label: '通用催化剂' },
        { value: 'CoFe₂O₄', label: 'CoFe₂O₄' },
        { value: 'Co₃O₄', label: 'Co₃O₄' },
        { value: 'NiFe-LDH', label: 'NiFe-LDH' },
        { value: 'IrO₂', label: 'IrO₂ (基准)' },
    ];

    return (
        <div className="h-full flex flex-col gap-4">
            {/* 控制栏 */}
            <div className="flex items-center gap-4 px-2 shrink-0 flex-wrap">
                {/* 模式切换 */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                    <button onClick={() => { setMode('OER'); setPotential(0); }}
                        className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${mode === 'OER' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>
                        OER
                    </button>
                    <button onClick={() => { setMode('ORR'); setPotential(1.23); }}
                        className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${mode === 'ORR' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
                        ORR
                    </button>
                </div>

                {/* 电位 */}
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase">U (V)</span>
                    <input
                        type="range"
                        min={0} max={mode === 'OER' ? 2.0 : 1.23} step={0.01}
                        value={potential}
                        onChange={e => setPotential(Number(e.target.value))}
                        className="w-28 accent-indigo-600"
                    />
                    <span className="text-[10px] font-mono font-bold text-slate-600 w-12 text-center">{potential.toFixed(2)}</span>
                </div>

                {/* 催化剂类型 */}
                <select
                    value={catalystType}
                    onChange={e => setCatalystType(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 focus:border-indigo-400 outline-none"
                >
                    {catalystOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>

                {/* 开关 */}
                <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={showIdeal} onChange={e => setShowIdeal(e.target.checked)}
                        className="accent-indigo-600 w-3.5 h-3.5" />
                    <span className="text-[9px] font-black text-slate-500 uppercase">理想催化剂</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={useSpectralModulation} onChange={e => setUseSpectralModulation(e.target.checked)}
                        className="accent-indigo-600 w-3.5 h-3.5" />
                    <span className="text-[9px] font-black text-slate-500 uppercase">光谱调制</span>
                </label>
            </div>

            {/* 阶梯图（含可拖拽标题） */}
            <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex items-center justify-center"
                style={{ position: 'relative', overflow: 'hidden' }}>
                <DraggableTitle text={titleText} />
                <StaircaseDiagram result={result} showIdeal={showIdeal} />
            </div>

            {/* 指标卡片 */}
            <div className="grid grid-cols-4 gap-3 shrink-0">
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <span className="text-[8px] font-black text-slate-400 uppercase">理论过电位</span>
                    <p className="text-lg font-black text-indigo-600">{result.theoreticalOverpotential.toFixed(2)} <span className="text-[9px]">V</span></p>
                </div>
                <div className={`p-3 rounded-xl border shadow-sm ${result.steps.find(s => s.isPDS) ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-100'}`}>
                    <span className="text-[8px] font-black text-slate-400 uppercase">PDS 步骤</span>
                    <p className="text-lg font-black text-rose-600">
                        Step {result.pdsStep}
                        <span className="text-[9px] font-bold text-rose-400 ml-1">{result.steps[result.pdsStep - 1]?.species}</span>
                    </p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <span className="text-[8px] font-black text-slate-400 uppercase">PDS ΔG</span>
                    <p className="text-lg font-black text-amber-600">{result.steps[result.pdsStep - 1]?.deltaG.toFixed(3)} <span className="text-[9px]">eV</span></p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                    <span className="text-[8px] font-black text-slate-400 uppercase">施加电位</span>
                    <p className="text-lg font-black text-slate-700">{potential.toFixed(2)} <span className="text-[9px]">V</span></p>
                </div>
            </div>
        </div>
    );
};

export default FreeEnergyDiagramPanel;
