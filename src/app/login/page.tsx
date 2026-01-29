'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

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
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string>('');
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(true);

  const { siteName } = useSite();

  const [state, formAction, isPending] = useActionState(loginAction, {
    error: null,
  });

  // 只在客户端生成 URL，避免水合错误
  useEffect(() => {
    const url = `https://edgeone-picture.edgeone.app/api/random?t=${Date.now()}`;
    const img = new Image();

    img.onload = () => {
      // 图片加载完成后，立即设置背景URL和关闭加载动画
      setBackgroundImageUrl(url);
      setIsBackgroundLoading(false);
    };

    img.onerror = () => {
      // 图片加载失败也设置URL，让用户能看到页面
      setBackgroundImageUrl(url);
      setIsBackgroundLoading(false);
    };

    img.src = url;
  }, []);

  // 点击或触摸后显示登录窗口
  useEffect(() => {
    const handleInteraction = () => {
      if (!showLoginForm) {
        setShowLoginForm(true);
        setTimeout(() => setIsAnimating(true), 50);
      }
    };

    // 只监听一次用户交互
    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('touchstart', handleInteraction, { once: true });

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, [showLoginForm]);

  // 登录成功后跳转 - 检查实际的认证状态
  useEffect(() => {
    const checkAuthAndRedirect = () => {
      const auth = getAuthInfoFromBrowserCookie();
      // 只有在已登录且没有错误时才跳转
      if (auth && !state.error && !isPending) {
        const redirect = searchParams.get('redirect') || '/';
        router.replace(redirect);
      }
    };
    checkAuthAndRedirect();
  }, [state.error, isPending, router, searchParams]);

  return (
    <div className='relative min-h-screen flex items-center justify-center px-4 overflow-hidden'>
      {/* 🔥 随机背景图片 - 独立层 */}
      {backgroundImageUrl && <RandomBackground imageUrl={backgroundImageUrl} />}

      {/* 🔥 半透明遮罩 - 独立层 */}
      <div className='absolute inset-0 bg-black/20 dark:bg-black/40 pointer-events-none' />

      {/* 🔥 主题切换按钮 */}
      <div className='absolute top-4 right-4 z-20 p-2'>
        <ThemeToggle />
      </div>

      {/* 🔥 加载动画 */}
      {isBackgroundLoading && (
        <div className='relative z-10 flex flex-col items-center justify-center'>
          {/* 双层旋转动画 */}
          <div className='relative w-20 h-20 flex items-center justify-center'>
            {/* 外圈旋转 */}
            <div
              className='absolute inset-0 border-4 border-white/10 border-t-green-500 border-r-green-400 rounded-full animate-spin'
              style={{ animationDuration: '2s' }}
            />
            {/* 内圈反向旋转 */}
            <div
              className='absolute inset-2 border-3 border-white/10 border-b-green-500 border-l-green-400 rounded-full animate-spin'
              style={{
                animationDirection: 'reverse',
                animationDuration: '1.5s',
              }}
            />
            {/* 中心圆点 */}
            <div
              className='w-4 h-4 bg-green-500 rounded-full animate-pulse'
              style={{ animationDuration: '1.5s' }}
            />
          </div>
        </div>
      )}

      {/* 🔥 登录表单 */}
      {!isBackgroundLoading && (
        <div
          className={`relative z-10 w-full max-w-xs rounded-2xl bg-white/10 dark:bg-gray-900/60 backdrop-blur-xl shadow-2xl p-6 border border-white/10 dark:border-gray-700/50 mx-auto transition-all duration-300 transform ${
            showLoginForm
              ? isAnimating
                ? 'scale-100 opacity-100 translate-y-0'
                : 'scale-90 opacity-0 translate-y-4'
              : 'scale-90 opacity-0 translate-y-4'
          }`}
        >
          <h1 className='text-white dark:text-gray-100 tracking-tight text-center text-2xl font-extrabold mb-6 bg-clip-text drop-shadow-sm'>
            {siteName}
          </h1>
          <form action={formAction} className='space-y-6'>
            {state.error && (
              <div className='rounded-lg bg-red-500/20 p-4 text-sm text-red-200 backdrop-blur-sm'>
                {state.error}
              </div>
            )}

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
          </form>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return <LoginPageClient />;
}
