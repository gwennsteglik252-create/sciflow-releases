import React, { useState, useCallback, useRef } from 'react';
import { InventoryItem, SafetyLevel } from '../../../types';
import { useTranslation } from '../../../locales/useTranslation';
import { smartInventoryAutofill, checkChemicalCompatibility, ocrLabelRecognize } from '../../../services/gemini/resource';

// ═══════════════════════════════════════════════════════════════
// 1. AI 智能入库补全按钮 — 嵌入 Modal 名称字段右侧
// ═══════════════════════════════════════════════════════════════
interface AutofillButtonProps {
    name: string;
    onAutofill: (data: any) => void;
    disabled?: boolean;
}

export const AutofillButton: React.FC<AutofillButtonProps> = React.memo(({ name, onAutofill, disabled }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleAutofill = useCallback(async () => {
        if (!name.trim() || loading) return;
        setLoading(true);
        setResult(null);
        try {
            const data = await smartInventoryAutofill(name.trim());
            setResult(data);
            onAutofill(data);
        } catch (err) {
            console.error('Autofill failed:', err);
        } finally {
            setLoading(false);
        }
    }, [name, loading, onAutofill]);

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={handleAutofill}
                disabled={!name.trim() || loading || disabled}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-1.5 shadow-sm active:scale-95 
                    ${loading 
                        ? 'bg-indigo-100 text-indigo-400 cursor-wait'
                        : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-black hover:to-black disabled:opacity-30 disabled:cursor-not-allowed'
                    }`}
            >
                {loading ? (
                    <>
                        <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        {t('inventory.ai.autofilling')}
                    </>
                ) : (
                    <>
                        <i className="fa-solid fa-wand-magic-sparkles text-[8px]" />
                        {t('inventory.ai.autofill')}
                    </>
                )}
            </button>

            {/* 补全结果预览（存储条件 + 不兼容物质） */}
            {result && (
                <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl p-3 border border-indigo-100 animate-reveal space-y-2">
                    <div className="flex items-center gap-1.5 mb-1">
                        <i className="fa-solid fa-sparkles text-indigo-500 text-[9px]" />
                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider">
                            {t('inventory.ai.autofillResult')}
                        </span>
                        <span className={`ml-auto text-[8px] font-bold px-1.5 py-0.5 rounded ${result.source === 'local+ai' ? 'bg-emerald-100 text-emerald-600' : 'bg-violet-100 text-violet-600'}`}>
                            {result.source === 'local+ai' ? t('inventory.ai.localPlusAI') : t('inventory.ai.aiOnly')}
                        </span>
                    </div>

                    {result.description && (
                        <p className="text-[10px] font-bold text-slate-600 italic">{result.description}</p>
                    )}

                    {result.storageConditions && (
                        <div className="flex items-start gap-1.5">
                            <i className="fa-solid fa-warehouse text-[8px] text-amber-500 mt-0.5" />
                            <p className="text-[9px] font-bold text-slate-500">{result.storageConditions}</p>
                        </div>
                    )}

                    {result.incompatibleWith?.length > 0 && (
                        <div className="flex items-start gap-1.5">
                            <i className="fa-solid fa-triangle-exclamation text-[8px] text-rose-500 mt-0.5" />
                            <p className="text-[9px] font-bold text-rose-500">
                                {t('inventory.ai.incompatible')}: {result.incompatibleWith.join('、')}
                            </p>
                        </div>
                    )}

                    {result.ghsCodes?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {result.ghsCodes.map((code: string) => (
                                <span key={code} className="text-[8px] font-black text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                                    {code}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});
AutofillButton.displayName = 'AutofillButton';


// ═══════════════════════════════════════════════════════════════
// 2. 兼容性检查面板
// ═══════════════════════════════════════════════════════════════
interface CompatibilityCheckerProps {
    items: InventoryItem[];
    location: string;
}

export const CompatibilityChecker: React.FC<CompatibilityCheckerProps> = React.memo(({ items, location }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleCheck = useCallback(async () => {
        if (items.length < 2 || loading) return;
        setLoading(true);
        try {
            const data = await checkChemicalCompatibility(items);
            setResult(data);
        } catch (err) {
            console.error('Compatibility check failed:', err);
        } finally {
            setLoading(false);
        }
    }, [items, loading]);

    const riskColors: Record<string, string> = {
        critical: 'bg-rose-500 text-white ring-rose-200',
        warning: 'bg-amber-500 text-white ring-amber-200',
        safe: 'bg-emerald-500 text-white ring-emerald-200'
    };

    const severityColors: Record<string, string> = {
        critical: 'border-rose-300 bg-rose-50',
        warning: 'border-amber-200 bg-amber-50',
        caution: 'border-slate-200 bg-slate-50'
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="p-4 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center shadow-lg">
                        <i className="fa-solid fa-flask-vial text-white text-sm" />
                    </div>
                    <div>
                        <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">{t('inventory.ai.compatTitle')}</h4>
                        <p className="text-[9px] font-bold text-slate-400">
                            {t('inventory.ai.compatLocation')}: <span className="text-indigo-600">{location}</span> · {items.length} {t('inventory.ai.compatItems')}
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleCheck}
                    disabled={items.length < 2 || loading}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[9px] font-black uppercase shadow-md hover:from-black hover:to-black transition-all active:scale-95 disabled:opacity-30 flex items-center gap-1.5"
                >
                    {loading ? (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <i className="fa-solid fa-shield-halved text-[8px]" />
                    )}
                    {loading ? t('inventory.ai.compatChecking') : t('inventory.ai.compatRun')}
                </button>
            </div>

            {/* Result */}
            {result && (
                <div className="p-4 space-y-4 animate-reveal">
                    {/* Risk Level Badge */}
                    <div className="flex items-center gap-3">
                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase ring-2 ${riskColors[result.riskLevel] || riskColors.safe}`}>
                            <i className={`fa-solid ${result.riskLevel === 'critical' ? 'fa-radiation' : result.riskLevel === 'warning' ? 'fa-triangle-exclamation' : 'fa-shield-check'} mr-1.5`} />
                            {t(`inventory.ai.risk_${result.riskLevel}` as any)}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400">
                            {result.conflicts?.length || 0} {t('inventory.ai.conflictsFound')}
                        </span>
                    </div>

                    {/* Conflicts */}
                    {result.conflicts?.length > 0 && (
                        <div className="space-y-2">
                            {result.conflicts.map((c: any, i: number) => (
                                <div key={i} className={`p-3 rounded-xl border ${severityColors[c.severity] || severityColors.caution}`}>
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-[10px] font-black text-slate-700">{c.itemAName}</span>
                                        <i className="fa-solid fa-bolt text-[8px] text-rose-400" />
                                        <span className="text-[10px] font-black text-slate-700">{c.itemBName}</span>
                                        <span className={`ml-auto text-[8px] font-black uppercase px-2 py-0.5 rounded ${c.severity === 'critical' ? 'bg-rose-500 text-white' : c.severity === 'warning' ? 'bg-amber-500 text-white' : 'bg-slate-300 text-white'}`}>
                                            {c.severity}
                                        </span>
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-500 leading-relaxed">{c.reason}</p>
                                    {c.consequence && <p className="text-[9px] font-bold text-rose-500 mt-1">{c.consequence}</p>}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Suggestions */}
                    {result.suggestions?.length > 0 && (
                        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                            <h5 className="text-[9px] font-black text-blue-600 uppercase mb-2">
                                <i className="fa-solid fa-lightbulb mr-1" />{t('inventory.ai.suggestions')}
                            </h5>
                            {result.suggestions.map((s: any, i: number) => (
                                <div key={i} className="flex items-start gap-2 mb-1.5 last:mb-0">
                                    <i className="fa-solid fa-arrow-right text-[7px] text-blue-400 mt-1" />
                                    <p className="text-[9px] font-bold text-blue-700">
                                        <span className="text-blue-500">{s.itemName}</span>: {s.action}
                                        {s.recommendedLocation && <span className="text-indigo-600"> → {s.recommendedLocation}</span>}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});
CompatibilityChecker.displayName = 'CompatibilityChecker';


// ═══════════════════════════════════════════════════════════════
// 3. 拍照 OCR 识别面板 — 独立弹窗
// ═══════════════════════════════════════════════════════════════
interface OCRScannerProps {
    show: boolean;
    onClose: () => void;
    onApply: (data: Partial<InventoryItem>) => void;
}

export const OCRScanner: React.FC<OCRScannerProps> = React.memo(({ show, onClose, onApply }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 创建预览
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const dataUrl = ev.target?.result as string;
            setPreview(dataUrl);

            // 提取 base64 和 mimeType
            const [header, base64] = dataUrl.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';

            setLoading(true);
            setResult(null);
            try {
                const data = await ocrLabelRecognize(base64, mimeType);
                setResult(data);
            } catch (err) {
                console.error('OCR failed:', err);
            } finally {
                setLoading(false);
            }
        };
        reader.readAsDataURL(file);
    }, []);

    const handleApply = useCallback(() => {
        if (!result) return;
        onApply({
            name: result.name || '',
            formula: result.formula || '',
            casNo: result.casNo || '',
            purity: result.purity || '',
            brand: result.brand || '',
            quantity: result.quantity || 0,
            unit: result.unit || '',
            batchNo: result.batchNo || '',
            expiryDate: result.expiryDate || '',
            category: (['Chemical', 'Precursor', 'Consumable', 'Hardware'].includes(result.category) ? result.category : 'Chemical') as any,
            safetyLevel: (['Safe', 'Toxic', 'Corrosive', 'Flammable', 'Explosive', 'Oxidizer'].includes(result.safetyLevel) ? result.safetyLevel : 'Safe') as SafetyLevel,
            molecularWeight: result.mw || undefined,
        });
        onClose();
    }, [result, onApply, onClose]);

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[2100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-xl rounded-[2rem] p-6 animate-reveal shadow-2xl relative flex flex-col max-h-[85vh]">
                <button onClick={onClose} className="absolute top-5 right-5 text-slate-300 hover:text-rose-500 transition-all">
                    <i className="fa-solid fa-times text-lg" />
                </button>

                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg">
                        <i className="fa-solid fa-camera text-xl" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 uppercase italic leading-none mb-1">{t('inventory.ai.ocrTitle')}</h3>
                        <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase italic">{t('inventory.ai.ocrSubtitle')}</p>
                    </div>
                </div>

                {/* Upload Zone */}
                {!preview && (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-all">
                            <i className="fa-solid fa-camera-retro text-2xl text-slate-300 group-hover:text-indigo-500 transition-all" />
                        </div>
                        <p className="text-xs font-black text-slate-400 group-hover:text-indigo-600 uppercase tracking-wider transition-all">
                            {t('inventory.ai.ocrUpload')}
                        </p>
                        <p className="text-[9px] font-bold text-slate-300">{t('inventory.ai.ocrFormats')}</p>
                    </div>
                )}

                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

                {/* Preview + Result */}
                {preview && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
                        <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
                            <img src={preview} alt="Label" className="w-full max-h-48 object-contain bg-slate-50" />
                            {loading && (
                                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                                    <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                                    <p className="text-[10px] font-black text-indigo-600 uppercase italic animate-pulse">{t('inventory.ai.ocrProcessing')}</p>
                                </div>
                            )}
                        </div>

                        {result && (
                            <div className="space-y-3 animate-reveal">
                                {/* Confidence */}
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all ${(result.confidence || 0) > 0.8 ? 'bg-emerald-500' : (result.confidence || 0) > 0.5 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                            style={{ width: `${Math.round((result.confidence || 0) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-[9px] font-black text-slate-500">
                                        {t('inventory.ai.ocrConfidence')}: {Math.round((result.confidence || 0) * 100)}%
                                    </span>
                                </div>

                                {/* Recognized Fields */}
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { key: 'name', label: t('inventory.ai.ocrName'), icon: 'fa-tag', value: result.name },
                                        { key: 'casNo', label: 'CAS', icon: 'fa-barcode', value: result.casNo },
                                        { key: 'formula', label: t('inventory.ai.ocrFormula'), icon: 'fa-flask', value: result.formula },
                                        { key: 'brand', label: t('inventory.ai.ocrBrand'), icon: 'fa-industry', value: result.brand },
                                        { key: 'purity', label: t('inventory.ai.ocrPurity'), icon: 'fa-gem', value: result.purity },
                                        { key: 'quantity', label: t('inventory.ai.ocrQuantity'), icon: 'fa-weight-scale', value: result.quantity ? `${result.quantity} ${result.unit || ''}` : '' },
                                        { key: 'safetyLevel', label: t('inventory.ai.ocrSafety'), icon: 'fa-shield', value: result.safetyLevel },
                                        { key: 'expiryDate', label: t('inventory.ai.ocrExpiry'), icon: 'fa-calendar', value: result.expiryDate },
                                    ].filter(f => f.value).map(field => (
                                        <div key={field.key} className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                <i className={`fa-solid ${field.icon} text-[7px]`} />
                                                {field.label}
                                            </span>
                                            <p className="text-[11px] font-black text-slate-700 mt-0.5 truncate">{field.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* GHS Symbols */}
                                {result.ghsSymbols?.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {result.ghsSymbols.map((sym: string) => (
                                            <span key={sym} className="text-[8px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">⚠ {sym}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-5 mt-auto shrink-0">
                    {preview && (
                        <button
                            onClick={() => { setPreview(null); setResult(null); }}
                            className="px-4 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all"
                        >
                            <i className="fa-solid fa-camera-rotate mr-1.5" />{t('inventory.ai.ocrRetake')}
                        </button>
                    )}
                    <button onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">
                        {t('inventory.ai.ocrCancel')}
                    </button>
                    {result && (
                        <button
                            onClick={handleApply}
                            className="flex-[2] py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl hover:from-black hover:to-black transition-all active:scale-95"
                        >
                            <i className="fa-solid fa-file-import mr-1.5" />{t('inventory.ai.ocrApply')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});
OCRScanner.displayName = 'OCRScanner';
