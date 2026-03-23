import React, { useState, useCallback } from 'react';
import FixedPortal from './FixedPortal';
import { DataSeries } from '../../types';
import { computeDescriptiveStats } from '../../utils/dataProcessing';

interface AutoReportProps {
  seriesList: DataSeries[];
}

interface ReportSection {
  title: string;
  content: string;
  type: 'summary' | 'stats' | 'comparison' | 'recommendation';
}

/**
 * 自动化数据分析报告生成器
 * 汇总统计、比较、异常检测，生成可导出的结构化文本报告
 */
const AutoReportGenerator: React.FC<AutoReportProps> = ({ seriesList }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [report, setReport] = useState<ReportSection[]>([]);

  const generateReport = useCallback(() => {
    const sections: ReportSection[] = [];

    // 1. 概述
    sections.push({
      title: '📊 数据概述',
      type: 'summary',
      content: [
        `本次分析包含 ${seriesList.length} 个数据系列。`,
        ...seriesList.map(s => `• ${s.name}: ${s.data.length} 个数据点`),
      ].join('\n'),
    });

    // 2. 描述性统计
    const statsRows = seriesList.map(s => {
      const ys = s.data.map(d => d.value).filter(v => !isNaN(v));
      if (ys.length === 0) return null;
      const stats = computeDescriptiveStats(ys);
      return { name: s.name, ...stats };
    }).filter(Boolean) as any[];

    if (statsRows.length > 0) {
      const table = [
        '系列 | 均值 | 中位数 | 标准差 | 最小值 | 最大值 | 偏度 | 峰度',
        '--- | --- | --- | --- | --- | --- | --- | ---',
        ...statsRows.map(r =>
          `${r.name} | ${r.mean.toFixed(4)} | ${r.median.toFixed(4)} | ${r.stdDev.toFixed(4)} | ${r.min.toFixed(4)} | ${r.max.toFixed(4)} | ${(r.skewness || 0).toFixed(3)} | ${(r.kurtosis || 0).toFixed(3)}`
        ),
      ].join('\n');

      sections.push({ title: '📈 描述性统计', type: 'stats', content: table });
    }

    // 3. 系列间比较
    if (seriesList.length >= 2) {
      const comparisons: string[] = [];
      for (let i = 0; i < Math.min(seriesList.length, 5); i++) {
        for (let j = i + 1; j < Math.min(seriesList.length, 5); j++) {
          const a = seriesList[i].data.map(d => d.value).filter(v => !isNaN(v));
          const b = seriesList[j].data.map(d => d.value).filter(v => !isNaN(v));
          if (a.length < 2 || b.length < 2) continue;

          const mA = a.reduce((s, v) => s + v, 0) / a.length;
          const mB = b.reduce((s, v) => s + v, 0) / b.length;
          const diff = ((mB - mA) / (Math.abs(mA) || 1) * 100).toFixed(1);

          comparisons.push(
            `• ${seriesList[i].name} vs ${seriesList[j].name}: 均值差异 ${diff}%` +
            ` (${mA.toFixed(3)} → ${mB.toFixed(3)})`
          );
        }
      }
      if (comparisons.length > 0) {
        sections.push({ title: '🔍 系列比较', type: 'comparison', content: comparisons.join('\n') });
      }
    }

    // 4. 异常检测
    const anomalies: string[] = [];
    seriesList.forEach(s => {
      const ys = s.data.map(d => d.value).filter(v => !isNaN(v));
      if (ys.length < 4) return;

      const sorted = [...ys].sort((a, b) => a - b);
      const q1 = sorted[Math.floor(sorted.length * 0.25)];
      const q3 = sorted[Math.floor(sorted.length * 0.75)];
      const iqr = q3 - q1;
      const outlierCount = ys.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr).length;

      if (outlierCount > 0) {
        anomalies.push(
          `• ${s.name}: 发现 ${outlierCount} 个离群点 (IQR 方法, 占比 ${(outlierCount / ys.length * 100).toFixed(1)}%)`
        );
      }

      // 检测趋势
      const n = ys.length;
      const xMean = (n - 1) / 2;
      const yMean = ys.reduce((s, v) => s + v, 0) / n;
      let sx2 = 0, sxy = 0;
      ys.forEach((y, i) => { sxy += (i - xMean) * (y - yMean); sx2 += (i - xMean) ** 2; });
      const slope = sx2 > 0 ? sxy / sx2 : 0;
      const slopePercent = Math.abs(slope / (yMean || 1) * 100);

      if (slopePercent > 5) {
        anomalies.push(`• ${s.name}: 检测到${slope > 0 ? '上升' : '下降'}趋势 (斜率变化率 ${slopePercent.toFixed(1)}%/点)`);
      }
    });

    if (anomalies.length > 0) {
      sections.push({ title: '⚠️ 异常与趋势', type: 'recommendation', content: anomalies.join('\n') });
    }

    // 5. 建议
    const recs: string[] = [];
    if (seriesList.some(s => {
      const ys = s.data.map(d => d.value);
      const std = Math.sqrt(ys.reduce((s, v) => s + (v - ys.reduce((a, b) => a + b, 0) / ys.length) ** 2, 0) / ys.length);
      return std / (Math.abs(ys.reduce((a, b) => a + b, 0) / ys.length) || 1) > 0.5;
    })) {
      recs.push('• 建议对高变异系列进行数据平滑或归一化处理');
    }
    if (seriesList.length >= 3) {
      recs.push('• 建议使用相关性热图分析变量间的线性关系');
      recs.push('• 建议使用 PCA 或 t-SNE 降维探索高维结构');
    }
    if (seriesList.length >= 2) {
      recs.push('• 建议使用假设检验确认组间差异的统计显著性');
    }

    if (recs.length > 0) {
      sections.push({ title: '💡 分析建议', type: 'recommendation', content: recs.join('\n') });
    }

    setReport(sections);
  }, [seriesList]);

  const exportReport = useCallback(() => {
    const text = report.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n---\n\n');
    const header = `# 数据分析报告\n生成时间：${new Date().toLocaleString('zh-CN')}\n\n---\n\n`;
    const blob = new Blob([header + text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `数据分析报告_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report]);

  const sectionIcon = (type: string) => {
    switch (type) {
      case 'summary': return 'fa-chart-pie text-blue-500';
      case 'stats': return 'fa-table text-emerald-500';
      case 'comparison': return 'fa-code-compare text-purple-500';
      case 'recommendation': return 'fa-lightbulb text-amber-500';
      default: return 'fa-file text-slate-400';
    }
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-300 hover:shadow-lg active:scale-95 flex items-center gap-1.5 shadow-sm"
      >
        <i className="fa-solid fa-file-lines text-[10px]" /> 报告
      </button>
    );
  }

  return (
    <FixedPortal onClose={() => setIsExpanded(false)}>
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-white rounded-2xl shadow-2xl border border-slate-200 w-[450px] p-5 animate-reveal max-h-[80vh] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-slate-800 uppercase italic flex items-center gap-2">
          <i className="fa-solid fa-file-lines text-emerald-500" /> 自动分析报告
        </h3>
        <button onClick={() => setIsExpanded(false)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        <button
          onClick={generateReport}
          className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-xs font-black uppercase shadow-lg active:scale-95 transition-all"
        >
          <i className="fa-solid fa-wand-magic-sparkles mr-1.5" /> 生成报告
        </button>
        {report.length > 0 && (
          <button
            onClick={exportReport}
            className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-200 active:scale-95 transition-all"
          >
            <i className="fa-solid fa-download mr-1" /> 导出
          </button>
        )}
      </div>

      {report.length > 0 && (
        <div className="space-y-3 animate-reveal">
          {report.map((section, i) => (
            <div key={i} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <h4 className="text-[11px] font-black text-slate-700 mb-2 flex items-center gap-1.5">
                <i className={`fa-solid ${sectionIcon(section.type)}`} />
                {section.title}
              </h4>
              <pre className="text-[9px] font-mono text-slate-600 whitespace-pre-wrap leading-relaxed">{section.content}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
    </FixedPortal>
  );
};

export default AutoReportGenerator;
