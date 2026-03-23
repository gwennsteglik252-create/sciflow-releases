import { ParticleData } from './types';
import { applyGrayscale, applyAdaptiveThreshold } from './cvPreprocessing';

const step = 2; // Pixel step for scanning

interface ParticleComponent {
    x: number;
    y: number;
    rx: number;
    ry: number;
    r: number;
    area: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    circularity: number;
    aspectRatio: number;
    points: [number, number][];
}

export interface ParticleDetectionStats {
    rawComponentCount: number;
    finalParticleCount: number;
    splitAddedCount: number;
    agglomerationRatio: number;
}
export type ParticleDetectionStrictness = 'conservative' | 'balanced' | 'aggressive';

const calculateComponentMetrics = (points: [number, number][], area: number) => {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let sumX = 0;
    let sumY = 0;
    for (const [px, py] of points) {
        sumX += px;
        sumY += py;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
    }
    const centerX = sumX / Math.max(area, 1);
    const centerY = sumY / Math.max(area, 1);
    const bboxRx = Math.max((maxX - minX) / 2, 1);
    const bboxRy = Math.max((maxY - minY) / 2, 1);
    const eqRadius = Math.sqrt(Math.max(area, 1) / Math.PI); // Equivalent-area radius
    // Use 2nd-moment axes for tighter fit on fluffy agglomerates
    let varX = 0;
    let varY = 0;
    for (const [px, py] of points) {
        varX += (px - centerX) * (px - centerX);
        varY += (py - centerY) * (py - centerY);
    }
    varX /= Math.max(area, 1);
    varY /= Math.max(area, 1);
    const momentRx = Math.max(2 * Math.sqrt(varX), 1);
    const momentRy = Math.max(2 * Math.sqrt(varY), 1);
    // Clamp moment radii within bbox and equivalent-area constraints
    const clampRx = Math.min(bboxRx, Math.max(momentRx, eqRadius * 0.65));
    const clampRy = Math.min(bboxRy, Math.max(momentRy, eqRadius * 0.65));
    const rx = Math.max(clampRx, 1);
    const ry = Math.max(clampRy, 1);
    const perimeter = Math.max(((maxX - minX) + (maxY - minY)) * 2, 1);
    const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
    const aspectRatio = Math.max(rx, ry) / Math.max(Math.min(rx, ry), 1e-6);
    return {
        x: centerX, y: centerY, rx, ry, r: Math.max(rx, ry),
        minX, maxX, minY, maxY, circularity, aspectRatio
    };
};

const kMeansSplit = (points: [number, number][], k: number, iterations = 8): [number, number][][] => {
    if (points.length < k * 12) return [points];
    const centroids: [number, number][] = [];
    centroids.push(points[Math.floor(points.length / 2)]);
    while (centroids.length < k) {
        let bestPoint = points[0];
        let bestDist = -1;
        for (const pt of points) {
            const minDist = Math.min(...centroids.map(c => (pt[0] - c[0]) ** 2 + (pt[1] - c[1]) ** 2));
            if (minDist > bestDist) {
                bestDist = minDist;
                bestPoint = pt;
            }
        }
        centroids.push(bestPoint);
    }

    let groups: [number, number][][] = Array.from({ length: k }, () => []);
    for (let iter = 0; iter < iterations; iter++) {
        groups = Array.from({ length: k }, () => []);
        for (const pt of points) {
            let idx = 0;
            let bestDist = Number.POSITIVE_INFINITY;
            for (let i = 0; i < centroids.length; i++) {
                const d = (pt[0] - centroids[i][0]) ** 2 + (pt[1] - centroids[i][1]) ** 2;
                if (d < bestDist) {
                    bestDist = d;
                    idx = i;
                }
            }
            groups[idx].push(pt);
        }
        for (let i = 0; i < k; i++) {
            if (groups[i].length === 0) continue;
            const sx = groups[i].reduce((acc, p) => acc + p[0], 0);
            const sy = groups[i].reduce((acc, p) => acc + p[1], 0);
            centroids[i] = [sx / groups[i].length, sy / groups[i].length];
        }
    }
    const valid = groups.filter(g => g.length >= 12);
    return valid.length > 0 ? valid : [points];
};

const extractComponentsFromCanvas = (ctx: CanvasRenderingContext2D, width: number, height: number): ParticleComponent[] => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const gray = applyGrayscale(imageData.data, width, height);
    const binary = applyAdaptiveThreshold(gray, width, height, 31, 15);

    // Detect and exclude bottom databar
    let databarHeight = 0;
    for (let y = height - 1; y > height * 0.5; y--) {
        let darkCount = 0;
        const rowIdx = y * width;
        for (let x = 0; x < width; x += 5) {
            if (gray[rowIdx + x] < 85) darkCount++;
        }
        if (darkCount > (width / 5) * 0.7) databarHeight = height - y;
        else if (databarHeight > 10) break;
    }
    const safetyMargin = databarHeight > 0 ? 15 : 0;
    const effectiveHeight = height - databarHeight - safetyMargin - step;

    const visited = new Uint8Array(width * height);
    const components: ParticleComponent[] = [];

    for (let y = step; y < effectiveHeight; y += 4) {
        for (let x = step; x < width - step; x += 4) {
            const idx = y * width + x;
            if (binary[idx] !== 255 || visited[idx]) continue;

            const q: [number, number][] = [[x, y]];
            visited[idx] = 1;
            const points: [number, number][] = [];
            let head = 0;
            while (head < q.length) {
                const [currX, currY] = q[head++];
                points.push([currX, currY]);
                const neighbors = [[currX + 1, currY], [currX - 1, currY], [currX, currY + 1], [currX, currY - 1]];
                for (const [nx, ny] of neighbors) {
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        const nIdx = ny * width + nx;
                        if (binary[nIdx] === 255 && !visited[nIdx]) {
                            visited[nIdx] = 1;
                            q.push([nx, ny]);
                        }
                    }
                }
                if (q.length > 6000) break;
            }

            const area = points.length;
            if (area <= 20 || area >= (width * height / 10)) continue;
            const metrics = calculateComponentMetrics(points, area);
            if (metrics.circularity <= 0.2) continue;
            components.push({
                ...metrics,
                area,
                points
            });
        }
    }

    // De-duplication for overlapping components
    const filtered: ParticleComponent[] = [];
    components.sort((a, b) => b.area - a.area);
    for (const c of components) {
        if (!filtered.some(f => Math.hypot(f.x - c.x, f.y - c.y) < f.r * 0.75)) {
            filtered.push(c);
        }
    }
    return filtered.slice(0, 500);
};

const componentToParticle = (c: ParticleComponent, id: number, ratio: number): ParticleData => ({
    id,
    x: c.x,
    y: c.y,
    radius: c.r,
    radiusX: c.rx,
    radiusY: c.ry,
    rotation: 0,
    realSize: ratio ? parseFloat((2 * Math.sqrt(c.rx * c.ry) * ratio).toFixed(2)) : undefined
});

export const detectParticlesDetailedFromCanvas = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    ratio: number,
    options?: { splitAgglomerates?: boolean; strictness?: ParticleDetectionStrictness; strictnessLevel?: number }
): { particles: ParticleData[]; stats: ParticleDetectionStats } => {
    try {
        const anchorConservative = { minArea: 30, minCircularity: 0.34, agglomerateAspect: 1.75, agglomerateCirc: 0.52, areaFactor: 1.9, splitFactorBoost: 0 };
        const anchorBalanced = { minArea: 20, minCircularity: 0.22, agglomerateAspect: 1.9, agglomerateCirc: 0.45, areaFactor: 2.2, splitFactorBoost: 0 };
        const anchorAggressive = { minArea: 12, minCircularity: 0.15, agglomerateAspect: 2.1, agglomerateCirc: 0.40, areaFactor: 2.6, splitFactorBoost: 1 };
        const strictnessFromLegacy = options?.strictness === 'conservative' ? 0 : options?.strictness === 'aggressive' ? 100 : 50;
        const level = Math.max(0, Math.min(100, Number(options?.strictnessLevel ?? strictnessFromLegacy)));
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const interpolate = (a: any, b: any, t: number) => ({
            minArea: lerp(a.minArea, b.minArea, t),
            minCircularity: lerp(a.minCircularity, b.minCircularity, t),
            agglomerateAspect: lerp(a.agglomerateAspect, b.agglomerateAspect, t),
            agglomerateCirc: lerp(a.agglomerateCirc, b.agglomerateCirc, t),
            areaFactor: lerp(a.areaFactor, b.areaFactor, t),
            splitFactorBoost: lerp(a.splitFactorBoost, b.splitFactorBoost, t)
        });
        const strictParams = level <= 50
            ? interpolate(anchorConservative, anchorBalanced, level / 50)
            : interpolate(anchorBalanced, anchorAggressive, (level - 50) / 50);

        const components = extractComponentsFromCanvas(ctx, width, height)
            .filter(c => c.area >= strictParams.minArea && c.circularity >= strictParams.minCircularity);
        const sortedAreas = components.map(c => c.area).sort((a, b) => a - b);
        const medianArea = sortedAreas.length ? sortedAreas[Math.floor(sortedAreas.length / 2)] : 0;
        const agglomerates = components.filter(c =>
            c.aspectRatio > strictParams.agglomerateAspect ||
            c.circularity < strictParams.agglomerateCirc ||
            (medianArea > 0 && c.area > medianArea * strictParams.areaFactor)
        );
        const totalArea = components.reduce((sum, c) => sum + c.area, 0);
        const agglomerateArea = agglomerates.reduce((sum, c) => sum + c.area, 0);
        const agglomerationRatio = totalArea > 0 ? (agglomerateArea / totalArea) * 100 : 0;

        const splitAgglomerates = Boolean(options?.splitAgglomerates);
        const expanded: ParticleComponent[] = [];
        for (const comp of components) {
            const shouldSplit = splitAgglomerates && agglomerates.some(a => a === comp);
            if (!shouldSplit) {
                expanded.push(comp);
                continue;
            }
            const splitFactor = (comp.area > medianArea * 4 ? 3 : 2) + Math.round(strictParams.splitFactorBoost);
            const groups = kMeansSplit(comp.points, splitFactor);
            if (groups.length <= 1) {
                expanded.push(comp);
                continue;
            }
            for (const g of groups) {
                const area = g.length;
                if (area < 12) continue;
                const m = calculateComponentMetrics(g, area);
                expanded.push({
                    ...m,
                    area,
                    points: g
                });
            }
        }

        const finalParticles = expanded
            .sort((a, b) => b.area - a.area)
            .slice(0, 500)
            .map((c, i) => componentToParticle(c, i + 1, ratio));

        return {
            particles: finalParticles,
            stats: {
                rawComponentCount: components.length,
                finalParticleCount: finalParticles.length,
                splitAddedCount: Math.max(0, finalParticles.length - components.length),
                agglomerationRatio
            }
        };
    } catch (e) {
        console.error("DR Error", e);
        return {
            particles: [],
            stats: {
                rawComponentCount: 0,
                finalParticleCount: 0,
                splitAddedCount: 0,
                agglomerationRatio: 0
            }
        };
    }
};

export const detectParticlesFromCanvas = (ctx: CanvasRenderingContext2D, width: number, height: number, ratio: number): ParticleData[] => {
    return detectParticlesDetailedFromCanvas(ctx, width, height, ratio, { splitAgglomerates: false, strictnessLevel: 50 }).particles;
};

export const analyzeSheetStructure = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const data = ctx.getImageData(0, 0, width, height).data;
    let totalLuma = 0; const grayscale = new Uint8Array(width * height); const overlayData = new Uint8ClampedArray(data.length);
    for (let i = 0; i < width * height; i++) {
        const luma = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
        grayscale[i] = luma; totalLuma += luma;
    }
    const voidThreshold = (totalLuma / (width * height)) * 0.65; let voidPixels = 0;
    for (let i = 0; i < width * height; i++) {
        if (grayscale[i] < voidThreshold) {
            voidPixels++; overlayData[i * 4] = 255; overlayData[i * 4 + 3] = 120;
        }
    }
    let edgePixels = 0;
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const gx = (-1 * grayscale[idx - width - 1]) + (1 * grayscale[idx - width + 1]) + (-2 * grayscale[idx - 1]) + (2 * grayscale[idx + 1]) + (-1 * grayscale[idx + width - 1]) + (1 * grayscale[idx + width + 1]);
            const gy = (-1 * grayscale[idx - width - 1]) + (-2 * grayscale[idx - width]) + (-1 * grayscale[idx - width + 1]) + (1 * grayscale[idx + width - 1]) + (2 * grayscale[idx + width]) + (1 * grayscale[idx + width + 1]);
            if (Math.sqrt(gx * gx + gy * gy) > 50) edgePixels++;
        }
    }
    return { porosity: (voidPixels / (width * height)) * 100, edgeDensity: (edgePixels / (width * height)) * 100, overlay: new ImageData(overlayData, width, height) };
};

export function analyzeDefects(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const data = ctx.getImageData(0, 0, width, height).data;
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    const gradients = new Float32Array(width * height); let maxGrad = 0;
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const gx = -gray[idx - width - 1] + gray[idx - width + 1] - 2 * gray[idx - 1] + 2 * gray[idx + 1] - gray[idx + width - 1] + gray[idx + width + 1];
            const gy = -gray[idx - width - 1] - 2 * gray[idx - width] - gray[idx - width + 1] + gray[idx + width - 1] + 2 * gray[idx + width] + gray[idx + width + 1];
            gradients[idx] = Math.sqrt(gx * gx + gy * gy); if (gradients[idx] > maxGrad) maxGrad = gradients[idx];
        }
    }
    const defectMap = new Uint8ClampedArray(data.length); let defectPixelCount = 0;
    for (let y = 0; y < height; y += 5) {
        for (let x = 0; x < width; x += 5) {
            let s = 0, s2 = 0, c = 0;
            for (let by = 0; by < 5; by++) {
                for (let bx = 0; bx < 5; bx++) {
                    const cy = y + by, cx = x + bx;
                    if (cy < height && cx < width) { const v = gradients[cy * width + cx]; s += v; s2 += v * v; c++; }
                }
            }
            if (c > 0 && Math.sqrt((s2 / c) - (s / c) * (s / c)) > (maxGrad * 0.18)) {
                defectPixelCount += c;
                for (let by = 0; by < 5; by++) for (let bx = 0; bx < 5; bx++) {
                    const ci = ((y + by) * width + (x + bx)) * 4; if (ci < data.length) { defectMap[ci] = 255; defectMap[ci + 1] = 191; defectMap[ci + 3] = 120; }
                }
            }
        }
    }
    return { defectDensity: (defectPixelCount / (width * height)) * 100, activeSitesEstimate: 'Mixed', overlay: new ImageData(defectMap, width, height) };
}

/**
 * SAED 衍射环分析
 * 从衍射图像的指定中心点出发，计算径向强度分布，识别峰值位置作为衍射环
 */
export function analyzeSAED(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    centerX: number,
    centerY: number,
    scaleRatio: number | null
): { rings: Array<{ radiusPx: number; dSpacing: number; hkl?: string; material?: string; intensity?: number }>; crystalType: string } {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const gray = applyGrayscale(data, width, height);

    // Calculate radial intensity profile
    const maxRadius = Math.min(
        centerX, centerY, width - centerX, height - centerY,
        Math.floor(Math.min(width, height) / 2)
    );
    const profile = new Float32Array(maxRadius);
    const counts = new Uint32Array(maxRadius);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const r = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
            const ri = Math.floor(r);
            if (ri < maxRadius) {
                profile[ri] += gray[y * width + x];
                counts[ri]++;
            }
        }
    }

    // Normalize
    for (let i = 0; i < maxRadius; i++) {
        if (counts[i] > 0) profile[i] /= counts[i];
    }

    // Find peaks in radial profile (simple local maxima with prominence check)
    const rings: Array<{ radiusPx: number; dSpacing: number; hkl?: string; material?: string; intensity?: number }> = [];
    const minRadius = 10;
    const windowSize = 5;
    let maxIntensity = 0;

    for (let i = minRadius; i < maxRadius - windowSize; i++) {
        let isMax = true;
        for (let j = -windowSize; j <= windowSize; j++) {
            if (j !== 0 && profile[i + j] >= profile[i]) {
                isMax = false;
                break;
            }
        }
        if (isMax && profile[i] > 30) {
            const dSpacing = scaleRatio ? (1 / (i * scaleRatio)) * 100 : i * 0.005;
            rings.push({ radiusPx: i, dSpacing, intensity: profile[i] });
            if (profile[i] > maxIntensity) maxIntensity = profile[i];
        }
    }

    // Match known d-spacings
    const knownPhases = [
        { d: 0.235, hkl: '(111)', material: 'Ag' },
        { d: 0.204, hkl: '(200)', material: 'Ag' },
        { d: 0.144, hkl: '(220)', material: 'Ag' },
        { d: 0.226, hkl: '(111)', material: 'Pt' },
        { d: 0.196, hkl: '(200)', material: 'Pt' },
        { d: 0.252, hkl: '(111)', material: 'CuO' },
        { d: 0.246, hkl: '(100)', material: 'Co' },
        { d: 0.205, hkl: '(111)', material: 'Co' },
        { d: 0.203, hkl: '(111)', material: 'Fe' },
        { d: 0.248, hkl: '(311)', material: 'Fe₃O₄' },
        { d: 0.297, hkl: '(220)', material: 'Fe₃O₄' },
    ];

    // Limit to top 6 rings by intensity
    rings.sort((a, b) => (b.intensity || 0) - (a.intensity || 0));
    const topRings = rings.slice(0, 6).map(r => {
        const normalized = maxIntensity > 0 ? (r.intensity || 0) / maxIntensity : 0;
        const match = knownPhases.find(p => Math.abs(p.d - r.dSpacing) < 0.015);
        return { ...r, intensity: normalized, hkl: match?.hkl, material: match?.material };
    });
    topRings.sort((a, b) => a.radiusPx - b.radiusPx);

    let crystalType: string = 'unknown';
    if (topRings.length >= 3) crystalType = 'polycrystalline';
    else if (topRings.length >= 1) crystalType = 'single-crystal';
    else crystalType = 'amorphous';

    return { rings: topRings, crystalType };
}

/**
 * 计算两组晶格条纹之间的夹角
 */
export function calculateInterplanarAngle(
    line1: { start: { x: number; y: number }; end: { x: number; y: number } },
    line2: { start: { x: number; y: number }; end: { x: number; y: number } },
    scaleRatio: number,
    layers1: number,
    layers2: number
): { line1DSpacing: number; line2DSpacing: number; angleDeg: number; zoneAxis?: string; line1Plane?: string; line2Plane?: string } {
    const dist1 = Math.hypot(line1.end.x - line1.start.x, line1.end.y - line1.start.y);
    const dist2 = Math.hypot(line2.end.x - line2.start.x, line2.end.y - line2.start.y);
    const d1 = (dist1 * scaleRatio) / layers1;
    const d2 = (dist2 * scaleRatio) / layers2;

    const v1x = line1.end.x - line1.start.x;
    const v1y = line1.end.y - line1.start.y;
    const v2x = line2.end.x - line2.start.x;
    const v2y = line2.end.y - line2.start.y;

    const dot = v1x * v2x + v1y * v2y;
    const mag1 = Math.hypot(v1x, v1y);
    const mag2 = Math.hypot(v2x, v2y);
    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    const angleDeg = Math.acos(Math.abs(cosAngle)) * (180 / Math.PI);

    const matchPlane = (d: number): string | undefined => {
        if (Math.abs(d - 0.235) < 0.015) return '(111)';
        if (Math.abs(d - 0.204) < 0.015) return '(200)';
        if (Math.abs(d - 0.144) < 0.015) return '(220)';
        if (Math.abs(d - 0.118) < 0.015) return '(311)';
        if (Math.abs(d - 0.226) < 0.015) return '(111)';
        if (Math.abs(d - 0.196) < 0.015) return '(200)';
        return undefined;
    };

    const line1Plane = matchPlane(d1);
    const line2Plane = matchPlane(d2);

    let zoneAxis: string | undefined;
    const angRounded = Math.round(angleDeg);
    if (line1Plane === '(111)' && line2Plane === '(200)' && Math.abs(angRounded - 55) < 5) zoneAxis = '[110]';
    else if (line1Plane === '(111)' && line2Plane === '(220)' && Math.abs(angRounded - 35) < 5) zoneAxis = '[112]';
    else if (line1Plane === '(200)' && line2Plane === '(220)' && Math.abs(angRounded - 45) < 5) zoneAxis = '[001]';
    else if (line1Plane === '(111)' && line2Plane === '(111)' && Math.abs(angRounded - 70) < 5) zoneAxis = '[110]';

    return { line1DSpacing: d1, line2DSpacing: d2, angleDeg, zoneAxis, line1Plane, line2Plane };
}
