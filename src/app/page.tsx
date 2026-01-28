/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { Clapperboard, Compass, Film, Radio, Tv, Tv2, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';

import { getAllPlayRecords } from '@/lib/db.client';
import { logger } from '@/lib/logger';
import { getPosterCarouselData } from '@/lib/poster-carousel.client';
import { useFeaturePermission } from '@/hooks/useFeaturePermission';

import ContinueWatching from '@/components/ContinueWatching';
import FloatingTools from '@/components/FloatingTools';
import PageLayout from '@/components/PageLayout';
import PosterCarousel from '@/components/PosterCarousel';
import SectionTitle from '@/components/SectionTitle';
import { useSite } from '@/components/SiteProvider';

// 快速入口导航配置
const quickNavItems = [
  {
    title: '热门电影',
    icon: Film,
    color: 'bg-red-500/30',
    hoverColor: 'bg-red-500/50',
    iconColor: 'text-red-500',
    titleGradient: 'from-red-600 to-orange-500',
    href: '/douban?type=movie',
  },
  {
    title: '热门剧集',
    icon: Tv,
    color: 'bg-blue-500/30',
    hoverColor: 'bg-blue-500/50',
    iconColor: 'text-blue-500',
    titleGradient: 'from-blue-600 to-cyan-500',
    href: '/douban?type=tv',
  },
  {
    title: '每日新番',
    icon: Tv2,
    color: 'bg-purple-500/30',
    hoverColor: 'bg-purple-500/50',
    iconColor: 'text-purple-500',
    titleGradient: 'from-purple-600 to-pink-500',
    href: '/douban?type=anime',
  },
  {
    title: '热门综艺',
    icon: Clapperboard,
    color: 'bg-pink-500/30',
    hoverColor: 'bg-pink-500/50',
    iconColor: 'text-pink-500',
    titleGradient: 'from-pink-600 to-rose-500',
    href: '/douban?type=show',
  },
  {
    title: 'TVBox采集',
    icon: Radio,
    color: 'bg-green-500/30',
    hoverColor: 'bg-green-500/50',
    iconColor: 'text-green-500',
    titleGradient: 'from-green-600 to-emerald-500',
    href: '/tvbox',
  },
  {
    title: '随机短剧',
    icon: Compass,
    color: 'bg-yellow-500/30',
    hoverColor: 'bg-yellow-500/50',
    iconColor: 'text-yellow-500',
    titleGradient: 'from-yellow-600 to-amber-500',
    href: '/shortdrama',
  },
];

function HomeClient() {
  const { hasPermission } = useFeaturePermission();

  // 功能启用状态（从全局配置读取）
  const isAIEnabled =
    typeof window !== 'undefined'
      ? ((window as any).RUNTIME_CONFIG.AIConfig?.enabled ?? false)
      : false;
  const [posterCarouselData, setPosterCarouselData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPlayRecords, setHasPlayRecords] = useState<boolean | null>(null);
  const [, startTransition] = useTransition();
  const { announcement } = useSite();

  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [, setTmdbPostersEnabled] = useState(false);

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
          startTransition(() => {
            setTmdbPostersEnabled(false);
          });
        } else if (response.ok) {
          startTransition(() => {
            setTmdbPostersEnabled(true);
          });
        } else {
          startTransition(() => {
            setTmdbPostersEnabled(false);
          });
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

        // 获取海报轮播数据
        const posterData = await getPosterCarouselData();

        // 处理海报轮播数据
        if (posterData && posterData.posters) {
          startTransition(() => {
            setPosterCarouselData(posterData.posters);
          });
        } else {
          startTransition(() => {
            setPosterCarouselData([]);
          });
        }

        // 获取播放记录数据，用于判断是否显示快速导航
        const playRecords = await getAllPlayRecords();
        startTransition(() => {
          setHasPlayRecords(Object.keys(playRecords).length > 0);
        });
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

          {/* 快速入口导航 - 仅在无继续观看数据时显示 */}
          {hasPlayRecords === false && (
            <section className='mb-8'>
              <div className='mb-4'>
                <SectionTitle
                  title='快速导航'
                  icon={Compass}
                  iconColor='text-purple-500'
                />
              </div>
              <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4'>
                {quickNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className='group relative overflow-hidden rounded-xl p-6 transition-all duration-300 hover:scale-105 bg-transparent video-card-hover'
                    >
                      <div
                        className={`absolute inset-0 ${item.color} transition-all duration-300 group-hover:${item.hoverColor}`}
                      />
                      <div className='absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1500 ease-in-out' />
                      <div className='relative flex flex-col items-center justify-center'>
                        <Icon
                          className={`mb-3 h-10 w-10 transition-transform duration-300 group-hover:scale-110 ${item.iconColor}`}
                        />
                        <span
                          className={`text-sm font-semibold tracking-wide bg-gradient-to-r ${item.titleGradient} bg-clip-text text-transparent`}
                        >
                          {item.title}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
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
