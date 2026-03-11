import React, { useState, useEffect } from 'react';
import { FontTabType } from '../../hooks/useDataAnalysisLogic';
import { ColorPickerWithPresets } from './Chart/ColorPickerWithPresets';

interface AxisSettingsPanelProps {
  onClose: () => void;
  onSwitchToSeries?: () => void; 
  xDomain: [any, any];
  setXDomain: (v: [any, any]) => void;
  yDomain: [any, any];
  setYDomain: (v: [any, any]) => void;
  xScale?: 'auto' | 'log';
  setXScale?: (v: 'auto' | 'log') => void;
  yScale?: 'auto' | 'log';
  setYScale?: (v: 'auto' | 'log') => void;
  gridX: boolean;
  setGridX: (v: boolean) => void;
  gridY: boolean;
  setGridY: (v: boolean) => void;
  gridLineWidth: number;
  setGridLineWidth: (v: number) => void;
  axisLineWidth: number;
  setAxisLineWidth: (v: number) => void;
  axisColor: string;
  setAxisColor: (v: string) => void;
  pointColor?: string; 
  setPointColor?: (v: string) => void;
  axisBox: boolean;
  setAxisBox: (v: boolean) => void;
  tickFontSize: number;
  setTickFontSize: (v: number) => void;
  tickSize: number;
  setTickSize: (v: number) => void;
  tickWidth: number;
  setTickWidth: (v: number) => void;
  axisLabelFontSize: number;
  setAxisLabelFontSize: (v: number) => void;
  xTickCount: number;
  setXTickCount: (v: number) => void;
  yTickCount: number;
  setYTickCount: (v: number) => void;
  xAxisDivision: number;
  setXAxisDivision: (v: number) => void;
  yAxisDivision: number;
  setYAxisDivision: (v: number) => void;
  computedAutoDomains: { x: [number, number], y: [number, number] };
  
  labelFontFamily?: string;
  setLabelFontFamily?: (font: string) => void;
  labelFontWeight?: string;
  setLabelFontWeight?: (w: string) => void;
  labelFontStyle?: string;
  setLabelFontStyle?: (s: string) => void;

  titleFontFamily?: string;
  setTitleFontFamily?: (font: string) => void;
  titleFontWeight?: string;
  setTitleFontWeight?: (w: string) => void;
  titleFontStyle?: string;
  setTitleFontStyle?: (s: string) => void;

  tickFontFamily?: string;
  setTickFontFamily?: (font: string) => void;
  tickFontWeight?: string;
  setTickFontWeight?: (w: string) => void;
  tickFontStyle?: string;
  setTickFontStyle?: (s: string) => void;

  legendFontFamily?: string;
  setLegendFontFamily?: (font: string) => void;
  legendFontWeight?: string;
  setLegendFontWeight?: (w: string) => void;
  legendFontStyle?: string;
  setLegendFontStyle?: (s: string) => void;
  legendFontSize?: number;
  setLegendFontSize?: (v: number) => void;

  legendBorderVisible: boolean;
  setLegendBorderVisible: (v: boolean) => void;
  legendBorderColor: string;
  setLegendBorderColor: (v: string) => void;
  legendBorderWidth: number;
  setLegendBorderWidth: (v: number) => void;

  activeFontTab: FontTabType;
  setActiveFontTab: (tab: FontTabType) => void;

  showXTicks: boolean;
  setShowXTicks: (v: boolean) => void;
  showYTicks: boolean;
  setShowYTicks: (v: boolean) => void;
  showMirroredTicks: boolean;
  setShowMirroredTicks: (v: boolean) => void;
  autoFitDomains?: () => void;

  documentColors: string[];
}

const FONT_GROUPS = [
  {
    label: '无衬线字体 (Modern Sans)',
    options: [
      { name: 'Default Sans', value: 'inherit' },
      { name: 'Arial', value: 'Arial, sans-serif' },
      { name: 'Helvetica', value: '"Helvetica Neue", Helvetica, sans-serif' },
      { name: 'Inter', value: '"Inter", sans-serif' },
      { name: 'Segoe UI', value: '"Segoe UI", Roboto, sans-serif' },
      { name: 'Verdana', value: 'Verdana, sans-serif' }
    ]
  },
  {
    label: '衬线字体 (Academic Serif)',
    options: [
      { name: 'Times New Roman', value: '"Times New Roman", Times, serif' },
      { name: 'Georgia', value: 'Georgia, serif' },
      { name: 'Palatino', value: '"Palatino Linotype", "Book Antiqua", Palatino, serif' }
    ]
  },
  {
    label: '等宽字体 (Technical Mono)',
    options: [
      { name: 'Courier New', value: '"Courier New", Courier, monospace' },
      { name: 'Consolas', value: 'Consolas, monaco, monospace' }
    ]
  }
];

const AxisSettingsPanel: React.FC<AxisSettingsPanelProps> = ({
  onClose, onSwitchToSeries, xDomain, setXDomain, yDomain, setYDomain,
  xScale = 'auto', setXScale, yScale = 'auto', setYScale,
  gridX, setGridX, gridY, setGridY, gridLineWidth, setGridLineWidth,
  axisLineWidth, setAxisLineWidth,
  axisColor, setAxisColor, pointColor = '#6366f1', setPointColor, axisBox, setAxisBox, tickFontSize, setTickFontSize,
  tickSize, setTickSize, tickWidth, setTickWidth,
  axisLabelFontSize, setAxisLabelFontSize,
  xTickCount, setXTickCount, yTickCount, setYTickCount,
  xAxisDivision, setXAxisDivision, yAxisDivision, setYAxisDivision,
  computedAutoDomains, 
  labelFontFamily = 'inherit', setLabelFontFamily, labelFontWeight = 'bold', setLabelFontWeight, labelFontStyle = 'normal', setLabelFontStyle,
  titleFontFamily = 'inherit', setTitleFontFamily, titleFontWeight = 'black', setTitleFontWeight, titleFontStyle = 'italic', setTitleFontStyle,
  tickFontFamily = 'Arial, sans-serif', setTickFontFamily, tickFontWeight = 'bold', setTickFontWeight, tickFontStyle = 'normal', setTickFontStyle,
  legendFontFamily = 'inherit', setLegendFontFamily, legendFontWeight = 'bold', setLegendFontWeight, legendFontStyle = 'normal', setLegendFontStyle, legendFontSize = 14, setLegendFontSize,
  legendBorderVisible, setLegendBorderVisible, legendBorderColor, setLegendBorderColor, legendBorderWidth, setLegendBorderWidth,
  activeFontTab, setActiveFontTab,
  showXTicks, setShowXTicks, showYTicks, setShowYTicks, showMirroredTicks, setShowMirroredTicks,
  autoFitDomains,
  documentColors
}) => {
  const [localXMin, setLocalXMin] = useState('');
  const [localXMax, setLocalXMax] = useState('');
  const [localYMin, setLocalYMin] = useState('');
  const [localYMax, setLocalYMax] = useState('');

  const [localXDiv, setLocalXDiv] = useState(xAxisDivision.toString());
  const [localYDiv, setLocalYDiv] = useState(yAxisDivision.toString());

  useEffect(() => {
    setLocalXMin(xDomain[0] === 'auto' ? 'auto' : xDomain[0].toString());
    setLocalXMax(xDomain[1] === 'auto' ? 'auto' : xDomain[1].toString());
    setLocalYMin(yDomain[0] === 'auto' ? 'auto' : yDomain[0].toString());
    setLocalYMax(yDomain[1] === 'auto' ? 'auto' : yDomain[1].toString());
  }, [xDomain, yDomain]);

  useEffect(() => {
    setLocalXDiv(xAxisDivision.toString());
  }, [xAxisDivision]);

  useEffect(() => {
    setLocalYDiv(yAxisDivision.toString());
  }, [yAxisDivision]);

  const handleApplyChanges = () => {
    const parseValue = (val: string) => {
        const lower = val.toLowerCase().trim();
        if (lower === 'auto' || lower === '') return 'auto';
        const num = parseFloat(lower);
        return isNaN(num) ? 'auto' : num;
    };

    setXDomain([parseValue(localXMin), parseValue(localXMax)]);
    setYDomain([parseValue(localYMin), parseValue(localYMax)]);
  };

  const handleDivBlur = (axis: 'x' | 'y') => {
    const val = axis === 'x' ? localXDiv : localYDiv;
    const num = parseFloat(val);
    if (!isNaN(num) && num !== 0) {
      if (axis === 'x') setXAxisDivision(num);
      else setYAxisDivision(num);
    } else {
      if (axis === 'x') setLocalXDiv(xAxisDivision.toString());
      else setLocalYDiv(yAxisDivision.toString());
    }
  };

  const handleResetDefaults = () => {
    setXDomain(['auto', 'auto']); setYDomain(['auto', 'auto']);
    setXScale?.('auto'); setYScale?.('auto');
    setGridX(false); setGridY(true); setAxisLineWidth(2.0); setGridLineWidth(1.0);
    setAxisColor('#334155'); setAxisBox(true); 
    setTickFontSize(14);
    setTickSize(6); 
    setTickWidth(1.5); 
    setAxisLabelFontSize(20);
    setXTickCount(5); setYTickCount(5);
    setXAxisDivision(1); setYAxisDivision(1);
    setShowXTicks(true); setShowYTicks(true); setShowMirroredTicks(false);
    
    if(setLabelFontFamily) setLabelFontFamily('inherit');
    if(setLabelFontWeight) setLabelFontWeight('bold');
    if(setLabelFontStyle) setLabelFontStyle('normal');

    if(setTitleFontFamily) setTitleFontFamily('inherit');
    if(setTitleFontWeight) setTitleFontWeight('black');
    if(setTitleFontStyle) setTitleFontStyle('italic');

    if(setTickFontFamily) setTickFontFamily('Arial, sans-serif');
    if(setTickFontWeight) setTickFontWeight('bold');
    if(setTickFontStyle) setTickFontStyle('normal');

    if(setLegendFontFamily) setLegendFontFamily('inherit');
    if(setLegendFontWeight) setLegendFontWeight('bold');
    if(setLegendFontStyle) setLegendFontStyle('normal');
    if(setLegendFontSize) setLegendFontSize(14);

    setLegendBorderVisible(true);
    setLegendBorderColor('#e2e8f0');
    setLegendBorderWidth(1);

    if(setPointColor) setPointColor('#6366f1');

    setLocalXMin('auto'); setLocalXMax('auto');
    setLocalYMin('auto'); setLocalYMax('auto');
    setLocalXDiv('1'); setLocalYDiv('1');
  };

  const currentFontFamily = activeFontTab === 'title' ? titleFontFamily : activeFontTab === 'label' ? labelFontFamily : activeFontTab === 'tick' ? tickFontFamily : legendFontFamily;
  const currentFontWeight = activeFontTab === 'title' ? titleFontWeight : activeFontTab === 'label' ? labelFontWeight : activeFontTab === 'tick' ? tickFontWeight : legendFontWeight;
  const currentFontStyle = activeFontTab === 'title' ? titleFontStyle : activeFontTab === 'label' ? labelFontStyle : activeFontTab === 'tick' ? tickFontStyle : legendFontStyle;

  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 space-y-6 shadow-md animate-reveal">
      <header className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
            <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-indigo-600 text-white hover:bg-black transition-all flex items-center justify-center shadow-lg active:scale-95 shrink-0 group">
                <i className="fa-solid fa-arrow-left text-base group-hover:-translate-x-1 transition-transform"></i>
            </button>
            <div>
                <h3 className="text-sm font-black text-slate-800 uppercase italic tracking-tighter leading-none">排版与坐标体系</h3>
                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-1">AXIS & TITLE TYPOGRAPHY</p>
            </div>
        </div>
        
        <div className="flex gap-2">
            <button 
                onClick={onSwitchToSeries}
                className="px-4 py-1.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 text-[9px] font-black uppercase hover:bg-amber-600 hover:text-white transition-all shadow-md flex items-center gap-2 active:scale-95 leading-tight"
            >
                <i className="fa-solid fa-palette text-[10px]"></i>
                系列样式
            </button>
            <button 
                onClick={() => autoFitDomains?.()} 
                className="px-4 py-1.5 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2 shadow-md active:scale-95 leading-tight"
            >
                <i className="fa-solid fa-expand text-[10px]"></i>
                Auto Fit
            </button>
        </div>
      </header>

      <div className="space-y-4">
          <section className="bg-indigo-50/50 p-3 rounded-[1.8rem] border border-indigo-100 shadow-inner">
            <div className="flex justify-between items-center mb-2">
                <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-font"></i> 字体排版设置
                </h4>
                <div className="flex bg-white/60 p-0.5 rounded-lg border border-indigo-100 shadow-sm overflow-x-auto no-scrollbar max-w-[180px]">
                    {(['title', 'label', 'tick', 'legend'] as const).map(tab => (
                        <button 
                            key={tab}
                            onClick={() => setActiveFontTab(tab)}
                            className={`px-2 py-1 rounded text-[8px] font-black uppercase transition-all flex-shrink-0 ${activeFontTab === tab ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {tab === 'title' ? '标题' : tab === 'label' ? '标签' : tab === 'tick' ? '刻度' : '图例'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="animate-reveal" key={activeFontTab}>
                <div className="space-y-2">
                    <div className="relative">
                      <select 
                          className="w-full bg-white border border-slate-200 rounded-xl p-2 text-[11px] font-bold text-slate-800 outline-none cursor-pointer hover:border-indigo-400 transition-all shadow-sm"
                          style={{ fontFamily: currentFontFamily !== 'inherit' ? currentFontFamily : 'sans-serif' }}
                          value={currentFontFamily}
                          onChange={(e) => {
                              const val = e.target.value;
                              if (activeFontTab === 'title') setTitleFontFamily?.(val);
                              else if (activeFontTab === 'label') setLabelFontFamily?.(val);
                              else if (activeFontTab === 'tick') setTickFontFamily?.(val);
                              else setLegendFontFamily?.(val);
                          }}
                      >
                          {FONT_GROUPS.map(group => (
                            <optgroup key={group.label} label={group.label} className="text-slate-400 font-black uppercase text-[10px]">
                              {group.options.map(opt => (
                                <option key={opt.value} value={opt.value} style={{ fontFamily: opt.value }}>
                                  {opt.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                      </select>
                    </div>
                    
                    <div className="flex gap-2">
                        <button 
                          onClick={() => {
                              const next = currentFontWeight === 'bold' || currentFontWeight === 'black' ? 'normal' : 'bold';
                              if (activeFontTab === 'title') setTitleFontWeight?.(next);
                              else if (activeFontTab === 'label') setLabelFontWeight?.(next);
                              else if (activeFontTab === 'tick') setTickFontWeight?.(next);
                              else setLegendFontWeight?.(next);
                          }} 
                          className={`flex-1 py-1.5 rounded-xl text-[10px] font-black border transition-all shadow-sm ${
                              (currentFontWeight === 'bold' || currentFontWeight === 'black') 
                              ? 'bg-indigo-600 text-white border-indigo-600' 
                              : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}
                        >
                          BOLD
                        </button>
                        <button 
                          onClick={() => {
                              const next = currentFontStyle === 'italic' ? 'normal' : 'italic';
                              if (activeFontTab === 'title') setTitleFontStyle?.(next);
                              else if (activeFontTab === 'label') setLabelFontStyle?.(next);
                              else if (activeFontTab === 'tick') setTickFontWeight?.(next);
                              else setLegendFontStyle?.(next);
                          }} 
                          className={`flex-1 py-1.5 rounded-xl text-[10px] font-black border transition-all shadow-sm ${
                              (currentFontStyle === 'italic') 
                              ? 'bg-indigo-600 text-white border-indigo-600' 
                              : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'}`}
                        >
                          ITALIC
                        </button>
                    </div>

                    {activeFontTab === 'legend' && (
                        <div className="flex flex-col gap-1 mt-1 bg-white/40 p-2 rounded-xl border border-indigo-100">
                             <label className="text-[8px] font-black text-slate-500 uppercase px-1">图例字号 (PT)</label>
                             <input 
                                type="number" 
                                className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-[11px] font-black text-center outline-none focus:border-indigo-400 transition-all shadow-sm" 
                                value={legendFontSize === 0 ? '' : legendFontSize} 
                                onChange={(e) => setLegendFontSize?.(e.target.value === '' ? 0 : (parseInt(e.target.value) || 0))} 
                             />
                        </div>
                    )}
                </div>
            </div>
          </section>

          <section className="bg-violet-50/40 p-3 rounded-2xl border border-violet-100 shadow-inner">
              <h4 className="text-[11px] font-black text-violet-700 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <i className="fa-solid fa-up-down-left-right"></i> 规模控制与粗细
              </h4>
              <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-slate-600 uppercase block px-1">轴标签 (PT)</label>
                      <input 
                        type="number" 
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-[11px] font-black text-center outline-none focus:border-indigo-400 transition-all shadow-sm" 
                        value={axisLabelFontSize === 0 ? '' : axisLabelFontSize} 
                        onChange={(e) => setAxisLabelFontSize(e.target.value === '' ? 0 : (parseInt(e.target.value) || 0))} 
                      />
                  </div>
                  <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-slate-600 uppercase block px-1">刻度数值 (PT)</label>
                      <input 
                        type="number" 
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-[11px] font-black text-center outline-none focus:border-indigo-400 transition-all shadow-sm" 
                        value={tickFontSize === 0 ? '' : tickFontSize} 
                        onChange={(e) => setTickFontSize(e.target.value === '' ? 0 : (parseInt(e.target.value) || 0))} 
                      />
                  </div>
                  <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-slate-600 uppercase block px-1">X轴刻度数</label>
                      <input 
                        type="number" 
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-[11px] font-black text-center outline-none focus:border-indigo-400 transition-all shadow-sm" 
                        value={xTickCount === 0 ? '' : xTickCount} 
                        onChange={(e) => setXTickCount(e.target.value === '' ? 0 : (parseInt(e.target.value) || 0))} 
                      />
                  </div>
                  <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-slate-600 uppercase block px-1">Y轴刻度数</label>
                      <input 
                        type="number" 
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-[11px] font-black text-center outline-none focus:border-indigo-400 transition-all shadow-sm" 
                        value={yTickCount === 0 ? '' : yTickCount} 
                        onChange={(e) => setYTickCount(e.target.value === '' ? 0 : (parseInt(e.target.value) || 0))} 
                      />
                  </div>
                  <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-slate-600 uppercase block px-1">主轴线宽 (PX)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-[11px] font-black text-center outline-none focus:border-indigo-400 transition-all shadow-sm" 
                        value={axisLineWidth === 0 ? '' : axisLineWidth} 
                        onChange={(e) => setAxisLineWidth(e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0))} 
                      />
                  </div>
                  <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-slate-600 uppercase block px-1">网格线宽 (PX)</label>
                      <input 
                        type="number" 
                        step="0.1" 
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-[11px] font-black text-center outline-none focus:border-indigo-400 transition-all shadow-sm" 
                        value={gridLineWidth === 0 ? '' : gridLineWidth} 
                        onChange={(e) => setGridLineWidth(e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0))} 
                      />
                  </div>
              </div>
          </section>

          <div className="grid grid-cols-2 gap-3">
              <section className="bg-blue-100/60 p-3 rounded-xl border border-blue-200 min-w-0 shadow-sm transition-all hover:bg-blue-100">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-widest">X轴量程</h4>
                    <button 
                        onClick={() => setXScale?.(xScale === 'log' ? 'auto' : 'log')}
                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all border ${xScale === 'log' ? 'bg-blue-600 text-white border-blue-400 shadow-md' : 'bg-white text-blue-400 border-blue-200 hover:bg-blue-50'}`}
                    >
                        {xScale === 'log' ? 'LOG ON' : 'LOG OFF'}
                    </button>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 bg-white/60 p-1 rounded-lg">
                    <span className="text-[9px] font-black text-blue-600 w-8">MIN</span>
                    <input className="flex-1 bg-transparent border-none text-[11px] font-black outline-none text-slate-700 min-w-0" value={localXMin} onChange={(e) => setLocalXMin(e.target.value)} onBlur={handleApplyChanges} placeholder="auto" />
                  </div>
                  <div className="flex items-center gap-2 bg-white/60 p-1 rounded-lg">
                    <span className="text-[9px] font-black text-blue-600 w-8">MAX</span>
                    <input className="flex-1 bg-transparent border-none text-[11px] font-black outline-none text-slate-700 min-w-0" value={localXMax} onChange={(e) => setLocalXMax(e.target.value)} onBlur={handleApplyChanges} placeholder="auto" />
                  </div>
                </div>
              </section>

              <section className="bg-indigo-100/60 p-3 rounded-xl border border-indigo-200 min-w-0 shadow-sm transition-all hover:bg-indigo-100">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">Y轴量程</h4>
                    <button 
                        onClick={() => setYScale?.(yScale === 'log' ? 'auto' : 'log')}
                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all border ${yScale === 'log' ? 'bg-indigo-600 text-white border-indigo-400 shadow-md' : 'bg-white text-indigo-400 border-indigo-200 hover:bg-indigo-50'}`}
                    >
                        {yScale === 'log' ? 'LOG ON' : 'LOG OFF'}
                    </button>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 bg-white/60 p-1 rounded-lg">
                    <span className="text-[9px] font-black text-indigo-600 w-8">MIN</span>
                    <input className="flex-1 bg-transparent border-none text-[11px] font-black outline-none text-slate-700 min-w-0" value={localYMin} onChange={(e) => setLocalYMin(e.target.value)} onBlur={handleApplyChanges} placeholder="auto" />
                  </div>
                  <div className="flex items-center gap-2 bg-white/60 p-1 rounded-lg">
                    <span className="text-[9px] font-black text-indigo-600 w-8">MAX</span>
                    <input className="flex-1 bg-transparent border-none text-[11px] font-black outline-none text-slate-700 min-w-0" value={localYMax} onChange={(e) => setLocalYMax(e.target.value)} onBlur={handleApplyChanges} placeholder="auto" />
                  </div>
                </div>
              </section>
          </div>

          <div className="grid grid-cols-2 gap-3">
              <section className="bg-cyan-50/50 p-3 rounded-xl border border-cyan-200">
                <h4 className="text-[11px] font-black text-cyan-700 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                    <i className="fa-solid fa-divide"></i> 除系数 (SCALING)
                </h4>
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-bold text-slate-600">X/</span>
                        <input 
                          type="text" 
                          className="w-full bg-white rounded-lg p-1.5 text-[11px] font-black outline-none border border-slate-200 focus:border-cyan-400 text-center shadow-sm" 
                          value={localXDiv} 
                          onChange={e => setLocalXDiv(e.target.value)}
                          onBlur={() => handleDivBlur('x')}
                        />
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-bold text-slate-600">Y/</span>
                        <input 
                          type="text" 
                          className="w-full bg-white rounded-lg p-1.5 text-[11px] font-black outline-none border border-slate-200 focus:border-cyan-400 text-center shadow-sm" 
                          value={localYDiv} 
                          onChange={e => setLocalYDiv(e.target.value)}
                          onBlur={() => handleDivBlur('y')}
                        />
                    </div>
                </div>
              </section>

              <div className="flex flex-col gap-2">
                  <section className="bg-slate-50/50 p-2 rounded-xl border border-slate-100 flex items-center justify-between gap-3">
                      <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">轴颜色</span>
                      <div className="w-20">
                        <ColorPickerWithPresets
                          size="xs"
                          color={axisColor}
                          documentColors={documentColors}
                          onChange={setAxisColor}
                        />
                      </div>
                  </section>
                  <section className="bg-indigo-50/50 p-2 rounded-xl border border-indigo-100 flex items-center justify-between gap-3 animate-reveal">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">点颜色</span>
                      <div className="w-20">
                        <ColorPickerWithPresets
                          size="xs"
                          color={pointColor}
                          documentColors={documentColors}
                          onChange={c => setPointColor?.(c)}
                        />
                      </div>
                  </section>
              </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
              <section className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                <h4 className="text-[11px] font-black text-emerald-700 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <i className="fa-solid fa-ruler-vertical"></i> 刻度控制
                </h4>
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-[8px] font-black text-slate-500 uppercase px-1">长度 (PT)</label>
                            <input 
                                type="number" 
                                step="1" 
                                className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-[11px] font-black text-center outline-none focus:border-indigo-400 transition-all shadow-sm" 
                                value={tickSize === 0 ? '' : tickSize} 
                                onChange={e => setTickSize(e.target.value === '' ? 0 : (parseInt(e.target.value) || 0))} 
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[8px] font-black text-slate-500 uppercase px-1">粗细 (PT)</label>
                            <input 
                                type="number" 
                                step="0.1" 
                                className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-[11px] font-black text-center outline-none focus:border-indigo-400 transition-all shadow-sm" 
                                value={tickWidth === 0 ? '' : tickWidth} 
                                onChange={e => setTickWidth(e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0))} 
                            />
                        </div>
                    </div>
                    <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-bold text-slate-600">显示X刻度</span>
                            <button onClick={() => setShowXTicks(!showXTicks)} className={`w-7 h-4 rounded-full p-0.5 transition-all ${showXTicks ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full transform transition-transform ${showXTicks ? 'translate-x-3' : ''}`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-bold text-slate-600">显示Y刻度</span>
                            <button onClick={() => setShowYTicks(!showYTicks)} className={`w-7 h-4 rounded-full p-0.5 transition-all ${showYTicks ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full transform transition-transform ${showYTicks ? 'translate-x-3' : ''}`} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between px-1 border-t border-emerald-100/50 pt-1 mt-1">
                            <span className="text-[9px] font-black text-indigo-600">对侧镜像</span>
                            <button onClick={() => setShowMirroredTicks(!showMirroredTicks)} className={`w-7 h-4 rounded-full p-0.5 transition-all ${showMirroredTicks ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                <div className={`w-3 h-3 bg-white rounded-full transform transition-transform ${showMirroredTicks ? 'translate-x-3' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>
              </section>

              <section className="bg-white p-3 rounded-xl border border-slate-200">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-1 mb-2">线框选项</h4>
                <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-slate-600">网格X</span>
                        <button onClick={() => setGridX(!gridX)} className={`w-7 h-4 rounded-full p-0.5 transition-all ${gridX ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                            <div className={`w-3 h-3 bg-white rounded-full transform transition-transform ${gridX ? 'translate-x-3' : ''}`} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-slate-600">网格Y</span>
                        <button onClick={() => setGridY(!gridY)} className={`w-7 h-4 rounded-full p-0.5 transition-all ${gridY ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                            <div className={`w-3 h-3 bg-white rounded-full transform transition-transform ${gridY ? 'translate-x-3' : ''}`} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-slate-50 pt-1 mt-1">
                        <span className="text-[9px] font-black text-indigo-600">四边框线</span>
                        <button onClick={() => setAxisBox(!axisBox)} className={`w-7 h-4 rounded-full p-0.5 transition-all ${axisBox ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                            <div className={`w-3 h-3 bg-white rounded-full transform transition-transform ${axisBox ? 'translate-x-3' : ''}`} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-slate-50 pt-1 mt-1">
                        <span className="text-[9px] font-black text-indigo-600">图例边框</span>
                        <button onClick={() => setLegendBorderVisible(!legendBorderVisible)} className={`w-7 h-4 rounded-full p-0.5 transition-all ${legendBorderVisible ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                            <div className={`w-3 h-3 bg-white rounded-full transform transition-transform ${legendBorderVisible ? 'translate-x-3' : ''}`} />
                        </button>
                    </div>
                    {legendBorderVisible && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[8px] font-bold text-slate-500 px-1">颜色</span>
                          <div className="w-16">
                            <ColorPickerWithPresets
                              size="xs"
                              color={legendBorderColor}
                              documentColors={documentColors}
                              onChange={setLegendBorderColor}
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[8px] font-bold text-slate-500 px-1">粗细 (PX)</span>
                          <input
                            type="number"
                            step="0.5"
                            className="w-14 bg-white border border-slate-200 rounded-lg p-1 text-[10px] font-black text-center outline-none focus:border-indigo-400 transition-all shadow-sm"
                            value={legendBorderWidth === 0 ? '' : legendBorderWidth}
                            onChange={e => setLegendBorderWidth(e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0))}
                          />
                        </div>
                      </div>
                    )}
                </div>
              </section>
          </div>
      </div>

      <footer className="mt-4 flex gap-3 shrink-0">
          <button 
              onClick={handleResetDefaults}
              className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase transition-all hover:bg-slate-200 shadow-sm"
          >
              恢复默认
          </button>
          <button 
              onClick={onClose} 
              className="flex-[1.5] py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl hover:bg-indigo-700 transition-all active:scale-95"
          >
              完成退出
          </button>
      </footer>
    </div>
  );
};

export default AxisSettingsPanel;