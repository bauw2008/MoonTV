'use client';

import { useState } from 'react';

import { AdminConfig } from '@/lib/admin.types';

interface SiteConfigComponentProps {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}

const SiteConfigComponent = ({ config, refreshConfig }: SiteConfigComponentProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleUpdateConfig = async (updates: Partial<AdminConfig['SiteConfig']>) => {
    if (!config) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...config,
          SiteConfig: {
            ...config.SiteConfig,
            ...updates,
          },
        }),
      });

      if (response.ok) {
        showMessage('success', '配置已保存');
        await refreshConfig();
      } else {
        const data = await response.json();
        showMessage('error', data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      showMessage('error', '保存失败');
    } finally {
      setIsLoading(false);
    }
  };

  const buttonStyles = {
    primary:
      'px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg transition-colors',
    success:
      'px-3 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-white rounded-lg transition-colors',
    disabled:
      'px-3 py-1.5 text-sm font-medium bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white rounded-lg transition-colors',
  };

  if (!config) {
    return (
      <div className='text-center text-gray-500 dark:text-gray-400'>
        加载中...
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 消息提示 */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 站点名称 */}
      <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'>
        <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-4'>
          站点名称
        </h3>
        <div className='flex flex-col sm:flex-row gap-3 items-start sm:items-center'>
          <input
            type='text'
            value={config.SiteConfig.SiteName}
            onChange={(e) => handleUpdateConfig({ SiteName: e.target.value })}
            className='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='输入站点名称'
          />
          <button
            onClick={() => handleUpdateConfig({ SiteName: config.SiteConfig.SiteName })}
            disabled={isLoading}
            className={`px-4 py-2 whitespace-nowrap ${
              isLoading ? buttonStyles.disabled : buttonStyles.success
            }`}
          >
            {isLoading ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {/* 站点公告 */}
      <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'>
        <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-4'>
          站点公告
        </h3>
        <div className='flex flex-col gap-3'>
          <textarea
            value={config.SiteConfig.Announcement}
            onChange={(e) => handleUpdateConfig({ Announcement: e.target.value })}
            rows={4}
            className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder='输入站点公告'
          />
          <div className='flex justify-end'>
            <button
              onClick={() => handleUpdateConfig({ Announcement: config.SiteConfig.Announcement })}
              disabled={isLoading}
              className={`px-4 py-2 ${
                isLoading ? buttonStyles.disabled : buttonStyles.success
              }`}
            >
              {isLoading ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>

      {/* 搜索配置 */}
      <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'>
        <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-4'>
          搜索配置
        </h3>
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <div className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                搜索最大页数
              </div>
              <div className='text-sm text-gray-600 dark:text-gray-400'>
                控制搜索结果的最大页数限制
              </div>
            </div>
            <input
              type='number'
              min='1'
              max='50'
              value={config.SiteConfig.SearchDownstreamMaxPage}
              onChange={(e) => handleUpdateConfig({ SearchDownstreamMaxPage: parseInt(e.target.value) || 5 })}
              className='w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            />
          </div>

          <div className='flex items-center justify-between'>
            <div>
              <div className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                动态搜索
              </div>
              <div className='text-sm text-gray-600 dark:text-gray-400'>
                启用实时搜索建议功能
              </div>
            </div>
            <button
              type='button'
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                config.SiteConfig.FluidSearch
                  ? 'bg-green-600 dark:bg-green-600'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
              role='switch'
              aria-checked={config.SiteConfig.FluidSearch}
              onClick={() => handleUpdateConfig({ FluidSearch: !config.SiteConfig.FluidSearch })}
              disabled={isLoading}
            >
              <span
                aria-hidden='true'
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
                  config.SiteConfig.FluidSearch ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 缓存配置 */}
      <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'>
        <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-4'>
          缓存配置
        </h3>
        <div className='flex items-center justify-between'>
          <div>
            <div className='text-sm font-medium text-gray-900 dark:text-gray-100'>
              接口缓存时间（秒）
            </div>
            <div className='text-sm text-gray-600 dark:text-gray-400'>
              控制接口数据的缓存时间
            </div>
          </div>
          <input
            type='number'
            min='0'
            max='86400'
            value={config.SiteConfig.SiteInterfaceCacheTime}
            onChange={(e) => handleUpdateConfig({ SiteInterfaceCacheTime: parseInt(e.target.value) || 7200 })}
            className='w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          />
        </div>
      </div>

      {/* 豆瓣配置 */}
      <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'>
        <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-4'>
          豆瓣配置
        </h3>
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              豆瓣代理类型
            </label>
            <select
              value={config.SiteConfig.DoubanProxyType}
              onChange={(e) => handleUpdateConfig({ DoubanProxyType: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            >
              <option value='direct'>直连</option>
              <option value='proxy'>代理</option>
            </select>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              豆瓣代理地址
            </label>
            <input
              type='text'
              value={config.SiteConfig.DoubanProxy}
              onChange={(e) => handleUpdateConfig({ DoubanProxy: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder='输入豆瓣代理地址'
            />
          </div>
        </div>
      </div>

      {/* TMDB配置 */}
      <div className='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'>
        <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-4'>
          TMDB配置
        </h3>
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              TMDB API Key
            </label>
            <input
              type='password'
              value={config.SiteConfig.TMDBApiKey || ''}
              onChange={(e) => handleUpdateConfig({ TMDBApiKey: e.target.value })}
              className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              placeholder='输入TMDB API Key'
            />
          </div>
          <div className='flex items-center justify-between'>
            <div>
              <div className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                启用演员搜索
              </div>
              <div className='text-sm text-gray-600 dark:text-gray-400'>
                启用基于TMDB的演员搜索功能
              </div>
            </div>
            <button
              type='button'
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                config.SiteConfig.EnableTMDBActorSearch
                  ? 'bg-green-600 dark:bg-green-600'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
              role='switch'
              aria-checked={config.SiteConfig.EnableTMDBActorSearch}
              onClick={() => handleUpdateConfig({ EnableTMDBActorSearch: !config.SiteConfig.EnableTMDBActorSearch })}
              disabled={isLoading}
            >
              <span
                aria-hidden='true'
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
                  config.SiteConfig.EnableTMDBActorSearch ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SiteConfigComponent;