
/**
 * cvPreprocessing.ts
 * Filters for image normalization and noise reduction
 */

/**
 * applyGrayscale
 * Converts RGBA to grayscale Luma channel
 */
export const applyGrayscale = (data: Uint8ClampedArray, width: number, height: number): Uint8Array => {
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
    return gray;
};

/**
 * applyAdaptiveThreshold
 * Computes a local threshold for each pixel based on its neighbor average.
 * Robust against uneven lighting in SEM images.
 */
export const applyAdaptiveThreshold = (
    gray: Uint8Array,
    width: number,
    height: number,
    blockSize: number = 25,
    C: number = 10
): Uint8Array => {
    const binary = new Uint8Array(width * height);
    const integral = new Uint32Array(width * height);

    // Build integral image for fast local average calculation
    for (let y = 0; y < height; y++) {
        let sum = 0;
        for (let x = 0; x < width; x++) {
            sum += gray[y * width + x];
            integral[y * width + x] = (y > 0 ? integral[(y - 1) * width + x] : 0) + sum;
        }
    }

    const offset = Math.floor(blockSize / 2);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const x1 = Math.max(0, x - offset);
            const x2 = Math.min(width - 1, x + offset);
            const y1 = Math.max(0, y - offset);
            const y2 = Math.min(height - 1, y + offset);

            const count = (x2 - x1 + 1) * (y2 - y1 + 1);
            const sum = integral[y2 * width + x2]
                - (y1 > 0 ? integral[(y1 - 1) * width + x2] : 0)
                - (x1 > 0 ? integral[y2 * width + (x1 - 1)] : 0)
                + (y1 > 0 && x1 > 0 ? integral[(y1 - 1) * width + (x1 - 1)] : 0);

            const avg = sum / count;
            // For SEM particles (usually brighter than background), use local mean - C
            binary[y * width + x] = gray[y * width + x] > (avg - C) ? 255 : 0;
        }
    }
    return binary;
};
