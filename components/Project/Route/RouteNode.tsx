
import React, { useState } from 'react';
import { TransformationProposal, ResourceAuditData } from '../../../types';
import { performSmartInventoryAudit } from '../../../services/gemini/resource';
import { useProjectContext } from '../../../context/ProjectContext';
import { RouteHeader } from './RouteHeader';
import { RouteActions } from './RouteActions';
import { RouteAuditPanel } from './RouteAuditPanel';
import { RouteTimeline } from './RouteTimeline';
import { RouteParameters } from './RouteParameters';

interface RouteNodeProps {
    prop: TransformationProposal;
    depth: number;
    idx: number;
    listLength: number;
    isExpanded: boolean;
    isSelected: boolean;
    isActive: boolean;
    isCurrentlyEditing: boolean;
    adoptingId: string | null;
    onToggleExpansion: (id: string) => void;
    toggleCompareSelection: (id: string) => void;
    onAddSubProposal: (parentId: string) => void;
    onLinkPlan: () => void;
    onPushToLab: () => void; // 跨模块推送
    onDelete: (id: string) => void;
    onEditMeta: (id: string, title: string, status: any) => void;
    handleStartEdit: (prop: TransformationProposal) => void;
    handleSaveEdit: () => void;
    handleCancelEdit: () => void;
    handleAdoptClick: (prop: TransformationProposal) => void;
    handleSourceLink: (prop: TransformationProposal) => void;
    handleRename?: (id: string, title: string) => void;
    getAiFeasibility: (prop: TransformationProposal) => { score: number, riskText: string };
    getParamIntensity: (val: string) => number;
    editingData: {
        hypothesis: string;
        setHypothesis: (v: string) => void;
        processChanges: string;
        setProcessChanges: (v: string) => void;
        flowchart: { step: string; action: string }[];
        setFlowchart: (v: { step: string; action: string }[]) => void;
        params: { key: string; value: string; reason: string }[];
        setParams: (v: { key: string; value: string; reason: string }[]) => void;
    };
    children?: React.ReactNode;
}

export const RouteNode: React.FC<RouteNodeProps> = ({
    prop, depth, idx, listLength, isExpanded, isSelected, isActive, isCurrentlyEditing, adoptingId,
    onToggleExpansion, toggleCompareSelection, onAddSubProposal, onLinkPlan, onPushToLab, onDelete, onEditMeta,
    handleStartEdit, handleSaveEdit, handleCancelEdit, handleAdoptClick, handleSourceLink, handleRename,
    getAiFeasibility, getParamIntensity, editingData, children
}) => {
    const { inventory, showToast, setAiStatus, setProjects } = useProjectContext();
    const { score, riskText } = getAiFeasibility(prop);
    const [isAuditVisible, setIsAuditVisible] = useState(false);
    const [isAuditing, setIsAuditing] = useState(false);

    const saveAuditResult = (audit: ResourceAuditData) => {
        setProjects(prev => prev.map(p => {
            if (p.proposals?.some(pr => pr.id === prop.id)) {
                return {
                    ...p,
                    proposals: p.proposals.map(pr => pr.id === prop.id ? { ...pr, resourceAudit: audit } : pr)
                };
            }
            return p;
        }));
    };

    const handleRunResourceAudit = async () => {
        setIsAuditing(true);
        if (setAiStatus) setAiStatus('🔍 正在启动语义化库存对标引擎...');
        try {
            const content = `${prop.scientificHypothesis}\n${prop.processChanges}\n${JSON.stringify(prop.newFlowchart)}`;
            const auditResult = await performSmartInventoryAudit(prop.title, content, inventory);
            const audit: ResourceAuditData = { timestamp: new Date().toLocaleString(), reagents: auditResult.reagents, equipment: auditResult.equipment };
            saveAuditResult(audit);
            setIsAuditVisible(true);
            showToast({ message: "资源对标审计已完成并保存", type: 'success' });
        } catch (e) {
            showToast({ message: "审计引擎异常", type: 'error' });
        } finally {
            setIsAuditing(false);
            if (setAiStatus) setAiStatus(null);
        }
    };

    const auditData = prop.resourceAudit;
    const hasAudit = !!auditData;
    const getOverallStatus = () => {
        if (!auditData) return null;
        const allItems = [...auditData.reagents, ...auditData.equipment];
        if (allItems.some(i => i.status === 'missing')) return 'bg-rose-500';
        if (allItems.some(i => i.status === 'substitute' || i.status === 'low')) return 'bg-amber-400';
        return 'bg-emerald-500';
    };

    const badgeColor = score >= 80 ? 'bg-emerald-600 border-emerald-500 text-white'
        : score >= 50 ? 'bg-amber-500 border-amber-400 text-white'
            : 'bg-rose-600 border-rose-500 text-white';

    const isAdopting = adoptingId === prop.id;

    return (
        <div className="relative group/tree" style={{ marginLeft: `${depth * 2.5}rem` }}>
            {/* 树状连接线 */}
            {depth > 0 && <div className="absolute left-[-1.5rem] top-0 bottom-6 w-1 bg-slate-200 rounded-full opacity-60"></div>}
            {depth > 0 && <div className="absolute left-[-1.5rem] top-8 w-6 h-1 bg-slate-200 rounded-full opacity-60"></div>}

            <div className={`bg-white rounded-2xl border-2 transition-all duration-300 overflow-hidden mb-4 relative ${isActive ? 'border-indigo-600 shadow-2xl ring-2 ring-indigo-500/10'
                : isSelected ? 'border-indigo-400 ring-4 ring-indigo-50 bg-indigo-50/5'
                    : 'border-slate-200 shadow-md hover:border-indigo-400 hover:shadow-xl'
                }`}>
                <header className="px-4 py-2.5 cursor-pointer hover:bg-slate-50/50 transition-colors flex justify-between items-center group/header relative">
                    <RouteHeader
                        prop={prop} isSelected={isSelected} isActive={isActive}
                        onToggleExpansion={() => onToggleExpansion(prop.id)} toggleCompareSelection={() => toggleCompareSelection(prop.id)}
                        onRename={handleRename}
                    />
                    <RouteActions
                        prop={prop} hasAudit={hasAudit} isAuditing={isAuditing} getOverallStatus={getOverallStatus} isExpanded={isExpanded}
                        isCurrentlyEditing={isCurrentlyEditing}
                        onRunAudit={handleRunResourceAudit}
                        onToggleAudit={() => setIsAuditVisible(!isAuditVisible)}
                        onToggleExpansion={() => onToggleExpansion(prop.id)}
                        onSourceLink={() => handleSourceLink(prop)}
                        onAddSub={() => onAddSubProposal(prop.id)}
                        onStartEdit={() => handleStartEdit(prop)}
                        onSaveEdit={() => handleSaveEdit()}
                        onDelete={() => onDelete(prop.id)}
                        onLinkPlan={onLinkPlan}
                        onPushToLab={onPushToLab} // 关键下钻
                        score={score} badgeColor={badgeColor}
                    />
                </header>

                {isExpanded && (
                    <div className="px-6 pb-6 pt-1 animate-reveal bg-white">
                        {hasAudit && isAuditVisible && (
                            <RouteAuditPanel auditData={auditData} onRerun={handleRunResourceAudit} onClose={() => setIsAuditVisible(false)} />
                        )}

                        <div className="mb-4 p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 relative">
                            <h5 className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <i className="fa-solid fa-microscope text-indigo-400"></i> 科学假设与推演逻辑
                            </h5>
                            {isCurrentlyEditing ? (
                                <textarea className="w-full bg-white border-2 border-indigo-100 rounded-xl p-3 text-[11px] font-medium text-slate-700 outline-none focus:border-indigo-500 transition-all resize-none min-h-[60px]" value={editingData.hypothesis} onChange={(e) => editingData.setHypothesis(e.target.value)} />
                            ) : (
                                <p className="text-[11px] font-bold text-slate-800 italic leading-relaxed">{prop.scientificHypothesis}</p>
                            )}
                        </div>

                        {!isCurrentlyEditing && (
                            <div className="mb-4 p-3 bg-amber-50 rounded-2xl border-2 border-amber-100 flex gap-3 items-center">
                                <i className="fa-solid fa-triangle-exclamation text-amber-500 text-xs"></i>
                                <p className="text-[10px] font-bold text-amber-700 italic">{riskText}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <RouteTimeline steps={isCurrentlyEditing ? editingData.flowchart : prop.newFlowchart} isEditing={isCurrentlyEditing} onUpdate={editingData.setFlowchart} />
                            <RouteParameters
                                params={isCurrentlyEditing ? editingData.params : [...(prop.optimizedParameters || []), ...(prop.controlParameters || [])]}
                                isEditing={isCurrentlyEditing}
                                onUpdate={editingData.setParams}
                                getIntensity={getParamIntensity}
                            />
                        </div>

                        <div className="mt-6 pt-4 border-t-2 border-slate-50 flex justify-end items-center gap-4">
                            {isCurrentlyEditing ? (
                                <div className="flex gap-3">
                                    <button onClick={handleCancelEdit} className="px-6 py-2 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">取消</button>
                                    <button onClick={handleSaveEdit} className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all">保存变更</button>
                                </div>
                            ) : (
                                <button onClick={() => handleAdoptClick(prop)} disabled={isAdopting} className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase shadow-xl transition-all active:scale-95 flex items-center gap-3 ${isAdopting ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white hover:bg-black hover:shadow-indigo-500/30'}`}>
                                    {isAdopting ? <i className="fa-solid fa-circle-notch animate-spin text-lg"></i> : <i className="fa-solid fa-rocket text-lg"></i>}
                                    {isAdopting ? '方案装载中...' : '采纳此演进路线'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {children}
        </div>
    );
};
