import React, { useRef, useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useSpreadsheetLogic } from '../../hooks/useSpreadsheetLogic';
import { DataSeries } from '../../types';
import { ColumnRole, SpreadsheetState, DisplayFormat, formatCellValue } from '../../types/spreadsheet';
import { evaluateFormula, ColumnDataMap } from '../../utils/formulaEngine';
import { ChartTemplate, ACADEMIC_TEMPLATES } from '../../hooks/useDataAnalysisLogic';

interface DataSpreadsheetProps {
  spreadsheet: SpreadsheetState | undefined;
  updateSpreadsheet: (state: SpreadsheetState) => void;
  setSeriesList: (val: any) => void;
  seriesList: DataSeries[];
  /** 可用模板列表（用户 + 内置） */
  templates?: ChartTemplate[];
  /** 选列后用模板绘图 */
  onPlotColumns?: (template: ChartTemplate, seriesData: DataSeries[]) => void;
}

const ROLE_COLORS: Record<ColumnRole, { bg: string; text: string; label: string }> = {
  X:     { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'X' },
  Y:     { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Y' },
  yErr:  { bg: 'bg-amber-100',  text: 'text-amber-700',  label: 'yErr' },
  Label: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Label' },
  none:  { bg: 'bg-slate-100',  text: 'text-slate-400',  label: '—' },
};

const ROLE_CYCLE: ColumnRole[] = ['none', 'X', 'Y', 'yErr', 'Label'];

/** 内置快速绘图模板（仅图表类型，无完整样式） */
const QUICK_CHART_TEMPLATES: ChartTemplate[] = [
  { id: 'q_scatter', name: '散点图', type: 'scatter', color: '#6366f1', colors: ['#6366f1','#10b981','#f59e0b','#f43f5e','#8b5cf6','#06b6d4'], stroke: 1.5, font: 12, axisLabelFontSize: 14, chartTitle: '', xLabel: '', yLabel: '', description: '基础散点图', pointShape: 'circle' },
  { id: 'q_line',    name: '折线图', type: 'line',    color: '#10b981', colors: ['#10b981','#6366f1','#f59e0b','#f43f5e','#8b5cf6','#06b6d4'], stroke: 2, font: 12, axisLabelFontSize: 14, chartTitle: '', xLabel: '', yLabel: '', description: '基础折线图', pointShape: 'none' },
  { id: 'q_bar',     name: '柱状图', type: 'bar',     color: '#f59e0b', colors: ['#f59e0b','#6366f1','#10b981','#f43f5e','#8b5cf6','#06b6d4'], stroke: 0, font: 12, axisLabelFontSize: 14, chartTitle: '', xLabel: '', yLabel: '', description: '基础柱状图', pointShape: 'none' },
  { id: 'q_area',    name: '面积图', type: 'area',    color: '#06b6d4', colors: ['#06b6d4','#6366f1','#10b981','#f59e0b','#f43f5e','#8b5cf6'], stroke: 1.5, font: 12, axisLabelFontSize: 14, chartTitle: '', xLabel: '', yLabel: '', description: '基础面积图', pointShape: 'none' },
];

const CHART_TYPE_ICON: Record<string, string> = {
  scatter: 'fa-solid fa-braille',
  line: 'fa-solid fa-chart-line',
  bar: 'fa-solid fa-chart-bar',
  area: 'fa-solid fa-chart-area',
};

const DataSpreadsheet: React.FC<DataSpreadsheetProps> = ({
  spreadsheet, updateSpreadsheet, setSeriesList, seriesList, templates, onPlotColumns,
}) => {
  const {
    columns, rows, maskedRows, selectedCell, editingCell, editValue, contextMenu, selection,
    selectionStats, canUndo, canRedo,
    setSelectedCell, setEditValue, setContextMenu, setSelection,
    startEditing, confirmEdit, cancelEdit,
    setCellValue, addRow, deleteRow, addColumn, deleteColumn,
    setColumnRole, setColumnMeta, toggleMaskRow, sortByColumn,
    handlePaste, handleKeyDown, handleCellClick,
    populateFromSeries, importFromFile, undo, redo,
    copySelection, clearSelection, fillDown, fillSeries,
    transposeSelection, exportCSV,
    handleDragStart, handleDragMove, handleDragEnd,
  } = useSpreadsheetLogic({ spreadsheet, updateSpreadsheet, setSeriesList });

  const tableRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // 列头/行号拖拽选择状态
  const isDraggingHeaderRef = useRef(false);
  const dragHeaderOriginRef = useRef<number | null>(null);
  const isDraggingRowRef = useRef(false);
  const dragRowOriginRef = useRef<number | null>(null);

  // 文件导入处理（支持多文件）
  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      await importFromFile(files[i]);
    }
    e.target.value = '';
  }, [importFromFile]);

  // 绘图模板选择器状态
  const [showPlotPicker, setShowPlotPicker] = useState(false);
  const plotPickerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (showPlotPicker) {
      const close = (e: MouseEvent) => {
        if (plotPickerRef.current && !plotPickerRef.current.contains(e.target as Node)) setShowPlotPicker(false);
      };
      document.addEventListener('mousedown', close);
      return () => document.removeEventListener('mousedown', close);
    }
  }, [showPlotPicker]);

  // 全部可用模板
  const allTemplates = React.useMemo(() => {
    const user = templates ?? [];
    return [...ACADEMIC_TEMPLATES, ...user, ...QUICK_CHART_TEMPLATES];
  }, [templates]);

  // 选列绘图（带模板）
  const handlePlotWithTemplate = useCallback((tpl: ChartTemplate) => {
    const xCol = columns.findIndex(c => c.role === 'X');
    const yCols = columns.map((c, i) => ({ col: c, index: i })).filter(({ col }) => col.role === 'Y');
    if (xCol === -1 || yCols.length === 0) return;

    const palette = tpl.colors || ['#6366f1','#10b981','#f59e0b','#f43f5e','#8b5cf6','#06b6d4'];

    // 智能生成系列名称：优先用 longName，同名时追加列字母标识去重
    const rawNames = yCols.map(({ col }) => col.longName || col.name);
    const nameCount = new Map<string, number>();
    rawNames.forEach(n => nameCount.set(n, (nameCount.get(n) || 0) + 1));

    const usedNames = new Map<string, number>();
    const seriesNames = yCols.map(({ col, index }, si) => {
      const baseName = col.longName || col.name;
      if (nameCount.get(baseName)! > 1) {
        // 同名列存在 → 追加列字母标识
        const seq = (usedNames.get(baseName) || 0) + 1;
        usedNames.set(baseName, seq);
        return `${baseName} (${col.name})`;
      }
      return baseName;
    });

    const newSeries: DataSeries[] = yCols.map(({ col, index }, si) => {
      const data = rows
        .filter((_, ri) => !maskedRows.has(ri))
        .map(row => {
          const x = parseFloat(row[xCol]);
          const y = parseFloat(row[index]);
          return { name: String(x), value: y };
        })
        .filter(d => !isNaN(d.value));
      return {
        id: `plot_${Date.now()}_${si}`,
        name: seriesNames[si],
        data,
        color: palette[si % palette.length],
        visible: true,
      };
    });

    if (onPlotColumns) {
      onPlotColumns(tpl, newSeries);
    } else {
      setSeriesList(newSeries);
    }
    setShowPlotPicker(false);
  }, [columns, rows, maskedRows, onPlotColumns, setSeriesList]);

  // 列头编辑状态
  const [editingColHeader, setEditingColHeader] = useState<{ col: number; field: 'longName' | 'unit' } | null>(null);
  const [colHeaderValue, setColHeaderValue] = useState('');

  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingCell]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu, setContextMenu]);

  // 全局 mouseup 结束拖拽框选
  useEffect(() => {
    const onMouseUp = () => {
      handleDragEnd();
      isDraggingHeaderRef.current = false;
      isDraggingRowRef.current = false;
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, [handleDragEnd]);

  // 右键菜单渲染后自动调整位置，防止溢出视口
  useEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;
    const el = contextMenuRef.current;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const padding = 8;
    let x = contextMenu.x;
    let y = contextMenu.y;
    if (x + rect.width > vw - padding) x = Math.max(padding, vw - rect.width - padding);
    if (y + rect.height > vh - padding) y = Math.max(padding, vh - rect.height - padding);
    setMenuPos({ x, y });
  }, [contextMenu]);

  const handleRoleCycle = (colIndex: number) => {
    const currentRole = columns[colIndex]?.role ?? 'none';
    const nextIdx = (ROLE_CYCLE.indexOf(currentRole) + 1) % ROLE_CYCLE.length;
    setColumnRole(colIndex, ROLE_CYCLE[nextIdx]);
  };

  const handleContextMenu = (e: React.MouseEvent, row: number, col: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, row, col });
    setMenuPos({ x: e.clientX, y: e.clientY });
    setSelectedCell({ row, col });
  };

  const handleImportFromChart = () => {
    if (seriesList.length > 0) {
      populateFromSeries(seriesList);
    }
  };

  // 公式状态管理
  const [formulaInput, setFormulaInput] = useState('');
  const [formulaColIndex, setFormulaColIndex] = useState<number | null>(null);
  const [formulaError, setFormulaError] = useState<string | null>(null);

  const setColumnFormula = useCallback((colIndex: number, formula: string) => {
    const newCols = columns.map((c, i) => i === colIndex ? { ...c, formula: formula || undefined } : c);
    if (formula.trim()) {
      const colData: ColumnDataMap = {};
      columns.forEach((c, ci) => {
        colData[c.name] = rows.map(r => parseFloat(r[ci])).map(v => isNaN(v) ? 0 : v);
      });
      const result = evaluateFormula(formula, colData, rows.length);
      if (result.error) {
        setFormulaError(result.error);
        return;
      }
      setFormulaError(null);
      const newRows = rows.map((r, ri) => {
        const newRow = [...r];
        newRow[colIndex] = result.values[ri] !== undefined && !isNaN(result.values[ri]) ? String(result.values[ri]) : '';
        return newRow;
      });
      updateSpreadsheet({ columns: newCols, rows: newRows, maskedRows: spreadsheet?.maskedRows ?? [] });
    } else {
      setFormulaError(null);
      updateSpreadsheet({ columns: newCols, rows, maskedRows: spreadsheet?.maskedRows ?? [] });
    }
  }, [columns, rows, updateSpreadsheet, spreadsheet?.maskedRows]);

  const handleColumnSelect = (colIndex: number) => {
    setFormulaColIndex(colIndex);
    setFormulaInput(columns[colIndex]?.formula || '');
    setFormulaError(null);
  };

  // 列头长名称/单位编辑确认
  const confirmColHeaderEdit = () => {
    if (editingColHeader) {
      setColumnMeta(editingColHeader.col, { [editingColHeader.field]: colHeaderValue || undefined });
      setEditingColHeader(null);
    }
  };

  // 格式化统计值
  const fmtStat = (v: number) => {
    if (Math.abs(v) < 0.0001 || Math.abs(v) > 1e6) return v.toExponential(3);
    return v.toPrecision(6);
  };

  // 判断单元格是否在选区内
  const isInSelection = (row: number, col: number) => {
    if (!selection) return false;
    return row >= selection.startRow && row <= selection.endRow &&
           col >= selection.startCol && col <= selection.endCol;
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden animate-reveal">
      {/* 隐藏的文件输入 */}
      <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.txt,.tsv" multiple className="hidden" onChange={handleFileImport} />

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 shrink-0 flex-wrap">
        {/* 文件导入 */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-[10px] font-black uppercase text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
        >
          <i className="fa-solid fa-file-import text-[9px]" /> 导入文件
        </button>
        {seriesList.length > 0 && (
          <button
            onClick={handleImportFromChart}
            className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-[10px] font-black uppercase text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
          >
            <i className="fa-solid fa-chart-simple text-[9px]" /> 从图表导入
          </button>
        )}

        {/* 导出 */}
        <button
          onClick={exportCSV}
          className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[10px] font-black uppercase text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
        >
          <i className="fa-solid fa-file-arrow-down text-[9px]" /> 导出CSV
        </button>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        <button
          onClick={() => addRow()}
          className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm active:scale-95 flex items-center gap-1"
        >
          <i className="fa-solid fa-plus text-[8px]" /> 行
        </button>
        <button
          onClick={() => addColumn()}
          className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm active:scale-95 flex items-center gap-1"
        >
          <i className="fa-solid fa-plus text-[8px]" /> 列
        </button>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        {/* Undo / Redo */}
        <button onClick={undo} disabled={!canUndo} title="撤销 (⌘Z)" className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-all shadow-sm active:scale-95 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed">
          <i className="fa-solid fa-rotate-left text-[9px]" />
        </button>
        <button onClick={redo} disabled={!canRedo} title="重做 (⌘⇧Z)" className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600 transition-all shadow-sm active:scale-95 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed">
          <i className="fa-solid fa-rotate-right text-[9px]" />
        </button>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        {/* 显示格式快捷切换 */}
        {selectedCell && (
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-black text-slate-400 uppercase">格式:</span>
            {(['auto', 'scientific', 'fixed'] as DisplayFormat[]).map(fmt => (
              <button
                key={fmt}
                onClick={() => setColumnMeta(selectedCell.col, { displayFormat: fmt })}
                className={`px-2 py-1 rounded-md text-[8px] font-bold uppercase transition-all border ${
                  (columns[selectedCell.col]?.displayFormat ?? 'auto') === fmt
                    ? 'bg-indigo-100 text-indigo-700 border-indigo-300'
                    : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                }`}
              >
                {fmt === 'auto' ? '自动' : fmt === 'scientific' ? '科学' : '固定'}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {/* ── 选列绘图：模板选择器 ── */}
        {columns.some(c => c.role === 'X') && columns.some(c => c.role === 'Y') && (
          <div className="relative" ref={plotPickerRef}>
            <button
              onClick={() => setShowPlotPicker(!showPlotPicker)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm active:scale-95 flex items-center gap-1.5 ${
                showPlotPicker
                  ? 'bg-indigo-600 text-white'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-600 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-chart-pie text-[9px]" /> 选择模板绘图 <i className={`fa-solid fa-chevron-${showPlotPicker ? 'up' : 'down'} text-[7px] ml-0.5`} />
            </button>
            {showPlotPicker && (
              <div className="absolute right-0 top-full mt-2 z-[999] bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 w-[420px] max-h-[360px] overflow-y-auto custom-scrollbar animate-reveal">
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">学术 / 自定义模板</div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {allTemplates.filter(t => !t.id.startsWith('q_')).map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => handlePlotWithTemplate(tpl)}
                      className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-100">
                        <i className={`${CHART_TYPE_ICON[tpl.type] || 'fa-solid fa-chart-line'} text-sm ${tpl.isStandard ? 'text-indigo-500' : 'text-slate-500'}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-black text-slate-700 truncate">{tpl.name}</div>
                        <div className="text-[8px] text-slate-400 mt-0.5 line-clamp-1">{tpl.description || tpl.type}</div>
                        <div className="flex gap-0.5 mt-1">
                          {(tpl.colors || []).slice(0, 5).map((c, i) => (
                            <div key={i} className="w-2.5 h-2.5 rounded-full border border-white shadow-sm" style={{ background: c }} />
                          ))}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">快速绘图</div>
                <div className="grid grid-cols-4 gap-2">
                  {QUICK_CHART_TEMPLATES.map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => handlePlotWithTemplate(tpl)}
                      className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all group"
                    >
                      <i className={`${CHART_TYPE_ICON[tpl.type]} text-lg text-slate-400 group-hover:text-emerald-600`} />
                      <span className="text-[9px] font-bold text-slate-500 group-hover:text-emerald-600">{tpl.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-[9px] text-slate-400 font-mono">
          {rows.length} 行 × {columns.length} 列
        </div>
      </div>

      {/* Formula Bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white shrink-0">
        <span className="text-[9px] font-black text-purple-600 uppercase tracking-widest shrink-0 flex items-center gap-1.5">
          <i className="fa-solid fa-function" /> fx
        </span>
        {formulaColIndex !== null ? (
          <>
            <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
              {columns[formulaColIndex]?.name}
            </span>
            <input
              className={`flex-1 px-3 py-1.5 text-xs font-mono rounded-lg border outline-none transition-all ${formulaError ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-200 bg-white focus:border-purple-400 focus:ring-2 focus:ring-purple-100'}`}
              placeholder='输入公式，如 col(A) * 2 + 1 或 sin(col(A))'
              value={formulaInput}
              onChange={(e) => setFormulaInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && formulaColIndex !== null) {
                  setColumnFormula(formulaColIndex, formulaInput);
                }
              }}
            />
            <button
              onClick={() => formulaColIndex !== null && setColumnFormula(formulaColIndex, formulaInput)}
              className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-[10px] font-black uppercase hover:bg-purple-500 active:scale-95 transition-all shrink-0"
            >
              <i className="fa-solid fa-check" />
            </button>
            {columns[formulaColIndex]?.formula && (
              <button
                onClick={() => { if (formulaColIndex !== null) { setColumnFormula(formulaColIndex, ''); setFormulaInput(''); } }}
                className="px-3 py-1.5 rounded-lg bg-red-50 text-red-500 border border-red-200 text-[10px] font-black uppercase hover:bg-red-500 hover:text-white active:scale-95 transition-all shrink-0"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </>
        ) : (
          <span className="text-[10px] text-slate-400 italic">点击列头选择要设置公式的列</span>
        )}
        {formulaError && (
          <span className="text-[9px] font-bold text-red-500 shrink-0">{formulaError}</span>
        )}
      </div>

      {/* Table */}
      <div
        ref={tableRef}
        className="flex-1 overflow-auto custom-scrollbar relative"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <table className="w-full border-collapse text-sm font-mono min-w-max">
          {/* Column Headers — 3 层结构 */}
          <thead className="sticky top-0 z-20">
            <tr className="bg-slate-50">
              <th
                className="w-12 bg-slate-100 border-b border-r border-slate-200 text-[9px] font-black text-slate-400 uppercase text-center py-2 sticky left-0 z-30 cursor-pointer hover:bg-indigo-100 hover:text-indigo-600 transition-colors select-none"
                onClick={() => {
                  // 全选
                  setSelection({ startRow: 0, startCol: 0, endRow: rows.length - 1, endCol: columns.length - 1 });
                  setSelectedCell(null);
                }}
                title="全选"
              >
                #
              </th>
              {columns.map((col, ci) => {
                const roleStyle = ROLE_COLORS[col.role];
                return (
                  <th
                    key={col.id}
                    className={`border-b border-r border-slate-200 px-1 py-1 min-w-[120px] cursor-pointer transition-colors select-none ${
                      selection && selection.startCol <= ci && selection.endCol >= ci && selection.startRow === 0 && selection.endRow === rows.length - 1
                        ? 'bg-indigo-100'
                        : 'bg-slate-50 hover:bg-blue-50'
                    }`}
                    onMouseDown={(e) => {
                      if (e.button === 0 && !e.shiftKey) {
                        isDraggingHeaderRef.current = true;
                        dragHeaderOriginRef.current = ci;
                        setSelection({ startRow: 0, startCol: ci, endRow: rows.length - 1, endCol: ci });
                        setSelectedCell(null);
                      }
                    }}
                    onMouseEnter={() => {
                      if (isDraggingHeaderRef.current && dragHeaderOriginRef.current !== null) {
                        const origin = dragHeaderOriginRef.current;
                        setSelection({
                          startRow: 0,
                          startCol: Math.min(origin, ci),
                          endRow: rows.length - 1,
                          endCol: Math.max(origin, ci),
                        });
                      }
                    }}
                    onClick={(e) => {
                      if (dragHeaderOriginRef.current !== null && dragHeaderOriginRef.current !== ci) return;
                      if (e.shiftKey && selection) {
                        setSelection({ startRow: 0, startCol: Math.min(selection.startCol, ci), endRow: rows.length - 1, endCol: Math.max(selection.endCol, ci) });
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, row: -1, col: ci });
                      setMenuPos({ x: e.clientX, y: e.clientY });
                      setSelection({ startRow: 0, startCol: ci, endRow: rows.length - 1, endCol: ci });
                      setSelectedCell(null);
                    }}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      {/* 第1层：列名 + 长名称 */}
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[11px] font-black tracking-wider cursor-pointer px-2 py-0.5 rounded-md transition-all ${
                            formulaColIndex === ci ? 'bg-purple-100 text-purple-700' : 'text-slate-700 hover:bg-slate-100'
                          } ${col.formula ? 'ring-1 ring-purple-300' : ''}`}
                          onClick={() => handleColumnSelect(ci)}
                          title={col.formula ? `公式: ${col.formula}` : '点击设置公式'}
                        >
                          {col.name}
                          {col.formula && <i className="fa-solid fa-function text-[7px] text-purple-500 ml-1" />}
                        </span>
                      </div>

                      {/* 第2层：长名称 (可编辑) */}
                      {editingColHeader?.col === ci && editingColHeader.field === 'longName' ? (
                        <input
                          autoFocus
                          className="text-[9px] font-bold text-center w-full px-1 py-0.5 border border-indigo-300 rounded bg-white outline-none"
                          value={colHeaderValue}
                          onChange={e => setColHeaderValue(e.target.value)}
                          onBlur={confirmColHeaderEdit}
                          onKeyDown={e => { if (e.key === 'Enter') confirmColHeaderEdit(); if (e.key === 'Escape') setEditingColHeader(null); }}
                          placeholder="长名称"
                        />
                      ) : (
                        <span
                          className="text-[9px] text-slate-400 cursor-pointer hover:text-indigo-600 transition-colors italic truncate max-w-[100px]"
                          onDoubleClick={() => { setEditingColHeader({ col: ci, field: 'longName' }); setColHeaderValue(col.longName || ''); }}
                          title="双击编辑长名称"
                        >
                          {col.longName || '长名称'}
                        </span>
                      )}

                      {/* 第2.5层：单位 (可编辑) */}
                      {editingColHeader?.col === ci && editingColHeader.field === 'unit' ? (
                        <input
                          autoFocus
                          className="text-[8px] font-mono text-center w-16 px-1 py-0.5 border border-indigo-300 rounded bg-white outline-none"
                          value={colHeaderValue}
                          onChange={e => setColHeaderValue(e.target.value)}
                          onBlur={confirmColHeaderEdit}
                          onKeyDown={e => { if (e.key === 'Enter') confirmColHeaderEdit(); if (e.key === 'Escape') setEditingColHeader(null); }}
                          placeholder="单位"
                        />
                      ) : (
                        <span
                          className="text-[8px] text-slate-300 cursor-pointer hover:text-indigo-500 transition-colors font-mono"
                          onDoubleClick={() => { setEditingColHeader({ col: ci, field: 'unit' }); setColHeaderValue(col.unit || ''); }}
                          title="双击编辑单位"
                        >
                          {col.unit ? `[${col.unit}]` : '[单位]'}
                        </span>
                      )}

                      {/* 第3层：角色标签 */}
                      <button
                        onClick={() => handleRoleCycle(ci)}
                        className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest transition-all ${roleStyle.bg} ${roleStyle.text} hover:ring-2 hover:ring-indigo-300 active:scale-95`}
                        title="点击切换列角色 (X → Y → yErr → Label → none)"
                      >
                        {roleStyle.label}
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, ri) => {
              const isMasked = maskedRows.has(ri);
              return (
                <tr key={ri} className={`group transition-colors ${isMasked ? 'bg-slate-100/60' : 'hover:bg-indigo-50/30'}`}>
                  {/* Row number — 点击选整行，右键屏蔽 */}
                  <td
                    className={`bg-slate-50 border-b border-r border-slate-200 text-[10px] font-bold text-center py-1.5 sticky left-0 z-10 select-none cursor-pointer transition-all ${
                      isMasked ? 'text-red-400 bg-red-50/50'
                      : selection && selection.startRow <= ri && selection.endRow >= ri && selection.startCol === 0 && selection.endCol === columns.length - 1
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'text-slate-400 hover:bg-blue-50 hover:text-blue-600'
                    }`}
                    onMouseDown={(e) => {
                      if (e.button === 0 && !e.shiftKey) {
                        isDraggingRowRef.current = true;
                        dragRowOriginRef.current = ri;
                        setSelection({ startRow: ri, startCol: 0, endRow: ri, endCol: columns.length - 1 });
                        setSelectedCell(null);
                      }
                    }}
                    onMouseEnter={() => {
                      if (isDraggingRowRef.current && dragRowOriginRef.current !== null) {
                        const origin = dragRowOriginRef.current;
                        setSelection({
                          startRow: Math.min(origin, ri),
                          startCol: 0,
                          endRow: Math.max(origin, ri),
                          endCol: columns.length - 1,
                        });
                      }
                    }}
                    onClick={(e) => {
                      if (dragRowOriginRef.current !== null && dragRowOriginRef.current !== ri) return;
                      if (e.shiftKey && selection) {
                        setSelection({ startRow: Math.min(selection.startRow, ri), startCol: 0, endRow: Math.max(selection.endRow, ri), endCol: columns.length - 1 });
                      }
                    }}
                    onContextMenu={(e) => { e.preventDefault(); toggleMaskRow(ri); }}
                    title="拖拽选行，右键屏蔽"
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      {isMasked && <i className="fa-solid fa-eye-slash text-[7px] text-red-400" />}
                      {ri + 1}
                    </div>
                  </td>
                  {row.map((cell, ci) => {
                    const isSelected = selectedCell?.row === ri && selectedCell?.col === ci;
                    const isEditing = editingCell?.row === ri && editingCell?.col === ci;
                    const inSel = isInSelection(ri, ci);
                    const colDef = columns[ci];
                    const displayValue = formatCellValue(cell, colDef?.displayFormat, colDef?.precision);
                    const numVal = parseFloat(cell);
                    const isNegative = !isNaN(numVal) && numVal < 0;

                    return (
                      <td
                        key={ci}
                        className={`border-b border-r border-slate-100 px-0 py-0 relative cursor-cell transition-all ${
                          isSelected ? 'ring-2 ring-indigo-500 ring-inset z-10 bg-indigo-50/50' : ''
                        } ${inSel ? 'bg-blue-100/40' : ''} ${isMasked ? 'opacity-50' : ''}`}
                        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                        onClick={(e) => handleCellClick(ri, ci, e.shiftKey)}
                        onMouseDown={(e) => {
                          if (e.button === 0 && !e.shiftKey) { // 左键，非 Shift
                            handleDragStart(ri, ci);
                          }
                        }}
                        onMouseEnter={() => handleDragMove(ri, ci)}
                        onDoubleClick={() => startEditing(ri, ci)}
                        onContextMenu={(e) => handleContextMenu(e, ri, ci)}
                        onPaste={(e) => handlePaste(e, ri, ci)}
                      >
                        {isEditing ? (
                          <input
                            ref={editInputRef}
                            className="w-full h-full px-2 py-1.5 text-xs outline-none bg-white border-0 font-mono"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={confirmEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); confirmEdit(); }
                              else if (e.key === 'Escape') { cancelEdit(); }
                              else if (e.key === 'Tab') {
                                e.preventDefault();
                                confirmEdit();
                                setSelectedCell({ row: ri, col: Math.min(ci + 1, columns.length - 1) });
                              }
                            }}
                          />
                        ) : (
                          <div className={`px-2 py-1.5 text-xs min-h-[28px] truncate ${
                            isMasked ? 'line-through text-slate-400' : isNegative ? 'text-red-600 font-semibold' : 'text-slate-700'
                          }`}>
                            {displayValue}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Context Menu — Portal 到 body 避免父容器 transform 影响 fixed 定位 */}
      {contextMenu && ReactDOM.createPortal(
        <div
          ref={contextMenuRef}
          className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-200 py-2 min-w-[200px] max-h-[80vh] overflow-y-auto custom-scrollbar animate-reveal"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          {/* 复制 / 清空 */}
          <button
            onClick={() => { copySelection(selection, selectedCell); setContextMenu(null); }}
            className="w-full px-4 py-2 text-left text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2"
          >
            <i className="fa-solid fa-copy text-[10px] w-4" /> 复制 <span className="ml-auto text-[9px] text-slate-400">⌘C</span>
          </button>
          <button
            onClick={() => { setCellValue(contextMenu.row, contextMenu.col, ''); setContextMenu(null); }}
            className="w-full px-4 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <i className="fa-solid fa-eraser text-[10px] w-4" /> 清空此单元格
          </button>
          {selection && (
            <button
              onClick={() => { clearSelection(selection); setContextMenu(null); }}
              className="w-full px-4 py-2 text-left text-xs font-bold text-orange-600 hover:bg-orange-50 transition-colors flex items-center gap-2"
            >
              <i className="fa-solid fa-broom text-[10px] w-4" /> 清空选区 ({selection.endRow - selection.startRow + 1}×{selection.endCol - selection.startCol + 1})
            </button>
          )}

          <div className="border-t border-slate-100 my-1" />

          {/* 插入/删除行列 */}
          {contextMenu.row >= 0 && (
            <>
              <button
                onClick={() => { addRow(contextMenu.row); setContextMenu(null); }}
                className="w-full px-4 py-2 text-left text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-arrow-down text-[10px] w-4" /> 下方插入行
              </button>
              <button
                onClick={() => { deleteRow(contextMenu.row); setContextMenu(null); }}
                className="w-full px-4 py-2 text-left text-xs font-bold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-trash text-[10px] w-4" /> 删除此行
              </button>
            </>
          )}
          <button
            onClick={() => { addColumn(contextMenu.col); setContextMenu(null); }}
            className="w-full px-4 py-2 text-left text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2"
          >
            <i className="fa-solid fa-arrow-right text-[10px] w-4" /> 右侧插入列
          </button>
          <button
            onClick={() => { deleteColumn(contextMenu.col); setContextMenu(null); }}
            className="w-full px-4 py-2 text-left text-xs font-bold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
          >
            <i className="fa-solid fa-trash text-[10px] w-4" /> 删除此列
          </button>

          <div className="border-t border-slate-100 my-1" />

          {/* 屏蔽 */}
          {contextMenu.row >= 0 && (
            <button
              onClick={() => { toggleMaskRow(contextMenu.row); setContextMenu(null); }}
              className="w-full px-4 py-2 text-left text-xs font-bold text-amber-600 hover:bg-amber-50 transition-colors flex items-center gap-2"
            >
              <i className={`fa-solid ${maskedRows.has(contextMenu.row) ? 'fa-eye' : 'fa-eye-slash'} text-[10px] w-4`} />
              {maskedRows.has(contextMenu.row) ? '取消屏蔽此行' : '屏蔽此行 (不参与分析)'}
            </button>
          )}

          <div className="border-t border-slate-100 my-1" />

          {/* 排序 */}
          <button
            onClick={() => { sortByColumn(contextMenu.col, 'asc'); setContextMenu(null); }}
            className="w-full px-4 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <i className="fa-solid fa-arrow-up-1-9 text-[10px] w-4" /> 升序排列
          </button>
          <button
            onClick={() => { sortByColumn(contextMenu.col, 'desc'); setContextMenu(null); }}
            className="w-full px-4 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <i className="fa-solid fa-arrow-down-9-1 text-[10px] w-4" /> 降序排列
          </button>

          {/* 填充 & 转置（当有选区时显示） */}
          {selection && (
            <>
              <div className="border-t border-slate-100 my-1" />
              <button
                onClick={() => { fillDown(selection); setContextMenu(null); }}
                className="w-full px-4 py-2 text-left text-xs font-bold text-cyan-600 hover:bg-cyan-50 transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-arrow-down-long text-[10px] w-4" /> 向下填充 <span className="ml-auto text-[9px] text-slate-400">⌘D</span>
              </button>
              <button
                onClick={() => {
                  const step = prompt('输入等差步长 (默认 1):', '1');
                  if (step !== null) { fillSeries(selection, parseFloat(step) || 1); }
                  setContextMenu(null);
                }}
                className="w-full px-4 py-2 text-left text-xs font-bold text-cyan-600 hover:bg-cyan-50 transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-list-ol text-[10px] w-4" /> 等差序列填充...
              </button>
              <button
                onClick={() => { transposeSelection(selection); setContextMenu(null); }}
                className="w-full px-4 py-2 text-left text-xs font-bold text-purple-600 hover:bg-purple-50 transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-arrows-rotate text-[10px] w-4" /> 转置选区
              </button>
            </>
          )}
        </div>,
        document.body
      )}

      {/* Footer — 选区统计栏 / 角色图例 */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-t border-slate-100 bg-gradient-to-r from-slate-50 to-white shrink-0 min-h-[40px]">
        {selectionStats ? (
          <>
            <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest shrink-0">
              <i className="fa-solid fa-calculator mr-1" />统计
            </span>
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { label: 'Count', value: selectionStats.count.toString() },
                { label: 'Sum', value: fmtStat(selectionStats.sum) },
                { label: 'Mean', value: fmtStat(selectionStats.mean) },
                { label: 'StdDev', value: fmtStat(selectionStats.stddev) },
                { label: 'Min', value: fmtStat(selectionStats.min) },
                { label: 'Max', value: fmtStat(selectionStats.max) },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase">{s.label}:</span>
                  <span className="text-[10px] font-mono font-bold text-indigo-600">{s.value}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">列角色：</span>
            {Object.entries(ROLE_COLORS).filter(([k]) => k !== 'none').map(([key, val]) => (
              <span key={key} className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase ${val.bg} ${val.text}`}>
                {val.label}
              </span>
            ))}
            <div className="flex-1" />
            <span className="text-[8px] text-slate-400">双击编辑 · 点击行号/列头选区 · ⌘C复制 · ⌘A全选 · ⌘D填充 · ⌘Z撤销 · 右键更多</span>
          </>
        )}
      </div>
    </div>
  );
};

export default DataSpreadsheet;
