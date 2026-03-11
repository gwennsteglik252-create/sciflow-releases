import React, { useRef, useState } from 'react';
// import * as XLSX from 'xlsx'; // 已改为动态导入
import { useProjectContext } from '../../../context/ProjectContextCore';
import { callGeminiWithRetry, FAST_MODEL, SPEED_CONFIG, safeJsonParse } from '../../../services/gemini/core';
import { Type } from "@google/genai";
import { InventoryItem } from '../../../types';
import { lookupChemical, batchLookupChemicals } from '../../../utils/chemicalDictionary';

interface InventoryHeaderProps {
  stats: { total: number, reagents: number, hardware: number, lowStock: number, purchasing: number };
  onAdd: () => void;
  onAddPurchase: () => void;
  onShowLowStock: () => void;
  onShowPurchaseList: () => void;
}

export const InventoryHeader: React.FC<InventoryHeaderProps> = React.memo(({ stats, onAdd, onAddPurchase, onShowLowStock, onShowPurchaseList }) => {
  const { startGlobalTask, cancelTask, setInventory, inventory, showToast, activeTasks, setModalOpen } = useProjectContext();
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [lastImportIds, setLastImportIds] = useState<string[]>([]);
  const isImporting = activeTasks.some(t => t.id === 'excel_import');
  const isEnriching = activeTasks.some(t => t.id === 'formula_enrich');
  // 缺少 formula、molecularWeight 或 safetyLevel 仍为 Safe 的条目（可能需要字典补全）
  const needsEnrichCount = inventory.filter(it => {
    const item = it as any;
    return !item.formula || !item.molecularWeight || (item.safetyLevel === 'Safe' && item.name);
  }).length;

  const handleClearAll = () => {
    setModalOpen('confirm', {
      show: true,
      title: '确认清空所有资产？',
      desc: '确定要一键清空资产中心的所有数据吗？此操作不可撤销，关联的审计历史将变为引用失效。',
      onConfirm: () => {
        setInventory([]);
        showToast({ message: "资产中心已全部清空", type: 'success' });
        setModalOpen('confirm', null);
      }
    });
  };

  // ===== 本地规格解析：从 "AR 500g", "99%, 500g", "AR, ≥99.5%, 500g" 等提取 purity / quantity / unit =====
  const parseSpec = (spec: string): { purity: string; quantity: number; unit: string } => {
    const s = String(spec || '').trim();
    if (!s) return { purity: '', quantity: 0, unit: '' };

    // 提取含量数值 + 单位（如 500g, 100ml, 2.5L, 25kg）
    const qtyMatch = s.match(/([\d.]+)\s*(g|mg|kg|ml|mL|L|μL|ul)\b/i);
    const quantity = qtyMatch ? parseFloat(qtyMatch[1]) : 0;
    const unit = qtyMatch ? qtyMatch[2] : '';

    // 提取纯度等级：AR/CP/GR/EP/ACS 或百分比如 ≥99.5%, 98%
    const purityParts: string[] = [];
    const gradeMatch = s.match(/\b(AR|CP|GR|EP|ACS|SP|PT|MOS|HPLC|GCS|优级纯|分析纯|化学纯)\b/i);
    if (gradeMatch) purityParts.push(gradeMatch[1]);
    const pctMatch = s.match(/[≥>]?\s*[\d.]+\s*%/);
    if (pctMatch) purityParts.push(pctMatch[0].replace(/\s/g, ''));
    const purity = purityParts.join(' ');

    return { purity, quantity, unit };
  };

  // ===== 本地列映射：通过表头关键词自动检测各字段对应的列索引 =====
  const buildColumnMap = (headers: string[]) => {
    const map: Record<string, number> = {};
    const find = (keywords: string[]) => headers.findIndex(h => {
      const hl = h.toLowerCase();
      return keywords.some(k => hl.includes(k));
    });
    map.name = find(['名称', '品名', '产品', '试剂', '药品', '物资', 'name', 'item', 'material']);
    map.spec = find(['规格', 'spec', 'grade']);
    map.cas = find(['cas']);
    map.brand = find(['厂家', '品牌', '供应商', '生产商', 'brand', 'manufacturer', 'vendor']);
    map.stock = find(['库存', '数量', '瓶数', '总数', 'stock', 'qty']);
    map.hazard = find(['危化', '危险', 'hazard', 'safety']);
    map.note = find(['备注', 'note', 'remark']);
    map.mw = find(['分子量', 'molecular', 'mw']);
    map.formula = find(['分子式', 'formula']);
    return map;
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await startGlobalTask(
      { id: 'excel_import', type: 'transformation', status: 'running', title: '正在解析 Excel ...' },
      async () => {
        try {
          // 动态导入 XLSX 以避免 importmap 冲突
          const XLSX = await import('xlsx');
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data);
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];

          // ===== 第一步：读取原始二维数组 =====
          const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          console.log('[Import] 原始行数:', rawRows.length);

          // ===== 第二步：智能检测表头行 =====
          const headerKeywords = ['名称', '品名', '产品', '试剂', '药品', '物资', 'name', 'item', 'material', 'CAS', '规格', '厂家', '品牌', '数量', '库存', 'stock'];
          let headerRowIdx = -1;
          let maxMatches = 0;
          let titleText = '';

          for (let r = 0; r < Math.min(rawRows.length, 20); r++) {
            const row = rawRows[r];
            if (!row || row.length === 0) continue;
            const rowStr = row.map((c: any) => String(c || '')).join(' ').toLowerCase();
            const matchCount = headerKeywords.filter(kw => rowStr.includes(kw.toLowerCase())).length;
            if (matchCount > maxMatches) { maxMatches = matchCount; headerRowIdx = r; }
            if (headerRowIdx === -1 || r < headerRowIdx) {
              const nonEmpty = row.filter((c: any) => c != null && String(c).trim() !== '');
              if (nonEmpty.length <= 2 && nonEmpty.length > 0 && !titleText) {
                titleText = nonEmpty.map((c: any) => String(c).trim()).join(' ');
              }
            }
          }

          if (headerRowIdx === -1 || maxMatches < 1) {
            headerRowIdx = rawRows.findIndex(row => row && row.length > 0 && row.some(c => c != null));
            if (headerRowIdx === -1) headerRowIdx = 0;
          }

          const headers = (rawRows[headerRowIdx] || []).map((h: any, idx: number) => {
            const val = String(h || '').trim();
            return val || `Column_${idx + 1}`;
          });

          console.log('[Import] 表头:', headers, '(第', headerRowIdx + 1, '行)');

          const labNameMatch = titleText.match(/([\u4e00-\u9fa5]*(实验室|仓库|储藏室|药房|库房|药品室|试剂室|材料室)[\u4e00-\u9fa5]*)/);
          const labName = labNameMatch ? labNameMatch[1] : '';

          // ===== 第三步：构建列映射 =====
          const colMap = buildColumnMap(headers);
          console.log('[Import] 列映射:', colMap);

          // ===== 第四步：本地解析数据行 =====
          const sectionKeywords = ['柜', '栏', '层', '架', '排', '号柜', '号架', '抽屉', '箱'];
          const isSectionRow = (row: any[]): boolean => {
            const nonEmptyCols = row.filter((c: any) => c != null && String(c).trim() !== '');
            if (nonEmptyCols.length === 0 || nonEmptyCols.length > 2) return false;
            const text = nonEmptyCols.map((c: any) => String(c).trim()).join(' ');
            return sectionKeywords.some(kw => text.includes(kw));
          };

          let currentSectionLocation = '';
          let lastValidName = '';
          let lastValidCas = '';

          const allItems: InventoryItem[] = [];

          for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
            const row = rawRows[r];
            if (!row || row.length === 0) continue;

            // 分组行
            if (isSectionRow(row)) {
              const nonEmpty = row.filter((c: any) => c != null && String(c).trim() !== '');
              currentSectionLocation = nonEmpty.map((c: any) => String(c).trim()).join(' ');
              continue;
            }

            // 提取各列值
            const cellStr = (idx: number) => (idx >= 0 && row[idx] != null) ? String(row[idx]).trim() : '';
            let name = cellStr(colMap.name);
            let cas = cellStr(colMap.cas);
            const specRaw = cellStr(colMap.spec);
            const brandRaw = cellStr(colMap.brand);
            const stockRaw = cellStr(colMap.stock);
            const hazardRaw = cellStr(colMap.hazard);
            const noteRaw = cellStr(colMap.note);
            const mwRaw = cellStr(colMap.mw);
            const formulaRaw = cellStr(colMap.formula);

            // 跳过完全空的行
            const hasAnyContent = [name, specRaw, cas, brandRaw, stockRaw].some(v => v !== '');
            if (!hasAnyContent) continue;

            // 合并单元格承接：如果本行没名称但有其他数据，承接上行的名称和 CAS
            if (!name && lastValidName && hasAnyContent) {
              name = lastValidName;
              if (!cas && lastValidCas) cas = lastValidCas;
              console.log(`[Import] 行 ${r + 1} 承接上行名称: ${name}`);
            }

            if (!name) continue; // 仍无名称则跳过

            // 更新承接缓存
            if (name) lastValidName = name;
            if (cas) lastValidCas = cas;

            // 解析规格
            const { purity, quantity, unit } = parseSpec(specRaw);

            // 解析库存数量
            const stockCount = parseInt(stockRaw) || 0;

            // 解析危化品标记
            const hazardText = hazardRaw.toLowerCase();
            let safetyLevel: string = 'Safe';
            if (hazardText.includes('危化') || hazardText.includes('危险') || hazardText.includes('hazard') || hazardText.includes('toxic')) {
              safetyLevel = 'Toxic';
            } else if (hazardText.includes('腐蚀') || hazardText.includes('corrosive')) {
              safetyLevel = 'Corrosive';
            } else if (hazardText.includes('易燃') || hazardText.includes('flammable')) {
              safetyLevel = 'Flammable';
            } else if (hazardText.includes('爆') || hazardText.includes('explosive')) {
              safetyLevel = 'Explosive';
            }

            // 分子量
            let molecularWeight: number | undefined;
            if (mwRaw) { const v = parseFloat(mwRaw); if (!isNaN(v)) molecularWeight = v; }

            // 本地字典查找分子式 + 危化品分类
            let formulaVal = formulaRaw || '';
            if (name) {
              const dictInfo = lookupChemical(name);
              if (dictInfo) {
                if (!formulaVal) formulaVal = dictInfo.formula;
                if (!molecularWeight && dictInfo.mw) molecularWeight = dictInfo.mw;
                // Excel 没标注时，用字典的危险分类覆盖
                if (safetyLevel === 'Safe' && dictInfo.hazard !== 'Safe') {
                  safetyLevel = dictInfo.hazard;
                  console.log(`[Import] 字典识别危化品: ${name} → ${dictInfo.hazard}`);
                }
                console.log(`[Import] 字典命中: ${name} → ${dictInfo.formula} (${dictInfo.hazard})`);
              }
            }

            const location = [labName, currentSectionLocation].filter(Boolean).join(' ');

            allItems.push({
              id: `import_${Date.now()}_${allItems.length}`,
              name,
              casNo: cas,
              formula: formulaVal,
              purity,
              quantity,
              unit: unit || '瓶',
              stockCount,
              brand: brandRaw,
              safetyLevel,
              category: 'Chemical' as const,
              location,
              note: noteRaw,
              molecularWeight,
              lastUpdated: new Date().toLocaleDateString(),
            } as InventoryItem);
          }

          console.log('[Import] 本地解析完成，共', allItems.length, '条');

          if (allItems.length === 0) {
            showToast({ message: '未在Excel中检测到有效数据行', type: 'error' });
            return;
          }

          // ===== 一次性更新 State（瞬时完成） =====
          const importedIds = allItems.map(it => it.id);
          setLastImportIds(importedIds);

          setInventory(prev => {
            const updated = [...allItems, ...prev];
            console.log(`[Import] State 更新完毕，当前库内总数: ${updated.length}`);
            return updated;
          });

          showToast({ message: `导入完成！共 ${allItems.length} 条（${labName || 'Excel'}）`, type: 'success' });

        } catch (error) {
          showToast({ message: "解析过程中出现错误", type: 'error' });
          console.error("Import Error:", error);
        }
      }
    );
    if (excelInputRef.current) excelInputRef.current.value = '';
  };

  // ===== 手动触发：综合补全（分子式 + 分子量 + 危化品分类） =====
  const handleEnrichFormula = async () => {
    // 本地字典一键补全 — 字典数据始终覆盖（修正之前的错误匹配）
    // 当字典无匹配时，清除疑似旧错误数据（匹配到基础酸的残留）
    const BASE_ACID_FORMULAS = new Set([
      'H₂SO₄', 'CH₃COOH', 'HCl', 'HNO₃', 'H₃PO₄', 'H₂C₂O₄',
      'NaOH', 'KOH', 'NH₃·H₂O', 'H₂CO₃', 'HF', 'HBr', 'HI',
      'HCOOH', 'C₆H₈O₇', 'C₄H₆O₆', 'NaCN', 'Na₂SO₄', 'Na₃PO₄', 'C₆H₆',
    ]);
    let enrichedCount = 0;
    let clearedCount = 0;
    setInventory(prev => prev.map(item => {
      const info = lookupChemical((item as any).name);
      if (info) {
        // 有字典匹配 → 始终覆盖
        const updates: any = {};
        let changed = false;
        if (info.formula && info.formula !== item.formula) {
          updates.formula = info.formula; changed = true;
        }
        if (info.mw && info.mw !== (item as any).molecularWeight) {
          updates.molecularWeight = info.mw; changed = true;
        }
        if (info.hazard && info.hazard !== item.safetyLevel) {
          updates.safetyLevel = info.hazard; changed = true;
        }
        if (changed) { enrichedCount++; return { ...item, ...updates }; }
        return item;
      }
      // 无字典匹配 → 检查是否有旧的错误残留（分子式匹配到基础酸）
      if (item.formula && BASE_ACID_FORMULAS.has(item.formula)) {
        clearedCount++;
        return { ...item, formula: '', molecularWeight: undefined, safetyLevel: 'Safe' };
      }
      return item;
    }));

    const msgs: string[] = [];
    if (enrichedCount > 0) msgs.push(`补全/修正 ${enrichedCount} 条`);
    if (clearedCount > 0) msgs.push(`清除 ${clearedCount} 条旧错误数据`);
    if (msgs.length > 0) {
      showToast({ message: `已完成：${msgs.join('，')}`, type: 'success' });
    } else {
      showToast({ message: '所有条目已完整，或字典中未找到匹配项', type: 'info' });
    }
  };

  return (
    <header className="flex flex-col xl:flex-row justify-between items-end gap-4 shrink-0">
      <div className="flex items-center gap-5">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter italic flex items-center gap-4">
            <i className="fa-solid fa-box-archive text-indigo-600"></i> 实验室资产中心
          </h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2rem] mt-1 pl-10">Total Research Assets Management</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center bg-white/90 p-2 rounded-[2rem] border border-slate-200 shadow-sm gap-4 w-full xl:w-auto">
        {/* Stats */}
        <div className="flex gap-4 px-4 text-center shrink-0">
          <div className="flex flex-col items-center">
            <span className="text-lg font-black text-slate-800 leading-none">{stats.hardware}</span>
            <span className="text-[7px] font-black text-slate-400 uppercase">仪器</span>
          </div>
          <div className="w-px h-6 bg-slate-100"></div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-black text-slate-800 leading-none">{stats.reagents}</span>
            <span className="text-[7px] font-black text-slate-400 uppercase">试剂</span>
          </div>
          <div className="w-px h-6 bg-slate-100"></div>
          <div onClick={onShowLowStock} className="flex flex-col items-center cursor-pointer group">
            <span className={`text-lg font-black leading-none ${stats.lowStock > 0 ? 'text-rose-500' : 'text-slate-800'}`}>{stats.lowStock}</span>
            <span className={`text-[7px] font-black uppercase ${stats.lowStock > 0 ? 'text-rose-400' : 'text-slate-400'}`}>低库存</span>
          </div>
          <div className="w-px h-6 bg-slate-100"></div>
          <div onClick={onShowPurchaseList} className="flex flex-col items-center cursor-pointer group">
            <span className={`text-lg font-black leading-none ${stats.purchasing > 0 ? 'text-indigo-600' : 'text-slate-800'}`}>{stats.purchasing}</span>
            <span className="text-[7px] font-black text-indigo-400 uppercase group-hover:text-indigo-600">采购单</span>
          </div>
        </div>

        <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>

        <input type="file" ref={excelInputRef} className="hidden" accept=".xlsx,.csv" onChange={handleExcelUpload} />

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleClearAll}
            className="px-4 py-2.5 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-600 transition-all flex items-center justify-center border border-transparent hover:border-rose-100 text-[10px] font-black uppercase"
            title="一键清空"
          >
            <i className="fa-solid fa-trash-can mr-2"></i> 一键清空
          </button>
          <button
            onClick={() => excelInputRef.current?.click()}
            disabled={isImporting}
            className="px-4 py-2.5 rounded-xl bg-slate-50 text-indigo-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center border border-transparent hover:border-indigo-100 text-[10px] font-black uppercase"
            title="智能导入"
          >
            {isImporting ? <i className="fa-solid fa-spinner animate-spin"></i> : <><i className="fa-solid fa-file-excel mr-2"></i> 导入</>}
          </button>
          {lastImportIds.length > 0 && (
            <button
              onClick={() => {
                const ids = new Set(lastImportIds);
                setInventory(prev => prev.filter(it => !ids.has(it.id)));
                showToast({ message: `已撤回上次导入的 ${ids.size} 条数据`, type: 'success' });
                setLastImportIds([]);
              }}
              className="px-4 py-2.5 rounded-xl bg-orange-50 text-orange-500 hover:bg-orange-100 hover:text-orange-600 transition-all flex items-center justify-center border border-transparent hover:border-orange-200 text-[10px] font-black uppercase"
              title="撤回上次导入"
            >
              <i className="fa-solid fa-rotate-left mr-2"></i> 撤回导入
            </button>
          )}
          {needsEnrichCount > 0 && (
            <button
              onClick={isEnriching ? () => cancelTask('formula_enrich') : handleEnrichFormula}
              className={`px-4 py-2.5 rounded-xl transition-all flex items-center justify-center border border-transparent text-[10px] font-black uppercase ${isEnriching
                ? 'bg-rose-50 text-rose-500 hover:bg-rose-100 hover:border-rose-200'
                : 'bg-amber-50 text-amber-600 hover:bg-amber-100 hover:border-amber-200'
                }`}
              title={isEnriching ? '点击取消' : '本地字典一键补全分子式+分子量+危化品分类'}
            >
              {isEnriching ? <><i className="fa-solid fa-stop mr-2"></i> 取消补全</> : <><i className="fa-solid fa-flask mr-2"></i> 一键补全</>}
            </button>
          )}
          <button
            onClick={onAddPurchase}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-xl text-[10px] font-black uppercase transition-all"
          >
            <i className="fa-solid fa-cart-plus"></i> 新增采购申请
          </button>
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 transition-all shadow-md active:scale-95"
          >
            <i className="fa-solid fa-plus"></i> 新增资产
          </button>
        </div>

      </div>
    </header >
  );
});

InventoryHeader.displayName = 'InventoryHeader';
