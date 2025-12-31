'use client';

import { AlertCircle, CheckCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { PermissionGuard } from '@/components/PermissionGuard';

import { useNavigationConfig } from '@/contexts/NavigationConfigContext';

import { CollapsibleTab } from '../ui/CollapsibleTab';
import { useAdminState } from '../../hooks/useAdminState';

interface AISettings {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

const MODEL_EXAMPLES = [
  'gpt-5 (OpenAI)',
  'o3-mini (OpenAI)',
  'claude-4-opus (Anthropic)',
  'claude-4-sonnet (Anthropic)',
  'gemini-2.5-flash (Google)',
  'gemini-2.5-pro (Google)',
  'deepseek-reasoner (DeepSeek)',
  'deepseek-chat (DeepSeek)',
  'deepseek-coder (DeepSeek)',
  'qwen3-max (阿里云)',
  'glm-4-plus (智谱AI)',
  'llama-4 (Meta)',
  'grok-4 (xAI)',
  'GLM-4.6 (recommend)',
  'DeepSeek-V3.2',
  'Qwen3-Coder-Plus',
  'Kimi-K2-Thinking',
  'MiniMax-M2',
  'Kimi-K2-0905',
];

const API_PROVIDERS = [
  { name: 'OpenAI', url: 'https://api.openai.com/v1' },
  { name: 'DeepSeek', url: 'https://api.deepseek.com/v1' },
  { name: '硅基流动', url: 'https://api.siliconflow.cn/v1' },
  { name: '月之暗面', url: 'https://api.moonshot.cn/v1' },
  { name: '智谱AI', url: 'https://open.bigmodel.cn/api/paas/v4' },
  {
    name: '通义千问',
    url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  { name: '百度文心', url: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1' },
  { name: '星辰心流', url: 'https://apis.iflow.cn/v1' },
  { name: '自部署', url: 'http://localhost:11434/v1' },
];

function AIConfigContent() {
  const { withLoading, loading } = useAdminState();
  const { updateAIEnabled } = useNavigationConfig();
  const [_config, setConfig] = useState<unknown>(null);
  const [expanded, setExpanded] = useState(false);

  // AI配置状态
  const [aiSettings, setAiSettings] = useState<AISettings>({
    enabled: false,
    apiUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 3000,
  });

  const loadConfig = useCallback(async () => {
    try {
      await withLoading('loadAIConfig', async () => {
        const response = await fetch('/api/admin/config');
        const data = await response.json();
        setConfig(data.Config);

        if (data.Config?.AIRecommendConfig) {
          setAiSettings({
            enabled: data.Config.AIRecommendConfig.enabled ?? false,
            apiUrl:
              data.Config.AIRecommendConfig.apiUrl ||
              'https://api.openai.com/v1',
            apiKey: data.Config.AIRecommendConfig.apiKey || '',
            model: data.Config.AIRecommendConfig.model || 'gpt-3.5-turbo',
            temperature: data.Config.AIRecommendConfig.temperature ?? 0.7,
            maxTokens: data.Config.AIRecommendConfig.maxTokens ?? 3000,
          });
        }
      });
    } catch {
      // console.error('加载AI配置失败:', error);
    }
  }, [withLoading]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const saveConfig = async () => {
    // 基本验证
    if (aiSettings.enabled) {
      if (!aiSettings.apiUrl.trim()) {
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.error('请填写API地址');
          });
        }
        return;
      }
      if (!aiSettings.apiKey.trim()) {
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.error('请填写API密钥');
          });
        }
        return;
      }
      if (!aiSettings.model.trim()) {
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.error('请选择或填写模型名称');
          });
        }
        return;
      }
      if (aiSettings.temperature < 0 || aiSettings.temperature > 2) {
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.error('温度参数应在0-2之间');
          });
        }
        return;
      }
      if (aiSettings.maxTokens < 1 || aiSettings.maxTokens > 150000) {
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.error(
              '最大Token数应在1-150000之间（GPT-5支持128k，推理模型建议2000+）',
            );
          });
        }
        return;
      }
    }

    try {
      await withLoading('saveAIConfig', async () => {
        const response = await fetch('/api/admin/ai-recommend', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(aiSettings),
        });

        if (!response.ok) {
          throw new Error('保存失败');
        }

        // 使用Toast通知
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.success('AI推荐配置保存成功');
          });
        }

        // 同步更新NavigationConfigContext中的AI状态
        updateAIEnabled(aiSettings.enabled);

        await loadConfig();
      });
    } catch (error) {
      // console.error('保存AI配置失败:', error);
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('保存失败: ' + (error as Error).message);
        });
      }
    }
  };

  const testConnection = async () => {
    if (!aiSettings.apiUrl.trim() || !aiSettings.apiKey.trim()) {
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('请先填写API地址和密钥');
        });
      }
      return;
    }

    try {
      await withLoading('testAIConnection', async () => {
        const response = await fetch('/api/admin/ai-recommend/test', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiUrl: aiSettings.apiUrl,
            apiKey: aiSettings.apiKey,
            model: aiSettings.model,
          }),
        });

        if (!response.ok) {
          throw new Error('连接测试失败');
        }

        const result = await response.json();
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.success(result.message || 'API连接测试成功！');
          });
        }
      });
    } catch (error) {
      // console.error('测试连接错误:', error);
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('连接测试失败: ' + (error as Error).message);
        });
      }
    }
  };

  const addV1Suffix = async () => {
    const url = aiSettings.apiUrl.trim();
    if (url && !url.endsWith('/v1') && !url.includes('/chat/completions')) {
      const newUrl = url.endsWith('/') ? url + 'v1' : url + '/v1';
      setAiSettings((prev) => ({ ...prev, apiUrl: newUrl }));
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.success('已自动添加 /v1 后缀');
        });
      }
    }
  };

  const setProviderUrl = async (url: string, name: string) => {
    setAiSettings((prev) => ({ ...prev, apiUrl: url }));
    if (typeof window !== 'undefined') {
      import('@/components/Toast').then(({ ToastManager }) => {
        ToastManager?.success(`已设置为 ${name} API地址`);
      });
    }
  };

  const setModel = (modelName: string) => {
    setAiSettings((prev) => ({ ...prev, model: modelName }));
  };

  return (
    <CollapsibleTab
      title='AI配置'
      theme='purple'
      icon={
        <svg
          className='w-5 h-5 text-purple-500'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
          />
        </svg>
      }
      isExpanded={expanded}
      onToggle={() => setExpanded(!expanded)}
    >
      {loading.loadAIConfig ? (
        <div className='text-center py-8 text-gray-500 dark:text-gray-400'>
          加载中...
        </div>
      ) : (
        <div className='space-y-6'>
          {/* 基础设置 */}
          <div className='bg-orange-50 dark:bg-orange-900/30 rounded-lg p-6 border border-orange-200 dark:border-orange-700 shadow-sm'>
            {/* 启用开关 */}
            <div className='mb-6'>
              <label className='flex items-center cursor-pointer'>
                <input
                  type='checkbox'
                  className='sr-only'
                  checked={aiSettings.enabled}
                  onChange={(e) =>
                    setAiSettings((prev) => ({
                      ...prev,
                      enabled: e.target.checked,
                    }))
                  }
                />
                <div
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    aiSettings.enabled
                      ? 'bg-blue-600'
                      : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      aiSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </div>
                <span className='ml-3 text-sm font-medium text-gray-900 dark:text-gray-100'>
                  启用AI推荐功能
                </span>
              </label>
              <p className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
                {aiSettings.enabled 
                  ? '开启后用户可以在主页看到AI推荐按钮并与AI对话获取影视推荐'
                  : '已禁用AI推荐功能，用户将无法使用AI推荐功能'}
              </p>
            </div>

            {/* API配置 */}
            {aiSettings.enabled && (
              <div className='space-y-4'>
                {/* API地址 */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    API地址
                  </label>
                  <div className='relative'>
                    <input
                      type='url'
                      value={aiSettings.apiUrl}
                      onChange={(e) =>
                        setAiSettings((prev) => ({
                          ...prev,
                          apiUrl: e.target.value,
                        }))
                      }
                      className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:bg-transparent text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                      placeholder='https://api.openai.com/v1'
                    />
                    <button
                      type='button'
                      onClick={async () => await addV1Suffix()}
                      className='absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded transition-colors'
                    >
                      +/v1
                    </button>
                  </div>

                  {/* API提供商列表 */}
                  <details className='mt-2'>
                    <summary className='text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300'>
                      📝 常见API地址示例 (点击展开)
                    </summary>
                    <div className='mt-2 space-y-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700'>
                      {API_PROVIDERS.map((provider) => (
                        <div
                          key={provider.name}
                          className='flex items-center justify-between group hover:bg-orange-100 dark:hover:bg-orange-800/50 -ml-4 pl-4 pr-2 py-1 rounded transition-colors'
                        >
                          <div className='flex items-center space-x-2 flex-1 min-w-0'>
                            <span className='text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap'>
                              {provider.name}:
                            </span>
                            <code className='text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-0.5 rounded flex-1 truncate'>
                              {provider.url}
                            </code>
                          </div>
                          <button
                            type='button'
                            onClick={async () =>
                              await setProviderUrl(provider.url, provider.name)
                            }
                            className='opacity-0 group-hover:opacity-100 ml-2 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded transition-all whitespace-nowrap'
                          >
                            使用
                          </button>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>

                {/* API密钥 */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    API密钥
                  </label>
                  <input
                    type='password'
                    value={aiSettings.apiKey}
                    onChange={(e) =>
                      setAiSettings((prev) => ({
                        ...prev,
                        apiKey: e.target.value,
                      }))
                    }
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:bg-transparent text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    placeholder='sk-...'
                  />
                  <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                    请妥善保管API密钥，不要泄露给他人
                  </p>
                </div>

                {/* 模型名称 */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                    模型名称
                  </label>
                  <input
                    type='text'
                    value={aiSettings.model}
                    onChange={(e) =>
                      setAiSettings((prev) => ({
                        ...prev,
                        model: e.target.value,
                      }))
                    }
                    className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:bg-transparent text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    placeholder='请自行填入正确的官方API模型名称，如：gpt-5'
                  />
                  <div className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
                    <p className='mb-1'>
                      常用模型参考（建议使用支持联网搜索的模型）：
                    </p>
                    <p className='mb-2 text-orange-600 dark:text-orange-400'>
                      ⚠️ 请确保填入的模型名称与API提供商的官方文档一致
                    </p>
                    <div className='flex flex-wrap gap-2'>
                      {MODEL_EXAMPLES.map((example, index) => (
                        <button
                          key={index}
                          type='button'
                          onClick={() => {
                            const modelName = example.split(' (')[0];
                            setModel(modelName);
                          }}
                          className='inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded cursor-pointer transition-colors'
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 高级参数 */}
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      温度参数: {aiSettings.temperature}
                    </label>
                    <input
                      type='range'
                      min='0'
                      max='2'
                      step='0.1'
                      value={aiSettings.temperature}
                      onChange={(e) =>
                        setAiSettings((prev) => ({
                          ...prev,
                          temperature: parseFloat(e.target.value),
                        }))
                      }
                      className='w-full'
                    />
                    <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                      控制回复的随机性，0=确定性，2=最随机
                    </p>
                  </div>

                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      最大Token数
                    </label>
                    <input
                      type='number'
                      min='1'
                      max='4000'
                      value={aiSettings.maxTokens}
                      onChange={(e) =>
                        setAiSettings((prev) => ({
                          ...prev,
                          maxTokens: parseInt(e.target.value),
                        }))
                      }
                      className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent dark:bg-transparent text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    />
                    <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                      限制AI回复的最大长度。推荐设置：GPT-5/o1/o3/o4推理模型建议2000+，普通模型500-4000即可。
                      <span className='text-yellow-600 dark:text-yellow-400'>
                        ⚠️ 设置过低可能导致空回复！
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className='flex flex-wrap gap-3'>
            {aiSettings.enabled && (
              <button
                onClick={testConnection}
                disabled={loading.testAIConnection}
                className='flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors'
              >
                <CheckCircle className='h-4 w-4 mr-2' />
                {loading.testAIConnection ? '测试中...' : '测试连接'}
              </button>
            )}

            <button
              onClick={saveConfig}
              disabled={loading.saveAIConfig}
              className='flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors'
            >
              <AlertCircle className='h-4 w-4 mr-2' />
              {loading.saveAIConfig ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>
      )}
    </CollapsibleTab>
  );
}

// 导出组件
export function AIConfig() {
  return (
    <PermissionGuard permission='canManageConfig'>
      <AIConfigContent />
    </PermissionGuard>
  );
}
