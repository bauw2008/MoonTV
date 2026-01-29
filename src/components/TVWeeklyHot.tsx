'use client';

import { ChevronLeft, ChevronRight, Tv } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { ClientCache } from '@/lib/client-cache';
import { logger } from '@/lib/logger';

import SectionTitle from '@/components/SectionTitle';
import VideoCard from '@/components/VideoCard';

interface WeeklyHotItem {
  id: string;
  title: string;
  rating: {
    value: number;
  };
  cover_url?: string;
  cover?: {
    url: string;
  };
  year?: string;
}

interface TVWeeklyHotProps {
  limit?: number;
}

const CACHE_KEY = 'douban-weekly-tv';
const CACHE_EXPIRE = 7200; // 2小时

export default function TVWeeklyHot({ limit = 10 }: TVWeeklyHotProps) {
  const [weeklyHot, setWeeklyHot] = useState<WeeklyHotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const loadWeeklyHot = async () => {
      try {
        setLoading(true);

        // 先尝试从缓存获取
        const cached = await ClientCache.get<WeeklyHotItem[]>(CACHE_KEY);
        if (cached && cached.length > 0) {
          setWeeklyHot(cached.slice(0, limit));
          setLoading(false);
          return;
        }

        // 缓存未命中，从API获取
        const response = await fetch(
          `/api/douban/weekly-hot?type=tv&limit=${limit}`,
        );

        if (!response.ok) {
          throw new Error(`API请求失败: ${response.status}`);
        }

        const result = await response.json();

        if (result.success && result.data?.subject_collection_items) {
          const items = result.data.subject_collection_items;
          setWeeklyHot(items);
          // 保存到缓存
          await ClientCache.set(CACHE_KEY, items, CACHE_EXPIRE);
        } else {
          throw new Error(result.error || '获取数据失败');
        }
      } catch (error) {
        logger.error('加载每周热门失败:', error);
        setWeeklyHot([]); // 出错时显示空数组
      } finally {
        setLoading(false);
      }
    };

    loadWeeklyHot();
  }, [limit]);

  // 检查是否需要显示滚动按钮
  const checkScroll = () => {
    if (containerRef.current) {
      const { scrollWidth, clientWidth, scrollLeft } = containerRef.current;
      const threshold = 1;
      const canScrollRight =
        scrollWidth - (scrollLeft + clientWidth) > threshold;
      const canScrollLeft = scrollLeft > threshold;

      setShowRightScroll(canScrollRight);
      setShowLeftScroll(canScrollLeft);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);

    const resizeObserver = new ResizeObserver(() => {
      checkScroll();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', checkScroll);
      resizeObserver.disconnect();
    };
  }, [weeklyHot]);

  const handleScrollLeft = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: -500, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ left: 500, behavior: 'smooth' });
    }
  };

  // 如果没有数据且不加载中，不显示
  if (!loading && weeklyHot.length === 0) {
    return null;
  }

  return (
    <section className='mb-8'>
      <div className='mb-4'>
        <SectionTitle title='剧集周榜' icon={Tv} iconColor='text-blue-500' />
      </div>

      <div
        className='relative overflow-visible'
        onMouseEnter={() => {
          setIsHovered(true);
          checkScroll();
        }}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          ref={containerRef}
          className='flex space-x-4 overflow-x-auto overflow-y-visible py-2 pb-6 px-2 scrollbar-hide'
          onScroll={checkScroll}
        >
          {loading
            ? // 加载骨架
              Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
                >
                  <div className='relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gray-200 animate-pulse dark:bg-gray-800'>
                    <div className='absolute inset-0 bg-gray-300 dark:bg-gray-700'></div>
                  </div>
                  <div className='mt-2 h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-800'></div>
                </div>
              ))
            : // 显示真实数据
              weeklyHot.map((item, index) => (
                <div
                  key={item.id}
                  className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44 relative group/card'
                >
                  <div className='relative group-hover/card:z-[5] transition-all duration-300 overflow-visible'>
                    <VideoCard
                      id={item.id}
                      title={item.title}
                      poster={item.cover_url || item.cover?.url || ''}
                      year={item.year}
                      rate={item.rating?.value?.toFixed(1)}
                      from='douban'
                      type='tv'
                      priority={index < 4}
                    />
                  </div>
                </div>
              ))}
        </div>

        {/* 左滚动按钮 */}
        {showLeftScroll && (
          <div
            className={`hidden sm:flex absolute left-0 top-0 bottom-0 w-16 items-center justify-center z-[600] transition-opacity duration-200 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              background: 'transparent',
              pointerEvents: 'none',
            }}
          >
            <div
              className='absolute inset-0 flex items-center justify-center'
              style={{
                top: '40%',
                bottom: '60%',
                left: '-4.5rem',
                pointerEvents: 'auto',
              }}
            >
              <button
                onClick={handleScrollLeft}
                className='w-12 h-12 bg-white/95 rounded-full shadow-lg flex items-center justify-center hover:bg-white border border-gray-200 transition-transform hover:scale-105 dark:bg-gray-800/90 dark:hover:bg-gray-700 dark:border-gray-600'
              >
                <ChevronLeft className='w-6 h-6 text-gray-600 dark:text-gray-300' />
              </button>
            </div>
          </div>
        )}

        {/* 右滚动按钮 */}
        {showRightScroll && (
          <div
            className={`hidden sm:flex absolute right-0 top-0 bottom-0 w-16 items-center justify-center z-[600] transition-opacity duration-200 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              background: 'transparent',
              pointerEvents: 'none',
            }}
          >
            <div
              className='absolute inset-0 flex items-center justify-center'
              style={{
                top: '40%',
                bottom: '60%',
                right: '-4.5rem',
                pointerEvents: 'auto',
              }}
            >
              <button
                onClick={handleScrollRight}
                className='w-12 h-12 bg-white/95 rounded-full shadow-lg flex items-center justify-center hover:bg-white border border-gray-200 transition-transform hover:scale-105 dark:bg-gray-800/90 dark:hover:bg-gray-700 dark:border-gray-600'
              >
                <ChevronRight className='w-6 h-6 text-gray-600 dark:text-gray-300' />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
