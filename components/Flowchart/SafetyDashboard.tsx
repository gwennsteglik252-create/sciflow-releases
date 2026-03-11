
import React, { useState, useMemo } from 'react';

interface SafetyRisk {
  keyword: string;
  level: 'critical' | 'warning';
  instruction: string;
}

const SAFETY_GUIDELINES: SafetyRisk[] = [
  { keyword: '高温', level: 'warning', instruction: '需确认控温设备精度，严防局部热失控。建议使用循环油浴。' },
  { keyword: '高压', level: 'critical', instruction: '必须在额定压力容器中进行，作业前检查泄压阀及传感器。' } ,
  { keyword: '浓硝酸', level: 'critical', instruction: '具有强腐蚀性与氧化性，需佩戴专用防腐手套及护目镜。' },
  { keyword: '浓硫酸', level: 'critical', instruction: '具有极强脱水性，稀释时严禁将水倒入酸中。' },
  { keyword: '还原剂', level: 'warning', instruction: '部分还原剂具有易燃易爆性，操作区需杜绝明火及静电。' },
  { keyword: '氢气', level: 'critical', instruction: '易燃易爆气体，需在配有氢气报警器的防爆通风橱内操作。' },
  { keyword: '剧毒', level: 'critical', instruction: '必须执行双人双锁领用制度，操作全程处于监控范围内。' },
  { keyword: '搅拌', level: 'warning', instruction: '机械搅拌时需固定稳妥，防止容器破损导致物料喷溅。' },
];

interface SafetyDashboardProps {
  description: string;
}

export const SafetyDashboard: React.FC<SafetyDashboardProps> = ({ description }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const detectedRisks = useMemo(() => {
    if (!description.trim()) return [];
    return SAFETY_GUIDELINES.filter(rule => new RegExp(rule.keyword, 'i').test(description));
  }, [description]);

  return (
    <div className="w-full shrink-0 border-t border-slate-200 bg-white px-6 py-2 z-30 no-print">
        <div className={`w-full transition-all duration-500 overflow-hidden px-4 py-1.5 rounded-2xl border ${detectedRisks.length > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-100'}`}>
          <div 
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center justify-between cursor-pointer group"
          >
              <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${detectedRisks.length > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-200 text-slate-500'}`}>
                      <i className={`fa-solid ${detectedRisks.length > 0 ? 'fa-shield-virus' : 'fa-check-shield'} text-[10px]`}></i>
                  </div>
                  <div className="flex items-center gap-3">
                      <h4 className={`text-[10px] font-black uppercase tracking-[0.2rem] italic ${detectedRisks.length > 0 ? 'text-rose-500' : 'text-slate-500'}`}>实验室安全审计实时看板</h4>
                      <p className={`text-[10px] font-bold uppercase transition-opacity ${isExpanded ? 'opacity-0' : 'opacity-60'} ${detectedRisks.length > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {detectedRisks.length > 0 ? `发现 ${detectedRisks.length} 项风险因子` : '环境合规扫描正常'}
                      </p>
                  </div>
              </div>
              <div className="flex items-center gap-2">
                  {detectedRisks.length > 0 && !isExpanded && (
                      <span className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[8px] font-black uppercase shadow-lg">Action Required</span>
                  )}
                  <i className={`fa-solid ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-up'} text-slate-600 text-[8px] group-hover:text-slate-400 transition-colors`}></i>
              </div>
          </div>
          
          {isExpanded && (
              <div className="pt-3 pb-2 animate-reveal border-t border-slate-200 mt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                      {detectedRisks.length > 0 ? detectedRisks.map((risk, idx) => (
                          <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 hover:border-rose-200 transition-colors shadow-sm">
                              <span className="text-[8px] font-black text-rose-500 uppercase mb-1 flex items-center gap-1.5">
                                <i className="fa-solid fa-circle-exclamation"></i> {risk.keyword} 对策
                              </span>
                              <p className="text-[9px] font-medium text-slate-500 italic leading-relaxed">{risk.instruction}</p>
                          </div>
                      )) : (
                          <p className="text-[9px] font-bold text-slate-400 italic py-4 w-full col-span-full text-center">当前工艺描述暂未触发预设安全风险报警。</p>
                      )}
                  </div>
              </div>
          )}
        </div>
    </div>
  );
};
