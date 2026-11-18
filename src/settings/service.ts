// Holds the current settings, reads and writes settings.json, and tells the
// rest of the app when something changed.

import { removeProperty, setProperty } from '../config/jsonc-edit';
import type { ConfigStore } from '../config/store';
import { Emitter } from '../core/events';
import { defaultSettings, parseSettings, settingsTemplate, validateSetting } from './loader';
import { findSetting, type SettingValue, type Settings } from './schema';

export const SETTINGS_FILE = 'settings.json';

export class SettingsService {
  readonly onDidChange = new Emitter<Settings>();

  private text: string | null = null;
  private current: Settings = defaultSettings();
  private explicitKeys = new Set<string>();
  private errors: string[] = [];
  private syntaxError: string | null = null;

  constructor(private readonly store: ConfigStore) {}

  get values(): Settings {
    return this.current;
  }

  /** Problems with individual values in the file. */
  get problems(): string[] {
    return this.errors;
  }

  /** Set when the file is not valid JSON. While set, nothing from the file is applied. */
  get fileError(): string | null {
    return this.syntaxError;
  }

  /** True if the file sets this key (so it differs from "use the default"). */
  isSet(key: string): boolean {
    return this.explicitKeys.has(key);
  }

  /** Re-read settings.json and notify listeners. */
  async reload(): Promise<void> {
    this.text = await this.store.read(SETTINGS_FILE);
    const parsed = parseSettings(this.text);
    this.current = parsed.settings;
    this.explicitKeys = parsed.explicit;
    this.errors = parsed.errors;
    this.syntaxError = parsed.syntaxError;
    this.onDidChange.fire(this.current);
  }

  /** Change one setting in the file. Throws a readable Error if the value or the file is invalid. */
  async set(key: string, value: SettingValue): Promise<void> {
    const def = findSetting(key);
    if (!def) throw new Error(`Unknown setting "${key}"`);
    const checked = validateSetting(def, value);
    if (!checked.ok) throw new Error(`"${key}" ${checked.error}`);
    await this.write((text) => setProperty(text, key, checked.value));
  }

  /** Remove a setting from the file so its default applies again. */
  async reset(key: string): Promise<void> {
    if (!findSetting(key)) throw new Error(`Unknown setting "${key}"`);
    await this.write((text) => removeProperty(text, key));
  }

  private async write(edit: (text: string) => string): Promise<void> {
    if (this.syntaxError) throw new Error(`settings.json has a syntax error (${this.syntaxError}). Fix it in the file first.`);
    const before = this.text ?? settingsTemplate();
    const after = edit(before);
    if (after !== before || this.text === null) await this.store.write(SETTINGS_FILE, after);
    await this.reload();
  }
}
