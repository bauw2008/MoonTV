/**
 * 统一的权限管理工具
 * 基于现有的认证体系
 */

import React from 'react';

import type { AuthUser, UserRole } from '@/lib/auth/types';

import { useAuth } from './AuthProvider';

/**
 * 权限管理器
 */
export class PermissionManager {
  /**
   * 检查用户是否具有指定角色
   */
  static hasRole(user: AuthUser | null | undefined, role: UserRole): boolean {
    return user?.role === role;
  }

  /**
   * 检查用户是否为管理员
   */
  static isAdmin(user: AuthUser | null | undefined): boolean {
    return user?.role === 'admin' || user?.role === 'owner';
  }

  /**
   * 检查用户是否为站长
   */
  static isOwner(user: AuthUser | null | undefined): boolean {
    return user?.role === 'owner';
  }

  /**
   * 检查用户是否为普通用户
   */
  static isUser(user: AuthUser | null | undefined): boolean {
    return user?.role === 'user';
  }

  /**
   * 检查用户是否已认证
   */
  static isAuthenticated(user: AuthUser | null | undefined): boolean {
    return !!user?.username;
  }

  /**
   * 检查用户是否可以管理配置
   */
  static canManageConfig(user: AuthUser | null | undefined): boolean {
    return this.isAuthenticated(user) && !this.isUser(user);
  }

  /**
   * 检查用户是否可以管理用户
   */
  static canManageUsers(user: AuthUser | null | undefined): boolean {
    return this.isOwner(user);
  }

  /**
   * 检查用户是否可以管理系统
   */
  static canManageSystem(user: AuthUser | null | undefined): boolean {
    return this.isOwner(user);
  }

  /**
   * 检查用户是否可以访问所有功能
   */
  static canAccessAllFeatures(user: AuthUser | null | undefined): boolean {
    return this.isOwner(user);
  }

  /**
   * 获取用户权限级别
   */
  static getPermissionLevel(user: AuthUser | null | undefined): number {
    if (!user) return 0;

    switch (user.role) {
      case 'user':
        return 1;
      case 'admin':
        return 2;
      case 'owner':
        return 3;
      default:
        return 0;
    }
  }

  /**
   * 检查权限是否足够
   */
  static hasPermissionLevel(
    user: AuthUser | null | undefined,
    requiredLevel: number,
  ): boolean {
    return this.getPermissionLevel(user) >= requiredLevel;
  }
}

/**
 * 权限配置接口
 */
export interface PermissionConfig {
  role: UserRole | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  isUser: boolean;
  canManageUsers: boolean;
  canManageSystem: boolean;
  canManageConfig: boolean;
  canAccessAllFeatures: boolean;
}

/**
 * 权限 Hook 工具
 */
export function createPermissionHook(useAuth: any) {
  return (): PermissionConfig => {
    const { state: authState } = useAuth();

    return {
      role: authState.user?.role || null,
      isAuthenticated: PermissionManager.isAuthenticated(authState.user),
      isAdmin: PermissionManager.isAdmin(authState.user),
      isOwner: PermissionManager.isOwner(authState.user),
      isUser: PermissionManager.isUser(authState.user),
      canManageUsers: PermissionManager.canManageUsers(authState.user),
      canManageSystem: PermissionManager.canManageSystem(authState.user),
      canManageConfig: PermissionManager.canManageConfig(authState.user),
      canAccessAllFeatures: PermissionManager.canAccessAllFeatures(
        authState.user,
      ),
    };
  };
}

/**
 * 认证守卫工厂
 */
export class AuthGuard {
  /**
   * 创建用户认证守卫
   */
  static user() {
    return (Component: React.ComponentType) => {
      return function AuthGuardedComponent(props: any) {
        const { state: authState } = useAuth();

        if (!PermissionManager.isAuthenticated(authState.user)) {
          return <div>请先登录</div>;
        }

        return <Component {...props} />;
      };
    };
  }

  /**
   * 创建管理员认证守卫
   */
  static admin() {
    return (Component: React.ComponentType) => {
      return function AuthGuardedComponent(props: any) {
        const { state: authState } = useAuth();

        if (!PermissionManager.isAuthenticated(authState.user)) {
          return <div>请先登录</div>;
        }

        if (!PermissionManager.isAdmin(authState.user)) {
          return <div>权限不足</div>;
        }

        return <Component {...props} />;
      };
    };
  }

  /**
   * 创建站长认证守卫
   */
  static owner() {
    return (Component: React.ComponentType) => {
      return function AuthGuardedComponent(props: any) {
        const { state: authState } = useAuth();

        if (!PermissionManager.isAuthenticated(authState.user)) {
          return <div>请先登录</div>;
        }

        if (!PermissionManager.isOwner(authState.user)) {
          return <div>权限不足</div>;
        }

        return <Component {...props} />;
      };
    };
  }
}

// React 组件包装器
function AuthGuardedComponent({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
