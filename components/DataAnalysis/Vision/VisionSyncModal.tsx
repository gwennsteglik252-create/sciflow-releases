import React, { useMemo, useState } from 'react';
import { ResearchProject } from '../../../types';
import { flattenMilestonesTree, getAutoSelections } from '../../Characterization/AnalysisSyncModal';

interface VisionSyncModalProps {
    onClose: () => void;
    projects: ResearchProject[];
    onConfirm: (projectId: string, milestoneId: string, logId: string, aiReport?: string | null, logTitle?: string, saveToArchive?: boolean) => void;
    initialProjectId?: string;
    analysisMode: string;
    aiReport: string | null;
    showToast: (params: { message: string, type: 'success' | 'error' | 'info' }) => void;
}

const VisionSyncModal: React.FC<VisionSyncModalProps> = ({
    onClose, projects, onConfirm, initialProjectId, analysisMode, aiReport, showToast
}) => {
    const auto = useMemo(() => getAutoSelections(projects, initialProjectId), [projects, initialProjectId]);
    const [targetProjectId, setTargetProjectId] = useState(auto.projectId);
    const [targetMilestoneId, setTargetMilestoneId] = useState(auto.milestoneId);
    const [targetLogId, setTargetLogId] = useState(auto.logId || 'NEW_LOG');
    const [saveToArchive, setSaveToArchive] = useState(true);

    const selectedProject = projects.find(p => p.id === targetProjectId);
    const selectedMilestone = (selectedProject?.milestones || []).find(m => m.id === targetMilestoneId);

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl animate-reveal border-4 border-white/50 flex flex-col w-96 overflow-hidden">
                <div className="p-8 pb-4">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2 flex items-center gap-2">
                        <i className="fa-solid fa-cloud-arrow-up text-indigo-500"></i>
                        同步至实验记录
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block px-1">选择目标课题</label>
                            <div className="relative">
                                <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors" value={targetProjectId} onChange={e => { setTargetProjectId(e.target.value); const a = getAutoSelections(projects, e.target.value); setTargetMilestoneId(a.milestoneId); setTargetLogId(a.logId || 'NEW_LOG'); }}>
                                    <option value="">点击选择项目...</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                </select>
                                <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                            </div>
                        </div>
                        {targetProjectId && (
                            <div className="animate-reveal">
                                <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block px-1">选择实验节点</label>
                                <div className="relative">
                                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors" value={targetMilestoneId} onChange={e => { setTargetMilestoneId(e.target.value); const ms = selectedProject?.milestones.find(m => m.id === e.target.value); setTargetLogId(ms?.logs?.[0]?.id || 'NEW_LOG'); }}>
                                        <option value="">点击选择里程碑...</option>
                                        {flattenMilestonesTree(selectedProject?.milestones || []).map(({ milestone: m, depth, label }) => <option key={m.id} value={m.id}>{'　'.repeat(depth)}{label}  {m.title}</option>)}
                                    </select>
                                    <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                                </div>
                            </div>
                        )}
                        {targetMilestoneId && (
                            <div className="animate-reveal">
                                <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block px-1">追加至记录</label>
                                <div className="relative">
                                    <select className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors" value={targetLogId} onChange={e => setTargetLogId(e.target.value)}>
                                        <option value="NEW_LOG">+ 新建一条分析实录</option>
                                        {(selectedMilestone?.logs || []).map(l => <option key={l.id} value={l.id}>{l.content.substring(0, 20)}...</option>)}
                                    </select>
                                    <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none"></i>
                                </div>
                            </div>
                        )}

                        <div className="mt-4 flex items-center gap-2 px-1">
                            <input
                                type="checkbox"
                                id="saveToArchive"
                                checked={saveToArchive}
                                onChange={e => setSaveToArchive(e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <label htmlFor="saveToArchive" className="text-[10px] font-black text-slate-600 cursor-pointer select-none">
                                同时保存一份副本到本地存档库
                            </label>
                        </div>
                    </div>
                </div>

                <div className="p-8 pt-4 flex gap-3 -mt-2">
                    <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">
                        取消
                    </button>
                    <button
                        onClick={() => {
                            const logTitle = targetLogId === 'NEW_LOG' ? '新建实验记录' : selectedMilestone?.logs.find(l => l.id === targetLogId)?.content.substring(0, 30) || '未知记录';
                            onConfirm(targetProjectId, targetMilestoneId, targetLogId, aiReport || undefined, logTitle, saveToArchive);
                        }}
                        disabled={!targetMilestoneId}
                        className="flex-[2] py-3 bg-teal-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg disabled:opacity-50 hover:bg-teal-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <i className="fa-solid fa-check-double"></i> 确认同步
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VisionSyncModal;
