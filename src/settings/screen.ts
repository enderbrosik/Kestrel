// The settings screen: a form generated from the settings schema. Every change
// is written to settings.json by the SettingsService, which edits just that
// one entry, so the file stays the single source of truth.

import { h } from '../core/dom';
import { reportError } from '../ui/status';
import { SETTINGS, type SettingDef } from './schema';
import { validateSetting } from './loader';
import type { SettingsService } from './service';

export interface SettingsScreenDeps {
  service: SettingsService;
  /** Installed themes of one type, for the theme pickers. */
  themeOptions(kind: 'light-themes' | 'dark-themes'): Array<{ id: string; name: string }>;
  /** Open settings.json in the editor. */
  openFile(): void;
}

interface Row {
  def: SettingDef;
  control: HTMLInputElement | HTMLSelectElement;
  root: HTMLElement;
  error: HTMLElement;
  reset: HTMLButtonElement;
}

export class SettingsScreen {
  readonly element: HTMLElement;
  private readonly banner = h('div', { class: 'settings-banner', hidden: true, role: 'alert' });
  private readonly rows = new Map<string, Row>();

  constructor(private readonly deps: SettingsScreenDeps) {
    const body = h('div', { class: 'settings-body' }, this.banner);
    for (const group of ['Appearance', 'Editor'] as const) {
      body.append(h('h3', {}, group));
      for (const def of SETTINGS.filter((s) => s.group === group)) body.append(this.buildRow(def).root);
    }

    this.element = h(
      'div',
      {
        class: 'settings-screen',
        role: 'dialog',
        'aria-label': 'Settings',
        'aria-modal': true,
        tabindex: -1,
        hidden: true,
      },
      h(
        'header',
        { class: 'settings-header' },
        h('h2', {}, 'Settings'),
        h(
          'div',
          { class: 'settings-actions' },
          h('button', { onclick: () => deps.openFile() }, 'Open settings.json'),
          h('button', { 'aria-label': 'Close settings', onclick: () => this.close() }, '×'),
        ),
      ),
      body,
    );
    // On the document, not the screen: a button that hides itself (Reset) drops focus to the page.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        e.stopPropagation();
        this.close();
      }
    });
    this.refresh();
  }

  get isOpen(): boolean {
    return !this.element.hidden;
  }

  open(): void {
    this.refresh();
    this.element.hidden = false;
    this.element.focus();
  }

  close(): void {
    this.element.hidden = true;
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  /** Bring every control up to date with the current settings, without rebuilding the form. */
  refresh(): void {
    const { service } = this.deps;
    const broken = service.fileError !== null;

    const notes: string[] = [];
    if (broken) notes.push(`settings.json has a syntax error: ${service.fileError}. Fix it in the file; changes here cannot be saved until then.`);
    else if (service.problems.length > 0) notes.push(`Some entries in settings.json were ignored: ${service.problems.join('; ')}.`);
    this.banner.hidden = notes.length === 0;
    this.banner.textContent = notes.join(' ');

    for (const row of this.rows.values()) {
      const { def, control } = row;
      const value = service.values[def.key]!;
      if (def.type === 'string' && def.choices) this.fillThemeOptions(control as HTMLSelectElement, def.choices, String(value));
      if (document.activeElement !== control) {
        if (control instanceof HTMLInputElement && control.type === 'checkbox') control.checked = Boolean(value);
        else control.value = String(value);
      }
      control.disabled = broken;
      const modified = service.isSet(def.key);
      row.root.classList.toggle('modified', modified);
      row.reset.hidden = !modified;
      row.reset.disabled = broken;
    }
  }

  // ---- building -----------------------------------------------------------

  private buildRow(def: SettingDef): Row {
    const id = `setting-${def.key}`;
    const control = this.buildControl(def, id);
    const error = h('div', { class: 'setting-error', role: 'alert', hidden: true });
    const reset = h('button', { class: 'setting-reset', title: 'Reset to default', onclick: () => void this.save(row, undefined).then(() => row.control.focus()) }, 'Reset');
    const root = h(
      'div',
      { class: 'setting-row' },
      h(
        'div',
        { class: 'setting-text' },
        h('label', { for: id, class: 'setting-label' }, def.label),
        h('code', { class: 'setting-key' }, def.key),
        h('p', { class: 'setting-description' }, def.description),
        error,
      ),
      h('div', { class: 'setting-control' }, control, reset),
    );
    const row: Row = { def, control, root, error, reset };
    this.rows.set(def.key, row);
    return row;
  }

  private buildControl(def: SettingDef, id: string): HTMLInputElement | HTMLSelectElement {
    const commit = () => void this.save(this.rows.get(def.key)!, read());
    const read = (): unknown => {
      const c = this.rows.get(def.key)!.control;
      if (def.type === 'boolean') return (c as HTMLInputElement).checked;
      if (def.type === 'number') return c.value.trim() === '' ? NaN : Number(c.value);
      return c.value;
    };

    if (def.type === 'boolean') return h('input', { id, type: 'checkbox', onchange: commit });
    if (def.type === 'number') {
      return h('input', { id, type: 'number', min: def.min, max: def.max, step: def.integer ? 1 : 'any', onchange: commit });
    }
    if (def.type === 'enum') {
      return h('select', { id, onchange: commit }, ...def.options.map((o) => h('option', { value: o }, o)));
    }
    if (def.choices) return h('select', { id, onchange: commit });
    return h('input', { id, type: 'text', spellcheck: false, onchange: commit });
  }

  private fillThemeOptions(select: HTMLSelectElement, kind: 'light-themes' | 'dark-themes', current: string): void {
    const options = this.deps.themeOptions(kind);
    const known = options.some((o) => o.id === current);
    const wanted = [...options.map((o) => ({ id: o.id, label: `${o.name} (${o.id})` })), ...(known ? [] : [{ id: current, label: `${current} (not found)` }])];
    const same = wanted.length === select.options.length && wanted.every((w, i) => select.options[i]!.value === w.id && select.options[i]!.textContent === w.label);
    if (!same) select.replaceChildren(...wanted.map((w) => h('option', { value: w.id }, w.label)));
  }

  /** Write one value (or, with undefined, reset it). Shows problems next to the setting. */
  private async save(row: Row, value: unknown): Promise<void> {
    const { service } = this.deps;
    row.error.hidden = true;
    try {
      if (value === undefined) {
        await service.reset(row.def.key);
      } else {
        const checked = validateSetting(row.def, value);
        if (!checked.ok) throw new Error(checked.error);
        await service.set(row.def.key, checked.value);
      }
    } catch (err) {
      row.error.textContent = err instanceof Error ? err.message : String(err);
      row.error.hidden = false;
      reportError(`Cannot change ${row.def.label}`, err);
      this.refresh(); // put the control back to the real value
    }
  }
}
