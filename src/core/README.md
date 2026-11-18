# core

Small shared utilities with no UI and no platform code.

- `events.ts`: `Emitter<T>`, a typed event channel used so features (explorer, editor, settings) can react to each other without importing one another.
- `commands.ts`: a registry of named commands. Menus, buttons, and keybindings all call a command by id.
- `dom.ts`: a tiny `h()` helper for building DOM without a framework.
