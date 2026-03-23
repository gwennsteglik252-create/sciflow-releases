/**
 * pdfTextExtractor — PDF 全文文本提取工具
 *
 * 使用 pdfjs-dist 从 PDF 中逐页提取纯文本内容。
 * 支持两种输入源：
 * 1. base64 编码的 PDF 数据（用户上传 / Electron readFile）
 * 2. URL 下载的 PDF（OpenAlex OA）
 */

import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/** 全文提取的最大字符数（约 20 页论文），防止 context window 溢出 */
const MAX_TEXT_LENGTH = 50000;

/**
 * 从 base64 编码的 PDF 数据中提取全文文本
 * @param base64Data - 纯 base64 字符串（不含 data:...;base64, 前缀）
 * @returns 提取的纯文本内容
 */
export const extractTextFromPdfBase64 = async (base64Data: string): Promise<string> => {
    const binaryData = atob(base64Data);
    const array = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
        array[i] = binaryData.charCodeAt(i);
    }

    const doc = await pdfjsLib.getDocument({ data: array }).promise;
    const text = await extractTextFromDocument(doc);
    doc.destroy();
    return text;
};

/**
 * 通过 URL 下载 PDF 并提取全文文本
 * 优先使用 Electron httpRequest（绕过 CORS），降级为 fetch
 * @param url - PDF 的 URL 地址
 * @returns 提取的纯文本内容
 */
export const extractTextFromPdfUrl = async (url: string): Promise<string> => {
    let pdfData: Uint8Array;

    if (window.electron?.httpRequest) {
        // Electron 环境：使用主进程发起 HTTP 请求（绕过 CORS）
        const response = await window.electron.httpRequest({
            url,
            method: 'GET',
            headers: { 'Accept': 'application/pdf' }
        });

        if (!response.ok) {
            throw new Error(`PDF 下载失败: ${response.status} ${response.statusText}`);
        }

        // httpRequest 返回的 body 是 base64 编码
        const binaryData = atob(response.body);
        pdfData = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
            pdfData[i] = binaryData.charCodeAt(i);
        }
    } else {
        // 浏览器环境降级：直接 fetch（可能会遇到 CORS）
        const response = await fetch(url, {
            signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
            throw new Error(`PDF 下载失败: ${response.status} ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        pdfData = new Uint8Array(buffer);
    }

    const doc = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const text = await extractTextFromDocument(doc);
    doc.destroy();
    return text;
};

/**
 * 从已加载的 PDF 文档中逐页提取文本
 */
async function extractTextFromDocument(doc: pdfjsLib.PDFDocumentProxy): Promise<string> {
    const totalPages = doc.numPages;
    const pageTexts: string[] = [];
    let totalChars = 0;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        if (totalChars >= MAX_TEXT_LENGTH) break;

        const page = await doc.getPage(pageNum);
        const textContent = await page.getTextContent();

        // 拼接文本项，保留空格和换行
        let pageText = '';
        let lastY: number | null = null;

        for (const item of textContent.items) {
            if ('str' in item) {
                const textItem = item as any;
                const currentY = textItem.transform?.[5];

                // 检测换行（Y 坐标变化明显时）
                if (lastY !== null && currentY !== undefined && Math.abs(currentY - lastY) > 2) {
                    pageText += '\n';
                } else if (pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
                    pageText += ' ';
                }

                pageText += textItem.str;
                if (currentY !== undefined) lastY = currentY;
            }
        }

        pageTexts.push(pageText);
        totalChars += pageText.length;
    }

    let fullText = pageTexts.join('\n\n');

    // ─── 基本清洗 ──────────────────────────────────
    fullText = cleanExtractedText(fullText);

    // ─── 长度截断 ──────────────────────────────────
    if (fullText.length > MAX_TEXT_LENGTH) {
        fullText = fullText.substring(0, MAX_TEXT_LENGTH) + '\n\n[... 全文已截断，共提取前 ~20 页 ...]';
    }

    return fullText;
}

/**
 * 清洗提取的 PDF 文本
 * - 修复连字符换行（如 "pho-\ntocatalyst" → "photocatalyst"）
 * - 去除过多的空白行
 * - 去除常见的页眉页脚模式
 */
function cleanExtractedText(text: string): string {
    return text
        // 修复连字符换行
        .replace(/(\w)-\n(\w)/g, '$1$2')
        // 合并同段的碎片行（短行 + 换行 + 非大写开头 → 合并）
        .replace(/([^\n])\n(?=[a-z])/g, '$1 ')
        // 去除超过 2 个的连续空行
        .replace(/\n{3,}/g, '\n\n')
        // 去除页码模式（如 "  1  " "  12  " 等独立数字行）
        .replace(/^\s*\d{1,3}\s*$/gm, '')
        .trim();
}
