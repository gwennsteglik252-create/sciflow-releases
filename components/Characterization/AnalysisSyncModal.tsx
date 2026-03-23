
import React, { useMemo, useState } from 'react';
import { Milestone, ResearchProject } from '../../types';

/** 将 milestones 按 parentId 树状展开，返回带 depth 和层级编号的扁平列表 */
export function flattenMilestonesTree(milestones: Milestone[]): { milestone: Milestone; depth: number; label: string }[] {
    const result: { milestone: Milestone; depth: number; label: string }[] = [];
    const collect = (parentId: string | undefined, depth: number, prefix: string) => {
        const children = milestones.filter(m => m.parentId === parentId);
        children.forEach((m, idx) => {
            const num = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`;
            result.push({ milestone: m, depth, label: num });
            collect(m.id, depth + 1, num);
        });
    };
    collect(undefined, 0, '');
    return result;
}

/** 自动推断最新的 项目→节点→实验记录，减少手动选择 */
export function getAutoSelections(projects: ResearchProject[], preferredProjectId?: string): { projectId: string; milestoneId: string; logId: string } {
    const projectId = preferredProjectId && projects.find(p => p.id === preferredProjectId)
        ? preferredProjectId
        : (projects[0]?.id || '');
    const project = projects.find(p => p.id === projectId);
    if (!project) return { projectId, milestoneId: '', logId: '' };
    // 遍历所有节点，找到包含最新实验记录（id 最大）的节点
    let bestMilestoneId = '';
    let bestLogId = '';
    let bestLogNum = -1;
    for (const ms of project.milestones) {
        if (ms.logs && ms.logs.length > 0) {
            const newestLog = ms.logs[0]; // logs 按时间倒序，第一条最新
            const logNum = parseInt(newestLog.id, 10) || 0;
            if (logNum > bestLogNum) {
                bestLogNum = logNum;
                bestMilestoneId = ms.id;
                bestLogId = newestLog.id;
            }
        }
    }
    return { projectId, milestoneId: bestMilestoneId, logId: bestLogId };
}

/** 从节点 logs 中提取有效的实验组（需包含 >= 2 条记录） */
export function getGroupsForMilestone(milestone: Milestone | undefined): { groupId: string; groupLabel: string; count: number }[] {
    if (!milestone) return [];
    const groupMap = new Map<string, { label: string; count: number }>();
    for (const log of (milestone.logs || [])) {
        if (!log.groupId) continue;
        const existing = groupMap.get(log.groupId);
        if (existing) {
            existing.count++;
        } else {
            groupMap.set(log.groupId, {
                label: (log as any).groupLabel || log.groupId,
                count: 1
            });
        }
    }
    // 只保留 >= 2 条记录的组
    return Array.from(groupMap.entries())
        .filter(([, v]) => v.count >= 2)
        .map(([groupId, v]) => ({ groupId, groupLabel: v.label, count: v.count }));
}

interface AnalysisSyncModalProps {
    onClose: () => void;
    projects: ResearchProject[];
    onConfirm: (projectId: string, milestoneId: string, logId: string) => void;
    /** 同步到实验组的回调（groupId 为实验组唯一标识） */
    onConfirmGroup?: (projectId: string, milestoneId: string, groupId: string) => void;
    initialProjectId?: string;
    title?: string;
}

type SyncMode = 'log' | 'group';

const AnalysisSyncModal: React.FC<AnalysisSyncModalProps> = ({
    onClose,
    projects,
    onConfirm,
    onConfirmGroup,
    initialProjectId,
    title = '同步至实验记录'
}) => {
    const [syncMode, setSyncMode] = useState<SyncMode>('log');
    const auto = useMemo(() => getAutoSelections(projects, initialProjectId), [projects, initialProjectId]);
    const [targetProjectId, setTargetProjectId] = useState(auto.projectId);
    const [targetMilestoneId, setTargetMilestoneId] = useState(auto.milestoneId);
    const [targetLogId, setTargetLogId] = useState(auto.logId);
    const [targetGroupId, setTargetGroupId] = useState('');

    const selectedProject = projects.find(p => p.id === targetProjectId);
    const selectedMilestone = (selectedProject?.milestones || []).find(m => m.id === targetMilestoneId);
    const treeNodes = useMemo(() => flattenMilestonesTree(selectedProject?.milestones || []), [selectedProject]);
    const groups = useMemo(() => getGroupsForMilestone(selectedMilestone), [selectedMilestone]);

    const handleProjectChange = (pid: string) => {
        setTargetProjectId(pid);
        const a = getAutoSelections(projects, pid);
        setTargetMilestoneId(a.milestoneId);
        setTargetLogId(a.logId);
        setTargetGroupId('');
    };

    const handleMilestoneChange = (mid: string) => {
        setTargetMilestoneId(mid);
        const ms = selectedProject?.milestones.find(m => m.id === mid);
        setTargetLogId(ms?.logs?.[0]?.id || '');
        setTargetGroupId('');
    };

    const handleConfirm = () => {
        if (syncMode === 'group') {
            if (onConfirmGroup && targetGroupId) {
                onConfirmGroup(targetProjectId, targetMilestoneId, targetGroupId);
            }
        } else {
            onConfirm(targetProjectId, targetMilestoneId, targetLogId);
        }
    };

    const isConfirmDisabled = syncMode === 'log'
        ? !targetLogId
        : (!targetGroupId || !onConfirmGroup);

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-white p-8 rounded-[2rem] shadow-2xl w-[540px] animate-reveal border-4 border-white/50">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-5 border-b border-slate-100 pb-2">{title}</h3>

                {/* 模式切换 Tab（仅当 onConfirmGroup 存在时才显示） */}
                {onConfirmGroup && (
                    <div className="flex bg-slate-100 rounded-xl p-1 mb-5 gap-1">
                        <button
                            onClick={() => setSyncMode('log')}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${syncMode === 'log' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-flask-vial" />
                            同步至记录
                        </button>
                        <button
                            onClick={() => setSyncMode('group')}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${syncMode === 'group' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-layer-group" />
                            同步至实验组
                        </button>
                    </div>
                )}

                <div className="space-y-4">
                    {/* 选择课题 */}
                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block px-1">选择目标课题</label>
                        <div className="relative">
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors"
                                value={targetProjectId}
                                onChange={e => handleProjectChange(e.target.value)}
                            >
                                <option value="">点击选择项目...</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                            </select>
                            <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none" />
                        </div>
                    </div>

                    {/* 选择节点 */}
                    {targetProjectId && (
                        <div className="animate-reveal">
                            <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block px-1">选择实验节点</label>
                            <div className="relative">
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors"
                                    value={targetMilestoneId}
                                    onChange={e => handleMilestoneChange(e.target.value)}
                                >
                                    <option value="">点击选择里程碑...</option>
                                    {treeNodes.map(({ milestone: m, depth, label }) => (
                                        <option key={m.id} value={m.id}>
                                            {'　'.repeat(depth)}{label}  {m.title}
                                        </option>
                                    ))}
                                </select>
                                <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none" />
                            </div>
                        </div>
                    )}

                    {/* 同步至记录模式：选择单条实验记录 */}
                    {syncMode === 'log' && targetMilestoneId && (
                        <div className="animate-reveal">
                            <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block px-1">关联至记录</label>
                            <div className="relative">
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors"
                                    value={targetLogId}
                                    onChange={e => setTargetLogId(e.target.value)}
                                >
                                    <option value="">选择一条实验记录...</option>
                                    {(selectedMilestone?.logs || []).map(l => {
                                        const firstLine = (l.content || '').split('\n')[0].trim() || '未命名记录';
                                        const label = firstLine.length > 40 ? firstLine.substring(0, 40) + '...' : firstLine;
                                        return <option key={l.id} value={l.id}>{label}</option>;
                                    })}
                                </select>
                                <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none" />
                            </div>
                        </div>
                    )}

                    {/* 同步至实验组模式：选择对照实验组 */}
                    {syncMode === 'group' && targetMilestoneId && (
                        <div className="animate-reveal">
                            <label className="text-[9px] font-black text-slate-400 uppercase mb-1.5 block px-1">
                                关联至实验组
                                {groups.length === 0 && (
                                    <span className="text-rose-400 ml-2 normal-case font-bold">（该节点暂无对照实验组）</span>
                                )}
                            </label>
                            <div className="relative">
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    value={targetGroupId}
                                    onChange={e => setTargetGroupId(e.target.value)}
                                    disabled={groups.length === 0}
                                >
                                    <option value="">选择实验组...</option>
                                    {groups.map(g => (
                                        <option key={g.groupId} value={g.groupId}>
                                            {g.groupLabel}（{g.count} 条记录）
                                        </option>
                                    ))}
                                </select>
                                <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] pointer-events-none" />
                            </div>
                            {groups.length === 0 && (
                                <p className="text-[9px] text-slate-400 mt-1.5 px-1 leading-relaxed">
                                    <i className="fa-solid fa-circle-info mr-1 text-indigo-300" />
                                    实验组需在DataLaboratory中将2条以上记录设置相同groupId后才会出现。
                                </p>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3 mt-8">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={isConfirmDisabled}
                            className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg disabled:opacity-50 hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <i className={`fa-solid ${syncMode === 'group' ? 'fa-layer-group' : 'fa-link'}`} />
                            {syncMode === 'group' ? '写入实验组' : '确认链接'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalysisSyncModal;
