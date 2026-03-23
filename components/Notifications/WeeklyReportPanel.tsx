import React, { useState } from 'react';
import { WeeklyReport } from '../../types';
import { generateWeeklyReport } from '../../services/gemini/notification';
import ReactMarkdown from 'react-markdown';

interface WeeklyReportPanelProps {
    weeklyReports: WeeklyReport[];
    currentWeekHasReport: boolean;
    onAddWeeklyReport: (report: WeeklyReport) => void;
    onBack: () => void;
    projectTitle: string;
    milestones: any[];
    recentLogs: any[];
    inventoryAlerts: any[];
    literatureCount: number;
    language: 'zh' | 'en';
}

function getWeekLabel(date: Date = new Date()): string {
    const year = date.getFullYear();
    const oneJan = new Date(year, 0, 1);
    const dayOfYear = Math.ceil((date.getTime() - oneJan.getTime()) / 86400000);
    const weekNum = Math.ceil(dayOfYear / 7);
    return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

const WeeklyReportPanel: React.FC<WeeklyReportPanelProps> = ({
    weeklyReports, currentWeekHasReport, onAddWeeklyReport, onBack,
    projectTitle, milestones, recentLogs, inventoryAlerts, literatureCount, language
}) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [viewingReport, setViewingReport] = useState<WeeklyReport | null>(
        currentWeekHasReport ? weeklyReports.find(r => r.weekLabel === getWeekLabel()) || null : null
    );

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const weekLabel = getWeekLabel();
            const content = await generateWeeklyReport({
                projectTitle,
                milestones: milestones.map(m => ({
                    title: m.title || '',
                    status: m.status || 'pending',
                    dueDate: m.dueDate || ''
                })),
                recentLogs: recentLogs.slice(0, 20).map(l => ({
                    timestamp: l.timestamp || '',
                    description: l.description || l.content || '',
                    result: l.result || 'neutral',
                    sampleId: l.sampleId
                })),
                inventoryAlerts: inventoryAlerts.map(a => ({
                    name: a.name,
                    quantity: a.quantity,
                    threshold: a.threshold,
                    unit: a.unit
                })),
                literatureCount,
                weekLabel
            }, language);

            const report: WeeklyReport = {
                id: `report_${Date.now()}`,
                weekLabel,
                generatedAt: new Date().toISOString(),
                content,
                stats: {
                    experimentsCompleted: recentLogs.filter((l: any) => l.result === 'success').length,
                    milestonesUpdated: milestones.filter((m: any) => m.status === 'in-progress' || m.status === 'completed').length,
                    literatureAdded: literatureCount,
                    inventoryAlerts: inventoryAlerts.length
                }
            };
            onAddWeeklyReport(report);
            setViewingReport(report);
        } catch (err) {
            console.error('周报生成失败:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[5000] flex justify-end" onClick={onBack}>
            <div className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-reveal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <header className="px-6 py-5 bg-gradient-to-r from-teal-700 to-emerald-700 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all">
                            <i className="fa-solid fa-arrow-left" />
                        </button>
                        <div>
                            <h3 className="text-lg font-black uppercase italic tracking-tight">AI 实验周报</h3>
                            <p className="text-[8px] font-black text-teal-300 uppercase tracking-[0.2rem]">Weekly Experiment Report</p>
                        </div>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="px-4 py-2.5 bg-white/20 rounded-xl text-[9px] font-black uppercase hover:bg-white/30 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {isGenerating ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-wand-magic-sparkles" />}
                        {isGenerating ? '生成中...' : currentWeekHasReport ? '重新生成' : '生成本周周报'}
                    </button>
                </header>

                {/* 查看区 */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {isGenerating ? (
                        <div className="h-full flex flex-col items-center justify-center gap-6 animate-pulse">
                            <div className="relative">
                                <div className="w-20 h-20 rounded-[1.5rem] border-4 border-teal-500 border-t-transparent animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <i className="fa-solid fa-robot text-teal-500 text-2xl animate-pulse" />
                                </div>
                            </div>
                            <div className="text-center space-y-1">
                                <h4 className="text-base font-black text-slate-800 uppercase italic">AI 正在撰写周报</h4>
                                <p className="text-[10px] font-bold text-slate-400">分析实验数据、里程碑进展、库存状态...</p>
                            </div>
                        </div>
                    ) : viewingReport ? (
                        <div className="p-6 space-y-6">
                            {/* 统计卡 */}
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { label: '实验', value: viewingReport.stats.experimentsCompleted, icon: 'fa-flask', color: 'text-emerald-500' },
                                    { label: '里程碑', value: viewingReport.stats.milestonesUpdated, icon: 'fa-flag', color: 'text-violet-500' },
                                    { label: '文献', value: viewingReport.stats.literatureAdded, icon: 'fa-book', color: 'text-indigo-500' },
                                    { label: '预警', value: viewingReport.stats.inventoryAlerts, icon: 'fa-triangle-exclamation', color: 'text-amber-500' },
                                ].map(s => (
                                    <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                                        <i className={`fa-solid ${s.icon} ${s.color} text-sm mb-1`} />
                                        <div className="text-lg font-black text-slate-800">{s.value}</div>
                                        <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* 周报内容 */}
                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 shadow-inner">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-[9px] font-black text-teal-600 uppercase tracking-widest">{viewingReport.weekLabel}</span>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(viewingReport.content)}
                                        className="px-3 py-1 bg-white rounded-lg text-[8px] font-black text-slate-400 uppercase border border-slate-200 hover:text-teal-600 hover:border-teal-300 transition-all"
                                    >
                                        <i className="fa-solid fa-copy mr-1" />复制
                                    </button>
                                </div>
                                <div className="prose prose-sm prose-slate max-w-none">
                                    <ReactMarkdown>{viewingReport.content}</ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 gap-6 px-8">
                            <i className="fa-solid fa-file-circle-plus text-6xl" />
                            <div className="text-center space-y-2">
                                <p className="text-sm font-black uppercase tracking-[0.2rem]">尚未生成本周周报</p>
                                <p className="text-[10px] font-medium text-slate-500">点击右上角按钮，AI 将基于本周实验数据自动生成周报</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* 历史周报列表 */}
                {weeklyReports.length > 0 && !isGenerating && (
                    <div className="border-t border-slate-100 p-4 shrink-0 max-h-40 overflow-y-auto">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">历史周报</p>
                        <div className="space-y-1">
                            {weeklyReports.map(r => (
                                <button
                                    key={r.id}
                                    onClick={() => setViewingReport(r)}
                                    className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all text-left ${
                                        viewingReport?.id === r.id ? 'bg-teal-50 border border-teal-200' : 'bg-slate-50 hover:bg-slate-100 border border-transparent'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <i className="fa-solid fa-file-lines text-teal-400 text-[10px]" />
                                        <span className="text-[10px] font-black text-slate-600">{r.weekLabel}</span>
                                    </div>
                                    <span className="text-[8px] font-bold text-slate-300">{new Date(r.generatedAt).toLocaleDateString()}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WeeklyReportPanel;
