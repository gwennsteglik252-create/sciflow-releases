
import React, { useState } from 'react';

interface TrlNavigatorProps {
  currentTrl: number;
  onTrlChange: (newTrl: number) => void;
}

const TRL_LABELS: Record<number, { title: string; desc: string; color: string }> = {
  1: { title: '基本原理', desc: '观察并报告基本原理', color: 'bg-slate-400' },
  2: { title: '技术概念', desc: '构想方案与应用论证', color: 'bg-slate-500' },
  3: { title: '关键实验', desc: '概念可行性关键实验验证', color: 'bg-indigo-500' },
  4: { title: '实验室模拟', desc: '实验室环境部件级验证', color: 'bg-indigo-600' },
  5: { title: '中试验证', desc: '相关环境集成级验证', color: 'bg-violet-500' },
  6: { title: '原型系统', desc: '真实环境原型系统演示', color: 'bg-violet-600' },
  7: { title: '工程化阶段', desc: '运行环境全系统演示', color: 'bg-emerald-500' },
  8: { title: '定型鉴定', desc: '定型鉴定与系统验证', color: 'bg-emerald-600' },
  9: { title: '产业化应用', desc: '实际应用与规模化生产', color: 'bg-amber-500' },
};

const TrlNavigator: React.FC<TrlNavigatorProps> = ({ currentTrl, onTrlChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-0 transition-all duration-300">
      <div 
        className="flex justify-between items-center cursor-pointer group/header"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2rem] italic flex items-center gap-2">
            <i className={`fa-solid ${isCollapsed ? 'fa-maximize' : 'fa-minimize'} text-[8px] opacity-50 group-hover/header:opacity-100 transition-opacity`}></i>
            TRL 技术成熟度分级系统
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-slate-500">当前阶段:</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-black text-white ${TRL_LABELS[currentTrl].color} shadow-lg`}>
            TRL {currentTrl}
          </span>
        </div>
      </div>
      
      {!isCollapsed && (
        <div className="grid grid-cols-9 gap-1 h-12 relative mt-4 animate-reveal">
          {Array.from({ length: 9 }).map((_, i) => {
            const level = i + 1;
            const isActive = level <= currentTrl;
            const isCurrent = level === currentTrl;
            
            return (
              <div 
                key={level}
                onClick={() => onTrlChange(level)}
                className={`group relative flex-1 flex flex-col justify-end cursor-pointer transition-all duration-300 ${isCurrent ? 'scale-y-110 -translate-y-1' : 'hover:-translate-y-1'}`}
                title={`TRL ${level}: ${TRL_LABELS[level].title}`}
              >
                <div className={`w-full rounded-t-lg transition-all duration-500 ${
                  isCurrent 
                    ? `${TRL_LABELS[level].color} shadow-[0_0_15px_rgba(99,102,241,0.4)]` 
                    : isActive 
                      ? `${TRL_LABELS[level].color} opacity-60` 
                      : 'bg-white/10'
                }`} style={{ height: `${(level / 9) * 100}%` }}>
                  {isCurrent && (
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
                  )}
                </div>
                <div className="mt-1 text-center">
                  <span className={`text-[8px] font-black ${isActive ? 'text-white' : 'text-slate-500'}`}>{level}</span>
                </div>
                
                {/* Tooltip on Hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-40 p-3 bg-slate-900 border border-white/10 rounded-xl shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                   <p className="text-[9px] font-black text-indigo-400 uppercase mb-1">Level {level}: {TRL_LABELS[level].title}</p>
                   <p className="text-[8px] text-slate-400 font-medium leading-relaxed italic">{TRL_LABELS[level].desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TrlNavigator;
