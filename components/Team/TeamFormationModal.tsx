
import React, { useState } from 'react';
import { useProjectContext } from '../../context/ProjectContext';
import { ResearchProject, UserProfile } from '../../types';
import { recommendTeamSquad } from '../../services/gemini/team';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';

import { useTranslation } from '../../locales/useTranslation';

interface TeamFormationModalProps {
  show: boolean;
  onClose: () => void;
  projects: ResearchProject[];
  candidates: UserProfile[];
}

const TeamFormationModal: React.FC<TeamFormationModalProps> = ({ show, onClose, projects, candidates }) => {
    const { t } = useTranslation();
    const { showToast, setProjects, setTeamMembers } = useProjectContext();
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [results, setResults] = useState<{
        recommendedIds: { id: string, matchScore: number, matchReason: string }[],
        skillGap: string
    } | null>(null);

    const activeProject = projects.find(p => p.id === selectedProjectId);

    const handleRunAnalysis = async () => {
        if (!selectedProjectId) return;
        setIsAnalyzing(true);
        setResults(null);
        try {
            const res = await recommendTeamSquad(activeProject!, candidates);
            setResults(res);
            showToast({ message: t('team.formation.analyzing'), type: 'success' });
        } catch (e) {
            showToast({ message: t('team.formation.analysisFailed'), type: 'error' });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleApplySquad = () => {
        if (!results || !activeProject) return;
        const newMemberNames = results.recommendedIds.map(r => candidates.find(c => c.id === r.id)?.name).filter(Boolean) as string[];
        const uniqueMembers = Array.from(new Set([...activeProject.members, ...newMemberNames]));
        
        setProjects(prev => prev.map(p => p.id === activeProject.id ? { ...p, members: uniqueMembers } : p));
        
        // 更新被选人的负载
        setTeamMembers(prev => prev.map(m => {
            const match = results.recommendedIds.find(r => r.id === m.id);
            if (match) return { ...m, workload: Math.min(100, (m.workload || 0) + 15) };
            return m;
        }));

        showToast({ message: t('team.formation.successToast', { count: newMemberNames.length }), type: 'success' });
        onClose();
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-6xl h-[85vh] rounded-[3.5rem] p-8 lg:p-12 animate-reveal shadow-2xl relative border-4 border-white flex flex-col overflow-hidden">
                <button onClick={onClose} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-all"><i className="fa-solid fa-times text-2xl"></i></button>
                
                <header className="mb-10 flex justify-between items-end shrink-0">
                    <div>
                        <h3 className="text-3xl font-black text-slate-800 uppercase italic tracking-tighter flex items-center gap-4">
                            <i className="fa-solid fa-wand-magic-sparkles text-indigo-600"></i> {t('team.formation.title')}
                        </h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4rem] mt-2">{t('team.formation.subtitle')}</p>
                    </div>
                    
                    <div className="flex gap-3">
                        <select 
                            className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-3 text-xs font-black uppercase italic outline-none min-w-[300px] shadow-inner"
                            value={selectedProjectId}
                            onChange={e => setSelectedProjectId(e.target.value)}
                        >
                            <option value="">{t('team.formation.selectProject')}</option>
                            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                        <button 
                            onClick={handleRunAnalysis}
                            disabled={!selectedProjectId || isAnalyzing}
                            className="px-8 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[11px] shadow-lg hover:bg-black transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isAnalyzing ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-bolt"></i>}
                            {t('team.formation.startRecommendation')}
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    {results ? (
                        <div className="flex-1 grid grid-cols-12 gap-8 overflow-hidden animate-reveal">
                            <div className="col-span-8 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {results.recommendedIds.map((rec) => {
                                        const member = candidates.find(c => c.id === rec.id);
                                        if (!member) return null;
                                        return (
                                            <div key={rec.id} className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-200 relative group">
                                                <div className="absolute top-4 right-6 text-2xl font-black italic text-indigo-600/20">{rec.matchScore}%</div>
                                                <div className="flex items-center gap-4 mb-4">
                                                    <img src={member.avatar} className="w-14 h-14 rounded-2xl border-2 border-white shadow-md" alt="" />
                                                    <div>
                                                        <h4 className="text-lg font-black text-slate-800 leading-none">{member.name}</h4>
                                                        <p className="text-[10px] font-bold text-indigo-500 uppercase mt-1">{member.role}</p>
                                                    </div>
                                                </div>
                                                <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-inner mb-4">
                                                    <p className="text-[9px] font-black text-indigo-600 uppercase mb-1.5 flex items-center gap-2">
                                                        <i className="fa-solid fa-robot"></i> {t('team.formation.logic')}
                                                    </p>
                                                    <p className="text-[11px] font-medium text-slate-600 italic leading-relaxed text-justify">{rec.matchReason}</p>
                                                </div>
                                                <div className="h-40 w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <RadarChart cx="50%" cy="50%" outerRadius="50%" data={member.expertiseMetrics}>
                                                            <PolarGrid stroke="#e2e8f0" />
                                                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }} />
                                                            <Radar dataKey="A" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                                                        </RadarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            <div className="col-span-4 flex flex-col gap-6">
                                <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl relative overflow-hidden flex-1 border border-white/5">
                                    <div className="absolute top-0 right-0 p-8 opacity-5"><i className="fa-solid fa-triangle-exclamation text-8xl"></i></div>
                                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-6 italic">{t('team.formation.skillGap')}</h4>
                                    <div className="bg-white/5 border border-white/10 p-6 rounded-2xl shadow-inner italic leading-relaxed text-[13px] text-indigo-50/80 text-justify">
                                        {results.skillGap}
                                    </div>
                                    <div className="mt-8 pt-6 border-t border-white/5">
                                        <button onClick={handleApplySquad} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-indigo-500/20 hover:bg-emerald-600 transition-all active:scale-95">{t('team.formation.apply')}</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : isAnalyzing ? (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-40 animate-pulse">
                            <div className="w-32 h-32 rounded-[2.5rem] bg-indigo-50 border-2 border-indigo-100 flex items-center justify-center mb-8">
                                <i className="fa-solid fa-microchip text-5xl text-indigo-600 animate-spin"></i>
                            </div>
                            <h4 className="text-xl font-black text-slate-800 uppercase italic tracking-widest">{t('team.formation.simulating')}</h4>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-20 text-slate-400">
                             <i className="fa-solid fa-users-viewfinder text-8xl mb-6"></i>
                             <p className="text-sm font-black uppercase tracking-[0.4rem]">{t('team.formation.selectHint')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TeamFormationModal;
