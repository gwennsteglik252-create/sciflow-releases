import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ColumnDef, ColumnRole, SpreadsheetState, SelectionRange, createDefaultSpreadsheet, getColumnLetter } from '../types/spreadsheet';
import { DataSeries, ChartDataPoint } from '../types';

interface UseSpreadsheetLogicProps {
  spreadsheet: SpreadsheetState | undefined;
  updateSpreadsheet: (state: SpreadsheetState) => void;
  setSeriesList: (val: any) => void;
  seriesColors?: string[];
}

const DEFAULT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];
const MAX_HISTORY = 30;

export const useSpreadsheetLogic = ({
  spreadsheet,
  updateSpreadsheet,
  setSeriesList,
  seriesColors = DEFAULT_COLORS,
}: UseSpreadsheetLogicProps) => {
  const state = spreadsheet ?? createDefaultSpreadsheet(3, 10);
  const { columns, rows } = state;
  const maskedRows = useMemo(() => new Set(state.maskedRows ?? []), [state.maskedRows]);

  // 瞬态 UI 状态
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row: number; col: number } | null>(null);
  const [selection, setSelection] = useState<SelectionRange | null>(null);

  // ── 拖拽框选状态 ──
  const isDraggingRef = useRef(false);
  const dragOriginRef = useRef<{ row: number; col: number } | null>(null);

  // ── 撤销/重做历史 ──
  const historyRef = useRef<SpreadsheetState[]>([]);
  const futureRef = useRef<SpreadsheetState[]>([]);

  const persist = useCallback((newCols: ColumnDef[], newRows: string[][], newMasked?: number[]) => {
    // 保存当前状态到历史
    historyRef.current.push({ columns, rows, maskedRows: state.maskedRows ?? [] });
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    futureRef.current = []; // 清空重做栈
    updateSpreadsheet({ columns: newCols, rows: newRows, maskedRows: newMasked ?? state.maskedRows ?? [] });
  }, [columns, rows, state.maskedRows, updateSpreadsheet]);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    futureRef.current.push({ columns, rows, maskedRows: state.maskedRows ?? [] });
    const prev = historyRef.current.pop()!;
    updateSpreadsheet(prev);
  }, [columns, rows, state.maskedRows, updateSpreadsheet]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    historyRef.current.push({ columns, rows, maskedRows: state.maskedRows ?? [] });
    const next = futureRef.current.pop()!;
    updateSpreadsheet(next);
  }, [columns, rows, state.maskedRows, updateSpreadsheet]);

  const canUndo = historyRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  // ── 单元格操作 ──
  const setCellValue = useCallback((row: number, col: number, value: string) => {
    const newRows = rows.map((r, ri) =>
      ri === row ? r.map((c, ci) => ci === col ? value : c) : [...r]
    );
    persist(columns, newRows);
  }, [rows, columns, persist]);

  const startEditing = useCallback((row: number, col: number) => {
    setEditingCell({ row, col });
    setEditValue(rows[row]?.[col] ?? '');
  }, [rows]);

  const confirmEdit = useCallback(() => {
    if (editingCell) {
      setCellValue(editingCell.row, editingCell.col, editValue);
      setEditingCell(null);
    }
  }, [editingCell, editValue, setCellValue]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  // ── 行操作 ──
  const addRow = useCallback((afterIndex?: number) => {
    const newRow = Array(columns.length).fill('');
    const idx = afterIndex !== undefined ? afterIndex + 1 : rows.length;
    const newRows = [...rows.slice(0, idx), newRow, ...rows.slice(idx)];
    // 调整 maskedRows 索引
    const adjustedMask = (state.maskedRows ?? []).map(m => m >= idx ? m + 1 : m);
    persist(columns, newRows, adjustedMask);
  }, [rows, columns, state.maskedRows, persist]);

  const deleteRow = useCallback((index: number) => {
    if (rows.length <= 1) return;
    const newRows = rows.filter((_, i) => i !== index);
    const adjustedMask = (state.maskedRows ?? []).filter(m => m !== index).map(m => m > index ? m - 1 : m);
    persist(columns, newRows, adjustedMask);
  }, [rows, columns, state.maskedRows, persist]);

  // ── 列操作 ──
  const addColumn = useCallback((afterIndex?: number) => {
    const idx = afterIndex !== undefined ? afterIndex + 1 : columns.length;
    const newCol: ColumnDef = {
      id: `col_${Date.now()}`,
      name: getColumnLetter(idx),
      role: 'none',
    };
    const newCols = [...columns.slice(0, idx), newCol, ...columns.slice(idx)];
    const renamedCols = newCols.map((c, i) => ({ ...c, name: c.longName ? c.name : getColumnLetter(i) }));
    const newRows = rows.map(r => [...r.slice(0, idx), '', ...r.slice(idx)]);
    persist(renamedCols, newRows);
  }, [columns, rows, persist]);

  const deleteColumn = useCallback((index: number) => {
    if (columns.length <= 1) return;
    const newCols = columns.filter((_, i) => i !== index).map((c, i) => ({ ...c, name: c.longName ? c.name : getColumnLetter(i) }));
    const newRows = rows.map(r => r.filter((_, i) => i !== index));
    persist(newCols, newRows);
  }, [columns, rows, persist]);

  // ── 列角色 ──
  const setColumnRole = useCallback((colIndex: number, role: ColumnRole) => {
    const newCols = columns.map((c, i) => i === colIndex ? { ...c, role } : c);
    persist(newCols, rows);
  }, [columns, rows, persist]);

  // ── 列元数据更新 ──
  const setColumnMeta = useCallback((colIndex: number, updates: Partial<Pick<ColumnDef, 'longName' | 'unit' | 'displayFormat' | 'precision'>>) => {
    const newCols = columns.map((c, i) => i === colIndex ? { ...c, ...updates } : c);
    persist(newCols, rows);
  }, [columns, rows, persist]);

  // ── 数据掩码 ──
  const toggleMaskRow = useCallback((rowIndex: number) => {
    const current = new Set(state.maskedRows ?? []);
    if (current.has(rowIndex)) {
      current.delete(rowIndex);
    } else {
      current.add(rowIndex);
    }
    persist(columns, rows, Array.from(current));
  }, [columns, rows, state.maskedRows, persist]);

  // ── 排序 ──
  const sortByColumn = useCallback((colIndex: number, direction: 'asc' | 'desc') => {
    const sortedRows = [...rows].sort((a, b) => {
      const va = parseFloat(a[colIndex]);
      const vb = parseFloat(b[colIndex]);
      if (isNaN(va) && isNaN(vb)) return 0;
      if (isNaN(va)) return 1;
      if (isNaN(vb)) return -1;
      return direction === 'asc' ? va - vb : vb - va;
    });
    persist(columns, sortedRows, []);
  }, [columns, rows, persist]);

  // ── 多选区域 ──
  const handleCellClick = useCallback((row: number, col: number, shiftKey: boolean) => {
    if (shiftKey && selectedCell) {
      setSelection({
        startRow: Math.min(selectedCell.row, row),
        startCol: Math.min(selectedCell.col, col),
        endRow: Math.max(selectedCell.row, row),
        endCol: Math.max(selectedCell.col, col),
      });
    } else {
      setSelectedCell({ row, col });
      setSelection(null);
    }
    if (editingCell && (editingCell.row !== row || editingCell.col !== col)) {
      confirmEdit();
    }
  }, [selectedCell, editingCell, confirmEdit]);

  // ── 拖拽框选 ──
  const handleDragStart = useCallback((row: number, col: number) => {
    // 先完成可能存在的编辑
    if (editingCell && (editingCell.row !== row || editingCell.col !== col)) {
      confirmEdit();
    }
    isDraggingRef.current = true;
    dragOriginRef.current = { row, col };
    setSelectedCell({ row, col });
    setSelection(null);
  }, [editingCell, confirmEdit]);

  const handleDragMove = useCallback((row: number, col: number) => {
    if (!isDraggingRef.current || !dragOriginRef.current) return;
    const origin = dragOriginRef.current;
    // 只有移动超过起点才建立选区
    if (origin.row !== row || origin.col !== col) {
      setSelection({
        startRow: Math.min(origin.row, row),
        startCol: Math.min(origin.col, col),
        endRow: Math.max(origin.row, row),
        endCol: Math.max(origin.col, col),
      });
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    // dragOriginRef 保留，不清空
  }, []);

  // ── 选区统计 ──
  const selectionStats = useMemo(() => {
    // 统计区域：优先 selection，否则选中单元格所在的整列
    let values: number[] = [];
    if (selection) {
      for (let r = selection.startRow; r <= selection.endRow; r++) {
        for (let c = selection.startCol; c <= selection.endCol; c++) {
          const v = parseFloat(rows[r]?.[c] ?? '');
          if (!isNaN(v)) values.push(v);
        }
      }
    } else if (selectedCell) {
      for (let r = 0; r < rows.length; r++) {
        const v = parseFloat(rows[r]?.[selectedCell.col] ?? '');
        if (!isNaN(v)) values.push(v);
      }
    }
    if (values.length === 0) return null;
    const count = values.length;
    const sum = values.reduce((s, v) => s + v, 0);
    const mean = sum / count;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / count;
    const stddev = Math.sqrt(variance);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { count, sum, mean, stddev, min, max };
  }, [selection, selectedCell, rows]);

  // ── 粘贴支持 ──
  const handlePaste = useCallback((e: React.ClipboardEvent, startRow: number, startCol: number) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text.trim()) return;

    const pastedRows = text.split('\n').map(line =>
      line.split('\t').map(cell => cell.trim())
    ).filter(r => r.length > 0 && r.some(c => c !== ''));

    const neededRows = startRow + pastedRows.length;
    const neededCols = Math.max(...pastedRows.map(r => r.length)) + startCol;

    let newCols = [...columns];
    let newRows = rows.map(r => [...r]);

    while (newCols.length < neededCols) {
      const idx = newCols.length;
      newCols.push({ id: `col_${Date.now()}_${idx}`, name: getColumnLetter(idx), role: 'none' });
      newRows = newRows.map(r => [...r, '']);
    }

    while (newRows.length < neededRows) {
      newRows.push(Array(newCols.length).fill(''));
    }

    pastedRows.forEach((pRow, ri) => {
      pRow.forEach((val, ci) => {
        const targetRow = startRow + ri;
        const targetCol = startCol + ci;
        if (targetRow < newRows.length && targetCol < newCols.length) {
          newRows[targetRow][targetCol] = val;
        }
      });
    });

    persist(newCols, newRows);
  }, [columns, rows, persist]);

  // ── 复制选区到剪贴板 (Ctrl+C) ──
  const copySelection = useCallback((sel: SelectionRange | null, selCell: { row: number; col: number } | null) => {
    const s = sel ?? (selCell ? { startRow: selCell.row, startCol: selCell.col, endRow: selCell.row, endCol: selCell.col } : null);
    if (!s) return;
    const lines: string[] = [];
    for (let r = s.startRow; r <= s.endRow; r++) {
      const cells: string[] = [];
      for (let c = s.startCol; c <= s.endCol; c++) {
        cells.push(rows[r]?.[c] ?? '');
      }
      lines.push(cells.join('\t'));
    }
    navigator.clipboard?.writeText(lines.join('\n'));
  }, [rows]);

  // ── 清空选区 ──
  const clearSelection = useCallback((sel: SelectionRange) => {
    const newRows = rows.map((r, ri) =>
      ri >= sel.startRow && ri <= sel.endRow
        ? r.map((c, ci) => ci >= sel.startCol && ci <= sel.endCol ? '' : c)
        : [...r]
    );
    persist(columns, newRows);
  }, [rows, columns, persist]);

  // ── 向下填充（将选区第一行的值复制到整个选区） ──
  const fillDown = useCallback((sel: SelectionRange) => {
    const newRows = rows.map(r => [...r]);
    const srcRow = sel.startRow;
    for (let r = srcRow + 1; r <= sel.endRow; r++) {
      for (let c = sel.startCol; c <= sel.endCol; c++) {
        newRows[r][c] = newRows[srcRow][c];
      }
    }
    persist(columns, newRows);
  }, [rows, columns, persist]);

  // ── 等差填充（从起始值按步长填充选区） ──
  const fillSeries = useCallback((sel: SelectionRange, step: number = 1) => {
    const newRows = rows.map(r => [...r]);
    for (let c = sel.startCol; c <= sel.endCol; c++) {
      const startVal = parseFloat(newRows[sel.startRow][c]);
      if (isNaN(startVal)) continue;
      for (let r = sel.startRow + 1; r <= sel.endRow; r++) {
        newRows[r][c] = String(startVal + step * (r - sel.startRow));
      }
    }
    persist(columns, newRows);
  }, [rows, columns, persist]);

  // ── 转置选区 ──
  const transposeSelection = useCallback((sel: SelectionRange) => {
    const rowCount = sel.endRow - sel.startRow + 1;
    const colCount = sel.endCol - sel.startCol + 1;
    // 抽取选区数据
    const data: string[][] = [];
    for (let r = 0; r < rowCount; r++) {
      data.push([]);
      for (let c = 0; c < colCount; c++) {
        data[r].push(rows[sel.startRow + r]?.[sel.startCol + c] ?? '');
      }
    }
    // 转置
    const transposed: string[][] = [];
    for (let c = 0; c < colCount; c++) {
      transposed.push([]);
      for (let r = 0; r < rowCount; r++) {
        transposed[c].push(data[r][c]);
      }
    }
    // 写回 — 可能需要扩展行/列
    let newCols = [...columns];
    let newRows = rows.map(r => [...r]);
    const neededRows = sel.startRow + colCount;
    const neededCols = sel.startCol + rowCount;
    while (newRows.length < neededRows) newRows.push(Array(newCols.length).fill(''));
    while (newCols.length < neededCols) {
      const idx = newCols.length;
      newCols.push({ id: `col_${Date.now()}_${idx}`, name: getColumnLetter(idx), role: 'none' });
      newRows = newRows.map(r => [...r, '']);
    }
    // 清空原区域
    for (let r = sel.startRow; r <= sel.endRow && r < newRows.length; r++) {
      for (let c = sel.startCol; c <= sel.endCol && c < newCols.length; c++) {
        newRows[r][c] = '';
      }
    }
    // 写入转置
    for (let r = 0; r < transposed.length; r++) {
      for (let c = 0; c < transposed[r].length; c++) {
        newRows[sel.startRow + r][sel.startCol + c] = transposed[r][c];
      }
    }
    persist(newCols, newRows);
  }, [columns, rows, persist]);

  // ── 导出工作表为 CSV ──
  const exportCSV = useCallback(() => {
    const header = columns.map(c => c.longName || c.name).join(',');
    const body = rows.map(r => r.join(',')).join('\n');
    const csv = header + '\n' + body;
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spreadsheet_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [columns, rows]);

  // ── 从 DataSeries 填充工作表 ──
  const populateFromSeries = useCallback((seriesList: DataSeries[]) => {
    if (!seriesList || seriesList.length === 0) return;

    const hasError = seriesList.some(s => s.data.some(d => d.error && d.error !== 0));
    const colsPerSeries = hasError ? 2 : 1;
    const maxRows = Math.max(...seriesList.map(s => s.data.length), 10);

    const newCols: ColumnDef[] = [];
    newCols.push({ id: 'col_x', name: 'A', role: 'X' });

    seriesList.forEach((s, si) => {
      const yIdx = 1 + si * colsPerSeries;
      newCols.push({
        id: `col_y_${si}`,
        name: getColumnLetter(yIdx),
        role: 'Y',
        longName: s.name,
      });
      if (hasError) {
        newCols.push({
          id: `col_err_${si}`,
          name: getColumnLetter(yIdx + 1),
          role: 'yErr',
        });
      }
    });

    const newRows: string[][] = [];
    for (let r = 0; r < maxRows; r++) {
      const row: string[] = [];
      row.push(seriesList[0]?.data[r]?.name ?? '');
      seriesList.forEach((s) => {
        row.push(s.data[r]?.value !== undefined ? String(s.data[r].value) : '');
        if (hasError) {
          row.push(s.data[r]?.error !== undefined ? String(s.data[r].error) : '');
        }
      });
      newRows.push(row);
    }

    persist(newCols, newRows, []);
  }, [persist]);

  // ── 从文件直接导入到工作表 (复用共享解析工具) ──
  // 使用 ref 确保 async 回调中读取到最新状态（避免闭包旧值问题）
  const columnsRef = useRef(columns);
  const rowsRef = useRef(rows);
  const maskedRowsRef = useRef(maskedRows);
  columnsRef.current = columns;
  rowsRef.current = rows;
  maskedRowsRef.current = maskedRows;

  const importFromFile = useCallback(async (file: File) => {
    console.log('[importFromFile] 开始导入文件:', file.name);
    const { parseFileToSpreadsheet } = await import('../utils/parseFileToSpreadsheet');
    const result = await parseFileToSpreadsheet(file);

    // 提取文件名（去掉扩展名）作为列标识
    const baseName = file.name.replace(/\.[^.]+$/, '');

    // 给导入的列加上文件名前缀
    const taggedColumns = result.columns.map(c => ({
      ...c,
      longName: c.longName ? `[${baseName}] ${c.longName}` : `[${baseName}] ${c.name}`,
    }));

    // 使用 ref 读取最新值
    const currentRows = rowsRef.current;
    const currentColumns = columnsRef.current;
    const currentMasked = maskedRowsRef.current;

    // 检测当前表格是否有有效数据（非全空）
    const hasData = currentRows.some(r => r.some(cell => cell.trim() !== ''));

    if (!hasData) {
      // 空表格 → 直接填入（带文件名标签）
      persist(taggedColumns, result.rows, result.maskedRows);
    } else {
      // 已有数据 → 追加新列到右侧
      const existingColCount = currentColumns.length;
      const newCols = taggedColumns.map((c, ci) => ({
        ...c,
        id: `col_append_${Date.now()}_${ci}`,
        name: getColumnLetter(existingColCount + ci),
      }));
      const mergedColumns = [...currentColumns, ...newCols];

      // 对齐行数并拼接
      const maxRowCount = Math.max(currentRows.length, result.rows.length);
      const mergedRows: string[][] = [];
      for (let ri = 0; ri < maxRowCount; ri++) {
        const existingRow = currentRows[ri] || new Array(existingColCount).fill('');
        const paddedExisting = existingRow.length < existingColCount
          ? [...existingRow, ...new Array(existingColCount - existingRow.length).fill('')]
          : existingRow;
        const newRow = result.rows[ri] || new Array(result.columns.length).fill('');
        mergedRows.push([...paddedExisting, ...newRow]);
      }
      persist(mergedColumns, mergedRows, Array.from(currentMasked));
    }
  }, [persist]);

  // 辅助: 从 XLSX 解析的二维数组构建工作表
  const applyParsedData = useCallback((rawData: any[][]) => {
    if (!rawData || rawData.length === 0) return;

    // 同样用智能检测: 跳过非数据行
    let startIdx = 0;
    const isNumRow = (row: any[]) => {
      const nonEmpty = row.filter(v => v !== '' && v !== undefined && v !== null);
      return nonEmpty.length >= 2 && nonEmpty.every(v => !isNaN(Number(v)));
    };

    // 找连续数字行
    for (let i = 0; i < rawData.length - 1; i++) {
      if (isNumRow(rawData[i]) && isNumRow(rawData[i + 1])) {
        startIdx = i;
        break;
      }
    }

    // 检测表头 (startIdx 前一非空行)
    let headerRow: any[] = [];
    for (let i = startIdx - 1; i >= 0; i--) {
      const row = rawData[i];
      const nonEmpty = row.filter((v: any) => v !== '' && v !== undefined && v !== null);
      if (nonEmpty.length >= 2 && nonEmpty.some((v: any) => typeof v === 'string' && isNaN(Number(v)))) {
        headerRow = row;
        break;
      }
    }

    const dataRows = rawData.slice(startIdx).filter(row => isNumRow(row));
    if (dataRows.length === 0) {
      // fallback: 导入全部
      const colCount = Math.max(...rawData.map(r => r.length), 1);
      const cols: ColumnDef[] = [];
      for (let ci = 0; ci < colCount; ci++) {
        cols.push({ id: `col_imp_${ci}`, name: getColumnLetter(ci), role: ci === 0 ? 'X' : 'Y' });
      }
      const rows = rawData.map(row => {
        const r: string[] = [];
        for (let ci = 0; ci < colCount; ci++) { r.push(row[ci] != null ? String(row[ci]) : ''); }
        return r;
      });
      while (rows.length < 10) rows.push(new Array(colCount).fill(''));
      persist(cols, rows, []);
      return;
    }

    const colCount = Math.max(...dataRows.slice(0, 5).map(r => r.length), headerRow.length, 2);
    const newCols: ColumnDef[] = [];
    for (let ci = 0; ci < colCount; ci++) {
      const raw = headerRow[ci] != null ? String(headerRow[ci]) : '';
      let longName = raw;
      let unit = '';
      const unitMatch = raw.match(/^(.+?)\s*[/（(]\s*(.+?)\s*[)）]?$/);
      if (unitMatch) { longName = unitMatch[1].trim(); unit = unitMatch[2].trim(); }
      newCols.push({
        id: `col_imp_${ci}`, name: getColumnLetter(ci),
        role: ci === 0 ? 'X' : 'Y',
        longName: longName || undefined, unit: unit || undefined,
      });
    }

    const newRows = dataRows.map(row => {
      const r: string[] = [];
      for (let ci = 0; ci < colCount; ci++) { r.push(row[ci] != null ? String(row[ci]) : ''); }
      return r;
    });
    while (newRows.length < 10) newRows.push(new Array(colCount).fill(''));
    persist(newCols, newRows, []);
  }, [persist]);

  // ── 工作表 → DataSeries 同步 ──
  const derivedSeries = useMemo((): DataSeries[] => {
    const xColIndex = columns.findIndex(c => c.role === 'X');
    if (xColIndex === -1) return [];

    const yColumns = columns.map((c, i) => ({ col: c, index: i })).filter(({ col }) => col.role === 'Y');
    const errColumns = columns.map((c, i) => ({ col: c, index: i })).filter(({ col }) => col.role === 'yErr');

    return yColumns.map(({ col, index: yIdx }, si) => {
      const matchingErr = errColumns.find(e => e.index === yIdx + 1) ?? errColumns[si];

      const data: ChartDataPoint[] = [];
      rows.forEach((row, ri) => {
        // 跳过被屏蔽的行
        if (maskedRows.has(ri)) return;
        const xStr = row[xColIndex];
        const yStr = row[yIdx];
        if (xStr === '' && yStr === '') return;
        const xVal = parseFloat(xStr);
        const yVal = parseFloat(yStr);
        if (isNaN(xVal) || isNaN(yVal)) return;

        const errVal = matchingErr ? parseFloat(row[matchingErr.index]) : 0;
        data.push({
          name: xStr,
          value: yVal,
          error: isNaN(errVal) ? 0 : errVal,
        });
      });

      const color = seriesColors[si % seriesColors.length];

      return {
        id: `sheet_series_${si}`,
        name: col.longName || col.name,
        data,
        color,
        pointColor: color,
        strokeWidth: 2,
        visible: true,
        pointShape: 'circle' as const,
        pointSize: 5,
        showErrorBar: !!matchingErr,
        errorBarType: 'both' as const,
      };
    });
  }, [columns, rows, maskedRows, seriesColors]);

  // 同步到图表
  const prevDerivedRef = useRef<string>('');
  useEffect(() => {
    const serialized = JSON.stringify(derivedSeries.map(s => ({ id: s.id, data: s.data })));
    if (serialized !== prevDerivedRef.current && derivedSeries.length > 0) {
      prevDerivedRef.current = serialized;
      setSeriesList(derivedSeries);
    }
  }, [derivedSeries, setSeriesList]);

  // ── 键盘导航 ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Undo/Redo 快捷键
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
      return;
    }
    // Ctrl+C 复制选区
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      copySelection(selection, selectedCell);
      return;
    }
    // Ctrl+A 全选
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      setSelection({ startRow: 0, startCol: 0, endRow: rows.length - 1, endCol: columns.length - 1 });
      return;
    }
    // Ctrl+D 向下填充
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      if (selection) fillDown(selection);
      return;
    }

    if (editingCell) {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmEdit();
        setSelectedCell({ row: Math.min(editingCell.row + 1, rows.length - 1), col: editingCell.col });
      } else if (e.key === 'Tab') {
        e.preventDefault();
        confirmEdit();
        setSelectedCell({ row: editingCell.row, col: Math.min(editingCell.col + 1, columns.length - 1) });
      } else if (e.key === 'Escape') {
        cancelEdit();
      }
      return;
    }

    if (!selectedCell) return;

    const { row, col } = selectedCell;
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (e.shiftKey) {
          const sr = selection ?? { startRow: row, startCol: col, endRow: row, endCol: col };
          setSelection({ ...sr, endRow: Math.max(sr.endRow - 1, 0) });
        } else {
          setSelectedCell({ row: Math.max(row - 1, 0), col });
          setSelection(null);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (e.shiftKey) {
          const sr = selection ?? { startRow: row, startCol: col, endRow: row, endCol: col };
          setSelection({ ...sr, endRow: Math.min(sr.endRow + 1, rows.length - 1) });
        } else {
          setSelectedCell({ row: Math.min(row + 1, rows.length - 1), col });
          setSelection(null);
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        setSelectedCell({ row, col: Math.max(col - 1, 0) });
        setSelection(null);
        break;
      case 'ArrowRight':
        e.preventDefault();
        setSelectedCell({ row, col: Math.min(col + 1, columns.length - 1) });
        setSelection(null);
        break;
      case 'Enter':
        e.preventDefault();
        startEditing(row, col);
        break;
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        if (selection) {
          // 清空选区
          const newRows = rows.map((r, ri) =>
            ri >= selection.startRow && ri <= selection.endRow
              ? r.map((c, ci) => ci >= selection.startCol && ci <= selection.endCol ? '' : c)
              : [...r]
          );
          persist(columns, newRows);
        } else {
          setCellValue(row, col, '');
        }
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          startEditing(row, col);
          setEditValue(e.key);
        }
    }
  }, [editingCell, selectedCell, selection, rows.length, columns.length, confirmEdit, cancelEdit, startEditing, setCellValue, undo, redo, rows, columns, persist, copySelection, fillDown, setSelection]);

  return {
    columns, rows, maskedRows,
    selectedCell, editingCell, editValue, contextMenu, selection, derivedSeries,
    selectionStats, canUndo, canRedo,

    setSelectedCell, setEditingCell, setEditValue, setContextMenu, setSelection,
    setCellValue, startEditing, confirmEdit, cancelEdit,
    addRow, deleteRow, addColumn, deleteColumn,
    setColumnRole, setColumnMeta, toggleMaskRow, sortByColumn,
    handlePaste, handleKeyDown, handleCellClick,
    populateFromSeries, importFromFile, undo, redo,
    copySelection, clearSelection, fillDown, fillSeries,
    transposeSelection, exportCSV,
    // 拖拽框选
    handleDragStart, handleDragMove, handleDragEnd,
  };
};
