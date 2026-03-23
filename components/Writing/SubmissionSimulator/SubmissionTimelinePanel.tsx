import React, { useState } from 'react';
import { SubmissionRound, JournalMatch } from '../../../types';

interface SubmissionTimelinePanelProps {
    rounds: SubmissionRound[];
    targetJournals: JournalMatch[];
    onUpdateRounds: (rounds: SubmissionRound[]) => void;
}

const STATUS_FLOW: SubmissionRound['status'][] = ['draft', 'submitted', 'under_review', 'revision_required', 'accepted', 'rejected'];

const STATUS_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
    draft: { label: '草稿', icon: 'fa-file-pen', color: 'text-slate-500', bg: 'bg-slate-100' },
    submitted: { label: '已投稿', icon: 'fa-paper-plane', color: 'text-sky-600', bg: 'bg-sky-100' },
    under_review: { label: '审稿中', icon: 'fa-clock-rotate-left', color: 'text-amber-600', bg: 'bg-amber-100' },
    revision_required: { label: '修稿中', icon: 'fa-pen-ruler', color: 'text-purple-600', bg: 'bg-purple-100' },
    accepted: { label: '已录用', icon: 'fa-circle-check', color: 'text-emerald-600', bg: 'bg-emerald-100' },
    rejected: { label: '被拒', icon: 'fa-circle-xmark', color: 'text-rose-500', bg: 'bg-rose-100' }
};

const SubmissionTimelinePanel: React.FC<SubmissionTimelinePanelProps> = ({
    rounds, targetJournals, onUpdateRounds
}) => {
    const [showNewForm, setShowNewForm] = useState(false);
    const [newJournal, setNewJournal] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editingJournalId, setEditingJournalId] = useState<string | null>(null);
    const [editJournalName, setEditJournalName] = useState('');

    const handleAddRound = () => {
        if (!newJournal.trim()) return;
        const newRound: SubmissionRound = {
            id: `round_${Date.now()}`,
            roundNumber: rounds.length + 1,
            journal: newJournal.trim(),
            status: 'draft',
            reviewerComments: []
        };
        onUpdateRounds([...rounds, newRound]);
        setNewJournal('');
        setShowNewForm(false);
    };

    const handleStatusChange = (roundId: string, newStatus: SubmissionRound['status']) => {
        const now = new Date().toLocaleString();
        onUpdateRounds(rounds.map(r => {
            if (r.id !== roundId) return r;
            return {
                ...r,
                status: newStatus,
                ...(newStatus === 'submitted' && !r.submittedAt ? { submittedAt: now } : {}),
                ...(['accepted', 'rejected'].includes(newStatus) ? { decidedAt: now } : {})
            };
        }));
    };

    const handleNotesChange = (roundId: string, notes: string) => {
        onUpdateRounds(rounds.map(r => r.id === roundId ? { ...r, notes } : r));
    };

    // #4 删除轮次
    const handleDeleteRound = (roundId: string) => {
        const updated = rounds.filter(r => r.id !== roundId)
            .map((r, i) => ({ ...r, roundNumber: i + 1 }));
        onUpdateRounds(updated);
        setExpandedId(null);
    };

    // #4 编辑期刊名
    const handleSaveJournalName = (roundId: string) => {
        if (!editJournalName.trim()) return;
        onUpdateRounds(rounds.map(r => r.id === roundId ? { ...r, journal: editJournalName.trim() } : r));
        setEditingJournalId(null);
        setEditJournalName('');
    };

    // 统计信息
    const totalRounds = rounds.length;
    const activeRound = rounds.find(r => !['accepted', 'rejected'].includes(r.status));
    const daysSinceSubmission = activeRound?.submittedAt
        ? Math.floor((Date.now() - new Date(activeRound.submittedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    return (
        <div className="space-y-6 pb-12">
            <div className="flex justify-between items-center mb-4">
                <h4 className="text-xl font-black text-slate-800 uppercase italic border-l-4 border-violet-500 pl-4">
                    投稿状态跟踪板
                </h4>
                <button
                    onClick={() => setShowNewForm(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center gap-2"
                >
                    <i className="fa-solid fa-plus" /> 新增轮次
                </button>
            </div>

            {/* 统计条 */}
            {totalRounds > 0 && (
                <div className="flex gap-3">
                    <div className="flex-1 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                        <div className="text-lg font-black text-slate-800">{totalRounds}</div>
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">投稿轮次</div>
                    </div>
                    {activeRound && (
                        <div className="flex-1 p-3 bg-amber-50 rounded-2xl border border-amber-100 text-center">
                            <div className="text-lg font-black text-amber-600">{daysSinceSubmission}天</div>
                            <div className="text-[8px] font-black text-amber-400 uppercase tracking-widest">等待中</div>
                        </div>
                    )}
                    <div className="flex-1 p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                        <div className="text-lg font-black text-emerald-600">
                            {rounds.filter(r => r.status === 'accepted').length}
                        </div>
                        <div className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">已录用</div>
                    </div>
                </div>
            )}

            {/* 新增表单 */}
            {showNewForm && (
                <div className="p-5 bg-violet-50 border-2 border-violet-200 rounded-[2rem] animate-reveal">
                    <h5 className="text-[10px] font-black text-violet-600 uppercase tracking-widest mb-3">创建新投稿轮次</h5>
                    <div className="flex gap-3">
                        <div className="flex-1 relative">
                            <input
                                value={newJournal}
                                onChange={e => setNewJournal(e.target.value)}
                                placeholder="输入目标期刊名称..."
                                className="w-full px-4 py-3 rounded-xl border border-violet-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
                                list="journal-suggestions"
                                onKeyDown={e => e.key === 'Enter' && handleAddRound()}
                            />
                            <datalist id="journal-suggestions">
                                {targetJournals.map((j, i) => <option key={i} value={j.name} />)}
                            </datalist>
                        </div>
                        <button onClick={handleAddRound} className="px-5 py-3 bg-violet-600 text-white rounded-xl text-xs font-black shadow hover:bg-violet-700 transition-all">确认</button>
                        <button onClick={() => setShowNewForm(false)} className="px-4 py-3 bg-white text-slate-400 rounded-xl text-xs font-bold border border-slate-200 hover:text-slate-600 transition-all">取消</button>
                    </div>
                </div>
            )}

            {/* 时间线 */}
            {rounds.length === 0 && !showNewForm ? (
                <div className="h-48 flex flex-col items-center justify-center opacity-30 gap-4">
                    <i className="fa-solid fa-timeline text-5xl" />
                    <p className="text-sm font-black uppercase tracking-[0.2rem]">暂无投稿记录</p>
                </div>
            ) : (
                <div className="relative pl-8">
                    {/* 竖线 */}
                    <div className="absolute left-[14px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-violet-300 via-slate-300 to-transparent" />

                    {[...rounds].reverse().map((round) => {
                        const cfg = STATUS_CONFIG[round.status];
                        const isExpanded = expandedId === round.id;
                        const isTerminal = ['accepted', 'rejected'].includes(round.status);
                        const isEditingThis = editingJournalId === round.id;

                        return (
                            <div key={round.id} className="relative mb-6 last:mb-0">
                                {/* 圆点 */}
                                <div className={`absolute -left-8 top-4 w-7 h-7 rounded-full flex items-center justify-center shadow-md ${isTerminal ? (round.status === 'accepted' ? 'bg-emerald-500' : 'bg-rose-500') : 'bg-violet-500'}`}>
                                    <i className={`fa-solid ${cfg.icon} text-white text-[10px]`} />
                                </div>

                                <div
                                    className={`p-5 rounded-[1.5rem] border-2 transition-all cursor-pointer ${isExpanded ? 'border-violet-300 bg-white shadow-lg' : 'border-slate-200 bg-white/80 hover:border-slate-300 hover:shadow'}`}
                                    onClick={() => setExpandedId(isExpanded ? null : round.id)}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-black text-slate-300 uppercase">R{round.roundNumber}</span>
                                            {isEditingThis ? (
                                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        value={editJournalName}
                                                        onChange={e => setEditJournalName(e.target.value)}
                                                        className="px-2 py-1 rounded-lg border border-violet-300 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-violet-200 w-48"
                                                        onKeyDown={e => e.key === 'Enter' && handleSaveJournalName(round.id)}
                                                        autoFocus
                                                    />
                                                    <button onClick={() => handleSaveJournalName(round.id)} className="text-emerald-500 hover:text-emerald-700"><i className="fa-solid fa-check text-xs" /></button>
                                                    <button onClick={() => setEditingJournalId(null)} className="text-slate-400 hover:text-slate-600"><i className="fa-solid fa-times text-xs" /></button>
                                                </div>
                                            ) : (
                                                <h5 className="text-sm font-black text-slate-800">{round.journal}</h5>
                                            )}
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${cfg.bg} ${cfg.color}`}>
                                            {cfg.label}
                                        </span>
                                    </div>

                                    <div className="flex gap-3 text-[10px] font-bold text-slate-400">
                                        {round.submittedAt && <span><i className="fa-solid fa-calendar mr-1" />投稿: {round.submittedAt}</span>}
                                        {round.decidedAt && <span><i className="fa-solid fa-gavel mr-1" />决定: {round.decidedAt}</span>}
                                        {round.reviewerComments.length > 0 && (
                                            <span><i className="fa-solid fa-comments mr-1" />{round.reviewerComments.length} 条意见</span>
                                        )}
                                    </div>

                                    {/* 展开区 */}
                                    {isExpanded && (
                                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4" onClick={e => e.stopPropagation()}>
                                            {/* 状态流转 */}
                                            {!isTerminal && (
                                                <div>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">更新状态</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {STATUS_FLOW.map(s => {
                                                            const sc = STATUS_CONFIG[s];
                                                            return (
                                                                <button
                                                                    key={s}
                                                                    onClick={() => handleStatusChange(round.id, s)}
                                                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${round.status === s ? `${sc.bg} ${sc.color} ring-2 ring-offset-1` : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                                                >
                                                                    <i className={`fa-solid ${sc.icon} mr-1`} />{sc.label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* 备注 */}
                                            <div>
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">备注</p>
                                                <textarea
                                                    value={round.notes || ''}
                                                    onChange={e => handleNotesChange(round.id, e.target.value)}
                                                    placeholder="记录投稿相关信息..."
                                                    className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium resize-none h-20 focus:outline-none focus:ring-2 focus:ring-violet-200"
                                                />
                                            </div>

                                            {/* #4 编辑期刊名 + 删除轮次 */}
                                            <div className="flex gap-2 pt-2 border-t border-slate-100">
                                                <button
                                                    onClick={() => { setEditingJournalId(round.id); setEditJournalName(round.journal); }}
                                                    className="px-3 py-1.5 rounded-lg bg-slate-50 text-slate-400 text-[9px] font-black uppercase hover:bg-slate-100 hover:text-slate-600 transition-all flex items-center gap-1"
                                                >
                                                    <i className="fa-solid fa-pen text-[8px]" />修改期刊名
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRound(round.id)}
                                                    className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-400 text-[9px] font-black uppercase hover:bg-rose-100 hover:text-rose-600 transition-all flex items-center gap-1"
                                                >
                                                    <i className="fa-solid fa-trash text-[8px]" />删除轮次
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SubmissionTimelinePanel;
