import React, { useMemo } from 'react';
import { TransformationProposal } from '../../../types';

interface RouteComparisonModalProps {
    onClose: () => void;
    comparedProposals: TransformationProposal[];
    comparisonData: { key: string; val1: string; val2: string; isDiff: boolean }[] | null;
}

// ═══ SVG 雷达图组件 ═══
const RadarChart: React.FC<{ data1: number[]; data2: number[]; labels: string[] }> = ({ data1, data2, labels }) => {
    const cx = 120, cy = 120, r = 80;
    const n = labels.length;

    const getPoint = (value: number, index: number) => {
        const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
        const x = cx + (r * value / 100) * Math.cos(angle);
        const y = cy + (r * value / 100) * Math.sin(angle);
        return { x, y };
    };

    const createPath = (values: number[]) => {
        const points = values.map((v, i) => getPoint(v, i));
        return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
    };

    const gridLevels = [20, 40, 60, 80, 100];

    return (
        <svg viewBox="0 0 240 240" className="w-full max-w-[200px] mx-auto">
            {/* 背景网格 */}
            {gridLevels.map(level => (
                <polygon key={level}
                    points={Array.from({ length: n }, (_, i) => {
                        const p = getPoint(level, i);
                        return `${p.x},${p.y}`;
                    }).join(' ')}
                    fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
            ))}
            {/* 轴线 */}
            {labels.map((_, i) => {
                const p = getPoint(100, i);
                return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth="0.5" />;
            })}
            {/* 数据区域 1 - 方案 A */}
            <path d={createPath(data1)} fill="rgba(99, 102, 241, 0.15)" stroke="#6366f1" strokeWidth="2" />
            {data1.map((v, i) => {
                const p = getPoint(v, i);
                return <circle key={i} cx={p.x} cy={p.y} r="3" fill="#6366f1" />;
            })}
            {/* 数据区域 2 - 方案 B */}
            <path d={createPath(data2)} fill="rgba(168, 85, 247, 0.15)" stroke="#a855f7" strokeWidth="2" strokeDasharray="4 2" />
            {data2.map((v, i) => {
                const p = getPoint(v, i);
                return <circle key={i} cx={p.x} cy={p.y} r="3" fill="#a855f7" />;
            })}
            {/* 标签 */}
            {labels.map((label, i) => {
                const p = getPoint(115, i);
                return (
                    <text key={i} x={p.x} y={p.y}
                        textAnchor="middle" dominantBaseline="middle"
                        className="text-[7px] font-black fill-slate-600 uppercase">
                        {label}
                    </text>
                );
            })}
        </svg>
    );
};

// ═══ 路线维度评估 ═══
const evaluateProposal = (prop: TransformationProposal) => {
    const steps = prop.newFlowchart || [];
    const allParams = [...(prop.optimizedParameters || []), ...(prop.controlParameters || [])];
    const hypothesis = prop.scientificHypothesis || '';
    const processText = `${prop.processChanges || ''} ${steps.map(s => s.action).join(' ')}`;

    // 步骤完整度 (0-100)
    const stepsScore = steps.length === 0 ? 0 : Math.min(100, (steps.filter(s => s.action && s.action.length > 10).length / steps.length) * 100);

    // 参数覆盖 (0-100)
    const paramScore = Math.min(100, allParams.filter(p => p.key && p.value).length * 15);

    // 安全性 (0-100, 越高越安全)
    const HIGH_RISK = ['高压', '氢气', '剧毒', '浓硝酸', '浓硫酸', 'HF'];
    const MED_RISK = ['高温', '还原剂', '有机溶剂'];
    const highCount = HIGH_RISK.filter(kw => processText.includes(kw)).length;
    const medCount = MED_RISK.filter(kw => processText.includes(kw)).length;
    const safetyScore = Math.max(0, 100 - highCount * 25 - medCount * 10);

    // 文献支撑 (0-100)
    const litScore = (prop.literatureId && !['MANUAL', 'FLOW_GEN'].includes(prop.literatureId) ? 60 : 0)
        + (hypothesis.length > 50 ? 40 : hypothesis.length > 20 ? 20 : 0);

    // 资源就绪 (0-100)
    const audit = prop.resourceAudit;
    let resourceScore = 50; // 默认
    if (audit) {
        const all = [...(audit.reagents || []), ...(audit.equipment || [])];
        const ready = all.filter((i: any) => i.status === 'ready').length;
        resourceScore = all.length > 0 ? (ready / all.length) * 100 : 50;
    }

    return {
        steps: Math.round(stepsScore),
        params: Math.round(paramScore),
        safety: Math.round(safetyScore),
        literature: Math.round(litScore),
        resources: Math.round(resourceScore),
        overall: Math.round((stepsScore + paramScore + safetyScore + litScore + resourceScore) / 5),
    };
};

export const RouteComparisonModal: React.FC<RouteComparisonModalProps> = ({
    onClose, comparedProposals, comparisonData
}) => {
    if (!comparisonData || comparedProposals.length !== 2) return null;

    const eval1 = useMemo(() => evaluateProposal(comparedProposals[0]), [comparedProposals]);
    const eval2 = useMemo(() => evaluateProposal(comparedProposals[1]), [comparedProposals]);

    const radarLabels = ['步骤', '参数', '安全', '文献', '资源'];
    const radarData1 = [eval1.steps, eval1.params, eval1.safety, eval1.literature, eval1.resources];
    const radarData2 = [eval2.steps, eval2.params, eval2.safety, eval2.literature, eval2.resources];

    const winner = eval1.overall > eval2.overall ? 0 : eval1.overall < eval2.overall ? 1 : -1;

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-[3rem] p-8 animate-reveal shadow-2xl relative border-4 border-white overflow-hidden flex flex-col max-h-[85vh]">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter border-l-4 border-amber-500 pl-4">工艺路线深度对比</h3>
                    <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><i className="fa-solid fa-times"></i></button>
                </div>

                {/* 雷达图 + 综合评分 */}
                <div className="grid grid-cols-3 gap-6 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    {/* 方案 A */}
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                            <p className="text-[10px] font-black text-indigo-600 truncate uppercase">{comparedProposals[0].title}</p>
                        </div>
                        <div className={`text-3xl font-black font-mono ${eval1.overall >= eval2.overall ? 'text-indigo-600' : 'text-slate-400'}`}>
                            {eval1.overall}
                            <span className="text-[10px] text-slate-300 font-normal">/100</span>
                        </div>
                        {winner === 0 && <span className="text-[8px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full uppercase mt-1 inline-block">★ 推荐</span>}
                    </div>

                    {/* 雷达图 */}
                    <div>
                        <RadarChart data1={radarData1} data2={radarData2} labels={radarLabels} />
                    </div>

                    {/* 方案 B */}
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <div className="w-3 h-3 rounded-full bg-violet-500"></div>
                            <p className="text-[10px] font-black text-violet-600 truncate uppercase">{comparedProposals[1].title}</p>
                        </div>
                        <div className={`text-3xl font-black font-mono ${eval2.overall >= eval1.overall ? 'text-violet-600' : 'text-slate-400'}`}>
                            {eval2.overall}
                            <span className="text-[10px] text-slate-300 font-normal">/100</span>
                        </div>
                        {winner === 1 && <span className="text-[8px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full uppercase mt-1 inline-block">★ 推荐</span>}
                    </div>
                </div>

                {/* 维度对比条 */}
                <div className="grid grid-cols-5 gap-3 mb-6 px-2">
                    {radarLabels.map((label, i) => {
                        const v1 = radarData1[i];
                        const v2 = radarData2[i];
                        return (
                            <div key={i} className="bg-slate-50 rounded-xl p-2 border border-slate-100">
                                <p className="text-[7px] font-black text-slate-400 uppercase text-center mb-1.5">{label}</p>
                                <div className="flex items-center gap-1">
                                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden flex justify-end">
                                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${v1}%` }}></div>
                                    </div>
                                    <span className="text-[8px] font-black text-indigo-600 w-6 text-center">{v1}</span>
                                </div>
                                <div className="flex items-center gap-1 mt-1">
                                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden flex justify-end">
                                        <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${v2}%` }}></div>
                                    </div>
                                    <span className="text-[8px] font-black text-violet-600 w-6 text-center">{v2}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 参数表头 */}
                <div className="grid grid-cols-3 gap-4 mb-4 border-b border-slate-100 pb-4">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center self-end">Key Parameter</div>
                    <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-center">
                        <p className="text-[9px] font-black text-indigo-600 truncate">{comparedProposals[0].title}</p>
                    </div>
                    <div className="bg-violet-50 p-3 rounded-xl border border-violet-100 text-center">
                        <p className="text-[9px] font-black text-violet-600 truncate">{comparedProposals[1].title}</p>
                    </div>
                </div>

                {/* 参数对比表 */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    {comparisonData.map((row, idx) => (
                        <div key={idx} className={`grid grid-cols-3 gap-4 p-3 rounded-xl items-center ${row.isDiff ? 'bg-amber-50/50 border border-amber-100' : 'border-b border-slate-50'}`}>
                            <div className="text-[10px] font-bold text-slate-600 text-center normal-case">{row.key}</div>
                            <div className={`text-[11px] font-black text-center ${row.isDiff ? 'text-indigo-700' : 'text-slate-400'}`}>{row.val1}</div>
                            <div className={`text-[11px] font-black text-center ${row.isDiff ? 'text-violet-700' : 'text-slate-400'}`}>{row.val2}</div>
                        </div>
                    ))}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                    <button onClick={onClose} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase">Close Comparison</button>
                </div>
            </div>
        </div>
    );
};