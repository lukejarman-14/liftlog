import { useState, useEffect, useRef } from 'react';

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
    } catch {
      // Storage full or private browsing — silently ignore.
    }
  }, [key, value]);

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
