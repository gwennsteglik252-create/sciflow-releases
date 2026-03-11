
import React, { useState, useMemo, useEffect } from 'react';
import { useProjectContext } from '../../context/ProjectContext';
import { ResearchProject, SavedInception } from '../../types';
import { MOCK_INCEPTION_DRAFTS } from '../../constants';
import CompetitiveHeatmap from './Sub/CompetitiveHeatmap';

const LOADING_STEPS = [
    "正在与 Web of Science 建立语义握手...",
    "正在检索过去 5 年全球核心文献趋势...",
    "分析主要竞争研究组 (Active Labs) 动态...",
    "正在解构专利壁垒与技术陷阱...",
    "计算技术热点点位 (Hotness Matrix)...",
    "识别潜在研究缺口 (Research Gaps)...",
    "正在合成策略对标报告..."
];

const BLUEPRINT_LOADING_STEPS = [
    "正在提取课题核心科学假设...",
    "正在对齐全球活跃实验室研究进度...",
    "正在推演技术演进路线全周期 (Synthetic TRL)...",
    "正在评估人力资源与设备需求 (Resource Gap Analyzer)...",
    "正在依据全球专利布局审校潜在技术壁垒...",
    "正在通过 Monte Carlo 引擎模拟 5-7 年研究风险...",
    "正在计算多维度创新指数与 KPI 预测点位...",
    "正在合成高保真全周期战略推演蓝图 (Master Blueprint)..."
];

const REVIEW_LOADING_STEPS = [
    "正在组建虚拟评审委员会 (Dr. Rigor / Dr. Nova / Dr. Forge)...",
    "严谨派专家正在审查科学假设逻辑闭合性...",
    "创新派专家正在评估跨学科连接度与范式转移潜力...",
    "工程派专家正在模拟从实验室到产线的全链路可行性...",
    "正在启动多轮交叉质询 (Cross-Examination Engine)...",
    "虚拟委员会正在模拟答辩攻防对话...",
    "正在聚合三方专家评分，计算多维度立项指数...",
    "正在生成高密度评审报告 (Deep Review Report)..."
];

const InceptionView: React.FC = () => {
    const {
        activeTheme, showToast, setProjects, userProfile, inceptionSession,
        runInceptionBrainstorm, runInceptionResearch, runInceptionBlueprint, runInceptionReview, updateInceptionSession
    } = useProjectContext();

    const { stage, domain, suggestions, selectedTopic, landscape, hotnessData, blueprint, review, isThinking } = inceptionSession;

    // Loading State UI Controller
    const [loadingStepIdx, setLoadingStepIdx] = useState(0);

    useEffect(() => {
        let interval: any;
        if (isThinking && (stage === 'research' || stage === 'blueprint' || stage === 'review')) {
            interval = setInterval(() => {
                setLoadingStepIdx(prev => (prev + 1));
            }, 3000);
        } else {
            setLoadingStepIdx(0);
        }
        return () => clearInterval(interval);
    }, [isThinking, stage]);

    // Persistence State
    const [savedDrafts, setSavedDrafts] = useState<SavedInception[]>(() => {
        try {
            const saved = localStorage.getItem('sciflow_inception_drafts');
            return (saved && saved !== 'null') ? JSON.parse(saved) : [];
        } catch (e) { return []; }
    });
    const [showLibrary, setShowLibrary] = useState(false);

    useEffect(() => {
        localStorage.setItem('sciflow_inception_drafts', JSON.stringify(savedDrafts));
    }, [savedDrafts]);

    const handleBrainstorm = () => {
        if (!domain.trim() || isThinking) return;
        runInceptionBrainstorm(domain);
    };

    const handleSaveDraft = () => {
        const title = selectedTopic?.title || domain || "未命名立项推演";
        const newDraft: SavedInception = {
            id: Date.now().toString(),
            title: title.length > 25 ? title.substring(0, 25) + '...' : title,
            timestamp: new Date().toLocaleString(),
            sessionData: { stage, domain, suggestions, selectedTopic, landscape, hotnessData, review }
        };
        setSavedDrafts(prev => [newDraft, ...prev]);
        showToast({ message: "立项推演草稿已存入库", type: 'success' });
    };

    const handleLoadDraft = (draft: SavedInception) => {
        updateInceptionSession(draft.sessionData);
        setShowLibrary(false);
        showToast({ message: `已加载草稿: ${draft.title}`, type: 'info' });
    };

    // 核心改进：允许手动切换 Stage 的逻辑
    const canSwitchToStage = (targetStage: string) => {
        if (targetStage === 'ideate') return true;
        if (targetStage === 'research') return !!selectedTopic;
        if (targetStage === 'blueprint') return !!landscape;
        if (targetStage === 'review') return !!landscape && !!selectedTopic;
        return false;
    };

    const handleStageClick = (targetStage: string) => {
        if (isThinking) return;
        if (canSwitchToStage(targetStage)) {
            updateInceptionSession({ stage: targetStage as any });
        } else {
            showToast({ message: "请按顺序完成前置推演步骤", type: 'info' });
        }
    };

    const handleDeleteDraft = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSavedDrafts(prev => prev.filter(d => d.id !== id));
    };

    const handleReset = () => {
        if (window.confirm("确定重置当前推演吗？未保存的数据将丢失。")) {
            updateInceptionSession({
                stage: 'ideate', domain: '', suggestions: [], selectedTopic: null, landscape: null, hotnessData: undefined, review: null
            });
        }
    };

    const handleFinalize = () => {
        const newProject: ResearchProject = {
            id: Date.now().toString(),
            title: selectedTopic.title,
            category: '战略立项',
            description: `【课题类别】: ${selectedTopic.type === 'frontier' ? '前沿探索' : '产业化成熟'}\n\n【核心价值】: ${selectedTopic.impact}\n\n【主要研究缺口】: ${landscape?.researchGaps?.map((g: any) => g.content).join('；') || ''}`,
            status: 'Planning',
            deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            progress: 5,
            trl: selectedTopic.estimatedTrl || 1,
            members: [userProfile.name],
            keywords: domain.split(','),
            milestones: [],
            proposals: [],
            proposalText: `立项推演全文：\n科学假设：${selectedTopic.hypothesis}\n痛点分析：${selectedTopic.painPoint}`
        };
        setProjects(prev => [newProject, ...prev]);
        showToast({ message: "课题已正式收录至工作流！", type: 'success' });
        window.location.hash = `project/${newProject.id}`;
    };

    return (
        <div className="h-full flex flex-col gap-6 animate-reveal p-6 lg:p-10 bg-[#f8fafc] relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #6366f1 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>

            <header className="shrink-0 flex flex-col md:flex-row justify-between items-center gap-6 relative z-50">
                <div className="flex items-center gap-6">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 italic uppercase tracking-tighter flex items-center gap-4 leading-none">
                            <i className="fa-solid fa-compass text-indigo-600 animate-spin-slow"></i> 战略立项推演
                        </h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4rem]">Inception Pusher v4.5</p>
                        </div>
                    </div>

                    <div className="flex items-center bg-white p-1.5 rounded-[1.5rem] border border-slate-200 shadow-sm gap-1">
                        <button onClick={handleSaveDraft} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2 shadow-lg">
                            <i className="fa-solid fa-floppy-disk"></i> 保存草稿
                        </button>
                        <button onClick={() => setShowLibrary(true)} className="px-5 py-2.5 text-indigo-600 bg-indigo-50 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all active:scale-95 flex items-center gap-2">
                            <i className="fa-solid fa-box-archive"></i> 草稿库 ({savedDrafts.length})
                        </button>
                        <button onClick={handleReset} className="w-10 h-10 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl flex items-center justify-center transition-all" title="重置推演">
                            <i className="fa-solid fa-rotate-right text-xs"></i>
                        </button>
                    </div>
                </div>

                <div className="flex bg-white shadow-2xl p-2 rounded-[2rem] border border-slate-100 gap-1 pointer-events-auto">
                    {[
                        { id: 'ideate', label: '选题孵化', icon: 'fa-egg' },
                        { id: 'research', label: '情报扫射', icon: 'fa-satellite-dish' },
                        { id: 'blueprint', label: '蓝图规划', icon: 'fa-map' },
                        { id: 'review', label: '立项评审', icon: 'fa-user-check' }
                    ].map((s, i) => {
                        const isAvailable = canSwitchToStage(s.id);
                        return (
                            <button
                                key={s.id}
                                onClick={() => handleStageClick(s.id)}
                                disabled={!isAvailable}
                                className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all duration-500 border-2 ${stage === s.id
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105'
                                    : isAvailable
                                        ? 'bg-white text-slate-600 border-slate-50 hover:border-indigo-200 cursor-pointer'
                                        : 'bg-slate-50 text-slate-300 border-transparent cursor-not-allowed opacity-50'
                                    }`}
                            >
                                <i className={`fa-solid ${s.icon} text-sm ${stage === s.id ? 'text-indigo-400' : ''}`}></i>
                                <div className="flex flex-col text-left">
                                    <span className="text-[8px] font-black uppercase opacity-50">Step 0{i + 1}</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest">{s.label}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </header>

            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar relative z-10 pr-2">
                {stage === 'ideate' && (
                    <div className="flex-1 flex flex-col items-center justify-center max-w-7xl mx-auto w-full gap-16 pb-20">
                        <div className="text-center space-y-8 w-full max-w-3xl">
                            <h3 className="text-3xl font-black text-slate-900 uppercase italic tracking-tight">定义研究愿景或核心关键词</h3>
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-violet-600 rounded-[2rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                                <input
                                    className="relative w-full bg-white border-4 border-slate-100 rounded-[2rem] px-12 py-8 text-2xl font-bold outline-none shadow-2xl focus:border-indigo-500 transition-all text-center"
                                    placeholder="例如：钠离子电池界面稳定性、全固态电解质..."
                                    value={domain}
                                    onChange={e => updateInceptionSession({ domain: e.target.value })}
                                    onKeyDown={e => e.key === 'Enter' && handleBrainstorm()}
                                />
                                <button
                                    onClick={handleBrainstorm}
                                    disabled={isThinking}
                                    className="absolute right-4 top-4 bottom-4 px-12 bg-slate-900 text-white rounded-2xl font-black uppercase shadow-lg active:scale-95 transition-all hover:bg-indigo-600 disabled:opacity-50"
                                >
                                    {isThinking ? <i className="fa-solid fa-spinner animate-spin"></i> : '启动孵化'}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 w-full animate-reveal">
                            {isThinking ? (
                                // 加载骨架：AI 生成中
                                [0, 1, 2, 3].map(i => (
                                    <div key={i} className="bg-white p-10 rounded-[3.5rem] border-2 border-slate-50 shadow-xl flex flex-col gap-6 animate-pulse">
                                        <div className="h-6 bg-slate-100 rounded-xl w-1/3" />
                                        <div className="h-8 bg-slate-200 rounded-2xl w-full" />
                                        <div className="h-8 bg-slate-100 rounded-2xl w-4/5" />
                                        <div className="mt-auto space-y-3">
                                            <div className="h-16 bg-slate-50 rounded-2xl w-full" />
                                            <div className="h-12 bg-rose-50 rounded-2xl w-full" />
                                        </div>
                                    </div>
                                ))
                            ) : Array.isArray(suggestions) && suggestions.map((s, i) => (
                                <div
                                    key={i}
                                    className="bg-white p-10 rounded-[3.5rem] border-2 border-slate-50 shadow-xl hover:shadow-indigo-100 hover:border-indigo-400 transition-all group cursor-pointer relative overflow-hidden flex flex-col"
                                    onClick={() => runInceptionResearch(s)}
                                >
                                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                                        <i className="fa-solid fa-microscope text-8xl"></i>
                                    </div>
                                    <div className="flex justify-between items-start mb-8 relative z-10">
                                        <div className="flex flex-col gap-2">
                                            <span className="bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase border border-indigo-100 w-fit">TRL {s.estimatedTrl}</span>
                                            {s.type && (
                                                <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase border w-fit ${s.type === 'frontier'
                                                    ? 'bg-violet-50 text-violet-600 border-violet-100'
                                                    : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                    }`}>
                                                    {s.type === 'frontier' ? '前沿探索' : '产业成型'}
                                                </span>
                                            )}
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                                            <i className="fa-solid fa-arrow-right"></i>
                                        </div>
                                    </div>
                                    <h4 className="text-xl font-black text-slate-900 leading-tight mb-6 italic uppercase group-hover:text-indigo-600 transition-colors relative z-10">{s.title}</h4>
                                    <div className="space-y-4 mt-auto relative z-10">
                                        <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 group-hover:bg-white transition-colors">
                                            <p className="text-[8px] font-black text-slate-400 uppercase mb-2 tracking-widest">演进轨迹</p>
                                            <p className="text-[10px] text-slate-600 font-bold leading-relaxed text-justify">{s.evolution}</p>
                                        </div>
                                        <div className="bg-rose-50/30 p-4 rounded-2xl border border-rose-100/50">
                                            <p className="text-[8px] font-black text-rose-400 uppercase mb-1">攻关痛点</p>
                                            <p className="text-[10px] text-rose-800 font-black italic leading-relaxed text-justify">" {s.painPoint} "</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {stage === 'research' && (
                    <div className="flex-1 flex flex-col gap-10 animate-reveal pb-20">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0">
                            <div className="lg:col-span-4 flex flex-col gap-6">
                                <div className="bg-slate-900 text-white p-12 rounded-[4rem] shadow-2xl relative overflow-hidden shrink-0 border border-white/5 h-full">
                                    <div className="absolute top-0 right-0 p-12 opacity-10">
                                        <i className="fa-solid fa-dna text-9xl"></i>
                                    </div>
                                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4rem] mb-6">Subject Blueprint</h4>
                                    <h3 className="text-3xl font-black italic uppercase leading-tight mb-10">{selectedTopic?.title}</h3>
                                    <div className="space-y-8">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <i className="fa-solid fa-flask-vial"></i> 科学假设
                                            </p>
                                            <div className="p-5 bg-white/5 rounded-3xl border border-white/10 italic text-sm font-medium text-slate-300 leading-relaxed text-justify">
                                                {selectedTopic?.hypothesis}
                                            </div>
                                        </div>
                                        <div className="pt-8 border-t border-white/10">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">预期学术贡献</p>
                                            <p className="text-[13px] font-black text-emerald-400 italic leading-relaxed text-justify">{selectedTopic?.impact}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-8 flex flex-col gap-6">
                                {landscape ? (
                                    <div className="space-y-6 animate-reveal">
                                        {hotnessData && <CompetitiveHeatmap data={hotnessData} />}

                                        <div className="bg-white p-12 rounded-[4rem] border-2 border-slate-100 shadow-2xl relative overflow-hidden">
                                            <div className="flex justify-between items-center mb-10">
                                                <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3rem] flex items-center gap-3">
                                                    <i className="fa-solid fa-satellite-dish animate-pulse"></i> 全球科研版图实时扫描
                                                </h4>
                                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Grounding Engine Active</span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-12">
                                                <div className="space-y-8">
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-4 tracking-widest flex items-center gap-2">
                                                            <i className="fa-solid fa-users-gear"></i> 活跃研究组 (Active Labs)
                                                        </p>
                                                        <div className="flex flex-col gap-3">
                                                            {landscape.activeLabs?.map((lab: any, i: number) => (
                                                                <div key={i} className="flex items-start justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-400 transition-all shadow-sm group/lab">
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-[11px] font-bold text-slate-800">{lab.name}</span>
                                                                        <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">PI: {lab.leader}</span>
                                                                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">{lab.contribution}</p>
                                                                    </div>
                                                                    {lab.sourceUrl && (
                                                                        <a href={lab.sourceUrl} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-colors shadow-sm shrink-0" title="查看来源">
                                                                            <i className="fa-solid fa-link text-[10px]"></i>
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-3 tracking-widest flex items-center gap-2">
                                                            <i className="fa-solid fa-industry"></i> 产业应用状态
                                                        </p>
                                                        <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 italic text-[11px] font-medium text-slate-600 leading-relaxed text-justify relative group/info">
                                                            {typeof landscape.commercialStatus === 'string' ? landscape.commercialStatus : landscape.commercialStatus?.content}
                                                            {typeof landscape.commercialStatus !== 'string' && (landscape.commercialStatus as any)?.sourceUrl && (
                                                                <a href={(landscape.commercialStatus as any).sourceUrl} target="_blank" rel="noreferrer" className="absolute top-3 right-3 text-indigo-400 hover:text-indigo-600 transition-colors bg-white shadow-sm p-1 rounded-md border border-indigo-50 flex items-center justify-center w-6 h-6" title="查看来源">
                                                                    <i className="fa-solid fa-square-arrow-up-right text-[10px]"></i>
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="space-y-8">
                                                    <div>
                                                        <p className="text-[9px] font-black text-rose-500 uppercase mb-4 tracking-widest flex items-center gap-2">
                                                            <i className="fa-solid fa-triangle-exclamation"></i> 专利/技术风险
                                                        </p>
                                                        <ul className="space-y-3">
                                                            {landscape.patentRisks?.map((risk: any, i: number) => (
                                                                <li key={i} className="text-[11px] font-bold text-slate-700 flex items-start gap-3 p-3 bg-rose-50/30 rounded-xl border border-rose-100 text-justify relative group/risk">
                                                                    <i className="fa-solid fa-shield-virus text-rose-400 mt-0.5 shrink-0"></i>
                                                                    <span className="flex-1">
                                                                        {typeof risk === 'string' ? risk : risk.description}
                                                                        {risk.sourceUrl && (
                                                                            <a href={risk.sourceUrl} target="_blank" rel="noreferrer" className="ml-2 text-indigo-400 hover:text-indigo-600" title="来源">
                                                                                <i className="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
                                                                            </a>
                                                                        )}
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-12 p-8 bg-indigo-50/50 rounded-[2.5rem] border-2 border-dashed border-indigo-200 relative group/gap">
                                                <div className="absolute top-4 right-6 text-indigo-400 flex gap-2">
                                                    <i className="fa-solid fa-lightbulb text-2xl opacity-20"></i>
                                                </div>
                                                <p className="text-[10px] font-black text-indigo-600 uppercase mb-4 tracking-widest">关键研究缺口 (Research Gaps)</p>
                                                <div className="space-y-4">
                                                    {landscape.researchGaps?.map((gap: any, i: number) => (
                                                        <div key={i} className="flex items-start gap-4 p-4 bg-white/60 rounded-2xl border border-indigo-100/50 hover:border-indigo-300 transition-all group/gap-item relative">
                                                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${gap.urgency === 'high' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : gap.urgency === 'low' ? 'bg-emerald-500' : 'bg-amber-500'}`} title={`Urgency: ${gap.urgency}`} />
                                                            <p className="text-[14px] font-bold text-slate-800 leading-relaxed italic flex-1">
                                                                “ {gap.content} ”
                                                                {gap.sourceUrl && (
                                                                    <a href={gap.sourceUrl} target="_blank" rel="noreferrer" className="ml-2 text-indigo-400 hover:text-indigo-600" title="来源">
                                                                        <i className="fa-solid fa-up-right-from-square text-[10px]"></i>
                                                                    </a>
                                                                )}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="mt-12 flex justify-end">
                                                <button onClick={runInceptionBlueprint} className="px-12 py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[12px] tracking-[0.3rem] shadow-xl hover:bg-indigo-600 transition-all hover:scale-[1.02] active:scale-95">
                                                    同步蓝图推演 <i className="fa-solid fa-wand-sparkles ml-3"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center py-40 gap-8">
                                        <div className="w-28 h-28 bg-white rounded-[2.5rem] flex items-center justify-center shadow-2xl animate-pulse border border-slate-100 relative">
                                            <i className="fa-solid fa-radar text-5xl text-indigo-600"></i>
                                            <div className="absolute inset-0 rounded-[2.5rem] border-2 border-indigo-500 animate-ping opacity-20"></div>
                                        </div>
                                        <div className="text-center space-y-4 max-w-md">
                                            <div className="space-y-1">
                                                <p className="text-lg font-black uppercase tracking-[0.6rem] text-slate-800 italic">全球深度扫射中</p>
                                                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden shadow-inner">
                                                    <div
                                                        className="bg-indigo-600 h-full transition-all duration-1000 ease-out"
                                                        style={{ width: `${((loadingStepIdx + 1) / LOADING_STEPS.length) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                            <div className="bg-indigo-50 border border-indigo-100 px-4 py-3 rounded-2xl shadow-sm animate-reveal" key={loadingStepIdx}>
                                                <p className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">{LOADING_STEPS[loadingStepIdx % LOADING_STEPS.length]}</p>
                                            </div>
                                            <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Cross-Referencing WOS, Patents & Global Trends...</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {stage === 'blueprint' && (
                    <div className="flex-1 flex flex-col gap-10 max-w-7xl mx-auto w-full animate-reveal pb-20">
                        {blueprint ? (
                            <div className="grid grid-cols-12 gap-8">
                                <div className="col-span-8 space-y-8">
                                    {/* 1. Research Phases */}
                                    <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-2xl relative overflow-hidden">
                                        <div className="flex justify-between items-center mb-10">
                                            <div className="flex flex-col">
                                                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.3rem] italic">
                                                    研究路线演进 (Synthetic Workflow)
                                                </h4>
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Optimization Engine Applied</span>
                                                </div>
                                            </div>
                                            <span className="text-[9px] font-bold text-indigo-600 px-4 py-2 bg-indigo-50 rounded-full border border-indigo-100">AI Planned: {blueprint.kpiDashboard?.totalDuration}</span>
                                        </div>
                                        <div className="space-y-6">
                                            {blueprint.researchPhases?.map((p: any, i: number) => (
                                                <div key={i} className="flex gap-8 p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 hover:bg-white hover:shadow-xl hover:border-indigo-100 transition-all group relative">
                                                    <div className="absolute top-6 right-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                                        <span className="text-6xl font-black italic">{p.phaseId}</span>
                                                    </div>
                                                    <div className={`w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-3xl shadow-sm shrink-0 group-hover:scale-110 transition-transform`}>
                                                        <i className={`fa-solid ${i === 0 ? 'fa-atom' : i === 1 ? 'fa-flask-vial' : i === 2 ? 'fa-eye' : 'fa-battery-full'}`}></i>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <p className="text-[16px] font-black text-slate-900 uppercase italic tracking-tight">{p.title}</p>
                                                            <span className="text-[9px] font-black text-slate-300 px-2 py-0.5 border border-slate-100 rounded-md bg-white">{p.duration}</span>
                                                        </div>
                                                        <p className="text-[12px] text-slate-500 font-medium italic mt-2 text-justify leading-relaxed">{p.objective}</p>

                                                        <div className="mt-6 grid grid-cols-2 gap-6">
                                                            <div className="space-y-3">
                                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest border-l-2 border-indigo-500 pl-2">Key Activities</p>
                                                                <ul className="space-y-2">
                                                                    {p.keyActivities?.map((act: any, idx: number) => (
                                                                        <li key={idx} className="text-[10px] text-slate-600 font-bold flex items-start gap-2">
                                                                            <i className="fa-solid fa-chevron-right text-[8px] mt-1 text-slate-300"></i>
                                                                            <span>{act.name}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                            <div className="space-y-3">
                                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest border-l-2 border-emerald-500 pl-2">Expected Outputs</p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {p.expectedOutputs?.map((out: any, idx: number) => (
                                                                        <span key={idx} className="px-2 py-0.5 bg-white border border-slate-100 rounded text-[9px] text-slate-500 font-black uppercase flex items-center gap-1">
                                                                            <i className={`fa-solid ${out.type === 'paper' ? 'fa-file-lines' : out.type === 'patent' ? 'fa-shield-halved' : 'fa-box-open'} text-[8px]`}></i>
                                                                            {out.type}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 2. Collaboration & Risk */}
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-xl overflow-hidden relative">
                                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                                <i className="fa-solid fa-users-viewfinder text-8xl"></i>
                                            </div>
                                            <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                                                <i className="fa-solid fa-handshake"></i> 合作链路规划
                                            </h4>
                                            <div className="space-y-6">
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 italic text-[11px] font-medium text-slate-600 leading-relaxed text-justify">
                                                    {blueprint.collaborationMap?.internalCollaboration}
                                                </div>
                                                <div className="space-y-3">
                                                    {blueprint.collaborationMap?.externalPartners?.map((p: any, i: number) => (
                                                        <div key={i} className="flex justify-between items-center bg-white border border-slate-50 p-4 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all">
                                                            <div>
                                                                <p className="text-[11px] font-bold text-slate-800">{p.name}</p>
                                                                <p className="text-[9px] font-black text-slate-400 uppercase">{p.type}</p>
                                                            </div>
                                                            <i className="fa-solid fa-link text-indigo-300 text-xs"></i>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-xl overflow-hidden relative">
                                            <div className="absolute top-0 right-0 p-8 opacity-5 text-rose-500">
                                                <i className="fa-solid fa-shield-virus text-8xl"></i>
                                            </div>
                                            <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                                <i className="fa-solid fa-triangle-exclamation"></i> 研究风险预警
                                            </h4>
                                            <div className="space-y-4">
                                                {blueprint.riskMatrix?.slice(0, 4).map((r: any, i: number) => (
                                                    <div key={i} className="p-4 bg-rose-50/30 rounded-2xl border border-rose-100/50 flex flex-col gap-2 relative">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[9px] font-black text-rose-600 uppercase tracking-tighter italic">{r.category}</span>
                                                            <div className="flex gap-1">
                                                                <span className={`w-2 h-2 rounded-full ${r.probability === 'high' ? 'bg-rose-500' : 'bg-amber-400'}`}></span>
                                                                <span className={`w-2 h-2 rounded-full ${r.impact === 'high' ? 'bg-rose-500' : 'bg-amber-400'}`}></span>
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] font-bold text-slate-700 leading-relaxed text-justify">{r.description}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-4 flex flex-col gap-8">
                                    {/* 3. KPI Dashboard */}
                                    <div className="bg-slate-900 text-white p-10 rounded-[4.5rem] shadow-2xl relative overflow-hidden flex-col border border-white/5">
                                        <div className="absolute top-0 right-0 p-8 opacity-5">
                                            <i className="fa-solid fa-chart-line text-9xl"></i>
                                        </div>
                                        <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-10 flex items-center gap-2 leading-none relative z-10">
                                            <i className="fa-solid fa-gauge-high"></i> 项目 KPI 定位仪
                                        </h4>

                                        <div className="grid grid-cols-2 gap-8 mb-10 relative z-10">
                                            <div className="text-center p-6 bg-white/5 rounded-[2.5rem] border border-white/10">
                                                <p className="text-[9px] font-black text-slate-500 uppercase mb-2">创新指数</p>
                                                <p className="text-4xl font-black italic text-indigo-400">{blueprint.kpiDashboard?.innovationScore}<span className="text-xs ml-1">%</span></p>
                                            </div>
                                            <div className="text-center p-6 bg-white/5 rounded-[2.5rem] border border-white/10">
                                                <p className="text-[9px] font-black text-slate-500 uppercase mb-2">可行性度</p>
                                                <p className="text-4xl font-black italic text-emerald-400">{blueprint.kpiDashboard?.feasibilityScore}<span className="text-xs ml-1">%</span></p>
                                            </div>
                                        </div>

                                        <div className="space-y-6 relative z-10">
                                            <div>
                                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                                                    <span>预计发表 (SCI/TOP)</span>
                                                    <span className="text-white">{blueprint.kpiDashboard?.publications?.topJournal + blueprint.kpiDashboard?.publications?.highImpact + blueprint.kpiDashboard?.publications?.general} 篇</span>
                                                </div>
                                                <div className="flex h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                                                    <div className="bg-indigo-500 h-full" style={{ width: '40%' }}></div>
                                                    <div className="bg-indigo-300 h-full" style={{ width: '30%' }}></div>
                                                    <div className="bg-slate-700 h-full" style={{ width: '30%' }}></div>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                                                    <span>专利布局</span>
                                                    <span className="text-white">{blueprint.kpiDashboard?.patents?.invention + blueprint.kpiDashboard?.patents?.utility} 项</span>
                                                </div>
                                                <div className="flex h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                                                    <div className="bg-emerald-500 h-full" style={{ width: '60%' }}></div>
                                                    <div className="bg-slate-700 h-full" style={{ width: '40%' }}></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-12 p-8 bg-indigo-500/10 rounded-[3rem] border border-indigo-500/20 text-center relative z-10">
                                            <p className="text-[11px] font-bold text-slate-300 italic leading-relaxed text-center">
                                                "{blueprint.kpiDashboard?.summary.substring(0, 120)}..."
                                            </p>
                                        </div>
                                    </div>

                                    {/* 4. Budget & Resources */}
                                    <div className="bg-white p-10 rounded-[4rem] border border-slate-100 shadow-xl flex-1 flex flex-col">
                                        <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
                                            <i className="fa-solid fa-coins text-amber-500"></i> 资源与经费概算
                                        </h4>
                                        <div className="flex-1 space-y-4">
                                            <div className="flex justify-between items-end p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Budget</span>
                                                    <span className="text-[18px] font-black text-slate-900 italic tracking-tighter">{blueprint.resourcePlan?.totalBudgetEstimate}</span>
                                                </div>
                                                <i className="fa-solid fa-piggy-bank text-slate-200 text-2xl"></i>
                                            </div>

                                            <div className="space-y-3">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">关键设备需求</p>
                                                {blueprint.resourcePlan?.equipment?.slice(0, 3).map((eq: any, i: number) => (
                                                    <div key={i} className="flex justify-between items-center bg-white border border-slate-50 p-3 rounded-xl">
                                                        <span className="text-[10px] font-bold text-slate-700">{eq.name}</span>
                                                        <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded ${eq.availability === 'Available' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                            {eq.availability}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="pt-4 mt-auto">
                                                <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest mb-3 leading-none">AI 推荐申请渠道</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {blueprint.resourcePlan?.fundingStrategy?.map((fund: string, i: number) => (
                                                        <span key={i} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black border border-indigo-100 transition-all hover:scale-105 cursor-default">{fund}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <button onClick={runInceptionReview} className="w-full py-8 bg-indigo-600 text-white rounded-[3.5rem] font-black uppercase text-lg tracking-[0.4rem] shadow-2xl shadow-indigo-500/30 hover:bg-black transition-all hover:scale-[1.02] active:scale-95 leading-none relative group">
                                        <span className="relative z-10 flex items-center justify-center gap-4">
                                            提交评审质询 <i className="fa-solid fa-gavel"></i>
                                        </span>
                                        <div className="absolute inset-x-4 inset-y-2 bg-white/10 rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center py-40 gap-8">
                                <div className="w-28 h-28 bg-white rounded-[2.5rem] flex items-center justify-center shadow-2xl animate-pulse border border-slate-100 relative">
                                    <i className="fa-solid fa-map-location-dot text-5xl text-indigo-600"></i>
                                    <div className="absolute inset-0 rounded-[2.5rem] border-2 border-indigo-500 animate-ping opacity-20"></div>
                                </div>
                                <div className="text-center space-y-6 max-w-md">
                                    <div className="space-y-1">
                                        <p className="text-lg font-black uppercase tracking-[0.6rem] text-slate-800 italic">合成全周期蓝图</p>
                                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden shadow-inner">
                                            <div
                                                className="bg-indigo-600 h-full transition-all duration-1000 ease-out"
                                                style={{ width: `${Math.min(95, ((loadingStepIdx + 1) / BLUEPRINT_LOADING_STEPS.length) * 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    <div className="bg-indigo-50 border border-indigo-100 px-6 py-4 rounded-3xl shadow-sm">
                                        <p className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">
                                            {isThinking
                                                ? BLUEPRINT_LOADING_STEPS[loadingStepIdx % BLUEPRINT_LOADING_STEPS.length]
                                                : "蓝图生成中断，请点击下方重试"}
                                        </p>
                                    </div>
                                    <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Projecting Research Trajectories & KPIs...</p>
                                    {!isThinking && (
                                        <button
                                            onClick={runInceptionBlueprint}
                                            className="mt-4 px-8 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg"
                                        >
                                            <i className="fa-solid fa-rotate-right"></i> 重新推演蓝图
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {stage === 'review' && (
                    <div className="flex-1 flex flex-col gap-8 max-w-7xl mx-auto w-full animate-reveal pb-20">
                        {/* Loading state for review generation */}
                        {isThinking && !review && (
                            <div className="flex-1 flex flex-col items-center justify-center py-40 gap-8">
                                <div className="w-28 h-28 bg-white rounded-[2.5rem] flex items-center justify-center shadow-2xl animate-pulse border border-slate-100 relative">
                                    <i className="fa-solid fa-gavel text-5xl text-indigo-600"></i>
                                    <div className="absolute inset-0 rounded-[2.5rem] border-2 border-indigo-500 animate-ping opacity-20"></div>
                                </div>
                                <div className="text-center space-y-6 max-w-md">
                                    <div className="space-y-1">
                                        <p className="text-lg font-black uppercase tracking-[0.6rem] text-slate-800 italic">虚拟委员会评审中</p>
                                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden shadow-inner">
                                            <div
                                                className="bg-indigo-600 h-full transition-all duration-1000 ease-out"
                                                style={{ width: `${Math.min(95, ((loadingStepIdx + 1) / REVIEW_LOADING_STEPS.length) * 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    <div className="bg-indigo-50 border border-indigo-100 px-6 py-4 rounded-3xl shadow-sm animate-reveal" key={loadingStepIdx}>
                                        <p className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">
                                            {REVIEW_LOADING_STEPS[loadingStepIdx % REVIEW_LOADING_STEPS.length]}
                                        </p>
                                    </div>
                                    <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Multi-Expert Deep Assessment in Progress...</p>
                                </div>
                            </div>
                        )}

                        {/* === Section 1: Expert Panel Cards === */}
                        {(!isThinking || review) && (<>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {(() => {
                                    const expertMeta = [
                                        { id: 'rigor', role: '严谨派专家', name: 'Dr. Rigor', icon: 'fa-scale-balanced', colorBg: 'bg-indigo-50', colorText: 'text-indigo-600', colorBorder: 'border-indigo-400', colorBadge: 'bg-indigo-600', gradFrom: 'from-indigo-500', gradTo: 'to-indigo-700' },
                                        { id: 'nova', role: '创新派专家', name: 'Dr. Nova', icon: 'fa-wand-magic-sparkles', colorBg: 'bg-amber-50', colorText: 'text-amber-600', colorBorder: 'border-amber-400', colorBadge: 'bg-amber-600', gradFrom: 'from-amber-500', gradTo: 'to-orange-600' },
                                        { id: 'forge', role: '工程派专家', name: 'Dr. Forge', icon: 'fa-hard-hat', colorBg: 'bg-emerald-50', colorText: 'text-emerald-600', colorBorder: 'border-emerald-400', colorBadge: 'bg-emerald-600', gradFrom: 'from-emerald-500', gradTo: 'to-teal-600' }
                                    ];
                                    const panels = review?.expertPanels || [];
                                    return expertMeta.map((meta, i) => {
                                        const panel = panels.find((p: any) => p.expertId === meta.id) || panels[i];
                                        const verdictMap: any = { approve: { label: '通过', cls: 'bg-emerald-500 text-white' }, conditional: { label: '有条件通过', cls: 'bg-amber-500 text-white' }, revise: { label: '需修改', cls: 'bg-orange-500 text-white' }, reject: { label: '不通过', cls: 'bg-rose-500 text-white' } };
                                        const vd = verdictMap[panel?.verdict] || verdictMap.conditional;
                                        return (
                                            <div key={i} className={`bg-white rounded-[2.5rem] border-2 border-slate-50 shadow-xl hover:shadow-2xl hover:${meta.colorBorder} transition-all relative overflow-hidden flex flex-col group`}>
                                                {/* Header */}
                                                <div className={`bg-gradient-to-r ${meta.gradFrom} ${meta.gradTo} p-6 pb-10 relative`}>
                                                    <div className="absolute top-0 right-0 p-4 opacity-10"><i className={`fa-solid ${meta.icon} text-6xl text-white`}></i></div>
                                                    <div className="flex items-center gap-3 relative z-10">
                                                        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center"><i className={`fa-solid ${meta.icon} text-white text-lg`}></i></div>
                                                        <div>
                                                            <p className="text-white font-black text-[13px] uppercase tracking-wider">{meta.role}</p>
                                                            <p className="text-white/70 font-bold text-[10px] uppercase tracking-widest">{meta.name}</p>
                                                        </div>
                                                    </div>
                                                    {panel && (
                                                        <div className="absolute -bottom-5 right-6 z-20 flex items-center gap-2">
                                                            <span className={`${vd.cls} px-4 py-1.5 rounded-xl text-[9px] font-black uppercase shadow-lg`}>{vd.label}</span>
                                                            <div className="w-12 h-12 rounded-2xl bg-white shadow-xl flex items-center justify-center">
                                                                <span className="text-lg font-black text-slate-900 italic">{panel.overallScore}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                {panel ? (
                                                    <div className="p-6 pt-8 flex flex-col gap-5 flex-1">
                                                        {/* Dimension Scores */}
                                                        <div className="space-y-3">
                                                            <p className="text-[8px] font-black uppercase tracking-[0.3rem] text-slate-400">评审维度</p>
                                                            {panel.dimensions?.map((d: any, di: number) => (
                                                                <div key={di} className="flex items-center gap-3">
                                                                    <span className="text-[10px] font-bold text-slate-600 w-24 shrink-0 truncate">{d.name}</span>
                                                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                        <div className={`h-full rounded-full bg-gradient-to-r ${meta.gradFrom} ${meta.gradTo} transition-all duration-1000`} style={{ width: `${d.score}%` }}></div>
                                                                    </div>
                                                                    <span className="text-[10px] font-black text-slate-700 w-8 text-right">{d.score}</span>
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {/* Strengths */}
                                                        <div>
                                                            <p className="text-[8px] font-black uppercase tracking-[0.3rem] text-emerald-500 mb-2 flex items-center gap-1"><i className="fa-solid fa-circle-check text-[7px]"></i> 优势</p>
                                                            <div className="space-y-1.5">
                                                                {panel.strengths?.map((s: string, si: number) => (
                                                                    <p key={si} className="text-[10px] text-slate-600 font-medium leading-relaxed pl-3 border-l-2 border-emerald-200 text-justify">{s}</p>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Weaknesses */}
                                                        <div>
                                                            <p className="text-[8px] font-black uppercase tracking-[0.3rem] text-rose-500 mb-2 flex items-center gap-1"><i className="fa-solid fa-triangle-exclamation text-[7px]"></i> 不足</p>
                                                            <div className="space-y-1.5">
                                                                {panel.weaknesses?.map((w: string, wi: number) => (
                                                                    <p key={wi} className="text-[10px] text-slate-600 font-medium leading-relaxed pl-3 border-l-2 border-rose-200 text-justify">{w}</p>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Critical Questions */}
                                                        <div>
                                                            <p className="text-[8px] font-black uppercase tracking-[0.3rem] text-slate-400 mb-2 flex items-center gap-1"><i className="fa-solid fa-comments text-[7px]"></i> 尖锐质询</p>
                                                            <div className="space-y-2">
                                                                {panel.criticalQuestions?.map((q: string, qi: number) => (
                                                                    <div key={qi} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                                        <p className="text-[10px] text-slate-700 font-bold italic leading-relaxed text-justify">" {q} "</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Suggestions */}
                                                        <div>
                                                            <p className="text-[8px] font-black uppercase tracking-[0.3rem] text-indigo-500 mb-2 flex items-center gap-1"><i className="fa-solid fa-lightbulb text-[7px]"></i> 改进建议</p>
                                                            <div className="space-y-1.5">
                                                                {panel.suggestions?.map((sg: string, si: number) => (
                                                                    <div key={si} className="flex items-start gap-2 p-2 bg-indigo-50/50 rounded-lg border border-indigo-100/50">
                                                                        <i className="fa-solid fa-arrow-right text-[8px] text-indigo-400 mt-1 shrink-0"></i>
                                                                        <p className="text-[10px] text-slate-700 font-medium leading-relaxed text-justify">{sg}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Detailed Review */}
                                                        <div className="mt-auto pt-4 border-t border-slate-100">
                                                            <p className="text-[8px] font-black uppercase tracking-[0.3rem] text-slate-400 mb-2">完整评审意见</p>
                                                            <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic text-justify">{panel.detailedReview}</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="p-6 pt-8 flex-1 flex flex-col items-center justify-center gap-4 py-20">
                                                        <div className="flex gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-slate-200 animate-bounce"></div>
                                                            <div className="w-2 h-2 rounded-full bg-slate-200 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                                            <div className="w-2 h-2 rounded-full bg-slate-200 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                                        </div>
                                                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{meta.role}评审中...</p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>

                            {/* === Section 2: Cross Examination Dialogue === */}
                            {review?.crossExamination && review.crossExamination.length > 0 && (
                                <div className="bg-white rounded-[3rem] border-2 border-slate-100 shadow-xl p-8 relative overflow-hidden animate-reveal">
                                    <div className="absolute top-0 right-0 p-6 opacity-[0.03]"><i className="fa-solid fa-comments text-9xl"></i></div>
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center"><i className="fa-solid fa-gavel text-white text-sm"></i></div>
                                        <div>
                                            <h4 className="text-[12px] font-black text-slate-800 uppercase tracking-[0.2rem]">多轮交叉质询实录</h4>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cross-Examination Transcript · {review.crossExamination.length} Rounds</p>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        {review.crossExamination.map((round: any, ri: number) => {
                                            const qMeta: any = { rigor: { color: 'indigo', icon: 'fa-scale-balanced' }, nova: { color: 'amber', icon: 'fa-wand-magic-sparkles' }, forge: { color: 'emerald', icon: 'fa-hard-hat' }, PI: { color: 'sky', icon: 'fa-user-tie' } };
                                            const qStyle = qMeta[round.questioner] || qMeta.PI;
                                            const rStyle = qMeta[round.responder] || qMeta.PI;
                                            return (
                                                <div key={ri} className="relative">
                                                    <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-100"></div>
                                                    {/* Round header */}
                                                    <div className="flex items-center gap-2 mb-4 relative z-10">
                                                        <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black shadow-lg">R{round.round}</div>
                                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">ROUND {round.round}</span>
                                                    </div>
                                                    {/* Question */}
                                                    <div className="ml-12 mb-3">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className={`w-7 h-7 rounded-lg bg-${qStyle.color}-50 flex items-center justify-center`}><i className={`fa-solid ${qStyle.icon} text-${qStyle.color}-600 text-[10px]`}></i></div>
                                                            <span className={`text-[10px] font-black text-${qStyle.color}-600 uppercase`}>{round.questionerName}</span>
                                                            <span className="text-[8px] font-bold text-slate-300 uppercase">质询</span>
                                                        </div>
                                                        <div className={`p-4 bg-${qStyle.color}-50/50 rounded-2xl border border-${qStyle.color}-100/50 ml-9`}>
                                                            <p className="text-[11px] text-slate-700 font-bold leading-relaxed italic text-justify">" {round.question} "</p>
                                                        </div>
                                                    </div>
                                                    {/* Response */}
                                                    <div className="ml-12 mb-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className={`w-7 h-7 rounded-lg bg-${rStyle.color}-50 flex items-center justify-center`}><i className={`fa-solid ${rStyle.icon} text-${rStyle.color}-600 text-[10px]`}></i></div>
                                                            <span className={`text-[10px] font-black text-${rStyle.color}-600 uppercase`}>{round.responderName}</span>
                                                            <span className="text-[8px] font-bold text-slate-300 uppercase">回应</span>
                                                        </div>
                                                        <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 ml-9">
                                                            <p className="text-[11px] text-slate-600 font-medium leading-relaxed text-justify">{round.response}</p>
                                                        </div>
                                                    </div>
                                                    {/* Follow-up */}
                                                    {round.followUp && (
                                                        <div className="ml-20 mt-2">
                                                            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100/50 flex items-start gap-2">
                                                                <i className="fa-solid fa-reply text-amber-400 text-[9px] mt-1 shrink-0"></i>
                                                                <p className="text-[10px] text-amber-800 font-bold italic leading-relaxed text-justify">{round.followUp}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* === Section 3: Overall Assessment Footer === */}
                            {review?.overallAssessment && (
                                <div className="bg-slate-900 rounded-[3.5rem] shadow-2xl relative overflow-hidden border border-white/5 animate-reveal">
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-emerald-500/5 pointer-events-none"></div>
                                    <div className="p-10 relative z-10">
                                        {/* Top row: Score + Decision */}
                                        <div className="flex flex-col md:flex-row items-start md:items-center gap-10 mb-10">
                                            <div className="text-center shrink-0">
                                                <p className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-[0.3rem]">综合立项指数 (AIPR)</p>
                                                <div className="relative inline-block">
                                                    <p className="text-7xl font-black text-white italic tracking-tighter drop-shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                                                        {review.overallAssessment.overallScore}
                                                    </p>
                                                    <span className="absolute -top-1 -right-5 text-indigo-400 font-black text-xl">%</span>
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-3 flex-wrap">
                                                    <span className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg flex items-center gap-2 ${review.overallAssessment.decision?.includes('强烈') ? 'bg-emerald-500 text-white' :
                                                        review.overallAssessment.decision?.includes('建议立项') ? 'bg-emerald-500/80 text-white' :
                                                            review.overallAssessment.decision?.includes('有条件') ? 'bg-amber-500 text-white' :
                                                                review.overallAssessment.decision?.includes('修改') ? 'bg-orange-500 text-white' :
                                                                    'bg-rose-500 text-white'
                                                        }`}>
                                                        <i className="fa-solid fa-gavel"></i> {review.overallAssessment.decision}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Multi-Agent Committee Verdict</span>
                                                </div>
                                                <p className="text-[14px] text-white/90 font-black italic leading-relaxed">
                                                    {review.overallAssessment.executiveBrief}
                                                </p>
                                            </div>
                                        </div>

                                        {/* 6-Dimension Radar Bar */}
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                                            {review.overallAssessment.scoreDimensions?.map((dim: any, di: number) => {
                                                const dimColor = dim.score >= 85 ? 'text-emerald-400' : dim.score >= 70 ? 'text-indigo-400' : dim.score >= 55 ? 'text-amber-400' : 'text-rose-400';
                                                const barColor = dim.score >= 85 ? 'bg-emerald-500' : dim.score >= 70 ? 'bg-indigo-500' : dim.score >= 55 ? 'bg-amber-500' : 'bg-rose-500';
                                                return (
                                                    <div key={di} className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center hover:bg-white/10 transition-colors">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-wider mb-2 leading-tight">{dim.name}</p>
                                                        <p className={`text-2xl font-black italic ${dimColor} mb-2`}>{dim.score}</p>
                                                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                                            <div className={`h-full ${barColor} rounded-full transition-all duration-1000`} style={{ width: `${dim.score}%` }}></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Decision Rationale */}
                                        <div className="p-6 bg-white/5 rounded-2xl border border-white/10 mb-6">
                                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2"><i className="fa-solid fa-clipboard-check"></i> 决策依据</p>
                                            <p className="text-[12px] text-slate-300 font-medium leading-relaxed text-justify">{review.overallAssessment.decisionRationale}</p>
                                        </div>

                                        {/* Conditional Requirements */}
                                        {review.overallAssessment.conditionalRequirements?.length > 0 && (
                                            <div className="p-6 bg-amber-500/10 rounded-2xl border border-amber-500/20 mb-6">
                                                <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2"><i className="fa-solid fa-clipboard-list"></i> 立项前置条件</p>
                                                <div className="space-y-2">
                                                    {review.overallAssessment.conditionalRequirements.map((req: string, ri: number) => (
                                                        <div key={ri} className="flex items-start gap-3">
                                                            <div className="w-5 h-5 rounded bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                                <span className="text-[9px] font-black text-amber-400">{ri + 1}</span>
                                                            </div>
                                                            <p className="text-[11px] text-amber-200/90 font-bold leading-relaxed text-justify">{req}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Summary */}
                                        <div className="p-6 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 mb-8">
                                            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2"><i className="fa-solid fa-scroll"></i> 综合评审总结</p>
                                            <p className="text-[12px] text-slate-300 font-medium leading-relaxed italic text-justify">{review.overallAssessment.summary}</p>
                                        </div>

                                        {/* CTA */}
                                        <div className="flex justify-end">
                                            <button
                                                onClick={handleFinalize}
                                                className="px-14 py-6 bg-indigo-600 text-white rounded-[2.5rem] font-black uppercase text-base tracking-[0.3rem] shadow-2xl shadow-indigo-500/30 hover:bg-emerald-600 hover:scale-[1.02] transition-all active:scale-95 relative overflow-hidden group"
                                            >
                                                <span className="relative z-10 flex items-center gap-3">正式开启项目课题 <i className="fa-solid fa-rocket"></i></span>
                                                <div className="absolute inset-x-3 inset-y-1.5 bg-white/15 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>)}
                    </div>
                )}
            </div>

            {showLibrary && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4 no-print">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[80vh]">
                        <h3 className="text-xl font-black text-slate-800 mb-6 uppercase italic border-l-4 border-indigo-600 pl-4">立项草稿库</h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                            {savedDrafts.map(d => (
                                <div key={d.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group hover:border-indigo-300 transition-all cursor-pointer" onClick={() => handleLoadDraft(d)}>
                                    <div className="flex-1">
                                        <p className="text-[11px] font-black text-slate-800 uppercase">{d.title}</p>
                                        <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">{d.timestamp} · {d.sessionData.stage.toUpperCase()}</p>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteDraft(d.id, e); }} className="w-8 h-8 rounded-lg bg-white text-rose-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                                </div>
                            ))}
                            {savedDrafts.length === 0 && <p className="text-center py-10 text-[10px] text-slate-400 italic">暂无保存的草稿</p>}
                        </div>
                        <button onClick={() => setShowLibrary(false)} className="mt-6 w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-slate-200">关闭</button>
                    </div>
                </div>
            )}

            <style>{`
                .animate-spin-slow { animation: spin 15s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes loading {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(0); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
};

export default InceptionView;
