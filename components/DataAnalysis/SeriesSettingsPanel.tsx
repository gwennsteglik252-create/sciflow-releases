import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { DataSeries } from '../../types';
import { ACADEMIC_PALETTES } from '../../hooks/useDataAnalysisLogic';
import { ColorPickerWithPresets } from './Chart/ColorPickerWithPresets';

interface SeriesSettingsPanelProps {
  series: DataSeries | null;
  seriesList: DataSeries[];
  chartType: string;
  onClose: () => void;
  onSwitchToAxis?: () => void;
  onSelectSeries: (id: string) => void;
  onUpdate: (updates: Partial<DataSeries>, applyToAll?: boolean) => void;
  onApplyPalette: (colors: string[]) => void;
}

const SeriesSettingsPanel: React.FC<SeriesSettingsPanelProps> = ({
  series, seriesList, chartType, onClose, onSwitchToAxis, onSelectSeries, onUpdate, onApplyPalette
}) => {
  const [applyToAll, setApplyToAll] = useState(false);
  const [isPaletteExpanded, setIsPaletteExpanded] = useState(false);
  const [isErrorBarExpanded, setIsErrorBarExpanded] = useState(false);
  const [isColorLinked, setIsColorLinked] = useState(true);
  const [isGeometrySyncAll, setIsGeometrySyncAll] = useState(false);

  const documentColors = useMemo(() => {
    const colors = new Set<string>();
    seriesList.forEach(s => {
      if (s.color) colors.add(s.color.toLowerCase());
      if (s.pointColor) colors.add(s.pointColor.toLowerCase());
      if (s.errorBarColor) colors.add(s.errorBarColor.toLowerCase());
    });
    return Array.from(colors);
  }, [seriesList]);

  if (!series) return null;

  return (
    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 space-y-8 shadow-md animate-reveal">
      <header className="mb-2 flex flex-col gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-indigo-600 text-white hover:bg-black transition-all flex items-center justify-center shadow-lg active:scale-95 shrink-0 group">
              <i className="fa-solid fa-arrow-left text-base group-hover:-translate-x-1 transition-transform"></i>
            </button>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-black text-slate-800 uppercase italic tracking-tighter truncate">系列样式编辑</h3>
              <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-1">Series Styling & Dynamic Presets</p>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={onSwitchToAxis}
              className="px-4 py-1.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-black uppercase hover:bg-amber-600 hover:text-white transition-all shadow-md flex flex-col items-center justify-center leading-tight active:scale-95"
            >
              <i className="fa-solid fa-sliders text-xs mb-0.5"></i>
              <span>坐标</span>
              <span>配置</span>
            </button>
            <button
              onClick={() => setApplyToAll(!applyToAll)}
              className={`px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase transition-all flex flex-col items-center justify-center leading-tight border shadow-md active:scale-95 ${applyToAll ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg animate-pulse' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-amber-300'}`}
            >
              <i className={`fa-solid ${applyToAll ? 'fa-link' : 'fa-link-slash'} text-xs mb-0.5`}></i>
              <span>批量同步</span>
              <span>{applyToAll ? '开启' : '关闭'}</span>
            </button>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
          {seriesList.map(s => (
            <button key={s.id} onClick={() => onSelectSeries(s.id)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase whitespace-nowrap transition-all border ${series.id === s.id ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-105' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-white hover:border-indigo-200'}`}>
              <span className="w-1.5 h-1.5 rounded-full inline-block mr-1.5" style={{ backgroundColor: s.color }}></span>
              {s.name}
            </button>
          ))}
        </div>
      </header>

      <div className="space-y-8 pr-1 max-h-[60vh] overflow-y-auto custom-scrollbar">
        <section>
          <div className="flex justify-between items-center mb-4 cursor-pointer group/palette hover:bg-slate-50 p-2 rounded-lg transition-colors" onClick={() => setIsPaletteExpanded(!isPaletteExpanded)}>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 group-hover/palette:text-indigo-600 transition-colors">
              <i className="fa-solid fa-swatchbook text-amber-500"></i> 全局学术配色 (PALETTES)
            </h4>
            <i className={`fa-solid ${isPaletteExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[8px] text-slate-300 transition-transform`}></i>
          </div>
          {isPaletteExpanded && (
            <div className="space-y-1.5 animate-reveal mb-4 px-1">
              <button
                onClick={() => {
                  const useRandom = Math.random() > 0.5;
                  if (useRandom) {
                    const hueStart = Math.floor(Math.random() * 360);
                    const count = 8;
                    const randomColors = Array.from({ length: count }, (_, i) => {
                      const h = (hueStart + i * (360 / count) + Math.floor(Math.random() * 20 - 10)) % 360;
                      const s = 55 + Math.floor(Math.random() * 30);
                      const l = 40 + Math.floor(Math.random() * 20);
                      return `hsl(${h}, ${s}%, ${l}%)`;
                    });
                    onApplyPalette(randomColors);
                  } else {
                    const palette = ACADEMIC_PALETTES[Math.floor(Math.random() * ACADEMIC_PALETTES.length)];
                    onApplyPalette(palette.colors);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500 rounded-lg text-white font-black text-[10px] uppercase tracking-widest shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all mb-1"
              >
                <i className="fa-solid fa-dice text-sm"></i> 色彩随机 (RANDOM)
              </button>
              {ACADEMIC_PALETTES.map((palette) => (
                <button key={palette.name} onClick={() => onApplyPalette(palette.colors)} className="w-full flex flex-col gap-1 p-1.5 bg-slate-50 rounded-lg border border-slate-100 hover:border-indigo-300 transition-all group shadow-sm active:scale-95">
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest px-0.5">{palette.name}</span>
                  <div className="flex h-2.5 w-full rounded-sm overflow-hidden shadow-inner border border-black/5">
                    {palette.colors.map((c, i) => (
                      <div key={i} className="flex-1" style={{ backgroundColor: c }}></div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <i className="fa-solid fa-palette text-indigo-500"></i> 色彩动态调试 (DETAILS)
          </h4>
          <div className="grid grid-cols-2 gap-5 relative">
            <ColorPickerWithPresets label="线条颜色" color={series.color || '#000000'} documentColors={documentColors} onChange={(c) => onUpdate({ color: c, pointColor: isColorLinked ? c : series.pointColor }, applyToAll)} />
            <div className="absolute left-1/2 top-[2.4rem] -translate-x-1/2 z-10">
              <button onClick={() => setIsColorLinked(!isColorLinked)} className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all shadow-md ${isColorLinked ? 'bg-indigo-600 border-white text-white rotate-0' : 'bg-white border-slate-200 text-slate-300 rotate-90 opacity-60'}`}>
                <i className={`fa-solid ${isColorLinked ? 'fa-link' : 'fa-link-slash'} text-[10px]`}></i>
              </button>
            </div>
            <ColorPickerWithPresets label="数据点颜色" color={series.pointColor || series.color || '#000000'} documentColors={documentColors} onChange={(c) => onUpdate({ pointColor: c, color: isColorLinked ? c : series.color }, applyToAll)} />
          </div>
        </section>

        <section className="bg-slate-50/50 p-4 rounded-[1.8rem] border border-slate-100 relative">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:inline-block">形态全部同步</span>
            <button
              onClick={() => setIsGeometrySyncAll(!isGeometrySyncAll)}
              className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors ${isGeometrySyncAll ? 'bg-indigo-600' : 'bg-slate-300'}`}
              title="激活后，对点形状、大小和线宽的修改将自动同步到所有其他系列，无需再单独点击同步。"
            >
              <div
                className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${isGeometrySyncAll ? 'translate-x-4' : 'translate-x-0'}`}
              />
            </button>
          </div>

          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <i className="fa-solid fa-shapes text-emerald-500"></i> 形态与几何细节 (GEOMETRY)
          </h4>
          <div className="space-y-5">
            <div>
              <div className="flex justify-between items-center mb-2.5 px-1">
                <label className="text-[8px] font-black text-slate-400 block uppercase">点形状 (Shape)</label>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {(['circle', 'sphere', 'square', 'diamond', 'triangleUp', 'triangleDown', 'cross', 'star', 'none'] as const).map(shape => (
                  <button key={shape} onClick={() => onUpdate({ pointShape: shape }, isGeometrySyncAll || applyToAll)} className={`py-2 rounded-lg text-[9px] font-black uppercase transition-all border ${series.pointShape === shape ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 shadow-sm'}`}>
                    <span className={shape === 'star' ? 'text-lg leading-none' : ''}>
                      {shape === 'circle' ? '实心' : shape === 'sphere' ? '3D' : shape === 'square' ? '方' : shape === 'diamond' ? '菱' : shape === 'triangleUp' ? '▲' : shape === 'triangleDown' ? '▼' : shape === 'cross' ? '×' : shape === 'star' ? '★' : '隐'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1.5 px-1">
                  <label className="text-[9px] font-black text-slate-400 block uppercase">点大小 (SIZE)</label>
                  <span className="text-[10px] font-mono font-bold text-indigo-600">{series.pointSize === 0 ? '' : series.pointSize}</span>
                </div>
                <input
                  type="number"
                  step="0.5"
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-black text-center outline-none focus:border-indigo-400 shadow-sm focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                  value={series.pointSize === 0 ? '' : series.pointSize}
                  onChange={e => onUpdate({ pointSize: e.target.value === '' ? 0 : parseFloat(e.target.value) }, isGeometrySyncAll || applyToAll)}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5 px-1">
                  <label className="text-[9px] font-black text-slate-400 block uppercase">线条宽度 (THICK)</label>
                  <span className="text-[10px] font-mono font-bold text-indigo-600">{series.strokeWidth === 0 ? '' : series.strokeWidth}</span>
                </div>
                <input
                  type="number"
                  step="0.1"
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-black text-center outline-none focus:border-indigo-400 shadow-sm focus:ring-2 focus:ring-indigo-100 transition-all font-mono"
                  value={series.strokeWidth === 0 ? '' : series.strokeWidth}
                  onChange={e => onUpdate({ strokeWidth: e.target.value === '' ? 0 : parseFloat(e.target.value) }, isGeometrySyncAll || applyToAll)}
                />
              </div>
            </div>
          </div>
        </section>

        {chartType === 'bar' && (
          <section className="bg-slate-50/50 p-4 rounded-[1.8rem] border border-slate-100">
            <div
              className="flex justify-between items-center mb-0 cursor-pointer group/err-header"
              onClick={() => setIsErrorBarExpanded(!isErrorBarExpanded)}
            >
              <div className="flex items-center gap-2">
                <h4 className="text-[10px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                  <i className="fa-solid fa-ruler-vertical"></i> 误差线配置 (ERROR BARS)
                </h4>
                <i className={`fa-solid ${isErrorBarExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[8px] text-indigo-300 transition-transform`}></i>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onUpdate({ showErrorBar: !series.showErrorBar }, applyToAll); }}
                className={`w-9 h-5 rounded-full p-0.5 transition-all ${series.showErrorBar !== false ? 'bg-indigo-600' : 'bg-slate-300'}`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full transform transition-transform ${series.showErrorBar !== false ? 'translate-x-4' : ''}`} />
              </button>
            </div>
            {isErrorBarExpanded && (
              <div className="mt-4 space-y-5 animate-reveal border-t border-indigo-100 pt-4">
                <div className="space-y-3">
                  <label className="text-[8px] font-black text-slate-400 uppercase px-1">形态选择 (SHAPE)</label>
                  <div className="flex p-1 bg-slate-200 rounded-xl">
                    <button
                      onClick={() => onUpdate({ errorBarType: 'both' }, applyToAll)}
                      className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 ${series.errorBarType !== 'plus' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
                    >
                      工字型 (Both)
                    </button>
                    <button
                      onClick={() => onUpdate({ errorBarType: 'plus' }, applyToAll)}
                      className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 ${series.errorBarType === 'plus' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
                    >
                      T字型 (Plus)
                    </button>
                  </div>
                </div>

                <ColorPickerWithPresets label="误差线颜色" color={series.errorBarColor || series.color || '#000000'} documentColors={documentColors} onChange={(c) => onUpdate({ errorBarColor: c }, applyToAll)} />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 block uppercase px-1 mb-1.5">帽宽 (PX)</label>
                    <input
                      type="number"
                      className="w-full bg-white border border-slate-100 rounded-lg p-2 text-xs font-black text-center shadow-sm outline-none focus:border-indigo-300"
                      value={series.errorBarWidth === 0 ? '' : series.errorBarWidth}
                      onChange={e => onUpdate({ errorBarWidth: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) }, applyToAll)}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 block uppercase px-1 mb-1.5">线条粗细 (PX)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full bg-white border border-slate-100 rounded-lg p-2 text-xs font-black text-center shadow-sm outline-none focus:border-indigo-300"
                      value={series.errorBarStrokeWidth === 0 ? '' : series.errorBarStrokeWidth}
                      onChange={e => onUpdate({ errorBarStrokeWidth: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) }, applyToAll)}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      <footer className="mt-8 pt-4 shrink-0">
        <button onClick={onClose} className="w-full py-5 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-black transition-all active:scale-95 shadow-indigo-100">完成修改并返回</button>
      </footer>
    </div>
  );
};

export default SeriesSettingsPanel;