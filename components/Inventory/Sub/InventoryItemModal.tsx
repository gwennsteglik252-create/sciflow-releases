import { useMemo, useState, useCallback } from 'react';
import { InventoryItem, InventoryCategory, SafetyLevel, ResearchProject } from '../../../types';
import { useProjectContext } from '../../../context/ProjectContext';
import { useTranslation } from '../../../locales/useTranslation';
import { AutofillButton, OCRScanner } from './InventoryAIPanel';

interface InventoryItemModalProps {
    show: boolean;
    onClose: () => void;
    editingItem: InventoryItem | null;
    formData: Partial<InventoryItem>;
    setFormData: (val: Partial<InventoryItem>) => void;
    onSave: (data: Partial<InventoryItem>) => void;
    returnPath: string | null;
    onBackToReport: () => void;
}

// Option arrays will be created inside the component using t()

export const InventoryItemModal: React.FC<InventoryItemModalProps> = ({
    show, onClose, editingItem, formData, setFormData, onSave, returnPath, onBackToReport
}) => {
    const { t } = useTranslation();
    const { projects } = useProjectContext();
    const [showOCR, setShowOCR] = useState(false);

    const handleAutofill = useCallback((data: any) => {
        setFormData({
            ...formData,
            formula: data.formula || formData.formula || '',
            casNo: data.casNo || formData.casNo || '',
            molecularWeight: data.mw || formData.molecularWeight,
            safetyLevel: (data.safetyLevel || formData.safetyLevel) as SafetyLevel,
            unit: data.suggestedUnit || formData.unit || '',
            threshold: data.suggestedThreshold || formData.threshold || 0,
        });
    }, [formData, setFormData]);

    const handleOCRApply = useCallback((data: Partial<InventoryItem>) => {
        setFormData({ ...formData, ...data });
    }, [formData, setFormData]);

    const ALL_STATUS_OPTIONS = useMemo(() => [
        { value: 'Ready', label: t('inventory.statuses.Ready') },
        { value: 'In Use', label: t('inventory.statuses.In Use') },
        { value: 'Maintenance', label: t('inventory.statuses.Maintenance') },
        { value: 'Calibration Required', label: t('inventory.statuses.Calibration Required') },
    ], [t]);

    const CHEMICAL_SAFETY_OPTIONS = useMemo(() => [
        { value: 'Safe', label: t('inventory.safetyLevels.Safe') },
        { value: 'Toxic', label: t('inventory.safetyLevels.Toxic') },
        { value: 'Corrosive', label: t('inventory.safetyLevels.Corrosive') },
        { value: 'Flammable', label: t('inventory.safetyLevels.Flammable') },
        { value: 'Explosive', label: t('inventory.safetyLevels.Explosive') },
    ], [t]);

    const HARDWARE_SAFETY_OPTIONS = useMemo(() => [
        { value: 'General', label: t('inventory.safetyLevels.General') },
        { value: 'Precision', label: t('inventory.safetyLevels.Precision') },
        { value: 'Hazardous', label: t('inventory.safetyLevels.Hazardous') },
        { value: 'Restricted', label: t('inventory.safetyLevels.Restricted') },
    ], [t]);

    const isPurchasingMode = formData.status === 'Purchasing';

    const filteredStatusOptions = useMemo(() => {
        if (formData.category !== 'Hardware') {
            return ALL_STATUS_OPTIONS.filter(opt => ['Ready', 'In Use'].includes(opt.value));
        }
        return ALL_STATUS_OPTIONS;
    }, [formData.category, ALL_STATUS_OPTIONS]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1300] flex items-center justify-center p-4">
            <div className={`bg-white w-full max-w-3xl rounded-[2.2rem] p-6 lg:p-10 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[95vh]`}>
                <button onClick={onClose} className="absolute top-6 right-6 text-slate-300 hover:text-rose-500 transition-all"><i className="fa-solid fa-times text-xl"></i></button>

                <div className="flex justify-between items-center mb-6 shrink-0">
                    <h3 className={`text-xl font-black text-slate-800 uppercase italic border-l-8 ${isPurchasingMode ? 'border-emerald-500' : 'border-indigo-600'} pl-4 leading-none`}>
                        {isPurchasingMode ? t('inventory.modal.addPurchase') : (editingItem ? t('inventory.modal.editAsset') : t('inventory.modal.addAsset'))}
                    </h3>
                    <div className="flex items-center gap-2">
                        {/* OCR Scan Button */}
                        {!editingItem && (
                            <button
                                onClick={() => setShowOCR(true)}
                                className="text-[9px] font-black text-cyan-600 bg-cyan-50 px-3 py-2 rounded-xl border border-cyan-100 hover:bg-cyan-600 hover:text-white transition-all flex items-center gap-1.5 active:scale-95"
                            >
                                <i className="fa-solid fa-camera" /> {t('inventory.ai.ocrScan')}
                            </button>
                        )}
                        {returnPath && (
                            <button onClick={onBackToReport} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2">
                                <i className="fa-solid fa-arrow-left"></i> {t('inventory.modal.backToAudit')}
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                        {/* Row 1: Context & Name */}
                        {isPurchasingMode && (
                            <div className="md:col-span-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">{t('inventory.modal.projectContext')}</label>
                                <div className="relative">
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-bold text-slate-800 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-inner"
                                        value={formData.linkedProjectId || ''}
                                        onChange={e => setFormData({ ...formData, linkedProjectId: e.target.value })}
                                    >
                                        <option value="">{t('inventory.modal.selectProject')}</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                    </select>
                                    <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-[11px] pointer-events-none"></i>
                                </div>
                            </div>
                        )}

                        <div className={isPurchasingMode ? "md:col-span-2" : "md:col-span-4"}>
                            <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">
                                {isPurchasingMode ? t('inventory.modal.purchaseName') : t('inventory.modal.name')}
                            </label>
                            <div className="flex items-start gap-2">
                                <input
                                    className="flex-1 bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none border border-transparent focus:border-indigo-200 shadow-inner"
                                    value={formData.name || ''}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder={isPurchasingMode ? t('inventory.modal.placeholderPurchaseName') : t('inventory.modal.placeholderName')}
                                />
                                {formData.category !== 'Hardware' && (
                                    <div className="pt-1">
                                        <AutofillButton
                                            name={formData.name || ''}
                                            onAutofill={handleAutofill}
                                            disabled={isPurchasingMode}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Row 2: Main Stats */}
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">
                                    {isPurchasingMode ? t('inventory.modal.purchaseQuantity') : t('inventory.modal.quantity')}
                                </label>
                                <div className="flex bg-slate-50 rounded-xl shadow-inner border border-transparent focus-within:border-indigo-200 overflow-hidden">
                                    <input type="number" className="flex-1 bg-transparent p-3.5 text-sm font-black outline-none text-indigo-600" value={formData.quantity || 0} onChange={e => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })} />
                                    <span className="p-3.5 text-[10px] font-black text-slate-400 flex items-center bg-slate-100/50 uppercase">{formData.unit || 'UNIT'}</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-[11px] font-black text-indigo-400 uppercase mb-1.5 block px-1">
                                    {isPurchasingMode ? t('inventory.modal.purchaseStockCount') : t('inventory.modal.stockCount')}
                                </label>
                                <div className="flex bg-slate-50 rounded-xl shadow-inner border border-transparent focus-within:border-indigo-200 overflow-hidden">
                                    <input type="number" className="flex-1 bg-transparent p-3.5 text-sm font-black outline-none text-indigo-600" value={formData.stockCount || 1} onChange={e => setFormData({ ...formData, stockCount: parseInt(e.target.value) || 0 })} />
                                    <span className="p-3.5 text-[10px] font-black text-indigo-400 flex items-center bg-indigo-50/50 uppercase">{t('inventory.card.items')}</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">{t('inventory.modal.unit')}</label>
                            <input className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none border border-transparent focus:border-indigo-200 shadow-inner" value={formData.unit || ''} onChange={e => setFormData({ ...formData, unit: e.target.value })} placeholder={t('inventory.modal.placeholderUnit')} />
                        </div>
                        <div>
                            <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">{t('inventory.modal.category')}</label>
                            <select
                                className="w-full bg-slate-50 rounded-xl p-3.5 text-[11px] font-bold outline-none cursor-pointer shadow-inner border border-transparent focus:border-indigo-200"
                                value={formData.category}
                                onChange={e => {
                                    const nextCategory = e.target.value as InventoryCategory;
                                    const nextSafety = nextCategory === 'Hardware' ? 'General' : 'Safe';
                                    setFormData({ ...formData, category: nextCategory, safetyLevel: nextSafety });
                                }}
                            >
                                <option value="Chemical">{t('inventory.categories.Chemical')}</option>
                                <option value="Precursor">{t('inventory.categories.Precursor')}</option>
                                <option value="Hardware">{t('inventory.categories.Hardware')}</option>
                                <option value="Consumable">{t('inventory.categories.Consumable')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">{t('inventory.modal.brand')}</label>
                            <input className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none border border-transparent focus:border-indigo-200 shadow-inner" value={formData.brand || ''} onChange={e => setFormData({ ...formData, brand: e.target.value })} placeholder={t('inventory.modal.placeholderBrand')} />
                        </div>

                        {/* Row 3: Technical Specs */}
                        {formData.category === 'Hardware' ? (
                            <div className="md:col-span-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">{t('inventory.modal.model')}</label>
                                <input className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none border border-transparent focus:border-indigo-200 shadow-inner" value={formData.model || ''} onChange={e => setFormData({ ...formData, model: e.target.value })} placeholder={t('inventory.modal.placeholderModel')} />
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">{t('inventory.modal.casNo')}</label>
                                    <input className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none border border-transparent focus:border-indigo-200 shadow-inner" value={formData.casNo || ''} onChange={e => setFormData({ ...formData, casNo: e.target.value })} placeholder={t('inventory.modal.placeholderCas')} />
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">{t('inventory.modal.purity')}</label>
                                    <input className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none border border-transparent focus:border-indigo-200 shadow-inner" value={formData.purity || ''} onChange={e => setFormData({ ...formData, purity: e.target.value })} placeholder={t('inventory.modal.placeholderPurity')} />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">{t('inventory.modal.formula')}</label>
                                    <input className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none border border-transparent focus:border-indigo-200 shadow-inner" value={formData.formula || ''} onChange={e => setFormData({ ...formData, formula: e.target.value })} placeholder={t('inventory.modal.placeholderFormula')} />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">{t('inventory.modal.mw')}</label>
                                    <input type="number" className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none border border-transparent focus:border-indigo-200 shadow-inner" value={formData.molecularWeight || ''} onChange={e => setFormData({ ...formData, molecularWeight: parseFloat(e.target.value) || undefined })} placeholder={t('inventory.modal.placeholderMW')} />
                                </div>
                            </>
                        )}

                        <div>
                            <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">{t('inventory.modal.safetyLevel')}</label>
                            <select className="w-full bg-slate-50 rounded-xl p-3.5 text-[11px] font-bold outline-none cursor-pointer shadow-inner border border-transparent focus:border-indigo-200" value={formData.safetyLevel} onChange={e => setFormData({ ...formData, safetyLevel: e.target.value as SafetyLevel })}>
                                {(formData.category === 'Hardware' ? HARDWARE_SAFETY_OPTIONS : CHEMICAL_SAFETY_OPTIONS).map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {isPurchasingMode ? (
                            <div>
                                <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">{t('inventory.modal.urgency')}</label>
                                <select className="w-full bg-slate-50 rounded-xl p-3.5 text-[11px] font-bold outline-none cursor-pointer shadow-inner border border-emerald-200 text-emerald-700" value={formData.urgency || 'Normal'} onChange={e => setFormData({ ...formData, urgency: e.target.value as any })}>
                                    <option value="Normal">{t('inventory.urgencies.Normal')}</option>
                                    <option value="Urgent">{t('inventory.urgencies.Urgent')}</option>
                                    <option value="Critical">{t('inventory.urgencies.Critical')}</option>
                                </select>
                            </div>
                        ) : (
                            <div>
                                <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">{t('inventory.modal.status')}</label>
                                <select className="w-full bg-slate-50 rounded-xl p-3.5 text-[11px] font-bold outline-none cursor-pointer shadow-inner border border-transparent focus:border-indigo-200" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
                                    {filteredStatusOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Row 4: Constraints & Location */}
                        <div>
                            <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">{t('inventory.modal.threshold')}</label>
                            <input type="number" className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none text-rose-500 shadow-inner border border-transparent focus:border-indigo-200" value={formData.threshold || 0} onChange={e => setFormData({ ...formData, threshold: parseFloat(e.target.value) || 0 })} />
                        </div>

                        {isPurchasingMode ? (
                            <div>
                                <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1 text-emerald-600">{t('inventory.modal.deadline')}</label>
                                <input type="date" className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none text-emerald-600 shadow-inner border border-transparent focus:border-emerald-200" value={formData.procurementDeadline || ''} onChange={e => setFormData({ ...formData, procurementDeadline: e.target.value })} />
                            </div>
                        ) : (
                            <div className="hidden md:block"></div>
                        )}

                        <div className="md:col-span-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">{t('inventory.modal.location')}</label>
                            <input className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none shadow-inner border border-transparent focus:border-indigo-200" value={formData.location || ''} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder={t('inventory.modal.placeholderLoc')} />
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">
                            {isPurchasingMode ? t('inventory.modal.purchaseNote') : t('inventory.modal.note')}
                        </label>
                        <textarea className="w-full bg-slate-50 rounded-xl p-4 text-[12px] font-medium outline-none h-24 resize-none shadow-inner leading-relaxed" value={formData.note || ''} onChange={e => setFormData({ ...formData, note: e.target.value })} placeholder={isPurchasingMode ? t('inventory.modal.purchaseRequirement') : t('inventory.modal.placeholderNote')} />
                    </div>

                    {isPurchasingMode && (
                        <div className="p-4 bg-emerald-50 rounded-[1.8rem] border border-emerald-200 flex items-start gap-3 shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-lg">
                                <i className="fa-solid fa-shopping-basket"></i>
                            </div>
                            <div className="flex-1">
                                <p className="text-[11px] font-black text-emerald-800 uppercase tracking-widest leading-none mb-1.5">{t('inventory.modal.purchaseNoticeTitle')}</p>
                                <p className="text-[10px] font-bold text-emerald-700 leading-tight italic">
                                    {t('inventory.modal.purchaseNoticeDesc')}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-4 pt-6 shrink-0">
                    <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase hover:bg-slate-200 transition-all">{t('inventory.modal.cancel')}</button>
                    <button
                        onClick={() => onSave({ ...formData, status: formData.status })}
                        className={`flex-[2] py-4 ${isPurchasingMode ? 'bg-emerald-600 shadow-emerald-100' : 'bg-indigo-600 shadow-indigo-100'} text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-black transition-all active:scale-95`}
                    >
                        {isPurchasingMode ? t('inventory.modal.submitPurchase') : t('inventory.modal.saveChange')}
                    </button>
                </div>
            </div>

            {/* OCR Scanner Modal */}
            <OCRScanner show={showOCR} onClose={() => setShowOCR(false)} onApply={handleOCRApply} />
        </div>
    );
};