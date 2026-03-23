import React, { useState } from 'react';
import { ReviewerComment, SubmissionRound } from '../../../types';
import { parseDecisionLetter, generateResponseLetter, generateSingleReply } from '../../../services/gemini/submission';
import ReactMarkdown from 'react-markdown';

interface ResponseLetterPanelProps {
    currentRound: SubmissionRound | undefined;
    allRounds: SubmissionRound[];
    onSelectRound: (roundId: string) => void;
    paperTitle: string;
    sectionsContent: string;
    language: 'zh' | 'en';
    onUpdateRound: (round: SubmissionRound) => void;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    major: { label: 'MAJOR', color: 'text-rose-600', bg: 'bg-rose-100' },
    minor: { label: 'MINOR', color: 'text-amber-600', bg: 'bg-amber-100' },
    positive: { label: 'POSITIVE', color: 'text-emerald-600', bg: 'bg-emerald-100' }
};

const STATUS_BADGE: Record<string, { label: string; icon: string; color: string }> = {
    pending: { label: '待回复', icon: 'fa-hourglass-half', color: 'text-amber-500' },
    addressed: { label: '已回复', icon: 'fa-check', color: 'text-emerald-500' },
    rebutted: { label: '已反驳', icon: 'fa-shield', color: 'text-indigo-500' }
};

const ResponseLetterPanel: React.FC<ResponseLetterPanelProps> = ({
    currentRound, allRounds, onSelectRound, paperTitle, sectionsContent, language, onUpdateRound
}) => {
    const [decisionText, setDecisionText] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);
    const [generatingReplyId, setGeneratingReplyId] = useState<string | null>(null);
    const [showReparse, setShowReparse] = useState(false);

    if (!currentRound) {
        return (
            <div className="h-64 flex flex-col items-center justify-center opacity-30 gap-4">
                <i className="fa-solid fa-inbox text-5xl" />
                <p className="text-sm font-black uppercase tracking-[0.2rem]">请先在「投稿跟踪」中创建轮次</p>
            </div>
        );
    }

    const comments = currentRound.reviewerComments || [];
    const addressedCount = comments.filter(c => c.status !== 'pending').length;

    const handleParseDecision = async () => {
        if (!decisionText.trim()) return;
        setIsParsing(true);
        try {
            const parsed = await parseDecisionLetter(decisionText, language);
            onUpdateRound({
                ...currentRound,
                decisionLetter: decisionText,
                reviewerComments: [...comments, ...parsed]
            });
            setDecisionText('');
            setShowReparse(false);
        } catch { /* noop */ } finally {
            setIsParsing(false);
        }
    };

    const handleUpdateComment = (commentId: string, updates: Partial<ReviewerComment>) => {
        onUpdateRound({
            ...currentRound,
            reviewerComments: comments.map(c => c.id === commentId ? { ...c, ...updates } : c)
        });
    };

    // #3 AI 单条回复
    const handleAISingleReply = async (comment: ReviewerComment) => {
        setGeneratingReplyId(comment.id);
        try {
            const reply = await generateSingleReply(comment, paperTitle, sectionsContent, language);
            handleUpdateComment(comment.id, { response: reply, status: 'addressed' });
        } catch { /* noop */ } finally {
            setGeneratingReplyId(null);
        }
    };

    const handleGenerateResponseLetter = async () => {
        setIsGenerating(true);
        try {
            const letter = await generateResponseLetter(comments, paperTitle, sectionsContent, language);
            onUpdateRound({ ...currentRound, responseLetter: letter });
        } catch { /* noop */ } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6 pb-12">
            <div className="flex justify-between items-center mb-2">
                <h4 className="text-xl font-black text-slate-800 uppercase italic border-l-4 border-teal-500 pl-4">
                    审稿意见管理
                </h4>
                {/* #2 轮次切换器 */}
                {allRounds.length > 1 && (
                    <select
                        value={currentRound.id}
                        onChange={e => onSelectRound(e.target.value)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 text-[10px] font-black text-slate-600 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-300 appearance-none cursor-pointer pr-8"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '14px' }}
                    >
                        {allRounds.map(r => (
                            <option key={r.id} value={r.id}>R{r.roundNumber} · {r.journal}</option>
                        ))}
                    </select>
                )}
                {allRounds.length <= 1 && (
                    <span className="text-[10px] font-black text-slate-400 uppercase">
                        R{currentRound.roundNumber} · {currentRound.journal}
                    </span>
                )}
            </div>

            {/* 决定信输入区 — #5 始终可追加 */}
            {(comments.length === 0 || showReparse) && (
                <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {comments.length > 0 ? '追加解析新决定信' : '粘贴编辑决定信 / 审稿意见'}
                    </p>
                    <textarea
                        value={decisionText}
                        onChange={e => setDecisionText(e.target.value)}
                        placeholder="将编辑决定信或审稿人意见粘贴到此处，AI 将自动解析并拆分为逐条意见..."
                        className="w-full p-4 rounded-2xl border-2 border-dashed border-teal-200 text-xs font-medium resize-none h-40 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400 bg-teal-50/30"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={handleParseDecision}
                            disabled={isParsing || !decisionText.trim()}
                            className="flex-1 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-2xl text-xs font-black uppercase shadow-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isParsing ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-scissors" />}
                            {isParsing ? 'AI 正在解析审稿意见...' : 'AI 智能解析审稿意见'}
                        </button>
                        {comments.length > 0 && (
                            <button
                                onClick={() => setShowReparse(false)}
                                className="px-4 py-3 bg-white text-slate-400 rounded-2xl text-xs font-bold border border-slate-200 hover:text-slate-600 transition-all"
                            >取消</button>
                        )}
                    </div>
                </div>
            )}

            {/* 意见列表 */}
            {comments.length > 0 && !showReparse && (
                <>
                    {/* 统计条 + 追加按钮 */}
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex-1">
                            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500"
                                    style={{ width: `${comments.length ? (addressedCount / comments.length) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                        <span className="text-[10px] font-black text-slate-500 shrink-0">
                            {addressedCount}/{comments.length} 已处理
                        </span>
                        {/* #5 追加解析入口 */}
                        <button
                            onClick={() => setShowReparse(true)}
                            className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-600 text-[8px] font-black uppercase hover:bg-teal-100 transition-all shrink-0"
                            title="追加解析新的审稿意见"
                        >
                            <i className="fa-solid fa-plus mr-1" />追加
                        </button>
                    </div>

                    <div className="space-y-3">
                        {comments.map(c => {
                            const tc = TYPE_CONFIG[c.type] || TYPE_CONFIG.minor;
                            const sc = STATUS_BADGE[c.status] || STATUS_BADGE.pending;
                            const isExpanded = expandedCommentId === c.id;
                            const isGeneratingThis = generatingReplyId === c.id;

                            return (
                                <div key={c.id} className={`rounded-[1.5rem] border-2 transition-all overflow-hidden ${c.status === 'pending' ? 'border-slate-200' : 'border-emerald-200/60'}`}>
                                    {/* 意见头 */}
                                    <div
                                        className="p-4 cursor-pointer flex items-start gap-3 hover:bg-slate-50/80 transition-colors"
                                        onClick={() => setExpandedCommentId(isExpanded ? null : c.id)}
                                    >
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase shrink-0 mt-0.5 ${tc.bg} ${tc.color}`}>{tc.label}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-black text-slate-400">{c.reviewerLabel}</span>
                                                <span className={`text-[9px] font-bold ${sc.color}`}>
                                                    <i className={`fa-solid ${sc.icon} mr-0.5`} />{sc.label}
                                                </span>
                                            </div>
                                            <p className={`text-[11px] font-medium text-slate-700 leading-relaxed ${!isExpanded ? 'line-clamp-2' : ''}`}>{c.content}</p>
                                        </div>
                                        <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-slate-300 text-xs mt-1 shrink-0`} />
                                    </div>

                                    {/* 展开回复编辑 */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 pt-0 border-t border-slate-100 space-y-3" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center justify-between pt-3">
                                                <p className="text-[9px] font-black text-teal-600 uppercase tracking-widest">回复草稿</p>
                                                {/* #3 AI 单条回复按钮 */}
                                                <button
                                                    onClick={() => handleAISingleReply(c)}
                                                    disabled={isGeneratingThis}
                                                    className="px-3 py-1 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-[8px] font-black uppercase shadow hover:shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                                                >
                                                    {isGeneratingThis ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-wand-magic-sparkles" />}
                                                    {isGeneratingThis ? 'AI 生成中...' : 'AI 辅助回复'}
                                                </button>
                                            </div>
                                            <textarea
                                                value={c.response || ''}
                                                onChange={e => handleUpdateComment(c.id, { response: e.target.value })}
                                                placeholder="输入对该条意见的回复...（或点击右上角 AI 辅助回复）"
                                                className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium resize-none h-24 focus:outline-none focus:ring-2 focus:ring-teal-200"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleUpdateComment(c.id, { status: 'addressed' })}
                                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${c.status === 'addressed' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                                                >
                                                    <i className="fa-solid fa-check mr-1" />已回复
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateComment(c.id, { status: 'rebutted' })}
                                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${c.status === 'rebutted' ? 'bg-indigo-500 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                                                >
                                                    <i className="fa-solid fa-shield mr-1" />已反驳
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateComment(c.id, { status: 'pending' })}
                                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${c.status === 'pending' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'}`}
                                                >
                                                    <i className="fa-solid fa-hourglass-half mr-1" />待处理
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* 一键生成 Response Letter */}
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                        <button
                            onClick={handleGenerateResponseLetter}
                            disabled={isGenerating}
                            className="w-full py-4 bg-gradient-to-r from-teal-600 via-cyan-600 to-indigo-600 text-white rounded-2xl text-xs font-black uppercase shadow-xl hover:shadow-2xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                        >
                            {isGenerating ? <i className="fa-solid fa-spinner animate-spin text-lg" /> : <i className="fa-solid fa-wand-magic-sparkles text-lg" />}
                            {isGenerating ? 'AI 正在撰写 Response Letter...' : '一键生成 Response Letter'}
                        </button>

                        {currentRound.responseLetter && (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest">生成结果</p>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(currentRound.responseLetter || '')}
                                        className="px-4 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase hover:bg-teal-600 hover:text-white transition-all"
                                    >
                                        <i className="fa-solid fa-copy mr-1" />复制全文
                                    </button>
                                </div>
                                <div className="bg-slate-50 rounded-[2rem] p-8 shadow-inner border border-slate-100 max-h-[50vh] overflow-y-auto custom-scrollbar">
                                    <div className="prose prose-sm prose-slate max-w-none">
                                        <ReactMarkdown>{currentRound.responseLetter}</ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default ResponseLetterPanel;
