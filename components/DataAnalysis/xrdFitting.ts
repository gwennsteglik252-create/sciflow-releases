/**
 * xrdFitting.ts
 * 
 * Levenberg-Marquardt 最小二乘优化器 + Pseudo-Voigt 峰形拟合
 * 纯 TypeScript 实现，零外部依赖
 */

// ═══════════════════════════════════════════
//  数学模型
// ═══════════════════════════════════════════

/** Gaussian 峰形 */
export const gaussian = (x: number, x0: number, A: number, w: number): number => {
    const sigma = w / (2 * Math.sqrt(2 * Math.LN2)); // FWHM → σ
    return A * Math.exp(-0.5 * ((x - x0) / sigma) ** 2);
};

/** Lorentzian 峰形 */
export const lorentzian = (x: number, x0: number, A: number, w: number): number => {
    const gamma = w / 2; // FWHM → half-width
    return A / (1 + ((x - x0) / gamma) ** 2);
};

/**
 * Pseudo-Voigt 峰形模型
 * pV(x) = η·L(x) + (1-η)·G(x)
 * @param x 自变量 (2θ)
 * @param params [x0, A, w, eta] — 中心, 振幅, FWHM, 混合因子(0=纯G, 1=纯L)
 */
export const pseudoVoigt = (x: number, params: number[]): number => {
    const [x0, A, w, eta] = params;
    const clampedEta = Math.max(0, Math.min(1, eta));
    return clampedEta * lorentzian(x, x0, A, w) + (1 - clampedEta) * gaussian(x, x0, A, w);
};

/**
 * Pseudo-Voigt 积分强度（解析近似）
 * I_int ≈ A · w · [η·(π/2) + (1-η)·√(π·ln2)]
 */
export const pseudoVoigtIntegral = (A: number, w: number, eta: number): number => {
    const clampedEta = Math.max(0, Math.min(1, eta));
    return A * w * (clampedEta * (Math.PI / 2) + (1 - clampedEta) * Math.sqrt(Math.PI * Math.LN2));
};

// ═══════════════════════════════════════════
//  Pseudo-Voigt 拟合结果
// ═══════════════════════════════════════════

export interface PseudoVoigtResult {
    /** 精确峰位 (2θ) */
    x0: number;
    /** 峰振幅 */
    amplitude: number;
    /** 全半高宽 FWHM (degrees) */
    fwhm: number;
    /** 混合因子 η (0=纯高斯, 1=纯洛伦兹) */
    eta: number;
    /** 决定系数 R² */
    R2: number;
    /** 积分强度 */
    integralIntensity: number;
    /** 拟合曲线数据点 */
    fittedCurve: { x: number; y: number }[];
    /** 迭代次数 */
    iterations: number;
    /** 是否收敛 */
    converged: boolean;
}

// ═══════════════════════════════════════════
//  Levenberg-Marquardt 优化器
// ═══════════════════════════════════════════

interface LMOptions {
    /** 最大迭代次数 */
    maxIterations?: number;
    /** 收敛阈值（参数变化 < 此值则终止） */
    tolerance?: number;
    /** 初始阻尼因子 */
    lambda?: number;
    /** 阻尼调整倍率 */
    lambdaFactor?: number;
}

const DEFAULT_LM: Required<LMOptions> = {
    maxIterations: 100,
    tolerance: 1e-8,
    lambda: 0.001,
    lambdaFactor: 10,
};

/**
 * Levenberg-Marquardt 最小二乘优化
 * 拟合 model(x, params) 到数据 (xData, yData)
 * 
 * @param model 模型函数 (x, params) => y
 * @param xData X 数据
 * @param yData Y 数据
 * @param initialParams 初始参数猜测
 * @param options 优化选项
 * @returns 优化后的参数和状态
 */
export const levenbergMarquardt = (
    model: (x: number, params: number[]) => number,
    xData: number[],
    yData: number[],
    initialParams: number[],
    options?: LMOptions
): { params: number[]; iterations: number; converged: boolean; residuals: number[] } => {
    const opts = { ...DEFAULT_LM, ...options };
    const n = xData.length;
    const p = initialParams.length;
    let params = [...initialParams];
    let lambda = opts.lambda;

    // 计算残差向量
    const calcResiduals = (par: number[]): number[] =>
        xData.map((x, i) => yData[i] - model(x, par));

    // 计算残差平方和
    const calcSSR = (residuals: number[]): number =>
        residuals.reduce((sum, r) => sum + r * r, 0);

    // 数值雅可比矩阵 J[i][j] = ∂residual_i/∂param_j
    const calcJacobian = (par: number[]): number[][] => {
        const J: number[][] = [];
        const delta = 1e-7;
        for (let i = 0; i < n; i++) {
            J[i] = new Array(p);
        }
        for (let j = 0; j < p; j++) {
            const parPlus = [...par];
            parPlus[j] += delta;
            for (let i = 0; i < n; i++) {
                // J[i][j] = -∂(y_i - model)/∂p_j = ∂model/∂p_j
                J[i][j] = (model(xData[i], parPlus) - model(xData[i], par)) / delta;
            }
        }
        return J;
    };

    let residuals = calcResiduals(params);
    let ssr = calcSSR(residuals);
    let converged = false;
    let iter = 0;

    for (iter = 0; iter < opts.maxIterations; iter++) {
        const J = calcJacobian(params);

        // JᵀJ (p×p) 和 Jᵀr (p×1)
        const JtJ: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
        const Jtr: number[] = new Array(p).fill(0);

        for (let j = 0; j < p; j++) {
            for (let k = 0; k < p; k++) {
                let sum = 0;
                for (let i = 0; i < n; i++) sum += J[i][j] * J[i][k];
                JtJ[j][k] = sum;
            }
            let sum = 0;
            for (let i = 0; i < n; i++) sum += J[i][j] * residuals[i];
            Jtr[j] = sum;
        }

        // (JᵀJ + λ·diag(JᵀJ)) · δ = Jᵀr
        const A: number[][] = JtJ.map((row, j) =>
            row.map((val, k) => val + (j === k ? lambda * (val || 1) : 0))
        );

        // 高斯消元求解 δ
        const delta = solveLinear(A, Jtr);
        if (!delta) break; // 奇异矩阵

        const newParams = params.map((p, i) => p + delta[i]);
        // 强制约束 eta ∈ [0, 1], FWHM > 0, Amplitude > 0
        if (newParams.length >= 4) {
            newParams[1] = Math.max(0, newParams[1]); // A >= 0
            newParams[2] = Math.max(0.001, newParams[2]); // w > 0
            newParams[3] = Math.max(0, Math.min(1, newParams[3])); // eta ∈ [0,1]
        }

        const newResiduals = calcResiduals(newParams);
        const newSSR = calcSSR(newResiduals);

        if (newSSR < ssr) {
            // 接受更新，减小阻尼
            params = newParams;
            residuals = newResiduals;
            ssr = newSSR;
            lambda /= opts.lambdaFactor;

            // 检查收敛
            const maxDelta = Math.max(...delta.map(Math.abs));
            if (maxDelta < opts.tolerance) {
                converged = true;
                break;
            }
        } else {
            // 拒绝更新，增大阻尼
            lambda *= opts.lambdaFactor;
        }
    }

    return { params, iterations: iter, converged, residuals };
};

/** 高斯消元求解 Ax = b */
const solveLinear = (A: number[][], b: number[]): number[] | null => {
    const n = b.length;
    const aug: number[][] = A.map((row, i) => [...row, b[i]]);

    for (let col = 0; col < n; col++) {
        // 部分主元选取
        let maxRow = col;
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
        }
        [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

        if (Math.abs(aug[col][col]) < 1e-14) return null;

        // 消元
        for (let row = col + 1; row < n; row++) {
            const factor = aug[row][col] / aug[col][col];
            for (let j = col; j <= n; j++) aug[row][j] -= factor * aug[col][j];
        }
    }

    // 回代
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        x[i] = aug[i][n];
        for (let j = i + 1; j < n; j++) x[i] -= aug[i][j] * x[j];
        x[i] /= aug[i][i];
    }
    return x;
};

// ═══════════════════════════════════════════
//  高级拟合 API
// ═══════════════════════════════════════════

export interface FitPeakOptions {
    /** 拟合数据窗半径 (以峰中心为中心两侧各取多少个数据点) */
    windowHalfWidth?: number;
    /** LM 优化参数 */
    lmOptions?: LMOptions;
}

/**
 * 对单个峰执行 Pseudo-Voigt 拟合
 * 
 * @param xData 全谱 x 轴 (2θ)
 * @param yData 全谱 y 轴 (intensity)
 * @param centerIdx 峰中心在数组中的索引
 * @param options 拟合选项
 * @returns PseudoVoigtResult 拟合结果
 */
export const fitPseudoVoigt = (
    xData: number[],
    yData: number[],
    centerIdx: number,
    options?: FitPeakOptions
): PseudoVoigtResult => {
    const halfW = options?.windowHalfWidth ?? 25;
    const startIdx = Math.max(0, centerIdx - halfW);
    const endIdx = Math.min(xData.length - 1, centerIdx + halfW);

    // 提取窗口数据
    const windowX = xData.slice(startIdx, endIdx + 1);
    const windowY = yData.slice(startIdx, endIdx + 1);

    // 估算局部基线
    const baseline = Math.min(windowY[0], windowY[windowY.length - 1]);
    const baselineY = windowY.map(y => Math.max(0, y - baseline));

    // 初始参数猜测
    const peakY = baselineY[centerIdx - startIdx];
    const x0 = xData[centerIdx];

    // 估算 FWHM：从峰顶向两侧找半高宽
    const halfMax = peakY / 2;
    let leftIdx = centerIdx - startIdx;
    while (leftIdx > 0 && baselineY[leftIdx] >= halfMax) leftIdx--;
    let rightIdx = centerIdx - startIdx;
    while (rightIdx < baselineY.length - 1 && baselineY[rightIdx] >= halfMax) rightIdx++;
    const estimatedFwhm = Math.max(0.05, windowX[rightIdx] - windowX[leftIdx]);

    const initialParams = [x0, peakY, estimatedFwhm, 0.5]; // [x0, A, w, eta]

    // LM 拟合
    const result = levenbergMarquardt(
        pseudoVoigt,
        windowX,
        baselineY,
        initialParams,
        options?.lmOptions
    );

    const [fitX0, fitA, fitW, fitEta] = result.params;

    // 计算 R²
    const yMean = baselineY.reduce((s, y) => s + y, 0) / baselineY.length;
    const ssTot = baselineY.reduce((s, y) => s + (y - yMean) ** 2, 0);
    const ssRes = result.residuals.reduce((s, r) => s + r * r, 0);
    const R2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    // 生成拟合曲线（细粒度）
    const curvePoints = 200;
    const curveMinX = windowX[0];
    const curveMaxX = windowX[windowX.length - 1];
    const fittedCurve: { x: number; y: number }[] = [];
    for (let i = 0; i <= curvePoints; i++) {
        const cx = curveMinX + (curveMaxX - curveMinX) * (i / curvePoints);
        fittedCurve.push({ x: cx, y: pseudoVoigt(cx, result.params) + baseline });
    }

    return {
        x0: fitX0,
        amplitude: fitA,
        fwhm: Math.abs(fitW),
        eta: Math.max(0, Math.min(1, fitEta)),
        R2: Math.max(0, R2),
        integralIntensity: pseudoVoigtIntegral(fitA, Math.abs(fitW), fitEta),
        fittedCurve,
        iterations: result.iterations,
        converged: result.converged,
    };
};

/**
 * 对全谱所有峰批量拟合
 * 
 * @param xData 全谱 x 轴
 * @param yData 全谱 y 轴
 * @param peakIndices 峰中心索引数组
 * @returns 每个峰的拟合结果
 */
export const fitAllPeaks = (
    xData: number[],
    yData: number[],
    peakIndices: number[],
    options?: FitPeakOptions
): PseudoVoigtResult[] => {
    return peakIndices.map(idx => fitPseudoVoigt(xData, yData, idx, options));
};

/**
 * 计算全谱拟合残差
 * residual[i] = yData[i] - Σ fittedPeak_j(xData[i])
 * 
 * @param xData 全谱 x
 * @param yData 全谱 y (原始)
 * @param fitResults 各峰拟合结果
 * @returns 残差数组 { x, residual }[]
 */
export const calculateFullSpectrumResidual = (
    xData: number[],
    yData: number[],
    fitResults: PseudoVoigtResult[]
): { x: number; residual: number }[] => {
    // 估算全局基线（使用所有拟合窗口外的最低值区域）
    const baseline = Math.min(
        ...yData.slice(0, 10),
        ...yData.slice(-10)
    );

    return xData.map((x, i) => {
        const yCalc = fitResults.reduce(
            (sum, fit) => sum + pseudoVoigt(x, [fit.x0, fit.amplitude, fit.fwhm, fit.eta]),
            baseline
        );
        return { x, residual: yData[i] - yCalc };
    });
};
