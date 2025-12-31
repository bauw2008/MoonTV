'use client';

import { Clock, Save, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';

import { PermissionGuard } from '@/components/PermissionGuard';

import { useNavigationConfig } from '@/contexts/NavigationConfigContext';

import { CollapsibleTab } from '@/components/admin/ui/CollapsibleTab';
import { useAdminState } from '@/hooks/admin/useAdminState';

interface NetDiskSettings {
  enabled: boolean;
  pansouUrl: string;
  timeout: number;
  enabledCloudTypes: string[];
}

function NetdiskConfigContent() {
  const { loading, withLoading } = useAdminState();
  const { updateSearchFeatures } = useNavigationConfig();
  const [config, setConfig] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);
  const [netDiskSettings, setNetDiskSettings] = useState<NetDiskSettings>({
    enabled: true,
    pansouUrl: 'https://so.252035.xyz',
    timeout: 30,
    enabledCloudTypes: [
      'baidu',
      'aliyun',
      'quark',
      'tianyi',
      'uc',
      'mobile',
      '115',
      'pikpak',
      'xunlei',
      '123',
      'magnet',
      'ed2k',
    ],
  });

  // 网盘类型选项
  const CLOUD_TYPE_OPTIONS = [
    { key: 'baidu', name: '百度网盘', icon: '📁' },
    { key: 'aliyun', name: '阿里云盘', icon: '☁️' },
    { key: 'quark', name: '夸克网盘', icon: '⚡' },
    { key: 'tianyi', name: '天翼云盘', icon: '📱' },
    { key: 'uc', name: 'UC网盘', icon: '🌐' },
    { key: 'mobile', name: '移动云盘', icon: '📲' },
    { key: '115', name: '115网盘', icon: '💾' },
    { key: 'pikpak', name: 'PikPak', icon: '📦' },
    { key: 'xunlei', name: '迅雷网盘', icon: '⚡' },
    { key: '123', name: '123网盘', icon: '🔢' },
    { key: 'magnet', name: '磁力链接', icon: '🧲' },
    { key: 'ed2k', name: '电驴链接', icon: '🐴' },
  ];

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      await withLoading('loadNetdiskConfig', async () => {
        const response = await fetch('/api/admin/config');
        const data = await response.json();
        setConfig(data.Config);

        if (data.Config.NetDiskConfig) {
          setNetDiskSettings({
            enabled: data.Config.NetDiskConfig.enabled ?? false,
            pansouUrl:
              data.Config.NetDiskConfig.pansouUrl || 'https://so.252035.xyz',
            timeout: data.Config.NetDiskConfig.timeout || 30,
            enabledCloudTypes: data.Config.NetDiskConfig.enabledCloudTypes || [
              'baidu',
              'aliyun',
              'quark',
              'tianyi',
              'uc',
            ],
          });
        }
      });
    } catch (error) {
      console.error('加载网盘配置失败:', error);
    }
  };

  const handleSave = async () => {
    try {
      await withLoading('saveNetDiskConfig', async () => {
        const response = await fetch('/api/admin/netdisk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(netDiskSettings),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '保存失败');
        }

        // 使用Toast通知保存成功
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.success('网盘搜索配置保存成功');
          });
        }

        // 同步更新NavigationConfigContext中的网盘搜索状态
        updateSearchFeatures({ netDiskSearch: netDiskSettings.enabled });

        await loadConfig();
      });
    } catch (error) {
      console.error('保存网盘配置失败:', error);
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('保存失败: ' + (error as Error).message);
        });
      }
    }
  };

  const handleCloudTypeChange = (type: string, enabled: boolean) => {
    setNetDiskSettings((prev) => ({
      ...prev,
      enabledCloudTypes: enabled
        ? [...prev.enabledCloudTypes, type]
        : prev.enabledCloudTypes.filter((t) => t !== type),
    }));
  };

  const handleSelectAll = (selectAll: boolean) => {
    setNetDiskSettings((prev) => ({
      ...prev,
      enabledCloudTypes: selectAll
        ? CLOUD_TYPE_OPTIONS.map((option) => option.key)
        : [],
    }));
  };

  return (
    <CollapsibleTab
      title='网盘配置'
      theme='green'
      icon={
        <svg
          className='w-5 h-5 text-green-500'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z'
          />
        </svg>
      }
      isExpanded={expanded}
      onToggle={() => setExpanded(!expanded)}
    >
      {loading.loadNetdiskConfig ? (
        <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
          加载中...
        </div>
      ) : (
        <div className='space-y-6'>
          {/* 总开关 */}
          <div className='bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700 p-6'>
            <div className='flex items-center justify-between'>
              <div>
                <h4 className='text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2'>
                  <Shield className='w-5 h-5' />
                  网盘搜索功能
                </h4>
                <p className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
                  {netDiskSettings.enabled 
                    ? '开启后将启用网盘搜索功能，可以搜索各类网盘资源' 
                    : '已禁用网盘搜索功能，用户将无法使用网盘搜索'}
                </p>
              </div>
              <label className='relative inline-flex items-center cursor-pointer'>
                <input
                  type='checkbox'
                  checked={netDiskSettings.enabled}
                  onChange={(e) =>
                    setNetDiskSettings((prev) => ({
                      ...prev,
                      enabled: e.target.checked,
                    }))
                  }
                  className='sr-only peer'
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
              </label>
            </div>
          </div>

          {/* 只有在开关开启时才显示其他内容 */}
          {netDiskSettings.enabled && (
            <>
              {/* 基础设置 */}
              <div className='bg-green-50 dark:bg-green-900/30 rounded-lg p-6 border border-green-200 dark:border-green-700'>
                <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4'>
                  基础设置
                </h3>

                {/* PanSou服务地址 */}
                <div className='space-y-2'>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                    PanSou服务地址
                  </label>
                  <input
                    type='url'
                    value={netDiskSettings.pansouUrl}
                    onChange={(e) =>
                      setNetDiskSettings((prev) => ({
                        ...prev,
                        pansouUrl: e.target.value,
                      }))
                    }
                    placeholder='https://so.252035.xyz'
                    className='w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-md bg-transparent dark:bg-transparent text-gray-900 dark:text-gray-100 focus:ring-green-500 focus:border-green-500'
                  />
                  <p className='text-sm text-gray-500 dark:text-gray-400'>
                    默认使用公益服务，您也可以填入自己搭建的PanSou服务地址
                  </p>
                </div>

                {/* 请求超时时间 */}
                <div className='space-y-2 mt-4'>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                    请求超时时间（秒）
                  </label>
                  <div className='flex items-center space-x-2'>
                    <Clock size={16} className='text-gray-500' />
                    <input
                      type='number'
                      min='5'
                      max='120'
                      value={netDiskSettings.timeout}
                      onChange={(e) =>
                        setNetDiskSettings((prev) => ({
                          ...prev,
                          timeout: parseInt(e.target.value) || 30,
                        }))
                      }
                      className='w-24 px-3 py-2 border border-green-300 dark:border-green-600 rounded-md bg-transparent dark:bg-transparent text-gray-900 dark:text-gray-100 focus:ring-green-500 focus:border-green-500'
                    />
                    <span className='text-sm text-gray-500 dark:text-gray-400'>
                      秒
                    </span>
                  </div>
                  <p className='text-sm text-gray-500 dark:text-gray-400'>
                    网盘搜索请求的超时时间，建议设置为30秒
                  </p>
                </div>
              </div>

          {/* 网盘类型选择 */}
          <div className='bg-green-50 dark:bg-green-900/30 rounded-lg p-6 border border-green-200 dark:border-green-700'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4'>
              网盘类型选择
            </h3>

            {/* 全选/清空按钮 */}
            <div className='flex items-center justify-between mb-4'>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                已选择 {netDiskSettings.enabledCloudTypes.length} /{' '}
                {CLOUD_TYPE_OPTIONS.length} 种类型
              </p>
              <div className='flex space-x-2'>
                <button
                  onClick={() => handleSelectAll(true)}
                  className='px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors'
                >
                  全选
                </button>
                <button
                  onClick={() => handleSelectAll(false)}
                  className='px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors'
                >
                  清空
                </button>
              </div>
            </div>

            {/* 网盘类型网格 */}
            <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
              {CLOUD_TYPE_OPTIONS.map((option) => (
                <label
                  key={option.key}
                  className='flex items-center space-x-3 p-3 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-800 cursor-pointer transition-colors'
                >
                  <input
                    type='checkbox'
                    checked={netDiskSettings.enabledCloudTypes.includes(
                      option.key,
                    )}
                    onChange={(e) =>
                      handleCloudTypeChange(option.key, e.target.checked)
                    }
                    className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700'
                  />
                  <span className='text-lg'>{option.icon}</span>
                  <span className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                    {option.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 保存按钮 */}
              <div className='flex gap-3'>
                <button
                  onClick={handleSave}
                  disabled={loading.saveNetDiskConfig}
                  className='flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium'
                >
                  <div className='flex items-center justify-center gap-2'>
                    {loading.saveNetDiskConfig ? (
                      <>
                        <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                        保存中...
                      </>
                    ) : (
                      <>
                        <Save className='w-4 h-4' />
                        保存配置
                      </>
                    )}
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </CollapsibleTab>
  );
}

// 导出组件
export function NetdiskConfig() {
  return (
    <PermissionGuard permission='canManageConfig'>
      <NetdiskConfigContent />
    </PermissionGuard>
  );
}
