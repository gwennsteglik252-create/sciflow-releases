import React, { useCallback } from 'react';
import { ResearchProject, Literature, ExperimentLog, Milestone, WritingSnapshot, ExperimentFile, PaperSectionId, ProjectTable, ProjectLatexSnippet, PaperSection, TransformationProposal } from '../types';
import {
    polishText, integrateRevision, generateSectionContent, generateMethodologyFromLogs,
    generateCaptionFromImage, generateComparativeResults, generatePlanVsActualTable,
    convertFlowchartToEmbodiment, runPeerReview, summarizeExperimentLog
} from '../services/gemini';
import { exportToWord } from '../utils/documentExport';
import { SECTION_CONFIG, DocType } from '../components/Writing/WritingConfig';
import { CITE_REGEX } from './usePublishingCitations';

interface UseWritingActionsProps {
    state: any;
    resources: Literature[];
    onUpdateProject?: (project: ResearchProject) => void;
    showToast: (msg: any) => void;
    handleInsertText: (text: string) => void;
    saveDraft: (content: string, sectionId: string) => void;
    recordHistory: (content: string) => void;
    setCursorPosition?: (pos: number) => void;
}

export const useWritingActions = ({
    state,
    resources,
    onUpdateProject,
    showToast,
    handleInsertText,
    saveDraft,
    recordHistory,
    setCursorPosition
}: UseWritingActionsProps) => {
    const {
        selectedProject, selectedProjectId, language, editorContent, setEditorContent, setSyncedContent,
        activeSectionId, docType, setIsProcessing, setReviewResult, setAppliedCritiqueQuotes,
        manuscriptMeta, setManuscriptMeta, setConfirmConfig, activeTemplateId, textareaRef, cursorPositionRef,
        selectedLogIds, setActiveSectionId, setActiveTab, setActiveMediaSubTab, setHighlightedResourceIds
    } = state;

    /**
     * 智能提取作者姓氏（surname），兼容多种学术姓名格式：
     * - "Zhang, San" / "Li, Chunyang" → 取逗号前的部分 "Zhang" / "Li"
     * - "Zhang San" / "Wang Xiaoming" → 取第一个词 "Zhang" / "Wang"
     * - "张三" / "王小明" → 中文名整体返回
     * - "Zhang" → 单词直接返回
     */
    const getLastName = (authorName: string): string => {
        const trimmed = authorName.trim();
        if (!trimmed) return trimmed;
        // 如果含逗号，取逗号前部分（"Last, First" 格式）
        if (trimmed.includes(',')) {
            return trimmed.split(',')[0].trim();
        }
        // 如果全是中文字符（无空格分隔），返回整体
        if (/^[\u4e00-\u9fff]+$/.test(trimmed)) {
            return trimmed;
        }
        // 空格分隔的西文名，取第一个词作为姓
        const parts = trimmed.split(/\s+/);
        return parts[0];
    };

    const getCitationTag = (res: Literature) => {
        if (res.type === '专利') {
            return `[${res.title}, ${res.source}]`;
        }
        const authors = res.authors || [];
        if (authors.length === 0 || !res.year) return `[${res.title}]`;
        const lastName = getLastName(authors[0]);
        return `(${lastName} et al., ${res.year})`;
    };

    const handleFindToken = (tokenType: 'Fig' | 'Table' | 'Math' | 'Log' | 'Cite', id: string) => {
        if (!selectedProject) return;

        let regex: RegExp;
        if (tokenType === 'Cite') {
            const res = (resources || []).find(r => r.id === id);
            if (!res) {
                showToast({ message: '无法在文献库中找到对应条目', type: 'error' });
                return;
            }

            if (res.type === '专利') {
                const escapedTitle = res.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                regex = new RegExp(`\\[${escapedTitle},.*?\\]`, 'gi');
            } else {
                const firstAuthor = res.authors?.[0] || '';
                const lastName = getLastName(firstAuthor);
                const escapedName = lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                regex = new RegExp(`\\(?${escapedName}\\s+et\\s+al\\.?\\s*,?\\s*${res.year}\\)?`, 'gi');
            }
        } else {
            regex = new RegExp(`\\[${tokenType}:\\s*${id}(?::Full)?\\s*\\]`, 'gi');
        }

        const allMatches: { sectionId: string; index: number; length: number }[] = [];
        (selectedProject.paperSections || []).forEach((sec: PaperSection) => {
            const text = sec.id === activeSectionId ? editorContent : (sec.content || '');
            let match;
            regex.lastIndex = 0;
            while ((match = regex.exec(text)) !== null) {
                allMatches.push({ sectionId: sec.id, index: match.index, length: match[0].length });
            }
        });

        if (allMatches.length === 0) {
            showToast({ message: '全文尚未发现该引用的位置', type: 'info' });
            return;
        }

        const currentCursorPos = textareaRef.current?.selectionStart || 0;
        let targetMatch = allMatches.find(m => m.sectionId === activeSectionId && m.index > currentCursorPos);

        if (!targetMatch) {
            const sections = (selectedProject.paperSections || []).map((s: PaperSection) => s.id);
            const currentSecIdx = sections.indexOf(activeSectionId);
            targetMatch = allMatches.find(m => sections.indexOf(m.sectionId) > currentSecIdx);
            if (!targetMatch) targetMatch = allMatches[0];
        }

        const totalMatches = allMatches.length;
        const matchIdx = allMatches.indexOf(targetMatch) + 1;

        const performJump = (m: typeof targetMatch) => {
            const el = textareaRef.current;
            if (!el) return;

            requestAnimationFrame(() => {
                el.focus();
                el.setSelectionRange(m.index, m.index + m.length);
                const scrollRatio = m.index / el.value.length;
                const targetTop = scrollRatio * el.scrollHeight - 100;
                el.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
                showToast({ message: `已定位第 ${matchIdx}/${totalMatches} 处引用`, type: 'success' });
            });
        };

        if (targetMatch.sectionId !== activeSectionId) {
            saveDraft(editorContent, activeSectionId);
            setActiveSectionId(targetMatch.sectionId);
            setTimeout(() => performJump(targetMatch), 100);
        } else {
            // Fix: Changed jumpPerform to performJump
            performJump(targetMatch);
        }
    };

    const handleFindCitation = (res: Literature) => {
        handleFindToken('Cite', res.id);
    };

    const handleEditorDoubleClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
        const textarea = e.currentTarget;
        const text = textarea.value;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        const selection = text.substring(start, end).trim();
        if (!selection) return;

        const triggerHighlight = (id: string) => {
            setHighlightedResourceIds([id]);
            setTimeout(() => setHighlightedResourceIds([]), 4000);
        };

        const tagMatch = selection.match(/^\[(Fig|Table|Math|Log):\s*([\w\d_-]+)(?::Full)?\s*\]$/i);
        if (tagMatch) {
            const type = tagMatch[1];
            const id = tagMatch[2];

            if (['Fig', 'Table', 'Math'].includes(type)) {
                setActiveTab('media');
                if (type === 'Fig') setActiveMediaSubTab('images');
                else if (type === 'Table') setActiveMediaSubTab('tables');
                else if (type === 'Math') setActiveMediaSubTab('latex');
                triggerHighlight(id);
                showToast({ message: `已定位资源：${id}`, type: 'success' });
            } else if (type === 'Log') {
                setActiveTab('materials');
                triggerHighlight(id);
                showToast({ message: '已定位实验记录', type: 'success' });
            }
            return;
        }

        const citeMatch = selection.match(/^\(([^)]+?et\s+al\.?,\s*(\d{4}))\)$/i);
        if (citeMatch) {
            const lastName = citeMatch[1].split(/[\s,]+/)[0].toLowerCase();
            const year = parseInt(citeMatch[2]);
            const found = resources.find(r => r.projectId === selectedProjectId && r.year === year && r.authors?.some(a => a.toLowerCase().includes(lastName)));
            if (found) { setActiveTab('literature'); triggerHighlight(found.id); showToast({ message: '已从文献库定位引用源', type: 'success' }); return; }
        }

        const patentMatch = selection.match(/^\[([^\]]+?),\s*([^\]]+?)\]$/);
        if (patentMatch) {
            const titlePart = patentMatch[1].toLowerCase();
            const found = resources.find(r => r.projectId === selectedProjectId && r.type === '专利' && r.title.toLowerCase().includes(titlePart));
            if (found) { setActiveTab('literature'); triggerHighlight(found.id); showToast({ message: '已定位关联专利', type: 'success' }); }
        }
    };

    const handlePolish = async (mode: string) => {
        const text = editorContent;
        setIsProcessing(true);
        try {
            const polished = await polishText(text, mode, language);
            if (polished) {
                setEditorContent(polished);
                setSyncedContent(polished);
                recordHistory(polished);
                saveDraft(polished, activeSectionId);
                showToast({ message: '润色完成', type: 'success' });
            }
        } catch (e) { showToast({ message: '润色服务暂时不可用', type: 'error' }); } finally { setIsProcessing(false); }
    };

    const handleSmartWrite = async () => {
        if (!selectedProject) return;
        const section = (SECTION_CONFIG[docType as DocType] || []).find((s: any) => s.id === activeSectionId);
        setIsProcessing(true);
        try {
            const result = await generateSectionContent(activeSectionId, section?.label || '', {
                title: selectedProject.title,
                description: selectedProject.description,
                logs: selectedProject.milestones.flatMap((m: Milestone) => m.logs),
                resources: resources.filter((r: Literature) => r.projectId === selectedProjectId)
            }, language);
            if (result && (result as any).content) {
                setEditorContent((result as any).content);
                setSyncedContent((result as any).content);
                recordHistory((result as any).content);
                saveDraft((result as any).content, activeSectionId);
                showToast({ message: 'AI 智能初稿完成', type: 'success' });
            }
        } catch (e) { showToast({ message: '生成失败', type: 'error' }); } finally { setIsProcessing(false); }
    };

    const handleRunSimulatedReview = async () => {
        if (!selectedProject) return;
        const hasContent = selectedProject.paperSections?.some((s: PaperSection) => s.content.trim().length > 0);
        if (!hasContent) { showToast({ message: "文档尚无内容", type: 'info' }); return; }
        setIsProcessing(true);
        try {
            const result = await runPeerReview(selectedProject.paperSections || [], language);
            if (result && (result as any).critiques) { setReviewResult(result); setAppliedCritiqueQuotes(new Set()); showToast({ message: "模拟评审完成", type: 'success' }); }
        } catch (e) { showToast({ message: "审稿服务不可用", type: 'error' }); } finally { setIsProcessing(false); }
    };

    const handleApplySuggestion = async (quote: string, revision: string) => {
        setIsProcessing(true);
        try {
            const updatedContent = await integrateRevision(editorContent, quote, revision, language);
            if (updatedContent) {
                setEditorContent(updatedContent);
                setSyncedContent(updatedContent);
                recordHistory(updatedContent);
                saveDraft(updatedContent, activeSectionId);
                state.setAppliedCritiqueQuotes((prev: Set<string>) => new Set(prev).add(quote));
                showToast({ message: '修订建议已融合', type: 'success' });
            }
        } finally { setIsProcessing(false); }
    };

    const handleExportWord = () => {
        if (!selectedProject) return;
        const title = manuscriptMeta.title || selectedProject.title;
        const content = selectedProject.paperSections?.map((s: any) => `<h2>${s.title}</h2><div>${s.content}</div>`).join('') || editorContent;
        exportToWord(title, content);
    };

    const handleManualMediaUpload = async (file: File, desc: string) => {
        if (!selectedProject || !onUpdateProject) return;
        // 将文件转为 Base64 Data URL 以实现持久化存储（Blob URL 重启后失效）
        const toBase64 = (f: File): Promise<string> => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(f);
        });
        try {
            const dataUrl = await toBase64(file);
            const newFile: ExperimentFile = {
                name: file.name,
                url: dataUrl,
                description: desc,
                lastModified: Date.now(),
                refId: `IMG_PROJ_${Math.random().toString(36).substr(2, 4).toUpperCase()}`
            };
            onUpdateProject({ ...selectedProject, media: [newFile, ...(selectedProject.media || [])] });
            showToast({ message: '素材已上传', type: 'success' });
        } catch (e) {
            showToast({ message: '图片读取失败', type: 'error' });
        }
    };

    const handleCreateSnapshot = (title: string) => {
        if (!selectedProject || !onUpdateProject) return;
        const snapshot: WritingSnapshot = {
            id: Date.now().toString(),
            title,
            timestamp: new Date().toLocaleString(),
            paperSections: JSON.parse(JSON.stringify(selectedProject.paperSections || [])),
            manuscriptMeta: JSON.parse(JSON.stringify(manuscriptMeta)),
            citedLiteratureIds: [...(selectedProject.citedLiteratureIds || [])]
        };
        onUpdateProject({ ...selectedProject, writingSnapshots: [snapshot, ...(selectedProject.writingSnapshots || [])] });
        showToast({ message: '版本快照已创建', type: 'success' });
    };

    const handleDeleteTemplate = (id: string) => {
        const { templates, setTemplates, activeTemplateId, setActiveTemplateId } = state;
        const newTemplates = templates.filter((t: any) => t.id !== id);
        setTemplates(newTemplates);
        if (activeTemplateId === id && newTemplates.length > 0) setActiveTemplateId(newTemplates[0].id);
    };

    const triggerProjectWideCitationSync = (project: ResearchProject, nextTables: ProjectTable[]) => {
        const projectRes = (resources || []).filter((r: Literature) => r && r.projectId === selectedProjectId);
        const newCitedIds = new Set<string>();
        const fullText = (project.paperSections || []).map((s: PaperSection) => s.content || '').join(' ');
        let augmentedText = fullText;
        const tableMatches = fullText.matchAll(/\[Table:\s*([\w\d_-]+)(?::Full)?\s*\]/gi);
        for (const match of Array.from(tableMatches)) {
            const tableId = match[1];
            const tableData = nextTables.find((t: ProjectTable) => t.id === tableId);
            if (tableData) augmentedText += ` ${tableData.title} ${tableData.headers.join(' ')} ${tableData.rows.flat().join(' ')} ${tableData.note || ''}`;
        }

        // 先扫描所有引用标签，再逐标签精确匹配唯一文献
        const citeMatches = augmentedText.matchAll(CITE_REGEX);
        for (const cm of citeMatches) {
            const raw = cm[0];
            let found: Literature | undefined;

            if (raw.startsWith('[')) {
                // 专利匹配
                const inner = raw.slice(1, -1).toLowerCase();
                found = projectRes.find(r =>
                    r.type === '专利' &&
                    (inner.includes(r.title.toLowerCase()) || (r.source && inner.includes(r.source.toLowerCase())))
                );
            } else {
                // 学术引文匹配 (Author et al., 2024)
                const m = raw.match(/\((.+?)(?:(?:\s+et\s+al\.?|等))?,?\s*(\d{4})\)/i);
                if (m) {
                    const name = m[1].trim().toLowerCase();
                    const year = parseInt(m[2]);
                    const getAuthorSurname = (a: string) => {
                        const t = a.trim();
                        if (t.includes(',')) return t.split(',')[0].trim().toLowerCase();
                        if (/^[\u4e00-\u9fff]+$/.test(t)) return t.toLowerCase();
                        return (t.split(/\s+/)[0] || t).toLowerCase();
                    };
                    found = projectRes.find(r =>
                        r.year === year &&
                        r.authors?.some(a => {
                            const surname = getAuthorSurname(a);
                            return surname === name || a.toLowerCase().includes(name);
                        })
                    );
                }
            }

            if (found) newCitedIds.add(found.id);
        }
        return Array.from(newCitedIds);
    };

    const handleSaveTable = (table: ProjectTable) => {
        if (!selectedProject || !onUpdateProject) return;
        const currentTables = selectedProject.tables || [];
        const index = currentTables.findIndex((t: ProjectTable) => t.id === table.id);
        let nextTables = index !== -1 ? [...currentTables] : [table, ...currentTables];
        if (index !== -1) nextTables[index] = table;
        const nextCitedIds = triggerProjectWideCitationSync(selectedProject, nextTables);
        onUpdateProject({ ...selectedProject, tables: nextTables, citedLiteratureIds: nextCitedIds });
    };

    const handleDeleteTable = (id: string) => {
        if (!selectedProject || !onUpdateProject) return;
        const nextTables = (selectedProject.tables || []).filter((t: ProjectTable) => t.id !== id);
        const nextCitedIds = triggerProjectWideCitationSync(selectedProject, nextTables);
        onUpdateProject({ ...selectedProject, tables: nextTables, citedLiteratureIds: nextCitedIds });
    };

    const handleSaveSnippet = (snippet: ProjectLatexSnippet) => {
        if (!selectedProject || !onUpdateProject) return;
        const currentSnippets = selectedProject.latexSnippets || [];
        const index = currentSnippets.findIndex((s: ProjectLatexSnippet) => s.id === snippet.id);
        let nextSnippets = index !== -1 ? [...currentSnippets] : [snippet, ...currentSnippets];
        if (index !== -1) nextSnippets[index] = snippet;
        onUpdateProject({ ...selectedProject, latexSnippets: nextSnippets });
    };

    const handleDeleteSnippet = (id: string) => {
        if (!selectedProject || !onUpdateProject) return;
        const nextSnippets = (selectedProject.latexSnippets || []).filter((s: ProjectLatexSnippet) => s.id !== id);
        onUpdateProject({ ...selectedProject, latexSnippets: nextSnippets });
    };

    /**
     * handleFormatText - 增强探测版
     * 特别处理了 Markdown 中 pre 与 post 相同的情况（加粗和斜体）
     */
    const handleFormatText = (format: 'bold' | 'italic' | 'sub' | 'sup' | 'math' | 'h2' | 'h3') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        let start = textarea.selectionStart;
        let end = textarea.selectionEnd;

        textarea.focus();

        let fullText = editorContent;

        // --- 标题格式需要行级处理 ---
        if (format === 'h2' || format === 'h3') {
            const prefix = format === 'h2' ? '## ' : '### ';
            const otherPrefix = format === 'h2' ? '### ' : '## ';

            // 找到当前行的起始和结束位置
            const lineStart = fullText.lastIndexOf('\n', start - 1) + 1;
            const lineEnd = fullText.indexOf('\n', end);
            const actualLineEnd = lineEnd === -1 ? fullText.length : lineEnd;
            const lineContent = fullText.substring(lineStart, actualLineEnd);

            let newLineContent: string;
            let newCursorOffset: number;

            // 去掉行首可能的全角空格缩进，标题行不需要缩进
            const trimmedLine = lineContent.replace(/^[\u3000\s]+/, '');

            if (trimmedLine.startsWith(prefix)) {
                // 当前行已经有同级标题前缀 → 取消标题（去掉前缀）
                newLineContent = trimmedLine.slice(prefix.length);
                newCursorOffset = Math.max(0, start - lineStart - (lineContent.length - trimmedLine.length) - prefix.length);
            } else if (trimmedLine.startsWith(otherPrefix)) {
                // 当前行有另一级标题前缀 → 切换标题级别
                newLineContent = prefix + trimmedLine.slice(otherPrefix.length);
                newCursorOffset = Math.max(0, start - lineStart - (lineContent.length - trimmedLine.length) - otherPrefix.length + prefix.length);
            } else {
                // 当前行没有标题前缀 → 添加标题前缀
                newLineContent = prefix + trimmedLine;
                newCursorOffset = start - lineStart - (lineContent.length - trimmedLine.length) + prefix.length;
            }

            fullText = fullText.substring(0, lineStart) + newLineContent + fullText.substring(actualLineEnd);

            const newPos = lineStart + Math.max(0, Math.min(newCursorOffset, newLineContent.length));

            setEditorContent(fullText);
            setSyncedContent(fullText);
            saveDraft(fullText, activeSectionId);

            if (setCursorPosition) setCursorPosition(newPos);

            requestAnimationFrame(() => {
                textarea.focus();
                textarea.setSelectionRange(newPos, newPos);
            });
            return;
        }

        // --- 以下为行内格式处理逻辑（bold, italic, sub, sup, math）---
        let selection = fullText.substring(start, end);

        const tags: Record<string, { pre: string; post: string }> = {
            bold: { pre: '**', post: '**' },
            italic: { pre: '*', post: '*' },
            sub: { pre: '$_{', post: '}$' },
            sup: { pre: '$^{', post: '}$' },
            math: { pre: '$', post: '$' },
        };

        const { pre, post } = tags[format];

        // --- 精准环境探测逻辑 ---
        const findEnvelopingRange = (text: string, pos: number, preStr: string, postStr: string) => {
            if (!postStr) return null;

            // 如果起始和结束标签相同（如 **），则需要特殊处理以避免找错
            const isSymmetric = preStr === postStr;

            // 查找起始标签：必须在光标左侧
            const preIdx = text.lastIndexOf(preStr, isSymmetric ? pos - preStr.length : pos);
            if (preIdx === -1) return null;

            // 查找结束标签：必须在光标右侧
            const postIdx = text.indexOf(postStr, pos);
            if (postIdx === -1) return null;

            // 验证同一行且光标确实在两者之间
            const inner = text.substring(preIdx + preStr.length, postIdx);
            if (inner.includes('\n')) return null;

            return { start: preIdx, end: postIdx + postStr.length, content: inner };
        };

        let resultText = '';
        let newStart = start;
        let newEnd = end;

        const isInternalWrapped = selection.startsWith(pre) && (post ? selection.endsWith(post) : true);
        const enveloped = findEnvelopingRange(fullText, start, pre, post);

        if (isInternalWrapped && selection.length >= pre.length + (post?.length || 0)) {
            // 情况 A: 选区脱壳
            resultText = post ? selection.slice(pre.length, -post.length) : selection.slice(pre.length);
            fullText = fullText.substring(0, start) + resultText + fullText.substring(end);
            newStart = start;
            newEnd = start + resultText.length;
        } else if (enveloped) {
            // 情况 B: 环境脱壳（光标在 **** 内部点击再次取消）
            resultText = enveloped.content;
            fullText = fullText.substring(0, enveloped.start) + resultText + fullText.substring(enveloped.end);
            newStart = enveloped.start;
            newEnd = newStart + resultText.length;
        } else if (selection.length === 0) {
            // 情况 C: 智能占位逻辑 (初次点击创建)
            resultText = `${pre}${post}`;
            fullText = fullText.substring(0, start) + resultText + fullText.substring(end);
            newStart = start + pre.length;
            newEnd = newStart;
        } else {
            // 情况 D: 常规包装逻辑
            resultText = `${pre}${selection}${post}`;
            fullText = fullText.substring(0, start) + resultText + fullText.substring(end);
            newStart = start;
            newEnd = start + resultText.length;
        }

        setEditorContent(fullText);
        setSyncedContent(fullText);
        saveDraft(fullText, activeSectionId);

        if (setCursorPosition) setCursorPosition(newEnd);

        requestAnimationFrame(() => {
            textarea.focus();
            textarea.setSelectionRange(newStart, newEnd);
        });
    };

    const handleSynthesizeResults = async () => {
        if (!selectedProject) return;
        const logsToCompare = selectedProject.milestones.flatMap((m: Milestone) => m.logs).filter((l: ExperimentLog) => selectedLogIds.has(l.id));
        if (logsToCompare.length < 2) return;
        setIsProcessing(true);
        try {
            const result = await generateComparativeResults(logsToCompare, language);
            if (result) handleInsertText(`### 实验结果对比与讨论\n${result}`);
        } catch (e) {
            showToast({ message: '生成失败，请检查模型支持度或重试', type: 'error' });
        } finally { setIsProcessing(false); }
    };

    const handleGeneratePlanActual = async () => {
        if (!selectedProject) return;
        setIsProcessing(true);
        try {
            const result = await generatePlanVsActualTable(selectedProject.title, selectedProject.milestones.flatMap((m: Milestone) => m.logs), language);
            if (result) handleInsertText(`### 进度对比与偏差分析\n${result}`);
        } catch (e) {
            showToast({ message: '生成进度对比失败，服务可能受限', type: 'error' });
        } finally { setIsProcessing(false); }
    };

    const handleFlowchartToEmbodiment = async () => {
        if (!selectedProject || !selectedProject.proposals) return;
        const mainProposal = selectedProject.proposals.find((p: TransformationProposal) => p.status === 'main');
        if (!mainProposal) return;
        setIsProcessing(true);
        try {
            const result = await convertFlowchartToEmbodiment(mainProposal.newFlowchart, language);
            if (result) handleInsertText(`### 具体实施方式\n${result}`);
        } catch (e) {
            showToast({ message: '生成实施方式失败', type: 'error' });
        } finally { setIsProcessing(false); }
    };

    const handleRenameMedia = (logId: string, fileIndex: number, newName: string) => {
        if (!selectedProject || !onUpdateProject) return;
        const updated = JSON.parse(JSON.stringify(selectedProject));
        if (logId === 'PROJECT_LEVEL') { updated.media[fileIndex].name = newName; }
        else { const log = updated.milestones.flatMap((m: Milestone) => m.logs).find((l: ExperimentLog) => l.id === logId); if (log) log.files[fileIndex].name = newName; }
        onUpdateProject(updated);
    };

    const handleExportPackage = () => { showToast({ message: '正在构建 LaTeX 项目包...', type: 'info' }); };

    const handleAddTemplate = (tpl: any) => { state.setTemplates((prev: any[]) => [tpl, ...prev]); state.setActiveTemplateId(tpl.id); };

    const handleDeleteSnapshot = (id: string) => { if (!selectedProject || !onUpdateProject) return; const updated = (selectedProject.writingSnapshots || []).filter((s: any) => s.id !== id); onUpdateProject({ ...selectedProject, writingSnapshots: updated }); };

    const handleRemoveCitation = (res: Literature) => {
        const tag = getCitationTag(res).trim();
        const newText = editorContent.replace(tag, '');
        setEditorContent(newText);
        setSyncedContent(newText);
        saveDraft(newText, activeSectionId);
    };

    const handleDeleteMedia = (logId: string, fileIndex: number) => {
        if (!selectedProject || !onUpdateProject) return;
        const updated = JSON.parse(JSON.stringify(selectedProject));
        if (logId === 'PROJECT_LEVEL') { updated.media.splice(fileIndex, 1); }
        else { const log = updated.milestones.flatMap((m: Milestone) => m.logs).find((l: ExperimentLog) => l.id === logId); if (log) log.files.splice(fileIndex, 1); }
        onUpdateProject(updated);
    };

    const handleFindQuote = (quote: string) => { const textarea = textareaRef.current; if (!textarea) return; const index = editorContent.indexOf(quote); if (index !== -1) { textarea.focus(); textarea.setSelectionRange(index, index + quote.length); } };

    const handleRestoreSnapshot = (snap: WritingSnapshot) => {
        if (!selectedProject || !onUpdateProject) return;
        onUpdateProject({ ...selectedProject, paperSections: JSON.parse(JSON.stringify(snap.paperSections)), citedLiteratureIds: [...(selectedProject.citedLiteratureIds || [])], manuscriptMeta: JSON.parse(JSON.stringify(snap.manuscriptMeta)) });
        const content = snap.paperSections.find((s: any) => s.id === activeSectionId)?.content || '';
        setEditorContent(content);
        setSyncedContent(content);
    };

    const handleSectionSwitch = (id: string) => { saveDraft(editorContent, activeSectionId); state.setActiveSectionId(id); };

    const handleEditorSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
        const textarea = e.currentTarget;
        const { selectionStart, value } = textarea;
        cursorPositionRef.current = { start: textarea.selectionStart, end: textarea.selectionEnd };

        const atomicPatterns = [
            /\[(FigRef|Fig|Table|Math|Log):\s*[\w\d_-]+(?::Full)?\s*\]/gi,
            /\([^)]+?et\s+al\.?,\s*\d{4}\)/gi,
            /\[[^\]]+?,\s*[^\]]+?\]/gi
        ];

        for (const regex of atomicPatterns) {
            let match;
            regex.lastIndex = 0;
            while ((match = regex.exec(value)) !== null) {
                const start = match.index;
                const end = start + match[0].length;
                if (selectionStart > start && selectionStart < end) {
                    textarea.setSelectionRange(start, end);
                    return;
                }
            }
        }
    };

    const handleAddSection = (newSections: PaperSection[]) => { if (!selectedProject || !onUpdateProject) return; onUpdateProject({ ...selectedProject, paperSections: newSections }); };

    const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const textarea = e.currentTarget;
        const { selectionStart, selectionEnd, value } = textarea;

        if (e.key === 'Backspace' || e.key === 'Delete') {
            if (selectionStart === selectionEnd) {
                const atomicPatterns = [
                    /\[(FigRef|Fig|Table|Math|Log):\s*[\w\d_-]+(?::Full)?\s*\]/gi,
                    /\([^)]+?et\s+al\.?,\s*\d{4}\)/gi,
                    /\[[^\]]+?,\s*[^\]]+?\]/gi
                ];
                const searchPos = e.key === 'Backspace' ? selectionStart - 1 : selectionStart;
                if (searchPos >= 0 && searchPos < value.length) {
                    for (const regex of atomicPatterns) {
                        let match;
                        regex.lastIndex = 0;
                        while ((match = regex.exec(value)) !== null) {
                            const start = match.index;
                            const end = start + match[0].length;
                            if (searchPos >= start && searchPos < end) {
                                e.preventDefault();
                                textarea.setSelectionRange(start, end);
                                return;
                            }
                        }
                    }
                }
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            // 换行后自动插入两个全角空格作为段首缩进
            const indent = '\u3000\u3000';
            const newVal = value.substring(0, start) + '\n' + indent + value.substring(end);
            setEditorContent(newVal);
            setSyncedContent(newVal);
            saveDraft(newVal, activeSectionId);
            recordHistory(newVal);
            const newPos = start + 1 + indent.length;
            if (setCursorPosition) setCursorPosition(newPos);
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(newPos, newPos);
            }, 0);
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newVal = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
            setEditorContent(newVal);
            setTimeout(() => textarea.setSelectionRange(start + 4, start + 4), 0);
        }
    };

    const handleReplaceMediaImage = async (logId: string, fileIndex: number, newFile: File) => {
        if (!selectedProject || !onUpdateProject) return;
        const toBase64 = (f: File): Promise<string> => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(f);
        });
        try {
            const dataUrl = await toBase64(newFile);
            const updated = JSON.parse(JSON.stringify(selectedProject));
            if (logId === 'PROJECT_LEVEL') {
                // 只替换 url 和 name，保留 description、subFigures、refId 等全部元信息
                updated.media[fileIndex].url = dataUrl;
                updated.media[fileIndex].name = newFile.name;
                updated.media[fileIndex].lastModified = Date.now();
            } else {
                const log = updated.milestones.flatMap((m: Milestone) => m.logs).find((l: ExperimentLog) => l.id === logId);
                if (log) {
                    log.files[fileIndex].url = dataUrl;
                    log.files[fileIndex].name = newFile.name;
                    log.files[fileIndex].lastModified = Date.now();
                }
            }
            onUpdateProject(updated);
            showToast({ message: '图片已替换，所有元信息已保留', type: 'success' });
        } catch (e) {
            showToast({ message: '替换失败', type: 'error' });
        }
    };

    const handleManualSave = () => { saveDraft(editorContent, activeSectionId); showToast({ message: '已手动保存', type: 'success' }); };

    return {
        handlePolish, handleSmartWrite, handleRunSimulatedReview, handleRunMirrorAnalysis: state.handleRunMirrorAnalysis, handleApplySuggestion,
        handleExportWord, handleManualMediaUpload, handleCreateSnapshot, handleDeleteTemplate,
        handleFormatText, handleSaveTable, handleDeleteTable, handleSaveSnippet, handleDeleteSnippet,
        getCitationTag, handleSynthesizeResults, handleGeneratePlanActual, handleFlowchartToEmbodiment,
        handleRenameMedia, handleExportPackage, handleAddTemplate, handleDeleteSnapshot,
        handleFindCitation, handleRemoveCitation, handleDeleteMedia, handleFindQuote,
        handleRestoreSnapshot, handleSectionSwitch, handleEditorSelect, handleAddSection,
        handleEditorKeyDown, handleEditorDoubleClick, handleManualSave,
        handleFindToken, handleReplaceMediaImage
    };
};
