/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Calendar, ChevronRight, Film, Tv, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  BangumiCalendarData,
  GetBangumiCalendarData,
} from '@/lib/bangumi.client';
import { getDoubanCategories } from '@/lib/douban.client';
import { logger } from '@/lib/logger';
import { getPosterCarouselData } from '@/lib/poster-carousel.client';
import { DoubanItem } from '@/lib/types';
import { useFeaturePermission } from '@/hooks/useFeaturePermission';

import ContinueWatching from '@/components/ContinueWatching';
import FloatingTools from '@/components/FloatingTools';
import PageLayout from '@/components/PageLayout';
import PosterCarousel from '@/components/PosterCarousel';
import ScrollableRow from '@/components/ScrollableRow';
import SectionTitle from '@/components/SectionTitle';
import { useSite } from '@/components/SiteProvider';
import SkeletonCard from '@/components/SkeletonCard';
import VideoCard from '@/components/VideoCard';

function HomeClient() {
  const { hasPermission } = useFeaturePermission();

  // 功能启用状态（从全局配置读取）
  const isAIEnabled =
    typeof window !== 'undefined'
      ? ((window as any).RUNTIME_CONFIG.AIConfig?.enabled ?? false)
      : false;
  const [hotMovies, setHotMovies] = useState<DoubanItem[]>([]);
  const [hotTvShows, setHotTvShows] = useState<DoubanItem[]>([]);
  const [hotVarietyShows, setHotVarietyShows] = useState<DoubanItem[]>([]);
  const [bangumiCalendarData, setBangumiCalendarData] = useState<
    BangumiCalendarData[]
  >([]);
  const [posterCarouselData, setPosterCarouselData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { announcement } = useSite();

  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [tmdbPostersEnabled, setTmdbPostersEnabled] = useState(false);

  // 认证检查现在由中间件处理，无需在客户端重复检查

  // 检查公告弹窗状态
  useEffect(() => {
    if (typeof window !== 'undefined' && announcement) {
      const hasSeenAnnouncement = localStorage.getItem('hasSeenAnnouncement');
      if (hasSeenAnnouncement !== announcement) {
        setShowAnnouncement(true);
      } else {
        setShowAnnouncement(Boolean(!hasSeenAnnouncement && announcement));
      }
    }
  }, [announcement]);

  // 检查TMDB海报功能是否启用
  useEffect(() => {
    const checkTMDBStatus = async () => {
      try {
        // 发送一个测试请求来检查TMDB海报功能状态
        const response = await fetch('/api/tmdb/posters?category=movie');

        if (response.status === 403) {
          setTmdbPostersEnabled(false);
        } else if (response.ok) {
          setTmdbPostersEnabled(true);
        } else {
          setTmdbPostersEnabled(false);
        }
      } catch (error) {
        // 发生错误时默认不启用
        logger.error('检查 TMDB 状态失败:', error);
      }
    };

    checkTMDBStatus();
  }, []);

  useEffect(() => {
    const fetchRecommendData = async () => {
      try {
        setLoading(true);

        // 并行获取热门电影、热门剧集、热门综艺和海报轮播数据
        const [
          moviesData,
          tvShowsData,
          varietyShowsData,
          bangumiCalendarData,
          posterData,
        ] = await Promise.allSettled([
          getDoubanCategories({
            kind: 'movie',
            category: '热门',
            type: '全部',
          }),
          getDoubanCategories({ kind: 'tv', category: 'tv', type: 'tv' }),
          getDoubanCategories({ kind: 'tv', category: 'show', type: 'show' }),
          GetBangumiCalendarData(),
          getPosterCarouselData(),
        ]);

        // 处理电影数据
        if (
          moviesData.status === 'fulfilled' &&
          moviesData.value?.code === 200
        ) {
          setHotMovies(moviesData.value.list);
        } else {
          setHotMovies([]);
        }

        // 处理剧集数据
        if (
          tvShowsData.status === 'fulfilled' &&
          tvShowsData.value?.code === 200
        ) {
          setHotTvShows(tvShowsData.value.list);
        } else {
          setHotTvShows([]);
        }

        // 处理综艺数据
        if (
          varietyShowsData.status === 'fulfilled' &&
          varietyShowsData.value?.code === 200
        ) {
          setHotVarietyShows(varietyShowsData.value.list);
        } else {
          setHotVarietyShows([]);
        }

        // 处理bangumi数据，防止接口失败导致页面崩溃
        if (
          bangumiCalendarData.status === 'fulfilled' &&
          Array.isArray(bangumiCalendarData.value)
        ) {
          setBangumiCalendarData(bangumiCalendarData.value);
        } else {
          setBangumiCalendarData([]);
        }

        // 处理海报轮播数据
        if (
          posterData.status === 'fulfilled' &&
          posterData.value &&
          posterData.value.posters
        ) {
          setPosterCarouselData(posterData.value.posters);
        } else {
          setPosterCarouselData([]);
        }
      } catch (error) {
        // 静默处理错误
        logger.error('获取推荐数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendData();
  }, []);

  const handleCloseAnnouncement = (announcement: string) => {
    setShowAnnouncement(false);
    localStorage.setItem('hasSeenAnnouncement', announcement); // 记录已查看弹窗
  };

  return (
    <PageLayout>
      <div className='px-2 sm:px-10 py-4 sm:py-8 overflow-visible bg-transparent'>
        {/* 海报轮播 */}
        <PosterCarousel posters={posterCarouselData} loading={loading} />

        <div className='max-w-[95%] mx-auto'>
          {/* 继续观看 */}
          <ContinueWatching />

          {/* 热门电影 */}
          <section className='mb-8'>
            <div className='mb-4 flex items-center justify-between'>
              <SectionTitle
                title='热门电影'
                icon={Film}
                iconColor='text-red-500'
              />
              <Link
                href='/douban?type=movie'
                className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
              >
                查看更多
                <ChevronRight className='w-4 h-4 ml-1' />
              </Link>
            </div>
            <ScrollableRow>
              {loading
                ? // 加载状态显示灰色占位数据
                  Array.from({ length: 8 }).map((_, index) => (
                    <SkeletonCard key={index} />
                  ))
                : // 显示真实数据
                  hotMovies.map((movie, index) => (
                    <div
                      key={index}
                      className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
                    >
                      <VideoCard
                        from='douban'
                        title={movie.title}
                        poster={movie.poster}
                        douban_id={Number(movie.id)}
                        rate={movie.rate}
                        year={movie.year}
                        type='movie'
                      />
                    </div>
                  ))}
            </ScrollableRow>
          </section>

          {/* 热门剧集 */}
          <section className='mb-8'>
            <div className='mb-4 flex items-center justify-between'>
              <SectionTitle
                title='热门剧集'
                icon={Tv}
                iconColor='text-blue-500'
              />
              <Link
                href='/douban?type=tv'
                className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
              >
                查看更多
                <ChevronRight className='w-4 h-4 ml-1' />
              </Link>
            </div>
            <ScrollableRow>
              {loading
                ? // 加载状态显示灰色占位数据
                  Array.from({ length: 8 }).map((_, index) => (
                    <SkeletonCard key={index} />
                  ))
                : // 显示真实数据
                  hotTvShows.map((show, index) => (
                    <div
                      key={index}
                      className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
                    >
                      <VideoCard
                        from='douban'
                        title={show.title}
                        poster={show.poster}
                        douban_id={Number(show.id)}
                        rate={show.rate}
                        year={show.year}
                        type='tv'
                      />
                    </div>
                  ))}
            </ScrollableRow>
          </section>

          {/* 每日新番放送 */}
          <section className='mb-8'>
            <div className='mb-4 flex items-center justify-between'>
              <SectionTitle
                title='新番放送'
                icon={Calendar}
                iconColor='text-purple-500'
              />
              <Link
                href='/douban?type=anime'
                className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
              >
                查看更多
                <ChevronRight className='w-4 h-4 ml-1' />
              </Link>
            </div>
            <ScrollableRow>
              {loading
                ? // 加载状态显示灰色占位数据
                  Array.from({ length: 8 }).map((_, index) => (
                    <SkeletonCard key={index} />
                  ))
                : // 展示当前日期的番剧
                  (() => {
                    // 获取当前日期对应的星期
                    const today = new Date();
                    const weekdays = [
                      'Sun',
                      'Mon',
                      'Tue',
                      'Wed',
                      'Thu',
                      'Fri',
                      'Sat',
                    ];
                    const currentWeekday = weekdays[today.getDay()];

                    // 找到当前星期对应的番剧数据
                    const todayAnimes =
                      bangumiCalendarData.find(
                        (item) => item.weekday.en === currentWeekday,
                      )?.items || [];

                    return todayAnimes.map((anime, index) => (
                      <div
                        key={`${anime.id}-${index}`}
                        className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
                      >
                        <VideoCard
                          from='douban'
                          title={anime.name_cn || anime.name}
                          poster={
                            anime.images?.large ||
                            anime.images?.common ||
                            anime.images?.medium ||
                            anime.images?.small ||
                            anime.images?.grid ||
                            '/placeholder-poster.jpg'
                          }
                          douban_id={anime.id}
                          rate={anime.rating?.score?.toFixed(1) || ''}
                          year={anime.air_date?.split('-')?.[0] || ''}
                          type='anime'
                          isBangumi={true}
                        />
                      </div>
                    ));
                  })()}
            </ScrollableRow>
          </section>

          {/* 热门综艺 */}
          <section className='mb-8'>
            <div className='mb-4 flex items-center justify-between'>
              <SectionTitle
                title='热门综艺'
                icon={Tv}
                iconColor='text-pink-500'
              />
              <Link
                href='/douban?type=show'
                className='flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors'
              >
                查看更多
                <ChevronRight className='w-4 h-4 ml-1' />
              </Link>
            </div>
            <ScrollableRow>
              {loading
                ? // 加载状态显示灰色占位数据
                  Array.from({ length: 8 }).map((_, index) => (
                    <SkeletonCard key={index} />
                  ))
                : // 显示真实数据
                  hotVarietyShows.map((show, index) => (
                    <div
                      key={index}
                      className='min-w-[96px] w-24 sm:min-w-[180px] sm:w-44'
                    >
                      <VideoCard
                        from='douban'
                        title={show.title}
                        poster={show.poster}
                        douban_id={Number(show.id)}
                        rate={show.rate}
                        year={show.year}
                        type='variety'
                      />
                    </div>
                  ))}
            </ScrollableRow>
          </section>
        </div>
      </div>
      {announcement && showAnnouncement && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm dark:bg-black/70 p-4 transition-opacity duration-300 ${
            showAnnouncement ? '' : 'opacity-0 pointer-events-none'
          }`}
          onTouchStart={(e) => {
            // 如果点击的是背景区域，阻止触摸事件冒泡，防止背景滚动
            if (e.target === e.currentTarget) {
              e.preventDefault();
            }
          }}
          onTouchMove={(e) => {
            // 如果触摸的是背景区域，阻止触摸移动，防止背景滚动
            if (e.target === e.currentTarget) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onTouchEnd={(e) => {
            // 如果触摸的是背景区域，阻止触摸结束事件，防止背景滚动
            if (e.target === e.currentTarget) {
              e.preventDefault();
            }
          }}
          style={{
            touchAction: 'none', // 禁用所有触摸操作
          }}
        >
          <div
            className='w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900 transform transition-all duration-300 hover:shadow-2xl'
            onTouchMove={(e) => {
              // 允许公告内容区域正常滚动，阻止事件冒泡到外层
              e.stopPropagation();
            }}
            style={{
              touchAction: 'auto', // 允许内容区域的正常触摸操作
            }}
          >
            <div className='flex justify-between items-start mb-4'>
              <h3 className='text-2xl font-bold tracking-tight text-gray-800 dark:text-white border-b border-green-500 pb-1'>
                提示
              </h3>
              <button
                onClick={() => handleCloseAnnouncement(announcement)}
                className='text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-white transition-colors'
                aria-label='关闭'
              >
                <X className='w-5 h-5' />
              </button>
            </div>
            <div className='mb-6'>
              <div className='relative overflow-hidden rounded-lg mb-4 bg-green-50 dark:bg-green-900/20'>
                <div className='absolute inset-y-0 left-0 w-1.5 bg-green-500 dark:bg-green-400'></div>
                <p className='ml-4 text-gray-600 dark:text-gray-300 leading-relaxed'>
                  {announcement}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleCloseAnnouncement(announcement)}
              className='w-full rounded-lg bg-gradient-to-r from-green-600 to-green-700 px-4 py-3 text-white font-medium shadow-md hover:shadow-lg hover:from-green-700 hover:to-green-800 dark:from-green-600 dark:to-green-700 dark:hover:from-green-700 dark:hover:to-green-800 transition-all duration-300 transform hover:-translate-y-0.5'
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      {/* 浮动工具组 */}
      <FloatingTools
        showAI={isAIEnabled && hasPermission('ai-recommend')} // 根据功能配置和用户权限显示AI
        showBackToTop={true}
      />
    </PageLayout>
  );
}

export default function Home() {
  return <HomeClient />;
}
