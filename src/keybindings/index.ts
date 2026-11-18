// Keybindings feature: loads defaults plus the user's keybindings.json,
// dispatches key presses to commands, and adds the "keybindings.openFile" command.

import { registerCommand, runCommand } from '../core/commands';
import type { ConfigStore } from '../config/store';
import { reportError } from '../ui/status';
import defaultKeybindings from './default-keybindings.json';
import { contextsFor } from './context';
import { detectPlatform } from './keys';
import { keybindingsTemplate, loadKeybindings } from './loader';
import { KeybindingService } from './service';

export const KEYBINDINGS_FILE = 'keybindings.json';

export interface KeybindingsHandle {
  /** Re-read keybindings.json. Called after the user saves it. */
  reload(): Promise<void>;
  /** Path of the user's keybindings file, as the editor opens it. */
  filePath(): Promise<string>;
}

export async function initKeybindings(deps: {
  store: ConfigStore;
  openFile(path: string): Promise<void>;
}): Promise<KeybindingsHandle> {
  const platform = detectPlatform();
  const service = new KeybindingService({
    platform,
    contexts: () => contextsFor(document.activeElement),
    run: (command) => void runCommand(command),
  });

  const reload = async () => {
    let text: string | null = null;
    try {
      text = await deps.store.read(KEYBINDINGS_FILE);
    } catch (err) {
      reportError('Cannot read keybindings.json', err);
    }
    const { bindings, errors } = loadKeybindings(defaultKeybindings, text, platform);
    service.setBindings(bindings);
    if (errors.length > 0) {
      console.warn('Keybinding problems:\n' + errors.join('\n'));
      reportError(`keybindings.json: ${errors.length} problem${errors.length > 1 ? 's' : ''}. ${errors[0]}`);
    }
  };

  registerCommand('keybindings.openFile', async () => {
    // Create the file with instructions the first time, so there is something to edit.
    if ((await deps.store.read(KEYBINDINGS_FILE)) === null) {
      await deps.store.write(KEYBINDINGS_FILE, keybindingsTemplate(defaultKeybindings));
    }
    await deps.openFile(await deps.store.path(KEYBINDINGS_FILE));
  });

  service.attach();
  await reload();
  return { reload, filePath: () => deps.store.path(KEYBINDINGS_FILE) };
}
