/**
 * COD (Crystallography Open Database) Service
 * 提供真实晶体结构数据查询和 XRD 衍射峰计算
 *
 * API: https://www.crystallography.net/cod/result
 * 文档: https://wiki.crystallography.net/RESTful_API/
 */

const COD_BASE_URL = 'https://www.crystallography.net/cod/result';
const CU_KA_LAMBDA = 1.5406; // Cu Kα 波长 (Å) — 必须与 COD 晶格参数同单位
const MAX_HKL = 8; // hkl 扫描最大范围
const TWO_THETA_MAX = 90; // 最大 2θ 角度

// ═══════════════════════════════════════════
// 晶系类型
// ═══════════════════════════════════════════
type CrystalSystem = 'cubic' | 'tetragonal' | 'orthorhombic' | 'hexagonal' | 'trigonal' | 'monoclinic' | 'triclinic';

function classifyCrystalSystem(sgNumber: number): CrystalSystem {
    if (sgNumber >= 195) return 'cubic';
    if (sgNumber >= 143 && sgNumber <= 167) return 'trigonal';
    if (sgNumber >= 168 && sgNumber <= 194) return 'hexagonal';
    if (sgNumber >= 75 && sgNumber <= 142) return 'tetragonal';
    if (sgNumber >= 16 && sgNumber <= 74) return 'orthorhombic';
    if (sgNumber >= 3 && sgNumber <= 15) return 'monoclinic';
    return 'triclinic';
}

// ═══════════════════════════════════════════
// d-spacing 计算 (各晶系)
// ═══════════════════════════════════════════
function calcDSpacing(
    h: number, k: number, l: number,
    a: number, b: number, c: number,
    alpha: number, beta: number, gamma: number,
    system: CrystalSystem
): number {
    if (h === 0 && k === 0 && l === 0) return Infinity;

    const toRad = (deg: number) => deg * Math.PI / 180;

    switch (system) {
        case 'cubic':
            return a / Math.sqrt(h * h + k * k + l * l);

        case 'tetragonal':
            return 1 / Math.sqrt((h * h + k * k) / (a * a) + (l * l) / (c * c));

        case 'orthorhombic':
            return 1 / Math.sqrt((h * h) / (a * a) + (k * k) / (b * b) + (l * l) / (c * c));

        case 'hexagonal':
        case 'trigonal':
            if (Math.abs(alpha - 90) < 0.1 && Math.abs(gamma - 120) < 0.1) {
                // Hexagonal axes
                return 1 / Math.sqrt(4 * (h * h + h * k + k * k) / (3 * a * a) + (l * l) / (c * c));
            } else {
                // Rhombohedral – fall through to triclinic
                return calcDSpacingTriclinic(h, k, l, a, b, c, alpha, beta, gamma);
            }

        case 'monoclinic': {
            const betaRad = toRad(beta);
            const sinB = Math.sin(betaRad);
            const cosB = Math.cos(betaRad);
            const invD2 = (1 / (sinB * sinB)) * (
                (h * h) / (a * a) +
                (k * k * sinB * sinB) / (b * b) +
                (l * l) / (c * c) -
                (2 * h * l * cosB) / (a * c)
            );
            return 1 / Math.sqrt(invD2);
        }

        case 'triclinic':
        default:
            return calcDSpacingTriclinic(h, k, l, a, b, c, alpha, beta, gamma);
    }
}

function calcDSpacingTriclinic(
    h: number, k: number, l: number,
    a: number, b: number, c: number,
    alphaDeg: number, betaDeg: number, gammaDeg: number
): number {
    const toRad = (d: number) => d * Math.PI / 180;
    const al = toRad(alphaDeg), be = toRad(betaDeg), ga = toRad(gammaDeg);
    const ca = Math.cos(al), cb = Math.cos(be), cg = Math.cos(ga);
    const sa = Math.sin(al), sb = Math.sin(be), sg = Math.sin(ga);

    const V = a * b * c * Math.sqrt(1 - ca * ca - cb * cb - cg * cg + 2 * ca * cb * cg);

    const S11 = (b * c * sa) ** 2;
    const S22 = (a * c * sb) ** 2;
    const S33 = (a * b * sg) ** 2;
    const S12 = a * b * c * c * (ca * cb - cg);
    const S23 = a * a * b * c * (cb * cg - ca);
    const S13 = a * b * b * c * (cg * ca - cb);

    const invD2 = (1 / (V * V)) * (
        S11 * h * h + S22 * k * k + S33 * l * l +
        2 * S12 * h * k + 2 * S23 * k * l + 2 * S13 * h * l
    );

    return 1 / Math.sqrt(Math.abs(invD2));
}

// ═══════════════════════════════════════════
// 系统消光规则
// ═══════════════════════════════════════════
function isAllowedByLattice(h: number, k: number, l: number, sgHall: string, sgNumber: number): boolean {
    // 基于布拉维格子类型的消光规则
    const sgUpper = (sgHall || '').toUpperCase();

    // F 格子 (Face-centered): h,k,l 全奇或全偶
    if (sgUpper.startsWith('-F') || sgUpper.startsWith('F')) {
        const sum = h + k + l;
        const allEven = (h % 2 === 0 && k % 2 === 0 && l % 2 === 0);
        const allOdd = (Math.abs(h) % 2 === 1 && Math.abs(k) % 2 === 1 && Math.abs(l) % 2 === 1);
        if (!allEven && !allOdd) return false;
    }

    // I 格子 (Body-centered): h+k+l = 偶数
    if (sgUpper.startsWith('-I') || sgUpper.startsWith('I')) {
        if ((h + k + l) % 2 !== 0) return false;
    }

    // A 格子: k+l = 偶数
    if (sgUpper.startsWith('-A') || sgUpper.startsWith('A')) {
        if ((k + l) % 2 !== 0) return false;
    }

    // B 格子: h+l = 偶数
    if (sgUpper.startsWith('-B') || sgUpper.startsWith('B')) {
        if ((h + l) % 2 !== 0) return false;
    }

    // C 格子: h+k = 偶数
    if (sgUpper.startsWith('-C') || sgUpper.startsWith('C')) {
        if ((h + k) % 2 !== 0) return false;
    }

    // R 格子 (Rhombohedral, hexagonal axes): -h+k+l = 3n
    if (sgUpper.startsWith('-R') || sgUpper.startsWith('R')) {
        if ((-h + k + l) % 3 !== 0) return false;
    }

    return true;
}

// ═══════════════════════════════════════════
// XRD 峰位计算引擎
// ═══════════════════════════════════════════
interface CalculatedPeak {
    twoTheta: number;
    dSpacing: number;
    hkl: string;
    intensity: number;
    h: number;
    k: number;
    l: number;
}

export function calculateXrdPeaks(
    a: number, b: number, c: number,
    alpha: number, beta: number, gamma: number,
    sgNumber: number,
    sgHall: string
): CalculatedPeak[] {
    const system = classifyCrystalSystem(sgNumber);
    const peaks: CalculatedPeak[] = [];
    const seen = new Set<string>();

    for (let h = -MAX_HKL; h <= MAX_HKL; h++) {
        for (let k = -MAX_HKL; k <= MAX_HKL; k++) {
            for (let l = -MAX_HKL; l <= MAX_HKL; l++) {
                if (h === 0 && k === 0 && l === 0) continue;

                // 去重：(h,k,l) 和 (-h,-k,-l) 产生相同衍射
                const key = [Math.abs(h), Math.abs(k), Math.abs(l)].sort((x, y) => y - x).join(',');

                // 各晶系的等效性去重
                let canonKey = key;
                if (system === 'cubic') {
                    canonKey = [Math.abs(h), Math.abs(k), Math.abs(l)].sort((x, y) => y - x).join(',');
                } else if (system === 'tetragonal') {
                    const hk = [Math.abs(h), Math.abs(k)].sort((x, y) => y - x);
                    canonKey = [...hk, Math.abs(l)].join(',');
                } else if (system === 'hexagonal' || system === 'trigonal') {
                    // Hexagonal: (h,k,l) ≡ (k,h,l) etc.
                    const sorted = [Math.abs(h), Math.abs(k), Math.abs(h + k)].sort((x, y) => y - x);
                    canonKey = [...sorted, Math.abs(l)].join(',');
                }

                if (seen.has(canonKey)) continue;

                // 系统消光检查
                if (!isAllowedByLattice(h, k, l, sgHall, sgNumber)) continue;

                const d = calcDSpacing(h, k, l, a, b, c, alpha, beta, gamma, system);
                if (!Number.isFinite(d) || d <= 0) continue;

                // 2θ = 2 * arcsin(λ / (2d))
                const sinArg = CU_KA_LAMBDA / (2 * d);
                if (Math.abs(sinArg) > 1) continue; // 超出衍射范围

                const twoTheta = 2 * Math.asin(sinArg) * (180 / Math.PI);
                if (twoTheta < 5 || twoTheta > TWO_THETA_MAX) continue;

                seen.add(canonKey);

                // 多重度 (multiplicity) 作为粗略强度估计
                const multiplicity = estimateMultiplicity(h, k, l, system);

                peaks.push({
                    twoTheta: Math.round(twoTheta * 1000) / 1000,
                    dSpacing: Math.round(d * 10000) / 10000,
                    hkl: `(${Math.abs(h)}${Math.abs(k)}${Math.abs(l)})`,
                    intensity: multiplicity,
                    h: Math.abs(h), k: Math.abs(k), l: Math.abs(l)
                });
            }
        }
    }

    // 按 2θ 排序
    peaks.sort((a, b) => a.twoTheta - b.twoTheta);

    // 归一化强度到 0-100
    if (peaks.length > 0) {
        const maxI = Math.max(...peaks.map(p => p.intensity));
        peaks.forEach(p => {
            p.intensity = Math.round((p.intensity / maxI) * 100);
        });
    }

    // 过滤弱峰（强度<5% 的最大强度），只取前 8 个最强峰
    const minIntensity = Math.max(...peaks.map(p => p.intensity)) * 0.05;
    const filtered = peaks.filter(p => p.intensity >= minIntensity);
    const topPeaks = [...filtered].sort((a, b) => b.intensity - a.intensity).slice(0, 8);
    topPeaks.sort((a, b) => a.twoTheta - b.twoTheta);

    return topPeaks;
}

function estimateMultiplicity(h: number, k: number, l: number, system: CrystalSystem): number {
    const ah = Math.abs(h), ak = Math.abs(k), al = Math.abs(l);
    const vals = [ah, ak, al];
    const zeros = vals.filter(v => v === 0).length;
    const unique = new Set(vals).size;

    switch (system) {
        case 'cubic':
            if (zeros === 2) return 6;           // (h00)
            if (zeros === 1 && unique === 2) return 24; // (hk0)
            if (zeros === 1) return 12;          // (hh0)
            if (unique === 1) return 8;          // (hhh)
            if (unique === 2) return 24;         // (hhk)
            return 48;                           // (hkl)
        case 'tetragonal':
            if (zeros === 2) {
                if (al === 0) return 4; // (h00)
                return 2; // (00l)
            }
            if (ah === ak && al === 0) return 4;
            if (al === 0) return 8;
            if (ah === 0 || ak === 0) return 8;
            if (ah === ak) return 8;
            return 16;
        case 'hexagonal':
        case 'trigonal':
            if (zeros === 2) return al === 0 ? 6 : 2;
            if (al === 0) return ah === ak ? 6 : 12;
            if (ah === 0 || ak === 0) return 6;
            if (ah === ak) return 12;
            return 24;
        case 'orthorhombic':
            if (zeros === 2) return 2;
            if (zeros === 1) return 4;
            return 8;
        case 'monoclinic':
            if (zeros >= 1 && ak === 0) return 2;
            if (zeros >= 1) return 2;
            return 4;
        case 'triclinic':
        default:
            return 2;
    }
}

// ═══════════════════════════════════════════
// COD REST API 查询
// ═══════════════════════════════════════════
interface CODEntry {
    file: string;
    a: string; b: string; c: string;
    alpha: string; beta: string; gamma: string;
    sg: string;
    sgHall: string;
    sgNumber: string;
    formula: string;
    calcformula: string;
    chemname: string | null;
    mineral: string | null;
    commonname: string | null;
    nel: string;
    Z: string;
    authors: string | null;
    journal: string | null;
    year: string | null;
    doi: string | null;
    title: string | null;
}

export interface CODPhaseResult {
    name: string;
    card: string;
    crystalSystem: string;
    spaceGroup: string;
    latticeParams: string;
    source: 'COD' | 'AI';
    codId?: string;
    reference?: string;
    peaks: Array<{
        twoTheta: number;
        intensity: number;
        dSpacing: number;
        hkl: string;
    }>;
}

function crystalSystemLabel(sgNumber: number): string {
    const sys = classifyCrystalSystem(sgNumber);
    const labels: Record<CrystalSystem, string> = {
        cubic: 'Cubic',
        tetragonal: 'Tetragonal',
        orthorhombic: 'Orthorhombic',
        hexagonal: 'Hexagonal',
        trigonal: 'Trigonal',
        monoclinic: 'Monoclinic',
        triclinic: 'Triclinic'
    };
    return labels[sys];
}

function formatFormula(raw: string): string {
    // COD formula: "- C Na2 O3 -" → "C Na2 O3" (保留元素间空格，更易读)
    return raw.replace(/^-\s*/, '').replace(/\s*-$/, '').trim();
}

function formatFormulaCompact(raw: string): string {
    // COD formula: "- C Na2 O3 -" → "Na2CO3" (紧凑化学式)
    const cleaned = raw.replace(/^-\s*/, '').replace(/\s*-$/, '').trim();
    // 将 Hill Notation 转为紧凑格式：拼接元素符号和数字
    return cleaned.replace(/\s+/g, '');
}

function buildReference(entry: CODEntry): string {
    const parts: string[] = [];
    if (entry.authors) parts.push(entry.authors.split(';')[0]?.trim() + ' et al.');
    if (entry.journal) parts.push(entry.journal);
    if (entry.year) parts.push(`(${entry.year})`);
    return parts.join(', ') || '';
}

function codEntryToPhase(entry: CODEntry): CODPhaseResult | null {
    const a = parseFloat(entry.a);
    const b = parseFloat(entry.b);
    const c = parseFloat(entry.c);
    const alpha = parseFloat(entry.alpha);
    const beta = parseFloat(entry.beta);
    const gamma = parseFloat(entry.gamma);
    const sgNum = parseInt(entry.sgNumber);

    if ([a, b, c, alpha, beta, gamma, sgNum].some(v => !Number.isFinite(v) || v <= 0)) return null;

    const peaks = calculateXrdPeaks(a, b, c, alpha, beta, gamma, sgNum, entry.sgHall || '');
    if (peaks.length < 2) return null;

    const formula = formatFormulaCompact(entry.calcformula || entry.formula || '');
    // 优先使用有意义的名称（chemname > mineral > commonname）
    const friendlyName = entry.chemname?.replace(/<[^>]*>/g, '') || entry.mineral || entry.commonname || '';
    // 构建显示名称：有友好名则 "Natrite (Na2CO3)"，否则直接显示化学式
    const displayName = friendlyName ? `${friendlyName} (${formula})` : formula;

    return {
        name: displayName,
        card: `COD#${entry.file}`,
        crystalSystem: crystalSystemLabel(sgNum),
        spaceGroup: entry.sg || '',
        latticeParams: `a=${a}, b=${b}, c=${c} Å`,
        source: 'COD',
        codId: entry.file,
        reference: buildReference(entry),
        peaks: peaks.map(p => ({
            twoTheta: p.twoTheta,
            intensity: p.intensity,
            dSpacing: Math.round((p.dSpacing / 10) * 10000) / 10000, // Å → nm (UI 需要 nm 单位)
            hkl: p.hkl
        }))
    };
}

/**
 * 从 COD 数据库搜索晶体结构并计算 XRD 峰位
 * @param query  用户搜索关键词或化学式
 * @param hillFormula 可选的 Hill Notation 格式化学式（由 AI 辅助格式化）
 */
export async function searchCOD(query: string, hillFormula?: string): Promise<{ phases: CODPhaseResult[] }> {
    const phases: CODPhaseResult[] = [];

    try {
        // 方案1：精确化学式搜索
        if (hillFormula) {
            const formulaResults = await fetchCODJson({ formula: hillFormula });
            for (const entry of formulaResults.slice(0, 8)) {
                const phase = codEntryToPhase(entry);
                if (phase) phases.push(phase);
            }
        }

        // 方案2：关键词搜索（如果化学式无结果或未提供）
        if (phases.length === 0) {
            const textResults = await fetchCODJson({ text: query });
            // 过滤：只保留 nel <= 4 的（简单化合物，避免复杂有机物）
            const simpleResults = textResults.filter(e => parseInt(e.nel || '99') <= 6);
            for (const entry of simpleResults.slice(0, 8)) {
                const phase = codEntryToPhase(entry);
                if (phase) phases.push(phase);
            }
        }

        // 去重：按空间群+化学式联合去重，最多返回 6 个晶相
        const deduped = deduplicatePhases(phases).slice(0, 6);
        return { phases: deduped };
    } catch (err) {
        console.warn('[COD] Search failed, will fallback to AI:', err);
        return { phases: [] };
    }
}

function deduplicatePhases(phases: CODPhaseResult[]): CODPhaseResult[] {
    // 按空间群 + 化学式联合去重（不同材料可能有相同空间群，如 NaCl 和 MgO 都是 Fm-3m）
    const seen = new Map<string, CODPhaseResult>();
    for (const p of phases) {
        // 从名称中提取化学式部分用于去重
        const formulaPart = (p.name.match(/\(([^)]+)\)/) || ['', p.name])[1];
        const key = `${p.spaceGroup.replace(/\s+/g, '')}|${formulaPart}`.toLowerCase();
        if (!seen.has(key)) {
            seen.set(key, p);
        }
    }
    return Array.from(seen.values());
}

async function fetchCODJson(params: Record<string, string>): Promise<CODEntry[]> {
    const url = new URL(COD_BASE_URL);
    url.searchParams.set('format', 'json');
    url.searchParams.set('maxresults', '20'); // 限制结果数量避免超时
    for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
    }

    console.log(`[COD] Fetching: ${url.toString()}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s 超时

    try {
        const resp = await fetch(url.toString(), {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeout);

        if (!resp.ok) {
            console.warn(`[COD] HTTP error: ${resp.status} ${resp.statusText}`);
            throw new Error(`COD HTTP ${resp.status}`);
        }

        const text = await resp.text();
        console.log(`[COD] Response size: ${text.length} chars`);

        const data = JSON.parse(text);

        if (!Array.isArray(data)) {
            console.warn('[COD] Response is not an array:', typeof data);
            return [];
        }

        console.log(`[COD] Found ${data.length} entries`);
        return data as CODEntry[];
    } catch (err: any) {
        clearTimeout(timeout);
        console.error(`[COD] Fetch failed:`, err?.message || err);
        throw err;
    }
}
