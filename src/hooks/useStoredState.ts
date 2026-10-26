import { useEffect, useState } from 'react';

/** useState that remembers its value in localStorage (silently falls back when storage is unavailable). */
export function useStoredState<T>(key: string, initial: T, isValid: (v: unknown) => v is T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (isValid(parsed)) return parsed;
      }
    } catch {
      /* storage blocked or corrupt: use the default */
    }
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);

  return [value, setValue];
}

export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
