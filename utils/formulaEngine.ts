// ─────────────────────────────────────────────
// Formula Engine — lightweight expression evaluator
// ─────────────────────────────────────────────

/**
 * 解析并执行列公式，如 `col(A) * 2 + 1` 或 `sin(col(B))`
 *
 * 支持的语法:
 * - 列引用: col(A) 返回数值数组
 * - 数学函数: sin, cos, tan, exp, log, log10, sqrt, abs, pow
 * - 常量: PI, E
 * - 运算符: +, -, *, /, %, **
 * - 聚合函数: sum(col(A)), mean(col(A)), max(col(A)), min(col(A)), count(col(A))
 */

/** 列数据映射表: 列字母 → 数值数组 */
export type ColumnDataMap = Record<string, number[]>;

/** 公式计算结果 */
export interface FormulaResult {
  values: number[];
  error?: string;
}

/** 内置数学环境 */
const MATH_ENV: Record<string, any> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  exp: Math.exp,
  log: Math.log,
  log10: Math.log10,
  log2: Math.log2,
  sqrt: Math.sqrt,
  abs: Math.abs,
  pow: Math.pow,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  PI: Math.PI,
  E: Math.E,
};

/** 聚合函数 */
const AGGREGATE_FNS: Record<string, (arr: number[]) => number> = {
  sum: (a) => a.reduce((s, v) => s + v, 0),
  mean: (a) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0,
  avg: (a) => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0,
  max: (a) => Math.max(...a),
  min: (a) => Math.min(...a),
  count: (a) => a.length,
  stdev: (a) => {
    const m = a.reduce((s, v) => s + v, 0) / a.length;
    return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
  },
};

/**
 * 计算公式
 * @param formula  公式字符串，如 "col(A) * 2 + sin(col(B))"
 * @param colData  列数据映射 { A: [1,2,3], B: [4,5,6] }
 * @param rowCount 最大行数
 */
export const evaluateFormula = (
  formula: string,
  colData: ColumnDataMap,
  rowCount: number
): FormulaResult => {
  try {
    if (!formula.trim()) return { values: [], error: undefined };

    // 检测引用的列是否存在
    const colRefs = new Set<string>();
    const colRefRegex = /col\(([A-Z]+)\)/gi;
    let match: RegExpExecArray | null;
    while ((match = colRefRegex.exec(formula)) !== null) {
      colRefs.add(match[1].toUpperCase());
    }

    for (const ref of colRefs) {
      if (!(ref in colData)) {
        return { values: [], error: `#REF! 列 ${ref} 不存在` };
      }
    }

    // 检查是否使用了聚合函数（结果是标量，广播到所有行）
    const hasAggregate = Object.keys(AGGREGATE_FNS).some(fn =>
      new RegExp(`\\b${fn}\\s*\\(`, 'i').test(formula)
    );

    if (hasAggregate) {
      // 先替换聚合函数调用
      let processedFormula = formula;
      for (const [fnName, fnImpl] of Object.entries(AGGREGATE_FNS)) {
        const aggRegex = new RegExp(`${fnName}\\s*\\(\\s*col\\(([A-Z]+)\\)\\s*\\)`, 'gi');
        processedFormula = processedFormula.replace(aggRegex, (_match, colName) => {
          const data = colData[colName.toUpperCase()] || [];
          const result = fnImpl(data.filter(v => !isNaN(v)));
          return String(result);
        });
      }

      // 替换剩余的 col() 引用，逐元素计算
      return evaluateElementWise(processedFormula, colData, rowCount);
    }

    return evaluateElementWise(formula, colData, rowCount);
  } catch (err: any) {
    return { values: [], error: `#ERR! ${err.message || '计算错误'}` };
  }
};

/** 逐元素计算公式 */
const evaluateElementWise = (
  formula: string,
  colData: ColumnDataMap,
  rowCount: number
): FormulaResult => {
  const values: number[] = [];

  for (let i = 0; i < rowCount; i++) {
    try {
      // 替换 col(X) 为当前行的值
      let expr = formula.replace(/col\(([A-Z]+)\)/gi, (_m, colName) => {
        const data = colData[colName.toUpperCase()];
        if (!data) return 'NaN';
        const val = data[i];
        return val !== undefined && !isNaN(val) ? String(val) : 'NaN';
      });

      // 构建安全执行环境
      const fnBody = `"use strict"; const {${Object.keys(MATH_ENV).join(',')}} = __env; return (${expr});`;
      const fn = new Function('__env', fnBody);
      const result = fn(MATH_ENV);

      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        values.push(result);
      } else {
        values.push(NaN);
      }
    } catch {
      values.push(NaN);
    }
  }

  // 检查是否全是 NaN
  if (values.every(v => isNaN(v))) {
    return { values, error: '#ERR! 公式无法计算' };
  }

  return { values };
};

/**
 * 解析公式中的列依赖关系（用于拓扑排序）
 */
export const getFormulaDependencies = (formula: string): string[] => {
  const deps: string[] = [];
  const regex = /col\(([A-Z]+)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(formula)) !== null) {
    const col = match[1].toUpperCase();
    if (!deps.includes(col)) deps.push(col);
  }
  return deps;
};

/**
 * 对列公式进行拓扑排序，确保依赖列先计算
 * @param columns 列名→公式 映射
 * @returns 排序后的列名数组，如果有循环依赖则返回 null
 */
export const topologicalSort = (
  columns: { name: string; formula?: string }[]
): string[] | null => {
  const graph: Record<string, string[]> = {};
  const formulaCols = new Set<string>();

  columns.forEach(c => {
    if (c.formula?.trim()) {
      formulaCols.add(c.name);
      graph[c.name] = getFormulaDependencies(c.formula);
    }
  });

  // Kahn's algorithm
  const inDegree: Record<string, number> = {};
  formulaCols.forEach(c => { inDegree[c] = 0; });

  formulaCols.forEach(c => {
    (graph[c] || []).forEach(dep => {
      if (formulaCols.has(dep)) {
        inDegree[c] = (inDegree[c] || 0) + 1;
      }
    });
  });

  const queue = Object.entries(inDegree).filter(([_, d]) => d === 0).map(([c]) => c);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);

    formulaCols.forEach(c => {
      if ((graph[c] || []).includes(node)) {
        inDegree[c]--;
        if (inDegree[c] === 0) {
          queue.push(c);
        }
      }
    });
  }

  return sorted.length === formulaCols.size ? sorted : null;
};
