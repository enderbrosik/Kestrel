// Loads settings.json: parses it, checks each value against the schema, and
// fills in defaults. Pure functions, unit tested. A bad value never blocks
// startup: it is reported and its default is used.

import { parseJsonc } from '../config/jsonc';
import { SETTINGS, findSetting, type SettingDef, type SettingValue, type Settings } from './schema';

export interface SettingsParseResult {
  /** Every known setting, from the file or the default. */
  settings: Settings;
  /** Keys that were present in the file with a valid value (shown as "modified"). */
  explicit: Set<string>;
  /** Problems with individual values. The rest of the file still applies. */
  errors: string[];
  /** Set if the file is not valid JSON (or not an object). Nothing from it was used. */
  syntaxError: string | null;
}

export function defaultSettings(): Settings {
  return Object.fromEntries(SETTINGS.map((s) => [s.key, s.default]));
}

/** Check one value against its definition. Returns the value to use, or an error message. */
export function validateSetting(def: SettingDef, value: unknown): { ok: true; value: SettingValue } | { ok: false; error: string } {
  switch (def.type) {
    case 'boolean':
      return typeof value === 'boolean' ? { ok: true, value } : { ok: false, error: 'must be true or false' };
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return { ok: false, error: 'must be a number' };
      if (def.integer && !Number.isInteger(value)) return { ok: false, error: 'must be a whole number' };
      if (value < def.min || value > def.max) return { ok: false, error: `must be between ${def.min} and ${def.max}` };
      return { ok: true, value };
    }
    case 'enum':
      return typeof value === 'string' && def.options.includes(value)
        ? { ok: true, value }
        : { ok: false, error: `must be one of: ${def.options.join(', ')}` };
    case 'string':
      return typeof value === 'string' ? { ok: true, value } : { ok: false, error: 'must be text' };
  }
}

/** Parse settings.json text (null when the file does not exist yet). */
export function parseSettings(text: string | null): SettingsParseResult {
  const settings = defaultSettings();
  const explicit = new Set<string>();
  const errors: string[] = [];
  const result = (syntaxError: string | null): SettingsParseResult => ({ settings, explicit, errors, syntaxError });

  let raw: unknown;
  try {
    raw = text === null ? undefined : parseJsonc(text);
  } catch (err) {
    return result(err instanceof Error ? err.message : String(err));
  }
  if (raw === undefined) return result(null);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return result('settings.json must be an object like { "editor.fontSize": 15 }');
  }

  for (const [key, value] of Object.entries(raw)) {
    const def = findSetting(key);
    if (!def) {
      errors.push(`Unknown setting "${key}"`);
      continue;
    }
    const checked = validateSetting(def, value);
    if (checked.ok) {
      settings[key] = checked.value;
      explicit.add(key);
    } else {
      errors.push(`"${key}" ${checked.error}`);
    }
  }
  return result(null);
}

/** Starting text for a new settings.json: every setting as a commented-out line. */
export function settingsTemplate(): string {
  const lines = [
    '// Kestrel settings. Saving this file applies the changes.',
    '// The settings screen (Mod+,) edits this same file. Remove the // from a line to change that setting.',
    '{',
  ];
  let group = '';
  for (const def of SETTINGS) {
    if (def.group !== group) {
      if (group) lines.push('');
      lines.push(`  // ${def.group}`);
      group = def.group;
    }
    const hint = def.type === 'enum' ? ` (${def.options.join(', ')})` : def.type === 'number' ? ` (${def.min} to ${def.max})` : '';
    lines.push(`  // ${def.label}: ${def.description}${hint}`);
    lines.push(`  // ${JSON.stringify(def.key)}: ${JSON.stringify(def.default)},`);
  }
  lines.push('}', '');
  return lines.join('\n');
}
