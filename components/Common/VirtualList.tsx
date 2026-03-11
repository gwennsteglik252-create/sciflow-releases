/**
 * VirtualList — 零依赖虚拟滚动组件
 * 只渲染可视区域 ± overscan 范围内的项目，支持固定行高
 */
import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';

interface VirtualListProps<T> {
    /** 完整数据列表 */
    items: T[];
    /** 每项的预估高度（含间距），单位 px */
    itemHeight: number;
    /** 渲染单项的回调 */
    renderItem: (item: T, index: number) => React.ReactNode;
    /** 上下额外渲染的条目数 */
    overscan?: number;
    /** 列表为空时展示的内容 */
    emptyContent?: React.ReactNode;
    /** 容器附加 className */
    className?: string;
    /** 项目之间的间距，单位 px */
    gap?: number;
}

function VirtualList<T>({
    items,
    itemHeight,
    renderItem,
    overscan = 5,
    emptyContent,
    className = '',
    gap = 12
}: VirtualListProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);

    // 监听容器尺寸变化
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const updateHeight = () => setContainerHeight(el.clientHeight);
        updateHeight();

        const observer = new ResizeObserver(updateHeight);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    const rowHeightWithGap = itemHeight + gap;
    const totalHeight = items.length * rowHeightWithGap - (items.length > 0 ? gap : 0);

    const { startIndex, endIndex, visibleItems } = useMemo(() => {
        if (items.length === 0) return { startIndex: 0, endIndex: 0, visibleItems: [] as T[] };

        const start = Math.max(0, Math.floor(scrollTop / rowHeightWithGap) - overscan);
        const visibleCount = Math.ceil(containerHeight / rowHeightWithGap);
        const end = Math.min(items.length - 1, start + visibleCount + overscan * 2);

        return {
            startIndex: start,
            endIndex: end,
            visibleItems: items.slice(start, end + 1)
        };
    }, [items, scrollTop, containerHeight, rowHeightWithGap, overscan]);

    if (items.length === 0) {
        return (
            <div ref={containerRef} className={`overflow-y-auto ${className}`}>
                {emptyContent}
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`overflow-y-auto custom-scrollbar ${className}`}
            onScroll={handleScroll}
        >
            {/* 总高度占位，维持滚动条 */}
            <div style={{ height: totalHeight, position: 'relative' }}>
                {visibleItems.map((item, i) => {
                    const actualIndex = startIndex + i;
                    return (
                        <div
                            key={actualIndex}
                            style={{
                                position: 'absolute',
                                top: actualIndex * rowHeightWithGap,
                                left: 0,
                                right: 0,
                                height: itemHeight,
                            }}
                        >
                            {renderItem(item, actualIndex)}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default VirtualList;
