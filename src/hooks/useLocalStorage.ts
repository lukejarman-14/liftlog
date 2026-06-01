import { useState, useEffect, useRef } from 'react';

// Custom event name used to broadcast same-page cross-instance changes.
// The native 'storage' event only fires in *other* tabs, not the current one.
const SYNC_EVENT = 'vf-storage-sync';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Skip the write if the serialised value hasn't changed (avoids redundant I/O
  // when state updates produce equal content via object spreads).
  const lastWritten = useRef<string | null>(null);

  useEffect(() => {
    try {
      const serialized = JSON.stringify(value);
      if (serialized === lastWritten.current) return;
      localStorage.setItem(key, serialized);
      lastWritten.current = serialized;
      // Notify all other useLocalStorage instances watching the same key
      // so their React state stays in sync within this page/tab.
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { key, serialized } }));
    } catch {
      // Storage full or private browsing — silently ignore.
    }
  }, [key, value]);

  // Re-read when another instance of this hook writes the same key.
  useEffect(() => {
    const handleSync = (e: Event) => {
      const { key: changedKey, serialized } = (e as CustomEvent<{ key: string; serialized: string }>).detail;
      if (changedKey !== key) return;
      // Avoid re-applying our own write (lastWritten already matches)
      if (serialized === lastWritten.current) return;
      try {
        lastWritten.current = serialized;
        setValue(JSON.parse(serialized) as T);
      } catch { /* ignore */ }
    };
    window.addEventListener(SYNC_EVENT, handleSync);
    return () => window.removeEventListener(SYNC_EVENT, handleSync);
  }, [key]);

  // Re-read from localStorage on cloud restore (vf-cloud-restored event).
  useEffect(() => {
    const handleRestore = () => {
      try {
        const item = localStorage.getItem(key);
        if (item !== null) setValue(JSON.parse(item) as T);
      } catch { /* ignore */ }
    };
    window.addEventListener('vf-cloud-restored', handleRestore);
    return () => window.removeEventListener('vf-cloud-restored', handleRestore);
  }, [key]);

  return [value, setValue] as const;
}
