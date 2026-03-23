import React, { useState } from 'react';
import ScientificMarkdown from '../Common/ScientificMarkdown';
import type { DebateEntry, DebateExpert } from './types';
import { useTranslation } from '../../locales/useTranslation';

/** 三位虚拟专家定义 — 机理辩论 */
export const DEBATE_EXPERTS: DebateExpert[] = [
  {
    id: 'electrochemist',
    name: '电化学家',
    nameEn: 'Dr. ElectroChem',
    title: '电化学动力学专家',
    icon: 'fa-solid fa-bolt-lightning',
    color: 'indigo',
    perspective: '从电化学热力学和动力学角度分析反应路径、过电位、Tafel 斜率和电荷转移过程',
  },
  {
    id: 'materialist',
    name: '材料学家',
    nameEn: 'Dr. Materials',
    title: '催化材料工程专家',
    icon: 'fa-solid fa-atom',
    color: 'emerald',
    perspective: '从材料结构-性能关系角度分析晶体结构、掺杂效应、形貌调控和活性位点设计',
  },
  {
    id: 'theorist',
    name: '理论化学家',
    nameEn: 'Dr. Theory',
    title: '计算化学/DFT 专家',
    icon: 'fa-solid fa-calculator',
    color: 'violet',
    perspective: '从第一性原理计算角度分析电子结构、吸附能、d-band center 和反应能垒',
  },
];

/** 三位虚拟专家定义 — 实验方案辩论 */
export const ROUTE_EXPERTS: DebateExpert[] = [
  {
    id: 'designer',
    name: '实验设计师',
    nameEn: 'Dr. ExperimentDesign',
    title: '工艺合理性专家',
    icon: 'fa-solid fa-flask-vial',
    color: 'indigo',
    perspective: '从工艺流程完整性角度审查步骤连贯性、操作可执行性和安全风险',
  },
  {
    id: 'statistician',
    name: '统计学家',
    nameEn: 'Dr. Statistics',
    title: '实验设计与数据分析专家',
    icon: 'fa-solid fa-chart-bar',
    color: 'emerald',
    perspective: '从统计学角度评估参数合理性、实验可重复性和数据充分性',
  },
  {
    id: 'domain_expert',
    name: '领域专家',
    nameEn: 'Dr. DomainExpert',
    title: '材料/化学领域专家',
    icon: 'fa-solid fa-microscope',
    color: 'violet',
    perspective: '从科学原理角度评估假设合理性、文献依据和替代方案',
  },
];

/** 三位虚拟专家定义 — 文献综述辩论 */
export const LITERATURE_EXPERTS: DebateExpert[] = [
  {
    id: 'reviewer',
    name: '审稿人',
    nameEn: 'Reviewer #1',
    title: '严格审稿人',
    icon: 'fa-solid fa-gavel',
    color: 'indigo',
    perspective: '以顶级期刊审稿标准审查实验设计严谨性、数据可靠性和统计分析正确性',
  },
  {
    id: 'domain_expert',
    name: '领域专家',
    nameEn: 'Dr. DomainExpert',
    title: '资深学者',
    icon: 'fa-solid fa-user-graduate',
    color: 'emerald',
    perspective: '从创新性、领域贡献和实验可重现性角度评估文献价值',
  },
  {
    id: 'methodologist',
    name: '方法论学家',
    nameEn: 'Dr. Methodology',
    title: '研究方法论专家',
    icon: 'fa-solid fa-ruler-combined',
    color: 'violet',
    perspective: '从研究设计、表征手段和数据处理方法角度发现方法论偏差',
  },
];

interface DebatePanelProps {
  onClose: () => void;
  debateEntries: DebateEntry[];
  conclusion: string | null;
  isDebating: boolean;
  currentRound: number;
  onStartDebate: () => void;
  onContinueDebate: () => void;
  hasAnalysisResult: boolean;
  expertMode?: 'mechanism' | 'route' | 'literature';
}

const DebatePanel: React.FC<DebatePanelProps> = ({
  onClose,
  debateEntries,
  conclusion,
  isDebating,
  currentRound,
  onStartDebate,
  onContinueDebate,
  hasAnalysisResult,
  expertMode = 'mechanism',
}) => {
  const { t } = useTranslation();
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);
  const experts = expertMode === 'route' ? ROUTE_EXPERTS : expertMode === 'literature' ? LITERATURE_EXPERTS : DEBATE_EXPERTS;

  const colorMap: Record<string, { bg: string; border: string; text: string; dot: string; headerBg: string }> = {
    indigo:  { bg: 'bg-indigo-50/60',  border: 'border-indigo-200', text: 'text-indigo-700',  dot: 'bg-indigo-500',  headerBg: 'bg-indigo-100' },
    emerald: { bg: 'bg-emerald-50/60', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', headerBg: 'bg-emerald-100' },
    violet:  { bg: 'bg-violet-50/60',  border: 'border-violet-200', text: 'text-violet-700',  dot: 'bg-violet-500',  headerBg: 'bg-violet-100' },
  };

  const groupedByRound = debateEntries.reduce<Record<number, DebateEntry[]>>((acc, entry) => {
    if (!acc[entry.round]) acc[entry.round] = [];
    acc[entry.round].push(entry);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-reveal cursor-default select-text" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-[820px] max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
              <i className="fa-solid fa-comments text-sm"></i>
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">{t('mechanism.debate.title')}</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{t('mechanism.debate.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentRound > 0 && (
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mr-2">
                {t('mechanism.debate.round', { n: currentRound })}
              </span>
            )}
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white flex items-center justify-center transition-colors">
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>
        </div>

        {/* Expert roster */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3 shrink-0">
          {experts.map(expert => {
            const c = colorMap[expert.color] || colorMap.indigo;
            return (
              <div key={expert.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${c.bg} border ${c.border}`}>
                <i className={`${expert.icon} text-[10px] ${c.text}`}></i>
                <div>
                  <span className={`text-[10px] font-black ${c.text} uppercase`}>{expert.name}</span>
                  <span className="text-[8px] text-slate-400 font-bold ml-1.5">{expert.nameEn}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Debate content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-4">
          {debateEntries.length === 0 && !isDebating ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <i className="fa-solid fa-comments text-5xl text-slate-200 mb-4"></i>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2rem] mb-2">
                {t('mechanism.debate.emptyTitle')}
              </p>
              <p className="text-[11px] text-slate-400 max-w-md leading-relaxed">
                {t('mechanism.debate.emptyDesc')}
              </p>
            </div>
          ) : (
            Object.entries(groupedByRound).map(([round, entries]) => (
              <div key={round} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">
                    {t('mechanism.debate.roundLabel', { n: round })}
                  </span>
                  <div className="flex-1 h-px bg-slate-100"></div>
                </div>
                {entries.map((entry, idx) => {
                  const expert = experts.find(e => e.id === entry.expertId);
                  if (!expert) return null;
                  const c = colorMap[expert.color] || colorMap.indigo;
                  const globalIdx = debateEntries.indexOf(entry);
                  const isExpanded = expandedEntry === globalIdx;

                  return (
                    <div key={idx} className={`${c.bg} border ${c.border} rounded-2xl overflow-hidden transition-all`}>
                      <div
                        className={`${c.headerBg} px-4 py-3 flex items-center justify-between cursor-pointer`}
                        onClick={() => setExpandedEntry(isExpanded ? null : globalIdx)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg ${c.dot} text-white flex items-center justify-center shadow-sm`}>
                            <i className={`${expert.icon} text-[10px]`}></i>
                          </div>
                          <div>
                            <span className={`text-[10px] font-black ${c.text} uppercase`}>{expert.name}</span>
                            <span className="text-[8px] text-slate-400 font-bold ml-2">{expert.title}</span>
                          </div>
                        </div>
                        <i className={`fa-solid fa-chevron-down text-[8px] ${c.text} transition-transform ${isExpanded ? 'rotate-180' : ''}`}></i>
                      </div>
                      {isExpanded && (
                        <div className="px-5 py-4 animate-reveal cursor-text select-text">
                          <div className="text-[11px] leading-[1.8] text-slate-700">
                            <ScientificMarkdown content={entry.content} />
                          </div>
                        </div>
                      )}
                      {!isExpanded && (
                        <div className="px-5 py-2.5">
                          <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">{entry.content.replace(/[#*`]/g, '').substring(0, 150)}...</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}

          {/* Conclusion */}
          {conclusion && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 animate-reveal">
              <div className="flex items-center gap-2 mb-3">
                <i className="fa-solid fa-gavel text-amber-600 text-sm"></i>
                <h5 className="text-[10px] font-black text-amber-700 uppercase tracking-widest">{t('mechanism.debate.conclusionTitle')}</h5>
              </div>
              <div className="text-[11px] leading-[1.8] text-slate-700">
                <ScientificMarkdown content={conclusion} />
              </div>
            </div>
          )}

          {/* Loading */}
          {isDebating && (
            <div className="flex items-center justify-center py-8 gap-3">
              <i className="fa-solid fa-circle-notch animate-spin text-indigo-500 text-xl"></i>
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest animate-pulse">
                {t('mechanism.debate.debating')}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <p className="text-[9px] text-slate-400 font-bold max-w-md">
            {t('mechanism.debate.disclaimer')}
          </p>
          <div className="flex items-center gap-2">
            {/* 导出 Markdown */}
            {debateEntries.length > 0 && (
              <button
                onClick={() => {
                  let md = `# ${t('mechanism.debate.title')}\n\n`;
                  Object.entries(groupedByRound).forEach(([round, entries]) => {
                    md += `## ${t('mechanism.debate.roundLabel', { n: round })}\n\n`;
                    entries.forEach(entry => {
                      const expert = DEBATE_EXPERTS.find(e => e.id === entry.expertId);
                      md += `### ${expert?.name || entry.expertId} (${expert?.nameEn || ''})\n\n`;
                      md += entry.content + '\n\n';
                    });
                  });
                  if (conclusion) {
                    md += `## ${t('mechanism.debate.conclusionTitle')}\n\n${conclusion}\n`;
                  }
                  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `debate_${Date.now()}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="h-9 px-3 rounded-xl text-[10px] font-black uppercase bg-white border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition-all flex items-center gap-1.5"
                title="Export debate as Markdown"
              >
                <i className="fa-solid fa-file-arrow-down"></i>
                MD
              </button>
            )}
            {debateEntries.length > 0 && currentRound < 3 && (
              <button
                onClick={onContinueDebate}
                disabled={isDebating}
                className="h-9 px-4 rounded-xl text-[10px] font-black uppercase bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition-all flex items-center gap-2"
              >
                <i className="fa-solid fa-rotate-right"></i>
                {t('mechanism.debate.continue')}
              </button>
            )}
            <button
              onClick={debateEntries.length === 0 ? onStartDebate : onContinueDebate}
              disabled={isDebating || !hasAnalysisResult}
              className="h-9 px-5 rounded-xl text-[10px] font-black uppercase bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg disabled:opacity-40 transition-all flex items-center gap-2"
            >
              <i className={`fa-solid ${debateEntries.length === 0 ? 'fa-play' : 'fa-forward'}`}></i>
              {debateEntries.length === 0 ? t('mechanism.debate.start') : t('mechanism.debate.nextRound')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebatePanel;
