import { useMemo, useEffect, useRef, useCallback } from 'react';
import { useAsyncStorage } from './useAsyncStorage';
import { MOCK_PROJECTS, MOCK_LITERATURE, MOCK_INVENTORY } from '../constants';
import { ResearchProject, Literature, InventoryItem, SearchResult } from '../types';
import { sanitizeProjects } from '../services/dataSanitizer';
import { vault } from '../services/persistence';

const AUTO_BACKUP_INTERVAL = 10 * 60 * 1000; // 10 分钟

export const useProjectPersistence = (searchQuery: string) => {
  const [rawProjects, setRawProjects, isProjectsLoaded] = useAsyncStorage<ResearchProject[]>('projects', MOCK_PROJECTS.map(p => ({
    ...p,
    weeklyPlans: p.weeklyPlans?.map(wp => ({
      ...wp,
      periodStatus: wp.periodStatus || (wp as any).dailyStatus || Array(wp.type === 'weekly' ? 7 : wp.type === 'monthly' ? 4 : 12).fill('idle')
    }))
  })));

  const [resources, setResources, isResourcesLoaded] = useAsyncStorage<Literature[]>('resources', MOCK_LITERATURE);
  const [inventory, setInventory, isInventoryLoaded] = useAsyncStorage<InventoryItem[]>('inventory', MOCK_INVENTORY);

  // ✅ Hydration 后自动清洗：确保从 IndexedDB 加载的数据结构完整
  const projects = useMemo(() => {
    if (!isProjectsLoaded) return rawProjects;
    return sanitizeProjects(rawProjects);
  }, [rawProjects, isProjectsLoaded]);

  // ✅ 安全写入包装：防止意外写入空数据覆盖有效数据
  const prevProjectCountRef = useRef(0);
  useEffect(() => {
    if (isProjectsLoaded && projects.length > 0) {
      prevProjectCountRef.current = projects.length;
    }
  }, [projects, isProjectsLoaded]);

  const setProjects = useCallback((action: React.SetStateAction<ResearchProject[]>) => {
    setRawProjects(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      // ✅ 空数据退化保护：如果之前有数据但新数据为空，拒绝写入
      if (prevProjectCountRef.current > 0 && (!next || next.length === 0)) {
        console.warn('[DataGuard] 拒绝写入空 projects 数组，当前已有', prevProjectCountRef.current, '个项目');
        return prev;
      }
      return next;
    });
  }, [setRawProjects]);

  // ✅ 定时自动备份（每 10 分钟）
  useEffect(() => {
    if (!isProjectsLoaded || projects.length === 0) return;

    const timer = setInterval(async () => {
      try {
        await vault.createBackup('projects', 'auto_periodic');
        console.log('[DataGuard] 定时自动备份完成');
      } catch (e) {
        console.warn('[DataGuard] 定时备份失败:', e);
      }
    }, AUTO_BACKUP_INTERVAL);

    // 首次加载后立即备份一次
    vault.createBackup('projects', 'app_startup').catch(() => { });

    return () => clearInterval(timer);
  }, [isProjectsLoaded, projects.length > 0]); // 仅在加载完成且有数据时启动

  const isStorageReady = isProjectsLoaded && isResourcesLoaded && isInventoryLoaded;

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2 || !isStorageReady) return [];
    const q = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    (resources || []).forEach(res => {
      if (res.title.toLowerCase().includes(q) || (res.abstract && res.abstract.toLowerCase().includes(q))) {
        results.push({
          type: 'literature',
          id: res.id,
          title: res.title,
          content: res.abstract || '',
          metadata: { authors: res.authors, year: res.year }
        });
      }
    });

    (inventory || []).forEach(item => {
      if (item.name.toLowerCase().includes(q) || item.formula?.toLowerCase().includes(q)) {
        results.push({
          type: 'inventory',
          id: item.id,
          title: item.name,
          content: `${item.formula || ''} | 存量: ${item.quantity}${item.unit} | 位置: ${item.location}`,
          metadata: { safety: item.safetyLevel }
        });
      }
    });

    (projects || []).forEach(proj => {
      (proj.milestones || []).forEach(ms => {
        (ms.logs || []).forEach(log => {
          const logText = (log.content + " " + (log.description || "") + " " + (log.parameters || "")).toLowerCase();
          if (logText.includes(q)) {
            results.push({
              type: 'log',
              id: log.id,
              title: log.content,
              content: log.description || log.parameters || '',
              projectTitle: proj.title,
              isFailure: log.result === 'failure',
              metadata: { timestamp: log.timestamp, parameters: log.parameters }
            });
          }
        });
      });

      (proj.weeklyReports || []).forEach(rep => {
        if (rep.title.toLowerCase().includes(q) || (rep.content && rep.content.toLowerCase().includes(q))) {
          results.push({
            type: 'report',
            id: rep.id,
            title: rep.title,
            content: rep.content,
            projectTitle: proj.title,
            metadata: { timestamp: rep.timestamp }
          });
        }
      });
    });

    return results;
  }, [searchQuery, projects, resources, inventory, isStorageReady]);

  return {
    projects, setProjects,
    resources, setResources,
    inventory, setInventory,
    searchResults,
    isStorageReady
  };
};
