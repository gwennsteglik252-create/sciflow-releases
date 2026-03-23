import { Node, mergeAttributes } from '@tiptap/core';

/**
 * SciFigureNode — 图片+图注自定义节点
 * 在 Word 模式下将 [Fig:refId] 标记渲染为实际图片
 */
export const SciFigureNode = Node.create({
  name: 'sciFigure',
  group: 'block',
  atom: true, // 不可编辑内部内容

  addAttributes() {
    return {
      refId: { default: '' },
      src: { default: '' },
      caption: { default: '' },
      figNum: { default: 0 },
      figLabel: { default: 'Figure' },
      figSep: { default: '.' },
      width: { default: null }, // 新增 width 属性
    };
  },

  parseHTML() {
    return [{ tag: 'sci-figure' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['sci-figure', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('figure');
      dom.className = 'word-figure';
      dom.contentEditable = 'false';
      dom.style.cursor = 'pointer';
      dom.setAttribute('data-ref-id', node.attrs.refId || '');

      const imgWrapper = document.createElement('div');
      imgWrapper.className = 'word-figure-img-wrapper';
      imgWrapper.style.position = 'relative';
      imgWrapper.style.display = 'inline-block';

      const img = document.createElement('img');
      img.src = node.attrs.src || '';
      img.alt = node.attrs.caption || '';
      img.draggable = false;
      if (node.attrs.width) {
        img.style.width = node.attrs.width;
      }
      imgWrapper.appendChild(img);

      // Resizer 控制点（仅当节点处于 selected 时，CSS 才会将其 display: block）
      const resizer = document.createElement('div');
      resizer.className = 'word-figure-resizer';
      resizer.style.position = 'absolute';
      resizer.style.right = '-6px';
      resizer.style.bottom = '-6px';
      resizer.style.width = '12px';
      resizer.style.height = '12px';
      resizer.style.backgroundColor = '#3b82f6';
      resizer.style.border = '2px solid white';
      resizer.style.cursor = 'nwse-resize';
      resizer.style.borderRadius = '50%';
      resizer.style.display = 'none'; // 依赖 .ProseMirror-selectednode 这个外层父类在 CSS 中改写显示
      imgWrapper.appendChild(resizer);

      dom.appendChild(imgWrapper);

      const caption = document.createElement('figcaption');
      const numStr = node.attrs.figNum > 0 ? `${node.attrs.figLabel} ${node.attrs.figNum}${node.attrs.figSep} ` : '';
      caption.innerHTML = `<strong>${numStr}</strong>${node.attrs.caption || ''}`;
      dom.appendChild(caption);

      // 拖拽缩放逻辑
      let startX = 0;
      let startWidth = 0;

      const onMouseMove = (e: MouseEvent) => {
        const dx = e.clientX - startX;
        // 因为图片是居中的，如果我们往右拖，它的宽度应该是原宽度 + dx * 2 才能保持两侧等比扩大；
        // 如果我们只是普通的 width 变化，右下角拖拽，宽度 + dx 即可。
        const newWidth = Math.max(100, Math.min(1200, startWidth + dx * 2));
        img.style.width = `${newWidth}px`;
      };

      const onMouseUp = (e: MouseEvent) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        // 持久化到 Tiptap 内部状态
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (pos !== undefined) {
          editor.commands.command(({ tr }) => {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              width: img.style.width,
            });
            return true;
          });
        }
      };

      resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startX = e.clientX;
        startWidth = img.clientWidth;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });

      return { dom };
    };
  },
});
