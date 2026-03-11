import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Literature, ResourceType } from '../../types';
import { analyzeLiteratureDeeply, chatWithLiterature } from '../../services/gemini';
import ScientificMarkdown from '../Common/ScientificMarkdown';
import { useProjectContext } from '../../context/ProjectContext';

interface LiteratureDetailProps {
    item: Literature;
    activeType: ResourceType;
    isGenerating: boolean;
    onDelete: (id: string) => void;
    onLinkLocalFile: () => void;
    onOpenLocalFile: () => void;
    onStartTransformation: () => Promise<void> | void;
    onKnowledgeSink?: (id: string) => void;
    existingProposalId?: string;
    onJumpToProposal?: (proposalId: string) => void;
    onUpdateResource?: (resource: Literature) => void;
    onReaderModeChange?: (isReader: boolean) => void;
    allCategories?: string[];
}

interface ReaderAnalysis {
    executiveSummary: string;
    glossary: { term: string; definition: string }[];
    keyQuestions: string[];
    conceptTree?: { label: string; icon: string; children: { label: string; detail: string }[] }[];
}

interface ChatMsg {
    role: 'user' | 'model';
    text: string;
    quote?: string; // Quoted passage from the PDF
}

interface PinnedNote {
    id: string;
    text: string;
    context?: string; // The user question that prompted this answer
    timestamp: string;
}

const LiteratureDetail: React.FC<LiteratureDetailProps> = ({
    item,
    activeType,
    isGenerating,
    onDelete,
    onLinkLocalFile,
    onOpenLocalFile,
    onStartTransformation,
    onKnowledgeSink,
    existingProposalId,
    onJumpToProposal,
    onUpdateResource,
    onReaderModeChange,
    allCategories = []
}) => {
    const { showToast, activeTasks } = useProjectContext();
    const isInitialLoad = useRef(true);
    const [isReaderMode, setIsReaderModeInternal] = useState(false);
    const setIsReaderMode = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
        setIsReaderModeInternal(prev => {
            const next = typeof val === 'function' ? val(prev) : val;
            onReaderModeChange?.(next);
            return next;
        });
    }, [onReaderModeChange]);
    const [analysis, setAnalysis] = useState<ReaderAnalysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [localPdfBase64, setLocalPdfBase64] = useState<string | null>(null);

    // Chat State
    const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatting, setIsChatting] = useState(false);
    const [quoteMode, setQuoteMode] = useState(false);
    const [quoteText, setQuoteText] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);
    const quoteInputRef = useRef<HTMLTextAreaElement>(null);

    // Pinned Notes State
    const [pinnedNotes, setPinnedNotes] = useState<PinnedNote[]>([]);
    const [showPinnedNotes, setShowPinnedNotes] = useState(true);
    const [expandedBranches, setExpandedBranches] = useState<Set<number>>(new Set([0]));

    // Cache file payload so we only read from disk ONCE per session
    const cachedFilePayload = useRef<any>(null);

    // Inline editing state
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingField, setEditingField] = useState<string | null>(null);
    const [editBuffer, setEditBuffer] = useState<any>(null);

    const toggleEditMode = () => {
        if (isEditMode) {
            // 退出编辑模式时清空编辑状态
            setEditingField(null);
            setEditBuffer(null);
        }
        setIsEditMode(!isEditMode);
    };

    const commitEdit = (updates: Partial<Literature>) => {
        if (onUpdateResource) {
            onUpdateResource({ ...item, ...updates });
        }
        setEditingField(null);
        setEditBuffer(null);
    };

    const isSinking = activeTasks.some(t => t.id === `sink_${item.id}`);

    const safeUrl = (url?: string) => {
        if (!url) return undefined;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        return `https://${url}`;
    };

    // Load PDF for viewer — independent from AI analysis
    const loadPdfForViewer = async () => {
        if (localPdfBase64) return; // Already loaded
        const filePayload = await getFileContent();
        if (filePayload && filePayload.mimeType === 'application/pdf') {
            try {
                const binaryData = atob(filePayload.data);
                const array = new Uint8Array(binaryData.length);
                for (let i = 0; i < binaryData.length; i++) {
                    array[i] = binaryData.charCodeAt(i);
                }
                const blob = new Blob([array], { type: 'application/pdf' });
                const blobUrl = URL.createObjectURL(blob);
                setLocalPdfBase64(blobUrl);
            } catch (e) {
                console.error("Blob conversion failed, falling back to data URL", e);
                setLocalPdfBase64(`data:application/pdf;base64,${filePayload.data}`);
            }
        }
    };

    useEffect(() => {
        if (isReaderMode) {
            // Always load PDF for viewer (fast — just disk read + blob)
            loadPdfForViewer();
            // Only start AI analysis if no saved analysis exists
            if (!analysis && !isAnalyzing) {
                startDeepAnalysis();
            }
        }
    }, [isReaderMode]);

    // Restore persisted deep reading data when item changes
    useEffect(() => {
        isInitialLoad.current = true;
        setIsReaderMode(false);
        setLocalPdfBase64(null);
        cachedFilePayload.current = null; // Clear file cache when switching items

        // Restore saved analysis & chat history
        if (item.deepReadAnalysis) {
            setAnalysis(item.deepReadAnalysis);
        } else {
            setAnalysis(null);
        }
        if (item.deepReadChatHistory && item.deepReadChatHistory.length > 0) {
            setChatHistory(item.deepReadChatHistory);
        } else {
            setChatHistory([]);
        }
        // Restore pinned notes
        if (item.deepReadPinnedNotes && item.deepReadPinnedNotes.length > 0) {
            setPinnedNotes(item.deepReadPinnedNotes);
        } else {
            setPinnedNotes([]);
        }

        // Allow saves after initial restoration
        const timer = setTimeout(() => { isInitialLoad.current = false; }, 200);
        return () => clearTimeout(timer);
    }, [item.id]);

    // Auto-save chat history whenever it changes
    const saveSession = useCallback(() => {
        if (isInitialLoad.current || !onUpdateResource) return;
        onUpdateResource({
            ...item,
            deepReadChatHistory: chatHistory,
            deepReadAnalysis: analysis || undefined,
            deepReadPinnedNotes: pinnedNotes.length > 0 ? pinnedNotes : undefined,
        });
    }, [chatHistory, analysis, pinnedNotes, item, onUpdateResource]);

    useEffect(() => {
        saveSession();
    }, [chatHistory, analysis, pinnedNotes]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, isReaderMode]);

    const getFileContent = async () => {
        // Return cached payload if available — avoids re-reading large PDF on every message
        if (cachedFilePayload.current) return cachedFilePayload.current;

        if (item.localPath && window.electron && window.electron.readFile) {
            try {
                const filePayload = await window.electron.readFile(item.localPath);
                cachedFilePayload.current = filePayload; // Cache for the session
                return filePayload;
            } catch (e) {
                console.error("Read file error", e);
                showToast({ message: "读取本地文件失败，将仅使用元数据分析", type: 'error' });
            }
        }
        return null;
    };

    const startDeepAnalysis = async () => {
        setIsAnalyzing(true);
        try {
            const filePayload = await getFileContent();
            if (filePayload) {
                showToast({ message: "已加载本地全文内容进行深度研读...", type: 'info' });
            }

            const result = await analyzeLiteratureDeeply(item, filePayload);
            setAnalysis(result);

            setChatHistory([{ role: 'model', text: `您好，我已经阅读了《${item.title}》${filePayload ? '的全文内容' : '的摘要信息'}。您可以问我关于这篇文献的任何细节，或者点击下方的建议问题。` }]);
        } catch (e) {
            console.error(e);
            showToast({ message: "深度研读分析失败", type: 'error' });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSendMessage = async (text?: string) => {
        const msg = text || chatInput;
        if (!msg.trim() || isChatting) return;

        const currentQuote = quoteText.trim() || undefined;
        const newHistory = [...chatHistory, { role: 'user' as const, text: msg, quote: currentQuote }];
        setChatHistory(newHistory);
        setChatInput('');
        setQuoteText('');
        setQuoteMode(false);
        setIsChatting(true);

        try {
            const apiHistory = newHistory.slice(0, -1).map(h => ({
                role: h.role,
                parts: [{ text: h.quote ? `【引用原文】："${h.quote}"\n【问题】：${h.text}` : h.text }]
            }));

            // Build the actual message with quote context
            const actualMsg = currentQuote
                ? `用户引用了文献中的一段原文，请重点围绕这段引用来回答问题。\n\n【引用原文段落】：\n"${currentQuote}"\n\n【用户问题】：\n${msg}`
                : msg;

            const filePayload = await getFileContent();
            const response = await chatWithLiterature(apiHistory, actualMsg, item, filePayload);
            setChatHistory([...newHistory, { role: 'model', text: response }]);
        } catch (e) {
            setChatHistory([...newHistory, { role: 'model', text: "AI 连接中断，请重试。" }]);
        } finally {
            setIsChatting(false);
        }
    };

    // Search & Delete state
    const [searchMode, setSearchMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMatchIdx, setSearchMatchIdx] = useState(0);
    const [confirmClearAll, setConfirmClearAll] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const msgRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Compute search matches
    const searchMatches = searchQuery.trim()
        ? chatHistory
            .map((msg, idx) => ({ idx, match: msg.text.toLowerCase().includes(searchQuery.toLowerCase()) }))
            .filter(m => m.match)
            .map(m => m.idx)
        : [];

    useEffect(() => {
        if (searchMode && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [searchMode]);

    // Scroll to current match
    useEffect(() => {
        if (searchMatches.length > 0 && searchMatchIdx < searchMatches.length) {
            const targetIdx = searchMatches[searchMatchIdx];
            msgRefs.current[targetIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [searchMatchIdx, searchMatches.length]);

    const handleSearchNav = (dir: 'prev' | 'next') => {
        if (searchMatches.length === 0) return;
        if (dir === 'next') {
            setSearchMatchIdx(prev => (prev + 1) % searchMatches.length);
        } else {
            setSearchMatchIdx(prev => (prev - 1 + searchMatches.length) % searchMatches.length);
        }
    };

    const handleDeleteMessage = (idx: number) => {
        setChatHistory(prev => prev.filter((_, i) => i !== idx));
    };

    const handleClearAll = () => {
        setChatHistory([]);
        setAnalysis(null);
        setConfirmClearAll(false);
        showToast({ message: '对话记录已清空', type: 'info' });
    };

    // Pinned Notes handlers
    const handlePinMessage = (msg: ChatMsg, idx: number) => {
        // Find the user question that prompted this AI answer (previous message)
        const contextMsg = idx > 0 ? chatHistory[idx - 1] : null;
        const note: PinnedNote = {
            id: `pin_${Date.now()}_${idx}`,
            text: msg.text,
            context: contextMsg?.role === 'user' ? contextMsg.text : undefined,
            timestamp: new Date().toLocaleString(),
        };
        setPinnedNotes(prev => [note, ...prev]);
        showToast({ message: '已固定为研读笔记 📌', type: 'success' });
    };

    const handleUnpinNote = (id: string) => {
        setPinnedNotes(prev => prev.filter(n => n.id !== id));
    };

    const handleExportCitation = () => {
        const authors = Array.isArray(item.authors) ? item.authors : [];
        const authorStr = authors.length > 0 ? authors.join(', ') : 'Unknown Author';
        const year = item.year || new Date().getFullYear();
        const title = item.title || 'Untitled';
        const journal = item.source || 'Open Database';
        const doi = item.doi ? `, DOI: ${item.doi}` : '';

        // Pure text citation export (Standard format)
        const citationText = `${authorStr}. ${title}. ${journal} ${year}${doi}.`;

        navigator.clipboard.writeText(citationText);
        showToast({ message: '引用文献文本已导出至剪贴板 📝', type: 'success' });
    };

    // Highlight matching text helper
    const highlightText = (text: string, query: string, isActiveMatch: boolean) => {
        if (!query.trim()) return text;
        const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
        return (
            <>
                {parts.map((part, i) =>
                    part.toLowerCase() === query.toLowerCase()
                        ? <mark key={i} className={`rounded px-0.5 ${isActiveMatch ? 'bg-amber-400 text-slate-900' : 'bg-amber-200/70 text-slate-800'}`}>{part}</mark>
                        : part
                )}
            </>
        );
    };

    // Reading Depth Calculation
    const readingDepth = (() => {
        let score = 0;

        // 1. Analysis completed = 20%
        if (analysis) score += 20;

        // 2. Conversation rounds (each user+model pair = 1 round), up to 40%
        const rounds = Math.floor(chatHistory.filter(m => m.role === 'user').length);
        score += Math.min(rounds * 10, 40);

        // 3. Key questions coverage, up to 30%
        if (analysis?.keyQuestions && analysis.keyQuestions.length > 0) {
            const userMessages = chatHistory.filter(m => m.role === 'user').map(m => m.text.toLowerCase());
            const coveredCount = analysis.keyQuestions.filter(q =>
                userMessages.some(um => um.includes(q.substring(0, 10).toLowerCase()) || q.toLowerCase().includes(um.substring(0, 10)))
            ).length;
            score += Math.min(Math.round((coveredCount / analysis.keyQuestions.length) * 30), 30);
        }

        // 4. Has pinned notes = 10%
        if (pinnedNotes.length > 0) score += 10;

        const pct = Math.min(score, 100);
        const level = pct >= 80 ? '专家' : pct >= 50 ? '精通' : pct >= 25 ? '深入' : '入门';
        const color = pct >= 80 ? 'from-emerald-400 to-cyan-500' : pct >= 50 ? 'from-indigo-400 to-violet-500' : pct >= 25 ? 'from-sky-400 to-indigo-400' : 'from-slate-300 to-slate-400';
        const textColor = pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-indigo-600' : pct >= 25 ? 'text-sky-600' : 'text-slate-500';

        return { pct, level, color, textColor };
    })();

    const renderReaderContent = () => (
        <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200 shadow-xl overflow-hidden">
            {/* Header */}
            <div className="border-b border-slate-200 bg-white shrink-0">
                <div className="px-5 py-3 flex justify-between items-center">
                    <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-book-reader"></i> Notebook Assistant
                        {chatHistory.length > 0 && (
                            <span className="text-[8px] font-bold text-slate-400 normal-case tracking-normal">
                                ({chatHistory.length} 条)
                            </span>
                        )}
                    </h4>
                    <div className="flex items-center gap-1">
                        {isAnalyzing && <span className="text-[9px] text-slate-400 animate-pulse mr-2">正在深度研读...</span>}

                        {/* Search toggle */}
                        <button
                            onClick={() => { setSearchMode(!searchMode); setSearchQuery(''); setSearchMatchIdx(0); }}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] transition-all ${searchMode ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-indigo-600'}`}
                            title="搜索对话"
                        >
                            <i className="fa-solid fa-magnifying-glass"></i>
                        </button>

                        {/* Clear all */}
                        {chatHistory.length > 0 && (
                            confirmClearAll ? (
                                <div className="flex items-center gap-1 animate-reveal">
                                    <button
                                        onClick={handleClearAll}
                                        className="px-2 h-7 bg-rose-600 text-white rounded-lg text-[8px] font-black uppercase shadow-md"
                                    >
                                        确认清空
                                    </button>
                                    <button
                                        onClick={() => setConfirmClearAll(false)}
                                        className="w-7 h-7 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center text-[10px]"
                                    >
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setConfirmClearAll(true)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
                                    title="清空全部对话"
                                >
                                    <i className="fa-solid fa-trash-can"></i>
                                </button>
                            )
                        )}
                    </div>
                </div>

                {/* Reading Depth Indicator */}
                {(analysis || chatHistory.length > 0) && (
                    <div className="px-5 pb-2.5">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <i className="fa-solid fa-brain text-[7px]"></i> 研读深度
                            </span>
                            <div className="flex items-center gap-1.5">
                                <span className={`text-[9px] font-black ${readingDepth.textColor}`}>{readingDepth.level}</span>
                                <span className="text-[8px] font-bold text-slate-400">{readingDepth.pct}%</span>
                            </div>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full bg-gradient-to-r ${readingDepth.color} transition-all duration-700 ease-out`}
                                style={{ width: `${readingDepth.pct}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Search bar (collapsible) */}
                {searchMode && (
                    <div className="px-5 pb-3 flex items-center gap-2 animate-reveal">
                        <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                            <i className="fa-solid fa-magnifying-glass text-[9px] text-slate-400"></i>
                            <input
                                ref={searchInputRef}
                                className="flex-1 bg-transparent text-[11px] font-medium outline-none text-slate-700 placeholder:text-slate-400"
                                placeholder="搜索对话内容..."
                                value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setSearchMatchIdx(0); }}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSearchNav(e.shiftKey ? 'prev' : 'next');
                                    if (e.key === 'Escape') { setSearchMode(false); setSearchQuery(''); }
                                }}
                            />
                            {searchQuery && (
                                <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">
                                    {searchMatches.length > 0 ? `${searchMatchIdx + 1}/${searchMatches.length}` : '0/0'}
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => handleSearchNav('prev')}
                            disabled={searchMatches.length === 0}
                            className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[9px] text-slate-500 hover:bg-indigo-50 disabled:opacity-30 transition-all"
                        >
                            <i className="fa-solid fa-chevron-up"></i>
                        </button>
                        <button
                            onClick={() => handleSearchNav('next')}
                            disabled={searchMatches.length === 0}
                            className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[9px] text-slate-500 hover:bg-indigo-50 disabled:opacity-30 transition-all"
                        >
                            <i className="fa-solid fa-chevron-down"></i>
                        </button>
                    </div>
                )}
            </div>

            {/* Chat content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                {/* Pinned Notes Section */}
                {pinnedNotes.length > 0 && (
                    <div className="bg-amber-50/80 rounded-2xl border border-amber-200/60 overflow-hidden animate-reveal">
                        <button
                            onClick={() => setShowPinnedNotes(!showPinnedNotes)}
                            className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-amber-100/50 transition-colors"
                        >
                            <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
                                <i className="fa-solid fa-thumbtack"></i>
                                研读笔记 ({pinnedNotes.length})
                            </span>
                            <i className={`fa-solid fa-chevron-${showPinnedNotes ? 'up' : 'down'} text-[8px] text-amber-400`}></i>
                        </button>
                        {showPinnedNotes && (
                            <div className="px-4 pb-3 space-y-2">
                                {pinnedNotes.map(note => (
                                    <div key={note.id} className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm group/note relative">
                                        {note.context && (
                                            <div className="text-[9px] text-amber-500 font-bold mb-1 flex items-center gap-1">
                                                <i className="fa-solid fa-comment-dots text-[7px]"></i>
                                                Q: {note.context.length > 60 ? note.context.substring(0, 60) + '...' : note.context}
                                            </div>
                                        )}
                                        <p className="text-[10px] text-slate-700 leading-relaxed line-clamp-4">{note.text.substring(0, 300)}{note.text.length > 300 ? '...' : ''}</p>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-[8px] text-slate-400">{note.timestamp}</span>
                                            <div className="flex items-center gap-1 opacity-0 group-hover/note:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => { navigator.clipboard.writeText(note.text); showToast({ message: '笔记内容已复制', type: 'success' }); }}
                                                    className="w-6 h-6 rounded-md flex items-center justify-center text-[8px] text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                                                    title="复制笔记"
                                                >
                                                    <i className="fa-solid fa-copy"></i>
                                                </button>
                                                <button
                                                    onClick={() => handleUnpinNote(note.id)}
                                                    className="w-6 h-6 rounded-md flex items-center justify-center text-[8px] text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
                                                    title="取消固定"
                                                >
                                                    <i className="fa-solid fa-thumbtack"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {analysis?.executiveSummary && (
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm animate-reveal">
                        <h5 className="text-[9px] font-black text-slate-400 uppercase mb-2">执行摘要 (TL;DR)</h5>
                        <p className="text-[11px] font-medium text-slate-700 leading-relaxed text-justify">
                            {analysis.executiveSummary}
                        </p>
                    </div>
                )}

                {analysis?.glossary && Array.isArray(analysis.glossary) && analysis.glossary.length > 0 && (
                    <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 animate-reveal">
                        <h5 className="text-[9px] font-black text-indigo-400 uppercase mb-2">关键术语 (Glossary)</h5>
                        <div className="space-y-2">
                            {analysis.glossary.map((g, i) => (
                                <div key={i} className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-700">{g.term}</span>
                                    <span className="text-[9px] text-slate-500 leading-tight">{g.definition}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Concept Tree */}
                {analysis?.conceptTree && Array.isArray(analysis.conceptTree) && analysis.conceptTree.length > 0 && (
                    <div className="bg-gradient-to-br from-violet-50/50 to-indigo-50/50 p-4 rounded-2xl border border-violet-100 animate-reveal">
                        <h5 className="text-[9px] font-black text-violet-500 uppercase mb-3 flex items-center gap-1.5">
                            <i className="fa-solid fa-diagram-project text-[8px]"></i> 知识结构 (Concept Map)
                        </h5>
                        <div className="space-y-2">
                            {analysis.conceptTree.map((branch, bi) => {
                                const isExpanded = expandedBranches.has(bi);
                                const iconMap: Record<string, string> = {
                                    bullseye: 'fa-bullseye', flask: 'fa-flask', lightbulb: 'fa-lightbulb', road: 'fa-road',
                                    question: 'fa-circle-question', gear: 'fa-gear', star: 'fa-star', flag: 'fa-flag'
                                };
                                const colorMap: Record<string, { bg: string; text: string; border: string; dot: string }> = {
                                    bullseye: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', dot: 'bg-rose-400' },
                                    flask: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200', dot: 'bg-sky-400' },
                                    lightbulb: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', dot: 'bg-amber-400' },
                                    road: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', dot: 'bg-emerald-400' },
                                };
                                const icon = iconMap[branch.icon] || 'fa-circle';
                                const colors = colorMap[branch.icon] || { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' };

                                return (
                                    <div key={bi} className={`rounded-xl border ${colors.border} overflow-hidden transition-all`}>
                                        <button
                                            onClick={() => setExpandedBranches(prev => {
                                                const next = new Set(prev);
                                                if (next.has(bi)) next.delete(bi); else next.add(bi);
                                                return next;
                                            })}
                                            className={`w-full px-3 py-2 flex items-center justify-between ${colors.bg} hover:brightness-95 transition-all`}
                                        >
                                            <span className={`text-[10px] font-bold ${colors.text} flex items-center gap-1.5`}>
                                                <i className={`fa-solid ${icon} text-[8px]`}></i>
                                                {branch.label}
                                                <span className="text-[8px] font-medium opacity-50">({branch.children?.length || 0})</span>
                                            </span>
                                            <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[7px] ${colors.text} opacity-40`}></i>
                                        </button>
                                        {isExpanded && branch.children && (
                                            <div className="px-3 py-2 bg-white space-y-1">
                                                {branch.children.map((child, ci) => (
                                                    <div key={ci} className="flex items-start gap-2 group/leaf">
                                                        <div className="flex flex-col items-center mt-1.5 shrink-0">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}></div>
                                                            {ci < branch.children.length - 1 && <div className={`w-px h-4 ${colors.dot} opacity-30`}></div>}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-[10px] font-bold text-slate-700">{child.label}</span>
                                                            <p className="text-[9px] text-slate-500 leading-tight mt-0.5">{child.detail}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-3 pt-2">
                    {chatHistory.map((msg, idx) => {
                        const isMatch = searchMatches.includes(idx);
                        const isActiveMatch = isMatch && searchMatches[searchMatchIdx] === idx;

                        return (
                            <div
                                key={idx}
                                ref={el => { msgRefs.current[idx] = el; }}
                                className={`flex group/msg relative ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {/* Action buttons — appears on hover */}
                                <div className={`absolute ${msg.role === 'user' ? 'left-0' : 'right-0'} top-1 flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-all z-10`}>
                                    {/* Pin button for AI messages */}
                                    {msg.role === 'model' && (
                                        <button
                                            onClick={() => handlePinMessage(msg, idx)}
                                            className="w-6 h-6 rounded-lg flex items-center justify-center text-[8px] text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-all"
                                            title="固定为研读笔记"
                                        >
                                            <i className="fa-solid fa-thumbtack"></i>
                                        </button>
                                    )}
                                    {/* Delete button */}
                                    <button
                                        onClick={() => handleDeleteMessage(idx)}
                                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[8px] text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
                                        title="删除此条消息"
                                    >
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                </div>

                                <div className={`max-w-[90%] p-3 rounded-2xl text-[11px] font-medium leading-relaxed shadow-sm transition-all ${isActiveMatch ? 'ring-2 ring-amber-400 ring-offset-1' : isMatch ? 'ring-1 ring-amber-200' : ''
                                    } ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                                        : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
                                    }`}>
                                    {/* Quoted passage block */}
                                    {msg.quote && (
                                        <div className={`mb-2 pl-2.5 border-l-2 text-[10px] leading-relaxed ${msg.role === 'user' ? 'border-indigo-300/60 text-indigo-100 italic' : 'border-indigo-300 text-slate-500 italic'}`}>
                                            <div className="flex items-center gap-1 mb-0.5">
                                                <i className="fa-solid fa-quote-left text-[7px] opacity-60"></i>
                                                <span className="text-[8px] font-black uppercase opacity-60">引用原文</span>
                                            </div>
                                            <span className="line-clamp-3">{msg.quote}</span>
                                        </div>
                                    )}
                                    {msg.role === 'model'
                                        ? (() => {
                                            // Split main answer from "📍 原文依据" section
                                            const sourceMarkers = ['📍', '📍'];
                                            const markerIdx = sourceMarkers.reduce((found, m) => {
                                                if (found >= 0) return found;
                                                const idx = msg.text.indexOf(m);
                                                return idx >= 0 ? idx : found;
                                            }, -1);

                                            if (markerIdx >= 0 && !(searchQuery && isMatch)) {
                                                const mainText = msg.text.substring(0, markerIdx).trimEnd();
                                                const sourceText = msg.text.substring(markerIdx);
                                                return (
                                                    <>
                                                        <ScientificMarkdown content={mainText} />
                                                        <details className="mt-2 border-t border-slate-100 pt-2">
                                                            <summary className="text-[9px] font-bold text-indigo-400 cursor-pointer select-none hover:text-indigo-600 transition-colors flex items-center gap-1">
                                                                <i className="fa-solid fa-bookmark text-[7px]"></i>
                                                                原文依据（点击展开）
                                                            </summary>
                                                            <div className="mt-1.5 text-[9px] text-slate-500 leading-relaxed pl-2 border-l-2 border-indigo-100">
                                                                <ScientificMarkdown content={sourceText} />
                                                            </div>
                                                        </details>
                                                    </>
                                                );
                                            }
                                            return searchQuery && isMatch
                                                ? <div>{highlightText(msg.text, searchQuery, isActiveMatch)}</div>
                                                : <ScientificMarkdown content={msg.text} />;
                                        })()
                                        : (searchQuery && isMatch
                                            ? highlightText(msg.text, searchQuery, isActiveMatch)
                                            : msg.text)
                                    }
                                </div>
                            </div>
                        );
                    })}
                    {isChatting && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef}></div>
                </div>
            </div>

            {/* Input area */}
            <div className="p-4 bg-white border-t border-slate-200 shrink-0">
                {analysis?.keyQuestions && Array.isArray(analysis.keyQuestions) && chatHistory.length < 2 && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 pb-1">
                        {analysis.keyQuestions.map((q, i) => (
                            <button
                                key={i}
                                onClick={() => handleSendMessage(q)}
                                className="whitespace-nowrap px-3 py-1.5 bg-slate-50 text-indigo-600 border border-indigo-100 rounded-lg text-[9px] font-bold hover:bg-indigo-50 transition-colors"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                )}

                {/* Quote input area (collapsible) */}
                {quoteMode && (
                    <div className="mb-3 animate-reveal">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                                <i className="fa-solid fa-quote-left text-[7px]"></i> 引用原文段落
                            </span>
                            <button
                                onClick={() => { setQuoteMode(false); setQuoteText(''); }}
                                className="text-[8px] text-slate-400 hover:text-rose-500 transition-colors"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <textarea
                            ref={quoteInputRef}
                            className="w-full bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 text-[10px] font-medium text-slate-700 leading-relaxed outline-none resize-none focus:ring-2 focus:ring-indigo-200 transition-all placeholder:text-indigo-300 italic"
                            rows={3}
                            placeholder="从 PDF 原文中复制一段话粘贴到这里，然后在下方输入您的问题..."
                            value={quoteText}
                            onChange={e => setQuoteText(e.target.value)}
                        />
                    </div>
                )}

                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                    {/* Quote toggle button */}
                    <button
                        onClick={() => {
                            setQuoteMode(!quoteMode);
                            if (!quoteMode) setTimeout(() => quoteInputRef.current?.focus(), 100);
                        }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all shrink-0 ${quoteMode
                            ? 'bg-indigo-600 text-white shadow-md'
                            : quoteText
                                ? 'bg-indigo-100 text-indigo-600'
                                : 'text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'
                            }`}
                        title={quoteMode ? '关闭引用' : '引用原文段落提问'}
                    >
                        <i className="fa-solid fa-quote-left text-xs"></i>
                    </button>

                    <input
                        className="flex-1 bg-transparent text-[11px] font-medium outline-none px-2 text-slate-700 placeholder:text-slate-400"
                        placeholder={quoteMode ? '针对上方引用段落提问...' : '向这篇文献提问...'}
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                        disabled={isChatting}
                    />
                    <button
                        onClick={() => handleSendMessage()}
                        disabled={!chatInput.trim() || isChatting}
                        className="w-8 h-8 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md"
                    >
                        <i className="fa-solid fa-paper-plane text-xs"></i>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className={`flex-1 overflow-hidden animate-reveal no-print bg-white flex ${isReaderMode ? 'flex-row' : 'flex-col'}`}>
            <div className={`flex-1 flex flex-col overflow-y-auto custom-scrollbar p-6 lg:p-8 space-y-6 transition-all duration-500 ${isReaderMode ? 'w-1/2 lg:w-3/5 border-r border-slate-100' : 'w-full'}`}>
                <header className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-100 pb-4 shrink-0 gap-6">
                    <div className="flex-1 pr-6 min-w-0">
                        <div className="flex gap-2 mb-2 flex-wrap items-center">
                            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase border shadow-sm ${activeType === '文献' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : activeType === '专利' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{item.type}</span>
                            <span className="bg-slate-900 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase shadow-md">{item.year || new Date().getFullYear()}</span>
                            {item.knowledgeSinked && (
                                <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase shadow-md animate-reveal">
                                    <i className="fa-solid fa-database mr-1"></i> 已知识沉淀
                                </span>
                            )}
                            <button
                                onClick={toggleEditMode}
                                className={`px-3 py-1 rounded-full text-[8px] font-black uppercase border shadow-sm transition-all active:scale-95 flex items-center gap-1 ${isEditMode ? 'bg-indigo-600 text-white border-indigo-600 animate-pulse' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                            >
                                <i className={`fa-solid ${isEditMode ? 'fa-check' : 'fa-pen'} text-[7px]`}></i>
                                {isEditMode ? '完成编辑' : '编辑'}
                            </button>
                            <button
                                onClick={handleExportCitation}
                                className="px-3 py-1 rounded-full text-[8px] font-black uppercase border shadow-sm transition-all active:scale-95 flex items-center gap-1 bg-white text-slate-400 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                                title="导出引用文献文本 (Cite)"
                            >
                                <i className="fa-solid fa-quote-left text-[7px]"></i>
                                Cite
                            </button>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 leading-tight italic tracking-tighter mb-2 truncate">
                            {String(item.title || '')}
                        </h3>
                        {item.englishTitle && (
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-tight mb-2 font-serif leading-snug truncate">
                                {String(item.englishTitle || '')}
                            </h4>
                        )}
                    </div>

                    {/* 替换删除条目位置后的 2x2 宫格按钮组 */}
                    <div className="grid grid-cols-2 gap-2 shrink-0 w-full sm:w-64">
                        <button
                            onClick={() => setIsReaderMode(!isReaderMode)}
                            className={`h-10 rounded-xl text-[10px] font-black uppercase shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 border ${isReaderMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                        >
                            <i className={`fa-solid ${isReaderMode ? 'fa-book-open-reader' : 'fa-book'} ${isReaderMode ? 'text-white' : 'text-indigo-500'}`}></i>
                            {isReaderMode ? '退出研读' : '深度研读'}
                        </button>

                        <button
                            onClick={() => onKnowledgeSink?.(item.id)}
                            disabled={isSinking}
                            className={`h-10 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl text-[10px] font-black hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50`}
                            title="结构化提取文中图表与参数"
                        >
                            {isSinking ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-database"></i>}
                            知识沉淀
                        </button>

                        {existingProposalId ? (
                            <button
                                onClick={() => onJumpToProposal?.(existingProposalId)}
                                className="h-10 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-xl text-[10px] font-black hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"
                            >
                                <i className="fa-solid fa-arrow-up-right-from-square"></i>
                                跳转原建议
                            </button>
                        ) : (
                            <button
                                onClick={() => onStartTransformation()}
                                disabled={isGenerating}
                                className="h-10 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl text-[10px] font-black hover:bg-amber-600 hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                            >
                                {isGenerating ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-bolt"></i>}
                                转化建议
                            </button>
                        )}

                        {/* 原删除位置现在变为本地档案操作 */}
                        <button
                            onClick={item.localPath ? onOpenLocalFile : onLinkLocalFile}
                            className={`h-10 rounded-xl text-[10px] font-black uppercase shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 border ${item.localPath ? 'bg-sky-600 text-white border-sky-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'}`}
                        >
                            <i className={`fa-solid ${item.localPath ? 'fa-folder-open' : 'fa-link'} ${item.localPath ? 'text-white' : 'text-sky-500'}`}></i>
                            {item.localPath ? '查看档案' : '关联本地'}
                        </button>
                    </div>
                </header>

                {isReaderMode && item.localPath ? (
                    <div className="flex-1 w-full min-h-[500px] rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100 mt-4 flex items-center justify-center relative">
                        {localPdfBase64 ? (
                            <iframe
                                src={localPdfBase64}
                                className="w-full h-full border-0 absolute inset-0"
                                title="PDF Archive"
                                key={item.id} // Force unmount/remount when switching items
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 gap-4 p-8 text-center">
                                <i className="fa-solid fa-file-pdf text-5xl mb-2 opacity-20"></i>
                                {isAnalyzing ? (
                                    <>
                                        <i className="fa-solid fa-spinner animate-spin text-3xl text-indigo-500"></i>
                                        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">正在解析 PDF 核心数据...</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-xs font-bold uppercase tracking-widest">PDF 未载入或已重置</span>
                                        <button
                                            onClick={startDeepAnalysis}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg"
                                        >
                                            重试加载 PDF
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-8">
                        <section className={`bg-slate-50 p-6 rounded-[2rem] shadow-sm border border-slate-100 relative overflow-hidden group ${!isEditMode ? 'select-none' : ''}`}>
                            <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                                <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">学术摘要 (ABSTRACT)</h5>
                                {isEditMode && editingField !== 'abstract' && (
                                    <button
                                        onClick={() => { setEditingField('abstract'); setEditBuffer(item.abstract); }}
                                        className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                        title="编辑摘要"
                                    >
                                        <i className="fa-solid fa-pen-to-square"></i>
                                    </button>
                                )}
                            </div>
                            {isEditMode && editingField === 'abstract' ? (
                                <div className="space-y-2">
                                    <textarea
                                        className="w-full bg-white border border-indigo-200 rounded-xl p-3 text-[12px] font-medium text-slate-800 leading-relaxed outline-none resize-none focus:ring-2 focus:ring-indigo-200 transition-all min-h-[120px]"
                                        value={editBuffer || ''}
                                        onChange={e => setEditBuffer(e.target.value)}
                                        autoFocus
                                        rows={6}
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => { setEditingField(null); setEditBuffer(null); }} className="px-3 py-1.5 text-[9px] font-bold text-slate-400 hover:text-slate-600 transition-all">取消</button>
                                        <button onClick={() => commitEdit({ abstract: editBuffer })} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase shadow-md active:scale-95 transition-all">保存</button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[13px] leading-relaxed font-black text-slate-900 whitespace-pre-wrap italic tracking-tight opacity-95">
                                    {item.abstract}
                                </p>
                            )}
                        </section>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 italic">
                                    {activeType === '商业竞品' ? '技术优势 (Highlights)' : '核心工艺 (Methodology)'}
                                </h5>
                                <div className={`grid grid-cols-1 gap-2.5 ${!isEditMode ? 'select-none' : ''}`}>
                                    {item.synthesisSteps?.map((step, idx) => (
                                        <div key={idx} className={`p-4 bg-white rounded-2xl flex gap-4 border border-slate-100 hover:border-indigo-100 transition-all shadow-sm ${isEditMode ? 'group/step relative' : ''}`}>
                                            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs shrink-0 shadow-inner">{step.step || idx + 1}</div>
                                            {isEditMode && editingField === `step_${idx}` ? (
                                                <div className="flex-1 space-y-2 min-w-0">
                                                    <input
                                                        className="w-full bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-200"
                                                        value={editBuffer?.title || ''}
                                                        onChange={e => setEditBuffer({ ...editBuffer, title: e.target.value })}
                                                        placeholder="步骤标题"
                                                        autoFocus
                                                    />
                                                    <textarea
                                                        className="w-full bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-600 outline-none resize-none focus:ring-2 focus:ring-indigo-200 min-h-[60px]"
                                                        value={editBuffer?.content || ''}
                                                        onChange={e => setEditBuffer({ ...editBuffer, content: e.target.value })}
                                                        placeholder="操作描述"
                                                        rows={3}
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => { setEditingField(null); setEditBuffer(null); }} className="px-2 py-1 text-[8px] font-bold text-slate-400">取消</button>
                                                        <button onClick={() => {
                                                            const updated = [...(item.synthesisSteps || [])];
                                                            updated[idx] = { ...updated[idx], title: editBuffer.title, content: editBuffer.content };
                                                            commitEdit({ synthesisSteps: updated });
                                                        }} className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase shadow-sm">保存</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    className={`min-w-0 flex-1 ${isEditMode ? 'cursor-pointer hover:bg-slate-50 rounded-lg p-1 -m-1 transition-colors' : ''}`}
                                                    onDoubleClick={isEditMode ? () => { setEditingField(`step_${idx}`); setEditBuffer({ title: step.title, content: step.content }); } : undefined}
                                                    title={isEditMode ? "双击编辑" : undefined}
                                                >
                                                    <p className="text-[11px] font-black text-slate-800 uppercase mb-1">{String(step.title || '工序')}</p>
                                                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{String(step.content || '无详细内容')}</p>
                                                </div>
                                            )}
                                            {/* Delete button — only in edit mode */}
                                            {isEditMode && editingField !== `step_${idx}` && (
                                                <button
                                                    onClick={() => {
                                                        const updated = (item.synthesisSteps || []).filter((_, i) => i !== idx).map((s, i) => ({ ...s, step: i + 1 }));
                                                        commitEdit({ synthesisSteps: updated });
                                                    }}
                                                    className="w-6 h-6 rounded-md flex items-center justify-center text-[8px] text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover/step:opacity-100 shrink-0"
                                                    title="删除此步骤"
                                                >
                                                    <i className="fa-solid fa-xmark"></i>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {(!item.synthesisSteps || item.synthesisSteps.length === 0) && (
                                        <div className="text-center py-10 text-slate-300 text-[10px] italic border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center gap-2">
                                            <i className="fa-solid fa-vial-circle-check text-xl opacity-20"></i>
                                            暂无工艺步骤数据
                                        </div>
                                    )}
                                    {/* Add step button — only in edit mode */}
                                    {isEditMode && (
                                        <button
                                            onClick={() => {
                                                const steps = [...(item.synthesisSteps || [])];
                                                steps.push({ step: steps.length + 1, title: '新步骤', content: '请输入操作描述' });
                                                commitEdit({ synthesisSteps: steps });
                                            }}
                                            className="w-full py-2 bg-slate-50 text-slate-400 border border-dashed border-slate-200 rounded-xl text-[9px] font-bold uppercase hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                                        >
                                            <i className="fa-solid fa-plus mr-1"></i> 添加步骤
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2 italic">沉淀参数 (Benchmarking Metrics)</h5>
                                <div className={`grid grid-cols-1 gap-2.5 ${!isEditMode ? 'select-none' : ''}`}>
                                    {item.performance?.map((p, i) => (
                                        <div key={i} className={isEditMode ? 'group/perf relative' : ''}>
                                            {isEditMode && editingField === `perf_${i}` ? (
                                                <div className="flex gap-2 items-center p-3 bg-white rounded-2xl border border-emerald-200 shadow-sm">
                                                    <input
                                                        className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-slate-600 outline-none focus:ring-2 focus:ring-emerald-200"
                                                        value={editBuffer?.label || ''}
                                                        onChange={e => setEditBuffer({ ...editBuffer, label: e.target.value })}
                                                        placeholder="指标名"
                                                        autoFocus
                                                    />
                                                    <input
                                                        className="w-[140px] bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[12px] font-black text-emerald-600 font-mono outline-none focus:ring-2 focus:ring-emerald-200 text-right"
                                                        value={editBuffer?.value || ''}
                                                        onChange={e => setEditBuffer({ ...editBuffer, value: e.target.value })}
                                                        placeholder="数值"
                                                    />
                                                    <button onClick={() => { setEditingField(null); setEditBuffer(null); }} className="text-[8px] text-slate-400 px-1">取消</button>
                                                    <button onClick={() => {
                                                        const updated = [...(item.performance || [])];
                                                        updated[i] = { label: editBuffer.label, value: editBuffer.value };
                                                        commitEdit({ performance: updated });
                                                    }} className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-[8px] font-black shadow-sm">保存</button>
                                                </div>
                                            ) : (
                                                <div
                                                    className={`flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-emerald-200 transition-all ${isEditMode ? 'cursor-pointer' : ''}`}
                                                    onDoubleClick={isEditMode ? () => { setEditingField(`perf_${i}`); setEditBuffer({ label: p.label, value: p.value }); } : undefined}
                                                    title={isEditMode ? "双击编辑" : undefined}
                                                >
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase">{String(p.label || '参数')}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[13px] font-black text-emerald-600 font-mono italic">{String(p.value || '-')}</span>
                                                        {isEditMode && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const updated = (item.performance || []).filter((_, idx) => idx !== i);
                                                                    commitEdit({ performance: updated });
                                                                }}
                                                                className="w-5 h-5 rounded flex items-center justify-center text-[7px] text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover/perf:opacity-100"
                                                                title="删除"
                                                            >
                                                                <i className="fa-solid fa-xmark"></i>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {(!item.performance || item.performance.length === 0) && (
                                        <div className="text-center py-10 text-slate-300 text-[10px] italic border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center gap-2">
                                            <i className="fa-solid fa-chart-line text-xl opacity-20"></i>
                                            暂无沉淀参数数据
                                        </div>
                                    )}
                                    {/* Add metric button — only in edit mode */}
                                    {isEditMode && (
                                        <button
                                            onClick={() => {
                                                const perfs = [...(item.performance || [])];
                                                perfs.push({ label: '新指标', value: '待填入' });
                                                commitEdit({ performance: perfs });
                                            }}
                                            className="w-full py-2 bg-slate-50 text-slate-400 border border-dashed border-slate-200 rounded-xl text-[9px] font-bold uppercase hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all"
                                        >
                                            <i className="fa-solid fa-plus mr-1"></i> 添加指标
                                        </button>
                                    )}
                                </div>

                                {item.extractedTables && item.extractedTables.length > 0 && (
                                    <div className="mt-4 p-5 bg-indigo-50/50 rounded-[2rem] border border-indigo-100">
                                        <h5 className="text-[8px] font-black text-indigo-400 uppercase mb-3 flex items-center gap-2">
                                            <i className="fa-solid fa-table"></i> 文中数据表记录 ({item.extractedTables.length})
                                        </h5>
                                        <div className="space-y-2">
                                            {item.extractedTables.map(table => (
                                                <div key={table.id} className="bg-white p-3 rounded-xl border border-indigo-100 flex justify-between items-center group/table hover:bg-indigo-600 hover:text-white transition-all cursor-pointer">
                                                    <span className="text-[10px] font-bold truncate pr-2 italic">{table.title}</span>
                                                    <i className="fa-solid fa-eye text-[8px] opacity-0 group-hover/table:opacity-100"></i>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><i className="fa-solid fa-link text-4xl"></i></div>
                                    <h5 className="text-[8px] font-black text-slate-400 uppercase mb-4 border-b border-slate-50 pb-2">引文源与本地关联</h5>

                                    <div className="space-y-4">
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-black text-slate-700 leading-snug italic line-clamp-2">{item.source || "Open Academic Database"}</p>
                                            <p className="text-[10px] text-slate-400 mt-1 truncate">{Array.isArray(item.authors) ? item.authors.join(', ') : 'Unknown Author'}</p>
                                        </div>

                                        {/* DOI 展示/编辑 */}
                                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                            <span className="text-[8px] font-black text-slate-400 uppercase shrink-0">DOI</span>
                                            {isEditMode && editingField === 'doi' ? (
                                                <>
                                                    <input
                                                        className="flex-1 bg-white border border-indigo-200 rounded-lg px-2.5 py-1 text-[10px] font-mono text-slate-700 outline-none focus:ring-2 focus:ring-indigo-200"
                                                        value={editBuffer || ''}
                                                        onChange={e => setEditBuffer(e.target.value)}
                                                        placeholder="例: 10.1021/jacs.5b13849"
                                                        autoFocus
                                                    />
                                                    <button onClick={() => { setEditingField(null); setEditBuffer(null); }} className="text-[8px] text-slate-400 px-1">取消</button>
                                                    <button onClick={() => commitEdit({ doi: editBuffer?.trim() || '' })} className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-[8px] font-black shadow-sm">保存</button>
                                                </>
                                            ) : item.doi ? (
                                                <>
                                                    <a
                                                        href={`https://doi.org/${item.doi}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-1 text-[10px] font-mono text-indigo-600 hover:text-indigo-800 hover:underline truncate transition-colors"
                                                        title={item.doi}
                                                    >
                                                        {item.doi}
                                                    </a>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.doi!); showToast({ message: 'DOI 已复制', type: 'success' }); }}
                                                        className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all shrink-0"
                                                        title="复制 DOI"
                                                    >
                                                        <i className="fa-solid fa-copy"></i>
                                                    </button>
                                                    {isEditMode && (
                                                        <button
                                                            onClick={() => { setEditingField('doi'); setEditBuffer(item.doi || ''); }}
                                                            className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all shrink-0"
                                                            title="编辑 DOI"
                                                        >
                                                            <i className="fa-solid fa-pen text-[7px]"></i>
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <span className="flex-1 text-[9px] text-slate-300 italic">暂无 DOI</span>
                                                    {isEditMode && (
                                                        <button
                                                            onClick={() => { setEditingField('doi'); setEditBuffer(''); }}
                                                            className="px-2 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-[8px] font-bold hover:bg-indigo-600 hover:text-white transition-all shrink-0"
                                                        >
                                                            <i className="fa-solid fa-plus text-[7px] mr-1"></i>添加
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {/* Category Selector — Multi-select */}
                                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-[8px] font-black text-slate-400 uppercase shrink-0"><i className="fa-solid fa-layer-group text-[7px] mr-1"></i>分类</span>
                                                {isEditMode && editingField !== 'category' && (
                                                    <button
                                                        onClick={() => { setEditingField('category'); setEditBuffer([...(item.categories || (item.category ? [item.category] : []))]); }}
                                                        className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all shrink-0"
                                                        title="修改分类"
                                                    >
                                                        <i className="fa-solid fa-pen text-[7px]"></i>
                                                    </button>
                                                )}
                                            </div>
                                            {isEditMode && editingField === 'category' ? (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        {allCategories.map(cat => {
                                                            const isActive = Array.isArray(editBuffer) && editBuffer.includes(cat);
                                                            return (
                                                                <button
                                                                    key={cat}
                                                                    onClick={() => {
                                                                        const arr = Array.isArray(editBuffer) ? [...editBuffer] : [];
                                                                        if (isActive) {
                                                                            setEditBuffer(arr.filter((c: string) => c !== cat));
                                                                        } else {
                                                                            setEditBuffer([...arr, cat]);
                                                                        }
                                                                    }}
                                                                    className={`px-2 py-0.5 rounded-lg text-[8px] font-bold border transition-all ${isActive ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                                                                >
                                                                    {isActive && <i className="fa-solid fa-check text-[6px] mr-1"></i>}
                                                                    {cat}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    <div className="flex gap-1.5 items-center">
                                                        <input
                                                            className="flex-1 bg-white border border-indigo-200 rounded-lg px-2.5 py-1 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-200"
                                                            placeholder="输入自定义分类后按 Enter 添加..."
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') {
                                                                    const val = (e.target as HTMLInputElement).value.trim();
                                                                    if (val) {
                                                                        const arr = Array.isArray(editBuffer) ? [...editBuffer] : [];
                                                                        if (!arr.includes(val)) {
                                                                            setEditBuffer([...arr, val]);
                                                                        }
                                                                        (e.target as HTMLInputElement).value = '';
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                        <button onClick={() => { setEditingField(null); setEditBuffer(null); }} className="text-[8px] text-slate-400 px-1">取消</button>
                                                        <button onClick={() => {
                                                            const cats = Array.isArray(editBuffer) ? editBuffer.filter((c: string) => c.trim()) : [];
                                                            commitEdit({ categories: cats, category: cats[0] || undefined });
                                                        }} className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-[8px] font-black shadow-sm">保存</button>
                                                    </div>
                                                    {Array.isArray(editBuffer) && editBuffer.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
                                                            <span className="text-[7px] text-slate-300 font-bold uppercase mr-1">已选:</span>
                                                            {editBuffer.map((cat: string, idx: number) => (
                                                                <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[7px] font-bold">
                                                                    {cat}
                                                                    <button onClick={() => setEditBuffer((editBuffer as string[]).filter((_: string, i: number) => i !== idx))} className="text-indigo-400 hover:text-rose-500 transition-colors">
                                                                        <i className="fa-solid fa-xmark text-[6px]"></i>
                                                                    </button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-1">
                                                    {(item.categories && item.categories.length > 0) ? (
                                                        item.categories.map((cat, idx) => (
                                                            <span key={idx} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-bold border border-indigo-100">
                                                                {cat}
                                                            </span>
                                                        ))
                                                    ) : item.category ? (
                                                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-bold border border-indigo-100">
                                                            {item.category}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] text-slate-300 italic">未分类</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className={`p-3 rounded-xl border flex flex-col gap-2 ${item.localPath ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[8px] font-black text-slate-400 uppercase">本地档案状态</span>
                                                {item.localPath && <span className="text-[8px] font-black text-emerald-600 uppercase">已就绪</span>}
                                            </div>
                                            {item.localPath ? (
                                                <p className="text-[9px] font-mono text-slate-500 truncate" title={item.localPath}>{item.localPath}</p>
                                            ) : (
                                                <p className="text-[9px] text-slate-400 italic">尚未关联本地 PDF 文件</p>
                                            )}
                                            <div className="flex gap-2 mt-1">
                                                {item.localPath ? (
                                                    <>
                                                        <button onClick={onOpenLocalFile} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase shadow-md active:scale-95">打开本地文件</button>
                                                        <button onClick={onLinkLocalFile} className="px-3 py-2 bg-white border border-emerald-200 text-emerald-600 rounded-lg text-[9px] font-black uppercase hover:bg-emerald-50">重选</button>
                                                    </>
                                                ) : (
                                                    <button onClick={onLinkLocalFile} className="w-full py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">关联本地 PDF 档案</button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex gap-2 items-center justify-between">
                                            <a href={safeUrl(item.url)} target="_blank" rel="noopener noreferrer" className="flex-1 text-center py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase hover:bg-indigo-600 transition-colors shadow-md">
                                                访问原文链接
                                            </a>
                                            {item.bibtex && (
                                                <button onClick={() => { navigator.clipboard.writeText(item.bibtex!); showToast({ message: "BibTeX 已复制", type: "success" }) }} className="mx-2 px-3 h-[40px] bg-white text-slate-500 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-slate-200">
                                                    <i className="fa-solid fa-quote-left text-xs"></i>
                                                </button>
                                            )}
                                            {/* 原 2x2 宫格的删除按钮移至此处，作为安全、次要的操作 */}
                                            <button
                                                onClick={() => onDelete(item.id)}
                                                className="px-3 h-[40px] bg-rose-50 text-rose-500 border border-rose-100 rounded-xl hover:bg-rose-500 hover:text-white transition-all active:scale-95"
                                                title="移除该条目"
                                            >
                                                <i className="fa-solid fa-trash-can text-xs"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {/* Notebook Assistant — 始终挂载，通过 CSS 控制显隐，避免退出研读时中断进行中的 AI 对话 */}
            <div className={`${isReaderMode ? 'w-1/2 lg:w-2/5 h-full animate-in slide-in-from-right duration-300' : 'hidden'}`}>
                {renderReaderContent()}
            </div>
        </div>
    );
};

export default LiteratureDetail;