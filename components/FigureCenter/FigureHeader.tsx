import React, { useEffect, useRef, useState } from 'react';
import { useProjectContext } from '../../context/ProjectContext';
import { useGenerativeDesigner } from '../../hooks/useGenerativeDesigner';
import { useStructuralDesigner } from '../../hooks/useStructuralDesigner';
import { useTimelineDesigner } from '../../hooks/useTimelineDesigner';
import { useClassificationTree } from '../../hooks/useClassificationTree';
import { useSummaryInfographic } from './Summary/useSummaryInfographic';
import { useFigureAssemblyLogic } from '../../hooks/useFigureAssemblyLogic';
import { useSankeyDesigner } from '../../hooks/useSankeyDesigner';

interface FigureHeaderProps {
  activeTab: 'generative' | 'structural' | 'assembly' | 'summary' | 'timeline' | 'tree' | 'audit' | 'sankey';
  setActiveTab: (tab: 'generative' | 'structural' | 'assembly' | 'summary' | 'timeline' | 'tree' | 'audit' | 'sankey') => void;
  generativeLogic: ReturnType<typeof useGenerativeDesigner>;
  structuralLogic: ReturnType<typeof useStructuralDesigner>;
  timelineLogic: ReturnType<typeof useTimelineDesigner>;
  summaryLogic: ReturnType<typeof useSummaryInfographic>;
  assemblyLogic: ReturnType<typeof useFigureAssemblyLogic>;
  treeLogic?: ReturnType<typeof useClassificationTree>;
  sankeyLogic?: ReturnType<typeof useSankeyDesigner>;
  onTemplateClick?: () => void;
}

export const FigureHeader: React.FC<FigureHeaderProps> = ({
  activeTab, setActiveTab, generativeLogic, structuralLogic, timelineLogic, summaryLogic, assemblyLogic,
  treeLogic, sankeyLogic, onTemplateClick
}) => {
  const { showToast } = useProjectContext();
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  // 使用 ref 保存最新的 handler，避免 useEffect 闭包过时
  const quickSaveRef = useRef<() => void>(() => { });
  const saveAsRef = useRef<() => void>(() => { });

  // 获取当前模块的 currentSavedId，判断是否已有保存记录
  const currentSavedId = (() => {
    switch (activeTab) {
      case 'structural': return structuralLogic.currentSavedId;
      case 'timeline': return timelineLogic.currentSavedId;
      case 'summary': return summaryLogic.currentSavedId;
      case 'tree': return treeLogic?.currentSavedId ?? null;
      case 'sankey': return sankeyLogic?.currentSavedId ?? null;
      default: return null;
    }
  })();

  // 快速保存（Cmd+S）
  const handleQuickSave = () => {
    switch (activeTab) {
      case 'generative':
        generativeLogic.saveCurrentToLibrary();
        break;
      case 'structural':
        structuralLogic.handleQuickSave?.();
        break;
      case 'timeline':
        timelineLogic.handleQuickSave?.();
        break;
      case 'summary':
        summaryLogic.handleQuickSave?.();
        break;
      case 'assembly':
        assemblyLogic.handleSaveToLibrary();
        break;
      case 'tree':
        treeLogic?.handleQuickSave?.();
        break;
      case 'sankey':
        sankeyLogic?.handleQuickSave?.();
        break;
      default:
        showToast({ message: '当前模式暂不支持保存', type: 'info' });
    }
  };

  // 另存为（Cmd+Shift+S）
  const handleSaveAs = () => {
    setShowSaveMenu(false);
    switch (activeTab) {
      case 'generative':
        generativeLogic.saveCurrentToLibrary();
        break;
      case 'structural':
        (structuralLogic as any).handleSaveAs?.();
        break;
      case 'timeline':
        timelineLogic.handleSaveAs?.();
        break;
      case 'summary':
        summaryLogic.handleSaveAs?.();
        break;
      case 'assembly':
        assemblyLogic.handleSaveToLibrary();
        break;
      case 'tree':
        treeLogic?.handleSaveAs?.();
        break;
      case 'sankey':
        sankeyLogic?.handleSaveAs?.();
        break;
      default:
        showToast({ message: '当前模式暂不支持另存为', type: 'info' });
    }
  };

  // 用 ref 保存最新的 handler，避免 useEffect 闭包过时
  quickSaveRef.current = handleQuickSave;
  saveAsRef.current = handleSaveAs;

  const handleLibraryClick = () => {
    switch (activeTab) {
      case 'generative':
        generativeLogic.setShowLibraryModal(true);
        break;
      case 'structural':
        structuralLogic.setShowLibrary(true);
        break;
      case 'timeline':
        timelineLogic.setShowLibrary(true);
        break;
      case 'summary':
        summaryLogic.setShowLibrary(true);
        break;
      case 'assembly':
        assemblyLogic.setShowLibrary(true);
        break;
      case 'tree':
        treeLogic?.setShowLibrary(true);
        break;
      case 'sankey':
        sankeyLogic?.setShowLibrary(true);
        break;
      default:
        showToast({ message: '当前模式暂无方案库', type: 'info' });
    }
  };

  // ====== 全局键盘快捷键 ======
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
      if (!ctrlOrCmd) return;

      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (e.shiftKey) {
          saveAsRef.current();
        } else {
          quickSaveRef.current();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // 空依赖，通过 ref 获取最新函数

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (saveMenuRef.current && !saveMenuRef.current.contains(e.target as Node)) {
        setShowSaveMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 是否支持保存（非 audit 标签）
  const canSave = activeTab !== 'audit';

  return (
    <header className="relative isolate flex justify-between items-center bg-slate-900/90 backdrop-blur-xl px-5 py-3 rounded-2xl border border-white/10 shrink-0 shadow-2xl z-[100]">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-gradient-to-br from-orange-400 via-rose-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-rose-500/20">
          <i className="fa-solid fa-wand-magic-sparkles text-lg"></i>
        </div>
        <div>
          <h2 className="text-lg font-black text-white italic uppercase tracking-tight leading-none">科研绘图中心</h2>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2rem] mt-1">SCIENTIFIC VISUAL ENGINE V3.0</p>
        </div>
      </div>

      <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 shadow-inner">
        <button
          onClick={() => setActiveTab('generative')}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'generative' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          <i className="fa-solid fa-robot"></i> AI生成
        </button>
        <button
          onClick={() => setActiveTab('structural')}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'structural' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          <i className="fa-solid fa-diagram-project"></i> 结构图
        </button>
        <button
          onClick={() => setActiveTab('timeline')}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'timeline' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          <i className="fa-solid fa-timeline"></i> 演进
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'summary' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          <i className="fa-solid fa-circle-nodes"></i> 综述
        </button>
        <button
          onClick={() => setActiveTab('tree')}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'tree' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          <i className="fa-solid fa-sitemap"></i> 分类树
        </button>
        <button
          onClick={() => setActiveTab('sankey')}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'sankey' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          <i className="fa-solid fa-diagram-sankey"></i> 桑基图
        </button>
        <button
          onClick={() => setActiveTab('assembly')}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'assembly' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          <i className="fa-solid fa-table-cells-large"></i> 拼版
        </button>
        <div className="w-px h-6 bg-white/10 mx-1 self-center"></div>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'audit' ? 'bg-rose-600 text-white shadow-lg' : 'text-rose-400 hover:text-rose-300'}`}
        >
          <i className="fa-solid fa-shield-check"></i> 投稿审计
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleLibraryClick}
          className="px-5 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-[10px] font-black uppercase hover:bg-white/10 transition-all flex items-center gap-2 active:scale-95 shadow-sm"
        >
          <i className="fa-solid fa-layer-group"></i> 方案库
        </button>
        {onTemplateClick && ['structural', 'timeline', 'summary', 'tree'].includes(activeTab) && (
          <button
            onClick={onTemplateClick}
            className="px-5 py-2 bg-white/5 border border-violet-400/30 text-violet-300 rounded-xl text-[10px] font-black uppercase hover:bg-violet-500/20 hover:text-violet-200 transition-all flex items-center gap-2 active:scale-95 shadow-sm"
          >
            <i className="fa-solid fa-swatchbook"></i> 模板
          </button>
        )}

        {/* 分拆保存按钮 (Split Button) */}
        {canSave && (
          <div ref={saveMenuRef} className="relative flex items-stretch">
            {/* 主保存按钮：快速保存 */}
            <button
              onClick={handleQuickSave}
              title={currentSavedId ? '快速保存（覆盖当前方案）Cmd+S' : '保存项目 Cmd+S'}
              className="pl-4 pr-3 py-2 bg-indigo-600 text-white rounded-l-xl text-[10px] font-black uppercase shadow-xl shadow-indigo-500/30 flex items-center gap-2 border border-indigo-400/50 hover:bg-indigo-700 transition-all active:scale-95"
            >
              <i className={`fa-solid ${currentSavedId ? 'fa-floppy-disk' : 'fa-floppy-disk'}`}></i>
              {currentSavedId ? '快速保存' : '保存项目'}
            </button>
            {/* 分隔线 */}
            <div className="w-px bg-indigo-400/40 self-stretch"></div>
            {/* 下拉箭头 */}
            <button
              onClick={() => setShowSaveMenu(v => !v)}
              title="更多保存选项"
              className="px-2 py-2 bg-indigo-600 text-white rounded-r-xl text-[10px] border border-indigo-400/50 hover:bg-indigo-700 transition-all active:scale-95 flex items-center"
            >
              <i className={`fa-solid fa-chevron-down text-[8px] transition-transform ${showSaveMenu ? 'rotate-180' : ''}`}></i>
            </button>

            {/* 下拉菜单 */}
            {showSaveMenu && (
              <div className="absolute right-0 top-full mt-2 bg-slate-800 border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl z-[9999] min-w-[160px] overflow-hidden" style={{ animation: 'slideDown 0.15s ease-out' }}>
                <button
                  onClick={handleQuickSave}
                  className="w-full px-4 py-2.5 text-left text-[10px] font-black uppercase text-slate-200 hover:bg-indigo-600 transition-all flex items-center gap-2.5"
                >
                  <i className="fa-solid fa-floppy-disk text-indigo-400 w-3.5"></i>
                  {currentSavedId ? '覆盖保存' : '保存'}
                  <span className="ml-auto text-[8px] text-slate-500 normal-case font-normal tracking-normal">⌘S</span>
                </button>
                <div className="h-px bg-white/5 mx-3"></div>
                <button
                  onClick={handleSaveAs}
                  className="w-full px-4 py-2.5 text-left text-[10px] font-black uppercase text-slate-200 hover:bg-indigo-600 transition-all flex items-center gap-2.5"
                >
                  <i className="fa-solid fa-copy text-violet-400 w-3.5"></i>
                  另存为
                  <span className="ml-auto text-[8px] text-slate-500 normal-case font-normal tracking-normal">⌘⇧S</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};