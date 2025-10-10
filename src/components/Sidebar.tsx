/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import {
  Box,
  Cat,
  Clover,
  Film,
  Home,
  Menu,
  PlayCircle,
  Radio,
  Search,
  Star,
  Tv,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';

import { useSite } from './SiteProvider';

interface SidebarContextType {
  isCollapsed: boolean;
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
});

export const useSidebar = () => useContext(SidebarContext);

// 可替换为你自己的 logo 图片
const Logo = () => {
  const { siteName } = useSite();
  return (
    <Link
      href='/'
      className='flex items-center justify-center h-16 select-none hover:opacity-80 transition-opacity duration-200'
    >
      <span className='text-2xl font-bold gradient-text-green tracking-tight'>
        {siteName}
      </span>
    </Link>
  );
};

interface SidebarProps {
  onToggle?: (collapsed: boolean) => void;
  activePath?: string;
}

// 在浏览器环境下通过全局变量缓存折叠状态
declare global {
  interface Window {
    __sidebarCollapsed?: boolean;
  }
}

const Sidebar = ({ onToggle, activePath = '/' }: SidebarProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (
      typeof window !== 'undefined' &&
      typeof window.__sidebarCollapsed === 'boolean'
    ) {
      return window.__sidebarCollapsed;
    }
    return false; // 默认展开
  });

  // 获取完整的菜单配置
  const [menuConfig, setMenuConfig] = useState({
    showMovies: true,
    showTVShows: true,
    showAnime: true,
    showVariety: true,
    showLive: false,
    showTvbox: false,
    showShortDrama: false,
  });

  useEffect(() => {
    // 从全局配置获取完整的菜单设置
    const runtimeConfig = (window as any).RUNTIME_CONFIG;
    if (runtimeConfig?.MenuSettings) {
      setMenuConfig({
        showMovies: runtimeConfig.MenuSettings.showMovies ?? true,
        showTVShows: runtimeConfig.MenuSettings.showTVShows ?? true,
        showAnime: runtimeConfig.MenuSettings.showAnime ?? true,
        showVariety: runtimeConfig.MenuSettings.showVariety ?? true,
        showLive: runtimeConfig.MenuSettings.showLive ?? false,
        showTvbox: runtimeConfig.MenuSettings.showTvbox ?? false,
        showShortDrama: runtimeConfig.MenuSettings.showShortDrama ?? false,
      });

      // 如果直播菜单被隐藏，同时设置全局变量来禁止访问直播页面
      if (!runtimeConfig.MenuSettings.showLive) {
        (window as any).__LIVE_DISABLED = true;
      }
    }
  }, []);

  // 动态构建菜单项
  const [menuItems, setMenuItems] = useState<any[]>([]);

  // 当配置变化时更新菜单
  useEffect(() => {
    const items: any[] = [];

    if (menuConfig.showMovies)
      items.push({ icon: Film, label: '电影', href: '/douban?type=movie' });
    if (menuConfig.showTVShows)
      items.push({ icon: Tv, label: '剧集', href: '/douban?type=tv' });
    if (menuConfig.showShortDrama)
      items.push({
        icon: PlayCircle,
        label: '短剧',
        href: '/douban?type=short-drama',
      });
    if (menuConfig.showAnime)
      items.push({ icon: Cat, label: '动漫', href: '/douban?type=anime' });
    if (menuConfig.showVariety)
      items.push({ icon: Clover, label: '综艺', href: '/douban?type=show' });
    if (menuConfig.showLive)
      items.push({ icon: Radio, label: '直播', href: '/live' });
    if (menuConfig.showTvbox)
      items.push({ icon: Box, label: '盒子', href: '/tvbox' });

    const runtimeConfig = (window as any).RUNTIME_CONFIG;
    if (runtimeConfig?.CUSTOM_CATEGORIES?.length > 0) {
      items.push({ icon: Star, label: '其他', href: '/douban?type=custom' });
    }

    setMenuItems(items);
  }, [menuConfig]);

  // 读取 localStorage 保持折叠状态
  useLayoutEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved !== null) {
      const val = JSON.parse(saved);
      setIsCollapsed(val);
      window.__sidebarCollapsed = val;
    }
  }, []);

  // 同步折叠状态到 html dataset
  useLayoutEffect(() => {
    if (typeof document !== 'undefined') {
      if (isCollapsed) {
        document.documentElement.dataset.sidebarCollapsed = 'true';
      } else {
        delete document.documentElement.dataset.sidebarCollapsed;
      }
    }
  }, [isCollapsed]);

  const [active, setActive] = useState(activePath);

  useEffect(() => {
    if (activePath) {
      setActive(activePath);
    } else {
      const queryString = searchParams.toString();
      const fullPath = queryString ? `${pathname}?${queryString}` : pathname;
      setActive(fullPath);
    }
  }, [activePath, pathname, searchParams]);

  const handleToggle = useCallback(() => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
    if (typeof window !== 'undefined') window.__sidebarCollapsed = newState;
    onToggle?.(newState);
  }, [isCollapsed, onToggle]);

  const handleSearchClick = useCallback(() => {
    router.push('/search');
  }, [router]);

  const contextValue = { isCollapsed };

  return (
    <SidebarContext.Provider value={contextValue}>
      {/* 在移动端隐藏侧边栏 */}
      <div className='hidden md:flex'>
        <aside
          data-sidebar
          className={`fixed top-0 left-0 h-screen transition-all duration-300 z-10 ${
            isCollapsed ? 'w-16' : 'w-64'
          }`}
          style={{
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
          }}
        >
          <style jsx global>{`
            .fixed[data-sidebar] {
              background: transparent;
              backdrop-filter: blur(16px) saturate(180%);
              -webkit-backdrop-filter: blur(16px) saturate(180%);
              border-right: 1px solid rgba(255, 255, 255, 0.1);
              box-shadow: 4px 0 16px rgba(0, 0, 0, 0.02);
            }
            html.dark .fixed[data-sidebar] {
              background: transparent;
              border-right: 1px solid rgba(255, 255, 255, 0.05);
              box-shadow: 4px 0 16px rgba(0, 0, 0, 0.1);
            }
          `}</style>
          <div className='flex h-full flex-col'>
            {/* 顶部 Logo */}
            <div className='relative h-16'>
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
                  isCollapsed ? 'opacity-0' : 'opacity-100'
                }`}
              >
                <div className='w-[calc(100%-4rem)] flex justify-center'>
                  {!isCollapsed && <Logo />}
                </div>
              </div>
              <button
                onClick={handleToggle}
                className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors duration-200 z-10 ${
                  isCollapsed ? 'left-1/2 -translate-x-1/2' : 'right-2'
                }`}
              >
                <Menu className='h-4 w-4' />
              </button>
            </div>

            {/* 首页和搜索 */}
            <nav className='px-2 mt-4 space-y-1'>
              <Link
                href='/'
                onClick={() => setActive('/')}
                data-active={active === '/'}
                className={`group flex items-center rounded-lg px-2 py-2 pl-4 text-gray-700 hover:bg-white/5 hover:text-green-600 data-[active=true]:bg-green-500/10 data-[active=true]:text-green-700 font-medium transition-colors duration-200 min-h-[40px] dark:text-gray-300 dark:hover:text-green-400 dark:data-[active=true]:bg-green-500/20 dark:data-[active=true]:text-green-400 ${
                  isCollapsed ? 'w-full max-w-none mx-0' : 'mx-0'
                } gap-3 justify-start`}
              >
                <div className='w-4 h-4 flex items-center justify-center'>
                  <Home className='h-4 w-4 transition-colors duration-200' />
                </div>
                {!isCollapsed && (
                  <span className='whitespace-nowrap transition-opacity duration-200 opacity-100'>
                    首页
                  </span>
                )}
              </Link>

              <Link
                href='/search'
                onClick={(e) => {
                  e.preventDefault();
                  handleSearchClick();
                  setActive('/search');
                }}
                data-active={active === '/search'}
                className={`group flex items-center rounded-lg px-2 py-2 pl-4 text-gray-700 hover:bg-white/5 hover:text-green-600 data-[active=true]:bg-green-500/10 data-[active=true]:text-green-700 font-medium transition-colors duration-200 min-h-[40px] dark:text-gray-300 dark:hover:text-green-400 dark:data-[active=true]:bg-green-500/20 dark:data-[active=true]:text-green-400 ${
                  isCollapsed ? 'w-full max-w-none mx-0' : 'mx-0'
                } gap-3 justify-start`}
              >
                <div className='w-4 h-4 flex items-center justify-center'>
                  <Search className='h-4 w-4 transition-colors duration-200' />
                </div>
                {!isCollapsed && (
                  <span className='whitespace-nowrap transition-opacity duration-200 opacity-100'>
                    搜索
                  </span>
                )}
              </Link>
            </nav>

            {/* 菜单项 */}
            <div className='flex-1 overflow-y-auto px-2 pt-4'>
              <div className='space-y-1'>
                {menuItems.map((item) => {
                  // 检查当前路径是否匹配这个菜单项
                  const typeMatch = item.href.match(/type=([^&]+)/)?.[1];

                  // 解码URL以进行正确的比较
                  const decodedActive = decodeURIComponent(active);
                  const decodedItemHref = decodeURIComponent(item.href);
                  const isActive =
                    decodedActive === decodedItemHref ||
                    (decodedActive.startsWith('/douban') &&
                      decodedActive.includes(`type=${typeMatch}`));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setActive(item.href)}
                      data-active={isActive}
                      className={`group flex items-center rounded-lg px-2 py-2 pl-4 hover:bg-white/5 hover:text-green-600 data-[active=true]:bg-green-500/10 data-[active=true]:text-green-700 font-medium transition-colors duration-200 min-h-[40px] dark:hover:text-green-400 dark:data-[active=true]:bg-green-500/20 dark:data-[active=true]:text-green-400 ${
                        isCollapsed ? 'w-full max-w-none mx-0' : 'mx-0'
                      } gap-3 justify-start`}
                      style={{
                        color: 'var(--nav-menu-color)',
                      }}
                    >
                      <div className='w-4 h-4 flex items-center justify-center'>
                        <Icon
                          className='h-4 w-4 transition-colors duration-200'
                          style={{
                            color: 'var(--category-menu-color)',
                          }}
                        />
                      </div>
                      {!isCollapsed && (
                        <span className='whitespace-nowrap transition-opacity duration-200 opacity-100'>
                          {item.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
        <div
          className={`transition-all duration-300 sidebar-offset ${
            isCollapsed ? 'w-16' : 'w-64'
          }`}
        ></div>
      </div>
    </SidebarContext.Provider>
  );
};

export default Sidebar;
