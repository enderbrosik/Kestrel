// Targeted edits to a JSONC object (a { ... } file with comments). Used by the
// settings screen so changing one setting does not discard the user's
// comments or formatting. Only top-level properties are supported.

interface Prop {
  key: string;
  /** Index of the opening quote of the key. */
  start: number;
  valueStart: number;
  valueEnd: number;
  /** Index of the comma after the value, or -1. */
  comma: number;
}

interface Scan {
  close: number;
  props: Prop[];
}

function skipTrivia(text: string, from: number): number {
  let i = from;
  while (i < text.length) {
    const c = text[i]!;
    if (/\s/.test(c)) i++;
    else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end < 0) throw new SyntaxError('Unterminated comment');
      i = end + 2;
    } else break;
  }
  return i;
}

/** Index just after the string that starts at `from`. */
function scanString(text: string, from: number): number {
  let i = from + 1;
  while (i < text.length) {
    if (text[i] === '\\') i += 2;
    else if (text[i] === '"') return i + 1;
    else i++;
  }
  throw new SyntaxError('Unterminated string');
}

function scanValueEnd(text: string, from: number): number {
  const c = text[from];
  if (c === '"') return scanString(text, from);
  if (c === '{' || c === '[') {
    let depth = 0;
    let i = from;
    while (i < text.length) {
      const ch = text[i]!;
      if (ch === '"') i = scanString(text, i);
      else if (ch === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) i = skipTrivia(text, i);
      else {
        if (ch === '{' || ch === '[') depth++;
        else if (ch === '}' || ch === ']') {
          depth--;
          if (depth === 0) return i + 1;
        }
        i++;
      }
    }
    throw new SyntaxError('Unterminated value');
  }
  let i = from;
  while (i < text.length && !/[\s,}\]]/.test(text[i]!) && !(text[i] === '/' && (text[i + 1] === '/' || text[i + 1] === '*'))) i++;
  if (i === from) throw new SyntaxError('Expected a value');
  return i;
}

function scan(text: string): Scan {
  let i = skipTrivia(text, 0);
  if (text[i] !== '{') throw new SyntaxError('Expected a JSON object');
  i++;
  const props: Prop[] = [];
  for (;;) {
    i = skipTrivia(text, i);
    if (i >= text.length) throw new SyntaxError('Missing closing }');
    if (text[i] === '}') return { close: i, props };
    if (text[i] !== '"') throw new SyntaxError(`Expected a property name at position ${i}`);
    const start = i;
    const keyEnd = scanString(text, i);
    const key = JSON.parse(text.slice(start, keyEnd)) as string;
    i = skipTrivia(text, keyEnd);
    if (text[i] !== ':') throw new SyntaxError(`Expected ":" at position ${i}`);
    const valueStart = skipTrivia(text, i + 1);
    const valueEnd = scanValueEnd(text, valueStart);
    i = skipTrivia(text, valueEnd);
    let comma = -1;
    if (text[i] === ',') {
      comma = i;
      i++;
    } else if (text[i] !== '}') {
      throw new SyntaxError(`Expected "," or "}" at position ${i}`);
    }
    props.push({ key, start, valueStart, valueEnd, comma });
  }
}

/** Keys that appear at the top level of the object. Throws SyntaxError if the text is not an object. */
export function topLevelKeys(text: string): string[] {
  return scan(text).props.map((p) => p.key);
}

/** Set a top-level property, replacing its value or adding it before the closing brace. */
export function setProperty(text: string, key: string, value: unknown): string {
  const { close, props } = scan(text);
  const json = JSON.stringify(value);
  const existing = [...props].reverse().find((p) => p.key === key);
  if (existing) return text.slice(0, existing.valueStart) + json + text.slice(existing.valueEnd);

  const entry = `${JSON.stringify(key)}: ${json}`;
  const last = props[props.length - 1];
  const needsComma = last !== undefined && last.comma < 0;
  const lineStart = text.lastIndexOf('\n', close - 1) + 1;
  const braceOnOwnLine = text.slice(lineStart, close).trim() === '';

  let out: string;
  if (braceOnOwnLine) {
    out = text.slice(0, lineStart) + `  ${entry}\n` + text.slice(lineStart);
  } else {
    out = text.slice(0, close) + ` ${entry} ` + text.slice(close);
  }
  if (needsComma) out = out.slice(0, last.valueEnd) + ',' + out.slice(last.valueEnd);
  return out;
}

/** Remove a top-level property (all occurrences). Returns the text unchanged if it is not there. */
export function removeProperty(text: string, key: string): string {
  let out = text;
  for (;;) {
    const { props } = scan(out);
    const index = props.map((p) => p.key).lastIndexOf(key);
    if (index < 0) return out;
    const prop = props[index]!;
    const previous = props[index - 1];

    const lineStart = out.lastIndexOf('\n', prop.start - 1) + 1;
    const ownLine = out.slice(lineStart, prop.start).trim() === '';
    const start = ownLine ? lineStart : prop.start;
    let end = prop.comma >= 0 ? prop.comma + 1 : prop.valueEnd;
    // Take a trailing "// comment" and the line break with it.
    const rest = /^[ \t]*(\/\/[^\n]*)?(\r?\n)?/.exec(out.slice(end))!;
    if (ownLine || rest[2]) end += rest[0].length;

    let result = out.slice(0, start) + out.slice(end);
    // The last property had no comma; the one before it would be left with a dangling comma.
    if (prop.comma < 0 && previous && previous.comma >= 0) {
      result = result.slice(0, previous.comma) + result.slice(previous.comma + 1);
    }
    out = result;
  }
}
