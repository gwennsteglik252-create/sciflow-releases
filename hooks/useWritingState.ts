
import { useState, useMemo, useRef, useEffect } from 'react';
import { ResearchProject, Literature, PaperSectionId, AuthorProfile, ManuscriptMeta, WritingSnapshot, Milestone, PaperSection, ProjectTable, ProjectLatexSnippet } from '../types';
import { SECTION_CONFIG, TEMPLATES, DocType, TemplateConfig } from '../components/Writing/WritingConfig';
import { useProjectContext } from '../context/ProjectContext';

interface UseWritingStateProps {
  projects: ResearchProject[];
  initialProjectId?: string;
  initialSubView?: string;
}

export const useWritingState = ({
  projects,
  initialProjectId,
  initialSubView
}: UseWritingStateProps) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || projects[0]?.id || '');
  const [docType, setDocType] = useState<DocType>('paper');

  const [language, setLanguage] = useState<'zh' | 'en'>(() => {
    try {
      const saved = localStorage.getItem('sciflow_writing_language');
      return (saved === 'en' || saved === 'zh') ? saved : 'zh';
    } catch {
      return 'zh';
    }
  });
  const { writingSession, updateWritingSession } = useProjectContext();

  const activeTab = writingSession.activeTab;
  const setActiveTab = (tab: string) => updateWritingSession({ activeTab: tab });

  const activeMediaSubTab = writingSession.activeMediaSubTab;
  const setActiveMediaSubTab = (sub: 'images' | 'tables' | 'latex') => updateWritingSession({ activeMediaSubTab: sub });

  const activeSectionId = writingSession.activeSectionId;
  const setActiveSectionId = (id: string) => updateWritingSession({ activeSectionId: id });

  const [expandedMilestoneIds, setExpandedMilestoneIds] = useState<Set<string>>(new Set());

  // 核心：editorContent 用于编辑器绑定，syncedContent 用于预览页绑定
  const [editorContent, setEditorContent] = useState('');
  const [syncedContent, setSyncedContent] = useState('');

  const [highlightedResourceIds, setHighlightedResourceIds] = useState<string[]>([]);

  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const textareaRef = useRef<HTMLTextAreaElement>(null!);
  const cursorPositionRef = useRef<{ start: number, end: number } | null>(null);
  const saveTimeoutRef = useRef<any>(null);

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [reviewResult, setReviewResult] = useState<any>(null);
  const [appliedCritiqueQuotes, setAppliedCritiqueQuotes] = useState<Set<string>>(new Set());

  const [templates, setTemplates] = useState<TemplateConfig[]>(TEMPLATES);
  const [activeTemplateId, setActiveTemplateId] = useState('csb_zh');

  const [manuscriptMeta, setManuscriptMeta] = useState<ManuscriptMeta>({
    title: '',
    runningTitle: '',
    keywords: '',
    authorList: [
      { id: '1', name: 'Dr. Luo', email: 'luo@sciflow.lab', affiliation: 'SciFlow Lab, Institute of Future Energy', isCorresponding: true, isCoFirst: false },
      { id: '2', name: 'Sarah Chen', email: 'sarah@sciflow.lab', affiliation: 'SciFlow Lab, Institute of Future Energy', isCorresponding: false, isCoFirst: true }
    ],
    outlineStyles: {
      h1: { fontSize: 12, indent: 0, fontWeight: 'bold' as const, fontStyle: 'normal' as const, fontFamily: 'SimHei, sans-serif', numberingType: 'arabic' as const },
      h2: { fontSize: 10.5, indent: 0, fontWeight: 'bold' as const, fontStyle: 'normal' as const, fontFamily: 'SimHei, sans-serif', numberingType: 'arabic' as const },
      h3: { fontSize: 9.5, indent: 0, fontWeight: 'normal' as const, fontStyle: 'normal' as const, fontFamily: 'SimHei, sans-serif', numberingType: 'arabic' as const }
    }
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<any>(null);
  const [showFigureStudio, setShowFigureStudio] = useState(false);
  const [figureStudioTarget, setFigureStudioTarget] = useState<string | null>(null);
  const [tableEditorTarget, setTableEditorTarget] = useState<ProjectTable | null>(null);
  const [mathEditorTarget, setMathEditorTarget] = useState<ProjectLatexSnippet | null>(null);

  const [isJumpingManual, setIsJumpingManual] = useState(false);

  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
  const activeTemplate = useMemo(() => templates.find(t => t.id === activeTemplateId) || templates[0], [activeTemplateId, templates]);
  const currentSections = useMemo(() => SECTION_CONFIG[docType], [docType]);

  const projectMedia = useMemo(() => {
    if (!selectedProject) return [];
    const media: any[] = [];
    if (selectedProject.media) {
      selectedProject.media.forEach((f, idx) => {
        if (f.url && f.url !== '#' && (f.url.startsWith('data:image') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(f.name))) {
          const stableId = f.refId || `IMG_PROJ_${idx}`;
          media.push({ ...f, refId: stableId, logId: 'PROJECT_LEVEL', fileIndex: idx, logTimestamp: new Date().toISOString() });
        }
      });
    }
    (selectedProject.milestones ?? []).forEach(m => {
      (m.logs ?? []).forEach(l => {
        if (l.files) {
          l.files.forEach((f, idx) => {
            if (f.url && f.url !== '#' && (f.url.startsWith('data:image') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(f.name))) {
              const stableId = f.refId || `IMG_${l.id.slice(-4)}_${idx}`;
              media.push({ ...f, refId: stableId, logId: l.id, fileIndex: idx, logTimestamp: l.timestamp });
            }
          });
        }
      });
    });
    return media;
  }, [selectedProject]);

  return {
    selectedProjectId, setSelectedProjectId,
    docType, setDocType,
    language, setLanguage,
    activeTab, setActiveTab,
    activeMediaSubTab, setActiveMediaSubTab,
    activeSectionId, setActiveSectionId,
    expandedMilestoneIds, setExpandedMilestoneIds,
    editorContent, setEditorContent,
    syncedContent, setSyncedContent,
    history, setHistory,
    historyIndex, setHistoryIndex,
    highlightedResourceIds, setHighlightedResourceIds,
    saveStatus, setSaveStatus,
    lastSavedTime, setLastSavedTime,
    selectedLogIds, setSelectedLogIds,
    reviewResult, setReviewResult,
    appliedCritiqueQuotes, setAppliedCritiqueQuotes,
    templates, setTemplates,
    activeTemplateId, setActiveTemplateId,
    manuscriptMeta, setManuscriptMeta,
    isProcessing, setIsProcessing,
    confirmConfig, setConfirmConfig,
    showFigureStudio, setShowFigureStudio,
    figureStudioTarget, setFigureStudioTarget,
    tableEditorTarget, setTableEditorTarget,
    mathEditorTarget, setMathEditorTarget,
    isJumpingManual, setIsJumpingManual,
    textareaRef, cursorPositionRef, saveTimeoutRef,
    selectedProject, activeTemplate, currentSections, projectMedia
  };
};
