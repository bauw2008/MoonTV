/* react-hooks/exhaustive-deps,@typescript-eslint/no-explicit-any */

'use client';

import { Search, X } from 'lucide-react';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { logger } from '@/lib/logger';
import {
  getShortDramaCategories,
  searchShortDramas,
} from '@/lib/shortdrama.client';
import { DoubanItem, DoubanResult } from '@/lib/types';
import { useFeaturePermission } from '@/hooks/useFeaturePermission';

import DoubanCardSkeleton from '@/components/DoubanCardSkeleton';
import FloatingTools from '@/components/FloatingTools';
import PageLayout from '@/components/PageLayout';
import ShortDramaSelector from '@/components/ShortDramaSelector';
import VideoCard from '@/components/VideoCard';
import VirtualDoubanGrid, {
  VirtualDoubanGridRef,
} from '@/components/VirtualDoubanGrid';

// 权限检查组件
function ShortDramaPagePermissionCheck({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const disabledMenus = (window as any).__DISABLED_MENUS || {};
      if (disabledMenus.showShortDrama) {
        window.location.href = '/';
      }
    }
  }, []);

  if (typeof window !== 'undefined') {
    const disabledMenus = (window as any).__DISABLED_MENUS || {};
    if (disabledMenus.showShortDrama) {
      return null;
    }
  }

  return <>{children}</>;
}

function ShortDramaPageClient() {
  const { hasPermission } = useFeaturePermission();

  // 功能启用状态（从全局配置读取）
  const isAIEnabled =
    typeof window !== 'undefined'
      ? ((window as any).RUNTIME_CONFIG.AIConfig?.enabled ?? false)
      : false;

  const [doubanData, setDoubanData] = useState<DoubanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectorsReady, setSelectorsReady] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // VirtualDoubanGrid ref for scroll control
  const virtualGridRef = useRef<VirtualDoubanGridRef>(null);

  // 虚拟化开关状态
  const [useVirtualization, setUseVirtualization] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('useShortDramaVirtualization');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });

  // 用于存储最新参数值的 refs
  const currentParamsRef = useRef({
    shortDramaCategory: '都市',
    currentPage: 0,
  });

  // 短剧选择器状态
  const [shortDramaCategory, setShortDramaCategory] = useState<string>('都市');

  // 搜索状态
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [, setIsSearching] = useState(false);

  // 保存虚拟化设置
  const toggleVirtualization = () => {
    const newValue = !useVirtualization;
    setUseVirtualization(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'useShortDramaVirtualization',
        JSON.stringify(newValue),
      );
    }

    currentParamsRef.current = {
      shortDramaCategory,
      currentPage,
    };
  };

  // 同步最新参数值到 ref
  useEffect(() => {
    currentParamsRef.current = {
      shortDramaCategory,
      currentPage,
    };
  }, [shortDramaCategory, currentPage]);

  // 初始化时标记选择器为准备好状态
  useEffect(() => {
    const timer = setTimeout(() => {
      setSelectorsReady(true);
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  // 生成骨架屏数据
  const skeletonData = Array.from({ length: 25 }, (_, index) => index);

  // 防抖的数据加载函数
  const loadInitialData = useCallback(async () => {
    // 如果正在搜索，不加载默认数据
    if (showSearch) {
      return;
    }

    const requestSnapshot = {
      shortDramaCategory,
      currentPage: 0,
    };

    try {
      setLoading(true);
      setCurrentPage(0);
      setDoubanData([]);
      setHasMore(true);
      setIsLoadingMore(false);

      let data: DoubanResult;

      // 使用扩展分类筛选
      const categories = await getShortDramaCategories();

      if (categories.length === 0) {
        data = {
          code: 200,
          message: 'success',
          list: [],
        };
      } else {
        // wwzy API 只有 type_id=1（短剧）有内容
        const categoryId = 1;

        // 构建请求参数
        const params = new URLSearchParams({
          categoryId: categoryId.toString(),
          page: '1',
          size: '12',
        });

        // 如果选择了扩展分类，添加 extendedCategory 参数
        if (shortDramaCategory) {
          params.append('extendedCategory', shortDramaCategory);
        }

        const apiUrl = `/api/shortdrama/list?${params.toString()}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        data = {
          code: 200,
          message: 'success',
          list:
            result.list?.map((item: any) => ({
              id: item.id?.toString() || '',
              title: item.name || '',
              poster: item.cover || '',
              rate: '',
              year:
                item.update_time?.split(/[\sT]/)?.[0]?.replace(/-/g, '.') || '',
              type: 'shortdrama',
              source: 'shortdrama',
              videoId: item.id?.toString() || '',
              source_name: '',
            })) || [],
        };
      }

      if (data.code === 200) {
        const currentSnapshot = { ...currentParamsRef.current };
        const keyParamsMatch =
          requestSnapshot.shortDramaCategory ===
          currentSnapshot.shortDramaCategory;

        if (keyParamsMatch) {
          setDoubanData(data.list);
          setHasMore(data.list.length !== 0);
          setLoading(false);
        }
      } else {
        throw new Error(data.message || '获取数据失败');
      }
    } catch (err) {
      logger.error('加载数据失败:', err);
      setError(err instanceof Error ? err.message : '加载数据失败');
      setLoading(false);
    }
  }, [shortDramaCategory, showSearch]);

  // 只在选择器准备好后才加载数据
  useEffect(() => {
    if (!selectorsReady) {
      return;
    }

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      loadInitialData();
    }, 100);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [selectorsReady, shortDramaCategory, loadInitialData, showSearch]);

  // 加载更多数据

  useEffect(() => {
    // 如果正在搜索，不加载更多数据

    if (showSearch || currentPage === 0) {
      return;
    }

    const fetchMoreData = async () => {
      const requestSnapshot = {
        shortDramaCategory,

        currentPage,
      };

      currentParamsRef.current = requestSnapshot;

      try {
        setIsLoadingMore(true);

        let data: DoubanResult;

        // 使用扩展分类筛选

        const categories = await getShortDramaCategories();

        if (categories.length === 0) {
          data = {
            code: 200,

            message: 'success',

            list: [],
          };
        } else {
          // wwzy API 只有 type_id=1（短剧）有内容

          const categoryId = 1;

          // 构建请求参数

          const params = new URLSearchParams({
            categoryId: categoryId.toString(),

            page: (currentPage + 1).toString(),

            size: '12',
          });

          // 如果选择了扩展分类，添加 extendedCategory 参数

          if (shortDramaCategory) {
            params.append('extendedCategory', shortDramaCategory);
          }

          const apiUrl = `/api/shortdrama/list?${params.toString()}`;

          const response = await fetch(apiUrl);

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const result = await response.json();

          data = {
            code: 200,

            message: 'success',

            list:
              result.list?.map((item: any) => ({
                id: item.id?.toString() || '',

                title: item.name || '',

                poster: item.cover || '',

                rate: '',

                year:
                  item.update_time?.split(/[\sT]/)?.[0]?.replace(/-/g, '.') ||
                  '',

                type: 'shortdrama',

                source: 'shortdrama',

                videoId: item.id?.toString() || '',

                source_name: '',
              })) || [],
          };
        }

        if (data.code === 200) {
          const currentSnapshot = { ...currentParamsRef.current };

          const keyParamsMatch =
            requestSnapshot.shortDramaCategory ===
            currentSnapshot.shortDramaCategory;

          if (keyParamsMatch) {
            setDoubanData((prev) => [...prev, ...data.list]);

            setHasMore(data.list.length !== 0);
          }
        }
      } catch (err) {
        logger.error(err);
      } finally {
        setIsLoadingMore(false);
      }
    };

    fetchMoreData();
  }, [currentPage, shortDramaCategory, showSearch]);

  // 设置滚动监听（只在非虚拟化模式下启用）
  useEffect(() => {
    if (useVirtualization || showSearch) {
      return;
    }

    if (!hasMore || isLoadingMore || loading) {
      return;
    }

    if (!loadingRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          setCurrentPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(loadingRef.current);
    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore, loading, useVirtualization, showSearch]);

  // 处理选择器变化
  const handleCategoryChange = useCallback(
    (value: string | number) => {
      const strValue = String(value);
      if (strValue !== shortDramaCategory) {
        setLoading(true);
        setCurrentPage(0);
        setDoubanData([]);
        setHasMore(true);
        setIsLoadingMore(false);
        setShortDramaCategory(strValue);
      }
    },
    [shortDramaCategory],
  );

  // 处理搜索
  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        // 如果搜索框为空，恢复正常显示
        setShowSearch(false);
        setSearchQuery('');
        loadInitialData();
        return;
      }

      try {
        setIsSearching(true);
        setLoading(true);
        setCurrentPage(0);
        setDoubanData([]);
        setHasMore(true);
        setIsLoadingMore(false);

        const result = await searchShortDramas(query, 1, 12);

        const data: DoubanResult = {
          code: 200,
          message: 'success',
          list:
            result.list?.map((item) => ({
              id: item.id?.toString() || '',
              title: item.name || '',
              poster: item.cover || '',
              rate: '',
              year:
                item.update_time?.split(/[\sT]/)?.[0]?.replace(/-/g, '.') || '',
              type: 'shortdrama',
              source: 'shortdrama',
              videoId: item.id?.toString() || '',
              source_name: '',
            })) || [],
        };

        setDoubanData(data.list);
        setHasMore(result.hasMore);
        setLoading(false);
      } catch (err) {
        logger.error('搜索失败:', err);
        setError(err instanceof Error ? err.message : '搜索失败');
        setLoading(false);
      } finally {
        setIsSearching(false);
      }
    },
    [loadInitialData],
  );

  // 处理搜索框输入
  const handleSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);
    },
    [],
  );

  // 处理搜索提交
  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleSearch(searchQuery);
    },
    [searchQuery, handleSearch],
  );

  // 关闭搜索
  const handleCloseSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery('');
    loadInitialData();
  }, [loadInitialData]);

  // 处理虚拟化组件的加载更多请求
  const handleVirtualLoadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [hasMore, isLoadingMore]);

  const getPageDescription = () => {
    if (showSearch && searchQuery) {
      return `搜索"${searchQuery}"的结果`;
    }
    return '来自旺旺的短剧内容';
  };

  return (
    <PageLayout activePath='/shortdrama'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible'>
        {/* 页面标题和选择器 */}
        <div className='mb-6 sm:mb-8 space-y-4 sm:space-y-6'>
          {/* 页面标题 */}
          <div>
            <div className='flex items-center gap-3'>
              <h1 className='text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2'>
                短剧
              </h1>
              <button
                onClick={() => setShowSearch(!showSearch)}
                className='p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors'
                title='搜索'
              >
                <Search className='w-5 h-5 text-gray-600 dark:text-gray-400' />
              </button>
            </div>
            <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>
              {getPageDescription()}
            </p>
          </div>

          {/* 搜索框 */}
          {showSearch && (
            <div className='relative'>
              <form onSubmit={handleSearchSubmit} className='relative'>
                <input
                  type='text'
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  placeholder='搜索短剧...'
                  className='w-full px-4 py-3 pr-12 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none'
                  autoFocus
                />
                <button
                  type='button'
                  onClick={handleCloseSearch}
                  className='absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
                  title='关闭搜索'
                >
                  <X className='w-5 h-5 text-gray-500 dark:text-gray-400' />
                </button>
              </form>
            </div>
          )}

          {/* 选择器组件 */}
          {!showSearch && (
            <div className='relative bg-gradient-to-br from-white/80 via-blue-50/30 to-purple-50/30 dark:from-gray-800/60 dark:via-blue-900/20 dark:to-purple-900/20 rounded-2xl p-4 sm:p-6 border border-blue-200/40 dark:border-blue-700/40 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300'>
              {/* 装饰性光晕 */}
              <div className='absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-blue-300/20 to-purple-300/20 rounded-full blur-3xl pointer-events-none'></div>
              <div className='absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-purple-300/20 to-blue-300/20 rounded-full blur-3xl pointer-events-none'></div>

              <div className='relative'>
                <ShortDramaSelector
                  primarySelection={shortDramaCategory}
                  onPrimaryChange={handleCategoryChange}
                />
              </div>
            </div>
          )}
        </div>

        {/* 内容展示区域 */}
        <div className='max-w-[95%] mx-auto mt-8 overflow-visible'>
          {/* 条件渲染：虚拟化 vs 传统网格 */}
          {useVirtualization ? (
            <VirtualDoubanGrid
              ref={virtualGridRef}
              doubanData={doubanData}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={handleVirtualLoadMore}
              type='shortdrama'
              loading={loading}
            />
          ) : (
            <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4'>
              {doubanData.map((item, index) => (
                <VideoCard
                  key={`${item.id}-${index}`}
                  id={item.id}
                  source={item.source}
                  title={item.title}
                  poster={item.poster}
                  from='shortdrama'
                  rate={item.rate}
                  year={item.year}
                  source_name={item.source_name}
                />
              ))}
            </div>
          )}

          {/* 加载中骨架屏 */}
          {loading && (
            <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4'>
              {skeletonData.map((_, index) => (
                <DoubanCardSkeleton key={index} />
              ))}
            </div>
          )}

          {/* 加载更多指示器 */}
          {!loading && hasMore && (
            <div ref={loadingRef} className='flex justify-center py-8'>
              <div className='text-gray-500 dark:text-gray-400'>加载中...</div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className='flex justify-center py-8'>
              <div className='text-red-500 dark:text-red-400 text-center'>
                <p className='mb-2'>{error}</p>
                <button
                  onClick={() => {
                    setError(null);
                    loadInitialData();
                  }}
                  className='px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors'
                >
                  重试
                </button>
              </div>
            </div>
          )}

          {/* 无数据提示 */}
          {!loading && !error && doubanData.length === 0 && (
            <div className='flex justify-center py-16'>
              <div className='text-gray-500 dark:text-gray-400 text-center'>
                暂无短剧数据
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 浮动工具组 */}
      <FloatingTools
        showAI={isAIEnabled && hasPermission('ai-recommend')} // 根据功能配置和用户权限显示AI
        useVirtualization={useVirtualization}
        onToggleVirtualization={toggleVirtualization}
        showBackToTop={true}
        virtualGridRef={virtualGridRef}
      />
    </PageLayout>
  );
}

export default function ShortDramaPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ShortDramaPagePermissionCheck>
        <ShortDramaPageClient />
      </ShortDramaPagePermissionCheck>
    </Suspense>
  );
}
