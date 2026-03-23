import React, { useMemo, useState, useEffect } from 'react';
import { getPourbaixParams, calibrateWithDFT, type PourbaixParams } from '../pourbaixData';
import { fetchMPThermoData } from '../../../services/materialsProject';
import { useTranslation } from '../../../locales/useTranslation';

interface Props {
    potential: number;
    pH: number;
    dopingConcentration: number;
    dopingElement?: string;
    coDopingConcentration?: number;
    material?: string;
}

export const StabilityMapChart: React.FC<Props> = ({ potential, pH, dopingConcentration, dopingElement, coDopingConcentration, material = 'NiFe-LDH' }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isLegendExpanded, setIsLegendExpanded] = useState(false);
    const { t } = useTranslation();

    // ═══ 材料特异性参数（本地表 + MP API 校准） ═══
    const [params, setParams] = useState<PourbaixParams>(() => getPourbaixParams(material));

    useEffect(() => {
        // 1. 立即使用本地表参数
        const localParams = getPourbaixParams(material);
        setParams(localParams);

        // 2. 异步尝试 MP API 校准（有 API Key 时）
        let cancelled = false;
        fetchMPThermoData(material).then(thermo => {
            if (cancelled || !thermo) return;
            // 用 DFT 形成能校准标准还原电位（假设 2 电子转移）
            const calibrated = calibrateWithDFT(localParams, thermo.formationEnergyPerAtom, 2);
            console.log(`[Pourbaix] DFT 校准: E⁰ ${localParams.standardReductionPotential.toFixed(3)}V → ${calibrated.standardReductionPotential.toFixed(3)}V (${material})`);
            setParams(calibrated);
        }).catch(() => { /* 静默回退到本地表 */ });

        return () => { cancelled = true; };
    }, [material]);

    // 掺杂化学势偏移（使用材料特异性灵敏度系数）
    const elementalShift = (dopingElement === 'Mo' || dopingElement === 'W' || dopingElement === 'V') ? 0.08 : (dopingElement === 'S' || dopingElement === 'P') ? -0.05 : 0;
    const totalDoping = dopingConcentration + (coDopingConcentration || 0);
    const chemicalPotentialShift = totalDoping * params.dopingSensitivity + elementalShift;

    // --- 严谨物理区域判定 (逻辑必须与下方的 SVG 多边形顶点一致) ---
    const regionInfo = useMemo(() => {
        // 使用材料特异性参数计算边界
        const immunityE = params.standardReductionPotential - (0.0591 * pH) - chemicalPotentialShift;
        const transpassiveE = params.transpassivePotentialAtPH10 - (params.transpassiveSlope * (pH - 10));

        if (potential < immunityE) return {
            id: 'immunity', name: t('mechanism.visualizer.stabilityImmunity'), color: 'bg-emerald-600', border: 'border-emerald-400'
        };

        if (pH < params.acidCriticalPH) return {
            id: 'acidic', name: t('mechanism.visualizer.stabilityAcidic'), color: 'bg-rose-600', border: 'border-rose-400'
        };

        if (pH > params.alkalineCriticalPH || (pH > (params.alkalineCriticalPH - 3) && potential > transpassiveE)) return {
            id: 'alkaline', name: t('mechanism.visualizer.stabilityAlkaline'), color: 'bg-amber-600', border: 'border-amber-400'
        };

        return {
            id: 'passivation', name: t('mechanism.visualizer.stabilityPassivation'), color: 'bg-indigo-600', border: 'border-indigo-400'
        };
    }, [pH, potential, chemicalPotentialShift, params]);

    // [P1] 动态 Pourbaix 边界坐标生成（与 regionInfo 判定逻辑完全一致）
    const pourbaixBoundaries = useMemo(() => {
        // 坐标系映射: x = pH/14 * 100, y = (1 - E/2.2) * 100
        const toX = (ph: number) => Math.max(0, Math.min(100, (ph / 14) * 100));
        const toY = (e: number) => Math.max(0, Math.min(100, (1 - e / 2.2) * 100));

        // 免疫线: E = E⁰ - 0.0591*pH - shift (材料特异性 Nernst 斜率)
        const immunityLine = Array.from({ length: 15 }, (_, i) => {
            const ph = i;
            const e = params.standardReductionPotential - 0.0591 * ph - chemicalPotentialShift;
            return { x: toX(ph), y: toY(e) };
        });

        // 酸性边界: 材料特异性临界 pH
        const acidBoundaryX = toX(params.acidCriticalPH);

        // 过钝化线: 材料特异性参数
        const transpassiveLine = Array.from({ length: 15 }, (_, i) => {
            const ph = i;
            const e = params.transpassivePotentialAtPH10 - params.transpassiveSlope * (ph - 10);
            return { x: toX(ph), y: toY(e) };
        });

        // 碱性边界: 材料特异性临界 pH
        const alkalineBoundaryX = toX(params.alkalineCriticalPH);

        // 水稳定区边界线 (a/b lines)
        const waterOxLine = Array.from({ length: 15 }, (_, i) => {
            const ph = i;
            const e = 1.229 - 0.0591 * ph; // O2/H2O 平衡
            return { x: toX(ph), y: toY(e) };
        });
        const waterRedLine = Array.from({ length: 15 }, (_, i) => {
            const ph = i;
            const e = -0.0591 * ph; // H+/H2 平衡
            return { x: toX(ph), y: toY(e) };
        });

        // 免疫区多边形（底部，免疫线以下）
        const immunityPoly = [
            ...immunityLine.map(p => `${p.x},${p.y}`),
            '100,100', '0,100'
        ].join(' ');

        // 酸性腐蚀区（左侧，pH < acidCriticalPH 且在免疫线以上）
        const immAtpH0 = immunityLine[0];
        const acidIdx = Math.min(14, Math.max(0, Math.round(params.acidCriticalPH)));
        const immAtAcid = immunityLine[acidIdx] || immunityLine[4];
        const acidPoly = [
            `0,0`,
            `${acidBoundaryX},0`,
            `${acidBoundaryX},${immAtAcid.y}`,
            `0,${immAtpH0.y}`
        ].join(' ');

        // 碱性/过钝化区（右侧+高电位）
        const transStartPH = Math.max(0, Math.round(params.alkalineCriticalPH - 3));
        const transAtStart = transpassiveLine[transStartPH];
        const transAtpH14 = transpassiveLine[14];
        const alkalinePoly = [
            `${alkalineBoundaryX},0`,
            `100,0`,
            `100,${transAtpH14.y}`,
            `${transAtStart?.x || alkalineBoundaryX},${transAtStart?.y || 0}`
        ].join(' ');

        // 钝化区（核心区域，其余部分）
        const passivationPoly = [
            `${acidBoundaryX},0`,
            `${alkalineBoundaryX},0`,
            `${transAtStart?.x || alkalineBoundaryX},${transAtStart?.y || 0}`,
            `${transAtpH14.x},${transAtpH14.y}`,
            `${immunityLine[14]?.x || 100},${immunityLine[14]?.y || 80}`,
            `${immAtAcid.x},${immAtAcid.y}`,
            `${acidBoundaryX},${immAtAcid.y}`
        ].join(' ');

        return {
            immunityPoly, acidPoly, alkalinePoly, passivationPoly,
            waterOxLine, waterRedLine,
            immunityLine, transpassiveLine
        };
    }, [chemicalPotentialShift, params]);

    // 坐标映射逻辑 (电位量程 0-2.2V, pH量程 0-14)
    const xPos = useMemo(() => Math.min(98, Math.max(2, (pH / 14) * 100)), [pH]);
    const yPos = useMemo(() => Math.min(98, Math.max(2, (1 - (potential / 2.2)) * 100)), [potential]);

    return (
        <div className="w-full h-full flex flex-col animate-reveal p-6 select-none min-h-[550px] overflow-hidden antialiased">
            {/* 顶部标题与状态 — 极简一行 */}
            <header className="w-full flex justify-between items-center mb-4 shrink-0 relative z-20">
                <div className="flex items-center gap-3">
                    <h5 className="text-lg font-black text-slate-800 tracking-tight leading-none">{t('mechanism.visualizer.stabilityMap')}</h5>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border whitespace-nowrap ${params.source === 'MP-DFT' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : params.source === 'CRC' || params.source === 'NIST' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                        {params.source === 'MP-DFT' ? '⚡ DFT' : params.source === 'Generic' ? t('mechanism.visualizer.stabilityApprox') : params.source} · E⁰={params.standardReductionPotential.toFixed(2)}V
                    </span>
                </div>
                <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase shadow-md border-2 flex items-center gap-2 transition-all duration-500 whitespace-nowrap ${regionInfo.color} text-white ${regionInfo.border}`}>
                    <i className="fa-solid fa-shield-halved text-[8px]"></i>
                    {regionInfo.name}
                </div>
            </header>

            {/* 绘图主核心 */}
            <div className="flex-1 w-full flex items-center justify-center min-h-0 py-1">
                <div className="w-full h-full max-w-[850px] aspect-[1.5/1] grid grid-cols-[50px_1fr] grid-rows-[1fr_40px] gap-0 relative bg-white">

                    {/* Y 轴: 电位 */}
                    <div className="flex flex-col justify-between items-end pr-3 py-2 border-r border-slate-200 text-[10px] font-bold text-slate-400 font-mono">
                        <span>2.2</span>
                        <span>1.6</span>
                        <span>1.1</span>
                        <span>0.5</span>
                        <span>0.0</span>
                    </div>

                    {/* 绘图区 */}
                    <div className="relative border-t border-slate-200 bg-white overflow-hidden">

                        {/* SVG 物理分界图层 */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <polygon points={pourbaixBoundaries.immunityPoly} fill="#10b981" fillOpacity="0.10" />
                            <polygon points={pourbaixBoundaries.acidPoly} fill="#f43f5e" fillOpacity="0.10" />
                            <polygon points={pourbaixBoundaries.passivationPoly} fill="#6366f1" fillOpacity="0.06" />
                            <polygon points={pourbaixBoundaries.alkalinePoly} fill="#f59e0b" fillOpacity="0.12" />

                            {/* 水分解平衡线 */}
                            <polyline
                                points={pourbaixBoundaries.waterRedLine.map(p => `${p.x},${p.y}`).join(' ')}
                                fill="none" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="2.5 1.5" opacity="0.45"
                            />
                            <polyline
                                points={pourbaixBoundaries.waterOxLine.map(p => `${p.x},${p.y}`).join(' ')}
                                fill="none" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2.5 1.5" opacity="0.45"
                            />
                            <polyline
                                points={pourbaixBoundaries.immunityLine.map(p => `${p.x},${p.y}`).join(' ')}
                                fill="none" stroke="#059669" strokeWidth="0.5" strokeDasharray="1.5 1" opacity="0.4"
                            />
                        </svg>

                        {/* 辅助背景网格 */}
                        <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.03] grid grid-cols-7 grid-rows-10">
                            {Array.from({ length: 70 }).map((_, i) => <div key={i} className="border border-slate-900"></div>)}
                        </div>

                        {/* 区域文字标识 + 线条标注 */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute bottom-[8%] left-1/2 -translate-x-1/2 text-[13px] font-black text-emerald-700/40 tracking-[0.5em] whitespace-nowrap">{t('mechanism.visualizer.stabilityImmunity')}</div>
                            <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-[14px] font-black text-indigo-700/25 tracking-[0.6em] whitespace-nowrap">{t('mechanism.visualizer.stabilityPassivation')}</div>
                            <div className="absolute top-[40%] left-[5%] text-[12px] font-black text-rose-700/35 whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>{t('mechanism.visualizer.stabilityAcidic')}</div>
                            <div className="absolute top-[12%] right-[5%] text-[11px] font-black text-amber-700/45 whitespace-nowrap text-right leading-snug">{t('mechanism.visualizer.stabilityAlkaline')}</div>

                            {/* 线条图例 — 固定在右上角，避免遮挡 */}
                            <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-slate-200/60 flex flex-col gap-1 z-10">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-5 h-0 border-t-2 border-dashed border-red-400"></span>
                                    <span className="text-[8px] font-bold text-red-500">O₂/H₂O (b)</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-5 h-0 border-t-2 border-dashed border-blue-400"></span>
                                    <span className="text-[8px] font-bold text-blue-500">H⁺/H₂ (a)</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-5 h-0 border-t-2 border-dashed border-emerald-500"></span>
                                    <span className="text-[8px] font-bold text-emerald-600">E⁰ Line</span>
                                </div>
                            </div>
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
                                <div className={`absolute w-14 h-14 rounded-full animate-ping opacity-20 ${regionInfo.color}`}></div>
                                <div className={`w-6 h-6 rounded-full border-4 shadow-xl z-50 flex items-center justify-center bg-white ${regionInfo.border} group-hover/point:scale-125 transition-transform`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${regionInfo.color}`}></div>
                                </div>

                                {/* 悬浮标签 */}
                                <div className={`absolute bottom-full mb-5 z-[60] whitespace-nowrap transition-all duration-300 pointer-events-none ${isHovered ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'} ${xPos > 70 ? 'right-0' : xPos < 30 ? 'left-0' : 'left-1/2 -translate-x-1/2'}`}>
                                    <div className={`px-4 py-2 rounded-xl shadow-2xl border-2 flex flex-col items-center gap-0.5 text-white ${regionInfo.color} ${regionInfo.border}`}>
                                        <span className="text-[11px] font-black font-mono tracking-tighter">
                                            {potential.toFixed(3)}V / pH {pH.toFixed(1)}
                                        </span>
                                        <span className="text-[7px] font-bold opacity-80 uppercase tracking-wider leading-none">OP. POINT</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 底部 X 轴: pH */}
                    <div className="col-start-2 flex justify-between items-start px-0 pt-3 text-[10px] font-bold text-slate-400 border-t border-slate-200 font-mono">
                        {['0', '2', '4', '6', '8', '10', '12', '14'].map(val => (
                            <span key={val} className="whitespace-nowrap">{val}</span>
                        ))}
                    </div>

                    <div className="absolute bottom-[-16px] left-[50%] -translate-x-1/2 text-[8px] font-bold text-slate-300 uppercase tracking-[0.5em] whitespace-nowrap">pH</div>
                </div>
            </div>

            {/* 底部图例 - Added collapsible functionality as requested */}
            <div className="mt-8 shrink-0 px-2 no-print">
                <button
                    onClick={() => setIsLegendExpanded(!isLegendExpanded)}
                    className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2rem] mb-4 hover:text-indigo-600 transition-colors group"
                >
                    <i className={`fa-solid ${isLegendExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} transition-transform`}></i>
                    <span>LEGEND & NOTES</span>
                    {!isLegendExpanded && <span className="ml-2 px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded text-[7px] border border-indigo-100">Click to expand</span>}
                </button>

                {isLegendExpanded && (
                    <footer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-reveal">
                        {[
                            {
                                key: 'immunity',
                                label: t('mechanism.visualizer.stabilityImmunity'),
                                desc: t('mechanism.visualizer.stabilityImmunityDesc'),
                                color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                                dot: 'bg-emerald-500'
                            },
                            {
                                key: 'passivation',
                                label: t('mechanism.visualizer.stabilityPassivation'),
                                desc: t('mechanism.visualizer.stabilityPassivationDesc'),
                                color: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                                dot: 'bg-indigo-500'
                            },
                            {
                                key: 'acidic',
                                label: t('mechanism.visualizer.stabilityAcidicLabel'),
                                desc: t('mechanism.visualizer.stabilityAcidicDesc'),
                                color: 'bg-rose-50 text-rose-800 border-rose-200',
                                dot: 'bg-rose-500'
                            },
                            {
                                key: 'alkaline',
                                label: t('mechanism.visualizer.stabilityAlkalineLabel'),
                                desc: t('mechanism.visualizer.stabilityAlkalineDesc'),
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
