import React, { useState } from 'react';
import { ResourceAuditData, InventoryItem } from '../../../types';
import { useProjectContext } from '../../../context/ProjectContext';

interface RouteAuditPanelProps {
    auditData: ResourceAuditData;
    onRerun: () => void;
    onClose: () => void;
}

export const RouteAuditPanel: React.FC<RouteAuditPanelProps> = ({ auditData, onRerun, onClose }) => {
    const { inventory, setInventory, setPendingEditInventoryId, setReturnPath, showToast } = useProjectContext();
    const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set());

    const statusWeights: Record<string, number> = {
        ready: 0,
        low: 1,
        substitute: 2,
        missing: 3
    };

    const sortedReagents = React.useMemo(() =>
        [...(auditData.reagents || [])].sort((a, b) => (statusWeights[a.status] ?? 99) - (statusWeights[b.status] ?? 99)),
        [auditData.reagents]);

    const sortedEquipment = React.useMemo(() =>
        [...(auditData.equipment || [])].sort((a, b) => (statusWeights[a.status] ?? 99) - (statusWeights[b.status] ?? 99)),
        [auditData.equipment]);

    const handleToggleCollapse = (e: React.MouseEvent, name: string) => {
        e.stopPropagation();
        setCollapsedItems(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const handleItemClick = (inventoryId: string | undefined) => {
        if (!inventoryId) return;
        setPendingEditInventoryId(inventoryId);
        setReturnPath(window.location.hash);
        window.location.hash = 'inventory';
    };

    const handleAddToPurchasePlan = (e: React.MouseEvent, item: any) => {
        e.stopPropagation();
        const exists = inventory.find(i => i.name === item.name && i.status === 'Purchasing');
        if (exists) {
            showToast({ message: "该项已在采购计划中", type: 'info' });
            return;
        }

        const projectId = window.location.hash.split('/')[1] || '';

        const newItem: InventoryItem = {
            id: `proc_${Date.now()}`,
            name: item.name,
            category: 'Chemical',
            quantity: 0,
            unit: '待定',
            threshold: 0,
            location: '待采购',
            safetyLevel: 'Safe',
            status: 'Purchasing',
            lastUpdated: new Date().toLocaleDateString(),
            note: `源自工艺审计需求: ${item.reasoning || '缺失物料，需紧急申购'}`,
            linkedProjectId: projectId
        };

        setInventory(prev => [newItem, ...prev]);
        setPendingEditInventoryId(newItem.id);
        setReturnPath(window.location.hash);
        window.location.hash = 'inventory';
        showToast({ message: `已将 ${item.name} 加入采购清单并跳转管理`, type: 'success' });
    };

    const renderItem = (item: any) => {
        const invItem = inventory.find(i => i.id === item.matchedInventoryId);
        const isMissing = item.status === 'missing';
        const isSubstitute = item.status === 'substitute';
        const isLow = item.status === 'low';
        const isReady = item.status === 'ready';
        const isCollapsed = collapsedItems.has(item.name);
        const canClick = !!item.matchedInventoryId;

        return (
            <div
                key={item.name}
                onClick={(e) => isCollapsed ? handleToggleCollapse(e, item.name) : canClick && handleItemClick(item.matchedInventoryId)}
                className={`p-3 rounded-xl border transition-all ${isMissing ? 'bg-rose-50 border-rose-200' :
                    isSubstitute ? 'bg-indigo-50 border-indigo-200' :
                        isReady ? 'bg-emerald-50 border-emerald-200' :
                            'bg-slate-50 border-slate-100'
                    } mb-2 shadow-sm relative group cursor-pointer hover:shadow-md border-l-4 ${isMissing ? 'border-l-rose-500' :
                        isSubstitute ? 'border-l-indigo-500' :
                            isLow ? 'border-l-amber-400' : 'border-l-emerald-500'
                    }`}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className="flex flex-col min-w-0 flex-1">
                            <p className="text-[10px] font-black text-slate-800 truncate normal-case">
                                {item.name}
                            </p>
                            {item.matchedName && item.matchedName !== item.name && (
                                <p className="text-[8px] font-black text-indigo-600 truncate normal-case mt-0.5 bg-indigo-100/50 w-fit px-1.5 rounded">
                                    库存匹配: {item.matchedName}
                                </p>
                            )}
                            {invItem && !isCollapsed && (
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[7px] font-bold text-slate-400 uppercase">
                                        库位: {invItem.location}
                                    </span>
                                    <span className={`text-[8px] font-black ${invItem.quantity <= invItem.threshold ? 'text-rose-500' : 'text-indigo-600'}`}>
                                        余量: {invItem.quantity}{invItem.unit}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {isMissing && !isCollapsed && (
                            <button
                                onClick={(e) => handleAddToPurchasePlan(e, item)}
                                className="px-2 py-0.5 bg-rose-600 text-white rounded text-[7px] font-black uppercase hover:bg-black transition-all shadow-sm"
                            >
                                申购
                            </button>
                        )}
                        <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase border shadow-xs ${isMissing ? 'bg-rose-100 text-rose-600 border-rose-200' :
                            isSubstitute ? 'bg-indigo-600 text-white border-indigo-500' :
                                isLow ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                    'bg-emerald-100 text-emerald-700 border-emerald-200'
                            }`}>
                            {isReady ? '就绪' : isLow ? '存量低' : isSubstitute ? '可替代' : '缺失'}
                        </span>
                        <button
                            onClick={(e) => handleToggleCollapse(e, item.name)}
                            className="w-5 h-5 rounded hover:bg-black/5 flex items-center justify-center transition-colors"
                        >
                            <i className={`fa-solid ${isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'} text-slate-400 text-[8px]`}></i>
                        </button>
                    </div>
                </div>

                {!isCollapsed && item.reasoning && (
                    <div className="mt-2 pt-2 border-t border-black/5">
                        <div className="p-2 bg-white/60 rounded-lg italic text-[9px] text-slate-600 leading-relaxed text-justify shadow-inner">
                            {item.reasoning}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="mb-4 p-5 bg-slate-50/50 border border-slate-200 rounded-xl shadow-sm animate-reveal overflow-hidden relative">
            <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                    <h5 className="text-xs font-black text-slate-800 uppercase flex items-center gap-2 italic">
                        <i className="fa-solid fa-warehouse text-indigo-500"></i> 工艺资源就绪度审计报告
                    </h5>
                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">READINESS AUDIT & SEMANTIC INVENTORY MATCH</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-right mr-2 hidden sm:block">
                        <p className="text-[6px] font-black text-slate-300 uppercase leading-none">上次审计 (LAST AUDIT)</p>
                        <p className="text-[9px] font-black text-indigo-400 font-mono mt-0.5">{auditData.timestamp}</p>
                    </div>
                    <button onClick={onRerun} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[8px] font-black uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm">重新审计</button>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-500 transition-all flex items-center justify-center active:scale-90"><i className="fa-solid fa-times text-sm"></i></button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                <div>
                    <div className="flex items-center gap-2 mb-3 border-b border-slate-200 pb-2">
                        <i className="fa-solid fa-flask text-indigo-500 text-[8px]"></i>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex-1">关键试剂与材料 (REAGENTS)</p>
                        <span className="text-[8px] font-black bg-slate-200 text-slate-600 px-1.5 rounded-full">{auditData.reagents.length}</span>
                    </div>
                    <div className="flex flex-col">
                        {sortedReagents.map(renderItem)}
                    </div>
                </div>

                <div>
                    <div className="flex items-center gap-2 mb-3 border-b border-slate-200 pb-2">
                        <i className="fa-solid fa-microscope text-indigo-500 text-[8px]"></i>
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex-1">核心仪器与实验系统 (EQUIPMENT)</p>
                        <span className="text-[8px] font-black bg-slate-200 text-slate-600 px-1.5 rounded-full">{auditData.equipment.length}</span>
                    </div>
                    <div className="flex flex-col">
                        {sortedEquipment.map(renderItem)}
                    </div>
                </div>
            </div>
        </div>
    );
};