import { ClientCache } from './client-cache';

const SHORTDRAMA_CACHE_EXPIRE = {
  details: 1800,
  lists: 300,
  categories: 300,
  recommends: 600,
  episodes: 3600,
  parse: 600,
};

function getCacheKey(
  prefix: string,
  params: Record<string, string | number | boolean>,
): string {
  const sortedParams = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return `shortdrama-${prefix}-${sortedParams}`;
}

async function getCache(key: string): Promise<unknown | null> {
  try {
    const cached = await ClientCache.get(key);
    if (cached) return cached;

    if (typeof localStorage !== 'undefined') {
      const localCached = localStorage.getItem(key);
      if (localCached) {
        try {
          const { data, expire } = JSON.parse(localCached) as {
            data: unknown;
            expire: number;
          };
          if (Date.now() <= expire) {
            return data;
          }
          localStorage.removeItem(key);
        } catch {
          localStorage.removeItem(key);
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function setCache(
  key: string,
  data: unknown,
  expireSeconds: number,
): Promise<void> {
  try {
    await ClientCache.set(key, data, expireSeconds);

    if (typeof localStorage !== 'undefined') {
      try {
        const cacheData = {
          data,
          expire: Date.now() + expireSeconds * 1000,
        };
        localStorage.setItem(key, JSON.stringify(cacheData));
      } catch {
        // 忽略 localStorage 错误
      }
    }
  } catch {
    // 忽略错误
  }
}

async function cleanExpiredCache(): Promise<void> {
  try {
    await ClientCache.clearExpired('shortdrama-');

    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('shortdrama-')) {
          try {
            const cached = localStorage.getItem(key);
            if (cached) {
              const { expire } = JSON.parse(cached) as { expire: number };
              if (Date.now() > expire) {
                keysToRemove.push(key);
              }
            }
          } catch {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    }
  } catch {
    // 忽略错误
  }
}

async function initShortdramaCache(): Promise<void> {
  await cleanExpiredCache();
  setInterval(() => cleanExpiredCache(), 10 * 60 * 1000);
}

if (typeof window !== 'undefined') {
  initShortdramaCache().catch(() => {});
}

export {
  cleanExpiredCache,
  getCache,
  getCacheKey,
  setCache,
  SHORTDRAMA_CACHE_EXPIRE,
};
