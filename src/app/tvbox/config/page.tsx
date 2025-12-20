'use client';

import { useCallback, useEffect, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

import PageLayout from '@/components/PageLayout';

interface DeviceInfo {
  deviceId: string;
  deviceInfo: string;
  bindTime: number;
}

interface SecurityConfig {
  enableAuth: boolean;
  token: string;
  enableIpWhitelist: boolean;
  allowedIPs: string[];
  enableRateLimit: boolean;
  rateLimit: number;
  enableDeviceBinding: boolean;
  maxDevices: number;
  userTokens?: Array<{
    username: string;
    token: string;
    enabled: boolean;
    devices: Array<{
      deviceId: string;
      deviceInfo: string;
      bindTime: number;
    }>;
  }>;
}

export default function TVBoxConfigPage() {
  const [tokenCopied, setTokenCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [format, setFormat] = useState<'json' | 'base64'>('json');
  const [configMode, setConfigMode] = useState<
    'standard' | 'safe' | 'fast' | 'yingshicang'
  >('standard');
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig | null>(
    null
  );
  const [siteName, setSiteName] = useState('Vidora');
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [showDeviceList, setShowDeviceList] = useState(false);

  const fetchSecurityConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/tvbox-config');
      if (response.ok) {
        const data = await response.json();
        setSecurityConfig(data.securityConfig || null);
        setSiteName(data.siteName || 'Vidora');
      }
    } catch (error) {
      console.error('获取安全配置失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDevices = useCallback(async () => {
    if (!securityConfig?.enableDeviceBinding) return;

    try {
      setDevicesLoading(true);
      const response = await fetch('/api/tvbox-config/devices');
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
      }
    } catch (error) {
      console.error('获取设备列表失败:', error);
    } finally {
      setDevicesLoading(false);
    }
  }, [securityConfig?.enableDeviceBinding]);

  const unbindDevice = useCallback(
    async (deviceId: string) => {
      try {
        const response = await fetch('/api/tvbox-config/devices', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ deviceId }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // 重新获取设备列表
            await fetchDevices();
            // 重新获取安全配置以更新设备数量显示
            await fetchSecurityConfig();
            return true;
          }
          throw new Error(data.error || '解绑失败');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '解绑失败');
      } catch (error) {
        console.error('解绑设备失败:', error);
        alert(error instanceof Error ? error.message : '解绑设备失败');
        return false;
      }
    },
    [fetchDevices, fetchSecurityConfig]
  );

  useEffect(() => {
    fetchSecurityConfig();
  }, [fetchSecurityConfig]);

  useEffect(() => {
    if (securityConfig?.enableDeviceBinding) {
      fetchDevices();
    }
  }, [securityConfig?.enableDeviceBinding, fetchDevices]);

  const getConfigUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';
    const baseUrl = window.location.origin;
    const params = new URLSearchParams();

    params.append('format', format);

    // 如果启用了设备绑定且有Token，则添加Token参数
    if (securityConfig?.enableDeviceBinding && securityConfig.token) {
      params.append('token', securityConfig.token);
    }

    if (configMode !== 'standard') {
      params.append('mode', configMode);
    }

    return `${baseUrl}/api/tvbox?${params.toString()}`;
  }, [format, configMode, securityConfig]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getConfigUrl());
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch {
      // Copy failed silently
    }
  };

  return (
    <PageLayout activePath='/tvbox'>
      <div className='max-w-4xl mx-auto p-4 md:p-6'>
        {/* 页面标题 */}
        <div className='mb-8'>
          <div className='flex items-center gap-3 mb-4'>
            <div className='flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl'>
              <svg
                className='w-6 h-6 text-blue-600 dark:text-blue-400'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
                />
              </svg>
            </div>
            <div>
              <h1 className='text-2xl md:text-3xl font-bold text-gray-900 dark:text-white'>
                TVBox 配置
              </h1>
              <p className='text-gray-600 dark:text-gray-400'>
                将 {siteName} 的视频源导入到 TVBox 应用中使用
              </p>
            </div>
          </div>
        </div>

        {/* 安全状态提示 */}
        {!loading && securityConfig && (
          <div className='mb-6'>
            {securityConfig.enableDeviceBinding ||
            securityConfig.enableIpWhitelist ||
            securityConfig.enableRateLimit ? (
              <div className='bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4'>
                <div className='flex items-start gap-3'>
                  <svg
                    className='w-5 h-5 text-green-600 dark:text-green-400 mt-0.5'
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
                  <div>
                    <h3 className='font-semibold text-green-800 dark:text-green-200 mb-1'>
                      🔒 已启用安全配置
                    </h3>
                    <div className='text-sm text-green-700 dark:text-green-300 space-y-1'>
                      {securityConfig.enableDeviceBinding && (
                        <p>• Token验证：已启用</p>
                      )}
                      {securityConfig.enableIpWhitelist && (
                        <p>
                          • IP白名单：已启用（限制{' '}
                          {securityConfig.allowedIPs.length} 个IP访问）
                        </p>
                      )}
                      {securityConfig.enableRateLimit && (
                        <p>• 频率限制：{securityConfig.rateLimit}次/分钟</p>
                      )}
                      {securityConfig.enableDeviceBinding && (
                        <div className='flex items-center justify-between'>
                          <p>
                            • 绑定设备数量：
                            {(() => {
                              const authInfo = getAuthInfoFromBrowserCookie();
                              const currentUsername = authInfo?.username;
                              if (
                                currentUsername &&
                                securityConfig.userTokens
                              ) {
                                const userToken =
                                  securityConfig.userTokens.find(
                                    (t) =>
                                      t.username === currentUsername &&
                                      t.enabled
                                  );
                                if (userToken) {
                                  return `${userToken.devices.length}/${securityConfig.maxDevices}`;
                                }
                              }
                              return '0/0';
                            })()}
                          </p>
                          <button
                            onClick={() => setShowDeviceList(!showDeviceList)}
                            className='ml-4 px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors'
                          >
                            {showDeviceList ? '隐藏设备' : '查看设备'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className='bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4'>
                <div className='flex items-start gap-3'>
                  <svg
                    className='w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                    />
                  </svg>
                  <div>
                    <h3 className='font-semibold text-yellow-800 dark:text-yellow-200 mb-1'>
                      ⚠️ 安全提醒
                    </h3>
                    <p className='text-sm text-yellow-700 dark:text-yellow-300'>
                      当前未启用任何安全配置，任何人都可以访问您的TVBox配置。建议在管理后台启用安全选项。
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 设备管理列表 */}
        {securityConfig?.enableDeviceBinding && showDeviceList && (
          <div className='bg-transparent dark:bg-transparent rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700'>
            <h2 className='text-xl font-semibold mb-4 text-gray-900 dark:text-white'>
              📱 我的设备
            </h2>

            {devicesLoading ? (
              <div className='flex justify-center items-center py-8'>
                <div className='animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600'></div>
              </div>
            ) : devices.length === 0 ? (
              <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                <svg
                  className='w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z'
                  />
                </svg>
                <p>暂无绑定设备</p>
                <p className='text-sm mt-2'>
                  使用TVBox配置链接后将自动绑定设备
                </p>
              </div>
            ) : (
              <div className='space-y-3'>
                {devices.map((device) => (
                  <div
                    key={device.deviceId}
                    className='flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-600'
                  >
                    <div className='flex-1'>
                      <div className='flex items-center gap-3'>
                        <div className='w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center'>
                          <svg
                            className='w-5 h-5 text-blue-600 dark:text-blue-400'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth={2}
                              d='M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z'
                            />
                          </svg>
                        </div>
                        <div>
                          <p className='font-medium text-gray-900 dark:text-white'>
                            {device.deviceInfo || '未知设备'}
                          </p>
                          <p className='text-sm text-gray-500 dark:text-gray-400'>
                            绑定时间:{' '}
                            {new Date(device.bindTime).toLocaleString('zh-CN')}
                          </p>
                          <p className='text-xs text-gray-400 dark:text-gray-500 font-mono'>
                            ID: {device.deviceId}
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `确定要解绑设备 "${
                              device.deviceInfo || '未知设备'
                            }" 吗？`
                          )
                        ) {
                          unbindDevice(device.deviceId);
                        }
                      }}
                      className='ml-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors flex items-center gap-2'
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
                          d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                        />
                      </svg>
                      解绑
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 配置链接卡片 */}
        <div className='bg-transparent dark:bg-transparent rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700'>
          <h2 className='text-xl font-semibold mb-4 text-gray-900 dark:text-white'>
            🔗 配置链接
          </h2>

          <div className='mb-4'>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              格式类型
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'json' | 'base64')}
              className='w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:bg-transparent text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            >
              <option value='json'>JSON 格式（推荐）</option>
              <option value='base64'>Base64 格式</option>
            </select>
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
              {format === 'json'
                ? '标准 JSON 配置，TVBox 主流分支支持'
                : 'Base64 编码配置，适合特殊环境'}
            </p>
          </div>

          <div className='mb-4'>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              配置模式
            </label>
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
              <label className='flex items-center cursor-pointer p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors'>
                <input
                  type='radio'
                  name='configMode'
                  value='standard'
                  checked={configMode === 'standard'}
                  onChange={(e) => setConfigMode(e.target.value as any)}
                  className='mr-2 w-4 h-4 text-blue-600 focus:ring-blue-500'
                />
                <div className='text-sm'>
                  <span className='font-medium text-gray-900 dark:text-white block'>
                    标准
                  </span>
                  <span className='text-xs text-gray-500 dark:text-gray-400'>
                    日常使用
                  </span>
                </div>
              </label>
              <label className='flex items-center cursor-pointer p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors'>
                <input
                  type='radio'
                  name='configMode'
                  value='safe'
                  checked={configMode === 'safe'}
                  onChange={(e) => setConfigMode(e.target.value as any)}
                  className='mr-2 w-4 h-4 text-blue-600 focus:ring-blue-500'
                />
                <div className='text-sm'>
                  <span className='font-medium text-gray-900 dark:text-white block'>
                    精简
                  </span>
                  <span className='text-xs text-gray-500 dark:text-gray-400'>
                    兼容性
                  </span>
                </div>
              </label>
              <label className='flex items-center cursor-pointer p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-green-500 dark:hover:border-green-400 transition-colors'>
                <input
                  type='radio'
                  name='configMode'
                  value='fast'
                  checked={configMode === 'fast'}
                  onChange={(e) => setConfigMode(e.target.value as any)}
                  className='mr-2 w-4 h-4 text-green-600 focus:ring-green-500'
                />
                <div className='text-sm'>
                  <span className='font-medium text-gray-900 dark:text-white block'>
                    快速
                  </span>
                  <span className='text-xs text-gray-500 dark:text-gray-400'>
                    频繁换源
                  </span>
                </div>
              </label>
              <label className='flex items-center cursor-pointer p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-purple-500 dark:hover:border-purple-400 transition-colors'>
                <input
                  type='radio'
                  name='configMode'
                  value='yingshicang'
                  checked={configMode === 'yingshicang'}
                  onChange={(e) => setConfigMode(e.target.value as any)}
                  className='mr-2 w-4 h-4 text-purple-600 focus:ring-purple-500'
                />
                <div className='text-sm'>
                  <span className='font-medium text-gray-900 dark:text-white block'>
                    影视仓
                  </span>
                  <span className='text-xs text-gray-500 dark:text-gray-400'>
                    专用优化
                  </span>
                </div>
              </label>
            </div>
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-2'>
              {configMode === 'standard'
                ? '📊 包含 IJK 优化、DoH DNS、广告过滤，适合日常使用'
                : configMode === 'safe'
                ? '🔒 仅核心配置，TVBox 兼容性问题时使用'
                : configMode === 'fast'
                ? '⚡ 优化切换速度，移除超时配置，减少卡顿和 SSL 错误'
                : '🎬 专为影视仓优化，包含播放规则和兼容性修复'}
            </p>
          </div>

          {securityConfig?.enableDeviceBinding && securityConfig.token && (
            <div className='mb-4'>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'></label>
              <div className='flex items-center space-x-2'>
                <input
                  type='text'
                  readOnly
                  value={securityConfig.token}
                  className='flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:bg-transparent text-gray-900 dark:text-white font-mono text-sm focus:outline-none'
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(securityConfig.token);
                    setTokenCopied(true);
                    setTimeout(() => setTokenCopied(false), 2000);
                  }}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                    tokenCopied
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  } transform hover:scale-105`}
                >
                  {tokenCopied ? '✓ 已复制' : '复制Token'}
                </button>
              </div>
            </div>
          )}

          <div className='flex items-center space-x-2'>
            <input
              type='text'
              readOnly
              value={getConfigUrl()}
              className='flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:bg-transparent text-gray-900 dark:text-white font-mono text-sm focus:outline-none'
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(getConfigUrl());
                setUrlCopied(true);
                setTimeout(() => setUrlCopied(false), 2000);
              }}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                urlCopied
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              } transform hover:scale-105`}
            >
              {urlCopied ? '✓ 已复制' : '复制URL'}
            </button>
          </div>
        </div>

        {/* 快速开始 */}
        <div className='bg-transparent dark:bg-transparent rounded-xl p-6 mb-6 border border-gray-200 dark:border-gray-700'>
          <h2 className='text-xl font-semibold mb-4 text-gray-900 dark:text-white'>
            📋 快速开始
          </h2>
          <ol className='text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside'>
            <li>复制上方配置链接</li>
            <li>打开 TVBox → 设置 → 配置地址</li>
            <li>粘贴链接并确认导入</li>
            <li>等待配置加载完成即可使用</li>
          </ol>
        </div>
      </div>
    </PageLayout>
  );
}
