/**
 * useLiteratureFigureBridge — 文献图片 ↔ 组图画布 的数据桥接
 *
 * Literature 模块截取图片后写入，FigureAssembly 模块读取并使用。
 * 存储：vault.setKv/getKv（sessions store），即时写入。
 * 同步：CustomEvent + instanceId 去重，避免自身重复接收。
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { vault } from '../services/persistence';

const STORAGE_KEY = 'literatureFigures';
const SYNC_EVENT = 'lit-figures-sync';

/** 从文献 PDF 截取的图片条目 */
export interface LiteratureFigure {
  id: string;
  /** base64 PNG 图片数据 */
  imageData: string;
  /** 来源文献标题 */
  sourceTitle?: string;
  /** 来源页码 */
  sourcePage: number;
  /** 截取时间戳 */
  timestamp: string;
}

/** 直接写入 IndexedDB（无防抖） */
async function saveFigures(figures: LiteratureFigure[]) {
  try {
    await vault.setKv(STORAGE_KEY, figures);
  } catch (e) {
    console.error('[LitFigureBridge] save failed', e);
  }
}

/** 直接从 IndexedDB 读取 */
async function loadFigures(): Promise<LiteratureFigure[]> {
  try {
    const data = await vault.getKv(STORAGE_KEY);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('[LitFigureBridge] load failed', e);
    return [];
  }
}

export function useLiteratureFigureBridge() {
  const [figures, setFigures] = useState<LiteratureFigure[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const figuresRef = useRef<LiteratureFigure[]>([]);
  const instanceId = useRef(Math.random().toString(36).slice(2, 8));

  // 保持 ref 和 state 同步
  useEffect(() => {
    figuresRef.current = figures;
  }, [figures]);

  // ─── 初始化：从 IndexedDB 加载 ──────────────────────
  useEffect(() => {
    loadFigures().then((data) => {
      setFigures(data);
      figuresRef.current = data;
      setIsLoaded(true);
    });
  }, []);

  // ─── 监听其他实例的同步事件 ──────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent;
      // 过滤自身发出的事件，避免重复
      if (ce.detail?.senderId === instanceId.current) return;
      if (Array.isArray(ce.detail?.figures)) {
        setFigures(ce.detail.figures);
        figuresRef.current = ce.detail.figures;
      }
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, []);

  /** 通知其他实例（排除自身） */
  const broadcast = useCallback((figs: LiteratureFigure[]) => {
    window.dispatchEvent(
      new CustomEvent(SYNC_EVENT, {
        detail: { senderId: instanceId.current, figures: figs },
      })
    );
  }, []);

  /** 添加一张从文献截取的图片 */
  const addFigure = useCallback(
    (imageData: string, meta: { sourceTitle?: string; sourcePage: number }) => {
      const newFigure: LiteratureFigure = {
        id: `litfig_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        imageData,
        sourceTitle: meta.sourceTitle,
        sourcePage: meta.sourcePage,
        timestamp: new Date().toLocaleString(),
      };

      // 基于 ref 计算新数组（避免 updater 内副作用被 StrictMode 双重调用）
      const next = [newFigure, ...figuresRef.current];
      figuresRef.current = next;
      setFigures(next);
      saveFigures(next);
      broadcast(next);

      return newFigure;
    },
    [broadcast]
  );

  /** 移除一张图片 */
  const removeFigure = useCallback(
    (id: string) => {
      const next = figuresRef.current.filter((f) => f.id !== id);
      figuresRef.current = next;
      setFigures(next);
      saveFigures(next);
      broadcast(next);
    },
    [broadcast]
  );

  /** 清空所有文献图片 */
  const clearAll = useCallback(() => {
    figuresRef.current = [];
    setFigures([]);
    saveFigures([]);
    broadcast([]);
  }, [broadcast]);

  return { figures, addFigure, removeFigure, clearAll, isLoaded };
}
