/**
 * React 19 useTransition Hook 示例
 * 用于优化数据加载性能
 */

import { useState, useTransition } from 'react';

import { logger } from '@/lib/logger';

interface UseAsyncDataOptions<T> {
  initialData?: T;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

/**
 * 异步数据加载 Hook
 * 使用 useTransition 优化数据加载性能
 *
 * @param fetchFn - 数据获取函数
 * @param options - 配置选项
 * @returns 数据、加载状态和刷新函数
 */
export function useAsyncData<T>(
  fetchFn: () => Promise<T>,
  options: UseAsyncDataOptions<T> = {},
) {
  const { initialData, onSuccess, onError } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, startTransition] = useTransition();

  /**
   * 加载数据
   * 使用 startTransition 标记为非紧急更新
   */
  const loadData = () => {
    startTransition(async () => {
      try {
        const result = await fetchFn();
        setData(result);
        setError(null);
        onSuccess?.(result);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Unknown error occurred');
        setError(error);
        logger.error('加载数据失败:', error);
        onError?.(error);
      }
    });
  };

  /**
   * 重新加载数据
   */
  const refresh = () => {
    loadData();
  };

  return {
    data,
    error,
    isPending,
    loadData,
    refresh,
  };
}

/**
 * 使用示例
 *
 * function SearchPage() {
 *   const [query, setQuery] = useState('');
 *
 *   const { data: searchResults, isPending, refresh } = useAsyncData(
 *     async () => {
 *       const response = await fetch(`/api/search?q=${query}`);
 *       return response.json();
 *     },
 *     {
 *       onSuccess: (results) => {
 *         console.log('搜索完成:', results.length);
 *       },
 *       onError: (error) => {
 *         console.error('搜索失败:', error);
 *       },
 *     }
 *   );

 *   return (
 *     <div>
 *       <input
 *         value={query}
 *         onChange={(e) => {
 *           setQuery(e.target.value);
 *           refresh();
 *         }}
 *       />
 *
 *       {isPending && <div>搜索中...</div>}
 *       {error && <div>搜索失败: {error.message}</div>}
 *
 *       <SearchResults results={searchResults || []} />
 *     </div>
 *   );
 * }
 */
