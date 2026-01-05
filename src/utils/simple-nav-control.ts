/**
 * 简化的配置热更新方案
 * 使用页面重定向而不是复杂的事件系统
 */

export function handleConfigSave(configData: any) {
  if (typeof window !== 'undefined') {
    // 立即更新全局配置
    const currentConfig = (window as any).RUNTIME_CONFIG || {};
    (window as any).RUNTIME_CONFIG = { ...currentConfig, ...configData };

    // 添加重定向通知提示刷新页面
    const shouldRefresh = confirm(
      '配置已保存！\n\n为了确保菜单显示正确，建议刷新页面。\n\n是否立即刷新页面？',
    );

    if (shouldRefresh) {
      window.location.reload();
    }
  }
}

/**
 * 简化的菜单访问检查
 * 直接检查RUNTIME_CONFIG，避免复杂的Context系统
 */
export function isMenuEnabled(menuKey: string): boolean {
  if (typeof window === 'undefined') return true;

  const menuSettings = (window as any).RUNTIME_CONFIG?.MenuSettings;
  if (!menuSettings) return true;

  return menuSettings[menuKey] === true;
}

/**
 * 简单的页面访问控制
 * 在页面加载时检查权限，不符合则重定向
 */
export function checkPageAccess() {
  if (typeof window === 'undefined') return;

  const pathname = window.location.pathname;
  const menuSettings = (window as any).RUNTIME_CONFIG?.MenuSettings;

  if (!menuSettings) return;

  // 检查特定路径
  const pathAccessMap: Record<string, keyof typeof menuSettings> = {
    '/live': 'showLive',
    '/tvbox': 'showTvbox',
    '/douban': 'showMovies', // 默认检查电影
  };

  for (const [path, menuKey] of Object.entries(pathAccessMap)) {
    if (pathname.startsWith(path) && !menuSettings[menuKey]) {
      // 显示友好提示页面
      document.body.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: system-ui; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
          <div style="text-align: center; padding: 2rem;">
            <h2 style="color: white; margin-bottom: 1rem;">🚫 功能暂时不可用</h2>
            <p style="color: white; margin-bottom: 1.5rem;">此功能已被管理员禁用。</p>
            <button onclick="window.location.href='/'" style="
              background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.375rem; cursor: pointer;
            ">返回首页</button>
          </div>
        </div>
      `;
      return false;
    }
  }

  return true;
}
