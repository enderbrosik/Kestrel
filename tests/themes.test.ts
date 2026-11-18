import { describe, expect, it } from 'vitest';
import darkJson from '../src/themes/builtin/dark.json';
import lightJson from '../src/themes/builtin/light.json';
import {
  DEFAULT_CHOICE,
  UI_KEYS,
  nextMode,
  parseTheme,
  resolveActiveTheme,
  themeTemplate,
  toMonacoTheme,
  type Theme,
} from '../src/themes/loader';

const light = parseTheme(JSON.stringify(lightJson), null, 'builtin').theme!;
const dark = parseTheme(JSON.stringify(darkJson), null, 'builtin').theme!;
const base = { light, dark };

describe('built-in themes', () => {
  it('load with no errors and define every UI color', () => {
    for (const json of [lightJson, darkJson]) {
      const { theme, errors } = parseTheme(JSON.stringify(json), null, 'builtin');
      expect(errors).toEqual([]);
      expect(theme).not.toBeNull();
      for (const key of UI_KEYS) expect(theme!.ui[key]).toMatch(/^#/);
    }
  });

  it('are one light and one dark', () => {
    expect(light.type).toBe('light');
    expect(dark.type).toBe('dark');
    expect(light.id).toBe(DEFAULT_CHOICE.light);
    expect(dark.id).toBe(DEFAULT_CHOICE.dark);
  });
});

describe('parseTheme', () => {
  it('fills missing colors and token rules from the built-in theme of the same type', () => {
    const { theme, errors } = parseTheme(
      `{ "id": "mine", "name": "Mine", "type": "dark", "ui": { "bg": "#000000" } }`,
      base,
    );
    expect(errors).toEqual([]);
    expect(theme!.ui.bg).toBe('#000000');
    expect(theme!.ui.fg).toBe(dark.ui.fg);
    expect(theme!.editor.tokens.length).toBe(dark.editor.tokens.length);
    expect(theme!.source).toBe('user');
  });

  it('puts user token rules after the built-in rules so they take priority', () => {
    const { theme } = parseTheme(
      `{ "id": "mine", "name": "Mine", "type": "light",
         "editor": { "tokens": [{ "token": "comment", "foreground": "#ff0000" }] } }`,
      base,
    );
    const comments = theme!.editor.tokens.filter((r) => r.token === 'comment');
    expect(comments.at(-1)!.foreground).toBe('#ff0000');
    expect(comments.length).toBe(2);
  });

  it('allows comments and trailing commas', () => {
    const { theme, errors } = parseTheme(
      `// my theme
       { "id": "c", "name": "C", "type": "light", /* ui */ "ui": { "bg": "#fff", }, }`,
      base,
    );
    expect(errors).toEqual([]);
    expect(theme!.ui.bg).toBe('#fff');
  });

  it('rejects a theme without a valid id, name, or type', () => {
    expect(parseTheme(`{ "name": "x", "type": "dark" }`, base).theme).toBeNull();
    expect(parseTheme(`{ "id": "bad id!", "name": "x", "type": "dark" }`, base).theme).toBeNull();
    expect(parseTheme(`{ "id": "x", "name": "", "type": "dark" }`, base).theme).toBeNull();
    const wrongType = parseTheme(`{ "id": "x", "name": "x", "type": "sepia" }`, base);
    expect(wrongType.theme).toBeNull();
    expect(wrongType.errors[0]).toContain('"type"');
  });

  it('rejects malformed JSON and non-objects', () => {
    expect(parseTheme('{ "id": ', base, 'user', 'themes/a.json').errors[0]).toContain('themes/a.json');
    expect(parseTheme('[1,2]', base).theme).toBeNull();
    expect(parseTheme('', base).theme).toBeNull();
  });

  it('skips bad values but keeps the rest of the theme', () => {
    const { theme, errors } = parseTheme(
      `{ "id": "t", "name": "T", "type": "dark",
         "ui": { "bg": "not-a-color", "fg": "#ffffff", "wat": "#000000" },
         "editor": {
           "colors": { "editor.background": "red", "editor.foreground": "#eeeeee" },
           "tokens": [ { "foreground": "#fff" }, { "token": "x", "fontStyle": "sparkly" }, { "token": "keyword", "foreground": "#abcdef", "fontStyle": "bold italic" } ]
         } }`,
      base,
    );
    expect(theme).not.toBeNull();
    expect(errors.length).toBe(5);
    expect(theme!.ui.bg).toBe(dark.ui.bg); // bad value fell back
    expect(theme!.ui.fg).toBe('#ffffff'); // good value kept
    expect(theme!.editor.colors['editor.background']).toBe(dark.editor.colors['editor.background']);
    expect(theme!.editor.colors['editor.foreground']).toBe('#eeeeee');
    expect(theme!.editor.tokens.at(-1)).toMatchObject({ token: 'keyword', fontStyle: 'bold italic' });
  });

  it('accepts rgb() and hsl() for UI colors but only hex for Monaco colors', () => {
    const ok = parseTheme(`{ "id": "t", "name": "T", "type": "light", "ui": { "bg": "rgb(10, 20, 30)", "fg": "hsl(210 20% 10%)" } }`, base);
    expect(ok.errors).toEqual([]);
    const bad = parseTheme(`{ "id": "t", "name": "T", "type": "light", "editor": { "colors": { "editor.background": "rgb(1,2,3)" } } }`, base);
    expect(bad.errors.length).toBe(1);
  });

  it('requires every UI color when there is no base theme', () => {
    const { errors } = parseTheme(`{ "id": "t", "name": "T", "type": "light", "ui": { "bg": "#fff" } }`, null);
    expect(errors.length).toBe(UI_KEYS.length - 1);
  });
});

describe('resolveActiveTheme', () => {
  const themes = new Map<string, Theme>([
    [light.id, light],
    [dark.id, dark],
  ]);
  const custom: Theme = { ...dark, id: 'custom-dark', name: 'Custom', source: 'user' };
  themes.set(custom.id, custom);

  it('follows the system in auto mode', () => {
    expect(resolveActiveTheme(themes, DEFAULT_CHOICE, true)).toMatchObject({ effectiveType: 'dark', theme: dark });
    expect(resolveActiveTheme(themes, DEFAULT_CHOICE, false)).toMatchObject({ effectiveType: 'light', theme: light });
  });

  it('lets a manual mode override the system', () => {
    expect(resolveActiveTheme(themes, { ...DEFAULT_CHOICE, mode: 'light' }, true).theme).toBe(light);
    expect(resolveActiveTheme(themes, { ...DEFAULT_CHOICE, mode: 'dark' }, false).theme).toBe(dark);
  });

  it('uses the chosen theme id for each slot', () => {
    expect(resolveActiveTheme(themes, { ...DEFAULT_CHOICE, dark: 'custom-dark' }, true).theme).toBe(custom);
  });

  it('falls back to the built-in theme when the chosen id is missing', () => {
    expect(resolveActiveTheme(themes, { ...DEFAULT_CHOICE, dark: 'deleted-theme' }, true).theme).toBe(dark);
  });
});

describe('nextMode', () => {
  it('cycles auto, light, dark', () => {
    expect(nextMode('auto')).toBe('light');
    expect(nextMode('light')).toBe('dark');
    expect(nextMode('dark')).toBe('auto');
  });
});

describe('toMonacoTheme', () => {
  it('maps type to a Monaco base and strips # from token colors', () => {
    const m = toMonacoTheme(dark);
    expect(m.base).toBe('vs-dark');
    expect(toMonacoTheme(light).base).toBe('vs');
    expect(m.rules.find((r) => r.token === 'keyword')!.foreground).toBe('c792ea');
    expect(m.colors['editor.background']).toBe(dark.ui.bg);
  });
});

describe('themeTemplate', () => {
  it('produces a theme file that loads back with no errors', () => {
    const text = themeTemplate(dark, 'my-theme-1', 'My Theme 1');
    const { theme, errors } = parseTheme(text, base);
    expect(errors).toEqual([]);
    expect(theme).toMatchObject({ id: 'my-theme-1', name: 'My Theme 1', type: 'dark' });
  });
});
