
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { ResearchProject, TransformationProposal } from '../../types';
import { RouteNode } from './Route/RouteNode';
import { RouteComparisonModal } from './Route/RouteComparisonModal';
import { useProjectContext } from '../../context/ProjectContext';

interface ProcessRouteViewProps {
  project: ResearchProject;
  expandedProposalIds: Set<string>;
  onToggleExpansion: (id: string) => void;
  onUpdateProject: (updated: ResearchProject) => void;
  onAdoptProposal: (proposal: TransformationProposal) => void;
  onLinkPlan: (proposal: TransformationProposal) => void;
  onAddSubProposal: (parentId: string) => void;
  onEditContent: (proposal: TransformationProposal) => void;
  onEditMeta: (id: string, title: string, status: any) => void;
  onDelete: (id: string) => void;
  Maps: (view: any, projectId?: string, subView?: string) => void;
}

const ProcessRouteView: React.FC<ProcessRouteViewProps> = ({
  project, expandedProposalIds, onToggleExpansion, onUpdateProject,
  onAdoptProposal, onLinkPlan, onAddSubProposal: onAddSubProposalProp, onEditContent, onEditMeta, onDelete, Maps
}) => {
  const { updateFlowchartSession } = useProjectContext();
  const [adoptingId, setAdoptingId] = useState<string | null>(null);
  const [selectedCompareIds, setSelectedCompareIds] = useState<Set<string>>(new Set());
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Drag & Drop state for reordering top-level routes
  const dragItem = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below' | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    dragItem.current = id;
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.4';
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    dragItem.current = null;
    setDragOverId(null);
    setDragOverPosition(null);
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragItem.current === id) return;
    // Determine if cursor is in the top or bottom half
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? 'above' : 'below';
    setDragOverId(id);
    setDragOverPosition(pos);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverId(null);
    setDragOverPosition(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = dragItem.current;
    if (!sourceId || sourceId === targetId) return;

    const proposals = [...(project.proposals || [])];
    // Only reorder top-level proposals (no parentId)
    const topLevel = proposals.filter(p => !p.parentId);
    const children = proposals.filter(p => p.parentId);

    const sourceIdx = topLevel.findIndex(p => p.id === sourceId);
    const targetIdx = topLevel.findIndex(p => p.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const [moved] = topLevel.splice(sourceIdx, 1);
    // Determine position based on cursor
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertIdx = e.clientY < midY ? targetIdx : (targetIdx >= sourceIdx ? targetIdx : targetIdx + 1);
    topLevel.splice(insertIdx > topLevel.length ? topLevel.length : insertIdx, 0, moved);

    onUpdateProject({ ...project, proposals: [...topLevel, ...children] });
    dragItem.current = null;
    setDragOverId(null);
    setDragOverPosition(null);
    setIsDragging(false);
  }, [project, onUpdateProject]);

  // In-place editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHypothesis, setEditHypothesis] = useState('');
  const [editProcessChanges, setEditProcessChanges] = useState('');
  const [editFlowchart, setEditFlowchart] = useState<{ step: string; action: string }[]>([]);
  const [editControlParams, setEditControlParams] = useState<{ key: string; value: string; reason: string }[]>([]);
  const [editOptimizedParams, setEditOptimizedParams] = useState<{ key: string; value: string; reason: string }[]>([]);

  const handleStartEdit = (prop: TransformationProposal) => {
    setEditingId(prop.id);
    setEditHypothesis(prop.scientificHypothesis || "");
    setEditProcessChanges(prop.processChanges || "");
    setEditFlowchart([...(prop.newFlowchart || [])]);
    setEditControlParams([...(prop.controlParameters || [])]);
    setEditOptimizedParams([...(prop.optimizedParameters || [])]);
    if (!expandedProposalIds.has(prop.id)) onToggleExpansion(prop.id);
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    const updatedProposals = (project.proposals || []).map(p =>
      p.id === editingId ? {
        ...p,
        scientificHypothesis: editHypothesis,
        processChanges: editProcessChanges,
        newFlowchart: editFlowchart,
        controlParameters: editControlParams,
        optimizedParameters: editOptimizedParams
      } : p
    );
    onUpdateProject({ ...project, proposals: updatedProposals });
    setEditingId(null);
  };

  const handleAdoptClick = (prop: TransformationProposal) => {
    setAdoptingId(prop.id);
    setTimeout(() => { onAdoptProposal(prop); setAdoptingId(null); Maps('project_detail', project.id, 'logs'); }, 1500);
  };

  const handleRenameProposal = (id: string, newTitle: string) => {
    const updated = (project.proposals || []).map(p => p.id === id ? { ...p, title: newTitle } : p);
    onUpdateProject({ ...project, proposals: updated });
  };

  const handlePushToLab = (prop: TransformationProposal) => {
    const stepsText = (prop.newFlowchart || []).map((s, i) => `${i + 1}. ${s.step}: ${s.action}`).join('\n');
    const allParams = [...(prop.optimizedParameters || []), ...(prop.controlParameters || [])];
    const paramsText = allParams.map(p => `- ${p.key}: ${p.value} (${p.reason})`).join('\n');
    const fullDescription = `【工艺来源】${prop.title}\n\n【建议步骤】\n${stepsText}\n\n【关键控制参数】\n${paramsText}`;

    updateFlowchartSession({ description: fullDescription });
    // 执行 instant 跳转说明
    Maps('flowchart', project.id);
  };

  const getParamIntensity = (valStr: string) => {
    const num = parseFloat(valStr.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return 0.05;
    return Math.min(Math.max(Math.log10(num + 1) / 5, 0.05), 0.3);
  };

  const getAiFeasibility = (prop: TransformationProposal) => {
    const seed = prop.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const score = 40 + (seed % 60);
    return { score, riskText: score > 80 ? "设备兼容性高，适合快速放大。" : score > 60 ? "注意能耗优化。" : "存在前驱体依赖风险。" };
  };

  const comparedProposals = useMemo(() => (project.proposals || []).filter(p => selectedCompareIds.has(p.id)), [project.proposals, selectedCompareIds]);

  const comparisonData = useMemo(() => {
    if (comparedProposals.length !== 2) return null;
    const [p1, p2] = comparedProposals;
    const params1 = p1.controlParameters || [];
    const params2 = p2.controlParameters || [];
    const allKeys = new Set([...params1.map(p => p.key), ...params2.map(p => p.key)]);
    return Array.from(allKeys).map(key => {
      const val1 = params1.find(p => p.key === key)?.value || '-';
      const val2 = params2.find(p => p.key === key)?.value || '-';
      return { key, val1, val2, isDiff: val1 !== val2 };
    });
  }, [comparedProposals]);

  const handleAddNewRoute = (parentId?: string) => {
    const newId = `manual_${Date.now()}`;
    let newProp: TransformationProposal;

    if (parentId) {
      const parent = project.proposals?.find(p => p.id === parentId);
      if (parent) {
        newProp = {
          ...parent,
          id: newId,
          parentId,
          title: `子路线: ${parent.title}`,
          status: 'sub',
          timestamp: new Date().toLocaleString()
        };
      } else {
        return;
      }
    } else {
      newProp = {
        id: newId,
        literatureId: 'MANUAL',
        literatureTitle: '手动创建',
        timestamp: new Date().toLocaleString(),
        title: '新工艺路线',
        status: 'main',
        processChanges: '手动录入的工艺变更路径。',
        newFlowchart: [{ step: '初始工序', action: '待描述操作细节' }],
        controlParameters: [{ key: '反应温度', value: '25°C', reason: '初始基准值' }],
        optimizedParameters: [{ key: '预期收率', value: '>90%', reason: '参考基准' }],
        scientificHypothesis: '待设定改进假设'
      };
    }

    onUpdateProject({ ...project, proposals: [...(project.proposals || []), newProp] });

    // Auto expand and open editor
    if (parentId && !expandedProposalIds.has(parentId)) onToggleExpansion(parentId);
    handleStartEdit(newProp);
  };

  const renderProposalsRecursive = (parentId: string | undefined = undefined, depth = 0) => {
    const filtered = (project.proposals || []).filter(p => parentId === undefined ? !p.parentId : p.parentId === parentId);
    return filtered.map((prop, idx) => {
      const isTopLevel = depth === 0;
      const isDropTarget = dragOverId === prop.id;

      const dragProps = isTopLevel ? {
        draggable: true,
        onDragStart: (e: React.DragEvent) => handleDragStart(e, prop.id),
        onDragEnd: handleDragEnd,
        onDragOver: (e: React.DragEvent) => handleDragOver(e, prop.id),
        onDragLeave: handleDragLeave,
        onDrop: (e: React.DragEvent) => handleDrop(e, prop.id),
      } : {};

      return (
        <div key={prop.id} {...dragProps} className={`relative ${isTopLevel ? 'cursor-grab active:cursor-grabbing' : ''}`}>
          {/* Drop indicator line - above */}
          {isTopLevel && isDropTarget && dragOverPosition === 'above' && (
            <div className="absolute top-0 left-4 right-4 h-1 bg-indigo-500 rounded-full z-30 -translate-y-1/2 shadow-lg shadow-indigo-500/40 animate-pulse" />
          )}

          <RouteNode
            prop={prop} depth={depth} idx={idx} listLength={filtered.length}
            isExpanded={expandedProposalIds.has(prop.id)} isSelected={selectedCompareIds.has(prop.id)}
            isActive={adoptingId === prop.id} isCurrentlyEditing={editingId === prop.id} adoptingId={adoptingId}
            onToggleExpansion={onToggleExpansion} toggleCompareSelection={(id) => setSelectedCompareIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else if (n.size < 2) n.add(id); return n; })}
            onAddSubProposal={handleAddNewRoute}
            onLinkPlan={() => onLinkPlan(prop)}
            onDelete={onDelete} onEditMeta={onEditMeta}
            handleStartEdit={handleStartEdit} handleSaveEdit={handleSaveEdit} handleCancelEdit={() => setEditingId(null)}
            handleAdoptClick={handleAdoptClick} handleSourceLink={(p) => Maps('literature', project.id, `${p.literatureId}_rp`)}
            handleRename={handleRenameProposal}
            onPushToLab={() => handlePushToLab(prop)}
            getAiFeasibility={getAiFeasibility} getParamIntensity={getParamIntensity}
            editingData={{
              hypothesis: editHypothesis, setHypothesis: setEditHypothesis,
              processChanges: editProcessChanges, setProcessChanges: setEditProcessChanges,
              flowchart: editFlowchart, setFlowchart: setEditFlowchart,
              params: [...editOptimizedParams, ...editControlParams],
              setParams: (newParams) => {
                setEditOptimizedParams(newParams.filter(p => p.key.includes('收率') || p.key.includes('纯度')));
                setEditControlParams(newParams.filter(p => !(p.key.includes('收率') || p.key.includes('纯度'))));
              }
            }}
          >
            {renderProposalsRecursive(prop.id, depth + 1)}
          </RouteNode>

          {/* Drop indicator line - below */}
          {isTopLevel && isDropTarget && dragOverPosition === 'below' && (
            <div className="absolute bottom-0 left-4 right-4 h-1 bg-indigo-500 rounded-full z-30 translate-y-1/2 shadow-lg shadow-indigo-500/40 animate-pulse" />
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col p-4 lg:p-8 overflow-y-auto bg-slate-50/10 custom-scrollbar animate-reveal relative">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 px-2 gap-4 shrink-0">
        <div>
          <h3 className="text-xl lg:text-3xl font-black text-slate-800 uppercase tracking-tight italic flex items-center gap-3"><i className="fa-solid fa-bezier-curve text-violet-600"></i> 工艺演进全景</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 pl-10">PROCESS EVOLUTION TOPOLOGY</p>
        </div>
        <div className="flex gap-3">
          {selectedCompareIds.size === 2 && <button onClick={() => setShowCompareModal(true)} className="bg-amber-500 text-white px-5 py-3 rounded-xl font-black text-xs uppercase shadow-xl flex items-center gap-2"><i className="fa-solid fa-scale-balanced"></i> Compare (2)</button>}
          <button onClick={() => handleAddNewRoute()} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase shadow-xl"><i className="fa-solid fa-wand-magic-sparkles mr-2 text-amber-300"></i>新建路线</button>
        </div>
      </div>
      <div className="flex-1 pb-10">{renderProposalsRecursive()}</div>
      {showCompareModal && <RouteComparisonModal onClose={() => setShowCompareModal(false)} comparedProposals={comparedProposals} comparisonData={comparisonData} />}
    </div>
  );
};

export default ProcessRouteView;
