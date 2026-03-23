import React from 'react';
import { DataSeries } from '../../types';

interface SeriesSettingsModalProps {
  series: DataSeries | null;
  onClose: () => void;
  onUpdate: (updates: Partial<DataSeries>) => void;
}

const SeriesSettingsModal: React.FC<SeriesSettingsModalProps> = ({ series, onClose, onUpdate }) => {
  if (!series) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[3500] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 animate-reveal shadow-2xl relative border-4 border-white flex flex-col">
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-300 hover:text-rose-500 transition-all">
          <i className="fa-solid fa-times text-xl"></i>
        </button>
        
        <header className="mb-6 border-l-4 border-indigo-600 pl-4">
          <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter truncate">系列样式: {series.name}</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Series Styling & Attributes</p>
        </header>

        <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2 max-h-[60vh]">
          {/* Colors */}
          <section>
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">色彩控制 (COLORS)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <label className="text-[8px] font-black text-slate-400 block mb-1 uppercase">线条颜色 (Line)</label>
                <input 
                  type="color"
                  className="w-full h-8 rounded-lg cursor-pointer bg-transparent border-none"
                  value={series.color} 
                  onChange={(e) => onUpdate({ color: e.target.value })} 
                />
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <label className="text-[8px] font-black text-slate-400 block mb-1 uppercase">点颜色 (Points)</label>
                <input 
                  type="color"
                  className="w-full h-8 rounded-lg cursor-pointer bg-transparent border-none"
                  value={series.pointColor || series.color} 
                  onChange={(e) => onUpdate({ pointColor: e.target.value })} 
                />
              </div>
            </div>
          </section>

          {/* Points Style */}
          <section>
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">数据点设定 (POINTS)</h4>
            <div className="space-y-4">
                <div>
                    <label className="text-[8px] font-black text-slate-400 block mb-2 uppercase">点形状 (Shape)</label>
                    <div className="grid grid-cols-4 gap-2">
                        {(['circle', 'square', 'diamond', 'none'] as const).map(shape => (
                            <button 
                                key={shape}
                                onClick={() => onUpdate({ pointShape: shape })}
                                className={`py-1.5 rounded-lg text-[8px] font-black uppercase transition-all border ${series.pointShape === shape ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-indigo-200'}`}
                            >
                                {shape === 'circle' ? '圆形' : shape === 'square' ? '方形' : shape === 'diamond' ? '菱形' : '隐藏'}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1 px-1">
                        <label className="text-[8px] font-black text-slate-400 block uppercase">点大小 (Size)</label>
                        <span className="text-[10px] font-mono font-bold text-indigo-600">{series.pointSize || 4}PX</span>
                    </div>
                    <input 
                        type="range" min="0" max="15" step="0.5" 
                        className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer" 
                        value={series.pointSize || 4} 
                        onChange={e => onUpdate({ pointSize: parseFloat(e.target.value) })} 
                    />
                </div>
            </div>
          </section>

          {/* Lines Style */}
          <section>
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">线条属性 (LINES)</h4>
            <div>
                <div className="flex justify-between items-center mb-1 px-1">
                    <label className="text-[8px] font-black text-slate-400 block uppercase">线条宽度 (Thickness)</label>
                    <span className="text-[10px] font-mono font-bold text-indigo-600">{series.strokeWidth}PX</span>
                </div>
                <input 
                    type="range" min="0.5" max="8" step="0.5" 
                    className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer" 
                    value={series.strokeWidth} 
                    onChange={e => onUpdate({ strokeWidth: parseFloat(e.target.value) })} 
                />
            </div>
          </section>
        </div>

        <footer className="mt-8">
            <button 
                onClick={onClose} 
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-black transition-all"
            >
                保存系列配置
            </button>
        </footer>
      </div>
    </div>
  );
};

export default SeriesSettingsModal;
