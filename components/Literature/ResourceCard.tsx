
import React from 'react';
import { Literature as LiteratureType, ResourceType } from '../../types';

interface ResourceCardProps {
  item: LiteratureType;
  isSelected: boolean;
  isGenerating: boolean;
  isEnriching?: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onStartTransformation: (item: LiteratureType) => Promise<void> | void;
  onLinkLocalFile?: () => void;
  onOpenLocalFile?: () => void;
  existingProposalId?: string;
  onJumpToProposal?: (proposalId: string) => void;
  onTogglePin?: (id: string) => void;
}

const ResourceCard: React.FC<ResourceCardProps> = React.memo(({
  item,
  isSelected,
  isGenerating,
  isEnriching,
  onSelect,
  onDelete,
  onStartTransformation,
  onLinkLocalFile,
  onOpenLocalFile,
  existingProposalId,
  onJumpToProposal,
  onTogglePin
}) => {
  const getBgColor = (type: ResourceType) => {
    switch (type) {
      case '文献': return 'bg-indigo-600';
      case '专利': return 'bg-emerald-50';
      case '商业竞品': return 'bg-amber-500';
      default: return 'bg-indigo-600';
    }
  };

  const isFromProposal = item.tags?.includes('源自计划书');
  const isTopTier = (item as any).isTopTier;
  const isPinned = item.pinned;

  return (
    <div
      onClick={() => onSelect(item.id)}
      className={`p-2.5 rounded-xl border-2 transition-all cursor-pointer shadow-sm group relative overflow-hidden flex flex-col gap-1.5 ${isPinned ? 'ring-2 ring-amber-300/40' : ''} ${isSelected
        ? (item.type === '专利' ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' : `${getBgColor(item.type)} text-white shadow-md scale-[1.005]`)
        : `bg-white border-slate-100 hover:bg-slate-50`
        }`}
    >
      {/* Pin indicator stripe */}
      {isPinned && (
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400"></div>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-start gap-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5 flex-wrap">
              <span className={`text-[6px] font-black uppercase px-1 py-0.5 rounded-md whitespace-nowrap ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {(item.categories && item.categories.length > 0) ? item.categories.join(' · ') : (item.category || item.type)}
              </span>
              {isPinned && (
                <span className={`text-[6px] font-black uppercase px-1 py-0.5 rounded-md whitespace-nowrap border flex items-center gap-1 ${isSelected ? 'bg-amber-400 text-slate-900 border-amber-300' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                  <i className="fa-solid fa-thumbtack"></i> PIN
                </span>
              )}
              {isTopTier && (
                <span className={`text-[6px] font-black uppercase px-1 py-0.5 rounded-md whitespace-nowrap border flex items-center gap-1 ${isSelected ? 'bg-amber-400 text-slate-900 border-amber-300' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                  <i className="fa-solid fa-award"></i> TOP TIER
                </span>
              )}
              {isFromProposal && (
                <span className={`text-[6px] font-black uppercase px-1 py-0.5 rounded-md whitespace-nowrap border flex items-center gap-1 ${isSelected ? 'bg-white/20 text-white animate-pulse' : 'bg-amber-50 border-amber-200 text-amber-600'}`}>
                  <i className="fa-solid fa-file-contract text-[5px]"></i> 源自计划书
                </span>
              )}
            </div>
            <h4 className={`font-black text-[9px] leading-tight line-clamp-2 italic ${isSelected ? 'text-white' : 'text-slate-800'}`}>
              {item.title}
            </h4>
          </div>
        </div>

        <div className="flex justify-between items-center mt-1">
          <div className="flex flex-col gap-0.5">
            <p className={`text-[7.5px] font-bold uppercase truncate max-w-[140px] ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
              {item.source?.substring(0, 25)} · {item.year}
            </p>
            {item.localPath && (
              <span className={`text-[6.5px] font-black uppercase flex items-center gap-1 ${isSelected ? 'text-emerald-200' : 'text-emerald-600'}`}>
                <i className="fa-solid fa-file-circle-check"></i> 本地已就绪
              </span>
            )}
            {isEnriching && (
              <span className={`text-[6.5px] font-black uppercase flex items-center gap-1 animate-pulse ${isSelected ? 'text-blue-200' : 'text-blue-500'}`}>
                <i className="fa-solid fa-circle-notch animate-spin text-[5px]"></i> 深度充实中...
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Pin/Unpin button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin?.(item.id);
              }}
              className={`p-1 rounded-md transition-all ${isPinned
                ? (isSelected ? 'bg-amber-400 text-slate-900 hover:bg-amber-300' : 'bg-amber-100 text-amber-600 hover:bg-amber-200')
                : (isSelected ? 'bg-white/20 text-white hover:bg-white/40' : 'bg-slate-100 text-slate-400 hover:bg-amber-100 hover:text-amber-600')
                }`}
              title={isPinned ? '取消置顶' : '置顶'}
            >
              <i className={`fa-solid fa-thumbtack text-[7px] ${isPinned ? '' : 'opacity-60'}`}></i>
            </button>
            {item.localPath ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLocalFile && onOpenLocalFile();
                }}
                className={`p-1 rounded-md transition-all ${isSelected
                  ? 'bg-white/20 text-white hover:bg-white/40'
                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white'
                  }`}
                title="打开本地文献"
              >
                <i className="fa-solid fa-folder-open text-[7px]"></i>
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onLinkLocalFile) {
                    onLinkLocalFile();
                  }
                }}
                className={`p-1 rounded-md transition-all ${isSelected
                  ? 'bg-white/20 text-white hover:bg-white/40'
                  : 'bg-slate-100 text-slate-500 hover:bg-indigo-500 hover:text-white'
                  }`}
                title="关联本地 PDF"
              >
                <i className="fa-solid fa-link text-[7px]"></i>
              </button>
            )}

            {existingProposalId ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpToProposal?.(existingProposalId);
                }}
                className={`p-1 rounded-md transition-all ${isSelected
                  ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white shadow-sm'
                  }`}
                title="查看已生成的转化建议"
              >
                <i className="fa-solid fa-arrow-up-right-from-square text-[7px]"></i>
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartTransformation(item);
                }}
                disabled={isGenerating}
                className={`p-1 rounded-md transition-all ${isSelected
                  ? 'bg-white/20 text-white hover:bg-white/40'
                  : 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
                  }`}
                title="工艺转化建议"
              >
                {isGenerating ? (
                  <i className="fa-solid fa-circle-notch animate-spin text-[7px]"></i>
                ) : (
                  <i className="fa-solid fa-bolt text-[7px]"></i>
                )}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              className={`p-1 rounded-md transition-all ${isSelected
                ? 'bg-white/20 text-white hover:bg-rose-500'
                : 'bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white'
                }`}
              title="删除记录"
            >
              <i className="fa-solid fa-trash-can text-[7px]"></i>
            </button>
          </div>
        </div>
      </div>

      {isGenerating && (
        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-sm shadow-amber-200"></div>
      )}
    </div>
  );
});

export default ResourceCard;
