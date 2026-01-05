/* eslint-disable no-console */

import { AuthErrorCode, AuthException } from '../types';

/**
 * 认证限流服务
 * 防止暴力破解和恶意攻击
 */
export class AuthRateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxAttempts: number;
  private readonly lockoutDuration: number;
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(
    windowMs: number = 15 * 60 * 1000,
    maxAttempts: number = 5,
    lockoutDuration: number = 15 * 60 * 1000,
  ) {
    this.windowMs = windowMs; // 时间窗口（毫秒）
    this.maxAttempts = maxAttempts; // 最大尝试次数
    this.lockoutDuration = lockoutDuration; // 锁定时长（毫秒）

    // 定期清理过期的尝试记录
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      Math.min(this.windowMs, 60000),
    ); // 最多每分钟清理一次
  }

  /**
   * 检查是否允许认证尝试
   */
  async checkRateLimit(identifier: string): Promise<{
    allowed: boolean;
    remainingAttempts: number;
    resetTime?: number;
  }> {
    const now = Date.now();
    const attempts = this.attempts.get(identifier) || [];

    // 清理过期的尝试记录
    const validAttempts = attempts.filter(
      (timestamp) => now - timestamp < this.windowMs,
    );

    // 检查是否超过限制
    if (validAttempts.length >= this.maxAttempts) {
      const oldestAttempt = Math.min(...validAttempts);
      const resetTime = oldestAttempt + this.windowMs;

      return {
        allowed: false,
        remainingAttempts: 0,
        resetTime,
      };
    }

    // 记录本次尝试
    validAttempts.push(now);
    this.attempts.set(identifier, validAttempts);

    return {
      allowed: true,
      remainingAttempts: this.maxAttempts - validAttempts.length,
    };
  }

  /**
   * 检查是否被锁定
   */
  isLocked(identifier: string): boolean {
    const attempts = this.attempts.get(identifier) || [];
    if (attempts.length < this.maxAttempts) {
      return false;
    }

    const now = Date.now();
    const oldestAttempt = Math.min(...attempts);
    return now - oldestAttempt < this.lockoutDuration;
  }

  /**
   * 获取剩余锁定时间
   */
  getRemainingLockTime(identifier: string): number {
    const attempts = this.attempts.get(identifier) || [];
    if (attempts.length < this.maxAttempts) {
      return 0;
    }

    const now = Date.now();
    const oldestAttempt = Math.min(...attempts);
    const remainingTime = this.lockoutDuration - (now - oldestAttempt);
    return Math.max(0, remainingTime);
  }

  /**
   * 手动重置限制
   */
  resetRateLimit(identifier: string): void {
    this.attempts.delete(identifier);
    console.log('已重置限流:', identifier);
  }

  /**
   * 获取限流统计信息
   */
  getStats(identifier: string): {
    attempts: number;
    remainingAttempts: number;
    isLocked: boolean;
    lockTimeRemaining: number;
  } {
    const attempts = this.attempts.get(identifier) || [];
    const now = Date.now();
    const validAttempts = attempts.filter(
      (timestamp) => now - timestamp < this.windowMs,
    );

    return {
      attempts: validAttempts.length,
      remainingAttempts: Math.max(0, this.maxAttempts - validAttempts.length),
      isLocked: this.isLocked(identifier),
      lockTimeRemaining: this.getRemainingLockTime(identifier),
    };
  }

  /**
   * 清理过期的尝试记录
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [identifier, attempts] of this.attempts.entries()) {
      const validAttempts = attempts.filter(
        (timestamp) => now - timestamp < this.lockoutDuration,
      );

      if (validAttempts.length === 0) {
        this.attempts.delete(identifier);
        cleanedCount++;
      } else if (validAttempts.length !== attempts.length) {
        this.attempts.set(identifier, validAttempts);
      }
    }

    if (cleanedCount > 0) {
      console.log(`清理了 ${cleanedCount} 个过期的限流记录`);
    }
  }

  /**
   * 简单的字符串哈希
   */
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 销毁限流器
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.attempts.clear();
  }

  /**
   * 从请求中提取标识符
   */
  static extractIdentifier(
    ip: string,
    userAgent?: string,
    username?: string,
  ): string {
    // 优先使用用户名，其次使用IP+UserAgent组合
    if (username) {
      return `user:${username}`;
    }

    const uaHash = userAgent
      ? AuthRateLimiter.hashString(userAgent)
      : 'unknown';
    return `ip:${ip}:${uaHash}`;
  }
}

/**
 * 认证限流中间件
 */
export class AuthRateLimitMiddleware {
  private rateLimiter: AuthRateLimiter;

  constructor(
    windowMs?: number,
    maxAttempts?: number,
    lockoutDuration?: number,
  ) {
    this.rateLimiter = new AuthRateLimiter(
      windowMs,
      maxAttempts,
      lockoutDuration,
    );
  }

  /**
   * 检查限流
   */
  async checkLimit(identifier: string): Promise<void> {
    const result = await this.rateLimiter.checkRateLimit(identifier);

    if (!result.allowed) {
      const lockTimeRemaining = Math.ceil(
        this.rateLimiter.getRemainingLockTime(identifier) / 1000 / 60,
      );
      throw new AuthException(
        AuthErrorCode.RATE_LIMIT_EXCEEDED,
        `登录尝试过于频繁，请等待 ${lockTimeRemaining} 分钟后再试`,
        {
          resetTime: result.resetTime,
          lockTimeRemaining: this.rateLimiter.getRemainingLockTime(identifier),
        },
      );
    }
  }

  /**
   * 获取限流统计
   */
  getStats(identifier: string) {
    return this.rateLimiter.getStats(identifier);
  }

  /**
   * 重置限流
   */
  reset(identifier: string): void {
    this.rateLimiter.resetRateLimit(identifier);
  }

  /**
   * 销毁中间件
   */
  destroy(): void {
    this.rateLimiter.destroy();
  }
}
