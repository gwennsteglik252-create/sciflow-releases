import React from 'react';
import { renderScientificText } from '../../utils/textRenderer';

interface LaTeXTextProps {
  text: string;
  className?: string;
  orderedCitations?: { list: any[]; map: Map<string, number> };
  activeTemplateId?: string;
}

/**
 * 极简科研文本渲染组件
 * 已对齐 V13 标准，支持引文识别与编号渲染
 */
const LaTeXText: React.FC<LaTeXTextProps> = ({
  text,
  className = "",
  orderedCitations,
  activeTemplateId
}) => {
  if (!text) return null;

  // 使用统一的渲染逻辑
  const html = renderScientificText(text, {
    orderedCitations,
    activeTemplateId
  });

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default LaTeXText;