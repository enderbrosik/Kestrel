// A small in-app confirm dialog. Native window.confirm() is unreliable inside
// some webviews, so Kestrel draws its own.

import { h } from '../core/dom';

export function confirmDialog(message: string, confirmLabel = 'OK'): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = h('div', { class: 'modal-overlay' });
    const finish = (result: boolean) => {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(result);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false);
      if (e.key === 'Enter') finish(true);
    };
    const dialog = h(
      'div',
      { class: 'modal', role: 'dialog', 'aria-modal': true },
      h('p', {}, message),
      h(
        'div',
        { class: 'modal-actions' },
        h('button', { onclick: () => finish(false) }, 'Cancel'),
        h('button', { class: 'primary', onclick: () => finish(true) }, confirmLabel),
      ),
    );
    overlay.append(dialog);
    document.body.append(overlay);
    document.addEventListener('keydown', onKey, true);
    (dialog.querySelector('.primary') as HTMLButtonElement | null)?.focus();
  });
}
