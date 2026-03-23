
import React from 'react';
import { SampleEntry, MatrixDataset } from '../../../types';
import LaTeXText from '../../Common/LaTeXText';
import { useTranslation } from '../../../locales/useTranslation';

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
  onToggleTag?: (sampleId: string, tag: string) => void;
  // L: Batch selection
  showBatchSelect?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: () => void;
  // N: Row grouping
  groupByEnabled?: boolean;
  collapsedGroups?: Set<string>;
  onToggleGroupCollapse?: (groupName: string) => void;
  onSetGroup?: (sampleId: string, group: string) => void;
  existingGroups?: string[];
}

// Tag definitions with colors
const TAG_DEFS: { key: string; tKey: string; bg: string; text: string; border: string }[] = [
  { key: 'optimal', tKey: 'sampleMatrixView.tags.optimal', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
  { key: 'anomaly', tKey: 'sampleMatrixView.tags.anomaly', bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200' },
  { key: 'recheck', tKey: 'sampleMatrixView.tags.recheck', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  { key: 'baseline', tKey: 'sampleMatrixView.tags.baseline', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
];

export const MatrixTable: React.FC<MatrixTableProps> = ({
  activeMatrix, processColumns, resultColumns, isEditing,
  sortKey, sortOrder, isContrastMode, championSample, auditMode,
  sortedSamples, onSort, onDeleteColumn, onRenameColumn, onAddColumn, onUpdateCellValue,
  onDeleteRow, onAddRow, onTraceLog, onToggleTag,
  showBatchSelect, selectedIds, onToggleSelect, onSelectAll,
  groupByEnabled, collapsedGroups, onToggleGroupCollapse, onSetGroup, existingGroups
}) => {
  const { t } = useTranslation();
  const [tagDropdownId, setTagDropdownId] = React.useState<string | null>(null);

  const getColumnDisplay = (key: string) => {
      if (!key) return { displayName: '', unit: '' };
      const match = key.match(/(.*)\s*\((.*)\)/);
      const rawName = match ? match[1] : key;
      const unit = match ? match[2] : '';
      
      const cleanKey = rawName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      let displayName = rawName;

      if (cleanKey.includes('HALFWAVE')) displayName = t('sampleMatrixView.columnDisplay.halfWave');
      else if (cleanKey.includes('LIMITINGCURR')) displayName = t('sampleMatrixView.columnDisplay.limitingCurrent');
      else if (cleanKey.includes('RUNMODE')) displayName = t('sampleMatrixView.columnDisplay.runMode');
      else if (cleanKey === 'ECSA') displayName = t('sampleMatrixView.columnDisplay.ecsa');
      else if (cleanKey.includes('MASSACTIVITY')) displayName = t('sampleMatrixView.columnDisplay.massActivity');
      else if (cleanKey.includes('ONSETPOTENTIAL')) displayName = t('sampleMatrixView.columnDisplay.onsetPotential');
      else if (cleanKey.includes('TAFEL')) displayName = t('sampleMatrixView.columnDisplay.tafelSlope');
      else if (cleanKey.includes('CURRENTDENSITY')) displayName = t('sampleMatrixView.columnDisplay.currentDensity');
      else if (cleanKey.includes('OVERPOTENTIAL')) displayName = t('sampleMatrixView.columnDisplay.overPotential');
      else if (cleanKey.includes('TEMPERATURE') || cleanKey.includes('温度')) displayName = t('sampleMatrixView.columnDisplay.temperature');
      else if (cleanKey.includes('TIME') || cleanKey.includes('时间')) displayName = t('sampleMatrixView.columnDisplay.time');
      
      return { displayName, unit };
  };

  // ── C: Column Statistics ──
  const allColumnStats = React.useMemo(() => {
      const stats: Record<string, { min: number; max: number; mean: number; stdDev: number; count: number }> = {};
      const allCols = [...processColumns, ...resultColumns];
      allCols.forEach(key => {
          const values = activeMatrix.data
              .map(s => parseFloat(String(s.processParams[key] ?? s.results[key])))
              .filter(v => !isNaN(v));
          if (values.length < 2) return;
          const min = Math.min(...values);
          const max = Math.max(...values);
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
          stats[key] = { min, max, mean, stdDev: Math.sqrt(variance), count: values.length };
      });
      return stats;
  }, [activeMatrix, processColumns, resultColumns]);

  const columnStats = React.useMemo(() => {
      const stats: Record<string, { mean: number; stdDev: number }> = {};
      resultColumns.forEach(key => {
          if (allColumnStats[key]) {
              stats[key] = { mean: allColumnStats[key].mean, stdDev: allColumnStats[key].stdDev };
          }
      });
      return stats;
  }, [allColumnStats, resultColumns]);

  const getAnomalyInfo = (key: string, value: any) => {
      if (!auditMode || !columnStats[key] || columnStats[key].stdDev === 0) return null;
      const numVal = parseFloat(String(value));
      if (isNaN(numVal)) return null;
      const { mean, stdDev } = columnStats[key];
      const zScore = (numVal - mean) / stdDev;
      
      if (Math.abs(zScore) > 2.0) {
          let suggestion = t('sampleMatrixView.audit.checkConsistency');
          const k = key.toLowerCase();
          if (k.includes('potential') || k.includes('v')) suggestion = t('sampleMatrixView.audit.checkElectrode');
          else if (k.includes('current') || k.includes('density')) suggestion = t('sampleMatrixView.audit.checkLoading');
          
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

  // Heatmap
  const heatmapStats = React.useMemo(() => {
      if (!isContrastMode) return {};
      const stats: Record<string, { min: number; max: number }> = {};
      const allCols = [...resultColumns, ...processColumns];
      allCols.forEach(key => {
          const vals = sortedSamples.map(s => {
              const v = s.results[key] ?? s.processParams[key];
              return parseFloat(String(v));
          }).filter(v => !isNaN(v));
          if (vals.length < 2) return;
          stats[key] = { min: Math.min(...vals), max: Math.max(...vals) };
      });
      return stats;
  }, [isContrastMode, sortedSamples, resultColumns, processColumns]);

  const getHeatStyle = (key: string, value: any, isResult: boolean): React.CSSProperties => {
      if (!isContrastMode) return {};
      const stat = heatmapStats[key];
      if (!stat || stat.max === stat.min) return {};
      const num = parseFloat(String(value));
      if (isNaN(num)) return {};
      const tVal = (num - stat.min) / (stat.max - stat.min);
      const alpha = isResult ? 0.20 : 0.14;
      if (isResult) {
          const r = Math.round(255 * (1 - tVal));
          const g = Math.round(200 * tVal);
          return { backgroundColor: `rgba(${r},${g},80,${alpha})` };
      } else {
          return { backgroundColor: `rgba(99,102,241,${tVal * alpha + 0.03})` };
      }
  };

  const fmtNum = (n: number) => {
      if (Math.abs(n) >= 1000) return n.toFixed(0);
      if (Math.abs(n) >= 1) return n.toFixed(2);
      return n.toPrecision(3);
  };

  const hasStats = Object.keys(allColumnStats).length > 0;

  // N: renderSampleRow - extracted for use in both grouped and ungrouped modes
  const renderSampleRow = (sample: SampleEntry, sIdx: number) => {
    const isChampion = isContrastMode && championSample?.id === sample.id;
    const sampleTags = sample.tags || [];
    return (
      <tr key={sample.id} className={`group hover:bg-slate-50 transition-colors ${isChampion ? 'bg-amber-50/30' : ''} ${selectedIds?.has(sample.id) ? 'bg-indigo-50/40' : ''} ${tagDropdownId === sample.id ? 'relative z-[60]' : ''}`}>
        {showBatchSelect && (
          <td className="py-3 px-2 border-b border-slate-100 text-center">
            <input type="checkbox" checked={selectedIds?.has(sample.id) || false} onChange={() => onToggleSelect?.(sample.id)} className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer" />
          </td>
        )}
        <td className="py-3 px-4 border-b border-r border-slate-100 sticky left-0 bg-white group-hover:bg-slate-50 z-10 whitespace-nowrap overflow-visible">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-fit">
              {isEditing ? (
                <input className="bg-transparent text-[10px] font-black uppercase italic outline-none w-20 tracking-tight" value={sample.sampleId} onChange={e => onUpdateCellValue(sample.id, 'id', '', e.target.value)} />
              ) : (
                <span className={`text-[10px] font-black ${isChampion ? 'text-amber-600' : 'text-slate-700'} uppercase italic tracking-tight`}>{sample.sampleId}</span>
              )}
              {sampleTags.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {sampleTags.map(tagKey => {
                    const def = TAG_DEFS.find(d => d.key === tagKey);
                    if (!def) return null;
                    return <span key={tagKey} className={`text-[7px] font-black px-1.5 py-0.5 rounded-full border ${def.bg} ${def.text} ${def.border}`}>{t(def.tKey as any)}</span>;
                  })}
                </div>
              )}
              {isEditing && (
                <div className="mt-1">
                  <select value={sample.group || ''} onChange={e => onSetGroup?.(sample.id, e.target.value)} className="text-[7px] font-bold bg-slate-50 border border-slate-200 rounded px-1 py-0.5 outline-none text-slate-500 cursor-pointer">
                    <option value="">{t('sampleMatrixView.group.none')}</option>
                    {(existingGroups || []).map((g: string) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              )}
              {!isEditing && sample.group && (
                <span className="text-[7px] font-bold text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-full mt-0.5 inline-block">
                  <i className="fa-solid fa-folder text-[6px] mr-0.5"></i>{sample.group}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {sample.source && (
                <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-full ${sample.source === 'manual' ? 'bg-blue-50 text-blue-500 border border-blue-200' : sample.source === 'workflow' ? 'bg-green-50 text-green-500 border border-green-200' : 'bg-orange-50 text-orange-500 border border-orange-200'}`}>
                  {sample.source === 'manual' ? '✍' : sample.source === 'workflow' ? '⚡' : '📥'}
                </span>
              )}
              {sample.linkedLogId && onTraceLog && (
                <button onClick={() => onTraceLog(sample.linkedLogId!)} className="text-[7px] text-indigo-400 hover:text-indigo-600 transition-colors" title="Trace to log"><i className="fa-solid fa-link"></i></button>
              )}
              {isEditing && (
                <div className="flex items-center gap-0.5">
                  <div className="relative">
                    <button onClick={() => setTagDropdownId(tagDropdownId === sample.id ? null : sample.id)} className="text-slate-300 hover:text-indigo-500 transition-colors text-[9px]" title={t('sampleMatrixView.tags.addTag')}><i className="fa-solid fa-tag"></i></button>
                    {tagDropdownId === sample.id && (
                      <div className="absolute top-full left-0 mt-1 bg-white shadow-2xl rounded-xl border border-slate-200 p-1.5 z-[999] min-w-[120px]">
                        {TAG_DEFS.map(def => (
                          <button key={def.key} onClick={() => { onToggleTag?.(sample.id, def.key); setTagDropdownId(null); }} className={`block w-full text-left text-[9px] font-bold px-3 py-1.5 rounded-lg transition-colors ${sampleTags.includes(def.key) ? `${def.bg} ${def.text}` : 'text-slate-600 hover:bg-slate-50'}`}>
                            {t(def.tKey as any)} {sampleTags.includes(def.key) && '✓'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => onDeleteRow(sample.id)} className="text-slate-200 hover:text-rose-500 transition-all text-[9px]"><i className="fa-solid fa-trash-can"></i></button>
                </div>
              )}
            </div>
          </div>
        </td>
        {processColumns.map(key => (
          <td key={key} className="py-3 px-4 border-b border-r border-slate-100 text-center whitespace-nowrap bg-indigo-50/5 transition-colors" style={getHeatStyle(key, sample.processParams[key], false)}>
            {isEditing ? (
              <input className="w-full bg-transparent text-[9px] font-black outline-none text-center" value={sample.processParams[key] || ''} onChange={e => onUpdateCellValue(sample.id, 'param', key, e.target.value)} />
            ) : (
              <div className="relative group/cell">
                <span className="text-[10px] font-black text-slate-800">{sample.processParams[key] || '-'}</span>
                {isContrastMode && championSample && !isChampion && getDiffDisplay(sample.processParams[key], championSample.processParams[key])}
              </div>
            )}
          </td>
        ))}
        {isEditing && <td className="border-b border-r border-slate-100 bg-indigo-50/5"></td>}
        {resultColumns.map(key => {
          const anomaly = getAnomalyInfo(key, sample.results[key]);
          return (
            <td key={key} className={`py-3 px-4 border-b border-r border-slate-100 text-center whitespace-nowrap transition-colors ${anomaly?.severity === 'critical' ? 'bg-rose-50/50' : anomaly?.severity === 'warning' ? 'bg-amber-50/50' : ''}`} style={anomaly ? {} : getHeatStyle(key, sample.results[key], true)}>
              {isEditing ? (
                <input className="w-full bg-transparent text-[9px] font-black outline-none text-center text-indigo-600" value={sample.results[key] || ''} onChange={e => onUpdateCellValue(sample.id, 'result', key, e.target.value)} />
              ) : (
                <div className="relative group/cell">
                  <span className={`text-[10px] font-black ${anomaly ? 'text-rose-600' : 'text-slate-900'}`}>{sample.results[key] || '-'}</span>
                  {isContrastMode && championSample && !isChampion && getDiffDisplay(sample.results[key], championSample.results[key])}
                  {anomaly && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-900 text-white p-2 rounded-lg text-[9px] font-bold shadow-xl opacity-0 group-hover/cell:opacity-100 transition-opacity z-50 pointer-events-none">
                      <p className="text-rose-400 uppercase mb-1">{t('sampleMatrixView.audit.anomalyAlert')}</p>
                      <p className="mb-1">{t('sampleMatrixView.audit.deviationMsg', { percent: Math.abs(anomaly.percent).toFixed(1) })}</p>
                      <p className="text-slate-400 italic">{t('sampleMatrixView.audit.suggestionPrefix')}{anomaly.suggestion}</p>
                    </div>
                  )}
                </div>
              )}
            </td>
          );
        })}
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
  };

  return (
    <div className="flex-1 overflow-auto custom-scrollbar rounded-2xl">
      <table className="text-left border-collapse w-full table-auto">
        <thead className="bg-slate-50 sticky top-0 z-10">
          <tr className="border-b border-slate-100">
            {/* L: Batch select checkbox */}
            {showBatchSelect && (
              <th className="py-3 px-2 bg-slate-50 z-20 border-r border-slate-100 w-8">
                <input
                  type="checkbox"
                  checked={selectedIds ? selectedIds.size === sortedSamples.length && sortedSamples.length > 0 : false}
                  onChange={() => onSelectAll?.()}
                  className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                />
              </th>
            )}
            <th className="py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky left-0 bg-slate-50 z-20 border-r border-slate-100 whitespace-nowrap">
              {t('sampleMatrixView.table.sampleIdSource')}
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
            <th className="py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-slate-100 whitespace-nowrap">
              {t('sampleMatrixView.table.noteAnnotation')}
            </th>
          </tr>

          {/* ── C: Stats Summary Row ── */}
          {hasStats && !isEditing && (
            <tr className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50/20">
              {showBatchSelect && <td className="bg-slate-50 border-r border-slate-100"></td>}
              <td className="py-1.5 px-4 sticky left-0 bg-slate-50 z-20 border-r border-slate-100">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">STATS</span>
              </td>
              {processColumns.map(key => {
                const s = allColumnStats[key];
                return (
                  <td key={key} className="py-1.5 px-2 border-r border-indigo-100 text-center">
                    {s ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex items-center gap-1.5 text-[7px] font-bold text-indigo-400">
                          <span>{fmtNum(s.min)}</span>
                          <span className="text-indigo-200">—</span>
                          <span>{fmtNum(s.max)}</span>
                        </div>
                        <div className="text-[7px] font-black text-indigo-500">
                          μ={fmtNum(s.mean)} <span className="text-indigo-300">σ={fmtNum(s.stdDev)}</span>
                        </div>
                      </div>
                    ) : <span className="text-[7px] text-slate-300">-</span>}
                  </td>
                );
              })}
              {isEditing && <td className="border-r border-slate-100"></td>}
              {resultColumns.map(key => {
                const s = allColumnStats[key];
                return (
                  <td key={key} className="py-1.5 px-2 border-r border-emerald-100 text-center">
                    {s ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex items-center gap-1.5 text-[7px] font-bold text-emerald-400">
                          <span>{fmtNum(s.min)}</span>
                          <span className="text-emerald-200">—</span>
                          <span>{fmtNum(s.max)}</span>
                        </div>
                        <div className="text-[7px] font-black text-emerald-500">
                          μ={fmtNum(s.mean)} <span className="text-emerald-300">σ={fmtNum(s.stdDev)}</span>
                        </div>
                      </div>
                    ) : <span className="text-[7px] text-slate-300">-</span>}
                  </td>
                );
              })}
              {isEditing && <td className="border-r border-slate-100"></td>}
              <td className="py-1.5 px-2">
                <span className="text-[7px] font-bold text-slate-400">{t('sampleMatrixView.stats.samples')}={activeMatrix.data.length}</span>
              </td>
            </tr>
          )}
        </thead>
        <tbody>
          {(() => {
            // N: Group rows if grouping is enabled
            if (groupByEnabled) {
              const groups = new Map<string, SampleEntry[]>();
              sortedSamples.forEach(s => {
                const g = s.group || t('sampleMatrixView.group.ungrouped');
                if (!groups.has(g)) groups.set(g, []);
                groups.get(g)!.push(s);
              });
              const totalCols = 1 + processColumns.length + resultColumns.length + 1 + (isEditing ? 2 : 0) + (showBatchSelect ? 1 : 0);

              return Array.from(groups.entries()).map(([groupName, groupSamples]) => {
                const isCollapsed = collapsedGroups?.has(groupName) || false;
                return (
                  <React.Fragment key={`g-${groupName}`}>
                    {/* Group header row */}
                    <tr className="bg-gradient-to-r from-slate-100 to-indigo-50/30 border-y-2 border-indigo-200/50">
                      <td colSpan={totalCols} className="py-2 px-4">
                        <div className="flex items-center gap-3">
                          <button onClick={() => onToggleGroupCollapse?.(groupName)} className="text-indigo-600 hover:text-indigo-800 transition-colors">
                            <i className={`fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'} text-[9px]`}></i>
                          </button>
                          <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                            <i className="fa-solid fa-folder-open text-indigo-400 mr-1.5"></i>{groupName}
                          </span>
                          <span className="text-[8px] font-bold text-indigo-400 bg-indigo-100 px-2 py-0.5 rounded-full">
                            {t('sampleMatrixView.group.samples', { count: String(groupSamples.length) })}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {/* Group samples */}
                    {!isCollapsed && groupSamples.map((sample, sIdx) => renderSampleRow(sample, sIdx))}
                  </React.Fragment>
                );
              });
            }
            // Normal (ungrouped) rendering
            return sortedSamples.map((sample, sIdx) => renderSampleRow(sample, sIdx));
          })()}
          {isEditing && (
              <tr>
                <td colSpan={processColumns.length + resultColumns.length + 3 + (isEditing ? 2 : 0)} className="p-0 border-b border-slate-100">
                    <button onClick={onAddRow} className="w-full py-3 text-[9px] font-black text-indigo-600 uppercase hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 group">
                        <i className="fa-solid fa-plus-circle group-hover:scale-110 transition-transform"></i>
                        {t('sampleMatrixView.table.addRow')}
                    </button>
                </td>
              </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
