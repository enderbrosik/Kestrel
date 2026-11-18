// Key chords: parsing "Mod+Shift+O" from the keybindings file, and turning a
// keyboard event into the same canonical form so the two can be compared.
//
// Canonical form: modifiers in the fixed order Ctrl, Alt, Shift, Meta, then the
// key, joined by "+". "Mod" means Cmd (Meta) on macOS and Ctrl elsewhere.
// Letters and digits are matched by physical key position (event.code), so
// bindings work the same on any keyboard layout and with Option held on macOS.

export type Platform = 'mac' | 'other';

export interface KeyEventLike {
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

type Modifier = 'Ctrl' | 'Alt' | 'Shift' | 'Meta';
const MODIFIER_ORDER: Modifier[] = ['Ctrl', 'Alt', 'Shift', 'Meta'];

const MODIFIER_ALIASES: Record<string, Modifier | 'Mod'> = {
  mod: 'Mod',
  cmdorctrl: 'Mod',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  opt: 'Alt',
  shift: 'Shift',
  meta: 'Meta',
  cmd: 'Meta',
  command: 'Meta',
  super: 'Meta',
  win: 'Meta',
};

const KEY_ALIASES: Record<string, string> = {
  esc: 'Escape',
  escape: 'Escape',
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  space: 'Space',
  backspace: 'Backspace',
  delete: 'Delete',
  del: 'Delete',
  up: 'Up',
  arrowup: 'Up',
  down: 'Down',
  arrowdown: 'Down',
  left: 'Left',
  arrowleft: 'Left',
  right: 'Right',
  arrowright: 'Right',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  insert: 'Insert',
  plus: '+',
  comma: ',',
  period: '.',
  dot: '.',
  slash: '/',
  backslash: '\\',
  semicolon: ';',
  quote: "'",
  backquote: '`',
  backtick: '`',
  minus: '-',
  equal: '=',
  equals: '=',
  bracketleft: '[',
  bracketright: ']',
};

const PUNCTUATION = new Set([',', '.', '/', ';', "'", '`', '[', ']', '\\', '-', '=']);

/** Physical key names (KeyboardEvent.code) for keys that are not letters, digits, or F-keys. */
const CODE_KEYS: Record<string, string> = {
  Comma: ',',
  Period: '.',
  Slash: '/',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Minus: '-',
  Equal: '=',
  Enter: 'Enter',
  NumpadEnter: 'Enter',
  Escape: 'Escape',
  Tab: 'Tab',
  Space: 'Space',
  Backspace: 'Backspace',
  Delete: 'Delete',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Insert: 'Insert',
};

export function detectPlatform(nav: { platform?: string; userAgent?: string } = navigator): Platform {
  return /mac|iphone|ipad/i.test(nav.platform ?? '') || /Mac OS X/.test(nav.userAgent ?? '') ? 'mac' : 'other';
}

function normalizeKeyName(raw: string): string | null {
  if (raw.length === 1) {
    if (/[a-z]/i.test(raw)) return raw.toUpperCase();
    if (/\d/.test(raw) || PUNCTUATION.has(raw) || raw === '+') return raw;
    if (raw === ' ') return 'Space';
    return null;
  }
  const lower = raw.toLowerCase();
  if (/^f([1-9]|1\d|2[0-4])$/.test(lower)) return lower.toUpperCase();
  return KEY_ALIASES[lower] ?? null;
}

function canonical(mods: Set<Modifier>, key: string): string {
  return [...MODIFIER_ORDER.filter((m) => mods.has(m)), key].join('+');
}

/**
 * Parse text such as "Mod+Shift+O" into canonical form for the given platform.
 * Returns null if the text is not a valid single chord.
 */
export function parseChord(text: string, platform: Platform): string | null {
  const parts = text.trim().split('+');
  if (parts.length === 0 || parts.some((p) => p.trim() === '')) return null;
  const keyPart = parts[parts.length - 1]!.trim();
  const key = normalizeKeyName(keyPart);
  if (!key) return null;

  const mods = new Set<Modifier>();
  for (const part of parts.slice(0, -1)) {
    const alias = MODIFIER_ALIASES[part.trim().toLowerCase()];
    if (!alias) return null;
    mods.add(alias === 'Mod' ? (platform === 'mac' ? 'Meta' : 'Ctrl') : alias);
  }
  return canonical(mods, key);
}

/** Canonical chord for a keyboard event, or null for a bare modifier press. */
export function eventToChord(e: KeyEventLike): string | null {
  let key: string | null = null;
  const letter = /^Key([A-Z])$/.exec(e.code);
  const digit = /^Digit(\d)$/.exec(e.code);
  if (letter) key = letter[1]!;
  else if (digit) key = digit[1]!;
  else if (/^F([1-9]|1\d|2[0-4])$/.test(e.code)) key = e.code;
  else if (CODE_KEYS[e.code]) key = CODE_KEYS[e.code]!;
  else if (!/^(Shift|Control|Alt|Meta|OS|Caps)/.test(e.code) && e.key) key = normalizeKeyName(e.key);
  if (!key) return null;

  const mods = new Set<Modifier>();
  if (e.ctrlKey) mods.add('Ctrl');
  if (e.altKey) mods.add('Alt');
  if (e.shiftKey) mods.add('Shift');
  if (e.metaKey) mods.add('Meta');
  return canonical(mods, key);
}

const MAC_SYMBOLS: Record<string, string> = { Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Meta: '⌘' };

/** Human-friendly label for a canonical chord, e.g. "⌘S" on macOS or "Ctrl+S" elsewhere. */
export function formatChord(chord: string, platform: Platform): string {
  const parts = chord.split('+');
  if (platform === 'mac') return parts.map((p) => MAC_SYMBOLS[p] ?? p).join('');
  return parts.map((p) => (p === 'Meta' ? 'Win' : p)).join('+');
}
