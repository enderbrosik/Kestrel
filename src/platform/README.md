# platform

Everything that talks to the operating system or the browser. Feature code imports only `fs.ts` and never the Tauri or browser APIs directly.

- `fs.ts`: the `FileSystemBackend` contract, plus `getFileSystem()`, which picks the backend for the current runtime.
- `desktop-fs.ts`: Tauri backend. Calls the Rust commands in `src-tauri/src/fs.rs`.
- `web-fs.ts`: browser backend on the File System Access API (Chromium browsers). Folders stay open only for the current page session.

Paths are opaque strings owned by the backend. Build child paths only through backend results, never by string concatenation in feature code.
