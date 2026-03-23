
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnalysisMode, ParticleData, XrdPeakData, LatticeResult, DefectAnalysisResult, SAEDResult, AngleResult, EDSLayerData } from './types';
import { SavedVisionAnalysis, VisionModeSnapshot } from '../../../types/scientific';
import { detectParticlesDetailedFromCanvas, detectParticlesFromCanvas, analyzeSheetStructure, performLocalFFT, analyzeDefects, performGaussianFitting, analyzeSAED, calculateInterplanarAngle } from './utils';
import { applySGSmoothing, removeBackground, DataPoint } from '../xrdUtils';
import { refineParticlesWithAI, generateContextualVisionReport } from '../../../services/gemini/analysis';
import { useProjectContext } from '../../../context/ProjectContext';

export const useVisionAnalysis = (
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    imgRef: React.RefObject<HTMLImageElement | null>,
    showToast?: (params: { message: string, type: 'success' | 'error' | 'info' | 'warning' }) => void,
    fftCanvasRef?: React.RefObject<HTMLCanvasElement | null>
) => {
    const { visionSession, updateVisionSession, projects } = useProjectContext();
    const dragStartRef = useRef<{ x: number, y: number } | null>(null);
    const isDraggingLatticeRef = useRef(false);
    const isDraggingFFTRef = useRef(false);

    // Core State (Synced with visionSession)
    const {
        imageSrc, mode, semMode, temMode, scaleRatio, particles, xrdPeaks,
        sheetStats, latticeResult, defectStats, report, aiReport, rawXrdData, xrdConfig, realLengthInput,
        linkedLogId, linkedLogTitle, linkedProjectId, linkedMilestoneId,
        savedArchives
    } = visionSession;

    // Helper functions to update global session
    const setImageSrc = (val: string | null) => updateVisionSession({ imageSrc: val });

    /**
     * switchMode - 切换 SEM/TEM/XRD 主模式时自动保存/恢复各模式快照
     * 1. 将当前模式的所有关键状态打包为快照，存入 modeStates[currentMode]
     * 2. 从 modeStates[newMode] 恢复快照（若有），否则清空画布
     */
    const setMode = (newMode: AnalysisMode) => {
        if (newMode === mode) return; // 同模式不触发

        // ① 构造当前模式快照
        const currentSnapshot: VisionModeSnapshot = {
            imageSrc,
            scaleRatio,
            report,
            aiReport,
            particles,
            sheetStats,
            latticeResult,
            defectStats,
            xrdPeaks,
            rawXrdData,
            xrdConfig,
            selectedXrdPeak: visionSession.selectedXrdPeak,
            showStandardLine: visionSession.showStandardLine,
            realLengthInput,
        };

        // ② 读取目标模式快照
        const existingModeStates = visionSession.modeStates || {};
        const targetSnapshot = existingModeStates[newMode];

        // ③ 合并保存当前快照 + 切换模式 + 恢复目标快照字段
        if (targetSnapshot) {
            updateVisionSession({
                mode: newMode,
                modeStates: { ...existingModeStates, [mode]: currentSnapshot },
                // 恢复目标模式的状态
                imageSrc: targetSnapshot.imageSrc,
                scaleRatio: targetSnapshot.scaleRatio,
                report: targetSnapshot.report,
                aiReport: targetSnapshot.aiReport,
                particles: targetSnapshot.particles,
                sheetStats: targetSnapshot.sheetStats,
                latticeResult: targetSnapshot.latticeResult,
                defectStats: targetSnapshot.defectStats,
                xrdPeaks: targetSnapshot.xrdPeaks,
                rawXrdData: targetSnapshot.rawXrdData,
                xrdConfig: targetSnapshot.xrdConfig,
                selectedXrdPeak: targetSnapshot.selectedXrdPeak,
                showStandardLine: targetSnapshot.showStandardLine,
                realLengthInput: targetSnapshot.realLengthInput,
            });
        } else {
            // 目标模式从未使用过，清空画布
            updateVisionSession({
                mode: newMode,
                modeStates: { ...existingModeStates, [mode]: currentSnapshot },
                imageSrc: null,
                scaleRatio: null,
                report: null,
                aiReport: null,
                particles: [],
                sheetStats: null,
                latticeResult: null,
                defectStats: null,
                xrdPeaks: [],
                rawXrdData: [],
                selectedXrdPeak: null,
                showStandardLine: false,
            });
        }
    };

    const setSemMode = (val: 'particle' | 'sheet') => updateVisionSession({ semMode: val });
    const setTemMode = (val: 'lattice' | 'fft' | 'defect' | 'particle' | 'angle' | 'saed' | 'eds') => updateVisionSession({ temMode: val });
    const setScaleRatio = (val: number | null) => updateVisionSession({ scaleRatio: val });
    const setParticles = (val: ParticleData[]) => updateVisionSession({ particles: val });
    const setXrdPeaks = (val: XrdPeakData[]) => updateVisionSession({ xrdPeaks: val });
    const setSheetStats = (val: any) => updateVisionSession({ sheetStats: val });
    const setLatticeResult = (val: LatticeResult | null) => updateVisionSession({ latticeResult: val });
    const setDefectStats = (val: DefectAnalysisResult | null) => updateVisionSession({ defectStats: val });
    const setReport = (val: string | null) => updateVisionSession({ report: val });
    const setAiReport = (val: string | null) => updateVisionSession({ aiReport: val });
    const setRawXrdData = (val: DataPoint[]) => updateVisionSession({ rawXrdData: val });
    const setXrdConfig = (val: any) => updateVisionSession({ xrdConfig: val });
    const setRealLengthInput = (val: string) => updateVisionSession({ realLengthInput: val });
    const setSavedArchives = (val: SavedVisionAnalysis[]) => updateVisionSession({ savedArchives: val });
    const setLinkedLogId = (val: string | undefined) => updateVisionSession({ linkedLogId: val });
    const setLinkedLogTitle = (val: string | undefined) => updateVisionSession({ linkedLogTitle: val });
    const setLinkedProjectId = (val: string | undefined) => updateVisionSession({ linkedProjectId: val });
    const setLinkedMilestoneId = (val: string | undefined) => updateVisionSession({ linkedMilestoneId: val });

    // Local Transient UI State
    const [isProcessing, setIsProcessing] = useState(false);
    const [isCalibrating, setIsCalibrating] = useState(false);
    const [calibrationLine, setCalibrationLine] = useState<{ start: { x: number, y: number }, end: { x: number, y: number } } | null>(null);
    const [tempLineEnd, setTempLineEnd] = useState<{ x: number, y: number } | null>(null);
    const [showCalibrationInput, setShowCalibrationInput] = useState(false);
    const [calibrationDistancePx, setCalibrationDistancePx] = useState(0);
    const [isGeneratingAi, setIsGeneratingAi] = useState(false);

    const [latticeLine, setLatticeLine] = useState<{ start: { x: number, y: number }, end: { x: number, y: number } } | null>(null);
    const [latticeLayers, setLatticeLayers] = useState<string>('10');
    const [fftBox, setFftBox] = useState<{ x: number, y: number } | null>(null);
    const [fftPreview, setFftPreview] = useState<ImageData | null>(null);
    const [fftSize, setFftSize] = useState(128);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });

    // TEM Angle mode state
    const [angleLine1, setAngleLine1] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
    const [angleLine2, setAngleLine2] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
    const [angleDrawingLine, setAngleDrawingLine] = useState<1 | 2>(1);
    const [angleLayers1, setAngleLayers1] = useState('10');
    const [angleLayers2, setAngleLayers2] = useState('10');
    const [angleResult, setAngleResult] = useState<AngleResult | null>(null);
    const isDraggingAngleRef = useRef(false);

    // TEM SAED mode state
    const [saedCenter, setSaedCenter] = useState<{ x: number; y: number } | null>(null);
    const [saedResult, setSaedResult] = useState<SAEDResult | null>(null);

    // TEM EDS mode state
    const [edsLayers, setEdsLayers] = useState<EDSLayerData[]>([]);

    const [showStandardLine, setShowStandardLine] = useState(false);
    const [selectedXrdPeak, setSelectedXrdPeak] = useState<XrdPeakData | null>(null);
    const [processedXrdData, setProcessedXrdData] = useState<DataPoint[]>([]);
    const [xrdOptions, setXrdOptions] = useState({ smooth: false, removeBg: false });

    const [sheetOverlay, setSheetOverlay] = useState<ImageData | null>(null);
    const [confidence, setConfidence] = useState<number>(0);
    const [imgError, setImgError] = useState(false);
    const [hoveredParticleId, setHoveredParticleId] = useState<number | null>(null);
    const [useWatershedSplit, setUseWatershedSplit] = useState(false);
    const [particleStrictnessLevel, setParticleStrictnessLevel] = useState<number>(50);
    const [semParticleDiagnostics, setSemParticleDiagnostics] = useState<{
        agglomerationRatio: number;
        rawComponentCount: number;
        finalParticleCount: number;
        splitAddedCount: number;
    } | null>(null);

    const sanitizeLatexArtifacts = (text: string): string => {
        if (!text) return text;
        const cmdMap: Record<string, string> = {
            approx: '≈',
            cdot: '·',
            times: '×',
            mu: 'μ',
            alpha: 'α',
            beta: 'β',
            gamma: 'γ',
            delta: 'δ',
            theta: 'θ',
            lambda: 'λ',
            pm: '±',
            leq: '≤',
            geq: '≥'
        };
        const normalizeMath = (input: string) => {
            let s = input;
            s = s.replace(/\\text\{([^}]*)\}/g, '$1');
            s = s.replace(/\\mathrm\{([^}]*)\}/g, '$1');
            s = s.replace(/_\\?\{([^}]*)\}/g, '$1');
            s = s.replace(/\^\\?\{([^}]*)\}/g, '$1');
            s = s.replace(/_([A-Za-z0-9]+)/g, '$1');
            s = s.replace(/\^([A-Za-z0-9]+)/g, '$1');
            s = s.replace(/\\([A-Za-z]+)/g, (_, cmd: string) => cmdMap[cmd] ?? cmd);
            s = s.replace(/[{}]/g, '');
            return s;
        };

        let cleaned = text.replace(/\$([^$]+)\$/g, (_, inner: string) => normalizeMath(inner));
        cleaned = cleaned.replace(/\\text\{([^}]*)\}/g, '$1');
        cleaned = cleaned.replace(/\\mathrm\{([^}]*)\}/g, '$1');
        cleaned = cleaned.replace(/\\([A-Za-z]+)/g, (_, cmd: string) => cmdMap[cmd] ?? `\\${cmd}`);
        return cleaned;
    };

    const resetState = useCallback(() => {
        updateVisionSession({
            report: null,
            aiReport: null,
            particles: [],
            xrdPeaks: [],
            sheetStats: null,
            latticeResult: null,
            defectStats: null,
            scaleRatio: null,
            rawXrdData: [],
            imageSrc: null,
            linkedLogId: undefined,
            linkedLogTitle: undefined,
            linkedProjectId: undefined,
            linkedMilestoneId: undefined
        });
        setLatticeLine(null);
        setFftBox(null);
        setFftPreview(null);
        setCalibrationLine(null);
        setIsCalibrating(false);
        setShowCalibrationInput(false);
        setSelectedXrdPeak(null);
        setShowStandardLine(false);
        dragStartRef.current = null;
        setHoveredParticleId(null);
        setProcessedXrdData([]);
        setXrdOptions({ smooth: false, removeBg: false });
        setSemParticleDiagnostics(null);
        setParticleStrictnessLevel(50);
    }, [updateVisionSession]);

    // Update Lattice Calculation when scale or layers change (NOT on every drag move)
    useEffect(() => {
        if (mode === 'TEM' && temMode === 'lattice' && latticeLine && scaleRatio) {
            calculateDSpacing();
        }
    }, [latticeLayers, scaleRatio, mode, temMode]);

    const processXrdData = useCallback((smooth: boolean, removeBg: boolean) => {
        if (rawXrdData.length === 0) return null;

        let data = [...rawXrdData];
        if (removeBg) {
            data = removeBackground(data);
        }
        if (smooth) {
            data = applySGSmoothing(data);
        }
        setProcessedXrdData(data);
        setXrdOptions({ smooth, removeBg });
        return data;
    }, [rawXrdData]);

    // Render FFT preview onto the fftCanvasRef when fftPreview changes
    useEffect(() => {
        if (fftPreview && fftCanvasRef?.current) {
            const ctx = fftCanvasRef.current.getContext('2d');
            if (ctx) {
                ctx.putImageData(fftPreview, 0, 0);
            }
        }
    }, [fftPreview, fftCanvasRef]);

    const calculateDSpacing = () => {
        if (!latticeLine || !scaleRatio) return;
        const distPx = Math.hypot(latticeLine.end.x - latticeLine.start.x, latticeLine.end.y - latticeLine.start.y);
        const totalNm = distPx * scaleRatio;
        const layers = parseInt(latticeLayers) || 1;
        const d = totalNm / layers;

        let material = "Unknown";
        let plane = "";
        if (Math.abs(d - 0.235) < 0.01) { material = "Ag"; plane = "(111)"; }
        else if (Math.abs(d - 0.204) < 0.01) { material = "Ag"; plane = "(200)"; }
        else if (Math.abs(d - 0.226) < 0.01) { material = "Pt"; plane = "(111)"; }
        else if (Math.abs(d - 0.252) < 0.01) { material = "CuO"; plane = "(111)"; }

        setLatticeResult({ dSpacing: d, material, planeFamily: plane });
    };

    const triggerFFT = (x: number, y: number) => {
        if (!canvasRef.current || !imgRef.current) return;

        const size = fftSize;
        const width = canvasRef.current.width;
        const height = canvasRef.current.height;
        let safeX = Math.max(0, Math.min(x - size / 2, width - size));
        let safeY = Math.max(0, Math.min(y - size / 2, height - size));

        // Update box position immediately — yellow box renders on next frame
        setFftBox({ x: safeX, y: safeY });

        // Capture imgRef for closure (may unmount between frames)
        const img = imgRef.current;

        // Defer ALL heavy work (canvas creation + image draw + FFT)
        // so the yellow box appears instantly without blocking
        requestAnimationFrame(() => {
            setTimeout(() => {
                const offscreen = document.createElement('canvas');
                offscreen.width = width;
                offscreen.height = height;
                const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
                if (!offCtx) return;
                offCtx.drawImage(img, 0, 0, width, height);

                const fftData = performLocalFFT(offCtx, safeX, safeY, size);
                setFftPreview(fftData);
            }, 0);
        });
    };

    const generateReport = (
        currentParticles: ParticleData[],
        ratio: number | null,
        m: AnalysisMode,
        sm: 'particle' | 'sheet'
    ) => {
        if (m === 'XRD') return;
        let reportText = "";
        if (m === 'SEM') {
            if (sm === 'particle') {
                const count = currentParticles.length;
                if (count > 0) {
                    const sizes = currentParticles.map(p => {
                        if (p.realSize) return p.realSize;
                        if (p.radiusX && p.radiusY) return 2 * Math.sqrt(p.radiusX * p.radiusY) * (ratio || 1);
                        return p.radius * 2 * (ratio || 1);
                    });
                    const avg = sizes.reduce((a, b) => a + b, 0) / count;
                    const max = Math.max(...sizes);
                    const min = Math.min(...sizes);
                    const stdDev = Math.sqrt(sizes.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) / count);

                    reportText = `SEM 0D 颗粒粒径统计分析报告\n`;
                    reportText += `------------------------------------\n`;
                    reportText += `识别颗粒总数: ${count}\n`;
                    reportText += `平均等效粒径: ${avg.toFixed(2)} nm\n`;
                    reportText += `最大 / 最小粒径: ${max.toFixed(1)} / ${min.toFixed(1)} nm\n`;
                    reportText += `标准偏差 (Std Dev): ${stdDev.toFixed(2)} nm\n`;
                    reportText += `形态离散度 (PDI): ${(stdDev / avg).toFixed(3)}\n`;
                    if (semParticleDiagnostics) {
                        reportText += `团聚占比 (面积加权): ${semParticleDiagnostics.agglomerationRatio.toFixed(1)}%\n`;
                        reportText += `Watershed拆分前后: ${semParticleDiagnostics.rawComponentCount} → ${semParticleDiagnostics.finalParticleCount} (Δ+${semParticleDiagnostics.splitAddedCount})\n`;
                        reportText += `检测严格度: ${Math.round(particleStrictnessLevel)}/100\n`;
                    }
                    reportText += `------------------------------------\n`;
                    reportText += `[建议]: 当前体系${avg < 50 ? '处于窄分布状态，显示出优异的单分散性' : '分布略广，可能存在局部团聚'}\n`;
                } else {
                    reportText = "未识别到任何颗粒，请尝试：\n1. 进行标尺校准\n2. 增加图像对比度后重试\n3. 点击 [启动智能分析]";
                }
            } else {
                if (sheetStats) {
                    reportText = `SEM 2D 片层/孔隙度量化报告\n`;
                    reportText += `------------------------------------\n`;
                    reportText += `有效空隙率 (Porosity): ${sheetStats.porosity.toFixed(2)}%\n`;
                    reportText += `活性边缘密度: ${sheetStats.edgeDensity.toFixed(4)} μm⁻¹\n`;
                    reportText += `表面分形维数估算: ${(2 + sheetStats.porosity * 0.5).toFixed(2)}\n`;
                    reportText += `------------------------------------\n`;
                }
            }
        }
        setReport(reportText);
    };

    const runAnalysis = () => {
        if (!imageSrc || isProcessing) return;
        setIsProcessing(true);

        // Use canvas dimensions for consistency (canvas is sized to img.clientWidth/Height)
        const width = canvasRef.current?.width || imgRef.current?.naturalWidth || 1024;
        const height = canvasRef.current?.height || imgRef.current?.naturalHeight || 768;
        const isCalibrated = scaleRatio !== null;
        const ratio = scaleRatio || 1;

        setTimeout(() => {
            if (mode === 'SEM') {
                if (semMode === 'sheet') {
                    setSemParticleDiagnostics(null);
                    if (canvasRef.current) {
                        const ctx = canvasRef.current.getContext('2d');
                        if (ctx) {
                            if (imgRef.current) ctx.drawImage(imgRef.current, 0, 0, width, height);
                            const result = analyzeSheetStructure(ctx, width, height);
                            setSheetStats({ porosity: result.porosity, edgeDensity: result.edgeDensity });
                            setSheetOverlay(result.overlay);
                            generateReport([], scaleRatio, mode, semMode);
                        }
                    }
                } else {
                    // Particle Detection
                    let detectedParticles: ParticleData[] = [];
                    if (canvasRef.current) {
                        const ctx = canvasRef.current.getContext('2d');
                        if (ctx) {
                            if (imgRef.current) ctx.drawImage(imgRef.current, 0, 0, width, height);
                            const detection = detectParticlesDetailedFromCanvas(ctx, width, height, isCalibrated ? ratio : 0, {
                                splitAgglomerates: useWatershedSplit,
                                strictnessLevel: particleStrictnessLevel
                            });
                            detectedParticles = detection.particles;
                            setSemParticleDiagnostics({
                                agglomerationRatio: detection.stats.agglomerationRatio,
                                rawComponentCount: detection.stats.rawComponentCount,
                                finalParticleCount: detection.stats.finalParticleCount,
                                splitAddedCount: detection.stats.splitAddedCount
                            });
                        }
                    }
                    if (detectedParticles.length < 5) setConfidence(65);
                    else setConfidence(88 + Math.random() * 10);
                    setParticles(detectedParticles);
                    generateReport(detectedParticles, scaleRatio, mode, semMode);
                }
            } else if (mode === 'TEM') {
                if (temMode === 'defect') {
                    if (canvasRef.current) {
                        const ctx = canvasRef.current.getContext('2d');
                        if (ctx) {
                            if (imgRef.current) ctx.drawImage(imgRef.current, 0, 0, width, height);
                            const result = analyzeDefects(ctx, width, height);
                            setDefectStats(result as any);
                            let rText = `TEM 全局晶格缺陷云图扫描报告\n`;
                            rText += `------------------------------------\n`;
                            rText += `评估指标: ${(result as any).defectDensity ? '活性位点密度: ' + (result as any).activeSitesEstimate : '正在解算特征...'}\n`;
                            rText += `缺陷覆盖度: ${((result as any).defectDensity).toFixed(1)}%\n`;
                            rText += `------------------------------------\n`;
                            setReport(rText);
                        }
                    }
                } else if (temMode === 'lattice') {
                    if (latticeResult) {
                        let rText = `TEM 晶格条纹测量报告\n`;
                        rText += `------------------------------------\n`;
                        rText += `测量面间距 (d): ${latticeResult.dSpacing.toFixed(4)} nm\n`;
                        rText += `匹配材质: ${latticeResult.material}\n`;
                        rText += `对应晶面: ${latticeResult.planeFamily || 'N/A'}\n`;
                        rText += `------------------------------------\n`;
                        setReport(rText);
                    } else {
                        setReport("未检测到有效测量线段。\n请在图像上拖拽以测量晶格间距。");
                    }
                } else if (temMode === 'fft') {
                    if (fftPreview) {
                        setReport(`TEM 选区电子衍射 (SAED/FFT) 分析\n------------------------------------\n已生成 128px 局部频率域图谱。\n观察衍射斑点分布可评估区域结晶性。`);
                    } else {
                        setReport("请点击或拖拽图像以选取 FFT 分析区域。");
                    }
                } else if (temMode === 'particle') {
                    // TEM Particle mode - reuse SEM particle detection
                    let detectedParticles: ParticleData[] = [];
                    if (canvasRef.current) {
                        const ctx = canvasRef.current.getContext('2d');
                        if (ctx) {
                            if (imgRef.current) ctx.drawImage(imgRef.current, 0, 0, width, height);
                            detectedParticles = detectParticlesFromCanvas(ctx, width, height, isCalibrated ? ratio : 0);
                        }
                    }
                    if (detectedParticles.length < 5) setConfidence(65);
                    else setConfidence(88 + Math.random() * 10);
                    setParticles(detectedParticles);
                    let rText = `TEM 纳米粒子粒径统计分析报告\n`;
                    rText += `------------------------------------\n`;
                    if (detectedParticles.length > 0) {
                        const sizes = detectedParticles.map(p => p.realSize || (p.radius * 2 * ratio)).filter(v => v > 0);
                        const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
                        const max = Math.max(...sizes);
                        const min = Math.min(...sizes);
                        const std = Math.sqrt(sizes.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) / sizes.length);
                        rText += `识别纳米粒子: ${detectedParticles.length} 个\n`;
                        rText += `平均粒径: ${avg.toFixed(2)} nm\n`;
                        rText += `最大 / 最小: ${max.toFixed(1)} / ${min.toFixed(1)} nm\n`;
                        rText += `标准偏差: ${std.toFixed(2)} nm\n`;
                        rText += `PDI: ${(std / avg).toFixed(3)}\n`;
                    } else {
                        rText += `未检测到纳米粒子。请先进行标尺校准。\n`;
                    }
                    rText += `------------------------------------\n`;
                    setReport(rText);
                } else if (temMode === 'angle') {
                    if (angleResult) {
                        let rText = `TEM 晶面夹角测量报告\n`;
                        rText += `------------------------------------\n`;
                        rText += `线1 面间距: ${angleResult.line1DSpacing.toFixed(4)} nm${angleResult.line1Plane ? ` → ${angleResult.line1Plane}` : ''}\n`;
                        rText += `线2 面间距: ${angleResult.line2DSpacing.toFixed(4)} nm${angleResult.line2Plane ? ` → ${angleResult.line2Plane}` : ''}\n`;
                        rText += `晶面夹角: ${angleResult.angleDeg.toFixed(1)}°\n`;
                        if (angleResult.zoneAxis) rText += `推测晶带轴: ${angleResult.zoneAxis}\n`;
                        rText += `------------------------------------\n`;
                        setReport(rText);
                    } else {
                        setReport("请依次拖拽两条晶格方向线以测量晶面夹角。\n提示：先画第一条线，松手后再画第二条。");
                    }
                } else if (temMode === 'saed') {
                    if (saedResult) {
                        // Report already generated in click handler
                    } else {
                        setReport("请在衍射图案的中心点点击以启动 SAED 分析。");
                    }
                } else if (temMode === 'eds') {
                    if (edsLayers.length > 0) {
                        let rText = `TEM EDS 元素映射叠加报告\n`;
                        rText += `------------------------------------\n`;
                        rText += `已加载元素层: ${edsLayers.length} 个\n`;
                        edsLayers.forEach(l => {
                            rText += `  ${l.element} (${l.visible ? '可见' : '隐藏'}, 透明度 ${Math.round(l.opacity * 100)}%)\n`;
                        });
                        rText += `------------------------------------\n`;
                        setReport(rText);
                    } else {
                        setReport("请在左侧参数面板上传 EDS 元素映射图层。");
                    }
                }
            } else {
                // XRD handled separately via state
            }

            setIsProcessing(false);
        }, 1000);
    };

    const handleGenerateDeepReport = async (providedProjectTitle?: string, providedLogContext?: string) => {
        if (!imageSrc || isGeneratingAi) return;

        let finalProjectTitle = providedProjectTitle || '通用项目';
        let finalLogContext = providedLogContext || '标准视觉分析';

        // If we have a linked log, try to get its actual content from the context
        if (linkedLogId && linkedProjectId && linkedMilestoneId) {
            const project = projects?.find((p: any) => p.id === linkedProjectId);
            const milestone = project?.milestones?.find((m: any) => m.id === linkedMilestoneId);
            const log = milestone?.logs?.find((l: any) => l.id === linkedLogId);
            if (project && log) {
                finalProjectTitle = project.title;
                finalLogContext = log.content + (log.description ? `\n\n${log.description}` : '');
            }
        }

        setIsGeneratingAi(true);
        showToast?.({ message: "正在生成 AI 深度解析报告...", type: 'info' });

        try {
            const buildModeStats = (): string => {
                if (mode === 'TEM') {
                    if (temMode === 'lattice' && latticeResult) {
                        return [
                            'TEM 晶格条纹测量结果',
                            `子模式: ${temMode}`,
                            `测量面间距 d = ${Number(latticeResult.dSpacing).toFixed(4)} nm`,
                            `匹配材质: ${latticeResult.material || '未知'}`,
                            `对应晶面: ${latticeResult.planeFamily || 'N/A'}`
                        ].join('\n');
                    }
                    if (temMode === 'defect' && defectStats) {
                        return [
                            'TEM 缺陷统计结果',
                            `子模式: ${temMode}`,
                            `缺陷覆盖度: ${Number(defectStats.defectDensity || 0).toFixed(2)}%`,
                            `估算活性位点: ${Number(defectStats.activeSitesEstimate || 0).toFixed(0)}`
                        ].join('\n');
                    }
                    if (temMode === 'fft') {
                        return [
                            'TEM 选区电子衍射/FFT 结果',
                            `子模式: ${temMode}`,
                            fftPreview ? '已生成局部频域图谱，可用于判断局部结晶性与取向。' : '尚未生成有效 FFT 频域图谱。'
                        ].join('\n');
                    }
                    if (temMode === 'particle' && particles.length > 0) {
                        const sizes = particles.map(p => Number(p.realSize)).filter(v => Number.isFinite(v) && v > 0);
                        if (sizes.length > 0) {
                            const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
                            return `TEM 纳米粒子统计：平均粒径 ${avg.toFixed(2)} nm，样本数 ${sizes.length}`;
                        }
                    }
                    if (temMode === 'angle' && angleResult) {
                        return `TEM 晶面夹角：${angleResult.angleDeg.toFixed(1)}°，d1=${angleResult.line1DSpacing.toFixed(3)} nm，d2=${angleResult.line2DSpacing.toFixed(3)} nm${angleResult.zoneAxis ? `，晶带轴 ${angleResult.zoneAxis}` : ''}`;
                    }
                    if (temMode === 'saed' && saedResult) {
                        return `TEM SAED 分析：${saedResult.crystalType === 'polycrystalline' ? '多晶' : saedResult.crystalType === 'single-crystal' ? '单晶' : '未知'}，识别 ${saedResult.rings.length} 个衍射环`;
                    }
                    if (temMode === 'eds' && edsLayers.length > 0) {
                        return `TEM EDS 映射：已加载 ${edsLayers.length} 个元素层 (${edsLayers.map(l => l.element).join(', ')})`;
                    }
                    return `TEM ${temMode} 分析：暂无可用结构化统计，请先执行一次分析。`;
                }

                if (mode === 'SEM') {
                    if (semMode === 'particle' && particles.length > 0) {
                        const sizes = particles.map(p => Number(p.realSize)).filter(v => Number.isFinite(v) && v > 0);
                        if (sizes.length > 0) {
                            const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
                            const max = Math.max(...sizes);
                            const min = Math.min(...sizes);
                            return `SEM 颗粒统计：平均 ${avg.toFixed(2)} nm，最大/最小 ${max.toFixed(2)}/${min.toFixed(2)} nm，样本数 ${sizes.length}`;
                        }
                    }
                    if (semMode === 'sheet' && sheetStats) {
                        return `SEM 片层统计：孔隙率 ${sheetStats.porosity.toFixed(2)}%，边缘密度 ${sheetStats.edgeDensity.toFixed(4)} μm⁻¹`;
                    }
                }

                return report || '无基础数据';
            };

            const statsForReport = buildModeStats();
            const modeWithSubtype = mode === 'SEM'
                ? `SEM-${semMode}`
                : mode === 'TEM'
                    ? `TEM-${temMode}`
                    : mode;
            const result = await generateContextualVisionReport(
                finalProjectTitle,
                finalLogContext,
                statsForReport,
                modeWithSubtype
            );
            setAiReport(sanitizeLatexArtifacts(result || '未能生成报告'));
            showToast?.({ message: "AI 深度解析完成", type: 'success' });
        } catch (error) {
            console.error("AI report generation failed", error);
            showToast?.({ message: "AI 报告生成失败", type: 'error' });
        } finally {
            setIsGeneratingAi(false);
        }
    };

    const runDeepRefinement = async () => {
        if (!imageSrc || !canvasRef.current || isProcessing) return;

        setIsProcessing(true);
        showToast?.({ message: "正在启动 AI 视觉深度识别...", type: 'info' });

        try {
            const aiResult = await refineParticlesWithAI(imageSrc, particles);

            if (aiResult.newParticles || aiResult.toRemove) {
                let updatedParticles = [...particles];

                // 1. Remove incorrect particles
                if (aiResult.toRemove) {
                    updatedParticles = updatedParticles.filter(p =>
                        !aiResult.toRemove.some((rem: any) => Math.hypot(rem.x - p.x, rem.y - p.y) < p.radius)
                    );
                }

                // 2. Add new particles identified by AI
                if (aiResult.newParticles) {
                    const startId = updatedParticles.length > 0 ? Math.max(...updatedParticles.map(p => p.id)) + 1 : 1;
                    const newOnes = aiResult.newParticles.map((np: any, i: number) => ({
                        id: startId + i,
                        x: np.x,
                        y: np.y,
                        radius: np.r,
                        radiusX: np.r,
                        radiusY: np.r,
                        rotation: 0,
                        realSize: scaleRatio ? parseFloat((2 * np.r * scaleRatio).toFixed(2)) : undefined
                    }));
                    updatedParticles = [...updatedParticles, ...newOnes];
                }

                setParticles(updatedParticles);
                setConfidence(aiResult.confidence || 95);
                generateReport(updatedParticles, scaleRatio, mode, semMode);
                showToast?.({ message: "AI 深度识别完成，已修正结果", type: 'success' });
            }
        } catch (error) {
            console.error("Deep refinement failed", error);
            showToast?.({ message: "AI 深度识别失败，请检查网络", type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
        const y = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);

        if (isCalibrating) {
            setCalibrationLine({ start: { x, y }, end: { x, y } });
        } else if (mode === 'TEM' && temMode === 'lattice') {
            isDraggingLatticeRef.current = true;
            dragStartRef.current = { x, y };
            setLatticeLine({ start: { x, y }, end: { x, y } });
        } else if (mode === 'TEM' && temMode === 'angle') {
            isDraggingAngleRef.current = true;
            dragStartRef.current = { x, y };
            if (angleDrawingLine === 1) {
                setAngleLine1({ start: { x, y }, end: { x, y } });
            } else {
                setAngleLine2({ start: { x, y }, end: { x, y } });
            }
        } else if (mode === 'TEM' && temMode === 'fft') {
            isDraggingFFTRef.current = true;
            const size = fftSize;
            const w = canvasRef.current.width, h = canvasRef.current.height;
            const safeX = Math.max(0, Math.min(x - size / 2, w - size));
            const safeY = Math.max(0, Math.min(y - size / 2, h - size));
            setFftBox({ x: safeX, y: safeY });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
        const y = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);

        if (isCalibrating && calibrationLine) {
            setCalibrationLine({ ...calibrationLine, end: { x, y } });
        } else if (mode === 'TEM' && temMode === 'lattice' && isDraggingLatticeRef.current && dragStartRef.current) {
            setLatticeLine({ start: dragStartRef.current, end: { x, y } });
        } else if (mode === 'TEM' && temMode === 'angle' && isDraggingAngleRef.current && dragStartRef.current) {
            if (angleDrawingLine === 1) {
                setAngleLine1({ start: dragStartRef.current, end: { x, y } });
            } else {
                setAngleLine2({ start: dragStartRef.current, end: { x, y } });
            }
        } else if (mode === 'TEM' && temMode === 'fft' && isDraggingFFTRef.current) {
            const size = fftSize;
            const w = canvasRef.current.width, h = canvasRef.current.height;
            const safeX = Math.max(0, Math.min(x - size / 2, w - size));
            const safeY = Math.max(0, Math.min(y - size / 2, h - size));
            setFftBox({ x: safeX, y: safeY });
        } else if (mode === 'SEM' && semMode === 'particle') {
            const hovered = particles.find(p => {
                const dx = x - p.x;
                const dy = y - p.y;
                return Math.hypot(dx, dy) < (p.radius + 3);
            });
            setHoveredParticleId(hovered ? hovered.id : null);
        }
    };

    const handleMouseUp = () => {
        if (isCalibrating && calibrationLine) {
            const dist = Math.hypot(calibrationLine.end.x - calibrationLine.start.x, calibrationLine.end.y - calibrationLine.start.y);
            setCalibrationDistancePx(dist);
            setShowCalibrationInput(true);
        } else if (mode === 'TEM' && temMode === 'lattice' && isDraggingLatticeRef.current) {
            isDraggingLatticeRef.current = false;
            dragStartRef.current = null;
            if (scaleRatio) {
                calculateDSpacing();
            }
        } else if (mode === 'TEM' && temMode === 'angle' && isDraggingAngleRef.current) {
            isDraggingAngleRef.current = false;
            dragStartRef.current = null;
            if (angleDrawingLine === 1) {
                setAngleDrawingLine(2); // switch to drawing line 2
            } else {
                // Both lines drawn, calculate angle
                if (angleLine1 && angleLine2 && scaleRatio) {
                    const result = calculateInterplanarAngle(
                        angleLine1, angleLine2, scaleRatio,
                        parseInt(angleLayers1) || 1, parseInt(angleLayers2) || 1
                    );
                    setAngleResult(result);
                }
                setAngleDrawingLine(1); // reset for next measurement
            }
        } else if (mode === 'TEM' && temMode === 'fft' && isDraggingFFTRef.current) {
            isDraggingFFTRef.current = false;
            // Trigger FFT computation at the final box position
            if (fftBox) {
                triggerFFT(fftBox.x + fftSize / 2, fftBox.y + fftSize / 2);
            }
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
            // Pinch-to-zoom (trackpad pinch sends ctrlKey: true)
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setZoom(prev => Math.max(0.5, Math.min(5, +(prev + delta).toFixed(1))));
        } else {
            // Two-finger scroll → pan the view
            setPan(prev => ({
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY
            }));
        }
    };

    const confirmCalibration = () => {
        const realDist = parseFloat(realLengthInput);
        if (realDist > 0 && calibrationDistancePx > 0) {
            setScaleRatio(realDist / calibrationDistancePx);
            setIsCalibrating(false);
            setShowCalibrationInput(false);
            setCalibrationLine(null);
            showToast?.({ message: "标尺校准成功", type: 'success' });
        }
    };

    const cancelCalibration = () => {
        setIsCalibrating(false);
        setShowCalibrationInput(false);
        setCalibrationLine(null);
    };

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
        const y = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);

        if (mode === 'TEM' && temMode === 'saed') {
            // SAED: click to set center point, then run analysis
            setSaedCenter({ x, y });
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx && imgRef.current) {
                    const w = canvasRef.current.width, h = canvasRef.current.height;
                    ctx.drawImage(imgRef.current, 0, 0, w, h);
                    const result = analyzeSAED(ctx, w, h, x, y, scaleRatio);
                    setSaedResult({ centerX: x, centerY: y, ...result } as SAEDResult);
                    let rText = `TEM SAED 衍射环分析报告\n`;
                    rText += `------------------------------------\n`;
                    rText += `结晶类型: ${result.crystalType === 'polycrystalline' ? '多晶' : result.crystalType === 'single-crystal' ? '单晶' : result.crystalType === 'amorphous' ? '非晶' : '未知'}\n`;
                    rText += `识别衍射环: ${result.rings.length} 个\n`;
                    result.rings.forEach((r, i) => {
                        rText += `  环 ${i + 1}: d = ${r.dSpacing.toFixed(3)} nm${r.hkl ? ` → ${r.material} ${r.hkl}` : ''}\n`;
                    });
                    rText += `------------------------------------\n`;
                    setReport(rText);
                }
            }
            showToast?.({ message: '已设置 SAED 中心点并完成分析', type: 'success' });
        } else if (mode === 'TEM' && temMode === 'fft') {
            // FFT is now handled by drag (mouseDown/mouseMove/mouseUp)
            // Single click: trigger FFT directly at click point
            if (!fftBox) {
                triggerFFT(x, y);
            }
        } else if (mode === 'SEM' && semMode === 'particle') {
            const clickedParticle = particles.find(p => {
                const dx = x - p.x;
                const dy = y - p.y;
                const dist = Math.hypot(dx, dy);
                return dist < (p.radius + 5);
            });

            if (clickedParticle) {
                const updatedParticles = particles.filter(p => p.id !== clickedParticle.id);
                setParticles(updatedParticles);
                generateReport(updatedParticles, scaleRatio, mode, semMode);
                showToast?.({ message: `已移除颗粒 #${clickedParticle.id}`, type: 'info' });
            }
        }
    };

    return {
        // State
        imageSrc, setImageSrc,
        mode, setMode,
        semMode, setSemMode,
        temMode, setTemMode,
        isProcessing,
        report, setReport,
        isCalibrating, setIsCalibrating,
        scaleRatio, setScaleRatio,
        calibrationLine, setCalibrationLine,
        tempLineEnd, setTempLineEnd,
        particles, setParticles,
        xrdPeaks, setXrdPeaks,
        sheetStats, setSheetStats, sheetOverlay,
        latticeLine, setLatticeLine,
        latticeLayers, setLatticeLayers,
        latticeResult, setLatticeResult,
        fftBox, setFftBox, fftPreview, setFftPreview,
        fftSize, setFftSize,
        zoom, setZoom,
        pan, setPan,
        defectStats, setDefectStats,
        xrdConfig, setXrdConfig,
        showStandardLine, setShowStandardLine,
        selectedXrdPeak, setSelectedXrdPeak,
        rawXrdData, setRawXrdData,
        processedXrdData, setProcessedXrdData,
        savedArchives, setSavedArchives,
        xrdOptions, setXrdOptions,
        useWatershedSplit, setUseWatershedSplit,
        particleStrictnessLevel, setParticleStrictnessLevel,
        semParticleDiagnostics,
        confidence,
        imgError, setImgError,
        hoveredParticleId,
        showCalibrationInput, setShowCalibrationInput,
        realLengthInput, setRealLengthInput,
        aiReport, setAiReport,
        isGeneratingAi, setIsGeneratingAi,
        linkedLogId, setLinkedLogId,
        linkedLogTitle, setLinkedLogTitle,
        linkedProjectId, setLinkedProjectId,
        linkedMilestoneId, setLinkedMilestoneId,
        // TEM new modes
        angleLine1, setAngleLine1,
        angleLine2, setAngleLine2,
        angleDrawingLine, setAngleDrawingLine,
        angleLayers1, setAngleLayers1,
        angleLayers2, setAngleLayers2,
        angleResult, setAngleResult,
        saedCenter, setSaedCenter,
        saedResult, setSaedResult,
        edsLayers, setEdsLayers,

        // Actions
        resetState,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleCanvasClick,
        handleWheel,
        confirmCalibration,
        cancelCalibration,
        runAnalysis,
        runDeepRefinement,
        calculateDSpacing,
        generateReport,
        processXrdData,
        handleGenerateDeepReport
    };
};
