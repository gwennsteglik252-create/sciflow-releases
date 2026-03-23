import { useState, useEffect } from 'react';

export function useDebouncedStorage<T>(key: string, initialValue: T, delay: number = 2000) {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  useEffect(() => {
    const handler = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error(`Error saving ${key} to localStorage`, error);
      }
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [key, value, delay]);

  return [value, setValue] as const;
}