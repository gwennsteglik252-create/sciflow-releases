/**
 * SearchReplace.ts — TipTap 查找与替换扩展
 *
 * 功能：
 * 1. 使用 Decoration 高亮所有匹配文本
 * 2. 当前匹配项使用不同颜色标识
 * 3. 支持上/下导航、替换、全部替换
 * 4. 支持大小写敏感/不敏感
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface SearchReplaceOptions {
  searchTerm: string;
  replaceTerm: string;
  caseSensitive: boolean;
  /** 当前激活的匹配索引（0-based） */
  activeIndex: number;
}

export interface SearchReplaceStorage {
  results: { from: number; to: number }[];
  activeIndex: number;
}

const searchReplacePluginKey = new PluginKey('searchReplace');

/**
 * 在 ProseMirror 文档中搜索所有匹配项
 */
function findMatches(
  doc: any,
  searchTerm: string,
  caseSensitive: boolean
): { from: number; to: number }[] {
  if (!searchTerm) return [];

  const results: { from: number; to: number }[] = [];
  const searchStr = caseSensitive ? searchTerm : searchTerm.toLowerCase();

  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;
    const text = caseSensitive ? node.text! : node.text!.toLowerCase();
    let idx = text.indexOf(searchStr);
    while (idx !== -1) {
      results.push({
        from: pos + idx,
        to: pos + idx + searchTerm.length,
      });
      idx = text.indexOf(searchStr, idx + 1);
    }
  });

  return results;
}

export const SearchReplace = Extension.create<SearchReplaceOptions, SearchReplaceStorage>({
  name: 'searchReplace',

  addOptions() {
    return {
      searchTerm: '',
      replaceTerm: '',
      caseSensitive: false,
      activeIndex: 0,
    };
  },

  addStorage() {
    return {
      results: [],
      activeIndex: 0,
    };
  },

  addCommands() {
    return {
      setSearchTerm:
        (searchTerm: string) =>
        ({ editor }) => {
          editor.extensionManager.extensions.find(
            (e) => e.name === 'searchReplace'
          )!.options.searchTerm = searchTerm;
          editor.extensionManager.extensions.find(
            (e) => e.name === 'searchReplace'
          )!.options.activeIndex = 0;
          // 触发视图更新
          const { tr } = editor.state;
          editor.view.dispatch(tr.setMeta(searchReplacePluginKey, { searchTerm }));
          return true;
        },

      setReplaceTerm:
        (replaceTerm: string) =>
        ({ editor }) => {
          editor.extensionManager.extensions.find(
            (e) => e.name === 'searchReplace'
          )!.options.replaceTerm = replaceTerm;
          return true;
        },

      setCaseSensitive:
        (caseSensitive: boolean) =>
        ({ editor }) => {
          editor.extensionManager.extensions.find(
            (e) => e.name === 'searchReplace'
          )!.options.caseSensitive = caseSensitive;
          const { tr } = editor.state;
          editor.view.dispatch(tr.setMeta(searchReplacePluginKey, { caseSensitive }));
          return true;
        },

      goToNextMatch:
        () =>
        ({ editor }) => {
          const ext = editor.extensionManager.extensions.find(
            (e) => e.name === 'searchReplace'
          )!;
          const storage = (editor.storage as any).searchReplace as SearchReplaceStorage;
          if (storage.results.length === 0) return false;
          ext.options.activeIndex =
            (ext.options.activeIndex + 1) % storage.results.length;
          const { tr } = editor.state;
          editor.view.dispatch(tr.setMeta(searchReplacePluginKey, { navigate: true }));
          // 滚动到匹配位置
          const match = storage.results[ext.options.activeIndex];
          if (match) {
            editor.commands.setTextSelection(match);
            // 确保滚动到可见区域
            const domAtPos = editor.view.domAtPos(match.from);
            const element = domAtPos.node instanceof HTMLElement
              ? domAtPos.node
              : domAtPos.node.parentElement;
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return true;
        },

      goToPrevMatch:
        () =>
        ({ editor }) => {
          const ext = editor.extensionManager.extensions.find(
            (e) => e.name === 'searchReplace'
          )!;
          const storage = (editor.storage as any).searchReplace as SearchReplaceStorage;
          if (storage.results.length === 0) return false;
          ext.options.activeIndex =
            (ext.options.activeIndex - 1 + storage.results.length) %
            storage.results.length;
          const { tr } = editor.state;
          editor.view.dispatch(tr.setMeta(searchReplacePluginKey, { navigate: true }));
          const match = storage.results[ext.options.activeIndex];
          if (match) {
            editor.commands.setTextSelection(match);
            const domAtPos = editor.view.domAtPos(match.from);
            const element = domAtPos.node instanceof HTMLElement
              ? domAtPos.node
              : domAtPos.node.parentElement;
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return true;
        },

      replaceCurrentMatch:
        () =>
        ({ editor }) => {
          const ext = editor.extensionManager.extensions.find(
            (e) => e.name === 'searchReplace'
          )!;
          const storage = (editor.storage as any).searchReplace as SearchReplaceStorage;
          if (storage.results.length === 0) return false;

          const match = storage.results[ext.options.activeIndex];
          if (!match) return false;

          editor
            .chain()
            .focus()
            .insertContentAt(
              { from: match.from, to: match.to },
              ext.options.replaceTerm
            )
            .run();

          // 刷新结果
          const { tr } = editor.state;
          editor.view.dispatch(tr.setMeta(searchReplacePluginKey, { refresh: true }));
          return true;
        },

      replaceAllMatches:
        () =>
        ({ editor }) => {
          const ext = editor.extensionManager.extensions.find(
            (e) => e.name === 'searchReplace'
          )!;
          const storage = (editor.storage as any).searchReplace as SearchReplaceStorage;
          if (storage.results.length === 0) return false;

          // 从尾部开始替换，避免偏移量变化
          const sortedResults = [...storage.results].sort(
            (a, b) => b.from - a.from
          );

          editor.chain().focus().command(({ tr: transaction }) => {
            for (const match of sortedResults) {
              transaction.insertText(ext.options.replaceTerm, match.from, match.to);
            }
            return true;
          }).run();

          ext.options.activeIndex = 0;
          const { tr } = editor.state;
          editor.view.dispatch(tr.setMeta(searchReplacePluginKey, { refresh: true }));
          return true;
        },

      clearSearch:
        () =>
        ({ editor }) => {
          const ext = editor.extensionManager.extensions.find(
            (e) => e.name === 'searchReplace'
          )!;
          ext.options.searchTerm = '';
          ext.options.replaceTerm = '';
          ext.options.activeIndex = 0;
          const { tr } = editor.state;
          editor.view.dispatch(tr.setMeta(searchReplacePluginKey, { clear: true }));
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const extensionThis = this;

    return [
      new Plugin({
        key: searchReplacePluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, oldDecorations, _oldState, newState) {
            // 只在有 meta 或文档变化时才重建
            const meta = tr.getMeta(searchReplacePluginKey);
            if (!meta && !tr.docChanged) return oldDecorations;

            const { searchTerm, caseSensitive } = extensionThis.options;
            if (!searchTerm) {
              extensionThis.storage.results = [];
              extensionThis.storage.activeIndex = 0;
              return DecorationSet.empty;
            }

            const results = findMatches(newState.doc, searchTerm, caseSensitive);
            extensionThis.storage.results = results;
            const activeIdx = extensionThis.options.activeIndex;
            extensionThis.storage.activeIndex = activeIdx;

            const decorations = results.map((r, i) =>
              Decoration.inline(r.from, r.to, {
                class:
                  i === activeIdx
                    ? 'search-result-active'
                    : 'search-result',
              })
            );

            return DecorationSet.create(newState.doc, decorations);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

// ─── Module augmentation for custom commands ───
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchReplace: {
      setSearchTerm: (searchTerm: string) => ReturnType;
      setReplaceTerm: (replaceTerm: string) => ReturnType;
      setCaseSensitive: (caseSensitive: boolean) => ReturnType;
      goToNextMatch: () => ReturnType;
      goToPrevMatch: () => ReturnType;
      replaceCurrentMatch: () => ReturnType;
      replaceAllMatches: () => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}
