/* eslint-disable no-console */

import { randomBytes } from 'crypto';
import jwt, { JwtPayload, VerifyOptions } from 'jsonwebtoken';

import { TokenBlacklist } from './blacklist.service';
import {
  AuthErrorCode,
  AuthException,
  AuthUser,
  ITokenService,
  TokenPayload,
} from '../types';

/**
 * 安全的JWT令牌服务实现
 * 使用成熟的jsonwebtoken库替换自定义实现
 */
export class SecureJWTTokenService implements ITokenService {
  private readonly secret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;
  private readonly issuer: string;
  private readonly audience: string;
  private blacklist?: TokenBlacklist;

  constructor(secret?: string, blacklist?: TokenBlacklist) {
    let baseSecret = secret || process.env.PASSWORD || 'default-secret';

    // 始终使用哈希增强密钥强度，确保一致性和安全性
    const crypto = require('crypto');
    // 重复填充密钥直到达到足够长度，然后进行哈希
    let enhancedSecret = baseSecret;
    while (enhancedSecret.length < 32) {
      enhancedSecret += baseSecret;
    }
    // 使用SHA256哈希生成固定长度的强密钥
    this.secret = crypto
      .createHash('sha256')
      .update(enhancedSecret)
      .digest('hex');

    // 只在开发环境显示调试信息
    if (process.env.NODE_ENV === 'development' && baseSecret.length < 32) {
      console.log('JWT密钥已增强为安全的32位哈希值');
    }

    this.accessTokenExpiry = '15m'; // 15分钟
    this.refreshTokenExpiry = '7d'; // 7天
    this.issuer = 'vidora-auth';
    this.audience = 'vidora-users';
    this.blacklist = blacklist;
  }

  /**
   * 生成访问令牌
   */
  async generateAccessToken(user: AuthUser): Promise<string> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const payload: JwtPayload & TokenPayload = {
        sub: user.username,
        role: user.role,
        permissions: user.permissions.map(
          (p) => `${p.resource}:${p.actions.join(',')}`,
        ),
        iat: now,
        sessionId: randomBytes(16).toString('hex'),
        type: 'access',
      };

      const options: any = {
        expiresIn: this.accessTokenExpiry,
        issuer: this.issuer,
        audience: this.audience,
        algorithm: 'HS256',
        keyid: 'access-key-v1',
      };

      return jwt.sign(payload, this.secret, options);
    } catch (error) {
      console.error('JWT令牌生成详细错误:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        secretLength: this.secret.length,
        secretPrefix: this.secret.substring(0, 10) + '...',
      });
      throw new AuthException(AuthErrorCode.STORAGE_ERROR, '访问令牌生成失败', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 验证访问令牌
   */
  async verifyAccessToken(token: string): Promise<AuthUser | null> {
    try {
      // 首先检查令牌是否在黑名单中
      if (this.blacklist) {
        const tokenId = TokenBlacklist.extractTokenId(token);
        if (tokenId && (await this.blacklist.isBlacklisted(tokenId))) {
          console.log('令牌在黑名单中，拒绝访问');
          return null;
        }
      }

      const options: VerifyOptions = {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256'],
        clockTolerance: 30, // 允许30秒的时钟偏差
      };

      const decoded = jwt.verify(token, this.secret, options) as JwtPayload &
        TokenPayload;

      // 验证令牌类型
      if (decoded.type !== 'access') {
        console.warn('令牌类型不匹配，期望access，实际:', decoded.type);
        return null;
      }

      // 重建用户对象
      const user: AuthUser = {
        username: decoded.sub,
        role: decoded.role,
        permissions: decoded.permissions.map((permStr) => {
          const [resource, actionsStr] = permStr.split(':');
          return {
            resource,
            actions: actionsStr.split(','),
          };
        }),
        loginTime: decoded.iat * 1000,
        lastActivity: Date.now(),
      };

      return user;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        console.log('令牌已过期');
        return null;
      } else if (error instanceof jwt.JsonWebTokenError) {
        console.warn('JWT验证失败:', error.message);
        return null;
      } else {
        console.error('令牌验证异常:', error);
        return null;
      }
    }
  }

  /**
   * 生成刷新令牌
   */
  async generateRefreshToken(user: AuthUser): Promise<string> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const payload: JwtPayload = {
        sub: user.username,
        iat: now,
        sessionId: randomBytes(16).toString('hex'),
        type: 'refresh',
      };

      const options: any = {
        expiresIn: this.refreshTokenExpiry,
        issuer: this.issuer,
        audience: this.audience,
        algorithm: 'HS256',
        keyid: 'refresh-key-v1',
      };

      return jwt.sign(payload, this.secret, options);
    } catch (error) {
      throw new AuthException(AuthErrorCode.STORAGE_ERROR, '刷新令牌生成失败', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 刷新访问令牌
   */
  async refreshAccessToken(refreshToken: string): Promise<string | null> {
    try {
      const options: VerifyOptions = {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256'],
        clockTolerance: 30,
      };

      const decoded = jwt.verify(
        refreshToken,
        this.secret,
        options,
      ) as JwtPayload;

      // 验证令牌类型
      if (decoded.type !== 'refresh') {
        console.warn('刷新令牌类型不匹配');
        return null;
      }

      // 创建临时用户对象用于生成新令牌
      const tempUser: AuthUser = {
        username: decoded.sub,
        role: 'user', // 刷新时不需要具体权限
        permissions: [],
        loginTime: decoded.iat * 1000,
        lastActivity: Date.now(),
      };

      return await this.generateAccessToken(tempUser);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        console.log('刷新令牌已过期');
        return null;
      } else {
        console.error('令牌刷新失败:', error);
        return null;
      }
    }
  }

  /**
   * 撤销令牌
   */
  async revokeToken(token: string): Promise<void> {
    try {
      if (!this.blacklist) {
        console.warn('黑名单服务未初始化，无法撤销令牌');
        return;
      }

      const tokenId = TokenBlacklist.extractTokenId(token);
      if (tokenId) {
        await this.blacklist.addToBlacklist(tokenId);
        console.log(
          '令牌已撤销并加入黑名单:',
          tokenId.substring(0, 10) + '...',
        );
      } else {
        console.warn('无法提取令牌ID，撤销失败');
      }
    } catch (error) {
      console.error('令牌撤销失败:', error);
      throw error;
    }
  }

  /**
   * 解析令牌（不验证签名）
   */
  async decodeToken(token: string): Promise<JwtPayload | null> {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch (error) {
      console.error('令牌解析失败:', error);
      return null;
    }
  }

  /**
   * 检查令牌是否即将过期
   */
  async isTokenExpiringSoon(
    token: string,
    thresholdMinutes: number = 5,
  ): Promise<boolean> {
    try {
      const decoded = await this.decodeToken(token);
      if (!decoded || !decoded.exp) {
        return true;
      }

      const now = Math.floor(Date.now() / 1000);
      const threshold = thresholdMinutes * 60;

      return decoded.exp - now <= threshold;
    } catch (error) {
      console.error('检查令牌过期时间失败:', error);
      return true;
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 解析时间字符串为秒数
   */
  private parseTimeToSeconds(timeStr: string): number {
    const units: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
      w: 604800,
    };

    const match = timeStr.match(/^(\d+)([smhdw])$/);
    if (!match) {
      throw new Error(`无效的时间格式: ${timeStr}`);
    }

    const [, amount, unit] = match;
    return parseInt(amount) * units[unit];
  }
}
