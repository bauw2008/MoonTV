'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';

interface AdminAccessGuardProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'owner';
}

export default function AdminAccessGuard({
  children,
  requiredRole = 'admin',
}: AdminAccessGuardProps) {
  const router = useRouter();
  const authState = useAuth();

  // 从 authState.state 中获取认证信息
  const { user, isAuthenticated, loading } = authState.state;

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated || !user) {
      console.log('AdminAccessGuard: 未认证，重定向登录');
      router.push('/login');
      return;
    }

    // 简化权限检查逻辑 - 信任服务器端认证结果
    const hasPermission =
      requiredRole === 'owner'
        ? user.role === 'owner' // 服务器端已经验证了用户身份
        : ['admin', 'owner'].includes(user.role);

    if (!hasPermission) {
      console.log('AdminAccessGuard: 权限不足', {
        userRole: user.role,
        requiredRole,
      });
      router.push('/');
      return;
    }

    console.log('AdminAccessGuard: 权限验证通过');
  }, [user, isAuthenticated, loading, requiredRole, router]);

  // 显示加载状态
  if (loading || !isAuthenticated) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4'></div>
          <p className='text-gray-600 dark:text-gray-400'>验证权限中...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
