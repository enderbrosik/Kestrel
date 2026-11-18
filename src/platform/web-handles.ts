// Remembers opened folders in the browser (IndexedDB) so the recent-folders
// list still works after a reload. A stored handle can only be used again after
// the user grants permission, which happens in web-fs.ts on a click.
// Every function is best effort: if storage is unavailable the folder is simply not remembered.

const DB_NAME = 'kestrel';
const STORE = 'folder-handles';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise<T>((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).finally(() => db.close());
  } catch {
    return null;
  }
}

export async function saveFolderHandle(key: string, handle: FileSystemDirectoryHandle): Promise<void> {
  await run('readwrite', (s) => s.put(handle, key));
}

export async function loadFolderHandle(key: string): Promise<FileSystemDirectoryHandle | null> {
  return ((await run('readonly', (s) => s.get(key))) as FileSystemDirectoryHandle | undefined) ?? null;
}

export async function deleteFolderHandle(key: string): Promise<void> {
  await run('readwrite', (s) => s.delete(key));
}
