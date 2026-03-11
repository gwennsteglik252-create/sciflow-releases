import React, { useState } from 'react';
import { useProjectContext } from '../../../context/ProjectContext';
import { ManuscriptMeta, SubmissionSimulation, FigureConflict } from '../../../types';
import { generateCoverLetter, analyzeManuscriptConflicts, generateManuscriptHighlights } from '../../../services/gemini/writing';
import ReactMarkdown from 'react-markdown';

interface SubmissionSimulatorProps {
    project: any;
    meta: ManuscriptMeta;
    sections: any[];
    media: any[];
    tables: any[];
    onClose: () => void;
    language: 'zh' | 'en';
}

const SubmissionSimulator: React.FC<SubmissionSimulatorProps> = ({
    project, meta, sections, media, tables, onClose, language
}) => {
    const { showToast, startGlobalTask } = useProjectContext();
    const [simData, setSimData] = useState<Partial<SubmissionSimulation>>({});
    const [isSimulating, setIsSimulating] = useState(false);
    const [activeTab, setActiveTab] = useState<'letter' | 'conflicts' | 'highlights'>('conflicts');

    const runSimulation = async () => {
        setIsSimulating(true);
        await startGlobalTask({ id: 'sub_sim', type: 'diagnose', status: 'running', title: '执行投稿全栈模拟...' }, async () => {
            try {
                // 1. Innovation Points Extraction (Internal logic)
                const innovations = project.keywords || [];

                // 2. Run Simulations in Parallel
                const [letter, conflicts, highlights] = await Promise.all([
                    generateCoverLetter(meta.title || "Target Journal", meta, sections, innovations, language),
                    analyzeManuscriptConflicts(sections, media, tables),
                    generateManuscriptHighlights(sections, language)
                ]);

                setSimData({
                    coverLetter: letter,
                    figureConflicts: conflicts,
                    highlights: highlights,
                    lastCheckTimestamp: new Date().toLocaleString()
                });
                
                showToast({ message: "投稿模拟审计完成", type: 'success' });
            } catch (e) {
                showToast({ message: "模拟失败，请检查 AI 配置", type: 'error' });
            } finally {
                setIsSimulating(false);
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[6000] flex items-center justify-center p-4 lg:p-12">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden border-4 border-white/20 animate-reveal">
                <header className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[1.2rem] flex items-center justify-center text-white shadow-xl ring-4 ring-indigo-500/20">
                            <i className="fa-solid fa-vial-circle-check text-2xl"></i>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black italic uppercase tracking-tighter">投稿前全栈模拟器</h3>
                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3rem] mt-1.5">Pre-submission Simulation & Audit</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={runSimulation}
                            disabled={isSimulating}
                            className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl hover:bg-black transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
                        >
                            {isSimulating ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-bolt-lightning text-amber-300"></i>}
                            启动一键审计
                        </button>
                        <button onClick={onClose} className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-rose-500 transition-all flex items-center justify-center"><i className="fa-solid fa-times text-xl"></i></button>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden">
                    {/* Inner Sidebar */}
                    <div className="w-64 bg-slate-50 border-r border-slate-100 p-6 flex flex-col gap-4">
                        {[
                            { id: 'conflicts', label: '图表冲突审计', icon: 'fa-triangle-exclamation', color: 'text-rose-500' },
                            { id: 'letter', label: 'Cover Letter', icon: 'fa-envelope-open-text', color: 'text-indigo-500' },
                            { id: 'highlights', label: 'Research Highlights', icon: 'fa-list-check', color: 'text-emerald-500' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-3 p-4 rounded-2xl transition-all text-left group ${activeTab === tab.id ? 'bg-white shadow-lg border border-slate-200' : 'hover:bg-white/50 grayscale opacity-60'}`}
                            >
                                <i className={`fa-solid ${tab.icon} ${tab.color} text-base`}></i>
                                <span className={`text-[11px] font-black uppercase tracking-tight ${activeTab === tab.id ? 'text-slate-800' : 'text-slate-400'}`}>{tab.label}</span>
                            </button>
                        ))}
                        
                        <div className="mt-auto pt-6 border-t border-slate-200 opacity-40">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Last Audit</p>
                            <p className="text-[9px] font-mono font-bold text-slate-500 mt-1">{simData.lastCheckTimestamp || 'N/A'}</p>
                        </div>
                    </div>

                    {/* Main Workspace */}
                    <div className="flex-1 bg-white overflow-y-auto custom-scrollbar p-10">
                        {!simData.lastCheckTimestamp && !isSimulating ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-30 gap-6">
                                <i className="fa-solid fa-shield-virus text-7xl"></i>
                                <p className="text-sm font-black uppercase tracking-[0.4rem]">点击上方按钮启动全局模拟</p>
                            </div>
                        ) : isSimulating ? (
                             <div className="h-full flex flex-col items-center justify-center gap-8 animate-pulse">
                                <div className="relative">
                                    <div className="w-24 h-24 rounded-[2rem] border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <i className="fa-solid fa-microchip text-indigo-500 text-3xl animate-pulse"></i>
                                    </div>
                                </div>
                                <div className="text-center space-y-2">
                                    <h4 className="text-xl font-black text-slate-800 uppercase italic tracking-widest">正在模拟专家评审视野...</h4>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Scanning Sections, Figures, and Semantic Consistency</p>
                                </div>
                             </div>
                        ) : (
                            <div className="animate-reveal max-w-4xl mx-auto h-full">
                                {activeTab === 'conflicts' && (
                                    <div className="space-y-6 pb-12">
                                        <h4 className="text-xl font-black text-slate-800 uppercase italic border-l-4 border-rose-500 pl-4 mb-8">图表引用合规性分析</h4>
                                        {simData.figureConflicts && simData.figureConflicts.length > 0 ? (
                                            <div className="space-y-4">
                                                {simData.figureConflicts.map((c, i) => (
                                                    <div key={i} className={`p-6 rounded-[2.5rem] border-2 transition-all flex items-start gap-6 ${c.severity === 'critical' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-100'}`}>
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 ${c.severity === 'critical' ? 'bg-rose-600' : 'bg-amber-500'}`}>
                                                            <i className={`fa-solid ${c.severity === 'critical' ? 'fa-radiation' : 'fa-triangle-exclamation'}`}></i>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.type.replace('_', ' ')}</span>
                                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${c.severity === 'critical' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'}`}>{c.severity}</span>
                                                            </div>
                                                            <h5 className="text-base font-black text-slate-800 mb-2 uppercase">{c.label}</h5>
                                                            <p className="text-[12px] font-medium text-slate-600 leading-relaxed italic mb-4">{c.description}</p>
                                                            <div className="bg-white/60 p-4 rounded-2xl border border-white shadow-inner">
                                                                <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">AI 修订建议 (ACTION)</p>
                                                                <p className="text-[11px] font-bold text-slate-700">{c.suggestion}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="bg-emerald-50 border-2 border-emerald-200 p-12 rounded-[4rem] text-center">
                                                <i className="fa-solid fa-circle-check text-emerald-500 text-6xl mb-6"></i>
                                                <h5 className="text-xl font-black text-emerald-800 uppercase italic mb-2">未发现图表引用冲突</h5>
                                                <p className="text-sm text-emerald-600/80 font-medium">所有文中提到的 [Fig] 和 [Table] 均已在资产库中找到对应关系，且语义保持高度一致。</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'letter' && (
                                    <div className="space-y-6 h-full flex flex-col">
                                        <div className="flex justify-between items-center mb-4 shrink-0">
                                            <h4 className="text-xl font-black text-slate-800 uppercase italic border-l-4 border-indigo-500 pl-4">Cover Letter 自动生成</h4>
                                            <button 
                                                onClick={() => navigator.clipboard.writeText(simData.coverLetter || '')}
                                                className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                            >
                                                <i className="fa-solid fa-copy mr-1.5"></i> 复制内容
                                            </button>
                                        </div>
                                        <div className="flex-1 bg-slate-50 rounded-[3rem] p-12 shadow-inner border border-slate-100 overflow-y-auto custom-scrollbar">
                                            <div className="bg-white p-12 rounded-xl shadow-xl min-h-full font-serif text-[14px] leading-relaxed text-slate-800 border border-slate-200 whitespace-pre-wrap italic">
                                                {simData.coverLetter}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'highlights' && (
                                    <div className="space-y-6 h-full flex flex-col">
                                        <h4 className="text-xl font-black text-slate-800 uppercase italic border-l-4 border-emerald-500 pl-4 mb-8">核心亮点精练 (Highlights)</h4>
                                        <div className="space-y-4">
                                            {simData.highlights?.map((h, i) => (
                                                <div key={i} className="flex gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-200 group hover:border-emerald-400 transition-all items-center">
                                                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-emerald-600 font-black text-sm shrink-0 shadow-sm">{i+1}</div>
                                                    <p className="text-[13px] font-bold text-slate-700 italic group-hover:text-slate-900 transition-colors leading-relaxed">"{h}"</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-8 p-6 bg-emerald-50/50 border-2 border-dashed border-emerald-200 rounded-[2.5rem]">
                                            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <i className="fa-solid fa-circle-info"></i> 投稿提示 (SUBMISSION TIP)
                                            </p>
                                            <p className="text-[11px] font-medium text-emerald-800 leading-relaxed italic">以上亮点已根据期刊标准进行字数限制优化。建议在投稿系统中直接填入。</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                
                <footer className="p-8 bg-white border-t border-slate-100 shrink-0 flex justify-between items-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase italic">
                        <i className="fa-solid fa-shield-halved mr-2 text-indigo-400"></i> AI 审计仅供参考，请在最终提交前进行人工核验。
                    </p>
                    <button onClick={onClose} className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all hover:bg-indigo-600">完成预览</button>
                </footer>
            </div>
        </div>
    );
};

export default SubmissionSimulator;