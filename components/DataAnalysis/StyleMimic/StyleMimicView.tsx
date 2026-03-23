
import React, { useState, useRef } from 'react';
import { useProjectContext } from '../../../context/ProjectContext';
import { extractChartStyleFromImage } from '../../../services/gemini/analysis';
import { ChartDataPoint, DataSeries } from '../../../types';
import DataChart from '../DataChart';
import { ChartTemplate } from '../../../hooks/useDataAnalysisLogic';

interface MimicState {
    targetImage: string | null;
    rawData: DataSeries[];
    extractedStyle: any | null;
    isProcessing: boolean;
    activeChartType: 'line' | 'bar' | 'scatter';
    overlayOpacity: number;
}

interface StyleMimicViewProps {
    onTransferToEditor?: (config: {
        chartType: 'line' | 'bar' | 'scatter';
        mainColor: string;
        strokeWidth: number;
        pointShape: string;
        gridX: boolean;
        gridY: boolean;
        chartTitle: string;
        xLabel: string;
        yLabel: string;
        fontFamily: string;
        palette: string[];
        seriesData: DataSeries[];
    }) => void;
}

const StyleMimicView: React.FC<StyleMimicViewProps> = ({ onTransferToEditor }) => {
    const { showToast, setAiStatus } = useProjectContext();

    const [state, setState] = useState<MimicState>({
        targetImage: null,
        rawData: [],
        extractedStyle: null,
        isProcessing: false,
        activeChartType: 'line',
        overlayOpacity: 0.3
    });

    const [activeConfig, setActiveConfig] = useState({
        mainColor: '#4f46e5',
        palette: ['#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#6366f1'],
        strokeWidth: 3,
        pointShape: 'circle' as const,
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        gridX: false,
        gridY: true,
        chartTitle: 'Style Replication Result',
        xLabel: 'X-Axis',
        yLabel: 'Y-Axis'
    });

    const imgInputRef = useRef<HTMLInputElement>(null!);
    const dataInputRef = useRef<HTMLInputElement>(null!);
    const chartContainerRef = useRef<HTMLDivElement>(null!);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result as string;
                setState(prev => ({ ...prev, targetImage: dataUrl }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDataUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        let parsedData: ChartDataPoint[] = [];

        // 自动检测分隔符
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        const detectSeparator = (line: string) => {
            if (line.includes('\t')) return /\t+/;
            if (line.includes(';')) return /;+/;
            if (line.includes(',')) return /,+/;
            return /\s+/;
        };

        // 从非注释行中检测分隔符
        const firstDataLine = lines.find(l => !l.startsWith('#') && !l.startsWith('//') && !l.startsWith('%'));
        const sep = detectSeparator(firstDataLine || lines[0]);

        for (const raw of lines) {
            const trimmed = raw.trim();
            // 跳过注释行、空行
            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('%') || trimmed.startsWith('*')) continue;

            const cols = trimmed.split(sep).map(c => c.trim()).filter(c => c.length > 0);
            if (cols.length < 2) continue;

            // 智能查找前两个可解析为数字的列
            let xVal: number | null = null;
            let yVal: number | null = null;
            let errorVal = 0;
            for (const col of cols) {
                const num = parseFloat(col);
                if (!isNaN(num)) {
                    if (xVal === null) { xVal = num; }
                    else if (yVal === null) { yVal = num; }
                    else { errorVal = num; break; }
                }
            }

            if (xVal !== null && yVal !== null) {
                parsedData.push({ name: String(xVal), value: yVal, error: errorVal });
            }
        }

        // 降采样：超过 2000 点时等间距采样，避免大数据量卡顿
        const MAX_POINTS = 2000;
        if (parsedData.length > MAX_POINTS) {
            const step = parsedData.length / MAX_POINTS;
            const sampled: ChartDataPoint[] = [];
            for (let i = 0; i < MAX_POINTS; i++) {
                sampled.push(parsedData[Math.floor(i * step)]);
            }
            // 确保最后一个点被保留
            sampled[sampled.length - 1] = parsedData[parsedData.length - 1];
            const skipped = parsedData.length - MAX_POINTS;
            parsedData = sampled;
            showToast({ message: `数据量过大，已智能降采样至 ${MAX_POINTS} 点（跳过 ${skipped} 点）`, type: 'info' });
        }

        if (parsedData.length > 0) {
            updateDataSeries(parsedData);
            showToast({ message: `成功导入 ${parsedData.length} 组数据点`, type: 'success' });
        } else {
            showToast({ message: '未检测到有效数据。请确保文件包含至少两列数字数据。', type: 'error' });
        }
    };

    const updateDataSeries = (data: ChartDataPoint[]) => {
        setState(prev => ({
            ...prev,
            rawData: [{
                id: 'mimic_data',
                name: 'Replicated Series',
                data: data,
                color: activeConfig.mainColor,
                strokeWidth: activeConfig.strokeWidth,
                visible: true,
                pointShape: activeConfig.pointShape,
                pointColor: activeConfig.mainColor,
                pointSize: 5
            }]
        }));
    };

    const handleGenerateMockData = () => {
        const mockData: ChartDataPoint[] = [];
        const count = 50;
        for (let i = 0; i <= count; i++) {
            const x = i;
            let y = 0;
            if (state.activeChartType === 'bar') {
                y = Math.abs(Math.sin(i * 0.2)) * 80 + 10 + Math.random() * 10;
            } else {
                y = Math.sin(i * 0.15) * 40 + 50 + (Math.random() * 5);
            }
            mockData.push({ name: String(x), value: parseFloat(y.toFixed(2)) });
        }
        updateDataSeries(mockData);
        showToast({ message: '已生成模拟预览数据', type: 'info' });
    };

    const runAnalysis = async () => {
        if (!state.targetImage) return;

        setState(prev => ({ ...prev, isProcessing: true }));
        if (setAiStatus) setAiStatus('🎨 正在提取视觉 DNA 与 OCR 文字信息...');

        try {
            const styleConfig = await extractChartStyleFromImage(state.targetImage);
            if (styleConfig) {
                setState(prev => ({ ...prev, extractedStyle: styleConfig }));

                const extractedColors = styleConfig.colors || styleConfig.palette;
                const newPalette = extractedColors && extractedColors.length > 0
                    ? extractedColors
                    : ['#4f46e5', '#10b981', '#f59e0b', '#f43f5e', '#6366f1'];

                setActiveConfig(prev => ({
                    ...prev,
                    mainColor: newPalette[0],
                    palette: newPalette,
                    strokeWidth: styleConfig.strokeWidth || prev.strokeWidth,
                    pointShape: (styleConfig.pointShape as any) || prev.pointShape,
                    fontFamily: styleConfig.fontFamily === 'serif' ? '"Times New Roman", Times, serif' : 'Arial, sans-serif',
                    gridX: !!styleConfig.hasGrid,
                    gridY: !!styleConfig.hasGrid,
                    chartTitle: styleConfig.title || prev.chartTitle,
                    xLabel: styleConfig.xLabel || prev.xLabel,
                    yLabel: styleConfig.yLabel || prev.yLabel
                }));

                if (styleConfig.chartType) {
                    setState(s => ({ ...s, activeChartType: styleConfig.chartType as any }));
                }

                if (state.rawData.length > 0) {
                    setState(prev => ({
                        ...prev,
                        rawData: prev.rawData.map(s => ({
                            ...s,
                            color: newPalette[0],
                            pointColor: newPalette[0],
                            pointShape: (styleConfig.pointShape as any) || s.pointShape,
                            strokeWidth: styleConfig.strokeWidth || s.strokeWidth
                        }))
                    }));
                } else {
                    handleGenerateMockData();
                }

                showToast({ message: '视觉风格与文字信息提取成功！', type: 'success' });
            }
        } catch (e) {
            console.error(e);
            showToast({ message: '提取失败，请重试', type: 'error' });
        } finally {
            setState(prev => ({ ...prev, isProcessing: false }));
            if (setAiStatus) setAiStatus(null);
        }
    };

    const handleSaveTemplate = () => {
        const template: ChartTemplate = {
            id: Date.now().toString(),
            name: `Mimic Style ${new Date().toLocaleDateString()}`,
            type: state.activeChartType,
            color: activeConfig.mainColor,
            stroke: activeConfig.strokeWidth,
            font: activeConfig.fontSize,
            xLabel: activeConfig.xLabel,
            yLabel: activeConfig.yLabel,
            description: 'AI Generated Template',
            pointShape: activeConfig.pointShape
        };

        const saved = localStorage.getItem('sciflow_user_chart_tpls');
        const currentList = saved ? JSON.parse(saved) : [];
        localStorage.setItem('sciflow_user_chart_tpls', JSON.stringify([...currentList, template]));

        showToast({ message: '样式已保存至模板库', type: 'success' });
    };

    const handleColorSelect = (color: string) => {
        setActiveConfig(prev => ({ ...prev, mainColor: color }));
        setState(prev => ({
            ...prev,
            rawData: prev.rawData.map(s => ({ ...s, color: color, pointColor: color }))
        }));
    };

    return (
        <div className="flex-1 h-full flex flex-col gap-6 overflow-hidden min-h-0 relative">
            <div className="flex-1 grid grid-cols-12 gap-8 min-h-0 pb-4">
                <div className="col-span-3 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
                    <div className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm relative group overflow-hidden">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">参考图源 (REFERENCE)</h4>
                        <div
                            onClick={() => imgInputRef.current?.click()}
                            className={`aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden ${state.targetImage ? 'border-pink-200 bg-pink-50/10' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-pink-300'}`}
                        >
                            {state.targetImage ? (
                                <>
                                    <img src={state.targetImage} className="w-full h-full object-contain rounded-xl z-10 relative" />
                                    {state.isProcessing && (
                                        <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-b from-transparent via-pink-400/30 to-transparent w-full h-[20%] animate-[scan_2s_linear_infinite]"></div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center text-slate-400">
                                    <i className="fa-solid fa-image text-2xl mb-2"></i>
                                    <p className="text-[9px] font-bold uppercase">Upload Image</p>
                                </div>
                            )}
                            <input type="file" ref={imgInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">数据源 (SOURCE DATA)</h4>
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={handleGenerateMockData}
                                className="w-full py-3 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600 text-[9px] font-bold hover:bg-indigo-100 transition-all"
                            >
                                <i className="fa-solid fa-dice mr-1"></i> 使用随机模拟数据预览
                            </button>
                            <div
                                onClick={() => dataInputRef.current?.click()}
                                className="py-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-indigo-300 transition-all cursor-pointer text-center"
                            >
                                <i className="fa-solid fa-database text-indigo-400 mb-1"></i>
                                <p className="text-[9px] font-bold text-slate-500 uppercase">{state.rawData.length > 0 ? '已加载数据 (Ready)' : 'Upload CSV / TSV'}</p>
                                <input type="file" data-input="true" ref={dataInputRef} className="hidden" accept=".csv,.tsv,.txt" onChange={handleDataUpload} />
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={runAnalysis}
                        disabled={!state.targetImage || state.isProcessing}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-pink-600 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {state.isProcessing ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-dna"></i>}
                        启动 AI 逆向解析
                    </button>
                </div>

                <div className="col-span-3 bg-white/80 backdrop-blur-md rounded-[2.5rem] border border-slate-200 p-6 flex flex-col shadow-sm gap-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-sliders text-pink-500"></i> 视觉 DNA 控制台
                    </h4>

                    <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase mb-2 block">提取色板 (Palette)</label>
                        <div className="grid grid-cols-5 gap-2 mb-3">
                            {activeConfig.palette.map((color: string, idx: number) => (
                                <button
                                    key={idx}
                                    onClick={() => handleColorSelect(color)}
                                    className={`w-8 h-8 rounded-lg shadow-sm border-2 transition-all hover:scale-110 ${activeConfig.mainColor === color ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                ></button>
                            ))}
                        </div>
                        <input type="color" className="w-full h-8 bg-slate-50 rounded-lg cursor-pointer p-0.5 border border-slate-200" value={activeConfig.mainColor} onChange={e => handleColorSelect(e.target.value)} />
                    </div>

                    <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase mb-2 block">线条粗细: {activeConfig.strokeWidth}px</label>
                        <input type="range" min="0.5" max="8" step="0.5" className="w-full accent-pink-500 h-1.5 bg-slate-100 rounded-lg cursor-pointer" value={activeConfig.strokeWidth} onChange={e => setActiveConfig({ ...activeConfig, strokeWidth: parseFloat(e.target.value) })} />
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-2">OCR 识别结果</p>
                        <div className="space-y-2">
                            <input className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] font-bold text-slate-700 outline-none" value={activeConfig.chartTitle} onChange={e => setActiveConfig({ ...activeConfig, chartTitle: e.target.value })} placeholder="Title" />
                            <div className="flex gap-2">
                                <input className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] font-bold text-slate-700 outline-none" value={activeConfig.xLabel} onChange={e => setActiveConfig({ ...activeConfig, xLabel: e.target.value })} placeholder="X Axis" />
                                <input className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[9px] font-bold text-slate-700 outline-none" value={activeConfig.yLabel} onChange={e => setActiveConfig({ ...activeConfig, yLabel: e.target.value })} placeholder="Y Axis" />
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto flex flex-col gap-2">
                        <button
                            onClick={() => onTransferToEditor?.({
                                chartType: state.activeChartType,
                                mainColor: activeConfig.mainColor,
                                strokeWidth: activeConfig.strokeWidth,
                                pointShape: activeConfig.pointShape,
                                gridX: activeConfig.gridX,
                                gridY: activeConfig.gridY,
                                chartTitle: activeConfig.chartTitle,
                                xLabel: activeConfig.xLabel,
                                yLabel: activeConfig.yLabel,
                                fontFamily: activeConfig.fontFamily,
                                palette: activeConfig.palette,
                                seriesData: state.rawData
                            })}
                            disabled={!onTransferToEditor || (!state.extractedStyle && state.rawData.length === 0)}
                            className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <i className="fa-solid fa-arrow-right-to-bracket"></i> 传入图表编辑器
                        </button>
                        <button onClick={handleSaveTemplate} className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-pink-50 hover:text-pink-600 hover:border-pink-200 transition-all shadow-sm">
                            <i className="fa-solid fa-floppy-disk mr-2"></i> 保存为样式模板
                        </button>
                    </div>
                </div>

                <div className="col-span-6 bg-slate-100 rounded-[2.5rem] border border-slate-200 p-2 flex flex-col relative overflow-hidden shadow-inner">
                    {state.targetImage && (
                        <div className="absolute top-4 left-4 z-20 flex items-center bg-white/90 backdrop-blur rounded-xl p-2 border border-slate-200 shadow-sm gap-2">
                            <span className="text-[8px] font-bold text-slate-500 uppercase">原图叠底</span>
                            <input
                                type="range" min="0" max="1" step="0.1"
                                className="w-20 accent-pink-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                                value={state.overlayOpacity}
                                onChange={e => setState(s => ({ ...s, overlayOpacity: parseFloat(e.target.value) }))}
                            />
                        </div>
                    )}

                    <div className="flex-1 bg-white rounded-[2rem] shadow-2xl m-4 flex flex-col overflow-hidden relative" ref={chartContainerRef}>
                        {state.targetImage && (
                            <div className="absolute inset-0 pointer-events-none z-10 bg-no-repeat bg-center bg-contain" style={{ backgroundImage: `url(${state.targetImage})`, opacity: state.overlayOpacity }}></div>
                        )}

                        {state.rawData.length > 0 ? (
                            <DataChart
                                chartContainerRef={chartContainerRef}
                                seriesList={state.rawData.map(s => ({
                                    ...s,
                                    color: activeConfig.mainColor,
                                    strokeWidth: activeConfig.strokeWidth,
                                    pointShape: activeConfig.pointShape,
                                    pointColor: activeConfig.mainColor
                                }))}
                                chartType={state.activeChartType}
                                mainColor={activeConfig.mainColor}
                                strokeWidth={activeConfig.strokeWidth}
                                fontSize={activeConfig.fontSize}
                                axisLabelFontSize={20}
                                pointShape={activeConfig.pointShape}
                                pointSize={6}
                                xAxisLabel={activeConfig.xLabel}
                                setXAxisLabel={(v) => setActiveConfig({ ...activeConfig, xLabel: v })}
                                yAxisLabel={activeConfig.yLabel}
                                setYAxisLabel={(v) => setActiveConfig({ ...activeConfig, yLabel: v })}
                                chartTitle={activeConfig.chartTitle}
                                setChartTitle={(v) => setActiveConfig({ ...activeConfig, chartTitle: v })}
                                annotations={[]}
                                activeTool="none"
                                onAddAnnotation={() => { }}
                                onUpdateAnnotation={() => { }}
                                onRemoveAnnotation={() => { }}
                                onSetActiveTool={() => { }}
                                legendPos={{ x: 80, y: 40 }}
                                setLegendPos={() => { }}
                                editingSeriesId={null}
                                setEditingSeriesId={() => { }}
                                updateSeries={() => { }}
                                aspectRatio={1.5}
                                xLabelPos={{ x: 0, y: 0 }}
                                setXLabelPos={() => { }}
                                yLabelPos={{ x: 0, y: 0 }}
                                setYLabelPos={() => { }}
                                titlePos={{ x: 0, y: 0 }}
                                setTitlePos={() => { }}
                                xDomain={['auto', 'auto']}
                                yDomain={['auto', 'auto']}
                                gridX={activeConfig.gridX}
                                gridY={activeConfig.gridY}
                                axisLineWidth={2}
                                axisColor="#334155"
                                tickFontSize={10}
                                tickSize={6}
                                tickWidth={1.5}
                                xTickCount={5}
                                yTickCount={5}
                                xAxisDivision={1}
                                yAxisDivision={1}
                                labelFontFamily={activeConfig.fontFamily}
                                labelFontWeight="bold"
                                labelFontStyle="normal"
                                titleFontFamily={activeConfig.fontFamily}
                                titleFontWeight="black"
                                titleFontStyle="italic"
                                tickFontFamily="Arial"
                                tickFontWeight="bold"
                                tickFontStyle="normal"
                                legendFontFamily="Arial"
                                legendFontWeight="bold"
                                legendFontStyle="normal"
                                legendFontSize={12}
                                legendBorderVisible={true}
                                legendBorderColor="#e2e8f0"
                                legendBorderWidth={1}
                                showXTicks={true}
                                showYTicks={true}
                            />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center opacity-30 gap-4">
                                <i className="fa-solid fa-chart-area text-6xl text-slate-300"></i>
                                <p className="text-sm font-black uppercase tracking-[0.4rem]">等待数据加载</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StyleMimicView;
