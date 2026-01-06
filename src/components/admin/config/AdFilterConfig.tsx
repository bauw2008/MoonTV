'use client';

import { AlertTriangle, Code, Info, RotateCcw, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import {
  useAdminAuth,
  useAdminLoading,
  useToastNotification,
} from '@/hooks/admin';

interface CustomAdFilterSettings {
  CustomAdFilterCode: string;
  CustomAdFilterVersion: number;
  CustomAdFilterEnabled: boolean;
}

function CustomAdFilterConfigContent({
  config,
  refreshConfig,
}: {
  config?: any;
  refreshConfig?: () => void;
}) {
  // 使用统一的 hooks
  const { loading, error, isAdminOrOwner } = useAdminAuth();
  const { isLoading, withLoading } = useAdminLoading();
  const { showError, showSuccess } = useToastNotification();

  // 去广告配置状态
  const [filterSettings, setFilterSettings] = useState<CustomAdFilterSettings>({
    CustomAdFilterCode: '',
    CustomAdFilterVersion: 1,
    CustomAdFilterEnabled: false,
  });

  const [hasChanges, setHasChanges] = useState(false);

  // 初始化配置
  useEffect(() => {
    if (config?.SiteConfig) {
      setFilterSettings({
        CustomAdFilterCode: config.SiteConfig.CustomAdFilterCode || '',
        CustomAdFilterVersion: config.SiteConfig.CustomAdFilterVersion || 1,
        CustomAdFilterEnabled: config.SiteConfig.CustomAdFilterEnabled || false,
      });
    }
  }, [config]);

  // 检测变更
  useEffect(() => {
    const originalCode = config?.SiteConfig?.CustomAdFilterCode || '';
    const originalVersion = config?.SiteConfig?.CustomAdFilterVersion || 1;
    const originalEnabled = config?.SiteConfig?.CustomAdFilterEnabled || false;
    setHasChanges(
      filterSettings.CustomAdFilterCode !== originalCode ||
        filterSettings.CustomAdFilterVersion !== originalVersion ||
        filterSettings.CustomAdFilterEnabled !== originalEnabled,
    );
  }, [filterSettings, config]);

  // 非管理员或站长禁止访问
  if (!isAdminOrOwner) {
    return (
      <div className='p-6 text-center text-red-500'>
        <h2 className='text-xl font-semibold mb-2'>访问受限</h2>
        <p>您没有权限访问AD过滤配置功能</p>
      </div>
    );
  }

  // 默认示例代码
  const defaultExample = `// 示例1：过滤包含特定关键词的广告片段
function filterAdsFromM3U8(type, m3u8Content) {
  const lines = m3u8Content.split('\n');
  const filteredLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 跳过包含广告关键词的行
    if (line.includes('ad') || line.includes('advertisement') || line.includes('commercial')) {
      continue;
    }
    
    filteredLines.push(line);
  }
  
  return filteredLines.join('\n');
}`;

  // 保存配置
  const saveConfig = async () => {
    try {
      await withLoading('saveAdFilterConfig', async () => {
        // 获取当前配置
        const configResponse = await fetch('/api/admin/config');
        const data = await configResponse.json();

        // 合并现有配置和去广告配置
        const payload = {
          ...data.Config?.SiteConfig,
          CustomAdFilterCode: filterSettings.CustomAdFilterCode,
          CustomAdFilterVersion: filterSettings.CustomAdFilterVersion,
          CustomAdFilterEnabled: filterSettings.CustomAdFilterEnabled,
        };

        const saveResponse = await fetch('/api/admin/site', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!saveResponse.ok) {
          const errorData = await saveResponse.json().catch(() => ({}));
          throw new Error(errorData.error || '保存失败');
        }

        showSuccess('去广告配置保存成功');
        setHasChanges(false);
        if (refreshConfig) {
          refreshConfig();
        }
      });
    } catch (error) {
      showError('保存失败: ' + (error as Error).message);
    }
  };

  // 重置配置
  const handleReset = () => {
    setFilterSettings({
      CustomAdFilterCode: '',
      CustomAdFilterVersion: 1,
      CustomAdFilterEnabled: false,
    });
  };

  // 使用示例
  const useExample = () => {
    setFilterSettings({
      ...filterSettings,
      CustomAdFilterCode: defaultExample,
    });
  };

  // 验证代码
  const validateCode = (code: string): string[] => {
    const errors = [];

    // 检查是否包含必需的函数
    if (!code.includes('function filterAdsFromM3U8')) {
      errors.push('必须包含 filterAdsFromM3U8 函数');
    }

    // 检查是否包含危险的代码
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout\s*\(/,
      /setInterval\s*\(/,
      /XMLHttpRequest/,
      /fetch\s*\(/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        errors.push('代码包含不安全的操作');
        break;
      }
    }

    return errors;
  };

  const codeErrors = validateCode(filterSettings.CustomAdFilterCode);

  return (
    <div className='p-6'>
      {isLoading('loadAdFilterConfig') ? (
        <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
          加载中...
        </div>
      ) : (
        <div className='space-y-6'>
          {/* 警告信息 */}
          <div className='bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4'>
            <div className='flex items-start space-x-3'>
              <Info className='w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5' />
              <div className='text-sm text-purple-800 dark:text-purple-200'>
                <p className='font-medium mb-1'>使用说明：</p>
                <ul className='list-disc list-inside space-y-1 text-xs'>
                  <li>必须定义 filterAdsFromM3U8(type, m3u8Content) 函数</li>
                  <li>type 参数：当前播放源类型</li>
                  <li>m3u8Content 参数：M3U8 内容字符串</li>
                  <li>返回过滤后的 M3U8 内容</li>
                  <li>代码会在沙箱环境中执行</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 启用开关 */}
          <div className='flex items-center justify-between'>
            <div>
              <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                启用自定义广告过滤
              </label>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                开启后将在内置广告过滤基础上执行自定义过滤规则
              </p>
            </div>
            <button
              type='button'
              onClick={() =>
                setFilterSettings({
                  ...filterSettings,
                  CustomAdFilterEnabled: !filterSettings.CustomAdFilterEnabled,
                })
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                filterSettings.CustomAdFilterEnabled
                  ? 'bg-purple-600'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  filterSettings.CustomAdFilterEnabled
                    ? 'translate-x-6'
                    : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 版本号 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              规则版本号
            </label>
            <input
              type='number'
              min='1'
              value={filterSettings.CustomAdFilterVersion}
              onChange={(e) =>
                setFilterSettings({
                  ...filterSettings,
                  CustomAdFilterVersion: parseInt(e.target.value) || 1,
                })
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent'
            />
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
              版本号用于缓存管理，修改代码后请递增版本号
            </p>
          </div>

          {/* 代码编辑器 */}
          <div>
            <div className='flex items-center justify-between mb-2'>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                自定义过滤代码
              </label>
              <button
                onClick={useExample}
                className='text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300'
              >
                使用示例
              </button>
            </div>
            <div className='relative'>
              <textarea
                value={filterSettings.CustomAdFilterCode}
                onChange={(e) =>
                  setFilterSettings({
                    ...filterSettings,
                    CustomAdFilterCode: e.target.value,
                  })
                }
                placeholder='输入自定义去广告代码...'
                className='w-full h-64 px-3 py-2 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent'
                spellCheck={false}
              />
              {codeErrors.length > 0 && (
                <div className='absolute top-2 right-2'>
                  <AlertTriangle className='w-5 h-5 text-red-500' />
                </div>
              )}
            </div>

            {/* 错误提示 */}
            {codeErrors.length > 0 && (
              <div className='mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3'>
                <div className='flex items-start space-x-2'>
                  <AlertTriangle className='w-4 h-4 text-red-600 dark:text-red-400 mt-0.5' />
                  <div className='text-sm text-red-800 dark:text-red-200'>
                    {codeErrors.map((error, index) => (
                      <p key={index} className='mb-1'>
                        {error}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 字符计数 */}
            <div className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
              字符数: {filterSettings.CustomAdFilterCode.length}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <button
                onClick={handleReset}
                disabled={isLoading('saveAdFilterConfig')}
                className='px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2'
              >
                <RotateCcw className='w-4 h-4' />
                <span>重置</span>
              </button>
              {hasChanges && (
                <span className='text-sm text-orange-600 dark:text-orange-400'>
                  有未保存的更改
                </span>
              )}
            </div>
            <button
              onClick={saveConfig}
              disabled={
                isLoading('saveAdFilterConfig') ||
                codeErrors.length > 0 ||
                !hasChanges
              }
              className='px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2'
            >
              <Save className='w-4 h-4' />
              <span>
                {isLoading('saveAdFilterConfig') ? '保存中...' : '保存配置'}
              </span>
            </button>
          </div>

          {/* 预定义规则示例 */}
          <div className='bg-gray-50 dark:bg-gray-800 rounded-lg p-4'>
            <h4 className='text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center'>
              <Code className='w-4 h-4 mr-2' />
              常用过滤规则示例
            </h4>
            <div className='space-y-3 text-sm'>
              <div className='bg-white dark:bg-gray-900 rounded p-3'>
                <p className='font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  过滤短片段（可能是广告）
                </p>
                <pre className='text-xs text-gray-600 dark:text-gray-400 overflow-x-auto'>
                  {`function filterAdsFromM3U8(type, m3u8Content) {
  const lines = m3u8Content.split('\n');
  const filteredLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('#EXTINF:')) {
      const duration = parseFloat(line.split(',')[0].replace('#EXTINF:', ''));
      if (duration < 5) {
        i++; // 跳过对应的 URL 行
        continue;
      }
    }
    
    filteredLines.push(line);
  }
  
  return filteredLines.join('\n');
}`}
                </pre>
              </div>

              <div className='bg-white dark:bg-gray-900 rounded p-3'>
                <p className='font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  过滤包含特定URL的片段
                </p>
                <pre className='text-xs text-gray-600 dark:text-gray-400 overflow-x-auto'>
                  {`function filterAdsFromM3U8(type, m3u8Content) {
  const lines = m3u8Content.split('\n');
  const filteredLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 跳过包含广告域名的URL
    if (line.includes('ads.') || line.includes('advertisement.')) {
      continue;
    }
    
    filteredLines.push(line);
  }
  
  return filteredLines.join('\n');
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 导出组件
export default function CustomAdFilterConfig({
  config,
  refreshConfig,
}: {
  config?: any;
  refreshConfig?: () => void;
}) {
  return (
    <CustomAdFilterConfigContent
      config={config}
      refreshConfig={refreshConfig}
    />
  );
}
