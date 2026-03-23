
import { useEffect, useCallback, useState, useRef } from 'react';

interface UseScreenshotOptions {
    showToast?: (config: { message: string; type: 'success' | 'error' | 'info' | 'warning' }) => void;
}

/**
 * 全局截屏 Hook - 框选区域截屏（高性能版）
 *
 * 核心优化：
 * 1. 框选过程完全使用原生 DOM 操作，不触发 React 重渲染
 * 2. 截屏使用 Electron webContents.capturePage() 原生 API，毫秒级完成
 *
 * 快捷键: Ctrl+Shift+S / Cmd+Shift+S
 */
export const useScreenshot = ({ showToast }: UseScreenshotOptions) => {
    const [isSelecting, setIsSelecting] = useState(false);
    const [flashVisible, setFlashVisible] = useState(false);

    const overlayRef = useRef<HTMLDivElement | null>(null);
    const rectRef = useRef<HTMLDivElement | null>(null);
    const maskRef = useRef<HTMLDivElement | null>(null);
    const labelRef = useRef<HTMLDivElement | null>(null);
    const hintRef = useRef<HTMLDivElement | null>(null);
    const startRef = useRef<{ x: number; y: number } | null>(null);
    const isDraggingRef = useRef(false);

    // 创建并挂载原生 DOM 叠层
    const createOverlay = useCallback(() => {
        // 整个遮罩容器
        const overlay = document.createElement('div');
        overlay.id = 'screenshot-selection-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99998;cursor:crosshair;user-select:none;';

        // 半透明蒙层
        const mask = document.createElement('div');
        mask.style.cssText = 'position:absolute;inset:0;background:rgba(15,23,42,0.35);pointer-events:none;transition:none;';
        overlay.appendChild(mask);
        maskRef.current = mask;

        // 选区边框
        const rect = document.createElement('div');
        rect.style.cssText = 'position:absolute;border:2px solid #818cf8;pointer-events:none;display:none;box-shadow:0 0 0 1px rgba(99,102,241,0.3);';
        overlay.appendChild(rect);
        rectRef.current = rect;

        // 尺寸标注
        const label = document.createElement('div');
        label.style.cssText = 'position:absolute;top:-24px;left:50%;transform:translateX(-50%);padding:2px 8px;background:#4f46e5;color:#fff;font-size:10px;font-weight:800;border-radius:6px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.2);';
        rect.appendChild(label);
        labelRef.current = label;

        // 四角锚点
        const corners = [
            { top: '-3px', left: '-3px' },
            { top: '-3px', right: '-3px' },
            { bottom: '-3px', left: '-3px' },
            { bottom: '-3px', right: '-3px' },
        ];
        corners.forEach(pos => {
            const dot = document.createElement('div');
            dot.style.cssText = `position:absolute;width:6px;height:6px;background:#fff;border:2px solid #6366f1;border-radius:1px;`;
            if (pos.top) dot.style.top = pos.top;
            if (pos.bottom) dot.style.bottom = pos.bottom;
            if (pos.left) dot.style.left = pos.left;
            if (pos.right) dot.style.right = pos.right;
            rect.appendChild(dot);
        });

        // 提示文字
        const hint = document.createElement('div');
        hint.style.cssText = 'position:absolute;top:24px;left:50%;transform:translateX(-50%);pointer-events:none;';
        hint.innerHTML = `<div style="padding:8px 16px;background:rgba(15,23,42,0.9);backdrop-filter:blur(8px);color:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.3);display:flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,0.1);">
            <span style="color:#818cf8;">✂</span>
            <span style="font-size:11px;font-weight:700;">拖拽选择截屏区域</span>
            <span style="font-size:9px;color:#94a3b8;">| Esc 取消</span>
        </div>`;
        overlay.appendChild(hint);
        hintRef.current = hint;

        // 事件绑定
        overlay.addEventListener('mousedown', handleOverlayMouseDown);
        overlay.addEventListener('mousemove', handleOverlayMouseMove);
        overlay.addEventListener('mouseup', handleOverlayMouseUp);

        document.body.appendChild(overlay);
        overlayRef.current = overlay;
    }, []);

    // 销毁叠层
    const destroyOverlay = useCallback(() => {
        if (overlayRef.current) {
            overlayRef.current.removeEventListener('mousedown', handleOverlayMouseDown);
            overlayRef.current.removeEventListener('mousemove', handleOverlayMouseMove);
            overlayRef.current.removeEventListener('mouseup', handleOverlayMouseUp);
            overlayRef.current.remove();
            overlayRef.current = null;
        }
        rectRef.current = null;
        maskRef.current = null;
        labelRef.current = null;
        hintRef.current = null;
        startRef.current = null;
        isDraggingRef.current = false;
    }, []);

    // —— 原生事件处理器（零 React 渲染） ——

    const handleOverlayMouseDown = useCallback((e: MouseEvent) => {
        e.preventDefault();
        startRef.current = { x: e.clientX, y: e.clientY };
        isDraggingRef.current = true;
        if (rectRef.current) rectRef.current.style.display = 'block';
        if (hintRef.current) hintRef.current.style.display = 'none';
    }, []);

    const handleOverlayMouseMove = useCallback((e: MouseEvent) => {
        if (!isDraggingRef.current || !startRef.current || !rectRef.current || !maskRef.current || !labelRef.current) return;

        const sx = startRef.current.x, sy = startRef.current.y;
        const ex = e.clientX, ey = e.clientY;
        const x = Math.min(sx, ex), y = Math.min(sy, ey);
        const w = Math.abs(ex - sx), h = Math.abs(ey - sy);

        // 直接更新 DOM style
        rectRef.current.style.left = x + 'px';
        rectRef.current.style.top = y + 'px';
        rectRef.current.style.width = w + 'px';
        rectRef.current.style.height = h + 'px';

        labelRef.current.textContent = `${w} × ${h}`;

        // clip-path 挖洞
        maskRef.current.style.clipPath = `polygon(
            0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
            ${x}px ${y}px,
            ${x}px ${y + h}px,
            ${x + w}px ${y + h}px,
            ${x + w}px ${y}px,
            ${x}px ${y}px
        )`;
    }, []);

    const handleOverlayMouseUp = useCallback((e: MouseEvent) => {
        if (!isDraggingRef.current || !startRef.current) return;

        const sx = startRef.current.x, sy = startRef.current.y;
        const ex = e.clientX, ey = e.clientY;
        const x = Math.min(sx, ex), y = Math.min(sy, ey);
        const w = Math.abs(ex - sx), h = Math.abs(ey - sy);

        // 先销毁叠层
        destroyOverlay();
        setIsSelecting(false);

        // 选区太小则忽略
        if (w < 10 || h < 10) return;

        // 等两帧确保叠层已从 DOM 移除
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                performCapture({ x, y, w, h });
            });
        });
    }, []);

    // 执行截图 —— 使用 Electron 原生 capturePage API（毫秒级）
    const performCapture = useCallback(async (rect: { x: number; y: number; w: number; h: number }) => {
        try {
            const electron = (window as any).electron;

            // 检查是否在 Electron 环境中
            if (!electron?.capturePage) {
                // Fallback: 非 Electron 环境下使用 Canvas 方案
                showToast?.({ message: '截屏功能仅在桌面应用中可用', type: 'warning' });
                return;
            }

            // 获取设备像素比用于坐标换算
            const dpr = window.devicePixelRatio || 1;

            // 调用 Electron 原生截屏（整页截取，速度极快）
            const base64Data = await electron.capturePage();

            if (!base64Data) {
                showToast?.({ message: '截屏失败', type: 'error' });
                return;
            }

            // 闪光效果
            setFlashVisible(true);
            setTimeout(() => setFlashVisible(false), 250);

            // 将 base64 转为 Image 用于裁剪
            const img = new Image();
            img.src = `data:image/png;base64,${base64Data}`;
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = reject;
            });

            // 在 Canvas 上裁剪选区（capturePage 返回的图片已经是设备像素分辨率）
            const canvas = document.createElement('canvas');
            canvas.width = rect.w * dpr;
            canvas.height = rect.h * dpr;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(
                img,
                rect.x * dpr, rect.y * dpr, rect.w * dpr, rect.h * dpr,
                0, 0, rect.w * dpr, rect.h * dpr
            );

            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) {
                showToast?.({ message: '截屏裁剪失败', type: 'error' });
                return;
            }

            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            showToast?.({ message: `📸 区域截屏已复制 (${rect.w}×${rect.h})`, type: 'success' });
        } catch (err) {
            console.error('Screenshot failed:', err);
            showToast?.({ message: '截屏复制失败，请检查浏览器权限', type: 'error' });
        }
    }, [showToast]);

    // 进入截图模式
    const enterScreenshotMode = useCallback(() => {
        if (isSelecting) return;
        setIsSelecting(true);
        createOverlay();
    }, [isSelecting, createOverlay]);

    // 取消
    const cancelScreenshot = useCallback(() => {
        destroyOverlay();
        setIsSelecting(false);
    }, [destroyOverlay]);

    // 全局快捷键
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && overlayRef.current) {
                e.preventDefault();
                cancelScreenshot();
                return;
            }
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                e.stopPropagation();
                enterScreenshotMode();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [enterScreenshotMode, cancelScreenshot]);

    // 组件卸载时清理
    useEffect(() => {
        return () => destroyOverlay();
    }, [destroyOverlay]);

    return { isSelecting, flashVisible };
};
