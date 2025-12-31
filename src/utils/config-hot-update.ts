/**
 * 配置热更新工具
 * 用于在管理员保存配置后立即更新前端显示，无需刷新页面
 */

export interface ConfigUpdateData {
  MenuSettings?: {
    showMovies?: boolean;
    showTVShows?: boolean;
    showAnime?: boolean;
    showVariety?: boolean;
    showLive?: boolean;
    showTvbox?: boolean;
    showShortDrama?: boolean;
  };
  SiteName?: string;
  Announcement?: string;
  [key: string]: any;
}

/**
 * 触发配置热更新
 * @param configData 新的配置数据
 */
export function triggerConfigUpdate(configData: ConfigUpdateData) {
  // 更新全局配置
  if (typeof window !== 'undefined') {
    const currentConfig = (window as any).RUNTIME_CONFIG || {};
    const updatedConfig = { ...currentConfig, ...configData };
    (window as any).RUNTIME_CONFIG = updatedConfig;

    // 触发自定义事件，通知所有监听器
    const event = new CustomEvent('nav-config-changed', {
      detail: updatedConfig,
    });
    window.dispatchEvent(event);

    console.log('配置热更新已触发:', updatedConfig);
  }
}

/**
 * 保存配置并触发热更新
 * @param apiEndpoint API端点
 * @param configData 配置数据
 * @param onSuccess 成功回调
 * @param onError 错误回调
 */
export async function saveConfigWithHotUpdate(
  apiEndpoint: string,
  configData: ConfigUpdateData,
  onSuccess?: (data: any) => void,
  onError?: (error: Error) => void,
) {
  try {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `保存失败: ${response.status}`);
    }

    const result = await response.json();

    // 触发热更新
    triggerConfigUpdate(configData);

    // 调用成功回调
    if (onSuccess) {
      onSuccess(result);
    }

    return result;
  } catch (error) {
    if (onError && error instanceof Error) {
      onError(error);
    }
    throw error;
  }
}

/**
 * 检查页面访问权限
 * @param pathname 当前路径
 * @param menuSettings 菜单设置
 * @returns 是否有访问权限
 */
export function checkPageAccess(pathname: string, menuSettings: any): boolean {
  const pathAccessMap: Record<string, keyof typeof menuSettings> = {
    '/douban': 'showMovies', // 默认检查电影
    '/live': 'showLive',
    '/tvbox': 'showTvbox',
  };

  // 特殊处理 douban 页面
  if (pathname.startsWith('/douban')) {
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type');

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

  // 检查其他路径
  for (const [path, menuKey] of Object.entries(pathAccessMap)) {
    if (pathname.startsWith(path)) {
      return menuSettings[menuKey];
    }
  }

  return true; // 默认允许访问
}
