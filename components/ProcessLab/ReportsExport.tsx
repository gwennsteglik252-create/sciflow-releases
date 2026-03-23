/**
 * ReportsExport.tsx — 报告与导出
 * 批次检验报告、配方版本对比、月度良率汇总、Excel 导入/导出
 */
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Formulation, ProcessBatch } from '../../types';

interface Props {
  formulations: Formulation[];
  batches: ProcessBatch[];
  showToast: (t: { message: string; type: 'error' | 'success' | 'info' | 'warning' }) => void;
}

// CSV 工具
const toCSV = (headers: string[], rows: string[][]): string => {
  return [headers.join(','), ...rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(','))].join('\n');
};
const downloadBlob = (content: string, filename: string, mime = 'text/csv;charset=utf-8;') => {
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const ReportsExport: React.FC<Props> = ({ formulations = [], batches = [], showToast }) => {
  const [activeSection, setActiveSection] = useState<'batch' | 'diff' | 'monthly' | 'export'>('batch');
  // 批次报告
  const [reportBatchId, setReportBatchId] = useState('');
  // 配方对比
  const [diffA, setDiffA] = useState('');
  const [diffB, setDiffB] = useState('');
  // 月度汇总
  const [monthFilter, setMonthFilter] = useState(() => new Date().toISOString().slice(0, 7));
  const reportRef = useRef<HTMLDivElement>(null);

  // ─── 批次报告数据 ───
  const reportBatch = useMemo(() => batches.find(b => b.id === reportBatchId), [reportBatchId, batches]);

  // ─── 配方对比数据 ───
  const diffData = useMemo(() => {
    const a = formulations.find(f => f.id === diffA);
    const b = formulations.find(f => f.id === diffB);
    if (!a || !b) return null;
    const allKeys = new Set([...(a.components || []).map(c => c.materialName), ...(b.components || []).map(c => c.materialName)]);
    const componentDiffs = [...allKeys].map(name => {
      const ca = (a.components || []).find(c => c.materialName === name);
      const cb = (b.components || []).find(c => c.materialName === name);
      return {
        name, role: ca?.role || cb?.role || '',
        pctA: ca?.percentage ?? null, pctB: cb?.percentage ?? null,
        amtA: ca?.amount ?? null, amtB: cb?.amount ?? null,
        unit: ca?.unit || cb?.unit || '',
        status: !ca ? 'added' : !cb ? 'removed' : ca.percentage !== cb.percentage ? 'changed' : 'same',
      };
    });
    return { a, b, componentDiffs };
  }, [diffA, diffB, formulations]);

  // ─── 月度汇总数据 ───
  const monthlyData = useMemo(() => {
    const completedInMonth = batches.filter(b => b.status === 'completed' && b.startTime?.startsWith(monthFilter));
    const allInMonth = batches.filter(b => b.startTime?.startsWith(monthFilter));
    if (allInMonth.length === 0) return null;
    const yields = completedInMonth.map(b => b.yield);
    const avgYield = yields.length > 0 ? yields.reduce((s, v) => s + v, 0) / yields.length : 0;
    const cpks = completedInMonth.filter(b => b.cpk !== undefined).map(b => b.cpk!);
    const avgCpk = cpks.length > 0 ? cpks.reduce((s, v) => s + v, 0) / cpks.length : 0;
    let qcTotal = 0, qcPass = 0;
    completedInMonth.forEach(b => { (b.qualityChecks || []).forEach(q => { qcTotal++; if (q.passed) qcPass++; }); });
    const statusCounts = { completed: 0, rejected: 0, reworked: 0, in_progress: 0, preparing: 0 };
    allInMonth.forEach(b => statusCounts[b.status]++);
    return { total: allInMonth.length, completed: completedInMonth.length, avgYield, avgCpk, qcRate: qcTotal > 0 ? (qcPass / qcTotal) * 100 : 0, statusCounts, qcTotal, qcPass };
  }, [batches, monthFilter]);

  // ─── 导出配方 CSV ───
  const exportFormulationsCSV = useCallback(() => {
    const headers = ['名称', '版本', '状态', '规模', '组分数', '总重量', '单位', '创建日期', '更新日期', '标签'];
    const rows = formulations.map(f => [
      f.name, f.version, f.status, f.scaleLevel, String(f.components?.length || 0),
      String(f.totalWeight || ''), f.totalWeightUnit || '', f.createdAt, f.updatedAt, (f.tags || []).join(';'),
    ]);
    downloadBlob(toCSV(headers, rows), `配方列表_${new Date().toISOString().slice(0, 10)}.csv`);
    showToast({ message: '配方数据已导出', type: 'success' });
  }, [formulations, showToast]);

  // ─── 导出批次 CSV ───
  const exportBatchesCSV = useCallback(() => {
    const headers = ['批次号', '配方', '版本', '状态', '操作员', '良率%', 'Cpk', 'QC通过', 'QC总数', '开始日期', '备注'];
    const rows = batches.map(b => [
      b.batchNumber, b.formulationName || '', b.formulationVersion || '', b.status, b.operator,
      String(b.yield), String(b.cpk ?? ''), String((b.qualityChecks || []).filter(q => q.passed).length),
      String((b.qualityChecks || []).length), b.startTime, b.notes || '',
    ]);
    downloadBlob(toCSV(headers, rows), `批次记录_${new Date().toISOString().slice(0, 10)}.csv`);
    showToast({ message: '批次数据已导出', type: 'success' });
  }, [batches, showToast]);

  // ─── 打印批次报告 ───
  const printReport = useCallback(() => {
    if (!reportRef.current) return;
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) { showToast({ message: '请允许弹窗窗口', type: 'error' }); return; }
    printWindow.document.write(`<!DOCTYPE html><html><head><title>批次检验报告</title><style>
      body { font-family: -apple-system, 'PingFang SC', sans-serif; padding: 40px; color: #1e293b; font-size: 12px; }
      h1 { font-size: 20px; border-bottom: 2px solid #f59e0b; padding-bottom: 8px; }
      h2 { font-size: 14px; margin-top: 20px; color: #475569; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; font-size: 11px; }
      th { background: #f8fafc; font-weight: 700; color: #64748b; }
      .pass { color: #16a34a; font-weight: 700; } .fail { color: #dc2626; font-weight: 700; }
      .meta { display: flex; flex-wrap: wrap; gap: 12px; margin: 12px 0; }
      .meta-item { font-size: 11px; } .meta-label { color: #94a3b8; } .meta-value { font-weight: 700; }
      @media print { body { padding: 20px; } }
    </style></head><body>${reportRef.current.innerHTML}</body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 300);
  }, [showToast]);

  const SECTION_TABS = [
    { key: 'batch', label: '批次检验报告', icon: 'fa-file-medical' },
    { key: 'diff', label: '配方版本对比', icon: 'fa-code-compare' },
    { key: 'monthly', label: '月度良率汇总', icon: 'fa-calendar-check' },
    { key: 'export', label: '数据导入/导出', icon: 'fa-file-export' },
  ];

  return (
    <div className="space-y-5 pb-12">
      {/* Tab 选择 */}
      <div className="flex gap-2 flex-wrap">
        {SECTION_TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveSection(tab.key as any)}
            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 border-2 ${activeSection === tab.key ? 'border-amber-400 bg-amber-50 text-amber-700 shadow-sm' : 'border-slate-100 bg-white text-slate-500 hover:border-amber-200'}`}>
            <i className={`fa-solid ${tab.icon} text-[9px]`}></i>{tab.label}
          </button>
        ))}
      </div>

      {/* ═══ 批次检验报告 ═══ */}
      {activeSection === 'batch' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-5 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5">选择批次</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                value={reportBatchId} onChange={e => setReportBatchId(e.target.value)}>
                <option value="">选择...</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.batchNumber} — {b.formulationName} ({b.status})</option>)}
              </select>
            </div>
            {reportBatch && (
              <button onClick={printReport} className="px-5 py-2.5 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-amber-700 transition-all active:scale-95 flex items-center gap-2 shrink-0">
                <i className="fa-solid fa-print"></i>打印 / 导出 PDF
              </button>
            )}
          </div>

          {reportBatch && (
            <div ref={reportRef} className="border border-slate-200 rounded-xl p-6 bg-slate-50/50">
              <h1 style={{ fontSize: '18px', fontWeight: 900, borderBottom: '2px solid #f59e0b', paddingBottom: '8px', marginBottom: '16px' }}>
                批次检验报告 — {reportBatch.batchNumber}
              </h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px', fontSize: '11px' }}>
                {[
                  ['配方', `${reportBatch.formulationName || '—'} (${reportBatch.formulationVersion || '—'})`],
                  ['状态', reportBatch.status], ['操作员', reportBatch.operator],
                  ['良率', `${reportBatch.yield}%`], ['Cpk', reportBatch.cpk ? String(reportBatch.cpk) : '—'],
                  ['开始日期', reportBatch.startTime], ['结束日期', reportBatch.endTime || '—'],
                ].map(([label, val]) => (
                  <span key={label}><span style={{ color: '#94a3b8' }}>{label}: </span><strong>{val}</strong></span>
                ))}
              </div>

              {(reportBatch.parameters?.length || 0) > 0 && (
                <>
                  <h2 style={{ fontSize: '13px', fontWeight: 800, marginTop: '16px', marginBottom: '8px', color: '#475569' }}>工艺参数记录</h2>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead><tr style={{ background: '#f8fafc' }}>
                      <th style={{ border: '1px solid #e2e8f0', padding: '5px 8px', fontWeight: 700 }}>参数</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '5px 8px', fontWeight: 700 }}>目标值</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '5px 8px', fontWeight: 700 }}>实际值</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '5px 8px', fontWeight: 700 }}>单位</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '5px 8px', fontWeight: 700 }}>判定</th>
                    </tr></thead>
                    <tbody>
                      {(reportBatch.parameters || []).map((p, i) => (
                        <tr key={i}>
                          <td style={{ border: '1px solid #e2e8f0', padding: '5px 8px' }}>{p.key}</td>
                          <td style={{ border: '1px solid #e2e8f0', padding: '5px 8px' }}>{p.target}</td>
                          <td style={{ border: '1px solid #e2e8f0', padding: '5px 8px', fontWeight: 700 }}>{p.actual}</td>
                          <td style={{ border: '1px solid #e2e8f0', padding: '5px 8px' }}>{p.unit}</td>
                          <td style={{ border: '1px solid #e2e8f0', padding: '5px 8px', fontWeight: 700, color: p.isInSpec ? '#16a34a' : '#dc2626' }}>{p.isInSpec ? '✅ 合格' : '❌ 超标'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {(reportBatch.qualityChecks?.length || 0) > 0 && (
                <>
                  <h2 style={{ fontSize: '13px', fontWeight: 800, marginTop: '16px', marginBottom: '8px', color: '#475569' }}>质量检测结果</h2>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead><tr style={{ background: '#f8fafc' }}>
                      <th style={{ border: '1px solid #e2e8f0', padding: '5px 8px', fontWeight: 700 }}>检测项</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '5px 8px', fontWeight: 700 }}>标准</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '5px 8px', fontWeight: 700 }}>结果</th>
                      <th style={{ border: '1px solid #e2e8f0', padding: '5px 8px', fontWeight: 700 }}>判定</th>
                    </tr></thead>
                    <tbody>
                      {(reportBatch.qualityChecks || []).map((q, i) => (
                        <tr key={i}>
                          <td style={{ border: '1px solid #e2e8f0', padding: '5px 8px' }}>{q.checkName}</td>
                          <td style={{ border: '1px solid #e2e8f0', padding: '5px 8px' }}>{q.standard}</td>
                          <td style={{ border: '1px solid #e2e8f0', padding: '5px 8px', fontWeight: 700 }}>{q.result}</td>
                          <td style={{ border: '1px solid #e2e8f0', padding: '5px 8px', fontWeight: 700, color: q.passed ? '#16a34a' : '#dc2626' }}>{q.passed ? '✅ 合格' : '❌ 不合格'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {reportBatch.notes && (
                <p style={{ marginTop: '12px', fontSize: '11px', color: '#64748b' }}><strong>备注:</strong> {reportBatch.notes}</p>
              )}
              <p style={{ marginTop: '20px', fontSize: '9px', color: '#94a3b8', textAlign: 'right' }}>报告生成时间: {new Date().toLocaleString('zh-CN')}</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ 配方版本对比 ═══ */}
      {activeSection === 'diff' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5">配方 A（旧版）</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                value={diffA} onChange={e => setDiffA(e.target.value)}>
                <option value="">选择...</option>
                {formulations.map(f => <option key={f.id} value={f.id}>{f.name} ({f.version})</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-400 uppercase block mb-1.5">配方 B（新版）</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                value={diffB} onChange={e => setDiffB(e.target.value)}>
                <option value="">选择...</option>
                {formulations.map(f => <option key={f.id} value={f.id}>{f.name} ({f.version})</option>)}
              </select>
            </div>
          </div>

          {diffData && (
            <div className="space-y-4">
              {/* 基本信息对比 */}
              <div className="grid grid-cols-2 gap-3 text-[10px]">
                {[
                  { label: '规模', a: diffData.a.scaleLevel, b: diffData.b.scaleLevel },
                  { label: '状态', a: diffData.a.status, b: diffData.b.status },
                  { label: '总重', a: `${diffData.a.totalWeight || '—'} ${diffData.a.totalWeightUnit || ''}`, b: `${diffData.b.totalWeight || '—'} ${diffData.b.totalWeightUnit || ''}` },
                  { label: '组分数', a: String(diffData.a.components?.length || 0), b: String(diffData.b.components?.length || 0) },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-slate-400 uppercase w-12 shrink-0">{row.label}</span>
                    <span className={`flex-1 font-bold text-center py-1 rounded-lg ${row.a !== row.b ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-600'}`}>{row.a}</span>
                    <i className="fa-solid fa-arrow-right text-[7px] text-slate-300"></i>
                    <span className={`flex-1 font-bold text-center py-1 rounded-lg ${row.a !== row.b ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'}`}>{row.b}</span>
                  </div>
                ))}
              </div>

              {/* 组分 Diff */}
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase mb-2">组分变更</p>
                <div className="space-y-1.5">
                  {diffData.componentDiffs.map(cd => (
                    <div key={cd.name} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold ${cd.status === 'added' ? 'bg-emerald-50 border border-emerald-200' : cd.status === 'removed' ? 'bg-rose-50 border border-rose-200' : cd.status === 'changed' ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-slate-100'}`}>
                      <span className={`w-4 text-center font-black ${cd.status === 'added' ? 'text-emerald-500' : cd.status === 'removed' ? 'text-rose-500' : cd.status === 'changed' ? 'text-amber-500' : 'text-slate-300'}`}>
                        {cd.status === 'added' ? '+' : cd.status === 'removed' ? '−' : cd.status === 'changed' ? '~' : '·'}
                      </span>
                      <span className="w-14 text-[8px] font-black text-slate-400 uppercase shrink-0">{cd.role}</span>
                      <span className="flex-1 font-black text-slate-700">{cd.name}</span>
                      <span className="w-14 text-right">{cd.pctA !== null ? `${cd.pctA}%` : '—'}</span>
                      <i className="fa-solid fa-arrow-right text-[7px] text-slate-300"></i>
                      <span className="w-14 text-right font-black">{cd.pctB !== null ? `${cd.pctB}%` : '—'}</span>
                      {cd.pctA !== null && cd.pctB !== null && cd.pctA !== cd.pctB && (
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${(cd.pctB - cd.pctA) > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          {(cd.pctB - cd.pctA) > 0 ? '+' : ''}{(cd.pctB - cd.pctA).toFixed(1)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ 月度良率汇总 ═══ */}
      {activeSection === 'monthly' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-5">
            <input type="month" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-bold text-slate-700 outline-none"
              value={monthFilter} onChange={e => setMonthFilter(e.target.value)} />
          </div>
          {monthlyData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: '总批次', value: monthlyData.total, color: 'text-slate-700' },
                  { label: '已完成', value: monthlyData.completed, color: 'text-emerald-600' },
                  { label: '平均良率', value: `${monthlyData.avgYield.toFixed(1)}%`, color: monthlyData.avgYield >= 95 ? 'text-emerald-600' : 'text-amber-600' },
                  { label: '平均 Cpk', value: monthlyData.avgCpk.toFixed(2), color: monthlyData.avgCpk >= 1.33 ? 'text-emerald-600' : 'text-amber-600' },
                ].map(kpi => (
                  <div key={kpi.label} className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">{kpi.label}</p>
                    <p className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-2">QC 通过率</p>
                  <p className="text-xl font-black text-indigo-600">{monthlyData.qcRate.toFixed(1)}% <span className="text-[9px] text-slate-400 font-bold">{monthlyData.qcPass}/{monthlyData.qcTotal} 项</span></p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-2">状态分布</p>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(monthlyData.statusCounts).filter(([, v]) => v > 0).map(([k, v]) => (
                      <span key={k} className="text-[8px] font-black bg-white px-2 py-0.5 rounded-full border border-slate-200">{k === 'completed' ? '完成' : k === 'rejected' ? '拒收' : k === 'reworked' ? '返工' : k === 'in_progress' ? '生产' : '准备'} {v}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-[11px] text-slate-400 py-12 italic">该月份暂无批次数据</p>
          )}
        </div>
      )}

      {/* ═══ 数据导入/导出 ═══ */}
      {activeSection === 'export' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 导出 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-5"><i className="fa-solid fa-file-arrow-down text-emerald-500"></i>数据导出</h4>
            <div className="space-y-3">
              <button onClick={exportFormulationsCSV} className="w-full flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all text-left">
                <i className="fa-solid fa-flask text-emerald-600"></i>
                <div><p className="text-[10px] font-black text-emerald-700">导出配方列表 (CSV)</p><p className="text-[8px] font-bold text-emerald-500">{formulations.length} 条配方</p></div>
              </button>
              <button onClick={exportBatchesCSV} className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all text-left">
                <i className="fa-solid fa-boxes-stacked text-blue-600"></i>
                <div><p className="text-[10px] font-black text-blue-700">导出批次记录 (CSV)</p><p className="text-[8px] font-bold text-blue-500">{batches.length} 条批次</p></div>
              </button>
            </div>
          </div>

          {/* 导入 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-5"><i className="fa-solid fa-file-arrow-up text-indigo-500"></i>数据导入</h4>
            <div className="border-2 border-dashed border-indigo-200 rounded-xl p-8 text-center bg-indigo-50/30">
              <i className="fa-solid fa-cloud-arrow-up text-indigo-300 text-3xl mb-3"></i>
              <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">拖拽或点击上传 CSV/Excel</p>
              <p className="text-[9px] font-bold text-indigo-400">支持标准 CSV 格式</p>
              <input type="file" accept=".csv,.xlsx" className="hidden" id="import-file" onChange={e => {
                const file = e.target.files?.[0];
                if (file) showToast({ message: `已选择 ${file.name}，导入功能开发中`, type: 'info' });
              }} />
              <label htmlFor="import-file" className="inline-block mt-3 px-5 py-2 bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase cursor-pointer hover:bg-indigo-600 transition-all">
                选择文件
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsExport;
