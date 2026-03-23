
import { useState, useEffect, useRef, useCallback } from 'react';
import { TemplateConfig } from '../components/Writing/WritingConfig';

interface UsePublishingStateProps {
  activeTemplate: TemplateConfig;
  viewMode?: 'standard' | 'dual' | 'triple';
  isFocusMode?: boolean;
}

export const usePublishingState = ({ activeTemplate, viewMode, isFocusMode }: UsePublishingStateProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  
  // 除非是聚焦模式，否则默认开启自动变焦
  const [isAutoZoom, setIsAutoZoom] = useState(!isFocusMode);
  
  // 核心：布局切换锁和缓存
  const lastZoomRef = useRef(1.0);
  const transitionLockRefObject = useRef<boolean>(false);
  const resizeRafRef = useRef<number>(0);

  // 初始化缩放值预判：根据模式直接给出合理初值，防止渲染瞬间的跳动
  const [zoom, setZoom] = useState(() => {
    if (isFocusMode) return 1.2;
    if (viewMode === 'triple') return 0.82; 
    if (viewMode === 'dual') return 1.1;
    return activeTemplate.columns === 2 ? 1.0 : 1.2;
  });

  /**
   * 核心适配算法：计算页面宽度相对于容器宽度的缩放比
   */
  const updateZoom = useCallback((force = false) => {
    // 如果处于动画锁定期且非强制更新，则拦截，防止在分栏动画进行中频繁触发无效测量
    if (transitionLockRefObject.current && !force) return;

    const el = scrollerRef.current;
    if (!el || (!isAutoZoom && !force) || isFocusMode) return;
    
    // 获取容器实际可用宽度
    const width = el.clientWidth;
    if (width <= 0) return;
    
    /**
     * 左右不留白边的关键：
     * A4 标准宽度 210mm 在 96DPI 下约为 794px。
     * 考虑到滚动条占用（约 6-10px），我们预留极小的 buffer (4px) 确保不会产生横向滚动条，
     * 从而实现视觉上的“左右触边”效果。
     */
    const scrollbarBuffer = 8; 
    const pageWidth = 794; 
    const targetZoom = (width - scrollbarBuffer) / pageWidth;
    
    // 限制合理范围，并使用三位小数精度减少微小抖动
    const finalZoom = Math.min(2.0, Math.max(0.2, targetZoom));
    
    if (force || Math.abs(finalZoom - lastZoomRef.current) > 0.005) {
        lastZoomRef.current = finalZoom;
        setZoom(Number(finalZoom.toFixed(3)));
    }
  }, [isAutoZoom, isFocusMode]);

  // 1. 视图模式/分栏数量切换处理
  useEffect(() => {
    if (isFocusMode) {
      setIsAutoZoom(false);
      setZoom(1.2);
    } else {
      // 开启硬锁，CSS 分栏动画期间不接受 ResizeObserver 的测量更新，消除抖动源
      transitionLockRefObject.current = true;
      
      // 执行一次初步缩放更新
      updateZoom(true);
      
      const timer = setTimeout(() => {
          transitionLockRefObject.current = false;
          // 动画结束后，进行一次高精度最终校准
          updateZoom(true);
      }, 500); // 略长于 CSS transition 时间
      
      return () => {
          clearTimeout(timer);
          transitionLockRefObject.current = false;
      };
    }
  }, [viewMode, isFocusMode, activeTemplate.columns, updateZoom]);

  // 2. 窗口大小改变监听
  useEffect(() => {
    if (!isAutoZoom || !scrollerRef.current || isFocusMode) return;
    
    const el = scrollerRef.current;
    const observer = new ResizeObserver(() => {
        // 如果容器正在进行 CSS 分栏动画，跳过此时的测量，因为 clientWidth 是不稳定的
        if (transitionLockRefObject.current) return; 
        
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = requestAnimationFrame(() => updateZoom());
    });

    observer.observe(el);
    return () => {
        observer.disconnect();
        cancelAnimationFrame(resizeRafRef.current);
    };
  }, [isAutoZoom, isFocusMode, updateZoom]);

  return {
    isSidebarOpen,
    setIsSidebarOpen,
    zoom,
    setZoom,
    isAutoZoom,
    setIsAutoZoom,
    scrollerRef,
    isTransitioning: transitionLockRefObject.current
  };
};
