'use client';

import { AlertCircle, CheckCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { CURRENT_VERSION } from '@/lib/version';
import { checkForUpdates, UpdateStatus } from '@/lib/version_check';

import { useAuth } from '@/components/auth/AuthProvider';
import { RandomBackground } from '@/components/RandomBackground';
import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

// 版本显示组件
function VersionDisplay() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const status = await checkForUpdates();
        setUpdateStatus(status);
      } catch (_) {
        // do nothing
      } finally {
        setIsChecking(false);
      }
    };

    checkUpdate();
  }, []);

  return (
    <div className='absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'>
      <span className='font-mono'>v{CURRENT_VERSION}</span>
      {!isChecking && updateStatus !== UpdateStatus.FETCH_FAILED && (
        <div
          className={`flex items-center gap-1.5 ${
            updateStatus === UpdateStatus.HAS_UPDATE
              ? 'text-yellow-600 dark:text-yellow-400'
              : updateStatus === UpdateStatus.NO_UPDATE
                ? 'text-green-600 dark:text-green-400'
                : ''
          }`}
        >
          {updateStatus === UpdateStatus.HAS_UPDATE && (
            <>
              <AlertCircle className='w-3.5 h-3.5' />
              <span className='font-semibold text-xs'>有新版本</span>
            </>
          )}
          {updateStatus === UpdateStatus.NO_UPDATE && (
            <>
              <CheckCircle className='w-3.5 h-3.5' />
              <span className='font-semibold text-xs'>已是最新</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, state } = useAuth();
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shouldAskUsername, setShouldAskUsername] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { siteName } = useSite();

  // 两种模式都支持独立用户名
  useEffect(() => {
    // 不设置默认用户名，让用户自己输入
    setUsername('');
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!password || (shouldAskUsername && !username)) {
      return;
    }

    // 防止重复提交
    if (isSubmitting) {
      return;
    }

    setLoading(true);
    setIsSubmitting(true);

    const loginUsername = shouldAskUsername ? username : 'user'; // localStorage 模式固定使用 user

    try {
      // 调用服务端登录API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 包含Cookie
        body: JSON.stringify({
          username: loginUsername,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || '用户名或密码错误');
        return;
      }

      console.log('服务端登录成功', data);

      // 使用客户端认证状态管理
      if (data.user) {
        // 存储认证信息到localStorage
        const authData = {
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        };
        localStorage.setItem('vidora_auth', JSON.stringify(authData));

        // 登录成功，跳转到目标页面
        const redirectUrl = searchParams.get('redirect');
        let targetUrl = '/';

        if (redirectUrl) {
          // 如果redirectUrl是完整URL，提取路径部分
          if (
            redirectUrl.startsWith('http://') ||
            redirectUrl.startsWith('https://')
          ) {
            try {
              const url = new URL(redirectUrl);
              targetUrl = url.pathname + url.search;
            } catch (error) {
              // 如果URL解析失败，直接使用路径部分
              targetUrl = redirectUrl.replace(/^https?:\/\/[^\/]+/, '') || '/';
            }
          } else {
            // 如果不是完整URL，直接使用
            targetUrl = redirectUrl;
          }
        }

        console.log('登录成功，准备跳转到:', targetUrl);

        // 跳转到目标页面
        window.location.href = targetUrl;
      } else {
        setError('登录成功但认证信息不完整');
      }
    } catch (error) {
      console.error('登录请求失败:', error);
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

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
        <form onSubmit={handleSubmit} className='space-y-6'>
          {shouldAskUsername && (
            <div>
              <label htmlFor='username' className='sr-only'>
                用户名
              </label>
              <input
                id='username'
                type='text'
                autoComplete='username'
                className='block w-full rounded-lg border-0 py-3 px-4 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-white/60 dark:ring-gray-600/60 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:outline-none sm:text-sm bg-white/90 dark:bg-gray-800/90 backdrop-blur'
                placeholder='输入用户名'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          )}

          <div>
            <label htmlFor='password' className='sr-only'>
              密码
            </label>
            <input
              id='password'
              type='password'
              autoComplete='current-password'
              className='block w-full rounded-lg border-0 py-3 px-4 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-white/60 dark:ring-gray-600/60 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:outline-none sm:text-sm bg-white/90 dark:bg-gray-800/90 backdrop-blur'
              placeholder='输入访问密码 (至少3位)'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className='text-sm text-red-300 dark:text-red-400 bg-red-900/30 dark:bg-red-900/50 rounded-lg py-2 px-3 text-center'>
              {error}
            </p>
          )}

          <button
            type='submit'
            disabled={!password || loading || (shouldAskUsername && !username)}
            className='w-full rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:from-green-500 hover:to-emerald-500 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50'
          >
            <span className='flex items-center justify-center'>
              {loading ? (
                <>
                  <svg
                    className='animate-spin h-5 w-5 text-white mr-2'
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
                    ></circle>
                    <path
                      className='opacity-75'
                      fill='currentColor'
                      d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                    ></path>
                  </svg>
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </span>
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

      {/* 版本信息显示 */}
      <VersionDisplay />
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
