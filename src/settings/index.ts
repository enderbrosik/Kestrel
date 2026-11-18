// Settings feature: settings.json, the settings screen that edits it, and the
// commands "settings.open" (screen) and "settings.openFile" (the JSON).

import type { ConfigStore } from '../config/store';
import { registerCommand } from '../core/commands';
import { reportError } from '../ui/status';
import { SettingsScreen } from './screen';
import { SETTINGS_FILE, SettingsService } from './service';
import { settingsTemplate } from './loader';

export { SETTINGS, type Settings, type SettingValue } from './schema';
export { SettingsService } from './service';

export interface SettingsHandle {
  service: SettingsService;
  /** Re-read settings.json. Called after the user saves it. */
  reload(): Promise<void>;
  /** Refresh the settings screen (for example after the list of themes changed). */
  refreshScreen(): void;
  /** Path of settings.json, as the editor opens it. */
  filePath(): Promise<string>;
}

export async function initSettings(deps: {
  store: ConfigStore;
  /** Where the settings screen is attached. */
  mount: HTMLElement;
  openFile(path: string): Promise<void>;
  themeOptions(kind: 'light-themes' | 'dark-themes'): Array<{ id: string; name: string }>;
}): Promise<SettingsHandle> {
  const { store } = deps;
  const service = new SettingsService(store);

  const openSettingsFile = async () => {
    // Create the file with a commented template the first time, so there is something to edit.
    if ((await store.read(SETTINGS_FILE)) === null) await store.write(SETTINGS_FILE, settingsTemplate());
    await deps.openFile(await store.path(SETTINGS_FILE));
  };

  const screen = new SettingsScreen({
    service,
    themeOptions: deps.themeOptions,
    openFile: () => {
      screen.close();
      void openSettingsFile();
    },
  });
  deps.mount.append(screen.element);
  service.onDidChange.on(() => screen.refresh());

  registerCommand('settings.open', () => screen.toggle());
  registerCommand('settings.openFile', openSettingsFile);

  const reload = async () => {
    try {
      await service.reload();
    } catch (err) {
      return reportError('Cannot read settings.json', err);
    }
    if (service.fileError) reportError(`settings.json: ${service.fileError}`);
    else if (service.problems.length > 0) reportError(`settings.json: ${service.problems[0]}`);
  };
  await reload();

  return { service, reload, refreshScreen: () => screen.refresh(), filePath: () => store.path(SETTINGS_FILE) };
}
