import { useCallback, useState } from 'react';

interface LoadingState {
  [key: string]: boolean;
}

export const useAdminLoading = () => {
  const [loadingStates, setLoadingStates] = useState<LoadingState>({});

  const setLoading = useCallback((key: string, loading: boolean) => {
    setLoadingStates((prev) => ({ ...prev, [key]: loading }));
  }, []);

  const isLoading = useCallback(
    (key: string) => loadingStates[key] || false,
    [loadingStates],
  );

  const withLoading = useCallback(
    async <T>(key: string, operation: () => Promise<T>): Promise<T> => {
      setLoading(key, true);
      try {
        const result = await operation();
        return result;
      } finally {
        setLoading(key, false);
      }
    },
    [setLoading],
  );

  const isAnyLoading = useCallback(
    () => Object.values(loadingStates).some(Boolean),
    [loadingStates],
  );

  return {
    loadingStates,
    setLoading,
    isLoading,
    withLoading,
    isAnyLoading,
  };
};
