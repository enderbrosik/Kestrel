// JSON with comments and trailing commas. User-edited files (settings,
// keybindings, themes) are friendlier with comments. Line numbers are kept
// intact so JSON.parse error positions still point at the right place.

/** Remove // and /* *\/ comments and trailing commas, leaving strings untouched. */
export function stripJsonc(text: string): string {
  let out = '';
  let i = 0;
  let inString = false;
  while (i < text.length) {
    const c = text[i]!;
    const next = text[i + 1];
    if (inString) {
      out += c;
      if (c === '\\' && next !== undefined) {
        out += next;
        i += 2;
        continue;
      }
      if (c === '"') inString = false;
      i++;
    } else if (c === '"') {
      inString = true;
      out += c;
      i++;
    } else if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end < 0) throw new SyntaxError('Unterminated comment');
      out += text.slice(i, end + 2).replace(/[^\n]/g, ' ');
      i = end + 2;
    } else {
      out += c;
      i++;
    }
  }
  return removeTrailingCommas(out);
}

function removeTrailingCommas(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inString) {
      out += c;
      if (c === '\\') out += text[++i] ?? '';
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
      out += c;
    } else if (c === ',') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j]!)) j++;
      if (text[j] === '}' || text[j] === ']') continue; // drop the trailing comma
      out += c;
    } else {
      out += c;
    }
  }
  return out;
}

/** Parse JSONC text. Blank text gives undefined. Throws SyntaxError on invalid JSON. */
export function parseJsonc(text: string): unknown {
  if (text.trim() === '') return undefined;
  return JSON.parse(stripJsonc(text));
}
