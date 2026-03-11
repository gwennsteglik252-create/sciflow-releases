
import React, { useRef } from 'react';
import { MatrixReport } from '../../types';
import saveAs from 'file-saver';
import { exportToWord } from '../../utils/documentExport';
import ScientificMarkdown from '../Common/ScientificMarkdown';
import { useProjectContext } from '../../context/ProjectContext';
import * as htmlToImage from 'html-to-image';
import { printElement } from '../../utils/printUtility';

interface ReportViewProps {
  report: MatrixReport;
}

const ReportView: React.FC<ReportViewProps> = ({ report }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const { showToast } = useProjectContext();

  const hasTableData = report.comparisonTable && report.comparisonTable.headers && report.comparisonTable.headers.length > 0;
  const hasInsights = report.insights && report.insights.length > 0;
  const cleanedContent = report.content?.replace('见下方表格', '').trim();
  const hasContent = cleanedContent && cleanedContent.length > 0;

  const handleExportWord = () => {
    let htmlSegments = [];
    htmlSegments.push(`<p style="text-align: right; color: #666; font-size: 9pt; margin-bottom: 20px;">导出日期: ${report.timestamp} | 报告类型: ${report.type || '分析报告'}</p>`);
    htmlSegments.push(`<h1 style="text-align: center; color: #1e293b; font-size: 22pt; margin-bottom: 30px;">${report.title}</h1>`);

    if (hasContent) {
        htmlSegments.push(`<div style="margin-bottom: 25px; line-height: 1.6; font-size: 11pt; text-align: justify;">${cleanedContent.replace(/\n/g, '<br/>')}</div>`);
    }

    if (hasTableData) {
        const tableHtml = `
          <table border='1' cellspacing='0' cellpadding='10' style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-family: 'SimSun', 'Arial', sans-serif; border: 1pt solid #475569;">
            <thead>
              <tr style="background-color: #f8fafc;">
                ${report.comparisonTable.headers.map(h => `<th style='font-weight: bold; text-align: left; border: 1pt solid #475569; font-size: 10.5pt; background-color: #e2e8f0; color: #1e293b;'>${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${report.comparisonTable.rows.map((row, rIdx) => `
                <tr style="${rIdx % 2 === 0 ? 'background-color: #ffffff;' : 'background-color: #f9fafb;'}">
                  ${row.map(cell => `<td style='border: 1pt solid #cbd5e1; font-size: 10pt; vertical-align: top; color: #334155;'>${cell}</td>`).join('')}
                </tr>`).join('')}
            </tbody>
          </table>
        `;
        htmlSegments.push(tableHtml);
    }

    const fullHtml = htmlSegments.join('');
    exportToWord(report.title, fullHtml);
  };

  const handleExportPdf = async () => {
    if (!reportRef.current) return;
    if (showToast) showToast({ message: '正在准备高清 PDF 打印预演...', type: 'info' });
    await printElement(reportRef.current, report.title);
  };

  const handleExportImage = async () => {
    if (!reportRef.current) return;
    if (showToast) showToast({ message: '正在生成高清全量长图...', type: 'info' });
    try {
        const dataUrl = await htmlToImage.toPng(reportRef.current, {
            backgroundColor: '#ffffff',
            pixelRatio: 2.5,
            skipFonts: true,
            cacheBust: true,
        });
        saveAs(dataUrl, `${report.title.replace(/\s+/g, '_')}_HD.png`);
        if (showToast) showToast({ message: '高清长图已导出', type: 'success' });
    } catch (e) {
        if (showToast) showToast({ message: '长图生成失败，请检查资源引用', type: 'error' });
    }
  };

  return (
    <div ref={reportRef} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-white scientific-report-layout border-none shadow-none h-full">
      <header className="flex flex-wrap justify-between items-start border-b border-slate-100 pb-4 gap-4 no-print">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-3 py-1 bg-violet-50 text-violet-600 rounded-full text-[8px] font-black uppercase border border-violet-100 shadow-sm">{report.type || '内参'}</span>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{report.timestamp}</span>
          </div>
          <h3 className="text-2xl font-black text-slate-900 leading-tight italic tracking-tighter uppercase">{report.title}</h3>
        </div>
        <div className="flex gap-2 shrink-0">
            <button onClick={handleExportWord} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all flex items-center gap-2 border border-indigo-100">
              <i className="fa-solid fa-file-word"></i> 导出 WORD
            </button>
            <button onClick={handleExportImage} className="px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all flex items-center gap-2">
              <i className="fa-solid fa-image"></i> 导出长图
            </button>
            <button onClick={handleExportPdf} className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase hover:bg-rose-100 transition-all flex items-center gap-2 border border-rose-100">
              <i className="fa-solid fa-file-pdf"></i> 下载 PDF
            </button>
        </div>
      </header>

      {hasContent && (
          <section className="report-body-content min-h-0 mt-2">
              <ScientificMarkdown content={cleanedContent!} />
          </section>
      )}

      {hasTableData && (
          <section className={`overflow-x-auto rounded-3xl border border-slate-100 shadow-sm bg-white ${hasContent ? 'mt-4' : 'mt-2'}`}>
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {report.comparisonTable.headers.map((h, i) => (
                    <th key={i} className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.comparisonTable.rows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    {row.map((cell, j) => (
                      <td key={j} className="px-6 py-4 text-[11px] font-bold text-slate-900 leading-relaxed italic">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
      )}

      {hasInsights && (
          <section className="space-y-4 pt-6 border-t border-slate-50 break-inside-avoid">
            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <i className="fa-solid fa-lightbulb text-amber-500"></i> 综合对比见解 (INSIGHTS)
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.insights.map((insight, i) => (
                <div key={i} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-sm break-inside-avoid">
                  <p className="text-[12px] leading-relaxed font-bold text-slate-900 italic">“ {insight} ”</p>
                </div>
              ))}
            </div>
          </section>
      )}
    </div>
  );
};

export default ReportView;
