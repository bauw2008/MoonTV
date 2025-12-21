'use client';

import { useEffect, useState } from 'react';

import { AdminConfig } from '@/lib/admin.types';

interface YellowFilterConfigProps {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}

const YellowFilterConfig = ({
  config,
  refreshConfig,
}: YellowFilterConfigProps) => {
  const [yellowWords, setYellowWords] = useState<string[]>([]);
  const [newWord, setNewWord] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddWord = () => {
    if (!newWord.trim()) {
      return;
    }

    const trimmedWord = newWord.trim();
    if (yellowWords.includes(trimmedWord)) {
      showMessage('error', '该过滤词已存在');
      return;
    }

    const updatedWords = [...yellowWords, trimmedWord];
    setYellowWords(updatedWords);
    setNewWord('');

    // 自动保存
    saveYellowWords(updatedWords);
  };

  const handleRemoveWord = (word: string) => {
    const updatedWords = yellowWords.filter((w) => w !== word);
    setYellowWords(updatedWords);

    // 自动保存
    saveYellowWords(updatedWords);
  };

  // 从服务器获取当前过滤词
  const fetchYellowWords = async () => {
    try {
      const response = await fetch('/api/yellow-words');
      if (response.ok) {
        const data = await response.json();
        setYellowWords(data.yellowWords || []);
      } else {
        console.error('获取过滤词失败');
      }
    } catch (error) {
      console.error('获取过滤词失败:', error);
    }
  };

  // 保存过滤词到文件
  const saveYellowWords = async (words: string[]) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/yellow-words', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          yellowWords: words,
        }),
      });

      if (response.ok) {
        showMessage('success', '过滤词已保存');
        // 重新获取过滤词确保同步
        await fetchYellowWords();
      } else {
        const data = await response.json();
        showMessage('error', data.error || '保存失败');
      }
    } catch (error) {
      console.error('保存过滤词失败:', error);
      showMessage('error', '保存失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 组件挂载时获取过滤词
  useEffect(() => {
    fetchYellowWords();
  }, []);

  // 切换18+过滤器开关
  const handleToggleYellowFilter = async () => {
    if (!config) {
      return;
    }

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
            DisableYellowFilter: !config.SiteConfig?.DisableYellowFilter,
          },
        }),
      });

      if (response.ok) {
        showMessage(
          'success',
          `已${
            config.SiteConfig?.DisableYellowFilter ? '启用' : '禁用'
          }18+过滤器`,
        );
        await refreshConfig();
      } else {
        const data = await response.json();
        showMessage('error', data.error || '操作失败');
      }
    } catch (error) {
      console.error('切换过滤器失败:', error);
      showMessage('error', '操作失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetToDefault = async () => {
    // 从服务器获取默认过滤词
    try {
      const response = await fetch('/api/yellow-words?default=true');
      if (response.ok) {
        const data = await response.json();
        setYellowWords(data.yellowWords || []);
        await saveYellowWords(data.yellowWords || []);
      } else {
        showMessage('error', '获取默认过滤词失败');
      }
    } catch (error) {
      console.error('获取默认过滤词失败:', error);
      showMessage('error', '获取默认过滤词失败');
    }
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

      {/* 18+过滤器开关 */}
      <div className='mt-3 p-4 bg-transparent dark:bg-transparent rounded-lg border border-blue-200 dark:border-blue-800'>
        <div className='flex items-center justify-between'>
          <div>
            <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100'>
              🚫 18+ 过滤器
            </h3>
            <p className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
              {config.SiteConfig?.DisableYellowFilter
                ? '当前已禁用18+内容过滤，所有内容将不会被过滤'
                : '当前已启用18+内容过滤，包含过滤词的内容将被隐藏'}
            </p>
          </div>
          <button
            type='button'
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
              !config.SiteConfig?.DisableYellowFilter
                ? 'bg-green-600 dark:bg-green-600'
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
            role='switch'
            aria-checked={!config.SiteConfig?.DisableYellowFilter}
            onClick={handleToggleYellowFilter}
            disabled={isLoading}
          >
            <span
              aria-hidden='true'
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
                !config.SiteConfig?.DisableYellowFilter
                  ? 'translate-x-6'
                  : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 添加过滤词 */}
      <div className='mt-3 p-4 bg-transparent dark:bg-transparent rounded-lg border border-blue-200 dark:border-blue-800'>
        <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 mb-4'>
          添加过滤词
        </h3>
        <div className='flex space-x-3'>
          <input
            type='text'
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            placeholder='输入要过滤的关键词'
            className='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAddWord();
              }
            }}
          />
          <button
            onClick={handleAddWord}
            disabled={!newWord.trim() || isLoading}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              !newWord.trim() || isLoading
                ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed text-white'
                : 'bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-white'
            }`}
          >
            添加
          </button>
        </div>
      </div>

      {/* 过滤词列表 */}
      <div className='mt-3 p-4 bg-transparent dark:bg-transparent rounded-lg border border-blue-200 dark:border-blue-800'>
        <div className='flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700'>
          <h3 className='text-lg font-medium text-gray-900 dark:text-gray-100'>
            过滤词列表 ({yellowWords.length})
          </h3>
          <button
            onClick={handleResetToDefault}
            disabled={isLoading}
            className='px-4 py-2 text-sm font-medium bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-600 dark:hover:bg-yellow-700 text-white rounded-lg transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed'
          >
            重置为默认
          </button>
        </div>

        {yellowWords.length === 0 ? (
          <div className='p-8 text-center text-gray-500 dark:text-gray-400'>
            暂无过滤词
          </div>
        ) : (
          <div className='max-h-96 overflow-y-auto'>
            <div className='grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 p-6'>
              {yellowWords.map((word, index) => (
                <div
                  key={index}
                  className='flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600'
                >
                  <span className='text-sm text-gray-900 dark:text-gray-100'>
                    {word}
                  </span>
                  <button
                    onClick={() => handleRemoveWord(word)}
                    disabled={isLoading}
                    className='text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors disabled:text-gray-400 dark:disabled:text-gray-500'
                  >
                    <svg
                      className='w-4 h-4'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M6 18L18 6M6 6l12 12'
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 使用说明 */}
      <div className='mt-3 p-4 bg-transparent dark:bg-transparent rounded-lg border border-blue-200 dark:border-blue-800'>
        <h4 className='text-sm font-medium text-blue-800 dark:text-blue-300 mb-2'>
          使用说明
        </h4>
        <ul className='text-sm text-blue-700 dark:text-blue-400 space-y-1'>
          <li>• 使用总开关可以启用或禁用整个18+过滤功能</li>
          <li>• 添加的关键词会在搜索结果中自动过滤</li>
          <li>• 关键词不区分大小写</li>
          <li>• 删除关键词后会自动保存</li>
          <li>• "重置为默认" 会恢复默认的过滤词列表</li>
        </ul>
      </div>
    </div>
  );
};

export default YellowFilterConfig;
