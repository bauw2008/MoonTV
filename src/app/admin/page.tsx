'use client';

import { Suspense } from 'react';

import { AIConfig } from '@/components/admin/config/AIConfig';
import { CategoryConfig } from '@/components/admin/config/CategoryConfig';
import { LiveConfig } from '@/components/admin/config/LiveConfig';
import { NetdiskConfig } from '@/components/admin/config/NetdiskConfig';
import { OwnerConfig } from '@/components/admin/config/OwnerConfig';
import { SiteConfig } from '@/components/admin/config/SiteConfig';
import { TMDBConfig } from '@/components/admin/config/TMDBConfig';
import { TVBoxConfig } from '@/components/admin/config/TVBoxConfig';
import UserConfig from '@/components/admin/config/UserConfig';
import { VideoConfig } from '@/components/admin/config/VideoConfig';
import { YellowConfig } from '@/components/admin/config/YellowConfig';
import { CacheManager } from '@/components/admin/tools/CacheManager';
import { ConfigFile } from '@/components/admin/tools/ConfigFile';
import { DataMigration } from '@/components/admin/tools/DataMigration';
import AdminAccessGuard from '@/components/AdminAccessGuard';
import PageLayout from '@/components/PageLayout';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function AdminPage() {
  // 管理员设置状态

  return (
    <AdminAccessGuard requiredRole='admin'>
      <PageLayout activePath='/admin'>
        <div className='p-6'>
          <div className='max-w-7xl mx-auto'>
            {/* 管理员设置区域 */}
            <div className='bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-xl backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 p-6 mb-8'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center space-x-3'>
                  <div className='p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg'>
                    <svg
                      className='w-6 h-6 text-white'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
                      />
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                      />
                    </svg>
                  </div>
                  <h1 className='text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent'>
                    管理员设置
                  </h1>
                </div>

                {/* 主题切换按钮 */}
                <ThemeToggle />
              </div>
            </div>

            {/* 管理模块卡片网格布局 */}
            <div className='max-w-7xl mx-auto'>
              {/* 基础配置组 */}
              <div className='mb-8'>
                <h3 className='text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4 flex items-center'>
                  <div className='w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mr-2 shadow-sm'></div>
                  <svg
                    className='w-5 h-5 text-blue-500 mr-2'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                    />
                  </svg>
                  基础配置
                </h3>
                {/* 配置组件网格 - 所有配置始终可见 */}
                <div className='space-y-6'>
                  {/* 配置管理 */}
                  <Suspense
                    fallback={
                      <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                        加载中...
                      </div>
                    }
                  >
                    <ConfigFile />
                  </Suspense>

                  {/* 站点配置 */}
                  <Suspense
                    fallback={
                      <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                        加载中...
                      </div>
                    }
                  >
                    <SiteConfig />
                  </Suspense>

                  {/* 用户配置 */}
                  <Suspense
                    fallback={
                      <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                        加载中...
                      </div>
                    }
                  >
                    <UserConfig />
                  </Suspense>
                </div>
              </div>

              {/* 内容配置组 */}
              <div className='mb-8'>
                <h3 className='text-lg font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-4 flex items-center'>
                  <div className='w-2 h-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mr-2 shadow-sm'></div>
                  <svg
                    className='w-5 h-5 text-green-500 mr-2'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
                    />
                  </svg>
                  内容配置
                </h3>
                {/* 配置组件网格 - 所有配置始终可见 */}
                <div className='space-y-6'>
                  {/* 视频配置 */}
                  <Suspense
                    fallback={
                      <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                        加载中...
                      </div>
                    }
                  >
                    <VideoConfig />
                  </Suspense>

                  {/* 直播配置 */}
                  <Suspense
                    fallback={
                      <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                        加载中...
                      </div>
                    }
                  >
                    <LiveConfig />
                  </Suspense>

                  {/* 分类配置 */}
                  <Suspense
                    fallback={
                      <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                        加载中...
                      </div>
                    }
                  >
                    <CategoryConfig />
                  </Suspense>

                  {/* 18+配置 */}
                  <Suspense
                    fallback={
                      <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                        加载中...
                      </div>
                    }
                  >
                    <YellowConfig />
                  </Suspense>

                  {/* 网盘配置 */}
                  <Suspense
                    fallback={
                      <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                        加载中...
                      </div>
                    }
                  >
                    <NetdiskConfig />
                  </Suspense>
                </div>
              </div>

              {/* 服务配置组 */}
              <div className='mb-8'>
                <h3 className='text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4 flex items-center'>
                  <div className='w-2 h-2 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full mr-2 shadow-sm'></div>
                  <svg
                    className='w-5 h-5 text-purple-500 mr-2'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4'
                    />
                  </svg>
                  服务配置
                </h3>
                {/* 配置组件网格 - 所有配置始终可见 */}
                <div className='space-y-6'>
                  {/* TMDB配置 */}
                  <Suspense
                    fallback={
                      <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                        加载中...
                      </div>
                    }
                  >
                    <TMDBConfig />
                  </Suspense>

                  {/* AI配置 */}
                  <Suspense
                    fallback={
                      <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                        加载中...
                      </div>
                    }
                  >
                    <AIConfig />
                  </Suspense>

                  {/* TVBox配置 */}
                  <Suspense
                    fallback={
                      <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                        加载中...
                      </div>
                    }
                  >
                    <TVBoxConfig />
                  </Suspense>
                </div>
              </div>

              {/* 系统工具组 */}
              <div className='mb-8'>
                <h3 className='text-lg font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-4 flex items-center'>
                  <div className='w-2 h-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-full mr-2 shadow-sm'></div>
                  <svg
                    className='w-5 h-5 text-orange-500 mr-2'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z'
                    />
                  </svg>
                  系统工具
                </h3>
                {/* 配置组件网格 - 所有配置始终可见 */}
                <div className='space-y-6'>
                  {/* 缓存管理 */}
                  <Suspense
                    fallback={
                      <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                        加载中...
                      </div>
                    }
                  >
                    <CacheManager />
                  </Suspense>

                  {/* 数据迁移 */}
                  <Suspense
                    fallback={
                      <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                        加载中...
                      </div>
                    }
                  >
                    <DataMigration />
                  </Suspense>
                </div>
              </div>

              {/* 站长工具 */}
              <div className='mb-8'>
                <h3 className='text-lg font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent mb-4 flex items-center'>
                  <div className='w-2 h-2 bg-gradient-to-r from-red-500 to-pink-500 rounded-full mr-2 shadow-sm'></div>
                  <svg
                    className='w-5 h-5 text-red-500 mr-2'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
                    />
                  </svg>
                  站长工具
                </h3>
                {/* 站长配置组件 - 只有站长可见 */}
                <Suspense
                  fallback={
                    <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                      加载中...
                    </div>
                  }
                >
                  <OwnerConfig />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </PageLayout>
    </AdminAccessGuard>
  );
}
