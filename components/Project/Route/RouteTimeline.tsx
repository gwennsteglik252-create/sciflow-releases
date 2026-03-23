
import React, { useMemo } from 'react';

interface TimelineStep {
    step: string;
    action: string;
    duration?: number; // 预计耗时（分钟）
    durationUnit?: 'min' | 'h';
}

interface RouteTimelineProps {
    steps: TimelineStep[];
    isEditing: boolean;
    onUpdate: (next: TimelineStep[]) => void;
}

// ═══ AI 预估步骤耗时 —— 基于关键词启发式算法 ═══
const estimateDuration = (step: TimelineStep): { minutes: number; label: string; confidence: 'high' | 'medium' | 'low' } => {
    // 如果用户已手动设置，直接使用
    if (step.duration && step.duration > 0) {
        const mins = step.durationUnit === 'h' ? step.duration * 60 : step.duration;
        return { minutes: mins, label: formatDuration(mins), confidence: 'high' };
    }

    const text = `${step.step} ${step.action}`.toLowerCase();

    // 从文本中提取时间信息
    const timePatterns = [
        { regex: /(\d+(?:\.\d+)?)\s*(?:小时|h|hr|hours?)/i, multiplier: 60 },
        { regex: /(\d+(?:\.\d+)?)\s*(?:分钟|min|minutes?|分)/i, multiplier: 1 },
        { regex: /(\d+(?:\.\d+)?)\s*(?:天|days?|d)\b/i, multiplier: 1440 },
        { regex: /(\d+(?:\.\d+)?)\s*(?:s|秒|sec)/i, multiplier: 1 / 60 },
    ];

    for (const pattern of timePatterns) {
        const match = text.match(pattern.regex);
        if (match) {
            const minutes = parseFloat(match[1]) * pattern.multiplier;
            return { minutes, label: formatDuration(minutes), confidence: 'high' };
        }
    }

    // 基于操作类型的启发式估算
    const estimates: [RegExp, number][] = [
        [/搅拌|stirr|agitat|混合|mix/i, 30],
        [/煅烧|calcin|sinter|退火|anneal/i, 180],
        [/干燥|drying|烘干/i, 120],
        [/水热|hydrothermal|solvothermal/i, 720],
        [/离心|centrifug/i, 15],
        [/洗涤|wash|清洗/i, 20],
        [/过滤|filter|抽滤/i, 10],
        [/称量|weigh/i, 5],
        [/溶解|dissolve/i, 15],
        [/超声|ultrason|sonication/i, 30],
        [/蒸发|evaporat|浓缩/i, 60],
        [/冷却|cool|降温/i, 30],
        [/涂覆|coat|镀|沉积|deposit/i, 45],
        [/研磨|grind|ball mill|球磨/i, 60],
        [/检测|测试|test|characteriz/i, 60],
    ];

    for (const [pattern, defaultMins] of estimates) {
        if (pattern.test(text)) {
            return { minutes: defaultMins, label: formatDuration(defaultMins), confidence: 'medium' };
        }
    }

    return { minutes: 30, label: '~30min', confidence: 'low' };
};

const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${Math.round(minutes)}min`;
    if (minutes < 1440) {
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        return m > 0 ? `${h}h ${m}min` : `${h}h`;
    }
    const d = Math.floor(minutes / 1440);
    const h = Math.round((minutes % 1440) / 60);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
};

const STEP_COLORS = [
    'bg-indigo-500', 'bg-violet-500', 'bg-sky-500', 'bg-emerald-500',
    'bg-amber-500', 'bg-rose-500', 'bg-teal-500', 'bg-orange-500',
];

export const RouteTimeline: React.FC<RouteTimelineProps> = ({ steps, isEditing, onUpdate }) => {
    const handleAddStep = () => onUpdate([...(steps || []), { step: 'New Step', action: '', duration: 0, durationUnit: 'min' }]);
    const handleRemoveStep = (idx: number) => onUpdate((steps || []).filter((_, i) => i !== idx));
    const handleUpdateStep = (idx: number, updates: Partial<TimelineStep>) => {
        const next = [...(steps || [])];
        next[idx] = { ...next[idx], ...updates };
        onUpdate(next);
    };

    const timeEstimates = useMemo(() => (steps || []).map(s => estimateDuration(s)), [steps]);
    const totalMinutes = useMemo(() => timeEstimates.reduce((acc, t) => acc + t.minutes, 0), [timeEstimates]);

    return (
        <div className="border-r-2 border-dashed border-slate-100 pr-6">
            <div className="flex justify-between items-center mb-3">
                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-timeline text-indigo-500"></i> 工艺流程演进 (STEPS)
                </h5>
                <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 flex items-center gap-1">
                        <i className="fa-solid fa-clock text-[7px]"></i>
                        预估: {formatDuration(totalMinutes)}
                    </span>
                    {isEditing && (
                        <button onClick={handleAddStep} className="text-[8px] font-black text-indigo-600 uppercase bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-600 hover:text-white transition-all">+ Add Step</button>
                    )}
                </div>
            </div>

            {/* ═══ 迷你甘特图 ═══ */}
            {steps && steps.length > 0 && totalMinutes > 0 && (
                <div className="mb-5 p-3 bg-slate-900 rounded-lg border border-slate-800 shadow-lg">
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <i className="fa-solid fa-bars-progress text-indigo-400 text-[6px]"></i> Gantt Timeline
                        </p>
                        <p className="text-[7px] font-mono font-bold text-slate-500">
                            Total: {formatDuration(totalMinutes)}
                        </p>
                    </div>
                    <div className="flex rounded-xl overflow-hidden h-5 bg-slate-800 border border-slate-700">
                        {timeEstimates.map((est, idx) => {
                            const pct = (est.minutes / totalMinutes) * 100;
                            if (pct < 1) return null;
                            const colorClass = STEP_COLORS[idx % STEP_COLORS.length];
                            return (
                                <div
                                    key={`gantt-${idx}-${steps[idx]?.step}`}
                                    className={`${colorClass} relative group/bar flex items-center justify-center overflow-hidden transition-all hover:brightness-110`}
                                    style={{ width: `${pct}%`, minWidth: pct > 3 ? undefined : '6px' }}
                                    title={`Step ${idx + 1}: ${steps[idx]?.step} — ${est.label}`}
                                >
                                    {pct > 8 && (
                                        <span className="text-[6px] font-black text-white/80 truncate px-0.5">
                                            {idx + 1}
                                        </span>
                                    )}
                                    {/* Tooltip */}
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-slate-800 px-2 py-0.5 rounded-lg shadow-xl text-[7px] font-bold whitespace-nowrap opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-20 border border-slate-100">
                                        {steps[idx]?.step}: {est.label}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {/* 图例 */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                        {timeEstimates.map((est, idx) => (
                            <div key={`legend-${idx}-${steps[idx]?.step}`} className="flex items-center gap-1">
                                <div className={`w-2 h-2 rounded-sm ${STEP_COLORS[idx % STEP_COLORS.length]}`}></div>
                                <span className="text-[6px] font-bold text-slate-500 truncate max-w-[60px]">{steps[idx]?.step}</span>
                                <span className={`text-[6px] font-mono ${est.confidence === 'high' ? 'text-emerald-400' : est.confidence === 'medium' ? 'text-amber-400' : 'text-slate-500'}`}>
                                    {est.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ 步骤列表 ═══ */}
            <div className="relative pl-3 space-y-0">
                {/* 主干连接线 */}
                <div className="absolute left-[18px] top-2 bottom-6 w-0 border-l-4 border-dashed border-indigo-100 opacity-60"></div>
                {(steps || []).map((step, idx) => {
                    const est = timeEstimates[idx];
                    return (
                        <div key={`step-${idx}-${step.step}`} className="relative flex gap-5 items-start mb-8 last:mb-0 group/step">
                            <div className="w-9 h-9 rounded-xl bg-white border-2 border-indigo-200 flex items-center justify-center font-black text-[11px] text-indigo-600 shrink-0 shadow-sm z-10 group-hover/step:border-indigo-600 group-hover/step:scale-110 group-hover/step:shadow-lg transition-all duration-300">
                                {idx + 1}
                            </div>
                            <div className="flex-1 bg-slate-50 p-4 rounded-lg border-2 border-white shadow-sm group-hover/step:shadow-md group-hover/step:bg-white transition-all relative">
                                {isEditing ? (
                                    <div className="space-y-3">
                                        <div className="flex justify-between gap-3">
                                            <input className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-black normal-case outline-none focus:border-indigo-500 shadow-inner" value={step.step} onChange={e => handleUpdateStep(idx, { step: e.target.value })} />
                                            {/* 时间输入 */}
                                            <div className="flex items-center gap-1 bg-white border border-indigo-100 rounded-lg px-2 py-1 shadow-inner shrink-0">
                                                <i className="fa-solid fa-clock text-[8px] text-indigo-400"></i>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="w-10 bg-transparent text-[10px] font-black font-mono text-indigo-700 outline-none text-center"
                                                    value={step.duration || ''}
                                                    placeholder="0"
                                                    onChange={e => handleUpdateStep(idx, { duration: parseFloat(e.target.value) || 0 })}
                                                />
                                                <button
                                                    onClick={() => handleUpdateStep(idx, { durationUnit: step.durationUnit === 'h' ? 'min' : 'h' })}
                                                    className="text-[7px] font-black text-indigo-400 bg-indigo-50 px-1 py-0.5 rounded hover:bg-indigo-500 hover:text-white transition-all"
                                                >
                                                    {step.durationUnit || 'min'}
                                                </button>
                                            </div>
                                            <button onClick={() => handleRemoveStep(idx)} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"><i className="fa-solid fa-times"></i></button>
                                        </div>
                                        <textarea className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-medium italic outline-none focus:border-indigo-500 shadow-inner resize-none h-16" value={step.action} onChange={e => handleUpdateStep(idx, { action: e.target.value })} />
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex justify-between items-start mb-1.5">
                                            <p className="text-[10px] font-black text-slate-800 normal-case tracking-tight">{step.step}</p>
                                            {est && (
                                                <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded-lg shrink-0 flex items-center gap-0.5 ${est.confidence === 'high' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                    : est.confidence === 'medium' ? 'bg-amber-50 text-amber-600 border border-amber-100'
                                                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                                                    }`}>
                                                    <i className={`fa-solid fa-clock text-[6px] ${est.confidence === 'low' ? 'opacity-50' : ''}`}></i>
                                                    {est.label}
                                                    {est.confidence !== 'high' && <span className="text-[5px] opacity-60">≈</span>}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[9.5px] text-slate-500 font-bold leading-relaxed italic text-justify">{step.action}</p>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
