// TODO(phase 3): debugger. NOT IMPLEMENTED.
//
// Sketch:
//   - Speak the Debug Adapter Protocol (DAP), the same protocol VS Code uses, so existing
//     adapters for Python, Node, C#, and C/C++ can be reused instead of writing one per language.
//   - Native side: spawn and talk to adapter processes from src-tauri.
//   - UI: breakpoint gutter in the editor (Monaco glyph margin), a call stack, variables, and
//     debug console panel, plus launch configurations in a JSON file in the same config style.
//   - Depends on the terminal and plugin work: adapters are best delivered as plugins.

export interface Breakpoint {
  path: string;
  line: number;
}

// TODO: DebugSession, launch configuration loader (src/debug/launch.ts), breakpoint store
