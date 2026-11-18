// Works out which part of the UI has keyboard focus, for "when" conditions.

export function contextsFor(el: Element | null): Set<string> {
  const contexts = new Set<string>();
  if (!el) return contexts;
  if (el.closest('.monaco-editor')) {
    contexts.add('editor');
    return contexts;
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    contexts.add('input');
    return contexts;
  }
  if (el.closest('.explorer')) contexts.add('explorer');
  return contexts;
}
