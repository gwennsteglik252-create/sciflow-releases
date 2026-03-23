import React, { useState } from 'react';
import { JournalMatch } from '../../../types';
import { recommendJournals } from '../../../services/gemini/submission';

interface JournalRecommendPanelProps {
    title: string;
    abstract: string;
    keywords: string[];
    language: 'zh' | 'en';
    targetJournals: JournalMatch[];
    onUpdateJournals: (journals: JournalMatch[]) => void;
    onSelectJournal: (journal: JournalMatch) => void;
    onCreateRound?: (journal: JournalMatch) => void;
}

const JournalRecommendPanel: React.FC<JournalRecommendPanelProps> = ({
    title, abstract, keywords, language, targetJournals, onUpdateJournals, onSelectJournal, onCreateRound
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

    const handleRecommend = async () => {
        setIsLoading(true);
        try {
            const results = await recommendJournals(title, abstract, keywords, language);
            onUpdateJournals(results);
        } catch {
            // error handled by caller
        } finally {
            setIsLoading(false);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-emerald-600';
        if (score >= 60) return 'text-amber-600';
        return 'text-rose-500';
    };

    const getScoreRingColor = (score: number) => {
        if (score >= 80) return 'stroke-emerald-500';
        if (score >= 60) return 'stroke-amber-500';
        return 'stroke-rose-400';
    };

    const getTierBadge = (score: number) => {
        if (score >= 80) return { label: '首选', bg: 'bg-emerald-100 text-emerald-700' };
        if (score >= 60) return { label: '推荐', bg: 'bg-sky-100 text-sky-700' };
        return { label: '保底', bg: 'bg-slate-100 text-slate-500' };
    };

    return (
        <div className="space-y-6 pb-12">
            <div className="flex justify-between items-center mb-4">
                <h4 className="text-xl font-black text-slate-800 uppercase italic border-l-4 border-sky-500 pl-4">
                    AI 期刊推荐引擎
                </h4>
                <button
                    onClick={handleRecommend}
                    disabled={isLoading || !title}
                    className="px-6 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                    {isLoading ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-wand-magic-sparkles" />}
                    {isLoading ? '推荐中...' : '智能推荐期刊'}
                </button>
            </div>

            {!title && (
                <div className="p-6 bg-amber-50 border-2 border-dashed border-amber-200 rounded-3xl text-center">
                    <i className="fa-solid fa-circle-exclamation text-amber-400 text-2xl mb-3 block" />
                    <p className="text-xs font-bold text-amber-600">请先在「发布」面板填写论文标题和关键信息</p>
                </div>
            )}

            {targetJournals.length === 0 && title && !isLoading && (
                <div className="h-64 flex flex-col items-center justify-center opacity-30 gap-4">
                    <i className="fa-solid fa-compass text-6xl" />
                    <p className="text-sm font-black uppercase tracking-[0.3rem]">点击上方按钮启动期刊匹配</p>
                </div>
            )}

            {isLoading && (
                <div className="h-64 flex flex-col items-center justify-center gap-6 animate-pulse">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-[1.5rem] border-4 border-sky-500 border-t-transparent animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <i className="fa-solid fa-microscope text-sky-500 text-2xl animate-pulse" />
                        </div>
                    </div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">正在分析论文特征并匹配全球期刊数据库...</p>
                </div>
            )}

            {targetJournals.length > 0 && !isLoading && (
                <div className="grid gap-4">
                    {targetJournals.map((j, i) => {
                        const tier = getTierBadge(j.matchScore);
                        const isSelected = selectedIdx === i;
                        const circumference = 2 * Math.PI * 18;
                        const strokeDashoffset = circumference - (j.matchScore / 100) * circumference;

                        return (
                            <div
                                key={i}
                                onClick={() => { setSelectedIdx(i); onSelectJournal(j); }}
                                className={`p-5 rounded-[2rem] border-2 transition-all cursor-pointer group hover:shadow-lg ${isSelected ? 'border-indigo-400 bg-indigo-50/50 shadow-lg ring-2 ring-indigo-200' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                            >
                                <div className="flex items-start gap-4">
                                    {/* 匹配度环形图 */}
                                    <div className="relative w-14 h-14 shrink-0">
                                        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 40 40">
                                            <circle cx="20" cy="20" r="18" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                                            <circle
                                                cx="20" cy="20" r="18" fill="none"
                                                className={getScoreRingColor(j.matchScore)}
                                                strokeWidth="3" strokeLinecap="round"
                                                strokeDasharray={circumference}
                                                strokeDashoffset={strokeDashoffset}
                                                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className={`text-[11px] font-black ${getScoreColor(j.matchScore)}`}>{j.matchScore}</span>
                                        </div>
                                    </div>

                                    {/* 期刊信息 */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <h5 className="text-sm font-black text-slate-800 truncate">{j.name}</h5>
                                            <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase shrink-0 ${tier.bg}`}>{tier.label}</span>
                                        </div>

                                        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
                                            <span className="text-[10px] font-bold text-slate-500">
                                                <i className="fa-solid fa-chart-line mr-1 text-indigo-400" />IF: <strong className="text-indigo-600">{j.impactFactor}</strong>
                                            </span>
                                            {j.acceptRate && (
                                                <span className="text-[10px] font-bold text-slate-500">
                                                    <i className="fa-solid fa-check-circle mr-1 text-emerald-400" />录用: {j.acceptRate}
                                                </span>
                                            )}
                                            {j.reviewCycle && (
                                                <span className="text-[10px] font-bold text-slate-500">
                                                    <i className="fa-solid fa-clock mr-1 text-amber-400" />审稿: {j.reviewCycle}
                                                </span>
                                            )}
                                            {j.category && (
                                                <span className="text-[10px] font-bold text-slate-500">
                                                    <i className="fa-solid fa-tag mr-1 text-purple-400" />{j.category}
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-[11px] font-medium text-slate-600 leading-relaxed italic">{j.matchReason}</p>
                                    </div>

                                    {/* 操作区 */}
                                    <div className="flex flex-col gap-1.5 shrink-0">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-300 group-hover:bg-slate-200'}`}>
                                            <i className={`fa-solid ${isSelected ? 'fa-check' : 'fa-chevron-right'} text-xs`} />
                                        </div>
                                        {onCreateRound && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onCreateRound(j); }}
                                                className="w-8 h-8 rounded-xl bg-violet-50 text-violet-400 flex items-center justify-center hover:bg-violet-500 hover:text-white transition-all"
                                                title="一键创建投稿轮次"
                                            >
                                                <i className="fa-solid fa-paper-plane text-[10px]" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default JournalRecommendPanel;
