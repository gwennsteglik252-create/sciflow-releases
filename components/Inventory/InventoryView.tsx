
import React, { useState, useMemo, useEffect, useCallback, useDeferredValue } from 'react';
import { useProjectContext } from '../../context/ProjectContext';
import { InventoryItem, InventoryCategory } from '../../types';
import { generateMSDS } from '../../services/gemini/resource';
import { InventoryHeader } from './Sub/InventoryHeader';
import { InventoryFilters } from './Sub/InventoryFilters';
import { InventoryCard } from './Sub/InventoryCard';
import { InventoryItemModal } from './Sub/InventoryItemModal';
import ScientificMarkdown from '../Common/ScientificMarkdown';

const InventoryView: React.FC = () => {
  const {
    inventory, setInventory, showToast,
    pendingEditInventoryId, setPendingEditInventoryId,
    returnPath, setReturnPath,
    setModalOpen
  } = useProjectContext();

  const [activeTab, setActiveTab] = useState<InventoryCategory | 'All' | 'PurchaseList'>('All');
  const [showInUseOnly, setShowInUseOnly] = useState(false);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [search, setSearch] = useState('');

  // 使用 deferredSearch 避免在输入时因为过滤大数据集而引起卡顿
  const deferredSearch = useDeferredValue(search);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [msdsModalShow, setMsdsModalShow] = useState(false);
  const [activeMSDSItem, setActiveMSDSItem] = useState<InventoryItem | null>(null);
  const [isGeneratingMSDS, setIsGeneratingMSDS] = useState(false);

  const normalize = (v: any) => String(v ?? '').trim().toLowerCase();
  const isPurchasingStatus = (status: any) => normalize(status) === 'purchasing';
  const buildPurchaseFingerprint = (item: InventoryItem) => [
    normalize(item.name),
    normalize(item.casNo),
    normalize(item.formula),
    normalize(item.brand),
    normalize(item.linkedProjectId),
    'purchasing'
  ].join('::');

  const dedupedInventory = useMemo(() => {
    const seen = new Map<string, InventoryItem>();
    for (const item of inventory || []) {
      if (!item) continue;
      const key = isPurchasingStatus(item.status)
        ? `purchase::${buildPurchaseFingerprint(item)}`
        : `id::${String(item.id)}`;
      const prev = seen.get(key);
      if (!prev) {
        seen.set(key, item);
        continue;
      }
      // 采购项重复时合并数量与件数，保留信息更完整的版本
      if (isPurchasingStatus(item.status)) {
        const merged: InventoryItem = {
          ...(prev.lastUpdated >= item.lastUpdated ? prev : item),
          quantity: Number(prev.quantity || 0) + Number(item.quantity || 0),
          stockCount: Number(prev.stockCount || 0) + Number(item.stockCount || 0),
          lastUpdated: new Date().toLocaleDateString()
        };
        seen.set(key, merged);
      }
    }
    return Array.from(seen.values());
  }, [inventory]);

  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    name: '', formula: '', casNo: '', brand: '', model: '', category: 'Chemical',
    purity: '', quantity: 0, unit: '', threshold: 0, location: '',
    safetyLevel: 'Safe', status: 'Ready', note: '',
    linkedProjectId: '', procurementDeadline: ''
  });

  const handleGenerateMSDS = useCallback(async (item: InventoryItem) => {
    setActiveMSDSItem(item);
    setMsdsModalShow(true);

    if (item.msdsData) return; // Already generated

    setIsGeneratingMSDS(true);
    try {
      const result = await generateMSDS(item);
      if (result) {
        setInventory(prev => prev.map(i => i.id === item.id ? { ...i, msdsData: result } : i));
        // 更新当前选中的 item 以便 UI 立即显示
        setActiveMSDSItem(prev => prev && prev.id === item.id ? { ...prev, msdsData: result } : prev);
      } else {
        showToast({ message: "MSDS 生成失败，AI 未返回内容", type: 'error' });
      }
    } catch (error: any) {
      console.error("MSDS Generation Error:", error);
      showToast({ message: `生成失败: ${error?.message || '未知错误'}`, type: 'error' });
    } finally {
      setIsGeneratingMSDS(false);
    }
  }, [setInventory, showToast]);

  // 处理深层链接 (Deep Link) 逻辑...
  useEffect(() => {
    if (pendingEditInventoryId) {
      const item = inventory.find(i => i.id === pendingEditInventoryId);
      if (item) {
        setEditingItem(item);
        setFormData({
          ...item,
          linkedProjectId: item.linkedProjectId || '',
          procurementDeadline: item.procurementDeadline || ''
        });
        setShowAddModal(true);
      }
    }
  }, [pendingEditInventoryId, inventory]);

  const filteredInventory = useMemo(() => {
    return dedupedInventory.filter(item => {
      const isPurchasing = isPurchasingStatus(item.status);
      const isLow = item.category !== 'Hardware' && item.quantity <= item.threshold;

      // 如果在采购清单标签页，仅显示采购中且符合搜索条件的项
      if (activeTab === 'PurchaseList') {
        if (!isPurchasing) return false;
      } else {
        // 在其他标签页（全部或特定分类），排除采购中的项
        if (isPurchasing) return false;
      }

      const matchTab = activeTab === 'All' || activeTab === 'PurchaseList' || item.category === activeTab;
      const deferredS = deferredSearch.toLowerCase();
      const matchSearch = item.name.toLowerCase().includes(deferredS) ||
        item.formula?.toLowerCase().includes(deferredS) ||
        item.casNo?.toLowerCase().includes(deferredS) ||
        item.brand?.toLowerCase().includes(deferredS);

      const matchInUse = showInUseOnly ? item.status === 'In Use' : true;
      const matchLowStock = showLowStockOnly ? isLow : true;

      return matchTab && matchSearch && matchInUse && matchLowStock;
    });
  }, [dedupedInventory, activeTab, deferredSearch, showInUseOnly, showLowStockOnly]);

  const stats = useMemo(() => {
    const total = dedupedInventory.length;
    const reagents = dedupedInventory.filter(i => i.category !== 'Hardware' && !isPurchasingStatus(i.status)).length;
    const hardware = dedupedInventory.filter(i => i.category === 'Hardware' && !isPurchasingStatus(i.status)).length;
    const lowStock = dedupedInventory.filter(i => i.category !== 'Hardware' && i.quantity <= i.threshold && !isPurchasingStatus(i.status)).length;
    const purchasing = dedupedInventory.filter(i => isPurchasingStatus(i.status)).length;
    return { total, reagents, hardware, lowStock, purchasing };
  }, [dedupedInventory]);

  const handleOpenAddModal = useCallback((isPurchasing = false) => {
    setEditingItem(null);
    setFormData({
      name: '', category: 'Chemical', quantity: 0, unit: '',
      threshold: 0, location: '', safetyLevel: 'Safe',
      status: isPurchasing ? 'Purchasing' : 'Ready',
      note: '',
      linkedProjectId: '',
      procurementDeadline: ''
    });
    setShowAddModal(true);
  }, []);

  const handleEditItem = useCallback((item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      ...item,
      linkedProjectId: item.linkedProjectId || '',
      procurementDeadline: item.procurementDeadline || ''
    });
    setShowAddModal(true);
  }, []);

  const handleProcureItem = useCallback((item: InventoryItem) => {
    setEditingItem(null);
    setFormData({
      name: item.name,
      formula: item.formula,
      casNo: item.casNo,
      brand: item.brand,
      category: item.category,
      unit: item.unit,
      threshold: item.threshold,
      safetyLevel: item.safetyLevel,
      status: 'Purchasing',
      quantity: Math.max(10, item.threshold * 5),
      note: `库存补货申请：针对库存项 ${item.name}`,
      procurementDeadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
    });
    setShowAddModal(true);
  }, []);

  const handleDeleteItem = useCallback((id: string) => {
    const item = inventory.find(i => String(i.id) === String(id));
    setModalOpen('confirm', {
      show: true,
      title: '确认删除资产？',
      desc: `确定要从库存中心永久移除 "${item?.name || '该项目'}" 吗？此操作不可撤销。`,
      onConfirm: () => {
        setInventory(prev => prev.filter(i => String(i.id) !== String(id)));
        showToast({ message: "项目已成功删除", type: 'success' });
        setModalOpen('confirm', null);
      }
    });
  }, [inventory, setInventory, setModalOpen, showToast]);

  const closeModal = useCallback(() => {
    setShowAddModal(false);
    setPendingEditInventoryId(null);
    setEditingItem(null);
  }, [setPendingEditInventoryId]);

  const onAddHeader = useCallback(() => handleOpenAddModal(false), [handleOpenAddModal]);
  const onAddPurchaseHeader = useCallback(() => handleOpenAddModal(true), [handleOpenAddModal]);
  const onShowLowStockHeader = useCallback(() => { setActiveTab('All'); setShowLowStockOnly(true); }, []);
  const onShowPurchaseListHeader = useCallback(() => setActiveTab('PurchaseList'), []);
  const setTabCb = useCallback((tab: InventoryCategory | 'All' | 'PurchaseList') => { setActiveTab(tab); setShowLowStockOnly(false); }, []);

  const onConvertToStockCb = useCallback((it: InventoryItem) => {
    setEditingItem(it);
    setFormData({ ...it, status: 'Ready', location: '', quantity: it.quantity || 1 });
    setShowAddModal(true);
  }, []);

  const onSaveModal = useCallback((data: any) => {
    const wasConverting = editingItem?.status === 'Purchasing' && data.status !== 'Purchasing';

    if (wasConverting) {
      // Try to find an existing Ready/In-Use stock item with same identity
      const incomingQty = (data.quantity as number) || 0;
      const nameLower = (data.name as string || '').toLowerCase().trim();
      const match = inventory.find(i =>
        i.id !== editingItem!.id &&
        i.status !== 'Purchasing' &&
        i.name.toLowerCase().trim() === nameLower &&
        (!data.casNo || !i.casNo || i.casNo === data.casNo) &&
        (!data.formula || !i.formula || i.formula === data.formula) &&
        (!data.brand || !i.brand || i.brand.toLowerCase().trim() === (data.brand as string || '').toLowerCase().trim())
      );

      if (match) {
        // Merge: add incoming qty to existing item, delete the purchasing entry
        setInventory(prev => prev
          .filter(i => i.id !== editingItem!.id) // remove purchasing entry
          .map(i => i.id === match.id
            ? { ...i, quantity: i.quantity + incomingQty, lastUpdated: new Date().toLocaleDateString() }
            : i
          )
        );
        closeModal();
        showToast({ message: `到货 ${incomingQty} ${match.unit} 已合并至现有库存「${match.name}」，当前总量 ${match.quantity + incomingQty} ${match.unit}`, type: 'success' });
        return;
      }
    }

    // Default: update existing or create new
    const item: InventoryItem = {
      ...data as InventoryItem,
      id: editingItem?.id || Date.now().toString(),
      lastUpdated: new Date().toLocaleDateString()
    };
    if (editingItem) {
      setInventory(prev => prev.map(i => i.id === item.id ? item : i));
    } else {
      if (isPurchasingStatus(item.status)) {
        setInventory(prev => {
          const fp = buildPurchaseFingerprint(item);
          const existingIdx = prev.findIndex(i => isPurchasingStatus(i.status) && buildPurchaseFingerprint(i) === fp);
          if (existingIdx === -1) return [item, ...prev];
          const next = [...prev];
          const existing = next[existingIdx];
          next[existingIdx] = {
            ...existing,
            quantity: Number(existing.quantity || 0) + Number(item.quantity || 0),
            stockCount: Number(existing.stockCount || 0) + Number(item.stockCount || 0),
            procurementDeadline: item.procurementDeadline || existing.procurementDeadline,
            urgency: item.urgency || existing.urgency,
            note: item.note || existing.note,
            lastUpdated: new Date().toLocaleDateString()
          };
          return next;
        });
      } else {
        setInventory(prev => [item, ...prev]);
      }
    }
    closeModal();
    showToast({ message: wasConverting ? `到货已登记，「${item.name}」已入库` : "库存数据已更新", type: 'success' });
  }, [editingItem, inventory, setInventory, closeModal, showToast]);

  const onBackToReportCb = useCallback(() => {
    if (returnPath) {
      const path = returnPath;
      setReturnPath(null);
      setPendingEditInventoryId(null);
      window.location.hash = path;
    }
  }, [returnPath, setReturnPath, setPendingEditInventoryId]);

  return (
    <div className="h-full flex flex-col gap-6 animate-reveal p-6 lg:p-10 bg-slate-50/50 overflow-hidden">
      <InventoryHeader
        stats={stats}
        onAdd={onAddHeader}
        onAddPurchase={onAddPurchaseHeader}
        onShowLowStock={onShowLowStockHeader}
        onShowPurchaseList={onShowPurchaseListHeader}
      />

      <InventoryFilters
        activeTab={activeTab}
        setActiveTab={setTabCb}
        showInUseOnly={showInUseOnly}
        setShowInUseOnly={setShowInUseOnly}
        showLowStockOnly={showLowStockOnly}
        search={search}
        setSearch={setSearch}
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-12">
          {filteredInventory.map(item => (
            <InventoryCard
              key={item.id}
              item={item}
              onEdit={handleEditItem}
              onDelete={handleDeleteItem}
              onProcure={handleProcureItem}
              onConvertToStock={onConvertToStockCb}
              onGenerateMSDS={handleGenerateMSDS}
            />
          ))}
          {filteredInventory.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300 gap-4">
              <i className="fa-solid fa-box-open text-6xl opacity-20"></i>
              <p className="text-sm font-black uppercase tracking-widest italic">未找到匹配资产</p>
            </div>
          )}
        </div>
      </div>

      <InventoryItemModal
        show={showAddModal}
        onClose={closeModal}
        editingItem={editingItem}
        formData={formData}
        setFormData={setFormData}
        onSave={onSaveModal}
        returnPath={returnPath}
        onBackToReport={onBackToReportCb}
      />

      {/* MSDS AI Generation Modal */}
      {msdsModalShow && activeMSDSItem && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] p-8 animate-reveal shadow-2xl relative flex flex-col max-h-[85vh]">
            <button
              onClick={() => setMsdsModalShow(false)}
              className="absolute top-6 right-6 text-slate-300 hover:text-rose-500 transition-all"
            >
              <i className="fa-solid fa-times text-xl"></i>
            </button>

            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                <i className="fa-solid fa-wand-magic-sparkles text-xl"></i>
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase italic leading-none mb-1">AI 生成 MSDS 报告</h3>
                <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase italic">MATERIAL SAFETY DATA SHEET GENERATOR</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 rounded-2xl p-6 border border-slate-100 min-h-[300px]">
              {isGeneratingMSDS ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 py-20">
                  <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-[11px] font-black text-indigo-600 uppercase italic animate-pulse">正在调取全球安全数据库并生成报告...</p>
                </div>
              ) : (
                <div className="prose prose-slate max-w-none">
                  {activeMSDSItem.msdsData ? (
                    <ScientificMarkdown content={activeMSDSItem.msdsData} />
                  ) : (
                    <p className="text-center py-20 text-slate-400 font-bold italic">暂无 MSDS 数据，请点击下方按钮开始生成。</p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-4">
              <button
                onClick={() => setMsdsModalShow(false)}
                className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase hover:bg-slate-200 transition-all"
              >
                关闭窗口
              </button>
              <button
                disabled={isGeneratingMSDS}
                onClick={() => handleGenerateMSDS(activeMSDSItem)}
                className={`flex-1 py-4 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl transition-all active:scale-95 disabled:opacity-50 ${activeMSDSItem.msdsData ? 'bg-slate-800 hover:bg-black' : 'bg-indigo-600 hover:bg-black'}`}
              >
                {activeMSDSItem.msdsData ? '重新生成' : '开始生成'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryView;
