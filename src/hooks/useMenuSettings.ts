import { useCallback, useEffect } from 'react';

import {
  notifyConfigUpdated,
  useNavigationConfig,
} from '@/contexts/NavigationConfigContext';
import { useToast } from '@/hooks/useToast';

export function useMenuSettings() {
  const {
    menuSettings,
    updateMenuSettings,
    isMenuEnabled,
    syncToServer,
    storageType,
  } = useNavigationConfig();
  const { success: showToast } = useToast();

  // 自动同步到服务端（防抖）
  useEffect(() => {
    let syncTimeout: NodeJS.Timeout;

    const autoSync = () => {
      if (storageType !== 'localstorage') {
        syncTimeout = setTimeout(async () => {
          const success = await syncToServer();
          if (success) {
            showToast('菜单配置已同步到服务端');
            // 通知其他窗口重新获取配置
            notifyConfigUpdated();
          }
        }, 1000); // 1 秒防抖
      }
    };

    // 监听配置变化
    const handleConfigChange = () => {
      clearTimeout(syncTimeout);
      autoSync();
    };

    window.addEventListener('vidora-config-update', handleConfigChange);

    return () => {
      clearTimeout(syncTimeout);
      window.removeEventListener('vidora-config-update', handleConfigChange);
    };
  }, [storageType, syncToServer, showToast]);

  const toggleMenu = useCallback(
    (menuKey: keyof typeof menuSettings) => {
      updateMenuSettings({
        [menuKey]: !menuSettings[menuKey],
      });

      // 触发自定义事件，通知其他组件更新
      window.dispatchEvent(
        new CustomEvent('vidora-config-update', {
          detail: {
            menuSettings: {
              ...menuSettings,
              [menuKey]: !menuSettings[menuKey],
            },
          },
        }),
      );
    },
    [menuSettings, updateMenuSettings],
  );

  const setMenuEnabled = useCallback(
    (menuKey: keyof typeof menuSettings, enabled: boolean) => {
      updateMenuSettings({
        [menuKey]: enabled,
      });

      // 触发自定义事件，通知其他组件更新
      window.dispatchEvent(
        new CustomEvent('vidora-config-update', {
          detail: {
            menuSettings: {
              ...menuSettings,
              [menuKey]: enabled,
            },
          },
        }),
      );
    },
    [menuSettings, updateMenuSettings],
  );

  return {
    menuSettings,
    updateMenuSettings,
    isMenuEnabled,
    toggleMenu,
    setMenuEnabled,
    syncToServer,
    storageType,
  };
}
