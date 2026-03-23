import { useState, useEffect, useRef, useCallback } from 'react';
import { vault } from '../services/persistence';

/**
 * useAsyncStorage: 处理异步实体的 Hydration 与同步
 */
export function useAsyncStorage<T>(
  key: string,
  initialValue: T,
  type: 'kv' | 'entities' = 'entities'
) {
  const [value, setValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);
  const isInitialMount = useRef(true);

  // 1. 数据 Hydration: 启动时加载
  useEffect(() => {
    const hydrate = async () => {
      try {
        // 首先尝试迁移
        await vault.migrateFromLocalStorage(key, type === 'entities' ? key : 'sessions');

        let saved;
        if (type === 'entities') {
          saved = await vault.getAll(key);
        } else {
          saved = await vault.getKv(key);
        }

        if (saved !== undefined && saved !== null) {
          if (type === 'kv' && typeof saved === 'object' && typeof initialValue === 'object' && !Array.isArray(saved) && !Array.isArray(initialValue)) {
            setValue({ ...initialValue, ...saved } as unknown as T);
          } else {
            setValue(saved as unknown as T);
          }
        }
      } catch (e) {
        console.error(`Hydration failed for ${key}`, e);
      } finally {
        setIsLoaded(true);
      }
    };
    hydrate();
  }, [key, type]);

  // 2. 数据写回: 使用防抖确保存储性能
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!isLoaded) return;

    const handler = setTimeout(async () => {
      try {
        if (type === 'entities' && Array.isArray(value)) {
          await vault.putBatch(key, value);
        } else {
          await vault.setKv(key, value);
        }
      } catch (e) {
        console.error(`Persistence failed for ${key}`, e);
      }
    }, 2000);

    return () => clearTimeout(handler);
  }, [value, key, type, isLoaded]);

  return [value, setValue, isLoaded] as const;
}
