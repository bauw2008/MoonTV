/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import {
  AlertCircle,
  CheckCircle,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  Heart,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { AdminConfig } from '@/lib/admin.types';
import {
  addDeviceBinding,
  getCurrentDeviceFingerprint,
  removeDeviceBinding,
} from '@/lib/tvbox-device-fingerprint';

import { useAuth } from '@/components/auth/AuthProvider';

import { ToastManager } from './Toast';

// 智能健康检查结果
interface SmartHealthResult {
  success: boolean;
  timestamp: number;
  executionTime: number;
  network: {
    environment: 'domestic' | 'international';
    region: string;
    detectionMethod: string;
    optimized: boolean;
  };
  spider: {
    current: {
      success: boolean;
      source: string;
      size: number;
      md5: string;
      cached: boolean;
      tried_sources: number;
    };
    cached: any;
  };
  reachability: {
    total_tested: number;
    successful: number;
    health_score: number;
    tests: Array<{
      url: string;
      success: boolean;
      responseTime: number;
      statusCode?: number;
      error?: string;
      size?: number;
    }>;
  };
  recommendations: string[];
  status: {
    overall: 'excellent' | 'good' | 'needs_attention';
    spider_available: boolean;
    network_stable: boolean;
    recommendations_count: number;
  };
  error?: string;
}

// JAR源修复结果
interface JarFixResult {
  success: boolean;
  timestamp: number;
  executionTime: number;
  summary: {
    total_tested: number;
    successful: number;
    failed: number;
    user_region: 'domestic' | 'international';
    avg_response_time: number;
  };
  test_results: Array<{
    url: string;
    name: string;
    success: boolean;
    responseTime: number;
    size?: number;
    error?: string;
    statusCode?: number;
  }>;
  recommended_sources: Array<{
    url: string;
    name: string;
    success: boolean;
    responseTime: number;
    size?: number;
  }>;
  recommendations: {
    immediate: string[];
    configuration: string[];
    troubleshooting: string[];
  };
  fixed_config_urls: string[];
  status: {
    jar_available: boolean;
    network_quality: 'good' | 'fair' | 'poor';
    needs_troubleshooting: boolean;
  };
  error?: string;
  emergency_recommendations?: string[];
}

interface TVBoxSecurityConfigProps {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}

const TVBoxSecurityConfig = ({
  config,
  refreshConfig,
}: TVBoxSecurityConfigProps) => {
  const [isLoading, setIsLoading] = useState(false);

  // 生成随机Token
  function generateToken() {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  const [securitySettings, setSecuritySettings] = useState({
    enableRateLimit: false,
    rateLimit: 60,
    enableDeviceBinding: false,
    maxDevices: 1,
    enableUserAgentWhitelist: false,
    allowedUserAgents: [
      'okHttp/Mod-1.4.0.0',
      'TVBox',
      'OKHTTP',
      'Dalvik',
      'Java',
    ] as string[],
    defaultUserGroup: '',
    currentDevices: [] as Array<{
      deviceId: string;
      deviceInfo: string;
      bindTime: number;
    }>,
    // 用户Token管理
    userTokens: [
      {
        username: 'admin',
        token: generateToken(),
        enabled: true,
        devices: [] as Array<{
          deviceId: string;
          deviceInfo: string;
          bindTime: number;
        }>,
      },
    ],
  });

  const [newUAName, setNewUAName] = useState('');
  const [newUAValue, setNewUAValue] = useState('');
  const [showUAList, setShowUAList] = useState(false);

  // 添加User-Agent白名单
  const handleAddUserAgent = () => {
    if (!newUAValue.trim()) {
      ToastManager.error('请输入User-Agent值');
      return;
    }

    const currentUAs = securitySettings.allowedUserAgents || [];
    if (currentUAs.includes(newUAValue.trim())) {
      ToastManager.error('该User-Agent已存在');
      return;
    }

    const updatedUAs = [...currentUAs, newUAValue.trim()];
    setSecuritySettings({
      ...securitySettings,
      allowedUserAgents: updatedUAs,
    });

    setNewUAName('');
    setNewUAValue('');
    ToastManager.success('User-Agent已添加到白名单');
  };

  // 删除User-Agent白名单
  const handleDeleteUserAgent = (index: number) => {
    const updatedUAs = [...(securitySettings.allowedUserAgents || [])];
    updatedUAs.splice(index, 1);
    setSecuritySettings({
      ...securitySettings,
      allowedUserAgents: updatedUAs,
    });
    ToastManager.success('User-Agent已从白名单移除');
  };

  // 获取User-Agent显示名称
  const getUAName = (ua: string) => {
    const knownUAs: { [key: string]: string } = {
      'okHttp/Mod-1.4.0.0': 'TVBox Mod客户端',
      TVBox: 'TVBox标准客户端',
      OKHTTP: 'OKHTTP客户端',
      Dalvik: 'Android应用',
      Java: 'Java客户端',
    };

    // 精确匹配
    if (knownUAs[ua]) {
      return knownUAs[ua];
    }

    // 部分匹配
    for (const [key, name] of Object.entries(knownUAs)) {
      if (ua.toLowerCase().includes(key.toLowerCase())) {
        return name;
      }
    }

    // 自定义名称或使用UA值
    return ua.length > 20 ? ua.substring(0, 20) + '...' : ua;
  };
  const [showToken, setShowToken] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState<any>(null);
  const [showDiagnoseResult, setShowDiagnoseResult] = useState(false);
  const [configMode, setConfigMode] = useState<
    'standard' | 'safe' | 'fast' | 'yingshicang'
  >('standard');
  const [format, setFormat] = useState<'json' | 'base64'>('json');
  const [refreshingJar, setRefreshingJar] = useState(false);
  const [jarRefreshMsg, setJarRefreshMsg] = useState<string | null>(null);

  // 智能健康检查状态
  const [smartHealthResult, setSmartHealthResult] =
    useState<SmartHealthResult | null>(null);
  const [smartHealthLoading, setSmartHealthLoading] = useState(false);

  // JAR源修复状态
  const [jarFixResult, setJarFixResult] = useState<JarFixResult | null>(null);
  const [jarFixLoading, setJarFixLoading] = useState(false);

  // 获取当前用户信息
  const { state } = useAuth();
  const currentUsername = state.user?.username;

  // 从config加载设置
  useEffect(() => {
    if (config?.TVBoxSecurityConfig) {
      console.log('[TVBoxSecurity] 加载配置:', {
        enableDeviceBinding: config.TVBoxSecurityConfig.enableDeviceBinding,
        maxDevices: config.TVBoxSecurityConfig.maxDevices,
        userTokens: config.TVBoxSecurityConfig.userTokens?.map((t) => ({
          username: t.username,
          enabled: t.enabled,
          devicesCount: t.devices?.length || 0,
        })),
        fullUserTokens: config.TVBoxSecurityConfig.userTokens,
      });

      // 获取当前用户名
      // currentUsername 已在组件顶部定义

      // 确保当前用户的Token存在
      let userTokens = config.TVBoxSecurityConfig.userTokens || [];
      if (
        currentUsername &&
        !userTokens.find((t) => t.username === currentUsername)
      ) {
        userTokens = [
          {
            username: currentUsername,
            token: generateToken(),
            enabled: true,
            devices: [],
          },
          ...userTokens,
        ];
      }

      setSecuritySettings({
        enableRateLimit: config.TVBoxSecurityConfig.enableRateLimit ?? false,
        rateLimit: config.TVBoxSecurityConfig.rateLimit ?? 60,
        enableDeviceBinding:
          config.TVBoxSecurityConfig.enableDeviceBinding ?? false,
        maxDevices: config.TVBoxSecurityConfig.maxDevices ?? 1,
        enableUserAgentWhitelist:
          config.TVBoxSecurityConfig.enableUserAgentWhitelist ?? false,
        allowedUserAgents: config.TVBoxSecurityConfig.allowedUserAgents || [
          'okHttp/Mod-1.4.0.0',
          'TVBox',
          'OKHTTP',
          'Dalvik',
          'Java',
        ],
        defaultUserGroup: config.TVBoxSecurityConfig.defaultUserGroup || '',
        currentDevices: config.TVBoxSecurityConfig.currentDevices || [],
        userTokens: userTokens,
      });
    }
  }, [config]);

  // 保存配置
  const handleSave = async () => {
    setIsLoading(true);

    try {
      if (securitySettings.rateLimit < 1 || securitySettings.rateLimit > 1000) {
        ToastManager.error('频率限制应在1-1000之间');
        return;
      }

      // 构建保存的数据结构
      const saveData = {
        enableAuth: false, // 不再使用单独的Token验证，整合到设备绑定中
        token: '', // 不再使用全局token，使用用户级别Token
        enableRateLimit: securitySettings.enableRateLimit,
        rateLimit: securitySettings.rateLimit,
        enableDeviceBinding: securitySettings.enableDeviceBinding,
        maxDevices: securitySettings.maxDevices,
        enableUserAgentWhitelist: securitySettings.enableUserAgentWhitelist,
        allowedUserAgents: securitySettings.allowedUserAgents,
        currentDevices: securitySettings.userTokens.flatMap(
          (user) => user.devices,
        ),
        userTokens: securitySettings.userTokens,
      };

      console.log(
        '[TVBoxSecurity] 保存配置，用户Tokens:',
        securitySettings.userTokens.map((t) => ({
          username: t.username,
          token: t.token.substring(0, 8) + '...',
        })),
      );
      const response = await fetch('/api/admin/tvbox-security', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(saveData),
      });

      ToastManager.success('TVBox安全配置保存成功！');
      await refreshConfig();
    } catch (error) {
      ToastManager.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 复制Token（单个用户）
  const copyUserToken = (token: string) => {
    navigator.clipboard.writeText(token);
    ToastManager.success('Token已复制到剪贴板');
  };

  // 生成URL示例
  const generateExampleURL = () => {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams();

    params.append('format', format);

    // 如果启用了Token和设备绑定，自动添加token参数（使用当前用户的token）
    if (
      securitySettings.enableDeviceBinding &&
      securitySettings.userTokens.length > 0
    ) {
      // currentUsername 已在组件顶部定义
      if (currentUsername) {
        const userToken = securitySettings.userTokens.find(
          (t) => t.username === currentUsername && t.enabled,
        );
        if (userToken && userToken.token) {
          params.append('token', userToken.token);
        }
      }
    }

    // 添加配置模式参数
    if (configMode !== 'standard') {
      params.append('mode', configMode);
    }

    return `${baseUrl}/api/tvbox?${params.toString()}`;
  };

  // 诊断配置
  const handleDiagnose = async () => {
    setIsDiagnosing(true);
    setDiagnoseResult(null);

    try {
      // 如果启用了Token和设备绑定，传递当前用户的token进行诊断
      let diagnoseUrl = '/api/tvbox/diagnose';
      if (
        securitySettings.enableDeviceBinding &&
        securitySettings.userTokens.length > 0
      ) {
        // currentUsername 已在组件顶部定义
        if (currentUsername) {
          const userToken = securitySettings.userTokens.find(
            (t) => t.username === currentUsername && t.enabled,
          );
          if (userToken) {
            diagnoseUrl += `?token=${encodeURIComponent(userToken.token)}`;
          }
        }
      }

      console.log('[Diagnose] Frontend - Calling URL:', diagnoseUrl);

      const response = await fetch(diagnoseUrl);
      const result = await response.json();

      setDiagnoseResult(result);
      setShowDiagnoseResult(true);

      if (result.pass) {
        ToastManager.success('配置诊断通过！所有检查项正常');
      } else {
        ToastManager.error(`发现 ${result.issues?.length || 0} 个问题`);
      }
    } catch (error) {
      ToastManager.error(
        '诊断失败：' + (error instanceof Error ? error.message : '未知错误'),
      );
    } finally {
      setIsDiagnosing(false);
    }
  };

  // 关闭诊断结果
  const handleCloseDiagnoseResult = () => {
    setShowDiagnoseResult(false);
  };

  // 测试访问时关闭诊断结果
  const handleTestAccess = () => {
    setShowDiagnoseResult(false);
    window.open(generateExampleURL(), '_blank');
  };

  // 刷新JAR缓存
  const handleRefreshJar = async () => {
    setRefreshingJar(true);
    setJarRefreshMsg(null);
    try {
      const response = await fetch('/api/tvbox/spider-status', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        setJarRefreshMsg(
          `✓ JAR 缓存已刷新 (${data.jar_status.source.split('/').pop()})`,
        );
        // 如果当前有诊断结果，重新诊断
        if (diagnoseResult) {
          setTimeout(() => handleDiagnose(), 500);
        }
      } else {
        setJarRefreshMsg(`✗ 刷新失败: ${data.error}`);
      }
    } catch (error) {
      setJarRefreshMsg('✗ 刷新失败，请稍后重试');
    } finally {
      setRefreshingJar(false);
      setTimeout(() => setJarRefreshMsg(null), 5000);
    }
  };

  // 智能健康检查
  const handleSmartHealthCheck = async () => {
    setSmartHealthLoading(true);
    setSmartHealthResult(null);
    try {
      const response = await fetch('/api/tvbox/smart-health');
      const data = await response.json();
      setSmartHealthResult(data);
    } catch (error) {
      setSmartHealthResult({
        success: false,
        error: '智能健康检查失败，请稍后重试',
      } as SmartHealthResult);
    } finally {
      setSmartHealthLoading(false);
    }
  };

  // JAR源修复诊断
  const handleJarFix = async () => {
    setJarFixLoading(true);
    setJarFixResult(null);
    try {
      const response = await fetch('/api/tvbox/jar-fix');
      const data = await response.json();
      setJarFixResult(data);
    } catch (error) {
      setJarFixResult({
        success: false,
        error: 'JAR源修复诊断失败，请稍后重试',
      } as JarFixResult);
    } finally {
      setJarFixLoading(false);
    }
  };

  // 测试设备绑定
  const handleTestDeviceBinding = async () => {
    if (!securitySettings.enableDeviceBinding) {
      ToastManager.error('请先启用设备绑定功能');
      return;
    }

    // 获取当前用户信息
    // currentUsername 已在组件顶部定义
    if (!currentUsername) {
      ToastManager.error('无法获取当前用户信息');
      return;
    }

    // 生成当前设备的指纹，使用当前登录用户
    // 使用与后端一致的设备ID生成方式（基于User-Agent）
    const currentDevice = getCurrentDeviceFingerprint(
      undefined, // 不使用IP，因为后端主要基于User-Agent
      currentUsername,
    );

    // 添加前端调试日志
    console.log('[TVBoxSecurity] 前端设备绑定调试信息:', {
      currentUsername,
      deviceId: currentDevice.deviceId,
      deviceInfo: currentDevice.deviceInfo,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
    });

    // 找到当前用户的Token配置
    const currentUserToken = securitySettings.userTokens.find(
      (t) => t.username === currentUsername,
    );

    if (!currentUserToken) {
      ToastManager.error('当前用户没有Token配置');
      return;
    }

    // 检查是否已绑定
    const userDevices = currentUserToken.devices || [];
    const isAlreadyBound = userDevices.some(
      (device) => device.deviceId === currentDevice.deviceId,
    );

    if (isAlreadyBound) {
      ToastManager.success('当前设备已绑定');
      return;
    }

    // 添加新设备绑定
    const updatedDevices = addDeviceBinding(
      userDevices,
      currentDevice,
      securitySettings.maxDevices,
    );

    // 更新用户Token配置中的设备列表
    const updatedUserTokens = securitySettings.userTokens.map((t) => {
      if (t.username === currentUsername) {
        return {
          ...t,
          devices: updatedDevices,
        };
      }
      return t;
    });

    // 更新本地状态
    setSecuritySettings((prev) => ({
      ...prev,
      userTokens: updatedUserTokens,
    }));

    // 保存到服务器
    try {
      const saveData = {
        enableAuth: false,
        token: '',
        enableRateLimit: securitySettings.enableRateLimit,
        rateLimit: securitySettings.rateLimit,
        enableDeviceBinding: securitySettings.enableDeviceBinding,
        maxDevices: securitySettings.maxDevices,
        enableUserAgentWhitelist: securitySettings.enableUserAgentWhitelist,
        allowedUserAgents: securitySettings.allowedUserAgents,
        currentDevices: updatedUserTokens.flatMap((user) => user.devices),
        userTokens: updatedUserTokens,
      };

      const response = await fetch('/api/admin/tvbox-security', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(saveData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '保存失败');
      }

      if (updatedDevices.length > userDevices.length) {
        ToastManager.success('设备绑定成功并已保存');
      } else {
        ToastManager.error('设备已替换，已达到最大设备数量限制');
      }

      // 重新加载配置以显示最新的设备绑定信息
      await refreshConfig();
    } catch (error) {
      ToastManager.error(
        error instanceof Error ? error.message : '设备绑定保存失败',
      );
      // 如果保存失败，回滚本地状态
      setSecuritySettings((prev) => ({
        ...prev,
        userTokens: securitySettings.userTokens,
      }));
    }
  };

  return (
    <div className='bg-transparent dark:bg-transparent rounded-lg p-6'>
      <div className='space-y-6'>
        {/* 频率限制 */}
        <div className='border border-gray-200 dark:border-gray-700 rounded-lg p-4'>
          <div className='flex items-center justify-between mb-4'>
            <div>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                访问频率限制
              </h3>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                限制每个IP每分钟的访问次数，防止滥用
              </p>
            </div>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={securitySettings.enableRateLimit}
                onChange={(e) =>
                  setSecuritySettings((prev) => ({
                    ...prev,
                    enableRateLimit: e.target.checked,
                  }))
                }
                className='sr-only peer'
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {securitySettings.enableRateLimit && (
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                每分钟请求次数限制
              </label>
              <input
                type='number'
                min='1'
                max='1000'
                value={securitySettings.rateLimit}
                onChange={(e) =>
                  setSecuritySettings((prev) => ({
                    ...prev,
                    rateLimit: parseInt(e.target.value) || 60,
                  }))
                }
                className='w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              />
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                建议设置30-60次，过低可能影响正常使用
              </p>
            </div>
          )}
        </div>

        {/* User-Agent白名单 */}
        <div className='border border-gray-200 dark:border-gray-700 rounded-lg p-4'>
          <div className='flex items-center justify-between mb-4'>
            <div>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2'>
                <Globe className='w-5 h-5' />
                User-Agent白名单
              </h3>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                限制只有特定User-Agent的客户端才能访问TVBox API
              </p>
            </div>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={securitySettings.enableUserAgentWhitelist}
                onChange={(e) =>
                  setSecuritySettings((prev) => ({
                    ...prev,
                    enableUserAgentWhitelist: e.target.checked,
                  }))
                }
                className='sr-only peer'
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {securitySettings.enableUserAgentWhitelist && (
            <div className='space-y-4'>
              {/* 添加白名单 */}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  添加白名单规则
                </label>
                <div className='flex gap-2'>
                  <input
                    type='text'
                    value={newUAName}
                    onChange={(e) => setNewUAName(e.target.value)}
                    placeholder='名称（可选）'
                    className='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                  />
                  <input
                    type='text'
                    value={newUAValue}
                    onChange={(e) => setNewUAValue(e.target.value)}
                    placeholder='User-Agent值（如：okHttp/Mod-1.4.0.0）'
                    className='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                  />
                  <button
                    onClick={handleAddUserAgent}
                    className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2'
                  >
                    <CheckCircle className='w-4 h-4' />
                    添加
                  </button>
                </div>
                <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                  支持部分匹配，如输入"okHttp"将匹配所有包含该字符串的User-Agent
                </p>
              </div>

              {/* 白名单列表 */}
              <div>
                <div className='flex items-center justify-between mb-2'>
                  <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    当前白名单
                  </label>
                  <button
                    onClick={() => setShowUAList(!showUAList)}
                    className='text-xs px-3 py-1 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded transition-colors'
                  >
                    {showUAList ? '隐藏' : '显示'} (
                    {securitySettings.allowedUserAgents?.length || 0})
                  </button>
                </div>

                {showUAList && (
                  <div className='space-y-2'>
                    {securitySettings.allowedUserAgents?.map(
                      (ua: string, index: number) => (
                        <div
                          key={index}
                          className='flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg'
                        >
                          <div className='flex-1'>
                            <div className='font-medium text-gray-900 dark:text-gray-100'>
                              {getUAName(ua)}
                            </div>
                            <code className='text-xs text-gray-600 dark:text-gray-400'>
                              {ua}
                            </code>
                          </div>
                          <button
                            onClick={() => handleDeleteUserAgent(index)}
                            className='ml-3 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors'
                          >
                            <XCircle className='w-4 h-4' />
                          </button>
                        </div>
                      ),
                    )}
                    {(!securitySettings.allowedUserAgents ||
                      securitySettings.allowedUserAgents.length === 0) && (
                      <div className='text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg'>
                        暂无白名单规则
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Token和设备管理 */}
        <div className='border border-gray-200 dark:border-gray-700 rounded-lg p-4'>
          <div className='flex items-center justify-between mb-4'>
            <div>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                用户Token验证和绑定
              </h3>
            </div>
            <label className='relative inline-flex items-center cursor-pointer'>
              <input
                type='checkbox'
                checked={securitySettings.enableDeviceBinding}
                onChange={(e) =>
                  setSecuritySettings((prev) => ({
                    ...prev,
                    enableDeviceBinding: e.target.checked,
                  }))
                }
                className='sr-only peer'
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {securitySettings.enableDeviceBinding && (
            <div className='space-y-4'>
              {/* 最大设备数量设置 */}
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                  设备绑定数量限制
                </label>
                <div className='flex items-center gap-3'>
                  <input
                    type='number'
                    min='1'
                    max='100'
                    value={securitySettings.maxDevices}
                    onChange={(e) =>
                      setSecuritySettings((prev) => ({
                        ...prev,
                        maxDevices: parseInt(e.target.value) || 1,
                      }))
                    }
                    className='w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm'
                  />
                  <span className='text-sm text-gray-600 dark:text-gray-400'>
                    台设备
                  </span>
                </div>
              </div>

              {/* 用户Token管理 - 表格模式 */}
              <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4'>
                <div className='flex items-center justify-between mb-4'>
                  <h4 className='text-sm font-medium text-blue-900 dark:text-blue-300'>
                    用户Token管理
                  </h4>
                  <div className='flex items-center gap-3'>
                    <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'>
                      {securitySettings.userTokens.length} 个用户
                    </span>
                    <button
                      onClick={() => setShowToken(!showToken)}
                      className='text-xs px-3 py-1 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded transition-colors'
                    >
                      {showToken ? '隐藏Token' : '显示Token'}
                    </button>
                  </div>
                </div>

                <div className='overflow-x-auto'>
                  <table className='w-full text-sm'>
                    <thead>
                      <tr className='border-b border-blue-200 dark:border-blue-700'>
                        <th className='text-left py-3 px-4 text-blue-900 dark:text-blue-300 font-medium'>
                          用户名
                        </th>
                        <th className='text-left py-3 px-4 text-blue-900 dark:text-blue-300 font-medium'>
                          设备数量
                        </th>
                        <th className='text-left py-3 px-4 text-blue-900 dark:text-blue-300 font-medium'>
                          Token
                        </th>
                        <th className='text-left py-3 px-4 text-blue-900 dark:text-blue-300 font-medium'>
                          状态
                        </th>
                        <th className='text-left py-3 px-4 text-blue-900 dark:text-blue-300 font-medium'>
                          功能
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {securitySettings.userTokens.map((userToken) => (
                        <tr
                          key={userToken.username}
                          className='border-b border-blue-100 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors'
                        >
                          <td className='py-3 px-4'>
                            <div className='flex items-center gap-2'>
                              <span className='font-medium text-blue-900 dark:text-blue-300'>
                                {userToken.username}
                              </span>
                              {userToken.username === process.env.USERNAME && (
                                <span className='inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'>
                                  站长
                                </span>
                              )}
                            </div>
                          </td>
                          <td className='py-3 px-4'>
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                userToken.devices.length >=
                                securitySettings.maxDevices
                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                                  : userToken.devices.length === 0
                                    ? 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
                                    : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                              }`}
                            >
                              {userToken.devices.length}/
                              {securitySettings.maxDevices}
                            </span>
                          </td>
                          <td className='py-3 px-4'>
                            <div className='flex items-center gap-2'>
                              <code
                                className={`font-mono text-xs ${
                                  showToken
                                    ? 'text-gray-900 dark:text-gray-100'
                                    : 'text-gray-500 dark:text-gray-400'
                                }`}
                              >
                                {showToken
                                  ? userToken.token
                                  : '••••••••••••••••••••••••••••••••'}
                              </code>
                              <button
                                onClick={() => copyUserToken(userToken.token)}
                                className='p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors'
                                title='复制Token'
                              >
                                <Copy className='w-3 h-3' />
                              </button>
                            </div>
                          </td>
                          <td className='py-3 px-4'>
                            <div className='flex items-center gap-2'>
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  userToken.enabled
                                    ? 'bg-green-500'
                                    : 'bg-red-500'
                                }`}
                              ></div>
                              <span
                                className={`text-xs ${
                                  userToken.enabled
                                    ? 'text-green-700 dark:text-green-400'
                                    : 'text-red-700 dark:text-red-400'
                                }`}
                              >
                                {userToken.enabled ? '已启用' : '已禁用'}
                              </span>
                            </div>
                          </td>
                          <td className='py-3 px-4'>
                            <div className='flex items-center gap-1'>
                              <button
                                onClick={() => {
                                  const newTokens =
                                    securitySettings.userTokens.map((t) =>
                                      t.username === userToken.username
                                        ? { ...t, token: generateToken() }
                                        : t,
                                    );
                                  setSecuritySettings((prev) => ({
                                    ...prev,
                                    userTokens: newTokens,
                                  }));
                                  ToastManager.success(
                                    `${userToken.username}的Token已重新生成`,
                                  );
                                }}
                                className='text-xs px-2 py-1 bg-green-100 hover:bg-green-200 dark:bg-green-800 dark:hover:bg-green-700 text-green-700 dark:text-green-300 rounded transition-colors'
                                title='重新生成Token'
                              >
                                重新生成
                              </button>
                              <button
                                onClick={() => {
                                  const updatedTokens =
                                    securitySettings.userTokens.map((user) =>
                                      user.username === userToken.username
                                        ? { ...user, enabled: !user.enabled }
                                        : user,
                                    );
                                  setSecuritySettings((prev) => ({
                                    ...prev,
                                    userTokens: updatedTokens,
                                  }));
                                  ToastManager.success(
                                    `${userToken.username}的Token已${
                                      userToken.enabled ? '禁用' : '启用'
                                    }`,
                                  );
                                }}
                                className={`text-xs px-2 py-1 rounded transition-colors ${
                                  userToken.enabled
                                    ? 'bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-800 dark:hover:bg-yellow-700 text-yellow-700 dark:text-yellow-300'
                                    : 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-800 dark:hover:bg-blue-700 text-blue-700 dark:text-blue-300'
                                }`}
                                title={
                                  userToken.enabled ? '禁用Token' : '启用Token'
                                }
                              >
                                {userToken.enabled ? '禁用' : '启用'}
                              </button>
                              <button
                                onClick={() => {
                                  // 解绑最旧的设备
                                  if (userToken.devices.length === 0) {
                                    ToastManager.warning('没有已绑定的设备');
                                    return;
                                  }

                                  // 按绑定时间排序，解绑最旧的设备
                                  const sortedDevices = [
                                    ...userToken.devices,
                                  ].sort((a, b) => a.bindTime - b.bindTime);
                                  const oldestDevice = sortedDevices[0];

                                  const updatedTokens =
                                    securitySettings.userTokens.map((t) =>
                                      t.username === userToken.username
                                        ? {
                                            ...t,
                                            devices: t.devices.filter(
                                              (d) =>
                                                d.deviceId !==
                                                oldestDevice.deviceId,
                                            ),
                                          }
                                        : t,
                                    );
                                  setSecuritySettings((prev) => ({
                                    ...prev,
                                    userTokens: updatedTokens,
                                  }));
                                  ToastManager.success(
                                    `已解绑设备: ${oldestDevice.deviceInfo}`,
                                  );
                                }}
                                className='text-xs px-2 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 text-red-700 dark:text-red-300 rounded transition-colors'
                                title='解绑最旧的设备'
                              >
                                解绑设备
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {securitySettings.userTokens.length === 0 && (
                  <div className='text-center py-8 text-blue-700 dark:text-blue-400'>
                    <svg
                      className='w-12 h-12 mx-auto mb-3 text-blue-400 dark:text-blue-500'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M12 4v16m8-8H4'
                      />
                    </svg>
                    <p className='text-sm'>暂无用户Token</p>
                    <p className='text-xs mt-1'>系统会自动为用户生成Token</p>
                  </div>
                )}
              </div>

              {/* 绑定设备列表 */}
              <div className='bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4'>
                <div className='flex items-center justify-between mb-4'>
                  <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                    绑定设备列表
                  </h4>
                  <div className='flex items-center gap-2'>
                    <span className='text-xs text-gray-500 dark:text-gray-400'>
                      {securitySettings.userTokens.reduce(
                        (total, user) => total + user.devices.length,
                        0,
                      )}{' '}
                      台设备
                    </span>
                    {securitySettings.userTokens.some(
                      (user) => user.devices.length > 0,
                    ) && (
                      <button
                        onClick={async () => {
                          // 更新本地状态
                          const clearedTokens = securitySettings.userTokens.map(
                            (user) => ({
                              ...user,
                              devices: [],
                            }),
                          );
                          setSecuritySettings((prev) => ({
                            ...prev,
                            userTokens: clearedTokens,
                          }));

                          // 保存到服务器
                          try {
                            const saveData = {
                              enableAuth: false,
                              token: '',
                              enableRateLimit: securitySettings.enableRateLimit,
                              rateLimit: securitySettings.rateLimit,
                              enableDeviceBinding:
                                securitySettings.enableDeviceBinding,
                              maxDevices: securitySettings.maxDevices,
                              enableUserAgentWhitelist:
                                securitySettings.enableUserAgentWhitelist,
                              allowedUserAgents:
                                securitySettings.allowedUserAgents,
                              currentDevices: [], // 清空所有设备
                              userTokens: clearedTokens,
                            };

                            const response = await fetch(
                              '/api/admin/tvbox-security',
                              {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify(saveData),
                              },
                            );

                            if (!response.ok) {
                              const errorData = await response.json();
                              throw new Error(errorData.error || '保存失败');
                            }

                            ToastManager.success('所有设备已清空');
                            // 等待一小段时间确保服务器端保存完成，然后重新加载配置
                            await new Promise((resolve) =>
                              setTimeout(resolve, 100),
                            );
                            await refreshConfig();
                          } catch (error) {
                            ToastManager.error(
                              error instanceof Error
                                ? error.message
                                : '清空设备失败',
                            );
                            // 如果保存失败，回滚本地状态
                            setSecuritySettings((prev) => ({
                              ...prev,
                              userTokens: securitySettings.userTokens,
                            }));
                          }
                        }}
                        className='text-xs px-3 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 text-red-700 dark:text-red-300 rounded transition-colors'
                      >
                        清空所有
                      </button>
                    )}
                  </div>
                </div>

                {securitySettings.userTokens.some(
                  (user) => user.devices.length > 0,
                ) ? (
                  <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                      <thead>
                        <tr className='border-b border-gray-200 dark:border-gray-600'>
                          <th className='text-left py-3 px-4 text-gray-600 dark:text-gray-400 font-medium'>
                            设备ID
                          </th>
                          <th className='text-left py-3 px-4 text-gray-600 dark:text-gray-400 font-medium'>
                            设备信息
                          </th>
                          <th className='text-left py-3 px-4 text-gray-600 dark:text-gray-400 font-medium'>
                            绑定时间
                          </th>
                          <th className='text-left py-3 px-4 text-gray-600 dark:text-gray-400 font-medium'>
                            用户
                          </th>
                          <th className='text-left py-3 px-4 text-gray-600 dark:text-gray-400 font-medium'>
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {securitySettings.userTokens.flatMap((userToken) =>
                          userToken.devices.map((device) => (
                            <tr
                              key={`${userToken.username}-${device.deviceId}`}
                              className='border-b border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors'
                            >
                              <td className='py-3 px-4'>
                                <code className='text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded'>
                                  {device.deviceId.substring(0, 8)}...
                                </code>
                              </td>
                              <td className='py-3 px-4 text-gray-700 dark:text-gray-300 max-w-xs'>
                                <div
                                  className='truncate'
                                  title={device.deviceInfo}
                                >
                                  {device.deviceInfo}
                                </div>
                              </td>
                              <td className='py-3 px-4 text-gray-600 dark:text-gray-400 whitespace-nowrap'>
                                {new Date(device.bindTime).toLocaleString(
                                  'zh-CN',
                                )}
                              </td>
                              <td className='py-3 px-4'>
                                <span className='inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'>
                                  {userToken.username}
                                </span>
                              </td>
                              <td className='py-3 px-4'>
                                <div className='flex items-center gap-1'>
                                  <button
                                    onClick={async () => {
                                      // 更新本地状态
                                      const updatedTokens =
                                        securitySettings.userTokens.map(
                                          (user) =>
                                            user.username === userToken.username
                                              ? {
                                                  ...user,
                                                  devices: removeDeviceBinding(
                                                    user.devices,
                                                    device.deviceId,
                                                  ),
                                                }
                                              : user,
                                        );
                                      setSecuritySettings((prev) => ({
                                        ...prev,
                                        userTokens: updatedTokens,
                                      }));

                                      // 保存到服务器
                                      try {
                                        const saveData = {
                                          enableAuth: false,
                                          token: '',
                                          enableRateLimit:
                                            securitySettings.enableRateLimit,
                                          rateLimit: securitySettings.rateLimit,
                                          enableDeviceBinding:
                                            securitySettings.enableDeviceBinding,
                                          maxDevices:
                                            securitySettings.maxDevices,
                                          enableUserAgentWhitelist:
                                            securitySettings.enableUserAgentWhitelist,
                                          allowedUserAgents:
                                            securitySettings.allowedUserAgents,
                                          currentDevices: updatedTokens.flatMap(
                                            (user) => user.devices,
                                          ),
                                          userTokens: updatedTokens,
                                        };

                                        console.log(
                                          '[TVBoxSecurity] 发送清空设备请求到服务器:',
                                          saveData,
                                        );
                                        const response = await fetch(
                                          '/api/admin/tvbox-security',
                                          {
                                            method: 'POST',
                                            headers: {
                                              'Content-Type':
                                                'application/json',
                                            },
                                            body: JSON.stringify(saveData),
                                          },
                                        );

                                        console.log(
                                          '[TVBoxSecurity] 服务器响应状态:',
                                          response.status,
                                        );
                                        if (!response.ok) {
                                          const errorData =
                                            await response.json();
                                          console.error(
                                            '[TVBoxSecurity] 服务器返回错误:',
                                            errorData,
                                          );
                                          throw new Error(
                                            errorData.error || '保存失败',
                                          );
                                        }

                                        const responseData =
                                          await response.json();
                                        console.log(
                                          '[TVBoxSecurity] 服务器响应数据:',
                                          responseData,
                                        );

                                        ToastManager.success('设备解绑成功');
                                        // 等待一小段时间确保服务器端保存完成，然后重新加载配置
                                        await new Promise((resolve) =>
                                          setTimeout(resolve, 100),
                                        );
                                        await refreshConfig();
                                      } catch (error) {
                                        ToastManager.error(
                                          error instanceof Error
                                            ? error.message
                                            : '设备解绑失败',
                                        );
                                        // 如果保存失败，回滚本地状态
                                        setSecuritySettings((prev) => ({
                                          ...prev,
                                          userTokens:
                                            securitySettings.userTokens,
                                        }));
                                      }
                                    }}
                                    className='text-xs px-2 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 text-red-700 dark:text-red-300 rounded transition-colors'
                                    title='解绑设备'
                                  >
                                    解绑
                                  </button>
                                  <button
                                    onClick={() => {
                                      const updatedTokens =
                                        securitySettings.userTokens.map(
                                          (user) =>
                                            user.username === userToken.username
                                              ? {
                                                  ...user,
                                                  enabled: !user.enabled,
                                                }
                                              : user,
                                        );
                                      setSecuritySettings((prev) => ({
                                        ...prev,
                                        userTokens: updatedTokens,
                                      }));
                                      ToastManager.success(
                                        `${userToken.username}的Token已${
                                          userToken.enabled ? '禁用' : '启用'
                                        }`,
                                      );
                                    }}
                                    className={`text-xs px-2 py-1 rounded transition-colors ${
                                      userToken.enabled
                                        ? 'bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-800 dark:hover:bg-yellow-700 text-yellow-700 dark:text-yellow-300'
                                        : 'bg-green-100 hover:bg-green-200 dark:bg-green-800 dark:hover:bg-green-700 text-green-700 dark:text-green-300'
                                    }`}
                                    title={
                                      userToken.enabled
                                        ? '禁用Token'
                                        : '启用Token'
                                    }
                                  >
                                    {userToken.enabled ? '禁用' : '启用'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )),
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
                    <svg
                      className='w-12 h-12 mx-auto mb-3 text-gray-400'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M12 4v16m8-8H4'
                      />
                    </svg>
                    <p className='text-sm'>暂无绑定设备</p>
                    <p className='text-xs mt-1'>
                      当用户首次使用时，设备将自动绑定到对应Token
                    </p>
                  </div>
                )}
              </div>

              {/* 设备绑定说明 */}
              <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3'>
                <div className='flex items-start gap-2'>
                  <svg
                    className='w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                    />
                  </svg>
                  <div className='text-xs text-blue-700 dark:text-blue-300'>
                    <p className='font-medium mb-1'>Token设备绑定工作原理：</p>
                    <ul className='space-y-1'>
                      <li>• 每个用户拥有独立的Token，不同用户互不影响</li>
                      <li>
                        • 用户首次访问TVBox
                        API时，系统自动绑定设备指纹到对应Token
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 配置选项 */}
        <div className='border border-gray-200 dark:border-gray-700 rounded-lg p-4'>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4'>
            配置选项
          </h3>

          <div className='space-y-4'>
            {/* 格式选择 */}
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                配置格式
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

            {/* 配置模式 */}
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                配置模式
              </label>
              <div className='grid grid-cols-1 sm:grid-cols-4 gap-3'>
                <label className='flex items-center cursor-pointer p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors'>
                  <input
                    type='radio'
                    name='configMode'
                    value='standard'
                    checked={configMode === 'standard'}
                    onChange={(e) =>
                      setConfigMode(
                        e.target.value as
                          | 'standard'
                          | 'safe'
                          | 'fast'
                          | 'yingshicang',
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
                        e.target.value as
                          | 'standard'
                          | 'safe'
                          | 'fast'
                          | 'yingshicang',
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
                    value='fast'
                    checked={configMode === 'fast'}
                    onChange={(e) =>
                      setConfigMode(
                        e.target.value as
                          | 'standard'
                          | 'safe'
                          | 'fast'
                          | 'yingshicang',
                      )
                    }
                    className='mr-2 w-4 h-4 text-blue-600 focus:ring-blue-500'
                  />
                  <div className='text-sm'>
                    <span className='font-medium text-gray-900 dark:text-white block'>
                      快速模式
                    </span>
                    <span className='text-xs text-gray-500 dark:text-gray-400'>
                      优化体验
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
                        e.target.value as
                          | 'standard'
                          | 'safe'
                          | 'fast'
                          | 'yingshicang',
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
                    : configMode === 'fast'
                      ? '优化切换体验，移除可能导致卡顿的配置'
                      : '专为影视仓优化，包含播放规则和兼容性修复'}
              </p>
            </div>
          </div>
        </div>

        {/* URL示例 */}
        <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'>
          <h3 className='text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2'>
            TVBox配置URL
          </h3>
          <div className='space-y-2'>
            {/* URL显示区域 */}
            <div className='bg-white dark:bg-gray-800 px-3 py-2 rounded border'>
              <code className='block text-sm text-gray-900 dark:text-gray-100 break-all leading-relaxed'>
                {generateExampleURL()}
              </code>
            </div>

            {/* 操作按钮 */}
            <div className='flex flex-col sm:flex-row gap-2'>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generateExampleURL());
                  ToastManager.success('URL已复制到剪贴板');
                }}
                className='flex-1 sm:flex-none px-4 py-2 text-sm bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 text-blue-700 dark:text-blue-300 rounded-lg flex items-center justify-center gap-2 transition-colors'
              >
                <Copy className='h-4 w-4' />
                复制URL
              </button>
              <button
                onClick={handleTestAccess}
                className='flex-1 sm:flex-none px-4 py-2 text-sm bg-green-100 dark:bg-green-800 hover:bg-green-200 dark:hover:bg-green-700 text-green-700 dark:text-green-300 rounded-lg flex items-center justify-center gap-2 transition-colors'
              >
                <ExternalLink className='h-4 w-4' />
                测试访问
              </button>
              <button
                onClick={handleRefreshJar}
                disabled={refreshingJar}
                className='flex-1 sm:flex-none px-4 py-2 text-sm bg-yellow-100 dark:bg-yellow-800 hover:bg-yellow-200 dark:hover:bg-yellow-700 disabled:opacity-50 text-yellow-700 dark:text-yellow-300 rounded-lg flex items-center justify-center gap-2 transition-colors'
              >
                <svg
                  className='h-4 w-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                  />
                </svg>
                {refreshingJar ? '刷新中...' : '刷新 JAR'}
              </button>
              <button
                onClick={handleDiagnose}
                disabled={isDiagnosing}
                className='flex-1 sm:flex-none px-4 py-2 text-sm bg-purple-100 dark:bg-purple-800 hover:bg-purple-200 dark:hover:bg-purple-700 disabled:opacity-50 text-purple-700 dark:text-purple-300 rounded-lg flex items-center justify-center gap-2 transition-colors'
              >
                <svg
                  className='h-4 w-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                  />
                </svg>
                {isDiagnosing ? '诊断中...' : '诊断配置'}
              </button>
              <button
                onClick={handleSmartHealthCheck}
                disabled={smartHealthLoading}
                className='flex-1 sm:flex-none px-4 py-2 text-sm bg-green-100 dark:bg-green-800 hover:bg-green-200 dark:hover:bg-green-700 disabled:opacity-50 text-green-700 dark:text-green-300 rounded-lg flex items-center justify-center gap-2 transition-colors'
              >
                <Heart className='h-4 w-4' />
                {smartHealthLoading ? '检查中...' : '健康检查'}
              </button>
              <button
                onClick={handleJarFix}
                disabled={jarFixLoading}
                className='flex-1 sm:flex-none px-4 py-2 text-sm bg-orange-100 dark:bg-orange-800 hover:bg-orange-200 dark:hover:bg-orange-700 disabled:opacity-50 text-orange-700 dark:text-orange-300 rounded-lg flex items-center justify-center gap-2 transition-colors'
              >
                <Wrench className='h-4 w-4' />
                {jarFixLoading ? '诊断中...' : '源修复'}
              </button>
            </div>
          </div>

          {/* JAR 刷新消息 */}
          {jarRefreshMsg && (
            <div
              className={`mt-3 p-3 rounded-lg ${
                jarRefreshMsg.startsWith('✓')
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              }`}
            >
              {jarRefreshMsg}
            </div>
          )}

          <p className='text-xs text-blue-700 dark:text-blue-400 mt-3'>
            💡 在TVBox中导入此URL即可使用。配置模式已自动包含在URL中。
          </p>

          {/* JAR 刷新消息 */}
          {jarRefreshMsg && (
            <div
              className={`mt-3 p-3 rounded-lg ${
                jarRefreshMsg.startsWith('✓')
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              }`}
            >
              {jarRefreshMsg}
            </div>
          )}
        </div>

        {/* 智能健康检查结果 */}
        {smartHealthResult && (
          <div className='border border-blue-200 dark:border-blue-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-2'>
                <Heart className='w-5 h-5' />
                智能健康检查结果
              </h3>
              <button
                onClick={() => setSmartHealthResult(null)}
                className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              >
                <XCircle className='w-5 h-5' />
              </button>
            </div>

            {smartHealthResult.error ? (
              <div className='p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg'>
                <p className='text-red-700 dark:text-red-300'>
                  {smartHealthResult.error}
                </p>
              </div>
            ) : (
              <div className='space-y-4'>
                {/* 网络环境卡片 */}
                <div className='p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-700'>
                  <div className='flex items-center gap-2 mb-3'>
                    <Globe className='w-5 h-5 text-blue-600 dark:text-blue-400' />
                    <h4 className='font-semibold text-blue-900 dark:text-blue-300'>
                      网络环境
                    </h4>
                  </div>
                  <div className='grid grid-cols-2 gap-3 text-sm'>
                    <div>
                      <div className='text-blue-600 dark:text-blue-400 text-xs mb-1'>
                        环境类型
                      </div>
                      <div className='text-gray-900 dark:text-gray-100 font-medium'>
                        {smartHealthResult.network.environment === 'domestic'
                          ? '🏠 国内网络'
                          : '🌍 国际网络'}
                      </div>
                    </div>
                    <div>
                      <div className='text-blue-600 dark:text-blue-400 text-xs mb-1'>
                        地区
                      </div>
                      <div className='text-gray-900 dark:text-gray-100 font-medium'>
                        {smartHealthResult.network.region}
                      </div>
                    </div>
                    <div>
                      <div className='text-blue-600 dark:text-blue-400 text-xs mb-1'>
                        检测方式
                      </div>
                      <div className='text-gray-900 dark:text-gray-100 font-mono text-xs'>
                        {smartHealthResult.network.detectionMethod}
                      </div>
                    </div>
                    <div>
                      <div className='text-blue-600 dark:text-blue-400 text-xs mb-1'>
                        优化状态
                      </div>
                      <div className='text-green-600 dark:text-green-400 font-medium'>
                        {smartHealthResult.network.optimized
                          ? '✓ 已优化'
                          : '○ 未优化'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 健康分数卡片 */}
                <div className='p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-700'>
                  <div className='flex items-center justify-between'>
                    <div>
                      <div className='flex items-center gap-2 mb-2'>
                        <Zap className='w-5 h-5 text-green-600 dark:text-green-400' />
                        <h4 className='font-semibold text-green-900 dark:text-green-300'>
                          健康分数
                        </h4>
                      </div>
                      <div className='text-sm text-gray-600 dark:text-gray-400'>
                        {smartHealthResult.reachability.successful}/
                        {smartHealthResult.reachability.total_tested} 源可用
                      </div>
                    </div>
                    <div className='text-center'>
                      <div
                        className={`text-3xl font-bold ${
                          smartHealthResult.reachability.health_score >= 75
                            ? 'text-green-600 dark:text-green-400'
                            : smartHealthResult.reachability.health_score >= 50
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {smartHealthResult.reachability.health_score}
                      </div>
                      <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                        {smartHealthResult.status.overall === 'excellent'
                          ? '优秀'
                          : smartHealthResult.status.overall === 'good'
                            ? '良好'
                            : '需关注'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 智能建议 */}
                {smartHealthResult.recommendations.length > 0 && (
                  <div className='p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-700'>
                    <h4 className='font-semibold text-purple-900 dark:text-purple-300 mb-3'>
                      💡 智能建议
                    </h4>
                    <ul className='space-y-2'>
                      {smartHealthResult.recommendations.map((rec, idx) => (
                        <li
                          key={idx}
                          className='text-sm text-purple-700 dark:text-purple-300 flex items-start gap-2'
                        >
                          <span className='flex-shrink-0 mt-1'>•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* JAR源修复结果 */}
        {jarFixResult && (
          <div className='border border-orange-200 dark:border-orange-700 rounded-lg p-4 bg-orange-50 dark:bg-orange-900/20'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='text-lg font-semibold text-orange-900 dark:text-orange-300 flex items-center gap-2'>
                <Wrench className='w-5 h-5' />
                JAR源修复诊断结果
              </h3>
              <button
                onClick={() => setJarFixResult(null)}
                className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              >
                <XCircle className='w-5 h-5' />
              </button>
            </div>

            {jarFixResult.error ? (
              <div className='p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg'>
                <p className='text-red-700 dark:text-red-300'>
                  {jarFixResult.error}
                </p>
                {jarFixResult.emergency_recommendations && (
                  <ul className='mt-3 space-y-1 text-sm'>
                    {jarFixResult.emergency_recommendations.map((rec, idx) => (
                      <li key={idx} className='text-red-600 dark:text-red-400'>
                        • {rec}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className='space-y-4'>
                {/* 测试概览 */}
                <div className='grid grid-cols-3 gap-3'>
                  <div className='p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700 text-center'>
                    <div className='text-2xl font-bold text-blue-600 dark:text-blue-400'>
                      {jarFixResult.summary.total_tested}
                    </div>
                    <div className='text-xs text-blue-700 dark:text-blue-300 mt-1'>
                      测试总数
                    </div>
                  </div>
                  <div className='p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700 text-center'>
                    <div className='text-2xl font-bold text-green-600 dark:text-green-400'>
                      {jarFixResult.summary.successful}
                    </div>
                    <div className='text-xs text-green-700 dark:text-green-300 mt-1'>
                      成功
                    </div>
                  </div>
                  <div className='p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700 text-center'>
                    <div className='text-2xl font-bold text-red-600 dark:text-red-400'>
                      {jarFixResult.summary.failed}
                    </div>
                    <div className='text-xs text-red-700 dark:text-red-300 mt-1'>
                      失败
                    </div>
                  </div>
                </div>

                {/* 网络质量评估 */}
                <div
                  className={`p-4 rounded-lg border ${
                    jarFixResult.status.network_quality === 'good'
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                      : jarFixResult.status.network_quality === 'fair'
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'
                  }`}
                >
                  <div className='flex items-center justify-between'>
                    <div>
                      <div className='font-semibold text-gray-900 dark:text-white'>
                        网络质量
                      </div>
                      <div className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
                        平均响应:{' '}
                        {Math.round(jarFixResult.summary.avg_response_time)}ms
                      </div>
                    </div>
                    <div
                      className={`text-2xl font-bold ${
                        jarFixResult.status.network_quality === 'good'
                          ? 'text-green-600 dark:text-green-400'
                          : jarFixResult.status.network_quality === 'fair'
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {jarFixResult.status.network_quality === 'good'
                        ? '优秀'
                        : jarFixResult.status.network_quality === 'fair'
                          ? '良好'
                          : '较差'}
                    </div>
                  </div>
                </div>

                {/* 推荐源 */}
                {jarFixResult.recommended_sources.length > 0 && (
                  <div className='p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-700'>
                    <h4 className='font-semibold text-green-900 dark:text-green-300 mb-3'>
                      ✅ 推荐源 (Top 3)
                    </h4>
                    <div className='space-y-2'>
                      {jarFixResult.recommended_sources.map((source, idx) => (
                        <div
                          key={idx}
                          className='p-3 bg-white dark:bg-gray-800 rounded border border-green-200 dark:border-green-700'
                        >
                          <div className='flex items-center justify-between mb-1'>
                            <div className='font-medium text-green-700 dark:text-green-300'>
                              #{idx + 1} {source.name}
                            </div>
                            <div className='text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2'>
                              <Clock className='w-3 h-3' />
                              {source.responseTime}ms
                            </div>
                          </div>
                          <div className='text-xs font-mono text-gray-600 dark:text-gray-400 break-all'>
                            {source.url}
                          </div>
                          {source.size && (
                            <div className='text-xs text-gray-500 dark:text-gray-400 mt-1'>
                              大小: {Math.round(source.size / 1024)}KB
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 三层建议系统 */}
                <div className='space-y-3'>
                  {/* 立即建议 */}
                  {jarFixResult.recommendations.immediate.length > 0 && (
                    <div className='p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700'>
                      <h4 className='font-semibold text-blue-900 dark:text-blue-300 mb-2'>
                        🎯 立即建议
                      </h4>
                      <ul className='space-y-1'>
                        {jarFixResult.recommendations.immediate.map(
                          (rec, idx) => (
                            <li
                              key={idx}
                              className='text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2'
                            >
                              <span className='flex-shrink-0 mt-1'>•</span>
                              <span>{rec}</span>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}

                  {/* 配置建议 */}
                  {jarFixResult.recommendations.configuration.length > 0 && (
                    <div className='p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700'>
                      <h4 className='font-semibold text-purple-900 dark:text-purple-300 mb-2'>
                        ⚙️ 配置建议
                      </h4>
                      <ul className='space-y-1'>
                        {jarFixResult.recommendations.configuration.map(
                          (rec, idx) => (
                            <li
                              key={idx}
                              className='text-sm text-purple-700 dark:text-purple-300 flex items-start gap-2'
                            >
                              <span className='flex-shrink-0 mt-1'>•</span>
                              <span>{rec}</span>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}

                  {/* 故障排查 */}
                  {jarFixResult.recommendations.troubleshooting.length > 0 && (
                    <div className='p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700'>
                      <h4 className='font-semibold text-yellow-900 dark:text-yellow-300 mb-2'>
                        🔧 故障排查
                      </h4>
                      <ul className='space-y-1'>
                        {jarFixResult.recommendations.troubleshooting.map(
                          (rec, idx) => (
                            <li
                              key={idx}
                              className='text-sm text-yellow-700 dark:text-yellow-300 flex items-start gap-2'
                            >
                              <span className='flex-shrink-0 mt-1'>•</span>
                              <span>{rec}</span>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 诊断结果 */}
        {showDiagnoseResult && diagnoseResult && (
          <div
            className={`border rounded-lg p-4 relative ${
              diagnoseResult.pass
                ? 'bg-green-50/80 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-yellow-50/80 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            } backdrop-blur-sm`}
          >
            {/* 关闭按钮 */}
            <button
              onClick={handleCloseDiagnoseResult}
              className='absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
              title='关闭诊断结果'
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
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>

            <div className='flex items-center gap-2 mb-3'>
              {diagnoseResult.pass ? (
                <CheckCircle className='h-5 w-5 text-green-600 dark:text-green-400' />
              ) : (
                <AlertCircle className='h-5 w-5 text-yellow-600 dark:text-yellow-400' />
              )}
              <h3
                className={`text-sm font-semibold ${
                  diagnoseResult.pass
                    ? 'text-green-900 dark:text-green-300'
                    : 'text-yellow-900 dark:text-yellow-300'
                }`}
              >
                诊断结果 {diagnoseResult.pass ? '✓ 通过' : '⚠ 发现问题'}
              </h3>
            </div>

            <div className='space-y-2 text-sm'>
              {/* 基本信息 */}
              <div className='grid grid-cols-2 gap-2'>
                <div className='text-gray-600 dark:text-gray-400'>状态码:</div>
                <div className='text-gray-900 dark:text-gray-100'>
                  {diagnoseResult.status}
                </div>

                <div className='text-gray-600 dark:text-gray-400'>
                  Content-Type:
                </div>
                <div className='text-gray-900 dark:text-gray-100 text-xs'>
                  {diagnoseResult.contentType || 'N/A'}
                </div>

                <div className='text-gray-600 dark:text-gray-400'>
                  JSON解析:
                </div>
                <div className='text-gray-900 dark:text-gray-100'>
                  {diagnoseResult.hasJson ? (
                    <span className='text-green-600 dark:text-green-400'>
                      ✓ 成功
                    </span>
                  ) : (
                    <span className='text-red-600 dark:text-red-400'>
                      ✗ 失败
                    </span>
                  )}
                </div>

                <div className='text-gray-600 dark:text-gray-400'>
                  接收到的Token:
                </div>
                <div className='text-gray-900 dark:text-gray-100'>
                  {diagnoseResult.receivedToken || 'none'}
                </div>

                <div className='text-gray-600 dark:text-gray-400'>
                  配置大小:
                </div>
                <div className='text-gray-900 dark:text-gray-100'>
                  {diagnoseResult.size} 字节
                </div>

                <div className='text-gray-600 dark:text-gray-400'>
                  影视源数量:
                </div>
                <div className='text-gray-900 dark:text-gray-100'>
                  {diagnoseResult.sitesCount}
                </div>

                <div className='text-gray-600 dark:text-gray-400'>
                  直播源数量:
                </div>
                <div className='text-gray-900 dark:text-gray-100'>
                  {diagnoseResult.livesCount}
                </div>

                <div className='text-gray-600 dark:text-gray-400'>
                  解析源数量:
                </div>
                <div className='text-gray-900 dark:text-gray-100'>
                  {diagnoseResult.parsesCount}
                </div>

                {diagnoseResult.privateApis !== undefined && (
                  <>
                    <div className='text-gray-600 dark:text-gray-400'>
                      私网API数量:
                    </div>
                    <div className='text-gray-900 dark:text-gray-100'>
                      {diagnoseResult.privateApis > 0 ? (
                        <span className='text-yellow-600 dark:text-yellow-400'>
                          {diagnoseResult.privateApis}
                        </span>
                      ) : (
                        <span className='text-green-600 dark:text-green-400'>
                          0
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* 配置URL */}
              {diagnoseResult.configUrl && (
                <div className='mt-3 pt-3 border-t border-gray-200 dark:border-gray-700'>
                  <div className='text-gray-600 dark:text-gray-400 mb-1'>
                    配置URL:
                  </div>
                  <div className='text-xs text-gray-900 dark:text-gray-100 break-all bg-white dark:bg-gray-800 p-2 rounded font-mono'>
                    {diagnoseResult.configUrl}
                  </div>
                </div>
              )}

              {/* Spider 信息 */}
              {diagnoseResult.spider && (
                <div className='mt-3 pt-3 border-t border-gray-200 dark:border-gray-700'>
                  <div className='text-gray-600 dark:text-gray-400 mb-1'>
                    Spider JAR:
                  </div>
                  <div className='text-xs text-gray-900 dark:text-gray-100 break-all bg-white dark:bg-gray-800 p-2 rounded'>
                    {diagnoseResult.spider}
                  </div>
                  <div className='mt-2 space-y-1'>
                    {diagnoseResult.spiderPrivate !== undefined && (
                      <div className='text-xs'>
                        {diagnoseResult.spiderPrivate ? (
                          <span className='text-yellow-600 dark:text-yellow-400'>
                            ⚠ Spider 是私网地址
                          </span>
                        ) : (
                          <span className='text-green-600 dark:text-green-400'>
                            ✓ Spider 是公网地址
                          </span>
                        )}
                      </div>
                    )}
                    {diagnoseResult.spiderReachable !== undefined && (
                      <div className='text-xs'>
                        {diagnoseResult.spiderReachable ? (
                          <span className='text-green-600 dark:text-green-400'>
                            ✓ Spider 可访问
                            {diagnoseResult.spiderStatus &&
                              ` (状态码: ${diagnoseResult.spiderStatus})`}
                          </span>
                        ) : (
                          <span className='text-red-600 dark:text-red-400'>
                            ✗ Spider 不可访问
                            {diagnoseResult.spiderStatus &&
                              ` (状态码: ${diagnoseResult.spiderStatus})`}
                          </span>
                        )}
                      </div>
                    )}
                    {diagnoseResult.spiderSizeKB !== undefined && (
                      <div className='text-xs'>
                        <span
                          className={
                            diagnoseResult.spiderSizeKB < 50
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-green-600 dark:text-green-400'
                          }
                        >
                          {diagnoseResult.spiderSizeKB < 50 ? '⚠' : '✓'}{' '}
                          文件大小: {diagnoseResult.spiderSizeKB}KB
                        </span>
                      </div>
                    )}
                    {diagnoseResult.spiderLastModified && (
                      <div className='text-xs text-gray-600 dark:text-gray-400'>
                        最后修改:{' '}
                        {new Date(
                          diagnoseResult.spiderLastModified,
                        ).toLocaleString('zh-CN')}
                      </div>
                    )}
                  </div>

                  {/* Spider Jar 状态（新增）*/}
                  {((diagnoseResult as any).spider_url ||
                    (diagnoseResult as any).spider_md5) && (
                    <div className='mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs'>
                      <div className='font-medium text-blue-800 dark:text-blue-200 mb-1'>
                        Spider Jar 状态:
                      </div>
                      <div className='space-y-0.5 text-blue-700 dark:text-blue-300'>
                        {(diagnoseResult as any).spider_url && (
                          <div>
                            • 来源: {(diagnoseResult as any).spider_url}
                          </div>
                        )}
                        {(diagnoseResult as any).spider_md5 && (
                          <div>• MD5: {(diagnoseResult as any).spider_md5}</div>
                        )}
                        {(diagnoseResult as any).spider_cached !==
                          undefined && (
                          <div>
                            • 缓存:{' '}
                            {(diagnoseResult as any).spider_cached
                              ? '✓ 是'
                              : '✗ 否（实时下载）'}
                          </div>
                        )}
                        {(diagnoseResult as any).spider_real_size !==
                          undefined && (
                          <div>
                            • 真实大小:{' '}
                            {Math.round(
                              (diagnoseResult as any).spider_real_size / 1024,
                            )}
                            KB
                          </div>
                        )}
                        {(diagnoseResult as any).spider_tried !== undefined && (
                          <div>
                            • 尝试次数: {(diagnoseResult as any).spider_tried}
                          </div>
                        )}
                        {(diagnoseResult as any).spider_success !==
                          undefined && (
                          <div>
                            • 状态:{' '}
                            {(diagnoseResult as any).spider_success
                              ? '✓ 成功'
                              : '✗ 降级（使用fallback jar）'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 备用代理地址（新增）*/}
                  {(diagnoseResult as any).spider_backup && (
                    <div className='mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs'>
                      <div className='text-gray-600 dark:text-gray-400 mb-1'>
                        备用代理地址:
                      </div>
                      <div className='text-gray-900 dark:text-gray-100 break-all font-mono'>
                        {(diagnoseResult as any).spider_backup}
                      </div>
                    </div>
                  )}

                  {/* 候选列表 */}
                  {(diagnoseResult as any).spider_candidates &&
                    (diagnoseResult as any).spider_candidates.length > 0 && (
                      <div className='mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg'>
                        <h3 className='font-semibold text-gray-900 dark:text-white mb-2 text-xs'>
                          候选列表:
                        </h3>
                        <div className='space-y-1'>
                          {(diagnoseResult as any).spider_candidates.map(
                            (candidate: string, idx: number) => (
                              <div
                                key={idx}
                                className='font-mono text-xs text-gray-600 dark:text-gray-400 break-all'
                              >
                                {idx + 1}. {candidate}
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {/* 问题列表 */}
              {diagnoseResult.issues && diagnoseResult.issues.length > 0 && (
                <div className='mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800'>
                  <div className='text-yellow-900 dark:text-yellow-300 font-medium mb-2'>
                    发现以下问题:
                  </div>
                  <ul className='list-disc list-inside space-y-1 text-yellow-800 dark:text-yellow-400'>
                    {diagnoseResult.issues.map((issue: string, idx: number) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 保存按钮 */}
      <div className='flex justify-end'>
        <button
          onClick={handleSave}
          disabled={isLoading}
          className='px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors'
        >
          {isLoading ? '保存中...' : '保存配置'}
        </button>
      </div>
    </div>
  );
};

export default TVBoxSecurityConfig;
