/**
 * React 19 新特性综合优化示例
 * 展示如何在一个页面中同时使用 useOptimistic、useFormStatus、useTransition
 */

'use client';

import { useActionState, useState } from 'react';

import { useAsyncData } from '@/hooks/useAsyncData';
import { useOptimisticFavorite } from '@/hooks/useOptimisticFavorite';

import { SubmitButton } from '@/components/SubmitButton';

/**
 * 示例 1: 使用 useOptimistic 优化收藏功能
 */
function OptimisticFavoriteExample({ video }: { video: any }) {
  const { favorited, toggleFavorite, isPending } = useOptimisticFavorite(
    video.source,
    video.id,
    video.isFavorited,
  );

  return (
    <button
      onClick={toggleFavorite}
      disabled={isPending}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
        favorited
          ? 'bg-red-500 text-white'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
      } ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span>{favorited ? '❤️' : '🤍'}</span>
      <span>{favorited ? '已收藏' : '收藏'}</span>
      {isPending && <span className='text-xs'>同步中...</span>}
    </button>
  );
}

/**
 * 示例 2: 使用 useFormStatus 优化表单提交
 */
function FormStatusExample() {
  const [state, formAction] = useActionState(
    async (prevState: { error: string | null }, formData: FormData) => {
      // 模拟异步操作
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const username = formData.get('username') as string;
      if (!username) {
        return { error: '请输入用户名' };
      }

      return { error: null };
    },
    { error: null },
  );

  return (
    <div className='max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg'>
      <h2 className='text-xl font-bold mb-4'>用户设置</h2>

      <form action={formAction} className='space-y-4'>
        <div>
          <label
            htmlFor='username'
            className='block text-sm font-medium text-gray-700 mb-1'
          >
            用户名
          </label>
          <input
            id='username'
            name='username'
            type='text'
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>

        {state.error && (
          <div className='p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm'>
            {state.error}
          </div>
        )}

        <SubmitButton pendingText='保存中...'>保存设置</SubmitButton>
      </form>
    </div>
  );
}

/**
 * 示例 3: 使用 useTransition 优化数据加载
 */
function TransitionExample() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // 防抖处理
  useState(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  });

  const {
    data: searchResults,
    isPending,
    error,
  } = useAsyncData(
    async () => {
      if (!debouncedQuery) return [];

      const response = await fetch(`/api/search?q=${debouncedQuery}`);
      if (!response.ok) {
        throw new Error('搜索失败');
      }
      return response.json();
    },
    {
      onSuccess: () => {
        // 搜索完成
      },
      onError: () => {
        // 搜索失败
      },
    },
  );

  return (
    <div className='max-w-2xl mx-auto p-6'>
      <h2 className='text-xl font-bold mb-4'>搜索视频</h2>

      <div className='relative mb-4'>
        <input
          type='text'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='输入关键词搜索...'
          className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        {isPending && (
          <div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
            <svg
              className='animate-spin h-5 w-5 text-gray-400'
              xmlns='http://www.w3.org/2000/svg'
              fill='none'
              viewBox='0 0 24 24'
            >
              <circle
                className='opacity-25'
                cx='12'
                cy='12'
                r='10'
                stroke='currentColor'
                strokeWidth='4'
              />
              <path
                className='opacity-75'
                fill='currentColor'
                d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
              />
            </svg>
          </div>
        )}
      </div>

      {error && (
        <div className='p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg mb-4'>
          搜索失败: {error.message}
        </div>
      )}

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        {searchResults?.map((item: any) => (
          <div
            key={item.id}
            className='p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow'
          >
            <h3 className='font-semibold text-gray-900'>{item.title}</h3>
            <p className='text-sm text-gray-600 mt-1'>{item.description}</p>
            <OptimisticFavoriteExample video={item} />
          </div>
        ))}
      </div>

      {!isPending && searchResults?.length === 0 && debouncedQuery && (
        <div className='text-center py-8 text-gray-500'>未找到相关结果</div>
      )}
    </div>
  );
}

/**
 * 综合示例页面
 * 展示所有 React 19 新特性的协同使用
 */
export default function React19FeaturesDemo() {
  return (
    <div className='min-h-screen bg-gray-50 py-8'>
      <div className='max-w-6xl mx-auto px-4'>
        <h1 className='text-3xl font-bold text-gray-900 mb-8 text-center'>
          React 19 新特性演示
        </h1>

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
          {/* 左侧：表单示例 */}
          <div>
            <h2 className='text-xl font-semibold text-gray-800 mb-4'>
              📝 useFormStatus - 表单状态
            </h2>
            <FormStatusExample />
          </div>

          {/* 右侧：搜索示例 */}
          <div>
            <h2 className='text-xl font-semibold text-gray-800 mb-4'>
              🔍 useTransition - 数据加载
            </h2>
            <TransitionExample />
          </div>
        </div>

        {/* 底部：说明 */}
        <div className='mt-12 p-6 bg-white rounded-lg shadow-lg'>
          <h2 className='text-xl font-semibold text-gray-800 mb-4'>
            📖 特性说明
          </h2>
          <div className='space-y-4 text-gray-700'>
            <div>
              <h3 className='font-semibold text-gray-900'>
                useOptimistic - 乐观更新
              </h3>
              <p className='text-sm mt-1'>
                在搜索结果中的收藏按钮使用了乐观更新，点击后立即显示收藏状态，无需等待服务器响应。如果操作失败，状态会自动回滚。
              </p>
            </div>
            <div>
              <h3 className='font-semibold text-gray-900'>
                useFormStatus - 表单状态
              </h3>
              <p className='text-sm mt-1'>
                提交按钮自动获取表单的提交状态，显示加载动画并禁用按钮，提升用户体验。
              </p>
            </div>
            <div>
              <h3 className='font-semibold text-gray-900'>
                useTransition - 过渡优化
              </h3>
              <p className='text-sm mt-1'>
                搜索数据加载使用 transition
                标记为非紧急更新，不会阻塞用户输入，保持界面响应流畅。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
