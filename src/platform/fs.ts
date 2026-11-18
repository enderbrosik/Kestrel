// The file system contract every platform implements. Features use only this
// interface, never Tauri or the browser APIs directly.
//
// Paths are opaque strings owned by the backend: the desktop backend uses real
// OS paths, the web backend uses "<folder name>/<relative path>". Callers must
// not build paths themselves; they take them from listDir() results or from the
// return values of create/rename/move.

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
}

export interface FileSystemBackend {
  /** 'desktop' (Tauri) or 'web' (File System Access API). */
  readonly kind: 'desktop' | 'web';
  /** Show a folder picker. Resolves to the new root path, or null if cancelled. */
  pickFolder(): Promise<string | null>;
  /**
   * Open a folder opened before (from the recent list). Resolves to its root path,
   * which may differ from `path` on the web. Throws if it can no longer be opened.
   * Call from a click handler: the web build may need to ask for permission.
   */
  reopenFolder(path: string): Promise<string>;
  /** Show a "save as" dialog and write the content. Resolves to the new file's path, or null if cancelled. */
  saveAs(suggestedName: string, content: string): Promise<string | null>;
  /** Forget a remembered folder (web only needs this; desktop does nothing). */
  forgetFolder(path: string): Promise<void>;
  listDir(path: string): Promise<FileEntry[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  /** Create an empty file. Resolves to the new file's path. */
  createFile(dir: string, name: string): Promise<string>;
  createDir(dir: string, name: string): Promise<string>;
  /** Rename in place. Resolves to the new path. */
  rename(path: string, newName: string): Promise<string>;
  /** Move into another folder. Resolves to the new path. */
  move(path: string, destDir: string): Promise<string>;
  /** Delete a file or a folder (recursively). */
  remove(path: string): Promise<void>;
}

/** Last path segment, accepting both "/" and "\" separators. */
export function baseName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

let backendPromise: Promise<FileSystemBackend> | null = null;

/** The backend for the current runtime. Loaded lazily so the web build never pulls in Tauri code. */
export function getFileSystem(): Promise<FileSystemBackend> {
  backendPromise ??= isTauriRuntime()
    ? import('./desktop-fs').then((m) => m.desktopFileSystem)
    : import('./web-fs').then((m) => m.webFileSystem);
  return backendPromise;
}
