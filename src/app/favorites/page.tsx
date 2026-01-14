/* eslint-disable @typescript-eslint/no-explicit-any, no-console */

'use client';

import { useEffect, useState } from 'react';

import {
  clearAllFavorites,
  getAllFavorites,
  getAllPlayRecords,
} from '@/lib/db.client';
import {
  checkWatchingUpdates,
  getDetailedWatchingUpdates,
  subscribeToWatchingUpdatesEvent,
  type WatchingUpdate,
} from '@/lib/watching-updates';

import { CapsuleSelector } from '@/components/CapsuleSelector';
import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

// 收藏夹数据类型
type FavoriteItem = {
  id: string;
  source: string;
  title: string;
  poster: string;
  episodes: number;
  source_name: string;
  currentEpisode?: number;
  search_title?: string;
  origin?: 'vod' | 'live';
  type?: string;
  year?: string;
};

export default function FavoritesPage() {
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);
  const [favoriteFilter, setFavoriteFilter] = useState<string>('all');
  const [favoriteSortBy, setFavoriteSortBy] = useState<string>('recent');
  const [loading, setLoading] = useState(true);
  const [watchingUpdates, setWatchingUpdates] = useState<WatchingUpdate | null>(
    null,
  );
  const [enableWatchingUpdates, setEnableWatchingUpdates] = useState(true);

  // 筛选选项
  const filterOptions = [
    { value: 'all', label: '全部' },
    { value: 'movie', label: '电影' },
    { value: 'tv', label: '剧集' },
    { value: 'anime', label: '动漫' },
    { value: 'shortdrama', label: '短剧' },
    { value: 'live', label: '直播' },
    { value: 'variety', label: '综艺' },
    { value: 'documentary', label: '纪录片' },
  ];

  // 排序选项
  const sortOptions = [
    { value: 'recent', label: '时间' },
    { value: 'title', label: '标题' },
  ];

  // 处理收藏数据更新的函数
  const updateFavoriteItems = async (allFavorites: Record<string, any>) => {
    const allPlayRecords = await getAllPlayRecords();

    // 根据保存时间排序（从近到远）
    const sorted = Object.entries(allFavorites)
      .sort(([, a], [, b]) => b.save_time - a.save_time)
      .map(([key, fav]) => {
        const plusIndex = key.indexOf('+');
        const source = key.slice(0, plusIndex);
        const id = key.slice(plusIndex + 1);

        // 查找对应的播放记录，获取当前集数
        const playRecord = allPlayRecords[key];
        const currentEpisode = playRecord?.index;

        const itemType = fav?.type;

        return {
          id,
          source,
          title: fav.title,
          year: fav.year,
          poster: fav.cover,
          episodes: fav.total_episodes,
          source_name: fav.source_name,
          currentEpisode,
          search_title: fav?.search_title,
          origin: fav?.origin,
          type: itemType,
        } as FavoriteItem;
      });
    setFavoriteItems(sorted);
  };

  // 检查收藏项是否有新集数更新
  const getNewEpisodesCount = (item: FavoriteItem): number => {
    if (!watchingUpdates?.updatedSeries) {
      return 0;
    }

    const matchedSeries = watchingUpdates.updatedSeries.find(
      (series) =>
        series.sourceKey === item.source &&
        series.videoId === item.id &&
        series.hasNewEpisode,
    );

    return matchedSeries ? matchedSeries.newEpisodes || 0 : 0;
  };

  // 获取最新的总集数
  const getLatestTotalEpisodes = (item: FavoriteItem): number => {
    if (!watchingUpdates?.updatedSeries) {
      return item.episodes;
    }

    const matchedSeries = watchingUpdates.updatedSeries.find(
      (series) =>
        series.sourceKey === item.source && series.videoId === item.id,
    );

    return matchedSeries && matchedSeries.totalEpisodes
      ? matchedSeries.totalEpisodes
      : item.episodes;
  };

  // 加载收藏数据
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        setLoading(true);
        const allFavorites = await getAllFavorites();
        await updateFavoriteItems(allFavorites);
      } catch (error) {
        console.error('加载收藏失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
  }, []);

  // 监听收藏更新事件
  useEffect(() => {
    const handleFavoritesUpdate = (newFavorites: Record<string, any>) => {
      updateFavoriteItems(newFavorites);
    };

    window.addEventListener(
      'favoritesUpdated',
      handleFavoritesUpdate as EventListener,
    );

    return () => {
      window.removeEventListener(
        'favoritesUpdated',
        handleFavoritesUpdate as EventListener,
      );
    };
  }, []);

  // 获取watching updates数据（仅当有收藏项时）
  useEffect(() => {
    // 只有在有收藏项时才检查更新
    if (loading || favoriteItems.length === 0) {
      return;
    }

    const updateWatchingUpdates = async () => {
      console.log('FavoritesPage: 开始获取更新数据...');

      // 先尝试从缓存加载（快速显示）
      let updates = getDetailedWatchingUpdates();
      console.log('FavoritesPage: 缓存数据:', updates);

      if (updates) {
        setWatchingUpdates(updates);
        console.log('FavoritesPage: 使用缓存数据');
      }

      // 如果缓存为空，主动检查一次
      if (!updates) {
        console.log('FavoritesPage: 缓存为空，主动检查更新...');
        try {
          await checkWatchingUpdates();
          updates = getDetailedWatchingUpdates();
          setWatchingUpdates(updates);
          console.log('FavoritesPage: 主动检查完成，获得数据:', updates);
        } catch (error) {
          console.error('FavoritesPage: 主动检查更新失败:', error);
        }
      }
    };

    // 初始加载
    updateWatchingUpdates();

    // 订阅watching updates事件
    const unsubscribeWatchingUpdates = subscribeToWatchingUpdatesEvent(() => {
      console.log('FavoritesPage: 收到watching updates更新事件');
      const updates = getDetailedWatchingUpdates();
      setWatchingUpdates(updates);
    });

    return () => {
      unsubscribeWatchingUpdates();
    };
  }, [loading, favoriteItems.length]); // 依赖收藏项加载状态

  // 读取追剧提醒开关设置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEnableWatchingUpdates = localStorage.getItem(
        'enableWatchingUpdates',
      );
      if (savedEnableWatchingUpdates !== null) {
        setEnableWatchingUpdates(JSON.parse(savedEnableWatchingUpdates));
      }

      // 监听 localStorage 变化，实时更新开关状态
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'enableWatchingUpdates') {
          const value = e.newValue !== null ? JSON.parse(e.newValue) : true;
          setEnableWatchingUpdates(value);
        }
      };

      window.addEventListener('storage', handleStorageChange);
      return () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    }
  }, []);

  if (loading) {
    return (
      <PageLayout>
        <div className='px-2 sm:px-10 py-4 sm:py-8'>
          <div className='max-w-[95%] mx-auto'>
            <div className='mb-8 h-96 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse' />
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible'>
        {/* 页面标题和选择器 */}
        <div className='mb-6 sm:mb-8 space-y-4 sm:space-y-6'>
          {/* 页面标题 */}
          <div>
            <div className='flex items-center gap-3'>
              <h1 className='text-2xl sm:text-3xl font-bold text-gray-800 mb-1 sm:mb-2 dark:text-gray-200'>
                收藏
              </h1>
              {/* 清空图标 */}
              {favoriteItems.length > 0 && (
                <button
                  className='p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200'
                  onClick={async () => {
                    if (confirm('确定要清空所有收藏吗？')) {
                      await clearAllFavorites();
                      setFavoriteItems([]);
                    }
                  }}
                  title='清空所有收藏'
                >
                  <svg
                    className='w-5 h-5'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                    />
                  </svg>
                </button>
              )}
            </div>
            <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>
              来自收藏的影视内容
            </p>
          </div>
        </div>

        <div className='max-w-[95%] mx-auto'>
          <section className='mb-8'>
            {/* 筛选选项 - 完全按照豆瓣页面样式，但保持原有功能 */}
            {favoriteItems.length > 0 && (
              <div className='relative bg-gradient-to-br from-white/80 via-blue-50/30 to-purple-50/30 dark:from-gray-800/60 dark:via-blue-900/20 dark:to-purple-900/20 rounded-2xl p-4 sm:p-6 border border-blue-200/40 dark:border-blue-700/40 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300'>
                {/* 装饰性光晕 */}
                <div className='absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-blue-300/20 to-purple-300/20 rounded-full blur-3xl pointer-events-none'></div>
                <div className='absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-green-300/20 to-teal-300/20 rounded-full blur-3xl pointer-events-none'></div>

                <div className='relative'>
                  {/* 复制豆瓣 DoubanSelector 的内部结构，但使用收藏的功能 */}
                  <div className='space-y-3 sm:space-y-4'>
                    {/* 类型筛选 */}
                    <CapsuleSelector
                      label='分类'
                      options={filterOptions}
                      value={favoriteFilter}
                      onChange={(value) => setFavoriteFilter(String(value))}
                      enableVirtualScroll={true}
                    />

                    {/* 排序选项 */}
                    <CapsuleSelector
                      label='排序'
                      options={sortOptions}
                      value={favoriteSortBy}
                      onChange={(value) => setFavoriteSortBy(String(value))}
                      enableVirtualScroll={true}
                    />
                  </div>{' '}
                </div>
              </div>
            )}

            {/* 筛选后的内容 */}
            <div className='mt-8 justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8'>
              {(() => {
                // 筛选
                let filtered = favoriteItems;
                if (favoriteFilter === 'movie') {
                  filtered = favoriteItems.filter((item) => {
                    if (item.type) {
                      return item.type === 'movie';
                    }
                    if (item.source === 'bangumi') {
                      return false;
                    }
                    if (item.origin === 'live') {
                      return false;
                    }
                    return item.episodes === 1;
                  });
                } else if (favoriteFilter === 'tv') {
                  filtered = favoriteItems.filter((item) => {
                    if (item.type) {
                      return item.type === 'tv';
                    }
                    if (item.source === 'bangumi') {
                      return false;
                    }
                    if (item.origin === 'live') {
                      return false;
                    }
                    return item.episodes > 1;
                  });
                } else if (favoriteFilter === 'anime') {
                  filtered = favoriteItems.filter((item) => {
                    if (item.type) {
                      return item.type === 'anime';
                    }
                    return item.source === 'bangumi';
                  });
                } else if (favoriteFilter === 'shortdrama') {
                  filtered = favoriteItems.filter((item) => {
                    return item.type === 'shortdrama';
                  });
                } else if (favoriteFilter === 'live') {
                  filtered = favoriteItems.filter(
                    (item) => item.origin === 'live',
                  );
                } else if (favoriteFilter === 'variety') {
                  filtered = favoriteItems.filter((item) => {
                    if (item.type) {
                      return item.type === 'variety';
                    }
                    return false;
                  });
                } else if (favoriteFilter === 'documentary') {
                  filtered = favoriteItems.filter((item) => {
                    if (item.type) {
                      return item.type === 'documentary';
                    }
                    return false;
                  });
                }

                // 排序
                if (favoriteSortBy === 'title') {
                  filtered = filtered.sort((a, b) =>
                    a.title.localeCompare(b.title),
                  );
                }
                // 'recent' 排序已经是默认的（按 save_time 降序）

                // 渲染
                return filtered.map((item) => {
                  const newEpisodesCount = getNewEpisodesCount(item);
                  const latestTotalEpisodes = getLatestTotalEpisodes(item);

                  return (
                    <div
                      key={`${item.source}+${item.id}`}
                      className='relative group/card'
                    >
                      <VideoCard
                        from='favorite'
                        source={item.source}
                        id={item.id}
                        title={item.title}
                        poster={item.poster}
                        year={item.year}
                        episodes={latestTotalEpisodes}
                        source_name={item.source_name}
                        currentEpisode={item.currentEpisode}
                        origin={item.origin}
                        type={item.type}
                        onDelete={async () => {
                          // 重新加载收藏数据
                          try {
                            const allFavorites = await getAllFavorites();
                            await updateFavoriteItems(allFavorites);
                          } catch (error) {
                            console.error('重新加载收藏失败:', error);
                          }
                        }}
                      />
                      {/* 新集数徽章 */}
                      {enableWatchingUpdates && newEpisodesCount > 0 && (
                        <div className='absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs px-2 py-1 rounded-full shadow-lg z-50'>
                          +{newEpisodesCount}集
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </section>
        </div>
      </div>
    </PageLayout>
  );
}
