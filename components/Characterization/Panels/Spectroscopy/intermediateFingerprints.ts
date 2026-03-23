/**
 * intermediateFingerprints.ts
 * OER/ORR 反应中间体拉曼/IR 光谱指纹库
 * 面向金属空气电池双功能催化剂
 */

export interface IntermediateEntry {
    id: string;
    species: string;         // 化学式
    name: string;            // 中文名
    vibrationMode: string;   // 振动模式
    ramanRange: [number, number]; // 拉曼位移范围 cm⁻¹
    irRange?: [number, number];  // 红外范围 cm⁻¹
    description: string;     // 描述
    relevance: 'OER' | 'ORR' | 'both'; // 相关反应
    category: 'intermediate' | 'oxide' | 'hydroxide' | 'substrate';
}

// ==================== 核心中间体指纹库 ====================

export const INTERMEDIATE_DATABASE: IntermediateEntry[] = [
    // ---- OER/ORR 关键反应中间体 ----
    {
        id: 'M-OH',
        species: '*OH',
        name: '吸附态羟基',
        vibrationMode: 'ν(M-OH) 伸缩振动',
        ramanRange: [500, 600],
        irRange: [3200, 3600],
        description: 'OER 第一步中间体，M-OH 键的金属端伸缩振动。信号强度反映表面 *OH 覆盖度。',
        relevance: 'both',
        category: 'intermediate',
    },
    {
        id: 'M-O',
        species: '*O',
        name: '吸附态氧',
        vibrationMode: 'ν(M=O) 伸缩振动',
        ramanRange: [600, 700],
        irRange: [800, 900],
        description: 'OER 第二步中间体，*OH 脱氢后生成。高电位下信号增强表明 *O 累积。',
        relevance: 'OER',
        category: 'intermediate',
    },
    {
        id: 'M-OOH',
        species: '*OOH',
        name: '吸附态超氧羟基',
        vibrationMode: 'δ(M-OOH) 弯曲振动 + ν(O-O)',
        ramanRange: [550, 620],
        irRange: [1000, 1200],
        description: 'OER 关键中间体 (AEM 路径)。580 cm⁻¹ 附近的信号随电位增长是 AEM 机理的核心证据。',
        relevance: 'OER',
        category: 'intermediate',
    },
    {
        id: 'O-O',
        species: 'O-O*',
        name: '表面过氧物种',
        vibrationMode: 'ν(O-O) 伸缩振动',
        ramanRange: [800, 900],
        irRange: [830, 880],
        description: '*OOH 中的 O-O 键伸缩。LOM 路径中晶格氧参与时该信号显著。',
        relevance: 'OER',
        category: 'intermediate',
    },
    {
        id: 'OOH-bend',
        species: '*OOH',
        name: 'OOH 弯曲振动',
        vibrationMode: 'δ(OOH) 面内弯曲',
        ramanRange: [1050, 1150],
        irRange: [1050, 1150],
        description: '*OOH 中间体的 O-O-H 弯曲振动，用于辅助确认 *OOH 的存在。',
        relevance: 'OER',
        category: 'intermediate',
    },
    {
        id: 'superoxide',
        species: 'O₂⁻',
        name: '超氧离子',
        vibrationMode: 'ν(O-O) 伸缩振动',
        ramanRange: [1100, 1200],
        irRange: [1100, 1200],
        description: 'ORR 过程中 O₂ 单电子还原产物。在碱性介质中该信号的存在指示二电子机理。',
        relevance: 'ORR',
        category: 'intermediate',
    },

    // ---- 常见金属氧化物/氢氧化物相 ----
    {
        id: 'CoOOH',
        species: 'CoOOH',
        name: '羟基氧化钴',
        vibrationMode: 'ν(Co-O) + δ(Co-OH)',
        ramanRange: [480, 520],
        description: 'OER 活性相，Co³⁺ 的光谱指纹。原位生成的 CoOOH 是析氧的真正活性物种。',
        relevance: 'OER',
        category: 'hydroxide',
    },
    {
        id: 'Co3O4',
        species: 'Co₃O₄',
        name: '四氧化三钴',
        vibrationMode: 'A1g + Eg + F2g',
        ramanRange: [470, 700],
        description: '尖晶石结构 Co₃O₄ 的多声子拉曼模式。A1g (~690 cm⁻¹) 和 F2g (~520 cm⁻¹) 为主要特征。',
        relevance: 'both',
        category: 'oxide',
    },
    {
        id: 'FeOOH',
        species: 'FeOOH',
        name: '羟基氧化铁',
        vibrationMode: 'ν(Fe-O) + δ(Fe-OH)',
        ramanRange: [380, 420],
        description: 'Fe³⁺ 氢氧化物相。NiFe-LDH 体系中 Fe 位点的 OER 活性贡献标志。',
        relevance: 'OER',
        category: 'hydroxide',
    },
    {
        id: 'NiOOH',
        species: 'NiOOH',
        name: '羟基氧化镍',
        vibrationMode: 'ν(Ni-O) A1g',
        ramanRange: [470, 560],
        description: 'Ni²⁺→Ni³⁺ 氧化后生成的活性相。475 cm⁻¹ 和 555 cm⁻¹ 双峰为 β-NiOOH 特征。',
        relevance: 'OER',
        category: 'hydroxide',
    },
    {
        id: 'MnO2',
        species: 'MnO₂',
        name: '二氧化锰',
        vibrationMode: 'ν(Mn-O) 伸缩振动',
        ramanRange: [570, 650],
        description: '锰氧化物的 Mn-O 伸缩振动，晶型不同频率有差异 (α/β/γ/δ-MnO₂)。',
        relevance: 'both',
        category: 'oxide',
    },
    {
        id: 'lattice-O',
        species: 'O²⁻ₗₐₜ',
        name: '晶格氧',
        vibrationMode: 'ν(M-O) 晶格振动',
        ramanRange: [400, 500],
        description: 'LOM 路径标志物。晶格氧参与 OER 时，该信号随反应进行逐渐减弱。',
        relevance: 'OER',
        category: 'substrate',
    },
];

// ==================== 峰归属函数 ====================

export interface PeakAssignment {
    peakCenter: number;
    matchedEntries: {
        entry: IntermediateEntry;
        confidence: number; // 0-1
        distanceFromCenter: number; // cm⁻¹
    }[];
}

/**
 * 自动匹配峰位到中间体指纹库
 * @param peakCenters 检测到的峰位列表 (cm⁻¹)
 * @param tolerance 匹配容差 (cm⁻¹)
 */
export function matchPeaksToIntermediates(
    peakCenters: number[],
    tolerance: number = 30
): PeakAssignment[] {
    return peakCenters.map(center => {
        const matched = INTERMEDIATE_DATABASE
            .filter(entry => {
                const [low, high] = entry.ramanRange;
                return center >= low - tolerance && center <= high + tolerance;
            })
            .map(entry => {
                const [low, high] = entry.ramanRange;
                const rangeMid = (low + high) / 2;
                const rangeSpan = high - low;
                const dist = Math.abs(center - rangeMid);
                // 置信度：越接近范围中心越高
                const confidence = Math.max(0, 1 - dist / (rangeSpan / 2 + tolerance));
                return { entry, confidence, distanceFromCenter: dist };
            })
            .sort((a, b) => b.confidence - a.confidence);

        return { peakCenter: center, matchedEntries: matched };
    });
}

/**
 * 生成峰归属报告
 */
export function generateAssignmentReport(assignments: PeakAssignment[]): string {
    const lines: string[] = ['**原位光谱峰归属报告：**\n'];

    for (const a of assignments) {
        if (a.matchedEntries.length === 0) {
            lines.push(`- **${a.peakCenter} cm⁻¹**：未能匹配到已知中间体（可能为基底信号或新物种）`);
        } else {
            const best = a.matchedEntries[0];
            const confStr = (best.confidence * 100).toFixed(0);
            lines.push(
                `- **${a.peakCenter} cm⁻¹** → ${best.entry.species} (${best.entry.name})，` +
                `振动模式: ${best.entry.vibrationMode}，置信度: ${confStr}%`
            );
            if (a.matchedEntries.length > 1) {
                const alt = a.matchedEntries[1];
                lines.push(`  *备选*: ${alt.entry.species} (${alt.entry.name})，置信度: ${(alt.confidence * 100).toFixed(0)}%`);
            }
        }
    }

    return lines.join('\n');
}
