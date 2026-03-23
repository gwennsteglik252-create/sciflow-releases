
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ResearchProject, SampleEntry, MatrixDataset } from '../../types';
import { analyzeSampleMatrix } from '../../services/gemini';
import { MatrixTable } from './Matrix/MatrixTable';
import SafeModal, { SafeModalConfig } from '../SafeModal';
import { useTranslation } from '../../locales/useTranslation';
import * as XLSX from 'xlsx';

interface SampleMatrixViewProps {
  project: ResearchProject;
  onUpdate: (updated: ResearchProject) => void;
  onSetAiStatus?: (status: string | null) => void;
  onTraceLog?: (logId: string) => void;
}

// ── Column mapping type for import modal ──
type ColumnRole = 'skip' | 'sampleId' | 'processParam' | 'resultMetric' | 'note';

const SampleMatrixView: React.FC<SampleMatrixViewProps> = ({ project, onUpdate, onSetAiStatus, onTraceLog }) => {
  const { t } = useTranslation();

  // --- Data Management ---
  const [matrices, setMatrices] = useState<MatrixDataset[]>(() => {
    let currentMatrices = project.matrices || [];
    if (currentMatrices.length === 0 && project.sampleMatrix && project.sampleMatrix.length > 0) {
      currentMatrices = [{ id: 'default_matrix', title: project.matrixTitle || 'Default Matrix', data: project.sampleMatrix }];
    }
    if (currentMatrices.length === 0) {
      currentMatrices = [{ id: Date.now().toString(), title: 'Default Matrix', data: [] }];
    }
    return currentMatrices;
  });

  const [activeMatrixId, setActiveMatrixId] = useState<string>(() => matrices[0]?.id || '');
  const prevMatrixIdRef = useRef<string>(activeMatrixId);

  useEffect(() => {
    let currentMatrices = project.matrices || [];
    if (currentMatrices.length === 0 && project.sampleMatrix && project.sampleMatrix.length > 0) {
      currentMatrices = [{ id: 'default_matrix', title: project.matrixTitle || 'Default Matrix', data: project.sampleMatrix }];
    }
    if (currentMatrices.length === 0) {
      currentMatrices = [{ id: Date.now().toString(), title: 'Default Matrix', data: [] }];
    }
    setMatrices(currentMatrices);
    if (!activeMatrixId || !currentMatrices.find(m => m.id === activeMatrixId)) {
      setActiveMatrixId(currentMatrices[0].id);
    }
  }, [project.matrices, project.sampleMatrix]);

  const activeMatrix = useMemo(() => matrices.find(m => m.id === activeMatrixId) || matrices[0], [matrices, activeMatrixId]);

  // --- UI State ---
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isContrastMode, setIsContrastMode] = useState(false);
  const [auditMode, setAuditMode] = useState(false);
  const [editTitleMode, setEditTitleMode] = useState(false);
  const [tempTitle, setTempTitle] = useState('');

  // Column Modal State
  const [showAddColModal, setShowAddColModal] = useState<'param' | 'result' | null>(null);
  const [newColName, setNewColName] = useState('');
  const [newColUnit, setNewColUnit] = useState('');

  // Delete Confirm State
  const [confirmModal, setConfirmModal] = useState<SafeModalConfig | null>(null);

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<string[][]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [columnRoles, setColumnRoles] = useState<ColumnRole[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [processColumns, setProcessColumns] = useState<string[]>([]);
  const [resultColumns, setResultColumns] = useState<string[]>([]);

  // Scatter plot state
  const [scatterX, setScatterX] = useState<string>('');
  const [scatterY, setScatterY] = useState<string>('');
  const [showScatter, setShowScatter] = useState(false);

  // E: Filter state
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [filterExpr, setFilterExpr] = useState<string>('');
  const hasActiveFilters = filterSource !== 'all' || filterTag !== 'all' || filterExpr.trim() !== '';

  // L: Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchBar, setShowBatchBar] = useState(false);

  // J: Template state
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');

  // N: Group state
  const [groupByEnabled, setGroupByEnabled] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [newGroupInput, setNewGroupInput] = useState('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [userGroups, setUserGroups] = useState<string[]>([]);

  // N: Compute existing groups from data + user-created
  const existingGroups = useMemo(() => {
    if (!activeMatrix?.data) return userGroups;
    const gs = new Set<string>(userGroups);
    activeMatrix.data.forEach(s => { if (s.group) gs.add(s.group); });
    return Array.from(gs).sort();
  }, [activeMatrix, userGroups]);

  // N: Handlers
  const handleToggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName); else next.add(groupName);
      return next;
    });
  };

  const handleSetGroup = (sampleId: string, group: string) => {
    if (!activeMatrix) return;
    handleUpdateActiveMatrixData(activeMatrix.data.map(s =>
      s.id === sampleId ? { ...s, group: group || undefined } : s
    ));
  };

  const handleAddNewGroup = () => {
    const name = newGroupInput.trim();
    if (!name) return;
    if (!existingGroups.includes(name)) {
      setUserGroups(prev => [...prev, name]);
    }
    setNewGroupInput('');
    setShowNewGroupInput(false);
  };

  useEffect(() => {
    if (!activeMatrix) return;

    const isMatrixSwitch = prevMatrixIdRef.current !== activeMatrixId;

    const pKeys = new Set<string>();
    const rKeys = new Set<string>();
    (activeMatrix.data || []).forEach(s => {
      Object.keys(s.processParams || {}).forEach(k => pKeys.add(k));
      Object.keys(s.results || {}).forEach(k => rKeys.add(k));
    });

    if (activeMatrix.data.length > 0 || isMatrixSwitch) {
      setProcessColumns(Array.from(pKeys).sort());
      setResultColumns(Array.from(rKeys).sort());
    }

    prevMatrixIdRef.current = activeMatrixId;
  }, [activeMatrixId, activeMatrix]);

  const sortedSamples = useMemo(() => {
    if (!activeMatrix || !activeMatrix.data) return [];
    let samples = [...activeMatrix.data];

    // E: Apply filters
    if (filterSource !== 'all') {
      samples = samples.filter(s => s.source === filterSource);
    }
    if (filterTag !== 'all') {
      samples = samples.filter(s => (s.tags || []).includes(filterTag));
    }
    if (filterExpr.trim()) {
      const expr = filterExpr.trim();
      // Parse expressions like ">100", "<50", ">=200"
      const match = expr.match(/^([><]=?)\s*([\d.]+)$/);
      if (match) {
        const op = match[1];
        const val = parseFloat(match[2]);
        samples = samples.filter(s => {
          // Check across all result columns for a match
          return resultColumns.some(key => {
            const v = parseFloat(String(s.results[key]));
            if (isNaN(v)) return false;
            if (op === '>') return v > val;
            if (op === '<') return v < val;
            if (op === '>=') return v >= val;
            if (op === '<=') return v <= val;
            return false;
          });
        });
      }
    }

    if (!sortKey) return samples;
    return samples.sort((a, b) => {
      let valA: any = a.processParams[sortKey] ?? a.results[sortKey] ?? '';
      let valB: any = b.processParams[sortKey] ?? b.results[sortKey] ?? '';
      const numA = parseFloat(valA);
      const numB = parseFloat(valB);
      if (!isNaN(numA) && !isNaN(numB)) { valA = numA; valB = numB; }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [activeMatrix, sortKey, sortOrder, filterSource, filterTag, filterExpr, resultColumns]);

  const championSample = isContrastMode && sortedSamples.length > 0 ? sortedSamples[0] : null;

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleCreateMatrix = () => {
    const newMatrix: MatrixDataset = { id: Date.now().toString(), title: `New Matrix ${matrices.length + 1}`, data: [] };
    const updatedMatrices = [...matrices, newMatrix];
    setMatrices(updatedMatrices);
    setActiveMatrixId(newMatrix.id);
    onUpdate({ ...project, matrices: updatedMatrices });
  };

  // Delete current matrix
  const handleDeleteMatrix = () => {
    if (matrices.length <= 1) return;
    setConfirmModal({
      show: true,
      title: t('sampleMatrixView.toolbar.deleteMatrix'),
      desc: t('sampleMatrixView.toolbar.deleteMatrixConfirm', { name: activeMatrix?.title || '' }),
      onConfirm: () => {
        const updatedMatrices = matrices.filter(m => m.id !== activeMatrixId);
        setMatrices(updatedMatrices);
        setActiveMatrixId(updatedMatrices[0]?.id || '');
        onUpdate({ ...project, matrices: updatedMatrices });
        setConfirmModal(null);
      },
    });
  };

  // Load demo data into current matrix
  const handleLoadDemo = () => {
    const demoData: SampleEntry[] = [
      { id: 'd1', sampleId: 'FeCo-001', timestamp: '2026-03-10T08:00:00Z', source: 'manual', processParams: { 'Temperature (°C)': 800, 'Fe:Co Ratio': '1:1', 'Pyrolysis Time (h)': 2 }, results: { 'E₁/₂ (V)': 0.87, 'J_L (mA/cm²)': 5.62, 'Tafel Slope (mV/dec)': 68 }, note: 'Baseline reference sample', tags: ['baseline'], group: 'Batch-1' },
      { id: 'd2', sampleId: 'FeCo-002', timestamp: '2026-03-10T09:30:00Z', source: 'manual', processParams: { 'Temperature (°C)': 850, 'Fe:Co Ratio': '1:1', 'Pyrolysis Time (h)': 2 }, results: { 'E₁/₂ (V)': 0.89, 'J_L (mA/cm²)': 5.81, 'Tafel Slope (mV/dec)': 63 }, note: 'Higher temp improved E₁/₂', tags: [], group: 'Batch-1' },
      { id: 'd3', sampleId: 'FeCo-003', timestamp: '2026-03-11T10:00:00Z', source: 'workflow', processParams: { 'Temperature (°C)': 900, 'Fe:Co Ratio': '1:1', 'Pyrolysis Time (h)': 2 }, results: { 'E₁/₂ (V)': 0.91, 'J_L (mA/cm²)': 6.15, 'Tafel Slope (mV/dec)': 58 }, note: '★ Best ORR performance so far', tags: ['optimal'], group: 'Batch-1', linkedLogId: 'log-exp-001' },
      { id: 'd4', sampleId: 'FeCo-004', timestamp: '2026-03-11T14:00:00Z', source: 'workflow', processParams: { 'Temperature (°C)': 950, 'Fe:Co Ratio': '1:1', 'Pyrolysis Time (h)': 2 }, results: { 'E₁/₂ (V)': 0.85, 'J_L (mA/cm²)': 4.92, 'Tafel Slope (mV/dec)': 78 }, note: 'Overheating - performance dropped', tags: ['anomaly'], group: 'Batch-1' },
      { id: 'd5', sampleId: 'FeCo-005', timestamp: '2026-03-12T08:00:00Z', source: 'manual', processParams: { 'Temperature (°C)': 900, 'Fe:Co Ratio': '2:1', 'Pyrolysis Time (h)': 2 }, results: { 'E₁/₂ (V)': 0.88, 'J_L (mA/cm²)': 5.44, 'Tafel Slope (mV/dec)': 65 }, note: 'Fe-rich variant', tags: [], group: 'Batch-2' },
      { id: 'd6', sampleId: 'FeCo-006', timestamp: '2026-03-12T10:30:00Z', source: 'manual', processParams: { 'Temperature (°C)': 900, 'Fe:Co Ratio': '1:2', 'Pyrolysis Time (h)': 2 }, results: { 'E₁/₂ (V)': 0.90, 'J_L (mA/cm²)': 5.98, 'Tafel Slope (mV/dec)': 60 }, note: 'Co-rich better bifunctionality', tags: ['recheck'], group: 'Batch-2' },
      { id: 'd7', sampleId: 'FeCo-007', timestamp: '2026-03-13T09:00:00Z', source: 'workflow', processParams: { 'Temperature (°C)': 900, 'Fe:Co Ratio': '1:1', 'Pyrolysis Time (h)': 1 }, results: { 'E₁/₂ (V)': 0.86, 'J_L (mA/cm²)': 5.21, 'Tafel Slope (mV/dec)': 71 }, note: 'Short pyrolysis insufficient', tags: [], group: 'Batch-3' },
      { id: 'd8', sampleId: 'FeCo-008', timestamp: '2026-03-13T14:00:00Z', source: 'imported', processParams: { 'Temperature (°C)': 900, 'Fe:Co Ratio': '1:1', 'Pyrolysis Time (h)': 3 }, results: { 'E₁/₂ (V)': 0.90, 'J_L (mA/cm²)': 5.95, 'Tafel Slope (mV/dec)': 61 }, note: 'Extended pyrolysis comparable to optimal', tags: ['recheck'], group: 'Batch-3' },
      { id: 'd9', sampleId: 'FeCo-009', timestamp: '2026-03-14T08:00:00Z', source: 'imported', processParams: { 'Temperature (°C)': 900, 'Fe:Co Ratio': '1:1', 'Pyrolysis Time (h)': 4 }, results: { 'E₁/₂ (V)': 0.88, 'J_L (mA/cm²)': 5.50, 'Tafel Slope (mV/dec)': 66 }, note: 'Diminishing returns at 4h', tags: [], group: 'Batch-3' },
      { id: 'd10', sampleId: 'FeCo-010', timestamp: '2026-03-14T15:00:00Z', source: 'manual', processParams: { 'Temperature (°C)': 900, 'Fe:Co Ratio': '1:1.5', 'Pyrolysis Time (h)': 2.5 }, results: { 'E₁/₂ (V)': 0.92, 'J_L (mA/cm²)': 6.28, 'Tafel Slope (mV/dec)': 55 }, note: '🏆 New champion! Optimized ratio + time', tags: ['optimal'], group: 'Batch-3' },
    ];
    handleUpdateActiveMatrixData(demoData);
  };

  const handleRenameMatrix = () => {
    const updatedMatrices = matrices.map(m => m.id === activeMatrixId ? { ...m, title: tempTitle } : m);
    setMatrices(updatedMatrices);
    onUpdate({ ...project, matrices: updatedMatrices });
    setEditTitleMode(false);
  };

  const handleUpdateActiveMatrixData = (newData: SampleEntry[]) => {
    const updatedMatrices = matrices.map(m => m.id === activeMatrixId ? { ...m, data: newData } : m);
    setMatrices(updatedMatrices);
    onUpdate({ ...project, matrices: updatedMatrices });
  };

  const handleAddRow = () => {
    if (!activeMatrix) return;
    const nextIndex = (activeMatrix.data?.length || 0) + 1;
    const newEntry: SampleEntry = {
      id: Date.now().toString(),
      sampleId: `S-${String(nextIndex).padStart(3, '0')}`,
      timestamp: new Date().toISOString(),
      processParams: processColumns.reduce((acc, key) => ({ ...acc, [key]: '' }), {}),
      results: resultColumns.reduce((acc, key) => ({ ...acc, [key]: '' }), {}),
      note: '',
      source: 'manual'
    };
    handleUpdateActiveMatrixData([newEntry, ...(activeMatrix.data || [])]);
  };

  const handleDeleteRow = (id: string) => {
    if (!activeMatrix) return;
    setConfirmModal({
      show: true,
      title: t('sampleMatrixView.confirm.deleteRowTitle'),
      desc: t('sampleMatrixView.confirm.deleteRowDesc'),
      onConfirm: () => {
        handleUpdateActiveMatrixData(activeMatrix.data.filter(s => s.id !== id));
        setConfirmModal(null);
      }
    });
  };

  const handleAddColumn = (type: 'param' | 'result') => {
    setNewColName('');
    setNewColUnit('');
    setShowAddColModal(type);
  };

  const confirmAddColumn = () => {
    if (!activeMatrix || !newColName.trim() || !showAddColModal) return;
    const key = newColUnit.trim() ? `${newColName} (${newColUnit})` : newColName;

    if (showAddColModal === 'param') {
      if (processColumns.includes(key)) return;
      setProcessColumns(prev => [...prev, key]);
      if (activeMatrix.data.length > 0) {
        const newData = activeMatrix.data.map(s => ({ ...s, processParams: { ...s.processParams, [key]: '' } }));
        handleUpdateActiveMatrixData(newData);
      }
    } else {
      if (resultColumns.includes(key)) return;
      setResultColumns(prev => [...prev, key]);
      if (activeMatrix.data.length > 0) {
        const newData = activeMatrix.data.map(s => ({ ...s, results: { ...s.results, [key]: '' } }));
        handleUpdateActiveMatrixData(newData);
      }
    }
    setShowAddColModal(null);
  };

  const handleRenameColumn = (type: 'param' | 'result', oldKey: string, newKey: string) => {
    if (!activeMatrix || !newKey.trim() || oldKey === newKey) return;

    if (type === 'param' && processColumns.includes(newKey)) return alert('Column name exists');
    if (type === 'result' && resultColumns.includes(newKey)) return alert('Column name exists');

    if (type === 'param') {
      setProcessColumns(prev => prev.map(c => c === oldKey ? newKey : c));
      const newData = activeMatrix.data.map(s => {
        const val = s.processParams[oldKey];
        const newParams = { ...s.processParams };
        delete newParams[oldKey];
        newKey && (newParams[newKey] = val);
        return { ...s, processParams: newParams };
      });
      handleUpdateActiveMatrixData(newData);
    } else {
      setResultColumns(prev => prev.map(c => c === oldKey ? newKey : c));
      const newData = activeMatrix.data.map(s => {
        const val = s.results[oldKey];
        const newResults = { ...s.results };
        delete newResults[oldKey];
        newKey && (newResults[newKey] = val);
        return { ...s, results: newResults };
      });
      handleUpdateActiveMatrixData(newData);
    }
  };

  const handleDeleteColumn = (type: 'param' | 'result', key: string) => {
    setConfirmModal({
      show: true,
      title: t('sampleMatrixView.confirm.deleteColTitle', { key }),
      desc: t('sampleMatrixView.confirm.deleteColDesc'),
      onConfirm: () => {
        if (type === 'param') {
          setProcessColumns(processColumns.filter(c => c !== key));
          const newData = activeMatrix.data.map(s => {
            const newParams = { ...s.processParams };
            delete newParams[key];
            return { ...s, processParams: newParams };
          });
          handleUpdateActiveMatrixData(newData);
        } else {
          setResultColumns(resultColumns.filter(c => c !== key));
          const newData = activeMatrix.data.map(s => {
            const newResults = { ...s.results };
            delete newResults[key];
            return { ...s, results: newResults };
          });
          handleUpdateActiveMatrixData(newData);
        }
        setConfirmModal(null);
      }
    });
  };

  const updateCellValue = (id: string, type: 'id' | 'note' | 'param' | 'result', key: string, value: string) => {
    if (!activeMatrix) return;
    const newData = activeMatrix.data.map(s => {
      if (s.id !== id) return s;
      if (type === 'id') return { ...s, sampleId: value };
      if (type === 'note') return { ...s, note: value };
      if (type === 'param') return { ...s, processParams: { ...s.processParams, [key]: value } };
      if (type === 'result') return { ...s, results: { ...s.results, [key]: value } };
      return s;
    });
    handleUpdateActiveMatrixData(newData);
  };

  const handleAnalyze = async () => {
    if (!activeMatrix || activeMatrix.data.length < 2) return alert(t('sampleMatrixView.analysis.minSamples'));
    setIsAnalyzing(true);
    if (onSetAiStatus) onSetAiStatus(t('sampleMatrixView.analysis.analyzing'));
    try {
      const result = await analyzeSampleMatrix(activeMatrix.title || t('sampleMatrixView.analysis.defaultTitle'), activeMatrix.data);
      setAnalysisResult(result.summary);
    } catch (e) {
      alert(t('sampleMatrixView.analysis.unavailable'));
    } finally {
      setIsAnalyzing(false);
      if (onSetAiStatus) onSetAiStatus(null);
    }
  };

  const handleExportCSV = () => {
    if (!activeMatrix || !activeMatrix.data.length) return;

    const headers = ['Sample ID', ...processColumns, ...resultColumns, 'Note'];
    const rows = activeMatrix.data.map(s => [
      s.sampleId,
      ...processColumns.map(k => s.processParams[k] ?? ''),
      ...resultColumns.map(k => s.results[k] ?? ''),
      s.note || ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeMatrix.title);
    XLSX.writeFile(wb, `${activeMatrix.title.replace(/\s+/g, '_')}_export.csv`);
  };

  // ── Import Logic ──
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (jsonData.length < 2) {
          alert(t('sampleMatrixView.importModal.noData'));
          return;
        }

        const headers = jsonData[0].map(h => String(h || '').trim());
        const rows = jsonData.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ''));

        if (rows.length === 0) {
          alert(t('sampleMatrixView.importModal.noData'));
          return;
        }

        setImportHeaders(headers);
        setImportData(rows.map(row => headers.map((_, i) => String(row[i] ?? ''))));

        // Auto-detect column roles
        const roles: ColumnRole[] = headers.map((h, i) => {
          const lower = h.toLowerCase();
          if (i === 0 || lower.includes('sample') || lower.includes('id') || lower.includes('样本')) return 'sampleId';
          if (lower.includes('note') || lower.includes('备注') || lower.includes('批注') || lower.includes('remark')) return 'note';
          // Default: first half as process, second half as result (heuristic)
          return i < Math.ceil(headers.length / 2) ? 'processParam' : 'resultMetric';
        });
        setColumnRoles(roles);
        setShowImportModal(true);
      } catch {
        alert(t('sampleMatrixView.importModal.parseError'));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportConfirm = () => {
    if (!activeMatrix || importData.length === 0) return;
    setIsImporting(true);

    const newSamples: SampleEntry[] = importData.map((row, rIdx) => {
      const processParams: Record<string, string> = {};
      const results: Record<string, string> = {};
      let sampleId = `S-${String((activeMatrix.data?.length || 0) + rIdx + 1).padStart(3, '0')}`;
      let note = '';

      importHeaders.forEach((header, cIdx) => {
        const role = columnRoles[cIdx];
        const value = row[cIdx] || '';
        if (role === 'sampleId') sampleId = value || sampleId;
        else if (role === 'note') note = value;
        else if (role === 'processParam') processParams[header] = value;
        else if (role === 'resultMetric') results[header] = value;
      });

      return {
        id: `import_${Date.now()}_${rIdx}`,
        sampleId,
        timestamp: new Date().toISOString(),
        processParams,
        results,
        note,
        source: 'imported' as const,
      };
    });

    // Merge columns
    const newPCols = new Set(processColumns);
    const newRCols = new Set(resultColumns);
    importHeaders.forEach((h, i) => {
      if (columnRoles[i] === 'processParam') newPCols.add(h);
      if (columnRoles[i] === 'resultMetric') newRCols.add(h);
    });
    setProcessColumns(Array.from(newPCols).sort());
    setResultColumns(Array.from(newRCols).sort());

    handleUpdateActiveMatrixData([...newSamples, ...(activeMatrix.data || [])]);

    setIsImporting(false);
    setShowImportModal(false);
    setImportData([]);
    setImportHeaders([]);
    setColumnRoles([]);
  };

  // ── Empty State: Manual Entry shortcut ──
  const handleEmptyManualEntry = () => {
    setIsEditing(true);
    // Auto-add a row if no columns yet defined, user can add columns first
    if (processColumns.length > 0 || resultColumns.length > 0) {
      handleAddRow();
    }
  };

  // ── AI Template: Generate columns from project metadata ──
  const handleAiTemplate = () => {
    // Generate result columns from project targetMetrics
    const newResultCols: string[] = [];
    if (project.targetMetrics && project.targetMetrics.length > 0) {
      project.targetMetrics.forEach(m => {
        const col = m.unit ? `${m.label} (${m.unit})` : m.label;
        if (!resultColumns.includes(col)) newResultCols.push(col);
      });
    }

    // Generate some common process params based on project keywords/category
    const keywords = (project.keywords || []).join(' ').toLowerCase() + ' ' + (project.category || '').toLowerCase();
    const newProcessCols: string[] = [];
    const templateMap: [string[], string][] = [
      [['electro', '电化学', 'catalyst', '催化', 'ORR', 'HER', 'OER'], 'Potential (V)'],
      [['electro', '电化学', 'catalyst', '催化'], 'Scan Rate (mV/s)'],
      [['temperature', '温度', 'thermal', '热', 'synth', '合成', 'calcin', '煅烧'], 'Temperature (°C)'],
      [['time', '时间', 'reaction', '反应', 'synth', '合成'], 'Reaction Time (h)'],
      [['concentration', '浓度', 'solution', '溶液'], 'Concentration (mol/L)'],
      [['pressure', '压力'], 'Pressure (atm)'],
      [['ph', '酸碱'], 'pH'],
      [['ratio', '比例', 'molar', '摩尔'], 'Molar Ratio'],
      [['rpm', 'stirr', '搅拌'], 'Stirring Speed (rpm)'],
      [['anneal', '退火', 'calcin', '煅烧'], 'Calcination Temp (°C)'],
    ];

    templateMap.forEach(([triggers, col]) => {
      if (triggers.some(kw => keywords.includes(kw.toLowerCase())) && !processColumns.includes(col)) {
        newProcessCols.push(col);
      }
    });

    // If no specific matches, provide generic defaults
    if (newProcessCols.length === 0) {
      ['Temperature (°C)', 'Reaction Time (h)', 'Concentration (mol/L)'].forEach(col => {
        if (!processColumns.includes(col)) newProcessCols.push(col);
      });
    }
    if (newResultCols.length === 0) {
      ['Yield (%)', 'Purity (%)'].forEach(col => {
        if (!resultColumns.includes(col)) newResultCols.push(col);
      });
    }

    // Apply
    setProcessColumns(prev => [...prev, ...newProcessCols]);
    setResultColumns(prev => [...prev, ...newResultCols]);
    setIsEditing(true);
  };

  // ── H: Toggle Tag on a sample row ──
  const handleToggleTag = (sampleId: string, tag: string) => {
    if (!activeMatrix) return;
    const newData = activeMatrix.data.map(s => {
      if (s.id !== sampleId) return s;
      const current = s.tags || [];
      const hasTag = current.includes(tag);
      return { ...s, tags: hasTag ? current.filter(t2 => t2 !== tag) : [...current, tag] };
    });
    handleUpdateActiveMatrixData(newData);
  };

  // ── J: Template Library ──
  const savedTemplates: { name: string; processColumns: string[]; resultColumns: string[] }[] = (project as any).matrixTemplates || [];

  const handleSaveTemplate = () => {
    if (!templateNameInput.trim()) return;
    const template = { name: templateNameInput.trim(), processColumns: [...processColumns], resultColumns: [...resultColumns] };
    const updated = [...savedTemplates, template];
    onUpdate({ ...project, matrixTemplates: updated } as any);
    setTemplateNameInput('');
    setShowTemplateMenu(false);
  };

  const handleLoadTemplate = (tpl: { processColumns: string[]; resultColumns: string[] }) => {
    setProcessColumns(tpl.processColumns);
    setResultColumns(tpl.resultColumns);
    setIsEditing(true);
    setShowTemplateMenu(false);
  };

  // ── L: Batch Operations ──
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === sortedSamples.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedSamples.map(s => s.id)));
    }
  };

  const handleBatchDelete = () => {
    if (!activeMatrix || selectedIds.size === 0) return;
    setConfirmModal({
      show: true,
      title: t('sampleMatrixView.batch.deleteSelected'),
      desc: t('sampleMatrixView.batch.selected', { count: String(selectedIds.size) }),
      onConfirm: () => {
        handleUpdateActiveMatrixData(activeMatrix.data.filter(s => !selectedIds.has(s.id)));
        setSelectedIds(new Set());
        setConfirmModal(null);
      },
    });
  };

  const handleBatchTag = (tag: string) => {
    if (!activeMatrix || selectedIds.size === 0) return;
    const newData = activeMatrix.data.map(s => {
      if (!selectedIds.has(s.id)) return s;
      const current = s.tags || [];
      if (current.includes(tag)) return s;
      return { ...s, tags: [...current, tag] };
    });
    handleUpdateActiveMatrixData(newData);
    setSelectedIds(new Set());
  };

  const handleBatchExport = () => {
    if (!activeMatrix || selectedIds.size === 0) return;
    const selected = activeMatrix.data.filter(s => selectedIds.has(s.id));
    const headers = ['Sample ID', ...processColumns, ...resultColumns, 'Note'];
    const rows = selected.map(s => [
      s.sampleId,
      ...processColumns.map(k => s.processParams[k] ?? ''),
      ...resultColumns.map(k => s.results[k] ?? ''),
      s.note || ''
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Selected');
    XLSX.writeFile(wb, `selected_${selectedIds.size}_samples.csv`);
    setSelectedIds(new Set());
  };

  if (!activeMatrix) return null;

  const isEmpty = !activeMatrix.data || activeMatrix.data.length === 0;
  const showEmptyState = isEmpty && !isEditing && processColumns.length === 0 && resultColumns.length === 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative min-h-0 bg-slate-50/20 p-4 lg:p-8 animate-reveal">
      <header className="flex flex-col gap-4 mb-6 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={activeMatrixId}
                onChange={(e) => setActiveMatrixId(e.target.value)}
                className="appearance-none bg-transparent text-sm font-black text-slate-700 uppercase italic tracking-tighter border-b border-indigo-200 outline-none py-1 pr-6 pl-1 cursor-pointer hover:text-indigo-600 transition-colors min-w-[120px] max-w-[200px]"
              >
                {matrices.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
              <i className="fa-solid fa-chevron-down absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]"></i>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={handleCreateMatrix} className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-95" title="Create New Matrix"><i className="fa-solid fa-plus text-[10px]"></i></button>
              <button onClick={() => { setTempTitle(activeMatrix.title || ''); setEditTitleMode(true); }} className="text-slate-300 hover:text-indigo-500 transition-colors" title="Rename Matrix"><i className="fa-solid fa-pen text-[10px]"></i></button>
              {matrices.length > 1 && (
                <button onClick={handleDeleteMatrix} className="text-slate-300 hover:text-rose-500 transition-colors" title="Delete Matrix"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
              )}
              {(!activeMatrix?.data || activeMatrix.data.length === 0) && (
                <button onClick={handleLoadDemo} className="text-[8px] font-black text-emerald-500 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition-all border border-emerald-200" title="Load Demo Data">
                  <i className="fa-solid fa-flask mr-1"></i>Demo
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Data Utility Group */}
            <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
              <button onClick={handleExportCSV} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-slate-50 transition-all flex items-center gap-2">
                <i className="fa-solid fa-file-csv text-emerald-500"></i> {t('sampleMatrixView.toolbar.exportCsv')}
              </button>
              <button onClick={() => setShowImportModal(true)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-slate-50 transition-all flex items-center gap-2">
                <i className="fa-solid fa-file-import text-blue-500"></i> {t('sampleMatrixView.toolbar.importData')}
              </button>
              {/* J: Template buttons */}
              <div className="relative">
                <button onClick={() => setShowTemplateMenu(!showTemplateMenu)} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-slate-50 transition-all flex items-center gap-2">
                  <i className="fa-solid fa-layer-group text-violet-500"></i> {t('sampleMatrixView.template.load')}
                </button>
                {showTemplateMenu && (
                  <div className="absolute top-full left-0 mt-1 bg-white shadow-2xl rounded-xl border border-slate-200 p-3 z-50 min-w-[220px] animate-reveal">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Templates</p>
                    {savedTemplates.length === 0 ? (
                      <p className="text-[9px] text-slate-400 italic py-2">{t('sampleMatrixView.template.noTemplates')}</p>
                    ) : (
                      savedTemplates.map((tpl, i) => (
                        <button key={i} onClick={() => handleLoadTemplate(tpl)} className="block w-full text-left text-[9px] font-bold px-2 py-1.5 rounded-lg hover:bg-indigo-50 text-slate-600 transition-colors">
                          <i className="fa-solid fa-file-lines text-indigo-400 mr-1.5"></i>{tpl.name}
                          <span className="text-[7px] text-slate-400 ml-2">{tpl.processColumns.length}P + {tpl.resultColumns.length}R</span>
                        </button>
                      ))
                    )}
                    <hr className="my-2 border-slate-100" />
                    <div className="flex gap-1">
                      <input value={templateNameInput} onChange={e => setTemplateNameInput(e.target.value)} placeholder={t('sampleMatrixView.template.templateName')} className="flex-1 text-[9px] font-bold border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-300" />
                      <button onClick={handleSaveTemplate} disabled={!templateNameInput.trim()} className="px-2 py-1 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase disabled:opacity-50">{t('sampleMatrixView.template.confirmSave')}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Analysis/Design Group */}
            <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
              <button onClick={() => setAuditMode(!auditMode)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${auditMode ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                <i className="fa-solid fa-file-medical-alt"></i> {t('sampleMatrixView.toolbar.sciDesign')}
              </button>
              {!isEditing && (
                <button onClick={() => { setIsContrastMode(!isContrastMode); setSortKey(null); }} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${isContrastMode ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                  <i className="fa-solid fa-trophy"></i> {t('sampleMatrixView.toolbar.champion')}
                </button>
              )}
            </div>

            {/* Edit Group */}
            <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
              {isEditing ? (
                <button onClick={() => setIsEditing(false)} className="px-5 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase shadow-sm">{t('sampleMatrixView.toolbar.doneEditing')}</button>
              ) : (
                <button onClick={() => setIsEditing(true)} className="px-4 py-1.5 text-indigo-600 rounded-lg text-[10px] font-black uppercase hover:bg-indigo-50 flex items-center gap-2">
                  <i className="fa-solid fa-pen-to-square"></i> {t('sampleMatrixView.toolbar.editMatrix')}
                </button>
              )}
            </div>

            {/* AI Group */}
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || isEditing}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-100 hover:bg-black transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {isAnalyzing ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-brain"></i>} {t('sampleMatrixView.toolbar.aiDiscover')}
            </button>
          </div>
        </div>

        {editTitleMode && (
          <div className="flex items-center gap-2 animate-reveal">
            <input autoFocus className="bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-800 outline-none w-64 shadow-sm" value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRenameMatrix()} />
            <button onClick={handleRenameMatrix} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">Save</button>
            <button onClick={() => setEditTitleMode(false)} className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-300">Cancel</button>
          </div>
        )}
      </header>

      {/* ── E: Filter Bar ── */}
      {!showEmptyState && !isEditing && activeMatrix.data.length > 0 && (
        <div className="flex items-center gap-3 mb-3 shrink-0 animate-reveal">
          <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-1.5 shadow-sm">
            <i className="fa-solid fa-filter text-slate-400 text-[9px]"></i>
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="text-[9px] font-bold bg-transparent outline-none text-slate-600 cursor-pointer">
              <option value="all">{t('sampleMatrixView.filter.source')}: {t('sampleMatrixView.filter.all')}</option>
              <option value="manual">Manual</option>
              <option value="imported">Imported</option>
              <option value="workflow">Workflow</option>
            </select>
            <div className="w-px h-4 bg-slate-200"></div>
            <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="text-[9px] font-bold bg-transparent outline-none text-slate-600 cursor-pointer">
              <option value="all">{t('sampleMatrixView.filter.tag')}: {t('sampleMatrixView.filter.all')}</option>
              <option value="optimal">★ Optimal</option>
              <option value="anomaly">⚠ Anomaly</option>
              <option value="recheck">↻ Recheck</option>
              <option value="baseline">◆ Baseline</option>
            </select>
            <div className="w-px h-4 bg-slate-200"></div>
            <input
              value={filterExpr}
              onChange={e => setFilterExpr(e.target.value)}
              placeholder={t('sampleMatrixView.filter.placeholder')}
              className="text-[9px] font-bold bg-transparent outline-none text-slate-600 w-40 placeholder:text-slate-300"
            />
          </div>
          {hasActiveFilters && (
            <button onClick={() => { setFilterSource('all'); setFilterTag('all'); setFilterExpr(''); }} className="text-[8px] font-black text-rose-500 uppercase hover:text-rose-700 transition-colors">
              <i className="fa-solid fa-times mr-1"></i>{t('sampleMatrixView.filter.clear')}
            </button>
          )}
          {hasActiveFilters && (
            <span className="text-[8px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
              {t('sampleMatrixView.filter.showing', { count: String(sortedSamples.length), total: String(activeMatrix.data.length) })}
            </span>
          )}
          {/* L: Batch toggle */}
          <button
            onClick={() => { setShowBatchBar(!showBatchBar); if (showBatchBar) setSelectedIds(new Set()); }}
            className={`ml-auto text-[9px] font-black uppercase px-3 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
              showBatchBar ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <i className="fa-solid fa-check-double"></i> Batch
          </button>
          {/* N: Group toggle */}
          <button
            onClick={() => setGroupByEnabled(!groupByEnabled)}
            className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
              groupByEnabled ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <i className="fa-solid fa-layer-group"></i> {t('sampleMatrixView.group.groupBy')}
          </button>
          {groupByEnabled && isEditing && (
            <div className="flex items-center gap-1">
              {showNewGroupInput ? (
                <>
                  <input
                    value={newGroupInput}
                    onChange={e => setNewGroupInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddNewGroup()}
                    placeholder={t('sampleMatrixView.group.groupName')}
                    className="text-[8px] font-bold bg-white border border-slate-200 rounded-lg px-2 py-0.5 outline-none w-24"
                    autoFocus
                  />
                  <button onClick={handleAddNewGroup} disabled={!newGroupInput.trim()} className="text-[8px] font-black text-violet-600 disabled:opacity-50">+</button>
                  <button onClick={() => setShowNewGroupInput(false)} className="text-[8px] text-slate-400">×</button>
                </>
              ) : (
                <button onClick={() => setShowNewGroupInput(true)} className="text-[8px] font-black text-violet-500 hover:text-violet-700 uppercase">
                  <i className="fa-solid fa-plus mr-0.5"></i>{t('sampleMatrixView.group.newGroup')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {analysisResult && (
        <div className="mb-6 bg-white p-6 rounded-[2rem] border-2 border-indigo-100 shadow-xl relative overflow-hidden animate-reveal shrink-0">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
          <button onClick={() => setAnalysisResult(null)} className="absolute top-4 right-4 text-slate-300 hover:text-rose-500"><i className="fa-solid fa-times"></i></button>
          <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="fa-solid fa-wand-magic-sparkles"></i> {t('sampleMatrixView.analysis.reportTitle')}</h4>
          <div className="text-[11px] font-medium leading-relaxed text-slate-700 whitespace-pre-wrap italic pl-2">{analysisResult}</div>
        </div>
      )}

      <div className="flex-1 bg-white rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col min-h-0 border-2 border-dashed border-indigo-200 p-5">
        {showEmptyState ? (
          /* ── A: Empty State Onboarding ── */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 animate-reveal">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mb-6 shadow-lg">
              <i className="fa-solid fa-table-cells text-3xl text-indigo-400"></i>
            </div>
            <h3 className="text-lg font-black text-slate-700 mb-2">{t('sampleMatrixView.emptyState.title')}</h3>
            <p className="text-xs text-slate-400 font-medium mb-8">{t('sampleMatrixView.emptyState.subtitle')}</p>

            <div className="grid grid-cols-2 gap-3 max-w-md w-full mb-8">
              {/* Manual Entry */}
              <button
                onClick={handleEmptyManualEntry}
                className="group flex flex-col items-center gap-2 p-5 bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-2xl border-2 border-transparent hover:border-indigo-300 transition-all hover:shadow-lg active:scale-[0.98]"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                  <i className="fa-solid fa-pen-to-square text-sm"></i>
                </div>
                <span className="text-[11px] font-black text-indigo-700 uppercase">{t('sampleMatrixView.emptyState.manualEntry')}</span>
                <span className="text-[9px] text-indigo-400 font-medium">{t('sampleMatrixView.emptyState.manualEntryDesc')}</span>
              </button>

              {/* Import CSV/Excel */}
              <button
                onClick={() => { fileInputRef.current?.click(); }}
                className="group flex flex-col items-center gap-2 p-5 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl border-2 border-transparent hover:border-emerald-300 transition-all hover:shadow-lg active:scale-[0.98]"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                  <i className="fa-solid fa-file-import text-sm"></i>
                </div>
                <span className="text-[11px] font-black text-emerald-700 uppercase">{t('sampleMatrixView.emptyState.importCsv')}</span>
                <span className="text-[9px] text-emerald-400 font-medium">{t('sampleMatrixView.emptyState.importCsvDesc')}</span>
              </button>

              {/* Sync from Log */}
              <button
                className="group flex flex-col items-center gap-2 p-5 bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-2xl border-2 border-transparent hover:border-amber-300 transition-all hover:shadow-lg opacity-80 cursor-default"
                title={t('sampleMatrixView.emptyState.syncFromLogDesc')}
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                  <i className="fa-solid fa-rotate text-sm"></i>
                </div>
                <span className="text-[11px] font-black text-amber-700 uppercase">{t('sampleMatrixView.emptyState.syncFromLog')}</span>
                <span className="text-[9px] text-amber-400 font-medium">{t('sampleMatrixView.emptyState.syncFromLogDesc')}</span>
              </button>

              {/* AI Template */}
              <button
                onClick={handleAiTemplate}
                className="group flex flex-col items-center gap-2 p-5 bg-gradient-to-br from-violet-50 to-violet-100/50 rounded-2xl border-2 border-transparent hover:border-violet-300 transition-all hover:shadow-lg active:scale-[0.98]"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                  <i className="fa-solid fa-wand-magic-sparkles text-sm"></i>
                </div>
                <span className="text-[11px] font-black text-violet-700 uppercase">{t('sampleMatrixView.emptyState.aiTemplate')}</span>
                <span className="text-[9px] text-violet-400 font-medium">{t('sampleMatrixView.emptyState.aiTemplateDesc')}</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-400 italic max-w-sm">
              <i className="fa-solid fa-lightbulb text-amber-400 mr-1"></i>
              {t('sampleMatrixView.emptyState.tip')}
            </p>
          </div>
        ) : (
          <MatrixTable
            activeMatrix={activeMatrix}
            processColumns={processColumns}
            resultColumns={resultColumns}
            isEditing={isEditing}
            sortKey={sortKey}
            sortOrder={sortOrder}
            isContrastMode={isContrastMode}
            championSample={championSample}
            auditMode={auditMode}
            sortedSamples={sortedSamples}
            onSort={handleSort}
            onDeleteColumn={handleDeleteColumn}
            onRenameColumn={handleRenameColumn}
            onAddColumn={handleAddColumn}
            onUpdateCellValue={updateCellValue}
            onDeleteRow={handleDeleteRow}
            onAddRow={handleAddRow}
            onTraceLog={onTraceLog}
            onToggleTag={handleToggleTag}
            showBatchSelect={showBatchBar}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            groupByEnabled={groupByEnabled}
            collapsedGroups={collapsedGroups}
            onToggleGroupCollapse={handleToggleGroupCollapse}
            onSetGroup={handleSetGroup}
            existingGroups={existingGroups}
          />
        )}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-[9px] font-bold text-slate-400 px-6 shrink-0">
          <div className="flex items-center gap-3">
            <span>Total: {activeMatrix?.data?.length || 0}{hasActiveFilters ? ` (${sortedSamples.length} shown)` : ''}</span>
            {activeMatrix.data.length >= 2 && (
              <button
                onClick={() => setShowScatter(!showScatter)}
                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1.5 border ${
                  showScatter ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'text-violet-500 border-violet-200 hover:bg-violet-50'
                }`}
              >
                <i className="fa-solid fa-chart-scatter-bubble"></i>
                {t('sampleMatrixView.scatter.title')}
              </button>
            )}
          </div>
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-indigo-100 border border-indigo-200"></span> {t('sampleMatrixView.legend.process')}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-200"></span> {t('sampleMatrixView.legend.result')}</span>
            {auditMode && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500 animate-pulse"></span> Audit Alerts</span>}
          </div>
        </div>
      </div>

      {/* ── D: Scatter Plot Visualization ── */}
      {showScatter && activeMatrix.data.length >= 2 && (
        <div className="mt-4 bg-white rounded-[2rem] shadow-sm border-2 border-dashed border-violet-200 p-5 animate-reveal shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-[11px] font-black text-violet-600 uppercase tracking-widest flex items-center gap-2">
              <i className="fa-solid fa-chart-scatter-bubble"></i>
              {t('sampleMatrixView.scatter.title')}
            </h4>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-400">{t('sampleMatrixView.scatter.xAxis')}:</span>
                <select value={scatterX} onChange={e => setScatterX(e.target.value)} className="text-[9px] font-bold bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1 outline-none min-w-[120px]">
                  <option value="">{t('sampleMatrixView.scatter.selectColumn')}</option>
                  {processColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  {resultColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-400">{t('sampleMatrixView.scatter.yAxis')}:</span>
                <select value={scatterY} onChange={e => setScatterY(e.target.value)} className="text-[9px] font-bold bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 outline-none min-w-[120px]">
                  <option value="">{t('sampleMatrixView.scatter.selectColumn')}</option>
                  {processColumns.map(c => <option key={c} value={c}>{c}</option>)}
                  {resultColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {scatterX && scatterY ? (() => {
            const W = 520, H = 280, PAD = 45;
            const points = activeMatrix.data.map(s => ({
              x: parseFloat(String(s.processParams[scatterX] ?? s.results[scatterX] ?? '')),
              y: parseFloat(String(s.processParams[scatterY] ?? s.results[scatterY] ?? '')),
              id: s.sampleId,
            })).filter(p => !isNaN(p.x) && !isNaN(p.y));

            if (points.length < 2) return <p className="text-[10px] text-slate-400 italic text-center py-8">{t('sampleMatrixView.scatter.noData')}</p>;

            const xVals = points.map(p => p.x);
            const yVals = points.map(p => p.y);
            const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
            const yMin = Math.min(...yVals), yMax = Math.max(...yVals);
            const xRange = xMax - xMin || 1;
            const yRange = yMax - yMin || 1;
            const xPad = xRange * 0.1, yPad = yRange * 0.1;

            const scaleX = (v: number) => PAD + ((v - xMin + xPad) / (xRange + 2 * xPad)) * (W - PAD * 2);
            const scaleY = (v: number) => H - PAD - ((v - yMin + yPad) / (yRange + 2 * yPad)) * (H - PAD * 2);

            // Pearson correlation
            const n = points.length;
            const meanX = xVals.reduce((a, b) => a + b, 0) / n;
            const meanY = yVals.reduce((a, b) => a + b, 0) / n;
            const sumXY = points.reduce((a, p) => a + (p.x - meanX) * (p.y - meanY), 0);
            const sumX2 = points.reduce((a, p) => a + Math.pow(p.x - meanX, 2), 0);
            const sumY2 = points.reduce((a, p) => a + Math.pow(p.y - meanY, 2), 0);
            const r = sumX2 > 0 && sumY2 > 0 ? sumXY / Math.sqrt(sumX2 * sumY2) : 0;

            // Axis tick values (5 ticks)
            const xTicks = Array.from({ length: 5 }, (_, i) => xMin + (xRange * i) / 4);
            const yTicks = Array.from({ length: 5 }, (_, i) => yMin + (yRange * i) / 4);

            return (
              <div className="flex items-center gap-6">
                <svg width={W} height={H} className="flex-shrink-0">
                  {/* Grid lines */}
                  {xTicks.map((v, i) => (
                    <g key={`xt-${i}`}>
                      <line x1={scaleX(v)} y1={PAD} x2={scaleX(v)} y2={H - PAD} stroke="#e2e8f0" strokeWidth={0.5} />
                      <text x={scaleX(v)} y={H - PAD + 14} textAnchor="middle" className="fill-slate-400" style={{ fontSize: '8px', fontWeight: 700 }}>
                        {v >= 1000 ? v.toFixed(0) : v.toFixed(1)}
                      </text>
                    </g>
                  ))}
                  {yTicks.map((v, i) => (
                    <g key={`yt-${i}`}>
                      <line x1={PAD} y1={scaleY(v)} x2={W - PAD} y2={scaleY(v)} stroke="#e2e8f0" strokeWidth={0.5} />
                      <text x={PAD - 6} y={scaleY(v) + 3} textAnchor="end" className="fill-slate-400" style={{ fontSize: '8px', fontWeight: 700 }}>
                        {v >= 1000 ? v.toFixed(0) : v.toFixed(1)}
                      </text>
                    </g>
                  ))}
                  {/* Axes */}
                  <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#94a3b8" strokeWidth={1} />
                  <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#94a3b8" strokeWidth={1} />
                  {/* Axis labels */}
                  <text x={W / 2} y={H - 5} textAnchor="middle" className="fill-indigo-500" style={{ fontSize: '9px', fontWeight: 900 }}>{scatterX}</text>
                  <text x={12} y={H / 2} textAnchor="middle" className="fill-emerald-500" style={{ fontSize: '9px', fontWeight: 900 }} transform={`rotate(-90, 12, ${H / 2})`}>{scatterY}</text>
                  {/* Data points */}
                  {points.map((p, i) => (
                    <g key={i}>
                      <circle
                        cx={scaleX(p.x)}
                        cy={scaleY(p.y)}
                        r={5}
                        className="fill-indigo-500 stroke-white"
                        strokeWidth={1.5}
                        opacity={0.8}
                      />
                      <title>{`${p.id}: (${p.x}, ${p.y})`}</title>
                      <circle cx={scaleX(p.x)} cy={scaleY(p.y)} r={12} fill="transparent" className="cursor-pointer" />
                    </g>
                  ))}
                </svg>
                {/* Correlation badge */}
                <div className="flex flex-col gap-2 min-w-[120px]">
                  <div className="bg-violet-50 rounded-xl p-3 text-center border border-violet-200">
                    <p className="text-[8px] font-bold text-violet-400 uppercase tracking-widest mb-1">{t('sampleMatrixView.scatter.correlation')}</p>
                    <p className={`text-2xl font-black ${Math.abs(r) > 0.7 ? 'text-emerald-600' : Math.abs(r) > 0.3 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {r.toFixed(3)}
                    </p>
                    <p className="text-[8px] font-bold text-violet-400 mt-1">
                      {Math.abs(r) > 0.7 ? 'Strong' : Math.abs(r) > 0.3 ? 'Moderate' : 'Weak'}
                    </p>
                  </div>
                  <div className="text-[8px] text-slate-400 font-bold text-center">
                    n={points.length}
                  </div>
                </div>
              </div>
            );
          })() : (
            <p className="text-[10px] text-slate-400 italic text-center py-8">{t('sampleMatrixView.scatter.noData')}</p>
          )}
        </div>
      )}

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv,.xls"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
          e.target.value = '';
        }}
      />

      {/* ── B: Import Modal ── */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[1300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-[720px] max-h-[85vh] flex flex-col animate-reveal border-2 border-white overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                  <i className="fa-solid fa-file-import text-blue-500"></i>
                  {t('sampleMatrixView.importModal.title')}
                </h3>
                {importData.length > 0 && (
                  <p className="text-[10px] text-slate-400 font-bold mt-1">
                    {t('sampleMatrixView.importModal.rowsDetected', { count: importData.length })}
                  </p>
                )}
              </div>
              <button onClick={() => { setShowImportModal(false); setImportData([]); }} className="text-slate-300 hover:text-rose-500 transition-colors">
                <i className="fa-solid fa-times text-lg"></i>
              </button>
            </div>

            {importData.length === 0 ? (
              /* Dropzone */
              <div
                className="flex-1 flex flex-col items-center justify-center p-12 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file);
                }}
              >
                <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                  <i className="fa-solid fa-cloud-arrow-up text-2xl text-blue-400"></i>
                </div>
                <p className="text-sm font-bold text-slate-600 mb-1">{t('sampleMatrixView.importModal.dropzone')}</p>
                <p className="text-[10px] text-slate-400">{t('sampleMatrixView.importModal.supportedFormats')}</p>
              </div>
            ) : (
              /* Column Mapping + Preview */
              <div className="flex-1 overflow-auto custom-scrollbar p-6">
                {/* Column Mapping */}
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-arrows-left-right text-indigo-400"></i>
                  {t('sampleMatrixView.importModal.columnMapping')}
                </h4>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-6">
                  {importHeaders.map((header, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                      <span className="text-[10px] font-bold text-slate-700 truncate flex-1">{header}</span>
                      <select
                        value={columnRoles[i]}
                        onChange={(e) => {
                          const newRoles = [...columnRoles];
                          newRoles[i] = e.target.value as ColumnRole;
                          setColumnRoles(newRoles);
                        }}
                        className="text-[9px] font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none cursor-pointer min-w-[100px]"
                      >
                        <option value="skip">{t('sampleMatrixView.importModal.skip')}</option>
                        <option value="sampleId">{t('sampleMatrixView.importModal.sampleId')}</option>
                        <option value="processParam">{t('sampleMatrixView.importModal.processParam')}</option>
                        <option value="resultMetric">{t('sampleMatrixView.importModal.resultMetric')}</option>
                        <option value="note">{t('sampleMatrixView.importModal.note')}</option>
                      </select>
                    </div>
                  ))}
                </div>

                {/* Data Preview */}
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-eye text-emerald-400"></i>
                  {t('sampleMatrixView.importModal.preview')}
                </h4>
                <div className="overflow-auto rounded-xl border border-slate-200 max-h-60">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        {importHeaders.map((h, i) => (
                          <th key={i} className={`py-2 px-3 text-[9px] font-black uppercase tracking-widest whitespace-nowrap border-b border-slate-200 ${
                            columnRoles[i] === 'skip' ? 'text-slate-300 line-through' :
                            columnRoles[i] === 'processParam' ? 'text-indigo-500 bg-indigo-50/30' :
                            columnRoles[i] === 'resultMetric' ? 'text-emerald-500 bg-emerald-50/30' :
                            'text-slate-500'
                          }`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importData.slice(0, 8).map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className={`py-1.5 px-3 text-[10px] border-b border-slate-100 whitespace-nowrap ${
                              columnRoles[cIdx] === 'skip' ? 'text-slate-300' : 'text-slate-700 font-medium'
                            }`}>{cell || '-'}</td>
                          ))}
                        </tr>
                      ))}
                      {importData.length > 8 && (
                        <tr>
                          <td colSpan={importHeaders.length} className="py-2 text-center text-[9px] text-slate-400 italic">
                            ... +{importData.length - 8} more rows
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer */}
            {importData.length > 0 && (
              <div className="p-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                <button onClick={() => { setShowImportModal(false); setImportData([]); }} className="px-5 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">
                  {t('sampleMatrixView.importModal.cancel')}
                </button>
                <button
                  onClick={handleImportConfirm}
                  disabled={isImporting}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-100"
                >
                  {isImporting ? (
                    <><i className="fa-solid fa-spinner animate-spin"></i> {t('sampleMatrixView.importModal.importing')}</>
                  ) : (
                    <><i className="fa-solid fa-download"></i> {t('sampleMatrixView.importModal.importBtn', { count: importData.length })}</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showAddColModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[1300] flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-80 animate-reveal border-2 border-white">
            <h3 className="font-black text-slate-800 text-sm mb-4 uppercase tracking-widest flex items-center gap-2">
              <i className={`fa-solid ${showAddColModal === 'param' ? 'fa-sliders' : 'fa-chart-line'} text-indigo-500`}></i>
              Add {showAddColModal === 'param' ? 'Parameter' : 'Result'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Name</label>
                <input autoFocus className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-300" placeholder="e.g. Temperature" value={newColName} onChange={e => setNewColName(e.target.value)} onKeyDown={e => e.key === 'Enter' && confirmAddColumn()} />
              </div>
              <div>
                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Unit (Optional)</label>
                <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-indigo-300" placeholder="e.g. °C" value={newColUnit} onChange={e => setNewColUnit(e.target.value)} onKeyDown={e => e.key === 'Enter' && confirmAddColumn()} />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowAddColModal(null)} className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={confirmAddColumn} disabled={!newColName.trim()} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-700 transition-all disabled:opacity-50">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* L: Floating Batch Action Bar */}
      {showBatchBar && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-2xl px-6 py-3 shadow-2xl flex items-center gap-4 z-50 animate-reveal">
          <span className="text-[10px] font-black uppercase tracking-wider">
            {t('sampleMatrixView.batch.selected', { count: String(selectedIds.size) })}
          </span>
          <div className="w-px h-5 bg-slate-700"></div>
          <button onClick={handleBatchDelete} className="text-[9px] font-black uppercase text-rose-400 hover:text-rose-300 flex items-center gap-1.5 transition-colors">
            <i className="fa-solid fa-trash-can"></i> {t('sampleMatrixView.batch.deleteSelected')}
          </button>
          <div className="relative group/batch-tag">
            <button className="text-[9px] font-black uppercase text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors">
              <i className="fa-solid fa-tag"></i> {t('sampleMatrixView.batch.tagSelected')}
            </button>
            <div className="absolute bottom-full left-0 mb-2 bg-white shadow-xl rounded-xl border border-slate-200 p-1 hidden group-hover/batch-tag:block min-w-[120px]">
              {['optimal', 'anomaly', 'recheck', 'baseline'].map(tag => (
                <button key={tag} onClick={() => handleBatchTag(tag)} className="block w-full text-left text-[9px] font-bold px-3 py-1.5 rounded-lg text-slate-700 hover:bg-indigo-50 transition-colors">
                  {t(`sampleMatrixView.tags.${tag}` as any)}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleBatchExport} className="text-[9px] font-black uppercase text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors">
            <i className="fa-solid fa-file-export"></i> {t('sampleMatrixView.batch.exportSelected')}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-[9px] font-bold text-slate-500 hover:text-white ml-2 transition-colors">
            <i className="fa-solid fa-times"></i>
          </button>
        </div>
      )}

      <SafeModal config={confirmModal} onClose={() => setConfirmModal(null)} />
    </div>
  );
};

export default SampleMatrixView;
