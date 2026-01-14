/* eslint-disable no-console */

/**
 * EdgeOne KV 缓存层
 * 作为 Redis 缓存的前置缓存层，提供全球边缘节点加速
 * 仅在 EdgeOne Pages Edge Functions 中可用
 *
 * 重要说明：
 * 1. EdgeOne KV 只能在 EdgeOne Pages 的 Edge Functions 中使用
 * 2. KV 实例通过环境变量注入（如 env.VIDORA_KV）
 * 3. 本地开发环境无法测试 EdgeOne KV
 * 4. 需要在 EdgeOne 控制台绑定命名空间到项目
 */

// 检查是否启用 EdgeOne KV 缓存
const EDGEONE_KV_ENABLED =
  process.env.EDGEONE_KV_ENABLED === 'true' ||
  process.env.NEXT_PUBLIC_EDGEONE_KV_ENABLED === 'true';

// EdgeOne KV 实例（仅在 Edge Functions 中可用）
let edgeOneKVInstance: any = null;

/**
 * 设置 EdgeOne KV 实例（在 EdgeOne 函数中调用）
 * 必须在 EdgeOne Pages 的 Edge Functions 中调用
 *
 * @param kvInstance - 从 env 参数获取的 KV 实例（如 env.VIDORA_KV）
 *
 * @example
 * // 在 EdgeOne 函数中使用
 * export async function onRequest({ request, params, env }) {
 *   const kv = env.VIDORA_KV; // 从环境变量获取 KV 实例
 *   setEdgeOneKVInstance(kv);
 *   // ...
 * }
 */
export function setEdgeOneKVInstance(kvInstance: any): void {
  if (EDGEONE_KV_ENABLED && kvInstance) {
    edgeOneKVInstance = kvInstance;
    console.log('✅ EdgeOne KV 实例已设置');
  }
}

/**
 * 获取 EdgeOne KV 实例
 * @returns KV 实例或 null（如果未设置或不可用）
 */
function getEdgeOneKV(): any {
  if (!EDGEONE_KV_ENABLED) {
    return null;
  }
  return edgeOneKVInstance;
}

/**
 * EdgeOne KV 缓存管理器
 *
 * 使用官方 API 规范：
 * - put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream): Promise<void>
 * - get(key: string, options?: {type: string}): Promise<value>
 * - delete(key: string): Promise<void>
 * - list(options?: {prefix?: string, limit?: number, cursor?: string}): Promise<ListResult>
 */
export class EdgeOneKVCache {
  /**
   * 检查 EdgeOne KV 是否可用
   * @returns true 如果 EdgeOne KV 已启用且实例已设置
   */
  static isAvailable(): boolean {
    return EDGEONE_KV_ENABLED && edgeOneKVInstance !== null;
  }

  /**
   * 获取缓存
   * @param key - 缓存键
   * @returns 缓存数据或 null
   *
   * @example
   * const data = await EdgeOneKVCache.get('my-key');
   */
  static async get(key: string): Promise<any | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const kv = getEdgeOneKV();
      if (!kv) {
        return null;
      }

      // 添加命名空间前缀，避免与其他数据冲突
      const namespacedKey = `cache_${key}`;

      // 使用官方 API：get(key, {type: 'json'})
      const value = await kv.get(namespacedKey, 'json');

      if (value !== null && value !== undefined) {
        // 检查是否过期
        if (value.expiry && value.expiry < Date.now()) {
          console.log(`⏰ EdgeOne KV 缓存已过期: ${key}`);
          await this.delete(key);
          return null;
        }

        console.log(`✅ EdgeOne KV 缓存命中: ${key}`);
        return value.data;
      }

      return null;
    } catch (error) {
      console.warn(`⚠️ EdgeOne KV 读取失败 (${key}):`, error);
      return null;
    }
  }

  /**
   * 设置缓存
   * @param key - 缓存键
   * @param data - 缓存数据
   * @param expireSeconds - 过期时间（秒），可选
   * @returns true 如果成功，false 如果失败
   *
   * @example
   * await EdgeOneKVCache.set('my-key', {foo: 'bar'}, 3600);
   */
  static async set(
    key: string,
    data: any,
    expireSeconds?: number,
  ): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const kv = getEdgeOneKV();
      if (!kv) {
        return false;
      }

      const namespacedKey = `cache_${key}`;

      // EdgeOne KV 不支持自动过期，需要手动实现
      // 将数据和过期时间一起存储
      const cacheData = {
        data,
        expiry: expireSeconds ? Date.now() + expireSeconds * 1000 : 0,
      };

      // 使用官方 API：put(key, value)
      // value 必须是字符串、ArrayBuffer、ArrayBufferView 或 ReadableStream
      await kv.put(namespacedKey, JSON.stringify(cacheData));

      console.log(
        `💾 EdgeOne KV 缓存已设置: ${key}${
          expireSeconds ? ` (${expireSeconds}s)` : ''
        }`,
      );
      return true;
    } catch (error) {
      console.warn(`⚠️ EdgeOne KV 写入失败 (${key}):`, error);
      return false;
    }
  }

  /**
   * 删除缓存
   * @param key - 缓存键
   * @returns true 如果成功，false 如果失败
   *
   * @example
   * await EdgeOneKVCache.delete('my-key');
   */
  static async delete(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const kv = getEdgeOneKV();
      if (!kv) {
        return false;
      }

      const namespacedKey = `cache_${key}`;

      // 使用官方 API：delete(key)
      await kv.delete(namespacedKey);

      console.log(`🗑️ EdgeOne KV 缓存已删除: ${key}`);
      return true;
    } catch (error) {
      console.warn(`⚠️ EdgeOne KV 删除失败 (${key}):`, error);
      return false;
    }
  }

  /**
   * 清理过期缓存（按前缀）
   * @param prefix - 键前缀，可选
   * @returns 清理的缓存数量
   *
   * @example
   * await EdgeOneKVCache.clearExpired('douban');
   */
  static async clearExpired(prefix?: string): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      const kv = getEdgeOneKV();
      if (!kv) {
        return 0;
      }

      const namespacedPrefix = prefix ? `cache_${prefix}` : 'cache_';
      let clearedCount = 0;
      let cursor: string | null = null;
      const now = Date.now();
      let result: any;

      // 使用官方 API：list({prefix, limit, cursor})
      // 遍历所有匹配的键
      do {
        result = await kv.list({
          prefix: namespacedPrefix,
          limit: 256,
          cursor: cursor || undefined,
        });

        if (result.keys && result.keys.length > 0) {
          // 检查每个键是否过期
          for (const keyInfo of result.keys) {
            try {
              const value = await kv.get(keyInfo.key, 'json');

              if (value && value.expiry && value.expiry < now) {
                // 已过期，删除
                await kv.delete(keyInfo.key);
                clearedCount++;
              }
            } catch (error) {
              // 忽略单个键的错误
              console.warn(`⚠️ 检查键 ${keyInfo.key} 失败:`, error);
            }
          }
        }

        cursor = result.cursor;
      } while (!result.complete && cursor);

      if (clearedCount > 0) {
        console.log(`🗑️ EdgeOne KV 清理了 ${clearedCount} 个过期缓存项`);
      }

      return clearedCount;
    } catch (error) {
      console.warn('⚠️ EdgeOne KV 清理过期缓存失败:', error);
      return 0;
    }
  }

  /**
   * 获取缓存统计信息
   * @returns 统计信息对象
   *
   * @example
   * const stats = await EdgeOneKVCache.getStats();
   * console.log(stats);
   */
  static async getStats(): Promise<{
    enabled: boolean;
    available: boolean;
    count: number;
    size: number;
    breakdown: Record<string, number>;
  }> {
    if (!this.isAvailable()) {
      return {
        enabled: EDGEONE_KV_ENABLED,
        available: false,
        count: 0,
        size: 0,
        breakdown: {},
      };
    }

    try {
      const kv = getEdgeOneKV();
      if (!kv) {
        return {
          enabled: EDGEONE_KV_ENABLED,
          available: false,
          count: 0,
          size: 0,
          breakdown: {},
        };
      }

      let cursor: string | null = null;
      let totalCount = 0;
      let totalSize = 0;
      const breakdown: Record<string, number> = {};
      let result: any;

      // 使用官方 API：list({prefix, limit, cursor})
      // 遍历所有缓存键
      do {
        result = await kv.list({
          prefix: 'cache_',
          limit: 256,
          cursor: cursor || undefined,
        });

        if (result.keys && result.keys.length > 0) {
          totalCount += result.keys.length;

          for (const keyInfo of result.keys) {
            // 提取原始 key（移除 cache_ 前缀）
            const originalKey = keyInfo.key.replace('cache_', '');

            // 统计不同类型的缓存
            const cacheType = originalKey.split('_')[0] || 'other';
            breakdown[cacheType] = (breakdown[cacheType] || 0) + 1;

            // 估算大小（假设每个键平均 1KB）
            totalSize += 1024;
          }
        }

        cursor = result.cursor;
      } while (!result.complete && cursor);

      return {
        enabled: EDGEONE_KV_ENABLED,
        available: true,
        count: totalCount,
        size: totalSize,
        breakdown,
      };
    } catch (error) {
      console.warn('⚠️ EdgeOne KV 获取统计信息失败:', error);
      return {
        enabled: EDGEONE_KV_ENABLED,
        available: false,
        count: 0,
        size: 0,
        breakdown: {},
      };
    }
  }

  /**
   * 清空所有缓存
   * @returns true 如果成功，false 如果失败
   *
   * @example
   * await EdgeOneKVCache.clearAll();
   */
  static async clearAll(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const kv = getEdgeOneKV();
      if (!kv) {
        return false;
      }

      let cursor: string | null = null;
      let deletedCount = 0;
      let result: any;

      // 使用官方 API：list({prefix, limit, cursor})
      // 遍历并删除所有缓存键
      do {
        result = await kv.list({
          prefix: 'cache_',
          limit: 256,
          cursor: cursor || undefined,
        });

        if (result.keys && result.keys.length > 0) {
          // 批量删除
          for (const keyInfo of result.keys) {
            await kv.delete(keyInfo.key);
            deletedCount++;
          }
        }

        cursor = result.cursor;
      } while (!result.complete && cursor);

      console.log(`🗑️ EdgeOne KV 已清空 ${deletedCount} 个缓存项`);
      return true;
    } catch (error) {
      console.warn('⚠️ EdgeOne KV 清空缓存失败:', error);
      return false;
    }
  }
}

/**
 * 智能缓存包装器
 * 优先使用 EdgeOne KV，失败时回退到 Redis
 *
 * @example
 * const data = await SmartCache.get('my-key', () => db.getCache('my-key'));
 */
export class SmartCache {
  /**
   * 获取缓存（EdgeOne KV -> Redis 回退）
   * @param key - 缓存键
   * @param redisGetFn - Redis 获取函数
   * @returns 缓存数据或 null
   */
  static async get(
    key: string,
    redisGetFn: () => Promise<any>,
  ): Promise<any | null> {
    // 1. 先尝试从 EdgeOne KV 获取
    const edgeOneValue = await EdgeOneKVCache.get(key);
    if (edgeOneValue !== null) {
      return edgeOneValue;
    }

    // 2. EdgeOne KV 未命中，从 Redis 获取
    const redisValue = await redisGetFn();
    if (redisValue !== null) {
      // 3. 将 Redis 数据回写到 EdgeOne KV
      await EdgeOneKVCache.set(key, redisValue);
    }

    return redisValue;
  }

  /**
   * 设置缓存（同时写入 EdgeOne KV 和 Redis）
   * @param key - 缓存键
   * @param data - 缓存数据
   * @param expireSeconds - 过期时间（秒）
   * @param redisSetFn - Redis 设置函数
   */
  static async set(
    key: string,
    data: any,
    expireSeconds: number,
    redisSetFn: (data: any, expireSeconds: number) => Promise<void>,
  ): Promise<void> {
    // 并行写入 EdgeOne KV 和 Redis
    await Promise.all([
      EdgeOneKVCache.set(key, data, expireSeconds),
      redisSetFn(data, expireSeconds),
    ]);
  }

  /**
   * 删除缓存（同时删除 EdgeOne KV 和 Redis）
   * @param key - 缓存键
   * @param redisDeleteFn - Redis 删除函数
   */
  static async delete(
    key: string,
    redisDeleteFn: () => Promise<void>,
  ): Promise<void> {
    // 并行删除 EdgeOne KV 和 Redis
    await Promise.all([EdgeOneKVCache.delete(key), redisDeleteFn()]);
  }
}
