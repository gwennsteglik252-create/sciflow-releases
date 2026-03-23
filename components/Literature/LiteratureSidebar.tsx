import React, { useState, useCallback } from 'react';
import { useTranslation } from '../../locales/useTranslation';
import { ResourceType, Literature, MatrixReport, TransformationProposal, AiTask, LiteratureCollection } from '../../types';
import ResourceCard from './ResourceCard';
import VirtualList from '../Common/VirtualList';
import { SortOption } from '../../hooks/useLiteratureLogic';
import CollectionTree from './CollectionTree';

const getSortOptions = (t: any): { value: SortOption; label: string; icon: string }[] => [
  { value: 'default', label: t('literatureModule.sidebar.sortOptions.default'), icon: 'fa-clock-rotate-left' },
  { value: 'year_desc', label: t('literatureModule.sidebar.sortOptions.yearDesc'), icon: 'fa-arrow-down-wide-short' },
  { value: 'year_asc', label: t('literatureModule.sidebar.sortOptions.yearAsc'), icon: 'fa-arrow-up-wide-short' },
  { value: 'title_asc', label: t('literatureModule.sidebar.sortOptions.titleAsc'), icon: 'fa-arrow-down-a-z' },
  { value: 'title_desc', label: t('literatureModule.sidebar.sortOptions.titleDesc'), icon: 'fa-arrow-up-z-a' },
  { value: 'author_asc', label: t('literatureModule.sidebar.sortOptions.authorAsc'), icon: 'fa-user' },
];

const DEFAULT_CATEGORIES = ['核心理论', '工艺标准', '性能标杆', '专利检索'];

interface LiteratureSidebarProps {
  activeType: ResourceType;
  onTypeChange: (type: ResourceType) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: 'list' | 'reports' | 'proposals' | 'canvas' | 'benchmarking' | 'graph' | 'knowledgePool';

  // Data Lists (Filtered by Parent)
  resources: Literature[];
  reports: MatrixReport[];
  proposals: TransformationProposal[];

  // Filtering
  selectedCategory: string | null;
  onSelectCategory: (cat: string | null) => void;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  allTags: string[];
  allCategories: string[];

  // Sorting
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;

  // Custom Category Actions
  onAddCategory?: (name: string) => void;
  onRemoveCategory?: (name: string) => void;

  // Selection State
  selectedResourceId: string | null;
  selectedReportId: string | null;
  selectedProposalId: string | null;

  // Selection Handlers
  onSelectResource: (id: string) => void;
  onSelectReport: (id: string) => void;
  onSelectProposal: (id: string) => void;

  // Resource Actions
  activeTasks: AiTask[];
  onDeleteResource: (id: string) => void;
  onStartTransformation: (item: Literature) => void;
  onLinkLocalFile: (item: Literature) => void;
  onOpenLocalFile: (path: string) => void;

  // New Actions for Reports and Proposals
  onDeleteReport?: (id: string) => void;
  onRenameReport?: (id: string) => void;
  onDeleteProposal?: (id: string) => void;
  onRenameProposal?: (id: string) => void;
  existingProposalIds?: Record<string, string>;
  onJumpToProposal?: (proposalId: string) => void;
  onTogglePin?: (id: string) => void;
  enrichingIds?: Set<string>;

  // NEW: Reading Status Filter
  readingStatusFilter?: string | null;
  onReadingStatusFilterChange?: (status: string | null) => void;

  // NEW: Multi-Select & Export
  isMultiSelectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleMultiSelect?: () => void;
  onToggleCheck?: (id: string) => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onExitMultiSelect?: () => void;
  onShowExportModal?: () => void;

  // NEW: Collections
  collections?: LiteratureCollection[];
  selectedCollectionId?: string | null;
  onSelectCollection?: (id: string | null) => void;
  onAddCollection?: (name: string, parentId?: string) => void;
  onRenameCollection?: (id: string, name: string) => void;
  onDeleteCollection?: (id: string) => void;
  collectionCountMap?: Record<string, number>;
}

const LiteratureSidebar: React.FC<LiteratureSidebarProps> = ({
  activeType, onTypeChange, searchQuery, onSearchChange, viewMode,
  resources, reports, proposals,
  selectedCategory, onSelectCategory, selectedTag, onSelectTag, allTags, allCategories,
  sortBy, onSortChange,
  onAddCategory, onRemoveCategory,
  selectedResourceId, selectedReportId, selectedProposalId,
  onSelectResource, onSelectReport, onSelectProposal,
  activeTasks, onDeleteResource, onStartTransformation, onLinkLocalFile, onOpenLocalFile,
  onDeleteReport, onRenameReport, onDeleteProposal, onRenameProposal,
  existingProposalIds, onJumpToProposal, onTogglePin, enrichingIds,
  readingStatusFilter, onReadingStatusFilterChange,
  isMultiSelectMode, selectedIds, onToggleMultiSelect, onToggleCheck,
  onSelectAll, onDeselectAll, onExitMultiSelect, onShowExportModal,
  collections, selectedCollectionId, onSelectCollection,
  onAddCollection, onRenameCollection, onDeleteCollection, collectionCountMap,
}) => {
  const { t } = useTranslation();
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const SORT_OPTIONS = getSortOptions(t);

  return (
    <div className="col-span-1 lg:col-span-3 flex flex-col gap-2 min-h-[300px] lg:h-full overflow-hidden">
      <div className="flex gap-0.5 p-1 bg-slate-100/80 rounded-xl shrink-0 border border-slate-200/50">
        <button onClick={() => onTypeChange('文献')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeType === '文献' ? 'bg-indigo-600 text-white shadow-md' : 'bg-transparent text-slate-400 hover:text-indigo-600'}`}>{t('literatureModule.sidebar.resourceTypes.literature')}</button>
        <button onClick={() => onTypeChange('专利')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeType === '专利' ? 'bg-emerald-600 text-white shadow-md' : 'bg-transparent text-slate-400 hover:text-emerald-600'}`}>{t('literatureModule.sidebar.resourceTypes.patent')}</button>
        <button onClick={() => onTypeChange('商业竞品')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeType === '商业竞品' ? 'bg-amber-600 text-white shadow-md' : 'bg-transparent text-slate-400 hover:text-amber-600'}`}>{t('literatureModule.sidebar.resourceTypes.competitor')}</button>
      </div>

      {/* Collection Tree */}
      {viewMode === 'list' && collections && onSelectCollection && (
        <div className="bg-white/60 rounded-xl border border-slate-200/50 shadow-sm shrink-0 backdrop-blur-sm p-2">
          <CollectionTree
            collections={collections}
            selectedCollectionId={selectedCollectionId ?? null}
            onSelectCollection={onSelectCollection}
            onAddCollection={onAddCollection || (() => {})}
            onRenameCollection={onRenameCollection || (() => {})}
            onDeleteCollection={onDeleteCollection || (() => {})}
            resourceCountMap={collectionCountMap || {}}
            totalCount={resources.length}
          />
        </div>
      )}

      {/* 2. Classification & Tag Filter Panel (Collapsible) */}
      {viewMode === 'list' && (
        <div className={`bg-white/60 rounded-xl border border-slate-200/50 shadow-sm shrink-0 backdrop-blur-sm transition-all duration-300 overflow-hidden ${isPanelExpanded ? 'p-3' : 'p-2'}`}>
          <div className={`flex justify-between items-center cursor-pointer ${isPanelExpanded ? 'mb-2' : 'mb-0'}`} onClick={() => setIsPanelExpanded(!isPanelExpanded)}>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
              <i className="fa-solid fa-layer-group"></i> {t('literatureModule.sidebar.classificationFilter')}
            </p>
            <button className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-all">
              <i className={`fa-solid ${isPanelExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px]`}></i>
            </button>
          </div>

          {isPanelExpanded && (
            <div className="space-y-4 animate-reveal">
              {/* Category Filter — Dynamic */}
              <div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => onSelectCategory(null)}
                    className={`px-2.5 py-1 rounded-lg text-[8px] font-bold border transition-all ${selectedCategory === null ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                  >
                    {t('literatureModule.sidebar.all')}
                  </button>
                  {allCategories.map(cat => {
                    const isCustom = !DEFAULT_CATEGORIES.includes(cat);
                    return (
                      <div key={cat} className="relative group/cat inline-flex">
                        <button
                          onClick={() => onSelectCategory(selectedCategory === cat ? null : cat)}
                          className={`px-2.5 py-1 rounded-lg text-[8px] font-bold border transition-all ${selectedCategory === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'} ${isCustom ? 'pr-5' : ''}`}
                        >
                          {isCustom && <i className="fa-solid fa-circle text-[4px] text-violet-400 mr-1"></i>}
                          {cat}
                        </button>
                        {isCustom && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onRemoveCategory?.(cat); }}
                            className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[7px] flex items-center justify-center opacity-0 group-hover/cat:opacity-100 transition-opacity shadow-sm"
                            title={t('literatureModule.sidebar.removeCategory')}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Add custom category */}
                <div className="flex gap-1.5 mt-2">
                  <input
                    type="text"
                    placeholder={t('literatureModule.sidebar.addCategoryPlaceholder')}
                    value={newCategoryInput}
                    onChange={e => setNewCategoryInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newCategoryInput.trim()) {
                        onAddCategory?.(newCategoryInput.trim());
                        setNewCategoryInput('');
                      }
                    }}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[8px] font-bold outline-none focus:ring-1 focus:ring-indigo-200 transition-all"
                  />
                  <button
                    onClick={() => { if (newCategoryInput.trim()) { onAddCategory?.(newCategoryInput.trim()); setNewCategoryInput(''); } }}
                    disabled={!newCategoryInput.trim()}
                    className="px-2 py-1 rounded-lg text-[8px] font-black border border-indigo-200 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <i className="fa-solid fa-plus"></i>
                  </button>
                </div>
              </div>

              {/* Tag Cloud */}
              {allTags.length > 0 && (
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 flex items-center gap-1">
                    <i className="fa-solid fa-tags"></i> {t('literatureModule.sidebar.smartTagCloud')}
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => onSelectTag(selectedTag === tag ? null : tag)}
                        className={`px-2 py-0.5 rounded text-[7px] font-black uppercase border transition-all ${selectedTag === tag ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-emerald-200 hover:text-emerald-600'}`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2.5 Reading Status Filter */}
      {viewMode === 'list' && (
        <div className="flex gap-1 px-1 shrink-0 flex-wrap">
          {[
            { key: null, label: '全部', icon: 'fa-list' },
            { key: 'unread', label: '未读', icon: 'fa-circle' },
            { key: 'to_read', label: '待读', icon: 'fa-bookmark' },
            { key: 'reading', label: '阅读中', icon: 'fa-book-open' },
            { key: 'read', label: '已读', icon: 'fa-check-circle' },
            { key: 'reviewed', label: '已综述', icon: 'fa-trophy' },
          ].map(s => (
            <button
              key={s.key ?? 'all'}
              onClick={() => onReadingStatusFilterChange?.(s.key)}
              className={`px-1.5 py-1 rounded-md text-[7px] font-black uppercase transition-all flex items-center gap-0.5 ${
                readingStatusFilter === s.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              }`}
            >
              <i className={`fa-solid ${s.icon} text-[6px]`}></i> {s.label}
            </button>
          ))}
        </div>
      )}

      {/* 3. Search & Sort & List Container */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <div className="flex gap-2 shrink-0 mb-2">
          <div className="relative flex-1">
            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              type="text"
              placeholder={t('literatureModule.sidebar.searchPlaceholder')}
              className="w-full bg-slate-50/50 border border-slate-200/60 rounded-lg pl-8 pr-3 py-2 text-[9px] font-bold outline-none focus:ring-1 focus:ring-indigo-200 transition-all"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
            />
          </div>
          {viewMode === 'list' && (
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className={`h-full px-2.5 rounded-lg border text-[9px] font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${sortBy !== 'default' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300 hover:shadow-sm'}`}
                title={t('literatureModule.sidebar.sortBy')}
              >
                <i className={`fa-solid ${SORT_OPTIONS.find(o => o.value === sortBy)?.icon || 'fa-sort'} text-[8px]`}></i>
              </button>
              {showSortMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)}></div>
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 w-40 animate-reveal">
                    <p className="px-3 py-1 text-[7px] font-black text-slate-300 uppercase tracking-widest">{t('literatureModule.sidebar.sortBy')}</p>
                    {SORT_OPTIONS.map(opt => (
                       <button
                        key={opt.value}
                        onClick={() => { onSortChange(opt.value); setShowSortMenu(false); }}
                        className={`w-full px-3 py-2 text-left text-[9px] font-bold flex items-center gap-2 transition-all ${sortBy === opt.value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                      >
                        <i className={`fa-solid ${opt.icon} text-[8px] w-3`}></i>
                        {opt.label}
                        {sortBy === opt.value && <i className="fa-solid fa-check text-[8px] ml-auto text-indigo-600"></i>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {viewMode === 'list' && (
            <button
              onClick={() => isMultiSelectMode ? onExitMultiSelect?.() : onToggleMultiSelect?.()}
              className={`h-full px-2.5 rounded-lg border text-[9px] font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${isMultiSelectMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300 hover:shadow-sm'}`}
              title={isMultiSelectMode ? '退出多选' : '批量操作'}
            >
              <i className={`fa-solid ${isMultiSelectMode ? 'fa-xmark' : 'fa-list-check'} text-[8px]`}></i>
            </button>
          )}
        </div>

        {viewMode === 'list' ? (
          <VirtualList<Literature>
            items={resources}
            itemHeight={80}
            gap={10}
            overscan={5}
            className="flex-1 h-[calc(100vh-180px)] pr-1"
            emptyContent={
              <div className="text-center py-10 opacity-40">
                <i className="fa-solid fa-box-open text-2xl mb-2 text-slate-300"></i>
                <p className="text-[9px] font-black uppercase text-slate-400">{t('literatureModule.sidebar.noResources')}</p>
              </div>
            }
            renderItem={(item) => (
              <ResourceCard
                key={item.id}
                item={item}
                isSelected={selectedResourceId === item.id}
                isGenerating={activeTasks.some(t => t && t.id === `trans_${item.id}`)}
                isEnriching={enrichingIds?.has(item.id)}
                onSelect={onSelectResource}
                onDelete={onDeleteResource}
                onStartTransformation={onStartTransformation}
                onLinkLocalFile={() => onLinkLocalFile(item)}
                onOpenLocalFile={() => item.localPath && onOpenLocalFile(item.localPath)}
                existingProposalId={existingProposalIds?.[item.id]}
                onJumpToProposal={onJumpToProposal}
                onTogglePin={onTogglePin}
                isMultiSelectMode={isMultiSelectMode}
                isChecked={selectedIds?.has(item.id)}
                onToggleCheck={onToggleCheck}
              />
            )}
          />
        ) : viewMode === 'reports' ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar h-[calc(100vh-180px)] pr-1">
            <div className="space-y-3">
              {reports.map(rep => (
                <div key={rep.id} onClick={() => onSelectReport(rep.id)} className={`p-3 rounded-xl border-2 transition-all cursor-pointer shadow-sm group relative overflow-hidden hover:shadow-md ${selectedReportId === rep.id ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-slate-100 hover:border-violet-200'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-black text-[10px] leading-tight italic truncate uppercase flex-1">{rep.title}</h4>
                    <div className="flex gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <button onClick={(e) => { e.stopPropagation(); onRenameReport?.(rep.id); }} className={`p-1.5 rounded-lg transition-all active:scale-90 ${selectedReportId === rep.id ? 'bg-white/20 hover:bg-white/40' : 'bg-slate-100 text-slate-500 hover:bg-indigo-500 hover:text-white'}`} title={t('literatureModule.sidebar.rename')}>
                        <i className="fa-solid fa-pen text-[8px]"></i>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteReport?.(rep.id); }} className={`p-1.5 rounded-lg transition-all active:scale-90 ${selectedReportId === rep.id ? 'bg-white/20 hover:bg-rose-500' : 'bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white'}`} title={t('literatureModule.sidebar.delete')}>
                        <i className="fa-solid fa-trash-can text-[8px]"></i>
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-[7px] font-bold uppercase px-1.5 py-0.5 rounded ${selectedReportId === rep.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{rep.type}</span>
                    <p className={`text-[7px] font-bold ${selectedReportId === rep.id ? 'text-white/70' : 'text-slate-400'}`}>{rep.timestamp}</p>
                  </div>
                </div>
              ))}
              {reports.length === 0 && <div className="text-center py-8 text-[9px] text-slate-400 font-bold uppercase">{t('literatureModule.sidebar.noReports')}</div>}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto custom-scrollbar h-[calc(100vh-180px)] pr-1">
            <div className="space-y-3">
              {proposals.map(prop => (
                <div key={prop.id} onClick={() => onSelectProposal(prop.id)} className={`p-3 rounded-xl border-2 transition-all cursor-pointer shadow-sm group relative overflow-hidden hover:shadow-md ${selectedProposalId === prop.id ? `bg-emerald-600 text-white border-emerald-600` : `bg-white border-slate-100 hover:border-emerald-200`}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-black text-[10px] leading-tight line-clamp-2 uppercase italic flex-1">{prop.title}</h4>
                    <div className="flex gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <button onClick={(e) => { e.stopPropagation(); onRenameProposal?.(prop.id); }} className={`p-1.5 rounded-lg transition-all active:scale-90 ${selectedProposalId === prop.id ? 'bg-white/20 hover:bg-white/40' : 'bg-slate-100 text-slate-500 hover:bg-indigo-500 hover:text-white'}`} title={t('literatureModule.sidebar.rename')}>
                        <i className="fa-solid fa-pen text-[8px]"></i>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteProposal?.(prop.id); }} className={`p-1.5 rounded-lg transition-all active:scale-90 ${selectedProposalId === prop.id ? 'bg-white/20 hover:bg-rose-500' : 'bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white'}`} title={t('literatureModule.sidebar.delete')}>
                        <i className="fa-solid fa-trash-can text-[8px]"></i>
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-[7px] font-bold uppercase ${selectedProposalId === prop.id ? 'text-emerald-100' : 'text-slate-400'}`}>{t('literatureModule.sidebar.basedOn')}: {prop.literatureTitle?.substring(0, 10)}...</span>
                    <p className={`text-[7px] uppercase tracking-wider ${selectedProposalId === prop.id ? 'text-white/80' : 'text-slate-300'}`}>{prop.timestamp.split(' ')[0]}</p>
                  </div>
                </div>
              ))}
              {proposals.length === 0 && <div className="text-center py-8 text-[9px] text-slate-400 font-bold uppercase">{t('literatureModule.sidebar.noProposals')}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Multi-Select Floating Action Bar */}
      {isMultiSelectMode && (selectedIds?.size ?? 0) > 0 && (
        <div className="shrink-0 bg-indigo-600 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-lg animate-reveal">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-white uppercase">
              <i className="fa-solid fa-check-double mr-1"></i>
              已选 {selectedIds?.size} 篇
            </span>
            <button onClick={onSelectAll} className="text-[8px] font-bold text-indigo-200 hover:text-white transition-all underline">全选</button>
            <button onClick={onDeselectAll} className="text-[8px] font-bold text-indigo-200 hover:text-white transition-all underline">取消</button>
          </div>
          <button
            onClick={onShowExportModal}
            className="px-3 py-1.5 bg-white text-indigo-700 rounded-lg text-[9px] font-black uppercase hover:bg-indigo-50 transition-all shadow-sm flex items-center gap-1.5"
          >
            <i className="fa-solid fa-file-export text-[8px]"></i>
            导出
          </button>
        </div>
      )}
    </div>
  );
};

export default LiteratureSidebar;