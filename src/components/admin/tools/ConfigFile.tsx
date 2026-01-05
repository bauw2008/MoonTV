'use client';

// Type declarations for DOM APIs
declare global {
  interface HTMLAnchorElement {
    href: string;
    download: string;
    click(): void;
  }
}

import {
  AlertTriangle,
  CheckCircle,
  Download,
  FileText,
  Globe,
  RefreshCw,
  Save,
  Upload,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAdminPermissions } from '@/hooks/admin/useAdminPermissions';
import { useAdminState } from '@/hooks/admin/useAdminState';

import { CollapsibleTab } from '@/components/admin/ui/CollapsibleTab';

export function ConfigFile() {
  const permissions = useAdminPermissions();
  const { loading, withLoading } = useAdminState();

  const [configContent, setConfigContent] = useState('');
  const [subscriptionUrl, setSubscriptionUrl] = useState('');
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');
  const [isValidJson, setIsValidJson] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    validateJson();
  }, [configContent]);

  const loadConfig = async () => {
    // 防止重复加载
    if (isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      const data = await withLoading('loadConfigFile', async () => {
        const response = await fetch('/api/admin/config', {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
          cache: 'no-store',
        });
        const resp = await response.json();
        return resp;
      });

      setConfig(data);

      // 直接从Config对象获取数据
      const configData = data.Config || {};
      const configFile = configData.ConfigFile;
      const configSub = configData.ConfigSubscribtion;

      if (configFile) {
        setConfigContent(configFile);
      }

      if (configSub) {
        setSubscriptionUrl(configSub.URL || '');
        setAutoUpdate(configSub.AutoUpdate || false);
        setLastCheckTime(configSub.LastCheck || '');
      }

      console.log('ConfigFile - 最终组件状态:', {
        configContent: configContent,
        subscriptionUrl,
        autoUpdate,
        lastCheckTime,
      });
    } catch (error) {
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error(
            '加载配置失败: ' +
              (error instanceof Error ? error.message : '未知错误'),
          );
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const validateJson = () => {
    if (!configContent.trim()) {
      setIsValidJson(true);
      return;
    }

    try {
      JSON.parse(configContent);
      setIsValidJson(true);
    } catch (error) {
      setIsValidJson(false);
    }
  };

  const handleFetchConfig = async () => {
    if (!subscriptionUrl.trim()) {
      // 使用Toast通知
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('请输入订阅URL');
        });
      }
      return;
    }

    try {
      const result = await withLoading('fetchConfig', async () => {
        const response = await fetch('/api/admin/config_subscription/fetch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: subscriptionUrl }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `拉取失败: ${response.status}`);
        }

        return response.json();
      });

      if (result.configContent) {
        setConfigContent(result.configContent);
        const currentTime = new Date().toISOString();
        setLastCheckTime(currentTime);
        // 使用Toast通知
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.success('配置拉取成功');
          });
        }
      } else {
        // 使用Toast通知
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.error('拉取失败：未获取到配置内容');
          });
        }
      }
    } catch (error) {
      // 使用Toast通知
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error(
            '拉取失败: ' +
              (error instanceof Error ? error.message : '未知错误'),
          );
        });
      }
    }
  };

  const handleSave = async () => {
    if (!isValidJson) {
      // 使用Toast通知
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('配置内容格式错误，请检查JSON格式');
        });
      }
      return;
    }

    try {
      await withLoading('saveConfig', async () => {
        const response = await fetch('/api/admin/config_file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            configFile: configContent,
            subscriptionUrl,
            autoUpdate,
            lastCheckTime: lastCheckTime || new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `保存失败: ${response.status}`);
        }

        return response.json();
      });

      // 使用Toast通知
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.success('配置管理保存成功');
        });
      }

      // 立即刷新配置
      await loadConfig();

      // 再次延迟刷新确保数据同步
      setTimeout(async () => {
        console.log('ConfigFile - 延迟二次刷新配置');
        await loadConfig();
      }, 1000);
    } catch (error) {
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error(
            '保存失败: ' +
              (error instanceof Error ? error.message : '未知错误'),
          );
        });
      }
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(configContent, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a') as HTMLAnchorElement;
    link.href = url;
    link.download = 'config-backup.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        setConfigContent(content);
        // 使用Toast通知
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.success('配置管理导入成功');
          });
        }
      } catch (error) {
        // 使用Toast通知
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.error('导入失败：文件格式错误');
          });
        }
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  if (!permissions.isOwner) {
    return (
      <CollapsibleTab
        title='配置管理'
        theme='blue'
        icon={<FileText className='w-5 h-5 text-blue-500' />}
        defaultCollapsed={true}
      >
        <div className='bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 dark:from-gray-800 dark:via-blue-900/20 dark:to-purple-900/20 rounded-2xl shadow-xl backdrop-blur-sm border border-blue-100/50 dark:border-blue-800/50 p-8'>
          <p className='text-red-600 dark:text-red-400'>
            您没有权限访问配置管理（仅站长可用）
          </p>
        </div>
      </CollapsibleTab>
    );
  }

  return (
    <CollapsibleTab
      title='配置管理'
      theme='blue'
      icon={<FileText className='w-5 h-5 text-blue-500' />}
      defaultCollapsed={true}
    >
      <div className='space-y-6'>
        {/* 订阅配置区域 */}
        <div className='bg-gradient-to-r from-blue-50/60 via-indigo-50/50 to-purple-50/40 dark:from-blue-900/40 dark:via-indigo-900/30 dark:to-purple-900/20 rounded-2xl p-6 border border-blue-200/50 dark:border-blue-800/50 backdrop-blur-sm'>
          <div className='flex items-center space-x-3'>
            <div className='p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg'>
              <Globe className='w-6 h-6 text-white' />
            </div>
            <div>
              <h3 className='text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2'>
                订阅配置
              </h3>
            </div>{' '}
          </div>

          <div className='space-y-4'>
            <div>
              <input
                type='text'
                value={subscriptionUrl}
                onChange={(e) => setSubscriptionUrl(e.target.value)}
                placeholder='远程配置文件地址'
                className='w-full px-4 py-3 border border-blue-200/50 dark:border-blue-700/50 rounded-xl bg-white/80 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 backdrop-blur-sm transition-all'
              />
            </div>

            <div className='flex items-center justify-between'>
              <label className='flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-800/30 dark:to-purple-800/30 rounded-xl cursor-pointer hover:from-blue-200 hover:to-purple-200 dark:hover:from-blue-700/40 dark:hover:to-purple-700/40 transition-all'>
                <input
                  type='checkbox'
                  id='autoUpdate'
                  checked={autoUpdate}
                  onChange={(e) => setAutoUpdate(e.target.checked)}
                  className='w-5 h-5 text-blue-600 border-blue-200 rounded focus:ring-blue-500 dark:border-blue-700 dark:bg-gray-700'
                />
                <span className='text-sm font-semibold text-blue-700 dark:text-blue-300'>
                  自动更新
                </span>
              </label>
              <button
                onClick={handleFetchConfig}
                disabled={loading.fetchConfig || !subscriptionUrl.trim()}
                className='px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-2'
              >
                <Download className='w-5 h-5' />
                <span className='font-semibold'>
                  {loading.fetchConfig ? '拉取中...' : '拉取配置'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 配置文件编辑区域 */}
        <div className='bg-gradient-to-br from-emerald-50/40 via-teal-50/30 to-cyan-50/20 dark:from-emerald-900/20 dark:via-teal-900/15 dark:to-cyan-900/10 rounded-2xl p-6 border border-emerald-200/50 dark:border-emerald-800/50 backdrop-blur-sm'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0'>
            <div className='flex items-center space-x-3'>
              <div className='p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg'>
                <FileText className='w-6 h-6 text-white' />
              </div>
              <h3 className='text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent'>
                配置内容
              </h3>
            </div>{' '}
            
            {/* JSON格式验证状态 - 仅在PC端显示 */}
            {configContent && (
              <div className='hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-white/80 dark:bg-gray-800/50 rounded-xl backdrop-blur-sm'>
                {isValidJson ? (
                  <CheckCircle className='w-4 h-4 text-emerald-600' />
                ) : (
                  <XCircle className='w-4 h-4 text-red-500' />
                )}
                <span
                  className={`text-xs font-semibold ${isValidJson ? 'text-emerald-600' : 'text-red-600'}`}
                >
                  {isValidJson ? 'JSON格式正确' : 'JSON格式错误'}
                </span>
              </div>
            )}
          </div>

          <div className='p-6'>
            <textarea
              value={configContent}
              onChange={(e) => setConfigContent(e.target.value)}
              rows={20}
              placeholder='JSON配置内容...'
              className='w-full px-4 py-4 border border-emerald-200/50 dark:border-emerald-700/50 rounded-2xl bg-white/90 dark:bg-gray-800/60 text-gray-900 dark:text-gray-100 font-mono text-sm leading-relaxed resize-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 backdrop-blur-sm transition-all'
              style={{
                fontFamily:
                  'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
              }}
            />

            {/* 移动端JSON格式验证状态 */}
            {configContent && (
              <div className='sm:hidden mt-4 flex items-center space-x-2 px-3 py-1.5 bg-white/80 dark:bg-gray-800/50 rounded-xl backdrop-blur-sm'>
                {isValidJson ? (
                  <CheckCircle className='w-4 h-4 text-emerald-600' />
                ) : (
                  <XCircle className='w-4 h-4 text-red-500' />
                )}
                <span
                  className={`text-xs font-semibold ${isValidJson ? 'text-emerald-600' : 'text-red-600'}`}
                >
                  {isValidJson ? 'JSON格式正确' : 'JSON格式错误'}
                </span>
              </div>
            )}

            {/* 操作按钮区域 - 移动端独立一行显示 */}
            <div className='mt-6 grid grid-cols-2 sm:flex sm:flex-row sm:items-center sm:justify-center sm:space-x-2 gap-3 sm:gap-0 sm:space-y-0'>
              <button
                onClick={handleSave}
                disabled={loading.saveConfig || !isValidJson}
                className='px-4 py-3 text-xs bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center space-x-1 w-full sm:w-auto'
              >
                <Save className='w-4 h-4' />
                <span>保存</span>
              </button>
              <button
                onClick={loadConfig}
                disabled={loading.loadConfigFile}
                className='px-4 py-3 text-xs bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center space-x-1 w-full sm:w-auto'
              >
                <RefreshCw
                  className={`w-3 h-3 ${loading.loadConfigFile ? 'animate-spin' : ''}`}
                />
                <span>刷新</span>
              </button>

              <label className='flex items-center justify-center space-x-2 px-3 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl cursor-pointer transition-all shadow-lg hover:shadow-xl transform hover:scale-105 w-full sm:w-auto'>
                <Upload className='w-4 h-4' />
                <span className='text-sm font-medium'>导入</span>
                <input
                  type='file'
                  accept='.json'
                  onChange={handleImport}
                  className='hidden'
                />
              </label>

              <button
                onClick={handleExport}
                className='px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center space-x-1 w-full sm:w-auto'
              >
                <Download className='w-4 h-4' />
                <span className='text-sm font-medium'>导出</span>
              </button>
            </div>

            {!isValidJson && (
              <div className='mt-4 p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/30 dark:to-pink-900/20 border border-red-200/50 dark:border-red-800/50 rounded-xl backdrop-blur-sm'>
                <div className='flex items-center'>
                  <AlertTriangle className='w-5 h-5 text-red-500 mr-3' />
                  <span className='text-sm font-semibold text-red-700 dark:text-red-300'>
                    JSON格式错误，请检查配置内容
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </CollapsibleTab>
  );
}
