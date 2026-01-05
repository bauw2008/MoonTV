/**
 * 缓存管理器 - 管理认证缓存，提升性能
 */

import { AuthUser, CacheEntry, CacheStats } from '../types';

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL = 5 * 60 * 1000; // 5分钟
  private readonly MAX_SIZE = 1000;
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // 定期清理过期缓存
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000); // 每分钟清理一次
  }

  /**
   * 获取缓存的用户信息
   */
  async get(key: string): Promise<AuthUser | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.user;
  }

  /**
   * 缓存用户信息
   */
  async set(key: string, user: AuthUser): Promise<void> {
    // 大小限制
    if (this.cache.size >= this.MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      user,
      expires: Date.now() + this.TTL,
      createdAt: Date.now(),
    });
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires <= now) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`认证缓存清理: 移除 ${cleanedCount} 个过期条目`);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    const now = Date.now();
    let expiredCount = 0;
    let validCount = 0;

    for (const entry of this.cache.values()) {
      if (entry.expires <= now) {
        expiredCount++;
      } else {
        validCount++;
      }
    }

    return {
      total: this.cache.size,
      valid: validCount,
      expired: expiredCount,
    };
  }

  /**
   * 销毁缓存管理器
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}
