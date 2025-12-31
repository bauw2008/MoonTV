/**
 * Vidora 认证框架入口
 */

import { AuthManager } from './core/auth-manager';
import { FrameworkStatus } from './types';

export class VidoraAuthFramework {
  private static instance: VidoraAuthFramework;
  private authManager: AuthManager;
  private initialized: boolean = false;

  static getInstance(): VidoraAuthFramework {
    if (!VidoraAuthFramework.instance) {
      VidoraAuthFramework.instance = new VidoraAuthFramework();
    }
    return VidoraAuthFramework.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.authManager = AuthManager.getInstance();
    this.initialized = true;
  }

  getAuthManager(): AuthManager {
    if (!this.initialized) {
      throw new Error('Framework not initialized. Call initialize() first.');
    }
    return this.authManager;
  }

  getStatus(): FrameworkStatus {
    return {
      initialized: this.initialized,
      timestamp: Date.now(),
    };
  }
}

export const authFramework = VidoraAuthFramework.getInstance();

// 导出核心类和服务
export { AuthManager } from './core/auth-manager';
export { CacheManager } from './core/cache-manager';
export { SecurityGuard } from './core/security-guard';
export { TokenService } from './services/token.service';

// 导出客户端
export { AuthProvider, useAuth } from '../../components/auth/AuthProvider';

// 导出认证守卫
export { AuthGuard } from './guards';

// 导出权限管理
export {
  AuthGuard as AuthGuardClass,
  PermissionManager,
} from '../../components/auth/AuthPermissions';
export { createPermissionHook } from '../../components/auth/AuthPermissions';

// 导出类型
export type {
  AuthLevel,
  AuthResult,
  AuthUser,
  CacheEntry,
  CacheStats,
  ClientAuthState,
  FrameworkStatus,
  LoginCredentials,
  LoginResult,
  PerformanceMetrics,
  SecurityCheck,
  TokenPair,
  TVBoxPermissions,
  TVBoxUser,
  UserRole,
} from './types';

// 导出枚举和类
export { AuthErrorCode, AuthException } from './types';

// 导出安全相关函数
export function getSecurityStats() {
  const authManager = authFramework.getAuthManager();
  return (authManager as any).getSecurityStats?.() || {};
}

export function resetUserRateLimit(identifier: string) {
  const authManager = authFramework.getAuthManager();
  return (authManager as any).resetUserRateLimit?.(identifier);
}
