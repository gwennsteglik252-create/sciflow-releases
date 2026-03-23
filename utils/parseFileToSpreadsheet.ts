/**
 * 智能解析文件为工作表数据（独立工具函数）
 * 支持 CSV / Excel / CHI / GAMRY 等科学仪器数据格式
 * 自动跳过元数据头，检测表头和数据起始行
 */
import { ColumnDef, SpreadsheetState, getColumnLetter } from '../types/spreadsheet';

export async function parseFileToSpreadsheet(file: File): Promise<SpreadsheetState> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  // Excel 文件走 XLSX 解析
  if (['xlsx', 'xls'].includes(ext)) {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    return buildFromArray(rawData);
  }

  // 文本文件：智能识别科学仪器数据
  const text = await file.text();
  const lines = text.split(/\r?\n/);

  const detectSeparator = (sampleLines: string[]): string => {
    const tabCount = sampleLines.filter(l => l.includes('\t')).length;
    const commaCount = sampleLines.filter(l => l.includes(',')).length;
    if (tabCount > commaCount) return '\t';
    if (commaCount > 0) return ',';
    return /\s{2,}/.test(sampleLines.join('\n')) ? '\\s+' : ',';
  };

  const isNumericRow = (line: string, sep: string): boolean => {
    const parts = sep === '\\s+'
      ? line.trim().split(/\s+/)
      : line.split(sep).map(s => s.trim());
    if (parts.length < 2) return false;
    return parts.every(p => p === '' || !isNaN(Number(p)));
  };

  const sep = detectSeparator(lines.slice(0, 50));
  let dataStartIdx = -1;
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].trim() === '') continue;
    if (isNumericRow(lines[i], sep) && isNumericRow(lines[i + 1], sep)) {
      dataStartIdx = i;
      break;
    }
  }

  if (dataStartIdx === -1) {
    // fallback to XLSX
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    return buildFromArray(rawData);
  }

  // 检测表头行
  let headerIdx = -1;
  for (let i = dataStartIdx - 1; i >= 0; i--) {
    if (lines[i].trim() !== '') {
      const candidate = lines[i].trim();
      if (!candidate.includes('=') && !candidate.endsWith(':') && /[a-zA-Z]/.test(candidate)) {
        headerIdx = i;
      }
      break;
    }
  }

  const splitLine = (line: string) => {
    if (sep === '\\s+') return line.trim().split(/\s+/);
    return line.split(sep).map(s => s.trim());
  };

  const headerParts = headerIdx >= 0 ? splitLine(lines[headerIdx]) : [];
  const dataLines = lines.slice(dataStartIdx).filter(l => {
    const t = l.trim();
    return t !== '' && isNumericRow(t, sep);
  });

  if (dataLines.length === 0) {
    return { columns: [{ id: 'col_0', name: 'A', role: 'X' }, { id: 'col_1', name: 'B', role: 'Y' }], rows: Array(10).fill(['', '']), maskedRows: [] };
  }

  const colCount = Math.max(...dataLines.slice(0, 5).map(l => splitLine(l).length), headerParts.length, 2);

  const newCols: ColumnDef[] = [];
  for (let ci = 0; ci < colCount; ci++) {
    const raw = headerParts[ci] ?? '';
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

  const newRows = dataLines.map(line => {
    const parts = splitLine(line);
    const r: string[] = [];
    for (let ci = 0; ci < colCount; ci++) r.push(parts[ci] ?? '');
    return r;
  });

  while (newRows.length < 10) newRows.push(new Array(colCount).fill(''));

  return { columns: newCols, rows: newRows, maskedRows: [] };
}

/** 从二维数组智能构建 SpreadsheetState */
function buildFromArray(rawData: any[][]): SpreadsheetState {
  if (!rawData || rawData.length === 0) {
    return { columns: [{ id: 'col_0', name: 'A', role: 'X' }, { id: 'col_1', name: 'B', role: 'Y' }], rows: Array(10).fill(['', '']), maskedRows: [] };
  }

  const isNumRow = (row: any[]) => {
    const nonEmpty = row.filter(v => v !== '' && v !== undefined && v !== null);
    return nonEmpty.length >= 2 && nonEmpty.every(v => !isNaN(Number(v)));
  };

  let startIdx = 0;
  for (let i = 0; i < rawData.length - 1; i++) {
    if (isNumRow(rawData[i]) && isNumRow(rawData[i + 1])) {
      startIdx = i;
      break;
    }
  }

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
    // fallback: import everything
    const colCount = Math.max(...rawData.map(r => r.length), 1);
    const cols: ColumnDef[] = [];
    for (let ci = 0; ci < colCount; ci++) {
      cols.push({ id: `col_imp_${ci}`, name: getColumnLetter(ci), role: ci === 0 ? 'X' : 'Y' });
    }
    const rows = rawData.map(row => {
      const r: string[] = [];
      for (let ci = 0; ci < colCount; ci++) r.push(row[ci] != null ? String(row[ci]) : '');
      return r;
    });
    while (rows.length < 10) rows.push(new Array(colCount).fill(''));
    return { columns: cols, rows, maskedRows: [] };
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
    for (let ci = 0; ci < colCount; ci++) r.push(row[ci] != null ? String(row[ci]) : '');
    return r;
  });
  while (newRows.length < 10) newRows.push(new Array(colCount).fill(''));
  return { columns: newCols, rows: newRows, maskedRows: [] };
}
