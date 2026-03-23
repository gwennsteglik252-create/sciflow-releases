const fft1D = (data: Float64Array, n: number, inv: boolean = false): { real: Float64Array, imag: Float64Array } => {
    if (n <= 1) return { real: data, imag: new Float64Array(n) };
    const half = n / 2; const even = new Float64Array(half); const odd = new Float64Array(half);
    for (let i = 0; i < half; i++) { even[i] = data[2 * i]; odd[i] = data[2 * i + 1]; }
    const rE = fft1D(even, half, inv), rO = fft1D(odd, half, inv);
    const real = new Float64Array(n), imag = new Float64Array(n), angle = (inv ? -2 : 2) * Math.PI / n;
    for (let k = 0; k < half; k++) {
        const wR = Math.cos(angle * k), wI = Math.sin(angle * k);
        const tR = wR * rO.real[k] - wI * rO.imag[k], tI = wR * rO.imag[k] + wI * rO.real[k];
        real[k] = rE.real[k] + tR; imag[k] = rE.imag[k] + tI; real[k + half] = rE.real[k] - tR; imag[k + half] = rE.imag[k] - tI;
    }
    return { real, imag };
};

export const performLocalFFT = (ctx: CanvasRenderingContext2D, sx: number, sy: number, size: number = 128): ImageData | null => {
    try {
        const data = ctx.getImageData(sx, sy, size, size).data;
        const n = size; const iR = new Float64Array(n * n), iI = new Float64Array(n * n);
        // Apply Hann window and convert to grayscale
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
            const idx = (y * n + x) * 4; iR[y * n + x] = (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]) * (0.5 * (1 - Math.cos(2 * Math.PI * x / (n - 1)))) * (0.5 * (1 - Math.cos(2 * Math.PI * y / (n - 1))));
        }
        // Row-wise FFT
        for (let y = 0; y < n; y++) {
            const rowR = iR.slice(y * n, y * n + n);
            const res = fft1D(rowR, n);
            for (let x = 0; x < n; x++) { iR[y * n + x] = res.real[x]; iI[y * n + x] = res.imag[x]; }
        }
        // Column-wise FFT (required for complete 2D FFT)
        for (let x = 0; x < n; x++) {
            const colR = new Float64Array(n), colI = new Float64Array(n);
            for (let y = 0; y < n; y++) { colR[y] = iR[y * n + x]; colI[y] = iI[y * n + x]; }
            const resR = fft1D(colR, n);
            const resI = fft1D(colI, n);
            for (let y = 0; y < n; y++) {
                iR[y * n + x] = resR.real[y] - resI.imag[y];
                iI[y * n + x] = resR.imag[y] + resI.real[y];
            }
        }
        // Compute magnitude spectrum with DC-center shift
        const spec = new Float64Array(n * n); let max = 0;
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
            const mag = Math.sqrt(iR[y * n + x] ** 2 + iI[y * n + x] ** 2);
            spec[((y + n / 2) % n) * n + (x + n / 2) % n] = mag; if (mag > max) max = mag;
        }
        // Log-scale normalization to output ImageData
        const out = new ImageData(n, n); const logMax = Math.log(1 + max);
        for (let i = 0; i < n * n; i++) { const v = Math.log(1 + spec[i]) / logMax * 255; out.data[i * 4] = v; out.data[i * 4 + 1] = v; out.data[i * 4 + 2] = v; out.data[i * 4 + 3] = 255; }
        return out;
    } catch (e) { return null; }
};