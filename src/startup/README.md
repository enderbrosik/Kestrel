# startup

The screen you see when Kestrel opens, and the recent-folders list behind it.

- `screen.ts`: the startup screen. **Open Folder…**, **Blank slate**, and the list of recent folders (click to open, × to remove). Show it again any time with `app.showStartScreen` (Mod+Alt+H) or by clicking "Kestrel" in the title bar. Escape dismisses it once something is open.
- `recent.ts`: parsing, adding, and removing recent folders. Pure, unit tested. Newest first, no duplicates, at most 10.
- `recent-folders.ts`: holds the list and writes `recent.json` in the config folder after every change.

## Blank slate

Starts with no folder and an empty `Untitled-1` buffer. Saving it asks where to put the file (a native Save As dialog on desktop; the browser's save picker on the web, in browsers that have one).

## Recent folders on the web

The browser cannot re-open a folder without permission, so the web build remembers each folder's handle in IndexedDB and asks for permission again when you click it.

Not yet here: reopening the last folder automatically at launch, pinned folders, and recent files.
