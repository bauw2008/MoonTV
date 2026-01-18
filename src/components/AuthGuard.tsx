'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * 全局认证守卫组件
 * 拦截 401 错误，自动跳转到登录页
 */
export function AuthGuard() {
  const router = useRouter();

  useEffect(() => {
    // 拦截 fetch 请求
    const originalFetch = window.fetch;

    window.fetch = async (input, init?: RequestInit) => {
      const response = await originalFetch(input, init);

      // 检查是否为 401 错误
      if (response.status === 401) {
        // 清除认证信息
        document.cookie =
          'auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie =
          'username=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie =
          'signature=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

        // 跳转到登录页
        const currentPath = window.location.pathname + window.location.search;
        router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
      }

      return response;
    };

    // 清理函数
    return () => {
      window.fetch = originalFetch;
    };
  }, [router]);

  return null;
}
