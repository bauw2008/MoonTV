'use client';

import { Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useAdminState } from '@/hooks/admin/useAdminState';

import { CollapsibleTab } from '@/components/admin/ui/CollapsibleTab';
import { PermissionGuard } from '@/components/PermissionGuard';

function OwnerConfigContent() {
  const { loading, withLoading } = useAdminState();
  const [config, setConfig] = useState({
    siteMaintenance: false,
    debugMode: false,
    maxUsers: 1000,
  });

  // JWT密钥管理状态
  const [jwtConfig, setJwtConfig] = useState<any>(null);
  const [showJwtForm, setShowJwtForm] = useState(false);
  const [newJwtSecret, setNewJwtSecret] = useState('');
  const [jwtReason, setJwtReason] = useState('');

  // 重置弹窗状态
  const [showResetModal, setShowResetModal] = useState(false);

  // 加载JWT配置
  const loadJwtConfig = async () => {
    try {
      const response = await fetch('/api/admin/jwt-config');
      if (response.ok) {
        const data = await response.json();
        setJwtConfig(data.config);
      }
    } catch (error) {
      console.error('加载JWT配置失败:', error);
    }
  };

  // 加载站长配置
  const loadOwnerConfig = async () => {
    try {
      const response = await fetch('/api/admin/owner-config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data.data);
      }
    } catch (error) {
      console.error('加载站长配置失败:', error);
    }
  };

  // 组件加载时获取配置
  useEffect(() => {
    loadJwtConfig();
    loadOwnerConfig();
  }, []);

  // 生成新的JWT密钥
  const handleGenerateJwtSecret = async () => {
    if (!confirm('确定要生成新的JWT密钥吗？这将使所有现有的Token失效！')) {
      return;
    }

    try {
      await withLoading('updateJwtConfig', async () => {
        const response = await fetch('/api/admin/jwt-config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'generate',
            reason: jwtReason || '安全更新',
          }),
        });

        if (!response.ok) {
          throw new Error('更新JWT配置失败');
        }

        const data = await response.json();

        // 显示成功提示
        const { ToastManager } = await import('@/components/Toast');
        ToastManager.success('JWT密钥已更新');

        // 重新加载配置
        await loadJwtConfig();
        setJwtReason('');
        setShowJwtForm(false);
      });
    } catch (error) {
      console.error('更新JWT密钥失败:', error);
      const { ToastManager } = await import('@/components/Toast');
      ToastManager.error('更新失败: ' + (error as Error).message);
    }
  };

  // 设置自定义JWT密钥
  const handleSetJwtSecret = async () => {
    if (!newJwtSecret || newJwtSecret.length < 32) {
      const { ToastManager } = await import('@/components/Toast');
      ToastManager.error('密钥长度至少32字符');
      return;
    }

    if (!confirm('确定要设置自定义JWT密钥吗？这将使所有现有的Token失效！')) {
      return;
    }

    try {
      await withLoading('updateJwtConfig', async () => {
        const response = await fetch('/api/admin/jwt-config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'set',
            secret: newJwtSecret,
            reason: jwtReason || '手动设置',
          }),
        });

        if (!response.ok) {
          throw new Error('设置JWT密钥失败');
        }

        const data = await response.json();

        // 显示成功提示
        const { ToastManager } = await import('@/components/Toast');
        ToastManager.success('JWT密钥已设置');

        // 重新加载配置
        await loadJwtConfig();
        setNewJwtSecret('');
        setJwtReason('');
        setShowJwtForm(false);
      });
    } catch (error) {
      console.error('设置JWT密钥失败:', error);
      const { ToastManager } = await import('@/components/Toast');
      ToastManager.error('设置失败: ' + (error as Error).message);
    }
  };

  // 重置所有配置到默认值
  const handleResetAllConfigs = async () => {
    setShowResetModal(true);
  };

  // 确认重置配置

  const confirmResetAllConfigs = async () => {
    try {
      await withLoading('resetAllConfigs', async () => {
        const response = await fetch('/api/admin/reset-configs', {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('重置配置失败');
        }

        // 关闭弹窗

        setShowResetModal(false);

        // 清除导航配置缓存，强制重新读取

        if (typeof window !== 'undefined') {
          localStorage.removeItem('vidora-menu-settings');

          localStorage.removeItem('vidora-custom-categories');

          // 清除RUNTIME_CONFIG中的菜单设置

          if ((window as any).RUNTIME_CONFIG) {
            delete (window as any).RUNTIME_CONFIG.MenuSettings;

            delete (window as any).RUNTIME_CONFIG.CUSTOM_CATEGORIES;
          }
        }

        // 显示成功提示

        const { ToastManager } = await import('@/components/Toast');

        ToastManager.success('所有配置已重置为默认值');

        // 刷新页面以重新加载配置

        setTimeout(() => {
          window.location.reload();
        }, 1500);
      });
    } catch (error) {
      console.error('重置配置失败:', error);

      const { ToastManager } = await import('@/components/Toast');

      ToastManager.error('重置失败: ' + (error as Error).message);
    }
  };

  const handleSave = async () => {
    try {
      console.log('保存站长配置:', config);
      const response = await fetch('/api/admin/owner-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('保存失败');
      }

      // 显示成功提示
      const { ToastManager } = await import('@/components/Toast');
      ToastManager.success('站长配置保存成功');
    } catch (error) {
      console.error('保存站长配置失败:', error);
      const { ToastManager } = await import('@/components/Toast');
      ToastManager.error('保存失败: ' + (error as Error).message);
    }
  };

  return (
    <CollapsibleTab
      title='站长配置'
      theme='red'
      icon={
        <svg
          className='w-5 h-5 text-red-500'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
          />
        </svg>
      }
      defaultCollapsed={true}
    >
      <div className='space-y-6'>
        <div className='space-y-6'>
          {/* 站点维护模式 */}
          <div className='flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800'>
            <div className='flex items-center space-x-3'>
              <div className='p-2 bg-red-100 dark:bg-red-800 rounded-lg'>
                <svg
                  className='w-5 h-5 text-red-600 dark:text-red-400'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                  />
                </svg>
              </div>
              <div>
                <h3 className='font-semibold text-red-700 dark:text-red-400'>
                  站点维护模式
                </h3>
                <p className='text-sm text-red-600 dark:text-red-500'>
                  启用后，普通用户无法访问站点
                </p>
              </div>
            </div>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={config.siteMaintenance}
                onChange={(e) =>
                  setConfig({ ...config, siteMaintenance: e.target.checked })
                }
                className='sr-only peer'
              />
              <div className='w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-gray-600 peer-checked:bg-red-600'></div>
            </label>
          </div>

          {/* 调试模式 */}
          <div className='flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800'>
            <div className='flex items-center space-x-3'>
              <div className='p-2 bg-yellow-100 dark:bg-yellow-800 rounded-lg'>
                <svg
                  className='w-5 h-5 text-yellow-600 dark:text-yellow-400'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M10 20l4 16m4 4l-4 4M6.5 14a7.5 7.5 0 00-15 0m.75-6.036c0-1.11.63-2 1.25-2.17a9.976 9.976 0 01-1.112.057c-.633.032 1.25.057 2.17a9.976 9.976 0 001-1.112-.057c-.633-.032 1.25-.057 2.17M12 12v.01M8.5 8.487l.014.014a3.98 3.98 0 01-5.617-5.617m-5.617 5.617a3.98 3.98 0 015.617 5.617m5.617 5.617a3.98 3.98 0 01-5.617-5.617'
                  />
                </svg>
              </div>
              <div>
                <h3 className='font-semibold text-yellow-700 dark:text-yellow-400'>
                  调试模式
                </h3>
                <p className='text-sm text-yellow-600 dark:text-yellow-500'>
                  启用详细的调试日志和错误信息
                </p>
              </div>
            </div>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={config.debugMode}
                onChange={(e) =>
                  setConfig({ ...config, debugMode: e.target.checked })
                }
                className='sr-only peer'
              />
              <div className='w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:rounded-full after:h-5 after:w-5 after:transition-all dark:after:border-gray-600 peer-checked:bg-yellow-600'></div>
            </label>
          </div>

          {/* 最大用户数限制 */}
          <div className='p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-3'>
                <div className='p-2 bg-purple-100 dark:bg-purple-800 rounded-lg'>
                  <svg
                    className='w-5 h-5 text-purple-600 dark:text-purple-400'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M17 20h5v-2M3 21h6m2 0h-4m2 0h-4m-9 0h.01M17 20l-2 2m-2 2H9m2 0h6m2 0h6'
                    />
                  </svg>
                </div>
                <div>
                  <h3 className='font-semibold text-purple-700 dark:text-purple-400'>
                    最大用户数限制
                  </h3>
                  <p className='text-sm text-purple-600 dark:text-purple-500'>
                    限制站点最大用户数量
                  </p>
                </div>
              </div>
              <div className='flex items-center space-x-3'>
                <input
                  type='number'
                  min='1'
                  max='10000'
                  value={config.maxUsers}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value) || 1000;
                    console.log('用户数输入变化:', newValue);
                    setConfig({ ...config, maxUsers: newValue });
                  }}
                  className='w-24 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-gray-900 dark:text-gray-100'
                />
                <span className='text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap'>
                  用户
                </span>
              </div>
            </div>
          </div>

          {/* JWT密钥管理 */}
          <div className='p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800'>
            <div className='flex items-center space-x-3 mb-4'>
              <div className='p-2 bg-amber-100 dark:bg-amber-800 rounded-lg'>
                <svg
                  className='w-5 h-5 text-amber-600 dark:text-amber-400'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
                  />
                </svg>
              </div>
              <div>
                <h3 className='font-semibold text-amber-700 dark:text-amber-400'>
                  JWT密钥管理
                </h3>
                <p className='text-sm text-amber-600 dark:text-amber-500'>
                  管理JWT签名密钥，提升系统安全性
                </p>
              </div>
            </div>

            {jwtConfig && (
              <div className='mb-4 p-4 bg-amber-100 dark:bg-amber-900/40 rounded-lg border border-amber-200 dark:border-amber-700'>
                <div className='space-y-3'>
                  {/* 密钥显示区域 */}
                  <div>
                    <div className='flex items-center justify-between mb-2'>
                      <span className='text-sm font-medium text-amber-700 dark:text-amber-300'>
                        当前密钥
                      </span>
                      <button
                        onClick={async () => {
                          navigator.clipboard.writeText(jwtConfig.secret);
                          const { ToastManager } =
                            await import('@/components/Toast');
                          ToastManager.success('密钥已复制到剪贴板');
                        }}
                        className='px-2 py-1 text-xs bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300 rounded hover:bg-amber-300 dark:hover:bg-amber-700 transition-colors flex items-center space-x-1'
                      >
                        <Copy className='w-3 h-3' />
                        <span>复制</span>
                      </button>
                    </div>
                    <div className='p-3 bg-white dark:bg-gray-800 rounded border border-amber-300 dark:border-amber-600'>
                      <code className='text-xs font-mono text-amber-800 dark:text-amber-200 break-all'>
                        {jwtConfig.secret.length > 20
                          ? `${jwtConfig.secret.substring(0, 8)}...${jwtConfig.secret.substring(jwtConfig.secret.length - 8)}`
                          : jwtConfig.secret}
                      </code>
                    </div>
                  </div>

                  {/* 密钥信息网格 */}
                  <div className='grid grid-cols-2 gap-3 text-sm'>
                    <div className='bg-white dark:bg-gray-800 p-2 rounded border border-amber-200 dark:border-amber-700'>
                      <div className='text-amber-600 dark:text-amber-400 text-xs'>
                        密钥长度
                      </div>
                      <div className='font-semibold text-amber-800 dark:text-amber-200'>
                        {jwtConfig.secretLength} 字符
                        <span className='ml-1 text-xs'>
                          {jwtConfig.secretLength < 32
                            ? '⚠️ 过短'
                            : jwtConfig.secretLength < 64
                              ? '✅ 标准'
                              : '🔒 高强度'}
                        </span>
                      </div>
                    </div>
                    <div className='bg-white dark:bg-gray-800 p-2 rounded border border-amber-200 dark:border-amber-700'>
                      <div className='text-amber-600 dark:text-amber-400 text-xs'>
                        更新者
                      </div>
                      <div className='font-semibold text-amber-800 dark:text-amber-200'>
                        {jwtConfig.updatedBy}
                      </div>
                    </div>
                    <div className='col-span-2 bg-white dark:bg-gray-800 p-2 rounded border border-amber-200 dark:border-amber-700'>
                      <div className='text-amber-600 dark:text-amber-400 text-xs'>
                        更新时间
                      </div>
                      <div className='font-semibold text-amber-800 dark:text-amber-200'>
                        {jwtConfig.updatedAt
                          ? new Date(jwtConfig.updatedAt).toLocaleString(
                              'zh-CN',
                            )
                          : '未知'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className='flex flex-wrap gap-2'>
              <button
                onClick={() => setShowJwtForm(!showJwtForm)}
                className='px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm'
              >
                {showJwtForm ? '取消' : '管理密钥'}
              </button>
              <button
                onClick={handleGenerateJwtSecret}
                disabled={loading.updateJwtConfig}
                className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50'
              >
                {loading.updateJwtConfig ? '生成中...' : '自动生成'}
              </button>
            </div>

            {showJwtForm && (
              <div className='mt-4 space-y-3'>
                <div>
                  <label className='block text-sm font-medium text-amber-700 dark:text-amber-300 mb-1'>
                    自定义密钥 (可选)
                  </label>
                  <input
                    type='password'
                    value={newJwtSecret}
                    onChange={(e) => setNewJwtSecret(e.target.value)}
                    placeholder='输入至少32字符的密钥，或留空使用自动生成'
                    className='w-full px-3 py-2 bg-white dark:bg-gray-700 border border-amber-300 dark:border-amber-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-amber-700 dark:text-amber-300 mb-1'>
                    变更原因
                  </label>
                  <input
                    type='text'
                    value={jwtReason}
                    onChange={(e) => setJwtReason(e.target.value)}
                    placeholder='说明此次密钥变更的原因'
                    className='w-full px-3 py-2 bg-white dark:bg-gray-700 border border-amber-300 dark:border-amber-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm'
                  />
                </div>
                <div className='flex gap-2'>
                  <button
                    onClick={handleSetJwtSecret}
                    disabled={loading.updateJwtConfig}
                    className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50'
                  >
                    {loading.updateJwtConfig ? '设置中...' : '设置密钥'}
                  </button>
                </div>
                <div className='text-xs text-amber-600 dark:text-amber-400'>
                  ⚠️
                  注意：更改JWT密钥将使所有现有登录会话失效，所有用户需要重新登录
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className='flex justify-end gap-3 mt-6'>
              {/* 重置按钮 */}
              <button
                onClick={handleResetAllConfigs}
                disabled={loading.resetAllConfigs}
                className='px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium flex items-center space-x-2 disabled:opacity-50'
              >
                {loading.resetAllConfigs ? (
                  <>
                    <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                    <span>重置中</span>
                  </>
                ) : (
                  <>
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
                        d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                      />
                    </svg>
                    <span>重置所有配置</span>
                  </>
                )}
              </button>

              {/* 保存按钮 */}
              <button
                onClick={handleSave}
                disabled={loading.saveOwnerConfig}
                className='px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-medium rounded-lg transition-all shadow hover:shadow-md flex items-center space-x-2'
              >
                <svg
                  className='w-5 h-5'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M5 13l4 4L19 7'
                  />
                </svg>
                <span>保存站长配置</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 重置弹窗 - 美观的弹窗效果 */}
      {showResetModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999]'
          onClick={() => setShowResetModal(false)}
        >
          <div
            className='bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 dark:border-gray-600/20 p-6 max-w-sm w-full mx-4 transform transition-all'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-center mb-4'>
              <div className='p-2 bg-gradient-to-br from-red-500 to-pink-600 rounded-lg shadow-md mr-3'>
                <svg
                  className='w-5 h-5 text-white'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'
                  />
                </svg>
              </div>
              <h3 className='text-lg font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent'>
                系统重置 - 危险操作
              </h3>
            </div>
            <p className='text-sm font-semibold text-red-700 dark:text-red-400 mb-3'>
              此操作将重置以下站长配置：
            </p>
            <ul className='mb-4 space-y-1.5 text-sm text-red-700 dark:text-red-400 pl-5'>
              <li className='flex items-start'>
                <span className='w-1 h-1 bg-red-500 rounded-full mt-2 mr-2.5 flex-shrink-0'></span>
                站点维护模式设置
              </li>
              <li className='flex items-start'>
                <span className='w-1 h-1 bg-red-500 rounded-full mt-2 mr-2.5 flex-shrink-0'></span>
                调试模式设置
              </li>
              <li className='flex items-start'>
                <span className='w-1 h-1 bg-red-500 rounded-full mt-2 mr-2.5 flex-shrink-0'></span>
                最大用户数限制
              </li>
              <li className='flex items-start'>
                <span className='w-1 h-1 bg-red-500 rounded-full mt-2 mr-2.5 flex-shrink-0'></span>
                JWT密钥配置
              </li>
              <li className='flex items-start'>
                <span className='w-1 h-1 bg-red-500 rounded-full mt-2 mr-2.5 flex-shrink-0'></span>
                所有站长专用配置
              </li>
            </ul>
            <div className='flex justify-end space-x-2'>
              <button
                onClick={() => setShowResetModal(false)}
                className='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'
              >
                取消
              </button>
              <button
                onClick={confirmResetAllConfigs}
                disabled={loading.resetAllConfigs}
                className='px-4 py-2 text-sm font-medium bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-lg transition-all shadow hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2'
              >
                {loading.resetAllConfigs ? (
                  <>
                    <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                    <span>重置中...</span>
                  </>
                ) : (
                  '确认重置'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </CollapsibleTab>
  );
}

// 导出组件
export function OwnerConfig() {
  return (
    <PermissionGuard permission='canAccessOwnerConfig'>
      <OwnerConfigContent />
    </PermissionGuard>
  );
}
