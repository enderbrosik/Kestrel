// On desktop, makes the native window frame match a manual light/dark choice.
// Pass null to follow the operating system again. Does nothing on the web.

import { isTauriRuntime } from './fs';

export async function setWindowTheme(theme: 'light' | 'dark' | null): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setTheme(theme);
  } catch (err) {
    console.warn('Could not set the window theme', err);
  }
}
