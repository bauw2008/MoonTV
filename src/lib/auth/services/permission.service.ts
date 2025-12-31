import {
  AuthUser,
  IPermissionService,
  Permission,
  PermissionAction,
  UserRole,
} from '../types';

/**
 * 基于角色的权限服务实现
 */
export class RBACPermissionService implements IPermissionService {
  private readonly rolePermissions: Map<UserRole, Permission[]>;
  private readonly userSpecificPermissions: Map<string, Permission[]>;

  constructor() {
    this.rolePermissions = new Map();
    this.userSpecificPermissions = new Map();
    this.initializeDefaultPermissions();
  }

  /**
   * 检查用户权限
   */
  hasPermission(
    user: AuthUser,
    resource: string,
    action: PermissionAction,
  ): boolean {
    // 1. 检查用户特定权限
    const userPermissions = this.getUserPermissions(user);

    // 2. 检查是否有匹配的权限
    return userPermissions.some((permission) => {
      if (permission.resource !== resource) {
        return false;
      }

      // 检查是否包含所需动作
      if (permission.actions.includes(action)) {
        return true;
      }

      // 检查通配符权限
      if (permission.actions.includes(PermissionAction.MANAGE)) {
        return true;
      }

      // 检查权限条件
      if (permission.conditions) {
        return this.evaluateConditions(
          permission.conditions,
          user,
          resource,
          action,
        );
      }

      return false;
    });
  }

  /**
   * 获取用户所有权限
   */
  getUserPermissions(user: AuthUser): Permission[] {
    const permissions: Permission[] = [];

    // 1. 添加角色权限
    const rolePerms = this.rolePermissions.get(user.role) || [];
    permissions.push(...rolePerms);

    // 2. 添加用户特定权限
    const userPerms = this.userSpecificPermissions.get(user.username) || [];
    permissions.push(...userPerms);

    // 3. 去重并合并权限
    return this.mergePermissions(permissions);
  }

  /**
   * 添加用户权限
   */
  async addPermission(user: AuthUser, permission: Permission): Promise<void> {
    const username = user.username;
    const currentPermissions = this.userSpecificPermissions.get(username) || [];

    // 检查是否已存在相同权限
    const existingIndex = currentPermissions.findIndex(
      (p) => p.resource === permission.resource,
    );

    if (existingIndex >= 0) {
      // 合并权限动作
      const existing = currentPermissions[existingIndex];
      existing.actions = [
        ...new Set([...existing.actions, ...permission.actions]),
      ];
      existing.conditions = {
        ...existing.conditions,
        ...permission.conditions,
      };
    } else {
      // 添加新权限
      currentPermissions.push(permission);
    }

    this.userSpecificPermissions.set(username, currentPermissions);
  }

  /**
   * 移除用户权限
   */
  async removePermission(
    user: AuthUser,
    resource: string,
    action: PermissionAction,
  ): Promise<void> {
    const username = user.username;
    const currentPermissions = this.userSpecificPermissions.get(username) || [];

    const filteredPermissions = currentPermissions
      .map((permission) => {
        if (permission.resource !== resource) {
          return permission;
        }

        // 移除指定动作
        const updatedActions = permission.actions.filter((a) => a !== action);

        // 如果没有动作了，移除整个权限
        if (updatedActions.length === 0) {
          return null;
        }

        return {
          ...permission,
          actions: updatedActions,
        };
      })
      .filter(Boolean) as Permission[];

    this.userSpecificPermissions.set(username, filteredPermissions);
  }

  /**
   * 批量设置用户权限
   */
  async setUserPermissions(
    username: string,
    permissions: Permission[],
  ): Promise<void> {
    this.userSpecificPermissions.set(username, [...permissions]);
  }

  /**
   * 检查用户是否为管理员
   */
  isAdmin(user: AuthUser): boolean {
    return user.role === 'admin' || user.role === 'owner';
  }

  /**
   * 检查用户是否为超级管理员
   */
  isOwner(user: AuthUser): boolean {
    return user.role === 'owner';
  }

  // ==================== 私有方法 ====================

  /**
   * 初始化默认权限配置
   */
  private initializeDefaultPermissions(): void {
    // 超级管理员权限
    this.rolePermissions.set('owner', [
      {
        resource: '*',
        actions: [PermissionAction.MANAGE],
      },
    ]);

    // 管理员权限
    this.rolePermissions.set('admin', [
      {
        resource: 'admin:*',
        actions: [PermissionAction.READ, PermissionAction.WRITE],
      },
      {
        resource: 'user:*',
        actions: [
          PermissionAction.READ,
          PermissionAction.WRITE,
          PermissionAction.DELETE,
        ],
      },
      {
        resource: 'config:*',
        actions: [PermissionAction.READ, PermissionAction.WRITE],
      },
      {
        resource: 'source:*',
        actions: [
          PermissionAction.READ,
          PermissionAction.WRITE,
          PermissionAction.DELETE,
        ],
      },
      {
        resource: 'cache:*',
        actions: [
          PermissionAction.READ,
          PermissionAction.WRITE,
          PermissionAction.DELETE,
        ],
      },
    ]);

    // 普通用户权限
    this.rolePermissions.set('user', [
      {
        resource: 'video:*',
        actions: [PermissionAction.READ],
      },
      {
        resource: 'search:*',
        actions: [PermissionAction.READ],
      },
      {
        resource: 'favorites:*',
        actions: [
          PermissionAction.READ,
          PermissionAction.WRITE,
          PermissionAction.DELETE,
        ],
      },
      {
        resource: 'playrecords:*',
        actions: [
          PermissionAction.READ,
          PermissionAction.WRITE,
          PermissionAction.DELETE,
        ],
      },
      {
        resource: 'profile:*',
        actions: [PermissionAction.READ, PermissionAction.WRITE],
      },
    ]);
  }

  /**
   * 合并权限列表
   */
  private mergePermissions(permissions: Permission[]): Permission[] {
    const merged = new Map<string, Permission>();

    permissions.forEach((permission) => {
      const key = permission.resource;
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, { ...permission });
        return;
      }

      // 合并动作
      existing.actions = [
        ...new Set([...existing.actions, ...permission.actions]),
      ];

      // 合并条件
      if (permission.conditions) {
        existing.conditions = {
          ...existing.conditions,
          ...permission.conditions,
        };
      }
    });

    return Array.from(merged.values());
  }

  /**
   * 评估权限条件
   */
  private evaluateConditions(
    conditions: Record<string, any>,
    user: AuthUser,
    resource: string,
    action: PermissionAction,
  ): boolean {
    // 时间条件
    if (conditions.timeRange) {
      const now = new Date();
      const currentHour = now.getHours();

      if (conditions.timeRange.start && conditions.timeRange.end) {
        if (
          currentHour < conditions.timeRange.start ||
          currentHour > conditions.timeRange.end
        ) {
          return false;
        }
      }
    }

    // 资源所有者条件
    if (conditions.ownerOnly) {
      // 检查用户是否为资源的所有者
      // 这需要根据具体业务逻辑实现
    }

    // 自定义条件
    if (conditions.custom && typeof conditions.custom === 'function') {
      return conditions.custom(user, resource, action);
    }

    return true;
  }

  /**
   * 获取资源权限模式
   */
  private getResourcePermissionPattern(resource: string): string[] {
    const patterns: string[] = [];

    // 精确匹配
    patterns.push(resource);

    // 通配符匹配
    const parts = resource.split(':');
    if (parts.length > 1) {
      patterns.push(`${parts[0]}:*`);
    }

    // 全局匹配
    patterns.push('*');

    return patterns;
  }

  /**
   * 添加用户权限
   */
  addUserPermission(user: AuthUser, permission: Permission): void {
    const userKey = user.username;
    const permissions = this.userSpecificPermissions.get(userKey) || [];
    permissions.push(permission);
    this.userSpecificPermissions.set(userKey, permissions);
  }

  /**
   * 移除用户权限
   */
  removeUserPermission(user: AuthUser, permission: Permission): void {
    const userKey = user.username;
    const permissions = this.userSpecificPermissions.get(userKey) || [];
    const index = permissions.findIndex(
      (p) =>
        p.resource === permission.resource && p.actions === permission.actions,
    );
    if (index > -1) {
      permissions.splice(index, 1);
      this.userSpecificPermissions.set(userKey, permissions);
    }
  }
}
