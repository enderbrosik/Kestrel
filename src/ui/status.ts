// Status bar messages. Errors and short notices from any feature go here.

type Level = 'info' | 'error';

let statusEl: HTMLElement | null = null;
let barEl: HTMLElement | null = null;
let timer: number | undefined;

/** `message` shows the text; `bar` (default: the same element) carries the error styling. */
export function bindStatusBar(message: HTMLElement, bar: HTMLElement = message): void {
  statusEl = message;
  barEl = bar;
}

function setLevel(level: Level): void {
  if (barEl) barEl.dataset.level = level;
}

export function notify(message: string, level: Level = 'info', timeoutMs = 4000): void {
  if (!statusEl) {
    console.log(message);
    return;
  }
  statusEl.textContent = message;
  setLevel(level);
  window.clearTimeout(timer);
  if (timeoutMs > 0) {
    timer = window.setTimeout(() => {
      if (statusEl) {
        statusEl.textContent = '';
        setLevel('info');
      }
    }, timeoutMs);
  }
}

export function reportError(message: string, err?: unknown): void {
  const detail = err instanceof Error ? err.message : err ? String(err) : '';
  notify(detail ? `${message}: ${detail}` : message, 'error', 6000);
}
