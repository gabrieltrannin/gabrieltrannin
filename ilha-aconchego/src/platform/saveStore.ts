import { readSaveFile, type SaveFile } from '../core/save';

/**
 * Keeps the save in the browser's IndexedDB (one slot for now; cloud saves arrive in stage 7).
 * Every method resolves even when storage is blocked (private windows, full disk): the game
 * keeps running and simply starts a new island next time.
 */

const DB_NAME = 'ilha-aconchego';
const STORE = 'saves';
const SLOT = 'slot1';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is not available'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(mode: IDBTransactionMode, body: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = body(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(request.result);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

/** Loads and validates the save. Null when there is none or it cannot be used. */
export async function loadGame(): Promise<SaveFile | null> {
  try {
    return readSaveFile(await run('readonly', store => store.get(SLOT)));
  } catch (error) {
    console.warn('Could not read the save', error);
    return null;
  }
}

/** Writes the save. Resolves to false if the browser refused. */
export async function storeGame(file: SaveFile): Promise<boolean> {
  try {
    await run('readwrite', store => store.put(file, SLOT));
    return true;
  } catch (error) {
    console.warn('Could not write the save', error);
    return false;
  }
}

export async function deleteGame(): Promise<void> {
  try {
    await run('readwrite', store => store.delete(SLOT));
  } catch (error) {
    console.warn('Could not delete the save', error);
  }
}
