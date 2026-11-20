// Small saves use the existing localStorage key. Large saves move to IndexedDB.
const localLimit = 2_000_000;

export function createSaveStorage(key) {
  const database = new Promise((resolve) => {
    try {
      const request = indexedDB.open(key + '_storage', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('saves');
      request.onsuccess = () => resolve(request.result);
      request.onerror = request.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  let inDatabase = false;
  let writing = null;
  let pending;

  function slot(db, mode, operation) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('saves', mode);
      const request = operation(transaction.objectStore('saves'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  function writeLocal(raw) {
    try {
      localStorage.setItem(key, raw);
      return true;
    } catch { return false; }
  }

  async function read() {
    try {
      const db = await database;
      const raw = db && await slot(db, 'readonly', (store) => store.get(key));
      if (typeof raw === 'string') { inDatabase = true; return raw; }
    } catch { /* fall back to the legacy save */ }
    try { return localStorage.getItem(key); } catch { return null; }
  }

  async function flush() {
    let saved = false;
    while (pending !== undefined) {
      const raw = pending;
      pending = undefined;
      const db = await database;
      try {
        if (db) {
          await slot(db, 'readwrite', (store) => store.put(raw, key));
          inDatabase = true;
          try { localStorage.removeItem(key); } catch { /* storage may be blocked */ }
          saved = true;
          continue;
        }
      } catch { /* try legacy storage during the initial migration */ }
      saved = !inDatabase && writeLocal(raw);
    }
    writing = null;
    return saved;
  }

  function write(raw) {
    if (!inDatabase && !writing && raw.length < localLimit && writeLocal(raw)) return Promise.resolve(true);
    pending = raw;
    writing ||= flush();
    return writing;
  }

  return { read, write };
}
