/**
 * 认证相关Hooks
 */

import { useAuth } from '@/components/auth/AuthProvider';

/**
 * 检查用户是否已认证
 */
export function useAuthenticated(): boolean {
  const { state } = useAuth();
  return !!state.user;
}

/**
 * 获取用户角色
 */
export function useUserRole(): string | null {
  const { state } = useAuth();
  return state.user?.role || null;
}

/**
 * 获取用户名
 */
export function useUsername(): string | null {
  const { state } = useAuth();
  return state.user?.username || null;
}

/**
 * 获取认证加载状态
 */
export function useAuthLoading(): boolean {
  const { state } = useAuth();
  return state.loading;
}

/**
 * 获取认证错误信息
 */
export function useAuthError(): string | null {
  const { state } = useAuth();
  return state.error;
}

/**
 * 检查是否为管理员
 */
export function useIsAdmin(): boolean {
  const role = useUserRole();
  return role === 'admin' || role === 'owner';
}

/**
 * 检查是否为站长
 */
export function useIsOwner(): boolean {
  const role = useUserRole();
  return role === 'owner';
}
