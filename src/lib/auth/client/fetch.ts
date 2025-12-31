/* eslint-disable no-console */

'use client';

/**
 * 简化的 API 调用函数 - 基于新的认证架构
 * 自动处理认证头和错误处理
 */
const api = {
  /**
   * GET 请求
   */
  get: async <T = any>(url: string, options?: RequestInit): Promise<T> => {
    const response = await authenticatedFetch(url, {
      ...options,
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return response.json();
  },

  /**
   * POST 请求
   */
  post: async <T = any>(
    url: string,
    data?: any,
    options?: RequestInit,
  ): Promise<T> => {
    const response = await authenticatedFetch(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return response.json();
  },

  /**
   * PUT 请求
   */
  put: async <T = any>(
    url: string,
    data?: any,
    options?: RequestInit,
  ): Promise<T> => {
    const response = await authenticatedFetch(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return response.json();
  },

  /**
   * DELETE 请求
   */
  delete: async <T = any>(url: string, options?: RequestInit): Promise<T> => {
    const response = await authenticatedFetch(url, {
      ...options,
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return response.json();
  },

  /**
   * 文件上传
   */
  upload: async <T = any>(
    url: string,
    file: File,
    options?: RequestInit,
  ): Promise<T> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await authenticatedFetch(url, {
      ...options,
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    return response.json();
  },
};

/**
 * 带认证的 fetch 函数
 * 自动从 useAuth 获取认证状态并添加认证头
 */
async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  try {
    // 尝试从 localStorage 获取认证信息（兼容旧代码）
    let accessToken = getAccessTokenFromStorage();

    // 如果没有 token，尝试从当前认证状态获取
    if (!accessToken) {
      // 在客户端环境下，我们可以尝试获取当前的认证状态
      if (typeof window !== 'undefined') {
        const authData = localStorage.getItem('vidora_auth');
        if (authData) {
          const parsed = JSON.parse(authData);
          accessToken = parsed.accessToken;
        }
      }
    }

    // 如果有 token，添加认证头
    if (accessToken) {
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      };
    }

    return fetch(url, options);
  } catch (error) {
    console.error('认证请求失败:', error);
    // 如果认证失败，仍然发起请求（让服务端处理）
    return fetch(url, options);
  }
}

/**
 * 从存储中获取访问令牌
 */
function getAccessTokenFromStorage(): string | null {
  try {
    if (typeof window === 'undefined') return null;

    const stored = localStorage.getItem('vidora_auth');
    if (!stored) return null;

    const authData = JSON.parse(stored);
    return authData.accessToken || null;
  } catch (error) {
    console.error('获取访问令牌失败:', error);
    return null;
  }
}

/**
 * 认证状态监听器
 */
export class AuthStateListener {
  private listeners: Set<() => void> = new Set();

  /**
   * 添加监听器
   */
  addListener(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * 通知所有监听器
   */
  notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('认证状态监听器执行失败:', error);
      }
    });
  }

  /**
   * 清除所有监听器
   */
  clear(): void {
    this.listeners.clear();
  }
}

/**
 * 全局认证状态监听器
 */
export const authStateListener = new AuthStateListener();

/**
 * 监听认证状态变化
 */
export function useAuthState(listener: () => void): () => void {
  return authStateListener.addListener(listener);
}

export { api };
