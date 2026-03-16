const DB_FILENAME = 'bookmarks.db';
const DB_STORAGE_KEY = 'bookmarks_database';

// Open IndexedDB for storing the database
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BookmarksDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('database')) {
        db.createObjectStore('database');
      }
    };
  });
}

export async function readDBFile(): Promise<Uint8Array | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['database'], 'readonly');
      const store = transaction.objectStore('database');
      const request = store.get(DB_STORAGE_KEY);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[FileSystem] Error reading from IndexedDB:', error);
    return null;
  }
}

export async function writeDBFile(data: Uint8Array): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['database'], 'readwrite');
      const store = transaction.objectStore('database');
      const request = store.put(data, DB_STORAGE_KEY);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[FileSystem] Error writing to IndexedDB:', error);
    return false;
  }
}

export async function importDBFile(file: File): Promise<Uint8Array | null> {
  try {
    console.log('[FileSystem] Import started:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      lastModified: new Date(file.lastModified).toISOString()
    });

    const arrayBuffer = await file.arrayBuffer();
    console.log('[FileSystem] ArrayBuffer loaded:', {
      byteLength: arrayBuffer.byteLength,
      sizeMB: (arrayBuffer.byteLength / 1024 / 1024).toFixed(2)
    });

    const uint8Array = new Uint8Array(arrayBuffer);
    console.log('[FileSystem] Uint8Array created:', {
      length: uint8Array.length,
      first16Bytes: Array.from(uint8Array.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')
    });

    return uint8Array;
  } catch (error) {
    console.error('[FileSystem] Error importing DB file:', error);
    console.error('[FileSystem] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return null;
  }
}

export async function wipeDatabase(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['database'], 'readwrite');
      const store = transaction.objectStore('database');
      const request = store.delete(DB_STORAGE_KEY);

      request.onsuccess = () => {
        console.log('[FileSystem] Database wiped from IndexedDB');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[FileSystem] Error wiping database:', error);
  }
}

export async function hasExistingDatabase(): Promise<boolean> {
  try {
    const data = await readDBFile();
    return data !== null && data.length > 0;
  } catch (error) {
    console.error('[FileSystem] Error checking for existing database:', error);
    return false;
  }
}
