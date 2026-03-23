
import { useState, useEffect, useCallback } from 'react';
import { SavedDOE, DOEFactor, DOEResponse, ResearchProject, PlannedExperiment, DoeSession } from '../../types';

export const useDOEPersistence = (doeSession: DoeSession, updateDoeSession: (updates: Partial<DoeSession>) => void) => {
  const [savedResults, setSavedResults] = useState<SavedDOE[]>([]);
  const [customTemplates, setCustomTemplates] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('sciflow_doe_user_templates');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  useEffect(() => {
    try {
      const local = localStorage.getItem('sciflow_doe_v2_archives');
      if (local) setSavedResults(JSON.parse(local));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('sciflow_doe_user_templates', JSON.stringify(customTemplates));
    } catch (e) { console.error(e); }
  }, [customTemplates]);

  const generateIntelligentTitle = useCallback((baseLabel: string) => {
    const { processDescription, factors } = doeSession;
    let coreSubject = "";
    const subjectMatch = processDescription.match(/(?:针对|关于|优化|研究|制备)\s*([A-Za-z0-9\u4e00-\u9fa5]+)/);
    if (subjectMatch && subjectMatch[1]) coreSubject = subjectMatch[1].substring(0, 10);

    let factorContext = "";
    const validFactors = factors.filter(f => f.name && f.name.trim() !== "");
    if (validFactors.length > 0) {
      factorContext = validFactors.slice(0, 3).map(f => `${f.name}${f.min}-${f.max}`).join('/');
    }

    let finalPrefix = coreSubject && factorContext ? `[${coreSubject}/${factorContext}] ` : (coreSubject || factorContext ? `[${coreSubject || factorContext}] ` : "");
    return finalPrefix ? `${finalPrefix}${baseLabel}` : `DOE${baseLabel}`;
  }, [doeSession]);

  // Added missing archive loading logic
  const loadArchive = (archive: SavedDOE) => {
    const sd = archive.sessionData;
    if (sd) {
      updateDoeSession({ ...sd, loadedArchiveId: archive.id });
    } else {
      // 向后兼容旧格式
      updateDoeSession({
        factors: archive.factors || [],
        responses: archive.responses || [],
        history: archive.history || [],
        processDescription: archive.processDescription || '',
        suggestion: archive.suggestion || null,
        loadedArchiveId: archive.id
      });
    }
  };

  // Added missing archive deletion logic
  const handleDeleteArchive = (id: string) => {
    const updated = savedResults.filter(r => r.id !== id);
    setSavedResults(updated);
    localStorage.setItem('sciflow_doe_v2_archives', JSON.stringify(updated));
    if (doeSession.loadedArchiveId === id) updateDoeSession({ suggestion: null, loadedArchiveId: null });
  };

  // Added missing template saving logic
  const handleSaveAsTemplate = (newTemplateTitle: string) => {
    if (!newTemplateTitle.trim()) return;
    const newTemplate = {
      id: Date.now().toString(),
      title: newTemplateTitle,
      factors: [...doeSession.factors],
      responses: [...doeSession.responses],
      processDescription: doeSession.processDescription
    };
    setCustomTemplates(prev => [...prev, newTemplate]);
  };

  // Added missing template loading logic
  const loadTemplate = (tpl: any) => {
    updateDoeSession({
      factors: tpl.factors || [],
      responses: tpl.responses || [],
      processDescription: tpl.processDescription || ''
    });
  };

  // Archive rename logic
  const handleRenameArchive = (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    const updated = savedResults.map(r => r.id === id ? { ...r, title: newTitle.trim() } : r);
    setSavedResults(updated);
    localStorage.setItem('sciflow_doe_v2_archives', JSON.stringify(updated));
  };

  // Archive category change logic
  const handleCategoryChange = (id: string, newCategory: string) => {
    const updated = savedResults.map(r => r.id === id ? { ...r, category: newCategory } : r);
    setSavedResults(updated);
    localStorage.setItem('sciflow_doe_v2_archives', JSON.stringify(updated));
  };

  return {
    savedResults, setSavedResults,
    customTemplates, setCustomTemplates,
    generateIntelligentTitle,
    loadArchive,
    handleDeleteArchive,
    handleRenameArchive,
    handleCategoryChange,
    handleSaveAsTemplate,
    loadTemplate
  };
};
