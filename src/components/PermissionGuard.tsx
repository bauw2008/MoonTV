import { useEffect, useState } from 'react';

import { useAdminPermissions } from '@/hooks/useAdminPermissions';

interface PermissionGuardProps {
  children: React.ReactNode;
  permission: keyof ReturnType<typeof useAdminPermissions>;
  fallback?: React.ReactNode;
}

export function PermissionGuard({
  children,
  permission,
  fallback,
}: PermissionGuardProps) {
  const permissions = useAdminPermissions();

  // 添加延迟检查，避免竞态条件
  const [delayedCheck, setDelayedCheck] = useState(false);

  useEffect(() => {
    // 延迟 100ms 后再检查权限，确保状态稳定
    const timer = setTimeout(() => {
      setDelayedCheck(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [permissions]);

  // 如果还没有延迟检查完成，显示加载状态
  if (!delayedCheck) {
    return (
      <div className='bg-blue-100 text-blue-900 rounded-lg p-4'>
        <p>正在验证权限...</p>
      </div>
    );
  }

  if (!permissions[permission]) {
    return (
      fallback || (
        <div className='bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-xl backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 p-6'>
          <div className='text-center'>
            <div className='p-3 bg-red-100 dark:bg-red-900/20 rounded-xl inline-flex mb-4'>
              <svg
                className='w-6 h-6 text-red-600'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
            </div>
            <h3 className='text-lg font-semibold text-red-600 dark:text-red-400 mb-2'>
              权限不足
            </h3>
            <p className='text-gray-600 dark:text-gray-400'>
              您没有访问此功能的权限
            </p>
            <div className='text-xs text-gray-500 mt-2'>
              要求权限: {permission}
              <br />
              实际权限值: {String(permissions[permission])}
              <br />
              所有权限: {Object.keys(permissions).join(', ')}
            </div>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}
