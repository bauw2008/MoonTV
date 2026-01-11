/**
 * 检查用户是否可以访问某个路径
 * 直接从 RUNTIME_CONFIG 读取菜单设置，不依赖 Context
 */
export function canAccessMenu(pathname: string): boolean {
  // 服务器端默认允许访问（避免 SSR 错误）
  if (typeof window === 'undefined') {
    return true;
  }

  // 首页和管理页面总是允许访问
  if (
    pathname === '/' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/search') ||
    pathname.startsWith('/play') ||
    pathname.startsWith('/message') ||
    pathname.startsWith('/favorites') ||
    pathname.startsWith('/release-calendar') ||
    pathname.startsWith('/warning')
  ) {
    return true;
  }

  // 获取 RUNTIME_CONFIG
  const runtimeConfig = (window as any).RUNTIME_CONFIG;
  if (!runtimeConfig || !runtimeConfig.MenuSettings) {
    return true; // 默认允许访问
  }

  const menuSettings = runtimeConfig.MenuSettings;

  // 路径到菜单设置的映射
  const pathToMenuMap: Record<string, string> = {
    '/douban': 'showMovies', // 默认电影
    '/live': 'showLive',
    '/tvbox': 'showTvbox',
    '/shortdrama': 'showShortDrama',
  };

  // 检查路径是否在映射表中
  let menuKey: string | null = null;

  // 检查精确匹配
  if (pathToMenuMap[pathname]) {
    menuKey = pathToMenuMap[pathname];
  } else {
    // 检查路径前缀匹配
    for (const [path, key] of Object.entries(pathToMenuMap)) {
      if (pathname.startsWith(path)) {
        menuKey = key;
        break;
      }
    }
  }

  // 特殊处理 /douban 路径
  if (pathname.startsWith('/douban')) {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type');

    if (type === 'tv') {
      menuKey = 'showTVShows';
    } else if (type === 'anime') {
      menuKey = 'showAnime';
    } else if (type === 'show') {
      menuKey = 'showVariety';
    } else {
      menuKey = 'showMovies';
    }
  }

  // 如果找到了对应的菜单键，检查是否启用
  if (menuKey && menuSettings) {
    const isEnabled = menuSettings[menuKey];
    return isEnabled !== false; // 如果为 false 则不允许访问
  }

  // 默认允许访问
  return true;
}

/**
 * 检查当前路径是否可访问，如果不可访问则重定向到首页
 */
export function checkAndRedirectMenuAccess(): void {
  // 服务器端不执行（避免 SSR 错误）
  if (typeof window === 'undefined') {
    return;
  }

  const pathname = window.location.pathname;

  if (!canAccessMenu(pathname)) {
    // 菜单被禁用，重定向到首页
    window.location.href = '/';
  }
}
