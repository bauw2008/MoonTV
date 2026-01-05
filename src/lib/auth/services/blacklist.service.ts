/* eslint-disable no-console */

import { IAuthStorage } from '../types';

/**
 * 令牌黑名单管理服务
 * 用于主动撤销已发放的令牌
 */
export class TokenBlacklist {
  private storage: IAuthStorage;
  private readonly keyPrefix: string;
  private readonly defaultTTL: number;

  constructor(
    storage: IAuthStorage,
    keyPrefix: string = 'blacklist:',
    defaultTTL: number = 7 * 24 * 60 * 60,
  ) {
    this.storage = storage;
    this.keyPrefix = keyPrefix;
    this.defaultTTL = defaultTTL;
  }

  /**
   * 将令牌加入黑名单
   */
  async addToBlacklist(tokenId: string, ttl?: number): Promise<void> {
    try {
      const key = this.getBlacklistKey(tokenId);
      const expiry = ttl || this.defaultTTL;

      // 检查存储类型并使用相应的方法
      const storageType = this.storage.getType();
      if (storageType === 'local') {
        // 内存存储使用setSession
        await this.storage.setSession(
          key,
          {
            username: 'blacklisted',
            role: 'user' as any,
            permissions: [],
            loginTime: Date.now(),
            lastActivity: Date.now(),
            metadata: { blacklisted: true, tokenId },
          },
          expiry * 1000,
        );
      } else {
        // Redis/其他存储使用更直接的方法
        const blacklistData = {
          tokenId,
          blacklisted: true,
          timestamp: Date.now(),
        };

        // 尝试使用存储服务的缓存方法
        if ((this.storage as any).setCache) {
          await (this.storage as any).setCache(
            key,
            JSON.stringify(blacklistData),
            expiry,
          );
        } else {
          // 回退到setSession
          await this.storage.setSession(
            key,
            {
              username: 'blacklisted',
              role: 'user' as any,
              permissions: [],
              loginTime: Date.now(),
              lastActivity: Date.now(),
              metadata: { blacklisted: true, tokenId },
            },
            expiry * 1000,
          );
        }
      }

      console.log('令牌已加入黑名单:', tokenId.substring(0, 10) + '...');
    } catch (error) {
      console.error('添加令牌到黑名单失败:', error);
      throw error;
    }
  }

  /**
   * 检查令牌是否在黑名单中
   */
  async isBlacklisted(tokenId: string): Promise<boolean> {
    try {
      const key = this.getBlacklistKey(tokenId);
      const storageType = this.storage.getType();

      let result = false;

      if (storageType === 'local') {
        // 内存存储使用getSession
        const user = await this.storage.getSession(key);
        result = !!(user && user.metadata?.blacklisted);
      } else {
        // Redis/其他存储使用缓存方法
        try {
          if ((this.storage as any).getCache) {
            const data = await (this.storage as any).getCache(key);
            if (data) {
              const blacklistData = JSON.parse(data);
              result = !!blacklistData.blacklisted;
            }
          } else {
            // 回退到getSession
            const user = await this.storage.getSession(key);
            result = !!(user && user.metadata?.blacklisted);
          }
        } catch (parseError) {
          // 解析失败，认为不在黑名单中
          result = false;
        }
      }

      return result;
    } catch (error) {
      console.error('检查令牌黑名单失败:', error);
      // 出错时保守处理，认为令牌可能被黑名单
      return true;
    }
  }

  /**
   * 从黑名单中移除令牌
   */
  async removeFromBlacklist(tokenId: string): Promise<void> {
    try {
      const key = this.getBlacklistKey(tokenId);
      const storageType = this.storage.getType();

      if (storageType === 'local') {
        // 内存存储使用deleteSession
        await this.storage.deleteSession(key);
      } else {
        // Redis/其他存储使用缓存方法
        if ((this.storage as any).deleteCache) {
          await (this.storage as any).deleteCache(key);
        } else {
          // 回退到deleteSession
          await this.storage.deleteSession(key);
        }
      }

      console.log('令牌已从黑名单移除:', tokenId.substring(0, 10) + '...');
    } catch (error) {
      console.error('从黑名单移除令牌失败:', error);
      throw error;
    }
  }

  /**
   * 清理过期的黑名单记录
   */
  async cleanup(): Promise<void> {
    try {
      await this.storage.cleanup();
      console.log('令牌黑名单清理完成');
    } catch (error) {
      console.error('清理令牌黑名单失败:', error);
    }
  }

  /**
   * 批量将令牌加入黑名单
   */
  async addToBlacklistBatch(tokenIds: string[], ttl?: number): Promise<void> {
    const promises = tokenIds.map((tokenId) =>
      this.addToBlacklist(tokenId, ttl),
    );
    await Promise.all(promises);
    console.log(`批量添加 ${tokenIds.length} 个令牌到黑名单`);
  }

  /**
   * 获取黑名单统计信息
   */
  async getBlacklistStats(): Promise<{ total: number; expired: number }> {
    // 这里简化实现，实际应用中可能需要更复杂的统计逻辑
    return {
      total: 0,
      expired: 0,
    };
  }

  /**
   * 生成黑名单键
   */
  private getBlacklistKey(tokenId: string): string {
    return `${this.keyPrefix}${tokenId}`;
  }

  /**
   * 从JWT令牌中提取jti（JWT ID）或sessionId
   */
  static extractTokenId(token: string): string | null {
    try {
      // 简单的JWT解析，不验证签名
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

      // 优先使用sessionId，其次使用jti，最后使用sub+exp组合
      return (
        payload.sessionId || payload.jti || `${payload.sub}-${payload.exp}`
      );
    } catch (error) {
      console.error('提取令牌ID失败:', error);
      return null;
    }
  }
}
