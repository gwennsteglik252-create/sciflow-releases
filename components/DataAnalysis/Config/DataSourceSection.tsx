
import React, { useState } from 'react';
import { DataSeries } from '../../../types';

interface DataSourceSectionProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  seriesList: DataSeries[];
  updateSeries: (id: string, updates: Partial<DataSeries>) => void;
  removeSeries: (id: string) => void;
  setSeriesSettingsId: (id: string | null) => void;
}

export const DataSourceSection: React.FC<DataSourceSectionProps> = ({
  fileInputRef, handleFileUpload, seriesList, updateSeries, removeSeries, setSeriesSettingsId
}) => {
  // 根据需求，默认状态为折叠 (false)
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="bg-slate-50/80 p-4 rounded-[2rem] border border-slate-200 shadow-sm transition-all overflow-hidden space-y-3">
      <div 
        className="flex justify-between items-center px-1 cursor-pointer group" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
         <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
           <i className="fa-solid fa-database text-indigo-500"></i> 数据源导入
         </h4>
         <button 
            className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${isExpanded ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
         >
             {isExpanded ? '收起' : '展开'}
         </button>
      </div>
      
      {isExpanded && (
        <div className="animate-reveal space-y-3">
          <div 
            onClick={() => fileInputRef.current?.click()} 
            className="border-2 border-dashed border-indigo-100 p-3 rounded-xl text-center cursor-pointer bg-white hover:bg-indigo-50/50 hover:border-indigo-400 transition-all group shadow-inner flex flex-col items-center justify-center min-h-[60px]"
          >
            <p className="text-[10px] font-black text-indigo-600 group-hover:scale-105 transition-transform uppercase italic tracking-tight">
              点击上传实验数据
            </p>
            <p className="text-[7px] font-bold text-indigo-400 mt-1 uppercase">支持三列识别: X, Y, Error (误差线)</p>
            <p className="text-[6px] font-bold text-slate-300 uppercase">.CSV, .XLSX, .XY 格式可用</p>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".csv,.xlsx,.xls,.txt,.xy" multiple />
          </div>

          {seriesList.length > 0 && (
            <div className="space-y-1.5">
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">活动数据集</p>
               <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                 {seriesList.map((series) => (
                    <div key={series.id} className="bg-white p-1.5 rounded-xl border border-slate-100 flex items-center justify-between gap-2 group/series hover:border-indigo-200 shadow-sm">
                       <div className="flex items-center gap-2 flex-1 min-w-0">
                          <button 
                            onClick={(e) => { e.stopPropagation(); updateSeries(series.id, { visible: !series.visible }); }}
                            className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${series.visible ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'}`}
                          >
                             <i className={`fa-solid ${series.visible ? 'fa-eye' : 'fa-eye-slash'} text-[8px]`}></i>
                          </button>
                          <input 
                            className="bg-transparent border-none text-[10px] font-bold text-slate-700 outline-none flex-1 truncate"
                            value={series.name}
                            onChange={(e) => updateSeries(series.id, { name: e.target.value })}
                          />
                       </div>
                       <div className="flex items-center gap-1.5 shrink-0">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setSeriesSettingsId(series.id); }}
                            className="w-5 h-5 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all opacity-0 group-hover/series:opacity-100 flex items-center justify-center shadow-sm"
                          >
                            <i className="fa-solid fa-palette text-[8px]"></i>
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); removeSeries(series.id); }}
                            className="w-5 h-5 rounded-lg bg-slate-50 border border-slate-200 text-slate-300 hover:text-rose-500 hover:border-rose-200 transition-all opacity-0 group-hover/series:opacity-100 flex items-center justify-center shadow-sm"
                          >
                            <i className="fa-solid fa-trash text-[8px]"></i>
                          </button>
                       </div>
                    </div>
                 ))}
               </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
