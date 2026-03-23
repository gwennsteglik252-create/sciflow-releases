
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ResearchProject } from '../../types';
import { usePptLogic, ReportLevel, Slide, parseLogTime, buildNumericMetricMap } from '../../hooks/usePptLogic';
import { useFileExport } from '../../hooks/useFileExport';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface ScientificPresenterProps {
  project: ResearchProject;
}

// ── LaTeX renderer ──
const LaTeXText: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(\$.*?\$)/);
  return (
    <span className="text-[10px] leading-relaxed text-slate-700 font-serif text-justify">
      {parts.map((part, i) => {
        if (part.startsWith('$') && part.endsWith('$')) {
          return <span key={i} className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1 mx-0.5 rounded border border-indigo-100">{part.slice(1, -1)}</span>;
        }
        return part;
      })}
    </span>
  );
};

// ── Success Rate Ring ──
const SuccessRateRing: React.FC<{ rate: number }> = ({ rate }) => {
  const r = 20, stroke = 4;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * rate) / 100;
  const color = rate >= 70 ? '#22c55e' : rate >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 26 26)"
          className="transition-all duration-700" />
        <text x="26" y="26" textAnchor="middle" dominantBaseline="central"
          className="text-[10px] font-black" fill={color}>{rate}%</text>
      </svg>
      <span className="text-[9px] font-bold text-slate-500 uppercase">Success</span>
    </div>
  );
};

// ── Mini Trend Chart ──
const MiniTrendChart: React.FC<{ data: { date: string; value: number }[]; name: string; color: string }> = ({ data, name, color }) => (
  <div className="bg-slate-50/70 rounded-xl p-3 border border-slate-100">
    <p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-wider">{name}</p>
    <ResponsiveContainer width="100%" height={80}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 7 }} stroke="#cbd5e1" />
        <YAxis tick={{ fontSize: 7 }} stroke="#cbd5e1" width={35} />
        <Tooltip contentStyle={{ fontSize: 9, borderRadius: 8, border: '1px solid #e2e8f0' }} />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

const CHART_COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444'];

const LEVEL_LABELS: Record<ReportLevel, string> = {
  weekly: '\u5468\u62A5',
  monthly: '\u6708\u62A5',
  final: '\u7ED3\u9898',
  seminar: '\u7EC4\u4F1A',
  defense: '\u7B54\u8FA9'
};

const ScientificPresenter: React.FC<ScientificPresenterProps> = ({ project }) => {
  const {
    startDate, setStartDate,
    endDate, setEndDate,
    reportLevel, handleLevelChange,
    isGenerating,
    slides,
    handleGenerate,
    getVbaScript,
    getMarkdown,
    filteredLogs,
    logSourceMode
  } = usePptLogic(project);

  const { handleSecureSave } = useFileExport();

  // ── Editable slide state ──
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [editingPoint, setEditingPoint] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  // ── Quick start: auto-generate after level change ──
  const pendingQuickStart = useRef(false);
  useEffect(() => {
    if (pendingQuickStart.current && filteredLogs.length > 0 && !isGenerating) {
      pendingQuickStart.current = false;
      handleGenerate();
    }
  }, [filteredLogs, isGenerating]);

  const quickStart = (level: ReportLevel) => {
    pendingQuickStart.current = true;
    handleLevelChange(level);
  };

  // ── Date stats for empty state ──
  const dateStats = useMemo(() => {
    const allLogs = project.milestones.flatMap(m => m.logs);
    const verifiedLogs = allLogs.filter(l => String(l.status || '').trim().toLowerCase() === 'verified');
    let earliest = '', latest = '';
    if (allLogs.length > 0) {
      const sorted = [...allLogs].sort((a, b) => parseLogTime(a.timestamp) - parseLogTime(b.timestamp));
      earliest = sorted[0]?.timestamp || '';
      latest = sorted[sorted.length - 1]?.timestamp || '';
    }
    return { total: allLogs.length, verified: verifiedLogs.length, earliest, latest };
  }, [project]);

  const topMetricNames = useMemo(() => {
    const allLogs = project.milestones.flatMap(m => m.logs);
    const map = buildNumericMetricMap(allLogs);
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 3).map(([name]) => name);
  }, [project]);

  // ── File export helpers ──
  const getStandardFileName = (ext: string) => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const safeTitle = project.title.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
    return `${safeTitle}_\u7814\u62A5_${dateStr}.${ext}`;
  };

  const onExportVBA = () => {
    const script = getVbaScript();
    if (!script) return;
    const blob = new Blob([script], { type: "text/plain;charset=utf-8" });
    handleSecureSave(getStandardFileName('vbs'), blob);
  };

  const onExportMarkdown = () => {
    const md = getMarkdown();
    if (!md) return;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    handleSecureSave(getStandardFileName('md'), blob);
  };

  const onExportPDF = useCallback(async () => {
    if (slides.length === 0) return;
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [254, 190.5] });
      slides.forEach((slide, idx) => {
        if (idx > 0) doc.addPage();
        doc.setFontSize(18);
        doc.text(slide.title, 20, 25);
        if (slide.subTitle) {
          doc.setFontSize(10);
          doc.setTextColor(100);
          doc.text(slide.subTitle, 20, 34);
          doc.setTextColor(0);
        }
        doc.setFontSize(10);
        slide.points.forEach((p, pi) => {
          const y = (slide.subTitle ? 44 : 38) + pi * 8;
          if (y < 175) doc.text(`\u2022 ${p}`, 24, y, { maxWidth: 210 });
        });
      });
      const pdfBlob = doc.output('blob');
      handleSecureSave(getStandardFileName('pdf'), pdfBlob);
    } catch (err) {
      console.error('PDF export error:', err);
    }
  }, [slides, handleSecureSave, getStandardFileName]);

  // ── Edit handlers ──
  const startEdit = (slideIdx: number, pointIdx: number, text: string) => {
    setEditingSlide(slideIdx);
    setEditingPoint(pointIdx);
    setEditText(text);
  };

  const commitEdit = () => {
    if (editingSlide !== null && editingPoint !== null) {
      const s = slides[editingSlide];
      if (s) s.points[editingPoint] = editText;
    }
    setEditingSlide(null);
    setEditingPoint(null);
    setEditText('');
  };

  const reportLabel = LEVEL_LABELS[reportLevel];
  const disableGenerate = isGenerating || filteredLogs.length === 0;
  const disabledReason = isGenerating
    ? '\u6B63\u5728\u751F\u6210\u4E2D\uFF0C\u8BF7\u7A0D\u5019'
    : filteredLogs.length === 0
      ? '\u5F53\u524D\u65F6\u95F4\u8303\u56F4\u5185\u6CA1\u6709\u53EF\u7528\u5B9E\u9A8C\u65E5\u5FD7'
      : '';
  const generateButtonText = isGenerating ? 'AI \u63D0\u70BC\u4E2D...' : `\u751F\u6210${reportLabel} PPT`;

  return (
    <div className="flex-1 p-6 lg:p-10 bg-white/80 backdrop-blur-xl rounded-[3rem] border border-slate-200 shadow-sm animate-reveal flex flex-col h-full overflow-hidden relative">

      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-6 mb-8 shrink-0">
        <div>
          <h3 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter border-l-4 border-indigo-600 pl-4 mb-2">{'\u6210\u679C\u8F6C\u5316\u4E2D\u5FC3'}</h3>
          <div className="flex items-center gap-2 pl-5">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Verified Data to Scientific Slides</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-end gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <div className="flex flex-col gap-1">
            <label className="text-[8px] font-black text-slate-400 uppercase px-1">{'\u65F6\u95F4\u8DE8\u5EA6'}</label>
            <div className="flex items-center gap-2">
              <input type="date" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:border-indigo-400" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <span className="text-slate-300">-</span>
              <input type="date" className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:border-indigo-400" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>

          <div className="flex bg-slate-200/50 p-1 rounded-xl flex-wrap gap-0.5">
            {(['weekly', 'monthly', 'final', 'seminar', 'defense'] as ReportLevel[]).map(level => (
              <button
                key={level}
                onClick={() => handleLevelChange(level)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${reportLevel === level ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {LEVEL_LABELS[level]}
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={disableGenerate}
            title={disableGenerate ? disabledReason : '\u6839\u636E\u5F53\u524D\u7B5B\u9009\u8303\u56F4\u751F\u6210\u6C47\u62A5'}
            className="ml-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2"
          >
            {isGenerating ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles text-amber-300"></i>}
            {generateButtonText}
          </button>
          {disableGenerate && disabledReason && (
            <div className="ml-1">
              <p className="text-[9px] text-rose-500 leading-tight">{disabledReason}</p>
            </div>
          )}
        </div>
      </header>

      {/* Slide preview area */}
      <div className="flex-1 min-h-0 bg-slate-100/50 rounded-[2.5rem] border border-slate-200 p-6 overflow-y-auto custom-scrollbar relative">
        {slides.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{reportLabel}{'\u6A21\u677F'} · {slides.length} {'\u9875'}</p>
              <div className="flex items-center gap-3">
                {logSourceMode === 'fallback_all' && (
                  <span className="text-[8px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">{'\u542B\u672A\u5BA1\u6838\u6570\u636E'}</span>
                )}
                <p className="text-[10px] font-bold text-slate-400">{'\u53EF\u5BFC\u51FA'} Markdown / VBA / PDF</p>
              </div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {slides.map((slide, slideIdx) => (
                <article key={slide.pageNumber} className="bg-white rounded-[1.5rem] p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col gap-4" style={{ aspectRatio: slides.length <= 4 ? '16/9' : undefined }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase rounded-full border border-indigo-100">
                      Slide {String(slide.pageNumber).padStart(2, '0')}
                    </div>
                    <div className="flex items-center gap-3">
                      {slide.successRate !== undefined && slideIdx === 0 && (
                        <SuccessRateRing rate={slide.successRate} />
                      )}
                      <h4 className="text-sm font-black text-slate-800 italic text-right">{slide.title}</h4>
                    </div>
                  </div>

                  {slide.subTitle && (
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-l-2 border-indigo-300 pl-3">{slide.subTitle}</p>
                  )}

                  {/* Trend Charts */}
                  {slide.chartData && slide.chartData.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {slide.chartData.map((series, ci) => (
                        <MiniTrendChart key={ci} data={series.data} name={series.name} color={CHART_COLORS[ci % CHART_COLORS.length]} />
                      ))}
                    </div>
                  )}

                  {slide.tableData && slide.tableData.length > 0 && (
                    <div className="overflow-auto border border-slate-100 rounded-xl">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-indigo-600 text-white">
                            {slide.tableData[0].map((h, i) => (
                              <th key={i} className="p-2 text-[9px] font-black border-b border-indigo-500">
                                <LaTeXText text={h} />
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {slide.tableData.slice(1).map((row, i) => (
                            <tr key={i} className={`border-b border-slate-50 last:border-0 ${i % 2 === 0 ? 'bg-indigo-50/25' : 'bg-white'}`}>
                              {row.map((cell, j) => (
                                <td key={j} className="p-2 text-[9px] text-slate-700 align-top">
                                  <LaTeXText text={cell} />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {slide.points && slide.points.length > 0 && (
                    <div className="space-y-2">
                      {slide.points.map((point, i) => (
                        <div key={i} className="flex gap-2 text-[10px] text-slate-700 leading-relaxed group">
                          <span className="text-indigo-500 font-black">{'\u2022'}</span>
                          {editingSlide === slideIdx && editingPoint === i ? (
                            <input
                              className="flex-1 bg-indigo-50 border border-indigo-200 rounded px-2 py-0.5 text-[10px] text-slate-800 outline-none"
                              value={editText}
                              onChange={e => setEditText(e.target.value)}
                              onBlur={commitEdit}
                              onKeyDown={e => e.key === 'Enter' && commitEdit()}
                              autoFocus
                            />
                          ) : (
                            <span
                              className="cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 rounded px-1 -mx-1 transition-colors"
                              onDoubleClick={() => startEdit(slideIdx, i, point)}
                              title={'\u53CC\u51FB\u7F16\u8F91'}
                            >
                              <LaTeXText text={point} />
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {slide.nextSteps && slide.nextSteps.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-2 tracking-widest">Next Steps</p>
                      <div className="flex flex-wrap gap-2">
                        {slide.nextSteps.map((step, i) => (
                          <span key={i} className="px-2 py-1 bg-indigo-50 border border-indigo-100 rounded text-[9px] text-indigo-600 font-bold">{step}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        ) : (
          /* ── Enhanced empty state ── */
          <div className="h-full flex flex-col items-center justify-center gap-8 py-10">
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center shadow-lg border border-indigo-200/50">
              <i className="fa-solid fa-presentation-screen text-4xl text-indigo-400"></i>
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm font-black text-slate-600 uppercase tracking-wider">{'\u9009\u62E9\u65E5\u671F\u8303\u56F4\u5E76\u751F\u6210\u62A5\u544A'}</p>
              <p className="text-[11px] text-slate-400">{'\u5F53\u524D\u8BFE\u9898\u5171\u6709'} <span className="font-black text-indigo-500">{dateStats.total}</span> {'\u6761\u5B9E\u9A8C\u65E5\u5FD7'}{dateStats.verified > 0 && <>{'\uFF0C\u5176\u4E2D'} <span className="font-black text-emerald-500">{dateStats.verified}</span> {'\u6761\u5DF2\u5BA1\u6838'}</>}</p>
              {topMetricNames.length > 0 && (
                <p className="text-[10px] text-slate-400">{'\u6838\u5FC3\u6307\u6807'}: {topMetricNames.map((n, i) => <span key={i} className="inline-block bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[9px] font-bold mx-0.5 border border-indigo-100">{n}</span>)}</p>
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={() => quickStart('weekly')} className="px-5 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black border border-indigo-100 hover:bg-indigo-100 transition-all active:scale-95">
                <i className="fa-solid fa-calendar-week mr-1.5"></i>{'\u4E00\u952E\u751F\u6210\u5468\u62A5'}
              </button>
              <button onClick={() => quickStart('monthly')} className="px-5 py-2 bg-purple-50 text-purple-600 rounded-xl text-[10px] font-black border border-purple-100 hover:bg-purple-100 transition-all active:scale-95">
                <i className="fa-solid fa-calendar-days mr-1.5"></i>{'\u4E00\u952E\u751F\u6210\u6708\u62A5'}
              </button>
              <button onClick={() => quickStart('seminar')} className="px-5 py-2 bg-teal-50 text-teal-600 rounded-xl text-[10px] font-black border border-teal-100 hover:bg-teal-100 transition-all active:scale-95">
                <i className="fa-solid fa-users mr-1.5"></i>{'\u7EC4\u4F1A\u6C47\u62A5'}
              </button>
              <button onClick={() => quickStart('defense')} className="px-5 py-2 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-black border border-amber-100 hover:bg-amber-100 transition-all active:scale-95">
                <i className="fa-solid fa-graduation-cap mr-1.5"></i>{'\u7B54\u8FA9\u62A5\u544A'}
              </button>
            </div>

            {filteredLogs.length > 0 && (
              <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4 text-center">
                <p className="text-[10px] font-black text-emerald-600">{'\u5F53\u524D\u8303\u56F4\u5185\u627E\u5230'} {filteredLogs.length} {'\u6761\u65E5\u5FD7\uFF0C\u70B9\u51FB\u4E0A\u65B9\u6309\u94AE\u7ACB\u5373\u751F\u6210'}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      {slides.length > 0 && (
        <footer className="mt-6 flex justify-end gap-3 shrink-0 animate-reveal">
          <button onClick={onExportMarkdown} className="px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl text-[10px] font-black uppercase shadow-sm hover:border-indigo-300 transition-all flex items-center gap-2 active:scale-95">
            <i className="fa-solid fa-file-lines text-slate-400"></i> {'\u5BFC\u51FA'} MARKDOWN
          </button>
          <button onClick={onExportPDF} className="px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl text-[10px] font-black uppercase shadow-sm hover:border-rose-300 transition-all flex items-center gap-2 active:scale-95">
            <i className="fa-solid fa-file-pdf text-rose-400"></i> {'\u5BFC\u51FA'} PDF
          </button>
          <button onClick={onExportVBA} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-black transition-all flex items-center gap-2 active:scale-95">
            <i className="fa-solid fa-file-powerpoint text-rose-500"></i> {'\u5BFC\u51FA'} PPT (VBA)
          </button>
        </footer>
      )}
    </div>
  );
};

export default ScientificPresenter;
