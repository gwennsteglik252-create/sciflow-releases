/**
 * DualModalPanel.tsx
 * Raman + IR 双模态并排/叠加显示面板
 * 互补分析: Raman 看 M-O 骨架振动，IR 看 OH/OOH 官能团
 */
import React, { useState, useMemo } from 'react';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
    CartesianGrid, Legend, ReferenceLine
} from 'recharts';
import { extractVoltageKeys, voltageKeyToLabel, SpectrumDataPoint } from './spectroscopyAnalysis';
import { INTERMEDIATE_DATABASE, matchPeaksToIntermediates } from './intermediateFingerprints';

interface Props {
    ramanData: SpectrumDataPoint[];
    irData?: SpectrumDataPoint[];  // 可选：导入的 IR 数据
}

// 模拟 IR 数据生成
const generateMockIRData = (voltageKeys: string[]): SpectrumDataPoint[] => {
    const data: SpectrumDataPoint[] = [];
    for (let w = 800; w <= 4000; w += 10) {
        const entry: any = { wavenumber: w };
        voltageKeys.forEach(key => {
            const v = parseFloat(key.replace('v_', ''));
            let absorbance = 0.05 + Math.random() * 0.005;
            // O-H 伸缩 3200–3600 cm⁻¹
            absorbance += 0.4 * (v - 1.0) * Math.exp(-Math.pow(w - 3400, 2) / 50000);
            // O-O 伸缩 850 cm⁻¹
            absorbance += 0.25 * (v - 1.0) * Math.exp(-Math.pow(w - 850, 2) / 3000);
            // δ(OOH) 弯曲 1050–1150 cm⁻¹
            absorbance += 0.3 * Math.max(0, v - 1.2) * Math.exp(-Math.pow(w - 1100, 2) / 5000);
            // C=O (碳酸盐/有机物) ~1630 cm⁻¹
            absorbance += 0.15 * Math.exp(-Math.pow(w - 1630, 2) / 4000);
            entry[key] = parseFloat(absorbance.toFixed(4));
        });
        data.push(entry);
    }
    return data;
};

// IR 特征峰注释
const IR_ANNOTATIONS = [
    { position: 850, label: 'ν(O-O)', color: '#f43f5e' },
    { position: 1100, label: 'δ(OOH)', color: '#6366f1' },
    { position: 1630, label: 'δ(H₂O)/C=O', color: '#94a3b8' },
    { position: 3400, label: 'ν(O-H)', color: '#10b981' },
];

// Raman 特征峰注释
const RAMAN_ANNOTATIONS = [
    { position: 500, label: 'ν(M-OH)', color: '#10b981' },
    { position: 580, label: 'δ(M-OOH)', color: '#f43f5e' },
    { position: 690, label: 'Co₃O₄ A1g', color: '#6366f1' },
    { position: 820, label: 'ν(O-O)', color: '#f59e0b' },
];

const DualModalPanel: React.FC<Props> = ({ ramanData, irData: externalIrData }) => {
    const [layout, setLayout] = useState<'side' | 'stacked'>('side');
    const [showAnnotations, setShowAnnotations] = useState(true);
    const [selectedVoltage, setSelectedVoltage] = useState<string>('');

    const voltageKeys = useMemo(() => extractVoltageKeys(ramanData), [ramanData]);
    const irData = useMemo(() => externalIrData || generateMockIRData(voltageKeys), [voltageKeys, externalIrData]);

    // 自动选择默认电位
    useState(() => {
        if (voltageKeys.length > 0 && !selectedVoltage) {
            setSelectedVoltage(voltageKeys[voltageKeys.length - 1]);
        }
    });

    // 指纹库中的 IR 和 Raman 条目
    const ramanEntries = useMemo(() => INTERMEDIATE_DATABASE.filter(e => e.ramanRange), []);
    const irEntries = useMemo(() => INTERMEDIATE_DATABASE.filter(e => e.irRange), []);

    const SPEC_COLORS = ['#94a3b8', '#818cf8', '#6366f1', '#4338ca', '#312e81'];

    if (ramanData.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center opacity-30 text-slate-400 gap-3">
                <i className="fa-solid fa-wave-square text-4xl"></i>
                <p className="text-[10px] font-black uppercase">请先加载拉曼光谱数据</p>
            </div>
        );
    }

    const renderSpectrumChart = (
        data: SpectrumDataPoint[],
        title: string,
        yLabel: string,
        annotations: typeof RAMAN_ANNOTATIONS,
        isIR: boolean = false
    ) => (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-2 shrink-0">
                <h6 className="text-[9px] font-black text-slate-400 uppercase">
                    <i className={`fa-solid ${isIR ? 'fa-signal' : 'fa-wave-square'} mr-1`}></i>{title}
                </h6>
                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${isIR ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    {isIR ? 'FTIR' : 'Raman'}
                </span>
            </div>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 15 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                            dataKey="wavenumber"
                            fontSize={9}
                            tick={{ fill: '#64748b' }}
                            reversed={isIR}
                            label={{ value: `Wavenumber (cm⁻¹)`, position: 'insideBottom', offset: -8, fontSize: 9, fontWeight: 'bold' }}
                        />
                        <YAxis fontSize={9} tick={{ fill: '#64748b' }}
                            label={{ value: yLabel, angle: -90, position: 'insideLeft', fontSize: 9, fontWeight: 'bold' }} />
                        <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '9px' }} />
                        <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 'bold' }} />
                        {voltageKeys.map((key, i) => (
                            <Line
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={SPEC_COLORS[i % SPEC_COLORS.length]}
                                strokeWidth={selectedVoltage === key ? 2.5 : 1.5}
                                dot={false}
                                name={voltageKeyToLabel(key)}
                                opacity={!selectedVoltage || selectedVoltage === key ? 1 : 0.3}
                            />
                        ))}
                        {showAnnotations && annotations.map((a, i) => (
                            <ReferenceLine key={i} x={a.position} stroke={a.color} strokeDasharray="3 3"
                                label={{ value: a.label, position: 'top', fontSize: 7, fill: a.color, fontWeight: 'bold' }} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col gap-3">
            {/* 控制栏 */}
            <div className="flex items-center gap-4 shrink-0 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                    <button onClick={() => setLayout('side')}
                        className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${layout === 'side' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
                        <i className="fa-solid fa-table-columns mr-1"></i>并排
                    </button>
                    <button onClick={() => setLayout('stacked')}
                        className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${layout === 'stacked' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
                        <i className="fa-solid fa-layer-group mr-1"></i>上下
                    </button>
                </div>

                {/* 电位选择 */}
                <select
                    value={selectedVoltage}
                    onChange={e => setSelectedVoltage(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 outline-none focus:border-indigo-400"
                >
                    <option value="">全部电位</option>
                    {voltageKeys.map(key => (
                        <option key={key} value={key}>{voltageKeyToLabel(key)}</option>
                    ))}
                </select>

                <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={showAnnotations} onChange={e => setShowAnnotations(e.target.checked)}
                        className="accent-indigo-600 w-3.5 h-3.5" />
                    <span className="text-[9px] font-black text-slate-500 uppercase">标注峰位</span>
                </label>

                <div className="ml-auto text-[9px] font-bold text-slate-400">
                    <i className="fa-solid fa-circle-info mr-1"></i>
                    Raman → M-O 骨架振动 | IR → OH/OOH 官能团
                </div>
            </div>

            {/* 图表区 */}
            <div className={`flex-1 min-h-0 ${layout === 'side' ? 'grid grid-cols-2 gap-4' : 'grid grid-rows-2 gap-4'}`}>
                {renderSpectrumChart(ramanData, '原位拉曼光谱 (Raman)', 'Intensity (a.u.)', RAMAN_ANNOTATIONS, false)}
                {renderSpectrumChart(irData, '原位红外光谱 (FTIR)', 'Absorbance (a.u.)', IR_ANNOTATIONS, true)}
            </div>

            {/* 互补分析说明 */}
            <div className="grid grid-cols-2 gap-3 shrink-0">
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <p className="text-[9px] font-medium text-indigo-700 leading-relaxed">
                        <i className="fa-solid fa-wave-square mr-1"></i>
                        <strong>Raman 优势：</strong> 对金属-氧 (M-O、M-OH) 骨架振动灵敏，可直接观察活性位点的氧化态变化和表面重构。
                    </p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-[9px] font-medium text-amber-700 leading-relaxed">
                        <i className="fa-solid fa-signal mr-1"></i>
                        <strong>IR 优势：</strong> 对 O-H、O-O-H 官能团伸缩/弯曲振动灵敏，可追踪 *OOH 等含氢中间体的生成动力学。
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DualModalPanel;
