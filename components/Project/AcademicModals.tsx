
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ChatMessage, MatrixReport } from '../../types';
import ScientificMarkdown from '../Common/ScientificMarkdown';
import { exportToWord } from '../../utils/documentExport';
import { useProjectContext } from '../../context/ProjectContext';
import { printElement } from '../../utils/printUtility';

interface AcademicModalsProps {
  // Weekly Report Preview
  showWeekly: boolean;
  weeklyReport: { id?: string, title: string; content: string, sourceLogIds?: string[] } | null;
  onCloseWeekly: () => void;
  onSaveWeekly: (content: string, title: string, id?: string, sourceLogIds?: string[]) => void;
  onSaveToLibrary?: (content: string, title: string, sourceLogIds?: string[]) => void;
  onTraceSource?: (ids: string[]) => void;
  projectId?: string; // for pushing plan tasks to weekly plan

  // Insight View
  showInsight: boolean;
  insightContent: { title: string; content: string, sourceLogIds?: string[] } | null;
  onCloseInsight: () => void;

  // AI Chat Drawer
  showChat: boolean;
  onCloseChat: () => void;
  chatHistory: ChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  onSendMessage: () => void;
  isChatLoading: boolean;
  chatContextLabel?: string;

  // NEW: Blueprint Modal
  showBlueprint?: boolean;
  blueprintRationale?: string;
  onCloseBlueprint?: () => void;
}

const AcademicModals: React.FC<AcademicModalsProps> = ({
  showWeekly, weeklyReport, onCloseWeekly, onSaveWeekly, onSaveToLibrary, onTraceSource,
  showInsight, insightContent, onCloseInsight,
  showChat, onCloseChat, chatHistory, chatInput, setChatInput, onSendMessage, isChatLoading, chatContextLabel,
  showBlueprint, blueprintRationale, onCloseBlueprint,
  projectId
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const reportContentRef = useRef<HTMLDivElement>(null);
  const blueprintRef = useRef<HTMLDivElement>(null);
  const { showToast, appSettings, setAppSettings, addTaskToActivePlan } = useProjectContext();

  const [isEditingReport, setIsEditingReport] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editedTitle, setEditedTitle] = useState('');
  const [showPushModal, setShowPushModal] = useState(false);
  const [parsedPlanItems, setParsedPlanItems] = useState<string[]>([]);
  const [selectedPlanItems, setSelectedPlanItems] = useState<Set<number>>(new Set());

  // Save to Library Modal State
  const [showLibSaveModal, setShowLibSaveModal] = useState(false);
  const [libSaveTitle, setLibSaveTitle] = useState('');

  useEffect(() => {
    if (showWeekly && weeklyReport) {
      setEditedContent(weeklyReport.content);
      setEditedTitle(weeklyReport.title);
      setLibSaveTitle(weeklyReport.title);
      setIsEditingReport(!weeklyReport.id);
    }
  }, [showWeekly, weeklyReport]);

  useEffect(() => {
    if (chatEndRef.current && showChat) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, showChat]);

  const handleExportWord = () => {
    const content = isEditingReport ? editedContent : weeklyReport?.content;
    const title = isEditingReport ? editedTitle : weeklyReport?.title;
    if (!content || !title) return;

    exportToWord(title, content);
  };

  const handleExportPDF = async (ref: React.RefObject<HTMLDivElement | null>, title: string) => {
    if (!ref.current) {
      showToast?.({ message: '打印目标未就绪', type: 'error' });
      return;
    }
    await printElement(ref.current, title);
  };

  const handleOpenLibSave = () => {
    setLibSaveTitle(isEditingReport ? editedTitle : (weeklyReport?.title || ''));
    setShowLibSaveModal(true);
  };

  const handleConfirmSaveToLibrary = () => {
    const content = isEditingReport ? editedContent : (weeklyReport?.content || '');
    if (onSaveToLibrary) {
      onSaveToLibrary(content, libSaveTitle, weeklyReport?.sourceLogIds);
      setShowLibSaveModal(false);
    }
  };

  const handleSaveAndStay = () => {
    onSaveWeekly(editedContent, editedTitle, weeklyReport?.id, weeklyReport?.sourceLogIds);
    setIsEditingReport(false);
    showToast({ message: '修改已保存至课题记录', type: 'success' });
  };

  const handleTraceSource = () => {
    if (weeklyReport?.sourceLogIds && weeklyReport.sourceLogIds.length > 0) {
      onTraceSource?.(weeklyReport.sourceLogIds);
    } else {
      showToast({ message: '该文档暂无关联的原始实验记录溯源点', type: 'info' });
    }
  };

  const handleOpenPushModal = useCallback(() => {
    const content = isEditingReport ? editedContent : (weeklyReport?.content || '');
    // Match section headings like: ## 下周工作计划 / ## 下月工作计划 / ## 下年工作计划 / ## 下周研究计划 etc.
    const sectionMatch = content.match(/##\s*下[周月年][^\n]*\n([\s\S]*?)(?=\n##|$)/i);
    if (!sectionMatch) {
      showToast({ message: '未找到下周/下月工作计划章节', type: 'info' });
      return;
    }
    const sectionText = sectionMatch[1];
    const items = sectionText
      .split('\n')
      .map(line => line.replace(/^[\s\-\*\d\.]+/, '').trim())
      .filter(line => line.length > 4 && !line.startsWith('#'));
    if (items.length === 0) {
      showToast({ message: '工作计划章节中未找到具体任务条目', type: 'info' });
      return;
    }
    setParsedPlanItems(items);
    setSelectedPlanItems(new Set(items.map((_, i) => i)));
    setShowPushModal(true);
  }, [isEditingReport, editedContent, weeklyReport, showToast]);

  const handleConfirmPush = useCallback(() => {
    if (!projectId || !addTaskToActivePlan) {
      showToast({ message: '无法推送：缺少项目信息', type: 'error' });
      return;
    }
    const itemsToPush = parsedPlanItems.filter((_, i) => selectedPlanItems.has(i));
    if (itemsToPush.length === 0) {
      showToast({ message: '请至少选择一项任务', type: 'info' });
      return;
    }
    itemsToPush.forEach(title => { addTaskToActivePlan(projectId, title); });
    setShowPushModal(false);
    showToast({ message: `已推送 ${itemsToPush.length} 项任务到周计划`, type: 'success' });
  }, [projectId, addTaskToActivePlan, parsedPlanItems, selectedPlanItems, showToast]);

  const toggleFont = () => {
    setAppSettings({ latexStyle: appSettings.latexStyle === 'serif' ? 'sans' : 'serif' });
    showToast({ message: `字体已切换为: ${appSettings.latexStyle === 'serif' ? 'Sans-Serif' : 'Serif'}`, type: 'info' });
  };

  return (
    <>
      {/* 1. Academic Report Modal */}
      {showWeekly && weeklyReport && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1200] flex items-center justify-center p-4 lg:p-10">
          <div className="bg-[#6366f1] w-full max-w-6xl rounded-[3rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] animate-reveal flex flex-col h-[95vh] overflow-hidden border-4 border-white/20">
            <header className="px-10 py-6 shrink-0 no-print">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-10">
                  <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white">学术报告归档</h3>
                  <div className="mt-4 inline-flex items-center gap-2 bg-white/10 rounded-full px-5 py-2 border border-white/10 max-w-2xl group">
                    <p className="text-[11px] font-black uppercase tracking-widest text-white/90 truncate italic">
                      {isEditingReport ? editedTitle : weeklyReport.title}
                    </p>
                    <button onClick={() => setIsEditingReport(true)} className="text-white/40 hover:text-white transition-colors">
                      <i className="fa-solid fa-pen-to-square text-[10px]"></i>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={toggleFont} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border shadow-sm mr-2 font-black text-lg ${appSettings.latexStyle === 'serif' ? 'bg-white text-indigo-600 border-white' : 'bg-white/10 text-white border-white/10 hover:bg-white/20'}`}>A</button>
                  <div className="flex bg-white/10 p-1.5 rounded-2xl border border-white/10 shadow-inner">
                    <button onClick={handleExportWord} className="flex flex-col items-center justify-center w-16 h-12 bg-white rounded-xl text-indigo-700 shadow-lg hover:bg-indigo-50 transition-all active:scale-95 group">
                      <i className="fa-solid fa-file-word text-sm mb-1 group-hover:scale-110 transition-transform"></i>
                      <span className="text-[8px] font-black uppercase">WORD</span>
                    </button>
                    <button onClick={() => handleExportPDF(reportContentRef, editedTitle || weeklyReport.title)} className="flex flex-col items-center justify-center w-16 h-12 bg-[#ffcfd7] rounded-xl text-rose-800 ml-1.5 hover:bg-rose-100 transition-all active:scale-95 group">
                      <i className="fa-solid fa-file-pdf text-sm mb-1 text-rose-600 group-hover:scale-110 transition-transform"></i>
                      <span className="text-[8px] font-black uppercase">PDF</span>
                    </button>
                    <button onClick={handleTraceSource} className="flex flex-col items-center justify-center w-20 h-12 bg-[#2563eb] rounded-xl text-white ml-1.5 hover:bg-blue-700 transition-all active:scale-95 border border-blue-400 shadow-lg group/trace">
                      <i className="fa-solid fa-magnifying-glass-chart text-sm mb-1 text-white group-hover/trace:scale-110 transition-transform"></i>
                      <span className="text-[8px] font-black uppercase">实验溯源</span>
                    </button>
                    {projectId && (
                      <button onClick={handleOpenPushModal} className="flex flex-col items-center justify-center w-20 h-12 bg-emerald-500 rounded-xl text-white ml-1.5 hover:bg-emerald-400 transition-all active:scale-95 border border-emerald-400 shadow-lg group/push">
                        <i className="fa-solid fa-calendar-plus text-sm mb-1 group-hover/push:scale-110 transition-transform"></i>
                        <span className="text-[8px] font-black uppercase">推周计划</span>
                      </button>
                    )}
                    {!weeklyReport.id && (
                      <button onClick={handleOpenLibSave} className="flex flex-col items-center justify-center w-16 h-12 bg-white/20 rounded-xl text-white ml-1.5 border border-white/20 hover:bg-white/30 transition-all active:scale-95">
                        <i className="fa-solid fa-folder-tree text-sm mb-1"></i>
                        <span className="text-[8px] font-black uppercase">存档</span>
                      </button>
                    )}
                  </div>
                  <div className="w-px h-10 bg-white/20 mx-2"></div>
                  <button onClick={handleSaveAndStay} className="px-8 h-12 bg-[#10b981] text-white rounded-2xl text-[11px] font-black uppercase shadow-xl active:scale-95 transition-all hover:bg-emerald-400 border border-emerald-400/50 flex items-center gap-2">
                    <i className="fa-solid fa-check-circle text-sm"></i> 保存修改
                  </button>
                  <button onClick={onCloseWeekly} className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all text-white/80"><i className="fa-solid fa-times text-xl"></i></button>
                </div>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-10 lg:p-16 custom-scrollbar bg-[#f1f5f9] relative">
              <div ref={reportContentRef} className="bg-white p-12 lg:p-20 rounded-2xl lg:rounded-[4rem] shadow-2xl border border-slate-200 min-h-full max-w-5xl mx-auto scientific-report-layout is-printing-target relative">
                <div className="relative min-h-[70vh]">
                  {isEditingReport ? (
                    <div className="flex flex-col h-full gap-6">
                      <input className={`w-full text-2xl font-black text-slate-800 outline-none border-b border-indigo-100 pb-4 focus:border-indigo-400 transition-all italic ${appSettings.latexStyle === 'serif' ? 'font-serif' : 'font-sans'}`} value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} placeholder="报告标题..." />
                      <textarea className={`w-full flex-1 min-h-[50vh] text-[16px] font-medium text-slate-800 leading-relaxed bg-transparent outline-none transition-all resize-none custom-scrollbar ${appSettings.latexStyle === 'serif' ? 'font-serif' : 'font-sans'}`} value={editedContent} onChange={(e) => setEditedContent(e.target.value)} placeholder="在此编辑研究内容..." />
                    </div>
                  ) : (<ScientificMarkdown content={editedContent} />)}
                  <div className="mt-24 pt-12 border-t border-slate-100 flex flex-col items-center gap-3">
                    <p className="text-[11px] font-black text-indigo-400/80 uppercase bg-indigo-50 px-6 py-1.5 rounded-full border border-indigo-100/50 shadow-sm tracking-widest">SCIFLOW INTELLIGENT RESEARCH ARCHIVE</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Blueprint Modal - NEW */}
      {showBlueprint && blueprintRationale && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[2500] flex items-center justify-center p-4 lg:p-12">
          <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[4rem] shadow-2xl flex flex-col overflow-hidden border-4 border-white/20 animate-reveal">
            <header className="px-10 py-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-indigo-500/20">
                  <i className="fa-solid fa-map-location-dot text-xl"></i>
                </div>
                <div>
                  <h3 className="text-2xl font-black italic uppercase tracking-tighter">AI 科学研究蓝图</h3>
                  <p className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3rem] mt-1">Research Strategy & Logic Framework</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleExportPDF(blueprintRef, "Research_Blueprint")}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-500 transition-all flex items-center gap-2"
                >
                  <i className="fa-solid fa-file-pdf"></i> 导出蓝图
                </button>
                <button onClick={onCloseBlueprint} className="w-11 h-11 rounded-2xl bg-white/10 hover:bg-rose-500 transition-all flex items-center justify-center"><i className="fa-solid fa-times text-xl"></i></button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-12 lg:p-20 custom-scrollbar bg-slate-50">
              <div ref={blueprintRef} className="max-w-4xl mx-auto bg-white p-12 lg:p-16 rounded-[3rem] shadow-xl border border-slate-100 relative is-printing-target">
                <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none">
                  <i className="fa-solid fa-brain text-[15rem]"></i>
                </div>
                <ScientificMarkdown content={blueprintRationale} />
                <div className="mt-16 pt-8 border-t border-slate-100 flex justify-between items-center opacity-50">
                  <p className="text-[9px] font-black text-slate-400 uppercase italic">Verification Code: SF-GEN-BLUEPRINT-V4</p>
                  <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">SciFlow Intelligence Systems</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save to Library Naming Modal */}
      {showLibSaveModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[2000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-10 animate-reveal shadow-2xl border-4 border-white text-center">
            <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-3xl shadow-inner border-2 border-dashed border-indigo-200">
              <i className="fa-solid fa-folder-plus"></i>
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2 uppercase italic tracking-tighter">存入节点文档库</h3>
            <input autoFocus className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm font-black outline-none shadow-inner mb-8 text-center" value={libSaveTitle} onChange={e => setLibSaveTitle(e.target.value)} />
            <div className="flex gap-4">
              <button onClick={() => setShowLibSaveModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase">取消</button>
              <button onClick={handleConfirmSaveToLibrary} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl">确认存档</button>
            </div>
          </div>
        </div>
      )}

      {/* Push Plan to Weekly Plan Modal */}
      {showPushModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[2100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 animate-reveal shadow-2xl border-4 border-emerald-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-[1.5rem] flex items-center justify-center text-2xl shadow-inner border-2 border-dashed border-emerald-200">
                <i className="fa-solid fa-calendar-plus"></i>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter">推送到周计划</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase mt-1">选择要推送的任务条目</p>
              </div>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar mb-6 pr-1">
              {parsedPlanItems.map((item, i) => (
                <label key={i} className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${selectedPlanItems.has(i) ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                  <input
                    type="checkbox"
                    checked={selectedPlanItems.has(i)}
                    onChange={() => {
                      const next = new Set(selectedPlanItems);
                      if (next.has(i)) next.delete(i); else next.add(i);
                      setSelectedPlanItems(next);
                    }}
                    className="mt-0.5 accent-emerald-600 shrink-0"
                  />
                  <span className="text-[12px] font-medium text-slate-700 leading-relaxed">{item}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowPushModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase">取消</button>
              <button onClick={handleConfirmPush} className="flex-[2] py-4 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-emerald-500 transition-all">
                推送 {[...selectedPlanItems].length} 项到周计划
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Insight View Modal */}
      {showInsight && insightContent && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1300] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] p-10 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[85vh]">
            <button onClick={onCloseInsight} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-all"><i className="fa-solid fa-times text-2xl"></i></button>
            <h3 className="text-xl font-black text-slate-800 mb-6 uppercase italic border-l-8 border-amber-500 pl-6 shrink-0">{insightContent.title}</h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 italic leading-relaxed text-slate-700 font-medium">
              <div className="border-2 border-dashed border-amber-400/30 rounded-2xl p-6 bg-amber-50/10">
                <ScientificMarkdown content={insightContent.content} />
              </div>
            </div>
            {insightContent.sourceLogIds && insightContent.sourceLogIds.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                <button onClick={() => { onCloseInsight(); onTraceSource?.(insightContent.sourceLogIds!); }} className="px-5 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 transition-all flex items-center gap-2"><i className="fa-solid fa-magnifying-glass-chart"></i> 数据溯源</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Chat Drawer */}
      {showChat && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[2000] flex justify-end">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 border-l-4 border-indigo-600">
            <header className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-lg font-black uppercase italic flex items-center gap-2"><i className="fa-solid fa-user-astronaut text-amber-400"></i> 研究助理</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 truncate max-w-[300px]" title={chatContextLabel}>Context: {chatContextLabel}</p>
              </div>
              <button onClick={onCloseChat} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-rose-500 transition-all flex items-center justify-center"><i className="fa-solid fa-xmark"></i></button>
            </header>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/30">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'}`}>
                    <div className="markdown-body text-[13px]"><ScientificMarkdown content={msg.text} /></div>
                    <p className={`text-[8px] mt-2 font-black uppercase ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-300'}`}>{msg.timestamp}</p>
                  </div>
                </div>
              ))}
              {isChatLoading && <div className="flex justify-start"><div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2"><i className="fa-solid fa-spinner animate-spin text-indigo-600"></i><span className="text-[10px] font-black text-slate-400 uppercase">思考中...</span></div></div>}
              <div ref={chatEndRef}></div>
            </div>
            <div className="p-6 bg-white border-t border-slate-100">
              <div className="relative flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                <textarea className="flex-1 bg-transparent border-none p-3 text-sm font-medium outline-none resize-none max-h-32" placeholder="向 AI 提问机理或诊断建议..." rows={1} value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendMessage(); } }} />
                <button onClick={onSendMessage} disabled={!chatInput.trim() || isChatLoading} className="w-10 h-10 bg-indigo-600 text-white rounded-xl shadow-lg active:scale-90 transition-all disabled:opacity-30"><i className="fa-solid fa-paper-plane text-xs"></i></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AcademicModals;
