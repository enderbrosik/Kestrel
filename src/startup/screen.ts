// The startup screen: open a folder, start with a blank slate, or pick a recent folder.

import { h } from '../core/dom';
import { reportError } from '../ui/status';
import type { RecentFolders } from './recent-folders';

export interface StartScreenDeps {
  recents: RecentFolders;
  openFolder(): Promise<void>;
  openRecent(path: string): Promise<void>;
  blankSlate(): void;
  /** True when there is already work open, so the screen may be dismissed with Escape. */
  canDismiss(): boolean;
}

export class StartScreen {
  readonly element: HTMLElement;
  private readonly list = h('ul', { class: 'recent-list' });

  constructor(private readonly deps: StartScreenDeps) {
    this.element = h(
      'div',
      { class: 'start-screen', role: 'region', 'aria-label': 'Start' },
      h(
        'div',
        { class: 'start-card' },
        h('h1', {}, 'Kestrel'),
        h('p', { class: 'start-tagline' }, 'An open-source code editor.'),
        h(
          'div',
          { class: 'start-actions' },
          h('button', { class: 'primary', onclick: () => void this.run(deps.openFolder) }, 'Open Folder…'),
          h('button', { onclick: () => deps.blankSlate() }, 'Blank slate'),
        ),
        h('h2', {}, 'Recent folders'),
        this.list,
      ),
    );
    deps.recents.onDidChange.on(() => this.renderRecents());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.element.hidden && deps.canDismiss()) this.hide();
    });
    this.renderRecents();
  }

  show(): void {
    this.element.hidden = false;
    this.renderRecents();
    this.element.querySelector<HTMLButtonElement>('button.primary')?.focus();
  }

  hide(): void {
    this.element.hidden = true;
  }

  private async run(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (err) {
      reportError('Cannot open the folder', err);
    }
  }

  private renderRecents(): void {
    const { recents } = this.deps;
    if (recents.list.length === 0) {
      this.list.replaceChildren(
        h('li', { class: 'recent-empty' }, recents.isLoaded ? 'No recent folders yet.' : 'Loading…'),
      );
      return;
    }
    this.list.replaceChildren(
      ...recents.list.map((folder) =>
        h(
          'li',
          { class: 'recent-item' },
          h(
            'button',
            {
              class: 'recent-open',
              title: folder.path,
              onclick: () => void this.run(() => this.deps.openRecent(folder.path)),
            },
            h('span', { class: 'recent-name' }, folder.name),
            h('span', { class: 'recent-path' }, folder.path),
          ),
          h(
            'button',
            {
              class: 'recent-remove',
              title: 'Remove from recent folders',
              'aria-label': `Remove ${folder.name} from recent folders`,
              onclick: () => void recents.remove(folder.path),
            },
            '×',
          ),
        ),
      ),
    );
  }
}
