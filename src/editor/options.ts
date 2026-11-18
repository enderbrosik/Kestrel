// Turns settings into editor options. Pure, so it is unit tested.

import { indentDefaults } from '../languages/detect';
import type { Settings } from '../settings/schema';

export const DEFAULT_FONT_FAMILY = "Menlo, Monaco, 'Cascadia Code', Consolas, 'Courier New', monospace";

export function editorOptionsFromSettings(s: Settings) {
  const family = String(s['editor.fontFamily']).trim();
  return {
    fontSize: s['editor.fontSize'] as number,
    fontFamily: family || DEFAULT_FONT_FAMILY,
    wordWrap: s['editor.wordWrap'] as 'on' | 'off',
    lineNumbers: s['editor.lineNumbers'] as 'on' | 'off' | 'relative',
    minimap: { enabled: s['editor.minimap'] as boolean },
  };
}

/**
 * Indentation for a file of this language. A tab size of 0 means "use the
 * language's usual size". With `detect` on, the file's own indentation wins
 * and these values are only the fallback.
 */
export function indentFromSettings(s: Settings, languageId: string): { tabSize: number; insertSpaces: boolean; detect: boolean } {
  const configured = s['editor.tabSize'] as number;
  return {
    tabSize: configured > 0 ? configured : indentDefaults(languageId).tabSize,
    insertSpaces: s['editor.insertSpaces'] as boolean,
    detect: s['editor.detectIndentation'] as boolean,
  };
}
