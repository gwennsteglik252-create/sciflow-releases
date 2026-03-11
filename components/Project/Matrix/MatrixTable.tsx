
import React from 'react';
import { SampleEntry, MatrixDataset } from '../../../types';
import LaTeXText from '../../Common/LaTeXText';

interface MatrixTableProps {
  activeMatrix: MatrixDataset;
  processColumns: string[];
  resultColumns: string[];
  isEditing: boolean;
  sortKey: string | null;
  sortOrder: 'asc' | 'desc';
  isContrastMode: boolean;
  championSample: SampleEntry | null;
  auditMode: boolean;
  sortedSamples: SampleEntry[];
  onSort: (key: string) => void;
  onDeleteColumn: (type: 'param' | 'result', key: string) => void;
  onRenameColumn: (type: 'param' | 'result', oldKey: string, newKey: string) => void;
  onAddColumn: (type: 'param' | 'result') => void;
  onUpdateCellValue: (id: string, type: 'id' | 'note' | 'param' | 'result', key: string, value: string) => void;
  onDeleteRow: (id: string) => void;
  onAddRow: () => void;
  onTraceLog?: (logId: string) => void;
}

export const MatrixTable: React.FC<MatrixTableProps> = ({
  activeMatrix, processColumns, resultColumns, isEditing,
  sortKey, sortOrder, isContrastMode, championSample, auditMode,
  sortedSamples, onSort, onDeleteColumn, onRenameColumn, onAddColumn, onUpdateCellValue,
  onDeleteRow, onAddRow, onTraceLog
}) => {

  const getColumnDisplay = (key: string) => {
      if (!key) return { displayName: '', unit: '' };
      const match = key.match(/(.*)\s*\((.*)\)/);
      const rawName = match ? match[1] : key;
      const unit = match ? match[2] : '';
      
      const cleanKey = rawName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      let displayName = rawName;

      if (cleanKey.includes('HALFWAVE')) displayName = '$E_{1/2}$ (半波电位)';
      else if (cleanKey.includes('LIMITINGCURR')) displayName = '$j_L$ (极限电流)';
      else if (cleanKey.includes('RUNMODE')) displayName = '运行模式';
      else if (cleanKey === 'ECSA') displayName = 'ECSA (活性面积)';
      else if (cleanKey.includes('MASSACTIVITY')) displayName = '质量活性';
      else if (cleanKey.includes('ONSETPOTENTIAL')) displayName = '起始电位';
      else if (cleanKey.includes('TAFEL')) displayName = '塔菲尔斜率';
      else if (cleanKey.includes('CURRENTDENSITY')) displayName = '电流密度';
      else if (cleanKey.includes('OVERPOTENTIAL')) displayName = '过电位';
      else if (cleanKey.includes('TEMPERATURE') || cleanKey.includes('温度')) displayName = '温度';
      else if (cleanKey.includes('TIME') || cleanKey.includes('时间')) displayName = '时间';
      
      return { displayName, unit };
  };

  const columnStats = React.useMemo(() => {
      const stats: Record<string, { mean: number; stdDev: number }> = {};
      resultColumns.forEach(key => {
          const values = activeMatrix.data
              .map(s => parseFloat(String(s.results[key])))
              .filter(v => !isNaN(v));
          if (values.length < 3) return;
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
          stats[key] = { mean, stdDev: Math.sqrt(variance) };
      });
      return stats;
  }, [activeMatrix, resultColumns]);

  const getAnomalyInfo = (key: string, value: any) => {
      if (!auditMode || !columnStats[key] || columnStats[key].stdDev === 0) return null;
      const numVal = parseFloat(String(value));
      if (isNaN(numVal)) return null;
      const { mean, stdDev } = columnStats[key];
      const zScore = (numVal - mean) / stdDev;
      
      if (Math.abs(zScore) > 2.0) {
          let suggestion = "建议回溯检查实验操作一致性";
          const k = key.toLowerCase();
          if (k.includes('potential') || k.includes('v')) suggestion = "建议检查参比电极校准";
          else if (k.includes('current') || k.includes('density')) suggestion = "建议检查催化剂负载量";
          
          return {
              isAnomaly: true,
              severity: Math.abs(zScore) > 3 ? 'critical' : 'warning',
              diff: numVal - mean,
              percent: ((numVal - mean) / mean) * 100,
              suggestion
          };
      }
      return null;
  };

  const getDiffDisplay = (currentVal: any, refVal: any) => {
      const numC = parseFloat(currentVal);
      const numR = parseFloat(refVal);
      // Fix: Corrected typo 'iZNaN' to 'isNaN'
      if (isNaN(numC) || isNaN(numR)) return null;
      const diff = numC - numR;
      if (diff === 0) return null;
      const sign = diff > 0 ? '+' : '';
      const color = diff > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50';
      return (
          <span className={`text-[9px] font-bold px-1 rounded ml-1.5 ${color}`}>
              {sign}{diff.toFixed(2)}
          </span>
      );
  };

  return (
    <div className="flex-1 overflow-auto custom-scrollbar rounded-2xl">
      <table className="text-left border-collapse w-full table-auto">
        <thead className="bg-slate-50 sticky top-0 z-10">
          <tr className="border-b border-slate-100">
            <th className={`py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-50 z-20 border-r border-slate-100 whitespace-nowrap`}>
              样本 ID / 来源
            </th>
            {processColumns.map(key => {
              const { displayName, unit } = getColumnDisplay(key);
              return (
              <th 
                key={key} 
                className={`px-4 border-r border-indigo-100 group bg-indigo-50/30 whitespace-nowrap ${isEditing ? 'py-4' : 'py-3 cursor-pointer hover:bg-indigo-50/50'} ${sortKey === key ? 'bg-indigo-100/50' : ''}`}
                onClick={() => !isEditing && onSort(key)}
              >
                <div className="flex flex-col items-center justify-center text-center">
                    {isEditing ? (
                        <input 
                            className="bg-white border border-indigo-200 rounded px-2 py-1 text-[9px] font-black uppercase tracking-widest w-full min-w-[80px] outline-none focus:ring-1 focus:ring-indigo-300 text-center"
                            defaultValue={key}
                            onBlur={(e) => onRenameColumn('param', key, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        />
                    ) : (
                        <div className="flex flex-col items-center">
                            <span className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${sortKey === key ? 'text-indigo-600' : 'text-indigo-400'}`}>
                                <LaTeXText text={displayName} /> {sortKey === key && (sortOrder === 'asc' ? '↑' : '↓')}
                            </span>
                            {unit && <span className="text-[8px] font-bold text-indigo-300">({unit})</span>}
                        </div>
                    )}
                    {isEditing && (
                        <button type="button" onClick={(e) => {e.stopPropagation(); e.preventDefault(); onDeleteColumn('param', key);}} className="text-rose-300 hover:text-rose-500 hover:bg-rose-50 p-0.5 rounded transition-all mt-0.5"><i className="fa-solid fa-times"></i></button>
                    )}
                </div>
              </th>
            )})}
            {isEditing && (
                <th className="py-4 px-2 border-r border-slate-100 text-center bg-indigo-50/10 min-w-[50px]">
                    <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); onAddColumn('param'); }} className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-500 hover:text-white transition-all text-[10px] flex items-center justify-center font-bold shadow-sm">+</button>
                </th>
            )}
            {resultColumns.map(key => {
              const { displayName, unit } = getColumnDisplay(key);
              return (
              <th 
                key={key} 
                className={`px-4 border-r border-emerald-100 group bg-emerald-50/30 whitespace-nowrap ${isEditing ? 'py-4' : 'py-3 cursor-pointer hover:bg-emerald-50/50'} ${sortKey === key ? 'bg-emerald-100/50' : ''}`}
                onClick={() => !isEditing && onSort(key)}
              >
                <div className="flex flex-col items-center justify-center text-center">
                    {isEditing ? (
                        <input 
                            className="bg-white border border-emerald-200 rounded px-2 py-1 text-[9px] font-black uppercase tracking-widest w-full min-w-[80px] outline-none focus:ring-1 focus:ring-emerald-300 text-center"
                            defaultValue={key}
                            onBlur={(e) => onRenameColumn('result', key, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        />
                    ) : (
                        <div className="flex flex-col items-center">
                            <span className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${sortKey === key ? 'text-emerald-600' : 'text-emerald-500'}`}>
                                <LaTeXText text={displayName} /> {sortKey === key && (sortOrder === 'asc' ? '↑' : '↓')}
                            </span>
                            {unit && <span className="text-[8px] font-bold text-emerald-300">({unit})</span>}
                        </div>
                    )}
                    {isEditing && (
                        <button type="button" onClick={(e) => {e.stopPropagation(); e.preventDefault(); onDeleteColumn('result', key);}} className="text-rose-300 hover:text-rose-500 hover:bg-rose-50 p-0.5 rounded transition-all mt-0.5"><i className="fa-solid fa-times"></i></button>
                    )}
                </div>
              </th>
            )})}
            {isEditing && (
                <th className="py-4 px-2 border-r border-slate-100 text-center bg-emerald-50/10 min-w-[50px]">
                    <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); onAddColumn('result'); }} className="w-5 h-5 rounded-full bg-emerald-100 text-indigo-600 hover:bg-emerald-500 hover:text-white transition-all text-[10px] flex items-center justify-center font-bold shadow-sm">+</button>
                </th>
            )}
            <th className={`py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-slate-100 whitespace-nowrap`}>
              备注 / 批注
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedSamples.map((sample, sIdx) => {
            const isChampion = isContrastMode && championSample?.id === sample.id;
            return (
              <tr key={sample.id} className={`group hover:bg-slate-50 transition-colors ${isChampion ? 'bg-amber-50/30' : ''}`}>
                <td className="py-3 px-4 border-b border-r border-slate-100 sticky left-0 bg-white group-hover:bg-slate-50 z-10 whitespace-nowrap">
                   <div className="flex items-center justify-between gap-3">
                      <div className="min-w-fit">
                         {isEditing ? (
                             <input className="bg-transparent border-b border-indigo-100 font-black text-[10px] outline-none w-full" value={sample.sampleId} onChange={e => onUpdateCellValue(sample.id, 'id', '', e.target.value)} />
                         ) : (
                             <div 
                                className={sample.linkedLogId ? "cursor-pointer hover:text-indigo-600 transition-colors" : ""}
                                onClick={() => !isEditing && sample.linkedLogId && onTraceLog?.(sample.linkedLogId)}
                             >
                                <p className="text-[10px] font-black uppercase whitespace-nowrap">{sample.sampleId}</p>
                                <p className="text-[7px] font-bold text-slate-400 uppercase mt-0.5 whitespace-nowrap">{sample.source} · {new Date(sample.timestamp).toLocaleDateString()}</p>
                             </div>
                         )}
                      </div>
                      <div className="flex items-center gap-1 opacity-100 transition-opacity">
                         {onTraceLog && (
                             sample.linkedLogId ? (
                                <button 
                                    onClick={() => onTraceLog(sample.linkedLogId!)} 
                                    className="w-4 h-4 rounded bg-indigo-50 text-indigo-500 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                    title="追溯实验记录"
                                >
                                    <i className="fa-solid fa-link text-[7px]"></i>
                                </button>
                             ) : (
                                <div 
                                    className="w-4 h-4 rounded bg-slate-100 text-slate-400 flex items-center justify-center shadow-sm cursor-default border border-slate-200 hover:bg-slate-200 transition-colors"
                                    title="手动录入数据 (Manual Entry)"
                                >
                                    <i className="fa-solid fa-keyboard text-[7px]"></i>
                                </div>
                             )
                         )}
                         {isEditing && (
                             <button onClick={() => onDeleteRow(sample.id)} className="w-4 h-4 rounded bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm" title="删除行"><i className="fa-solid fa-trash-can text-[7px]"></i></button>
                         )}
                      </div>
                   </div>
                </td>
                
                {processColumns.map(key => (
                  <td key={key} className="py-3 px-4 border-b border-r border-slate-100 text-center whitespace-nowrap">
                    {isEditing ? (
                        <input className="w-full bg-transparent text-[9px] font-bold outline-none text-center text-slate-700" value={sample.processParams[key] || ''} onChange={e => onUpdateCellValue(sample.id, 'param', key, e.target.value)} />
                    ) : (
                        <div className="text-[9px] font-bold text-slate-600">
                            {sample.processParams[key] || '-'}
                            {isContrastMode && championSample && !isChampion && getDiffDisplay(sample.processParams[key], championSample.processParams[key])}
                        </div>
                    )}
                  </td>
                ))}
                {isEditing && <td className="border-b border-r border-slate-100 bg-indigo-50/5"></td>}
                
                {resultColumns.map(key => {
                  const anomaly = getAnomalyInfo(key, sample.results[key]);
                  return (
                    <td key={key} className={`py-3 px-4 border-b border-r border-slate-100 text-center whitespace-nowrap ${anomaly?.severity === 'critical' ? 'bg-rose-50/50' : anomaly?.severity === 'warning' ? 'bg-amber-50/50' : ''}`}>
                        {isEditing ? (
                            <input className="w-full bg-transparent text-[9px] font-black outline-none text-center text-indigo-600" value={sample.results[key] || ''} onChange={e => onUpdateCellValue(sample.id, 'result', key, e.target.value)} />
                        ) : (
                            <div className="relative group/cell">
                                <span className={`text-[10px] font-black ${anomaly ? 'text-rose-600' : 'text-slate-900'}`}>
                                    {sample.results[key] || '-'}
                                </span>
                                {isContrastMode && championSample && !isChampion && getDiffDisplay(sample.results[key], championSample.results[key])}
                                {anomaly && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 text-white p-2 rounded-lg text-[9px] font-bold shadow-xl opacity-0 group-hover/cell:opacity-100 transition-opacity z-50 pointer-events-none">
                                        <p className="text-rose-400 uppercase mb-1">审计偏差预警</p>
                                        <p className="mb-1">数值偏离平均水平 {Math.abs(anomaly.percent).toFixed(1)}%</p>
                                        <p className="text-slate-400 italic">建议: {anomaly.suggestion}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </td>
                )})}
                {isEditing && <td className="border-b border-r border-slate-100 bg-emerald-50/5"></td>}

                <td className="py-3 px-4 border-b border-slate-100 min-w-[120px]">
                    {isEditing ? (
                        <input className="w-full bg-transparent text-[9px] font-medium italic outline-none" value={sample.note || ''} placeholder="Add notes..." onChange={e => onUpdateCellValue(sample.id, 'note', '', e.target.value)} />
                    ) : (
                        <p className="text-[9px] text-slate-400 italic leading-relaxed">{sample.note || '-'}</p>
                    )}
                </td>
              </tr>
            );
          })}
          {isEditing && (
              <tr>
                <td colSpan={processColumns.length + resultColumns.length + 3 + (isEditing ? 2 : 0)} className="p-0 border-b border-slate-100">
                    <button onClick={onAddRow} className="w-full py-3 text-[9px] font-black text-indigo-600 uppercase hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 group">
                        <i className="fa-solid fa-plus-circle group-hover:scale-110 transition-transform"></i>
                        新增样本数据行
                    </button>
                </td>
              </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
