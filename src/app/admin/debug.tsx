'use client';

import { useState } from 'react';

export default function DebugPage() {
  const [logs, setLogs] = useState<string[]>([]);

  const testDelete = async () => {
    setLogs(prev => [...prev, '开始测试删除操作...']);
    
    try {
      const response = await fetch('/api/admin/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', key: 'test' }),
      });
      
      setLogs(prev => [...prev, `响应状态: ${response.status}`]);
      
      const data = await response.json();
      setLogs(prev => [...prev, `响应数据: ${JSON.stringify(data)}`]);
    } catch (error) {
      setLogs(prev => [...prev, `错误: ${error instanceof Error ? error.message : '未知错误'}`]);
      setLogs(prev => [...prev, `错误详情: ${JSON.stringify(error, null, 2)}`]);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">调试页面 - 直播源删除</h1>
      
      <div className="space-x-4 mb-6">
        <button
          onClick={testDelete}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          测试删除操作
        </button>
        <button
          onClick={clearLogs}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          清除日志
        </button>
      </div>

      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">日志:</h2>
        <div className="font-mono text-sm whitespace-pre-wrap">
          {logs.length === 0 ? '暂无日志' : logs.join('\n')}
        </div>
      </div>

      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">解决方案:</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>清除浏览器缓存和localStorage</li>
          <li>刷新页面 (Ctrl+F5)</li>
          <li>如果问题持续，尝试重启开发服务器</li>
          <li>检查控制台是否有其他错误</li>
        </ol>
      </div>
    </div>
  );
}