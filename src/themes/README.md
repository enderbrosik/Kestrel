# themes

Colors for the whole app, defined in JSON. One light and one dark theme are built in.

- `builtin/light.json`, `builtin/dark.json`: Kestrel Light and Kestrel Dark.
- `loader.ts`: validates theme JSON, fills gaps from the built-in theme of the same type, picks the active theme, and converts a theme to Monaco's format. Pure, unit tested.
- `manager.ts`: applies the active theme (CSS variables, native scrollbars, and on desktop the window frame) and follows the OS light/dark setting.
- `index.ts`: loads the built-ins and `themes/*.json` from the config folder, and adds the commands below.

## Switching

`mode` is `auto` (follow the OS), `light`, or `dark`. The status bar button, or `theme.cycleMode` (Mod+Alt+T), cycles through them. Commands: `theme.cycleMode`, `theme.setMode`, `theme.newFromCurrent`.

The choice is stored in `settings.json` as `theme.mode`, `theme.light`, and `theme.dark` (the last two pick which theme is used for each mode, including your own).

## Writing a theme

Run `theme.newFromCurrent`: it copies the current theme into `themes/my-theme-N.json` in the config folder and opens it. Save to apply; it reloads immediately.

```jsonc
{
  "id": "my-theme-1",            // letters, digits, dot, dash, underscore
  "name": "My Theme 1",
  "type": "dark",                // "light" or "dark"; picks the Monaco base and the fallback theme
  "ui": { "bg": "#101010" },     // app colors; see UI_KEYS in loader.ts (bg, fg, muted, sidebar-bg, ...)
  "editor": {
    "colors": { "editor.background": "#101010" },   // Monaco color ids, hex only
    "tokens": [{ "token": "comment", "foreground": "#808080", "fontStyle": "italic" }]
  }
}
```

Anything omitted comes from the built-in theme of the same type, and your token rules apply after the built-in ones. Invalid values are skipped and reported in the status bar.
