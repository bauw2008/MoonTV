/* eslint-disable no-console */

'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from 'react';

import { AuthConfig, AuthUser, ClientAuthState } from '@/lib/auth/types';

/**
 * 认证状态 Action 类型
 */
type AuthAction =
  | { type: 'AUTH_START' }
  | {
      type: 'AUTH_SUCCESS';
      payload: { user: AuthUser; accessToken?: string; refreshToken?: string };
    }
  | { type: 'AUTH_ERROR'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: Partial<AuthUser> }
  | { type: 'REFRESH_TOKEN'; payload: { accessToken: string } }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_ACTIVITY' };

/**
 * 认证状态 Reducer
 */
function authReducer(
  state: ClientAuthState,
  action: AuthAction,
): ClientAuthState {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        loading: true,
        error: null,
      };

    case 'AUTH_SUCCESS':
      console.log('authReducer: AUTH_SUCCESS', {
        user: action.payload.user,
        isAuthenticated: true,
      });
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        loading: false,
        error: null,
        lastActivity: Date.now(),
      };

    case 'AUTH_ERROR':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        loading: false,
        error: action.payload,
      };

    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        loading: false,
        error: null,
      };

    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };

    case 'REFRESH_TOKEN':
      return {
        ...state,
        lastActivity: Date.now(),
      };

    case 'UPDATE_ACTIVITY':
      return {
        ...state,
        lastActivity: Date.now(),
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
}

/**
 * 认证上下文
 */
const AuthContext = createContext<{
  state: ClientAuthState;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
  updateActivity: () => void;
  clearError: () => void;
  hasPermission: (resource: string, action: string) => boolean;
  isAdmin: () => boolean;
  isOwner: () => boolean;
} | null>(null);

/**
 * 认证提供者组件
 */
export function AuthProvider({
  children,
  config,
}: {
  children: ReactNode;
  config?: Partial<AuthConfig>;
}) {
  const [state, dispatch] = useReducer(authReducer, {
    isAuthenticated: false,
    user: null,
    loading: true,
    error: null,
    lastActivity: 0,
  });

  const authConfig: AuthConfig = {
    apiBaseUrl: '/api',
    tokenRefreshThreshold: 90 * 60 * 1000, // 1.5小时
    sessionTimeout: 24 * 60 * 60 * 1000, // 24小时
    autoRefresh: true,
    storageKey: 'vidora_auth',
    ...config,
  };

  /**
   * 初始化认证状态
   */
  useEffect(() => {
    console.log('AuthProvider: useEffect触发，开始初始化');
    initializeAuth();
  }, []);

  // 暂时禁用权限版本检查，解决登录问题
  // useEffect(() => {
  //   // 只在已认证且有用户信息时启动检查
  //   if (!state.isAuthenticated || !state.user) return;

  //   // 防抖变量，避免频繁检查
  //   let checkTimeout: NodeJS.Timeout | null = null;
  //   let lastCheckTime = 0;
  //   const CHECK_COOLDOWN = 50000; // 50秒冷却时间

  //   const checkPermissionVersion = async () => {
  //     const now = Date.now();

  //     // 冷却时间检查，避免频繁调用
  //     if (now - lastCheckTime < CHECK_COOLDOWN) {
  //       return;
  //     }

  //     lastCheckTime = now;

  //     try {
  //       const storedAuth = getStoredAuth();
  //       if (!storedAuth?.accessToken) {
  //         // 没有token，强制重新登录
  //         forceLogout('认证信息已失效，请重新登录');
  //         return;
  //       }

  //       const response = await fetch('/api/auth/version', {
  //         headers: {
  //           'Authorization': `Bearer ${storedAuth.accessToken}`
  //         }
  //       });

  //       if (!response.ok) {
  //         // API调用失败，强制重新登录
  //         forceLogout('登录状态已过期，请重新登录');
  //         return;
  //       }

  //       const data = await response.json();
  //       const currentVersion = state.user.permissionVersion || 0;

  //       // 检查权限变更
  //       if (data.permissionVersion > currentVersion) {
  //         // 检查是否是权限降级
  //         const isDowngraded = checkIfDowngraded(state.user.role, data.role);

  //         if (isDowngraded) {
  //           // 权限降级，强制下线
  //           forceLogout(`您的权限已从 ${state.user.role} 调整为 ${data.role}，请重新登录`, {
  //             type: 'warning',
  //             duration: 5000
  //           });
  //         } else {
  //           // 权限升级，刷新即可
  //           await refreshAuth();
  //         }
  //       }
  //     } catch (error) {
  //       console.error('权限检查失败:', error);
  //       forceLogout('权限验证失败，请重新登录');
  //     }
  //   };

  //   // 检查是否是权限降级
  //   const checkIfDowngraded = (oldRole: string, newRole: string): boolean => {
  //     const roleHierarchy = {
  //       'owner': 3,
  //       'admin': 2,
  //       'user': 1,
  //       'banned': 0
  //     };

  //     return (roleHierarchy[oldRole] || 0) > (roleHierarchy[newRole] || 0);
  //   };

  //   // 强制下线函数
  //   const forceLogout = (message: string, options?: { type?: string; duration?: number }) => {
  //     // 1. 清除本地认证信息
  //     clearStoredAuth();

  //     // 2. 清除认证状态
  //     dispatch({ type: 'LOGOUT' });

  //     // 3. 显示提示信息
  //     if (options?.type === 'warning') {
  //       const toastEvent = new CustomEvent('showToast', {
  //         detail: {
  //           type: 'warning',
  //           message,
  //           duration: options.duration || 3000
  //         }
  //       });
  //       window.dispatchEvent(toastEvent);
  //     }

  //     // 4. 延迟跳转到登录页
  //     setTimeout(() => {
  //       const currentPath = window.location.pathname + window.location.search;
  //       window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
  //     }, 1000);
  //   };

  //   // 延迟5秒后开始第一次检查，避免初始化时的冲突
  //   checkTimeout = setTimeout(() => {
  //     checkPermissionVersion();

  //     // 之后每60秒检查一次
  //     const interval = setInterval(checkPermissionVersion, 60000);

  //     // 清理函数
  //     return () => {
  //       clearInterval(interval);
  //       if (checkTimeout) {
  //         clearTimeout(checkTimeout);
  //       }
  //     };
  //   }, 5000);

  //   // 返回清理函数
  //   return () => {
  //     if (checkTimeout) {
  //       clearTimeout(checkTimeout);
  //     }
  //   };
  // }, [state.isAuthenticated]); // 只依赖认证状态，不依赖user对象

  /**
   * 自动刷新令牌
   */
  useEffect(() => {
    if (!authConfig.autoRefresh || !state.isAuthenticated) {
      return;
    }

    const interval = setInterval(() => {
      const shouldRefresh =
        Date.now() - state.lastActivity > authConfig.tokenRefreshThreshold;
      if (shouldRefresh) {
        refreshToken();
      }
    }, 5 * 60 * 1000); // 每5分钟检查一次

    return () => clearInterval(interval);
  }, [state.isAuthenticated, state.lastActivity, authConfig.autoRefresh]);

  /**
   * 初始化认证状态 - 智能认证策略
   */
  async function initializeAuth() {
    try {
      console.log('AuthProvider: 开始初始化认证状态', {
        isDatabaseStorage,
        storageType: process.env.NEXT_PUBLIC_STORAGE_TYPE,
      });

      if (isDatabaseStorage) {
        // 数据库模式：完全依赖服务器端验证
        console.log(
          `数据库存储模式初始化 (${process.env.NEXT_PUBLIC_STORAGE_TYPE})`,
        );

        const response = await fetch(`${authConfig.apiBaseUrl}/auth/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // 包含 HttpOnly Cookie
        });

        console.log('AuthProvider: 数据库模式验证响应', {
          status: response.status,
          ok: response.ok,
        });

        if (response.ok) {
          const data = await response.json();
          console.log('AuthProvider: 数据库模式验证成功', { user: data.user });
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: {
              user: data.user,
            },
          });
          console.log('数据库模式：从服务器端获取用户信息成功');
        } else {
          console.log('AuthProvider: 数据库模式验证失败');
          dispatch({ type: 'AUTH_ERROR', payload: '' });
        }
      } else {
        // localStorage 模式：保持原有兼容性逻辑
        console.log('localStorage 模式初始化');

        const storedAuth = getStoredAuth();

        if (storedAuth && storedAuth.user) {
          // 验证令牌有效性（Token 在 HttpOnly Cookie 中）
          const isValid = await validateToken();

          if (isValid) {
            dispatch({
              type: 'AUTH_SUCCESS',
              payload: {
                user: storedAuth.user,
              },
            });
          } else {
            // 令牌无效，清除本地存储
            clearStoredAuth();
            dispatch({ type: 'AUTH_ERROR', payload: '会话已过期' });
          }
        } else {
          dispatch({ type: 'AUTH_ERROR', payload: '' });
        }
      }
    } catch (error) {
      console.error('认证初始化失败:', error);
      dispatch({ type: 'AUTH_ERROR', payload: '认证初始化失败' });
    }
  }

  /**
   * 用户登录
   */
  async function login(username: string, password: string) {
    try {
      dispatch({ type: 'AUTH_START' });

      const response = await fetch(`${authConfig.apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '登录失败');
      }

      const { user, accessToken, refreshToken } = data;

      console.log('登录响应数据:', {
        user,
        accessToken: !!accessToken,
        refreshToken: !!refreshToken,
      });

      if (isDatabaseStorage) {
        // 数据库模式：只存储用户基本信息，Token 完全依赖 HttpOnly Cookie
        storeAuth({ user });
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user },
        });
        console.log(
          `数据库模式登录成功 (${process.env.NEXT_PUBLIC_STORAGE_TYPE})`,
          { user },
        );
      } else {
        // localStorage 模式：保持原有兼容性，存储完整认证信息
        storeAuth({ user, accessToken, refreshToken });
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user, accessToken, refreshToken },
        });
        console.log('localStorage 模式登录成功', { user });
      }
    } catch (error) {
      let message = '登录失败';

      if (error instanceof Error) {
        // 根据错误类型提供更友好的错误信息
        if (error.message.includes('Failed to fetch')) {
          message = '网络连接失败，请检查网络连接';
        } else if (error.message.includes('401')) {
          message = '用户名或密码错误';
        } else if (error.message.includes('429')) {
          message = '登录尝试过于频繁，请稍后再试';
        } else if (error.message.includes('500')) {
          message = '服务器内部错误，请稍后再试';
        } else {
          message = error.message;
        }
      }

      dispatch({ type: 'AUTH_ERROR', payload: message });
      throw error;
    }
  }

  /**
   * 用户注销
   */
  async function logout() {
    console.log('=== 客户端登出调试 ===');

    try {
      // 通知服务器注销会话
      const response = await fetch(`${authConfig.apiBaseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 包含Cookie
      });

      if (!response.ok) {
        console.warn('服务器注销响应异常:', response.status);
      } else {
        console.log('服务器注销成功');
      }
    } catch (error) {
      console.error('注销请求失败:', error);
    } finally {
      // 无论服务器响应如何，都清除本地状态
      console.log('清除本地认证状态');
      clearStoredAuth();
      dispatch({ type: 'LOGOUT' });
    }
  }

  /**
   * 刷新令牌（带重试机制）
   */
  async function refreshToken(retryCount = 0) {
    const maxRetries = 2;
    
    try {
      const storedAuth = getStoredAuth();

      if (!storedAuth?.user) {
        throw new Error('用户未登录');
      }

      const response = await fetch(`${authConfig.apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 包含 HttpOnly Cookie
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '令牌刷新失败');
      }

      if (isDatabaseStorage) {
        // 数据库模式：服务器自动更新 HttpOnly Cookie，客户端无需操作
        console.log(
          `数据库模式令牌刷新成功 (${process.env.NEXT_PUBLIC_STORAGE_TYPE})`,
        );
        // 更新活动时间
        dispatch({
          type: 'REFRESH_TOKEN',
          payload: { accessToken: 'database-mode' },
        });
      } else {
        // localStorage 模式：保持原有兼容性，更新本地存储的 Token
        if (data.accessToken) {
          storeAuth({
            ...storedAuth,
            accessToken: data.accessToken,
          });
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: {
              user: storedAuth.user,
              accessToken: data.accessToken,
              refreshToken: storedAuth.refreshToken,
            },
          });
          console.log('localStorage 模式令牌刷新成功');
        }
      }
    } catch (error) {
      console.error(`令牌刷新失败 (尝试 ${retryCount + 1}/${maxRetries + 1}):`, error);
      
      // 如果还有重试次数，延迟重试
      if (retryCount < maxRetries) {
        console.log(`将在 ${5 * (retryCount + 1)} 秒后重试刷新令牌...`);
        setTimeout(() => refreshToken(retryCount + 1), 5000 * (retryCount + 1));
        return;
      }
      
      // 只有在确实是token过期的情况下才登出
      if (error instanceof Error && 
          (error.message.includes('401') || 
           error.message.includes('Token expired') || 
           error.message.includes('jwt expired') ||
           error.message.includes('令牌过期'))) {
        console.log('令牌已过期，执行登出');
        logout();
      } else {
        // 网络错误或其他临时错误，不登出，等待下次重试
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('令牌刷新失败，保持登录状态. 错误:', errorMessage);
      }
    }
  }

  /**
   * 更新用户信息
   */
  function updateUser(updates: Partial<AuthUser>) {
    dispatch({ type: 'UPDATE_USER', payload: updates });

    const storedAuth = getStoredAuth();
    if (storedAuth && storedAuth.user) {
      storeAuth({
        ...storedAuth,
        user: { ...storedAuth.user, ...updates },
      });
    }
  }

  /**
   * 清除错误
   */
  function clearError() {
    dispatch({ type: 'CLEAR_ERROR' });
  }

  /**
   * 检查权限
   */
  function hasPermission(resource: string, action: string): boolean {
    if (!state.user) return false;

    return state.user.permissions.some((permission) => {
      if (permission.resource !== resource && permission.resource !== '*') {
        return false;
      }

      return (
        permission.actions.includes(action as any) ||
        permission.actions.includes('manage' as any)
      );
    });
  }

  /**
   * 检查是否为管理员
   */
  function isAdmin(): boolean {
    return state.user?.role === 'admin' || state.user?.role === 'owner';
  }

  /**
   * 检查是否为超级管理员
   */
  function isOwner(): boolean {
    return state.user?.role === 'owner';
  }

  // ==================== 存储相关函数 ====================

  // 智能存储策略：根据存储类型选择最佳方案
  const isDatabaseStorage = ['redis', 'upstash', 'kvrocks'].includes(
    process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage',
  );

  function getStoredAuth() {
    if (isDatabaseStorage) {
      // 数据库模式：不使用 localStorage，完全依赖服务器端
      return null;
    } else {
      // localStorage 模式：保持兼容性
      try {
        const stored = localStorage.getItem(authConfig.storageKey);
        return stored ? JSON.parse(stored) : null;
      } catch (error) {
        console.error('读取存储认证信息失败:', error);
        return null;
      }
    }
  }

  function storeAuth(authData: {
    user: any;
    accessToken?: string;
    refreshToken?: string;
  }) {
    if (isDatabaseStorage) {
      // 数据库模式：用户信息存储在服务器端，客户端只存储必要信息
      console.log(
        `数据库存储模式 (${process.env.NEXT_PUBLIC_STORAGE_TYPE})：用户信息存储在服务器端`,
      );
      // 可选择性存储非敏感信息到 sessionStorage（页面刷新时清除）
      try {
        sessionStorage.setItem(
          'vidora_user_basic',
          JSON.stringify({
            username: authData.user.username,
            role: authData.user.role,
          }),
        );
      } catch (error) {
        console.warn('sessionStorage 不可用，跳过用户基本信息缓存');
      }
    } else {
      // localStorage 模式：保持原有兼容性
      try {
        localStorage.setItem(authConfig.storageKey, JSON.stringify(authData));
        console.log('localStorage 模式：用户信息存储在客户端');
      } catch (error) {
        console.error('存储用户信息失败:', error);
      }
    }
  }

  function clearStoredAuth() {
    if (isDatabaseStorage) {
      // 数据库模式：清除 sessionStorage
      try {
        sessionStorage.removeItem('vidora_user_basic');
        console.log('数据库存储模式：已清除客户端缓存');
      } catch (error) {
        console.warn('清除 sessionStorage 失败');
      }
    } else {
      // localStorage 模式：清除 localStorage
      try {
        localStorage.removeItem(authConfig.storageKey);
        console.log('localStorage 模式：已清除客户端存储');
      } catch (error) {
        console.error('清除认证信息失败:', error);
      }
    }
  }

  async function validateToken(): Promise<boolean> {
    try {
      const response = await fetch(`${authConfig.apiBaseUrl}/auth/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 包含 HttpOnly Cookie
      });

      return response.ok;
    } catch (error) {
      console.error('令牌验证失败:', error);
      return false;
    }
  }

  async function refreshStoredToken(refreshToken: string) {
    try {
      const response = await fetch(`${authConfig.apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        throw new Error('刷新令牌无效');
      }

      const data = await response.json();
      const storedAuth = getStoredAuth();

      if (storedAuth) {
        storeAuth({
          ...storedAuth,
          accessToken: data.accessToken,
        });

        dispatch({
          type: 'REFRESH_TOKEN',
          payload: { accessToken: data.accessToken },
        });
      }
    } catch (error) {
      clearStoredAuth();
      dispatch({ type: 'AUTH_ERROR', payload: '会话已过期' });
    }
  }

  const updateActivity = useCallback(() => {
    dispatch({ type: 'UPDATE_ACTIVITY' });
  }, []);

  const value = {
    state,
    login,
    logout,
    refreshToken,
    updateUser,
    updateActivity,
    clearError,
    hasPermission,
    isAdmin,
    isOwner,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * 使用认证的 Hook
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth 必须在 AuthProvider 内部使用');
  }

  return context;
}

/**
 * 权限检查 Hook
 */
export function usePermission(resource: string, action: string) {
  const { hasPermission } = useAuth();
  return hasPermission(resource, action);
}

/**
 * 角色检查 Hook
 */
export function useRole(requiredRole: 'user' | 'admin' | 'owner') {
  const { state } = useAuth();

  if (!state.user) return false;

  const roleHierarchy = {
    user: 0,
    admin: 1,
    owner: 2,
  };

  const userLevel = roleHierarchy[state.user.role] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userLevel >= requiredLevel;
}
