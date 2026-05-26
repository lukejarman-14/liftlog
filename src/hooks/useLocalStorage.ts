import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full or private browsing
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
