/**
 * useMobileLayout.ts — 移动端布局适配 Hook
 *
 * 提供响应式断点检测和移动端特定行为管理。
 * 使用 matchMedia API 监听视口变化，零性能开销。
 */
import { useState, useEffect, useCallback } from 'react';

export interface MobileLayoutState {
  /** 是否为移动端视口 (< 768px) */
  isMobileView: boolean;
  /** 是否为平板视口 (768px - 1024px) */
  isTabletView: boolean;
  /** 是否为桌面视口 (>= 1024px) */
  isDesktopView: boolean;
  /** 当前视口宽度 */
  viewportWidth: number;
  /** 是否为竖屏 */
  isPortrait: boolean;
}

export function useMobileLayout(): MobileLayoutState {
  const getState = useCallback((): MobileLayoutState => {
    if (typeof window === 'undefined') {
      return {
        isMobileView: false,
        isTabletView: false,
        isDesktopView: true,
        viewportWidth: 1920,
        isPortrait: false,
      };
    }

    // Electron 桌面端：无论窗口多小，始终视为桌面端，不触发移动布局
    const isElectron = !!(window as any).electronAPI || navigator.userAgent.includes('Electron');
    if (isElectron) {
      return {
        isMobileView: false,
        isTabletView: false,
        isDesktopView: true,
        viewportWidth: window.innerWidth,
        isPortrait: false,
      };
    }

    // Web 浏览器（PWA / 手机浏览器）：根据实际视口宽度判断
    const w = window.innerWidth;
    return {
      isMobileView: w < 768,
      isTabletView: w >= 768 && w < 1024,
      isDesktopView: w >= 1024,
      viewportWidth: w,
      isPortrait: window.innerHeight > window.innerWidth,
    };
  }, []);

  const [state, setState] = useState<MobileLayoutState>(getState);

  useEffect(() => {
    const mqlMobile = window.matchMedia('(max-width: 767px)');
    const mqlTablet = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
    const mqlPortrait = window.matchMedia('(orientation: portrait)');

    const handler = () => setState(getState());

    // 使用 addEventListener 而非 deprecated addListener
    mqlMobile.addEventListener('change', handler);
    mqlTablet.addEventListener('change', handler);
    mqlPortrait.addEventListener('change', handler);

    // 初始同步
    handler();

    return () => {
      mqlMobile.removeEventListener('change', handler);
      mqlTablet.removeEventListener('change', handler);
      mqlPortrait.removeEventListener('change', handler);
    };
  }, [getState]);

  return state;
}
