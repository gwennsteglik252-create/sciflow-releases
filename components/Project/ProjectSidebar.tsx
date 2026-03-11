
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Milestone } from '../../types';
import TrlNavigator from './TrlNavigator';
import NodeTree from './NodeTree';
import { useProjectContext } from '../../context/ProjectContext';

interface ProjectSidebarProps {
  trl: number;
  onTrlChange: (trl: number) => void;
  milestones: Milestone[];
  selectedMilestoneId: string | null;
  onSelectMilestone: (id: string) => void;
  foldedNodeIds: Set<string>;
  onToggleFold: (id: string, e: React.MouseEvent) => void;
  onMoveNode: (id: string, dir: 'up' | 'down', e: React.MouseEvent) => void;
  onBranchNode: (id: string, e: React.MouseEvent) => void;
  onEditNode: (ms: Milestone, e: React.MouseEvent) => void;
  onDeleteNode: (id: string, e: React.MouseEvent) => void;
  onAddNode: () => void;
  onShowBlueprint?: () => void;
  hasBlueprint?: boolean;
  onManageChapters?: () => void;
  onSortNodes?: () => void;
  onReorderNode?: (dragId: string, dropId: string) => void;
  // New: AI generate from input (image + text)
  onGenerateFromInput?: (imageBase64?: string, imageMimeType?: string, textPrompt?: string) => Promise<void>;
}

const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  trl, onTrlChange, milestones, selectedMilestoneId, onSelectMilestone,
  foldedNodeIds, onToggleFold, onMoveNode, onBranchNode, onEditNode, onDeleteNode, onAddNode,
  onShowBlueprint, hasBlueprint, onManageChapters,
  onSortNodes,
  onReorderNode,
  onGenerateFromInput,
}) => {
  const { activeTasks } = useProjectContext();
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [textPrompt, setTextPrompt] = useState('');
  const [uploadedImage, setUploadedImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const isGeneratingNodes = useMemo(() =>
    activeTasks.some(t => t.id === 'milestone_gen' && t.status === 'running'),
    [activeTasks]);

  // ── 图片处理 ──
  const processImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(',')[1];
      setUploadedImage({ base64, mimeType: file.type, preview: dataUrl });
    };
    reader.readAsDataURL(file);
  }, []);

  // 粘贴图片（Ctrl+V / Cmd+V）
  useEffect(() => {
    if (!showAiPanel) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || []);
      const imageItem = items.find(item => item.type.startsWith('image/'));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) processImageFile(file);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [showAiPanel, processImageFile]);

  // 拖拽上传
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingOver(true); };
  const handleDragLeave = () => setIsDraggingOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processImageFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
    e.target.value = '';
  };

  const handleGenerate = async () => {
    if (!onGenerateFromInput) return;
    if (!uploadedImage && !textPrompt.trim()) return;
    await onGenerateFromInput(uploadedImage?.base64, uploadedImage?.mimeType, textPrompt);
    // 成功后清空
    setUploadedImage(null);
    setTextPrompt('');
    setShowAiPanel(false);
  };

  const canGenerate = !isGeneratingNodes && (!!uploadedImage || !!textPrompt.trim());

  return (
    <div className="col-span-1 lg:col-span-3 flex flex-col gap-1 min-h-[300px] lg:h-[calc(100vh-110px)] overflow-hidden">
      <TrlNavigator currentTrl={trl} onTrlChange={onTrlChange} />

      <div className="flex justify-between items-center px-1 shrink-0 mt-6 mb-2">
        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">拓扑节点</h3>
        <div className="flex gap-2">
          {/* AI 生成按钮 */}
          {onGenerateFromInput && (
            <button
              onClick={() => setShowAiPanel(!showAiPanel)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all border-2 active:scale-95 ${showAiPanel ? 'bg-violet-600 text-white border-violet-500' : 'bg-white text-violet-500 border-violet-100 hover:bg-violet-50'}`}
              title="AI 智能生成（截图或文字）"
            >
              <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>
            </button>
          )}

          <button
            onClick={onShowBlueprint}
            disabled={!hasBlueprint}
            className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg active:scale-95 shrink-0 transition-all border-2 ${hasBlueprint
                ? 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-600 hover:text-white animate-pulse-subtle'
                : 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50'
              }`}
            title={hasBlueprint ? "查看 AI 研究蓝图" : "暂未生成研究蓝图，请先使用 AI 生成路线"}
          >
            <i className="fa-solid fa-map-location-dot text-xs"></i>
          </button>

          <button
            onClick={onAddNode}
            disabled={isGeneratingNodes}
            className="w-10 h-10 bg-indigo-50 text-indigo-600 border-2 border-indigo-200 rounded-xl flex items-center justify-center shadow-lg active:scale-95 shrink-0 hover:bg-indigo-600 hover:text-white transition-all group/add disabled:opacity-50"
            title="新增节点"
          >
            <i className="fa-solid fa-plus text-xs"></i>
          </button>

          {onSortNodes && (
            <button
              onClick={(e) => { e.stopPropagation(); onSortNodes(); }}
              disabled={isGeneratingNodes}
              className="w-10 h-10 bg-indigo-50 text-indigo-600 border-2 border-indigo-200 rounded-xl flex items-center justify-center shadow-lg active:scale-95 shrink-0 hover:bg-indigo-600 hover:text-white transition-all group/sort disabled:opacity-50"
              title="排序节点"
            >
              <i className="fa-solid fa-arrow-down-short-wide text-xs"></i>
            </button>
          )}
        </div>
      </div>

      {/* AI 生成面板（可展开） */}
      {showAiPanel && onGenerateFromInput && (
        <div className="mx-1 mb-3 rounded-2xl border border-violet-200 bg-gradient-to-b from-violet-50 to-white shadow-lg overflow-hidden shrink-0">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 pt-3.5 pb-2 border-b border-violet-100">
            <div className="w-6 h-6 rounded-lg bg-violet-600 flex items-center justify-center">
              <i className="fa-solid fa-brain text-white text-[10px]"></i>
            </div>
            <span className="text-[11px] font-black text-violet-700 uppercase tracking-widest">AI 智能生成路线</span>
          </div>

          <div className="p-3 space-y-3">
            {/* 图片上传区域 */}
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !uploadedImage && fileInputRef.current?.click()}
              className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden
                ${isDraggingOver
                  ? 'border-violet-400 bg-violet-100'
                  : uploadedImage
                    ? 'border-violet-300 bg-violet-50 cursor-default'
                    : 'border-slate-200 bg-slate-50 hover:border-violet-300 hover:bg-violet-50/50'
                }`}
            >
              {uploadedImage ? (
                <div className="relative">
                  <img
                    src={uploadedImage.preview}
                    alt="上传截图预览"
                    className="w-full max-h-36 object-contain rounded-xl"
                  />
                  {/* 删除按钮 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setUploadedImage(null); }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all shadow-md"
                  >
                    <i className="fa-solid fa-xmark text-[9px]"></i>
                  </button>
                  <div className="absolute bottom-1.5 left-1.5 bg-black/50 text-white text-[9px] font-bold rounded-md px-2 py-0.5 backdrop-blur-sm">
                    <i className="fa-solid fa-check-circle mr-1 text-emerald-400"></i>截图已就绪
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-5 gap-2">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                    <i className={`fa-solid ${isDraggingOver ? 'fa-cloud-arrow-down animate-bounce' : 'fa-image'} text-violet-400 text-base`}></i>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-slate-600">拖拽 / 点击上传截图</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      或 <kbd className="bg-slate-100 border border-slate-200 rounded px-1 py-px font-mono text-[8px]">⌘V</kbd> 直接粘贴
                    </p>
                  </div>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* 分隔线 */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-slate-100"></div>
              <span className="text-[9px] font-black text-slate-300 uppercase">或</span>
              <div className="flex-1 h-px bg-slate-100"></div>
            </div>

            {/* 文字描述 */}
            <textarea
              value={textPrompt}
              onChange={(e) => setTextPrompt(e.target.value)}
              placeholder="输入描述文字（e.g. 从样本制备到电化学测试的全流程……）"
              className="w-full h-20 bg-white border border-slate-200 rounded-xl p-3 text-[10px] font-medium text-slate-700 placeholder-slate-300 outline-none resize-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition"
            />

            {/* 操作提示 */}
            <p className="text-[8.5px] text-slate-400 leading-relaxed px-0.5">
              <i className="fa-solid fa-circle-info mr-1 text-violet-300"></i>
              可单独使用截图或文字，也可两者组合，生成的节点会追加至当前拓扑
            </p>

            {/* 生成按钮 */}
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={`w-full py-3 rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md
                ${canGenerate
                  ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-violet-200'
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                }`}
            >
              {isGeneratingNodes ? (
                <><i className="fa-solid fa-circle-notch animate-spin"></i> AI 解析中...</>
              ) : (
                <><i className="fa-solid fa-bolt"></i> {uploadedImage ? '解析截图并生成' : '生成研究路线'}</>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        <NodeTree
          milestones={milestones}
          selectedId={selectedMilestoneId}
          onSelect={onSelectMilestone}
          foldedIds={foldedNodeIds}
          onToggleFold={onToggleFold}
          onMove={onMoveNode}
          onBranch={onBranchNode}
          onEdit={onEditNode}
          onDelete={onDeleteNode}
          onReorder={onReorderNode}
        />
      </div>

      <style>{`
        @keyframes pulse-subtle {
          0% { border-color: rgba(99, 102, 241, 0.2); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          50% { border-color: rgba(99, 102, 241, 0.8); box-shadow: 0 0 12px rgba(99, 102, 241, 0.3); }
          100% { border-color: rgba(99, 102, 241, 0.2); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        }
        .animate-pulse-subtle { animation: pulse-subtle 2s infinite ease-in-out; }
      `}</style>
    </div>
  );
};

export default ProjectSidebar;
