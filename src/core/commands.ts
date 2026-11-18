// Command registry. Every user action has an id such as "file.save" or
// "explorer.newFile". Buttons, menus, and keybindings all run commands by id,
// so the keybinding file can be remapped without touching feature code.

export type CommandHandler = (...args: unknown[]) => void | Promise<void>;

const handlers = new Map<string, CommandHandler>();

/** Register a command. Returns a disposer. Re-registering an id replaces it. */
export function registerCommand(id: string, handler: CommandHandler): () => void {
  handlers.set(id, handler);
  return () => {
    if (handlers.get(id) === handler) handlers.delete(id);
  };
}

/** Run a command by id. Unknown ids are reported, never thrown. */
export async function runCommand(id: string, ...args: unknown[]): Promise<void> {
  const handler = handlers.get(id);
  if (!handler) {
    console.warn(`Unknown command: ${id}`);
    return;
  }
  try {
    await handler(...args);
  } catch (err) {
    console.error(`Command ${id} failed`, err);
  }
}

export function hasCommand(id: string): boolean {
  return handlers.has(id);
}

export function listCommands(): string[] {
  return [...handlers.keys()].sort();
}
