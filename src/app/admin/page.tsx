'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import AIConfig from '@/components/admin/config/AIConfig';
import CategoryConfig from '@/components/admin/config/CategoryConfig';
import LiveConfig from '@/components/admin/config/LiveConfig';
import NetdiskConfig from '@/components/admin/config/NetdiskConfig';
import OwnerConfig from '@/components/admin/config/OwnerConfig';
import SiteConfig from '@/components/admin/config/SiteConfig';
import TMDBConfig from '@/components/admin/config/TMDBConfig';
import TVBoxConfig from '@/components/admin/config/TVBoxConfig';
import UserConfig from '@/components/admin/config/UserConfig';
import VideoConfig from '@/components/admin/config/VideoConfig';
import YellowConfig from '@/components/admin/config/YellowConfig';
import CacheManager from '@/components/admin/tools/CacheManager';
import ConfigFile from '@/components/admin/tools/ConfigFile';
import DataMigration from '@/components/admin/tools/DataMigration';
import AdFilterConfig from '@/components/admin/config/AdFilterConfig';
import PageLayout from '@/components/PageLayout';

import dynamic from 'next/dynamic';

// 动态导入所有组件
const ConfigFileDynamic = dynamic(
  () => import('@/components/admin/tools/ConfigFile'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const SiteConfigDynamic = dynamic(
  () => import('@/components/admin/config/SiteConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const UserConfigDynamic = dynamic(
  () => import('@/components/admin/config/UserConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const VideoConfigDynamic = dynamic(
  () => import('@/components/admin/config/VideoConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const LiveConfigDynamic = dynamic(
  () => import('@/components/admin/config/LiveConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const CategoryConfigDynamic = dynamic(
  () => import('@/components/admin/config/CategoryConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const YellowConfigDynamic = dynamic(
  () => import('@/components/admin/config/YellowConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const TMDBConfigDynamic = dynamic(
  () => import('@/components/admin/config/TMDBConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const AIConfigDynamic = dynamic(
  () => import('@/components/admin/config/AIConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const TVBoxConfigDynamic = dynamic(
  () => import('@/components/admin/config/TVBoxConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const NetdiskConfigDynamic = dynamic(
  () => import('@/components/admin/config/NetdiskConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const AdFilterConfigDynamic = dynamic(
  () => import('@/components/admin/config/AdFilterConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const CacheManagerDynamic = dynamic(
  () => import('@/components/admin/tools/CacheManager'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const DataMigrationDynamic = dynamic(
  () => import('@/components/admin/tools/DataMigration'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);
const OwnerConfigDynamic = dynamic(
  () => import('@/components/admin/config/OwnerConfig'),
  {
    loading: () => (
      <div className='flex items-center justify-center py-16'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-500'>加载中...</span>
      </div>
    ),
    ssr: false,
  },
);

// 配置项数据
const configCategories = {
  basic: {
    name: '基础服务',
    items: [
      { id: 'configFile', name: '配置管理', component: ConfigFileDynamic },
      { id: 'siteConfig', name: '站点配置', component: SiteConfigDynamic },
      { id: 'userConfig', name: '用户配置', component: UserConfigDynamic },
    ],
  },
  content: {
    name: '内容管理',
    items: [
      { id: 'videoConfig', name: '视频采集', component: VideoConfigDynamic },
      { id: 'liveConfig', name: '直播配置', component: LiveConfigDynamic },
      {
        id: 'categoryConfig',
        name: '分类配置',
        component: CategoryConfigDynamic,
      },
      { id: 'yellowConfig', name: '18+过滤', component: YellowConfigDynamic },
    ],
  },
  service: {
    name: '服务配置',
    items: [
      { id: 'tmdbConfig', name: 'TMDB配置', component: TMDBConfigDynamic },
      { id: 'aiConfig', name: 'AI配置', component: AIConfigDynamic },
      { id: 'tvboxConfig', name: 'TVBox配置', component: TVBoxConfigDynamic },
      {
        id: 'netdiskConfig',
        name: '网盘配置',
        component: NetdiskConfigDynamic,
      },
      {
        id: 'adFilterConfig',
        name: '广告过滤',
        component: AdFilterConfigDynamic,
      },
    ],
  },
  tools: {
    name: '系统工具',
    items: [
      { id: 'cacheManager', name: '缓存管理', component: CacheManagerDynamic },
      {
        id: 'dataMigration',
        name: '数据迁移',
        component: DataMigrationDynamic,
      },
    ],
  },
  owner: {
    name: '站长管理',
    items: [
      { id: 'ownerConfig', name: '站长配置', component: OwnerConfigDynamic },
    ],
  },
};

function AdminContent() {
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();

  const [activeCategory, setActiveCategory] =
    useState<keyof typeof configCategories>('basic');
  const [activeItem, setActiveItem] = useState<string>('configFile');

  // 为分类选择器创建refs和状态
  const categoryContainerRef = useRef<HTMLDivElement>(null);
  const categoryButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [categoryIndicatorStyle, setCategoryIndicatorStyle] = useState<{
    transform: string;
    width: string;
  }>({ transform: 'translateX(0)', width: '0px' });

  // 为项目选择器创建refs和状态
  const itemContainerRef = useRef<HTMLDivElement>(null);
  const itemButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [itemIndicatorStyle, setItemIndicatorStyle] = useState<{
    transform: string;
    width: string;
  }>({ transform: 'translateX(0)', width: '0px' });

  // 更新指示器位置的函数（优化版）
  const updateIndicatorPosition = (
    activeIndex: number,
    containerRef: React.RefObject<HTMLDivElement>,
    buttonRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>,
    setIndicatorStyle: React.Dispatch<
      React.SetStateAction<{ transform: string; width: string }>
    >,
  ) => {
    if (activeIndex < 0 || !buttonRefs.current[activeIndex] || !containerRef.current) {
      return;
    }

    // 使用 requestAnimationFrame 确保在正确的时机更新
    requestAnimationFrame(() => {
      const button = buttonRefs.current[activeIndex];
      const container = containerRef.current;
      if (!button || !container) return;

      const buttonRect = button.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // 计算相对位置
      const left = buttonRect.left - containerRect.left;
      const width = buttonRect.width;

      // 使用 transform 代替 left，GPU加速
      setIndicatorStyle({
        transform: `translateX(${left}px)`,
        width: `${width}px`,
      });
    });
  };

  useEffect(() => {
    setIsClient(true);

    // 单次权限验证
    const checkAccess = async () => {
      if (typeof window === 'undefined') return;

      // 先使用客户端cookie判断
      const authInfo = getAuthInfoFromBrowserCookie();
      const hasRole = authInfo?.role === 'admin' || authInfo?.role === 'owner';
      setHasAccess(hasRole || false);

      // 异步验证服务器权限，但不改变页面状态
      fetch('/api/admin/config')
        .then(async (res) => {
          if (!res.ok) {
            if (res.status === 401) {
              console.warn('无权限访问管理页面');
            } else {
              console.warn('服务器验证失败:', res.status);
            }
            return;
          }
          const data = await res.json();
          // 只在服务器确认权限时更新，失败时不改变
          if (data.Role) {
            setHasAccess(true);
          }
        })
        .catch((error) => {
          console.warn('权限验证网络错误:', error);
        });
    };
    checkAccess();
  }, []);

  // 无权限跳转逻辑
  useEffect(() => {
    if (isClient && hasAccess === false) {
      const timer = setTimeout(() => {
        router.push('/');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isClient, hasAccess, router]);

  // 监听分类变化
  useEffect(() => {
    const categories = Object.keys(
      configCategories,
    ) as (keyof typeof configCategories)[];
    const activeIndex = categories.findIndex((cat) => cat === activeCategory);
    updateIndicatorPosition(
      activeIndex,
      categoryContainerRef,
      categoryButtonRefs,
      setCategoryIndicatorStyle,
    );
  }, [activeCategory]);

  // 监听项目变化
  useEffect(() => {
    const items = configCategories[activeCategory].items;
    const activeIndex = items.findIndex((item) => item.id === activeItem);
    updateIndicatorPosition(
      activeIndex,
      itemContainerRef,
      categoryButtonRefs,
      setItemIndicatorStyle,
    );
  }, [activeItem, activeCategory]);

  // 在客户端渲染之前，显示加载状态
  if (!isClient || hasAccess === null) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3'></div>
        <span className='text-gray-600 dark:text-gray-400'>验证权限中...</span>
      </div>
    );
  }

  // 无权限状态
  if (!hasAccess) {
    return (
      <div className='flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900'>
        <div className='text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg'>
          <div className='text-6xl mb-4'>🔒</div>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2'>
            无权限访问
          </h1>
          <p className='text-gray-600 dark:text-gray-400 mb-4'>
            您没有权限访问管理中心
          </p>
          <p className='text-sm text-gray-500 dark:text-gray-500'>
            3秒后自动跳转到首页...
          </p>
        </div>
      </div>
    );
  }

  // 渲染胶囊式选择器
  const renderCapsuleSelector = (
    options: Array<{ id: string; name: string }>,
    activeValue: string,
    onChange: (value: string) => void,
    containerRef: React.RefObject<HTMLDivElement>,
    buttonRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>,
    indicatorStyle: { transform: string; width: string },
  ) => {
    return (
      <div
        ref={containerRef}
        className='relative inline-flex bg-gray-200/60 rounded-full p-0.5 sm:p-1 dark:bg-gray-700/60 backdrop-blur-sm'
      >
        {/* 滑动的白色背景指示器 - 使用 transform 优化性能 */}
        {indicatorStyle.width !== '0px' && (
          <div
            className='absolute top-0.5 bottom-0.5 sm:top-1 sm:bottom-1 left-0 bg-white dark:bg-gray-500 rounded-full shadow-sm will-change-transform'
            style={{
              transform: indicatorStyle.transform,
              width: indicatorStyle.width,
              transition: 'transform 300ms ease-out, width 300ms ease-out',
            }}
          />
        )}

        {options.map((option, index) => {
          const isActive = activeValue === option.id;
          return (
            <button
              key={option.id}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              onClick={() => onChange(option.id)}
              className={`relative z-10 px-2 py-1 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap ${
                isActive
                  ? 'text-gray-900 dark:text-gray-100 cursor-default'
                  : 'text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 cursor-pointer'
              }`}
            >
              {option.name}
            </button>
          );
        })}
      </div>
    );
  };

  // 获取当前选中的组件
  const currentCategory = configCategories[activeCategory];
  const currentItem = currentCategory.items.find(
    (item) => item.id === activeItem,
  );
  const CurrentComponent = currentItem?.component;

  return (
    <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible'>
      {/* 页面标题 */}
      <div className='mb-6 sm:mb-8 space-y-4 sm:space-y-6'>
        <div>
          <h1 className='text-2xl sm:text-3xl font-bold text-gray-800 mb-1 sm:mb-2 dark:text-gray-200'>
            管理中心
          </h1>
          <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>
            配置和管理您的站点
          </p>
        </div>
      </div>

      {/* 筛选器区域 */}
      <div className='relative bg-gradient-to-br from-white/80 via-blue-50/30 to-purple-50/30 dark:from-gray-800/60 dark:via-blue-900/20 dark:to-purple-900/20 rounded-2xl p-4 sm:p-6 border border-blue-200/40 dark:border-blue-700/40 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 mb-6'>
        {/* 装饰性光晕 */}
        <div className='absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-blue-300/20 to-purple-300/20 rounded-full blur-3xl pointer-events-none'></div>
        <div className='absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-green-300/20 to-teal-300/20 rounded-full blur-3xl pointer-events-none'></div>

        <div className='relative space-y-4'>
          {/* 分类选择器 */}
          <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
            <span className='text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]'>
              分类
            </span>
            <div className='overflow-x-auto'>
              {renderCapsuleSelector(
                Object.entries(configCategories).map(([key, value]) => ({
                  id: key,
                  name: value.name,
                })),
                activeCategory,
                (value) => {
                  setActiveCategory(value as keyof typeof configCategories);
                  // 自动选择第一个项目
                  const firstItem =
                    configCategories[value as keyof typeof configCategories]
                      .items[0];
                  if (firstItem) {
                    setActiveItem(firstItem.id);
                  }
                },
                categoryContainerRef,
                categoryButtonRefs,
                categoryIndicatorStyle,
              )}
            </div>
          </div>

          {/* 项目选择器 */}
          <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
            <span className='text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 min-w-[48px]'>
              配置
            </span>
            <div className='overflow-x-auto'>
              {renderCapsuleSelector(
                currentCategory.items,
                activeItem,
                setActiveItem,
                itemContainerRef,
                itemButtonRefs,
                itemIndicatorStyle,
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 内容展示区域 */}
      <div className='max-w-7xl mx-auto rounded-2xl shadow-sm border border-gray-200/30 dark:border-gray-700/30'>
        {CurrentComponent && <CurrentComponent />}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <PageLayout activePath='/admin'>
      <AdminContent />
    </PageLayout>
  );
}
