'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { PlayRecord, PlayStatsResult } from '@/lib/types';

import PageLayout from '@/components/PageLayout';
// 用户等级系统
const USER_LEVELS = [
  {
    level: 1,
    name: '新星观众',
    icon: '🌟',
    minLogins: 1,
    maxLogins: 9,
    description: '刚刚开启观影之旅',
    gradient: 'from-slate-400 to-slate-600',
  },
  {
    level: 2,
    name: '常客影迷',
    icon: '🎬',
    minLogins: 10,
    maxLogins: 49,
    description: '热爱电影的观众',
    gradient: 'from-blue-400 to-blue-600',
  },
  {
    level: 3,
    name: '资深观众',
    icon: '📺',
    minLogins: 50,
    maxLogins: 199,
    description: '对剧集有独特品味',
    gradient: 'from-emerald-400 to-emerald-600',
  },
  {
    level: 4,
    name: '影院达人',
    icon: '🎭',
    minLogins: 200,
    maxLogins: 499,
    description: '深度电影爱好者',
    gradient: 'from-violet-400 to-violet-600',
  },
  {
    level: 5,
    name: '观影专家',
    icon: '🏆',
    minLogins: 500,
    maxLogins: 999,
    description: '拥有丰富观影经验',
    gradient: 'from-amber-400 to-amber-600',
  },
  {
    level: 6,
    name: '传奇影神',
    icon: '👑',
    minLogins: 1000,
    maxLogins: 2999,
    description: '影视界的传奇人物',
    gradient: 'from-red-400 via-red-500 to-red-600',
  },
  {
    level: 7,
    name: '殿堂影帝',
    icon: '💎',
    minLogins: 3000,
    maxLogins: 9999,
    description: '影视殿堂的至尊',
    gradient: 'from-pink-400 via-pink-500 to-pink-600',
  },
  {
    level: 8,
    name: '永恒之光',
    icon: '✨',
    minLogins: 10000,
    maxLogins: Infinity,
    description: '永恒闪耀的观影之光',
    gradient: 'from-indigo-400 via-purple-500 to-pink-500',
  },
];

function calculateUserLevel(loginCount: number) {
  // 0次登录的特殊处理
  if (loginCount === 0) {
    return {
      level: 0,
      name: '待激活',
      icon: '💤',
      minLogins: 0,
      maxLogins: 0,
      description: '尚未开始观影之旅',
      gradient: 'from-gray-400 to-gray-500',
    };
  }

  for (const level of USER_LEVELS) {
    if (loginCount >= level.minLogins && loginCount <= level.maxLogins) {
      return level;
    }
  }
  return USER_LEVELS[USER_LEVELS.length - 1];
}

function formatLoginDisplay(loginCount: number) {
  const userLevel = calculateUserLevel(loginCount);

  return {
    isSimple: false,
    level: userLevel,
    displayCount:
      loginCount === 0
        ? '0'
        : loginCount > 10000
          ? '10000+'
          : loginCount > 1000
            ? `${Math.floor(loginCount / 1000)}k+`
            : loginCount.toString(),
  };
}

const PlayStatsPage: React.FC = () => {
  const router = useRouter();
  const [statsData, setStatsData] = useState<PlayStatsResult | null>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [authInfo, setAuthInfo] = useState<{
    username?: string;
    role?: string;
  } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [activeTab, setActiveTab] = useState<'admin' | 'users' | 'personal'>(
    'admin',
  ); // 新增Tab状态

  // 检查用户权限
  useEffect(() => {
    const auth = getAuthInfoFromBrowserCookie();
    if (!auth?.username) {
      router.push('/login');
      return;
    }

    setAuthInfo(auth);
    const adminRole = auth.role === 'admin' || auth.role === 'owner';
    setIsAdmin(adminRole);
  }, [router]);

  // 时间格式化函数
  const formatTime = (seconds: number): string => {
    if (seconds === 0) {
      return '00:00';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.round(seconds % 60);

    if (hours === 0) {
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
        .toString()
        .padStart(2, '0')}`;
    } else {
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  };

  const formatDateTime = (timestamp: number): string => {
    if (!timestamp) {
      return '未知时间';
    }

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      return '时间格式错误';
    }

    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
    });
  };

  // 获取管理员统计数据（带缓存）
  const fetchAdminStats = useCallback(async () => {
    try {
      // 检查缓存
      const cacheKey = 'vidora_admin_stats_cache';
      const cachedData = localStorage.getItem(cacheKey);
      const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setStatsData(data);
          return; // 使用缓存数据
        }
      }

      const response = await fetch('/api/admin/play-stats');

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setStatsData(data);

      // 缓存数据
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        }),
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '获取播放统计失败';
      setError(errorMessage);
    }
  }, [router]);

  // 获取用户个人统计数据（带缓存）
  const fetchUserStats = useCallback(async () => {
    try {
      // 检查缓存
      const cacheKey = 'vidora_user_stats_cache';
      const cachedData = localStorage.getItem(cacheKey);
      const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setUserStats(data);
          return; // 使用缓存数据
        }
      }

      const response = await fetch('/api/user/my-stats');

      if (response.status === 401) {
        router.push('/login');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setUserStats(data);

      // 缓存数据
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        }),
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '获取个人统计失败';
      setError(errorMessage);
    }
  }, [router]);

  // 根据用户角色获取数据
  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (isAdmin) {
      await Promise.all([fetchAdminStats(), fetchUserStats()]);
    } else {
      await fetchUserStats();
    }

    setLoading(false);
  }, [isAdmin, fetchAdminStats, fetchUserStats]);

  // 添加防抖变量
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 处理刷新按钮点击
  const handleRefreshClick = async () => {
    // 防止重复点击
    if (isRefreshingRef.current) {
      return;
    }

    // 清除之前的定时器
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    isRefreshingRef.current = true;

    try {
      // 清除统计缓存
      localStorage.removeItem('vidora_user_stats_cache');
      localStorage.removeItem('vidora_admin_stats_cache');
      console.log('已清除统计缓存');

      // 重新获取统计数据
      await fetchStats();
      console.log('已重新获取统计数据');
    } catch (error) {
      console.error('刷新数据失败:', error);
    } finally {
      setLoading(false);
      isRefreshingRef.current = false;
    }
  };

  // 切换用户详情展开状态（仅管理员）
  const toggleUserExpanded = (username: string) => {
    setExpandedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(username)) {
        newSet.delete(username);
      } else {
        newSet.add(username);
      }
      return newSet;
    });
  };

  // 获取进度百分比
  const getProgressPercentage = (
    playTime: number,
    totalTime: number,
  ): number => {
    if (!totalTime || totalTime === 0) {
      return 0;
    }
    return Math.min(Math.round((playTime / totalTime) * 100), 100);
  };

  // 跳转到播放页面
  const handlePlayRecord = (record: PlayRecord) => {
    const searchTitle = record.search_title || record.title;
    const params = new URLSearchParams({
      title: record.title,
      year: record.year,
      stitle: searchTitle,
      stype: record.total_episodes > 1 ? 'tv' : 'movie',
    });

    router.push(`/play?${params.toString()}`);
  };

  // 检查是否支持播放统计
  const storageType =
    typeof window !== 'undefined' &&
    (window as any).RUNTIME_CONFIG?.STORAGE_TYPE
      ? (window as any).RUNTIME_CONFIG.STORAGE_TYPE
      : 'localstorage';

  useEffect(() => {
    if (authInfo) {
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authInfo]); // ✅ 只在 authInfo 变化时调用

  // 格式化更新时间
  const formatLastUpdate = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));

    if (minutes < 1) {
      return '刚刚更新';
    }
    if (minutes < 60) {
      return `${minutes}分钟前`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}小时前`;
    }

    const days = Math.floor(hours / 24);
    return `${days}天前`;
  };

  // 未授权时显示加载
  if (!authInfo) {
    return (
      <PageLayout activePath='/play-stats'>
        <div className='text-center py-12'>
          <div className='inline-flex items-center space-x-2 text-gray-600 dark:text-gray-400'>
            <svg
              className='w-6 h-6 animate-spin'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
              />
            </svg>
            <span>检查权限中...</span>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (loading) {
    return (
      <PageLayout activePath='/play-stats'>
        <div className='text-center py-12'>
          <div className='inline-flex items-center space-x-2 text-gray-600 dark:text-gray-400'>
            <svg
              className='w-6 h-6 animate-spin'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
              />
            </svg>
            <span>正在加载{isAdmin ? '播放统计' : '个人统计'}...</span>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (storageType === 'localstorage') {
    return (
      <PageLayout activePath='/play-stats'>
        <div className='max-w-6xl mx-auto px-4 py-8'>
          <div className='mb-8'>
            <h1 className='text-3xl font-bold text-gray-900 dark:text-white'>
              {isAdmin ? '播放统计' : '个人统计'}
            </h1>
            <p className='text-gray-600 dark:text-gray-400 mt-2'>
              {isAdmin
                ? '查看用户播放数据和趋势分析'
                : '查看您的个人播放记录和统计'}
            </p>
          </div>

          <div className='p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800'>
            <div className='flex items-center space-x-3'>
              <div className='text-yellow-600 dark:text-yellow-400'>
                <svg
                  className='w-6 h-6'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                  />
                </svg>
              </div>
              <div>
                <h3 className='text-lg font-semibold text-yellow-800 dark:text-yellow-300'>
                  统计功能不可用
                </h3>
                <p className='text-yellow-700 dark:text-yellow-400 mt-1'>
                  当前使用本地存储模式（localStorage），不支持统计功能。
                  <br />
                  如需使用此功能，请配置 Redis 或 Upstash 数据库存储。
                </p>
              </div>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  // 渲染管理员统计页面
  if (isAdmin && statsData && userStats) {
    return (
      <PageLayout activePath='/play-stats'>
        <div className='max-w-7xl mx-auto px-4 py-8'>
          {/* 页面标题和Tab切换 */}
          <div className='mb-8'>
            <div className='flex items-center space-x-3'>
              <h1 className='text-3xl font-bold text-gray-900 dark:text-white'>
                播放统计
              </h1>
              <button
                onClick={handleRefreshClick}
                disabled={loading}
                className='p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors'
                title='刷新数据'
              >
                <svg
                  className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                  />
                </svg>
              </button>
            </div>
            <p className='text-gray-600 dark:text-gray-400 mt-2'>
              {activeTab === 'admin'
                ? '查看全站播放数据和趋势分析'
                : activeTab === 'users'
                  ? '查看用户播放数据和统计信息'
                  : '查看您的个人播放记录和统计'}
            </p>

            {/* Tab 切换 */}
            <div className='mt-6 border-b border-gray-200 dark:border-gray-700'>
              <nav className='-mb-px flex space-x-8'>
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'admin'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  全站统计
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'users'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  用户统计
                </button>
                <button
                  onClick={() => setActiveTab('personal')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'personal'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  我的统计
                </button>
              </nav>
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className='mb-8 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800'>
              <div className='flex items-center space-x-3'>
                <div className='text-red-600 dark:text-red-400'>
                  <svg
                    className='w-5 h-5'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                    />
                  </svg>
                </div>
                <div>
                  <h4 className='text-sm font-medium text-red-800 dark:text-red-300'>
                    获取播放统计失败
                  </h4>
                  <p className='text-red-700 dark:text-red-400 text-sm mt-1'>
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 内容 */}
          {activeTab === 'admin' ? (
            /* 全站统计内容 */
            <>
              {/* 全站统计概览 */}
              <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4 mb-8'>
                <div className='p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800'>
                  <div className='text-2xl font-bold text-blue-800 dark:text-blue-300'>
                    {statsData.totalUsers}
                  </div>
                  <div className='text-sm text-blue-600 dark:text-blue-400'>
                    总用户数
                  </div>
                </div>
                <div className='p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800'>
                  <div className='text-2xl font-bold text-green-800 dark:text-green-300'>
                    {formatTime(statsData.totalWatchTime)}
                  </div>
                  <div className='text-sm text-green-600 dark:text-green-400'>
                    总观看时长
                  </div>
                </div>
                <div className='p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800'>
                  <div className='text-2xl font-bold text-purple-800 dark:text-purple-300'>
                    {statsData.totalPlays}
                  </div>
                  <div className='text-sm text-purple-600 dark:text-purple-400'>
                    总播放次数
                  </div>
                </div>
                <div className='p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800'>
                  <div className='text-2xl font-bold text-orange-800 dark:text-orange-300'>
                    {formatTime(statsData.avgWatchTimePerUser)}
                  </div>
                  <div className='text-sm text-orange-600 dark:text-orange-400'>
                    人均观看时长
                  </div>
                </div>
                <div className='p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800'>
                  <div className='text-2xl font-bold text-indigo-800 dark:text-indigo-300'>
                    {Math.round(statsData.avgPlaysPerUser)}
                  </div>
                  <div className='text-sm text-indigo-600 dark:text-indigo-400'>
                    人均播放次数
                  </div>
                </div>
                <div className='p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800'>
                  <div className='text-2xl font-bold text-red-800 dark:text-red-300'>
                    {statsData.registrationStats.todayNewUsers}
                  </div>
                  <div className='text-sm text-red-600 dark:text-red-400'>
                    今日新增用户
                  </div>
                </div>
                <div className='p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800'>
                  <div className='text-2xl font-bold text-cyan-800 dark:text-cyan-300'>
                    {statsData.activeUsers.daily}
                  </div>
                  <div className='text-sm text-cyan-600 dark:text-cyan-400'>
                    日活跃用户
                  </div>
                </div>
              </div>

              {/* 图表区域 */}
              <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8'>
                {/* 近7天趋势 */}
                <div className='p-6 bg-gradient-to-br from-blue-50/80 to-blue-100/60 dark:from-blue-900/40 dark:to-blue-800/30 backdrop-blur-md rounded-lg border border-blue-200/60 dark:border-blue-700/50 shadow-lg'>
                  <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>
                    近7天播放趋势
                  </h3>
                  <div className='space-y-3'>
                    {statsData.dailyStats.map((stat) => (
                      <div
                        key={stat.date}
                        className='flex items-center justify-between'
                      >
                        <span className='text-sm text-gray-600 dark:text-gray-400'>
                          {formatDate(stat.date)}
                        </span>
                        <div className='flex items-center space-x-4 text-sm'>
                          <span className='text-green-600 dark:text-green-400'>
                            {formatTime(stat.watchTime)}
                          </span>
                          <span className='text-purple-600 dark:text-purple-400'>
                            {stat.plays}次
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 近7天注册趋势 */}
                <div className='p-6 bg-gradient-to-br from-green-50/80 to-green-100/60 dark:from-green-900/40 dark:to-green-800/30 backdrop-blur-md rounded-lg border border-green-200/60 dark:border-green-700/50 shadow-lg'>
                  <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>
                    近7天注册趋势
                  </h3>
                  <div className='space-y-3'>
                    {statsData.registrationStats.registrationTrend.map(
                      (stat) => (
                        <div
                          key={stat.date}
                          className='flex items-center justify-between'
                        >
                          <span className='text-sm text-gray-600 dark:text-gray-400'>
                            {formatDate(stat.date)}
                          </span>
                          <div className='flex items-center space-x-2'>
                            <span className='text-sm text-blue-600 dark:text-blue-400'>
                              {stat.newUsers} 人
                            </span>
                            {stat.newUsers > 0 && (
                              <div className='w-2 h-2 bg-blue-500 rounded-full'></div>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>

              {/* 用户活跃度统计 */}
              <div className='p-6 bg-gradient-to-br from-purple-50/80 to-purple-100/60 dark:from-purple-900/40 dark:to-purple-800/30 backdrop-blur-md rounded-lg border border-purple-200/60 dark:border-purple-700/50 shadow-lg mb-8'>
                <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>
                  用户活跃度统计
                </h3>
                <div className='space-y-4'>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-gray-600 dark:text-gray-400'>
                      日活跃用户
                    </span>
                    <span className='text-lg font-semibold text-green-600 dark:text-green-400'>
                      {statsData.activeUsers.daily}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-gray-600 dark:text-gray-400'>
                      周活跃用户
                    </span>
                    <span className='text-lg font-semibold text-blue-600 dark:text-blue-400'>
                      {statsData.activeUsers.weekly}
                    </span>
                  </div>
                  <div className='flex items-center justify-between'>
                    <span className='text-sm text-gray-600 dark:text-gray-400'>
                      月活跃用户
                    </span>
                    <span className='text-lg font-semibold text-purple-600 dark:text-purple-400'>
                      {statsData.activeUsers.monthly}
                    </span>
                  </div>
                  <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-600'>
                    <div className='text-xs text-gray-500 dark:text-gray-400'>
                      活跃度 = 最近有播放记录的用户
                    </div>
                  </div>
                </div>
              </div>

              {/* 热门来源 */}
              <div className='p-6 bg-gradient-to-br from-orange-50/80 to-orange-100/60 dark:from-orange-900/40 dark:to-orange-800/30 backdrop-blur-md rounded-lg border border-orange-200/60 dark:border-orange-700/50 shadow-lg mb-8'>
                <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>
                  热门视频来源
                </h3>
                <div className='space-y-3'>
                  {statsData.topSources.map((source, index) => (
                    <div
                      key={source.source}
                      className='flex items-center justify-between'
                    >
                      <div className='flex items-center space-x-3'>
                        <span className='w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 rounded-full flex items-center justify-center text-xs font-bold'>
                          {index + 1}
                        </span>
                        <span className='text-sm text-gray-900 dark:text-white'>
                          {source.source}
                        </span>
                      </div>
                      <span className='text-sm text-gray-600 dark:text-gray-400'>
                        {source.count} 次
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : activeTab === 'users' ? (
            /* 用户统计内容 */
            <>
              {/* 用户播放统计 */}
              <div>
                <h3 className='text-xl font-semibold text-gray-900 dark:text-white mb-6'>
                  用户统计
                </h3>
                <div className='space-y-4'>
                  {statsData.userStats.map((userStat, index) => {
                    // 为每个用户生成不同的渐变背景
                    const gradients = [
                      'from-blue-50/60 to-cyan-100/40 dark:from-blue-900/30 dark:to-cyan-800/20',
                      'from-purple-50/60 to-pink-100/40 dark:from-purple-900/30 dark:to-pink-800/20',
                      'from-green-50/60 to-emerald-100/40 dark:from-green-900/30 dark:to-emerald-800/20',
                      'from-orange-50/60 to-amber-100/40 dark:from-orange-900/30 dark:to-amber-800/20',
                      'from-rose-50/60 to-pink-100/40 dark:from-rose-900/30 dark:to-pink-800/20',
                      'from-indigo-50/60 to-violet-100/40 dark:from-indigo-900/30 dark:to-violet-800/20',
                      'from-teal-50/60 to-cyan-100/40 dark:from-teal-900/30 dark:to-cyan-800/20',
                    ];
                    const gradientClass = gradients[index % gradients.length];

                    return (
                      <div
                        key={userStat.username}
                        className={`border border-gray-200/30 dark:border-gray-700/30 rounded-lg overflow-hidden bg-gradient-to-br ${gradientClass} backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300`}
                      >
                        {/* 用户概览行 */}
                        <div
                          className='p-4 cursor-pointer hover:bg-blue-100/20 dark:hover:bg-gray-700 transition-colors border-l-4 border-transparent hover:border-blue-500'
                          onClick={() => toggleUserExpanded(userStat.username)}
                        >
                          <div className='flex items-center justify-between'>
                            <div className='flex items-center space-x-4'>
                              <div className='flex-shrink-0 relative'>
                                {userStat.avatar ? (
                                  <Image
                                    src={userStat.avatar}
                                    alt={userStat.username}
                                    width={48}
                                    height={48}
                                    className='w-12 h-12 rounded-full object-cover ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-50 dark:ring-offset-gray-800'
                                    onError={(e) => {
                                      (
                                        e.target as HTMLImageElement
                                      ).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className='w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md'>
                                    <span className='text-sm font-bold text-white'>
                                      {userStat.username
                                        .charAt(0)
                                        .toUpperCase()}
                                    </span>
                                  </div>
                                )}
                                {/* 用户状态指示器 */}
                                <div
                                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
                                    userStat.lastPlayTime &&
                                    Date.now() - userStat.lastPlayTime <
                                      86400000
                                      ? 'bg-green-500'
                                      : 'bg-gray-400'
                                  }`}
                                ></div>
                              </div>
                              <div className='min-w-0 flex-1'>
                                <h5 className='text-sm font-bold text-gray-900 dark:text-gray-100 truncate mb-1'>
                                  {userStat.username}
                                </h5>
                                {isAdmin && (
                                  <div className='md:hidden mb-1'>
                                    <span className='text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-full flex items-center space-x-1'>
                                      <svg
                                        className='w-3 h-3'
                                        fill='none'
                                        stroke='currentColor'
                                        viewBox='0 0 24 24'
                                      >
                                        <path
                                          strokeLinecap='round'
                                          strokeLinejoin='round'
                                          strokeWidth='2'
                                          d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'
                                        />
                                        <path
                                          strokeLinecap='round'
                                          strokeLinejoin='round'
                                          strokeWidth='2'
                                          d='M15 11a3 3 0 11-6 0 3 3 0 016 0z'
                                        />
                                      </svg>
                                      <span>
                                        {userStat.loginIp || '未知IP'}
                                      </span>
                                    </span>
                                  </div>
                                )}
                                <div className='hidden md:flex items-center space-x-2 mb-1'>
                                  {isAdmin && (
                                    <span className='text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-full flex items-center space-x-1'>
                                      <svg
                                        className='w-3 h-3'
                                        fill='none'
                                        stroke='currentColor'
                                        viewBox='0 0 24 24'
                                      >
                                        <path
                                          strokeLinecap='round'
                                          strokeLinejoin='round'
                                          strokeWidth='2'
                                          d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'
                                        />
                                        <path
                                          strokeLinecap='round'
                                          strokeLinejoin='round'
                                          strokeWidth='2'
                                          d='M15 11a3 3 0 11-6 0 3 3 0 016 0z'
                                        />
                                      </svg>
                                      <span>
                                        {userStat.loginIp || '未知IP'}
                                      </span>
                                    </span>
                                  )}
                                </div>
                                <p className='text-xs text-gray-500 dark:text-gray-400'>
                                  最后播放:{' '}
                                  {userStat.lastPlayTime
                                    ? formatDateTime(userStat.lastPlayTime)
                                    : '从未播放'}
                                </p>
                                <p className='text-xs text-gray-500 dark:text-gray-400'>
                                  注册天数: {userStat.registrationDays} 天
                                </p>
                                <p className='text-xs text-gray-500 dark:text-gray-400'>
                                  最后登入:{' '}
                                  {userStat.lastLoginTime !== userStat.createdAt
                                    ? formatDateTime(userStat.lastLoginTime)
                                    : '注册时'}
                                </p>
                                <div className='text-xs text-gray-500 dark:text-gray-400'>
                                  {(() => {
                                    const loginCount = userStat.loginCount || 0;
                                    const loginDisplay =
                                      formatLoginDisplay(loginCount);

                                    return (
                                      <div className='space-y-1'>
                                        <div className='flex items-center gap-1.5'>
                                          <span className='text-base flex-shrink-0'>
                                            {loginDisplay.level.icon}
                                          </span>
                                          <span className='font-medium text-gray-700 dark:text-gray-300 text-xs leading-tight'>
                                            {loginDisplay.level.name}
                                          </span>
                                        </div>
                                        <div className='text-xs opacity-60'>
                                          {loginCount === 0
                                            ? '尚未登录'
                                            : `${loginDisplay.displayCount}次登录`}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                                {userStat.mostWatchedSource && (
                                  <p className='text-xs text-gray-500 dark:text-gray-400'>
                                    常用来源: {userStat.mostWatchedSource}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className='flex items-center space-x-6'>
                              <div className='text-right'>
                                <div className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                                  {formatTime(userStat.totalWatchTime)}
                                </div>
                                <div className='text-xs text-gray-500 dark:text-gray-400'>
                                  总观看时长
                                </div>
                              </div>
                              <div className='text-right'>
                                <div className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                                  {userStat.totalPlays}
                                </div>
                                <div className='text-xs text-gray-500 dark:text-gray-400'>
                                  播放次数
                                </div>
                              </div>
                              <div className='text-right'>
                                <div className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                                  {formatTime(userStat.avgWatchTime)}
                                </div>
                                <div className='text-xs text-gray-500 dark:text-gray-400'>
                                  平均时长
                                </div>
                              </div>
                              <div className='flex-shrink-0'>
                                <svg
                                  className={`w-5 h-5 text-gray-400 transition-transform ${
                                    expandedUsers.has(userStat.username)
                                      ? 'rotate-180'
                                      : ''
                                  }`}
                                  fill='none'
                                  stroke='currentColor'
                                  viewBox='0 0 24 24'
                                >
                                  <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth='2'
                                    d='M19 9l-7 7-7-7'
                                  />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 展开的播放记录详情 */}
                        {expandedUsers.has(userStat.username) && (
                          <div className='p-4 bg-gradient-to-br from-gray-50/40 to-gray-100/20 dark:from-gray-900/20 dark:to-gray-800/10 border-t border-gray-200/30 dark:border-gray-700/30'>
                            {userStat.recentRecords.length > 0 ? (
                              <>
                                <h6 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-4'>
                                  最近播放记录 (最多显示10条)
                                </h6>
                                <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                                  {userStat.recentRecords.map(
                                    (record: any, recordIndex) => {
                                      // 为每条记录生成不同的渐变背景
                                      const recordGradients = [
                                        'from-slate-100/90 to-gray-200/80 dark:from-slate-800/80 dark:to-gray-700/70',
                                        'from-zinc-100/90 to-stone-200/80 dark:from-zinc-800/80 dark:to-stone-700/70',
                                        'from-neutral-100/90 to-gray-200/80 dark:from-neutral-800/80 dark:to-gray-700/70',
                                        'from-stone-100/90 to-slate-200/80 dark:from-stone-800/80 dark:to-slate-700/70',
                                        'from-gray-100/90 to-zinc-200/80 dark:from-gray-800/80 dark:to-zinc-700/70',
                                      ];
                                      const recordGradientClass =
                                        recordGradients[
                                          recordIndex % recordGradients.length
                                        ];

                                      return (
                                        <div
                                          key={record.title + record.save_time}
                                          className={`flex items-center space-x-4 p-3 bg-gradient-to-r ${recordGradientClass} rounded-lg cursor-pointer hover:scale-[1.02] hover:shadow-lg transition-all duration-300 border-2 border-gray-300/60 dark:border-gray-600/80 shadow-md`}
                                          onClick={() =>
                                            handlePlayRecord(record)
                                          }
                                        >
                                          <div className='flex-shrink-0 w-12 h-16 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden'>
                                            {record.cover ? (
                                              <Image
                                                src={record.cover}
                                                alt={record.title}
                                                width={48}
                                                height={64}
                                                className='w-full h-full object-cover'
                                                onError={(e) => {
                                                  (
                                                    e.target as HTMLImageElement
                                                  ).style.display = 'none';
                                                }}
                                              />
                                            ) : (
                                              <div className='w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500'>
                                                <svg
                                                  className='w-6 h-6'
                                                  fill='none'
                                                  stroke='currentColor'
                                                  viewBox='0 0 24 24'
                                                >
                                                  <path
                                                    strokeLinecap='round'
                                                    strokeLinejoin='round'
                                                    strokeWidth='2'
                                                    d='M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m0 0V1a1 1 0 011-1h2a1 1 0 011 1v18a1 1 0 01-1 1H4a1 1 0 01-1-1V1a1 1 0 011-1h2a1 1 0 011 1v3'
                                                  />
                                                </svg>
                                              </div>
                                            )}
                                          </div>
                                          <div className='flex-1 min-w-0'>
                                            <h6 className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
                                              {record.title}
                                            </h6>
                                            <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                                              来源: {record.source_name} | 年份:{' '}
                                              {record.year}
                                            </p>
                                            <p className='text-xs text-gray-500 dark:text-gray-400'>
                                              第 {record.index} 集 / 共{' '}
                                              {record.total_episodes} 集
                                            </p>
                                            <div className='mt-2'>
                                              <div className='flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1'>
                                                <span>播放进度</span>
                                                <span>
                                                  {formatTime(record.play_time)}{' '}
                                                  /{' '}
                                                  {formatTime(
                                                    record.total_time,
                                                  )}{' '}
                                                  (
                                                  {getProgressPercentage(
                                                    record.play_time,
                                                    record.total_time,
                                                  )}
                                                  %)
                                                </span>
                                              </div>
                                              <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5'>
                                                <div
                                                  className='bg-blue-500 h-1.5 rounded-full transition-all duration-300'
                                                  style={{
                                                    width: `${getProgressPercentage(
                                                      record.play_time,
                                                      record.total_time,
                                                    )}%`,
                                                  }}
                                                ></div>
                                              </div>
                                            </div>
                                          </div>
                                          <div className='flex-shrink-0 text-right'>
                                            <div className='text-xs text-gray-500 dark:text-gray-400'>
                                              {formatDateTime(record.save_time)}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              </>
                            ) : (
                              <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                                <svg
                                  className='w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600'
                                  fill='none'
                                  stroke='currentColor'
                                  viewBox='0 0 24 24'
                                >
                                  <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth='2'
                                    d='M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0012 15c-2.239 0-4.236.18-6.101.532C4.294 15.661 4 16.28 4 16.917V19a2 2 0 002 2h12a2 2 0 002-2v-2.083c0-.636-.293-1.256-.899-1.385A7.962 7.962 0 0012 15z'
                                  />
                                </svg>
                                <p>该用户暂无播放记录</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            /* 个人统计内容 */
            <>
              {/* 个人统计概览 */}
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4 mb-8'>
                <div className='p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800'>
                  <div className='text-2xl font-bold text-blue-800 dark:text-blue-300'>
                    {formatTime(userStats.totalWatchTime)}
                  </div>
                  <div className='text-sm text-blue-600 dark:text-blue-400'>
                    总观看时长
                  </div>
                </div>
                <div className='p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800'>
                  <div className='text-2xl font-bold text-green-800 dark:text-green-300'>
                    {userStats.registrationDays || 0}
                  </div>
                  <div className='text-sm text-green-600 dark:text-green-400'>
                    注册天数
                  </div>
                </div>
                <div className='p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800'>
                  <div className='text-2xl font-bold text-orange-800 dark:text-orange-300'>
                    {userStats.loginDays || 0}
                  </div>
                  <div className='text-sm text-orange-600 dark:text-orange-400'>
                    登录天数
                  </div>
                </div>
                <div className='p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800'>
                  <div className='text-2xl font-bold text-purple-800 dark:text-purple-300'>
                    {userStats.totalMovies || userStats.totalPlays || 0}
                  </div>
                  <div className='text-sm text-purple-600 dark:text-purple-400'>
                    观看影片
                  </div>
                </div>
                <div className='p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800'>
                  <div className='text-2xl font-bold text-indigo-800 dark:text-indigo-300'>
                    {userStats.totalPlays}
                  </div>
                  <div className='text-sm text-indigo-600 dark:text-indigo-400'>
                    总播放次数
                  </div>
                </div>
                <div className='p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800'>
                  <div className='text-2xl font-bold text-yellow-800 dark:text-yellow-300'>
                    {formatTime(userStats.avgWatchTime)}
                  </div>
                  <div className='text-sm text-yellow-600 dark:text-yellow-400'>
                    平均观看时长
                  </div>
                </div>
                <div className='p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800'>
                  <div className='text-2xl font-bold text-orange-800 dark:text-orange-300'>
                    {userStats.mostWatchedSource || '暂无'}
                  </div>
                  <div className='text-sm text-orange-600 dark:text-orange-400'>
                    常用来源
                  </div>
                </div>
              </div>

              {/* 最近播放记录 */}
              <div>
                <h3 className='text-xl font-bold text-gray-900 dark:text-white'>
                  最近播放记录
                </h3>
                {userStats.recentRecords &&
                userStats.recentRecords.length > 0 ? (
                  <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                    {userStats.recentRecords.map(
                      (record: PlayRecord, index) => {
                        // 为每条记录生成不同的渐变背景
                        const adminRecordGradients = [
                          'from-blue-100/95 to-cyan-200/90 dark:from-blue-800/90 dark:to-cyan-700/85',
                          'from-purple-100/95 to-pink-200/90 dark:from-purple-800/90 dark:to-pink-700/85',
                          'from-green-100/95 to-emerald-200/90 dark:from-green-800/90 dark:to-emerald-700/85',
                          'from-orange-100/95 to-amber-200/90 dark:from-orange-800/90 dark:to-amber-700/85',
                          'from-indigo-100/95 to-violet-200/90 dark:from-indigo-800/90 dark:to-violet-700/85',
                          'from-teal-100/95 to-cyan-200/90 dark:from-teal-800/90 dark:to-cyan-700/85',
                        ];
                        const gradientClass =
                          adminRecordGradients[
                            index % adminRecordGradients.length
                          ];

                        return (
                          <div
                            key={record.title + record.save_time}
                            className={`flex items-center space-x-4 p-4 bg-gradient-to-br ${gradientClass} rounded-lg border-2 border-gray-300/90 dark:border-gray-600/95 cursor-pointer hover:scale-[1.02] transition-all duration-300 shadow-lg hover:shadow-xl backdrop-blur-sm`}
                            onClick={() => handlePlayRecord(record)}
                          >
                            <div className='flex-shrink-0 w-16 h-20 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden'>
                              {record.cover ? (
                                <Image
                                  src={record.cover}
                                  alt={record.title}
                                  width={64}
                                  height={80}
                                  className='w-full h-full object-cover'
                                  onError={(e) => {
                                    (
                                      e.target as HTMLImageElement
                                    ).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className='w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500'>
                                  <svg
                                    className='w-8 h-8'
                                    fill='none'
                                    stroke='currentColor'
                                    viewBox='0 0 24 24'
                                  >
                                    <path
                                      strokeLinecap='round'
                                      strokeLinejoin='round'
                                      strokeWidth='2'
                                      d='M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m0 0V1a1 1 0 011-1h2a1 1 0 011 1v18a1 1 0 01-1 1H4a1 1 0 01-1-1V1a1 1 0 011-1h2a1 1 0 011 1v3'
                                    />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className='flex-1 min-w-0'>
                              <h6 className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate mb-1'>
                                {record.title}
                              </h6>
                              <p className='text-xs text-gray-500 dark:text-gray-400 mb-2'>
                                来源: {record.source_name} | 年份: {record.year}
                              </p>
                              <p className='text-xs text-gray-500 dark:text-gray-400 mb-2'>
                                第 {record.index} 集 / 共{' '}
                                {record.total_episodes} 集
                              </p>
                              <div className='mt-2'>
                                <div className='flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1'>
                                  <span>播放进度</span>
                                  <span>
                                    {formatTime(record.play_time)} /{' '}
                                    {formatTime(record.total_time)} (
                                    {getProgressPercentage(
                                      record.play_time,
                                      record.total_time,
                                    )}
                                    %)
                                  </span>
                                </div>
                                <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5'>
                                  <div
                                    className='bg-blue-500 h-1.5 rounded-full transition-all duration-300'
                                    style={{
                                      width: `${getProgressPercentage(
                                        record.play_time,
                                        record.total_time,
                                      )}%`,
                                    }}
                                  ></div>
                                </div>
                              </div>
                              <div className='text-xs text-gray-500 dark:text-gray-400 mt-2'>
                                {formatDateTime(record.save_time)}
                              </div>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                ) : (
                  <div className='text-center py-12 text-gray-500 dark:text-gray-400'>
                    <svg
                      className='w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0012 15c-2.239 0-4.236.18-6.101.532C4.294 15.661 4 16.28 4 16.917V19a2 2 0 002 2h12a2 2 0 002-2v-2.083c0-.636-.293-1.256-.899-1.385A7.962 7.962 0 0012 15z'
                      />
                    </svg>
                    <p>暂无播放记录</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </PageLayout>
    );
  }

  // 渲染普通用户个人统计页面
  if (!isAdmin && userStats) {
    return (
      <PageLayout activePath='/play-stats'>
        <div className='max-w-6xl mx-auto px-4 py-8'>
          {/* 页面标题 */}
          <div className='mb-8'>
            <h1 className='text-3xl font-bold text-gray-900 dark:text-white'>
              个人统计
            </h1>
            <p className='text-gray-600 dark:text-gray-400 mt-2'>
              查看您的个人播放记录和统计数据
            </p>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className='mb-8 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800'>
              <div className='flex items-center space-x-3'>
                <div className='text-red-600 dark:text-red-400'>
                  <svg
                    className='w-5 h-5'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth='2'
                      d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                    />
                  </svg>
                </div>
                <div>
                  <h4 className='text-sm font-medium text-red-800 dark:text-red-300'>
                    获取个人统计失败
                  </h4>
                  <p className='text-red-700 dark:text-red-400 text-sm mt-1'>
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 个人统计概览 */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4 mb-8'>
            <div className='p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800'>
              <div className='text-2xl font-bold text-blue-800 dark:text-blue-300'>
                {formatTime(userStats.totalWatchTime)}
              </div>
              <div className='text-sm text-blue-600 dark:text-blue-400'>
                总观看时长
              </div>
            </div>
            <div className='p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800'>
              <div className='text-2xl font-bold text-green-800 dark:text-green-300'>
                {userStats.registrationDays || 0}
              </div>
              <div className='text-sm text-green-600 dark:text-green-400'>
                注册天数
              </div>
            </div>
            <div className='p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800'>
              <div className='text-2xl font-bold text-orange-800 dark:text-orange-300'>
                {userStats.loginDays || 0}
              </div>
              <div className='text-sm text-orange-600 dark:text-orange-400'>
                登录天数
              </div>
            </div>
            <div className='p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800'>
              <div className='text-2xl font-bold text-purple-800 dark:text-purple-300'>
                {userStats.totalMovies || userStats.totalPlays || 0}
              </div>
              <div className='text-sm text-purple-600 dark:text-purple-400'>
                观看影片
              </div>
            </div>
            <div className='p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800'>
              <div className='text-2xl font-bold text-indigo-800 dark:text-indigo-300'>
                {userStats.totalPlays}
              </div>
              <div className='text-sm text-indigo-600 dark:text-indigo-400'>
                总播放次数
              </div>
            </div>
            <div className='p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800'>
              <div className='text-2xl font-bold text-yellow-800 dark:text-yellow-300'>
                {formatTime(userStats.avgWatchTime)}
              </div>
              <div className='text-sm text-yellow-600 dark:text-yellow-400'>
                平均观看时长
              </div>
            </div>
            <div className='p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800'>
              <div className='text-2xl font-bold text-orange-800 dark:text-orange-300'>
                {userStats.mostWatchedSource || '暂无'}
              </div>
              <div className='text-sm text-orange-600 dark:text-orange-400'>
                常用来源
              </div>
            </div>
          </div>

          {/* 历史观看记录 */}
          <div>
            <h3 className='text-xl font-semibold text-gray-900 dark:text-white mb-6'>
              观看记录
            </h3>
            {userStats.recentRecords && userStats.recentRecords.length > 0 ? (
              <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                {userStats.recentRecords.map((record: PlayRecord, index) => {
                  // 为每条记录生成不同的渐变背景
                  const recordGradients = [
                    'from-blue-100/95 to-cyan-200/90 dark:from-blue-800/90 dark:to-cyan-700/85',
                    'from-purple-100/95 to-pink-200/90 dark:from-purple-800/90 dark:to-pink-700/85',
                    'from-green-100/95 to-emerald-200/90 dark:from-green-800/90 dark:to-emerald-700/85',
                    'from-orange-100/95 to-amber-200/90 dark:from-orange-800/90 dark:to-amber-700/85',
                    'from-indigo-100/95 to-violet-200/90 dark:from-indigo-800/90 dark:to-violet-700/85',
                    'from-teal-100/95 to-cyan-200/90 dark:from-teal-800/90 dark:to-cyan-700/85',
                  ];
                  const gradientClass =
                    recordGradients[index % recordGradients.length];

                  return (
                    <div
                      key={record.title + record.save_time}
                      className={`flex items-center space-x-4 p-4 bg-gradient-to-br ${gradientClass} rounded-lg border-2 border-gray-300/90 dark:border-gray-600/95 cursor-pointer hover:scale-[1.02] transition-all duration-300 shadow-lg hover:shadow-xl backdrop-blur-sm`}
                      onClick={() => handlePlayRecord(record)}
                    >
                      <div className='flex-shrink-0 w-16 h-20 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden'>
                        {record.cover ? (
                          <Image
                            src={record.cover}
                            alt={record.title}
                            width={64}
                            height={80}
                            className='w-full h-full object-cover'
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                'none';
                            }}
                          />
                        ) : (
                          <div className='w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500'>
                            <svg
                              className='w-8 h-8'
                              fill='none'
                              stroke='currentColor'
                              viewBox='0 0 24 24'
                            >
                              <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth='2'
                                d='M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m0 0V1a1 1 0 011-1h2a1 1 0 011 1v18a1 1 0 01-1 1H4a1 1 0 01-1-1V1a1 1 0 011-1h2a1 1 0 011 1v3'
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className='flex-1 min-w-0'>
                        <h6 className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate mb-1'>
                          {record.title}
                        </h6>
                        <p className='text-xs text-gray-500 dark:text-gray-400 mb-2'>
                          来源: {record.source_name} | 年份: {record.year}
                        </p>
                        <p className='text-xs text-gray-500 dark:text-gray-400 mb-2'>
                          第 {record.index} 集 / 共 {record.total_episodes} 集
                        </p>
                        <div className='mt-2'>
                          <div className='flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1'>
                            <span>播放进度</span>
                            <span>
                              {formatTime(record.play_time)} /{' '}
                              {formatTime(record.total_time)} (
                              {getProgressPercentage(
                                record.play_time,
                                record.total_time,
                              )}
                              %)
                            </span>
                          </div>
                          <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5'>
                            <div
                              className='bg-blue-500 h-1.5 rounded-full transition-all duration-300'
                              style={{
                                width: `${getProgressPercentage(
                                  record.play_time,
                                  record.total_time,
                                )}%`,
                              }}
                            ></div>
                          </div>
                        </div>
                        <div className='text-xs text-gray-500 dark:text-gray-400 mt-2'>
                          {formatDateTime(record.save_time)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className='text-center py-12 text-gray-500 dark:text-gray-400'>
                <svg
                  className='w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0012 15c-2.239 0-4.236.18-6.101.532C4.294 15.661 4 16.28 4 16.917V19a2 2 0 002 2h12a2 2 0 002-2v-2.083c0-.636-.293-1.256-.899-1.385A7.962 7.962 0 0012 15z'
                  />
                </svg>
                <p>暂无播放记录</p>
              </div>
            )}
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout activePath='/play-stats'>
      <div className='max-w-6xl mx-auto px-4 py-8'>
        <div className='text-center py-12'>
          {error ? (
            <div className='text-red-600 dark:text-red-400'>{error}</div>
          ) : (
            <div className='text-gray-600 dark:text-gray-400'>
              {isAdmin ? '加载播放统计中...' : '加载个人统计中...'}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default PlayStatsPage;
