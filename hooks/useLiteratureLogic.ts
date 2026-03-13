import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ResearchProject,
  Literature as LiteratureType,
  ResourceType,
  TransformationProposal,
  MatrixReport,
  AiTask
} from '../types';
import {
  smartResourceSearch,
  summarizeResourcesToTable,
  parseResourceFile,
  SearchFilters,
  SearchField,
  parseBibTeXAI,
  extractKnowledgeSinkAI,
  enrichLiteratureFromSearch
} from '../services/gemini';
import { useProjectContext } from '../context/ProjectContext';

export type SortOption = 'default' | 'year_desc' | 'year_asc' | 'title_asc' | 'title_desc' | 'author_asc';

const DEFAULT_CATEGORIES = ['核心理论', '工艺标准', '性能标杆', '专利检索'];

interface UseLiteratureLogicProps {
  resources: LiteratureType[];
  projects: ResearchProject[];
  onAddResources: (newResources: LiteratureType[]) => void;
  onUpdateProject: (project: ResearchProject) => void;
  onUpdateResource?: (resource: LiteratureType) => void;
  activeTasks: AiTask[];
  onStartTransformation: (lit: LiteratureType) => Promise<string | null>;
  initialProjectId?: string;
  initialResourceId?: string;
  onSetAiStatus?: (status: string | null) => void;
}

export const useLiteratureLogic = ({
  resources,
  projects,
  onAddResources,
  onUpdateProject,
  onUpdateResource,
  activeTasks,
  onStartTransformation,
  initialProjectId,
  initialResourceId,
  onSetAiStatus
}: UseLiteratureLogicProps) => {
  const { startGlobalTask, showToast } = useProjectContext();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(initialProjectId || null);
  const [activeType, setActiveType] = useState<ResourceType>('文献');
  const [viewMode, setViewMode] = useState<'list' | 'reports' | 'proposals' | 'benchmarking'>('list');

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('default');

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiSearchKeywords, setAiSearchKeywords] = useState('');
  const [searchField, setSearchField] = useState<SearchField>('topic');

  // Search Preview Modal State
  const [showSearchPreview, setShowSearchPreview] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchPreviewResults, setSearchPreviewResults] = useState<LiteratureType[]>(() => {
    // 尝试从 sessionStorage 恢复上次检索结果
    try {
      const cached = sessionStorage.getItem('sciflow_search_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.results || [];
      }
    } catch { }
    return [];
  });
  const [cachedSearchMeta, setCachedSearchMeta] = useState<{ field: string; keyword: string; sources: any[] } | null>(() => {
    try {
      const cached = sessionStorage.getItem('sciflow_search_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.meta || null;
      }
    } catch { }
    return null;
  });

  // Track which items are currently being enriched
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());

  // Reference Engine States
  const [showBibTeXModal, setShowBibTeXModal] = useState(false);
  const [isParsingBib, setIsParsingBib] = useState(false);

  // Advanced Filters
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    docType: 'All',
    timeRange: '5y',
    highImpactOnly: true
  });

  const [pathModalConfig, setPathModalConfig] = useState<{ show: boolean, resource: LiteratureType | null }>({ show: false, resource: null });
  const [manualPathInput, setManualPathInput] = useState('');

  // UI Flow State for Rename/Delete
  const [confirmConfig, setConfirmConfig] = useState<{ show: boolean, title: string, desc: string, onConfirm: () => void } | null>(null);
  const [renameConfig, setRenameConfig] = useState<{ show: boolean, title: string, initialValue: string, onConfirm: (val: string) => void } | null>(null);

  // Navigation Source State
  const [isReturnToWriting, setIsReturnToWriting] = useState(false);
  const [isReturnToProject, setIsReturnToProject] = useState(false);
  const [isReturnToMatrix, setIsReturnToMatrix] = useState(false);
  const [isReturnToBrain, setIsReturnToBrain] = useState(false);

  type LocalArchiveEntry = { name: string; path?: string; file?: File };

  // Grounding Verification State
  const [currentSearchSources, setCurrentSearchSources] = useState<{ title: string, uri: string }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

  useEffect(() => {
    setSelectedProjectId(initialProjectId || null);
  }, [initialProjectId]);

  useEffect(() => {
    if (initialResourceId) {
      if (initialResourceId.endsWith('_rb')) {
        setIsReturnToBrain(true);
        setIsReturnToWriting(false);
        setIsReturnToProject(false);
        setIsReturnToMatrix(false);
        const cleanId = initialResourceId.replace('_rb', '');
        const res = resources.find(r => r.id === cleanId);
        if (res) {
          setSelectedItemId(cleanId);
          setViewMode('list');
          if (res.type !== activeType) setActiveType(res.type);
        }
      } else if (initialResourceId.endsWith('_rw')) {
        setIsReturnToWriting(true);
        setIsReturnToProject(false);
        setIsReturnToBrain(false);
        const cleanId = initialResourceId.replace('_rw', '');
        const res = resources.find(r => r.id === cleanId);
        if (res) {
          setSelectedItemId(cleanId);
          setViewMode('list');
          if (res.type !== activeType) setActiveType(res.type);
        }
      } else if (initialResourceId.endsWith('_rp')) {
        setIsReturnToProject(true);
        setIsReturnToWriting(false);
        setIsReturnToMatrix(false);
        setIsReturnToBrain(false);
        const cleanId = initialResourceId.replace('_rp', '');
        const res = resources.find(r => r.id === cleanId);
        if (res) {
          setSelectedItemId(cleanId);
          setViewMode('list');
          if (res.type !== activeType) setActiveType(res.type);
        }
      } else if (initialResourceId.endsWith('_rm')) {
        setIsReturnToMatrix(true);
        setIsReturnToProject(false);
        setIsReturnToWriting(false);
        setIsReturnToBrain(false);
        const cleanId = initialResourceId.replace('_rm', '');
        const res = resources.find(r => r.id === cleanId);
        if (res) {
          setSelectedItemId(cleanId);
          setViewMode('list');
          if (res.type !== activeType) setActiveType(res.type);
        }
      } else {
        setIsReturnToWriting(false);
        setIsReturnToProject(false);
        setIsReturnToMatrix(false);
        setIsReturnToBrain(false);
        const res = resources.find(r => r.id === initialResourceId);
        if (res) {
          setSelectedItemId(initialResourceId);
          setViewMode('list');
          if (res.type !== activeType) setActiveType(res.type);
        }
      }
    } else {
      setIsReturnToWriting(false);
      setIsReturnToProject(false);
      setIsReturnToMatrix(false);
      setIsReturnToBrain(false);
    }
  }, [initialResourceId, resources]);

  const isGlobalSearching = useMemo(() =>
    activeTasks.some(t => t.type === 'writing_assist' && t.status === 'running'),
    [activeTasks]);

  useEffect(() => {
    if (onSetAiStatus) {
      onSetAiStatus(isGlobalSearching || isSummarizing ? '🔍 全网真实情报检索并翻译中...' : null);
    }
  }, [isGlobalSearching, isSummarizing, onSetAiStatus]);

  const projectResources = useMemo(() =>
    resources.filter(r => r && r.projectId === selectedProjectId && r.type === activeType),
    [resources, selectedProjectId, activeType]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    projectResources.forEach(r => r.tags?.forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [projectResources]);

  // 合并默认分类 + 项目自定义分类
  const allCategories = useMemo(() => {
    const custom = selectedProject?.customCategories || [];
    return [...DEFAULT_CATEGORIES, ...custom.filter(c => !DEFAULT_CATEGORIES.includes(c))];
  }, [selectedProject?.customCategories]);

  const handleAddCategory = (name: string) => {
    if (!selectedProject || !name.trim()) return;
    const existing = selectedProject.customCategories || [];
    if (existing.includes(name.trim()) || DEFAULT_CATEGORIES.includes(name.trim())) {
      showToast({ message: '该分类已存在', type: 'error' });
      return;
    }
    onUpdateProject({ ...selectedProject, customCategories: [...existing, name.trim()] });
    showToast({ message: `分类「${name.trim()}」已添加`, type: 'success' });
  };

  const handleRemoveCategory = (name: string) => {
    if (!selectedProject) return;
    const existing = selectedProject.customCategories || [];
    onUpdateProject({ ...selectedProject, customCategories: existing.filter(c => c !== name) });
    if (selectedCategory === name) setSelectedCategory(null);
    showToast({ message: `分类「${name}」已移除`, type: 'info' });
  };

  const filteredResources = useMemo(() => {
    const q = localSearchQuery.toLowerCase();
    const filtered = projectResources.filter(r => {
      // 多字段搜索：标题、英文标题、摘要、作者、DOI、标签
      const matchSearch = !q || [
        r.title, r.englishTitle, r.abstract, r.doi,
        ...(r.authors || []), ...(r.tags || [])
      ].some(field => (field || '').toLowerCase().includes(q));
      const matchCategory = selectedCategory ? (r.categories?.includes(selectedCategory) || r.category === selectedCategory) : true;
      const matchTag = selectedTag ? r.tags?.includes(selectedTag) : true;
      return matchSearch && matchCategory && matchTag;
    });

    // 多维排序：先按置顶分组，组内按选择的维度排序
    return filtered.sort((a, b) => {
      // 置顶始终优先
      const pinDiff = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if (pinDiff !== 0) return pinDiff;

      switch (sortBy) {
        case 'year_desc': return (b.year || 0) - (a.year || 0);
        case 'year_asc': return (a.year || 0) - (b.year || 0);
        case 'title_asc': return (a.title || '').localeCompare(b.title || '', 'zh');
        case 'title_desc': return (b.title || '').localeCompare(a.title || '', 'zh');
        case 'author_asc': return ((a.authors?.[0]) || '').localeCompare((b.authors?.[0]) || '', 'zh');
        default: return 0; // 保持导入顺序
      }
    });
  }, [projectResources, localSearchQuery, selectedCategory, selectedTag, sortBy]);

  const selectedItem = useMemo(() =>
    resources.find(r => r.id === selectedItemId),
    [resources, selectedItemId]);

  const isGeneratingThisItem = useMemo(() =>
    activeTasks.some(t => t.id === `trans_${selectedItemId}` && t.status === 'running'),
    [activeTasks, selectedItemId]);

  useEffect(() => {
    if (selectedProject) setAiSearchKeywords(selectedProject.keywords?.join(', ') || selectedProject.title);
  }, [selectedProjectId, selectedProject]);

  const handleTriggerTransformation = async () => {
    if (!selectedItem || !selectedProject || isGeneratingThisItem) return;
    try {
      const newId = await onStartTransformation(selectedItem);
      if (newId) setSelectedProposalId(newId);
      setViewMode('proposals');
    } catch (e) { console.error(e); }
  };

  const handleKnowledgeSink = async (litId: string) => {
    const lit = resources.find(r => r.id === litId);
    if (!lit || !onUpdateResource) return;

    await startGlobalTask({
      id: `sink_${litId}`,
      type: 'diagnose',
      status: 'running',
      title: '执行深度知识沉淀...'
    }, async () => {
      try {
        const result = await extractKnowledgeSinkAI(lit);
        onUpdateResource({
          ...lit,
          performance: result.performance || lit.performance,
          synthesisSteps: result.synthesisSteps || lit.synthesisSteps,
          extractedTables: result.extractedTables,
          knowledgeSinked: true
        });
        showToast({ message: '文献知识已结构化并存入对标库', type: 'success' });
      } catch (e) {
        showToast({ message: '知识提取失败', type: 'error' });
      }
    });
  };

  const handleImportBibTeX = async (raw: string) => {
    if (!selectedProjectId || !raw.trim()) return;
    setIsParsingBib(true);
    try {
      const parsed = await parseBibTeXAI(raw);
      if (parsed && parsed.length > 0) {
        const newResources: LiteratureType[] = parsed.map((p: any) => ({
          ...p,
          id: `bib_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          projectId: selectedProjectId,
          type: activeType,
          tags: ['BibTeX Import', ...(p.category ? [p.category] : [])]
        }));
        onAddResources(newResources);
        setShowBibTeXModal(false);
        showToast({ message: `成功导入 ${newResources.length} 篇文献`, type: 'success' });
      }
    } catch (e) {
      showToast({ message: 'BibTeX 解析失败', type: 'error' });
    } finally {
      setIsParsingBib(false);
    }
  };

  const handleCompareAnalysis = async () => {
    if (filteredResources.length < 2) return;
    setIsSummarizing(true);
    try {
      const result = await summarizeResourcesToTable(filteredResources, activeType);
      if (selectedProject && result) {
        const newReport: MatrixReport = {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleString(),
          type: activeType,
          title: `情报对比矩阵 - ${activeType} 综合分析`,
          content: '见下方表格',
          reportType: 'Manual',
          comparisonTable: result.comparisonTable,
          insights: result.insights
        };
        onUpdateProject({ ...selectedProject, savedReports: [newReport, ...(selectedProject.savedReports || [])] });
        setSelectedReportId(newReport.id);
        setViewMode('reports');
      }
    } catch (err) { alert("分析异常"); } finally { setIsSummarizing(false); }
  };

  const handleSearchAndAdd = async () => {
    if (!selectedProject || !aiSearchKeywords.trim()) return;
    // Open the preview modal first, then fire the search
    setSearchPreviewResults([]);
    setCurrentSearchSources([]);
    setShowSearchPreview(true);
    setIsSearchLoading(true);

    // 使用 startGlobalTask 包裹，确保即使离开页面任务也不会中断
    await startGlobalTask({
      id: `search_${Date.now()}`,
      type: 'writing_assist',
      status: 'running',
      title: `正在执行 ${searchField.toUpperCase()} 字段学术检索...`
    }, async () => {
      try {
        const result = await smartResourceSearch(
          aiSearchKeywords.split(',').map(k => k.trim()).filter(Boolean),
          activeType,
          searchFilters,
          searchField
        );

        if (result?.items?.length > 0) {
          const itemsWithId = result.items.map((r: any) => ({
            ...r,
            projectId: selectedProjectId!,
            type: activeType
          }));
          setSearchPreviewResults(itemsWithId);
          if (result.groundingSources) {
            setCurrentSearchSources(result.groundingSources);
          }
          // 缓存到 sessionStorage，离开页面后可恢复
          const meta = { field: searchField, keyword: aiSearchKeywords, sources: result.groundingSources || [] };
          setCachedSearchMeta(meta);
          try {
            sessionStorage.setItem('sciflow_search_cache', JSON.stringify({ results: itemsWithId, meta }));
          } catch { }
        } else {
          showToast({ message: "未探测到符合过滤条件的真实公开情报", type: 'info' });
        }
      } catch (e) {
        console.error(e);
        showToast({ message: "检索系统连接异常", type: 'error' });
        setShowSearchPreview(false);
      } finally {
        setIsSearchLoading(false);
      }
    });
  };

  // 重新打开上次的检索结果
  const handleReopenSearchPreview = () => {
    if (searchPreviewResults.length > 0) {
      if (cachedSearchMeta?.sources) {
        setCurrentSearchSources(cachedSearchMeta.sources);
      }
      setShowSearchPreview(true);
    }
  };

  const handleImportSelected = (selected: LiteratureType[]) => {
    if (selected.length === 0) return;
    onAddResources(selected);
    setShowSearchPreview(false);
    // 不清空搜索结果——保留上次检索记录，用户可随时点"查看上次检索"回去继续选择
    // 结果会在下次新搜索时自动覆盖
    showToast({ message: `成功导入 ${selected.length} 篇文献，正在后台联网提取深度指标...`, type: 'success' });

    // Phase 2: 后台串行深度充实（避免 429 限流）
    if (onUpdateResource) {
      const enrichQueue = [...selected];
      setEnrichingIds(new Set(enrichQueue.map(l => l.id)));

      startGlobalTask({
        id: `enrich_batch_${Date.now()}`,
        type: 'diagnose',
        status: 'running',
        title: `后台深度充实 ${enrichQueue.length} 篇文献...`
      }, async () => {
        let successCount = 0;
        for (const lit of enrichQueue) {
          try {
            const result = await enrichLiteratureFromSearch(lit);
            onUpdateResource({
              ...lit,
              abstract: result.abstract || lit.abstract,
              doi: result.doi || lit.doi || '',
              performance: result.performance || [],
              synthesisSteps: result.synthesisSteps || [],
              tags: [...(lit.tags || []), ...(result.tags || [])].filter((v, i, a) => a.indexOf(v) === i),
              knowledgeSinked: true
            });
            successCount++;
          } catch (e) {
            console.warn(`深度充实失败: ${lit.title}`, e);
          }
          // 从 enrichingIds 中移除已完成的
          setEnrichingIds(prev => {
            const next = new Set(prev);
            next.delete(lit.id);
            return next;
          });
        }
        showToast({ message: `深度充实完成：成功 ${successCount}/${enrichQueue.length} 篇`, type: successCount > 0 ? 'success' : 'error' });
      });
    }
  };

  const importLocalArchives = async (entries: LocalArchiveEntry[]) => {
    if (!selectedProjectId || entries.length === 0) return;
    await startGlobalTask({
      id: `upload_${Date.now()}`,
      type: 'writing_assist',
      status: 'running',
      title: '正在并行解析本地档案...'
    }, async () => {
      try {
        const results: LiteratureType[] = [];
        const BATCH_SIZE = 2;
        for (let i = 0; i < entries.length; i += BATCH_SIZE) {
          const batch = entries.slice(i, i + BATCH_SIZE);
          const batchResults = await Promise.all(batch.map(async (entry) => {
            const fileName = entry.name || entry.file?.name || `archive_${Date.now()}`;
            const filePath = entry.path || (entry.file as any)?.path || '';
            const fileObj = entry.file;
            let payload: any = `File Name: ${fileName}`;

            if (filePath && window.electron?.readFile) {
              const fileData = await window.electron.readFile(filePath);
              if (fileData) payload = fileData;
            } else if (fileObj && (fileObj.type.includes('text') || fileName.endsWith('.txt') || fileName.endsWith('.csv') || fileName.endsWith('.md'))) {
              try { payload = await fileObj.text(); } catch { }
            }

            const aiData: any = await parseResourceFile(payload, activeType);
            return {
              id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
              projectId: selectedProjectId,
              type: activeType,
              title: aiData?.title || fileName.replace(/\.[^/.]+$/, ""),
              englishTitle: aiData?.englishTitle || "",
              authors: aiData?.authors || ['本地上传'],
              year: aiData?.year || new Date().getFullYear(),
              source: aiData?.source || (filePath ? '本地文件系统' : '本地档案'),
              doi: aiData?.doi || "",
              abstract: aiData?.abstract || 'AI 解析完成，已同步关键指标。',
              category: aiData?.category || activeType,
              categories: aiData?.category ? [aiData.category] : [activeType],
              tags: ['本地文件', activeType, ...(aiData?.tags || [])],
              performance: aiData?.performance && aiData.performance.length > 0 ? aiData.performance : [{ label: '解析状态', value: '已深度扫描' }],
              synthesisSteps: aiData?.synthesisSteps && aiData.synthesisSteps.length > 0 ? aiData.synthesisSteps : [{ step: 1, title: '档案入库', content: '文件已成功上传并关联本地路径。' }],
              localPath: filePath
            } as LiteratureType;
          }));
          results.push(...batchResults);
        }

        onAddResources(results);
        showToast({ message: `成功并行导入 ${results.length} 份本地档案`, type: 'success' });
      } catch (err) {
        console.error(err);
        showToast({ message: "解析过程出错，请检查 API 配置", type: 'error' });
      }
    });
  };

  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const entries: LocalArchiveEntry[] = Array.from(files).map((file: any) => ({
      name: file.name,
      path: file.path || '',
      file
    }));
    await importLocalArchives(entries);
    e.target.value = '';
  };

  const handleUploadArchivesClick = async () => {
    if (window.electron?.selectLocalFile) {
      const picked = await window.electron.selectLocalFile({ contextKey: 'literature-import', multiple: true });
      if (!picked || picked.length === 0) return;
      const entries: LocalArchiveEntry[] = picked.map((f) => ({ name: f.name, path: f.path }));
      await importLocalArchives(entries);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleLinkLocalFile = async (item: LiteratureType) => {
    if (window.electron?.selectLocalFile) {
      const file = await window.electron.selectLocalFile('literature-import');
      if (file && onUpdateResource) onUpdateResource({ ...item, localPath: file.path });
    } else {
      setManualPathInput("C:\\Users\\Scientific\\Papers\\Ag-AEM_Study.pdf");
      setPathModalConfig({ show: true, resource: item });
    }
  };

  const handleConfirmManualPath = () => {
    if (pathModalConfig.resource && manualPathInput && onUpdateResource) {
      onUpdateResource({ ...pathModalConfig.resource, localPath: manualPathInput });
      setPathModalConfig({ show: false, resource: null });
    }
  };

  const handleOpenLocalFile = async (path: string) => {
    if (window.electron?.openPath) await window.electron.openPath(path);
    else alert(`【演示】尝试打开: ${path}`);
  };

  const handleTogglePin = (id: string) => {
    const lit = resources.find(r => r.id === id);
    if (!lit || !onUpdateResource) return;
    onUpdateResource({ ...lit, pinned: !lit.pinned });
    showToast({ message: lit.pinned ? '已取消置顶' : '已置顶该文献', type: 'success' });
  };

  const handleDeleteReport = (id: string) => {
    if (!selectedProject) return;
    setConfirmConfig({
      show: true,
      title: '删除情报报告？',
      desc: '此操作将从当前课题中永久移除此份分析报告。',
      onConfirm: () => {
        const updatedReports = (selectedProject.savedReports || []).filter(r => r.id !== id);
        onUpdateProject({ ...selectedProject, savedReports: updatedReports });
        if (selectedReportId === id) setSelectedReportId(null);
        setConfirmConfig(null);
        showToast({ message: '报告已删除', type: 'success' });
      }
    });
  };

  const handleRenameReport = (id: string) => {
    if (!selectedProject) return;
    const report = selectedProject.savedReports?.find(r => r.id === id);
    if (!report) return;
    setRenameConfig({
      show: true,
      title: '重命名报告',
      initialValue: report.title,
      onConfirm: (newTitle: string) => {
        const updatedReports = selectedProject.savedReports?.map(r => r.id === id ? { ...r, title: newTitle } : r);
        onUpdateProject({ ...selectedProject, savedReports: updatedReports });
        setRenameConfig(null);
      }
    });
  };

  const handleDeleteProposal = (id: string) => {
    if (!selectedProject) return;
    setConfirmConfig({
      show: true,
      title: '删除转化建议？',
      desc: '确定要删除这项 AI 生成的工艺建议方案吗？',
      onConfirm: () => {
        const updatedProposals = (selectedProject.proposals || []).filter(p => p.id !== id);
        onUpdateProject({ ...selectedProject, proposals: updatedProposals });
        if (selectedProposalId === id) setSelectedProposalId(null);
        setConfirmConfig(null);
        showToast({ message: '建议方案已移除', type: 'info' });
      }
    });
  };

  const handleRenameProposal = (id: string) => {
    if (!selectedProject) return;
    const proposal = selectedProject.proposals?.find(p => p.id === id);
    if (!proposal) return;
    setRenameConfig({
      show: true,
      title: '重命名建议方案',
      initialValue: proposal.title,
      onConfirm: (newTitle: string) => {
        const updatedProposals = selectedProject.proposals?.map(p => p.id === id ? { ...p, title: newTitle } : p);
        onUpdateProject({ ...selectedProject, proposals: updatedProposals });
        setRenameConfig(null);
      }
    });
  };

  return {
    state: {
      selectedProjectId, setSelectedProjectId,
      activeType, setActiveType,
      viewMode, setViewMode,
      selectedCategory, setSelectedCategory,
      selectedTag, setSelectedTag,
      localSearchQuery, setLocalSearchQuery,
      selectedItemId, setSelectedItemId,
      selectedProposalId, setSelectedProposalId,
      selectedReportId, setSelectedReportId,
      isSummarizing, isGlobalSearching,
      aiSearchKeywords, setAiSearchKeywords,
      searchField, setSearchField,
      searchFilters, setSearchFilters,
      pathModalConfig, setPathModalConfig,
      manualPathInput, setManualPathInput,
      confirmConfig, setConfirmConfig,
      renameConfig, setRenameConfig,
      selectedProject, selectedItem, isGeneratingThisItem,
      projectResources, filteredResources, allTags, allCategories,
      isReturnToWriting, isReturnToProject, isReturnToMatrix, isReturnToBrain,
      currentSearchSources,
      showBibTeXModal, setShowBibTeXModal, isParsingBib,
      showSearchPreview, setShowSearchPreview,
      isSearchLoading,
      searchPreviewResults,
      cachedSearchMeta,
      enrichingIds,
      sortBy, setSortBy,
    },
    refs: { fileInputRef },
    finish: () => { }, // placeholder
    actions: {
      handleTriggerTransformation,
      handleCompareAnalysis,
      handleSearchAndAdd,
      handleImportSelected,
      handleManualUpload,
      handleUploadArchivesClick,
      handleLinkLocalFile,
      handleConfirmManualPath,
      handleOpenLocalFile,
      handleDeleteReport,
      handleRenameReport,
      handleDeleteProposal,
      handleRenameProposal,
      handleImportBibTeX,
      handleKnowledgeSink,
      handleTogglePin,
      handleReopenSearchPreview,
      handleAddCategory,
      handleRemoveCategory,
    }
  };
};
