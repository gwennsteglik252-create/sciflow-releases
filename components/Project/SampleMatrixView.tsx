
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ResearchProject, SampleEntry, MatrixDataset } from '../../types';
import { analyzeSampleMatrix } from '../../services/gemini';
import { MatrixTable } from './Matrix/MatrixTable';
import SafeModal, { SafeModalConfig } from '../SafeModal';
import * as XLSX from 'xlsx';

interface SampleMatrixViewProps {
  project: ResearchProject;
  onUpdate: (updated: ResearchProject) => void;
  onSetAiStatus?: (status: string | null) => void;
  onTraceLog?: (logId: string) => void;
}

const SampleMatrixView: React.FC<SampleMatrixViewProps> = ({ project, onUpdate, onSetAiStatus, onTraceLog }) => {
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

  const [processColumns, setProcessColumns] = useState<string[]>([]);
  const [resultColumns, setResultColumns] = useState<string[]>([]);

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
  }, [activeMatrix, sortKey, sortOrder]);

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
      title: "删除样本行？",
      desc: "确定移除该样本行数据吗？",
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
      title: `删除列 "${key}"?`,
      desc: "确定移除该列及其所有数据吗？此操作不可恢复。",
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
    if (!activeMatrix || activeMatrix.data.length < 2) return alert("请至少录入 2 个样本数据以进行 AI 规律发现。");
    setIsAnalyzing(true);
    if (onSetAiStatus) onSetAiStatus('🤖 正在进行多变量回归分析...');
    try {
      const result = await analyzeSampleMatrix(activeMatrix.title || "实验矩阵", activeMatrix.data);
      setAnalysisResult(result.summary);
    } catch (e) {
      alert("分析服务暂时不可用。");
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

  if (!activeMatrix) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative min-h-0 bg-slate-50/20 p-4 lg:p-8 animate-reveal">
      <header className="flex flex-col gap-4 mb-6 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative group/matrix-select">
              <select
                value={activeMatrixId}
                onChange={(e) => setActiveMatrixId(e.target.value)}
                className="appearance-none bg-transparent text-sm font-black text-slate-700 uppercase italic tracking-tighter border-b border-indigo-200 outline-none py-1 pr-6 pl-1 cursor-pointer hover:text-indigo-600 transition-colors min-w-[120px] max-w-[200px]"
              >
                {matrices.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
              <i className="fa-solid fa-chevron-down absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[10px]"></i>
              <div className="flex gap-1 absolute left-full ml-2 top-1/2 -translate-y-1/2 items-center">
                <button onClick={handleCreateMatrix} className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-all shadow-sm active:scale-95" title="Create New Matrix"><i className="fa-solid fa-plus text-[10px]"></i></button>
                <button onClick={() => { setTempTitle(activeMatrix.title || ''); setEditTitleMode(true); }} className="text-slate-300 hover:text-indigo-500 transition-colors" title="Rename Matrix"><i className="fa-solid fa-pen text-[10px]"></i></button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Data Utility Group */}
            <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
              <button onClick={handleExportCSV} className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-slate-50 transition-all flex items-center gap-2">
                <i className="fa-solid fa-file-csv text-emerald-500"></i> 导出 CSV
              </button>
            </div>

            {/* Analysis/Design Group */}
            <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
              <button onClick={() => setAuditMode(!auditMode)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${auditMode ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                <i className="fa-solid fa-file-medical-alt"></i> 科学设计
              </button>
              {!isEditing && (
                <button onClick={() => { setIsContrastMode(!isContrastMode); setSortKey(null); }} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${isContrastMode ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                  <i className="fa-solid fa-trophy"></i> 冠军对比
                </button>
              )}
            </div>

            {/* Edit Group */}
            <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
              {isEditing ? (
                <button onClick={() => setIsEditing(false)} className="px-5 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase shadow-sm">完成编辑</button>
              ) : (
                <button onClick={() => setIsEditing(true)} className="px-4 py-1.5 text-indigo-600 rounded-lg text-[10px] font-black uppercase hover:bg-indigo-50 flex items-center gap-2">
                  <i className="fa-solid fa-pen-to-square"></i> 编辑矩阵
                </button>
              )}
            </div>

            {/* AI Group */}
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || isEditing}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-100 hover:bg-black transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {isAnalyzing ? <i className="fa-solid fa-spinner animate-spin"></i> : <i className="fa-solid fa-brain"></i>} AI 发现
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

      {analysisResult && (
        <div className="mb-6 bg-white p-6 rounded-[2rem] border-2 border-indigo-100 shadow-xl relative overflow-hidden animate-reveal shrink-0">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
          <button onClick={() => setAnalysisResult(null)} className="absolute top-4 right-4 text-slate-300 hover:text-rose-500"><i className="fa-solid fa-times"></i></button>
          <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2"><i className="fa-solid fa-wand-magic-sparkles"></i> AI 多变量回归分析报告</h4>
          <div className="text-[11px] font-medium leading-relaxed text-slate-700 whitespace-pre-wrap italic pl-2">{analysisResult}</div>
        </div>
      )}

      <div className="flex-1 bg-white rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col min-h-0 border-2 border-dashed border-indigo-200 p-5">
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
        />
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-[9px] font-bold text-slate-400 px-6 shrink-0">
          <span>Total Samples: {activeMatrix?.data?.length || 0}</span>
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-indigo-100 border border-indigo-200"></span> 工艺参数 (Process)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-200"></span> 性能指标 (Result)</span>
            {auditMode && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500 animate-pulse"></span> Audit Alerts</span>}
          </div>
        </div>
      </div>

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

      <SafeModal config={confirmModal} onClose={() => setConfirmModal(null)} />
    </div>
  );
};

export default SampleMatrixView;
