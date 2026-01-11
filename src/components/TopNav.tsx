'use client';

import {
  AlertCircle,
  Bell,
  Box,
  Cat,
  Clover,
  Film,
  Home,
  MessageSquare,
  PlayCircle,
  Radio,
  Search,
  Star,
  Tv,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import { CURRENT_VERSION } from '@/lib/version';
import { checkForUpdates, UpdateStatus } from '@/lib/version_check';

import { useNavigationConfig } from '@/contexts/NavigationConfigContext';

// 类型定义
interface MenuItem {
  name?: string;
  label: string;
  path?: string;
  href: string;
  icon?: React.ComponentType<any>;
  badge?: string | number;
}

interface Comment {
  timestamp: number;
  username: string;
  replies?: Comment[];
}

// 组件定义

import { useSite } from './SiteProvider';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

interface TopNavProps {
  activePath?: string;
}

const TopNav = ({ activePath: _activePath = '/' }: TopNavProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { siteName } = useSite();
  const { menuSettings, isMenuEnabled, customCategories } =
    useNavigationConfig();

  // 使用 useMemo 缓存 auth，避免每次渲染都调用 getAuthInfoFromBrowserCookie
  const auth = useMemo(() => getAuthInfoFromBrowserCookie(), []);

  // 缓存 auth.username，避免引用变化
  const username = useMemo(() => auth?.username, [auth?.username]);

  // 使用 useMemo 缓存菜单项，只在配置变化时重新计算
  const menuItems = useMemo(() => {
    const items: MenuItem[] = [];

    // 添加首页
    items.push({ icon: Home, label: '首页', href: '/' });

    // 根据配置添加菜单项
    if (isMenuEnabled('showMovies')) {
      items.push({ icon: Film, label: '电影', href: '/douban?type=movie' });
    }
    if (isMenuEnabled('showTVShows')) {
      items.push({ icon: Tv, label: '剧集', href: '/douban?type=tv' });
    }
    if (isMenuEnabled('showShortDrama')) {
      items.push({
        icon: PlayCircle,
        label: '短剧',
        href: '/shortdrama',
      });
    }
    if (isMenuEnabled('showAnime')) {
      items.push({ icon: Cat, label: '动漫', href: '/douban?type=anime' });
    }
    if (isMenuEnabled('showVariety')) {
      items.push({ icon: Clover, label: '综艺', href: '/douban?type=show' });
    }
    if (isMenuEnabled('showLive')) {
      items.push({ icon: Radio, label: '直播', href: '/live' });
    }
    if (isMenuEnabled('showTvbox')) {
      items.push({ icon: Box, label: '盒子', href: '/tvbox' });
    }

    // 检查自定义分类
    if (customCategories && customCategories.length > 0) {
      items.push({ icon: Star, label: '其他', href: '/douban?type=custom' });
    }

    // 添加收藏菜单
    items.push({ icon: Star, label: '收藏', href: '/favorites' });

    return items;
  }, [menuSettings, customCategories, isMenuEnabled]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [isNotificationMuted, setIsNotificationMuted] = useState(false);
  const [notifications, setNotifications] = useState({
    versionUpdate: { hasUpdate: false, version: '', count: 0 },
    pendingUsers: { count: 0 },
    messages: { count: 0, hasUnread: false },
  });

  // 鼠标滚轮隐藏逻辑
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    // 清理可能残留的测试元素
    const existingTestElement = document.getElementById('scroll-test');
    if (existingTestElement) {
      existingTestElement.remove();
    }

    let timeoutId: NodeJS.Timeout;
    let wheelDirection = 0;
    let wheelTimeout: NodeJS.Timeout;

    const handleWheel = (e: WheelEvent) => {
      // 清除之前的timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (wheelTimeout) {
        clearTimeout(wheelTimeout);
      }

      // 判断滚轮方向
      const currentDirection = e.deltaY > 0 ? 1 : -1;

      // 如果方向改变，立即更新状态
      if (currentDirection !== wheelDirection) {
        wheelDirection = currentDirection;

        if (currentDirection > 0) {
          setIsVisible(false);
        } else {
          setIsVisible(true);
        }
      }

      // 停止滚轮0.5秒后显示导航栏
      wheelTimeout = setTimeout(() => {
        setIsVisible(true);
        wheelDirection = 0;
      }, 500);
    };

    // 添加鼠标滚轮监听器
    window.addEventListener('wheel', handleWheel, { passive: true });

    // 移动端触摸滚动检测
    let touchStartY = 0;
    let touchEndY = 0;
    let touchTimeout: NodeJS.Timeout;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      touchEndY = e.touches[0].clientY;
      const deltaY = touchEndY - touchStartY;

      // 清除之前的timeout
      if (touchTimeout) {
        clearTimeout(touchTimeout);
      }

      // 手向上拨（deltaY为负数）→ 内容向下滚动 → 隐藏导航栏
      if (deltaY < -30) {
        setIsVisible(false);
      }
      // 手向下拨（deltaY为正数）→ 内容向上滚动 → 显示导航栏
      else if (deltaY > 30) {
        setIsVisible(true);
      }
    };

    const handleTouchEnd = () => {
      // 停止触摸1秒后显示导航栏
      touchTimeout = setTimeout(() => {
        setIsVisible(true);
      }, 1000);
    };

    // 添加触摸事件监听器
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (wheelTimeout) {
        clearTimeout(wheelTimeout);
      }
      if (touchTimeout) {
        clearTimeout(touchTimeout);
      }
    };
  }, []);

  // 获取待审核用户数量（仅管理员）
  useEffect(() => {
    const fetchPendingUsersCount = async () => {
      try {
        // 检查用户是否是管理员
        const authInfo = getAuthInfoFromBrowserCookie();
        if (authInfo?.role === 'admin' || authInfo?.role === 'owner') {
          // 只有管理员才获取待审核用户数量
          const response = await fetch('/api/admin/config');
          if (response.ok) {
            const data = await response.json();
            const pendingUsers = data.Config?.UserConfig?.PendingUsers || [];

            setNotifications((prev) => ({
              ...prev,
              pendingUsers: { count: pendingUsers.length },
            }));
          }
        }
      } catch (_error) {
        // 忽略获取待审核用户数量失败
      }
    };

    // 监听 storage 事件（用于跨标签页通知）
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'last-pending-update' && e.newValue !== e.oldValue) {
        // 有新的待审核用户，更新数量
        fetchPendingUsersCount();
      }
    };

    // 监听页面可见性变化（用于同一标签页内通知）
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 页面重新可见时检查是否有更新
        const lastUpdate = localStorage.getItem('last-pending-update');
        if (lastUpdate) {
          fetchPendingUsersCount();
        }
      }
    };

    // 初始加载
    fetchPendingUsersCount();

    // 添加事件监听
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 获取未读消息数量
  useEffect(() => {
    // 如果用户正在留言页面，不检查未读消息
    if (
      typeof window !== 'undefined' &&
      window.location.pathname === '/message'
    ) {
      return;
    }

    const checkUnreadMessages = async () => {
      // 再次检查页面，避免在页面切换后仍然调用
      if (
        typeof window !== 'undefined' &&
        window.location.pathname === '/message'
      ) {
        return;
      }

      try {
        // 获取最新的留言数据
        const response = await fetch('/api/message');
        if (response.ok) {
          const data = await response.json();
          const comments = data.comments || [];

          // 计算未读回复数量和新留言数量
          let unreadCount = 0;
          const lastViewedMessages = parseInt(
            localStorage.getItem('lastViewedMessages') || '0',
          );

          comments.forEach((comment: Comment) => {
            // 如果是管理员或站长，检查所有新留言和非自己发送的回复
            if (auth?.role === 'admin' || auth?.role === 'owner') {
              // 检查新留言（评论本身），但排除自己发送的留言
              if (
                comment.timestamp > lastViewedMessages &&
                comment.username !== auth?.username
              ) {
                unreadCount++;
              }

              // 检查非自己发送的回复
              comment.replies.forEach((reply: Comment) => {
                // 如果回复时间在最后查看之后且不是自己发送的，则为未读
                if (
                  reply.timestamp > lastViewedMessages &&
                  reply.username !== auth?.username
                ) {
                  unreadCount++;
                }
              });
            } else {
              // 如果是普通用户，只检查自己的留言回复
              if (comment.username === auth?.username) {
                comment.replies.forEach((reply: Comment) => {
                  // 如果回复时间在最后查看之后，则为未读
                  if (reply.timestamp > lastViewedMessages) {
                    unreadCount++;
                  }
                });
              }
            }
          });

          setNotifications((prev) => ({
            ...prev,
            messages: { count: unreadCount, hasUnread: unreadCount > 0 },
          }));
        }
      } catch (_error) {
        // 忽略获取留言信息的错误
      }
    };

    if (auth?.username) {
      checkUnreadMessages();
      // 每6小时检查一次未读消息，留言不需要实时查看
      const interval = setInterval(checkUnreadMessages, 21600000);
      return () => clearInterval(interval);
    }
  }, [auth?.username]); // 只依赖 username，避免 auth 对象引用变化

  // 版本检查
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const updateStatus = await checkForUpdates();

        // 更新通知状态
        setNotifications((prev) => ({
          ...prev,
          versionUpdate: {
            hasUpdate: updateStatus === UpdateStatus.HAS_UPDATE,
            version: CURRENT_VERSION,
            count: updateStatus === UpdateStatus.HAS_UPDATE ? 1 : 0,
          },
        }));

        // 保存检查时间
        localStorage.setItem('lastVersionCheck', Date.now().toString());
      } catch (_error) {
        // 忽略版本检查错误
      }
    };

    // 检查是否需要更新版本
    const shouldCheckVersion = () => {
      const lastCheck = localStorage.getItem('lastVersionCheck');
      if (!lastCheck) {
        return true; // 从未检查过
      }

      const hoursSinceLastCheck =
        (Date.now() - parseInt(lastCheck)) / (1000 * 60 * 60);
      return hoursSinceLastCheck >= 12; // 12小时后再次检查
    };

    // 立即检查（如果需要）
    if (shouldCheckVersion()) {
      checkUpdate();
    }

    // 设置定期检查（每12小时）
    const interval = setInterval(
      () => {
        checkUpdate();
      },
      12 * 60 * 60 * 1000,
    ); // 12小时

    return () => clearInterval(interval);
  }, []);

  // 页面切换动画效果
  const [isPageTransitioning, setIsPageTransitioning] = useState(false);
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      setIsPageTransitioning(true);

      // 页面切换动画时长
      const timer = setTimeout(() => {
        setIsPageTransitioning(false);
        previousPathname.current = pathname;
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [pathname]);

  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const fullPath = queryString ? `${pathname}?${queryString}` : pathname;

  const isActive = (href: string) => {
    // 解码URL以进行正确的比较
    const decodedActive = decodeURIComponent(fullPath);
    const decodedItemHref = decodeURIComponent(href);

    // 精确匹配
    if (decodedActive === decodedItemHref) {
      return true;
    }

    // 对于douban页面，检查type参数
    if (
      decodedItemHref.includes('type=') &&
      decodedActive.startsWith('/douban')
    ) {
      const typeMatch = decodedItemHref.split('type=')[1]?.split('&')[0];
      if (typeMatch && decodedActive.includes(`type=${typeMatch}`)) {
        return true;
      }
    }

    return false;
  };

  // 静音状态管理
  useEffect(() => {
    const savedMuteState = localStorage.getItem('notification-muted');
    if (savedMuteState !== null) {
      setIsNotificationMuted(JSON.parse(savedMuteState));
    }
  }, []);

  const toggleNotificationMute = () => {
    const newMuteState = !isNotificationMuted;
    setIsNotificationMuted(newMuteState);
    localStorage.setItem('notification-muted', JSON.stringify(newMuteState));
  };

  // 计算提醒状态
  const hasVersionUpdate = notifications.versionUpdate.hasUpdate;
  const hasPendingUsers = notifications.pendingUsers.count > 0;
  const hasUnreadMessages = notifications.messages.hasUnread;
  const hasAnyNotifications =
    hasVersionUpdate || hasPendingUsers || hasUnreadMessages;

  // 提醒弹窗组件
  const NotificationModal = () => {
    if (!showNotificationModal) return null;

    const pendingUsersCount = notifications.pendingUsers.count;

    // 只有真正有提醒事项时才显示弹窗
    if (!hasAnyNotifications) {
      return null;
    }

    return createPortal(
      <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4'>
        <div className='bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full p-6 relative max-h-[80vh] overflow-y-auto border border-gray-200/50 dark:border-gray-700/50'>
          {/* 关闭按钮 */}
          <button
            onClick={() => setShowNotificationModal(false)}
            className='absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
          >
            <X className='w-5 h-5' />
          </button>

          {/* 标题 */}
          <div className='flex items-center gap-3 mb-4'>
            <div className='w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg'>
              <Bell className='w-5 h-5 text-white' />
            </div>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
              提醒事项
            </h3>
            <div className='flex items-center gap-2 ml-4'>
              <span className='text-xs text-gray-500 dark:text-gray-400'>
                {isNotificationMuted ? '已静音' : '已开启'}
              </span>
              <button
                onClick={toggleNotificationMute}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  isNotificationMuted
                    ? 'bg-gray-300 dark:bg-gray-600'
                    : 'bg-blue-600 dark:bg-blue-500'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                    isNotificationMuted ? 'translate-x-1' : 'translate-x-6'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 内容区域 */}
          <div className='space-y-3'>
            {/* 版本更新提醒 */}
            {hasVersionUpdate && (
              <div className='group relative p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200/50 dark:border-blue-800/50 shadow-sm hover:shadow-md transition-all duration-300'>
                <div className='flex items-start space-x-4'>
                  <div className='w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg'>
                    <AlertCircle className='w-5 h-5 text-white' />
                  </div>
                  <div className='flex-1'>
                    <p className='font-semibold text-gray-900 dark:text-gray-100'>
                      发现新版本
                    </p>
                    <p className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
                      当前版本: v{CURRENT_VERSION}
                    </p>
                  </div>
                  {/* 版本更新徽章 */}
                  <span className='absolute top-2 right-2 px-2 py-0.5 text-[10px] font-medium text-white bg-blue-500 rounded-full'>
                    新版本
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowNotificationModal(false);
                    // 这里可以触发版本详情弹窗
                  }}
                  className='mt-3 w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-[1.02] font-medium'
                >
                  查看版本详情
                </button>
              </div>
            )}

            {/* 注册审核提醒 */}
            {pendingUsersCount > 0 && (
              <div className='group relative p-4 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl border border-orange-200/50 dark:border-red-800/50 shadow-sm hover:shadow-md transition-all duration-300'>
                <div className='flex items-start space-x-4'>
                  <div className='w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg'>
                    <Users className='w-5 h-5 text-white' />
                  </div>
                  <div className='flex-1'>
                    <p className='font-semibold text-gray-900 dark:text-gray-100'>
                      待审核用户
                    </p>
                    <p className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
                      有 {pendingUsersCount} 个用户等待审核
                    </p>
                  </div>
                  {/* 待审核用户徽章 */}
                  <span className='absolute top-2 right-2 px-2 py-0.5 text-[10px] font-medium text-white bg-orange-500 rounded-full'>
                    {pendingUsersCount > 99 ? '99+' : pendingUsersCount}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowNotificationModal(false);
                    router.push('/admin');
                  }}
                  className='mt-3 w-full px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-lg transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-[1.02] font-medium'
                >
                  前往审核
                </button>
              </div>
            )}

            {/* 消息提醒 */}
            {notifications.messages.hasUnread && (
              <div className='group relative p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200/50 dark:border-pink-800/50 shadow-sm hover:shadow-md transition-all duration-300'>
                <div className='flex items-start space-x-4'>
                  <div className='w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg'>
                    <MessageSquare className='w-5 h-5 text-white' />
                  </div>
                  <div className='flex-1'>
                    <p className='font-semibold text-gray-900 dark:text-gray-100'>
                      新消息
                    </p>
                    <p className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
                      有 {notifications.messages.count} 条未读消息
                    </p>
                  </div>
                  {/* 消息徽章 */}
                  <span className='absolute top-2 right-2 px-2 py-0.5 text-[10px] font-medium text-white bg-purple-500 rounded-full'>
                    {notifications.messages.count > 99
                      ? '99+'
                      : notifications.messages.count}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowNotificationModal(false);
                    // 标记消息为已查看
                    localStorage.setItem(
                      'lastViewedMessages',
                      Date.now().toString(),
                    );
                    setNotifications((prev) => ({
                      ...prev,
                      messages: { count: 0, hasUnread: false },
                    }));
                    router.push('/message');
                  }}
                  className='mt-3 w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-[1.02] font-medium'
                >
                  查看消息
                </button>
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body,
    );
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      } ${
        isPageTransitioning
          ? 'scale-[0.98] opacity-80'
          : 'scale-100 opacity-100'
      }`}
    >
      {/* 透明背景层 */}
      <div className='absolute inset-0 backdrop-blur-md shadow-lg shadow-black/10 dark:shadow-black/30 transition-all duration-500'>
        {/* 页面切换进度条 */}
        <div
          className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-300 ease-out ${
            isPageTransitioning ? 'w-full' : 'w-0'
          }`}
        ></div>
      </div>
      <div className='relative px-4 sm:px-6 lg:px-8'>
        <div className='flex justify-between items-center h-12'>
          {/* Logo */}
          <div className='flex items-center flex-1'>
            <Link
              href='/'
              className='logo-container flex items-center space-x-3 group'
            >
              {/* 站点名称 */}
              <div className='relative'>
                <span className='text-lg sm:text-xl font-bold text-gray-900 dark:text-white transition-all duration-300'>
                  {(siteName || 'Vidora').split('').map((char, index) => {
                    if (index === 0) {
                      // 第一个字母：应用颜色和旋转效果
                      return (
                        <span
                          key={index}
                          className='inline-block bg-gradient-to-br from-blue-500 via-purple-500 to-purple-600 bg-clip-text text-transparent transition-transform duration-500 group-hover:rotate-180'
                        >
                          {char}
                        </span>
                      );
                    }
                    // 其他字母：正常显示
                    return <span key={index}>{char}</span>;
                  })}
                </span>

                {/* 名称下方装饰线 */}
                <div className='absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-600 group-hover:w-full transition-all duration-300 rounded-full'></div>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className='hidden md:flex items-center justify-center flex-1 gap-1'>
            {menuItems.map((item, _index) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center px-3 py-2 text-sm font-medium transition-all duration-300 group mr-1 rounded-lg overflow-hidden ${
                    isActive(item.href)
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-blue-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 hover:shadow-md'
                  }`}
                >
                  {/* 悬停背景效果 */}
                  <div
                    className={`absolute inset-0 rounded-lg transition-all duration-300 ${
                      isActive(item.href)
                        ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-blue-500/30 dark:border-blue-400/30'
                        : 'bg-gray-100 dark:bg-gray-800 opacity-0 group-hover:opacity-100 group-hover:scale-105'
                    }`}
                  ></div>

                  {/* 图标容器 */}
                  <div className='relative mr-2'>
                    {/* 图标 */}
                    <Icon
                      className={`relative w-4 h-4 transition-all duration-500 z-10 ${
                        isActive(item.href)
                          ? 'text-white drop-shadow-sm'
                          : (() => {
                              // 根据不同的菜单项设置不同的颜色
                              const colorMap: Record<string, string> = {
                                '/': 'text-purple-500 dark:text-purple-400',
                                '/douban?type=movie':
                                  'text-red-500 dark:text-red-400',
                                '/douban?type=tv':
                                  'text-blue-500 dark:text-blue-400',
                                '/douban?type=short-drama':
                                  'text-pink-500 dark:text-pink-400',
                                '/douban?type=anime':
                                  'text-indigo-500 dark:text-indigo-400',
                                '/douban?type=show':
                                  'text-orange-500 dark:text-orange-400',
                                '/live': 'text-green-500 dark:text-green-400',
                                '/tvbox': 'text-cyan-500 dark:text-cyan-400',
                                '/favorites':
                                  'text-yellow-500 dark:text-yellow-400',
                                '/douban?type=custom':
                                  'text-teal-500 dark:text-teal-400',
                              };
                              return (
                                colorMap[item.href] ||
                                'text-gray-500 dark:text-gray-400'
                              );
                            })()
                      } group-hover:rotate-12`}
                    />
                  </div>

                  {/* 文字 */}
                  <span
                    className={`relative transition-all duration-300 z-10 whitespace-nowrap text-sm ${
                      isActive(item.href)
                        ? 'text-blue-600 dark:text-blue-400 font-medium'
                        : 'text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                    }`}
                  >
                    {item.label}
                  </span>

                  {/* 激活状态指示器 */}
                  {isActive(item.href) && (
                    <div className='absolute -bottom-px left-1/2 -translate-x-1/2 w-6 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full'></div>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right side items */}
          <div className='flex items-center justify-end flex-1 space-x-3 sm:space-x-4'>
            {/* Search icon */}
            <button
              onClick={() => router.push('/search')}
              className='relative transition-all duration-200 flex items-center justify-center'
              title='搜索'
            >
              <Search className='w-5 h-5 text-blue-500 dark:text-blue-400 transition-transform duration-300 group-hover:rotate-12' />
            </button>

            {/* 主题切换按钮 */}
            <button
              className='relative transition-all duration-200 flex items-center justify-center'
              title='切换主题'
            >
              <ThemeToggle className='w-5 h-5 text-blue-500 dark:text-blue-400 transition-transform duration-300 group-hover:rotate-12' />
            </button>

            {/* 提醒图标按钮 - 只在有通知时显示 */}
            {hasAnyNotifications && (
              <button
                onClick={() => setShowNotificationModal(true)}
                className={`relative transition-all duration-200 ${
                  !isNotificationMuted ? 'animate-pulse' : ''
                }`}
                title='提醒'
              >
                <Bell
                  className={`w-5 h-5 transition-transform duration-300 group-hover:rotate-12 ${
                    isNotificationMuted
                      ? 'text-gray-400 dark:text-gray-500'
                      : 'text-orange-500 dark:text-orange-400'
                  }`}
                />
                {/* 统一提醒徽章 */}
                {(() => {
                  const totalCount =
                    notifications.versionUpdate.count +
                    notifications.pendingUsers.count +
                    notifications.messages.count;

                  // 只有有提醒且未静音时才显示徽章
                  if (totalCount > 0 && !isNotificationMuted) {
                    return (
                      <span className='absolute -top-0.5 -right-0.5 min-w-[16px] h-4 text-[10px] font-medium text-white bg-red-500 rounded-full flex items-center justify-center px-1 animate-pulse'>
                        {totalCount > 99 ? '99+' : totalCount}
                      </span>
                    );
                  }
                  return null;
                })()}
              </button>
            )}

            {/* 用户菜单 */}
            <UserMenu />

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className='md:hidden transition-colors duration-200'
            >
              {isMobileMenuOpen ? (
                <X className='w-6 h-6' />
              ) : (
                <div className='w-6 h-6 flex flex-col justify-center space-y-1.5'>
                  <div className='w-6 h-0.5 bg-current rounded-full'></div>
                  <div className='w-5 h-0.5 bg-current rounded-full'></div>
                  <div className='w-4 h-0.5 bg-current rounded-full'></div>
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div
          className={`md:hidden transition-all duration-500 ease-out overflow-hidden ${
            isMobileMenuOpen ? 'max-h-[80vh] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className='relative border-t border-white/20 dark:border-gray-700/20 bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl backdrop-saturate-180'>
            <div className='relative px-3 pt-3 pb-4 space-y-1'>
              {menuItems.map((item, _index) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.href}
                    onClick={() => {
                      router.push(item.href);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`nav-item flex items-center w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 relative overflow-hidden group ${
                      isActive(item.href)
                        ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-700 dark:from-blue-500/25 dark:to-purple-500/25 dark:text-blue-300 shadow-md shadow-blue-500/20 dark:shadow-blue-500/25 border border-blue-200/25 dark:border-blue-700/25'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800/50 hover:shadow-md hover:shadow-black/10 dark:hover:shadow-black/20'
                    }`}
                    style={{
                      animationDelay: isMobileMenuOpen
                        ? `${_index * 30}ms`
                        : '0ms',
                    }}
                  >
                    {/* 图标容器 */}
                    <div
                      className={`flex items-center justify-center w-7 h-7 rounded-md transition-all duration-300 mr-3 flex-shrink-0 ${
                        isActive(item.href)
                          ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-sm border border-blue-500/30 dark:border-blue-400/30 text-blue-600 dark:text-blue-400'
                          : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gradient-to-br group-hover:from-indigo-400 group-hover:to-purple-500 group-hover:rotate-6'
                      }`}
                    >
                      {' '}
                      <Icon
                        className={`w-3.5 h-3.5 transition-all duration-300 group-hover:rotate-12 ${(() => {
                          // 根据不同的菜单项设置不同的颜色
                          const colorMap: Record<string, string> = {
                            '/': 'text-purple-500 dark:text-purple-400',
                            '/douban?type=movie':
                              'text-red-500 dark:text-red-400',
                            '/douban?type=tv':
                              'text-blue-500 dark:text-blue-400',
                            '/douban?type=short-drama':
                              'text-pink-500 dark:text-pink-400',
                            '/douban?type=anime':
                              'text-indigo-500 dark:text-indigo-400',
                            '/douban?type=show':
                              'text-orange-500 dark:text-orange-400',
                            '/live': 'text-green-500 dark:text-green-400',
                            '/tvbox': 'text-cyan-500 dark:text-cyan-400',
                            '/favorites':
                              'text-yellow-500 dark:text-yellow-400',
                            '/douban?type=custom':
                              'text-teal-500 dark:text-teal-400',
                          };
                          return (
                            colorMap[item.href] ||
                            'text-gray-500 dark:text-gray-400'
                          );
                        })()}`}
                      />
                    </div>

                    {/* 文字 */}
                    <span className='flex-1 text-left'>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <NotificationModal />
    </nav>
  );
};

export default TopNav;
