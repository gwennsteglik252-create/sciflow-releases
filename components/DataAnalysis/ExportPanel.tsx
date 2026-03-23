/**
 * ExportPanel — 高清图片导出面板
 *
 * 支持：
 * - PNG 高清位图 (300+ DPI, pixelRatio up to 6x)
 * - SVG 矢量图 (完整 DOM → SVG)
 * - PDF (系统打印对话框)
 */
import React, { useState, useMemo, useCallback, RefObject } from 'react';
import ReactDOM from 'react-dom';
import * as htmlToImage from 'html-to-image';
import { printElement } from '../../utils/printUtility';

type ExportFormat = 'png' | 'svg' | 'pdf';

interface SizePreset {
  label: string;
  width: number;
  height: number;
  description: string;
}

interface ExportPanelProps {
  show: boolean;
  onClose: () => void;
  chartContainerRef: RefObject<HTMLDivElement>;
  chartTitle: string;
}

const SIZE_PRESETS: SizePreset[] = [
  { label: '标准', width: 1200, height: 900, description: '适合报告插图' },
  { label: '高清', width: 2400, height: 1800, description: '适合期刊投稿' },
  { label: '超高清', width: 3600, height: 2700, description: '适合海报/PPT' },
  { label: '4K', width: 4800, height: 3600, description: '最高画质' },
];

const FORMAT_CONFIG: Record<ExportFormat, { label: string; icon: string; color: string; desc: string }> = {
  png: { label: 'PNG 高清位图', icon: 'fa-image', color: 'bg-indigo-500', desc: '300+ DPI 位图，兼容所有场景' },
  svg: { label: 'SVG 矢量图', icon: 'fa-bezier-curve', color: 'bg-emerald-500', desc: '无限缩放，适合论文排版' },
  pdf: { label: 'PDF 文档', icon: 'fa-file-pdf', color: 'bg-rose-500', desc: '通过系统打印生成 PDF' },
};

const ExportPanel: React.FC<ExportPanelProps> = ({ show, onClose, chartContainerRef, chartTitle }) => {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(1); // 默认「高清」
  const [customWidth, setCustomWidth] = useState(2400);
  const [customHeight, setCustomHeight] = useState(1800);
  const [useCustom, setUseCustom] = useState(false);
  const [bgTransparent, setBgTransparent] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const exportWidth = useCustom ? customWidth : SIZE_PRESETS[selectedPresetIdx].width;
  const exportHeight = useCustom ? customHeight : SIZE_PRESETS[selectedPresetIdx].height;

  // 计算等效 DPI：基于图表容器的 CSS 物理像素宽度
  const equivalentDPI = useMemo(() => {
    const el = chartContainerRef.current;
    if (!el) return 300;
    const cssWidth = el.getBoundingClientRect().width;
    // 假设屏幕为 96dpi 基准
    const physicalInches = cssWidth / 96;
    return Math.round(exportWidth / physicalInches);
  }, [exportWidth, chartContainerRef, show]);

  const handleExport = useCallback(async () => {
    const targetEl = chartContainerRef.current;
    if (!targetEl) return;

    setIsExporting(true);
    const safeName = (chartTitle || 'SciFlow_Chart').replace(/[\\/:*?"<>|]/g, '_');

    try {
      // 找到图表渲染区域
      const renderTarget = targetEl.querySelector('.lab-chart-responsive') as HTMLElement || targetEl;

      if (format === 'png') {
        const cssW = renderTarget.getBoundingClientRect().width;
        const pixelRatio = Math.max(2, exportWidth / cssW);

        const dataUrl = await htmlToImage.toPng(renderTarget, {
          quality: 1.0,
          pixelRatio,
          backgroundColor: bgTransparent ? undefined : '#ffffff',
          skipFonts: true,
          cacheBust: true,
          filter: (node: HTMLElement) => {
            // 排除导出时不需要的交互元素
            if (node.classList?.contains?.('recharts-tooltip-wrapper')) return false;
            return true;
          },
        });

        // 下载
        const link = document.createElement('a');
        link.download = `${safeName}_${exportWidth}x${exportHeight}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

      } else if (format === 'svg') {
        const svgDataUrl = await htmlToImage.toSvg(renderTarget, {
          backgroundColor: bgTransparent ? undefined : '#ffffff',
          skipFonts: true,
          cacheBust: true,
          filter: (node: HTMLElement) => {
            if (node.classList?.contains?.('recharts-tooltip-wrapper')) return false;
            return true;
          },
        });

        // data:image/svg+xml → Blob → download
        const svgContent = decodeURIComponent(svgDataUrl.split(',')[1]);
        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${safeName}.svg`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

      } else if (format === 'pdf') {
        await printElement(targetEl, safeName);
      }

    } catch (err) {
      console.error('导出失败:', err);
    } finally {
      setIsExporting(false);
    }
  }, [format, exportWidth, exportHeight, bgTransparent, chartContainerRef, chartTitle]);

  if (!show) return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.2), rgba(0,0,0,0.5))',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 480, maxHeight: '85vh',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.97), rgba(248,250,252,0.99))',
          borderRadius: '1.5rem',
          boxShadow: '0 25px 60px -12px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.6)',
          overflow: 'hidden',
          animation: 'exportPanelIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        {/* 顶部装饰条 */}
        <div style={{ height: 4, background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)' }} />

        {/* 标题 */}
        <div style={{ padding: '20px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', boxShadow: '0 4px 14px rgba(99,102,241,0.15)',
            }}>
              <i className="fa-solid fa-file-export" style={{ color: '#6366f1', fontSize: 14 }} />
            </div>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1e293b', margin: 0 }}>超高清导出</h3>
              <p style={{ fontSize: 10, color: '#94a3b8', margin: 0, fontWeight: 600 }}>PNG 300+DPI / SVG 矢量 / PDF</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '0.5rem', border: 'none', cursor: 'pointer',
              background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseOver={e => (e.currentTarget.style.background = '#e2e8f0')}
            onMouseOut={e => (e.currentTarget.style.background = '#f1f5f9')}
          >
            <i className="fa-solid fa-xmark" style={{ fontSize: 12, color: '#64748b' }} />
          </button>
        </div>

        <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', maxHeight: 'calc(85vh - 120px)' }}>

          {/* ── 格式选择 ── */}
          <div>
            <label style={{ fontSize: 9, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'block' }}>
              导出格式
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(Object.entries(FORMAT_CONFIG) as [ExportFormat, typeof FORMAT_CONFIG[ExportFormat]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setFormat(key)}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: '0.75rem', border: '2px solid',
                    borderColor: format === key ? '#6366f1' : '#e2e8f0',
                    background: format === key ? '#eef2ff' : '#ffffff',
                    cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '0.5rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: format === key ? cfg.color : '#f1f5f9',
                    transition: 'all 0.15s',
                  }}>
                    <i className={`fa-solid ${cfg.icon}`} style={{ fontSize: 11, color: format === key ? '#fff' : '#94a3b8' }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: format === key ? '#4338ca' : '#64748b' }}>
                    {key.toUpperCase()}
                  </span>
                </button>
              ))}
            </div>
            <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 6, fontWeight: 500 }}>
              {FORMAT_CONFIG[format].desc}
            </p>
          </div>

          {/* ── 尺寸设置 (PNG 可用，其他格式保留占位但禁用) ── */}
          <div style={{
            opacity: format === 'png' ? 1 : 0.35,
            pointerEvents: format === 'png' ? 'auto' : 'none',
            transition: 'opacity 0.2s',
          }}>
            <label style={{ fontSize: 9, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, display: 'block' }}>
              导出尺寸 {format !== 'png' && <span style={{ fontSize: 8, fontWeight: 600, color: '#cbd5e1', textTransform: 'none' }}>（仅 PNG）</span>}
            </label>

            {/* 预设按钮 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
              {SIZE_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => { setSelectedPresetIdx(idx); setUseCustom(false); }}
                  style={{
                    padding: '8px 4px', borderRadius: '0.625rem',
                    border: '1.5px solid',
                    borderColor: !useCustom && selectedPresetIdx === idx ? '#6366f1' : '#e2e8f0',
                    background: !useCustom && selectedPresetIdx === idx ? '#eef2ff' : '#fff',
                    cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 800, color: !useCustom && selectedPresetIdx === idx ? '#4338ca' : '#475569' }}>
                    {preset.label}
                  </span>
                  <span style={{ fontSize: 8, color: '#94a3b8', fontWeight: 600 }}>
                    {preset.width}×{preset.height}
                  </span>
                </button>
              ))}
            </div>

            {/* 自定义 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: '0.625rem',
              border: '1.5px solid', borderColor: useCustom ? '#6366f1' : '#e2e8f0',
              background: useCustom ? '#eef2ff' : '#fafafa',
              cursor: 'pointer',
            }}
              onClick={() => setUseCustom(true)}
            >
              <div style={{
                width: 16, height: 16, borderRadius: '50%', border: '2px solid',
                borderColor: useCustom ? '#6366f1' : '#cbd5e1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {useCustom && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1' }} />}
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', marginRight: 'auto' }}>自定义</span>
              <input
                type="number" min={200} max={8000} step={100}
                value={customWidth}
                onChange={e => { setCustomWidth(parseInt(e.target.value) || 2400); setUseCustom(true); }}
                onClick={e => { e.stopPropagation(); setUseCustom(true); }}
                style={{
                  width: 64, padding: '3px 6px', borderRadius: '0.375rem',
                  border: '1px solid #cbd5e1', fontSize: 11, fontWeight: 700,
                  textAlign: 'center', outline: 'none', fontFamily: 'monospace',
                }}
              />
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>×</span>
              <input
                type="number" min={200} max={8000} step={100}
                value={customHeight}
                onChange={e => { setCustomHeight(parseInt(e.target.value) || 1800); setUseCustom(true); }}
                onClick={e => { e.stopPropagation(); setUseCustom(true); }}
                style={{
                  width: 64, padding: '3px 6px', borderRadius: '0.375rem',
                  border: '1px solid #cbd5e1', fontSize: 11, fontWeight: 700,
                  textAlign: 'center', outline: 'none', fontFamily: 'monospace',
                }}
              />
              <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>px</span>
            </div>
          </div>

          {/* ── 背景设置 (PNG/SVG 可用，PDF 保留占位但禁用) ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            opacity: format !== 'pdf' ? 1 : 0.35,
            pointerEvents: format !== 'pdf' ? 'auto' : 'none',
            transition: 'opacity 0.2s',
          }}>
            <div>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#475569' }}>透明背景</span>
              <p style={{ fontSize: 9, color: '#94a3b8', margin: 0 }}>移除白色背景，适合叠加使用</p>
            </div>
            <button
              onClick={() => setBgTransparent(!bgTransparent)}
              style={{
                width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                background: bgTransparent && format !== 'pdf' ? '#6366f1' : '#cbd5e1',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                left: bgTransparent && format !== 'pdf' ? 21 : 3,
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }} />
            </button>
          </div>

          {/* ── 规格预览 ── */}
          <div style={{
            padding: '12px 14px', borderRadius: '0.75rem',
            background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                导出规格
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 16, fontWeight: 900, color: '#4338ca', margin: 0, fontFamily: 'monospace' }}>
                  {format === 'svg' ? '∞' : format === 'pdf' ? '-' : `${exportWidth}×${exportHeight}`}
                </p>
                <p style={{ fontSize: 8, color: '#94a3b8', margin: 0, fontWeight: 700, textTransform: 'uppercase' }}>
                  {format === 'svg' ? '矢量' : format === 'pdf' ? '打印' : '像素'}
                </p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 16, fontWeight: 900, color: '#059669', margin: 0, fontFamily: 'monospace' }}>
                  {format === 'svg' ? '矢量' : format === 'pdf' ? '-' : `${equivalentDPI}`}
                </p>
                <p style={{ fontSize: 8, color: '#94a3b8', margin: 0, fontWeight: 700, textTransform: 'uppercase' }}>
                  {format === 'pdf' ? '-' : 'DPI'}
                </p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 16, fontWeight: 900, color: '#dc2626', margin: 0, fontFamily: 'monospace' }}>
                  {format.toUpperCase()}
                </p>
                <p style={{ fontSize: 8, color: '#94a3b8', margin: 0, fontWeight: 700, textTransform: 'uppercase' }}>格式</p>
              </div>
            </div>
            {format === 'png' && equivalentDPI >= 300 && (
              <div style={{
                marginTop: 8, padding: '4px 8px', borderRadius: '0.375rem',
                background: '#dcfce7', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <i className="fa-solid fa-circle-check" style={{ fontSize: 9, color: '#16a34a' }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: '#15803d' }}>满足期刊投稿 300+ DPI 要求</span>
              </div>
            )}
            {format === 'png' && equivalentDPI < 300 && (
              <div style={{
                marginTop: 8, padding: '4px 8px', borderRadius: '0.375rem',
                background: '#fef3c7', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 9, color: '#d97706' }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: '#92400e' }}>DPI 不足 300，建议选择更大尺寸</span>
              </div>
            )}
          </div>

          {/* ── 导出按钮 ── */}
          <button
            onClick={handleExport}
            disabled={isExporting}
            style={{
              width: '100%', padding: '12px 0', borderRadius: '0.75rem',
              border: 'none', cursor: isExporting ? 'wait' : 'pointer',
              background: isExporting ? '#94a3b8' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', fontSize: 12, fontWeight: 900,
              textTransform: 'uppercase', letterSpacing: '0.05em',
              boxShadow: isExporting ? 'none' : '0 8px 25px rgba(99,102,241,0.35)',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {isExporting ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 12 }} />
                <span>正在导出...</span>
              </>
            ) : (
              <>
                <i className={`fa-solid ${FORMAT_CONFIG[format].icon}`} style={{ fontSize: 12 }} />
                <span>导出 {format.toUpperCase()}</span>
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes exportPanelIn {
          from { opacity: 0; transform: scale(0.88) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default ExportPanel;
