/**
 * useDataAnalysisHistory.ts
 * ─────────────────────────────────────────────────────────────────
 * 实验数据分析室 — Undo / Redo 历史管理 Hook
 *
 * 基于 useRef 栈 + useState 计数触发 UI 重渲染，
 * 与 useSankeyDesigner / useClassificationTree 采用相同模式。
 *
 * 特点：
 *  - 300ms 防抖快照，避免滑块/拖拽等高频操作导致栈膨胀
 *  - 元数据字段（savedCharts / chartFolders 等）不参与 undo 快照
 */

import { useRef, useState, useCallback } from 'react';
import { DataAnalysisSession } from '../types';

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 300;

/** 从 session 中剥离不应参与 undo/redo 的元数据字段 */
function stripMeta(session: DataAnalysisSession): Partial<DataAnalysisSession> {
  const copy = { ...session };
  delete (copy as any).savedCharts;
  delete (copy as any).chartFolders;
  delete (copy as any).currentSavedChartId;
  delete (copy as any).currentSavedChartName;
  return copy;
}

export const useDataAnalysisHistory = () => {
  const undoStackRef = useRef<Partial<DataAnalysisSession>[]>([]);
  const redoStackRef = useRef<Partial<DataAnalysisSession>[]>([]);
  const [historySize, setHistorySize] = useState({ undo: 0, redo: 0 });
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnapshotRef = useRef<string>('');
  /** 标记当前变更来自 undo/redo 操作，不应再入栈 */
  const isUndoingRef = useRef(false);

  const syncHistorySize = useCallback(() => {
    setHistorySize({ undo: undoStackRef.current.length, redo: redoStackRef.current.length });
  }, []);

  /**
   * 推入快照（防抖）。
   * 应在 updateDataAnalysisSession 时调用，传入变更前的 session。
   */
  const pushSnapshot = useCallback((prevSession: DataAnalysisSession) => {
    // undo/redo 触发的变更不再入栈
    if (isUndoingRef.current) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      const stripped = stripMeta(prevSession);
      const snapshot = JSON.stringify(stripped);
      // 如果和上一次快照完全一致，跳过
      if (snapshot === lastSnapshotRef.current) return;
      lastSnapshotRef.current = snapshot;

      undoStackRef.current = [stripped, ...undoStackRef.current].slice(0, MAX_HISTORY);
      redoStackRef.current = [];
      syncHistorySize();
    }, DEBOUNCE_MS);
  }, [syncHistorySize]);

  const canUndo = historySize.undo > 0;
  const canRedo = historySize.redo > 0;

  /**
   * 执行撤销。返回要恢复的 session 快照（不含元数据），
   * 由调用方负责 merge 回完整 session。
   */
  const undo = useCallback((): Partial<DataAnalysisSession> | null => {
    if (undoStackRef.current.length === 0) return null;
    // 立即刷新防抖计时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const [top, ...rest] = undoStackRef.current;
    undoStackRef.current = rest;
    // 当前状态需要在调用方提供
    return top;
  }, []);

  /**
   * 执行重做。返回要恢复的 session 快照。
   */
  const redo = useCallback((): Partial<DataAnalysisSession> | null => {
    if (redoStackRef.current.length === 0) return null;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const [top, ...rest] = redoStackRef.current;
    redoStackRef.current = rest;
    return top;
  }, []);

  /**
   * 将"当前状态"推入 redo 栈（undo 时调用）。
   */
  const pushToRedo = useCallback((current: DataAnalysisSession) => {
    const stripped = stripMeta(current);
    redoStackRef.current = [stripped, ...redoStackRef.current].slice(0, MAX_HISTORY);
    syncHistorySize();
  }, [syncHistorySize]);

  /**
   * 将"当前状态"推入 undo 栈（redo 时调用）。
   */
  const pushToUndo = useCallback((current: DataAnalysisSession) => {
    const stripped = stripMeta(current);
    undoStackRef.current = [stripped, ...undoStackRef.current].slice(0, MAX_HISTORY);
    syncHistorySize();
  }, [syncHistorySize]);

  return {
    pushSnapshot,
    undo, redo,
    pushToRedo, pushToUndo,
    canUndo, canRedo,
    isUndoingRef,
    syncHistorySize,
  };
};
