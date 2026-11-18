// Desktop (Tauri) file system backend. Each method calls a Rust command in
// src-tauri/src/fs.rs.

import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { FileEntry, FileSystemBackend } from './fs';

export const desktopFileSystem: FileSystemBackend = {
  kind: 'desktop',

  async pickFolder() {
    const selected = await open({ directory: true, multiple: false, title: 'Open Folder' });
    return typeof selected === 'string' ? selected : null;
  },

  async reopenFolder(path) {
    await invoke<FileEntry[]>('fs_list_dir', { path }); // throws if the folder is gone
    return path;
  },

  async saveAs(suggestedName, content) {
    const path = await save({ defaultPath: suggestedName, title: 'Save As' });
    if (!path) return null;
    await invoke<void>('fs_write_file', { path, content });
    return path;
  },

  async forgetFolder() {},

  listDir(path) {
    return invoke<FileEntry[]>('fs_list_dir', { path });
  },

  readFile(path) {
    return invoke<string>('fs_read_file', { path });
  },

  writeFile(path, content) {
    return invoke<void>('fs_write_file', { path, content });
  },

  createFile(dir, name) {
    return invoke<string>('fs_create_file', { dir, name });
  },

  createDir(dir, name) {
    return invoke<string>('fs_create_dir', { dir, name });
  },

  rename(path, newName) {
    return invoke<string>('fs_rename', { path, newName });
  },

  move(path, destDir) {
    return invoke<string>('fs_move', { path, destDir });
  },

  remove(path) {
    return invoke<void>('fs_remove', { path });
  },
};
