// Every setting Kestrel knows about. This one list drives validation, the
// default settings.json template, and the settings screen, so adding a setting
// means adding one entry here and reading its value where it is used.

export type SettingValue = string | number | boolean;
/** Resolved settings: every key in SETTINGS has a value (the user's, or the default). */
export type Settings = Record<string, SettingValue>;

interface SettingBase {
  /** The key as written in settings.json, e.g. "editor.fontSize". */
  key: string;
  label: string;
  description: string;
  group: 'Appearance' | 'Editor';
}

export type SettingDef = SettingBase &
  (
    | { type: 'boolean'; default: boolean }
    | { type: 'number'; default: number; min: number; max: number; integer?: boolean }
    | { type: 'enum'; default: string; options: readonly string[] }
    /** `choices` fills a picker from the app (the installed themes of that type). */
    | { type: 'string'; default: string; choices?: 'light-themes' | 'dark-themes' }
  );

export const SETTINGS: readonly SettingDef[] = [
  {
    key: 'theme.mode',
    group: 'Appearance',
    label: 'Color mode',
    description: "Auto follows your operating system's light or dark setting.",
    type: 'enum',
    default: 'auto',
    options: ['auto', 'light', 'dark'],
  },
  {
    key: 'theme.light',
    group: 'Appearance',
    label: 'Light theme',
    description: 'Theme id used when the color mode is light.',
    type: 'string',
    default: 'kestrel-light',
    choices: 'light-themes',
  },
  {
    key: 'theme.dark',
    group: 'Appearance',
    label: 'Dark theme',
    description: 'Theme id used when the color mode is dark.',
    type: 'string',
    default: 'kestrel-dark',
    choices: 'dark-themes',
  },
  {
    key: 'editor.fontSize',
    group: 'Editor',
    label: 'Font size',
    description: 'Editor font size in pixels.',
    type: 'number',
    default: 14,
    min: 8,
    max: 40,
    integer: true,
  },
  {
    key: 'editor.fontFamily',
    group: 'Editor',
    label: 'Font family',
    description: 'A CSS font-family list. Leave empty for the default monospace font.',
    type: 'string',
    default: '',
  },
  {
    key: 'editor.tabSize',
    group: 'Editor',
    label: 'Tab size',
    description: "Spaces per indent. 0 uses each language's usual size (4 for Python, C and C#; 2 for TypeScript, JavaScript and JSON).",
    type: 'number',
    default: 0,
    min: 0,
    max: 16,
    integer: true,
  },
  {
    key: 'editor.insertSpaces',
    group: 'Editor',
    label: 'Indent with spaces',
    description: 'Insert spaces when pressing Tab. Turn off to insert tab characters.',
    type: 'boolean',
    default: true,
  },
  {
    key: 'editor.detectIndentation',
    group: 'Editor',
    label: 'Detect indentation',
    description: 'When a file opens, use the indentation it already has instead of the settings above.',
    type: 'boolean',
    default: true,
  },
  {
    key: 'editor.wordWrap',
    group: 'Editor',
    label: 'Word wrap',
    description: 'Wrap long lines at the edge of the editor.',
    type: 'enum',
    default: 'off',
    options: ['off', 'on'],
  },
  {
    key: 'editor.lineNumbers',
    group: 'Editor',
    label: 'Line numbers',
    description: 'How line numbers are shown.',
    type: 'enum',
    default: 'on',
    options: ['on', 'off', 'relative'],
  },
  {
    key: 'editor.minimap',
    group: 'Editor',
    label: 'Minimap',
    description: 'Show the code overview on the right edge.',
    type: 'boolean',
    default: false,
  },
];

export function findSetting(key: string): SettingDef | undefined {
  return SETTINGS.find((s) => s.key === key);
}
