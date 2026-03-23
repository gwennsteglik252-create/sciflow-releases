import { Extension } from '@tiptap/core';

export type TextIndentOptions = {
  types: string[];
  defaultIndent: string;
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textIndent: {
      /**
       * Set the text indent
       */
      setTextIndent: (indent: string) => ReturnType;
      /**
       * Unset the text indent
       */
      unsetTextIndent: () => ReturnType;
    };
  }
}

export const TextIndent = Extension.create<TextIndentOptions>({
  name: 'textIndent',

  addOptions() {
    return {
      types: ['heading', 'paragraph'],
      defaultIndent: '2em',
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textIndent: {
            default: null,
            parseHTML: element => element.style.textIndent || null,
            renderHTML: attributes => {
              if (!attributes.textIndent) {
                return {};
              }

              return {
                style: `text-indent: ${attributes.textIndent}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextIndent: indent => ({ commands }) => {
        return this.options.types.every((type: string) => commands.updateAttributes(type, { textIndent: indent }));
      },
      unsetTextIndent: () => ({ commands }) => {
        return this.options.types.every((type: string) => commands.resetAttributes(type, 'textIndent'));
      },
    };
  },
});
