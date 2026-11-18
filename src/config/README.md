# config

Shared plumbing for user-editable configuration files.

- `store.ts`: `ConfigStore` reads and writes named config files. Desktop uses real files in the OS config folder (macOS: `~/Library/Application Support/dev.kestrel.editor/`). The web build uses localStorage and exposes the files to the editor as `kestrel-config/<name>`. `createMemoryConfigStore()` is for tests.
- `jsonc.ts`: parses JSON with `//` and `/* */` comments and trailing commas, so users can annotate their files.

Files currently stored here: `keybindings.json`, `settings.json`, `themes/*.json`, `recent.json`.
