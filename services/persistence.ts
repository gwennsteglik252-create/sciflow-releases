/**
 * SciFlow Pro IndexedDB Persistence Engine
 * 采用异步非阻塞 I/O，支持大规模科研数据实体的增量存储
 *
 * v3 新增：
 * - backups Object Store：同步前自动快照，最多保留 5 份
 * - 安全 putBatch：先写入新数据，再删除多余旧项，避免清空后写入失败丢数据
 */

const DB_NAME = 'SciFlowVault';
const DB_VERSION = 3;
const MAX_BACKUPS = 5;

export class PersistenceService {
  private db: IDBDatabase | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('resources')) {
          db.createObjectStore('resources', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('inventory')) {
          db.createObjectStore('inventory', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('document_embeddings')) {
          db.createObjectStore('document_embeddings', { keyPath: 'id' });
        }
        // v3: 备份快照存储
        if (!db.objectStoreNames.contains('backups')) {
          db.createObjectStore('backups', { keyPath: 'backupId' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 安全批量写入：先 upsert 新数据，再删除不在新列表中的旧项
   * 相比原来的 clear → put，即使写入过程中出错，旧数据也不会丢失
   */
  async putBatch(storeName: string, items: any[]): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      // 收集新数据的所有 id
      const newIds = new Set(items.map(item => item.id ?? item.key));

      // Step 1: 写入/更新所有新项
      items.forEach(item => store.put(item));

      // Step 2: 获取现有所有 key，删除不在新列表中的旧项
      const getAllKeysReq = store.getAllKeys();
      getAllKeysReq.onsuccess = () => {
        const existingKeys = getAllKeysReq.result;
        existingKeys.forEach(key => {
          if (!newIds.has(key)) {
            store.delete(key);
          }
        });
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async putOne(storeName: string, item: any): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getKv(key: string): Promise<any> {
    const db = await this.init();
    return new Promise((resolve) => {
      const transaction = db.transaction('sessions', 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => resolve(null);
    });
  }

  async setKv(key: string, value: any): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('sessions', 'readwrite');
      const store = transaction.objectStore('sessions');
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async migrateFromLocalStorage(lsKey: string, storeName: string): Promise<boolean> {
    const raw = localStorage.getItem(lsKey);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        await this.putBatch(storeName, data);
      } else {
        await this.setKv(lsKey, data);
      }
      localStorage.removeItem(lsKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ─── 备份系统 ──────────────────────────────────────────────────

  /**
   * 创建当前数据的备份快照
   * @param storeName 要备份的 store 名称（如 'projects'）
   * @param reason 备份原因描述（如 'cloud_sync_before_overwrite'）
   */
  async createBackup(storeName: string, reason: string = 'manual'): Promise<string> {
    const db = await this.init();
    const data = await this.getAll(storeName);

    // 如果没有数据，不创建空备份
    if (!data || data.length === 0) return '';

    const backupId = `${storeName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const backup = {
      backupId,
      storeName,
      reason,
      timestamp: new Date().toISOString(),
      itemCount: data.length,
      data,
    };

    return new Promise(async (resolve, reject) => {
      try {
        const transaction = db.transaction('backups', 'readwrite');
        const store = transaction.objectStore('backups');
        store.put(backup);
        transaction.oncomplete = async () => {
          // 自动清理：只保留最近 MAX_BACKUPS 份该 store 的备份
          await this.pruneBackups(storeName);
          console.log(`[Vault] 备份已创建: ${backupId} (${data.length} 项, 原因: ${reason})`);
          resolve(backupId);
        };
        transaction.onerror = () => reject(transaction.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * 列出指定 store 的所有备份，按时间倒序
   */
  async listBackups(storeName?: string): Promise<Array<{
    backupId: string;
    storeName: string;
    reason: string;
    timestamp: string;
    itemCount: number;
  }>> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('backups', 'readonly');
      const store = transaction.objectStore('backups');
      const request = store.getAll();
      request.onsuccess = () => {
        let results = (request.result || [])
          .map(({ data, ...meta }: any) => meta) // 不返回完整数据，只返回元信息
          .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));
        if (storeName) {
          results = results.filter((b: any) => b.storeName === storeName);
        }
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 从备份恢复数据到对应的 store
   */
  async restoreBackup(backupId: string): Promise<boolean> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('backups', 'readonly');
      const store = transaction.objectStore('backups');
      const request = store.get(backupId);
      request.onsuccess = async () => {
        const backup = request.result;
        if (!backup || !backup.data) {
          console.warn(`[Vault] 备份不存在: ${backupId}`);
          resolve(false);
          return;
        }
        try {
          await this.putBatch(backup.storeName, backup.data);
          console.log(`[Vault] 已从备份恢复: ${backupId} → ${backup.storeName} (${backup.data.length} 项)`);
          resolve(true);
        } catch (e) {
          reject(e);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 清理过多的备份，保留最新的 MAX_BACKUPS 份
   */
  private async pruneBackups(storeName: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve) => {
      const transaction = db.transaction('backups', 'readwrite');
      const store = transaction.objectStore('backups');
      const request = store.getAll();
      request.onsuccess = () => {
        const allBackups = (request.result || [])
          .filter((b: any) => b.storeName === storeName)
          .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));

        // 删除超出限制的旧备份
        if (allBackups.length > MAX_BACKUPS) {
          const toDelete = allBackups.slice(MAX_BACKUPS);
          toDelete.forEach((b: any) => store.delete(b.backupId));
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve(); // 清理失败不影响主流程
    });
  }
}

export const vault = new PersistenceService();