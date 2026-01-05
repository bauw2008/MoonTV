'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';

interface TVBoxAccessGuardProps {
  children: React.ReactNode;
}

export default function TVBoxAccessGuard({ children }: TVBoxAccessGuardProps) {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log('🔶 TVBox访问检查开始');
    console.log('🔶 认证状态:', state.isAuthenticated ? '已认证' : '未认证');
    console.log('🔶 加载状态:', state.loading ? '加载中' : '加载完成');
    
    if (state.user) {
      console.log('🔶 用户信息:', {
        username: state.user.username,
        role: state.user.role,
        tags: state.user.tags
      });
    }

    // 检查是否在客户端
    if (typeof window === 'undefined') {
      console.log('🔶 服务端渲染，跳过检查');
      return;
    }

    // 如果用户未认证且不在加载中，重定向到登录页
    if (!state.isAuthenticated && !state.loading) {
      console.log('🔶 用户未认证，重定向到登录页');
      console.log('🔶 当前路径:', window.location.pathname);
      router.push('/login?redirect=/tvbox');
      return;
    }

    // 认证通过，显示子组件
    console.log('🔶 TVBox访问检查通过');
  }, [state.isAuthenticated, state.loading, state.user, router]);

  // 如果正在加载，显示加载状态
  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">正在验证权限...</p>
        </div>
      </div>
    );
  }

  // 认证通过，显示子组件
  return <>{children}</>;
}