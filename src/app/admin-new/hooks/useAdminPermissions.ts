'use client';

import { PermissionManager } from '@/components/auth/AuthPermissions';
import { useAuth } from '@/components/auth/AuthProvider';

export function useAdminPermissions() {
  const authState = useAuth();
  const { user, loading, error } = authState.state;

  return {
    role: user?.role || null,
    isAuthenticated: PermissionManager.isAuthenticated(user),
    isAdmin: PermissionManager.isAdmin(user),
    isOwner: PermissionManager.isOwner(user),
    isUser: PermissionManager.isUser(user),
    canManageUsers: PermissionManager.canManageUsers(user),
    canManageSystem: PermissionManager.canManageSystem(user),
    canManageConfig: PermissionManager.canManageConfig(user),
    canAccessAllFeatures: PermissionManager.canAccessAllFeatures(user),
  };
}
