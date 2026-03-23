import { Node, mergeAttributes } from '@tiptap/core';
import katex from 'katex';

/**
 * SciMathNode — 公式自定义节点
 * 在 Word 模式下将 [Math:snippetId] 标记渲染为 KaTeX 公式
 */
export const SciMathNode = Node.create({
  name: 'sciMath',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      snippetId: { default: '' },
      latex: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'sci-math' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['sci-math', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.className = 'word-math-block';
      dom.contentEditable = 'false';
      dom.style.cursor = 'pointer';
      dom.setAttribute('data-snippet-id', node.attrs.snippetId || '');

      dom.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dom.dispatchEvent(new CustomEvent('sci-math-dblclick', {
          bubbles: true,
          detail: { snippetId: node.attrs.snippetId },
        }));
      });

      try {
        dom.innerHTML = katex.renderToString(node.attrs.latex || '', {
          displayMode: true,
          throwOnError: false,
          strict: false,
        });
      } catch {
        dom.textContent = node.attrs.latex || '[公式渲染失败]';
      }

      return { dom };
    };
  },
});
