import React from 'react';

interface GlobalSettingsSectionProps {
  onOpenSeriesConfig: () => void;
  onOpenAxisConfig: () => void;
  onOpenSaveTemplate: () => void;
  aspectRatio: number;
  setAspectRatio: (v: number) => void;
  titleInputRef: React.RefObject<HTMLInputElement>;
  chartTitle: string;
  setChartTitle: (v: string) => void;
  chartType: string;
  setChartType: (v: any) => void;
  mainColor: string;
  setMainColor: (v: string) => void;
  xLabelInputRef: React.RefObject<HTMLInputElement>;
  xAxisLabel: string;
  setXAxisLabel: (v: string) => void;
  yLabelInputRef: React.RefObject<HTMLInputElement>;
  yAxisLabel: string;
  setYAxisLabel: (v: string) => void;
  // 保持这些 Props 的接收，即使不渲染对应的 UI
  strokeWidth?: number;
  setStrokeWidth?: (v: number) => void;
  fontSize?: number;
  setFontSize?: (v: number) => void;
  pointShape?: string;
  setPointShape?: (v: any) => void;
}

export const GlobalSettingsSection: React.FC<GlobalSettingsSectionProps> = ({
  onOpenSeriesConfig, onOpenAxisConfig, onOpenSaveTemplate, aspectRatio, setAspectRatio,
  titleInputRef, chartTitle, setChartTitle, chartType, setChartType,
  mainColor, setMainColor, xLabelInputRef, xAxisLabel, setXAxisLabel,
  yLabelInputRef, yAxisLabel, setYAxisLabel
}) => {
  return (
    <section className="space-y-3 px-1">
      <div className="flex flex-col gap-3 mb-2">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <i className="fa-solid fa-paintbrush text-indigo-500"></i> 图表全局配置
        </h4>
        <div className="grid grid-cols-3 gap-2 w-full">
          <button
            onClick={onOpenSeriesConfig}
            className="flex flex-col items-center justify-center py-2.5 bg-violet-50 text-violet-600 rounded-2xl text-[10px] font-black uppercase border border-violet-200 hover:bg-violet-100 transition-all shadow-sm active:scale-95"
          >
            <i className="fa-solid fa-palette mb-1 text-sm"></i>
            <span className="truncate">系列样式</span>
          </button>
          <button
            onClick={onOpenAxisConfig}
            className="flex flex-col items-center justify-center py-2.5 bg-amber-50 text-amber-600 rounded-2xl text-[10px] font-black uppercase border border-amber-200 hover:bg-amber-100 transition-all active:scale-95"
          >
            <i className="fa-solid fa-sliders mb-1 text-sm"></i>
            <span className="truncate">坐标高级</span>
          </button>
          <button
            onClick={onOpenSaveTemplate}
            className="flex flex-col items-center justify-center py-2.5 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase border border-indigo-200 hover:bg-indigo-100 transition-all active:scale-95"
          >
            <i className="fa-solid fa-floppy-disk mb-1 text-sm"></i>
            <span className="truncate">保存模板</span>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[9px] font-black text-slate-400 uppercase block px-1">长宽比例 (ASPECT RATIO)</label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Long', val: 1.2 }, { label: '4:3', val: 1.33 },
            { label: '16:9', val: 1.77 }, { label: '1:1', val: 1.0 }
          ].map(ratio => (
            <button
              key={ratio.label}
              onClick={() => setAspectRatio(ratio.val)}
              className={`py-2 rounded-lg text-[9px] font-black transition-all border ${aspectRatio === ratio.val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-indigo-300'}`}
            >
              {ratio.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 pt-1.5 border-t border-slate-50">
        <div>
          <label className="text-[8px] font-black text-slate-400 uppercase block mb-1 px-1">图表标题 (TITLE)</label>
          <input ref={titleInputRef} className="w-full bg-slate-50 p-2.5 rounded-xl text-[11px] font-bold outline-none border border-transparent focus:border-indigo-400 transition-all shadow-inner" value={chartTitle} onChange={e => setChartTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="text-[8px] font-black text-slate-400 uppercase block mb-1 px-1">数据类型</label>
            <select className="w-full bg-slate-50 p-2.5 rounded-xl text-[11px] font-bold outline-none cursor-pointer shadow-inner" value={chartType} onChange={e => setChartType(e.target.value as any)}>
              <optgroup label="基础图表 (Recharts)">
                <option value="line">折线图 (Line)</option>
                <option value="bar">柱状图 (Bar)</option>
                <option value="scatter">散点图 (Scatter)</option>
                <option value="area">面积图 (Area)</option>
                <option value="box">箱线图 (Box)</option>
                <option value="histogram">直方图 (Histogram)</option>
              </optgroup>
              <optgroup label="高级图表 (Plotly)">
                <option value="contour">等高线图 (Contour)</option>
                <option value="heatmap">热力图 (Heatmap)</option>
                <option value="surface3d">3D 曲面图 (Surface)</option>
                <option value="violin">小提琴图 (Violin)</option>
                <option value="bubble">气泡图 (Bubble)</option>
                <option value="ternary">三元相图 (Ternary)</option>
                <option value="polar">极坐标图 (Polar)</option>
                <option value="waterfallPlotly">瀑布图 (Waterfall)</option>
                <option value="parallel">平行坐标图 (Parallel)</option>
                <option value="funnel">漏斗图 (Funnel)</option>
                <option value="treemap">矩形树图 (Treemap)</option>
                <option value="sunburst">旭日图 (Sunburst)</option>
              </optgroup>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 pt-1">
          <div>
            <label className="text-[8px] font-black text-slate-400 uppercase block mb-1 px-1">X轴 标签 (化学式如 H2O 自动转换)</label>
            <input ref={xLabelInputRef} className="w-full bg-slate-50 p-2.5 rounded-xl text-[11px] font-bold outline-none border border-transparent focus:border-indigo-400 transition-all shadow-inner" value={xAxisLabel} onChange={e => setXAxisLabel(e.target.value)} placeholder="如: Potential_RHE (V) 或 H2O" />
          </div>
          <div>
            <label className="text-[8px] font-black text-slate-400 uppercase block mb-1 px-1">Y轴 标签 (支持 ^2 _1 快捷下标)</label>
            <input ref={yLabelInputRef} className="w-full bg-slate-50 p-2.5 rounded-xl text-[11px] font-bold outline-none border border-transparent focus:border-indigo-400 transition-all shadow-inner" value={yAxisLabel} onChange={e => setYAxisLabel(e.target.value)} placeholder="如: j (mA cm^-2)" />
          </div>
        </div>
      </div>
    </section>
  );
};