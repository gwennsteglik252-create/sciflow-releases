
import React, { useState, useEffect, useCallback } from 'react';
import { generateCaptionOptions, detectSubFigures, generateImageAnalysis } from '../services/gemini';
import { MediaGallery } from './ScientificFigureStudio/MediaGallery';
import { ImageViewer } from './ScientificFigureStudio/ImageViewer';
import { CaptionTab } from './ScientificFigureStudio/CaptionTab';
import { AnalysisTab } from './ScientificFigureStudio/AnalysisTab';
import { AssetEditModal } from './ScientificFigureStudio/AssetEditModal';
import { useTranslation } from '../locales/useTranslation';

interface ProjectMediaItem {
  name: string;
  url: string;
  description?: string;
  logTimestamp?: string;
  refId?: string;
  logId: string;
  fileIndex: number;
  subFigures?: { label: string; desc: string }[];
}

interface ScientificFigureStudioProps {
  projectMedia: ProjectMediaItem[];
  onUpdateAsset: (media: ProjectMediaItem, newName: string, newCaption: string, subFigures?: { label: string; desc: string }[]) => void;
  onClose: () => void;
  isActive: boolean;
  initialRefId?: string | null;
  onInsert?: (text: string) => void;
  language?: 'zh' | 'en';
  project?: { paperSections?: { id: string; content?: string }[] };
}

interface SubFigure {
  id: string;
  label: string;
  desc: string;
}

const ScientificFigureStudio: React.FC<ScientificFigureStudioProps> = ({
  projectMedia, onUpdateAsset, onClose, isActive, initialRefId, onInsert, language = 'zh', project
}) => {
  const [selectedMedia, setSelectedMedia] = useState<ProjectMediaItem | null>(null);
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'caption' | 'analysis'>('caption');

  const [generatedCaption, setGeneratedCaption] = useState('');
  const [captionOptions, setCaptionOptions] = useState<any[]>([]);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number>(-1);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [isAnalyzingSub, setIsAnalyzingSub] = useState(false);

  const [analysisText, setAnalysisText] = useState('');
  const [analysisContext, setAnalysisContext] = useState('');
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);

  const [isCompositeMode, setIsCompositeMode] = useState(true);
  const [subFigures, setSubFigures] = useState<SubFigure[]>([]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // 记录上一次被选中的图片refId，防止因为外部状态更新导致组件内部生成的新内容被意外清空
  const currentEditingRefId = React.useRef<string | null>(null);

  // 记录上次处理的 initialRefId，防止保存后 projectMedia 更新重复触发初始选择
  const lastInitialRefId = React.useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (isActive) {
      // 仅在面板刚激活或 initialRefId 真正变化时执行初始选择
      if (lastInitialRefId.current !== initialRefId) {
        lastInitialRefId.current = initialRefId;
        if (initialRefId) {
          const found = projectMedia.find(m => m.refId === initialRefId);
          if (found) { setSelectedMedia(found); return; }
        }
        if (projectMedia.length > 0 && !selectedMedia) {
          setSelectedMedia(projectMedia[0]);
        }
      } else if (selectedMedia) {
        // projectMedia 更新（如保存后），仅同步当前选中项的最新数据
        const updated = projectMedia.find(m => m.refId === selectedMedia.refId);
        if (updated && updated !== selectedMedia) {
          setSelectedMedia(updated);
        }
      } else if (projectMedia.length > 0) {
        setSelectedMedia(projectMedia[0]);
      }
    } else {
      lastInitialRefId.current = undefined;
    }
  }, [isActive, projectMedia, initialRefId]);

  useEffect(() => {
    if (selectedMedia) {
      if (currentEditingRefId.current !== selectedMedia.refId) {
        // 当真正切换图片时才重置状态
        currentEditingRefId.current = selectedMedia.refId || null;
        const fullDesc = selectedMedia.description || '';
        const parts = fullDesc.split(/\s*\[Analysis\]\s*/i);
        setGeneratedCaption(parts[0] || '');
        // 清除历史遗留的 [Fig:xxx] 标签（旧版代码曾错误地将其嵌入分析文本）
        setAnalysisText((parts[1] || '').replace(/\s*\[Fig:[^\]]*\]/g, ''));
        setCaptionOptions([]);
        setSelectedOptionIndex(-1);
        // 从持久化数据恢复子图信息
        const savedSubs = selectedMedia.subFigures;
        if (savedSubs && savedSubs.length > 0) {
          setIsCompositeMode(true);
          setSubFigures(savedSubs.map(s => ({ id: Math.random().toString(), label: s.label, desc: s.desc })));
        } else {
          setIsCompositeMode(true);
          setSubFigures([]);
        }
        setAnalysisContext('');
      } else {
        // 如果只是保存导致的对象引用更新（id相同），且当前内容为空，则补充
        if (!generatedCaption && !analysisText) {
          const fullDesc = selectedMedia.description || '';
          const parts = fullDesc.split(/\s*\[Analysis\]\s*/i);
          setGeneratedCaption(parts[0] || '');
          setAnalysisText((parts[1] || '').replace(/\s*\[Fig:[^\]]*\]/g, ''));
        }
      }
    }
  }, [selectedMedia]);

  const urlToBase64 = async (url: string): Promise<string> => {
    if (url.startsWith('data:image')) return url;
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Failed to fetch image for base64 conversion:", e);
      // Fallback or return empty to allow UI to handle error
      return "";
    }
  };

  const getFigureNumber = useCallback((refId: string): number => {
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
  }, [project?.paperSections]);

  const handleGenerateOptions = async () => {
    if (!selectedMedia) return;
    setIsGeneratingCaption(true); setIsAnalyzingImage(true);
    try {
      const base64Data = await urlToBase64(selectedMedia.url);
      if (!base64Data) {
        alert("无法访问该图片资源（可能是跨域限制），AI 分析暂时受限。");
        return;
      }
      const descriptionContext = selectedMedia.description?.split(/\s*\[Analysis\]\s*/i)[0] || selectedMedia.name;
      const subCaptions = isCompositeMode && subFigures.length > 0 ? subFigures.map(f => ({ label: f.label, desc: f.desc })) : [];
      const results = (await Promise.all([
        generateCaptionOptions(descriptionContext, subCaptions, base64Data, language as 'zh' | 'en'),
        generateImageAnalysis(base64Data, analysisContext || descriptionContext, subCaptions, language as 'zh' | 'en')
      ])) as [any[], string];
      const [options, analysis] = results;
      if (Array.isArray(options) && options.length > 0) {
        setCaptionOptions(options); setGeneratedCaption(options[0].text); setSelectedOptionIndex(0);
      }
      setAnalysisText(analysis || "");
    } catch (error) {
      console.error(error);
      alert("AI 引擎调用异常。");
    } finally {
      setIsGeneratingCaption(false); setIsAnalyzingImage(false);
    }
  };

  const handleQuickSave = () => {
    if (!selectedMedia) return;

    // 获取当前数据库里存的老数据，防止因为组件 State 未初始化完成被覆盖
    const oldParts = (selectedMedia.description || '').split(/\s*\[Analysis\]\s*/i);
    const oldCaption = (oldParts[0] || '').trim();
    const oldAnalysis = (oldParts.length > 1 ? oldParts[1] : '').trim();

    // 如果 State 里有值（即用户新生成或手动输入过），则使用新值；否则保持原有老值不丢失
    const baseCaption = generatedCaption !== '' ? generatedCaption.trim() : oldCaption;
    const baseAnalysis = analysisText !== '' ? analysisText.trim() : oldAnalysis;

    let fullDescription = baseCaption;
    // 缝合新老状态，保证标签的完整性
    if (baseAnalysis) {
      fullDescription += `\n\n[Analysis]\n\n${baseAnalysis}`;
    }

    // 持久化子图信息
    const subFiguresToSave = subFigures.length > 0 ? subFigures.map(f => ({ label: f.label, desc: f.desc })) : undefined;

    // 线上调试日志
    console.log("Saving secured image metadata:", { name: selectedMedia.name, fullDescription, subFigures: subFiguresToSave });

    onUpdateAsset(selectedMedia, selectedMedia.name, fullDescription, subFiguresToSave);
  };

  const handleInsertImage = (isFull: boolean = false) => {
    if (selectedMedia && onInsert) onInsert(isFull ? `[Fig:${selectedMedia.refId}:Full]` : `[Fig:${selectedMedia.refId}]`);
  };

  return (
    <div className={`fixed inset-0 bg-slate-200/50 backdrop-blur-sm z-[2000] flex items-center justify-center p-6 animate-in fade-in duration-300 ${!isActive ? 'pointer-events-none opacity-0 invisible' : ''}`} style={{ transition: 'opacity 200ms, visibility 200ms' }}>
      <div className="bg-white w-full max-w-6xl h-[85vh] rounded-[2rem] shadow-2xl border border-slate-200 flex overflow-hidden relative">
        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-500 hover:text-white flex items-center justify-center text-slate-400 transition-all z-50">
          <i className="fa-solid fa-times"></i>
        </button>

        <MediaGallery
          projectMedia={projectMedia}
          selectedMedia={selectedMedia}
          onSelect={setSelectedMedia}
          onEdit={(m, e) => { setSelectedMedia(m); setEditName(m.name); setEditDescription(m.description || ''); setIsEditModalOpen(true); }}
          getFigureNumber={getFigureNumber}
        />

        <ImageViewer selectedMedia={selectedMedia} />

        <div className="w-96 bg-white border-l border-slate-200 flex flex-col p-6 shrink-0">
          <div className="mb-4">
            <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-1">{t('figureStudio.title')}</h4>
            <p className="text-[9px] text-slate-400 font-bold">Scientific Image Assistant</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
            <button onClick={() => setActiveTab('caption')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'caption' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>{t('figureStudio.captionTab')}</button>
            <button onClick={() => setActiveTab('analysis')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'analysis' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>{t('figureStudio.analysisTab')}</button>
          </div>

          {activeTab === 'caption' ? (
            <CaptionTab
              isCompositeMode={isCompositeMode} setIsCompositeMode={setIsCompositeMode}
              subFigures={subFigures} onAddSubFigure={() => setSubFigures([...subFigures, { id: Date.now().toString(), label: String.fromCharCode(97 + subFigures.length), desc: '' }])}
              onRemoveSubFigure={(idx) => setSubFigures(subFigures.filter((_, i) => i !== idx).map((f, i) => ({ ...f, label: String.fromCharCode(97 + i) })))}
              onSubFigureChange={(idx, val) => { const n = [...subFigures]; n[idx].desc = val; setSubFigures(n); }}
              onAutoDetect={async () => {
                if (!selectedMedia) return; setIsAnalyzingSub(true);
                const mediaRef = selectedMedia; // 捕获当前 media 引用，防止闭包中引用已变
                try {
                  const base64 = await urlToBase64(mediaRef.url);
                  if (!base64) return;
                  const detected = await detectSubFigures(base64, language as 'zh' | 'en');
                  if (detected?.length) {
                    const newSubs = detected.map((d: any) => ({ id: Math.random().toString(), label: d.label, desc: d.desc || "" }));
                    setSubFigures(newSubs);
                    // 自动持久化识别结果，即使用户随后关闭弹窗也不会丢失
                    onUpdateAsset(mediaRef, mediaRef.name, mediaRef.description || '', newSubs.map(f => ({ label: f.label, desc: f.desc })));
                  }
                } finally { setIsAnalyzingSub(false); }
              }}
              isAnalyzingSub={isAnalyzingSub} captionOptions={captionOptions} selectedOptionIndex={selectedOptionIndex}
              onSelectOption={(idx) => { setSelectedOptionIndex(idx); setGeneratedCaption(captionOptions[idx].text); }}
              generatedCaption={generatedCaption} setGeneratedCaption={setGeneratedCaption}
              isGenerating={isGeneratingCaption} onGenerate={handleGenerateOptions} onQuickSave={handleQuickSave}
              onInsert={handleInsertImage} selectedMedia={selectedMedia}
            />
          ) : (
            <AnalysisTab
              analysisContext={analysisContext} setAnalysisContext={setAnalysisContext}
              analysisText={analysisText} setAnalysisText={setAnalysisText}
              isAnalyzing={isAnalyzingImage} onGenerate={async (detailLevel) => {
                if (!selectedMedia) return; setIsAnalyzingImage(true);
                try {
                  const base64 = await urlToBase64(selectedMedia.url);
                  if (!base64) return;
                  const res = await generateImageAnalysis(base64, analysisContext || selectedMedia.name, isCompositeMode ? subFigures : undefined, language as 'zh' | 'en', detailLevel);
                  setAnalysisText(res);
                } finally { setIsAnalyzingImage(false); }
              }}
              onInsert={() => {
                let cleanText = analysisText.trim().replace(/\s*\[Fig:[^\]]*\]/g, '');
                // 将 AI 生成的图序号替换为动态引用标签 [FigRef:refId]，预览时自动解析为实际序号
                const refTag = `[FigRef:${selectedMedia?.refId}]`;
                cleanText = cleanText.replace(/(图\s*)\d+/g, `$1${refTag}`);
                cleanText = cleanText.replace(/(Figure\s*)\d+/gi, `$1${refTag}`);
                cleanText = cleanText.replace(/(Fig\.\s*)\d+/gi, `$1${refTag}`);
                onInsert?.(cleanText);
              }}
              onQuickSave={handleQuickSave} selectedMedia={selectedMedia} onCopyToClipboard={() => { navigator.clipboard.writeText(analysisText); }}
            />
          )}
        </div>
      </div>

      <AssetEditModal
        isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}
        editName={editName} setEditName={setEditName} editDescription={editDescription} setEditDescription={setEditDescription}
        onSave={() => { if (!selectedMedia) return; onUpdateAsset(selectedMedia, editName, editDescription); setIsEditModalOpen(false); }}
      />
    </div>
  );
};

export default ScientificFigureStudio;
