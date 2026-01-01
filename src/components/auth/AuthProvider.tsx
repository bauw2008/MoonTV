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
      // AUTH_SUCCESS
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
  setAuthState: (user: any) => void;
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
    tokenRefreshThreshold: 6 * 60 * 60 * 1000, // 6小时
    sessionTimeout: 24 * 60 * 60 * 1000, // 24小时
    autoRefresh: true,
    storageKey: 'vidora_auth',
    ...config,
  };

  /**
   * 用户活跃检测
   */
  useEffect(() => {
    if (!state.isAuthenticated) {
      return;
    }

    const activityEvents = [
      'mousedown', 'mousemove', 'keypress', 
      'scroll', 'touchstart', 'click', 'focus'
    ];

    const handleUserActivity = () => {
      // 用户有活动，更新最后活动时间
      dispatch({ type: 'UPDATE_ACTIVITY' });
      
      // 如果Token即将过期，主动刷新
      if (isTokenExpiringSoon(30)) { // 30分钟内过期
        
        refreshToken();
      }
    };

    // 节流处理，避免过于频繁的触发
    let throttleTimer: NodeJS.Timeout;
    const throttledActivityHandler = () => {
      if (throttleTimer) return;
      
      handleUserActivity();
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
      }, 5000); // 5秒内只处理一次
    };

    // 添加事件监听
    activityEvents.forEach(event => {
      document.addEventListener(event, throttledActivityHandler, { passive: true });
    });

    // 页面可见性变化时也检查
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        handleUserActivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // 清理事件监听
      activityEvents.forEach(event => {
        document.removeEventListener(event, throttledActivityHandler);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (throttleTimer) {
        clearTimeout(throttleTimer);
      }
    };
  }, [state.isAuthenticated]);

  /**
   * 初始化认证状态
   */
  useEffect(() => {
    initializeAuth();
  }, []);

  // 检查权限版本变化
  useEffect(() => {
    if (!state.isAuthenticated || !state.user) return;

    // 用户操作时检查权限版本
    const checkPermissionVersion = async () => {
      try {
        const response = await fetch('/api/auth/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          const currentVersion = state.user.permissionVersion || 0;
          
          // 如果权限版本号变化，强制下线
          if (data.user && data.user.permissionVersion > currentVersion) {
            clearStoredAuth();
            dispatch({ type: 'LOGOUT' });
            
            // 显示提示并跳转到登录页
            if (typeof window !== 'undefined') {
              const toastEvent = new CustomEvent('showToast', {
                detail: {
                  type: 'warning',
                  message: '您的权限已被更新，请重新登录',
                  duration: 5000
                }
              });
              window.dispatchEvent(toastEvent);
              
              setTimeout(() => {
                window.location.href = '/login';
              }, 1000);
            }
          }
        }
      } catch (error) {
        // 忽略错误，避免频繁检查
      }
    };

    // 监听用户活动
    const handleUserActivity = () => {
      checkPermissionVersion();
    };

    // 添加事件监听器
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);

    // 清理函数
    return () => {
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
    };
  }, [state.isAuthenticated, state.user?.permissionVersion]);

  /**
   * 自动刷新令牌
   */
  useEffect(() => {
    if (!authConfig.autoRefresh || !state.isAuthenticated) {
      return;
    }

    const checkAndRefresh = async () => {
      try {
        // 检查Token是否即将过期（剩余1小时内）
        const tokenExpiryTime = getTokenExpiryTime();
        const timeUntilExpiry = tokenExpiryTime - Date.now();
        
        if (timeUntilExpiry < 60 * 60 * 1000) { // 1小时内过期

          await refreshToken();
        }
      } catch (error) {
        console.error('Token检查失败:', error);
      }
    };

    // 每5分钟检查一次Token状态
    const interval = setInterval(checkAndRefresh, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [state.isAuthenticated, authConfig.autoRefresh]);

  /**
   * 检查权限版本号（静默更新，不强制下线）
   */
  useEffect(() => {
    if (!state.isAuthenticated || !state.user) {
      return;
    }

    const checkPermissionVersion = async () => {
      try {
        const response = await fetch('/api/auth/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          
          // 检查权限版本号是否变化
          const currentVersion = state.user.permissionVersion || 0;
          const serverVersion = data.user?.permissionVersion || 0;
          
          if (serverVersion > currentVersion) {
            // 权限版本号已更新，静默更新用户信息，不强制下线
            
            dispatch({
              type: 'UPDATE_USER',
              payload: { 
                permissionVersion: serverVersion,
                role: data.user?.role || state.user.role
              }
            });
          }
        }
      } catch (error) {
        // 静默处理错误，不影响用户体验
        console.warn('权限版本检查失败:', error);
      }
    };

    // 在用户活动时检查权限版本号
    const handleActivity = () => {
      checkPermissionVersion();
    };

    // 监听用户活动事件
    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [state.isAuthenticated, state.user]);

  /**
   * 初始化认证状态 - 智能认证策略
   */
  async function initializeAuth() {
    try {
      // 初始化认证状态

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

        // 数据库模式验证响应

        if (response.ok) {
          const data = await response.json();
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: {
              user: data.user,
            },
          });
        } else {
          dispatch({ type: 'AUTH_ERROR', payload: '' });
        }
      } else {
        // localStorage 模式：保持原有兼容性逻辑
        // localStorage 模式初始化

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

      // 登录成功，处理响应数据

      if (isDatabaseStorage) {
        // 数据库模式：只存储用户基本信息，Token 完全依赖 HttpOnly Cookie
        storeAuth({ user });
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user },
        });
        // 数据库模式登录成功
      } else {
        // localStorage 模式：保持原有兼容性，存储完整认证信息
        storeAuth({ user, accessToken, refreshToken });
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user, accessToken, refreshToken },
        });
        // localStorage 模式登录成功
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
    // 客户端登出

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
        // 服务器注销成功
      }
    } catch (error) {
      console.error('注销请求失败:', error);
    } finally {
      // 无论服务器响应如何，都清除本地状态
      // 清除本地认证状态
      clearStoredAuth();
      dispatch({ type: 'LOGOUT' });
    }
  }

  /**
   * 获取Token过期时间
   */
  function getTokenExpiryTime(): number {
    try {
      const storedAuth = getStoredAuth();
      if (!storedAuth?.accessToken) {
        return 0;
      }

      // 解析JWT Token获取过期时间
      const token = storedAuth.accessToken;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000; // 转换为毫秒
    } catch (error) {
      console.error('解析Token过期时间失败:', error);
      return 0;
    }
  }

  /**
   * 检查Token是否即将过期
   */
  function isTokenExpiringSoon(thresholdMinutes = 60): boolean {
    const expiryTime = getTokenExpiryTime();
    const timeUntilExpiry = expiryTime - Date.now();
    return timeUntilExpiry < thresholdMinutes * 60 * 1000;
  }

  /**
   * 刷新令牌（带重试机制）
   */
  async function refreshToken(retryCount = 0) {
    const maxRetries = 3;
    
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
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '令牌刷新失败');
      }

      if (isDatabaseStorage) {
        dispatch({
          type: 'REFRESH_TOKEN',
          payload: { accessToken: 'database-mode' }
        });
      } else {
        if (data.accessToken) {
          // 更新存储的认证信息，保持refreshToken不变
          const updatedAuth = {
            ...storedAuth,
            accessToken: data.accessToken,
            refreshToken: storedAuth.refreshToken // 保持原有的refreshToken
          };
          storeAuth(updatedAuth);
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: {
              user: storedAuth.user,
              accessToken: data.accessToken,
              refreshToken: storedAuth.refreshToken
            }
          });
        }
      }
    } catch (error) {
      if (retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        setTimeout(() => refreshToken(retryCount + 1), delay);
      } else {
        setTimeout(() => refreshToken(0), 10 * 60 * 1000);
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
      // 数据库存储模式：用户信息存储在服务器端
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
        // localStorage 模式：用户信息存储在客户端
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
        // 数据库存储模式：已清除客户端缓存
      } catch (error) {
        console.warn('清除 sessionStorage 失败');
      }
    } else {
      // localStorage 模式：清除 localStorage
      try {
        localStorage.removeItem(authConfig.storageKey);
        // localStorage 模式：已清除客户端存储
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
      return false;
    }
  }

  async function _refreshStoredToken(refreshToken: string) {
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

  /**
   * 直接设置认证状态（用于注册后更新）
   */
  function setAuthState(user: any) {
    dispatch({
      type: 'AUTH_SUCCESS',
      payload: { user }
    });
    
    // 在数据库模式下，存储用户基本信息到sessionStorage
    if (isDatabaseStorage) {
      try {
        sessionStorage.setItem(
          'vidora_user_basic',
          JSON.stringify({
            username: user.username,
            role: user.role,
          }),
        );
      } catch (error) {
        console.warn('sessionStorage 不可用，跳过用户基本信息缓存');
      }
    }
  }

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
    setAuthState,
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
