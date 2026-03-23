
import React, { useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ParticleData, XrdPeakData, AnalysisMode } from './types';
import * as htmlToImage from 'html-to-image';
import saveAs from 'file-saver';

interface VisionResultsProps {
    mode: AnalysisMode;
    report: string | null;
    confidence: number;
    particles: ParticleData[];
    xrdPeaks: XrdPeakData[];
    isProcessing: boolean;
    scaleRatio: number | null;
    isCalibrating: boolean;
    onRunAnalysis: () => void;
    onExportCSV: () => void;
    onSaveReport: () => void;
    onExportWord?: () => void;
    onSyncToLog: () => void;
    onRunDeepReport?: () => void;
    onRunDeepRefinement?: () => void;
    isGeneratingAi?: boolean;
    aiReport?: string | null;
    isLinked?: boolean;
    onTraceLog?: () => void;
    semParticleDiagnostics?: {
        agglomerationRatio: number;
        rawComponentCount: number;
        finalParticleCount: number;
        splitAddedCount: number;
    } | null;
}

const VisionResults: React.FC<VisionResultsProps> = ({
    mode, report, confidence, particles, isProcessing, scaleRatio, isCalibrating,
    onRunAnalysis, onExportCSV, onSaveReport, onExportWord, onSyncToLog, onRunDeepRefinement,
    onRunDeepReport, isGeneratingAi, aiReport, isLinked, onTraceLog, semParticleDiagnostics
}) => {
    const reportRef = useRef<HTMLDivElement>(null);
    const cleanedAiReport = useMemo(() => {
        if (!aiReport) return aiReport;
        const cmdMap: Record<string, string> = {
            approx: '≈',
            cdot: '·',
            times: '×',
            mu: 'μ',
            alpha: 'α',
            beta: 'β',
            gamma: 'γ',
            delta: 'δ',
            theta: 'θ',
            lambda: 'λ',
            pm: '±',
            leq: '≤',
            geq: '≥'
        };
        const normalizeMath = (input: string) => {
            let s = input;
            s = s.replace(/\\text\{([^}]*)\}/g, '$1');
            s = s.replace(/\\mathrm\{([^}]*)\}/g, '$1');
            s = s.replace(/_\\?\{([^}]*)\}/g, '$1');
            s = s.replace(/\^\\?\{([^}]*)\}/g, '$1');
            s = s.replace(/_([A-Za-z0-9]+)/g, '$1');
            s = s.replace(/\^([A-Za-z0-9]+)/g, '$1');
            s = s.replace(/\\([A-Za-z]+)/g, (_, cmd: string) => cmdMap[cmd] ?? cmd);
            s = s.replace(/[{}]/g, '');
            return s;
        };
        let cleaned = aiReport.replace(/\$([^$]+)\$/g, (_, inner: string) => normalizeMath(inner));
        cleaned = cleaned.replace(/\\text\{([^}]*)\}/g, '$1');
        cleaned = cleaned.replace(/\\mathrm\{([^}]*)\}/g, '$1');
        return cleaned;
    }, [aiReport]);

    // --- Histogram Calculation ---
    const histogramData = useMemo(() => {
        if (particles.length === 0 || mode === 'XRD') return [];
        const values = particles.map(p => {
            if (p.realSize) return p.realSize;
            if (p.radiusX && p.radiusY) return 2 * Math.sqrt(p.radiusX * p.radiusY);
            return p.radius * 2;
        });
        if (values.length === 0) return [];
        const min = Math.min(...values);
        const max = Math.max(...values);
        const binCount = 12;
        const range = max - min || 1;
        const step = range / binCount;
        const bins = Array.from({ length: binCount }, (_, i) => ({
            rangeStart: min + i * step,
            rangeEnd: min + (i + 1) * step,
            name: (min + i * step + step / 2).toFixed(1),
            count: 0
        }));
        values.forEach(v => {
            const binIndex = Math.min(Math.floor((v - min) / step), binCount - 1);
            if (bins[binIndex]) bins[binIndex].count++;
        });
        return bins;
    }, [particles, mode]);

    return (
        <div className="w-full flex flex-col gap-3 h-full">
            {report ? (
                <div ref={reportRef} className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100 text-left animate-reveal flex flex-col overflow-hidden relative">
                    <div className="flex justify-between items-center mb-3 shrink-0">
                        <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><i className="fa-solid fa-chart-pie"></i> 分析报告</h4>
                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded text-white ${confidence > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}>置信度: {confidence.toFixed(0)}%</span>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                        <pre className="text-[10px] font-medium text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">{report}</pre>

                        {mode === 'SEM' && semParticleDiagnostics && (
                            <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                                <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-2">团聚与 Watershed 对比</p>
                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                    <div className="bg-white rounded-lg border border-amber-100 p-2">
                                        <div className="text-slate-400 text-[8px] uppercase font-black">团聚占比</div>
                                        <div className="text-amber-700 font-black text-base">{semParticleDiagnostics.agglomerationRatio.toFixed(1)}%</div>
                                    </div>
                                    <div className="bg-white rounded-lg border border-amber-100 p-2">
                                        <div className="text-slate-400 text-[8px] uppercase font-black">净增颗粒</div>
                                        <div className="text-amber-700 font-black text-base">+{semParticleDiagnostics.splitAddedCount}</div>
                                    </div>
                                    <div className="bg-white rounded-lg border border-amber-100 p-2">
                                        <div className="text-slate-400 text-[8px] uppercase font-black">拆分前</div>
                                        <div className="text-slate-700 font-black">{semParticleDiagnostics.rawComponentCount} 个</div>
                                    </div>
                                    <div className="bg-white rounded-lg border border-amber-100 p-2">
                                        <div className="text-slate-400 text-[8px] uppercase font-black">拆分后</div>
                                        <div className="text-slate-700 font-black">{semParticleDiagnostics.finalParticleCount} 个</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Particle Size Distribution Histogram */}
                        {particles.length > 0 && mode !== 'XRD' && (
                            <div className="bg-white p-3 rounded-xl border border-indigo-50 shadow-inner">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">粒径分布直方图</p>
                                <div className="h-36 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={histogramData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                            <XAxis dataKey="name" tick={{ fontSize: 8 }} interval={0} axisLine={false} tickLine={false} />
                                            <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ fontSize: '9px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                                            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]}>
                                                {histogramData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#6366f1' : '#818cf8'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* AI Deep Analysis Section */}
                        {cleanedAiReport && (
                            <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                                <h5 className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <i className="fa-solid fa-sparkles"></i> AI 深度关联分析
                                </h5>
                                <div className="text-[10px] text-slate-700 leading-relaxed prose prose-sm prose-indigo max-w-none
                                    prose-headings:font-black prose-headings:text-indigo-900 prose-headings:mt-3 prose-headings:mb-1
                                    prose-h3:text-xs prose-h4:text-[11px] prose-p:mb-2 prose-ul:mb-2 prose-ol:mb-2
                                    prose-li:my-0.5 prose-strong:text-indigo-700">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {cleanedAiReport}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 bg-slate-50 rounded-xl border border-slate-100 flex flex-col items-center justify-center p-6 text-slate-400 gap-3">
                    <i className="fa-solid fa-magnifying-glass-chart text-3xl opacity-20"></i>
                    <p className="text-[10px] font-black uppercase tracking-widest">等待分析指令</p>
                    <div className="text-[9px] text-center italic opacity-70">
                        {isCalibrating ? "请在图片上拖拽绘制已知长度的线段..." : "使用左侧工具栏启动智能分析"}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VisionResults;
