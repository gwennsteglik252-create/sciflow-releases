import React, { useRef, useState, useMemo } from 'react';
import { UserProfile } from '../../types';
import { useCollaborationEngine } from '../../hooks/useCollaborationEngine';
import { useProjectContext } from '../../context/ProjectContext';

interface CollaborationCanvasProps {
    members: UserProfile[];
}

const CollaborationCanvas: React.FC<CollaborationCanvasProps> = ({ members }) => {
    const { projects, navigate, returnPath, setReturnPath, showToast } = useProjectContext();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [lightsOn, setLightsOn] = useState(false);
    
    useCollaborationEngine({ 
        members, 
        projects, 
        canvasRef, 
        lightsOn,
        onNavigate: navigate
    });

    const isNightTime = () => {
        const hour = new Date().getHours();
        return hour < 7 || hour >= 19;
    };

    const handleGoToSchedule = () => {
        const activeProject = projects.find(p => p.weeklyPlans?.some(w => w.status === 'in-progress')) || projects[0];
        if (activeProject) {
            setReturnPath('team/simulation');
            navigate('project_detail', activeProject.id, 'plan_board:panorama');
        } else {
            showToast({ message: "未找到活跃课题计划", type: 'info' });
        }
    };

    const handleMemberClick = (memberName: string) => {
        const memberProject = projects.find(p => p.members.includes(memberName)) || projects[0];
        if (memberProject) {
            setReturnPath('team/simulation');
            navigate('project_detail', memberProject.id, 'plan_board:panorama');
        } else {
            showToast({ message: "该成员当前无活跃课题任务", type: 'info' });
        }
    };

    // Calculate bandwidth for the monitor bar mirroring the WeeklyPlanBoard's UI
    const memberDynamicLoads = useMemo(() => {
        return members.map(m => {
            let activeTaskCount = 0;
            projects.forEach(p => {
                p.weeklyPlans?.filter(wp => wp.status === 'in-progress').forEach(plan => {
                    plan.tasks.forEach(t => { 
                        if (t.status === 'pending' && t.assignedTo?.includes(m.name)) activeTaskCount++;
                    });
                });
            });
            return { name: m.name, avatar: m.avatar, load: Math.min(100, 5 + activeTaskCount * 15) };
        });
    }, [members, projects]);

    return (
        <div className="relative w-full h-[650px] bg-slate-200 rounded-[3.5rem] border border-slate-300 shadow-2xl overflow-hidden animate-reveal group/canvas">
            {/* Header Overlay */}
            <div className="absolute top-8 left-10 flex items-center gap-4 pointer-events-none z-50">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl ring-4 ring-indigo-500/20">
                    <i className="fa-solid fa-layer-group text-xl"></i>
                </div>
                <div>
                    <h5 className="text-sm font-black uppercase tracking-[0.2rem] text-slate-800 leading-none drop-shadow-sm">AUTONOMOUS RESEARCH FLOOR</h5>
                    <p className="text-[8px] font-bold text-slate-500 mt-2 uppercase italic tracking-widest">Real-time Synergy Engine v4.5</p>
                </div>
            </div>

            {/* Light Switch Button */}
            <div className="absolute top-8 right-10 z-[60] flex flex-col items-center gap-2">
                <button 
                    onClick={() => setLightsOn(!lightsOn)}
                    className={`w-12 h-12 rounded-full backdrop-blur-xl border-2 transition-all duration-500 flex items-center justify-center shadow-2xl active:scale-95 ${
                        lightsOn 
                            ? 'bg-amber-400/90 border-amber-300 text-white shadow-amber-400/40' 
                            : 'bg-slate-900/60 border-white/20 text-slate-300'
                    }`}
                >
                    <i className={`fa-solid ${lightsOn ? 'fa-lightbulb animate-pulse' : 'fa-moon'} text-lg`}></i>
                </button>
                {isNightTime() && (
                    <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest bg-white/40 px-2 py-0.5 rounded-full">
                        {lightsOn ? 'Override ON' : 'Night Mode'}
                    </span>
                )}
            </div>
            
            <canvas ref={canvasRef} className="w-full h-full block cursor-default" />
            
            {/* 带宽监测面板与按钮组 */}
            <div className="absolute bottom-24 right-12 w-auto max-w-[85%] bg-white/95 backdrop-blur-md rounded-3xl p-1.5 border border-slate-200 shadow-2xl flex items-center gap-4 no-print justify-between z-50">
                <div className="flex items-center gap-4 flex-1 min-w-0 ml-2">
                    <div className="flex items-center gap-2.5 shrink-0">
                        <div className="w-7 h-7 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-inner">
                            <i className="fa-solid fa-chart-line text-xs"></i>
                        </div>
                        <div className="flex flex-col">
                            <h5 className="text-[9px] font-black text-slate-800 uppercase tracking-widest leading-none">团队带宽</h5>
                        </div>
                        <div className="h-6 w-px bg-slate-100 ml-1"></div>
                    </div>
                    <div className="flex gap-3 overflow-x-auto no-scrollbar py-0.5 flex-1">
                        {memberDynamicLoads.map(ml => {
                            const isCritical = ml.load > 85; const isWarning = ml.load > 65;
                            const barColor = isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500';
                            return (
                                <div 
                                    key={ml.name} 
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('memberName', ml.name);
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    onClick={() => handleMemberClick(ml.name)}
                                    className={`flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-slate-100 shadow-sm min-w-[100px] transition-all hover:scale-105 cursor-pointer active:scale-95`}
                                >
                                    <img src={ml.avatar} className="w-6 h-6 rounded-lg border border-slate-100 shadow-xs" alt="" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-end mb-0.5"><p className="text-[8px] font-black text-slate-700 truncate leading-none">{ml.name.split(' ').pop()}</p><span className={`text-[7px] font-black ${isCritical ? 'text-rose-600' : 'text-slate-400'}`}>{ml.load.toFixed(0)}%</span></div>
                                        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${barColor}`} style={{ width: `${ml.load}%` }}></div></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex gap-2 mr-2">
                    <button
                        onClick={handleGoToSchedule}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[8px] font-black uppercase shadow-lg hover:bg-black transition-all flex items-center gap-2 active:scale-95 shrink-0 border border-white/10"
                    >
                        <i className="fa-solid fa-calendar-week"></i>
                        全景排期表
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CollaborationCanvas;