// ─────────────────────────────────────────────
// Spreadsheet / Data Worksheet Types
// ─────────────────────────────────────────────

/** 列角色：决定此列在图表中的映射 */
export type ColumnRole = 'X' | 'Y' | 'yErr' | 'Label' | 'none';

/** 数值显示格式 */
export type DisplayFormat = 'auto' | 'scientific' | 'fixed';

/** 列定义 */
export interface ColumnDef {
  id: string;
  /** 显示名称，默认 A / B / C ... */
  name: string;
  /** 列在图表中扮演的角色 */
  role: ColumnRole;
  /** 列公式，如 "col(A) * 2 + 1" */
  formula?: string;
  /** 长名称（科学标签），如 "Potential" */
  longName?: string;
  /** 单位，如 "V" 或 "mA cm⁻²" */
  unit?: string;
  /** 数值显示格式 */
  displayFormat?: DisplayFormat;
  /** 小数位数精度（0-10） */
  precision?: number;
}

/** 选区范围 */
export interface SelectionRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

/** 工作表持久化状态（保存到 DataAnalysisSession） */
export interface SpreadsheetState {
  columns: ColumnDef[];
  /** 二维数组：rows[rowIndex][colIndex] */
  rows: string[][];
  /** 被屏蔽（masked）的行索引集合 */
  maskedRows?: number[];
}

/** 生成列字母标签（A, B, C, ..., Z, AA, AB, ...） */
export const getColumnLetter = (index: number): string => {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
};

/** 创建默认空工作表 */
export const createDefaultSpreadsheet = (cols = 3, rows = 10): SpreadsheetState => ({
  columns: Array.from({ length: cols }, (_, i) => ({
    id: `col_${i}`,
    name: getColumnLetter(i),
    role: i === 0 ? 'X' as ColumnRole : i === 1 ? 'Y' as ColumnRole : 'none' as ColumnRole,
  })),
  rows: Array.from({ length: rows }, () => Array(cols).fill('')),
  maskedRows: [],
});

/** 格式化数值 */
export const formatCellValue = (value: string, format?: DisplayFormat, precision?: number): string => {
  const num = parseFloat(value);
  if (isNaN(num) || value.trim() === '') return value;
  const p = precision ?? 6;
  switch (format) {
    case 'scientific':
      return num.toExponential(p);
    case 'fixed':
      return num.toFixed(p);
    default: // auto
      return value;
  }
};
