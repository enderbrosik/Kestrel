// The recent-folders list: parsing, adding, removing. Pure functions, unit tested.
// Stored as recent.json: { "folders": [{ "path": "...", "name": "...", "openedAt": 1700000000000 }] }

import { parseJsonc } from '../config/jsonc';
import { baseName } from '../platform/fs';

export interface RecentFolder {
  path: string;
  /** Last path segment, shown as the title. */
  name: string;
  /** Milliseconds since the epoch when it was last opened. */
  openedAt: number;
}

export const MAX_RECENT = 10;

export interface RecentParseResult {
  folders: RecentFolder[];
  errors: string[];
}

/** Parse recent.json text. Problems never throw: bad entries are skipped and reported. */
export function parseRecent(text: string | null): RecentParseResult {
  if (text === null) return { folders: [], errors: [] };
  let raw: unknown;
  try {
    raw = parseJsonc(text);
  } catch (err) {
    return { folders: [], errors: [`recent.json: ${err instanceof Error ? err.message : String(err)}`] };
  }
  if (raw === undefined) return { folders: [], errors: [] };
  const list = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as { folders?: unknown }).folders : undefined;
  if (!Array.isArray(list)) return { folders: [], errors: ['recent.json: expected { "folders": [...] }'] };

  const errors: string[] = [];
  const seen = new Set<string>();
  const folders: RecentFolder[] = [];
  list.forEach((item: unknown, index: number) => {
    const entry = item as Partial<RecentFolder> | null;
    if (typeof entry !== 'object' || entry === null || typeof entry.path !== 'string' || entry.path === '') {
      errors.push(`recent.json entry ${index + 1}: needs a "path"`);
      return;
    }
    if (seen.has(entry.path)) return;
    seen.add(entry.path);
    folders.push({
      path: entry.path,
      name: typeof entry.name === 'string' && entry.name !== '' ? entry.name : baseName(entry.path),
      openedAt: typeof entry.openedAt === 'number' && Number.isFinite(entry.openedAt) ? entry.openedAt : 0,
    });
  });
  // Newest first, whatever order the file had.
  folders.sort((a, b) => b.openedAt - a.openedAt);
  return { folders: folders.slice(0, MAX_RECENT), errors };
}

/** Put a folder at the top (replacing any earlier entry for the same path). */
export function addRecent(list: readonly RecentFolder[], path: string, now: number): RecentFolder[] {
  const entry: RecentFolder = { path, name: baseName(path), openedAt: now };
  return [entry, ...list.filter((f) => f.path !== path)].slice(0, MAX_RECENT);
}

export function removeRecent(list: readonly RecentFolder[], path: string): RecentFolder[] {
  return list.filter((f) => f.path !== path);
}

export function serializeRecent(list: readonly RecentFolder[]): string {
  return JSON.stringify({ folders: list }, null, 2) + '\n';
}
