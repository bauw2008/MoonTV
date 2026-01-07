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
  forceUpdate: () => void;
}

const NavigationConfigContext =
  createContext<NavigationConfigContextType | null>(null);

export const useNavigationConfig = () => {
  const context = useContext(NavigationConfigContext);
  if (!context) {
    // 在开发环境下提供更详细的错误信息
    if (process.env.NODE_ENV === 'development') {
      // 静默处理错误
    }

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
      forceUpdate: () => {},
    };

    return defaultContext;
  }
  return context;
};

interface NavigationConfigProviderProps {
  children: ReactNode;
}

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

  // 初始化配置
  const refreshConfig = () => {
    if (typeof window !== 'undefined') {
      // 优先从localStorage读取最新配置
      try {
        const savedSettings = localStorage.getItem('vidora-menu-settings');
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings);
          // 静默处理配置加载
          setMenuSettings(parsedSettings);
        }

        const savedCategories = localStorage.getItem(
          'vidora-custom-categories',
        );
        if (savedCategories) {
          const parsedCategories = JSON.parse(savedCategories);
          // 静默处理分类配置加载
          setCustomCategories(parsedCategories);

          // 同时更新RUNTIME_CONFIG
          const runtimeConfig =
            (window as unknown as Record<string, unknown>).RUNTIME_CONFIG || {};
          (runtimeConfig as Record<string, unknown>).CUSTOM_CATEGORIES = (
            parsedCategories as Array<{
              name: string;
              type: string;
              query: string;
              disabled?: boolean;
            }>
          ).map((cat) => ({
            name: cat.name,
            type: cat.type,
            query: cat.query,
            disabled: cat.disabled,
          }));
          (window as unknown as Record<string, unknown>).RUNTIME_CONFIG =
            runtimeConfig;
          // 静默处理RUNTIME_CONFIG更新
        }

        // 如果localStorage有数据，直接返回
        if (savedSettings || savedCategories) {
          return;
        }
      } catch {
        // 静默处理localStorage读取错误
      }

      // 备用方案：从RUNTIME_CONFIG读取或API获取
      const runtimeConfig = (window as unknown as Record<string, unknown>)
        .RUNTIME_CONFIG as any;
      if (runtimeConfig?.MenuSettings) {
        // 静默处理RUNTIME_CONFIG初始化
        const defaultSettings = {
          showMovies: runtimeConfig.MenuSettings.showMovies ?? true,
          showTVShows: runtimeConfig.MenuSettings.showTVShows ?? true,
          showAnime: runtimeConfig.MenuSettings.showAnime ?? true,
          showVariety: runtimeConfig.MenuSettings.showVariety ?? true,
          showLive: runtimeConfig.MenuSettings.showLive ?? false,
          showTvbox: runtimeConfig.MenuSettings.showTvbox ?? false,
          showShortDrama: runtimeConfig.MenuSettings.showShortDrama ?? false,
          showAI:
            runtimeConfig.MenuSettings.showAI ??
            runtimeConfig.AIRecommendConfig?.enabled ??
            false,
          showNetDiskSearch:
            runtimeConfig.MenuSettings.showNetDiskSearch ??
            runtimeConfig.NetDiskConfig?.enabled ??
            false,
          showTMDBActorSearch:
            runtimeConfig.MenuSettings.showTMDBActorSearch ?? false,
        };
        setMenuSettings(defaultSettings);
        // 同时保存到localStorage
        localStorage.setItem(
          'vidora-menu-settings',
          JSON.stringify(defaultSettings),
        );
      }

      if (runtimeConfig && 'CUSTOM_CATEGORIES' in runtimeConfig) {
        // 静默处理RUNTIME_CONFIG分类初始化
        // 将RUNTIME_CONFIG中的格式转换为CustomCategory格式
        const categories: CustomCategory[] = (
          (runtimeConfig as any).CUSTOM_CATEGORIES as Array<{
            name: string;
            type: string;
            query: string;
            disabled?: boolean;
            from?: string;
          }>
        ).map((cat) => ({
          name: cat.name,
          type: cat.type as 'movie' | 'tv',
          query: cat.query,
          disabled: false,
          from: cat.from || 'runtime',
        }));
        setCustomCategories(categories);
        // 保存到localStorage
        localStorage.setItem(
          'vidora-custom-categories',
          JSON.stringify(categories),
        );
      }
    }
  };

  // 更新菜单设置（立即生效）
  const updateMenuSettings = (newSettings: Partial<MenuSettings>) => {
    // 静默处理菜单设置更新
    const updatedSettings = { ...menuSettings, ...newSettings };
    setMenuSettings(updatedSettings);

    // 同时更新全局配置
    if (typeof window !== 'undefined') {
      const runtimeConfig =
        (window as unknown as Record<string, unknown>).RUNTIME_CONFIG || {};
      (runtimeConfig as any).MenuSettings = updatedSettings;
      (window as unknown as Record<string, unknown>).RUNTIME_CONFIG =
        runtimeConfig;

      // 保存到localStorage，实现跨窗口同步
      try {
        localStorage.setItem(
          'vidora-menu-settings',
          JSON.stringify(updatedSettings),
        );
        // 静默处理localStorage保存
      } catch {
        // 静默处理localStorage保存错误
      }
    }
  };

  // 更新自定义分类配置（立即生效）
  const updateCustomCategories = (categories: CustomCategory[]) => {
    // 静默处理自定义分类配置更新
    setCustomCategories(categories);

    // 同时更新全局配置
    if (typeof window !== 'undefined') {
      const runtimeConfig =
        (window as unknown as Record<string, unknown>).RUNTIME_CONFIG || {};
      // 保存所有分类（包括禁用的），但标记disabled状态
      (runtimeConfig as any).CUSTOM_CATEGORIES = categories.map((cat) => ({
        name: cat.name,
        type: cat.type as 'movie' | 'tv',
        query: cat.query,
        disabled: cat.disabled,
      }));
      (window as unknown as Record<string, unknown>).RUNTIME_CONFIG =
        runtimeConfig;

      // 保存到localStorage，实现跨窗口同步
      try {
        localStorage.setItem(
          'vidora-custom-categories',
          JSON.stringify(categories),
        );
        // 静默处理分类配置保存
      } catch {
        // 静默处理分类配置保存错误
      }
    }
  };

  // 强制更新（用于立即生效）
  const forceUpdate = () => {
    // 确保RUNTIME_CONFIG是最新的
    if (typeof window !== 'undefined') {
      const runtimeConfig =
        (window as unknown as Record<string, unknown>).RUNTIME_CONFIG || {};
      (runtimeConfig as any).CUSTOM_CATEGORIES = customCategories.map(
        (cat) => ({
          name: cat.name,
          type: cat.type,
          query: cat.query,
          disabled: cat.disabled,
        }),
      );
      (window as unknown as Record<string, unknown>).RUNTIME_CONFIG =
        runtimeConfig;

      // 触发storage事件，通知其他页面更新
      window.dispatchEvent(
        new Event('storage', {
          key: 'vidora-custom-categories',
          newValue: JSON.stringify(customCategories),
        } as Record<string, unknown>),
      );
    }
  };

  // 检查菜单是否启用
  const isMenuEnabled = (menuKey: keyof MenuSettings): boolean => {
    return menuSettings[menuKey];
  };

  // 初始化配置并监听localStorage变化（跨窗口同步）
  useEffect(() => {
    refreshConfig();

    // 监听localStorage变化，实现跨窗口同步
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'vidora-menu-settings' && e.newValue) {
        // 静默处理跨窗口菜单配置变更
        try {
          const newSettings = JSON.parse(e.newValue);
          setMenuSettings(newSettings);
        } catch {
          // 静默处理菜单配置解析错误
        }
      } else if (e.key === 'vidora-custom-categories' && e.newValue) {
        // 静默处理跨窗口分类配置变更
        try {
          const newCategories = JSON.parse(e.newValue);
          setCustomCategories(newCategories);

          // 同时更新RUNTIME_CONFIG
          if (typeof window !== 'undefined') {
            const runtimeConfig =
              (window as unknown as Record<string, unknown>).RUNTIME_CONFIG ||
              {};
            (runtimeConfig as any).CUSTOM_CATEGORIES = (
              newCategories as Array<{
                name: string;
                type: string;
                query: string;
                disabled?: boolean;
              }>
            ).map((cat) => ({
              name: cat.name,
              type: cat.type,
              query: cat.query,
              disabled: cat.disabled,
            }));
            (window as unknown as Record<string, unknown>).RUNTIME_CONFIG =
              runtimeConfig;
          }
        } catch {
          // 静默处理分类配置解析错误
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const value: NavigationConfigContextType = {
    menuSettings,
    updateMenuSettings,
    isMenuEnabled,
    customCategories,
    updateCustomCategories,
    refreshConfig,
    forceUpdate,
  };

  return (
    <NavigationConfigContext.Provider value={value}>
      {children}
    </NavigationConfigContext.Provider>
  );
};
