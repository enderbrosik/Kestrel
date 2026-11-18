// The editor area: a tab bar plus one Monaco editor that swaps between open
// documents. Each open file keeps its own text model, undo history, and view
// state. A tab shows an "unsaved" marker while its model differs from disk.

import { h } from '../core/dom';
import { Emitter } from '../core/events';
import { registerCommand } from '../core/commands';
import { baseName, getFileSystem } from '../platform/fs';
import { confirmDialog } from '../ui/dialog';
import { notify, reportError } from '../ui/status';
import type { FileOperation } from '../workspace/explorer';
import type { CodeEditor, MonacoApi, TextModel, ViewState } from './monaco';
import { defaultSettings } from '../settings/loader';
import type { Settings } from '../settings/schema';
import type { Theme } from '../themes/loader';
import { toMonacoTheme } from '../themes/loader';
import { editorOptionsFromSettings, indentFromSettings } from './options';
import { renderTabs } from './tabs';

interface OpenDoc {
  id: number;
  /** null for an untitled buffer that has not been saved yet. */
  path: string | null;
  /** Shown in the tab while there is no path, e.g. "Untitled-1". */
  untitledName?: string;
  model: TextModel;
  /** Model version at the last save or load. Equal to the current version means "clean". */
  savedVersion: number;
  viewState: ViewState | null;
}

type ApplyLanguage = (typeof import('../languages'))['applyLanguage'];

function isUnder(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`) || path.startsWith(`${base}\\`);
}

export class EditorPane {
  /** Fires with the active file path, or null when no file (or only an untitled buffer) is open. */
  readonly onActiveFileChange = new Emitter<string | null>();
  /** Fires with the file path after each successful save. */
  readonly onDidSave = new Emitter<string>();
  /** Fires whenever any document becomes dirty or clean. */
  readonly onDirtyChange = new Emitter<void>();

  private docs: OpenDoc[] = [];
  private active: OpenDoc | null = null;
  private nextId = 1;
  private untitledCount = 0;
  private monaco: MonacoApi | null = null;
  private applyLanguage: ApplyLanguage | null = null;
  private editor: CodeEditor | null = null;
  private loading: Promise<void> | null = null;
  private theme: Theme | null = null;
  private settings: Settings = defaultSettings();

  private readonly tabBar = h('div', { class: 'tabs', role: 'tablist' });
  private readonly host = h('div', { class: 'editor-host' });
  private readonly placeholder = h('div', { class: 'placeholder' }, 'Open a file from the explorer.');

  constructor(container: HTMLElement) {
    container.replaceChildren(this.tabBar, this.host, this.placeholder);
    this.updateChrome();
    registerCommand('file.save', () => this.save());
    registerCommand('file.newUntitled', () => this.newUntitled());
    registerCommand('tab.close', () => (this.active ? this.close(this.active) : undefined));
    registerCommand('tab.next', () => this.cycle(1));
    registerCommand('tab.previous', () => this.cycle(-1));
    registerCommand('view.focusEditor', () => this.focus());
  }

  get activePath(): string | null {
    return this.active?.path ?? null;
  }

  focus(): void {
    this.editor?.focus();
  }

  /** Apply editor settings (font, wrapping, indentation, ...) to the editor and every open file. */
  applySettings(settings: Settings): void {
    this.settings = settings;
    this.editor?.updateOptions(editorOptionsFromSettings(settings));
    for (const doc of this.docs) this.applyIndent(doc);
  }

  private applyIndent(doc: OpenDoc): void {
    const { tabSize, insertSpaces, detect } = indentFromSettings(this.settings, doc.model.getLanguageId());
    doc.model.updateOptions({ tabSize, insertSpaces });
    if (detect) doc.model.detectIndentation(insertSpaces, tabSize);
  }

  /** Set the editor colors. Applied right away if Monaco is loaded, otherwise when it loads. */
  setTheme(theme: Theme): void {
    this.theme = theme;
    this.applyMonacoTheme();
  }

  private applyMonacoTheme(): void {
    if (!this.monaco || !this.theme) return;
    this.monaco.editor.defineTheme(this.theme.id, toMonacoTheme(this.theme));
    this.monaco.editor.setTheme(this.theme.id);
  }

  hasUnsavedChanges(): boolean {
    return this.docs.some((d) => this.isDirty(d));
  }

  get hasOpenDocuments(): boolean {
    return this.docs.length > 0;
  }

  private titleOf(doc: OpenDoc): string {
    return doc.path === null ? (doc.untitledName ?? 'Untitled') : baseName(doc.path);
  }

  // ---- opening and activating --------------------------------------------

  async openFile(path: string): Promise<void> {
    const existing = this.docs.find((d) => d.path === path);
    if (existing) return this.activate(existing);

    let text: string;
    try {
      text = await (await getFileSystem()).readFile(path);
    } catch (err) {
      return reportError(`Cannot open ${baseName(path)}`, err);
    }
    await this.ensureEditor();
    // The file may have been opened while we were reading it.
    const raced = this.docs.find((d) => d.path === path);
    if (raced) return this.activate(raced);

    const monaco = this.monaco!;
    const id = this.nextId++;
    // Model URIs are unique ids, so renaming a file never collides with a stale model.
    const uri = monaco.Uri.from({ scheme: 'kestrel', path: `/${id}/${baseName(path)}` });
    const model = monaco.editor.createModel(text, undefined, uri);
    this.applyLanguage!(monaco, model, path);
    const doc: OpenDoc = { id, path, model, savedVersion: model.getAlternativeVersionId(), viewState: null };
    model.onDidChangeContent(() => {
      this.renderTabBar();
      this.onDirtyChange.fire();
    });
    this.applyIndent(doc);
    this.docs.push(doc);
    this.activate(doc);
  }

  /** Open a new empty buffer. It gets a file name when it is first saved. */
  async newUntitled(): Promise<void> {
    await this.ensureEditor();
    const monaco = this.monaco!;
    const id = this.nextId++;
    const untitledName = `Untitled-${++this.untitledCount}`;
    const model = monaco.editor.createModel('', 'plaintext', monaco.Uri.from({ scheme: 'kestrel', path: `/${id}/${untitledName}` }));
    const doc: OpenDoc = { id, path: null, untitledName, model, savedVersion: model.getAlternativeVersionId(), viewState: null };
    model.onDidChangeContent(() => {
      this.renderTabBar();
      this.onDirtyChange.fire();
    });
    this.applyIndent(doc);
    this.docs.push(doc);
    this.activate(doc);
  }

  private activate(doc: OpenDoc): void {
    if (this.active && this.active !== doc) this.active.viewState = this.editor?.saveViewState() ?? null;
    this.active = doc;
    this.editor?.setModel(doc.model);
    if (doc.viewState) this.editor?.restoreViewState(doc.viewState);
    this.editor?.focus();
    this.updateChrome();
    this.onActiveFileChange.fire(doc.path);
  }

  private cycle(step: 1 | -1): void {
    if (this.docs.length < 2 || !this.active) return;
    const index = this.docs.indexOf(this.active);
    this.activate(this.docs[(index + step + this.docs.length) % this.docs.length]!);
  }

  // ---- saving and closing -------------------------------------------------

  async save(): Promise<void> {
    const doc = this.active;
    if (!doc) return;
    if (!this.isDirty(doc)) return notify(`${this.titleOf(doc)} has no changes`);
    // Capture before the write so edits made while saving keep the tab dirty.
    const version = doc.model.getAlternativeVersionId();
    const text = doc.model.getValue();
    try {
      const fs = await getFileSystem();
      if (doc.path === null) {
        // First save of an untitled buffer: ask where it goes, then it becomes a normal file.
        const chosen = await fs.saveAs(doc.untitledName ?? 'Untitled', text);
        if (chosen === null) return;
        doc.path = chosen;
        if (this.monaco) this.applyLanguage?.(this.monaco, doc.model, chosen);
        this.applyIndent(doc);
      } else {
        await fs.writeFile(doc.path, text);
      }
    } catch (err) {
      return reportError(`Cannot save ${this.titleOf(doc)}`, err);
    }
    doc.savedVersion = version;
    // Start a new undo step so undoing after a save stops at the saved text.
    doc.model.pushStackElement();
    this.renderTabBar();
    this.onDirtyChange.fire();
    notify(`Saved ${this.titleOf(doc)}`);
    this.onDidSave.fire(doc.path!);
    if (doc === this.active) this.onActiveFileChange.fire(doc.path);
  }

  private async close(doc: OpenDoc, force = false): Promise<void> {
    if (!force && this.isDirty(doc)) {
      const discard = await confirmDialog(`"${this.titleOf(doc)}" has unsaved changes. Discard them?`, 'Discard');
      if (!discard) return;
    }
    const index = this.docs.indexOf(doc);
    if (index < 0) return;
    this.docs.splice(index, 1);
    if (this.active === doc) {
      this.active = null;
      const next = this.docs[Math.min(index, this.docs.length - 1)];
      if (next) this.activate(next);
      else {
        this.editor?.setModel(null);
        this.updateChrome();
        this.onActiveFileChange.fire(null);
      }
    } else {
      this.renderTabBar();
    }
    doc.model.dispose();
    this.onDirtyChange.fire();
  }

  // ---- keeping tabs in sync with the explorer -----------------------------

  handleFileOperation(op: FileOperation): void {
    if (op.type === 'rename' || op.type === 'move') {
      for (const doc of this.docs) {
        if (doc.path === null || !isUnder(doc.path, op.from)) continue;
        doc.path = op.to + doc.path.slice(op.from.length);
        // The extension may have changed, so re-detect the language.
        if (this.monaco) this.applyLanguage?.(this.monaco, doc.model, doc.path);
        this.applyIndent(doc);
      }
      this.renderTabBar();
      if (this.active) this.onActiveFileChange.fire(this.active.path);
    } else if (op.type === 'delete') {
      // The file is gone from disk, so close without asking.
      for (const doc of this.docs.filter((d) => d.path !== null && isUnder(d.path, op.path))) void this.close(doc, true);
    }
  }

  // ---- internals ----------------------------------------------------------

  private isDirty(doc: OpenDoc): boolean {
    // An untitled buffer counts as unsaved as soon as it has any text.
    if (doc.path === null) return doc.model.getValueLength() > 0;
    return doc.model.getAlternativeVersionId() !== doc.savedVersion;
  }

  private ensureEditor(): Promise<void> {
    this.loading ??= import('./monaco').then(({ monaco, applyLanguage }) => {
      this.monaco = monaco;
      this.applyLanguage = applyLanguage;
      this.editor = monaco.editor.create(this.host, {
        model: null,
        automaticLayout: true,
        scrollBeyondLastLine: false,
        ...editorOptionsFromSettings(this.settings),
      });
      this.applyMonacoTheme();
    });
    return this.loading;
  }

  private updateChrome(): void {
    const hasDocs = this.docs.length > 0;
    this.host.hidden = !hasDocs;
    this.tabBar.hidden = !hasDocs;
    this.placeholder.hidden = hasDocs;
    this.renderTabBar();
    if (hasDocs) this.editor?.layout();
  }

  private renderTabBar(): void {
    renderTabs(
      this.tabBar,
      this.docs.map((d) => ({
        id: d.id,
        title: this.titleOf(d),
        tooltip: d.path ?? 'Not saved yet',
        dirty: this.isDirty(d),
        active: d === this.active,
      })),
      {
        onSelect: (id) => {
          const doc = this.docs.find((d) => d.id === id);
          if (doc) this.activate(doc);
        },
        onClose: (id) => {
          const doc = this.docs.find((d) => d.id === id);
          if (doc) void this.close(doc);
        },
      },
    );
  }
}
