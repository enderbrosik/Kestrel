import { describe, expect, it, vi } from 'vitest';
import { createMemoryConfigStore } from '../src/config/store';
import { MAX_RECENT, addRecent, parseRecent, removeRecent, serializeRecent, type RecentFolder } from '../src/startup/recent';
import { RECENT_FILE, RecentFolders } from '../src/startup/recent-folders';

const folder = (path: string, openedAt: number): RecentFolder => ({ path, name: path.split('/').pop()!, openedAt });

describe('parseRecent', () => {
  it('returns an empty list for a missing or blank file', () => {
    expect(parseRecent(null)).toEqual({ folders: [], errors: [] });
    expect(parseRecent('  ')).toEqual({ folders: [], errors: [] });
  });

  it('reads folders newest first', () => {
    const text = JSON.stringify({ folders: [folder('/a', 1), folder('/b', 3), folder('/c', 2)] });
    expect(parseRecent(text).folders.map((f) => f.path)).toEqual(['/b', '/c', '/a']);
  });

  it('fills in a missing name from the path and a missing time with 0', () => {
    const { folders } = parseRecent('{ "folders": [{ "path": "/home/me/project" }, { "path": "C:\\\\work\\\\app", "openedAt": 5 }] }');
    expect(folders).toEqual([
      { path: 'C:\\work\\app', name: 'app', openedAt: 5 },
      { path: '/home/me/project', name: 'project', openedAt: 0 },
    ]);
  });

  it('skips bad and duplicate entries and reports the bad ones', () => {
    const { folders, errors } = parseRecent('{ "folders": [{ "path": "/a", "openedAt": 1 }, { "path": "/a", "openedAt": 9 }, { "nope": 1 }, "text", { "path": "" }] }');
    expect(folders.map((f) => f.path)).toEqual(['/a']);
    expect(errors).toHaveLength(3);
  });

  it('survives malformed JSON and the wrong shape', () => {
    expect(parseRecent('{ "folders": [').folders).toEqual([]);
    expect(parseRecent('{ "folders": [').errors[0]).toContain('recent.json');
    expect(parseRecent('[1, 2]').errors[0]).toContain('expected');
    expect(parseRecent('{ "folders": "x" }').folders).toEqual([]);
  });

  it('keeps only the newest MAX_RECENT', () => {
    const many = Array.from({ length: MAX_RECENT + 5 }, (_, i) => folder(`/f${i}`, i));
    const { folders } = parseRecent(JSON.stringify({ folders: many }));
    expect(folders).toHaveLength(MAX_RECENT);
    expect(folders[0]!.path).toBe(`/f${MAX_RECENT + 4}`);
  });
});

describe('addRecent and removeRecent', () => {
  it('puts a new folder first', () => {
    const list = addRecent([folder('/a', 1)], '/b', 10);
    expect(list.map((f) => f.path)).toEqual(['/b', '/a']);
    expect(list[0]).toEqual({ path: '/b', name: 'b', openedAt: 10 });
  });

  it('moves an existing folder to the top without duplicating it', () => {
    const list = addRecent([folder('/a', 1), folder('/b', 2)], '/a', 10);
    expect(list.map((f) => f.path)).toEqual(['/a', '/b']);
    expect(list[0]!.openedAt).toBe(10);
  });

  it('drops the oldest when over the limit', () => {
    let list: RecentFolder[] = [];
    for (let i = 0; i < MAX_RECENT + 3; i++) list = addRecent(list, `/f${i}`, i);
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]!.path).toBe(`/f${MAX_RECENT + 2}`);
    expect(list.some((f) => f.path === '/f0')).toBe(false);
  });

  it('removes by path and does not change the original list', () => {
    const original = [folder('/a', 1), folder('/b', 2)];
    expect(removeRecent(original, '/a').map((f) => f.path)).toEqual(['/b']);
    expect(removeRecent(original, '/zzz')).toHaveLength(2);
    expect(original).toHaveLength(2);
  });
});

describe('serializeRecent', () => {
  it('round-trips through parseRecent', () => {
    const list = [folder('/b', 2), folder('/a', 1)];
    expect(parseRecent(serializeRecent(list)).folders).toEqual(list);
  });
});

describe('RecentFolders', () => {
  it('loads from the config store and notifies', async () => {
    const store = createMemoryConfigStore({ [RECENT_FILE]: serializeRecent([folder('/a', 1)]) });
    const recents = new RecentFolders();
    const listener = vi.fn();
    recents.onDidChange.on(listener);
    expect(recents.isLoaded).toBe(false);
    await recents.load(store);
    expect(recents.isLoaded).toBe(true);
    expect(recents.list.map((f) => f.path)).toEqual(['/a']);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('writes recent.json when a folder is added or removed', async () => {
    const store = createMemoryConfigStore();
    const recents = new RecentFolders();
    await recents.load(store);
    await recents.add('/x');
    await recents.add('/y');
    expect(parseRecent(await store.read(RECENT_FILE)).folders.map((f) => f.path)).toEqual(['/y', '/x']);
    await recents.remove('/y');
    expect(parseRecent(await store.read(RECENT_FILE)).folders.map((f) => f.path)).toEqual(['/x']);
  });

  it('keeps a folder opened before the file finished loading', async () => {
    const store = createMemoryConfigStore({ [RECENT_FILE]: serializeRecent([folder('/old', 1)]) });
    const recents = new RecentFolders();
    await recents.add('/new'); // before load: in memory only
    await recents.load(store);
    expect(recents.list.map((f) => f.path)).toEqual(['/new', '/old']);
  });

  it('survives an unreadable file and a failing write', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createMemoryConfigStore();
    store.read = async () => {
      throw new Error('disk on fire');
    };
    store.write = async () => {
      throw new Error('read-only');
    };
    const recents = new RecentFolders();
    await expect(recents.load(store)).resolves.toBeUndefined();
    expect(recents.isLoaded).toBe(true);
    await expect(recents.add('/a')).resolves.toBeUndefined();
    expect(recents.list.map((f) => f.path)).toEqual(['/a']);
    warn.mockRestore();
  });
});
