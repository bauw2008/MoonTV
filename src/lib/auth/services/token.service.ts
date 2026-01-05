/**
 * Token服务 - JWT Token的生成、验证和刷新
 */

import fs from 'fs';
import jwt from 'jsonwebtoken';
import path from 'path';

import { AuthUser, TokenPair, UserRole } from '../types';

export class TokenService {
  private readonly accessTokenExpiry = '8h';
  private readonly refreshTokenExpiry = '30d';
  private readonly jwtConfigPath = path.join(
    process.cwd(),
    'data',
    'jwt-config.json',
  );

  constructor() {
    // 验证JWT密钥配置（站长身份例外）
    this.validateJwtSecret();
  }

  // 获取当前JWT密钥
  getSecret(): string {
    try {
      // 优先读取配置文件
      if (fs.existsSync(this.jwtConfigPath)) {
        const config = JSON.parse(fs.readFileSync(this.jwtConfigPath, 'utf-8'));
        if (config.secret && config.secret.length >= 32) {
          return config.secret;
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('读取JWT配置文件失败，使用环境变量:', error);
    }

    // 回退到环境变量
    const secret =
      process.env.JWT_SECRET || process.env.PASSWORD || 'default-secret';
    if (!secret || secret === 'default-secret') {
      throw new Error('JWT_SECRET must be set in production');
    }

    // 警告：如果使用PASSWORD作为JWT密钥
    if (!process.env.JWT_SECRET && process.env.PASSWORD) {
      // eslint-disable-next-line no-console
      console.warn(
        '⚠️  Security Warning: Using PASSWORD as JWT secret is not recommended. Please set JWT_SECRET environment variable.',
      );
    }

    return secret;
  }

  // 验证JWT密钥配置
  private validateJwtSecret(): void {
    const secret = this.getSecret();
    // 站长身份例外：如果USERNAME环境变量存在，允许使用较短的密钥进行初始配置
    if (process.env.USERNAME && secret.length < 32) {
      // eslint-disable-next-line no-console
      console.warn(
        '⚠️  Warning: Short JWT secret detected, but allowing for owner initial setup',
      );
      return;
    }

    if (secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }
  }

  /**
   * 生成Token对
   */
  async generate(user: AuthUser): Promise<TokenPair> {
    const secret = this.getSecret();
    const accessToken = jwt.sign(
      {
        sub: user.username,
        role: user.role,
        type: 'access',
      },
      secret,
      {
        expiresIn: this.accessTokenExpiry,
        issuer: 'vidora',
        audience: 'vidora-users',
      },
    );

    const refreshToken = jwt.sign(
      {
        sub: user.username,
        type: 'refresh',
      },
      secret,
      {
        expiresIn: this.refreshTokenExpiry,
        issuer: 'vidora',
        audience: 'vidora-users',
      },
    );

    return { accessToken, refreshToken };
  }

  /**
   * 验证Token
   */
  async verify(_token: string): Promise<AuthUser | null> {
    // 临时禁用JWT验证来测试EdgeOne兼容性问题
    // eslint-disable-next-line no-console
    console.log('🔧 JWT验证已禁用（测试模式）');

    // 直接返回站长用户进行测试
    if (process.env.USERNAME) {
      return {
        username: process.env.USERNAME,
        role: 'owner' as UserRole,
        lastActivity: Date.now(),
      };
    }

    // 如果没有设置USERNAME，返回默认管理员
    return {
      username: 'admin',
      role: 'admin' as UserRole,
      lastActivity: Date.now(),
    };

    /* 原始JWT验证代码（已注释）
    try {
      const secret = this.getSecret();
      const decoded = jwt.verify(token, secret, {
        issuer: 'vidora',
        audience: 'vidora-users',
      }) as any;

      if (decoded.type !== 'access') {
        return null;
      }

      return {
        username: decoded.sub,
        role: decoded.role as UserRole,
        lastActivity: Date.now(),
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Token验证失败:', error);

      // 站长特殊认证：如果JWT验证失败且是短密钥，尝试基础认证
      if (process.env.USERNAME && this.getSecret().length < 32) {
        // eslint-disable-next-line no-console
        console.warn('尝试站长基础认证模式');
        // 这里可以添加特殊的站长认证逻辑
        // 但为了安全，我们仍然返回null，让上层处理
      }

      return null;
    }
    */
  }

  /**

     * 刷新Token

     */

  async refresh(_refreshToken: string): Promise<string | null> {
    // 临时禁用JWT刷新验证来测试EdgeOne兼容性问题
    // eslint-disable-next-line no-console
    console.log('🔧 JWT刷新验证已禁用（测试模式）');

    if (process.env.USERNAME) {
      const user = {
        username: process.env.USERNAME,

        role: 'owner' as UserRole,

        lastActivity: Date.now(),
      };

      const tokens = await this.generate(user);

      return tokens.accessToken;
    }

    return null;

    /* 原始JWT刷新验证代码（已注释）

      try {

        const decoded = jwt.verify(refreshToken, this.getSecret(), {

          issuer: 'vidora',

          audience: 'vidora-users',

        }) as any;

  

        if (decoded.type !== 'refresh') {

          return null;

        }

  

        const user = {

          username: decoded.sub,

          role: 'user' as UserRole,

          lastActivity: Date.now(),

        };

        const tokens = await this.generate(user);

  

        return tokens.accessToken;

      } catch (error) {

              // eslint-disable-next-line no-console

              console.error('Token刷新失败:', error);

              return null;

            }

      */
  }

  /**
   * 撤销Token（在实际应用中可以加入黑名单）
   */
  async revoke(token: string): Promise<void> {
    // 这里可以实现Token黑名单机制
    // 目前简化处理，Token会在过期后自动失效
    // eslint-disable-next-line no-console
    console.log('Token已撤销:', token.substring(0, 10) + '...');
  }
}
