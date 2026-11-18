# keybindings

Keyboard shortcuts, defined in JSON and editable by the user. Kestrel's default scheme is its own (it does not copy VS Code).

- `default-keybindings.json`: the built-in scheme.
- `loader.ts`: merges the defaults with the user's `keybindings.json` (user wins). Pure, unit tested.
- `keys.ts`: parses `"Mod+Shift+O"` and turns key events into the same canonical form.
- `service.ts`: listens for key presses and runs the matching command.
- `context.ts`: works out where focus is, for `"when"`.
- `index.ts`: wires it together and adds the `keybindings.openFile` command (Mod+Alt+K), which creates the file with instructions on first use. Saving the file reloads it immediately.

## Format

```jsonc
[
  { "keys": "Mod+Alt+N", "run": "explorer.newFile" },
  { "keys": "F2", "run": "explorer.rename", "when": "explorer" },
  { "keys": "Mod+Alt+W", "run": null }   // removes the default for that key
]
```

- `Mod` is Cmd on macOS and Ctrl on Windows and Linux. Other modifiers: `Ctrl`, `Alt`, `Shift`, `Meta`.
- Letters and digits match the physical key, so layouts and Option-key characters on macOS do not matter.
- `when` is `explorer`, `editor`, or `input` (where focus is). A binding with `when` beats one without.
- Invalid entries are skipped and reported in the status bar; valid ones still load.
- Comments and trailing commas are allowed.

## Default scheme

| Keys | Command |
| --- | --- |
| Mod+S | `file.save` |
| Mod+Shift+O | `workspace.openFolder` |
| Mod+Alt+W | `tab.close` |
| Mod+Alt+U | `file.newUntitled` (new empty buffer) |
| Mod+Alt+H | `app.showStartScreen` |
| Mod+Alt+Right / Left | `tab.next` / `tab.previous` |
| Mod+1 / Mod+2 | `view.focusExplorer` / `view.focusEditor` |
| Mod+Alt+N / Mod+Alt+Shift+N | `explorer.newFile` / `explorer.newFolder` |
| Mod+Alt+R | `explorer.refresh` |
| Mod+, / Mod+Alt+, | `settings.open` (screen) / `settings.openFile` (JSON) |
| Mod+Alt+K | `keybindings.openFile` |
| Mod+Alt+T | `theme.cycleMode` (auto, light, dark) |
| Up, Down, Left, Right, Enter (explorer focused) | `explorer.selectPrevious`, `selectNext`, `collapse`, `expand`, `open` |
| F2, Delete, Mod+Backspace (explorer focused) | `explorer.rename`, `explorer.delete` |

Not yet supported: multi-step chords such as `Mod+K Mod+S`, and a command palette.
