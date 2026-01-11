'use client';

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import { MenuSettings } from '@/types/menu';

interface CustomCategory {
  name: string;
  type: 'movie' | 'tv';
  query: string;
  disabled: boolean;
  from: string;
}

interface NavigationConfigContextType {
  menuSettings: MenuSettings;
  updateMenuSettings: (settings: Partial<MenuSettings>) => void;
  isMenuEnabled: (menuKey: keyof MenuSettings) => boolean;
  customCategories: CustomCategory[];
  updateCustomCategories: (categories: CustomCategory[]) => void;
  refreshConfig: () => void;
  syncToServer: () => Promise<boolean>;
  storageType: string;
}

const NavigationConfigContext =
  createContext<NavigationConfigContextType | null>(null);

export const useNavigationConfig = () => {
  const context = useContext(NavigationConfigContext);
  if (!context) {
    // 提供默认值以防止应用崩溃
    const defaultContext: NavigationConfigContextType = {
      menuSettings: {
        showMovies: true,
        showTVShows: true,
        showAnime: true,
        showVariety: true,
        showLive: false,
        showTvbox: false,
        showShortDrama: false,
        showAI: false,
        showNetDiskSearch: false,
        showTMDBActorSearch: false,
      },
      updateMenuSettings: () => {},
      isMenuEnabled: () => true,
      customCategories: [],
      updateCustomCategories: () => {},
      refreshConfig: () => {},
      syncToServer: async () => false,
      storageType: 'localstorage',
    };

    return defaultContext;
  }
  return context;
};

interface NavigationConfigProviderProps {
  children: ReactNode;
}

// BroadcastChannel 名称
const CONFIG_CHANNEL = 'vidora-config-channel';

// 记录最后一次配置更新时间
let lastConfigUpdateTime = 0;

export const NavigationConfigProvider: React.FC<
  NavigationConfigProviderProps
> = ({ children }) => {
  const [menuSettings, setMenuSettings] = useState<MenuSettings>({
    showMovies: true,
    showTVShows: true,
    showAnime: true,
    showVariety: true,
    showLive: false,
    showTvbox: false,
    showShortDrama: false,
    showAI: false,
    showNetDiskSearch: false,
    showTMDBActorSearch: false,
  });
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(
    [],
  );
  const [storageType, setStorageType] = useState<string>('localstorage');

  // 获取存储类型
  const getStorageType = (): string => {
    if (typeof window !== 'undefined') {
      const runtimeConfig = (window as unknown as Record<string, unknown>)
        .RUNTIME_CONFIG as any;
      return runtimeConfig?.STORAGE_TYPE || 'localstorage';
    }
    return 'localstorage';
  };

  // 判断是否为服务端模式（非 localstorage）
  const isServerMode = (): boolean => {
    const type = getStorageType();
    return type !== 'localstorage';
  };

  // 从 API 获取配置
  const fetchConfigFromAPI = async () => {
    try {
      const response = await fetch('/api/public-config', {
        headers: {
          'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
      });

      if (response.ok) {
        const data = await response.json();

        if (data?.MenuSettings) {
          setMenuSettings(data.MenuSettings);

          // 同时更新 RUNTIME_CONFIG
          if ((window as any).RUNTIME_CONFIG) {
            (window as any).RUNTIME_CONFIG.MenuSettings = data.MenuSettings;
          }
        }

        if (data?.CustomCategories) {
          const categories: CustomCategory[] = data.CustomCategories.map(
            (cat: any) => ({
              name: cat.name,
              type: cat.type as 'movie' | 'tv',
              query: cat.query,
              disabled: cat.disabled ?? false,
              from: cat.from || 'config',
            }),
          );
          setCustomCategories(categories);

          // 同时更新 RUNTIME_CONFIG
          if ((window as any).RUNTIME_CONFIG) {
            (window as any).RUNTIME_CONFIG.CUSTOM_CATEGORIES = categories;
          }
        }
      }
    } catch {
      // API 请求失败，静默处理
    }
  };

  // 初始化配置
  const refreshConfig = async () => {
    const currentStorageType = getStorageType();
    setStorageType(currentStorageType);

    if (typeof window !== 'undefined') {
      // 服务端模式：从 API 获取最新配置
      if (isServerMode()) {
        await fetchConfigFromAPI();
      } else {
        // localstorage 模式：从 localStorage 读取配置
        try {
          const savedSettings = localStorage.getItem('vidora-menu-settings');
          if (savedSettings) {
            const parsedSettings = JSON.parse(savedSettings);
            setMenuSettings(parsedSettings);

            // 同时更新 RUNTIME_CONFIG
            if ((window as any).RUNTIME_CONFIG) {
              (window as any).RUNTIME_CONFIG.MenuSettings = parsedSettings;
            }
          }

          const savedCategories = localStorage.getItem(
            'vidora-custom-categories',
          );
          if (savedCategories) {
            const parsedCategories = JSON.parse(savedCategories);
            setCustomCategories(parsedCategories);

            // 同时更新 RUNTIME_CONFIG
            if ((window as any).RUNTIME_CONFIG) {
              (window as any).RUNTIME_CONFIG.CUSTOM_CATEGORIES =
                parsedCategories;
            }
          }
        } catch {
          // 静默处理 localStorage 读取错误
        }
      }

      // 更新全局禁用菜单变量
      const runtimeConfig = (window as any).RUNTIME_CONFIG;
      if (runtimeConfig?.MenuSettings) {
        (window as any).__DISABLED_MENUS = {
          showLive: runtimeConfig.MenuSettings.showLive === false,
          showTvbox: runtimeConfig.MenuSettings.showTvbox === false,
          showShortDrama: runtimeConfig.MenuSettings.showShortDrama === false,
          showMovies: runtimeConfig.MenuSettings.showMovies === false,
          showTVShows: runtimeConfig.MenuSettings.showTVShows === false,
          showAnime: runtimeConfig.MenuSettings.showAnime === false,
          showVariety: runtimeConfig.MenuSettings.showVariety === false,
        };
      }
    }
  };

  // 同步到服务端
  const syncToServer = async (): Promise<boolean> => {
    if (!isServerMode()) {
      return false;
    }

    try {
      const response = await fetch('/api/admin/menu-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          MenuSettings: menuSettings,
        }),
      });

      if (response.ok) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  };

  // 更新菜单设置（立即生效）
  const updateMenuSettings = (newSettings: Partial<MenuSettings>) => {
    const updatedSettings = { ...menuSettings, ...newSettings };
    setMenuSettings(updatedSettings);

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
  };

  // 更新自定义分类配置（立即生效）
  const updateCustomCategories = (categories: CustomCategory[]) => {
    setCustomCategories(categories);

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
  };

  // 检查菜单是否启用
  const isMenuEnabled = (menuKey: keyof MenuSettings): boolean => {
    return menuSettings[menuKey];
  };

  // 初始化配置并监听配置变化
  useEffect(() => {
    // 将 refreshConfig 挂载到 window 对象，供 notifyConfigUpdated 调用
    if (typeof window !== 'undefined') {
      (window as any).__refreshConfig = refreshConfig;
    }

    // 初始化配置
    refreshConfig();

    // 创建 BroadcastChannel 用于跨窗口通信
    const channel = new BroadcastChannel(CONFIG_CHANNEL);

    // 监听 BroadcastChannel 消息（配置变更通知）
    const handleBroadcastMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'config-updated') {
        // 检查时间戳，避免重复处理旧的通知
        if (
          event.data.timestamp &&
          event.data.timestamp < lastConfigUpdateTime
        ) {
          return;
        }

        // 重新获取配置
        await refreshConfig();
      }
    };

    channel.addEventListener('message', handleBroadcastMessage);

    return () => {
      channel.removeEventListener('message', handleBroadcastMessage);
      channel.close();
    };
  }, []); // 空依赖数组，只在组件挂载时执行一次

  const value: NavigationConfigContextType = {
    menuSettings,
    updateMenuSettings,
    isMenuEnabled,
    customCategories,
    updateCustomCategories,
    refreshConfig,
    syncToServer,
    storageType,
  };

  return (
    <NavigationConfigContext.Provider value={value}>
      {children}
    </NavigationConfigContext.Provider>
  );
};

// 导出通知配置更新的函数（供 API 调用后使用）
export const notifyConfigUpdated = async () => {
  if (typeof window === 'undefined') {
    return;
  }

  // 更新配置时间戳
  lastConfigUpdateTime = Date.now();

  try {
    // 重新获取配置并更新全局变量
    await (window as any).__refreshConfig?.();

    // 通过 BroadcastChannel 通知其他标签页
    const channel = new BroadcastChannel(CONFIG_CHANNEL);
    channel.postMessage({
      type: 'config-updated',
      timestamp: lastConfigUpdateTime,
    });
    channel.close();
  } catch (error) {
    console.error('[notifyConfigUpdated] 失败:', error);
  }
};
