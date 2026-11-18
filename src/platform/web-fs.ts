// Web file system backend built on the File System Access API (Chromium-based
// browsers). Paths are "<root folder name>/<relative path>". Opened folders are
// remembered in IndexedDB (web-handles.ts) so the recent list can reopen them,
// after the user grants permission again.

import type { FileEntry, FileSystemBackend } from './fs';
import { isWebConfigPath, readWebConfig, webConfigName, writeWebConfig } from './web-config';
import { deleteFolderHandle, loadFolderHandle, saveFolderHandle } from './web-handles';

type AnyDirHandle = FileSystemDirectoryHandle;
type AnyFileHandle = FileSystemFileHandle;
type MovableHandle = (AnyDirHandle | AnyFileHandle) & {
  move(destination: AnyDirHandle | string): Promise<void>;
};
// Not yet in TypeScript's DOM typings.
type IterableDirHandle = AnyDirHandle & {
  values(): AsyncIterableIterator<AnyDirHandle | AnyFileHandle>;
};
type PickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<AnyDirHandle>;
  showSaveFilePicker?: (options?: { suggestedName?: string }) => Promise<AnyFileHandle>;
};
type PermissionHandle = AnyDirHandle & {
  queryPermission(descriptor: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: 'readwrite' }): Promise<PermissionState>;
  isSameEntry(other: AnyDirHandle): Promise<boolean>;
};

const roots = new Map<string, AnyDirHandle>();

/** Files created through "save as": the browser gives us the file handle itself, not a folder path. */
const SAVED_FILE_ROOT = 'kestrel-file';
const savedFiles = new Map<string, AnyFileHandle>();
let savedFileCounter = 0;

/** Register an opened folder under a unique name. The same folder opened again keeps its name. */
async function registerRoot(handle: AnyDirHandle, preferred: string): Promise<string> {
  for (let n = 1; ; n++) {
    const key = n === 1 ? preferred : `${preferred} (${n})`;
    const existing = roots.get(key) as PermissionHandle | undefined;
    if (!existing || (await existing.isSameEntry(handle))) {
      roots.set(key, handle);
      return key;
    }
  }
}

function splitPath(path: string): { root: string; rest: string[] } {
  const [root, ...rest] = path.split('/').filter(Boolean);
  if (!root) throw new Error('Invalid path');
  return { root, rest };
}

function rootFor(path: string): AnyDirHandle {
  const { root } = splitPath(path);
  const handle = roots.get(root);
  if (!handle) throw new Error(`Folder "${root}" is no longer open`);
  return handle;
}

async function dirAt(path: string): Promise<AnyDirHandle> {
  const { rest } = splitPath(path);
  let dir = rootFor(path);
  for (const segment of rest) {
    dir = await dir.getDirectoryHandle(segment);
  }
  return dir;
}

async function entryAt(path: string): Promise<AnyDirHandle | AnyFileHandle> {
  const { rest } = splitPath(path);
  if (rest.length === 0) return rootFor(path);
  const parent = await dirAt(parentPath(path));
  const name = rest[rest.length - 1]!;
  try {
    return await parent.getDirectoryHandle(name);
  } catch {
    return await parent.getFileHandle(name);
  }
}

function parentPath(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx > 0 ? path.slice(0, idx) : path;
}

async function exists(dir: AnyDirHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    try {
      await dir.getDirectoryHandle(name);
      return true;
    } catch {
      return false;
    }
  }
}

function validName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed === '.' || trimmed === '..' || /[\\/]/.test(trimmed)) {
    throw new Error(`Invalid name: ${name}`);
  }
  return trimmed;
}

export const webFileSystem: FileSystemBackend = {
  kind: 'web',

  async pickFolder() {
    const picker = (window as PickerWindow).showDirectoryPicker;
    if (!picker) throw new Error('This browser cannot open folders. Use Chrome, Edge, or the desktop app.');
    let handle: AnyDirHandle;
    try {
      handle = await picker({ mode: 'readwrite' });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null;
      throw err;
    }
    const key = await registerRoot(handle, handle.name);
    await saveFolderHandle(key, handle);
    return key;
  },

  async reopenFolder(path) {
    const handle = (roots.get(path) ?? (await loadFolderHandle(path))) as PermissionHandle | null;
    if (!handle) throw new Error(`"${path}" cannot be reopened from the browser. Use Open Folder.`);
    if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      if ((await handle.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('Permission to open the folder was denied');
    }
    const key = await registerRoot(handle, path);
    await saveFolderHandle(key, handle);
    return key;
  },

  async saveAs(suggestedName, content) {
    const picker = (window as PickerWindow).showSaveFilePicker;
    if (!picker) throw new Error('This browser cannot save new files. Open a folder and create the file there.');
    let handle: AnyFileHandle;
    try {
      handle = await picker({ suggestedName });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null;
      throw err;
    }
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    const path = `${SAVED_FILE_ROOT}/${++savedFileCounter}/${handle.name}`;
    savedFiles.set(path, handle);
    return path;
  },

  async forgetFolder(path) {
    await deleteFolderHandle(path);
  },

  async listDir(path) {
    const dir = await dirAt(path);
    const out: FileEntry[] = [];
    for await (const handle of (dir as IterableDirHandle).values()) {
      out.push({
        name: handle.name,
        path: `${path}/${handle.name}`,
        isDir: handle.kind === 'directory',
      });
    }
    out.sort((a, b) =>
      a.isDir === b.isDir ? a.name.toLowerCase().localeCompare(b.name.toLowerCase()) : a.isDir ? -1 : 1,
    );
    return out;
  },

  async readFile(path) {
    if (isWebConfigPath(path)) return readWebConfig(webConfigName(path)) ?? '';
    const { rest } = splitPath(path);
    if (rest.length === 0) throw new Error('Not a file');
    const file = savedFiles.get(path) ?? (await (await dirAt(parentPath(path))).getFileHandle(rest[rest.length - 1]!));
    const bytes = new Uint8Array(await (await file.getFile()).arrayBuffer());
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new Error(`${path} is not a UTF-8 text file`);
    }
  },

  async writeFile(path, content) {
    if (isWebConfigPath(path)) return writeWebConfig(webConfigName(path), content);
    const { rest } = splitPath(path);
    const file = savedFiles.get(path) ?? (await (await dirAt(parentPath(path))).getFileHandle(rest[rest.length - 1]!, { create: true }));
    const writable = await file.createWritable();
    await writable.write(content);
    await writable.close();
  },

  async createFile(dir, name) {
    const n = validName(name);
    const parent = await dirAt(dir);
    if (await exists(parent, n)) throw new Error(`${n} already exists`);
    await parent.getFileHandle(n, { create: true });
    return `${dir}/${n}`;
  },

  async createDir(dir, name) {
    const n = validName(name);
    const parent = await dirAt(dir);
    if (await exists(parent, n)) throw new Error(`${n} already exists`);
    await parent.getDirectoryHandle(n, { create: true });
    return `${dir}/${n}`;
  },

  async rename(path, newName) {
    const n = validName(newName);
    const { rest } = splitPath(path);
    if (rest.length === 0) throw new Error('Cannot rename an opened folder here');
    const parent = await dirAt(parentPath(path));
    if (n !== rest[rest.length - 1] && (await exists(parent, n))) throw new Error(`${n} already exists`);
    await (await entryAt(path) as MovableHandle).move(n);
    return `${parentPath(path)}/${n}`;
  },

  async move(path, destDir) {
    const { rest } = splitPath(path);
    if (rest.length === 0) throw new Error('Cannot move an opened folder');
    const name = rest[rest.length - 1]!;
    const dest = await dirAt(destDir);
    if (await exists(dest, name)) throw new Error(`${name} already exists there`);
    if (destDir === path || destDir.startsWith(`${path}/`)) {
      throw new Error('A folder cannot be moved into itself');
    }
    await (await entryAt(path) as MovableHandle).move(dest);
    return `${destDir}/${name}`;
  },

  async remove(path) {
    const { rest } = splitPath(path);
    if (rest.length === 0) throw new Error('Cannot delete an opened folder here');
    const parent = await dirAt(parentPath(path));
    await parent.removeEntry(rest[rest.length - 1]!, { recursive: true });
  },
};
