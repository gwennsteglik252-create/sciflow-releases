
import React, { useState, useMemo } from 'react';
import { useProjectContext } from '../../../context/ProjectContext';
import { UserProfile, WeeklyTask } from '../../../types';

interface TaskAssignmentModalProps {
    member: UserProfile;
    onClose: () => void;
}

const TaskAssignmentModal: React.FC<TaskAssignmentModalProps> = ({ member, onClose }) => {
    const { projects, setProjects, showToast } = useProjectContext();
    const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
    const [selectedTaskTitles, setSelectedTaskTitles] = useState<Set<string>>(new Set());

    const activeProject = useMemo(() => 
        projects.find(p => p.id === selectedProjectId), 
        [projects, selectedProjectId]
    );

    const activePlan = useMemo(() => 
        activeProject?.weeklyPlans?.find(plan => plan.status === 'in-progress'),
        [activeProject]
    );

    const unassignedTasks = useMemo(() => 
        activePlan?.tasks.filter(t => t.status === 'pending' && !t.assignedTo?.includes(member.name)) || [],
        [activePlan, member.name]
    );

    const handleToggleTask = (title: string) => {
        setSelectedTaskTitles(prev => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title);
            else next.add(title);
            return next;
        });
    };

    const handleConfirm = () => {
        if (selectedTaskTitles.size === 0) return;

        setProjects(prev => prev.map(p => {
            if (p.id !== selectedProjectId) return p;

            const nextWeeklyPlans = (p.weeklyPlans || []).map(plan => {
                if (plan.status !== 'in-progress') return plan;

                return {
                    ...plan,
                    tasks: plan.tasks.map(t => {
                        if (selectedTaskTitles.has(t.title)) {
                            return {
                                ...t,
                                assignedTo: Array.from(new Set([...(t.assignedTo || []), member.name]))
                            };
                        }
                        return t;
                    })
                };
            });

            return { ...p, weeklyPlans: nextWeeklyPlans };
        }));

        showToast({ message: `成功为 ${member.name} 指派了 ${selectedTaskTitles.size} 项任务`, type: 'success' });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3500] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 lg:p-10 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[85vh]">
                <button onClick={onClose} className="absolute top-6 right-6 text-slate-300 hover:text-rose-500 transition-all active:scale-90">
                    <i className="fa-solid fa-times text-xl"></i>
                </button>
                
                <header className="mb-6 border-l-4 border-indigo-600 pl-4">
                    <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter leading-none">指派交付任务</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Assign Tasks to {member.name}</p>
                </header>

                <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <img src={member.avatar} className="w-12 h-12 rounded-xl border-2 border-white shadow-sm" alt="" />
                    <div>
                        <p className="text-sm font-black text-slate-800 leading-none">{member.name}</p>
                        <p className="text-[10px] text-indigo-600 font-bold mt-1 uppercase">{member.role}</p>
                    </div>
                </div>

                <div className="space-y-6 flex-1 overflow-hidden flex flex-col">
                    <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block px-1">1. 选择目标课题 (SELECT PROJECT)</label>
                        <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 outline-none focus:border-indigo-400 shadow-inner appearance-none cursor-pointer"
                            value={selectedProjectId}
                            onChange={(e) => {
                                setSelectedProjectId(e.target.value);
                                setSelectedTaskTitles(new Set());
                            }}
                        >
                            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                    </div>

                    <div className="flex-1 flex flex-col min-h-0">
                        <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block px-1">2. 选择待办任务 (SELECT TASKS)</label>
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 rounded-2xl p-4 border border-slate-200 shadow-inner space-y-2">
                            {unassignedTasks.length > 0 ? (
                                unassignedTasks.map(task => (
                                    <div 
                                        key={task.title}
                                        onClick={() => handleToggleTask(task.title)}
                                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                                            selectedTaskTitles.has(task.title) 
                                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' 
                                                : 'bg-white border-slate-100 text-slate-700 hover:border-indigo-200 shadow-sm'
                                        }`}
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedTaskTitles.has(task.title) ? 'bg-white/20 border-white' : 'border-slate-300 bg-slate-50'}`}>
                                            {selectedTaskTitles.has(task.title) && <i className="fa-solid fa-check text-[10px]"></i>}
                                        </div>
                                        <p className="text-[11px] font-bold italic truncate flex-1">{task.title}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center opacity-30 gap-3">
                                    <i className="fa-solid fa-clipboard-check text-3xl"></i>
                                    <p className="text-[9px] font-black uppercase">暂无待分配任务</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <footer className="mt-8 flex gap-4 shrink-0">
                    <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase hover:bg-slate-200">取消</button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={selectedTaskTitles.size === 0}
                        className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-black transition-all active:scale-95 disabled:opacity-30"
                    >
                        确认指派任务 ({selectedTaskTitles.size})
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default TaskAssignmentModal;
