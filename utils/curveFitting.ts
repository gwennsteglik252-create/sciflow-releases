// ─────────────────────────────────────────────
// Curve Fitting Engine — 通用曲线拟合（高级版）
// 支持：加权拟合 / 参数标准误差 & 置信区间 / AIC·BIC /
//       分段拟合 / 全局拟合（多数据集共享参数）
// ─────────────────────────────────────────────

export interface DataPoint {
  x: number;
  y: number;
}

/** 拟合参数 */
export interface FitParameter {
  name: string;
  value: number;
  /** 初始猜测 */
  initial: number;
  /** 标准误差 (SE) */
  error?: number;
  /** 95% 置信区间下界 */
  confidenceLower?: number;
  /** 95% 置信区间上界 */
  confidenceUpper?: number;
  /** 参数下界 */
  lowerBound?: number;
  /** 参数上界 */
  upperBound?: number;
}

/** 拟合结果 */
export interface FitResult {
  params: FitParameter[];
  /** 决定系数 R² */
  rSquared: number;
  /** 卡方值 χ² */
  chiSquared: number;
  /** 约化卡方 χ²/ν */
  reducedChiSquared: number;
  /** 残差均方根 RMSE */
  rmse: number;
  /** 拟合曲线数据点（用于绘图） */
  fittedCurve: DataPoint[];
  /** 残差 */
  residuals: DataPoint[];
  /** 模型名称 */
  modelName: string;
  /** 公式文本 */
  formulaText: string;
  /** 收敛状态 */
  converged: boolean;
  /** 迭代次数 */
  iterations: number;
  /** 自由度 ν = n - p */
  degreesOfFreedom: number;
  /** 赤池信息准则 */
  aic: number;
  /** 贝叶斯信息准则 */
  bic: number;
}

/** 拟合模型定义 */
export interface FitModel {
  id: string;
  name: string;
  /** 公式 LaTeX 文本 */
  formula: string;
  /** 参数名数组 */
  paramNames: string[];
  /** 模型函数 f(x, params) */
  fn: (x: number, params: number[]) => number;
  /** 参数初始值猜测器 */
  guessInitial: (data: DataPoint[]) => number[];
}

/** 加权方案枚举 */
export type WeightScheme = 'uniform' | 'inverse_y2' | 'inverse_sigma2' | 'custom';

/** 分段拟合配置 */
export interface PiecewiseSegment {
  xStart: number;
  xEnd: number;
  model: FitModel;
}

/** 分段拟合结果 */
export interface PiecewiseFitResult {
  segmentResults: FitResult[];
  combinedCurve: DataPoint[];
  breakpoints: number[];
}

/** 全局拟合配置 */
export interface GlobalFitConfig {
  datasets: DataPoint[][];
  model: FitModel;
  /** 哪些参数索引在数据集间共享 */
  sharedParamIndices: number[];
  weights?: number[][];
}

/** 全局拟合结果 */
export interface GlobalFitResult {
  /** 共享参数值 */
  sharedParams: FitParameter[];
  /** 每个数据集的独立参数 */
  datasetParams: FitParameter[][];
  /** 每个数据集的拟合曲线 */
  fittedCurves: DataPoint[][];
  /** 全局 R² */
  globalRSquared: number;
  globalAic: number;
  globalBic: number;
  converged: boolean;
  iterations: number;
}

// ════════════════════════════════════════════════
//  内置拟合模型
// ════════════════════════════════════════════════

export const BUILT_IN_MODELS: FitModel[] = [
  {
    id: 'linear',
    name: '线性 (Linear)',
    formula: 'y = a·x + b',
    paramNames: ['a', 'b'],
    fn: (x, [a, b]) => a * x + b,
    guessInitial: (data) => {
      if (data.length < 2) return [1, 0];
      const n = data.length;
      const sx = data.reduce((s, p) => s + p.x, 0);
      const sy = data.reduce((s, p) => s + p.y, 0);
      const sxy = data.reduce((s, p) => s + p.x * p.y, 0);
      const sx2 = data.reduce((s, p) => s + p.x * p.x, 0);
      const a = (n * sxy - sx * sy) / (n * sx2 - sx * sx) || 1;
      const b = (sy - a * sx) / n;
      return [a, b];
    },
  },
  {
    id: 'polynomial2',
    name: '二次多项式',
    formula: 'y = a·x² + b·x + c',
    paramNames: ['a', 'b', 'c'],
    fn: (x, [a, b, c]) => a * x * x + b * x + c,
    guessInitial: () => [0.01, 1, 0],
  },
  {
    id: 'polynomial3',
    name: '三次多项式',
    formula: 'y = a·x³ + b·x² + c·x + d',
    paramNames: ['a', 'b', 'c', 'd'],
    fn: (x, [a, b, c, d]) => a * x ** 3 + b * x * x + c * x + d,
    guessInitial: () => [0.001, 0.01, 1, 0],
  },
  {
    id: 'exponential',
    name: '指数 (Exponential)',
    formula: 'y = a·exp(b·x)',
    paramNames: ['a', 'b'],
    fn: (x, [a, b]) => a * Math.exp(b * x),
    guessInitial: (data) => {
      const y0 = data[0]?.y || 1;
      const yN = data[data.length - 1]?.y || 2;
      const x0 = data[0]?.x || 0;
      const xN = data[data.length - 1]?.x || 1;
      const b = Math.log(Math.abs(yN / y0) || 1) / (xN - x0 || 1);
      return [Math.abs(y0) || 1, b || 0.1];
    },
  },
  {
    id: 'exp_decay',
    name: '指数衰减',
    formula: 'y = a·exp(-x/τ) + c',
    paramNames: ['a', 'τ', 'c'],
    fn: (x, [a, tau, c]) => a * Math.exp(-x / tau) + c,
    guessInitial: (data) => {
      const yMax = Math.max(...data.map(d => d.y));
      const yMin = Math.min(...data.map(d => d.y));
      const xRange = data[data.length - 1]?.x - data[0]?.x || 1;
      return [yMax - yMin, xRange / 3, yMin];
    },
  },
  {
    id: 'gaussian',
    name: '高斯 (Gaussian)',
    formula: 'y = a·exp(-(x-μ)²/(2σ²))',
    paramNames: ['a', 'μ', 'σ'],
    fn: (x, [a, mu, sigma]) => a * Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)),
    guessInitial: (data) => {
      const yMax = Math.max(...data.map(d => d.y));
      const peakIdx = data.findIndex(d => d.y === yMax);
      const mu = data[peakIdx]?.x || 0;
      const halfMax = yMax / 2;
      let fwhm = 1;
      for (let i = peakIdx; i < data.length; i++) {
        if (data[i].y < halfMax) { fwhm = (data[i].x - mu) * 2; break; }
      }
      return [yMax, mu, fwhm / 2.355 || 1];
    },
  },
  {
    id: 'lorentzian',
    name: '洛伦兹 (Lorentzian)',
    formula: 'y = a / (1 + ((x-x₀)/γ)²)',
    paramNames: ['a', 'x₀', 'γ'],
    fn: (x, [a, x0, gamma]) => a / (1 + ((x - x0) / gamma) ** 2),
    guessInitial: (data) => {
      const yMax = Math.max(...data.map(d => d.y));
      const peakIdx = data.findIndex(d => d.y === yMax);
      const x0 = data[peakIdx]?.x || 0;
      return [yMax, x0, 1];
    },
  },
  {
    id: 'voigt',
    name: 'Voigt (伪Voigt近似)',
    formula: 'y = η·L(x) + (1-η)·G(x)',
    paramNames: ['a', 'x₀', 'σ', 'γ', 'η'],
    fn: (x, [a, x0, sigma, gamma, eta]) => {
      const gauss = Math.exp(-((x - x0) ** 2) / (2 * sigma * sigma));
      const lorentz = 1 / (1 + ((x - x0) / gamma) ** 2);
      return a * (eta * lorentz + (1 - eta) * gauss);
    },
    guessInitial: (data) => {
      const yMax = Math.max(...data.map(d => d.y));
      const peakIdx = data.findIndex(d => d.y === yMax);
      return [yMax, data[peakIdx]?.x || 0, 1, 1, 0.5];
    },
  },
  {
    id: 'power',
    name: '幂函数 (Power)',
    formula: 'y = a·x^b',
    paramNames: ['a', 'b'],
    fn: (x, [a, b]) => a * Math.pow(Math.abs(x) || 1e-10, b),
    guessInitial: () => [1, 1],
  },
  {
    id: 'logarithmic',
    name: '对数 (Logarithmic)',
    formula: 'y = a·ln(x) + b',
    paramNames: ['a', 'b'],
    fn: (x, [a, b]) => a * Math.log(Math.abs(x) || 1e-10) + b,
    guessInitial: () => [1, 0],
  },
  {
    id: 'sigmoidal',
    name: 'Sigmoid / Logistic',
    formula: 'y = L / (1 + exp(-k·(x-x₀)))',
    paramNames: ['L', 'k', 'x₀'],
    fn: (x, [L, k, x0]) => L / (1 + Math.exp(-k * (x - x0))),
    guessInitial: (data) => {
      const yMax = Math.max(...data.map(d => d.y));
      const xMid = (data[0]?.x + data[data.length - 1]?.x) / 2 || 0;
      return [yMax, 1, xMid];
    },
  },
];

// ════════════════════════════════════════════════
//  t 分布临界值表 (双侧 95%, α/2 = 0.025)
// ════════════════════════════════════════════════

const T_CRITICAL_95: Record<number, number> = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
  6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
  15: 2.131, 20: 2.086, 25: 2.060, 30: 2.042, 40: 2.021,
  50: 2.009, 60: 2.000, 80: 1.990, 100: 1.984, 120: 1.980,
};

/** 查找最近的 t 临界值 */
const getTCritical = (dof: number): number => {
  if (dof <= 0) return 1.96;
  if (dof >= 120) return 1.96;
  const keys = Object.keys(T_CRITICAL_95).map(Number).sort((a, b) => a - b);
  let closest = keys[0];
  for (const k of keys) {
    if (Math.abs(k - dof) < Math.abs(closest - dof)) closest = k;
  }
  return T_CRITICAL_95[closest] || 1.96;
};

// ════════════════════════════════════════════════
//  生成权重数组
// ════════════════════════════════════════════════

export const generateWeights = (
  data: DataPoint[],
  scheme: WeightScheme,
  customWeights?: number[]
): number[] | undefined => {
  switch (scheme) {
    case 'uniform':
      return undefined; // LM 内部不加权
    case 'inverse_y2':
      return data.map(d => {
        const absY = Math.abs(d.y);
        return absY > 1e-15 ? 1 / (absY * absY) : 1;
      });
    case 'inverse_sigma2':
      // 假设 σ ∝ sqrt(|y|)，即泊松统计
      return data.map(d => {
        const absY = Math.abs(d.y);
        return absY > 1e-15 ? 1 / absY : 1;
      });
    case 'custom':
      return customWeights;
    default:
      return undefined;
  }
};

// ════════════════════════════════════════════════
//  Levenberg-Marquardt 非线性最小二乘拟合（加权版）
// ════════════════════════════════════════════════

interface LMOptions {
  maxIterations?: number;
  tolerance?: number;
  lambdaInit?: number;
  lambdaUp?: number;
  lambdaDown?: number;
  epsilon?: number; // 数值微分步长
}

const DEFAULT_LM_OPTIONS: Required<LMOptions> = {
  maxIterations: 200,
  tolerance: 1e-8,
  lambdaInit: 0.001,
  lambdaUp: 10,
  lambdaDown: 0.1,
  epsilon: 1e-8,
};

interface LMResult {
  params: number[];
  converged: boolean;
  iterations: number;
  /** 协方差矩阵 (p×p) */
  covariance: number[][] | null;
}

/**
 * Levenberg-Marquardt 拟合（支持加权）
 */
const levenbergMarquardt = (
  data: DataPoint[],
  model: (x: number, params: number[]) => number,
  initialParams: number[],
  options?: LMOptions,
  bounds?: { lower?: number[]; upper?: number[] },
  weights?: number[]
): LMResult => {
  const opts = { ...DEFAULT_LM_OPTIONS, ...options };
  const n = data.length;
  const p = initialParams.length;
  let params = [...initialParams];
  let lambda = opts.lambdaInit;

  // 权重归一化
  const w = weights
    ? (() => {
        const wMax = Math.max(...weights.map(Math.abs));
        return wMax > 0 ? weights.map(v => v / wMax) : weights;
      })()
    : undefined;

  // 加权残差 r_i = sqrt(w_i) * (y_i - f(x_i, p))
  const residuals = (ps: number[]) =>
    data.map((d, i) => {
      const r = d.y - model(d.x, ps);
      return w ? Math.sqrt(Math.abs(w[i])) * r : r;
    });

  // 加权 Jacobian
  const jacobian = (ps: number[]): number[][] => {
    const J: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row: number[] = [];
      const sw = w ? Math.sqrt(Math.abs(w[i])) : 1;
      for (let j = 0; j < p; j++) {
        const ps_plus = [...ps];
        const h = Math.max(opts.epsilon, Math.abs(ps[j]) * opts.epsilon);
        ps_plus[j] += h;
        row.push(-sw * (model(data[i].x, ps_plus) - model(data[i].x, ps)) / h);
      }
      J.push(row);
    }
    return J;
  };

  // 计算 chi-squared
  const chiSq = (ps: number[]) => {
    const r = residuals(ps);
    return r.reduce((s, v) => s + v * v, 0);
  };

  let currentChi = chiSq(params);
  let converged = false;
  let iter = 0;
  let lastJ: number[][] | null = null;

  for (; iter < opts.maxIterations; iter++) {
    const r = residuals(params);
    const J = jacobian(params);
    lastJ = J;

    // J^T * J
    const JtJ: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
    const JtR: number[] = Array(p).fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < p; j++) {
        JtR[j] += J[i][j] * r[i];
        for (let k = 0; k < p; k++) {
          JtJ[j][k] += J[i][j] * J[i][k];
        }
      }
    }

    // (J^T J + λ·diag(J^T J)) · δ = J^T · r
    const A = JtJ.map((row, i) => row.map((v, j) => v + (i === j ? lambda * (v || 1) : 0)));
    const delta = solveSystem(A, JtR);

    if (!delta) {
      lambda *= opts.lambdaUp;
      continue;
    }

    const newParams = params.map((v, i) => {
      let nv = v + delta[i];
      // 应用参数约束 (box constraints)
      if (bounds?.lower && bounds.lower[i] !== undefined && isFinite(bounds.lower[i])) nv = Math.max(nv, bounds.lower[i]);
      if (bounds?.upper && bounds.upper[i] !== undefined && isFinite(bounds.upper[i])) nv = Math.min(nv, bounds.upper[i]);
      return nv;
    });
    const newChi = chiSq(newParams);

    if (isNaN(newChi) || !isFinite(newChi)) {
      lambda *= opts.lambdaUp;
      continue;
    }

    if (newChi < currentChi) {
      // 接受更新
      params = newParams;
      const improvement = (currentChi - newChi) / currentChi;
      currentChi = newChi;
      lambda *= opts.lambdaDown;

      if (improvement < opts.tolerance) {
        converged = true;
        break;
      }
    } else {
      lambda *= opts.lambdaUp;
    }
  }

  // ── 计算协方差矩阵 C = σ² · (J^T J)^{-1} ──
  let covariance: number[][] | null = null;
  if (lastJ && n > p) {
    const J = lastJ;
    const JtJ: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < p; j++) {
        for (let k = 0; k < p; k++) {
          JtJ[j][k] += J[i][j] * J[i][k];
        }
      }
    }
    const sigma2 = currentChi / (n - p);
    const invJtJ = invertMatrix(JtJ);
    if (invJtJ) {
      covariance = invJtJ.map(row => row.map(v => v * sigma2));
    }
  }

  return { params, converged: converged || iter >= opts.maxIterations, iterations: iter, covariance };
};

// ════════════════════════════════════════════════
//  AIC / BIC 计算
// ════════════════════════════════════════════════

const calcAIC = (n: number, k: number, rss: number): number => {
  if (n <= 0 || rss <= 0) return Infinity;
  const aic = n * Math.log(rss / n) + 2 * k;
  // 小样本修正 AICc
  if (n - k - 1 > 0) {
    return aic + (2 * k * (k + 1)) / (n - k - 1);
  }
  return aic;
};

const calcBIC = (n: number, k: number, rss: number): number => {
  if (n <= 0 || rss <= 0) return Infinity;
  return n * Math.log(rss / n) + k * Math.log(n);
};

// ════════════════════════════════════════════════
//  主拟合函数
// ════════════════════════════════════════════════

/**
 * 对数据执行曲线拟合
 * @param data       原始数据点
 * @param model      拟合模型
 * @param curvePoints 拟合曲线生成的点数（默认 200）
 * @param bounds     参数约束
 * @param weights    各点权重 (可选)
 */
export const fitCurve = (
  data: DataPoint[],
  model: FitModel,
  curvePoints: number = 200,
  bounds?: { lower?: number[]; upper?: number[] },
  weights?: number[]
): FitResult => {
  const p = model.paramNames.length;
  if (data.length < p) {
    return {
      params: model.paramNames.map((n) => ({ name: n, value: 0, initial: 0 })),
      rSquared: 0, chiSquared: 0, reducedChiSquared: 0, rmse: 0,
      fittedCurve: [], residuals: [],
      modelName: model.name, formulaText: model.formula,
      converged: false, iterations: 0,
      degreesOfFreedom: 0, aic: Infinity, bic: Infinity,
    };
  }

  const sorted = [...data].sort((a, b) => a.x - b.x);
  const initial = model.guessInitial(sorted);

  // 如果传了 weights，也按 x 排序对齐
  let sortedWeights: number[] | undefined;
  if (weights && weights.length === data.length) {
    const indices = data.map((_, i) => i).sort((a, b) => data[a].x - data[b].x);
    sortedWeights = indices.map(i => weights[i]);
  }

  const { params: fittedParams, converged, iterations, covariance } = levenbergMarquardt(
    sorted, model.fn, initial, undefined, bounds, sortedWeights
  );

  // 计算统计量
  const n = sorted.length;
  const yMean = sorted.reduce((s, d) => s + d.y, 0) / n;
  const ssTot = sorted.reduce((s, d) => s + (d.y - yMean) ** 2, 0);
  const residuals: DataPoint[] = sorted.map(d => ({
    x: d.x,
    y: d.y - model.fn(d.x, fittedParams),
  }));
  const ssRes = residuals.reduce((s, d) => s + d.y * d.y, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const dof = Math.max(n - p, 1);
  const reducedChiSquared = ssRes / dof;
  const rmse = Math.sqrt(ssRes / n);

  // AIC / BIC
  const aic = calcAIC(n, p, ssRes);
  const bic = calcBIC(n, p, ssRes);

  // 参数标准误差（协方差矩阵对角元素）
  const tCrit = getTCritical(dof);

  const paramResults: FitParameter[] = fittedParams.map((v, i) => {
    let se: number | undefined;
    let ciLower: number | undefined;
    let ciUpper: number | undefined;

    if (covariance && covariance[i] && covariance[i][i] >= 0) {
      se = Math.sqrt(covariance[i][i]);
      ciLower = v - tCrit * se;
      ciUpper = v + tCrit * se;
    }

    return {
      name: model.paramNames[i],
      value: v,
      initial: initial[i],
      error: se,
      confidenceLower: ciLower,
      confidenceUpper: ciUpper,
    };
  });

  // 生成拟合曲线
  const xMin = sorted[0].x;
  const xMax = sorted[sorted.length - 1].x;
  const xRange = xMax - xMin || 1;
  const fittedCurve: DataPoint[] = [];
  for (let i = 0; i <= curvePoints; i++) {
    const x = xMin + (i / curvePoints) * xRange;
    const y = model.fn(x, fittedParams);
    if (isFinite(y)) fittedCurve.push({ x, y });
  }

  return {
    params: paramResults,
    rSquared: Math.max(0, Math.min(1, rSquared)),
    chiSquared: ssRes,
    reducedChiSquared,
    rmse,
    fittedCurve,
    residuals,
    modelName: model.name,
    formulaText: model.formula,
    converged,
    iterations,
    degreesOfFreedom: dof,
    aic,
    bic,
  };
};

/**
 * 自定义公式拟合
 */
export const fitCustomFormula = (
  data: DataPoint[],
  formula: string,
  paramNames: string[],
  initialGuess: number[],
  curvePoints: number = 200,
  weights?: number[]
): FitResult => {
  // 构建模型函数
  const fnBody = `"use strict"; const x = __x; const {${paramNames.join(',')}} = __p; return (${formula});`;
  const customFn = (x: number, params: number[]) => {
    try {
      const paramObj: Record<string, number> = {};
      paramNames.forEach((n, i) => { paramObj[n] = params[i]; });
      const fn = new Function('__x', '__p', fnBody);
      const result = fn(x, paramObj);
      return typeof result === 'number' && isFinite(result) ? result : NaN;
    } catch {
      return NaN;
    }
  };

  const customModel: FitModel = {
    id: 'custom',
    name: '自定义公式',
    formula,
    paramNames,
    fn: customFn,
    guessInitial: () => initialGuess,
  };

  return fitCurve(data, customModel, curvePoints, undefined, weights);
};

// ════════════════════════════════════════════════
//  分段拟合
// ════════════════════════════════════════════════

/**
 * 分段拟合 — 不同区间使用不同模型
 */
export const fitPiecewise = (
  data: DataPoint[],
  segments: PiecewiseSegment[],
  curvePoints: number = 200,
  weights?: number[]
): PiecewiseFitResult => {
  const sorted = [...data].sort((a, b) => a.x - b.x);
  const breakpoints = segments.slice(1).map(s => s.xStart);

  const segmentResults: FitResult[] = [];
  const combinedCurve: DataPoint[] = [];

  for (const seg of segments) {
    // 提取该区间的数据
    const segData = sorted.filter(d => d.x >= seg.xStart && d.x <= seg.xEnd);
    let segWeights: number[] | undefined;
    if (weights) {
      segWeights = [];
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].x >= seg.xStart && sorted[i].x <= seg.xEnd) {
          segWeights.push(weights[i]);
        }
      }
    }

    if (segData.length < seg.model.paramNames.length) {
      // 数据不足则跳过
      segmentResults.push({
        params: seg.model.paramNames.map(n => ({ name: n, value: 0, initial: 0 })),
        rSquared: 0, chiSquared: 0, reducedChiSquared: 0, rmse: 0,
        fittedCurve: [], residuals: [],
        modelName: seg.model.name, formulaText: seg.model.formula,
        converged: false, iterations: 0,
        degreesOfFreedom: 0, aic: Infinity, bic: Infinity,
      });
      continue;
    }

    const result = fitCurve(segData, seg.model, curvePoints, undefined, segWeights);
    segmentResults.push(result);
    combinedCurve.push(...result.fittedCurve);
  }

  // 按 x 排序组合曲线
  combinedCurve.sort((a, b) => a.x - b.x);

  return { segmentResults, combinedCurve, breakpoints };
};

// ════════════════════════════════════════════════
//  全局拟合 — 多数据集共享参数
// ════════════════════════════════════════════════

/**
 * 全局拟合：多数据集共享部分参数
 *
 * 假设模型有 p 个参数，共 D 个数据集，共享参数索引为 S：
 * 总参数数 = |S| + (p - |S|) * D
 *
 * 将所有数据集拼成一个大残差向量，用统一的 LM 优化器求解。
 */
export const fitGlobal = (config: GlobalFitConfig): GlobalFitResult => {
  const { datasets, model, sharedParamIndices, weights } = config;
  const D = datasets.length;
  const p = model.paramNames.length;
  const sharedSet = new Set(sharedParamIndices);
  const localIndices = model.paramNames.map((_, i) => i).filter(i => !sharedSet.has(i));

  // 总参数维度
  const totalParams = sharedParamIndices.length + localIndices.length * D;

  // 排序每个数据集
  const sortedDatasets = datasets.map(ds => [...ds].sort((a, b) => a.x - b.x));

  // 构建初始猜测
  const guesses = sortedDatasets.map(ds => model.guessInitial(ds));
  const initialParams: number[] = [];
  // 共享参数 → 取第一个数据集的值
  for (const si of sharedParamIndices) {
    initialParams.push(guesses[0][si] || 1);
  }
  // 每个数据集的独立参数
  for (let d = 0; d < D; d++) {
    for (const li of localIndices) {
      initialParams.push(guesses[d][li] || 1);
    }
  }

  // 参数索引映射
  const getModelParams = (globalParams: number[], datasetIdx: number): number[] => {
    const mp = new Array(p);
    let sharedOffset = 0;
    let localOffset = sharedParamIndices.length + datasetIdx * localIndices.length;
    for (let i = 0; i < p; i++) {
      if (sharedSet.has(i)) {
        mp[i] = globalParams[sharedParamIndices.indexOf(i)];
        sharedOffset++;
      } else {
        const localPos = localIndices.indexOf(i);
        mp[i] = globalParams[sharedParamIndices.length + datasetIdx * localIndices.length + localPos];
      }
    }
    return mp;
  };

  // 拼接所有数据
  const allData: DataPoint[] = [];
  const allWeights: number[] = [];
  const datasetMap: number[] = []; // 每个数据点属于哪个数据集
  for (let d = 0; d < D; d++) {
    for (let i = 0; i < sortedDatasets[d].length; i++) {
      allData.push(sortedDatasets[d][i]);
      datasetMap.push(d);
      if (weights && weights[d]) {
        allWeights.push(weights[d][i] || 1);
      } else {
        allWeights.push(1);
      }
    }
  }

  // 构建全局模型
  const globalModel = (x: number, gParams: number[]): number => {
    // 这里需要知道这个 x 对应哪个数据集，但 LM 的 model 签名是 (x, params)
    // 我们通过闭包变量来追踪当前数据索引
    return 0; // placeholder
  };

  // 手动 LM 实现（因为需要 datasetMap 来决定参数映射）
  const opts = DEFAULT_LM_OPTIONS;
  const n = allData.length;
  const pTotal = totalParams;
  let params = [...initialParams];
  let lambda = opts.lambdaInit;

  const calcResiduals = (ps: number[]) =>
    allData.map((d, i) => {
      const mp = getModelParams(ps, datasetMap[i]);
      const sw = allWeights[i] !== 1 ? Math.sqrt(Math.abs(allWeights[i])) : 1;
      return sw * (d.y - model.fn(d.x, mp));
    });

  const calcJacobian = (ps: number[]): number[][] => {
    const J: number[][] = [];
    for (let i = 0; i < n; i++) {
      const row = new Array(pTotal).fill(0);
      const mp = getModelParams(ps, datasetMap[i]);
      const sw = allWeights[i] !== 1 ? Math.sqrt(Math.abs(allWeights[i])) : 1;

      // 对每个全局参数求导
      for (let j = 0; j < pTotal; j++) {
        const ps_plus = [...ps];
        const h = Math.max(opts.epsilon, Math.abs(ps[j]) * opts.epsilon);
        ps_plus[j] += h;
        const mp_plus = getModelParams(ps_plus, datasetMap[i]);
        row[j] = -sw * (model.fn(allData[i].x, mp_plus) - model.fn(allData[i].x, mp)) / h;
      }
      J.push(row);
    }
    return J;
  };

  const chiSq = (ps: number[]) => {
    const r = calcResiduals(ps);
    return r.reduce((s, v) => s + v * v, 0);
  };

  let currentChi = chiSq(params);
  let converged = false;
  let iter = 0;

  for (; iter < opts.maxIterations; iter++) {
    const r = calcResiduals(params);
    const J = calcJacobian(params);

    const JtJ: number[][] = Array.from({ length: pTotal }, () => Array(pTotal).fill(0));
    const JtR: number[] = Array(pTotal).fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < pTotal; j++) {
        JtR[j] += J[i][j] * r[i];
        for (let k = 0; k < pTotal; k++) {
          JtJ[j][k] += J[i][j] * J[i][k];
        }
      }
    }

    const A = JtJ.map((row, i) => row.map((v, j) => v + (i === j ? lambda * (v || 1) : 0)));
    const delta = solveSystem(A, JtR);

    if (!delta) {
      lambda *= opts.lambdaUp;
      continue;
    }

    const newParams = params.map((v, i) => v + delta[i]);
    const newChi = chiSq(newParams);

    if (isNaN(newChi) || !isFinite(newChi)) {
      lambda *= opts.lambdaUp;
      continue;
    }

    if (newChi < currentChi) {
      params = newParams;
      const improvement = (currentChi - newChi) / currentChi;
      currentChi = newChi;
      lambda *= opts.lambdaDown;
      if (improvement < opts.tolerance) {
        converged = true;
        break;
      }
    } else {
      lambda *= opts.lambdaUp;
    }
  }

  // 构建结果
  const sharedParams: FitParameter[] = sharedParamIndices.map((si, idx) => ({
    name: model.paramNames[si],
    value: params[idx],
    initial: initialParams[idx],
    error: undefined,
  }));

  const datasetParams: FitParameter[][] = [];
  const fittedCurves: DataPoint[][] = [];

  for (let d = 0; d < D; d++) {
    const mp = getModelParams(params, d);
    const localParams: FitParameter[] = localIndices.map((li, localIdx) => ({
      name: model.paramNames[li],
      value: mp[li],
      initial: guesses[d][li] || 1,
    }));
    datasetParams.push(localParams);

    // 生成拟合曲线
    const ds = sortedDatasets[d];
    const xMin = ds[0]?.x || 0;
    const xMax = ds[ds.length - 1]?.x || 1;
    const xRange = xMax - xMin || 1;
    const curve: DataPoint[] = [];
    for (let i = 0; i <= 200; i++) {
      const x = xMin + (i / 200) * xRange;
      const y = model.fn(x, mp);
      if (isFinite(y)) curve.push({ x, y });
    }
    fittedCurves.push(curve);
  }

  // 全局 R²
  const allYMean = allData.reduce((s, d) => s + d.y, 0) / n;
  const ssTot = allData.reduce((s, d) => s + (d.y - allYMean) ** 2, 0);
  const globalRSquared = ssTot > 0 ? 1 - currentChi / ssTot : 0;

  const globalAic = calcAIC(n, pTotal, currentChi);
  const globalBic = calcBIC(n, pTotal, currentChi);

  return {
    sharedParams,
    datasetParams,
    fittedCurves,
    globalRSquared: Math.max(0, Math.min(1, globalRSquared)),
    globalAic,
    globalBic,
    converged,
    iterations: iter,
  };
};

// ════════════════════════════════════════════════
//  Helper: Gaussian Elimination
// ════════════════════════════════════════════════

const solveSystem = (A: number[][], b: number[]): number[] | null => {
  const n = A.length;
  const aug = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-15) return null;

    for (let row = col + 1; row < n; row++) {
      const f = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) aug[row][j] -= f * aug[col][j];
    }
  }

  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = aug[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= aug[i][j] * x[j];
    x[i] /= aug[i][i];
  }
  return x;
};

// ════════════════════════════════════════════════
//  Helper: Matrix Inversion (Gauss-Jordan)
// ════════════════════════════════════════════════

const invertMatrix = (M: number[][]): number[][] | null => {
  const n = M.length;
  // 增广矩阵 [M | I]
  const aug = M.map((row, i) => {
    const r = [...row];
    for (let j = 0; j < n; j++) r.push(i === j ? 1 : 0);
    return r;
  });

  for (let col = 0; col < n; col++) {
    // 选主元
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-20) return null;

    // 归一化
    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    // 消元
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= f * aug[col][j];
    }
  }

  // 提取逆矩阵
  return aug.map(row => row.slice(n));
};
