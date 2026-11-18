// Config file storage for the web build. There is no config folder in a
// browser, so files live in localStorage. The editor can still open and save
// them through the virtual path "kestrel-config/<name>" (see web-fs.ts).

export const WEB_CONFIG_ROOT = 'kestrel-config';
const PREFIX = 'kestrel:config:';

export function isWebConfigPath(path: string): boolean {
  return path.startsWith(`${WEB_CONFIG_ROOT}/`);
}

export function webConfigName(path: string): string {
  return path.slice(WEB_CONFIG_ROOT.length + 1);
}

export function readWebConfig(name: string): string | null {
  try {
    return localStorage.getItem(PREFIX + name);
  } catch {
    return null;
  }
}

export function writeWebConfig(name: string, content: string): void {
  try {
    localStorage.setItem(PREFIX + name, content);
  } catch (err) {
    throw new Error(`Cannot store ${name} in this browser (${err instanceof Error ? err.message : err})`);
  }
}

/** File names directly inside a virtual config folder, such as "themes". */
export function listWebConfig(dir: string): string[] {
  const prefix = `${PREFIX}${dir}/`;
  const names: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix) && !key.slice(prefix.length).includes('/')) {
        names.push(key.slice(prefix.length));
      }
    }
  } catch {
    // Storage unavailable: no user files.
  }
  return names.sort();
}
