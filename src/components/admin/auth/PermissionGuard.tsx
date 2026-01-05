'use client';

import { ReactNode } from 'react';

import type { UserRole } from '@/lib/auth/types';
import { useAdminPermissions } from '@/hooks/admin/useAdminPermissions';

interface PermissionGuardProps {
  children: ReactNode;
  role?: UserRole;
  fallback?: ReactNode;
}

export function PermissionGuard({
  children,
  role,
  fallback,
}: PermissionGuardProps) {
  const permissions = useAdminPermissions();

  // 如果没有指定角色要求，直接显示
  if (!role) {
    return <>{children}</>;
  }

  // 检查权限
  const hasPermission = checkPermission(permissions.role, role);

  if (hasPermission) {
    return <>{children}</>;
  }

  // 显示fallback或默认提示
  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className='bg-white dark:bg-gray-800 rounded-lg shadow'>
      <div className='p-6 text-center text-gray-500 dark:text-gray-400'>
        权限不足，无法访问此功能
      </div>
    </div>
  );
}

function checkPermission(
  userRole: UserRole | null,
  requiredRole: UserRole,
): boolean {
  if (!userRole) return false;

  // 权限等级：owner > admin > user
  const roleHierarchy = {
    user: 1,
    admin: 2,
    owner: 3,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}
