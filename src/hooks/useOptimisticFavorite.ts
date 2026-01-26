/**
 * React 19 useOptimistic Hook 示例
 * 用于乐观更新收藏状态
 */

import { useOptimistic, useState, useTransition } from 'react';

import {
  deleteFavorite,
  generateStorageKey,
  saveFavorite,
} from '@/lib/db.client';
import { logger } from '@/lib/logger';

/**
 * 乐观收藏 Hook
 * 提供即时的收藏状态反馈，提升用户体验
 *
 * @param sourceKey - 资源源标识
 * @param itemId - 资源ID
 * @param initialFavorited - 初始收藏状态
 * @returns 收藏状态和切换函数
 */
export function useOptimisticFavorite(
  sourceKey: string,
  itemId: string,
  initialFavorited: boolean,
) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();

  // 乐观状态 - 立即显示更新后的状态
  const [optimisticFavorited, toggleOptimisticFavorite] = useOptimistic(
    favorited,
    (currentState, newFavorited: boolean) => newFavorited,
  );

  /**
   * 切换收藏状态
   * 使用乐观更新提供即时反馈
   */
  const toggleFavorite = async () => {
    const newFavorited = !optimisticFavorited;

    // 1. 乐观更新 - 立即显示新状态
    toggleOptimisticFavorite(newFavorited);

    // 2. 非紧急更新 - 异步保存到服务器
    startTransition(async () => {
      try {
        const storageKey = generateStorageKey(sourceKey, itemId);

        if (newFavorited) {
          // 添加收藏
          await saveFavorite(storageKey, itemId, {
            title: '', // 需要从外部传入
            source_name: '',
            year: '',
            cover: '',
            total_episodes: 1,
            save_time: Date.now(),
            search_title: '',
          });
        } else {
          // 删除收藏
          await deleteFavorite(storageKey, itemId);
        }

        // 3. 成功后更新实际状态
        setFavorited(newFavorited);
      } catch (error) {
        // 4. 失败时 React 会自动回滚到原始状态
        logger.error('切换收藏失败:', error);
        // 乐观状态会自动恢复，无需手动处理
      }
    });
  };

  return {
    favorited: optimisticFavorited,
    toggleFavorite,
    isPending,
  };
}

/**
 * 使用示例
 *
 * function VideoCard({ video }) {
 *   const { favorited, toggleFavorite, isPending } = useOptimisticFavorite(
 *     video.source,
 *     video.id,
 *     video.isFavorited
 *   );
 *
 *   return (
 *     <div>
 *       <h3>{video.title}</h3>
 *       <button onClick={toggleFavorite} disabled={isPending}>
 *         {favorited ? '❤️ 已收藏' : '🤍 收藏'}
 *         {isPending && '...'}
 *       </button>
 *     </div>
 *   );
 * }
 */
