
import React, { useRef } from 'react';
import ReactDOM from 'react-dom';
import * as htmlToImage from 'html-to-image';
import { ResearchProject } from '../../types';
import { useElectroLogic } from './Electro/useElectroLogic';
import { ElectroHeader } from './Electro/ElectroHeader';
import { ElectroInputPanel } from './Electro/ElectroInputPanel';
import { ElectroResultPanel } from './Electro/ElectroResultPanel';
import { ElectroChartPanel } from './Electro/ElectroChartPanel';
import ChartConfigPanel from '../DataAnalysis/ChartConfigPanel';
import AxisSettingsPanel from '../DataAnalysis/AxisSettingsPanel';
import SeriesSettingsPanel from '../DataAnalysis/SeriesSettingsPanel';
import { printElement } from '../../utils/printUtility';
import { useProjectContext } from '../../context/ProjectContext';
import { BifunctionalExpertPanel } from './Electro/BifunctionalExpertPanel';
import TemplateGalleryModal from '../DataAnalysis/Modals/TemplateGalleryModal';
import { ChartTemplate } from '../../hooks/useDataAnalysisLogic';
import FolderLibraryView from '../Characterization/FolderLibraryView';
import AnalysisSyncModal, { flattenMilestonesTree, getAutoSelections } from '../Characterization/AnalysisSyncModal';

interface ElectrochemicalEngineProps {
    show: boolean;
    onClose: () => void;
    projects: ResearchProject[];
    onSave: (projectId: string, milestoneId: string, logId: string, data: any) => void;
    defaultProjectId?: string;
    defaultMilestoneId?: string;
    traceRecordId?: string | null;
    isEmbedded?: boolean;
}

const ElectrochemicalEngine: React.FC<ElectrochemicalEngineProps> = ({ show, onClose, projects, onSave, defaultProjectId, defaultMilestoneId, traceRecordId, isEmbedded = false }) => {
    const { showToast } = useProjectContext();
    const logic = useElectroLogic({ projects, onSave, defaultProjectId, defaultMilestoneId, traceRecordId, show });
    const [showBifunctionalExpert, setShowBifunctionalExpert] = React.useState(false);
    const [showGalleryModal, setShowGalleryModal] = React.useState(false);
    const [showSyncModal, setShowSyncModal] = React.useState(false);
    const [showSyncToLogModal, setShowSyncToLogModal] = React.useState(false);
    const reportRef = useRef<HTMLDivElement>(null);
    const chartCaptureRef = useRef<HTMLDivElement>(null);

    // 保存方案弹窗打开时自动选中最新记录
    React.useEffect(() => {
        if (logic.showSaveModal) {
            const a = getAutoSelections(projects, logic.targetProjectId || defaultProjectId);
            if (!logic.saveMilestoneId) logic.setSaveMilestoneId(a.milestoneId);
            if (!logic.saveLogId) logic.setSaveLogId(a.logId);
        }
    }, [logic.showSaveModal]);

    // 入库同步弹窗打开时自动选中最新记录
    React.useEffect(() => {
        if (showSyncToLogModal) {
            const a = getAutoSelections(projects, logic.targetProjectId || defaultProjectId);
            logic.setTargetProjectId(a.projectId);
            logic.setTargetMilestoneId(a.milestoneId);
            logic.setTargetLogId(a.logId || 'NEW_LOG');
        }
    }, [showSyncToLogModal]);

    // 加载用户模板
    const userTemplates = React.useMemo<ChartTemplate[]>(() => {
        try {
            const stored = localStorage.getItem('sciflow_user_chart_tpls');
            return stored ? JSON.parse(stored) : [];
        } catch { return []; }
    }, [showGalleryModal]);

    const handleExportPDF = async () => {
        if (!reportRef.current) return;
        showToast({ message: '正在构建矢量级动力学解析报告...', type: 'info' });
        // Fix: Corrected variable name from reportAreaRef to reportRef
        await printElement(reportRef.current, `Kinetics_Analysis_${logic.activeMode}`);
    };

    const captureChartThumbnail = React.useCallback(async (): Promise<string | undefined> => {
        if (!chartCaptureRef.current) return undefined;
        try {
            const fullChartEl = chartCaptureRef.current.querySelector('.lab-chart-responsive');
            const captureTarget = (fullChartEl || chartCaptureRef.current) as unknown as HTMLElement;
            const rect = captureTarget.getBoundingClientRect();
            return await htmlToImage.toPng(captureTarget, {
                cacheBust: true,
                width: Math.max(320, Math.round(rect.width)),
                height: Math.max(180, Math.round(rect.height)),
                pixelRatio: 3,
                backgroundColor: '#ffffff'
            });
        } catch {
            return undefined;
        }
    }, []);

    const handleSyncConfirm = (targetProjectId: string, targetMilestoneId: string, targetLogId: string) => {
        if (!logic.currentRecordId) return;
        const project = projects.find(p => p.id === targetProjectId);
        if (!project) return;

        const currentRecord = logic.savedRecords.find((r: any) => r.id === logic.currentRecordId);
        const title = currentRecord ? currentRecord.title : `电化学分析 ${new Date().toLocaleDateString()}`;

        const updatedMilestones = project.milestones.map(m => {
            if (m.id === targetMilestoneId) {
                const updatedLogs = m.logs.map(l => {
                    if (l.id === targetLogId) {
                        return {
                            ...l,
                            linkedAnalysis: {
                                id: logic.currentRecordId!,
                                type: 'electro' as const,
                                title: title
                            }
                        };
                    }
                    return l;
                });
                return { ...m, logs: updatedLogs };
            }
            return m;
        });

        onSave(targetProjectId, targetMilestoneId, targetLogId, { linkedOnly: true });
        setShowSyncModal(false);
        showToast({ message: '已创建溯源链接至实验记录', type: 'success' });
    };

    if (!show && !isEmbedded) return <div className="hidden" />;

    const chartDomains = {
        x: logic.domains.x,
        y: logic.domains.y
    };

    const currentSeries = logic.seriesList.find(s => s.id === logic.seriesSettingsId) || logic.seriesList[0];

    const containerClasses = isEmbedded
        ? "h-full flex flex-col p-4 lg:p-6 gap-4 animate-reveal overflow-hidden relative"
        : "eco-analysis-overlay fixed inset-0 bg-[#fdfdfd] z-[3000] flex flex-col p-4 lg:p-10 animate-reveal overflow-hidden";

    const wrapperClasses = isEmbedded
        ? "flex flex-col h-full w-full"
        : "relative z-10 flex flex-col h-full w-full max-w-[1600px] mx-auto";

    return (
        <div className={containerClasses}>
            <style>{`
        .eco-analysis-btn-active { background: #6366f1; color: white; shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.3); }
        .eco-analysis-grid-bg { background-image: radial-gradient(circle at 1.5px 1.5px, #f1f5f9 1.5px, transparent 0); background-size: 40px 40px; }
      `}</style>

            <ElectroHeader
                activeMode={logic.activeMode}
                setActiveMode={logic.setActiveMode}
                onClose={onClose}
                setAnalysisResult={logic.setAnalysisResult}
                setAiConclusion={logic.setAiConclusion}
                isEmbedded={isEmbedded}
                onOpenBifunctionalExpert={() => setShowBifunctionalExpert(true)}
                isExpertModeActive={showBifunctionalExpert}
                onClearWorkspace={logic.handleClearWorkspace}
                showLibrary={logic.showLibrary}
                onToggleLibrary={() => logic.setShowLibrary(!logic.showLibrary)}
                recordCount={logic.savedRecords.length}
                analysisResult={logic.analysisResult}
                saveStep={logic.saveStep}
                setSaveStep={(step: any) => logic.setSaveStep(step)}
                setShowSaveModal={logic.setShowSaveModal}
                currentRecordId={logic.currentRecordId}
                handleQuickSave={logic.handleQuickSave}
                handleSaveAs={logic.handleSaveAs}
                onSyncToLog={() => setShowSyncToLogModal(true)}
            />

            <div className="flex-1 grid grid-cols-12 gap-6 min-h-0 overflow-hidden px-1">
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-5 overflow-y-auto custom-scrollbar pr-3 min-h-0 pb-12 max-h-full">
                    {!logic.isEditMode ? (
                        <div className="flex flex-col gap-5 animate-reveal">
                            <ElectroInputPanel
                                saveStep={logic.saveStep} setSaveStep={logic.setSaveStep}
                                activeMode={logic.activeMode} rawData={logic.rawData} setRawData={logic.setRawData}
                                isAnalysing={logic.isAnalysing} handleRunAnalysis={logic.handleRunAnalysis}
                                handleFileUpload={logic.handleFileUpload} handleExport={() => { }}
                                handleSaveToLog={async () => {
                                    const thumbnailUrl = await captureChartThumbnail();
                                    logic.handleSaveToLog(thumbnailUrl);
                                }} fileInputRef={logic.fileInputRef}
                                projects={projects}
                                targetProjectId={logic.targetProjectId} setTargetProjectId={logic.setTargetProjectId}
                                targetMilestoneId={logic.targetMilestoneId} setTargetMilestoneId={logic.setTargetMilestoneId}
                                targetLogId={logic.targetLogId} setTargetLogId={logic.setTargetLogId}
                                pushToMatrix={logic.pushToMatrix} setPushToMatrix={logic.setPushToMatrix}
                                selectedMatrixId={logic.selectedMatrixId} setSelectedMatrixId={logic.setSelectedMatrixId}
                                matrixSampleId={logic.matrixSampleId} setMatrixSampleId={logic.setMatrixSampleId}
                                matrixNote={logic.matrixNote} setMatrixNote={logic.setMatrixNote}
                                matrixParams={logic.matrixParams} setMatrixParams={logic.setMatrixParams}
                                matrixResults={logic.matrixResults} setMatrixResults={logic.setMatrixResults}
                                selectedProject={logic.selectedProject} selectedMilestone={logic.selectedMilestone}
                                qcReport={logic.qcReport}
                                electroParams={logic.electroParams}
                                setElectroParams={logic.setElectroParams}
                                tafelFitRange={logic.tafelFitRange}
                                setTafelFitRange={logic.setTafelFitRange}
                                tafelFitMode={logic.tafelFitMode}
                                setTafelFitMode={logic.setTafelFitMode}
                                handleLoadFullFeatureDemo={logic.handleLoadFullFeatureDemo}
                            />

                            {logic.analysisResult && (
                                <ElectroResultPanel
                                    activeMode={logic.activeMode}
                                    analysisResult={logic.analysisResult}
                                    aiConclusion={logic.aiConclusion}
                                    aiDeepAnalysis={logic.aiDeepAnalysis}
                                    isDeepAnalysing={logic.isDeepAnalysing}
                                    setSaveStep={(step: any) => logic.setSaveStep(step)}
                                    handleExport={() => { }}
                                    onExportPDF={handleExportPDF}
                                    saveStep={logic.saveStep}
                                    sensitivityGrid={logic.sensitivityGrid}
                                    savedRecords={logic.savedRecords}
                                    showLibrary={logic.showLibrary}
                                    setShowLibrary={logic.setShowLibrary}
                                    showSaveModal={logic.showSaveModal}
                                    setShowSaveModal={logic.setShowSaveModal}
                                    saveTitle={logic.saveTitle}
                                    setSaveTitle={logic.setSaveTitle}
                                    currentRecordId={logic.currentRecordId}
                                    handleSaveRecord={logic.handleSaveRecord}
                                    handleLoadRecord={logic.handleLoadRecord}
                                    handleDeleteRecord={logic.handleDeleteRecord}
                                    compareSampleIds={logic.compareSampleIds}
                                    toggleCompareSample={logic.toggleCompareSample}
                                    compareSamples={logic.compareSamples}
                                    saveMilestoneId={logic.saveMilestoneId}
                                    setSaveMilestoneId={logic.setSaveMilestoneId}
                                    saveLogId={logic.saveLogId}
                                    setSaveLogId={logic.setSaveLogId}
                                    projects={projects}
                                    selectedProjectId={logic.targetProjectId || defaultProjectId || ''}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="animate-reveal h-full flex flex-col min-h-0">
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {logic.leftPanelMode === 'basic' ? (
                                    <ChartConfigPanel
                                        fileInputRef={logic.fileInputRef} handleFileUpload={logic.handleFileUpload}
                                        seriesList={logic.seriesList} updateSeries={() => { }} removeSeries={() => { }}
                                        setSeriesSettingsId={logic.setSeriesSettingsId}
                                        titleInputRef={null as any} chartTitle={logic.chartTitle} setChartTitle={logic.setChartTitle}
                                        chartType={logic.chartType} setChartType={logic.setChartType}
                                        mainColor={logic.mainColor} setMainColor={logic.setMainColor}
                                        strokeWidth={logic.strokeWidth} setStrokeWidth={logic.setStrokeWidth}
                                        fontSize={logic.fontSize} setFontSize={logic.setFontSize}
                                        pointShape={logic.pointShape} setPointShape={logic.setPointShape}
                                        pointSize={logic.pointSize} setPointSize={logic.setPointSize}
                                        xLabelInputRef={null as any} xAxisLabel={logic.xAxisLabel} setXAxisLabel={logic.setXAxisLabel}
                                        yLabelInputRef={null as any} yAxisLabel={logic.yAxisLabel} setYAxisLabel={logic.setYAxisLabel}
                                        activeScientificTheme={null} applyScientificTheme={() => { }}
                                        onOpenSaveTemplate={() => { }}
                                        onOpenAxisConfig={() => logic.setLeftPanelMode('axis')}
                                        aspectRatio={logic.aspectRatio} setAspectRatio={logic.setAspectRatio}
                                        activeTool={logic.activeTool} onSetActiveTool={logic.setActiveTool}
                                        showTemplateList={logic.showTemplateList} setShowTemplateList={logic.setShowTemplateList}
                                        userTemplates={userTemplates}
                                        templateSearchQuery="" setTemplateSearchQuery={() => { }} handleDiscoverTemplate={() => { }} isDiscoveringTemplate={false} onOpenGallery={() => setShowGalleryModal(true)}
                                    />
                                ) : logic.leftPanelMode === 'axis' ? (
                                    <AxisSettingsPanel
                                        onClose={() => logic.setLeftPanelMode('basic')}
                                        onSwitchToSeries={() => {
                                            if (logic.seriesList.length > 0) {
                                                logic.setSeriesSettingsId(logic.seriesList[0].id);
                                            }
                                        }}
                                        xDomain={logic.xDomain} setXDomain={logic.setXDomain}
                                        yDomain={logic.yDomain} setYDomain={logic.setYDomain}
                                        xScale={logic.xScale} setXScale={logic.setXScale}
                                        yScale={logic.yScale} setYScale={logic.setYScale}
                                        gridX={logic.gridX} setGridX={logic.setGridX}
                                        gridY={logic.gridY} setGridY={logic.setGridY}
                                        gridLineWidth={logic.gridLineWidth} setGridLineWidth={logic.setGridLineWidth}
                                        axisLineWidth={logic.axisLineWidth} setAxisLineWidth={logic.setAxisLineWidth}
                                        axisColor={logic.axisColor} setAxisColor={logic.setAxisColor}
                                        pointColor={logic.pointColor} setPointColor={logic.setPointColor}
                                        axisBox={logic.axisBox} setAxisBox={logic.setAxisBox}
                                        tickFontSize={logic.tickFontSize} setTickFontSize={logic.setTickFontSize}
                                        tickSize={logic.tickSize} setTickSize={logic.setTickSize}
                                        tickWidth={logic.tickWidth} setTickWidth={logic.setTickWidth}
                                        axisLabelFontSize={logic.axisLabelFontSize} setAxisLabelFontSize={logic.setAxisLabelFontSize}
                                        xTickCount={logic.xTickCount} setXTickCount={logic.setXTickCount}
                                        yTickCount={logic.yTickCount} setYTickCount={logic.setYTickCount}
                                        xAxisDivision={logic.xAxisDivision} setXAxisDivision={logic.setXAxisDivision}
                                        yAxisDivision={logic.yAxisDivision} setYAxisDivision={logic.setYAxisDivision}
                                        computedAutoDomains={logic.domains as any}

                                        labelFontFamily={logic.labelFontFamily} setLabelFontFamily={logic.setLabelFontFamily}
                                        labelFontWeight={logic.labelFontWeight} setLabelFontWeight={logic.setLabelFontWeight}
                                        labelFontStyle={logic.labelFontStyle} setLabelFontStyle={logic.setLabelFontStyle}
                                        titleFontFamily={logic.titleFontFamily} setTitleFontFamily={logic.setTitleFontFamily}
                                        titleFontWeight={logic.titleFontWeight} setTitleFontWeight={logic.setTitleFontWeight}
                                        titleFontStyle={logic.titleFontStyle} setTitleFontStyle={logic.setTitleFontStyle}
                                        tickFontFamily={logic.tickFontFamily} setTickFontFamily={logic.setTickFontFamily}
                                        tickFontWeight={logic.tickFontWeight} setTickFontWeight={logic.setTickFontWeight}
                                        tickFontStyle={logic.tickFontStyle} setTickFontStyle={logic.setTickFontStyle}
                                        legendFontFamily={logic.legendFontFamily} setLegendFontFamily={logic.setLegendFontFamily}
                                        legendFontWeight={logic.legendFontWeight} setLegendFontWeight={logic.setLegendFontWeight}
                                        legendFontStyle={logic.legendFontStyle} setLegendFontStyle={logic.setLegendFontStyle}
                                        legendFontSize={logic.legendFontSize} setLegendFontSize={logic.setLegendFontSize}
                                        legendBorderVisible={logic.legendBorderVisible} setLegendBorderVisible={logic.setLegendBorderVisible}
                                        legendBorderColor={logic.legendBorderColor} setLegendBorderColor={logic.setLegendBorderColor}
                                        legendBorderWidth={logic.legendBorderWidth} setLegendBorderWidth={logic.setLegendBorderWidth}
                                        showXTicks={logic.showXTicks} setShowXTicks={logic.setShowXTicks}
                                        showYTicks={logic.showYTicks} setShowYTicks={logic.setShowYTicks}
                                        autoFitDomains={logic.autoFitDomains}
                                        showMirroredTicks={logic.showMirroredTicks} setShowMirroredTicks={logic.setShowMirroredTicks}
                                        activeFontTab={logic.activeFontTab} setActiveFontTab={logic.setActiveFontTab}
                                        documentColors={[logic.mainColor]}
                                    />
                                ) : (
                                    <SeriesSettingsPanel
                                        series={currentSeries}
                                        seriesList={logic.seriesList}
                                        chartType={logic.chartType}
                                        onClose={() => logic.setLeftPanelMode('basic')}
                                        onSwitchToAxis={() => logic.setLeftPanelMode('axis')}
                                        onSelectSeries={(id) => logic.setSeriesSettingsId(id)}
                                        onApplyPalette={(colors) => logic.updateSeriesStyle(currentSeries.id, { color: colors[0], pointColor: colors[0] }, true)}
                                        onUpdate={(updates, applyToAll) => {
                                            logic.updateSeriesStyle(currentSeries.id, updates, applyToAll);
                                        }}
                                    />
                                )}
                            </div>
                            <button onClick={() => logic.setIsEditMode(false)} className="w-full mt-4 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-600 transition-all shrink-0">退出编辑模式</button>
                        </div>
                    )}
                </div>

                <div ref={reportRef} className="col-span-12 lg:col-span-8 flex flex-col h-full min-h-0 is-printing-target">
                    <ElectroChartPanel
                        {...logic}
                        captureRef={chartCaptureRef}
                        processedData={logic.processedData}
                        chartConfig={logic.chartConfig}
                        domains={chartDomains}
                        analysisResult={logic.analysisResult}
                        annotations={logic.annotations}
                        chartType={logic.chartType}
                    />
                </div>

                {showBifunctionalExpert && (
                    <BifunctionalExpertPanel
                        analysisResult={logic.analysisResult}
                        onClose={() => setShowBifunctionalExpert(false)}
                        savedRecords={logic.savedRecords}
                    />
                )}
            </div>

            {/* ═══ 关联课题弹窗 ═══ */}
            {showSyncModal && (
                <div className="fixed inset-0 z-[3100] flex items-center justify-center">
                    <AnalysisSyncModal
                        onClose={() => setShowSyncModal(false)}
                        projects={projects}
                        onConfirm={handleSyncConfirm}
                        initialProjectId={logic.targetProjectId || defaultProjectId}
                        title="关联课题记录"
                    />
                </div>
            )}

            {/* ═══ 方案库弹窗（顶层渲染） ═══ */}
            {logic.showLibrary && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative flex flex-col max-h-[80vh]">
                        <h3 className="text-xl font-black text-slate-800 mb-6 uppercase italic border-l-4 border-indigo-600 pl-4">动力学方案库</h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            <FolderLibraryView
                                records={logic.savedRecords}
                                onLoad={(record: any) => { logic.handleLoadRecord(record); logic.setShowLibrary(false); }}
                                onDelete={(id: string) => logic.handleDeleteRecord(id)}
                                emptyText="暂无保存的分析记录"
                            />
                        </div>
                        <button onClick={() => logic.setShowLibrary(false)} className="mt-6 w-full py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200">关闭</button>
                    </div>
                </div>
            )}

            {/* ═══ 保存方案弹窗（顶层渲染） ═══ */}
            {logic.showSaveModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white">
                        <h3 className="text-lg font-black text-slate-800 mb-6 uppercase italic pl-2">保存分析方案</h3>
                        <input
                            autoFocus
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:border-violet-400 mb-4"
                            placeholder="输入分析方案标题..."
                            value={logic.saveTitle}
                            onChange={e => logic.setSaveTitle(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') logic.handleSaveRecord(); }}
                        />
                        <div className="space-y-3 mb-6">
                            <p className="text-[9px] font-black text-slate-400 uppercase px-1">归档位置（可选）</p>
                            <div className="relative">
                                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-violet-300 transition-colors" value={logic.saveMilestoneId} onChange={e => { logic.setSaveMilestoneId(e.target.value); const ms = projects.find(p => p.id === (logic.targetProjectId || defaultProjectId))?.milestones.find(m => m.id === e.target.value); logic.setSaveLogId(ms?.logs?.[0]?.id || ''); }}>
                                    <option value="">选择实验节点...</option>
                                    {flattenMilestonesTree(projects.find(p => p.id === (logic.targetProjectId || defaultProjectId))?.milestones || []).map(({ milestone: m, depth, label }) => <option key={m.id} value={m.id}>{'　'.repeat(depth)}{label}  {m.title}</option>)}
                                </select>
                                <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                            </div>
                            {logic.saveMilestoneId && (
                                <div className="relative animate-reveal">
                                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-violet-300 transition-colors" value={logic.saveLogId} onChange={e => logic.setSaveLogId(e.target.value)}>
                                        <option value="">关联实验记录...</option>
                                        {(projects.find(p => p.id === (logic.targetProjectId || defaultProjectId))?.milestones.find(m => m.id === logic.saveMilestoneId)?.logs || []).map(l => <option key={l.id} value={l.id}>{l.content.substring(0, 30)}...</option>)}
                                    </select>
                                    <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => logic.setShowSaveModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">取消</button>
                            <button
                                onClick={logic.handleSaveRecord}
                                disabled={!logic.saveTitle.trim()}
                                className="flex-[2] py-3 bg-violet-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl hover:bg-black transition-all disabled:opacity-30"
                            >
                                {logic.currentRecordId ? '覆盖更新' : '保存新方案'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 入库同步浮窗 */}
            {showSyncToLogModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white/50">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner"><i className="fa-solid fa-floppy-disk"></i></div>
                            <div>
                                <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest">归档至项目流</h4>
                                <p className="text-[8px] text-slate-400 font-bold uppercase">Experimental Database Sync</p>
                            </div>
                        </div>
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block px-1">关联目标课题</label>
                                <div className="relative">
                                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors" value={logic.targetProjectId} onChange={e => { logic.setTargetProjectId(e.target.value); const a = getAutoSelections(projects, e.target.value); logic.setTargetMilestoneId(a.milestoneId); logic.setTargetLogId(a.logId || 'NEW_LOG'); }}>
                                        <option value="">点击选择课题...</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                    </select>
                                    <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                                </div>
                            </div>
                            {logic.targetProjectId && (
                                <div className="animate-reveal">
                                    <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block px-1">指定研究节点</label>
                                    <div className="relative">
                                        <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors" value={logic.targetMilestoneId} onChange={e => { logic.setTargetMilestoneId(e.target.value); const ms = projects.find(p => p.id === logic.targetProjectId)?.milestones.find(m => m.id === e.target.value); logic.setTargetLogId(ms?.logs?.[0]?.id || 'NEW_LOG'); }}>
                                            <option value="">点击选择节点...</option>
                                            {flattenMilestonesTree(projects.find(p => p.id === logic.targetProjectId)?.milestones || []).map(({ milestone: m, depth, label }) => <option key={m.id} value={m.id}>{'　'.repeat(depth)}{label}  {m.title}</option>)}
                                        </select>
                                        <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                                    </div>
                                </div>
                            )}
                            {logic.targetMilestoneId && (
                                <div className="animate-reveal">
                                    <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block px-1">追加至实验实录</label>
                                    <div className="relative">
                                        <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors" value={logic.targetLogId} onChange={e => logic.setTargetLogId(e.target.value)}>
                                            <option value="NEW_LOG">+ 创建新的分析记录</option>
                                            {(projects.find(p => p.id === logic.targetProjectId)?.milestones.find(m => m.id === logic.targetMilestoneId)?.logs || []).map(l => <option key={l.id} value={l.id}>{l.content.substring(0, 30)}...</option>)}
                                        </select>
                                        <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                                    </div>
                                </div>
                            )}

                            {/* 同步至性能矩阵 */}
                            <div className={`p-4 rounded-3xl border-2 transition-all ${logic.pushToMatrix ? 'bg-emerald-50 border-emerald-200 shadow-lg' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                <div className="flex justify-between items-center cursor-pointer" onClick={() => logic.setPushToMatrix(!logic.pushToMatrix)}>
                                    <div className="flex items-center gap-3">
                                        <i className={`fa-solid fa-table-cells ${logic.pushToMatrix ? 'text-emerald-600' : 'text-slate-400'}`}></i>
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${logic.pushToMatrix ? 'text-emerald-700' : 'text-slate-500'}`}>同步至性能矩阵</span>
                                    </div>
                                    <div className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-300 ${logic.pushToMatrix ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                        <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${logic.pushToMatrix ? 'translate-x-4' : ''}`}></div>
                                    </div>
                                </div>
                                {logic.pushToMatrix && (
                                    <div className="mt-4 pt-4 border-t border-emerald-200 animate-reveal space-y-3">
                                        <div>
                                            <label className="text-[8px] font-black text-emerald-600 uppercase mb-1.5 block px-1">样本标识 (Sample ID)</label>
                                            <input className="w-full bg-white border border-emerald-100 rounded-xl px-4 py-2 text-xs font-black text-emerald-700 outline-none shadow-sm" value={logic.matrixSampleId} onChange={e => logic.setMatrixSampleId(e.target.value)} />
                                        </div>
                                        <div className="p-3 bg-white/60 rounded-2xl border border-emerald-100">
                                            <p className="text-[7px] font-black text-slate-400 uppercase mb-2">即将同步的特征值 ({logic.matrixResults.length}项)</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {logic.matrixResults.map((r: any, i: number) => (
                                                    <span key={i} className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[8px] font-black border border-emerald-200">
                                                        {r.key}: {r.value}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-6">
                            <button onClick={() => setShowSyncToLogModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">取消</button>
                            <button onClick={async () => { const thumbnailUrl = await captureChartThumbnail(); logic.handleSaveToLog(thumbnailUrl); setShowSyncToLogModal(false); showToast({ message: '已成功同步至项目记录', type: 'success' }); }} disabled={!logic.targetMilestoneId} className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg disabled:opacity-50 hover:bg-black transition-all active:scale-95">确认同步并入库</button>
                        </div>
                    </div>
                </div>
            )}

            {ReactDOM.createPortal(
                <TemplateGalleryModal
                    show={showGalleryModal}
                    onClose={() => setShowGalleryModal(false)}
                    userTemplates={userTemplates}
                    onSelectTemplate={(tpl) => {
                        if (tpl.type) logic.setChartType(tpl.type as any);
                        if (tpl.color) logic.setMainColor(tpl.color);
                        if (tpl.stroke) logic.setStrokeWidth(tpl.stroke);
                        if (tpl.font) logic.setFontSize(tpl.font);
                        if (tpl.pointShape) logic.setPointShape(tpl.pointShape);
                        if (tpl.pointSize) logic.setPointSize(tpl.pointSize);
                        if (tpl.gridX !== undefined) logic.setGridX(tpl.gridX);
                        if (tpl.gridY !== undefined) logic.setGridY(tpl.gridY);
                        if (tpl.axisBox !== undefined) logic.setAxisBox(tpl.axisBox);
                        if (tpl.axisColor) logic.setAxisColor(tpl.axisColor);
                        if (tpl.axisLineWidth) logic.setAxisLineWidth(tpl.axisLineWidth);
                        if (tpl.tickFontSize) logic.setTickFontSize(tpl.tickFontSize);
                        setShowGalleryModal(false);
                        showToast({ message: `已应用模板: ${tpl.name}`, type: 'success' });
                    }}
                    onApplyAndImport={(tpl) => {
                        if (tpl.type) logic.setChartType(tpl.type as any);
                        if (tpl.color) logic.setMainColor(tpl.color);
                        setShowGalleryModal(false);
                    }}
                    templateSearchQuery=""
                    setTemplateSearchQuery={() => { }}
                    handleDiscoverTemplate={() => { }}
                    isDiscoveringTemplate={false}
                />,
                document.body
            )}

            {!isEmbedded && (
                <footer className="shrink-0 flex justify-center items-center gap-10 border-t border-slate-100 py-6 mt-4 bg-white/50 backdrop-blur-sm rounded-b-3xl">
                    <div className="flex items-center gap-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <i className="fa-solid fa-shield-halved text-emerald-500"></i> 数据排版实时同步
                    </div>
                    <div className="flex items-center gap-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <i className="fa-solid fa-atom text-indigo-500"></i> 支持 IUPAC 2026 制图标准
                    </div>
                </footer>
            )}
        </div>
    );
};

export default ElectrochemicalEngine;
