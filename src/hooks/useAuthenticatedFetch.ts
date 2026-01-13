'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

/**
 * 提供带认证的 fetch 请求，自动处理 401 错误
 */
export function useAuthenticatedFetch() {
  const router = useRouter();

  const fetchWithAuth = useCallback(
    async (url: string, options?: RequestInit) => {
      const response = await fetch(url, options);

      // 自动处理 401 未授权错误
      if (response.status === 401) {
        router.push('/login');
        return null;
      }

      return response;
    },
    [router],
  );

  return { fetchWithAuth };
}
