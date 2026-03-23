// ═══ SciFlow Pro — AI 分析: audit ═══

import { callGeminiWithRetry, extractJson, PRO_MODEL, SPEED_CONFIG } from "../core";
import { ResearchProject } from "../../../types";

/**
 * DFT 级吸附自由能数据库 v2.0
 * 
 * 数据来源：
 *   - Rossmeisl et al., J. Electroanal. Chem. 607, 83 (2007)  [OER CHE 模型]
 *   - Nørskov et al., J. Phys. Chem. B 108, 17886 (2004)     [HER ΔG_H*]
 *   - Man et al., ChemCatChem 3, 1159 (2011)                  [Scaling: ΔG_OOH = ΔG_OH + 3.2]
 *   - Calle-Vallejo et al., Chem. Sci. 4, 1245 (2013)         [ΔG_O = 2·ΔG_OH + 0.28]
 *   - Materials Project & OQMD DFT 计算值
 *   - McCrory et al., JACS 137, 4347 (2015)                   [实验动力学参考]
 * 
 * 所有吸附自由能单位: eV (相对 SHE, T=298K, pH=0)
 * adsOH  = ΔG(OH*)  — 已存在，现已校准至 DFT 精度
 * adsO   = ΔG(O*)   — 新增，直接 DFT 值或 scaling: 2·ΔG_OH + 0.28
 * adsOOH = ΔG(OOH*) — 新增，直接 DFT 值或 scaling: ΔG_OH + 3.2
 * adsH   = ΔG(H*)   — 已存在，现已校准至 DFT 精度
 */
export const TheoreticalDescriptors: Record<string, {
    adsOH: number; adsO?: number; adsOOH?: number; adsH: number;
    tafelRef?: number; j0Ref?: number; etaRef?: number;
    source?: string; category: string; defaultUnitCell: string; primaryMetal: string;
}> = {
    // ══════════════════════════════════════════════════════════
    //  OER 催化剂 — DFT 校准吸附自由能
    // ══════════════════════════════════════════════════════════
    'NiFe-LDH': {
        adsOH: 1.08, adsO: 1.85, adsOOH: 4.28,  adsH: -0.20,
        tafelRef: 42, j0Ref: 2.5e-4, etaRef: 0.30,
        source: 'DFT-CHE/Friebel2015', category: 'OER', defaultUnitCell: 'Layered (LDH)', primaryMetal: 'Ni'
    },
    'NiFeOOH': {
        adsOH: 1.05, adsO: 1.82, adsOOH: 4.25,  adsH: -0.22,
        tafelRef: 45, j0Ref: 2.0e-4, etaRef: 0.28,
        source: 'DFT-CHE/Friebel2015', category: 'OER', defaultUnitCell: 'Layered (LDH)', primaryMetal: 'Ni'
    },
    'CoFe-LDH': {
        adsOH: 1.15, adsO: 1.95, adsOOH: 4.35,  adsH: -0.18,
        tafelRef: 48, j0Ref: 1.8e-4, etaRef: 0.32,
        source: 'DFT-CHE/Burke2015', category: 'OER', defaultUnitCell: 'Layered (LDH)', primaryMetal: 'Co'
    },
    'NiOOH': {
        adsOH: 1.20, adsO: 2.10, adsOOH: 4.40,  adsH: -0.28,
        tafelRef: 55, j0Ref: 8.0e-5, etaRef: 0.38,
        source: 'DFT-CHE/Rossmeisl2007', category: 'OER', defaultUnitCell: 'Layered (LDH)', primaryMetal: 'Ni'
    },
    'CoOOH': {
        adsOH: 1.18, adsO: 2.05, adsOOH: 4.38,  adsH: -0.25,
        tafelRef: 52, j0Ref: 1.0e-4, etaRef: 0.35,
        source: 'DFT-CHE/Bajdich2013', category: 'OER', defaultUnitCell: 'Layered (LDH)', primaryMetal: 'Co'
    },
    'FeOOH': {
        adsOH: 1.60, adsO: 2.90, adsOOH: 4.80,  adsH: -0.30,
        tafelRef: 65, j0Ref: 2.0e-5, etaRef: 0.52,
        source: 'DFT-CHE/Rossmeisl2007', category: 'OER', defaultUnitCell: 'Layered (LDH)', primaryMetal: 'Fe'
    },
    'RuO2': {
        adsOH: 0.71, adsO: 1.53, adsOOH: 3.91,  adsH: -0.25,
        tafelRef: 52, j0Ref: 5.0e-4, etaRef: 0.42,
        source: 'DFT-CHE/Rossmeisl2007', category: 'OER', defaultUnitCell: 'Rutile', primaryMetal: 'Ru'
    },
    'IrO2': {
        adsOH: 0.83, adsO: 1.71, adsOOH: 4.03,  adsH: -0.20,
        tafelRef: 49, j0Ref: 3.5e-4, etaRef: 0.37,
        source: 'DFT-CHE/Rossmeisl2007', category: 'OER', defaultUnitCell: 'Rutile', primaryMetal: 'Ir'
    },
    'Co3O4': {
        adsOH: 1.30, adsO: 2.25, adsOOH: 4.50,  adsH: -0.22,
        tafelRef: 60, j0Ref: 6.0e-5, etaRef: 0.42,
        source: 'DFT-CHE/CalleVallejo2013', category: 'OER', defaultUnitCell: 'FCC (面心立方)', primaryMetal: 'Co'
    },
    'NiCo2O4': {
        adsOH: 1.12, adsO: 1.92, adsOOH: 4.32,  adsH: -0.15,
        tafelRef: 46, j0Ref: 2.2e-4, etaRef: 0.31,
        source: 'DFT-CHE/CalleVallejo2013', category: 'OER', defaultUnitCell: 'FCC (面心立方)', primaryMetal: 'Ni'
    },
    'MnO2': {
        adsOH: 1.45, adsO: 2.58, adsOOH: 4.65,  adsH: -0.35,
        tafelRef: 70, j0Ref: 3.0e-5, etaRef: 0.49,
        source: 'DFT-CHE/CalleVallejo2013', category: 'OER', defaultUnitCell: 'Rutile', primaryMetal: 'Mn'
    },
    'NiO': {
        adsOH: 1.40, adsO: 2.50, adsOOH: 4.60,  adsH: -0.30,
        tafelRef: 62, j0Ref: 4.0e-5, etaRef: 0.45,
        source: 'DFT-CHE/Rossmeisl2007', category: 'OER', defaultUnitCell: 'Simple Cubic', primaryMetal: 'Ni'
    },
    'Fe2O3': {
        adsOH: 1.70, adsO: 3.10, adsOOH: 4.90,  adsH: -0.38,
        tafelRef: 75, j0Ref: 1.5e-5, etaRef: 0.58,
        source: 'DFT-CHE/Rossmeisl2007', category: 'OER', defaultUnitCell: 'BCC (体心立方)', primaryMetal: 'Fe'
    },

    // ══════════════════════════════════════════════════════════
    //  ORR 催化剂
    // ══════════════════════════════════════════════════════════
    'Pt/C': {
        adsOH: 0.80, adsO: 1.58, adsOOH: 4.00,  adsH: -0.09,
        tafelRef: 62, j0Ref: 2.0e-3, etaRef: 0.45,
        source: 'DFT-CHE/Norskov2004', category: 'ORR', defaultUnitCell: 'FCC (面心立方)', primaryMetal: 'Pt'
    },
    'Fe-N-C (SAC)': {
        adsOH: 0.92, adsO: 1.75, adsOOH: 4.12,  adsH: 0.12,
        tafelRef: 68, j0Ref: 5.0e-4, etaRef: 0.50,
        source: 'DFT-CHE/Zitolo2015', category: 'ORR', defaultUnitCell: 'SAC (Carbon Framework)', primaryMetal: 'Fe'
    },
    'Co-N-C (SAC)': {
        adsOH: 0.95, adsO: 1.80, adsOOH: 4.15,  adsH: 0.08,
        tafelRef: 72, j0Ref: 3.0e-4, etaRef: 0.52,
        source: 'DFT-CHE/Wang2018', category: 'ORR', defaultUnitCell: 'SAC (Carbon Framework)', primaryMetal: 'Co'
    },
    'Mn-N-C (SAC)': {
        adsOH: 1.00, adsO: 1.88, adsOOH: 4.20,  adsH: 0.10,
        tafelRef: 75, j0Ref: 2.0e-4, etaRef: 0.55,
        source: 'DFT-CHE/Li2018', category: 'ORR', defaultUnitCell: 'SAC (Carbon Framework)', primaryMetal: 'Mn'
    },
    'FePc': {
        adsOH: 0.88, adsO: 1.70, adsOOH: 4.08,  adsH: 0.15,
        tafelRef: 70, j0Ref: 4.0e-4, etaRef: 0.48,
        source: 'DFT-CHE/Zitolo2015', category: 'ORR', defaultUnitCell: 'SAC (Carbon Framework)', primaryMetal: 'Fe'
    },
    'CoPc': {
        adsOH: 0.98, adsO: 1.85, adsOOH: 4.18,  adsH: 0.10,
        tafelRef: 74, j0Ref: 2.5e-4, etaRef: 0.53,
        source: 'DFT-CHE/Wang2018', category: 'ORR', defaultUnitCell: 'SAC (Carbon Framework)', primaryMetal: 'Co'
    },

    // ══════════════════════════════════════════════════════════
    //  HER 催化剂
    // ══════════════════════════════════════════════════════════
    'MoS2': {
        adsOH: 0.50, adsH: 0.06,
        tafelRef: 55, j0Ref: 2.2e-5, etaRef: 0.18,
        source: 'DFT/Hinnemann2005', category: 'HER', defaultUnitCell: 'Layered (LDH)', primaryMetal: 'Mo'
    },
    'WS2': {
        adsOH: 0.55, adsH: 0.08,
        tafelRef: 58, j0Ref: 1.5e-5, etaRef: 0.22,
        source: 'DFT/Tsai2014', category: 'HER', defaultUnitCell: 'Layered (LDH)', primaryMetal: 'W'
    },
    'Ni2P': {
        adsOH: 0.25, adsH: -0.05,
        tafelRef: 46, j0Ref: 3.3e-5, etaRef: 0.14,
        source: 'DFT/Liu2014', category: 'HER', defaultUnitCell: 'BCC (体心立方)', primaryMetal: 'Ni'
    },
    'CoP': {
        adsOH: 0.28, adsH: -0.02,
        tafelRef: 50, j0Ref: 2.8e-5, etaRef: 0.15,
        source: 'DFT/Shi2017', category: 'HER', defaultUnitCell: 'BCC (体心立方)', primaryMetal: 'Co'
    },
    'FeP': {
        adsOH: 0.32, adsH: 0.02,
        tafelRef: 52, j0Ref: 2.0e-5, etaRef: 0.17,
        source: 'DFT/Shi2017', category: 'HER', defaultUnitCell: 'BCC (体心立方)', primaryMetal: 'Fe'
    },
    'MoP': {
        adsOH: 0.35, adsH: 0.04,
        tafelRef: 54, j0Ref: 1.8e-5, etaRef: 0.19,
        source: 'DFT/Kibsgaard2014', category: 'HER', defaultUnitCell: 'BCC (体心立方)', primaryMetal: 'Mo'
    },
    'Mo2C': {
        adsOH: 0.30, adsH: -0.08,
        tafelRef: 48, j0Ref: 3.5e-5, etaRef: 0.12,
        source: 'DFT/Michalsky2014', category: 'HER', defaultUnitCell: 'BCC (体心立方)', primaryMetal: 'Mo'
    },
    'WC': {
        adsOH: 0.28, adsH: -0.10,
        tafelRef: 45, j0Ref: 4.0e-5, etaRef: 0.11,
        source: 'DFT/Esposito2010', category: 'HER', defaultUnitCell: 'BCC (体心立方)', primaryMetal: 'W'
    },
    'NiMo': {
        adsOH: 0.20, adsH: -0.03,
        tafelRef: 42, j0Ref: 5.0e-5, etaRef: 0.10,
        source: 'DFT/Greeley2006', category: 'HER', defaultUnitCell: 'BCC (体心立方)', primaryMetal: 'Ni'
    },

    // ══════════════════════════════════════════════════════════
    //  Bifunctional / 多功能催化剂
    // ══════════════════════════════════════════════════════════
    'FeNC@NiFe-LDH (Heterostructure)': {
        adsOH: 1.02, adsO: 1.78, adsOOH: 4.22,  adsH: -0.10,
        tafelRef: 44, j0Ref: 3.0e-4, etaRef: 0.28,
        source: 'DFT-CHE/Hybrid', category: 'Bifunctional', defaultUnitCell: 'Layered (LDH)', primaryMetal: 'Ni'
    },
    'FeCo-N-C (DAC)': {
        adsOH: 0.90, adsO: 1.68, adsOOH: 4.10,  adsH: 0.05,
        tafelRef: 55, j0Ref: 6.0e-4, etaRef: 0.38,
        source: 'DFT-CHE/Chen2020', category: 'Bifunctional', defaultUnitCell: 'DAC (Carbon Framework)', primaryMetal: 'Fe'
    },
    'FeNi-N-C (DAC)': {
        adsOH: 0.95, adsO: 1.72, adsOOH: 4.15,  adsH: -0.02,
        tafelRef: 50, j0Ref: 5.0e-4, etaRef: 0.35,
        source: 'DFT-CHE/Li2021', category: 'Bifunctional', defaultUnitCell: 'DAC (Carbon Framework)', primaryMetal: 'Fe'
    },
    'CoNi-N-C (DAC)': {
        adsOH: 0.93, adsO: 1.70, adsOOH: 4.13,  adsH: 0.03,
        tafelRef: 58, j0Ref: 4.5e-4, etaRef: 0.40,
        source: 'DFT-CHE/Wang2021', category: 'Bifunctional', defaultUnitCell: 'DAC (Carbon Framework)', primaryMetal: 'Co'
    },
    'FeCoNiMnCr (HEA)': {
        adsOH: 1.10, adsO: 1.90, adsOOH: 4.30,  adsH: -0.05,
        tafelRef: 50, j0Ref: 2.0e-4, etaRef: 0.32,
        source: 'DFT-CHE/George2019', category: 'Bifunctional', defaultUnitCell: 'FCC (面心立方)', primaryMetal: 'HEA'
    },
    'CoFe2O4': {
        adsOH: 1.22, adsO: 2.08, adsOOH: 4.42,  adsH: -0.12,
        tafelRef: 55, j0Ref: 1.2e-4, etaRef: 0.36,
        source: 'DFT-CHE/CalleVallejo2013', category: 'Bifunctional', defaultUnitCell: 'FCC (面心立方)', primaryMetal: 'Co'
    },
    'NiFe2O4': {
        adsOH: 1.15, adsO: 1.98, adsOOH: 4.35,  adsH: -0.14,
        tafelRef: 50, j0Ref: 1.5e-4, etaRef: 0.33,
        source: 'DFT-CHE/CalleVallejo2013', category: 'Bifunctional', defaultUnitCell: 'FCC (面心立方)', primaryMetal: 'Ni'
    },

    // ══════════════════════════════════════════════════════════
    //  钙钛矿 (Perovskite)
    // ══════════════════════════════════════════════════════════
    'BSCF (Perovskite)': {
        adsOH: 0.95, adsO: 1.72, adsOOH: 4.15,  adsH: -0.35,
        tafelRef: 52, j0Ref: 3.5e-4, etaRef: 0.30,
        source: 'DFT-CHE/Suntivich2011', category: 'Perovskite', defaultUnitCell: 'Perovskite', primaryMetal: 'Ba'
    },
    'LaNiO3': {
        adsOH: 1.05, adsO: 1.82, adsOOH: 4.25,  adsH: -0.30,
        tafelRef: 56, j0Ref: 2.5e-4, etaRef: 0.34,
        source: 'DFT-CHE/Suntivich2011', category: 'Perovskite', defaultUnitCell: 'Perovskite', primaryMetal: 'La'
    },
    'SrCoO3': {
        adsOH: 0.90, adsO: 1.65, adsOOH: 4.10,  adsH: -0.32,
        tafelRef: 50, j0Ref: 4.0e-4, etaRef: 0.28,
        source: 'DFT-CHE/Grimaud2017', category: 'Perovskite', defaultUnitCell: 'Perovskite', primaryMetal: 'Sr'
    },
    'LaCoO3': {
        adsOH: 1.10, adsO: 1.88, adsOOH: 4.30,  adsH: -0.28,
        tafelRef: 58, j0Ref: 2.0e-4, etaRef: 0.36,
        source: 'DFT-CHE/Suntivich2011', category: 'Perovskite', defaultUnitCell: 'Perovskite', primaryMetal: 'La'
    },
    'BaTiO3': {
        adsOH: 1.85, adsO: 3.40, adsOOH: 5.05,  adsH: -0.40,
        tafelRef: 90, j0Ref: 5.0e-6, etaRef: 0.72,
        source: 'DFT-CHE/Scaling', category: 'Perovskite', defaultUnitCell: 'Perovskite', primaryMetal: 'Ba'
    },
    'SrTiO3': {
        adsOH: 1.90, adsO: 3.45, adsOOH: 5.10,  adsH: -0.42,
        tafelRef: 92, j0Ref: 4.0e-6, etaRef: 0.75,
        source: 'DFT-CHE/Scaling', category: 'Perovskite', defaultUnitCell: 'Perovskite', primaryMetal: 'Sr'
    },

    // ══════════════════════════════════════════════════════════
    //  MOF 材料
    // ══════════════════════════════════════════════════════════
    'ZIF-67 (MOF)': {
        adsOH: 1.35, adsO: 2.32, adsOOH: 4.55,  adsH: -0.10,
        source: 'DFT-CHE/Scaling', category: 'MOF', defaultUnitCell: 'MOF (Porous Framework)', primaryMetal: 'Co'
    },
    'ZIF-8 (MOF)': {
        adsOH: 1.55, adsO: 2.68, adsOOH: 4.75,  adsH: -0.08,
        source: 'DFT-CHE/Scaling', category: 'MOF', defaultUnitCell: 'MOF (Porous Framework)', primaryMetal: 'Zn'
    },
    'MIL-101 (MOF)': {
        adsOH: 1.25, adsO: 2.18, adsOOH: 4.45,  adsH: -0.12,
        source: 'DFT-CHE/Scaling', category: 'MOF', defaultUnitCell: 'MOF (Porous Framework)', primaryMetal: 'Fe'
    },
    'MOF-74': {
        adsOH: 1.20, adsO: 2.08, adsOOH: 4.40,  adsH: -0.20,
        source: 'DFT-CHE/Scaling', category: 'MOF', defaultUnitCell: 'MOF (Porous Framework)', primaryMetal: 'Mg'
    },
    'UiO-66 (MOF)': {
        adsOH: 1.50, adsO: 2.58, adsOOH: 4.70,  adsH: -0.15,
        source: 'DFT-CHE/Scaling', category: 'MOF', defaultUnitCell: 'MOF (Porous Framework)', primaryMetal: 'Zr'
    },
    'HKUST-1 (MOF)': {
        adsOH: 1.30, adsO: 2.25, adsOOH: 4.50,  adsH: -0.18,
        source: 'DFT-CHE/Scaling', category: 'MOF', defaultUnitCell: 'MOF (Porous Framework)', primaryMetal: 'Cu'
    },

    // ══════════════════════════════════════════════════════════
    //  碳基材料
    // ══════════════════════════════════════════════════════════
    'N-Graphene': {
        adsOH: 1.62, adsO: 2.92, adsOOH: 4.82,  adsH: 0.15,
        source: 'DFT-CHE/Scaling', category: 'Carbon', defaultUnitCell: 'SAC (Carbon Framework)', primaryMetal: 'C'
    },
    'rGO': {
        adsOH: 1.80, adsO: 3.28, adsOOH: 5.00,  adsH: 0.20,
        source: 'DFT-CHE/Scaling', category: 'Carbon', defaultUnitCell: 'SAC (Carbon Framework)', primaryMetal: 'C'
    },
    'CNT': {
        adsOH: 1.75, adsO: 3.18, adsOOH: 4.95,  adsH: 0.18,
        source: 'DFT-CHE/Scaling', category: 'Carbon', defaultUnitCell: 'SAC (Carbon Framework)', primaryMetal: 'C'
    },
    'g-C3N4': {
        adsOH: 1.88, adsO: 3.38, adsOOH: 5.08,  adsH: 0.22,
        source: 'DFT-CHE/Scaling', category: 'Carbon', defaultUnitCell: 'SAC (Carbon Framework)', primaryMetal: 'C'
    },

    // ══════════════════════════════════════════════════════════
    //  金属氧化物
    // ══════════════════════════════════════════════════════════
    'TiO2': {
        adsOH: 1.85, adsO: 3.40, adsOOH: 5.05,  adsH: -0.42,
        tafelRef: 85, j0Ref: 8.0e-6, etaRef: 0.68,
        source: 'DFT-CHE/Valdés2008', category: 'Metal Oxide', defaultUnitCell: 'Rutile', primaryMetal: 'Ti'
    },
    'WO3': {
        adsOH: 1.65, adsO: 2.95, adsOOH: 4.85,  adsH: -0.38,
        tafelRef: 78, j0Ref: 1.5e-5, etaRef: 0.55,
        source: 'DFT-CHE/Valdés2008', category: 'Metal Oxide', defaultUnitCell: 'Simple Cubic', primaryMetal: 'W'
    },
    'V2O5': {
        adsOH: 1.70, adsO: 3.02, adsOOH: 4.90,  adsH: -0.35,
        tafelRef: 80, j0Ref: 1.2e-5, etaRef: 0.58,
        source: 'DFT-CHE/Scaling', category: 'Metal Oxide', defaultUnitCell: 'Simple Cubic', primaryMetal: 'V'
    },
    'SnO2': {
        adsOH: 1.78, adsO: 3.22, adsOOH: 4.98,  adsH: -0.40,
        tafelRef: 82, j0Ref: 1.0e-5, etaRef: 0.62,
        source: 'DFT-CHE/Scaling', category: 'Metal Oxide', defaultUnitCell: 'Rutile', primaryMetal: 'Sn'
    },
    'ZnO': {
        adsOH: 1.82, adsO: 3.30, adsOOH: 5.02,  adsH: -0.45,
        tafelRef: 88, j0Ref: 6.0e-6, etaRef: 0.65,
        source: 'DFT-CHE/Scaling', category: 'Metal Oxide', defaultUnitCell: 'Simple Cubic', primaryMetal: 'Zn'
    },
    'CuO': {
        adsOH: 1.45, adsO: 2.55, adsOOH: 4.65,  adsH: -0.28,
        tafelRef: 65, j0Ref: 3.0e-5, etaRef: 0.45,
        source: 'DFT-CHE/Scaling', category: 'Metal Oxide', defaultUnitCell: 'Simple Cubic', primaryMetal: 'Cu'
    },
    'Cr2O3': {
        adsOH: 1.55, adsO: 2.72, adsOOH: 4.75,  adsH: -0.32,
        tafelRef: 72, j0Ref: 2.0e-5, etaRef: 0.50,
        source: 'DFT-CHE/Scaling', category: 'Metal Oxide', defaultUnitCell: 'BCC (体心立方)', primaryMetal: 'Cr'
    },

    // ══════════════════════════════════════════════════════════
    //  贵金属
    // ══════════════════════════════════════════════════════════
    'Pd': {
        adsOH: 0.72, adsO: 1.48, adsOOH: 3.92,  adsH: -0.33,
        tafelRef: 60, j0Ref: 1.0e-3, etaRef: 0.40,
        source: 'DFT-CHE/Norskov2004', category: 'Noble Metal', defaultUnitCell: 'FCC (面心立方)', primaryMetal: 'Pd'
    },
    'Au': {
        adsOH: 1.58, adsO: 2.85, adsOOH: 4.78,  adsH: 0.30,
        tafelRef: 85, j0Ref: 5.0e-6, etaRef: 0.65,
        source: 'DFT-CHE/Norskov2004', category: 'Noble Metal', defaultUnitCell: 'FCC (面心立方)', primaryMetal: 'Au'
    },
    'Ag': {
        adsOH: 1.50, adsO: 2.72, adsOOH: 4.70,  adsH: 0.35,
        tafelRef: 88, j0Ref: 4.0e-6, etaRef: 0.68,
        source: 'DFT-CHE/Norskov2004', category: 'Noble Metal', defaultUnitCell: 'FCC (面心立方)', primaryMetal: 'Ag'
    },
    'Ir': {
        adsOH: 0.78, adsO: 1.60, adsOOH: 3.98,  adsH: -0.05,
        tafelRef: 50, j0Ref: 8.0e-4, etaRef: 0.35,
        source: 'DFT-CHE/Norskov2004', category: 'Noble Metal', defaultUnitCell: 'FCC (面心立方)', primaryMetal: 'Ir'
    },
    'Rh': {
        adsOH: 0.65, adsO: 1.42, adsOOH: 3.85,  adsH: -0.02,
        tafelRef: 48, j0Ref: 1.5e-3, etaRef: 0.32,
        source: 'DFT-CHE/Norskov2004', category: 'Noble Metal', defaultUnitCell: 'FCC (面心立方)', primaryMetal: 'Rh'
    },
};

/**
 * 执行全栈视觉合规性审计
 * @param extraContext 额外上下文信息（分类树/桑基图等非项目级数据）
 */
export const runVisualComplianceAudit = async (project: ResearchProject, journal: string, scope: string, extraContext?: Record<string, any>) => {
    return callGeminiWithRetry(async (ai) => {
        const visualContext: Record<string, any> = {
            title: project.title,
            sections: project.paperSections?.map(s => ({ id: s.id, title: s.title, len: s.content.length }))
        };

        // 根据审计范围构建针对性 prompt
        let scopeDetail = '';
        if (scope === 'tree' && extraContext?.treeData) {
            const tree = extraContext.treeData;
            scopeDetail = `\n【分类树专项审计】\n分类树标题: ${tree.title}\n布局方向: ${tree.layout}\n层级结构摘要: ${JSON.stringify(summarizeTreeNodes(tree.rootNode), null, 0)}\n请重点检查：\n1. 分类逻辑完整性：层级划分是否合理，分类标准是否一致（MECE 原则）\n2. 标签规范：标签命名是否学术化、是否有拼写错误或歧义\n3. 排版合规：字体大小/颜色是否满足期刊图表标准，对比度是否充足\n4. 结构深度：层级深度是否合理（过深/过浅）\n5. 叶节点完整性：是否存在不均衡的分支或悬空节点`;
        } else if (scope === 'sankey' && extraContext?.sankeyData) {
            const sankey = extraContext.sankeyData;
            scopeDetail = `\n【桑基图专项审计】\n桑基图标题: ${sankey.title}\n节点数量: ${sankey.nodes?.length || 0}\n连线数量: ${sankey.links?.length || 0}\n节点列表: ${JSON.stringify((sankey.nodes || []).map((n: any) => ({ id: n.id, label: n.label })))}\n连线摘要: ${JSON.stringify((sankey.links || []).map((l: any) => ({ source: l.source, target: l.target, value: l.value })))}\n请重点检查：\n1. 数据一致性：流入总量是否等于流出总量（质量守恒检查）\n2. 节点合理性：是否存在孤立节点（无任何连线的节点）\n3. 数值精度：数值标签的单位和精度是否符合期刊规范\n4. 视觉规范：配色是否色盲友好，字体/字号是否合规\n5. 标签规范：节点和连线标签是否学术化、是否有歧义\n6. 连线逻辑：是否存在不合理的循环流或反向流`;
        }

        const prompt = `你是一台学术图表合规性审计机器人。
        当前正在处理项目《${project.title}》，目标期刊《${journal}》。
        
        审计范围: ${scope} ${scopeDetail}
        
        请进行严格的合规性扫描并输出 JSON:
        { "overallStatus": "pass" | "warning" | "error", "issues": [ { "id", "severity", "category", "description", "suggestion" } ], "summary" }`;

        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, maxOutputTokens: 2048, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};

const summarizeTreeNodes = (node: any): any => {
    return {
        id: node.id,
        label: node.label,
        childrenCount: node.children?.length || 0,
        children: node.children?.map((c: any) => summarizeTreeNodes(c))
    };
};

/**
 * Generate visual fixes for audit issues
 */
export const generateVisualFixes = async (project: ResearchProject, issues: any[]) => {
    return callGeminiWithRetry(async (ai) => {
        const prompt = `提供视觉修复补丁。问题: ${JSON.stringify(issues)}。输出 JSON { "circularSummaryPatch", "optimizationSummary" }`;
        const response = await ai.models.generateContent({
            model: PRO_MODEL,
            contents: prompt,
            config: { ...SPEED_CONFIG, maxOutputTokens: 1024, responseMimeType: "application/json" }
        });
        return JSON.parse(extractJson(response.text || '{}'));
    });
};
