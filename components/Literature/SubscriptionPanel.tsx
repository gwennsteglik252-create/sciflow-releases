import React, { useState, useMemo } from 'react';
import type { SubscriptionRule, SubscriptionRuleType, FeedItem, DigestReport, RecommendedPaper } from '../../types';

// ═══ Props ═══════════════════════════════════════════════════════
interface SubscriptionPanelProps {
  rules: SubscriptionRule[];
  feedItems: FeedItem[];
  isChecking: boolean;
  onAddRule: (type: SubscriptionRule['type'], value: string) => void;
  onRemoveRule: (id: string) => void;
  onToggleRule: (id: string) => void;
  onCheckNow: () => void;
  onImportFeedItem: (item: FeedItem) => void;
  onMarkRead: (id: string) => void;
  onStarFeedItem: (id: string) => void;
  // AI Digest
  digestReports: DigestReport[];
  isGeneratingDigest: boolean;
  onGenerateDigest: (period: 'daily' | 'weekly') => void;
  // Recommendations
  recommendations: RecommendedPaper[];
  isFetchingRecommendations: boolean;
  onFetchRecommendations: () => void;
  onImportRecommendation: (paper: RecommendedPaper) => void;
  onDismissRecommendation: (doi: string) => void;
  onClose: () => void;
}

// ═══ Rule Type Config ═══════════════════════════════════════════
const RULE_TYPES: { key: SubscriptionRuleType; label: string; icon: string; placeholder: string; desc: string }[] = [
  { key: 'keyword', label: '关键词', icon: 'fa-tag', placeholder: '如：electrocatalysis, 析氧反应', desc: 'OpenAlex 全文检索' },
  { key: 'author', label: '作者', icon: 'fa-user', placeholder: '如：John Smith', desc: 'OpenAlex 作者追踪' },
  { key: 'journal', label: '期刊', icon: 'fa-newspaper', placeholder: '如：Nature Energy', desc: 'OpenAlex 期刊订阅' },
  { key: 'arxiv_category', label: 'arXiv', icon: 'fa-atom', placeholder: '如：cs.AI, cond-mat.mtrl-sci', desc: 'arXiv RSS 实时追踪' },
  { key: 'rss_url', label: 'RSS', icon: 'fa-rss', placeholder: '粘贴期刊 RSS Feed URL', desc: '自定义 RSS 源' },
  { key: 'doi_alert', label: '引用追踪', icon: 'fa-quote-right', placeholder: '粘贴论文 DOI，如：10.1038/s41586-023-06735-9', desc: '追踪谁引用了这篇论文' },
];

type TabKey = 'feed' | 'recommended' | 'digest' | 'rules';

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  openalex: { label: 'OpenAlex', color: 'bg-indigo-100 text-indigo-600' },
  arxiv: { label: 'arXiv', color: 'bg-orange-100 text-orange-600' },
  rss: { label: 'RSS', color: 'bg-sky-100 text-sky-600' },
  openalex_citation: { label: '引用追踪', color: 'bg-violet-100 text-violet-600' },
  semantic_scholar: { label: 'S2', color: 'bg-emerald-100 text-emerald-600' },
};

// ═══ Component ═══════════════════════════════════════════════════
const SubscriptionPanel: React.FC<SubscriptionPanelProps> = ({
  rules, feedItems, isChecking,
  onAddRule, onRemoveRule, onToggleRule,
  onCheckNow, onImportFeedItem, onMarkRead, onStarFeedItem,
  digestReports, isGeneratingDigest, onGenerateDigest,
  recommendations, isFetchingRecommendations,
  onFetchRecommendations, onImportRecommendation, onDismissRecommendation,
  onClose,
}) => {
  const [newType, setNewType] = useState<SubscriptionRuleType>('keyword');
  const [newValue, setNewValue] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('feed');
  const [feedFilter, setFeedFilter] = useState<'all' | 'unread' | 'starred'>('all');

  const handleAdd = () => {
    if (!newValue.trim()) return;
    onAddRule(newType, newValue.trim());
    setNewValue('');
  };

  const unreadCount = feedItems.filter(f => !f.isRead).length;
  const starredCount = feedItems.filter(f => f.starred).length;

  const displayedFeed = useMemo(() => {
    let items = feedItems;
    if (feedFilter === 'unread') items = items.filter(f => !f.isRead);
    if (feedFilter === 'starred') items = items.filter(f => f.starred);
    return items;
  }, [feedItems, feedFilter]);

  const TABS: { key: TabKey; icon: string; label: string; badge?: number }[] = [
    { key: 'feed', icon: 'fa-rss', label: '信息流', badge: unreadCount },
    { key: 'recommended', icon: 'fa-wand-magic-sparkles', label: '智能推荐', badge: recommendations.filter(r => !r.dismissed).length },
    { key: 'digest', icon: 'fa-chart-line', label: 'AI 周报', badge: digestReports.length },
    { key: 'rules', icon: 'fa-gear', label: '订阅规则', badge: rules.length },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-[780px] h-[80vh] flex flex-col overflow-hidden animate-reveal"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div>
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <i className="fa-solid fa-satellite-dish text-indigo-500"></i>
              文献订阅中心
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
              {rules.filter(r => r.enabled).length} 条活跃规则 · {unreadCount} 篇未读 · {feedItems.length} 篇总计
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCheckNow}
              disabled={isChecking}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-indigo-700 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <i className={`fa-solid ${isChecking ? 'fa-circle-notch animate-spin' : 'fa-refresh'} text-[9px]`}></i>
              {isChecking ? '检查中...' : '立即检查'}
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 flex items-center justify-center transition-all">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
                activeTab === tab.key ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <i className={`fa-solid ${tab.icon}`}></i>
              {tab.label}
              {(tab.badge ?? 0) > 0 && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold ${
                  tab.key === 'feed' && unreadCount > 0 ? 'bg-rose-500 text-white' : 'bg-slate-200 text-slate-500'
                }`}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {/* ═══ Tab: 信息流 ═══ */}
          {activeTab === 'feed' && (
            <div className="space-y-3">
              {/* Feed Filters */}
              <div className="flex items-center gap-2 mb-2">
                {[
                  { key: 'all' as const, label: '全部', count: feedItems.length },
                  { key: 'unread' as const, label: '未读', count: unreadCount },
                  { key: 'starred' as const, label: '星标', count: starredCount },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFeedFilter(f.key)}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all ${
                      feedFilter === f.key ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>

              {displayedFeed.length === 0 ? (
                <EmptyState icon="fa-inbox" text="信息流为空" hint="添加订阅规则并点击&quot;立即检查&quot;获取新文献" />
              ) : (
                displayedFeed.map(item => {
                  const rule = rules.find(r => r.id === item.ruleId);
                  const src = SOURCE_BADGE[item.sourceApi || 'openalex'];
                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border-2 transition-all group ${item.isRead ? 'bg-white border-slate-100' : 'bg-indigo-50/50 border-indigo-200'}`}
                      onClick={() => !item.isRead && onMarkRead(item.id)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {!item.isRead && <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0"></span>}
                          <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{item.source} · {item.year}</span>
                          {src && <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded ${src.color}`}>{src.label}</span>}
                          {rule && <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-500"><i className={`fa-solid ${RULE_TYPES.find(r => r.key === rule.type)?.icon} mr-0.5`}></i>{rule.value}</span>}
                          {item.imported && <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-500"><i className="fa-solid fa-check mr-0.5"></i>已导入</span>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={e => { e.stopPropagation(); onStarFeedItem(item.id); }}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                              item.starred ? 'bg-amber-100 text-amber-500' : 'bg-slate-50 text-slate-300 hover:text-amber-400'
                            }`}
                          >
                            <i className={`fa-${item.starred ? 'solid' : 'regular'} fa-star text-[9px]`}></i>
                          </button>
                          {!item.imported && (
                            <button
                              onClick={e => { e.stopPropagation(); onImportFeedItem(item); }}
                              className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase hover:bg-indigo-700 transition-all flex items-center gap-1 sm:opacity-0 group-hover:opacity-100"
                            >
                              <i className="fa-solid fa-plus text-[7px]"></i>导入
                            </button>
                          )}
                        </div>
                      </div>
                      <h4 className="text-[10px] font-black text-slate-800 leading-tight line-clamp-2 italic mb-1">{item.title}</h4>
                      {item.englishTitle && <p className="text-[8px] text-slate-400 line-clamp-1 mb-1 font-serif">{item.englishTitle}</p>}
                      <p className="text-[9px] text-slate-500 leading-relaxed line-clamp-3">{item.abstract}</p>
                      <div className="flex items-center gap-2 mt-2 text-[8px] text-slate-400">
                        <span>{item.authors?.slice(0, 3).join(', ')}{(item.authors?.length || 0) > 3 ? ' 等' : ''}</span>
                        {item.doi && <span className="text-indigo-400">DOI: {item.doi}</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ═══ Tab: 智能推荐 ═══ */}
          {activeTab === 'recommended' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] text-slate-400 font-bold">
                  <i className="fa-solid fa-brain mr-1 text-purple-400"></i>
                  基于你已导入的文献，通过 Semantic Scholar 推荐相关研究
                </p>
                <button
                  onClick={onFetchRecommendations}
                  disabled={isFetchingRecommendations}
                  className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-[9px] font-black uppercase hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <i className={`fa-solid ${isFetchingRecommendations ? 'fa-circle-notch animate-spin' : 'fa-wand-magic-sparkles'} text-[8px]`}></i>
                  {isFetchingRecommendations ? '正在推荐...' : '获取推荐'}
                </button>
              </div>

              {recommendations.filter(r => !r.dismissed).length === 0 ? (
                <EmptyState icon="fa-wand-magic-sparkles" text="暂无推荐" hint="导入文献后点击&quot;获取推荐&quot;发现相关研究" />
              ) : (
                recommendations.filter(r => !r.dismissed).map(paper => (
                  <div key={paper.id} className="p-3 rounded-xl border-2 border-slate-100 bg-white transition-all group hover:border-purple-200">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{paper.source} · {paper.year}</span>
                        {paper.citationCount !== undefined && paper.citationCount > 0 && (
                          <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">
                            <i className="fa-solid fa-quote-left mr-0.5"></i>{paper.citationCount} 引用
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => paper.doi && onDismissRecommendation(paper.doi)}
                          className="px-2 py-1 bg-slate-100 text-slate-400 rounded-lg text-[8px] font-bold hover:bg-rose-50 hover:text-rose-500 transition-all flex items-center gap-1 sm:opacity-0 group-hover:opacity-100"
                          title="标记为不感兴趣"
                        >
                          <i className="fa-solid fa-eye-slash text-[7px]"></i>不感兴趣
                        </button>
                        <button
                          onClick={() => onImportRecommendation(paper)}
                          className="px-2.5 py-1 bg-purple-600 text-white rounded-lg text-[8px] font-black uppercase hover:bg-purple-700 transition-all flex items-center gap-1 sm:opacity-0 group-hover:opacity-100"
                        >
                          <i className="fa-solid fa-plus text-[7px]"></i>导入
                        </button>
                      </div>
                    </div>
                    <h4 className="text-[10px] font-black text-slate-800 leading-tight line-clamp-2 italic mb-1">{paper.title}</h4>
                    {paper.englishTitle && <p className="text-[8px] text-slate-400 line-clamp-1 mb-1 font-serif">{paper.englishTitle}</p>}
                    {paper.recommendReason && (
                      <p className="text-[8px] text-purple-500 bg-purple-50 px-2 py-1 rounded-lg mb-1 font-bold">
                        <i className="fa-solid fa-lightbulb mr-1"></i>{paper.recommendReason}
                      </p>
                    )}
                    <p className="text-[9px] text-slate-500 leading-relaxed line-clamp-2">{paper.abstract}</p>
                    <div className="flex items-center gap-2 mt-2 text-[8px] text-slate-400">
                      <span>{paper.authors?.slice(0, 3).join(', ')}{(paper.authors?.length || 0) > 3 ? ' 等' : ''}</span>
                      {paper.doi && <span className="text-indigo-400">DOI: {paper.doi}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ═══ Tab: AI 周报 ═══ */}
          {activeTab === 'digest' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] text-slate-400 font-bold">
                  <i className="fa-solid fa-chart-line mr-1 text-emerald-400"></i>
                  AI 自动分析订阅论文的主题趋势
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onGenerateDigest('weekly')}
                    disabled={isGeneratingDigest || feedItems.length === 0}
                    className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-[9px] font-black uppercase hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <i className={`fa-solid ${isGeneratingDigest ? 'fa-circle-notch animate-spin' : 'fa-newspaper'} text-[8px]`}></i>
                    {isGeneratingDigest ? '生成中...' : '生成周报'}
                  </button>
                </div>
              </div>

              {digestReports.length === 0 ? (
                <EmptyState icon="fa-chart-line" text="暂无 AI 周报" hint={feedItems.length === 0 ? '先获取订阅文献再生成周报' : '点击「生成周报」开始分析趋势'} />
              ) : (
                digestReports.map(report => (
                  <DigestCard key={report.id} report={report} feedItems={feedItems} />
                ))
              )}
            </div>
          )}

          {/* ═══ Tab: 订阅规则 ═══ */}
          {activeTab === 'rules' && (
            <div className="space-y-4">
              {/* Add Rule Form */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <p className="text-[8px] font-black text-slate-400 uppercase mb-2 tracking-widest">添加新订阅</p>
                <div className="flex gap-2 mb-2">
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as SubscriptionRuleType)}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-600 outline-none focus:ring-1 focus:ring-indigo-200 min-w-[100px]"
                  >
                    {RULE_TYPES.map(rt => (
                      <option key={rt.key} value={rt.key}>{rt.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder={RULE_TYPES.find(r => r.key === newType)?.placeholder}
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-bold outline-none focus:ring-1 focus:ring-indigo-200"
                  />
                  <button
                    onClick={handleAdd}
                    disabled={!newValue.trim()}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-indigo-700 transition-all disabled:opacity-30"
                  >
                    <i className="fa-solid fa-plus mr-1"></i>添加
                  </button>
                </div>
                <p className="text-[8px] text-slate-300 font-bold">
                  <i className="fa-solid fa-info-circle mr-1"></i>
                  {RULE_TYPES.find(r => r.key === newType)?.desc}
                </p>
              </div>

              {/* Rules List */}
              {rules.length === 0 ? (
                <EmptyState icon="fa-satellite-dish" text="暂无订阅规则" hint="添加关键词、作者、期刊、arXiv 分类或自定义 RSS 开始追踪" />
              ) : (
                <div className="space-y-2">
                  {rules.map(rule => {
                    const typeInfo = RULE_TYPES.find(r => r.key === rule.type) || RULE_TYPES[0];
                    return (
                      <div key={rule.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${rule.enabled ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                        <button
                          onClick={() => onToggleRule(rule.id)}
                          className={`w-8 h-5 rounded-full transition-all flex items-center ${rule.enabled ? 'bg-indigo-500 justify-end' : 'bg-slate-300 justify-start'}`}
                        >
                          <div className="w-4 h-4 bg-white rounded-full shadow mx-0.5"></div>
                        </button>
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${rule.enabled ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                          <i className={`fa-solid ${typeInfo.icon} text-[10px]`}></i>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 uppercase">{typeInfo.label}</span>
                            <p className="text-[10px] font-black text-slate-700 truncate">{rule.value}</p>
                          </div>
                          <p className="text-[8px] text-slate-400">{rule.lastChecked ? `上次检查: ${new Date(rule.lastChecked).toLocaleDateString('zh-CN')}` : '未检查'} {(rule.newCount ?? 0) > 0 && `· ${rule.newCount} 篇新`}</p>
                        </div>
                        <button onClick={() => onRemoveRule(rule.id)} className="w-7 h-7 rounded-lg bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all">
                          <i className="fa-solid fa-trash-can text-[9px]"></i>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══ Sub-components ═══════════════════════════════════════════════
const EmptyState: React.FC<{ icon: string; text: string; hint: string }> = ({ icon, text, hint }) => (
  <div className="text-center py-10 opacity-40">
    <i className={`fa-solid ${icon} text-3xl mb-2 text-slate-300`}></i>
    <p className="text-[10px] font-black text-slate-400 uppercase">{text}</p>
    <p className="text-[8px] text-slate-300 mt-1">{hint}</p>
  </div>
);

const DigestCard: React.FC<{ report: DigestReport; feedItems: FeedItem[] }> = ({ report, feedItems }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="bg-gradient-to-br from-emerald-50/50 to-teal-50/50 rounded-xl border border-emerald-200/50 overflow-hidden">
      <div className="p-3 border-b border-emerald-100/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-newspaper text-emerald-500"></i>
            <span className="text-[10px] font-black text-slate-700 uppercase">
              {report.period === 'daily' ? '每日' : '每周'}摘要
            </span>
            <span className="text-[8px] text-slate-400 font-bold">
              {new Date(report.generatedAt).toLocaleDateString('zh-CN')} · {report.feedItemCount} 篇论文
            </span>
          </div>
        </div>
      </div>

      {/* Overall Insight */}
      <div className="p-3 bg-white/60 border-b border-emerald-100/50">
        <p className="text-[9px] font-bold text-slate-600 leading-relaxed">
          <i className="fa-solid fa-lightbulb text-amber-400 mr-1"></i>
          {report.overallInsight}
        </p>
      </div>

      {/* Topic Clusters */}
      <div className="p-3 space-y-2">
        {report.topicClusters.map((cluster, idx) => (
          <div key={idx} className="bg-white rounded-lg border border-slate-100 overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === cluster.topic ? null : cluster.topic)}
              className="w-full flex items-center justify-between p-2.5 text-left hover:bg-slate-50 transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center text-[9px] font-black">{idx + 1}</span>
                <span className="text-[10px] font-black text-slate-700">{cluster.topic}</span>
                <span className="text-[8px] text-slate-400 font-bold">{cluster.paperIds.length} 篇</span>
              </div>
              <i className={`fa-solid fa-chevron-down text-[8px] text-slate-400 transition-transform ${expanded === cluster.topic ? 'rotate-180' : ''}`}></i>
            </button>
            {expanded === cluster.topic && (
              <div className="px-3 pb-3 space-y-2 border-t border-slate-50">
                <p className="text-[9px] text-slate-600 leading-relaxed pt-2">{cluster.aiSummary}</p>
                <p className="text-[8px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded font-bold">
                  <i className="fa-solid fa-arrow-trend-up mr-1"></i>趋势: {cluster.trendInsight}
                </p>
                {cluster.paperIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {cluster.paperIds.map(pid => {
                      const paper = feedItems.find(f => f.id === pid);
                      return paper ? (
                        <span key={pid} className="text-[7px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold truncate max-w-[200px]">
                          {paper.title?.substring(0, 25)}...
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubscriptionPanel;
