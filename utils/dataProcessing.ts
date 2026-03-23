// ─────────────────────────────────────────────
// Data Processing Utilities — 纯数学函数模块
// ─────────────────────────────────────────────

export interface DataPoint {
  x: number;
  y: number;
}

// ════════════════════════════════════════════════
//  1. 数据平滑 (Smoothing)
// ════════════════════════════════════════════════

/** 移动平均平滑 */
export const movingAverage = (data: DataPoint[], windowSize: number): DataPoint[] => {
  const half = Math.floor(windowSize / 2);
  return data.map((pt, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(data.length, i + half + 1);
    const slice = data.slice(start, end);
    const avg = slice.reduce((s, p) => s + p.y, 0) / slice.length;
    return { x: pt.x, y: avg };
  });
};

/** Savitzky-Golay 平滑 (简化版：二阶多项式) */
export const savitzkyGolay = (data: DataPoint[], windowSize: number): DataPoint[] => {
  const ws = windowSize % 2 === 0 ? windowSize + 1 : windowSize;
  const half = Math.floor(ws / 2);
  if (data.length < ws) return [...data];

  const result: DataPoint[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < half || i >= data.length - half) {
      result.push({ ...data[i] });
      continue;
    }

    // 最小二乘拟合二阶多项式
    const window = data.slice(i - half, i + half + 1);
    const n = window.length;
    let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
    let sumY = 0, sumXY = 0, sumX2Y = 0;

    window.forEach((pt, j) => {
      const x = j - half; // centered
      sumX += x;
      sumX2 += x * x;
      sumX3 += x * x * x;
      sumX4 += x * x * x * x;
      sumY += pt.y;
      sumXY += x * pt.y;
      sumX2Y += x * x * pt.y;
    });

    // Solve 3x3 system for a0 (value at center)
    const det = n * (sumX2 * sumX4 - sumX3 * sumX3) -
                sumX * (sumX * sumX4 - sumX2 * sumX3) +
                sumX2 * (sumX * sumX3 - sumX2 * sumX2);

    if (Math.abs(det) < 1e-15) {
      result.push({ ...data[i] });
      continue;
    }

    const a0 = (sumY * (sumX2 * sumX4 - sumX3 * sumX3) -
                sumXY * (sumX * sumX4 - sumX2 * sumX3) +
                sumX2Y * (sumX * sumX3 - sumX2 * sumX2)) / det;

    result.push({ x: data[i].x, y: a0 });
  }

  return result;
};

// ════════════════════════════════════════════════
//  2. 基线校正 (Baseline Correction)
// ════════════════════════════════════════════════

/** 多项式基线拟合与减除 */
export const polynomialBaseline = (data: DataPoint[], degree: number = 3): DataPoint[] => {
  const n = data.length;
  if (n < degree + 1) return [...data];

  // Vandermonde 矩阵法
  const xs = data.map(p => p.x);
  const ys = data.map(p => p.y);

  // 归一化 x 以避免数值溢出
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const xRange = xMax - xMin || 1;
  const xNorm = xs.map(x => (x - xMin) / xRange);

  // 构建 normal equations: (V^T V) c = V^T y
  const cols = degree + 1;
  const VtV: number[][] = Array.from({ length: cols }, () => Array(cols).fill(0));
  const VtY: number[] = Array(cols).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < cols; j++) {
      const xj = Math.pow(xNorm[i], j);
      VtY[j] += xj * ys[i];
      for (let k = 0; k < cols; k++) {
        VtV[j][k] += xj * Math.pow(xNorm[i], k);
      }
    }
  }

  // Gauss elimination
  const coeffs = solveLinearSystem(VtV, VtY);
  if (!coeffs) return [...data];

  return data.map((pt, i) => {
    let baseline = 0;
    for (let j = 0; j < cols; j++) {
      baseline += coeffs[j] * Math.pow(xNorm[i], j);
    }
    return { x: pt.x, y: pt.y - baseline };
  });
};

/** ALS (Asymmetric Least Squares) 基线 */
export const alsBaseline = (
  data: DataPoint[],
  lambda: number = 1e5,
  p: number = 0.01,
  iterations: number = 10
): DataPoint[] => {
  const n = data.length;
  if (n < 3) return [...data];

  const y = data.map(d => d.y);
  let z = [...y]; // baseline estimate
  const w = new Float64Array(n).fill(1);

  for (let iter = 0; iter < iterations; iter++) {
    // 简化版本：加权移动平均近似平滑
    const smoothed = [...z];
    for (let i = 1; i < n - 1; i++) {
      smoothed[i] = (z[i - 1] + 2 * z[i] + z[i + 1]) / 4;
    }

    // 更新权重
    for (let i = 0; i < n; i++) {
      w[i] = y[i] > smoothed[i] ? p : (1 - p);
      z[i] = w[i] * y[i] + (1 - w[i]) * smoothed[i];
    }

    // 额外平滑
    for (let s = 0; s < Math.min(lambda / 1e4, 5); s++) {
      const temp = [...z];
      for (let i = 1; i < n - 1; i++) {
        z[i] = (temp[i - 1] + 2 * temp[i] + temp[i + 1]) / 4;
      }
    }
  }

  return data.map((pt, i) => ({ x: pt.x, y: pt.y - z[i] }));
};

// ════════════════════════════════════════════════
//  3. 归一化 (Normalization)
// ════════════════════════════════════════════════

/** Min-Max 归一化到 [0, 1] */
export const normalizeMinMax = (data: DataPoint[]): DataPoint[] => {
  const ys = data.map(d => d.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const range = maxY - minY || 1;
  return data.map(pt => ({ x: pt.x, y: (pt.y - minY) / range }));
};

/** Z-score 标准化 */
export const normalizeZScore = (data: DataPoint[]): DataPoint[] => {
  const ys = data.map(d => d.y);
  const mean = ys.reduce((s, v) => s + v, 0) / ys.length;
  const std = Math.sqrt(ys.reduce((s, v) => s + (v - mean) ** 2, 0) / ys.length) || 1;
  return data.map(pt => ({ x: pt.x, y: (pt.y - mean) / std }));
};

/** 面积归一化 */
export const normalizeArea = (data: DataPoint[]): DataPoint[] => {
  const area = numericalIntegral(data);
  if (Math.abs(area) < 1e-15) return [...data];
  return data.map(pt => ({ x: pt.x, y: pt.y / area }));
};

// ════════════════════════════════════════════════
//  4. 插值 (Interpolation)
// ════════════════════════════════════════════════

/** 线性插值 */
export const linearInterpolate = (data: DataPoint[], newX: number[]): DataPoint[] => {
  if (data.length < 2) return [];
  const sorted = [...data].sort((a, b) => a.x - b.x);

  return newX.map(x => {
    if (x <= sorted[0].x) return { x, y: sorted[0].y };
    if (x >= sorted[sorted.length - 1].x) return { x, y: sorted[sorted.length - 1].y };

    let i = 0;
    while (i < sorted.length - 1 && sorted[i + 1].x < x) i++;

    const t = (x - sorted[i].x) / (sorted[i + 1].x - sorted[i].x);
    return { x, y: sorted[i].y + t * (sorted[i + 1].y - sorted[i].y) };
  });
};

/** 自然三次样条插值 */
export const splineInterpolate = (data: DataPoint[], newX: number[]): DataPoint[] => {
  if (data.length < 3) return linearInterpolate(data, newX);
  const sorted = [...data].sort((a, b) => a.x - b.x);
  const n = sorted.length;
  const xs = sorted.map(p => p.x);
  const ys = sorted.map(p => p.y);

  // 计算自然三次样条系数
  const h: number[] = [];
  for (let i = 0; i < n - 1; i++) h.push(xs[i + 1] - xs[i]);

  const alpha: number[] = [0];
  for (let i = 1; i < n - 1; i++) {
    alpha.push((3 / h[i]) * (ys[i + 1] - ys[i]) - (3 / h[i - 1]) * (ys[i] - ys[i - 1]));
  }

  const l: number[] = [1];
  const mu: number[] = [0];
  const z: number[] = [0];

  for (let i = 1; i < n - 1; i++) {
    l.push(2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1]);
    mu.push(h[i] / l[i]);
    z.push((alpha[i] - h[i - 1] * z[i - 1]) / l[i]);
  }

  l.push(1); mu.push(0); z.push(0);

  const c: number[] = Array(n).fill(0);
  const b: number[] = Array(n - 1).fill(0);
  const d: number[] = Array(n - 1).fill(0);

  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (ys[j + 1] - ys[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }

  return newX.map(x => {
    let i = 0;
    while (i < n - 2 && xs[i + 1] < x) i++;
    i = Math.min(i, n - 2);

    const dx = x - xs[i];
    const y = ys[i] + b[i] * dx + c[i] * dx * dx + d[i] * dx * dx * dx;
    return { x, y };
  });
};

// ════════════════════════════════════════════════
//  5. 微积分 (Calculus)
// ════════════════════════════════════════════════

/** 数值微分（中心差分） */
export const numericalDerivative = (data: DataPoint[]): DataPoint[] => {
  if (data.length < 2) return [];
  const sorted = [...data].sort((a, b) => a.x - b.x);

  return sorted.map((pt, i) => {
    if (i === 0) {
      const dy = sorted[1].y - sorted[0].y;
      const dx = sorted[1].x - sorted[0].x;
      return { x: pt.x, y: dx !== 0 ? dy / dx : 0 };
    }
    if (i === sorted.length - 1) {
      const dy = sorted[i].y - sorted[i - 1].y;
      const dx = sorted[i].x - sorted[i - 1].x;
      return { x: pt.x, y: dx !== 0 ? dy / dx : 0 };
    }
    // 中心差分
    const dy = sorted[i + 1].y - sorted[i - 1].y;
    const dx = sorted[i + 1].x - sorted[i - 1].x;
    return { x: pt.x, y: dx !== 0 ? dy / dx : 0 };
  });
};

/** 数值积分（梯形法则）— 返回累积积分 */
export const cumulativeIntegral = (data: DataPoint[]): DataPoint[] => {
  if (data.length < 2) return data.map(p => ({ x: p.x, y: 0 }));
  const sorted = [...data].sort((a, b) => a.x - b.x);

  let cumSum = 0;
  const result: DataPoint[] = [{ x: sorted[0].x, y: 0 }];

  for (let i = 1; i < sorted.length; i++) {
    const dx = sorted[i].x - sorted[i - 1].x;
    const area = 0.5 * (sorted[i].y + sorted[i - 1].y) * dx;
    cumSum += area;
    result.push({ x: sorted[i].x, y: cumSum });
  }

  return result;
};

/** 数值积分（梯形法则）— 返回总面积标量 */
export const numericalIntegral = (data: DataPoint[]): number => {
  if (data.length < 2) return 0;
  const sorted = [...data].sort((a, b) => a.x - b.x);
  let total = 0;
  for (let i = 1; i < sorted.length; i++) {
    total += 0.5 * (sorted[i].y + sorted[i - 1].y) * (sorted[i].x - sorted[i - 1].x);
  }
  return total;
};

/** 曲线下面积（指定 x 范围） */
export const areaUnderCurve = (data: DataPoint[], xMin?: number, xMax?: number): number => {
  const filtered = data.filter(p => {
    if (xMin !== undefined && p.x < xMin) return false;
    if (xMax !== undefined && p.x > xMax) return false;
    return true;
  }).sort((a, b) => a.x - b.x);
  return numericalIntegral(filtered);
};

// ════════════════════════════════════════════════
//  6. 描述性统计 (Descriptive Statistics)
// ════════════════════════════════════════════════

export interface DescriptiveStats {
  count: number;
  mean: number;
  median: number;
  std: number;
  variance: number;
  min: number;
  max: number;
  range: number;
  skewness: number;
  kurtosis: number;
  q1: number;
  q3: number;
  iqr: number;
}

export const computeDescriptiveStats = (values: number[]): DescriptiveStats => {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return { count: 0, mean: 0, median: 0, std: 0, variance: 0, min: 0, max: 0, range: 0, skewness: 0, kurtosis: 0, q1: 0, q3: 0, iqr: 0 };

  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];

  const skewness = std > 0 ? sorted.reduce((s, v) => s + ((v - mean) / std) ** 3, 0) / n : 0;
  const kurtosis = std > 0 ? sorted.reduce((s, v) => s + ((v - mean) / std) ** 4, 0) / n - 3 : 0;

  return {
    count: n, mean, median, std, variance,
    min: sorted[0], max: sorted[n - 1],
    range: sorted[n - 1] - sorted[0],
    skewness, kurtosis,
    q1, q3, iqr: q3 - q1,
  };
};

// ════════════════════════════════════════════════
//  Helper: Gaussian Elimination
// ════════════════════════════════════════════════

const solveLinearSystem = (A: number[][], b: number[]): number[] | null => {
  const n = A.length;
  const aug = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    if (Math.abs(aug[col][col]) < 1e-12) return null;

    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= aug[i][j] * x[j];
    }
    x[i] /= aug[i][i];
  }

  return x;
};

// ════════════════════════════════════════════════
//  7. 峰值查找 (Peak Finding)
// ════════════════════════════════════════════════

export interface PeakInfo {
  index: number;
  x: number;
  y: number;
  /** 峰突出度 (prominence) */
  prominence: number;
  /** 半高全宽 FWHM */
  fwhm: number;
  /** 峰面积（近似） */
  area: number;
}

export interface PeakFindOptions {
  /** 最小峰高 (绝对值 或 相对于最大值的百分比) */
  minHeight?: number;
  /** 使用相对高度（百分比） */
  relativeHeight?: boolean;
  /** 最小突出度 */
  minProminence?: number;
  /** 最小峰间距（x 方向的数据点数） */
  minDistance?: number;
  /** 查找谷而非峰 */
  findValleys?: boolean;
  /** 最大返回峰数 */
  maxPeaks?: number;
}

/** 查找数据中的峰值 */
export const findPeaks = (data: DataPoint[], options: PeakFindOptions = {}): PeakInfo[] => {
  if (data.length < 3) return [];

  const sorted = [...data].sort((a, b) => a.x - b.x);
  const ys = sorted.map(d => options.findValleys ? -d.y : d.y);
  const yMax = Math.max(...ys);
  const yMin = Math.min(...ys);
  const yRange = yMax - yMin || 1;

  // 阈值转换
  let threshold = options.minHeight ?? 0;
  if (options.relativeHeight) {
    threshold = yMin + (yRange * threshold / 100);
  }
  const minProminence = options.minProminence ?? (yRange * 0.05);
  const minDistance = options.minDistance ?? 1;
  const maxPeaks = options.maxPeaks ?? 50;

  // Step 1: 找所有局部极大值
  const candidates: number[] = [];
  for (let i = 1; i < ys.length - 1; i++) {
    if (ys[i] > ys[i - 1] && ys[i] >= ys[i + 1] && ys[i] >= threshold) {
      candidates.push(i);
    }
  }

  // Step 2: 计算突出度 (prominence)
  const peaks: PeakInfo[] = [];
  for (const idx of candidates) {
    const peakY = ys[idx];

    // 向左找最低点直到遇到更高峰
    let leftMin = peakY;
    for (let j = idx - 1; j >= 0; j--) {
      leftMin = Math.min(leftMin, ys[j]);
      if (ys[j] > peakY) break;
    }

    // 向右找最低点直到遇到更高峰
    let rightMin = peakY;
    for (let j = idx + 1; j < ys.length; j++) {
      rightMin = Math.min(rightMin, ys[j]);
      if (ys[j] > peakY) break;
    }

    const prominence = peakY - Math.max(leftMin, rightMin);
    if (prominence < minProminence) continue;

    // 计算 FWHM
    const halfHeight = peakY - prominence / 2;
    let leftHalf = idx, rightHalf = idx;
    for (let j = idx - 1; j >= 0; j--) {
      if (ys[j] <= halfHeight) { leftHalf = j; break; }
    }
    for (let j = idx + 1; j < ys.length; j++) {
      if (ys[j] <= halfHeight) { rightHalf = j; break; }
    }
    const fwhm = sorted[rightHalf].x - sorted[leftHalf].x;

    // 峰面积（梯形近似）
    let area = 0;
    for (let j = leftHalf; j < rightHalf && j < sorted.length - 1; j++) {
      area += 0.5 * (ys[j] + ys[j + 1]) * (sorted[j + 1].x - sorted[j].x);
    }

    peaks.push({
      index: idx,
      x: sorted[idx].x,
      y: options.findValleys ? -sorted[idx].y : sorted[idx].y,
      prominence,
      fwhm: Math.abs(fwhm),
      area: Math.abs(area),
    });
  }

  // Step 3: 应用最小间距过滤 (保留更高的峰)
  const filtered: PeakInfo[] = [];
  const sortedPeaks = [...peaks].sort((a, b) => b.prominence - a.prominence);

  for (const peak of sortedPeaks) {
    const tooClose = filtered.some(p => Math.abs(p.index - peak.index) < minDistance);
    if (!tooClose) {
      filtered.push(peak);
      if (filtered.length >= maxPeaks) break;
    }
  }

  return filtered.sort((a, b) => a.x - b.x);
};

// ════════════════════════════════════════════════
//  8. 数据裁剪 (Data Clipping)
// ════════════════════════════════════════════════

/** 按 X 范围裁剪数据 */
export const clipDataByXRange = (data: DataPoint[], xMin: number, xMax: number): DataPoint[] => {
  return data.filter(p => p.x >= xMin && p.x <= xMax);
};

/** 按 Y 范围裁剪数据 */
export const clipDataByYRange = (data: DataPoint[], yMin: number, yMax: number): DataPoint[] => {
  return data.filter(p => p.y >= yMin && p.y <= yMax);
};

/** 移除离群点 (IQR 法) */
export const removeOutliers = (data: DataPoint[], factor: number = 1.5): DataPoint[] => {
  const ys = [...data.map(d => d.y)].sort((a, b) => a - b);
  const n = ys.length;
  const q1 = ys[Math.floor(n * 0.25)];
  const q3 = ys[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const lower = q1 - factor * iqr;
  const upper = q3 + factor * iqr;
  return data.filter(p => p.y >= lower && p.y <= upper);
};

/** 数据抽稀 (按步长) */
export const decimateData = (data: DataPoint[], step: number): DataPoint[] => {
  if (step <= 1) return [...data];
  return data.filter((_, i) => i % step === 0);
};

