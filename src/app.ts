// Application shell: lays out the title bar, sidebar, editor area, and status bar,
// then connects the features to each other.

import { h } from './core/dom';
import { runCommand } from './core/commands';
import { Explorer } from './workspace/explorer';
import { bindStatusBar, notify } from './ui/status';

export function mountApp(root: HTMLElement): void {
  const sidebarTitle = h('span', { class: 'sidebar-title' }, 'Explorer');
  const tree = h('div', { class: 'explorer' });
  const statusBar = h('footer', { class: 'statusbar', role: 'status' });
  const editorArea = h('section', { class: 'editor-area' }, h('div', { class: 'placeholder' }, 'Open a file from the explorer.'));

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

  bindStatusBar(statusBar);
  const explorer = new Explorer(tree);
  explorer.onRootChange.on((path) => {
    sidebarTitle.textContent = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
    sidebarTitle.title = path;
  });
  // Opening a file in the editor is wired up in step 2 (tabs and editing).
  explorer.onFileOpen.on((path) => notify(`Open: ${path}`));
}
