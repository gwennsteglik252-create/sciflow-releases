import React, { useMemo } from 'react';
import { InventoryItem, InventoryCategory, SafetyLevel, ResearchProject } from '../../../types';
import { useProjectContext } from '../../../context/ProjectContext';

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

const ALL_STATUS_OPTIONS = [
    { value: 'Ready', label: '就绪 (Ready)' },
    { value: 'In Use', label: '使用中 (In Use)' },
    { value: 'Maintenance', label: '维护中 (Maintenance)' },
    { value: 'Calibration Required', label: '待校准 (Calibration)' },
];

const CHEMICAL_SAFETY_OPTIONS = [
    { value: 'Safe', label: '安全 (Safe)' },
    { value: 'Toxic', label: '有毒 (Toxic)' },
    { value: 'Corrosive', label: '腐蚀性 (Corrosive)' },
    { value: 'Flammable', label: '易燃 (Flammable)' },
    { value: 'Explosive', label: '易爆 (Explosive)' },
];

const HARDWARE_SAFETY_OPTIONS = [
    { value: 'General', label: '通用 (General)' },
    { value: 'Precision', label: '精密 (Precision)' },
    { value: 'Hazardous', label: '高危 (Hazardous)' },
    { value: 'Restricted', label: '管制 (Restricted)' },
];

export const InventoryItemModal: React.FC<InventoryItemModalProps> = ({
    show, onClose, editingItem, formData, setFormData, onSave, returnPath, onBackToReport
}) => {
    const { projects } = useProjectContext();
    if (!show) return null;

    const isPurchasingMode = formData.status === 'Purchasing';

    const filteredStatusOptions = useMemo(() => {
        if (formData.category !== 'Hardware') {
            return ALL_STATUS_OPTIONS.filter(opt => ['Ready', 'In Use'].includes(opt.value));
        }
        return ALL_STATUS_OPTIONS;
    }, [formData.category]);

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[1300] flex items-center justify-center p-4">
            <div className={`bg-white w-full max-w-3xl rounded-[2.2rem] p-6 lg:p-10 animate-reveal shadow-2xl relative border-4 border-white flex flex-col max-h-[95vh]`}>
                <button onClick={onClose} className="absolute top-6 right-6 text-slate-300 hover:text-rose-500 transition-all"><i className="fa-solid fa-times text-xl"></i></button>

                <div className="flex justify-between items-center mb-6 shrink-0">
                    <h3 className={`text-xl font-black text-slate-800 uppercase italic border-l-8 ${isPurchasingMode ? 'border-emerald-500' : 'border-indigo-600'} pl-4 leading-none`}>
                        {isPurchasingMode ? '新建采购申请单' : (editingItem ? '编辑资产信息' : '录入新资产')}
                    </h3>
                    {returnPath && (
                        <button onClick={onBackToReport} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2">
                            <i className="fa-solid fa-arrow-left"></i> 返回工艺审计
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                        {/* Row 1: Context & Name */}
                        {isPurchasingMode && (
                            <div className="md:col-span-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">关联研究课题 (PROJECT CONTEXT)</label>
                                <div className="relative">
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-bold text-slate-800 outline-none appearance-none cursor-pointer hover:border-indigo-300 transition-colors shadow-inner"
                                        value={formData.linkedProjectId || ''}
                                        onChange={e => setFormData({ ...formData, linkedProjectId: e.target.value })}
                                    >
                                        <option value="">点击选择关联课题...</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                    </select>
                                    <i className="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-[11px] pointer-events-none"></i>
                                </div>
                            </div>
                        )}

                        <div className={isPurchasingMode ? "md:col-span-2" : "md:col-span-4"}>
                            <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">
                                {isPurchasingMode ? '申购项目名称' : '名称 (NAME)'}
                            </label>
                            <input
                                className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none border border-transparent focus:border-indigo-200 shadow-inner"
                                value={formData.name || ''}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder={isPurchasingMode ? "请输入项目名称..." : "输入资产名称"}
                            />
                        </div>

                        {/* Row 2: Main Stats */}
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">
                                    {isPurchasingMode ? '拟购单件含量' : '单件含量'}
                                </label>
                                <div className="flex bg-slate-50 rounded-xl shadow-inner border border-transparent focus-within:border-indigo-200 overflow-hidden">
                                    <input type="number" className="flex-1 bg-transparent p-3.5 text-sm font-black outline-none text-indigo-600" value={formData.quantity || 0} onChange={e => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })} />
                                    <span className="p-3.5 text-[10px] font-black text-slate-400 flex items-center bg-slate-100/50">{formData.unit || 'UNIT'}</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-[11px] font-black text-indigo-400 uppercase mb-1.5 block px-1">
                                    {isPurchasingMode ? '拟购件数' : '库存件数/瓶数'}
                                </label>
                                <div className="flex bg-slate-50 rounded-xl shadow-inner border border-transparent focus-within:border-indigo-200 overflow-hidden">
                                    <input type="number" className="flex-1 bg-transparent p-3.5 text-sm font-black outline-none text-indigo-600" value={formData.stockCount || 1} onChange={e => setFormData({ ...formData, stockCount: parseInt(e.target.value) || 0 })} />
                                    <span className="p-3.5 text-[10px] font-black text-indigo-400 flex items-center bg-indigo-50/50">ITEMS</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">单位 (UNIT)</label>
                            <input className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none border border-transparent focus:border-indigo-200 shadow-inner" value={formData.unit || ''} onChange={e => setFormData({ ...formData, unit: e.target.value })} placeholder="g / mL / 台" />
                        </div>
                        <div>
                            <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">资产分类</label>
                            <select
                                className="w-full bg-slate-50 rounded-xl p-3.5 text-[11px] font-bold outline-none cursor-pointer shadow-inner border border-transparent focus:border-indigo-200"
                                value={formData.category}
                                onChange={e => {
                                    const nextCategory = e.target.value as InventoryCategory;
                                    const nextSafety = nextCategory === 'Hardware' ? 'General' : 'Safe';
                                    setFormData({ ...formData, category: nextCategory, safetyLevel: nextSafety });
                                }}
                            >
                                <option value="Chemical">化学试剂</option>
                                <option value="Precursor">关键前驱体</option>
                                <option value="Hardware">仪器设备</option>
                                <option value="Consumable">通用耗材</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">品牌 (BRAND)</label>
                            <input className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none border border-transparent focus:border-indigo-200 shadow-inner" value={formData.brand || ''} onChange={e => setFormData({ ...formData, brand: e.target.value })} placeholder="生产商/品牌" />
                        </div>

                        {/* Row 3: Technical Specs */}
                        {formData.category === 'Hardware' ? (
                            <div className="md:col-span-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">型号 (MODEL)</label>
                                <input className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none border border-transparent focus:border-indigo-200 shadow-inner" value={formData.model || ''} onChange={e => setFormData({ ...formData, model: e.target.value })} placeholder="具体型号" />
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">CAS NO.</label>
                                    <input className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none border border-transparent focus:border-indigo-200 shadow-inner" value={formData.casNo || ''} onChange={e => setFormData({ ...formData, casNo: e.target.value })} placeholder="123-45-6" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">规格/纯度 (PURITY)</label>
                                    <input className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none border border-transparent focus:border-indigo-200 shadow-inner" value={formData.purity || ''} onChange={e => setFormData({ ...formData, purity: e.target.value })} placeholder="AR / 99% / HPLC" />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">分子式 (FORMULA)</label>
                                    <input className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none border border-transparent focus:border-indigo-200 shadow-inner" value={formData.formula || ''} onChange={e => setFormData({ ...formData, formula: e.target.value })} placeholder="H2O" />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">分子量 (MW)</label>
                                    <input type="number" className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none border border-transparent focus:border-indigo-200 shadow-inner" value={formData.molecularWeight || ''} onChange={e => setFormData({ ...formData, molecularWeight: parseFloat(e.target.value) || undefined })} placeholder="180.16" />
                                </div>
                            </>
                        )}

                        <div>
                            <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">预设安全等级</label>
                            <select className="w-full bg-slate-50 rounded-xl p-3.5 text-[11px] font-bold outline-none cursor-pointer shadow-inner border border-transparent focus:border-indigo-200" value={formData.safetyLevel} onChange={e => setFormData({ ...formData, safetyLevel: e.target.value as SafetyLevel })}>
                                {(formData.category === 'Hardware' ? HARDWARE_SAFETY_OPTIONS : CHEMICAL_SAFETY_OPTIONS).map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>

                        {isPurchasingMode ? (
                            <div>
                                <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">采购紧急度</label>
                                <select className="w-full bg-slate-50 rounded-xl p-3.5 text-[11px] font-bold outline-none cursor-pointer shadow-inner border border-emerald-200 text-emerald-700" value={formData.urgency || 'Normal'} onChange={e => setFormData({ ...formData, urgency: e.target.value as any })}>
                                    <option value="Normal">普通 (Normal)</option>
                                    <option value="Urgent">紧急 (Urgent)</option>
                                    <option value="Critical">特急 (Critical)</option>
                                </select>
                            </div>
                        ) : (
                            <div>
                                <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">使用状态</label>
                                <select className="w-full bg-slate-50 rounded-xl p-3.5 text-[11px] font-bold outline-none cursor-pointer shadow-inner border border-transparent focus:border-indigo-200" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
                                    {filteredStatusOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Row 4: Constraints & Location */}
                        <div>
                            <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">预警阈值</label>
                            <input type="number" className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none text-rose-500 shadow-inner border border-transparent focus:border-indigo-200" value={formData.threshold || 0} onChange={e => setFormData({ ...formData, threshold: parseFloat(e.target.value) || 0 })} />
                        </div>

                        {isPurchasingMode ? (
                            <div>
                                <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1 text-emerald-600">采购期限</label>
                                <input type="date" className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none text-emerald-600 shadow-inner border border-transparent focus:border-emerald-200" value={formData.procurementDeadline || ''} onChange={e => setFormData({ ...formData, procurementDeadline: e.target.value })} />
                            </div>
                        ) : (
                            <div className="hidden md:block"></div>
                        )}

                        <div className="md:col-span-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">存储位置 (LOC)</label>
                            <input className="w-full bg-slate-50 rounded-xl p-3.5 text-sm font-bold outline-none shadow-inner border border-transparent focus:border-indigo-200" value={formData.location || ''} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="实验室-房间, 柜号/货架" />
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] font-black text-slate-400 uppercase mb-1.5 block px-1">
                            {isPurchasingMode ? '备注 / 采购需求说明 (NOTE)' : '备注说明 (NOTE)'}
                        </label>
                        <textarea className="w-full bg-slate-50 rounded-xl p-4 text-[12px] font-medium outline-none h-24 resize-none shadow-inner leading-relaxed" value={formData.note || ''} onChange={e => setFormData({ ...formData, note: e.target.value })} placeholder={isPurchasingMode ? "说明采购用途或期望货期..." : "有效期、存储要求等..."} />
                    </div>

                    {isPurchasingMode && (
                        <div className="p-4 bg-emerald-50 rounded-[1.8rem] border border-emerald-200 flex items-start gap-3 shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-lg">
                                <i className="fa-solid fa-shopping-basket"></i>
                            </div>
                            <div className="flex-1">
                                <p className="text-[11px] font-black text-emerald-800 uppercase tracking-widest leading-none mb-1.5">采购申请须知</p>
                                <p className="text-[10px] font-bold text-emerald-700 leading-tight italic">
                                    提交后条目将进入“采购清单”。系统将基于所选课题的工艺需求进行资源缺口对标。到货入库后，请在卡片上点击“完成到货”正式登记。
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-4 pt-6 shrink-0">
                    <button onClick={onClose} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase hover:bg-slate-200 transition-all">取消</button>
                    <button
                        onClick={() => onSave({ ...formData, status: formData.status })}
                        className={`flex-[2] py-4 ${isPurchasingMode ? 'bg-emerald-600 shadow-emerald-100' : 'bg-indigo-600 shadow-indigo-100'} text-white rounded-2xl text-[11px] font-black uppercase shadow-xl hover:bg-black transition-all active:scale-95`}
                    >
                        {isPurchasingMode ? '提交采购申请' : '保存资产变更'}
                    </button>
                </div>
            </div>
        </div>
    );
};