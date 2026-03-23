import React, { useState, useCallback } from 'react';
import FixedPortal from './FixedPortal';
import { DataSeries, ChartDataPoint } from '../../types';
import { computeFFT } from '../../utils/statisticalTests';

interface FFTPanelProps {
  seriesList: DataSeries[];
  onAddSeries: (series: DataSeries) => void;
}

const FFTPanel: React.FC<FFTPanelProps> = ({ seriesList, onAddSeries }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [result, setResult] = useState<{ freq: number[]; mag: number[]; domFreq: number; domAmp: number } | null>(null);

  const executeFFT = useCallback(() => {
    const target = seriesList.find(s => s.id === (targetId || seriesList[0]?.id));
    if (!target) return;

    const data = target.data
      .map(d => ({ x: parseFloat(d.name), y: d.value }))
      .filter(d => !isNaN(d.x) && !isNaN(d.y))
      .sort((a, b) => a.x - b.x);

    const fftResult = computeFFT(data);
    setResult({
      freq: fftResult.frequencies,
      mag: fftResult.magnitudes,
      domFreq: fftResult.dominantFreq,
      domAmp: fftResult.dominantAmplitude,
    });

    // 生成频谱系列并添加
    const spectrumData: ChartDataPoint[] = fftResult.frequencies
      .map((f, i) => ({ name: String(f), value: fftResult.magnitudes[i] }))
      .filter(d => parseFloat(d.name) > 0); // 跳过 DC

    onAddSeries({
      id: `fft_${Date.now()}`,
      name: `${target.name} (FFT频谱)`,
      data: spectrumData,
      color: '#7c3aed',
      pointColor: '#7c3aed',
      strokeWidth: 1.5,
      visible: true,
      pointShape: 'none',
      pointSize: 0,
    });
  }, [seriesList, targetId, onAddSeries]);

  if (!isExpanded) {
    return (
      <button
        onClick={() => { setIsExpanded(true); if (!targetId && seriesList.length > 0) setTargetId(seriesList[0].id); }}
        className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border bg-white text-purple-600 border-purple-200 hover:bg-purple-600 hover:text-white active:scale-95 flex items-center gap-1.5 shadow-sm"
      >
        <i className="fa-solid fa-wave-square text-[10px]" /> FFT
      </button>
    );
  }

  return (
    <FixedPortal onClose={() => setIsExpanded(false)}>
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] bg-white rounded-2xl shadow-2xl border border-slate-200 w-[340px] p-5 animate-reveal">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-black text-slate-800 uppercase italic flex items-center gap-2">
          <i className="fa-solid fa-wave-square text-purple-500" /> FFT 频谱分析
        </h3>
        <button onClick={() => setIsExpanded(false)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
          <i className="fa-solid fa-xmark text-xs" />
        </button>
      </div>

      <select
        value={targetId || seriesList[0]?.id || ''}
        onChange={e => setTargetId(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold bg-white outline-none focus:border-purple-400 mb-3"
      >
        {seriesList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.data.length}点)</option>)}
      </select>

      <p className="text-[8px] text-slate-400 mb-3">
        将时域信号转换为频域，生成频率-幅度谱作为新系列
      </p>

      <button
        onClick={executeFFT}
        className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-xl text-xs font-black uppercase shadow-lg active:scale-95 transition-all mb-3"
      >
        <i className="fa-solid fa-bolt mr-1.5" /> 执行 FFT
      </button>

      {result && (
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 animate-reveal">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
              <div className="text-[8px] font-black text-slate-400">主频率</div>
              <div className="text-sm font-black font-mono text-purple-600">{result.domFreq.toFixed(4)}</div>
            </div>
            <div className="bg-white rounded-lg p-2 text-center border border-slate-100">
              <div className="text-[8px] font-black text-slate-400">主幅度</div>
              <div className="text-sm font-black font-mono text-purple-600">{result.domAmp.toFixed(4)}</div>
            </div>
          </div>
          <p className="text-[8px] text-emerald-600 font-bold">
            <i className="fa-solid fa-check-circle mr-1" /> 频谱已添加为新数据系列
          </p>
        </div>
      )}
    </div>
    </FixedPortal>
  );
};

export default FFTPanel;
