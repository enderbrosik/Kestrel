import { describe, expect, it } from 'vitest';
import { indentDefaults, languageIdForPath, type LanguageInfo } from '../src/languages/detect';

const languages: LanguageInfo[] = [
  { id: 'python', extensions: ['.py'] },
  { id: 'typescript', extensions: ['.ts', '.tsx'] },
  { id: 'javascript', extensions: ['.js', '.mjs'] },
  { id: 'c', extensions: ['.c', '.h'] },
  { id: 'csharp', extensions: ['.cs'] },
  { id: 'json', extensions: ['.json'], filenames: ['.babelrc'] },
  { id: 'dockerfile', filenames: ['Dockerfile'] },
];

describe('languageIdForPath', () => {
  it('matches by extension', () => {
    expect(languageIdForPath(languages, '/a/b/main.py')).toBe('python');
    expect(languageIdForPath(languages, 'C:\\proj\\Program.cs')).toBe('csharp');
    expect(languageIdForPath(languages, 'x/y.TS')).toBe('typescript');
  });

  it('matches exact file names before extensions', () => {
    expect(languageIdForPath(languages, '/p/Dockerfile')).toBe('dockerfile');
    expect(languageIdForPath(languages, '/p/.babelrc')).toBe('json');
  });

  it('falls back to plaintext', () => {
    expect(languageIdForPath(languages, '/p/README')).toBe('plaintext');
    expect(languageIdForPath(languages, '/p/.py')).toBe('plaintext');
  });
});

describe('indentDefaults', () => {
  it('uses 4 spaces for Python and 2 for TypeScript', () => {
    expect(indentDefaults('python').tabSize).toBe(4);
    expect(indentDefaults('typescript').tabSize).toBe(2);
    expect(indentDefaults('unknown').tabSize).toBe(4);
  });
});
