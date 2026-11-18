import { describe, expect, it } from 'vitest';
import { parseJsonc } from '../src/config/jsonc';
import { removeProperty, setProperty, topLevelKeys } from '../src/config/jsonc-edit';

describe('setProperty', () => {
  it('replaces an existing value in place, keeping comments and layout', () => {
    const text = `{\n  // size\n  "a": 1, // one\n  "b": "x"\n}\n`;
    const out = setProperty(text, 'a', 5);
    expect(out).toBe(`{\n  // size\n  "a": 5, // one\n  "b": "x"\n}\n`);
  });

  it('replaces string, object, and array values without touching their neighbors', () => {
    const text = `{ "s": "a, b }", "o": { "x": [1, 2, { "y": 3 }] }, "z": 1 }`;
    expect(parseJsonc(setProperty(text, 's', 'new'))).toEqual({ s: 'new', o: { x: [1, 2, { y: 3 }] }, z: 1 });
    expect(parseJsonc(setProperty(text, 'o', false))).toEqual({ s: 'a, b }', o: false, z: 1 });
  });

  it('adds a property to an empty object', () => {
    expect(parseJsonc(setProperty('{}', 'a', 1))).toEqual({ a: 1 });
    expect(parseJsonc(setProperty('{\n}\n', 'a', 1))).toEqual({ a: 1 });
    expect(setProperty('{\n}\n', 'a', 1)).toBe('{\n  "a": 1\n}\n');
  });

  it('adds after the last property, inserting the missing comma', () => {
    expect(setProperty('{\n  "a": 1\n}\n', 'b', 2)).toBe('{\n  "a": 1,\n  "b": 2\n}\n');
  });

  it('does not add a second comma when the last property already has a trailing comma', () => {
    const out = setProperty('{\n  "a": 1,\n}\n', 'b', 2);
    expect(parseJsonc(out)).toEqual({ a: 1, b: 2 });
    expect(out).toBe('{\n  "a": 1,\n  "b": 2\n}\n');
  });

  it('handles an object that is only comments', () => {
    const out = setProperty('// header\n{\n  // "a": 1,\n}\n', 'a', 2);
    expect(parseJsonc(out)).toEqual({ a: 2 });
    expect(out).toContain('// header');
    expect(out).toContain('// "a": 1,');
  });

  it('handles a closing brace on the same line', () => {
    expect(parseJsonc(setProperty('{"a":1}', 'b', 2))).toEqual({ a: 1, b: 2 });
    expect(parseJsonc(setProperty('{ }', 'b', 2))).toEqual({ b: 2 });
  });

  it('is not fooled by braces, commas, and comment markers inside strings', () => {
    const text = `{ "url": "http://x.com/*y*/", "t": "} , {" }`;
    expect(parseJsonc(setProperty(text, 'n', 1))).toEqual({ url: 'http://x.com/*y*/', t: '} , {', n: 1 });
    expect(parseJsonc(setProperty(text, 'url', 'z'))).toEqual({ url: 'z', t: '} , {' });
  });

  it('escapes keys and values correctly', () => {
    const out = setProperty('{}', 'quote"key', 'line\nbreak "q"');
    expect(parseJsonc(out)).toEqual({ 'quote"key': 'line\nbreak "q"' });
  });

  it('only looks at top-level keys', () => {
    const out = setProperty('{ "o": { "a": 1 } }', 'a', 2);
    expect(parseJsonc(out)).toEqual({ o: { a: 1 }, a: 2 });
  });

  it('throws on text that is not an object or is malformed', () => {
    expect(() => setProperty('[1]', 'a', 1)).toThrow(SyntaxError);
    expect(() => setProperty('{ "a": ', 'a', 1)).toThrow(SyntaxError);
    expect(() => setProperty('{ "a": 1 ', 'b', 1)).toThrow(SyntaxError);
    expect(() => setProperty('{ "a" 1 }', 'b', 1)).toThrow(SyntaxError);
    expect(() => setProperty('', 'a', 1)).toThrow(SyntaxError);
  });
});

describe('removeProperty', () => {
  it('removes a middle property and its line', () => {
    const out = removeProperty('{\n  "a": 1,\n  "b": 2,\n  "c": 3\n}\n', 'b');
    expect(out).toBe('{\n  "a": 1,\n  "c": 3\n}\n');
  });

  it('removes the last property and the comma left dangling before it', () => {
    const out = removeProperty('{\n  "a": 1,\n  "b": 2\n}\n', 'b');
    expect(out).toBe('{\n  "a": 1\n}\n');
    expect(parseJsonc(out)).toEqual({ a: 1 });
  });

  it('removes the only property', () => {
    expect(removeProperty('{\n  "a": 1\n}\n', 'a')).toBe('{\n}\n');
  });

  it('takes its trailing line comment along but leaves other comments', () => {
    const out = removeProperty('{\n  // keep me\n  "a": 1, // drop me\n  "b": 2\n}\n', 'a');
    expect(out).toBe('{\n  // keep me\n  "b": 2\n}\n');
  });

  it('removes object and array values', () => {
    const out = removeProperty('{ "a": { "x": [1, 2] }, "b": 1 }', 'a');
    expect(parseJsonc(out)).toEqual({ b: 1 });
  });

  it('removes every duplicate of a key', () => {
    expect(parseJsonc(removeProperty('{ "a": 1, "b": 2, "a": 3 }', 'a'))).toEqual({ b: 2 });
  });

  it('leaves text unchanged when the key is missing', () => {
    const text = '{\n  "a": 1\n}\n';
    expect(removeProperty(text, 'zzz')).toBe(text);
  });

  it('does not touch nested keys with the same name', () => {
    expect(parseJsonc(removeProperty('{ "o": { "a": 1 } }', 'a'))).toEqual({ o: { a: 1 } });
  });
});

describe('topLevelKeys', () => {
  it('lists keys in order, ignoring nested ones and comments', () => {
    expect(topLevelKeys('{ /* c */ "b": { "x": 1 }, // c\n "a": [1], }')).toEqual(['b', 'a']);
  });
});
