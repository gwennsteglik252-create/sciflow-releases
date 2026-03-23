
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TrendItem, TrendCategory, MatrixReport, ResearchProject } from '../../types';
import { summarizeIndustryTrend, searchGlobalTrends, generateIndustryResearchReport } from '../../services/gemini';
import { useFileExport } from '../../hooks/useFileExport';
import { useProjectContext } from '../../context/ProjectContext';
import ReportView from '../Literature/ReportView';
import TrendCard from './TrendCard';
import RadarDashboard from './RadarDashboard';
import { getCategoryLabel } from './trendUtils';

const ALL_REPORT_DIMENSIONS = [
    '市场规模与增速',
    '核心商业品与技术规格',
    '制备工艺与生产流程',
    '生产成本与价格分析',
    '竞争格局与主要厂商',
    '政策法规与标准体系',
    '供应链与原料分析',
    '应用领域与下游市场',
    '技术路线图与创新前沿',
    '投资动向与融资事件',
    '风险与机会矩阵',
    '战略建议',
] as const;

const TODAY = new Date().toISOString().split('T')[0];

// Mock Data for Initial State
const MOCK_TRENDS: TrendItem[] = [
    {
        id: 't1',
        title: '欧盟碳边境调节机制 (CBAM) 正式试运行',
        category: 'Policy',
        content: '欧盟委员会宣布 CBAM 过渡期启动，涉及钢铁、水泥、铝、化肥、电力和氢气六大行业。要求进口商按季度报告碳排放量。该政策将显著增加高碳产品的出口成本，推动企业加速低碳转型。',
        impactScore: 5,
        source: 'EU Commission Press Release',
        url: 'https://commission.europa.eu/strategy-and-policy',
        timestamp: '2026-03-01',
        detectedAt: TODAY,
    },
    {
        id: 't2',
        title: '新型非贵金属 AEM 电解槽催化剂突破 2A/cm²',
        category: 'Technology',
        content: '某国际顶尖实验室开发了一种 Ni-Fe 层状双氢氧化物 (LDH) 纳米片阵列催化剂。在 60°C、1M KOH 条件下，其析氧反应 (OER) 电流密度达到 2000 mA/cm²，且能稳定运行超过 1000 小时。该技术有望大幅降低绿氢生产成本。',
        impactScore: 4,
        source: 'Nature Energy',
        url: 'https://www.nature.com/nenergy',
        timestamp: '2026-02-15',
        detectedAt: TODAY,
    }
];

const MAX_SEARCH_HISTORY = 8;

const TrendsRadar: React.FC = () => {
    const { showToast, projects, setAiStatus, activeTheme, startGlobalTask, activeTasks } = useProjectContext();
    const [trends, setTrends] = useState<TrendItem[]>(() => {
        const saved = localStorage.getItem('sciflow_industry_trends');
        return saved ? JSON.parse(saved) : MOCK_TRENDS;
    });
    const [activeCategory, setActiveCategory] = useState<TrendCategory | 'All'>('All');

    // 用于切换显示原文还是内参摘要
    const [showOriginalSet, setShowOriginalSet] = useState<Set<string>>(new Set());

    // Radar Filter & Context States
    const [radarSearch, setRadarSearch] = useState('');
    const [associatedProjectId, setAssociatedProjectId] = useState('');
    const [isGlobalSearching, setIsGlobalSearching] = useState(false);
    const [timeRange, setTimeRange] = useState<'1week' | '2weeks' | '1month' | '3months'>('2weeks');
    const [lastScanTime, setLastScanTime] = useState<string | null>(null);

    // Search History
    const [searchHistory, setSearchHistory] = useState<string[]>(() => {
        const saved = localStorage.getItem('sciflow_trends_search_history');
        return saved ? JSON.parse(saved) : [];
    });

    // View Mode: Radar vs Library vs Report
    const [viewMode, setViewMode] = useState<'radar' | 'library' | 'report'>('radar');

    // Local Trends Library State
    const [savedBulletins, setSavedBulletins] = useState<MatrixReport[]>(() => {
        const saved = localStorage.getItem('sciflow_trends_library');
        return saved ? JSON.parse(saved) : [];
    });
    const [activeBulletinId, setActiveBulletinId] = useState<string | null>(null);

    // ─── 调研报告面板状态 ───
    const [reportIndustry, setReportIndustry] = useState('');
    const [reportRegion, setReportRegion] = useState('全球');
    const [reportTimeRange, setReportTimeRange] = useState('近3年');
    const [reportDimensions, setReportDimensions] = useState<string[]>([
        '核心商业品与技术规格', '制备工艺与生产流程',
        '生产成本与价格分析', '供应链与原料分析', '竞争格局与主要厂商'
    ]);
    const [reportCustomContext, setReportCustomContext] = useState('');
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [liveReportContent, setLiveReportContent] = useState<string | null>(null);
    const [savedResearchReports, setSavedResearchReports] = useState<MatrixReport[]>(() => {
        const saved = localStorage.getItem('sciflow_research_reports');
        return saved ? JSON.parse(saved) : [];
    });
    const [activeResearchReportId, setActiveResearchReportId] = useState<string | null>(null);

    // Selection State — use ref to track initial load
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const isInitialSelectionDone = useRef(false);

    useEffect(() => {
        localStorage.setItem('sciflow_industry_trends', JSON.stringify(trends));
        // Only auto-select all on first load, not on every update
        if (!isInitialSelectionDone.current && trends.length > 0) {
            setSelectedIds(new Set(trends.map(t => t.id)));
            isInitialSelectionDone.current = true;
        }
    }, [trends]);

    useEffect(() => {
        localStorage.setItem('sciflow_trends_library', JSON.stringify(savedBulletins));
    }, [savedBulletins]);

    useEffect(() => {
        localStorage.setItem('sciflow_research_reports', JSON.stringify(savedResearchReports));
    }, [savedResearchReports]);

    useEffect(() => {
        localStorage.setItem('sciflow_trends_search_history', JSON.stringify(searchHistory));
    }, [searchHistory]);

    const addToSearchHistory = (query: string) => {
        setSearchHistory(prev => {
            const filtered = prev.filter(q => q !== query);
            return [query, ...filtered].slice(0, MAX_SEARCH_HISTORY);
        });
    };

    const handleManualSearch = async () => {
        if (!radarSearch.trim()) return;

        const searchQuery = radarSearch.trim();
        addToSearchHistory(searchQuery);
        setIsGlobalSearching(true);
        if (setAiStatus) setAiStatus('🔍 正在全网探测全球行业情报并执行语义归类...');

        await startGlobalTask(
            { id: `trend_search_${Date.now()}`, type: 'trend_analysis', status: 'running', title: `情报探测: ${searchQuery.substring(0, 10)}...` },
            async () => {
                try {
                    const result = await searchGlobalTrends(searchQuery, timeRange);
                    if (result.items && result.items.length > 0) {
                        const now = new Date().toISOString().split('T')[0];
                        const itemsWithDetectedAt = result.items.map((t: TrendItem) => ({
                            ...t,
                            detectedAt: now,
                        }));
                        setTrends(itemsWithDetectedAt);
                        setSelectedIds(new Set(itemsWithDetectedAt.map((t: TrendItem) => t.id)));
                        isInitialSelectionDone.current = true;
                        setLastScanTime(new Date().toLocaleString());
                        if (showToast) showToast({ message: `情报探测完成，已自动归类 ${result.items.length} 条动态`, type: 'success' });
                    } else {
                        if (showToast) showToast({ message: '未找到相关实时动态', type: 'info' });
                    }
                } catch (e) {
                    console.error("Global search failed", e);
                    if (showToast) showToast({ message: '搜索服务暂时不可用', type: 'error' });
                } finally {
                    setIsGlobalSearching(false);
                    if (setAiStatus) setAiStatus(null);
                }
            }
        );
    };

    const filteredTrends = activeCategory === 'All'
        ? trends
        : trends.filter(t => {
            const cat = t.category?.toLowerCase() || '';
            const active = activeCategory.toLowerCase();
            return cat === active || cat.includes(active);
        });

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleShowOriginal = (id: string) => {
        setShowOriginalSet(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAll = () => {
        setSelectedIds(new Set(filteredTrends.map(t => t.id)));
    };

    const handleDeselectAll = () => {
        setSelectedIds(new Set());
    };

    const selectedCount = useMemo(() =>
        filteredTrends.filter(t => selectedIds.has(t.id)).length
    , [filteredTrends, selectedIds]);

    const handleGenerateSummary = async (trend: TrendItem) => {
        if (trend.summary) return;

        await startGlobalTask(
            { id: `summary_${trend.id}`, type: 'trend_analysis', status: 'running', title: `生成内参摘要...` },
            async () => {
                try {
                    const summary = await summarizeIndustryTrend(trend.content, trend.category);
                    setTrends(prev => prev.map(t => t.id === trend.id ? { ...t, summary } : t));
                    if (showToast) showToast({ message: '内参摘要已生成', type: 'success' });
                } catch (e) {
                    if (showToast) showToast({ message: '摘要生成失败', type: 'error' });
                }
            }
        );
    };

    const handleDeleteLibraryItem = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSavedBulletins(prev => prev.filter(b => b.id !== id));
        if (activeBulletinId === id) setActiveBulletinId(null);
        showToast({ message: '存档已移除', type: 'info' });
    };

    const handleDeleteResearchReport = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSavedResearchReports(prev => prev.filter(r => r.id !== id));
        if (activeResearchReportId === id) { setActiveResearchReportId(null); setLiveReportContent(null); }
        showToast({ message: '调研报告已删除', type: 'info' });
    };

    const toggleReportDimension = (dim: string) => {
        setReportDimensions(prev =>
            prev.includes(dim) ? prev.filter(d => d !== dim) : [...prev, dim]
        );
    };

    const handleGenerateReport = async () => {
        if (!reportIndustry.trim()) {
            showToast({ message: '请先输入行业/产品关键词', type: 'error' });
            return;
        }
        if (reportDimensions.length === 0) {
            showToast({ message: '请至少选择一个研究维度', type: 'error' });
            return;
        }
        setIsGeneratingReport(true);
        setLiveReportContent(null);
        setActiveResearchReportId(null);
        if (setAiStatus) setAiStatus(`🔬 正在生成「${reportIndustry}」商业调研报告...`);

        await startGlobalTask(
            { id: `research_report_${Date.now()}`, type: 'trend_analysis', status: 'running', title: `调研报告: ${reportIndustry.substring(0, 12)}` },
            async () => {
                try {
                    const content = await generateIndustryResearchReport({
                        industry: reportIndustry,
                        region: reportRegion,
                        timeRange: reportTimeRange,
                        dimensions: reportDimensions,
                        customContext: reportCustomContext || undefined,
                    });
                    if (!content || content.trim().length < 100) {
                        throw new Error('AI 返回内容为空，请模型配置是否正确');
                    }
                    setLiveReportContent(content);

                    const dateStr = new Date().toISOString().slice(0, 10);
                    const newReport: MatrixReport = {
                        id: Date.now().toString(),
                        timestamp: new Date().toLocaleString(),
                        title: `${reportIndustry} 调研报告 · ${dateStr}`,
                        content,
                        type: '调研',
                        comparisonTable: { headers: [], rows: [] },
                        insights: [],
                        reportType: 'Weekly'
                    };
                    setSavedResearchReports(prev => [newReport, ...prev]);
                    setActiveResearchReportId(newReport.id);
                    showToast({ message: `「${reportIndustry}」调研报告已生成并归档`, type: 'success' });
                } catch (e) {
                    console.error('Report generation failed', e);
                    showToast({ message: '报告生成失败，请检查 AI 配置', type: 'error' });
                } finally {
                    setIsGeneratingReport(false);
                    if (setAiStatus) setAiStatus(null);
                }
            }
        );
    };

    const handleSaveToLibrary = () => {
        const trendsToSave = trends.filter(t => selectedIds.has(t.id));
        if (trendsToSave.length === 0) return;

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const title = `行业趋势内参_${dateStr}`;

        let markdownContent = `# ${title}\n\n`;
        trendsToSave.forEach(t => {
            markdownContent += `### 【${getCategoryLabel(t.category)}】${t.title}\n`;
            markdownContent += `**来源：** ${t.source} | **日期：** ${t.timestamp}\n\n`;
            markdownContent += `> ${t.summary || t.content}\n\n---\n\n`;
        });

        const newReport: MatrixReport = {
            id: Date.now().toString(),
            timestamp: new Date().toLocaleString(),
            title: title,
            content: markdownContent,
            type: '内参',
            comparisonTable: { headers: [], rows: [] },
            insights: [],
            reportType: 'Weekly'
        };

        setSavedBulletins(prev => [newReport, ...prev]);
        setActiveBulletinId(newReport.id);
        setViewMode('library');
        showToast({ message: `已将 ${trendsToSave.length} 条情报归档至本地文库`, type: 'success' });
    };

    return (
        <div className="h-full flex flex-col animate-reveal p-6 gap-5 bg-slate-50/50">
            <header className="flex flex-col gap-5 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="shrink-0 flex flex-col">
                        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic flex items-center gap-3">
                            <i className="fa-solid fa-tower-broadcast text-indigo-600"></i> 全球行业趋势雷达
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 pl-10">AI-DRIVEN MARKET INTELLIGENCE</p>
                    </div>

                    <div className="bg-slate-200/50 p-1 rounded-xl flex gap-1 shadow-inner shrink-0">
                        <button onClick={() => { setViewMode('radar'); setActiveBulletinId(null); }} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'radar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>实时雷达</button>
                        <button onClick={() => setViewMode('library')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${viewMode === 'library' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>分析文库</button>
                        <button onClick={() => setViewMode('report')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${viewMode === 'report' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                            <i className="fa-solid fa-file-contract text-[9px]"></i>调研报告
                        </button>
                    </div>
                </div>

                {viewMode !== 'report' && (
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex-1 flex items-center gap-3 bg-white/40 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-slate-300 shadow-sm focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100/50 transition-all min-w-[320px] relative">
                                <div className="flex items-center gap-2 text-slate-400 shrink-0">
                                    <select
                                        className="bg-transparent border-none outline-none text-[11px] font-black text-slate-800 uppercase italic w-44 cursor-pointer hover:text-indigo-600 transition-colors"
                                        value={associatedProjectId}
                                        onChange={(e) => setAssociatedProjectId(e.target.value)}
                                    >
                                        <option value="">关联研究课题...</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                    </select>
                                </div>
                                <div className="w-[1.5px] h-4 bg-slate-300/50 shrink-0"></div>
                                <div className="flex items-center gap-2 text-slate-400 shrink-0">
                                    <i className="fa-solid fa-calendar-day text-[10px]"></i>
                                    <select
                                        className="bg-transparent border-none outline-none text-[11px] font-black text-slate-800 uppercase italic w-28 cursor-pointer hover:text-indigo-600 transition-colors"
                                        value={timeRange}
                                        onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
                                    >
                                        <option value="1week">最近 1 周</option>
                                        <option value="2weeks">最近 2 周</option>
                                        <option value="1month">最近 1 个月</option>
                                        <option value="3months">最近 3 个月</option>
                                    </select>
                                </div>
                                <div className="w-[1.5px] h-4 bg-slate-300/50 shrink-0"></div>
                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                    <i className={`fa-solid ${isGlobalSearching ? 'fa-circle-notch animate-spin' : 'fa-magnifying-glass'} text-slate-300 text-[10px] shrink-0`}></i>
                                    <input
                                        className="flex-1 bg-transparent border-none outline-none text-[11px] font-bold text-slate-600 placeholder:text-slate-400 placeholder:italic min-w-[120px]"
                                        placeholder="输入技术关键词发起全球探测..."
                                        value={radarSearch}
                                        onChange={(e) => setRadarSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                                    />
                                </div>
                                <button
                                    onClick={handleManualSearch}
                                    disabled={isGlobalSearching || !radarSearch.trim()}
                                    className="bg-indigo-600 text-white px-5 py-1.5 rounded-xl text-[9px] font-black uppercase shadow-lg active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2 shrink-0"
                                >
                                    {isGlobalSearching ? <i className="fa-solid fa-circle-notch animate-spin"></i> : <i className="fa-solid fa-satellite-dish"></i>}
                                    同步探测
                                </button>
                            </div>

                            {viewMode === 'radar' && (
                                <div className="flex flex-wrap items-center gap-3 ml-auto">
                                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto shrink-0">
                                        {(['All', 'Technology', 'Market', 'Policy', 'Competitor'] as string[]).map(cat => (
                                            <button
                                                key={cat}
                                                onClick={() => setActiveCategory(cat as any)}
                                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                                            >
                                                {getCategoryLabel(cat)}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleSaveToLibrary}
                                        disabled={selectedIds.size === 0}
                                        className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap disabled:opacity-30"
                                    >
                                        <i className="fa-solid fa-file-export"></i> 归档选定情报
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Search History Pills */}
                        {viewMode === 'radar' && searchHistory.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider shrink-0">
                                    <i className="fa-solid fa-clock-rotate-left mr-1" />历史搜索
                                </span>
                                {searchHistory.map((q, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => { setRadarSearch(q); }}
                                        className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-all active:scale-95"
                                    >
                                        {q}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setSearchHistory([])}
                                    className="text-[8px] text-slate-300 hover:text-rose-500 transition-colors ml-1"
                                    title="清除历史"
                                >
                                    <i className="fa-solid fa-xmark" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </header>

            {viewMode === 'radar' ? (
                <div className="flex-1 flex flex-col min-h-0 gap-5">
                    {/* Radar Dashboard */}
                    <RadarDashboard trends={filteredTrends} lastScanTime={lastScanTime || undefined} />

                    {/* Select All / Deselect All Bar */}
                    <div className="flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-slate-500">
                                已选中 <span className="text-indigo-600">{selectedCount}</span> / {filteredTrends.length} 条
                            </span>
                            <button
                                onClick={handleSelectAll}
                                className="text-[9px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors underline underline-offset-2"
                            >
                                全选
                            </button>
                            <button
                                onClick={handleDeselectAll}
                                className="text-[9px] font-bold text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
                            >
                                反选
                            </button>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400">
                            {activeCategory !== 'All' && `筛选: ${getCategoryLabel(activeCategory)}`}
                        </span>
                    </div>

                    {/* Cards Grid */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 pb-20 content-start auto-rows-max">
                        {filteredTrends.length > 0 ? filteredTrends.map(trend => {
                            const isProcessingThis = activeTasks.some(t => t.id === `summary_${trend.id}` && t.status === 'running');
                            return (
                                <TrendCard
                                    key={trend.id}
                                    trend={trend}
                                    isSelected={selectedIds.has(trend.id)}
                                    isShowingOriginal={showOriginalSet.has(trend.id)}
                                    isProcessing={isProcessingThis}
                                    onToggleSelection={() => toggleSelection(trend.id)}
                                    onToggleOriginal={() => toggleShowOriginal(trend.id)}
                                    onGenerateSummary={() => handleGenerateSummary(trend)}
                                />
                            );
                        }) : (
                            <div className="col-span-full flex flex-col items-center justify-center py-24 gap-5 opacity-40">
                                <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center">
                                    <i className="fa-solid fa-satellite-dish text-slate-300 text-3xl" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3rem] mb-2">暂无情报数据</p>
                                    <p className="text-[11px] text-slate-400 max-w-xs">输入关键词并点击"同步探测"按钮，AI 将自动搜索并归类全球行业动态</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : viewMode === 'library' ? (
                <div className="flex-1 flex flex-row gap-6 min-h-0 overflow-hidden pb-4">
                    <div className="w-72 bg-white rounded-[2rem] border border-slate-200 p-4 flex flex-col gap-3 shrink-0">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">历史存档列表</h4>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                            {savedBulletins.map(rep => (
                                <div
                                    key={rep.id}
                                    onClick={() => setActiveBulletinId(rep.id)}
                                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col group relative ${activeBulletinId === rep.id ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 hover:border-indigo-200'}`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`text-[7px] font-black uppercase ${activeBulletinId === rep.id ? 'text-indigo-200' : 'text-slate-400'}`}>{rep.timestamp.split(' ')[0]}</span>
                                        <button onClick={(e) => handleDeleteLibraryItem(rep.id, e)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><i className="fa-solid fa-trash-can text-[9px]"></i></button>
                                    </div>
                                    <p className="text-[10px] font-black truncate uppercase italic">{rep.title}</p>
                                </div>
                            ))}
                            {savedBulletins.length === 0 && <p className="text-center py-10 text-[9px] text-slate-400 italic">暂无归档内参</p>}
                        </div>
                    </div>
                    <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col">
                        {activeBulletinId ? (
                            <ReportView report={savedBulletins.find(r => r.id === activeBulletinId)!} />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center opacity-20 text-slate-400 gap-4">
                                <i className="fa-solid fa-book-open text-6xl"></i>
                                <p className="text-sm font-black uppercase tracking-[0.4rem]">请选择一个内参文档查阅</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* ═══════════════ 调研报告面板 ═══════════════ */
                <div className="flex-1 flex flex-row gap-5 min-h-0 overflow-hidden pb-4">

                    {/* 左侧配置面板 */}
                    <div className="w-80 shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
                        {/* 行业关键词 */}
                        <div className="bg-white rounded-[1.5rem] border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-xl bg-violet-600 flex items-center justify-center">
                                    <i className="fa-solid fa-industry text-white text-[11px]"></i>
                                </div>
                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">研究对象</span>
                            </div>
                            <input
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-700 placeholder:text-slate-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all"
                                placeholder="例：固态电池电解质、碳纳米管..."
                                value={reportIndustry}
                                onChange={e => setReportIndustry(e.target.value)}
                            />
                            <p className="text-[9px] text-slate-400 mt-2 italic">支持材料名称、行业类别、具体产品</p>
                        </div>

                        {/* 范围配置 */}
                        <div className="bg-white rounded-[1.5rem] border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-xl bg-violet-600 flex items-center justify-center">
                                    <i className="fa-solid fa-sliders text-white text-[11px]"></i>
                                </div>
                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">研究范围</span>
                            </div>
                            <div className="flex flex-col gap-3">
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">地区</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-violet-400 transition-all cursor-pointer"
                                        value={reportRegion}
                                        onChange={e => setReportRegion(e.target.value)}
                                    >
                                        <option>全球</option>
                                        <option>中国</option>
                                        <option>欧美</option>
                                        <option>亚太（除中国）</option>
                                        <option>中国 + 欧美</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">时间跨度</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-violet-400 transition-all cursor-pointer"
                                        value={reportTimeRange}
                                        onChange={e => setReportTimeRange(e.target.value)}
                                    >
                                        <option>近1年</option>
                                        <option>近3年</option>
                                        <option>近5年</option>
                                        <option>近10年</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* 研究维度勾选 */}
                        <div className="bg-white rounded-[1.5rem] border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-xl bg-violet-600 flex items-center justify-center">
                                        <i className="fa-solid fa-list-check text-white text-[11px]"></i>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">报告维度</span>
                                </div>
                                <span className="text-[9px] font-black text-violet-500 bg-violet-50 px-2 py-1 rounded-lg">{reportDimensions.length}/{ALL_REPORT_DIMENSIONS.length}</span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {ALL_REPORT_DIMENSIONS.map(dim => (
                                    <label key={dim} className="flex items-center gap-2.5 cursor-pointer group px-2 py-1.5 rounded-xl hover:bg-violet-50 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={reportDimensions.includes(dim)}
                                            onChange={() => toggleReportDimension(dim)}
                                            className="w-3.5 h-3.5 accent-violet-600 rounded shrink-0"
                                        />
                                        <span className={`text-[10px] font-bold leading-tight transition-colors ${reportDimensions.includes(dim) ? 'text-slate-800' : 'text-slate-400'
                                            }`}>{dim}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* 补充背景 */}
                        <div className="bg-white rounded-[1.5rem] border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-xl bg-slate-400 flex items-center justify-center">
                                    <i className="fa-solid fa-comment-dots text-white text-[11px]"></i>
                                </div>
                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">补充背景（选填）</span>
                            </div>
                            <textarea
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-all resize-none"
                                rows={3}
                                placeholder="例：重点关注国产替代、或特定应用场景..."
                                value={reportCustomContext}
                                onChange={e => setReportCustomContext(e.target.value)}
                            />
                        </div>

                        {/* 生成按钮 */}
                        <button
                            onClick={handleGenerateReport}
                            disabled={isGeneratingReport || !reportIndustry.trim()}
                            className="w-full py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-3 shadow-lg disabled:opacity-40"
                            style={{ background: isGeneratingReport ? '#6d28d9' : 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white' }}
                        >
                            {isGeneratingReport ? (
                                <><i className="fa-solid fa-circle-notch animate-spin"></i>AI 正在生成报告...</>
                            ) : (
                                <><i className="fa-solid fa-wand-magic-sparkles"></i>生成专业调研报告</>
                            )}
                        </button>

                        {isGeneratingReport && (
                            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 animate-pulse">
                                <p className="text-[10px] font-black text-violet-600 mb-1">🔬 AI 正在深度分析中...</p>
                                <p className="text-[9px] text-violet-400">正在整合市场数据、工艺参数、价格体系，报告生成通常需要 30-90 秒</p>
                            </div>
                        )}
                    </div>

                    {/* 中央报告展示区 */}
                    <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col min-w-0">
                        {(liveReportContent || activeResearchReportId) ? (() => {
                            const activeContent = liveReportContent
                                || savedResearchReports.find(r => r.id === activeResearchReportId)?.content
                                || '';
                            const fakeReport: MatrixReport = {
                                id: activeResearchReportId || 'live',
                                timestamp: new Date().toLocaleString(),
                                title: reportIndustry ? `${reportIndustry} 专业调研报告` : '专业调研报告',
                                content: activeContent,
                                type: '调研',
                                comparisonTable: { headers: [], rows: [] },
                                insights: [],
                                reportType: 'Weekly'
                            };
                            return <ReportView report={fakeReport} />;
                        })() : (
                            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
                                <div className="w-24 h-24 rounded-full bg-violet-50 border-2 border-violet-100 flex items-center justify-center">
                                    <i className="fa-solid fa-file-contract text-violet-300 text-4xl"></i>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-black text-slate-300 uppercase tracking-[0.3rem] mb-2">等待生成报告</p>
                                    <p className="text-[11px] text-slate-400 max-w-xs">在左侧输入行业关键词并配置研究维度，点击生成按钮，AI 将生成包含技术规格、工艺流程、价格体系的专业商业调研报告</p>
                                </div>
                                {savedResearchReports.length > 0 && (
                                    <p className="text-[10px] text-violet-400 font-bold">← 或从右侧历史列表中选择已有报告查阅</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 右侧历史列表 */}
                    <div className="w-64 shrink-0 bg-white rounded-[2rem] border border-slate-200 p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2 px-1">
                            <i className="fa-solid fa-clock-rotate-left text-slate-400 text-[10px]"></i>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">历史调研报告</h4>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 min-h-0">
                            {savedResearchReports.map(rep => (
                                <div
                                    key={rep.id}
                                    onClick={() => { setActiveResearchReportId(rep.id); setLiveReportContent(null); }}
                                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col group relative ${activeResearchReportId === rep.id
                                        ? 'bg-violet-600 border-violet-600 text-white'
                                        : 'bg-white border-slate-100 hover:border-violet-200'
                                        }`}
                                >
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className={`text-[7px] font-black uppercase tracking-wider ${activeResearchReportId === rep.id ? 'text-violet-200' : 'text-slate-400'
                                            }`}>{rep.timestamp.split(' ')[0]}</span>
                                        <button
                                            onClick={(e) => handleDeleteResearchReport(rep.id, e)}
                                            className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <i className="fa-solid fa-trash-can text-[9px]"></i>
                                        </button>
                                    </div>
                                    <p className={`text-[10px] font-black leading-tight line-clamp-2 italic ${activeResearchReportId === rep.id ? 'text-white' : 'text-slate-700'
                                        }`}>{rep.title}</p>
                                    <div className={`mt-1.5 flex items-center gap-1 text-[8px] font-black uppercase ${activeResearchReportId === rep.id ? 'text-violet-200' : 'text-violet-400'
                                        }`}>
                                        <i className="fa-solid fa-file-contract text-[7px]"></i>
                                        调研报告
                                    </div>
                                </div>
                            ))}
                            {savedResearchReports.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-50">
                                    <i className="fa-solid fa-folder-open text-slate-300 text-3xl"></i>
                                    <p className="text-[9px] text-slate-400 text-center italic">暂无历史报告<br />生成后自动归档</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrendsRadar;
