/**
 * 管理员页面统一状态管理
 * 提供加载状态管理和错误处理
 */

import { useCallback, useState } from 'react';

interface LoadingState {
  [key: string]: boolean;
}

interface ErrorState {
  [key: string]: string | null;
}

export function useAdminState() {
  const [loading, setLoading] = useState<LoadingState>({});
  const [errors, setErrors] = useState<ErrorState>({});

  const setLoadingState = useCallback((key: string, value: boolean) => {
    setLoading((prev) => ({ ...prev, [key]: value }));
  }, []);

  const setErrorState = useCallback((key: string, error: string | null) => {
    setErrors((prev) => ({ ...prev, [key]: error }));
  }, []);

  const withLoading = useCallback(
    async <T>(key: string, operation: () => Promise<T>): Promise<T> => {
      setLoadingState(key, true);
      setErrorState(key, null);

      try {
        const result = await operation();
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '操作失败';
        setErrorState(key, errorMessage);
        throw error;
      } finally {
        setLoadingState(key, false);
      }
    },
    [setLoadingState, setErrorState],
  );

  const clearError = useCallback(
    (key: string) => {
      setErrorState(key, null);
    },
    [setErrorState],
  );

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    loading,
    errors,
    setLoadingState,
    setErrorState,
    withLoading,
    clearError,
    clearAllErrors,
  };
}
