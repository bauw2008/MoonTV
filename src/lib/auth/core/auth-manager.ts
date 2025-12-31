/**
 * 认证管理器 - 统一的认证入口，管理整个认证流程
 */

import { NextRequest } from 'next/server';

import { CacheManager } from './cache-manager';
import { SecurityGuard } from './security-guard';
import { TokenService } from '../services/token.service';
import {
  AuthResult,
  AuthUser,
  LoginCredentials,
  LoginResult,
  TokenPair,
} from '../types';

// 统一导入避免重复动态导入
let _configModule: any = null;
let _dbModule: any = null;

const getConfig = async () => {
  if (!_configModule) {
    _configModule = await import('@/lib/config');
  }
  return _configModule;
};

const getDb = async () => {
  if (!_dbModule) {
    _dbModule = await import('@/lib/db');
  }
  return _dbModule;
};

export class AuthManager {
  private static instance: AuthManager;
  private tokenService: TokenService;
  private cacheManager: CacheManager;
  private securityGuard: SecurityGuard;

  private constructor() {
    this.tokenService = new TokenService();
    this.cacheManager = new CacheManager();
    this.securityGuard = new SecurityGuard();
  }

  /**
   * 单例模式，确保全局唯一
   */
  static getInstance(): AuthManager {
    if (!AuthManager.instance) {
      AuthManager.instance = new AuthManager();
    }
    return AuthManager.instance;
  }

  /**
   * 核心认证方法 - 简单直接
   */
  async authenticate(request: NextRequest): Promise<AuthResult> {
    try {
      // 1. 提取Token
      const token = this.extractToken(request);
      if (!token) return this.unauthorized();

      // 2. 检查缓存
      const cached = await this.cacheManager.get(token);
      if (cached) return this.success(cached);

      // 3. 验证Token
      const user = await this.tokenService.verify(token);
      if (!user) {
        // 站长特殊认证：如果JWT验证失败，检查是否为站长初始设置场景
        const ownerUser = await this.tryOwnerAuth(request, token);
        if (ownerUser) {
          await this.cacheManager.set(token, ownerUser);
          return this.success(ownerUser);
        }
        return this.unauthorized();
      }

      // 4. 缓存结果
      await this.cacheManager.set(token, user);

      return this.success(user);
    } catch (error) {
      console.error('认证失败:', error);

      // 站长特殊认证：在异常情况下也尝试站长认证
      if (process.env.USERNAME) {
        const ownerUser = await this.tryOwnerAuth(
          request,
          this.extractToken(request) || '',
        );
        if (ownerUser) {
          return this.success(ownerUser);
        }
      }

      return this.unauthorized();
    }
  }

  /**
   * 登录方法
   */
  async login(credentials: LoginCredentials): Promise<LoginResult> {
    try {
      // 1. 安全检查
      const securityCheck = await this.securityGuard.checkLogin(credentials);
      if (!securityCheck.allowed) {
        return this.failure(securityCheck.reason || '安全检查失败');
      }

      // 2. 验证用户
      const user = await this.validateUser(credentials);
      if (!user) return this.failure('用户名或密码错误');

      // 3. 更新最后登录时间
      await this.updateLastLogin(user.username);

      // 4. 生成Token
      const tokens = await this.tokenService.generate(user);

      // 4. 缓存用户信息
      await this.cacheManager.set(tokens.accessToken, user);

      // 5. 重置频率限制
      this.securityGuard.resetRateLimit(credentials.username);

      return this.success(user, tokens);
    } catch (error) {
      console.error('登录失败:', error);
      return this.failure('服务器内部错误');
    }
  }

  /**
   * 注册方法
   */
  async register(credentials: {
    username: string;
    password: string;
    confirmPassword: string;
    reason?: string;
  }): Promise<any> {
    try {
      const { username, password, confirmPassword, reason } = credentials;

      // 基本验证
      if (!username || !password || !confirmPassword) {
        return { success: false, error: '用户名、密码和确认密码不能为空' };
      }

      if (password !== confirmPassword) {
        return { success: false, error: '两次输入的密码不一致' };
      }

      // 检查是否允许注册
      const configModule = await getConfig();
      const config = await configModule.getAdminConfig();

      if (!config.UserConfig?.AllowRegister) {
        return { success: false, error: '管理员已关闭用户注册功能' };
      }

      // localStorage模式不支持注册
      if (process.env.NEXT_PUBLIC_STORAGE_TYPE === 'localstorage') {
        return { success: false, error: 'localStorage 模式不支持用户注册' };
      }

      // 检查用户名是否已存在
      const dbModule = await getDb();

      // 先检查用户密码是否存在（间接判断用户是否存在）
      const userPassword = await dbModule.db.getUserPassword?.(username);
      if (userPassword) {
        return { success: false, error: '用户名已存在' };
      }

      // 如果需要审批，添加到待审核列表
      if (config.UserConfig.RequireApproval) {
        const { SimpleCrypto } = await import('@/lib/crypto');
        const secret = process.env.Password || 'site-secret';
        const encryptedPassword = SimpleCrypto.encrypt(password, secret);

        // 获取当前配置并添加到待审核列表
        const configModule = await getConfig();
        const dbModule = await getDb();
        const adminConfig = await configModule.getAdminConfig();

        if (!adminConfig.UserConfig.PendingUsers) {
          adminConfig.UserConfig.PendingUsers = [];
        }

        adminConfig.UserConfig.PendingUsers.push({
          username,
          reason: reason || '',
          encryptedPassword,
          appliedAt: new Date().toISOString(),
        });

        await dbModule.db.saveAdminConfig(adminConfig);

        return {
          success: true,
          pending: true,
          message: '已提交注册申请，等待管理员审核',
          user: { username, role: 'user' },
        };
      }

      // 自动激活，直接创建用户
      await dbModule.db.registerUser(username, password);

      // 同时更新配置文件的Users数组
      const adminConfig = await configModule.getAdminConfig();

      if (!adminConfig.UserConfig.Users) {
        adminConfig.UserConfig.Users = [];
      }

      // 检查用户是否已在配置中
      const userInConfig = adminConfig.UserConfig.Users.find(
        (u) => u.username === username,
      );
      if (!userInConfig) {
        adminConfig.UserConfig.Users.push({
          username,
          role: 'user',
          enabled: true,
          banned: false,
          enabledApis: [],
          tags: [],
          createdAt: Date.now(),
        });
        await dbModule.db.saveAdminConfig(adminConfig);
        console.log('注册用户已添加到配置文件:', username);
      }

      if (!adminConfig.UserConfig.Users) {
        adminConfig.UserConfig.Users = [];
      }

      // 检查用户是否已在配置中
      const existingUser = adminConfig.UserConfig.Users.find(
        (u) => u.username === username,
      );
      if (!existingUser) {
        adminConfig.UserConfig.Users.push({
          username,
          role: 'user',
          enabled: true,
          banned: false,
          enabledApis: [],
          tags: [],
          createdAt: Date.now(),
        });
        await dbModule.db.saveAdminConfig(adminConfig);
        console.log('注册用户已添加到配置文件:', username);
      }

      // 直接登录
      const loginResult = await this.login({ username, password });
      return loginResult;
    } catch (error) {
      console.error('注册失败:', error);
      return { success: false, error: '注册失败: ' + (error as Error).message };
    }
  }

  /**
   * 注销方法
   */
  async logout(request: NextRequest): Promise<void> {
    try {
      const token = this.extractToken(request);
      if (token) {
        await this.cacheManager.delete(token);
      }
    } catch (error) {
      console.error('注销失败:', error);
    }
  }

  /**
   * 提取Token
   */
  private extractToken(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // 从Cookie获取
    const accessToken = request.cookies.get('accessToken')?.value;
    if (accessToken) {
      return accessToken;
    }

    return null;
  }

  /**
   * 验证用户
   */
  private async validateUser(
    credentials: LoginCredentials,
  ): Promise<AuthUser | null> {
    const { username, password } = credentials;

    // localStorage模式的验证逻辑
    if (process.env.NEXT_PUBLIC_STORAGE_TYPE === 'localstorage') {
      // 检查站长身份
      if (
        username === process.env.USERNAME &&
        password === process.env.PASSWORD
      ) {
        console.log(`localStorage模式：站长用户验证成功 - ${username}`);
        return {
          username,
          role: 'owner',
          lastActivity: Date.now(),
        };
      }

      // 普通用户验证
      if (process.env.PASSWORD && password === process.env.PASSWORD) {
        console.log('localStorage模式：普通用户验证成功');
        return {
          username,
          role: 'user',
          lastActivity: Date.now(),
        };
      }

      return null;
    }

    // 数据库用户（如果配置了数据库）
    if (process.env.NEXT_PUBLIC_STORAGE_TYPE !== 'localstorage') {
      try {
        const dbUser = await this.validateDatabaseUser(credentials);
        if (dbUser) {
          return dbUser;
        }
      } catch (error) {
        console.error('数据库用户验证失败:', error);
      }

      // 如果数据库验证失败，回退到环境变量验证（兼容性）
      // 注意：这种回退方式不太安全，建议后续移除
      if (process.env.PASSWORD && password === process.env.PASSWORD) {
        console.log('数据库验证失败，使用环境变量验证');
        return {
          username,
          role: 'user',
          lastActivity: Date.now(),
        };
      }

      return null;
    }

    return null;
  }

  /**
   * 验证数据库用户
   */
  private async validateDatabaseUser(
    credentials: LoginCredentials,
  ): Promise<AuthUser | null> {
    try {
      const { username, password } = credentials;

      // 优先检查站长身份（环境变量中的USERNAME）
      if (
        username === process.env.USERNAME &&
        password === process.env.PASSWORD
      ) {
        console.log(`数据库模式：站长用户验证成功 - ${username}`);
        return {
          username,
          role: 'owner',
          lastActivity: Date.now(),
        };
      }

      // 动态导入数据库模块
      const dbModule = await getDb();

      // 验证用户密码
      const isValid = await dbModule.db.verifyUser(username, password);

      if (!isValid) {
        return null;
      }

      // 获取用户信息
      const userConfig = await this.getUserConfig(username);

      return {
        username,
        role: userConfig.role || 'user',
        lastActivity: Date.now(),
      };
    } catch (error) {
      console.error('数据库用户验证失败:', error);
      return null;
    }
  }

  /**
   * 获取用户配置
   */
  private async getUserConfig(username: string): Promise<any> {
    try {
      console.log(`getUserConfig 被调用，用户名: ${username}`);
      console.log(`环境变量 USERNAME: ${process.env.USERNAME}`);

      // 优先检查站长身份（环境变量中的USERNAME）
      if (username === process.env.USERNAME) {
        console.log(`检测到站长用户: ${username}`);
        return {
          role: 'owner',
          permissions: ['all'],
        };
      }

      // 从配置文件获取用户信息
      const config = await getConfig();

      console.log('完整配置:', {
        hasUserConfig: !!config.UserConfig,
        users: config.UserConfig?.Users,
        username: username,
      });

      const user = config.UserConfig?.Users?.find(
        (u: any) => u.username === username,
      );

      console.log('找到的用户:', user);

      if (user) {
        return {
          role: user.role || 'user',
          permissions: user.permissions || [],
        };
      }

      console.log('未找到用户，使用默认角色 user');
      // 默认用户配置
      return { role: 'user' };
    } catch (error) {
      console.error('获取用户配置失败:', error);
      return { role: 'user' };
    }
  }

  /**
   * 成功结果
   */
  private success(user: AuthUser, tokens?: TokenPair): LoginResult {
    return {
      success: true,
      user,
      tokens: tokens || null,
      error: null,
    };
  }

  /**
   * 失败结果
   */
  private failure(message: string): LoginResult {
    return {
      success: false,
      user: null,
      tokens: null,
      error: message,
    };
  }

  /**
   * 站长特殊认证 - 用于初始设置JWT密钥
   */
  private async tryOwnerAuth(
    request: NextRequest,
    token: string,
  ): Promise<AuthUser | null> {
    try {
      // 检查是否为站长初始设置场景
      if (!process.env.USERNAME) {
        return null;
      }

      // 检查JWT密钥长度，只有短密钥时才允许特殊认证
      const secret = this.tokenService.getSecret();
      if (secret.length >= 32) {
        return null; // 正常JWT密钥，不需要特殊认证
      }

      // 从token中提取用户信息（简单的base64解码）
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        if (
          decoded.username === process.env.USERNAME &&
          decoded.password === process.env.PASSWORD
        ) {
          console.log(`站长特殊认证成功: ${decoded.username}`);
          return {
            username: decoded.username,
            role: 'owner',
            lastActivity: Date.now(),
          };
        }
      } catch (decodeError) {
        // 如果不是base64格式，检查是否为直接的用户名:密码格式
        if (token === `${process.env.USERNAME}:${process.env.PASSWORD}`) {
          console.log(`站长特殊认证成功（简单模式）`);
          return {
            username: process.env.USERNAME,
            role: 'owner',
            lastActivity: Date.now(),
          };
        }
      }

      return null;
    } catch (error) {
      console.error('站长特殊认证失败:', error);
      return null;
    }
  }

  /**
   * 更新用户最后登录时间
   */
  private async updateLastLogin(username: string): Promise<void> {
    try {
      // 跳过站长用户（环境变量中的用户）
      if (username === process.env.USERNAME) {
        return;
      }

      const config = await getConfig();
      const dbModule = await getDb();

      // 更新数据库中的最后登录时间
      try {
        await dbModule.db.updateUserLastLogin(username, Date.now());
      } catch (error) {
        console.warn('更新数据库最后登录时间失败:', error);
      }

      // 更新配置文件中的最后登录时间
      const adminConfig = await config.getAdminConfig();
      const user = adminConfig.UserConfig.Users.find(
        (u) => u.username === username,
      );
      if (user) {
        user.lastLoginAt = Date.now();
        await dbModule.db.saveAdminConfig(adminConfig);
      }
    } catch (error) {
      console.error('更新最后登录时间失败:', error);
    }
  }

  /**
   * 未授权结果
   */
  private unauthorized(): AuthResult {
    return {
      success: false,
      error: '未授权访问',
    };
  }
}
