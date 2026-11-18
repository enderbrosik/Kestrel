// Monaco bootstrap. Loaded lazily (dynamic import) the first time an editor is
// needed, so the startup screen stays fast.
//
// To keep the bundle small we import the editor API plus a curated list of
// editor features instead of the full "editor.main". Add a line here to enable
// another feature (for example hover or quick outline).

import * as monaco from 'monaco-editor/editor/editor.api.js';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';

import 'monaco-editor/editor/browser/coreCommands.js';
import 'monaco-editor/features/codeEditor/register.js';
import 'monaco-editor/features/codicon/register.js';
import 'monaco-editor/features/bracketMatching/register.js';
import 'monaco-editor/features/caretOperations/register.js';
import 'monaco-editor/features/clipboard/register.js';
import 'monaco-editor/features/comment/register.js';
import 'monaco-editor/features/contextmenu/register.js';
import 'monaco-editor/features/cursorUndo/register.js';
import 'monaco-editor/features/find/register.js';
import 'monaco-editor/features/folding/register.js';
import 'monaco-editor/features/indentation/register.js';
import 'monaco-editor/features/lineSelection/register.js';
import 'monaco-editor/features/linesOperations/register.js';
import 'monaco-editor/features/multicursor/register.js';
import 'monaco-editor/features/smartSelect/register.js';
import 'monaco-editor/features/snippet/register.js';
import 'monaco-editor/features/suggest/register.js';
import 'monaco-editor/features/tokenization/register.js';
import 'monaco-editor/features/unicodeHighlighter/register.js';
import 'monaco-editor/features/wordHighlighter/register.js';
import 'monaco-editor/features/wordOperations/register.js';
import 'monaco-editor/features/wordPartOperations/register.js';

self.MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

export { monaco };
export type MonacoApi = typeof monaco;
export type TextModel = monaco.editor.ITextModel;
export type CodeEditor = monaco.editor.IStandaloneCodeEditor;
export type ViewState = monaco.editor.ICodeEditorViewState;
