/**
 * 常见实验室化学品本地字典
 * 用于瞬时查找分子式、分子量和危险分类，无需 AI 调用
 *
 * hazard 分类对应 safetyLevel:
 *   'Safe'       — 无特殊危险
 *   'Toxic'      — 有毒/剧毒
 *   'Corrosive'  — 强腐蚀性
 *   'Flammable'  — 易燃
 *   'Explosive'  — 易爆
 *   'Oxidizer'   — 强氧化性
 */

export type HazardLevel = 'Safe' | 'Toxic' | 'Corrosive' | 'Flammable' | 'Explosive' | 'Oxidizer';

export interface ChemicalInfo {
    formula: string;
    mw: number; // molecular weight
    hazard: HazardLevel;
}

// key 为化学品中文名（支持多种常见叫法）
const DICT: Record<string, ChemicalInfo> = {
    // ── 钾盐 ──
    '硫酸钾': { formula: 'K₂SO₄', mw: 174.26, hazard: 'Safe' },
    '磷酸二氢钾': { formula: 'KH₂PO₄', mw: 136.09, hazard: 'Safe' },
    '磷酸氢二钾': { formula: 'K₂HPO₄', mw: 174.18, hazard: 'Safe' },
    '碘化钾': { formula: 'KI', mw: 166.00, hazard: 'Safe' },
    '碘酸钾': { formula: 'KIO₃', mw: 214.00, hazard: 'Oxidizer' },
    '溴化钾': { formula: 'KBr', mw: 119.00, hazard: 'Safe' },
    '铬酸钾': { formula: 'K₂CrO₄', mw: 194.19, hazard: 'Toxic' },
    '氯化钾': { formula: 'KCl', mw: 74.55, hazard: 'Safe' },
    '碳酸钾': { formula: 'K₂CO₃', mw: 138.21, hazard: 'Safe' },
    '氢氧化钾': { formula: 'KOH', mw: 56.11, hazard: 'Corrosive' },
    '高锰酸钾': { formula: 'KMnO₄', mw: 158.03, hazard: 'Oxidizer' },
    '硝酸钾': { formula: 'KNO₃', mw: 101.10, hazard: 'Oxidizer' },
    '重铬酸钾': { formula: 'K₂Cr₂O₇', mw: 294.18, hazard: 'Toxic' },
    '草酸钾': { formula: 'K₂C₂O₄', mw: 166.22, hazard: 'Toxic' },
    '醋酸钾': { formula: 'CH₃COOK', mw: 98.14, hazard: 'Safe' },
    '乙酸钾': { formula: 'CH₃COOK', mw: 98.14, hazard: 'Safe' },
    '氟化钾': { formula: 'KF', mw: 58.10, hazard: 'Toxic' },
    '硫氰酸钾': { formula: 'KSCN', mw: 97.18, hazard: 'Toxic' },
    '过硫酸钾': { formula: 'K₂S₂O₈', mw: 270.32, hazard: 'Oxidizer' },

    // ── 钠盐 ──
    '氯化钠': { formula: 'NaCl', mw: 58.44, hazard: 'Safe' },
    '氢氧化钠': { formula: 'NaOH', mw: 40.00, hazard: 'Corrosive' },
    '碳酸钠': { formula: 'Na₂CO₃', mw: 105.99, hazard: 'Safe' },
    '碳酸氢钠': { formula: 'NaHCO₃', mw: 84.01, hazard: 'Safe' },
    '硫酸钠': { formula: 'Na₂SO₄', mw: 142.04, hazard: 'Safe' },
    '亚硫酸钠': { formula: 'Na₂SO₃', mw: 126.04, hazard: 'Safe' },
    '硝酸钠': { formula: 'NaNO₃', mw: 85.00, hazard: 'Oxidizer' },
    '亚硝酸钠': { formula: 'NaNO₂', mw: 69.00, hazard: 'Toxic' },
    '磷酸钠': { formula: 'Na₃PO₄', mw: 163.94, hazard: 'Safe' },
    '磷酸二氢钠': { formula: 'NaH₂PO₄', mw: 119.98, hazard: 'Safe' },
    '磷酸氢二钠': { formula: 'Na₂HPO₄', mw: 141.96, hazard: 'Safe' },
    '醋酸钠': { formula: 'CH₃COONa', mw: 82.03, hazard: 'Safe' },
    '乙酸钠': { formula: 'CH₃COONa', mw: 82.03, hazard: 'Safe' },
    '草酸钠': { formula: 'Na₂C₂O₄', mw: 134.00, hazard: 'Toxic' },
    '硅酸钠': { formula: 'Na₂SiO₃', mw: 122.06, hazard: 'Corrosive' },
    '硼砂': { formula: 'Na₂B₄O₇·10H₂O', mw: 381.37, hazard: 'Safe' },
    '硼酸钠': { formula: 'Na₂B₄O₇', mw: 201.22, hazard: 'Safe' },
    '硫化钠': { formula: 'Na₂S', mw: 78.04, hazard: 'Corrosive' },
    '硫代硫酸钠': { formula: 'Na₂S₂O₃', mw: 158.11, hazard: 'Safe' },
    '过硫酸钠': { formula: 'Na₂S₂O₈', mw: 238.10, hazard: 'Oxidizer' },
    '柠檬酸钠': { formula: 'Na₃C₆H₅O₇', mw: 258.07, hazard: 'Safe' },
    '氟化钠': { formula: 'NaF', mw: 41.99, hazard: 'Toxic' },
    '溴化钠': { formula: 'NaBr', mw: 102.89, hazard: 'Safe' },
    '碘化钠': { formula: 'NaI', mw: 149.89, hazard: 'Safe' },
    '钼酸钠': { formula: 'Na₂MoO₄', mw: 205.92, hazard: 'Safe' },
    '钨酸钠': { formula: 'Na₂WO₄', mw: 293.82, hazard: 'Safe' },
    '叠氮化钠': { formula: 'NaN₃', mw: 65.01, hazard: 'Toxic' },
    '氰化钠': { formula: 'NaCN', mw: 49.01, hazard: 'Toxic' },

    // ── 钙盐 ──
    '氯化钙': { formula: 'CaCl₂', mw: 110.98, hazard: 'Safe' },
    '碳酸钙': { formula: 'CaCO₃', mw: 100.09, hazard: 'Safe' },
    '氧化钙': { formula: 'CaO', mw: 56.08, hazard: 'Corrosive' },
    '氢氧化钙': { formula: 'Ca(OH)₂', mw: 74.09, hazard: 'Corrosive' },
    '硫酸钙': { formula: 'CaSO₄', mw: 136.14, hazard: 'Safe' },
    '硝酸钙': { formula: 'Ca(NO₃)₂', mw: 164.09, hazard: 'Oxidizer' },
    '乙酸钙': { formula: 'Ca(CH₃COO)₂', mw: 158.17, hazard: 'Safe' },
    '醋酸钙': { formula: 'Ca(CH₃COO)₂', mw: 158.17, hazard: 'Safe' },

    // ── 铁盐 ──
    '氯化铁': { formula: 'FeCl₃', mw: 162.20, hazard: 'Corrosive' },
    '三氯化铁': { formula: 'FeCl₃', mw: 162.20, hazard: 'Corrosive' },
    '氯化亚铁': { formula: 'FeCl₂', mw: 126.75, hazard: 'Safe' },
    '硫酸铁': { formula: 'Fe₂(SO₄)₃', mw: 399.88, hazard: 'Safe' },
    '硫酸亚铁': { formula: 'FeSO₄', mw: 151.91, hazard: 'Safe' },
    '硝酸铁': { formula: 'Fe(NO₃)₃', mw: 241.86, hazard: 'Oxidizer' },
    '硝酸亚铁': { formula: 'Fe(NO₃)₂', mw: 179.86, hazard: 'Safe' },
    '氧化铁': { formula: 'Fe₂O₃', mw: 159.69, hazard: 'Safe' },
    '四氧化三铁': { formula: 'Fe₃O₄', mw: 231.53, hazard: 'Safe' },

    // ── 铜盐 ──
    '硫酸铜': { formula: 'CuSO₄', mw: 159.61, hazard: 'Toxic' },
    '氯化铜': { formula: 'CuCl₂', mw: 134.45, hazard: 'Toxic' },
    '硝酸铜': { formula: 'Cu(NO₃)₂', mw: 187.56, hazard: 'Oxidizer' },
    '醋酸铜': { formula: 'Cu(CH₃COO)₂', mw: 181.63, hazard: 'Toxic' },
    '氧化铜': { formula: 'CuO', mw: 79.55, hazard: 'Safe' },
    '氧化亚铜': { formula: 'Cu₂O', mw: 143.09, hazard: 'Safe' },

    // ── 锌盐 ──
    '氯化锌': { formula: 'ZnCl₂', mw: 136.30, hazard: 'Corrosive' },
    '硫酸锌': { formula: 'ZnSO₄', mw: 161.47, hazard: 'Safe' },
    '硝酸锌': { formula: 'Zn(NO₃)₂', mw: 189.40, hazard: 'Oxidizer' },
    '醋酸锌': { formula: 'Zn(CH₃COO)₂', mw: 183.48, hazard: 'Safe' },
    '氧化锌': { formula: 'ZnO', mw: 81.38, hazard: 'Safe' },

    // ── 镁盐 ──
    '氯化镁': { formula: 'MgCl₂', mw: 95.21, hazard: 'Safe' },
    '硫酸镁': { formula: 'MgSO₄', mw: 120.37, hazard: 'Safe' },
    '氧化镁': { formula: 'MgO', mw: 40.30, hazard: 'Safe' },
    '氢氧化镁': { formula: 'Mg(OH)₂', mw: 58.32, hazard: 'Safe' },
    '碳酸镁': { formula: 'MgCO₃', mw: 84.31, hazard: 'Safe' },
    '硝酸镁': { formula: 'Mg(NO₃)₂', mw: 148.31, hazard: 'Oxidizer' },

    // ── 铝盐 ──
    '氯化铝': { formula: 'AlCl₃', mw: 133.34, hazard: 'Corrosive' },
    '硫酸铝': { formula: 'Al₂(SO₄)₃', mw: 342.15, hazard: 'Safe' },
    '硝酸铝': { formula: 'Al(NO₃)₃', mw: 212.99, hazard: 'Oxidizer' },
    '氧化铝': { formula: 'Al₂O₃', mw: 101.96, hazard: 'Safe' },
    '氢氧化铝': { formula: 'Al(OH)₃', mw: 78.00, hazard: 'Safe' },

    // ── 银盐 ──
    '硝酸银': { formula: 'AgNO₃', mw: 169.87, hazard: 'Corrosive' },
    '氯化银': { formula: 'AgCl', mw: 143.32, hazard: 'Safe' },

    // ── 钡盐 ──
    '氯化钡': { formula: 'BaCl₂', mw: 208.23, hazard: 'Toxic' },
    '硫酸钡': { formula: 'BaSO₄', mw: 233.39, hazard: 'Safe' },
    '硝酸钡': { formula: 'Ba(NO₃)₂', mw: 261.34, hazard: 'Toxic' },
    '碳酸钡': { formula: 'BaCO₃', mw: 197.34, hazard: 'Toxic' },

    // ── 锰盐 ──
    '二氧化锰': { formula: 'MnO₂', mw: 86.94, hazard: 'Oxidizer' },
    '氯化锰': { formula: 'MnCl₂', mw: 125.84, hazard: 'Safe' },
    '硫酸锰': { formula: 'MnSO₄', mw: 151.00, hazard: 'Safe' },

    // ── 钴/镍盐 ──
    '氯化钴': { formula: 'CoCl₂', mw: 129.84, hazard: 'Toxic' },
    '硫酸钴': { formula: 'CoSO₄', mw: 155.00, hazard: 'Toxic' },
    '硝酸钴': { formula: 'Co(NO₃)₂', mw: 182.94, hazard: 'Toxic' },
    '氯化镍': { formula: 'NiCl₂', mw: 129.60, hazard: 'Toxic' },
    '硫酸镍': { formula: 'NiSO₄', mw: 154.75, hazard: 'Toxic' },
    '硝酸镍': { formula: 'Ni(NO₃)₂', mw: 182.70, hazard: 'Toxic' },

    // ── 铅/锡盐 ──
    '硝酸铅': { formula: 'Pb(NO₃)₂', mw: 331.21, hazard: 'Toxic' },
    '醋酸铅': { formula: 'Pb(CH₃COO)₂', mw: 325.29, hazard: 'Toxic' },
    '氯化锡': { formula: 'SnCl₂', mw: 189.60, hazard: 'Corrosive' },
    '四氯化锡': { formula: 'SnCl₄', mw: 260.52, hazard: 'Corrosive' },

    // ── 铬盐 ──
    '氯化铬': { formula: 'CrCl₃', mw: 158.36, hazard: 'Safe' },
    '硫酸铬': { formula: 'Cr₂(SO₄)₃', mw: 392.16, hazard: 'Safe' },
    '三氧化铬': { formula: 'CrO₃', mw: 99.99, hazard: 'Toxic' },

    // ── 钛/锆盐 ──
    '四氯化钛': { formula: 'TiCl₄', mw: 189.68, hazard: 'Corrosive' },
    '二氧化钛': { formula: 'TiO₂', mw: 79.87, hazard: 'Safe' },
    '钛酸四丁酯': { formula: 'Ti(OC₄H₉)₄', mw: 340.32, hazard: 'Flammable' },
    '氧氯化锆': { formula: 'ZrOCl₂', mw: 178.13, hazard: 'Corrosive' },

    // ── 稀土盐 ──
    '硝酸铈': { formula: 'Ce(NO₃)₃', mw: 326.13, hazard: 'Oxidizer' },
    '硝酸镧': { formula: 'La(NO₃)₃', mw: 324.92, hazard: 'Oxidizer' },
    '氯化铈': { formula: 'CeCl₃', mw: 246.47, hazard: 'Safe' },

    // ── 常用酸（多数为腐蚀性危化品） ──
    '盐酸': { formula: 'HCl', mw: 36.46, hazard: 'Corrosive' },
    '硫酸': { formula: 'H₂SO₄', mw: 98.08, hazard: 'Corrosive' },
    '硝酸': { formula: 'HNO₃', mw: 63.01, hazard: 'Corrosive' },
    '磷酸': { formula: 'H₃PO₄', mw: 98.00, hazard: 'Corrosive' },
    '醋酸': { formula: 'CH₃COOH', mw: 60.05, hazard: 'Corrosive' },
    '冰醋酸': { formula: 'CH₃COOH', mw: 60.05, hazard: 'Corrosive' },
    '乙酸': { formula: 'CH₃COOH', mw: 60.05, hazard: 'Corrosive' },
    '草酸': { formula: 'H₂C₂O₄', mw: 90.03, hazard: 'Toxic' },
    '柠檬酸': { formula: 'C₆H₈O₇', mw: 192.12, hazard: 'Safe' },
    '甲酸': { formula: 'HCOOH', mw: 46.03, hazard: 'Corrosive' },
    '氢氟酸': { formula: 'HF', mw: 20.01, hazard: 'Toxic' },
    '高氯酸': { formula: 'HClO₄', mw: 100.46, hazard: 'Corrosive' },
    '硼酸': { formula: 'H₃BO₃', mw: 61.83, hazard: 'Safe' },
    '酒石酸': { formula: 'C₄H₆O₆', mw: 150.09, hazard: 'Safe' },
    '丙烯酸': { formula: 'CH₂=CHCOOH', mw: 72.06, hazard: 'Corrosive' },
    '苯甲酸': { formula: 'C₆H₅COOH', mw: 122.12, hazard: 'Safe' },
    '水杨酸': { formula: 'C₇H₆O₃', mw: 138.12, hazard: 'Safe' },
    '油酸': { formula: 'C₁₈H₃₄O₂', mw: 282.46, hazard: 'Safe' },
    '硬脂酸': { formula: 'C₁₈H₃₆O₂', mw: 284.48, hazard: 'Safe' },
    '王水': { formula: 'HNO₃+3HCl', mw: 0, hazard: 'Corrosive' },

    // ── 常用碱/氧化物 ──
    '氨水': { formula: 'NH₃·H₂O', mw: 35.05, hazard: 'Corrosive' },
    '双氧水': { formula: 'H₂O₂', mw: 34.01, hazard: 'Oxidizer' },
    '过氧化氢': { formula: 'H₂O₂', mw: 34.01, hazard: 'Oxidizer' },

    // ── 有机溶剂（多数为易燃危化品） ──
    '乙醇': { formula: 'C₂H₅OH', mw: 46.07, hazard: 'Flammable' },
    '无水乙醇': { formula: 'C₂H₅OH', mw: 46.07, hazard: 'Flammable' },
    '甲醇': { formula: 'CH₃OH', mw: 32.04, hazard: 'Flammable' },
    '丙酮': { formula: 'CH₃COCH₃', mw: 58.08, hazard: 'Flammable' },
    '异丙醇': { formula: 'C₃H₈O', mw: 60.10, hazard: 'Flammable' },
    '正丁醇': { formula: 'C₄H₉OH', mw: 74.12, hazard: 'Flammable' },
    '乙醚': { formula: '(C₂H₅)₂O', mw: 74.12, hazard: 'Flammable' },
    '乙酸乙酯': { formula: 'CH₃COOC₂H₅', mw: 88.11, hazard: 'Flammable' },
    '二氯甲烷': { formula: 'CH₂Cl₂', mw: 84.93, hazard: 'Toxic' },
    '三氯甲烷': { formula: 'CHCl₃', mw: 119.38, hazard: 'Toxic' },
    '氯仿': { formula: 'CHCl₃', mw: 119.38, hazard: 'Toxic' },
    '四氯化碳': { formula: 'CCl₄', mw: 153.82, hazard: 'Toxic' },
    '二甲基亚砜': { formula: '(CH₃)₂SO', mw: 78.13, hazard: 'Safe' },
    'DMSO': { formula: '(CH₃)₂SO', mw: 78.13, hazard: 'Safe' },
    '二甲基甲酰胺': { formula: '(CH₃)₂NCHO', mw: 73.09, hazard: 'Toxic' },
    'DMF': { formula: '(CH₃)₂NCHO', mw: 73.09, hazard: 'Toxic' },
    '甲苯': { formula: 'C₆H₅CH₃', mw: 92.14, hazard: 'Flammable' },
    '苯': { formula: 'C₆H₆', mw: 78.11, hazard: 'Flammable' },
    '二甲苯': { formula: 'C₈H₁₀', mw: 106.17, hazard: 'Flammable' },
    '正己烷': { formula: 'C₆H₁₄', mw: 86.18, hazard: 'Flammable' },
    '石油醚': { formula: 'C₅-C₈混合烃', mw: 80.00, hazard: 'Flammable' },
    '环己烷': { formula: 'C₆H₁₂', mw: 84.16, hazard: 'Flammable' },
    '四氢呋喃': { formula: 'C₄H₈O', mw: 72.11, hazard: 'Flammable' },
    'THF': { formula: 'C₄H₈O', mw: 72.11, hazard: 'Flammable' },
    'N-甲基吡咯烷酮': { formula: 'C₅H₉NO', mw: 99.13, hazard: 'Safe' },
    'NMP': { formula: 'C₅H₉NO', mw: 99.13, hazard: 'Safe' },
    '乙二醇': { formula: 'C₂H₆O₂', mw: 62.07, hazard: 'Toxic' },
    '丙三醇': { formula: 'C₃H₈O₃', mw: 92.09, hazard: 'Safe' },
    '甘油': { formula: 'C₃H₈O₃', mw: 92.09, hazard: 'Safe' },
    '乙腈': { formula: 'CH₃CN', mw: 41.05, hazard: 'Flammable' },

    // ── 常用有机试剂 ──
    '尿素': { formula: 'CO(NH₂)₂', mw: 60.06, hazard: 'Safe' },
    '甲醛': { formula: 'HCHO', mw: 30.03, hazard: 'Toxic' },
    '乙醛': { formula: 'CH₃CHO', mw: 44.05, hazard: 'Flammable' },
    '葡萄糖': { formula: 'C₆H₁₂O₆', mw: 180.16, hazard: 'Safe' },
    '蔗糖': { formula: 'C₁₂H₂₂O₁₁', mw: 342.30, hazard: 'Safe' },
    '淀粉': { formula: '(C₆H₁₀O₅)ₙ', mw: 162.14, hazard: 'Safe' },
    'EDTA': { formula: 'C₁₀H₁₆N₂O₈', mw: 292.24, hazard: 'Safe' },
    'EDTA二钠': { formula: 'C₁₀H₁₄N₂Na₂O₈', mw: 336.21, hazard: 'Safe' },
    '乙二胺四乙酸二钠': { formula: 'C₁₀H₁₄N₂Na₂O₈', mw: 336.21, hazard: 'Safe' },
    '三乙醇胺': { formula: 'N(CH₂CH₂OH)₃', mw: 149.19, hazard: 'Safe' },
    '聚乙二醇': { formula: 'HO(CH₂CH₂O)ₙH', mw: 400.00, hazard: 'Safe' },
    'PEG': { formula: 'HO(CH₂CH₂O)ₙH', mw: 400.00, hazard: 'Safe' },
    '聚乙烯吡咯烷酮': { formula: '(C₆H₉NO)ₙ', mw: 40000.00, hazard: 'Safe' },
    'PVP': { formula: '(C₆H₉NO)ₙ', mw: 40000.00, hazard: 'Safe' },
    '十六烷基三甲基溴化铵': { formula: 'C₁₉H₄₂BrN', mw: 364.45, hazard: 'Safe' },
    'CTAB': { formula: 'C₁₉H₄₂BrN', mw: 364.45, hazard: 'Safe' },
    '十二烷基硫酸钠': { formula: 'C₁₂H₂₅NaO₄S', mw: 288.38, hazard: 'Safe' },
    'SDS': { formula: 'C₁₂H₂₅NaO₄S', mw: 288.38, hazard: 'Safe' },
    '正硅酸乙酯': { formula: 'Si(OC₂H₅)₄', mw: 208.33, hazard: 'Flammable' },
    'TEOS': { formula: 'Si(OC₂H₅)₄', mw: 208.33, hazard: 'Flammable' },

    // ── 指示剂/染料 ──
    '酚酞': { formula: 'C₂₀H₁₄O₄', mw: 318.32, hazard: 'Safe' },
    '甲基橙': { formula: 'C₁₄H₁₄N₃NaO₃S', mw: 327.34, hazard: 'Safe' },
    '甲基红': { formula: 'C₁₅H₁₅N₃O₂', mw: 269.30, hazard: 'Safe' },
    '石蕊': { formula: 'C₇H₇NO₄', mw: 169.14, hazard: 'Safe' },
    '溴麝香草酚蓝': { formula: 'C₂₇H₂₈Br₂O₅S', mw: 624.38, hazard: 'Safe' },

    // ── 其他常用 ──
    '活性炭': { formula: 'C', mw: 12.01, hazard: 'Safe' },
    '硅胶': { formula: 'SiO₂·xH₂O', mw: 60.08, hazard: 'Safe' },
    '分子筛': { formula: 'Na₂O·Al₂O₃·xSiO₂·yH₂O', mw: 0, hazard: 'Safe' },
    '氯化铵': { formula: 'NH₄Cl', mw: 53.49, hazard: 'Safe' },
    '硫酸铵': { formula: '(NH₄)₂SO₄', mw: 132.14, hazard: 'Safe' },
    '硝酸铵': { formula: 'NH₄NO₃', mw: 80.04, hazard: 'Explosive' },
    '碳酸铵': { formula: '(NH₄)₂CO₃', mw: 96.09, hazard: 'Safe' },
    '草酸铵': { formula: '(NH₄)₂C₂O₄', mw: 124.10, hazard: 'Toxic' },
    '醋酸铵': { formula: 'CH₃COONH₄', mw: 77.08, hazard: 'Safe' },
    '氟化铵': { formula: 'NH₄F', mw: 37.04, hazard: 'Toxic' },
    '水合肼': { formula: 'N₂H₄·H₂O', mw: 50.06, hazard: 'Toxic' },
    '肼': { formula: 'N₂H₄', mw: 32.05, hazard: 'Toxic' },

    // ══ 用户库存批量补齐 ══

    // ── 铜 ──
    '氯化亚铜': { formula: 'CuCl', mw: 99.00, hazard: 'Toxic' },
    '硫氰酸亚铜': { formula: 'CuSCN', mw: 121.63, hazard: 'Safe' },
    '碘化亚铜': { formula: 'CuI', mw: 190.45, hazard: 'Safe' },
    '铜粉': { formula: 'Cu', mw: 63.55, hazard: 'Safe' },
    // ── 铯 ──
    '氯化铯': { formula: 'CsCl', mw: 168.36, hazard: 'Safe' },
    '碳酸铯': { formula: 'Cs₂CO₃', mw: 325.82, hazard: 'Safe' },
    '氟化铯': { formula: 'CsF', mw: 151.90, hazard: 'Toxic' },
    '三碘化铯': { formula: 'CsI₃', mw: 513.62, hazard: 'Safe' },
    '甲磺酸铯': { formula: 'CsCH₃SO₃', mw: 228.00, hazard: 'Safe' },
    '碘化铯': { formula: 'CsI', mw: 259.81, hazard: 'Safe' },
    '碘化铯CsI': { formula: 'CsI', mw: 259.81, hazard: 'Safe' },
    '溴化铯CsBr': { formula: 'CsBr', mw: 212.81, hazard: 'Safe' },
    'CsBr': { formula: 'CsBr', mw: 212.81, hazard: 'Safe' },
    '氯化铯CsCl': { formula: 'CsCl', mw: 168.36, hazard: 'Safe' },
    '氯化铯 CsCl': { formula: 'CsCl', mw: 168.36, hazard: 'Safe' },
    '双(三氟甲基磺酰基)酰亚胺铯(I)': { formula: 'CsTFSI', mw: 413.00, hazard: 'Safe' },
    // ── 铁补充 ──
    '碳酸亚铁': { formula: 'FeCO₃', mw: 115.85, hazard: 'Safe' },
    '三氧化二铁': { formula: 'Fe₂O₃', mw: 159.69, hazard: 'Safe' },
    '还原铁粉': { formula: 'Fe', mw: 55.85, hazard: 'Flammable' },
    '亚铁氰化钾': { formula: 'K₄[Fe(CN)₆]', mw: 368.35, hazard: 'Safe' },
    '亚铁氰化钾三水合物': { formula: 'K₄[Fe(CN)₆]·3H₂O', mw: 422.39, hazard: 'Safe' },
    // ── 铟/镍/锡/锆/铬 ──
    '五水氯化铟': { formula: 'InCl₃·5H₂O', mw: 311.24, hazard: 'Corrosive' },
    '溴化镍水合物': { formula: 'NiBr₂·xH₂O', mw: 218.50, hazard: 'Toxic' },
    '碳酸镍': { formula: 'NiCO₃', mw: 118.70, hazard: 'Toxic' },
    '碱式碳酸镍': { formula: '2NiCO₃·3Ni(OH)₂', mw: 587.68, hazard: 'Toxic' },
    '氧化镍': { formula: 'NiO', mw: 74.69, hazard: 'Toxic' },
    '氧化镍 NiOx': { formula: 'NiO', mw: 74.69, hazard: 'Toxic' },
    '锡粉': { formula: 'Sn', mw: 118.71, hazard: 'Safe' },
    '二水合氯化亚锡': { formula: 'SnCl₂·2H₂O', mw: 225.63, hazard: 'Corrosive' },
    '二硫化锡': { formula: 'SnS₂', mw: 182.84, hazard: 'Safe' },
    '纳米二氧化锡': { formula: 'SnO₂', mw: 150.71, hazard: 'Safe' },
    '二氧化锡': { formula: 'SnO₂', mw: 150.71, hazard: 'Safe' },
    '锡酸钠，三水合物': { formula: 'Na₂SnO₃·3H₂O', mw: 266.73, hazard: 'Safe' },
    '二氧化锆': { formula: 'ZrO₂', mw: 123.22, hazard: 'Safe' },
    '铬黑T': { formula: 'C₂₀H₁₂N₃NaO₇S', mw: 461.38, hazard: 'Safe' },
    '三氧化二铬': { formula: 'Cr₂O₃', mw: 151.99, hazard: 'Safe' },
    // ── 钨 ──
    '钨粉': { formula: 'W', mw: 183.84, hazard: 'Flammable' },
    '三氧化钨': { formula: 'WO₃', mw: 231.84, hazard: 'Safe' },
    '六氯化钨': { formula: 'WCl₆', mw: 396.56, hazard: 'Corrosive' },
    '六氯化钨(冰箱)': { formula: 'WCl₆', mw: 396.56, hazard: 'Corrosive' },
    // ── 稀土/钴/锰 ──
    '氧化镧': { formula: 'La₂O₃', mw: 325.81, hazard: 'Safe' },
    '四氧化三钴': { formula: 'Co₃O₄', mw: 240.80, hazard: 'Toxic' },
    '一氧化钴': { formula: 'CoO', mw: 74.93, hazard: 'Toxic' },
    '碳酸钴': { formula: 'CoCO₃', mw: 118.94, hazard: 'Toxic' },
    '钴酸锂': { formula: 'LiCoO₂', mw: 97.87, hazard: 'Safe' },
    '碳酸锰': { formula: 'MnCO₃', mw: 114.95, hazard: 'Safe' },
    '一氧化锰': { formula: 'MnO', mw: 70.94, hazard: 'Safe' },
    '三氧化二锰': { formula: 'Mn₂O₃', mw: 157.87, hazard: 'Safe' },
    '四氧化三锰': { formula: 'Mn₃O₄', mw: 228.81, hazard: 'Safe' },
    '氧化铈': { formula: 'CeO₂', mw: 172.11, hazard: 'Safe' },
    // ── 铋/钽/铌/钼/锑/钒 ──
    '氧化铋': { formula: 'Bi₂O₃', mw: 465.96, hazard: 'Safe' },
    '氯化铋': { formula: 'BiCl₃', mw: 315.34, hazard: 'Corrosive' },
    '氧化钽': { formula: 'Ta₂O₅', mw: 441.89, hazard: 'Safe' },
    '五氯化钽，无水': { formula: 'TaCl₅', mw: 358.21, hazard: 'Corrosive' },
    '五氧化二铌': { formula: 'Nb₂O₅', mw: 265.81, hazard: 'Safe' },
    '五氯化铌': { formula: 'NbCl₅', mw: 270.17, hazard: 'Corrosive' },
    '乙氧基铌': { formula: 'Nb(OC₂H₅)₅', mw: 318.21, hazard: 'Flammable' },
    '三氧化钼': { formula: 'MoO₃', mw: 143.94, hazard: 'Safe' },
    '五氯化钼': { formula: 'MoCl₅', mw: 273.21, hazard: 'Corrosive' },
    '三氯化锑': { formula: 'SbCl₃', mw: 228.11, hazard: 'Corrosive' },
    '五氧化二钒': { formula: 'V₂O₅', mw: 181.88, hazard: 'Toxic' },
    // ── 贵金属 ──
    '氯铂酸': { formula: 'H₂PtCl₆', mw: 409.82, hazard: 'Corrosive' },
    '氯铂酸，六水合物': { formula: 'H₂PtCl₆·6H₂O', mw: 517.90, hazard: 'Corrosive' },
    '氯铂酸六水合物': { formula: 'H₂PtCl₆·6H₂O', mw: 517.90, hazard: 'Corrosive' },
    '氯化金三水合物': { formula: 'HAuCl₄·3H₂O', mw: 393.83, hazard: 'Corrosive' },
    '四氯化铱水合物': { formula: 'IrCl₄·xH₂O', mw: 334.03, hazard: 'Corrosive' },
    '三氯化钌水合物': { formula: 'RuCl₃·xH₂O', mw: 207.43, hazard: 'Corrosive' },
    '水合三氯化钌': { formula: 'RuCl₃·xH₂O', mw: 207.43, hazard: 'Corrosive' },
    '氯铱酸水合物': { formula: 'H₂IrCl₆·xH₂O', mw: 424.93, hazard: 'Corrosive' },
    '六氯铱酸水合物': { formula: 'H₂IrCl₆·xH₂O', mw: 424.93, hazard: 'Corrosive' },
    '六氯铱酸钾': { formula: 'K₂IrCl₆', mw: 483.13, hazard: 'Safe' },
    '氯化钯': { formula: 'PdCl₂', mw: 177.33, hazard: 'Toxic' },
    '氯化铒，六水合物': { formula: 'ErCl₃·6H₂O', mw: 381.71, hazard: 'Safe' },
    '氰化亚金钾': { formula: 'KAu(CN)₂', mw: 288.10, hazard: 'Toxic' },
    '银粉': { formula: 'Ag', mw: 107.87, hazard: 'Safe' },
    '银粉（球形）': { formula: 'Ag', mw: 107.87, hazard: 'Safe' },
    // ── 锂化合物 ──
    '无水氯化锂': { formula: 'LiCl', mw: 42.39, hazard: 'Safe' },
    '氯化锂': { formula: 'LiCl', mw: 42.39, hazard: 'Safe' },
    '氯化锂-无水': { formula: 'LiCl', mw: 42.39, hazard: 'Safe' },
    '氢氧化锂，一水合物': { formula: 'LiOH·H₂O', mw: 41.96, hazard: 'Corrosive' },
    '无水氢氧化锂': { formula: 'LiOH', mw: 23.95, hazard: 'Corrosive' },
    '氢氧化锂': { formula: 'LiOH', mw: 23.95, hazard: 'Corrosive' },
    '氧化锂': { formula: 'Li₂O', mw: 29.88, hazard: 'Corrosive' },
    '碳酸锂': { formula: 'Li₂CO₃', mw: 73.89, hazard: 'Safe' },
    '无水碘化锂': { formula: 'LiI', mw: 133.85, hazard: 'Safe' },
    '溴化锂': { formula: 'LiBr', mw: 86.84, hazard: 'Safe' },
    '氟化锂': { formula: 'LiF', mw: 25.94, hazard: 'Toxic' },
    '硫化锂': { formula: 'Li₂S', mw: 45.95, hazard: 'Flammable' },
    '五硫化二磷': { formula: 'P₂S₅', mw: 222.27, hazard: 'Flammable' },
    '硼氢化钠': { formula: 'NaBH₄', mw: 37.83, hazard: 'Flammable' },
    '硫氰酸钠': { formula: 'NaSCN', mw: 81.07, hazard: 'Toxic' },
    '氰酸钠': { formula: 'NaOCN', mw: 65.01, hazard: 'Toxic' },
    '双三氟甲烷磺酰亚胺锂': { formula: 'LiTFSI', mw: 287.09, hazard: 'Corrosive' },
    'LiTFSi': { formula: 'LiTFSI', mw: 287.09, hazard: 'Corrosive' },
    'Li-TFSI': { formula: 'LiTFSI', mw: 287.09, hazard: 'Corrosive' },
    '双（氟磺酰）亚胺锂(LiFSI)': { formula: 'LiFSI', mw: 187.07, hazard: 'Corrosive' },
    // ── 铅化合物 ──
    '溴化铅': { formula: 'PbBr₂', mw: 367.01, hazard: 'Toxic' },
    '溴化铅PbBr2': { formula: 'PbBr₂', mw: 367.01, hazard: 'Toxic' },
    '氯化铅': { formula: 'PbCl₂', mw: 278.11, hazard: 'Toxic' },
    '氯化铅PbCl2': { formula: 'PbCl₂', mw: 278.11, hazard: 'Toxic' },
    '碘化铅 PbI2': { formula: 'PbI₂', mw: 461.01, hazard: 'Toxic' },
    '碳酸铅': { formula: 'PbCO₃', mw: 267.21, hazard: 'Toxic' },
    '硫氰酸铅 PbSCN2': { formula: 'Pb(SCN)₂', mw: 323.37, hazard: 'Toxic' },
    // ── 钙钛矿前驱体 ──
    'FAI': { formula: 'CH₅N₂I', mw: 171.97, hazard: 'Safe' },
    'FACl': { formula: 'CH₅N₂Cl', mw: 80.52, hazard: 'Safe' },
    'MACl': { formula: 'CH₃NH₃Cl', mw: 67.52, hazard: 'Safe' },
    '甲基溴化铵 MABr': { formula: 'CH₃NH₃Br', mw: 111.97, hazard: 'Safe' },
    '甲基溴铵MABr': { formula: 'CH₃NH₃Br', mw: 111.97, hazard: 'Safe' },
    '甲基碘化铵': { formula: 'CH₃NH₃I', mw: 158.97, hazard: 'Safe' },
    '甲脒氢碘酸盐': { formula: 'CH₅N₂I', mw: 171.97, hazard: 'Safe' },
    '甲脒氢溴酸盐': { formula: 'CH₅N₂Br', mw: 124.97, hazard: 'Safe' },
    '甲胺氢溴酸盐': { formula: 'CH₃NH₃Br', mw: 111.97, hazard: 'Safe' },
    '四甲基溴化铵': { formula: '(CH₃)₄NBr', mw: 154.05, hazard: 'Safe' },
    '胍基氢碘酸盐': { formula: 'CH₆N₃I', mw: 186.98, hazard: 'Safe' },
    '正辛基碘化铵': { formula: 'C₈H₁₈NI', mw: 271.14, hazard: 'Safe' },
    '丁基碘化胺': { formula: 'C₄H₁₀NI', mw: 215.03, hazard: 'Safe' },
    '异丁铵氢溴酸盐': { formula: '(CH₃)₂CHCH₂NH₃Br', mw: 154.03, hazard: 'Safe' },
    '哌嗪二氢碘酸盐': { formula: 'C₄H₁₂N₂I₂', mw: 341.96, hazard: 'Safe' },
    '哌嗪单碘': { formula: 'C₄H₁₁N₂I', mw: 214.05, hazard: 'Safe' },
    '1-4-丁二胺氢碘酸盐': { formula: 'C₄H₁₃N₂I', mw: 216.06, hazard: 'Safe' },
    '2-氨基-4,5-二甲基噻唑氢碘酸盐': { formula: 'C₅H₉N₂SI', mw: 256.11, hazard: 'Safe' },
    'β-丙氨酸氢碘酸盐': { formula: 'C₃H₈NO₂I', mw: 217.00, hazard: 'Safe' },
    '油胺碘 9-十八烯基碘化铵': { formula: 'C₁₈H₃₈NI', mw: 395.41, hazard: 'Safe' },
    '油胺溴Oambr': { formula: 'C₁₈H₃₈NBr', mw: 348.41, hazard: 'Safe' },
    '油胺氢碘酸盐': { formula: 'C₁₈H₃₈NI', mw: 395.41, hazard: 'Safe' },
    // ── 钙钛矿成品/传输层 ──
    'FAPbBr3': { formula: 'CH₅N₂PbBr₃', mw: 538.98, hazard: 'Toxic' },
    'MAPbBr3': { formula: 'CH₃NH₃PbBr₃', mw: 478.98, hazard: 'Toxic' },
    'CsPbBr3': { formula: 'CsPbBr₃', mw: 579.82, hazard: 'Toxic' },
    'FAPbI3': { formula: 'CH₅N₂PbI₃', mw: 632.98, hazard: 'Toxic' },
    'MAPbI3': { formula: 'CH₃NH₃PbI₃', mw: 619.98, hazard: 'Toxic' },
    'CsPbI3': { formula: 'CsPbI₃', mw: 720.82, hazard: 'Toxic' },
    'Spiro-MeOTAD': { formula: 'C₈₁H₆₈N₄O₈', mw: 1225.43, hazard: 'Safe' },
    'C60': { formula: 'C₆₀', mw: 720.66, hazard: 'Safe' },
    'PC60BM': { formula: 'C₇₂H₁₄O₂', mw: 910.88, hazard: 'Safe' },
    'PC61BM': { formula: 'C₇₂H₁₄O₂', mw: 910.88, hazard: 'Safe' },
    'PEDOT：PSS': { formula: 'PEDOT:PSS', mw: 0, hazard: 'Safe' },
    '2PACz': { formula: 'C₁₄H₁₄NO₃P', mw: 275.24, hazard: 'Safe' },
    'Me-4PACz': { formula: 'C₁₅H₁₆NO₃P', mw: 289.27, hazard: 'Safe' },
    'ME-4-PACZ': { formula: 'C₁₅H₁₆NO₃P', mw: 289.27, hazard: 'Safe' },
    'MeO-2PACz': { formula: 'C₁₆H₁₈NO₄P', mw: 319.29, hazard: 'Safe' },
    '[2-(9H-咔唑-9-基)乙基]膦酸': { formula: 'C₁₄H₁₄NO₃P', mw: 275.24, hazard: 'Safe' },
    '[2-(3,6-二甲基-9H-咔唑-9-基)丁基]膦酸': { formula: 'C₁₈H₂₂NO₃P', mw: 331.35, hazard: 'Safe' },
    '[2-(3,6-二甲氧基-9H-咔唑-9-基)乙基]膦酸': { formula: 'C₁₆H₁₈NO₅P', mw: 335.29, hazard: 'Safe' },
    'TBP': { formula: 'C₉H₁₃N', mw: 135.21, hazard: 'Safe' },
    '四叔丁基吡啶': { formula: 'C₉H₁₃N', mw: 135.21, hazard: 'Safe' },
    // ── 有机试剂补充 ──
    '2-甲基咪唑': { formula: 'C₄H₆N₂', mw: 82.10, hazard: 'Corrosive' },
    '三聚氰胺': { formula: 'C₃H₆N₆', mw: 126.12, hazard: 'Safe' },
    '硫脲': { formula: 'CH₄N₂S', mw: 76.12, hazard: 'Toxic' },
    '二氰二胺': { formula: 'C₂H₄N₄', mw: 84.08, hazard: 'Safe' },
    '糖精': { formula: 'C₇H₅NO₃S', mw: 183.18, hazard: 'Safe' },
    '糖精钠': { formula: 'C₇H₄NNaO₃S', mw: 205.17, hazard: 'Safe' },
    '正丙醇': { formula: 'C₃H₇OH', mw: 60.10, hazard: 'Flammable' },
    '三甘醇': { formula: 'C₆H₁₄O₄', mw: 150.17, hazard: 'Safe' },
    '三乙胺': { formula: 'N(C₂H₅)₃', mw: 101.19, hazard: 'Flammable' },
    '十二胺': { formula: 'C₁₂H₂₇N', mw: 185.35, hazard: 'Safe' },
    '十四胺（Tetradecylamin)': { formula: 'C₁₄H₃₁N', mw: 213.40, hazard: 'Safe' },
    '氯化羟胺': { formula: 'NH₂OH·HCl', mw: 69.49, hazard: 'Toxic' },
    '脒基硫脲': { formula: 'CH₆N₄S', mw: 118.16, hazard: 'Toxic' },
    '2-氨基噻唑': { formula: 'C₃H₄N₂S', mw: 100.14, hazard: 'Safe' },
    '2,2-联吡啶': { formula: 'C₁₀H₈N₂', mw: 156.18, hazard: 'Toxic' },
    '4,4-二壬基-2,2联吡啶': { formula: 'C₂₈H₄₄N₂', mw: 424.66, hazard: 'Safe' },
    '2-巯基吡啶': { formula: 'C₅H₅NS', mw: 111.17, hazard: 'Toxic' },
    '3-巯基丙酸': { formula: 'C₃H₆O₂S', mw: 106.14, hazard: 'Corrosive' },
    '3-吡啶磺酸': { formula: 'C₅H₅NO₃S', mw: 159.16, hazard: 'Safe' },
    '3-吡啶甲胺': { formula: 'C₆H₈N₂', mw: 108.14, hazard: 'Safe' },
    '硫代氨基脲': { formula: 'CH₅N₃S', mw: 91.13, hazard: 'Toxic' },
    'N-甲基-2-吡咯烷酮': { formula: 'C₅H₉NO', mw: 99.13, hazard: 'Safe' },
    '1-甲基-2-吡咯烷酮': { formula: 'C₅H₉NO', mw: 99.13, hazard: 'Safe' },
    'N，N-二甲基乙酰胺': { formula: 'C₄H₉NO', mw: 87.12, hazard: 'Toxic' },
    '甲脒亚磺酸': { formula: 'CH₄N₂O₂S', mw: 108.12, hazard: 'Safe' },
    '乙烯硫脲': { formula: 'C₃H₆N₂S', mw: 102.16, hazard: 'Toxic' },
    '硫代乙酰胺': { formula: 'CH₃CSNH₂', mw: 75.13, hazard: 'Toxic' },
    '咪唑烷基脲': { formula: 'C₁₁H₁₆N₈O₈', mw: 388.29, hazard: 'Safe' },
    '5,5-二甲基海因': { formula: 'C₅H₈N₂O₂', mw: 128.13, hazard: 'Safe' },
    '1，3-二甲基-2-咪唑啉酮': { formula: 'C₅H₈N₂O', mw: 112.13, hazard: 'Safe' },
    '偶氮二异丁腈': { formula: 'C₈H₁₂N₄', mw: 164.21, hazard: 'Flammable' },
    '二甲胺基甲硼烷': { formula: '(CH₃)₂NHBH₃', mw: 58.92, hazard: 'Flammable' },
    '正壬醛': { formula: 'C₉H₁₈O', mw: 142.24, hazard: 'Safe' },
    '乙烯基三乙氧基硅烷': { formula: 'CH₂=CHSi(OC₂H₅)₃', mw: 190.31, hazard: 'Flammable' },
    '乙烯基三甲氧基硅烷': { formula: 'CH₂=CHSi(OCH₃)₃', mw: 148.23, hazard: 'Flammable' },
    '3-氨丙基三乙氧基硅烷': { formula: 'H₂N(CH₂)₃Si(OC₂H₅)₃', mw: 221.37, hazard: 'Flammable' },
    '二甲亚砜': { formula: '(CH₃)₂SO', mw: 78.13, hazard: 'Safe' },
    '酞菁': { formula: 'C₃₂H₁₈N₈', mw: 514.54, hazard: 'Safe' },
    '15-冠醚-5': { formula: 'C₁₀H₂₀O₅', mw: 220.26, hazard: 'Toxic' },
    '18-冠醚-6': { formula: 'C₁₂H₂₄O₆', mw: 264.32, hazard: 'Toxic' },
    '浴铜灵': { formula: 'C₂₆H₁₈N₂', mw: 360.44, hazard: 'Safe' },
    '二甲酚橙': { formula: 'C₃₁H₃₂N₂O₁₃S', mw: 676.65, hazard: 'Safe' },
    '甲基紫': { formula: 'C₂₅H₃₀ClN₃', mw: 407.99, hazard: 'Toxic' },
    'L-组氨酸': { formula: 'C₆H₉N₃O₂', mw: 155.16, hazard: 'Safe' },
    'L-半胱氨酸': { formula: 'C₃H₇NO₂S', mw: 121.16, hazard: 'Safe' },
    'L-甲硫氨酸': { formula: 'C₅H₁₁NO₂S', mw: 149.21, hazard: 'Safe' },
    '胸腺嘧啶': { formula: 'C₅H₆N₂O₂', mw: 126.11, hazard: 'Safe' },
    '氢碘酸': { formula: 'HI', mw: 127.91, hazard: 'Corrosive' },
    '氢溴酸（HBr）': { formula: 'HBr', mw: 80.91, hazard: 'Corrosive' },
    // ── 钠盐补充 ──
    '碲酸钠': { formula: 'Na₂TeO₄', mw: 237.58, hazard: 'Toxic' },
    '氟铝酸钠': { formula: 'Na₃AlF₆', mw: 209.94, hazard: 'Toxic' },
    '次氯酸钠': { formula: 'NaClO', mw: 74.44, hazard: 'Corrosive' },
    '十二烷基磺酸钠': { formula: 'C₁₂H₂₅NaO₃S', mw: 272.38, hazard: 'Safe' },
    // ── 铵盐补充 ──
    '碳酸氢铵': { formula: 'NH₄HCO₃', mw: 79.06, hazard: 'Safe' },
    '四水合钼酸铵': { formula: '(NH₄)₆Mo₇O₂₄·4H₂O', mw: 1235.86, hazard: 'Safe' },
    '碘化铵': { formula: 'NH₄I', mw: 144.94, hazard: 'Safe' },
    '偏钨酸铵': { formula: '(NH₄)₆H₂W₁₂O₄₀', mw: 2956.30, hazard: 'Safe' },
    '己二酸铵': { formula: '(NH₄)₂C₆H₈O₄', mw: 180.20, hazard: 'Safe' },
    // ── 铷 ──
    '氟化铷': { formula: 'RbF', mw: 104.47, hazard: 'Toxic' },
    '碳酸铷': { formula: 'Rb₂CO₃', mw: 230.95, hazard: 'Safe' },
    '氯化铷': { formula: 'RbCl', mw: 120.92, hazard: 'Safe' },
    '碘化铷': { formula: 'RbI', mw: 212.37, hazard: 'Safe' },
    '氟化镁': { formula: 'MgF₂', mw: 62.30, hazard: 'Safe' },
    '二硫化锗': { formula: 'GeS₂', mw: 136.77, hazard: 'Toxic' },
    '无水氯化镓': { formula: 'GaCl₃', mw: 176.08, hazard: 'Corrosive' },
    // ── 高分子/聚合物 ──
    '聚丙烯腈': { formula: '(C₃H₃N)ₙ', mw: 0, hazard: 'Safe' },
    '纤维素粉': { formula: '(C₆H₁₀O₅)ₙ', mw: 0, hazard: 'Safe' },
    '聚乙烯醇': { formula: '(C₂H₄O)ₙ', mw: 0, hazard: 'Safe' },
    '聚偏二氟乙烯': { formula: '(CH₂CF₂)ₙ', mw: 0, hazard: 'Safe' },
    'PVDF900': { formula: '(CH₂CF₂)ₙ', mw: 0, hazard: 'Safe' },
    'PVDF5130': { formula: '(CH₂CF₂)ₙ', mw: 0, hazard: 'Safe' },
    '聚醚F127': { formula: 'PEO-PPO-PEO', mw: 12600, hazard: 'Safe' },
    '聚维酮 K30': { formula: '(C₆H₉NO)ₙ', mw: 50000, hazard: 'Safe' },
    '聚维酮 K25': { formula: '(C₆H₉NO)ₙ', mw: 35000, hazard: 'Safe' },
    '聚维酮 K90': { formula: '(C₆H₉NO)ₙ', mw: 360000, hazard: 'Safe' },
    '聚乙烯亚胺600': { formula: '(C₂H₅N)ₙ', mw: 600, hazard: 'Safe' },
    '聚乙烯亚胺1800': { formula: '(C₂H₅N)ₙ', mw: 1800, hazard: 'Safe' },
    '聚四氟乙烯粉末': { formula: '(C₂F₄)ₙ', mw: 0, hazard: 'Safe' },
    '聚丙烯酰胺': { formula: '(C₃H₅NO)ₙ', mw: 0, hazard: 'Safe' },
    '聚己内酯': { formula: '(C₆H₁₀O₂)ₙ', mw: 0, hazard: 'Safe' },
    '聚乙烯醇缩丁醛': { formula: 'PVB', mw: 0, hazard: 'Safe' },
    'PEO': { formula: '(CH₂CH₂O)ₙ', mw: 0, hazard: 'Safe' },
    'PAA-Li': { formula: '(C₃H₃O₂Li)ₙ', mw: 0, hazard: 'Safe' },
    '聚异丁烯': { formula: '(C₄H₈)ₙ', mw: 0, hazard: 'Safe' },
    // ── 表面活性剂/生物 ──
    '吐温-20': { formula: 'C₅₈H₁₁₄O₂₆', mw: 1227.54, hazard: 'Safe' },
    '明胶': { formula: '蛋白质', mw: 0, hazard: 'Safe' },
    '胶原蛋白': { formula: '蛋白质', mw: 0, hazard: 'Safe' },
    '卵磷脂': { formula: 'C₄₂H₈₀NO₈P', mw: 758.06, hazard: 'Safe' },
    '氯化胆碱': { formula: 'C₅H₁₄ClNO', mw: 139.62, hazard: 'Safe' },
    '考马斯亮蓝': { formula: 'C₄₅H₄₄N₃NaO₇S₂', mw: 825.97, hazard: 'Safe' },
    '健那绿B': { formula: 'C₃₀H₃₁ClN₆', mw: 511.06, hazard: 'Safe' },
    '十四烷基三甲基溴化胺': { formula: 'C₁₇H₃₈BrN', mw: 336.40, hazard: 'Safe' },
    '单宁酸': { formula: 'C₇₆H₅₂O₄₆', mw: 1701.20, hazard: 'Safe' },
    '油胺': { formula: 'C₁₈H₃₇N', mw: 267.49, hazard: 'Corrosive' },
    '阿拉伯树胶': { formula: '多糖', mw: 0, hazard: 'Safe' },
    // ── 膦酸 ──
    '羟基乙叉二膦酸': { formula: 'C₂H₈O₇P₂', mw: 206.03, hazard: 'Corrosive' },
    '羟基乙叉二膦酸钠': { formula: 'C₂H₅Na₃O₇P₂', mw: 272.00, hazard: 'Safe' },
    '乙二胺四甲叉膦酸': { formula: 'C₆H₂₀N₂O₁₂P₄', mw: 436.13, hazard: 'Corrosive' },
    '氨基三亚甲基膦酸': { formula: 'C₃H₁₂NO₉P₃', mw: 299.05, hazard: 'Corrosive' },
    '2-丙烯酰胺-2-甲基丙烷磺酸': { formula: 'C₇H₁₃NO₄S', mw: 207.25, hazard: 'Safe' },
    '3-巯基-1-丙烷磺酸钠': { formula: 'C₃H₇NaO₃S₂', mw: 178.21, hazard: 'Safe' },
    // ── VC ──
    'L（+）抗坏血酸': { formula: 'C₆H₈O₆', mw: 176.12, hazard: 'Safe' },
    '抗坏血酸': { formula: 'C₆H₈O₆', mw: 176.12, hazard: 'Safe' },
    'L-抗坏血酸（VC）': { formula: 'C₆H₈O₆', mw: 176.12, hazard: 'Safe' },
    // ── 单质/粉末 ──
    '高纯硼粉': { formula: 'B', mw: 10.81, hazard: 'Flammable' },
    '锌粉': { formula: 'Zn', mw: 65.38, hazard: 'Flammable' },
    '升华硫': { formula: 'S', mw: 32.07, hazard: 'Flammable' },
    '硫粉': { formula: 'S', mw: 32.07, hazard: 'Flammable' },
    '硫磺': { formula: 'S', mw: 32.07, hazard: 'Flammable' },
    '石墨': { formula: 'C', mw: 12.01, hazard: 'Safe' },
    '氢化钛粉': { formula: 'TiH₂', mw: 49.88, hazard: 'Flammable' },
    '科琴黑': { formula: 'C', mw: 12.01, hazard: 'Safe' },
    'super p': { formula: 'C', mw: 12.01, hazard: 'Safe' },
    // ── 电解液溶剂 ──
    '碳酸乙烯酯': { formula: 'C₃H₄O₃', mw: 88.06, hazard: 'Safe' },
    '碳酸乙烯酯(EC)': { formula: 'C₃H₄O₃', mw: 88.06, hazard: 'Safe' },
    '碳酸二乙酯(DEC)': { formula: 'C₅H₁₀O₃', mw: 118.13, hazard: 'Flammable' },
    '碳酸甲乙酯(EMC)': { formula: 'C₄H₈O₃', mw: 104.10, hazard: 'Flammable' },
    '碳酸丙烯酯(PC)': { formula: 'C₄H₆O₃', mw: 102.09, hazard: 'Safe' },
    '碳酸亚乙烯酯(VC)': { formula: 'C₃H₂O₃', mw: 86.05, hazard: 'Flammable' },
    '碳酸二甲酯(DMC)': { formula: 'C₃H₆O₃', mw: 90.08, hazard: 'Flammable' },
    '氟代碳酸乙烯酯(FEC)': { formula: 'C₃H₃FO₃', mw: 106.06, hazard: 'Safe' },
    '1,3-丙磺酸内酯(PS)': { formula: 'C₃H₆O₃S', mw: 122.14, hazard: 'Corrosive' },
    '丁酸甲酯(MB)': { formula: 'C₅H₁₀O₂', mw: 102.13, hazard: 'Flammable' },
    '三氟乙基甲基碳酸酯(FEMC)': { formula: 'C₃H₃F₃O₃', mw: 144.05, hazard: 'Flammable' },
    '异丁酸异丁酯': { formula: 'C₈H₁₆O₂', mw: 144.21, hazard: 'Flammable' },
    '丁酸己酯': { formula: 'C₁₀H₂₀O₂', mw: 172.26, hazard: 'Flammable' },
    '正十二烷': { formula: 'C₁₂H₂₆', mw: 170.33, hazard: 'Flammable' },
    '癸二酸二丁酯': { formula: 'C₁₈H₃₄O₄', mw: 314.46, hazard: 'Safe' },
    '1,2-丙二醇': { formula: 'C₃H₈O₂', mw: 76.09, hazard: 'Safe' },
    // ── 助剂/其他 ──
    '白凡士林': { formula: '混合烃', mw: 0, hazard: 'Safe' },
    'α-松油醇': { formula: 'C₁₀H₁₈O', mw: 154.25, hazard: 'Flammable' },
    '三丙二醇丁醚': { formula: 'C₁₃H₂₈O₄', mw: 248.36, hazard: 'Safe' },
    '月桂酸': { formula: 'C₁₂H₂₄O₂', mw: 200.32, hazard: 'Safe' },
    '松香': { formula: 'C₂₀H₃₀O₂', mw: 302.45, hazard: 'Safe' },
    '氢化蓖麻油': { formula: 'C₅₇H₁₁₀O₉', mw: 939.50, hazard: 'Safe' },
    '环氧树脂': { formula: '环氧树脂', mw: 0, hazard: 'Safe' },
    '双酚A型环氧树脂': { formula: 'C₂₁H₂₄O₄', mw: 340.42, hazard: 'Safe' },
    '羟乙基纤维素': { formula: 'HEC', mw: 0, hazard: 'Safe' },
    '乙基纤维素（STD100）': { formula: 'EC', mw: 0, hazard: 'Safe' },
    '乙基纤维素CP': { formula: 'EC', mw: 0, hazard: 'Safe' },
    '植酸溶液': { formula: 'C₆H₁₈O₂₄P₆', mw: 660.04, hazard: 'Corrosive' },
    '木质素（脱碱）': { formula: '木质素', mw: 0, hazard: 'Safe' },
    '纳米氮化钛': { formula: 'TiN', mw: 61.87, hazard: 'Safe' },
    '纳米氮化硅': { formula: 'Si₃N₄', mw: 140.28, hazard: 'Safe' },
    '氨基磺酸': { formula: 'H₃NO₃S', mw: 97.09, hazard: 'Corrosive' },
    '三聚硫氰酸': { formula: 'C₃H₃N₃S₃', mw: 177.27, hazard: 'Safe' },
    'N,N\'-亚甲基双丙烯酰胺': { formula: 'C₇H₁₀N₂O₂', mw: 154.17, hazard: 'Safe' },
    '1-丁基-3-甲基咪唑双三氟甲磺酰亚胺盐': { formula: 'C₁₀H₁₅F₆N₃O₄S₂', mw: 419.36, hazard: 'Safe' },
    '1-乙基-3-甲基咪唑双(三氟甲磺酰)亚胺': { formula: 'C₈H₁₁F₆N₃O₄S₂', mw: 391.31, hazard: 'Safe' },
    '1-丁基-1-甲基吡咯烷双三氟甲磺酰亚胺': { formula: 'C₁₁H₂₀F₆N₂O₄S₂', mw: 422.41, hazard: 'Safe' },
    '1-甲基-1-丙基吡咯烷双(三氟甲磺酰)亚胺盐': { formula: 'C₁₀H₁₈F₆N₂O₄S₂', mw: 408.38, hazard: 'Safe' },
    '氧化亚硅(碳包覆)': { formula: 'SiO/C', mw: 44.08, hazard: 'Safe' },
    '氧化亚硅（1400）': { formula: 'SiO', mw: 44.08, hazard: 'Safe' },
    'γ-氨丙基三乙氧基硅烷（KH-550）': { formula: 'H₂N(CH₂)₃Si(OC₂H₅)₃', mw: 221.37, hazard: 'Flammable' },
    'KH-570': { formula: 'CH₂=C(CH₃)COO(CH₂)₃Si(OCH₃)₃', mw: 248.35, hazard: 'Flammable' },
    '1-(2-吡啶偶氮)-2-萘酚': { formula: 'C₁₅H₁₁N₃O', mw: 249.27, hazard: 'Safe' },
    // ── 常见金属乙酸盐 ──
    '乙酸钴': { formula: 'Co(CH₃COO)₂', mw: 177.02, hazard: 'Toxic' },
    '乙酸钴四水': { formula: 'Co(CH₃COO)₂·4H₂O', mw: 249.08, hazard: 'Toxic' },
    '乙酸锰': { formula: 'Mn(CH₃COO)₂', mw: 173.03, hazard: 'Safe' },
    '乙酸锰四水': { formula: 'Mn(CH₃COO)₂·4H₂O', mw: 245.09, hazard: 'Safe' },
    '四水合乙酸锰': { formula: 'Mn(CH₃COO)₂·4H₂O', mw: 245.09, hazard: 'Safe' },
    '乙酸锌': { formula: 'Zn(CH₃COO)₂', mw: 183.48, hazard: 'Safe' },
    '乙酸锌二水': { formula: 'Zn(CH₃COO)₂·2H₂O', mw: 219.51, hazard: 'Safe' },
    '乙酸铜': { formula: 'Cu(CH₃COO)₂', mw: 181.63, hazard: 'Toxic' },
    '乙酸铜一水': { formula: 'Cu(CH₃COO)₂·H₂O', mw: 199.65, hazard: 'Toxic' },
    '乙酸镍': { formula: 'Ni(CH₃COO)₂', mw: 176.78, hazard: 'Toxic' },
    '乙酸镍四水': { formula: 'Ni(CH₃COO)₂·4H₂O', mw: 248.84, hazard: 'Toxic' },
    '乙酸铁': { formula: 'Fe(CH₃COO)₃', mw: 232.98, hazard: 'Safe' },
    '乙酸亚铁': { formula: 'Fe(CH₃COO)₂', mw: 173.93, hazard: 'Safe' },
    '乙酸铅': { formula: 'Pb(CH₃COO)₂', mw: 325.29, hazard: 'Toxic' },
    '乙酸铅三水': { formula: 'Pb(CH₃COO)₂·3H₂O', mw: 379.33, hazard: 'Toxic' },
    '乙酸铝': { formula: 'Al(CH₃COO)₃', mw: 204.11, hazard: 'Safe' },
    '乙酸钡': { formula: 'Ba(CH₃COO)₂', mw: 255.42, hazard: 'Toxic' },
    '乙酸铬': { formula: 'Cr(CH₃COO)₃', mw: 229.13, hazard: 'Safe' },
    '乙酸铟': { formula: 'In(CH₃COO)₃', mw: 291.95, hazard: 'Safe' },
    '乙酸锂': { formula: 'LiCH₃COO', mw: 65.99, hazard: 'Safe' },
    '醋酸钴': { formula: 'Co(CH₃COO)₂', mw: 177.02, hazard: 'Toxic' },
    '醋酸锰': { formula: 'Mn(CH₃COO)₂', mw: 173.03, hazard: 'Safe' },
    '醋酸镍': { formula: 'Ni(CH₃COO)₂', mw: 176.78, hazard: 'Toxic' },
    // ── 缺失的硫酸盐 ──
    '硫酸锂': { formula: 'Li₂SO₄', mw: 109.94, hazard: 'Safe' },
    '硫酸锂一水': { formula: 'Li₂SO₄·H₂O', mw: 127.96, hazard: 'Safe' },
    '硫酸钛': { formula: 'Ti(SO₄)₂', mw: 239.99, hazard: 'Corrosive' },
    '硫酸铈': { formula: 'Ce₂(SO₄)₃', mw: 568.42, hazard: 'Safe' },
    '硫酸铟': { formula: 'In₂(SO₄)₃', mw: 517.83, hazard: 'Safe' },
    '硫酸锶': { formula: 'SrSO₄', mw: 183.68, hazard: 'Safe' },
    // ── 常见硝酸盐补充 ──
    '硝酸钴六水': { formula: 'Co(NO₃)₂·6H₂O', mw: 291.03, hazard: 'Oxidizer' },
    '硝酸锰': { formula: 'Mn(NO₃)₂', mw: 178.95, hazard: 'Oxidizer' },
    '硝酸锰四水': { formula: 'Mn(NO₃)₂·4H₂O', mw: 251.01, hazard: 'Oxidizer' },
    '硝酸镍六水': { formula: 'Ni(NO₃)₂·6H₂O', mw: 290.79, hazard: 'Oxidizer' },
    '硝酸铜三水': { formula: 'Cu(NO₃)₂·3H₂O', mw: 241.60, hazard: 'Oxidizer' },
    '硝酸铁九水': { formula: 'Fe(NO₃)₃·9H₂O', mw: 404.00, hazard: 'Oxidizer' },
    '硝酸铝九水': { formula: 'Al(NO₃)₃·9H₂O', mw: 375.13, hazard: 'Oxidizer' },
    '硝酸锌六水': { formula: 'Zn(NO₃)₂·6H₂O', mw: 297.49, hazard: 'Oxidizer' },
    '硝酸铈六水': { formula: 'Ce(NO₃)₃·6H₂O', mw: 434.22, hazard: 'Oxidizer' },
    '硝酸镧六水': { formula: 'La(NO₃)₃·6H₂O', mw: 433.01, hazard: 'Oxidizer' },
    '硝酸铋': { formula: 'Bi(NO₃)₃', mw: 395.01, hazard: 'Oxidizer' },
    '硝酸铋五水': { formula: 'Bi(NO₃)₃·5H₂O', mw: 485.07, hazard: 'Oxidizer' },
    '硝酸锂': { formula: 'LiNO₃', mw: 68.95, hazard: 'Oxidizer' },
    // ── 氯化盐补充 ──
    '氯化钴六水': { formula: 'CoCl₂·6H₂O', mw: 237.93, hazard: 'Toxic' },
    '氯化锰四水': { formula: 'MnCl₂·4H₂O', mw: 197.91, hazard: 'Safe' },
    '氯化铁六水': { formula: 'FeCl₃·6H₂O', mw: 270.30, hazard: 'Corrosive' },
    '氯化亚铁四水': { formula: 'FeCl₂·4H₂O', mw: 198.81, hazard: 'Safe' },
    '氯化镍六水': { formula: 'NiCl₂·6H₂O', mw: 237.69, hazard: 'Toxic' },
    '氯化铝六水': { formula: 'AlCl₃·6H₂O', mw: 241.43, hazard: 'Corrosive' },
    '氯化铬六水': { formula: 'CrCl₃·6H₂O', mw: 266.45, hazard: 'Safe' },
    '氯化铜二水': { formula: 'CuCl₂·2H₂O', mw: 170.48, hazard: 'Toxic' },
    '氯化锶': { formula: 'SrCl₂', mw: 158.53, hazard: 'Safe' },
    '氯化铈七水': { formula: 'CeCl₃·7H₂O', mw: 372.58, hazard: 'Safe' },
    '氯化镧': { formula: 'LaCl₃', mw: 245.26, hazard: 'Safe' },
    '氯化镧七水': { formula: 'LaCl₃·7H₂O', mw: 371.37, hazard: 'Safe' },
    // ── 乙酸铊及其他遗漏盐 ──
    '乙酸铊': { formula: 'TlCH₃COO', mw: 263.43, hazard: 'Toxic' },
    '醋酸铊': { formula: 'TlCH₃COO', mw: 263.43, hazard: 'Toxic' },
    '乙酸银': { formula: 'AgCH₃COO', mw: 166.91, hazard: 'Safe' },
    '乙酸镁': { formula: 'Mg(CH₃COO)₂', mw: 142.39, hazard: 'Safe' },
    '乙酸锑': { formula: 'Sb(CH₃COO)₃', mw: 298.89, hazard: 'Toxic' },
    '乙酸锡': { formula: 'Sn(CH₃COO)₂', mw: 236.80, hazard: 'Safe' },
    // ── 水合物后缀形式（供"X水合Y"前缀匹配使用） ──
    '硫酸亚铁七水': { formula: 'FeSO₄·7H₂O', mw: 278.01, hazard: 'Safe' },
    '硫酸铜五水': { formula: 'CuSO₄·5H₂O', mw: 249.69, hazard: 'Toxic' },
    '硫酸锌七水': { formula: 'ZnSO₄·7H₂O', mw: 287.56, hazard: 'Safe' },
    '硫酸镁七水': { formula: 'MgSO₄·7H₂O', mw: 246.47, hazard: 'Safe' },
    '硫酸镍六水': { formula: 'NiSO₄·6H₂O', mw: 262.85, hazard: 'Toxic' },
    '硫酸钴七水': { formula: 'CoSO₄·7H₂O', mw: 281.10, hazard: 'Toxic' },
    '硫酸锰一水': { formula: 'MnSO₄·H₂O', mw: 169.02, hazard: 'Safe' },
    '硫酸铝十八水': { formula: 'Al₂(SO₄)₃·18H₂O', mw: 666.42, hazard: 'Safe' },
    '硫酸铁九水': { formula: 'Fe₂(SO₄)₃·9H₂O', mw: 562.02, hazard: 'Safe' },
    '硫酸铬六水': { formula: 'Cr₂(SO₄)₃·6H₂O', mw: 500.28, hazard: 'Safe' },
    '硝酸铝九水合': { formula: 'Al(NO₃)₃·9H₂O', mw: 375.13, hazard: 'Oxidizer' },
    '硝酸钴六水合': { formula: 'Co(NO₃)₂·6H₂O', mw: 291.03, hazard: 'Oxidizer' },
    '硝酸镍六水合': { formula: 'Ni(NO₃)₂·6H₂O', mw: 290.79, hazard: 'Oxidizer' },
    '氯化铁六水合': { formula: 'FeCl₃·6H₂O', mw: 270.30, hazard: 'Corrosive' },
    '硫酸钾铝十二水': { formula: 'KAl(SO₄)₂·12H₂O', mw: 474.39, hazard: 'Safe' },
    '磷酸锂': { formula: 'Li₃PO₄', mw: 115.79, hazard: 'Safe' },
    '磷酸铁锂': { formula: 'LiFePO₄', mw: 157.76, hazard: 'Safe' },
    // ── 草酸盐系列 ──
    '草酸铁': { formula: 'Fe₂(C₂O₄)₃', mw: 375.75, hazard: 'Safe' },
    '草酸亚铁': { formula: 'FeC₂O₄', mw: 143.87, hazard: 'Safe' },
    '草酸亚铁二水': { formula: 'FeC₂O₄·2H₂O', mw: 179.89, hazard: 'Safe' },
    '草酸钴': { formula: 'CoC₂O₄', mw: 146.95, hazard: 'Toxic' },
    '草酸钴二水': { formula: 'CoC₂O₄·2H₂O', mw: 182.98, hazard: 'Toxic' },
    '草酸锰': { formula: 'MnC₂O₄', mw: 142.96, hazard: 'Safe' },
    '草酸锰二水': { formula: 'MnC₂O₄·2H₂O', mw: 178.99, hazard: 'Safe' },
    '草酸镍': { formula: 'NiC₂O₄', mw: 146.71, hazard: 'Toxic' },
    '草酸铜': { formula: 'CuC₂O₄', mw: 151.57, hazard: 'Safe' },
    '草酸锌': { formula: 'ZnC₂O₄', mw: 153.41, hazard: 'Safe' },
    '草酸钙': { formula: 'CaC₂O₄', mw: 128.10, hazard: 'Safe' },
    // ── 硫酸银及缺失的硫酸盐 ──
    '硫酸银': { formula: 'Ag₂SO₄', mw: 311.80, hazard: 'Toxic' },
    '硫酸亚锡': { formula: 'SnSO₄', mw: 214.77, hazard: 'Safe' },
    // ── "三氯化"/"二氯化"命名别名 ──
    '三氯化铝': { formula: 'AlCl₃', mw: 133.34, hazard: 'Corrosive' },
    '三氯化铬': { formula: 'CrCl₃', mw: 158.36, hazard: 'Safe' },
    '二氯化锡': { formula: 'SnCl₂', mw: 189.62, hazard: 'Corrosive' },
    '二氯化铜': { formula: 'CuCl₂', mw: 134.45, hazard: 'Toxic' },
    '三氯化铋': { formula: 'BiCl₃', mw: 315.34, hazard: 'Corrosive' },
    // ── 柠檬酸盐 ──
    '柠檬酸铁': { formula: 'FeC₆H₅O₇', mw: 244.95, hazard: 'Safe' },
    '柠檬酸铁铵': { formula: 'C₆H₈FeNO₇', mw: 261.97, hazard: 'Safe' },
    '柠檬酸钾': { formula: 'K₃C₆H₅O₇', mw: 306.39, hazard: 'Safe' },
    '柠檬酸铵': { formula: '(NH₄)₃C₆H₅O₇', mw: 243.22, hazard: 'Safe' },
    '柠檬酸钙': { formula: 'Ca₃(C₆H₅O₇)₂', mw: 498.43, hazard: 'Safe' },
    '柠檬酸锌': { formula: 'Zn₃(C₆H₅O₇)₂', mw: 574.37, hazard: 'Safe' },
    '柠檬酸铜': { formula: 'Cu₃(C₆H₅O₇)₂', mw: 568.85, hazard: 'Safe' },
    // ── 酒石酸盐 ──
    '酒石酸钾钠': { formula: 'KNaC₄H₄O₆', mw: 210.16, hazard: 'Safe' },
    '酒石酸钾钠四水': { formula: 'KNaC₄H₄O₆·4H₂O', mw: 282.22, hazard: 'Safe' },
    '酒石酸锑钾': { formula: 'K₂Sb₂(C₄H₂O₆)₂', mw: 613.82, hazard: 'Toxic' },
    // ── EDTA 系列 ──
    '乙二胺四乙酸': { formula: 'C₁₀H₁₆N₂O₈', mw: 292.24, hazard: 'Safe' },
    // ── 亚硫酸盐 ──
    '亚硫酸铵': { formula: '(NH₄)₂SO₃', mw: 116.14, hazard: 'Safe' },
    '亚硫酸钾': { formula: 'K₂SO₃', mw: 158.26, hazard: 'Safe' },
    '亚硫酸氢钠': { formula: 'NaHSO₃', mw: 104.06, hazard: 'Corrosive' },
    // ── 磷酸盐补充 ──
    '磷酸氢二铵': { formula: '(NH₄)₂HPO₄', mw: 132.06, hazard: 'Safe' },
    '磷酸二氢铵': { formula: 'NH₄H₂PO₄', mw: 115.03, hazard: 'Safe' },
    '焦磷酸钠': { formula: 'Na₄P₂O₇', mw: 265.90, hazard: 'Safe' },
    '三磷酸钠': { formula: 'Na₅P₃O₁₀', mw: 367.86, hazard: 'Safe' },
    '六偏磷酸钠': { formula: '(NaPO₃)₆', mw: 611.77, hazard: 'Safe' },
    '磷酸铵': { formula: '(NH₄)₃PO₄', mw: 149.09, hazard: 'Safe' },
    // ── 过硫酸盐 ──
    '过硫酸铵': { formula: '(NH₄)₂S₂O₈', mw: 228.20, hazard: 'Oxidizer' },
    // ── 氨基酸系列 ──
    '氨基乙酸': { formula: 'NH₂CH₂COOH', mw: 75.07, hazard: 'Safe' },
    '甘氨酸': { formula: 'NH₂CH₂COOH', mw: 75.07, hazard: 'Safe' },
    '丙氨酸': { formula: 'CH₃CH(NH₂)COOH', mw: 89.09, hazard: 'Safe' },
    // ── 铌酸盐 / 特殊盐 ──
    '铌酸铵草酸盐水合物': { formula: 'NH₄[NbO(C₂O₄)₂]·xH₂O', mw: 302.95, hazard: 'Safe' },
    '铌酸铵草酸盐': { formula: 'NH₄[NbO(C₂O₄)₂]', mw: 284.93, hazard: 'Safe' },
    '钼酸铵': { formula: '(NH₄)₆Mo₇O₂₄', mw: 1163.88, hazard: 'Safe' },
    '钨酸铵': { formula: '(NH₄)₁₀W₁₂O₄₁', mw: 3042.44, hazard: 'Safe' },
    // ── 其他常见缺失 ──
    '硼氢化钾': { formula: 'KBH₄', mw: 53.94, hazard: 'Flammable' },
    '氢化铝锂': { formula: 'LiAlH₄', mw: 37.95, hazard: 'Flammable' },
    // ── 氟磷酸盐 ──
    '单氟磷酸钠': { formula: 'Na₂PO₃F', mw: 143.95, hazard: 'Toxic' },
    '六氟磷酸铵': { formula: 'NH₄PF₆', mw: 163.00, hazard: 'Safe' },
    '六氟磷酸钾': { formula: 'KPF₆', mw: 184.06, hazard: 'Safe' },
    '六氟磷酸锂': { formula: 'LiPF₆', mw: 151.91, hazard: 'Toxic' },
    '六氟磷酸铂': { formula: 'Pt(PF₆)₂', mw: 485.01, hazard: 'Toxic' },
    '六氟磷酸': { formula: 'HPF₆', mw: 145.97, hazard: 'Corrosive' },
    // ── 柠檬酸镁 ──
    '柠檬酸镁': { formula: 'Mg₃(C₆H₅O₇)₂', mw: 451.11, hazard: 'Safe' },
    // ── 贵金属盐 ──
    '亚硫酸金钠': { formula: 'Na₃Au(SO₃)₂', mw: 492.10, hazard: 'Safe' },
    '硝酸钯': { formula: 'Pd(NO₃)₂', mw: 230.43, hazard: 'Oxidizer' },
    '硝酸钯二水': { formula: 'Pd(NO₃)₂·2H₂O', mw: 266.46, hazard: 'Oxidizer' },
    '氯化铂': { formula: 'PtCl₂', mw: 265.99, hazard: 'Toxic' },
    '氯铂酸钾': { formula: 'K₂PtCl₆', mw: 485.99, hazard: 'Toxic' },
    '氯金酸': { formula: 'HAuCl₄', mw: 339.79, hazard: 'Corrosive' },
    '氯化金': { formula: 'AuCl₃', mw: 303.33, hazard: 'Corrosive' },
    '硝酸铑': { formula: 'Rh(NO₃)₃', mw: 288.92, hazard: 'Oxidizer' },
    '氯化钌': { formula: 'RuCl₃', mw: 207.43, hazard: 'Toxic' },
    '氯化铱': { formula: 'IrCl₃', mw: 298.58, hazard: 'Toxic' },
    // ── 草酸铁修正（CAS 6047-25-2 = 草酸亚铁二水） ──
    '草酸铁二水': { formula: 'FeC₂O₄·2H₂O', mw: 179.89, hazard: 'Safe' },
    // ── 亚铁氰化物 / 铁氰化物 ──
    '亚铁氰化钠': { formula: 'Na₄[Fe(CN)₆]', mw: 303.91, hazard: 'Safe' },
    '亚铁氰化钠十水': { formula: 'Na₄[Fe(CN)₆]·10H₂O', mw: 484.06, hazard: 'Safe' },
    '亚铁氰化钾三水': { formula: 'K₄[Fe(CN)₆]·3H₂O', mw: 422.39, hazard: 'Safe' },
    '铁氰化钾': { formula: 'K₃[Fe(CN)₆]', mw: 329.24, hazard: 'Toxic' },
    // ── 酒石酸盐补充 ──
    '酒石酸钾': { formula: 'KC₄H₅O₆', mw: 188.18, hazard: 'Safe' },
    '酒石酸钾半水': { formula: 'KC₄H₅O₆·0.5H₂O', mw: 197.19, hazard: 'Safe' },
    // ── EDTA 盐系列 ──
    'EDTA二钾': { formula: 'C₁₀H₁₄K₂N₂O₈', mw: 368.44, hazard: 'Safe' },
    'EDTA二钾二水': { formula: 'C₁₀H₁₄K₂N₂O₈·2H₂O', mw: 404.47, hazard: 'Safe' },
    'EDTA二钠二水': { formula: 'C₁₀H₁₄Na₂N₂O₈·2H₂O', mw: 372.24, hazard: 'Safe' },
    'EDTA四钠': { formula: 'C₁₀H₁₂Na₄N₂O₈', mw: 380.17, hazard: 'Safe' },
    // ── 柠檬酸水合物 ──
    '柠檬酸一水': { formula: 'C₆H₈O₇·H₂O', mw: 210.14, hazard: 'Safe' },
    '柠檬酸钠二水': { formula: 'Na₃C₆H₅O₇·2H₂O', mw: 294.10, hazard: 'Safe' },
    '柠檬酸钠十水': { formula: 'Na₃C₆H₅O₇·10H₂O', mw: 438.22, hazard: 'Safe' },
    // ── 焦磷酸钠水合 ──
    '焦磷酸钠十水': { formula: 'Na₄P₂O₇·10H₂O', mw: 446.06, hazard: 'Safe' },
    // ── 乙酸镁水合 ──
    '乙酸镁四水': { formula: 'Mg(CH₃COO)₂·4H₂O', mw: 214.45, hazard: 'Safe' },
    // ── 硫酸铝水合 ──
    '硫酸铝八水': { formula: 'Al₂(SO₄)₃·8H₂O', mw: 486.27, hazard: 'Safe' },
    // ── 草酸水合 ──
    '草酸二水': { formula: 'H₂C₂O₄·2H₂O', mw: 126.07, hazard: 'Toxic' },
    '草酸铵一水': { formula: '(NH₄)₂C₂O₄·H₂O', mw: 142.11, hazard: 'Toxic' },
    '酒石酸钠半水': { formula: 'Na₂C₄H₄O₆·0.5H₂O', mw: 239.05, hazard: 'Safe' },
    // ── 硫酸钙（石膏）水合物 ──
    '硫酸钙二水': { formula: 'CaSO₄·2H₂O', mw: 172.17, hazard: 'Safe' },
    '硫酸钙半水': { formula: 'CaSO₄·0.5H₂O', mw: 145.15, hazard: 'Safe' },
    // ── 柠檬酸三钠别名 ──
    '柠檬酸三钠': { formula: 'Na₃C₆H₅O₇', mw: 258.07, hazard: 'Safe' },
    '柠檬酸三钠二水': { formula: 'Na₃C₆H₅O₇·2H₂O', mw: 294.10, hazard: 'Safe' },
    '柠檬酸三钠十水': { formula: 'Na₃C₆H₅O₇·10H₂O', mw: 438.22, hazard: 'Safe' },
    // ── 硫酸铝水合物 ──
    // ── 磷酸盐水合物 ──
    '磷酸二氢钠二水': { formula: 'NaH₂PO₄·2H₂O', mw: 156.01, hazard: 'Safe' },
    '磷酸二氢钠一水': { formula: 'NaH₂PO₄·H₂O', mw: 137.99, hazard: 'Safe' },
    '磷酸氢二钠七水': { formula: 'Na₂HPO₄·7H₂O', mw: 268.07, hazard: 'Safe' },
    '磷酸氢二钠十二水': { formula: 'Na₂HPO₄·12H₂O', mw: 358.14, hazard: 'Safe' },
    '磷酸三钠十二水': { formula: 'Na₃PO₄·12H₂O', mw: 380.12, hazard: 'Safe' },
    // ── 碳酸钠水合 ──
    '碳酸钠十水': { formula: 'Na₂CO₃·10H₂O', mw: 286.14, hazard: 'Safe' },
    '碳酸钠一水': { formula: 'Na₂CO₃·H₂O', mw: 124.00, hazard: 'Safe' },
    // ── 醋酸钠水合 ──
    '乙酸钠三水': { formula: 'CH₃COONa·3H₂O', mw: 136.08, hazard: 'Safe' },
    '醋酸钠三水': { formula: 'CH₃COONa·3H₂O', mw: 136.08, hazard: 'Safe' },
    // ── 硫酸钴水合物 ──
    '硫酸钴六水': { formula: 'CoSO₄·6H₂O', mw: 263.08, hazard: 'Toxic' },
    // ── 邻苯二甲酸酯系列 ──
    '邻苯二甲酸': { formula: 'C₈H₆O₄', mw: 166.13, hazard: 'Corrosive' },
    '邻苯二甲酸二丁酯': { formula: 'C₁₆H₂₂O₄', mw: 278.34, hazard: 'Toxic' },
    '邻苯二甲酸苄基丁基酯': { formula: 'C₁₉H₂₀O₄', mw: 312.36, hazard: 'Toxic' },
    '邻苯二甲酸二甲酯': { formula: 'C₁₀H₁₀O₄', mw: 194.18, hazard: 'Toxic' },
    '邻苯二甲酸二乙酯': { formula: 'C₁₂H₁₄O₄', mw: 222.24, hazard: 'Toxic' },
    '邻苯二甲酸二辛酯': { formula: 'C₂₄H₃₈O₄', mw: 390.56, hazard: 'Toxic' },
    '邻苯二甲酸酐': { formula: 'C₈H₄O₃', mw: 148.12, hazard: 'Corrosive' },
    // ── 锂电池电解液添加剂 ──
    '双氟草酸硼酸锂': { formula: 'LiBF₂(C₂O₄)', mw: 143.77, hazard: 'Toxic' },
    'LIDFOB': { formula: 'LiBF₂(C₂O₄)', mw: 143.77, hazard: 'Toxic' },
    'LiDFOB': { formula: 'LiBF₂(C₂O₄)', mw: 143.77, hazard: 'Toxic' },
    'LiTFSI': { formula: 'LiN(SO₂CF₃)₂', mw: 287.09, hazard: 'Corrosive' },
    'LITFSI': { formula: 'LiN(SO₂CF₃)₂', mw: 287.09, hazard: 'Corrosive' },
    'LI-TFSI': { formula: 'LiN(SO₂CF₃)₂', mw: 287.09, hazard: 'Corrosive' },
    '碳酸亚乙烯酯': { formula: 'C₃H₂O₃', mw: 86.05, hazard: 'Flammable' },
    'VC': { formula: 'C₃H₂O₃', mw: 86.05, hazard: 'Flammable' },
    '氟代碳酸乙烯酯': { formula: 'C₃H₃FO₃', mw: 106.05, hazard: 'Flammable' },
    'FEC': { formula: 'C₃H₃FO₃', mw: 106.05, hazard: 'Flammable' },
    'EC': { formula: 'C₃H₄O₃', mw: 88.06, hazard: 'Flammable' },
    '碳酸二甲酯': { formula: 'C₃H₆O₃', mw: 90.08, hazard: 'Flammable' },
    'DMC': { formula: 'C₃H₆O₃', mw: 90.08, hazard: 'Flammable' },
    '碳酸二乙酯': { formula: 'C₅H₁₀O₃', mw: 118.13, hazard: 'Flammable' },
    'DEC': { formula: 'C₅H₁₀O₃', mw: 118.13, hazard: 'Flammable' },
    '碳酸甲乙酯': { formula: 'C₄H₈O₃', mw: 104.10, hazard: 'Flammable' },
    'EMC': { formula: 'C₄H₈O₃', mw: 104.10, hazard: 'Flammable' },
    // ── 钙钛矿前驱体与有机盐 ──
    '甲脒碘化物': { formula: 'CH₅N₂I', mw: 171.97, hazard: 'Safe' },
    '甲脒溴化物': { formula: 'CH₅N₂Br', mw: 124.97, hazard: 'Safe' },
    'FABr': { formula: 'CH₅N₂Br', mw: 124.97, hazard: 'Safe' },
    '甲脒氯化物': { formula: 'CH₅N₂Cl', mw: 80.52, hazard: 'Safe' },
    '甲脒甲酸盐': { formula: 'CH₃N₂·HCOO', mw: 90.08, hazard: 'Safe' },
    '甲胺碘化物': { formula: 'CH₃NH₃I', mw: 158.97, hazard: 'Safe' },
    'MAI': { formula: 'CH₃NH₃I', mw: 158.97, hazard: 'Safe' },
    '甲胺溴化物': { formula: 'CH₃NH₃Br', mw: 111.97, hazard: 'Safe' },
    'MABr': { formula: 'CH₃NH₃Br', mw: 111.97, hazard: 'Safe' },
    '苯乙胺碘化物': { formula: 'C₆H₅CH₂CH₂NH₃I', mw: 249.09, hazard: 'Safe' },
    'PEAI': { formula: 'C₆H₅CH₂CH₂NH₃I', mw: 249.09, hazard: 'Safe' },
    '苯乙基溴化铵': { formula: 'C₆H₅CH₂CH₂NH₃Br', mw: 202.09, hazard: 'Safe' },
    'PEABr': { formula: 'C₆H₅CH₂CH₂NH₃Br', mw: 202.09, hazard: 'Safe' },
    'PEABR': { formula: 'C₆H₅CH₂CH₂NH₃Br', mw: 202.09, hazard: 'Safe' },
    '苯乙胺盐酸盐': { formula: 'C₆H₅CH₂CH₂NH₂·HCl', mw: 157.64, hazard: 'Safe' },
    '碘化铅': { formula: 'PbI₂', mw: 461.01, hazard: 'Toxic' },
    // ── 有机半导体 / HTM ──
    'PTAA': { formula: '(C₂₄H₂₇N)ₙ', mw: 345.48, hazard: 'Safe' },
    'Spiro-OMeTAD': { formula: 'C₈₁H₆₈N₄O₈', mw: 1225.43, hazard: 'Safe' },
    // ── 其他有机盐 ──
    '4-叔丁基吡啶': { formula: 'C₉H₁₃N', mw: 135.21, hazard: 'Flammable' },
};

/**
 * 本地字典查找：根据化学品中文名瞬时返回分子式、分子量和危险分类
 * 
 * 匹配策略（按优先级）：
 * 1. 精确匹配
 * 2. 规范化（统一括号、去空格）
 * 3. 生成候选名列表（剥离各种后缀/前缀），逐一查找
 * 4. 最长前缀匹配（兜底）
 */
export const lookupChemical = (name: string): ChemicalInfo | null => {
    if (!name) return null;
    const clean = name.trim();

    // 1. 精确匹配
    if (DICT[clean]) return DICT[clean];

    // 2. 规范化：统一括号、去空格
    const n = clean
        .replace(/（/g, '(').replace(/）/g, ')')
        .replace(/\s+/g, '');
    if (DICT[n]) return DICT[n];

    // 3. 生成候选名列表，逐一精确查字典
    const candidates: string[] = [];

    // 3a. 剥离罗马数字价态后缀："(Ⅱ)"/"(II)"/"(Ⅲ)"/"(III)" 等
    const noValence = n.replace(/\((?:Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ|Ⅵ|I{1,3}|IV|V|VI)\)/g, '');
    if (noValence !== n) candidates.push(noValence);

    // 3b. 逗号水合物："氯化镍，六水" → 先试 "氯化镍六水"，再试 "氯化镍"
    const commaStripped = n.replace(/[，,].*$/, '');
    if (commaStripped !== n && commaStripped.length >= 2) {
        // 提取逗号后的水合信息，转为后缀形式
        const commaWaterMatch = n.match(/[，,]\s*(一|二|三|四|五|六|七|八|九|十|十一|十二)?水(?:合物)?$/);
        if (commaWaterMatch) {
            const wn = commaWaterMatch[1] || '';
            if (wn) candidates.push(`${commaStripped}${wn}水`); // "氯化镍六水"
        }
        candidates.push(commaStripped); // "氯化镍"
    }

    // 3c. 括号水合物："乙酸钴(四水)" → 先试 "乙酸钴四水"，再试 "乙酸钴"
    const parenWaterMatch = n.match(/^(.+)\(([^)]*水[^)]*)\)$/);
    if (parenWaterMatch) {
        const base = parenWaterMatch[1];
        const waterPart = parenWaterMatch[2].replace(/合物/g, '');
        candidates.push(`${base}${waterPart}`);
        candidates.push(base);
    }
    const parenWaterStripped = n.replace(/\([^)]*水[^)]*\)/g, '');
    if (parenWaterStripped !== n && !parenWaterMatch) candidates.push(parenWaterStripped);

    // 3d. 无水标记（前缀和后缀都处理）
    const noAnhydrous = n.replace(/-?无水$/, '');
    if (noAnhydrous !== n) candidates.push(noAnhydrous);
    // "无水亚硫酸钠" → "亚硫酸钠"
    const noAnhydrousPrefix = n.replace(/^无水/, '');
    if (noAnhydrousPrefix !== n) candidates.push(noAnhydrousPrefix);

    // 3e. 前缀水合物：支持 "X水合Y" 和 "X水Y"（如"十水焦磷酸钠"）
    //     关键：所有水合物候选在前，无水候选在后
    //     "六水合三氯化铁" → 优先 "氯化铁六水"(FeCl₃·6H₂O)
    //     "十水焦磷酸钠" → 试 "焦磷酸钠十水" → "焦磷酸钠"
    const waterPrefixMatch = n.match(/^(一|二|三|四|五|六|七|八|九|十[一二三四五六七八九]?|半)水合?(.+)$/);
    if (waterPrefixMatch) {
        const wn = waterPrefixMatch[1] || '';
        const base = waterPrefixMatch[2];
        const baseClean = base.replace(/\((?:Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ|Ⅵ|I{1,3}|IV|V|VI)\)/g, '');
        const stoich = stripStoichiometricPrefix(base);
        const stoichClean = stripStoichiometricPrefix(baseClean);

        // 第一优先级：所有水合物形式
        if (wn) {
            candidates.push(`${base}${wn}水`);         // "三氯化铁六水"
            if (baseClean !== base) candidates.push(`${baseClean}${wn}水`);
            if (stoich !== base) candidates.push(`${stoich}${wn}水`);       // "氯化铁六水" ★
            if (stoichClean !== baseClean && stoichClean !== stoich)
                candidates.push(`${stoichClean}${wn}水`);
        }
        // 第二优先级：无水形式
        candidates.push(base);                          // "三氯化铁"
        if (baseClean !== base) candidates.push(baseClean);
        if (stoich !== base) candidates.push(stoich);   // "氯化铁"
        if (stoichClean !== baseClean && stoichClean !== stoich)
            candidates.push(stoichClean);
    }

    // 3f. 逗号剥离后的名称也做罗马数字剥离
    if (commaStripped !== n) {
        const commaNoValence = commaStripped.replace(/\((?:Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ|Ⅵ|I{1,3}|IV|V|VI)\)/g, '');
        if (commaNoValence !== commaStripped) candidates.push(commaNoValence);
    }

    // 3g. 对原始规范名做化学计量前缀剥离
    const stoichBase = stripStoichiometricPrefix(n);
    if (stoichBase !== n) candidates.push(stoichBase);
    const stoichNoValence = stripStoichiometricPrefix(noValence);
    if (stoichNoValence !== noValence) candidates.push(stoichNoValence);

    // 遍历候选列表查字典
    for (const c of candidates) {
        if (c && DICT[c]) return DICT[c];
    }

    // 4. 最长前缀匹配（兜底，仅对规范化名使用）
    let bestMatch: ChemicalInfo | null = null;
    let bestLen = 0;
    const searchTarget = noValence || n; // 优先用去掉价态后的名称
    for (const [key, val] of Object.entries(DICT)) {
        if (key.length < 3) continue;
        if (searchTarget.startsWith(key) && key.length > bestLen) {
            bestMatch = val;
            bestLen = key.length;
        }
    }
    if (bestMatch) return bestMatch;

    return null;
};

/**
 * 剥离中文化学计量前缀："三氯化铁" → "氯化铁"，"二氧化钛" 保持不变
 * 只处理：三X化/二X化 其中 X化 是常见阴离子（氯化/溴化/碘化/氟化/硫化/氰化）
 */
function stripStoichiometricPrefix(name: string): string {
    // "三氯化铁" → "氯化铁"，"二氯化锡" → "氯化锡"
    return name.replace(/^[一二三四五六七八九十]+(氯化|溴化|碘化|氟化|硫化|氰化)/, '$1');
}

/**
 * 批量查找：返回 { 已找到, 未找到 }
 */
export const batchLookupChemicals = (names: string[]): {
    found: Record<string, ChemicalInfo>;
    notFound: string[];
} => {
    const found: Record<string, ChemicalInfo> = {};
    const notFound: string[] = [];
    for (const name of names) {
        const info = lookupChemical(name);
        if (info) {
            found[name] = info;
        } else {
            notFound.push(name);
        }
    }
    return { found, notFound };
};
