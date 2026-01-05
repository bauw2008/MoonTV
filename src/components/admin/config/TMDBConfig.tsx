'use client';

import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAdminState } from '@/hooks/admin/useAdminState';

import { CollapsibleTab } from '@/components/admin/ui/CollapsibleTab';
import { PermissionGuard } from '@/components/PermissionGuard';

import { useNavigationConfig } from '@/contexts/NavigationConfigContext';

interface TMDBSettings {
  TMDBApiKey: string;
  TMDBLanguage: string;
  EnableTMDBActorSearch: boolean;
  EnableTMDBPosters: boolean;
}

const languageOptions = [
  { value: 'zh-CN', label: '中文（简体）' },
  { value: 'zh-TW', label: '中文（繁体）' },
  { value: 'en-US', label: '英语' },
  { value: 'ja-JP', label: '日语' },
  { value: 'ko-KR', label: '韩语' },
];

function TMDBConfigContent() {
  const { withLoading, loading, errors, clearError } = useAdminState();
  const { updateSearchFeatures } = useNavigationConfig();
  const [config, setConfig] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);

  // TMDB配置状态
  const [tmdbSettings, setTmdbSettings] = useState<TMDBSettings>({
    TMDBApiKey: '',
    TMDBLanguage: 'zh-CN',
    EnableTMDBActorSearch: false,
    EnableTMDBPosters: false,
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      await withLoading('loadTMDBConfig', async () => {
        const response = await fetch('/api/admin/config');
        const data = await response.json();
        setConfig(data.Config);

        if (data.Config?.SiteConfig) {
          setTmdbSettings({
            TMDBApiKey: data.Config.SiteConfig.TMDBApiKey || '',
            TMDBLanguage: data.Config.SiteConfig.TMDBLanguage || 'zh-CN',
            EnableTMDBActorSearch:
              data.Config.SiteConfig.EnableTMDBActorSearch || false,
            EnableTMDBPosters:
              data.Config.SiteConfig.EnableTMDBPosters || false,
          });
        }
      });
    } catch (error) {
      console.error('加载TMDB配置失败:', error);
    }
  };

  const saveConfig = async () => {
    try {
      await withLoading('saveTMDBConfig', async () => {
        // 合并现有配置和TMDB配置
        const payload = {
          ...config?.SiteConfig,
          ...tmdbSettings,
        };

        const response = await fetch('/api/admin/site', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error('保存失败');
        }

        // 使用Toast通知
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.success('TMDB配置保存成功');
          });
        }

        // 同步更新NavigationConfigContext中的TMDB演员搜索状态
        updateSearchFeatures({
          tmdbActorSearch: tmdbSettings.EnableTMDBActorSearch,
        });

        await loadConfig();
      });
    } catch (error) {
      console.error('保存TMDB配置失败:', error);
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('保存失败: ' + (error as Error).message);
        });
      }
    }
  };

  return (
    <CollapsibleTab
      title='TMDB配置'
      theme='purple'
      icon={
        <svg
          className='w-5 h-5 text-purple-500'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4'
          />
        </svg>
      }
      isExpanded={expanded}
      onToggle={() => setExpanded(!expanded)}
    >
      {loading.loadTMDBConfig ? (
        <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
          加载中...
        </div>
      ) : (
        <div className='space-y-6'>
          {/* TMDB API Key */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              TMDB API Key
            </label>
            <input
              type='password'
              value={tmdbSettings.TMDBApiKey || ''}
              onChange={(e) =>
                setTmdbSettings((prev) => ({
                  ...prev,
                  TMDBApiKey: e.target.value,
                }))
              }
              placeholder='请输入TMDB API Key'
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            />
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              请在{' '}
              <a
                href='https://www.themoviedb.org/settings/api'
                target='_blank'
                rel='noopener noreferrer'
                className='text-blue-500 hover:text-blue-600 inline-flex items-center'
              >
                TMDB 官网
                <ExternalLink size={12} className='ml-1' />
              </a>{' '}
              申请免费的 API Key
            </p>
          </div>

          {/* TMDB 语言配置 */}
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              TMDB 语言
            </label>
            <select
              value={tmdbSettings.TMDBLanguage || 'zh-CN'}
              onChange={(e) =>
                setTmdbSettings((prev) => ({
                  ...prev,
                  TMDBLanguage: e.target.value,
                }))
              }
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent'
            >
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
              选择TMDB数据返回的语言，影响搜索结果和显示内容
            </p>
          </div>

          {/* 功能开关 */}
          <div className='space-y-4'>
            {/* 启用TMDB演员搜索 */}
            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  启用 TMDB 演员搜索
                </label>
                <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                  启用后用户可以在搜索页面按演员名字搜索相关影视作品
                </p>
              </div>
              <button
                type='button'
                onClick={() =>
                  setTmdbSettings((prev) => ({
                    ...prev,
                    EnableTMDBActorSearch: !prev.EnableTMDBActorSearch,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  tmdbSettings.EnableTMDBActorSearch
                    ? 'bg-green-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    tmdbSettings.EnableTMDBActorSearch
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 启用TMDB横屏海报 */}
            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  启用 TMDB 横屏海报
                </label>
                <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                  启用后首页轮播将使用TMDB横屏海报，提供更佳的视觉效果
                </p>
              </div>
              <button
                type='button'
                onClick={() =>
                  setTmdbSettings((prev) => ({
                    ...prev,
                    EnableTMDBPosters: !prev.EnableTMDBPosters,
                  }))
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  tmdbSettings.EnableTMDBPosters
                    ? 'bg-green-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    tmdbSettings.EnableTMDBPosters
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 保存按钮 */}
          <div className='flex justify-end'>
            <button
              onClick={saveConfig}
              disabled={loading.saveTMDBConfig}
              className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50'
            >
              {loading.saveTMDBConfig ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>
      )}
    </CollapsibleTab>
  );
}

// 导出组件
export function TMDBConfig() {
  return (
    <PermissionGuard permission='canManageConfig'>
      <TMDBConfigContent />
    </PermissionGuard>
  );
}
