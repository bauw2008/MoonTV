/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { AlertCircle, CheckCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { CURRENT_VERSION } from '@/lib/version';
import { checkForUpdates, UpdateStatus } from '@/lib/version_check';

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
    <div className='absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 transition-colors cursor-pointer'>
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

function RegisterPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shouldShowRegister, setShouldShowRegister] = useState(false);
  const [registrationDisabled, setRegistrationDisabled] = useState(false);
  const [disabledReason, setDisabledReason] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);

  const { siteName } = useSite();

  // 检查注册是否可用
  useEffect(() => {
    const checkRegistrationAvailable = async () => {
      try {
        // 用空数据检测，这样不会创建用户但能得到正确的错误信息
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: '',
            password: '',
            confirmPassword: '',
          }),
        });

        const data = await res.json();

        // 如果是localStorage模式，跳转登录
        if (data.error === 'localStorage 模式不支持用户注册') {
          router.replace('/login');
          return;
        }

        // 如果是管理员关闭了注册
        if (data.error === '管理员已关闭用户注册功能') {
          setRegistrationDisabled(true);
          setDisabledReason('管理员已关闭用户注册功能');
          setShouldShowRegister(true);
          return;
        }

        // 其他情况显示注册表单（包括用户名已存在等正常的验证错误）
        setShouldShowRegister(true);
      } catch (error) {
        // 网络错误也显示注册页面
        setShouldShowRegister(true);
      }
    };

    checkRegistrationAvailable();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!username || !password || !confirmPassword) {
      setError('请填写完整信息');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, confirmPassword, reason }),
      });

      if (res.ok) {
        const data = await res.json();
        // 显示成功消息，稍等一下再跳转
        setError(null);
        if (data?.pending) {
          setPending(true);
          setSuccess('已提交注册申请，等待管理员审核');
        } else {
          setSuccess('注册成功！正在跳转...');
          // 给用户一个成功提示，然后再跳转
          setTimeout(() => {
            const redirect = searchParams.get('redirect') || '/';
            router.replace(redirect);
          }, 1500); // 1.5秒后跳转，让用户看到成功消息
        }
      } else {
        const data = await res.json();
        setError(data.error ?? '注册失败');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (!shouldShowRegister) {
    return <div>Loading...</div>;
  }

  // 如果注册被禁用，显示提示页面
  if (registrationDisabled) {
    return (
      <div className='relative min-h-screen flex items-center justify-center px-4 overflow-hidden'>
        {/* 随机背景图片 */}
        <RandomBackground>
          {/* 半透明遮罩 */}
          <div className='absolute inset-0 bg-black/20' />
        </RandomBackground>

        <div className='absolute top-4 right-4 z-20'>
          <ThemeToggle />
        </div>
        <div className='relative z-10 w-full max-w-sm rounded-2xl bg-white/10 backdrop-blur-xl shadow-2xl p-8 border border-white/20'>
          <h1 className='text-white tracking-tight text-center text-3xl font-extrabold mb-2 bg-clip-text drop-shadow-sm'>
            {siteName}
          </h1>
          <div className='text-center space-y-6'>
            <div className='flex items-center justify-center mb-4'>
              <AlertCircle className='w-16 h-16 text-yellow-300' />
            </div>
            <h2 className='text-xl font-semibold text-white'>
              注册功能暂不可用
            </h2>
            <p className='text-white/90 text-sm leading-relaxed font-medium'>
              {disabledReason || '管理员已关闭用户注册功能'}
            </p>
            <p className='text-white/80 text-xs mt-2'>
              如需注册账户，请联系网站管理员
            </p>
            <button
              onClick={() => router.push('/login')}
              className='group relative inline-flex w-full justify-center overflow-hidden rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 py-3 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:from-green-500 hover:to-emerald-500 hover:shadow-xl hover:shadow-green-500/25'
            >
              <span className='relative z-10 flex items-center justify-center'>
                返回登录
              </span>
              <div className='absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100' />
            </button>
          </div>
        </div>
        <VersionDisplay />
      </div>
    );
  }

  return (
    <div className='relative min-h-screen flex items-center justify-center px-4 overflow-hidden'>
      {/* 随机背景图片 */}
      <RandomBackground>
        {/* 半透明遮罩 */}
        <div className='absolute inset-0 bg-black/20' />
      </RandomBackground>

      <div className='absolute top-4 right-4 z-20'>
        <ThemeToggle />
      </div>
      <div className='relative z-10 w-full max-w-sm rounded-2xl bg-white/10 backdrop-blur-xl shadow-2xl p-8 border border-white/20'>
        <h1 className='text-white tracking-tight text-center text-3xl font-extrabold mb-2 bg-clip-text drop-shadow-sm'>
          {siteName}
        </h1>
        <p className='text-center text-white/80 text-sm mb-8'>注册新账户</p>

        <form onSubmit={handleSubmit} className='space-y-6'>
          <div>
            <label htmlFor='username' className='sr-only'>
              用户名
            </label>
            <input
              id='username'
              type='text'
              autoComplete='username'
              className='block w-full rounded-lg border-0 py-3 px-4 text-white shadow-sm ring-1 ring-white/60 placeholder:text-white/70 focus:ring-2 focus:ring-green-500 focus:outline-none sm:text-base bg-white/10 backdrop-blur'
              placeholder='输入用户名 (3-20位字母数字下划线)'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor='password' className='sr-only'>
              密码
            </label>
            <input
              id='password'
              type='password'
              autoComplete='new-password'
              className='block w-full rounded-lg border-0 py-3 px-4 text-white shadow-sm ring-1 ring-white/60 placeholder:text-white/70 focus:ring-2 focus:ring-green-500 focus:outline-none sm:text-base bg-white/10 backdrop-blur'
              placeholder='输入密码 (至少6位)'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor='confirmPassword' className='sr-only'>
              确认密码
            </label>
            <input
              id='confirmPassword'
              type='password'
              autoComplete='new-password'
              className='block w-full rounded-lg border-0 py-3 px-4 text-white shadow-sm ring-1 ring-white/60 placeholder:text-white/70 focus:ring-2 focus:ring-green-500 focus:outline-none sm:text-base bg-white/10 backdrop-blur'
              placeholder='再次输入密码'
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor='reason' className='sr-only'>
              注册申请说明
            </label>
            <textarea
              id='reason'
              rows={3}
              className='block w-full rounded-lg border-0 py-3 px-4 text-white shadow-sm ring-1 ring-white/60 placeholder:text-white/70 focus:ring-2 focus:ring-green-500 focus:outline-none sm:text-base bg-white/10 backdrop-blur resize-none'
              placeholder='请简要说明注册理由（填写暗号可以更快通过哟~）'
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {error && (
            <p className='text-sm text-red-200 bg-red-900/30 rounded-lg py-2 px-3 text-center border border-red-700/50'>
              {error}
            </p>
          )}

          {success && (
            <p className='text-sm text-green-200 bg-green-900/30 rounded-lg py-2 px-3 text-center border border-green-700/50'>
              {success}
            </p>
          )}

          <button
            type='submit'
            disabled={
              !username || !password || !confirmPassword || loading || !!success
            }
            className='group relative inline-flex w-full justify-center overflow-hidden rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 py-3 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:from-green-500 hover:to-emerald-500 hover:shadow-xl hover:shadow-green-500/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none'
          >
            <span className='relative z-10 flex items-center justify-center'>
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
                  注册中...
                </>
              ) : pending ? (
                <>
                  <svg
                    className='h-5 w-5 mr-2'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                    />
                  </svg>
                  已提交审核
                </>
              ) : success ? (
                <>
                  <svg
                    className='h-5 w-5 mr-2'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M5 13l4 4L19 7'
                    />
                  </svg>
                  注册成功，正在跳转...
                </>
              ) : (
                '注册'
              )}
            </span>
            <div className='absolute inset-0 bg-gradient-to-r from-emerald-600 to-green-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100' />
          </button>

          <div className='text-center'>
            <span className='text-white/80 text-sm'>已有账户？</span>
            <button
              type='button'
              onClick={() => router.push('/login')}
              className='ml-2 text-green-300 text-sm font-medium hover:text-green-200 hover:underline transition-colors duration-200'
            >
              立即登录
            </button>
          </div>
        </form>
      </div>

      <VersionDisplay />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegisterPageClient />
    </Suspense>
  );
}
