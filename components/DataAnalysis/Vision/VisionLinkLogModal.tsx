import React, { useMemo, useState } from 'react';
import { ResearchProject } from '../../../types';
import { flattenMilestonesTree, getAutoSelections } from '../../Characterization/AnalysisSyncModal';

interface VisionLinkLogModalProps {
    onClose: () => void;
    projects: ResearchProject[];
    onConfirm: (projectId: string, milestoneId: string, logId: string, logTitle: string) => void;
    initialProjectId?: string;
    initialMilestoneId?: string;
    initialLogId?: string;
}

const VisionLinkLogModal: React.FC<VisionLinkLogModalProps> = ({
    onClose, projects, onConfirm, initialProjectId, initialMilestoneId, initialLogId
}) => {
    const auto = useMemo(() => getAutoSelections(projects, initialProjectId), [projects, initialProjectId]);
    const [targetProjectId, setTargetProjectId] = useState(initialProjectId || auto.projectId);
    const [targetMilestoneId, setTargetMilestoneId] = useState(initialMilestoneId || auto.milestoneId);
    const [targetLogId, setTargetLogId] = useState(initialLogId || auto.logId);

    const selectedProject = projects.find(p => p.id === targetProjectId);
    const selectedMilestone = (selectedProject?.milestones || []).find(m => m.id === targetMilestoneId);

    return (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl animate-reveal border-4 border-white/50 flex flex-col w-96 overflow-hidden">
                <div className="p-8 pb-4">
                    <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-2">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                            <i className="fa-solid fa-link text-indigo-500"></i>
                            关联实验记录
                        </h3>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block px-1">关联课题项目</label>
                            <div className="relative">
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors"
                                    value={targetProjectId}
                                    onChange={e => { setTargetProjectId(e.target.value); const a = getAutoSelections(projects, e.target.value); setTargetMilestoneId(a.milestoneId); setTargetLogId(a.logId); }}
                                >
                                    <option value="">点击选择项目...</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                </select>
                                <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                            </div>
                        </div>

                        {targetProjectId && (
                            <div className="animate-reveal">
                                <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block px-1">关联实验节点 (阶段)</label>
                                <div className="relative">
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors"
                                        value={targetMilestoneId}
                                        onChange={e => { setTargetMilestoneId(e.target.value); const ms = selectedProject?.milestones.find(m => m.id === e.target.value); setTargetLogId(ms?.logs?.[0]?.id || ''); }}
                                    >
                                        <option value="">点击选择阶段...</option>
                                        {flattenMilestonesTree(selectedProject?.milestones || []).map(({ milestone: m, depth, label }) => <option key={m.id} value={m.id}>{'　'.repeat(depth)}{label}  {m.title}</option>)}
                                    </select>
                                    <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                                </div>
                            </div>
                        )}

                        {targetMilestoneId && (
                            <div className="animate-reveal">
                                <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block px-1">指定实验记录</label>
                                <div className="relative">
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors"
                                        value={targetLogId}
                                        onChange={e => setTargetLogId(e.target.value)}
                                    >
                                        <option value="">点击选择具体记录...</option>
                                        {(selectedMilestone?.logs || []).map(l => <option key={l.id} value={l.id}>{l.content.substring(0, 30)}...</option>)}
                                    </select>
                                    <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 p-4 bg-amber-50 rounded-2xl border border-amber-100 italic">
                        <p className="text-[10px] text-amber-700 leading-relaxed">
                            <i className="fa-solid fa-info-circle mr-1"></i>
                            关联后，AI 深度分析将自动获取该实验记录的上下文。同时，保存分析结果时将自动同步至此记录。
                        </p>
                    </div>
                </div>

                <div className="p-8 pt-4 flex gap-3">
                    <button
                        onClick={() => {
                            setTargetProjectId('');
                            setTargetMilestoneId('');
                            setTargetLogId('');
                            onConfirm('', '', '', '');
                        }}
                        className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all"
                    >
                        解除关联
                    </button>
                    <button
                        onClick={() => {
                            const log = selectedMilestone?.logs.find(l => l.id === targetLogId);
                            onConfirm(targetProjectId, targetMilestoneId, targetLogId, log?.content || '未知记录');
                        }}
                        disabled={!targetLogId}
                        className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-200 disabled:opacity-50 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <i className="fa-solid fa-link-slash"></i> 确认关联
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VisionLinkLogModal;
