
import React from 'react';
import { TemplateConfig } from '../WritingConfig';

interface ContentBlock {
  id: string;
  html: string;
  height: number;
  isFullSpan?: boolean;
  clipTop?: number; // 跳过前 N px（跨页续接块）
}

interface PageRendererProps {
  pageBlocks: ContentBlock[];
  pageIndex: number;
  activeTemplate: TemplateConfig;
  onSyncClick?: (sectionId: string, offset: number, charOffset: number, wordLength: number) => void;
  onFigCaptionDblClick?: (refId: string) => void;
  onTableDblClick?: (tableId: string) => void;
  onMathDblClick?: (snippetId: string) => void;
}

export const PageRenderer: React.FC<PageRendererProps> = React.memo(({
  pageBlocks,
  pageIndex,
  activeTemplate,
  onSyncClick,
  onFigCaptionDblClick,
  onTableDblClick,
  onMathDblClick
}) => {

  /** 用 caretRangeFromPoint 获取点击位置在 syncTarget 中的字符偏移 */
  const getCharOffset = (syncTarget: HTMLElement, clientX: number, clientY: number): number => {
    if (!document.caretRangeFromPoint) return 0;
    try {
      const range = document.caretRangeFromPoint(clientX, clientY);
      if (!range) return 0;
      const preRange = document.createRange();
      preRange.setStart(syncTarget, 0);
      preRange.setEnd(range.startContainer, range.startOffset);
      return preRange.toString().length;
    } catch (_) {
      return 0;
    }
  };

  /** 单击：放置光标 + 编辑框跳转 */
  const handlePageClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const syncTarget = target.closest('.sync-target') as HTMLElement;
    if (syncTarget && onSyncClick) {
      const sectionId = syncTarget.getAttribute('data-sync-section');
      const offsetAttr = syncTarget.getAttribute('data-sync-offset');
      if (sectionId && offsetAttr !== null) {
        const baseOffset = parseInt(offsetAttr);
        const charOffset = getCharOffset(syncTarget, e.clientX, e.clientY);
        onSyncClick(sectionId, baseOffset, charOffset, 0);
      }
    }
  };

  /** 双击：选中单词 + 编辑框跳转；如果双击的是图注则打开素材库 */
  const handlePageDblClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;

    // 检测是否双击了 figcaption（图注）区域
    const figcaption = target.closest('figcaption');
    if (figcaption && onFigCaptionDblClick) {
      // 从外层 block div 的 id（格式: fig-{refId}）中提取 refId
      const blockDiv = figcaption.closest('[id^="fig-"]');
      if (blockDiv) {
        const refId = blockDiv.id.replace(/^fig-/, '');
        if (refId) {
          onFigCaptionDblClick(refId);
          return; // 不再触发编辑器同步
        }
      }
    }

    // 检测是否双击了表格区域（整个 table block）
    const tableBlock = target.closest('[id^="table-tag-"]');
    if (tableBlock && onTableDblClick) {
      const tableId = tableBlock.id.replace(/^table-tag-/, '');
      if (tableId) {
        onTableDblClick(tableId);
        return;
      }
    }

    // 检测是否双击了公式模块区域（整个 math block）
    const mathBlock = target.closest('[id^="math-tag-"]');
    if (mathBlock && onMathDblClick) {
      const snippetId = mathBlock.id.replace(/^math-tag-/, '');
      if (snippetId) {
        onMathDblClick(snippetId);
        return;
      }
    }

    const syncTarget = target.closest('.sync-target') as HTMLElement;
    if (syncTarget && onSyncClick) {
      const sectionId = syncTarget.getAttribute('data-sync-section');
      const offsetAttr = syncTarget.getAttribute('data-sync-offset');
      if (sectionId && offsetAttr !== null) {
        const baseOffset = parseInt(offsetAttr);
        const charOffset = getCharOffset(syncTarget, e.clientX, e.clientY);
        const selection = window.getSelection();
        const wordLen = selection?.toString().trim().length || 0;
        onSyncClick(sectionId, baseOffset, charOffset, wordLen);
      }
    }
  };

  return (
    <div
      className={`publishing-page ${activeTemplate.fontFamily}`}
      onClick={handlePageClick}
      onDoubleClick={handlePageDblClick}
    >
      <div className="page-content-columns" style={{ columnCount: activeTemplate.columns }}>
        {pageBlocks.map(block => {
          if (block.clipTop) {
            // ── 跨页续接块：精确的视窗切片渲染 ──
            //
            // 正确原理：
            //   外层容器设置固定 height = block.height，overflow:hidden
            //   内层内容用 position:relative + top:-clipTopPx 向上偏移
            //   → 外层只会"看到"从 clipTopPx 开始的那段内容
            //
            // ❌ 错误做法（之前）：margin-top:-NNpx
            //   margin 会把元素向上推并超出 overflow:hidden 容器的顶部，
            //   导致被推上去的内容直接被裁掉，显示的仍然是开头内容！
            return (
              <div
                key={block.id}
                id={block.id}
                style={{
                  height: `${block.height}px`,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div style={{ position: 'relative', top: `-${block.clipTop}px` }}>
                  <div dangerouslySetInnerHTML={{ __html: block.html }} />
                </div>
              </div>
            );
          }
          return (
            <div
              key={block.id}
              id={block.id}
              style={block.isFullSpan ? { columnSpan: 'all' } as any : {}}
              dangerouslySetInnerHTML={{ __html: block.html }}
            />
          );
        })}
      </div>
      <div className="page-footer-num">Page {pageIndex + 1}</div>
    </div>
  );
});
