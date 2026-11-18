import { describe, expect, it, vi } from 'vitest';
import defaultKeybindings from '../src/keybindings/default-keybindings.json';
import { eventToChord, formatChord, parseChord } from '../src/keybindings/keys';
import { keybindingsTemplate, loadKeybindings, matchBinding } from '../src/keybindings/loader';
import { KeybindingService, type KeyboardEventLike } from '../src/keybindings/service';
import { parseJsonc } from '../src/config/jsonc';

function key(code: string, mods: Partial<KeyboardEventLike> = {}, k = ''): KeyboardEventLike {
  return {
    key: k,
    code,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...mods,
  };
}

describe('parseChord', () => {
  it('resolves Mod per platform', () => {
    expect(parseChord('Mod+S', 'mac')).toBe('Meta+S');
    expect(parseChord('Mod+S', 'other')).toBe('Ctrl+S');
  });

  it('puts modifiers in a fixed order and ignores case and aliases', () => {
    expect(parseChord('shift+cmd+o', 'mac')).toBe('Shift+Meta+O');
    expect(parseChord('Option+Ctrl+Right', 'mac')).toBe('Ctrl+Alt+Right');
    expect(parseChord('Mod+Alt+ArrowLeft', 'other')).toBe('Ctrl+Alt+Left');
  });

  it('accepts named, function, and punctuation keys', () => {
    expect(parseChord('F2', 'mac')).toBe('F2');
    expect(parseChord('Mod+,', 'mac')).toBe('Meta+,');
    expect(parseChord('Mod+Plus', 'other')).toBe('Ctrl++');
    expect(parseChord('Escape', 'other')).toBe('Escape');
  });

  it('rejects invalid chords', () => {
    expect(parseChord('', 'mac')).toBeNull();
    expect(parseChord('Mod+', 'mac')).toBeNull();
    expect(parseChord('Banana+S', 'mac')).toBeNull();
    expect(parseChord('Mod+Nope', 'mac')).toBeNull();
    expect(parseChord('Mod+F99', 'mac')).toBeNull();
  });
});

describe('eventToChord', () => {
  it('uses the physical key for letters, so Option+N on macOS still matches N', () => {
    expect(eventToChord(key('KeyN', { metaKey: true, altKey: true }, '˜'))).toBe('Alt+Meta+N');
  });

  it('handles digits, arrows, and F-keys', () => {
    expect(eventToChord(key('Digit1', { ctrlKey: true }, '1'))).toBe('Ctrl+1');
    expect(eventToChord(key('ArrowRight', {}, 'ArrowRight'))).toBe('Right');
    expect(eventToChord(key('F2', {}, 'F2'))).toBe('F2');
  });

  it('ignores bare modifier presses', () => {
    expect(eventToChord(key('ShiftLeft', { shiftKey: true }, 'Shift'))).toBeNull();
    expect(eventToChord(key('MetaLeft', { metaKey: true }, 'Meta'))).toBeNull();
  });

  it('round-trips with parseChord', () => {
    const parsed = parseChord('Mod+Shift+O', 'mac');
    expect(eventToChord(key('KeyO', { metaKey: true, shiftKey: true }, 'O'))).toBe(parsed);
  });
});

describe('formatChord', () => {
  it('uses symbols on macOS and words elsewhere', () => {
    expect(formatChord('Shift+Meta+O', 'mac')).toBe('⇧⌘O');
    expect(formatChord('Ctrl+Shift+O', 'other')).toBe('Ctrl+Shift+O');
  });
});

describe('loadKeybindings', () => {
  it('loads the shipped defaults without errors on both platforms', () => {
    for (const platform of ['mac', 'other'] as const) {
      const { bindings, errors } = loadKeybindings(defaultKeybindings, null, platform);
      expect(errors).toEqual([]);
      expect(bindings.length).toBe(defaultKeybindings.length);
    }
  });

  it('ships a custom scheme rather than the usual editor shortcuts', () => {
    const { bindings } = loadKeybindings(defaultKeybindings, null, 'other');
    const chords = new Set(bindings.map((b) => b.chord));
    // Not VS Code's: Ctrl+Shift+P palette, Ctrl+B sidebar, Ctrl+P quick open, Ctrl+W close.
    for (const vscode of ['Ctrl+Shift+P', 'Ctrl+B', 'Ctrl+P', 'Ctrl+W']) expect(chords.has(vscode)).toBe(false);
    expect(chords.has('Ctrl+S')).toBe(true);
  });

  it('lets user entries override defaults and add new ones', () => {
    const user = `[
      // custom save
      { "keys": "Mod+S", "run": "file.saveAll" },
      { "keys": "Mod+Alt+T", "run": "theme.toggle" },
    ]`;
    const { bindings, errors } = loadKeybindings(defaultKeybindings, user, 'other');
    expect(errors).toEqual([]);
    expect(matchBinding(bindings, 'Ctrl+S', new Set())?.command).toBe('file.saveAll');
    expect(matchBinding(bindings, 'Ctrl+Alt+T', new Set())?.source).toBe('user');
  });

  it('removes defaults with run: null', () => {
    const { bindings } = loadKeybindings(defaultKeybindings, '[{ "keys": "Mod+Alt+R", "run": null }]', 'other');
    expect(matchBinding(bindings, 'Ctrl+Alt+R', new Set())).toBeNull();
  });

  it('removes every "when" variant of a chord when no "when" is given, or just the matching one', () => {
    const defaults = [
      { keys: 'F2', run: 'a', when: 'explorer' },
      { keys: 'F2', run: 'b', when: 'editor' },
    ];
    const all = loadKeybindings(defaults, '[{ "keys": "F2", "run": null }]', 'mac');
    expect(all.bindings).toEqual([]);
    const one = loadKeybindings(defaults, '[{ "keys": "F2", "run": null, "when": "explorer" }]', 'mac');
    expect(one.bindings.map((b) => b.command)).toEqual(['b']);
  });

  it('keeps valid entries and reports invalid ones', () => {
    const user = `[
      { "keys": "Mod+Nope", "run": "x" },
      { "keys": "Mod+Alt+T", "run": "theme.toggle" },
      { "keys": "Mod+Alt+Y", "run": "y", "when": "nowhere" },
      { "keys": "Mod+Alt+U" },
      "oops"
    ]`;
    const { bindings, errors } = loadKeybindings([], user, 'other');
    expect(bindings.map((b) => b.command)).toEqual(['theme.toggle']);
    expect(errors).toHaveLength(4);
    expect(errors[0]).toContain('entry 1');
  });

  it('reports malformed JSON and a non-list file, and falls back to defaults', () => {
    const broken = loadKeybindings(defaultKeybindings, '[{ "keys": ', 'other');
    expect(broken.errors[0]).toContain('keybindings.json');
    expect(broken.bindings.length).toBe(defaultKeybindings.length);

    const wrongShape = loadKeybindings(defaultKeybindings, '{ "keys": "Mod+S" }', 'other');
    expect(wrongShape.errors[0]).toContain('expected a list');
  });

  it('treats an empty or missing file as no overrides', () => {
    expect(loadKeybindings(defaultKeybindings, '', 'other').errors).toEqual([]);
    expect(loadKeybindings(defaultKeybindings, '  \n', 'other').bindings.length).toBe(defaultKeybindings.length);
  });
});

describe('matchBinding', () => {
  const { bindings } = loadKeybindings(
    [
      { keys: 'Enter', run: 'generic' },
      { keys: 'Enter', run: 'explorer.open', when: 'explorer' },
      { keys: 'Delete', run: 'explorer.delete', when: 'explorer' },
    ],
    null,
    'other',
  );

  it('prefers a binding whose "when" matches over one without', () => {
    expect(matchBinding(bindings, 'Enter', new Set(['explorer']))?.command).toBe('explorer.open');
    expect(matchBinding(bindings, 'Enter', new Set(['editor']))?.command).toBe('generic');
  });

  it('ignores bindings whose context does not match', () => {
    expect(matchBinding(bindings, 'Delete', new Set(['editor']))).toBeNull();
    expect(matchBinding(bindings, 'Delete', new Set(['explorer']))?.command).toBe('explorer.delete');
  });
});

describe('KeybindingService', () => {
  function setup(contexts: string[] = []) {
    const run = vi.fn();
    const service = new KeybindingService({ platform: 'mac', contexts: () => new Set(contexts), run });
    service.setBindings(loadKeybindings(defaultKeybindings, null, 'mac').bindings);
    return { service, run };
  }

  it('runs the bound command and stops the event', () => {
    const { service, run } = setup();
    const e = key('KeyS', { metaKey: true }, 's');
    expect(service.handleKeydown(e)).toBe(true);
    expect(run).toHaveBeenCalledWith('file.save');
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('leaves unbound keys alone', () => {
    const { service, run } = setup();
    const e = key('KeyA', {}, 'a');
    expect(service.handleKeydown(e)).toBe(false);
    expect(run).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('only fires explorer keys when the explorer has focus', () => {
    const typing = setup(['editor']);
    expect(typing.service.handleKeydown(key('Delete', {}, 'Delete'))).toBe(false);
    const browsing = setup(['explorer']);
    expect(browsing.service.handleKeydown(key('Delete', {}, 'Delete'))).toBe(true);
    expect(browsing.run).toHaveBeenCalledWith('explorer.delete');
  });

  it('does not interfere with input method composition', () => {
    const { service, run } = setup(['explorer']);
    expect(service.handleKeydown(key('Enter', { isComposing: true }, 'Enter'))).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('keybindingsTemplate', () => {
  it('is valid JSONC that parses to an empty list, with the defaults as comments', () => {
    const text = keybindingsTemplate(defaultKeybindings);
    expect(parseJsonc(text)).toEqual([]);
    expect(text).toContain('"keys":"Mod+S"');
  });
});

describe('parseJsonc', () => {
  it('handles comments, trailing commas, and comment-like text inside strings', () => {
    const value = parseJsonc(`{
      // line comment
      "url": "http://example.com/*not a comment*/", /* block */
      "list": [1, 2,],
    }`);
    expect(value).toEqual({ url: 'http://example.com/*not a comment*/', list: [1, 2] });
  });

  it('returns undefined for blank text and throws for bad JSON', () => {
    expect(parseJsonc('   ')).toBeUndefined();
    expect(() => parseJsonc('{ "a": ')).toThrow(SyntaxError);
    expect(() => parseJsonc('/* never closed')).toThrow(SyntaxError);
  });
});
