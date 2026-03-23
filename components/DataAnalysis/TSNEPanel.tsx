import React, { useState, useCallback } from 'react';
import FixedPortal from './FixedPortal';
import { DataSeries } from '../../types';

interface TSNEPanelProps {
  seriesList: DataSeries[];
}

interface TSNEResult {
  points: { x: number; y: number; label: string; color: string }[];
  iterations: number;
}

/**
 * t-SNE 降维可视化面板
 * 将多维数据系列降维到 2D 散点图
 */
const TSNEPanel: React.FC<TSNEPanelProps> = ({ seriesList }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [perplexity, setPerplexity] = useState(30);
  const [maxIter, setMaxIter] = useState(300);
  const [learningRate, setLearningRate] = useState(200);
  const [result, setResult] = useState<TSNEResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];

  const runTSNE = useCallback(() => {
    if (seriesList.length < 2) return;
    setIsRunning(true);

    // 构造数据矩阵：每个系列的 Y 值作为一个高维点
    // n = 数据点数 (行), d = 系列数 (列维度)
    const minLen = Math.min(...seriesList.map(s => s.data.length));
    const n = minLen;
    const d = seriesList.length;

    if (n < 4) { setIsRunning(false); return; }

    // X[i][j] = 第 i 个观测在第 j 个变量上的值
    const X: number[][] = [];
    for (let i = 0; i < n; i++) {
      X.push(seriesList.map(s => s.data[i]?.value ?? 0));
    }

    // t-SNE 核心
    const embedding = tsne2D(X, Math.min(perplexity, Math.floor(n / 3) || 1), maxIter, learningRate);

    const points = embedding.map((p, i) => ({
      x: p[0],
      y: p[1],
      label: `#${i + 1}`,
      color: COLORS[i % COLORS.length],
    }));

    setResult({ points, iterations: maxIter });
    setIsRunning(false);
  }, [seriesList, perplexity, maxIter, learningRate]);

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border bg-white text-cyan-600 border-cyan-200 hover:bg-cyan-600 hover:text-white active:scale-95 flex items-center gap-1.5 shadow-sm"
      >
        <i className="fa-solid fa-braille text-[10px]" /> t-SNE
      </button>
    );
  }

  return (
    <FixedPortal onClose={() => setIsExpanded(false)}>
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-white rounded-2xl shadow-2xl border border-slate-200 w-[420px] p-5 animate-reveal max-h-[80vh] overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-slate-800 uppercase italic flex items-center gap-2">
          <i className="fa-solid fa-braille text-cyan-500" /> t-SNE 降维
        </h3>
        <button onClick={() => setIsExpanded(false)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </div>

      <p className="text-[9px] text-slate-400 mb-3">
        将 {seriesList.length} 维 × {Math.min(...seriesList.map(s => s.data.length))} 个观测降到 2D 散点
      </p>

      {/* 参数 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <label className="text-[7px] font-black text-slate-400 uppercase block mb-0.5">Perplexity</label>
          <input type="number" value={perplexity} onChange={e => setPerplexity(parseInt(e.target.value) || 5)}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-mono text-center bg-white outline-none focus:border-cyan-400" />
        </div>
        <div>
          <label className="text-[7px] font-black text-slate-400 uppercase block mb-0.5">迭代次数</label>
          <input type="number" value={maxIter} onChange={e => setMaxIter(parseInt(e.target.value) || 100)}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-mono text-center bg-white outline-none focus:border-cyan-400" />
        </div>
        <div>
          <label className="text-[7px] font-black text-slate-400 uppercase block mb-0.5">学习率</label>
          <input type="number" value={learningRate} onChange={e => setLearningRate(parseInt(e.target.value) || 50)}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-mono text-center bg-white outline-none focus:border-cyan-400" />
        </div>
      </div>

      <button
        onClick={runTSNE}
        disabled={isRunning || seriesList.length < 2}
        className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl text-xs font-black uppercase shadow-lg active:scale-95 transition-all disabled:opacity-50 mb-3"
      >
        {isRunning ? (
          <><i className="fa-solid fa-spinner fa-spin mr-1.5" /> 计算中...</>
        ) : (
          <><i className="fa-solid fa-bolt mr-1.5" /> 执行 t-SNE</>
        )}
      </button>

      {result && result.points.length > 0 && (
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 animate-reveal">
          <svg viewBox="0 0 360 300" className="w-full">
            {(() => {
              const xs = result.points.map(p => p.x);
              const ys = result.points.map(p => p.y);
              const xMin = Math.min(...xs), xMax = Math.max(...xs);
              const yMin = Math.min(...ys), yMax = Math.max(...ys);
              const xRng = xMax - xMin || 1, yRng = yMax - yMin || 1;
              const pad = 30;
              const w = 360 - 2 * pad, h = 260 - pad;

              return (
                <g>
                  {/* 网格 */}
                  {[0, 0.25, 0.5, 0.75, 1].map(t => (
                    <g key={t}>
                      <line x1={pad} y1={pad + t * h} x2={pad + w} y2={pad + t * h} stroke="#f1f5f9" strokeWidth={0.5} />
                      <line x1={pad + t * w} y1={pad} x2={pad + t * w} y2={pad + h} stroke="#f1f5f9" strokeWidth={0.5} />
                    </g>
                  ))}
                  {/* 轴 */}
                  <line x1={pad} y1={pad + h} x2={pad + w} y2={pad + h} stroke="#cbd5e1" strokeWidth={0.8} />
                  <line x1={pad} y1={pad} x2={pad} y2={pad + h} stroke="#cbd5e1" strokeWidth={0.8} />
                  <text x={pad + w / 2} y={pad + h + 20} textAnchor="middle" fontSize={9} fontWeight={700} fill="#475569">t-SNE 1</text>
                  <text x={10} y={pad + h / 2} textAnchor="middle" fontSize={9} fontWeight={700} fill="#475569" transform={`rotate(-90, 10, ${pad + h / 2})`}>t-SNE 2</text>

                  {/* 点 */}
                  {result.points.map((p, i) => {
                    const cx = pad + ((p.x - xMin) / xRng) * w;
                    const cy = pad + h - ((p.y - yMin) / yRng) * h;
                    return (
                      <g key={i}>
                        <circle cx={cx} cy={cy} r={4} fill={p.color} opacity={0.7} stroke="#fff" strokeWidth={0.5} />
                        {result.points.length <= 40 && (
                          <text x={cx + 6} y={cy + 3} fontSize={6} fill="#94a3b8" fontWeight={600}>{p.label}</text>
                        )}
                      </g>
                    );
                  })}
                </g>
              );
            })()}
          </svg>

          <div className="flex justify-between text-[8px] text-slate-400 mt-1">
            <span>{result.points.length} 个点</span>
            <span>perplexity={perplexity} | iter={result.iterations}</span>
          </div>
        </div>
      )}
    </div>
    </FixedPortal>
  );
};

// ═══════════════════════════════════════
//  t-SNE 核心算法 (Barnes-Hut 简化版)
// ═══════════════════════════════════════

function tsne2D(X: number[][], perplexity: number, maxIter: number, lr: number): number[][] {
  const n = X.length;
  const d = X[0].length;

  // 计算欧氏距离矩阵
  const dist: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      let s = 0;
      for (let k = 0; k < d; k++) s += (X[i][k] - X[j][k]) ** 2;
      dist[i][j] = dist[j][i] = s;
    }

  // 高维条件概率 P (使用二分搜索找 σ)
  const P: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  const logPerp = Math.log(perplexity);

  for (let i = 0; i < n; i++) {
    let lo = 1e-10, hi = 1e10, sigma = 1;

    for (let iter = 0; iter < 50; iter++) {
      sigma = (lo + hi) / 2;
      let sumP = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        P[i][j] = Math.exp(-dist[i][j] / (2 * sigma * sigma));
        sumP += P[i][j];
      }
      if (sumP === 0) sumP = 1e-10;

      let H = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        P[i][j] /= sumP;
        if (P[i][j] > 1e-10) H -= P[i][j] * Math.log(P[i][j]);
      }

      if (H > logPerp) hi = sigma;
      else lo = sigma;

      if (Math.abs(H - logPerp) < 1e-5) break;
    }
  }

  // 对称化 P
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const sym = (P[i][j] + P[j][i]) / (2 * n);
      P[i][j] = P[j][i] = Math.max(sym, 1e-12);
    }

  // 初始化低维嵌入 Y (随机)
  const Y: number[][] = Array.from({ length: n }, () => [
    (Math.random() - 0.5) * 0.01,
    (Math.random() - 0.5) * 0.01,
  ]);

  const gains: number[][] = Array.from({ length: n }, () => [1, 1]);
  const yInc: number[][] = Array.from({ length: n }, () => [0, 0]);

  // 梯度下降
  for (let iter = 0; iter < maxIter; iter++) {
    // 计算低维距离和 Q
    const Q: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    let sumQ = 0;

    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const dij = (Y[i][0] - Y[j][0]) ** 2 + (Y[i][1] - Y[j][1]) ** 2;
        Q[i][j] = Q[j][i] = 1 / (1 + dij);
        sumQ += 2 * Q[i][j];
      }
    sumQ = Math.max(sumQ, 1e-10);

    // 归一化 Q
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        Q[i][j] = Math.max(Q[i][j] / sumQ, 1e-12);

    // 梯度
    const grad: number[][] = Array.from({ length: n }, () => [0, 0]);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const mult = 4 * (P[i][j] - Q[i][j]) * Q[i][j] * sumQ;
        grad[i][0] += mult * (Y[i][0] - Y[j][0]);
        grad[i][1] += mult * (Y[i][1] - Y[j][1]);
      }

    // 自适应学习率
    const momentum = iter < 250 ? 0.5 : 0.8;
    for (let i = 0; i < n; i++)
      for (let k = 0; k < 2; k++) {
        gains[i][k] = Math.max(0.01,
          (Math.sign(grad[i][k]) !== Math.sign(yInc[i][k])) ? gains[i][k] + 0.2 : gains[i][k] * 0.8
        );
        yInc[i][k] = momentum * yInc[i][k] - lr * gains[i][k] * grad[i][k];
        Y[i][k] += yInc[i][k];
      }

    // 零均值化
    const meanY = [0, 0];
    for (let i = 0; i < n; i++) { meanY[0] += Y[i][0]; meanY[1] += Y[i][1]; }
    meanY[0] /= n; meanY[1] /= n;
    for (let i = 0; i < n; i++) { Y[i][0] -= meanY[0]; Y[i][1] -= meanY[1]; }
  }

  return Y;
}

export default TSNEPanel;
