import { useMemo } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

export const useAdminAuthSimple = () => {
  const authInfo = getAuthInfoFromBrowserCookie();

  // 直接使用 Cookie 信息，无需异步验证
  // Cookie 是服务器设置的，已经是可信的
  const role = authInfo?.role as 'owner' | 'admin' | null;
  const currentUser = authInfo
    ? {
        username: authInfo.username,
        role: authInfo.role,
      }
    : null;

  const hasPermission = useMemo(
    () => (requiredRole: 'owner' | 'admin') => {
      if (!role) return false;
      if (requiredRole === 'owner') return role === 'owner';
      if (requiredRole === 'admin') return role === 'admin' || role === 'owner';
      return false;
    },
    [role],
  );

  const canManageUser = useMemo(
    () => (targetUser: { username: string; role: string }) => {
      if (!currentUser) return false;

      if (currentUser.role === 'owner') return true;

      if (currentUser.role === 'admin') {
        return (
          targetUser.role === 'user' ||
          targetUser.username === currentUser.username
        );
      }

      return false;
    },
    [currentUser],
  );

  return {
    role,
    loading: false, // 永远不 loading
    currentUser,
    hasPermission,
    canManageUser,
    isAdminOrOwner: role === 'admin' || role === 'owner',
    isOwner: role === 'owner',
    isAdmin: role === 'admin',
  };
};
