/**
 * 安全守卫 - 安全检查，防止恶意攻击
 */

import {
  LoginCredentials,
  RateLimitEntry,
  RateLimitResult,
  SecurityCheck,
  ValidationResult,
} from '../types';

export class SecurityGuard {
  private rateLimitMap: Map<string, RateLimitEntry> = new Map();
  private readonly WINDOW_SIZE = 15 * 60 * 1000; // 15分钟
  private readonly MAX_ATTEMPTS = 5; // 最多5次尝试

  /**
   * 检查登录安全性
   */
  async checkLogin(credentials: LoginCredentials): Promise<SecurityCheck> {
    // 1. 频率限制检查
    const rateLimitResult = this.checkRateLimit(credentials.username);
    if (!rateLimitResult.allowed) {
      return {
        allowed: false,
        reason: '登录尝试过于频繁，请稍后再试',
      };
    }

    // 2. 输入验证
    const validationResult = this.validateCredentials(credentials);
    if (!validationResult.valid) {
      return {
        allowed: false,
        reason: validationResult.error,
      };
    }

    return { allowed: true };
  }

  /**
   * 检查频率限制
   */
  private checkRateLimit(identifier: string): RateLimitResult {
    const now = Date.now();
    const entry = this.rateLimitMap.get(identifier);

    if (!entry) {
      this.rateLimitMap.set(identifier, {
        attempts: 1,
        windowStart: now,
        lockedUntil: null,
      });
      return { allowed: true };
    }

    // 检查是否在锁定期间
    if (entry.lockedUntil && now < entry.lockedUntil) {
      return {
        allowed: false,
        resetTime: entry.lockedUntil,
      };
    }

    // 检查是否在时间窗口内
    if (now - entry.windowStart > this.WINDOW_SIZE) {
      // 重置窗口
      entry.attempts = 1;
      entry.windowStart = now;
      entry.lockedUntil = null;
      return { allowed: true };
    }

    // 增加尝试次数
    entry.attempts++;

    // 检查是否超过限制
    if (entry.attempts > this.MAX_ATTEMPTS) {
      entry.lockedUntil = now + this.WINDOW_SIZE;
      return {
        allowed: false,
        resetTime: entry.lockedUntil,
      };
    }

    return { allowed: true };
  }

  /**
   * 验证输入凭据
   */
  private validateCredentials(credentials: LoginCredentials): ValidationResult {
    if (!credentials.username || credentials.username.length < 2) {
      return {
        valid: false,
        error: '用户名至少2个字符',
      };
    }

    if (!credentials.password || credentials.password.length < 3) {
      return {
        valid: false,
        error: '密码至少3个字符',
      };
    }

    // 防止SQL注入等攻击
    if (/[<>'"&]/.test(credentials.username + credentials.password)) {
      return {
        valid: false,
        error: '输入包含非法字符',
      };
    }

    return { valid: true };
  }

  /**
   * 重置用户的频率限制
   */
  resetRateLimit(identifier: string): void {
    this.rateLimitMap.delete(identifier);
  }

  /**
   * 获取频率限制状态
   */
  getRateLimitStatus(identifier: string): RateLimitEntry | null {
    return this.rateLimitMap.get(identifier) || null;
  }
}
