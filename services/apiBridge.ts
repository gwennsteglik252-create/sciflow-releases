/**
 * SciFlow Pro API Bridge (渲染进程侧)
 * 
 * 在 window.__sciflowAPI__ 上注册方法供主进程的 HTTP API Server
 * 通过 executeJavaScript 调用。这是主进程 ↔ 渲染进程的 IPC 桥接层。
 * 
 * v2: 增加中级（文件系统协作）& 高级（事件系统联动）支持
 */

import { PersistenceService } from './persistence';
import { callGeminiWithRetry } from './gemini/core';
import { workflowEngine } from './ai/workflowEngine';
import {
    parseXrdData, detectPeaks, detectPeaksDetailed,
    calculateBraggD, calculateScherrer, autoTunePeakParams,
    applySGSmoothing, removeBackground, normalizeData,
    XRD_SOURCES,
    type DataPoint, type XrdPeak, type PeakDetectConfig
} from '../components/DataAnalysis/xrdUtils';

// 延迟初始化的 persistence 实例
let persistenceInstance: PersistenceService | null = null;

const getPersistence = async (): Promise<PersistenceService> => {
    if (!persistenceInstance) {
        persistenceInstance = new PersistenceService();
        await persistenceInstance.init();
    }
    return persistenceInstance;
};

// ═══ 事件缓冲区（供 SSE 推送） ═══
const eventBuffer: Array<{ id: string; type: string; data: any; timestamp: string }> = [];
const MAX_EVENT_BUFFER = 200;

const pushEvent = (type: string, data: any) => {
    eventBuffer.unshift({
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type,
        data,
        timestamp: new Date().toISOString(),
    });
    if (eventBuffer.length > MAX_EVENT_BUFFER) {
        eventBuffer.length = MAX_EVENT_BUFFER;
    }
};

// 自动捕获关键事件到缓冲区
if (typeof window !== 'undefined') {
    window.addEventListener('sciflow-workflow-completed', ((e: CustomEvent) => {
        pushEvent('workflow_completed', e.detail);
    }) as EventListener);

    window.addEventListener('sciflow-pipeline-complete', ((e: CustomEvent) => {
        pushEvent('pipeline_complete', e.detail);
    }) as EventListener);

    window.addEventListener('sciflow_settings_updated', ((e: CustomEvent) => {
        pushEvent('settings_updated', { keys: Object.keys(e.detail || {}) });
    }) as EventListener);

    window.addEventListener('sciflow_ai_pacing_event', ((e: CustomEvent) => {
        pushEvent('ai_pacing', e.detail);
    }) as EventListener);

    window.addEventListener('sciflow_no_api_key', (() => {
        pushEvent('no_api_key', { message: 'No AI API key configured' });
    }) as EventListener);
}

/**
 * 注册到 window.__sciflowAPI__ 的方法集合。
 * 每个方法都会被主进程通过 webContents.executeJavaScript() 调用。
 */
const sciflowAPI = {
    // ═══ 基础层 ═══

    // ── 设置 ──
    getSettings: (): any => {
        try {
            const raw = localStorage.getItem('sciflow_app_settings');
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    },

    updateSettings: (updates: Record<string, any>): void => {
        try {
            const raw = localStorage.getItem('sciflow_app_settings');
            const current = raw ? JSON.parse(raw) : {};
            const next = { ...current, ...updates };
            localStorage.setItem('sciflow_app_settings', JSON.stringify(next));
            window.dispatchEvent(new CustomEvent('sciflow_settings_updated', { detail: next }));
        } catch (e) {
            console.error('[API Bridge] updateSettings failed:', e);
        }
    },

    // ── 项目列表 ──
    getProjects: async (): Promise<any[]> => {
        try {
            const persistence = await getPersistence();
            return await persistence.getAll('projects');
        } catch (e) {
            console.error('[API Bridge] getProjects failed:', e);
            return [];
        }
    },

    // ── 情报档案（文献列表） ──
    getResources: async (): Promise<any[]> => {
        try {
            const persistence = await getPersistence();
            return await persistence.getAll('resources');
        } catch (e) {
            console.error('[API Bridge] getResources failed:', e);
            return [];
        }
    },

    // ── AI 对话 ──
    aiChat: async (prompt: string, model?: string): Promise<any> => {
        try {
            const response = await callGeminiWithRetry(async (ai: any) => {
                return ai.models.generateContent({
                    model: model || undefined,
                    contents: prompt,
                });
            });
            const text = typeof response.text === 'string' ? response.text : String((response as any).text || '');
            pushEvent('ai_response', { model: model || 'auto', promptLength: prompt.length, responseLength: text.length });
            return { text, model: model || 'auto' };
        } catch (e: any) {
            pushEvent('ai_error', { error: e.message });
            console.error('[API Bridge] aiChat failed:', e);
            return { error: e.message || 'AI call failed', text: '' };
        }
    },

    // ── AI 使用指标 ──
    getAiMetrics: (): any => {
        try {
            const raw = localStorage.getItem('sciflow_ai_metrics_v1');
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    },

    // ═══ ⭐⭐ 中级：文件系统协作 ═══

    // ── 工作流规则管理 ──
    getWorkflowRules: (): any[] => {
        return workflowEngine.getRules();
    },

    addWorkflowRule: (rule: any): any => {
        try {
            const newRule = workflowEngine.registerRule(rule);
            pushEvent('workflow_rule_created', { ruleId: newRule.id, name: newRule.name });
            return newRule;
        } catch (e) {
            console.error('[API Bridge] addWorkflowRule failed:', e);
            return null;
        }
    },

    deleteWorkflowRule: (ruleId: string): boolean => {
        try {
            workflowEngine.deleteRule(ruleId);
            pushEvent('workflow_rule_deleted', { ruleId });
            return true;
        } catch { return false; }
    },

    // ── 工作流手动触发 ──
    triggerWorkflow: async (ruleId: string, fileContext?: any): Promise<any> => {
        try {
            const log = await workflowEngine.triggerRule(ruleId, fileContext);
            return log;
        } catch (e: any) {
            console.error('[API Bridge] triggerWorkflow failed:', e);
            return { error: e.message };
        }
    },

    // ── 工作流执行日志 ──
    getWorkflowLogs: (): any[] => {
        return workflowEngine.getLogs();
    },

    clearWorkflowLogs: (): void => {
        workflowEngine.clearLogs();
    },

    // ── 一键配置 OpenClaw 导入管道 ──
    setupPipeline: (basePath: string, customTypes?: any[]): any[] => {
        try {
            return workflowEngine.setupIncomingPipeline({
                basePath,
                types: customTypes,
            });
        } catch (e: any) {
            console.error('[API Bridge] setupPipeline failed:', e);
            return [];
        }
    },

    // ── 文献资源导入 ──
    addResource: async (resource: any): Promise<any> => {
        try {
            const persistence = await getPersistence();
            await persistence.putOne('resources', resource);
            pushEvent('resource_added', { id: resource.id, title: resource.title });
            return resource;
        } catch (e: any) {
            console.error('[API Bridge] addResource failed:', e);
            return null;
        }
    },

    // ═══ ⭐⭐⭐ 高级：事件系统联动 ═══

    // ── 广播自定义事件到渲染进程 ──
    broadcastEvent: (eventName: string, detail: any): void => {
        try {
            window.dispatchEvent(new CustomEvent(eventName, { detail }));
            pushEvent('broadcast', { eventName });
        } catch (e) {
            console.error('[API Bridge] broadcastEvent failed:', e);
        }
    },

    // ── 事件缓冲区查询（供 SSE/轮询） ──
    getEvents: (since?: string, limit?: number): any[] => {
        let events = eventBuffer;
        if (since) {
            const sinceTime = new Date(since).getTime();
            events = events.filter(e => new Date(e.timestamp).getTime() > sinceTime);
        }
        return events.slice(0, limit || 50);
    },

    getEventCount: (): number => eventBuffer.length,

    // ── 读取渲染进程内部状态 ──
    getInternalState: (): any => {
        return {
            workflowRules: workflowEngine.getRules().length,
            workflowLogs: workflowEngine.getLogs().length,
            eventBuffer: eventBuffer.length,
            apiRegistered: true,
            timestamp: new Date().toISOString(),
        };
    },

    // ═══ 项目上下文感知 AI ═══

    /** 获取指定项目的完整上下文摘要（供 AI prompt 注入） */
    getProjectContext: async (projectId: string): Promise<any> => {
        try {
            const persistence = await getPersistence();
            const projects = await persistence.getAll('projects');
            const project: any = projects.find((p: any) => p.id === projectId);
            if (!project) return { error: `Project not found: ${projectId}` };

            // 提取里程碑树摘要
            const milestonesSummary = (project.milestones || []).map((m: any) => ({
                id: m.id,
                title: m.title,
                hypothesis: m.hypothesis,
                status: m.status,
                dueDate: m.dueDate,
                logCount: m.logs?.length || 0,
                recentLogs: (m.logs || []).slice(-3).map((l: any) => ({
                    content: l.content?.slice(0, 200),
                    result: l.result,
                    status: l.status,
                    parameters: l.parameters?.slice(0, 150),
                })),
            }));

            // 提取目标指标
            const targetMetrics = project.targetMetrics || [];

            // 提取关键实验数据（最近的成功/异常实验）
            const allLogs: any[] = [];
            for (const ms of (project.milestones || [])) {
                for (const log of (ms.logs || [])) {
                    allLogs.push({ ...log, milestoneName: ms.title });
                }
            }
            const keyLogs = allLogs
                .filter((l: any) => l.result === 'success' || l.status === 'Anomaly')
                .slice(-5)
                .map((l: any) => ({
                    milestone: l.milestoneName,
                    content: l.content?.slice(0, 300),
                    result: l.result,
                    parameters: l.parameters?.slice(0, 200),
                    scientificData: l.scientificData,
                }));

            // 提取已引用文献
            let citedLiterature: any[] = [];
            if (project.citedLiteratureIds?.length) {
                const resources = await persistence.getAll('resources');
                citedLiterature = resources
                    .filter((r: any) => project.citedLiteratureIds.includes(r.id))
                    .slice(0, 10)
                    .map((r: any) => ({
                        title: r.title,
                        authors: r.authors,
                        tags: r.tags || r.categories,
                    }));
            }

            return {
                projectId: project.id,
                title: project.title,
                category: project.category,
                description: project.description?.slice(0, 500),
                status: project.status,
                progress: project.progress,
                trl: project.trl,
                keywords: project.keywords,
                members: project.members,
                targetMetrics,
                milestones: milestonesSummary,
                keyExperiments: keyLogs,
                citedLiterature,
            };
        } catch (e: any) {
            console.error('[API Bridge] getProjectContext failed:', e);
            return { error: e.message };
        }
    },

    /** 上下文感知 AI 对话：自动注入项目背景 */
    contextualAiChat: async (projectId: string, prompt: string, options?: any): Promise<any> => {
        try {
            // 1. 收集项目上下文
            const ctx = await sciflowAPI.getProjectContext(projectId);
            if (ctx.error) return { error: ctx.error, text: '' };

            // 2. 构建系统级上下文 prompt
            const contextBlocks: string[] = [];
            contextBlocks.push(`## 项目信息\n- 名称: ${ctx.title}\n- 领域: ${ctx.category}\n- 进度: ${ctx.progress}% (TRL ${ctx.trl})\n- 关键词: ${(ctx.keywords || []).join('、')}`);

            if (ctx.description) {
                contextBlocks.push(`## 项目描述\n${ctx.description}`);
            }

            if (ctx.targetMetrics?.length) {
                const metrics = ctx.targetMetrics.map((m: any) => `${m.label}: ${m.value}${m.unit || ''}`).join('; ');
                contextBlocks.push(`## 目标指标\n${metrics}`);
            }

            if (ctx.milestones?.length) {
                const msText = ctx.milestones.map((m: any) =>
                    `- [${m.status}] ${m.title} (假设: ${m.hypothesis || '无'}, 实验: ${m.logCount}组)`
                ).join('\n');
                contextBlocks.push(`## 研究节点（里程碑）\n${msText}`);
            }

            if (ctx.keyExperiments?.length) {
                const expText = ctx.keyExperiments.map((e: any) =>
                    `- [${e.result}] ${e.milestone}: ${e.content}`
                ).join('\n');
                contextBlocks.push(`## 关键实验结果\n${expText}`);
            }

            if (ctx.citedLiterature?.length) {
                const litText = ctx.citedLiterature.map((l: any) => `- ${l.title}`).join('\n');
                contextBlocks.push(`## 已引用文献\n${litText}`);
            }

            const systemContext = `你是 SciFlow Pro 科研助手。以下是当前课题的完整上下文，请基于这些信息回答问题。\n\n${contextBlocks.join('\n\n')}`;

            const fullPrompt = `${systemContext}\n\n---\n\n## 用户问题\n${prompt}`;

            // 3. 调用 AI
            const response = await callGeminiWithRetry(async (ai: any) => {
                return ai.models.generateContent({
                    model: options?.model || undefined,
                    contents: fullPrompt,
                });
            });

            const text = typeof response.text === 'string' ? response.text : String((response as any).text || '');
            pushEvent('contextual_ai_response', {
                projectId, model: options?.model || 'auto',
                promptLength: fullPrompt.length, responseLength: text.length,
                contextSize: contextBlocks.length,
            });
            return { text, model: options?.model || 'auto', contextIncluded: contextBlocks.length };
        } catch (e: any) {
            pushEvent('contextual_ai_error', { projectId, error: e.message });
            console.error('[API Bridge] contextualAiChat failed:', e);
            return { error: e.message || 'Contextual AI call failed', text: '' };
        }
    },

    // ═══ XRD 表征分析引擎 ═══

    /** 直接分析 XRD 原始数据 */
    analyzeXrd: (rawDataText: string, options?: any): any => {
        try {
            const wavelengthNm = options?.wavelength || XRD_SOURCES['Cu Ka'];
            const maxPeaks = options?.maxPeaks || 'auto';
            const mode = options?.mode || 'balanced';

            // 1. 解析原始数据
            const rawPoints = parseXrdData(rawDataText);
            if (rawPoints.length < 5) {
                return { error: 'Too few data points. Need at least 5 rows of (2theta, intensity) data.' };
            }

            // 2. 自动参数调优（数据诊断）
            const tuneResult = autoTunePeakParams(rawPoints);

            // 3. 数据预处理：平滑 → 扣背景 → 归一化
            const smoothed = applySGSmoothing(rawPoints);
            const bgRemoved = removeBackground(smoothed);
            const normalized = normalizeData(bgRemoved);

            // 4. 寻峰（使用自动调优参数或用户覆盖）
            const peakConfig: PeakDetectConfig = {
                mode: mode || tuneResult.config.mode,
                maxPeaks: maxPeaks === 'auto' ? tuneResult.config.maxPeaks : maxPeaks,
                minPeakDistanceDeg: options?.minPeakDistance || tuneResult.config.minPeakDistanceDeg,
                minProminencePercent: options?.minProminence || tuneResult.config.minProminencePercent,
                smoothingPasses: tuneResult.config.smoothingPasses,
            };
            const peakResult = detectPeaksDetailed(bgRemoved, peakConfig);

            // 5. 对每个峰计算 Bragg d-spacing 和 Scherrer 晶粒尺寸
            const analyzedPeaks = peakResult.peaks.map((peak: XrdPeak) => ({
                id: peak.id,
                twoTheta: parseFloat(peak.twoTheta.toFixed(3)),
                intensity: parseFloat(peak.intensity.toFixed(1)),
                relativeIntensity: parseFloat((peak.intensity / (peakResult.peaks[0]?.intensity || 1) * 100).toFixed(1)),
                fwhm: parseFloat(peak.fwhm.toFixed(4)),
                dSpacing_nm: parseFloat(calculateBraggD(peak.twoTheta, wavelengthNm).toFixed(4)),
                dSpacing_angstrom: parseFloat((calculateBraggD(peak.twoTheta, wavelengthNm) * 10).toFixed(3)),
                grainSize_nm: parseFloat(calculateScherrer(peak.fwhm, peak.twoTheta, wavelengthNm).toFixed(2)),
                label: peak.label || null,
            }));

            // 6. 统计摘要
            const avgGrainSize = analyzedPeaks.length > 0
                ? parseFloat((analyzedPeaks.reduce((s: number, p: any) => s + p.grainSize_nm, 0) / analyzedPeaks.length).toFixed(2))
                : 0;

            const twoThetaRange = rawPoints.length > 0
                ? { min: parseFloat(rawPoints[0].x.toFixed(2)), max: parseFloat(rawPoints[rawPoints.length - 1].x.toFixed(2)) }
                : { min: 0, max: 0 };

            pushEvent('xrd_analysis_completed', { peakCount: analyzedPeaks.length, dataPoints: rawPoints.length });

            return {
                dataPoints: rawPoints.length,
                twoThetaRange,
                wavelength: { value: wavelengthNm, unit: 'nm', source: options?.source || 'Cu Kα' },
                // 数据诊断
                diagnosis: {
                    noiseLevel: tuneResult.diagnosis.noiseLevel,
                    snr: tuneResult.diagnosis.snr,
                    estimatedPeakCount: tuneResult.diagnosis.estimatedPeakCount,
                    recommendedMode: tuneResult.diagnosis.recommendedMode,
                    summary: tuneResult.summary,
                },
                // 寻峰结果
                peaks: analyzedPeaks,
                peakStats: {
                    detected: peakResult.stats.finalCount,
                    candidatesEvaluated: peakResult.stats.candidateCount,
                    merged: peakResult.stats.mergedCount,
                },
                // 统计
                statistics: {
                    avgGrainSize_nm: avgGrainSize,
                    strongestPeak: analyzedPeaks[0] || null,
                    crystallinity: analyzedPeaks.length > 3 ? 'polycrystalline' : analyzedPeaks.length > 0 ? 'low crystallinity' : 'amorphous',
                },
                // 用于复现的配置
                configUsed: peakConfig,
            };
        } catch (e: any) {
            console.error('[API Bridge] analyzeXrd failed:', e);
            return { error: e.message || 'XRD analysis failed' };
        }
    },

    /** 获取支持的 XRD 射线源列表 */
    getXrdSources: (): any => XRD_SOURCES,
};

// 注册到 window 全局对象
(window as any).__sciflowAPI__ = sciflowAPI;

console.log('[API Bridge] ✅ window.__sciflowAPI__ v3 registered with', Object.keys(sciflowAPI).length, 'methods:', Object.keys(sciflowAPI));

export default sciflowAPI;
