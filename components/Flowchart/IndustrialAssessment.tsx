
import React, { useMemo, useState } from 'react';
import { SavedFlowchart } from '../../types';
import { useProjectContext } from '../../context/ProjectContext';

interface IndustrialAssessmentProps {
  flowchart: SavedFlowchart | null;
  onBOMEdit: (materialId: string, field: 'name' | 'amount' | 'price' | 'unit', value: string) => void;
  onAddMaterial?: () => void;
  onDeleteMaterial?: (materialName: string) => void;
  // Financial state uplifted from parent for export support
  productionValue: number;
  setProductionValue: (val: number) => void;
  unitLabel: '克' | '批次';
  setUnitLabel: (val: '克' | '批次') => void;
  includeMaterialCost: boolean;
  setIncludeMaterialCost: (val: boolean) => void;
  includeOperationCost: boolean;
  setIncludeOperationCost: (val: boolean) => void;
}

export const IndustrialAssessment: React.FC<IndustrialAssessmentProps> = ({
  flowchart, onBOMEdit, onAddMaterial, onDeleteMaterial,
  productionValue, setProductionValue, unitLabel, setUnitLabel,
  includeMaterialCost, setIncludeMaterialCost, includeOperationCost, setIncludeOperationCost
}) => {
  const { activeTheme } = useProjectContext();
  const isLight = activeTheme.type === 'light';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // ═══ 智能物料分类引擎 v2 — 四类独立核算 ═══
  // 分类优先级：化学品 > 折旧设备 > 能源动力 > 耗材辅料
  type CostCategory = 'chemical' | 'depreciation' | 'energy' | 'consumable';
  const CATEGORY_META: Record<CostCategory, {
    label: string; icon: string; color: string; textColor: string;
    bgLight: string; bgDark: string; borderLight: string; borderDark: string;
    scaleMode: 'bulk_discount' | 'fixed_depreciation' | 'linear';
  }> = {
    chemical:      { label: '化学物料', icon: 'fa-flask', color: '#6366f1', textColor: 'text-indigo-300', bgLight: 'bg-indigo-50 border-indigo-100', bgDark: 'border-indigo-500/20 bg-indigo-500/5', borderLight: 'border-indigo-200', borderDark: 'border-indigo-500/20', scaleMode: 'bulk_discount' },
    depreciation:  { label: '设备折旧', icon: 'fa-gears', color: '#f59e0b', textColor: 'text-amber-300', bgLight: 'bg-amber-50 border-amber-100', bgDark: 'border-amber-500/20 bg-amber-500/5', borderLight: 'border-amber-200', borderDark: 'border-amber-500/20', scaleMode: 'fixed_depreciation' },
    energy:        { label: '能源动力', icon: 'fa-bolt', color: '#10b981', textColor: 'text-emerald-300', bgLight: 'bg-emerald-50 border-emerald-100', bgDark: 'border-emerald-500/20 bg-emerald-500/5', borderLight: 'border-emerald-200', borderDark: 'border-emerald-500/20', scaleMode: 'linear' },
    consumable:    { label: '耗材辅料', icon: 'fa-box-open', color: '#8b5cf6', textColor: 'text-violet-300', bgLight: 'bg-violet-50 border-violet-100', bgDark: 'border-violet-500/20 bg-violet-500/5', borderLight: 'border-violet-200', borderDark: 'border-violet-500/20', scaleMode: 'linear' },
  };

  // 化学品：严格匹配化学式（含ion/acid/salt）+ 通用化学试剂名
  const CHEMICAL_KEYWORDS = [
    // 化学式模式
    'NO3', 'SO4', 'Cl2', 'OH', 'CO3', 'PO4', 'acac', 'H2O', 'NH4', 'CN',
    // 无机盐/金属盐
    '硝酸', '硫酸', '盐酸', '磷酸', '氢氧化', '碳酸', '醋酸', '草酸', '柠檬酸',
    '氯化', '高锰酸', '重铬酸', '过硫酸', '高氯酸', '氟化', '溴化', '碘化',
    // 有机溶剂
    '甲醇', '乙醇', '丙酮', '异丙醇', '正己烷', '二氯甲烷', '氯仿', '甲苯', '二甲苯',
    'DMF', 'DMSO', 'THF', 'NMP', 'DMAc', 'DMAC',
    'Methanol', 'Ethanol', 'Acetone', 'Toluene', 'Hexane',
    // 通用试剂
    '试剂', '溶液', '催化剂', '前驱体', '载体', '还原剂', '氧化剂', '表面活性剂',
    '水', '去离子水', '蒸馏水', '超纯水',
    // 高分子/特种
    'Nafion', 'PVDF', 'PTFE', 'PEG', 'PVP', 'CTAB', 'SDS',
    // 纳米材料/碳材料
    '碳黑', '石墨', '碳纳米管', 'Pt/C', '离子交换', '分子筛', '活性炭',
    // 金属/粉末
    '金属', '粉', '纳米粒', '量子点', '氧化物', '硫化物', '氮化物',
    // 气体（作为反应物）
    '氢气', '氧气', '氮气', '二氧化碳', 'CO2', 'H2', 'O2', 'N2',
    // 生化试剂
    '咪唑', '嘧啶', '吡啶', '噻吩', '呋喃', '苯胺', '尿素',
    'Urea', 'Imidazole', '2-Methylimidazole', '2-甲基咪唑',
    // 无机原料
    'NaOH', 'KOH', 'NaCl', 'KCl', 'Na2CO3', 'NaHCO3',
    'FeCl3', 'FeCl2', 'ZnCl2', 'CuSO4', 'NiCl2', 'CoCl2',
  ];

  // 折旧设备：固定资产，不随批次线性增长
  const DEPRECIATION_KEYWORDS = [
    // 大型仪器
    '电化学工作站', '光谱仪', '色谱仪', '质谱仪', 'XRD', 'XPS', 'SEM', 'TEM', 'AFM', 'BET',
    '核磁', 'NMR', 'ICP', 'UV-Vis', 'FTIR', '拉曼', '荧光光谱',
    // 反应设备
    '反应釜', '高压釜', '微波反应器', '光催化反应器', '电解槽',
    // 热处理设备
    '马弗炉', '管式炉', '真空炉', '回转炉', '微波炉', '烧结炉', '退火炉', '箱式炉',
    '高温炉', '气氛炉', '程序升温炉',
    // 分离/制备设备
    '离心机', '超速离心', '旋蒸', '旋转蒸发', '冷冻干燥', '喷雾干燥', '真空干燥',
    '球磨机', '行星球磨', '砂磨机', '压片机', '研磨机', '粉碎机',
    // 通用实验室设备
    '手套箱', '通风橱', '超声波清洗', '搅拌器', '磁力搅拌', '机械搅拌',
    '天平', '电子天平', '分析天平', '烘箱', '干燥箱', '恒温槽', '水浴锅', '油浴锅',
    '真空泵', '蠕动泵', '隔膜泵',
    // 镀膜/沉积
    '溅射仪', '蒸发器', '匀胶机', 'CVD', 'PVD', 'ALD',
    // 测试设备
    '探针台', '四探针', '霍尔效应', '拉伸试验机',
    // 通用关键词
    '设备折旧', '仪器折旧', '设备分摊', '计提折旧',
  ];

  // 能源动力：按批次线性叠加
  const ENERGY_KEYWORDS = [
    '电费', '电力', '用电', '电能', '电耗', '功耗', '电价',
    '水费', '用水', '冷却水', '循环水', '纯水制备',
    '天然气', '燃气', '燃料', '柴油', '汽油',
    '压缩空气', '氩气费', '氮气费', '液氮', '液氦', '干冰',
    '蒸汽', '供暖', '制冷', '空调',
    '能耗', '能源', '动力',
    'electricity', 'power', 'utility', 'utilities',
  ];

  // 耗材辅料：随批次消耗但不享受大宗折扣
  const CONSUMABLE_KEYWORDS = [
    // 玻璃器皿
    '烧杯', '量筒', '烧瓶', '三口瓶', '圆底烧瓶', '锥形瓶', '容量瓶',
    '试管', '培养皿', '表面皿', '蒸发皿', '坩埚', '瓶',
    // 过滤/分离
    '滤纸', '滤膜', '微孔滤膜', '漏斗', '布氏漏斗', '砂芯漏斗', '离心管',
    // 取样/转移
    '移液', '移液管', '量管', '注射器', '针头', '软管', '胶管',
    // 安全防护
    '手套', '乳胶手套', '丁腈手套', '口罩', '护目镜', '实验服',
    // 称量/标记
    '称量纸', '称量瓶', '标签', '记号笔', '封口膜', 'Parafilm',
    // 研磨/搅拌辅助
    '磁子', '搅拌子', '研钵', '研杵', '砂纸', '抛光布',
    // 特种耗材
    '陶瓷舟', '石英管', '石英舟', '刚玉舟', '碳纸', '碳布', '碳毡',
    '铂片', '铂丝', '铂网', '金片', '钛片', '钛网', '泡沫镍',
    '参比电极', '对电极', '工作电极', '电极片',
    '膜', '质子交换膜', 'GDL', '气体扩散层',
    // 通用耗材
    '胶带', '铝箔', '保鲜膜', '干燥剂', '硅胶',
  ];

  // ═══ 模式识别引擎（正则驱动，覆盖长尾名称）═══
  // 化学后缀模式：以这些字/词结尾的名称 → 化学物料
  const CHEM_SUFFIX_REGEX = /[酸醇醛酮酯醚烯烃胺腈酰酚盐碱铁钴镍铜锌锰钛铝锆钼钨钒铬铂钯钌铱铑铈镧钕钪钇铟锡锑铋铅银钙钠钾镁锂铯铷铍钡锶硒碲硫磷硼氨铵]$/;
  // 化学中间模式：名称中含这些模式 → 化学物料
  const CHEM_MID_REGEX = /合物|配合|配位|氧化|氢氧|氯化|硫化|氮化|碳化|水合|无水|脱水|高纯|分析纯|化学纯|优级纯|光谱纯/;
  // 化学式模式：含元素符号+数字（Fe2O3, Co3O4, ZnCl2, NaOH, H2SO4...）
  const FORMULA_REGEX = /[A-Z][a-z]?\d|[A-Z][a-z]?[A-Z]|[A-Z][a-z]?\(|·\d|•\d/;
  // 浓度/计量模式：含mol/L, wt%, mg/mL等 → 化学物料
  const CONC_REGEX = /mol\/|wt%|mg\/|mmol|μmol|µmol|g\/L|M溶液|[0-9]+%/i;
  // 前驱体/中间体模式
  const PRECURSOR_REGEX = /前驱|中间体|前体|母液|底物|反应物|产物|原料|纯品|标准品|基准/;
  // 有机物命名模式（含甲乙丙丁...开头 + 化学后缀）
  const ORGANIC_REGEX = /^[甲乙丙丁戊己庚辛壬癸正异仲叔环苯萘蒽芴]/;

  // 折旧设备模式
  const DEPR_SUFFIX_REGEX = /[机仪炉泵箱釜槽台器柜橱罐锅塔筛缸罩阀]$/;
  const DEPR_MID_REGEX = /设备|仪器|装置|分析仪|检测仪|工作站|反应器|干燥器|蒸馏|萃取|制备|镀膜|溅射|蒸发|真空|恒温|程序升温|气氛/;

  // 能源模式
  const ENERGY_REGEX = /电[费力耗能价]|水费|燃[气料油]|能[耗源]|动力|供[暖热]|制[冷暖]|空调|蒸汽|压缩空气|液[氮氦氩]|干冰|气体费|utility|electric|power/i;

  // 耗材模式
  const CONS_REGEX = /[杯筒瓶管皿斗膜纸布毡箔带子]$|手套|口罩|护目|实验服|封口|搅拌子|磁子|砂纸|抛光|电极|参比|GDL|Parafilm/;

  const classifyItem = (name: string): CostCategory => {
    const lowerName = name.toLowerCase();

    // ─── Pass 1: 结构公式检测（最高优先级）───
    if (FORMULA_REGEX.test(name)) return 'chemical';
    if (CONC_REGEX.test(name)) return 'chemical';

    // ─── Pass 2: 精确关键词优先匹配 ───
    // 化学品精确词
    if (CHEMICAL_KEYWORDS.some(kw => lowerName.includes(kw.toLowerCase()))) return 'chemical';
    // 折旧精确词
    if (DEPRECIATION_KEYWORDS.some(kw => lowerName.includes(kw.toLowerCase()))) return 'depreciation';
    // 能源精确词
    if (ENERGY_KEYWORDS.some(kw => lowerName.includes(kw.toLowerCase()))) return 'energy';
    // 耗材精确词
    if (CONSUMABLE_KEYWORDS.some(kw => lowerName.includes(kw.toLowerCase()))) return 'consumable';

    // ─── Pass 3: 正则模式兜底（覆盖AI生成的长尾名称）───
    // 化学后缀（以金属/酸/醇/盐等结尾）
    if (CHEM_SUFFIX_REGEX.test(name)) return 'chemical';
    // 化学中间词（含"氧化"/"水合"/"配合"等）
    if (CHEM_MID_REGEX.test(name)) return 'chemical';
    // 前驱体/原料标记
    if (PRECURSOR_REGEX.test(name)) return 'chemical';
    // 有机物命名（甲/乙/丙... 开头）
    if (ORGANIC_REGEX.test(name)) return 'chemical';

    // 能源模式
    if (ENERGY_REGEX.test(name)) return 'energy';
    // 折旧设备后缀
    if (DEPR_SUFFIX_REGEX.test(name)) return 'depreciation';
    // 折旧设备中间词
    if (DEPR_MID_REGEX.test(name)) return 'depreciation';
    // 耗材模式
    if (CONS_REGEX.test(name)) return 'consumable';

    // ─── Pass 4: 最终兜底 ───
    // 含有数字+字母混合（很可能是化学品型号）
    if (/[A-Za-z].*\d|\d.*[A-Za-z]/.test(name) && name.length < 30) return 'chemical';

    return 'chemical'; // 未知物料默认归化学品
  };

  // ═══ 四类独立聚合 ═══
  const aggregatedData = useMemo(() => {
    if (!flowchart || !Array.isArray(flowchart.steps)) return { chemical: [], depreciation: [], energy: [], consumable: [] };

    const maps: Record<CostCategory, Record<string, any>> = { chemical: {}, depreciation: {}, energy: {}, consumable: {} };

    flowchart.steps.forEach(step => {
      if (step.bomItems && Array.isArray(step.bomItems)) {
        step.bomItems.forEach(item => {
          if (!item.name) return;
          const key = item.name.trim();
          const amountStr = String(item.amount || '0').replace(/[^0-9.]/g, '');
          const numericAmount = parseFloat(amountStr) || 0;
          const parsedCost = parseFloat(item.estimatedCost as any);
          const totalItemCost = !isNaN(parsedCost) ? parsedCost : 0;
          const unitPrice = numericAmount > 0 ? totalItemCost / numericAmount : 0;
          const category = classifyItem(key);
          const targetMap = maps[category];

          if (targetMap[key]) {
            targetMap[key].amount += numericAmount;
            targetMap[key].cost += totalItemCost;
          } else {
            targetMap[key] = {
              name: key,
              unit: (item.unit || '').trim(),
              amount: numericAmount,
              price: unitPrice,
              cost: totalItemCost,
              category,
            };
          }
        });
      }
    });
    return {
      chemical: Object.values(maps.chemical),
      depreciation: Object.values(maps.depreciation),
      energy: Object.values(maps.energy),
      consumable: Object.values(maps.consumable),
    };
  }, [flowchart]);

  // ═══ 各类基准成本 ═══
  const chemBase  = useMemo(() => aggregatedData.chemical.reduce((s, i) => s + (i.cost || 0), 0), [aggregatedData]);
  const deprBase  = useMemo(() => aggregatedData.depreciation.reduce((s, i) => s + (i.cost || 0), 0), [aggregatedData]);
  const energBase = useMemo(() => aggregatedData.energy.reduce((s, i) => s + (i.cost || 0), 0), [aggregatedData]);
  const consBase  = useMemo(() => aggregatedData.consumable.reduce((s, i) => s + (i.cost || 0), 0), [aggregatedData]);

  // 向后兼容
  const matTotalBase = chemBase;
  const opTotalBase = deprBase + energBase + consBase;

  // ═══ 批次当量计算 (Batch Multiplier) ═══
  const batchMultiplier = useMemo(() => {
    if (unitLabel === '批次') return productionValue;
    // AI 报告的该配方单批产出量(克)
    const baseYieldGrams = flowchart?.batchYieldGrams || flowchart?.scaleFactor || 1;
    return productionValue / baseYieldGrams;
  }, [unitLabel, productionValue, flowchart?.batchYieldGrams, flowchart?.scaleFactor]);

  // ═══ 阶梯式折扣模型 — 仅化学物料享受 ═══
  const scaleDiscount = useMemo(() => {
    if (batchMultiplier <= 1) return 1.0;
    if (batchMultiplier <= 5) return 0.95;
    if (batchMultiplier <= 20) return 0.88;
    if (batchMultiplier <= 100) return 0.78;
    if (batchMultiplier <= 500) return 0.65;
    return 0.55;
  }, [batchMultiplier]);

  const discountTier = useMemo(() => {
    if (batchMultiplier <= 1) return { label: '基准价', tier: 0 };
    if (batchMultiplier <= 5) return { label: 'T1 小批', tier: 1 };
    if (batchMultiplier <= 20) return { label: 'T2 中试', tier: 2 };
    if (batchMultiplier <= 100) return { label: 'T3 量产', tier: 3 };
    if (batchMultiplier <= 500) return { label: 'T4 规模', tier: 4 };
    return { label: 'T5 大宗', tier: 5 };
  }, [batchMultiplier]);

  // ═══ 四类分别计算总成本 ═══
  // 化学物料: 享受阶梯折扣 × 批次当量
  const totalChemCost = includeMaterialCost ? chemBase * scaleDiscount * batchMultiplier : 0;
  // 设备折旧: 固定分摊（不随批次增长，只按单批折旧费摊入）
  const totalDeprCost = includeOperationCost ? deprBase : 0;
  // 能源动力: 线性叠加（根据批次当量）
  const totalEnergyCost = includeOperationCost ? energBase * batchMultiplier : 0;
  // 耗材辅料: 线性叠加
  const totalConsCost = includeOperationCost ? consBase * batchMultiplier : 0;

  // 向后兼容
  const totalMaterialCost = totalChemCost;
  const totalOperationCost = totalDeprCost + totalEnergyCost + totalConsCost;
  const totalScaledCost = totalMaterialCost + totalOperationCost;
  const costPerUnit = totalScaledCost / (productionValue || 1);

  const allItems = [...aggregatedData.chemical, ...aggregatedData.depreciation, ...aggregatedData.energy, ...aggregatedData.consumable];

  // ═══ 库存联动匹配 ═══
  const { inventory } = useProjectContext();
  const inventoryMatchMap = useMemo(() => {
    const map: Record<string, string> = {};
    allItems.forEach(item => {
      const match = inventory.find(inv => {
        const invName = inv.name.toLowerCase();
        const itemName = item.name.toLowerCase();
        return invName.includes(itemName) || itemName.includes(invName) ||
          (inv.formula && (inv.formula.toLowerCase().includes(itemName) || itemName.includes(inv.formula.toLowerCase())));
      });
      if (match) map[item.name] = match.id;
    });
    return map;
  }, [allItems, inventory]);

  // ═══ SVG 饼图数据（四类）═══
  const pieData = useMemo(() => {
    const costs = [
      { key: 'chemical' as CostCategory, value: totalChemCost },
      { key: 'depreciation' as CostCategory, value: totalDeprCost },
      { key: 'energy' as CostCategory, value: totalEnergyCost },
      { key: 'consumable' as CostCategory, value: totalConsCost },
    ].filter(c => c.value > 0);
    const total = costs.reduce((s, c) => s + c.value, 0);
    if (total === 0) return null;
    let cumAngle = 0;
    const slices = costs.map(c => {
      const pct = c.value / total;
      const startAngle = cumAngle;
      cumAngle += pct * 360;
      return { ...c, pct, startAngle, endAngle: cumAngle, color: CATEGORY_META[c.key].color };
    });
    return { slices, total };
  }, [totalChemCost, totalDeprCost, totalEnergyCost, totalConsCost]);

  // ═══ 规模曲线数据 ═══
  const scalePoints = useMemo(() => {
    const pts: { batch: number; cost: number }[] = [];
    const maxB = Math.max(Math.ceil(batchMultiplier * 3), 20);
    for (let b = 1; b <= maxB; b++) {
      let sd = 1.0;
      if (b <= 5) sd = 0.95;
      else if (b <= 20) sd = 0.88;
      else if (b <= 100) sd = 0.78;
      else if (b <= 500) sd = 0.65;
      else sd = 0.55;
      const chem = includeMaterialCost ? chemBase * sd * b : 0;
      const depr = includeOperationCost ? deprBase : 0; // 固定
      const enrg = includeOperationCost ? energBase * b : 0;
      const cons = includeOperationCost ? consBase * b : 0;
      const unit = (chem + depr + enrg + cons) / b;
      pts.push({ batch: b, cost: unit });
    }
    return pts;
  }, [chemBase, deprBase, energBase, consBase, batchMultiplier, includeMaterialCost, includeOperationCost]);

  // ═══ SVG 辅助函数 ═══
  const polarToXY = (cx: number, cy: number, r: number, deg: number) => {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const arcPath = (cx: number, cy: number, r: number, s: number, e: number) => {
    const start = polarToXY(cx, cy, r, e);
    const end = polarToXY(cx, cy, r, s);
    const large = e - s <= 180 ? 0 : 1;
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`;
  };


  return (
    <div className={`shrink-0 flex flex-col h-full no-print transition-all duration-300 ease-out ${isExpanded ? 'w-[600px]' : 'w-64 lg:w-72'}`}>
      <div className={`flex-1 rounded-[2rem] p-4 flex flex-col shadow-2xl overflow-hidden transition-colors duration-300 ${isLight ? 'bg-white/95 border border-slate-200 text-slate-800' : 'bg-slate-900 border border-white/5 text-white'}`}>
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <i className="fa-solid fa-industry text-[10px]"></i>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[10px] font-black uppercase tracking-widest leading-none">工业成本评估库</h4>
            <p className={`text-[6px] font-bold uppercase mt-0.5 tracking-tighter ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Scale-up & Economy of Scale</p>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] transition-all active:scale-90 shadow-sm ${isLight ? 'bg-slate-100 text-slate-500 hover:bg-indigo-600 hover:text-white' : 'bg-white/10 text-white/60 hover:bg-indigo-600 hover:text-white'}`}
            title={isExpanded ? '缩小面板' : '放大面板'}
          >
            <i className={`fa-solid ${isExpanded ? 'fa-compress' : 'fa-expand'}`}></i>
          </button>
        </div>

        <div className="space-y-3 flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar pr-1">
          {/* Production Cost Dashboard with Toggles */}
          <section className="bg-indigo-600/90 rounded-lg p-3.5 shadow-xl relative overflow-hidden shrink-0 border border-white/10 text-white">
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-2.5">
                <p className="text-[10px] font-black text-white/70 uppercase tracking-tighter">成本预测 ({productionValue} {unitLabel})</p>
                <div className="flex items-center gap-1 bg-black/20 p-0.5 rounded-lg">
                  <input
                    type="number"
                    min="1"
                    className="bg-transparent border-none outline-none text-[11px] font-black text-white w-10 text-center"
                    value={productionValue}
                    onChange={(e) => setProductionValue(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <button
                    onClick={() => setUnitLabel(unitLabel === '批次' ? '克' : '批次')}
                    className="text-[6px] font-black bg-white/10 px-1 py-0.5 rounded text-indigo-100 hover:bg-white/20 transition-all mr-0.5"
                  >
                    {unitLabel}
                  </button>
                </div>
              </div>

              <div className="space-y-2 border-t border-white/10 pt-2.5">
                {/* 化学物料 — 阶梯折扣 */}
                <div className={`flex justify-between items-end transition-opacity duration-300 ${includeMaterialCost ? 'opacity-100' : 'opacity-30'}`}>
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setIncludeMaterialCost(!includeMaterialCost)}
                        className={`w-5 h-3 rounded-full relative transition-colors duration-300 ${includeMaterialCost ? 'bg-indigo-400' : 'bg-slate-600'}`}
                      >
                        <div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-transform duration-300 ${includeMaterialCost ? 'left-2.5' : 'left-0.5'}`} />
                      </button>
                      <span className="text-[9px] font-black text-indigo-200 uppercase"><i className="fa-solid fa-flask text-[6px] mr-0.5"></i> 化学物料</span>
                    </div>
                    <span className={`text-[7px] font-bold px-1 rounded inline-block mt-0.5 w-fit ${scaleDiscount < 1 && includeMaterialCost ? 'bg-emerald-400 text-slate-900' : 'text-indigo-300'}`}>
                      {includeMaterialCost ? (scaleDiscount < 1 ? `${discountTier.label} · ${((1 - scaleDiscount) * 100).toFixed(0)}% OFF` : '基准价') : '不计入'}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold">¥{totalChemCost.toFixed(2)}</p>
                </div>

                {/* 设备折旧 — 固定分摊 */}
                <div className={`flex justify-between items-end transition-opacity duration-300 ${includeOperationCost ? 'opacity-100' : 'opacity-30'}`}>
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-black text-amber-300 uppercase"><i className="fa-solid fa-gears text-[6px] mr-0.5"></i> 设备折旧</span>
                    </div>
                    <span className="text-[7px] text-amber-400 italic mt-0.5">固定分摊（不随批次增长）</span>
                  </div>
                  <p className="text-[11px] font-bold">¥{totalDeprCost.toFixed(2)}</p>
                </div>

                {/* 能源动力 — 线性叠加 */}
                <div className={`flex justify-between items-end transition-opacity duration-300 ${includeOperationCost ? 'opacity-100' : 'opacity-30'}`}>
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setIncludeOperationCost(!includeOperationCost)}
                        className={`w-5 h-3 rounded-full relative transition-colors duration-300 ${includeOperationCost ? 'bg-emerald-400' : 'bg-slate-600'}`}
                      >
                        <div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-transform duration-300 ${includeOperationCost ? 'left-2.5' : 'left-0.5'}`} />
                      </button>
                      <span className="text-[9px] font-black text-emerald-300 uppercase"><i className="fa-solid fa-bolt text-[6px] mr-0.5"></i> 能源动力</span>
                    </div>
                    <span className="text-[7px] text-emerald-400 italic mt-0.5">{includeOperationCost ? '线性叠加' : '不计入（含折旧+耗材）'}</span>
                  </div>
                  <p className="text-[11px] font-bold">¥{totalEnergyCost.toFixed(2)}</p>
                </div>

                {/* 耗材辅料 — 线性叠加 */}
                <div className={`flex justify-between items-end transition-opacity duration-300 ${includeOperationCost ? 'opacity-100' : 'opacity-30'}`}>
                  <div className="flex flex-col flex-1">
                    <span className="text-[9px] font-black text-violet-300 uppercase"><i className="fa-solid fa-box-open text-[6px] mr-0.5"></i> 耗材辅料</span>
                    <span className="text-[7px] text-violet-400 italic mt-0.5">线性叠加</span>
                  </div>
                  <p className="text-[11px] font-bold">¥{totalConsCost.toFixed(2)}</p>
                </div>

                <div className="flex justify-between items-end pt-1.5 border-t border-white/5 mt-1">
                  <p className="text-[10px] font-black text-white uppercase italic">预估总投入 (TOTAL)</p>
                  <p className="text-lg font-black text-emerald-400 italic">¥{totalScaledCost.toFixed(1)}</p>
                </div>
              </div>

              <div className="mt-2.5 flex justify-between items-center bg-black/20 p-2 rounded-xl border border-white/5">
                <p className="text-[9px] font-bold text-indigo-100 opacity-60 uppercase">单位成本 (每{unitLabel})</p>
                <p className="text-[12px] font-black text-white font-mono">¥{costPerUnit.toFixed(2)}</p>
              </div>
            </div>
           </section>

          {/* ═══ SVG 可视化 ═══ */}
          {(pieData || scalePoints.length > 0) && (
            <section className="grid grid-cols-2 gap-2 shrink-0">
              {/* 饼图（四色） */}
              {pieData && (
                <div className={`p-2 rounded-lg border ${isLight ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                  <p className={`${isExpanded ? 'text-[9px]' : 'text-[6px]'} font-black uppercase tracking-widest mb-1 flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    <i className={`fa-solid fa-chart-pie ${isExpanded ? 'text-[8px]' : 'text-[5px]'} text-indigo-400`}></i> 成本归因
                  </p>
                  <div className="flex items-center gap-3">
                    <svg width={isExpanded ? '80' : '38'} height={isExpanded ? '80' : '38'} viewBox="0 0 38 38">
                      {pieData.slices.map((slice, i) => (
                        <path key={i} d={arcPath(19, 19, 17, slice.startAngle, Math.min(slice.endAngle, slice.startAngle + 359.99))} fill={slice.color} opacity="0.9" />
                      ))}
                      <circle cx="19" cy="19" r="9" fill={isLight ? 'white' : '#0f172a'} />
                    </svg>
                    <div className="flex flex-col gap-0.5">
                      {pieData.slices.map((slice, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className={`${isExpanded ? 'w-2.5 h-2.5' : 'w-1.5 h-1.5'} rounded-sm`} style={{ backgroundColor: slice.color }}></div>
                          <span className={`${isExpanded ? 'text-[10px]' : 'text-[5px]'} font-bold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            {CATEGORY_META[slice.key].label} {(slice.pct * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 规模曲线 */}
              {scalePoints.length > 0 && (() => {
                const maxCost = Math.max(...scalePoints.map(p => p.cost), 0.01);
                const maxBatch = Math.max(...scalePoints.map(p => p.batch), 1);
                const W = 100, H = 40, P = 4;
                const toSvg = (p: { batch: number; cost: number }) => ({
                  x: P + (p.batch / maxBatch) * (W - P * 2),
                  y: P + (1 - p.cost / maxCost) * (H - P * 2),
                });
                const pathD = scalePoints.map((p, i) => {
                  const { x, y } = toSvg(p);
                  return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
                }).join(' ');
                const cur = scalePoints.find(p => p.batch === productionValue);
                const curSvg = cur ? toSvg(cur) : null;
                return (
                  <div className={`p-2 rounded-lg border ${isLight ? 'bg-slate-50 border-slate-100' : 'bg-white/5 border-white/5'}`}>
                    <p className={`${isExpanded ? 'text-[9px]' : 'text-[6px]'} font-black uppercase tracking-widest mb-1 flex items-center gap-1 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                      <i className={`fa-solid fa-chart-line ${isExpanded ? 'text-[8px]' : 'text-[5px]'} text-violet-400`}></i> 规模曲线
                    </p>
                    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className={`rounded-md ${isLight ? 'bg-white' : 'bg-slate-800'}`}>
                      {[0.25, 0.5, 0.75].map(pct => (
                        <line key={pct} x1={P} x2={W - P} y1={P + pct * (H - P * 2)} y2={P + pct * (H - P * 2)} stroke={isLight ? '#e2e8f0' : '#334155'} strokeWidth="0.3" strokeDasharray="2,2" />
                      ))}
                      <path d={pathD} fill="none" stroke="#a78bfa" strokeWidth="1" strokeLinejoin="round" />
                      <path d={`${pathD} L ${P + (W - P * 2)} ${H - P} L ${P} ${H - P} Z`} fill="#a78bfa" opacity="0.15" />
                      {curSvg && (
                        <>
                          <circle cx={curSvg.x} cy={curSvg.y} r="2.5" fill="#7c3aed" stroke="white" strokeWidth="1" />
                          <text x={curSvg.x} y={curSvg.y - 4} textAnchor="middle" fill="#a78bfa" fontSize="4" fontWeight="bold">¥{cur!.cost.toFixed(1)}</text>
                        </>
                      )}
                    </svg>
                  </div>
                );
              })()}
            </section>
          )}

          {/* BOM Breakdown */}
          <section className="flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-1.5 px-1">
              <p className={`text-[7px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}>
                <i className="fa-solid fa-list-check"></i> 物料清单明细
              </p>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setIsModalOpen(true)} className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] hover:bg-indigo-600 hover:text-white transition-all shadow-sm ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-white'}`}><i className="fa-solid fa-pen"></i></button>
                <button onClick={onAddMaterial} className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-[8px] hover:bg-white hover:text-indigo-600 transition-all shadow-lg text-white"><i className="fa-solid fa-plus"></i></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
              {flowchart && allItems.length > 0 ? allItems.map((item, idx) => {
                const cat = item.category as CostCategory;
                const meta = CATEGORY_META[cat];
                const isOp = cat !== 'chemical';
                const currentEffectivePrice = cat === 'chemical' ? (item.price * scaleDiscount) : item.price;
                const batchMultiplier = cat === 'depreciation' ? 1 : productionValue;
                const currentTotal = currentEffectivePrice * item.amount * batchMultiplier;
                const isDisabled = (isOp && !includeOperationCost) || (!isOp && !includeMaterialCost);

                return (
                  <div key={idx} className={`p-2.5 rounded-xl border transition-all group relative overflow-hidden ${isDisabled ? 'opacity-25 grayscale' : ''} ${isLight ? meta.bgLight : meta.bgDark}`}>
                    {isOp && <div className="absolute -left-1 top-0 bottom-0 w-1 opacity-60" style={{ backgroundColor: meta.color }}></div>}
                    <button onClick={() => onDeleteMaterial?.(item.name)} className="absolute -right-2 -top-2 w-5 h-5 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-md flex items-center justify-center active:scale-90 z-20"><i className="fa-solid fa-times text-[8px]"></i></button>
                    <div className="flex justify-between items-center gap-2">
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <input className={`bg-transparent border-none text-[8px] font-black outline-none flex-1 min-w-0 italic focus:text-current ${isLight ? 'text-slate-700' : 'text-slate-300'}`} value={item.name} onChange={(e) => onBOMEdit(item.name, 'name', e.target.value)} />
                          {inventoryMatchMap[item.name] && (
                            <span className={`text-[4px] font-black px-1 py-0.5 rounded-full shrink-0 border ${isLight ? 'text-indigo-500 bg-indigo-50 border-indigo-100' : 'text-indigo-300 bg-indigo-950 border-indigo-800'}`}>
                              <i className="fa-solid fa-link text-[3px] mr-0.5"></i>库存
                            </span>
                          )}
                        </div>
                        <span className={`text-[5px] font-black uppercase tracking-tighter mt-0.5 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                          <i className={`fa-solid ${meta.icon} text-[4px] mr-0.5`}></i>
                          {meta.label}{cat === 'depreciation' ? ' · 固定' : cat === 'chemical' ? ' · 折扣' : ' · 线性'}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <span className={`text-[6px] font-bold ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>¥</span>
                      <input type="number" step="0.01" className={`w-16 rounded-lg px-1 py-0.5 text-[8px] font-black text-emerald-400 font-mono outline-none border border-transparent ${isLight ? 'bg-white border-slate-100 text-emerald-600' : 'bg-slate-800/50'}`} value={currentEffectivePrice.toFixed(4)} onChange={(e) => onBOMEdit(item.name, 'price', (parseFloat(e.target.value) / (cat === 'chemical' ? scaleDiscount : 1)).toString())} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className={`flex items-center gap-1 text-[6px] font-bold uppercase ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                        <span>用量:</span>
                        <p className={`text-[8px] font-mono ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>{(item.amount * productionValue).toFixed(2)}</p>
                        <span>{item.unit}</span>
                      </div>
                      <p className={`text-[8px] font-black opacity-60 group-hover:opacity-100 transition-opacity`} style={{ color: meta.color }}>¥{currentTotal.toFixed(2)}</p>
                    </div>
                  </div>
                );
              }) : (
                <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-10"><i className="fa-solid fa-industry text-2xl"></i></div>
              )}
            </div>
          </section>

          <div className={`mt-auto pt-1.5 border-t px-1 space-y-1 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
            <div
              className="flex justify-between items-center cursor-pointer group/note"
              onClick={() => setIsNoteExpanded(!isNoteExpanded)}
            >
              <p className={`text-[8px] font-black uppercase tracking-widest italic leading-relaxed transition-colors ${isLight ? 'text-slate-400 group-hover/note:text-indigo-500' : 'text-slate-400 group-hover/note:text-indigo-400'}`}>* 规模效应审计准则 (含大宗折扣)</p>
              <i className={`fa-solid ${isNoteExpanded ? 'fa-chevron-down' : 'fa-chevron-up'} text-[5px] transition-transform duration-300 ${isLight ? 'text-slate-400' : 'text-slate-600'}`}></i>
            </div>

            {isNoteExpanded && (
              <div className="animate-reveal space-y-1 mt-0.5">
                    <p className="text-[8px] italic leading-tight">1. 【化学物料】：五级大宗采购阶梯折扣 — T1(5%) → T2(12%) → T3(22%) → T4(35%) → T5(45%)。</p>
                    <p className="text-[8px] italic leading-tight">2. 【设备折旧】：固定分摊，不随批次线性增长（一次性计提）。</p>
                    <p className="text-[8px] italic leading-tight">3. 【能源动力】：线性叠加，每批次等额消耗（电力+气体+冷却）。</p>
                    <p className="text-[8px] italic leading-tight">4. 【耗材辅料】：线性叠加，不享受大宗折扣（石英管/碳纸/膜等）。</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[5000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl h-[80vh] rounded-[3rem] p-10 animate-reveal shadow-2xl relative border-4 border-white flex flex-col text-slate-800">
            <header className="flex justify-between items-center mb-8 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-xl"><i className="fa-solid fa-table-list text-xl"></i></div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">BOM 全球审计编辑器</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">内置物料规模降本系数引擎 v3.5</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"><i className="fa-solid fa-times"></i></button>
            </header>

            <div className="flex-1 overflow-auto custom-scrollbar border border-slate-100 rounded-[2rem] bg-slate-50/30">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-900 text-white z-10">
                  <tr>
                    <th className="p-5 text-[10px] font-black uppercase tracking-widest border-r border-white/10">科目名称 (物料分类)</th>
                    <th className="p-5 text-[10px] font-black uppercase tracking-widest border-r border-white/10 w-24">单位</th>
                    <th className="p-5 text-[10px] font-black uppercase tracking-widest border-r border-white/10 w-48">基准单价 (¥)</th>
                    <th className="p-5 text-[10px] font-black uppercase tracking-widest border-r border-white/10 w-48">单批用量 (Base)</th>
                    <th className="p-5 text-[10px] font-black uppercase tracking-widest w-24 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {allItems.map((item, idx) => (
                    <tr key={idx} className={`border-b border-slate-100 group transition-colors ${item.isOp ? 'bg-amber-50/10 hover:bg-amber-50/30' : 'hover:bg-indigo-50/30'}`}>
                      <td className="p-4 border-r border-slate-100">
                        <div className="flex flex-col">
                          <input className={`w-full bg-transparent border-none text-[12px] font-black outline-none italic ${item.isOp ? 'text-amber-700' : 'text-slate-800'}`} value={item.name} onChange={(e) => onBOMEdit(item.name, 'name', e.target.value)} />
                          <span className={`text-[7px] font-black uppercase tracking-widest mt-1 ${item.isOp ? 'text-amber-600' : 'text-indigo-400'}`}>
                {item.isOp ? <><i className="fa-solid fa-bolt-lightning mr-1"></i> {CATEGORY_META[item.category as CostCategory]?.label || '固定运营分摊'}</> : <><i className="fa-solid fa-box mr-1"></i> 享受大宗折扣</>}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 border-r border-slate-100"><input className="w-full bg-transparent border-none text-[12px] font-black text-slate-400 outline-none text-center" value={item.unit} onChange={(e) => onBOMEdit(item.name, 'unit', e.target.value)} /></td>
                      <td className="p-4 border-r border-slate-100"><div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100"><span className="text-[10px] font-black text-slate-300">¥</span><input type="number" step="0.01" className="w-full bg-transparent border-none text-[13px] font-black text-emerald-600 font-mono outline-none" value={item.price} onChange={(e) => onBOMEdit(item.name, 'price', e.target.value)} /></div></td>
                      <td className="p-4 border-r border-slate-100"><div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100"><input type="number" step="0.01" className="w-full bg-transparent border-none text-[13px] font-black text-indigo-600 font-mono outline-none" value={item.amount} onChange={(e) => onBOMEdit(item.name, 'amount', e.target.value)} /><span className="text-[10px] font-black text-slate-300">{item.unit}</span></div></td>
                      <td className="p-4 text-center"><button onClick={() => onDeleteMaterial?.(item.name)} className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center active:scale-90"><i className="fa-solid fa-trash-can text-sm"></i></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className="mt-8 shrink-0 flex justify-between items-center">
              <p className="text-[10px] font-black text-slate-400 uppercase italic">* 系统将根据您主界面设定的规模 {productionValue}x 自动计算阶梯折扣并展示最终单价。</p>
              <div className="flex gap-4">
                <button onClick={onAddMaterial} className="px-8 py-3 bg-white text-indigo-600 border-2 border-indigo-600 rounded-lg text-[10px] font-black uppercase hover:bg-indigo-50 flex items-center gap-2"><i className="fa-solid fa-plus"></i> 添加新科目</button>
                <button onClick={() => setIsModalOpen(false)} className="px-10 py-3 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase shadow-xl hover:bg-indigo-600 transition-all active:scale-95">确认审计变更</button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};
