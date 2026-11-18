import { describe, expect, it, vi } from 'vitest';
import { createMemoryConfigStore } from '../src/config/store';
import { editorOptionsFromSettings, indentFromSettings } from '../src/editor/options';
import { defaultSettings, parseSettings, settingsTemplate, validateSetting } from '../src/settings/loader';
import { SETTINGS, findSetting } from '../src/settings/schema';
import { SETTINGS_FILE, SettingsService } from '../src/settings/service';
import { parseJsonc } from '../src/config/jsonc';

describe('defaults', () => {
  it('give every setting a value that passes its own validation', () => {
    for (const def of SETTINGS) {
      expect(validateSetting(def, def.default)).toEqual({ ok: true, value: def.default });
    }
  });

  it('have unique keys', () => {
    expect(new Set(SETTINGS.map((s) => s.key)).size).toBe(SETTINGS.length);
  });

  it('are used when there is no file', () => {
    const r = parseSettings(null);
    expect(r.settings).toEqual(defaultSettings());
    expect(r.explicit.size).toBe(0);
    expect(r.errors).toEqual([]);
    expect(r.syntaxError).toBeNull();
  });

  it('are used for an empty file', () => {
    expect(parseSettings('  \n').settings).toEqual(defaultSettings());
  });
});

describe('parseSettings', () => {
  it('applies valid values and marks them as set', () => {
    const r = parseSettings(`{ "editor.fontSize": 18, "theme.mode": "dark", "editor.minimap": true }`);
    expect(r.errors).toEqual([]);
    expect(r.settings['editor.fontSize']).toBe(18);
    expect(r.settings['theme.mode']).toBe('dark');
    expect(r.settings['editor.minimap']).toBe(true);
    expect(r.settings['editor.wordWrap']).toBe('off'); // untouched default
    expect([...r.explicit].sort()).toEqual(['editor.fontSize', 'editor.minimap', 'theme.mode']);
  });

  it('allows comments and trailing commas', () => {
    const r = parseSettings(`// hi\n{\n  /* size */ "editor.fontSize": 16, // px\n}`);
    expect(r.errors).toEqual([]);
    expect(r.settings['editor.fontSize']).toBe(16);
  });

  it('reports bad values, keeps the defaults for them, and still applies the good ones', () => {
    const r = parseSettings(
      `{ "editor.fontSize": 3, "editor.tabSize": 2.5, "editor.wordWrap": "sideways",
         "editor.minimap": "yes", "editor.fontFamily": 7, "editor.lineNumbers": "relative" }`,
    );
    expect(r.errors).toHaveLength(5);
    expect(r.errors.join('\n')).toContain('"editor.fontSize" must be between 8 and 40');
    expect(r.errors.join('\n')).toContain('whole number');
    expect(r.errors.join('\n')).toContain('one of: off, on');
    expect(r.settings['editor.fontSize']).toBe(14);
    expect(r.settings['editor.lineNumbers']).toBe('relative');
    expect(r.explicit.has('editor.fontSize')).toBe(false);
    expect(r.explicit.has('editor.lineNumbers')).toBe(true);
  });

  it('reports unknown settings so typos are noticed', () => {
    const r = parseSettings(`{ "editor.fontSzie": 15 }`);
    expect(r.errors).toEqual(['Unknown setting "editor.fontSzie"']);
    expect(r.settings).toEqual(defaultSettings());
  });

  it('reports a syntax error and uses nothing from the file', () => {
    const r = parseSettings(`{ "editor.fontSize": 18, `);
    expect(r.syntaxError).not.toBeNull();
    expect(r.settings).toEqual(defaultSettings());
    expect(r.explicit.size).toBe(0);
  });

  it('rejects a file that is not an object', () => {
    expect(parseSettings('[1, 2]').syntaxError).toContain('must be an object');
    expect(parseSettings('"text"').syntaxError).toContain('must be an object');
  });
});

describe('validateSetting', () => {
  const def = (key: string) => findSetting(key)!;

  it('checks types and ranges', () => {
    expect(validateSetting(def('editor.fontSize'), 20).ok).toBe(true);
    expect(validateSetting(def('editor.fontSize'), '20').ok).toBe(false);
    expect(validateSetting(def('editor.fontSize'), NaN).ok).toBe(false);
    expect(validateSetting(def('editor.fontSize'), 41).ok).toBe(false);
    expect(validateSetting(def('editor.insertSpaces'), 1).ok).toBe(false);
    expect(validateSetting(def('theme.mode'), 'dark').ok).toBe(true);
    expect(validateSetting(def('theme.mode'), 'sepia').ok).toBe(false);
    expect(validateSetting(def('theme.light'), 'my-theme').ok).toBe(true);
  });
});

describe('settingsTemplate', () => {
  it('is valid JSONC that changes nothing, and mentions every setting', () => {
    const text = settingsTemplate();
    expect(parseJsonc(text)).toEqual({});
    expect(parseSettings(text).settings).toEqual(defaultSettings());
    for (const def of SETTINGS) expect(text).toContain(`"${def.key}"`);
  });
});

describe('SettingsService', () => {
  const setup = (initial?: string) => {
    const store = createMemoryConfigStore(initial === undefined ? {} : { [SETTINGS_FILE]: initial });
    return { store, service: new SettingsService(store) };
  };

  it('loads defaults when the file is missing', async () => {
    const { service } = setup();
    await service.reload();
    expect(service.values).toEqual(defaultSettings());
    expect(service.isSet('editor.fontSize')).toBe(false);
  });

  it('creates the file from the template on the first change, and the result parses', async () => {
    const { service, store } = setup();
    await service.reload();
    await service.set('editor.fontSize', 20);
    const text = (await store.read(SETTINGS_FILE))!;
    expect(parseJsonc(text)).toEqual({ 'editor.fontSize': 20 });
    expect(text).toContain('// Kestrel settings'); // template comments kept
    expect(service.values['editor.fontSize']).toBe(20);
    expect(service.isSet('editor.fontSize')).toBe(true);
  });

  it("keeps the user's comments and other settings when changing one", async () => {
    const original = `{\n  // my font\n  "editor.fontSize": 16, // px\n  "editor.minimap": true\n}\n`;
    const { service, store } = setup(original);
    await service.reload();
    await service.set('editor.fontSize', 18);
    await service.set('theme.mode', 'dark');
    const text = (await store.read(SETTINGS_FILE))!;
    expect(text).toContain('// my font');
    expect(text).toContain('// px');
    expect(parseJsonc(text)).toEqual({ 'editor.fontSize': 18, 'editor.minimap': true, 'theme.mode': 'dark' });
  });

  it('removes an entry on reset so the default applies again', async () => {
    const { service, store } = setup(`{\n  "editor.fontSize": 16,\n  "editor.minimap": true\n}\n`);
    await service.reload();
    await service.reset('editor.fontSize');
    expect(parseJsonc((await store.read(SETTINGS_FILE))!)).toEqual({ 'editor.minimap': true });
    expect(service.values['editor.fontSize']).toBe(14);
    expect(service.isSet('editor.fontSize')).toBe(false);
  });

  it('rejects invalid values and unknown keys without touching the file', async () => {
    const { service, store } = setup(`{ "editor.fontSize": 16 }`);
    await service.reload();
    await expect(service.set('editor.fontSize', 999)).rejects.toThrow('between 8 and 40');
    await expect(service.set('editor.nope', 1)).rejects.toThrow('Unknown setting');
    await expect(service.reset('editor.nope')).rejects.toThrow('Unknown setting');
    expect(await store.read(SETTINGS_FILE)).toBe(`{ "editor.fontSize": 16 }`);
  });

  it('refuses to write over a file with a syntax error', async () => {
    const broken = `{ "editor.fontSize": 16, `;
    const { service, store } = setup(broken);
    await service.reload();
    expect(service.fileError).not.toBeNull();
    await expect(service.set('editor.fontSize', 18)).rejects.toThrow('syntax error');
    expect(await store.read(SETTINGS_FILE)).toBe(broken);
  });

  it('notifies listeners when settings change', async () => {
    const { service } = setup();
    const listener = vi.fn();
    service.onDidChange.on(listener);
    await service.reload();
    await service.set('editor.wordWrap', 'on');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.lastCall![0]['editor.wordWrap']).toBe('on');
  });

  it('picks up edits made to the file directly', async () => {
    const { service, store } = setup(`{ "editor.fontSize": 16 }`);
    await service.reload();
    await store.write(SETTINGS_FILE, `{ "editor.fontSize": 22 }`);
    await service.reload();
    expect(service.values['editor.fontSize']).toBe(22);
  });
});

describe('editor options from settings', () => {
  it('maps settings to Monaco options and falls back to a default font', () => {
    const s = { ...defaultSettings(), 'editor.fontSize': 16, 'editor.wordWrap': 'on', 'editor.minimap': true };
    expect(editorOptionsFromSettings(s)).toMatchObject({ fontSize: 16, wordWrap: 'on', lineNumbers: 'on', minimap: { enabled: true } });
    expect(editorOptionsFromSettings(s).fontFamily).toContain('monospace');
    expect(editorOptionsFromSettings({ ...s, 'editor.fontFamily': ' Fira Code ' }).fontFamily).toBe('Fira Code');
  });

  it('uses the language indentation when tab size is 0, and the setting otherwise', () => {
    const s = defaultSettings();
    expect(indentFromSettings(s, 'python')).toEqual({ tabSize: 4, insertSpaces: true, detect: true });
    expect(indentFromSettings(s, 'typescript').tabSize).toBe(2);
    expect(indentFromSettings({ ...s, 'editor.tabSize': 8, 'editor.insertSpaces': false }, 'typescript')).toEqual({
      tabSize: 8,
      insertSpaces: false,
      detect: true,
    });
  });
});
