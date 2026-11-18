// Holds the recent-folders list and keeps recent.json up to date.

import type { ConfigStore } from '../config/store';
import { Emitter } from '../core/events';
import { addRecent, parseRecent, removeRecent, serializeRecent, type RecentFolder } from './recent';

export const RECENT_FILE = 'recent.json';

export class RecentFolders {
  /** Fires with the new list whenever it changes (including after loading). */
  readonly onDidChange = new Emitter<readonly RecentFolder[]>();

  private folders: RecentFolder[] = [];
  private store: ConfigStore | null = null;
  private loaded = false;

  get list(): readonly RecentFolder[] {
    return this.folders;
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  async load(store: ConfigStore): Promise<void> {
    this.store = store;
    try {
      const { folders, errors } = parseRecent(await store.read(RECENT_FILE));
      if (errors.length > 0) console.warn(errors.join('\n'));
      // Anything added while loading is newer than what was on disk.
      const known = new Set(this.folders.map((f) => f.path));
      this.folders = [...this.folders, ...folders.filter((f) => !known.has(f.path))];
    } catch (err) {
      console.warn('Cannot read recent folders', err);
    }
    this.loaded = true;
    this.onDidChange.fire(this.folders);
  }

  async add(path: string): Promise<void> {
    this.folders = addRecent(this.folders, path, Date.now());
    this.onDidChange.fire(this.folders);
    await this.save();
  }

  async remove(path: string): Promise<void> {
    this.folders = removeRecent(this.folders, path);
    this.onDidChange.fire(this.folders);
    await this.save();
  }

  private async save(): Promise<void> {
    if (!this.store) return; // not loaded yet: saved by the next change after loading
    try {
      await this.store.write(RECENT_FILE, serializeRecent(this.folders));
    } catch (err) {
      console.warn('Cannot save recent folders', err);
    }
  }
}
