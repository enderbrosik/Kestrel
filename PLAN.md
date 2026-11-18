# Kestrel: plan

Kestrel is an open-source code editor meant to replace VS Code for everyday work. It is built on Monaco (the editor component from VS Code) in TypeScript with Vite, and ships as a Tauri 2 desktop app and as a web app from the same code.

"Kestrel" is a placeholder name. The bundle identifier `app.pocketlantern.kesterel` was set by Aaron.

## Phases

### Phase 0: scaffold (done)

Vite + strict TypeScript, a Tauri 2 shell, icons, MIT license, README.

### Phase 1: a usable core (done)

One commit per item.

| # | Item | Where |
| --- | --- | --- |
| 1 | Open a folder; explorer tree; create, rename, delete, move | `src/workspace`, `src/platform`, `src-tauri/src/fs.rs` |
| 2 | Tabs, Monaco, save, unsaved markers | `src/editor` |
| 3 | Python, TypeScript, JavaScript, C, C#, JSON highlighting and basic support | `src/languages` |
| 4 | Keybindings in a user-editable JSON file, custom default scheme | `src/keybindings`, `src/config` |
| 5 | JSON themes, one light and one dark, follow the OS, manual override | `src/themes` |
| 6 | Settings in JSON plus a settings screen that edits the same file | `src/settings` |
| 7 | Startup screen: recent folders and a blank slate | `src/startup` |

Not part of Phase 1, left as stubs in `src/future/`: plugin system, terminal, git, debugger, AI.

### Phase 2: daily-driver features (proposed)

Roughly in this order, because each unlocks the next:

1. Make every editing shortcut remappable (see "Known gaps"), plus a command palette and quick open (files by name).
2. File watching, so changes made outside Kestrel show up, and auto-save.
3. Search in files and replace; find in the explorer.
4. Language servers (LSP) for completion, diagnostics, go to definition, rename. Monaco has no LSP built in.
5. Integrated terminal (desktop only).
6. Git: status in the explorer, a changes panel, diff view, commit.
7. ~~Plugin system v1~~ Deferred: Aaron said "not yet" on the compatibility question (see Decisions from Aaron). Do not start it until that is decided.

### Phase 3 and later (proposed)

macOS signing, notarization, and auto-update (Aaron has a Developer ID), debugger (via the Debug Adapter Protocol), AI features, split editors, multi-root workspaces, per-folder and per-language settings, settings sync, accessibility and localization passes.

## Decisions made

**Stack**
- Monaco is loaded lazily and with a curated feature list instead of the full `editor.main` (`src/editor/monaco.ts`). App code is about 55 kB (19 kB gzipped); Monaco is about 3.1 MB (800 kB gzipped) and only loads when the first file opens, so the startup screen is instant. The bare Monaco API alone is 2.7 MB, so curation saves little; Monaco's size is mostly fixed.
- No UI framework. Plain TypeScript plus a 30-line `h()` DOM helper (`src/core/dom.ts`). Runtime dependencies are only `monaco-editor`, `@tauri-apps/api`, and `@tauri-apps/plugin-dialog`. Dev: Vite, TypeScript, Vitest, Tauri CLI.
- `vitest` is pinned to 3.x. Vitest 4 triggered an npm peer-dependency resolver crash (`Cannot read properties of null (reading 'edgesOut')`) with npm 10.9.
- Desktop file access uses small custom Rust commands (`fs.rs`, `config.rs`) instead of the Tauri fs plugin, to avoid an extra dependency and permission surface. Only the dialog plugin is used (folder picker, Save As).
- Strict CSP in `tauri.conf.json` (own scripts only; inline styles allowed because Monaco injects them).

**One code base, two platforms**
- All OS access goes through `FileSystemBackend` (`src/platform/fs.ts`). Desktop uses Rust commands; the web build uses the File System Access API (Chromium browsers: Chrome, Edge). Firefox and Safari cannot open folders; the app says so.
- Config files live in the OS config folder on desktop and in localStorage on the web, behind one `ConfigStore`. The web build exposes them to the editor as `kestrel-config/<name>` so they can be edited like real files.

**Keybindings** (`src/keybindings`)
- Format: a JSON list of `{ "keys", "run", "when" }`. `"run": null` removes a default. Comments and trailing commas are allowed (JSONC).
- A custom scheme, not VS Code's. Mostly `Mod+Alt+<letter>` for app commands, `Mod+1` and `Mod+2` to move between explorer and editor, and plain keys (arrows, Enter, F2, Delete) inside the explorer. The full table is in `src/keybindings/README.md`.
- Letters and digits match the physical key (`event.code`), so keyboard layouts and macOS Option do not break bindings.
- Single chords only for now. `Mod+K Mod+S`-style sequences are not supported.
- Browsers reserve some combinations (for example Ctrl+W, Ctrl+N), so the defaults avoid them. Native Tauri menu accelerators on macOS (Cmd+W closes the window) are avoided the same way.

**Themes** (`src/themes`)
- JSON with three parts: `ui` (app colors as CSS variables), `editor.colors` (Monaco color ids), `editor.tokens` (syntax rules). Partial themes inherit from the built-in theme of the same type.
- Mode is `auto` (follows `prefers-color-scheme` live), `light`, or `dark`; `theme.light` and `theme.dark` pick which theme each mode uses, so user themes plug in. On desktop the native window frame follows a manual choice.

**Settings** (`src/settings`)
- Flat dotted keys (`"editor.fontSize": 15`). One schema drives validation, the commented default file, and the settings screen.
- The settings screen edits `settings.json` in place with targeted text edits, so user comments and formatting survive. It never rewrites the whole file.
- A bad value is reported and its default is used; a syntax error applies nothing and locks the screen until fixed.

**Languages** (`src/languages`)
- Monaco's built-in definitions for Python, TypeScript, JavaScript, C, and C#, loaded on first use. JSON uses a small custom tokenizer instead of Monaco's JSON language service, which would add its own web worker.
- "Basic support" means highlighting, brackets, comments, indentation, and word-based completion. No language intelligence yet.

**Startup and the blank slate** (`src/startup`)
- I read "blank-slate option" as: no folder, plus an empty `Untitled-1` buffer. Saving it opens Save As.
- The recent-folders list is `recent.json` (10 entries). On the web, folder handles are kept in IndexedDB and permission is requested again on click.

**Process**
- Every module has a short README. Unit tests cover the settings, keybinding, theme, and recent-folder loaders, plus language detection and the in-place JSON editor (104 tests, `npm test`).

## Verification status

Done here (Linux container):
- `npm run build` (typecheck + production bundle), `npm test` (104 tests), and `cargo test` in `src-tauri` (6 tests on the file commands) pass.
- `npm run dev` serves a working editor.
- `npm run tauri build` succeeds on Linux and produces `.deb` (3.8 MB), `.rpm`, and AppImage bundles. This validates the Tauri config, capabilities, icons, and Rust code.
- The release desktop app was launched under a virtual display (WebKitGTK, the same engine family macOS uses). Checked by hand: the startup screen renders, the config folder is read over IPC, "Blank slate" opens a Monaco buffer, typing works, the unsaved dot appears, Mod+Alt+T switches the theme, and that choice was written to `settings.json` in the OS config folder.
- The web build was driven in headless Chromium: explorer operations, editing and saving, dirty markers, all six languages, keybinding file editing and live reload, theme auto/override, settings screen and file, startup screen, recents after reload, blank slate and Save As. Those browser scripts are not in the repository (see Known gaps).

**Not verified: the macOS (Apple Silicon) build.** This container is Linux, so I could not run `npm run tauri build` on a Mac or confirm that only the Xcode Command Line Tools are needed. What is set up for it: `bundle.targets` is `all` (produces `.app` and `.dmg` on macOS), `minimumSystemVersion` is 11.0, `icon.icns` is generated, and the title bar leaves room for the traffic-light buttons. To check on a Mac:

```bash
xcode-select --install   # Command Line Tools only
rustup target add aarch64-apple-darwin x86_64-apple-darwin   # both are needed for a universal build
npm install
npm run tauri:build:mac   # universal; plain `npm run tauri build` builds for your own chip only
```

Things worth checking on first run on macOS: the folder picker and Save As dialogs, drag-and-drop move in the explorer (the Tauri window's file-drop handling can interfere with in-page drags; if so, set `dragDropEnabled: false` on the window), and that no default menu accelerator swallows a default keybinding.

## Known gaps

- **Monaco's own editing shortcuts are not remappable yet.** Multi-cursor, line move, find, and so on use Monaco's built-in keys (which happen to be VS Code's). `keybindings.json` controls Kestrel's commands only. Closing this gap is the first Phase 2 item.
- No file watching: edits made by other programs are not noticed, and the explorer needs Refresh.
- Text files are UTF-8 only; other files show an error instead of opening.
- Windows and Linux desktop builds compile but have not been tried by a person.
- No browser end-to-end tests in the repository. They would need Playwright as a dev dependency, which I did not add without your say.
- No window-close guard for unsaved changes on desktop (the web build has a `beforeunload` warning).
- Accessibility has had basic attention (roles, labels, focus handling) but no audit.

## Decisions from Aaron

Answers to the first round of questions:

1. **License: undecided, "maybe closed source".** This conflicts with the original brief ("open source from day one"), and the repository currently contains an MIT `LICENSE`. Nothing has been published, so it can be changed freely. Until Aaron decides, treat the license as unsettled. Two facts matter: code published under MIT stays MIT for everyone who received it, and a repository with no license file is all rights reserved by default. Name, bundle identifier (`app.pocketlantern.kesterel`), and contribution rules (DCO or CLA) are still open, and a CLA matters more if the project might go closed or dual-licensed.
2. **Repository: local only for now.** No remote, nothing pushed.
3. **Plugin compatibility: not decided yet.** The plugin system is deferred; the stubs in `src/future/plugins.ts` stay as they are.
4. **Web build: a demo.** It does not need parity with desktop. Do not add web fallbacks for terminal, git, or debugger. Keep it working for trying Kestrel in a browser, and stop there.
5. **Apple Developer ID: yes.** The macOS build is a universal binary (decided). Signing and notarization can be set up. When that work starts it needs the Team ID, a "Developer ID Application" certificate (kept in the keychain or CI secrets, never in the repo), and an app-specific password or API key for notarization. Add it to Phase 3 as "macOS signing, notarization, and auto-update".

## Open questions for Aaron

1. **Should Monaco's editing shortcuts be remappable now, and should the defaults differ from VS Code's?** Your brief says not to copy VS Code's bindings; today only the app-level ones are custom.
2. **Startup behavior.** Reopen the last folder automatically? Restore open tabs? Auto-save on focus loss? I chose none of these.
3. **macOS builds.** You have an Apple Developer ID, so signing is possible. Decided: universal binary (Apple Silicon and Intel). I set the minimum macOS to 11; say if Intel Macs on older systems matter.
4. **Telemetry and updates.** Proposal: no telemetry at all, and an opt-in update check later. Agree?
5. **Settings model.** Per-folder `.kestrel/settings.json` and per-language overrides are the usual next step. Do you want them in Phase 2?
6. **Multi-window and multi-root workspaces.** One folder per window, or several?
7. **Adding a Playwright suite** for browser end-to-end tests (one more dev dependency): yes or no?
