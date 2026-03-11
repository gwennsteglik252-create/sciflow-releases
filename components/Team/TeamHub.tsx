
import React, { useState, useMemo, useEffect } from 'react';
import { useProjectContext } from '../../context/ProjectContext';
import { UserProfile, ExpertiseScore, ScientificTemperament } from '../../types';
import MemberCard from './MemberCard';
import CollaborationTopology from './CollaborationTopology';
import TeamFormationModal from './TeamFormationModal';
import MemberEditModal from './Sub/MemberEditModal';
import SafeModal, { SafeModalConfig } from '../SafeModal';
import CollaborationCanvas from './CollaborationCanvas';

// 扩展为 20 种头像种子 (10男10女)
const AVATAR_OPTIONS = [
  'Luo', 'James', 'Jasper', 'Leo', 'Felix', 'John', 'Victor', 'George', 'Oliver', 'Jack',
  'Sarah', 'Aria', 'Lily', 'Nova', 'Mia', 'Zoe', 'Maya', 'Anna', 'Elena', 'Iris'
].map(seed => `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`);

// 针对金属空气电池与双功能催化项目优化的设备库
const COMMON_LAB_EQUIPMENT = [
  '扫描电镜 (SEM)', '透射电镜 (TEM)', 'X射线衍射 (XRD)', 'XPS 能谱分析', 
  '电化学工作站', '旋转环盘电极 (RRDE)', '旋转圆盘电极 (RDE)', 
  'LAND 电池测试系统', 'NEWARE 电池测试中心', '手套箱操作 (Glovebox)',
  '比表面积 (BET)', '原位拉曼 (In-situ Raman)', '原位红外 (In-situ IR)',
  '同步辐射 XAFS 分析', '接触角测量 (Contact Angle)', 'ICP-MS 质谱', 
  '静电纺丝 (Electrospinning)', '原子层沉积 (ALD)', '管式炉焙烧', 
  '水热反应釜操作', '气相色谱 (GC)'
];

const TeamHub: React.FC = () => {
    const { activeTheme, showToast, projects, teamMembers, setTeamMembers, returnPath, setReturnPath, navigate } = useProjectContext();
    const isLight = activeTheme.type === 'light';

    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'simulation' | 'topology'>('grid');
    const [editingMember, setEditingMember] = useState<UserProfile | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showFormationModal, setShowFormationModal] = useState(false);
    const [confirmModal, setConfirmModal] = useState<SafeModalConfig | null>(null);

    // 同步路由状态：当从 subView 返回时切换视图
    useEffect(() => {
        const hash = window.location.hash;
        if (hash.includes('/simulation')) setViewMode('simulation');
        else if (hash.includes('/topology')) setViewMode('topology');
        else setViewMode('grid');
    }, [window.location.hash]);

    // Handler for the return button
    const handleBack = () => {
        if (returnPath) {
            const path = returnPath;
            setReturnPath(null); // Clear path after returning
            if (path.startsWith('#')) {
                window.location.hash = path;
            } else {
                window.location.hash = `#${path}`;
            }
        } else {
            navigate('dashboard');
        }
    };

    // Helper to calculate tasks for a specific member
    const getAssignedTasks = (memberName: string) => {
        const tasks: { projectTitle: string, taskTitle: string, assignedDay?: number }[] = [];
        projects.forEach(p => {
            p.weeklyPlans?.filter(w => w.status === 'in-progress').forEach(plan => {
                plan.tasks.forEach(t => { 
                    if (t.status === 'pending' && t.assignedTo?.includes(memberName)) {
                        tasks.push({ projectTitle: p.title, taskTitle: t.title, assignedDay: t.assignedDay }); 
                    }
                });
            });
        });
        return tasks;
    };

    // Dynamically calculate workload based on real tasks
    const membersWithDynamicWorkload = useMemo(() => {
        return teamMembers.map(m => {
            const tasks = getAssignedTasks(m.name);
            const calculatedWorkload = Math.min(100, 5 + tasks.length * 15);
            
            return {
                ...m,
                workload: calculatedWorkload,
                _tempTasks: tasks 
            };
        });
    }, [teamMembers, projects]);

    const filteredMembers = useMemo(() => {
        return membersWithDynamicWorkload.filter(m => 
            m.name.toLowerCase().includes(search.toLowerCase()) || 
            (m.researchArea || "").toLowerCase().includes(search.toLowerCase())
        );
    }, [membersWithDynamicWorkload, search]);

    const handleSaveMember = (updated: UserProfile) => {
        setTeamMembers(prev => {
            const exists = prev.find(m => m.id === updated.id);
            if (exists) return prev.map(m => m.id === updated.id ? updated : m);
            return [updated, ...prev];
        });
        setShowEditModal(false);
        setEditingMember(null);
        showToast({ message: `人员档案已保存: ${updated.name}`, type: 'success' });
    };

    const handleOpenAdd = () => {
        setEditingMember({
            name: '', role: '研究助理', id: `SF-${Math.floor(1000 + Math.random() * 9000)}`,
            education: '博士', department: '基础研究部', projectGroup: '新课题组',
            securityLevel: '内部', institution: 'SciFlow 前沿实验室', researchArea: '',
            avatar: AVATAR_OPTIONS[0], expertise: [], gender: 'Male',
            expertiseMetrics: [
                { subject: '合成制备', A: 50, fullMark: 100 },
                { subject: '性能表征', A: 50, fullMark: 100 },
                { subject: '理论计算', A: 50, fullMark: 100 },
                { subject: '工程放大', A: 50, fullMark: 100 },
                { subject: '数据挖掘', A: 50, fullMark: 100 },
            ],
            mastery: [], scientificTemperament: 'Explorer',
            resilienceIndex: 60, synergyIndex: 70, qcConsistency: 80,
            activeProjectsCount: 0, workload: 0
        });
        setShowEditModal(true);
    };

    return (
        <div className="h-full flex flex-col gap-6 animate-reveal p-6 lg:p-10 bg-[#f8fafc] relative overflow-hidden">
            <header className="flex flex-col xl:flex-row justify-between items-end gap-6 shrink-0">
                <div className="flex items-center gap-5 mb-2 xl:mb-0">
                    {returnPath && (
                        <button 
                            onClick={handleBack}
                            className={`mr-2 px-6 py-3 rounded-2xl flex items-center justify-center transition-all active:scale-95 shadow-lg gap-3 border-2 ${isLight ? 'bg-amber-50 border-amber-400 text-slate-800' : 'bg-amber-600 border-amber-500 text-white'} animate-bounce-subtle shrink-0`}
                        >
                            <i className="fa-solid fa-arrow-left-long text-base"></i>
                            <span className="text-[11px] font-black uppercase">返回</span>
                        </button>
                    )}
                    <div className="w-14 h-14 bg-indigo-600 rounded-[1.2rem] flex items-center justify-center text-white shadow-xl">
                        <i className="fa-solid fa-id-card-clip text-2xl"></i>
                    </div>
                    <div>
                        <h2 className={`text-2xl font-black italic uppercase tracking-tighter leading-none ${isLight ? 'text-slate-800' : 'text-white'}`}>科研人力矩阵</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3rem] mt-2">PEOPLE & TASK SYNERGY</p>
                    </div>
                </div>

                <div className={`flex flex-wrap items-center gap-3 p-2 rounded-[2rem] border shadow-sm w-full xl:w-auto ${isLight ? 'bg-white border-slate-200' : 'bg-slate-800/80 border-white/10'}`}>
                    <div className={`p-1 rounded-xl flex gap-1 shrink-0 ${isLight ? 'bg-slate-100' : 'bg-slate-900/50'}`}>
                        <button 
                            onClick={() => navigate('team', undefined, 'grid')} 
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-grip"></i> <span className="hidden sm:inline">列表</span>
                        </button>
                        <button 
                            onClick={() => navigate('team', undefined, 'simulation')} 
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${viewMode === 'simulation' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-vr-cardboard"></i> <span className="hidden sm:inline">虚拟室</span>
                        </button>
                        <button 
                            onClick={() => navigate('team', undefined, 'topology')} 
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${viewMode === 'topology' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <i className="fa-solid fa-circle-nodes"></i> <span className="hidden sm:inline">拓扑</span>
                        </button>
                    </div>

                    <div className={`w-px h-6 mx-1 hidden sm:block ${isLight ? 'bg-slate-200' : 'bg-white/10'}`}></div>

                    <div className="flex gap-2">
                        <button 
                            onClick={() => setShowFormationModal(true)} 
                            className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-orange-100 hover:shadow-orange-200 hover:brightness-105 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <i className="fa-solid fa-wand-magic-sparkles"></i> 智能组队
                        </button>
                        <button 
                            onClick={handleOpenAdd} 
                            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-200 hover:bg-black transition-all flex items-center gap-2"
                        >
                            <i className="fa-solid fa-plus"></i> 录入
                        </button>
                    </div>

                    <div className="relative group flex-1 min-w-[180px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <i className="fa-solid fa-magnifying-glass text-slate-400 text-[10px] group-hover:text-indigo-400 transition-colors"></i>
                        </div>
                        <input 
                            className={`block w-full pl-9 pr-4 py-2.5 border rounded-xl text-[11px] font-bold outline-none transition-all ${isLight ? 'bg-slate-50 border-slate-100 text-slate-600 placeholder-slate-400 focus:bg-white focus:border-indigo-300' : 'bg-slate-900/50 border-white/5 text-slate-200'}`}
                            placeholder="搜索成员..." 
                            value={search} 
                            onChange={e => setSearch(e.target.value)} 
                        />
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-hidden">
                {viewMode === 'simulation' ? (
                    <CollaborationCanvas members={membersWithDynamicWorkload} />
                ) : viewMode === 'grid' ? (
                    <div className="h-full overflow-y-auto custom-scrollbar pr-2 pb-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                            {filteredMembers.map(member => (
                                <MemberCard 
                                    key={member.id} member={member} isLight={isLight} 
                                    onEdit={(m) => { setEditingMember(m); setShowEditModal(true); }}
                                    onDelete={(m) => setConfirmModal({ show: true, title: '删除研究员？', desc: `确定移除 ${m.name}？`, onConfirm: () => { setTeamMembers(prev => prev.filter(x => x.id !== m.id)); setConfirmModal(null); }})}
                                    onAssign={() => {}}
                                    onUpdateMetrics={(id, m) => setTeamMembers(prev => prev.map(x => x.id === id ? { ...x, expertiseMetrics: m } : x))}
                                    assignedTasks={(member as any)._tempTasks || []}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <CollaborationTopology members={membersWithDynamicWorkload} projects={projects} />
                )}
            </div>

            {showEditModal && editingMember && (
                <MemberEditModal 
                    member={editingMember} 
                    onClose={() => { setShowEditModal(false); setEditingMember(null); }} 
                    onSave={handleSaveMember}
                    avatarOptions={AVATAR_OPTIONS}
                    commonEquipment={COMMON_LAB_EQUIPMENT}
                />
            )}

            <TeamFormationModal show={showFormationModal} onClose={() => setShowFormationModal(false)} projects={projects} candidates={teamMembers} />
            <SafeModal config={confirmModal} onClose={() => setConfirmModal(null)} />
        </div>
    );
};

export default TeamHub;
