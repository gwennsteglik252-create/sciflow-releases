
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useReviewWorkshop } from '../../../hooks/useReviewWorkshop';
import { Literature, ReviewOutlineNode, ReviewSubQuestion, ScreenedLiterature, ReviewGeneratedFigure, RevisionRound, ContentSnapshot } from '../../../types';
import { EditAction } from '../../../services/gemini/review';
import { SavedFigureAssembly, ProjectTable, ProjectLatexSnippet } from '../../../types/visuals';
import { generateCompositeFigureCaption } from '../../../services/gemini/review';
import { computeReviewMetrics, ReviewQualityMetrics } from '../../../utils/reviewMetrics';
import { useProjectContext } from '../../../context/ProjectContextCore';
import { renderAssemblyToImage } from '../../../utils/renderAssemblyToImage';

// ═══════════════════════════════════════════ 通用复制按钮 ═══
const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label = '复制' }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button onClick={handleCopy} className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all flex-shrink-0 ${copied ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
            {copied ? '✓ 已复制' : `📋 ${label}`}
        </button>
    );
};

// ═══════════════════════════════════════════════════════════════════
// 阶段定义
// ═══════════════════════════════════════════════════════════════════

const WIZARD_STEPS = [
    { key: 'config', icon: '⚙️', label: '配置', desc: '设定综述主题和参数' },
    { key: 'topic_decomposition', icon: '🎯', label: '分解', desc: '主题拆分为子研究问题' },
    { key: 'literature_search', icon: '🔍', label: '检索', desc: '多轮关键词文献搜索' },
    { key: 'literature_screening', icon: '📊', label: '筛选', desc: 'AI 文献分级与评审' },
    { key: 'knowledge_extraction', icon: '🧪', label: '沉降', desc: '深度知识提取与充实' },
    { key: 'outline_generation', icon: '📝', label: '大纲', desc: '生成综述结构框架' },
    { key: 'section_generation', icon: '✍️', label: '撰写', desc: '逐节生成综述内容' },
    { key: 'figure_generation', icon: '📈', label: '图表', desc: '自动生成对比表/趋势图/机理图' },
    { key: 'cross_audit', icon: '🔎', label: '审计', desc: '全文交叉引用审查' },
    { key: 'polishing', icon: '💎', label: '润色', desc: '学术语言精修与摘要' },
    { key: 'writing_to_editor', icon: '📋', label: '写入', desc: '综述写入编辑器' }
] as const;

type WizardStepKey = typeof WIZARD_STEPS[number]['key'];

// 管线阶段到向导步骤的映射
const PIPELINE_TO_WIZARD: Record<string, number> = {
    idle: 0, config: 0,
    topic_decomposition: 1, literature_search: 2, literature_screening: 3,
    knowledge_extraction: 4, outline_generation: 5, section_generation: 6,
    figure_generation: 7, cross_audit: 8, polishing: 9, writing_to_editor: 10, completed: 10
};

// ═══════════════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════════════

interface ReviewAssistantPanelProps {
    resources: Literature[];
    onInsertText: (text: string) => void;
    onClose?: () => void;
}

// ═══════════════════════════════════════════════════════════════════
// ExportDropdown — 导出格式选择下拉面板
// ═══════════════════════════════════════════════════════════════════
const ExportDropdown: React.FC<{
    onExport: (format: 'docx' | 'latex' | 'pdf', options?: { citationStyle?: 'numbered' | 'apa' | 'gbt7714' | 'nature'; latexTemplate?: 'generic' | 'elsevier' | 'acs' | 'rsc' }) => Promise<void>;
}> = ({ onExport }) => {
    const [open, setOpen] = useState(false);
    const [citStyle, setCitStyle] = useState<'numbered' | 'apa' | 'gbt7714' | 'nature'>('numbered');
    const [latexTmpl, setLatexTmpl] = useState<'generic' | 'elsevier' | 'acs' | 'rsc'>('generic');
    const [exporting, setExporting] = useState(false);

    const handleExport = async (fmt: 'docx' | 'latex' | 'pdf') => {
        setExporting(true);
        await onExport(fmt, { citationStyle: citStyle, latexTemplate: latexTmpl });
        setExporting(false);
        setOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-all"
            >
                📥 导出
            </button>
            {open && (
                <div className="absolute bottom-full right-0 mb-2 w-64 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-4 z-50">
                    {/* 引用格式 */}
                    <p className="text-[9px] font-bold text-slate-400 mb-1.5">引用格式</p>
                    <div className="grid grid-cols-2 gap-1 mb-3">
                        {([['numbered', '编号 [1]'], ['apa', 'APA'], ['gbt7714', 'GB/T 7714'], ['nature', 'Nature']] as const).map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setCitStyle(key)}
                                className={`px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all ${
                                    citStyle === key ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* LaTeX 模板 */}
                    <p className="text-[9px] font-bold text-slate-400 mb-1.5">LaTeX 模板</p>
                    <div className="grid grid-cols-2 gap-1 mb-3">
                        {([['generic', '通用'], ['elsevier', 'Elsevier'], ['acs', 'ACS'], ['rsc', 'RSC']] as const).map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setLatexTmpl(key)}
                                className={`px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all ${
                                    latexTmpl === key ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* 导出按钮 */}
                    <div className="flex gap-2">
                        <button onClick={() => handleExport('docx')} disabled={exporting}
                            className="flex-1 px-3 py-2 rounded-xl text-[10px] font-black bg-blue-500 text-white hover:bg-blue-600 transition-all disabled:opacity-50">
                            {exporting ? '⏳' : '📄'} DOCX
                        </button>
                        <button onClick={() => handleExport('latex')} disabled={exporting}
                            className="flex-1 px-3 py-2 rounded-xl text-[10px] font-black bg-green-500 text-white hover:bg-green-600 transition-all disabled:opacity-50">
                            {exporting ? '⏳' : '📝'} LaTeX
                        </button>
                        <button onClick={() => handleExport('pdf')} disabled={exporting}
                            className="flex-1 px-3 py-2 rounded-xl text-[10px] font-black bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-50">
                            {exporting ? '⏳' : '📕'} PDF
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const ReviewAssistantPanel: React.FC<ReviewAssistantPanelProps> = ({ resources, onInsertText, onClose }) => {
    // 当前向导步骤
    const [activeStep, setActiveStep] = useState(0);

    // 自动推进回调
    const handleStageComplete = useCallback((_stage: string, nextIdx: number) => {
        setActiveStep(nextIdx);
    }, []);

    const workshop = useReviewWorkshop(resources, onInsertText, handleStageComplete);
    const { session, isRunning, currentLog, pipelineProgress } = workshop;

    const formatMs = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;
        const s = Math.round(ms / 1000);
        if (s < 60) return `${s}s`;
        return `${Math.floor(s / 60)}m${s % 60}s`;
    };

    // 键盘快捷键
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
            if (e.key === 'ArrowLeft') { e.preventDefault(); setActiveStep(s => Math.max(0, s - 1)); }
            if (e.key === 'ArrowRight') { e.preventDefault(); setActiveStep(s => Math.min(WIZARD_STEPS.length - 1, s + 1)); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // 计算总进度百分比
    const overallProgress = useMemo(() => {
        const doneCount = session.stages.filter(s => s.status === 'done' || s.status === 'skipped').length;
        return Math.round((doneCount / session.stages.length) * 100);
    }, [session.stages]);

    // 阶段状态查询
    const getStageStatus = useCallback((stepKey: WizardStepKey) => {
        if (stepKey === 'config') return session.currentStage !== 'idle' ? 'done' : 'pending';
        const stage = session.stages.find(s => s.stage === stepKey);
        return stage?.status ?? 'pending';
    }, [session]);

    // 执行当前步骤
    const executeCurrentStep = useCallback(() => {
        const step = WIZARD_STEPS[activeStep];
        const actions: Record<string, () => void> = {
            config: workshop.runTopicDecomposition,
            topic_decomposition: workshop.runTopicDecomposition,
            literature_search: workshop.runLiteratureSearch,
            literature_screening: workshop.runLiteratureScreening,
            knowledge_extraction: workshop.runKnowledgeExtraction,
            outline_generation: workshop.runOutlineGeneration,
            section_generation: workshop.runSectionGeneration,
            figure_generation: workshop.runFigureGeneration,
            cross_audit: workshop.runCrossAudit,
            polishing: workshop.runPolishing,
            writing_to_editor: workshop.runWriteToEditor
        };
        actions[step.key]?.();
    }, [activeStep, workshop]);

    // ── 步骤条状态颜色 ──
    const stepStatusColor = (idx: number) => {
        const status = getStageStatus(WIZARD_STEPS[idx].key);
        if (status === 'done' || status === 'skipped') return 'bg-emerald-500 text-white shadow-emerald-200';
        if (status === 'running') return 'bg-blue-500 text-white shadow-blue-200 animate-pulse';
        if (status === 'error') return 'bg-red-500 text-white shadow-red-200';
        if (idx === activeStep) return 'bg-indigo-500 text-white shadow-indigo-200';
        return 'bg-slate-200 text-slate-500';
    };

    const connectorColor = (idx: number) => {
        const status = getStageStatus(WIZARD_STEPS[idx].key);
        return status === 'done' || status === 'skipped' ? 'bg-emerald-400' : 'bg-slate-200';
    };

    // ── 底部按钮状态 ──
    const currentStatus = getStageStatus(WIZARD_STEPS[activeStep].key);
    const isDone = currentStatus === 'done' || currentStatus === 'skipped';
    const canGoNext = activeStep < WIZARD_STEPS.length - 1;
    const canGoPrev = activeStep > 0;

    // 判断当前步骤是否满足执行前置条件
    const canExecute = !isRunning && (activeStep === 0 || (() => {
        const prevKey = WIZARD_STEPS[activeStep - 1]?.key;
        const prevStatus = getStageStatus(prevKey);
        return prevStatus === 'done' || prevStatus === 'skipped';
    })());

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-white rounded-[1.25rem] border border-slate-200/80 shadow-xl overflow-hidden">

            {/* ═══ 顶部：标题栏 ═══ */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
                        <span className="text-white text-sm">🧬</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-black text-slate-800">综述工坊</h2>
                            {overallProgress > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${overallProgress === 100 ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                    {overallProgress}%
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400">AI Agent 迭代式综述写作系统 {overallProgress > 0 && overallProgress < 100 && '· 进行中'}{overallProgress === 100 && '· 已完成'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* 一键全自动按钮 */}
                    {!isRunning && session.currentStage === 'idle' && (
                        <button
                            onClick={workshop.runAllSteps}
                            disabled={!session.config.topic.trim()}
                            className="px-4 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg text-[10px] font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-40"
                        >
                            🚀 一键全自动
                        </button>
                    )}
                    {isRunning && (
                        <button onClick={workshop.abort} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-bold transition-colors">
                            ⏹ 停止
                        </button>
                    )}
                    <button onClick={workshop.resetSession} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-[10px] font-bold transition-colors">
                        🔄 重置
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="px-3 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-400 rounded-lg text-[10px] font-bold transition-colors">
                            ✕ 退出
                        </button>
                    )}
                </div>
            </div>

            {/* ═══ 水平步骤条 ═══ */}
            <div className="px-6 py-4 bg-white/80 border-b border-slate-100 shrink-0 overflow-x-auto no-scrollbar">
                <div className="flex items-center min-w-max">
                    {WIZARD_STEPS.map((step, idx) => (
                        <React.Fragment key={step.key}>
                            <button
                                onClick={() => setActiveStep(idx)}
                                className="flex flex-col items-center gap-1.5 group relative"
                                title={step.desc}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-sm ${stepStatusColor(idx)}`}>
                                    {getStageStatus(step.key) === 'done' ? '✓' : step.icon}
                                </div>
                                <span className={`text-[9px] font-bold whitespace-nowrap transition-colors ${idx === activeStep ? 'text-indigo-600' : 'text-slate-400'}`}>
                                    {step.label}
                                </span>
                                {/* 当前指示器 */}
                                {idx === activeStep && (
                                    <div className="absolute -bottom-3 w-full h-[2px] bg-indigo-500 rounded-full" />
                                )}
                            </button>
                            {idx < WIZARD_STEPS.length - 1 && (
                                <div className={`w-6 h-[2px] mx-1 rounded-full transition-colors shrink-0 mt-[-14px] ${connectorColor(idx)}`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* ═══ 主内容区 ═══ */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 min-h-0">
                <div className="mb-4">
                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                        <span className="text-lg">{WIZARD_STEPS[activeStep].icon}</span>
                        {WIZARD_STEPS[activeStep].label}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">{WIZARD_STEPS[activeStep].desc}</p>
                </div>

                <StepContent
                    stepKey={WIZARD_STEPS[activeStep].key}
                    workshop={workshop}
                />
            </div>

            {/* ═══ 实时进度面板 ═══ */}
            {(currentLog || (pipelineProgress.completedSteps > 0 && pipelineProgress.percent < 100)) && (
                <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-100 shrink-0">
                    {isRunning && pipelineProgress.completedSteps > 0 ? (
                        <div>
                            {/* 进度条 */}
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${pipelineProgress.percent}%` }} />
                                </div>
                                <span className="text-[9px] font-black text-indigo-500 flex-shrink-0">{pipelineProgress.percent}%</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <p className="text-[9px] text-slate-400 truncate flex-1">
                                    💬 {currentLog}
                                </p>
                                <div className="flex items-center gap-3 text-[9px] text-slate-400 flex-shrink-0">
                                    <span>✅ {pipelineProgress.completedSteps}/{pipelineProgress.totalSteps}</span>
                                    <span>⏱️ {formatMs(pipelineProgress.elapsed)}</span>
                                    {pipelineProgress.estimatedFinishTime && (
                                        <span className="text-indigo-500 font-bold">≈ 剩余 {formatMs(pipelineProgress.estimatedRemaining)}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : currentLog ? (
                        <p className="text-[10px] text-slate-400 truncate">💬 {currentLog}</p>
                    ) : null}
                </div>
            )}
            {/* 管线完成汇总 */}
            {!isRunning && pipelineProgress.completedSteps >= pipelineProgress.totalSteps && pipelineProgress.elapsed > 0 && (
                <div className="px-6 py-2 bg-emerald-50 border-t border-emerald-100 shrink-0 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-600">🎉 综述生成完成</span>
                    <span className="text-[9px] text-emerald-500">总耗时 {formatMs(pipelineProgress.elapsed)}</span>
                </div>
            )}

            {/* ═══ 底部导航栏 ═══ */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-slate-100 shrink-0">
                <button
                    onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                    disabled={!canGoPrev}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    ← 上一步
                </button>

                <div className="flex gap-2">
                    {/* 执行当前步骤 */}
                    {currentStatus !== 'done' && (
                        <button
                            onClick={executeCurrentStep}
                            disabled={!canExecute || isRunning}
                            className="px-6 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:shadow-lg shadow-indigo-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
                        >
                            {isRunning ? '⏳ 执行中...' : '▶ 执行此步'}
                        </button>
                    )}
                    {/* 已完成时显示重新执行 */}
                    {isDone && !isRunning && (
                        <button
                            onClick={executeCurrentStep}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold text-indigo-500 bg-indigo-50 hover:bg-indigo-100 transition-all"
                        >
                            🔄 重新执行
                        </button>
                    )}
                </div>

                <button
                    onClick={() => setActiveStep(Math.min(WIZARD_STEPS.length - 1, activeStep + 1))}
                    disabled={!canGoNext}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-700 hover:bg-slate-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    下一步 →
                </button>

                {/* 导出按钮 */}
                {Object.keys(workshop.session.generatedSections).length > 0 && (
                    <ExportDropdown onExport={workshop.exportReview} />
                )}
            </div>
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════
// StepContent — 每步全屏内容路由
// ═══════════════════════════════════════════════════════════════════

interface StepContentProps {
    stepKey: WizardStepKey;
    workshop: ReturnType<typeof useReviewWorkshop>;
}

const StepContent: React.FC<StepContentProps> = ({ stepKey, workshop }) => {
    switch (stepKey) {
        case 'config':
            return <ConfigStep config={workshop.session.config} onChange={workshop.updateConfig} />;
        case 'topic_decomposition':
            return <TopicStep subQuestions={workshop.session.subQuestions} onUpdate={workshop.updateSubQuestion} onAdd={workshop.addSubQuestion} onRemove={workshop.removeSubQuestion} />;
        case 'literature_search':
            return <SearchStep results={workshop.searchResults} subQuestions={workshop.session.subQuestions} />;
        case 'literature_screening':
            return <ScreeningStep
                screened={workshop.session.screenedLiterature}
                results={workshop.searchResults}
                subQuestions={workshop.session.subQuestions}
                onUpdateTier={workshop.updateLiteratureTier}
                onManualAdd={workshop.manualAddScreened}
                onUpdateAssignment={workshop.updateSubtopicAssignment}
            />;
        case 'knowledge_extraction':
            return <ExtractionStep screened={workshop.session.screenedLiterature} results={workshop.searchResults} />;
        case 'outline_generation':
            return <OutlineStep
                outline={workshop.session.outline}
                onUpdateNode={workshop.updateOutlineNode}
                onAddNode={workshop.addOutlineNode}
                onRemoveNode={workshop.removeOutlineNode}
                onMoveNode={workshop.moveOutlineNode}
                onPromoteNode={workshop.promoteOutlineNode}
                onDemoteNode={workshop.demoteOutlineNode}
                onMergeNodes={workshop.mergeOutlineNodes}
                onSplitNode={workshop.splitOutlineNode}
                onReassignLiterature={workshop.reassignLiterature}
                searchResults={workshop.searchResults}
            />;
        case 'section_generation':
            return <WritingStep
                outline={workshop.session.outline}
                sections={workshop.session.generatedSections}
                onRegenerate={workshop.regenerateSection}
                isRunning={workshop.isRunning}
                contentHistory={workshop.session.contentHistory}
                onRestoreSnapshot={workshop.restoreSnapshot}
                onEditSection={workshop.editSectionContent}
                onAiEdit={workshop.aiEditSelection}
                onIncrementalAudit={workshop.runIncrementalAudit}
                isAiEditing={workshop.isAiEditing}
            />;
        case 'figure_generation':
            return <FigureStep
                figures={workshop.session.generatedFigures}
                outline={workshop.session.outline}
                attachedAssemblies={workshop.session.attachedAssemblies}
                onAttach={workshop.attachAssemblyToSection}
                onDetach={workshop.detachAssemblyFromSection}
                reviewTopic={workshop.session.config.topic}
                language={workshop.session.config.language}
                attachedTables={workshop.session.attachedTables}
                onAttachTable={workshop.attachTableToSection}
                onDetachTable={workshop.detachTableFromSection}
                attachedFormulas={workshop.session.attachedFormulas}
                onAttachFormula={workshop.attachFormulaToSection}
                onDetachFormula={workshop.detachFormulaFromSection}
            />;
        case 'cross_audit':
            return <AuditStep auditReport={workshop.session.auditReport} revisionHistory={workshop.session.revisionHistory} onAutoRevise={workshop.runAutoRevision} isRunning={workshop.isRunning} />;
        case 'polishing':
            return <PolishStep abstract={workshop.session.abstract} keywords={workshop.session.keywords} highlights={workshop.session.highlights} outline={workshop.session.outline} generatedSections={workshop.session.generatedSections} />;
        case 'writing_to_editor':
            return <FinalStep session={workshop.session} />;
        default:
            return null;
    }
};


// ═══════════════════════════════════════════════════════════════════
// Step 0: 配置
// ═══════════════════════════════════════════════════════════════════

const ConfigStep: React.FC<{ config: any; onChange: (p: any) => void }> = ({ config, onChange }) => (
    <div className="space-y-6 max-w-2xl">
        {/* 主题 */}
        <div>
            <label className="text-xs font-bold text-slate-600 mb-2 block">🎯 综述主题 *</label>
            <textarea
                value={config.topic}
                onChange={e => onChange({ topic: e.target.value })}
                placeholder="如：电催化析氢反应中的单原子催化剂研究进展"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm resize-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all bg-white"
                rows={3}
            />
        </div>

        {/* 研究范围 */}
        <div>
            <label className="text-xs font-bold text-slate-600 mb-2 block">🔬 研究范围（可选）</label>
            <input
                value={config.scope}
                onChange={e => onChange({ scope: e.target.value })}
                placeholder="限定具体方向，如：非贵金属催化剂、过渡金属碳化物"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-300 transition-all bg-white"
            />
        </div>

        {/* 两列参数 */}
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="text-xs font-bold text-slate-600 mb-2 block">🌐 综述语言</label>
                <select value={config.language} onChange={e => onChange({ language: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-300 transition-all">
                    <option value="zh">中文综述</option>
                    <option value="en">English Review</option>
                </select>
            </div>
            <div>
                <label className="text-xs font-bold text-slate-600 mb-2 block">📅 文献年份</label>
                <select
                    value={`${config.yearRange[1] - config.yearRange[0]}`}
                    onChange={e => { const r = parseInt(e.target.value); onChange({ yearRange: [new Date().getFullYear() - r, new Date().getFullYear()] }); }}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-300 transition-all"
                >
                    <option value="3">近 3 年</option>
                    <option value="5">近 5 年</option>
                    <option value="10">近 10 年</option>
                </select>
            </div>
            <div>
                <label className="text-xs font-bold text-slate-600 mb-2 block">📏 目标字数</label>
                <select value={config.targetWordCount} onChange={e => onChange({ targetWordCount: parseInt(e.target.value) })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-300 transition-all">
                    <option value={3000}>~3,000（简要综述）</option>
                    <option value={5000}>~5,000（标准综述）</option>
                    <option value={8000}>~8,000（深度综述）</option>
                    <option value={12000}>~12,000（全面综述）</option>
                </select>
            </div>
            <div>
                <label className="text-xs font-bold text-slate-600 mb-2 block">📑 引用格式</label>
                <select value={config.citationStyle} onChange={e => onChange({ citationStyle: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-300 transition-all">
                    <option value="numbered">编号引用 [1,2,3]</option>
                    <option value="author-year">作者-年份 (Author, 2024)</option>
                </select>
            </div>
        </div>

        {/* 自定义指令 */}
        <div>
            <label className="text-xs font-bold text-slate-600 mb-2 block">💡 自定义指令（可选）</label>
            <textarea
                value={config.customInstructions || ''}
                onChange={e => onChange({ customInstructions: e.target.value })}
                placeholder="如：重点关注贵金属催化剂的替代策略、着重讨论性能对比"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm resize-none focus:ring-2 focus:ring-indigo-300 transition-all bg-white"
                rows={2}
            />
        </div>

        {/* 提示 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700 flex items-start gap-3">
            <span className="text-lg mt-[-2px]">⚠️</span>
            <div>
                <p className="font-bold mb-1">Token 消耗提示</p>
                <p>完整综述生成约需 45-60 次 AI 调用。每步可独立暂停、审阅和重做。请确保 API 配额充足。</p>
            </div>
        </div>
    </div>
);


// ═══════════════════════════════════════════════════════════════════
// Step 1: 主题分解
// ═══════════════════════════════════════════════════════════════════

const TopicStep: React.FC<{
    subQuestions: ReviewSubQuestion[];
    onUpdate: (id: string, update: Partial<ReviewSubQuestion>) => void;
    onAdd: () => void;
    onRemove: (id: string) => void;
}> = ({ subQuestions, onUpdate, onAdd, onRemove }) => {
    if (subQuestions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <span className="text-4xl mb-4">🎯</span>
                <p className="text-sm font-bold">点击"执行此步"分解研究主题</p>
                <p className="text-xs mt-1">AI 将自动拆解为多个子研究问题和搜索关键词</p>
            </div>
        );
    }

    return (
        <div className="space-y-3 max-w-2xl">
            <p className="text-xs text-slate-500 mb-4">以下子问题将用于引导文献检索。你可以编辑、删除或新增子问题。</p>
            {subQuestions.map((sq, i) => (
                <div key={sq.id} className="bg-white rounded-xl border border-slate-200 p-4 group hover:border-indigo-200 hover:shadow-sm transition-all">
                    <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">
                            Q{i + 1}
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                            <input
                                value={sq.question}
                                onChange={e => onUpdate(sq.id, { question: e.target.value })}
                                className="w-full text-sm font-bold text-slate-700 bg-transparent border-none focus:outline-none placeholder:text-slate-300"
                                placeholder="子研究问题..."
                            />
                            {sq.description && (
                                <p className="text-[11px] text-slate-400">{sq.description}</p>
                            )}
                            <div className="flex flex-wrap gap-1.5">
                                {sq.keywords.map((kw, ki) => (
                                    <span key={ki} className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold">{kw}</span>
                                ))}
                            </div>
                        </div>
                        <button onClick={() => onRemove(sq.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 mt-1">
                            <i className="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    </div>
                </div>
            ))}
            <button onClick={onAdd} className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-400 hover:text-indigo-500 hover:border-indigo-300 transition-colors font-bold">
                + 添加子问题
            </button>
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════
// Step 2: 文献检索结果
// ═══════════════════════════════════════════════════════════════════

const SearchStep: React.FC<{ results: Literature[]; subQuestions: ReviewSubQuestion[] }> = ({ results, subQuestions }) => {
    if (results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <span className="text-4xl mb-4">🔍</span>
                <p className="text-sm font-bold">点击"执行此步"开始多轮文献检索</p>
                <p className="text-xs mt-1">将使用 {subQuestions.length} 组关键词从 OpenAlex 数据库检索</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-3 mb-4">
                <div className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold">
                    共 {results.length} 篇文献
                </div>
            </div>
            <div className="grid gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
                {results.map((lit, i) => (
                    <div key={lit.id || i} className="bg-white rounded-xl border border-slate-100 p-3 hover:border-slate-200 transition-all">
                        <div className="flex items-start gap-3">
                            <span className="text-[10px] font-bold text-slate-300 mt-0.5 flex-shrink-0 w-6 text-right">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-700 leading-relaxed">{lit.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-slate-400">{lit.authors?.[0]}{(lit.authors?.length ?? 0) > 1 ? ' et al.' : ''}</span>
                                    <span className="text-[10px] text-slate-300">·</span>
                                    <span className="text-[10px] text-slate-400">{lit.year}</span>
                                    {(lit as any).journal && (
                                        <>
                                            <span className="text-[10px] text-slate-300">·</span>
                                            <span className="text-[10px] text-indigo-400 font-medium">{(lit as any).journal}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════
// Step 3: 文献筛选
// ═══════════════════════════════════════════════════════════════════

const ScreeningStep: React.FC<{
    screened: ScreenedLiterature[];
    results: Literature[];
    subQuestions: import('../../../types').ReviewSubQuestion[];
    onUpdateTier: (id: string, tier: ScreenedLiterature['tier']) => void;
    onManualAdd: (litId: string, tier: ScreenedLiterature['tier']) => void;
    onUpdateAssignment: (litId: string, subtopicIds: string[]) => void;
}> = ({ screened, results, subQuestions, onUpdateTier, onManualAdd, onUpdateAssignment }) => {
    const [activeTab, setActiveTab] = useState<'list' | 'matrix' | 'coverage' | 'cluster'>('list');
    const [filterTier, setFilterTier] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddPanel, setShowAddPanel] = useState(false);

    if (screened.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <span className="text-4xl mb-4">📊</span>
                <p className="text-sm font-bold">点击"执行此步"让 AI 筛选文献</p>
                <p className="text-xs mt-1">AI 将对每篇文献进行相关度评分和分级</p>
            </div>
        );
    }

    const tierColors: Record<string, string> = {
        core: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        supporting: 'bg-blue-100 text-blue-700 border-blue-200',
        reference: 'bg-slate-100 text-slate-600 border-slate-200',
        excluded: 'bg-red-50 text-red-400 border-red-200'
    };
    const tierLabels: Record<string, string> = { core: '🟢 核心', supporting: '🔵 支撑', reference: '⚪ 参考', excluded: '🔴 排除' };

    const counts = { core: 0, supporting: 0, reference: 0, excluded: 0 };
    screened.forEach(s => { counts[s.tier] = (counts[s.tier] || 0) + 1; });

    const filtered = filterTier === 'all' ? screened : screened.filter(s => s.tier === filterTier);
    const screenedIds = new Set(screened.map(s => s.literatureId));
    const nonScreened = results.filter(r => !screenedIds.has(r.id) && (
        !searchQuery || r.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.authors?.some(a => a.toLowerCase().includes(searchQuery.toLowerCase()))
    ));

    // Tab 切换栏
    const tabs = [
        { key: 'list' as const, icon: '📋', label: '列表' },
        { key: 'matrix' as const, icon: '🔗', label: '关联' },
        { key: 'coverage' as const, icon: '🌡️', label: '覆盖度' },
        { key: 'cluster' as const, icon: '🧩', label: '聚类' }
    ];

    // 覆盖度计算
    const coverageData = useMemo(() => {
        return subQuestions.map(sq => {
            const associated = screened.filter(s => s.assignedSubtopics.includes(sq.id) && s.tier !== 'excluded');
            const coreCount = associated.filter(s => s.tier === 'core').length;
            const supportCount = associated.filter(s => s.tier === 'supporting').length;
            const refCount = associated.filter(s => s.tier === 'reference').length;
            const total = associated.length;
            const strength = coreCount * 3 + supportCount * 2 + refCount;
            return { sq, total, coreCount, supportCount, refCount, strength };
        });
    }, [subQuestions, screened]);
    const maxStrength = Math.max(1, ...coverageData.map(d => d.strength));

    // 聚类计算（基于关键词重叠）
    const clusters = useMemo(() => {
        const active = screened.filter(s => s.tier !== 'excluded');
        const groups: { label: string; items: typeof active }[] = [];
        const assigned = new Set<string>();

        for (const s of active) {
            if (assigned.has(s.literatureId)) continue;
            const lit = results.find(r => r.id === s.literatureId);
            if (!lit) continue;
            const kws = new Set((lit.tags || []).map((k: string) => k.toLowerCase()));
            const cluster = [s];
            assigned.add(s.literatureId);

            for (const other of active) {
                if (assigned.has(other.literatureId)) continue;
                const otherLit = results.find(r => r.id === other.literatureId);
                if (!otherLit) continue;
                const otherKws = (otherLit.tags || []).map((k: string) => k.toLowerCase());
                const overlap = otherKws.filter((k: string) => kws.has(k)).length;
                if (overlap >= 1) {
                    cluster.push(other);
                    assigned.add(other.literatureId);
                }
            }
            const label = (lit.tags || []).slice(0, 3).join(', ') || lit.title?.substring(0, 30) || '未分类';
            groups.push({ label, items: cluster });
        }
        return groups;
    }, [screened, results]);

    return (
        <div>
            {/* 统计卡片 */}
            <div className="grid grid-cols-4 gap-3 mb-3">
                {Object.entries(tierLabels).map(([key, label]) => (
                    <button
                        key={key}
                        onClick={() => { setFilterTier(filterTier === key ? 'all' : key); setActiveTab('list'); }}
                        className={`p-3 rounded-xl border text-center transition-all ${filterTier === key ? 'ring-2 ring-indigo-300 shadow-md' : ''} ${tierColors[key]}`}
                    >
                        <p className="text-lg font-black">{counts[key as keyof typeof counts]}</p>
                        <p className="text-[9px] font-bold mt-0.5">{label}</p>
                    </button>
                ))}
            </div>

            {/* Tab 切换 */}
            <div className="flex gap-1 mb-3 bg-slate-100 rounded-xl p-1">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                            activeTab === tab.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab 内容 */}
            {activeTab === 'list' && (
                <div>
                    {/* 文献列表 */}
                    <div className="space-y-2 max-h-[38vh] overflow-y-auto custom-scrollbar pr-1">
                        {filtered.map((s, i) => {
                            const lit = results.find(r => r.id === s.literatureId);
                            return (
                                <div key={s.literatureId || i} className="bg-white rounded-xl border border-slate-100 p-3 flex items-center gap-3 hover:border-slate-200 transition-all">
                                    <select
                                        value={s.tier}
                                        onChange={e => onUpdateTier(s.literatureId, e.target.value as any)}
                                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${tierColors[s.tier]} cursor-pointer flex-shrink-0`}
                                    >
                                        <option value="core">核心</option>
                                        <option value="supporting">支撑</option>
                                        <option value="reference">参考</option>
                                        <option value="excluded">排除</option>
                                    </select>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-700 truncate">{lit?.title || s.literatureId}</p>
                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{s.reason}</p>
                                    </div>
                                    <div className="px-2 py-1 bg-slate-50 rounded-lg text-[10px] font-bold text-slate-500 flex-shrink-0">
                                        {s.relevanceScore}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {/* 搜索追加 */}
                    <div className="mt-3 border-t border-slate-100 pt-3">
                        <button
                            onClick={() => setShowAddPanel(!showAddPanel)}
                            className="w-full px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-[10px] font-bold hover:bg-indigo-100 transition-colors"
                        >
                            {showAddPanel ? '✕ 收起' : '➕ 手动追加文献'}
                        </button>
                        {showAddPanel && (
                            <div className="mt-2">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="搜索未筛选文献的标题或作者..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-300 transition-colors"
                                />
                                <div className="mt-2 space-y-1.5 max-h-[20vh] overflow-y-auto custom-scrollbar">
                                    {nonScreened.slice(0, 15).map(lit => (
                                        <div key={lit.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[11px] text-slate-700 truncate">{lit.title}</p>
                                                <p className="text-[9px] text-slate-400 truncate">{lit.authors?.slice(0, 2).join(', ')} ({lit.year})</p>
                                            </div>
                                            <select
                                                defaultValue="supporting"
                                                onChange={e => { onManualAdd(lit.id, e.target.value as any); }}
                                                className="px-2 py-1 text-[9px] font-bold bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-200 cursor-pointer"
                                            >
                                                <option value="core">➕ 核心</option>
                                                <option value="supporting">➕ 支撑</option>
                                                <option value="reference">➕ 参考</option>
                                            </select>
                                        </div>
                                    ))}
                                    {nonScreened.length === 0 && (
                                        <p className="text-center text-[10px] text-slate-400 py-4">没有更多未筛选的文献</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'matrix' && (
                <div className="overflow-x-auto max-h-[45vh] overflow-y-auto custom-scrollbar">
                    {subQuestions.length === 0 ? (
                        <p className="text-center text-xs text-slate-400 py-8">请先完成主题分解生成子问题</p>
                    ) : (
                        <table className="w-full text-[9px] border-collapse">
                            <thead>
                                <tr className="bg-slate-50">
                                    <th className="sticky left-0 bg-slate-50 p-2 text-left text-slate-500 font-bold min-w-[100px] z-10">文献</th>
                                    {subQuestions.map(sq => (
                                        <th key={sq.id} className="p-2 text-center text-slate-500 font-bold min-w-[60px]" title={sq.question}>
                                            <span className="line-clamp-2">{sq.question.substring(0, 20)}</span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {screened.filter(s => s.tier !== 'excluded').map(s => {
                                    const lit = results.find(r => r.id === s.literatureId);
                                    return (
                                        <tr key={s.literatureId} className="border-t border-slate-100 hover:bg-slate-50/50">
                                            <td className="sticky left-0 bg-white p-2 z-10">
                                                <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${s.tier === 'core' ? 'bg-emerald-500' : s.tier === 'supporting' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                                <span className="text-slate-600 truncate">{lit?.title?.substring(0, 25) || s.literatureId}</span>
                                            </td>
                                            {subQuestions.map(sq => {
                                                const isLinked = s.assignedSubtopics.includes(sq.id);
                                                return (
                                                    <td key={sq.id} className="p-2 text-center">
                                                        <button
                                                            onClick={() => {
                                                                const next = isLinked
                                                                    ? s.assignedSubtopics.filter(id => id !== sq.id)
                                                                    : [...s.assignedSubtopics, sq.id];
                                                                onUpdateAssignment(s.literatureId, next);
                                                            }}
                                                            className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${
                                                                isLinked ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-200 hover:border-indigo-300'
                                                            }`}
                                                        >
                                                            {isLinked && '✓'}
                                                        </button>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {activeTab === 'coverage' && (
                <div className="space-y-3 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
                    {coverageData.length === 0 ? (
                        <p className="text-center text-xs text-slate-400 py-8">请先完成主题分解</p>
                    ) : coverageData.map(({ sq, total, coreCount, supportCount, refCount, strength }) => (
                        <div key={sq.id} className="bg-white rounded-xl border border-slate-100 p-3">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[11px] font-bold text-slate-700 flex-1 truncate" title={sq.question}>{sq.question}</p>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                    total === 0 ? 'bg-red-100 text-red-600' :
                                    total <= 2 ? 'bg-amber-100 text-amber-600' :
                                    'bg-emerald-100 text-emerald-600'
                                }`}>
                                    {total === 0 ? '❗ 缺失' : total <= 2 ? '⚠️ 不足' : '✅ 充足'}
                                </span>
                            </div>
                            {/* 强度色条 */}
                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
                                {coreCount > 0 && <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(coreCount * 3 / maxStrength) * 100}%` }} />}
                                {supportCount > 0 && <div className="bg-blue-400 h-full transition-all" style={{ width: `${(supportCount * 2 / maxStrength) * 100}%` }} />}
                                {refCount > 0 && <div className="bg-slate-300 h-full transition-all" style={{ width: `${(refCount / maxStrength) * 100}%` }} />}
                            </div>
                            <div className="flex gap-3 mt-1.5 text-[9px] text-slate-400">
                                <span>🟢 核心 {coreCount}</span>
                                <span>🔵 支撑 {supportCount}</span>
                                <span>⚪ 参考 {refCount}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'cluster' && (
                <div className="space-y-3 max-h-[45vh] overflow-y-auto custom-scrollbar pr-1">
                    {clusters.length === 0 ? (
                        <p className="text-center text-xs text-slate-400 py-8">没有足够的文献进行聚类</p>
                    ) : clusters.map((group, gi) => (
                        <div key={gi} className="bg-white rounded-xl border border-slate-100 p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center text-[10px] font-black flex-shrink-0">{group.items.length}</span>
                                <p className="text-[11px] font-bold text-slate-700 truncate">{group.label}</p>
                            </div>
                            <div className="space-y-1">
                                {group.items.map(s => {
                                    const lit = results.find(r => r.id === s.literatureId);
                                    return (
                                        <div key={s.literatureId} className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg">
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.tier === 'core' ? 'bg-emerald-500' : s.tier === 'supporting' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                            <p className="text-[10px] text-slate-600 truncate flex-1">{lit?.title || s.literatureId}</p>
                                            <span className="text-[9px] text-slate-400 flex-shrink-0">{lit?.year}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════
// Step 4: 知识沉降
// ═══════════════════════════════════════════════════════════════════

const ExtractionStep: React.FC<{ screened: ScreenedLiterature[]; results: Literature[] }> = ({ screened, results }) => {
    const coreSupport = screened.filter(s => s.tier === 'core' || s.tier === 'supporting');
    const enriched = coreSupport.filter(s => {
        const lit = results.find(r => r.id === s.literatureId);
        return lit && (lit as any).performance?.length > 0;
    });

    if (coreSupport.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <span className="text-4xl mb-4">🧪</span>
                <p className="text-sm font-bold">点击"执行此步"提取核心知识</p>
                <p className="text-xs mt-1">将为核心/支撑文献提取性能数据、合成方法等结构化信息</p>
            </div>
        );
    }

    const progress = coreSupport.length > 0 ? Math.round((enriched.length / coreSupport.length) * 100) : 0;

    return (
        <div className="max-w-xl">
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
                <div className="relative w-24 h-24 mx-auto mb-4">
                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                        <circle cx="48" cy="48" r="40" strokeWidth="8" fill="none" className="stroke-slate-100" />
                        <circle cx="48" cy="48" r="40" strokeWidth="8" fill="none" className="stroke-indigo-500 transition-all duration-500"
                            strokeDasharray={`${2 * Math.PI * 40}`} strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`} strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-black text-indigo-600">{progress}%</span>
                    </div>
                </div>
                <p className="text-sm font-bold text-slate-700">
                    已充实 <span className="text-indigo-600">{enriched.length}</span> / {coreSupport.length} 篇文献
                </p>
                <p className="text-xs text-slate-400 mt-1">核心文献将获得性能指标、合成步骤等深度数据</p>
            </div>
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════
// Step 5: 大纲交互式编辑器
// ═══════════════════════════════════════════════════════════════════

interface OutlineStepProps {
    outline: ReviewOutlineNode[];
    onUpdateNode: (id: string, update: Partial<ReviewOutlineNode>) => void;
    onAddNode: (parentId?: string) => void;
    onRemoveNode: (nodeId: string) => void;
    onMoveNode: (nodeId: string, direction: 'up' | 'down') => void;
    onPromoteNode: (nodeId: string) => void;
    onDemoteNode: (nodeId: string) => void;
    onMergeNodes: (nodeIdA: string, nodeIdB: string) => void;
    onSplitNode: (nodeId: string, newNodeLitIds: string[]) => void;
    onReassignLiterature: (litId: string, fromNodeId: string, toNodeId: string) => void;
    searchResults: Literature[];
}

const OutlineStep: React.FC<OutlineStepProps> = ({
    outline, onUpdateNode, onAddNode, onRemoveNode, onMoveNode,
    onPromoteNode, onDemoteNode, onMergeNodes, onSplitNode,
    onReassignLiterature, searchResults
}) => {
    // 展开/收起描述编辑
    const [expandedId, setExpandedId] = useState<string | null>(null);
    // 展开文献列表
    const [litExpandedId, setLitExpandedId] = useState<string | null>(null);
    // 拆分弹窗
    const [splitNodeId, setSplitNodeId] = useState<string | null>(null);
    const [splitSelection, setSplitSelection] = useState<Set<string>>(new Set());
    // 删除确认
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    if (outline.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <span className="text-4xl mb-4">📝</span>
                <p className="text-sm font-bold">点击"执行此步"生成综述大纲</p>
                <p className="text-xs mt-1">AI 将根据子问题和文献生成分层大纲结构</p>
            </div>
        );
    }

    // 收集所有扁平节点用于文献移动下拉
    const allFlatNodes: ReviewOutlineNode[] = [];
    const collectFlat = (nodes: ReviewOutlineNode[]) => {
        for (const n of nodes) { allFlatNodes.push(n); if (n.children?.length) collectFlat(n.children); }
    };
    collectFlat(outline);

    // 按钮样式
    const iconBtn = 'w-6 h-6 rounded-lg flex items-center justify-center text-[10px] transition-all flex-shrink-0';
    const iconBtnDefault = `${iconBtn} bg-slate-50 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600`;
    const iconBtnDanger = `${iconBtn} bg-slate-50 text-slate-400 hover:bg-red-100 hover:text-red-500`;

    const renderNode = (node: ReviewOutlineNode, siblings: ReviewOutlineNode[], indexInSiblings: number, depth: number = 0, parentId?: string) => {
        const isExpanded = expandedId === node.id;
        const isLitExpanded = litExpandedId === node.id;
        const hasNextSibling = indexInSiblings < siblings.length - 1;
        const hasPrevSibling = indexInSiblings > 0;

        return (
            <div key={node.id} style={{ marginLeft: depth * 20 }}>
                <div className="bg-white rounded-xl border border-slate-100 p-3 mb-1.5 hover:border-indigo-200 hover:shadow-sm transition-all group">
                    {/* ─── 第一行: 层级标记 + 标题 + 工具栏 ─── */}
                    <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            node.level === 1 ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                            <span className="text-[8px] font-black">H{node.level}</span>
                        </div>
                        <input
                            value={node.title}
                            onChange={e => onUpdateNode(node.id, { title: e.target.value })}
                            className="flex-1 min-w-0 text-sm font-bold text-slate-700 bg-transparent border-none focus:outline-none focus:bg-indigo-50/50 rounded px-1 -mx-1 transition-colors"
                        />
                        {/* 工具栏 - hover 显示 */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => onMoveNode(node.id, 'up')} disabled={!hasPrevSibling} className={iconBtnDefault} title="上移">
                                <i className="fa-solid fa-chevron-up" />
                            </button>
                            <button onClick={() => onMoveNode(node.id, 'down')} disabled={!hasNextSibling} className={iconBtnDefault} title="下移">
                                <i className="fa-solid fa-chevron-down" />
                            </button>
                            <button onClick={() => onPromoteNode(node.id)} disabled={!parentId} className={iconBtnDefault} title="提升层级 ←">
                                <i className="fa-solid fa-outdent" />
                            </button>
                            <button onClick={() => onDemoteNode(node.id)} disabled={!hasPrevSibling} className={iconBtnDefault} title="降低层级 →">
                                <i className="fa-solid fa-indent" />
                            </button>
                            <div className="w-px h-4 bg-slate-200 mx-0.5" />
                            <button onClick={() => onAddNode(node.id)} className={iconBtnDefault} title="添加子章节">
                                <i className="fa-solid fa-plus" />
                            </button>
                            {node.literatureIds.length >= 2 && (
                                <button onClick={() => { setSplitNodeId(node.id); setSplitSelection(new Set()); }} className={iconBtnDefault} title="拆分章节">
                                    <i className="fa-solid fa-scissors" />
                                </button>
                            )}
                            <button
                                onClick={() => setConfirmDeleteId(confirmDeleteId === node.id ? null : node.id)}
                                className={iconBtnDanger}
                                title="删除"
                            >
                                <i className="fa-solid fa-trash-can" />
                            </button>
                        </div>
                    </div>

                    {/* 删除确认 */}
                    {confirmDeleteId === node.id && (
                        <div className="mt-2 flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                            <span className="text-[10px] text-red-600 font-bold">确认删除此章节{node.children?.length ? `及 ${node.children.length} 个子章节` : ''}？</span>
                            <button onClick={() => { onRemoveNode(node.id); setConfirmDeleteId(null); }} className="px-2 py-1 bg-red-500 text-white rounded text-[9px] font-bold">删除</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-1 bg-white text-slate-500 rounded text-[9px] font-bold border border-slate-200">取消</button>
                        </div>
                    )}

                    {/* ─── 第二行: 元信息 + 展开按钮 ─── */}
                    <div className="flex items-center gap-2 mt-1.5 ml-8">
                        <span className="text-[9px] text-slate-400 font-bold">~{node.targetWords}字</span>
                        <span className="text-[9px] text-slate-300">·</span>
                        <button onClick={() => setLitExpandedId(isLitExpanded ? null : node.id)} className="text-[9px] text-indigo-400 font-bold hover:text-indigo-600 transition-colors">
                            📚 {node.literatureIds.length} 篇文献 {isLitExpanded ? '▾' : '▸'}
                        </button>
                        {node.suggestedFigure && (
                            <>
                                <span className="text-[9px] text-slate-300">·</span>
                                <span className="text-[9px] text-amber-500 font-medium">📊 {node.suggestedFigure.type}</span>
                            </>
                        )}
                        <span className="text-[9px] text-slate-300">·</span>
                        <button onClick={() => setExpandedId(isExpanded ? null : node.id)} className="text-[9px] text-slate-400 hover:text-indigo-500 transition-colors">
                            {isExpanded ? '收起详情 ▾' : '编辑详情 ▸'}
                        </button>
                    </div>

                    {/* ─── 展开区: 描述 + 目标字数编辑 ─── */}
                    <div className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'max-h-[200px] mt-3 ml-8' : 'max-h-0'}`}
                         style={{ opacity: isExpanded ? 1 : 0, pointerEvents: isExpanded ? 'auto' : 'none' }}>
                        <div className="space-y-2">
                            <div>
                                <label className="text-[9px] font-bold text-slate-400 mb-1 block">章节描述</label>
                                <textarea
                                    value={node.description}
                                    onChange={e => onUpdateNode(node.id, { description: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[11px] text-slate-600 resize-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300 transition-all bg-slate-50/50"
                                    rows={2}
                                    placeholder="描述此章节的内容范围..."
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-[9px] font-bold text-slate-400">目标字数</label>
                                <input
                                    type="number"
                                    value={node.targetWords}
                                    onChange={e => onUpdateNode(node.id, { targetWords: parseInt(e.target.value) || 0 })}
                                    className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-[11px] text-slate-600 font-bold text-center bg-slate-50/50 focus:ring-1 focus:ring-indigo-300"
                                    min={0}
                                    step={100}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ─── 展开区: 文献列表 + 文献重分配 ─── */}
                    <div className={`overflow-hidden transition-all duration-200 ${isLitExpanded ? 'max-h-[300px] mt-2 ml-8' : 'max-h-0'}`}
                         style={{ opacity: isLitExpanded ? 1 : 0, pointerEvents: isLitExpanded ? 'auto' : 'none' }}>
                        <div className="space-y-1 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
                            {node.literatureIds.length === 0 && (
                                <p className="text-[10px] text-slate-300 italic py-2">暂无关联文献</p>
                            )}
                            {node.literatureIds.map(litId => {
                                const lit = searchResults.find(r => r.id === litId);
                                return (
                                    <div key={litId} className="flex items-center gap-2 py-1 px-2 rounded-lg bg-slate-50/80 group/lit">
                                        <span className="text-[10px] text-slate-600 flex-1 min-w-0 truncate">
                                            {lit ? `${lit.title?.substring(0, 60)}...` : litId}
                                        </span>
                                        <select
                                            className="text-[9px] text-slate-400 bg-transparent border-none cursor-pointer opacity-0 group-hover/lit:opacity-100 transition-opacity w-20 flex-shrink-0"
                                            value=""
                                            onChange={e => {
                                                if (e.target.value) onReassignLiterature(litId, node.id, e.target.value);
                                                e.target.value = '';
                                            }}
                                        >
                                            <option value="">→ 移至</option>
                                            {allFlatNodes.filter(n => n.id !== node.id).map(n => (
                                                <option key={n.id} value={n.id}>{'  '.repeat(n.level - 1)}{n.title.substring(0, 20)}</option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 合并按钮: 与下一个同级节点之间 */}
                {hasNextSibling && (
                    <div className="flex items-center justify-center my-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ marginLeft: 8 }}>
                        <button
                            onClick={() => onMergeNodes(node.id, siblings[indexInSiblings + 1].id)}
                            className="px-2 py-0.5 rounded bg-amber-50 text-amber-500 text-[8px] font-bold hover:bg-amber-100 transition-colors border border-amber-200/50"
                            title={`合并「${node.title}」与「${siblings[indexInSiblings + 1].title}」`}
                        >
                            ↕ 合并
                        </button>
                    </div>
                )}

                {/* 子节点 */}
                {node.children?.map((child, ci) => renderNode(child, node.children!, ci, depth + 1, node.id))}
            </div>
        );
    };

    // 拆分弹窗
    const splitNode = splitNodeId ? allFlatNodes.find(n => n.id === splitNodeId) : null;

    return (
        <div className="max-w-2xl">
            <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-slate-500">编辑章节结构：调整顺序、层级、文献分配，或新增/删除/合并/拆分章节。</p>
                <button onClick={() => onAddNode()} className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-bold hover:bg-indigo-100 transition-colors flex-shrink-0">
                    + 添加顶级章节
                </button>
            </div>
            {outline.map((node, i) => renderNode(node, outline, i))}

            {/* ─── 拆分弹窗 ─── */}
            {splitNode && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[3000] flex items-center justify-center p-4" onClick={() => setSplitNodeId(null)}>
                    <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{ minHeight: 320, maxHeight: 420 }} onClick={e => e.stopPropagation()}>
                        <h4 className="text-sm font-black text-slate-800 mb-1">✂️ 拆分章节</h4>
                        <p className="text-[10px] text-slate-400 mb-4">选择要移到新章节的文献（勾选项将组成拆分后的新章节）</p>
                        <p className="text-xs font-bold text-indigo-600 mb-3">「{splitNode.title}」</p>
                        <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                            {splitNode.literatureIds.map(litId => {
                                const lit = searchResults.find(r => r.id === litId);
                                const isChecked = splitSelection.has(litId);
                                return (
                                    <label key={litId} className={`flex items-center gap-2 py-1.5 px-3 rounded-lg cursor-pointer transition-colors ${isChecked ? 'bg-indigo-50 border border-indigo-200' : 'bg-slate-50 border border-transparent hover:bg-slate-100'}`}>
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {
                                                const next = new Set(splitSelection);
                                                if (next.has(litId)) next.delete(litId); else next.add(litId);
                                                setSplitSelection(next);
                                            }}
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-300"
                                        />
                                        <span className="text-[10px] text-slate-600 truncate">{lit ? lit.title?.substring(0, 80) : litId}</span>
                                    </label>
                                );
                            })}
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <button onClick={() => setSplitNodeId(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">
                                取消
                            </button>
                            <button
                                onClick={() => {
                                    if (splitSelection.size > 0 && splitSelection.size < splitNode.literatureIds.length) {
                                        onSplitNode(splitNode.id, Array.from(splitSelection));
                                        setSplitNodeId(null);
                                    }
                                }}
                                disabled={splitSelection.size === 0 || splitSelection.size >= splitNode.literatureIds.length}
                                className="px-4 py-2 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                拆分 ({splitSelection.size}/{splitNode.literatureIds.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════
// Step 6: 逐节撰写
// ═══════════════════════════════════════════════════════════════════

const flattenOutline = (nodes: ReviewOutlineNode[]): ReviewOutlineNode[] => {
    const flat: ReviewOutlineNode[] = [];
    for (const node of nodes) {
        flat.push(node);
        if (node.children?.length) flat.push(...flattenOutline(node.children));
    }
    return flat;
};

// 纯前端 Diff 引擎（逐行 LCS）
const computeLineDiff = (oldText: string, newText: string): Array<{ type: 'same' | 'add' | 'remove'; text: string }> => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    // 简化 LCS
    const m = oldLines.length, n = newLines.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = oldLines[i - 1] === newLines[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }
    const result: Array<{ type: 'same' | 'add' | 'remove'; text: string }> = [];
    let i = m, j = n;
    const stack: typeof result = [];
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
            stack.push({ type: 'same', text: oldLines[i - 1] });
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            stack.push({ type: 'add', text: newLines[j - 1] });
            j--;
        } else {
            stack.push({ type: 'remove', text: oldLines[i - 1] });
            i--;
        }
    }
    while (stack.length) result.push(stack.pop()!);
    return result;
};

const WritingStep: React.FC<{
    outline: ReviewOutlineNode[];
    sections: Record<string, string>;
    onRegenerate: (id: string) => void;
    isRunning: boolean;
    contentHistory?: ContentSnapshot[];
    onRestoreSnapshot: (snapshotId: string) => void;
    onEditSection: (sectionId: string, newContent: string) => void;
    onAiEdit: (sectionId: string, selectedText: string, action: EditAction, instruction?: string) => Promise<void>;
    onIncrementalAudit: (sectionIds: string[]) => void;
    isAiEditing: boolean;
}> = ({ outline, sections, onRegenerate, isRunning, contentHistory, onRestoreSnapshot, onEditSection, onAiEdit, onIncrementalAudit, isAiEditing }) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const allSections = useMemo(() => flattenOutline(outline), [outline]);
    // 版本历史状态
    const [compareSnapId, setCompareSnapId] = useState<string | null>(null);
    const [showDiff, setShowDiff] = useState(false);
    // 编辑模式
    const [editMode, setEditMode] = useState(false);
    const [editDraft, setEditDraft] = useState('');
    const [hasEdited, setHasEdited] = useState(false);
    // AI 操作菜单
    const [aiMenuPos, setAiMenuPos] = useState<{ x: number; y: number } | null>(null);
    const [selectedText, setSelectedText] = useState('');
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customInstruction, setCustomInstruction] = useState('');
    const contentRef = useRef<HTMLTextAreaElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);

    if (allSections.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <span className="text-4xl mb-4">✍️</span>
                <p className="text-sm font-bold">点击"执行此步"逐节生成内容</p>
                <p className="text-xs mt-1">AI 将按大纲结构逐节撰写，结合关联文献和 RAG 知识库</p>
            </div>
        );
    }

    const statusColors: Record<string, string> = {
        pending: 'bg-slate-100 text-slate-400',
        generating: 'bg-blue-100 text-blue-500 animate-pulse',
        done: 'bg-emerald-100 text-emerald-600',
        error: 'bg-red-100 text-red-500'
    };

    const generated = Object.keys(sections).length;
    const total = allSections.length;

    // 字数统计
    const wordCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        let totalWords = 0;
        for (const node of allSections) {
            const text = sections[node.id] || '';
            const wc = text.replace(/\s+/g, '').length;
            counts[node.id] = wc;
            totalWords += wc;
        }
        return { counts, totalWords };
    }, [allSections, sections]);

    // Diff 计算
    const diffResult = useMemo(() => {
        if (!showDiff || !compareSnapId || !selectedId) return null;
        const snap = contentHistory?.find(s => s.id === compareSnapId);
        if (!snap) return null;
        const oldText = snap.sections[selectedId] || '';
        const newText = sections[selectedId] || '';
        if (oldText === newText) return 'identical';
        return computeLineDiff(oldText, newText);
    }, [showDiff, compareSnapId, selectedId, contentHistory, sections]);

    const triggerLabels: Record<string, string> = {
        auto_revision: '🔄 修订',
        multi_agent: '🤖 多Agent',
        polishing: '💎 润色',
        consistency: '🔗 一致性',
        regenerate: '♻️ 重生成'
    };

    return (
        <div className="flex gap-4 h-[55vh]">
            {/* 左侧：章节导航 */}
            <div className="w-64 flex-shrink-0 bg-white rounded-xl border border-slate-200 overflow-y-auto custom-scrollbar">
                <div className="p-3 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-slate-400">已生成 {generated}/{total} 节</p>
                        <p className="text-[10px] font-bold text-indigo-500">{wordCounts.totalWords.toLocaleString()} 字</p>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                        <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${total > 0 ? (generated / total) * 100 : 0}%` }} />
                    </div>
                </div>
                {allSections.map((node) => (
                    <button
                        key={node.id}
                        onClick={() => { setSelectedId(node.id); setShowDiff(false); }}
                        className={`w-full text-left px-3 py-2.5 border-b border-slate-50 hover:bg-slate-50 transition-colors flex items-center gap-2 ${selectedId === node.id ? 'bg-indigo-50' : ''}`}
                        style={{ paddingLeft: (node.level - 1) * 12 + 12 }}
                    >
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${statusColors[node.status]}`}>
                            {node.status === 'done' ? '✓' : node.status === 'generating' ? '◌' : node.status === 'error' ? '✗' : '○'}
                        </span>
                        <span className={`text-[11px] truncate flex-1 ${selectedId === node.id ? 'text-indigo-600 font-bold' : 'text-slate-600'}`}>{node.title}</span>
                        {wordCounts.counts[node.id] > 0 && (
                            <span className="text-[9px] text-slate-300 flex-shrink-0">{wordCounts.counts[node.id]}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* 右侧：预览 + 编辑 + 版本历史 */}
            <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                {selectedId && sections[selectedId] ? (
                    <>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                            <h4 className="text-xs font-bold text-slate-700 truncate flex-1">{allSections.find(s => s.id === selectedId)?.title}</h4>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                {/* 编辑/预览切换 */}
                                <button
                                    onClick={() => {
                                        if (!editMode) {
                                            setEditDraft(sections[selectedId]);
                                            setEditMode(true);
                                            setShowDiff(false);
                                        } else {
                                            if (editDraft !== sections[selectedId]) {
                                                onEditSection(selectedId, editDraft);
                                                setHasEdited(true);
                                            }
                                            setEditMode(false);
                                        }
                                    }}
                                    className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-colors ${
                                        editMode
                                            ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200/50'
                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                >
                                    {editMode ? '💾 保存' : '✏️ 编辑'}
                                </button>
                                {editMode && (
                                    <button
                                        onClick={() => { setEditMode(false); setEditDraft(''); }}
                                        className="px-2 py-1 rounded-lg bg-slate-100 text-slate-400 text-[9px] font-bold hover:bg-slate-200 transition-colors"
                                    >
                                        取消
                                    </button>
                                )}
                                {/* 增量审计 */}
                                {hasEdited && !editMode && !isRunning && (
                                    <button
                                        onClick={() => { onIncrementalAudit([selectedId]); setHasEdited(false); }}
                                        className="px-2 py-1 rounded-lg bg-violet-50 text-violet-600 text-[9px] font-bold hover:bg-violet-100 transition-colors border border-violet-200/50"
                                    >
                                        🔍 审计
                                    </button>
                                )}
                                {/* 版本历史下拉 */}
                                {!editMode && contentHistory && contentHistory.length > 0 && (
                                    <select
                                        value={compareSnapId || ''}
                                        onChange={e => { setCompareSnapId(e.target.value || null); setShowDiff(!!e.target.value); }}
                                        className="text-[9px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 max-w-[120px] cursor-pointer"
                                    >
                                        <option value="">📌 版本 ({contentHistory.length})</option>
                                        {[...contentHistory].reverse().map(snap => (
                                            <option key={snap.id} value={snap.id}>
                                                {triggerLabels[snap.trigger] || snap.trigger} {snap.label} ({new Date(snap.timestamp).toLocaleTimeString()})
                                            </option>
                                        ))}
                                    </select>
                                )}
                                {compareSnapId && (
                                    <button
                                        onClick={() => { onRestoreSnapshot(compareSnapId); setCompareSnapId(null); setShowDiff(false); }}
                                        className="px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[9px] font-bold hover:bg-amber-100 transition-colors border border-amber-200/50"
                                    >
                                        ⭯ 回滚
                                    </button>
                                )}
                                {showDiff && (
                                    <button
                                        onClick={() => setShowDiff(false)}
                                        className="px-2 py-1 rounded-lg bg-slate-100 text-slate-500 text-[9px] font-bold hover:bg-slate-200 transition-colors"
                                    >
                                        ✕
                                    </button>
                                )}
                                {!editMode && <CopyButton text={sections[selectedId]} />}
                                {!isRunning && !editMode && (
                                    <button onClick={() => onRegenerate(selectedId)} className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-500 text-[9px] font-bold hover:bg-indigo-100 transition-colors">
                                        🔄 重写
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                            {/* AI 编辑加载覆盖 */}
                            {isAiEditing && (
                                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex items-center justify-center">
                                    <div className="flex items-center gap-3 px-5 py-3 bg-indigo-50 rounded-xl border border-indigo-200/50">
                                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-xs font-bold text-indigo-600">AI 正在编辑...</span>
                                    </div>
                                </div>
                            )}

                            {editMode ? (
                                /* 编辑模式 */
                                <textarea
                                    ref={contentRef}
                                    value={editDraft}
                                    onChange={e => setEditDraft(e.target.value)}
                                    className="w-full h-full p-4 text-sm text-slate-700 leading-relaxed resize-none border-none outline-none bg-amber-50/20 font-mono"
                                    spellCheck={false}
                                />
                            ) : showDiff && diffResult ? (
                                /* Diff 视图 */
                                diffResult === 'identical' ? (
                                    <div className="flex items-center justify-center h-full text-slate-400 p-4">
                                        <p className="text-xs">✅ 此章节内容与快照完全一致，无差异</p>
                                    </div>
                                ) : (
                                    <div className="font-mono text-[11px] leading-relaxed p-4">
                                        {diffResult.map((line, idx) => (
                                            <div
                                                key={idx}
                                                className={`px-3 py-0.5 rounded-sm ${
                                                    line.type === 'add' ? 'bg-emerald-50 text-emerald-700 border-l-2 border-emerald-400' :
                                                    line.type === 'remove' ? 'bg-red-50 text-red-600 line-through border-l-2 border-red-400' :
                                                    'text-slate-500'
                                                }`}
                                            >
                                                <span className="inline-block w-5 text-[9px] text-slate-300 mr-2">
                                                    {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                                                </span>
                                                {line.text || '\u00A0'}
                                            </div>
                                        ))}
                                    </div>
                                )
                            ) : (
                                /* 预览模式 + AI 操作菜单 */
                                <div
                                    ref={previewRef}
                                    className="p-4 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap select-text"
                                    onMouseUp={() => {
                                        const sel = window.getSelection();
                                        const text = sel?.toString()?.trim();
                                        if (text && text.length > 2 && previewRef.current) {
                                            const range = sel!.getRangeAt(0);
                                            const rect = range.getBoundingClientRect();
                                            const containerRect = previewRef.current.getBoundingClientRect();
                                            setSelectedText(text);
                                            setAiMenuPos({
                                                x: rect.left - containerRect.left + rect.width / 2,
                                                y: rect.top - containerRect.top - 8
                                            });
                                            setShowCustomInput(false);
                                            setCustomInstruction('');
                                        } else {
                                            setAiMenuPos(null);
                                            setSelectedText('');
                                        }
                                    }}
                                >
                                    {sections[selectedId]}

                                    {/* AI 操作浮动菜单 */}
                                    {aiMenuPos && selectedText && !isAiEditing && (
                                        <div
                                            className="absolute z-30 flex flex-col items-center"
                                            style={{ left: aiMenuPos.x, top: aiMenuPos.y, transform: 'translate(-50%, -100%)' }}
                                        >
                                            <div className="bg-slate-800 rounded-xl px-1.5 py-1 flex items-center gap-0.5 shadow-xl border border-slate-700">
                                                {([
                                                    { action: 'rewrite' as EditAction, icon: '🔄', label: '改写' },
                                                    { action: 'expand' as EditAction, icon: '📝', label: '扩写' },
                                                    { action: 'compress' as EditAction, icon: '📐', label: '压缩' },
                                                    { action: 'add_citations' as EditAction, icon: '📚', label: '补引用' },
                                                ]).map(btn => (
                                                    <button
                                                        key={btn.action}
                                                        onClick={() => { onAiEdit(selectedId, selectedText, btn.action); setAiMenuPos(null); window.getSelection()?.removeAllRanges(); }}
                                                        className="px-2 py-1.5 text-[9px] text-white/90 hover:text-white hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
                                                        title={btn.label}
                                                    >
                                                        {btn.icon} {btn.label}
                                                    </button>
                                                ))}
                                                <button
                                                    onClick={() => setShowCustomInput(!showCustomInput)}
                                                    className={`px-2 py-1.5 text-[9px] rounded-lg transition-colors whitespace-nowrap ${showCustomInput ? 'text-amber-400 bg-slate-700' : 'text-white/90 hover:text-white hover:bg-slate-700'}`}
                                                    title="自定义指令"
                                                >
                                                    💬 指令
                                                </button>
                                                <button
                                                    onClick={() => { setAiMenuPos(null); window.getSelection()?.removeAllRanges(); }}
                                                    className="px-1.5 py-1.5 text-[9px] text-white/50 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                            {showCustomInput && (
                                                <div className="mt-1 bg-slate-800 rounded-xl px-3 py-2 shadow-xl border border-slate-700 w-72">
                                                    <input
                                                        type="text"
                                                        value={customInstruction}
                                                        onChange={e => setCustomInstruction(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter' && customInstruction.trim()) {
                                                                onAiEdit(selectedId, selectedText, 'custom', customInstruction.trim());
                                                                setAiMenuPos(null);
                                                                setShowCustomInput(false);
                                                                window.getSelection()?.removeAllRanges();
                                                            }
                                                        }}
                                                        placeholder="输入指令，如: 补充关于 MOF 的讨论"
                                                        className="w-full bg-slate-700 text-white text-[10px] px-3 py-1.5 rounded-lg border border-slate-600 outline-none placeholder:text-slate-400"
                                                        autoFocus
                                                    />
                                                    <div className="flex justify-end mt-1.5">
                                                        <button
                                                            onClick={() => {
                                                                if (customInstruction.trim()) {
                                                                    onAiEdit(selectedId, selectedText, 'custom', customInstruction.trim());
                                                                    setAiMenuPos(null);
                                                                    setShowCustomInput(false);
                                                                    window.getSelection()?.removeAllRanges();
                                                                }
                                                            }}
                                                            disabled={!customInstruction.trim()}
                                                            className="px-3 py-1 text-[9px] font-bold bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-40"
                                                        >
                                                            执行
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-300">
                        <p className="text-xs">← 选择章节查看内容</p>
                    </div>
                )}
            </div>
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════
// Step 7: 图表生成
// ═══════════════════════════════════════════════════════════════════

const FigureStep: React.FC<{
    figures?: Record<string, ReviewGeneratedFigure>;
    outline: ReviewOutlineNode[];
    attachedAssemblies?: Record<string, Array<{ assemblyId: string; caption: string }>>;
    onAttach?: (sectionId: string, assemblyId: string, caption: string) => void;
    onDetach?: (sectionId: string, assemblyId?: string) => void;
    reviewTopic?: string;
    language?: string;
    attachedTables?: Record<string, Array<{ tableId: string; table: { title: string; headers: string[]; rows: string[][]; note?: string } }>>;
    onAttachTable?: (sectionId: string, tableId: string, table: { title: string; headers: string[]; rows: string[][]; note?: string }) => void;
    onDetachTable?: (sectionId: string, tableId?: string) => void;
    attachedFormulas?: Record<string, Array<{ formulaId: string; formula: { title: string; content: string; type: 'math' | 'chem'; isBlock?: boolean } }>>;
    onAttachFormula?: (sectionId: string, formulaId: string, formula: { title: string; content: string; type: 'math' | 'chem'; isBlock?: boolean }) => void;
    onDetachFormula?: (sectionId: string, formulaId?: string) => void;
}> = ({ figures, outline, attachedAssemblies, onAttach, onDetach, reviewTopic, language,
        attachedTables, onAttachTable, onDetachTable, attachedFormulas, onAttachFormula, onDetachFormula }) => {
    const allNodes = useMemo(() => flattenOutline(outline), [outline]);
    const figurableNodes = allNodes.filter(n => n.suggestedFigure);
    const figureEntries = figures ? Object.values(figures) : [];
    const [showPicker, setShowPicker] = useState(false);
    const [pickerTarget, setPickerTarget] = useState<string | null>(null);
    const [savedAssemblies, setSavedAssemblies] = useState<SavedFigureAssembly[]>([]);
    const [generatingCaption, setGeneratingCaption] = useState<string | null>(null);

    // 表格/公式选择浮层
    const [showTablePicker, setShowTablePicker] = useState(false);
    const [tablePickerTarget, setTablePickerTarget] = useState<string | null>(null);
    const [showFormulaPicker, setShowFormulaPicker] = useState(false);
    const [formulaPickerTarget, setFormulaPickerTarget] = useState<string | null>(null);

    // 从项目上下文获取表格和公式
    let projectTables: ProjectTable[] = [];
    let projectFormulas: ProjectLatexSnippet[] = [];
    try {
        const ctx = useProjectContext();
        for (const p of ctx.projects) {
            if (p.tables?.length) projectTables.push(...p.tables);
            if (p.latexSnippets?.length) projectFormulas.push(...p.latexSnippets);
        }
    } catch { /* 外层可能无 Provider */ }

    // 同步状态
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<string | null>(null);

    // ★ 同步更新：从源头获取最新数据
    const handleSyncAll = useCallback(async () => {
        setIsSyncing(true);
        setSyncResult(null);
        let updated = 0;

        // 同步表格
        if (attachedTables && onAttachTable) {
            for (const [sectionId, list] of Object.entries(attachedTables)) {
                for (const info of list) {
                    const latest = projectTables.find(t => t.id === info.tableId);
                    if (latest && (latest.title !== info.table.title || JSON.stringify(latest.headers) !== JSON.stringify(info.table.headers) || JSON.stringify(latest.rows) !== JSON.stringify(info.table.rows))) {
                        onAttachTable(sectionId, latest.id, { title: latest.title, headers: latest.headers, rows: latest.rows, note: latest.note });
                        updated++;
                    }
                }
            }
        }

        // 同步公式
        if (attachedFormulas && onAttachFormula) {
            for (const [sectionId, list] of Object.entries(attachedFormulas)) {
                for (const info of list) {
                    const latest = projectFormulas.find(f => f.id === info.formulaId);
                    if (latest && (latest.content !== info.formula.content || latest.title !== info.formula.title)) {
                        onAttachFormula(sectionId, latest.id, { title: latest.title, content: latest.content, type: latest.type, isBlock: latest.isBlock });
                        updated++;
                    }
                }
            }
        }

        // 同步组图（重新渲染图片）
        if (attachedAssemblies && onAttach) {
            try {
                const savedStr = localStorage.getItem('sciflow_figure_assemblies');
                const allAssemblies: SavedFigureAssembly[] = savedStr ? JSON.parse(savedStr) : [];
                for (const [, list] of Object.entries(attachedAssemblies)) {
                    for (const info of list) {
                        const latest = allAssemblies.find(a => a.id === info.assemblyId);
                        if (latest) {
                            try {
                                await renderAssemblyToImage(latest, 2);
                                updated++;
                            } catch { /* 渲染失败无影响 */ }
                        }
                    }
                }
            } catch { /* localStorage 读取失败 */ }
        }

        setSyncResult(updated > 0 ? `已同步 ${updated} 项` : '已是最新');
        setIsSyncing(false);
        setTimeout(() => setSyncResult(null), 3000);
    }, [attachedTables, attachedFormulas, attachedAssemblies, projectTables, projectFormulas, onAttachTable, onAttachFormula, onAttach]);

    // 从 localStorage 加载组图方案
    useEffect(() => {
        try {
            const str = localStorage.getItem('sciflow_figure_assemblies');
            if (str) setSavedAssemblies(JSON.parse(str));
        } catch { /* 忽略 */ }
    }, [showPicker]);

    const handleOpenPicker = useCallback((sectionId: string) => {
        setPickerTarget(sectionId);
        setShowPicker(true);
    }, []);

    // ★ 挂载组图：先用简单 caption 快速响应，然后异步调 AI 生成学术图注
    const handleSelectAssembly = useCallback(async (assembly: SavedFigureAssembly) => {
        if (!pickerTarget || !onAttach) return;
        const fallbackParts = assembly.panels.map(p => {
            const label = p.label || '';
            const src = p.sourceRef;
            if (src?.title) {
                const page = src.page ? `, P.${src.page}` : '';
                return `${label} ${src.title}${page}`;
            }
            return label;
        }).filter(Boolean);
        const fallbackCaption = `Figure. ${fallbackParts.join('; ') || assembly.title}`;
        onAttach(pickerTarget, assembly.id, fallbackCaption);
        setShowPicker(false);
        const targetSection = pickerTarget;
        setPickerTarget(null);
        if (reviewTopic) {
            setGeneratingCaption(targetSection);
            try {
                const panelInfos = assembly.panels.map(p => ({
                    label: p.label || '',
                    sourceTitle: p.sourceRef?.title,
                    sourcePage: p.sourceRef?.page,
                    sourceType: p.sourceRef?.type
                }));
                const sectionNode = allNodes.find(n => n.id === targetSection);
                const aiCaption = await generateCompositeFigureCaption(
                    panelInfos, sectionNode?.title || '', reviewTopic,
                    (language as 'zh' | 'en') || 'zh'
                );
                if (aiCaption) onAttach(targetSection, assembly.id, aiCaption);
            } catch { /* fallback */ }
            finally { setGeneratingCaption(null); }
        }
    }, [pickerTarget, onAttach, reviewTopic, language, allNodes]);

    // ★ 重新生成图注
    const handleRegenerateCaption = useCallback(async (sectionId: string) => {
        const attachedList = attachedAssemblies?.[sectionId];
        if (!attachedList?.length || !reviewTopic || !onAttach) return;
        const attached = attachedList[0]; // 重新生成第一个组图的图注
        setGeneratingCaption(sectionId);
        try {
            const savedStr = localStorage.getItem('sciflow_figure_assemblies');
            const allAssemblies: SavedFigureAssembly[] = savedStr ? JSON.parse(savedStr) : [];
            const assembly = allAssemblies.find(a => a.id === attached.assemblyId);
            if (!assembly) return;
            const panelInfos = assembly.panels.map(p => ({
                label: p.label || '',
                sourceTitle: p.sourceRef?.title,
                sourcePage: p.sourceRef?.page,
                sourceType: p.sourceRef?.type
            }));
            const sectionNode = allNodes.find(n => n.id === sectionId);
            const aiCaption = await generateCompositeFigureCaption(
                panelInfos, sectionNode?.title || '', reviewTopic,
                (language as 'zh' | 'en') || 'zh'
            );
            if (aiCaption) onAttach(sectionId, attached.assemblyId, aiCaption);
        } catch { /* ignore */ }
        finally { setGeneratingCaption(null); }
    }, [attachedAssemblies, reviewTopic, language, onAttach, allNodes]);

    // 检查空状态
    const attachedCount = attachedAssemblies ? Object.keys(attachedAssemblies).length : 0;

    if (figurableNodes.length === 0 && figureEntries.length === 0 && attachedCount === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <span className="text-4xl mb-4">📈</span>
                <p className="text-sm font-bold">点击"执行此步"自动生成图表</p>
                <p className="text-xs mt-1">AI 将根据大纲中的图表建议生成对比表、趋势图和机理描述</p>
                {allNodes.length > 0 && (
                    <button
                        onClick={() => handleOpenPicker(allNodes[0].id)}
                        className="mt-6 px-5 py-2.5 bg-orange-50 text-orange-600 border border-orange-200 rounded-xl text-xs font-bold hover:bg-orange-100 transition-all flex items-center gap-2"
                    >
                        <i className="fa-solid fa-paperclip" /> 挂载已有组图
                    </button>
                )}
            </div>
        );
    }

    if (figureEntries.length === 0 && attachedCount === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <span className="text-4xl mb-4">📈</span>
                <p className="text-sm font-bold">发现 {figurableNodes.length} 个图表建议</p>
                <p className="text-xs mt-1">点击"执行此步"开始生成</p>
                <div className="mt-6 space-y-2 max-w-md">
                    {figurableNodes.map(node => (
                        <div key={node.id} className="flex items-center gap-2 bg-white rounded-lg border border-slate-100 px-3 py-2">
                            <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded">{node.suggestedFigure!.type}</span>
                            <span className="text-xs text-slate-600 truncate">{node.title}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // 图表类型图标/标签
    const typeIcons: Record<string, string> = {
        comparison_table: '📊', trend_chart: '📈', description: '🎨',
        sankey_chart: '🌊', timeline_chart: '⏳', structural_diagram: '🔬',
        summary_infographic: '🎯', composite_figure: '🖼️'
    };
    const typeLabels: Record<string, string> = {
        comparison_table: '性能对比表', trend_chart: '研究趋势图', description: '图表描述',
        sankey_chart: '桑基图', timeline_chart: '时间线', structural_diagram: '结构图',
        summary_infographic: '信息图', composite_figure: '文献组图'
    };
    const typeBadge: Record<string, { bg: string; label: string }> = {
        comparison_table: { bg: 'bg-blue-50 text-blue-600', label: 'TABLE' },
        trend_chart: { bg: 'bg-purple-50 text-purple-600', label: 'TREND' },
        composite_figure: { bg: 'bg-orange-50 text-orange-600', label: 'COMPOSITE' },
        sankey_chart: { bg: 'bg-teal-50 text-teal-600', label: 'SANKEY' },
        timeline_chart: { bg: 'bg-sky-50 text-sky-600', label: 'TIMELINE' },
        structural_diagram: { bg: 'bg-rose-50 text-rose-600', label: 'DIAGRAM' },
        summary_infographic: { bg: 'bg-cyan-50 text-cyan-600', label: 'INFOGRAPHIC' },
    };

    return (
        <div className="space-y-4 max-w-2xl">
            <div className="flex items-center gap-3 mb-2">
                <div className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold">
                    已生成 {figureEntries.length} 张图表
                </div>
                {/* 挂载组图按钮 */}
                {allNodes.length > 0 && (
                    <button
                        onClick={() => handleOpenPicker(allNodes[0].id)}
                        className="px-3 py-1.5 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg text-xs font-bold hover:bg-orange-100 transition-all flex items-center gap-1.5"
                    >
                        <i className="fa-solid fa-paperclip text-[10px]" /> 挂载组图
                    </button>
                )}
                {/* 同步更新按钮 */}
                <button
                    onClick={handleSyncAll}
                    disabled={isSyncing}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        syncResult
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : 'bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-100'
                    } ${isSyncing ? 'opacity-60 cursor-wait' : ''}`}
                >
                    <i className={`fa-solid ${isSyncing ? 'fa-spinner fa-spin' : syncResult ? 'fa-check' : 'fa-arrows-rotate'} text-[10px]`} />
                    {isSyncing ? '同步中...' : syncResult || '同步更新'}
                </button>
            </div>

            {figureEntries.map((fig, idx) => {
                const badge = typeBadge[fig.figureType] || { bg: 'bg-amber-50 text-amber-600', label: 'FIGURE' };
                return (
                    <div key={fig.sectionId || idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-sm transition-all">
                        {/* 卡片头部 */}
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <span className="text-base">{typeIcons[fig.figureType] || '📊'}</span>
                                <div>
                                    <p className="text-xs font-bold text-slate-700">{fig.sectionTitle}</p>
                                    <p className="text-[10px] text-slate-400">{typeLabels[fig.figureType] || fig.figureType}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${badge.bg}`}>{badge.label}</span>
                                {/* 组图类型：取消挂载按钮 */}
                                {fig.figureType === 'composite_figure' && onDetach && (
                                    <button
                                        onClick={() => onDetach(fig.sectionId)}
                                        className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                                        title="取消挂载"
                                    >
                                        <i className="fa-solid fa-xmark" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* 卡片内容 */}
                        <div className="p-4">
                            {fig.figureType === 'comparison_table' && fig.headers.length > 0 && (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[11px] border-collapse">
                                        <thead>
                                            <tr>
                                                {fig.headers.map((h, hi) => (
                                                    <th key={hi} className="px-3 py-2 bg-indigo-50 text-indigo-700 font-bold text-left border border-indigo-100 whitespace-nowrap">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fig.rows.map((row, ri) => (
                                                <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                                    {row.map((cell, ci) => (
                                                        <td key={ci} className="px-3 py-2 text-slate-600 border border-slate-100">{cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {fig.figureType === 'trend_chart' && (() => {
                                const entries = Object.entries(fig.yearDistribution).sort(([a], [b]) => a.localeCompare(b));
                                const maxCount = Math.max(...entries.map(([, c]) => c), 1);
                                return (
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">年份分布</p>
                                            <div className="space-y-1.5">
                                                {entries.map(([year, count]) => (
                                                    <div key={year} className="flex items-center gap-2">
                                                        <span className="text-[10px] text-slate-500 w-10 text-right font-mono">{year}</span>
                                                        <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full transition-all duration-500 flex items-center justify-end pr-1.5"
                                                                style={{ width: `${Math.max((count / maxCount) * 100, 8)}%` }}
                                                            >
                                                                <span className="text-[8px] text-white font-bold">{count}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        {fig.topJournals.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">高频期刊 TOP {Math.min(5, fig.topJournals.length)}</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {fig.topJournals.slice(0, 5).map((j, ji) => (
                                                        <span key={ji} className="px-2.5 py-1 bg-purple-50 text-purple-600 rounded-lg text-[10px] font-bold">
                                                            {j.name} ({j.count})
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {fig.summary && (
                                            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">{fig.summary}</p>
                                        )}
                                    </div>
                                );
                            })()}

                            {fig.figureType === 'description' && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[9px] font-bold">{fig.suggestedType}</span>
                                        <CopyButton text={fig.markdownContent} />
                                    </div>
                                    <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap max-h-[40vh] overflow-y-auto custom-scrollbar bg-slate-50 rounded-lg p-4 border border-slate-100">
                                        {fig.markdownContent}
                                    </div>
                                </div>
                            )}

                            {/* ★ 组图卡片渲染 */}
                            {fig.figureType === 'composite_figure' && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white shadow-md">
                                            <i className="fa-solid fa-images text-sm" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-slate-700 truncate">{fig.assemblyTitle}</p>
                                            <p className="text-[9px] text-slate-400">来自科研绘图中心 · 组图画布</p>
                                        </div>
                                    </div>
                                    {/* AI 学术图注 */}
                                    <div className="bg-orange-50/50 border border-orange-100 rounded-xl px-4 py-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-[9px] font-bold text-orange-500 uppercase tracking-wider">
                                                <i className="fa-solid fa-pen-nib mr-1" />
                                                {generatingCaption === fig.sectionId ? 'AI 生成中...' : 'AI 学术图注'}
                                            </p>
                                            {reviewTopic && (
                                                <button
                                                    onClick={() => handleRegenerateCaption(fig.sectionId)}
                                                    disabled={generatingCaption === fig.sectionId}
                                                    className="text-[9px] text-orange-400 hover:text-orange-600 transition-colors disabled:opacity-50"
                                                    title="AI 重新生成图注"
                                                >
                                                    {generatingCaption === fig.sectionId ? (
                                                        <i className="fa-solid fa-spinner fa-spin" />
                                                    ) : (
                                                        <><i className="fa-solid fa-rotate" /> 重新生成</>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                        <p className={`text-[11px] text-slate-700 leading-relaxed italic ${generatingCaption === fig.sectionId ? 'animate-pulse' : ''}`}>{fig.caption}</p>
                                    </div>
                                </div>
                            )}

                            {fig.description && (
                                <p className="text-[10px] text-slate-400 mt-3 italic">{fig.description}</p>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* ─── 各章节挂载组图入口 ─── */}
            {allNodes.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                        <i className="fa-solid fa-paperclip mr-1" />为章节挂载文献组图
                    </p>
                    <div className="space-y-1.5">
                        {allNodes.map(node => {
                            const attachedList = attachedAssemblies?.[node.id] || [];
                            const existingFig = figures?.[node.id];
                            return (
                                <div key={node.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                                    <span className="text-xs text-slate-600 truncate flex-1">{node.title}</span>
                                    {attachedList.length > 0 ? (
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {attachedList.map((a, i) => (
                                                <span key={a.assemblyId} className="inline-flex items-center gap-0.5 text-[9px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded">
                                                    <i className="fa-solid fa-check mr-0.5" />#{i + 1}
                                                    <button
                                                        onClick={() => onDetach?.(node.id, a.assemblyId)}
                                                        className="ml-0.5 text-[7px] text-slate-400 hover:text-rose-500 transition-all"
                                                    >
                                                        <i className="fa-solid fa-xmark" />
                                                    </button>
                                                </span>
                                            ))}
                                            <button
                                                onClick={() => handleOpenPicker(node.id)}
                                                className="w-5 h-5 rounded flex items-center justify-center text-[8px] text-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-all"
                                                title="继续添加"
                                            >
                                                <i className="fa-solid fa-plus" />
                                            </button>
                                        </div>
                                    ) : existingFig?.figureType === 'composite_figure' ? (
                                        <span className="text-[9px] text-emerald-500 font-bold">✓ 已生成</span>
                                    ) : (
                                        <button
                                            onClick={() => handleOpenPicker(node.id)}
                                            className="px-2.5 py-1 bg-white text-slate-500 border border-slate-200 rounded-lg text-[9px] font-bold hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition-all flex items-center gap-1"
                                        >
                                            <i className="fa-solid fa-plus text-[7px]" /> 挂载
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ─── 组图方案选择浮层 ─── */}
            {showPicker && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[999] flex items-center justify-center" onClick={() => setShowPicker(false)}>
                    <div
                        className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden w-[480px] max-h-[70vh] flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 bg-slate-900 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-rose-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                                    <i className="fa-solid fa-images text-sm" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase tracking-wide">选择组图方案</h3>
                                    <p className="text-[9px] text-slate-400">从科研绘图中心的已保存组图中选择</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                            {savedAssemblies.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                    <i className="fa-solid fa-images text-3xl mb-3 opacity-20" />
                                    <p className="text-xs font-bold">暂无已保存的组图方案</p>
                                    <p className="text-[10px] mt-1">请先在科研绘图中心 → 组图画布中创建并保存</p>
                                </div>
                            ) : (
                                savedAssemblies.map(asm => (
                                    <button
                                        key={asm.id}
                                        onClick={() => handleSelectAssembly(asm)}
                                        className="w-full text-left bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-300 rounded-xl p-4 transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* 缩略预览：显示第一张面板缩略图 */}
                                            {asm.panels[0]?.imgUrl ? (
                                                <div className="w-16 h-12 rounded-lg overflow-hidden bg-white border border-slate-200 shadow-inner shrink-0">
                                                    <img src={asm.panels[0].imgUrl} alt="" className="w-full h-full object-cover" />
                                                </div>
                                            ) : (
                                                <div className="w-16 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 shrink-0">
                                                    <i className="fa-solid fa-image text-lg" />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black text-slate-700 group-hover:text-orange-700 truncate transition-colors">{asm.title}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[9px] text-slate-400">
                                                        {asm.panels.length} 个面板 · {asm.layoutConfig.rows}×{asm.layoutConfig.cols}
                                                    </span>
                                                    <span className="text-[8px] text-slate-300">{asm.timestamp}</span>
                                                </div>
                                                {/* 面板标签预览 */}
                                                <div className="flex gap-1 mt-1.5">
                                                    {asm.panels.slice(0, 6).map(p => (
                                                        <span key={p.id} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[8px] font-bold text-slate-500">
                                                            {p.label || '?'}
                                                        </span>
                                                    ))}
                                                    {asm.panels.length > 6 && (
                                                        <span className="text-[8px] text-slate-300">+{asm.panels.length - 6}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <i className="fa-solid fa-chevron-right text-xs text-slate-300 group-hover:text-orange-500 transition-colors shrink-0" />
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end">
                            <button
                                onClick={() => setShowPicker(false)}
                                className="px-4 py-2 bg-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ─── 各章节挂载表格和公式入口 ─── */}
            {allNodes.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                        <i className="fa-solid fa-table-cells mr-1" />为章节挂载表格 / 公式
                    </p>
                    <div className="space-y-1.5">
                        {allNodes.map(node => {
                            const tList = attachedTables?.[node.id] || [];
                            const fList = attachedFormulas?.[node.id] || [];
                            return (
                                <div key={`tf-${node.id}`} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 flex-wrap">
                                    <span className="text-xs text-slate-600 truncate flex-1">{node.title}</span>
                                    {/* 表格标签 */}
                                    {tList.map(t => (
                                        <span key={t.tableId} className="inline-flex items-center gap-0.5 text-[9px] font-bold text-teal-500 bg-teal-50 px-2 py-0.5 rounded">
                                            <i className="fa-solid fa-table mr-0.5" />{t.table.title || 'Table'}
                                            <button
                                                onClick={() => onDetachTable?.(node.id, t.tableId)}
                                                className="ml-0.5 text-[7px] text-slate-400 hover:text-rose-500 transition-all"
                                            >
                                                <i className="fa-solid fa-xmark" />
                                            </button>
                                        </span>
                                    ))}
                                    <button
                                        onClick={() => { setTablePickerTarget(node.id); setShowTablePicker(true); }}
                                        className="px-2 py-0.5 bg-white text-teal-500 border border-teal-200 rounded text-[8px] font-bold hover:bg-teal-50 transition-all"
                                    >
                                        <i className="fa-solid fa-table mr-0.5" />+表格
                                    </button>
                                    {/* 公式标签 */}
                                    {fList.map(f => (
                                        <span key={f.formulaId} className="inline-flex items-center gap-0.5 text-[9px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">
                                            <i className="fa-solid fa-square-root-variable mr-0.5" />{f.formula.title || 'Formula'}
                                            <button
                                                onClick={() => onDetachFormula?.(node.id, f.formulaId)}
                                                className="ml-0.5 text-[7px] text-slate-400 hover:text-rose-500 transition-all"
                                            >
                                                <i className="fa-solid fa-xmark" />
                                            </button>
                                        </span>
                                    ))}
                                    <button
                                        onClick={() => { setFormulaPickerTarget(node.id); setShowFormulaPicker(true); }}
                                        className="px-2 py-0.5 bg-white text-indigo-500 border border-indigo-200 rounded text-[8px] font-bold hover:bg-indigo-50 transition-all"
                                    >
                                        <i className="fa-solid fa-square-root-variable mr-0.5" />+公式
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ─── 表格选择浮层 ─── */}
            {showTablePicker && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[999] flex items-center justify-center" onClick={() => setShowTablePicker(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden w-[420px] max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 bg-teal-600 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-white">
                                    <i className="fa-solid fa-table text-sm" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase">选择表格</h3>
                                    <p className="text-[9px] text-teal-100">从写作工坊的已保存表格中选择</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                            {projectTables.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                                    <i className="fa-solid fa-table text-2xl mb-3 opacity-20" />
                                    <p className="text-xs font-bold">暂无已保存的表格</p>
                                    <p className="text-[10px] mt-1">请先在写作工坊中创建并保存表格</p>
                                </div>
                            ) : (
                                projectTables.map(tbl => (
                                    <button
                                        key={tbl.id}
                                        onClick={() => {
                                            if (tablePickerTarget && onAttachTable) {
                                                onAttachTable(tablePickerTarget, tbl.id, { title: tbl.title, headers: tbl.headers, rows: tbl.rows, note: tbl.note });
                                            }
                                            setShowTablePicker(false);
                                            setTablePickerTarget(null);
                                        }}
                                        className="w-full text-left bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-xl p-3 transition-all group"
                                    >
                                        <p className="text-xs font-black text-slate-700 group-hover:text-teal-700 truncate">{tbl.title}</p>
                                        <p className="text-[9px] text-slate-400 mt-0.5">{tbl.headers.length} 列 · {tbl.rows.length} 行</p>
                                    </button>
                                ))
                            )}
                        </div>
                        <div className="px-5 py-3 border-t bg-slate-50 shrink-0 flex justify-end">
                            <button onClick={() => setShowTablePicker(false)} className="px-4 py-2 bg-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all">取消</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── 公式选择浮层 ─── */}
            {showFormulaPicker && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[999] flex items-center justify-center" onClick={() => setShowFormulaPicker(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden w-[420px] max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 bg-indigo-600 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-white">
                                    <i className="fa-solid fa-square-root-variable text-sm" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase">选择公式</h3>
                                    <p className="text-[9px] text-indigo-100">从写作工坊的已保存公式中选择</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                            {projectFormulas.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                                    <i className="fa-solid fa-square-root-variable text-2xl mb-3 opacity-20" />
                                    <p className="text-xs font-bold">暂无已保存的公式</p>
                                    <p className="text-[10px] mt-1">请先在写作工坊中创建并保存公式</p>
                                </div>
                            ) : (
                                projectFormulas.map(frm => (
                                    <button
                                        key={frm.id}
                                        onClick={() => {
                                            if (formulaPickerTarget && onAttachFormula) {
                                                onAttachFormula(formulaPickerTarget, frm.id, { title: frm.title, content: frm.content, type: frm.type, isBlock: frm.isBlock });
                                            }
                                            setShowFormulaPicker(false);
                                            setFormulaPickerTarget(null);
                                        }}
                                        className="w-full text-left bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-xl p-3 transition-all group"
                                    >
                                        <p className="text-xs font-black text-slate-700 group-hover:text-indigo-700 truncate">{frm.title}</p>
                                        <p className="text-[9px] text-slate-400 mt-0.5 font-mono truncate">{frm.content.substring(0, 60)}{frm.content.length > 60 ? '...' : ''}</p>
                                    </button>
                                ))
                            )}
                        </div>
                        <div className="px-5 py-3 border-t bg-slate-50 shrink-0 flex justify-end">
                            <button onClick={() => setShowFormulaPicker(false)} className="px-4 py-2 bg-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all">取消</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════
// Step 8: 交叉审计
// ═══════════════════════════════════════════════════════════════════

const AuditStep: React.FC<{
    auditReport?: string;
    revisionHistory?: RevisionRound[];
    onAutoRevise?: () => void;
    isRunning?: boolean;
}> = ({ auditReport, revisionHistory, onAutoRevise, isRunning }) => {
    const hasHistory = revisionHistory && revisionHistory.length > 0;

    if (!auditReport && !hasHistory) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <span className="text-4xl mb-4">🔎</span>
                <p className="text-sm font-bold">点击"执行此步"进行全文审计</p>
                <p className="text-xs mt-1">AI 将检查引用一致性、逻辑连贯性、术语统一性和覆盖度</p>
                <p className="text-[10px] mt-3 text-slate-300">审计后可自动修订：AI 根据审计反馈迭代修改章节</p>
            </div>
        );
    }

    // 评分颜色
    const scoreColor = (score: number) =>
        score >= 80 ? 'text-emerald-600 bg-emerald-50' :
        score >= 60 ? 'text-amber-600 bg-amber-50' :
        'text-red-600 bg-red-50';

    return (
        <div className="space-y-4 max-w-2xl">
            {/* ─── 修订历史时间线 ─── */}
            {hasHistory && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <span>🔄</span> 修订历史
                            <span className="text-[10px] text-slate-400 font-normal">({revisionHistory!.length} 轮)</span>
                        </h4>
                        {/* 最终评分 */}
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${scoreColor(revisionHistory![revisionHistory!.length - 1].score)}`}>
                            最终评分: {revisionHistory![revisionHistory!.length - 1].score}
                        </span>
                    </div>

                    {/* 评分变化条 */}
                    <div className="flex items-end gap-1 mb-4 h-12">
                        {revisionHistory!.map((r, i) => {
                            const height = Math.max(r.score, 10);
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-[8px] font-bold text-slate-500">{r.score}</span>
                                    <div
                                        className={`w-full rounded-t transition-all duration-500 ${
                                            r.score >= 80 ? 'bg-emerald-400' : r.score >= 60 ? 'bg-amber-400' : 'bg-red-400'
                                        }`}
                                        style={{ height: `${height * 0.4}px` }}
                                    />
                                    <span className="text-[8px] text-slate-400">R{r.round}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* 每轮修订详情 */}
                    <div className="space-y-2">
                        {revisionHistory!.map((r, i) => (
                            <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50/50 border border-slate-100">
                                <div className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                    r.criticalCount === 0 && r.score >= 80 ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'
                                }`}>
                                    {r.round}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${scoreColor(r.score)}`}>{r.score}分</span>
                                        {r.criticalCount > 0 && <span className="text-[9px] text-red-500 font-bold">🔴×{r.criticalCount}</span>}
                                        {r.moderateCount > 0 && <span className="text-[9px] text-amber-500 font-bold">🟡×{r.moderateCount}</span>}
                                    </div>
                                    {r.revisedSections.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            {r.revisedSections.map((s, si) => (
                                                <span key={si} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-medium">{s}</span>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{r.summary}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── 自动修订按钮 ─── */}
            {auditReport && !isRunning && (
                <button
                    onClick={onAutoRevise}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-bold hover:from-indigo-600 hover:to-purple-600 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                >
                    <span>🔄</span> 启动自动修订（Agent Loop）
                    <span className="text-[10px] opacity-80">最多 3 轮</span>
                </button>
            )}

            {/* ─── 审计报告 ─── */}
            {auditReport && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <span>📋</span> {hasHistory ? '最终审计报告' : '审计报告'}
                        </h4>
                        <CopyButton text={auditReport} />
                    </div>
                    <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap max-h-[50vh] overflow-y-auto custom-scrollbar">
                        {auditReport}
                    </div>
                </div>
            )}
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════
// 质量仪表盘
// ═══════════════════════════════════════════════════════════════════

const QualityDashboard: React.FC<{ metrics: ReviewQualityMetrics }> = ({ metrics }) => {
    const scoreColor = metrics.qualityScore >= 80 ? 'text-emerald-600' :
        metrics.qualityScore >= 60 ? 'text-amber-600' : 'text-red-600';
    const scoreBg = metrics.qualityScore >= 80 ? 'bg-emerald-50' :
        metrics.qualityScore >= 60 ? 'bg-amber-50' : 'bg-red-50';

    const maxWords = Math.max(...metrics.sections.map(s => Math.max(s.wordCount, s.targetWords)), 1);
    const maxCitations = Math.max(...metrics.sections.map(s => s.citationCount), 1);

    return (
        <div className="space-y-4">
            {/* ─── 概览卡片行 ─── */}
            <div className="grid grid-cols-5 gap-2">
                <div className={`${scoreBg} rounded-xl p-3 text-center`}>
                    <p className={`text-lg font-black ${scoreColor}`}>{metrics.qualityScore}</p>
                    <p className="text-[9px] text-slate-500 font-bold mt-0.5">综合评分</p>
                </div>
                {[{ label: '总字数', value: metrics.totalWords.toLocaleString(), icon: '📝' },
                  { label: '总段落', value: metrics.totalParagraphs, icon: '📄' },
                  { label: '总引用', value: metrics.totalCitations, icon: '🔗' },
                  { label: '引用密度', value: `${metrics.avgCitationDensity}/千字`, icon: '📊' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-xl border border-slate-100 p-3 text-center">
                        <p className="text-xs font-black text-slate-700">{stat.value}</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">{stat.icon} {stat.label}</p>
                    </div>
                ))}
            </div>

            {/* ─── 章节字数对比图 ─── */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">📏 章节字数 vs 目标</h4>
                <div className="space-y-2">
                    {metrics.sections.map(s => {
                        const actualPct = (s.wordCount / maxWords) * 100;
                        const targetPct = s.targetWords > 0 ? (s.targetWords / maxWords) * 100 : 0;
                        const ratio = s.targetWords > 0 ? s.wordCount / s.targetWords : 1;
                        const barColor = ratio >= 0.9 && ratio <= 1.3 ? 'from-emerald-400 to-emerald-500' :
                            ratio < 0.7 ? 'from-red-400 to-red-500' :
                            ratio > 1.5 ? 'from-amber-400 to-amber-500' : 'from-blue-400 to-blue-500';

                        return (
                            <div key={s.id} className="flex items-center gap-2">
                                <span className="text-[9px] text-slate-500 w-20 text-right truncate" title={s.title}>{s.title}</span>
                                <div className="flex-1 relative h-5 bg-slate-50 rounded overflow-hidden">
                                    {targetPct > 0 && (
                                        <div className="absolute top-0 bottom-0 w-px bg-slate-300 z-10" style={{ left: `${targetPct}%` }} />
                                    )}
                                    <div
                                        className={`h-full bg-gradient-to-r ${barColor} rounded transition-all duration-500 flex items-center justify-end pr-1.5`}
                                        style={{ width: `${Math.max(actualPct, 3)}%` }}
                                    >
                                        <span className="text-[7px] text-white font-bold">{s.wordCount}</span>
                                    </div>
                                </div>
                                {s.targetWords > 0 && (
                                    <span className={`text-[8px] font-bold w-10 ${ratio >= 0.7 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {Math.round(ratio * 100)}%
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="flex items-center gap-4 mt-2 text-[8px] text-slate-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-400" /> 达标</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-400" /> 偏多</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-400" /> 不足</span>
                    <span className="flex items-center gap-1"><span className="w-px h-3 bg-slate-300" /> 目标线</span>
                </div>
            </div>

            {/* ─── 引用密度热力图 ─── */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">🔗 引用密度</h4>
                <div className="space-y-1.5">
                    {metrics.sections.map(s => {
                        const intensity = Math.min(s.citationCount / maxCitations, 1);
                        return (
                            <div key={s.id} className="flex items-center gap-2">
                                <span className="text-[9px] text-slate-500 w-20 text-right truncate" title={s.title}>{s.title}</span>
                                <div className="flex-1 h-4 bg-slate-50 rounded overflow-hidden">
                                    <div
                                        className="h-full rounded transition-all duration-500"
                                        style={{
                                            width: `${Math.max(intensity * 100, 3)}%`,
                                            background: `linear-gradient(to right, rgba(99,102,241,${0.3 + intensity * 0.7}), rgba(139,92,246,${0.3 + intensity * 0.7}))`
                                        }}
                                    />
                                </div>
                                <div className="flex items-center gap-1.5 w-16">
                                    <span className="text-[9px] font-bold text-indigo-600">{s.citationCount}</span>
                                    {s.uncitedParagraphs > 0 && (
                                        <span className="text-[8px] text-red-500 font-bold" title={`${s.uncitedParagraphs} 个段落缺少引用`}>⚠{s.uncitedParagraphs}</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ─── 段落问题 + 高频术语 ─── */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">📝 段落质量</h4>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500">平均段落长度</span>
                            <span className="text-xs font-bold text-slate-700">
                                {metrics.totalParagraphs > 0 ? Math.round(metrics.totalWords / metrics.totalParagraphs) : 0} 字
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500">平均句长</span>
                            <span className="text-xs font-bold text-slate-700">{metrics.avgSentenceLength} 字</span>
                        </div>
                        {metrics.totalLongParagraphs > 0 && (
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-amber-600">⚠ 过长段落 (&gt;300字)</span>
                                <span className="text-xs font-bold text-amber-600">{metrics.totalLongParagraphs}</span>
                            </div>
                        )}
                        {metrics.totalShortParagraphs > 0 && (
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-amber-600">⚠ 过短段落 (&lt;50字)</span>
                                <span className="text-xs font-bold text-amber-600">{metrics.totalShortParagraphs}</span>
                            </div>
                        )}
                        {metrics.totalUncitedParagraphs > 0 && (
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-red-500">🔴 无引用段落</span>
                                <span className="text-xs font-bold text-red-500">{metrics.totalUncitedParagraphs}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">🏷️ 高频术语</h4>
                    <div className="flex flex-wrap gap-1">
                        {metrics.topTerms.slice(0, 15).map((t, i) => {
                            const maxFreq = metrics.topTerms[0]?.count || 1;
                            const scale = 0.6 + (t.count / maxFreq) * 0.4;
                            const opacity = 0.5 + (t.count / maxFreq) * 0.5;
                            return (
                                <span
                                    key={i}
                                    className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded font-medium"
                                    style={{ fontSize: `${Math.round(scale * 11)}px`, opacity }}
                                    title={`出现 ${t.count} 次`}
                                >
                                    {t.term}
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════
// Step 9: 润色结果
// ═══════════════════════════════════════════════════════════════════

const PolishStep: React.FC<{
    abstract?: string; keywords?: string[]; highlights?: string[];
    outline?: ReviewOutlineNode[]; generatedSections?: Record<string, string>;
}> = ({ abstract, keywords, highlights, outline, generatedSections }) => {
    const metrics = useMemo(() => {
        if (!outline?.length || !generatedSections || Object.keys(generatedSections).length === 0) return null;
        return computeReviewMetrics(outline, generatedSections);
    }, [outline, generatedSections]);

    if (!abstract && !keywords?.length && !metrics) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <span className="text-4xl mb-4">💎</span>
                <p className="text-sm font-bold">点击"执行此步"进行学术润色</p>
                <p className="text-xs mt-1">AI 将逐节润色语言，并生成摘要、关键词和研究亮点</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 max-w-2xl">
            {abstract && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">📄 摘要</h4>
                        <CopyButton text={abstract} />
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{abstract}</p>
                </div>
            )}
            {keywords && keywords.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">🏷️ 关键词</h4>
                    <div className="flex flex-wrap gap-2">
                        {keywords.map((kw, i) => (
                            <span key={i} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold">{kw}</span>
                        ))}
                    </div>
                </div>
            )}
            {highlights && highlights.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">✨ 研究亮点</h4>
                    <ul className="space-y-2">
                        {highlights.map((h, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                <span className="text-emerald-500 mt-0.5 flex-shrink-0">●</span>
                                {h}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* 质量仪表盘 */}
            {metrics && (
                <>
                    <div className="flex items-center gap-2 mt-6 mb-2">
                        <span className="text-sm">📊</span>
                        <h3 className="text-sm font-bold text-slate-700">写作质量仪表盘</h3>
                    </div>
                    <QualityDashboard metrics={metrics} />
                </>
            )}
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════════
// Step 9: 写入编辑器
// ═══════════════════════════════════════════════════════════════════

const FinalStep: React.FC<{ session: any }> = ({ session }) => {
    const sections = flattenOutline(session.outline);
    const generated = Object.keys(session.generatedSections || {}).length;
    const total = sections.length;
    const isComplete = session.currentStage === 'completed';

    // 总字数
    const totalWords = useMemo(() => {
        let wc = 0;
        for (const content of Object.values(session.generatedSections || {})) {
            wc += (content as string).replace(/\s+/g, '').length;
        }
        if (session.abstract) wc += session.abstract.replace(/\s+/g, '').length;
        return wc;
    }, [session.generatedSections, session.abstract]);

    return (
        <div className="flex flex-col items-center justify-center py-12">
            {isComplete ? (
                <>
                    <span className="text-5xl mb-4">🎉</span>
                    <h3 className="text-lg font-black text-slate-800 mb-2">综述已写入编辑器！</h3>
                    <p className="text-sm text-slate-400 mb-3">你可以在左侧编辑器中查看和编辑生成的综述全文。</p>
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold">共 {totalWords.toLocaleString()} 字</span>
                        <span className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold">{generated} 个章节</span>
                    </div>
                </>
            ) : (
                <>
                    <span className="text-5xl mb-4">📋</span>
                    <h3 className="text-lg font-black text-slate-800 mb-2">写入编辑器</h3>
                    <p className="text-sm text-slate-400 mb-2">将 {generated}/{total} 个章节的内容写入写作编辑器。</p>
                    {totalWords > 0 && (
                        <p className="text-xs text-indigo-500 font-bold mb-4">当前综述 {totalWords.toLocaleString()} 字（目标 {(session.config.targetWordCount || 5000).toLocaleString()} 字）</p>
                    )}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700 max-w-md">
                        ⚠️ 写入操作将在编辑器光标位置插入全文内容，包括摘要、各章节和参考文献。
                    </div>
                </>
            )}
        </div>
    );
};


export default ReviewAssistantPanel;
