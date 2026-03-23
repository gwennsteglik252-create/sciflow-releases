/**
 * pdfFigureExtractor — PDF 文献 Figure 图片提取器
 *
 * 从学术 PDF 中自动提取 Figure 图片：
 * 1. 使用 pdfjs-dist page.render() 逐页渲染为高清 Canvas 截图
 * 2. 调用 AI Vision (Gemini) 识别每页中的 Figure 区域 (bbox)
 * 3. 根据 bbox 裁切出单独的 Figure 图片
 *
 * 支持 base64 和 URL 两种 PDF 输入源（同 pdfTextExtractor.ts）
 */

import * as pdfjsLib from 'pdfjs-dist';

// Worker 配置（复用 pdfTextExtractor 的设置）
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

// ─── 类型定义 ────────────────────────────────────────────

/** AI 识别出的 Figure 区域 */
export interface FigureBBox {
    figureLabel: string;   // "Figure 1", "Fig. 2a" 等
    description: string;   // AI 对该图的简要描述
    /** 归一化坐标 (0-1)，相对于页面尺寸 */
    x: number;
    y: number;
    w: number;
    h: number;
}

/** 从 PDF 中提取的单个 Figure */
export interface ExtractedFigure {
    id: string;
    label: string;          // "Figure 1", "Fig. 2" 等
    pageNum: number;
    imageBase64: string;    // data:image/png;base64,...
    description: string;    // AI 生成的图片描述
    sourceLitId: string;
    sourceLitTitle: string;
}

/** 文献基本信息（用于关联） */
export interface LiteratureInfo {
    id: string;
    title: string;
    localPath?: string;     // 本地 PDF 文件路径
    oaUrl?: string;         // OA PDF URL
    fullText?: string;
}

// ─── 配置 ────────────────────────────────────────────────

/** 渲染缩放因子（2x 产出足够清晰的截图用于裁切） */
const RENDER_SCALE = 2;
/** 最多处理的页数（学术论文通常 Figure 在前 20 页） */
const MAX_PAGES = 20;
/** 每页最大 Figure 数 */
const MAX_FIGURES_PER_PAGE = 4;

// ─── 核心函数 ────────────────────────────────────────────

/**
 * 将 PDF 单页渲染为 Canvas，返回 base64 PNG
 */
export async function renderPdfPageToImage(
    page: pdfjsLib.PDFPageProxy,
    scale: number = RENDER_SCALE
): Promise<{ imageBase64: string; width: number; height: number }> {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建 2D Canvas 上下文');

    await page.render({ canvasContext: ctx, viewport }).promise;

    const imageBase64 = canvas.toDataURL('image/png', 0.92);
    return {
        imageBase64,
        width: canvas.width,
        height: canvas.height
    };
}

/**
 * 根据归一化 bbox 从全页 Canvas 中裁切出 Figure 图片
 */
function cropFigureFromPage(
    fullPageBase64: string,
    bbox: FigureBBox,
    pageWidth: number,
    pageHeight: number
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const sx = Math.round(bbox.x * pageWidth);
            const sy = Math.round(bbox.y * pageHeight);
            const sw = Math.round(bbox.w * pageWidth);
            const sh = Math.round(bbox.h * pageHeight);

            // 安全边界
            const safeSx = Math.max(0, sx);
            const safeSy = Math.max(0, sy);
            const safeSw = Math.min(sw, pageWidth - safeSx);
            const safeSh = Math.min(sh, pageHeight - safeSy);

            if (safeSw < 50 || safeSh < 50) {
                reject(new Error('Figure 区域过小，跳过'));
                return;
            }

            const canvas = document.createElement('canvas');
            canvas.width = safeSw;
            canvas.height = safeSh;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('Canvas 上下文创建失败')); return; }

            ctx.drawImage(img, safeSx, safeSy, safeSw, safeSh, 0, 0, safeSw, safeSh);
            resolve(canvas.toDataURL('image/png', 0.92));
        };
        img.onerror = () => reject(new Error('页面截图加载失败'));
        img.src = fullPageBase64;
    });
}

/**
 * AI Vision 分析页面截图，识别其中的 Figure 区域
 * 返回每个 Figure 的标签、描述和归一化 bbox
 */
async function detectFiguresInPage(
    pageImageBase64: string,
    pageNum: number
): Promise<FigureBBox[]> {
    try {
        const { UniversalAIAdapter } = await import('../services/gemini/core/adapter');
        const ai = new UniversalAIAdapter();

        // 移除 data URL 前缀
        const base64Data = pageImageBase64.replace(/^data:image\/\w+;base64,/, '');

        const result = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            inlineData: {
                                mimeType: 'image/png',
                                data: base64Data,
                            },
                        },
                        {
                            text: `你是学术论文 Figure 检测专家。分析这张学术论文页面截图（第 ${pageNum} 页），找出其中所有的 Figure（图片/图表/示意图）。

注意：
- 只检测正式的 Figure（带 "Figure X" 或 "Fig. X" 标签的图），不包括正文中的小公式或表格
- 每个 Figure 返回其标签名和在页面中的位置（归一化坐标 0-1）
- 如果页面中没有 Figure，返回空数组

输出严格 JSON 数组：
[
  {
    "figureLabel": "Figure 1",
    "description": "该图展示了...(20字以内的简述)",
    "x": 0.05,
    "y": 0.30,
    "w": 0.90,
    "h": 0.45
  }
]

坐标说明：x/y 是左上角位置，w/h 是宽高，均为 0-1 的归一化值（相对于页面尺寸）。
请包含图的标签文字区域和图注(caption)区域在内。
如果没有找到任何 Figure，输出 []。`,
                        },
                    ],
                },
            ],
            config: {
                temperature: 0.1,
                responseMimeType: 'application/json',
            }
        });

        const parsed = JSON.parse(result.text || '[]');
        if (!Array.isArray(parsed)) return [];

        return parsed
            .filter((f: any) => f.figureLabel && typeof f.x === 'number' && typeof f.y === 'number')
            .slice(0, MAX_FIGURES_PER_PAGE)
            .map((f: any) => ({
                figureLabel: String(f.figureLabel),
                description: String(f.description || ''),
                x: Math.max(0, Math.min(1, Number(f.x))),
                y: Math.max(0, Math.min(1, Number(f.y))),
                w: Math.max(0.05, Math.min(1, Number(f.w))),
                h: Math.max(0.05, Math.min(1, Number(f.h))),
            }));
    } catch (err) {
        console.warn(`[FigureExtractor] AI 检测第 ${pageNum} 页失败:`, err);
        return [];
    }
}

/**
 * 加载 PDF 文档（支持 base64 和 URL 两种方式）
 */
async function loadPdfDocument(
    litInfo: LiteratureInfo
): Promise<pdfjsLib.PDFDocumentProxy | null> {
    // 策略 1：本地 PDF 文件（通过 Electron readFile）
    if (litInfo.localPath && litInfo.localPath.endsWith('.pdf') && window.electron?.readFile) {
        try {
            const fileData = await window.electron.readFile(litInfo.localPath);
            if (fileData?.data) {
                const binaryData = atob(fileData.data);
                const array = new Uint8Array(binaryData.length);
                for (let i = 0; i < binaryData.length; i++) {
                    array[i] = binaryData.charCodeAt(i);
                }
                return await pdfjsLib.getDocument({ data: array }).promise;
            }
        } catch (e) {
            console.warn('[FigureExtractor] 本地 PDF 加载失败:', e);
        }
    }

    // 策略 2：OA URL（通过 Electron httpRequest 绕过 CORS）
    if (litInfo.oaUrl) {
        try {
            let pdfData: Uint8Array;
            if (window.electron?.httpRequest) {
                const response = await window.electron.httpRequest({
                    url: litInfo.oaUrl,
                    method: 'GET',
                    headers: { 'Accept': 'application/pdf' }
                });
                if (response.ok && response.body) {
                    const binaryData = atob(response.body);
                    pdfData = new Uint8Array(binaryData.length);
                    for (let i = 0; i < binaryData.length; i++) {
                        pdfData[i] = binaryData.charCodeAt(i);
                    }
                    return await pdfjsLib.getDocument({ data: pdfData }).promise;
                }
            } else {
                const response = await fetch(litInfo.oaUrl, {
                    signal: AbortSignal.timeout(30000)
                });
                if (response.ok) {
                    const buffer = await response.arrayBuffer();
                    pdfData = new Uint8Array(buffer);
                    return await pdfjsLib.getDocument({ data: pdfData }).promise;
                }
            }
        } catch (e) {
            console.warn('[FigureExtractor] OA URL PDF 加载失败:', e);
        }
    }

    return null;
}

// ─── 主入口 ──────────────────────────────────────────────

/**
 * 从文献 PDF 中提取所有 Figure 图片
 *
 * 流程：加载 PDF → 逐页渲染截图 → AI 检测 Figure 区域 → 裁切图片
 *
 * @param litInfo 文献基本信息（含 localPath 或 oaUrl）
 * @param onProgress 进度回调 (0-100)
 * @returns 提取到的 Figure 数组
 */
export async function extractFiguresFromPdf(
    litInfo: LiteratureInfo,
    onProgress?: (progress: number, message: string) => void
): Promise<ExtractedFigure[]> {
    onProgress?.(0, `加载 PDF: ${litInfo.title.substring(0, 30)}...`);

    const doc = await loadPdfDocument(litInfo);
    if (!doc) {
        console.warn(`[FigureExtractor] 无法加载 PDF: ${litInfo.id}`);
        return [];
    }

    const figures: ExtractedFigure[] = [];
    const totalPages = Math.min(doc.numPages, MAX_PAGES);

    try {
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const progress = Math.round((pageNum / totalPages) * 100);
            onProgress?.(progress, `扫描第 ${pageNum}/${totalPages} 页`);

            const page = await doc.getPage(pageNum);

            // 渲染页面为截图
            const { imageBase64, width, height } = await renderPdfPageToImage(page);

            // AI 检测 Figure 区域
            const bboxes = await detectFiguresInPage(imageBase64, pageNum);

            if (bboxes.length === 0) continue;

            // 裁切每个 Figure
            for (const bbox of bboxes) {
                try {
                    const croppedImage = await cropFigureFromPage(
                        imageBase64, bbox, width, height
                    );

                    figures.push({
                        id: `fig_${litInfo.id}_p${pageNum}_${bbox.figureLabel.replace(/[^a-zA-Z0-9]/g, '_')}`,
                        label: bbox.figureLabel,
                        pageNum,
                        imageBase64: croppedImage,
                        description: bbox.description,
                        sourceLitId: litInfo.id,
                        sourceLitTitle: litInfo.title,
                    });
                } catch (cropErr) {
                    console.warn(`[FigureExtractor] 裁切失败 (${bbox.figureLabel}):`, cropErr);
                }
            }
        }
    } finally {
        doc.destroy();
    }

    onProgress?.(100, `提取完成: ${figures.length} 张 Figure`);
    return figures;
}

/**
 * 批量从多篇文献中提取 Figure
 * @param literatures 文献列表
 * @param onProgress 进度回调
 * @returns 所有提取到的 Figure（已标注来源文献）
 */
export async function batchExtractFigures(
    literatures: LiteratureInfo[],
    onProgress?: (progress: number, message: string) => void
): Promise<ExtractedFigure[]> {
    const allFigures: ExtractedFigure[] = [];

    for (let i = 0; i < literatures.length; i++) {
        const lit = literatures[i];
        const overallProgress = Math.round((i / literatures.length) * 100);
        onProgress?.(overallProgress, `提取 (${i + 1}/${literatures.length}): ${lit.title.substring(0, 25)}...`);

        try {
            const figures = await extractFiguresFromPdf(lit);
            allFigures.push(...figures);
        } catch (err) {
            console.warn(`[FigureExtractor] 文献 ${lit.id} 提取失败:`, err);
        }
    }

    onProgress?.(100, `批量提取完成: ${allFigures.length} 张 Figure`);
    return allFigures;
}
