import { useState, useEffect, useCallback } from 'react';

const DB_NAME = 'peer-review-offline';
const STORE_NAME = 'pending-requests';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export default function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    const onOnline = () => { setIsOnline(true); syncQueue(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  const enqueue = useCallback(async (request) => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add({ ...request, timestamp: Date.now() });
      await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
      setQueueSize(s => s + 1);
    } catch { /* IndexedDB not available */ }
  }, []);

  const syncQueue = useCallback(async () => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const items = await new Promise((res, rej) => {
        const req = store.getAll();
        req.onsuccess = () => res(req.result);
        req.onerror = rej;
      });

      const { default: API } = await import('../services/api');
      let synced = 0;
      for (const item of items) {
        try {
          await API({ method: item.method, url: item.url, data: item.body });
          const delTx = db.transaction(STORE_NAME, 'readwrite');
          delTx.objectStore(STORE_NAME).delete(item.id);
          synced++;
        } catch {
          break;
        }
      }
      // Set accurate remaining count instead of unconditional 0
      setQueueSize(items.length - synced);
    } catch { /* ignore */ }
  }, []);

  return { isOnline, queueSize, enqueue, syncQueue };
}
