# workspace

The opened folder and everything that works on its files.

- `explorer.ts`: the sidebar tree. Create, rename, delete, and move files and folders. Drag a row onto a folder to move it. Right-click for the context menu.
  - Commands: `workspace.openFolder`, `explorer.newFile`, `explorer.newFolder`, `explorer.rename`, `explorer.delete`, `explorer.refresh`.
  - Events: `onFileOpen`, `onFileOperation` (create, rename, move, delete), `onRootChange`. The editor uses these to keep open tabs in sync with disk.
  - Disk access goes only through `platform/fs.ts`.

Not yet here (later steps): keyboard shortcuts for explorer commands (added with keybindings), file watching for changes made outside Kestrel (use Refresh for now), and the recent-folders list (startup screen).
