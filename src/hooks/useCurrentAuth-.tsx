'use client';

import { useEffect, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

interface AuthState {
  user: {
    username?: string;
    role?: 'owner' | 'admin' | 'user';
  } | null;
  loading: boolean;
}

export function useCurrentAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
  });

  useEffect(() => {
    const checkAuth = () => {
      const authInfo = getAuthInfoFromBrowserCookie();
      if (authInfo && authInfo.username) {
        setState({
          user: {
            username: authInfo.username,
            role: authInfo.role,
          },
          loading: false,
        });
      } else {
        setState({
          user: null,
          loading: false,
        });
      }
    };

    checkAuth();
  }, []);

  return { state };
}
