import { Node, mergeAttributes } from '@tiptap/core';

/**
 * SciFigRefNode — 图引用编号自定义节点（行内）
 * 在 Word 模式下将 [FigRef:refId] 渲染为 "Figure N" 引用
 */
export const SciFigRefNode = Node.create({
  name: 'sciFigRef',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      refId: { default: '' },
      figNum: { default: 0 },
      figLabel: { default: 'Figure' },
    };
  },

  parseHTML() {
    return [{ tag: 'sci-figref' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['sci-figref', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'word-figref';
      dom.contentEditable = 'false';
      const num = node.attrs.figNum > 0 ? node.attrs.figNum : '?';
      dom.textContent = `${node.attrs.figLabel} ${num}`;
      return { dom };
    };
  },
});
