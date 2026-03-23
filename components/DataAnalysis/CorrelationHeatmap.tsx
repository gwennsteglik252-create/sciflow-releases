import React, { useState, useCallback, useMemo } from 'react';
import FixedPortal from './FixedPortal';
import { DataSeries } from '../../types';

interface CorrelationHeatmapProps {
  seriesList: DataSeries[];
}

type CorrMethod = 'pearson' | 'spearman';

/**
 * 相关性热图 — 计算多系列间的 Pearson/Spearman 相关系数并渲染热图
 */
const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({ seriesList }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [method, setMethod] = useState<CorrMethod>('pearson');
  const [matrix, setMatrix] = useState<number[][] | null>(null);

  const runCorrelation = useCallback(() => {
    if (seriesList.length < 2) return;

    const n = Math.min(...seriesList.map(s => s.data.length));
    const cols = seriesList.map(s => s.data.slice(0, n).map(d => d.value));

    const mat: number[][] = [];
    for (let i = 0; i < cols.length; i++) {
      const row: number[] = [];
      for (let j = 0; j < cols.length; j++) {
        row.push(method === 'pearson'
          ? pearsonCorr(cols[i], cols[j])
          : spearmanCorr(cols[i], cols[j])
        );
      }
      mat.push(row);
    }
    setMatrix(mat);
  }, [seriesList, method]);

  const colorForValue = (v: number): string => {
    // 蓝(-1) → 白(0) → 红(1)
    const t = (v + 1) / 2; // 0-1 归一化
    if (t < 0.5) {
      const s = t * 2;
      return `rgb(${Math.round(59 + s * 196)}, ${Math.round(130 + s * 125)}, ${Math.round(246 - s * 100)})`;
    } else {
      const s = (t - 0.5) * 2;
      return `rgb(${Math.round(255)}, ${Math.round(255 - s * 175)}, ${Math.round(146 - s * 146)})`;
    }
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border bg-white text-orange-600 border-orange-200 hover:bg-orange-600 hover:text-white active:scale-95 flex items-center gap-1.5 shadow-sm"
      >
        <i className="fa-solid fa-table-cells text-[10px]" /> 热图
      </button>
    );
  }

  const cellSize = seriesList.length > 6 ? 36 : 48;
  const labelW = 60;
  const svgW = labelW + seriesList.length * cellSize + 20;
  const svgH = 30 + seriesList.length * cellSize + 20;

  return (
    <FixedPortal onClose={() => setIsExpanded(false)}>
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-white rounded-2xl shadow-2xl border border-slate-200 w-[460px] p-5 animate-reveal max-h-[80vh] overflow-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-slate-800 uppercase italic flex items-center gap-2">
          <i className="fa-solid fa-table-cells text-orange-500" /> 相关性热图
        </h3>
        <button onClick={() => setIsExpanded(false)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex bg-slate-100 p-1 rounded-xl flex-1">
          {(['pearson', 'spearman'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${method === m ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400'}`}
            >
              {m === 'pearson' ? 'Pearson' : 'Spearman'}
            </button>
          ))}
        </div>
        <button
          onClick={runCorrelation}
          disabled={seriesList.length < 2}
          className="px-4 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all disabled:opacity-50"
        >
          <i className="fa-solid fa-bolt mr-1" /> 计算
        </button>
      </div>

      {matrix && (
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 overflow-x-auto animate-reveal">
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ minWidth: svgW * 0.7 }}>
            {/* 列标题 */}
            {seriesList.map((s, j) => (
              <text
                key={`col_${j}`}
                x={labelW + j * cellSize + cellSize / 2}
                y={22}
                textAnchor="middle"
                fontSize={7}
                fontWeight={700}
                fill="#64748b"
              >
                {s.name.length > 8 ? s.name.slice(0, 8) + '…' : s.name}
              </text>
            ))}

            {matrix.map((row, i) => (
              <g key={`row_${i}`}>
                {/* 行标题 */}
                <text
                  x={labelW - 4}
                  y={30 + i * cellSize + cellSize / 2 + 3}
                  textAnchor="end"
                  fontSize={7}
                  fontWeight={700}
                  fill="#64748b"
                >
                  {seriesList[i]?.name.length > 8 ? seriesList[i].name.slice(0, 8) + '…' : seriesList[i]?.name}
                </text>

                {row.map((v, j) => (
                  <g key={`cell_${i}_${j}`}>
                    <rect
                      x={labelW + j * cellSize}
                      y={30 + i * cellSize}
                      width={cellSize - 1}
                      height={cellSize - 1}
                      fill={colorForValue(v)}
                      rx={4}
                      opacity={0.85}
                    />
                    <text
                      x={labelW + j * cellSize + cellSize / 2}
                      y={30 + i * cellSize + cellSize / 2 + 3}
                      textAnchor="middle"
                      fontSize={i === j ? 7 : 8}
                      fontWeight={800}
                      fill={Math.abs(v) > 0.5 ? '#1e293b' : '#94a3b8'}
                    >
                      {v.toFixed(2)}
                    </text>
                  </g>
                ))}
              </g>
            ))}

            {/* 色标 */}
            <defs>
              <linearGradient id="corrGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="50%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
            <rect x={labelW} y={svgH - 15} width={seriesList.length * cellSize} height={8} fill="url(#corrGrad)" rx={4} />
            <text x={labelW} y={svgH - 1} fontSize={6} fill="#94a3b8" fontWeight={700}>-1</text>
            <text x={labelW + seriesList.length * cellSize / 2} y={svgH - 1} textAnchor="middle" fontSize={6} fill="#94a3b8" fontWeight={700}>0</text>
            <text x={labelW + seriesList.length * cellSize} y={svgH - 1} textAnchor="end" fontSize={6} fill="#94a3b8" fontWeight={700}>+1</text>
          </svg>
        </div>
      )}
    </div>
    </FixedPortal>
  );
};

// ═══════════════════════════════════
//  相关系数计算
// ═══════════════════════════════════

function pearsonCorr(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  let sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i]; sy += y[i];
    sxy += x[i] * y[i];
    sx2 += x[i] * x[i]; sy2 += y[i] * y[i];
  }
  const num = n * sxy - sx * sy;
  const den = Math.sqrt((n * sx2 - sx * sx) * (n * sy2 - sy * sy));
  return den === 0 ? 0 : num / den;
}

function spearmanCorr(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  const rankX = ranks(x.slice(0, n));
  const rankY = ranks(y.slice(0, n));
  return pearsonCorr(rankX, rankY);
}

function ranks(arr: number[]): number[] {
  const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const result = new Array(arr.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length - 1 && indexed[j + 1].v === indexed[j].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) result[indexed[k].i] = avgRank;
    i = j + 1;
  }
  return result;
}

export default CorrelationHeatmap;
