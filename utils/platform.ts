/**
 * platform.ts — 跨平台环境检测工具
 *
 * 提供统一的平台检测 API，让业务代码无需直接判断运行环境。
 * 所有与 Electron / 移动端 / PWA 相关的条件分支都应使用此模块。
 */

/** 是否运行在 Electron 环境中（桌面端） */
export const isElectron: boolean =
  typeof window !== 'undefined' && !!(window as any).electron;

/** 是否为移动端设备（手机/平板） */
export const isMobile: boolean =
  typeof navigator !== 'undefined' &&
  /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

/** 是否为平板设备 */
export const isTablet: boolean =
  typeof navigator !== 'undefined' &&
  (/iPad/i.test(navigator.userAgent) ||
    (/Android/i.test(navigator.userAgent) && !/Mobile/i.test(navigator.userAgent)));

/** 是否为 iOS 设备 */
export const isIOS: boolean =
  typeof navigator !== 'undefined' &&
  /iPhone|iPad|iPod/i.test(navigator.userAgent);

/** 是否为 Android 设备 */
export const isAndroid: boolean =
  typeof navigator !== 'undefined' &&
  /Android/i.test(navigator.userAgent);

/** 是否以 PWA 独立模式运行（从"添加到主屏幕"启动） */
export const isStandalonePWA: boolean =
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true);

/** 是否为纯 Web 环境（非 Electron） */
export const isWeb: boolean = !isElectron;

/** 是否为小屏设备 (宽度 < 768px) */
export const isSmallScreen = (): boolean =>
  typeof window !== 'undefined' && window.innerWidth < 768;

/** 是否为触摸屏设备 */
export const isTouchDevice: boolean =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

/**
 * 获取当前平台描述字符串
 * @returns 'electron' | 'pwa' | 'mobile-web' | 'desktop-web'
 */
export const getPlatform = (): 'electron' | 'pwa' | 'mobile-web' | 'desktop-web' => {
  if (isElectron) return 'electron';
  if (isStandalonePWA) return 'pwa';
  if (isMobile) return 'mobile-web';
  return 'desktop-web';
};
