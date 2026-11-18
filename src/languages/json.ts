// A small JSON / JSON-with-comments tokenizer. Monaco's own JSON support ships
// a language service with a web worker (large). Highlighting and bracket
// behavior are all Phase 1 needs, so we define just that.
// TODO(phase 2): schema validation and completions for settings files.

import type { languages } from 'monaco-editor/editor/editor.api.js';

export const jsonConfiguration: languages.LanguageConfiguration = {
  comments: { lineComment: '//', blockComment: ['/*', '*/'] },
  brackets: [
    ['{', '}'],
    ['[', ']'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}', notIn: ['string'] },
    { open: '[', close: ']', notIn: ['string'] },
    { open: '"', close: '"', notIn: ['string'] },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '"', close: '"' },
  ],
};

// Token names follow Monaco's JSON conventions so theme rules like
// "string.key.json" apply (tokenPostfix adds the ".json" suffix).
export const jsonTokens: languages.IMonarchLanguage = {
  tokenPostfix: '.json',
  tokenizer: {
    root: [
      [/"(?:[^"\\]|\\.)*"(?=\s*:)/, 'string.key'],
      [/"(?:[^"\\]|\\.)*"/, 'string.value'],
      [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'],
      [/\b(?:true|false|null)\b/, 'keyword'],
      [/\/\/.*$/, 'comment'],
      [/\/\*/, 'comment', '@comment'],
      [/[{}[\],:]/, 'delimiter'],
      [/\s+/, 'white'],
    ],
    comment: [
      [/[^/*]+/, 'comment'],
      [/\*\//, 'comment', '@pop'],
      [/[/*]/, 'comment'],
    ],
  },
};

export const jsonLanguage: languages.ILanguageExtensionPoint = {
  id: 'json',
  extensions: ['.json', '.jsonc', '.webmanifest', '.har'],
  filenames: ['.babelrc', '.eslintrc', '.prettierrc'],
  aliases: ['JSON', 'json'],
  mimetypes: ['application/json'],
};
