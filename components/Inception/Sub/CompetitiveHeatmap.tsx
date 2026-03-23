
import React, { useState } from 'react';
import { HotnessPoint } from '../../../types';

interface CompetitiveHeatmapProps {
    data: HotnessPoint[];
}

const CompetitiveHeatmap: React.FC<CompetitiveHeatmapProps> = ({ data }) => {
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    const safeData = Array.isArray(data) ? data : [];
    const hoveredPoint = safeData.find((_, idx) => (`hotnode-${idx}` === hoveredId || safeData[idx]?.id === hoveredId));

    return (
        <div className="relative w-full h-[450px] bg-slate-900 rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl p-8 group/map">
            <style>{`
                @keyframes sonar {
                    0% { transform: scale(0.8); opacity: 0.8; }
                    100% { transform: scale(2.5); opacity: 0; }
                }
                .hot-pulse { animation: sonar 2s infinite ease-out; }
            `}</style>

            {/* 背景网格与装饰 */}
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1.5px 1.5px, #6366f1 1.5px, transparent 0)', backgroundSize: '40px 40px' }}></div>

            {/* 象限坐标系 */}
            <div className="absolute inset-12 pointer-events-none">
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white/10"></div>
                <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/10"></div>

                {/* 轴标签 */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-6 text-[8px] font-black text-slate-500 uppercase tracking-widest">成熟方向 (Deep Research)</div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-6 text-[8px] font-black text-slate-500 uppercase tracking-widest">初创方向 (Early Stage)</div>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-14 rotate-90 text-[8px] font-black text-slate-500 uppercase tracking-widest">红海 (High Competition)</div>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-14 -rotate-90 text-[8px] font-black text-slate-500 uppercase tracking-widest">蓝海 (Blue Ocean)</div>
            </div>

            {/* 热力区域渲染 - 调整到 inset-12 坐标系以匹配网格 */}
            <div className="absolute inset-12 pointer-events-none">
                {safeData.map((p, idx) => {
                    const x = 50 + (p.isBlueOcean ? (p.x / 2.5) : (-p.x / 2.5));
                    const y = 100 - p.y;
                    const size = 60 + (p.val || 50) * 2;
                    const baseColor = p.isBlueOcean ? '99, 102, 241' : '244, 63, 94';
                    const nodeKey = p.id ?? `hotnode-${idx}`;

                    return (
                        <div
                            key={nodeKey}
                            className="absolute z-20 flex items-center justify-center w-12 h-12 -translate-x-1/2 -translate-y-1/2"
                            style={{ left: `${x}%`, top: `${y}%` }}
                            onMouseEnter={() => setHoveredId(nodeKey)}
                            onMouseLeave={() => setHoveredId(null)}
                        >
                            {/* 交互圆心：隔离缩放逻辑与位移逻辑 */}
                            <div className="absolute inset-0 cursor-pointer transition-transform hover:scale-125 pointer-events-auto flex items-center justify-center">
                                {/* 热力光晕 */}
                                <div
                                    className="absolute rounded-full blur-2xl opacity-20 pointer-events-none"
                                    style={{
                                        width: size, height: size,
                                        backgroundColor: `rgb(${baseColor})`,
                                        left: '50%', top: '50%',
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                ></div>

                                {/* 脉冲点 */}
                                <div className="relative pointer-events-none">
                                    <div className={`absolute inset-0 rounded-full hot-pulse`} style={{ backgroundColor: `rgb(${baseColor})` }}></div>
                                    <div
                                        className="w-4 h-4 rounded-full border-2 border-white shadow-xl relative z-10"
                                        style={{ backgroundColor: `rgb(${baseColor})` }}
                                    ></div>
                                </div>
                            </div>

                            {/* 浮动标签 */}
                            <div className={`absolute top-10 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 whitespace-nowrap transition-opacity ${hoveredId === nodeKey ? 'opacity-100' : 'opacity-0'}`}>
                                <span className="text-[10px] font-black text-white italic uppercase">{p.topic}</span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 详细 Info Panel */}
            {hoveredPoint && (
                <div className="absolute bottom-10 left-10 w-72 bg-white/95 backdrop-blur-xl rounded-3xl border border-indigo-200 shadow-2xl p-5 animate-reveal z-50">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${hoveredPoint.isBlueOcean ? 'bg-indigo-600 text-white' : 'bg-rose-600 text-white'}`}>
                                {hoveredPoint.isBlueOcean ? '机遇锚点 (BLUE OCEAN)' : '饱和警戒 (RED OCEAN)'}
                            </span>
                            <h4 className="text-sm font-black text-slate-900 mt-1 uppercase italic">{hoveredPoint.topic}</h4>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                            <p className="text-[14px] font-black text-indigo-600 italic leading-none">Score: {hoveredPoint.val}</p>
                            {(hoveredPoint as any).sourceUrl && (
                                <a
                                    href={(hoveredPoint as any).sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[9px] font-black text-indigo-400 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                                >
                                    <i className="fa-solid fa-up-right-from-square"></i> 了解更多
                                </a>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {(hoveredPoint.competitors?.length ?? 0) > 0 && (
                            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                <p className="text-[7px] font-black text-slate-400 uppercase mb-1">主要活跃研究组</p>
                                <div className="flex flex-wrap gap-1">
                                    {hoveredPoint.competitors!.map((c, i) => (
                                        <span key={i} className="text-[9px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">{c}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(hoveredPoint.trend?.length ?? 0) > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-[7px] font-black text-slate-400 uppercase">发表频率趋势</span>
                                <div className="flex-1 flex gap-0.5 h-6 items-end">
                                    {hoveredPoint.trend!.map((h, i) => (
                                        <div key={i} className="flex-1 bg-indigo-200 rounded-t-sm" style={{ height: `${h}%` }}></div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 操作提示 */}
            <div className="absolute bottom-6 right-8 text-right pointer-events-none opacity-40 group-hover/map:opacity-100 transition-opacity">
                <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">基于 WOS 2020-2025 实时数据推演</p>
                <p className="text-[10px] font-bold text-slate-500 italic mt-1">Hover over nodes for deep strategic analysis</p>
            </div>
        </div>
    );
};

export default CompetitiveHeatmap;
