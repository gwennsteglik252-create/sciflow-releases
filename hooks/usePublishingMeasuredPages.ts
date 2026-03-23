
import { useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import { TemplateConfig } from '../components/Writing/WritingConfig';

interface ContentBlock {
    id: string;
    html: string;
    height: number;
    isFullSpan?: boolean;
}

/**
 * usePublishingMeasuredPages
 * 
 * 精确模拟 CSS column-fill: auto 的行为：
 * 1. 单独测量每个 block 的真实高度（图片用预估值）
 * 2. 按照 CSS auto-fill 的顺序填栏：先填左栏，左栏满了填右栏
 * 3. 所有栏满 → 开新页
 * 
 * 渲染端也必须使用 column-fill: auto + break-inside: avoid（所有 block），
 * 这样 CSS 的行为就和 JS 模拟完全一致，不会出现截断。
 */
export const usePublishingMeasuredPages = (
    allBlocks: ContentBlock[],
    activeTemplate: TemplateConfig,
    publishingStyleSheet: string
): ContentBlock[][] => {
    const measureContainerRef = useRef<HTMLDivElement | null>(null);

    const getOrCreateContainer = useCallback(() => {
        let root = measureContainerRef.current;
        if (!root || !root.parentNode) {
            root = document.createElement('div');
            root.id = '__pub_measure_root__';
            root.setAttribute('aria-hidden', 'true');
            document.body.appendChild(root);
            measureContainerRef.current = root;
        }
        return root;
    }, []);

    useLayoutEffect(() => {
        return () => {
            if (measureContainerRef.current && measureContainerRef.current.parentNode) {
                measureContainerRef.current.parentNode.removeChild(measureContainerRef.current);
                measureContainerRef.current = null;
            }
        };
    }, []);

    const pages = useMemo(() => {
        if (allBlocks.length === 0) return [];
        if (typeof document === 'undefined') return [];

        const columns = activeTemplate?.columns || 2;
        // CSS 页面内容高度 985px，我们用 980px 留 5px 微小裕量
        const PAGE_HEIGHT = 980;

        // ========== 阶段 1：DOM 测量每个 block 真实高度 ==========
        const root = getOrCreateContainer();
        root.innerHTML = '';

        const styleEl = document.createElement('style');
        styleEl.textContent = publishingStyleSheet;
        root.appendChild(styleEl);

        const shell = document.createElement('div');
        shell.className = `publishing-page ${activeTemplate.fontFamily || ''}`;
        Object.assign(shell.style, {
            position: 'fixed',
            left: '-99999px',
            top: '0',
            width: '210mm',
            minWidth: '210mm',
            padding: '18mm',
            boxSizing: 'border-box',
            background: 'white',
            visibility: 'hidden',
            pointerEvents: 'none',
            zIndex: '-1',
            height: 'auto',
            overflow: 'visible',
            display: 'block',
            flexDirection: 'unset',
        });
        root.appendChild(shell);

        // 单栏测量盒
        const pageContentWidthMm = 174;
        const gapMm = 8;
        const colWidthMm = (pageContentWidthMm - (columns - 1) * gapMm) / columns;

        const singleColBox = document.createElement('div');
        Object.assign(singleColBox.style, {
            width: `${colWidthMm}mm`,
            textAlign: 'justify',
        });
        shell.appendChild(singleColBox);

        // 全宽测量盒
        const fullWidthBox = document.createElement('div');
        Object.assign(fullWidthBox.style, {
            width: `${pageContentWidthMm}mm`,
            textAlign: 'justify',
        });
        shell.appendChild(fullWidthBox);

        // 逐个测量
        const measuredHeights: number[] = [];
        allBlocks.forEach(block => {
            const hasImage = /<img\s/i.test(block.html);
            if (hasImage) {
                measuredHeights.push(block.height);
            } else {
                const targetBox = block.isFullSpan ? fullWidthBox : singleColBox;
                const wrapper = document.createElement('div');
                wrapper.innerHTML = block.html;
                targetBox.appendChild(wrapper);
                const realHeight = wrapper.offsetHeight;
                measuredHeights.push(realHeight);
                targetBox.removeChild(wrapper);
            }
        });

        root.innerHTML = '';

        // ========== 阶段 2：模拟 CSS column-fill: auto 的顺序填充 ==========
        // auto 的行为：内容按 DOM 顺序填入当前列；
        // 当当前列放不下一个完整 block 时，切换到下一列；
        // 所有列都满了则开新页。
        const resultPages: ContentBlock[][] = [];
        let currentPageBlocks: ContentBlock[] = [];
        let colHeights: number[] = new Array(columns).fill(0);
        let currentCol = 0; // 当前正在填充的列

        const startNewPage = () => {
            if (currentPageBlocks.length > 0) {
                resultPages.push([...currentPageBlocks]);
            }
            currentPageBlocks = [];
            colHeights = new Array(columns).fill(0);
            currentCol = 0;
        };

        allBlocks.forEach((block, i) => {
            const h = measuredHeights[i];

            if (block.isFullSpan) {
                // full-span 块跨所有栏：从所有栏的最大高度开始
                const maxH = Math.max(...colHeights);
                if (maxH + h > PAGE_HEIGHT) {
                    startNewPage();
                    currentPageBlocks.push(block);
                    colHeights = new Array(columns).fill(h);
                    currentCol = 0;
                } else {
                    currentPageBlocks.push(block);
                    colHeights = new Array(columns).fill(maxH + h);
                    currentCol = 0; // full-span 后重置列指针
                }
            } else {
                // 尝试放入当前列
                if (colHeights[currentCol] + h <= PAGE_HEIGHT) {
                    // 当前列能放下
                    currentPageBlocks.push(block);
                    colHeights[currentCol] += h;
                } else {
                    // 当前列放不下 → 尝试下一列
                    let placed = false;
                    for (let c = currentCol + 1; c < columns; c++) {
                        if (colHeights[c] + h <= PAGE_HEIGHT) {
                            currentCol = c;
                            currentPageBlocks.push(block);
                            colHeights[c] += h;
                            placed = true;
                            break;
                        }
                    }

                    if (!placed) {
                        // 所有列都放不下 → 开新页
                        startNewPage();
                        currentPageBlocks.push(block);
                        colHeights[0] = h;
                        currentCol = 0;
                    }
                }
            }
        });

        if (currentPageBlocks.length > 0) {
            resultPages.push(currentPageBlocks);
        }

        return resultPages;
    }, [allBlocks, activeTemplate, publishingStyleSheet, getOrCreateContainer]);

    return pages;
};
