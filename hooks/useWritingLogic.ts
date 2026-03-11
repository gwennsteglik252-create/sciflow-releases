
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ResearchProject, Literature, PaperSectionId, WritingSnapshot, Milestone, PaperSection, ExperimentLog } from '../types';
import { usePublishingCitations } from './usePublishingCitations';
import {
    generateMethodologyFromLogs,
    generateCaptionFromImage,
    generateComparativeResults,
    generatePlanVsActualTable,
    convertFlowchartToEmbodiment,
    summarizeExperimentLog,
    generateWritingMirrorInsight,
    polishText,
    generateSectionContent,
    formatDynamicBibliography
} from '../services/gemini';
import { formatBibliography, isStandardStyle } from '../utils/citationFormatter';
import { SECTION_CONFIG, DocType, TEMPLATES } from '../components/Writing/WritingConfig';
import { useProjectContext } from '../context/ProjectContext';
import saveAs from 'file-saver';
import { shortenFigRefs, expandFigRefs, mapDisplayPosToInternal, mapInternalPosToDisplay } from '../utils/figRefTransform';

import { useWritingState } from './useWritingState';
import { useWritingActions } from './useWritingActions';

interface UseWritingLogicProps {
    projects: ResearchProject[];
    resources: Literature[];
    initialProjectId?: string;
    initialSubView?: string;
    onUpdateProject?: (project: ResearchProject) => void;
    onSetAiStatus?: (status: string | null) => void;
    setCursorPosition?: (pos: number) => void;
    isFocusMode?: boolean;
    viewMode?: 'standard' | 'dual' | 'triple';
}

export const useWritingLogic = (props: UseWritingLogicProps) => {
    const { projects, resources, onUpdateProject, onSetAiStatus, setCursorPosition, isFocusMode, viewMode } = props;
    const { showToast, startGlobalTask } = useProjectContext();

    const state = useWritingState({
        projects,
        initialProjectId: props.initialProjectId,
        initialSubView: props.initialSubView
    });

    const {
        selectedProject, selectedProjectId, activeSectionId, editorContent, setEditorContent,
        syncedContent, setSyncedContent,
        saveStatus, setSaveStatus, manuscriptMeta, setManuscriptMeta, docType, language, setIsProcessing,
        textareaRef, cursorPositionRef, saveTimeoutRef, setLastSavedTime, setConfirmConfig,
        setActiveTab, setHighlightedResourceIds, activeTemplateId, setActiveTemplateId, templates,
        history, setHistory, historyIndex, setHistoryIndex, isJumpingManual, setIsJumpingManual
    } = state;

    const [mirrorInsight, setMirrorInsight] = useState<any>(null);
    const historyTimeoutRef = useRef<any>(null);
    const historyIndexRef = useRef(historyIndex);
    const isComposingRef = useRef(false);
    // 双栏/三栏模式下预览同步防抖 timer，避免每次按键都触发昂贵的分页重算
    const syncDebounceRef = useRef<any>(null);
    const cursorDebounceRef = useRef<any>(null);
    // 用 ref 实时跟踪 viewMode，避免闭包问题
    const viewModeRef = useRef(viewMode);
    viewModeRef.current = viewMode;

    // 计算图交叉引用映射（refId → 序号），仅用于编辑器显示图号
    const figRefMap = useMemo(() => {
        if (!selectedProject?.paperSections) return new Map<string, number>();
        const map = new Map<string, number>();
        const foundIds = new Set<string>();
        let counter = 0;
        (selectedProject.paperSections || []).forEach(section => {
            const content = section.content || '';
            const matches = content.matchAll(/\[Fig:\s*([\w\d_-]+)(?::Full)?\s*\]/gi);
            for (const match of matches) {
                const id = match[1];
                if (!foundIds.has(id)) { foundIds.add(id); map.set(id, ++counter); }
            }
        });
        return map;
    }, [selectedProject?.paperSections]);
    const figRefMapRef = useRef(figRefMap);
    figRefMapRef.current = figRefMap;

    useEffect(() => {
        historyIndexRef.current = historyIndex;
    }, [historyIndex]);

    // 计算全局引文顺序，供侧边栏、表格及预览共用
    const orderedCitations = usePublishingCitations({
        project: selectedProject,
        resources,
        currentSections: state.currentSections,
        activeSectionId: activeSectionId,
        activeSectionContent: syncedContent,
        manuscriptMeta: manuscriptMeta
    });

    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;

    const saveDraft = useCallback((content: string, sectionId: string) => {
        if (!selectedProject || !onUpdateProject) return;
        // 确保保存的是内部格式（还原 «Fig.N» → [FigRef:xxx]）
        const internal = expandFigRefs(content);
        setSaveStatus('saving');
        const currentSections = selectedProject.paperSections || [];
        const index = currentSections.findIndex((s: any) => s.id === sectionId);
        let nextSections;
        if (index > -1) {
            nextSections = [...currentSections];
            nextSections[index] = { ...nextSections[index], content: internal, title: nextSections[index].title || sectionId };
        } else {
            const sectionConfig = SECTION_CONFIG[docType].find(c => c.id === sectionId);
            nextSections = [...currentSections, { id: sectionId, title: sectionConfig?.label || sectionId, content: internal }];
        }
        onUpdateProject({ ...selectedProject, paperSections: nextSections });
        setSaveStatus('saved');
        setLastSavedTime(new Date().toLocaleTimeString());
    }, [selectedProject, onUpdateProject, docType, setSaveStatus, setLastSavedTime]);

    const recordHistory = useCallback((content: string) => {
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndexRef.current + 1);
            if (newHistory.length > 0 && newHistory[newHistory.length - 1] === content) return prev;
            newHistory.push(content);
            if (newHistory.length > 50) newHistory.shift();
            return newHistory;
        });
        setHistoryIndex(prev => {
            const next = Math.min(prev + 1, 49);
            historyIndexRef.current = next;
            return next;
        });
    }, [setHistory, setHistoryIndex]);

    const handleInsertText = useCallback((text: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const currentScrollTop = textarea.scrollTop;
        let startPos = textarea.selectionStart ?? 0;
        let endPos = textarea.selectionEnd ?? 0;

        // 如果焦点不在编辑器，尝试使用最后记录的光标位置
        if (document.activeElement !== textarea && cursorPositionRef.current) {
            startPos = cursorPositionRef.current.start ?? startPos;
            endPos = cursorPositionRef.current.end ?? endPos;
        }

        const currentVal = textarea.value || '';
        // 修正越界访问，确保位置在合法范围内
        startPos = Math.max(0, Math.min(startPos, currentVal.length));
        endPos = Math.max(startPos, Math.min(endPos, currentVal.length));

        const newText = currentVal.slice(0, startPos) + text + currentVal.slice(endPos);

        // 立即同步所有内容状态，防止 desync
        setEditorContent(shortenFigRefs(newText, figRefMapRef.current));
        setSyncedContent(expandFigRefs(newText));

        const nextCursorPos = startPos + text.length;
        cursorPositionRef.current = { start: nextCursorPos, end: nextCursorPos };

        // 关键：立即更新光标位置状态，让预览视图能够正确 Chase
        if (setCursorPosition) {
            setCursorPosition(nextCursorPos);
        }

        recordHistory(newText);
        saveDraft(newText, activeSectionId);

        // 视觉反馈与焦点恢复
        requestAnimationFrame(() => {
            if (!textarea) return;
            textarea.focus({ preventScroll: true });
            textarea.setSelectionRange(nextCursorPos, nextCursorPos);
            textarea.scrollTop = currentScrollTop;
        });
        showToast({ message: '内容已插入', type: 'success' });
    }, [activeSectionId, recordHistory, showToast, saveDraft, textareaRef, cursorPositionRef, setCursorPosition, setSyncedContent, setEditorContent]);

    // handleJumpToOffset 等后续逻辑保持不变...
    const handleJumpToOffset = useCallback((sectionId: string, offset: number, charOffset: number = 0, wordLength: number = 0) => {
        const isSectionSwitch = sectionId !== activeSectionId;
        setIsJumpingManual(true);

        if (isSectionSwitch) {
            saveDraft(editorContent, activeSectionId);
            state.setActiveSectionId(sectionId);
            const section = selectedProject?.paperSections?.find(s => s.id === sectionId);
            setEditorContent(shortenFigRefs(section?.content || '', figRefMapRef.current));
            setSyncedContent(section?.content || '');
        }

        let attempts = 0;
        const maxAttempts = 20;

        const tryJump = () => {
            const el = textareaRef.current;
            if (!el || (isSectionSwitch && el.value.length === 0 && offset > 0)) {
                if (attempts < maxAttempts) {
                    attempts++;
                    requestAnimationFrame(tryJump);
                } else {
                    setIsJumpingManual(false);
                }
                return;
            }

            el.focus({ preventScroll: true });

            // 映射段落起点到编辑器显示空间，然后加上段内字符偏移
            const paraStart = mapInternalPosToDisplay(syncedContent || '', offset, figRefMapRef.current);
            const finalOffset = paraStart + charOffset;

            el.setSelectionRange(finalOffset, finalOffset + wordLength);

            const totalChars = el.value.length || 1;
            const viewHeight = el.clientHeight;
            const scrollHeight = el.scrollHeight;
            const charRatio = finalOffset / totalChars;
            const targetScrollTop = (scrollHeight * charRatio) - (viewHeight / 2);

            el.scrollTo({
                top: Math.max(0, targetScrollTop),
                behavior: 'smooth'
            });

            el.classList.remove('editor-flash-active');
            void el.offsetWidth;
            el.classList.add('editor-flash-active');

            if (setCursorPosition) setCursorPosition(mapDisplayPosToInternal(el.value, finalOffset + wordLength));

            setTimeout(() => { setIsJumpingManual(false); }, 800);
        };

        requestAnimationFrame(tryJump);
    }, [activeSectionId, editorContent, selectedProject, state.setActiveSectionId, setEditorContent, textareaRef, saveDraft, setCursorPosition, setIsJumpingManual, setSyncedContent]);

    const handleUndo = useCallback(() => {
        if (historyIndexRef.current > 0) {
            const newIndex = historyIndexRef.current - 1;
            const previousContent = history[newIndex];
            setEditorContent(previousContent);
            setSyncedContent(expandFigRefs(previousContent));
            setHistoryIndex(newIndex);
            setSaveStatus('unsaved');
            saveDraft(previousContent, activeSectionId);
        }
    }, [history, setEditorContent, setHistoryIndex, setSaveStatus, saveDraft, activeSectionId, setSyncedContent]);

    const handleRedo = useCallback(() => {
        if (historyIndexRef.current < history.length - 1) {
            const newIndex = historyIndexRef.current + 1;
            const nextContent = history[newIndex];
            setEditorContent(nextContent);
            setSyncedContent(expandFigRefs(nextContent));
            setHistoryIndex(newIndex);
            setSaveStatus('unsaved');
            saveDraft(nextContent, activeSectionId);
        }
    }, [history, setEditorContent, setHistoryIndex, setSaveStatus, saveDraft, activeSectionId, setSyncedContent]);

    const handleSelectTemplate = useCallback((id: string) => {
        const template = TEMPLATES.find(t => t.id === id);
        if (!template) return;
        setActiveTemplateId(id);
        const nextMeta = { ...manuscriptMeta, outlineStyles: JSON.parse(JSON.stringify(template.styles)), keywordsStyle: { ...template.styles.keywords } };
        setManuscriptMeta(nextMeta);
        showToast({ message: `已应用期刊模板: ${template.name}`, type: 'success' });
    }, [manuscriptMeta, setActiveTemplateId, setManuscriptMeta, showToast]);

    const handleRunMirrorAnalysis = async () => {
        if (!selectedProject || !selectedProject.proposalText) {
            showToast({ message: "请先在课题中心上传项目计划书", type: 'info' });
            return;
        }
        const logs = selectedProject.milestones.flatMap(m => m.logs);
        if (logs.length === 0) {
            showToast({ message: "暂无实验证据可对比", type: 'info' });
            return;
        }
        setIsProcessing(true);
        try {
            const result = await generateWritingMirrorInsight(selectedProject.proposalText, logs, language);
            setMirrorInsight(result);
            showToast({ message: "镜像对标分析完成", type: 'success' });
        } catch (e) {
            showToast({ message: "分析失败", type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleGenerateBib = useCallback(async (style: string) => {
        if (!selectedProject) return;
        const projectRes = (resources || []).filter(r => r && r.projectId === selectedProjectId);
        const orderedSectionConfigs = SECTION_CONFIG[docType] || [];
        const fullText = orderedSectionConfigs.map(cfg => {
            const sec = selectedProject.paperSections?.find(s => s.id === cfg.id);
            return (cfg.id === activeSectionId) ? editorContent : (sec?.content || '');
        }).join(' ');
        const citationRegex = /(\([^)]+?et\s+al\.?,\s*\d{4}\)|\[(?!(?:Fig|Table|Math|Ref):)[^\]]+?\])/gi;
        const seenKeys = new Set<string>();
        const keysInOrder: string[] = [];
        const matches = fullText.matchAll(citationRegex);
        for (const match of Array.from(matches)) {
            const key = match[0].trim();
            if (!seenKeys.has(key)) { seenKeys.add(key); keysInOrder.push(key); }
        }
        const citedResources: Literature[] = [];
        const citedIds = new Set<string>();
        keysInOrder.forEach(key => {
            let found = projectRes.find(r => {
                if (r.type === '专利') { return key.includes(r.title); } else {
                    const firstAuthor = r.authors?.[0] || '';
                    const trimmedA = firstAuthor.trim();
                    const lastName = trimmedA.includes(',')
                        ? trimmedA.split(',')[0].trim()
                        : /^[\u4e00-\u9fff]+$/.test(trimmedA)
                            ? trimmedA
                            : trimmedA.split(/\s+/)[0] || trimmedA;
                    const safeAuthor = lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const pattern = new RegExp(`${safeAuthor}(?:\\s+et\\s+al\\.?)?等?\\s*,?\\s*${r.year}`, 'i');
                    return pattern.test(key);
                }
            });
            if (found && !citedIds.has(found.id)) { citedIds.add(found.id); citedResources.push(found); }
        });
        if (citedResources.length === 0) {
            showToast({ message: '全文中未探测到有效的学术引用锚点', type: 'info' });
            return;
        }
        let bibText = "";
        if (isStandardStyle(style)) {
            bibText = formatBibliography(style, citedResources);
        } else {
            await startGlobalTask({ id: `bib_gen_${Date.now()}`, type: 'writing_assist', status: 'running', title: `正在对标 [${style}] 引用规范...` }, async () => {
                bibText = await formatDynamicBibliography(style, citedResources);
            });
        }
        if (bibText) {
            if (activeSectionId === 'references') {
                setEditorContent(shortenFigRefs(bibText, figRefMapRef.current));
                setSyncedContent(expandFigRefs(bibText));
                saveDraft(bibText, 'references');
            } else {
                handleInsertText(`\n${bibText}\n`);
            }
            if (onUpdateProject) { onUpdateProject({ ...selectedProject, citedLiteratureIds: Array.from(citedIds) }); }
            showToast({ message: `已完成 [${style}] 格式化：共 ${citedResources.length} 篇文献`, type: 'success' });
        }
    }, [resources, selectedProjectId, selectedProject, activeSectionId, editorContent, docType, showToast, saveDraft, onUpdateProject, handleInsertText, startGlobalTask, setSyncedContent, setEditorContent]);

    const handleJumpToHeading = useCallback((sectionId: string, headingText: string) => {
        if (activeSectionId !== sectionId) {
            saveDraft(editorContent, activeSectionId);
            state.setActiveSectionId(sectionId);
            const section = selectedProject?.paperSections?.find(s => s.id === sectionId);
            setEditorContent(shortenFigRefs(section?.content || '', figRefMapRef.current));
            setSyncedContent(section?.content || '');
        }
        setTimeout(() => {
            const textarea = textareaRef.current;
            if (textarea) {
                const index = textarea.value.indexOf(headingText);
                if (index !== -1) {
                    textarea.focus();
                    textarea.setSelectionRange(index, index + headingText.length);
                    textarea.scrollTop = Math.max(0, (index / textarea.value.length) * textarea.scrollHeight - 100);
                }
            }
        }, 150);
    }, [activeSectionId, editorContent, selectedProject, state.setActiveSectionId, setEditorContent, textareaRef, saveDraft, setSyncedContent]);

    const handleExportPackage = useCallback(() => {
        if (!selectedProject) return;
        showToast({ message: "正在构建 LaTeX 标准投稿资源包...", type: 'info' });

        const title = manuscriptMeta.title || selectedProject.title;
        const sectionsMarkdown = (selectedProject.paperSections || []).map(s => `\n% --- Section: ${s.title} ---\n${s.content}`).join('\n');

        const authorsList = manuscriptMeta.authorList.map(a => `${a.name} (${a.affiliation})`).join(', ');

        const fullPackage = `% SciFlow Pro Export Package\n% Project: ${selectedProject.title}\n% Title: ${title}\n% Authors: ${authorsList}\n\n${sectionsMarkdown}`;

        const blob = new Blob([fullPackage], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, `${selectedProject.title.replace(/\s+/g, '_')}_LaTeX_Package.txt`);
        showToast({ message: "资源包构建完成并导出", type: 'success' });
    }, [selectedProject, manuscriptMeta, showToast]);

    const documentOutline = useMemo(() => {
        if (!selectedProject?.paperSections) return [];
        const outline: any[] = [];
        SECTION_CONFIG[docType].forEach(cfg => {
            outline.push({ level: 1, text: cfg.label, sectionId: cfg.id });
            const saved = selectedProject.paperSections?.find(s => s.id === cfg.id);
            const content = (state.activeSectionId === cfg.id) ? state.editorContent : (saved?.content || '');
            if (content) {
                content.split('\n').forEach(line => {
                    const h2Match = line.match(/^##\s+(.*)/);
                    if (h2Match) outline.push({ level: 2, text: h2Match[1].trim(), sectionId: cfg.id });
                    else {
                        const h3Match = line.match(/^###\s+(.*)/);
                        if (h3Match) outline.push({ level: 3, text: h3Match[1].trim(), sectionId: cfg.id });
                    }
                });
            }
        });
        return outline;
    }, [selectedProject?.paperSections, state.editorContent, state.activeSectionId, docType]);

    // 稳定化 documentOutline 引用：只有 outline 内容真正变化时才返回新数组，
    // 避免每次按键（editorContent 变化）都产生新引用导致下游 useMemo/memo 失效
    // 使用更轻量的 fingerprint（只比较 level+text）代替完整 JSON.stringify
    const stableOutlineRef = useRef<typeof documentOutline>(documentOutline);
    const outlineFingerprint = documentOutline.map(o => `${o.level}|${o.text}`).join('\n');
    const prevOutlineFingerprint = useRef(outlineFingerprint);
    if (outlineFingerprint !== prevOutlineFingerprint.current) {
        stableOutlineRef.current = documentOutline;
        prevOutlineFingerprint.current = outlineFingerprint;
    }
    const stableOutline = stableOutlineRef.current;

    // 包装 setter，确保所有通过 useWritingActions 的 setEditorContent/setSyncedContent 调用
    // 自动应用 FigRef 转换。使用独立的 useCallback 保证引用稳定。
    const wrappedSetEditorContent = useCallback((content: string) => {
        setEditorContent(shortenFigRefs(content, figRefMapRef.current));
    }, [setEditorContent]);

    const wrappedSetSyncedContent = useCallback((content: string) => {
        setSyncedContent(expandFigRefs(content));
    }, [setSyncedContent]);

    // 关键修复：每次渲染都铺展最新的 state（含最新 editorContent），
    // 不再用 useMemo 冻结，避免 handleFormatText 等读到过期的 editorContent 导致内容消失。
    const wrappedState = {
        ...state,
        setEditorContent: wrappedSetEditorContent,
        setSyncedContent: wrappedSetSyncedContent,
    };

    const actions = useWritingActions({
        state: wrappedState, resources, onUpdateProject, showToast, handleInsertText, saveDraft, recordHistory, setCursorPosition
    });

    useEffect(() => {
        if (selectedProject) {
            const section = selectedProject.paperSections?.find(s => s.id === activeSectionId);
            const raw = section?.content || '';
            const display = shortenFigRefs(raw, figRefMapRef.current);
            setEditorContent(display);
            setSyncedContent(raw);
            setHistory([display]);
            historyIndexRef.current = 0;
            setHistoryIndex(0);
        }
    }, [activeSectionId, selectedProjectId]);

    return {
        state: { ...state, documentOutline: stableOutline, canUndo, canRedo, mirrorInsight, orderedCitations },
        refs: { textareaRef: state.textareaRef, cursorPositionRef: state.cursorPositionRef },
        actions: {
            ...actions,
            handleUndo,
            handleRedo,
            handleSelectTemplate,
            handleRunMirrorAnalysis,
            handleInsertText,
            handleGenerateBib,
            handleJumpToHeading,
            handleJumpToOffset,
            handleExportPackage,
            saveDraft,
            handleEditorChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
                const nc = e.target.value;
                // 编辑器内容始终实时更新，保证输入流畅
                setEditorContent(nc);
                setSaveStatus('unsaved');

                // 关键修复：中文输入法合成期间不强制同步预览，防止预览区“光标乱跳”
                if (isFocusMode && isComposingRef.current) return;

                const isMultiPanel = viewModeRef.current === 'dual' || viewModeRef.current === 'triple';

                if (isMultiPanel) {
                    // 双栏/三栏模式：对预览同步做防抖（500ms），
                    // 避免每次按键都触发 usePublishingPagination 的昂贵重算
                    if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current);
                    syncDebounceRef.current = setTimeout(() => {
                        setSyncedContent(expandFigRefs(nc));
                    }, 500);

                    if (setCursorPosition) {
                        if (cursorDebounceRef.current) clearTimeout(cursorDebounceRef.current);
                        cursorDebounceRef.current = setTimeout(() => {
                            setCursorPosition(mapDisplayPosToInternal(nc, e.target.selectionStart));
                        }, 500);
                    }
                } else {
                    // 标准模式：实时同步
                    setSyncedContent(expandFigRefs(nc));
                    if (setCursorPosition) setCursorPosition(mapDisplayPosToInternal(nc, e.target.selectionStart));
                }

                if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
                historyTimeoutRef.current = setTimeout(() => recordHistory(nc), 1000);

                if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = setTimeout(() => saveDraft(nc, activeSectionId), 3000);
            },
            handleEditorSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
                actions.handleEditorSelect(e);
                if (isFocusMode && isComposingRef.current) return;
                const target = e.target as HTMLTextAreaElement;
                if (target && typeof target.selectionStart === 'number' && setCursorPosition) {
                    const isMultiPanel = viewModeRef.current === 'dual' || viewModeRef.current === 'triple';
                    if (isMultiPanel) {
                        // 双栏/三栏：光标选择事件同样防抖，避免拖选/快速移动触发大量 state 更新
                        if (cursorDebounceRef.current) clearTimeout(cursorDebounceRef.current);
                        cursorDebounceRef.current = setTimeout(() => {
                            setCursorPosition(mapDisplayPosToInternal(target.value, target.selectionStart));
                        }, 250);
                    } else {
                        setCursorPosition(mapDisplayPosToInternal(target.value, target.selectionStart));
                    }
                }
            },
            handleCompositionStart: () => {
                isComposingRef.current = true;
            },
            handleCompositionEnd: (e: React.CompositionEvent<HTMLTextAreaElement>) => {
                isComposingRef.current = false;
                const target = e.target as HTMLTextAreaElement;
                const nc = target.value;
                setEditorContent(nc);
                setSyncedContent(expandFigRefs(nc));
                if (setCursorPosition) {
                    setCursorPosition(mapDisplayPosToInternal(nc, target.selectionStart));
                }
                saveDraft(nc, activeSectionId);
                recordHistory(nc);
            },
            onGenerateMethodology: (ms: Milestone) => generateMethodologyFromLogs(ms.title, ms.logs, language).then(text => handleInsertText(text)),
            onGenerateCaption: (desc: string) => generateCaptionFromImage(desc, language).then(c => handleInsertText(c)),
            handleGenerateConclusion: (log: any) => summarizeExperimentLog(log, language).then(s => handleInsertText(`**结论:** ${s}`))
        }
    };
};
