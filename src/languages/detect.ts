// Picks a language for a file path. Pure functions, no Monaco dependency, so
// they are easy to test.

export interface LanguageInfo {
  id: string;
  extensions?: readonly string[];
  filenames?: readonly string[];
}

export const PLAIN_TEXT = 'plaintext';

/** Exact file name match first, then the longest matching extension. */
export function languageIdForPath(languages: readonly LanguageInfo[], path: string): string {
  const name = (path.split(/[\\/]/).pop() ?? path).toLowerCase();

  for (const lang of languages) {
    if (lang.filenames?.some((f) => f.toLowerCase() === name)) return lang.id;
  }

  let best: { id: string; length: number } | null = null;
  for (const lang of languages) {
    for (const ext of lang.extensions ?? []) {
      const e = ext.toLowerCase();
      if (name.endsWith(e) && name.length > e.length && (!best || e.length > best.length)) {
        best = { id: lang.id, length: e.length };
      }
    }
  }
  return best?.id ?? PLAIN_TEXT;
}

export interface IndentDefaults {
  tabSize: number;
  insertSpaces: boolean;
}

const INDENT: Record<string, IndentDefaults> = {
  python: { tabSize: 4, insertSpaces: true },
  c: { tabSize: 4, insertSpaces: true },
  cpp: { tabSize: 4, insertSpaces: true },
  csharp: { tabSize: 4, insertSpaces: true },
  typescript: { tabSize: 2, insertSpaces: true },
  javascript: { tabSize: 2, insertSpaces: true },
  json: { tabSize: 2, insertSpaces: true },
};

/** Conventional indentation for a language. The settings step can override it. */
export function indentDefaults(languageId: string): IndentDefaults {
  return INDENT[languageId] ?? { tabSize: 4, insertSpaces: true };
}
