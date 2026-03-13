
import React, { useEffect, useRef, useState } from 'react';
import { Milestone, ExperimentLog, ExperimentFile } from '../../types';
import MetricSnapshot from '../Visuals/MetricSnapshot';
import LogDeepAnalysisView from './LogDeepAnalysisView';
import ModuleRadarGroup, { SyncedModuleItem } from './ModuleRadarGroup';
import LaTeXText from '../Common/LaTeXText';
import ScientificMarkdown from '../Common/ScientificMarkdown';
import CompactMarkdown from '../Common/CompactMarkdown';
import { useProjectContext } from '../../context/ProjectContext';
import { getFileIcon } from './LogModalSub/LogFiles';
import { callGeminiWithRetry, FAST_MODEL, SPEED_CONFIG } from '../../services/gemini/core';

interface DataLaboratoryProps {
    selectedMilestone: Milestone | undefined;
    isCompareMode: boolean;
    selectedLogsForComparison: Set<string>;
    onToggleCompareMode: () => void;
    onSelectForCompare: (id: string) => void;
    onCompareLogs: () => void;
    onCompareLogsToMatrix?: (id: string) => void;
    // Fix: Removed duplicate onGenerateBriefing property
    onGenerateBriefing: () => void;
    onStartAiChat: () => void;
    onStartLogChat: (log: ExperimentLog) => void;
    onOpenLogModal: (log?: ExperimentLog) => void;
    onOpenDocuments: () => void;
    onOpenArchives: () => void;
    onDiagnoseLog: (log: ExperimentLog) => void;
    onSummarizeLog: (log: ExperimentLog) => void;
    onAnalyzeMechanism: (log: ExperimentLog) => void;
    onFullAnalysis: (log: ExperimentLog) => void;
    onDeleteLog: (id: string) => void;
    onUpdateLog?: (log: ExperimentLog) => void;
    isAiLoading: boolean;
    expandedLogIds: Set<string>;
    onToggleLogExpansion: (id: string) => void;
    expandedInsightIds: Set<string>;
    onToggleInsightCollapse: (id: string, e: React.MouseEvent) => void;
    onShowInsightView: (title: string, content: string) => void;
    highlightLogId?: string | null;
    projectTargets?: { label: string; value: string; unit?: string; weight?: number; isHigherBetter?: boolean }[];
    onTracePlan?: (planId: string) => void;
}

const DataLaboratory: React.FC<DataLaboratoryProps> = ({
    selectedMilestone, isCompareMode, selectedLogsForComparison, onToggleCompareMode, onSelectForCompare, onCompareLogs,
    onGenerateBriefing, onStartAiChat, onStartLogChat, onOpenLogModal, onOpenDocuments, onOpenArchives, onDiagnoseLog, onSummarizeLog, onAnalyzeMechanism, onFullAnalysis, onDeleteLog, onUpdateLog, isAiLoading,
    expandedLogIds, onToggleLogExpansion, expandedInsightIds, onToggleInsightCollapse, onShowInsightView,
    highlightLogId, projectTargets, onTracePlan
}) => {
    const { navigate, showToast, setAiStatus } = useProjectContext();
    const logRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [openInsights, setOpenInsights] = useState<Record<string, Set<'audit' | 'mechanism' | 'summary' | 'compliance' | 'sample'>>>({});
    const [previewImage, setPreviewImage] = useState<{ url: string, name: string } | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
    const [analyzingSampleIds, setAnalyzingSampleIds] = useState<Set<string>>(new Set());
    const [analyzingGroupIds, setAnalyzingGroupIds] = useState<Set<string>>(new Set());
    const [expandedGroupInsight, setExpandedGroupInsight] = useState<Set<string>>(new Set());
    const [expandedDetailLogs, setExpandedDetailLogs] = useState<Set<string>>(new Set());
    const [isAttachmentFullscreen, setIsAttachmentFullscreen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const deleteTimerRef = useRef<any>(null);

    // 控制核心假设原位展开状态
    const [showFullHypothesis, setShowFullHypothesis] = useState(false);

    const toggleLocalInsight = (logId: string, text: 'audit' | 'mechanism' | 'summary' | 'compliance' | 'sample') => {
        setOpenInsights(prev => {
            const current = prev[logId] ? new Set(prev[logId]) : new Set<'audit' | 'mechanism' | 'summary' | 'compliance' | 'sample'>();
            if (current.has(text)) current.delete(text);
            else current.add(text);
            return { ...prev, [logId]: current };
        });
    };

    const openSampleInsight = (logId: string) => {
        setOpenInsights(prev => {
            const current = prev[logId] ? new Set(prev[logId]) : new Set<'audit' | 'mechanism' | 'summary' | 'compliance' | 'sample'>();
            current.add('sample');
            return { ...prev, [logId]: current };
        });
    };

    const toggleDetailPanel = (logId: string) => {
        setExpandedDetailLogs(prev => {
            const next = new Set(prev);
            if (next.has(logId)) next.delete(logId);
            else next.add(logId);
            return next;
        });
    };

    useEffect(() => {
        if (highlightLogId && logRefs.current[highlightLogId]) {
            logRefs.current[highlightLogId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [highlightLogId]);

    useEffect(() => {
        if (confirmDeleteId) {
            if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
            deleteTimerRef.current = setTimeout(() => {
                setConfirmDeleteId(null);
            }, 5000);
        }
        return () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); };
    }, [confirmDeleteId]);

    // 当切换节点时收起假设
    useEffect(() => {
        setShowFullHypothesis(false);
    }, [selectedMilestone?.id]);

    // 当切换节点时，默认折叠所有实验组，仅最新组展开
    useEffect(() => {
        const logs = selectedMilestone?.logs || [];
        const groupMap = new Map<string, ExperimentLog[]>();
        logs.forEach(log => {
            if (log.groupId) {
                if (!groupMap.has(log.groupId)) groupMap.set(log.groupId, []);
                groupMap.get(log.groupId)!.push(log);
            }
        });
        // 只保留实际成组的（组内 >= 2 条记录）
        const validGroupIds = Array.from(groupMap.entries())
            .filter(([, gl]) => gl.length > 1)
            .map(([gid]) => gid);

        if (validGroupIds.length === 0) {
            setCollapsedGroupIds(new Set());
            return;
        }

        // 找到最新的实验组：以组内最晚 timestamp 为准
        const getGroupLatestTime = (gid: string) => {
            const gLogs = groupMap.get(gid)!;
            return Math.max(...gLogs.map(l => {
                try { return new Date(l.timestamp.replace(/\//g, '-')).getTime(); } catch { return 0; }
            }));
        };
        let latestGroupId = validGroupIds[0];
        let latestTime = getGroupLatestTime(validGroupIds[0]);
        for (let i = 1; i < validGroupIds.length; i++) {
            const t = getGroupLatestTime(validGroupIds[i]);
            if (t > latestTime) { latestTime = t; latestGroupId = validGroupIds[i]; }
        }

        // 除最新组外，其余全部折叠
        const collapsed = new Set(validGroupIds.filter(gid => gid !== latestGroupId));
        setCollapsedGroupIds(collapsed);
    }, [selectedMilestone?.id, selectedMilestone?.logs]);

    useEffect(() => {
        const onFullscreenChange = () => {
            setIsAttachmentFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, []);

    const handleOpenFile = async (file: ExperimentFile) => {
        if (file.localPath && window.electron && window.electron.openPath) {
            try { await window.electron.openPath(file.localPath); } catch (e) { alert("路径无效。"); }
            return;
        }
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name) || (file.url && file.url.startsWith('data:image'));
        if (isImage && file.url && file.url !== '#') {
            setPreviewImage({ url: file.url, name: file.name });
            return;
        }
        if (file.url && file.url !== '#') window.open(file.url, '_blank');
    };

    const handleAnalyzeSampleAppearance = async (log: ExperimentLog) => {
        if (!log.samplePhoto) {
            showToast?.({ message: '请先上传样品照片', type: 'warning' });
            return;
        }
        if (!onUpdateLog) {
            showToast?.({ message: '当前视图不支持回写，请先进入可编辑模式', type: 'warning' });
            return;
        }

        const getInlineData = async (): Promise<{ mimeType: string; data: string } | null> => {
            const photo = log.samplePhoto as any;
            if (photo?.url?.startsWith('data:image')) {
                const match = photo.url.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
                if (match) return { mimeType: match[1], data: match[2] };
            }
            if (photo?.localPath && window.electron?.readFile) {
                const fileData = await window.electron.readFile(photo.localPath);
                if (fileData?.mimeType?.startsWith('image/') && fileData.data) {
                    return { mimeType: fileData.mimeType, data: fileData.data };
                }
            }
            return null;
        };

        setAnalyzingSampleIds(prev => new Set(prev).add(log.id));
        openSampleInsight(log.id);
        setAiStatus?.('🧪 正在执行样品表观分析...');
        try {
            const inlineData = await getInlineData();
            if (!inlineData) throw new Error('样品照片数据不可用');

            const prompt = `你是一位材料科学研究员。请结合实验记录文本与样品照片，对样品表观做专业分析。
要求：
1) 用中文输出，简洁分点。
2) 必须包含：颜色/均匀性、形貌特征（颗粒/片层/团聚）、潜在异常风险、与实验步骤一致性、下一步验证建议。
3) 避免编造仪器数据，只做可视层面的判断并标注不确定性。

实验名称：
${log.content || '未命名实验'}

实验记录：
${log.description || '无'}
`;

            const analysisText = await callGeminiWithRetry(async (ai) => {
                const response = await ai.models.generateContent({
                    model: FAST_MODEL,
                    contents: [{
                        role: 'user',
                        parts: [
                            { text: prompt },
                            { inlineData }
                        ]
                    }],
                    config: {
                        ...SPEED_CONFIG,
                        temperature: 0.2
                    }
                });
                return response.text || '';
            });

            onUpdateLog({
                ...log,
                sampleAppearanceInsight: String(analysisText || '').trim()
            });
            openSampleInsight(log.id);
            showToast?.({ message: '样品表观分析完成', type: 'success' });
        } catch (e) {
            console.error('[DataLaboratory][handleAnalyzeSampleAppearance] 失败', e);
            showToast?.({ message: '样品表观分析失败，请检查模型配置', type: 'error' });
        } finally {
            setAnalyzingSampleIds(prev => {
                const next = new Set(prev);
                next.delete(log.id);
                return next;
            });
            setAiStatus?.(null);
        }
    };

    const toggleAttachmentFullscreen = async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
                return;
            }
            if (containerRef.current?.requestFullscreen) {
                await containerRef.current.requestFullscreen();
            }
        } catch (error) {
            console.error('[DataLaboratory][toggleAttachmentFullscreen] 失败', error);
            showToast?.({ message: '全屏切换失败，请重试', type: 'error' });
        }
    };

    // ── 实验组 AI 对比分析 ──
    const handleAnalyzeGroup = async (groupId: string, groupLogs: ExperimentLog[], diffKeys: Set<string>) => {
        if (analyzingGroupIds.has(groupId) || !onUpdateLog) return;
        setAnalyzingGroupIds(prev => new Set(prev).add(groupId));
        setExpandedGroupInsight(prev => new Set(prev).add(groupId));
        setAiStatus?.('🔬 正在执行对照组对比分析...');

        try {
            // 序列化组内所有实验数据（含表征模块）
            const logsContext = groupLogs.map((log, idx) => {
                const params = log.parameterList && log.parameterList.length > 0
                    ? log.parameterList.map((p: { key: string; value: string; unit: string }) => `  ${p.key}: ${p.value} ${p.unit || ''}`).join('\n')
                    : (log.parameters || '无');
                const metrics = log.scientificData
                    ? Object.entries(log.scientificData).map(([k, v]) => `  ${k}: ${v}`).join('\n')
                    : '无';
                // 提取该条实验关联的表征模块
                const logModules = extractSyncedModules(log);
                const charPart = logModules.length > 0
                    ? logModules.map(m => {
                        const metricStr = m.metrics && Object.keys(m.metrics).length > 0
                            ? Object.entries(m.metrics).map(([mk, mv]) => `${mk}: ${mv}`).join(', ')
                            : '';
                        return `  [${m.moduleLabel || m.mode || '表征'}] ${m.summary || ''}${metricStr ? ' | 指标: ' + metricStr : ''}`;
                    }).join('\n')
                    : '';
                return `### 实验 ${idx + 1}: ${log.content}\n- 状态: ${log.status} | 结果: ${log.result}\n- 参数:\n${params}\n- 性能指标:\n${metrics}${charPart ? '\n- 关联表征:\n' + charPart : ''}\n- 描述: ${log.description || '无'}`;
            }).join('\n\n');

            // 序列化组级表征模块
            const groupModules: SyncedModuleItem[] = (groupLogs.find(l => Array.isArray((l as any).groupSyncedModules)) as any)?.groupSyncedModules || [];
            const groupCharContext = groupModules.length > 0
                ? '\n\n### 组表征分析数据\n' + groupModules.map(m => {
                    const metricStr = m.metrics && Object.keys(m.metrics).length > 0
                        ? Object.entries(m.metrics).map(([mk, mv]) => `${mk}: ${mv}`).join(', ')
                        : '';
                    const analysisSummary = m.aiDeepAnalysis
                        ? (m.aiDeepAnalysis.length > 500 ? m.aiDeepAnalysis.slice(0, 500) + '...' : m.aiDeepAnalysis)
                        : '';
                    return `- [${m.moduleLabel || m.mode || '表征'}] ${m.summary || ''}${metricStr ? ' | 指标: ' + metricStr : ''}${analysisSummary ? '\n  AI分析摘要: ' + analysisSummary : ''}`;
                }).join('\n')
                : '';

            const diffKeysStr = diffKeys.size > 0 ? Array.from(diffKeys).join('、') : '无明显差异列';
            const groupLabel = groupLogs.find(l => l.groupLabel)?.groupLabel || groupId;

            const prompt = `你是一位资深材料科学研究员。以下是名为「${groupLabel}」的对照实验组，包含 ${groupLogs.length} 条实验记录。它们采用了控制变量法，变量轴为: ${diffKeysStr}。

请对该组实验进行系统的对比分析，严格按照以下格式输出（中文）：

## 📊 变量-性能关联
对每个变量轴，分析其取值变化对结果/性能指标的影响规律。如果有量化趋势（正相关、负相关、饱和效应、最优点）请明确标注。

## 🔎 表征-性能关联
结合组内各实验的表征结果（如 XRD、XPS、SEM/TEM 形貌等），分析结构/形貌/组分变化与性能变化之间的关联。如无表征数据则跳过此节。

## ✅ 最优方案推荐
综合各指标，推荐最优实验条件组合，给出理由。

## ⚠️ 异常 & 风险
识别组内出现异常结果或偏离趋势的实验，分析可能原因。

## 🔬 机理解读
基于变量-性能关系与表征数据，推测潜在的科学机理或构效关系。

## 💡 下一步建议
建议下一组实验的参数调整方向或补充实验设计。

注意：
- 不使用 LaTeX 格式，化学式用 Unicode（如 H₂O、CO₂）
- 必须引用具体实验编号和数值进行对比
- 如有表征数据，需联系表征结果分析结构-性能构效关系
- 保持专业简洁

以下是实验数据：

${logsContext}${groupCharContext}`;

            const analysisText = await callGeminiWithRetry(async (ai) => {
                const response = await ai.models.generateContent({
                    model: FAST_MODEL,
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    config: { ...SPEED_CONFIG, temperature: 0.3 }
                });
                return response.text || '';
            });

            // 将结果保存在组内第一条记录上
            const firstLog = groupLogs[0];
            onUpdateLog({
                ...firstLog,
                groupAnalysisInsight: String(analysisText || '').trim()
            });
            setExpandedGroupInsight(prev => new Set(prev).add(groupId));
            showToast?.({ message: '对照组对比分析完成', type: 'success' });
        } catch (e) {
            console.error('[DataLaboratory][handleAnalyzeGroup] 失败', e);
            showToast?.({ message: '对照组分析失败，请检查 AI 配置', type: 'error' });
        } finally {
            setAnalyzingGroupIds(prev => {
                const next = new Set(prev);
                next.delete(groupId);
                return next;
            });
            setAiStatus?.(null);
        }
    };

    const metricLabelMap: Record<string, string> = {
        'Overpotential@10mA/cm²': '过电位', 'Tafel Slope': '塔菲尔斜率', 'Half Wave Potential': '半波电位',
        'Limiting Current': '极限电流', 'ECSA': '活性面积', 'Mass Activity': '质量活性'
    };

    const inferTraceTypeFromMode = (mode: string | undefined): string | undefined => {
        const m = String(mode || '').toUpperCase();
        if (m.includes('VISION-')) return 'microscopy';
        if (m.includes('XRD')) return 'xrd';
        if (m.includes('XPS') || m.includes('SURFACE')) return 'surface';
        if (m.includes('POROSITY') || m.includes('BET')) return 'porosity';
        if (
            m.includes('KINETICS') ||
            m.includes('ELECTRO') ||
            m.includes('LSV') ||
            m.includes('CV') ||
            m.includes('RDE') ||
            m.includes('EIS') ||
            m.includes('OER') ||
            m.includes('ECSA')
        ) return 'kinetics';
        if (m.includes('SPECTROSCOPY')) return 'spectroscopy';
        if (m.includes('CONTACT')) return 'contact_resistance';
        return undefined;
    };

    const normalizeMetricIdentity = (key: string): string => {
        const base = String(key || '').replace(/\s*\([^()]+\)\s*$/g, '').trim();
        return base.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '');
    };

    const extractSyncedModules = (log: ExperimentLog): SyncedModuleItem[] => {
        const raw = log.deepAnalysis as any;
        if (!raw) return [];
        if (Array.isArray(raw.syncedModules) && raw.syncedModules.length > 0) {
            return raw.syncedModules
                .filter((m: any) => !!m)
                .map((m: any) => {
                    const inferredType = inferTraceTypeFromMode(m.mode);
                    return {
                        moduleId: String(m.moduleId || m.mode || Date.now()),
                        moduleLabel: String(m.moduleLabel || m.mode || '同步模块'),
                        mode: m.mode,
                        summary: m.summary,
                        aiDeepAnalysis: m.aiDeepAnalysis,
                        thumbnailUrl: m.thumbnailUrl,
                        sourceAnalysisId: m.sourceAnalysisId || log.linkedAnalysis?.id || log.id,
                        sourceAnalysisType: m.sourceAnalysisType || inferredType || log.linkedAnalysis?.type,
                        sourceAnalysisTitle: m.sourceAnalysisTitle || log.linkedAnalysis?.title,
                        generatedAt: m.generatedAt,
                        metrics: (m.metrics && typeof m.metrics === 'object') ? m.metrics : {}
                    };
                });
        }
        return [];
    };

    const getUnit = (key: string) => {
        if (!projectTargets) return '';
        const target = projectTargets.find(t => t.label === key || metricLabelMap[t.label] === key || t.label === metricLabelMap[key]);
        return target?.unit || '';
    };

    const parseParams = (paramStr: string) => {
        if (!paramStr) return [];
        return paramStr.split(/[,;]\s*/).map(p => {
            const [k, v] = p.split(/[:=]\s*/);
            return { key: k?.trim(), value: v?.trim() };
        }).filter(item => item.key && item.value);
    };

    const getFormattedDateParts = (timestamp: string) => {
        try {
            const dateOnly = timestamp.split(' ')[0];
            const parts = dateOnly.split(/[-/]/);
            if (parts.length >= 3) {
                return { month: parts[1], day: parts[2] };
            }
            const d = new Date(timestamp.replace(/\//g, '-'));
            if (!isNaN(d.getTime())) {
                return { month: String(d.getMonth() + 1), day: String(d.getDate()) };
            }
        } catch (e) { }
        return { month: '--', day: '--' };
    };

    const renderInsightBox = (
        logId: string,
        title: string,
        content: any,
        type: 'audit' | 'mechanism' | 'summary' | 'compliance' | 'sample',
        isAnomaly: boolean,
        samplePhoto?: ExperimentFile
    ) => {
        const isExpanded = openInsights[logId]?.has(type);
        // Safety guard: ensure content is always a string to prevent React "Objects are not valid as a React child" crash
        const safeContent = typeof content === 'string' ? content : (content ? JSON.stringify(content, null, 2) : '');

        let borderColor = 'border-indigo-200';
        let headerColor = 'bg-indigo-50 text-indigo-800';
        let iconClass = 'fa-circle-info text-indigo-500';
        if (type === 'audit') { borderColor = 'border-rose-200'; headerColor = 'bg-rose-50 text-rose-800'; iconClass = 'fa-stethoscope text-rose-500'; }
        else if (type === 'summary') { borderColor = 'border-purple-200'; headerColor = 'bg-purple-50 text-purple-800'; iconClass = 'fa-file-lines text-purple-500'; }
        else if (type === 'mechanism') { borderColor = 'border-amber-200'; headerColor = 'bg-amber-50 text-amber-800'; iconClass = 'fa-atom text-amber-500'; }
        else if (type === 'compliance') { borderColor = 'border-teal-200'; headerColor = 'bg-teal-50 text-teal-800'; iconClass = 'fa-shield-check text-teal-500'; }
        else if (type === 'sample') { borderColor = 'border-indigo-200'; headerColor = 'bg-indigo-50 text-indigo-800'; iconClass = 'fa-microscope text-indigo-500'; }

        return (
            <div className={`mt-2 border rounded-xl overflow-hidden transition-all ${borderColor}`}>
                <div onClick={() => toggleLocalInsight(logId, type)} className={`py-2 px-3 flex items-center justify-between cursor-pointer hover:opacity-80 transition-all ${headerColor}`}>
                    <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                        <i className={`fa-solid ${iconClass}`}></i>{title}
                    </span>
                    <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px] opacity-60`}></i>
                </div>
                {isExpanded && (
                    <div className="p-3 bg-white animate-reveal">
                        {type === 'sample' && samplePhoto && (samplePhoto.url || samplePhoto.localPath) && (
                            <div className="mb-3">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                    <i className="fa-solid fa-camera text-indigo-400"></i> 对照样品照片
                                </p>
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenFile(samplePhoto);
                                    }}
                                    className="w-full max-w-[360px] h-36 rounded-lg overflow-hidden border border-slate-100 bg-slate-100 cursor-pointer"
                                >
                                    {samplePhoto.url ? (
                                        <img src={samplePhoto.url} alt={samplePhoto.name || 'sample-photo'} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-400 uppercase">
                                            点击打开本地样品照片
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className={`max-h-80 overflow-y-auto custom-scrollbar rounded-lg border p-3.5 bg-white shadow-inner ${borderColor}`}>
                            <CompactMarkdown content={safeContent} />
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div
            ref={containerRef}
            className={`flex-1 flex flex-col overflow-hidden relative min-h-0 transition-all duration-300 ${isAttachmentFullscreen ? 'bg-slate-50 rounded-none' : ''}`}
        >
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-3 pb-4 px-6 bg-white border-b border-slate-100 shrink-0 z-20 shadow-sm">
                <div className="flex-1 min-w-0 pr-6 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">活跃实验节点 (ACTIVE NODE)</span>
                        </div>
                        <div className="flex items-center gap-6">
                            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase italic truncate leading-none shrink-0 max-w-[40%]">
                                {selectedMilestone?.title || '未选节点'}
                            </h3>

                            {/* 优化：核心假设展示，通过 relative -top-[5px] 实现更高位展示，视觉重心更居中 */}
                            {selectedMilestone?.hypothesis && (
                                <div className="hidden lg:block relative -top-[5px] flex-1 min-w-0 max-w-xl">
                                    <div
                                        onClick={() => setShowFullHypothesis(!showFullHypothesis)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-2xl animate-reveal shadow-sm cursor-pointer transition-all group border ${showFullHypothesis ? 'bg-slate-900 border-slate-800 text-white z-[60]' : 'bg-indigo-50/50 border-indigo-100 text-slate-600 hover:bg-indigo-100 hover:border-indigo-300'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shadow-sm shrink-0 group-hover:scale-110 transition-transform ${showFullHypothesis ? 'bg-white/10 text-indigo-400' : 'bg-white text-indigo-500'}`}>
                                            <i className="fa-solid fa-lightbulb text-[10px]"></i>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-black italic truncate leading-none">
                                                核心假设: {selectedMilestone.hypothesis}
                                            </p>
                                        </div>
                                    </div>

                                    {/* 原位展开浮层 */}
                                    {showFullHypothesis && (
                                        <div
                                            className="absolute top-0 left-0 w-full bg-slate-900 text-white p-5 rounded-[2rem] shadow-2xl z-[70] border border-white/10 animate-reveal cursor-pointer ring-4 ring-indigo-500/10"
                                            onClick={() => setShowFullHypothesis(false)}
                                        >
                                            <div className="flex items-center justify-between mb-3 shrink-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                                                        <i className="fa-solid fa-lightbulb text-[9px]"></i>
                                                    </div>
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">核心科学假设详述</span>
                                                </div>
                                                <i className="fa-solid fa-chevron-up text-[8px] text-slate-500"></i>
                                            </div>
                                            <p className="text-[12px] font-medium leading-relaxed italic text-justify text-indigo-50/90 whitespace-pre-wrap">
                                                {selectedMilestone.hypothesis}
                                            </p>
                                            <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center">
                                                <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">In-place Expansion Mode</span>
                                                <span className="text-[8px] font-black text-indigo-500 uppercase">点击收起</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                    {/* 对比模式执行按钮组 */}
                    {isCompareMode && selectedLogsForComparison.size > 0 && (
                        <div className="flex items-center gap-1.5 animate-reveal mr-2">
                            <button
                                onClick={onCompareLogs}
                                className="h-9 px-4 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all flex items-center gap-2"
                            >
                                <i className="fa-solid fa-scale-balanced"></i> 执行对比 ({selectedLogsForComparison.size})
                            </button>
                            <button
                                onClick={onGenerateBriefing}
                                className="h-9 px-4 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all flex items-center gap-2"
                            >
                                <i className="fa-solid fa-wand-magic-sparkles"></i> 生成简报
                            </button>
                            <div className="w-px h-6 bg-slate-300 mx-1"></div>
                        </div>
                    )}

                    <button onClick={onToggleCompareMode} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${isCompareMode ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 hover:text-indigo-600 shadow-sm'}`} title="对比模式"><i className="fa-solid fa-list-check text-sm"></i></button>
                    <button onClick={onOpenDocuments} className="w-9 h-9 bg-white text-slate-400 hover:text-indigo-600 border border-slate-200 rounded-lg flex items-center justify-center transition-all relative shadow-sm" title="节点文档库"><i className="fa-solid fa-folder-tree text-sm"></i></button>
                    <button onClick={onOpenArchives} className="w-9 h-9 bg-white text-slate-400 hover:text-indigo-600 border border-slate-200 rounded-lg flex items-center justify-center transition-all relative shadow-sm" title="成果档案库"><i className="fa-solid fa-archive text-sm"></i></button>
                    <button
                        onClick={toggleAttachmentFullscreen}
                        className={`w-9 h-9 border rounded-lg flex items-center justify-center transition-all shadow-sm ${isAttachmentFullscreen
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-400 hover:text-indigo-600 border-slate-200'
                            }`}
                        title={isAttachmentFullscreen ? '退出全屏附件视图' : '全屏附件视图'}
                    >
                        <i className={`fa-solid ${isAttachmentFullscreen ? 'fa-compress' : 'fa-expand'} text-sm`}></i>
                    </button>
                    <button onClick={onStartAiChat} className="w-9 h-9 bg-slate-900 text-white rounded-lg flex items-center justify-center hover:bg-indigo-600 transition-all shadow-lg" title="科研助理"><i className="fa-solid fa-user-astronaut text-amber-400 text-sm"></i></button>
                    <button onClick={() => onOpenLogModal()} className="h-9 px-6 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase shadow-xl hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2 ml-1">
                        <i className="fa-solid fa-plus-circle text-xs"></i> 录入实录
                    </button>
                </div>
            </header>

            <div className="flex-1 min-0 overflow-y-auto p-4 lg:p-6 space-y-3 custom-scrollbar bg-slate-50/30">
                {(() => {
                    // 单条卡片渲染函数（支持分组内差异列高亮）
                    // 组内颜色调色板
                    const GROUP_COLORS = [
                        { border: 'border-l-indigo-500', bg: 'bg-indigo-500', text: 'text-indigo-600', light: 'bg-indigo-50' },
                        { border: 'border-l-rose-500', bg: 'bg-rose-500', text: 'text-rose-600', light: 'bg-rose-50' },
                        { border: 'border-l-emerald-500', bg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50' },
                        { border: 'border-l-amber-500', bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50' },
                        { border: 'border-l-violet-500', bg: 'bg-violet-500', text: 'text-violet-600', light: 'bg-violet-50' },
                        { border: 'border-l-cyan-500', bg: 'bg-cyan-500', text: 'text-cyan-600', light: 'bg-cyan-50' },
                        { border: 'border-l-pink-500', bg: 'bg-pink-500', text: 'text-pink-600', light: 'bg-pink-50' },
                        { border: 'border-l-teal-500', bg: 'bg-teal-500', text: 'text-teal-600', light: 'bg-teal-50' },
                    ];

                    const renderCard = (log: ExperimentLog, diffKeys: Set<string> = new Set(), groupIndex?: number) => {
                        const isExpanded = expandedLogIds.has(log.id);
                        const isSelectedForCompare = selectedLogsForComparison.has(log.id);
                        const isDetailExpanded = expandedDetailLogs.has(log.id);
                        const isAnomaly = log.status === 'Anomaly';
                        const isHighlighted = highlightLogId === log.id;
                        const lowCompliance = log.complianceScore !== undefined && log.complianceScore < 60;
                        const parsedParams = log.parameterList && log.parameterList.length > 0
                            ? log.parameterList.map((p: { key: string; value: string; unit: string }) => ({ key: p.key, value: `${p.value}${p.unit ? ' ' + p.unit : ''}` }))
                            : parseParams(log.parameters);
                        const { month, day } = getFormattedDateParts(log.timestamp);
                        const isInGroup = groupIndex !== undefined;
                        const cardColor = isInGroup ? GROUP_COLORS[groupIndex % GROUP_COLORS.length] : null;

                        // 优先展示差异参数
                        const sortedParams = diffKeys.size > 0
                            ? [...parsedParams].sort((a, b) => {
                                const aDiff = diffKeys.has(a.key) ? 0 : 1;
                                const bDiff = diffKeys.has(b.key) ? 0 : 1;
                                return aDiff - bDiff;
                            })
                            : parsedParams;

                        return (
                            <div
                                key={log.id}
                                ref={el => { logRefs.current[log.id] = el; }}
                                className={`bg-white rounded-2xl border transition-all duration-500 shadow-sm overflow-hidden ${isInGroup ? `border-l-4 ${cardColor!.border}` : ''} ${isSelectedForCompare ? 'ring-4 ring-amber-400/30 border-amber-400' :
                                    isHighlighted ? 'ring-4 ring-indigo-500/30 border-indigo-500 animate-precision-glow' :
                                        (isAnomaly || lowCompliance) ? 'border-rose-400 ring-2 ring-rose-50 shadow-rose-100/50' :
                                            'border-slate-100 hover:border-indigo-200 hover:shadow-lg'
                                    }`}
                            >
                                <div className="flex flex-col lg:flex-row items-stretch lg:items-center p-3 lg:px-5 cursor-pointer gap-3" onClick={() => isCompareMode ? onSelectForCompare(log.id) : onToggleLogExpansion(log.id)}>
                                    <div className="flex items-center gap-3 shrink-0 min-w-[180px]">
                                        {isCompareMode && (
                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all mr-1 ${isSelectedForCompare ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>
                                                {isSelectedForCompare && <i className="fa-solid fa-check text-white text-[10px]"></i>}
                                            </div>
                                        )}
                                        {isInGroup && cardColor && (
                                            <div className={`w-6 h-6 ${cardColor.bg} rounded-lg flex items-center justify-center shrink-0 shadow-sm`}>
                                                <span className="text-[9px] font-black text-white">{(groupIndex! + 1).toString().padStart(2, '0')}</span>
                                            </div>
                                        )}
                                        <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-xl border shrink-0 ${isInGroup && cardColor ? cardColor.light + ' border-slate-100' : 'bg-slate-50 border-slate-100'}`}>
                                            <span className="text-[6px] font-black text-slate-400 uppercase leading-none mb-0.5">{month}月</span>
                                            <span className="text-base font-black text-slate-700 leading-none">{day}</span>
                                        </div>
                                        <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAnomaly || lowCompliance ? 'bg-rose-600 animate-pulse' : log.result === 'success' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                            <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest shrink-0">{log.status}</span>
                                            {log.linkedPlanId && (
                                                <span
                                                    onClick={(e) => { e.stopPropagation(); onTracePlan?.(log.linkedPlanId!); }}
                                                    className="bg-indigo-600 text-white text-[6px] font-black px-1.5 py-0.5 rounded-md border border-indigo-400 shadow-sm flex items-center gap-1 cursor-pointer hover:bg-black transition-all active:scale-95 shrink-0"
                                                >
                                                    <i className="fa-solid fa-table-cells text-[5px]"></i> 矩阵溯源
                                                </span>
                                            )}

                                            <h4 className={`text-[12px] font-black uppercase leading-none truncate ${isAnomaly || lowCompliance ? 'text-rose-600' : 'text-slate-800'}`}>{log.content}</h4>
                                        </div>
                                    </div>

                                    {!isExpanded && (
                                        <div className="flex-1 flex items-center gap-4 min-w-0 border-l border-slate-50 pl-4 overflow-hidden">
                                            {sortedParams.slice(0, 5).map((p: { key: string; value: string }, i: number) => {
                                                const isDiff = diffKeys.has(p.key);
                                                return (
                                                    <div key={i} className={`flex flex-col items-start shrink-0 transition-all ${isDiff && isInGroup && cardColor ? `${cardColor.light} border ${cardColor.border.replace('border-l-', 'border-')} rounded-lg px-1.5 py-0.5` : isDiff ? 'bg-amber-50 border border-amber-200 rounded-lg px-1.5 py-0.5' : ''}`}>
                                                        <span className={`text-[6px] font-black uppercase tracking-tighter ${isDiff && isInGroup && cardColor ? cardColor.text : isDiff ? 'text-amber-500' : 'text-slate-300'}`}>{p.key}</span>
                                                        <span className={`text-[10px] font-black font-mono truncate max-w-[70px] ${isDiff && isInGroup && cardColor ? cardColor.text : isDiff ? 'text-amber-700' : 'text-slate-500'}`}>{p.value}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {isExpanded && <div className="flex-1"></div>}

                                    <div className="shrink-0 flex items-center gap-4 pl-4 border-l border-slate-50">
                                        {log.scientificData && Object.entries(log.scientificData).slice(0, 3).map(([k, v]) => (
                                            <div key={k} className="flex flex-col items-end">
                                                <span className="text-[6px] font-black text-slate-300 uppercase tracking-tighter mb-0.5 truncate max-w-[80px]">{metricLabelMap[k] || k}</span>
                                                <span className="text-[13px] font-black text-rose-600 font-mono italic leading-none">{v}<span className="text-[8px] ml-0.5 opacity-60 not-italic font-sans">{getUnit(k)}</span></span>
                                            </div>
                                        ))}
                                        {!isCompareMode && (
                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-slate-300 group-hover:text-indigo-400 transition-all">
                                                <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px]`}></i>
                                            </div>
                                        )}
                                        {isExpanded && !isCompareMode && (
                                            <div className="flex items-center gap-1.5 ml-2 animate-reveal" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onOpenLogModal(log); }}
                                                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase shadow-md hover:bg-black transition-all active:scale-95 flex items-center gap-1.5"
                                                >
                                                    <i className="fa-solid fa-pen-to-square text-[8px]"></i> 编辑
                                                </button>
                                                {confirmDeleteId === log.id ? (
                                                    <div className="flex gap-1 animate-reveal">
                                                        <button
                                                            onClick={() => { onDeleteLog(log.id); setConfirmDeleteId(null); }}
                                                            className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[9px] font-black uppercase animate-pulse"
                                                        >
                                                            确认
                                                        </button>
                                                        <button
                                                            onClick={() => setConfirmDeleteId(null)}
                                                            className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase border border-slate-200"
                                                        >
                                                            取消
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(log.id); }}
                                                        className="w-7 h-7 bg-white border border-rose-100 text-rose-400 rounded-lg text-[9px] flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"
                                                        title="删除"
                                                    >
                                                        <i className="fa-solid fa-trash-can text-[9px]"></i>
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {isExpanded && !isCompareMode && (
                                    <div className="bg-slate-50/40 border-t border-slate-100 p-4 lg:p-5 animate-reveal space-y-5 relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleDetailPanel(log.id);
                                            }}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-left flex items-center justify-between hover:border-indigo-300 transition-colors"
                                        >
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                                实验详情（PARAMS / OBSERVATION / REAGENTS / SAMPLE）
                                            </span>
                                            <i className={`fa-solid ${isDetailExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px] text-slate-400`}></i>
                                        </button>

                                        {isDetailExpanded && (
                                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                                                <div className="xl:col-span-5 space-y-4">
                                                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                                        <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">关键参数快照 (PARAMS)</span>
                                                                {log.linkedPlanId && <span className="text-[7px] bg-indigo-600 text-white px-1.5 py-0.5 rounded uppercase font-black">Linked to DOE</span>}
                                                            </div>
                                                            {log.linkedPlanId && (
                                                                <button onClick={(e) => { e.stopPropagation(); onTracePlan?.(log.linkedPlanId!); }} className="text-[8px] font-black text-indigo-600 uppercase hover:underline">查看矩阵设计</button>
                                                            )}
                                                        </div>
                                                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 max-h-[300px] overflow-y-auto custom-scrollbar bg-white">
                                                            {parsedParams.map((p: { key: string; value: string }, i: number) => {
                                                                const plannedVal = log.planSnapshot?.[p.key];
                                                                const hasDeviation = plannedVal && plannedVal !== p.value;
                                                                const isDiff = diffKeys.has(p.key);
                                                                return (
                                                                    <div key={i} className={`flex items-center justify-between py-1.5 border-b border-slate-50 group hover:bg-slate-50/80 transition-colors px-2 rounded-lg ${hasDeviation ? 'bg-rose-50/50' : isDiff ? 'bg-amber-50/50' : ''}`}>
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className={`text-[10px] font-black uppercase tracking-tight truncate mr-2 font-mono ${isDiff ? 'text-amber-700' : 'text-slate-900'}`}>{p.key}</span>
                                                                            {hasDeviation && <span className="text-[7px] text-rose-500 font-black uppercase mt-0.5 italic">Expected: {plannedVal}</span>}
                                                                        </div>
                                                                        <span className={`text-[12px] font-black font-mono text-right tracking-tighter ${hasDeviation ? 'text-rose-600' : isDiff ? 'text-amber-600' : 'text-indigo-700'}`}>{p.value}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {log.consumedReagents && log.consumedReagents.length > 0 && (
                                                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-reveal">
                                                            <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center">
                                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">物资消耗审计 (REAGENTS)</span>
                                                                <i className="fa-solid fa-flask-vial text-emerald-200 text-[9px]"></i>
                                                            </div>
                                                            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                                                                {log.consumedReagents.map((r, i) => (
                                                                    <div key={i} className="flex items-center justify-between py-1 border-b border-slate-50 group hover:bg-slate-50 transition-colors px-1">
                                                                        <span className="text-[10px] font-bold text-slate-700 truncate mr-2">
                                                                            <LaTeXText text={r.name} />
                                                                        </span>
                                                                        <div className="text-right shrink-0">
                                                                            <span className="text-[10px] font-black text-emerald-600 font-mono">{r.amount}</span>
                                                                            <span className="text-[8px] font-bold text-slate-300 ml-1 uppercase">{r.unit}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="xl:col-span-7">
                                                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-inner h-full flex flex-col relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none"><i className="fa-solid fa-quote-right text-6xl"></i></div>
                                                        <h5 className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                                            <i className="fa-solid fa-align-left"></i> 实验详述与现象观测 (OBSERVATION)
                                                        </h5>
                                                        <div className="min-h-0">
                                                            <p className="text-[12px] leading-relaxed text-slate-800 font-bold italic text-justify whitespace-pre-wrap">{log.description || '暂无详细文字描述。'}</p>
                                                        </div>

                                                        {(log.samplePhoto?.url || log.samplePhoto?.localPath) && (
                                                            <div className="mt-2 pt-2 border-t border-slate-50">
                                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                                                    <i className="fa-solid fa-camera text-indigo-400"></i> 样品照片 (SAMPLE PHOTO)
                                                                </p>
                                                                <div
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleOpenFile(log.samplePhoto as ExperimentFile);
                                                                    }}
                                                                    className="w-full max-w-[320px] h-32 rounded-xl overflow-hidden border border-slate-100 shadow-sm bg-slate-100 cursor-pointer group relative"
                                                                >
                                                                    {log.samplePhoto?.url ? (
                                                                        <img src={log.samplePhoto.url} alt={log.samplePhoto.name || 'sample-photo'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-400 uppercase">
                                                                            点击打开本地样品照片
                                                                        </div>
                                                                    )}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleAnalyzeSampleAppearance(log);
                                                                        }}
                                                                        disabled={analyzingSampleIds.has(log.id)}
                                                                        className="absolute right-2 bottom-2 px-2.5 py-1 bg-indigo-600 text-white rounded-md text-[8px] font-black uppercase shadow-lg hover:bg-black transition-all disabled:opacity-40 flex items-center gap-1 border border-white/20"
                                                                    >
                                                                        {analyzingSampleIds.has(log.id) ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-microscope"></i>}
                                                                        AI 表观分析
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {log.files && log.files.length > 0 && (
                                                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-4 border-t border-slate-50">
                                                                {log.files.map((file, idx) => {
                                                                    const { icon, color } = getFileIcon(file.name);
                                                                    const isImage = (file as any).type === 'image' || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name) || (file.url && file.url.startsWith('data:image'));
                                                                    return (
                                                                        <div key={idx} onClick={(e) => { e.stopPropagation(); handleOpenFile(file); }} className="flex flex-col p-2 bg-slate-50 rounded-xl hover:border-indigo-300 border border-transparent transition-all cursor-pointer group/file overflow-hidden">
                                                                            {isImage ? (
                                                                                <div className="w-full h-32 mb-2 rounded-lg bg-slate-200 overflow-hidden flex items-center justify-center shadow-inner relative group-hover/file:shadow-md transition-all">
                                                                                    <img src={file.url} alt={file.name} className="w-full h-full object-cover group-hover/file:scale-105 transition-transform duration-500" />
                                                                                    <div className="absolute inset-0 bg-black/0 group-hover/file:bg-black/10 transition-colors flex items-center justify-center">
                                                                                        <i className="fa-solid fa-magnifying-glass-plus text-white opacity-0 group-hover/file:opacity-100 transition-opacity text-xl drop-shadow-md"></i>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="w-8 h-8 mb-2 rounded-lg bg-white flex flex-col items-center justify-center shadow-sm shrink-0">
                                                                                    <i className={`fa-solid ${icon} ${color} text-sm`}></i>
                                                                                </div>
                                                                            )}
                                                                            <div className="min-w-0 w-full">
                                                                                <p className="text-[10px] font-black text-slate-700 truncate">{file.name}</p>
                                                                                <p className="text-[8px] text-slate-400 truncate italic">{file.description || 'Raw Data Asset'}</p>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {(() => {
                                            const syncedModules = extractSyncedModules(log);
                                            if (syncedModules.length > 0) {
                                                return (
                                                    <ModuleRadarGroup
                                                        modules={syncedModules}
                                                        mainMetricKeys={log.mainRadarMetricKeys || Object.keys(log.scientificData || {})}
                                                        onPromote={(module, picked, pickedKeys) => {
                                                            if (!onUpdateLog || Object.keys(picked).length === 0) return;
                                                            const moduleKeys = Object.keys(module.metrics || {});
                                                            const moduleIdentitySet = new Set(moduleKeys.map(normalizeMetricIdentity));
                                                            const existingKeys = log.mainRadarMetricKeys || [];
                                                            const keepKeys = existingKeys.filter(k => !moduleIdentitySet.has(normalizeMetricIdentity(k)));
                                                            const mergedKeys = Array.from(new Set([...keepKeys, ...pickedKeys])).slice(0, 12);
                                                            onUpdateLog({
                                                                ...log,
                                                                scientificData: { ...(log.scientificData || {}), ...picked },
                                                                mainRadarMetricKeys: mergedKeys
                                                            });
                                                        }}
                                                        onWithdrawModule={(module) => {
                                                            if (!onUpdateLog) return;
                                                            const moduleIdentitySet = new Set(Object.keys(module.metrics || {}).map(normalizeMetricIdentity));
                                                            const nextKeys = (log.mainRadarMetricKeys || []).filter(k => !moduleIdentitySet.has(normalizeMetricIdentity(k)));
                                                            onUpdateLog({
                                                                ...log,
                                                                mainRadarMetricKeys: nextKeys
                                                            });
                                                        }}
                                                        onDeleteModule={(module) => {
                                                            if (!onUpdateLog) return;
                                                            if (!confirm(`确定删除模块「${module.moduleLabel}」吗？`)) return;
                                                            const prevDeep = (log.deepAnalysis || {}) as any;
                                                            const prevModules = Array.isArray(prevDeep.syncedModules) ? prevDeep.syncedModules : [];
                                                            const moduleId = String(module.moduleId || '');
                                                            const modeKey = String(module.mode || '').toLowerCase();
                                                            const nextModules = prevModules.filter((it: any) => {
                                                                const sameId = String(it?.moduleId || '') === moduleId;
                                                                const sameMode = modeKey && String(it?.mode || '').toLowerCase() === modeKey;
                                                                return !(sameId || sameMode);
                                                            });
                                                            onUpdateLog({
                                                                ...log,
                                                                deepAnalysis: {
                                                                    ...prevDeep,
                                                                    syncedModules: nextModules,
                                                                    lastSyncedModuleId: prevDeep.lastSyncedModuleId === moduleId ? (nextModules[0]?.moduleId || '') : prevDeep.lastSyncedModuleId
                                                                }
                                                            });
                                                        }}
                                                        onTraceModule={(module) => {
                                                            if (!module.sourceAnalysisId || !module.sourceAnalysisType) return;
                                                            navigate('characterization_hub', module.sourceAnalysisType, module.sourceAnalysisId);
                                                        }}
                                                    />
                                                );
                                            }
                                            if (log.deepAnalysis) return <LogDeepAnalysisView data={log.deepAnalysis} />;
                                            return null;
                                        })()}
                                        {log.scientificData && <MetricSnapshot data={log.scientificData} targets={projectTargets} />}

                                        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100">
                                            <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onOpenLogModal(log); }}
                                                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black uppercase shadow-md hover:bg-black transition-all active:scale-95 flex items-center gap-1.5"
                                                >
                                                    <i className="fa-solid fa-pen-to-square text-[8px]"></i> 编辑
                                                </button>
                                                {confirmDeleteId === log.id ? (
                                                    <div className="flex gap-1 animate-reveal">
                                                        <button
                                                            onClick={() => { onDeleteLog(log.id); setConfirmDeleteId(null); }}
                                                            className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[9px] font-black uppercase animate-pulse"
                                                        >
                                                            确认
                                                        </button>
                                                        <button
                                                            onClick={() => setConfirmDeleteId(null)}
                                                            className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-lg text-[9px] font-black uppercase border border-slate-200"
                                                        >
                                                            取消
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(log.id); }}
                                                        className="w-7 h-7 bg-white border border-rose-100 text-rose-400 rounded-lg text-[9px] flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"
                                                        title="删除"
                                                    >
                                                        <i className="fa-solid fa-trash-can text-[9px]"></i>
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex gap-1.5">
                                                <button onClick={(e) => { e.stopPropagation(); onStartLogChat(log); }} className="px-4 py-1.5 bg-slate-900 text-amber-400 rounded-lg text-[9px] font-black uppercase shadow-lg flex items-center gap-1.5 hover:bg-indigo-600 hover:text-white transition-all active:scale-95"><i className="fa-solid fa-user-astronaut"></i> AI 问答</button>
                                                <button onClick={(e) => { e.stopPropagation(); onFullAnalysis(log); }} disabled={isAiLoading} className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase shadow-lg flex items-center gap-1.5 hover:bg-indigo-600 transition-all active:scale-95">{isAiLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-bolt"></i>} 一键全析</button>
                                                <div className="w-px bg-slate-200 mx-0.5"></div>
                                                <button onClick={(e) => { e.stopPropagation(); onSummarizeLog(log) }} disabled={isAiLoading} className="px-4 py-1.5 bg-violet-600 text-white rounded-lg text-[9px] font-black uppercase shadow-md flex items-center gap-1.5">{isAiLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-file-lines"></i>} 总结</button>
                                                <button onClick={(e) => { e.stopPropagation(); onDiagnoseLog(log) }} disabled={isAiLoading} className="px-4 py-1.5 bg-rose-600 text-white rounded-lg text-[9px] font-black uppercase shadow-md flex items-center gap-1.5">{isAiLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-stethoscope"></i>} AI 审计</button>
                                                <button onClick={(e) => { e.stopPropagation(); onAnalyzeMechanism(log) }} disabled={isAiLoading} className="px-4 py-1.5 bg-amber-500 text-white rounded-lg text-[9px] font-black uppercase shadow-md flex items-center gap-1.5">{isAiLoading ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-atom"></i>} 机理</button>
                                            </div>
                                        </div>

                                        {log.summaryInsight && renderInsightBox(log.id, '记录总结分析', log.summaryInsight, 'summary', false)}
                                        {(log.sampleAppearanceInsight || analyzingSampleIds.has(log.id)) && renderInsightBox(
                                            log.id,
                                            '样品表观分析',
                                            log.sampleAppearanceInsight || 'AI 正在分析样品表观，请稍候...',
                                            'sample',
                                            false,
                                            log.samplePhoto
                                        )}
                                        {log.complianceInsight && renderInsightBox(log.id, '计划书对标审计', log.complianceInsight, 'compliance', lowCompliance)}
                                        {log.auditInsight && renderInsightBox(log.id, '异常预警诊断', log.auditInsight, 'audit', isAnomaly)}
                                        {log.mechanismInsight && renderInsightBox(log.id, '研究洞察结论', log.mechanismInsight, 'mechanism', false)}

                                        <div className="sticky bottom-3 z-20 flex justify-end pointer-events-none pt-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onToggleLogExpansion(log.id);
                                                }}
                                                className="pointer-events-auto h-8 px-3 bg-slate-900/90 text-white rounded-lg text-[9px] font-black uppercase shadow-lg border border-white/20 hover:bg-indigo-600 transition-all flex items-center gap-1.5"
                                                title="收起当前卡片"
                                            >
                                                <i className="fa-solid fa-chevron-up text-[8px]"></i>
                                                收起
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    };

                    // 分组逻辑
                    const logs = selectedMilestone?.logs || [];
                    const groupMap = new Map<string, ExperimentLog[]>();
                    logs.forEach(log => {
                        if (log.groupId) {
                            if (!groupMap.has(log.groupId)) groupMap.set(log.groupId, []);
                            groupMap.get(log.groupId)!.push(log);
                        }
                    });

                    // 计算组内差异列
                    const computeDiffKeys = (groupLogs: ExperimentLog[]): Set<string> => {
                        if (groupLogs.length < 2) return new Set();
                        const allKeys = new Set<string>();
                        const paramMaps = groupLogs.map(log => {
                            const m: Record<string, string> = {};
                            const params = log.parameterList && log.parameterList.length > 0
                                ? log.parameterList.map((p: { key: string; value: string; unit: string }) => ({ key: p.key, value: `${p.value}${p.unit ? ' ' + p.unit : ''}` }))
                                : parseParams(log.parameters);
                            params.forEach((p: { key: string; value: string }) => { m[p.key] = p.value; allKeys.add(p.key); });
                            return m;
                        });
                        const diffKeys = new Set<string>();
                        allKeys.forEach(key => { if (new Set(paramMaps.map(m => m[key] || '')).size > 1) diffKeys.add(key); });
                        return diffKeys;
                    };

                    // 按首次出现顺序构建渲染列表
                    const seen = new Set<string>();
                    return logs.map(log => {
                        if (log.groupId && groupMap.get(log.groupId)!.length > 1) {
                            if (seen.has(log.groupId)) return null;
                            seen.add(log.groupId);
                            const groupLogs = groupMap.get(log.groupId)!;
                            const groupLabel = groupLogs.find(l => l.groupLabel)?.groupLabel || log.groupId;
                            const isCollapsed = collapsedGroupIds.has(log.groupId);
                            const diffKeys = computeDiffKeys(groupLogs);
                            return (
                                <div key={log.groupId} className="space-y-0">
                                    {/* 组头 */}
                                    <div
                                        className={`flex items-center gap-3 px-4 py-2.5 bg-indigo-600 ${isCollapsed ? 'rounded-2xl' : 'rounded-t-2xl'} cursor-pointer select-none hover:bg-indigo-700 transition-all`}
                                        onClick={() => setCollapsedGroupIds(prev => {
                                            const n = new Set(prev);
                                            if (n.has(log.groupId!)) n.delete(log.groupId!);
                                            else n.add(log.groupId!);
                                            return n;
                                        })}
                                    >
                                        <i className="fa-solid fa-layer-group text-indigo-200 text-[11px]"></i>
                                        <span className="text-[9px] font-black text-indigo-200 uppercase tracking-widest">实验组</span>
                                        <span className="text-[13px] font-black text-white truncate flex-1">{groupLabel}</span>
                                        {diffKeys.size > 0 && (
                                            <div className="flex items-center gap-1.5 mr-2">
                                                {Array.from(diffKeys).slice(0, 3).map(k => (
                                                    <span key={k} className="text-[7px] font-black bg-white/20 text-white px-1.5 py-0.5 rounded-full border border-white/20">{k}</span>
                                                ))}
                                                {diffKeys.size > 3 && <span className="text-[7px] font-black text-indigo-200">+{diffKeys.size - 3}</span>}
                                            </div>
                                        )}
                                        <span className="text-[7px] font-black text-indigo-300 uppercase shrink-0">{groupLogs.length} 条记录</span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleAnalyzeGroup(log.groupId!, groupLogs, diffKeys);
                                            }}
                                            disabled={analyzingGroupIds.has(log.groupId!)}
                                            className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-[8px] font-black uppercase border border-white/20 transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                                            title="AI 对照组对比分析"
                                        >
                                            {analyzingGroupIds.has(log.groupId!) ? <i className="fa-solid fa-spinner animate-spin text-[8px]"></i> : <i className="fa-solid fa-brain text-[8px]"></i>}
                                            AI 对比分析
                                        </button>
                                        <i className={`fa-solid ${isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'} text-[10px] text-indigo-300`}></i>
                                    </div>
                                    {/* 组内记录 */}
                                    {!isCollapsed && (
                                        <div className="border-l-4 border-indigo-400 ml-2 space-y-2 pb-2 bg-indigo-50/20 rounded-b-2xl">
                                            {groupLogs.map((gl, idx) => renderCard(gl, diffKeys, idx))}
                                            {/* 组同步的表征模块卡片 — 内嵌在组容器中 */}
                                            {(() => {
                                                const groupModules: SyncedModuleItem[] = (groupLogs.find(l => Array.isArray((l as any).groupSyncedModules)) as any)?.groupSyncedModules || [];
                                                if (groupModules.length === 0) return null;
                                                return (
                                                    <ModuleRadarGroup
                                                        modules={groupModules}
                                                        mainMetricKeys={[]}
                                                        expandOnMount
                                                        title="组表征分析概览"
                                                        hidePromoteButtons
                                                        groupStyle
                                                        onPromote={() => { }}
                                                        onWithdrawModule={() => { }}
                                                        onDeleteModule={(module) => {
                                                            if (!onUpdateLog) return;
                                                            if (!confirm(`确定删除组模块「${module.moduleLabel}」吗？`)) return;
                                                            const modId = String(module.moduleId || '');
                                                            const modeKey = String(module.mode || '').toLowerCase();
                                                            // Fix: 逐条更新会导致闭包竞态，只更新第一条持有该模块的记录
                                                            // UI 通过 .find() 读取第一条有 groupSyncedModules 的 log，
                                                            // 所以只需从该 log 上删除即可；后续 find 会向后查找
                                                            const holderLog = groupLogs.find(gl => {
                                                                const arr = Array.isArray((gl as any).groupSyncedModules) ? (gl as any).groupSyncedModules : [];
                                                                return arr.some((it: any) => {
                                                                    const sameId = String(it?.moduleId || '') === modId;
                                                                    const sameMode = modeKey && String(it?.mode || '').toLowerCase() === modeKey;
                                                                    return sameId || sameMode;
                                                                });
                                                            });
                                                            if (!holderLog) return;
                                                            const prev = Array.isArray((holderLog as any).groupSyncedModules) ? (holderLog as any).groupSyncedModules : [];
                                                            const next = prev.filter((it: any) => {
                                                                const sameId = String(it?.moduleId || '') === modId;
                                                                const sameMode = modeKey && String(it?.mode || '').toLowerCase() === modeKey;
                                                                return !(sameId || sameMode);
                                                            });
                                                            onUpdateLog({ ...holderLog, groupSyncedModules: next } as any);
                                                        }}
                                                        onTraceModule={(module) => {
                                                            if (!module.sourceAnalysisId || !module.sourceAnalysisType) return;
                                                            navigate('characterization_hub', module.sourceAnalysisType, module.sourceAnalysisId);
                                                        }}
                                                    />
                                                );
                                            })()}
                                            {/* 组 AI 对比分析报告 */}
                                            {(() => {
                                                const insightLog = groupLogs.find(l => (l as any).groupAnalysisInsight);
                                                const insight = (insightLog as any)?.groupAnalysisInsight;
                                                if (!insight && !analyzingGroupIds.has(log.groupId!)) return null;
                                                const isInsightOpen = expandedGroupInsight.has(log.groupId!);
                                                return (
                                                    <div className="mx-3 mb-3 mt-1 border border-indigo-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                                        <div
                                                            onClick={() => setExpandedGroupInsight(prev => {
                                                                const n = new Set(prev);
                                                                if (n.has(log.groupId!)) n.delete(log.groupId!);
                                                                else n.add(log.groupId!);
                                                                return n;
                                                            })}
                                                            className="flex items-center justify-between px-4 py-2.5 bg-indigo-50 cursor-pointer hover:bg-indigo-100 transition-colors"
                                                        >
                                                            <span className="text-[9px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                                                                <i className="fa-solid fa-brain text-indigo-500"></i>
                                                                AI 对照组对比分析报告
                                                            </span>
                                                            <i className={`fa-solid ${isInsightOpen ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px] text-indigo-400`}></i>
                                                        </div>
                                                        {isInsightOpen && (
                                                            <div className="p-4 animate-reveal">
                                                                {analyzingGroupIds.has(log.groupId!) && !insight ? (
                                                                    <div className="flex items-center gap-2 py-4 justify-center">
                                                                        <i className="fa-solid fa-spinner animate-spin text-indigo-500"></i>
                                                                        <span className="text-[10px] font-bold text-indigo-500">AI 正在分析对照组数据...</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="max-h-[500px] overflow-y-auto custom-scrollbar rounded-lg border border-indigo-100 p-4 bg-white shadow-inner">
                                                                        <CompactMarkdown content={String(insight || '')} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                    {/* 折叠时显示差异摘要 */}
                                    {isCollapsed && diffKeys.size > 0 && (
                                        <div className="flex items-center gap-2.5 px-4 py-2 bg-gradient-to-r from-indigo-100 to-indigo-50 border border-t-0 border-indigo-200/60 rounded-b-2xl -mt-1 shadow-sm">
                                            <div className="w-5 h-5 rounded-md bg-indigo-500/10 flex items-center justify-center shrink-0">
                                                <i className="fa-solid fa-arrows-left-right text-[9px] text-indigo-500"></i>
                                            </div>
                                            <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest shrink-0">变量轴</span>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {Array.from(diffKeys).map(k => (
                                                    <span key={k} className="text-[9px] font-black text-indigo-700 bg-white/80 backdrop-blur-sm border border-indigo-200 px-2.5 py-0.5 rounded-full shadow-sm">{k}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        }
                        // 独立记录（无分组 or 组内仅朄1条）
                        return renderCard(log, new Set());
                    });
                })()}
                {(!selectedMilestone?.logs || selectedMilestone.logs.length === 0) && (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 py-20 gap-4">
                        <i className="fa-solid fa-vial-circle-check text-6xl text-slate-300"></i>
                        <p className="text-sm font-black uppercase tracking-[0.4rem]">等待实验数据录入</p>
                    </div>
                )}
            </div>

            <style>{`
          @keyframes precision-glow {
            0%, 100% { 
                border-color: rgba(99,102,241,0.4); 
                box-shadow: 0 4px 15px rgba(99,102,241,0.1); 
            }
            50% { 
                border-color: rgba(99,102,241,0.9); 
                box-shadow: 0 10px 30px rgba(99,102,241,0.3); 
            }
          }
          .animate-precision-glow { animation: precision-glow 2s infinite ease-in-out; }
       `}</style>

            {previewImage && (
                <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>
                    <button className="absolute top-4 right-4 w-10 h-10 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all"><i className="fa-solid fa-times"></i></button>
                    <img src={previewImage.url} alt={previewImage.name} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
                    <p className="mt-4 text-white font-medium text-sm bg-black/50 px-4 py-2 rounded-full">{previewImage.name}</p>
                </div>
            )}
        </div>
    );
};

export default DataLaboratory;
