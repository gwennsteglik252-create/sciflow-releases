
import { AiCliResponse } from '../../types/ai';

export type ExecutionPolicy = 'silent' | 'confirm';

export type TriggerType = 'file_added' | 'api_call' | 'schedule';

export type ActionType = 'ai_analyze' | 'import_resource' | 'notify' | 'custom_event' | 'webhook';

export interface WorkflowAction {
    type: ActionType;
    config: Record<string, any>;
}

export interface WorkflowRule {
    id: string;
    trigger: {
        type: TriggerType;
        path?: string;
        extension?: string;
        eventName?: string;
    };
    actions?: WorkflowAction[];
    instruction: string;
    name: string;
    isActive: boolean;
    policy?: ExecutionPolicy;
    createdBy?: string;   // 'user' | 'openclaw' | 'api'
    lastTriggered?: string;
    triggerCount?: number;
}

export interface WorkflowLog {
    id: string;
    ruleId: string;
    ruleName: string;
    triggeredAt: string;
    triggerSource: string;
    fileContext?: any;
    actionsExecuted: string[];
    status: 'success' | 'partial' | 'failed';
    results?: any[];
    durationMs?: number;
}

const MAX_LOGS = 100;
const LOGS_STORAGE_KEY = 'sciflow_workflow_logs';

class WorkflowEngine {
    private rules: WorkflowRule[] = [];
    private logs: WorkflowLog[] = [];
    private onNotification: ((msg: { title: string; content: string; type: 'info' | 'success' | 'warning' }) => void) | null = null;

    constructor() {
        this.loadRules();
        this.loadLogs();
        this.initFileSystemListener();
        this.initApiListener();
    }

    private loadRules() {
        const saved = localStorage.getItem('sciflow_workflow_rules');
        if (saved) {
            try {
                this.rules = JSON.parse(saved);
                this.rules.forEach(rule => {
                    if (rule.isActive && rule.trigger.type === 'file_added' && rule.trigger.path) {
                        window.electron?.watchDirectory(rule.trigger.path);
                    }
                });
            } catch (e) {
                console.error('Failed to load workflow rules', e);
            }
        }
    }

    private loadLogs() {
        try {
            const saved = localStorage.getItem(LOGS_STORAGE_KEY);
            this.logs = saved ? JSON.parse(saved) : [];
        } catch { this.logs = []; }
    }

    private saveRules() {
        localStorage.setItem('sciflow_workflow_rules', JSON.stringify(this.rules));
    }

    private saveLogs() {
        localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(this.logs.slice(0, MAX_LOGS)));
    }

    private initFileSystemListener() {
        if (window.electron?.onFileSystemEvent) {
            window.electron.onFileSystemEvent((event: any) => {
                if (event.type === 'added') {
                    this.handleFileAdded(event);
                }
            });
        }
    }

    /** 监听 API 触发的工作流事件 */
    private initApiListener() {
        window.addEventListener('sciflow-workflow-api-trigger', ((e: CustomEvent) => {
            const { ruleId, fileContext } = e.detail || {};
            if (ruleId) {
                const rule = this.rules.find(r => r.id === ruleId);
                if (rule) this.executeRule(rule, fileContext || {}, 'api');
            }
        }) as EventListener);

        window.addEventListener('sciflow-pipeline-ingest', ((e: CustomEvent) => {
            this.handlePipelineIngest(e.detail);
        }) as EventListener);
    }

    private async handleFileAdded(event: { path: string; name: string; ext: string; parentDir: string }) {
        const matchingRules = this.rules.filter(r =>
            r.isActive &&
            r.trigger.type === 'file_added' &&
            r.trigger.path === event.parentDir &&
            (!r.trigger.extension || event.ext === r.trigger.extension)
        );
        if (matchingRules.length === 0) return;
        for (const rule of matchingRules) {
            await this.executeRule(rule, event, 'filesystem');
        }
    }

    /** 执行规则的所有动作链 */
    private async executeRule(rule: WorkflowRule, fileContext: any, source: string): Promise<WorkflowLog> {
        const startTime = Date.now();
        const actionsExecuted: string[] = [];
        const results: any[] = [];
        let status: WorkflowLog['status'] = 'success';

        this.notify({ title: '🔄 工作流触发', content: `正在执行: ${rule.name} (来源: ${source})`, type: 'info' });

        rule.lastTriggered = new Date().toISOString();
        rule.triggerCount = (rule.triggerCount || 0) + 1;
        this.saveRules();

        if (rule.actions && rule.actions.length > 0) {
            for (const action of rule.actions) {
                try {
                    const result = await this.executeAction(action, fileContext, rule);
                    actionsExecuted.push(action.type);
                    results.push({ action: action.type, success: true, result });
                } catch (e: any) {
                    actionsExecuted.push(`${action.type} (FAILED)`);
                    results.push({ action: action.type, success: false, error: e.message });
                    status = 'partial';
                }
            }
        }

        // 派发通用触发事件（兼容原有逻辑）
        window.dispatchEvent(new CustomEvent('sciflow-workflow-trigger', {
            detail: { rule, fileContext, policy: rule.policy || 'confirm', source, results }
        }));
        actionsExecuted.push('event_dispatch');

        const log: WorkflowLog = {
            id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            ruleId: rule.id, ruleName: rule.name,
            triggeredAt: new Date().toISOString(), triggerSource: source,
            fileContext, actionsExecuted, status, results,
            durationMs: Date.now() - startTime,
        };
        this.logs.unshift(log);
        this.saveLogs();

        this.notify({
            title: status === 'success' ? '✅ 工作流完成' : '⚠️ 工作流部分完成',
            content: `${rule.name}: ${actionsExecuted.length} 个动作 (${log.durationMs}ms)`,
            type: status === 'success' ? 'success' : 'warning'
        });

        // 通知 SSE 订阅者
        window.dispatchEvent(new CustomEvent('sciflow-workflow-completed', { detail: log }));

        return log;
    }

    /** 执行单个动作 */
    private async executeAction(action: WorkflowAction, fileContext: any, rule: WorkflowRule): Promise<any> {
        const interpolate = (s: string) => s
            .replace(/\{\{filename\}\}/g, fileContext.name || '')
            .replace(/\{\{path\}\}/g, fileContext.path || '')
            .replace(/\{\{ext\}\}/g, fileContext.ext || '');

        switch (action.type) {
            case 'ai_analyze': {
                const prompt = interpolate(action.config.prompt || rule.instruction);
                return await (window as any).__sciflowAPI__?.aiChat?.(prompt);
            }
            case 'import_resource': {
                const resource = {
                    id: `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    title: fileContext.name || 'Untitled',
                    path: fileContext.path,
                    type: this.inferResourceType(fileContext.ext),
                    importedAt: new Date().toISOString(),
                    importedBy: rule.createdBy || 'workflow',
                    tags: action.config?.tags || [],
                    notes: action.config?.notes || '',
                    ...action.config?.metadata,
                };
                await (window as any).__sciflowAPI__?.addResource?.(resource);
                return resource;
            }
            case 'notify': {
                const msg = {
                    title: interpolate(action.config?.title || '工作流通知'),
                    content: interpolate(action.config?.content || `规则 ${rule.name} 已执行`),
                    type: action.config?.level || 'info'
                };
                this.notify(msg);
                return { notified: true };
            }
            case 'custom_event': {
                window.dispatchEvent(new CustomEvent(action.config?.eventName || 'sciflow-custom-action', {
                    detail: { rule, fileContext, ...action.config?.data }
                }));
                return { eventDispatched: action.config?.eventName };
            }
            default:
                return { skipped: true, reason: `Unknown action: ${action.type}` };
        }
    }

    private inferResourceType(ext: string): string {
        const map: Record<string, string> = {
            '.pdf': 'paper', '.docx': 'document', '.doc': 'document',
            '.xlsx': 'data', '.xls': 'data', '.csv': 'data',
            '.json': 'data', '.xy': 'xrd_data',
            '.png': 'image', '.jpg': 'image', '.jpeg': 'image',
            '.md': 'note', '.txt': 'note',
        };
        return map[ext?.toLowerCase()] || 'file';
    }

    /** 处理管道批量导入 */
    private async handlePipelineIngest(detail: any) {
        if (!detail?.files || !Array.isArray(detail.files)) return;
        const results: any[] = [];
        for (const file of detail.files) {
            try {
                const matchingRules = this.rules.filter(r =>
                    r.isActive && r.trigger.type === 'file_added' &&
                    (!r.trigger.extension || file.ext === r.trigger.extension)
                );
                if (matchingRules.length > 0) {
                    for (const rule of matchingRules) {
                        const log = await this.executeRule(rule, file, 'pipeline');
                        results.push(log);
                    }
                } else {
                    results.push({ file: file.name, skipped: true, reason: 'No matching rules' });
                }
            } catch (e: any) {
                results.push({ file: file.name, error: e.message });
            }
        }
        window.dispatchEvent(new CustomEvent('sciflow-pipeline-complete', {
            detail: { results, totalFiles: detail.files.length }
        }));
    }

    // ═══ 公共 API ═══

    public registerRule(rule: Omit<WorkflowRule, 'id' | 'isActive'>) {
        const newRule: WorkflowRule = { ...rule, id: `rule_${Date.now()}`, isActive: true, triggerCount: 0 };
        this.rules.push(newRule);
        this.saveRules();
        if (newRule.trigger.type === 'file_added' && newRule.trigger.path) {
            window.electron?.watchDirectory(newRule.trigger.path);
        }
        return newRule;
    }

    public setNotificationHandler(handler: (msg: any) => void) { this.onNotification = handler; }

    private notify(msg: any) {
        if (this.onNotification) this.onNotification(msg);
        console.log(`[Workflow] ${msg.title}: ${msg.content}`);
    }

    public getRules() { return this.rules; }
    public getLogs() { return this.logs; }
    public clearLogs() { this.logs = []; this.saveLogs(); }

    public deleteRule(id: string) {
        const rule = this.rules.find(r => r.id === id);
        if (rule && rule.trigger.type === 'file_added' && rule.trigger.path) {
            const otherRules = this.rules.filter(r => r.id !== id && r.trigger.path === rule.trigger.path && r.isActive);
            if (otherRules.length === 0) window.electron?.unwatchDirectory(rule.trigger.path);
        }
        this.rules = this.rules.filter(r => r.id !== id);
        this.saveRules();
    }

    /** 手动触发指定规则 */
    public async triggerRule(ruleId: string, fileContext?: any): Promise<WorkflowLog | null> {
        const rule = this.rules.find(r => r.id === ruleId);
        if (!rule) return null;
        return this.executeRule(rule, fileContext || {}, 'api_manual');
    }

    /**
     * 一键配置 "OpenClaw 文件导入管道"
     * 自动创建监控目录 + 对应的工作流规则集
     */
    public setupIncomingPipeline(config: {
        basePath: string;
        types?: Array<{ name: string; extension: string; instruction: string; actions?: WorkflowAction[] }>;
    }) {
        const defaults = config.types || [
            {
                name: '论文 PDF 自动导入',
                extension: '.pdf',
                instruction: '新论文已到达，请提取元数据并录入情报档案',
                actions: [
                    { type: 'ai_analyze' as ActionType, config: { prompt: '请从以下论文文件名推断其研究主题和关键词: {{filename}}' } },
                    { type: 'import_resource' as ActionType, config: { tags: ['auto-imported', 'openclaw'] } },
                    { type: 'notify' as ActionType, config: { title: '📄 论文自动导入', content: '{{filename}} 已录入情报档案' } },
                ]
            },
            {
                name: '实验数据自动检测',
                extension: '.csv',
                instruction: '新实验数据已到达，请分析数据格式',
                actions: [
                    { type: 'ai_analyze' as ActionType, config: { prompt: '分析实验数据文件 {{filename}}，推测实验类型和数据格式' } },
                    { type: 'notify' as ActionType, config: { title: '📊 数据自动入库', content: '{{filename}} 数据已就绪' } },
                ]
            },
            {
                name: 'XRD 数据自动分析',
                extension: '.xy',
                instruction: '新 XRD 数据到达，准备进行分析',
                actions: [
                    { type: 'import_resource' as ActionType, config: { tags: ['xrd', 'auto-imported'] } },
                    { type: 'custom_event' as ActionType, config: { eventName: 'sciflow-xrd-auto-analyze' } },
                    { type: 'notify' as ActionType, config: { title: '🔬 XRD 数据就绪', content: '{{filename}} 可前往表征中心分析' } },
                ]
            },
        ];

        const createdRules: WorkflowRule[] = [];
        for (const t of defaults) {
            const rule = this.registerRule({
                name: t.name,
                trigger: { type: 'file_added', path: config.basePath, extension: t.extension },
                instruction: t.instruction, actions: t.actions,
                policy: 'silent', createdBy: 'openclaw',
            });
            createdRules.push(rule);
        }

        this.notify({
            title: '🚀 OpenClaw 导入管道已配置',
            content: `监控目录: ${config.basePath}，已创建 ${createdRules.length} 条规则`,
            type: 'success'
        });

        return createdRules;
    }
}

export const workflowEngine = new WorkflowEngine();
