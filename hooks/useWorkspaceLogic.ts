import { useState, useCallback, useMemo } from 'react';
import { useProjectContext } from '../context/ProjectContext';
import {
  WorkspaceState, WorkbookItem, GraphItem,
  createDefaultWorkspace, createDefaultGraphConfig
} from '../types/workspace';
import { createDefaultSpreadsheet } from '../types/spreadsheet';

/**
 * Origin 风格工作区管理钩子
 * 管理多工作表和多图表，支持创建/删除/重命名/切换
 */
export const useWorkspaceLogic = () => {
  const { dataAnalysisSession, updateDataAnalysisSession } = useProjectContext();

  // 从 session 获取 workspace，若为空则创建默认工作区并自动迁移旧数据
  const workspace: WorkspaceState = useMemo(() => {
    if (dataAnalysisSession?.workspace) {
      return dataAnalysisSession.workspace;
    }
    // 自动迁移：将旧 session 的单个数据视为默认项
    const ws = createDefaultWorkspace();
    if (dataAnalysisSession?.seriesList?.length > 0) {
      ws.graphs[0].config.seriesList = dataAnalysisSession.seriesList;
      ws.graphs[0].config.chartTitle = dataAnalysisSession.chartTitle || '';
      ws.graphs[0].config.chartType = dataAnalysisSession.chartType || 'scatter';
      ws.graphs[0].config.mainColor = dataAnalysisSession.mainColor || '#6366f1';
    }
    if (dataAnalysisSession?.spreadsheet) {
      ws.workbooks[0].spreadsheet = dataAnalysisSession.spreadsheet;
    }
    return ws;
  }, [dataAnalysisSession]);

  const updateWorkspace = useCallback((updater: (ws: WorkspaceState) => WorkspaceState) => {
    updateDataAnalysisSession((prev: any) => ({
      workspace: updater(prev.workspace ?? createDefaultWorkspace()),
    }));
  }, [updateDataAnalysisSession]);

  // ── 项目操作 ──
  const addWorkbook = useCallback((name?: string) => {
    updateWorkspace(ws => {
      const id = `wb_${Date.now()}`;
      const newWb: WorkbookItem = {
        id,
        name: name || `Book${ws.workbooks.length + 1}`,
        spreadsheet: createDefaultSpreadsheet(3, 20),
      };
      return {
        ...ws,
        workbooks: [...ws.workbooks, newWb],
        openTabs: [...ws.openTabs, id],
        activeItemId: id,
      };
    });
  }, [updateWorkspace]);

  const addGraph = useCallback((name?: string) => {
    updateWorkspace(ws => {
      const id = `gr_${Date.now()}`;
      const newGr: GraphItem = {
        id,
        name: name || `Graph${ws.graphs.length + 1}`,
        config: {
          ...createDefaultGraphConfig(),
          sourceWorkbookId: ws.workbooks[0]?.id,
        },
      };
      return {
        ...ws,
        graphs: [...ws.graphs, newGr],
        openTabs: [...ws.openTabs, id],
        activeItemId: id,
      };
    });
  }, [updateWorkspace]);

  const removeItem = useCallback((id: string) => {
    updateWorkspace(ws => {
      const isWb = ws.workbooks.some(w => w.id === id);
      const isGr = ws.graphs.some(g => g.id === id);
      // 不允许删除最后一个工作表或最后一个图表
      if (isWb && ws.workbooks.length <= 1) return ws;
      if (isGr && ws.graphs.length <= 1) return ws;

      const newWbs = isWb ? ws.workbooks.filter(w => w.id !== id) : ws.workbooks;
      const newGrs = isGr ? ws.graphs.filter(g => g.id !== id) : ws.graphs;
      const newTabs = ws.openTabs.filter(t => t !== id);
      const newActive = ws.activeItemId === id
        ? (newTabs[newTabs.length - 1] || newWbs[0]?.id || newGrs[0]?.id)
        : ws.activeItemId;

      return { ...ws, workbooks: newWbs, graphs: newGrs, openTabs: newTabs, activeItemId: newActive };
    });
  }, [updateWorkspace]);

  const renameItem = useCallback((id: string, newName: string) => {
    updateWorkspace(ws => ({
      ...ws,
      workbooks: ws.workbooks.map(w => w.id === id ? { ...w, name: newName } : w),
      graphs: ws.graphs.map(g => g.id === id ? { ...g, name: newName } : g),
    }));
  }, [updateWorkspace]);

  const setActiveItem = useCallback((id: string) => {
    updateWorkspace(ws => {
      const openTabs = ws.openTabs.includes(id) ? ws.openTabs : [...ws.openTabs, id];
      return { ...ws, activeItemId: id, openTabs };
    });
  }, [updateWorkspace]);

  const closeTab = useCallback((id: string) => {
    updateWorkspace(ws => {
      const newTabs = ws.openTabs.filter(t => t !== id);
      if (newTabs.length === 0) return ws; // 至少保留一个标签
      const newActive = ws.activeItemId === id
        ? newTabs[newTabs.length - 1]
        : ws.activeItemId;
      return { ...ws, openTabs: newTabs, activeItemId: newActive };
    });
  }, [updateWorkspace]);

  // ── 更新工作表内容 ──
  const updateWorkbook = useCallback((id: string, updates: Partial<WorkbookItem>) => {
    updateWorkspace(ws => ({
      ...ws,
      workbooks: ws.workbooks.map(w => w.id === id ? { ...w, ...updates } : w),
    }));
  }, [updateWorkspace]);

  // ── 更新图表配置 ──
  const updateGraph = useCallback((id: string, updates: Partial<GraphItem['config']>) => {
    updateWorkspace(ws => ({
      ...ws,
      graphs: ws.graphs.map(g => g.id === id ? { ...g, config: { ...g.config, ...updates } } : g),
    }));
  }, [updateWorkspace]);

  // ── 当前活跃项信息 ──
  const activeItem = useMemo(() => {
    const wb = workspace.workbooks.find(w => w.id === workspace.activeItemId);
    if (wb) return { type: 'workbook' as const, item: wb };
    const gr = workspace.graphs.find(g => g.id === workspace.activeItemId);
    if (gr) return { type: 'graph' as const, item: gr };
    // fallback
    return { type: 'workbook' as const, item: workspace.workbooks[0] };
  }, [workspace]);

  // 当前图表关联的工作表数据
  const activeGraphSourceData = useMemo(() => {
    if (activeItem.type !== 'graph') return null;
    const graph = activeItem.item as GraphItem;
    const srcId = graph.config.sourceWorkbookId;
    return workspace.workbooks.find(w => w.id === srcId) ?? workspace.workbooks[0] ?? null;
  }, [activeItem, workspace.workbooks]);

  return {
    workspace,
    activeItem,
    activeGraphSourceData,

    addWorkbook, addGraph,
    removeItem, renameItem,
    setActiveItem, closeTab,
    updateWorkbook, updateGraph,
  };
};
