// ─────────────────────────────────────────────
// 统计检验 & FFT 频谱分析 & 多峰反卷积
// ─────────────────────────────────────────────

// ════════════════════════════════════════════════
//  1. 假设检验 (Hypothesis Testing)
// ════════════════════════════════════════════════

export interface TestResult {
  testName: string;
  statistic: number;
  pValue: number;
  significant: boolean;
  /** 显著性水平 */
  alpha: number;
  details: Record<string, number | string>;
}

/** 独立样本 t 检验 (Welch's t-test) */
export const independentTTest = (sample1: number[], sample2: number[], alpha: number = 0.05): TestResult => {
  const n1 = sample1.length, n2 = sample2.length;
  const m1 = mean(sample1), m2 = mean(sample2);
  const v1 = variance(sample1), v2 = variance(sample2);

  const se = Math.sqrt(v1 / n1 + v2 / n2);
  const t = (m1 - m2) / (se || 1e-15);

  // Welch-Satterthwaite 自由度
  const num = (v1 / n1 + v2 / n2) ** 2;
  const den = ((v1 / n1) ** 2) / (n1 - 1) + ((v2 / n2) ** 2) / (n2 - 1);
  const df = num / (den || 1);

  const pValue = 2 * (1 - tCDF(Math.abs(t), df));

  return {
    testName: 'Welch\'s t 检验',
    statistic: t,
    pValue,
    significant: pValue < alpha,
    alpha,
    details: {
      mean1: m1, mean2: m2, n1, n2,
      std1: Math.sqrt(v1), std2: Math.sqrt(v2),
      df: Math.round(df * 100) / 100,
      差值: m1 - m2,
    },
  };
};

/** 配对样本 t 检验 */
export const pairedTTest = (sample1: number[], sample2: number[], alpha: number = 0.05): TestResult => {
  const n = Math.min(sample1.length, sample2.length);
  const diffs = Array.from({ length: n }, (_, i) => sample1[i] - sample2[i]);
  const mDiff = mean(diffs);
  const sDiff = Math.sqrt(variance(diffs));
  const se = sDiff / Math.sqrt(n);
  const t = mDiff / (se || 1e-15);
  const df = n - 1;
  const pValue = 2 * (1 - tCDF(Math.abs(t), df));

  return {
    testName: '配对 t 检验',
    statistic: t,
    pValue,
    significant: pValue < alpha,
    alpha,
    details: { mean_diff: mDiff, std_diff: sDiff, n, df },
  };
};

/** 单因素 ANOVA (F 检验) */
export const oneWayANOVA = (groups: number[][], alpha: number = 0.05): TestResult => {
  const k = groups.length;
  const N = groups.reduce((s, g) => s + g.length, 0);
  const grandMean = groups.flat().reduce((s, v) => s + v, 0) / N;

  // 组间平方和 SSB
  const SSB = groups.reduce((s, g) => {
    const gMean = mean(g);
    return s + g.length * (gMean - grandMean) ** 2;
  }, 0);

  // 组内平方和 SSW
  const SSW = groups.reduce((s, g) => {
    const gMean = mean(g);
    return s + g.reduce((ss, v) => ss + (v - gMean) ** 2, 0);
  }, 0);

  const dfBetween = k - 1;
  const dfWithin = N - k;
  const MSB = SSB / (dfBetween || 1);
  const MSW = SSW / (dfWithin || 1);
  const F = MSB / (MSW || 1e-15);

  const pValue = 1 - fCDF(F, dfBetween, dfWithin);

  return {
    testName: '单因素 ANOVA',
    statistic: F,
    pValue,
    significant: pValue < alpha,
    alpha,
    details: {
      组数: k, 总样本: N,
      SSB: round4(SSB), SSW: round4(SSW),
      MSB: round4(MSB), MSW: round4(MSW),
      df_between: dfBetween, df_within: dfWithin,
    },
  };
};

/** Mann-Whitney U 检验 (非参数) */
export const mannWhitneyU = (sample1: number[], sample2: number[], alpha: number = 0.05): TestResult => {
  const n1 = sample1.length, n2 = sample2.length;

  // 合并并排序，保留组标签
  const combined = [
    ...sample1.map(v => ({ v, g: 1 })),
    ...sample2.map(v => ({ v, g: 2 })),
  ].sort((a, b) => a.v - b.v);

  // 分配秩
  const ranks = new Float64Array(combined.length);
  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j < combined.length - 1 && combined[j + 1].v === combined[j].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[k] = avgRank;
    i = j + 1;
  }

  const R1 = combined.reduce((s, c, idx) => c.g === 1 ? s + ranks[idx] : s, 0);
  const U1 = R1 - (n1 * (n1 + 1)) / 2;
  const U2 = n1 * n2 - U1;
  const U = Math.min(U1, U2);

  // 正态近似
  const mU = (n1 * n2) / 2;
  const sU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  const z = (U - mU) / (sU || 1);
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  return {
    testName: 'Mann-Whitney U 检验',
    statistic: U,
    pValue,
    significant: pValue < alpha,
    alpha,
    details: { U1, U2, z: round4(z), n1, n2 },
  };
};

// ════════════════════════════════════════════════
//  2. FFT 频谱分析
// ════════════════════════════════════════════════

export interface FFTResult {
  frequencies: number[];
  magnitudes: number[];
  phases: number[];
  dominantFreq: number;
  dominantAmplitude: number;
}

/** 快速傅里叶变换 (Cooley-Tukey 基2 FFT) */
export const computeFFT = (data: { x: number; y: number }[]): FFTResult => {
  const sorted = [...data].sort((a, b) => a.x - b.x);
  const values = sorted.map(d => d.y);

  // 补齐到 2 的幂次
  let n = 1;
  while (n < values.length) n <<= 1;
  const padded = [...values, ...new Array(n - values.length).fill(0)];

  // 执行 FFT
  const { real, imag } = fft(padded);

  // 采样间隔
  const dx = sorted.length > 1 ? (sorted[sorted.length - 1].x - sorted[0].x) / (sorted.length - 1) : 1;
  const fs = 1 / dx; // 采样频率

  const half = n / 2;
  const frequencies: number[] = [];
  const magnitudes: number[] = [];
  const phases: number[] = [];

  for (let i = 0; i < half; i++) {
    frequencies.push((i * fs) / n);
    magnitudes.push(Math.sqrt(real[i] ** 2 + imag[i] ** 2) / n * 2);
    phases.push(Math.atan2(imag[i], real[i]));
  }

  // 找主频（跳过 DC 分量 i=0）
  let maxIdx = 1;
  for (let i = 2; i < half; i++) {
    if (magnitudes[i] > magnitudes[maxIdx]) maxIdx = i;
  }

  return {
    frequencies,
    magnitudes,
    phases,
    dominantFreq: frequencies[maxIdx],
    dominantAmplitude: magnitudes[maxIdx],
  };
};

/** 基2 递归 FFT */
const fft = (signal: number[]): { real: number[]; imag: number[] } => {
  const n = signal.length;
  if (n === 1) return { real: [signal[0]], imag: [0] };

  const even = fft(signal.filter((_, i) => i % 2 === 0));
  const odd  = fft(signal.filter((_, i) => i % 2 === 1));

  const real = new Array(n);
  const imag = new Array(n);

  for (let k = 0; k < n / 2; k++) {
    const angle = -2 * Math.PI * k / n;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const tReal = cos * odd.real[k] - sin * odd.imag[k];
    const tImag = cos * odd.imag[k] + sin * odd.real[k];

    real[k] = even.real[k] + tReal;
    imag[k] = even.imag[k] + tImag;
    real[k + n / 2] = even.real[k] - tReal;
    imag[k + n / 2] = even.imag[k] - tImag;
  }

  return { real, imag };
};

// ════════════════════════════════════════════════
//  3. 多峰反卷积 (Peak Deconvolution)
// ════════════════════════════════════════════════

export interface DeconvPeak {
  center: number;
  amplitude: number;
  width: number;  // FWHM
  shape: 'gaussian' | 'lorentzian' | 'voigt';
  area: number;
}

export interface DeconvResult {
  peaks: DeconvPeak[];
  fittedCurve: { x: number; y: number }[];
  residual: { x: number; y: number }[];
  rSquared: number;
  /** 每个单独峰的曲线 */
  peakCurves: { x: number; y: number }[][];
}

/** 多峰反卷积 — 给定初始峰位，优化每个峰的参数 */
export const deconvolvePeaks = (
  data: { x: number; y: number }[],
  initialCenters: number[],
  shape: 'gaussian' | 'lorentzian' | 'voigt' = 'gaussian',
  iterations: number = 100
): DeconvResult => {
  const sorted = [...data].sort((a, b) => a.x - b.x);
  const n = sorted.length;
  const nPeaks = initialCenters.length;

  if (nPeaks === 0 || n < 3) {
    return { peaks: [], fittedCurve: [], residual: [], rSquared: 0, peakCurves: [] };
  }

  // 初始化参数 [amp, center, width] for each peak
  const yMax = Math.max(...sorted.map(d => d.y));
  let params = initialCenters.flatMap(c => [yMax * 0.5, c, 1]);

  const peakFn = (x: number, amp: number, center: number, width: number): number => {
    const sigma = width / 2.355;
    if (shape === 'gaussian') return amp * Math.exp(-((x - center) ** 2) / (2 * sigma * sigma));
    if (shape === 'lorentzian') return amp / (1 + ((x - center) / (width / 2)) ** 2);
    // Voigt (pseudo-Voigt with eta=0.5)
    const gauss = Math.exp(-((x - center) ** 2) / (2 * sigma * sigma));
    const lorentz = 1 / (1 + ((x - center) / (width / 2)) ** 2);
    return amp * (0.5 * gauss + 0.5 * lorentz);
  };

  const totalFn = (x: number, ps: number[]): number => {
    let sum = 0;
    for (let p = 0; p < nPeaks; p++) {
      sum += peakFn(x, ps[p * 3], ps[p * 3 + 1], ps[p * 3 + 2]);
    }
    return sum;
  };

  // 简化的坐标下降优化
  for (let iter = 0; iter < iterations; iter++) {
    const stepSize = 0.01 * Math.max(1, (iterations - iter) / iterations);

    for (let pi = 0; pi < params.length; pi++) {
      const original = params[pi];

      // 计算当前 SSR
      const currentSSR = sorted.reduce((s, d) => s + (d.y - totalFn(d.x, params)) ** 2, 0);

      // 尝试 +step
      const step = Math.abs(original * stepSize) || 0.01;
      params[pi] = original + step;
      const ssrPlus = sorted.reduce((s, d) => s + (d.y - totalFn(d.x, params)) ** 2, 0);

      // 尝试 -step
      params[pi] = original - step;
      const ssrMinus = sorted.reduce((s, d) => s + (d.y - totalFn(d.x, params)) ** 2, 0);

      // 选择最优
      if (ssrPlus < currentSSR && ssrPlus <= ssrMinus) {
        params[pi] = original + step;
      } else if (ssrMinus < currentSSR) {
        params[pi] = original - step;
      } else {
        params[pi] = original;
      }

      // 约束：amplitude >= 0, width > 0
      if (pi % 3 === 0) params[pi] = Math.max(0, params[pi]); // amplitude
      if (pi % 3 === 2) params[pi] = Math.max(0.01, params[pi]); // width
    }
  }

  // 构造结果
  const peaks: DeconvPeak[] = [];
  const peakCurves: { x: number; y: number }[][] = [];

  for (let p = 0; p < nPeaks; p++) {
    const amp = params[p * 3];
    const center = params[p * 3 + 1];
    const width = Math.abs(params[p * 3 + 2]);

    // 计算面积
    const sigma = width / 2.355;
    const area = shape === 'gaussian'
      ? amp * sigma * Math.sqrt(2 * Math.PI)
      : amp * Math.PI * (width / 2);

    peaks.push({ center, amplitude: amp, width, shape, area: Math.abs(area) });

    // 单个峰曲线
    const curve = sorted.map(d => ({ x: d.x, y: peakFn(d.x, amp, center, width) }));
    peakCurves.push(curve);
  }

  const fittedCurve = sorted.map(d => ({ x: d.x, y: totalFn(d.x, params) }));
  const residual = sorted.map((d, i) => ({ x: d.x, y: d.y - fittedCurve[i].y }));

  const yMean = sorted.reduce((s, d) => s + d.y, 0) / n;
  const ssTot = sorted.reduce((s, d) => s + (d.y - yMean) ** 2, 0);
  const ssRes = residual.reduce((s, d) => s + d.y ** 2, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { peaks, fittedCurve, residual, rSquared: Math.max(0, rSquared), peakCurves };
};

// ════════════════════════════════════════════════
//  4. 卡方拟合优度检验 (Chi-Squared Goodness-of-Fit)
// ════════════════════════════════════════════════

/** 卡方拟合优度检验 — 比较观测频率与期望频率 */
export const chiSquaredTest = (
  observed: number[],
  expected: number[],
  alpha: number = 0.05
): TestResult => {
  const n = Math.min(observed.length, expected.length);
  if (n < 2) {
    return { testName: '卡方检验', statistic: 0, pValue: 1, significant: false, alpha, details: { error: '样本不足' } };
  }

  let chiSq = 0;
  for (let i = 0; i < n; i++) {
    const e = expected[i];
    if (e > 0) {
      chiSq += ((observed[i] - e) ** 2) / e;
    }
  }

  const df = n - 1;
  const pValue = 1 - gammaCDF(chiSq / 2, df / 2);

  return {
    testName: '卡方拟合优度检验',
    statistic: chiSq,
    pValue,
    significant: pValue < alpha,
    alpha,
    details: {
      自由度: df,
      观测总数: round4(observed.reduce((s, v) => s + v, 0)),
      期望总数: round4(expected.reduce((s, v) => s + v, 0)),
      类别数: n,
    },
  };
};

// ════════════════════════════════════════════════
//  5. Kolmogorov-Smirnov 双样本检验
// ════════════════════════════════════════════════

/** 双样本 KS 检验 — 检验两个样本是否来自同一分布 */
export const kolmogorovSmirnovTest = (
  sample1: number[],
  sample2: number[],
  alpha: number = 0.05
): TestResult => {
  const n1 = sample1.length, n2 = sample2.length;
  if (n1 < 1 || n2 < 1) {
    return { testName: 'KS 检验', statistic: 0, pValue: 1, significant: false, alpha, details: { error: '样本不足' } };
  }

  const s1 = [...sample1].sort((a, b) => a - b);
  const s2 = [...sample2].sort((a, b) => a - b);

  // 合并所有唯一值作为评估点
  const allValues = [...new Set([...s1, ...s2])].sort((a, b) => a - b);

  let dMax = 0;
  for (const v of allValues) {
    // 经验 CDF
    const f1 = s1.filter(x => x <= v).length / n1;
    const f2 = s2.filter(x => x <= v).length / n2;
    const d = Math.abs(f1 - f2);
    if (d > dMax) dMax = d;
  }

  // Kolmogorov 分布 p 值近似
  const ne = Math.sqrt((n1 * n2) / (n1 + n2));
  const z = (ne + 0.12 + 0.11 / ne) * dMax;
  // Kolmogorov 渐近公式
  let pValue = 0;
  for (let k = 1; k <= 100; k++) {
    pValue += 2 * ((-1) ** (k - 1)) * Math.exp(-2 * k * k * z * z);
  }
  pValue = Math.max(0, Math.min(1, pValue));

  return {
    testName: 'Kolmogorov-Smirnov 双样本检验',
    statistic: dMax,
    pValue,
    significant: pValue < alpha,
    alpha,
    details: {
      D统计量: round4(dMax),
      n1, n2,
      有效样本量: round4(ne),
      z: round4(z),
    },
  };
};

// ════════════════════════════════════════════════
//  6. Wilcoxon 符号秩检验
// ════════════════════════════════════════════════

/** Wilcoxon 符号秩检验 — 配对样本非参数检验 */
export const wilcoxonSignedRank = (
  sample1: number[],
  sample2: number[],
  alpha: number = 0.05
): TestResult => {
  const n = Math.min(sample1.length, sample2.length);
  if (n < 5) {
    return { testName: 'Wilcoxon 符号秩', statistic: 0, pValue: 1, significant: false, alpha, details: { error: '样本不足 (至少需要5对)' } };
  }

  // 计算差值，移除零差值
  const diffs: { diff: number; absDiff: number }[] = [];
  for (let i = 0; i < n; i++) {
    const d = sample1[i] - sample2[i];
    if (d !== 0) {
      diffs.push({ diff: d, absDiff: Math.abs(d) });
    }
  }

  const nr = diffs.length; // 非零差值数
  if (nr < 3) {
    return { testName: 'Wilcoxon 符号秩', statistic: 0, pValue: 1, significant: false, alpha, details: { error: '非零差值不足' } };
  }

  // 按绝对值排序并分配秩（处理并列时取平均秩）
  diffs.sort((a, b) => a.absDiff - b.absDiff);
  const ranks = new Float64Array(nr);
  let i = 0;
  while (i < nr) {
    let j = i;
    while (j < nr - 1 && diffs[j + 1].absDiff === diffs[j].absDiff) j++;
    const avgRank = (i + j) / 2 + 1; // 1-based
    for (let k = i; k <= j; k++) ranks[k] = avgRank;
    i = j + 1;
  }

  // 正秩和 W+ 与负秩和 W-
  let wPlus = 0, wMinus = 0;
  for (let i = 0; i < nr; i++) {
    if (diffs[i].diff > 0) wPlus += ranks[i];
    else wMinus += ranks[i];
  }

  const W = Math.min(wPlus, wMinus);

  // 正态近似 (n ≥ 10 时精度较好，n ≥ 5 时可用)
  const meanW = nr * (nr + 1) / 4;
  const stdW = Math.sqrt(nr * (nr + 1) * (2 * nr + 1) / 24);
  const z = (W - meanW) / (stdW || 1);
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));

  return {
    testName: 'Wilcoxon 符号秩检验',
    statistic: W,
    pValue,
    significant: pValue < alpha,
    alpha,
    details: {
      'W+': round4(wPlus),
      'W-': round4(wMinus),
      W统计量: round4(W),
      z: round4(z),
      配对数: n,
      非零差值数: nr,
    },
  };
};

// ════════════════════════════════════════════════
//  Helper Functions
// ════════════════════════════════════════════════

/** 正则化不完全 Gamma 函数 P(a, x) — 用于卡方 CDF */
const gammaCDF = (x: number, a: number): number => {
  if (x <= 0) return 0;
  if (a <= 0) return 1;

  // 级数展开 P(a, x) = γ(a, x) / Γ(a)
  const lnGammaA = lnGamma(a);
  let sum = 0, term = 1 / a;
  sum = term;
  for (let n = 1; n < 200; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < 1e-12) break;
  }
  const result = Math.exp(a * Math.log(x) - x - lnGammaA) * sum;
  return Math.max(0, Math.min(1, result));
};

const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
const variance = (arr: number[]) => {
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1 || 1);
};
const round4 = (v: number) => Math.round(v * 10000) / 10000;

/** 标准正态 CDF 近似 (Abramowitz & Stegun) */
const normalCDF = (x: number): number => {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
};

/** Student's t CDF 近似 */
const tCDF = (t: number, df: number): number => {
  const x = df / (df + t * t);
  return 1 - 0.5 * incompleteBeta(df / 2, 0.5, x);
};

/** F 分布 CDF 近似 */
const fCDF = (f: number, df1: number, df2: number): number => {
  const x = df2 / (df2 + df1 * f);
  return 1 - incompleteBeta(df2 / 2, df1 / 2, x);
};

/** 不完全 Beta 函数 (正则化) — 连分式展开近似 */
const incompleteBeta = (a: number, b: number, x: number): number => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // 使用级数展开
  const lnBeta = lnGamma(a) + lnGamma(b) - lnGamma(a + b);
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBeta);

  let sum = 1, term = 1;
  for (let n = 0; n < 200; n++) {
    term *= (n - b + 1) * x / ((a + n) * (n + 1));
    sum += term;
    if (Math.abs(term) < 1e-10) break;
  }

  return Math.min(1, Math.max(0, front * sum / a));
};

/** ln(Gamma(x)) — Stirling 近似 */
const lnGamma = (x: number): number => {
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  }

  x -= 1;
  let a = coef[0];
  for (let i = 1; i < g + 2; i++) a += coef[i] / (x + i);

  const t = x + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
};
