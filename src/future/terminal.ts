// TODO(phase 2): integrated terminal. NOT IMPLEMENTED.
//
// Sketch:
//   - Native side: a pseudo-terminal per tab in src-tauri (the `portable-pty` crate), exposed as
//     Tauri commands (terminal_open, terminal_write, terminal_resize, terminal_close) and an
//     event stream for output. Same pattern as src-tauri/src/fs.rs.
//   - UI side: a terminal emulator widget in a bottom panel (xterm.js is the usual choice).
//   - Web build: there is no local shell in a browser. Hide the panel, or connect to a remote
//     backend (open question in PLAN.md).
//   - Commands to add: terminal.toggle, terminal.new, terminal.kill, with default keybindings.
//   - Theme: add terminal colors to the theme format (loader.ts UI_KEYS or a "terminal" section).

export interface TerminalSession {
  id: number;
  cwd: string;
  // TODO: write(data: string): void; resize(cols: number, rows: number): void; dispose(): void;
}

// TODO: openTerminal(cwd: string): Promise<TerminalSession>
