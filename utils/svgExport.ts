// ─────────────────────────────────────────────
// SVG/矢量图导出工具
// ─────────────────────────────────────────────

/**
 * 将 DOM 中的 SVG 元素导出为 SVG 文件
 */
export const exportToSVG = (svgElement: SVGSVGElement, filename: string = 'chart.svg'): void => {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;

  // 内联所有计算后的样式
  inlineStyles(clone, svgElement);

  // 设置 SVG 命名空间
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // 序列化
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(clone);
  svgString = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svgString;

  // 下载
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename);
};

/**
 * 导出为高DPI PNG
 */
export const exportToPNG = (
  svgElement: SVGSVGElement,
  filename: string = 'chart.png',
  scale: number = 4
): Promise<void> => {
  return new Promise((resolve) => {
    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    inlineStyles(clone, svgElement);

    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);

    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const bbox = svgElement.getBoundingClientRect();
      canvas.width = bbox.width * scale;
      canvas.height = bbox.height * scale;

      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, bbox.width, bbox.height);
      ctx.drawImage(img, 0, 0, bbox.width, bbox.height);

      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, filename);
        URL.revokeObjectURL(url);
        resolve();
      }, 'image/png');
    };

    img.src = url;
  });
};

/**
 * 导出 SVG 为 PDF (通过 print 对话框)
 */
export const exportToPDF = (svgElement: SVGSVGElement, title: string = '图表'): void => {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  inlineStyles(clone, svgElement);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clone);

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head><title>${title}</title>
          <style>@media print { body { margin: 0; } svg { max-width: 100%; height: auto; } }</style>
        </head>
        <body>${svgString}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  }
};

// ════════════════════════════════════════════════
// 内联样式到 SVG clone（确保导出保真度）
// ════════════════════════════════════════════════

const inlineStyles = (clone: Element, original: Element): void => {
  const cloneChildren = Array.from(clone.children);
  const origChildren = Array.from(original.children);

  if (original instanceof HTMLElement || original instanceof SVGElement) {
    const computed = window.getComputedStyle(original);
    const important = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity',
      'font-size', 'font-family', 'font-weight', 'font-style', 'text-anchor',
      'dominant-baseline', 'color', 'visibility', 'display'];

    important.forEach(prop => {
      const val = computed.getPropertyValue(prop);
      if (val && val !== 'none' && val !== '' && val !== 'normal') {
        (clone as HTMLElement).style.setProperty(prop, val);
      }
    });
  }

  for (let i = 0; i < Math.min(cloneChildren.length, origChildren.length); i++) {
    inlineStyles(cloneChildren[i], origChildren[i]);
  }
};

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
