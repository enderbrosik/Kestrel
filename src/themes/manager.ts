// Applies the active theme to the page and keeps it in sync with the OS
// light/dark setting (when mode is "auto") and with the user's choice.

import { Emitter } from '../core/events';
import { setWindowTheme } from '../platform/window-theme';
import {
  DEFAULT_CHOICE,
  UI_KEYS,
  resolveActiveTheme,
  type Theme,
  type ThemeChoice,
  type ThemeMode,
  type ThemeType,
} from './loader';

export interface ThemeState {
  theme: Theme;
  mode: ThemeMode;
  /** What is actually showing: "light" or "dark". Differs from mode when mode is "auto". */
  effectiveType: ThemeType;
}

export class ThemeManager {
  readonly onDidChange = new Emitter<ThemeState>();

  private readonly themes = new Map<string, Theme>();
  private choice: ThemeChoice = { ...DEFAULT_CHOICE };
  private readonly systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  private current: ThemeState;

  constructor(builtins: Theme[]) {
    for (const theme of builtins) this.themes.set(theme.id, theme);
    this.current = this.compute();
    this.systemDark.addEventListener('change', () => {
      if (this.choice.mode === 'auto') this.apply();
    });
    this.apply();
  }

  get state(): ThemeState {
    return this.current;
  }

  /** All known themes, optionally only one type (for pickers in settings). */
  list(type?: ThemeType): Theme[] {
    return [...this.themes.values()].filter((t) => !type || t.type === type);
  }

  /** Replace the user themes (built-ins are kept). */
  setUserThemes(themes: Theme[]): void {
    for (const [id, theme] of this.themes) if (theme.source === 'user') this.themes.delete(id);
    for (const theme of themes) {
      // A user theme may not replace a built-in id.
      if (!this.themes.has(theme.id)) this.themes.set(theme.id, theme);
    }
    this.apply();
  }

  setChoice(choice: Partial<ThemeChoice>): void {
    this.choice = { ...this.choice, ...choice };
    this.apply();
  }

  getChoice(): ThemeChoice {
    return { ...this.choice };
  }

  private compute(): ThemeState {
    const { theme, effectiveType } = resolveActiveTheme(this.themes, this.choice, this.systemDark.matches);
    return { theme, mode: this.choice.mode, effectiveType };
  }

  private apply(): void {
    this.current = this.compute();
    const { theme, mode, effectiveType } = this.current;
    const root = document.documentElement;
    for (const key of UI_KEYS) root.style.setProperty(`--${key}`, theme.ui[key]);
    root.style.colorScheme = effectiveType; // native scrollbars and form controls
    root.dataset.theme = theme.id;
    void setWindowTheme(mode === 'auto' ? null : mode);
    this.onDidChange.fire(this.current);
  }
}
