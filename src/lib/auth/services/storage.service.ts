/* eslint-disable no-console */

import {
  AuthErrorCode,
  AuthException,
  AuthUser,
  IAuthStorage,
  StorageType,
} from '../types';

/**
 * 内存存储实现（用于开发和测试）
 */
export class MemoryAuthStorage implements IAuthStorage {
  private sessions: Map<
    string,
    { user: AuthUser; expires: number; lastActivity: number }
  >;
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.sessions = new Map();
    // 每小时清理一次过期会话
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  getType(): StorageType {
    return StorageType.LOCAL;
  }

  async setSession(
    sessionId: string,
    user: AuthUser,
    ttl: number = 24 * 60 * 60 * 1000,
  ): Promise<void> {
    const expires = Date.now() + ttl;
    this.sessions.set(sessionId, {
      user: { ...user, lastActivity: Date.now() },
      expires,
      lastActivity: Date.now(),
    });
  }

  async getSession(sessionId: string): Promise<AuthUser | null> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > session.expires) {
      this.sessions.delete(sessionId);
      return null;
    }

    return { ...session.user, lastActivity: Date.now() };
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async removeSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async updateActivity(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      session.user.lastActivity = Date.now();
    }
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    const expiredSessions: string[] = [];

    this.sessions.forEach((session, sessionId) => {
      if (now > session.expires) {
        expiredSessions.push(sessionId);
      }
    });

    expiredSessions.forEach((sessionId) => {
      this.sessions.delete(sessionId);
    });

    if (expiredSessions.length > 0) {
      console.log(`清理了 ${expiredSessions.length} 个过期会话`);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

/**
 * Redis 存储实现 - 使用项目的存储接口
 */
export class RedisAuthStorage implements IAuthStorage {
  private storage: any; // 项目存储实例
  private readonly keyPrefix: string;
  private readonly defaultTTL: number;

  constructor(
    storage: any,
    keyPrefix: string = 'auth:',
    defaultTTL: number = 24 * 60 * 60,
  ) {
    this.storage = storage;
    this.keyPrefix = keyPrefix;
    this.defaultTTL = defaultTTL;
  }

  getType(): StorageType {
    return StorageType.REDIS;
  }

  private getSessionKey(sessionId: string): string {
    return `${this.keyPrefix}session:${sessionId}`;
  }

  private getActivityKey(sessionId: string): string {
    return `${this.keyPrefix}activity:${sessionId}`;
  }

  async setSession(
    sessionId: string,
    user: AuthUser,
    ttl?: number,
  ): Promise<void> {
    try {
      console.log('RedisAuthStorage setSession 开始:', {
        sessionId,
        user: user.username,
        ttl,
      });

      const sessionKey = this.getSessionKey(sessionId);
      const activityKey = this.getActivityKey(sessionId);
      const sessionData = {
        user,
        lastActivity: Date.now(),
      };

      const sessionTTL = Math.floor((ttl || this.defaultTTL) / 1000); // 转换为秒

      console.log('使用项目存储接口存储会话数据:', { sessionKey, sessionTTL });

      // 检查存储方法是否存在
      if (this.storage.setCache) {
        // 使用项目的存储接口存储会话数据
        await this.storage.setCache(
          sessionKey,
          JSON.stringify(sessionData),
          sessionTTL,
        );

        console.log('使用项目存储接口存储活动时间:', {
          activityKey,
          sessionTTL,
        });
        // 使用项目的存储接口存储活动时间
        await this.storage.setCache(
          activityKey,
          Date.now().toString(),
          sessionTTL,
        );
      } else if (this.storage.set) {
        // 备选方案：使用set方法
        await this.storage.set(sessionKey, JSON.stringify(sessionData), {
          EX: sessionTTL,
        });
        await this.storage.set(activityKey, Date.now().toString(), {
          EX: sessionTTL,
        });
      } else {
        throw new Error('存储服务缺少必要的缓存方法');
      }

      console.log('RedisAuthStorage setSession 完成');
    } catch (error) {
      console.error('RedisAuthStorage setSession 错误详情:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        sessionId,
        storageExists: !!this.storage,
      });
      throw new AuthException(
        AuthErrorCode.STORAGE_ERROR,
        'Redis 会话存储失败',
        { error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  async getSession(sessionId: string): Promise<AuthUser | null> {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      let sessionData = null;

      // 检查可用的获取方法
      if (this.storage.getCache) {
        sessionData = await this.storage.getCache(sessionKey);
      } else if (this.storage.get) {
        sessionData = await this.storage.get(sessionKey);
      } else {
        console.error('存储服务缺少获取方法');
        return null;
      }

      if (!sessionData) {
        return null;
      }

      const parsed = JSON.parse(sessionData);
      return {
        ...parsed.user,
        lastActivity: Date.now(), // 更新活动时间
      };
    } catch (error) {
      console.error('Redis 会话获取失败:', error);
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      const activityKey = this.getActivityKey(sessionId);

      // 检查可用的删除方法
      if (this.storage.deleteCache) {
        // 使用项目的 deleteCache 方法
        await this.storage.deleteCache(sessionKey);
        await this.storage.deleteCache(activityKey);
      } else if (this.storage.del) {
        // 备选方案：使用del方法
        await this.storage.del(sessionKey, activityKey);
      } else if (this.storage.delete) {
        // 另一个备选方案：使用delete方法
        await this.storage.delete(sessionKey);
        await this.storage.delete(activityKey);
      } else {
        console.error('存储服务缺少删除方法');
        throw new Error('存储服务缺少必要的删除方法');
      }
    } catch (error) {
      throw new AuthException(
        AuthErrorCode.STORAGE_ERROR,
        'Redis 会话删除失败',
        { error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  async removeSession(sessionId: string): Promise<void> {
    await this.deleteSession(sessionId);
  }

  async updateActivity(sessionId: string): Promise<void> {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      const activityKey = this.getActivityKey(sessionId);
      const sessionTTL = Math.floor(this.defaultTTL / 1000); // 转换为秒

      // 检查可用的方法并更新活动时间
      if (this.storage.setCache) {
        await this.storage.setCache(
          activityKey,
          Date.now().toString(),
          sessionTTL,
        );

        // 获取并更新会话数据
        const sessionData = await this.storage.getCache(sessionKey);
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          parsed.user.lastActivity = Date.now();
          parsed.lastActivity = Date.now();
          await this.storage.setCache(
            sessionKey,
            JSON.stringify(parsed),
            sessionTTL,
          );
        }
      } else if (this.storage.set) {
        // 备选方案：使用set方法
        await this.storage.set(activityKey, Date.now().toString(), {
          EX: sessionTTL,
        });

        const sessionData = await this.storage.get(sessionKey);
        if (sessionData) {
          const parsed = JSON.parse(sessionData);
          parsed.user.lastActivity = Date.now();
          parsed.lastActivity = Date.now();
          await this.storage.set(sessionKey, JSON.stringify(parsed), {
            EX: sessionTTL,
          });
        }
      } else {
        console.error('存储服务缺少更新方法');
      }
    } catch (error) {
      console.error('Redis 活动时间更新失败:', error);
    }
  }

  async cleanup(): Promise<void> {
    // 使用项目的存储接口进行清理
    // 这里可以实现额外的清理逻辑
    try {
      console.log('RedisAuthStorage 清理完成');
    } catch (error) {
      console.error('Redis 清理失败:', error);
    }
  }
}

/**
 * Upstash Redis 存储实现
 */
export class UpstashAuthStorage implements IAuthStorage {
  private redis: any; // Upstash Redis 客户端
  private readonly keyPrefix: string;
  private readonly defaultTTL: number;

  constructor(
    redis: any,
    keyPrefix: string = 'auth:',
    defaultTTL: number = 24 * 60 * 60,
  ) {
    this.redis = redis;
    this.keyPrefix = keyPrefix;
    this.defaultTTL = defaultTTL;
  }

  getType(): StorageType {
    return StorageType.UPSTASH;
  }

  private getSessionKey(sessionId: string): string {
    return `${this.keyPrefix}session:${sessionId}`;
  }

  private getActivityKey(sessionId: string): string {
    return `${this.keyPrefix}activity:${sessionId}`;
  }

  async setSession(
    sessionId: string,
    user: AuthUser,
    ttl?: number,
  ): Promise<void> {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      const activityKey = this.getActivityKey(sessionId);
      const sessionData = {
        user,
        lastActivity: Date.now(),
      };

      const sessionTTL = ttl || this.defaultTTL;

      // Upstash Redis 使用 setex 命令
      await this.redis.setex(
        sessionKey,
        sessionTTL,
        JSON.stringify(sessionData),
      );
      await this.redis.setex(activityKey, sessionTTL, Date.now().toString());
    } catch (error) {
      throw new AuthException(
        AuthErrorCode.STORAGE_ERROR,
        'Upstash 会话存储失败',
        { error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  async getSession(sessionId: string): Promise<AuthUser | null> {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      const sessionData = await this.redis.get(sessionKey);

      if (!sessionData) {
        return null;
      }

      const parsed = JSON.parse(sessionData);
      return {
        ...parsed.user,
        lastActivity: Date.now(),
      };
    } catch (error) {
      console.error('Upstash 会话获取失败:', error);
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      const activityKey = this.getActivityKey(sessionId);

      await this.redis.del(sessionKey, activityKey);
    } catch (error) {
      throw new AuthException(
        AuthErrorCode.STORAGE_ERROR,
        'Upstash 会话删除失败',
        { error: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  async removeSession(sessionId: string): Promise<void> {
    await this.deleteSession(sessionId);
  }

  async updateActivity(sessionId: string): Promise<void> {
    try {
      const sessionKey = this.getSessionKey(sessionId);
      const activityKey = this.getActivityKey(sessionId);

      await this.redis.setex(
        activityKey,
        this.defaultTTL,
        Date.now().toString(),
      );

      const sessionData = await this.redis.get(sessionKey);
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        parsed.user.lastActivity = Date.now();
        parsed.lastActivity = Date.now();
        await this.redis.setex(
          sessionKey,
          this.defaultTTL,
          JSON.stringify(parsed),
        );
      }
    } catch (error) {
      console.error('Upstash 活动时间更新失败:', error);
    }
  }

  async cleanup(): Promise<void> {
    // Upstash Redis 会自动清理过期键
    // 可以实现额外的清理逻辑
  }
}

/**
 * 存储工厂类
 */
export class AuthStorageFactory {
  /**
   * 根据配置创建存储实例
   */
  static createStorage(type: StorageType, options?: any): IAuthStorage {
    switch (type) {
      case StorageType.LOCAL:
        return new MemoryAuthStorage();

      case StorageType.REDIS:
        if (!options?.redis) {
          throw new AuthException(
            AuthErrorCode.VALIDATION_ERROR,
            'Redis 存储需要提供 redis 客户端实例',
          );
        }
        return new RedisAuthStorage(
          options.redis,
          options.keyPrefix,
          options.defaultTTL,
        );

      case StorageType.UPSTASH:
        if (!options?.redis) {
          throw new AuthException(
            AuthErrorCode.VALIDATION_ERROR,
            'Upstash 存储需要提供 redis 客户端实例',
          );
        }
        return new UpstashAuthStorage(
          options.redis,
          options.keyPrefix,
          options.defaultTTL,
        );

      default:
        throw new AuthException(
          AuthErrorCode.VALIDATION_ERROR,
          `不支持的存储类型: ${type}`,
        );
    }
  }

  /**
   * 根据环境变量自动创建存储实例
   */
  static createFromEnv(): IAuthStorage {
    console.log('创建认证存储实例...');
    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
    console.log('存储类型:', storageType);

    try {
      switch (storageType) {
        case 'redis':
        case 'upstash':
        case 'kvrocks': {
          // 动态导入项目的存储实例
          try {
            const { db } = require('@/lib/db');
            const storage = (db as any).storage;

            if (!storage) {
              console.warn('项目存储实例不可用，回退到内存存储');
              return new MemoryAuthStorage();
            }

            console.log('使用项目存储实例进行认证');
            return new RedisAuthStorage(storage);
          } catch (error) {
            console.error('获取项目存储实例失败:', error);
            console.warn('回退到内存存储');
            return new MemoryAuthStorage();
          }
        }

        case 'localstorage':
        default:
          console.log('使用内存存储进行认证');
          return new MemoryAuthStorage();
      }
    } catch (error) {
      console.error('创建存储实例失败，使用内存存储:', error);
      return new MemoryAuthStorage();
    }
  }
}
