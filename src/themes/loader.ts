// Theme loading: validates theme JSON, fills gaps from a built-in theme, picks
// the active theme, and converts one to a Monaco theme. Pure functions with no
// DOM or Monaco imports, so they are unit tested directly.

import { parseJsonc } from '../config/jsonc';

export type ThemeType = 'light' | 'dark';
export type ThemeMode = 'auto' | 'light' | 'dark';

/** Colors for the app chrome. Each becomes a CSS variable, e.g. "sidebar-bg" -> --sidebar-bg. */
export const UI_KEYS = [
  'bg',
  'fg',
  'muted',
  'sidebar-bg',
  'titlebar-bg',
  'statusbar-bg',
  'statusbar-fg',
  'border',
  'hover',
  'selection',
  'accent',
  'danger',
  'input-bg',
] as const;
export type UiKey = (typeof UI_KEYS)[number];

export interface TokenRule {
  /** A Monaco token name such as "keyword" or "string.key.json". */
  token: string;
  foreground?: string;
  background?: string;
  fontStyle?: string;
}

export interface Theme {
  id: string;
  name: string;
  type: ThemeType;
  ui: Record<UiKey, string>;
  editor: {
    /** Monaco color ids, e.g. "editor.background". */
    colors: Record<string, string>;
    tokens: TokenRule[];
  };
  source: 'builtin' | 'user';
}

export interface ThemeChoice {
  mode: ThemeMode;
  /** Theme id used when the effective mode is light. */
  light: string;
  /** Theme id used when the effective mode is dark. */
  dark: string;
}

export const DEFAULT_CHOICE: ThemeChoice = { mode: 'auto', light: 'kestrel-light', dark: 'kestrel-dark' };

export interface ThemeParseResult {
  theme: Theme | null;
  errors: string[];
}

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const CSS_FUNCTION = /^(rgb|rgba|hsl|hsla)\([0-9.,%\s/-]+\)$/i;
const FONT_STYLES = new Set(['italic', 'bold', 'underline', 'strikethrough']);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isCssColor = (v: unknown): v is string => typeof v === 'string' && (HEX.test(v.trim()) || CSS_FUNCTION.test(v.trim()));
const isHexColor = (v: unknown): v is string => typeof v === 'string' && HEX.test(v.trim());

function validFontStyle(v: unknown): v is string {
  return typeof v === 'string' && v.trim().split(/\s+/).every((part) => FONT_STYLES.has(part));
}

/**
 * Validate theme JSON text. With `base` (the built-in themes), missing colors
 * are filled from the built-in theme of the same type, and the theme's token
 * rules are added after the built-in rules so they take priority. With
 * `base = null` (used for the built-ins themselves) every UI color is required.
 * Bad values are skipped with an error message; the rest of the theme still loads.
 */
export function parseTheme(
  text: string,
  base: Record<ThemeType, Theme> | null,
  source: Theme['source'] = 'user',
  label = 'theme',
): ThemeParseResult {
  const errors: string[] = [];
  let raw: unknown;
  try {
    raw = parseJsonc(text);
  } catch (err) {
    return { theme: null, errors: [`${label}: ${err instanceof Error ? err.message : String(err)}`] };
  }
  if (!isObject(raw)) return { theme: null, errors: [`${label}: expected a JSON object`] };

  const { id, name, type } = raw;
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/i.test(id)) {
    errors.push(`${label}: "id" must be letters, digits, dots, dashes, or underscores`);
  }
  if (typeof name !== 'string' || name.trim() === '') errors.push(`${label}: "name" must be non-empty text`);
  if (type !== 'light' && type !== 'dark') errors.push(`${label}: "type" must be "light" or "dark"`);
  if (errors.length > 0) return { theme: null, errors };

  const themeType = type as ThemeType;
  const fallback = base?.[themeType];

  const ui = {} as Record<UiKey, string>;
  const rawUi = raw.ui;
  if (rawUi !== undefined && !isObject(rawUi)) errors.push(`${label}: "ui" must be an object`);
  const uiInput = isObject(rawUi) ? rawUi : {};
  for (const key of Object.keys(uiInput)) {
    if (!(UI_KEYS as readonly string[]).includes(key)) errors.push(`${label}: unknown ui color "${key}"`);
  }
  for (const key of UI_KEYS) {
    const value = uiInput[key];
    if (value !== undefined && isCssColor(value)) ui[key] = value.trim();
    else {
      if (value !== undefined) errors.push(`${label}: ui.${key} must be a color like "#1b1d23"`);
      else if (!fallback) errors.push(`${label}: missing ui.${key}`);
      if (fallback) ui[key] = fallback.ui[key];
    }
  }

  const colors: Record<string, string> = { ...(fallback?.editor.colors ?? {}) };
  const rawEditor = raw.editor;
  const editorInput = isObject(rawEditor) ? rawEditor : {};
  if (rawEditor !== undefined && !isObject(rawEditor)) errors.push(`${label}: "editor" must be an object`);
  if (editorInput.colors !== undefined && !isObject(editorInput.colors)) errors.push(`${label}: "editor.colors" must be an object`);
  for (const [key, value] of Object.entries(isObject(editorInput.colors) ? editorInput.colors : {})) {
    if (isHexColor(value)) colors[key] = value.trim();
    else errors.push(`${label}: editor.colors["${key}"] must be a hex color like "#1b1d23"`);
  }

  const tokens: TokenRule[] = [...(fallback?.editor.tokens ?? [])];
  if (editorInput.tokens !== undefined && !Array.isArray(editorInput.tokens)) errors.push(`${label}: "editor.tokens" must be a list`);
  (Array.isArray(editorInput.tokens) ? editorInput.tokens : []).forEach((rule: unknown, index: number) => {
    const where = `${label}: editor.tokens[${index}]`;
    if (!isObject(rule) || typeof rule.token !== 'string' || rule.token.trim() === '') {
      return void errors.push(`${where} needs a "token" name`);
    }
    for (const field of ['foreground', 'background'] as const) {
      const value = rule[field];
      if (value !== undefined && !(isHexColor(value) || (typeof value === 'string' && /^[0-9a-f]{3,8}$/i.test(value)))) {
        return void errors.push(`${where}: "${field}" must be a hex color`);
      }
    }
    if (rule.fontStyle !== undefined && !validFontStyle(rule.fontStyle)) {
      return void errors.push(`${where}: "fontStyle" may only use italic, bold, underline, strikethrough`);
    }
    tokens.push({
      token: rule.token.trim(),
      foreground: rule.foreground as string | undefined,
      background: rule.background as string | undefined,
      fontStyle: rule.fontStyle as string | undefined,
    });
  });

  return {
    theme: { id: id as string, name: (name as string).trim(), type: themeType, ui, editor: { colors, tokens }, source },
    errors,
  };
}

/** Which theme applies right now. Falls back to the built-in theme if the chosen id does not exist. */
export function resolveActiveTheme(
  themes: ReadonlyMap<string, Theme>,
  choice: ThemeChoice,
  systemDark: boolean,
): { theme: Theme; effectiveType: ThemeType } {
  const effectiveType: ThemeType = choice.mode === 'auto' ? (systemDark ? 'dark' : 'light') : choice.mode;
  const wanted = themes.get(effectiveType === 'dark' ? choice.dark : choice.light);
  const builtin = themes.get(DEFAULT_CHOICE[effectiveType]);
  const theme = wanted ?? builtin;
  if (!theme) throw new Error('Built-in themes are missing');
  return { theme, effectiveType };
}

/** The next mode when the user cycles: auto, then light, then dark, then back to auto. */
export function nextMode(mode: ThemeMode): ThemeMode {
  return mode === 'auto' ? 'light' : mode === 'light' ? 'dark' : 'auto';
}

export interface MonacoThemeData {
  base: 'vs' | 'vs-dark';
  inherit: boolean;
  rules: Array<{ token: string; foreground?: string; background?: string; fontStyle?: string }>;
  colors: Record<string, string>;
}

const stripHash = (c: string | undefined) => (c ? c.replace(/^#/, '') : undefined);

export function toMonacoTheme(theme: Theme): MonacoThemeData {
  return {
    base: theme.type === 'dark' ? 'vs-dark' : 'vs',
    inherit: true,
    rules: theme.editor.tokens.map((r) => ({
      token: r.token,
      foreground: stripHash(r.foreground),
      background: stripHash(r.background),
      fontStyle: r.fontStyle,
    })),
    colors: {
      'editor.background': theme.ui.bg,
      'editor.foreground': theme.ui.fg,
      ...theme.editor.colors,
    },
  };
}

/** Starting text for a new user theme, based on an existing one. */
export function themeTemplate(from: Theme, id: string, name: string): string {
  const header = [
    '// A Kestrel theme. Save this file to apply it; choose it with "theme.light" or "theme.dark" in settings.json.',
    '// Any color you leave out comes from the built-in theme of the same "type".',
    '// "ui" colors style the app. "editor.colors" are Monaco color ids. "editor.tokens" color syntax.',
  ].join('\n');
  const body = JSON.stringify({ id, name, type: from.type, ui: from.ui, editor: { colors: from.editor.colors, tokens: from.editor.tokens } }, null, 2);
  return `${header}\n${body}\n`;
}
