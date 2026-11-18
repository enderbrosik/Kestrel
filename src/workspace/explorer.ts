// Explorer: the folder tree in the sidebar. Create, rename, delete, and move
// files and folders. It only changes disk through the FileSystemBackend, and
// tells other features what changed through events.

import { h } from '../core/dom';
import { Emitter } from '../core/events';
import { registerCommand, runCommand } from '../core/commands';
import { baseName, getFileSystem, type FileEntry, type FileSystemBackend } from '../platform/fs';
import { confirmDialog } from '../ui/dialog';
import { notify, reportError } from '../ui/status';

export type FileOperation =
  | { type: 'create'; path: string }
  | { type: 'rename'; from: string; to: string }
  | { type: 'move'; from: string; to: string }
  | { type: 'delete'; path: string };

interface TreeNode {
  path: string;
  name: string;
  isDir: boolean;
  expanded: boolean;
  /** null until the folder has been read from disk. */
  children: TreeNode[] | null;
}

type PendingEdit = { kind: 'new-file' | 'new-dir'; dir: string } | { kind: 'rename'; path: string };

const DRAG_TYPE = 'application/x-kestrel-path';

export class Explorer {
  readonly onFileOpen = new Emitter<string>();
  readonly onFileOperation = new Emitter<FileOperation>();
  readonly onRootChange = new Emitter<string>();

  private fs: FileSystemBackend | null = null;
  private root: TreeNode | null = null;
  private selected: string | null = null;
  private edit: PendingEdit | null = null;
  private menu: HTMLElement | null = null;

  constructor(private readonly container: HTMLElement) {
    registerCommand('explorer.newFile', () => this.startCreate('new-file'));
    registerCommand('explorer.newFolder', () => this.startCreate('new-dir'));
    registerCommand('explorer.rename', () => this.startRename());
    registerCommand('explorer.delete', () => this.deleteSelected());
    registerCommand('explorer.refresh', () => this.refresh());
    registerCommand('workspace.openFolder', () => this.openFolder());
    registerCommand('explorer.selectNext', () => this.moveSelection(1));
    registerCommand('explorer.selectPrevious', () => this.moveSelection(-1));
    registerCommand('explorer.expand', () => this.expandSelected());
    registerCommand('explorer.collapse', () => this.collapseSelected());
    registerCommand('explorer.open', () => this.openSelected());
    registerCommand('view.focusExplorer', () => this.focus());
    this.container.tabIndex = 0; // so the tree can take keyboard focus
    this.render();
  }

  get rootPath(): string | null {
    return this.root?.path ?? null;
  }

  async openFolder(): Promise<void> {
    const fs = await this.backend();
    const path = await fs.pickFolder();
    if (path) await this.setRoot(path);
  }

  async setRoot(path: string): Promise<void> {
    const previous = this.root;
    this.root = { path, name: baseName(path), isDir: true, expanded: true, children: null };
    this.selected = null;
    this.edit = null;
    try {
      await this.reloadExpanded(this.root);
    } catch (err) {
      this.root = previous;
      reportError(`Cannot open ${path}`, err);
      this.render();
      return;
    }
    this.render();
    this.onRootChange.fire(path);
  }

  async refresh(): Promise<void> {
    if (!this.root) return;
    await this.reloadExpanded(this.root);
    this.render();
  }

  // ---- commands -----------------------------------------------------------

  private async startCreate(kind: 'new-file' | 'new-dir'): Promise<void> {
    if (!this.root) return notify('Open a folder first');
    const target = this.selectedNode() ?? this.root;
    const dirNode = target.isDir ? target : (this.findParent(target.path) ?? this.root);
    try {
      if (dirNode.children === null) await this.loadChildren(dirNode);
    } catch (err) {
      return reportError('Cannot read folder', err);
    }
    dirNode.expanded = true;
    this.edit = { kind, dir: dirNode.path };
    this.render();
  }

  private startRename(): void {
    const node = this.selectedNode();
    if (!node) return notify('Select a file or folder to rename');
    if (node === this.root) return notify('The opened folder cannot be renamed here');
    this.edit = { kind: 'rename', path: node.path };
    this.render();
  }

  private async deleteSelected(): Promise<void> {
    const node = this.selectedNode();
    if (!node) return notify('Select a file or folder to delete');
    if (node === this.root) return notify('The opened folder cannot be deleted here');
    const ok = await confirmDialog(`Delete "${node.name}"? This cannot be undone.`, 'Delete');
    if (!ok) return;
    try {
      const fs = await this.backend();
      await fs.remove(node.path);
      this.selected = null;
      this.onFileOperation.fire({ type: 'delete', path: node.path });
      await this.refresh();
    } catch (err) {
      reportError(`Could not delete ${node.name}`, err);
    }
  }

  // ---- keyboard navigation ------------------------------------------------

  focus(): void {
    this.container.focus();
    if (this.root && !this.selectedNode()) {
      this.selected = this.visibleNodes()[0]?.path ?? null;
      this.render();
    }
  }

  private visibleNodes(): TreeNode[] {
    const out: TreeNode[] = [];
    const walk = (node: TreeNode) => {
      for (const child of node.children ?? []) {
        out.push(child);
        if (child.isDir && child.expanded) walk(child);
      }
    };
    if (this.root) walk(this.root);
    return out;
  }

  private moveSelection(step: 1 | -1): void {
    const nodes = this.visibleNodes();
    if (nodes.length === 0) return;
    const index = nodes.findIndex((n) => n.path === this.selected);
    const next = index < 0 ? (step === 1 ? 0 : nodes.length - 1) : Math.min(nodes.length - 1, Math.max(0, index + step));
    this.selected = nodes[next]!.path;
    this.render();
  }

  private async expandSelected(): Promise<void> {
    const node = this.selectedNode();
    if (!node?.isDir) return;
    if (!node.expanded) await this.toggle(node);
    else if (node.children?.[0]) {
      this.selected = node.children[0].path;
      this.render();
    }
  }

  private async collapseSelected(): Promise<void> {
    const node = this.selectedNode();
    if (!node) return;
    if (node.isDir && node.expanded) return this.toggle(node);
    const parent = this.findParent(node.path);
    if (parent && parent !== this.root) {
      this.selected = parent.path;
      this.render();
    }
  }

  private async openSelected(): Promise<void> {
    const node = this.selectedNode();
    if (node) await this.activate(node);
  }

  // ---- edit flow ----------------------------------------------------------

  private async commitEdit(value: string): Promise<void> {
    const edit = this.edit;
    this.edit = null;
    const name = value.trim();
    if (!edit || !name) return this.render();
    try {
      const fs = await this.backend();
      if (edit.kind === 'rename') {
        const node = this.findNode(edit.path);
        if (!node || name === node.name) return this.render();
        const to = await fs.rename(edit.path, name);
        this.selected = to;
        this.onFileOperation.fire({ type: 'rename', from: edit.path, to });
      } else {
        const created =
          edit.kind === 'new-file' ? await fs.createFile(edit.dir, name) : await fs.createDir(edit.dir, name);
        this.selected = created;
        this.onFileOperation.fire({ type: 'create', path: created });
        if (edit.kind === 'new-file') this.onFileOpen.fire(created);
      }
      await this.refresh();
    } catch (err) {
      reportError('Could not complete the change', err);
      this.render();
    }
  }

  private cancelEdit(): void {
    if (!this.edit) return;
    this.edit = null;
    this.render();
  }

  private async moveInto(src: string, destDir: string): Promise<void> {
    if (this.findParent(src)?.path === destDir || src === destDir) return;
    try {
      const fs = await this.backend();
      const dest = this.findNode(destDir);
      if (dest && !dest.expanded) dest.expanded = true;
      const to = await fs.move(src, destDir);
      this.selected = to;
      this.onFileOperation.fire({ type: 'move', from: src, to });
      await this.refresh();
    } catch (err) {
      reportError('Could not move', err);
    }
  }

  // ---- tree state ---------------------------------------------------------

  private async backend(): Promise<FileSystemBackend> {
    this.fs ??= await getFileSystem();
    return this.fs;
  }

  private async loadChildren(node: TreeNode): Promise<void> {
    const fs = await this.backend();
    const entries: FileEntry[] = await fs.listDir(node.path);
    const previous = new Map((node.children ?? []).map((c) => [c.path, c]));
    node.children = entries.map((entry) => {
      const old = previous.get(entry.path);
      return {
        path: entry.path,
        name: entry.name,
        isDir: entry.isDir,
        expanded: old?.expanded ?? false,
        children: old?.children ?? null,
      };
    });
  }

  /** Re-read a folder and every expanded folder below it, keeping expansion state. */
  private async reloadExpanded(node: TreeNode): Promise<void> {
    await this.loadChildren(node);
    for (const child of node.children ?? []) {
      if (child.isDir && child.expanded) await this.reloadExpanded(child);
    }
  }

  private async toggle(node: TreeNode): Promise<void> {
    node.expanded = !node.expanded;
    if (node.expanded && node.children === null) {
      try {
        await this.loadChildren(node);
      } catch (err) {
        node.expanded = false;
        reportError(`Cannot read ${node.name}`, err);
      }
    }
    this.render();
  }

  private async activate(node: TreeNode): Promise<void> {
    this.selected = node.path;
    if (node.isDir) {
      await this.toggle(node);
    } else {
      this.render();
      this.onFileOpen.fire(node.path);
    }
  }

  private selectedNode(): TreeNode | null {
    return this.selected ? this.findNode(this.selected) : null;
  }

  private findNode(path: string, from: TreeNode | null = this.root): TreeNode | null {
    if (!from) return null;
    if (from.path === path) return from;
    for (const child of from.children ?? []) {
      const found = this.findNode(path, child);
      if (found) return found;
    }
    return null;
  }

  private findParent(path: string, from: TreeNode | null = this.root): TreeNode | null {
    for (const child of from?.children ?? []) {
      if (child.path === path) return from;
      const found = this.findParent(path, child);
      if (found) return found;
    }
    return null;
  }

  // ---- rendering ----------------------------------------------------------

  private render(): void {
    this.closeMenu();
    if (!this.root) {
      this.container.replaceChildren(
        h(
          'div',
          { class: 'empty-state' },
          h('p', {}, 'No folder open.'),
          h('button', { class: 'primary', onclick: () => runCommand('workspace.openFolder') }, 'Open Folder'),
        ),
      );
      return;
    }
    const list = h('ul', {
      class: 'tree',
      role: 'tree',
      ondragover: (e: DragEvent) => this.allowDrop(e),
      ondrop: (e: DragEvent) => this.drop(e, this.root!.path),
    });
    const addRows = (parent: TreeNode, depth: number) => {
      if (this.edit && this.edit.kind !== 'rename' && this.edit.dir === parent.path) {
        list.append(this.renderEditRow(this.edit.kind, depth));
      }
      for (const node of parent.children ?? []) {
        list.append(this.renderRow(node, depth, parent));
        if (node.isDir && node.expanded) addRows(node, depth + 1);
      }
    };
    addRows(this.root, 0);
    this.container.replaceChildren(list);
    this.focusEditor();
    this.container.querySelector('.row.selected')?.scrollIntoView({ block: 'nearest' });
  }

  private renderRow(node: TreeNode, depth: number, parent: TreeNode): HTMLElement {
    const editing = this.edit?.kind === 'rename' && this.edit.path === node.path;
    const dropDir = node.isDir ? node.path : parent.path;
    const classes = ['row', node.isDir ? 'dir' : 'file'];
    if (this.selected === node.path) classes.push('selected');
    return h(
      'li',
      {
        class: classes.join(' '),
        role: 'treeitem',
        'aria-selected': this.selected === node.path,
        'aria-expanded': node.isDir ? node.expanded : undefined,
        draggable: !editing,
        'data-path': node.path,
        'data-drop-dir': dropDir,
        style: { paddingLeft: `${8 + depth * 12}px` },
        onclick: () => {
          if (!editing) void this.activate(node);
        },
        oncontextmenu: (e: MouseEvent) => {
          e.preventDefault();
          this.selected = node.path;
          this.render();
          this.showMenu(e.clientX, e.clientY);
        },
        ondragstart: (e: DragEvent) => {
          e.dataTransfer?.setData(DRAG_TYPE, node.path);
          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        },
        ondragover: (e: DragEvent) => this.allowDrop(e),
        ondrop: (e: DragEvent) => this.drop(e, dropDir),
      },
      h('span', { class: 'chevron', 'aria-hidden': 'true' }, node.isDir ? (node.expanded ? '▾' : '▸') : ''),
      editing ? this.renderInput(node.name) : h('span', { class: 'name' }, node.name),
    );
  }

  private renderEditRow(kind: 'new-file' | 'new-dir', depth: number): HTMLElement {
    return h(
      'li',
      { class: 'row editing', style: { paddingLeft: `${8 + depth * 12}px` } },
      h('span', { class: 'chevron', 'aria-hidden': 'true' }, kind === 'new-dir' ? '▸' : ''),
      this.renderInput(''),
    );
  }

  private renderInput(initial: string): HTMLInputElement {
    const input = h('input', {
      class: 'rename-input',
      value: initial,
      spellcheck: false,
      'aria-label': 'Name',
      'data-editor-input': true,
      onclick: (e: MouseEvent) => e.stopPropagation(),
      onmousedown: (e: MouseEvent) => e.stopPropagation(),
      onkeydown: (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void this.commitEdit(input.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.cancelEdit();
        }
      },
      onblur: () => this.cancelEdit(),
    });
    return input;
  }

  /** Select the file name (without its extension) in a freshly rendered input. */
  private focusEditor(): void {
    const input = this.container.querySelector<HTMLInputElement>('[data-editor-input]');
    if (!input) return;
    input.focus();
    const dot = input.value.lastIndexOf('.');
    input.setSelectionRange(0, dot > 0 && this.edit?.kind === 'rename' ? dot : input.value.length);
  }

  private allowDrop(e: DragEvent): void {
    if (!e.dataTransfer?.types.includes(DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  private drop(e: DragEvent, destDir: string): void {
    const src = e.dataTransfer?.getData(DRAG_TYPE);
    if (!src) return;
    e.preventDefault();
    e.stopPropagation();
    void this.moveInto(src, destDir);
  }

  // ---- context menu -------------------------------------------------------

  private showMenu(x: number, y: number): void {
    this.closeMenu();
    const items: Array<[string, string]> = [
      ['New File', 'explorer.newFile'],
      ['New Folder', 'explorer.newFolder'],
      ['Rename', 'explorer.rename'],
      ['Delete', 'explorer.delete'],
    ];
    const menu = h(
      'div',
      { class: 'context-menu', role: 'menu', style: { left: `${x}px`, top: `${y}px` } },
      ...items.map(([label, command]) =>
        h(
          'button',
          {
            role: 'menuitem',
            onclick: () => {
              this.closeMenu();
              void runCommand(command);
            },
          },
          label,
        ),
      ),
    );
    document.body.append(menu);
    this.menu = menu;
    const closeOnOutside = (e: Event) => {
      if (!menu.contains(e.target as Node)) {
        this.closeMenu();
        document.removeEventListener('mousedown', closeOnOutside, true);
      }
    };
    document.addEventListener('mousedown', closeOnOutside, true);
  }

  private closeMenu(): void {
    this.menu?.remove();
    this.menu = null;
  }
}
