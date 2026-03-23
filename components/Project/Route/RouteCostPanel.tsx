
import React, { useState, useMemo, useCallback } from 'react';
import { CostEstimation, CostMaterialItem } from '../../../types';
import { InventoryItem } from '../../../types';
import { useProjectContext } from '../../../context/ProjectContext';

interface RouteCostPanelProps {
    costData: CostEstimation | undefined;
    onUpdate: (data: CostEstimation) => void;
    onClose: () => void;
    flowchartSteps?: { step: string; action: string }[];
}

// ═══ 常见化学试剂参考价格库 ═══
const REFERENCE_PRICES: Record<string, { price: number; unit: string }> = {
    'Zn(NO3)2·6H2O': { price: 0.50, unit: 'G' },
    'Fe(acac)3': { price: 2.00, unit: 'G' },
    'Ni(NO3)2·6H2O': { price: 0.80, unit: 'G' },
    'Co(NO3)2·6H2O': { price: 0.90, unit: 'G' },
    'Cu(NO3)2·3H2O': { price: 0.60, unit: 'G' },
    'NaOH': { price: 0.05, unit: 'G' },
    'KOH': { price: 0.08, unit: 'G' },
    '甲醇': { price: 0.10, unit: 'ML' },
    'Methanol': { price: 0.10, unit: 'ML' },
    '乙醇': { price: 0.08, unit: 'ML' },
    'Ethanol': { price: 0.08, unit: 'ML' },
    'DMF': { price: 0.50, unit: 'ML' },
    'N,N-二甲基甲酰胺': { price: 0.50, unit: 'ML' },
    'DMSO': { price: 0.40, unit: 'ML' },
    '2-甲基咪唑': { price: 0.30, unit: 'G' },
    '2-Methylimidazole': { price: 0.30, unit: 'G' },
    '尿素': { price: 0.03, unit: 'G' },
    'Urea': { price: 0.03, unit: 'G' },
    '石英舟': { price: 0.00, unit: 'PC' },
    '聚四氟乙烯内衬': { price: 0.00, unit: 'PC' },
};

const getRefPrice = (name: string): number | null => {
    const key = Object.keys(REFERENCE_PRICES).find(k =>
        name.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(name.toLowerCase())
    );
    return key ? REFERENCE_PRICES[key].price : null;
};

const matchInventoryItem = (name: string, inventory: InventoryItem[]): InventoryItem | null => {
    return inventory.find(item => {
        const itemName = item.name.toLowerCase();
        const searchName = name.toLowerCase();
        return itemName.includes(searchName) || searchName.includes(itemName) ||
            (item.formula && (item.formula.toLowerCase().includes(searchName) || searchName.includes(item.formula.toLowerCase())));
    }) || null;
};

const createDefaultEstimation = (): CostEstimation => ({
    batchCount: 1,
    materials: [],
    materialTotal: 0,
    operationalCost: 2.50,
    operationalModel: 'linear',
    totalCost: 2.50,
    unitCost: 2.50,
    volumeDiscountRules: [
        { minBatch: 10, discountPercent: 5 },
        { minBatch: 50, discountPercent: 12 },
        { minBatch: 100, discountPercent: 20 },
    ],
    lastUpdated: new Date().toLocaleString(),
});

const recalculate = (data: CostEstimation): CostEstimation => {
    const materialTotal = data.materials.reduce((sum, m) => sum + m.subtotal, 0);
    const opCost = data.operationalModel === 'linear'
        ? data.operationalCost * data.batchCount
        : data.operationalCost;
    const totalCost = materialTotal * data.batchCount + opCost;

    // Apply volume discount
    let discount = 0;
    if (data.volumeDiscountRules) {
        const applicable = data.volumeDiscountRules
            .filter(r => data.batchCount >= r.minBatch)
            .sort((a, b) => b.minBatch - a.minBatch);
        if (applicable.length > 0) discount = applicable[0].discountPercent;
    }
    const discountedTotal = totalCost * (1 - discount / 100);
    const unitCost = data.batchCount > 0 ? discountedTotal / data.batchCount : 0;

    return { ...data, materialTotal, totalCost: discountedTotal, unitCost, lastUpdated: new Date().toLocaleString() };
};

// ═══ SVG 饼图组件 ═══
const CostPieChart: React.FC<{ materialCost: number; opCost: number }> = ({ materialCost, opCost }) => {
    const total = materialCost + opCost;
    if (total === 0) return null;
    const matPct = materialCost / total;
    const matAngle = matPct * 360;

    const polarToCartesian = (cx: number, cy: number, r: number, degrees: number) => {
        const rad = (degrees - 90) * Math.PI / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };

    const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
        const start = polarToCartesian(cx, cy, r, endAngle);
        const end = polarToCartesian(cx, cy, r, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
        return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
    };

    return (
        <div className="flex items-center gap-3">
            <svg width="56" height="56" viewBox="0 0 56 56">
                {/* Chemical */}
                <path d={describeArc(28, 28, 26, 0, Math.min(matAngle, 359.99))} fill="#6366f1" opacity="0.9" />
                {/* Operational */}
                {matAngle < 359.99 && (
                    <path d={describeArc(28, 28, 26, matAngle, 360)} fill="#10b981" opacity="0.9" />
                )}
                <circle cx="28" cy="28" r="14" fill="white" />
            </svg>
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-indigo-500"></div>
                    <span className="text-[8px] font-bold text-slate-500">化学物料 {(matPct * 100).toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></div>
                    <span className="text-[8px] font-bold text-slate-500">运营成本 {((1 - matPct) * 100).toFixed(0)}%</span>
                </div>
            </div>
        </div>
    );
};

// ═══ SVG 规模-成本曲线 ═══
const ScaleCurve: React.FC<{ data: CostEstimation }> = ({ data }) => {
    const points = useMemo(() => {
        const pts: { batch: number; cost: number }[] = [];
        for (let b = 1; b <= Math.max(data.batchCount * 3, 20); b++) {
            const matCost = data.materialTotal * b;
            const opCost = data.operationalModel === 'linear' ? data.operationalCost * b : data.operationalCost;
            let total = matCost + opCost;
            // Apply discount
            if (data.volumeDiscountRules) {
                const applicable = data.volumeDiscountRules.filter(r => b >= r.minBatch).sort((a, b2) => b2.minBatch - a.minBatch);
                if (applicable.length > 0) total *= (1 - applicable[0].discountPercent / 100);
            }
            pts.push({ batch: b, cost: b > 0 ? total / b : 0 });
        }
        return pts;
    }, [data]);

    if (points.length === 0) return null;

    const maxCost = Math.max(...points.map(p => p.cost), 1);
    const maxBatch = Math.max(...points.map(p => p.batch), 1);
    const W = 200, H = 70, PAD = 8;

    const toSvg = (p: { batch: number; cost: number }) => ({
        x: PAD + (p.batch / maxBatch) * (W - PAD * 2),
        y: PAD + (1 - p.cost / maxCost) * (H - PAD * 2),
    });

    const pathData = points.map((p, i) => {
        const { x, y } = toSvg(p);
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    }).join(' ');

    // Current batch indicator
    const currentPt = points.find(p => p.batch === data.batchCount);
    const currentSvg = currentPt ? toSvg(currentPt) : null;

    return (
        <div className="mt-2">
            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <i className="fa-solid fa-chart-line text-[6px] text-violet-400"></i> 规模-成本曲线 (SCALE CURVE)
            </p>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="bg-slate-900 rounded-xl border border-slate-700">
                {/* Grid */}
                {[0.25, 0.5, 0.75].map(pct => (
                    <line key={pct} x1={PAD} x2={W - PAD} y1={PAD + pct * (H - PAD * 2)} y2={PAD + pct * (H - PAD * 2)} stroke="#334155" strokeWidth="0.5" strokeDasharray="3,3" />
                ))}
                {/* Curve */}
                <path d={pathData} fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinejoin="round" />
                {/* Area */}
                <path d={`${pathData} L ${PAD + (W - PAD * 2)} ${H - PAD} L ${PAD} ${H - PAD} Z`} fill="url(#costGradient)" opacity="0.3" />
                <defs>
                    <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" />
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
                    </linearGradient>
                </defs>
                {/* Current point */}
                {currentSvg && (
                    <>
                        <circle cx={currentSvg.x} cy={currentSvg.y} r="4" fill="#7c3aed" stroke="white" strokeWidth="1.5" />
                        <text x={currentSvg.x} y={currentSvg.y - 7} textAnchor="middle" fill="#c4b5fd" fontSize="6" fontWeight="bold">
                            ¥{currentPt!.cost.toFixed(1)}
                        </text>
                    </>
                )}
                {/* Axes labels */}
                <text x={PAD} y={H - 1} fill="#64748b" fontSize="5" fontWeight="bold">1</text>
                <text x={W - PAD - 10} y={H - 1} fill="#64748b" fontSize="5" fontWeight="bold">{maxBatch}批</text>
            </svg>
        </div>
    );
};

// ═══ 主组件 ═══
export const RouteCostPanel: React.FC<RouteCostPanelProps> = ({ costData, onUpdate, onClose, flowchartSteps }) => {
    const { inventory } = useProjectContext();
    const [data, setData] = useState<CostEstimation>(() => costData || createDefaultEstimation());
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newAmount, setNewAmount] = useState('');
    const [newUnit, setNewUnit] = useState('G');
    const [newPrice, setNewPrice] = useState('');

    const update = useCallback((next: CostEstimation) => {
        const recalced = recalculate(next);
        setData(recalced);
        onUpdate(recalced);
    }, [onUpdate]);

    const handleBatchChange = (count: number) => {
        update({ ...data, batchCount: Math.max(1, count) });
    };

    const handleAddMaterial = () => {
        if (!newName.trim()) return;
        const invMatch = matchInventoryItem(newName, inventory);
        const price = parseFloat(newPrice) || (invMatch?.unitPrice ?? getRefPrice(newName) ?? 0);
        const amount = parseFloat(newAmount) || 1;
        const item: CostMaterialItem = {
            id: `cm_${Date.now()}`,
            name: newName.trim(),
            amount,
            unit: newUnit,
            unitPrice: price,
            subtotal: amount * price,
            inventoryId: invMatch?.id,
            category: 'chemical',
        };
        update({ ...data, materials: [...data.materials, item] });
        setNewName('');
        setNewAmount('');
        setNewPrice('');
        setShowAddForm(false);
    };

    const handleRemoveMaterial = (id: string) => {
        update({ ...data, materials: data.materials.filter(m => m.id !== id) });
    };

    const handleEditMaterial = (id: string, updates: Partial<CostMaterialItem>) => {
        const mats = data.materials.map(m => {
            if (m.id !== id) return m;
            const updated = { ...m, ...updates };
            updated.subtotal = updated.amount * updated.unitPrice;
            return updated;
        });
        update({ ...data, materials: mats });
    };

    const handleOpCostChange = (val: number) => {
        update({ ...data, operationalCost: Math.max(0, val) });
    };

    const handleOpModelChange = () => {
        update({ ...data, operationalModel: data.operationalModel === 'linear' ? 'fixed' : 'linear' });
    };

    // Auto-populate from flowchart steps (extract reagent names)
    const handleAutoPopulate = () => {
        if (!flowchartSteps || flowchartSteps.length === 0) return;
        const allText = flowchartSteps.map(s => `${s.step} ${s.action}`).join(' ');
        const reagentPatterns = [
            /(\w+\([^)]+\)\d*·?\d*\w*)/g,  // Chemical formulas like Zn(NO3)2·6H2O
            /(甲醇|乙醇|丙酮|DMF|DMSO|NaOH|KOH|尿素|2-甲基咪唑|石英舟)/g,
        ];
        const found = new Set<string>();
        for (const pattern of reagentPatterns) {
            const matches = allText.match(pattern);
            if (matches) matches.forEach(m => found.add(m));
        }
        if (found.size === 0) return;
        const existingNames = new Set(data.materials.map(m => m.name.toLowerCase()));
        const newItems: CostMaterialItem[] = [];
        found.forEach(name => {
            if (existingNames.has(name.toLowerCase())) return;
            const invMatch = matchInventoryItem(name, inventory);
            const price = invMatch?.unitPrice ?? getRefPrice(name) ?? 0;
            newItems.push({
                id: `cm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                name,
                amount: 1,
                unit: 'G',
                unitPrice: price,
                subtotal: price,
                inventoryId: invMatch?.id,
                category: 'chemical',
            });
        });
        if (newItems.length > 0) {
            update({ ...data, materials: [...data.materials, ...newItems] });
        }
    };

    // Active discount
    const activeDiscount = useMemo(() => {
        if (!data.volumeDiscountRules) return 0;
        const applicable = data.volumeDiscountRules.filter(r => data.batchCount >= r.minBatch).sort((a, b) => b.minBatch - a.minBatch);
        return applicable.length > 0 ? applicable[0].discountPercent : 0;
    }, [data.batchCount, data.volumeDiscountRules]);

    return (
        <div className="mb-4 p-5 bg-gradient-to-br from-violet-50/80 via-white to-indigo-50/50 border-2 border-violet-200 rounded-[1.5rem] shadow-lg animate-reveal overflow-hidden relative">
            {/* 装饰背景 */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-violet-200/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-200/20 rounded-full blur-3xl pointer-events-none"></div>

            {/* ═══ Header ═══ */}
            <div className="flex justify-between items-start mb-5 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-violet-500/20">
                        <i className="fa-solid fa-coins text-white text-sm"></i>
                    </div>
                    <div>
                        <h5 className="text-xs font-black text-slate-800 uppercase flex items-center gap-2">
                            工业成本评估库
                        </h5>
                        <p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">SCALE-UP & ECONOMY OF SCALE</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {flowchartSteps && flowchartSteps.length > 0 && (
                        <button onClick={handleAutoPopulate} className="px-3 py-1.5 bg-white border border-violet-200 text-violet-600 rounded-lg text-[8px] font-black uppercase hover:bg-violet-50 transition-all shadow-sm flex items-center gap-1">
                            <i className="fa-solid fa-wand-magic-sparkles text-[7px]"></i> 自动识别物料
                        </button>
                    )}
                    <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-500 transition-all flex items-center justify-center active:scale-90">
                        <i className="fa-solid fa-times text-sm"></i>
                    </button>
                </div>
            </div>

            {/* ═══ 成本预测摘要卡片 ═══ */}
            <div className="bg-slate-900 rounded-lg p-4 mb-5 border border-slate-700 shadow-xl relative z-10">
                <div className="flex justify-between items-center mb-3">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <i className="fa-solid fa-calculator text-violet-400 text-[7px]"></i>
                        成本预测 ({data.batchCount} 批次)
                    </p>
                    <div className="flex items-center gap-2.5 bg-slate-800 rounded-xl px-3 py-1.5 border border-slate-600">
                        <button onClick={() => handleBatchChange(data.batchCount - 1)} className="w-6 h-6 rounded-lg bg-slate-700 text-white hover:bg-violet-600 transition-all flex items-center justify-center text-xs font-black">
                            −
                        </button>
                        <div className="flex items-center gap-1">
                            <input
                                type="number" min="1" value={data.batchCount}
                                onChange={(e) => handleBatchChange(parseInt(e.target.value) || 1)}
                                className="w-10 bg-transparent text-center text-sm font-black text-white font-mono outline-none"
                            />
                            <span className="text-[8px] font-bold text-slate-400">批次</span>
                        </div>
                        <button onClick={() => handleBatchChange(data.batchCount + 1)} className="w-6 h-6 rounded-lg bg-slate-700 text-white hover:bg-violet-600 transition-all flex items-center justify-center text-xs font-black">
                            +
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/50">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                            <span className="text-[7px] font-bold text-slate-400 uppercase">化学物料</span>
                        </div>
                        <p className="text-[7px] text-slate-500 font-bold">基准价</p>
                        <p className="text-sm font-black text-white font-mono">¥{data.materialTotal.toFixed(2)}</p>
                    </div>
                    <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700/50">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span className="text-[7px] font-bold text-slate-400 uppercase">运营/能源/折旧</span>
                        </div>
                        <button onClick={handleOpModelChange} className="text-[6px] font-black text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded mb-0.5 hover:bg-emerald-900 transition-colors">
                            {data.operationalModel === 'linear' ? '线性叠加' : '固定成本'}
                        </button>
                        <div className="flex items-center gap-1">
                            <span className="text-slate-500 text-xs font-bold">¥</span>
                            <input
                                type="number" step="0.1" min="0" value={data.operationalCost}
                                onChange={(e) => handleOpCostChange(parseFloat(e.target.value) || 0)}
                                className="w-16 bg-transparent text-sm font-black text-white font-mono outline-none"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
                    <div>
                        <p className="text-[7px] font-bold text-slate-500 uppercase">预估总投入 (TOTAL)</p>
                        <p className="text-lg font-black text-emerald-400 font-mono">
                            ¥{data.totalCost.toFixed(1)}
                            {activeDiscount > 0 && <span className="text-[8px] font-bold text-amber-400 ml-1.5">-{activeDiscount}%</span>}
                        </p>
                    </div>
                    <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 rounded-lg shadow-lg shadow-violet-500/20">
                        <p className="text-[6px] font-bold text-white/60 uppercase">单位成本 (每批次)</p>
                        <p className="text-lg font-black text-white font-mono">¥{data.unitCost.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            {/* ═══ 可视化区域 ═══ */}
            <div className="grid grid-cols-2 gap-4 mb-5 relative z-10">
                <div className="bg-white/80 rounded-lg p-3 border border-slate-100 shadow-sm">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                        <i className="fa-solid fa-chart-pie text-[6px] text-indigo-400"></i> 成本归因 (COST BREAKDOWN)
                    </p>
                    <CostPieChart
                        materialCost={data.materialTotal * data.batchCount}
                        opCost={data.operationalModel === 'linear' ? data.operationalCost * data.batchCount : data.operationalCost}
                    />
                </div>
                <div className="bg-white/80 rounded-lg p-3 border border-slate-100 shadow-sm">
                    <ScaleCurve data={data} />
                </div>
            </div>

            {/* ═══ 物料清单明细 ═══ */}
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                    <h6 className="text-[9px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-2">
                        <i className="fa-solid fa-list text-violet-500 text-[8px]"></i> 物料清单明细
                    </h6>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowAddForm(!showAddForm)} className="px-2.5 py-1 bg-violet-600 text-white rounded-lg text-[8px] font-black hover:bg-black transition-all shadow-sm flex items-center gap-1">
                            <i className="fa-solid fa-plus text-[7px]"></i>
                        </button>
                    </div>
                </div>

                {/* Add form */}
                {showAddForm && (
                    <div className="mb-3 p-3 bg-white rounded-xl border-2 border-violet-100 shadow-sm animate-reveal">
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <label className="text-[7px] font-bold text-slate-400 uppercase block mb-0.5">物料名称</label>
                                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="例: Zn(NO3)2·6H2O"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none focus:border-violet-400 normal-case"
                                />
                            </div>
                            <div className="w-16">
                                <label className="text-[7px] font-bold text-slate-400 uppercase block mb-0.5">用量</label>
                                <input type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="0"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold font-mono outline-none focus:border-violet-400 text-center"
                                />
                            </div>
                            <div className="w-14">
                                <label className="text-[7px] font-bold text-slate-400 uppercase block mb-0.5">单位</label>
                                <select value={newUnit} onChange={e => setNewUnit(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-1 py-1.5 text-[10px] font-bold outline-none focus:border-violet-400"
                                >
                                    <option value="G">G</option>
                                    <option value="ML">ML</option>
                                    <option value="PC">PC</option>
                                    <option value="KG">KG</option>
                                    <option value="L">L</option>
                                </select>
                            </div>
                            <div className="w-16">
                                <label className="text-[7px] font-bold text-slate-400 uppercase block mb-0.5">单价 ¥</label>
                                <input type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="自动"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold font-mono outline-none focus:border-violet-400 text-center"
                                />
                            </div>
                            <button onClick={handleAddMaterial} className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-[9px] font-black hover:bg-black transition-all shadow-sm shrink-0">
                                添加
                            </button>
                        </div>
                    </div>
                )}

                {/* Material list */}
                <div className="space-y-2">
                    {data.materials.map((mat) => {
                        const invMatch = mat.inventoryId ? inventory.find(i => i.id === mat.inventoryId) : null;
                        return (
                            <div key={mat.id} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-slate-100 shadow-sm group/mat hover:border-violet-200 hover:shadow-md transition-all">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-[10px] font-black text-slate-800 truncate normal-case">{mat.name}</p>
                                        {invMatch && (
                                            <span className="text-[6px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full shrink-0 border border-indigo-100">
                                                <i className="fa-solid fa-link text-[5px] mr-0.5"></i>库存
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[8px] font-bold text-slate-400 mt-0.5">
                                        用量: <input type="number" value={mat.amount} min="0" step="0.01"
                                            onChange={(e) => handleEditMaterial(mat.id, { amount: parseFloat(e.target.value) || 0 })}
                                            className="w-12 bg-transparent font-mono text-slate-600 outline-none text-center inline-block border-b border-dashed border-slate-200 focus:border-violet-400"
                                        /> {mat.unit}
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="flex items-center gap-0.5">
                                        <span className="text-[8px] text-slate-400">¥</span>
                                        <input type="number" value={mat.unitPrice} min="0" step="0.001"
                                            onChange={(e) => handleEditMaterial(mat.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                                            className="w-14 bg-transparent text-[10px] font-black font-mono text-violet-600 outline-none text-right border-b border-dashed border-transparent focus:border-violet-400"
                                        />
                                    </div>
                                    <p className="text-[9px] font-black text-slate-500 font-mono">¥{mat.subtotal.toFixed(2)}</p>
                                </div>
                                <button onClick={() => handleRemoveMaterial(mat.id)}
                                    className="w-6 h-6 rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all flex items-center justify-center opacity-0 group-hover/mat:opacity-100"
                                >
                                    <i className="fa-solid fa-times text-[8px]"></i>
                                </button>
                            </div>
                        );
                    })}

                    {data.materials.length === 0 && (
                        <div className="text-center py-6 text-slate-300">
                            <i className="fa-solid fa-box-open text-2xl mb-2 block"></i>
                            <p className="text-[9px] font-bold">暂无物料，点击 + 或 "自动识别物料" 添加</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ 规模效应折扣提示 ═══ */}
            {data.volumeDiscountRules && data.volumeDiscountRules.length > 0 && (
                <div className="mt-4 pt-3 border-t border-violet-100 relative z-10">
                    <p className="text-[7px] font-bold text-slate-400 italic flex items-center gap-1">
                        <i className="fa-solid fa-tags text-amber-400 text-[6px]"></i>
                        * 规模效应审计准则（含大宗折扣）
                        {data.volumeDiscountRules.map((r, i) => (
                            <span key={i} className="inline-flex items-center gap-0.5 ml-1 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-[6px] font-black border border-amber-100">
                                ≥{r.minBatch}批 -{r.discountPercent}%
                            </span>
                        ))}
                    </p>
                </div>
            )}
        </div>
    );
};
