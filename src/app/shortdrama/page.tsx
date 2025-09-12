/* eslint-disable no-console,react-hooks/exhaustive-deps,@typescript-eslint/no-explicit-any */

'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import {
  getShortDramaList,
  getShortDramaLatest,
  ShortDramaItem,
} from '@/lib/shortdrama.client';

import DoubanCardSkeleton from '@/components/DoubanCardSkeleton';
import PageLayout from '@/components/PageLayout';
import ShortDramaSelector from '@/components/ShortDramaSelector';
import VideoCard from '@/components/VideoCard';

function ShortDramaPageClient() {
  const [shortDramaData, setShortDramaData] = useState<ShortDramaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 选择器状态
  const [selectedCategory, setSelectedCategory] = useState<string>('0'); // '0' 表示全部

  // 用于存储最新参数值的 refs
  const currentParamsRef = useRef({
    selectedCategory: '0',
    currentPage: 1,
  });

  // 生成骨架屏数据
  const skeletonData = Array.from({ length: 25 }, (_, index) => index);

  // 同步最新参数值到 ref
  useEffect(() => {
    currentParamsRef.current = {
      selectedCategory,
      currentPage,
    };
  }, [selectedCategory, currentPage]);

  // 参数快照比较函数
  const isSnapshotEqual = useCallback(
    (
      snapshot1: {
        selectedCategory: string;
        currentPage: number;
      },
      snapshot2: {
        selectedCategory: string;
        currentPage: number;
      }
    ) => {
      return (
        snapshot1.selectedCategory === snapshot2.selectedCategory &&
        snapshot1.currentPage === snapshot2.currentPage
      );
    },
    []
  );

  // 防抖的数据加载函数
  const loadInitialData = useCallback(async () => {
    // 创建当前参数的快照
    const requestSnapshot = {
      selectedCategory,
      currentPage: 1,
    };

    try {
      setLoading(true);
      // 确保在加载初始数据时重置页面状态
      setShortDramaData([]);
      setCurrentPage(1);
      setHasMore(true);
      setIsLoadingMore(false);

      let data: ShortDramaItem[] = [];
      let totalPages = 1;

      if (selectedCategory === '0') {
        // 全部分类 - 调用获取最新剧集的接口
        const latestData = await getShortDramaLatest({ page: '1' });
        data = Array.isArray(latestData) ? latestData : [];
        totalPages = 10; // 假设最新剧集有多页
      } else {
        // 其他分类 - 调用获取分类热搜的接口
        const response = await getShortDramaList({
          categoryId: selectedCategory,
          page: '1',
        });
        data = Array.isArray(response?.list) ? response.list : [];
        totalPages = response?.totalPages || 1;
      }

      // 检查参数是否仍然一致，如果一致才设置数据
      const currentSnapshot = { ...currentParamsRef.current };

      if (isSnapshotEqual(requestSnapshot, currentSnapshot)) {
        setShortDramaData(data);
        setTotalPages(totalPages);
        setHasMore(data.length !== 0 && currentPage < totalPages);
        setLoading(false);
      } else {
        // 没有更多数据时设置hasMore为false
        setHasMore(false);
      }
    } catch (err) {
      console.error('加载短剧数据失败:', err);
      setLoading(false); // 发生错误时总是停止loading状态
    }
  }, [selectedCategory, isSnapshotEqual]);

  // 加载数据
  useEffect(() => {
    // 清除之前的防抖定时器
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // 使用防抖机制加载数据，避免连续状态更新触发多次请求
    debounceTimeoutRef.current = setTimeout(() => {
      loadInitialData();
    }, 100); // 100ms 防抖延迟

    // 清理函数
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [selectedCategory, loadInitialData]);

  // 单独处理 currentPage 变化（加载更多）
  useEffect(() => {
    if (currentPage > 1) {
      const fetchMoreData = async () => {
        // 创建当前参数的快照
        const requestSnapshot = {
          selectedCategory,
          currentPage,
        };

        try {
          setIsLoadingMore(true);

          let data: ShortDramaItem[] = [];

          if (selectedCategory === '0') {
            // 全部分类 - 调用获取最新剧集的接口
            const latestData = await getShortDramaLatest({ page: currentPage.toString() });
            data = Array.isArray(latestData) ? latestData : [];
          } else {
            // 其他分类 - 调用获取分类热搜的接口
            const response = await getShortDramaList({
              categoryId: selectedCategory,
              page: currentPage.toString(),
            });
            data = Array.isArray(response?.list) ? response.list : [];
          }

          // 检查参数是否仍然一致，如果一致才设置数据
          const currentSnapshot = { ...currentParamsRef.current };

          if (isSnapshotEqual(requestSnapshot, currentSnapshot)) {
            setShortDramaData((prev) => [...prev, ...data]);
            setHasMore(data.length !== 0 && currentPage < totalPages);
          } else {
            // 参数不一致，忽略此次响应
            console.log('参数已变更，忽略过期的数据响应');
          }
        } catch (err) {
          console.error('加载更多短剧数据失败:', err);
        } finally {
          setIsLoadingMore(false);
        }
      };

      fetchMoreData();
    }
  }, [currentPage, selectedCategory, totalPages, isSnapshotEqual]);

  // 设置滚动监听
  useEffect(() => {
    // 如果没有更多数据或正在加载，则不设置监听
    if (!hasMore || isLoadingMore || loading) {
      return;
    }

    // 确保 loadingRef 存在
    if (!loadingRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          setCurrentPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadingRef.current);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore, loading]);

  // 处理选择器变化
  const handleCategoryChange = useCallback(
    (category: string) => {
      if (category !== selectedCategory) {
        setLoading(true);
        setCurrentPage(1);
        setShortDramaData([]);
        setHasMore(true);
        setIsLoadingMore(false);
        setSelectedCategory(category);
      }
    },
    [selectedCategory]
  );


  return (
    <PageLayout activePath='/shortdrama'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible'>
        {/* 页面标题和选择器 */}
        <div className='mb-6 sm:mb-8 space-y-4 sm:space-y-6'>
          {/* 页面标题 */}
          <div>
            <h1 className='text-2xl sm:text-3xl font-bold text-gray-800 mb-1 sm:mb-2 dark:text-gray-200'>
              短剧
            </h1>
            <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>
              精彩短剧，尽在掌握
            </p>
          </div>

          {/* 选择器组件 */}
          <div className='bg-white/60 dark:bg-gray-800/40 rounded-2xl p-4 sm:p-6 border border-gray-200/30 dark:border-gray-700/30 backdrop-blur-sm'>
            <ShortDramaSelector
              selectedCategory={selectedCategory}
              onCategoryChange={handleCategoryChange}
            />
          </div>
        </div>

        {/* 内容展示区域 */}
        <div className='max-w-[95%] mx-auto mt-8 overflow-visible'>
          {/* 内容网格 */}
          <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-12 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20'>
            {loading
              ? // 显示骨架屏
              skeletonData.map((index) => <DoubanCardSkeleton key={index} />)
              : // 显示实际数据
              Array.isArray(shortDramaData) && shortDramaData.length > 0
                ? shortDramaData.map((item, index) => {
                  const videoId = item.vod_id ? item.vod_id.toString() : item.id.toString();
                  return (
                    <div key={`${item.name}-${item.id}-${index}`} className='w-full'>
                      <VideoCard
                        from='shortdrama'
                        id={videoId}
                        title={item.name}
                        poster={item.cover}
                        rate={item.score ? item.score.toString() : ''}
                        year={item.update_time ? new Date(item.update_time).getFullYear().toString() : ''}
                        type='tv'
                        source='shortdrama'
                        source_name='短剧'
                        episodes={item.total_episodes ? parseInt(item.total_episodes) || 1 : 1}
                        vod_class={item.vod_class}
                        vod_tag={item.vod_tag}
                      />
                    </div>
                  );
                })
                : null}
          </div>

          {/* 加载更多指示器 */}
          {hasMore && !loading && (
            <div
              ref={(el) => {
                if (el && el.offsetParent !== null) {
                  (
                    loadingRef as React.MutableRefObject<HTMLDivElement | null>
                  ).current = el;
                }
              }}
              className='flex justify-center mt-12 py-8'
            >
              {isLoadingMore && (
                <div className='flex items-center gap-2'>
                  <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500'></div>
                  <span className='text-gray-600 dark:text-gray-400'>加载中...</span>
                </div>
              )}
            </div>
          )}

          {/* 没有更多数据提示 */}
          {!hasMore && shortDramaData.length > 0 && (
            <div className='text-center text-gray-500 dark:text-gray-400 py-8'>
              已加载全部内容
            </div>
          )}

          {/* 空状态 */}
          {!loading && (!Array.isArray(shortDramaData) || shortDramaData.length === 0) && (
            <div className='text-center text-gray-500 dark:text-gray-400 py-8'>
              暂无相关内容
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

export default function ShortDramaPage() {
  return (
    <Suspense>
      <ShortDramaPageClient />
    </Suspense>
  );
}
