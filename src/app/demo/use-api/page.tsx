/**
 * React 19 use() API 演示页面
 *
 * use() API 是 React 19 的新特性，用于在渲染期间读取 Promise 或 Context
 * 它简化了异步数据的处理，无需使用 useEffect + useState
 */

import { Suspense } from 'react';
import { use } from 'react';

import { getConfigPromise, useCachedConfig } from '@/lib/use-config';

/**
 * 1. 基础 use() API 使用示例
 * 直接在 Server Component 中使用 use() 读取 Promise
 */
function BasicUseExample() {
  const config = use(getConfigPromise()) as any;

  return (
    <div className='bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md'>
      <h3 className='text-xl font-bold mb-4 text-gray-800 dark:text-gray-200'>
        基础 use() API 示例
      </h3>
      <div className='space-y-2'>
        <p className='text-gray-600 dark:text-gray-400'>
          <span className='font-semibold'>站点名称:</span>{' '}
          {config?.SiteConfig?.SiteName || 'Vidora'}
        </p>
        <p className='text-gray-600 dark:text-gray-400'>
          <span className='font-semibold'>公告:</span>{' '}
          {config?.SiteConfig?.Announcement || '无'}
        </p>
        <p className='text-sm text-gray-500 dark:text-gray-500 mt-2'>
          💡 use() 会自动处理 Promise 的加载状态，无需手动管理 loading 状态
        </p>
      </div>
    </div>
  );
}

/**
 * 2. 缓存的 use() API 使用示例
 * 使用缓存的 Promise，避免重复请求
 */
function CachedUseExample() {
  const config = use(useCachedConfig()) as any;

  return (
    <div className='bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md'>
      <h3 className='text-xl font-bold mb-4 text-gray-800 dark:text-gray-200'>
        缓存的 use() API 示例
      </h3>
      <div className='space-y-2'>
        <p className='text-gray-600 dark:text-gray-400'>
          <span className='font-semibold'>站点名称:</span>{' '}
          {config?.SiteConfig?.SiteName || 'Vidora'}
        </p>
        <p className='text-gray-600 dark:text-gray-400'>
          <span className='font-semibold'>豆瓣代理类型:</span>{' '}
          {config?.SiteConfig?.DoubanProxyType || 'direct'}
        </p>
        <p className='text-sm text-gray-500 dark:text-gray-500 mt-2'>
          💡 使用缓存的 Promise，多次调用 use() 只会执行一次请求
        </p>
      </div>
    </div>
  );
}

/**
 * 3. 错误处理示例
 * use() 会自动处理 Promise 的错误，可以使用 Error Boundary 捕获
 */
function ErrorHandlingExample() {
  try {
    const config = use(getConfigPromise()) as any;
    return (
      <div className='bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md'>
        <h3 className='text-xl font-bold mb-4 text-gray-800 dark:text-gray-200'>
          错误处理示例
        </h3>
        <div className='space-y-2'>
          <p className='text-gray-600 dark:text-gray-400'>
            <span className='font-semibold'>配置加载成功</span>
          </p>
          <p className='text-sm text-gray-500 dark:text-gray-500 mt-2'>
            💡 如果 Promise reject，use() 会抛出错误，可以使用 Error
            Boundary 捕获
          </p>
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className='bg-red-50 dark:bg-red-900/20 rounded-lg p-6 shadow-md border border-red-200 dark:border-red-800'>
        <h3 className='text-xl font-bold mb-4 text-red-800 dark:text-red-200'>
          配置加载失败
        </h3>
        <p className='text-red-600 dark:text-red-400'>
          {error instanceof Error ? error.message : '未知错误'}
        </p>
      </div>
    );
  }
}

/**
 * 4. 与传统方式的对比
 */
function ComparisonExample() {
  return (
    <div className='bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md'>
      <h3 className='text-xl font-bold mb-4 text-gray-800 dark:text-gray-200'>
        传统方式 vs use() API
      </h3>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div className='bg-gray-50 dark:bg-gray-700 rounded p-4'>
          <h4 className='font-semibold mb-2 text-gray-800 dark:text-gray-200'>
            传统方式 (useEffect)
          </h4>
          <pre className='text-xs text-gray-600 dark:text-gray-400 overflow-x-auto'>
            {`const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchData().then(result => {
    setData(result);
    setLoading(false);
  });
}, []);

if (loading) return <Loading />;
return <div>{data}</div>;`}
          </pre>
        </div>
        <div className='bg-blue-50 dark:bg-blue-900/20 rounded p-4'>
          <h4 className='font-semibold mb-2 text-gray-800 dark:text-gray-200'>
            React 19 use() API
          </h4>
          <pre className='text-xs text-gray-600 dark:text-gray-400 overflow-x-auto'>
            {`const data = use(fetchData());

// 无需手动管理 loading 状态
// React 会自动处理 Suspense 边界
return <div>{data}</div>;`}
          </pre>
        </div>
      </div>
    </div>
  );
}

/**
 * 5. use() API 的限制和注意事项
 */
function LimitationsExample() {
  return (
    <div className='bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md'>
      <h3 className='text-xl font-bold mb-4 text-gray-800 dark:text-gray-200'>
        use() API 的限制和注意事项
      </h3>
      <ul className='list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400'>
        <li>
          <span className='font-semibold'>只能在 Server Components 中使用</span>
          - 或者在 use() 调用期间渲染的组件中使用
        </li>
        <li>
          <span className='font-semibold'>不能在事件处理函数中使用</span>
          - use() 只能在渲染期间调用
        </li>
        <li>
          <span className='font-semibold'>不能在 useEffect 中使用</span>
          - use() 不是 hook，不能在函数组件外使用
        </li>
        <li>
          <span className='font-semibold'>需要配合 Suspense 使用</span>
          - 用于显示加载状态
        </li>
        <li>
          <span className='font-semibold'>Promise 会自动去重</span>
          - 多次使用同一个 Promise 只会执行一次
        </li>
      </ul>
    </div>
  );
}

/**
 * 主页面组件
 */
export default function UseApiDemoPage() {
  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4'>
      <div className='max-w-4xl mx-auto'>
        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2'>
            React 19 use() API 演示
          </h1>
          <p className='text-gray-600 dark:text-gray-400'>
            use() API 是 React 19 的新特性，用于在渲染期间读取 Promise
            或 Context
          </p>
        </div>

        <div className='space-y-6'>
          <Suspense
            fallback={
              <div className='bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md'>
                <div className='flex items-center justify-center'>
                  <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
                  <span className='ml-3 text-gray-600 dark:text-gray-400'>
                    加载配置中...
                  </span>
                </div>
              </div>
            }
          >
            <BasicUseExample />
            <CachedUseExample />
            <ErrorHandlingExample />
          </Suspense>

          <ComparisonExample />
          <LimitationsExample />

          <div className='bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 shadow-md border border-blue-200 dark:border-blue-800'>
            <h3 className='text-xl font-bold mb-4 text-blue-800 dark:text-blue-200'>
              实际应用建议
            </h3>
            <ul className='list-disc list-inside space-y-2 text-blue-700 dark:text-blue-300'>
              <li>
                <span className='font-semibold'>在 Server Components 中使用</span>
                - 适合读取数据库、API 等异步数据
              </li>
              <li>
                <span className='font-semibold'>配合 Suspense 使用</span>
                - 提供更好的加载体验
              </li>
              <li>
                <span className='font-semibold'>缓存 Promise</span>
                - 避免重复请求，提升性能
              </li>
              <li>
                <span className='font-semibold'>错误处理</span>
                - 使用 Error Boundary 捕获 Promise 错误
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}