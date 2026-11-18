// Language support for Phase 1: Python, TypeScript, JavaScript, C, C#, and JSON.
//
// The first five use Monaco's built-in definitions. Each one registers the
// language id and file extensions up front, and loads its tokenizer and
// bracket/comment rules only when a file of that language is first opened.
//
// To add a language: import its definition below (see
// node_modules/monaco-editor/esm/vs/languages/definitions) and add a row to
// detect.ts if it needs indentation defaults.
// TODO(phase 2): language servers (completions, diagnostics, go to definition).

import 'monaco-editor/languages/definitions/python/register.js';
import 'monaco-editor/languages/definitions/typescript/register.js';
import 'monaco-editor/languages/definitions/javascript/register.js';
import 'monaco-editor/languages/definitions/cpp/register.js'; // registers "c" and "cpp"
import 'monaco-editor/languages/definitions/csharp/register.js';

import type { editor, languages as MonacoLanguages } from 'monaco-editor/editor/editor.api.js';
import { jsonConfiguration, jsonLanguage, jsonTokens } from './json';
import { languageIdForPath } from './detect';

type LanguagesApi = typeof MonacoLanguages;

export function registerJson(languages: LanguagesApi): void {
  languages.register(jsonLanguage);
  languages.setLanguageConfiguration('json', jsonConfiguration);
  languages.setMonarchTokensProvider('json', jsonTokens);
}

/** Set a model's language from its file path. Returns the language id. */
export function applyLanguage(
  monaco: { editor: typeof editor; languages: LanguagesApi },
  model: editor.ITextModel,
  path: string,
): string {
  const id = languageIdForPath(monaco.languages.getLanguages(), path);
  if (model.getLanguageId() !== id) monaco.editor.setModelLanguage(model, id);
  return id;
}
