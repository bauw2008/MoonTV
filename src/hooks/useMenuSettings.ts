import { useEffect, useState } from 'react';

import {
  getMenuSettings,
  getStorageType,
  initConfigListener,
  isMenuEnabled as isMenuEnabledGlobal,
  notifyConfigUpdated,
  syncToServer,
  updateMenuSettings as updateMenuSettingsGlobal,
} from '@/lib/global-config';
import { useToast } from '@/hooks/useToast';

export function useMenuSettings() {
  const [menuSettings, setMenuSettings] = useState(getMenuSettings());
  const storageType = getStorageType();
  const { success: showToast } = useToast();

  // 监听配置变化
  useEffect(() => {
    // 监听全局配置更新事件
    const handleConfigUpdate = () => {
      const newSettings = getMenuSettings();
      setMenuSettings(newSettings);
    };

    window.addEventListener('vidora-config-update', handleConfigUpdate);

    // 初始化广播监听
    const cleanup = initConfigListener();

    return () => {
      window.removeEventListener('vidora-config-update', handleConfigUpdate);
      cleanup();
    };
  }, []);

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
  }, [storageType, showToast]);

  const updateMenuSettings = (newSettings: Partial<typeof menuSettings>) => {
    updateMenuSettingsGlobal(newSettings);
    setMenuSettings(getMenuSettings()); // 立即更新本地状态
  };

  const toggleMenu = (menuKey: keyof typeof menuSettings) => {
    const newSettings = {
      ...menuSettings,
      [menuKey]: !menuSettings[menuKey],
    };
    updateMenuSettingsGlobal(newSettings);
    setMenuSettings(newSettings);

    // localstorage 模式：立即通知配置更新
    if (storageType === 'localstorage') {
      notifyConfigUpdated();
    }

    // 触发自定义事件，通知其他组件更新
    window.dispatchEvent(
      new CustomEvent('vidora-config-update', {
        bubbles: true,
        composed: true,
        detail: { menuSettings: newSettings },
      }),
    );
  };

  const setMenuEnabled = (
    menuKey: keyof typeof menuSettings,
    enabled: boolean,
  ) => {
    const newSettings = { ...menuSettings, [menuKey]: enabled };
    updateMenuSettingsGlobal(newSettings);
    setMenuSettings(newSettings);

    // localstorage 模式：立即通知配置更新
    if (storageType === 'localstorage') {
      notifyConfigUpdated();
    }

    // 触发自定义事件，通知其他组件更新
    window.dispatchEvent(
      new CustomEvent('vidora-config-update', {
        bubbles: true,
        composed: true,
        detail: { menuSettings: newSettings },
      }),
    );
  };

  return {
    menuSettings,
    updateMenuSettings,
    isMenuEnabled: isMenuEnabledGlobal,
    toggleMenu,
    setMenuEnabled,
    syncToServer,
    storageType,
  };
}
