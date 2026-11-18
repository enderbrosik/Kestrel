// Status bar messages. Errors and short notices from any feature go here.

type Level = 'info' | 'error';

let statusEl: HTMLElement | null = null;
let timer: number | undefined;

export function bindStatusBar(el: HTMLElement): void {
  statusEl = el;
}

export function notify(message: string, level: Level = 'info', timeoutMs = 4000): void {
  if (!statusEl) {
    console.log(message);
    return;
  }
  statusEl.textContent = message;
  statusEl.dataset.level = level;
  window.clearTimeout(timer);
  if (timeoutMs > 0) {
    timer = window.setTimeout(() => {
      if (statusEl) {
        statusEl.textContent = '';
        statusEl.dataset.level = 'info';
      }
    }, timeoutMs);
  }
}

export function reportError(message: string, err?: unknown): void {
  const detail = err instanceof Error ? err.message : err ? String(err) : '';
  notify(detail ? `${message}: ${detail}` : message, 'error', 6000);
}
