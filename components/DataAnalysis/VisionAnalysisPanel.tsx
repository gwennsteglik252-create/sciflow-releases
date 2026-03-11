
import React, { useRef, useState, useEffect } from 'react';
import saveAs from 'file-saver';
import { AnalysisMode } from './Vision/types';
import VisionCanvas from './Vision/VisionCanvas';
import VisionResults from './Vision/VisionResults';
import VisionSyncModal from './Vision/VisionSyncModal';
import VisionControls from './Vision/VisionControls';
import VisionSyncStatus from './Vision/VisionSyncStatus';
import VisionLinkLogModal from './Vision/VisionLinkLogModal';
import { useVisionAnalysis } from './Vision/useVisionAnalysis';
import { ResearchProject, ExperimentLog, ExperimentFile } from '../../types';
import { SavedVisionAnalysis } from '../../types/scientific';
import * as htmlToImage from 'html-to-image';
import { exportToWord, cleanTextForWord } from '../../utils/documentExport';
import { useProjectContext } from '../../context/ProjectContext';
import { parseXrdData } from './xrdUtils';
import { generateXrdPlotImage } from './Vision/utils';
import { convertTiffToDataUrl, isTiffFile } from './Vision/tiffUtils';
import { generateContextualVisionReport } from '../../services/gemini/analysis';
import { flattenMilestonesTree, getAutoSelections } from '../Characterization/AnalysisSyncModal';
import FolderLibraryView from '../Characterization/FolderLibraryView';
import { analyzeSheetStructure, detectParticlesFromCanvas } from './Vision/cvAlgorithms';

interface VisionAnalysisPanelProps {
    projects: ResearchProject[];
    onUpdateProject: (project: ResearchProject) => void;
    selectedProjectId?: string;
    traceRecordId?: string | null;
}

type MorphologyJudgeLabel = '0D 颗粒' | '2D 片层' | '混合形貌' | '两者都不适合';
interface MorphologyJudgeResult {
    label: MorphologyJudgeLabel;
    confidence: number;
    semSuggestion: 'particle' | 'sheet' | null;
    reasons: string[];
    metrics: {
        particleCount: number;
        medianAspectRatio: number;
        pdi: number;
        porosity: number;
        edgeDensity: number;
    };
}

const VisionAnalysisPanel: React.FC<VisionAnalysisPanelProps> = ({ projects, onUpdateProject, selectedProjectId, traceRecordId }) => {
    const { mechanismSession, updateMechanismSession, showToast, navigate, setReturnPath } = useProjectContext();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fftCanvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const archiveDropdownRef = useRef<HTMLDivElement>(null);
    const lastBlobUrlRef = useRef<string | null>(null);
    const traceLoadedRef = useRef<string | null>(null);

    const [showSyncModal, setShowSyncModal] = useState(false);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [showArchiveDropdown, setShowArchiveDropdown] = useState(false);
    const [currentArchiveId, setCurrentArchiveId] = useState<string | null>(null);
    const [showSaveArchiveModal, setShowSaveArchiveModal] = useState(false);
    const [saveMilestoneId, setSaveMilestoneId] = useState('');
    const [saveLogId, setSaveLogId] = useState('');
    const [judgeResult, setJudgeResult] = useState<MorphologyJudgeResult | null>(null);
    const [isJudgingMorphology, setIsJudgingMorphology] = useState(false);

    // 左侧面板折叠状态
    const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>({
        mode: true,      // ① 模式选择 - 默认展开
        input: false,    // ② 数据输入
        params: false,   // ③ 测量参数
        analysis: false, // ④ 智能分析
        archive: false,  // ⑤ 存档管理
    });
    const toggleSection = (key: string) => setSectionExpanded(prev => ({ ...prev, [key]: !prev[key] }));

    const {
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
        angleLine1, setAngleLine1,
        angleLine2, setAngleLine2,
        angleDrawingLine, setAngleDrawingLine,
        angleLayers1, setAngleLayers1,
        angleLayers2, setAngleLayers2,
        angleResult, setAngleResult,
        saedCenter, setSaedCenter,
        saedResult, setSaedResult,
        edsLayers, setEdsLayers,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        handleCanvasClick,
        handleWheel,
        confirmCalibration,
        cancelCalibration,
        runAnalysis,
        runDeepRefinement,
        handleGenerateDeepReport,
        processXrdData,
        fftSize, setFftSize,
        zoom, setZoom,
        pan, setPan,
    } = useVisionAnalysis(canvasRef, imgRef, showToast, fftCanvasRef);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (archiveDropdownRef.current && !archiveDropdownRef.current.contains(event.target as Node)) {
                setShowArchiveDropdown(false);
            }
        };

        if (showArchiveDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showArchiveDropdown]);

    useEffect(() => {
        const prev = lastBlobUrlRef.current;
        if (prev && prev !== imageSrc && prev.startsWith('blob:')) {
            URL.revokeObjectURL(prev);
        }
        lastBlobUrlRef.current = imageSrc && imageSrc.startsWith('blob:') ? imageSrc : null;
    }, [imageSrc]);

    useEffect(() => {
        return () => {
            const last = lastBlobUrlRef.current;
            if (last && last.startsWith('blob:')) {
                URL.revokeObjectURL(last);
            }
        };
    }, []);

    // Auto-expand ③参数 when FFT preview becomes available
    useEffect(() => {
        if (fftPreview && mode === 'TEM' && temMode === 'fft') {
            setSectionExpanded(prev => ({ ...prev, params: true }));
        }
    }, [fftPreview, mode, temMode]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCurrentArchiveId(null);
        setImgError(false);

        // 清空旧的分析状态，防止旧结果叠加在新图片上
        setParticles([]);
        setReport(null);
        setAiReport(null);
        setSheetStats(null);
        setLatticeResult(null);
        setDefectStats(null);
        setXrdPeaks([]);

        if (isTiffFile(file)) {
            showToast({ message: "正在转换显微 TIFF 图像...", type: 'info' });
            try {
                const dataUrl = await convertTiffToDataUrl(file);
                setImageSrc(dataUrl);
            } catch (err) {
                showToast({ message: "TIFF 转换失败", type: 'error' });
            }
            return;
        }

        if (file.name.match(/\.(csv|txt|xy|xrdml)$/i)) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const content = event.target?.result as string;
                const data = parseXrdData(content);
                setRawXrdData(data);
                setMode('XRD');
                const plotUrl = await generateXrdPlotImage(data);
                setImageSrc(plotUrl);
            };
            reader.readAsText(file);
        } else {
            const url = URL.createObjectURL(file);
            setImageSrc(url);
        }
    };

    const handleXrdOptionChange = (key: 'smooth' | 'removeBg', value?: boolean) => {
        setXrdOptions(prev => ({ ...prev, [key]: value !== undefined ? value : !prev[key] }));
    };

    const handleClearWorkspace = () => {
        if (!imageSrc && !report) return;
        if (!confirm('确定要清空当前工作间吗？未保存或推送的分析数据将会丢失。')) return;
        setCurrentArchiveId(null);
        setImageSrc(null);
        setParticles([]);
        setXrdPeaks([]);
        setLatticeResult(null);
        setDefectStats(null);
        setSheetStats(null);
        setReport(null);
        setAiReport(null);
        setRawXrdData([]);
        setProcessedXrdData([]);
        setSelectedXrdPeak(null);
        showToast?.({ message: '工作间已清空', type: 'info' });
    };

    const handleSaveReport = () => {
        if (!report) return;
        const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
        saveAs(blob, `Vision_Report_${mode}_${Date.now()}.txt`);
    };

    const handleExportWord = () => {
        if (!report) return;
        let structuredContent = '';

        if (mode === 'XRD' && xrdPeaks.length > 0) {
            const rows = xrdPeaks.map((p, i) => `<tr><td>${i + 1}</td><td>${p.twoTheta.toFixed(2)}</td><td>${p.intensity.toFixed(0)}</td><td>${p.fwhm.toFixed(3)}</td><td>${p.dSpacing.toFixed(4)}</td><td>${p.crystalliteSize.toFixed(2)}</td></tr>`).join('');
            structuredContent = `
            <h2>XRD Peak Analysis</h2>
            <table>
                <thead>
                    <tr><th>#</th><th>2θ (deg)</th><th>Intensity</th><th>FWHM</th><th>d (nm)</th><th>Size (nm)</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <p><strong>Config:</strong> λ=${xrdConfig.wavelength}nm, K=${xrdConfig.shapeFactor}</p>
          `;
        } else if (mode === 'SEM' && semMode === 'particle' && particles.length > 0) {
            const avgSize = (particles.reduce((a, b) => a + (b.realSize || b.radius * 2), 0) / particles.length).toFixed(2);
            const unit = scaleRatio ? "nm" : "px";
            const rows = particles.slice(0, 20).map((p, i) => `<tr><td>${p.id}</td><td>${(p.realSize || p.radius * 2).toFixed(2)}</td></tr>`).join('');
            structuredContent = `
            <h2>Particle Size Statistics</h2>
            <p><strong>Count:</strong> ${particles.length} | <strong>Avg Size:</strong> ${avgSize} ${unit}</p>
            <table><thead><tr><th>ID</th><th>Diameter (${unit})</th></tr></thead><tbody>${rows}</tbody></table>
            ${particles.length > 20 ? '<p><em>(Showing first 20 particles)</em></p>' : ''}
          `;
        } else if (report) {
            structuredContent = `<div class="info-box">${cleanTextForWord(report).replace(/\n/g, '<br/>')}</div>`;
        }

        const htmlContent = `
        <h1>Vision Analysis Report: ${mode}</h1>
        <p style="text-align:right"><strong>Date:</strong> ${new Date().toLocaleString()}</p>
        <hr/>
        ${structuredContent}
        <hr/>
        <p><em>Generated by SciFlow Vision Module</em></p>
      `;

        exportToWord(`Vision_Report_${mode}`, htmlContent);
        showToast({ message: "Word 报告已生成", type: 'success' });
    };

    const handleExportCSV = () => {
        let csvContent = "data:text/csv;charset=utf-8,";
        if (mode === 'XRD') {
            csvContent += "Peak ID,2-Theta (deg),Intensity (a.u.),FWHM (deg),d-spacing (nm),Grain Size (nm)\n";
            xrdPeaks.forEach(p => { csvContent += `${p.id},${p.twoTheta},${p.intensity},${p.fwhm},${p.dSpacing},${p.crystalliteSize}\n`; });
        } else if (mode === 'SEM' && semMode === 'sheet' && sheetStats) {
            csvContent += "Metric,Value,Unit\n";
            csvContent += `Porosity,${sheetStats.porosity.toFixed(2)},%\n`;
            csvContent += `Edge Density,${sheetStats.edgeDensity.toFixed(2)},%\n`;
        } else if (mode === 'TEM' && latticeResult) {
            csvContent += "Metric,Value,Unit\n";
            csvContent += `d-spacing,${latticeResult.dSpacing.toFixed(4)},nm\n`;
            csvContent += `Material,${latticeResult.material},${latticeResult.planeFamily || ''}\n`;
        } else if (mode === 'TEM' && defectStats) {
            csvContent += "Metric,Value,Unit\n";
            csvContent += `Defect Density,${defectStats.defectDensity.toFixed(2)},%\n`;
            csvContent += `Active Sites Estimate,${defectStats.activeSitesEstimate},Level\n`;
        } else {
            const unit = scaleRatio ? "nm" : "px";
            csvContent += `Particle ID,Equiv Diameter (${unit}),Major Axis (px),Minor Axis (px),X (px),Y (px)\n`;
            particles.forEach(p => {
                const d = p.realSize || (2 * Math.sqrt((p.radiusX || p.radius) * (p.radiusY || p.radius)));
                csvContent += `${p.id},${d.toFixed(2)},${(p.radiusX || p.radius).toFixed(2)},${(p.radiusY || p.radius).toFixed(2)},${p.x.toFixed(1)},${p.y.toFixed(1)}\n`;
            });
        }
        const encodedUri = encodeURI(csvContent);
        saveAs(encodedUri, `Analysis_Data_${mode}_${Date.now()}.csv`);
    };

    const handleSyncToMechanism = () => {
        if (mode === 'SEM' && semMode === 'sheet' && sheetStats) {
            updateMechanismSession({
                morphologyLink: {
                    type: 'sheet',
                    value: sheetStats.porosity,
                    label: `Porosity: ${sheetStats.porosity.toFixed(1)}%`
                }
            });
            showToast({ message: "已同步孔隙率至动力学模块 (影响浓差极化)", type: 'success' });
        } else if (mode === 'SEM' && semMode === 'particle' && particles.length > 0) {
            const sizes = particles.map(p => p.realSize || (Math.sqrt((p.radiusX || p.radius) * (p.radiusY || p.radius)) * 2));
            const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
            updateMechanismSession({
                morphologyLink: {
                    type: 'particle',
                    value: avgSize,
                    label: `Avg Size: ${avgSize.toFixed(1)} ${scaleRatio ? 'nm' : 'px'}`
                }
            });
            showToast({ message: "已同步粒径数据至动力学模块 (影响表面有效活性位点)", type: 'success' });
        } else if (mode === 'TEM' && latticeResult) {
            updateMechanismSession({
                morphologyLink: {
                    type: 'lattice',
                    value: latticeResult.dSpacing,
                    label: `d-spacing: ${latticeResult.dSpacing.toFixed(3)} nm (${latticeResult.material})`
                }
            });
            showToast({ message: "已同步晶格间距至动力学模块", type: 'success' });
        } else if (mode === 'TEM' && defectStats) {
            updateMechanismSession({
                morphologyLink: {
                    type: 'defect',
                    value: defectStats.defectDensity,
                    label: `Defect: ${defectStats.defectDensity.toFixed(1)}% (${defectStats.activeSitesEstimate})`
                }
            });
            showToast({ message: "已同步缺陷密度至动力学模块 (影响交换电流密度)", type: 'success' });
        }
    };

    const getExportImageUrl = (): string => {
        if (mode === 'XRD' || !canvasRef.current || !imgRef.current) {
            return imageSrc || '';
        }
        const canvas = canvasRef.current;
        const img = imgRef.current;

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;

        const ctx = exportCanvas.getContext('2d');
        if (ctx) {
            // Fill background with white just in case the image has transparency
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Draw original image
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            // Draw overlay
            ctx.drawImage(canvas, 0, 0);
            return exportCanvas.toDataURL('image/png');
        }
        return canvas.toDataURL('image/png');
    };

    const handleSaveToArchive = (targetLogId?: string, targetLogTitle?: string): string | undefined => {
        if (!imageSrc) {
            showToast?.({ message: "请先上传并分析图片", type: 'warning' });
            return undefined;
        }

        const imageUrl = getExportImageUrl();
        const archiveId = currentArchiveId || `archive_${Date.now()}`;
        const existed = (savedArchives || []).find(a => a.id === archiveId);

        const newArchive: SavedVisionAnalysis = {
            id: archiveId,
            title: existed?.title || `${mode} 分析报告 - ${new Date().toLocaleDateString()}`,
            timestamp: new Date().toLocaleString(),
            imageSrc,
            mode,
            scaleRatio,
            particles,
            xrdPeaks,
            latticeResult,
            defectStats,
            report,
            aiReport: aiReport || null,
            rawXrdData,
            selectedXrdPeak,
            showStandardLine,
            logId: targetLogId || linkedLogId,
            logTitle: targetLogTitle || linkedLogTitle,
            linkedLogId: targetLogId || linkedLogId,
            linkedLogTitle: targetLogTitle || linkedLogTitle,
            linkedProjectId: linkedProjectId || selectedProjectId,
            linkedMilestoneId: linkedMilestoneId || saveMilestoneId || undefined
        };

        const list = savedArchives || [];
        const exists = list.some((a: SavedVisionAnalysis) => a.id === archiveId);
        const nextArchives = exists
            ? list.map((a: SavedVisionAnalysis) => a.id === archiveId ? newArchive : a)
            : [newArchive, ...list];
        setSavedArchives(nextArchives);
        setCurrentArchiveId(archiveId);
        showToast?.({ message: existed ? "分析结果已覆盖更新到本地存档" : "分析结果已保存至本地存档", type: 'success' });
        return archiveId;
    };

    // Map archives to folder-compatible format for FolderLibraryView
    const folderMappedArchives = React.useMemo(() => {
        if (!savedArchives) return [];
        return savedArchives
            .filter(arch => arch.mode === mode)
            .map(arch => {
                const proj = projects.find(p => p.id === arch.linkedProjectId);
                const milestone = proj?.milestones.find(m => m.id === arch.linkedMilestoneId);
                return {
                    ...arch,
                    folder: {
                        projectId: arch.linkedProjectId || '',
                        projectTitle: proj?.title || '未分配项目',
                        milestoneId: arch.linkedMilestoneId || '',
                        milestoneTitle: milestone?.title || '未分配节点',
                        logId: arch.linkedLogId || '',
                        logTitle: arch.linkedLogTitle || '未关联实验记录',
                        path: `${proj?.title || '未分配项目'} / ${milestone?.title || '未分配节点'} / ${arch.linkedLogTitle || '未关联实验记录'}`
                    }
                };
            });
    }, [savedArchives, mode, projects]);

    const handleLoadFromArchive = (archive: SavedVisionAnalysis) => {
        setCurrentArchiveId(archive.id);
        setMode(archive.mode);
        setImageSrc(archive.imageSrc);
        setParticles(archive.particles || []);
        setXrdPeaks(archive.xrdPeaks || []);
        setLatticeResult(archive.latticeResult || null);
        setDefectStats(archive.defectStats || null);
        setReport(archive.report || null);
        setAiReport(archive.aiReport || null);
        setScaleRatio(archive.scaleRatio || null);
        setSelectedXrdPeak(archive.selectedXrdPeak || null);
        setShowStandardLine(archive.showStandardLine || false);
        setRawXrdData(archive.rawXrdData || []);
        setLinkedLogId(archive.linkedLogId);
        setLinkedLogTitle(archive.linkedLogTitle);
        setLinkedProjectId(archive.linkedProjectId);
        setLinkedMilestoneId(archive.linkedMilestoneId);
        setShowArchiveDropdown(false);
        showToast?.({ message: `已成功加载存档: ${archive.title}`, type: 'success' });
    };

    useEffect(() => {
        if (!traceRecordId || !savedArchives?.length) return;
        if (traceLoadedRef.current === traceRecordId) return;
        const [rawId, modeHintRaw] = String(traceRecordId).split('::');
        const modeHint = String(modeHintRaw || '').toUpperCase();
        const preferMode = modeHint.includes('VISION-SEM')
            ? 'SEM'
            : modeHint.includes('VISION-TEM')
                ? 'TEM'
                : modeHint.includes('VISION-XRD')
                    ? 'XRD'
                    : '';

        const byArchiveId = savedArchives.find(a => a.id === rawId);
        const byLogWithMode = preferMode
            ? savedArchives.find(a => (a.linkedLogId === rawId || a.logId === rawId) && String(a.mode || '').toUpperCase() === preferMode)
            : undefined;
        const byLogFallback = savedArchives.find(a => a.linkedLogId === rawId)
            || savedArchives.find(a => a.logId === rawId);
        const matched = byArchiveId || byLogWithMode || byLogFallback;
        if (!matched) return;
        traceLoadedRef.current = traceRecordId;
        handleLoadFromArchive(matched);
        setSectionExpanded(prev => ({ ...prev, archive: true, analysis: true }));
        showToast?.({ message: `已溯源并打开显微分析文档：${matched.title}`, type: 'success' });
    }, [traceRecordId, savedArchives]);

    const handleSyncConfirm = (targetProjectId: string, targetMilestoneId: string, targetLogId: string, aiReport?: string | null, logTitle?: string, saveToArchive: boolean = true) => {
        const project = projects.find(p => p.id === targetProjectId);
        if (!project) return;
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
            cleaned = cleaned
                .replace(/^\s{0,3}#{1,6}\s*/gm, '')
                .replace(/\*\*([^*]+)\*\*/g, '$1')
                .replace(/\*([^*]+)\*/g, '$1')
                .replace(/__([^_]+)__/g, '$1')
                .replace(/_([^_]+)_/g, '$1')
                .replace(/^\s{0,3}>\s?/gm, '')
                .replace(/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/gm, '')
                .replace(/^\s*[-*+]\s+/gm, '')
                .replace(/^\s*\d+\.\s+/gm, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
            return cleaned;
        };

        // Auto-archive on sync only if requested
        let syncedArchiveId: string | null = currentArchiveId;
        if (saveToArchive) {
            syncedArchiveId = handleSaveToArchive(targetLogId, logTitle) || currentArchiveId;
        }

        const imageUrl = getExportImageUrl();
        const newFile: any = {
            id: `file_${Date.now()}`,
            name: `${mode}_Analysis_${Date.now()}.png`,
            url: imageUrl as string,
            type: 'image',
            size: 'Measured'
        };
        const sizes = particles.map((p: any) => Number(p.realSize)).filter((v: number) => Number.isFinite(v) && v > 0);
        const derivedScientificData: Record<string, number> = {};
        if (mode === 'SEM' && semMode === 'particle' && sizes.length > 0) {
            const count = sizes.length;
            const avg = sizes.reduce((a: number, b: number) => a + b, 0) / count;
            const max = Math.max(...sizes);
            const min = Math.min(...sizes);
            const std = Math.sqrt(sizes.map((x: number) => Math.pow(x - avg, 2)).reduce((a: number, b: number) => a + b, 0) / count);
            const pdi = avg > 0 ? std / avg : 0;
            derivedScientificData["平均等效粒径 (nm)"] = Number(avg.toFixed(2));
            derivedScientificData["最大粒径 (nm)"] = Number(max.toFixed(1));
            derivedScientificData["最小粒径 (nm)"] = Number(min.toFixed(1));
            derivedScientificData["标准偏差 (nm)"] = Number(std.toFixed(2));
            derivedScientificData["PDI"] = Number(pdi.toFixed(3));
            derivedScientificData["颗粒总数"] = count;
        } else if (defectStats) {
            derivedScientificData["Defect Density(%)"] = parseFloat(defectStats.defectDensity.toFixed(2));
        } else if (latticeResult) {
            derivedScientificData["d-spacing(nm)"] = Number(latticeResult.dSpacing || 0);
        } else if (sheetStats) {
            derivedScientificData["Porosity(%)"] = parseFloat(sheetStats.porosity.toFixed(1));
            derivedScientificData["Edges(%)"] = parseFloat(sheetStats.edgeDensity.toFixed(1));
        } else if (selectedXrdPeak) {
            derivedScientificData["2-Theta"] = Number(selectedXrdPeak.twoTheta || 0);
            derivedScientificData["Grain Size (nm)"] = Number(selectedXrdPeak.crystalliteSize || 0);
        } else {
            derivedScientificData["颗粒总数"] = particles.length;
        }

        const extractConclusion = (text?: string | null): string => {
            if (!text) return '';
            const cleaned = text
                .replace(/[#>*`_]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (!cleaned) return '';
            const first = cleaned.split(/[。！？\n]/).map(s => s.trim()).filter(Boolean)[0] || cleaned;
            return first.length > 140 ? `${first.slice(0, 140)}...` : first;
        };
        const keyConclusion = (() => {
            if (mode === 'SEM' && semMode === 'particle' && sizes.length > 0) {
                const avg = derivedScientificData["平均等效粒径 (nm)"];
                const max = derivedScientificData["最大粒径 (nm)"];
                const min = derivedScientificData["最小粒径 (nm)"];
                const std = derivedScientificData["标准偏差 (nm)"];
                const pdi = derivedScientificData["PDI"];
                return `SEM 颗粒统计关键结论：平均等效粒径 ${avg} nm，最大/最小 ${max}/${min} nm，标准偏差 ${std} nm，PDI ${pdi}。`;
            }
            if (mode === 'SEM' && semMode === 'sheet' && sheetStats) {
                return `SEM 片层关键结论：孔隙率 ${sheetStats.porosity.toFixed(2)}%，边缘密度 ${sheetStats.edgeDensity.toFixed(4)} μm⁻¹。`;
            }
            if (mode === 'TEM' && latticeResult) {
                return `TEM 晶格关键结论：d-spacing 为 ${Number(latticeResult.dSpacing).toFixed(3)} nm。`;
            }
            if (mode === 'XRD' && selectedXrdPeak) {
                return `XRD 关键结论：主峰 2θ=${Number(selectedXrdPeak.twoTheta).toFixed(2)}°，晶粒尺寸 ${Number(selectedXrdPeak.crystalliteSize).toFixed(2)} nm。`;
            }
            return extractConclusion(aiReport) || extractConclusion(report) || `视觉分析(${mode})已同步。`;
        })();

        const xrdChart = xrdPeaks.slice(0, 12).map((p, idx) => ({ x: idx + 1, y: Number(p.intensity || p.crystalliteSize || 0) }));
        const particleChart = particles.slice(0, 12).map((p: any, idx: number) => ({
            x: idx + 1,
            y: Number(p.diameter || p.size || p.area || 0)
        })).filter((p: any) => Number.isFinite(p.y) && p.y >= 0);
        const fallbackChart = [{ x: 0, y: 0 }, { x: 1, y: particles.length || 1 }];
        const chartData = xrdChart.length > 0 ? xrdChart : (particleChart.length > 0 ? particleChart : fallbackChart);
        const moduleId = (() => {
            if (mode === 'SEM') return `vision-sem-${semMode}`;
            if (mode === 'TEM') return `vision-tem-${temMode}`;
            return `vision-${mode.toLowerCase()}`;
        })();
        const moduleLabel = (() => {
            if (mode === 'SEM') return semMode === 'particle' ? 'SEM OD粒径' : 'SEM 2D片层';
            if (mode === 'TEM') return 'TEM 晶格';
            if (mode === 'XRD') return 'XRD 视觉解析';
            return `${mode} 视觉解析`;
        })();
        const aiDeepAnalysis = (mode === 'SEM' || mode === 'TEM')
            ? (sanitizeLatexArtifacts((aiReport || report || '').trim()) || undefined)
            : undefined;
        const safeRawReport = sanitizeLatexArtifacts((aiReport || report || '').trim());
        const syncedModuleEntry = {
            moduleId,
            moduleLabel,
            mode: `VISION-${mode}`,
            summary: keyConclusion,
            aiDeepAnalysis,
            thumbnailUrl: imageUrl,
            sourceAnalysisId: syncedArchiveId || undefined,
            sourceAnalysisType: 'microscopy',
            sourceAnalysisTitle: logTitle || undefined,
            generatedAt: new Date().toISOString(),
            metrics: derivedScientificData,
            chartData
        };
        const deepAnalysisPayload = {
            mode: `VISION-${mode}`,
            aiConclusion: keyConclusion,
            summary: keyConclusion,
            rawReport: safeRawReport,
            aiDeepAnalysis,
            chartData,
            thumbnailUrl: imageUrl,
            matrixSync: Boolean(mechanismSession.morphologyLink),
            generatedAt: new Date().toISOString(),
            linkedAnalysisMeta: syncedArchiveId ? {
                id: syncedArchiveId,
                type: 'microscopy',
                title: logTitle || `视觉分析 ${mode}`
            } : undefined
        };

        let updatedMilestones = [...project.milestones];

        if (targetLogId === 'NEW_LOG') {
            const newLog: ExperimentLog = {
                id: Date.now().toString(),
                timestamp: new Date().toLocaleString(),
                content: `[视觉分析] ${mode} 智能解析`,
                description: keyConclusion,
                parameters: `Mode: ${mode} (${mode === 'SEM' ? semMode : mode === 'TEM' ? temMode : 'Standard'})`,
                status: 'Verified',
                result: 'neutral',
                files: [newFile],
                linkedAnalysis: syncedArchiveId ? {
                    id: syncedArchiveId,
                    type: 'microscopy' as const,
                    title: logTitle || `视觉分析 ${mode}`
                } : undefined,
                deepAnalysis: {
                    ...deepAnalysisPayload,
                    syncedModules: [syncedModuleEntry],
                    lastSyncedModuleId: moduleId
                }
            };
            updatedMilestones = project.milestones.map(m => m.id === targetMilestoneId ? { ...m, logs: [newLog, ...m.logs] } : m);
        } else {
            updatedMilestones = project.milestones.map(m => {
                if (m.id === targetMilestoneId) {
                    const updatedLogs = m.logs.map(l => {
                        if (l.id === targetLogId) {
                            const description = l.description ? `${l.description}\n\n[Vision关键结论] ${keyConclusion}` : `[Vision关键结论] ${keyConclusion}`;
                            const prevDeep = l.deepAnalysis || {};
                            const prevModules = Array.isArray(prevDeep.syncedModules) ? prevDeep.syncedModules : [];
                            const mergedModules = [
                                syncedModuleEntry,
                                ...prevModules.filter((it: any) => String(it?.moduleId) !== moduleId)
                            ];
                            return {
                                ...l,
                                description,
                                files: [...(l.files || []), newFile],
                                linkedAnalysis: syncedArchiveId ? {
                                    id: syncedArchiveId,
                                    type: 'microscopy' as const,
                                    title: logTitle || `视觉分析 ${mode}`
                                } : l.linkedAnalysis,
                                deepAnalysis: {
                                    ...prevDeep,
                                    ...deepAnalysisPayload,
                                    syncedModules: mergedModules,
                                    lastSyncedModuleId: moduleId
                                }
                            };
                        }
                        return l;
                    });
                    return { ...m, logs: updatedLogs };
                }
                return m;
            });
        }

        onUpdateProject({ ...project, milestones: updatedMilestones });

        // After syncing, we can also set the link if it doesn't exist
        if (!linkedLogId) {
            setLinkedLogId(targetLogId === 'NEW_LOG' ? updatedMilestones.find(m => m.id === targetMilestoneId)?.logs[0].id : targetLogId);
            setLinkedLogTitle(logTitle);
            setLinkedProjectId(targetProjectId);
            setLinkedMilestoneId(targetMilestoneId);
        }

        setShowSyncModal(false);
        showToast({ message: "分析结果及深度报告已成功同步至实验记录", type: 'success' });
    };

    const handleTraceLog = () => {
        if (!linkedProjectId || !linkedLogId) {
            showToast?.({ message: "未找到关联的实验记录位置", type: 'warning' });
            return;
        }

        // 记录返回路径，跳回这里的 microscopy 模式
        setReturnPath?.('characterization_hub/microscopy');

        // 使用精确的路由带上关联节点
        navigate('project_detail', linkedProjectId, 'logs');
        showToast?.({ message: "正在回溯至数据存放节点...", type: 'info' });
    };

    const hasDataToSync = (mode === 'SEM' && semMode === 'sheet' && sheetStats) || (mode !== 'XRD' && particles.length > 0) || (mode === 'TEM' && (latticeResult || defectStats)) || (mode === 'XRD' && selectedXrdPeak);

    const handleJudgeMorphology = () => {
        if (!canvasRef.current || !imgRef.current || !imageSrc) {
            showToast?.({ message: '请先上传并加载显微图像', type: 'warning' });
            return;
        }
        const width = canvasRef.current.width || imgRef.current.naturalWidth || 1024;
        const height = canvasRef.current.height || imgRef.current.naturalHeight || 768;
        if (!width || !height) {
            showToast?.({ message: '图像尺寸异常，无法判定', type: 'error' });
            return;
        }

        setIsJudgingMorphology(true);

        setTimeout(() => {
            try {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = width;
                tempCanvas.height = height;
                const tempCtx = tempCanvas.getContext('2d');
                if (!tempCtx) throw new Error('无法创建画布上下文');
                tempCtx.drawImage(imgRef.current as HTMLImageElement, 0, 0, width, height);

                const detected = detectParticlesFromCanvas(tempCtx, width, height, scaleRatio || 0);
                const sheet = analyzeSheetStructure(tempCtx, width, height);

                const count = detected.length;
                const aspectRatios = detected.map(p => {
                    const rx = Math.max(0.5, Number(p.radiusX || p.radius || 1));
                    const ry = Math.max(0.5, Number(p.radiusY || p.radius || 1));
                    return Math.max(rx, ry) / Math.min(rx, ry);
                }).sort((a, b) => a - b);
                const medianAspectRatio = aspectRatios.length
                    ? aspectRatios[Math.floor(aspectRatios.length / 2)]
                    : 0;
                const sizes = detected.map(p => Number(p.realSize || (2 * Math.sqrt((p.radiusX || p.radius) * (p.radiusY || p.radius))))).filter(v => Number.isFinite(v) && v > 0);
                const avgSize = sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0;
                const stdSize = sizes.length ? Math.sqrt(sizes.map(v => (v - avgSize) ** 2).reduce((a, b) => a + b, 0) / sizes.length) : 0;
                const pdi = avgSize > 0 ? stdSize / avgSize : 0;

                const porosity = Number(sheet.porosity || 0);
                const edgeDensity = Number(sheet.edgeDensity || 0);

                const countScore = Math.min(count / 30, 1);
                const shapeScore = count > 0 ? (medianAspectRatio <= 1.8 ? 1 : medianAspectRatio <= 2.6 ? 0.6 : 0.25) : 0;
                const dispersionScore = count > 0 ? (pdi <= 0.35 ? 1 : pdi <= 0.6 ? 0.6 : 0.25) : 0;
                const score0d = 0.4 * countScore + 0.35 * shapeScore + 0.25 * dispersionScore;

                const porosityScore = porosity >= 8 && porosity <= 70 ? 1 : porosity >= 5 && porosity <= 80 ? 0.6 : 0.2;
                const edgeScore = edgeDensity >= 5 ? 1 : edgeDensity >= 2.5 ? 0.65 : 0.25;
                const antiParticleScore = count <= 8 ? 1 : count <= 18 ? 0.65 : 0.3;
                const score2d = 0.4 * porosityScore + 0.35 * edgeScore + 0.25 * antiParticleScore;

                let label: MorphologyJudgeLabel = '混合形貌';
                let semSuggestion: 'particle' | 'sheet' | null = null;
                const delta = Math.abs(score0d - score2d);
                if (score0d < 0.45 && score2d < 0.45) {
                    label = '两者都不适合';
                } else if (delta < 0.16) {
                    label = '混合形貌';
                } else if (score0d > score2d) {
                    label = '0D 颗粒';
                    semSuggestion = 'particle';
                } else {
                    label = '2D 片层';
                    semSuggestion = 'sheet';
                }

                const confidence = Math.max(
                    52,
                    Math.min(96, Math.round((Math.max(score0d, score2d) * 0.7 + delta * 0.6) * 100))
                );
                const reasons: string[] = [
                    `颗粒数: ${count}，中位长宽比: ${medianAspectRatio ? medianAspectRatio.toFixed(2) : 'N/A'}，PDI: ${pdi ? pdi.toFixed(3) : 'N/A'}`,
                    `片层孔隙率: ${porosity.toFixed(2)}%，边缘密度: ${edgeDensity.toFixed(2)}`
                ];
                if (label === '0D 颗粒') reasons.push('颗粒数量与圆整度特征更符合离散颗粒体系。');
                if (label === '2D 片层') reasons.push('孔隙/边缘统计更接近片层网络特征。');
                if (label === '混合形貌') reasons.push('两组特征接近，建议标注为 0D+2D 混合并分区统计。');
                if (label === '两者都不适合') reasons.push('当前特征不典型，可能更接近 1D/3D 结构或图像质量不足。');

                setJudgeResult({
                    label,
                    confidence,
                    semSuggestion,
                    reasons,
                    metrics: {
                        particleCount: count,
                        medianAspectRatio,
                        pdi,
                        porosity,
                        edgeDensity
                    }
                });
                showToast?.({ message: `形貌判定完成：${label}`, type: 'success' });
            } catch (err) {
                console.error('Morphology judgment failed', err);
                showToast?.({ message: '形貌判定失败，请重试', type: 'error' });
            } finally {
                setIsJudgingMorphology(false);
            }
        }, 50);
    };


    return (
        <div className="flex h-full min-h-0 gap-0 animate-reveal overflow-hidden relative">
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleUpload} accept="image/*,.csv,.txt,.xy,.xrdml" />

            {/* ═══════ 左侧工具栏 ═══════ */}
            <div className="w-72 h-full min-h-0 overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar border-r border-slate-200 bg-white p-3 space-y-2.5">

                {/* ── ① 模式选择 ── */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <button onClick={() => toggleSection('mode')} className="w-full flex items-center justify-between px-3.5 py-3.5 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-1.5">
                            <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                            <span className="text-[12px] font-black text-slate-700 uppercase tracking-wide">① 模式</span>
                        </div>
                        <i className={`fa-solid fa-chevron-${sectionExpanded.mode ? 'up' : 'down'} text-slate-400 text-[10px]`}></i>
                    </button>
                    {sectionExpanded.mode && (
                        <div className="p-3 flex flex-col gap-1.5">
                            <div className="flex bg-slate-100 rounded-lg p-0.5">
                                {(['SEM', 'TEM'] as const).map(m => (
                                    <button key={m} onClick={() => setMode(m as any)}
                                        className={`flex-1 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${mode === m ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}>
                                        {m}
                                    </button>
                                ))}
                            </div>
                            {mode === 'SEM' && (
                                <div className="flex flex-col gap-1 animate-reveal">
                                    <button onClick={() => { setSemMode('particle'); setReport(null); }}
                                        className={`w-full px-2 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 border ${semMode === 'particle' ? 'bg-indigo-600 text-white border-indigo-500' : 'border-slate-100 text-slate-500 hover:bg-slate-50'}`}>
                                        <i className="fa-solid fa-braille text-[11px]"></i> 0D 颗粒
                                    </button>
                                    <button onClick={() => { setSemMode('sheet'); setReport(null); }}
                                        className={`w-full px-2 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 border ${semMode === 'sheet' ? 'bg-indigo-600 text-white border-indigo-500' : 'border-slate-100 text-slate-500 hover:bg-slate-50'}`}>
                                        <i className="fa-solid fa-layer-group text-[11px]"></i> 2D 片层
                                    </button>
                                    <button
                                        onClick={handleJudgeMorphology}
                                        disabled={!imageSrc || isJudgingMorphology}
                                        className="w-full px-2 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <i className={`fa-solid ${isJudgingMorphology ? 'fa-spinner fa-spin' : 'fa-compass-drafting'} text-[11px]`}></i>
                                        {isJudgingMorphology ? '判定中...' : '自动判断形貌'}
                                    </button>
                                    {judgeResult && (
                                        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2 text-[10px] text-slate-700 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="font-black text-amber-800">判定: {judgeResult.label}</span>
                                                <span className="font-bold text-amber-700">置信度 {judgeResult.confidence}%</span>
                                            </div>
                                            <div className="text-[10px] text-slate-600">
                                                颗粒 {judgeResult.metrics.particleCount} | 长宽比 {judgeResult.metrics.medianAspectRatio ? judgeResult.metrics.medianAspectRatio.toFixed(2) : 'N/A'} | 孔隙率 {judgeResult.metrics.porosity.toFixed(1)}%
                                            </div>
                                            {judgeResult.semSuggestion && (
                                                <button
                                                    onClick={() => {
                                                        const suggestedMode = judgeResult.semSuggestion;
                                                        if (!suggestedMode) return;
                                                        setSemMode(suggestedMode);
                                                        showToast?.({
                                                            message: `已切换到建议模式：${suggestedMode === 'particle' ? '0D 颗粒' : '2D 片层'}`,
                                                            type: 'info'
                                                        });
                                                    }}
                                                    className="w-full py-1 rounded-md bg-amber-600 text-white text-[10px] font-black hover:bg-amber-700 transition-colors"
                                                >
                                                    应用建议模式
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            {mode === 'TEM' && (
                                <div className="flex flex-col gap-1 animate-reveal">
                                    {([
                                        { key: 'lattice', label: 'Lattice', icon: 'fa-ruler-combined' },
                                        { key: 'fft', label: 'FFT', icon: 'fa-circle-nodes' },
                                        { key: 'defect', label: 'Defect', icon: 'fa-virus' },
                                        { key: 'particle', label: 'Particle', icon: 'fa-braille' },
                                        { key: 'angle', label: 'Angle', icon: 'fa-drafting-compass' },
                                        { key: 'saed', label: 'SAED', icon: 'fa-bullseye' },
                                        { key: 'eds', label: 'EDS', icon: 'fa-layer-group' },
                                    ] as const).map(({ key, label, icon }) => (
                                        <button key={key}
                                            onClick={() => { setTemMode(key); setReport(null); if (key !== 'fft') setFftPreview(null); if (key !== 'defect') setDefectStats(null); }}
                                            className={`w-full px-2 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 border ${temMode === key ? 'bg-indigo-600 text-white border-indigo-500' : 'border-slate-100 text-slate-500 hover:bg-slate-50'}`}>
                                            <i className={`fa-solid ${icon} text-[11px]`}></i> {label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── ② 数据输入 ── */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <button onClick={() => toggleSection('input')} className="w-full flex items-center justify-between px-3.5 py-3.5 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-1.5">
                            <div className="w-1 h-3 bg-emerald-500 rounded-full" />
                            <span className="text-[12px] font-black text-slate-700 uppercase tracking-wide">② 输入</span>
                        </div>
                        <i className={`fa-solid fa-chevron-${sectionExpanded.input ? 'up' : 'down'} text-slate-400 text-[10px]`}></i>
                    </button>
                    {sectionExpanded.input && (
                        <div className="p-3 flex flex-col gap-1.5">
                            <button onClick={() => fileInputRef.current?.click()}
                                className="w-full py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase shadow-sm hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-1.5">
                                <i className="fa-solid fa-file-import text-[10px]"></i>
                                {imageSrc ? '替换图像' : '上传图像'}
                            </button>
                            {imageSrc && (
                                <button onClick={handleClearWorkspace}
                                    className="w-full py-2 bg-rose-50 text-rose-500 rounded-lg text-[10px] font-black uppercase border border-rose-100 hover:bg-rose-100 active:scale-95 transition-all">
                                    <i className="fa-solid fa-trash-can mr-1 text-[11px]"></i>清空
                                </button>
                            )}
                            {imageSrc && (
                                <div className="px-2 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                    <i className="fa-solid fa-circle-check text-emerald-500 text-[11px]"></i>
                                    模式: <span className="font-black">{mode}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── ③ 测量参数 ── */}
                {imageSrc && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-reveal">
                        <button onClick={() => toggleSection('params')} className="w-full flex items-center justify-between px-3.5 py-3.5 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1 h-3 bg-amber-500 rounded-full" />
                                <span className="text-[12px] font-black text-slate-700 uppercase tracking-wide">③ 参数</span>
                            </div>
                            <i className={`fa-solid fa-chevron-${sectionExpanded.params ? 'up' : 'down'} text-slate-400 text-[10px]`}></i>
                        </button>
                        {sectionExpanded.params && (
                            <div className="p-3">
                                <VisionControls
                                    mode={mode} temMode={temMode} semMode={semMode}
                                    scaleRatio={scaleRatio} particles={particles} sheetStats={sheetStats}
                                    xrdOptions={xrdOptions} onXrdOptionChange={handleXrdOptionChange}
                                    xrdConfig={xrdConfig} setXrdConfig={setXrdConfig}
                                    showStandardLine={showStandardLine} setShowStandardLine={setShowStandardLine}
                                    detectedPeaksCount={xrdPeaks.length} hasRawData={rawXrdData.length > 0}
                                    latticeLayers={latticeLayers} setLatticeLayers={setLatticeLayers}
                                    latticeResult={latticeResult} fftCanvasRef={fftCanvasRef}
                                    defectStats={defectStats}
                                    fftPreview={fftPreview}
                                    fftSize={fftSize} setFftSize={setFftSize}
                                    useWatershedSplit={useWatershedSplit}
                                    setUseWatershedSplit={setUseWatershedSplit}
                                    particleStrictnessLevel={particleStrictnessLevel}
                                    setParticleStrictnessLevel={setParticleStrictnessLevel}
                                    semParticleDiagnostics={semParticleDiagnostics}
                                    angleLine1={angleLine1} angleLine2={angleLine2}
                                    angleDrawingLine={angleDrawingLine}
                                    angleLayers1={angleLayers1} setAngleLayers1={setAngleLayers1}
                                    angleLayers2={angleLayers2} setAngleLayers2={setAngleLayers2}
                                    angleResult={angleResult}
                                    setAngleLine1={setAngleLine1} setAngleLine2={setAngleLine2}
                                    setAngleResult={setAngleResult} setAngleDrawingLine={setAngleDrawingLine}
                                    saedResult={saedResult}
                                    edsLayers={edsLayers} setEdsLayers={setEdsLayers}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* ── ④ 智能分析 ── */}
                {imageSrc && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-reveal">
                        <button onClick={() => toggleSection('analysis')} className="w-full flex items-center justify-between px-3.5 py-3.5 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1 h-3 bg-violet-500 rounded-full" />
                                <span className="text-[12px] font-black text-slate-700 uppercase tracking-wide">④ 分析</span>
                            </div>
                            <i className={`fa-solid fa-chevron-${sectionExpanded.analysis ? 'up' : 'down'} text-slate-400 text-[10px]`}></i>
                        </button>
                        {sectionExpanded.analysis && (
                            <div className="p-2.5 flex flex-col gap-1.5 min-w-0">
                                {/* 关联实验记录 */}
                                <button onClick={() => setShowLinkModal(true)}
                                    className={`w-full min-w-0 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border transition-all px-2 overflow-hidden ${linkedLogId ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-dashed border-slate-300 text-slate-500 hover:border-violet-400'}`}>
                                    <i className={`fa-solid ${linkedLogId ? 'fa-link' : 'fa-link-slash'} text-[10px] shrink-0`}></i>
                                    <span className="block min-w-0 truncate whitespace-nowrap text-[10px] leading-none">{linkedLogId ? (linkedLogTitle || '已关联') : '关联记录'}</span>
                                </button>
                                {/* 启动分析 / AI */}
                                {!report ? (
                                    <button onClick={runAnalysis} disabled={isProcessing}
                                        className="w-full min-w-0 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase shadow-md hover:bg-indigo-600 disabled:opacity-60 active:scale-95 transition-all flex items-center justify-center gap-1.5 overflow-hidden">
                                        {isProcessing
                                            ? <><i className="fa-solid fa-spinner fa-spin text-[11px]"></i> 计算中</>
                                            : <><i className="fa-solid fa-magnifying-glass-chart text-[11px]"></i> 启动分析</>}
                                    </button>
                                ) : (
                                    <>
                                        <button onClick={() => handleGenerateDeepReport()} disabled={isGeneratingAi || isProcessing}
                                            className="w-full min-w-0 py-1.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg text-[10px] font-black uppercase shadow-sm disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-1 overflow-hidden whitespace-nowrap">
                                            <i className={`fa-solid ${isGeneratingAi ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} text-[11px]`}></i>
                                            {isGeneratingAi ? 'AI中...' : 'AI诊断'}
                                        </button>
                                        {mode === 'SEM' && (
                                            <button onClick={runDeepRefinement} disabled={isProcessing}
                                                className="w-full min-w-0 py-1.5 bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white rounded-lg text-[10px] font-black uppercase shadow-sm disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-1 overflow-hidden whitespace-nowrap">
                                                <i className={`fa-solid ${isProcessing ? 'fa-spinner fa-spin' : 'fa-brain'} text-[11px]`}></i> AI补全
                                            </button>
                                        )}
                                    </>
                                )}
                                {/* 动力学同步 */}
                                {hasDataToSync && (
                                    <button onClick={handleSyncToMechanism}
                                        className="w-full min-w-0 py-1.5 bg-teal-600 text-white rounded-lg text-[10px] font-black uppercase shadow-sm hover:bg-teal-700 transition-all active:scale-95 flex items-center justify-center gap-1 overflow-hidden whitespace-nowrap">
                                        <i className="fa-solid fa-link text-[11px]"></i> 同步动力学
                                    </button>
                                )}
                                {mechanismSession.morphologyLink && (
                                    <VisionSyncStatus morphologyLink={mechanismSession.morphologyLink} />
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── ⑤ 存档管理 ── */}
                {imageSrc && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm animate-reveal">
                        <button onClick={() => toggleSection('archive')} className="w-full flex items-center justify-between px-3.5 py-3.5 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1 h-3 bg-slate-400 rounded-full" />
                                <span className="text-[12px] font-black text-slate-700 uppercase tracking-wide">⑤ 存档</span>
                            </div>
                            <i className={`fa-solid fa-chevron-${sectionExpanded.archive ? 'up' : 'down'} text-slate-400 text-[10px]`}></i>
                        </button>
                        {sectionExpanded.archive && (
                            <div className="p-3 flex flex-col gap-1.5">
                                <button onClick={() => { const a = getAutoSelections(projects, selectedProjectId || projects[0]?.id); setSaveMilestoneId(a.milestoneId); setSaveLogId(a.logId); setShowSaveArchiveModal(true); }}
                                    className="w-full py-2 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase border border-emerald-100 hover:bg-emerald-100 active:scale-95 transition-all flex items-center justify-center gap-1">
                                    <i className="fa-solid fa-floppy-disk text-[11px]"></i> 保存分析
                                </button>
                                {report && (
                                    <button onClick={() => {
                                        if (linkedLogId && linkedProjectId && linkedMilestoneId) {
                                            handleSyncConfirm(linkedProjectId, linkedMilestoneId, linkedLogId, aiReport, linkedLogTitle);
                                        } else { setShowSyncModal(true); }
                                    }}
                                        className="w-full py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase shadow-sm hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-1">
                                        <i className="fa-solid fa-cloud-arrow-up text-[11px]"></i>
                                        {linkedLogId ? '推送记录' : '推送至记录'}
                                    </button>
                                )}
                                {linkedLogId && (
                                    <button onClick={handleTraceLog}
                                        className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase border border-indigo-100 hover:bg-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-1">
                                        <i className="fa-solid fa-arrow-turn-up text-[11px]"></i> 追溯记录
                                    </button>
                                )}
                                {/* 存档库 - 按钮触发弹窗 */}
                                <button onClick={() => setShowArchiveDropdown(true)}
                                    className="w-full py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 border bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 transition-all">
                                    <i className="fa-solid fa-box-archive text-[11px]"></i> {mode} 存档库
                                </button>
                                {/* 导出 */}
                                {report && (
                                    <div className="flex gap-1 pt-1 border-t border-slate-100">
                                        <button onClick={handleExportCSV} className="flex-1 py-1.5 bg-slate-50 border border-slate-100 text-slate-500 rounded-lg text-[11px] font-black uppercase hover:bg-slate-100 active:scale-95">
                                            <i className="fa-solid fa-file-csv mr-0.5 text-emerald-500"></i>CSV
                                        </button>
                                        <button onClick={handleExportWord} className="flex-1 py-1.5 bg-slate-50 border border-slate-100 text-slate-500 rounded-lg text-[11px] font-black uppercase hover:bg-slate-100 active:scale-95">
                                            <i className="fa-solid fa-file-word mr-0.5 text-indigo-500"></i>Word
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ═══════ 中间主区域 ═══════ */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                {!imageSrc ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                        <div className="w-24 h-24 bg-indigo-50 text-indigo-500 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner animate-pulse">
                            <i className="fa-solid fa-microscope text-4xl"></i>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic mb-3">视觉测量平台</h3>
                        <p className="text-slate-500 font-medium leading-relaxed mb-6 text-[11px] max-w-md">
                            SEM（颗粒/片层）、TEM（Lattice/FFT/Defect）图像解析<br />
                            内置标尺校准、AI 椭圆拟合、孔隙率统计
                        </p>
                        <div className="grid grid-cols-3 gap-3 mb-6 w-full max-w-md">
                            {[
                                { step: '01', icon: 'fa-sliders', label: '选择模式' },
                                { step: '02', icon: 'fa-file-import', label: '上传图像' },
                                { step: '03', icon: 'fa-magnifying-glass-chart', label: '启动分析' },
                            ].map(({ step, icon, label }) => (
                                <div key={step} className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-slate-100">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                        <i className={`fa-solid ${icon} text-indigo-500 text-sm`}></i>
                                    </div>
                                    <div className="text-[7px] font-black text-slate-300 uppercase">STEP {step}</div>
                                    <div className="text-[8px] font-black text-slate-700">{label}</div>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => fileInputRef.current?.click()}
                                className="px-10 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase shadow-2xl active:scale-95 transition-all flex items-center gap-2 hover:bg-slate-900">
                                <i className="fa-solid fa-file-import"></i> 上传图像 / 数据
                            </button>
                            {savedArchives && savedArchives.filter(a => a.mode === mode).length > 0 && (
                                <button onClick={() => setShowArchiveDropdown(true)}
                                    className="px-8 py-3.5 bg-white text-slate-600 rounded-2xl font-black text-[11px] uppercase border-2 border-slate-200 active:scale-95 transition-all flex items-center gap-2 hover:border-indigo-400 hover:text-indigo-600">
                                    <i className="fa-solid fa-box-archive"></i> 从存档库导入
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <VisionCanvas
                        canvasRef={canvasRef} imgRef={imgRef} containerRef={containerRef}
                        imageSrc={imageSrc} mode={mode}
                        isCalibrating={isCalibrating} setIsCalibrating={setIsCalibrating}
                        scaleRatio={scaleRatio} setScaleRatio={setScaleRatio}
                        calibrationLine={calibrationLine} setCalibrationLine={setCalibrationLine}
                        tempLineEnd={tempLineEnd} setTempLineEnd={setTempLineEnd}
                        particles={particles} xrdPeaks={xrdPeaks}
                        hoveredParticleId={hoveredParticleId} sheetOverlay={sheetOverlay}
                        latticeLine={latticeLine} fftBox={temMode === 'fft' ? fftBox : null}
                        fftSize={fftSize} zoom={zoom} setZoom={setZoom} pan={pan} setPan={setPan}
                        angleLine1={temMode === 'angle' ? angleLine1 : null}
                        angleLine2={temMode === 'angle' ? angleLine2 : null}
                        angleResult={temMode === 'angle' ? angleResult : null}
                        saedResult={temMode === 'saed' ? saedResult : null}
                        edsLayers={temMode === 'eds' ? edsLayers : undefined}
                        imgError={imgError} setImgError={setImgError}
                        isProcessing={isProcessing}
                        showCalibrationInput={showCalibrationInput} setShowCalibrationInput={setShowCalibrationInput}
                        realLengthInput={realLengthInput} setRealLengthInput={setRealLengthInput}
                        onConfirmCalibration={confirmCalibration} onCancelCalibration={cancelCalibration}
                        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
                        onCanvasClick={handleCanvasClick} onWheel={handleWheel}
                        onClearImage={() => setImageSrc(null)} onResetReport={() => setReport(null)}
                        showStandardLine={showStandardLine}
                    />
                )}
            </div>

            {/* ═══════ 右侧结果面板 ═══════ */}
            {imageSrc && (
                <div className="w-80 shrink-0 flex flex-col gap-2 p-3 overflow-hidden border-l border-slate-200 bg-white">
                    <div className="flex items-center gap-1.5 px-1 py-1 shrink-0">
                        <i className="fa-solid fa-chart-pie text-indigo-400 text-[10px]"></i>
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-wide">分析结果</span>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                        <VisionResults
                            mode={mode} report={report} confidence={confidence}
                            particles={particles} xrdPeaks={xrdPeaks}
                            isProcessing={isProcessing} scaleRatio={scaleRatio}
                            isCalibrating={isCalibrating}
                            onRunAnalysis={runAnalysis} onRunDeepRefinement={runDeepRefinement}
                            onExportCSV={handleExportCSV} onSaveReport={handleSaveReport}
                            onExportWord={handleExportWord}
                            onSyncToLog={() => {
                                if (linkedLogId && linkedProjectId && linkedMilestoneId) {
                                    handleSyncConfirm(linkedProjectId, linkedMilestoneId, linkedLogId, aiReport, linkedLogTitle);
                                } else { setShowSyncModal(true); }
                            }}
                            onRunDeepReport={() => handleGenerateDeepReport()}
                            isGeneratingAi={isGeneratingAi} aiReport={aiReport}
                            isLinked={!!linkedLogId} onTraceLog={handleTraceLog}
                            semParticleDiagnostics={semParticleDiagnostics}
                        />
                    </div>
                </div>
            )}

            {/* ═══ 存档库弹窗 ═══ */}
            {showArchiveDropdown && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative flex flex-col max-h-[80vh]">
                        <h3 className="text-xl font-black text-slate-800 mb-6 uppercase italic border-l-4 border-indigo-600 pl-4">{mode} 存档库</h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            <FolderLibraryView
                                records={folderMappedArchives}
                                onLoad={(arch: any) => { handleLoadFromArchive(arch); setShowArchiveDropdown(false); }}
                                onDelete={(id: string) => { if (confirm('删除？')) { setSavedArchives(savedArchives?.filter(a => a.id !== id) || []); showToast?.({ message: '已删除', type: 'success' }); } }}
                                emptyText="暂无存档"
                            />
                        </div>
                        <button onClick={() => setShowArchiveDropdown(false)} className="mt-6 w-full py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200">关闭</button>
                    </div>
                </div>
            )}

            {/* ═══ 保存分析弹窗 ═══ */}
            {showSaveArchiveModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white">
                        <h3 className="text-lg font-black text-slate-800 mb-6 uppercase italic pl-2">保存 {mode} 分析</h3>
                        {/* 归档位置选择 */}
                        <div className="space-y-3 mb-6">
                            <p className="text-[9px] font-black text-slate-400 uppercase px-1">归档位置（可选）</p>
                            <div className="relative">
                                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors" value={saveMilestoneId} onChange={e => { setSaveMilestoneId(e.target.value); const ms = projects.find(p => p.id === (selectedProjectId || projects[0]?.id))?.milestones.find(m => m.id === e.target.value); setSaveLogId(ms?.logs?.[0]?.id || ''); }}>
                                    <option value="">选择实验节点...</option>
                                    {flattenMilestonesTree(projects.find(p => p.id === (selectedProjectId || projects[0]?.id))?.milestones || []).map(({ milestone: m, depth, label }) => <option key={m.id} value={m.id}>{'　'.repeat(depth)}{label}  {m.title}</option>)}
                                </select>
                                <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                            </div>
                            {saveMilestoneId && (
                                <div className="relative animate-reveal">
                                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors" value={saveLogId} onChange={e => setSaveLogId(e.target.value)}>
                                        <option value="">关联实验记录...</option>
                                        {(projects.find(p => p.id === (selectedProjectId || projects[0]?.id))?.milestones.find(m => m.id === saveMilestoneId)?.logs || []).map(l => <option key={l.id} value={l.id}>{l.content.substring(0, 30)}...</option>)}
                                    </select>
                                    <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowSaveArchiveModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase">取消</button>
                            <button onClick={() => {
                                // 如果用户选择了节点和记录，更新关联
                                if (saveMilestoneId) {
                                    setLinkedMilestoneId(saveMilestoneId);
                                    setLinkedProjectId(selectedProjectId || projects[0]?.id);
                                }
                                if (saveLogId) {
                                    setLinkedLogId(saveLogId);
                                    const log = projects.find(p => p.id === (selectedProjectId || projects[0]?.id))
                                        ?.milestones.find(m => m.id === saveMilestoneId)
                                        ?.logs.find(l => l.id === saveLogId);
                                    if (log) setLinkedLogTitle(log.content.substring(0, 30));
                                }
                                handleSaveToArchive(saveLogId || undefined, saveLogId ? (projects.find(p => p.id === (selectedProjectId || projects[0]?.id))?.milestones.find(m => m.id === saveMilestoneId)?.logs.find(l => l.id === saveLogId)?.content.substring(0, 30)) : undefined);
                                setShowSaveArchiveModal(false);
                                setSaveMilestoneId('');
                                setSaveLogId('');
                            }} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl">保存</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Modals ═══ */}
            {showLinkModal && (
                <VisionLinkLogModal
                    onClose={() => setShowLinkModal(false)}
                    projects={projects}
                    initialProjectId={linkedProjectId}
                    initialMilestoneId={linkedMilestoneId}
                    initialLogId={linkedLogId}
                    onConfirm={(pId, mId, lId, lTitle) => {
                        setLinkedProjectId(pId || undefined);
                        setLinkedMilestoneId(mId || undefined);
                        setLinkedLogId(lId || undefined);
                        setLinkedLogTitle(lTitle || undefined);
                        setShowLinkModal(false);
                        if (lId) {
                            showToast?.({ message: `已关联: ${lTitle}`, type: 'success' });
                        } else {
                            showToast?.({ message: '已解除关联', type: 'info' });
                        }
                    }}
                />
            )}
            {showSyncModal && (
                <VisionSyncModal
                    onClose={() => setShowSyncModal(false)}
                    projects={projects}
                    onConfirm={(pId, mId, lId, report, title, saveToArchive) => {
                        handleSyncConfirm(pId, mId, lId, report, title, saveToArchive);
                    }}
                    analysisMode={mode}
                    aiReport={aiReport}
                    showToast={showToast}
                />
            )}
        </div>
    );
};

export default VisionAnalysisPanel;
