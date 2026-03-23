/**
 * usePagination — 纯测量分页引擎（零 DOM 修改）
 *
 * 设计原则：
 * 1. 绝不修改 DOM（不注入 margin-top，不设置 data 属性）
 * 2. 只负责测量内容高度并计算页数
 * 3. 使用 ResizeObserver 自动响应尺寸变化（因为不改 DOM，所以不会循环）
 * 4. 分页指示器通过固定间距渲染（每 pageHeightPx 一个断点）
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── A4 页面几何常量 ───
const PAGE_HEIGHT_MM = 297;
const MM_TO_PX = 96 / 25.4; // ≈3.7795

export interface PaginationResult {
  pageCount: number;
  /** 总高度 = pageCount × pageHeightPx */
  totalHeight: number;
  /** 手动触发重新计算 */
  recalculate: () => void;
}

interface PaginationOptions {
  /** 页面边距 mm（上下各一个） */
  pageMarginMm?: number;
  /** 页面方向 */
  orientation?: 'portrait' | 'landscape';
}

/**
 * React Hook: 纯测量分页
 *
 * 简单可靠：scrollHeight → 计算页数 → 返回。
 * 不碰 DOM，用 ResizeObserver 自动更新，无反馈循环。
 */
export function usePagination(
  editorContainerRef: React.RefObject<HTMLDivElement | null>,
  options: PaginationOptions = {},
): PaginationResult {
  const {
    pageMarginMm = 18,
    orientation = 'portrait',
  } = options;

  const [pageCount, setPageCount] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 页面几何属性
  const pageHMm = orientation === 'landscape' ? 210 : 297;
  const pageHeightPx = Math.round(pageHMm * MM_TO_PX);
  const paddingPx = pageMarginMm * MM_TO_PX;
  const contentHeightPx = pageHeightPx - paddingPx * 2;

  const recalculate = useCallback(() => {
    if (!editorContainerRef.current) return;
    const tiptapEl = editorContainerRef.current.querySelector('.tiptap') as HTMLElement | null;
    if (!tiptapEl) return;

    const scrollH = tiptapEl.scrollHeight;
    // 减去上下 padding 得到纯内容高度
    const effectiveH = Math.max(scrollH - paddingPx * 2, 0);
    const pages = Math.max(1, Math.ceil(effectiveH / contentHeightPx));
    setPageCount(pages);
  }, [editorContainerRef, paddingPx, contentHeightPx]);

  // 防抖版
  const debouncedRecalculate = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(recalculate, 80);
  }, [recalculate]);

  // ResizeObserver —— 因为不修改 DOM，所以不会产生循环
  useEffect(() => {
    if (!editorContainerRef.current) return;
    const tiptapEl = editorContainerRef.current.querySelector('.tiptap');
    if (!tiptapEl) return;

    // 初始计算
    recalculate();

    const obs = new ResizeObserver(() => debouncedRecalculate());
    obs.observe(tiptapEl);

    return () => {
      obs.disconnect();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editorContainerRef, recalculate, debouncedRecalculate]);

  const totalHeight = pageHeightPx * pageCount;

  return {
    pageCount,
    totalHeight,
    recalculate,
  };
}

export { PAGE_HEIGHT_MM, MM_TO_PX };
