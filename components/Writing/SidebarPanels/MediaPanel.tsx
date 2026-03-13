
import React, { useRef, useState, useEffect } from 'react';
import { ResearchProject, ProjectTable, Literature, ProjectLatexSnippet } from '../../../types';
import { TableEditorModal } from './TableEditorModal';
import { LatexEditorModal } from './LatexEditorModal';
import katex from 'katex';
import { useTranslation } from '../../../locales/useTranslation';

interface MediaPanelProps {
  project: ResearchProject | undefined;
  resources: Literature[];
  onOpenFigureStudio: (media?: any) => void;
  projectMedia: any[];
  onInsertText: (text: string) => void;
  onDeleteMedia: (logId: string, fileIndex: number) => void;
  onRenameMedia: (logId: string, fileIndex: number, newName: string) => void;
  onUploadMedia: (file: File, desc: string) => void;
  onReplaceMediaImage?: (logId: string, fileIndex: number, newFile: File) => void;
  onSaveTable: (table: ProjectTable) => void;
  onDeleteTable: (id: string) => void;
  onSaveSnippet: (snippet: ProjectLatexSnippet) => void;
  onDeleteSnippet: (id: string) => void;
  onFindToken?: (type: 'Fig' | 'Table' | 'Math', id: string) => void;
  activeSubTab?: 'images' | 'tables' | 'latex';
  onSubTabChange?: (subTab: 'images' | 'tables' | 'latex') => void;
  highlightedResourceId?: string[] | null;
  orderedCitations?: { list: Literature[]; map: Map<string, number> };
  activeTemplateId?: string;
  onCiteLiterature?: (res: Literature) => void;
  onAddNode?: () => void;
}

const MediaPanel: React.FC<MediaPanelProps> = ({
  project, resources, onOpenFigureStudio, projectMedia, onInsertText, onDeleteMedia, onRenameMedia, onUploadMedia, onReplaceMediaImage, onSaveTable, onDeleteTable,
  onSaveSnippet, onDeleteSnippet, onFindToken, activeSubTab, onSubTabChange, highlightedResourceId,
  orderedCitations, activeTemplateId, onCiteLiterature, onAddNode
}) => {
  const [activeTab, setActiveTab] = useState<'images' | 'tables' | 'latex'>(activeSubTab || 'images');
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [uploadDesc, setUploadDesc] = useState('');
  const [replaceTarget, setReplaceTarget] = useState<{ logId: string; fileIndex: number } | null>(null);

  // Table State
  const [showTableModal, setShowTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState<ProjectTable | null>(null);

  // Latex State
  const [showLatexModal, setShowLatexModal] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<ProjectLatexSnippet | null>(null);

  // 同步外部传入的二级 Tab
  useEffect(() => {
    if (activeSubTab && activeSubTab !== activeTab) {
      setActiveTab(activeSubTab);
    }
  }, [activeSubTab]);

  // 处理滚动定位
  useEffect(() => {
    if (highlightedResourceId && highlightedResourceId.length > 0) {
      const id = highlightedResourceId[0];
      if (itemRefs.current[id]) {
        itemRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedResourceId]);

  const handleTabChange = (tab: 'images' | 'tables' | 'latex') => {
    setActiveTab(tab);
    if (onSubTabChange) onSubTabChange(tab);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadMedia(file, uploadDesc);
      setUploadDesc('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getFigureNumber = (refId: string): number => {
    if (!project?.paperSections) return 0;
    const foundIds = new Set<string>();
    const orderedIds: string[] = [];
    project.paperSections.forEach(section => {
      if (!section.content) return;
      const matches = section.content.matchAll(/\[Fig:\s*([\w\d_-]+)(?::Full)?\s*\]/gi);
      for (const match of matches) {
        const id = match[1];
        if (!foundIds.has(id)) {
          foundIds.add(id);
          orderedIds.push(id);
        }
      }
    });
    const index = orderedIds.indexOf(refId);
    return index !== -1 ? index + 1 : 0;
  };

  const getIsInserted = (type: 'Fig' | 'Table' | 'Math', id: string, altId?: string) => {
    if (!project?.paperSections) return false;
    const pattern = new RegExp(`\\[${type}:\\s*${id}(?::Full)?\\s*\\]`, 'i');
    const found = project.paperSections.some(s => pattern.test(s.content || ''));
    if (found || !altId) return found;
    // 同时检测 altId（如 fileId 与 refId 不同时）
    const altPattern = new RegExp(`\\[${type}:\\s*${altId}(?::Full)?\\s*\\]`, 'i');
    return project.paperSections.some(s => altPattern.test(s.content || ''));
  };

  const renderMathPreview = (tex: string, isBlock: boolean) => {
    try {
      return { __html: katex.renderToString(tex, { displayMode: isBlock, throwOnError: false }) };
    } catch (e) {
      return { __html: `<span class="text-rose-500">Error</span>` };
    }
  };

  return (
    <div className="space-y-4 animate-reveal h-full flex flex-col">
      <style>{`
        @keyframes radar-pulse {
            0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.6); transform: scale(1); }
            50% { box-shadow: 0 0 0 10px rgba(99, 102, 241, 0); transform: scale(1.02); }
            100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); transform: scale(1); }
        }
        .animate-radar-highlight {
            animation: radar-pulse 2s infinite ease-in-out;
            border-color: #6366f1 !important;
            z-index: 50;
        }
      `}</style>

      {/* Tab Switcher */}
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
        <button
          onClick={() => handleTabChange('images')}
          className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'images' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <i className="fa-solid fa-image"></i> {t('writing.mediaPanel.tabImages')}
        </button>
        <button
          onClick={() => handleTabChange('tables')}
          className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'tables' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <i className="fa-solid fa-table"></i> {t('writing.mediaPanel.tabTables')}
        </button>
        <button
          onClick={() => handleTabChange('latex')}
          className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 ${activeTab === 'latex' ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <i className="fa-solid fa-square-root-variable"></i> {t('writing.mediaPanel.tabLatex')}
        </button>
      </div>

      {activeTab === 'images' ? (
        <>
          <button
            onClick={() => onOpenFigureStudio()}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform group shrink-0"
          >
            <i className="fa-solid fa-paintbrush text-sm group-hover:rotate-12 transition-transform"></i>
            <span>{t('writing.mediaPanel.launchStudio')}</span>
          </button>

          <div className="p-4 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col gap-3 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group bg-slate-50/50 shrink-0">
            <input
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-bold outline-none border border-transparent focus:border-indigo-300 text-slate-600 placeholder:text-slate-400"
              placeholder={t('writing.mediaPanel.uploadDesc')}
              value={uploadDesc}
              onChange={(e) => setUploadDesc(e.target.value)}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 cursor-pointer"
            >
              <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                <i className="fa-solid fa-cloud-arrow-up"></i>
              </div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-500">{t('writing.mediaPanel.clickUpload')}</p>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            <input type="file" ref={replaceFileInputRef} className="hidden" accept="image/*" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && replaceTarget && onReplaceMediaImage) {
                onReplaceMediaImage(replaceTarget.logId, replaceTarget.fileIndex, file);
                setReplaceTarget(null);
              }
              if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
            }} />
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">{t('writing.mediaPanel.mediaLibrary')}</p>
            <div className="grid grid-cols-2 gap-3 pb-4">
              {projectMedia.map((file, idx) => {
                const figNum = getFigureNumber(file.refId);
                const isInserted = getIsInserted('Fig', file.refId, file.fileId);
                const isHighlighted = highlightedResourceId?.includes(file.refId);

                return (
                  <div
                    key={idx}
                    ref={el => { if (file.refId) itemRefs.current[file.refId] = el; }}
                    className={`group relative rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all bg-slate-50 border h-40 ${isHighlighted ? 'animate-radar-highlight border-indigo-500' : isInserted ? 'border-emerald-300 ring-2 ring-emerald-50' : 'border-slate-100'}`}
                  >
                    <div onClick={() => onInsertText(`[Fig:${file.refId}]`)} className="w-full h-full aspect-square bg-slate-200 flex items-center justify-center overflow-hidden cursor-pointer">
                      <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                    </div>

                    <div className="absolute inset-0 bg-slate-900/90 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity gap-1.5 pointer-events-none p-2 z-20 backdrop-blur-sm">

                      <div className="flex flex-col gap-1 w-full pointer-events-auto">
                        {isInserted && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onFindToken?.('Fig', file.refId); }}
                            className="w-full py-1 rounded-lg bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-500 transition-all shadow-sm gap-2 mb-1"
                          >
                            <i className="fa-solid fa-location-crosshairs text-[9px]"></i>
                            <span className="text-[7px] font-black uppercase">{t('writing.mediaPanel.locateCitation')}</span>
                          </button>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); onInsertText(`[Fig:${file.refId}]`); }}
                            className="py-1.5 rounded-lg bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-500 transition-all shadow-sm gap-1.5"
                          >
                            <i className="fa-solid fa-image text-[9px]"></i>
                            <span className="text-[7px] font-black uppercase">{t('writing.mediaPanel.singleColInsert')}</span>
                          </button>

                          <button
                            onClick={(e) => { e.stopPropagation(); onInsertText(`[Fig:${file.refId}:Full]`); }}
                            className="py-1.5 rounded-lg bg-indigo-800 text-white flex items-center justify-center hover:bg-black transition-all shadow-sm gap-1.5"
                          >
                            <i className="fa-solid fa-arrows-left-right text-[9px]"></i>
                            <span className="text-[7px] font-black uppercase">{t('writing.mediaPanel.fullWidthInsert')}</span>
                          </button>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const analysisMatches = file.description?.split(/\s*\[Analysis\]\s*/i);
                            const analysisText = analysisMatches && analysisMatches.length > 1 ? analysisMatches[1] : '';
                            if (analysisText) {
                              // 1. 清除历史遗留的 [Fig:xxx] 标签
                              let cleanText = analysisText.trim().replace(/\s*\[Fig:[^\]]*\]/g, '');
                              // 2. 将 AI 生成的图序号替换为动态引用标签 [FigRef:refId]，预览时自动解析为实际序号
                              const refTag = `[FigRef:${file.refId}]`;
                              cleanText = cleanText.replace(/(图\s*)\d+/g, `$1${refTag}`);
                              cleanText = cleanText.replace(/(Figure\s*)\d+/gi, `$1${refTag}`);
                              cleanText = cleanText.replace(/(Fig\.\s*)\d+/gi, `$1${refTag}`);
                              onInsertText(cleanText);
                            } else {
                              console.warn("未找到 [Analysis] 标签或其内容为空。原始 description: ", file.description);
                              alert(t('writing.mediaPanel.noAnalysisAlert'));
                            }
                          }}
                          className="w-full py-1.5 rounded-lg bg-indigo-50/20 text-indigo-100 hover:bg-indigo-500 hover:text-white border border-indigo-400/30 transition-all shadow-sm flex items-center justify-center gap-1.5 mt-0.5"
                        >
                          <i className="fa-solid fa-microscope text-[9px]"></i>
                          <span className="text-[7px] font-black uppercase">{t('writing.mediaPanel.insertAnalysis')}</span>
                        </button>
                      </div>

                      <div className="w-full h-px bg-white/10 my-0.5"></div>

                      <div className="flex gap-2 pointer-events-auto">
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenFigureStudio(file); }}
                          className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white hover:text-indigo-600 transition-all"
                          title={t('writing.mediaPanel.edit')}
                        >
                          <i className="fa-solid fa-pen-to-square text-[10px]"></i>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setReplaceTarget({ logId: file.logId, fileIndex: file.fileIndex });
                            replaceFileInputRef.current?.click();
                          }}
                          className="w-8 h-8 rounded-lg bg-white/10 text-amber-400 flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all"
                          title={t('writing.mediaPanel.replaceImage')}
                        >
                          <i className="fa-solid fa-arrow-right-arrow-left text-[10px]"></i>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteMedia(file.logId, file.fileIndex); }}
                          className="w-8 h-8 rounded-lg bg-white/10 text-rose-400 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all"
                          title={t('writing.mediaPanel.delete')}
                        >
                          <i className="fa-solid fa-trash-can text-[10px]"></i>
                        </button>
                      </div>
                    </div>

                    <div className="absolute top-1 right-1 bg-black/60 text-white text-[6px] px-1.5 py-0.5 rounded-full font-mono pointer-events-none border border-white/10">
                      {file.refId}
                    </div>
                    {figNum > 0 && (
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[8px] font-black shadow-sm pointer-events-none z-10">
                        {t('writing.mediaPanel.figLabel')} {figNum}
                      </div>
                    )}
                    {isInserted && (
                      <div className="absolute top-1 right-6 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white shadow-sm z-10 animate-pulse"></div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[7px] px-1 py-0.5 truncate text-center font-bold backdrop-blur-sm">
                      {file.description?.split(/\s*\[Analysis\]\s*/i)[0].trim() || file.name}
                    </div>
                  </div>
                );
              })}
            </div>
            {projectMedia.length === 0 && <div className="text-center py-10 text-slate-300 text-[10px] italic">{t('writing.mediaPanel.noMedia')}</div>}
          </div>
        </>
      ) : activeTab === 'tables' ? (
        <div className="flex flex-col h-full overflow-hidden">
          <button
            onClick={() => { setEditingTable(null); setShowTableModal(true); }}
            className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg flex items-center justify-center gap-2 hover:bg-emerald-700 transition-transform active:scale-95 group shrink-0 mb-4"
          >
            <i className="fa-solid fa-plus group-hover:rotate-90 transition-transform"></i>
            <span>{t('writing.mediaPanel.createTable')}</span>
          </button>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4">
            <div className="space-y-3">
              {project?.tables && project.tables.length > 0 ? (() => {
                // 按文中出现顺序建立 tableId -> seqNum 的映射
                const tableSeqMap = new Map<string, number>();
                let seqCounter = 0;
                const allContent = (project.paperSections || []).map(s => s.content || '').join('\n');
                const tableTagRegex = /\[Table:\s*([\w\d_-]+)(?::(?:Full))?\s*\]/gi;
                for (const m of allContent.matchAll(tableTagRegex)) {
                  const tid = m[1];
                  if (!tableSeqMap.has(tid)) tableSeqMap.set(tid, ++seqCounter);
                }
                return (project.tables || []).map(table => {
                  const isInserted = getIsInserted('Table', table.id);
                  const isHighlighted = highlightedResourceId?.includes(table.id);
                  const tableSeqNum = tableSeqMap.get(table.id);
                  const tableLabelStr = tableSeqNum ? `${t('writing.mediaPanel.tableLabel')} ${tableSeqNum}` : null;
                  return (
                    <div
                      key={table.id}
                      ref={el => { itemRefs.current[table.id] = el; }}
                      className={`p-4 rounded-2xl bg-white border transition-all group ${isHighlighted ? 'animate-radar-highlight border-indigo-500' : isInserted ? 'border-emerald-300 ring-1 ring-emerald-50 shadow-md' : 'border-slate-100 shadow-sm hover:border-emerald-200'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {tableLabelStr && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[8px] font-black shadow-sm">{tableLabelStr}</span>
                            )}
                            <h5 className="text-[11px] font-black text-slate-800 truncate" title={table.title}>{table.title}</h5>
                            {isInserted && <span className="text-[6px] font-black bg-emerald-500 text-white px-1 rounded uppercase tracking-tighter shadow-sm">IN TEXT</span>}
                          </div>
                          <p className="text-[9px] text-slate-400 mt-1">{table.rows.length} Rows × {table.headers.length} Cols</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isInserted && (
                            <button onClick={() => onFindToken?.('Table', table.id)} className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center shadow-sm" title={t('writing.mediaPanel.locateInText')}><i className="fa-solid fa-location-crosshairs text-[10px]"></i></button>
                          )}
                          <button onClick={() => { setEditingTable(table); setShowTableModal(true); }} className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center shadow-sm"><i className="fa-solid fa-pen text-[10px]"></i></button>
                          <button onClick={() => onDeleteTable(table.id)} className="w-7 h-7 rounded-lg bg-slate-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-sm"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInsertText(`[Table:${table.id}]`); }}
                          className="flex-1 py-2 bg-slate-50 text-emerald-600 border border-emerald-100 rounded-xl text-[9px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                          <i className="fa-solid fa-table"></i> {t('writing.mediaPanel.tableSingleCol')}
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInsertText(`[Table:${table.id}:Full]`); }}
                          className="flex-1 py-2 bg-slate-50 text-indigo-600 border border-indigo-100 rounded-xl text-[9px] font-black uppercase hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                          <i className="fa-solid fa-arrows-left-right"></i> {t('writing.mediaPanel.tableFullWidth')}
                        </button>
                      </div>
                    </div>
                  );
                });

              })() : (
                <div className="text-center py-10 text-slate-300 text-[10px] italic">{t('writing.mediaPanel.noTables')}</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden">
          <button
            onClick={() => { setEditingSnippet(null); setShowLatexModal(true); }}
            className="w-full py-4 bg-violet-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg flex items-center justify-center gap-2 hover:bg-violet-700 transition-transform active:scale-95 group shrink-0 mb-4"
          >
            <i className="fa-solid fa-plus group-hover:rotate-90 transition-transform"></i>
            <span>{t('writing.mediaPanel.createLatex')}</span>
          </button>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4">
            <div className="space-y-3">
              {project?.latexSnippets && project.latexSnippets.length > 0 ? project.latexSnippets.map(snippet => {
                const isInserted = getIsInserted('Math', snippet.id);
                const isHighlighted = highlightedResourceId?.includes(snippet.id);
                return (
                  <div
                    key={snippet.id}
                    ref={el => { itemRefs.current[snippet.id] = el; }}
                    className={`p-4 rounded-2xl bg-white border transition-all group ${isHighlighted ? 'animate-radar-highlight border-indigo-500' : isInserted ? 'border-violet-300 ring-1 ring-violet-50 shadow-md' : 'border-slate-100 shadow-sm hover:border-violet-200'}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase ${snippet.type === 'math' ? 'bg-indigo-50 text-indigo-500' : 'bg-emerald-50 text-emerald-500'}`}>{snippet.type}</span>
                        <h5 className="text-[11px] font-black text-slate-800 truncate" title={snippet.title}>{snippet.title}</h5>
                        {isInserted && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse shadow-sm"></span>}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isInserted && (
                          <button onClick={() => onFindToken?.('Math', snippet.id)} className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-600 hover:text-white transition-all flex items-center justify-center shadow-sm" title={t('writing.mediaPanel.locateInText')}><i className="fa-solid fa-location-crosshairs text-[10px]"></i></button>
                        )}
                        <button onClick={() => { setEditingSnippet(snippet); setShowLatexModal(true); }} className="w-6 h-6 rounded bg-slate-50 text-slate-400 hover:bg-violet-500 hover:text-white transition-all flex items-center justify-center shadow-sm"><i className="fa-solid fa-pen text-[9px]"></i></button>
                        <button onClick={() => onDeleteSnippet(snippet.id)} className="w-6 h-6 rounded bg-slate-50 text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-sm"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                      </div>
                    </div>

                    <div className="bg-slate-50/50 rounded-lg p-2 overflow-x-auto text-[10px] mb-3 border border-slate-100 shadow-inner">
                      <div dangerouslySetInnerHTML={renderMathPreview(snippet.content, !!snippet.isBlock)} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-slate-50 pt-3 mt-1">
                      <button
                        onClick={() => onInsertText(`$${snippet.content}$`)}
                        className="flex-1 py-2 bg-slate-50 text-indigo-600 border border-indigo-100 rounded-xl text-[9px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-1 active:scale-95 shadow-sm"
                      >
                        {t('writing.mediaPanel.inlineInsert')}
                      </button>
                      <button
                        onClick={() => onInsertText(`[Math:${snippet.id}]`)}
                        className="flex-1 py-2 bg-violet-50 text-violet-600 border border-violet-200 rounded-xl text-[9px] font-black uppercase hover:bg-violet-600 hover:text-white transition-all flex items-center justify-center gap-1 active:scale-95 shadow-sm"
                      >
                        {t('writing.mediaPanel.blockInsert')}
                      </button>
                    </div>
                  </div>
                )
              }) : (
                <div className="text-center py-10 text-slate-300 text-[10px] italic">{t('writing.mediaPanel.noSnippets')}</div>
              )}
            </div>
          </div>
        </div>
      )}

      <TableEditorModal
        show={showTableModal}
        onClose={() => setShowTableModal(false)}
        onSave={onSaveTable}
        onInsertText={onInsertText}
        onAddNode={onAddNode}
        onCiteLiterature={onCiteLiterature || (() => { })}
        initialTable={editingTable}
        project={project}
        allResources={resources}
        orderedCitations={orderedCitations}
        activeTemplateId={activeTemplateId}
      />

      <LatexEditorModal
        show={showLatexModal}
        onClose={() => setShowLatexModal(false)}
        onSave={onSaveSnippet}
        initialSnippet={editingSnippet}
      />
    </div>
  );
};

export default MediaPanel;
