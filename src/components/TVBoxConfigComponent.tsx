'use client';

import {
  AlertTriangle,
  Monitor,
  Settings,
  Shield,
  Smartphone,
  Tv,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import PageLayout from '@/components/PageLayout';

interface SecurityConfig {
  enableAuth: boolean;
  token: string;
  enableIpWhitelist: boolean;
  allowedIPs: string[];
  enableRateLimit: boolean;
  rateLimit: number;
}

interface DiagnoseResult {
  pass: boolean;
  status: number;
  contentType?: string;
  hasJson: boolean;
  receivedToken?: string;
  size: number;
  sitesCount: number;
  livesCount: number;
  parsesCount: number;
  privateApis?: number;
  spider?: string;
  spiderPrivate?: boolean;
  spiderReachable?: boolean;
  spiderStatus?: number;
  spiderSizeKB?: number;
  spiderLastModified?: string;
  configUrl?: string;
  issues?: string[];
  spider_url?: string;
  spider_md5?: string;
  spider_cached?: boolean;
  spider_real_size?: number;
  spider_tried?: number;
  spider_success?: boolean;
  spider_backup?: string;
}

export default function TVBoxConfigPage() {
  const [copied, setCopied] = useState(false);
  const [format, setFormat] = useState<'json' | 'base64'>('json');
  const [configMode, setConfigMode] = useState<
    'standard' | 'safe' | 'yingshicang'
  >('standard');
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState<DiagnoseResult | null>(
    null
  );

  // 获取安全配置（使用普通用户可访问的接口）
  const fetchSecurityConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/tvbox-config');
      if (response.ok) {
        const data = await response.json();
        setSecurityConfig(data.securityConfig || null);
      }
    } catch (error) {
      console.error('获取安全配置失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSecurityConfig();
  }, [fetchSecurityConfig]);

  const getConfigUrl = useCallback(() => {
    if (typeof window === 'undefined') return '';
    const baseUrl = window.location.origin;
    const params = new URLSearchParams();

    params.append('format', format);

    // 如果启用了Token验证，自动添加token参数
    if (securityConfig?.enableAuth && securityConfig.token) {
      params.append('token', securityConfig.token);
    }

    // 添加配置模式参数
    if (configMode !== 'standard') {
      params.append('mode', configMode);
    }

    return `${baseUrl}/api/tvbox?${params.toString()}`;
  }, [format, configMode, securityConfig]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getConfigUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Copy failed silently
    }
  };

  // 诊断配置
  const handleDiagnose = async () => {
    setIsDiagnosing(true);
    setDiagnoseResult(null);

    try {
      // 如果有 token，就传递（无论是否启用验证）
      let diagnoseUrl = '/api/tvbox/diagnose';
      if (securityConfig?.token) {
        diagnoseUrl += `?token=${encodeURIComponent(securityConfig.token)}`;
      }

      const response = await fetch(diagnoseUrl);
      const result = await response.json();

      setDiagnoseResult(result);
    } catch (error) {
      console.error('诊断失败:', error);
    } finally {
      setIsDiagnosing(false);
    }
  };

  return (
    <PageLayout activePath='/tvbox'>
      <div className='max-w-4xl mx-auto p-4 md:p-6'>
        {/* 页面标题 */}
        <div className='mb-8'>
          <div className='flex items-center gap-3 mb-4'>
            <div className='flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl'>
              <Tv className='w-6 h-6 text-blue-600 dark:text-blue-400' />
            </div>
            <div>
              <h1 className='text-2xl md:text-3xl font-bold text-gray-900 dark:text-white'>
                TVBox 配置
              </h1>
              <p className='text-gray-600 dark:text-gray-400'>
                将 LunaTV 的视频源导入到 TVBox 应用中使用
              </p>
            </div>
          </div>
        </div>

        {/* 安全状态提示 */}
        {!loading && securityConfig && (
          <div className='mb-6'>
            {securityConfig.enableAuth ||
            securityConfig.enableIpWhitelist ||
            securityConfig.enableRateLimit ? (
              <div className='bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4'>
                <div className='flex items-start gap-3'>
                  <Shield className='w-5 h-5 text-green-600 dark:text-green-400 mt-0.5' />
                  <div>
                    <h3 className='font-semibold text-green-800 dark:text-green-200 mb-1'>
                      已启用安全配置
                    </h3>
                    <div className='text-sm text-green-700 dark:text-green-300 space-y-1'>
                      {securityConfig.enableAuth && (
                        <p>• Token验证：已启用（URL已自动包含token）</p>
                      )}
                      {securityConfig.enableIpWhitelist && (
                        <p>
                          • IP白名单：已启用（限制{' '}
                          {securityConfig.allowedIPs.length} 个IP访问）
                        </p>
                      )}
                      {securityConfig.enableRateLimit && (
                        <p>
                          • 频率限制：每分钟最多 {securityConfig.rateLimit}{' '}
                          次请求
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className='bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4'>
                <div className='flex items-start gap-3'>
                  <AlertTriangle className='w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5' />
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

        {/* 配置链接卡片 */}
        <div className='bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700'>
          <h2 className='text-xl font-semibold mb-4 text-gray-900 dark:text-white'>
            配置链接
          </h2>

          <div className='mb-4'>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              格式类型
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'json' | 'base64')}
              className='w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
            >
              <option value='json'>JSON 格式（推荐）</option>
              <option value='base64'>Base64 格式</option>
            </select>
            <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
              {format === 'json'
                ? '标准的 JSON 配置文件，便于调试和查看'
                : '编码后的配置，适合某些特殊环境'}
            </p>
          </div>

          <div className='mb-4'>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
              配置模式
            </label>
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
              <label className='flex items-center cursor-pointer p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors'>
                <input
                  type='radio'
                  name='configMode'
                  value='standard'
                  checked={configMode === 'standard'}
                  onChange={(e) =>
                    setConfigMode(
                      e.target.value as 'standard' | 'safe' | 'yingshicang'
                    )
                  }
                  className='mr-2 w-4 h-4 text-blue-600 focus:ring-blue-500'
                />
                <div className='text-sm'>
                  <span className='font-medium text-gray-900 dark:text-white block'>
                    标准模式
                  </span>
                  <span className='text-xs text-gray-500 dark:text-gray-400'>
                    完整配置
                  </span>
                </div>
              </label>
              <label className='flex items-center cursor-pointer p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors'>
                <input
                  type='radio'
                  name='configMode'
                  value='safe'
                  checked={configMode === 'safe'}
                  onChange={(e) =>
                    setConfigMode(
                      e.target.value as 'standard' | 'safe' | 'yingshicang'
                    )
                  }
                  className='mr-2 w-4 h-4 text-blue-600 focus:ring-blue-500'
                />
                <div className='text-sm'>
                  <span className='font-medium text-gray-900 dark:text-white block'>
                    精简模式
                  </span>
                  <span className='text-xs text-gray-500 dark:text-gray-400'>
                    提高兼容
                  </span>
                </div>
              </label>
              <label className='flex items-center cursor-pointer p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors'>
                <input
                  type='radio'
                  name='configMode'
                  value='yingshicang'
                  checked={configMode === 'yingshicang'}
                  onChange={(e) =>
                    setConfigMode(
                      e.target.value as 'standard' | 'safe' | 'yingshicang'
                    )
                  }
                  className='mr-2 w-4 h-4 text-blue-600 focus:ring-blue-500'
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
                ? '包含完整配置（IJK优化、广告过滤、DoH等），推荐使用'
                : configMode === 'safe'
                ? '仅包含核心配置，遇到TVBox兼容性问题时使用'
                : '专为影视仓优化，包含播放规则和兼容性修复'}
            </p>
          </div>

          <div className='flex items-center space-x-2'>
            <input
              type='text'
              readOnly
              value={getConfigUrl()}
              className='flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:outline-none'
            />
            <button
              onClick={handleCopy}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                copied
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              } transform hover:scale-105`}
            >
              {copied ? '✓ 已复制' : '复制'}
            </button>
          </div>

          {/* 配置诊断按钮 */}
          <div className='mt-4 flex justify-end'>
            <button
              onClick={handleDiagnose}
              disabled={isDiagnosing}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                isDiagnosing
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-purple-500 hover:bg-purple-600 text-white'
              }`}
            >
              {isDiagnosing ? (
                <>
                  <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                  诊断中...
                </>
              ) : (
                <>
                  <Settings className='w-4 h-4' />
                  配置诊断
                </>
              )}
            </button>
          </div>
        </div>

        {/* 诊断结果 */}
        {diagnoseResult && (
          <div className='bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700'>
            <h2 className='text-xl font-semibold mb-4 text-gray-900 dark:text-white'>
              配置诊断结果
            </h2>

            <div
              className={`p-4 rounded-lg ${
                diagnoseResult.pass
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
                  : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700'
              }`}
            >
              <div className='flex items-center gap-2 mb-3'>
                {diagnoseResult.pass ? (
                  <div className='w-6 h-6 bg-green-500 rounded-full flex items-center justify-center'>
                    <span className='text-white text-sm'>✓</span>
                  </div>
                ) : (
                  <div className='w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center'>
                    <span className='text-white text-sm'>⚠</span>
                  </div>
                )}
                <h3
                  className={`text-lg font-medium ${
                    diagnoseResult.pass
                      ? 'text-green-800 dark:text-green-200'
                      : 'text-yellow-800 dark:text-yellow-200'
                  }`}
                >
                  {diagnoseResult.pass ? '配置诊断通过' : '配置存在问题'}
                </h3>
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-4 text-sm'>
                <div className='space-y-2'>
                  <div className='flex justify-between'>
                    <span className='text-gray-600 dark:text-gray-400'>
                      状态码:
                    </span>
                    <span className='font-medium text-gray-900 dark:text-gray-100'>
                      {diagnoseResult.status}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600 dark:text-gray-400'>
                      JSON解析:
                    </span>
                    <span
                      className={`font-medium ${
                        diagnoseResult.hasJson
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {diagnoseResult.hasJson ? '✓ 正常' : '✗ 失败'}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600 dark:text-gray-400'>
                      配置大小:
                    </span>
                    <span className='font-medium text-gray-900 dark:text-gray-100'>
                      {diagnoseResult.size} 字节
                    </span>
                  </div>
                </div>

                <div className='space-y-2'>
                  <div className='flex justify-between'>
                    <span className='text-gray-600 dark:text-gray-400'>
                      影视源数量:
                    </span>
                    <span className='font-medium text-gray-900 dark:text-gray-100'>
                      {diagnoseResult.sitesCount}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600 dark:text-gray-400'>
                      直播源数量:
                    </span>
                    <span className='font-medium text-gray-900 dark:text-gray-100'>
                      {diagnoseResult.livesCount}
                    </span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-gray-600 dark:text-gray-400'>
                      解析源数量:
                    </span>
                    <span className='font-medium text-gray-900 dark:text-gray-100'>
                      {diagnoseResult.parsesCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Spider 信息 */}
              {diagnoseResult.spider && (
                <div className='mt-4 pt-4 border-t border-gray-200 dark:border-gray-600'>
                  <h4 className='font-medium text-gray-900 dark:text-gray-100 mb-2'>
                    Spider 状态
                  </h4>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-2 text-sm'>
                    <div className='flex justify-between'>
                      <span className='text-gray-600 dark:text-gray-400'>
                        文件地址:
                      </span>
                      <span className='font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]'>
                        {diagnoseResult.spider}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-gray-600 dark:text-gray-400'>
                        网络状态:
                      </span>
                      <span
                        className={`font-medium flex items-center gap-1 ${
                          diagnoseResult.spiderReachable
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {diagnoseResult.spiderReachable ? (
                          <Wifi className='w-4 h-4' />
                        ) : (
                          <WifiOff className='w-4 h-4' />
                        )}
                        {diagnoseResult.spiderReachable ? '可访问' : '不可访问'}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-gray-600 dark:text-gray-400'>
                        私网地址:
                      </span>
                      <span
                        className={`font-medium ${
                          diagnoseResult.spiderPrivate
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-green-600 dark:text-green-400'
                        }`}
                      >
                        {diagnoseResult.spiderPrivate ? '是' : '否'}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-gray-600 dark:text-gray-400'>
                        文件大小:
                      </span>
                      <span
                        className={`font-medium ${
                          diagnoseResult.spiderSizeKB &&
                          diagnoseResult.spiderSizeKB < 50
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        {diagnoseResult.spiderSizeKB}KB
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 问题列表 */}
              {diagnoseResult.issues && diagnoseResult.issues.length > 0 && (
                <div className='mt-4 pt-4 border-t border-yellow-200 dark:border-yellow-600'>
                  <h4 className='font-medium text-yellow-800 dark:text-yellow-300 mb-2'>
                    发现的问题
                  </h4>
                  <ul className='list-disc list-inside space-y-1 text-sm text-yellow-700 dark:text-yellow-400'>
                    {diagnoseResult.issues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 使用说明 */}
        <div className='bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700'>
          <h2 className='text-xl font-semibold mb-4 text-gray-900 dark:text-white'>
            使用说明
          </h2>

          <div className='space-y-4'>
            <div className='flex items-start gap-4'>
              <div className='flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400 font-bold text-sm'>
                1
              </div>
              <div>
                <h3 className='font-semibold text-gray-900 dark:text-white mb-1'>
                  获取配置链接
                </h3>
                <p className='text-gray-600 dark:text-gray-400 text-sm'>
                  复制上方的配置链接，支持 JSON 和 Base64 两种格式。
                </p>
              </div>
            </div>

            <div className='flex items-start gap-4'>
              <div className='flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400 font-bold text-sm'>
                2
              </div>
              <div>
                <h3 className='font-semibold text-gray-900 dark:text-white mb-1'>
                  导入 TVBox
                </h3>
                <p className='text-gray-600 dark:text-gray-400 text-sm'>
                  打开 TVBox 应用，进入设置 →
                  配置地址，粘贴复制的链接并确认导入。
                </p>
              </div>
            </div>

            <div className='flex items-start gap-4'>
              <div className='flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400 font-bold text-sm'>
                3
              </div>
              <div>
                <h3 className='font-semibold text-gray-900 dark:text-white mb-1'>
                  开始使用
                </h3>
                <p className='text-gray-600 dark:text-gray-400 text-sm'>
                  配置导入成功后，即可在 TVBox 中浏览和观看 LunaTV 的视频内容。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 支持功能 */}
        <div className='bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700'>
          <h2 className='text-xl font-semibold mb-4 text-gray-900 dark:text-white'>
            ✨ 支持功能
          </h2>

          <div className='grid md:grid-cols-2 gap-6'>
            <div className='space-y-3'>
              <h3 className='font-semibold text-gray-900 dark:text-white flex items-center gap-2'>
                <Monitor className='w-4 h-4' />
                视频功能
              </h3>
              <ul className='text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-6'>
                <li>• 自动同步 LunaTV 的所有视频源</li>
                <li>• 支持搜索和快速搜索</li>
                <li>• 支持分类筛选</li>
                <li>• 内置视频解析接口</li>
                <li>• 广告过滤规则</li>
              </ul>
            </div>

            <div className='space-y-3'>
              <h3 className='font-semibold text-gray-900 dark:text-white flex items-center gap-2'>
                <Smartphone className='w-4 h-4' />
                兼容性
              </h3>
              <ul className='text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-6'>
                <li>• 完全兼容 TVBox 及衍生应用</li>
                <li>• 支持 Android TV、手机、平板</li>
                <li>• 配置实时更新</li>
                <li>• CORS 跨域支持</li>
                <li>• 配置即时生效</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 技术细节 */}
        <div className='bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-700'>
          <h2 className='text-xl font-semibold mb-4 text-gray-900 dark:text-white'>
            ️ 技术细节
          </h2>

          <div className='grid md:grid-cols-2 gap-6 text-sm'>
            <div>
              <h4 className='font-semibold text-gray-900 dark:text-white mb-2'>
                API 端点
              </h4>
              <div className='bg-white dark:bg-gray-800 rounded-lg p-3 font-mono text-xs'>
                GET /api/tvbox?format=json
                <br />
                GET /api/tvbox?format=base64
                <br />
                {securityConfig?.enableAuth && (
                  <>
                    GET /api/tvbox?format=json&token=***
                    <br />
                  </>
                )}
              </div>
            </div>

            <div>
              <h4 className='font-semibold text-gray-900 dark:text-white mb-2'>
                更新机制
              </h4>
              <ul className='text-gray-600 dark:text-gray-400 space-y-1'>
                <li>• 配置变更即时生效</li>
                <li>• 无缓存延迟</li>
                <li>• 支持手动刷新</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 注意事项 */}
        <div className='mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700'>
          <h3 className='font-semibold text-yellow-800 dark:text-yellow-200 mb-2'>
            ⚠️ 注意事项
          </h3>
          <ul className='text-sm text-yellow-700 dark:text-yellow-300 space-y-1'>
            <li>• 确保 TVBox 设备能够访问您的 LunaTV 服务器</li>
            <li>• 建议使用 HTTPS 协议确保安全性</li>
            <li>• 配置修改后即时生效，无需等待缓存刷新</li>
            <li>• 解析效果取决于原始视频源的可用性</li>
            {securityConfig?.enableAuth && (
              <li>• 配置链接包含访问token，请勿泄露给他人</li>
            )}
            {securityConfig?.enableIpWhitelist && (
              <li>• IP白名单限制下，只有授权IP可以访问配置</li>
            )}
            {securityConfig?.enableRateLimit && (
              <li>• 频率限制可能影响频繁刷新，属于正常现象</li>
            )}
          </ul>
        </div>
      </div>
    </PageLayout>
  );
}
