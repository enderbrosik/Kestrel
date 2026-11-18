// TODO(phase 2): git integration. NOT IMPLEMENTED.
//
// Sketch:
//   - Native side: run the user's `git` binary from src-tauri (std::process::Command) and parse
//     porcelain output, or use the `git2` crate. Shelling out matches what users' git config,
//     hooks, and credentials expect; decide in PLAN.md.
//   - UI: status decorations in the explorer (modified, untracked), a changes panel, a diff view
//     (Monaco has a diff editor; it is not in the current curated bundle, see editor/monaco.ts),
//     stage/commit, branch indicator in the status bar.
//   - Needs file watching so decorations stay current (not built yet; the explorer only refreshes on demand).
//   - Web build: no git. Hide the feature.

export interface GitStatusEntry {
  path: string;
  state: 'modified' | 'added' | 'deleted' | 'untracked' | 'conflicted';
}

// TODO: gitStatus(root: string): Promise<GitStatusEntry[]>
