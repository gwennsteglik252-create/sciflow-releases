
export const resizeForAI = (base64: string, maxDim: number = 1024): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            if (w > h && w > maxDim) { h *= maxDim / w; w = maxDim; }
            else if (h > maxDim) { w *= maxDim / h; h = maxDim; }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.width > 0 ? canvas.getContext('2d') : null;
            if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'medium';
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/png', 0.8));
            } else resolve(base64);
        };
        img.onerror = () => resolve(base64);
    });
};

export const ACADEMIC_PALETTES = [
    // === 顶刊风格系列 (Journal-Inspired) ===
    { name: 'Nature', colors: ['#2166AC', '#67A9CF', '#F7F7F7', '#EF8A62', '#B2182B'], desc: 'Nature 经典 Diverging — 蓝白红渐变' },
    { name: 'Science', colors: ['#1B4F72', '#2E86C1', '#85C1E9', '#F0B27A', '#CA6F1E'], desc: 'Science 蓝橙系 — 冷暖对比' },
    { name: 'Cell', colors: ['#4A235A', '#7D3C98', '#AF7AC5', '#F5CBA7', '#E67E22'], desc: 'Cell 紫橙系 — 高辨识配色' },
    { name: 'JACS', colors: ['#1A237E', '#283593', '#5C6BC0', '#9FA8DA', '#C5CAE9'], desc: 'JACS 靛蓝序列 — 端庄典雅' },
    { name: 'Angew. Chem.', colors: ['#004D40', '#00897B', '#4DB6AC', '#E0F2F1', '#FF6F00'], desc: 'Angew 青绿+橙 — 清透兼具焦点' },
    { name: 'ACS Nano', colors: ['#0D47A1', '#E53935', '#43A047', '#FB8C00', '#8E24AA'], desc: 'ACS Nano 多色 — 高辨识多步流程' },

    // === 科学领域配色 (Domain-Specific) ===
    { name: 'Electrochemistry', colors: ['#1565C0', '#0277BD', '#00838F', '#00695C', '#2E7D32'], desc: '冷色梯度 — 电化学/催化' },
    { name: 'Biomedical', colors: ['#AD1457', '#6A1B9A', '#4527A0', '#283593', '#1565C0'], desc: '紫红蓝过渡 — 生物医学' },
    { name: 'Materials Science', colors: ['#37474F', '#546E7A', '#78909C', '#B0BEC5', '#D84315'], desc: '钢灰+赤橙 — 材料科学' },
    { name: 'Organic Synthesis', colors: ['#1B5E20', '#388E3C', '#66BB6A', '#FDD835', '#E65100'], desc: '绿黄橙 — 有机合成路径' },
    { name: 'Computational', colors: ['#311B92', '#4527A0', '#5E35B1', '#7E57C2', '#B39DDB'], desc: '紫罗兰梯度 — 计算/理论' },

    // === 经典学术色板 (Classic Academic) ===
    { name: 'Tableau 10', colors: ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F'], desc: 'Tableau 数据可视化标准' },
    { name: 'Wong (色盲友好)', colors: ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9'], desc: 'Nature Methods 推荐无障碍' },
    { name: 'Tol Muted', colors: ['#332288', '#88CCEE', '#44AA99', '#DDCC77', '#CC6677'], desc: 'Paul Tol — 柔和低饱和' },

    // === 极简高级系列 (Minimalist Premium) ===
    { name: 'Nordic Frost', colors: ['#2E3440', '#5E81AC', '#88C0D0', '#A3BE8C', '#EBCB8B'], desc: '北欧极光 — 沉静优雅' },
    { name: 'Deep Ocean', colors: ['#0C2340', '#1B4D6E', '#2980B9', '#5DADE2', '#AED6F1'], desc: '深海蓝梯度 — 高端清透' },
];

export const hslToHex = (h: number, s: number, l: number) => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
};
