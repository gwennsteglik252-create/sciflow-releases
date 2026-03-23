// ═══ hooks/useDocxMode.ts — Word 文档导入/导出/状态管理 ═══
//
// 核心流程：
//   打开 .docx → mammoth.convertToHtml → TipTap HTML 内容
//   编辑（TipTap WysiwygEditor）
//   保存 .docx → docx 库: HTML → Paragraphs → Document → Packer → base64

import { useState, useCallback } from 'react';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, convertInchesToTwip } from 'docx';

// ─── 类型定义 ───

export interface DocxFileState {
  /** 当前打开的文件名 */
  fileName: string | null;
  /** 文件在磁盘上的完整路径（用于"保存"操作，null 则弹出"另存为"） */
  filePath: string | null;
  /** 是否有未保存的修改 */
  isDirty: boolean;
  /** 是否正在加载/保存 */
  isLoading: boolean;
}

/**
 * 将简单 HTML 转换为 docx Paragraph 数组
 * 支持：段落、标题(h1-h3)、加粗、斜体、下划线、上下标
 */
function htmlToDocxParagraphs(html: string): Paragraph[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const paragraphs: Paragraph[] = [];

  const processNode = (node: Element): void => {
    const tagName = node.tagName?.toLowerCase();

    // 标题
    if (['h1', 'h2', 'h3'].includes(tagName)) {
      const level = tagName === 'h1' ? HeadingLevel.HEADING_1
        : tagName === 'h2' ? HeadingLevel.HEADING_2
        : HeadingLevel.HEADING_3;
      const runs = extractTextRuns(node);
      paragraphs.push(new Paragraph({ heading: level, children: runs }));
      return;
    }

    // 段落
    if (tagName === 'p' || tagName === 'div') {
      const runs = extractTextRuns(node);
      if (runs.length === 0) {
        paragraphs.push(new Paragraph({ children: [new TextRun('')] }));
      } else {
        // 读取对齐方式
        const style = node.getAttribute('style') || '';
        let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] | undefined;
        if (style.includes('text-align: center') || style.includes('text-align:center'))
          alignment = AlignmentType.CENTER;
        else if (style.includes('text-align: right') || style.includes('text-align:right'))
          alignment = AlignmentType.RIGHT;
        else if (style.includes('text-align: justify') || style.includes('text-align:justify'))
          alignment = AlignmentType.JUSTIFIED;

        paragraphs.push(new Paragraph({
          children: runs,
          ...(alignment ? { alignment } : {}),
        }));
      }
      return;
    }

    // 块级未知元素 → 递归其子元素
    for (const child of Array.from(node.children)) {
      processNode(child);
    }
  };

  // 处理 body 的直接子元素
  for (const child of Array.from(doc.body.children)) {
    processNode(child);
  }

  // 如果没有任何段落（纯文本），做 fallback
  if (paragraphs.length === 0 && doc.body.textContent?.trim()) {
    paragraphs.push(new Paragraph({
      children: [new TextRun(doc.body.textContent.trim())],
    }));
  }

  return paragraphs;
}

/** 从 DOM 节点提取 TextRun 数组 */
function extractTextRuns(node: Node): TextRun[] {
  const runs: TextRun[] = [];

  const walk = (n: Node, styles: {
    bold?: boolean; italic?: boolean; underline?: boolean;
    superScript?: boolean; subScript?: boolean;
  }) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const text = n.textContent || '';
      if (text) {
        runs.push(new TextRun({
          text,
          bold: styles.bold,
          italics: styles.italic,
          underline: styles.underline ? {} : undefined,
          superScript: styles.superScript,
          subScript: styles.subScript,
        }));
      }
      return;
    }

    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as Element;
      const tag = el.tagName.toLowerCase();
      const newStyles = { ...styles };

      if (tag === 'strong' || tag === 'b') newStyles.bold = true;
      if (tag === 'em' || tag === 'i') newStyles.italic = true;
      if (tag === 'u') newStyles.underline = true;
      if (tag === 'sup') newStyles.superScript = true;
      if (tag === 'sub') newStyles.subScript = true;

      for (const child of Array.from(n.childNodes)) {
        walk(child, newStyles);
      }
    }
  };

  walk(node, {});
  return runs;
}

// ─── Hook ───

export function useDocxMode() {
  const [fileState, setFileState] = useState<DocxFileState>({
    fileName: null,
    filePath: null,
    isDirty: false,
    isLoading: false,
  });

  /**
   * 打开 .docx 文件：弹出文件选择对话框 → mammoth 转 HTML
   * @returns HTML 字符串，或 null 表示用户取消
   */
  const openDocx = useCallback(async (): Promise<string | null> => {
    if (!window.electron?.openDocxDialog) {
      console.warn('[DocxMode] Electron API not available');
      return null;
    }

    setFileState(s => ({ ...s, isLoading: true }));

    try {
      const result = await window.electron.openDocxDialog();
      if (!result) {
        setFileState(s => ({ ...s, isLoading: false }));
        return null;
      }

      // base64 → ArrayBuffer
      const binaryStr = atob(result.data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // mammoth 转 HTML
      const { value: html, messages } = await mammoth.convertToHtml(
        { arrayBuffer: bytes.buffer },
        {
          styleMap: [
            "p[style-name='Title'] => h1:fresh",
            "p[style-name='Heading 1'] => h2:fresh",
            "p[style-name='Heading 2'] => h3:fresh",
          ],
        }
      );

      if (messages.length > 0) {
        console.warn('[DocxMode] mammoth warnings:', messages);
      }

      setFileState({
        fileName: result.name,
        filePath: result.path,
        isDirty: false,
        isLoading: false,
      });

      return html;
    } catch (err) {
      console.error('[DocxMode] Failed to open docx:', err);
      setFileState(s => ({ ...s, isLoading: false }));
      return null;
    }
  }, []);

  /**
   * 保存当前编辑内容为 .docx
   * @param html TipTap 编辑器的 HTML 内容
   * @param saveAs 是否强制弹出"另存为"对话框
   */
  const saveDocx = useCallback(async (html: string, saveAs = false): Promise<boolean> => {
    if (!window.electron?.saveDocx) {
      console.warn('[DocxMode] Electron API not available');
      return false;
    }

    setFileState(s => ({ ...s, isLoading: true }));

    try {
      // HTML → docx Paragraphs
      const paragraphs = htmlToDocxParagraphs(html);

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1.25),
                right: convertInchesToTwip(1.25),
              },
            },
          },
          children: paragraphs,
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      // Buffer → base64
      const uint8 = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < uint8.length; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const base64 = btoa(binary);

      const result = await window.electron.saveDocx({
        data: base64,
        filePath: saveAs ? undefined : fileState.filePath || undefined,
        defaultName: fileState.fileName || 'document.docx',
      });

      if (result.success) {
        setFileState(s => ({
          ...s,
          isDirty: false,
          isLoading: false,
          filePath: result.filePath || s.filePath,
          fileName: result.name || s.fileName,
        }));
        return true;
      }

      setFileState(s => ({ ...s, isLoading: false }));
      return false;
    } catch (err) {
      console.error('[DocxMode] Failed to save docx:', err);
      setFileState(s => ({ ...s, isLoading: false }));
      return false;
    }
  }, [fileState.filePath, fileState.fileName]);

  /** 标记内容已修改 */
  const markDirty = useCallback(() => {
    setFileState(s => {
      if (s.isDirty) return s;
      return { ...s, isDirty: true };
    });
  }, []);

  /** 关闭当前 Word 文件，重置状态 */
  const closeDocx = useCallback(() => {
    setFileState({
      fileName: null,
      filePath: null,
      isDirty: false,
      isLoading: false,
    });
  }, []);

  return {
    fileState,
    openDocx,
    saveDocx,
    markDirty,
    closeDocx,
  };
}
