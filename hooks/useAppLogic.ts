import { useState, useEffect, useMemo, useRef } from 'react';
import { AppView } from '../types';
import { useProjectContext } from '../context/ProjectContextCore';

export const useAppLogic = () => {
  const {
    setProjects,
    setActiveTheme,
    activeTheme,
    modals,
    setModalOpen,
    projects,
    setAppSettings,
    setReturnPath,
    navigate
  } = useProjectContext();
  const [hash, setHash] = useState(window.location.hash);
  const [history, setHistory] = useState<{ path: string; label: string; count: number; isPinned: boolean }[]>(() => {
    const saved = localStorage.getItem('sciflow_nav_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [dwellProgress, setDwellProgress] = useState(0);

  // 持久化历史记录
  useEffect(() => {
    localStorage.setItem('sciflow_nav_history', JSON.stringify(history));
  }, [history]);

  // 使用 Ref 保持最新的 projects，避免定时器因依赖更新而重置
  const projectsRef = useRef(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  // 路由同步与历史记录
  // 使用 RAF 代替 setInterval 来更新 dwellProgress，减少不必要的状态更新
  useEffect(() => {
    let rafId: number;
    let dwellTimerId: NodeJS.Timeout;
    const duration = 10000; // 10s
    let startTime = Date.now();
    let isCancelled = false;

    const handleHashChange = (e?: HashChangeEvent) => {
      const currentHash = window.location.hash || '#dashboard';

      // 如果正在跳转到项目详情页，用事件的 oldURL 来提取来源 hash，用于返回键
      if (currentHash.startsWith('#project/') && e?.oldURL) {
        const oldHash = '#' + e.oldURL.split('#')[1];
        if (oldHash && !oldHash.startsWith('#project/')) {
          sessionStorage.setItem('sciflow_project_referrer', oldHash);
        }
      }

      setHash(window.location.hash);
      setDwellProgress(0);
      startTime = Date.now();

      // 清除旧的
      cancelAnimationFrame(rafId);
      clearTimeout(dwellTimerId);

      // 使用 RAF 更新进度条（不通过 React setState，仅在需要时更新 DOM）
      const updateProgress = () => {
        if (isCancelled) return;
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / duration) * 100, 100);
        // 通过 DOM 直接更新进度，避免频繁 setState
        const el = document.getElementById('dwell-progress-bar');
        if (el) el.style.width = `${progress}%`;
        if (elapsed < duration) {
          rafId = requestAnimationFrame(updateProgress);
        }
      };
      rafId = requestAnimationFrame(updateProgress);

      // 在 10s 后仅触发一次 setState 来记录历史
      dwellTimerId = setTimeout(() => {
        setDwellProgress(100);

        setHistory(prev => {
          // 如果用户已经离开当前记录的这个时刻的页面，则不记录
          if (window.location.hash && window.location.hash !== currentHash && currentHash !== '#dashboard') return prev;

          // 解析基础的名称
          let label = '未知界面';
          const cleanHash = currentHash.replace('#', '');
          const parts = cleanHash.split('/');

          // ── 模块主名称映射 ──
          const moduleLabels: Record<string, string> = {
            dashboard: '研究看板',
            projects: '课题中心',
            team: '团队矩阵',
            research_brain: '中心大脑',
            inception: '战略立项',
            industry_trends: '行业动态',
            market_analysis: '市场分析',
            characterization_hub: '实验表征',
            literature: '情报档案',
            mechanism: '机理推演',
            inventory: '库存管理',
            doe: 'DOE 迭代',
            flowchart: '实验路线',
            data: '数据分析',
            figure_center: '科研绘图',
            video_lab: '视频工坊',
            writing: '写作工坊',
            notebook: '科研笔记',
          };

          // ── 各模块子视图标签映射 ──
          const subViewLabels: Record<string, Record<string, string>> = {
            figure_center: {
              generative: '生成式绘图',
              structural: '结构图',
              timeline: '时间轴',
              summary: '全景信息图',
              tree: '分类树',
              sankey: '桑基图',
              assembly: '组装排版',
              audit: '发表审查',
            },
            writing: {
              standard: '标准模式',
              publishing: '出版预览',
            },
            data: {
              chart: '图表绘制',
              regression: '回归分析',
              statistics: '描述统计',
            },
            team: {
              grid: '成员网格',
              board: '看板视图',
              calendar: '日历视图',
            },
            characterization_hub: {
              xrd: 'XRD 分析',
              sem: 'SEM 分析',
              xps: 'XPS 分析',
              ftir: 'FTIR 分析',
              contact_resistance: '接触电阻表征',
            },
            mechanism: {
              setup: '参数配置',
              result: '仿真结果',
            },
            doe: {
              setup: '实验设计',
              result: '推演结果',
            },
          };

          if (parts[0] === 'project') {
            const projectId = parts[1];
            const sub = parts[2] || 'logs';
            const proj = projectsRef.current.find(p => p.id === projectId);
            const pName = proj ? proj.title : '未知课题';

            let subLabel = '详情';
            if (sub === 'logs') subLabel = '记录';
            else if (sub === 'chart') subLabel = '全景图';
            else if (sub === 'reports') subLabel = '报告';
            else if (sub === 'assistant') subLabel = '助理';

            label = `课题: ${pName} · ${subLabel}`;
          } else {
            // 基础模块名称
            label = moduleLabels[parts[0]] || parts[0];

            // 附加子视图名称（从 hash 的第二或第三段解析）
            // 格式: #module/subView 或 #module/projectId/subView
            const subMap = subViewLabels[parts[0]];
            if (subMap) {
              // 尝试第二段和第三段匹配子视图
              const sub = parts[2] || parts[1];
              if (sub && subMap[sub]) {
                label += ` · ${subMap[sub]}`;
              }
            }
          }

          const existing = prev.find(h => h.path === currentHash);
          const count = (existing?.count || 0) + 1;
          const isPinned = existing?.isPinned || false;
          const filtered = prev.filter(h => h.path !== currentHash);
          return [{ path: currentHash, label, count, isPinned }, ...filtered].slice(0, 10);
        });
      }, duration);
    };

    // 初始化执行一次
    setTimeout(() => handleHashChange(), 100);

    window.addEventListener('hashchange', handleHashChange as EventListener);
    return () => {
      isCancelled = true;
      cancelAnimationFrame(rafId);
      clearTimeout(dwellTimerId);
      window.removeEventListener('hashchange', handleHashChange as EventListener);
    };
  }, []); // 移除 projects 依赖，防止定时器重置

  const togglePin = (path: string) => {
    setHistory(prev => prev.map(h => h.path === path ? { ...h, isPinned: !h.isPinned } : h));
  };

  const route = useMemo(() => {
    const cleanHash = hash.replace('#', '');
    if (!cleanHash) return { view: 'dashboard' as AppView, projectId: null, subView: null };
    const parts = cleanHash.split('/');
    if (parts[0] === 'project') return { view: 'project_detail' as AppView, projectId: parts[1], subView: parts[2] || 'logs' };
    if (parts[0] === 'literature') return { view: 'literature' as AppView, projectId: parts[1] || null, subView: parts[2] || null };
    if (parts[0] === 'writing') return { view: 'writing' as AppView, projectId: parts[1] || null, subView: parts[2] || null };
    if (parts[0] === 'team') return { view: 'team' as AppView, projectId: null, subView: parts[1] || 'grid' };
    if (parts[0] === 'characterization_hub') return { view: 'characterization_hub' as AppView, projectId: parts[1] || null, subView: parts[2] || null };
    if (parts[0] === 'doe') return { view: 'doe' as AppView, projectId: parts[1] || null, subView: parts[2] || parts[1] || null };

    return { view: parts[0] as AppView, projectId: null, subView: null };
  }, [hash]);

  // 课题删除逻辑
  const confirmDelete = (id: string) => {
    setModalOpen('confirm', {
      show: true,
      title: '确认删除课题库？',
      desc: '此操作将永久移除所有实验记录与拓扑节点，无法恢复。',
      onConfirm: () => {
        setProjects(prev => prev.filter(p => p.id !== id));
        setModalOpen('confirm', null);
      }
    });
  };

  // 主题副作用同步
  useEffect(() => {
    document.documentElement.style.setProperty('--app-bg', activeTheme.colors.background);
    localStorage.setItem('sciflow_theme', JSON.stringify(activeTheme));
  }, [activeTheme]);

  return {
    route,
    navigate,
    confirmDelete,
    modals,
    setModalOpen,
    activeTheme,
    setActiveTheme,
    history,
    dwellProgress,
    togglePin
  };
};
