// Loads keybindings: Kestrel's defaults first, then the user's keybindings.json
// on top. Pure functions, so they are unit tested without a browser.
//
// File format (JSON with comments allowed):
//   [
//     { "keys": "Mod+Alt+N", "run": "explorer.newFile" },
//     { "keys": "F2", "run": "explorer.rename", "when": "explorer" },
//     { "keys": "Mod+W", "run": null }          // removes a default binding
//   ]

import { parseJsonc } from '../config/jsonc';
import { parseChord, type Platform } from './keys';

/** Where focus must be for a binding to apply. */
export const KNOWN_CONTEXTS = ['explorer', 'editor', 'input'] as const;

export interface Binding {
  /** Canonical chord, e.g. "Meta+Shift+O". */
  chord: string;
  command: string;
  when?: string;
  source: 'default' | 'user';
}

export interface LoadResult {
  bindings: Binding[];
  /** Human-readable problems. Bad entries are skipped; good ones still load. */
  errors: string[];
}

interface Entry {
  chord: string;
  command: string | null;
  when?: string;
}

function readEntries(raw: unknown, label: string, platform: Platform, errors: string[]): Entry[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push(`${label}: expected a list of bindings like [{ "keys": "Mod+S", "run": "file.save" }]`);
    return [];
  }
  const entries: Entry[] = [];
  raw.forEach((item, index) => {
    const where = `${label} entry ${index + 1}`;
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      errors.push(`${where}: expected an object`);
      return;
    }
    const { keys, run, when } = item as Record<string, unknown>;
    if (typeof keys !== 'string') return void errors.push(`${where}: "keys" must be text such as "Mod+S"`);
    const chord = parseChord(keys, platform);
    if (!chord) return void errors.push(`${where}: "${keys}" is not a valid key combination`);
    if (run !== null && (typeof run !== 'string' || run.trim() === '')) {
      return void errors.push(`${where}: "run" must be a command id, or null to remove the binding`);
    }
    if (when !== undefined && (typeof when !== 'string' || !(KNOWN_CONTEXTS as readonly string[]).includes(when))) {
      return void errors.push(`${where}: "when" must be one of ${KNOWN_CONTEXTS.join(', ')}`);
    }
    entries.push({ chord, command: run === null ? null : (run as string).trim(), when: when as string | undefined });
  });
  return entries;
}

/**
 * Combine the default bindings with the user's file text (null if no file).
 * Later entries win. A `run: null` entry removes bindings for that chord: only
 * the matching `when` if one is given, otherwise every binding of that chord.
 */
export function loadKeybindings(defaults: unknown, userText: string | null, platform: Platform): LoadResult {
  const errors: string[] = [];
  let bindings: Binding[] = readEntries(defaults, 'default keybindings', platform, errors).flatMap((e) =>
    e.command === null ? [] : [{ chord: e.chord, command: e.command, when: e.when, source: 'default' as const }],
  );

  let userRaw: unknown;
  try {
    userRaw = userText === null ? undefined : parseJsonc(userText);
  } catch (err) {
    errors.push(`keybindings.json: ${err instanceof Error ? err.message : String(err)}`);
  }

  for (const entry of readEntries(userRaw, 'keybindings.json', platform, errors)) {
    if (entry.command === null) {
      bindings = bindings.filter((b) => !(b.chord === entry.chord && (entry.when === undefined || b.when === entry.when)));
    } else {
      bindings = bindings.filter((b) => !(b.chord === entry.chord && b.when === entry.when));
      bindings.push({ chord: entry.chord, command: entry.command, when: entry.when, source: 'user' });
    }
  }
  return { bindings, errors };
}

/**
 * Pick the binding for a chord given where focus is. A binding with a matching
 * `when` beats one without; among equals the later one wins.
 */
export function matchBinding(bindings: readonly Binding[], chord: string, contexts: ReadonlySet<string>): Binding | null {
  let best: Binding | null = null;
  for (const b of bindings) {
    if (b.chord !== chord) continue;
    if (b.when && !contexts.has(b.when)) continue;
    if (best?.when && !b.when) continue;
    best = b;
  }
  return best;
}

/** Starting text for a new keybindings.json: instructions plus the defaults, commented out. */
export function keybindingsTemplate(defaults: ReadonlyArray<{ keys: string; run: string; when?: string }>): string {
  const lines = [
    '// Kestrel keybindings. Changes apply as soon as you save this file.',
    '//',
    '// Each entry: { "keys": "Mod+S", "run": "file.save", "when": "explorer" }',
    '//   Mod is Cmd on macOS and Ctrl on Windows and Linux. Other modifiers: Ctrl, Alt, Shift, Meta.',
    '//   Letters and digits match the physical key, so layouts do not matter.',
    '//   "when" is optional: explorer, editor, or input (where keyboard focus is).',
    '//   "run": null removes a default binding for that key.',
    '//',
    '// Your entries override the defaults below. Copy a line out of the comment to change it.',
    '[',
    '  // Defaults:',
    ...defaults.map((d) => `  // ${JSON.stringify({ keys: d.keys, run: d.run, ...(d.when ? { when: d.when } : {}) })},`),
    ']',
    '',
  ];
  return lines.join('\n');
}
