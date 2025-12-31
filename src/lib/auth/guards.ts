import { NextRequest, NextResponse } from 'next/server';

import { AuthManager } from './core/auth-manager';

/**
 * 简化的认证守卫工厂
 */
export class AuthGuard {
  private static authManager: AuthManager | null = null;

  private static getAuthManager(): AuthManager {
    if (!AuthGuard.authManager) {
      // 直接获取 AuthManager，它会处理初始化
      AuthGuard.authManager = AuthManager.getInstance();
    }
    return AuthGuard.authManager;
  }

  /**
   * 用户认证守卫
   */
  static user(handler: Function) {
    return async (request: NextRequest, ...args: any[]) => {
      console.log('🔵🔵🔵 AuthGuard.user 被调用:', request.url);
      try {
        console.log('🔵🔵🔵 开始认证...');
        const authManager = await AuthGuard.getAuthManager();
        const authResult = await authManager.authenticate(request);

        console.log('🔵🔵🔵 认证结果:', authResult.success ? '成功' : '失败');

        if (!authResult.success || !authResult.user) {
          console.log('🔵🔵🔵 认证失败，返回401');
          return NextResponse.json({ error: '用户认证失败' }, { status: 401 });
        }

        console.log('🔵🔵🔵 认证成功，调用处理函数');
        return handler(request, { user: authResult.user }, ...args);
      } catch (error) {
        console.error('🔴🔴🔴 AuthGuard.user error:', error);
        return NextResponse.json({ error: '认证服务异常' }, { status: 500 });
      }
    };
  }

  /**
   * 管理员认证守卫
   */
  static admin(handler: Function) {
    return async (request: NextRequest, ...args: any[]) => {
      try {
        const authManager = await AuthGuard.getAuthManager();
        const authResult = await authManager.authenticate(request);

        if (!authResult.success || !authResult.user) {
          return NextResponse.json(
            { error: '管理员认证失败' },
            { status: 401 },
          );
        }

        // 检查是否为管理员
        if (
          authResult.user.role !== 'admin' &&
          authResult.user.role !== 'owner'
        ) {
          return NextResponse.json({ error: '权限不足' }, { status: 403 });
        }

        return handler(request, { user: authResult.user }, ...args);
      } catch (error) {
        console.error('AuthGuard.admin error:', error);
        return NextResponse.json({ error: '认证服务异常' }, { status: 500 });
      }
    };
  }

  /**
   * 站长认证守卫
   */
  static owner(handler: Function) {
    return async (request: NextRequest, ...args: any[]) => {
      try {
        const authManager = await AuthGuard.getAuthManager();
        const authResult = await authManager.authenticate(request);

        if (!authResult.success || !authResult.user) {
          return NextResponse.json({ error: '站长认证失败' }, { status: 401 });
        }

        // 双重验证：检查角色和用户名
        // 防止通过伪造JWT token进行权限提升
        if (
          authResult.user.role !== 'owner' ||
          authResult.user.username !== process.env.USERNAME
        ) {
          console.warn(
            `权限检查失败: 用户 ${authResult.user.username} 尝试访问owner专用功能`,
          );
          return NextResponse.json({ error: '权限不足' }, { status: 403 });
        }

        return handler(request, { user: authResult.user }, ...args);
      } catch (error) {
        console.error('AuthGuard.owner error:', error);
        return NextResponse.json({ error: '认证服务异常' }, { status: 500 });
      }
    };
  }
}
