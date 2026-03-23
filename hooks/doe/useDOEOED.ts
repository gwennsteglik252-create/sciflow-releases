
import { useMemo, useState } from 'react';
import { DOEFactor, DOEResponse } from '../../types';
import { L9_MATRIX, L4_MATRIX, ANCHOR_MATRIX, IntensityMode } from '../../components/DOE/constants';

export const useDOEOED = (factors: DOEFactor[], responses: DOEResponse[], intensityMode: IntensityMode) => {
  const [oedResults, setOedResults] = useState<Record<number, string>>({});
  const [oedFactorOverrides, setOedFactorOverrides] = useState<Record<string, string>>({});

  const currentMatrix = useMemo(() => {
    if (intensityMode === 'screening') return L4_MATRIX;
    if (intensityMode === 'ai_inspired') return ANCHOR_MATRIX;
    return L9_MATRIX;
  }, [intensityMode]);

  const activeFactors = useMemo(() => factors.slice(0, intensityMode === 'screening' ? 3 : 4), [factors, intensityMode]);

  const getPhysicalValue = (factor: DOEFactor, level: number) => {
    if (intensityMode === 'screening') return level === 1 ? factor.min : factor.max;
    if (level === 1) return factor.min;
    if (level === 3) return factor.max;
    return parseFloat(((factor.min + factor.max) / 2).toFixed(2));
  };

  const getFactorDisplayValue = (rIdx: number, fIdx: number, factor: DOEFactor, level: number) => {
    const override = oedFactorOverrides[`${rIdx}-${fIdx}`];
    if (override !== undefined) return override;
    return getPhysicalValue(factor, level).toString();
  };

  const rangeAnalysis = useMemo(() => {
    if (intensityMode !== 'standard' || activeFactors.length === 0) return null;
    const kValues: Record<string, { k1: number, k2: number, k3: number, r: number }> = {};
    let totalR = 0;
    activeFactors.forEach((f, fIdx) => {
      let sum1 = 0, sum2 = 0, sum3 = 0, count = 0;
      currentMatrix.forEach((row, rIdx) => {
        const val = parseFloat(String(oedResults[rIdx] || '0'));
        const level = row[fIdx];
        if (level === 1) sum1 += val;
        if (level === 2) sum2 += val;
        if (level === 3) sum3 += val;
        count++;
      });
      const k1 = sum1 / (currentMatrix.length / 3); 
      const k2 = sum2 / (currentMatrix.length / 3); 
      const k3 = sum3 / (currentMatrix.length / 3);
      const r = Math.max(k1, k2, k3) - Math.min(k1, k2, k3);
      kValues[f.name] = { k1, k2, k3, r }; 
      totalR += r;
    });
    return { kValues, totalR };
  }, [oedResults, activeFactors, intensityMode, currentMatrix]);

  const paretoAnalysis = useMemo(() => {
    if (intensityMode !== 'screening' || activeFactors.length === 0) return null;
    let filledCount = 0;
    Object.values(oedResults).forEach((v) => { if (v && !isNaN(parseFloat(v as string))) filledCount++; });
    const data = activeFactors.map((f, fIdx) => {
      let sum1 = 0, count1 = 0, sum2 = 0, count2 = 0;
      currentMatrix.forEach((row, rIdx) => {
        const val = parseFloat(String(oedResults[rIdx] || '0'));
        const level = row[fIdx];
        if (level === 1) { sum1 += val; count1++; }
        if (level === 2) { sum2 += val; count2++; }
      });
      const avg1 = count1 > 0 ? sum1 / count1 : 0;
      const avg2 = count2 > 0 ? sum2 / count2 : 0;
      return { name: f.name, focus: Math.abs(avg2 - avg1) };
    }).sort((a, b) => (b.focus || 0) - (a.focus || 0));
    const totalEffect = data.reduce((sum, item) => sum + (item.focus || 0), 0);
    return { 
        chartData: data.map(item => ({ ...item, effect: item.focus || 0, percentage: totalEffect > 0 ? ((item.focus || 0) / totalEffect) * 100 : 0 })), 
        totalEffect, 
        progress: (filledCount / currentMatrix.length) * 100 
    };
  }, [oedResults, activeFactors, intensityMode, currentMatrix]);

  // --- 性能优化核心：本地响应面插值引擎 ---
  const surfacePrediction = useMemo(() => {
    if (intensityMode !== 'ai_inspired' || activeFactors.length < 2) return null;
    
    // 1. 提取已知数据点 (归一化坐标)
    const points = currentMatrix.map((row, rIdx) => {
      const val = parseFloat(String(oedResults[rIdx] || ''));
      if (isNaN(val)) return null;
      return { 
        x: (row[0] - 1) / 2, // 归一化到 0-1
        y: (row[1] - 1) / 2, 
        z: val 
      };
    }).filter(Boolean) as {x: number, y: number, z: number}[];

    if (points.length < 2) return { gridData: [], points, progress: (points.length / currentMatrix.length) * 100 };

    // 2. 本地解算 10x10 预测网格 (IDW算法)
    const gridData = [];
    const gridSize = 10;
    for (let gy = 0; gy < gridSize; gy++) {
        for (let gx = 0; gx < gridSize; gx++) {
            const tx = gx / (gridSize - 1);
            const ty = gy / (gridSize - 1);
            
            let numerator = 0;
            let denominator = 0;
            let exactMatch = null;

            for (const p of points) {
                const dist = Math.hypot(p.x - tx, p.y - ty);
                if (dist < 0.001) { exactMatch = p.z; break; }
                const weight = 1 / (dist * dist);
                numerator += p.z * weight;
                denominator += weight;
            }
            
            gridData.push({ 
                x: tx, 
                y: ty, 
                z: exactMatch !== null ? exactMatch : (numerator / denominator) 
            });
        }
    }

    return { 
        gridData, 
        points, 
        progress: (points.length / currentMatrix.length) * 100 
    };
  }, [oedResults, intensityMode, currentMatrix, activeFactors]);

  const syncOEDToHistory = (history: any[], responses: any[], updateDoeSession: any, setShowOEDModal: any) => {
      const newRuns = currentMatrix.map((row, rIdx) => {
          const val = parseFloat(String(oedResults[rIdx] || '0'));
          if (isNaN(val)) return null;
          const rFactors: Record<string, number> = {};
          activeFactors.forEach((f, fIdx) => {
              const valStr = oedFactorOverrides[`${rIdx}-${fIdx}`];
              rFactors[f.name] = (typeof valStr === 'string' && valStr !== '') ? parseFloat(valStr) : getPhysicalValue(f, row[fIdx]);
          });
          return { factors: rFactors, responses: { [responses[0]?.name || 'Result']: val } };
      }).filter(Boolean) as any[];
      
      if (newRuns.length < currentMatrix.length) {
          alert(`请先完成数据录入（共 ${currentMatrix.length} 组）。`);
          return;
      }
      
      updateDoeSession({ history: [...history, ...newRuns] });
      setShowOEDModal(false);
      setOedResults({});
      setOedFactorOverrides({});
  };

  return {
    oedResults, setOedResults,
    oedFactorOverrides, setOedFactorOverrides,
    currentMatrix, activeFactors,
    getPhysicalValue, getFactorDisplayValue,
    rangeAnalysis, paretoAnalysis, surfacePrediction,
    syncOEDToHistory
  };
};
