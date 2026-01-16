/**
 * IndexedDB 存储工具
 * 用于存储大文件数据，如背景图片
 */

const DB_NAME = 'Vidora_ThemeDB';
const DB_VERSION = 1;
const STORE_NAME = 'backgroundImages';

interface DBImage {
  id: string;
  data: string;
  timestamp: number;
}

let db: IDBDatabase | null = null;

/**
 * 初始化 IndexedDB 数据库
 */
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

/**
 * 存储背景图片到 IndexedDB
 */
export const storeBackgroundImage = async (
  imageData: string,
): Promise<string> => {
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const id = 'background_image';
    const timestamp = Date.now();

    const image: DBImage = {
      id,
      data: imageData,
      timestamp,
    };

    return new Promise((resolve, reject) => {
      const request = store.put(image);

      request.onsuccess = () => {
        resolve(id);
      };

      request.onerror = () => {
        reject(new Error('Failed to store background image'));
      };
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error storing background image:', error);
    throw error;
  }
};

/**
 * 从 IndexedDB 获取背景图片
 */
export const getBackgroundImage = async (): Promise<string | null> => {
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get('background_image');

      request.onsuccess = (event) => {
        const result = (event.target as IDBRequest<DBImage>).result;
        resolve(result ? result.data : null);
      };

      request.onerror = () => {
        reject(new Error('Failed to get background image'));
      };
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error getting background image:', error);
    return null;
  }
};

/**
 * 删除背景图片
 */
export const deleteBackgroundImage = async (): Promise<void> => {
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.delete('background_image');

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to delete background image'));
      };
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error deleting background image:', error);
    throw error;
  }
};

/**
 * 清理过期的图片数据（可选）
 */
export const cleanupOldImages = async (
  maxAge: number = 30 * 24 * 60 * 60 * 1000,
): Promise<void> => {
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const currentTime = Date.now();
    const cutoffTime = currentTime - maxAge;

    return new Promise((resolve, reject) => {
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor) {
          const image = cursor.value as DBImage;

          if (image.timestamp < cutoffTime) {
            cursor.delete();
          }

          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        reject(new Error('Failed to cleanup old images'));
      };
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error cleaning up old images:', error);
    throw error;
  }
};
