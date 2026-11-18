// Where user configuration files live. Settings, keybindings, themes, and the
// recent-folders list all go through a ConfigStore, so they work the same on
// desktop (real files in the OS config folder) and on the web (localStorage).

import { isTauriRuntime } from '../platform/fs';
import { WEB_CONFIG_ROOT, listWebConfig, readWebConfig, writeWebConfig } from '../platform/web-config';

export interface ConfigStore {
  /** File text, or null if the file does not exist yet. */
  read(name: string): Promise<string | null>;
  write(name: string, content: string): Promise<void>;
  /** A path the editor can open and save for this config file. */
  path(name: string): Promise<string>;
  /** File names inside a config subfolder, such as "themes". */
  list(dir: string): Promise<string[]>;
}

const webStore: ConfigStore = {
  async read(name) {
    return readWebConfig(name);
  },
  async write(name, content) {
    writeWebConfig(name, content);
  },
  async path(name) {
    return `${WEB_CONFIG_ROOT}/${name}`;
  },
  async list(dir) {
    return listWebConfig(dir);
  },
};

async function createDesktopStore(): Promise<ConfigStore> {
  const { invoke } = await import('@tauri-apps/api/core');
  return {
    read: (name) => invoke<string | null>('config_read', { name }),
    write: (name, content) => invoke<void>('config_write', { name, content }),
    path: (name) => invoke<string>('config_path', { name }),
    list: (dir) => invoke<string[]>('config_list', { dir }),
  };
}

let storePromise: Promise<ConfigStore> | null = null;

export function getConfigStore(): Promise<ConfigStore> {
  storePromise ??= isTauriRuntime() ? createDesktopStore() : Promise.resolve(webStore);
  return storePromise;
}

/** An in-memory store, used by tests. */
export function createMemoryConfigStore(initial: Record<string, string> = {}): ConfigStore {
  const files = new Map(Object.entries(initial));
  return {
    async read(name) {
      return files.get(name) ?? null;
    },
    async write(name, content) {
      files.set(name, content);
    },
    async path(name) {
      return `/memory/${name}`;
    },
    async list(dir) {
      const prefix = `${dir}/`;
      return [...files.keys()]
        .filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
        .map((k) => k.slice(prefix.length))
        .sort();
    },
  };
}
