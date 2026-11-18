// Application shell: lays out the title bar, sidebar, editor area, and status bar,
// then connects the features to each other.

import { h } from './core/dom';
import { runCommand } from './core/commands';
import { Explorer } from './workspace/explorer';
import { EditorPane } from './editor/editor-pane';
import { getConfigStore } from './config/store';
import { initKeybindings } from './keybindings';
import { initThemes, type ThemeManager } from './themes';
import { bindStatusBar } from './ui/status';

export function mountApp(root: HTMLElement, themes: ThemeManager): void {
  const sidebarTitle = h('span', { class: 'sidebar-title' }, 'Explorer');
  const tree = h('div', { class: 'explorer' });
  const statusMessage = h('span', { class: 'status-message', role: 'status' });
  const themeButton = h('button', { class: 'status-item', title: 'Switch theme mode', onclick: () => runCommand('theme.cycleMode') });
  const statusBar = h('footer', { class: 'statusbar' }, statusMessage, themeButton);
  const editorArea = h('section', { class: 'editor-area' });

  root.replaceChildren(
    h(
      'header',
      { class: 'titlebar' },
      h('span', { class: 'brand' }, 'Kestrel'),
      h('button', { onclick: () => runCommand('workspace.openFolder') }, 'Open Folder'),
    ),
    h(
      'div',
      { class: 'workbench' },
      h(
        'aside',
        { class: 'sidebar', 'aria-label': 'Explorer' },
        h(
          'div',
          { class: 'sidebar-header' },
          sidebarTitle,
          h(
            'div',
            { class: 'toolbar' },
            h('button', { title: 'New File', 'aria-label': 'New File', onclick: () => runCommand('explorer.newFile') }, '+'),
            h('button', { title: 'New Folder', 'aria-label': 'New Folder', onclick: () => runCommand('explorer.newFolder') }, '▤'),
            h('button', { title: 'Refresh', 'aria-label': 'Refresh', onclick: () => runCommand('explorer.refresh') }, '↻'),
          ),
        ),
        tree,
      ),
      editorArea,
    ),
    statusBar,
  );

  bindStatusBar(statusMessage, statusBar);
  const explorer = new Explorer(tree);
  explorer.onRootChange.on((path) => {
    sidebarTitle.textContent = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
    sidebarTitle.title = path;
  });
  const editor = new EditorPane(editorArea);
  explorer.onFileOpen.on((path) => void editor.openFile(path));
  explorer.onFileOperation.on((op) => editor.handleFileOperation(op));

  const showTheme = () => {
    const { mode, effectiveType, theme } = themes.state;
    themeButton.textContent = mode === 'auto' ? `Theme: Auto (${effectiveType})` : `Theme: ${mode}`;
    themeButton.title = `${theme.name}. Click to switch between auto, light, and dark.`;
    editor.setTheme(theme);
  };
  themes.onDidChange.on(showTheme);
  showTheme();

  void startConfig(editor, themes);

  // Warn before leaving the page with unsaved edits (web build).
  window.addEventListener('beforeunload', (e) => {
    if (editor.hasUnsavedChanges()) e.preventDefault();
  });
}

/** Loads user configuration (keybindings, themes) and reloads each when its file is saved. */
async function startConfig(editor: EditorPane, themes: ThemeManager): Promise<void> {
  const store = await getConfigStore();
  const openFile = (path: string) => editor.openFile(path);
  const keybindings = await initKeybindings({ store, openFile });
  const themeFiles = await initThemes({ manager: themes, store, openFile });
  const keybindingsFile = await keybindings.filePath();
  editor.onDidSave.on((path) => {
    if (path === keybindingsFile) void keybindings.reload();
    else if (themeFiles.isThemeFile(path)) void themeFiles.reload();
  });
}
