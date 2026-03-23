import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../locales/useTranslation';

const AI_METRICS_STORAGE_KEY = 'sciflow_ai_metrics_v1';

type MetricsBucket = {
  requests: number;
  cacheHits: number;
  dedupHits: number;
  networkRequests: number;
  successResponses: number;
  failedResponses: number;
  totalLatencyMs: number;
  latencySamples: number;
};

type MetricsSnapshot = MetricsBucket & {
  byTaskType: Record<string, MetricsBucket>;
  byProvider: Record<string, MetricsBucket>;
  recentRequests: Array<{
    id: string;
    at: number;
    taskType: string;
    provider?: string;
    source: 'cache' | 'dedup' | 'network';
    result: 'success' | 'failure';
    durationMs?: number;
  }>;
  updatedAt: number;
};

const emptyMetrics = (): MetricsSnapshot => ({
  requests: 0,
  cacheHits: 0,
  dedupHits: 0,
  networkRequests: 0,
  successResponses: 0,
  failedResponses: 0,
  totalLatencyMs: 0,
  latencySamples: 0,
  byTaskType: {},
  byProvider: {},
  recentRequests: [],
  updatedAt: 0
});

const AiAssistantStatus = ({ message }: { message: string | null }) => {
  const { t } = useTranslation();
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [pacingInfo, setPacingInfo] = useState<{ active: boolean, delay?: number } | null>(null);
  const [metrics, setMetrics] = useState<MetricsSnapshot>(emptyMetrics());
  const [showMetricsPanel, setShowMetricsPanel] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AI_METRICS_STORAGE_KEY);
      if (raw) setMetrics({ ...emptyMetrics(), ...JSON.parse(raw) });
    } catch (e) {
      console.warn('[AiAssistantStatus] Failed to parse metrics from localStorage:', e);
    }

    const handleRouterEvent = (e: any) => {
        setActiveModel(e.detail.info);
    };
    const handlePacingEvent = (e: any) => {
        setPacingInfo(e.detail);
        if (e.detail.active) {
            setTimeout(() => setPacingInfo(null), (e.detail.delay || 5) * 1000 + 1000);
        }
    };
    const handleMetricsEvent = (e: any) => {
      setMetrics({ ...emptyMetrics(), ...(e.detail || {}) });
    };

    window.addEventListener('sciflow_ai_router_event', handleRouterEvent);
    window.addEventListener('sciflow_ai_pacing_event', handlePacingEvent);
    window.addEventListener('sciflow_ai_metrics_event', handleMetricsEvent);
    return () => {
        window.removeEventListener('sciflow_ai_router_event', handleRouterEvent);
        window.removeEventListener('sciflow_ai_pacing_event', handlePacingEvent);
        window.removeEventListener('sciflow_ai_metrics_event', handleMetricsEvent);
    };
  }, []);

  const cacheHitRate = metrics.requests > 0 ? ((metrics.cacheHits + metrics.dedupHits) / metrics.requests) * 100 : 0;
  const avgLatencyMs = metrics.latencySamples > 0 ? metrics.totalLatencyMs / metrics.latencySamples : 0;
  const successRate = (metrics.successResponses + metrics.failedResponses) > 0
    ? (metrics.successResponses / (metrics.successResponses + metrics.failedResponses)) * 100
    : 0;
  const topTaskTypes = Object.entries(metrics.byTaskType || {})
    .sort((a, b) => (b[1]?.requests || 0) - (a[1]?.requests || 0))
    .slice(0, 5);

  const clearMetrics = () => {
    const reset = emptyMetrics();
    setMetrics(reset);
    try { localStorage.setItem(AI_METRICS_STORAGE_KEY, JSON.stringify(reset)); } catch { }
  };

  return (
    <div className="mx-3 mb-4">
      {(message || (pacingInfo && pacingInfo.active)) && (
        <div className={`rounded-xl p-3 border animate-reveal relative overflow-hidden group transition-colors duration-500 ${pacingInfo?.active ? 'bg-rose-900/60 border-rose-500/30' : 'bg-indigo-900/40 border-white/10'}`}>
           <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                 <span className={`w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.6)] ${pacingInfo?.active ? 'bg-rose-400' : 'bg-indigo-400'}`}></span>
                 <span className={`text-[9px] font-black uppercase tracking-widest animate-pulse leading-none ${pacingInfo?.active ? 'text-rose-200' : 'text-indigo-200'}`}>
                    {pacingInfo?.active ? t('aiMetrics.apiBusy', { delay: pacingInfo.delay || 0 }) : message}
                 </span>
              </div>
              
              {activeModel && !pacingInfo?.active && (
                <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-1 duration-300">
                    <i className="fa-solid fa-microchip text-[7px] text-indigo-400/60"></i>
                    <span className="text-[7px] font-bold text-indigo-300/50 uppercase tracking-tighter">Powered by {activeModel}</span>
                </div>
              )}
           </div>
           
           <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-white/10">
              <div className={`h-full w-1/3 animate-[progress_2s_ease-in-out_infinite] ${pacingInfo?.active ? 'bg-rose-400' : 'bg-[#6366f1]'}`}></div>
           </div>
        </div>
      )}
      <div className="mt-2 rounded-xl border border-white/10 bg-slate-900/45 overflow-hidden">
        <button
          onClick={() => setShowMetricsPanel(v => !v)}
          className="w-full h-9 px-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-chart-line text-[10px] text-cyan-300/80"></i>
            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-200/90">{t('aiMetrics.cacheHitLog')}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-cyan-300">{cacheHitRate.toFixed(1)}%</span>
            <i className={`fa-solid fa-chevron-${showMetricsPanel ? 'up' : 'down'} text-[9px] text-cyan-200/70`}></i>
          </div>
        </button>
        {showMetricsPanel && (
          <div className="px-3 pb-3 space-y-2.5 border-t border-white/10">
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2">
                <div className="text-[9px] text-cyan-100/70">{t('aiMetrics.totalRequests')}</div>
                <div className="text-[13px] font-black text-cyan-200">{metrics.requests}</div>
              </div>
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-2">
                <div className="text-[9px] text-cyan-100/70">{t('aiMetrics.hitRate')}</div>
                <div className="text-[13px] font-black text-cyan-200">{cacheHitRate.toFixed(1)}%</div>
              </div>
              <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-2">
                <div className="text-[9px] text-indigo-100/70">{t('aiMetrics.avgLatency')}</div>
                <div className="text-[13px] font-black text-indigo-200">{avgLatencyMs.toFixed(0)} ms</div>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2">
                <div className="text-[9px] text-emerald-100/70">{t('aiMetrics.successRate')}</div>
                <div className="text-[13px] font-black text-emerald-200">{successRate.toFixed(1)}%</div>
              </div>
            </div>

            {topTaskTypes.length > 0 && (
              <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-300 mb-1.5">{t('aiMetrics.byTaskType')}</div>
                <div className="space-y-1.5">
                  {topTaskTypes.map(([task, stat]) => {
                    const taskHitRate = stat.requests > 0 ? ((stat.cacheHits + stat.dedupHits) / stat.requests) * 100 : 0;
                    const taskAvg = stat.latencySamples > 0 ? stat.totalLatencyMs / stat.latencySamples : 0;
                    return (
                      <div key={task} className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-200 font-bold">{task}</span>
                        <span className="text-slate-400">N={stat.requests} | H={taskHitRate.toFixed(0)}% | {taskAvg.toFixed(0)}ms</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-white/10 bg-black/20 p-2">
              <div className="text-[9px] font-black uppercase tracking-wider text-slate-300 mb-1.5">{t('aiMetrics.recentHistory')}</div>
              {metrics.recentRequests && metrics.recentRequests.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {metrics.recentRequests.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 text-[10px]">
                      <div className="min-w-0 flex items-center gap-1.5">
                        <span className="text-slate-500 shrink-0">{new Date(r.at).toLocaleTimeString()}</span>
                        <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black shrink-0 ${
                          r.source === 'cache'
                            ? 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10'
                            : r.source === 'dedup'
                              ? 'border-violet-500/30 text-violet-300 bg-violet-500/10'
                              : 'border-indigo-500/30 text-indigo-300 bg-indigo-500/10'
                        }`}>
                          {r.source}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black shrink-0 ${
                          r.result === 'success'
                            ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10'
                            : 'border-rose-500/30 text-rose-300 bg-rose-500/10'
                        }`}>
                          {r.result}
                        </span>
                        <span className="text-slate-200 font-bold truncate">{r.taskType}</span>
                        {r.provider && <span className="text-slate-500 shrink-0">{r.provider}</span>}
                      </div>
                      <span className="text-slate-400 shrink-0">{typeof r.durationMs === 'number' ? `${Math.round(r.durationMs)}ms` : '--'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-slate-500">{t('aiMetrics.noRequests')}</div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[9px] text-slate-400">
                {t('aiMetrics.updatedAt')} {metrics.updatedAt ? new Date(metrics.updatedAt).toLocaleTimeString() : '--:--:--'}
              </span>
              <button
                onClick={clearMetrics}
                className="h-6 px-2 rounded-md border border-rose-500/30 text-[9px] font-black text-rose-300 hover:bg-rose-500/10"
              >
                {t('aiMetrics.clear')}
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
};

export default AiAssistantStatus;
