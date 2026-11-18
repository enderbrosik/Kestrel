// Tab bar rendering. Pure view code: it gets a list of tabs and callbacks and
// knows nothing about Monaco or files.

import { h } from '../core/dom';

export interface TabInfo {
  id: number;
  title: string;
  tooltip: string;
  dirty: boolean;
  active: boolean;
}

export interface TabHandlers {
  onSelect(id: number): void;
  onClose(id: number): void;
}

export function renderTabs(container: HTMLElement, tabs: TabInfo[], handlers: TabHandlers): void {
  container.replaceChildren(
    ...tabs.map((tab) => {
      const classes = ['tab'];
      if (tab.active) classes.push('active');
      if (tab.dirty) classes.push('dirty');
      return h(
        'div',
        {
          class: classes.join(' '),
          role: 'tab',
          'aria-selected': tab.active,
          title: tab.tooltip,
          onclick: () => handlers.onSelect(tab.id),
          // Middle click closes, like most editors.
          onauxclick: (e: MouseEvent) => {
            if (e.button === 1) {
              e.preventDefault();
              handlers.onClose(tab.id);
            }
          },
        },
        h('span', { class: 'tab-title' }, tab.title),
        h(
          'button',
          {
            class: 'tab-close',
            'aria-label': tab.dirty ? `Close ${tab.title} (unsaved changes)` : `Close ${tab.title}`,
            onclick: (e: MouseEvent) => {
              e.stopPropagation();
              handlers.onClose(tab.id);
            },
          },
          h('span', { class: 'dot', 'aria-hidden': 'true' }, '●'),
          h('span', { class: 'x', 'aria-hidden': 'true' }, '×'),
        ),
      );
    }),
  );
  container.querySelector('.tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
