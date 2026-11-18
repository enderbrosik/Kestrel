# Kestrel

An open-source code editor built on [Monaco](https://microsoft.github.io/monaco-editor/) and [Tauri 2](https://tauri.app/). The goal is to fully replace VS Code for day-to-day work.

Status: early development (Phase 1). See [PLAN.md](PLAN.md).

## Requirements

- Node.js 20 or newer
- Rust (stable) for the desktop build
- macOS: Xcode Command Line Tools (`xcode-select --install`). Full Xcode is not required.

## Commands

```bash
npm install
npm run dev        # web app in the browser at http://localhost:1420
npm run tauri dev  # desktop app with hot reload
npm run tauri build
npm test           # unit tests
npm run build      # typecheck and production web bundle in dist/
```

## What is in Phase 1

Open a folder and work in the explorer (create, rename, delete, drag to move); tabs with unsaved-change markers and Cmd/Ctrl+S; highlighting for Python, TypeScript, JavaScript, C, C#, and JSON; keybindings, themes, and settings that are all plain JSON files you can edit; a startup screen with recent folders and a blank slate.

Open the config files from inside Kestrel: **Mod+Alt+K** (keybindings), **Mod+Alt+,** (settings JSON), **Mod+,** (settings screen). `Mod` is Cmd on macOS and Ctrl elsewhere.

## Layout

Each feature is a folder under `src/` with its own README:

| Folder | What it does |
| --- | --- |
| `workspace` | The explorer tree and file operations |
| `editor` | Tabs, Monaco, saving |
| `languages` | Language support |
| `keybindings` | Keyboard shortcuts |
| `themes` | Light and dark themes |
| `settings` | `settings.json` and the settings screen |
| `startup` | Startup screen and recent folders |
| `platform` | The only code that talks to the OS or the browser |
| `config` | Where user config files live; JSONC parsing |
| `core`, `ui` | Small shared helpers |
| `future` | TODO stubs: plugins, terminal, git, debugger, AI |

Rust code for the desktop app is in `src-tauri/src`. See [PLAN.md](PLAN.md) for phases, decisions, and open questions.

## Web build

`npm run dev` runs Kestrel in the browser. Opening folders needs a Chromium-based browser (Chrome, Edge). Config files are kept in the browser's localStorage.

## License

MIT. See [LICENSE](LICENSE).
