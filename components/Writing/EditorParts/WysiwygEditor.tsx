import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
// @ts-ignore: TS cannot resolve module exports for Tiptap react menus, but Vite handles it properly
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Image } from '@tiptap/extension-image';
import { SciFigureNode } from './extensions/SciFigureNode';
import { SciTableNode } from './extensions/SciTableNode';
import { SciMathNode } from './extensions/SciMathNode';
import { SciFigRefNode } from './extensions/SciFigRefNode';
import { FontSize } from './extensions/FontSize';
import { LineHeight } from './extensions/LineHeight';
import { TextIndent } from './extensions/TextIndent';
import { SearchReplace } from './extensions/SearchReplace';
import { plainTextToHtml, htmlToPlainText, RichContentContext } from '../../../hooks/wysiwygSync';
import { ResearchProject } from '../../../types';
import { useTranslation } from '../../../locales/useTranslation';
import type { DocxFileState } from '../../../hooks/useDocxMode';
import './wysiwyg-editor.css';

interface WysiwygEditorProps {
  editorContent: string;
  onEditorChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  activeSectionId: string;
  projectMedia?: any[];
  project?: ResearchProject;
  figLabel?: string;
  figSep?: string;
  tableLabel?: string;
  onTableDblClick?: (tableId: string) => void;
  onMathDblClick?: (snippetId: string) => void;
  onFigureDblClick?: (refId: string) => void;
  // ─── Word 文件操作 ───
  onOpenDocx?: () => void;
  onSaveDocx?: () => void;
  onSaveDocxAs?: () => void;
  onCloseDocx?: () => void;
  docxFileState?: DocxFileState;
}

// ─── A4 页面常量 ───
const PAGE_HEIGHT_MM = 297;
const PAGE_PADDING_MM = 18;
const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - PAGE_PADDING_MM * 2;
const MM_TO_PX = 96 / 25.4;
const CONTENT_HEIGHT_PX = Math.round(CONTENT_HEIGHT_MM * MM_TO_PX);

export interface WysiwygEditorRef {
  insertText: (text: string) => void;
}

const WysiwygEditor = React.forwardRef<WysiwygEditorRef, WysiwygEditorProps>(({
  editorContent,
  onEditorChange,
  activeSectionId,
  projectMedia,
  project,
  figLabel = 'Figure',
  figSep = '.',
  tableLabel = 'Table',
  onTableDblClick,
  onMathDblClick,
  onFigureDblClick,
  onOpenDocx,
  onSaveDocx,
  onSaveDocxAs,
  onCloseDocx,
  docxFileState,
}, ref) => {
  const { t } = useTranslation();
  const isInternalUpdate = useRef(false);
  const lastPlainText = useRef(editorContent);
  const [zoom, setZoom] = useState(100);
  const [pageCount, setPageCount] = useState(1);
  const [charCount, setCharCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [paraCount, setParaCount] = useState(0);
  const [cnCharCount, setCnCharCount] = useState(0);
  const [showStats, setShowStats] = useState(false);
  // ─── 查找替换 ───
  const [showSearch, setShowSearch] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [searchTerm, setSearchTermState] = useState('');
  const [replaceTerm, setReplaceTermState] = useState('');
  const [caseSensitive, setCaseSensitiveState] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // ─── 格式刷 ───
  const [formatPainterActive, setFormatPainterActive] = useState(false);
  const copiedMarks = useRef<Record<string, any>[]>([]);
  // ─── 目录导航 ───
  const [showOutline, setShowOutline] = useState(false);
  // ─── 页眉 ───
  const [headerText, setHeaderText] = useState('');
  // ─── 右键菜单 ───
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });
  // ─── 聚焦模式 ───
  const [focusMode, setFocusMode] = useState(false);
  // ─── 自动保存状态 ───
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ─── 水印 ───
  const [watermark, setWatermark] = useState<string>('');
  // ─── 行号显示 ───
  const [showLineNumbers, setShowLineNumbers] = useState(false);
  // ─── 样式面板 ───
  const [showStylePanel, setShowStylePanel] = useState(false);
  // ─── 页面设置 ───
  const [showPageSetup, setShowPageSetup] = useState(false);
  const [pageMargin, setPageMargin] = useState(18); // mm
  const [pageOrientation, setPageOrientation] = useState<'portrait' | 'landscape'>('portrait');
  // ─── 快捷键速查 ───
  const [showShortcutsPanel, setShowShortcutsPanel] = useState(false);
  // ─── 更多工具 ───
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [moreToolsPos, setMoreToolsPos] = useState({ top: 0, left: 0 });
  const moreToolsBtnRef = useRef<HTMLButtonElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // 用 ref 存回调，让 editorProps 能稳定引用
  const onTableDblClickRef = useRef(onTableDblClick);
  onTableDblClickRef.current = onTableDblClick;
  const onMathDblClickRef = useRef(onMathDblClick);
  onMathDblClickRef.current = onMathDblClick;
  const onFigureDblClickRef = useRef(onFigureDblClick);
  onFigureDblClickRef.current = onFigureDblClick;
  const projectRef = useRef(project);
  projectRef.current = project;

  // 强制全局捕获双击事件（解决 ProseMirror 拦截了双击导致无法触发编辑的问题）
  useEffect(() => {
    const handleCaptureDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 仅处理 word-workspace 内部的点击
      if (!target.closest('.word-workspace')) return;

      // 表格：查找 data-table-id
      const tableEl = target.closest('[data-table-id]') as HTMLElement | null;
      if (tableEl) {
        const tId = tableEl.getAttribute('data-table-id') || '';
        if (tId && onTableDblClickRef.current) {
          onTableDblClickRef.current(tId);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // 公式：查找 data-snippet-id
      const mathEl = target.closest('[data-snippet-id]') as HTMLElement | null;
      if (mathEl) {
        const sId = mathEl.getAttribute('data-snippet-id') || '';
        if (sId && onMathDblClickRef.current) {
          onMathDblClickRef.current(sId);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // 图片：查找 data-ref-id
      const figEl = target.closest('[data-ref-id]') as HTMLElement | null;
      if (figEl) {
        const rId = figEl.getAttribute('data-ref-id') || '';
        if (rId && onFigureDblClickRef.current) {
          onFigureDblClickRef.current(rId);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    };

    // 必须使用 capture: true 在捕获阶段拦截，早于任何 React 或 ProseMirror 合成事件
    document.addEventListener('dblclick', handleCaptureDblClick, { capture: true });
    return () => {
      document.removeEventListener('dblclick', handleCaptureDblClick, { capture: true });
    };
  }, []);

  // 构建富内容上下文
  const richCtx: RichContentContext = useMemo(() => {
    // 构建图号映射
    const figRefMap = new Map<string, number>();
    let figSeq = 0;
    const foundIds = new Set<string>();
    project?.paperSections?.forEach(section => {
      const content = section.content || '';
      const matches = content.matchAll(/\[Fig:\s*([\w\d_-]+)(?::Full)?\s*\]/gi);
      for (const match of matches) {
        const id = match[1];
        if (!foundIds.has(id)) {
          foundIds.add(id);
          figRefMap.set(id, ++figSeq);
        }
      }
    });

    return {
      projectMedia,
      project,
      figRefMap,
      figLabel,
      figSep,
      tableLabel,
    };
  }, [projectMedia, project, figLabel, figSep, tableLabel]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        code: false,
        blockquote: false,
        // 启用列表和水平线
        horizontalRule: {},
        listItem: {},
        bulletList: {},
        orderedList: {},
        strike: {},
      }),
      Subscript,
      Superscript,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({ inline: true, allowBase64: true }),
      FontSize,
      LineHeight,
      TextIndent,
      SearchReplace,
      SciFigureNode,
      SciTableNode,
      SciMathNode,
      SciFigRefNode,
    ],
    content: plainTextToHtml(editorContent, richCtx),
    editorProps: {
      attributes: {
        class: 'tiptap',
        'data-placeholder': t('writing.contentArea.editorPlaceholder'),
        spellcheck: 'true',
      },
      handleKeyDown: (_view, event) => {
        const isMod = event.metaKey || event.ctrlKey;
        if (!isMod) return false;

        // ⌘/ → 快捷键速查
        if (event.key === '/') {
          event.preventDefault();
          setShowShortcutsPanel(v => !v);
          return true;
        }
        // Cmd+F → 查找
        if (event.key === 'f' && !event.shiftKey) {
          event.preventDefault();
          setShowSearch(true);
          setShowReplace(false);
          setTimeout(() => searchInputRef.current?.focus(), 50);
          return true;
        }
        // Cmd+H → 查找替换
        if (event.key === 'h') {
          event.preventDefault();
          setShowSearch(true);
          setShowReplace(true);
          setTimeout(() => searchInputRef.current?.focus(), 50);
          return true;
        }
        // Cmd+E → 居中对齐
        if (event.key === 'e' && !event.shiftKey) {
          event.preventDefault();
          return false; // 让 TextAlign 扩展处理
        }
        // Cmd+Shift+X → 删除线
        if (event.key === 'x' && event.shiftKey) {
          event.preventDefault();
          return false; // 让 Strike 扩展处理
        }
        return false;
      },
      handleDOMEvents: {
        contextmenu: (view, event) => {
          event.preventDefault();
          const rect = view.dom.getBoundingClientRect();
          setContextMenu({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            show: true,
          });
          return true;
        },
        drop: (view, event) => {
          const dt = event.dataTransfer;
          if (!dt || !dt.files.length) return false;
          const file = dt.files[0];
          if (!file.type.startsWith('image/')) return false;
          event.preventDefault();
          const reader = new FileReader();
          reader.onload = () => {
            const src = reader.result as string;
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (pos) {
              view.dispatch(
                view.state.tr.insert(
                  pos.pos,
                  view.state.schema.nodes.image.create({ src })
                )
              );
            }
          };
          reader.readAsDataURL(file);
          return true;
        },
        paste: (view, event) => {
          const items = event.clipboardData?.items;
          if (!items) return false;
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.startsWith('image/')) {
              event.preventDefault();
              const file = item.getAsFile();
              if (!file) continue;
              const reader = new FileReader();
              reader.onload = () => {
                const src = reader.result as string;
                const { from } = view.state.selection;
                view.dispatch(
                  view.state.tr.insert(
                    from,
                    view.state.schema.nodes.image.create({ src })
                  )
                );
              };
              reader.readAsDataURL(file);
              return true;
            }
          }
          return false;
        },
      },
    },
    onUpdate: ({ editor: ed }) => {
      isInternalUpdate.current = true;
      const html = ed.getHTML();
      const plainText = htmlToPlainText(html);
      lastPlainText.current = plainText;

      // 增强字数统计
      setCharCount(plainText.length);
      // 中文字符数
      const cnChars = (plainText.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
      setCnCharCount(cnChars);
      // 英文词数（连续字母序列作为一个词）
      const enWords = (plainText.match(/[a-zA-Z]+/g) || []).length;
      setWordCount(enWords);
      // 段落数
      const paragraphs = plainText.split(/\n/).filter(l => l.trim().length > 0).length;
      setParaCount(paragraphs);

      onEditorChange({
        target: {
          value: plainText,
          selectionStart: 0,
          selectionEnd: 0
        }
      } as any);

      // 自动保存指示器
      setSaveStatus('saving');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveStatus('saved'), 1200);

      requestAnimationFrame(() => {
        isInternalUpdate.current = false;
        updatePageCount();
      });
    },
  });

  React.useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      if (editor) {
        editor.chain().focus().insertContent(text).run();
      }
    },
    /** 替换编辑器全部内容为 HTML（用于导入 .docx） */
    insertHtml: (html: string) => {
      if (editor) {
        editor.commands.setContent(html, { emitUpdate: true });
      }
    },
    /** 获取 TipTap editor 实例（用于导出时读取 HTML） */
    getEditor: () => editor,
  }), [editor]);

  const updatePageCount = useCallback(() => {
    if (!editorContainerRef.current) return;
    const tiptapEl = editorContainerRef.current.querySelector('.tiptap') as HTMLElement | null;
    if (!tiptapEl) return;

    // 1) 先清除之前的分页推移 margin
    const adjusted = tiptapEl.querySelectorAll<HTMLElement>('[data-page-pushed]');
    adjusted.forEach(el => {
      el.style.marginTop = '';
      el.removeAttribute('data-page-pushed');
    });

    // 2) 获取内容区相对偏移
    const tiptapRect = tiptapEl.getBoundingClientRect();
    const paddingTopPx = PAGE_PADDING_MM * MM_TO_PX;
    const pageContentH = CONTENT_HEIGHT_PX; // 每页可用内容高度

    // 3) 检测并推移跨页的图片和表格
    const blockElements = tiptapEl.querySelectorAll<HTMLElement>('img, table, .tableWrapper, figure');
    blockElements.forEach(el => {
      const elRect = el.getBoundingClientRect();
      const elTop = elRect.top - tiptapRect.top; // 相对于 tiptap 顶部
      const elBottom = elTop + elRect.height;

      // 计算元素起始页和结束页
      const startPage = Math.floor(elTop / (CONTENT_HEIGHT_PX + paddingTopPx * 2));
      const endPage = Math.floor((elBottom - 1) / (CONTENT_HEIGHT_PX + paddingTopPx * 2));

      // 如果跨页了，且元素高度小于一页（不然推也没用）
      if (startPage !== endPage && elRect.height < pageContentH) {
        const nextPageTop = (startPage + 1) * (CONTENT_HEIGHT_PX + paddingTopPx * 2);
        const pushDown = nextPageTop - elTop + 8; // +8px 留点间距
        el.style.marginTop = `${pushDown}px`;
        el.setAttribute('data-page-pushed', 'true');
      }
    });

    // 4) 重新计算页数
    const contentHeight = tiptapEl.scrollHeight;
    const paddingPx = PAGE_PADDING_MM * MM_TO_PX * 2;
    const effectiveHeight = Math.max(contentHeight - paddingPx, 0);
    const pages = Math.max(1, Math.ceil(effectiveHeight / CONTENT_HEIGHT_PX));
    setPageCount(pages);
  }, []);

  useEffect(() => {
    updatePageCount();
    const observer = new ResizeObserver(() => updatePageCount());
    const tiptapEl = editorContainerRef.current?.querySelector('.tiptap');
    if (tiptapEl) observer.observe(tiptapEl);
    return () => observer.disconnect();
  }, [updatePageCount]);

  // 外部纯文本变化时更新编辑器
  useEffect(() => {
    if (!editor || isInternalUpdate.current) return;
    if (editorContent !== lastPlainText.current) {
      lastPlainText.current = editorContent;
      setCharCount(editorContent.length);
      const html = plainTextToHtml(editorContent, richCtx);
      editor.commands.setContent(html, { emitUpdate: false });
      requestAnimationFrame(updatePageCount);
    }
  }, [editorContent, editor, updatePageCount, richCtx]);

  // 切换章节时重新加载
  useEffect(() => {
    if (!editor) return;
    lastPlainText.current = editorContent;
    setCharCount(editorContent.length);
    const html = plainTextToHtml(editorContent, richCtx);
    editor.commands.setContent(html, { emitUpdate: false });
    requestAnimationFrame(updatePageCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionId, editor, richCtx]);

  const handleZoom = useCallback((delta: number) => {
    setZoom(prev => Math.min(200, Math.max(50, prev + delta)));
  }, []);

  // ─── 查找替换操作回调 ───
  const handleSearchTermChange = useCallback((value: string) => {
    setSearchTermState(value);
    editor?.commands.setSearchTerm(value);
  }, [editor]);

  const handleReplaceTermChange = useCallback((value: string) => {
    setReplaceTermState(value);
    editor?.commands.setReplaceTerm(value);
  }, [editor]);

  const handleToggleCaseSensitive = useCallback(() => {
    const next = !caseSensitive;
    setCaseSensitiveState(next);
    editor?.commands.setCaseSensitive(next);
  }, [editor, caseSensitive]);

  const handleCloseSearch = useCallback(() => {
    setShowSearch(false);
    setShowReplace(false);
    editor?.commands.clearSearch();
  }, [editor]);

  // ─── 格式刷逻辑 ───
  const handleCopyFormat = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) return; // 没有选中文本
    const marks: Record<string, any>[] = [];
    editor.state.doc.nodesBetween(from, to, (node) => {
      if (node.isText && node.marks.length > 0) {
        node.marks.forEach(m => {
          marks.push({ type: m.type.name, attrs: m.attrs });
        });
      }
    });
    copiedMarks.current = marks;
    setFormatPainterActive(true);
  }, [editor]);

  const handlePasteFormat = useCallback(() => {
    if (!editor || copiedMarks.current.length === 0) return;
    const { from, to } = editor.state.selection;
    if (from === to) {
      setFormatPainterActive(false);
      return;
    }
    // 先清除目标区域的所有 marks
    editor.chain().focus().unsetAllMarks().run();
    // 再应用 copiedMarks
    copiedMarks.current.forEach(({ type, attrs }) => {
      try {
        const markType = editor.schema.marks[type];
        if (markType) {
          editor.chain().focus().setTextSelection({ from, to })
            .command(({ tr }) => {
              tr.addMark(from, to, markType.create(attrs));
              return true;
            }).run();
        }
      } catch { /* skip unknown marks */ }
    });
    setFormatPainterActive(false);
  }, [editor]);

  // 格式刷模式下，点击时自动应用格式
  useEffect(() => {
    if (!editor || !formatPainterActive) return;
    const handleClick = () => {
      // 延迟执行让选区更新
      setTimeout(() => handlePasteFormat(), 50);
    };
    const dom = editor.view.dom;
    dom.addEventListener('mouseup', handleClick);
    return () => dom.removeEventListener('mouseup', handleClick);
  }, [editor, formatPainterActive, handlePasteFormat]);

  // ─── 目录（headings）提取 ───
  const headings = useMemo(() => {
    if (!editor) return [];
    const items: { level: number; text: string; pos: number }[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading') {
        items.push({
          level: node.attrs.level as number,
          text: node.textContent || '(空标题)',
          pos,
        });
      }
    });
    return items;
  }, [editor, editorContent]); // editorContent 变化时重新计算

  const handleJumpToHeading = useCallback((pos: number) => {
    if (!editor) return;
    editor.commands.setTextSelection(pos);
    editor.commands.scrollIntoView();
    const domAtPos = editor.view.domAtPos(pos);
    const element = domAtPos.node instanceof HTMLElement
      ? domAtPos.node
      : domAtPos.node.parentElement;
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [editor]);

  const searchResultCount = ((editor?.storage as any)?.searchReplace?.results?.length || 0) as number;
  const searchActiveIndex = ((editor?.storage as any)?.searchReplace?.activeIndex ?? 0) as number;

  if (!editor) return null;

  const pageHeightPx = PAGE_HEIGHT_MM * MM_TO_PX;
  const totalHeightPx = pageHeightPx * pageCount;

  return (
    <div className={`word-workspace ${focusMode ? 'focus-mode' : ''}`} ref={workspaceRef}>
      {/* ─── 查找替换浮动面板 ─── */}
      {showSearch && (
        <div className="word-search-panel">
          <div className="search-panel-row">
            <div className="search-input-wrapper">
              <i className="fa-solid fa-magnifying-glass search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                className="search-input"
                placeholder="查找..."
                value={searchTerm}
                onChange={(e) => handleSearchTermChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    editor.commands.goToNextMatch();
                  }
                  if (e.key === 'Escape') handleCloseSearch();
                }}
                autoFocus
              />
              <span className="search-count">
                {searchResultCount > 0 ? `${searchActiveIndex + 1}/${searchResultCount}` : '无匹配'}
              </span>
            </div>
            <button onClick={() => editor.commands.goToPrevMatch()} className="search-nav-btn" title="上一个 (Shift+Enter)">
              <i className="fa-solid fa-chevron-up" />
            </button>
            <button onClick={() => editor.commands.goToNextMatch()} className="search-nav-btn" title="下一个 (Enter)">
              <i className="fa-solid fa-chevron-down" />
            </button>
            <button
              onClick={handleToggleCaseSensitive}
              className={`search-nav-btn ${caseSensitive ? 'is-active' : ''}`}
              title="区分大小写"
            >
              <span style={{ fontSize: 10, fontWeight: 700 }}>Aa</span>
            </button>
            <button onClick={() => setShowReplace(v => !v)} className={`search-nav-btn ${showReplace ? 'is-active' : ''}`} title="显示替换">
              <i className="fa-solid fa-arrow-right-arrow-left" style={{ fontSize: 11 }} />
            </button>
            <button onClick={handleCloseSearch} className="search-nav-btn search-close-btn" title="关闭 (Esc)">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          {showReplace && (
            <div className="search-panel-row">
              <div className="search-input-wrapper">
                <i className="fa-solid fa-right-left search-icon" style={{ fontSize: 10 }} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="替换为..."
                  value={replaceTerm}
                  onChange={(e) => handleReplaceTermChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      editor.commands.replaceCurrentMatch();
                    }
                    if (e.key === 'Escape') handleCloseSearch();
                  }}
                />
              </div>
              <button onClick={() => editor.commands.replaceCurrentMatch()} className="search-action-btn" title="替换">
                替换
              </button>
              <button onClick={() => editor.commands.replaceAllMatches()} className="search-action-btn search-replace-all-btn" title="全部替换">
                全部
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Word 风格工具栏 ─── */}
      <div className="word-toolbar">
        {/* ─── Word 文件操作按钮组 ─── */}
        <div className="toolbar-group">
          <button onClick={onOpenDocx} title="打开 Word 文档" className="word-file-btn">
            <i className="fa-solid fa-folder-open" />
          </button>
          <button
            onClick={onSaveDocx}
            title={docxFileState?.filePath ? '保存' : '保存为 Word'}
            disabled={docxFileState?.isLoading}
            className="word-file-btn"
          >
            <i className={`fa-solid ${docxFileState?.isLoading ? 'fa-spinner animate-spin' : 'fa-floppy-disk'}`} />
          </button>
          <button onClick={onSaveDocxAs} title="另存为 Word" className="word-file-btn">
            <i className="fa-solid fa-file-export" />
          </button>
          {docxFileState?.fileName && (
            <button onClick={onCloseDocx} title="关闭文档" className="word-file-btn">
              <i className="fa-solid fa-xmark" />
            </button>
          )}
        </div>

        {/* 文件名指示 */}
        {docxFileState?.fileName && (
          <>
            <div className="toolbar-divider" />
            <div className="toolbar-group">
              <span className="word-file-indicator" title={docxFileState.filePath || undefined}>
                <i className="fa-solid fa-file-word" style={{ color: '#2b579a', marginRight: 4 }} />
                {docxFileState.fileName}
                {docxFileState.isDirty && <span className="word-dirty-dot" />}
              </span>
            </div>
          </>
        )}

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <select
            className="word-toolbar-select"
            value={editor.getAttributes('textStyle').fontFamily || ''}
            onChange={(e) => {
              if (e.target.value) editor.chain().focus().setFontFamily(e.target.value).run();
              else editor.chain().focus().unsetFontFamily().run();
            }}
            title="字体"
          >
            <option value="">默认字体</option>
            <option value="SimSun, STSong, serif">宋体</option>
            <option value="'Microsoft YaHei', 'PingFang SC', sans-serif">微软雅黑</option>
            <option value="'Times New Roman', serif">Times New Roman</option>
            <option value="Arial, sans-serif">Arial</option>
          </select>

          <select
            className="word-toolbar-select"
            value={editor.getAttributes('textStyle').fontSize || ''}
            onChange={(e) => {
              if (e.target.value) editor.chain().focus().setFontSize(e.target.value).run();
              else editor.chain().focus().unsetFontSize().run();
            }}
            title="字号"
          >
            <option value="">默认字号</option>
            <option value="10.5pt">五号</option>
            <option value="12pt">小四</option>
            <option value="14pt">四号</option>
            <option value="16pt">小三</option>
            <option value="18pt">三号</option>
            <option value="22pt">二号</option>
            <option value="24pt">小一</option>
          </select>

          <select
            className="word-toolbar-select"
            value={editor.getAttributes('paragraph').lineHeight || editor.getAttributes('heading').lineHeight || ''}
            onChange={(e) => {
              if (e.target.value) editor.chain().focus().setLineHeight(e.target.value).run();
              else editor.chain().focus().unsetLineHeight().run();
            }}
            title="行距"
          >
            <option value="">默认行距</option>
            <option value="1.0">1.0倍</option>
            <option value="1.25">1.25倍</option>
            <option value="1.5">1.5倍</option>
            <option value="2.0">2.0倍</option>
          </select>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''}
            title="左对齐"
          >
            <i className="fa-solid fa-align-left" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''}
            title="居中"
          >
            <i className="fa-solid fa-align-center" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={editor.isActive({ textAlign: 'right' }) ? 'is-active' : ''}
            title="右对齐"
          >
            <i className="fa-solid fa-align-right" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            className={editor.isActive({ textAlign: 'justify' }) ? 'is-active' : ''}
            title="两端对齐"
          >
            <i className="fa-solid fa-align-justify" />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button
            onClick={() => editor.chain().focus().setTextIndent('2em').run()}
            className={editor.isActive({ textIndent: '2em' }) ? 'is-active' : ''}
            title="首行缩进 2 字符"
          >
            <i className="fa-solid fa-indent" />
          </button>
          <button
            onClick={() => editor.chain().focus().unsetTextIndent().run()}
            title="取消缩进"
          >
            <i className="fa-solid fa-outdent" />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title={t('writing.formattingToolbar.undo')}
          >
            <i className="fa-solid fa-rotate-left" />
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title={t('writing.formattingToolbar.redo')}
          >
            <i className="fa-solid fa-rotate-right" />
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? 'is-active' : ''}
            title={t('writing.formattingToolbar.bold')}
          >
            <i className="fa-solid fa-bold" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive('italic') ? 'is-active' : ''}
            title={t('writing.formattingToolbar.italic')}
          >
            <i className="fa-solid fa-italic" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={editor.isActive('underline') ? 'is-active' : ''}
            title="下划线"
          >
            <i className="fa-solid fa-underline" />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* ─── 删除线 ─── */}
        <div className="toolbar-group">
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={editor.isActive('strike') ? 'is-active' : ''}
            title="删除线"
          >
            <i className="fa-solid fa-strikethrough" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            className={editor.isActive('subscript') ? 'is-active' : ''}
            title={t('writing.formattingToolbar.subscript')}
          >
            <i className="fa-solid fa-subscript" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            className={editor.isActive('superscript') ? 'is-active' : ''}
            title={t('writing.formattingToolbar.superscript')}
          >
            <i className="fa-solid fa-superscript" />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* ─── 字体颜色 & 高亮色 ─── */}
        <div className="toolbar-group">
          <div className="word-color-picker-wrapper">
            <button title="字体颜色" style={{ position: 'relative' }}>
              <i className="fa-solid fa-font" />
              <span className="word-color-underline" style={{ background: editor.getAttributes('textStyle').color || '#000' }} />
            </button>
            <input
              type="color"
              className="word-color-input"
              value={editor.getAttributes('textStyle').color || '#000000'}
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
              title="选择字体颜色"
            />
          </div>
          <div className="word-color-picker-wrapper">
            <button title="高亮色" style={{ position: 'relative' }}>
              <i className="fa-solid fa-highlighter" />
              <span className="word-color-underline" style={{ background: editor.getAttributes('highlight').color || '#fef08a' }} />
            </button>
            <input
              type="color"
              className="word-color-input"
              value={editor.getAttributes('highlight').color || '#fef08a'}
              onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
              title="选择高亮色"
            />
          </div>
        </div>

        <div className="toolbar-divider" />

        {/* ─── 列表 ─── */}
        <div className="toolbar-group">
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive('bulletList') ? 'is-active' : ''}
            title="无序列表"
          >
            <i className="fa-solid fa-list-ul" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive('orderedList') ? 'is-active' : ''}
            title="有序列表"
          >
            <i className="fa-solid fa-list-ol" />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* ─── 标题 & 水平线 ─── */}
        <div className="toolbar-group">
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
            title={t('writing.formattingToolbar.h2')}
          >
            <span style={{ fontSize: '10px', fontWeight: 900 }}>H2</span>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''}
            title={t('writing.formattingToolbar.h3')}
          >
            <span style={{ fontSize: '10px', fontWeight: 900 }}>H3</span>
          </button>
          <button
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="水平线"
          >
            <i className="fa-solid fa-minus" />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* ─── 表格 ─── */}
        <div className="toolbar-group">
          <button
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            title="插入表格 (3×3)"
          >
            <i className="fa-solid fa-table" />
          </button>
          {editor.isActive('table') && (
            <>
              <button onClick={() => editor.chain().focus().addColumnAfter().run()} title="右插列">
                <i className="fa-solid fa-table-columns" style={{ fontSize: 10 }} />
                <span style={{ fontSize: 8 }}>+</span>
              </button>
              <button onClick={() => editor.chain().focus().addRowAfter().run()} title="下插行">
                <i className="fa-solid fa-table-cells" style={{ fontSize: 10 }} />
                <span style={{ fontSize: 8 }}>+</span>
              </button>
              <button onClick={() => editor.chain().focus().deleteColumn().run()} title="删列">
                <i className="fa-solid fa-table-columns" style={{ fontSize: 10, opacity: 0.5 }} />
                <span style={{ fontSize: 8 }}>×</span>
              </button>
              <button onClick={() => editor.chain().focus().deleteRow().run()} title="删行">
                <i className="fa-solid fa-table-cells" style={{ fontSize: 10, opacity: 0.5 }} />
                <span style={{ fontSize: 8 }}>×</span>
              </button>
              <button onClick={() => editor.chain().focus().deleteTable().run()} title="删除表格">
                <i className="fa-solid fa-trash" style={{ fontSize: 10, color: '#ef4444' }} />
              </button>
            </>
          )}
        </div>

        <div className="toolbar-divider" />

        {/* ─── 图片 ─── */}
        <div className="toolbar-group">
          <button
            onClick={() => {
              const url = window.prompt('输入图片 URL:');
              if (url) editor.chain().focus().setImage({ src: url }).run();
            }}
            title="插入图片"
          >
            <i className="fa-solid fa-image" />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* ─── 查找替换 ─── */}
        <div className="toolbar-group">
          <button
            onClick={() => {
              setShowSearch(true);
              setShowReplace(false);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            className={showSearch ? 'is-active' : ''}
            title="查找 (⌘F)"
          >
            <i className="fa-solid fa-magnifying-glass" />
          </button>
          <button
            onClick={() => {
              setShowSearch(true);
              setShowReplace(true);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            className={showSearch && showReplace ? 'is-active' : ''}
            title="查找替换 (⌘H)"
          >
            <i className="fa-solid fa-arrow-right-arrow-left" />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* ─── 格式刷 ─── */}
        <div className="toolbar-group">
          <button
            onClick={handleCopyFormat}
            className={formatPainterActive ? 'is-active format-painter-active' : ''}
            title="格式刷：选中文本后点击复制格式，再选中目标文本自动应用"
          >
            <i className="fa-solid fa-paint-roller" />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* ─── 目录导航 ─── */}
        <div className="toolbar-group">
          <button
            onClick={() => setShowOutline(v => !v)}
            className={showOutline ? 'is-active' : ''}
            title="文档导航"
          >
            <i className="fa-solid fa-bars-staggered" />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* ─── 更多工具 ─── */}
        <div className="toolbar-group">
          <button
            ref={moreToolsBtnRef}
            onClick={() => {
              if (!showMoreTools && moreToolsBtnRef.current) {
                const rect = moreToolsBtnRef.current.getBoundingClientRect();
                setMoreToolsPos({
                  top: rect.bottom + 6,
                  left: Math.min(rect.left, window.innerWidth - 220),
                });
              }
              setShowMoreTools(v => !v);
            }}
            className={showMoreTools ? 'is-active' : ''}
            title="更多工具"
          >
            <i className="fa-solid fa-ellipsis" />
          </button>
        </div>

      </div>

      {/* ─── 更多工具下拉菜单（Portal 到 body 避免 overflow 裁剪） ─── */}
      {showMoreTools && createPortal(
        <div
          className="toolbar-more-dropdown"
          style={{
            top: moreToolsPos.top,
            left: moreToolsPos.left,
          }}
        >
          <div className="more-tools-grid">
            <button onClick={() => { setShowLineNumbers(v => !v); setShowMoreTools(false); }} className={showLineNumbers ? 'is-active' : ''} title="行号显示">
              <i className="fa-solid fa-list-ol" /><span>行号</span>
            </button>
            <button onClick={() => setFocusMode(v => !v)} className={focusMode ? 'is-active' : ''} title="聚焦模式">
              <i className="fa-solid fa-crosshairs" /><span>聚焦</span>
            </button>
            <button onClick={() => { setShowStylePanel(v => !v); setShowMoreTools(false); }} title="样式面板">
              <i className="fa-solid fa-palette" /><span>样式</span>
            </button>
            <button onClick={() => { setShowPageSetup(v => !v); setShowMoreTools(false); }} title="页面设置">
              <i className="fa-solid fa-file-invoice" /><span>页面</span>
            </button>
            <button onClick={() => { setShowShortcutsPanel(v => !v); setShowMoreTools(false); }} title="快捷键速查">
              <i className="fa-solid fa-keyboard" /><span>快捷键</span>
            </button>
            <button onClick={() => window.print()} title="打印">
              <i className="fa-solid fa-print" /><span>打印</span>
            </button>
          </div>
          <div className="more-tools-section">
            <select
              className="toolbar-select"
              title="段落间距"
              style={{ width: '100%' }}
              onChange={(e) => {
                const val = e.target.value;
                if (!editor) return;
                editor.chain().focus().command(({ tr, dispatch }) => {
                  if (!dispatch) return false;
                  const { from, to } = tr.selection;
                  tr.doc.nodesBetween(from, to, (node, pos) => {
                    if (node.type.name === 'paragraph' || node.type.name === 'heading') {
                      tr.setNodeMarkup(pos, undefined, { ...node.attrs, spacing: val });
                    }
                  });
                  return true;
                }).run();
              }}
              defaultValue=""
            >
              <option value="" disabled>↕ 段落间距</option>
              <option value="compact">紧凑</option>
              <option value="normal">标准</option>
              <option value="relaxed">宽松</option>
              <option value="double">双倍</option>
            </select>
          </div>
          <div className="more-tools-section">
            <select
              className="toolbar-select"
              value={watermark}
              onChange={(e) => setWatermark(e.target.value)}
              title="页面水印"
              style={{ width: '100%' }}
            >
              <option value="">水印:无</option>
              <option value="草稿">草稿</option>
              <option value="机密">机密</option>
              <option value="内部文件">内部文件</option>
              <option value="审阅用">审阅用</option>
              <option value="DRAFT">DRAFT</option>
              <option value="CONFIDENTIAL">CONFIDENTIAL</option>
            </select>
          </div>
        </div>,
        document.body
      )}

      {/* ─── 标尺 ─── */}
      <div className="word-ruler" style={{ alignSelf: 'center' }}>
        <div className="word-ruler-ticks">
          {Array.from({ length: 18 }).map((_, i) => {
            const pos = (i / 17) * 100;
            const isCm = i % 2 === 0;
            return (
              <React.Fragment key={i}>
                <div
                  className={`word-ruler-tick ${isCm ? 'major' : 'minor'}`}
                  style={{ left: `${pos}%` }}
                />
                {isCm && i > 0 && i < 17 && (
                  <span className="word-ruler-label" style={{ left: `${pos}%` }}>
                    {Math.round(i / 2)}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ─── 主内容区：可选的目录导航 + 页面滚动 ─── */}
      <div className="word-main-area">
        {/* ─── 目录导航面板 ─── */}
        {showOutline && (
          <div className="word-outline-panel">
            <div className="outline-panel-header">
              <i className="fa-solid fa-bars-staggered" style={{ fontSize: 11 }} />
              <span>文档导航</span>
              <button onClick={() => setShowOutline(false)} className="outline-close-btn">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="outline-panel-body">
              {headings.length === 0 ? (
                <div className="outline-empty">
                  <i className="fa-solid fa-heading" style={{ fontSize: 20, opacity: 0.3 }} />
                  <p>暂无标题</p>
                  <p style={{ fontSize: 10, color: '#9ca3af' }}>使用 H2/H3 创建标题后<br />将在此处显示导航</p>
                </div>
              ) : (
                headings.map((h, idx) => (
                  <button
                    key={idx}
                    className={`outline-item outline-h${h.level}`}
                    onClick={() => handleJumpToHeading(h.pos)}
                    title={h.text}
                  >
                    <span className="outline-level-badge">H{h.level}</span>
                    <span className="outline-item-text">{h.text}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ─── 页面滚动区域 ─── */}
        <div className="word-scroller">
          <div className="word-canvas">
            <div
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'center top',
                transition: 'transform 0.2s ease',
              }}
            >
              {/* 单一连续页面 */}
              <div
                className="word-page word-page-continuous"
                ref={editorContainerRef}
                style={{
                  width: pageOrientation === 'landscape' ? '297mm' : '210mm',
                  minWidth: pageOrientation === 'landscape' ? '297mm' : '210mm',
                  position: 'relative',
                }}
              >
                {/* ─── 水印（每页重复） ─── */}
                {watermark && Array.from({ length: pageCount }).map((_, i) => (
                  <div
                    key={`wm-${i}`}
                    className="word-watermark"
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: i * pageHeightPx,
                      left: 0,
                      width: '100%',
                      height: pageHeightPx,
                    }}
                  >
                    <span>{watermark}</span>
                  </div>
                ))}

                {/* ─── 第1页 页眉 ─── */}
                <div className="word-page-header">
                  <input
                    type="text"
                    className="page-header-input"
                    placeholder="点击编辑页眉..."
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                  />
                  <div className="page-header-line" />
                </div>

                {/* ─── 编辑器内容（连续流动） ─── */}
                <EditorContent
                  editor={editor}
                  className={showLineNumbers ? 'show-line-numbers' : ''}
                  style={{
                    minHeight: `${totalHeightPx}px`,
                    padding: `${pageMargin}mm`,
                  }}
                />

                {/* ─── 分页断点覆盖层 ─── */}
                {Array.from({ length: Math.max(0, pageCount - 1) }).map((_, i) => {
                  const breakY = (i + 1) * pageHeightPx;
                  return (
                    <div
                      key={`break-${i}`}
                      className="page-break-overlay"
                      style={{ top: breakY - 20 }}
                    >
                      {/* 前一页页脚 */}
                      <div className="page-break-footer">
                        <div className="page-footer-line" />
                        <span className="page-footer-number">— {i + 1} / {pageCount} —</span>
                      </div>
                      {/* 页间灰色间隔 */}
                      <div className="page-break-gap" />
                      {/* 下一页页眉 */}
                      <div className="page-break-header">
                        <span className="page-header-text">{headerText || ''}</span>
                        <div className="page-header-line" />
                      </div>
                    </div>
                  );
                })}

                {/* ─── 最后一页 页脚 ─── */}
                <div className="word-page-footer" style={{
                  position: 'absolute',
                  bottom: totalHeightPx > 0 ? `${totalHeightPx - (pageCount * pageHeightPx)}px` : '0',
                  left: 0,
                  right: 0,
                }}>
                  <div className="page-footer-line" />
                  <span className="page-footer-number">— {pageCount} / {pageCount} —</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Word 风格状态栏 ─── */}
      <div className="word-statusbar">
        <div className="status-group">
          <span className="status-item">
            <i className="fa-solid fa-file-lines" style={{ fontSize: '10px' }} />
            第 1 页，共 {pageCount} 页
          </span>
          <span
            className="status-item status-clickable"
            onClick={() => setShowStats(v => !v)}
            title="点击查看详细统计"
          >
            <i className="fa-solid fa-font" style={{ fontSize: '10px' }} />
            {cnCharCount} 汉字 · {wordCount} 词 · {paraCount} 段
          </span>
          <span className="status-item">
            <i className="fa-solid fa-language" style={{ fontSize: '10px' }} />
            中文 (中国)
          </span>
        </div>
        <div className="status-group">
          <span className={`status-save-indicator ${saveStatus}`}>
            {saveStatus === 'saved' && <><i className="fa-solid fa-cloud-check" style={{ fontSize: '10px' }} /> 已保存</>}
            {saveStatus === 'saving' && <><i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '10px' }} /> 保存中...</>}
            {saveStatus === 'unsaved' && <><i className="fa-solid fa-circle-exclamation" style={{ fontSize: '10px' }} /> 未保存</>}
          </span>
          <div className="zoom-control">
            <button onClick={() => handleZoom(-10)} title="缩小">
              <i className="fa-solid fa-minus" style={{ fontSize: '9px' }} />
            </button>
            <span style={{ minWidth: '36px', textAlign: 'center', fontSize: '11px' }}>{zoom}%</span>
            <button onClick={() => handleZoom(10)} title="放大">
              <i className="fa-solid fa-plus" style={{ fontSize: '9px' }} />
            </button>
          </div>
          <button
            onClick={() => setFocusMode(v => !v)}
            className={`status-focus-btn ${focusMode ? 'is-active' : ''}`}
            title="聚焦模式"
          >
            <i className="fa-solid fa-crosshairs" style={{ fontSize: '10px' }} />
          </button>
        </div>
      </div>

      {/* ─── 右键快捷菜单 ─── */}
      {contextMenu.show && (
        <>
          <div className="context-menu-backdrop" onClick={() => setContextMenu(v => ({ ...v, show: false }))} />
          <div
            className="word-context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button onClick={() => { document.execCommand('cut'); setContextMenu(v => ({ ...v, show: false })); }}>
              <i className="fa-solid fa-scissors" /> 剪切
              <span className="ctx-shortcut">⌘X</span>
            </button>
            <button onClick={() => { document.execCommand('copy'); setContextMenu(v => ({ ...v, show: false })); }}>
              <i className="fa-solid fa-copy" /> 复制
              <span className="ctx-shortcut">⌘C</span>
            </button>
            <button onClick={() => { document.execCommand('paste'); setContextMenu(v => ({ ...v, show: false })); }}>
              <i className="fa-solid fa-paste" /> 粘贴
              <span className="ctx-shortcut">⌘V</span>
            </button>
            <div className="ctx-divider" />
            <button onClick={() => { editor.chain().focus().toggleBold().run(); setContextMenu(v => ({ ...v, show: false })); }}>
              <i className="fa-solid fa-bold" /> 加粗
              <span className="ctx-shortcut">⌘B</span>
            </button>
            <button onClick={() => { editor.chain().focus().toggleItalic().run(); setContextMenu(v => ({ ...v, show: false })); }}>
              <i className="fa-solid fa-italic" /> 斜体
              <span className="ctx-shortcut">⌘I</span>
            </button>
            <button onClick={() => { editor.chain().focus().toggleUnderline().run(); setContextMenu(v => ({ ...v, show: false })); }}>
              <i className="fa-solid fa-underline" /> 下划线
              <span className="ctx-shortcut">⌘U</span>
            </button>
            <button onClick={() => { editor.chain().focus().toggleStrike().run(); setContextMenu(v => ({ ...v, show: false })); }}>
              <i className="fa-solid fa-strikethrough" /> 删除线
            </button>
            <div className="ctx-divider" />
            <button onClick={() => { editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run(); setContextMenu(v => ({ ...v, show: false })); }}>
              <i className="fa-solid fa-highlighter" /> 高亮
            </button>
            <button onClick={() => { editor.chain().focus().unsetAllMarks().run(); setContextMenu(v => ({ ...v, show: false })); }}>
              <i className="fa-solid fa-eraser" /> 清除格式
            </button>
            <div className="ctx-divider" />
            <button onClick={() => { editor.chain().focus().setTextAlign('left').run(); setContextMenu(v => ({ ...v, show: false })); }}>
              <i className="fa-solid fa-align-left" /> 左对齐
            </button>
            <button onClick={() => { editor.chain().focus().setTextAlign('center').run(); setContextMenu(v => ({ ...v, show: false })); }}>
              <i className="fa-solid fa-align-center" /> 居中
            </button>
            <button onClick={() => { editor.chain().focus().setTextAlign('justify').run(); setContextMenu(v => ({ ...v, show: false })); }}>
              <i className="fa-solid fa-align-justify" /> 两端对齐
            </button>
          </div>
        </>
      )}

      {/* ─── 样式面板 ─── */}
      {showStylePanel && (
        <div className="word-panel word-style-panel">
          <div className="panel-header">
            <span>快速样式</span>
            <button onClick={() => setShowStylePanel(false)} className="panel-close-btn">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="style-grid">
            {[
              { name: '正文', action: () => editor.chain().focus().setParagraph().run(), icon: 'fa-paragraph', desc: '12pt 宋体' },
              { name: '标题 1', action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), icon: 'fa-heading', desc: '24pt 粗体' },
              { name: '标题 2', action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), icon: 'fa-heading', desc: '18pt 粗体' },
              { name: '标题 3', action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), icon: 'fa-heading', desc: '14pt 粗体' },
              { name: '引用', action: () => editor.chain().focus().toggleBlockquote().run(), icon: 'fa-quote-left', desc: '缩进斜体' },
              { name: '代码块', action: () => editor.chain().focus().toggleCodeBlock().run(), icon: 'fa-code', desc: '等宽字体' },
            ].map((s, i) => (
              <button key={i} className="style-card" onClick={() => { s.action(); setShowStylePanel(false); }}>
                <i className={`fa-solid ${s.icon}`} />
                <span className="style-card-name">{s.name}</span>
                <span className="style-card-desc">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── 页面设置弹窗 ─── */}
      {showPageSetup && (
        <div className="word-panel word-page-setup-panel">
          <div className="panel-header">
            <span>页面设置</span>
            <button onClick={() => setShowPageSetup(false)} className="panel-close-btn">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="page-setup-body">
            <div className="setup-section">
              <label className="setup-label">页边距</label>
              <div className="setup-row">
                <input
                  type="range"
                  min={10} max={30} step={1}
                  value={pageMargin}
                  onChange={(e) => setPageMargin(Number(e.target.value))}
                  className="setup-slider"
                />
                <span className="setup-value">{pageMargin}mm</span>
              </div>
              <div className="margin-presets">
                <button onClick={() => setPageMargin(15)} className={pageMargin === 15 ? 'is-active' : ''}>窄</button>
                <button onClick={() => setPageMargin(18)} className={pageMargin === 18 ? 'is-active' : ''}>标准</button>
                <button onClick={() => setPageMargin(25)} className={pageMargin === 25 ? 'is-active' : ''}>宽</button>
              </div>
            </div>
            <div className="setup-section">
              <label className="setup-label">纸张方向</label>
              <div className="orientation-btns">
                <button
                  onClick={() => setPageOrientation('portrait')}
                  className={pageOrientation === 'portrait' ? 'is-active' : ''}
                >
                  <i className="fa-solid fa-file" style={{ fontSize: 18 }} />
                  <span>纵向</span>
                </button>
                <button
                  onClick={() => setPageOrientation('landscape')}
                  className={pageOrientation === 'landscape' ? 'is-active' : ''}
                >
                  <i className="fa-solid fa-file" style={{ fontSize: 18, transform: 'rotate(90deg)' }} />
                  <span>横向</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 快捷键速查面板 ─── */}
      {showShortcutsPanel && (
        <div className="word-panel word-shortcuts-panel">
          <div className="panel-header">
            <span>快捷键速查</span>
            <button onClick={() => setShowShortcutsPanel(false)} className="panel-close-btn">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="shortcuts-body">
            <div className="shortcut-section-title">编辑</div>
            {[
              ['⌘ F', '查找'], ['⌘ H', '查找替换'], ['⌘ Z', '撤销'],
              ['⌘ ⇧ Z', '重做'], ['⌘ A', '全选'], ['⌘ /', '快捷键面板'],
            ].map(([k, d], i) => (
              <div key={i} className="shortcut-row"><span className="shortcut-desc">{d}</span><kbd>{k}</kbd></div>
            ))}
            <div className="shortcut-section-title">格式</div>
            {[
              ['⌘ B', '加粗'], ['⌘ I', '斜体'], ['⌘ U', '下划线'],
              ['⌘ ⇧ X', '删除线'], ['⌘ E', '居中对齐'],
            ].map(([k, d], i) => (
              <div key={i} className="shortcut-row"><span className="shortcut-desc">{d}</span><kbd>{k}</kbd></div>
            ))}
            <div className="shortcut-section-title">结构</div>
            {[
              ['⌘ ⇧ 1', '标题 1'], ['⌘ ⇧ 2', '标题 2'], ['⌘ ⇧ 3', '标题 3'],
              ['⌘ ⇧ 7', '有序列表'], ['⌘ ⇧ 8', '无序列表'],
            ].map(([k, d], i) => (
              <div key={i} className="shortcut-row"><span className="shortcut-desc">{d}</span><kbd>{k}</kbd></div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 详细统计弹窗 ─── */}
      {showStats && (
        <div className="word-stats-popup">
          <div className="stats-popup-header">
            <span>文档统计</span>
            <button onClick={() => setShowStats(false)} className="stats-close-btn">
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="stats-popup-body">
            <div className="stats-row">
              <span className="stats-label">总字符数</span>
              <span className="stats-value">{charCount.toLocaleString()}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">中文汉字</span>
              <span className="stats-value">{cnCharCount.toLocaleString()}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">英文词数</span>
              <span className="stats-value">{wordCount.toLocaleString()}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">段落数</span>
              <span className="stats-value">{paraCount.toLocaleString()}</span>
            </div>
            <div className="stats-row">
              <span className="stats-label">页数</span>
              <span className="stats-value">{pageCount}</span>
            </div>
            <div className="stats-row stats-row-subtle">
              <span className="stats-label">不含空格字符</span>
              <span className="stats-value">{(charCount - (editor.getText().match(/\s/g) || []).length).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── 增强悬浮式快速排版菜单 ─── */}
      <BubbleMenu editor={editor} tippyOptions={{ duration: 100, maxWidth: 'none', placement: 'top' }}>
        <div className="word-bubble-menu">
          <button onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'is-active' : ''} title={t('writing.formattingToolbar.bold')}>
            <i className="fa-solid fa-bold" />
          </button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'is-active' : ''} title={t('writing.formattingToolbar.italic')}>
            <i className="fa-solid fa-italic" />
          </button>
          <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={editor.isActive('underline') ? 'is-active' : ''} title={t('writing.formattingToolbar.underline')}>
            <i className="fa-solid fa-underline" />
          </button>
          <button onClick={() => editor.chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'is-active' : ''} title="删除线">
            <i className="fa-solid fa-strikethrough" />
          </button>
          <div className="toolbar-divider" />
          <button onClick={() => editor.chain().focus().toggleSubscript().run()} className={editor.isActive('subscript') ? 'is-active' : ''} title={t('writing.formattingToolbar.subscript')}>
            <i className="fa-solid fa-subscript" />
          </button>
          <button onClick={() => editor.chain().focus().toggleSuperscript().run()} className={editor.isActive('superscript') ? 'is-active' : ''} title={t('writing.formattingToolbar.superscript')}>
            <i className="fa-solid fa-superscript" />
          </button>
          <div className="toolbar-divider" />
          <button onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} className={editor.isActive('highlight') ? 'is-active' : ''} title="高亮">
            <i className="fa-solid fa-highlighter" />
          </button>
          <div className="toolbar-divider" />
          <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={editor.isActive({ textAlign: 'left' }) ? 'is-active' : ''} title="左对齐">
            <i className="fa-solid fa-align-left" />
          </button>
          <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={editor.isActive({ textAlign: 'center' }) ? 'is-active' : ''} title="居中">
            <i className="fa-solid fa-align-center" />
          </button>
          <button onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={editor.isActive({ textAlign: 'justify' }) ? 'is-active' : ''} title="两端对齐">
            <i className="fa-solid fa-align-justify" />
          </button>
          <div className="toolbar-divider" />
          <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'is-active' : ''} title="项目列表">
            <i className="fa-solid fa-list-ul" />
          </button>
          <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'is-active' : ''} title="编号列表">
            <i className="fa-solid fa-list-ol" />
          </button>
          <div className="toolbar-divider" />
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''} title={t('writing.formattingToolbar.h2')}>
            <span>H2</span>
          </button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'is-active' : ''} title={t('writing.formattingToolbar.h3')}>
            <span>H3</span>
          </button>
          <div className="toolbar-divider" />
          <button onClick={handleCopyFormat} className={formatPainterActive ? 'is-active' : ''} title="格式刷">
            <i className="fa-solid fa-paint-roller" />
          </button>
        </div>
      </BubbleMenu>
    </div>
  );
});

export default WysiwygEditor;
