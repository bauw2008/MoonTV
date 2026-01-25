/**
 * 全局配置管理工具函数
 * 操作 window.RUNTIME_CONFIG
 */

import { MenuSettings } from '@/types/menu';

interface CustomCategory {
  name: string;
  type: 'movie' | 'tv';
  query: string;
  disabled: boolean;
  from: string;
}

interface NetDiskConfig {
  enabled: boolean;
  pansouUrl?: string;
  timeout?: number;
  enabledCloudTypes?: string[];
}

interface AIConfig {
  enabled: boolean;
  apiUrl?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface TMDBConfig {
  enableActorSearch: boolean;
  enablePosters?: boolean;
  apiKey?: string;
  language?: string;
}

interface RuntimeConfig {
  STORAGE_TYPE: string;
  DOUBAN_PROXY_TYPE?: string;
  DOUBAN_PROXY?: string;
  DOUBAN_IMAGE_PROXY_TYPE?: string;
  DOUBAN_IMAGE_PROXY?: string;
  DISABLE_YELLOW_FILTER?: boolean;
  CUSTOM_CATEGORIES: CustomCategory[];
  FLUID_SEARCH?: boolean;
  NetDiskConfig?: NetDiskConfig;
  AIConfig?: AIConfig;
  TMDBConfig?: TMDBConfig;
  MenuSettings: MenuSettings;
  SiteName?: string;
}

// 获取全局运行时配置
export function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === 'undefined') {
    // 服务端渲染时返回默认值
    return {
      STORAGE_TYPE: 'localstorage',
      CUSTOM_CATEGORIES: [],
      NetDiskConfig: {
        enabled: false,
        pansouUrl: 'https://so.252035.xyz',
        timeout: 30,
        enabledCloudTypes: ['baidu', 'aliyun', 'quark'],
      },
      AIConfig: {
        enabled: false,
        apiUrl: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 3000,
      },
      TMDBConfig: {
        enableActorSearch: false,
        enablePosters: false,
        apiKey: '',
        language: 'zh-CN',
      },
      MenuSettings: {
        showMovies: true,
        showTVShows: true,
        showAnime: true,
        showVariety: true,
        showLive: false,
        showTvbox: false,
        showShortDrama: false,
      },
    };
  }

  return (window as any).RUNTIME_CONFIG || getDefaultConfig();
}

// 默认配置
function getDefaultConfig(): RuntimeConfig {
  return {
    STORAGE_TYPE: 'localstorage',
    CUSTOM_CATEGORIES: [],
    NetDiskConfig: {
      enabled: false,
      pansouUrl: 'https://so.252035.xyz',
      timeout: 30,
      enabledCloudTypes: ['baidu', 'aliyun', 'quark'],
    },
    AIConfig: {
      enabled: false,
      apiUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 3000,
    },
    TMDBConfig: {
      enableActorSearch: false,
      enablePosters: false,
      apiKey: '',
      language: 'zh-CN',
    },
    MenuSettings: {
      showMovies: true,
      showTVShows: true,
      showAnime: true,
      showVariety: true,
      showLive: false,
      showTvbox: false,
      showShortDrama: false,
    },
  };
}

// 获取存储类型
export function getStorageType(): string {
  return getRuntimeConfig().STORAGE_TYPE;
}

// 检查是否为服务端模式
export function isServerMode(): boolean {
  return getStorageType() !== 'localstorage';
}

// 获取菜单设置
export function getMenuSettings(): MenuSettings {
  return getRuntimeConfig().MenuSettings;
}

// 更新菜单设置
export function updateMenuSettings(newSettings: Partial<MenuSettings>): void {
  if (typeof window === 'undefined') return;

  const config = getRuntimeConfig();
  const updatedSettings = { ...config.MenuSettings, ...newSettings };

  // 更新全局配置
  (window as any).RUNTIME_CONFIG.MenuSettings = updatedSettings;

  // localstorage 模式：保存到 localStorage
  if (!isServerMode()) {
    try {
      localStorage.setItem(
        'vidora-menu-settings',
        JSON.stringify(updatedSettings),
      );
    } catch {
      // 静默处理 localStorage 保存错误
    }
  }

  // 更新禁用菜单配置
  updateDisabledMenus();

  // 触发配置更新事件
  notifyConfigUpdated();
}

// 检查菜单是否启用
export function isMenuEnabled(menuKey: keyof MenuSettings): boolean {
  const settings = getMenuSettings();
  return settings[menuKey];
}

// 更新禁用菜单的全局变量
function updateDisabledMenus(): void {
  if (typeof window === 'undefined') return;

  const menuSettings = getMenuSettings();
  const disabledMenus = {
    showLive: menuSettings.showLive === false,
    showTvbox: menuSettings.showTvbox === false,
    showShortDrama: menuSettings.showShortDrama === false,
    showMovies: menuSettings.showMovies === false,
    showTVShows: menuSettings.showTVShows === false,
    showAnime: menuSettings.showAnime === false,
    showVariety: menuSettings.showVariety === false,
  };

  // 更新window.__DISABLED_MENUS供页面访问权限检查使用
  (window as any).__DISABLED_MENUS = disabledMenus;

  // 同时更新RUNTIME_CONFIG中的配置
  if ((window as any).RUNTIME_CONFIG) {
    (window as any).RUNTIME_CONFIG.__DISABLED_MENUS = disabledMenus;
  }
}

// 获取自定义分类
export function getCustomCategories(): CustomCategory[] {
  return getRuntimeConfig().CUSTOM_CATEGORIES || [];
}

// 更新自定义分类
export function updateCustomCategories(categories: CustomCategory[]): void {
  if (typeof window === 'undefined') return;

  // 更新全局配置
  (window as any).RUNTIME_CONFIG.CUSTOM_CATEGORIES = categories;

  // localstorage 模式：保存到 localStorage
  if (!isServerMode()) {
    try {
      localStorage.setItem(
        'vidora-custom-categories',
        JSON.stringify(categories),
      );
    } catch {
      // 静默处理 localStorage 保存错误
    }
  }

  // 触发配置更新事件
  notifyConfigUpdated();
}

// 同步到服务端
export async function syncToServer(): Promise<boolean> {
  if (!isServerMode()) {
    return false;
  }

  try {
    const menuSettings = getMenuSettings();
    const response = await fetch('/api/admin/menu-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ MenuSettings: menuSettings }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

// 配置更新标记键名
const CONFIG_UPDATE_KEY = 'vidora-config-update-timestamp';

// 通知配置更新
export async function notifyConfigUpdated(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  // 通过 localStorage 触发 storage 事件通知其他标签页
  try {
    const timestamp = Date.now();
    localStorage.setItem(CONFIG_UPDATE_KEY, timestamp.toString());
  } catch {
    // 静默处理 localStorage 保存错误
  }

  // 触发自定义事件供组件监听
  const event = new CustomEvent('vidora-config-update', {
    bubbles: true,
    composed: true,
  });
  window.dispatchEvent(event);
}

// 重新加载配置（从服务器获取最新配置）
export async function refreshConfig(): Promise<void> {
  if (!isServerMode()) {
    // localstorage 模式：从 localStorage 读取
    try {
      const savedSettings = localStorage.getItem('vidora-menu-settings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        if ((window as any).RUNTIME_CONFIG) {
          (window as any).RUNTIME_CONFIG.MenuSettings = parsedSettings;
          // 更新禁用菜单的全局变量
          updateDisabledMenus();
        }
      }

      const savedCategories = localStorage.getItem('vidora-custom-categories');
      if (savedCategories) {
        const parsedCategories = JSON.parse(savedCategories);
        if ((window as any).RUNTIME_CONFIG) {
          (window as any).RUNTIME_CONFIG.CUSTOM_CATEGORIES = parsedCategories;
        }
      }
    } catch {
      // 静默处理 localStorage 读取错误
    }
    return;
  }

  // 服务端模式：从 API 获取最新配置
  try {
    const response = await fetch('/api/public-config', {
      headers: { 'Cache-Control': 'no-cache' },
      cache: 'no-store',
    });

    if (response.ok) {
      const data = await response.json();

      if (data?.MenuSettings && (window as any).RUNTIME_CONFIG) {
        (window as any).RUNTIME_CONFIG.MenuSettings = data.MenuSettings;
        // 更新禁用菜单的全局变量
        updateDisabledMenus();
      }

      if (data?.CustomCategories && (window as any).RUNTIME_CONFIG) {
        (window as any).RUNTIME_CONFIG.CUSTOM_CATEGORIES =
          data.CustomCategories;
      }
    }
  } catch {
    // API 请求失败，静默处理
  }
}

// 初始化配置监听
export function initConfigListener(): () => void {
  if (typeof window === 'undefined') return () => {};

  // 初始化禁用菜单配置
  updateDisabledMenus();

  // 监听 storage 事件（跨标签页配置同步）
  const handleStorage = async (event: StorageEvent) => {
    // 只处理配置更新事件
    if (event.key === CONFIG_UPDATE_KEY && event.newValue !== event.oldValue) {
      try {
        await refreshConfig();
        window.dispatchEvent(
          new CustomEvent('vidora-config-update', {
            bubbles: true,
            composed: true,
          }),
        );
      } catch {
        // 静默处理错误
      }
    }
  };

  // 监听页面可见性变化，当页面从隐藏变为可见时刷新配置
  let refreshTimeout: NodeJS.Timeout | null = null;
  const debounceDelay = 1000;

  const handleVisibilityChange = async () => {
    if (!document.hidden) {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      refreshTimeout = setTimeout(async () => {
        try {
          await refreshConfig();
          window.dispatchEvent(
            new CustomEvent('vidora-config-update', {
              bubbles: true,
              composed: true,
            }),
          );
        } catch {
          // 静默处理错误
        } finally {
          refreshTimeout = null;
        }
      }, debounceDelay);
    } else if (refreshTimeout) {
      clearTimeout(refreshTimeout);
      refreshTimeout = null;
    }
  };

  window.addEventListener('storage', handleStorage);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    window.removeEventListener('storage', handleStorage);
    document.removeEventListener('visibilitychange', handleVisibilityChange);

    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }
  };
}
