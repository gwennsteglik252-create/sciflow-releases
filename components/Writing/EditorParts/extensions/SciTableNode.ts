import { Node, mergeAttributes } from '@tiptap/core';

/**
 * SciTableNode — 表格自定义节点
 * 在 Word 模式下将 [Table:tableId] 标记渲染为实际的 HTML 表格
 */
export const SciTableNode = Node.create({
  name: 'sciTable',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      tableId: { default: '' },
      title: { default: '' },
      headers: { default: [] },
      rows: { default: [] },
      note: { default: '' },
      tableNum: { default: 0 },
      tableLabel: { default: 'Table' },
    };
  },

  parseHTML() {
    return [{ tag: 'sci-table' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['sci-table', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.className = 'word-table-wrapper';
      dom.contentEditable = 'false';
      dom.style.cursor = 'pointer';
      dom.setAttribute('data-table-id', node.attrs.tableId || '');

      dom.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dom.dispatchEvent(new CustomEvent('sci-table-dblclick', {
          bubbles: true,
          detail: { tableId: node.attrs.tableId },
        }));
      });

      // 标题
      const caption = document.createElement('div');
      caption.className = 'word-table-caption';
      const numStr = node.attrs.tableNum > 0 ? `${node.attrs.tableLabel} ${node.attrs.tableNum}. ` : '';
      caption.innerHTML = `<strong>${numStr}</strong>${node.attrs.title || ''}`;
      dom.appendChild(caption);

      // 表格
      const table = document.createElement('table');
      table.className = 'word-scientific-table';

      // headers/rows 可能是 JSON 字符串（从 HTML 属性解析）或数组
      let headers: string[] = [];
      let rows: string[][] = [];
      try {
        headers = typeof node.attrs.headers === 'string' ? JSON.parse(node.attrs.headers) : (node.attrs.headers || []);
        rows = typeof node.attrs.rows === 'string' ? JSON.parse(node.attrs.rows) : (node.attrs.rows || []);
      } catch { /* 解析失败则保持空数组 */ }

      if (headers.length > 0) {
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');
        headers.forEach(h => {
          const th = document.createElement('th');
          th.textContent = h;
          tr.appendChild(th);
        });
        thead.appendChild(tr);
        table.appendChild(thead);
      }

      if (rows.length > 0) {
        const tbody = document.createElement('tbody');
        rows.forEach(row => {
          const tr = document.createElement('tr');
          (row as string[]).forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
      }

      dom.appendChild(table);

      // 注释
      if (node.attrs.note) {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'word-table-note';
        noteDiv.textContent = node.attrs.note;
        dom.appendChild(noteDiv);
      }

      return { dom };
    };
  },
});
