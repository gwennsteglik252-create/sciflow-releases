import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  TableLayoutType
} from 'docx';
import { saveAs } from 'file-saver';
import { toPng } from 'html-to-image';
import { useTranslation } from '../../locales/useTranslation';

interface PlanExperiment {
  title: string;
  notes: string;
  matrix: { name: string; target: string; range: string }[];
  runs: { idx: number; label: string; sampleId?: string; params: Record<string, string>; fullParams?: { key: string; value: string; unit: string }[]; description?: string }[];
  sourceTaskIndex: number;
}

interface WeeklyExperimentPlanModalProps {
  show: boolean;
  experiments: PlanExperiment[];
  projectTitle: string;
  onClose: () => void;
}

const WeeklyExperimentPlanModal: React.FC<WeeklyExperimentPlanModalProps> = ({
  show, experiments, projectTitle, onClose
}) => {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
  const formatDate = (d: Date) => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const dateRange = `${formatDate(now)} — ${formatDate(weekEnd)}`;

  const totalRuns = useMemo(() => experiments.reduce((sum, exp) => sum + (exp.runs?.length || 0), 0), [experiments]);

  // ── Word 导出 ──
  const handleExportWord = useCallback(async () => {
    setIsExporting(true);
    try {
      const children: (Paragraph | Table)[] = [];

      // 标题
      children.push(new Paragraph({
        children: [new TextRun({ text: t('projects.weeklyPlanModal.title'), bold: true, size: 36, font: 'Microsoft YaHei' })],
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
      }));

      // 元信息
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${t('projects.weeklyPlanModal.project')}: `, bold: true, size: 22, font: 'Microsoft YaHei' }),
          new TextRun({ text: projectTitle, size: 22, font: 'Microsoft YaHei' }),
        ],
        spacing: { after: 60 },
      }));
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${t('projects.weeklyPlanModal.period')}: `, bold: true, size: 22, font: 'Microsoft YaHei' }),
          new TextRun({ text: dateRange, size: 22, font: 'Microsoft YaHei' }),
          new TextRun({ text: `    ${t('projects.weeklyPlanModal.groupCount', { count: experiments.length })}, ${t('projects.weeklyPlanModal.sampleCount', { count: totalRuns })}`, size: 20, font: 'Microsoft YaHei', color: '666666' }),
        ],
        spacing: { after: 200 },
      }));

      // 分隔线
      children.push(new Paragraph({
        children: [new TextRun({ text: '━'.repeat(40), color: '10b981', size: 16 })],
        spacing: { after: 200 },
      }));

      experiments.forEach((exp, ei) => {
        // 实验组标题
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `${t('projects.weeklyPlanModal.expGroup')} ${ei + 1}: `, bold: true, size: 26, font: 'Microsoft YaHei', color: '059669' }),
            new TextRun({ text: exp.title, bold: true, size: 26, font: 'Microsoft YaHei' }),
          ],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 60 },
        }));

        // 目标
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `${t('projects.weeklyPlanModal.expTarget')}: `, bold: true, size: 20, font: 'Microsoft YaHei', color: '6b7280' }),
            new TextRun({ text: exp.notes, size: 20, font: 'Microsoft YaHei', color: '6b7280', italics: true }),
          ],
          spacing: { after: 150 },
        }));

        // 参数对照表
        if (exp.matrix.length > 0 && exp.runs.length > 0) {
          children.push(new Paragraph({
            children: [new TextRun({ text: `▎${t('projects.weeklyPlanModal.matrixTitle')}`, bold: true, size: 22, font: 'Microsoft YaHei', color: '059669' })],
            spacing: { before: 100, after: 80 },
          }));

          const headerBorder = { style: BorderStyle.SINGLE, size: 1, color: '10b981' };
          const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' };
          const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
          const headerBorders = { top: headerBorder, bottom: headerBorder, left: headerBorder, right: headerBorder };

          // 表头行
          const headerRow = new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: t('projects.weeklyPlanModal.sampleId'), bold: true, size: 18, font: 'Microsoft YaHei', color: 'ffffff' })], alignment: AlignmentType.CENTER })],
                shading: { fill: '059669', type: ShadingType.CLEAR },
                borders: headerBorders,
                verticalAlign: 'center' as any,
              }),
              ...exp.matrix.map(m => new TableCell({
                children: [new Paragraph({
                  children: [
                    new TextRun({ text: m.name, bold: true, size: 18, font: 'Microsoft YaHei', color: 'ffffff' }),
                    new TextRun({ text: `\n${m.target}`, size: 14, font: 'Microsoft YaHei', color: 'a7f3d0' }),
                  ],
                  alignment: AlignmentType.CENTER,
                })],
                shading: { fill: '059669', type: ShadingType.CLEAR },
                borders: headerBorders,
                verticalAlign: 'center' as any,
              })),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: t('projects.weeklyPlanModal.protocol'), bold: true, size: 18, font: 'Microsoft YaHei', color: 'ffffff' })], alignment: AlignmentType.CENTER })],
                shading: { fill: '059669', type: ShadingType.CLEAR },
                borders: headerBorders,
                verticalAlign: 'center' as any,
              }),
            ],
          });

          // 数据行
          const dataRows = exp.runs.map((run, ri) => new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: run.sampleId || `Run-${run.idx}`, bold: true, size: 18, font: 'Microsoft YaHei', color: '4f46e5' })], alignment: AlignmentType.CENTER })],
                shading: { fill: ri % 2 === 0 ? 'f0fdf4' : 'ffffff', type: ShadingType.CLEAR },
                borders,
                verticalAlign: 'center' as any,
              }),
              ...exp.matrix.map(m => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: run.params[m.name] || '-', size: 18, font: 'Consolas' })], alignment: AlignmentType.CENTER })],
                shading: { fill: ri % 2 === 0 ? 'f0fdf4' : 'ffffff', type: ShadingType.CLEAR },
                borders,
                verticalAlign: 'center' as any,
              })),
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: run.label, size: 16, font: 'Microsoft YaHei', color: '9ca3af' })], alignment: AlignmentType.CENTER })],
                shading: { fill: ri % 2 === 0 ? 'f0fdf4' : 'ffffff', type: ShadingType.CLEAR },
                borders,
                verticalAlign: 'center' as any,
              }),
            ],
          }));

          const colCount = exp.matrix.length + 2;
          children.push(new Table({
            rows: [headerRow, ...dataRows],
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            columnWidths: Array(colCount).fill(Math.floor(9000 / colCount)),
          }));

          children.push(new Paragraph({ children: [], spacing: { after: 150 } }));
        }

        // 详细实验步骤
        children.push(new Paragraph({
          children: [new TextRun({ text: `▎${t('projects.weeklyPlanModal.procedureTitle')}`, bold: true, size: 22, font: 'Microsoft YaHei', color: '7c3aed' })],
          spacing: { before: 100, after: 80 },
        }));

        exp.runs.forEach((run) => {
          // 小标题
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `● ${run.sampleId || `Run-${run.idx}`}`, bold: true, size: 20, font: 'Microsoft YaHei', color: '059669' }),
              new TextRun({ text: ` — ${run.label}`, size: 20, font: 'Microsoft YaHei', color: '9ca3af' }),
            ],
            spacing: { before: 80, after: 40 },
          }));

          // 操作描述
          if (run.description) {
            children.push(new Paragraph({
              children: [new TextRun({ text: run.description, size: 20, font: 'Microsoft YaHei' })],
              indent: { left: 400 },
              spacing: { after: 60 },
            }));
          }

          // 合成流程图（按阶段分组）
          if (run.fullParams && run.fullParams.length > 0) {
            const stagesDef = [
              { label: `⚖ ${t('projects.weeklyPlanModal.stages.weighing')}`, kw: ['用量', 'mg', ' g', '质量'] },
              { label: `🧪 ${t('projects.weeklyPlanModal.stages.dissolution')}`, kw: ['浓度', 'mol', '体积', 'mL', '初浓', '密度'] },
              { label: `🧫 ${t('projects.weeklyPlanModal.stages.reaction')}`, kw: ['搅拌', '熟化', 'pH', 'ph', '滴加', '转速', 'rpm', '气氛', '反应', '沉淀', 'Na₂CO₃'] },
              { label: `🔧 ${t('projects.weeklyPlanModal.stages.postProcessing')}`, kw: ['洗涤', '过滤', '离心', '终点'] },
              { label: `🌡 ${t('projects.weeklyPlanModal.stages.drying')}`, kw: ['干燥', '温度', '°C', '℃', '烘'] },
            ];
            const stageBuckets: { key: string; value: string; unit: string }[][] = stagesDef.map(() => []);

            run.fullParams.forEach(fp => {
              const txt = `${fp.key}${fp.unit}`;
              let placed = false;
              // 从后往前匹配（优先级：干燥 > 后处理 > 反应 > 溶解 > 原料）
              for (let si = stagesDef.length - 1; si >= 0; si--) {
                if (stagesDef[si].kw.some(k => txt.includes(k))) {
                  stageBuckets[si].push(fp);
                  placed = true;
                  break;
                }
              }
              if (!placed) stageBuckets[2].push(fp); // 默认归入反应
            });

            const activeStages = stagesDef
              .map((s, i) => ({ ...s, params: stageBuckets[i] }))
              .filter(s => s.params.length > 0);

            // 流程图标题
            children.push(new Paragraph({
              children: [new TextRun({ text: `${t('projects.weeklyPlanModal.synthesisFlow')}:`, bold: true, size: 18, font: 'Microsoft YaHei', color: '059669' })],
              indent: { left: 400 },
              spacing: { before: 60, after: 40 },
            }));

            // 每个阶段一行
            activeStages.forEach((stage, si) => {
              const arrow = si < activeStages.length - 1 ? '  →' : '';
              const paramItems = stage.params.map(fp => `${fp.value} ${fp.unit} ${fp.key}`).join(', ');
              children.push(new Paragraph({
                children: [
                  new TextRun({ text: `${stage.label}`, bold: true, size: 18, font: 'Microsoft YaHei', color: '374151' }),
                  new TextRun({ text: `  ${paramItems}`, size: 16, font: 'Consolas', color: '6b7280' }),
                  new TextRun({ text: arrow, bold: true, size: 18, font: 'Microsoft YaHei', color: '10b981' }),
                ],
                indent: { left: 600 },
                spacing: { after: 20 },
              }));
            });

            children.push(new Paragraph({ children: [], spacing: { after: 80 } }));
          }
        });

        // 分隔
        children.push(new Paragraph({
          children: [new TextRun({ text: '─'.repeat(40), color: 'e2e8f0', size: 14 })],
          spacing: { before: 100, after: 100 },
        }));
      });

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: { top: 1440, right: 1200, bottom: 1440, left: 1200 },
            },
          },
          children,
        }],
      });

      const blob = await Packer.toBlob(doc);
      const filename = `Weekly_Plan_${formatDate(now).replace(/\./g, '')}.docx`;
      saveAs(blob, filename);
    } catch (err) {
      console.error('Export Word error:', err);
    } finally {
      setIsExporting(false);
    }
  }, [experiments, projectTitle, dateRange, totalRuns, t]);

  // ── PDF 导出（通过打印窗口） ──
  const handleExportPdf = useCallback(() => {
    // 分类函数
    const classifyParams = (fullParams: { key: string; value: string; unit: string }[]) => {
      const stagesDef = [
        { label: `⚖️ ${t('projects.weeklyPlanModal.stages.weighing')}`, kw: ['用量', 'mg', ' g', '质量'] },
        { label: `🧪 ${t('projects.weeklyPlanModal.stages.dissolution')}`, kw: ['浓度', 'mol', '体积', 'mL', '初浓', '密度'] },
        { label: `🧫 ${t('projects.weeklyPlanModal.stages.reaction')}`, kw: ['搅拌', '熟化', 'pH', 'ph', '滴加', '转速', 'rpm', '气氛', '反应', '沉淀', 'Na₂CO₃'] },
        { label: `🔧 ${t('projects.weeklyPlanModal.stages.postProcessing')}`, kw: ['洗涤', '过滤', '离心', '终点'] },
        { label: `🌡️ ${t('projects.weeklyPlanModal.stages.drying')}`, kw: ['干燥', '温度', '°C', '℃', '烘'] },
      ];
      const buckets: { key: string; value: string; unit: string }[][] = stagesDef.map(() => []);
      fullParams.forEach(fp => {
        const txt = `${fp.key}${fp.unit}`;
        let placed = false;
        for (let si = stagesDef.length - 1; si >= 0; si--) {
          if (stagesDef[si].kw.some(k => txt.includes(k))) { buckets[si].push(fp); placed = true; break; }
        }
        if (!placed) buckets[2].push(fp);
      });
      return stagesDef.map((s, i) => ({ label: s.label, params: buckets[i] })).filter(s => s.params.length > 0);
    };

    const stageColors = ['#eef2ff', '#ecfeff', '#f0fdf4', '#fffbeb', '#fff1f2'];
    const stageBorderColors = ['#c7d2fe', '#a5f3fc', '#bbf7d0', '#fde68a', '#fecdd3'];

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${t('projects.weeklyPlanModal.title')}</title>
<style>
  @page { size: A4; margin: 20mm 15mm; }
  body { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; font-size: 11px; color: #1e293b; line-height: 1.6; }
  h1 { text-align: center; font-size: 22px; color: #059669; margin-bottom: 4px; }
  .meta { text-align: center; color: #6b7280; font-size: 11px; margin-bottom: 16px; }
  .group { border: 2px solid #d1fae5; border-radius: 12px; margin-bottom: 20px; overflow: hidden; page-break-inside: avoid; }
  .group-header { background: linear-gradient(135deg, #ecfdf5, #f0fdfa); padding: 12px 16px; border-bottom: 1px solid #d1fae5; }
  .group-header h2 { font-size: 15px; margin: 0 0 4px; color: #065f46; }
  .group-header p { margin: 0; color: #6b7280; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11px; }
  th { background: #059669; color: white; padding: 8px 10px; text-align: center; font-size: 10px; }
  td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; text-align: center; }
  tr:nth-child(even) td { background: #f0fdf4; }
  .sample-badge { display: inline-block; padding: 2px 8px; border-radius: 6px; color: white; font-weight: 900; font-size: 10px; }
  .run-section { padding: 12px 16px; border-top: 1px solid #f1f5f9; }
  .run-title { font-weight: 900; color: #059669; font-size: 12px; margin-bottom: 6px; }
  .description { background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 10px; font-size: 11px; line-height: 1.8; margin-bottom: 10px; }
  .flow { display: flex; align-items: flex-start; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
  .flow-stage { border-radius: 8px; padding: 6px 10px; min-width: 100px; font-size: 10px; }
  .flow-stage-label { font-weight: 900; font-size: 9px; margin-bottom: 4px; }
  .flow-stage-item { font-family: Consolas, monospace; color: #374151; }
  .flow-arrow { display: flex; align-items: center; padding: 0 2px; font-size: 14px; color: #10b981; padding-top: 12px; }
  .section-label { font-size: 10px; font-weight: 900; color: #6b7280; margin: 12px 16px 6px; }
</style></head><body>
<h1>📋 ${t('projects.weeklyPlanModal.title')}</h1>
<div class="meta">
  ${t('projects.weeklyPlanModal.project')}: ${projectTitle}<br>
  ${t('projects.weeklyPlanModal.period')}: ${dateRange} · ${t('projects.weeklyPlanModal.groupCount', { count: experiments.length })} · ${t('projects.weeklyPlanModal.sampleCount', { count: totalRuns })}
</div>
${experiments.map((exp, ei) => {
  const badgeColors = ['#6366f1', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0891b2'];
  return `<div class="group">
    <div class="group-header">
      <h2>${t('projects.weeklyPlanModal.expGroup')} ${ei + 1}: ${exp.title}</h2>
      <p>${exp.notes}</p>
    </div>
    ${exp.matrix.length > 0 && exp.runs.length > 0 ? `
    <div class="section-label">📊 ${t('projects.weeklyPlanModal.matrixTitle')}</div>
    <div style="padding: 0 16px;">
    <table>
      <thead><tr>
        <th>${t('projects.weeklyPlanModal.sampleId')}</th>
        ${exp.matrix.map(m => `<th>${m.name}<br><span style="font-weight:normal;font-size:8px;opacity:0.7">${m.target}</span></th>`).join('')}
        <th>${t('projects.weeklyPlanModal.protocol')}</th>
      </tr></thead>
      <tbody>
        ${exp.runs.map((run, ri) => `<tr>
          <td><span class="sample-badge" style="background:${badgeColors[ri % badgeColors.length]}">${run.sampleId || 'Run-' + run.idx}</span></td>
          ${exp.matrix.map(m => `<td style="font-family:Consolas;font-weight:bold">${run.params[m.name] || '-'}</td>`).join('')}
          <td style="color:#9ca3af;font-size:9px">${run.label}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>` : ''}
    <div class="section-label">🧪 ${t('projects.weeklyPlanModal.procedureTitle')}</div>
    ${exp.runs.map((run) => {
      const stages = run.fullParams ? classifyParams(run.fullParams) : [];
      return `<div class="run-section">
        <div class="run-title">● ${run.sampleId || 'Run-' + run.idx} — ${run.label}</div>
        ${run.description ? `<div class="description">${run.description}</div>` : ''}
        ${stages.length > 0 ? `<div style="font-size:9px;font-weight:900;color:#059669;margin-bottom:4px">${t('projects.weeklyPlanModal.synthesisFlow')}</div>
        <div class="flow">
          ${stages.map((s, si) => `
            <div class="flow-stage" style="background:${stageColors[si % 5]};border:1px solid ${stageBorderColors[si % 5]}">
              <div class="flow-stage-label">${s.label}</div>
              ${s.params.map(fp => `<div class="flow-stage-item"><b>${fp.value}</b> ${fp.unit} ${fp.key}</div>`).join('')}
            </div>
            ${si < stages.length - 1 ? '<div class="flow-arrow">→</div>' : ''}
          `).join('')}
        </div>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}).join('')}
</body></html>`;

    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      setTimeout(() => {
        printWin.print();
      }, 300);
    }
  }, [experiments, projectTitle, dateRange, totalRuns, t]);

  // ── PNG 导出（通过离屏渲染 + html-to-image）──
  const handleExportPng = useCallback(async () => {
    setIsExportingPng(true);
    try {
      // 复用与 PDF 导出完全相同的 classifyParams 逻辑
      const classifyParams = (fullParams: { key: string; value: string; unit: string }[]) => {
        const stagesDef = [
          { label: `⚖️ ${t('projects.weeklyPlanModal.stages.weighing')}`, kw: ['用量', 'mg', ' g', '质量'] },
          { label: `🧪 ${t('projects.weeklyPlanModal.stages.dissolution')}`, kw: ['浓度', 'mol', '体积', 'mL', '初浓', '密度'] },
          { label: `🧫 ${t('projects.weeklyPlanModal.stages.reaction')}`, kw: ['搅拌', '熟化', 'pH', 'ph', '滴加', '转速', 'rpm', '气氛', '反应', '沉淀', 'Na₂CO₃'] },
          { label: `🔧 ${t('projects.weeklyPlanModal.stages.postProcessing')}`, kw: ['洗涤', '过滤', '离心', '终点'] },
          { label: `🌡️ ${t('projects.weeklyPlanModal.stages.drying')}`, kw: ['干燥', '温度', '°C', '℃', '烘'] },
        ];
        const buckets: { key: string; value: string; unit: string }[][] = stagesDef.map(() => []);
        fullParams.forEach(fp => {
          const txt = `${fp.key}${fp.unit}`;
          let placed = false;
          for (let si = stagesDef.length - 1; si >= 0; si--) {
            if (stagesDef[si].kw.some(k => txt.includes(k))) { buckets[si].push(fp); placed = true; break; }
          }
          if (!placed) buckets[2].push(fp);
        });
        return stagesDef.map((s, i) => ({ label: s.label, params: buckets[i] })).filter(s => s.params.length > 0);
      };

      const stageColors = ['#eef2ff', '#ecfeff', '#f0fdf4', '#fffbeb', '#fff1f2'];
      const stageBorderColors = ['#c7d2fe', '#a5f3fc', '#bbf7d0', '#fde68a', '#fecdd3'];
      const badgeColors = ['#6366f1', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0891b2'];

      // 构建与 PDF 完全相同的完整 HTML 内容
      const innerHtml = `
        <div style="padding:32px 24px;font-family:'PingFang SC','Microsoft YaHei','Helvetica Neue',sans-serif;color:#1e293b;line-height:1.6;background:#fff;width:800px;">
          <h1 style="text-align:center;font-size:22px;color:#059669;margin:0 0 4px;">📋 ${t('projects.weeklyPlanModal.title')}</h1>
          <div style="text-align:center;color:#6b7280;font-size:11px;margin-bottom:16px;">
            ${t('projects.weeklyPlanModal.project')}: ${projectTitle}<br>
            ${t('projects.weeklyPlanModal.period')}: ${dateRange} · ${t('projects.weeklyPlanModal.groupCount', { count: experiments.length })} · ${t('projects.weeklyPlanModal.sampleCount', { count: totalRuns })}
          </div>
          ${experiments.map((exp, ei) => `
            <div style="border:2px solid #d1fae5;border-radius:12px;margin-bottom:20px;overflow:hidden;">
              <div style="background:linear-gradient(135deg,#ecfdf5,#f0fdfa);padding:12px 16px;border-bottom:1px solid #d1fae5;">
                <h2 style="font-size:15px;margin:0 0 4px;color:#065f46;">${t('projects.weeklyPlanModal.expGroup')} ${ei + 1}: ${exp.title}</h2>
                <p style="margin:0;color:#6b7280;font-size:10px;">${exp.notes}</p>
              </div>
              ${exp.matrix.length > 0 && exp.runs.length > 0 ? `
              <div style="font-size:10px;font-weight:900;color:#6b7280;margin:12px 16px 6px;">📊 ${t('projects.weeklyPlanModal.matrixTitle')}</div>
              <div style="padding:0 16px;">
              <table style="width:100%;border-collapse:collapse;margin:0 0 12px;font-size:11px;">
                <thead><tr>
                  <th style="background:#059669;color:white;padding:8px 10px;text-align:center;font-size:10px;">${t('projects.weeklyPlanModal.sampleId')}</th>
                  ${exp.matrix.map(m => `<th style="background:#059669;color:white;padding:8px 10px;text-align:center;font-size:10px;">${m.name}<br><span style="font-weight:normal;font-size:8px;opacity:0.7">${m.target}</span></th>`).join('')}
                  <th style="background:#059669;color:white;padding:8px 10px;text-align:center;font-size:10px;">${t('projects.weeklyPlanModal.protocol')}</th>
                </tr></thead>
                <tbody>
                  ${exp.runs.map((run, ri) => `<tr style="background:${ri % 2 === 0 ? '#f0fdf4' : '#fff'}">
                    <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:center;"><span style="display:inline-block;padding:2px 8px;border-radius:6px;color:white;font-weight:900;font-size:10px;background:${badgeColors[ri % badgeColors.length]}">${run.sampleId || 'Run-' + run.idx}</span></td>
                    ${exp.matrix.map(m => `<td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:center;font-family:Consolas,monospace;font-weight:bold">${run.params[m.name] || '-'}</td>`).join('')}
                    <td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;text-align:center;color:#9ca3af;font-size:9px;">${run.label}</td>
                  </tr>`).join('')}
                </tbody>
              </table></div>` : ''}
              <div style="font-size:10px;font-weight:900;color:#6b7280;margin:12px 16px 6px;">🧪 ${t('projects.weeklyPlanModal.procedureTitle')}</div>
              ${exp.runs.map((run) => {
                const stages = run.fullParams ? classifyParams(run.fullParams) : [];
                return `<div style="padding:12px 16px;border-top:1px solid #f1f5f9;">
                  <div style="font-weight:900;color:#059669;font-size:12px;margin-bottom:6px;">● ${run.sampleId || 'Run-' + run.idx} — ${run.label}</div>
                  ${run.description ? `<div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:10px;font-size:11px;line-height:1.8;margin-bottom:10px;">${run.description}</div>` : ''}
                  ${stages.length > 0 ? `<div style="font-size:9px;font-weight:900;color:#059669;margin-bottom:4px;">${t('projects.weeklyPlanModal.synthesisFlow')}</div>
                  <div style="display:flex;align-items:flex-start;gap:4px;flex-wrap:wrap;margin-top:8px;">
                    ${stages.map((s, si) => `
                      <div style="border-radius:8px;padding:6px 10px;min-width:100px;font-size:10px;background:${stageColors[si % 5]};border:1px solid ${stageBorderColors[si % 5]}">
                        <div style="font-weight:900;font-size:9px;margin-bottom:4px;">${s.label}</div>
                        ${s.params.map(fp => `<div style="font-family:Consolas,monospace;color:#374151;"><b>${fp.value}</b> ${fp.unit} ${fp.key}</div>`).join('')}
                      </div>
                      ${si < stages.length - 1 ? '<div style="display:flex;align-items:center;padding:0 2px;font-size:14px;color:#10b981;padding-top:12px;">→</div>' : ''}
                    `).join('')}
                  </div>` : ''}
                </div>`;
              }).join('')}
            </div>
          `).join('')}
        </div>
      `;

      // 创建离屏容器渲染完整内容
      const offscreen = document.createElement('div');
      offscreen.style.position = 'fixed';
      offscreen.style.left = '-9999px';
      offscreen.style.top = '0';
      offscreen.style.zIndex = '-1';
      offscreen.innerHTML = innerHtml;
      document.body.appendChild(offscreen);

      // 等待渲染
      await new Promise(r => setTimeout(r, 100));

      const target = offscreen.firstElementChild as HTMLElement;
      const dataUrl = await toPng(target, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      // 清理离屏 DOM
      document.body.removeChild(offscreen);

      const link = document.createElement('a');
      link.download = `Weekly_Plan_${formatDate(now).replace(/\./g, '')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export PNG error:', err);
    } finally {
      setIsExportingPng(false);
    }
  }, [experiments, projectTitle, dateRange, totalRuns, t]);

  if (!show || experiments.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[2200] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-[3rem] animate-reveal shadow-2xl border-4 border-emerald-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <header className="px-8 py-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-[1.5rem] flex items-center justify-center text-2xl shadow-inner border border-white/20">
                <i className="fa-solid fa-clipboard-list"></i>
              </div>
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter">{t('projects.weeklyPlanModal.title')}</h3>
                <p className="text-[9px] font-black text-emerald-200 uppercase tracking-[0.2rem] mt-1">
                  {dateRange} · {t('projects.weeklyPlanModal.groupCount', { count: experiments.length })} · {t('projects.weeklyPlanModal.sampleCount', { count: totalRuns })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportPdf}
                className="px-4 py-2 bg-white/15 backdrop-blur-md rounded-xl text-[10px] font-black uppercase border border-white/20 hover:bg-white/25 transition-all active:scale-95 flex items-center gap-2"
              >
                <i className="fa-solid fa-file-pdf"></i>
                {t('projects.weeklyPlanModal.exportPdf')}
              </button>
              <button
                onClick={handleExportWord}
                disabled={isExporting}
                className="px-4 py-2 bg-white/15 backdrop-blur-md rounded-xl text-[10px] font-black uppercase border border-white/20 hover:bg-white/25 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
              >
                <i className={`fa-solid ${isExporting ? 'fa-spinner animate-spin' : 'fa-file-word'}`}></i>
                {isExporting ? t('projects.weeklyPlanModal.exporting') : t('projects.weeklyPlanModal.exportWord')}
              </button>
              <button
                onClick={handleExportPng}
                disabled={isExportingPng}
                className="px-4 py-2 bg-white/15 backdrop-blur-md rounded-xl text-[10px] font-black uppercase border border-white/20 hover:bg-white/25 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
              >
                <i className={`fa-solid ${isExportingPng ? 'fa-spinner animate-spin' : 'fa-file-image'}`}></i>
                {isExportingPng ? t('projects.weeklyPlanModal.exporting') : t('projects.weeklyPlanModal.exportPng')}
              </button>
            </div>
          </div>
          <div className="mt-3 px-3 py-2 bg-white/10 rounded-xl">
            <p className="text-[10px] font-bold text-emerald-100">
              <i className="fa-solid fa-flask mr-1.5"></i>{t('projects.weeklyPlanModal.project')}: {projectTitle}
            </p>
          </div>
        </header>

        {/* Body */}
        <div ref={contentRef} className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
          {experiments.map((exp, ei) => (
            <div key={ei} className="rounded-2xl border-2 border-emerald-100 overflow-hidden bg-white shadow-sm">
              {/* Experiment Group Header */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4 border-b border-emerald-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-7 h-7 bg-emerald-500 text-white rounded-xl flex items-center justify-center text-[11px] font-black shadow-sm">{ei + 1}</span>
                  <h4 className="text-[14px] font-black text-slate-800">{t('projects.weeklyPlanModal.expGroup')} {ei + 1}: {exp.title}</h4>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-1 pl-9">{exp.notes}</p>
              </div>

              {/* Matrix Comparison Table */}
              {exp.matrix.length > 0 && exp.runs.length > 0 && (
                <div className="px-5 py-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-3 flex items-center gap-1.5">
                    <i className="fa-solid fa-table text-emerald-400"></i> {t('projects.weeklyPlanModal.matrixTitle')}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="text-left px-3 py-2.5 font-black text-emerald-600 uppercase text-[9px] border-b-2 border-emerald-200">{t('projects.weeklyPlanModal.sampleId')}</th>
                          {exp.matrix.map((m, mi) => (
                            <th key={mi} className="text-center px-3 py-2.5 font-black text-slate-500 uppercase text-[9px] border-b-2 border-slate-200">
                              {m.name}
                              <span className="block text-[7px] font-bold text-slate-300 mt-0.5">{m.target}</span>
                            </th>
                          ))}
                          <th className="text-center px-3 py-2.5 font-black text-slate-400 uppercase text-[8px] border-b-2 border-slate-200">{t('projects.weeklyPlanModal.protocol')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exp.runs.map((run, ri) => {
                          const colors = ['bg-indigo-500', 'bg-rose-500', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-cyan-500'];
                          const bgColor = colors[ri % colors.length];
                          return (
                            <tr key={ri} className="border-t border-slate-100 hover:bg-emerald-50/40 transition-colors">
                              <td className="px-3 py-2.5">
                                <span className={`inline-block px-2 py-0.5 ${bgColor} text-white text-[9px] font-black rounded-md shadow-sm`}>
                                  {run.sampleId || `Run-${run.idx}`}
                                </span>
                              </td>
                              {exp.matrix.map((m, mi) => (
                                <td key={mi} className="text-center px-3 py-2.5 font-bold text-slate-700 font-mono text-[11px]">
                                  {run.params[m.name] || '-'}
                                </td>
                              ))}
                              <td className="text-center px-3 py-2.5 text-[9px] text-slate-400 font-bold">{run.label}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Detailed Procedures */}
              <div className="px-5 pb-4 space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1.5">
                  <i className="fa-solid fa-flask-vial text-violet-400"></i> {t('projects.weeklyPlanModal.procedureTitle')}
                </p>
                {exp.runs.map((run, ri) => {
                  const runKey = `${ei}-${ri}`;
                  const isExpanded = expandedRun === runKey;
                  return (
                    <div key={ri} className="rounded-xl border border-slate-100 overflow-hidden">
                      <button
                        onClick={() => setExpandedRun(isExpanded ? null : runKey)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                      >
                        <i className={`fa-solid ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-[8px] text-slate-300 w-3`}></i>
                        <span className="text-[10px] font-black text-emerald-600">{run.sampleId || `Run-${run.idx}`}</span>
                        <span className="text-[9px] text-slate-400 font-bold">— {run.label}</span>
                        {run.description && <span className="text-[8px] text-slate-300 ml-auto">{run.description.substring(0, 30)}…</span>}
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-3 pt-0 animate-reveal">
                          {run.description && (
                            <div className="bg-violet-50/50 rounded-xl p-3 border border-violet-100">
                              <p className="text-[11px] text-slate-700 leading-[1.8] whitespace-pre-wrap">{run.description}</p>
                            </div>
                          )}
                          {run.fullParams && run.fullParams.length > 0 && (() => {
                            // 按关键词自动归类到合成阶段
                            const stages: { icon: string; label: string; color: string; bg: string; border: string; params: typeof run.fullParams }[] = [
                              { icon: 'fa-scale-balanced', label: t('projects.weeklyPlanModal.stages.weighing'), color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', params: [] },
                              { icon: 'fa-flask', label: t('projects.weeklyPlanModal.stages.dissolution'), color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', params: [] },
                              { icon: 'fa-vial', label: t('projects.weeklyPlanModal.stages.reaction'), color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', params: [] },
                              { icon: 'fa-filter', label: t('projects.weeklyPlanModal.stages.postProcessing'), color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', params: [] },
                              { icon: 'fa-temperature-high', label: t('projects.weeklyPlanModal.stages.drying'), color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', params: [] },
                            ];
                            const materialKw = ['用量', 'mg', ' g', '质量'];
                            const solutionKw = ['浓度', 'mol', '体积', 'mL', '初浓', '密度'];
                            const reactionKw = ['搅拌', '熟化', 'pH', 'ph', '滴加', '转速', 'rpm', '气氛', '反应', '沉淀', 'Na₂CO₃'];
                            const postKw = ['洗涤', '过滤', '离心', '终点'];
                            const dryKw = ['干燥', '温度', '°C', '℃', '烘'];

                            run.fullParams!.forEach(fp => {
                              const txt = `${fp.key}${fp.unit}`;
                              if (dryKw.some(k => txt.includes(k))) stages[4].params!.push(fp);
                              else if (postKw.some(k => txt.includes(k))) stages[3].params!.push(fp);
                              else if (reactionKw.some(k => txt.includes(k))) stages[2].params!.push(fp);
                              else if (solutionKw.some(k => txt.includes(k))) stages[1].params!.push(fp);
                              else if (materialKw.some(k => txt.includes(k))) stages[0].params!.push(fp);
                              else stages[2].params!.push(fp); // 默认归入反应工艺
                            });

                            const activeStages = stages.filter(s => s.params!.length > 0);

                            return (
                              <div className="mt-3 pt-3 border-t border-violet-100">
                                <p className="text-[8px] font-black text-slate-400 mb-2 flex items-center gap-1">
                                  <i className="fa-solid fa-diagram-project text-emerald-400"></i> {t('projects.weeklyPlanModal.synthesisFlow')}
                                </p>
                                <div className="flex items-start gap-0 overflow-x-auto pb-2">
                                  {activeStages.map((stage, si) => (
                                    <div key={si} className="flex items-start shrink-0">
                                      {/* 阶段卡片 */}
                                      <div className={`${stage.bg} border ${stage.border} rounded-xl px-3 py-2 min-w-[120px] max-w-[180px]`}>
                                        <div className={`text-[8px] font-black ${stage.color} flex items-center gap-1 mb-1.5`}>
                                          <i className={`fa-solid ${stage.icon} text-[9px]`}></i>
                                          {stage.label}
                                        </div>
                                        <div className="space-y-0.5">
                                          {stage.params!.map((fp, fpi) => (
                                            <div key={fpi} className="text-[9px] text-slate-700 leading-tight">
                                              <span className="font-mono font-bold">{fp.value}</span>
                                              <span className="text-slate-400 ml-0.5">{fp.unit}</span>
                                              <span className="text-slate-400 ml-1">{fp.key}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                      {/* 箭头 */}
                                      {si < activeStages.length - 1 && (
                                        <div className="flex items-center px-1 pt-4 shrink-0">
                                          <i className="fa-solid fa-arrow-right text-[10px] text-slate-300"></i>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-white border-t border-slate-100 shrink-0 flex gap-3">
          <button
            onClick={handleExportPdf}
            className="flex-1 py-4 bg-rose-50 text-rose-600 rounded-2xl text-[11px] font-black uppercase hover:bg-rose-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2 border border-rose-200"
          >
            <i className="fa-solid fa-file-pdf"></i>
            {t('projects.weeklyPlanModal.exportPdf')}
          </button>
          <button
            onClick={handleExportWord}
            disabled={isExporting}
            className="flex-1 py-4 bg-blue-50 text-blue-600 rounded-2xl text-[11px] font-black uppercase hover:bg-blue-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2 border border-blue-200 disabled:opacity-50"
          >
            <i className={`fa-solid ${isExporting ? 'fa-spinner animate-spin' : 'fa-file-word'}`}></i>
            {isExporting ? t('projects.weeklyPlanModal.exporting') : t('projects.weeklyPlanModal.exportWord')}
          </button>
          <button
            onClick={handleExportPng}
            disabled={isExportingPng}
            className="flex-1 py-4 bg-purple-50 text-purple-600 rounded-2xl text-[11px] font-black uppercase hover:bg-purple-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2 border border-purple-200 disabled:opacity-50"
          >
            <i className={`fa-solid ${isExportingPng ? 'fa-spinner animate-spin' : 'fa-file-image'}`}></i>
            {isExportingPng ? t('projects.weeklyPlanModal.exporting') : t('projects.weeklyPlanModal.exportPng')}
          </button>
          <button
            onClick={onClose}
            className="flex-[2] py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-check-circle"></i>
            {t('weeklyPlanModal.confirmStart')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeeklyExperimentPlanModal;
