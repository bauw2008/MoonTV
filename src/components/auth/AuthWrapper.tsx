'use client';

import { useEffect, useState } from 'react';

import { useAuth } from './AuthProvider';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { state } = useAuth();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 等待认证状态初始化完成
    if (!state.loading) {
      setIsReady(true);
    }
  }, [state.loading]);

  // 在认证状态初始化完成之前显示加载状态
  if (!isReady) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '16px',
        }}
      >
        加载中...
      </div>
    );
  }

  return <>{children}</>;
}
