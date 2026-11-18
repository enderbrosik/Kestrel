// Themes feature: two built-in themes (light and dark), user themes from the
// config folder, automatic switching with the OS, and a manual override.

import { registerCommand } from '../core/commands';
import type { ConfigStore } from '../config/store';
import { reportError } from '../ui/status';
import darkJson from './builtin/dark.json';
import lightJson from './builtin/light.json';
import { nextMode, parseTheme, themeTemplate, type Theme, type ThemeMode, type ThemeType } from './loader';
import { ThemeManager } from './manager';

export { ThemeManager } from './manager';
export type { ThemeState } from './manager';

export const THEMES_DIR = 'themes';

function loadBuiltins(): Record<ThemeType, Theme> {
  const light = parseTheme(JSON.stringify(lightJson), null, 'builtin', 'built-in light theme');
  const dark = parseTheme(JSON.stringify(darkJson), null, 'builtin', 'built-in dark theme');
  if (!light.theme || !dark.theme) {
    throw new Error(`Built-in themes are invalid: ${[...light.errors, ...dark.errors].join('; ')}`);
  }
  return { light: light.theme, dark: dark.theme };
}

/** Create the manager with the built-in themes and apply it immediately, before the UI renders. */
export function createThemeManager(): ThemeManager {
  const builtins = loadBuiltins();
  return new ThemeManager([builtins.light, builtins.dark]);
}

/** Read every themes/*.json file. Bad files are skipped and reported. */
export async function loadUserThemes(store: ConfigStore, manager: ThemeManager): Promise<void> {
  const builtins = { light: manager.list('light').find((t) => t.source === 'builtin')!, dark: manager.list('dark').find((t) => t.source === 'builtin')! };
  const themes: Theme[] = [];
  const problems: string[] = [];
  let files: string[] = [];
  try {
    files = (await store.list(THEMES_DIR)).filter((f) => f.endsWith('.json'));
  } catch (err) {
    reportError('Cannot list user themes', err);
  }
  for (const file of files) {
    const text = await store.read(`${THEMES_DIR}/${file}`);
    if (text === null) continue;
    const { theme, errors } = parseTheme(text, builtins, 'user', `themes/${file}`);
    problems.push(...errors);
    if (theme) themes.push(theme);
  }
  manager.setUserThemes(themes);
  if (problems.length > 0) {
    console.warn('Theme problems:\n' + problems.join('\n'));
    reportError(`Themes: ${problems.length} problem${problems.length > 1 ? 's' : ''}. ${problems[0]}`);
  }
}

export interface ThemesHandle {
  /** Re-read user themes. Called after the user saves a theme file. */
  reload(): Promise<void>;
  /** True if a saved file is one of the user's theme files. */
  isThemeFile(path: string): boolean;
}

export async function initThemes(deps: {
  manager: ThemeManager;
  store: ConfigStore;
  openFile(path: string): Promise<void>;
  /** Persist the color mode (the app saves it to settings.json, which then updates the manager). */
  setMode(mode: ThemeMode): void;
}): Promise<ThemesHandle> {
  const { manager, store } = deps;

  registerCommand('theme.cycleMode', () => deps.setMode(nextMode(manager.state.mode)));
  registerCommand('theme.setMode', (mode) => {
    if (mode === 'auto' || mode === 'light' || mode === 'dark') deps.setMode(mode);
  });
  registerCommand('theme.newFromCurrent', async () => {
    const files = new Set(await store.list(THEMES_DIR));
    let n = 1;
    while (files.has(`my-theme-${n}.json`) || manager.list().some((t) => t.id === `my-theme-${n}`)) n++;
    const { theme } = manager.state;
    const name = `my-theme-${n}`;
    await store.write(`${THEMES_DIR}/${name}.json`, themeTemplate(theme, name, `My Theme ${n}`));
    await deps.openFile(await store.path(`${THEMES_DIR}/${name}.json`));
  });

  // Path prefix of the themes folder, taken from a sample file path.
  const sample = await store.path(`${THEMES_DIR}/x.json`);
  const prefix = sample.slice(0, sample.length - 'x.json'.length);

  await loadUserThemes(store, manager);
  return {
    reload: () => loadUserThemes(store, manager),
    isThemeFile: (path) => path.startsWith(prefix) && path.endsWith('.json'),
  };
}
