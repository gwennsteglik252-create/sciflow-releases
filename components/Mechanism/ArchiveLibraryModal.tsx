import React, { useState, useMemo } from 'react';
import type { Simulation } from './types';
import { useTranslation } from '../../locales/useTranslation';

interface ArchiveLibraryModalProps {
  archives: Simulation[];
  onLoad: (sim: Simulation) => void;
  onDelete: (id: string) => void;
  onRenameRequest: (id: string, currentName: string) => void;
  onClose: () => void;
}

/** 从材料名中提取"根名称"用于分组（如 NiFe-LDH-0%Pt → NiFe-LDH） */
const extractMaterialFamily = (name: string): string => {
  // 去掉掺杂浓度后缀（如 -0%Pt, +5%Co, _14:00:48 等）
  return name
    .replace(/[-+_]\d+%\w+/g, '')       // -0%Pt, +5%Co
    .replace(/_\d{2}:\d{2}:\d{2}/g, '') // _14:00:48
    .replace(/\s*\(.*?\)/g, '')          // (SAC)
    .trim() || name;
};

/** 反应模式颜色映射 */
const modeColorMap: Record<string, { bg: string; text: string; border: string }> = {
  OER:          { bg: 'bg-indigo-100',  text: 'text-indigo-700',  border: 'border-indigo-200' },
  HER:          { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  ORR:          { bg: 'bg-cyan-100',    text: 'text-cyan-700',    border: 'border-cyan-200' },
  BIFUNCTIONAL: { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200' },
};

const ArchiveLibraryModal: React.FC<ArchiveLibraryModalProps> = ({
  archives,
  onLoad,
  onDelete,
  onRenameRequest,
  onClose,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string>('all');

  // ── 自动提取标签 ──
  const tags = useMemo(() => {
    const modes = new Set<string>();
    const families = new Set<string>();
    archives.forEach(a => {
      if (a.reactionMode) modes.add(a.reactionMode);
      families.add(extractMaterialFamily(a.material));
    });
    return {
      modes: Array.from(modes),
      families: Array.from(families),
      all: ['all', ...Array.from(modes), ...Array.from(families)],
    };
  }, [archives]);

  // ── 筛选逻辑 ──
  const filtered = useMemo(() => {
    let result = archives;

    // 搜索过滤
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.material.toLowerCase().includes(q) ||
        (a.doping?.element && a.doping.element.toLowerCase().includes(q))
      );
    }

    // 标签过滤
    if (activeTag !== 'all') {
      result = result.filter(a =>
        a.reactionMode === activeTag ||
        extractMaterialFamily(a.material) === activeTag
      );
    }

    return result;
  }, [archives, searchQuery, activeTag]);

  // ── 按材料系列分组 ──
  const grouped = useMemo(() => {
    const groups: Record<string, Simulation[]> = {};
    filtered.forEach(a => {
      const family = extractMaterialFamily(a.material);
      if (!groups[family]) groups[family] = [];
      groups[family].push(a);
    });
    // 按方案数量降序排列
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const handleLoad = (archive: Simulation) => {
    onLoad(archive);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-reveal"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-[760px] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
              <i className="fa-solid fa-box-archive text-sm"></i>
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                {t('mechanism.header.archiveLibrary')}
              </h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {archives.length} {t('mechanism.archiveModal.schemesCount')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 搜索框 */}
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('mechanism.archiveModal.searchPlaceholder')}
                className="h-9 pl-8 pr-3 w-52 bg-slate-50 rounded-xl text-[11px] font-bold outline-none border border-slate-200 focus:border-indigo-400 focus:bg-white transition-all"
                autoFocus
              />
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 flex items-center justify-center transition-colors"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>
        </div>

        {/* ── 标签筛选栏 ── */}
        <div className="px-6 pt-4 pb-2 flex items-center gap-2 flex-wrap shrink-0">
          {tags.all.map(tag => {
            const colors = modeColorMap[tag];
            const isActive = activeTag === tag;
            return (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md'
                    : colors
                      ? `${colors.bg} ${colors.text} border ${colors.border} hover:shadow-sm`
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {tag === 'all' ? t('mechanism.template.filterAll') : tag}
              </button>
            );
          })}
        </div>

        {/* ── 方案列表（按材料系列分组）── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300">
              <i className="fa-solid fa-box-open text-4xl mb-4 opacity-20"></i>
              <p className="text-[11px] font-black uppercase tracking-[0.2rem]">
                {searchQuery ? t('mechanism.archiveModal.noResults') : t('mechanism.header.emptyArchive')}
              </p>
            </div>
          ) : (
            grouped.map(([family, items]) => (
              <div key={family} className="mb-5 last:mb-0">
                {/* 分组标题 */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {family}
                  </h4>
                  <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {items.length}
                  </span>
                </div>

                {/* 双列卡片网格 */}
                <div className="grid grid-cols-2 gap-3">
                  {items.map(archive => {
                    const mc = modeColorMap[archive.reactionMode] || modeColorMap.OER;
                    const eta = archive.physicalConstants?.eta10;
                    const tafel = archive.physicalConstants?.tafelSlope;
                    const stability = archive.stabilityPrediction?.safetyIndex;

                    return (
                      <div
                        key={archive.id}
                        onClick={() => handleLoad(archive)}
                        className="bg-slate-50 border border-slate-200 rounded-2xl p-4 cursor-pointer hover:shadow-lg hover:scale-[1.02] hover:border-indigo-300 transition-all group relative"
                      >
                        {/* 操作按钮（hover 显示） */}
                        <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onRenameRequest(archive.id, archive.name);
                            }}
                            className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all shadow-sm"
                            title={t('mechanism.archiveModal.rename')}
                          >
                            <i className="fa-solid fa-pen text-[9px]"></i>
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onDelete(archive.id);
                            }}
                            className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                            title={t('mechanism.archiveModal.delete')}
                          >
                            <i className="fa-solid fa-trash-can text-[9px]"></i>
                          </button>
                        </div>

                        {/* 标题 */}
                        <h5 className="text-[11px] font-black text-slate-800 uppercase truncate pr-16 mb-2">
                          {archive.name}
                        </h5>

                        {/* 标签行 */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black ${mc.bg} ${mc.text}`}>
                            {archive.reactionMode}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white text-[8px] font-black text-slate-500 border border-slate-200">
                            pH {archive.pH}
                          </span>
                          {archive.doping?.element && archive.doping.element !== 'None' && (
                            <span className="px-2 py-0.5 rounded bg-violet-50 text-[8px] font-black text-violet-600 border border-violet-200">
                              {archive.doping.element} {archive.doping.concentration}%
                            </span>
                          )}
                        </div>

                        {/* 参数摘要 */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-white rounded-lg p-2 border border-slate-100">
                            <p className="text-[7px] font-bold text-slate-400 uppercase">η₁₀</p>
                            <p className="text-[11px] font-black text-indigo-600">
                              {eta != null ? `${eta}V` : '—'}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-2 border border-slate-100">
                            <p className="text-[7px] font-bold text-slate-400 uppercase">Tafel</p>
                            <p className="text-[11px] font-black text-emerald-600">
                              {tafel != null ? `${tafel}` : '—'}
                            </p>
                          </div>
                          <div className="bg-white rounded-lg p-2 border border-slate-100">
                            <p className="text-[7px] font-bold text-slate-400 uppercase">{t('mechanism.archiveModal.stability')}</p>
                            <p className={`text-[11px] font-black ${stability != null && stability >= 7 ? 'text-emerald-600' : stability != null && stability >= 4 ? 'text-amber-600' : 'text-rose-600'}`}>
                              {stability != null ? stability.toFixed(1) : '—'}
                            </p>
                          </div>
                        </div>

                        {/* 时间戳 */}
                        <p className="text-[8px] text-slate-400 font-bold mt-2.5 uppercase tracking-tighter flex items-center gap-1.5">
                          <i className="fa-regular fa-clock text-[7px]"></i>
                          {archive.timestamp}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ArchiveLibraryModal;
