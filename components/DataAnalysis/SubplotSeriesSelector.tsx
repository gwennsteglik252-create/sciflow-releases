/**
 * SubplotSeriesSelector — 子图面板设置面板（完整版）
 *
 * 点击子图面板后在左侧显示，提供完整的面板属性编辑：
 * 图表类型、标题/轴标签、线条/数据点、字体设置、轴线外观、坐标轴范围、
 * 刻度/网格/坐标框、标签定位、数据系列分配
 */
import React from 'react';
import { DataSeries, SubplotPanel } from '../../types';

interface SubplotSeriesSelectorProps {
  panel: SubplotPanel;
  seriesList: DataSeries[];
  onAssignSeries: (panelId: string, seriesIds: string[]) => void;
  onUpdatePanel: (panelId: string, updates: Partial<SubplotPanel>) => void;
  onClose: () => void;
  // 全局默认值（用于 placeholder 提示）
  globalStrokeWidth?: number;
  globalPointSize?: number;
  globalFontSize?: number;
  globalAxisLabelFontSize?: number;
  globalTickFontSize?: number;
  globalAxisLineWidth?: number;
  globalGridLineWidth?: number;
}

const CHART_TYPES = [
  { value: 'line', label: '折线图', icon: 'fa-chart-line' },
  { value: 'scatter', label: '散点图', icon: 'fa-braille' },
  { value: 'bar', label: '柱状图', icon: 'fa-chart-bar' },
  { value: 'area', label: '面积图', icon: 'fa-chart-area' },
];

const POINT_SHAPES = [
  { value: 'circle', label: '圆' },
  { value: 'square', label: '方' },
  { value: 'diamond', label: '菱' },
  { value: 'triangleUp', label: '▲' },
  { value: 'triangleDown', label: '▼' },
  { value: 'cross', label: '+' },
  { value: 'star', label: '★' },
  { value: 'none', label: '无' },
];

const FONT_OPTIONS = [
  { value: '', label: '继承全局' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Times New Roman, serif', label: 'Times NR' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: '"Courier New", monospace', label: 'Courier' },
];

const SubplotSeriesSelector: React.FC<SubplotSeriesSelectorProps> = ({
  panel, seriesList, onAssignSeries, onUpdatePanel, onClose,
  globalStrokeWidth = 2, globalPointSize = 5, globalFontSize = 14,
  globalAxisLabelFontSize = 12, globalTickFontSize = 10,
  globalAxisLineWidth = 1.5, globalGridLineWidth = 0.5,
}) => {
  const selectedIds = new Set(panel.seriesIds);

  const toggleSeries = (seriesId: string) => {
    const next = selectedIds.has(seriesId)
      ? panel.seriesIds.filter(id => id !== seriesId)
      : [...panel.seriesIds, seriesId];
    onAssignSeries(panel.id, next);
  };

  const selectAll = () => onAssignSeries(panel.id, seriesList.map(s => s.id));
  const clearAll = () => onAssignSeries(panel.id, []);

  const autoFitDomain = () => {
    const assignedSeries = seriesList.filter(s => panel.seriesIds.includes(s.id));
    const allX = assignedSeries.flatMap(s => s.data.map((d: any) => parseFloat(d.name)).filter((v: number) => !isNaN(v)));
    const allY = assignedSeries.flatMap(s => s.data.map((d: any) => d.value).filter((v: number) => !isNaN(v)));
    if (allX.length > 0 && allY.length > 0) {
      const pad = (min: number, max: number) => {
        const range = max - min || 1;
        return [min - range * 0.05, max + range * 0.05];
      };
      onUpdatePanel(panel.id, {
        xDomain: pad(Math.min(...allX), Math.max(...allX)) as [number, number],
        yDomain: pad(Math.min(...allY), Math.max(...allY)) as [number, number],
      });
    }
  };

  /** 小型开关组件 */
  const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!value)}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[8px] font-bold transition-all border ${
        value
          ? 'bg-violet-600 text-white border-violet-500'
          : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300'
      }`}
    >
      <i className={`fa-solid ${value ? 'fa-toggle-on' : 'fa-toggle-off'} text-[10px]`} />
      {label}
    </button>
  );

  /** 数值输入小组件 */
  const NumInput = ({ label, value, placeholder, onChange, min, max, step }: {
    label: string; value: number | undefined; placeholder: string;
    onChange: (v: number | undefined) => void; min?: number; max?: number; step?: number;
  }) => (
    <div>
      <div className="text-[7px] font-bold text-slate-400 mb-0.5">{label}</div>
      <input
        type="number" min={min} max={max} step={step}
        className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 text-[9px] font-bold text-slate-700 outline-none focus:border-violet-400"
        placeholder={placeholder}
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-3 animate-reveal">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-slate-700 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center text-sm font-black">
            {panel.label}
          </span>
          子图面板设置
        </h3>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 flex items-center justify-center transition-all text-[10px]"
        >
          <i className="fa-solid fa-xmark" />
        </button>
      </div>

      {/* ── 1. 图表类型 ── */}
      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100">
        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">图表类型</div>
        <div className="grid grid-cols-4 gap-1.5">
          {CHART_TYPES.map(ct => (
            <button
              key={ct.value}
              onClick={() => onUpdatePanel(panel.id, { chartType: ct.value })}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[8px] font-black uppercase transition-all border ${
                panel.chartType === ct.value
                  ? 'bg-violet-600 text-white border-violet-500 shadow-md'
                  : 'bg-white text-slate-500 border-slate-100 hover:border-violet-300'
              }`}
            >
              <i className={`fa-solid ${ct.icon} text-xs`} />
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 2. 标题与轴标签 ── */}
      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-2">
        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">标题与轴标签</div>
        <input
          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-700 outline-none focus:border-violet-400"
          placeholder="面板标题"
          value={panel.chartTitle}
          onChange={e => onUpdatePanel(panel.id, { chartTitle: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-700 outline-none focus:border-violet-400"
            placeholder="X 轴标签"
            value={panel.xAxisLabel}
            onChange={e => onUpdatePanel(panel.id, { xAxisLabel: e.target.value })}
          />
          <input
            className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-700 outline-none focus:border-violet-400"
            placeholder="Y 轴标签"
            value={panel.yAxisLabel}
            onChange={e => onUpdatePanel(panel.id, { yAxisLabel: e.target.value })}
          />
        </div>
      </div>

      {/* ── 3. 线条与数据点 ── */}
      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-2">
        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">线条与数据点</div>
        <div className="grid grid-cols-2 gap-2">
          <NumInput label="线宽" value={panel.strokeWidth} placeholder={`${globalStrokeWidth}`} onChange={v => onUpdatePanel(panel.id, { strokeWidth: v })} min={0.5} max={10} step={0.5} />
          <NumInput label="点大小" value={panel.pointSize} placeholder={`${globalPointSize}`} onChange={v => onUpdatePanel(panel.id, { pointSize: v })} min={1} max={20} step={1} />
        </div>
        <div>
          <div className="text-[7px] font-bold text-slate-400 mb-1">数据点形状</div>
          <div className="grid grid-cols-4 gap-1">
            {POINT_SHAPES.map(ps => (
              <button
                key={ps.value}
                onClick={() => onUpdatePanel(panel.id, { pointShape: ps.value })}
                className={`py-1 px-1 rounded-md text-[8px] font-bold transition-all border text-center ${
                  (panel.pointShape || '') === ps.value
                    ? 'bg-violet-600 text-white border-violet-500'
                    : 'bg-white text-slate-500 border-slate-100 hover:border-violet-300'
                }`}
              >
                {ps.label}
              </button>
            ))}
          </div>
          {panel.pointShape && (
            <button
              onClick={() => onUpdatePanel(panel.id, { pointShape: undefined })}
              className="mt-1 text-[7px] font-bold text-slate-400 hover:text-violet-500 transition-colors"
            >
              ↩ 恢复全局默认
            </button>
          )}
        </div>
      </div>

      {/* ── 4. 字体设置 ── */}
      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-2">
        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">字体设置</div>
        <div className="grid grid-cols-3 gap-2">
          <NumInput label="标题字号" value={panel.fontSize} placeholder={`${globalFontSize}`} onChange={v => onUpdatePanel(panel.id, { fontSize: v })} min={8} max={28} step={1} />
          <NumInput label="轴标签字号" value={panel.axisLabelFontSize} placeholder={`${globalAxisLabelFontSize}`} onChange={v => onUpdatePanel(panel.id, { axisLabelFontSize: v })} min={6} max={24} step={1} />
          <NumInput label="刻度字号" value={panel.tickFontSize} placeholder={`${globalTickFontSize}`} onChange={v => onUpdatePanel(panel.id, { tickFontSize: v })} min={6} max={20} step={1} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-[7px] font-bold text-slate-400 mb-0.5">标题字体</div>
            <select className="w-full px-1.5 py-1 rounded-md bg-white border border-slate-200 text-[8px] font-bold text-slate-700 outline-none focus:border-violet-400"
              value={panel.titleFontFamily || ''} onChange={e => onUpdatePanel(panel.id, { titleFontFamily: e.target.value || undefined })}>
              {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[7px] font-bold text-slate-400 mb-0.5">标签字体</div>
            <select className="w-full px-1.5 py-1 rounded-md bg-white border border-slate-200 text-[8px] font-bold text-slate-700 outline-none focus:border-violet-400"
              value={panel.labelFontFamily || ''} onChange={e => onUpdatePanel(panel.id, { labelFontFamily: e.target.value || undefined })}>
              {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <div className="text-[7px] font-bold text-slate-400 mb-0.5">刻度字体</div>
            <select className="w-full px-1.5 py-1 rounded-md bg-white border border-slate-200 text-[8px] font-bold text-slate-700 outline-none focus:border-violet-400"
              value={panel.tickFontFamily || ''} onChange={e => onUpdatePanel(panel.id, { tickFontFamily: e.target.value || undefined })}>
              {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── 5. 轴线外观 ── */}
      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-2">
        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">轴线外观</div>
        <div className="grid grid-cols-3 gap-2">
          <NumInput label="轴线宽度" value={panel.axisLineWidth} placeholder={`${globalAxisLineWidth}`} onChange={v => onUpdatePanel(panel.id, { axisLineWidth: v })} min={0.5} max={5} step={0.5} />
          <NumInput label="网格线宽" value={panel.gridLineWidth} placeholder={`${globalGridLineWidth}`} onChange={v => onUpdatePanel(panel.id, { gridLineWidth: v })} min={0} max={3} step={0.25} />
          <div>
            <div className="text-[7px] font-bold text-slate-400 mb-0.5">轴线颜色</div>
            <div className="flex items-center gap-1">
              <input
                type="color"
                className="w-6 h-6 rounded border border-slate-200 cursor-pointer"
                value={panel.axisColor || '#333333'}
                onChange={e => onUpdatePanel(panel.id, { axisColor: e.target.value })}
              />
              {panel.axisColor && (
                <button onClick={() => onUpdatePanel(panel.id, { axisColor: undefined })}
                  className="text-[7px] font-bold text-slate-400 hover:text-violet-500">↩</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 6. 坐标轴范围 ── */}
      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">坐标轴范围</div>
          <div className="flex gap-1">
            <button onClick={autoFitDomain} className="px-2 py-0.5 rounded-md text-[7px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-all">
              自动适配
            </button>
            <button onClick={() => onUpdatePanel(panel.id, { xDomain: ['dataMin', 'dataMax'], yDomain: ['dataMin', 'dataMax'] })} className="px-2 py-0.5 rounded-md text-[7px] font-black uppercase bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-600 hover:text-white transition-all">
              重置
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[7px] font-bold text-slate-400 mb-0.5">X 范围</div>
            <div className="flex gap-1">
              <input type="number" className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 text-[9px] font-bold text-slate-700 outline-none focus:border-violet-400" placeholder="最小"
                value={typeof panel.xDomain[0] === 'number' ? panel.xDomain[0] : ''} onChange={e => { const v = e.target.value === '' ? 'dataMin' : parseFloat(e.target.value); onUpdatePanel(panel.id, { xDomain: [v, panel.xDomain[1]] }); }} />
              <input type="number" className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 text-[9px] font-bold text-slate-700 outline-none focus:border-violet-400" placeholder="最大"
                value={typeof panel.xDomain[1] === 'number' ? panel.xDomain[1] : ''} onChange={e => { const v = e.target.value === '' ? 'dataMax' : parseFloat(e.target.value); onUpdatePanel(panel.id, { xDomain: [panel.xDomain[0], v] }); }} />
            </div>
          </div>
          <div>
            <div className="text-[7px] font-bold text-slate-400 mb-0.5">Y 范围</div>
            <div className="flex gap-1">
              <input type="number" className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 text-[9px] font-bold text-slate-700 outline-none focus:border-violet-400" placeholder="最小"
                value={typeof panel.yDomain[0] === 'number' ? panel.yDomain[0] : ''} onChange={e => { const v = e.target.value === '' ? 'dataMin' : parseFloat(e.target.value); onUpdatePanel(panel.id, { yDomain: [v, panel.yDomain[1]] }); }} />
              <input type="number" className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 text-[9px] font-bold text-slate-700 outline-none focus:border-violet-400" placeholder="最大"
                value={typeof panel.yDomain[1] === 'number' ? panel.yDomain[1] : ''} onChange={e => { const v = e.target.value === '' ? 'dataMax' : parseFloat(e.target.value); onUpdatePanel(panel.id, { yDomain: [panel.yDomain[0], v] }); }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 7. 刻度、网格、坐标框 ── */}
      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-2">
        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">刻度与网格</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[7px] font-bold text-slate-400 mb-0.5">X 刻度数</div>
            <input type="number" min={2} max={20} className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 text-[9px] font-bold text-slate-700 outline-none focus:border-violet-400"
              value={panel.xTickCount ?? 5} onChange={e => onUpdatePanel(panel.id, { xTickCount: parseInt(e.target.value) || 5 })} />
          </div>
          <div>
            <div className="text-[7px] font-bold text-slate-400 mb-0.5">Y 刻度数</div>
            <input type="number" min={2} max={20} className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 text-[9px] font-bold text-slate-700 outline-none focus:border-violet-400"
              value={panel.yTickCount ?? 5} onChange={e => onUpdatePanel(panel.id, { yTickCount: parseInt(e.target.value) || 5 })} />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Toggle label="X 网格" value={panel.gridX ?? false} onChange={v => onUpdatePanel(panel.id, { gridX: v })} />
          <Toggle label="Y 网格" value={panel.gridY ?? false} onChange={v => onUpdatePanel(panel.id, { gridY: v })} />
          <Toggle label="坐标框" value={panel.axisBox ?? true} onChange={v => onUpdatePanel(panel.id, { axisBox: v })} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Toggle label="X 刻度" value={panel.showXTicks ?? true} onChange={v => onUpdatePanel(panel.id, { showXTicks: v })} />
          <Toggle label="Y 刻度" value={panel.showYTicks ?? true} onChange={v => onUpdatePanel(panel.id, { showYTicks: v })} />
          <Toggle label="镜像刻度" value={panel.showMirroredTicks ?? false} onChange={v => onUpdatePanel(panel.id, { showMirroredTicks: v })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[7px] font-bold text-slate-400 mb-0.5">X 轴缩放</div>
            <select className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 text-[9px] font-bold text-slate-700 outline-none focus:border-violet-400"
              value={panel.xScale || 'auto'} onChange={e => onUpdatePanel(panel.id, { xScale: e.target.value })}>
              <option value="auto">自动</option>
              <option value="log">对数</option>
            </select>
          </div>
          <div>
            <div className="text-[7px] font-bold text-slate-400 mb-0.5">Y 轴缩放</div>
            <select className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 text-[9px] font-bold text-slate-700 outline-none focus:border-violet-400"
              value={panel.yScale || 'auto'} onChange={e => onUpdatePanel(panel.id, { yScale: e.target.value })}>
              <option value="auto">自动</option>
              <option value="log">对数</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── 8. 轴标签位移 ── */}
      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">轴标签位移</div>
          <button
            onClick={() => onUpdatePanel(panel.id, { xLabelPos: undefined, yLabelPos: undefined })}
            className="px-2 py-0.5 rounded-md text-[7px] font-black uppercase bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-600 hover:text-white transition-all"
          >
            重置
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[7px] font-bold text-slate-400 mb-0.5">X 轴标签偏移 X</div>
            <input type="number" className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 text-[9px] font-bold text-slate-700 outline-none focus:border-violet-400"
              value={panel.xLabelPos?.x ?? 0} onChange={e => onUpdatePanel(panel.id, { xLabelPos: { x: parseFloat(e.target.value) || 0, y: panel.xLabelPos?.y ?? 0 } })} />
          </div>
          <div>
            <div className="text-[7px] font-bold text-slate-400 mb-0.5">X 轴标签偏移 Y</div>
            <input type="number" className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 text-[9px] font-bold text-slate-700 outline-none focus:border-violet-400"
              value={panel.xLabelPos?.y ?? 0} onChange={e => onUpdatePanel(panel.id, { xLabelPos: { x: panel.xLabelPos?.x ?? 0, y: parseFloat(e.target.value) || 0 } })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[7px] font-bold text-slate-400 mb-0.5">Y 轴标签偏移 X</div>
            <input type="number" className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 text-[9px] font-bold text-slate-700 outline-none focus:border-violet-400"
              value={panel.yLabelPos?.x ?? 0} onChange={e => onUpdatePanel(panel.id, { yLabelPos: { x: parseFloat(e.target.value) || 0, y: panel.yLabelPos?.y ?? 0 } })} />
          </div>
          <div>
            <div className="text-[7px] font-bold text-slate-400 mb-0.5">Y 轴标签偏移 Y</div>
            <input type="number" className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 text-[9px] font-bold text-slate-700 outline-none focus:border-violet-400"
              value={panel.yLabelPos?.y ?? 0} onChange={e => onUpdatePanel(panel.id, { yLabelPos: { x: panel.yLabelPos?.x ?? 0, y: parseFloat(e.target.value) || 0 } })} />
          </div>
        </div>
        <div className="text-[7px] text-slate-400 italic">💡 也可直接在图表上拖拽坐标轴标签移动</div>
      </div>

      {/* ── 9. 刻度系数 ── */}
      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">刻度系数</div>
          <button
            onClick={() => onUpdatePanel(panel.id, { xAxisDivision: undefined, yAxisDivision: undefined })}
            className="px-2 py-0.5 rounded-md text-[7px] font-black uppercase bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-600 hover:text-white transition-all"
          >
            重置
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[7px] font-bold text-slate-400 mb-0.5">X 轴刻度除以</div>
            <input type="number" step="any" className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 text-[9px] font-bold text-slate-700 outline-none focus:border-violet-400"
              placeholder="1 (不缩放)"
              value={panel.xAxisDivision ?? ''} onChange={e => { const raw = e.target.value; onUpdatePanel(panel.id, { xAxisDivision: raw === '' ? undefined : Number(raw) }); }} />
          </div>
          <div>
            <div className="text-[7px] font-bold text-slate-400 mb-0.5">Y 轴刻度除以</div>
            <input type="number" step="any" className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 text-[9px] font-bold text-slate-700 outline-none focus:border-violet-400"
              placeholder="1 (不缩放)"
              value={panel.yAxisDivision ?? ''} onChange={e => { const raw = e.target.value; onUpdatePanel(panel.id, { yAxisDivision: raw === '' ? undefined : Number(raw) }); }} />
          </div>
        </div>
        <div className="text-[7px] text-slate-400 italic">
          💡 例如: 设为 0.001 → 刻度值 0.01781 显示为 17.81<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;设为 1000 → 刻度值 5000 显示为 5
        </div>
      </div>

      {/* ── 9. 数据系列分配 ── */}
      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
            数据系列
            <span className="ml-1.5 px-1.5 py-0.5 bg-violet-100 text-violet-600 rounded-full text-[7px]">
              {panel.seriesIds.length}/{seriesList.length}
            </span>
          </div>
          <div className="flex gap-1">
            <button onClick={selectAll} className="px-2 py-0.5 rounded-md text-[7px] font-black uppercase bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-600 hover:text-white transition-all">全选</button>
            <button onClick={clearAll} className="px-2 py-0.5 rounded-md text-[7px] font-black uppercase bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-600 hover:text-white transition-all">清空</button>
          </div>
        </div>

        {seriesList.length === 0 ? (
          <div className="text-center py-4 text-slate-300">
            <i className="fa-solid fa-chart-line text-xl mb-1 block" />
            <span className="text-[8px] font-bold">暂无数据系列</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
            {seriesList.map(s => {
              const isSelected = selectedIds.has(s.id);
              return (
                <button key={s.id} onClick={() => toggleSeries(s.id)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all text-left border ${
                    isSelected ? 'bg-violet-50 border-violet-300 text-slate-800 shadow-sm' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-violet-600 border-violet-600' : 'bg-white border-slate-300'}`}>
                    {isSelected && <i className="fa-solid fa-check text-white text-[6px]" />}
                  </div>
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color || '#6366f1' }} />
                  <span className="text-[9px] font-bold truncate flex-1">{s.name}</span>
                  <span className="text-[7px] font-black text-slate-400 shrink-0">{s.data.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubplotSeriesSelector;
