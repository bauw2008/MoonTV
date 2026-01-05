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
    <button
      onClick={() =>
        window.open('https://github.com/MoonTechLab/LunaTV', '_blank')
      }
      className='absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 transition-colors cursor-pointer'
    >
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
    </button>
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
  const [validationErrors, setValidationErrors] = useState<{
    [key: string]: string;
  }>({});

  const { siteName } = useSite();

  // 在客户端挂载后设置配置
  useEffect(() => {
    const checkRegistrationAvailable = async () => {
      if (typeof window !== 'undefined') {
        const storageType = (window as any).RUNTIME_CONFIG?.STORAGE_TYPE;
        // localStorage 模式不支持注册
        if (storageType === 'localstorage') {
          router.replace('/login');
          return;
        }

        try {
          // 直接检查配置
          const response = await fetch('/api/admin/config');
          if (response.ok) {
            const data = await response.json();
            if (!data.Config.UserConfig.AllowRegister) {
              setRegistrationDisabled(true);
              setDisabledReason('管理员已关闭用户注册功能');
              setShouldShowRegister(true);
              return;
            }
          }

          setShouldShowRegister(true);
        } catch (error) {
          // 网络错误也显示注册页面
          setShouldShowRegister(true);
        }
      }
    };

    checkRegistrationAvailable();
  }, [router]);

  // 实时表单验证
  const validateForm = () => {
    const errors: { [key: string]: string } = {};

    if (!username.trim()) {
      errors.username = '请输入用户名';
    } else if (username.trim().length < 3) {
      errors.username = '用户名至少3位';
    } else if (username.trim().length > 20) {
      errors.username = '用户名最多20位';
    } else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      errors.username = '用户名只能包含字母、数字和下划线';
    }

    if (!password.trim()) {
      errors.password = '请输入密码';
    } else if (password.length < 6) {
      errors.password = '密码至少6位';
    } else if (!/(?=.*[a-zA-Z])/.test(password)) {
      errors.password = '密码需包含至少一个字母';
    }

    if (!confirmPassword.trim()) {
      errors.confirmPassword = '请确认密码';
    } else if (password !== confirmPassword) {
      errors.confirmPassword = '两次输入的密码不一致';
    }

    if (reason.length > 200) {
      errors.reason = '注册理由最多200字';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 实时验证单个字段
  const validateField = (field: string, value: string) => {
    const errors = { ...validationErrors };

    switch (field) {
      case 'username':
        if (!value.trim()) {
          errors.username = '请输入用户名';
        } else if (value.trim().length < 3) {
          errors.username = '用户名至少3位';
        } else if (value.trim().length > 20) {
          errors.username = '用户名最多20位';
        } else if (!/^[a-zA-Z0-9_]+$/.test(value.trim())) {
          errors.username = '用户名只能包含字母、数字和下划线';
        } else {
          delete errors.username;
        }
        break;

      case 'password':
        if (!value.trim()) {
          errors.password = '请输入密码';
        } else if (value.length < 6) {
          errors.password = '密码至少6位';
        } else if (!/(?=.*[a-zA-Z])/.test(value)) {
          errors.password = '密码需包含至少一个字母';
        } else {
          delete errors.password;
          // 如果确认密码已填写，重新验证确认密码
          if (confirmPassword) {
            if (value !== confirmPassword) {
              errors.confirmPassword = '两次输入的密码不一致';
            } else {
              delete errors.confirmPassword;
            }
          }
        }
        break;

      case 'confirmPassword':
        if (!value.trim()) {
          errors.confirmPassword = '请确认密码';
        } else if (value !== password) {
          errors.confirmPassword = '两次输入的密码不一致';
        } else {
          delete errors.confirmPassword;
        }
        break;

      case 'reason':
        if (value.length > 200) {
          errors.reason = '注册理由最多200字';
        } else {
          delete errors.reason;
        }
        break;
    }

    setValidationErrors(errors);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateForm()) {
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

          // 如果服务器返回通知标记，设置时间戳
          if (data.notifyAdmin) {
            localStorage.setItem('last-pending-update', Date.now().toString());
          }
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
          <div className='absolute inset-0 bg-black/20 dark:bg-black/40' />
        </RandomBackground>

        <div className='absolute top-4 right-4 z-20'>
          <ThemeToggle />
        </div>
        <div className='relative z-10 w-full max-w-xs rounded-2xl bg-white/10 dark:bg-gray-900/60 backdrop-blur-xl shadow-2xl p-6 border border-white/10 dark:border-gray-700/50 mx-auto'>
          <h1 className='text-white tracking-tight text-center text-2xl font-extrabold mb-2 bg-clip-text drop-shadow-sm'>
            {siteName}
          </h1>
          <div className='text-center space-y-6'>
            <div className='flex items-center justify-center mb-4'>
              <AlertCircle className='w-16 h-16 text-yellow-300' />
            </div>
            <h2 className='text-xl font-semibold text-white dark:text-gray-100'>
              注册功能暂不可用
            </h2>
            <p className='text-gray-700 dark:text-gray-300 text-sm leading-relaxed font-medium'>
              {disabledReason || '管理员已关闭用户注册功能'}
            </p>
            <p className='text-gray-600 dark:text-gray-400 text-xs mt-2'>
              如需注册账户，请联系网站管理员
            </p>
            <button
              onClick={() => router.push('/login')}
              className='group relative inline-flex w-full justify-center overflow-hidden rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:from-green-500 hover:to-emerald-500 hover:shadow-xl hover:shadow-green-500/25'
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
        <div className='absolute inset-0 bg-black/20 dark:bg-black/40' />
      </RandomBackground>

      <div className='absolute top-4 right-4 z-20'>
        <ThemeToggle />
      </div>
      <div className='relative z-10 w-full max-w-xs rounded-2xl bg-white/10 dark:bg-gray-900/60 backdrop-blur-xl shadow-2xl p-6 border border-white/10 dark:border-gray-700/50 mx-auto'>
        <h1 className='text-white dark:text-gray-100 tracking-tight text-center text-2xl font-extrabold mb-6 bg-clip-text drop-shadow-sm'>
          注册账号
        </h1>

        {pending ? (
          <div className='text-center space-y-4'>
            <CheckCircle className='w-16 h-16 text-green-400 mx-auto' />
            <p className='text-white dark:text-gray-100 font-medium'>
              {success}
            </p>
            <p className='text-sm text-gray-300 dark:text-gray-400'>
              请等待管理员审核
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div>
              <label htmlFor='username' className='sr-only'>
                用户名
              </label>
              <input
                id='username'
                type='text'
                autoComplete='username'
                className={`block w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-white/60 dark:ring-gray-600/60 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:outline-none sm:text-sm bg-white/90 dark:bg-gray-800/90 backdrop-blur ${
                  validationErrors.username ? 'ring-red-500' : ''
                }`}
                placeholder='输入用户名 (3-20位字母数字下划线)'
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  validateField('username', e.target.value);
                }}
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
                className={`block w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-white/60 dark:ring-gray-600/60 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:outline-none sm:text-sm bg-white/90 dark:bg-gray-800/90 backdrop-blur ${
                  validationErrors.password ? 'ring-red-500' : ''
                }`}
                placeholder='输入密码 (至少6位，包含字母)'
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  validateField('password', e.target.value);
                }}
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
                className={`block w-full rounded-lg border-0 py-3 px-4 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-white/60 dark:ring-gray-600/60 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:outline-none sm:text-base bg-white/90 dark:bg-gray-800/90 backdrop-blur ${
                  validationErrors.confirmPassword ? 'ring-red-500' : ''
                }`}
                placeholder='再次输入密码'
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  validateField('confirmPassword', e.target.value);
                }}
              />
            </div>

            <div>
              <label htmlFor='reason' className='sr-only'>
                注册申请说明
              </label>
              <textarea
                id='reason'
                rows={3}
                className='block w-full rounded-lg border-0 py-2.5 px-3 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-white/60 dark:ring-gray-600/60 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:outline-none sm:text-sm bg-white/90 dark:bg-gray-800/90 backdrop-blur resize-none'
                placeholder='请简要说明注册理由（填写暗号可以更快通过哟~）'
                maxLength={200}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {error && (
              <p className='text-sm text-red-300 dark:text-red-400 bg-red-900/30 dark:bg-red-900/50 rounded-lg py-2 px-3 text-center border border-red-700/50'>
                {error}
              </p>
            )}

            {validationErrors.username && (
              <p className='text-sm text-red-300 dark:text-red-400 bg-red-900/30 dark:bg-red-900/50 rounded-lg py-1 px-3 text-center border border-red-700/50'>
                {validationErrors.username}
              </p>
            )}

            {validationErrors.password && (
              <p className='text-sm text-red-300 dark:text-red-400 bg-red-900/30 dark:bg-red-900/50 rounded-lg py-1 px-3 text-center border border-red-700/50'>
                {validationErrors.password}
              </p>
            )}

            {validationErrors.confirmPassword && (
              <p className='text-sm text-red-300 dark:text-red-400 bg-red-900/30 dark:bg-red-900/50 rounded-lg py-1 px-3 text-center border border-red-700/50'>
                {validationErrors.confirmPassword}
              </p>
            )}

            {validationErrors.reason && (
              <p className='text-sm text-red-300 dark:text-red-400 bg-red-900/30 dark:bg-red-900/50 rounded-lg py-1 px-3 text-center border border-red-700/50'>
                {validationErrors.reason}
              </p>
            )}

            {success && (
              <p className='text-sm text-green-300 dark:text-green-400 bg-green-900/30 dark:bg-green-900/50 rounded-lg py-2 px-3 text-center border border-green-700/50'>
                {success}
              </p>
            )}

            <button
              type='submit'
              disabled={loading}
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
                    注册中...
                  </>
                ) : (
                  '注册'
                )}
              </span>
            </button>

            <div className='text-center'>
              <button
                type='button'
                onClick={() => router.push('/login')}
                className='text-xs text-gray-300 dark:text-gray-400 hover:text-white dark:hover:text-gray-100 transition-colors'
              >
                已有账号？返回登录
              </button>
            </div>
          </form>
        )}
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
