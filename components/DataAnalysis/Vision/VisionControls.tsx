
import React, { RefObject, useEffect } from 'react';
import { AnalysisMode, LatticeResult, DefectAnalysisResult, ParticleData } from './types';

interface VisionControlsProps {
    mode: AnalysisMode;
    temMode: 'lattice' | 'fft' | 'defect' | 'particle' | 'angle' | 'saed' | 'eds';
    semMode?: 'particle' | 'sheet';

    // SEM Props
    scaleRatio?: number | null;
    particles?: ParticleData[];
    sheetStats?: { porosity: number; edgeDensity: number } | null;
    useWatershedSplit?: boolean;
    setUseWatershedSplit?: (use: boolean) => void;
    particleStrictnessLevel?: number;
    setParticleStrictnessLevel?: (val: number) => void;
    semParticleDiagnostics?: {
        agglomerationRatio: number;
        rawComponentCount: number;
        finalParticleCount: number;
        splitAddedCount: number;
    } | null;

    // XRD Props
    xrdOptions: { smooth: boolean; removeBg: boolean };
    onXrdOptionChange: (option: 'smooth' | 'removeBg') => void;
    xrdConfig: { wavelength: number; shapeFactor: number };
    setXrdConfig: (config: { wavelength: number; shapeFactor: number }) => void;
    showStandardLine: boolean;
    setShowStandardLine: (show: boolean) => void;
    detectedPeaksCount: number;
    hasRawData?: boolean;

    // TEM Props
    latticeLayers: string;
    setLatticeLayers: (layers: string) => void;
    latticeResult: LatticeResult | null;
    fftCanvasRef: RefObject<HTMLCanvasElement | null>;
    defectStats: DefectAnalysisResult | null;
    fftPreview?: ImageData | null;
    fftSize?: number;
    setFftSize?: (size: number) => void;

    // TEM Angle mode
    angleLine1?: any;
    angleLine2?: any;
    angleDrawingLine?: 1 | 2;
    angleLayers1?: string;
    setAngleLayers1?: (val: string) => void;
    angleLayers2?: string;
    setAngleLayers2?: (val: string) => void;
    angleResult?: any;
    setAngleLine1?: (val: any) => void;
    setAngleLine2?: (val: any) => void;
    setAngleResult?: (val: any) => void;
    setAngleDrawingLine?: (val: 1 | 2) => void;

    // TEM SAED mode
    saedResult?: any;

    // TEM EDS mode
    edsLayers?: any[];
    setEdsLayers?: (val: any[]) => void;
}

const ParamRow: React.FC<{ label: string; value: string | number; unit?: string }> = ({ label, value, unit }) => (
    <div className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
        <span className="text-[10px] font-bold text-slate-500">{label}</span>
        <span className="text-[10px] font-black text-slate-700">{value}{unit ? <span className="text-slate-400 font-bold ml-0.5">{unit}</span> : null}</span>
    </div>
);

const VisionControls: React.FC<VisionControlsProps> = ({
    mode, temMode, semMode,
    scaleRatio, particles, sheetStats, useWatershedSplit, setUseWatershedSplit, particleStrictnessLevel, setParticleStrictnessLevel, semParticleDiagnostics,
    xrdOptions, onXrdOptionChange, xrdConfig, setXrdConfig, showStandardLine, setShowStandardLine, detectedPeaksCount, hasRawData,
    latticeLayers, setLatticeLayers, latticeResult, fftCanvasRef, defectStats, fftPreview, fftSize, setFftSize,
    angleLine1, angleLine2, angleDrawingLine, angleLayers1, setAngleLayers1, angleLayers2, setAngleLayers2, angleResult,
    setAngleLine1, setAngleLine2, setAngleResult, setAngleDrawingLine,
    saedResult,
    edsLayers, setEdsLayers
}) => {
    // Render FFT preview onto canvas when data is available
    useEffect(() => {
        if (fftPreview && fftCanvasRef?.current) {
            const ctx = fftCanvasRef.current.getContext('2d');
            if (ctx) {
                ctx.putImageData(fftPreview, 0, 0);
            }
        }
    }, [fftPreview, fftCanvasRef]);

    /* ═══ SEM Mode ═══ */
    if (mode === 'SEM') {
        if (semMode === 'particle') {
            const strictness = Math.max(0, Math.min(100, Number(particleStrictnessLevel ?? 50)));
            const strictLabel = strictness < 34 ? '保守' : strictness > 66 ? '激进' : '平衡';
            const t = strictness <= 50 ? strictness / 50 : (strictness - 50) / 50;
            const lerp = (a: number, b: number) => a + (b - a) * t;
            const strictMinArea = strictness <= 50 ? lerp(30, 20) : lerp(20, 12);
            const strictCircularity = strictness <= 50 ? lerp(0.34, 0.22) : lerp(0.22, 0.15);
            const count = particles?.length || 0;
            const sizes = (particles || []).map(p => p.realSize || 0).filter(v => v > 0);
            const hasStats = sizes.length > 0;
            const avg = hasStats ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0;
            const max = hasStats ? Math.max(...sizes) : 0;
            const min = hasStats ? Math.min(...sizes) : 0;
            const std = hasStats ? Math.sqrt(sizes.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) / sizes.length) : 0;
            const pdi = avg > 0 ? std / avg : 0;

            return (
                <div className="flex flex-col gap-2 animate-reveal">
                    {/* 算法参数 */}
                    <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                        <h5 className="text-[10px] font-black text-indigo-600 uppercase mb-2 flex items-center gap-1.5">
                            <i className="fa-solid fa-sliders text-[9px]"></i> 检测算法参数
                        </h5>
                        <div className="bg-white rounded-lg p-2 border border-indigo-50">
                            <ParamRow label="自适应阈值 Block" value={31} unit="px" />
                            <ParamRow label="阈值偏移 C" value={15} />
                            <ParamRow label="严格度模式" value={strictLabel} />
                            <ParamRow label="圆度下限" value={strictCircularity.toFixed(3)} />
                            <ParamRow label="最小面积" value={strictMinArea.toFixed(1)} unit="px²" />
                            <ParamRow label="最大检测" value={500} unit="个" />
                        </div>
                        <div className="mt-2">
                            <button
                                onClick={() => setUseWatershedSplit?.(!useWatershedSplit)}
                                className={`w-full py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${useWatershedSplit ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'}`}
                            >
                                <i className="fa-solid fa-object-ungroup mr-1"></i>
                                Watershed 拆分: {useWatershedSplit ? '开' : '关'}
                            </button>
                        </div>
                        <div className="mt-2 bg-white rounded-lg border border-indigo-100 px-2 py-2">
                            <div className="flex items-center justify-between text-[8px] font-black text-slate-500 uppercase mb-1">
                                <span>保守</span>
                                <span>严格度 {Math.round(strictness)}</span>
                                <span>激进</span>
                            </div>
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={Math.round(strictness)}
                                onChange={(e) => setParticleStrictnessLevel?.(Number(e.target.value))}
                                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <div className="text-[8px] text-indigo-600 font-black text-center mt-1">{strictLabel}</div>
                        </div>
                    </div>

                    {/* 标尺状态 */}
                    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-bold ${scaleRatio ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                        <i className={`fa-solid ${scaleRatio ? 'fa-ruler-combined' : 'fa-triangle-exclamation'} text-[10px]`}></i>
                        {scaleRatio ? `已校准: 1px = ${scaleRatio.toFixed(4)} nm` : '未校准标尺（尺寸单位为 px）'}
                    </div>

                    {/* 实时统计 */}
                    {count > 0 && (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <h5 className="text-[10px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                                <i className="fa-solid fa-chart-simple text-[9px]"></i> 颗粒统计
                            </h5>
                            <div className="bg-white rounded-lg p-2 border border-slate-100">
                                <ParamRow label="检出颗粒" value={count} unit="个" />
                                {hasStats && (
                                    <>
                                        <ParamRow label="平均等效粒径" value={avg.toFixed(2)} unit="nm" />
                                        <ParamRow label="最大 / 最小" value={`${max.toFixed(1)} / ${min.toFixed(1)}`} unit="nm" />
                                        <ParamRow label="标准偏差" value={std.toFixed(2)} unit="nm" />
                                        <ParamRow label="PDI" value={pdi.toFixed(3)} />
                                    </>
                                )}
                            </div>
                            {semParticleDiagnostics && (
                                <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 mt-2">
                                    <h6 className="text-[9px] font-black text-amber-700 uppercase mb-1 flex items-center gap-1">
                                        <i className="fa-solid fa-link-slash text-[8px]"></i> 团聚与拆分
                                    </h6>
                                    <div className="bg-white rounded-md border border-amber-100 p-2">
                                        <ParamRow label="团聚占比" value={semParticleDiagnostics.agglomerationRatio.toFixed(1)} unit="%" />
                                        <ParamRow label="拆分前连通域" value={semParticleDiagnostics.rawComponentCount} unit="个" />
                                        <ParamRow label="拆分后颗粒数" value={semParticleDiagnostics.finalParticleCount} unit="个" />
                                        <ParamRow label="净增颗粒" value={`+${semParticleDiagnostics.splitAddedCount}`} unit="个" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <p className="text-[8px] text-slate-400 italic text-center">点击画布颗粒可手动移除</p>
                </div>
            );
        }

        if (semMode === 'sheet') {
            return (
                <div className="flex flex-col gap-2 animate-reveal">
                    {/* 算法参数 */}
                    <div className="bg-violet-50/60 p-3 rounded-xl border border-violet-100">
                        <h5 className="text-[10px] font-black text-violet-600 uppercase mb-2 flex items-center gap-1.5">
                            <i className="fa-solid fa-sliders text-[9px]"></i> 片层检测参数
                        </h5>
                        <div className="bg-white rounded-lg p-2 border border-violet-50">
                            <ParamRow label="孔隙阈值系数" value={0.65} unit="×avg" />
                            <ParamRow label="Sobel 边缘阈值" value={50} />
                            <ParamRow label="灰度加权" value="BT.601" />
                        </div>
                    </div>

                    {/* 标尺状态 */}
                    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-bold ${scaleRatio ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                        <i className={`fa-solid ${scaleRatio ? 'fa-ruler-combined' : 'fa-triangle-exclamation'} text-[10px]`}></i>
                        {scaleRatio ? `已校准: 1px = ${scaleRatio.toFixed(4)} nm` : '未校准标尺'}
                    </div>

                    {/* 片层统计 */}
                    {sheetStats && (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <h5 className="text-[10px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                                <i className="fa-solid fa-chart-area text-[9px]"></i> 片层度量
                            </h5>
                            <div className="bg-white rounded-lg p-2 border border-slate-100">
                                <ParamRow label="有效空隙率" value={sheetStats.porosity.toFixed(2)} unit="%" />
                                <ParamRow label="活性边缘密度" value={sheetStats.edgeDensity.toFixed(4)} unit="μm⁻¹" />
                                <ParamRow label="分形维数估算" value={(2 + sheetStats.porosity * 0.5).toFixed(2)} />
                            </div>
                        </div>
                    )}

                    <p className="text-[8px] text-slate-400 italic text-center">孔隙区域将以红色叠加层标注</p>
                </div>
            );
        }

        return null;
    }

    if (mode === 'XRD') {
        return (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-reveal">
                <h5 className="text-[10px] font-black text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-calculator"></i> 谢乐计算器 (Scherrer)
                </h5>

                {/* Data Preprocessing Controls */}
                <div className="flex gap-2 mb-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm relative group">
                    <button
                        onClick={() => hasRawData && onXrdOptionChange('smooth')}
                        disabled={!hasRawData}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border ${!hasRawData ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400' : xrdOptions.smooth ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'}`}
                    >
                        <i className="fa-solid fa-wave-square mr-1"></i> Smooth
                    </button>
                    <button
                        onClick={() => hasRawData && onXrdOptionChange('removeBg')}
                        disabled={!hasRawData}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border ${!hasRawData ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400' : xrdOptions.removeBg ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'}`}
                    >
                        <i className="fa-solid fa-scissors mr-1"></i> No Bg
                    </button>
                    {!hasRawData && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                            需上传原始数据文件 (.xy/.csv)
                        </div>
                    )}
                </div>
                {!hasRawData && <p className="text-[8px] text-amber-500 font-bold mb-3 text-center">* 仅支持数据文件预处理</p>}

                <div className="space-y-3">
                    <div>
                        <label className="text-[8px] font-bold text-slate-400 block mb-1">X-Ray Wavelength (nm)</label>
                        <input type="number" step="0.00001" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none" value={xrdConfig.wavelength} onChange={e => setXrdConfig({ ...xrdConfig, wavelength: parseFloat(e.target.value) })} />
                    </div>
                    <div>
                        <label className="text-[8px] font-bold text-slate-400 block mb-1">Shape Factor (K)</label>
                        <input type="number" step="0.01" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none" value={xrdConfig.shapeFactor} onChange={e => setXrdConfig({ ...xrdConfig, shapeFactor: parseFloat(e.target.value) })} />
                    </div>
                    <button onClick={() => setShowStandardLine(!showStandardLine)} className={`w-full py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${showStandardLine ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200'}`}>
                        {showStandardLine ? 'Hide Ag Standard' : 'Show Ag (111) Std'}
                    </button>
                </div>
                <p className="text-[8px] text-slate-400 mt-3 italic text-center">Click peak tip on image to analyze</p>
            </div>
        );
    }

    if (mode === 'TEM') {
        return (
            <>
                {temMode === 'lattice' && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-reveal">
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Lattice Layers (N)</label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none text-center shadow-sm"
                                value={latticeLayers}
                                onChange={(e) => setLatticeLayers(e.target.value)}
                            />
                        </div>
                        {latticeResult && (
                            <div className="mt-4 text-center">
                                <p className="text-[8px] text-slate-400 uppercase font-black">d-spacing</p>
                                <p className="text-xl font-black text-indigo-600">{latticeResult.dSpacing.toFixed(3)} nm</p>
                                {latticeResult.material !== 'Unknown' && (
                                    <p className="text-[9px] text-emerald-600 font-bold mt-1 bg-emerald-50 py-1 rounded border border-emerald-100">
                                        Matched: {latticeResult.material} {latticeResult.planeFamily}
                                    </p>
                                )}
                            </div>
                        )}
                        <p className="text-[8px] text-slate-400 mt-3 italic text-center">Drag on image to measure</p>
                    </div>
                )}

                {temMode === 'fft' && (
                    <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 animate-reveal flex flex-col items-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-3 w-full text-left flex justify-between">
                            <span>FFT Preview ({fftSize || 128}px)</span>
                            <span className="text-indigo-400">Live</span>
                        </p>
                        <canvas
                            ref={fftCanvasRef}
                            width={fftSize || 128}
                            height={fftSize || 128}
                            className="bg-black rounded-lg border border-slate-700 shadow-inner"
                            style={{ width: '128px', height: '128px' }}
                        />
                        {setFftSize && (
                            <div className="w-full mt-3">
                                <label className="text-[8px] font-bold text-slate-500 block mb-1">Region Size: {fftSize || 128}px</label>
                                <input
                                    type="range" min={64} max={256} step={32}
                                    value={fftSize || 128}
                                    onChange={e => setFftSize(parseInt(e.target.value))}
                                    className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                                <div className="flex justify-between text-[7px] text-slate-600 mt-0.5">
                                    <span>64</span><span>128</span><span>192</span><span>256</span>
                                </div>
                            </div>
                        )}
                        <p className="text-[8px] text-slate-500 mt-3 italic">Drag on image to place region</p>
                    </div>
                )}

                {temMode === 'defect' && defectStats && (
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 animate-reveal">
                        <p className="text-[9px] font-black text-amber-500 uppercase mb-2">Defect Density (Dislocation)</p>
                        <p className="text-2xl font-black text-amber-700">{defectStats.defectDensity.toFixed(2)}%</p>
                        <p className="text-[9px] text-slate-500 mt-2 font-bold bg-white/50 px-2 py-1 rounded inline-block">
                            Active Sites: {defectStats.activeSitesEstimate}
                        </p>
                    </div>
                )}

                {/* TEM Particle Mode */}
                {temMode === 'particle' && (
                    <div className="flex flex-col gap-2 animate-reveal">
                        <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                            <h5 className="text-[10px] font-black text-indigo-600 uppercase mb-2 flex items-center gap-1.5">
                                <i className="fa-solid fa-braille text-[9px]"></i> TEM 纳米粒子检测
                            </h5>
                            <div className="bg-white rounded-lg p-2 border border-indigo-50">
                                <ParamRow label="检测算法" value="Connected Component" />
                                <ParamRow label="最小面积" value={20} unit="px²" />
                                <ParamRow label="圆度过滤" value={0.3} />
                            </div>
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[10px] font-bold ${scaleRatio ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                            <i className={`fa-solid ${scaleRatio ? 'fa-ruler-combined' : 'fa-triangle-exclamation'} text-[10px]`}></i>
                            {scaleRatio ? `已校准: 1px = ${scaleRatio.toFixed(4)} nm` : '未校准标尺'}
                        </div>
                        {particles && particles.length > 0 && (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <h5 className="text-[10px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                                    <i className="fa-solid fa-chart-simple text-[9px]"></i> 纳米粒径统计
                                </h5>
                                <div className="bg-white rounded-lg p-2 border border-slate-100">
                                    <ParamRow label="检出粒子" value={particles.length} unit="个" />
                                    {(() => {
                                        const sizes = particles.map(p => p.realSize || 0).filter(v => v > 0);
                                        if (sizes.length === 0) return null;
                                        const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
                                        const std = Math.sqrt(sizes.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) / sizes.length);
                                        return (<>
                                            <ParamRow label="平均粒径" value={avg.toFixed(2)} unit="nm" />
                                            <ParamRow label="标准偏差" value={std.toFixed(2)} unit="nm" />
                                            <ParamRow label="PDI" value={(std / avg).toFixed(3)} />
                                        </>);
                                    })()}
                                </div>
                            </div>
                        )}
                        <p className="text-[8px] text-slate-400 italic text-center">点击画布粒子可手动移除</p>
                    </div>
                )}

                {/* TEM Angle Mode */}
                {temMode === 'angle' && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-reveal">
                        <h5 className="text-[9px] font-black text-slate-400 uppercase mb-3 flex items-center gap-1.5">
                            <i className="fa-solid fa-drafting-compass text-[9px]"></i> 晶面夹角测量
                        </h5>
                        <div className="space-y-2 mb-3">
                            <div>
                                <label className="text-[8px] font-bold text-cyan-500 block mb-1">线 1 层数 (N₁)</label>
                                <input type="number" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none text-center shadow-sm"
                                    value={angleLayers1 || '10'} onChange={e => setAngleLayers1?.(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[8px] font-bold text-fuchsia-500 block mb-1">线 2 层数 (N₂)</label>
                                <input type="number" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none text-center shadow-sm"
                                    value={angleLayers2 || '10'} onChange={e => setAngleLayers2?.(e.target.value)} />
                            </div>
                        </div>
                        <div className={`px-3 py-2 rounded-lg text-[9px] font-bold text-center ${angleDrawingLine === 1 ? 'bg-cyan-50 text-cyan-600 border border-cyan-200' : 'bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-200'}`}>
                            正在绘制: {angleDrawingLine === 1 ? '第一条线 (青色)' : '第二条线 (品红色)'}
                        </div>
                        {angleResult && (
                            <div className="mt-3 text-center space-y-1">
                                <p className="text-[8px] text-slate-400 uppercase font-black">测量结果</p>
                                <p className="text-2xl font-black text-indigo-600">{angleResult.angleDeg.toFixed(1)}°</p>
                                <div className="flex gap-2 text-[8px]">
                                    <span className="flex-1 px-2 py-1 bg-cyan-50 rounded border border-cyan-100 text-cyan-700 font-bold">
                                        d₁ = {angleResult.line1DSpacing.toFixed(3)} nm {angleResult.line1Plane || ''}
                                    </span>
                                    <span className="flex-1 px-2 py-1 bg-fuchsia-50 rounded border border-fuchsia-100 text-fuchsia-700 font-bold">
                                        d₂ = {angleResult.line2DSpacing.toFixed(3)} nm {angleResult.line2Plane || ''}
                                    </span>
                                </div>
                                {angleResult.zoneAxis && (
                                    <p className="text-[9px] text-emerald-600 font-bold mt-1 bg-emerald-50 py-1 rounded border border-emerald-100">
                                        Zone Axis: {angleResult.zoneAxis}
                                    </p>
                                )}
                            </div>
                        )}
                        {angleLine1 && (
                            <button onClick={() => { setAngleLine1?.(null); setAngleLine2?.(null); setAngleResult?.(null); setAngleDrawingLine?.(1); }}
                                className="w-full mt-3 py-1.5 bg-rose-50 text-rose-500 rounded-lg text-[9px] font-bold border border-rose-100 hover:bg-rose-100">
                                <i className="fa-solid fa-rotate-left mr-1"></i>重置测量
                            </button>
                        )}
                        <p className="text-[8px] text-slate-400 mt-2 italic text-center">依次拖拽两条晶格方向线</p>
                    </div>
                )}

                {/* TEM SAED Mode */}
                {temMode === 'saed' && (
                    <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 animate-reveal">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-3 flex items-center gap-1.5">
                            <i className="fa-solid fa-bullseye text-indigo-400 text-[9px]"></i>
                            <span>SAED 衍射环分析</span>
                        </p>
                        {saedResult ? (
                            <div className="space-y-2">
                                <div className={`px-3 py-2 rounded-lg text-[10px] font-bold text-center ${saedResult.crystalType === 'polycrystalline' ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700' :
                                        saedResult.crystalType === 'single-crystal' ? 'bg-indigo-900/50 text-indigo-300 border border-indigo-700' :
                                            'bg-amber-900/50 text-amber-300 border border-amber-700'
                                    }`}>
                                    {saedResult.crystalType === 'polycrystalline' ? '多晶 (Polycrystalline)' :
                                        saedResult.crystalType === 'single-crystal' ? '单晶 (Single Crystal)' :
                                            saedResult.crystalType === 'amorphous' ? '非晶 (Amorphous)' : '未知'}
                                </div>
                                {saedResult.rings.map((ring: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-slate-800 rounded-lg border border-slate-700">
                                        <span className="w-5 h-5 rounded-full bg-indigo-500/30 flex items-center justify-center text-[8px] font-black text-indigo-300">{i + 1}</span>
                                        <div className="flex-1">
                                            <span className="text-[9px] font-bold text-white">d = {ring.dSpacing.toFixed(3)} nm</span>
                                            {ring.hkl && <span className="text-[8px] text-emerald-400 ml-1.5">{ring.material} {ring.hkl}</span>}
                                        </div>
                                        <span className="text-[8px] text-slate-500">{ring.radiusPx}px</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[9px] text-slate-500 text-center py-4">点击衍射图案中心以开始分析</p>
                        )}
                    </div>
                )}

                {/* TEM EDS Mode */}
                {temMode === 'eds' && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 animate-reveal">
                        <h5 className="text-[9px] font-black text-slate-400 uppercase mb-3 flex items-center gap-1.5">
                            <i className="fa-solid fa-layer-group text-[9px]"></i> EDS 元素映射
                        </h5>
                        {/* Upload new layer */}
                        <label className="w-full py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase shadow-sm hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer mb-2">
                            <i className="fa-solid fa-plus text-[9px]"></i> 添加元素层
                            <input type="file" accept="image/*" className="hidden" onChange={e => {
                                const file = e.target.files?.[0];
                                if (!file || !setEdsLayers) return;
                                const reader = new FileReader();
                                reader.onload = () => {
                                    const element = file.name.replace(/\.[^.]+$/, '').substring(0, 5);
                                    const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];
                                    const newLayer = {
                                        id: Date.now().toString(),
                                        element,
                                        color: colors[(edsLayers?.length || 0) % colors.length],
                                        imageSrc: reader.result as string,
                                        opacity: 0.5,
                                        visible: true
                                    };
                                    setEdsLayers([...(edsLayers || []), newLayer]);
                                };
                                reader.readAsDataURL(file);
                                e.target.value = '';
                            }} />
                        </label>
                        {/* Layer list */}
                        {edsLayers && edsLayers.length > 0 && (
                            <div className="space-y-1.5">
                                {edsLayers.map((layer: any) => (
                                    <div key={layer.id} className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-lg border border-slate-200">
                                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: layer.color }}></div>
                                        <input className="flex-1 text-[10px] font-bold outline-none bg-transparent w-0" value={layer.element}
                                            onChange={e => {
                                                if (!setEdsLayers) return;
                                                const updated = edsLayers.map((l: any) => l.id === layer.id ? { ...l, element: e.target.value } : l);
                                                setEdsLayers(updated);
                                            }} />
                                        <input type="range" min={0} max={100} value={Math.round(layer.opacity * 100)} className="w-16 h-1 accent-indigo-500"
                                            onChange={e => {
                                                if (!setEdsLayers) return;
                                                const updated = edsLayers.map((l: any) => l.id === layer.id ? { ...l, opacity: parseInt(e.target.value) / 100 } : l);
                                                setEdsLayers(updated);
                                            }} />
                                        <button onClick={() => {
                                            if (!setEdsLayers) return;
                                            setEdsLayers(edsLayers.map((l: any) => l.id === layer.id ? { ...l, visible: !l.visible } : l));
                                        }} className={`w-5 h-5 rounded flex items-center justify-center text-[8px] ${layer.visible ? 'text-indigo-500' : 'text-slate-300'}`}>
                                            <i className={`fa-solid ${layer.visible ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                                        </button>
                                        <button onClick={() => setEdsLayers?.(edsLayers.filter((l: any) => l.id !== layer.id))} className="w-5 h-5 rounded flex items-center justify-center text-[8px] text-rose-400 hover:text-rose-600">
                                            <i className="fa-solid fa-xmark"></i>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="text-[8px] text-slate-400 mt-2 italic text-center">上传各元素 EDS mapping 图，自动叠加显示</p>
                    </div>
                )}
            </>
        );
    }

    return null;
};

export default VisionControls;
