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
import { renderTabs } from './tabs';

interface OpenDoc {
  id: number;
  path: string;
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
  /** Fires with the active file path, or null when no file is open. */
  readonly onActiveFileChange = new Emitter<string | null>();
  /** Fires whenever any document becomes dirty or clean. */
  readonly onDirtyChange = new Emitter<void>();

  private docs: OpenDoc[] = [];
  private active: OpenDoc | null = null;
  private nextId = 1;
  private monaco: MonacoApi | null = null;
  private applyLanguage: ApplyLanguage | null = null;
  private editor: CodeEditor | null = null;
  private loading: Promise<void> | null = null;

  private readonly tabBar = h('div', { class: 'tabs', role: 'tablist' });
  private readonly host = h('div', { class: 'editor-host' });
  private readonly placeholder = h('div', { class: 'placeholder' }, 'Open a file from the explorer.');

  constructor(container: HTMLElement) {
    container.replaceChildren(this.tabBar, this.host, this.placeholder);
    this.updateChrome();
    registerCommand('file.save', () => this.save());
    registerCommand('tab.close', () => (this.active ? this.close(this.active) : undefined));
    registerCommand('tab.next', () => this.cycle(1));
    registerCommand('tab.previous', () => this.cycle(-1));
  }

  get activePath(): string | null {
    return this.active?.path ?? null;
  }

  hasUnsavedChanges(): boolean {
    return this.docs.some((d) => this.isDirty(d));
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
    if (!this.isDirty(doc)) return notify(`${baseName(doc.path)} has no changes`);
    // Capture before the write so edits made while saving keep the tab dirty.
    const version = doc.model.getAlternativeVersionId();
    const text = doc.model.getValue();
    try {
      await (await getFileSystem()).writeFile(doc.path, text);
    } catch (err) {
      return reportError(`Cannot save ${baseName(doc.path)}`, err);
    }
    doc.savedVersion = version;
    // Start a new undo step so undoing after a save stops at the saved text.
    doc.model.pushStackElement();
    this.renderTabBar();
    this.onDirtyChange.fire();
    notify(`Saved ${baseName(doc.path)}`);
  }

  private async close(doc: OpenDoc, force = false): Promise<void> {
    if (!force && this.isDirty(doc)) {
      const discard = await confirmDialog(`"${baseName(doc.path)}" has unsaved changes. Discard them?`, 'Discard');
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
        if (!isUnder(doc.path, op.from)) continue;
        doc.path = op.to + doc.path.slice(op.from.length);
        // The extension may have changed, so re-detect the language.
        if (this.monaco) this.applyLanguage?.(this.monaco, doc.model, doc.path);
      }
      this.renderTabBar();
      if (this.active) this.onActiveFileChange.fire(this.active.path);
    } else if (op.type === 'delete') {
      // The file is gone from disk, so close without asking.
      for (const doc of this.docs.filter((d) => isUnder(d.path, op.path))) void this.close(doc, true);
    }
  }

  // ---- internals ----------------------------------------------------------

  private isDirty(doc: OpenDoc): boolean {
    return doc.model.getAlternativeVersionId() !== doc.savedVersion;
  }

  private ensureEditor(): Promise<void> {
    this.loading ??= import('./monaco').then(({ monaco, applyLanguage }) => {
      this.monaco = monaco;
      this.applyLanguage = applyLanguage;
      this.editor = monaco.editor.create(this.host, {
        model: null,
        automaticLayout: true,
        fontSize: 14,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        theme: 'vs',
      });
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
        title: baseName(d.path),
        tooltip: d.path,
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
