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

## License

MIT. See [LICENSE](LICENSE).
