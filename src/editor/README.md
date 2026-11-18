# editor

Editing: tabs, the Monaco editor, and saving.

- `editor-pane.ts`: owns the open documents. One Monaco text model per file keeps its own undo history and scroll/cursor position. A tab shows a dot while its text differs from what is on disk (it goes clean again if you undo back to the saved text).
  - Commands: `file.save`, `file.newUntitled`, `tab.close`, `tab.next`, `tab.previous`.
  - Untitled buffers (`Untitled-1`, ...) have no path until their first save, which opens Save As.
  - Listens to explorer events so renamed, moved, and deleted files update their tabs.
  - Closing a tab with unsaved changes asks first.
- `tabs.ts`: draws the tab bar. Pure view code.
- `monaco.ts`: loads Monaco on demand with a curated list of editor features (not the full bundle) and sets up the web worker. Add a feature by adding one import line.

Not yet here: a language picker for untitled buffers (they are plain text until saved with an extension), split editors, and file watching (a file changed on disk by another program is not noticed).
