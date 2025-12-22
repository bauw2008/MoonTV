'use client';

import { AlertCircle, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { AdminConfig } from '@/lib/admin.types';

interface AIRecommendConfigProps {
  config: AdminConfig | null;
  refreshConfig: () => Promise<void>;
}

const AIRecommendConfig = ({
  config,
  refreshConfig,
}: AIRecommendConfigProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [aiSettings, setAiSettings] = useState({
    enabled: false,
    apiUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 3000,
  });

  // 常用模型参考（建议使用支持联网搜索的模型）
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

  // 从config加载设置
  useEffect(() => {
    if (config?.AIRecommendConfig) {
      setAiSettings({
        enabled: config.AIRecommendConfig.enabled ?? false,
        apiUrl: config.AIRecommendConfig.apiUrl || 'https://api.openai.com/v1',
        apiKey: config.AIRecommendConfig.apiKey || '',
        model: config.AIRecommendConfig.model || 'gpt-3.5-turbo',
        temperature: config.AIRecommendConfig.temperature ?? 0.7,
        maxTokens: config.AIRecommendConfig.maxTokens ?? 3000,
      });
    }
  }, [config]);

  // 显示消息
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // 保存AI推荐配置
  const handleSave = async () => {
    // 基本验证
    if (aiSettings.enabled) {
      if (!aiSettings.apiUrl.trim()) {
        showMessage('error', '请填写API地址');
        return;
      }
      if (!aiSettings.apiKey.trim()) {
        showMessage('error', '请填写API密钥');
        return;
      }
      if (!aiSettings.model.trim()) {
        showMessage('error', '请选择或填写模型名称');
        return;
      }
      if (aiSettings.temperature < 0 || aiSettings.temperature > 2) {
        showMessage('error', '温度参数应在0-2之间');
        return;
      }
      if (aiSettings.maxTokens < 1 || aiSettings.maxTokens > 150000) {
        showMessage(
          'error',
          '最大Token数应在1-150000之间（GPT-5支持128k，推理模型建议2000+）',
        );
        return;
      }
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/ai-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiSettings),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '保存失败');
      }

      showMessage('success', 'AI推荐配置保存成功');
      await refreshConfig();
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 测试API连接
  const handleTest = async () => {
    if (!aiSettings.apiUrl.trim() || !aiSettings.apiKey.trim()) {
      showMessage('error', '请先填写API地址和密钥');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/ai-recommend/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiUrl: aiSettings.apiUrl,
          apiKey: aiSettings.apiKey,
          model: aiSettings.model,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'API连接测试失败';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      showMessage('success', 'API连接测试成功！');
    } catch (err) {
      console.error('测试连接错误:', err);
      let errorMessage = 'API连接测试失败';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && typeof err === 'object') {
        // 处理对象错误，避免显示 [object Object]
        if ('message' in err) {
          errorMessage = String(err.message);
        } else {
          errorMessage = 'API连接失败，请检查网络或API配置';
        }
      }
      showMessage('error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='space-y-6'>
      {/* 消息提示 */}
      {message && (
        <div
          className={`flex items-center space-x-2 p-3 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className='h-5 w-5' />
          ) : (
            <AlertCircle className='h-5 w-5' />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* 基础设置 */}
      <div className='bg-transparent dark:bg-transparent rounded-lg p-6 border border-gray-200 dark:border-gray-700 shadow-sm'>
        <div className='mb-6'>
          <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2'>
            基础设置
          </h3>
          <div className='flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg'>
            <svg className='h-4 w-4' fill='currentColor' viewBox='0 0 20 20'>
              <path
                fillRule='evenodd'
                d='M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
                clipRule='evenodd'
              />
            </svg>
            <span>
              🤖 支持OpenAI兼容的API接口，包括ChatGPT、Claude、Gemini等模型
            </span>
          </div>
        </div>

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
            开启后用户可以在主页看到AI推荐按钮并与AI对话获取影视推荐
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
                  onClick={() => {
                    const url = aiSettings.apiUrl.trim();
                    if (
                      url &&
                      !url.endsWith('/v1') &&
                      !url.includes('/chat/completions')
                    ) {
                      const newUrl = url.endsWith('/')
                        ? url + 'v1'
                        : url + '/v1';
                      setAiSettings((prev) => ({ ...prev, apiUrl: newUrl }));
                      showMessage('success', '已自动添加 /v1 后缀');
                    }
                  }}
                  className='absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded transition-colors'
                >
                  +/v1
                </button>
              </div>
              <div className='mt-2 space-y-2'>
                <p className='text-xs text-gray-500 dark:text-gray-400'>
                  <span className='text-yellow-600 dark:text-yellow-400'>
                    💡 提示：
                  </span>
                  大多数OpenAI兼容API需要在地址末尾添加{' '}
                  <code className='bg-gray-100 dark:bg-gray-800 px-1 rounded'>
                    /v1
                  </code>
                </p>
                <div className='grid grid-cols-1 gap-1 text-xs'>
                  <details className='text-gray-500 dark:text-gray-400'>
                    <summary className='cursor-pointer hover:text-gray-700 dark:hover:text-gray-300'>
                      📝 常见API地址示例 (点击展开)
                    </summary>
                    <div className='mt-2 space-y-1 pl-4 border-l-2 border-gray-200 dark:border-gray-700'>
                      {[
                        { name: 'OpenAI', url: 'https://api.openai.com/v1' },
                        {
                          name: 'DeepSeek',
                          url: 'https://api.deepseek.com/v1',
                        },
                        {
                          name: '硅基流动',
                          url: 'https://api.siliconflow.cn/v1',
                        },
                        { name: '月之暗面', url: 'https://api.moonshot.cn/v1' },
                        {
                          name: '智谱AI',
                          url: 'https://open.bigmodel.cn/api/paas/v4',
                        },
                        {
                          name: '通义千问',
                          url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                        },
                        {
                          name: '百度文心',
                          url: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1',
                        },
                        { name: '星辰心流', url: 'https://apis.iflow.cn/v1' },
                        { name: '自部署', url: 'http://localhost:11434/v1' },
                      ].map((provider) => (
                        <div
                          key={provider.name}
                          className='flex items-center justify-between group'
                        >
                          <span>
                            • {provider.name}: <code>{provider.url}</code>
                          </span>
                          <button
                            type='button'
                            onClick={() => {
                              setAiSettings((prev) => ({
                                ...prev,
                                apiUrl: provider.url,
                              }));
                              showMessage(
                                'success',
                                `已设置为 ${provider.name} API地址`,
                              );
                            }}
                            className='opacity-0 group-hover:opacity-100 ml-2 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 rounded transition-all'
                          >
                            使用
                          </button>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              </div>
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
                  setAiSettings((prev) => ({ ...prev, apiKey: e.target.value }))
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
                  setAiSettings((prev) => ({ ...prev, model: e.target.value }))
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
                        setAiSettings((prev) => ({
                          ...prev,
                          model: modelName,
                        }));
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
        {/* 测试连接按钮 - 只在启用AI时显示 */}
        {aiSettings.enabled && (
          <button
            onClick={handleTest}
            disabled={isLoading}
            className='flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors'
          >
            <svg
              className='h-4 w-4 mr-2'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
            {isLoading ? '测试中...' : '测试连接'}
          </button>
        )}

        {/* 保存按钮 - 始终显示 */}
        <button
          onClick={handleSave}
          disabled={isLoading}
          className='flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors'
        >
          <svg
            className='h-4 w-4 mr-2'
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
          {isLoading ? '保存中...' : '保存配置'}
        </button>
      </div>
    </div>
  );
};

export default AIRecommendConfig;
