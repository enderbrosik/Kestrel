# settings

User settings in `settings.json`, plus a settings screen that edits that same file.

- `schema.ts`: the list of every setting (key, type, default, range, description). Validation, the default file template, and the settings screen all come from this one list. To add a setting, add an entry here and read it where it is used.
- `loader.ts`: parses `settings.json`, checks each value, fills in defaults. A bad value is reported and its default used; the rest of the file still applies. Pure, unit tested.
- `service.ts`: holds the current settings and notifies listeners. `set` and `reset` change one entry in the file (see `config/jsonc-edit.ts`), so your comments and formatting are kept.
- `screen.ts`: the settings form (`settings.open`, Mod+,). Changes save immediately. A blue bar marks settings you have changed, and Reset removes the entry so the default applies.
- `index.ts`: wires it up and adds `settings.open` and `settings.openFile` (Mod+Alt+,), which creates `settings.json` from a commented template the first time.

Saving `settings.json` in the editor applies it immediately. If the file has a syntax error, nothing from it is applied, the status bar and settings screen say so, and the screen will not write until it is fixed.

## Format

Flat keys, comments allowed:

```jsonc
{
  "theme.mode": "auto",      // auto | light | dark
  "editor.fontSize": 15,
  "editor.tabSize": 0        // 0 = the language's usual indentation
}
```

| Key | Default | |
| --- | --- | --- |
| `theme.mode` | `auto` | `auto` follows the OS; `light` or `dark` overrides it |
| `theme.light`, `theme.dark` | `kestrel-light`, `kestrel-dark` | theme id for each mode |
| `editor.fontSize` | `14` | 8 to 40 |
| `editor.fontFamily` | `""` | CSS font list; empty = default monospace |
| `editor.tabSize` | `0` | 0 to 16 |
| `editor.insertSpaces` | `true` | |
| `editor.detectIndentation` | `true` | use a file's own indentation when it opens |
| `editor.wordWrap` | `off` | `off` or `on` |
| `editor.lineNumbers` | `on` | `on`, `off`, `relative` |
| `editor.minimap` | `false` | |

Location: the OS config folder on desktop (macOS: `~/Library/Application Support/app.pocketlantern.kestrel/settings.json`), localStorage on the web build.

Not yet here: per-folder settings, per-language overrides, and a search box in the screen.
