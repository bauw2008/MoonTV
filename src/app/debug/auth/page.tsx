'use client';

import { useState } from 'react';

import { useAuth } from '@/components/auth/AuthProvider';

export default function DebugAuthPage() {
  const auth = useAuth();
  const [testResult, setTestResult] = useState<any>(null);

  const testAuthAPI = async () => {
    try {
      const response = await fetch('/api/auth/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        error: error instanceof Error ? error.message : '未知错误',
      });
    }
  };

  return (
    <div className='p-6 max-w-4xl mx-auto'>
      <h1 className='text-2xl font-bold mb-6 text-gray-900 dark:text-white'>
        认证调试
      </h1>

      <div className='bg-gray-100 dark:bg-gray-800 rounded-lg p-6 shadow-lg space-y-4 mb-6'>
        <h2 className='font-semibold text-lg mb-2 text-gray-900 dark:text-white'>
          AuthProvider状态
        </h2>
        <pre className='text-xs text-gray-900 bg-white dark:bg-gray-900 dark:text-white p-4 rounded overflow-auto'>
          {JSON.stringify(auth.state, null, 2)}
        </pre>
      </div>

      <div className='bg-gray-100 dark:bg-gray-800 rounded-lg p-6 shadow-lg space-y-4 mb-6'>
        <button
          onClick={testAuthAPI}
          className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'
        >
          测试认证API
        </button>
        {testResult && (
          <pre className='text-xs text-gray-900 bg-white dark:bg-gray-900 dark:text-white p-4 rounded overflow-auto'>
            {JSON.stringify(testResult, null, 2)}
          </pre>
        )}
      </div>

      <div className='bg-gray-100 dark:bg-gray-800 rounded-lg p-6 shadow-lg space-y-4'>
        <h2 className='font-semibold text-lg mb-2 text-gray-900 dark:text-white'>
          Cookie信息
        </h2>
        <button
          onClick={() => {
            const cookies = document.cookie.split(';').map((c) => c.trim());
            alert(cookies.join('\n'));
          }}
          className='px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600'
        >
          查看Cookie
        </button>
      </div>
    </div>
  );
}
