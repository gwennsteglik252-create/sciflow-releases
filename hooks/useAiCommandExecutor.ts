
import { useCallback } from 'react';
import { useProjectContext } from '../context/ProjectContext';
import { parseAiCommand } from '../services/gemini/cliDispatcher';
import { AiCliCommand, AiCliResponse } from '../types';
import { workflowEngine, ExecutionPolicy } from '../services/ai/workflowEngine';

export const useAiCommandExecutor = () => {
    const {
        setAiCliHistory,
        appSettings,
        navigate,
        setProjects,
        projects,
        addProjectLog,
        updateProjectProgress,
        autoPlotData,
        setModalOpen,
        showToast
    } = useProjectContext();

    const executeAction = useCallback((response: AiCliResponse, policy: ExecutionPolicy = 'confirm'): string => {
        if (!response) return '收到，但我不知道该执行什么动作。';

        if (response.action === 'multi_action' && response.actions) {
            let fullMsg = '正在执行组合动作：\n';
            response.actions.forEach((act: any, idx: number) => {
                const stepMsg = executeAction(act as AiCliResponse, policy);
                fullMsg += `${idx + 1}. ${stepMsg}\n`;
            });
            return fullMsg;
        }

        let resMsg = '';
        if (response.action === 'navigate' && response.target) {
            navigate(response.target as any);
            resMsg = `已切换至工作区: ${response.target}`;
        } else if (response.action === 'create_project') {
            const title = response.payload?.title || '新课题库';
            const category = response.payload?.category || '其他';
            const newProject = {
                id: `proj_${Date.now()}`,
                title, category,
                progress: 0,
                milestones: [],
                members: ['SF-2024-8821'],
                activeTasks: 0,
                pendingTasks: 0,
                completedTasks: 0
            } as any;
            setProjects((prev: any) => [newProject, ...prev]);
            resMsg = `已成功创建项目《${title}》(${category})`;
        } else if (response.action === 'register_workflow') {
            const payload = response.payload;
            if (payload?.trigger && (payload?.instruction || payload?.workflow)) {
                workflowEngine.registerRule({
                    name: payload.ruleName || '未命名规则',
                    trigger: payload.trigger as any,
                    instruction: payload.instruction || payload.workflow,
                    policy: payload.policy as ExecutionPolicy || 'confirm'
                });
                resMsg = `工作流注册成功！\n触发: 当 ${payload.trigger.path} 有新文件时\n执行: ${payload.instruction || payload.workflow}\n策略: ${payload.policy === 'silent' ? '静默执行' : '弹窗确认'}`;
            } else {
                resMsg = '注册失败：缺少触发条件或执行指令。';
            }
        } else if (response.action === 'add_log') {
            const { projectId, content, title } = response.payload || {};
            const targetProjId = projectId || (projects.length > 0 ? projects[0].id : null);
            if (targetProjId && content) {
                addProjectLog(targetProjId, content, title);
                resMsg = `已在项目中添加日志: ${content.substring(0, 30)}...`;
            } else {
                resMsg = '无法确定项目 ID 或日志内容。';
            }
        } else if (response.action === 'update_progress') {
            const { projectId, progress } = response.payload || {};
            const targetProjId = projectId || (projects.length > 0 ? projects[0].id : null);
            if (targetProjId && progress !== undefined) {
                updateProjectProgress(targetProjId, progress);
                resMsg = `项目进度已更新至 ${progress}%`;
            } else {
                resMsg = '无法确定项目 ID 或进度值。';
            }
        } else if (response.action === 'auto_plot') {
            const { title, data } = response.payload || {};
            if (data && Array.isArray(data)) {
                autoPlotData(title || '自动绘图', data);
                resMsg = `图表《${title || '自动绘图'}》已生成并跳转。`;
            } else {
                resMsg = '绘图失败：缺少有效数据。';
            }
        } else if (response.action === 'scan_folder') {
            const folderPath = response.target;
            const instruction = response.payload?.instruction || '分析这些内容';
            if (folderPath) {
                resMsg = `正在扫描目录: ${folderPath}...`;
                // Trigging scanning logic
                setTimeout(async () => {
                    if (!window.electron) return;
                    try {
                        const files = await window.electron.listDirectory(folderPath);
                        const relevantFiles = files.filter(f => !f.isDirectory && (f.ext === '.csv' || f.ext === '.pdf' || f.ext === '.txt' || f.ext === '.xy'));

                        if (relevantFiles.length > 0) {
                            if (relevantFiles.length === 1) {
                                const file = relevantFiles[0];
                                const fileData = await window.electron.readFile(file.path);
                                const apiKey = (appSettings as any).geminiConfig?.apiKey || (appSettings as any).openaiConfig?.apiKey || '';
                                const enrichedInstruction = `${instruction}\nContext: I picked "${file.name}" from folder "${folderPath}".`;
                                const nestedResponse = await parseAiCommand(enrichedInstruction, apiKey, fileData);
                                const nestedResMsg = executeAction(nestedResponse);

                                setAiCliHistory((prev: any) => [...prev, {
                                    text: `[Agent] 目录分析结果 (${file.name})`,
                                    timestamp: new Date().toLocaleTimeString(),
                                    status: 'success',
                                    response: nestedResMsg
                                }]);
                            } else {
                                setAiCliHistory((prev: any) => [...prev, {
                                    text: `[Agent] 发现多个相关文件 (${relevantFiles.length})`,
                                    timestamp: new Date().toLocaleTimeString(),
                                    status: 'success',
                                    response: `在 ${folderPath} 中找到了多个科研文件，请勾选您想要批量分析的对象：`,
                                    selectionList: relevantFiles.map(f => ({
                                        label: `${f.name} (${(f.size / 1024).toFixed(1)} KB)`,
                                        value: { ...f, type: 'file' },
                                        selected: false
                                    })),
                                    selectionType: 'multiple'
                                }]);
                            }
                        } else {
                            setAiCliHistory((prev: any) => [...prev, {
                                text: `[Agent] 目录扫描完毕`,
                                timestamp: new Date().toLocaleTimeString(),
                                status: 'error',
                                response: `在 ${folderPath} 中未发现可处理的科研数据文件 (.csv, .pdf, .txt, .xy)。`,
                                healingActions: [
                                    { label: '选择其他文件夹', action: { action: 'open_modal', target: 'select_folder_healing', payload: { folderPath } } },
                                    { label: '扫描桌面 (Desktop)', action: { action: 'scan_folder', target: '~/Desktop', payload: { instruction } } }
                                ]
                            }]);
                        }
                    } catch (e: any) {
                        showToast({ message: `扫描文件夹失败: ${e.message}`, type: 'error' });
                    }
                }, 100);
            } else {
                resMsg = '扫描失败：未指定目录路径。';
            }
        } else if (response.action === 'switch_theme') {
            resMsg = `系统主题已调度: ${response.payload?.mode}`;
        } else if (response.action === 'open_modal') {
            setModalOpen(response.target || 'settings', true);
            resMsg = `已开启 ${response.target} 窗口`;
        } else if (response.action === 'chat') {
            resMsg = response.message || '指令收到。';
        } else if (response.action === 'error') {
            resMsg = response.message || '处理出现异常。';
        } else {
            resMsg = '无法理解该指令，请更换描述。';
        }
        return resMsg;
    }, [navigate, setProjects, projects, addProjectLog, updateProjectProgress, autoPlotData, setModalOpen, appSettings, setAiCliHistory, showToast]);

    const processCommand = useCallback(async (text: string, fileData?: { mimeType: string; data: string } | null) => {
        const commandEntry: AiCliCommand = {
            text: text,
            timestamp: new Date().toLocaleTimeString(),
            status: 'pending'
        };

        setAiCliHistory((prev: any) => [...prev, commandEntry]);

        try {
            const apiKey = (appSettings as any).geminiConfig?.apiKey || (appSettings as any).openaiConfig?.apiKey || '';
            const response = await parseAiCommand(text, apiKey, fileData);
            const resMsg = executeAction(response);

            setAiCliHistory((prev: any) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0) {
                    next[lastIdx] = {
                        ...next[lastIdx],
                        status: response.action === 'error' ? 'error' : 'success',
                        response: resMsg,
                        // Preserve response objects for interactive UI
                        pendingAction: response.action === 'unknown' ? undefined : (response as any).pendingAction || response
                    };
                    // Special case for warning/confirm policy which is handled in executeAction caller usually
                    // But here we just return the result message.
                }
                return next;
            });
            return { response, message: resMsg };
        } catch (err: any) {
            const errMsg = err.message || 'Execution Failed';
            setAiCliHistory((prev: any) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                if (lastIdx >= 0) {
                    next[lastIdx] = { ...next[lastIdx], status: 'error', response: errMsg };
                }
                return next;
            });
            throw err;
        }
    }, [appSettings, executeAction, setAiCliHistory]);

    return { executeAction, processCommand };
};
