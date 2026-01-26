'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useActionState, useEffect, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import { RandomBackground } from '@/components/RandomBackground';
import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

import { loginAction } from '@/app/auth/actions';

function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  // 根据是否配置了 USERNAME 环境变量决定是否需要用户名
  const shouldAskUsername = !!process.env.USERNAME;

  const { siteName } = useSite();

  const [state, formAction, isPending] = useActionState(loginAction, {
    error: null,
  });

  // 登录成功后跳转 - 检查实际的认证状态
  useEffect(() => {
    const checkAuthAndRedirect = () => {
      const auth = getAuthInfoFromBrowserCookie();
      // 只有在已登录且没有错误时才跳转
      if (auth && !state.error && !isPending) {
        // 如果是管理员或站长，设置通知标记
        if (auth.role === 'admin' || auth.role === 'owner') {
          localStorage.setItem('last-pending-update', Date.now().toString());
          window.dispatchEvent(new CustomEvent('pending-users-update'));
        }
        const redirect = searchParams.get('redirect') || '/';
        router.replace(redirect);
      }
    };
    checkAuthAndRedirect();
  }, [state.error, isPending, router, searchParams]);

  return (
    <div className='relative min-h-screen flex items-center justify-center px-4 overflow-hidden'>
      {/* 随机背景图片 */}
      <RandomBackground>
        {/* 半透明遮罩 */}
        <div className='absolute inset-0 bg-black/20 dark:bg-black/40' />
      </RandomBackground>

      <div className='absolute top-4 right-4 z-20'>
        <ThemeToggle />
      </div>
      <div className='relative z-10 w-full max-w-xs rounded-2xl bg-white/10 dark:bg-gray-900/60 backdrop-blur-xl shadow-2xl p-6 border border-white/10 dark:border-gray-700/50 mx-auto'>
        <h1 className='text-white dark:text-gray-100 tracking-tight text-center text-2xl font-extrabold mb-6 bg-clip-text drop-shadow-sm'>
          {siteName}
        </h1>
        <form action={formAction} className='space-y-6'>
          {state.error && (
            <div className='rounded-lg bg-red-500/20 p-4 text-sm text-red-200 backdrop-blur-sm'>
              {state.error}
            </div>
          )}

          {shouldAskUsername && (
            <div>
              <label
                htmlFor='username'
                className='block text-sm font-medium text-white'
              >
                用户名
              </label>
              <input
                id='username'
                name='username'
                type='text'
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className='mt-1 block w-full rounded-lg border-0 bg-white/10 px-4 py-3 text-white placeholder-white/50 backdrop-blur-sm focus:bg-white/20 focus:ring-2 focus:ring-white/50'
                placeholder='请输入用户名'
              />
            </div>
          )}

          <div>
            <label
              htmlFor='password'
              className='block text-sm font-medium text-white'
            >
              密码
            </label>
            <input
              id='password'
              name='password'
              type='password'
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className='mt-1 block w-full rounded-lg border-0 bg-white/10 px-4 py-3 text-white placeholder-white/50 backdrop-blur-sm focus:bg-white/20 focus:ring-2 focus:ring-white/50'
              placeholder='请输入密码'
            />
          </div>

          {state.error && (
            <p className='text-sm text-red-300 dark:text-red-400 bg-red-900/30 dark:bg-red-900/50 rounded-lg py-2 px-3 text-center'>
              {state.error}
            </p>
          )}

          <button
            type='submit'
            className='w-full rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:from-green-500 hover:to-emerald-500 hover:shadow-xl'
          >
            登录
          </button>

          {shouldAskUsername && (
            <div className='text-center'>
              <span className='text-gray-700 dark:text-gray-300 text-sm'>
                还没有账户？
              </span>
              <button
                type='button'
                onClick={() => router.push('/register')}
                className='ml-2 text-green-600 dark:text-green-400 text-sm font-medium hover:underline'
              >
                立即注册
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPageClient />
    </Suspense>
  );
}
