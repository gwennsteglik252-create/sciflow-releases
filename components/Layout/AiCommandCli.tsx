import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProjectContext } from '../../context/ProjectContext';
import { useAppLogic } from '../../hooks/useAppLogic';
import QuickNavigation from './QuickNavigation';
import { useAiCommandExecutor } from '../../hooks/useAiCommandExecutor';
import { parseAiCommand } from '../../services/gemini/cliDispatcher';
import { AiCliCommand } from '../../types';
import { workflowEngine, ExecutionPolicy } from '../../services/ai/workflowEngine';
import { useTranslation } from '../../locales/useTranslation';

interface PresetScenario {
    id: string;
    icon: string;
    titleKey: string;
    descKey: string;
    defaultInstruction: string;
    defaultRuleName: string;
    category?: 'data' | 'literature' | 'report' | 'general';
}

const PRESET_SCENARIOS: PresetScenario[] = [
    {
        id: 'multi_step_audit',
        icon: 'fa-layer-group',
        titleKey: 'cli.presets.multi_step.title',
        descKey: 'cli.presets.multi_step.desc',
        defaultInstruction: '提取这个 CSV 的 H10 参数，帮我画个趋势图，并往项目里记一条日志。',
        defaultRuleName: '全流程审计规则',
        category: 'data'
    },
    {
        id: 'data_plot',
        icon: 'fa-chart-line',
        titleKey: 'cli.presets.data_plot.title',
        descKey: 'cli.presets.data_plot.desc',
        defaultInstruction: '提取文件中的数值数据，并为我绘制一个趋势图表。',
        defaultRuleName: '自动绘图规则',
        category: 'data'
    },
    {
        id: 'paper_summary',
        icon: 'fa-file-pdf',
        titleKey: 'cli.presets.paper_summary.title',
        descKey: 'cli.presets.paper_summary.desc',
        defaultInstruction: '总结这篇文献的核心创新点和实验指标，并将其作为日志添加到我的项目中。',
        defaultRuleName: '文献追踪助手',
        category: 'literature'
    },
    {
        id: 'audit_extract',
        icon: 'fa-microscope',
        titleKey: 'cli.presets.audit_extract.title',
        descKey: 'cli.presets.audit_extract.desc',
        defaultInstruction: '分析数据中的表征参数，更新对应项目的实验进度。',
        defaultRuleName: '表征审计规则',
        category: 'data'
    }
];

const AiCommandCli: React.FC = () => {
    const { t } = useTranslation();
    const {
        isAiCliOpen, setIsAiCliOpen,
        aiCliHistory, setAiCliHistory,
        appSettings, navigate, setProjects, setModalOpen,
        projects, addProjectLog, updateProjectProgress, autoPlotData,
        showToast
    } = useProjectContext();

    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);

    // Wizard State
    const [wizardStep, setWizardStep] = useState<'none' | 'scenario' | 'params'>('none');
    const [selectedScenario, setSelectedScenario] = useState<PresetScenario | null>(null);
    const [selectedPath, setSelectedPath] = useState('');
    const [executionPolicy, setExecutionPolicy] = useState<ExecutionPolicy>('confirm');
    const [currentView, setCurrentView] = useState('home');

    // Track view for contextual presets
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '').split('/')[0];
            setCurrentView(hash || 'home');
        };
        window.addEventListener('hashchange', handleHashChange);
        handleHashChange();
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // Auto-focus input when opened
    useEffect(() => {
        if (isAiCliOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            setWizardStep('none');
            setSelectedScenario(null);
            setSelectedPath('');
            setSearchQuery('');
            setShowSearch(false);
            if (isListening) {
                recognitionRef.current?.stop();
            }
        }
    }, [isAiCliOpen, isListening]);

    // Auto-focus search input when search is shown
    useEffect(() => {
        if (showSearch) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [showSearch]);

    // Filter history based on search query
    const filteredHistory = searchQuery.trim()
        ? aiCliHistory.filter((cmd: any) =>
            cmd.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
            cmd.response?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : aiCliHistory;

    const highlightText = (text: string, query: string) => {
        if (!query.trim()) return text;
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
        return parts.map((part, i) => {
            const safe = part.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return part.toLowerCase() === query.toLowerCase()
                ? `<mark class="bg-amber-500/30 text-amber-200 px-0.5 rounded">${safe}</mark>`
                : safe;
        }).join('');
    };

    const toggleVoiceInput = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showToast({ message: t('cli.notSupported'), type: 'error' });
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'zh-CN';

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);

        recognition.onresult = (event: any) => {
            const transcript = Array.from(event.results as any)
                .map((result: any) => result[0])
                .map((result: any) => result.transcript)
                .join('');
            setInput(transcript);
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error);
            setIsListening(false);
            if (event.error !== 'no-speech') {
                showToast({ message: t('cli.error', { error: event.error }), type: 'error' });
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    // Scroll to bottom on new history
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [aiCliHistory, isProcessing]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isAiCliOpen) {
                if (showSearch) {
                    setShowSearch(false);
                    setSearchQuery('');
                } else {
                    setIsAiCliOpen(false);
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'f' && isAiCliOpen) {
                e.preventDefault();
                setShowSearch(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isAiCliOpen, setIsAiCliOpen, showSearch]);

    const { executeAction, processCommand } = useAiCommandExecutor();

    // Handle Workflow Triggers from Engine
    useEffect(() => {
        const handleTrigger = async (e: any) => {
            const { rule, fileContext, policy } = e.detail;
            const startTime = new Date().toLocaleTimeString();

            const logEntry: AiCliCommand = {
                text: `[Workflow] 触发规则: ${rule.name}`,
                timestamp: startTime,
                status: 'pending'
            };

            setAiCliHistory((prev: AiCliCommand[]) => [...prev, logEntry]);

            try {
                const apiKey = (appSettings as any).geminiConfig?.apiKey || (appSettings as any).openaiConfig?.apiKey || '';

                // Read file content for multimodal processing
                const fileData = await window.electron?.readFile(fileContext.path);

                const enrichedInstruction = `${rule.instruction}\nContext: The user uploaded a file named "${fileContext.name}" to "${fileContext.parentDir}". Full path: "${fileContext.path}". Extension: "${fileContext.ext}". Please process this accordingly. If you need to add a log or update progress, do so.`;
                const response = await parseAiCommand(enrichedInstruction, apiKey, fileData);

                if (policy === 'confirm') {
                    setAiCliHistory((prev: AiCliCommand[]) => {
                        const next = [...prev];
                        const targetIdx = next.findLastIndex((c: any) => c.text === logEntry.text && c.timestamp === startTime);
                        if (targetIdx !== -1) {
                            next[targetIdx] = {
                                ...next[targetIdx],
                                status: 'warning',
                                response: `[AI 建议执行] ${response.message || '指令解析完毕。'}\n是否确认执行上述操作？`,
                                pendingAction: response
                            };
                        }
                        return next;
                    });
                } else {
                    const resMsg = executeAction(response, policy);
                    setAiCliHistory((prev: AiCliCommand[]) => {
                        const next = [...prev];
                        const targetIdx = next.findLastIndex((c: any) => c.text === logEntry.text && c.timestamp === startTime);
                        if (targetIdx !== -1) {
                            next[targetIdx] = { ...next[targetIdx], status: 'success', response: `[AI] ${resMsg}` };
                        }
                        return next;
                    });
                }
            } catch (err: any) {
                setAiCliHistory((prev: AiCliCommand[]) => {
                    const next = [...prev];
                    const targetIdx = next.findLastIndex((c: any) => c.text === logEntry.text && c.timestamp === startTime);
                    if (targetIdx !== -1) {
                        next[targetIdx] = { ...next[targetIdx], status: 'error', response: `执行失败: ${err.message}` };
                    }
                    return next;
                });
            }
        };

        window.addEventListener('sciflow-workflow-trigger' as any, handleTrigger);
        return () => window.removeEventListener('sciflow-workflow-trigger' as any, handleTrigger);
    }, [appSettings, executeAction, setAiCliHistory]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isProcessing) return;

        const commandText = input.trim();
        setInput('');
        setIsProcessing(true);

        try {
            await processCommand(commandText);
        } catch (err: any) {
            console.error('Execution Error:', err);
        } finally {
            setIsProcessing(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const handleScenarioSelect = (scenario: PresetScenario) => {
        setSelectedScenario(scenario);
        setWizardStep('params');
    };

    const handlePickFolder = async () => {
        if (!window.electron) {
            setAiCliHistory((prev: AiCliCommand[]) => [...prev, {
                text: '[Error] 系统权限未就绪',
                timestamp: new Date().toLocaleTimeString(),
                status: 'error',
                response: '未探测到 Electron IPC 接口 (window.electron)。请确保处于桌面环境运行。'
            }]);
            return;
        }
        try {
            const path = await window.electron.selectDirectory();
            if (path) {
                setSelectedPath(path);
            }
        } catch (err: any) {
            setAiCliHistory(prev => [...prev, {
                text: '[Error] 文件夹选择器启动失败',
                timestamp: new Date().toLocaleTimeString(),
                status: 'error',
                response: err.message
            }]);
        }
    };

    const handleFinalizeWorkflow = () => {
        if (!selectedScenario || !selectedPath) return;

        workflowEngine.registerRule({
            name: selectedScenario.defaultRuleName,
            trigger: {
                type: 'file_added',
                path: selectedPath
            },
            instruction: selectedScenario.defaultInstruction,
            policy: executionPolicy
        });

        const confirmMsg: AiCliCommand = {
            text: `[Wizard] 已注册场景：${t(selectedScenario.titleKey)}`,
            timestamp: new Date().toLocaleTimeString(),
            status: 'success',
            response: `监控路径: ${selectedPath}\n任务: ${selectedScenario.defaultInstruction}\n策略: ${executionPolicy === 'silent' ? '静默执行' : '预览确认'}`
        };

        setAiCliHistory(prev => [...prev, confirmMsg]);
        setWizardStep('none');
        setSelectedScenario(null);
        setSelectedPath('');
    };

    return (
        <AnimatePresence>
            {isAiCliOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsAiCliOpen(false)}
                        className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-[9998]"
                    />

                    <motion.div
                        initial={{ opacity: 0, y: -40, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.98 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                        className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-2xl z-[9999] p-4"
                    >
                        <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-[24px] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] flex flex-col max-h-[600px] ring-1 ring-white/5">

                            {/* Wizard Header (If Active) */}
                            {wizardStep !== 'none' && (
                                <div className="bg-indigo-500/10 px-6 py-3 border-b border-indigo-500/20 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <i className="fa-solid fa-magic-wand-sparkles text-indigo-400"></i>
                                        <span className="text-[11px] font-bold text-indigo-100 uppercase tracking-widest">
                                            {t('cli.wizardHeader')}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setWizardStep('none')}
                                        className="text-[10px] text-indigo-400 hover:text-white transition-colors"
                                    >
                                        {t('cli.cancelWizard')}
                                    </button>
                                </div>
                            )}

                            {/* Main Interaction Area */}
                            <div className="flex flex-col">
                                {wizardStep === 'none' ? (
                                    <>
                                        <form onSubmit={handleSubmit} className="shrink-0 p-4 pb-2">
                                            <div className="flex items-center gap-4 bg-white/5 rounded-2xl px-5 py-3.5 ring-1 ring-white/10 focus-within:ring-indigo-500/50 focus-within:bg-white/10 transition-all shadow-inner group">
                                                <div className="relative">
                                                    {isProcessing ? (
                                                        <i className="fa-solid fa-spinner fa-spin text-indigo-400 text-lg"></i>
                                                    ) : (
                                                        <i className="fa-solid fa-bolt text-indigo-400 text-lg animate-pulse"></i>
                                                    )}
                                                </div>
                                                <input
                                                    ref={inputRef}
                                                    type="text"
                                                    value={input}
                                                    onChange={e => setInput(e.target.value)}
                                                    disabled={isProcessing}
                                                    placeholder={t('cli.placeholder')}
                                                    className="flex-1 bg-transparent border-none outline-none text-white text-lg font-medium placeholder:text-slate-500 w-full tracking-tight"
                                                />
                                                <div className="flex items-center gap-2">
                                                    <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] font-medium text-slate-400 opacity-100 uppercase">
                                                        Enter
                                                    </kbd>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleVoiceInput();
                                                        }}
                                                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isListening ? 'bg-rose-500 text-white animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.5)]' : 'hover:bg-white/10 text-slate-400 hover:text-white'}`}
                                                        title={isListening ? t('cli.stopListening') : t('cli.voiceInput')}
                                                    >
                                                        <i className={`fa-solid ${isListening ? 'fa-microphone-lines' : 'fa-microphone'} text-xs`}></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (aiCliHistory.length > 0) {
                                                                setShowSearch(prev => !prev);
                                                            }
                                                        }}
                                                        disabled={aiCliHistory.length === 0}
                                                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${aiCliHistory.length === 0
                                                                ? 'opacity-30 cursor-not-allowed text-slate-600'
                                                                : showSearch
                                                                    ? 'bg-amber-500/20 text-amber-400 shadow-lg shadow-amber-500/20'
                                                                    : 'hover:bg-white/10 text-slate-400 hover:text-white'
                                                            }`}
                                                        title={aiCliHistory.length === 0 ? t('cli.noHistory') : t('cli.searchHistory')}
                                                    >
                                                        <i className="fa-solid fa-magnifying-glass text-xs"></i>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setIsAiCliOpen(false);
                                                        }}
                                                        className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 hover:text-white"
                                                    >
                                                        <i className="fa-solid fa-times text-sm"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        </form>

                                        {/* Search Bar */}
                                        {showSearch && aiCliHistory.length > 0 && (
                                            <div className="px-4 pb-3 animate-in slide-in-from-top-2 duration-200">
                                                <div className="flex items-center gap-3 bg-amber-500/10 rounded-xl px-4 py-2.5 ring-1 ring-amber-500/30 shadow-inner">
                                                    <i className="fa-solid fa-magnifying-glass text-amber-400 text-sm"></i>
                                                    <input
                                                        ref={searchInputRef}
                                                        type="text"
                                                        value={searchQuery}
                                                        onChange={e => setSearchQuery(e.target.value)}
                                                        placeholder={t('cli.searchPlaceholder')}
                                                        className="flex-1 bg-transparent border-none outline-none text-white text-sm font-medium placeholder:text-amber-300/40"
                                                    />
                                                    {searchQuery && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-amber-300/60 font-mono">
                                                                {filteredHistory.length} / {aiCliHistory.length}
                                                            </span>
                                                            <button
                                                                onClick={() => setSearchQuery('')}
                                                                className="w-6 h-6 rounded-full hover:bg-amber-500/20 flex items-center justify-center transition-colors text-amber-400/60 hover:text-amber-300"
                                                            >
                                                                <i className="fa-solid fa-times text-xs"></i>
                                                            </button>
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            setShowSearch(false);
                                                            setSearchQuery('');
                                                        }}
                                                        className="text-[9px] text-amber-400/60 hover:text-amber-300 transition-colors uppercase tracking-wider font-bold"
                                                    >
                                                        ESC
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Dynamic Content: History or Presets */}
                                        <div className="overflow-y-auto max-h-[400px]" ref={scrollRef}>
                                            {aiCliHistory.length > 0 ? (
                                                <>
                                                    {searchQuery && filteredHistory.length === 0 ? (
                                                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                                                            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                                                <i className="fa-solid fa-search text-2xl text-amber-400/40"></i>
                                                            </div>
                                                            <p className="text-slate-400 text-sm">{t('cli.noMatches', { query: searchQuery })}</p>
                                                            <button
                                                                onClick={() => setSearchQuery('')}
                                                                className="px-4 py-2 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-all border border-indigo-500/20"
                                                            >
                                                                {t('cli.clearSearch')}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="px-4 pb-6 font-mono text-sm space-y-4 pt-2">
                                                            {filteredHistory.map((cmd: any, idx: number) => (
                                                                <div key={idx} className="flex flex-col gap-2 py-3 border-b border-white/5 last:border-none group animate-in slide-in-from-left-2 duration-300">
                                                                    <div className="flex items-start gap-3">
                                                                        <div className="mt-1 w-5 h-5 rounded-md bg-indigo-500/10 flex items-center justify-center shrink-0">
                                                                            <span className="text-indigo-400 text-[10px] font-bold">
                                                                                {cmd.text.startsWith('[Workflow]') ? 'W' : (cmd.text.startsWith('[Wizard]') ? 'A' : 'Q')}
                                                                            </span>
                                                                        </div>
                                                                        <span
                                                                            className={`${cmd.text.startsWith('[Workflow]') ? 'text-amber-400' : (cmd.text.startsWith('[Wizard]') ? 'text-indigo-400' : 'text-slate-100')} font-medium break-words leading-relaxed`}
                                                                            dangerouslySetInnerHTML={{ __html: highlightText(cmd.text, searchQuery) }}
                                                                        />
                                                                        <span className="ml-auto text-[9px] text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">{cmd.timestamp}</span>
                                                                    </div>

                                                                    {cmd.status === 'pending' && (
                                                                        <div className="pl-8 text-indigo-400 text-xs flex items-center gap-3 py-1">
                                                                            <div className="flex gap-1">
                                                                                <span className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0s' }}></span>
                                                                                <span className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                                                                                <span className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                                                            </div>
                                                                            <span className="italic opacity-70">{t('cli.scheduling')}</span>
                                                                        </div>
                                                                    )}

                                                                    {cmd.response && (
                                                                        <div className="pl-8 flex flex-col gap-3">
                                                                            <div className="flex items-start gap-3">
                                                                                <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${cmd.status === 'error' ? 'bg-rose-500/10 text-rose-400' : (cmd.status === 'warning' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400')}`}>
                                                                                    <i className={`fa-solid ${cmd.status === 'error' ? 'fa-triangle-exclamation' : (cmd.status === 'warning' ? 'fa-circle-question' : 'fa-check')} text-[10px]`}></i>
                                                                                </div>
                                                                                <div
                                                                                    className={`text-xs whitespace-pre-wrap leading-relaxed py-0.5 ${cmd.status === 'error' ? 'text-rose-400/90' : (cmd.status === 'warning' ? 'text-amber-300' : 'text-slate-400')}`}
                                                                                    dangerouslySetInnerHTML={{ __html: highlightText(cmd.response, searchQuery) }}
                                                                                />
                                                                            </div>

                                                                            {cmd.status === 'warning' && cmd.pendingAction && (
                                                                                <div className="flex gap-2 ml-8 pb-1">
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            const res = executeAction(cmd.pendingAction);
                                                                                            setAiCliHistory((prev: AiCliCommand[]) => prev.map((c: any) => c.text === cmd.text && c.timestamp === cmd.timestamp ? { ...c, status: 'success', response: `[AI] ${res}`, pendingAction: undefined } : c));
                                                                                        }}
                                                                                        className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-bold rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
                                                                                    >
                                                                                        {t('cli.confirmExecute')}
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setAiCliHistory((prev: AiCliCommand[]) => prev.map((c: any) => c.text === cmd.text && c.timestamp === cmd.timestamp ? { ...c, status: 'error', response: '操作已取消。', pendingAction: undefined } : c));
                                                                                        }}
                                                                                        className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 text-[10px] font-bold rounded-lg transition-colors"
                                                                                    >
                                                                                        {t('cli.cancel')}
                                                                                    </button>
                                                                                </div>
                                                                            )}

                                                                            {cmd.selectionList && (
                                                                                <div className="flex flex-col gap-2 ml-8 pb-2 max-w-md">
                                                                                    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                                                                                        {cmd.selectionList.map((item: any, sIdx: number) => (
                                                                                            <div
                                                                                                key={sIdx}
                                                                                                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-colors border-b border-white/5 last:border-none text-left"
                                                                                            >
                                                                                                <div className="flex items-center gap-3">
                                                                                                    {cmd.selectionType === 'multiple' ? (
                                                                                                        <input
                                                                                                            type="checkbox"
                                                                                                            checked={item.selected}
                                                                                                            onChange={() => {
                                                                                                                setAiCliHistory((h: any) => h.map((c: any, i: number) => i === idx ? { ...c, selectionList: c.selectionList.map((s: any, si: number) => si === sIdx ? { ...s, selected: !s.selected } : s) } : c));
                                                                                                            }}
                                                                                                            className="w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500/50"
                                                                                                        />
                                                                                                    ) : (
                                                                                                        <i className={`fa-solid ${item.value.ext === '.pdf' ? 'fa-file-pdf text-rose-400' : 'fa-file-csv text-indigo-400'} text-xs opacity-70`}></i>
                                                                                                    )}
                                                                                                    <span className="text-[11px] text-slate-300 font-medium truncate max-w-[200px]">{item.label}</span>
                                                                                                </div>
                                                                                                {cmd.selectionType === 'single' && (
                                                                                                    <button
                                                                                                        onClick={async () => {
                                                                                                            if (item.value.type === 'file') {
                                                                                                                setIsProcessing(true);
                                                                                                                const fileData = await window.electron?.readFile(item.value.path);
                                                                                                                const apiKey = (appSettings as any).geminiConfig?.apiKey || (appSettings as any).openaiConfig?.apiKey || '';
                                                                                                                const response = await parseAiCommand(`分析这个文件: ${item.label}`, apiKey, fileData);
                                                                                                                const resMsg = executeAction(response);
                                                                                                                setAiCliHistory(prev => [...prev, {
                                                                                                                    text: `[Analysis] ${t('cli.selected')} ${item.label}`,
                                                                                                                    timestamp: new Date().toLocaleTimeString(),
                                                                                                                    status: 'success',
                                                                                                                    response: resMsg
                                                                                                                }]);
                                                                                                                setAiCliHistory(h => h.map((c, i) => i === idx ? { ...c, selectionList: undefined } : c));
                                                                                                                setIsProcessing(false);
                                                                                                            }
                                                                                                        }}
                                                                                                        className="px-2 py-1 text-indigo-400 hover:text-white transition-colors"
                                                                                                    >
                                                                                                        <i className="fa-solid fa-chevron-right text-[10px]"></i>
                                                                                                    </button>
                                                                                                )}
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                    {cmd.selectionType === 'multiple' && (
                                                                                        <button
                                                                                            onClick={async () => {
                                                                                                const selectedItems = cmd.selectionList.filter((s: any) => s.selected);
                                                                                                if (selectedItems.length === 0) return;

                                                                                                setIsProcessing(true);
                                                                                                setAiCliHistory(prev => [...prev, {
                                                                                                    text: `[Batch] ${t('cli.batchProcessing', { count: selectedItems.length })}`,
                                                                                                    timestamp: new Date().toLocaleTimeString(),
                                                                                                    status: 'pending'
                                                                                                }]);

                                                                                                let finalReport = `${t('cli.batchComplete', { count: selectedItems.length })}\n`;
                                                                                                for (const item of selectedItems) {
                                                                                                    const fileData = await window.electron?.readFile(item.value.path);
                                                                                                    const apiKey = (appSettings as any).geminiConfig?.apiKey || (appSettings as any).openaiConfig?.apiKey || '';
                                                                                                    const response = await parseAiCommand(`分析这个文件并给出结论: ${item.label}`, apiKey, fileData);
                                                                                                    const resMsg = executeAction(response);
                                                                                                    finalReport += `• ${item.label}: ${resMsg.split('\n')[0]}\n`;
                                                                                                }

                                                                                                setAiCliHistory(prev => {
                                                                                                    const next = [...prev];
                                                                                                    next[next.length - 1] = { ...next[next.length - 1], status: 'success', response: finalReport };
                                                                                                    return next.map((c, i) => i === idx ? { ...c, selectionList: undefined } : c);
                                                                                                });
                                                                                                setIsProcessing(false);
                                                                                            }}
                                                                                            className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-[11px] font-black rounded-xl transition-all shadow-lg active:scale-95 uppercase tracking-widest"
                                                                                        >
                                                                                            {t('cli.batchButton')}
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="p-8 pb-10 flex flex-col items-center">
                                                    <div className="w-full max-w-lg">
                                                        <h3 className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-6 flex items-center gap-3">
                                                            <div className="h-px flex-1 bg-white/5"></div>
                                                            {t('cli.laboratoryPresets')}
                                                            <div className="h-px flex-1 bg-white/5"></div>
                                                        </h3>
                                                        <div className="grid grid-cols-1 gap-3">
                                                            {PRESET_SCENARIOS
                                                                .sort((a, b) => {
                                                                    const matchA = a.category === currentView ? 1 : 0;
                                                                    const matchB = b.category === currentView ? 1 : 0;
                                                                    return matchB - matchA;
                                                                })
                                                                .map(preset => (
                                                                    <button
                                                                        key={preset.id}
                                                                        onClick={() => handleScenarioSelect(preset)}
                                                                        className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-indigo-500/30 hover:bg-white/10 transition-all text-left group"
                                                                    >
                                                                        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-lg">
                                                                            <i className={`fa-solid ${preset.icon} text-indigo-400 text-lg`}></i>
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <div className="flex items-center justify-between mb-1">
                                                                                <h4 className="text-white font-bold text-sm tracking-tight">{t(preset.titleKey)}</h4>
                                                                                <i className="fa-solid fa-chevron-right text-white/20 text-xs group-hover:text-indigo-400 group-hover:translate-x-1 transition-all"></i>
                                                                            </div>
                                                                            <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-2">{t(preset.descKey)}</p>
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                        <div className="p-8 space-y-8 animate-in fade-in duration-500">
                                            <div className="flex gap-4 items-start">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                                                    <i className={`fa-solid ${selectedScenario?.icon} text-indigo-400`}></i>
                                                </div>
                                                <div>
                                                    <h3 className="text-white font-bold text-lg">{t(selectedScenario?.titleKey || '')}</h3>
                                                    <p className="text-slate-400 text-xs">{t(selectedScenario?.descKey || '')}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">{t('cli.configPath')}</label>
                                                    <div className="flex gap-3">
                                                        <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-slate-300 text-xs font-mono truncate flex items-center shadow-inner">
                                                            {selectedPath || t('cli.noFolder')}
                                                        </div>
                                                        <button
                                                            onClick={handlePickFolder}
                                                            className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-white text-xs font-bold transition-all shadow-lg active:scale-95"
                                                        >
                                                            {t('cli.selectFolder')}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">{t('cli.policy')}</label>
                                                    <div className="flex gap-3">
                                                        {[
                                                            { id: 'confirm', label: t('cli.previewConfirm'), icon: 'fa-eye' },
                                                            { id: 'silent', label: t('cli.autoExecute'), icon: 'fa-bolt' }
                                                        ].map(p => (
                                                            <button
                                                                key={p.id}
                                                                onClick={() => setExecutionPolicy(p.id as ExecutionPolicy)}
                                                                className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${executionPolicy === p.id ? 'bg-indigo-500/20 border-indigo-500 text-indigo-100 shadow-inner' : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'}`}
                                                            >
                                                                <i className={`fa-solid ${p.icon} text-xs`}></i>
                                                                <span className="text-[11px] font-bold uppercase tracking-tight">{p.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-white/5 flex gap-3">
                                                <button
                                                    onClick={() => setWizardStep('none')}
                                                    className="flex-1 py-3.5 rounded-xl border border-white/10 text-slate-400 text-xs font-bold hover:bg-white/5 transition-all"
                                                >
                                                    {t('cli.backToList')}
                                                </button>
                                                <button
                                                    onClick={handleFinalizeWorkflow}
                                                    disabled={!selectedPath}
                                                    className="flex-[2] py-3.5 bg-indigo-500 disabled:opacity-30 hover:bg-indigo-600 rounded-xl text-white text-xs font-black transition-all shadow-xl shadow-indigo-500/20 uppercase tracking-widest active:scale-[0.98]"
                                                >
                                                    {t('cli.enableRule')}
                                                </button>
                                            </div>
                                        </div>
                                )}
                            </div>

                                <div className="h-10 bg-slate-950/40 border-t border-white/5 flex items-center px-5 justify-between shrink-0">
                                    <div className="flex gap-4 items-center">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                            <span className="text-[9px] uppercase tracking-tighter text-slate-500 font-bold">Agent Engine Active</span>
                                        </div>
                                        {selectedScenario && (
                                            <div className="flex items-center gap-1.5 text-indigo-400">
                                                <div className="h-3 w-px bg-white/10"></div>
                                                <span className="text-[9px] uppercase tracking-tighter font-bold">{t(selectedScenario.titleKey)} MODE</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-3 text-[9px] text-slate-500 font-bold">
                                        <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-white/5 border border-white/10">ESC</kbd> {t('cli.exit')}</span>
                                        {aiCliHistory.length > 0 && (
                                            <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-white/5 border border-white/10">⌘F</kbd> {t('cli.search')}</span>
                                        )}
                                        <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-white/5 border border-white/10">↑↓</kbd> {t('cli.history')}</span>
                                    </div>
                                </div>
                            </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default AiCommandCli;
