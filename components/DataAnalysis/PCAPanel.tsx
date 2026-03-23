import React, { useState, useCallback, useMemo } from 'react';
import FixedPortal from './FixedPortal';
import { DataSeries } from '../../types';

interface PCAPanelProps {
  seriesList: DataSeries[];
}

interface PCAResult {
  eigenvalues: number[];
  varianceExplained: number[];
  cumulativeVariance: number[];
  scores: number[][]; // n×k 矩阵 (每行=观测, 每列=PC)
  loadings: number[][]; // p×k 矩阵 (每行=原始变量, 每列=PC)
  scaleInfo: { mean: number[]; std: number[] };
}

/**
 * PCA 主成分分析面板 — 对多个数据系列执行 PCA
 * 将每个系列视为矩阵的一列 (变量维度)
 */
const PCAPanel: React.FC<PCAPanelProps> = ({ seriesList }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [result, setResult] = useState<PCAResult | null>(null);
  const [showView, setShowView] = useState<'eigenvalues' | 'scores' | 'loadings'>('eigenvalues');

  const runPCA = useCallback(() => {
    if (seriesList.length < 2) return;

    // 构造数据矩阵: n行(观测) x p列(变量)
    // 以最短系列長度为行数，每个系列为一列
    const minLen = Math.min(...seriesList.map(s => s.data.length));
    const p = seriesList.length;
    const n = minLen;

    if (n < 2 || p < 2) return;

    // 构造矩阵
    const X: number[][] = [];
    for (let i = 0; i < n; i++) {
      X.push(seriesList.map(s => s.data[i]?.value ?? 0));
    }

    // 标准化 (Z-score)
    const means = Array(p).fill(0);
    const stds = Array(p).fill(0);

    for (let j = 0; j < p; j++) {
      for (let i = 0; i < n; i++) means[j] += X[i][j];
      means[j] /= n;
    }

    for (let j = 0; j < p; j++) {
      for (let i = 0; i < n; i++) stds[j] += (X[i][j] - means[j]) ** 2;
      stds[j] = Math.sqrt(stds[j] / (n - 1)) || 1;
    }

    const Z: number[][] = X.map(row => row.map((v, j) => (v - means[j]) / stds[j]));

    // 计算协方差矩阵 (p×p)
    const cov: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
    for (let i = 0; i < p; i++) {
      for (let j = i; j < p; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) sum += Z[k][i] * Z[k][j];
        cov[i][j] = cov[j][i] = sum / (n - 1);
      }
    }

    // 特征值分解 (Jacobi 迭代)
    const { eigenvalues, eigenvectors } = jacobiEigen(cov);

    // 按特征值降序排列
    const indices = eigenvalues.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v).map(d => d.i);
    const sortedEigenvals = indices.map(i => Math.max(0, eigenvalues[i]));
    const sortedVectors: number[][] = indices.map(i => eigenvectors.map(row => row[i]));

    // 方差解释率
    const totalVar = sortedEigenvals.reduce((s, v) => s + v, 0) || 1;
    const varExpl = sortedEigenvals.map(v => v / totalVar);
    const cumVar: number[] = [];
    varExpl.reduce((s, v) => { const c = s + v; cumVar.push(c); return c; }, 0);

    // 主成分得分 (n×k)
    const scores: number[][] = Z.map(row => sortedVectors.map(vec => vec.reduce((s, v, j) => s + v * row[j], 0)));

    // 载荷 (p×k)
    const loadings: number[][] = Array.from({ length: p }, (_, i) =>
      sortedVectors.map(vec => vec[i])
    );

    setResult({
      eigenvalues: sortedEigenvals,
      varianceExplained: varExpl,
      cumulativeVariance: cumVar,
      scores,
      loadings,
      scaleInfo: { mean: means, std: stds },
    });
  }, [seriesList]);

  const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'];

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border bg-white text-violet-600 border-violet-200 hover:bg-violet-600 hover:text-white active:scale-95 flex items-center gap-1.5 shadow-sm"
      >
        <i className="fa-solid fa-diagram-project text-[10px]" /> PCA
      </button>
    );
  }

  return (
    <FixedPortal onClose={() => setIsExpanded(false)}>
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-white rounded-2xl shadow-2xl border border-slate-200 w-[420px] p-5 animate-reveal max-h-[80vh] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-slate-800 uppercase italic flex items-center gap-2">
          <i className="fa-solid fa-diagram-project text-violet-500" /> PCA 主成分分析
        </h3>
        <button onClick={() => setIsExpanded(false)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </div>

      <p className="text-[9px] text-slate-400 mb-3">
        将 {seriesList.length} 个数据系列作为变量维度执行 PCA 降维分析
      </p>

      <button
        onClick={runPCA}
        disabled={seriesList.length < 2}
        className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-xs font-black uppercase shadow-lg active:scale-95 transition-all disabled:opacity-50 mb-3"
      >
        <i className="fa-solid fa-bolt mr-1.5" /> 执行 PCA
      </button>

      {result && (
        <div className="animate-reveal">
          {/* 视图切换 */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-3">
            {([['eigenvalues', '碎石图'], ['scores', '得分图'], ['loadings', '载荷表']] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setShowView(v)}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${showView === v ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400'}`}
              >
                {l}
              </button>
            ))}
          </div>

          {showView === 'eigenvalues' && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <svg viewBox="0 0 360 200" className="w-full">
                {result.eigenvalues.map((ev, i) => {
                  const barW = Math.min(40, 300 / result.eigenvalues.length);
                  const maxEv = result.eigenvalues[0] || 1;
                  const h = (ev / maxEv) * 150;
                  const x = 30 + i * (barW + 5);
                  return (
                    <g key={i}>
                      <rect x={x} y={180 - h} width={barW} height={h} fill={COLORS[i % COLORS.length]} rx={3} opacity={0.8} />
                      <text x={x + barW / 2} y={195} textAnchor="middle" fontSize={8} fill="#94a3b8" fontWeight={700}>PC{i + 1}</text>
                      <text x={x + barW / 2} y={175 - h} textAnchor="middle" fontSize={7} fill="#64748b" fontWeight={700}>
                        {(result.varianceExplained[i] * 100).toFixed(1)}%
                      </text>
                    </g>
                  );
                })}
                {/* 累积线 */}
                {result.cumulativeVariance.map((cv, i) => {
                  const barW = Math.min(40, 300 / result.eigenvalues.length);
                  const x = 30 + i * (barW + 5) + barW / 2;
                  const y = 180 - cv * 150;
                  const next = result.cumulativeVariance[i + 1];
                  return (
                    <g key={`cum_${i}`}>
                      <circle cx={x} cy={y} r={3} fill="#dc2626" />
                      {next !== undefined && (
                        <line x1={x} y1={y} x2={30 + (i + 1) * (barW + 5) + barW / 2} y2={180 - next * 150} stroke="#dc2626" strokeWidth={1.5} />
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {showView === 'scores' && result.scores.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <svg viewBox="0 0 360 280" className="w-full">
                {(() => {
                  const pc1 = result.scores.map(r => r[0]);
                  const pc2 = result.scores.map(r => r[1] ?? 0);
                  const x1 = Math.min(...pc1), x2 = Math.max(...pc1);
                  const y1 = Math.min(...pc2), y2 = Math.max(...pc2);
                  const xRng = x2 - x1 || 1, yRng = y2 - y1 || 1;
                  const pad = 35;
                  return (
                    <g>
                      {/* 轴 */}
                      <line x1={pad} y1={pad} x2={pad} y2={250} stroke="#e2e8f0" strokeWidth={1} />
                      <line x1={pad} y1={250} x2={340} y2={250} stroke="#e2e8f0" strokeWidth={1} />
                      <text x={190} y={275} textAnchor="middle" fontSize={9} fontWeight={700} fill="#475569">PC1 ({(result.varianceExplained[0] * 100).toFixed(1)}%)</text>
                      <text x={8} y={140} textAnchor="middle" fontSize={9} fontWeight={700} fill="#475569" transform="rotate(-90,8,140)">PC2 ({(result.varianceExplained[1] * 100 || 0).toFixed(1)}%)</text>
                      {/* 点 */}
                      {result.scores.map((s, i) => (
                        <circle
                          key={i}
                          cx={pad + ((s[0] - x1) / xRng) * (305 - pad)}
                          cy={250 - ((s[1] ?? 0 - y1) / yRng) * (215)}
                          r={2.5}
                          fill="#6366f1"
                          opacity={0.6}
                        />
                      ))}
                    </g>
                  );
                })()}
              </svg>
            </div>
          )}

          {showView === 'loadings' && (
            <div className="overflow-x-auto">
              <table className="w-full text-[9px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="px-2 py-1.5 text-left font-black text-slate-500">变量</th>
                    {result.eigenvalues.slice(0, 4).map((_, i) => (
                      <th key={i} className="px-2 py-1.5 text-center font-black text-violet-600">PC{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.loadings.map((row, i) => (
                    <tr key={i} className="border-t border-slate-50">
                      <td className="px-2 py-1.5 font-bold text-slate-600">{seriesList[i]?.name || `Var ${i + 1}`}</td>
                      {row.slice(0, 4).map((v, j) => (
                        <td key={j} className={`px-2 py-1.5 text-center font-mono font-bold ${Math.abs(v) > 0.5 ? 'text-violet-600' : 'text-slate-400'}`}>
                          {v.toFixed(4)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 汇总 */}
          <div className="mt-3 flex gap-2">
            {result.eigenvalues.slice(0, 3).map((ev, i) => (
              <div key={i} className="flex-1 bg-white rounded-lg p-2 text-center border border-slate-100">
                <div className="text-[7px] font-black text-slate-400">PC{i + 1}</div>
                <div className="text-xs font-black font-mono text-violet-600">{(result.varianceExplained[i] * 100).toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </FixedPortal>
  );
};

/** Jacobi 特征值分解 */
function jacobiEigen(matrix: number[][]): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = matrix.length;
  const A = matrix.map(r => [...r]);
  const V: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));

  for (let sweep = 0; sweep < 100; sweep++) {
    let offDiag = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        offDiag += A[i][j] ** 2;

    if (offDiag < 1e-12) break;

    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-15) continue;

        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = t * c;

        // Rotate A
        const App = A[p][p], Aqq = A[q][q], Apq = A[p][q];
        A[p][p] = c * c * App - 2 * s * c * Apq + s * s * Aqq;
        A[q][q] = s * s * App + 2 * s * c * Apq + c * c * Aqq;
        A[p][q] = A[q][p] = 0;

        for (let r = 0; r < n; r++) {
          if (r === p || r === q) continue;
          const Arp = A[r][p], Arq = A[r][q];
          A[r][p] = A[p][r] = c * Arp - s * Arq;
          A[r][q] = A[q][r] = s * Arp + c * Arq;
        }

        for (let r = 0; r < n; r++) {
          const Vrp = V[r][p], Vrq = V[r][q];
          V[r][p] = c * Vrp - s * Vrq;
          V[r][q] = s * Vrp + c * Vrq;
        }
      }
    }
  }

  const eigenvalues = A.map((_, i) => A[i][i]);
  return { eigenvalues, eigenvectors: V };
}

export default PCAPanel;
