import { useAuth } from '@/components/auth/AuthProvider';

export function useAdminPermissions() {
  const authState = useAuth();

  // 从 authState.state 中获取认证信息
  const { user, isAuthenticated, loading } = authState.state;

  // 统一的角色判断逻辑
  const isAdmin = ['admin', 'owner'].includes(user?.role || '');
  const isOwner = user?.role === 'owner';
  const isUser = user?.role === 'user';

  // 统一的权限控制
  const canAccessAdmin = isAuthenticated && isAdmin;
  const canAccessOwnerConfig = isOwner;
  const canManageUsers = isAdmin;
  const canViewUserList = isAdmin;
  const canEditSiteConfig = isOwner;
  const canManageCache = isAdmin;
  const canManageConfig = isAdmin; // 通用配置管理权限

  // 调试权限状态
  console.log('useAdminPermissions - 权限状态:', {
    isAdmin,
    isOwner,
    isUser,
    canAccessAdmin,
    canAccessOwnerConfig,
    canManageUsers,
  });

  // 用户操作权限检查方法
  const canOperateUser = (targetUser: any) => {
    if (!isAuthenticated || !user) return false;

    // 站长可以操作所有人（包括其他管理员）
    if (isOwner) return true;

    // 管理员可以操作普通用户和自己
    if (isAdmin) {
      return (
        targetUser.role === 'user' || targetUser.username === user.username
      );
    }

    return false;
  };

  // 用户密码修改权限
  const canChangeUserPassword = (targetUser: any) => {
    if (!isAuthenticated || !user) return false;

    // 不能修改站长密码
    if (targetUser.role === 'owner') return false;

    // 站长可以修改所有人密码（除了自己）
    if (isOwner && targetUser.username !== user.username) return true;

    // 管理员可以修改普通用户密码和自己密码
    if (isAdmin) {
      return (
        targetUser.role === 'user' || targetUser.username === user.username
      );
    }

    return false;
  };

  // 用户API权限配置权限
  const canConfigureUserApis = (targetUser: any) => {
    if (!isAuthenticated || !user) return false;

    // 站长可以配置所有人API权限（除了自己）
    if (isOwner && targetUser.username !== user.username) return true;

    // 管理员可以配置普通用户API权限和自己API权限
    if (isAdmin) {
      return (
        targetUser.role === 'user' || targetUser.username === user.username
      );
    }

    return false;
  };

  return {
    // 用户信息
    user,
    isAuthenticated,
    loading,
    currentUserRole: user?.role as 'owner' | 'admin' | 'user' | null,

    // 角色判断
    isAdmin,
    isOwner,
    isUser,

    // 权限控制
    canAccessAdmin,
    canAccessOwnerConfig,
    canManageUsers,
    canViewUserList,
    canEditSiteConfig,
    canManageCache,
    canManageConfig,

    // 用户操作权限方法
    canOperateUser,
    canChangeUserPassword,
    canConfigureUserApis,
  };
}
