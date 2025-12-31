/**
 * 认证指标API
 */

import { NextRequest, NextResponse } from 'next/server';

import { AuthManager } from '@/lib/auth/core/auth-manager';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // 验证请求者权限
    const authManager = AuthManager.getInstance();
    const result = await authManager.authenticate(request);

    if (!result.success || result.user?.role !== 'owner') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    // 获取缓存统计
    const cacheStats = {
      size: 0,
      hits: 0,
      misses: 0,
    }; // 临时返回空数据，等待AuthManager实现

    return NextResponse.json({
      cache: cacheStats,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('认证指标API错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
