'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useNavigationConfig } from '@/contexts/NavigationConfigContext';

interface ClientAccessGuardProps {
  children: React.ReactNode;
}

export default function ClientAccessGuard({
  children,
}: ClientAccessGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { menuSettings } = useNavigationConfig();
  const [isInitialized, setIsInitialized] = useState(false);

  // 检查页面访问权限
  const checkPageAccess = () => {
    // 如果menuSettings还没加载完成，暂时允许访问
    if (!menuSettings || !isInitialized) return true;

    const search = window.location.search;

    // 检查douban页面
    if (pathname.startsWith('/douban')) {
      const type = new URLSearchParams(search).get('type');
      switch (type) {
        case 'movie':
          return menuSettings.showMovies;
        case 'tv':
          return menuSettings.showTVShows;
        case 'anime':
          return menuSettings.showAnime;
        case 'show':
          return menuSettings.showVariety;
        case 'short-drama':
          return menuSettings.showShortDrama;
        default:
          return menuSettings.showMovies;
      }
    }

    // 检查live页面
    if (pathname.startsWith('/live')) {
      return menuSettings.showLive;
    }

    // 检查tvbox页面
    if (pathname.startsWith('/tvbox')) {
      return menuSettings.showTvbox;
    }

    return true;
  };

  // 初始化检查
  useEffect(() => {
    // 等待一小段时间确保menuSettings已加载
    const timer = setTimeout(() => {
      setIsInitialized(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // 当menuSettings或初始化状态变化时检查权限
  useEffect(() => {
    // 只有在初始化完成后才进行权限检查
    if (!isInitialized) return;

    const hasAccess = checkPageAccess();

    if (!hasAccess && pathname !== '/') {
      console.log(`访问被拒绝: ${pathname}，跳转到首页`);
      router.push('/');
    }
  }, [menuSettings, pathname, isInitialized]);

  return <>{children}</>;
}
