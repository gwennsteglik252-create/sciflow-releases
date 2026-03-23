import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ResearchProject,
  Literature as LiteratureType,
  ResourceType,
  TransformationProposal,
  MatrixReport,
  AiTask
} from '../types';
import type { SubscriptionRule, FeedItem, LiteratureCollection, DigestReport, RecommendedPaper } from '../types';
import {
  smartResourceSearch,
  smartPatentSearch,
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

/** 标题归一化：去标点、转小写 */
function normTitle(t: string): string {
  return t.replace(/[^\w\s\u4e00-\u9fff]/g, '').toLowerCase().trim();
}

/** 使用 Jaccard 相似度检测标题是否与已有集合中的任一标题高度相似（≥0.8） */
function isTitleSimilar(key: string, existing: Set<string>): boolean {
  const wordsA = new Set(key.split(/\s+/).filter(Boolean));
  if (wordsA.size === 0) return false;
  for (const e of existing) {
    const wordsB = new Set(e.split(/\s+/).filter(Boolean));
    if (wordsB.size === 0) continue;
    let intersection = 0;
    for (const w of wordsA) { if (wordsB.has(w)) intersection++; }
    const union = new Set([...wordsA, ...wordsB]).size;
    if (union > 0 && intersection / union >= 0.8) return true;
  }
  return false;
}

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
  const [viewMode, setViewMode] = useState<'list' | 'reports' | 'proposals' | 'benchmarking' | 'graph' | 'knowledgePool'>('list');

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('default');

  // ─── 阅读状态 & 多选模式 ───────────────────────────────────
  const [readingStatusFilter, setReadingStatusFilter] = useState<string | null>(null);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);

  // ─── 订阅流 & PDF 下载 ─────────────────────────────────
  const [showSubscriptionPanel, setShowSubscriptionPanel] = useState(false);
  const [isCheckingSubscriptions, setIsCheckingSubscriptions] = useState(false);
  const [isGeneratingDigest, setIsGeneratingDigest] = useState(false);
  const [isFetchingRecommendations, setIsFetchingRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendedPaper[]>([]);
  const [showPdfSettings, setShowPdfSettings] = useState(false);

  // ─── 文献集合 & 快速抓取 ─────────────────────────────
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [showQuickCapture, setShowQuickCapture] = useState(false);

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
      // 阅读状态筛选
      const status = r.readingStatus || 'unread';
      const matchStatus = !readingStatusFilter || status === readingStatusFilter;
      // 集合筛选
      const matchCollection = !selectedCollectionId ? true :
        selectedCollectionId === '__uncollected__' ? (!r.collectionIds || r.collectionIds.length === 0) :
        (r.collectionIds || []).includes(selectedCollectionId);
      return matchSearch && matchCategory && matchTag && matchStatus && matchCollection;
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
  }, [projectResources, localSearchQuery, selectedCategory, selectedTag, sortBy, readingStatusFilter]);

  // ─── DOI + 标题模糊去重检测 ─────────────────────────────────
  const existingDois = useMemo(() => {
    const dois = new Set<string>();
    projectResources.forEach(r => {
      if (r.doi && r.doi.trim()) dois.add(r.doi.trim().toLowerCase());
    });
    return dois;
  }, [projectResources]);

  const existingTitleKeys = useMemo(() => {
    const titles = new Set<string>();
    projectResources.forEach(r => {
      if (r.title) titles.add(normTitle(r.title));
    });
    return titles;
  }, [projectResources]);

  /** 过滤掉与现有文献 DOI 或标题高度相似的项目 */
  const deduplicateResources = (items: LiteratureType[]): { unique: LiteratureType[], duplicateCount: number } => {
    const seenDois = new Set(existingDois);
    const seenTitles = new Set(existingTitleKeys);
    const unique: LiteratureType[] = [];
    let duplicateCount = 0;
    for (const item of items) {
      const doi = item.doi?.trim().toLowerCase();
      if (doi && seenDois.has(doi)) { duplicateCount++; continue; }
      const titleKey = normTitle(item.title);
      if (titleKey && isTitleSimilar(titleKey, seenTitles)) { duplicateCount++; continue; }
      unique.push(item);
      if (doi) seenDois.add(doi);
      if (titleKey) seenTitles.add(titleKey);
    }
    return { unique, duplicateCount };
  };

  // Keep backward compatibility alias
  const deduplicateByDoi = deduplicateResources;

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
        const allNew: LiteratureType[] = parsed.map((p: any) => ({
          ...p,
          id: `bib_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          projectId: selectedProjectId,
          type: activeType,
          tags: ['BibTeX Import', ...(p.category ? [p.category] : [])]
        }));
        // DOI 去重检测
        const { unique: newResources, duplicateCount } = deduplicateByDoi(allNew);
        if (newResources.length > 0) {
          onAddResources(newResources);
        }
        setShowBibTeXModal(false);
        const dupMsg = duplicateCount > 0 ? `（${duplicateCount} 篇 DOI 重复已跳过）` : '';
        showToast({ message: `成功导入 ${newResources.length} 篇文献${dupMsg}`, type: newResources.length > 0 ? 'success' : 'info' });
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
        const result = searchField === 'patent'
          ? await smartPatentSearch(
              aiSearchKeywords.split(',').map(k => k.trim()).filter(Boolean),
              searchFilters
            )
          : await smartResourceSearch(
              aiSearchKeywords.split(',').map(k => k.trim()).filter(Boolean),
              activeType,
              searchFilters,
              searchField
            );

        if (result?.items?.length > 0) {
          // 获取当前项目下已有的全量文献
          const projectResourceIds = new Set(selectedProject.citedLiteratureIds || []);
          const projectResources = resources.filter(r => projectResourceIds.has(r.id) || r.projectId === selectedProjectId);

          // 提取当前项目已存在文献的 DOI 和 Title，用于排重
          const existingDois = new Set(projectResources.map(r => r.doi?.toLowerCase()).filter(Boolean));
          const existingTitles = new Set(projectResources.map(r => r.title?.toLowerCase().trim()));

          // 筛出尚未保存在项目库的文献
          const newItems = result.items.filter((r: any) => {
            const isDoiExist = r.doi && existingDois.has(r.doi.toLowerCase());
            const isTitleExist = r.title && existingTitles.has(r.title.toLowerCase().trim());
            return !isDoiExist && !isTitleExist;
          });

          const itemsWithId = newItems.map((r: any) => ({
            ...r,
            projectId: selectedProjectId!,
            type: searchField === 'patent' ? '专利' as ResourceType : activeType
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
    // DOI 去重检测
    const { unique: deduped, duplicateCount } = deduplicateByDoi(selected);
    if (deduped.length === 0) {
      showToast({ message: `全部 ${duplicateCount} 篇文献已存在（DOI 重复）`, type: 'info' });
      return;
    }
    onAddResources(deduped);
    setShowSearchPreview(false);
    // 不清空搜索结果——保留上次检索记录，用户可随时点"查看上次检索"回去继续选择
    // 结果会在下次新搜索时自动覆盖
    const dupMsg = duplicateCount > 0 ? `（${duplicateCount} 篇 DOI 重复已跳过）` : '';
    showToast({ message: `成功导入 ${deduped.length} 篇文献${dupMsg}，正在后台联网提取深度指标...`, type: 'success' });

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

        // 自动下载 PDF（如果启用）
        try {
          const { getAutoDownloadEnabled, tryGetPdfUrl, downloadPdfToLocal } = await import('../services/pdfDownloader');
          if (getAutoDownloadEnabled()) {
            const downloadable = enrichQueue.filter(l => l.doi);
            if (downloadable.length > 0) {
              showToast({ message: `正在自动下载 ${downloadable.length} 篇全文...`, type: 'info' });
              let dlSuccess = 0;
              for (const lit of downloadable) {
                if (!lit.doi) continue;
                try {
                  const result = await tryGetPdfUrl(lit.doi);
                  if (result.success && result.pdfUrl) {
                    const filename = `${lit.doi.replace(/\//g, '_')}.pdf`;
                    const localPath = await downloadPdfToLocal(result.pdfUrl, filename);
                    if (onUpdateResource) {
                      // ★ 重新获取最新版本，避免覆盖已充实的数据
                      const latest = resources.find(r => r.id === lit.id) || lit;
                      const updated = { ...latest, pdfStatus: 'downloaded' as const };
                      if (localPath) updated.localPath = localPath;
                      onUpdateResource(updated);
                    }
                    dlSuccess++;
                  }
                } catch { }
                await new Promise(r => setTimeout(r, 800));
              }
              if (dlSuccess > 0) {
                showToast({ message: `自动下载完成: ${dlSuccess}/${downloadable.length} 篇`, type: 'success' });
              }
            }
          }
        } catch (e) {
          console.warn('[AutoDownload] Error:', e);
        }
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

        // DOI 去重检测
        const { unique: deduped, duplicateCount } = deduplicateByDoi(results);
        if (deduped.length > 0) {
          onAddResources(deduped);
        }
        const dupMsg = duplicateCount > 0 ? `（${duplicateCount} 篇 DOI 重复已跳过）` : '';
        showToast({ message: `成功导入 ${deduped.length} 份本地档案${dupMsg}`, type: deduped.length > 0 ? 'success' : 'info' });
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

  // ─── 阅读状态管理 ──────────────────────────────────────────
  const handleUpdateReadingStatus = (id: string, status: LiteratureType['readingStatus']) => {
    const lit = resources.find(r => r.id === id);
    if (!lit || !onUpdateResource) return;
    onUpdateResource({ ...lit, readingStatus: status });
  };

  // ─── 多选管理 ──────────────────────────────────────────────
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(filteredResources.map(r => r.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleExitMultiSelect = () => {
    setIsMultiSelectMode(false);
    setSelectedIds(new Set());
  };

  // ─── 批量导出 ──────────────────────────────────────────────
  const getSelectedResources = (): LiteratureType[] => {
    return resources.filter(r => selectedIds.has(r.id));
  };

  // ─── 订阅管理 ─────────────────────────────────────────
  // ─── DEMO 数据（项目无订阅数据时自动展示）─────────────
  const DEMO_RULES: SubscriptionRule[] = [
    { id: 'demo_r1', type: 'keyword', value: 'electrocatalysis OER', enabled: true, lastChecked: '2026-03-19T10:00:00Z', newCount: 3 },
    { id: 'demo_r2', type: 'author', value: 'Yi Cui', enabled: true, lastChecked: '2026-03-18T08:00:00Z', newCount: 2 },
    { id: 'demo_r3', type: 'journal', value: 'Nature Energy', enabled: true, lastChecked: '2026-03-17T12:00:00Z', newCount: 1 },
    { id: 'demo_r4', type: 'arxiv_category', value: 'cond-mat.mtrl-sci', enabled: true, newCount: 0 },
    { id: 'demo_r5', type: 'doi_alert', value: '10.1038/s41586-023-06735-9', enabled: false },
  ];

  const DEMO_FEED: FeedItem[] = [
    { id: 'demo_f1', ruleId: 'demo_r1', title: '双金属NiFe层状双氢氧化物的高效析氧催化机理研究', englishTitle: 'Efficient OER Catalysis by Bimetallic NiFe Layered Double Hydroxides', authors: ['Zhang Wei', 'Li Xin', 'Wang Jun'], year: 2026, source: 'ACS Catalysis', doi: '10.1021/acscatal.2026.demo1', url: '', abstract: '本研究通过原位表征揭示了NiFe-LDH在碱性条件下的活性位点演化机制，发现Fe³⁺的引入显著降低了OER过电位，Tafel斜率低至38 mV/dec。', discoveredAt: '2026-03-19T10:30:00Z', isRead: false, imported: false, sourceApi: 'openalex', starred: true },
    { id: 'demo_f2', ruleId: 'demo_r1', title: '单原子Ir/Co₃O₄催化剂实现工业级电流密度下的稳定析氧', englishTitle: 'Single-Atom Ir on Co₃O₄ Enables Stable OER at Industrial Current Densities', authors: ['Chen Yang', 'Zhao Ming'], year: 2026, source: 'Joule', doi: '10.1016/j.joule.2026.demo2', url: '', abstract: '利用原子层沉积技术在Co₃O₄载体上锚定单原子Ir位点，在500 mA/cm²下稳定运行超过1000小时，法拉第效率>99%。', discoveredAt: '2026-03-19T09:15:00Z', isRead: false, imported: false, sourceApi: 'openalex' },
    { id: 'demo_f3', ruleId: 'demo_r2', title: '锂金属负极的固态电解质界面原位成像研究', englishTitle: 'In Situ Imaging of Solid-Electrolyte Interphase on Li Metal Anodes', authors: ['Yi Cui', 'Fang Liu', 'Zheng Chen'], year: 2026, source: 'Nature Materials', doi: '10.1038/s41563-2026-demo3', url: '', abstract: 'Cui 团队利用冷冻电镜实现了锂金属负极SEI层的纳米级三维成像，首次观察到SEI的马赛克结构与局部锂枝晶生长的直接关联。', discoveredAt: '2026-03-18T14:00:00Z', isRead: true, imported: true, sourceApi: 'openalex' },
    { id: 'demo_f4', ruleId: 'demo_r2', title: '高容量硅-碳复合负极的循环稳定性突破', englishTitle: 'Cycling Stability Breakthrough in High-Capacity Si-C Composite Anodes', authors: ['Yi Cui', 'Park Ji-Hoon'], year: 2026, source: 'Science', doi: '10.1126/science.demo4', url: '', abstract: '提出一种新型硅碳微球结构，通过自愈合聚合物粘结剂实现1500次循环后容量保持率>90%，库仑效率99.8%。', discoveredAt: '2026-03-18T11:00:00Z', isRead: false, imported: false, sourceApi: 'openalex', starred: true },
    { id: 'demo_f5', ruleId: 'demo_r3', title: '全固态钙钛矿太阳能电池的长期稳定性里程碑', englishTitle: 'Long-Term Stability Milestone for All-Solid-State Perovskite Solar Cells', authors: ['Kim Sang-Il', 'Snaith Henry'], year: 2026, source: 'Nature Energy', doi: '10.1038/s41560-2026-demo5', url: '', abstract: '采用2D/3D异质结策略和无机空穴传输层，实现PCE 26.1%且T95寿命>10000小时的突破性成果。', discoveredAt: '2026-03-17T16:00:00Z', isRead: true, imported: false, sourceApi: 'openalex' },
    { id: 'demo_f6', ruleId: 'demo_r4', title: '拓扑绝缘体/超导体异质结中的马约拉纳费米子证据', englishTitle: 'Evidence for Majorana Fermions at Topological Insulator-Superconductor Interfaces', authors: ['Müller T.', 'Tanaka Y.'], year: 2026, source: 'arXiv: cond-mat.mtrl-sci', doi: '', url: 'https://arxiv.org/abs/2026.demo6', abstract: '在Bi₂Se₃/NbSe₂异质结中观察到零偏压电导峰的量子化平台，提供了马约拉纳束缚态的有力证据。', discoveredAt: '2026-03-19T06:00:00Z', isRead: false, imported: false, sourceApi: 'arxiv' },
    { id: 'demo_f7', ruleId: 'demo_r1', title: '氮掺杂石墨烯量子点光催化分解水产氢研究', englishTitle: 'N-doped Graphene Quantum Dots for Photocatalytic Water Splitting', authors: ['Liu Mei', 'Deng Shan'], year: 2026, source: 'Advanced Materials', doi: '10.1002/adma.2026.demo7', url: '', abstract: '设计了一种无金属光催化体系，利用氮掺杂GQDs作为助催化剂实现可见光驱动全解水，STH效率达3.2%。', discoveredAt: '2026-03-19T08:00:00Z', isRead: false, imported: false, sourceApi: 'openalex' },
    { id: 'demo_f8', ruleId: 'demo_r1', title: '机器学习辅助的高通量电催化材料筛选', englishTitle: 'Machine Learning Accelerated Screening of Electrocatalytic Materials', authors: ['Nørskov J.K.', 'Ulissi Z.W.'], year: 2026, source: 'Nature Catalysis', doi: '10.1038/s41929-2026-demo8', url: '', abstract: '构建了包含10万个候选材料的DFT数据库，结合图神经网络模型实现OER/HER双功能催化剂的快速筛选，命中率提升40倍。', discoveredAt: '2026-03-19T07:30:00Z', isRead: false, imported: false, sourceApi: 'openalex', relevanceScore: 92 },
  ];

  const DEMO_DIGEST: DigestReport[] = [{
    id: 'demo_digest_1',
    period: 'weekly',
    generatedAt: '2026-03-19T20:00:00Z',
    feedItemCount: 8,
    overallInsight: '本周订阅流中电催化领域活跃度最高，NiFe双金属催化剂和单原子催化策略是两个核心研究热点。新能源存储领域以锂金属负极和硅碳复合负极为代表持续突破。机器学习加速材料筛选正成为跨领域研究趋势。',
    topicClusters: [
      { topic: '电催化析氧反应 (OER)', paperIds: ['demo_f1', 'demo_f2', 'demo_f8'], aiSummary: '双金属LDH催化剂和单原子催化策略是当前OER研究的两大方向。NiFe-LDH的活性位点演化机制被进一步阐明，单原子Ir催化剂在工业电流密度下展现了卓越的稳定性。机器学习正在加速催化材料筛选，DFT+GNN方法使命中率提升40倍。', trendInsight: 'OER催化剂研究正从性能优化转向工业化验证和高通量智能筛选阶段。' },
      { topic: '锂电池负极材料', paperIds: ['demo_f3', 'demo_f4'], aiSummary: 'Yi Cui 团队持续引领锂金属负极研究，冷冻电镜揭示了SEI层微观结构与枝晶生长的关联。硅碳复合负极通过自愈合粘结剂实现1500次循环稳定性，距商用目标更进一步。', trendInsight: '原位表征技术和智能材料设计正推动锂电负极从实验室走向产业化。' },
      { topic: '光电转换与新型半导体', paperIds: ['demo_f5', 'demo_f6', 'demo_f7'], aiSummary: '钙钛矿太阳能电池稳定性取得里程碑突破（T95>10000h），拓扑异质结中马约拉纳费米子的实验证据为量子器件奠定基础，无金属光催化全解水体系展现潜力。', trendInsight: '2D/3D异质结、拓扑量子材料和无金属催化是三个快速发展的新方向。' },
    ],
  }];

  const DEMO_RECOMMENDATIONS: RecommendedPaper[] = [
    { id: 'demo_rec1', title: '缺陷工程调控Co₃O₄纳米阵列的OER催化性能', englishTitle: 'Defect Engineering of Co₃O₄ Nanoarrays for Enhanced OER Performance', authors: ['Hu Wei', 'Zhang Li'], year: 2025, source: 'Nano Letters', doi: '10.1021/acs.nanolett.2025.rec1', abstract: '通过等离子体处理引入氧空位，将OER过电位降至250 mV@10 mA/cm²，稳定性超500小时。', citationCount: 87, recommendReason: '与你研究的NiFe-LDH体系互补，提供了Co基催化剂的缺陷调控策略' },
    { id: 'demo_rec2', title: '原位拉曼光谱揭示电催化反应中间体演化', englishTitle: 'In Situ Raman Spectroscopy Reveals Intermediate Evolution in Electrocatalysis', authors: ['Li Bin', 'Tian Zhong-Qun'], year: 2025, source: 'Journal of the American Chemical Society', doi: '10.1021/jacs.2025.rec2', abstract: '发展了高灵敏度原位增强拉曼技术，首次捕获OER过程中*OOH中间体的振动光谱信号。', citationCount: 156, recommendReason: '提供了先进的原位表征方法，可用于验证你的催化机理假说' },
    { id: 'demo_rec3', title: '高熵合金纳米颗粒的协同催化效应', englishTitle: 'Synergistic Catalytic Effects of High-Entropy Alloy Nanoparticles', authors: ['Yao Yonggang', 'Hu Liangbing'], year: 2025, source: 'Nature Synthesis', doi: '10.1038/s44160-2025-rec3', abstract: '利用碳热冲击法合成五元高熵合金纳米颗粒，在OER、ORR和HER中均展现优异的多功能催化活性。', citationCount: 234, recommendReason: '高熵合金方向的前沿突破，可为你的多金属催化体系提供新思路' },
    { id: 'demo_rec4', title: '密度泛函理论指导的电催化描述符筛选框架', englishTitle: 'DFT-Guided Descriptor Screening Framework for Electrocatalysis', authors: ['Nørskov Jens K.', 'Montoya Joseph'], year: 2025, source: 'ACS Catalysis', doi: '10.1021/acscatal.2025.rec4', abstract: '建立了基于吸附能、d带中心和晶体场能量的三维描述符空间，系统筛选过渡金属氧化物OER催化剂。', citationCount: 312, recommendReason: '理论计算框架可直接应用于你的催化材料理性设计' },
    { id: 'demo_rec5', title: '电解水制氢的大规模工业化挑战与前景', englishTitle: 'Challenges and Prospects for Scale-Up of Water Electrolysis', authors: ['Ayers Katherine', 'Pivovar Bryan'], year: 2025, source: 'Nature Reviews Materials', doi: '10.1038/s41578-2025-rec5', abstract: '系统综述了PEM、AEM和碱性电解槽的技术成熟度、成本瓶颈和产业化路径。', citationCount: 489, recommendReason: '为你的基础研究提供产业化视角和应用目标' },
    { id: 'demo_rec6', title: '自支撑MoS₂/NiFe-LDH异质结构的双功能水分解', englishTitle: 'Self-Supported MoS₂/NiFe-LDH Heterostructure for Bifunctional Water Splitting', authors: ['Sun Yufei', 'Xie Yi'], year: 2025, source: 'Energy & Environmental Science', doi: '10.1039/D5EE00000-rec6', abstract: '通过异质结工程将MoS₂的HER活性与NiFe-LDH的OER活性结合，实现1.48 V全解水电压。', citationCount: 198, recommendReason: '直接涉及NiFe-LDH体系，提供了异质结增强策略的实验参考' },
  ];

  const subscriptionRules = useMemo(() => {
    const real = selectedProject?.subscriptionRules || [];
    return real.length > 0 ? real : DEMO_RULES;
  }, [selectedProject]);

  const feedItems = useMemo(() => {
    const items = selectedProject?.feedItems || [];
    const display = items.length > 0 ? items : DEMO_FEED;
    return [...display].sort((a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime());
  }, [selectedProject]);
  const unreadFeedCount = useMemo(() => feedItems.filter(f => !f.isRead && !f.imported).length, [feedItems]);

  // DEMO: 当无推荐数据时自动注入示例
  useEffect(() => {
    setRecommendations(prev => prev.length === 0 ? DEMO_RECOMMENDATIONS : prev);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddSubscriptionRule = (type: SubscriptionRule['type'], value: string) => {
    if (!selectedProject) return;
    const newRule: SubscriptionRule = {
      id: `rule_${Date.now()}`,
      type,
      value,
      enabled: true,
    };
    onUpdateProject({
      ...selectedProject,
      subscriptionRules: [...(selectedProject.subscriptionRules || []), newRule],
    });
    showToast({ message: `订阅规则已添加: ${value}`, type: 'success' });
  };

  const handleRemoveSubscriptionRule = (id: string) => {
    if (!selectedProject) return;
    onUpdateProject({
      ...selectedProject,
      subscriptionRules: (selectedProject.subscriptionRules || []).filter(r => r.id !== id),
    });
  };

  const handleToggleSubscriptionRule = (id: string) => {
    if (!selectedProject) return;
    onUpdateProject({
      ...selectedProject,
      subscriptionRules: (selectedProject.subscriptionRules || []).map(r =>
        r.id === id ? { ...r, enabled: !r.enabled } : r
      ),
    });
  };

  const handleCheckSubscriptions = async () => {
    if (!selectedProject || isCheckingSubscriptions) return;
    const enabledRules = (selectedProject.subscriptionRules || []).filter(r => r.enabled);
    if (enabledRules.length === 0) {
      showToast({ message: '请先添加并启用订阅规则', type: 'info' });
      return;
    }
    setIsCheckingSubscriptions(true);
    try {
      const { checkSubscription } = await import('../services/gemini/subscription');
      let allNewItems: FeedItem[] = [];
      const updatedRules = [...enabledRules];

      for (const rule of enabledRules) {
        try {
          const newItems = await checkSubscription(rule, existingDois);
          // 去重：过滤已存在的 feedItems
          const existingFeedDois = new Set((selectedProject.feedItems || []).map(f => f.doi?.toLowerCase()).filter(Boolean));
          const genuinelyNew = newItems.filter(item => !item.doi || !existingFeedDois.has(item.doi.toLowerCase()));
          allNewItems = [...allNewItems, ...genuinelyNew];
          const ruleIdx = updatedRules.findIndex(r => r.id === rule.id);
          if (ruleIdx >= 0) {
            updatedRules[ruleIdx] = { ...updatedRules[ruleIdx], lastChecked: new Date().toISOString(), newCount: genuinelyNew.length };
          }
        } catch (e) {
          console.error(`[Subscription] Rule "${rule.value}" failed:`, e);
        }
      }

      // 更新项目
      const allRules = (selectedProject.subscriptionRules || []).map(r => {
        const updated = updatedRules.find(u => u.id === r.id);
        return updated || r;
      });
      onUpdateProject({
        ...selectedProject,
        subscriptionRules: allRules,
        feedItems: [...(selectedProject.feedItems || []), ...allNewItems],
      });

      showToast({ message: `检查完成，发现 ${allNewItems.length} 篇新文献`, type: allNewItems.length > 0 ? 'success' : 'info' });
    } catch (e) {
      console.error('[Subscription] Check failed:', e);
      showToast({ message: '订阅检查失败', type: 'error' });
    } finally {
      setIsCheckingSubscriptions(false);
    }
  };

  const handleImportFeedItem = (item: FeedItem) => {
    if (!selectedProject) return;
    const newLit: LiteratureType = {
      id: `imported_${Date.now()}`,
      projectId: selectedProjectId!,
      title: item.title,
      englishTitle: item.englishTitle,
      authors: item.authors,
      year: item.year,
      source: item.source,
      doi: item.doi,
      url: item.url,
      abstract: item.abstract,
      type: activeType,
      category: '订阅导入',
      performance: [],
      synthesisSteps: [],
      tags: ['订阅流导入'],
      readingStatus: 'unread',
    };
    onAddResources([newLit]);
    // 标记为已导入
    onUpdateProject({
      ...selectedProject,
      feedItems: (selectedProject.feedItems || []).map(f =>
        f.id === item.id ? { ...f, imported: true, isRead: true } : f
      ),
    });
    showToast({ message: `已导入: ${item.title.substring(0, 30)}...`, type: 'success' });
  };

  const handleMarkFeedRead = (id: string) => {
    if (!selectedProject) return;
    onUpdateProject({
      ...selectedProject,
      feedItems: (selectedProject.feedItems || []).map(f =>
        f.id === id ? { ...f, isRead: true } : f
      ),
    });
  };

  // ─── 星标收藏 ─────────────────────────────────────────────
  const handleStarFeedItem = (id: string) => {
    if (!selectedProject) return;
    onUpdateProject({
      ...selectedProject,
      feedItems: (selectedProject.feedItems || []).map(f =>
        f.id === id ? { ...f, starred: !f.starred } : f
      ),
    });
  };

  // ─── AI 聚合摘要 ──────────────────────────────────────────
  const digestReports = useMemo(() => {
    const real = selectedProject?.digestReports || [];
    return real.length > 0 ? real : DEMO_DIGEST;
  }, [selectedProject]);

  const handleGenerateDigest = async (period: 'daily' | 'weekly') => {
    if (!selectedProject || isGeneratingDigest || feedItems.length === 0) return;
    setIsGeneratingDigest(true);
    try {
      const { generateDigest } = await import('../services/gemini/digest');
      const report = await generateDigest(feedItems, period);
      onUpdateProject({
        ...selectedProject,
        digestReports: [report, ...(selectedProject.digestReports || [])].slice(0, 10),
      });
      showToast({ message: `${period === 'daily' ? '每日' : '每周'}摘要已生成`, type: 'success' });
    } catch (e) {
      console.error('[Digest] Generation failed:', e);
      showToast({ message: 'AI 摘要生成失败', type: 'error' });
    } finally {
      setIsGeneratingDigest(false);
    }
  };

  // ─── 智能推荐 ─────────────────────────────────────────────
  const handleFetchRecommendations = async () => {
    if (!selectedProject || isFetchingRecommendations) return;
    const positiveDois = projectResources
      .map(r => r.doi)
      .filter((d): d is string => !!d && d.length > 0);
    if (positiveDois.length === 0) {
      showToast({ message: '请先导入至少一篇含 DOI 的文献', type: 'info' });
      return;
    }
    setIsFetchingRecommendations(true);
    try {
      const { getRecommendations } = await import('../services/gemini/recommendation');
      const negativeDois = selectedProject.recommendationDismissedDois || [];
      const results = await getRecommendations(positiveDois.slice(0, 5), negativeDois);
      // 过滤已dismissed和已存在的DOI
      const existingDoiSet = new Set(projectResources.map(r => r.doi?.toLowerCase()).filter(Boolean));
      const dismissedSet = new Set((selectedProject.recommendationDismissedDois || []).map(d => d.toLowerCase()));
      const filtered = results.filter(r => {
        const d = r.doi?.toLowerCase();
        return !d || (!existingDoiSet.has(d) && !dismissedSet.has(d));
      });
      setRecommendations(filtered);
      showToast({ message: `发现 ${filtered.length} 篇推荐论文`, type: filtered.length > 0 ? 'success' : 'info' });
    } catch (e) {
      console.error('[Recommendation] Fetch failed:', e);
      showToast({ message: '推荐获取失败', type: 'error' });
    } finally {
      setIsFetchingRecommendations(false);
    }
  };

  const handleImportRecommendation = (paper: RecommendedPaper) => {
    if (!selectedProject) return;
    const newLit: LiteratureType = {
      id: `rec_import_${Date.now()}`,
      projectId: selectedProjectId!,
      title: paper.title,
      englishTitle: paper.englishTitle,
      authors: paper.authors,
      year: paper.year,
      source: paper.source,
      doi: paper.doi,
      url: paper.url,
      abstract: paper.abstract,
      type: activeType,
      category: '智能推荐',
      performance: [],
      synthesisSteps: [],
      tags: ['智能推荐导入'],
      readingStatus: 'unread',
    };
    onAddResources([newLit]);
    setRecommendations(prev => prev.filter(r => r.id !== paper.id));
    showToast({ message: `已导入: ${paper.title.substring(0, 30)}...`, type: 'success' });
  };

  const handleDismissRecommendation = (doi: string) => {
    if (!selectedProject || !doi) return;
    onUpdateProject({
      ...selectedProject,
      recommendationDismissedDois: [...(selectedProject.recommendationDismissedDois || []), doi],
    });
    setRecommendations(prev => prev.map(r => r.doi === doi ? { ...r, dismissed: true } : r));
    showToast({ message: '已标记为不感兴趣', type: 'info' });
  };

  // ─── PDF 下载 ─────────────────────────────────────────
  const SOURCE_LABELS: Record<string, string> = {
    campus_doi: '校园网直链',
    unpaywall: 'Open Access',
    scihub: 'Sci-Hub',
    wytsg: '图书馆通道',
    direct: '直链',
  };

  const handleDownloadPdf = async (litId: string) => {
    const lit = resources.find(r => r.id === litId);
    if (!lit?.doi || !onUpdateResource) return;
    const doi = lit.doi;
    onUpdateResource({ ...lit, pdfStatus: 'searching' });
    try {
      const { collectPdfCandidates, downloadPdfToLocal } = await import('../services/pdfDownloader');
      const { candidates } = await collectPdfCandidates(doi);
      if (candidates.length === 0) {
        const latest = resources.find(r => r.id === litId) || lit;
        onUpdateResource({ ...latest, pdfStatus: 'failed' });
        showToast({ message: '所有下载通道均未能获取全文', type: 'error' });
        return;
      }

      const filename = `${doi.replace(/\//g, '_')}.pdf`;
      // 逐一尝试每个候选 URL，直到下载成功
      for (const candidate of candidates) {
        console.log(`[PDF] Trying ${candidate.source}: ${candidate.url}`);
        const localPath = await downloadPdfToLocal(candidate.url, filename);
        if (localPath) {
          const latest = resources.find(r => r.id === litId) || lit;
          onUpdateResource({ ...latest, pdfStatus: 'downloaded' as const, localPath });
          const srcLabel = SOURCE_LABELS[candidate.source] || candidate.source;
          showToast({ message: `全文已获取 · ${srcLabel}`, type: 'success' });
          return;
        }
      }

      // 所有候选都失败
      const latest = resources.find(r => r.id === litId) || lit;
      onUpdateResource({ ...latest, pdfStatus: 'failed' });
      showToast({ message: `尝试了 ${candidates.length} 个下载源均失败`, type: 'error' });
    } catch (e) {
      const latest = resources.find(r => r.id === litId) || lit;
      onUpdateResource({ ...latest, pdfStatus: 'failed' });
      showToast({ message: '下载失败', type: 'error' });
    }
  };

  const handleBatchDownloadPdf = async () => {
    const selected = getSelectedResources().filter(r => r.doi && r.pdfStatus !== 'downloaded');
    if (selected.length === 0) {
      showToast({ message: '未选中可下载的文献（需有 DOI 且未下载）', type: 'info' });
      return;
    }
    await startGlobalTask({
      id: `batch_pdf_${Date.now()}`,
      type: 'writing_assist',
      status: 'running',
      title: `批量下载 ${selected.length} 篇全文...`
    }, async () => {
      const { tryGetPdfUrl, downloadPdfToLocal } = await import('../services/pdfDownloader');
      let successCount = 0;
      let failCount = 0;
      for (const lit of selected) {
        if (!lit.doi || !onUpdateResource) continue;
        // ★ 重新获取最新版本
        const currentLit = resources.find(r => r.id === lit.id) || lit;
        onUpdateResource({ ...currentLit, pdfStatus: 'searching' });
        try {
          const result = await tryGetPdfUrl(lit.doi);
          if (result.success && result.pdfUrl) {
            const filename = `${lit.doi.replace(/\//g, '_')}.pdf`;
            const localPath = await downloadPdfToLocal(result.pdfUrl, filename);
            const latest = resources.find(r => r.id === lit.id) || currentLit;
            const updated = { ...latest, pdfStatus: 'downloaded' as const };
            if (localPath) updated.localPath = localPath;
            onUpdateResource(updated);
            successCount++;
          } else {
            const latest = resources.find(r => r.id === lit.id) || currentLit;
            onUpdateResource({ ...latest, pdfStatus: 'failed' });
            failCount++;
          }
        } catch {
          const latest = resources.find(r => r.id === lit.id) || currentLit;
          onUpdateResource({ ...latest, pdfStatus: 'failed' });
          failCount++;
        }
        // 串行间隔避免触发限流
        await new Promise(r => setTimeout(r, 800));
      }
      const msg = failCount > 0
        ? `批量下载完成: ${successCount} 成功, ${failCount} 失败`
        : `批量下载完成: 全部 ${successCount} 篇成功`;
      showToast({ message: msg, type: successCount > 0 ? 'success' : 'error' });
    });
  };


  // ─── 文献集合管理 ─────────────────────────────────────────
  const projectCollections = useMemo(() => selectedProject?.collections || [], [selectedProject]);
  const collectionCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    let uncollected = 0;
    for (const r of projectResources) {
      if (!r.collectionIds || r.collectionIds.length === 0) {
        uncollected++;
      } else {
        for (const cid of r.collectionIds) {
          map[cid] = (map[cid] || 0) + 1;
        }
      }
    }
    map['__uncollected__'] = uncollected;
    return map;
  }, [projectResources]);

  const handleAddCollection = (name: string, parentId?: string) => {
    if (!selectedProject) return;
    const colorKeys = ['indigo', 'emerald', 'amber', 'rose', 'sky', 'purple'];
    const newCol: LiteratureCollection = {
      id: `col_${Date.now()}`,
      name,
      parentId,
      icon: parentId ? 'fa-folder-tree' : 'fa-folder',
      color: colorKeys[Math.floor(Math.random() * colorKeys.length)],
      order: (selectedProject.collections || []).length,
    };
    onUpdateProject({
      ...selectedProject,
      collections: [...(selectedProject.collections || []), newCol],
    });
    showToast({ message: `集合「${name}」已创建`, type: 'success' });
  };

  const handleRenameCollection = (id: string, name: string) => {
    if (!selectedProject) return;
    onUpdateProject({
      ...selectedProject,
      collections: (selectedProject.collections || []).map(c => c.id === id ? { ...c, name } : c),
    });
  };

  const handleDeleteCollection = (id: string) => {
    if (!selectedProject) return;
    const getAllDescendants = (parentId: string): string[] => {
      const children = (selectedProject.collections || []).filter(c => c.parentId === parentId);
      return [parentId, ...children.flatMap(c => getAllDescendants(c.id))];
    };
    const toRemove = new Set(getAllDescendants(id));
    onUpdateProject({
      ...selectedProject,
      collections: (selectedProject.collections || []).filter(c => !toRemove.has(c.id)),
    });
    for (const r of resources) {
      if (r.collectionIds?.some(cid => toRemove.has(cid))) {
        onUpdateResource?.({ ...r, collectionIds: r.collectionIds.filter(cid => !toRemove.has(cid)) });
      }
    }
    if (selectedCollectionId && toRemove.has(selectedCollectionId)) setSelectedCollectionId(null);
    showToast({ message: '集合已删除', type: 'info' });
  };

  const handleMoveToCollection = (litId: string, collectionId: string) => {
    const lit = resources.find(r => r.id === litId);
    if (!lit || !onUpdateResource) return;
    const currentIds = lit.collectionIds || [];
    if (currentIds.includes(collectionId)) return;
    onUpdateResource({ ...lit, collectionIds: [...currentIds, collectionId] });
  };

  // ─── 快速抓取 ──────────────────────────────────────────────
  const handleQuickImport = (items: LiteratureType[]) => {
    const { unique: deduped, duplicateCount } = deduplicateResources(items);
    if (deduped.length === 0) {
      showToast({ message: '所有文献均已存在', type: 'info' });
      return;
    }
    onAddResources(deduped);
    showToast({ message: `已导入 ${deduped.length} 篇文献${duplicateCount > 0 ? `（${duplicateCount} 篇重复已跳过）` : ''}`, type: 'success' });
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
      // NEW: Reading Status
      readingStatusFilter, setReadingStatusFilter,
      // NEW: Multi-Select & Export
      isMultiSelectMode, setIsMultiSelectMode,
      selectedIds, setSelectedIds,
      showExportModal, setShowExportModal,
      // NEW: Subscription & PDF
      showSubscriptionPanel, setShowSubscriptionPanel,
      isCheckingSubscriptions,
      subscriptionRules,
      feedItems,
      unreadFeedCount,
      // NEW: Digest & Recommendations
      digestReports,
      isGeneratingDigest,
      recommendations,
      isFetchingRecommendations,
      showPdfSettings, setShowPdfSettings,
      // NEW: Collections & Quick Capture
      selectedCollectionId, setSelectedCollectionId,
      projectCollections,
      collectionCountMap,
      showQuickCapture, setShowQuickCapture,
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
      // NEW: Reading Status
      handleUpdateReadingStatus,
      // NEW: Multi-Select & Export
      handleToggleSelect,
      handleSelectAll,
      handleDeselectAll,
      handleExitMultiSelect,
      getSelectedResources,
      // NEW: Subscription
      handleAddSubscriptionRule,
      handleRemoveSubscriptionRule,
      handleToggleSubscriptionRule,
      handleCheckSubscriptions,
      handleImportFeedItem,
      handleMarkFeedRead,
      handleStarFeedItem,
      // NEW: Digest & Recommendations
      handleGenerateDigest,
      handleFetchRecommendations,
      handleImportRecommendation,
      handleDismissRecommendation,
      // NEW: PDF Download
      handleDownloadPdf,
      handleBatchDownloadPdf,
      // NEW: Collections
      handleAddCollection,
      handleRenameCollection,
      handleDeleteCollection,
      handleMoveToCollection,
      // NEW: Quick Capture
      handleQuickImport,
    }
  };
};
