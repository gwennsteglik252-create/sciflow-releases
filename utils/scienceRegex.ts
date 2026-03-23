
// Library of regular expressions for scientific text extraction

export const SCIENCE_REGEX = {
    Ag: /Ag\s*[:=]\s*(\d+(?:\.\d+)?%?)/i,
    E12: /(?:E1\/2|E_{1\/2}|Half-wave)\s*[:=]\s*([\d.]+\s*V?)/i,
    j: /(?:j|Current|Density)\s*[:=]\s*([\d.]+\s*(?:mA|A)?)/i
};

export const extractMetric = (text: string | undefined | null, regex: RegExp): string => {
    if (!text) return '-';
    const match = text.match(regex);
    return match ? match[1] : '-';
};
