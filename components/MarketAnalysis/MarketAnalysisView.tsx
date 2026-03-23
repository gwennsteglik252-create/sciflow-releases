
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MarketProduct, MarketComparison, MatrixReport, TechEvolutionData } from '../../types';
import { searchMarketProducts, generateProductComparison, generateMarketProductReport, analyzeProductTechnology, generateTechEvolution, generateRDRecommendation, generateRouteDeepDive } from '../../services/gemini/analysis';
import { useProjectContext } from '../../context/ProjectContext';
import { useFileExport } from '../../hooks/useFileExport';
import ReportView from '../Literature/ReportView';
import ScientificMarkdown from '../Common/ScientificMarkdown';
import { RDReportRenderer } from './RDReportRenderer';

// ═══ 报告维度 ═══
const ALL_REPORT_DIMENSIONS = [
    '产品技术规格对比',
    '制备工艺与成本',
    '市场份额与定价',
    '竞争优劣势分析',
    '应用场景与客户',
    '供应链与原料',
    '技术趋势与替代风险',
    '进入壁垒与建议',
] as const;

// ═══ 成熟度颜色 ═══
const maturityColors: Record<string, { bg: string; text: string }> = {
    Lab: { bg: 'bg-amber-100', text: 'text-amber-700' },
    Pilot: { bg: 'bg-blue-100', text: 'text-blue-700' },
    Mass: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

// ═══ ProductCard 组件 ═══
const ProductCard: React.FC<{
    product: MarketProduct;
    isSelected: boolean;
    onToggle: () => void;
    onAnalyzeTech?: () => void;
    isAnalyzingTech?: boolean;
    isLightMode?: boolean;
}> = ({ product, isSelected, onToggle, onAnalyzeTech, isAnalyzingTech, isLightMode = true }) => {
    const mc = maturityColors[product.maturityLevel || 'Lab'] || maturityColors.Lab;
    const [showTechProfile, setShowTechProfile] = useState(false);
    const tp = product.techProfile;
    const barrierColor = (tp?.techBarrierScore ?? 0) >= 70 ? '#ef4444' : (tp?.techBarrierScore ?? 0) >= 40 ? '#f59e0b' : '#22c55e';
    return (
        <div
            className={`p-5 rounded-2xl border-2 cursor-pointer transition-all group relative overflow-hidden ${isSelected
                ? 'border-teal-500 bg-teal-50/50 shadow-lg shadow-teal-500/10'
                : isLightMode ? 'border-slate-200 bg-white hover:border-teal-300 hover:shadow-md' : 'border-white/10 bg-white/5 hover:border-teal-500/50 hover:shadow-md'
                }`}
        >
            {/* 选择指示器 */}
            <div onClick={onToggle} className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-teal-500 border-teal-500' : 'border-slate-300'}`}>
                {isSelected && <i className="fa-solid fa-check text-white text-[8px]" />}
            </div>

            {/* 头部 */}
            <div className="flex items-start gap-3 mb-3" onClick={onToggle}>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-box-open text-white text-sm" />
                </div>
                <div className="flex-1 min-w-0 pr-5">
                    <h4 className={`text-[13px] font-black truncate leading-tight ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{product.name}</h4>
                    {product.nameEn && <p className="text-[9px] text-slate-400 font-bold truncate italic">{product.nameEn}</p>}
                </div>
            </div>

            {/* 厂商与标签 */}
            <div className="flex items-center gap-2 mb-3 flex-wrap" onClick={onToggle}>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${isLightMode ? 'text-slate-500 bg-slate-100' : 'text-slate-400 bg-white/10'}`}>
                    <i className="fa-solid fa-building mr-1" />{product.manufacturer}
                </span>
                {product.country && (
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${isLightMode ? 'text-slate-400 bg-slate-50' : 'text-slate-500 bg-white/5'}`}>{product.country}</span>
                )}
                {product.maturityLevel && (
                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg ${mc.bg} ${mc.text}`}>
                        {product.maturityLevel}
                    </span>
                )}
            </div>

            {/* 规格参数 */}
            <div className="space-y-1 mb-3" onClick={onToggle}>
                {product.specs.slice(0, 4).map((s, i) => (
                    <div key={i} className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-400 font-bold">{s.label}</span>
                        <span className={`font-black ${isLightMode ? 'text-slate-700' : 'text-white'}`}>{s.value}{s.unit ? ` ${s.unit}` : ''}</span>
                    </div>
                ))}
                {product.specs.length > 4 && (
                    <p className="text-[9px] text-slate-300 italic text-right">+{product.specs.length - 4} 更多参数</p>
                )}
            </div>

            {/* 价格 */}
            {product.price && (
                <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl p-2.5 border border-teal-100" onClick={onToggle}>
                    <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-teal-600 uppercase">参考价格</span>
                        <span className="text-[13px] font-black text-teal-700">
                            ¥{product.price.value.toLocaleString()} <span className="text-[9px] font-bold">/{product.price.unit.replace(/^[元¥$]+\//, '')}</span>
                        </span>
                    </div>
                    {product.price.note && <p className="text-[8px] text-teal-500 mt-1 italic">{product.price.note}</p>}
                </div>
            )}

            {/* 优劣势 */}
            {(product.advantages?.length || product.disadvantages?.length) && (
                <div className="mt-3 flex gap-2" onClick={onToggle}>
                    {product.advantages && product.advantages.length > 0 && (
                        <div className="flex-1">
                            {product.advantages.slice(0, 2).map((a, i) => (
                                <p key={i} className="text-[9px] text-emerald-600 font-bold flex items-start gap-1 mb-0.5">
                                    <i className="fa-solid fa-circle-check text-[7px] mt-[3px] shrink-0" />{a}
                                </p>
                            ))}
                        </div>
                    )}
                    {product.disadvantages && product.disadvantages.length > 0 && (
                        <div className="flex-1">
                            {product.disadvantages.slice(0, 2).map((d, i) => (
                                <p key={i} className="text-[9px] text-rose-500 font-bold flex items-start gap-1 mb-0.5">
                                    <i className="fa-solid fa-circle-xmark text-[7px] mt-[3px] shrink-0" />{d}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 市场份额 */}
            {product.marketShare != null && product.marketShare > 0 && (
                <div className="mt-3" onClick={onToggle}>
                    <div className="flex justify-between text-[9px] mb-1">
                        <span className="text-slate-400 font-bold">市场份额</span>
                        <span className={`font-black ${isLightMode ? 'text-slate-600' : 'text-white'}`}>{product.marketShare}%</span>
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${isLightMode ? 'bg-slate-100' : 'bg-white/10'}`}>
                        <div className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full transition-all duration-700" style={{ width: `${product.marketShare}%` }} />
                    </div>
                </div>
            )}

            {/* ═══ 技术档案状态指示 ═══ */}
            <div className="mt-3 pt-3 border-t border-dashed border-slate-200 flex items-center gap-2">
                {isAnalyzingTech ? (
                    <span className="flex-1 text-center py-1.5 text-[9px] font-black text-violet-400 flex items-center justify-center gap-1.5">
                        <i className="fa-solid fa-circle-notch animate-spin text-[8px]" />AI 分析中...
                    </span>
                ) : tp ? (
                    <span className="flex-1 text-center py-1.5 text-[9px] font-black text-emerald-600 flex items-center justify-center gap-1.5">
                        <i className="fa-solid fa-circle-check text-[8px]" />技术档案已分析
                        {tp.techBarrierScore != null && <span className="ml-1 px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 text-[8px]">壁垒 {tp.techBarrierScore}</span>}
                    </span>
                ) : (
                    <span className="flex-1 text-center py-1.5 text-[9px] font-bold text-slate-400">
                        <i className="fa-solid fa-flask-vial mr-1 text-[8px]" />待分析
                    </span>
                )}
            </div>
        </div>
    );
};

// ═══ ComparisonRadar 简易实现 ═══
const ComparisonRadar: React.FC<{
    radarData: { dimension: string; [key: string]: string | number }[];
    products: string[];
}> = ({ radarData, products }) => {
    const colors = ['#14b8a6', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];
    const cx = 200, cy = 200, radius = 150;
    const n = radarData.length;
    if (n < 3) return null;

    const getPoint = (dimIndex: number, value: number) => {
        const angle = (Math.PI * 2 * dimIndex) / n - Math.PI / 2;
        const r = (value / 100) * radius;
        return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    };

    return (
        <svg viewBox="0 0 400 400" className="w-full max-w-[360px] mx-auto">
            {/* 网格 */}
            {[20, 40, 60, 80, 100].map(level => (
                <polygon
                    key={level}
                    points={Array.from({ length: n }, (_, i) => {
                        const p = getPoint(i, level);
                        return `${p.x},${p.y}`;
                    }).join(' ')}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth={level === 100 ? 1.5 : 0.5}
                />
            ))}
            {/* 轴线 */}
            {radarData.map((_, i) => {
                const p = getPoint(i, 100);
                return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth={0.5} />;
            })}
            {/* 数据面 */}
            {products.map((pName, pIdx) => {
                const points = radarData.map((d, i) => {
                    const val = typeof d[pName] === 'number' ? (d[pName] as number) : 50;
                    return getPoint(i, val);
                });
                const pathStr = points.map(p => `${p.x},${p.y}`).join(' ');
                return (
                    <g key={pName}>
                        <polygon points={pathStr} fill={colors[pIdx % colors.length]} fillOpacity={0.15} stroke={colors[pIdx % colors.length]} strokeWidth={2} />
                        {points.map((p, i) => (
                            <circle key={i} cx={p.x} cy={p.y} r={3} fill={colors[pIdx % colors.length]} />
                        ))}
                    </g>
                );
            })}
            {/* 标签 */}
            {radarData.map((d, i) => {
                const p = getPoint(i, 118);
                return (
                    <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className="text-[10px] font-bold fill-slate-500">
                        {d.dimension}
                    </text>
                );
            })}
        </svg>
    );
};

// ═══ 主视图 ═══
const MarketAnalysisView: React.FC = () => {
    const { showToast, setAiStatus, startGlobalTask, activeTasks, activeTheme } = useProjectContext();
    const isLightMode = activeTheme?.type === 'light';

    // 散点图 Tooltip
    const [hoveredPoint, setHoveredPoint] = useState<{ id: string; x: number; y: number; name: string; xVal: number; yVal: number } | null>(null);

    // 搜索状态
    const [searchQuery, setSearchQuery] = useState('');
    const [searchRegion, setSearchRegion] = useState('全球');
    const [isSearching, setIsSearching] = useState(false);
    const [products, setProducts] = useState<MarketProduct[]>(() => {
        const saved = localStorage.getItem('sciflow_market_products');
        return saved ? JSON.parse(saved) : [];
    });
    const [marketOverview, setMarketOverview] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // 技术档案分析状态
    const [analyzingTechIds, setAnalyzingTechIds] = useState<Set<string>>(new Set());

    // 对比状态
    const [comparisonData, setComparisonData] = useState<{
        dimensions: string[];
        radarData: { dimension: string; [key: string]: string | number }[];
        summary: string;
    } | null>(null);
    const [isComparing, setIsComparing] = useState(false);

    // 报告状态
    const [reportDimensions, setReportDimensions] = useState<string[]>([
        '产品技术规格对比', '制备工艺与成本', '市场份额与定价', '竞争优劣势分析'
    ]);
    const [reportCustomContext, setReportCustomContext] = useState('');
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [liveReportContent, setLiveReportContent] = useState<string | null>(null);
    const [savedReports, setSavedReports] = useState<MatrixReport[]>(() => {
        const saved = localStorage.getItem('sciflow_market_reports');
        return saved ? JSON.parse(saved) : [];
    });
    const [activeReportId, setActiveReportId] = useState<string | null>(null);

    // 视图模式
    const [viewMode, setViewMode] = useState<'search' | 'compare' | 'position' | 'cost' | 'report' | 'tech' | 'evolution' | 'rdAdvice' | 'routeDive'>('search');

    // 技术路线演化状态
    const [evolutionData, setEvolutionData] = useState<TechEvolutionData | null>(() => {
        const saved = localStorage.getItem('sciflow_market_tech_evolution');
        return saved ? JSON.parse(saved) : null;
    });
    const [isGeneratingEvolution, setIsGeneratingEvolution] = useState(false);
    const [hoveredMilestone, setHoveredMilestone] = useState<string | null>(null);

    // 研发战略建议状态
    const [rdAdviceContent, setRdAdviceContent] = useState<string>(() => {
        return localStorage.getItem('sciflow_market_rd_advice') || '';
    });
    const [isGeneratingRD, setIsGeneratingRD] = useState(false);

    // 路线深度分析状态
    const [routeDiveContent, setRouteDiveContent] = useState<string>(() => {
        return localStorage.getItem('sciflow_market_route_dive') || '';
    });
    const [routeDiveRouteName, setRouteDiveRouteName] = useState(() => {
        return localStorage.getItem('sciflow_market_route_dive_name') || '';
    });
    const [isGeneratingRouteDive, setIsGeneratingRouteDive] = useState(false);

    // 导出
    const { handleSecureSave } = useFileExport();

    // 散点图轴选择
    const [scatterXAxis, setScatterXAxis] = useState('价格');
    const [scatterYAxis, setScatterYAxis] = useState('');

    // 成本计算器
    const [costInputs, setCostInputs] = useState<{ label: string; value: number; unit: string }[]>([
        { label: '原材料成本', value: 0, unit: '元/kg' },
        { label: '能耗成本', value: 0, unit: '元/kg' },
        { label: '人工成本', value: 0, unit: '元/kg' },
        { label: '设备折旧', value: 0, unit: '元/kg' },
        { label: '品控检测', value: 0, unit: '元/kg' },
    ]);
    const [costScale, setCostScale] = useState(1);  // 产能倍数
    const costTotal = useMemo(() => costInputs.reduce((s, c) => s + c.value, 0), [costInputs]);
    const costScaled = useMemo(() => costTotal / Math.pow(costScale, 0.15), [costTotal, costScale]); // 规模效应

    // 课题关联
    const [linkedProjectName, setLinkedProjectName] = useState<string>(() => {
        return localStorage.getItem('sciflow_market_linked_project') || '';
    });

    // 搜索历史
    const [searchHistory, setSearchHistory] = useState<string[]>(() => {
        const saved = localStorage.getItem('sciflow_market_search_history');
        return saved ? JSON.parse(saved) : [];
    });

    // Persist
    useEffect(() => { localStorage.setItem('sciflow_market_products', JSON.stringify(products)); }, [products]);
    useEffect(() => { localStorage.setItem('sciflow_market_reports', JSON.stringify(savedReports)); }, [savedReports]);
    useEffect(() => { localStorage.setItem('sciflow_market_search_history', JSON.stringify(searchHistory)); }, [searchHistory]);
    useEffect(() => { if (linkedProjectName) localStorage.setItem('sciflow_market_linked_project', linkedProjectName); }, [linkedProjectName]);
    useEffect(() => { if (evolutionData) localStorage.setItem('sciflow_market_tech_evolution', JSON.stringify(evolutionData)); }, [evolutionData]);
    useEffect(() => { if (rdAdviceContent) localStorage.setItem('sciflow_market_rd_advice', rdAdviceContent); }, [rdAdviceContent]);
    useEffect(() => { if (routeDiveContent) localStorage.setItem('sciflow_market_route_dive', routeDiveContent); }, [routeDiveContent]);
    useEffect(() => { if (routeDiveRouteName) localStorage.setItem('sciflow_market_route_dive_name', routeDiveRouteName); }, [routeDiveRouteName]);

    // ═══ 存档管理 ═══
    const [showArchivePanel, setShowArchivePanel] = useState(false);
    const [archiveList, setArchiveList] = useState<{ id: string; name: string; query: string; productCount: number; savedAt: string }[]>(() => {
        const saved = localStorage.getItem('sciflow_market_archives_index');
        return saved ? JSON.parse(saved) : [];
    });
    useEffect(() => { localStorage.setItem('sciflow_market_archives_index', JSON.stringify(archiveList)); }, [archiveList]);

    const saveCurrentArchive = useCallback(() => {
        if (products.length === 0) { showToast({ message: '没有可保存的分析数据', type: 'error' }); return; }
        const archiveId = `archive_${Date.now()}`;
        const archiveName = searchQuery || products[0]?.category || products[0]?.name || '未命名分析';
        const snapshot = {
            products,
            searchQuery,
            searchRegion,
            savedReports,
            evolutionData,
            rdAdviceContent,
            comparisonData,
            marketOverview,
            linkedProjectName,
            routeDiveContent,
            routeDiveRouteName,
        };
        localStorage.setItem(`sciflow_market_archive_${archiveId}`, JSON.stringify(snapshot));
        setArchiveList(prev => [{ id: archiveId, name: archiveName, query: searchQuery, productCount: products.length, savedAt: new Date().toISOString() }, ...prev]);
        showToast({ message: `已保存存档：${archiveName}`, type: 'success' });
    }, [products, searchQuery, searchRegion, savedReports, evolutionData, rdAdviceContent, comparisonData, marketOverview, linkedProjectName, showToast]);

    const loadArchive = useCallback((archiveId: string) => {
        const raw = localStorage.getItem(`sciflow_market_archive_${archiveId}`);
        if (!raw) { showToast({ message: '存档数据不存在', type: 'error' }); return; }
        const snap = JSON.parse(raw);
        setProducts(snap.products || []);
        setSearchQuery(snap.searchQuery || '');
        setSearchRegion(snap.searchRegion || '全球');
        setSavedReports(snap.savedReports || []);
        setEvolutionData(snap.evolutionData || null);
        setRdAdviceContent(snap.rdAdviceContent || '');
        setComparisonData(snap.comparisonData || null);
        setMarketOverview(snap.marketOverview || '');
        setLinkedProjectName(snap.linkedProjectName || '');
        setRouteDiveContent(snap.routeDiveContent || '');
        setRouteDiveRouteName(snap.routeDiveRouteName || '');
        setSelectedIds(new Set());
        setViewMode('search');
        setShowArchivePanel(false);
        showToast({ message: '存档已加载', type: 'success' });
    }, [showToast]);

    const deleteArchive = useCallback((archiveId: string) => {
        localStorage.removeItem(`sciflow_market_archive_${archiveId}`);
        setArchiveList(prev => prev.filter(a => a.id !== archiveId));
        showToast({ message: '存档已删除', type: 'info' });
    }, [showToast]);

    const startNewAnalysis = useCallback(() => {
        if (products.length > 0 && !window.confirm('当前分析数据将被清空，是否先保存存档？')) return;
        setProducts([]);
        setSearchQuery('');
        setMarketOverview('');
        setSelectedIds(new Set());
        setComparisonData(null);
        setSavedReports([]);
        setEvolutionData(null);
        setRdAdviceContent('');
        setRouteDiveContent('');
        setRouteDiveRouteName('');
        setLinkedProjectName('');
        setViewMode('search');
        localStorage.removeItem('sciflow_market_products');
        localStorage.removeItem('sciflow_market_reports');
        localStorage.removeItem('sciflow_market_tech_evolution');
        localStorage.removeItem('sciflow_market_rd_advice');
        localStorage.removeItem('sciflow_market_route_dive');
        localStorage.removeItem('sciflow_market_route_dive_name');
        showToast({ message: '已新建分析', type: 'info' });
    }, [products.length, showToast]);

    const selectedProducts = useMemo(() => products.filter(p => selectedIds.has(p.id)), [products, selectedIds]);

    // ─── 搜索竞品 ───
    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        const q = searchQuery.trim();
        setSearchHistory(prev => [q, ...prev.filter(x => x !== q)].slice(0, 8));
        setIsSearching(true);
        if (setAiStatus) setAiStatus('🔍 正在搜索市场竞品产品...');

        await startGlobalTask(
            { id: `market_search_${Date.now()}`, type: 'trend_analysis', status: 'running', title: `竞品搜索: ${q.substring(0, 12)}` },
            async () => {
                try {
                    const result = await searchMarketProducts(q, { region: searchRegion });
                    if (result.products?.length > 0) {
                        const now = new Date().toISOString().split('T')[0];
                        const withDate = result.products.map((p: MarketProduct) => ({ ...p, detectedAt: now }));
                        setProducts(withDate);
                        setSelectedIds(new Set(withDate.map((p: MarketProduct) => p.id)));
                        setMarketOverview(result.marketOverview || '');
                        showToast({ message: `已找到 ${result.products.length} 款竞品产品`, type: 'success' });
                    } else {
                        showToast({ message: '未找到相关竞品信息', type: 'info' });
                    }
                } catch (e) {
                    console.error('Market search failed', e);
                    showToast({ message: '搜索失败，请检查 AI 配置', type: 'error' });
                } finally {
                    setIsSearching(false);
                    if (setAiStatus) setAiStatus(null);
                }
            }
        );
    };

    // ─── 生成对比分析 ───
    const handleCompare = async () => {
        if (selectedProducts.length < 2) {
            showToast({ message: '请至少选择 2 款产品进行对比', type: 'error' });
            return;
        }
        setIsComparing(true);
        setViewMode('compare');
        if (setAiStatus) setAiStatus('📊 正在生成竞品对比分析...');

        await startGlobalTask(
            { id: `market_compare_${Date.now()}`, type: 'trend_analysis', status: 'running', title: '竞品对比分析' },
            async () => {
                try {
                    const result = await generateProductComparison(
                        selectedProducts.map(p => ({ name: p.name, specs: p.specs }))
                    );
                    setComparisonData(result);
                    showToast({ message: '对比分析已生成', type: 'success' });
                } catch (e) {
                    console.error('Comparison failed', e);
                    showToast({ message: '对比生成失败', type: 'error' });
                } finally {
                    setIsComparing(false);
                    if (setAiStatus) setAiStatus(null);
                }
            }
        );
    };

    // ─── 生成报告 ───
    const handleGenerateReport = async () => {
        if (!searchQuery.trim() && products.length === 0) {
            showToast({ message: '请先搜索竞品或输入产品名称', type: 'error' });
            return;
        }
        if (reportDimensions.length === 0) {
            showToast({ message: '请至少选择一个分析维度', type: 'error' });
            return;
        }
        setIsGeneratingReport(true);
        setLiveReportContent(null);
        setActiveReportId(null);
        if (setAiStatus) setAiStatus(`🔬 正在生成「${searchQuery || products[0]?.name}」市场分析报告...`);

        await startGlobalTask(
            { id: `market_report_${Date.now()}`, type: 'trend_analysis', status: 'running', title: `市场报告: ${(searchQuery || products[0]?.name || '').substring(0, 12)}` },
            async () => {
                try {
                    const content = await generateMarketProductReport({
                        product: searchQuery || products[0]?.name || '',
                        region: searchRegion,
                        competitors: selectedProducts.map(p => p.name),
                        focusDimensions: reportDimensions,
                        customContext: reportCustomContext || undefined,
                    });
                    if (!content || content.trim().length < 100) throw new Error('AI 返回内容不足');
                    setLiveReportContent(content);

                    const dateStr = new Date().toISOString().slice(0, 10);
                    const newReport: MatrixReport = {
                        id: Date.now().toString(),
                        timestamp: new Date().toLocaleString(),
                        title: `${searchQuery || products[0]?.name} 市场分析 · ${dateStr}`,
                        content,
                        type: '市场分析',
                        comparisonTable: { headers: [], rows: [] },
                        insights: [],
                        reportType: 'Weekly'
                    };
                    setSavedReports(prev => [newReport, ...prev]);
                    setActiveReportId(newReport.id);
                    showToast({ message: '市场分析报告已生成', type: 'success' });
                } catch (e) {
                    console.error('Report generation failed', e);
                    showToast({ message: '报告生成失败', type: 'error' });
                } finally {
                    setIsGeneratingReport(false);
                    if (setAiStatus) setAiStatus(null);
                }
            }
        );
    };

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedIds(next);
    };

    const toggleDimension = (dim: string) => {
        setReportDimensions(prev => prev.includes(dim) ? prev.filter(d => d !== dim) : [...prev, dim]);
    };

    const handleDeleteReport = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSavedReports(prev => prev.filter(r => r.id !== id));
        if (activeReportId === id) { setActiveReportId(null); setLiveReportContent(null); }
        showToast({ message: '报告已删除', type: 'info' });
    };

    return (
        <div className={`h-full flex flex-col animate-reveal p-6 gap-5 ${isLightMode ? 'bg-slate-50/50' : 'bg-transparent'}`}>
            {/* Header */}
            <header className="flex flex-col gap-5 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="shrink-0 flex flex-col">
                        <h2 className={`text-2xl font-black uppercase tracking-tighter italic flex items-center gap-3 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                            <i className="fa-solid fa-chart-pie text-teal-600" /> 市场产品分析
                        </h2>
                        <p className={`text-[10px] font-bold uppercase tracking-widest mt-1.5 pl-10 ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>AI-POWERED COMPETITIVE INTELLIGENCE</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <div className="bg-slate-200/50 p-1 rounded-xl flex gap-1 shadow-inner">
                            <button onClick={() => setViewMode('search')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${viewMode === 'search' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                <i className="fa-solid fa-magnifying-glass text-[9px]" />竞品雷达
                            </button>
                            <button onClick={() => setViewMode('compare')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${viewMode === 'compare' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                <i className="fa-solid fa-table-columns text-[9px]" />对比矩阵
                            </button>
                            <button onClick={() => setViewMode('position')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${viewMode === 'position' ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                <i className="fa-solid fa-crosshairs text-[9px]" />市场定位
                            </button>
                            <button onClick={() => setViewMode('cost')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${viewMode === 'cost' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                <i className="fa-solid fa-calculator text-[9px]" />成本分析
                            </button>
                            <button onClick={() => setViewMode('tech')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${viewMode === 'tech' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                <i className="fa-solid fa-flask-vial text-[9px]" />技术档案
                            </button>
                            <button onClick={() => setViewMode('evolution')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${viewMode === 'evolution' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                <i className="fa-solid fa-timeline text-[9px]" />技术演化
                            </button>
                            <button onClick={() => setViewMode('rdAdvice')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${viewMode === 'rdAdvice' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                <i className="fa-solid fa-lightbulb text-[9px]" />研发建议
                            </button>
                            <button onClick={() => setViewMode('routeDive')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${viewMode === 'routeDive' ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                <i className="fa-solid fa-microscope text-[9px]" />路线深析
                            </button>
                            <button onClick={() => setViewMode('report')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${viewMode === 'report' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                <i className="fa-solid fa-file-lines text-[9px]" />分析报告
                            </button>
                        </div>
                        {/* 存档操作 */}
                        <div className="flex items-center gap-2">
                            {products.length > 0 && (
                                <>
                                    <button
                                        onClick={() => {
                                            const csv = ['产品名称,厂商,国家,技术路线,价格,成熟度', ...products.map(p =>
                                                `"${p.name}","${p.manufacturer}","${p.country || ''}","${p.techRoute || ''}","${p.price ? p.price.value + ' ' + p.price.unit : ''}","${p.maturityLevel || ''}"`
                                            )].join('\n');
                                            handleSecureSave(`竞品数据_${new Date().toISOString().slice(0,10)}.csv`, new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
                                        }}
                                        className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 transition-all active:scale-95" title="导出 CSV"
                                    >
                                        <i className="fa-solid fa-file-csv text-[11px]" />
                                    </button>
                                    <button
                                        onClick={saveCurrentArchive}
                                        className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition-all active:scale-95" title="保存当前分析"
                                    >
                                        <i className="fa-solid fa-floppy-disk text-[11px]" />
                                    </button>
                                    <input
                                        className="w-32 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[9px] font-bold text-slate-600 placeholder:text-slate-400 outline-none focus:border-teal-400 transition-all"
                                        placeholder="关联课题名称..."
                                        value={linkedProjectName}
                                        onChange={e => setLinkedProjectName(e.target.value)}
                                        title="将竞品分析绑定到指定课题"
                                    />
                                </>
                            )}
                            <div className="relative">
                                <button
                                    onClick={() => setShowArchivePanel(!showArchivePanel)}
                                    className={`p-2 rounded-lg border transition-all active:scale-95 ${showArchivePanel ? 'bg-amber-50 border-amber-300 text-amber-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`} title="存档管理"
                                >
                                    <i className="fa-solid fa-box-archive text-[11px]" />
                                    {archiveList.length > 0 && (
                                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[7px] font-black flex items-center justify-center">{archiveList.length}</span>
                                    )}
                                </button>
                                {showArchivePanel && (
                                    <div className={`absolute right-0 top-full mt-2 w-80 rounded-2xl border shadow-2xl z-50 max-h-96 flex flex-col ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600'}`}>
                                        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                                <i className="fa-solid fa-box-archive text-amber-500" />存档列表 ({archiveList.length})
                                            </span>
                                            <button onClick={startNewAnalysis} className="px-3 py-1 rounded-lg bg-teal-50 text-teal-600 text-[9px] font-black hover:bg-teal-100 transition-all flex items-center gap-1">
                                                <i className="fa-solid fa-plus text-[7px]" />新建分析
                                            </button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                                            {archiveList.length === 0 ? (
                                                <div className="p-6 text-center">
                                                    <i className="fa-solid fa-box-open text-slate-300 text-2xl mb-2" />
                                                    <p className="text-[10px] text-slate-400 font-bold">还没有保存的存档</p>
                                                    <p className="text-[8px] text-slate-300 mt-1">完成分析后点击 💾 按钮保存</p>
                                                </div>
                                            ) : archiveList.map(archive => (
                                                <div key={archive.id} className={`p-3 border-b last:border-0 hover:bg-slate-50 transition-colors group ${isLightMode ? 'border-slate-100' : 'border-slate-700 hover:bg-slate-700/50'}`}>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => loadArchive(archive.id)}>
                                                            <p className={`text-[11px] font-black truncate ${isLightMode ? 'text-slate-700' : 'text-white'}`}>{archive.name}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[8px] text-slate-400 font-bold">{archive.productCount} 款产品</span>
                                                                <span className="text-[8px] text-slate-300">{new Date(archive.savedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => loadArchive(archive.id)} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 text-[9px]" title="加载">
                                                                <i className="fa-solid fa-folder-open" />
                                                            </button>
                                                            <button onClick={() => deleteArchive(archive.id)} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-50 text-[9px]" title="删除">
                                                                <i className="fa-solid fa-trash" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 搜索栏 — 仅在搜索和对比视图显示 */}
                {(viewMode === 'search' || viewMode === 'compare') && (
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex-1 flex items-center gap-3 bg-white/40 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-slate-300 shadow-sm focus-within:border-teal-400 focus-within:ring-4 focus-within:ring-teal-100/50 transition-all min-w-[320px]">
                                <div className="flex items-center gap-2 text-slate-400 shrink-0">
                                    <select
                                        className="bg-transparent border-none outline-none text-[11px] font-black text-slate-800 uppercase italic w-24 cursor-pointer hover:text-teal-600 transition-colors"
                                        value={searchRegion}
                                        onChange={(e) => setSearchRegion(e.target.value)}
                                    >
                                        <option>全球</option>
                                        <option>中国</option>
                                        <option>欧美</option>
                                        <option>亚太</option>
                                    </select>
                                </div>
                                <div className="w-[1.5px] h-4 bg-slate-300/50 shrink-0" />
                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                    <i className={`fa-solid ${isSearching ? 'fa-circle-notch animate-spin' : 'fa-magnifying-glass'} text-slate-300 text-[10px] shrink-0`} />
                                    <input
                                        className="flex-1 bg-transparent border-none outline-none text-[11px] font-bold text-slate-600 placeholder:text-slate-400 placeholder:italic min-w-[160px]"
                                        placeholder="输入材料/产品名称搜索市场竞品..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    />
                                </div>
                                <button
                                    onClick={handleSearch}
                                    disabled={isSearching || !searchQuery.trim()}
                                    className="bg-teal-600 text-white px-5 py-1.5 rounded-xl text-[9px] font-black uppercase shadow-lg active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2 shrink-0"
                                >
                                    {isSearching ? <i className="fa-solid fa-circle-notch animate-spin" /> : <i className="fa-solid fa-radar" />}
                                    搜索竞品
                                </button>
                            </div>

                            {viewMode === 'search' && selectedIds.size >= 2 && (
                                <button
                                    onClick={handleCompare}
                                    disabled={isComparing}
                                    className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-violet-700 transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap disabled:opacity-30"
                                >
                                    <i className="fa-solid fa-scale-balanced" /> 对比选定 ({selectedIds.size})
                                </button>
                            )}
                        </div>

                        {/* 搜索历史 */}
                        {searchHistory.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider shrink-0">
                                    <i className="fa-solid fa-clock-rotate-left mr-1" />历史
                                </span>
                                {searchHistory.map((q, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSearchQuery(q)}
                                        className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-bold text-slate-500 hover:text-teal-600 hover:border-teal-300 transition-all active:scale-95"
                                    >
                                        {q}
                                    </button>
                                ))}
                                <button onClick={() => setSearchHistory([])} className="text-[8px] text-slate-300 hover:text-rose-500 transition-colors ml-1" title="清除历史">
                                    <i className="fa-solid fa-xmark" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </header>

            {/* ═══════════════ 竞品雷达视图 ═══════════════ */}
            {viewMode === 'search' && (
                <div className="flex-1 flex flex-col min-h-0 gap-4">
                    {/* 市场概览 */}
                    {marketOverview && (
                        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-2xl p-4 shrink-0">
                            <p className="text-[10px] font-black text-teal-700 uppercase tracking-wider mb-1"><i className="fa-solid fa-chart-line mr-1.5" />市场概览</p>
                            <p className="text-[11px] text-teal-800 font-medium leading-relaxed">{marketOverview}</p>
                        </div>
                    )}

                    {/* 选择控制栏 */}
                    {products.length > 0 && (
                        <div className="flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-slate-500">
                                    已选中 <span className="text-teal-600">{selectedIds.size}</span> / {products.length} 款
                                </span>
                                <button onClick={() => setSelectedIds(new Set(products.map(p => p.id)))} className="text-[9px] font-bold text-teal-500 hover:text-teal-700 transition-colors underline underline-offset-2">全选</button>
                                <button onClick={() => setSelectedIds(new Set())} className="text-[9px] font-bold text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2">清空</button>
                            </div>
                        </div>
                    )}

                    {/* 产品卡片（按技术路线分组） */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar pb-20 space-y-6">
                        {products.length > 0 ? (() => {
                            const groups: Record<string, typeof products> = {};
                            products.forEach(p => {
                                const key = p.category || '其他';
                                if (!groups[key]) groups[key] = [];
                                groups[key].push(p);
                            });
                            const groupEntries = Object.entries(groups);
                            return groupEntries.map(([route, groupProducts]) => (
                                <div key={route}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-teal-500 to-emerald-500" />
                                        <h3 className={`text-[11px] font-black uppercase tracking-wider ${isLightMode ? 'text-slate-700' : 'text-white'}`}>{route}</h3>
                                        <span className="text-[8px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{groupProducts.length} 款</span>
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5 content-start auto-rows-max">
                                        {groupProducts.map(product => (
                                            <ProductCard
                                                key={product.id}
                                                product={product}
                                                isSelected={selectedIds.has(product.id)}
                                                onToggle={() => toggleSelection(product.id)}
                                                isLightMode={isLightMode}
                                                isAnalyzingTech={analyzingTechIds.has(product.id)}
                                                onAnalyzeTech={async () => {
                                                    setAnalyzingTechIds(prev => new Set(prev).add(product.id));
                                                    try {
                                                        const techData = await analyzeProductTechnology({
                                                            name: product.name,
                                                            manufacturer: product.manufacturer,
                                                            techRoute: product.techRoute,
                                                            category: product.category,
                                                        });
                                                        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, techProfile: { ...techData, analyzedAt: new Date().toISOString() } } : p));
                                                        showToast({ message: `「${product.name}」技术档案分析完成`, type: 'success' });
                                                    } catch (err) {
                                                        showToast({ message: '技术档案分析失败', type: 'error' });
                                                    } finally {
                                                        setAnalyzingTechIds(prev => { const n = new Set(prev); n.delete(product.id); return n; });
                                                    }
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ));
                        })() : (
                            <div className="flex flex-col items-center justify-center py-24 gap-5 opacity-40">
                                <div className="w-20 h-20 rounded-full bg-teal-50 border-2 border-teal-200 flex items-center justify-center">
                                    <i className="fa-solid fa-chart-pie text-teal-300 text-3xl" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3rem] mb-2">开始竞品分析</p>
                                    <p className="text-[11px] text-slate-400 max-w-xs">输入材料或产品名称，AI 将自动搜索市场上的竞品产品并展示详细信息</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════ 对比矩阵视图 ═══════════════ */}
            {viewMode === 'compare' && (
                <div className="flex-1 flex flex-col min-h-0 gap-5 overflow-auto custom-scrollbar pb-10">
                    {isComparing ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="bg-violet-50 border border-violet-200 rounded-2xl p-8 animate-pulse text-center">
                                <i className="fa-solid fa-circle-notch animate-spin text-violet-500 text-2xl mb-3" />
                                <p className="text-[11px] font-black text-violet-600">AI 正在分析产品差异...</p>
                            </div>
                        </div>
                    ) : comparisonData ? (
                        <>
                            {/* 雷达图 */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <i className="fa-solid fa-diagram-project text-violet-500" />多维度雷达对比
                                </h3>
                                <div className="flex items-center justify-center gap-8">
                                    <ComparisonRadar radarData={comparisonData.radarData} products={selectedProducts.map(p => p.name)} />
                                    <div className="flex flex-col gap-2">
                                        {selectedProducts.map((p, i) => (
                                            <div key={p.id} className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ['#14b8a6', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6'][i % 5] }} />
                                                <span className="text-[10px] font-black text-slate-600">{p.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* 对比表格 */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-x-auto">
                                <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <i className="fa-solid fa-table text-violet-500" />指标对比表
                                </h3>
                                <table className="w-full text-[11px]">
                                    <thead>
                                        <tr className="border-b border-slate-200">
                                            <th className="text-left py-2 px-3 font-black text-slate-500 uppercase text-[9px]">维度</th>
                                            {selectedProducts.map(p => (
                                                <th key={p.id} className="text-center py-2 px-3 font-black text-slate-700">{p.name}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {comparisonData.radarData.map((row, i) => (
                                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                                <td className="py-2.5 px-3 font-bold text-slate-500">{row.dimension}</td>
                                                {selectedProducts.map(p => {
                                                    const val = typeof row[p.name] === 'number' ? (row[p.name] as number) : 0;
                                                    return (
                                                        <td key={p.id} className="text-center py-2.5 px-3">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                    <div className="h-full bg-gradient-to-r from-violet-400 to-teal-400 rounded-full" style={{ width: `${val}%` }} />
                                                                </div>
                                                                <span className="font-black text-slate-700 w-8">{val}</span>
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* ═══ 技术细节对比矩阵 ═══ */}
                            <div className={`rounded-2xl border p-6 shadow-sm overflow-x-auto ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                                <h3 className={`text-[11px] font-black uppercase tracking-wider mb-4 flex items-center gap-2 ${isLightMode ? 'text-slate-700' : 'text-white'}`}>
                                    <i className="fa-solid fa-flask-vial text-violet-500" />技术细节对比
                                </h3>
                                <table className="w-full text-[10px]">
                                    <thead>
                                        <tr className={`border-b ${isLightMode ? 'border-slate-200' : 'border-white/10'}`}>
                                            <th className={`text-left py-2 px-3 font-black uppercase text-[9px] ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>维度</th>
                                            {selectedProducts.map(p => (
                                                <th key={p.id} className={`text-center py-2 px-3 font-black ${isLightMode ? 'text-slate-700' : 'text-white'}`}>{p.name}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* 制备方法 */}
                                        <tr className={`border-b ${isLightMode ? 'border-slate-50' : 'border-white/5'}`}>
                                            <td className={`py-2.5 px-3 font-bold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}><i className="fa-solid fa-route mr-1.5 text-cyan-500" />制备方法</td>
                                            {selectedProducts.map(p => (
                                                <td key={p.id} className={`text-center py-2.5 px-3 font-bold ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>{p.techRoute || '—'}</td>
                                            ))}
                                        </tr>
                                        {/* 关键前驱体 */}
                                        <tr className={`border-b ${isLightMode ? 'border-slate-50' : 'border-white/5'}`}>
                                            <td className={`py-2.5 px-3 font-bold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}><i className="fa-solid fa-flask mr-1.5 text-orange-500" />关键前驱体</td>
                                            {selectedProducts.map(p => (
                                                <td key={p.id} className={`text-center py-2.5 px-3 ${isLightMode ? 'text-slate-700' : 'text-slate-300'}`}>
                                                    {p.techProfile?.precursors?.length ? (
                                                        <div className="flex flex-wrap gap-1 justify-center">{p.techProfile.precursors.map((pr, i) => <span key={i} className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 text-[8px] font-bold">{pr}</span>)}</div>
                                                    ) : '—'}
                                                </td>
                                            ))}
                                        </tr>
                                        {/* 反应温度 */}
                                        <tr className={`border-b ${isLightMode ? 'border-slate-50' : 'border-white/5'}`}>
                                            <td className={`py-2.5 px-3 font-bold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}><i className="fa-solid fa-temperature-high mr-1.5 text-rose-500" />反应温度</td>
                                            {selectedProducts.map(p => (
                                                <td key={p.id} className={`text-center py-2.5 px-3 font-black ${isLightMode ? 'text-slate-700' : 'text-white'}`}>{p.techProfile?.sinteringTemp || '—'}</td>
                                            ))}
                                        </tr>
                                        {/* 核心专利数 */}
                                        <tr className={`border-b ${isLightMode ? 'border-slate-50' : 'border-white/5'}`}>
                                            <td className={`py-2.5 px-3 font-bold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}><i className="fa-solid fa-certificate mr-1.5 text-violet-500" />核心专利数</td>
                                            {selectedProducts.map(p => (
                                                <td key={p.id} className={`text-center py-2.5 px-3 font-black ${isLightMode ? 'text-slate-700' : 'text-white'}`}>{p.techProfile?.patents?.length ?? '—'}</td>
                                            ))}
                                        </tr>
                                        {/* 技术壁垒 */}
                                        <tr className={`border-b ${isLightMode ? 'border-slate-50' : 'border-white/5'}`}>
                                            <td className={`py-2.5 px-3 font-bold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}><i className="fa-solid fa-shield-halved mr-1.5 text-red-500" />技术壁垒</td>
                                            {selectedProducts.map(p => {
                                                const score = p.techProfile?.techBarrierScore;
                                                const color = score != null ? (score >= 70 ? 'text-rose-600' : score >= 40 ? 'text-amber-600' : 'text-emerald-600') : '';
                                                return (
                                                    <td key={p.id} className={`text-center py-2.5 px-3 font-black ${color || (isLightMode ? 'text-slate-700' : 'text-white')}`}>
                                                        {score != null ? `${score}/100` : '—'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                        {/* 可替代性 */}
                                        <tr>
                                            <td className={`py-2.5 px-3 font-bold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}><i className="fa-solid fa-arrows-rotate mr-1.5 text-emerald-500" />可替代性</td>
                                            {selectedProducts.map(p => {
                                                const sub = p.techProfile?.substitutability;
                                                const label = sub === 'low' ? '低' : sub === 'medium' ? '中' : sub === 'high' ? '高' : '—';
                                                const cls = sub === 'low' ? 'bg-rose-50 text-rose-600' : sub === 'medium' ? 'bg-amber-50 text-amber-600' : sub === 'high' ? 'bg-emerald-50 text-emerald-600' : '';
                                                return (
                                                    <td key={p.id} className="text-center py-2.5 px-3">
                                                        {sub ? <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${cls}`}>{label}</span> : '—'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    </tbody>
                                </table>
                                {!selectedProducts.some(p => p.techProfile) && (
                                    <p className="text-[10px] text-slate-400 italic text-center mt-4">
                                        <i className="fa-solid fa-info-circle mr-1" />请先在产品卡片上点击「技术档案分析」按钮获取技术数据
                                    </p>
                                )}
                            </div>

                            {/* 总结 */}
                            {comparisonData.summary && (
                                <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-5">
                                    <p className="text-[10px] font-black text-violet-700 uppercase tracking-wider mb-2"><i className="fa-solid fa-lightbulb mr-1.5" />AI 对比总结</p>
                                    <p className="text-[11px] text-violet-800 font-medium leading-relaxed whitespace-pre-line">{comparisonData.summary}</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-5 opacity-40">
                            <div className="w-20 h-20 rounded-full bg-violet-50 border-2 border-violet-200 flex items-center justify-center">
                                <i className="fa-solid fa-scale-balanced text-violet-300 text-3xl" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3rem] mb-2">选择产品进行对比</p>
                                <p className="text-[11px] text-slate-400 max-w-xs">在竞品雷达视图中选择至少 2 款产品，然后点击"对比选定"按钮</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════ 市场定位散点图视图 ═══════════════ */}
            {viewMode === 'position' && (
                <div className="flex-1 flex flex-col min-h-0 gap-5 overflow-auto custom-scrollbar pb-10">
                    {products.length >= 2 ? (() => {
                        // 收集所有可用的数值维度
                        const allSpecLabels = Array.from(new Set(products.flatMap(p => p.specs.map(s => s.label))));
                        const numericLabels = allSpecLabels.filter(label =>
                            products.some(p => {
                                const spec = p.specs.find(s => s.label === label);
                                return spec && !isNaN(parseFloat(spec.value));
                            })
                        );
                        const axisOptions = ['价格', ...numericLabels];
                        const xAxis = scatterXAxis || axisOptions[0] || '价格';
                        const yAxis = scatterYAxis || axisOptions[1] || axisOptions[0] || '价格';

                        const getValue = (p: MarketProduct, axis: string): number => {
                            if (axis === '价格') return p.price?.value || 0;
                            const spec = p.specs.find(s => s.label === axis);
                            return spec ? parseFloat(spec.value) || 0 : 0;
                        };

                        const points = products.map(p => ({
                            product: p,
                            x: getValue(p, xAxis),
                            y: getValue(p, yAxis),
                            selected: selectedIds.has(p.id),
                        })).filter(pt => pt.x > 0 || pt.y > 0);

                        const xMin = Math.min(...points.map(p => p.x)) * 0.8;
                        const xMax = Math.max(...points.map(p => p.x)) * 1.2;
                        const yMin = Math.min(...points.map(p => p.y)) * 0.8;
                        const yMax = Math.max(...points.map(p => p.y)) * 1.2;
                        const xRange = xMax - xMin || 1;
                        const yRange = yMax - yMin || 1;
                        const W = 700, H = 400, pad = 60;

                        const toSvg = (x: number, y: number) => ({
                            sx: pad + ((x - xMin) / xRange) * (W - 2 * pad),
                            sy: (H - pad) - ((y - yMin) / yRange) * (H - 2 * pad),
                        });

                        const colors = ['#14b8a6', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#06b6d4', '#84cc16'];

                        return (
                            <>
                                {/* 轴选择器 */}
                                <div className={`rounded-2xl border p-5 shadow-sm flex items-center gap-6 flex-wrap ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[9px] font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>X 轴</span>
                                        <select value={xAxis} onChange={e => setScatterXAxis(e.target.value)} className={`border rounded-lg px-3 py-1.5 text-[11px] font-bold outline-none cursor-pointer ${isLightMode ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-white/10 border-white/10 text-white'}`}>
                                            {axisOptions.map(opt => <option key={opt}>{opt}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[9px] font-black uppercase ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>Y 轴</span>
                                        <select value={yAxis} onChange={e => setScatterYAxis(e.target.value)} className={`border rounded-lg px-3 py-1.5 text-[11px] font-bold outline-none cursor-pointer ${isLightMode ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-white/10 border-white/10 text-white'}`}>
                                            {axisOptions.map(opt => <option key={opt}>{opt}</option>)}
                                        </select>
                                    </div>
                                    <div className="ml-auto text-[9px] text-slate-400 font-bold italic">
                                        <i className="fa-solid fa-circle-info mr-1" />选择不同的 X/Y 轴指标，发现市场空白区域
                                    </div>
                                </div>

                                {/* 散点图 SVG */}
                                <div className={`rounded-2xl border p-6 shadow-sm relative ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                                    <h3 className={`text-[11px] font-black uppercase tracking-wider mb-4 flex items-center gap-2 ${isLightMode ? 'text-slate-700' : 'text-white'}`}>
                                        <i className="fa-solid fa-crosshairs text-cyan-500" />市场定位图 — {xAxis} vs {yAxis}
                                    </h3>
                                    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[800px] mx-auto" onMouseLeave={() => setHoveredPoint(null)}>
                                        {/* 网格 */}
                                        {[0.25, 0.5, 0.75].map(frac => (
                                            <React.Fragment key={frac}>
                                                <line x1={pad} y1={pad + frac * (H - 2 * pad)} x2={W - pad} y2={pad + frac * (H - 2 * pad)} stroke={isLightMode ? '#f1f5f9' : '#334155'} strokeWidth={1} />
                                                <line x1={pad + frac * (W - 2 * pad)} y1={pad} x2={pad + frac * (W - 2 * pad)} y2={H - pad} stroke={isLightMode ? '#f1f5f9' : '#334155'} strokeWidth={1} />
                                            </React.Fragment>
                                        ))}
                                        {/* 象限标注 */}
                                        <text x={pad + 8} y={pad + 16} className={`text-[9px] font-bold ${isLightMode ? 'fill-slate-300' : 'fill-slate-600'}`}>高{yAxis} · 低{xAxis}</text>
                                        <text x={W - pad - 8} y={pad + 16} textAnchor="end" className={`text-[9px] font-bold ${isLightMode ? 'fill-slate-300' : 'fill-slate-600'}`}>高{yAxis} · 高{xAxis}</text>
                                        <text x={pad + 8} y={H - pad - 8} className={`text-[9px] font-bold ${isLightMode ? 'fill-slate-300' : 'fill-slate-600'}`}>低{yAxis} · 低{xAxis}</text>
                                        <text x={W - pad - 8} y={H - pad - 8} textAnchor="end" className={`text-[9px] font-bold ${isLightMode ? 'fill-slate-300' : 'fill-slate-600'}`}>低{yAxis} · 高{xAxis}</text>
                                        {/* 中分线 */}
                                        <line x1={W / 2} y1={pad} x2={W / 2} y2={H - pad} stroke={isLightMode ? '#e2e8f0' : '#475569'} strokeWidth={1} strokeDasharray="6 4" />
                                        <line x1={pad} y1={H / 2} x2={W - pad} y2={H / 2} stroke={isLightMode ? '#e2e8f0' : '#475569'} strokeWidth={1} strokeDasharray="6 4" />
                                        {/* 轴线 */}
                                        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke={isLightMode ? '#94a3b8' : '#64748b'} strokeWidth={1.5} />
                                        <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke={isLightMode ? '#94a3b8' : '#64748b'} strokeWidth={1.5} />
                                        {/* 轴标签 */}
                                        <text x={W / 2} y={H - 10} textAnchor="middle" className={`text-[11px] font-bold ${isLightMode ? 'fill-slate-500' : 'fill-slate-400'}`}>{xAxis}</text>
                                        <text x={15} y={H / 2} textAnchor="middle" transform={`rotate(-90, 15, ${H / 2})`} className={`text-[11px] font-bold ${isLightMode ? 'fill-slate-500' : 'fill-slate-400'}`}>{yAxis}</text>
                                        {/* 数据点 */}
                                        {points.map((pt, i) => {
                                            const { sx, sy } = toSvg(pt.x, pt.y);
                                            const color = colors[i % colors.length];
                                            const isHovered = hoveredPoint?.id === pt.product.id;
                                            return (
                                                <g key={pt.product.id}
                                                    onMouseEnter={() => setHoveredPoint({ id: pt.product.id, x: sx, y: sy, name: pt.product.name, xVal: pt.x, yVal: pt.y })}
                                                    onMouseLeave={() => setHoveredPoint(null)}
                                                >
                                                    <circle cx={sx} cy={sy} r={isHovered ? 12 : pt.selected ? 10 : 7} fill={color} fillOpacity={isHovered ? 0.9 : 0.7} stroke={isHovered || pt.selected ? color : 'white'} strokeWidth={isHovered ? 3 : pt.selected ? 3 : 2} className="transition-all cursor-pointer" />
                                                    <text x={sx} y={sy - 16} textAnchor="middle" className={`text-[9px] font-black ${isLightMode ? 'fill-slate-600' : 'fill-slate-300'}`}>{pt.product.name.substring(0, 10)}</text>
                                                </g>
                                            );
                                        })}
                                        {/* 市场空白区提示 */}
                                        {points.length >= 2 && (() => {
                                            const avgX = points.reduce((s, p) => s + p.x, 0) / points.length;
                                            const avgY = points.reduce((s, p) => s + p.y, 0) / points.length;
                                            const { sx, sy } = toSvg(avgX, avgY);
                                            return <circle cx={sx} cy={sy} r={30} fill="none" stroke="#14b8a6" strokeWidth={1} strokeDasharray="4 4" opacity={0.4} />;
                                        })()}
                                    </svg>
                                    {/* Tooltip 浮层 */}
                                    {hoveredPoint && (
                                        <div className={`absolute pointer-events-none z-10 px-3 py-2 rounded-xl shadow-xl border text-[10px] ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600'}`}
                                            style={{ left: `${(hoveredPoint.x / W) * 100}%`, top: `${(hoveredPoint.y / H) * 100 - 12}%`, transform: 'translate(-50%, -100%)' }}>
                                            <p className={`font-black ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{hoveredPoint.name}</p>
                                            <p className={`${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{scatterXAxis}: <span className="font-black">{hoveredPoint.xVal.toLocaleString()}</span></p>
                                            <p className={`${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{scatterYAxis || axisOptions[1] || ''}: <span className="font-black">{hoveredPoint.yVal.toLocaleString()}</span></p>
                                        </div>
                                    )}
                                </div>

                                {/* 定位洞察 */}
                                <div className={`rounded-2xl p-5 border ${isLightMode ? 'bg-gradient-to-r from-cyan-50 to-teal-50 border-cyan-200' : 'bg-cyan-500/10 border-cyan-500/20'}`}>
                                    <p className={`text-[10px] font-black uppercase tracking-wider mb-2 ${isLightMode ? 'text-cyan-700' : 'text-cyan-400'}`}><i className="fa-solid fa-lightbulb mr-1.5" />定位洞察</p>
                                    <p className={`text-[11px] font-medium leading-relaxed ${isLightMode ? 'text-cyan-800' : 'text-cyan-300'}`}>
                                        {points.length >= 2 ? `当前 ${points.length} 款产品在「${xAxis}」和「${yAxis}」两个维度上呈现分布。虚线十字线将图表划分为四象限：高${yAxis}高${xAxis}（右上）、高${yAxis}低${xAxis}（左上）等。远离中心的位置可能存在差异化机会。` : '请先在竞品雷达中搜索产品数据。'}
                                    </p>
                                </div>
                            </>
                        );
                    })() : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-5 opacity-40">
                            <div className="w-20 h-20 rounded-full bg-cyan-50 border-2 border-cyan-200 flex items-center justify-center">
                                <i className="fa-solid fa-crosshairs text-cyan-300 text-3xl" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3rem] mb-2">需要竞品数据</p>
                                <p className="text-[11px] text-slate-400 max-w-xs">请先在竞品雷达中搜索至少 2 款产品，然后切换到市场定位视图</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════ 成本结构分析视图 ═══════════════ */}
            {viewMode === 'cost' && (
                <div className="flex-1 flex flex-row gap-5 min-h-0 overflow-hidden pb-4">
                    {/* 左侧输入面板 */}
                    <div className="w-80 shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
                        <div className={`rounded-[1.5rem] border p-5 shadow-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-7 h-7 rounded-xl bg-orange-500 flex items-center justify-center">
                                    <i className="fa-solid fa-calculator text-white text-[11px]" />
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-wider ${isLightMode ? 'text-slate-700' : 'text-white'}`}>成本项目</span>
                            </div>
                            {costInputs.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 mb-3 group">
                                    <input
                                        className={`text-[10px] font-bold w-20 shrink-0 bg-transparent border-b border-transparent hover:border-orange-300 focus:border-orange-400 outline-none transition-all px-0.5 py-0.5 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}
                                        value={item.label}
                                        onChange={e => setCostInputs(prev => prev.map((c, i) => i === idx ? { ...c, label: e.target.value } : c))}
                                        title="双击编辑名称"
                                    />
                                    <input
                                        type="number"
                                        className={`flex-1 border rounded-lg px-3 py-2 text-[11px] font-bold outline-none focus:border-orange-400 transition-all text-right ${isLightMode ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-white/10 border-white/10 text-white'}`}
                                        value={item.value || ''}
                                        onChange={e => {
                                            const v = parseFloat(e.target.value) || 0;
                                            setCostInputs(prev => prev.map((c, i) => i === idx ? { ...c, value: v } : c));
                                        }}
                                        placeholder="0"
                                    />
                                    <span className="text-[9px] text-slate-400 font-bold w-12 shrink-0">{item.unit}</span>
                                    <button onClick={() => setCostInputs(prev => prev.filter((_, i) => i !== idx))} className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-600 transition-all text-[9px]" title="删除">
                                        <i className="fa-solid fa-xmark" />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => setCostInputs(prev => [...prev, { label: `自定义${prev.length + 1}`, value: 0, unit: '元/kg' }])}
                                className={`w-full py-2 border-2 border-dashed rounded-xl text-[10px] font-bold transition-all mt-2 ${isLightMode ? 'border-slate-200 text-slate-400 hover:text-orange-500 hover:border-orange-300' : 'border-white/10 text-slate-500 hover:text-orange-400 hover:border-orange-500'}`}
                            >
                                <i className="fa-solid fa-plus mr-1" />添加成本项
                            </button>
                        </div>

                        <div className={`rounded-[1.5rem] border p-5 shadow-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-xl bg-orange-500 flex items-center justify-center">
                                    <i className="fa-solid fa-industry text-white text-[11px]" />
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-wider ${isLightMode ? 'text-slate-700' : 'text-white'}`}>产能规模</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range" min="1" max="100" step="1"
                                    value={costScale}
                                    onChange={e => setCostScale(parseInt(e.target.value))}
                                    className="flex-1 accent-orange-500"
                                />
                                <span className="text-[13px] font-black text-orange-600 w-12 text-right">{costScale}x</span>
                            </div>
                            <p className="text-[9px] text-slate-400 mt-2 italic">产能越大，单位成本因规模效应越低</p>
                        </div>

                        {/* 利润率计算器 */}
                        <div className={`rounded-[1.5rem] border p-5 shadow-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-xl bg-emerald-500 flex items-center justify-center">
                                    <i className="fa-solid fa-percent text-white text-[11px]" />
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-wider ${isLightMode ? 'text-slate-700' : 'text-white'}`}>利润率目标</span>
                            </div>
                            {[15, 25, 35, 50].map(margin => {
                                const minPrice = costScaled > 0 ? costScaled / (1 - margin / 100) : 0;
                                return (
                                    <div key={margin} className="flex items-center justify-between mb-2">
                                        <span className={`text-[10px] font-bold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{margin}% 利润率</span>
                                        <span className="text-[11px] font-black text-emerald-600">≥ ¥{minPrice.toFixed(1)}/kg</span>
                                    </div>
                                );
                            })}
                            <p className="text-[9px] text-slate-400 mt-1 italic">基于规模效应后成本 ¥{costScaled.toFixed(1)}/kg 反算最低售价</p>
                        </div>

                        <button
                            onClick={() => {
                                const md = `# 成本结构分析\n\n| 成本项 | 金额 | 单位 |\n|--------|------|------|\n${costInputs.map(c => `| ${c.label} | ${c.value} | ${c.unit} |`).join('\n')}\n| **合计** | **${costTotal.toFixed(2)}** | **元/kg** |\n\n产能规模: ${costScale}x  \n规模效应后单位成本: ¥${costScaled.toFixed(2)}/kg\n\n## 利润率目标\n| 利润率 | 最低售价 |\n|--------|----------|\n${[15, 25, 35, 50].map(m => `| ${m}% | ¥${(costScaled / (1 - m / 100)).toFixed(2)}/kg |`).join('\n')}`;
                                handleSecureSave(`成本分析_${new Date().toISOString().slice(0,10)}.md`, new Blob([md], { type: 'text/markdown;charset=utf-8' }));
                            }}
                            className="w-full py-3 rounded-[1.5rem] bg-orange-500 text-white text-[10px] font-black uppercase shadow-lg hover:bg-orange-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <i className="fa-solid fa-download" />导出成本分析
                        </button>
                    </div>

                    {/* 右侧可视化 */}
                    <div className="flex-1 flex flex-col gap-5 overflow-y-auto custom-scrollbar pr-1">
                        {/* 总计卡片 */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg">
                                <p className="text-[9px] font-black uppercase tracking-wider opacity-80 mb-1">基准单位成本</p>
                                <p className="text-3xl font-black">¥{costTotal.toFixed(1)}</p>
                                <p className="text-[10px] opacity-70 mt-1">/kg · 1x 产能</p>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg">
                                <p className="text-[9px] font-black uppercase tracking-wider opacity-80 mb-1">规模效应后成本</p>
                                <p className="text-3xl font-black">¥{costScaled.toFixed(1)}</p>
                                <p className="text-[10px] opacity-70 mt-1">/kg · {costScale}x 产能</p>
                            </div>
                            <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
                                <p className="text-[9px] font-black uppercase tracking-wider opacity-80 mb-1">降本幅度</p>
                                <p className="text-3xl font-black">{costTotal > 0 ? ((1 - costScaled / costTotal) * 100).toFixed(1) : '0'}%</p>
                                <p className="text-[10px] opacity-70 mt-1">相较基准</p>
                            </div>
                        </div>

                        {/* 成本结构饼图 (SVG) */}
                        <div className={`rounded-2xl border p-6 shadow-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                            <h3 className={`text-[11px] font-black uppercase tracking-wider mb-4 flex items-center gap-2 ${isLightMode ? 'text-slate-700' : 'text-white'}`}>
                                <i className="fa-solid fa-chart-pie text-orange-500" />成本结构分布
                            </h3>
                            <div className="flex items-center justify-center gap-8">
                                <svg viewBox="0 0 200 200" className="w-52 h-52">
                                    {(() => {
                                        const filtered = costInputs.filter(c => c.value > 0);
                                        if (filtered.length === 0) return <text x="100" y="105" textAnchor="middle" className="text-[12px] fill-slate-300 font-bold">请输入成本数据</text>;
                                        const pieColors = ['#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444'];
                                        let cumAngle = -Math.PI / 2;
                                        return filtered.map((item, i) => {
                                            const frac = item.value / costTotal;
                                            const startAngle = cumAngle;
                                            cumAngle += frac * 2 * Math.PI;
                                            const endAngle = cumAngle;
                                            const largeArc = frac > 0.5 ? 1 : 0;
                                            const x1 = 100 + 80 * Math.cos(startAngle);
                                            const y1 = 100 + 80 * Math.sin(startAngle);
                                            const x2 = 100 + 80 * Math.cos(endAngle);
                                            const y2 = 100 + 80 * Math.sin(endAngle);
                                            return (
                                                <path
                                                    key={i}
                                                    d={`M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`}
                                                    fill={pieColors[i % pieColors.length]}
                                                    fillOpacity={0.85}
                                                    stroke="white"
                                                    strokeWidth={2}
                                                    className="transition-all hover:opacity-100 cursor-pointer"
                                                />
                                            );
                                        });
                                    })()}
                                </svg>
                                <div className="flex flex-col gap-2">
                                    {costInputs.filter(c => c.value > 0).map((item, i) => {
                                        const pieColors = ['#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444'];
                                        const pct = costTotal > 0 ? ((item.value / costTotal) * 100).toFixed(1) : '0';
                                        return (
                                            <div key={i} className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: pieColors[i % pieColors.length] }} />
                                                <span className={`text-[10px] font-bold w-20 ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>{item.label}</span>
                                                <span className={`text-[10px] font-black ${isLightMode ? 'text-slate-800' : 'text-white'}`}>¥{item.value}</span>
                                                <span className="text-[9px] text-slate-400">({pct}%)</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* 与竞品价格对比 */}
                        {products.length > 0 && costTotal > 0 && (
                            <div className={`rounded-2xl border p-6 shadow-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                                <h3 className={`text-[11px] font-black uppercase tracking-wider mb-4 flex items-center gap-2 ${isLightMode ? 'text-slate-700' : 'text-white'}`}>
                                    <i className="fa-solid fa-scale-balanced text-orange-500" />与竞品价格对比
                                </h3>
                                <div className="space-y-3">
                                    {products.filter(p => p.price && p.price.value > 0).map(p => {
                                        const margin = p.price!.value - costScaled;
                                        const marginPct = ((margin / p.price!.value) * 100);
                                        return (
                                            <div key={p.id} className="flex items-center gap-3">
                                                <span className={`text-[10px] font-bold w-28 truncate ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>{p.name}</span>
                                                <span className={`text-[10px] font-black w-20 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>¥{p.price!.value}</span>
                                                <div className={`flex-1 h-2 rounded-full overflow-hidden ${isLightMode ? 'bg-slate-100' : 'bg-white/10'}`}>
                                                    <div className={`h-full rounded-full ${margin >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} style={{ width: `${Math.min(Math.abs(marginPct), 100)}%` }} />
                                                </div>
                                                <span className={`text-[10px] font-black w-16 text-right ${margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {margin >= 0 ? '+' : ''}{marginPct.toFixed(1)}%
                                                </span>
                                            </div>
                                        );
                                    })}
                                    <p className="text-[9px] text-slate-400 italic mt-2">正值 = 竞品售价高于你的成本（有利润空间）</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════ 技术档案视图 ═══════════════ */}
            {viewMode === 'tech' && (
                <div className="flex-1 flex flex-col min-h-0 gap-5 overflow-auto custom-scrollbar pb-10">
                    {/* 工具栏 */}
                    <div className={`rounded-2xl border p-4 shadow-sm flex items-center justify-between ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                                <i className="fa-solid fa-flask-vial text-white" />
                            </div>
                            <div>
                                <h3 className={`text-[13px] font-black ${isLightMode ? 'text-slate-800' : 'text-white'}`}>竞品技术档案</h3>
                                <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                                    {products.filter(p => p.techProfile).length}/{products.length} 已分析
                                    {analyzingTechIds.size > 0 && <span className="text-violet-500 ml-2"><i className="fa-solid fa-circle-notch animate-spin mr-1" />{analyzingTechIds.size} 分析中</span>}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {products.some(p => !p.techProfile) && (
                                <button
                                    onClick={async () => {
                                        const unanalyzed = products.filter(p => !p.techProfile && !analyzingTechIds.has(p.id));
                                        if (unanalyzed.length === 0) return;
                                        const ids = new Set(unanalyzed.map(p => p.id));
                                        setAnalyzingTechIds(prev => new Set([...prev, ...ids]));
                                        const batchSize = 3;
                                        for (let i = 0; i < unanalyzed.length; i += batchSize) {
                                            const batch = unanalyzed.slice(i, i + batchSize);
                                            await Promise.allSettled(batch.map(async product => {
                                                try {
                                                    const techData = await analyzeProductTechnology({
                                                        name: product.name,
                                                        manufacturer: product.manufacturer,
                                                        techRoute: product.techRoute,
                                                        category: product.category,
                                                    });
                                                    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, techProfile: { ...techData, analyzedAt: new Date().toISOString() } } : p));
                                                } catch {}
                                                setAnalyzingTechIds(prev => { const n = new Set(prev); n.delete(product.id); return n; });
                                            }));
                                        }
                                        showToast({ message: `全部技术档案分析完成`, type: 'success' });
                                    }}
                                    disabled={analyzingTechIds.size > 0}
                                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ${analyzingTechIds.size > 0 ? 'bg-violet-100 text-violet-400 cursor-wait' : 'bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:shadow-lg hover:shadow-violet-500/20 active:scale-95'}`}
                                >
                                    <i className={`fa-solid ${analyzingTechIds.size > 0 ? 'fa-circle-notch animate-spin' : 'fa-bolt'} text-[9px]`} />
                                    {analyzingTechIds.size > 0 ? `正在分析 (${analyzingTechIds.size})...` : `分析未完成 (${products.filter(p => !p.techProfile).length})`}
                                </button>
                            )}
                            {products.some(p => p.techProfile) && (
                                <button
                                    onClick={async () => {
                                        const toReanalyze = products.filter(p => !analyzingTechIds.has(p.id));
                                        if (toReanalyze.length === 0) return;
                                        const ids = new Set(toReanalyze.map(p => p.id));
                                        setAnalyzingTechIds(prev => new Set([...prev, ...ids]));
                                        const batchSize = 3;
                                        for (let i = 0; i < toReanalyze.length; i += batchSize) {
                                            const batch = toReanalyze.slice(i, i + batchSize);
                                            await Promise.allSettled(batch.map(async product => {
                                                try {
                                                    const techData = await analyzeProductTechnology({
                                                        name: product.name,
                                                        manufacturer: product.manufacturer,
                                                        techRoute: product.techRoute,
                                                        category: product.category,
                                                    });
                                                    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, techProfile: { ...techData, analyzedAt: new Date().toISOString() } } : p));
                                                } catch {}
                                                setAnalyzingTechIds(prev => { const n = new Set(prev); n.delete(product.id); return n; });
                                            }));
                                        }
                                        showToast({ message: '全部技术档案已重新分析', type: 'success' });
                                    }}
                                    disabled={analyzingTechIds.size > 0}
                                    className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all border ${analyzingTechIds.size > 0 ? 'bg-slate-100 text-slate-300 cursor-wait border-slate-200' : isLightMode ? 'bg-white text-violet-600 border-violet-200 hover:bg-violet-50 active:scale-95' : 'bg-white/5 text-violet-400 border-violet-500/30 hover:bg-violet-500/10 active:scale-95'}`}
                                >
                                    <i className="fa-solid fa-arrows-rotate text-[9px]" />
                                    重新分析全部
                                </button>
                            )}
                        </div>
                    </div>

                    {products.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-5 opacity-40">
                            <div className="w-20 h-20 rounded-full bg-violet-50 border-2 border-violet-200 flex items-center justify-center">
                                <i className="fa-solid fa-flask-vial text-violet-300 text-3xl" />
                            </div>
                            <p className="text-[11px] font-black text-slate-400">请先在「竞品雷达」中搜索产品</p>
                        </div>
                    ) : (
                        /* 产品技术档案详情网格 */
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                            {products.map(product => {
                                const tp = product.techProfile;
                                const isAnalyzing = analyzingTechIds.has(product.id);
                                const barrierScore = tp?.techBarrierScore ?? 0;
                                const bColor = barrierScore >= 70 ? '#ef4444' : barrierScore >= 40 ? '#f59e0b' : '#22c55e';
                                return (
                                    <div key={product.id} className={`rounded-2xl border p-5 shadow-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                                        {/* 产品头部 */}
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                                                <i className="fa-solid fa-box-open text-white text-xs" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className={`text-[12px] font-black truncate ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{product.name}</h4>
                                                <p className="text-[9px] text-slate-400 font-bold">{product.manufacturer} · {product.country || '—'}</p>
                                            </div>
                                            {isAnalyzing && (
                                                <span className="px-2 py-1 rounded-lg bg-violet-100 text-violet-500 text-[8px] font-black flex items-center gap-1">
                                                    <i className="fa-solid fa-circle-notch animate-spin" />分析中
                                                </span>
                                            )}
                                            {tp && (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[8px] font-black flex items-center gap-1">
                                                        <i className="fa-solid fa-circle-check" />已分析
                                                    </span>
                                                    <button
                                                        onClick={async () => {
                                                            if (analyzingTechIds.has(product.id)) return;
                                                            setAnalyzingTechIds(prev => new Set(prev).add(product.id));
                                                            try {
                                                                const techData = await analyzeProductTechnology({
                                                                    name: product.name,
                                                                    manufacturer: product.manufacturer,
                                                                    techRoute: product.techRoute,
                                                                    category: product.category,
                                                                });
                                                                setProducts(prev => prev.map(p => p.id === product.id ? { ...p, techProfile: { ...techData, analyzedAt: new Date().toISOString() } } : p));
                                                                showToast({ message: `「${product.name}」已重新分析`, type: 'success' });
                                                            } catch {
                                                                showToast({ message: '重新分析失败', type: 'error' });
                                                            } finally {
                                                                setAnalyzingTechIds(prev => { const n = new Set(prev); n.delete(product.id); return n; });
                                                            }
                                                        }}
                                                        className="px-1.5 py-1 rounded-lg text-[8px] font-bold text-violet-500 hover:bg-violet-50 transition-all flex items-center gap-0.5"
                                                        title="重新分析此产品"
                                                    >
                                                        <i className="fa-solid fa-arrows-rotate text-[7px]" />
                                                    </button>
                                                </div>
                                            )}
                                            {!tp && !isAnalyzing && (
                                                <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-400 text-[8px] font-bold">待分析</span>
                                            )}
                                        </div>

                                        {!tp && !isAnalyzing && (
                                            <p className="text-[10px] text-slate-400 text-center py-6 italic">点击上方「一键分析全部」按钮开始分析</p>
                                        )}
                                        {isAnalyzing && (
                                            <div className="py-8 flex flex-col items-center gap-3">
                                                <i className="fa-solid fa-circle-notch animate-spin text-violet-400 text-xl" />
                                                <p className="text-[10px] text-violet-400 font-bold">AI 正在深度分析技术细节...</p>
                                            </div>
                                        )}

                                        {tp && (
                                            <div className="space-y-4 text-[10px]">
                                                {/* 技术壁垒评分 */}
                                                <div className={`rounded-xl p-4 flex items-center gap-4 ${isLightMode ? 'bg-slate-50' : 'bg-white/5'}`}>
                                                    <div className="relative w-20 h-20 shrink-0">
                                                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                                            <circle cx="50" cy="50" r="42" fill="none" stroke={isLightMode ? '#e2e8f0' : '#334155'} strokeWidth="7" />
                                                            <circle cx="50" cy="50" r="42" fill="none" stroke={bColor} strokeWidth="7"
                                                                strokeDasharray={`${barrierScore * 2.64} 264`} strokeLinecap="round" />
                                                        </svg>
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                            <span className="text-[16px] font-black" style={{ color: bColor }}>{barrierScore}</span>
                                                            <span className="text-[7px] text-slate-400">壁垒</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className={`font-black text-[11px] mb-1 ${isLightMode ? 'text-slate-700' : 'text-white'}`}>技术壁垒评估</p>
                                                        <p className="text-slate-400 leading-relaxed">{tp.techBarrierNotes || '—'}</p>
                                                        {tp.substitutability && (
                                                            <span className={`inline-block mt-2 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${
                                                                tp.substitutability === 'low' ? 'bg-rose-100 text-rose-600'
                                                                : tp.substitutability === 'medium' ? 'bg-amber-100 text-amber-600'
                                                                : 'bg-emerald-100 text-emerald-600'
                                                            }`}>可替代性: {tp.substitutability === 'low' ? '低' : tp.substitutability === 'medium' ? '中' : '高'}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 核心专利 */}
                                                {tp.patents && tp.patents.length > 0 && (
                                                    <div>
                                                        <p className={`font-black text-[11px] uppercase tracking-wider mb-3 flex items-center gap-1.5 ${isLightMode ? 'text-slate-700' : 'text-white'}`}>
                                                            <i className="fa-solid fa-certificate text-violet-500" />核心专利 ({tp.patents.length})
                                                        </p>
                                                        <div className="space-y-2">
                                                            {tp.patents.map((pat, i) => (
                                                                <div key={i} className={`rounded-xl p-3 border ${isLightMode ? 'bg-violet-50/50 border-violet-100' : 'bg-violet-500/10 border-violet-500/20'}`}>
                                                                    <div className="flex items-start justify-between gap-2 mb-1">
                                                                        <p className={`font-black text-[11px] ${isLightMode ? 'text-slate-700' : 'text-white'}`}>{pat.title}</p>
                                                                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-black ${
                                                                            pat.status.includes('授权') ? 'bg-emerald-100 text-emerald-600'
                                                                            : pat.status.includes('审查') ? 'bg-amber-100 text-amber-600'
                                                                            : 'bg-slate-100 text-slate-500'
                                                                        }`}>{pat.status}</span>
                                                                    </div>
                                                                    <p className="text-slate-400 mb-1.5"><i className="fa-solid fa-barcode mr-1 text-[7px]" />{pat.id} · {pat.applicant} · {pat.filingDate}</p>
                                                                    <p className="text-violet-600 font-bold"><i className="fa-solid fa-key mr-1 text-[7px]" />{pat.keyTech}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* 制备工艺 */}
                                                {tp.processSteps && tp.processSteps.length > 0 && (
                                                    <div>
                                                        <p className={`font-black text-[11px] uppercase tracking-wider mb-3 flex items-center gap-1.5 ${isLightMode ? 'text-slate-700' : 'text-white'}`}>
                                                            <i className="fa-solid fa-diagram-project text-cyan-500" />制备工艺流程 ({tp.processSteps.length} 步)
                                                        </p>
                                                        <div className="space-y-2.5">
                                                            {tp.processSteps.map((step, i) => (
                                                                <div key={i} className="flex items-start gap-3">
                                                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 text-white flex items-center justify-center shrink-0 text-[9px] font-black mt-0.5">{i + 1}</div>
                                                                    <div className={`flex-1 rounded-xl p-2.5 ${isLightMode ? 'bg-cyan-50/50 border border-cyan-100' : 'bg-cyan-500/10 border border-cyan-500/20'}`}>
                                                                        <p className={`leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>{step}</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* 关键配方 & 前驱体 */}
                                                {(tp.keyFormulation || tp.precursors?.length) && (
                                                    <div>
                                                        <p className={`font-black text-[11px] uppercase tracking-wider mb-3 flex items-center gap-1.5 ${isLightMode ? 'text-slate-700' : 'text-white'}`}>
                                                            <i className="fa-solid fa-flask text-orange-500" />关键配方 & 前驱体
                                                        </p>
                                                        {tp.keyFormulation && (
                                                            <p className={`leading-relaxed mb-3 rounded-xl p-3 ${isLightMode ? 'bg-orange-50/50 border border-orange-100 text-slate-600' : 'bg-orange-500/10 border border-orange-500/20 text-slate-300'}`}>{tp.keyFormulation}</p>
                                                        )}
                                                        {tp.precursors && tp.precursors.length > 0 && (
                                                            <div className="flex flex-wrap gap-2 mb-2">
                                                                {tp.precursors.map((pr, i) => (
                                                                    <span key={i} className={`px-2.5 py-1 rounded-lg text-[9px] font-bold ${isLightMode ? 'bg-orange-50 text-orange-600 border border-orange-200' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                                                                        <i className="fa-solid fa-atom mr-1 text-[7px]" />{pr}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {tp.sinteringTemp && (
                                                            <p className={`text-[10px] mt-2 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                                                <i className="fa-solid fa-temperature-high mr-1.5 text-rose-400" />
                                                                反应/烧结温度: <span className={`font-black ${isLightMode ? 'text-slate-700' : 'text-white'}`}>{tp.sinteringTemp}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════ 技术路线演化时间线视图 ═══════════════ */}
            {viewMode === 'evolution' && (() => {
                // ─── 类别配色 ───
                const catConfig: Record<string, { color: string; icon: string; label: string }> = {
                    breakthrough: { color: '#ef4444', icon: 'fa-bolt', label: '技术突破' },
                    product:      { color: '#14b8a6', icon: 'fa-box-open', label: '产品发布' },
                    patent:       { color: '#8b5cf6', icon: 'fa-certificate', label: '专利布局' },
                    standard:     { color: '#f59e0b', icon: 'fa-scale-balanced', label: '行业标准' },
                    forecast:     { color: '#3b82f6', icon: 'fa-crystal-ball', label: '趋势预测' },
                };
                const impactSize: Record<string, number> = { high: 14, medium: 10, low: 7 };

                // ─── 生成演化数据（基于竞品雷达结果） ───
                const handleGenerateEvolution = async () => {
                    if (products.length === 0) {
                        showToast({ message: '请先在「竞品雷达」中搜索产品', type: 'error' });
                        return;
                    }
                    const queryLabel = searchQuery.trim() || products[0]?.category || products[0]?.name || '';
                    setIsGeneratingEvolution(true);
                    if (setAiStatus) setAiStatus('🧬 正在基于竞品数据生成技术路线演化时间线...');

                    await startGlobalTask(
                        { id: `tech_evolution_${Date.now()}`, type: 'trend_analysis', status: 'running', title: `技术演化: ${queryLabel.substring(0, 12)}` },
                        async () => {
                            try {
                                const result = await generateTechEvolution({
                                    query: queryLabel,
                                    region: searchRegion,
                                    products: products.map(p => ({
                                        name: p.name,
                                        manufacturer: p.manufacturer,
                                        techRoute: p.techRoute,
                                        maturityLevel: p.maturityLevel,
                                        category: p.category,
                                    })),
                                });
                                setEvolutionData({
                                    ...result,
                                    query: queryLabel,
                                    generatedAt: new Date().toISOString(),
                                });
                                showToast({ message: '技术路线演化时间线已生成', type: 'success' });
                            } catch (e) {
                                console.error('Tech evolution generation failed', e);
                                showToast({ message: '生成失败，请检查 AI 配置', type: 'error' });
                            } finally {
                                setIsGeneratingEvolution(false);
                                if (setAiStatus) setAiStatus(null);
                            }
                        }
                    );
                };

                // ─── 时间线计算 ───
                const milestones = evolutionData?.milestones || [];
                const generations = evolutionData?.generations || [];

                // 解析年份
                const parseYear = (y: string) => parseInt(y.replace(/Q\d/, ''), 10) || 2000;
                const allYears = [
                    ...milestones.map(m => parseYear(m.year)),
                    ...generations.flatMap(g => [parseYear(g.startYear), parseYear(g.endYear)]),
                ];
                const minYear = allYears.length > 0 ? Math.min(...allYears) - 1 : 2000;
                const maxYear = allYears.length > 0 ? Math.max(...allYears) + 2 : 2030;
                const yearRange = maxYear - minYear || 1;

                // SVG 尺寸
                const SVG_W = 1200;
                const PAD_LEFT = 60;
                const PAD_RIGHT = 40;
                const LANE_TOP = 20;
                const LANE_ROW_H = 40;
                const LANE_GAP = 6;
                const LANES_TOTAL = generations.length > 0 ? generations.length * (LANE_ROW_H + LANE_GAP) : 55;
                const AXIS_Y = LANE_TOP + LANES_TOTAL + 120;
                const SVG_H = AXIS_Y + 160;
                const CONTENT_W = SVG_W - PAD_LEFT - PAD_RIGHT;

                const yearToX = (year: number) => PAD_LEFT + ((year - minYear) / yearRange) * CONTENT_W;

                // 重叠逻辑 — 交替上下排列
                const sortedMilestones = [...milestones].sort((a, b) => parseYear(a.year) - parseYear(b.year));
                const positionedMilestones = sortedMilestones.map((m, i) => ({
                    ...m,
                    x: yearToX(parseYear(m.year)),
                    side: (i % 2 === 0 ? 'top' : 'bottom') as 'top' | 'bottom',
                }));

                return (
                    <div className="flex-1 flex flex-col min-h-0 gap-5 overflow-auto custom-scrollbar pb-10">
                        {/* 工具栏 — 展示关联竞品 */}
                        <div className={`rounded-2xl border p-4 shadow-sm ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                                        <i className="fa-solid fa-timeline text-white" />
                                    </div>
                                    <div>
                                        <h3 className={`text-[13px] font-black ${isLightMode ? 'text-slate-800' : 'text-white'}`}>技术路线演化时间线</h3>
                                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                                            {evolutionData
                                                ? `${evolutionData.query} · ${milestones.length} 个里程碑 · ${generations.length} 个代际`
                                                : products.length > 0
                                                    ? `基于 ${products.length} 款竞品生成技术演化 — ${searchQuery || products[0]?.category || ''}`
                                                    : '请先在「竞品雷达」中搜索产品'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleGenerateEvolution}
                                    disabled={isGeneratingEvolution || products.length === 0}
                                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all active:scale-95 shrink-0 ${isGeneratingEvolution ? 'bg-indigo-100 text-indigo-400 cursor-wait' : products.length === 0 ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white hover:shadow-lg hover:shadow-indigo-500/20'}`}
                                >
                                    <i className={`fa-solid ${isGeneratingEvolution ? 'fa-circle-notch animate-spin' : 'fa-wand-magic-sparkles'} text-[9px]`} />
                                    {isGeneratingEvolution ? 'AI 生成中...' : evolutionData ? '重新生成' : `基于 ${products.length} 款竞品生成`}
                                </button>
                            </div>

                            {/* 关联竞品产品标签 */}
                            {products.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-dashed border-slate-200 flex items-center gap-2 flex-wrap">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider shrink-0">
                                        <i className="fa-solid fa-link mr-1" />关联竞品
                                    </span>
                                    {products.slice(0, 8).map(p => (
                                        <span key={p.id} className={`text-[8px] font-bold px-2 py-0.5 rounded-md ${isLightMode ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
                                            {p.name}{p.techRoute ? ` · ${p.techRoute}` : ''}
                                        </span>
                                    ))}
                                    {products.length > 8 && <span className="text-[8px] text-slate-400">+{products.length - 8}</span>}
                                </div>
                            )}
                        </div>

                        {evolutionData && milestones.length > 0 ? (
                            <>
                                {/* 图例 */}
                                <div className={`flex items-center gap-4 flex-wrap px-2 ${isLightMode ? '' : ''}`}>
                                    {Object.entries(catConfig).map(([key, cfg]) => (
                                        <div key={key} className="flex items-center gap-1.5">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cfg.color }} />
                                            <span className={`text-[9px] font-bold ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>{cfg.label}</span>
                                        </div>
                                    ))}
                                    <div className="ml-auto flex items-center gap-3">
                                        {['high', 'medium', 'low'].map(impact => (
                                            <div key={impact} className="flex items-center gap-1">
                                                <div className="rounded-full bg-slate-300" style={{ width: impactSize[impact] * 2, height: impactSize[impact] * 2 }} />
                                                <span className="text-[8px] text-slate-400 font-bold">{impact === 'high' ? '高影响' : impact === 'medium' ? '中影响' : '低影响'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* SVG 时间线 */}
                                <div className={`rounded-2xl border shadow-sm overflow-x-auto ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                                    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full min-w-[900px]" style={{ height: `${Math.max(SVG_H, 480)}px` }}>
                                        <defs>
                                            {generations.map((gen, i) => (
                                                <linearGradient key={`gen-grad-${i}`} id={`gen-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor={gen.color || '#6366f1'} stopOpacity={0.15} />
                                                    <stop offset="100%" stopColor={gen.color || '#6366f1'} stopOpacity={0.03} />
                                                </linearGradient>
                                            ))}
                                        </defs>

                                        {/* 代际泳道背景——每代一行 */}
                                        {generations.map((gen, i) => {
                                            const x1 = yearToX(parseYear(gen.startYear));
                                            const x2 = yearToX(parseYear(gen.endYear));
                                            const rowY = LANE_TOP + i * (LANE_ROW_H + LANE_GAP);
                                            return (
                                                <g key={`gen-${i}`}>
                                                    <rect x={x1} y={rowY} width={Math.max(x2 - x1, 20)} height={LANE_ROW_H} rx={8} fill={`url(#gen-grad-${i})`} />
                                                    <rect x={x1} y={rowY} width={Math.max(x2 - x1, 20)} height={LANE_ROW_H} rx={8} fill="none" stroke={gen.color || '#6366f1'} strokeOpacity={0.25} strokeWidth={1} />
                                                    <text x={x1 + 10} y={rowY + 16} className="text-[9px] font-black" fill={gen.color || '#6366f1'} fillOpacity={0.9}>{gen.name}</text>
                                                    <text x={x1 + 10} y={rowY + 30} className="text-[7px]" fill={isLightMode ? '#64748b' : '#94a3b8'} fillOpacity={0.6}>{gen.startYear}–{gen.endYear} · {gen.description.substring(0, 40)}{gen.description.length > 40 ? '...' : ''}</text>
                                                </g>
                                            );
                                        })}

                                        {/* 主轴线 */}
                                        <line x1={PAD_LEFT} y1={AXIS_Y} x2={SVG_W - PAD_RIGHT} y2={AXIS_Y} stroke={isLightMode ? '#cbd5e1' : '#475569'} strokeWidth={2} strokeLinecap="round" />

                                        {/* 年份刻度 */}
                                        {Array.from({ length: Math.min(maxYear - minYear + 1, 30) }, (_, i) => minYear + i).filter((y, _, arr) => {
                                            const step = arr.length > 20 ? 5 : arr.length > 10 ? 2 : 1;
                                            return y % step === 0;
                                        }).map(year => (
                                            <g key={`tick-${year}`}>
                                                <line x1={yearToX(year)} y1={AXIS_Y - 5} x2={yearToX(year)} y2={AXIS_Y + 5} stroke={isLightMode ? '#94a3b8' : '#64748b'} strokeWidth={1} />
                                                <text x={yearToX(year)} y={AXIS_Y + 18} textAnchor="middle" className="text-[9px] font-bold" fill={isLightMode ? '#94a3b8' : '#64748b'}>{year}</text>
                                            </g>
                                        ))}

                                        {/* 里程碑节点 */}
                                        {positionedMilestones.map((m) => {
                                            const cfg = catConfig[m.category] || catConfig.breakthrough;
                                            const r = impactSize[m.impact] || 10;
                                            const isHovered = hoveredMilestone === m.id;
                                            const lineLen = m.side === 'top' ? 100 : 100;
                                            const nodeY = m.side === 'top' ? AXIS_Y - lineLen - r : AXIS_Y + lineLen + r;
                                            const lineY1 = AXIS_Y;
                                            const lineY2 = m.side === 'top' ? AXIS_Y - lineLen : AXIS_Y + lineLen;
                                            const isForecast = m.category === 'forecast';

                                            return (
                                                <g key={m.id}
                                                    onClick={() => setHoveredMilestone(prev => prev === m.id ? null : m.id)}
                                                    className="cursor-pointer"
                                                >
                                                    {/* 连接线 */}
                                                    <line x1={m.x} y1={lineY1} x2={m.x} y2={lineY2}
                                                        stroke={cfg.color} strokeWidth={isHovered ? 2 : 1} strokeOpacity={isHovered ? 1 : 0.5}
                                                        strokeDasharray={isForecast ? '4 3' : 'none'} />

                                                    {/* 轴上小圆点 */}
                                                    <circle cx={m.x} cy={AXIS_Y} r={3} fill={cfg.color} />

                                                    {/* 节点圆 */}
                                                    <circle cx={m.x} cy={nodeY} r={r + (isHovered ? 4 : 0)}
                                                        fill={cfg.color} fillOpacity={isHovered ? 1 : 0.85}
                                                        stroke={isHovered ? cfg.color : 'white'} strokeWidth={isHovered ? 3 : 2}
                                                        className="transition-all duration-150"
                                                        style={isForecast ? { strokeDasharray: '3 2' } : undefined}
                                                    />

                                                    {/* 节点标签 */}
                                                    <text x={m.x} y={m.side === 'top' ? nodeY - r - 6 : nodeY + r + 14}
                                                        textAnchor="middle" className="text-[8px] font-black"
                                                        fill={isLightMode ? '#334155' : '#e2e8f0'}>
                                                        {m.title.length > 12 ? m.title.substring(0, 12) + '…' : m.title}
                                                    </text>
                                                    <text x={m.x} y={m.side === 'top' ? nodeY - r - 18 : nodeY + r + 26}
                                                        textAnchor="middle" className="text-[7px] font-bold"
                                                        fill={cfg.color} fillOpacity={0.7}>
                                                        {m.year}
                                                    </text>
                                                </g>
                                            );
                                        })}

                                        {/* 箭头终端 */}
                                        <polygon points={`${SVG_W - PAD_RIGHT},${AXIS_Y} ${SVG_W - PAD_RIGHT - 10},${AXIS_Y - 5} ${SVG_W - PAD_RIGHT - 10},${AXIS_Y + 5}`} fill={isLightMode ? '#cbd5e1' : '#475569'} />
                                    </svg>
                                </div>

                                {/* 点击显示详情卡片 */}
                                {hoveredMilestone && (() => {
                                    const m = milestones.find(ms => ms.id === hoveredMilestone);
                                    if (!m) return null;
                                    const cfg = catConfig[m.category] || catConfig.breakthrough;
                                    return (
                                        <div className={`rounded-2xl border p-5 shadow-lg transition-all animate-reveal ${isLightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600'}`}>
                                            <div className="flex items-start gap-3">
                                                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: cfg.color + '20' }}>
                                                    <i className={`fa-solid ${cfg.icon}`} style={{ color: cfg.color }} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className={`text-[12px] font-black ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{m.title}</h4>
                                                        <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg" style={{ backgroundColor: cfg.color + '15', color: cfg.color }}>{cfg.label}</span>
                                                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg ${m.impact === 'high' ? 'bg-rose-100 text-rose-600' : m.impact === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>{m.impact === 'high' ? '高影响' : m.impact === 'medium' ? '中影响' : '低影响'}</span>
                                                        <button onClick={() => setHoveredMilestone(null)} className="ml-auto text-slate-300 hover:text-slate-500 transition-colors"><i className="fa-solid fa-xmark text-[10px]" /></button>
                                                    </div>
                                                    <p className="text-[9px] text-indigo-500 font-black mb-2">{m.year}{m.techRoute ? ` · ${m.techRoute}` : ''}</p>
                                                    <p className={`text-[11px] leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-slate-300'}`}>{m.description}</p>
                                                    {m.companies && m.companies.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                            {m.companies.map((c, ci) => (
                                                                <span key={ci} className={`text-[8px] font-bold px-2 py-0.5 rounded-md ${isLightMode ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-slate-400'}`}><i className="fa-solid fa-building mr-1 text-[7px]" />{c}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* 未来展望 */}
                                {evolutionData.futureOutlook && (
                                    <div className={`rounded-2xl p-5 border ${isLightMode ? 'bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200' : 'bg-indigo-500/10 border-indigo-500/20'}`}>
                                        <p className={`text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-1.5 ${isLightMode ? 'text-indigo-700' : 'text-indigo-400'}`}>
                                            <i className="fa-solid fa-crystal-ball" />未来技术展望
                                        </p>
                                        <p className={`text-[11px] font-medium leading-relaxed ${isLightMode ? 'text-indigo-800' : 'text-indigo-300'}`}>
                                            {evolutionData.futureOutlook}
                                        </p>
                                    </div>
                                )}
                            </>
                        ) : !isGeneratingEvolution ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-5 opacity-40">
                                <div className="w-20 h-20 rounded-full bg-indigo-50 border-2 border-indigo-200 flex items-center justify-center">
                                    <i className={`fa-solid ${products.length > 0 ? 'fa-timeline' : 'fa-magnifying-glass'} text-indigo-300 text-3xl`} />
                                </div>
                                <div className="text-center">
                                    {products.length > 0 ? (
                                        <>
                                            <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3rem] mb-2">生成技术路线演化</p>
                                            <p className="text-[11px] text-slate-400 max-w-xs">已关联 {products.length} 款竞品产品，点击上方「基于竞品生成」按钮，AI 将分析这些产品所属技术领域的完整演化时间线</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3rem] mb-2">请先完成竞品搜索</p>
                                            <p className="text-[11px] text-slate-400 max-w-xs">技术演化时间线基于竞品雷达的搜索结果生成。请先切换到「竞品雷达」搜索产品，再回到此页面生成演化时间线</p>
                                            <button onClick={() => setViewMode('search')} className="mt-4 px-5 py-2.5 bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 transition-all active:scale-95 flex items-center gap-2 mx-auto">
                                                <i className="fa-solid fa-magnifying-glass text-[9px]" />前往竞品雷达
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-8 animate-pulse text-center">
                                    <i className="fa-solid fa-circle-notch animate-spin text-indigo-500 text-2xl mb-3" />
                                    <p className="text-[11px] font-black text-indigo-600">AI 正在基于 {products.length} 款竞品分析技术路线演化...</p>
                                    <p className="text-[9px] text-indigo-400 mt-1">通常需要 15-30 秒</p>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ═══════════════ 研发战略建议视图 ═══════════════ */}
            {viewMode === 'rdAdvice' && (() => {
                const hasEnoughData = products.length > 0;
                const analyzedProducts = products.filter(p => p.techProfile);
                const dataCompleteness = [
                    { label: '竞品雷达', done: products.length > 0, detail: `${products.length} 款产品` },
                    { label: '技术档案', done: analyzedProducts.length > 0, detail: `${analyzedProducts.length}/${products.length} 已分析` },
                    { label: '技术演化', done: !!evolutionData, detail: evolutionData ? `${evolutionData.milestones?.length || 0} 个里程碑` : '未生成' },
                ];

                const handleGenerateRD = async () => {
                    if (!hasEnoughData) {
                        showToast({ message: '请先完成竞品雷达搜索', type: 'error' });
                        return;
                    }
                    setIsGeneratingRD(true);
                    if (setAiStatus) setAiStatus('💡 正在综合分析数据生成研发战略建议...');

                    await startGlobalTask(
                        { id: `rd_advice_${Date.now()}`, type: 'trend_analysis', status: 'running', title: '研发战略建议' },
                        async () => {
                            try {
                                const techProfilesData = analyzedProducts
                                    .filter(p => p.techProfile)
                                    .map(p => ({
                                        productName: p.name,
                                        techBarrierScore: p.techProfile!.techBarrierScore,
                                        substitutability: p.techProfile!.substitutability,
                                        processSteps: p.techProfile!.processSteps,
                                        techBarrierNotes: p.techProfile!.techBarrierNotes,
                                        patents: p.techProfile!.patents,
                                        keyFormulation: p.techProfile!.keyFormulation,
                                        precursors: p.techProfile!.precursors,
                                        sinteringTemp: p.techProfile!.sinteringTemp,
                                    }));

                                const result = await generateRDRecommendation({
                                    query: searchQuery || products[0]?.category || products[0]?.name || '',
                                    products: products.map(p => ({
                                        name: p.name,
                                        manufacturer: p.manufacturer,
                                        country: p.country,
                                        techRoute: p.techRoute,
                                        maturityLevel: p.maturityLevel,
                                        category: p.category,
                                        advantages: p.advantages,
                                        disadvantages: p.disadvantages,
                                        marketShare: p.marketShare,
                                        specs: p.specs,
                                        price: p.price,
                                    })),
                                    techProfiles: techProfilesData.length > 0 ? techProfilesData : undefined,
                                    evolutionData: evolutionData ? {
                                        futureOutlook: evolutionData.futureOutlook,
                                        generations: evolutionData.generations?.map(g => ({ name: g.name, description: g.description })),
                                        milestoneCount: evolutionData.milestones?.length,
                                    } : undefined,
                                    comparisonData: undefined,
                                });
                                setRdAdviceContent(result);
                                showToast({ message: '研发战略建议已生成', type: 'success' });
                            } catch (e) {
                                console.error('RD recommendation generation failed', e);
                                showToast({ message: '生成失败，请检查 AI 配置', type: 'error' });
                            } finally {
                                setIsGeneratingRD(false);
                                if (setAiStatus) setAiStatus(null);
                            }
                        }
                    );
                };

                return (
                    <div className="flex-1 flex flex-col min-h-0 gap-5 overflow-hidden pb-4">
                        {/* 工具栏 */}
                        <div className={`rounded-2xl border p-4 shadow-sm shrink-0 ${isLightMode ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'}`}>
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                        <i className="fa-solid fa-lightbulb text-white" />
                                    </div>
                                    <div>
                                        <h3 className={`text-[13px] font-black ${isLightMode ? 'text-slate-800' : 'text-white'}`}>研发战略建议</h3>
                                        <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                                            {rdAdviceContent ? '基于竞品分析综合生成的研发方向建议' : '综合全部分析数据，AI 生成研发方向建议与行动路线图'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {rdAdviceContent && (
                                        <button
                                            onClick={() => handleSecureSave(rdAdviceContent, `研发战略建议_${searchQuery || 'market'}.md`)}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-all ${isLightMode ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/10 text-slate-300 hover:bg-white/15'}`}
                                        >
                                            <i className="fa-solid fa-download text-[9px]" />导出
                                        </button>
                                    )}
                                    <button
                                        onClick={handleGenerateRD}
                                        disabled={isGeneratingRD || !hasEnoughData}
                                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all active:scale-95 shrink-0 ${isGeneratingRD ? 'bg-emerald-100 text-emerald-400 cursor-wait' : !hasEnoughData ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:shadow-lg hover:shadow-emerald-500/20'}`}
                                    >
                                        <i className={`fa-solid ${isGeneratingRD ? 'fa-circle-notch animate-spin' : 'fa-wand-magic-sparkles'} text-[9px]`} />
                                        {isGeneratingRD ? 'AI 生成中...' : rdAdviceContent ? '重新生成' : '生成研发建议'}
                                    </button>
                                </div>
                            </div>

                            {/* 数据完整度指示器 */}
                            <div className="mt-3 pt-3 border-t border-dashed border-slate-200 flex items-center gap-4 flex-wrap">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider shrink-0">
                                    <i className="fa-solid fa-list-check mr-1" />数据完整度
                                </span>
                                {dataCompleteness.map(d => (
                                    <div key={d.label} className="flex items-center gap-1.5">
                                        <i className={`fa-solid ${d.done ? 'fa-circle-check text-emerald-500' : 'fa-circle-xmark text-slate-300'} text-[10px]`} />
                                        <span className={`text-[8px] font-bold ${d.done ? (isLightMode ? 'text-slate-600' : 'text-slate-300') : 'text-slate-400'}`}>{d.label}</span>
                                        <span className="text-[7px] text-slate-400">({d.detail})</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 内容区域 */}
                        {rdAdviceContent ? (
                            <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                                <RDReportRenderer content={rdAdviceContent} isLightMode={isLightMode} />
                            </div>
                        ) : !isGeneratingRD ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-5 opacity-40">
                                <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                                    <i className={`fa-solid ${hasEnoughData ? 'fa-lightbulb' : 'fa-magnifying-glass'} text-emerald-300 text-3xl`} />
                                </div>
                                <div className="text-center">
                                    {hasEnoughData ? (
                                        <>
                                            <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3rem] mb-2">生成研发战略建议</p>
                                            <p className="text-[11px] text-slate-400 max-w-sm">AI 将综合竞品数据、技术档案和演化趋势，生成包含最佳技术路线推荐、差异化定位、研发优先级矩阵、风险评估和行动路线图的全维度建议书</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3rem] mb-2">请先完成竞品分析</p>
                                            <p className="text-[11px] text-slate-400 max-w-sm">研发建议基于全流程分析数据生成。建议先完成：竞品搜索 → 技术档案 → 技术演化，再回来生成建议</p>
                                            <button onClick={() => setViewMode('search')} className="mt-4 px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 transition-all active:scale-95 flex items-center gap-2 mx-auto">
                                                <i className="fa-solid fa-magnifying-glass text-[9px]" />前往竞品雷达
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 animate-pulse text-center">
                                    <i className="fa-solid fa-circle-notch animate-spin text-emerald-500 text-2xl mb-3" />
                                    <p className="text-[11px] font-black text-emerald-600">AI 正在综合分析数据生成研发战略建议...</p>
                                    <p className="text-[9px] text-emerald-400 mt-1">通常需要 20-40 秒</p>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ═══════════════ 路线深度分析视图 ═══════════════ */}
            {viewMode === 'routeDive' && (() => {
                const handleGenerateRouteDive = async () => {
                    if (!routeDiveRouteName.trim()) {
                        showToast({ message: '请输入要深度分析的技术路线名称', type: 'error' });
                        return;
                    }
                    setIsGeneratingRouteDive(true);
                    setRouteDiveContent('');
                    try {
                        const result = await generateRouteDeepDive({
                            query: searchQuery || products[0]?.category || '',
                            routeName: routeDiveRouteName,
                            products: products.map(p => ({
                                name: p.name,
                                manufacturer: p.manufacturer,
                                techRoute: p.techRoute,
                                specs: p.specs,
                                price: p.price,
                            })),
                            rdAdviceSummary: rdAdviceContent ? rdAdviceContent.slice(0, 2000) : undefined,
                        });
                        setRouteDiveContent(result);
                        showToast({ message: '路线深度分析已生成', type: 'success' });
                    } catch (err) {
                        showToast({ message: '路线深度分析生成失败', type: 'error' });
                    } finally {
                        setIsGeneratingRouteDive(false);
                    }
                };

                return (
                    <div className="flex-1 flex flex-col min-h-0 gap-4">
                        {/* 工具栏 */}
                        <div className={`rounded-2xl border p-4 shrink-0 ${isLightMode ? 'bg-white border-slate-200 shadow-sm' : 'bg-white/5 border-white/10'}`}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-sm">
                                    <i className="fa-solid fa-microscope text-white text-[11px]" />
                                </div>
                                <div>
                                    <h3 className={`text-[12px] font-black ${isLightMode ? 'text-slate-800' : 'text-white'}`}>推荐路线深度分析</h3>
                                    <p className="text-[9px] text-slate-400 mt-0.5">输入研发建议中的首要推荐路线，生成详细实施分析</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-end gap-3">
                                <div className="flex-1 min-w-[200px]">
                                    <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-1">技术路线名称</label>
                                    <input
                                        className={`w-full px-3 py-2 rounded-xl border text-[11px] font-bold outline-none transition-all ${isLightMode ? 'bg-slate-50 border-slate-200 text-slate-700 focus:border-sky-400 focus:ring-2 focus:ring-sky-100' : 'bg-white/5 border-white/10 text-white'}`}
                                        placeholder="如：分级孔碳基底负载单原子催化剂复合尖晶石氧化物"
                                        value={routeDiveRouteName}
                                        onChange={e => setRouteDiveRouteName(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleGenerateRouteDive}
                                    disabled={isGeneratingRouteDive || !routeDiveRouteName.trim()}
                                    className="px-5 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-40 flex items-center gap-2 shrink-0"
                                >
                                    {isGeneratingRouteDive ? <i className="fa-solid fa-circle-notch animate-spin" /> : <i className="fa-solid fa-microscope" />}
                                    {isGeneratingRouteDive ? '分析中...' : '生成深度分析'}
                                </button>
                            </div>
                        </div>

                        {/* 内容区域 */}
                        {routeDiveContent ? (
                            <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                                <RDReportRenderer content={routeDiveContent} isLightMode={isLightMode} />
                            </div>
                        ) : isGeneratingRouteDive ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-5">
                                <div className="relative">
                                    <div className="w-20 h-20 rounded-full border-4 border-sky-100 border-t-sky-500 animate-spin" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <i className="fa-solid fa-microscope text-sky-500 text-xl" />
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className={`text-sm font-black ${isLightMode ? 'text-slate-600' : 'text-white'}`}>正在深度分析「{routeDiveRouteName}」路线...</p>
                                    <p className="text-[10px] text-slate-400 mt-1">覆盖合成工艺、原材料、设备、实验方案、成本模型等 9 个维度</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center gap-5 opacity-40">
                                <div className="w-20 h-20 rounded-full bg-sky-50 border-2 border-sky-200 flex items-center justify-center">
                                    <i className="fa-solid fa-microscope text-sky-300 text-3xl" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-black text-slate-400 uppercase tracking-[0.3rem] mb-2">路线深度分析</p>
                                    <p className="text-[11px] text-slate-400 max-w-sm">从「研发建议」获取首要推荐路线名称，填入上方输入框，AI 将生成 9 维度的详细实施方案</p>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ═══════════════ 分析报告视图 ═══════════════ */}
            {viewMode === 'report' && (
                <div className="flex-1 flex flex-row gap-5 min-h-0 overflow-hidden pb-4">
                    {/* 左侧配置面板 */}
                    <div className="w-80 shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
                        <div className="bg-white rounded-[1.5rem] border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-xl bg-teal-600 flex items-center justify-center">
                                    <i className="fa-solid fa-box-open text-white text-[11px]" />
                                </div>
                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">分析对象</span>
                            </div>
                            <input
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-bold text-slate-700 placeholder:text-slate-400 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all"
                                placeholder="例：固态电池电解质、碳纳米管..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            {selectedProducts.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {selectedProducts.slice(0, 5).map(p => (
                                        <span key={p.id} className="text-[8px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md">{p.name}</span>
                                    ))}
                                    {selectedProducts.length > 5 && <span className="text-[8px] text-slate-400">+{selectedProducts.length - 5}</span>}
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-[1.5rem] border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-xl bg-teal-600 flex items-center justify-center">
                                    <i className="fa-solid fa-globe text-white text-[11px]" />
                                </div>
                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">分析范围</span>
                            </div>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:border-teal-400 transition-all cursor-pointer"
                                value={searchRegion}
                                onChange={e => setSearchRegion(e.target.value)}
                            >
                                <option>全球</option>
                                <option>中国</option>
                                <option>欧美</option>
                                <option>亚太</option>
                            </select>
                        </div>

                        <div className="bg-white rounded-[1.5rem] border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-xl bg-teal-600 flex items-center justify-center">
                                        <i className="fa-solid fa-list-check text-white text-[11px]" />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">分析维度</span>
                                </div>
                                <span className="text-[9px] font-black text-teal-500 bg-teal-50 px-2 py-1 rounded-lg">{reportDimensions.length}/{ALL_REPORT_DIMENSIONS.length}</span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {ALL_REPORT_DIMENSIONS.map(dim => (
                                    <label key={dim} className="flex items-center gap-2.5 cursor-pointer group px-2 py-1.5 rounded-xl hover:bg-teal-50 transition-colors">
                                        <input type="checkbox" checked={reportDimensions.includes(dim)} onChange={() => toggleDimension(dim)} className="w-3.5 h-3.5 accent-teal-600 rounded shrink-0" />
                                        <span className={`text-[10px] font-bold leading-tight transition-colors ${reportDimensions.includes(dim) ? 'text-slate-800' : 'text-slate-400'}`}>{dim}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-[1.5rem] border border-slate-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-xl bg-slate-400 flex items-center justify-center">
                                    <i className="fa-solid fa-comment-dots text-white text-[11px]" />
                                </div>
                                <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">补充背景</span>
                            </div>
                            <textarea
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all resize-none"
                                rows={3}
                                placeholder="例：重点关注国产替代、特定应用场景..."
                                value={reportCustomContext}
                                onChange={e => setReportCustomContext(e.target.value)}
                            />
                        </div>

                        <button
                            onClick={handleGenerateReport}
                            disabled={isGeneratingReport || (!searchQuery.trim() && products.length === 0)}
                            className="w-full py-4 rounded-[1.5rem] text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-3 shadow-lg disabled:opacity-40"
                            style={{ background: isGeneratingReport ? '#0f766e' : 'linear-gradient(135deg, #14b8a6, #0d9488)', color: 'white' }}
                        >
                            {isGeneratingReport ? (
                                <><i className="fa-solid fa-circle-notch animate-spin" />AI 正在生成报告...</>
                            ) : (
                                <><i className="fa-solid fa-wand-magic-sparkles" />生成市场分析报告</>
                            )}
                        </button>

                        {isGeneratingReport && (
                            <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 animate-pulse">
                                <p className="text-[10px] font-black text-teal-600 mb-1">🔬 AI 正在深度分析中...</p>
                                <p className="text-[9px] text-teal-400">正在整合竞品数据、价格、工艺对比，通常需要 30-90 秒</p>
                            </div>
                        )}
                    </div>

                    {/* 中央报告展示区 */}
                    <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col min-w-0">
                        {(liveReportContent || activeReportId) ? (() => {
                            const activeContent = liveReportContent || savedReports.find(r => r.id === activeReportId)?.content || '';
                            const fakeReport: MatrixReport = {
                                id: activeReportId || 'live',
                                timestamp: new Date().toLocaleString(),
                                title: searchQuery ? `${searchQuery} 市场分析报告` : '市场分析报告',
                                content: activeContent,
                                type: '市场分析',
                                comparisonTable: { headers: [], rows: [] },
                                insights: [],
                                reportType: 'Weekly'
                            };
                            return <ReportView report={fakeReport} />;
                        })() : (
                            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
                                <div className="w-24 h-24 rounded-full bg-teal-50 border-2 border-teal-100 flex items-center justify-center">
                                    <i className="fa-solid fa-file-lines text-teal-300 text-4xl" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-black text-slate-300 uppercase tracking-[0.3rem] mb-2">等待生成报告</p>
                                    <p className="text-[11px] text-slate-400 max-w-xs">在左侧输入产品名称并配置分析维度，AI 将生成包含竞品对比、工艺分析、定价策略的深度市场报告</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 右侧历史列表 */}
                    <div className="w-64 shrink-0 bg-white rounded-[2rem] border border-slate-200 p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2 px-1">
                            <i className="fa-solid fa-clock-rotate-left text-slate-400 text-[10px]" />
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">历史报告</h4>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 min-h-0">
                            {savedReports.map(rep => (
                                <div
                                    key={rep.id}
                                    onClick={() => { setActiveReportId(rep.id); setLiveReportContent(null); }}
                                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col group relative ${activeReportId === rep.id
                                        ? 'bg-teal-600 border-teal-600 text-white'
                                        : 'bg-white border-slate-100 hover:border-teal-200'
                                        }`}
                                >
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className={`text-[7px] font-black uppercase tracking-wider ${activeReportId === rep.id ? 'text-teal-200' : 'text-slate-400'}`}>{rep.timestamp.split(' ')[0]}</span>
                                        <button onClick={(e) => handleDeleteReport(rep.id, e)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <i className="fa-solid fa-trash-can text-[9px]" />
                                        </button>
                                    </div>
                                    <p className={`text-[10px] font-black leading-tight line-clamp-2 italic ${activeReportId === rep.id ? 'text-white' : 'text-slate-700'}`}>{rep.title}</p>
                                    <div className={`mt-1.5 flex items-center gap-1 text-[8px] font-black uppercase ${activeReportId === rep.id ? 'text-teal-200' : 'text-teal-400'}`}>
                                        <i className="fa-solid fa-chart-pie text-[7px]" />市场分析
                                    </div>
                                </div>
                            ))}
                            {savedReports.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-50">
                                    <i className="fa-solid fa-folder-open text-slate-300 text-3xl" />
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

export default MarketAnalysisView;
