'use client';

import { useEffect, useState } from 'react';

export default function EdgeOneKVDebug() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    setLoading(true);
    try {
      // 测试 EdgeOne 函数
      const response = await fetch('/api/edgeone-cache/debug');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      setStatus({
        error: '无法连接到 EdgeOne KV 调试接口',
        message: error instanceof Error ? error.message : 'Unknown error',
        hint: '请确认 EdgeOne 函数已正确部署'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>正在检查 EdgeOne KV 状态...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">EdgeOne KV 调试工具</h1>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">状态检查</h2>

          {status?.error ? (
            <div className="bg-red-900 border border-red-700 rounded p-4 mb-4">
              <h3 className="font-semibold text-red-200 mb-2">❌ 错误</h3>
              <p className="text-red-100">{status.error}</p>
              {status.message && (
                <p className="text-red-200 mt-2 text-sm">{status.message}</p>
              )}
              {status.hint && (
                <p className="text-red-300 mt-2 text-sm">💡 {status.hint}</p>
              )}
            </div>
          ) : status?.edgeOneKV?.available ? (
            <div className="bg-green-900 border border-green-700 rounded p-4 mb-4">
              <h3 className="font-semibold text-green-200 mb-2">✅ EdgeOne KV 正常工作</h3>
              <p className="text-green-100">{status.edgeOneKV.message}</p>
            </div>
          ) : (
            <div className="bg-yellow-900 border border-yellow-700 rounded p-4 mb-4">
              <h3 className="font-semibold text-yellow-200 mb-2">⚠️ EdgeOne KV 未启用</h3>
              <p className="text-yellow-100">{status?.tips || '请检查配置'}</p>
            </div>
          )}

          <div className="mt-4">
            <button
              onClick={checkStatus}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              重新检查
            </button>
          </div>
        </div>

        {status && !status.error && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">详细信息</h2>
            <pre className="bg-gray-900 p-4 rounded overflow-x-auto text-sm">
              {JSON.stringify(status, null, 2)}
            </pre>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">使用说明</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>访问 <code className="bg-gray-700 px-2 py-1 rounded">/edgeone-kv-debug</code> 查看状态</li>
            <li>如果显示 404，说明 EdgeOne 函数未正确部署</li>
            <li>如果显示错误，请检查 KV 命名空间绑定配置</li>
            <li>变量名必须设置为 <code className="bg-gray-700 px-2 py-1 rounded">VIDORA_KV</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}