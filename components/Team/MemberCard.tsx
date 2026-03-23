
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { UserProfile, ExpertiseScore, AvailabilityStatus, WeeklyTask } from '../../types';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import CharacterIcon from './Sub/CharacterIcon';
import EducationBadge from './Sub/EducationBadge';
import { useProjectContext } from '../../context/ProjectContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '../../locales/useTranslation';

interface MemberCardProps {
    member: UserProfile;
    isLight: boolean;
    onEdit: (member: UserProfile) => void;
    onDelete?: (member: UserProfile) => void;
    onAssign: () => void;
    onUpdateMetrics?: (id: string, newMetrics: ExpertiseScore[]) => void;
    assignedTasks?: { projectTitle: string, taskTitle: string, assignedDay?: number }[];
}

const MemberCard: React.FC<MemberCardProps> = ({
    member, isLight, onEdit, onDelete, onAssign, onUpdateMetrics, assignedTasks = []
}) => {
    const { t, lang } = useTranslation();
    const DAYS_SHORT = lang === 'zh' ? ['一', '二', '三', '四', '五', '六', '日'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const { projects, setProjects, setTeamMembers, showToast, navigate, setReturnPath } = useProjectContext();
    const isOverloaded = (member.workload || 0) > 80;
    const isTopSecret = member.securityLevel === '绝密';
    const status = member.availabilityStatus || 'Available';
    const leaveDays = member.leaveDays || [];

    const [isEditingDNA, setIsEditingDNA] = useState(false);
    const [localMetrics, setLocalMetrics] = useState<ExpertiseScore[]>(member.expertiseMetrics || []);
    const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);
    const calendarRef = useRef<HTMLDivElement>(null);

    // --- Task Assignment Dropdown State ---
    const [showAssignMenu, setShowAssignMenu] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
    // 核心改进：存储该成员在此项目下的“任务状态快照”
    const [memberTaskSelection, setMemberTaskSelection] = useState<Set<string>>(new Set());
    const assignMenuRef = useRef<HTMLDivElement>(null);

    // 删除键三次确认状态 (0: 初始, 1: 一次确认, 2: 二次确认)
    const [deleteStage, setDeleteStage] = useState(0);

    useEffect(() => {
        if (member.expertiseMetrics) setLocalMetrics(member.expertiseMetrics);
    }, [member.expertiseMetrics]);

    // 自动重置删除状态
    useEffect(() => {
        if (deleteStage > 0) {
            const timer = setTimeout(() => setDeleteStage(0), 4000);
            return () => clearTimeout(timer);
        }
    }, [deleteStage]);

    // 点击外部自动关闭日历和指派菜单
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
                setShowCalendar(false);
            }
            if (assignMenuRef.current && !assignMenuRef.current.contains(e.target as Node)) {
                setShowAssignMenu(false);
            }
        };
        if (showCalendar || showAssignMenu) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showCalendar, showAssignMenu]);

    const handleSaveDNA = () => {
        if (onUpdateMetrics) onUpdateMetrics(member.id, localMetrics);
        setIsEditingDNA(false);
    };

    const toggleLeaveDay = (e: React.MouseEvent, dayIdx: number) => {
        e.stopPropagation();
        let nextLeaveDays: number[];
        if (leaveDays.includes(dayIdx)) {
            nextLeaveDays = leaveDays.filter(d => d !== dayIdx);
        } else {
            nextLeaveDays = [...leaveDays, dayIdx].sort();
        }

        const conflictingTasks = assignedTasks.filter(t => t.assignedDay === dayIdx);
        setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, leaveDays: nextLeaveDays } : m));

        if (conflictingTasks.length > 0 && !leaveDays.includes(dayIdx)) {
            showToast({
                message: t('team.card.calendar.conflictMsg', { name: member.name, day: DAYS_SHORT[dayIdx], count: conflictingTasks.length }),
                type: 'info',
                actionLabel: t('team.card.calendar.evacuate'),
                onAction: () => handleEvacuateTasksForDay(dayIdx)
            });
        }
    };

    const handleEvacuateTasksForDay = (dayIdx: number) => {
        setProjects(prev => prev.map(p => {
            const nextPlans = (p.weeklyPlans || []).map(plan => {
                if (plan.status !== 'in-progress') return plan;
                return {
                    ...plan,
                    tasks: plan.tasks.map(t => {
                        if (t.status === 'pending' && t.assignedTo?.includes(member.name) && t.assignedDay === dayIdx) {
                            const nextAssignees = t.assignedTo.filter(n => n !== member.name);
                            return {
                                ...t,
                                assignedTo: nextAssignees.length > 0 ? nextAssignees : undefined,
                                assignedDay: nextAssignees.length > 0 ? t.assignedDay : undefined
                            };
                        }
                        return t;
                    })
                };
            });
            return { ...p, weeklyPlans: nextPlans };
        }));
        showToast({ message: t('team.card.tasks.released', { day: DAYS_SHORT[dayIdx] }), type: 'success' });
    };

    const handleCycleStatus = (e: React.MouseEvent) => {
        e.stopPropagation();
        const states: AvailabilityStatus[] = ['Available', 'Busy'];
        const nextIdx = (states.indexOf(status === 'On Leave' ? 'Available' : status) + 1) % states.length;
        const nextStatus = states[nextIdx];
        setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, availabilityStatus: nextStatus } : m));
    };

    const getMasteryColor = (level: number) => {
        if (level === 10) return 'bg-indigo-600';
        if (level >= 8) return 'bg-sky-500';
        if (level >= 6) return 'bg-emerald-500';
        return 'bg-amber-500';
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!onDelete) return;

        if (deleteStage === 0) {
            setDeleteStage(1);
        } else if (deleteStage === 1) {
            setDeleteStage(2);
        } else {
            onDelete(member);
            setDeleteStage(0);
        }
    };

    // --- Task Assignment Logic ---
    const activeProject = useMemo(() =>
        projects.find(p => p.id === selectedProjectId),
        [projects, selectedProjectId]
    );

    const activePlan = useMemo(() =>
        activeProject?.weeklyPlans?.find(plan => plan.status === 'in-progress'),
        [activeProject]
    );

    // 核心改进：列出项目中所有待办任务
    const allProjectTasks = useMemo(() =>
        activePlan?.tasks.filter(t => t.status === 'pending') || [],
        [activePlan]
    );

    // 每次切换项目或打开菜单时，初始化当前成员已选中的任务
    useEffect(() => {
        if (showAssignMenu && allProjectTasks) {
            const currentSelection = new Set<string>();
            allProjectTasks.forEach(t => {
                if (t.assignedTo?.includes(member.name)) {
                    currentSelection.add(t.title);
                }
            });
            setMemberTaskSelection(currentSelection);
        }
    }, [showAssignMenu, selectedProjectId, allProjectTasks, member.name]);

    const handleToggleTaskSelection = (e: React.MouseEvent, title: string) => {
        e.stopPropagation();
        setMemberTaskSelection(prev => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title);
            else next.add(title);
            return next;
        });
    };

    const confirmTaskAssignment = (e: React.MouseEvent) => {
        e.stopPropagation();

        setProjects(prev => prev.map(p => {
            if (p.id !== selectedProjectId) return p;

            const nextWeeklyPlans = (p.weeklyPlans || []).map(plan => {
                if (plan.status !== 'in-progress') return plan;

                return {
                    ...plan,
                    tasks: plan.tasks.map(t => {
                        const isSelectedInUI = memberTaskSelection.has(t.title);
                        const isAlreadyAssigned = t.assignedTo?.includes(member.name);

                        if (isSelectedInUI && !isAlreadyAssigned) {
                            // 新增指派
                            return { ...t, assignedTo: Array.from(new Set([...(t.assignedTo || []), member.name])) };
                        } else if (!isSelectedInUI && isAlreadyAssigned) {
                            // 移除指派
                            const nextAssignees = (t.assignedTo || []).filter(n => n !== member.name);
                            return {
                                ...t,
                                assignedTo: nextAssignees.length > 0 ? nextAssignees : undefined,
                                assignedDay: nextAssignees.length > 0 ? t.assignedDay : undefined
                            };
                        }
                        return t;
                    })
                };
            });

            return { ...p, weeklyPlans: nextWeeklyPlans };
        }));

        showToast({ message: t('team.card.tasks.matrixUpdated', { name: member.name }), type: 'success' });
        setShowAssignMenu(false);
    };

    return (
        <div className={`bg-white rounded-[2.5rem] p-6 border-2 transition-all duration-500 group relative flex flex-col ${isOverloaded ? 'border-rose-200 ring-4 ring-rose-50 shadow-rose-100' :
            isTopSecret ? 'border-indigo-200 ring-2 ring-indigo-50 shadow-indigo-50' :
                'border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-500/30'
            }`}>

            {/* 顶部标签组 */}
            <div className="flex justify-between items-center mb-5 shrink-0 relative z-30">
                <div className="flex gap-1.5 flex-wrap items-center">
                    <button
                        onClick={handleCycleStatus}
                        className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase border shadow-sm transition-all flex items-center gap-1.5 ${status === 'Busy' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}
                    >
                        <div className={`w-1.5 h-1.5 rounded-full ${status === 'Busy' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                        {status === 'Busy' ? t('team.card.busy') : t('team.card.available')}
                    </button>

                    <div className="relative" ref={calendarRef}>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowCalendar(!showCalendar); setShowAssignMenu(false); }}
                            className={`w-7 h-5 rounded-lg border flex items-center justify-center transition-all relative ${showCalendar ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-200 shadow-lg' : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                            title="周出勤及请假管理"
                        >
                            <i className="fa-regular fa-calendar-check text-[10px]"></i>
                            {leaveDays.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 border border-white rounded-full animate-pulse"></span>
                            )}
                        </button>

                        {showCalendar && (
                            <div className="absolute top-full left-0 mt-2 w-52 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl p-3 z-[100] animate-reveal">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1 flex justify-between">
                                    <span>{t('team.card.calendar.title')}</span>
                                    <span className="text-indigo-600 italic">{t('team.card.calendar.weekly')}</span>
                                </p>
                                <div className="flex justify-between gap-1">
                                    {DAYS_SHORT.map((day, idx) => {
                                        const isLeave = leaveDays.includes(idx);
                                        const hasTask = assignedTasks.some(t => t.assignedDay === idx);
                                        return (
                                            <button
                                                key={idx}
                                                onClick={(e) => toggleLeaveDay(e, idx)}
                                                className={`flex-1 py-2 rounded-lg flex flex-col items-center justify-center transition-all border ${isLeave
                                                    ? 'bg-rose-50 border-rose-400 text-white shadow-md'
                                                    : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-white hover:border-indigo-300'
                                                    }`}
                                            >
                                                <span className="text-[9px] font-black">{day}</span>
                                                {hasTask && !isLeave && <div className="w-1 h-1 rounded-full bg-indigo-500 mt-1"></div>}
                                                {isLeave && <div className="w-2 h-0.5 bg-white/40 mt-1"></div>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <EducationBadge level={member.education} className="!shadow-none !px-2 !py-0.5 !rounded-lg !text-[7px]" showLabel={true} />

                    <span className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase border shadow-sm ${member.securityLevel === '绝密' ? 'bg-rose-600 text-white border-rose-500 animate-pulse' :
                        member.securityLevel === '机密' ? 'bg-amber-500 text-white border-amber-400' :
                            'bg-slate-50 text-slate-600 border-slate-100'
                        }`}>
                        <i className="fa-solid fa-shield-halved mr-1"></i>
                        {member.securityLevel === '绝密' ? t('team.card.topSecret') : 
                         member.securityLevel === '机密' ? t('team.card.confidential') : 
                         member.securityLevel === '内部' ? t('team.card.internal') : member.securityLevel}
                    </span>
                </div>

                <div className={`flex gap-2 items-center transition-all duration-300 ${deleteStage > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    {onDelete && (
                        <AnimatePresence mode="wait">
                            {deleteStage === 0 ? (
                                <motion.button key="stage-0" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} onClick={handleDeleteClick} className="w-7 h-7 rounded-lg bg-rose-50 text-rose-400 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-90"><i className="fa-solid fa-trash-can text-[10px]"></i></motion.button>
                            ) : deleteStage === 1 ? (
                                <motion.button key="stage-1" initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1 }} exit={{ width: 0, opacity: 0 }} onClick={handleDeleteClick} className="px-3 h-7 bg-amber-500 text-white rounded-lg text-[8px] font-black uppercase shadow-lg border border-amber-400 whitespace-nowrap flex items-center gap-1.5"><i className="fa-solid fa-triangle-exclamation"></i> {t('team.deleteConfirm.stage1')}</motion.button>
                            ) : (
                                <motion.button key="stage-2" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={handleDeleteClick} className="px-3 h-7 bg-rose-600 text-white rounded-lg text-[8px] font-black uppercase shadow-lg border border-rose-500 whitespace-nowrap flex items-center gap-1.5 animate-pulse"><i className="fa-solid fa-radiation"></i> {t('team.deleteConfirm.stage2')}</motion.button>
                            )}
                        </AnimatePresence>
                    )}
                    <button onClick={() => onEdit(member)} className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-400 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-90"><i className="fa-solid fa-pen-to-square text-[10px]"></i></button>
                </div>
            </div>

            <div className="flex items-center gap-4 mb-4 shrink-0 relative">
                <div className="relative shrink-0">
                    <div className={`w-20 h-20 rounded-3xl bg-slate-50 border-4 border-white shadow-xl overflow-hidden group-hover:scale-105 transition-transform duration-500 ${isTopSecret ? 'ring-2 ring-rose-500 ring-offset-2' : ''}`}>
                        <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute -top-3 -left-3 rotate-[-12deg] group-hover:rotate-0 transition-transform duration-500">
                        <CharacterIcon type={member.scientificTemperament} size="sm" />
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-white shadow-md ${isOverloaded ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-black text-slate-800 leading-none truncate italic tracking-tighter mb-2">{member.name}</h3>
                    <p className={`text-[9px] font-black uppercase tracking-[0.15rem] line-clamp-1 mb-2 ${member.scientificTemperament === 'Explorer' ? 'text-indigo-600' :
                        member.scientificTemperament === 'Optimizer' ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                        {member.scientificTemperament}
                    </p>
                    <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest leading-none mb-2">{member.role}</p>
                    <p className="text-[7.5px] font-black text-slate-400 uppercase leading-none truncate bg-slate-50 px-2 py-1.5 rounded-lg w-fit border border-slate-100">{member.department}</p>
                </div>
            </div>

            <div className="flex justify-center mb-4">
                <button
                    onClick={(e) => { e.stopPropagation(); setIsDetailsExpanded(!isDetailsExpanded); }}
                    className="w-full py-2 bg-slate-50 border border-slate-100 rounded-xl text-[9px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-100 hover:text-indigo-500 transition-all flex items-center justify-center gap-2 group/btn"
                >
                    {isDetailsExpanded ? t('team.card.dna.collapse') : t('team.card.dna.expand')}
                    <i className="fa-solid fa-chevron-down group-hover/btn:translate-y-0.5 transition-transform" style={{ transform: isDetailsExpanded ? 'rotate(180deg)' : 'none' }}></i>
                </button>
            </div>

            {isDetailsExpanded && (
                <div className="animate-reveal space-y-5 mb-5">
                    <div className="h-40 w-full bg-slate-50/50 rounded-[2rem] border border-slate-100 shadow-inner relative overflow-hidden flex items-center justify-center shrink-0">
                        {isEditingDNA ? (
                            <div className="w-full h-full p-4 flex flex-col justify-center gap-2 animate-reveal bg-white/80 backdrop-blur-sm z-20">
                                {localMetrics.map((m) => (
                                    <div key={m.subject} className="flex items-center gap-3">
                                        <span className="text-[8px] font-black text-slate-500 i-12 truncate uppercase">{m.subject}</span>
                                        <input type="range" min="0" max="100" className="flex-1 accent-indigo-600 h-1 rounded-full cursor-pointer" value={m.A} onChange={(e) => setLocalMetrics(localMetrics.map(item => item.subject === m.subject ? { ...item, A: parseInt(e.target.value) } : item))} />
                                        <span className="text-[8px] font-black text-indigo-600 font-mono w-5 text-right">{Math.round(m.A)}</span>
                                    </div>
                                ))}
                                <button onClick={handleSaveDNA} className="mt-1 w-full py-1.5 bg-indigo-600 text-white rounded-lg text-[7px] font-black uppercase shadow-lg active:scale-95">{t('team.card.dna.edit')}</button>
                            </div>
                        ) : (
                            <>
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="55%" data={localMetrics}>
                                        <PolarGrid stroke="#e2e8f0" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10, fontWeight: '800' }} />
                                        <Radar name={member.name} dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                                    </RadarChart>
                                </ResponsiveContainer>
                                <button onClick={() => setIsEditingDNA(true)} className="absolute top-3 right-3 w-6 h-6 rounded-lg bg-white/80 border border-indigo-100 text-indigo-400 hover:text-indigo-600 hover:bg-white shadow-sm flex items-center justify-center transition-all z-10"><i className="fa-solid fa-sliders text-[9px]"></i></button>
                            </>
                        )}
                    </div>
                    <div className="p-4 rounded-[2rem] bg-white border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group/dna">
                        {/* Background decorative elements */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-50 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>

                        <div className="flex justify-between items-center mb-4 relative z-10">
                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <i className="fa-solid fa-dna text-indigo-500 group-hover/dna:animate-pulse"></i>
                                {t('team.card.dna.title')}
                            </p>
                            <div className="flex gap-1">
                                <span className="w-1 h-3 rounded-full bg-indigo-500/80 shadow-sm"></span>
                                <span className="w-1 h-3 rounded-full bg-emerald-500/80 shadow-sm"></span>
                                <span className="w-1 h-3 rounded-full bg-amber-500/80 shadow-sm"></span>
                            </div>
                        </div>

                        <div className="space-y-4 relative z-10">
                            {[
                                { full: t('team.card.dna.resilience'), val: member.resilienceIndex || 50, color: 'from-emerald-400 to-emerald-500', icon: 'fa-shield-heart' },
                                { full: t('team.card.dna.synergy'), val: member.synergyIndex || 50, color: 'from-indigo-400 to-indigo-500', icon: 'fa-people-arrows' },
                                { full: t('team.card.dna.consistency'), val: member.qcConsistency || 50, color: 'from-amber-400 to-amber-500', icon: 'fa-check-double' },
                            ].map(idx => (
                                <div key={idx.full} className="space-y-1.5">
                                    <div className="flex justify-between items-end">
                                        <div className="flex items-center gap-1.5">
                                            <i className={`fa-solid ${idx.icon} text-[8px] text-slate-400`}></i>
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600">{idx.full}</span>
                                        </div>
                                        <span className="text-[10px] font-black font-mono text-slate-800">{idx.val}<span className="text-[7px] text-slate-400 ml-0.5">%</span></span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner relative">
                                        <div
                                            className={`absolute top-0 left-0 h-full bg-gradient-to-r ${idx.color} rounded-full transition-all duration-1000 ease-out shadow-sm`}
                                            style={{ width: `${idx.val}%` }}
                                        >
                                            {/* Shimmer effect */}
                                            <div className="absolute top-0 right-0 bottom-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {member.mastery && member.mastery.length > 0 && (
                        <div className="p-4 rounded-[2rem] bg-slate-50/50 border border-slate-100 shadow-inner">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><i className="fa-solid fa-microscope text-indigo-400"></i> {t('team.card.mastery.title')}</p>
                            <div className="flex flex-wrap gap-2">
                                {member.mastery.map(m => (
                                    <div key={m.name} className="flex items-center gap-2 bg-white px-2.5 py-2 rounded-xl border border-slate-200 shadow-sm flex-1 min-w-[120px]">
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white ${getMasteryColor(m.level)} shadow-inner shrink-0`}>
                                            {t('team.card.mastery.level', { level: m.level })}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <p className="text-[9px] font-bold text-slate-700 truncate leading-none">{m.name}</p>
                                                <span className="text-[7px] font-black text-slate-400 font-mono scale-90 origin-right">{m.experience || 0}/100</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full ${getMasteryColor(m.level)} opacity-60 transition-all duration-500`} style={{ width: `${m.experience || 0}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="mb-5 flex-1 flex flex-col min-h-0">
                <div className="flex justify-between items-center px-1 mb-2">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">{t('team.card.tasks.title')}</p>
                    <span className="text-[9px] font-black text-indigo-600 italic bg-indigo-50 px-2 py-0.5 rounded-full">{assignedTasks.length}</span>
                </div>
                <div className="space-y-1.5 overflow-y-auto custom-scrollbar flex-1 pr-1 max-h-[120px]">
                    {assignedTasks.map((t, i) => (
                        <div key={i} className="bg-slate-50/50 border border-slate-100 p-2 rounded-xl">
                            <div className="flex justify-between items-start mb-0.5">
                                <p className="text-[7px] font-black text-indigo-400 uppercase truncate opacity-60">{t.projectTitle}</p>
                                {t.assignedDay !== undefined && <span className="text-[6px] font-black bg-white px-1 rounded border border-slate-200 ml-1">周{DAYS_SHORT[t.assignedDay]}</span>}
                            </div>
                            <p className="text-[9px] font-bold text-slate-700 truncate leading-tight">{t.taskTitle}</p>
                        </div>
                    ))}
                    {assignedTasks.length === 0 && (
                        <div className="text-center py-4 text-slate-300 text-[8px] italic">暂无分配任务</div>
                    )}
                </div>
            </div>

            <div className="pt-4 border-t border-slate-100 shrink-0 relative">
                <div className="flex justify-between items-end px-1 mb-2">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t('team.card.workload')}</span>
                    <span className={`text-[10px] font-black italic ${isOverloaded ? 'text-rose-500' : 'text-indigo-600'}`}>{member.workload}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-5">
                    <div className={`h-full transition-all duration-1000 ${isOverloaded ? 'bg-rose-50 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-indigo-600 shadow-[0_0_8px_rgba(99,102,241,0.5)]'}`} style={{ width: `${member.workload}%` }}></div>
                </div>

                <div className="flex gap-2 relative">
                    <div className="flex-1 relative" ref={assignMenuRef}>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowAssignMenu(!showAssignMenu); setShowCalendar(false); }}
                            className="w-full py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-indigo-100 transition-all hover:bg-black active:scale-95 flex items-center justify-center gap-2"
                        >
                            {t('team.card.assign')}
                        </button>

                        <AnimatePresence>
                            {showAssignMenu && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute bottom-full left-0 w-72 mb-4 bg-white rounded-3xl shadow-2xl border border-slate-200 z-[200] overflow-hidden flex flex-col p-4 animate-reveal origin-bottom-left"
                                    onClick={e => e.stopPropagation()}
                                >
                                    <header className="mb-3 border-l-4 border-indigo-600 pl-3 shrink-0 flex justify-between items-start">
                                        <div className="min-w-0 flex-1 pr-2">
                                            <h3 className="text-[11px] font-black text-slate-800 uppercase italic tracking-tighter">{t('team.assignment.title')}</h3>
                                            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{t('team.assignment.manageFor', { name: member.name })}</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setReturnPath('team');
                                                navigate('project_detail', selectedProjectId, 'plan_board:panorama');
                                            }}
                                            className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100 shadow-sm flex items-center gap-1.5 shrink-0"
                                            title="跳转到全景周期排期表"
                                        >
                                            <i className="fa-solid fa-calendar-week"></i>
                                            {t('team.assignment.panorama')}
                                        </button>
                                    </header>

                                    <div className="space-y-4 flex flex-col min-h-0">
                                        <div>
                                            <label className="text-[8px] font-black text-slate-400 uppercase mb-1.5 block">{t('team.assignment.selectProject')}</label>
                                            <select
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-[10px] font-bold text-slate-700 outline-none focus:border-indigo-400 shadow-inner appearance-none cursor-pointer"
                                                value={selectedProjectId}
                                                onChange={(e) => { setSelectedProjectId(e.target.value); }}
                                            >
                                                {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                            </select>
                                        </div>

                                        <div className="flex-1 flex flex-col min-h-0">
                                            <label className="text-[8px] font-black text-slate-400 uppercase mb-1.5 block">{t('team.assignment.taskList')}</label>
                                            <div className="max-h-48 overflow-y-auto custom-scrollbar bg-slate-50 rounded-xl p-2 border border-slate-200 shadow-inner space-y-1.5">
                                                {allProjectTasks.length > 0 ? (
                                                    allProjectTasks.map(task => {
                                                        const isSelected = memberTaskSelection.has(task.title);
                                                        return (
                                                            <div
                                                                key={task.title}
                                                                onClick={(e) => handleToggleTaskSelection(e, task.title)}
                                                                className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center gap-2 ${isSelected
                                                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                                                                    : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200'
                                                                    }`}
                                                            >
                                                                <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-white/20 border-white' : 'border-slate-300 bg-slate-50'}`}>
                                                                    {isSelected && <i className="fa-solid fa-check text-[7px]"></i>}
                                                                </div>
                                                                <p className="text-[9px] font-bold italic truncate flex-1">{task.title}</p>
                                                                {!isSelected && task.assignedTo && task.assignedTo.length > 0 && (
                                                                    <span className="text-[6px] opacity-40 uppercase">已派他人</span>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="py-4 flex flex-col items-center justify-center opacity-30 gap-2">
                                                        <i className="fa-solid fa-clipboard-check text-xl"></i>
                                                        <p className="text-[7px] font-black uppercase">{t('team.assignment.noTasks')}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex gap-2">
                                        <button onClick={() => setShowAssignMenu(false)} className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-xl text-[9px] font-black uppercase">{t('team.assignment.cancel')}</button>
                                        <button onClick={confirmTaskAssignment} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg">{t('team.assignment.confirm')}</button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <button onClick={() => onEdit(member)} className="w-12 h-12 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center hover:bg-indigo-50 transition-all active:scale-90"><i className="fa-solid fa-user-gear"></i></button>
                </div>
            </div>
        </div>
    );
};

export default MemberCard;
